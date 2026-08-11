/**
 * `M-030` · The pre-check projection — `BR-TEN-01`, invariant 1, `BLK-22` constraint 1.
 *
 * ┌─ THE LEAK THIS CLOSES WAS LIVE AND SPECIFIED AWAY IN THE SAME DOCUMENT ──────────────────────┐
 * │ Two checks return `otherTenants: [{ tenantId, status }]`. That object is persisted to          │
 * │ `applications.precheck_results` — a column on the SUBMITTING tenant's own RLS row — and        │
 * │ `Gym.md` line 1023 puts `precheck_results` in the tenant-facing `202` body. A gym owner would  │
 * │ have received a list of other gyms' tenant ids.                                                │
 * │                                                                                              │
 * │ And `Gym.md` already gives the leak-free shape: status for those two, a COUNT for the address  │
 * │ check. So this is not a document conflict; the array was invented in code.                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  carriesCrossTenantEvidence,
  forReviewer,
  forTenant,
  suiteForTenant,
} from '../dist/onboarding/domain/precheck-audience.js';
import { PRECHECK_NAMES, precheck } from '../dist/onboarding/domain/precheck-result.vo.js';
import { runDuplicateAddressCheck } from '../dist/onboarding/application/prechecks/duplicate-address.check.js';

const RAN_AT = new Date('2026-08-11T10:00:00.000Z');
const OTHER_TENANT = '01912f00-0000-7000-8000-00000000000b';

const duplicateRegistration = () =>
  precheck(
    'DUPLICATE_REGISTRATION_ID',
    'FLAG',
    { supplied: true, otherTenants: [{ tenantId: OTHER_TENANT, status: 'APPROVED' }] },
    RAN_AT,
  );

const duplicateBank = () =>
  precheck(
    'DUPLICATE_BANK_ACCOUNT',
    'FLAG',
    { otherTenants: [{ tenantId: OTHER_TENANT, status: 'SUSPENDED' }] },
    RAN_AT,
  );

// ═══════════════════════════════════════════════════════════════════════════
// The leak, from both directions
// ═══════════════════════════════════════════════════════════════════════════

test('BR-TEN-01 · another tenant’s id never survives the tenant projection', () => {
  for (const result of [duplicateRegistration(), duplicateBank()]) {
    const projected = forTenant(result);
    const serialised = JSON.stringify(projected);

    assert.ok(
      !serialised.includes(OTHER_TENANT),
      `${result.check} leaked a tenant id to the submitting tenant: ${serialised}`,
    );
    assert.ok(!('otherTenants' in projected.evidence), 'the array itself survived');
  }
});

test('the OUTCOME still travels — withholding evidence is not withholding the verdict', () => {
  /*
   * The owner is entitled to know a check ran and what it concluded about their own application.
   * `Gym.md`'s body carries `{ "status": "PASS" }` for exactly these two, so a projection that
   * dropped the outcome would break the documented contract to fix a leak that is about evidence.
   */
  const projected = forTenant(duplicateRegistration());

  assert.equal(projected.outcome, 'FLAG');
  assert.equal(projected.check, 'DUPLICATE_REGISTRATION_ID');
  assert.equal(projected.ranAt, RAN_AT.toISOString());
  assert.deepEqual(projected.evidence, {}, 'status only, per Gym.md');
});

test('the REVIEWER keeps the whole thing — the flag is worthless without it', () => {
  /*
   * `Gym.md`'s table marks both checks *"reviewer-facing"*, and `AC-ONB-02.4` lets a reviewer
   * override with a reason. A reason cannot be written about a duplicate whose counterpart is
   * unnamed, so stripping the ids everywhere would make the check unactionable rather than safe.
   */
  const result = duplicateRegistration();
  const reviewer = forReviewer(result);

  assert.deepEqual(reviewer, result);
  assert.ok(JSON.stringify(reviewer).includes(OTHER_TENANT));
});

// ═══════════════════════════════════════════════════════════════════════════
// The whitelist, and the direction it fails in
// ═══════════════════════════════════════════════════════════════════════════

test('a NEW evidence field is withheld by default, not revealed by default', () => {
  /*
   * The whole reason the map is a whitelist. As a blacklist — "strip `otherTenants`" — the next
   * check to carry a cross-tenant field would be shown to the tenant and nothing would fail.
   *
   * Simulated with a field nobody has written yet, which is the case a blacklist cannot see.
   */
  const future = precheck(
    'DUPLICATE_REGISTRATION_ID',
    'FLAG',
    { collidingGymSlug: 'iron-temple-andheri', collidingOwnerEmail: 'someone@example.test' },
    RAN_AT,
  );

  assert.deepEqual(forTenant(future).evidence, {}, 'an unlisted field reached the tenant');
});

test('every check name has a rule — a seventh check cannot be unclassified', () => {
  /*
   * `TENANT_VISIBLE_EVIDENCE` is `Record<PrecheckName, …>`, so `tsc` already refuses a missing key.
   * Asserted at runtime as well because the type is only as good as the enum: a name added to
   * `PRECHECK_NAMES` and not to the map is a compile error today, and this is what catches the map
   * being widened to `Partial` or indexed by `string` in some future refactor.
   */
  for (const name of PRECHECK_NAMES) {
    const projected = forTenant(precheck(name, 'PASS', { somethingUnlisted: 1 }, RAN_AT));
    assert.deepEqual(
      projected.evidence,
      {},
      `${name} passed an unlisted field through, so it has no rule`,
    );
  }
});

