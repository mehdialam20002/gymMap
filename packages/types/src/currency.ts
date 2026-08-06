/**
 * M-003 · Currency codes and the minor-unit exponent table — constitution §9.5, §10.
 *
 * The exponent is what makes a minor-unit integer meaningful. `50000` is ₹500.00 in INR
 * (exponent 2) but ¥50,000 in JPY (exponent 0) and 50 KWD (exponent 3). A formatter that
 * assumes 2 is correct for India today and wrong the first time the platform prices anything
 * in a zero-decimal currency — which the PRD's multi-country ambition (§C7) makes a matter of
 * when, not if.
 */

import type { Brand } from './ids/branded.js';

/** ISO-4217 alphabetic code, validated on construction. */
export type CurrencyCode = Brand<string, 'CurrencyCode'>;

/**
 * The exponent table — digits after the decimal separator in the *major* unit.
 *
 * INR is the launch currency and the only one Phase 1 transacts in. The others are present
 * because a table with one row invites a hardcoded `100`, and the second currency then arrives
 * as a refactor across every formatter instead of a row here.
 */
export const CURRENCY_MINOR_UNIT_EXPONENT = {
  INR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  AED: 2,
  SGD: 2,
  /** Zero-decimal. 1 JPY is 1 minor unit; there are no sen in circulation. */
  JPY: 0,
  /** Three-decimal. 1 KWD is 1000 fils. */
  KWD: 3,
  BHD: 3,
} as const satisfies Record<string, number>;

/** Every currency the platform can represent. */
export type SupportedCurrency = keyof typeof CURRENCY_MINOR_UNIT_EXPONENT;

/** The launch currency (`LAUNCH_MARKET_INDIA.md` §1). Phase 1 transacts in this alone. */
export const DEFAULT_CURRENCY = 'INR' as const;

const SUPPORTED = Object.keys(CURRENCY_MINOR_UNIT_EXPONENT) as SupportedCurrency[];

export function isSupportedCurrency(raw: unknown): raw is SupportedCurrency {
  return typeof raw === 'string' && Object.hasOwn(CURRENCY_MINOR_UNIT_EXPONENT, raw);
}

export class UnsupportedCurrencyError extends Error {
  readonly code = 'VALIDATION_FAILED' as const;

  constructor(raw: unknown) {
    super(
      `Unsupported currency: expected one of ${SUPPORTED.join(', ')}, received ${JSON.stringify(raw)}`,
    );
    this.name = 'UnsupportedCurrencyError';
  }
}

/** §9.5 B2 — the only way to obtain a `CurrencyCode`. */
export function currencyCode(raw: string): CurrencyCode {
  if (!isSupportedCurrency(raw)) throw new UnsupportedCurrencyError(raw);
  return raw as CurrencyCode;
}

/**
 * Minor units per major unit — 100 for INR, 1 for JPY, 1000 for KWD.
 *
 * Returns a `bigint` because every caller is about to combine it with a minor-unit amount,
 * and a `number` there would reintroduce exactly the float that BR-PAY-01 forbids.
 */
export function minorUnitsPerMajor(currency: CurrencyCode | SupportedCurrency): bigint {
  const exponent = CURRENCY_MINOR_UNIT_EXPONENT[currency as SupportedCurrency];
  if (exponent === undefined) throw new UnsupportedCurrencyError(currency);
  return 10n ** BigInt(exponent);
}
