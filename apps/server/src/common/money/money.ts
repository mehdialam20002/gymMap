/**
 * `Money` — the value type. `BR-PAY-01`, `NFR-DQ-02`, `AC-FND-06.1`, `AC-FND-06.3`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * NO OPERATOR ARITHMETIC ESCAPES THIS CLASS
 *
 * `a + b` on two `Money` values does not compile — `+` on objects produces a string, and the
 * class deliberately has no `valueOf`. Every operation is a method, and every method checks the
 * currency.
 *
 * The alternative — a bare `bigint` passed around with a currency beside it — works until the
 * day two amounts in different currencies are added. That addition is syntactically valid,
 * produces a plausible number, and is discovered when a settlement does not balance.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * The arithmetic itself lives in `@gymmap/utils`, and this is a thin typed shell over it. The
 * split is deliberate: the PDF renderer and any future worker need the same rounding and the
 * same Indian grouping without a NestJS class, and a second implementation for them is exactly
 * how `KPI-26`'s 100% becomes 99.98%.
 */

import {
  add as addMinor,
  allocate as allocateMinor,
  compare as compareMinor,
  formatCurrency,
  formatMinorUnits,
  multiplyByBps as multiplyByBpsMinor,
  multiplyByCount as multiplyByCountMinor,
  parseMinorUnits,
  subtract as subtractMinor,
  sum as sumMinor,
} from '@gymmap/utils';

import { CurrencyMismatchError } from './money.errors.js';

/** ISO 4217. `char(3)`, stored beside every amount — never inferred (`AC-FND-06.1`). */
export type CurrencyCode = string;

export class Money {
  /** Minor units. Paise for INR. Always `bigint`, never a `number`. */
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;

  private constructor(amountMinor: bigint, currency: CurrencyCode) {
    this.amountMinor = amountMinor;
    this.currency = currency;
    Object.freeze(this);
  }

  static of(amountMinor: bigint, currency: CurrencyCode): Money {
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new TypeError(
        `A currency must be a three-letter uppercase ISO 4217 code; received "${currency}". ` +
          'An amount with no currency is a number, and a number is what BR-PAY-01 forbids.',
      );
    }
    return new Money(amountMinor, currency);
  }

  /** From the wire. Refuses a JSON number — see `parseMinorUnits` for why (`TR-38`). */
  static fromWire(amountMinor: unknown, currency: CurrencyCode): Money {
    return Money.of(parseMinorUnits(amountMinor), currency);
  }

  static zero(currency: CurrencyCode): Money {
    return Money.of(0n, currency);
  }

  /**
   * Refuses two currencies rather than coercing — `AC-FND-06.3`.
   *
   * There is no exchange rate here and there must never be one. A conversion buried inside `add`
   * would apply *some* rate at *some* moment, and neither is recorded on the resulting ledger
   * entry — so the figure could never be reproduced or audited.
   */
  private assertSameCurrency(other: Money, operation: string): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency, operation);
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other, 'add');
    return new Money(addMinor(this.amountMinor, other.amountMinor), this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other, 'subtract');
    return new Money(subtractMinor(this.amountMinor, other.amountMinor), this.currency);
  }

  negate(): Money {
    return new Money(-this.amountMinor, this.currency);
  }

  /** Applies a rate in basis points, rounding half to even. The only rounding in the path. */
  multiplyByBps(basisPoints: bigint): Money {
    return new Money(multiplyByBpsMinor(this.amountMinor, basisPoints), this.currency);
  }

  /** Multiplies by a whole count. Exact — no rounding is possible, so none happens. */
  multiplyByCount(count: bigint): Money {
    return new Money(multiplyByCountMinor(this.amountMinor, count), this.currency);
  }

  /** Largest-remainder split. The parts sum EXACTLY to this amount (`BR-FIN-03`). */
  allocate(weights: readonly bigint[]): Money[] {
    return allocateMinor(this.amountMinor, weights).map((part) => new Money(part, this.currency));
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other, 'compare');
    return compareMinor(this.amountMinor, other.amountMinor);
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amountMinor === other.amountMinor;
  }

  isZero(): boolean {
    return this.amountMinor === 0n;
  }

  isNegative(): boolean {
    return this.amountMinor < 0n;
  }

  static sum(values: readonly Money[], currency: CurrencyCode): Money {
    for (const value of values) {
      if (value.currency !== currency) {
        throw new CurrencyMismatchError(currency, value.currency, 'sum');
      }
    }
    return Money.of(sumMinor(values.map((v) => v.amountMinor)), currency);
  }

  /**
   * The wire form — `AC-FND-06.6`, `TR-38`.
   *
   * `amountMinor` is a STRING. `JSON.stringify` throws on a `bigint`, so without this every
   * response would need an ad-hoc `.toString()` — and the one that gets forgotten is a 500. A
   * number would lose precision above 2^53 paise, silently, inside the client's `JSON.parse`.
   */
  toJSON(): { amountMinor: string; currency: CurrencyCode } {
    return { amountMinor: formatMinorUnits(this.amountMinor), currency: this.currency };
  }

  /** `₹2,50,000.00`. One formatter, shared with the PDF renderer via `@gymmap/utils`. */
  format(): string {
    return formatCurrency(this.amountMinor, this.currency);
  }

  /**
   * Deliberately NOT the formatted amount.
   *
   * `toString` is what a template literal calls, and a ledger comment or a log line that
   * accidentally interpolated a Money must not read like a rendered price a user was shown. The
   * currency code makes the string obviously internal.
   */
  toString(): string {
    return `Money(${this.amountMinor} ${this.currency})`;
  }
}
