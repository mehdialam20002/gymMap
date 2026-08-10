/**
 * `M-031` · Which branch edits re-open review — `Gym.md` §12.3, `BR-GYM-06`, `FR-GYM-11`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE SAME THREE-STATE SHAPE AS `onboarding/domain/material-field.policy.ts`, AND ON PURPOSE
 *
 * That file's header records the bug it shipped with: it listed the material fields and treated
 * the complement as non-material, so `MATERIAL_FIELDS.has(unknown)` returned `false` and an
 * unclassified field defaulted to the UNSAFE side — the exact opposite of the paragraph above it.
 * The fix was to stop modelling two states. There are three: known-material, known-immediate, and
 * not-yet-classified, and only the third makes the default dangerous.
 *
 * So both lists here are explicit, `classOf()` answers `MATERIAL` for anything in neither, and a
 * test asserts the two sets are disjoint AND that together they cover every key the PATCH schema
 * accepts. A field added to `updateBranchRequestSchema` and not to one of these lists is caught by
 * that test rather than by a reviewer noticing.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ WHY BRANCH FIELDS NEED THEIR OWN LISTS AND NOT `onboarding`'s ──────────────────────────────┐
 * │ `MATERIAL_FIELDS` in `onboarding/` is keyed on the DRAFT's field paths — `registeredCity`,    │
 * │ `legalName` — because that is what a wizard step writes. A branch PATCH writes                │
 * │ `city_id` and `state_code`. Importing the onboarding set and mapping names between them would │
 * │ put a translation layer between two vocabularies that must agree, which is one more place for │
 * │ them to drift apart silently.                                                                  │
 * │                                                                                              │
 * │ `R2`/`FolderStructure.md` §8.1 also forbid the import outright: `catalog/` may not reach into │
 * │ `onboarding/domain/`. Two lists, one rule, and the rule is `BR-GYM-06`'s in both files.        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ `catalog/README.md` §4 GIVES THE MATERIAL-FIELD REGISTRY TO `M-035`, AND THIS IS NOT IT ────┐
 * │ *"Delivering milestones: … M-035 (the material-field registry)"*. That registry is the        │
 * │ gym-wide one `Gym.md` §6.3 describes — the map a client fetches so it does not hard-code the  │
 * │ list, spanning gym profile, media, plans and bank details.                                     │
 * │                                                                                              │
 * │ This file is narrower and is not a down payment on it: seven field names that `Gym.md` §12.3  │
 * │ states verbatim for one route. `PATCH /v1/tenant/branches/:id` is an M-031 route and cannot   │
 * │ be built without knowing which of its fields are material, so the alternative to writing them │
 * │ here is shipping the route without `BR-GYM-06` — which is the rule the route exists to apply. │
 * │                                                                                              │
 * │ When `M-035` builds the registry, these two sets become an input to it rather than a rival    │
 * │ copy. They are exported for exactly that reason.                                               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/**
 * `Gym.md` §12.3, verbatim: *"`address_line1/2`, `city_id`, `state`, `state_code`, `postal_code`
 * and `location` are **MATERIAL**"*.
 *
 * Every one of them is `BR-GYM-06`'s *"address, geo-location"* clause in a different column.
 * `state_code` is the one worth pausing on: it looks like a two-character formality and it decides
 * **CGST + SGST versus IGST on every future invoice for a sale at this branch** (§12.2,
 * `LAUNCH_MARKET_INDIA.md` §4). A gym that changes it has either corrected a data-entry error or
 * moved to another state, and the second is a relocation nobody should be able to make silently.
 */
export const MATERIAL_BRANCH_FIELDS: ReadonlySet<string> = new Set([
  'address_line1',
  'address_line2',
  'city_id',
  'state',
  'state_code',
  'postal_code',
  'location',
]);

/**
 * *"`name`, `capacity`, `landmark`, `parking_notes` and the temporary-closure block are immediate"*.
 *
 * `locality_id` is NOT here, and its absence is the default doing its job rather than an omission.
 * §12.3 does not name it on either side; it is part of the address, so `classOf()` returns
 * `MATERIAL` for it — which is the answer `BR-GYM-06`'s *"address"* clause would give if anyone
 * had thought to ask. Listing it explicitly is `M-032`'s work, once somebody rules on whether a
 * locality correction is a relocation. Until then it errs toward the reviewer.
 */
export const IMMEDIATE_BRANCH_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'capacity',
  'landmark',
  'parking_notes',
  'temporary_closure',
]);

export type BranchFieldClass = 'MATERIAL' | 'IMMEDIATE';

/** An unclassified field is `MATERIAL`. See the header for why the default cannot be the other one. */
export function classOf(field: string): BranchFieldClass {
  return IMMEDIATE_BRANCH_FIELDS.has(field) ? 'IMMEDIATE' : 'MATERIAL';
}

/**
 * The `field_change_classes` block `Gym.md` §12.2 requires on `GET /v1/tenant/branches/:id`.
 *
 * It exists so the dashboard can tell an owner *before* they save that changing this field sends
 * the gym back to review — `FR-GYM-11`: *"the UI states this before the change is saved"*. A UI
 * that hard-codes the same list is a second copy that stops matching the server the first time one
 * of them changes, and the owner finds out by having a listing pulled into review unexpectedly.
 */
export function fieldChangeClasses(): Readonly<Record<string, BranchFieldClass>> {
  const classes: Record<string, BranchFieldClass> = {};
  for (const field of MATERIAL_BRANCH_FIELDS) classes[field] = 'MATERIAL';
  for (const field of IMMEDIATE_BRANCH_FIELDS) classes[field] = 'IMMEDIATE';
  return classes;
}

/**
 * Does this patch touch anything material?
 *
 * Takes the KEYS the client actually sent, not the parsed body: a Zod-parsed object with optional
 * fields is indistinguishable from one where the client sent `undefined`, and the two mean
 * different things here. `Object.keys()` on a `.strict()` parse result carries only what arrived.
 */
export function touchesMaterialField(fields: readonly string[]): boolean {
  return fields.some((field) => classOf(field) === 'MATERIAL');
}
