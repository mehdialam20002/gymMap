/**
 * `M-028` · Which edits need a new submission — `FR-ONB-08`, `BR-GYM-06`, `BR-GYM-07`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THREE STATES, NOT TWO — AND THE FIRST VERSION OF THIS FILE GOT IT WRONG
 *
 * The PRD states the rule from both ends:
 *
 *   `BR-GYM-06`  MATERIAL — legal name, address, geo-location, ownership, bank account
 *   `BR-GYM-07`  NON-MATERIAL — photos, description, amenities, timings, plan pricing
 *
 * The tempting reading is "one registry and its complement": list the material fields, treat
 * everything else as non-material. This file was written that way, with a paragraph below
 * explaining that an unknown field must be MATERIAL — and `MATERIAL_FIELDS.has(field)` returns
 * `false` for an unknown field, so it did precisely the opposite of its own documentation. Its
 * tests caught it.
 *
 * The mistake was in the framing. A complement only works when there are two states, and there are
 * three: known-material, known-non-material, and **not yet classified**. Collapsing the third into
 * either list is what makes the default dangerous, so both lists are explicit and anything in
 * neither is material.
 *
 * The drift a second list invites is handled by a test rather than by pretending it away: the two
 * sets are asserted disjoint, and an unclassified field lands on the safe side by construction.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ AN UNKNOWN FIELD IS MATERIAL ──────────────────────────────────────────────────────────────┐
 * │ The default has to be the cautious one, because the two mistakes are not symmetrical.        │
 * │                                                                                              │
 * │ Treating a non-material field as material sends a photo change to a reviewer: annoying,       │
 * │ visible, and complained about within a day. Treating a material field as non-material lets a  │
 * │ gym change its legal name or its bank account on a LIVE listing with nobody looking — which  │
 * │ is `RSK-01` and payout fraud in one edit, and nothing surfaces it.                            │
 * │                                                                                              │
 * │ So a field this file has never heard of is material, and the annoyance is the price.          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/**
 * `BR-GYM-06`, verbatim: *"legal name, address, geo-location, ownership, bank account"*.
 *
 * Names are the DRAFT's field paths, so a caller compares what it is about to write rather than
 * translating first — a translation layer is one more place for the two vocabularies to disagree.
 */
export const MATERIAL_FIELDS: ReadonlySet<string> = new Set([
  // Legal name. `tradingName` is deliberately NOT here — it is what appears on the listing, and
  // `BR-GYM-07` treats presentation as non-material.
  'legalName',
  'entityType',
  'registrationNumber',

  // Address, in every part. Split fields, one rule: a gym that moves has moved, whether the change
  // was to the street or only to the postcode.
  'registeredAddressLine1',
  'registeredAddressLine2',
  'registeredCity',
  'registeredState',
  'registeredPostalCode',

  // Geo-location. `BR-GYM-06` names it separately from the address because a corrected pin with an
  // unchanged address still moves the gym on the map, which is what a member navigates by.
  'latitude',
  'longitude',

  // Ownership.
  'ownerUserId',
  'pan',
  'gstin',

  // Bank account — and see `suspendsPayouts` below, which is the half `BR-GYM-06` treats specially.
  'bankAccountNumber',
  'bankIfsc',
  'bankAccountHolderName',
]);

/**
 * `BR-GYM-07`, verbatim: *"photos, description, amenities, timings, plan pricing"*.
 *
 * Explicit rather than "everything else", because "everything else" includes every field nobody has
 * classified yet — and those must be material. Listing these is what lets a photo change publish
 * immediately while a field invented next year still waits for a reviewer.
 */
export const NON_MATERIAL_FIELDS: ReadonlySet<string> = new Set([
  'photos',
  'media',
  'description',
  'amenities',
  'openingHours',
  'timings',
  'planPriceMinor',
  // Presentation, not identity — see the note beside `legalName`.
  'tradingName',
  'contactPhone',
  'contactEmail',
]);

/**
 * `BR-GYM-06`'s exception: a bank-account change *"suspends payouts until re-verified"*.
 *
 * Distinct from ordinary materiality. Every material change returns those fields to review while
 * **the listing stays live**; a bank-account change additionally stops money moving, because the
 * failure it guards is not a misleading listing — it is the platform paying an attacker.
 */
export const PAYOUT_SUSPENDING_FIELDS: ReadonlySet<string> = new Set([
  'bankAccountNumber',
  'bankIfsc',
  'bankAccountHolderName',
]);

export interface EditVerdict {
  /** Whether this edit needs review — `FR-ONB-08`'s "a material edit requires a new submission". */
  readonly material: boolean;
  /** `BR-GYM-06` — a bank-account change stops payouts until re-verified. */
  readonly suspendsPayouts: boolean;
  /** The material fields in the edit, for the audit row and for telling the owner what will happen. */
  readonly materialFields: readonly string[];
}

/**
 * Whether one field requires review.
 *
 * Note the shape: NOT-non-material rather than is-material. That is the whole safety property —
 * `MATERIAL_FIELDS.has(field)` would answer `false` for a field nobody has classified, which is the
 * permissive default this file exists to avoid and the bug its own tests caught.
 */
export function isMaterialField(field: string): boolean {
  return !NON_MATERIAL_FIELDS.has(field);
}

/**
 * Classifies a whole edit.
 *
 * ┌─ ONE MATERIAL FIELD MAKES THE EDIT MATERIAL ────────────────────────────────────────────────┐
 * │ An edit changing a photo AND a legal name is material. The alternative — splitting it and     │
 * │ publishing the safe half — sounds helpful and is how the review gets skipped: the owner        │
 * │ resubmits, the photo lands, the name change sits in a queue, and the listing now shows a       │
 * │ combination nobody approved.                                                                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function classifyEdit(changedFields: readonly string[]): EditVerdict {
  const materialFields = changedFields.filter((field) => isMaterialField(field));

  return {
    material: materialFields.length > 0,
    suspendsPayouts: changedFields.some((field) => PAYOUT_SUSPENDING_FIELDS.has(field)),
    materialFields: [...materialFields].sort(),
  };
}

/**
 * `FR-ONB-08` — may this field be edited while a submitted version is under review?
 *
 * The submitted SNAPSHOT is frozen either way; this answers whether the owner's live draft may
 * change underneath it. Non-material fields may, which is the whole point of the requirement: an
 * owner should not have to sit on their hands for three days because they noticed a typo in their
 * description.
 */
export function mayEditWhileUnderReview(field: string): boolean {
  return !isMaterialField(field);
}
