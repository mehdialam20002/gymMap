/**
 * `M-029` · PAN and GSTIN — `AC-ONB-04.3`, `AC-ONB-04.4`, `LAUNCH_MARKET_INDIA.md` §6.
 *
 * Every value here is SYNTHETIC and structurally valid. None is a real registration: the point of
 * these tests is the cross-checks, and a real PAN in a repository would be a `BR-DAT-06` breach
 * committed for the sake of a fixture.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PAN_ENTITY_CODES,
  isWellFormedPan,
  panEntityCode,
  validatePan,
} from '../dist/onboarding/domain/pan.vo.js';
import {
  embeddedPan,
  gstinStateCode,
  isWellFormedGstin,
  validateGstin,
} from '../dist/onboarding/domain/gstin.vo.js';

const COMPANY_PAN = 'AAACP1234C';
const INDIVIDUAL_PAN = 'AAAPP1234C';
const FIRM_PAN = 'AAAFP1234C';

// ═══════════════════════════════════════════════════════════════════════════
// AC-4 — the fourth character
// ═══════════════════════════════════════════════════════════════════════════

test('the format check alone accepts the document that matters', () => {
  // ┌─ WHY THE CROSS-CHECK EXISTS ───────────────────────────────────────────────────────────────┐
  // │ An individual's PAN is perfectly well formed. A company submitting one is the case that      │
  // │ matters — a valid-looking tax identity belonging to a person rather than the business        │
  // │ claiming it — and no format rule anywhere would object.                                      │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  assert.equal(isWellFormedPan(INDIVIDUAL_PAN), true);
  assert.equal(validatePan(INDIVIDUAL_PAN, 'COMPANY').valid, false);
});

test('AC-4 — the fourth character must agree with entity_type', () => {
  assert.equal(validatePan(COMPANY_PAN, 'COMPANY').valid, true);
  assert.equal(validatePan(FIRM_PAN, 'PARTNERSHIP').valid, true);
  assert.equal(validatePan(INDIVIDUAL_PAN, 'SOLE_PROPRIETOR').valid, true);
});

test('SOLE_PROPRIETOR maps to P, because it trades on a PERSONAL pan', () => {
  // A sole proprietorship has no PAN of its own. Expecting a business code would reject every
  // legitimate sole proprietor in India, which is most small gyms.
  assert.deepEqual(PAN_ENTITY_CODES['SOLE_PROPRIETOR'], ['P']);
  assert.equal(validatePan(INDIVIDUAL_PAN, 'SOLE_PROPRIETOR').valid, true);
  assert.equal(validatePan(COMPANY_PAN, 'SOLE_PROPRIETOR').valid, false);
});

test('OTHER accepts trusts and HUFs, and is NOT a bypass', () => {
  // ┌─ THE VALUE ANYBODY WOULD PICK TO GET A MISMATCHED PAN THROUGH ─────────────────────────────┐
  // │ `entity_type_enum` has four values; the PAN alphabet has more, so trusts, HUFs and          │
  // │ societies all arrive as OTHER. Skipping the check for OTHER would make it the dropdown       │
  // │ option that turns validation off, and every dropdown has an OTHER.                          │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  assert.equal(validatePan('AAATP1234C', 'OTHER').valid, true, 'a trust PAN');
  assert.equal(validatePan('AAAHP1234C', 'OTHER').valid, true, 'a HUF PAN');

  // But not anything: a COMPANY pan under OTHER is still a mismatch.
  const verdict = validatePan(COMPANY_PAN, 'OTHER');
  assert.equal(verdict.valid, false);
  if (verdict.valid) return;
  assert.equal(verdict.reason, 'ENTITY_TYPE_MISMATCH');
});

test('an UNKNOWN entity type is refused rather than waved through', () => {
  // A value added to `entity_type_enum` and forgotten here would otherwise accept ANY fourth
  // character — turning the check off for exactly the tenants nobody has thought about yet.
  const verdict = validatePan(COMPANY_PAN, 'CO_OPERATIVE_SOCIETY');
  assert.equal(verdict.valid, false);
  if (verdict.valid) return;
  assert.equal(verdict.reason, 'UNKNOWN_ENTITY_TYPE');
});

test('MALFORMED and ENTITY_TYPE_MISMATCH are different answers', () => {
  // They mean different things to whoever fixes them: one is a typo, the other means they supplied
  // the wrong DOCUMENT. "Invalid PAN" for both sends somebody to re-read a number that was correct.
  const malformed = validatePan('AAAC1234C', 'COMPANY');
  assert.equal(malformed.valid, false);
  if (malformed.valid) return;
  assert.equal(malformed.reason, 'MALFORMED');
});

test('the format is anchored, so a valid PAN inside a longer string is not one', () => {
  for (const bad of [` ${COMPANY_PAN}`, `${COMPANY_PAN} `, `X${COMPANY_PAN}`, `${COMPANY_PAN}X`]) {
    assert.equal(isWellFormedPan(bad), false, `${JSON.stringify(bad)} was accepted`);
  }
  // Lower case is not silently upcased — normalisation is the caller's decision, and doing it here
  // would mean the stored value and the validated value could differ.
  assert.equal(isWellFormedPan(COMPANY_PAN.toLowerCase()), false);
});

test('panEntityCode answers null for a malformed PAN rather than a stray character', () => {
  assert.equal(panEntityCode(COMPANY_PAN), 'C');
  assert.equal(panEntityCode('nonsense'), null);
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-5 — the PAN inside the GSTIN
// ═══════════════════════════════════════════════════════════════════════════

const GSTIN = `27${COMPANY_PAN}1Z5`;

test('AC-5 — fifteen characters, with the state code and the PAN in the right places', () => {
  assert.equal(GSTIN.length, 15);
  assert.equal(isWellFormedGstin(GSTIN), true);
  assert.equal(gstinStateCode(GSTIN), '27');
  assert.equal(embeddedPan(GSTIN), COMPANY_PAN);
});

test('AC-5 — the embedded PAN must MATCH the supplied one', () => {
  // ┌─ THE CASE THIS CATCHES AND FORMAT VALIDATION CANNOT ───────────────────────────────────────┐
  // │ A PAN belonging to one business and a GSTIN belonging to another. Both individually valid,   │
  // │ neither a typo — exactly what somebody assembling a fraudulent application has to hand.      │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  assert.equal(validateGstin(GSTIN, COMPANY_PAN).valid, true);

  const mismatch = validateGstin(GSTIN, FIRM_PAN);
  assert.equal(mismatch.valid, false);
  if (mismatch.valid) return;
  assert.equal(mismatch.reason, 'PAN_MISMATCH');
});

test('a MALFORMED supplied PAN reports MALFORMED, not PAN_MISMATCH', () => {
  // Reporting a mismatch would tell the tenant their two documents disagree when the truth is that
  // one is mistyped — which sends them to look at the wrong form.
  const verdict = validateGstin(GSTIN, 'nonsense');
  assert.equal(verdict.valid, false);
  if (verdict.valid) return;
  assert.equal(verdict.reason, 'MALFORMED');
});

test('an ABSENT pan skips the cross-check without waving anything through', () => {
  // GSTIN is conditional on the registration threshold. PAN is always required by the checklist, so
  // in a real application both are present by the time this runs — skipping means "not yet
  // comparable", and the checklist rather than this function is what makes PAN mandatory.
  assert.equal(validateGstin(GSTIN).valid, true);
});

test('the state code is checked against the real range', () => {
  // A wrong state is a tax calculation that is wrong on every invoice, silently — it decides
  // CGST+SGST versus IGST, which is why `tenants` carries `ck_tenants__state_matches_gstin`.
  assert.equal(validateGstin(`01${COMPANY_PAN}1Z5`, COMPANY_PAN).valid, true);
  assert.equal(validateGstin(`38${COMPANY_PAN}1Z5`, COMPANY_PAN).valid, true);
  assert.equal(validateGstin(`97${COMPANY_PAN}1Z5`, COMPANY_PAN).valid, true, 'other territory');
  assert.equal(validateGstin(`99${COMPANY_PAN}1Z5`, COMPANY_PAN).valid, true, 'centre');

  for (const bad of ['00', '39', '50']) {
    const verdict = validateGstin(`${bad}${COMPANY_PAN}1Z5`, COMPANY_PAN);
    assert.equal(verdict.valid, false, `state ${bad} was accepted`);
    if (verdict.valid) continue;
    assert.equal(verdict.reason, 'UNKNOWN_STATE_CODE');
  }
});

test("the thirteenth character allows letters, so a chain's tenth registration is not rejected", () => {
  // A business with more than nine registrations in one state continues into letters. A digits-only
  // rule would reject a large chain's tenth branch with "malformed", which is unfixable by the user.
  assert.equal(isWellFormedGstin(`27${COMPANY_PAN}AZ5`), true);
  // …but not zero, which is not a valid registration number.
  assert.equal(isWellFormedGstin(`27${COMPANY_PAN}0Z5`), false);
});

test('the fourteenth character must be the literal Z', () => {
  assert.equal(isWellFormedGstin(`27${COMPANY_PAN}1Y5`), false);
});

test('a GSTIN of the wrong length is refused whatever else is right', () => {
  assert.equal(isWellFormedGstin(`27${COMPANY_PAN}1Z`), false);
  assert.equal(isWellFormedGstin(`27${COMPANY_PAN}1Z55`), false);
});
