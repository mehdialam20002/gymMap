/**
 * `M-030` · The remaining four checks and the orchestration — `AC-1`, `AC-6`, `AC-7`, `AC-9`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE ASSERTION THIS FILE EXISTS FOR: ONE CHECK FAILING MUST NOT EMPTY THE PANEL
 *
 * Six independent checks, and the geocoder is the one most likely to be down. A runner using
 * `Promise.all` abandons the rest on the first rejection, so a single vendor outage leaves the
 * application with NO results — and a reviewer reading an empty pre-check panel reads it as
 * "nothing to worry about" rather than "nothing ran".
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PRECHECK_NAMES, precheck } from '../dist/onboarding/domain/precheck-result.vo.js';
import { runDuplicateAddressCheck } from '../dist/onboarding/application/prechecks/duplicate-address.check.js';
import { runDuplicateRegistrationIdCheck } from '../dist/onboarding/application/prechecks/duplicate-registration-id.check.js';
import {
  DEFAULT_IMAGE_LIMITS,
  readDimensions,
  runImageQualityCheck,
} from '../dist/onboarding/application/prechecks/image-quality.check.js';
import { runDuplicateBankAccountCheck } from '../dist/onboarding/application/prechecks/duplicate-bank-account.check.js';
import { RunPrechecksProcessor } from '../dist/onboarding/jobs/run-prechecks.processor.js';
import { JobRunner } from '../dist/common/queue/job-runner.js';

const AT = new Date('2026-08-10T09:00:00.000Z');
const PIN = { latitude: 19.076, longitude: 72.8777 };

// ═══════════════════════════════════════════════════════════════════════════
// Duplicate address — BR-GYM-09, and it FLAGS rather than refusing
// ═══════════════════════════════════════════════════════════════════════════

const probeReturning = (outcome: unknown) => ({ findApprovedNear: () => Promise.resolve(outcome) });

test('BR-GYM-09 — a collision FLAGS; nothing here can refuse', () => {
  // ┌─ THE ROADMAP SAYS "REFUSED BY THE PARTIAL UNIQUE INDEX". THREE HIGHER DOCUMENTS DISAGREE ──┐
  // │ MASTER_PRD BR-GYM-09 (rank 2): "Collisions are surfaced to the reviewer as a possible      │
  // │ duplicate." Constraints.md §19 (rank 3): "Deliberately not a constraint: shared premises   │
  // │ are legitimate." Schema.md §5.2 (rank 3): "This is not a unique index."                     │
  // │ docs/roadmap/ is rank 4 — a plan of work, never a source of requirements. See KL-108.       │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  return runDuplicateAddressCheck(
    probeReturning({
      ok: true,
      matches: [{ gymId: 'g-1', normalisedAddress: '4 darshan sai unit', distanceMetres: 5 }],
    }) as never,
    { address: 'Shop 4, Sai Darshan', pin: PIN, radiusMetres: 150 },
    AT,
  ).then((r) => {
    assert.equal(r.outcome, 'FLAG');
    assert.notEqual(r.outcome, 'ERROR');
  });
});

test('an exact match and a proximate one are reported separately', async () => {
  // Collapsing them makes the common benign case (a mall) look like the rare serious one, and a
  // reviewer who dismisses ten proximate flags dismisses the eleventh without reading it.
  const r = await runDuplicateAddressCheck(
    probeReturning({
      ok: true,
      matches: [
        { gymId: 'exact', normalisedAddress: '4 darshan sai unit', distanceMetres: 2 },
        { gymId: 'nearby', normalisedAddress: '9 meera unit', distanceMetres: 80 },
      ],
    }) as never,
    { address: 'Shop 4, Sai Darshan', pin: PIN, radiusMetres: 150 },
    AT,
  );

  assert.equal(r.outcome, 'FLAG');
  assert.deepEqual(
    (r.evidence['exactMatches'] as { gymId: string }[]).map((m) => m.gymId),
    ['exact'],
  );
  assert.deepEqual(
    (r.evidence['proximateMatches'] as { gymId: string }[]).map((m) => m.gymId),
    ['nearby'],
  );
});

test('no match PASSES', async () => {
  const r = await runDuplicateAddressCheck(
    probeReturning({ ok: true, matches: [] }) as never,
    { address: 'Shop 4, Sai Darshan', pin: PIN, radiusMetres: 150 },
    AT,
  );
  assert.equal(r.outcome, 'PASS');
});

test('an unavailable probe is ERROR, not "no duplicates found"', async () => {
  // The tables this queries arrive with M-031, so the bound adapter answers UNAVAILABLE today.
  // Reporting PASS would tell a reviewer the address is clear when nothing looked — KL-109.
  const r = await runDuplicateAddressCheck(
    probeReturning({
      ok: false,
      failure: 'UNAVAILABLE',
      detail: 'gyms does not exist yet',
    }) as never,
    { address: 'Shop 4, Sai Darshan', pin: PIN, radiusMetres: 150 },
    AT,
  );
  assert.equal(r.outcome, 'ERROR');
});

test('an address that normalises to nothing is ERROR, not PASS', async () => {
  const r = await runDuplicateAddressCheck(
    probeReturning({ ok: true, matches: [] }) as never,
    { address: ',,, ...', pin: PIN, radiusMetres: 150 },
    AT,
  );
  assert.equal(r.outcome, 'ERROR');
  assert.match(String(r.evidence['reason']), /normalised to nothing/);
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-6 — the cross-tenant registration lookup
// ═══════════════════════════════════════════════════════════════════════════

const regProbe = (outcome: unknown) => ({
  findOtherTenantsClaiming: () => Promise.resolve(outcome),
});

test('AC-6 — another tenant claiming the number FLAGS, and names them', async () => {
  const r = await runDuplicateRegistrationIdCheck(
    regProbe({ ok: true, matches: [{ tenantId: 't-2', status: 'ACTIVE' }] }) as never,
    'U74999MH2019PTC123456',
    AT,
  );
  assert.equal(r.outcome, 'FLAG');
  assert.deepEqual(r.evidence['otherTenants'], [{ tenantId: 't-2', status: 'ACTIVE' }]);
});

test('the evidence never carries the registration number itself', () => {
  // BR-DAT-06. The reviewer has it on the application in front of them; the flag only has to say
  // who else claims it — and this object is persisted and rendered.
  return runDuplicateRegistrationIdCheck(
    regProbe({ ok: true, matches: [{ tenantId: 't-2', status: 'ACTIVE' }] }) as never,
    'U74999MH2019PTC123456',
    AT,
  ).then((r) => {
    assert.equal(JSON.stringify(r.evidence).includes('U74999MH2019PTC123456'), false);
  });
});

test('an absent registration number PASSES — the one place "nothing to check" is fine', async () => {
  // A sole proprietor may genuinely have none. Reporting ERROR would flood every such application
  // with an outstanding item nobody can resolve.
  for (const value of [null, '', '   ']) {
    const r = await runDuplicateRegistrationIdCheck(
      regProbe({ ok: true, matches: [] }) as never,
      value as never,
      AT,
    );
    assert.equal(r.outcome, 'PASS', String(value));
    assert.equal(r.evidence['supplied'], false);
  }
});

test('a failed elevated lookup is ERROR', async () => {
  const r = await runDuplicateRegistrationIdCheck(
    { findOtherTenantsClaiming: () => Promise.reject(new Error('elevation refused')) } as never,
    'U74999MH2019PTC123456',
    AT,
  );
  assert.equal(r.outcome, 'ERROR');
  assert.match(String(r.evidence['reason']), /elevation refused/);
});

// ═══════════════════════════════════════════════════════════════════════════
// Duplicate bank account — the check whose table does not exist (AC-6, AC-8)
// ═══════════════════════════════════════════════════════════════════════════

test('no payout account supplied PASSES — nothing was claimed, so nothing is claimed twice', async () => {
  const r = await runDuplicateBankAccountCheck({ fingerprint: null }, AT);
  assert.equal(r.outcome, 'PASS');
  assert.equal(r.evidence['supplied'], false);
});

test('AC-8 — an account WITH no store behind it is ERROR, never PASS', async () => {
  /*
   * ┌─ THIS IS THE ASSERTION THAT MATTERS, AND IT COVERS A BRANCH NOTHING REACHES TODAY ─────────┐
   * │ `payout_accounts` is EP-05 and no wizard step collects an account, so at M-030 the          │
   * │ fingerprint is always null and the check always takes the PASS above.                        │
   * │                                                                                              │
   * │ The day step 5 ships, the input starts arriving and the probe still will not be bound. Every │
   * │ application would then be told its payout account is unique by a check that never looked —   │
   * │ the exact AC-8 coercion, arriving without a single line of this file being edited. This test │
   * │ is what turns that into a visible ERROR instead.                                              │
   * └──────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const r = await runDuplicateBankAccountCheck({ fingerprint: 'sha256:abc123' }, AT);
  assert.equal(r.outcome, 'ERROR');
  assert.match(String(r.evidence['reason']), /payout_accounts does not exist yet/);
  assert.match(String(r.evidence['reason']), /KL-109/);
});

test('another tenant using the same account FLAGS, and names them', async () => {
  const r = await runDuplicateBankAccountCheck(
    {
      fingerprint: 'sha256:abc123',
      probe: {
        findOtherTenantsUsing: () =>
          Promise.resolve({ ok: true, matches: [{ tenantId: 't-9', status: 'SUSPENDED' }] }),
      } as never,
    },
    AT,
  );
  assert.equal(r.outcome, 'FLAG');
  assert.deepEqual(r.evidence['otherTenants'], [{ tenantId: 't-9', status: 'SUSPENDED' }]);
});

test('BR-PAY-08 — the fingerprint never reaches the persisted evidence', async () => {
  // The evidence is written to `precheck_results` and rendered in the review console. A stable
  // per-account identifier sitting there correlates accounts across tenants for anyone with read
  // access — rebuilding, out of the control's own audit trail, the linkage BR-PAY-08 forbids.
  const r = await runDuplicateBankAccountCheck(
    {
      fingerprint: 'sha256:abc123',
      probe: {
        findOtherTenantsUsing: () =>
          Promise.resolve({ ok: true, matches: [{ tenantId: 't-9', status: 'APPROVED' }] }),
      } as never,
    },
    AT,
  );
  assert.doesNotMatch(JSON.stringify(r.evidence), /abc123/);
});

test('a probe that reports UNAVAILABLE is ERROR', async () => {
  const r = await runDuplicateBankAccountCheck(
    {
      fingerprint: 'sha256:abc123',
      probe: {
        findOtherTenantsUsing: () =>
          Promise.resolve({ ok: false, failure: 'UNAVAILABLE', detail: 'replica lagging' }),
      } as never,
    },
    AT,
  );
  assert.equal(r.outcome, 'ERROR');
  assert.match(String(r.evidence['reason']), /replica lagging/);
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-7 — the decompression bomb, refused without decoding
// ═══════════════════════════════════════════════════════════════════════════

/** A PNG header declaring `width × height`, in 64 bytes. No pixel data at all. */
function pngHeader(width: number, height: number): Buffer {
  const b = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

test('AC-7 — a 55,000 × 55,000 PNG in 64 bytes is refused', () => {
  // ┌─ WHY THE GUARD CANNOT LIVE AFTER THE DECODER ──────────────────────────────────────────────┐
  // │ 3.02 billion pixels is about 12 GB decoded, from a file of 64 bytes. Any limit that runs    │
  // │ after decoding runs after the worker is already dead. Dimensions are in the header, at a    │
  // │ fixed offset, in plain integers — so this costs two dozen bytes and no decoder.              │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const bomb = pngHeader(55_000, 55_000);
  assert.deepEqual(readDimensions(bomb), { width: 55_000, height: 55_000 });

  const r = runImageQualityCheck({ images: [{ label: 'front', bytes: bomb }] }, AT);
  assert.equal(r.outcome, 'FLAG');
  const refused = r.evidence['refused'] as { reason: string }[];
  assert.equal(refused.length, 1);
  assert.ok(['EDGE_TOO_LONG', 'PIXEL_BOMB'].includes(refused[0]?.reason ?? ''));
});

test('AC-7 — a wide-but-short bomb inside the edge limit is caught on AREA', () => {
  // The case an edge-only limit misses: 19,000 × 19,000 keeps both sides under 20,000 and is still
  // 361 megapixels. Area grows as the square, which is why both limits exist.
  const r = runImageQualityCheck(
    { images: [{ label: 'front', bytes: pngHeader(19_000, 19_000) }] },
    AT,
  );
  const refused = r.evidence['refused'] as { reason: string }[];
  assert.equal(refused[0]?.reason, 'PIXEL_BOMB');
});

test('a normal phone photograph passes', () => {
  // The control. A guard that refused everything would satisfy both tests above.
  const r = runImageQualityCheck(
    { images: [{ label: 'front', bytes: pngHeader(4032, 3024) }] },
    AT,
  );
  assert.equal(r.outcome, 'PASS');
  assert.ok(4032 * 3024 < DEFAULT_IMAGE_LIMITS.maxTotalPixels);
});

test('a JPEG SOF0 header is read without decoding', () => {
  const jpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0xff,
    0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x03, 0x01, 0x22, 0, 0x02, 0x11, 0x01, 0x03,
    0x11, 0x01,
  ]);
  assert.deepEqual(readDimensions(jpeg), { width: 640, height: 480 });
});

