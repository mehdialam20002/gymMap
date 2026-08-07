/**
 * Indian lakh/crore digit grouping — `LAUNCH_MARKET_INDIA.md` §2, `AC-FND-06.4`, `AC-EP01-13`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * `₹2,50,000` — NOT `₹250,000`. THIS IS A TRUST REQUIREMENT, NOT A NICETY.
 *
 * `LAUNCH_MARKET_INDIA.md` says it plainly: *"A gym owner reading `₹250,000` where they expect
 * `₹2,50,000` will distrust the figure."* They will not file a bug; they will assume the number
 * is wrong and stop using the dashboard for money.
 *
 * The grouping is: the LAST THREE digits, then TWO at a time.
 *
 *     1,000            one thousand
 *     10,000           ten thousand
 *     1,00,000         one lakh          — the western form would be 100,000
 *     10,00,000        ten lakh
 *     1,00,00,000      one crore         — the western form would be 10,000,000
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ ONE FORMATTER, AND `Intl` IS NOT IT ───────────────────────────────────────────────────────┐
 * │ `Intl.NumberFormat('en-IN')` groups correctly and takes a `number`, which puts a float in    │
 * │ the money path — the one thing `BR-PAY-01` forbids. Above 2^53 minor units it also silently  │
 * │ loses digits, and it varies by ICU build, so the same amount can render differently on two   │
 * │ Node versions.                                                                                │
 * │                                                                                              │
 * │ So the grouping is done on the DIGIT STRING of a `bigint`. No division, no float, no ICU.    │
 * │ `FolderStructure.md` §10 keeps it here and out of `packages/ui`: the PDF renderer is not     │
 * │ React, and a second implementation for it would diverge from this one.                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/**
 * Groups a digit string in the Indian style. Input is digits only — no sign, no separator.
 *
 * Exported because the formatter is not the only consumer: a chart axis and a CSV export both
 * need the grouping without the currency symbol, and re-implementing it there is how the two
 * forms drift.
 */
export function groupIndianDigits(digits: string): string {
  if (!/^\d+$/.test(digits)) {
    throw new TypeError(`groupIndianDigits expects digits only, received "${digits}"`);
  }
  if (digits.length <= 3) return digits;

  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);

  // Two at a time, from the right. The regex inserts a comma before every pair that is preceded
  // by another digit, which is what produces `1,00,00` rather than `10,000,0`.
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');

  return `${grouped},${lastThree}`;
}

export interface IndianAmountParts {
  /** `'-'` for a negative amount, `''` otherwise. Never `'+'`. */
  readonly sign: string;
  /** The whole-rupee part, grouped: `2,50,000`. */
  readonly major: string;
  /** The paise, always two digits: `00`, `05`, `50`. */
  readonly minor: string;
}

/**
 * Splits a paise amount into its printable parts.
 *
 * Returns the parts rather than a string so a caller can lay them out — the check-in desk sets
 * the paise at a smaller size, and a settlement statement aligns on the decimal point. A
 * formatter that only ever returns one string forces those callers to re-parse it.
 *
 * @param minorExponent 2 for INR (100 paise to the rupee). Parameterised rather than hardcoded
 *   because `currency.ts` already carries the table, and a second market with a 3-digit or
 *   0-digit minor unit must not require editing this function.
 */
export function indianAmountParts(minorUnits: bigint, minorExponent = 2): IndianAmountParts {
  if (!Number.isInteger(minorExponent) || minorExponent < 0 || minorExponent > 4) {
    throw new RangeError(`indianAmountParts: minorExponent must be 0-4, got ${minorExponent}`);
  }

  const negative = minorUnits < 0n;
  const magnitude = negative ? -minorUnits : minorUnits;

  const divisor = 10n ** BigInt(minorExponent);
  const major = magnitude / divisor;
  const minor = magnitude % divisor;

  return {
    sign: negative ? '-' : '',
    major: groupIndianDigits(major.toString()),
    // Padded, because 5 paise is `05` and rendering it as `5` reads as fifty.
    minor: minorExponent === 0 ? '' : minor.toString().padStart(minorExponent, '0'),
  };
}

/**
 * `₹2,50,000.00` from 25,000,000 paise.
 *
 * The sign goes BEFORE the symbol — `-₹500.00`, not `₹-500.00`. §8.3 fixes it, and the reason is
 * that a refund line in a statement is scanned by its leading character; a minus buried after
 * the symbol is missed at a glance.
 */
export function formatIndianRupees(minorUnits: bigint, options: { symbol?: boolean } = {}): string {
  const { sign, major, minor } = indianAmountParts(minorUnits, 2);
  const symbol = options.symbol === false ? '' : '₹';
  return `${sign}${symbol}${major}.${minor}`;
}
