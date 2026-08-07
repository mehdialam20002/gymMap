/**
 * Basis-point arithmetic — `KL-006`, `LAUNCH_MARKET_INDIA.md` §10, `ADR-0031`.
 *
 * A basis point is one hundredth of a percent: 250 bps = 2.5%. Rates are stored in bps and never
 * as a decimal fraction, because 2.5% has no exact binary representation and a commission rate
 * that is 0.024999999999999998 produces a settlement that does not balance.
 *
 * ┌─ THE ZERO FLOOR IS A PRODUCT DECISION, NOT A GUARD ─────────────────────────────────────────┐
 * │ `KL-006` permits a commission rate of 0 bps — a promotional gym pays nothing. It does NOT   │
 * │ permit a negative rate, which would mean the platform pays the gym to take a booking. A     │
 * │ negative bps reaching the ledger is unrecoverable: the entries are append-only and the      │
 * │ correction is a second entry that has to be reasoned about by a human.                       │
 * │                                                                                              │
 * │ ADR-0031 moved these columns from a Postgres DOMAIN to plain `integer` with per-column       │
 * │ CHECKs, because Prisma cannot bind a parameter for a domain over int4. The floor is now      │
 * │ enforced in three places — the CHECK, this function, and the Zod schema — which is correct:  │
 * │ each covers a path the others do not.                                                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

export const BPS_PER_PERCENT = 100n;
export const BPS_DENOMINATOR = 10_000n;

/** 10,000 bps = 100%. A rate above this is almost always a unit error — percent read as bps. */
export const MAX_REASONABLE_BPS = 10_000n;

export class InvalidBasisPointsError extends RangeError {
  readonly value: bigint;

  constructor(value: bigint, reason: string) {
    super(`Invalid basis points (${value}): ${reason}`);
    this.name = 'InvalidBasisPointsError';
    this.value = value;
  }
}

/**
 * Validates a basis-point rate.
 *
 * Rejects above 10,000 as well as below zero. A rate of 250000 is not "2500%" — it is somebody
 * who wrote 25% as `2500` in a percent field and then multiplied. Refusing it here turns a
 * silent 100× overcharge into a startup error.
 */
export function assertBasisPoints(value: bigint): bigint {
  if (value < 0n) {
    throw new InvalidBasisPointsError(
      value,
      'a negative rate would mean the platform pays the gym to take a booking. KL-006 allows ' +
        '0 bps for a promotional gym; it does not allow less.',
    );
  }
  if (value > MAX_REASONABLE_BPS) {
    throw new InvalidBasisPointsError(
      value,
      `above ${MAX_REASONABLE_BPS} bps (100%). A rate this large is almost always a percent ` +
        'value written into a bps field, which is a silent 100x overcharge.',
    );
  }
  return value;
}

/** 2.5% → 250 bps. Takes a STRING, so `2.5` never exists as a float in this path. */
export function bpsFromPercentString(percent: string): bigint {
  if (!/^-?\d+(\.\d{1,2})?$/.test(percent)) {
    throw new TypeError(
      `bpsFromPercentString expects a decimal with at most two places, got "${percent}". ` +
        'Three places would be a fraction of a basis point, which the ledger cannot represent.',
    );
  }
  const [whole, fraction = ''] = percent.split('.');
  const padded = fraction.padEnd(2, '0');
  const negative = whole!.startsWith('-');
  const magnitude = BigInt(whole!.replace('-', '')) * BPS_PER_PERCENT + BigInt(padded);
  return negative ? -magnitude : magnitude;
}

/** 250 bps → `"2.50"`. For display and for a config file a human reads. */
export function percentStringFromBps(bps: bigint): string {
  const negative = bps < 0n;
  const magnitude = negative ? -bps : bps;
  const whole = magnitude / BPS_PER_PERCENT;
  const fraction = (magnitude % BPS_PER_PERCENT).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}
