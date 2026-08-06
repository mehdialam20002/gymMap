/**
 * M-003 · Time contracts — constitution §9.5, LAUNCH_MARKET_INDIA.md §3.
 *
 * Three distinct things get called "a date" in this system and conflating any two is a defect
 * class of its own:
 *
 *   IsoInstant  — a moment on the global timeline, always UTC, always with an offset.
 *                 Payments, audit rows, token expiry. Comparable across tenants.
 *   IsoDate     — a calendar day with NO time and NO zone. A membership end date is the 31st
 *                 in the gym's local calendar; converting it to an instant picks a moment,
 *                 and picking the wrong one expires a membership a day early for someone.
 *   IanaTimeZone— the zone that turns one into the other. Stored per branch, never assumed.
 *
 * India specifics that make this non-theoretical: `Asia/Kolkata` is UTC+05:30 with NO daylight
 * saving, so the local day boundary is 18:30 UTC the previous day. A job scheduled at "midnight
 * UTC" runs at 05:30 local — five and a half hours into the business day. The financial year
 * rolls at 18:30 UTC on 31 March, which is why `MigrationStrategy.md` carries a freeze window
 * around it.
 */

import type { Brand } from './ids/branded.js';

/** An IANA tz database identifier, e.g. `Asia/Kolkata`. Never a fixed offset, never an abbreviation. */
export type IanaTimeZone = Brand<string, 'IanaTimeZone'>;

/** A calendar date with no time and no zone: `YYYY-MM-DD`. */
export type IsoDate = Brand<string, 'IsoDate'>;

/** An instant in UTC: `YYYY-MM-DDTHH:mm:ss(.sss)Z`. */
export type IsoInstant = Brand<string, 'IsoInstant'>;

/** The launch market's zone. UTC+05:30, no DST (`LAUNCH_MARKET_INDIA.md` §3). */
export const DEFAULT_TIME_ZONE = 'Asia/Kolkata' as IanaTimeZone;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

export class InvalidTemporalError extends Error {
  readonly code = 'VALIDATION_FAILED' as const;

  constructor(kind: string, expected: string, raw: unknown) {
    super(`Invalid ${kind}: expected ${expected}, received ${JSON.stringify(raw)}`);
    this.name = 'InvalidTemporalError';
  }
}

/**
 * §9.5 B2 — validates shape AND that the date exists.
 *
 * The regex alone accepts `2026-02-31`. A membership ending on a day the calendar does not
 * have is a row that no renewal job will ever match.
 */
export function isoDate(raw: string): IsoDate {
  if (!ISO_DATE.test(raw)) throw new InvalidTemporalError('IsoDate', 'YYYY-MM-DD', raw);
  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
    throw new InvalidTemporalError('IsoDate', 'an existing calendar date', raw);
  }
  return raw as IsoDate;
}

/** §9.5 B2 — a UTC instant. A trailing offset other than `Z` is rejected, not normalised. */
export function isoInstant(raw: string): IsoInstant {
  if (!ISO_INSTANT.test(raw)) {
    throw new InvalidTemporalError('IsoInstant', 'YYYY-MM-DDTHH:mm:ssZ (UTC)', raw);
  }
  if (Number.isNaN(new Date(raw).getTime())) {
    throw new InvalidTemporalError('IsoInstant', 'an existing instant', raw);
  }
  return raw as IsoInstant;
}

/**
 * §9.5 B2 — validated against the runtime's own tz database rather than a hardcoded list.
 *
 * `Intl.supportedValuesOf('timeZone')` would be the tidier check but omits deprecated aliases
 * such as `Asia/Calcutta`, which real imported data still carries. Constructing a formatter
 * accepts anything ICU can actually resolve, which is the property we need.
 */
export function ianaTimeZone(raw: string): IanaTimeZone {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: raw });
  } catch {
    throw new InvalidTemporalError('IanaTimeZone', 'an IANA tz database identifier', raw);
  }
  return raw as IanaTimeZone;
}
