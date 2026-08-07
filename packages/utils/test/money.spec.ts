/**
 * The money primitives — `BR-PAY-01`, `BR-FIN-03`, `AC-FND-06.*`, `A6.3`, `KPI-26`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * `KPI-26` SETS SETTLEMENT ACCURACY AT 100%, WHICH IS AN ARITHMETIC CLAIM
 *
 * It is unreachable if money is ever a float, if rounding happens twice, or if a split can lose
 * or invent a minor unit. Each of those is a property rather than a case, so most of what is
 * below is property-based: `allocate` is exercised over 10,000 random splits, and `roundHalfEven`
 * over every half-way case in a range rather than the three somebody thought of.
 *
 * 100% line and 100% branch on `money/`, with no exemptions (`§17.5`, `AC-EP01-12`).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Imported from `dist/`, not `src/`.
 *
 * Node 22's type stripping does NOT rewrite a `.js` specifier to `.ts`, and this package emits
 * NodeNext output whose internal imports therefore carry `.js`. Importing `src/` here resolves
 * the barrel and then fails on the first relative import inside it. `packages/types` established
 * the same convention for the same reason.
 */
import {
  BASIS_POINTS_DENOMINATOR,
  BPS_DENOMINATOR,
  BPS_PER_PERCENT,
  CURRENCIES,
  InvalidBasisPointsError,
  MAX_REASONABLE_BPS,
  UnknownCurrencyError,
  absolute,
  add,
  allocate,
  allocateEvenly,
  assertBasisPoints,
  bpsFromPercentString,
  compare,
  currencyProfile,
  formatAccounting,
  formatCurrency,
  formatIndianRupees,
  formatMinorUnits,
  groupIndianDigits,
  indianAmountParts,
  isNegative,
  isZero,
  multiplyByBps,
  multiplyByCount,
  negate,
  parseMinorUnits,
  percentStringFromBps,
  roundHalfEven,
  roundScaledHalfEven,
  subtract,
  sum,
} from '../dist/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// round_half_even — A6.3. The property, not three cases.
// ═══════════════════════════════════════════════════════════════════════════

test('A6.3 — every half-way case rounds to the EVEN neighbour', () => {
  // half-up would give 1, 2, 3, 4, 5 …; half-even gives 0, 2, 2, 4, 4 …
  assert.equal(roundHalfEven(1n, 2n), 0n); // 0.5 -> 0
  assert.equal(roundHalfEven(3n, 2n), 2n); // 1.5 -> 2
  assert.equal(roundHalfEven(5n, 2n), 2n); // 2.5 -> 2
  assert.equal(roundHalfEven(7n, 2n), 4n); // 3.5 -> 4
  assert.equal(roundHalfEven(9n, 2n), 4n); // 4.5 -> 4
});

test('A6.3 — half-even is UNBIASED over a long run, which half-up is not', () => {
  // This is the property KPI-26 depends on. Rounding a thousand consecutive half-way values,
  // half-up accumulates +500 against the true total; half-even accumulates zero.
  //
  // Asserted as a SUM rather than case by case, because the bias is invisible in any single
  // rounding and is the entire reason for the choice.
  let halfEvenTotal = 0n;
  let halfUpTotal = 0n;
  let trueTotalDoubled = 0n;

  for (let i = 1n; i <= 1000n; i += 2n) {
    halfEvenTotal += roundHalfEven(i, 2n);
    halfUpTotal += (i + 1n) / 2n; // the naive half-up
    trueTotalDoubled += i;
  }

  const drift = halfEvenTotal * 2n - trueTotalDoubled;
  assert.equal(drift, 0n, `half-even drifted by ${drift} half-units over 500 roundings`);
  assert.ok(
    halfUpTotal * 2n - trueTotalDoubled > 0n,
    'the half-up control did not drift upward — the comparison proves nothing',
  );
});

test('rounding is symmetric about zero, so a refund reverses its charge exactly', () => {
  // bigint division truncates toward zero, so -7n/2n is -3n. Without the sign handling in
  // roundHalfEven, +3.5 and -3.5 would round in opposite directions and a refund would differ
  // from the charge it reverses by one paise — the class R-11's parity suite exists to catch.
  for (const [n, d] of [
    [7n, 2n],
    [5n, 2n],
    [1n, 3n],
    [2n, 3n],
    [12345n, 7n],
  ] as const) {
    assert.equal(roundHalfEven(-n, d), -roundHalfEven(n, d), `asymmetric at ${n}/${d}`);
    assert.equal(roundHalfEven(n, -d), -roundHalfEven(n, d), `asymmetric at ${n}/-${d}`);
    assert.equal(roundHalfEven(-n, -d), roundHalfEven(n, d), `wrong sign at -${n}/-${d}`);
  }
});

