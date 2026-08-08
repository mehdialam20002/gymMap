/**
 * `M-023` · `RedisPermissionCache` — `FR-RBAC-04`, `AC-6`, `AC-10`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE ASYMMETRY IS THE SUBJECT OF THIS FILE
 *
 * Three failure paths, and they are deliberately NOT handled the same way. That is the whole
 * design, so it is what gets asserted:
 *
 *   `read` fails      → answer a MISS, and let the caller fall back to the authoritative source
 *   `write` fails     → swallow it; the only cost is a database read on the next request
 *   `invalidate` fails → THROW, because a lost invalidation leaves revoked access live
 *
 * Getting any one of them wrong produces no error and no test failure anywhere else. A swallowed
 * `invalidate` reports a successful role change over access it did not remove — which is precisely
 * and only what `FR-RBAC-04` exists to prevent.
 *
 * The `read` direction is also the OPPOSITE of `AC-10`'s session denylist, which fails OPEN because
 * a Redis outage would otherwise sign every user out. A permission cache answers "what may this
 * person do", and failing open there means serving a stale grant set — stale exactly when somebody's
 * access was just reduced. "Fails closed" here means "falls back to the truth", never "denies".
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Logger } from '@nestjs/common';

import { RedisPermissionCache } from '../dist/iam/infrastructure/permission-cache.redis.js';
import { PERMISSION_CACHE_TTL_SECONDS } from '../dist/iam/application/ports/permission-cache.port.js';

/*
 * The adapter logs a warning on every path it recovers from, which is correct behaviour and would
 * otherwise interleave Nest's formatted output with this file's TAP stream. Silenced once, here,
 * rather than by making the adapter quieter — a cache that recovers silently in production is how
 * a permanently unreachable Redis goes unnoticed for a week.
 */
Logger.overrideLogger(false);

const USER = 'user-ana';
const KEY = `auth:grants:${USER}`;

/** A double that records what it was asked to do and can be told to fail on any one command. */
function redisDouble(options: { get?: unknown; fail?: 'get' | 'set' | 'del' } = {}) {
  const calls: { command: string; args: unknown[] }[] = [];
  const boom = new Error('ECONNREFUSED 127.0.0.1:6379');

  const client = {
    get: async (...args: unknown[]) => {
      calls.push({ command: 'get', args });
      if (options.fail === 'get') throw boom;
      return (options.get ?? null) as string | null;
    },
    set: async (...args: unknown[]) => {
      calls.push({ command: 'set', args });
      if (options.fail === 'set') throw boom;
      return 'OK';
    },
    del: async (...args: unknown[]) => {
      calls.push({ command: 'del', args });
      if (options.fail === 'del') throw boom;
      return 1;
    },
  };

  // `as any` needs no disable comment: the test config turns `no-explicit-any` off, because a spec
  // builds deliberately-partial doubles to exercise paths a real client would not reach on demand.
  return { cache: new RedisPermissionCache(client as any), calls, boom };
}

// ═══════════════════════════════════════════════════════════════════════════
// The key
// ═══════════════════════════════════════════════════════════════════════════