test('an unreadable header is FLAGGED, never passed', () => {
  const r = runImageQualityCheck({ images: [{ label: 'front', bytes: Buffer.alloc(40) }] }, AT);
  assert.equal(r.outcome, 'FLAG');
  assert.deepEqual(r.evidence['unreadable'], ['front']);
});

test('what was NOT checked is named in the evidence', () => {
  // KL-110: blur and perceptual-hash duplicate detection need a decoder, and A-17 (Sharp) is not
  // installed while no perceptual-hash library has an A-NN row at all. Naming them keeps the row
  // from reading as a complete image review.
  const r = runImageQualityCheck(
    { images: [{ label: 'front', bytes: pngHeader(1600, 1200) }] },
    AT,
  );
  assert.deepEqual(r.evidence['notChecked'], ['BLUR_THRESHOLD', 'PERCEPTUAL_HASH_DUPLICATE']);
});

test('a malformed JPEG segment chain terminates rather than looping', () => {
  // A zero-length segment would not advance the walk. Worth pinning: an infinite loop here is a
  // worker hang, which is the same outcome the bomb guard exists to prevent.
  const evil = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(200, 0xff)]);
  assert.equal(readDimensions(evil), null);
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-9 / AC-10 — the orchestration
// ═══════════════════════════════════════════════════════════════════════════

