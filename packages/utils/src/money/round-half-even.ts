/**
 * `round_half_even` — the ONLY rounding in the money path. `A6.3`, `AC-FND-06.5`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY BANKER'S ROUNDING, AND WHY EXACTLY ONE IMPLEMENTATION
 *
 * `round_half_up` — the one everybody writes — is BIASED UPWARD. Over a settlement batch of ten
 * thousand commission lines, each rounding a half-paise, that bias accumulates in one direction
 * and the batch fails to balance. `KPI-26` sets settlement accuracy at 100%, which is
 * arithmetically unreachable with a biased rounder.
 *
 * Half-even breaks ties toward the EVEN neighbour, so the errors cancel over a large sample
 * instead of summing. That is not a preference; it is the property that makes the ledger close.
 *
 * And exactly one implementation, because rounding twice is worse than rounding wrong. A value
 * rounded in the service and rounded again in the formatter differs from the same value rounded
 * once, by one minor unit, in a way nobody can reproduce from a log.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Everything here is `bigint`. There is no `number` in this file and there must never be: a
 * float rounder would reintroduce the representation error the integer ledger exists to avoid.
 */

/**
 * Divides `numerator` by `denominator`, rounding half to even.
 *
 * Both are `bigint`, and the result is `bigint`. This is the primitive every other money
 * operation that must divide goes through — `multiplyByBps`, percentage splits, per-unit prices.
 *
 * @throws {RangeError} when `denominator` is zero. A division by zero in the money path is a
 *   programming error, and returning 0 or Infinity would put a wrong number in a ledger.
 */
export function roundHalfEven(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new RangeError(
      'roundHalfEven: division by zero. In the money path this is a programming error — ' +
        'returning 0 would write a wrong figure to an append-only ledger, where it cannot be ' +
        'edited out (BR-FIN-01).',
    );
  }

  // Work in positive space and reapply the sign at the end. `bigint` division truncates toward
  // zero, so -7n / 2n is -3n rather than -4n — and the half-way case would then round in
  // opposite directions for positive and negative values of the same magnitude. A refund
  // computed that way differs from the charge it reverses by one paise, which is exactly the
  // class of defect R-11's parity suite exists to catch.
  const negative = numerator < 0n !== denominator < 0n;
  const absNumerator = numerator < 0n ? -numerator : numerator;
  const absDenominator = denominator < 0n ? -denominator : denominator;

  const quotient = absNumerator / absDenominator;
  const remainder = absNumerator % absDenominator;

  // `2 * remainder` versus the denominator avoids ever forming a fraction. Comparing
  // `remainder / denominator` to 0.5 would mean floating point, in the one function that must
  // not have any.
  const twiceRemainder = remainder * 2n;

  let rounded: bigint;
  if (twiceRemainder > absDenominator) {
    rounded = quotient + 1n;
  } else if (twiceRemainder < absDenominator) {
    rounded = quotient;
  } else {
    // Exactly half. Round to the EVEN neighbour — this is the whole point of the function.
    rounded = quotient % 2n === 0n ? quotient : quotient + 1n;
  }

  return negative ? -rounded : rounded;
}

/**
 * Half-even rounding of a value scaled by a power of ten.
 *
 * Used where a rate is expressed with more precision than the minor unit can hold — a
 * per-session price of ₹333.333 across three sessions, say. `scale` is the number of extra
 * decimal digits the numerator carries.
 */
export function roundScaledHalfEven(scaledValue: bigint, scale: number): bigint {
  if (!Number.isInteger(scale) || scale < 0) {
    throw new RangeError(`roundScaledHalfEven: scale must be a non-negative integer, got ${scale}`);
  }
  if (scale === 0) return scaledValue;
  return roundHalfEven(scaledValue, 10n ** BigInt(scale));
}
