/**
 * M-020 · The Redis credential store and lockout counter, against a REAL Redis.
 *
 * ┌─ EVERY CLAIM IN THESE TWO ADAPTERS IS A CONCURRENCY CLAIM ──────────────────────────────────┐
 * │ "Single use", "the window does not reset", "the counter is atomic" — none of them can be    │
 * │ asserted against a fake. An in-memory double implements `getdel` as a read followed by a    │
 * │ delete and passes a single-use test that the real race would fail.                           │
 * │                                                                                              │
 * │ So this suite talks to the container. `AC-FND-07.4`'s lesson from M-017 applies here in      │
 * │ full: the concurrent cases fire SIMULTANEOUSLY, because a sequential version passes against │
 * │ an implementation that has the race.                                                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { Redis } from 'ioredis';

import {
  RedisCredentialTokenStore,
  digestOf,
} from '../../dist/iam/infrastructure/redis-credential-token.store.js';
import { RedisLockoutCounter } from '../../dist/iam/infrastructure/redis-lockout-counter.adapter.js';
import { FixedClock } from '../../dist/common/clock/fixed-clock.adapter.js';
import { requireRole } from './_availability.ts';

const REDIS_URL = process.env['REDIS_URL_TEST'] ?? 'redis://localhost:6379/2';

const config = {
  PASSWORD_RESET_TTL_SECONDS: 1_800,
  EMAIL_VERIFICATION_TTL_HOURS: 24,
  LOCKOUT_WINDOW_SECONDS: 900,
} as never;

let redis: Redis;
let store: RedisCredentialTokenStore;
let counter: RedisLockoutCounter;
let available = false;

const USER = '01912f00-0000-7000-8000-0000000000f1';
const OTHER = '01912f00-0000-7000-8000-0000000000f2';

/**
 * A user id used by exactly one test.
 *
 * The counter tests below share a Redis database, and `auth:fail:{user}` persists for fifteen
 * minutes. Reusing one id made a later assertion read a count three earlier tests had left
 * behind — which failed here, but would just as easily have PASSED for the wrong reason if the
 * numbers had happened to line up. A distinct subject per test removes the question.
 */
let subjectCounter = 0;
const freshUser = (): string =>
  `01912f00-0000-7000-8000-${String((subjectCounter += 1)).padStart(12, '0')}`;

before(async () => {
  ({ available } = await requireRole('redis', async () => {
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
    await redis.connect();
    await redis.ping();
    store = new RedisCredentialTokenStore(redis, config, new FixedClock('2026-08-07T12:00:00Z'));
    counter = new RedisLockoutCounter(redis, config);
  }));
  // Database 2 is the test database (`infra:verify` asserts three exist). Cleared rather than
  // trusted: a leftover counter from an earlier run would make a lockout assertion pass for
  // entirely the wrong reason.
  if (available) await redis.flushdb();
});

after(async () => {
  if (available) {
    await redis.flushdb();
    redis.disconnect();
  }
});

const it = (name: string, fn: () => Promise<void>) =>
  test(name, async (t) => {
    if (!available) return t.skip('no redis');
    await fn();
  });

// ═══════════════════════════════════════════════════════════════════════════
// NFR-SEC-07 — the token is never stored.
// ═══════════════════════════════════════════════════════════════════════════

it('NFR-SEC-07 · Redis holds the SHA-256, never the token', async () => {
  const issued = await store.issue('PASSWORD_RESET', USER);

  // The token's own value must not be a key, and must not be a value.
  assert.equal(await redis.get(`iam:reset:${issued.token}`), null, 'the raw token is a key');

  const digestKey = `iam:reset:${digestOf(issued.token)}`;
  assert.equal(await redis.get(digestKey), USER, 'the digest key does not resolve to the user');

  // And a full sweep of the keyspace must not contain the token anywhere.
  const keys = await redis.keys('*');
  for (const key of keys) {
    assert.doesNotMatch(key, new RegExp(issued.token), `the token appears in key ${key}`);
    const value = await redis.get(key).catch(() => null);
    if (value !== null) assert.notEqual(value, issued.token, `the token is the value of ${key}`);
  }
});

it('the token is 256 bits of hex, and two issues never collide', async () => {
  const a = await store.issue('PASSWORD_RESET', USER);
  const b = await store.issue('PASSWORD_RESET', USER);

  assert.match(a.token, /^[0-9a-f]{64}$/, '32 bytes as hex is 64 characters');
  assert.notEqual(a.token, b.token);
});

