/**
 * M-004 AC-8 · NFR-SCAL-05 — the worker bootstrap exposes no HTTP server.
 *
 * `createApplicationContext` versus `create` is a one-word difference that a future edit could
 * reverse without anyone noticing in review. The consequence is not obvious either: a worker
 * holding a port gets added to the load balancer's target group and starts receiving API traffic
 * it has no controllers for, which presents as intermittent 502s rather than as the
 * misconfiguration it is.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Resolved from the package root rather than import.meta.url: apps/server emits CommonJS
// (nest.json inherits NodeNext and there is no "type": "module"), and import.meta is a
// syntax error in a CJS output target. pnpm runs scripts with cwd at the package root.
const workerSource = readFileSync(resolve('src/worker.ts'), 'utf8');

test('AC-8 — the worker uses createApplicationContext, never NestFactory.create', () => {
  assert.match(
    workerSource,
    /createApplicationContext/,
    'the worker must build a DI container with no HTTP adapter',
  );
  assert.ok(
    !/NestFactory\.create\s*\(/.test(workerSource),
    'worker.ts calls NestFactory.create, which binds an HTTP adapter. NFR-SCAL-05 requires the ' +
      'queue role to hold no port — otherwise the load balancer routes API traffic to it.',
  );
});

test('AC-8 — the worker never calls listen()', () => {
  assert.ok(
    !/\.listen\s*\(/.test(workerSource),
    'worker.ts calls listen() — it must not bind a port',
  );
});

test('the worker bootstrap returns a context with no getHttpServer', async () => {
  // Importing the built module runs its top-level guard; NODE_ENV=test keeps it from
  // self-starting, so only the exported bootstrap is exercised.
  process.env['NODE_ENV'] = 'test';
  const { bootstrapWorker } = await import('../dist/worker.js');

  const previous = { ...process.env };
  Object.assign(process.env, {
    APP_ENV: 'test',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/gymmap?schema=public',
    REDIS_URL: 'redis://localhost:6379',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'ap-south-1',
    S3_ACCESS_KEY_ID: 'minioadmin',
    S3_SECRET_ACCESS_KEY: 'minioadmin',
    S3_MEDIA_BUCKET: 'gymmap-media',
    S3_KYC_BUCKET: 'gymmap-kyc',
    CDN_BASE_URL: 'http://localhost:9000/gymmap-media',
    CLAMAV_HOST: 'localhost', // A-42 — required, no default (ADR-0048)
    JWT_ACCESS_SECRET: 'a'.repeat(48),
    JWT_REFRESH_SECRET: 'b'.repeat(48),
    QR_SIGNING_PRIVATE_KEY: 'c'.repeat(48),
    // M-024 — required with no default, so the worker will not boot without it.
    // 64 hex characters = exactly 32 bytes. A 48-char value looked right and decoded to
    // 36, which the cipher refuses at boot — the check doing precisely its job.
    MFA_SECRET_KEY: 'd'.repeat(64),
    QR_SIGNING_KEY_ID: 'test-1',
    PAYMENT_PROVIDER: 'stub',
    SMTP_HOST: 'localhost',
    SMTP_PORT: '1025',
    SMTP_FROM: 'GymMap <no-reply@gymmap.local>',
  });

  const app = await bootstrapWorker();
  try {
    assert.ok(
      !('getHttpServer' in app),
      'the worker context exposes getHttpServer — it has an HTTP adapter attached',
    );
  } finally {
    await app.close();
    process.env = previous;
  }
});

test('main.ts DOES bind a listener — the two roles are genuinely different', () => {
  // The mirror assertion. If this ever fails, the split has collapsed in the other direction and
  // nothing serves HTTP at all.
  const mainSource = readFileSync(resolve('src/main.ts'), 'utf8');
  assert.match(mainSource, /app\.listen\(/);
  assert.match(mainSource, /NestFactory\.create\(/);
});
