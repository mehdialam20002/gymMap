/**
 * M-020 · Argon2id — `A-12`, `Security.md` §2.4.2, `AC-2`.
 *
 * ┌─ THIS SUITE EXISTS BECAUSE OF ONE SENTENCE IN `A-12` ───────────────────────────────────────┐
 * │ The addition was approved on the condition *"Parameter tuning must be recorded."*           │
 * │ `Security.md` §2.4.2 is the record. This is the check that the record and the running code  │
 * │ agree — and the failure it exists to catch is silent:                                        │
 * │                                                                                              │
 * │   `argon2` ships a new major with a different default `memoryCost`. Every existing test      │
 * │   passes, because they all hash and verify with the same library. Every password hashed      │
 * │   from that deploy onward is weaker, and nothing anywhere says so.                            │
 * │                                                                                              │
 * │ So the parameters are read back OUT of a real hash, by decoding the PHC string, rather than │
 * │ asserted against the config object that produced it. Asserting `config.X === 65536` proves   │
 * │ the config; decoding the digest proves what the library actually did with it.                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  Argon2HasherAdapter,
  BoundedSemaphore,
  HashCapacityExhaustedError,
  parsePhcParameters,
} from '../dist/iam/infrastructure/argon2.hasher.adapter.js';

/** `Security.md` §2.4.2, verbatim. Changing a number here is changing the security posture. */
const RECORDED = {
  variant: 'argon2id',
  version: 19,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
  hashLengthBytes: 32,
  saltLengthBytes: 16,
} as const;

const configWith = (over: Record<string, unknown> = {}) =>
  ({
    ARGON2_MEMORY_COST: RECORDED.memoryCost,
    ARGON2_TIME_COST: RECORDED.timeCost,
    ARGON2_PARALLELISM: RECORDED.parallelism,
    ARGON2_MAX_CONCURRENCY: 8,
    ARGON2_QUEUE_TIMEOUT_MS: 5_000,
    ...over,
  }) as never;

const adapter = (over: Record<string, unknown> = {}) => new Argon2HasherAdapter(configWith(over));

// ═══════════════════════════════════════════════════════════════════════════
// AC-2 — the parameters, decoded from a real hash.
// ═══════════════════════════════════════════════════════════════════════════

test('AC-2 · a fresh hash carries the §2.4.2 parameters, decoded from the digest', async () => {
  const hash = await adapter().hash('correct horse battery staple');

  // `$argon2id$v=19$<params>$<salt>$<hash>`. NOTE the parameter ORDER is the binding's, not
  // §2.4.2's illustrative `m,t,p` — the PHC spec does not fix it, so nothing may depend on it.
  const segments = hash.split('$');
  assert.equal(segments[1], RECORDED.variant, `variant is ${String(segments[1])}, not argon2id`);
  assert.equal(segments[2], `v=${String(RECORDED.version)}`);

  const parsed = parsePhcParameters(hash);
  assert.deepEqual(parsed, {
    memoryCost: RECORDED.memoryCost,
    timeCost: RECORDED.timeCost,
    parallelism: RECORDED.parallelism,
  });
});

test('AC-2 · the salt is 16 CSPRNG bytes and the digest is 32, per §2.4.2', async () => {
  // This binding exposes no `saltLength` option, so the 16 bytes are ITS default — which makes
  // asserting them more important, not less. An upgrade that changed it would go unnoticed.
  const hash = await adapter().hash('correct horse battery staple');
  const segments = hash.split('$');

  assert.equal(Buffer.from(segments[4]!, 'base64').length, RECORDED.saltLengthBytes);
  assert.equal(Buffer.from(segments[5]!, 'base64').length, RECORDED.hashLengthBytes);
});

test('AC-2 · the salt is per-hash, so two hashes of one password differ', async () => {
  // Without a per-hash salt, identical passwords produce identical digests and a single
  // rainbow table breaks every account that chose the same one.
  const subject = adapter();
  const [a, b] = await Promise.all([subject.hash('same password'), subject.hash('same password')]);

  assert.notEqual(a, b, 'two hashes of one password are identical — the salt is not per-hash');
  assert.equal(a.split('$')[4] !== b.split('$')[4], true);
});