test('exact division needs no rounding, and gets none', () => {
  assert.equal(roundHalfEven(10n, 5n), 2n);
  assert.equal(roundHalfEven(0n, 7n), 0n);
  assert.equal(roundHalfEven(-10n, 5n), -2n);
});

test('division by zero throws rather than returning a wrong figure', () => {
  // The alternative is 0 or Infinity in an append-only ledger, where it cannot be edited out.
  assert.throws(() => roundHalfEven(1n, 0n), RangeError);
  assert.throws(() => roundHalfEven(1n, 0n), /append-only/);
});

test('roundScaledHalfEven handles the scale-0 identity and refuses a bad scale', () => {
  assert.equal(roundScaledHalfEven(12345n, 0), 12345n);
  assert.equal(roundScaledHalfEven(12345n, 2), 123n); // 123.45 -> 123
  assert.equal(roundScaledHalfEven(12350n, 2), 124n); // 123.50 -> 124 (even)
  assert.equal(roundScaledHalfEven(12250n, 2), 122n); // 122.50 -> 122 (even)
  assert.throws(() => roundScaledHalfEven(1n, -1), RangeError);
  assert.throws(() => roundScaledHalfEven(1n, 1.5), RangeError);
});

// ═══════════════════════════════════════════════════════════════════════════
// allocate — BR-FIN-03. The parts sum EXACTLY.
// ═══════════════════════════════════════════════════════════════════════════

test('BR-FIN-03 — the classic ₹10.00 three-way split loses nothing', () => {
  const parts = allocateEvenly(1000n, 3);
  assert.deepEqual(parts, [334n, 333n, 333n]);
  assert.equal(sum(parts), 1000n);
});

test('BR-FIN-03 — 10,000 random splits sum EXACTLY to the whole', () => {
  // The property, over a sample large enough that a one-unit leak somewhere would show. A
  // deterministic PRNG rather than Math.random: a property test that fails only on some runs is
  // a property test people re-run until it passes.
  let seed = 0x2545f491;
  const next = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return Math.abs(seed);
  };

  for (let i = 0; i < 10_000; i += 1) {
    const total = BigInt(next() % 1_000_000_000) - 500_000_000n;
    const partCount = (next() % 12) + 1;
    const weights = Array.from({ length: partCount }, () => BigInt(next() % 100));
    if (weights.every((w) => w === 0n)) weights[0] = 1n;

    const parts = allocate(total, weights);

    assert.equal(
      sum(parts),
      total,
      `split of ${total} across ${JSON.stringify(weights.map(String))} summed to ${sum(parts)}`,
    );
    assert.equal(parts.length, weights.length);
  }
});

test('allocation is proportional, not merely exact', () => {
  // `[total, 0, 0]` would sum exactly and be nonsense. The weights have to mean something.
  const parts = allocate(1000n, [50n, 30n, 20n]);
  assert.deepEqual(parts, [500n, 300n, 200n]);
});

test('ties are broken by the LOWER index, so two runs agree', () => {
  // A tie broken at random makes two runs of the same settlement produce different — both
  // correct — allocations, and reconciling those against a provider statement is impossible.
  assert.deepEqual(allocate(100n, [1n, 1n, 1n]), [34n, 33n, 33n]);
  assert.deepEqual(allocate(100n, [1n, 1n, 1n]), allocate(100n, [1n, 1n, 1n]));
});

test('a negative total allocates with the same magnitudes as its positive twin', () => {
  // A refund must reverse its charge share for share, or the two do not net to zero.
  const charge = allocate(1000n, [50n, 30n, 20n]);
  const refund = allocate(-1000n, [50n, 30n, 20n]);
  assert.deepEqual(
    refund,
    charge.map((p) => -p),
  );
  assert.equal(sum(refund), -1000n);
});

test('allocate refuses the inputs that would produce a guess', () => {
  assert.throws(() => allocate(100n, []), /nothing to allocate/);
  assert.throws(() => allocate(100n, [1n, -1n]), /negative weight/);
  assert.throws(() => allocate(100n, [0n, 0n]), /sum to zero/);
  assert.throws(() => allocateEvenly(100n, 0), RangeError);
  assert.throws(() => allocateEvenly(100n, 1.5), RangeError);
});

