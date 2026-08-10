/**
 * `M-031` · Which branch edits re-open review — `Gym.md` §12.3, `BR-GYM-06`, `FR-GYM-11`.
 *
 * ┌─ THE TWO ASSERTIONS THE SOURCE FILE PROMISES, WRITTEN DOWN ──────────────────────────────────┐
 * │ `branch-field-classes.ts` says: *"a test asserts the two sets are disjoint AND that together  │
 * │ they cover every key the PATCH schema accepts"*. A header claiming a test exists, without the │
 * │ test, is worse than no claim — the next reader stops checking.                                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  IMMEDIATE_BRANCH_FIELDS,
  MATERIAL_BRANCH_FIELDS,
  classOf,
  fieldChangeClasses,
  touchesMaterialField,
} from '../dist/catalog/domain/branch-field-classes.js';
import { updateBranchRequestSchema } from '../dist/catalog/dto/branch.dto.js';

// ═══════════════════════════════════════════════════════════════════════════
// The default, which is the whole reason the file has two explicit lists
// ═══════════════════════════════════════════════════════════════════════════

test('a field NEITHER list has heard of is MATERIAL', () => {
  /*
   * The equivalent file in `onboarding/` shipped the opposite and its own header caught it: it
   * listed the material fields and treated the complement as non-material, so
   * `MATERIAL_FIELDS.has(unknown)` returned `false` and an unclassified field defaulted to the
   * UNSAFE side — the exact opposite of the paragraph above it.
   *
   * The two mistakes are not symmetrical. Treating a photo as material annoys somebody within a
   * day. Treating an address as immediate lets a gym move premises on a live listing with nobody
   * looking.
   */
  assert.equal(classOf('a_column_added_next_sprint'), 'MATERIAL');
  assert.equal(classOf(''), 'MATERIAL');
  assert.equal(classOf('__proto__'), 'MATERIAL');
});

test('locality_id is MATERIAL by default, and §12.3 names it on neither side', () => {
  // Not an omission — the default doing its job. It is part of the address, so `BR-GYM-06`'s
  // "address" clause would give the same answer if anyone had thought to ask.
  assert.ok(!MATERIAL_BRANCH_FIELDS.has('locality_id'));
  assert.ok(!IMMEDIATE_BRANCH_FIELDS.has('locality_id'));
  assert.equal(classOf('locality_id'), 'MATERIAL');
});

// ═══════════════════════════════════════════════════════════════════════════
// The two structural properties
// ═══════════════════════════════════════════════════════════════════════════

test('the two sets are disjoint — no field is both material and immediate', () => {
  const both = [...MATERIAL_BRANCH_FIELDS].filter((field) => IMMEDIATE_BRANCH_FIELDS.has(field));
  assert.deepEqual(both, [], 'a field in both lists makes classOf() depend on evaluation order');
});

test('every field the PATCH schema accepts is classified, or classified MATERIAL on purpose', () => {
  /*
   * ┌─ THIS IS THE ASSERTION THAT CATCHES THE NEXT FIELD ────────────────────────────────────────┐
   * │ A field added to `updateBranchRequestSchema` and to neither list still WORKS — `classOf()`  │
   * │ answers MATERIAL and the acknowledgement gate fires. That is safe and it may also be wrong: │
   * │ a new `parking_notes`-shaped field would start demanding a review nobody intended.          │
   * │                                                                                            │
   * │ So the test does not fail on an unlisted field. It fails on an unlisted field that is not   │
   * │ ALSO in this file's own expected set — which forces whoever adds one to come here and       │
   * │ decide, in the file whose subject is that decision.                                          │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const accepted = Object.keys(updateBranchRequestSchema._def.schema.shape).filter(
    (key) => key !== 'acknowledge_review',
  );

  /** Accepted by the schema, in neither list, and MATERIAL by default on purpose. */
  const deliberatelyDefaulted = new Set(['locality_id']);

  const unclassified = accepted.filter(
    (key) =>
      !MATERIAL_BRANCH_FIELDS.has(key) &&
      !IMMEDIATE_BRANCH_FIELDS.has(key) &&
      !deliberatelyDefaulted.has(key),
  );

  assert.deepEqual(
    unclassified,
    [],
    `these PATCH fields are in neither list: ${unclassified.join(', ')}. They default to ` +
      `MATERIAL, which is safe — decide whether that is also RIGHT, then add them to a list or ` +
      `to deliberatelyDefaulted above.`,
  );
});

