/**
 * M-003 · The `ErrorCode` union — constitution §13.2, roadmap M-003 AC-4.
 *
 * The union is DERIVED from `ERROR_REGISTRY`, not declared alongside it. A hand-written union
 * beside a hand-written table is two lists that agree only until someone is in a hurry, and the
 * failure mode is a client that cannot branch on a code the server emits — invisible in every
 * server-side test.
 *
 * AC-4 asks that no code exists in source without a registry row. Derivation makes that
 * structurally impossible rather than CI-detectable: there is nowhere else a code can come from.
 */

import { ERROR_REGISTRY, type ErrorRegistryRow } from './registry.js';

/** Every error code the platform can emit. */
export type ErrorCode = keyof typeof ERROR_REGISTRY;

/** All codes as a runtime array, sorted, for validation and the generated API table. */
export const ERROR_CODES = Object.keys(ERROR_REGISTRY).sort() as readonly ErrorCode[];

export function isErrorCode(raw: unknown): raw is ErrorCode {
  return typeof raw === 'string' && Object.hasOwn(ERROR_REGISTRY, raw);
}

/** The row for a code. Total over `ErrorCode`, so no call site needs an undefined check. */
export function errorRegistryRow(code: ErrorCode): ErrorRegistryRow {
  return ERROR_REGISTRY[code];
}

/** The HTTP status a code maps to. One mapping, used by the exception filter in M-004. */
export function httpStatusFor(code: ErrorCode): number {
  return ERROR_REGISTRY[code].httpStatus;
}

/**
 * Whether a client may retry the identical request unchanged.
 *
 * Read by the shared fetch wrapper. Getting this wrong on a payment code is how a network blip
 * becomes a double charge, which is why `IDEMPOTENCY_KEY_MISMATCH` is explicitly non-retryable.
 */
export function isRetryable(code: ErrorCode): boolean {
  return ERROR_REGISTRY[code].retryable;
}