test('the address check shows a COUNT and not the gyms', () => {
  // `Gym.md`: `{ "status": "WARN", "possible_duplicate_gym_count": 1 }`. A count discloses that
  // somebody is nearby, which the public search page discloses to anybody. An id is the handle that
  // makes every other query possible, and that is the difference.
  const result = precheck(
    'DUPLICATE_ADDRESS',
    'FLAG',
    { possibleDuplicateGymCount: 2, gymIds: ['a', 'b'] },
    RAN_AT,
  );

  const projected = forTenant(result);
  assert.equal(projected.evidence['possibleDuplicateGymCount'], 2);
  assert.ok(!('gymIds' in projected.evidence));
});

test('the owner’s OWN evidence is not withheld — this is not a blanket strip', () => {
  /*
   * `GEO_DISTANCE` is blocking for the owner and `Gym.md` 479 requires the refusal to state the
   * measured distance AND the tolerance. A projection that withheld those would replace a leak with
   * an unactionable error, which is the failure `NFR-USE-05` names.
   */
  const geo = forTenant(
    precheck('GEO_DISTANCE', 'FLAG', { measuredMetres: 3_140, toleranceMetres: 250 }, RAN_AT),
  );

  assert.equal(geo.evidence['measuredMetres'], 3_140);
  assert.equal(geo.evidence['toleranceMetres'], 250);
});

// ═══════════════════════════════════════════════════════════════════════════
// The boundary guard
// ═══════════════════════════════════════════════════════════════════════════

test('carriesCrossTenantEvidence answers before anything is persisted', () => {
  /*
   * `precheck_results` is a column on the tenant's own row, so anything written there is reachable
   * through any FUTURE route that returns the application — and a route added in month twenty will
   * not remember this module exists. This is the assertion a persistence boundary can make.
   */
  assert.equal(carriesCrossTenantEvidence(duplicateRegistration()), true);
  assert.equal(carriesCrossTenantEvidence(forTenant(duplicateRegistration())), false);
  assert.equal(
    carriesCrossTenantEvidence(
      precheck('GEO_DISTANCE', 'PASS', { measuredMetres: 12, toleranceMetres: 250 }, RAN_AT),
    ),
    false,
    'the owner’s own measurements were called cross-tenant',
  );
});

test('an ERROR result carries a reason, and the reason is not evidence about anybody', () => {
  // `errored()` puts a `reason` on the evidence. It describes the CHECKER, not the application, so
  // it is withheld from the tenant by the whitelist — and the outcome still reaches them, which is
  // the part they can act on ("we could not check this yet").
  const projected = forTenant(
    precheck('DUPLICATE_BANK_ACCOUNT', 'ERROR', { reason: 'no adapter is bound' }, RAN_AT),
  );

  assert.equal(projected.outcome, 'ERROR');
  assert.deepEqual(projected.evidence, {});
});

test('suiteForTenant projects every member, not the first', () => {
  const projected = suiteForTenant([duplicateRegistration(), duplicateBank()]);

  assert.equal(projected.length, 2);
  assert.ok(!JSON.stringify(projected).includes(OTHER_TENANT));
});

// ═══════════════════════════════════════════════════════════════════════════
// The producer, not a hand-built result — the gap the tests above cannot see
// ═══════════════════════════════════════════════════════════════════════════

test('the REAL address check, projected, carries the count Gym.md promises', async () => {
  /*
   * ┌─ WHY THIS ONE DRIVES THE CHECK INSTEAD OF CONSTRUCTING A RESULT ──────────────────────────────┐
   * │ Every assertion above builds its own `precheck(...)` and hands it to `forTenant()`, which     │
   * │ tests the MAP and cannot test the PIPELINE. It missed a real defect: the whitelist permitted  │
   * │ `possibleDuplicateGymCount` and `runDuplicateAddressCheck` emitted `exactMatches` and         │
   * │ `proximateMatches` and no count, so a flagged owner received `{}` where `Gym.md` line 1023    │
   * │ promises `{ "status": "WARN", "possible_duplicate_gym_count": 1 }`. Both halves were          │
   * │ internally consistent and the green suite said nothing.                                        │
   * │                                                                                              │
   * │ A whitelist can only pass through what the producer actually emits, so at least one assertion │
   * │ has to start at the producer.                                                                 │
   * └──────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const probe = {
    findApprovedNear: () =>
      Promise.resolve({
        ok: true as const,
        matches: [
          {
            gymId: 'gym-of-another-tenant',
            normalisedAddress: '4 darshan sai unit',
            distanceMetres: 3,
          },
          { gymId: 'gym-nearby', normalisedAddress: '9 meera unit', distanceMetres: 90 },
        ],
      }),
  };

  const result = await runDuplicateAddressCheck(
    probe as never,
    {
      address: 'Shop 4, Sai Darshan',
      pin: { latitude: 19.076, longitude: 72.8777 },
      radiusMetres: 150,
    },
    RAN_AT,
  );

  // The reviewer's copy names the gyms — that is the entire value of the flag.
  assert.equal(result.outcome, 'FLAG');
  assert.ok(JSON.stringify(forReviewer(result)).includes('gym-of-another-tenant'));

  const owner = forTenant(result);
  assert.equal(owner.outcome, 'FLAG');
  assert.deepEqual(
    owner.evidence,
    { possibleDuplicateGymCount: 2 },
    'the owner got something other than exactly the documented count',
  );
  assert.ok(
    !JSON.stringify(owner).includes('gym-'),
    'a gym id belonging to another tenant reached the submitting tenant',
  );
});
