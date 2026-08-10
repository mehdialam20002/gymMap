/**
 * `M-031` · `GYM_TIMEZONE_PORT` — the zone `BR-MEM-03` computes a membership's validity in.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * IT IS THE GYM'S TIMEZONE, NOT THE MEMBER'S AND NOT THE CITY'S
 *
 * `BR-MEM-03`: *"A membership's validity is `[start_date, end_date]` inclusive, computed in the
 * **gym's** timezone, not the member's."* `BusinessRules.md` §6 opens the family with the physical
 * consequence: under `Asia/Kolkata` (+05:30, no DST) midnight gym-time is **18:30 UTC the previous
 * day**, so a membership that expires "on the 31st" expires at 18:30 UTC on the 30th.
 *
 * ┌─ `cities.timezone` IS NOT THIS, AND THE COLUMN SAYS SO ──────────────────────────────────────┐
 * │ `Schema.md` §12.1 marks it *"Presentation default; **never authoritative** — the tenant's     │
 * │ timezone is"*, and `TM3` is the rule. The distinction is not pedantry: a gym in Bengaluru run │
 * │ by a tenant configured for a different zone would have its membership boundaries computed     │
 * │ from the city if a reader reached for the nearest available field, and the error would be a   │
 * │ few hours — invisible in every test and visible only as a member refused entry on their last  │
 * │ day.                                                                                           │
 * │                                                                                                │
 * │ So the adapter reads `tenants.timezone`, and this comment exists because `cities.timezone` is │
 * │ one join away and looks like the obvious answer.                                               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY `memberships/` GETS A PORT AND NOT A QUERY ─────────────────────────────────────────────┐
 * │ `catalog/README.md` §4 lists this as one of six ports on `index.ts`, consumed by             │
 * │ `memberships/`. `R2` and the module boundary are why: `memberships/` may not read `gyms` or   │
 * │ `tenants` directly, and a port is what lets `catalog/` change where the zone lives — it is    │
 * │ denormalised onto `tenants` today and may move — without touching the consumer.               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * An IANA zone name, as the `iana_timezone` domain constrains it: `Area/Location`.
 *
 * A branded alias rather than a bare `string`, so a caller cannot pass `'+05:30'` — a fixed offset
 * is not a timezone, and the difference is invisible until the first market with DST.
 */
export type IanaTimezone = string & { readonly __brand: 'IanaTimezone' };

/** The `iana_timezone` domain's own pattern, so the type guard and the column agree. */
const IANA_SHAPE = /^[A-Za-z_]+\/[A-Za-z_+\-0-9/]+$/;

export function ianaTimezone(raw: string): IanaTimezone {
  if (!IANA_SHAPE.test(raw)) {
    throw new TypeError(
      `"${raw}" is not an IANA zone name. A fixed offset such as "+05:30" is not a timezone: it ` +
        `cannot express a DST transition, and Asia/Kolkata having none today is a property of ` +
        `India rather than of the model.`,
    );
  }
  return raw as IanaTimezone;
}

export type GymTimezoneOutcome =
  | { readonly ok: true; readonly timezone: IanaTimezone }
  /**
   * The gym does not exist, or is not visible in the caller's tenant scope.
   *
   * One outcome for both, deliberately — `A1`: a cross-tenant id must be indistinguishable from a
   * nonexistent one, or the answer becomes an existence oracle for other tenants' gyms.
   */
  | { readonly ok: false; readonly reason: 'UNKNOWN_GYM' };

export interface GymTimezonePort {
  /**
   * The zone this gym's day boundaries are computed in.
   *
   * No tenant id parameter — §11.5 `BR5` and `gymmap/no-tenant-id-parameter`. The tenant comes
   * from the request context and RLS enforces it; a parameter here would be a knob whose only
   * guard is the backstop.
   */
  timezoneFor(gymId: string): Promise<GymTimezoneOutcome>;
}

export const GYM_TIMEZONE_PORT = Symbol('GYM_TIMEZONE_PORT');
