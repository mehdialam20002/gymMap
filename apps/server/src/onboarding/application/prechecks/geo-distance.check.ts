/**
 * `M-030` · Does the typed address agree with the dropped pin? — `BR-GYM-08`, `E2.5`, `AC-8`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE CHECK THAT CATCHES A GYM LISTED WHERE IT IS NOT
 *
 * An applicant types an address and drags a pin. `BR-GYM-08` cares when the two disagree, because
 * a member who travels to the address on the listing and finds nothing there is the failure that
 * costs the platform its reason to exist — and because a deliberate mismatch is how a listing gets
 * placed in a high-traffic locality it is not in.
 *
 * ┌─ THE TOLERANCE IS CONFIGURATION, AND THE MILESTONE SAYS SO ──────────────────────────────────┐
 * │ Geocoders disagree with a hand-dropped pin by tens to low hundreds of metres routinely — a    │
 * │ rooftop centroid against a gate, a building against its plot. A hard-coded threshold would be │
 * │ tuned once by whoever wrote this line and then be wrong for every dense market.                │
 * │                                                                                              │
 * │ It is passed in rather than read here so a test can pin both sides of it, and so the eventual │
 * │ per-city value has somewhere to live.                                                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { distanceMetres, type GeocodingPort, type Point } from '../ports/geocoding.port.js';
import { errored, precheck, type PrecheckResult } from '../../domain/precheck-result.vo.js';

export interface GeoDistanceInput {
  /** The address as typed, already normalised. */
  readonly address: string;
  /** Where the applicant dropped the pin. */
  readonly pin: Point;
  /** Metres. Beyond this the two are treated as disagreeing. */
  readonly toleranceMetres: number;
}

export async function runGeoDistanceCheck(
  geocoder: GeocodingPort,
  input: GeoDistanceInput,
  ranAt: Date,
): Promise<PrecheckResult> {
  let result;
  try {
    result = await geocoder.geocode(input.address);
  } catch (error) {
    /*
     * A THROWN geocoder is an ERROR, never a PASS.
     *
     * This catch is the whole of `AC-8` in one place. The tempting shape — `catch { return PASS }`
     * — makes an outage indistinguishable from a verified address, and a reviewer reading a green
     * row approves faster because of it. The reason is recorded so the row says what happened.
     */
    return errored(
      'GEO_DISTANCE',
      `the geocoder threw: ${error instanceof Error ? error.message : String(error)}`,
      ranAt,
    );
  }

  if (!result.ok) {
    return errored('GEO_DISTANCE', `${result.failure} — ${result.detail}`, ranAt);
  }

  const metres = Math.round(distanceMetres(result.point, input.pin));
  const within = metres <= input.toleranceMetres;

  /*
   * The evidence carries the DISTANCE and the tolerance, not the two coordinate pairs.
   *
   * `BR-DAT-06` keeps location out of logs and analytics, and `redaction.ts` lists `lat`, `lng`
   * and `coordinates` for that reason. This object is persisted on `applications.precheck_results`
   * and rendered in the console, so it states the finding rather than the inputs — which is also
   * what the reviewer actually needs: "1.2 km apart, tolerance 300 m" is actionable, a pair of
   * decimals is not.
   */
  return precheck(
    'GEO_DISTANCE',
    within ? 'PASS' : 'FLAG',
    {
      distanceMetres: metres,
      toleranceMetres: input.toleranceMetres,
      confidence: result.confidence,
    },
    ranAt,
  );
}