test('neither list names a field the PATCH schema does not accept', () => {
  // The other direction. A stale entry is harmless at runtime and misleading to read: it implies
  // the route accepts something it rejects.
  const accepted = new Set(Object.keys(updateBranchRequestSchema._def.schema.shape));
  const orphans = [...MATERIAL_BRANCH_FIELDS, ...IMMEDIATE_BRANCH_FIELDS].filter(
    (field) => !accepted.has(field),
  );

  assert.deepEqual(orphans, [], `classified but not accepted by the schema: ${orphans.join(', ')}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// §12.3, field by field
// ═══════════════════════════════════════════════════════════════════════════

test('§12.3’s seven material fields, named individually', () => {
  // Named one at a time rather than compared as a set, so a reader can see that none was
  // overlooked and a diff shows exactly which one changed.
  for (const field of [
    'address_line1',
    'address_line2',
    'city_id',
    'state',
    'state_code',
    'postal_code',
    'location',
  ]) {
    assert.equal(classOf(field), 'MATERIAL', `${field} should be material`);
  }
});

test('§12.3’s five immediate fields, named individually', () => {
  for (const field of ['name', 'capacity', 'landmark', 'parking_notes', 'temporary_closure']) {
    assert.equal(classOf(field), 'IMMEDIATE', `${field} should be immediate`);
  }
});

test('state_code is MATERIAL, and it is the one that looks like a formality', () => {
  /*
   * Two characters, and it decides **CGST + SGST versus IGST on every future invoice for a sale at
   * this branch** (§12.2, `LAUNCH_MARKET_INDIA.md` §4). A gym that changes it has either corrected
   * a typo or moved to another state, and the second is a relocation nobody should make silently.
   */
  assert.equal(classOf('state_code'), 'MATERIAL');
});

// ═══════════════════════════════════════════════════════════════════════════
// What the use case and the detail route actually call
// ═══════════════════════════════════════════════════════════════════════════

test('touchesMaterialField answers on the keys SENT, not on the schema', () => {
  assert.equal(touchesMaterialField(['name']), false);
  assert.equal(touchesMaterialField(['name', 'capacity']), false);
  assert.equal(touchesMaterialField(['name', 'postal_code']), true);
  // One material field among many immediate ones is still material. The gate is an OR.
  assert.equal(touchesMaterialField(['name', 'capacity', 'landmark', 'location']), true);
  // An empty patch touches nothing. The DTO refuses it separately; this must not throw.
  assert.equal(touchesMaterialField([]), false);
});

test('fieldChangeClasses covers both lists and nothing else', () => {
  /*
   * `GET /v1/tenant/branches/:id` returns this map so the dashboard can warn BEFORE a save —
   * `FR-GYM-11`: *"the UI states this before the change is saved"*. `Gym.md` 816 says why it is
   * served rather than hard-coded: *"a client that hard-coded the material list would break,
   * which is why the map exists"*.
   */
  const classes = fieldChangeClasses();
  const keys = Object.keys(classes).sort();

  assert.deepEqual(
    keys,
    [...MATERIAL_BRANCH_FIELDS, ...IMMEDIATE_BRANCH_FIELDS].sort(),
    'the served map and the lists have diverged',
  );
  assert.equal(classes['location'], 'MATERIAL');
  assert.equal(classes['name'], 'IMMEDIATE');
});

test('the served map is a fresh object — a caller cannot mutate the registry', () => {
  // It is built per call rather than being a module-level constant handed out by reference. A
  // controller that assigned into it would change what every later request is told.
  const first = fieldChangeClasses() as Record<string, string>;
  first['name'] = 'MATERIAL';

  assert.equal(fieldChangeClasses()['name'], 'IMMEDIATE', 'the registry was mutated by a caller');
});