it('the TTL is set from configuration and the key really expires', async () => {
  const issued = await store.issue('PASSWORD_RESET', USER);
  const ttl = await redis.ttl(`iam:reset:${digestOf(issued.token)}`);

  // Within a second of the configured window — the round trip costs a little.
  assert.ok(ttl > 1_795 && ttl <= 1_800, `ttl is ${String(ttl)}, expected ~1800`);

  // The verification token uses the other, longer window.
  const verify = await store.issue('EMAIL_VERIFICATION', USER);
  const verifyTtl = await redis.ttl(`iam:verify:${digestOf(verify.token)}`);
  assert.ok(verifyTtl > 86_395 && verifyTtl <= 86_400, `ttl is ${String(verifyTtl)}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// Single use — the concurrency claim, fired concurrently.
// ═══════════════════════════════════════════════════════════════════════════

it('a token consumes exactly ONCE, and the second attempt gets null', async () => {
  const issued = await store.issue('PASSWORD_RESET', USER);

  assert.equal(await store.consume('PASSWORD_RESET', issued.token), USER);
  assert.equal(await store.consume('PASSWORD_RESET', issued.token), null);
});

it('TWENTY SIMULTANEOUS consumptions of one token — exactly ONE wins', async () => {
  // The assertion that cannot be made sequentially. A `GET` then `DEL` implementation passes
  // the test above and fails this one, and the second winner is whoever intercepted the email.
  const issued = await store.issue('PASSWORD_RESET', USER);

  const results = await Promise.all(
    Array.from({ length: 20 }, () => store.consume('PASSWORD_RESET', issued.token)),
  );

  const winners = results.filter((r) => r !== null);
  assert.equal(
    winners.length,
    1,
    `${String(winners.length)} of 20 concurrent consumptions succeeded. A reset token that can ` +
      'be redeemed twice means an intercepted link still works after the member used it.',
  );
  assert.equal(winners[0], USER);
});

it('purpose is bound — a verification token cannot be spent as a reset', async () => {
  // Security.md §2.3.5's purpose binding, applied to links. Both are 64 hex characters, so
  // without the namespace one endpoint would happily accept the other's credential.
  const verification = await store.issue('EMAIL_VERIFICATION', USER);

  assert.equal(await store.consume('PASSWORD_RESET', verification.token), null);
  // And it is still usable for what it was minted for — the wrong-purpose attempt must not
  // consume it.
  assert.equal(await store.consume('EMAIL_VERIFICATION', verification.token), USER);
});

it('an unknown token returns null rather than throwing', async () => {
  assert.equal(await store.consume('PASSWORD_RESET', 'f'.repeat(64)), null);
  assert.equal(await store.consume('PASSWORD_RESET', 'not-even-hex'), null);
});

// ═══════════════════════════════════════════════════════════════════════════
// revokeAll — the hole that a one-key design would have left open.
// ═══════════════════════════════════════════════════════════════════════════

it('revokeAll kills every outstanding token for that user and purpose', async () => {
  // A member who clicked "forgot password" three times has three live links. When one is used
  // the other two must stop working — otherwise the window stays open for the full thirty
  // minutes AFTER the password changed, and a second intercepted link changes it straight back.
  const first = await store.issue('PASSWORD_RESET', USER);
  const second = await store.issue('PASSWORD_RESET', USER);
  const third = await store.issue('PASSWORD_RESET', USER);

  await store.revokeAll('PASSWORD_RESET', USER);

  for (const [n, issued] of [first, second, third].entries()) {
    assert.equal(
      await store.consume('PASSWORD_RESET', issued.token),
      null,
      `token ${String(n + 1)} of 3 survived revokeAll`,
    );
  }
});

it('revokeAll touches only that user, and only that purpose', async () => {
  const mine = await store.issue('PASSWORD_RESET', USER);
  const theirs = await store.issue('PASSWORD_RESET', OTHER);
  const myVerification = await store.issue('EMAIL_VERIFICATION', USER);

  await store.revokeAll('PASSWORD_RESET', USER);

  assert.equal(await store.consume('PASSWORD_RESET', mine.token), null);
  assert.equal(await store.consume('PASSWORD_RESET', theirs.token), OTHER, "another user's token");
  assert.equal(await store.consume('EMAIL_VERIFICATION', myVerification.token), USER);
});

it('revokeAll on a user with no tokens is a no-op, not an error', async () => {
  await assert.doesNotReject(() => store.revokeAll('PASSWORD_RESET', 'no-such-user'));
});

it('the index TTL is refreshed, so a later token stays revokable', async () => {
  // Without the refresh, a second token issued near the end of the window loses its index entry
  // first and becomes unrevokable — live, and invisible to revokeAll.
  await store.issue('PASSWORD_RESET', USER);
  const indexTtlAfterFirst = await redis.ttl(`iam:reset:user:${USER}`);

  await store.issue('PASSWORD_RESET', USER);
  const indexTtlAfterSecond = await redis.ttl(`iam:reset:user:${USER}`);

  assert.ok(indexTtlAfterSecond >= indexTtlAfterFirst, 'the index TTL was not refreshed');
  assert.ok(indexTtlAfterSecond > 1_795);
});

// ═══════════════════════════════════════════════════════════════════════════
// FR-AUTH-08 — the counter, and the window that must not reset.
// ═══════════════════════════════════════════════════════════════════════════

it('recordFailure returns the running count', async () => {
  const USER = freshUser();
  assert.equal(await counter.recordFailure(USER), 1);
  assert.equal(await counter.recordFailure(USER), 2);
  assert.equal(await counter.recordFailure(USER), 3);
  assert.deepEqual(await counter.read(USER), { failures: 3, locksInEscalationWindow: 0 });
});

it('THE WINDOW DOES NOT RESET on each failure', async () => {
  const USER = freshUser();
  // The defect this pins. An unconditional EXPIRE after every INCR restarts the fifteen minutes
  // on every wrong guess — so an attacker pacing one guess every fourteen minutes accumulates a
  // count that never expires and a window that never closes, and the lockout never fires
  // because the count also never reaches ten within any real fifteen-minute period.
  //
  // Conversely the count must SURVIVE across failures inside the window, which is what makes
  // ten-in-fifteen meaningful at all.
  await counter.recordFailure(USER);
  const ttlAfterFirst = await redis.ttl(`auth:fail:${USER}`);

  await new Promise((resolve) => setTimeout(resolve, 1_100));

  await counter.recordFailure(USER);
  const ttlAfterSecond = await redis.ttl(`auth:fail:${USER}`);

  assert.ok(
    ttlAfterSecond < ttlAfterFirst,
    `the TTL went from ${String(ttlAfterFirst)} to ${String(ttlAfterSecond)} — the window was ` +
      'restarted by the second failure, so a slow attacker is never locked out.',
  );
  assert.equal((await counter.read(USER)).failures, 2, 'the count did not survive the window');
});

it('TEN SIMULTANEOUS failures count as ten, not as one', async () => {
  const USER = freshUser();
  // A read-then-write counter loses increments under concurrency, and the account an attacker
  // is hitting hardest is the one least likely to lock.
  await Promise.all(Array.from({ length: 10 }, () => counter.recordFailure(USER)));
  assert.equal((await counter.read(USER)).failures, 10);
});

it('clearFailures resets the failure count and LEAVES the escalation count', async () => {
  const USER = freshUser();
  // Three locks in a day is a fact about the day. Clearing it on the first successful login
  // after each lock makes the 24-hour escalation unreachable: guess right once and the
  // evidence resets.
  await counter.recordFailure(USER);
  await counter.recordFailure(USER);
  await counter.recordLock(USER);

  await counter.clearFailures(USER);

  assert.deepEqual(await counter.read(USER), { failures: 0, locksInEscalationWindow: 1 });
});

it('the escalation counter has its own, much longer window', async () => {
  const USER = freshUser();
  await counter.recordLock(USER);
  const ttl = await redis.ttl(`auth:locks:${USER}`);
  assert.ok(ttl > 86_000, `the escalation window is ${String(ttl)}s, expected ~24h`);
});

it('a corrupt counter value reads as zero, not as NaN', async () => {
  const USER = freshUser();
  // `NaN >= 10` is false, so a corrupt value would silently mean "never lock this account".
  await redis.set(`auth:fail:${USER}`, 'not-a-number');
  assert.equal((await counter.read(USER)).failures, 0);
});

it('counters are per user', async () => {
  const USER = freshUser();
  const OTHER = freshUser();
  await counter.recordFailure(USER);
  await counter.recordFailure(USER);
  assert.equal((await counter.read(OTHER)).failures, 0);
});