/** An advisory-lock gateway that always grants. */
const grantingGateway = {
  tryAcquire: () => Promise.resolve(true),
  release: () => Promise.resolve(),
};

function processor() {
  const clock = { now: () => AT };
  const runs: { name: string; outcome: string; overran: boolean }[] = [];
  const sink = {
    record: (run: { jobName: string; outcome: string; overran: boolean }) => {
      runs.push({ name: run.jobName, outcome: run.outcome, overran: run.overran });
      return Promise.resolve();
    },
  };
  const written: { applicationId: string; results: unknown[] }[] = [];
  const store = {
    replaceFor: (applicationId: string, results: unknown[]) => {
      written.push({ applicationId, results });
      return Promise.resolve();
    },
  };

  const runner = new JobRunner(clock as never, sink as never);
  return { p: new RunPrechecksProcessor(runner, clock as never, store as never), runs, written };
}

const suiteWhere = (overrides: Record<string, () => Promise<unknown>> = {}) => ({
  checks: Object.fromEntries(
    PRECHECK_NAMES.map((n) => [
      n,
      overrides[n] ?? (() => Promise.resolve(precheck(n, 'PASS', {}, AT))),
    ]),
  ),
});

test('AC-1 — all six results are produced and persisted as one set', async () => {
  const { p, written } = processor();
  const results = await p.run(grantingGateway as never, 'app-1', suiteWhere() as never);

  assert.equal(results.length, 6);
  assert.deepEqual(
    results.map((r) => r.check),
    [...PRECHECK_NAMES],
  );
  assert.equal(written.length, 1, 'the set was written more than once, or not at all');
  assert.equal(written[0]?.applicationId, 'app-1');
});