test('every operation uses `auth:grants:{userId}`', async () => {
  // Namespaced under `auth:` beside `auth:revoked-family:` so one SCAN finds everything the identity
  // subsystem holds — which is what an incident needs, and what stops FLUSHDB being reached for.
  const { cache, calls } = redisDouble();

  await cache.read(USER);
  await cache.write(USER, ['iam.user.read']);
  await cache.invalidate(USER);

  assert.deepEqual(
    calls.map((call) => [call.command, call.args[0]]),
    [
      ['get', KEY],
      ['set', KEY],
      ['del', KEY],
    ],
    'read, write and invalidate must address the SAME key, or invalidation clears nothing',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// read
// ═══════════════════════════════════════════════════════════════════════════

test('a hit returns the stored grants', async () => {
  const grants = ['iam.user.read', 'iam.user.write'];
  const { cache } = redisDouble({ get: JSON.stringify(grants) });

  assert.deepEqual(await cache.read(USER), grants);
});

test('a miss returns null', async () => {
  const { cache } = redisDouble({ get: null });

  assert.equal(await cache.read(USER), null);
});

test('AC-10 inverted — a read ERROR is a miss, not a denial and not a throw', async () => {
  // ┌─ THE ONE THAT MUST NOT BECOME A THROW ─────────────────────────────────────────────────────┐
  // │ If this propagated, an unreachable Redis would fail every authorised request on the platform │
  // │ — a cache outage promoted to a total outage. Returning a miss makes the request SLOW: the    │
  // │ caller reads the authoritative source, which is the whole point of calling it a cache.       │
  // └────────────────────────────────────────────────────────────────────────────────────────────┘
  const { cache } = redisDouble({ fail: 'get' });

  assert.equal(await cache.read(USER), null);
});

test('a corrupt value is a miss, not a hit', async () => {
  // Each of these is a shape that `JSON.parse` accepts and the caller must never receive: it would
  // be spread into a grant list and produce permission checks against `undefined` and `[object
  // Object]`, which deny quietly and look like a permissions bug rather than a cache bug.
  for (const stored of [
    'not json at all',
    '{"role":"GYM_OWNER"}', // an object, not an array
    '["iam.user.read", 42]', // an array with a non-string
    '[null]',
    '42',
    'null',
  ]) {
    const { cache } = redisDouble({ get: stored });
    assert.equal(await cache.read(USER), null, `${stored} should have been treated as a miss`);
  }
});

test('an EMPTY array is a hit, and is not confused with a miss', async () => {
  // ┌─ THE DISTINCTION THAT IS EASY TO COLLAPSE AND EXPENSIVE TO COLLAPSE ───────────────────────┐
  // │ "This user holds no permissions" is a real, cacheable answer, and it is not "I do not know". │
  // │ A `!parsed.length` guard folded into the corruption check would turn every such user into a  │
  // │ cache miss on every request — a permanent database read for exactly the accounts a denial-   │
  // │ of-service would target, and nothing would look broken.                                      │
  // └────────────────────────────────────────────────────────────────────────────────────────────┘
  const { cache } = redisDouble({ get: '[]' });

  const result = await cache.read(USER);
  assert.notEqual(result, null, 'an empty grant set was reported as a cache miss');
  assert.deepEqual(result, []);
});

// ═══════════════════════════════════════════════════════════════════════════
// write
// ═══════════════════════════════════════════════════════════════════════════

test('AC-6 — a write carries the 60-second backstop TTL', async () => {
  const { cache, calls } = redisDouble();

  await cache.write(USER, ['iam.user.read']);

  const set = calls.find((call) => call.command === 'set');
  assert.ok(set, 'nothing was written');
  assert.deepEqual(set.args, [KEY, '["iam.user.read"]', 'EX', PERMISSION_CACHE_TTL_SECONDS]);

  // Read from the port rather than hard-coded, so the two cannot drift — but pinned here too,
  // because `AC-6` names the number and a silent change to 3600 would satisfy the line above.
  assert.equal(PERMISSION_CACHE_TTL_SECONDS, 60);
});

test('a write NEVER writes without an expiry', async () => {
  // A `set` with no TTL is the single worst outcome available to this class: the entry outlives
  // every invalidation that gets lost, so a missed `del` becomes permanent rather than 60 seconds.
  const { cache, calls } = redisDouble();

  await cache.write(USER, []);

  const set = calls.find((call) => call.command === 'set');
  assert.ok(set?.args.includes('EX'), `set was called without EX: ${JSON.stringify(set?.args)}`);
});

test('a write FAILURE is swallowed', async () => {
  // Failing to populate costs a database read on the next request and nothing else. Throwing here
  // would fail whatever operation happened to be warming the cache, for no gain.
  //
  // `doesNotReject` rather than a bare `await`: the absence of a throw is the whole assertion, and
  // a bare call states it only to a reader who already knows that. It also reads as an unfinished
  // test to a linter, which is how the assertion gets "helpfully" added later as a rejects().
  const { cache } = redisDouble({ fail: 'set' });

  await assert.doesNotReject(
    () => cache.write(USER, ['iam.user.read']),
    'a failed cache write propagated and would fail the request that was warming it',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// invalidate — the one that must be loud
// ═══════════════════════════════════════════════════════════════════════════

test('FR-RBAC-04 — an invalidate failure PROPAGATES', async () => {
  // ┌─ THE LOAD-BEARING ASSERTION IN THIS FILE ──────────────────────────────────────────────────┐
  // │ Wrapping this in the same try/catch as `write` is a two-line change that looks like          │
  // │ consistency and defeats the requirement: the role change would report success while the      │
  // │ revoked permissions stayed live for up to the TTL. Nothing would log, and nothing else in    │
  // │ the suite would notice.                                                                     │
  // └────────────────────────────────────────────────────────────────────────────────────────────┘
  const { cache, boom } = redisDouble({ fail: 'del' });

  await assert.rejects(
    () => cache.invalidate(USER),
    (error: unknown) => error === boom,
    'invalidate swallowed a Redis failure — a revoked permission would stay live',
  );
});

test('invalidating a user who was never cached is NOT an error', async () => {
  // `del` on a missing key returns 0 and does not throw, so somebody who has never signed in is the
  // normal case. If this were treated as a failure, changing their role would be impossible — and
  // the tempting way to write the test above (reject on ANY non-1 reply) is what would cause it.
  const { cache } = redisDouble();

  await assert.doesNotReject(
    () => cache.invalidate('user-who-never-signed-in'),
    'invalidating an uncached user threw, which would block every role change for a new account',
  );
});
