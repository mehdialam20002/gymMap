/**
 * M-022 · `refresh-rotation.policy.spec.ts` — the rotation decision, in isolation.
 *
 * The milestone's testing table asks this layer for three things: that rotation increments the
 * generation, that the chain stays intact, and that a replayed generation is detected. All three
 * are decided by `decideRotation`, which is pure — so every branch is reachable here without a
 * database, a clock or a Redis, and the ORDER of its branches can be asserted directly.
 *
 * That branch order is the part worth protecting. Three of the four outcomes are reachable from a
 * spent token, and the difference between them is whether a member gets logged out of every device
 * they own. A test per branch is not thoroughness here; it is the only thing standing between a
 * refactor and a false security incident.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decideRotation,
  nextGeneration,
  REUSE_REVOCATION_REASON,
  ROTATION_GRACE_SECONDS,
  type StoredGeneration,
} from '../dist/iam/domain/refresh-rotation.policy.js';

const NOW = new Date('2026-08-08T12:00:00.000Z');
const secondsAgo = (n: number): Date => new Date(NOW.getTime() - n * 1000);
const secondsAhead = (n: number): Date => new Date(NOW.getTime() + n * 1000);

const generation = (over: Partial<StoredGeneration> = {}): StoredGeneration => ({
  id: 'gen-2',
  sessionId: 'session-1',
  generation: 2,
  usedAt: null,
  supersededById: null,
  expiresAt: secondsAhead(30 * 24 * 3600),
  ...over,
});

const decide = (over: Partial<StoredGeneration> = {}, sessionActive = true) =>
  decideRotation({ generation: generation(over), sessionActive, now: NOW });

// ---------------------------------------------------------------------------
// The ordinary path.
// ---------------------------------------------------------------------------

test('an unused, unexpired generation on a live session rotates', () => {
  assert.deepEqual(decide(), { kind: 'ROTATE' });
});

test('the generation number is monotonic — the chain is ordered, not a set', () => {
  // `uq_refresh_tokens__session_generation` makes a repeat a constraint violation rather than a
  // silent overwrite, which is what keeps "generation N was spent" a fact rather than a guess.
  assert.equal(nextGeneration(1), 2);
  assert.equal(nextGeneration(41), 42);
});

// ---------------------------------------------------------------------------
// E1.2 — the replay.
// ---------------------------------------------------------------------------

test('E1.2 · a generation spent LONG ago is reuse, not a tab restore', () => {
  const decision = decide({
    usedAt: secondsAgo(ROTATION_GRACE_SECONDS + 5),
    supersededById: 'gen-3',
  });
  assert.deepEqual(decision, { kind: 'REUSE_DETECTED' });
});

test('E1.2 · spent with NO successor is reuse even inside the grace window', () => {
  // The more suspicious of the two spent cases. `used_at` set with nothing superseding it means
  // the rotation did not complete — there is no successor token to hand back, so treating this as
  // a parallel tab would mean inventing one. It is also the shape a partially-replayed steal has.
  const decision = decide({ usedAt: secondsAgo(1), supersededById: null });
  assert.deepEqual(decision, { kind: 'REUSE_DETECTED' });
});

test('the reuse reason is distinct from an ordinary sign-out', () => {
  // ALRT-32 counts this string. Folding it into USER_SIGNED_OUT would bury the one alert that
  // matters under every routine logout in the platform.
  assert.equal(REUSE_REVOCATION_REASON, 'TOKEN_REUSE_DETECTED');
  assert.notEqual(REUSE_REVOCATION_REASON, 'USER_SIGNED_OUT');
});

// ---------------------------------------------------------------------------
// TR-28 — the parallel tab.
// ---------------------------------------------------------------------------

test('TR-28 · a replay moments after the rotation returns the successor, not an alarm', () => {
  const decision = decide({ usedAt: secondsAgo(1), supersededById: 'gen-3' });
  assert.deepEqual(decision, { kind: 'REPLAY_WITHIN_GRACE', supersededById: 'gen-3' });
});

test('TR-28 · the grace boundary is inclusive, and one second past it is reuse', () => {
  // Asserted on both sides deliberately. An off-by-one here is invisible in every manual test and
  // shows up in production as a rare, unreproducible mass logout on slow devices.
  const atBoundary = decide({
    usedAt: secondsAgo(ROTATION_GRACE_SECONDS),
    supersededById: 'gen-3',
  });
  assert.equal(atBoundary.kind, 'REPLAY_WITHIN_GRACE');

  const pastBoundary = decide({
    usedAt: secondsAgo(ROTATION_GRACE_SECONDS + 1),
    supersededById: 'gen-3',
  });
  assert.equal(pastBoundary.kind, 'REUSE_DETECTED');
});

test('a `used_at` in the FUTURE does not open the grace', () => {
  // Clock skew between application instances, or a bad write. A negative age must not be read as
  // "zero seconds ago" — that would make a future timestamp a permanent replay licence.
  const decision = decide({ usedAt: secondsAhead(5), supersededById: 'gen-3' });
  assert.deepEqual(decision, { kind: 'REUSE_DETECTED' });
});

// ---------------------------------------------------------------------------
// Expiry, and the branch order that keeps it quiet.
// ---------------------------------------------------------------------------

test('an expired generation is EXPIRED, and raises no alarm', () => {
  assert.deepEqual(decide({ expiresAt: secondsAgo(1) }), { kind: 'EXPIRED' });
});

test('expiry is checked at `<=`, so a token is dead exactly at its expiry', () => {
  assert.deepEqual(decide({ expiresAt: NOW }), { kind: 'EXPIRED' });
});

test('a DEAD SESSION is EXPIRED even when the generation looks like reuse', () => {
  // The branch order that prevents a self-inflicted alert storm.
  //
  // Revoking a family spends every token in it. A member who refreshes after a password reset is
  // therefore presenting a spent generation — indistinguishable, by the token alone, from a
  // thief. If `sessionActive` were checked after the reuse branch, every password reset in the
  // platform would report a token theft, and the real ones would be lost in the noise.
  const decision = decide(
    { usedAt: secondsAgo(ROTATION_GRACE_SECONDS + 60), supersededById: 'gen-3' },
    false,
  );
  assert.deepEqual(decision, { kind: 'EXPIRED' });
});

test('a dead session outranks an unused, perfectly valid generation', () => {
  assert.deepEqual(decide({}, false), { kind: 'EXPIRED' });
});
