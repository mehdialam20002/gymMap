/**
 * M-003 · The money wire schema — TR-38, AC-FND-06.6, BR-PAY-01.
 *
 * ┌─ THE TRAP THIS SCHEMA EXISTS TO REFUSE ─────────────────────────────────────────────────┐
 * │ The convenient thing during development is `z.number()`, because every JSON body already │
 * │ has numbers in it and a string amount feels like ceremony. It is not ceremony.           │
 * │                                                                                          │
 * │   JSON.parse('{"amountMinor":9007199254740993}').amountMinor  →  9007199254740992        │
 * │                                                                                          │
 * │ No error. No warning. One paise gone, above 2^53 — ₹90,071,992,547.40, a figure a large  │
 * │ chain's cumulative GMV reaches. The ledger then fails to balance with nothing in any log  │
 * │ pointing at the cause, and KPI-26 (100% reconciliation) is unreachable by construction.  │
 * │                                                                                          │
 * │ So the schema accepts a STRING and coerces to bigint, and REJECTS a JSON number outright │
 * │ rather than coercing it — by the time a number reaches the validator the precision is    │
 * │ already gone, and accepting it would launder the loss into a valid-looking value.        │
 * └──────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { z } from 'zod';

import { CURRENCY_MINOR_UNIT_EXPONENT } from '../../currency.js';

const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_MINOR_UNIT_EXPONENT) as [string, ...string[]];

/** A base-10 integer with an optional leading minus. No exponent, no decimal point, no spaces. */
const INTEGER_STRING = /^-?(0|[1-9]\d*)$/;

/**
 * `amountMinor` on the wire.
 *
 * The `z.number()` branch is not an oversight — it is an explicit, load-bearing rejection with a
 * message that tells the caller exactly what to change. Leaving `number` to fall through to a
 * generic "expected string" error would send an integrator hunting for a typo instead of
 * reading the one sentence that explains why their perfectly reasonable JSON is refused.
 */
export const minorUnitsSchema = z
  .union([
    z.string(),
    z.number().superRefine((_value, ctx) => {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'amountMinor must be a JSON string, not a number (TR-38 / BR-PAY-01). A JSON number ' +
          'loses integer precision above 2^53 — the value was already truncated by the parser ' +
          'before validation, so it cannot be accepted. Send "12345" rather than 12345.',
      });
    }),
  ])
  .superRefine((value, ctx) => {
    if (typeof value !== 'string') return; // already reported above
    if (!INTEGER_STRING.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'amountMinor must be a base-10 integer string in minor units (paise for INR). ' +
          'A decimal point means major units leaked in: ₹500 is "50000", not "500.00".',
      });
    }
  })
  .transform((value) => BigInt(value as string));

/** ISO-4217 code, constrained to what the platform can actually represent. */
export const currencyCodeSchema = z.enum(SUPPORTED_CURRENCIES);

/** The `Money` wire shape. Both fields required — an amount without a currency is not money. */
export const moneySchema = z
  .object({
    amountMinor: minorUnitsSchema,
    currency: currencyCodeSchema,
  })
  .strict();

/** Non-negative variant, for prices and totals where a negative is always a bug. */
export const nonNegativeMoneySchema = moneySchema.refine((m) => m.amountMinor >= 0n, {
  message: 'Amount must not be negative here. Signed amounts belong to ledger entries (BR-FIN-01).',
  path: ['amountMinor'],
});

/**
 * Serialiser for the outbound direction.
 *
 * `JSON.stringify` throws `TypeError: Do not know how to serialize a BigInt` on a raw bigint, so
 * every response carrying money must pass through here. That throw is a feature — it makes the
 * omission a loud failure in the first test that touches the endpoint rather than a silent
 * `"[object Object]"` on the wire.
 */
export function toMoneyWire(
  amountMinor: bigint,
  currency: string,
): {
  amountMinor: string;
  currency: string;
} {
  return { amountMinor: amountMinor.toString(10), currency };
}

export type MoneyInput = z.input<typeof moneySchema>;
export type MoneyOutput = z.output<typeof moneySchema>;
