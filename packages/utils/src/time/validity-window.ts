/**
 * Membership validity windows — `BR-MEM-01`, `AC-FND-13.2`, `TR-07`.
 *
 * ┌─ HALF-OPEN, ALWAYS: `[startsAt, endsAt)` ───────────────────────────────────────────────────┐
 * │ The end is EXCLUSIVE. A one-month membership starting 1 April ends at local midnight on     │
 * │ 1 May, and 1 May is not a valid day.                                                         │
 * │                                                                                              │
 * │ The alternative — an inclusive end at 23:59:59 — is wrong twice. It excludes the last        │
 * │ second of the day, so a member scanning at 23:59:59.500 is refused; and consecutive windows │
 * │ either overlap by a second or leave a one-second gap, which on a renewal means a check-in    │
 * │ that matches no membership at all.                                                            │
 * │                                                                                              │
 * │ Half-open windows tile exactly. `[a, b)` and `[b, c)` share the instant `b` between them     │
 * │ with no overlap and no gap, which is the property a renewal needs.                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { isoDateIn, localMidnightUtc, type IanaTimeZone } from './local-midnight-utc.js';

export interface ValidityWindow {
  /** Inclusive. */
  readonly startsAt: Date;
  /** EXCLUSIVE. */
  readonly endsAt: Date;
}

export class InvalidWindowError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidWindowError';
  }
}

/**
 * `startsAt <= instant < endsAt`.
 *
 * The comparison is on the instant, not on a local date, because a membership's boundaries were
 * already resolved to UTC when it was created — re-deriving them from a local date here would
 * apply today's timezone rules to a window created under yesterday's.
 */
export function isWithin(instant: Date, window: ValidityWindow): boolean {
  const t = instant.getTime();
  return t >= window.startsAt.getTime() && t < window.endsAt.getTime();
}

/**
 * A window of `months` whole calendar months from local midnight on `startDate`.
 *
 * ┌─ CALENDAR MONTHS, NOT 30-DAY BLOCKS ────────────────────────────────────────────────────────┐
 * │ A one-month membership bought on 31 January ends on 28 February (or 29), not on 2 March.    │
 * │ `BR-MEM-01` says a month is a calendar month, and a member who bought on the 31st and was   │
 * │ charged again on 2 March would be right to complain.                                         │
 * │                                                                                              │
 * │ Clamping to the end of a short month is the standard resolution and the one used here:      │
 * │ 31 Jan + 1 month = 28 Feb. It is not perfectly reversible — 28 Feb - 1 month is 28 Jan —     │
 * │ and no scheme is, so the rule is written down rather than being an emergent property of     │
 * │ whichever date library was installed.                                                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function monthlyWindow(
  startDate: string,
  months: number,
  zone: IanaTimeZone,
): ValidityWindow {
  if (!Number.isInteger(months) || months <= 0) {
    throw new InvalidWindowError(`monthlyWindow: months must be a positive integer, got ${months}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw new InvalidWindowError(`monthlyWindow expects YYYY-MM-DD, received "${startDate}"`);
  }

  const [year, month, day] = startDate.split('-').map(Number) as [number, number, number];

  const totalMonths = month - 1 + months;
  const endYear = year + Math.floor(totalMonths / 12);
  const endMonth = (totalMonths % 12) + 1;

  // Clamp to the last day of the target month. `new Date(y, m, 0)` gives the last day of month
  // `m` — the 0th day of the next one — which is the only concise way to get it right for
  // February in a leap year without a table.
  const lastDayOfEndMonth = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();
  const endDay = Math.min(day, lastDayOfEndMonth);

  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    startsAt: localMidnightUtc(startDate, zone),
    endsAt: localMidnightUtc(`${endYear}-${pad(endMonth)}-${pad(endDay)}`, zone),
  };
}

/** A window of `days`, from local midnight to local midnight. */
export function dailyWindow(startDate: string, days: number, zone: IanaTimeZone): ValidityWindow {
  if (!Number.isInteger(days) || days <= 0) {
    throw new InvalidWindowError(`dailyWindow: days must be a positive integer, got ${days}`);
  }
  const startsAt = localMidnightUtc(startDate, zone);

  // Derive the END DATE and ask for its local midnight, rather than adding `days * 24h` to the
  // start. A day containing a DST transition is 23 or 25 hours long, so the arithmetic form
  // drifts by an hour per transition and eventually lands on the wrong calendar day.
  const approximate = new Date(startsAt.getTime() + days * 86_400_000 + 12 * 3_600_000);
  return { startsAt, endsAt: localMidnightUtc(isoDateIn(approximate, zone), zone) };
}

/**
 * Extends a window by `months`, from its existing END.
 *
 * A renewal continues from where the previous window finished, NOT from today. Renewing three
 * days early must not cost the member three days — and renewing three days late must not
 * silently grant them back, which is a decision `BR-MEM-01` makes elsewhere and this function
 * must not pre-empt.
 */
export function extendMonthly(
  window: ValidityWindow,
  months: number,
  zone: IanaTimeZone,
): ValidityWindow {
  const fromDate = isoDateIn(window.endsAt, zone);
  const extended = monthlyWindow(fromDate, months, zone);
  return { startsAt: window.startsAt, endsAt: extended.endsAt };
}

/** True when two windows share any instant. Used to refuse overlapping memberships. */
export function overlaps(a: ValidityWindow, b: ValidityWindow): boolean {
  // Half-open, so windows that merely touch — a's end equals b's start — do NOT overlap. That
  // is the renewal case, and reporting it as an overlap would refuse every renewal.
  return a.startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < a.endsAt.getTime();
}
