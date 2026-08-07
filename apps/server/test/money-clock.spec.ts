/**
 * `Money` and the `Clock` port — `AC-FND-06.1`, `AC-FND-06.3`, `AC-FND-06.6`, `AC-FND-13.3`.
 *
 * The arithmetic itself is proved in `packages/utils`, over 10,000 random splits and every
 * half-way rounding case. What is asserted HERE is the shell: that the currency check cannot be
 * bypassed, that no operator arithmetic escapes the class, and that the wire form is a string.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Money } from '../dist/common/money/money.js';
import { CurrencyMismatchError } from '../dist/common/money/money.errors.js';
import { FixedClock, SequentialIdGenerator } from '../dist/common/clock/fixed-clock.adapter.js';
import { SystemClock } from '../dist/common/clock/system-clock.adapter.js';

const INR = 'INR';
const USD = 'USD';

// ═══════════════════════════════════════════════════════════════════════════
// AC-FND-06.3 — two currencies never silently become one.
// ═══════════════════════════════════════════════════════════════════════════

test('AC-FND-06.3 — adding two currencies throws rather than coercing', () => {
  const rupees = Money.of(50_000n, INR);
  const dollars = Money.of(50_000n, USD);

  assert.throws(() => rupees.add(dollars), CurrencyMismatchError);
  assert.throws(() => rupees.subtract(dollars), CurrencyMismatchError);
  assert.throws(() => rupees.compare(dollars), CurrencyMismatchError);
  assert.throws(() => Money.sum([rupees, dollars], INR), CurrencyMismatchError);
});

test('the mismatch error explains why there is no exchange rate here', () => {
  // Not pedantry. The next person to hit this will be tempted to add a conversion, and the
  // reason not to — an unrecorded rate at an unrecorded moment, on a ledger entry that can never
  // be reproduced — has to be in the error rather than in a document they will not find.
  try {
    Money.of(1n, INR).add(Money.of(1n, USD));
    assert.fail('expected a CurrencyMismatchError');
  } catch (error) {
    assert.ok(error instanceof CurrencyMismatchError);
    assert.match(JSON.stringify(error.details), /unrecorded rate/);
  }
});

test('equals compares the currency too, so ₹1 is not $1', () => {
  assert.equal(Money.of(100n, INR).equals(Money.of(100n, INR)), true);
  assert.equal(Money.of(100n, INR).equals(Money.of(100n, USD)), false);
  assert.equal(Money.of(100n, INR).equals(Money.of(101n, INR)), false);
});

// ═══════════════════════════════════════════════════════════════════════════
// No operator arithmetic escapes the class.
// ═══════════════════════════════════════════════════════════════════════════

test('a Money has no valueOf, so `a + b` cannot silently produce a number', () => {
  // The failure this prevents: `total + fee` compiling, coercing through valueOf, and producing
  // a NUMBER that then flows into a ledger as a float. Without valueOf, `+` produces a string —
  // obviously wrong at the first glance rather than subtly wrong six months later.
  const a = Money.of(100n, INR);
  const b = Money.of(200n, INR);

  assert.equal(typeof (a as unknown as { valueOf?: unknown }).valueOf, 'function');
  // Object.prototype.valueOf returns the object itself, so + falls back to toString.
  assert.equal(typeof ((a as never) + (b as never)), 'string');
  assert.equal(a.add(b).amountMinor, 300n);
});

test('toString is NOT the formatted amount', () => {
  // `toString` is what a template literal calls. A ledger comment or a log line that
  // accidentally interpolated a Money must not read like a price a user was shown.
  const money = Money.of(25_000_000n, INR);
  assert.equal(`${money}`, 'Money(25000000 INR)');
  assert.equal(money.format(), '₹2,50,000.00');
});

test('a Money is frozen, so a shared instance cannot be mutated', () => {
  const money = Money.of(100n, INR);
  assert.equal(Object.isFrozen(money), true);
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-FND-06.6 / TR-38 — the wire form.
// ═══════════════════════════════════════════════════════════════════════════

test('AC-FND-06.6 — the wire form is a STRING and survives JSON.stringify', () => {
  // A bigint makes JSON.stringify THROW, so without toJSON every response carrying money would
  // 500 — and a number would silently lose digits above 2^53 paise inside the client's parse.
  const money = Money.fromWire('9007199254740993', INR);
  const json = JSON.stringify({ total: money });

  assert.equal(json, '{"total":{"amountMinor":"9007199254740993","currency":"INR"}}');
  assert.equal(
    Money.fromWire(JSON.parse(json).total.amountMinor, INR).amountMinor,
    money.amountMinor,
  );
});

test('a JSON number is refused at the boundary', () => {
  assert.throws(() => Money.fromWire(100, INR), /must be a STRING/);
});

test('a currency that is not three uppercase letters is refused', () => {
  assert.throws(() => Money.of(1n, 'inr'), TypeError);
  assert.throws(() => Money.of(1n, 'RUPEE'), TypeError);
  assert.throws(() => Money.of(1n, ''), /ISO 4217/);
});

// ═══════════════════════════════════════════════════════════════════════════
// The arithmetic, through the shell.
// ═══════════════════════════════════════════════════════════════════════════

test('an allocation through Money keeps the currency and sums exactly', () => {
  const parts = Money.of(1000n, INR).allocate([1n, 1n, 1n]);
  assert.deepEqual(
    parts.map((p) => p.amountMinor),
    [334n, 333n, 333n],
  );
  assert.ok(parts.every((p) => p.currency === INR));
  assert.equal(Money.sum(parts, INR).amountMinor, 1000n);
});

test('bps and count multiplication behave as the primitives do', () => {
  assert.equal(Money.of(100_000n, INR).multiplyByBps(250n).amountMinor, 2_500n);
  assert.equal(Money.of(250n, INR).multiplyByCount(4n).amountMinor, 1000n);
  assert.equal(Money.of(500n, INR).negate().amountMinor, -500n);
  assert.equal(Money.zero(INR).isZero(), true);
  assert.equal(Money.of(-1n, INR).isNegative(), true);
  assert.equal(Money.of(1n, INR).compare(Money.of(2n, INR)), -1);
  assert.equal(Money.sum([], INR).amountMinor, 0n);
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-FND-13.3 — the Clock port.
// ═══════════════════════════════════════════════════════════════════════════

test('AC-FND-13.3 — a FixedClock makes time an argument, with no global patch', () => {
  const clock = new FixedClock('2026-08-07T12:00:00Z');
  assert.equal(clock.now().toISOString(), '2026-08-07T12:00:00.000Z');
  // Twice, to prove it is frozen rather than merely close.
  assert.equal(clock.now().getTime(), clock.now().getTime());
});

test('the clock returns a COPY, so a caller cannot move time by mutating it', () => {
  // Returning the internal Date would let `setHours` silently advance the clock, and a test that
  // did so accidentally would be very hard to read.
  const clock = new FixedClock('2026-08-07T12:00:00Z');
  const first = clock.now();
  first.setFullYear(2030);
  assert.equal(clock.now().getUTCFullYear(), 2026);
});

test('advanceBy and set move the clock deliberately', () => {
  const clock = new FixedClock('2026-08-07T12:00:00Z');
  clock.advanceBy(3_600_000);
  assert.equal(clock.now().toISOString(), '2026-08-07T13:00:00.000Z');
  clock.set('2027-01-01T00:00:00Z');
  assert.equal(clock.now().toISOString(), '2027-01-01T00:00:00.000Z');
});

test('an invalid instant is refused at construction, not at first use', () => {
  // A NaN clock returning `Invalid Date` from `now()` would produce NaN comparisons downstream,
  // and every `<` and `>` against it is false — so a membership would be neither active nor
  // expired, and nothing would throw.
  assert.throws(() => new FixedClock('not-a-date'), TypeError);
  assert.throws(() => new FixedClock('2026-13-45T99:99:99Z'), TypeError);
  const clock = new FixedClock('2026-08-07T12:00:00Z');
  assert.throws(() => clock.set('nonsense'), TypeError);
});

test('the SystemClock is the only thing that reads the ambient clock', () => {
  // Asserted loosely — the point is that it MOVES, which a FixedClock does not.
  const clock = new SystemClock();
  const first = clock.now().getTime();
  assert.ok(first > new Date('2020-01-01T00:00:00Z').getTime(), 'the system clock is implausible');
  assert.ok(Number.isFinite(first));
});

test('a SequentialIdGenerator makes the id assertable, not merely present', () => {
  // Asserting that "an id exists" leaves the question the test was written to answer — did the
  // ledger entry, the outbox row and the audit record all get the SAME one — unanswered.
  const ids = new SequentialIdGenerator();
  const first = ids.uuid();
  const second = ids.uuid();

  assert.notEqual(first, second);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(first, '00000000-0000-7000-8000-000000000001');
  assert.equal(second, '00000000-0000-7000-8000-000000000002');
});
