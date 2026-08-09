/**
 * `M-030` · Finding an approved gym at or near an address — `BR-GYM-09`, `E2.9`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE TABLES THIS QUERIES DO NOT EXIST YET
 *
 * The probe reads `gyms` and `branches` — `branches.location` is the `geography(Point,4326)` the
 * `ST_DWithin` radius search runs against, and `Schema.md` §5.2 names `gix_branches__location` as
 * the index serving it. Both tables arrive with **M-031**.
 *
 * M-030's own dependency list names M-013, M-014, M-016, M-018, M-023, M-026, M-027, M-028 and
 * M-029 — not M-031. That is an ordering defect in the roadmap rather than something to work
 * around: the duplicate-address check cannot search a catalogue that has not been built.
 *
 * So the port is defined and the bound adapter answers `UNAVAILABLE`, which the check turns into
 * `ERROR` — "could not be checked", which is true. A stub returning "no duplicates found" would be
 * the `AC-8` coercion in a different costume: it would tell a reviewer the address is clear when
 * nothing looked. Recorded as `KL-109`.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { Point } from './geocoding.port.js';

export interface DuplicateAddressQuery {
  readonly normalisedAddress: string;
  readonly point: Point;
  readonly radiusMetres: number;
}

export interface AddressMatch {
  readonly gymId: string;
  /** The stored normalised address, so the caller can tell an exact match from a proximate one. */
  readonly normalisedAddress: string;
  readonly distanceMetres: number;
}

export type DuplicateAddressOutcome =
  | { readonly ok: true; readonly matches: readonly AddressMatch[] }
  | { readonly ok: false; readonly failure: 'UNAVAILABLE'; readonly detail: string };

export interface DuplicateAddressProbe {
  /**
   * Approved gyms whose normalised address matches, OR whose primary branch falls inside the
   * radius. The union is deliberate: an address typed differently enough to defeat the normaliser
   * is still caught by geography, and a gym whose pin is wrong is still caught by the string.
   *
   * ┌─ THIS IS A CROSS-TENANT READ ────────────────────────────────────────────────────────────┐
   * │ It asks about OTHER tenants' gyms by definition — that is the whole question. The adapter │
   * │ must therefore run it through `runElevated()` with a stated reason, like the two           │
   * │ duplicate-identifier checks, so each execution leaves an audit row. A repository reaching  │
   * │ across tenants without elevation fails the isolation suite (`PE-T2`).                       │
   * └──────────────────────────────────────────────────────────────────────────────────────────┘
   */
  findApprovedNear(query: DuplicateAddressQuery): Promise<DuplicateAddressOutcome>;
}

export const DUPLICATE_ADDRESS_PROBE = Symbol('DUPLICATE_ADDRESS_PROBE');
