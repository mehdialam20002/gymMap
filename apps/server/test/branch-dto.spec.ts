/**
 * `M-031` · The branch contracts, against `Gym.md` §12 rather than against the table.
 *
 * ┌─ THE ASSERTIONS THAT EARN THEIR KEEP ARE THE REFUSALS ───────────────────────────────────────┐
 * │ A schema that accepts a valid body proves the fields are spelled right. What matters is what │
 * │ it REFUSES, because each refusal here stands in for a defect that reaches production quietly: │
 * │ an ISO state code silently making every invoice inter-state, a swapped coordinate putting a  │
 * │ Mumbai gym in the Norwegian Sea, an empty PATCH writing an audit row for a change nobody made.│
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  branchResponseSchema,
  createBranchRequestSchema,
  updateBranchRequestSchema,
} from '../dist/catalog/dto/branch.dto.js';

/** A body `Gym.md` §12.2 would accept, so each test can break exactly one thing. */
const valid = {
  gym_id: '0192de00-7000-7000-8000-0000000000a1',
  name: 'Iron House Andheri',
  address_line1: '12 Link Road',
  city_id: '0192de00-7000-7000-8000-0000000000a2',
  state: 'Maharashtra',
  state_code: '27',
  postal_code: '400053',
  country_code: 'IN' as const,
  location: { lat: 19.076, lng: 72.877 },
};

test('the §12.2 body is accepted, so every refusal below is about one field', () => {
  assert.equal(createBranchRequestSchema.safeParse(valid).success, true);
});

// ═══════════════════════════════════════════════════════════════════════════
// state_code — the field that decides tax on every future sale at this branch.
// ═══════════════════════════════════════════════════════════════════════════

test('an ISO alpha state code is REFUSED — ADR-0038, and the cost of the alternative', () => {
  /*
   * `MH` is what an Indian developer types without thinking, and `BLK-20` shipped a permissive
   * `^[A-Z0-9]{2}$` that accepted both alphabets. `ADR-0038` settled it: GST codes are two DIGITS.
   *
   * The failure is silent and expensive. `state_code` is `LAUNCH_MARKET_INDIA.md` §4's
   * place-of-supply driver — it decides CGST + SGST versus IGST — so an unrecognised value does
   * not error, it invoices the wrong tax, on every sale, until an accountant notices.
   */
  assert.equal(createBranchRequestSchema.safeParse({ ...valid, state_code: 'MH' }).success, false);
  assert.equal(createBranchRequestSchema.safeParse({ ...valid, state_code: '7' }).success, false);
  assert.equal(createBranchRequestSchema.safeParse({ ...valid, state_code: '27' }).success, true);
});