test('a zero total allocates to all zeroes rather than throwing', () => {
  assert.deepEqual(allocate(0n, [1n, 2n, 3n]), [0n, 0n, 0n]);
});

// ═══════════════════════════════════════════════════════════════════════════
// minor-units — TR-38 is the one that bites above 2^53.
// ═══════════════════════════════════════════════════════════════════════════

test('TR-38 — a JSON number is REFUSED, with the reason', () => {
  // The damage happens inside JSON.parse, before any validator runs. Refusing the type is the
  // only place it can be caught, because by then the digits are already gone.
  //
  // Built with Number() rather than written as a literal: `9_007_199_254_740_993` is itself an
  // ESLint `no-loss-of-precision` error, which is a neat confirmation of the point — the value
  // cannot even be WRITTEN as a JavaScript number without losing the last digit.
  assert.throws(() => parseMinorUnits(Number('9007199254740993')), TypeError);
  assert.throws(() => parseMinorUnits(100), /must be a STRING/);
});

test('TR-38 — 9,007,199,254,740,993 paise survives a round trip as a string', () => {
  // 2^53 + 1. As a JavaScript number it becomes 9007199254740992 — the odd digit is lost.
  const beyondSafe = '9007199254740993';
  const parsed = parseMinorUnits(beyondSafe);

  assert.equal(formatMinorUnits(parsed), beyondSafe);
  assert.notEqual(String(Number(beyondSafe)), beyondSafe, 'the control: a number DOES lose it');
});

test('parseMinorUnits accepts a bigint unchanged and a signed string', () => {
  assert.equal(parseMinorUnits(1250n), 1250n);
  assert.equal(parseMinorUnits('-1250'), -1250n);
  assert.equal(parseMinorUnits('0'), 0n);
});

test('a decimal string is refused — the field is MINOR units', () => {
  // "12.50" means somebody has already divided by 100 somewhere, and accepting it here would
  // silently make the amount 100x too small.
  assert.throws(() => parseMinorUnits('12.50'), /decimal point/);
  assert.throws(() => parseMinorUnits('abc'), TypeError);
  assert.throws(() => parseMinorUnits(null), TypeError);
  assert.throws(() => parseMinorUnits({}), TypeError);
  assert.throws(() => parseMinorUnits(undefined), TypeError);
});

test('the arithmetic helpers are exact and total', () => {
  assert.equal(add(250n, 750n), 1000n);
  assert.equal(subtract(1000n, 250n), 750n);
  assert.equal(negate(500n), -500n);
  assert.equal(negate(-500n), 500n);
  assert.equal(absolute(-500n), 500n);
  assert.equal(absolute(500n), 500n);
  assert.equal(sum([]), 0n);
  assert.equal(sum([1n, 2n, 3n]), 6n);
  assert.equal(multiplyByCount(250n, 4n), 1000n);
  assert.equal(multiplyByCount(250n, 0n), 0n);
});

test('compare orders correctly and returns only -1, 0, 1', () => {
  assert.equal(compare(1n, 2n), -1);
  assert.equal(compare(2n, 1n), 1);
  assert.equal(compare(2n, 2n), 0);
  assert.equal(isZero(0n), true);
  assert.equal(isZero(1n), false);
  assert.equal(isNegative(-1n), true);
  assert.equal(isNegative(0n), false);
});

test('a negative count is a sign error, not a refund', () => {
  assert.throws(() => multiplyByCount(250n, -1n), /sign error/);
});

test('multiplyByBps multiplies BEFORE dividing', () => {
  // The order is the whole thing. `value * (bps / 10000)` divides first, truncates to zero for
  // any rate below 100%, and returns 0 for every commission this platform charges.
  assert.equal(BASIS_POINTS_DENOMINATOR, 10_000n);
  assert.equal(multiplyByBps(100_000n, 250n), 2_500n); // 2.5% of ₹1000 = ₹25
  assert.equal(multiplyByBps(1n, 250n), 0n); // 0.025 paise -> 0, half-even
  assert.equal(multiplyByBps(200n, 250n), 5n); // exactly 5
  assert.equal(multiplyByBps(0n, 250n), 0n);
  assert.equal(multiplyByBps(100_000n, 0n), 0n); // KL-006 permits a 0 bps rate
});

