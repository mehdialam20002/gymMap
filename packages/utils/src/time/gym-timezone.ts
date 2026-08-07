/**
 * Business-day computation given an EXPLICIT zone — `AC-FND-13.2`, `TR-07`, `TR-24`.
 *
 * Every function takes an `IanaTimeZone`. There is no default parameter anywhere in this file,
 * and adding one would be the defect: a default resolves to the SERVER's zone, which is UTC in a
 * container and the developer's zone on a laptop. The same code then produces different business
 * days in the two places, and the difference surfaces as a membership expiring a day early for a
 * real member.
 */

import {
  ianaTimeZone,
  isoDateIn,
  localDayEndUtc,
  localMidnightUtc,
  offsetMinutes,
  type IanaTimeZone,
} from './local-midnight-utc.js';

export { ianaTimeZone, isoDateIn, localDayEndUtc, localMidnightUtc, offsetMinutes };
export type { IanaTimeZone };

/** The three seed zones, chosen so a wrong assumption fails a test rather than a customer. */
export const SEED_ZONES = {
  /** The launch market. UTC+05:30, no DST. */
  kolkata: 'Asia/Kolkata',
  /** SAME offset as Kolkata, different zone — catches code that compares offsets, not zones. */
  colombo: 'Asia/Colombo',
  /** +05:45 — catches anything assuming an offset is a whole number of hours. */
  kathmandu: 'Asia/Kathmandu',
} as const;

/** The local business day at `instant`, as `YYYY-MM-DD`. */
export function businessDay(instant: Date, zone: IanaTimeZone): string {
  return isoDateIn(instant, zone);
}

/** `[start, end)` in UTC for the local business day containing `instant`. */
export function businessDayBounds(
  instant: Date,
  zone: IanaTimeZone,
): { startsAt: Date; endsAt: Date } {
  const date = isoDateIn(instant, zone);
  return { startsAt: localMidnightUtc(date, zone), endsAt: localDayEndUtc(date, zone) };
}

/**
 * Whole local days between two instants.
 *
 * Counted on the local CALENDAR DATE, not by dividing a millisecond difference by 86,400,000.
 * The division is wrong across a DST transition, and wrong by a fraction for any zone whose
 * offset is not a whole number of hours — which includes India.
 */
export function daysBetween(from: Date, to: Date, zone: IanaTimeZone): number {
  const fromMidnight = localMidnightUtc(isoDateIn(from, zone), zone).getTime();
  const toMidnight = localMidnightUtc(isoDateIn(to, zone), zone).getTime();
  return Math.round((toMidnight - fromMidnight) / 86_400_000);
}

/**
 * The UTC instant at which a job scheduled for `localTime` next fires.
 *
 * `TR-24`. A "daily at 00:00" expiry sweep on a UTC cron fires at 05:30 local in India — five
 * and a half hours into the business day, after members have already been turned away at the
 * door by a membership the system still considered active. Every one of the 24 §C5 jobs has to
 * be scheduled through a function like this rather than through a UTC hour.
 */
export function nextLocalTimeUtc(after: Date, localTime: string, zone: IanaTimeZone): Date {
  const match = /^(\d{2}):(\d{2})$/.exec(localTime);
  if (!match) throw new TypeError(`nextLocalTimeUtc expects HH:MM, received "${localTime}"`);

  const [hours, minutes] = [Number(match[1]), Number(match[2])];
  if (hours > 23 || minutes > 59) {
    throw new RangeError(`nextLocalTimeUtc: "${localTime}" is not a valid time of day`);
  }

  const today = localMidnightUtc(isoDateIn(after, zone), zone);
  const candidate = new Date(today.getTime() + (hours * 60 + minutes) * 60_000);
  if (candidate.getTime() > after.getTime()) return candidate;

  // Already past today. Derive TOMORROW's local date and take its midnight, rather than adding
  // 24 hours — a day with a DST transition is not 24 hours long.
  const tomorrow = localMidnightUtc(
    isoDateIn(new Date(today.getTime() + 26 * 3_600_000), zone),
    zone,
  );
  return new Date(tomorrow.getTime() + (hours * 60 + minutes) * 60_000);
}
