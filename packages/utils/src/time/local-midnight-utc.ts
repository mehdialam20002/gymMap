/**
 * Local midnight, in UTC — `LAUNCH_MARKET_INDIA.md` §3, `TR-24`, `AC-FND-13.2`, `AC-FND-13.4`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * MIDNIGHT IN A BENGALURU GYM IS 18:30 UTC ON THE PREVIOUS DAY
 *
 * India is UTC+05:30 with no daylight saving. So the local day 2026-08-07 begins at
 * 2026-08-06T18:30:00Z and ends at 2026-08-07T18:29:59Z.
 *
 * `TR-24` is the trap this exists to prevent: a naive hourly UTC cron fires at the wrong local
 * moment for every one of the 24 `§C5` jobs. A "daily at midnight" expiry sweep running at
 * 00:00 UTC runs at 05:30 local — five and a half hours into the business day, after members
 * have already been turned away at the door by a membership the system still considered active.
 *
 * The half-hour offset is the second half of the trap. Code that assumes offsets are whole hours
 * is wrong by thirty minutes in India and by forty-five in Nepal, and the seed carries
 * `Asia/Kathmandu` (+05:45) specifically so that assumption fails a test rather than a customer.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ THE ZONE IS ALWAYS AN EXPLICIT ARGUMENT. THERE IS NO DEFAULT PARAMETER. ───────────────────┐
 * │ `AC-FND-13.2`. A default would be read from the server's own zone, which is UTC in a        │
 * │ container and the developer's zone on a laptop — so the same code produces different        │
 * │ business days in the two places, and the difference shows up as a membership expiring a day │
 * │ early for a real member.                                                                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/** An IANA zone identifier — `Asia/Kolkata`, never `IST` and never `+05:30`. */
export type IanaTimeZone = string & { readonly __ianaTimeZone: unique symbol };

export class InvalidTimeZoneError extends RangeError {
  constructor(zone: string) {
    super(
      `"${zone}" is not a valid IANA time zone. An abbreviation such as IST is ambiguous — it ` +
        'means Indian Standard Time, Irish Standard Time and Israel Standard Time — and a fixed ' +
        'offset like +05:30 cannot express a zone whose rules change.',
    );
    this.name = 'InvalidTimeZoneError';
  }
}

/**
 * Validates an IANA zone identifier.
 *
 * Asks the runtime rather than checking a list: the IANA database changes, and a hardcoded set
 * would reject a zone that is real and accept one that has been removed.
 */
export function ianaTimeZone(zone: string): IanaTimeZone {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
  } catch {
    throw new InvalidTimeZoneError(zone);
  }
  // `Intl` accepts an abbreviation like `UTC` but not `IST`; the explicit slash check keeps the
  // domain to real region/city identifiers, so nobody stores `EST` and gets a fixed offset that
  // silently ignores daylight saving.
  if (!zone.includes('/') && zone !== 'UTC') throw new InvalidTimeZoneError(zone);
  return zone as IanaTimeZone;
}

/**
 * The UTC offset of `zone` at `instant`, in minutes.
 *
 * Computed by formatting the instant IN the zone and reading the parts back, because there is no
 * API that returns an offset directly. `formatToParts` with `timeZoneName: 'longOffset'` would be
 * shorter and returns `GMT+05:30` in some ICU builds and `GMT+5:30` in others — a difference that
 * is invisible until a parse produces 5 minutes instead of 330.
 */
export function offsetMinutes(instant: Date, zone: IanaTimeZone): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const asUtc = Date.UTC(
    Number(parts['year']),
    Number(parts['month']) - 1,
    Number(parts['day']),
    Number(parts['hour']),
    Number(parts['minute']),
    Number(parts['second']),
  );

  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * The UTC instant at which the local day `isoDate` begins in `zone`.
 *
 * `localMidnightUtc('2026-08-07', 'Asia/Kolkata')` → `2026-08-06T18:30:00.000Z`.
 *
 * Two passes, and the second is not redundant. The offset can differ between the naive guess and
 * the real local midnight — in a zone that shifts its clocks AT midnight, the first guess lands
 * on the wrong side of the transition. India has no DST so one pass would be enough here, and
 * that is exactly why the second exists: the design must not DEPEND on India's lack of DST.
 */
export function localMidnightUtc(isoDate: string, zone: IanaTimeZone): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new TypeError(`localMidnightUtc expects YYYY-MM-DD, received "${isoDate}"`);
  }
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number];

  const naive = Date.UTC(year, month - 1, day, 0, 0, 0);
  const firstGuess = new Date(naive - offsetMinutes(new Date(naive), zone) * 60_000);
  const corrected = new Date(naive - offsetMinutes(firstGuess, zone) * 60_000);
  return corrected;
}

/** The UTC instant at which the local day ENDS — the start of the next day, exclusive. */
export function localDayEndUtc(isoDate: string, zone: IanaTimeZone): Date {
  const start = localMidnightUtc(isoDate, zone);
  // Add 26 hours and re-derive, rather than adding exactly 24. A day with a DST transition is 23
  // or 25 hours long, and `start + 24h` would land inside the same local day or skip past the
  // next one. Deriving the NEXT date and asking for its midnight is correct at every length.
  const nextDay = new Date(start.getTime() + 26 * 3_600_000);
  return localMidnightUtc(isoDateIn(nextDay, zone), zone);
}

/** The local calendar date at `instant` in `zone`, as `YYYY-MM-DD`. */
export function isoDateIn(instant: Date, zone: IanaTimeZone): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  return `${parts['year']}-${parts['month']}-${parts['day']}`;
}
