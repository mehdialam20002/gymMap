/**
 * `M-030` · The pre-checks — `FR-ONB-12`, `BR-GYM-08`, `E2.5`, `AC-2`, `AC-3`, `AC-8`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * TWO OF THESE ASSERTIONS ARE ABOUT SOMETHING NOT EXISTING
 *
 * `AC-2` says the prohibition on auto-rejecting is structural — the type has no rejecting member.
 * A test cannot assert the absence of a union member at runtime, so it asserts the two consequences
 * that would break first if one were added: the outcome set is exactly three, and `isClear` is true
 * for exactly one of them.
 *
 * The other is `AC-8`. Every path where a checker fails must produce `ERROR`, never `PASS` — and
 * the failure mode is a `catch` that returns something reassuring, which no happy-path test sees.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PRECHECK_NAMES,
  errored,
  isClear,
  outstanding,
  precheck,
} from '../dist/onboarding/domain/precheck-result.vo.js';
import {
  MINIMUM_REASON_LENGTH,
  mayApprove,
} from '../dist/onboarding/domain/approval-override.policy.js';
import { distanceMetres } from '../dist/onboarding/application/ports/geocoding.port.js';
import { runGeoDistanceCheck } from '../dist/onboarding/application/prechecks/geo-distance.check.js';
import { runProfanityCheck } from '../dist/onboarding/application/prechecks/profanity.check.js';

const AT = new Date('2026-08-10T09:00:00.000Z');

// ═══════════════════════════════════════════════════════════════════════════
// AC-2 — a pre-check cannot reject
// ═══════════════════════════════════════════════════════════════════════════

test('AC-2 — there are exactly three outcomes, and none of them rejects', () => {
  // ┌─ THE ASSERTION STANDING IN FOR A TYPE-LEVEL GUARANTEE ─────────────────────────────────────┐
  // │ A fourth member would arrive as a helpful-looking `REJECT`, and the first thing it would   │
  // │ break is a policy elsewhere branching on three. Pinning the set here means that edit shows │
  // │ up as a failing test in the same commit rather than as behaviour nobody asked for.          │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const outcomes = ['PASS', 'FLAG', 'ERROR'];
  for (const outcome of outcomes) {
    const r = precheck('PROFANITY', outcome as never, {}, AT);
    assert.equal(r.outcome, outcome);
  }
  assert.equal(outcomes.includes('REJECT'), false, 'a rejecting outcome exists');
});

test('AC-2 — isClear is true for PASS alone', () => {
  // The coercion this prevents: `!== 'FLAG'`, which quietly treats every ERROR as clear.
  assert.equal(isClear(precheck('PROFANITY', 'PASS', {}, AT)), true);
  assert.equal(isClear(precheck('PROFANITY', 'FLAG', {}, AT)), false);
  assert.equal(isClear(precheck('PROFANITY', 'ERROR', {}, AT)), false);
});

test('the six checks are named, and a seventh is a deliberate edit', () => {
  assert.deepEqual(
    [...PRECHECK_NAMES],
    [
      'GEO_DISTANCE',
      'DUPLICATE_ADDRESS',
      'DUPLICATE_REGISTRATION_ID',
      'DUPLICATE_BANK_ACCOUNT',
      'IMAGE_QUALITY',
      'PROFANITY',
    ],
  );
});

test('outstanding() returns FLAG and ERROR, because both need a human', () => {
  const results = [
    precheck('PROFANITY', 'PASS', {}, AT),
    precheck('GEO_DISTANCE', 'FLAG', {}, AT),
    precheck('IMAGE_QUALITY', 'ERROR', {}, AT),
  ];
  assert.deepEqual(
    outstanding(results).map((r) => r.check),
    ['GEO_DISTANCE', 'IMAGE_QUALITY'],
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-8 — an ERROR is never a PASS
// ═══════════════════════════════════════════════════════════════════════════

const PIN = { latitude: 19.076, longitude: 72.8777 }; // Mumbai
const TOLERANCE = 300;

const geocoderReturning = (result: unknown) => ({ geocode: () => Promise.resolve(result) });

test('AC-8 — a geocoder that THROWS yields ERROR, and says so', async () => {
  const throwing = {
    geocode: () => Promise.reject(new Error('connect ETIMEDOUT')),
  };

  const r = await runGeoDistanceCheck(
    throwing as never,
    {
      address: 'Iron House, Andheri West',
      pin: PIN,
      toleranceMetres: TOLERANCE,
    },
    AT,
  );

  assert.equal(r.outcome, 'ERROR');
  assert.notEqual(r.outcome, 'PASS', 'an outage was reported as a verified address');
  assert.match(String(r.evidence['reason']), /ETIMEDOUT/);
});

test('AC-8 — UNAVAILABLE and NOT_FOUND both yield ERROR, distinguishably', async () => {
  for (const failure of ['UNAVAILABLE', 'NOT_FOUND']) {
    const r = await runGeoDistanceCheck(
      geocoderReturning({ ok: false, failure, detail: 'x' }) as never,
      { address: 'a', pin: PIN, toleranceMetres: TOLERANCE },
      AT,
    );
    assert.equal(r.outcome, 'ERROR', failure);
    assert.match(String(r.evidence['reason']), new RegExp(failure));
  }
});

test('AC-8 — the unbound adapter IS the specified outage behaviour', async () => {
  // No geocoder is approved in STACK_ADDITIONS.md, so the bound adapter answers UNAVAILABLE
  // permanently. That is not an incomplete check: the specification says an outage must produce
  // ERROR and must NOT block the submission, and that is exactly what happens.
  const r = await runGeoDistanceCheck(
    geocoderReturning({ ok: false, failure: 'UNAVAILABLE', detail: 'no adapter bound' }) as never,
    { address: 'a', pin: PIN, toleranceMetres: TOLERANCE },
    AT,
  );
  assert.equal(r.outcome, 'ERROR');
});

// ═══════════════════════════════════════════════════════════════════════════
// BR-GYM-08 — the distance itself
// ═══════════════════════════════════════════════════════════════════════════

test('distanceMetres agrees with a known separation', () => {
  // Mumbai CST to Bandra station is about 12 km. A wrong earth radius or a degrees/radians slip
  // shows up here as an order of magnitude, which is the mistake worth catching.
  const cst = { latitude: 18.9398, longitude: 72.8355 };
  const bandra = { latitude: 19.0544, longitude: 72.8402 };
  const d = distanceMetres(cst, bandra);

  assert.ok(d > 12_000 && d < 13_500, `expected ~12.8 km, got ${Math.round(d)} m`);
  assert.equal(Math.round(distanceMetres(cst, cst)), 0, 'a point is not zero from itself');
});

test('E2.5 — inside tolerance PASSES, a 4 km mismatch FLAGS', async () => {
  const near = { latitude: 19.0762, longitude: 72.8779 }; // ~25 m from the pin
  const far = { latitude: 19.1119, longitude: 72.8777 }; // ~4 km north

  const pass = await runGeoDistanceCheck(
    geocoderReturning({ ok: true, point: near, confidence: 0.9 }) as never,
    { address: 'a', pin: PIN, toleranceMetres: TOLERANCE },
    AT,
  );
  assert.equal(pass.outcome, 'PASS');

  const flag = await runGeoDistanceCheck(
    geocoderReturning({ ok: true, point: far, confidence: 0.9 }) as never,
    { address: 'a', pin: PIN, toleranceMetres: TOLERANCE },
    AT,
  );
  assert.equal(flag.outcome, 'FLAG');
  assert.ok(Number(flag.evidence['distanceMetres']) > 3_500);
});

test('the evidence carries the distance, never the coordinates', () => {
  // BR-DAT-06 keeps location out of persisted, rendered records — and `redaction.ts` lists lat,
  // lng and coordinates for the same reason. The reviewer needs "1.2 km apart", not two decimals.
  return runGeoDistanceCheck(
    geocoderReturning({ ok: true, point: PIN, confidence: 0.9 }) as never,
    { address: 'a', pin: PIN, toleranceMetres: TOLERANCE },
    AT,
  ).then((r) => {
    const keys = Object.keys(r.evidence);
    assert.deepEqual(keys.sort(), ['confidence', 'distanceMetres', 'toleranceMetres']);
    for (const leak of ['lat', 'lng', 'latitude', 'longitude', 'point']) {
      assert.equal(keys.includes(leak), false, `evidence leaks ${leak}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The off-platform routes — the half of the profanity check that matters
// ═══════════════════════════════════════════════════════════════════════════

test('an embedded phone number flags, in the shapes people actually type', () => {
  // ┌─ WHY THIS IS THE IMPORTANT CASE ───────────────────────────────────────────────────────────┐
  // │ "call 98765 43210 for a better price" moves the transaction off the platform: no order, no │
  // │ invoice, no refund policy, no earned review, and BR-PLN-03 routed around. A profanity list │
  // │ catches none of it.                                                                         │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  for (const text of [
    'call 9876543210 for a better price',
    'ring 98765 43210',
    'phone +91 98765-43210',
    'reach me on 9-8-7-6-5-4-3-2-1-0',
  ]) {
    const r = runProfanityCheck({ description: text }, AT);
    assert.equal(r.outcome, 'FLAG', `missed: ${text}`);
  }
});

test('the finding names the FIELD, never the number', () => {
  // The result is persisted on applications.precheck_results and rendered in the console. A phone
  // number is personal data (BR-DAT-06); the reviewer opens the application and sees the text.
  const r = runProfanityCheck({ description: 'call 9876543210 today' }, AT);
  const dumped = JSON.stringify(r.evidence);

  assert.match(dumped, /description/);
  assert.equal(dumped.includes('9876543210'), false, 'the phone number was persisted');
});

test('emails, links and messaging handles each flag', () => {
  const cases: [string, string][] = [
    ['owner@irongym.in', 'EMAIL'],
    ['visit www.irongym.in', 'URL'],
    ['book at irongym.com', 'URL'],
    ['dm me on whatsapp', 'MESSAGING_HANDLE'],
    ['mail us at owner [at] gym . in', 'EMAIL'],
  ];
  for (const [text, kind] of cases) {
    const r = runProfanityCheck({ description: text }, AT);
    assert.equal(r.outcome, 'FLAG', `missed: ${text}`);
    const kinds = (r.evidence['findings'] as { kind: string }[]).map((f) => f.kind);
    assert.ok(kinds.includes(kind), `${text} → expected ${kind}, got ${kinds.join(',')}`);
  }
});

test('ordinary gym copy does NOT flag', () => {
  // ┌─ THE CONTROL, AND IT IS NOT A FORMALITY ───────────────────────────────────────────────────┐
  // │ A contact-detail matcher that is too eager makes every legitimate description a flag, the  │
  // │ reviewer learns the check is noise, and the one real off-platform attempt is waved through │
  // │ with the rest. "Open 6 to 10" must not read as a phone number.                              │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  for (const text of [
    'Open 6 to 10, seven days a week.',
    'Strength floor with 4 racks, 2 platforms and a 20 m turf.',
    'Trainers certified since 2011. Monthly plans from 1500.',
    'Located 5 minutes from Andheri station.',
  ]) {
    const r = runProfanityCheck({ description: text }, AT);
    assert.equal(r.outcome, 'PASS', `false positive on: ${text}`);
  }
});

test('a prohibited term is named, because a flag nobody can act on is noise', () => {
  const r = runProfanityCheck({ description: 'guaranteed weight loss in 30 days' }, AT);
  assert.equal(r.outcome, 'FLAG');
  assert.match(JSON.stringify(r.evidence), /guaranteed weight loss/);
});

test('empty and absent fields are screened without incident', () => {
  assert.equal(runProfanityCheck({}, AT).outcome, 'PASS');
  assert.equal(runProfanityCheck({ description: '   ' }, AT).outcome, 'PASS');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-3 — approving over a flag costs a reason
// ═══════════════════════════════════════════════════════════════════════════

const clean = [precheck('PROFANITY', 'PASS', {}, AT)];
const flagged = [precheck('GEO_DISTANCE', 'FLAG', { distanceMetres: 4000 }, AT)];

test('AC-3 — a clean application needs no reason', () => {
  // Demanding one every time makes the field furniture — typed past, filled with "ok", worthless
  // on the row where it counts.
  const v = mayApprove(clean, undefined);
  assert.equal(v.permitted, true);
  if (!v.permitted) return;
  assert.deepEqual(v.overrode, []);
});

test('AC-3 — NEGATIVE: approving over a FLAG with no reason is refused', () => {
  const v = mayApprove(flagged, undefined);
  assert.equal(v.permitted, false);
  if (v.permitted) return;
  assert.equal(v.refusal, 'REASON_REQUIRED');
  assert.deepEqual(v.outstanding, ['GEO_DISTANCE']);
});

test('AC-3 — "ok" is refused separately, because it is a different mistake', () => {
  // REASON_REQUIRED sends a reviewer to a field they missed. REASON_TOO_SHORT tells them the field
  // will not accept the thing they just tried — and that is the one they will actually try.
  const v = mayApprove(flagged, 'ok');
  assert.equal(v.permitted, false);
  if (v.permitted) return;
  assert.equal(v.refusal, 'REASON_TOO_SHORT');
  assert.ok(MINIMUM_REASON_LENGTH > 2);
});

test('AC-3 — a real reason permits the approval and records what it overrode', () => {
  const v = mayApprove(flagged, 'Owner sent the municipal survey plan; the pin was misdropped.');
  assert.equal(v.permitted, true);
  if (!v.permitted) return;
  assert.deepEqual(v.overrode, ['GEO_DISTANCE']);
});

test('AC-3 — an ERROR needs a reason too, and this is the case people argue about', () => {
  // An ERROR means the check did not run. Approving over it is approving something nobody
  // verified, which is a decision — and a decision with no record is what this policy prevents.
  const v = mayApprove([errored('GEO_DISTANCE', 'no adapter bound', AT)], undefined);
  assert.equal(v.permitted, false);
  if (v.permitted) return;
  assert.equal(v.refusal, 'REASON_REQUIRED');
});

test('every outstanding check is named, not just the first', () => {
  const many = [
    precheck('GEO_DISTANCE', 'FLAG', {}, AT),
    precheck('PROFANITY', 'FLAG', {}, AT),
    precheck('IMAGE_QUALITY', 'ERROR', {}, AT),
    precheck('DUPLICATE_ADDRESS', 'PASS', {}, AT),
  ];
  const v = mayApprove(many, undefined);
  assert.equal(v.permitted, false);
  if (v.permitted) return;
  assert.deepEqual(v.outstanding, ['GEO_DISTANCE', 'PROFANITY', 'IMAGE_QUALITY']);
});