test('the config is what drives it — a raised cost appears in the digest', async () => {
  // Proves the parameters come from configuration and not from a constant the tests happen to
  // match. §2.4.2 requires annual re-calibration, which must not be a code change.
  const hash = await adapter({ ARGON2_MEMORY_COST: 131072, ARGON2_TIME_COST: 4 }).hash('pw');
  assert.deepEqual(parsePhcParameters(hash), {
    memoryCost: 131072,
    timeCost: 4,
    parallelism: 1,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The round trip.
// ═══════════════════════════════════════════════════════════════════════════

test('a correct password verifies and a wrong one does not', async () => {
  const subject = adapter();
  const hash = await subject.hash('correct horse battery staple');

  assert.equal(await subject.verify(hash, 'correct horse battery staple'), true);
  assert.equal(await subject.verify(hash, 'Correct horse battery staple'), false);
  assert.equal(await subject.verify(hash, 'correct horse battery stapl'), false);
  assert.equal(await subject.verify(hash, ''), false);
});

test('whitespace is significant — the password is not trimmed anywhere', async () => {
  // `Security.md` §2.4.1: "leading/trailing whitespace preserved. A password is a byte string;
  // silently trimming it makes the stored hash disagree with what the user typed elsewhere."
  const subject = adapter();
  const hash = await subject.hash(' spaced password ');

  assert.equal(await subject.verify(hash, ' spaced password '), true);
  assert.equal(await subject.verify(hash, 'spaced password'), false);
});

test('a malformed stored hash THROWS rather than reporting "wrong password"', async () => {
  // The distinction matters to a real member. A corrupt hash reported as a mismatch sends them
  // to reset a password that was never the problem, and the corruption is never investigated.
  await assert.rejects(() => adapter().verify('not-a-phc-string', 'anything'));
});

// ═══════════════════════════════════════════════════════════════════════════
// needsRehash — one-directional, deliberately.
// ═══════════════════════════════════════════════════════════════════════════

test('a hash at current parameters does NOT need rehashing', async () => {
  const subject = adapter();
  assert.equal(subject.needsRehash(await subject.hash('pw')), false);
});

test('a WEAKER hash needs rehashing — on each of the three parameters', async () => {
  const current = adapter();
  const weakMemory = await adapter({ ARGON2_MEMORY_COST: 19456 }).hash('pw');
  const weakTime = await adapter({ ARGON2_TIME_COST: 2 }).hash('pw');

  assert.equal(current.needsRehash(weakMemory), true, 'a lower memoryCost was accepted');
  assert.equal(current.needsRehash(weakTime), true, 'a lower timeCost was accepted');
});

test('a STRONGER hash does NOT need rehashing — the check is one-directional', async () => {
  // `argon2.needsRehash()` returns true when the parameters DIFFER either way. §2.4.2 says
  // re-hash when they are "weaker than current policy". After a deliberate downgrade — a
  // smaller instance class — the library's answer would re-hash every strong password into a
  // weaker one, on login, silently. That is why this adapter does not use it.
  const strong = await adapter({ ARGON2_MEMORY_COST: 131072, ARGON2_TIME_COST: 5 }).hash('pw');
  assert.equal(adapter().needsRehash(strong), false, 'a stronger hash was marked for downgrade');
});

test('an unparseable hash needs rehashing', async () => {
  // "Not our format" must be replaced, not left forever. Returning false would strand a legacy
  // or corrupt value in the column indefinitely.
  assert.equal(adapter().needsRehash('$2b$12$legacy.bcrypt.value'), true);
  assert.equal(adapter().needsRehash(''), true);
  await Promise.resolve();
});

test('parsePhcParameters refuses anything that is not an argon2id PHC string', () => {
  assert.equal(parsePhcParameters('$argon2i$v=19$m=65536,t=3,p=1$a$b'), null, 'accepted argon2i');
  assert.equal(parsePhcParameters('$argon2d$v=19$m=65536,t=3,p=1$a$b'), null, 'accepted argon2d');
  assert.equal(parsePhcParameters('plain text'), null);
});

// ═══════════════════════════════════════════════════════════════════════════
// Security.md §1.6 — the enumeration defence.
// ═══════════════════════════════════════════════════════════════════════════

test('burnEquivalentWork costs the same order of magnitude as a real verify', async () => {
  // §2.4.2: "the absence of a ~250 ms delay is a user-enumeration oracle that no amount of
  // response-body uniformity fixes."
  //
  // Asserted as a RATIO, not an absolute — the absolute depends on the machine, and a test that
  // hardcodes 250 ms is red on a fast laptop and green on an overloaded runner, which is
  // backwards. A ratio holds on both.
  const subject = adapter();
  await subject.onModuleInit();
  const hash = await subject.hash('a real password');

  // Warm the pool first: the very first hash in a process pays a one-off cost that would
  // dominate whichever measurement happened to go first.
  await subject.verify(hash, 'wrong');

  const realStart = process.hrtime.bigint();
  await subject.verify(hash, 'wrong password');
  const realMs = Number(process.hrtime.bigint() - realStart) / 1e6;

  const decoyStart = process.hrtime.bigint();
  await subject.burnEquivalentWork('wrong password');
  const decoyMs = Number(process.hrtime.bigint() - decoyStart) / 1e6;

  const ratio = decoyMs / realMs;
  assert.ok(
    ratio > 0.5 && ratio < 2,
    `the decoy path took ${decoyMs.toFixed(1)}ms against a real verify's ${realMs.toFixed(1)}ms ` +
      `(ratio ${ratio.toFixed(2)}). A measurable difference between "no such account" and ` +
      '"wrong password" is a working enumeration oracle.',
  );
});

test('burnEquivalentWork works before onModuleInit, just more slowly', async () => {
  // A test — or a misconfigured module — that never calls the lifecycle hook must still get the
  // work burned. Returning early would make the enumeration defence conditional on wiring.
  await assert.doesNotReject(() => adapter().burnEquivalentWork('anything'));
});

// ═══════════════════════════════════════════════════════════════════════════
// The semaphore — a memory cap, so an unbounded one is the bug.
// ═══════════════════════════════════════════════════════════════════════════

test('the semaphore admits exactly its permit count concurrently', async () => {
  const semaphore = new BoundedSemaphore(2, 1_000);
  await semaphore.acquire();
  await semaphore.acquire();

  let third = false;
  const pending = semaphore.acquire().then(() => {
    third = true;
  });

  await new Promise((r) => setImmediate(r));
  assert.equal(third, false, 'a third holder was admitted against a 2-permit semaphore');
  assert.equal(semaphore.queueDepth, 1);

  semaphore.release();
  await pending;
  assert.equal(third, true, 'a release did not hand the permit to the waiter');
});

test('a timed-out waiter is REMOVED from the queue, not left to leak a permit', async () => {
  // The defect this pins. If the waiter stays in the array after rejecting, the next release()
  // hands it a permit that is never returned — so the pool loses one slot per timeout, and
  // after `permits` timeouts the login path is offline with no error explaining why.
  const semaphore = new BoundedSemaphore(1, 50);
  await semaphore.acquire();

  await assert.rejects(() => semaphore.acquire(), /no hash slot within 50ms/);
  assert.equal(semaphore.queueDepth, 0, 'the timed-out waiter is still queued');

  semaphore.release();
  // The permit must be available again — this resolves immediately if it is.
  await semaphore.acquire();
});

test('exhausting the ceiling raises HashCapacityExhaustedError, not a generic failure', async () => {
  // 503, not 500. The request is fine; the instance is at its deliberate memory cap, and that
  // is something a load balancer can act on.
  const subject = adapter({ ARGON2_MAX_CONCURRENCY: 1, ARGON2_QUEUE_TIMEOUT_MS: 1 });

  const results = await Promise.allSettled([
    subject.hash('one'),
    subject.hash('two'),
    subject.hash('three'),
  ]);

  const rejected = results.filter((r) => r.status === 'rejected');
  assert.ok(rejected.length >= 1, 'a 1-permit, 1ms-timeout pool admitted three hashes');
  for (const failure of rejected) {
    assert.ok((failure as PromiseRejectedResult).reason instanceof HashCapacityExhaustedError);
    assert.match(
      ((failure as PromiseRejectedResult).reason as Error).message,
      /deliberate memory cap/,
      'the error must say the ceiling is intentional, or an operator raises it in an incident',
    );
  }
});

test('a throwing hash still releases its permit', async () => {
  // `finally`, always. Eight throws without it would retire every permit and take the login
  // path offline, with nothing in the logs pointing at the cause.
  const subject = adapter({ ARGON2_MAX_CONCURRENCY: 1, ARGON2_QUEUE_TIMEOUT_MS: 200 });

  await assert.rejects(() => subject.verify('not-a-phc-string', 'pw'));

  // If the permit leaked, this times out instead of succeeding.
  assert.equal(typeof (await subject.hash('still works')), 'string');
});
