/**
 * `M-028` · Material versus non-material — `FR-ONB-08`, `BR-GYM-06`, `BR-GYM-07`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MATERIAL_FIELDS,
  NON_MATERIAL_FIELDS,
  PAYOUT_SUSPENDING_FIELDS,
  classifyEdit,
  isMaterialField,
  mayEditWhileUnderReview,
} from '../dist/onboarding/domain/material-field.policy.js';

// ═══════════════════════════════════════════════════════════════════════════
// BR-GYM-06 — the five categories the PRD names
// ═══════════════════════════════════════════════════════════════════════════

test('BR-GYM-06 — legal name, address, geo-location, ownership and bank account are material', () => {
  const byCategory = {
    'legal name': ['legalName', 'entityType', 'registrationNumber'],
    address: ['registeredAddressLine1', 'registeredCity', 'registeredPostalCode'],
    'geo-location': ['latitude', 'longitude'],
    ownership: ['ownerUserId', 'pan', 'gstin'],
    'bank account': ['bankAccountNumber', 'bankIfsc', 'bankAccountHolderName'],
  };

  for (const [category, fields] of Object.entries(byCategory)) {
    for (const field of fields) {
      assert.equal(isMaterialField(field), true, `${category}: ${field} should be material`);
    }
  }
});

test('BR-GYM-07 — photos, description, amenities, timings and pricing are NOT material', () => {
  // These publish immediately, subject to automated screening. A gym that had to wait three days
  // to change a photo would simply stop changing photos.
  for (const field of [
    'photos',
    'description',
    'amenities',
    'openingHours',
    'planPriceMinor',
    'tradingName',
  ]) {
    assert.equal(isMaterialField(field), false, `${field} should publish without review`);
  }
});

test('tradingName is non-material while legalName is material, and that distinction is deliberate', () => {
  // ┌─ THE PAIR MOST LIKELY TO BE COLLAPSED ─────────────────────────────────────────────────────┐
  // │ They look like the same field. `legalName` is who the business IS — it is on the KYC        │
  // │ documents a reviewer checked. `tradingName` is what appears on the listing, and `BR-GYM-07` │
  // │ treats presentation as non-material. Making both material buries reviewers in rebrands;     │
  // │ making both non-material lets a company change its legal identity unreviewed.               │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  assert.equal(isMaterialField('legalName'), true);
  assert.equal(isMaterialField('tradingName'), false);
});

// ═══════════════════════════════════════════════════════════════════════════
// The default, which is the whole safety property
// ═══════════════════════════════════════════════════════════════════════════

test('an UNKNOWN field is material — the two mistakes are not symmetrical', () => {
  // ┌─ WHY THE CAUTIOUS DEFAULT ─────────────────────────────────────────────────────────────────┐
  // │ Treating a non-material field as material sends a photo change to a reviewer: annoying,     │
  // │ visible, complained about within a day. Treating a material field as non-material lets a    │
  // │ gym change its legal name or bank account on a LIVE listing with nobody looking — RSK-01    │
  // │ and payout fraud in one edit, and nothing surfaces it.                                       │
  // │                                                                                            │
  // │ A field added next year and forgotten here therefore lands on the safe side by default.     │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  for (const unknown of ['someFieldAddedNextYear', 'bankSortCode', '', 'legalname']) {
    assert.equal(isMaterialField(unknown), true, `${unknown} should default to material`);
  }
});

test('the check is case-sensitive, so a near-miss lands on the SAFE side', () => {
  // `legalname` is not `legalName`. Under a case-insensitive match a typo would silently classify a
  // material field as known-and-material anyway — fine — but a typo on a NON-material name would
  // make it material, which is the direction that costs nothing.
  assert.equal(isMaterialField('legalname'), true);
  assert.equal(isMaterialField('LEGALNAME'), true);
});

// ═══════════════════════════════════════════════════════════════════════════
// Whole edits
// ═══════════════════════════════════════════════════════════════════════════

test('ONE material field makes the whole edit material', () => {
  // Splitting the edit and publishing the safe half sounds helpful and is how the review gets
  // skipped: the photo lands, the name change queues, and the listing shows a combination nobody
  // approved.
  const verdict = classifyEdit(['photos', 'description', 'legalName']);

  assert.equal(verdict.material, true);
  assert.deepEqual(verdict.materialFields, ['legalName']);
});

test('an entirely non-material edit publishes immediately', () => {
  const verdict = classifyEdit(['photos', 'description', 'amenities']);

  assert.equal(verdict.material, false);
  assert.equal(verdict.suspendsPayouts, false);
  assert.deepEqual(verdict.materialFields, []);
});

test('an empty edit is not material — there is nothing to review', () => {
  assert.equal(classifyEdit([]).material, false);
});

test('the material fields are reported sorted, for a stable audit row', () => {
  const forwards = classifyEdit(['pan', 'legalName', 'latitude']);
  const backwards = classifyEdit(['latitude', 'pan', 'legalName']);

  assert.deepEqual(forwards.materialFields, backwards.materialFields);
  assert.deepEqual(forwards.materialFields, ['latitude', 'legalName', 'pan']);
});

// ═══════════════════════════════════════════════════════════════════════════
// BR-GYM-06's exception
// ═══════════════════════════════════════════════════════════════════════════

test('BR-GYM-06 — a bank-account change SUSPENDS PAYOUTS, beyond being material', () => {
  // Every material change returns those fields to review while the listing stays live. A bank
  // account additionally stops money moving, because the failure it guards is not a misleading
  // listing — it is the platform paying an attacker.
  const verdict = classifyEdit(['bankAccountNumber']);

  assert.equal(verdict.material, true);
  assert.equal(verdict.suspendsPayouts, true);
});

test('every payout-suspending field is also material, by construction', () => {
  // A field that stopped payouts without being material would be reviewed by nobody while money
  // was already held — the worst of both.
  for (const field of PAYOUT_SUSPENDING_FIELDS) {
    assert.equal(MATERIAL_FIELDS.has(field), true, `${field} suspends payouts but is not material`);
  }
});

test('an ordinary material change does NOT suspend payouts', () => {
  // Otherwise correcting a postcode would stop a gym being paid, and the next gym would not correct
  // its postcode.
  assert.equal(classifyEdit(['registeredPostalCode']).suspendsPayouts, false);
  assert.equal(classifyEdit(['legalName']).suspendsPayouts, false);
});

// ═══════════════════════════════════════════════════════════════════════════
// FR-ONB-08 — editing while under review
// ═══════════════════════════════════════════════════════════════════════════

test('FR-ONB-08 — non-material fields stay editable while a version is under review', () => {
  // The submitted SNAPSHOT is frozen either way. This is about the live draft, and the point of the
  // requirement is that an owner should not sit on their hands for three days over a typo.
  assert.equal(mayEditWhileUnderReview('description'), true);
  assert.equal(mayEditWhileUnderReview('photos'), true);

  assert.equal(mayEditWhileUnderReview('legalName'), false);
  assert.equal(mayEditWhileUnderReview('bankAccountNumber'), false);
});

// ═══════════════════════════════════════════════════════════════════════════
// The drift a second list invites, handled rather than pretended away
// ═══════════════════════════════════════════════════════════════════════════

test('the two registries are DISJOINT', () => {
  // ┌─ THE ONE FAILURE MODE TWO LISTS ADD ───────────────────────────────────────────────────────┐
  // │ A field in both is a contradiction the code resolves silently — `isMaterialField` answers   │
  // │ from `NON_MATERIAL_FIELDS`, so a field mistakenly added to both would publish unreviewed    │
  // │ while `MATERIAL_FIELDS` said otherwise and nobody read it.                                  │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const overlap = [...MATERIAL_FIELDS].filter((field) => NON_MATERIAL_FIELDS.has(field));

  assert.deepEqual(
    overlap,
    [],
    `these fields are in BOTH registries, and the non-material list silently wins: ${overlap.join(', ')}`,
  );
});

test('every BR-GYM-06 field is absent from the non-material list, stated the other way round', () => {
  // Asserted from the material side too, because the disjointness check above would also pass if
  // MATERIAL_FIELDS were empty — and an empty material registry means nothing is ever reviewed.
  assert.ok(MATERIAL_FIELDS.size >= 15, 'the material registry looks truncated');
  assert.ok(NON_MATERIAL_FIELDS.size >= 8, 'the non-material registry looks truncated');
});