// ═══════════════════════════════════════════════════════════════════════════
// Indian grouping — AC-FND-06.4. The trust requirement.
// ═══════════════════════════════════════════════════════════════════════════

test('AC-FND-06.4 — 250,000 paise is ₹2,500.00 and 25,000,000 paise is ₹2,50,000.00', () => {
  // The two figures the acceptance criterion names, verbatim.
  assert.equal(formatIndianRupees(250_000n), '₹2,500.00');
  assert.equal(formatIndianRupees(25_000_000n), '₹2,50,000.00');
});

test('the lakh/crore ladder, every rung', () => {
  assert.equal(groupIndianDigits('1'), '1');
  assert.equal(groupIndianDigits('999'), '999');
  assert.equal(groupIndianDigits('1000'), '1,000');
  assert.equal(groupIndianDigits('10000'), '10,000');
  assert.equal(groupIndianDigits('100000'), '1,00,000'); // one lakh — NOT 100,000
  assert.equal(groupIndianDigits('1000000'), '10,00,000'); // ten lakh
  assert.equal(groupIndianDigits('10000000'), '1,00,00,000'); // one crore — NOT 10,000,000
  assert.equal(groupIndianDigits('1000000000'), '1,00,00,00,000'); // one hundred crore
});

test('the western form is what this is NOT', () => {
  // Stated as a negative assertion because the failure is silent: `₹250,000` renders perfectly
  // and is simply distrusted by the person reading it.
  assert.notEqual(groupIndianDigits('100000'), '100,000');
  assert.notEqual(formatIndianRupees(10_000_000_00n), '₹10,000,000.00');
});

test('zero, small change and the negative case', () => {
  assert.equal(formatIndianRupees(0n), '₹0.00');
  assert.equal(formatIndianRupees(5n), '₹0.05'); // five paise, padded — not ₹0.5
  assert.equal(formatIndianRupees(50n), '₹0.50');
  // The sign precedes the SYMBOL (§8.3): a refund line is scanned by its leading character.
  assert.equal(formatIndianRupees(-25_000_000n), '-₹2,50,000.00');
  assert.equal(formatIndianRupees(250_000n, { symbol: false }), '2,500.00');
});

test('indianAmountParts returns the pieces a layout needs', () => {
  const parts = indianAmountParts(25_000_050n);
  assert.deepEqual(parts, { sign: '', major: '2,50,000', minor: '50' });
  assert.deepEqual(indianAmountParts(-1n), { sign: '-', major: '0', minor: '01' });
  // A zero-decimal currency renders no minor part at all rather than an empty ".".
  assert.deepEqual(indianAmountParts(1234n, 0), { sign: '', major: '1,234', minor: '' });
});

test('the grouping refuses input it cannot group', () => {
  assert.throws(() => groupIndianDigits('12.34'), TypeError);
  assert.throws(() => groupIndianDigits('-123'), TypeError);
  assert.throws(() => indianAmountParts(1n, 5), RangeError);
  assert.throws(() => indianAmountParts(1n, -1), RangeError);
  assert.throws(() => indianAmountParts(1n, 1.5), RangeError);
});

// ═══════════════════════════════════════════════════════════════════════════
// format-currency — India is the DEFAULT, not the assumption.
// ═══════════════════════════════════════════════════════════════════════════

test('the currency is always explicit, and an unknown one throws', () => {
  assert.equal(formatCurrency(25_000_000n, 'INR'), '₹2,50,000.00');
  assert.equal(formatCurrency(25_000_000n, 'USD'), '$250,000.00'); // western grouping
  assert.throws(() => formatCurrency(1n, 'EUR'), UnknownCurrencyError);
  assert.throws(() => currencyProfile('XYZ'), /Add it to CURRENCIES/);
  assert.equal(currencyProfile('INR').symbol, '₹');
  assert.ok(Object.keys(CURRENCIES).length >= 2, 'the parameterisation has only one real case');
});

test('the accounting form parenthesises a negative, and only a negative', () => {
  assert.equal(formatAccounting(-50_000n, 'INR'), '(₹500.00)');
  assert.equal(formatAccounting(50_000n, 'INR'), '₹500.00');
  assert.equal(formatAccounting(0n, 'INR'), '₹0.00');
});

