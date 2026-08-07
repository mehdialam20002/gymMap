/**
 * The financial year — `FR-INV-02`, `LAUNCH_MARKET_INDIA.md` §5, `AC-FND-13.2`.
 *
 * ┌─ THE START MONTH IS A PARAMETER. IT COMES FROM THE TAX PROFILE, NEVER A CONSTANT. ──────────┐
 * │ India's financial year runs 1 April to 31 March, and `FY 2026-27` means April 2026 to March │
 * │ 2027. Hardcoding `4` would work perfectly and be wrong the moment a second market exists —  │
 * │ and wrong in the worst possible place, because the FY determines the invoice number series  │
 * │ (`FR-INV-02`), which must be GAPLESS. An invoice numbered into the wrong year cannot be     │
 * │ renumbered; the correction is a credit note and a new invoice.                               │
 * │                                                                                              │
 * │ `LAUNCH_MARKET_INDIA.md` §5 makes it configuration: `fy_start_month` lives on the tax        │
 * │ profile that `SCR-ADM-011` edits.                                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The other half of the trap is timezone. The FY rolls at LOCAL midnight on 1 April, which for
 * India is 18:30 UTC on 31 March. An invoice raised at 18:45 UTC on 31 March belongs to the NEW
 * financial year, and a UTC-based comparison puts it in the old one — off by a year, in a
 * gapless series, on a document a tax authority reads.
 */

import {
  ianaTimeZone,
  isoDateIn,
  localMidnightUtc,
  type IanaTimeZone,
} from './local-midnight-utc.js';

/** India. The value a tax profile is seeded with, not a value code may assume. */
export const INDIA_FY_START_MONTH = 4;

export interface FinancialYear {
  /** The calendar year the FY starts in. `FY 2026-27` → 2026. */
  readonly startYear: number;
  /** The UTC instant the FY begins — local midnight on the first of the start month. */
  readonly startsAt: Date;
  /** Exclusive. The UTC instant the NEXT financial year begins. */
  readonly endsAt: Date;
  /** `2026-27` for a year that spans two calendar years; `2026` when the FY is the calendar year. */
  readonly label: string;
}

export class InvalidFyStartMonthError extends RangeError {
  constructor(month: unknown) {
    super(
      `The financial-year start month must be an integer 1-12, received ${String(month)}. It ` +
        'comes from the tax profile (LAUNCH_MARKET_INDIA.md §5) — India is 4 — and it is never ' +
        'a constant in code, because it determines the gapless invoice series of FR-INV-02.',
    );
    this.name = 'InvalidFyStartMonthError';
  }
}

/**
 * The financial year containing `instant`.
 *
 * @param startMonth 1-12, from the tax profile. India is 4.
 * @param zone The gym's IANA zone. Required — the FY rolls at LOCAL midnight, and using UTC puts
 *   every invoice raised between 18:30 and 24:00 IST on 31 March into the wrong year.
 */
export function financialYearOf(
  instant: Date,
  startMonth: number,
  zone: IanaTimeZone,
): FinancialYear {
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) {
    throw new InvalidFyStartMonthError(startMonth);
  }

  // The LOCAL date, not the UTC one. This is the line the whole file exists for.
  const localDate = isoDateIn(instant, zone);
  const [year, month] = localDate.split('-').map(Number) as [number, number];

  const startYear = month >= startMonth ? year : year - 1;
  return financialYear(startYear, startMonth, zone);
}

/** The financial year beginning in `startYear`. */
export function financialYear(
  startYear: number,
  startMonth: number,
  zone: IanaTimeZone,
): FinancialYear {
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) {
    throw new InvalidFyStartMonthError(startMonth);
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const startsAt = localMidnightUtc(`${startYear}-${pad(startMonth)}-01`, zone);
  const endsAt = localMidnightUtc(`${startYear + 1}-${pad(startMonth)}-01`, zone);

  // `2026-27` when the year spans two calendar years, plain `2026` when it does not. A January
  // start means the FY IS the calendar year, and labelling that `2026-27` would be wrong on
  // every invoice.
  const label = startMonth === 1 ? String(startYear) : `${startYear}-${pad((startYear + 1) % 100)}`;

  return { startYear, startsAt, endsAt, label };
}

/**
 * The financial year for India, at the given zone.
 *
 * A named convenience, NOT a default parameter. The call site still says "India" out loud, so a
 * second market's code cannot reach it by omitting an argument.
 */
export function indianFinancialYearOf(instant: Date, zone = ianaTimeZone('Asia/Kolkata')) {
  return financialYearOf(instant, INDIA_FY_START_MONTH, zone);
}