test('one check REJECTING does not empty the panel — the whole point', async () => {
  const { p } = processor();
  const results = await p.run(
    grantingGateway as never,
    'app-1',
    suiteWhere({ GEO_DISTANCE: () => Promise.reject(new Error('vendor down')) }) as never,
  );

  assert.equal(results.length, 6, 'a rejected check took the others with it');
  const geo = results.find((r) => r.check === 'GEO_DISTANCE');
  assert.equal(geo?.outcome, 'ERROR');
  assert.match(String(geo?.evidence['reason']), /vendor down/);
  assert.equal(results.filter((r) => r.outcome === 'PASS').length, 5);
});

test('AC-9 — a re-run REPLACES the set rather than appending', async () => {
  const { p, written } = processor();
  await p.run(grantingGateway as never, 'app-1', suiteWhere() as never);
  await p.run(grantingGateway as never, 'app-1', suiteWhere() as never);

  // Two writes, each of a complete six-result set — never one write of twelve.
  assert.equal(written.length, 2);
  for (const w of written) assert.equal(w.results.length, 6);
});

test('AC-10 — the run is recorded, under the job name', async () => {
  const { p, runs } = processor();
  await p.run(grantingGateway as never, 'app-1', suiteWhere() as never);

  assert.equal(runs.length, 1);
  assert.equal(runs[0]?.name, 'onboarding.run-prechecks');
  assert.equal(runs[0]?.outcome, 'SUCCEEDED');
});

test('AC-10 — a held lock SKIPS rather than running twice, and writes nothing', async () => {
  const { p, runs, written } = processor();
  const contended = { tryAcquire: () => Promise.resolve(false), release: () => Promise.resolve() };

  await p.run(contended as never, 'app-1', suiteWhere() as never);

  assert.equal(runs[0]?.outcome, 'SKIPPED_LOCKED');
  assert.deepEqual(written, [], 'a skipped run still wrote a result set');
});