test('a zero-decimal and an indian-grouped non-INR currency both render', () => {
  // Exercises the branches formatCurrency has that formatIndianRupees does not.
  const extended = { ...CURRENCIES } as Record<string, (typeof CURRENCIES)[string]>;
  extended['JPY'] = { code: 'JPY', symbol: '¥', minorExponent: 0, grouping: 'western' };
  extended['XIN'] = { code: 'XIN', symbol: '#', minorExponent: 3, grouping: 'indian' };
  // Injected rather than added to the shipped table: a currency this product does not accept
  // must not appear in CURRENCIES just to satisfy a branch.
  Object.assign(CURRENCIES, extended);

  assert.equal(formatCurrency(1234n, 'JPY'), '¥1,234');
  assert.equal(formatCurrency(-1_234_567n, 'XIN'), '-#1,234.567');
  assert.equal(formatCurrency(-1234n, 'USD'), '-$12.34');

  delete (CURRENCIES as Record<string, unknown>)['JPY'];
  delete (CURRENCIES as Record<string, unknown>)['XIN'];
});

// ═══════════════════════════════════════════════════════════════════════════
// basis points — KL-006's zero floor.
// ═══════════════════════════════════════════════════════════════════════════

test('KL-006 — 0 bps is legal, a negative rate is not', () => {
  assert.equal(assertBasisPoints(0n), 0n); // a promotional gym pays nothing
  assert.equal(assertBasisPoints(250n), 250n);
  assert.equal(assertBasisPoints(MAX_REASONABLE_BPS), MAX_REASONABLE_BPS);
  assert.throws(() => assertBasisPoints(-1n), InvalidBasisPointsError);
  assert.throws(() => assertBasisPoints(-1n), /pays the gym/);
});

test('a rate above 100% is refused as a probable unit error', () => {
  // 250000 is not "2500%" — it is 25% written into a bps field, which is a silent 100x
  // overcharge. Refusing it turns that into a startup error.
  assert.throws(() => assertBasisPoints(250_000n), /silent 100x overcharge/);
  assert.equal(BPS_DENOMINATOR, 10_000n);
  assert.equal(BPS_PER_PERCENT, 100n);
});

test('percent strings convert both ways without a float', () => {
  assert.equal(bpsFromPercentString('2.5'), 250n);
  assert.equal(bpsFromPercentString('2.50'), 250n);
  assert.equal(bpsFromPercentString('18'), 1800n); // GST
  assert.equal(bpsFromPercentString('0'), 0n);
  assert.equal(bpsFromPercentString('-2.5'), -250n);
  assert.equal(percentStringFromBps(250n), '2.50');
  assert.equal(percentStringFromBps(1800n), '18.00');
  assert.equal(percentStringFromBps(0n), '0.00');
  assert.equal(percentStringFromBps(-250n), '-2.50');
  assert.equal(percentStringFromBps(5n), '0.05');
});

test('a percent with three decimals is refused', () => {
  // Three places is a fraction of a basis point, which the ledger cannot represent — accepting
  // it would silently truncate a rate somebody deliberately configured.
  assert.throws(() => bpsFromPercentString('2.555'), TypeError);
  assert.throws(() => bpsFromPercentString('abc'), TypeError);
  assert.throws(() => bpsFromPercentString(''), TypeError);
});

test('percent → bps → percent round-trips for every two-decimal rate', () => {
  for (let bps = 0n; bps <= 10_000n; bps += 7n) {
    assert.equal(bpsFromPercentString(percentStringFromBps(bps)), bps, `failed at ${bps} bps`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// The composite property: a commission split reconciles to the penny.
// ═══════════════════════════════════════════════════════════════════════════

test('KPI-26 — a full commission split nets to zero, over 1,000 random orders', () => {
  // The end-to-end shape of a settlement line: gross, commission at a bps rate, and the net to
  // the gym. If any of the three primitives above leaks a unit, this is where it shows — and
  // this is the arithmetic KPI-26's 100% claim actually rests on.
  let seed = 0x1f2e3d4c;
  const next = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return Math.abs(seed);
  };

  for (let i = 0; i < 1_000; i += 1) {
    const gross = BigInt(next() % 10_000_000) + 1n;
    const rateBps = assertBasisPoints(BigInt(next() % 3_000));

    const commission = multiplyByBps(gross, rateBps);
    const net = subtract(gross, commission);

    assert.equal(add(commission, net), gross, `commission + net != gross at order ${i}`);
    assert.ok(commission >= 0n, 'a negative commission');
    assert.ok(net >= 0n, 'a negative net payout');
  }
});