test('an Indian PIN never starts with zero', () => {
  assert.equal(
    createBranchRequestSchema.safeParse({ ...valid, postal_code: '040053' }).success,
    false,
  );
  assert.equal(
    createBranchRequestSchema.safeParse({ ...valid, postal_code: '40053' }).success,
    false,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// The coordinate, and the swap no review catches.
// ═══════════════════════════════════════════════════════════════════════════

test('the request is {lat, lng} — reading order, not ST_MakePoint order', () => {
  /*
   * `ST_MakePoint` takes longitude FIRST, and the mapper is the one place that conversion happens.
   * The request stays in the order a human reads a coordinate, because a body that matched the
   * PostGIS order would make every hand-written fixture a coin flip.
   *
   * Swapped, Mumbai's 19.076N 72.877E becomes 72.877N 19.076E — a valid point in the Norwegian
   * Sea. No type check catches it and no visual review of a JSON body does either, which is why
   * the field names are asserted here rather than assumed.
   */
  const parsed = createBranchRequestSchema.parse(valid);
  assert.equal(parsed.location.lat, 19.076);
  assert.equal(parsed.location.lng, 72.877);

  // Out of range on either axis is refused rather than clamped.
  const swapped = { ...valid, location: { lat: 191.0, lng: 72.877 } };
  assert.equal(createBranchRequestSchema.safeParse(swapped).success, false);
});

test('an unknown field is refused, not ignored — .strict()', () => {
  // A client sending `state_Code` gets an error rather than a branch with the wrong tax state,
  // which is what a permissive object schema would silently create.
  const typo = { ...valid, state_Code: '27' };
  assert.equal(createBranchRequestSchema.safeParse(typo).success, false);
});

// ═══════════════════════════════════════════════════════════════════════════
// PATCH — partial, but never empty.
// ═══════════════════════════════════════════════════════════════════════════

test('an empty PATCH is refused — an audit row with no change in it is worse than an error', () => {
  /*
   * The tempting reading is that `{}` is a harmless no-op. It is not: `AC-9` writes an audit row
   * per branch mutation, so an accepted empty body produces "somebody changed this branch" with
   * nothing changed — and the explorer answering "who changed what" then has a row with no what.
   */
  assert.equal(updateBranchRequestSchema.safeParse({}).success, false);
});

test('PATCH takes any single field, material or immediate', () => {
  for (const body of [
    { name: 'Iron House Powai' },
    { capacity: 240 },
    { state_code: '29' },
    { location: { lat: 12.97, lng: 77.59 } },
    { temporary_closure: null },
  ]) {
    assert.equal(updateBranchRequestSchema.safeParse(body).success, true, JSON.stringify(body));
  }
});

test('a temporary closure is business DATES, never timestamps — FR-GYM-10', () => {
  // `Asia/Kolkata` business dates. An ISO timestamp here would make "closed on the 20th" depend on
  // the reader's timezone, which for a gym's shutters is the wrong kind of precision.
  const ok = { temporary_closure: { from: '2026-10-20', to: '2026-10-23', reason: 'Diwali' } };
  assert.equal(updateBranchRequestSchema.safeParse(ok).success, true);

  const stamped = { temporary_closure: { ...ok.temporary_closure, from: '2026-10-20T00:00:00Z' } };
  assert.equal(updateBranchRequestSchema.safeParse(stamped).success, false);
});

test('gym_id cannot be PATCHed — a branch does not move between gyms', () => {
  // Absent from the update shape entirely rather than rejected by a rule, so there is nothing to
  // forget. Moving a branch would silently re-parent attendance history and invoices.
  assert.equal(updateBranchRequestSchema.safeParse({ gym_id: valid.gym_id }).success, false);
});

// ═══════════════════════════════════════════════════════════════════════════
// The response, and what it deliberately omits.
// ═══════════════════════════════════════════════════════════════════════════

test('the response carries no tenant_id — BR-DAT-06', () => {
  /*
   * The caller is inside the tenant; RLS put them there. Returning the id tells them nothing they
   * did not send and puts a tenant identifier into every response body, log line and browser
   * cache. Asserted as an absence because absences are what get "helpfully" added back.
   */
  const body = {
    id: '0192de00-7000-7000-8000-0000000000b1',
    gym_id: valid.gym_id,
    name: valid.name,
    address_line1: valid.address_line1,
    address_line2: null,
    city_id: valid.city_id,
    locality_id: null,
    state: valid.state,
    state_code: valid.state_code,
    postal_code: valid.postal_code,
    country_code: 'IN',
    location: valid.location,
    geo_tolerance_metres: 42,
    capacity: null,
    status: 'ACTIVE' as const,
    is_primary: true,
  };
  assert.equal(branchResponseSchema.safeParse(body).success, true);
  assert.equal(
    branchResponseSchema.safeParse({ ...body, tenant_id: 'anything' }).success,
    false,
    'the response schema accepted a tenant_id',
  );
});

test('status is exactly the two branch_status_enum values', () => {
  // Verified against the live enum rather than guessed: ACTIVE, INACTIVE. A DELETE is a
  // deactivation — `Gym.md` §12.4 — because a branch is named by every historical attendance row.
  const base = {
    id: '0192de00-7000-7000-8000-0000000000b1',
    gym_id: valid.gym_id,
    name: valid.name,
    address_line1: valid.address_line1,
    address_line2: null,
    city_id: valid.city_id,
    locality_id: null,
    state: valid.state,
    state_code: valid.state_code,
    postal_code: valid.postal_code,
    country_code: 'IN',
    location: valid.location,
    geo_tolerance_metres: null,
    capacity: null,
    is_primary: false,
  };
  assert.equal(branchResponseSchema.safeParse({ ...base, status: 'INACTIVE' }).success, true);
  assert.equal(branchResponseSchema.safeParse({ ...base, status: 'DELETED' }).success, false);
});
