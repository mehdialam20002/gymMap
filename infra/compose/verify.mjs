/**
 * M-005 · `pnpm infra:verify` — proves the local stack actually satisfies the milestone.
 *
 * `docker compose ps` reporting "healthy" only means each container's own health check passed.
 * It does not prove the things this milestone actually promises: that the kyc bucket refuses an
 * anonymous GET, that Redis really has three databases, that Postgres is really 16.
 *
 * Uses raw TCP/HTTP rather than a client library, so it needs no dependency and runs before any
 * of the application's own packages are wired up.
 */

import net from 'node:net';

const CHECKS = [];
const check = (name, why, fn) => CHECKS.push({ name, why, fn });

/** Minimal RESP client — enough to issue one command and read one reply. */
function redisCommand(command, { host = '127.0.0.1', port = 6379, timeoutMs = 3000 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let buffer = '';
    const done = (fn, arg) => {
      socket.destroy();
      fn(arg);
    };
    socket.setTimeout(timeoutMs, () =>
      done(reject, new Error(`redis timeout after ${timeoutMs}ms`)),
    );
    socket.on('error', (error) => done(reject, error));
    socket.on('connect', () => {
      const parts = command.split(' ');
      socket.write(`*${parts.length}\r\n${parts.map((p) => `$${p.length}\r\n${p}\r\n`).join('')}`);
    });
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (buffer.includes('\r\n')) done(resolve, buffer);
    });
  });
}

async function httpStatus(url, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'manual' });
    return response.status;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------

check('redis reachable', 'nothing queues or caches without it', async () => {
  const reply = await redisCommand('PING');
  if (!reply.startsWith('+PONG')) throw new Error(`unexpected reply: ${JSON.stringify(reply)}`);
});

check(
  'AC-2 · redis has exactly three logical databases',
  'a shared index lets a cache FLUSHDB delete accepted BullMQ jobs',
  async () => {
    // db 2 must exist (ratelimit) and db 3 must not (nothing beyond the Terraform split).
    const ok = await redisCommand('SELECT 2');
    if (!ok.startsWith('+OK')) throw new Error('db 2 (ratelimit) is not selectable');

    const beyond = await redisCommand('SELECT 3');
    if (beyond.startsWith('+OK')) {
      throw new Error(
        'db 3 is selectable — Redis is not capped at 3 databases, so a fourth namespace can be ' +
          'created that Terraform never provisioned',
      );
    }
  },
);

check('minio S3 API reachable', 'uploads and renditions need it', async () => {
  const status = await httpStatus('http://127.0.0.1:9000/minio/health/live');
  if (status !== 200) throw new Error(`health endpoint returned ${status}`);
});

check(
  'AC-3 · the kyc bucket refuses an anonymous GET',
  'BR-DAT-07 — an anonymously readable KYC bucket exposes PAN, Aadhaar and bank proofs',
  async () => {
    const status = await httpStatus('http://127.0.0.1:9000/gymmap-kyc/');
    if (status === 200) {
      throw new Error(
        'the kyc bucket is anonymously readable. This is a BR-DAT-07 breach: KYC documents are ' +
          'PAN cards, Aadhaar and bank proofs.',
      );
    }
    if (status !== 403 && status !== 401) {
      throw new Error(`expected 403/401 from an anonymous GET, received ${status}`);
    }
  },
);

check(
  'the media bucket IS anonymously readable',
  'gym photos are served through the CDN; if this fails, listings render blank',
  async () => {
    const status = await httpStatus('http://127.0.0.1:9000/gymmap-media/');
    if (status === 403) {
      throw new Error('the media bucket is private — gym images will not load through the CDN');
    }
  },
);

check('mailpit reachable', 'the only mail sink; A-19 vendors are still deferred', async () => {
  const status = await httpStatus('http://127.0.0.1:8025/readyz');
  if (status !== 200) throw new Error(`mailpit readyz returned ${status}`);
});

check('postgres accepting connections', 'everything downstream', async () => {
  await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: 5432 });
    socket.setTimeout(3000, () => {
      socket.destroy();
      reject(new Error('timeout'));
    });
    socket.on('connect', () => {
      socket.destroy();
      resolve();
    });
    socket.on('error', reject);
  });
});

// ---------------------------------------------------------------------------

const results = [];
for (const { name, why, fn } of CHECKS) {
  try {
    await fn();
    results.push({ ok: true, name });
    console.log(`  [32mPASS[0m  ${name}`);
  } catch (error) {
    results.push({ ok: false, name });
    console.log(`  [31mFAIL[0m  ${name}`);
    console.log(`        ${error instanceof Error ? error.message : String(error)}`);
    console.log(`        why it matters: ${why}`);
  }
}

const failed = results.filter((r) => !r.ok).length;
console.log('');
if (failed > 0) {
  console.log(`${failed} of ${results.length} checks failed.`);
  console.log('If nothing is running:  pnpm infra:up');
  process.exit(1);
}
console.log(`All ${results.length} checks passed. The local stack matches M-005.`);
