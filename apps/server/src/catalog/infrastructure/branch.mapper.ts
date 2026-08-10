/**
 * `M-031` · The one place a branch row becomes a response, and a coordinate changes order.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LONGITUDE FIRST IS A POSTGIS FACT AND `{lat, lng}` IS A HUMAN ONE. THIS FILE IS THE SEAM.
 *
 * `ST_MakePoint(x, y)` takes **longitude then latitude**. Every JSON body, every map URL and
 * every human writes latitude first. Both conventions are correct in their own world and the
 * translation has to happen exactly once, in a place named after doing it.
 *
 * Swapped, Mumbai's 19.076 N 72.877 E becomes 72.877 N 19.076 E — the Norwegian Sea. A valid
 * point, on the right planet, inside the coordinate ranges, which is why nothing catches it:
 * not the type system, not a `CHECK`, not a reviewer reading a diff. `ADR-0042` hit exactly
 * this while seeding twelve cities, and the guard there was an India bounding-box assertion.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { BranchResponse } from '../dto/branch.dto.js';

/**
 * A branch as the repository reads it back.
 *
 * `location` is `geography(Point, 4326)`, which Prisma models as `Unsupported` and cannot select
 * — so the repository projects it with `ST_Y(location::geometry) AS lat, ST_X(location::geometry)
 * AS lng` and hands the two numbers here. That projection is the reason this type has `lat` and
 * `lng` rather than a geometry: by the time a row reaches a mapper the PostGIS order is already
 * behind it, and re-deriving it would be a second place to get it wrong.
 */
export interface BranchRow {
  readonly id: string;
  readonly gymId: string;
  readonly name: string;
  readonly addressLine1: string;
  readonly addressLine2: string | null;
  readonly cityId: string;
  readonly localityId: string | null;
  readonly state: string;
  readonly stateCode: string;
  readonly postalCode: string;
  readonly countryCode: string;
  readonly lat: number;
  readonly lng: number;
  readonly geoToleranceMetres: number | null;
  readonly capacity: number | null;
  readonly status: 'ACTIVE' | 'INACTIVE';
  readonly isPrimary: boolean;
}

/**
 * Row → response.
 *
 * `tenant_id` is not in `BranchRow` at all, rather than present and dropped here. A field a
 * mapper has to remember not to copy is a field somebody eventually copies; one the row never
 * carries cannot leak (`BR-DAT-06`).
 */
export function toBranchResponse(row: BranchRow): BranchResponse {
  return {
    id: row.id,
    gym_id: row.gymId,
    name: row.name,
    address_line1: row.addressLine1,
    address_line2: row.addressLine2,
    city_id: row.cityId,
    locality_id: row.localityId,
    state: row.state,
    state_code: row.stateCode,
    postal_code: row.postalCode,
    country_code: row.countryCode,
    location: { lat: row.lat, lng: row.lng },
    geo_tolerance_metres: row.geoToleranceMetres,
    capacity: row.capacity,
    status: row.status,
    is_primary: row.isPrimary,
  };
}

/**
 * The PostGIS argument order, as DATA rather than as a SQL string.
 *
 * ┌─ WHY THIS RETURNS A TUPLE AND NOT A FRAGMENT ────────────────────────────────────────────────┐
 * │ The convenient shape is a string:                                                             │
 * │   `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`                                  │
 * │ — and it is an injection site the moment either value arrives from a request, which both      │
 * │ always do. `NFR-SEC-05` and the constitution's parameterisation rule are not negotiable for   │
 * │ a geography any more than for a name.                                                          │
 * │                                                                                              │
 * │ So the caller writes the literal fragment with placeholders and passes these two numbers in   │
 * │ order:                                                                                        │
 * │   `ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography`  with  ...postGisPoint(location)         │
 * │                                                                                              │
 * │ The tuple is `[lng, lat]`. The name says so, the type says so, and spreading it into a        │
 * │ parameter list puts them in the order PostGIS wants without any call site restating it.        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function postGisPoint(location: {
  readonly lat: number;
  readonly lng: number;
}): readonly [longitude: number, latitude: number] {
  return [location.lng, location.lat];
}

/**
 * Is this coordinate inside India's bounding box?
 *
 * Not validation — `Gym.md` §12.2 already bounds lat/lng globally, and a gym outside India is a
 * second-market problem rather than a malformed request. This exists so a SWAP is catchable: the
 * box is 6–37 N by 68–98 E, and no Indian coordinate survives being transposed into it. `OQ-01`
 * fixes India as the launch country, so during Phase 1 a false answer here means the two numbers
 * changed places somewhere between the request and the row.
 *
 * Used by the integration tests rather than by the write path, because refusing a save on it
 * would block a legitimate second market on a rule nobody agreed to.
 */
export function looksLikeIndia(location: { readonly lat: number; readonly lng: number }): boolean {
  return location.lat > 6 && location.lat < 37 && location.lng > 68 && location.lng < 98;
}
