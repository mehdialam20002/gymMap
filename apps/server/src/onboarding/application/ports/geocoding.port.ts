/**
 * `M-030` · Turning a typed address into a point — `BR-GYM-08`, `DEP-02`, `§4.5` ACL.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * NO GEOCODER IS APPROVED, AND FOR THIS ONE CHECK THAT IS NOT A GAP
 *
 * `STACK_ADDITIONS.md` holds no maps or geocoding row of any status. Normally that would make the
 * work unbuildable, as it did for the KYC scanner (`KL-104`).
 *
 * Here the specification already says what to do about it. `AC-8`: *"A geocoder outage yields
 * `outcome: ERROR` with the reason recorded, **never** a `PASS` and never a blocked submission; the
 * reviewer sees 'could not be checked', which is a different statement from 'checked and fine'."*
 *
 * An unbound adapter is a permanent outage, and the specified behaviour under outage is exactly
 * what this milestone must implement anyway. So the check is complete and correct today: it reports
 * `ERROR`, the submission proceeds, and the reviewer is told the truth. When a provider is approved
 * the adapter binds behind this port and the check starts returning `PASS`/`FLAG` without a line
 * changing in `geo-distance.check.ts`.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** WGS 84, the coordinate system `geography(Point,4326)` uses throughout this schema. */
export interface Point {
  readonly latitude: number;
  readonly longitude: number;
}

export type GeocodeResult =
  | { readonly ok: true; readonly point: Point; readonly confidence: number }
  | { readonly ok: false; readonly failure: 'UNAVAILABLE' | 'NOT_FOUND'; readonly detail: string };

export interface GeocodingPort {
  /**
   * @param address the typed address, already normalised by `address.normaliser.ts`.
   *
   * `NOT_FOUND` and `UNAVAILABLE` are separate because they mean different things to the reviewer:
   * the first says the address may be wrong, the second says nothing about the address at all.
   * Both produce `ERROR` on the pre-check — neither is ever a `PASS`.
   */
  geocode(address: string): Promise<GeocodeResult>;
}

export const GEOCODING_PORT = Symbol('GEOCODING_PORT');

/**
 * Great-circle distance in metres.
 *
 * ┌─ WHY THIS IS HERE AND NOT LEFT TO POSTGIS ───────────────────────────────────────────────────┐
 * │ `ST_Distance` on `geography` is the right tool when both points are already IN the database. │
 * │ Here one of them has just come back from a geocoder over HTTP, so using PostGIS would mean a │
 * │ round trip per submission to compare two numbers this repository already holds in memory.     │
 * │                                                                                              │
 * │ Haversine on a spherical earth is accurate to about 0.5% — at the tolerances this check uses │
 * │ (hundreds of metres) that is metres of error against a threshold measured in kilometres, and │
 * │ the check flags for a human either way.                                                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function distanceMetres(a: Point, b: Point): number {
  const EARTH_RADIUS_M = 6_371_008.8;
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}
