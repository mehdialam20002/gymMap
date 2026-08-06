/**
 * M-003 · The Money contract — BR-PAY-01, NFR-DQ-02, constitution §9.5 B4/B5, §10.
 *
 * THIS FILE DECLARES TYPES AND NOTHING ELSE.
 *
 * `Money` is a type, not a class. Arithmetic — add, subtract, allocate, split a GST component,
 * apportion a settlement across line items — lives in `packages/utils/money` and
 * `apps/server/src/common/money` (M-016). A method on this type is a review rejection under R4,
 * because `packages/types` is imported by all four deployables and must stay runtime-free.
 *
 * Why integer minor units at all: 0.1 + 0.2 !== 0.3 in IEEE-754, and a settlement statement
 * that is off by one paise is a statement Finance cannot reconcile. KPI-26 demands 100%
 * reconciliation, which is only achievable if money is never a float anywhere in the system —
 * not in the database, not on the wire, not in a DTO, not in a chart tooltip.
 */

import type { Brand } from './ids/branded.js';
import type { CurrencyCode } from './currency.js';

/**
 * An integer count of the smallest indivisible unit of a currency — paise for INR.
 *
 * Branded over `bigint`, not `number`. `number` loses integer precision above 2^53, which in
 * paise is ₹90,071,992,547.40 — a figure a large chain's cumulative GMV reaches, at which point
 * amounts silently round and the ledger stops balancing with no error anywhere.
 */
export type MinorUnits = Brand<bigint, 'MinorUnits'>;

/**
 * An integer count of hundredths of a percent. 10% commission is `1000`, not `0.1`.
 *
 * §9.5 B5. A decimal rate multiplied by an amount reintroduces float rounding at exactly the
 * step where BR-FIN-01 needs exactness. Basis points multiply an integer by an integer and
 * divide once, with the rounding rule stated explicitly at the call site.
 */
export type BasisPoints = Brand<number, 'BasisPoints'>;

/**
 * A monetary quantity. Always an amount AND its currency — never a bare number.
 *
 * The currency is not decoration. `CURRENCY_MISMATCH` exists in the error registry because
 * adding two `Money` values of different currencies is a bug that must be caught rather than
 * silently coerced, and it can only be caught if the currency travels with the amount.
 */
export interface Money {
  readonly amountMinor: MinorUnits;
  readonly currency: CurrencyCode;
}

/**
 * The wire representation. `amountMinor` is a STRING on the wire, never a JSON number.
 *
 * `JSON.parse('{"a":9007199254740993}')` yields 9007199254740992 — no error, no warning, one
 * paise gone. Every API boundary and every persisted JSON payload uses this shape, and
 * `money.schema.ts` refuses a JSON number outright rather than coercing it (TR-38,
 * AC-FND-06.6).
 */
export interface MoneyWire {
  readonly amountMinor: string;
  readonly currency: string;
}

/** A signed amount, for ledger entries where direction is carried by the sign (BR-FIN-01). */
export type SignedMinorUnits = MinorUnits;

export const ZERO_MINOR = 0n as MinorUnits;

/** 100% expressed in basis points — the denominator for every rate calculation. */
export const BASIS_POINTS_SCALE = 10_000 as BasisPoints;
