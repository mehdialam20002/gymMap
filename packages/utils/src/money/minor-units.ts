/**
 * Integer minor-unit arithmetic — `BR-PAY-01`, `NFR-DQ-02`, `AC-FND-06.1`.
 *
 * ┌─ EVERY VALUE HERE IS `bigint`. THERE IS NO `number` IN THIS FILE. ──────────────────────────┐
 * │ `0.1 + 0.2 !== 0.3` in IEEE 754, and a ledger built on that cannot balance. The invariant   │
 * │ is not "be careful with floats" — it is that a float never enters the money path at all,    │
 * │ which is why `no-float-money` is a lint failure rather than a review comment.                │
 * │                                                                                              │
 * │ `bigint` and not `number` even below 2^53: the boundary is not where the danger starts, it  │
 * │ is where the danger becomes VISIBLE. A `number` that happens to be exact today is a         │
 * │ `number` that stops being exact when the business grows, and nothing fails at the crossing. │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * For India the minor unit is **paise**: ₹1 = 100 paise (`LAUNCH_MARKET_INDIA.md` §2).
 */

import { roundHalfEven } from './round-half-even.js';

export function add(a: bigint, b: bigint): bigint {
  return a + b;
}

export function subtract(a: bigint, b: bigint): bigint {
  return a - b;
}

export function negate(value: bigint): bigint {
  return -value;
}

export function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

/** -1, 0 or 1. Returned as a number because it is an ordering, not an amount. */
export function compare(a: bigint, b: bigint): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function isZero(value: bigint): boolean {
  return value === 0n;
}

export function isNegative(value: bigint): boolean {
  return value < 0n;
}

/**
 * Multiplies by a count. Exact — no rounding is possible, so none happens.
 *
 * Separate from `multiplyByBps` on purpose: a caller multiplying by a whole number of sessions
 * must not go through a rounding function at all, because a rounder that is never asked to round
 * is a rounder somebody will eventually pass a fraction to.
 */
export function multiplyByCount(value: bigint, count: bigint): bigint {
  if (count < 0n) {
    throw new RangeError(
      `multiplyByCount: a negative count (${count}) is a sign error, not a refund. Use negate() ` +
        'for a reversal, so the intent is visible in the ledger.',
    );
  }
  return value * count;
}

export const BASIS_POINTS_DENOMINATOR = 10_000n;

/**
 * Applies a rate in basis points, rounding half to even.
 *
 * The multiplication happens BEFORE the division, always. `(value * bps) / 10000` and
 * `value * (bps / 10000)` differ: the second divides first, truncates to zero for any rate below
 * 100%, and returns 0 for every commission this platform charges.
 */
export function multiplyByBps(value: bigint, basisPoints: bigint): bigint {
  return roundHalfEven(value * basisPoints, BASIS_POINTS_DENOMINATOR);
}

export function sum(values: readonly bigint[]): bigint {
  return values.reduce((total, value) => total + value, 0n);
}

/**
 * Parses a minor-unit amount from the wire.
 *
 * ACCEPTS A STRING and refuses a `number` — `TR-38`, `AC-FND-06.6`. Above 2^53 paise (about
 * ₹90,071,992,547,409) a JSON number silently loses precision, and `JSON.parse` does the damage
 * before any validator sees the value. Refusing the type is the only place the loss can be
 * caught, because by the time it is a `number` the missing digits are already gone.
 *
 * ₹90 trillion sounds unreachable until it is a cumulative lifetime settlement total in paise.
 */
export function parseMinorUnits(raw: unknown): bigint {
  if (typeof raw === 'bigint') return raw;

  if (typeof raw === 'number') {
    throw new TypeError(
      'A monetary amount arrived as a JSON number. It must be a STRING (TR-38, BR-PAY-01): ' +
        'above 2^53 minor units a JSON number loses precision inside JSON.parse, before any ' +
        'validator can see it — so the digits are already gone by the time this is reached.',
    );
  }

  if (typeof raw !== 'string' || !/^-?\d+$/.test(raw)) {
    throw new TypeError(
      `A monetary amount must be a string of digits in MINOR units, optionally signed. ` +
        `Received ${typeof raw}. "12.50" is not valid either — the value is 1250 paise, and a ` +
        `decimal point in a minor-unit field means somebody has already divided by 100.`,
    );
  }

  return BigInt(raw);
}

/**
 * Renders a minor-unit amount for the wire. Always a string, never a number.
 *
 * The counterpart to `parseMinorUnits`, and the reason both exist: serialising a `bigint`
 * directly throws (`JSON.stringify` refuses `bigint`), so without this every response would need
 * an ad-hoc `.toString()` — and the one that gets forgotten becomes a 500 in production.
 */
export function formatMinorUnits(value: bigint): string {
  return value.toString();
}
