/**
 * `M-027` · The wizard steps and the registration normaliser — `FR-ONB-01`, `BR-GYM-08`, `AC-5`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  WIZARD_STEPS,
  isWizardStep,
  progressFrom,
} from '../dist/onboarding/domain/wizard-step.js';
import {
  isSameRegistration,
  normaliseRegistrationNumber,
} from '../dist/onboarding/domain/registration-number.normaliser.js';

// ═══════════════════════════════════════════════════════════════════════════
// AC-5 — the duplicate check must compare like with like
// ═══════════════════════════════════════════════════════════════════════════

const CIN = 'U74999KA2015PTC082988';

test('BR-GYM-08 — the variants a duplicate check must catch all normalise together', () => {
  // ┌─ WHAT HAPPENS WITHOUT THIS ────────────────────────────────────────────────────────────────┐
  // │ Four submissions, one company, and a raw string comparison approves all four — the same gym │
  // │ listed four times, each with its own reviews and its own payout account.                    │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const variants = [
    CIN,
    CIN.toLowerCase(),
    'U-74999-KA-2015-PTC-082988',
    '  U74999KA2015PTC082988  ',
    'U 74999 KA 2015 PTC 082988',
    'U74999/KA/2015/PTC/082988',
    'U74999.KA.2015.PTC.082988',
    'U74999_KA_2015_PTC_082988',
  ];

  for (const variant of variants) {
    assert.equal(
      normaliseRegistrationNumber(variant),
      CIN,
      `${JSON.stringify(variant)} did not normalise to the canonical form`,
    );
    assert.equal(isSameRegistration(variant, CIN), true, `${variant} was not seen as the same`);
  }
});

test('a value PASTED from a document normalises too', () => {
  // ┌─ THE VARIANT THAT LOOKS IDENTICAL ON SCREEN ───────────────────────────────────────────────┐
  // │ En dashes, non-breaking hyphens and non-breaking spaces arrive whenever somebody copies a   │
  // │ registration out of a PDF or a Word document — which is how most of them arrive. An ASCII-  │
  // │ only strip works for typed input and fails silently for pasted input, and the two are       │
  // │ indistinguishable to the person looking at the form.                                        │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const pasted = 'U‑74999–KA—2015 PTC−082988';
  assert.equal(normaliseRegistrationNumber(pasted), CIN, 'a pasted value did not normalise');
});

test('full-width characters from an IME fold onto ASCII', () => {
  // NFKC before stripping, not after: full-width Latin is neither an ASCII alphanumeric nor a
  // recognised separator, so stripping first would leave it in place.
  assert.equal(normaliseRegistrationNumber('Ｕ７４９９９ＫＡ２０１５ＰＴＣ０８２９８８'), CIN);
});

test('two DIFFERENT registrations are not conflated', () => {
  // The normaliser must not be so aggressive that it merges distinct companies — a false duplicate
  // refuses a legitimate application, which the applicant cannot work around at all.
  assert.equal(isSameRegistration(CIN, 'U74999KA2015PTC082989'), false);
  assert.equal(isSameRegistration(CIN, 'L74999KA2015PTC082988'), false);
});

test('two EMPTY identifiers are not "the same registration"', () => {
  // An unregistered sole proprietor has no identifier. Treating absence as a match would make every
  // one of them a duplicate of every other.
  assert.equal(isSameRegistration('', ''), false);
  assert.equal(isSameRegistration('   ', '---'), false);
  assert.equal(isSameRegistration(CIN, ''), false);
});

test('AC-5 — the normaliser is DETERMINISTIC', () => {
  // Stated because the duplicate check is a stored comparison: a normaliser that varied between
  // calls would let a value match at write time and miss at read time.
  for (const value of [CIN, 'u-74999 ka', '', '   ']) {
    assert.equal(normaliseRegistrationNumber(value), normaliseRegistrationNumber(value));
  }
});

test('normalisation is idempotent — normalising twice changes nothing', () => {
  // The stored normalised column will be re-normalised by any future migration or backfill.
  const once = normaliseRegistrationNumber('U-74999 KA/2015');
  assert.equal(normaliseRegistrationNumber(once), once);
});

// ═══════════════════════════════════════════════════════════════════════════
// The six steps
// ═══════════════════════════════════════════════════════════════════════════

test('FR-ONB-01 — the six steps are a closed set', () => {
  assert.deepEqual(WIZARD_STEPS, [
    'BUSINESS_IDENTITY',
    'KYC',
    'GYM_PROFILE',
    'PLANS',
    'PAYOUT',
    'REVIEW',
  ]);

  assert.equal(isWizardStep('BUSINESS_IDENTITY'), true);
  assert.equal(isWizardStep('business_identity'), false, 'the guard is case-sensitive');
  assert.equal(isWizardStep('PAYMENT'), false);
});

test('AC-3 — progress is DATA, and completion is returned in canonical order', () => {
  // Two owners who completed the same steps in different orders must get the same answer, so a
  // client can compare against a constant rather than against its own history.
  const forwards = progressFrom(['BUSINESS_IDENTITY', 'KYC', 'PLANS']);
  const backwards = progressFrom(['PLANS', 'KYC', 'BUSINESS_IDENTITY']);

  assert.deepEqual(forwards, backwards);
  assert.deepEqual(forwards.completed, ['BUSINESS_IDENTITY', 'KYC', 'PLANS']);
});

test('nextStep is the first INCOMPLETE step, so a returning owner lands where they stopped', () => {
  assert.equal(progressFrom([]).nextStep, 'BUSINESS_IDENTITY');
  assert.equal(progressFrom(['BUSINESS_IDENTITY']).nextStep, 'KYC');

  // A GAP is respected rather than skipped: somebody who did steps 1 and 3 is sent back to 2.
  assert.equal(progressFrom(['BUSINESS_IDENTITY', 'GYM_PROFILE']).nextStep, 'KYC');
});

test('every step complete gives a null nextStep, not a seventh step', () => {
  assert.equal(progressFrom([...WIZARD_STEPS]).nextStep, null);
});

test('a duplicate or unknown entry does not corrupt the answer', () => {
  // The completion list arrives from storage, which outlives any one version of this code.
  const progress = progressFrom([
    'KYC',
    'KYC',
    'NOT_A_STEP' as never,
  ]);

  assert.deepEqual(progress.completed, ['KYC']);
  assert.equal(progress.nextStep, 'BUSINESS_IDENTITY');
});
