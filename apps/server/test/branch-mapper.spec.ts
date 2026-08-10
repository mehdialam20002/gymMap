/**
 * `M-031` · The coordinate seam, and the swap that survives every other check.
 *
 * ┌─ WHY A MAPPER GETS ITS OWN SUITE ────────────────────────────────────────────────────────────┐
 * │ Most mappers are field-for-field copies and testing them is testing the compiler. This one    │
 * │ crosses a convention boundary: `ST_MakePoint` takes longitude first and every human writes    │
 * │ latitude first, so exactly one function reverses them and everything downstream trusts it.    │
 * │                                                                                              │
 * │ The failure mode has no symptom. A swapped Indian coordinate is still a valid point with a    │
 * │ valid SRID inside every declared range — it is simply somewhere else, and nothing but a map   │
 * │ or an assertion like these notices.                                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  looksLikeIndia,
  postGisPoint,
  toBranchResponse,
} from '../dist/catalog/infrastructure/branch.mapper.js';
import { branchResponseSchema } from '../dist/catalog/dto/branch.dto.js';

/** Mumbai. 19.076 N, 72.877 E — the coordinate `ADR-0042` used to catch the same swap in a seed. */
const MUMBAI = { lat: 19.076, lng: 72.877 };

const row = {
  id: '0192de00-7000-7000-8000-0000000000b1',
  gymId: '0192de00-7000-7000-8000-0000000000a1',
  name: 'Iron House Andheri',
  addressLine1: '12 Link Road',
  addressLine2: null,
  cityId: '0192de00-7000-7000-8000-0000000000a2',
  localityId: null,
  state: 'Maharashtra',
  stateCode: '27',
  postalCode: '400053',
  countryCode: 'IN',
  lat: MUMBAI.lat,
  lng: MUMBAI.lng,
  geoToleranceMetres: 42,
  capacity: null,
  status: 'ACTIVE' as const,
  isPrimary: true,
};

test('postGisPoint returns [longitude, latitude] — the order the function is named for', () => {
  /*
   * The whole file exists for this line. Asserted positionally rather than by property, because
   * the tuple is spread into a parameter list and position is all that survives:
   *
   *     ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography   with   ...postGisPoint(location)
   */
  const [longitude, latitude] = postGisPoint(MUMBAI);
  assert.equal(longitude, 72.877, 'the first element must be LONGITUDE');
  assert.equal(latitude, 19.076, 'the second element must be LATITUDE');
});

test('the round trip through both directions is the identity', () => {
  // Reverse the tuple back into a response and the numbers must land where they started. A
  // mapper that swapped consistently in both directions would pass a one-way test and put every
  // gym in the wrong hemisphere.
  const [longitude, latitude] = postGisPoint(MUMBAI);
  const response = toBranchResponse({ ...row, lat: latitude, lng: longitude });

  assert.deepEqual(response.location, MUMBAI);
});

test('the swap is detectable, and this is what makes it so', () => {
  /*
   * Mumbai transposed is 72.877 N 19.076 E — the Norwegian Sea. Valid latitude, valid longitude,
   * valid SRID, inside `Gym.md` §12.2's global bounds. Nothing in the type system, the schema or
   * a `CHECK` constraint objects.
   *
   * India's box is the cheap oracle: 6–37 N by 68–98 E. No Indian coordinate survives transposition
   * into it, because 68–98 E does not overlap 6–37 N.
   */
  assert.equal(looksLikeIndia(MUMBAI), true);
  assert.equal(looksLikeIndia({ lat: MUMBAI.lng, lng: MUMBAI.lat }), false, 'the swap went unseen');

  // Bengaluru and Delhi too, so the property is the box and not one lucky city.
  for (const city of [
    { lat: 12.9716, lng: 77.5946 },
    { lat: 28.6139, lng: 77.209 },
  ]) {
    assert.equal(looksLikeIndia(city), true);
    assert.equal(looksLikeIndia({ lat: city.lng, lng: city.lat }), false);
  }
});

test('the mapper output satisfies the response contract, field for field', () => {
  // Parsed rather than eyeballed: `branchResponseSchema` is `.strict()`, so a field the mapper
  // invents or misnames fails here rather than reaching a client that then depends on it.
  const parsed = branchResponseSchema.safeParse(toBranchResponse(row));
  assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
});

test('BranchRow carries no tenant_id, so the mapper cannot leak one', () => {
  /*
   * `BR-DAT-06`, enforced by absence rather than by discipline. A field the row type does not
   * have is a field no mapper can copy, no matter who edits it next — whereas "remember not to
   * include tenant_id" is a rule that survives exactly as long as the person who wrote it.
   *
   * Asserted on the runtime object because the type disappears at compile time, and this suite
   * should still fail if someone widens the row to `Record<string, unknown>`.
   */
  assert.ok(!Object.keys(row).some((key) => /tenant/i.test(key)));
  assert.ok(!Object.keys(toBranchResponse(row)).some((key) => /tenant/i.test(key)));
});

test('nulls pass through as nulls — an optional column is not an absent field', () => {
  // `address_line2`, `locality_id`, `capacity` and `geo_tolerance_metres` are nullable columns.
  // Mapping them to `undefined` would drop them from the JSON body entirely, and a client reading
  // `capacity` would get `undefined` for "not set" and for "field removed from the API" alike.
  const sparse = toBranchResponse({
    ...row,
    addressLine2: null,
    localityId: null,
    capacity: null,
    geoToleranceMetres: null,
  });

  for (const key of ['address_line2', 'locality_id', 'capacity', 'geo_tolerance_metres'] as const) {
    assert.ok(key in sparse, `${key} vanished from the body instead of being null`);
    assert.equal(sparse[key], null);
  }
});
