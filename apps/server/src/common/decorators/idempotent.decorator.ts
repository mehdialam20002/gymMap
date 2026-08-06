/**
 * M-008 · `@Idempotent()` — BR-PAY-03, §14.2.1, PG-2.
 *
 * Declares that this route requires an `Idempotency-Key` header. `api-gates.mjs` cross-checks
 * the declaration against the §14.2.1 REQ classes: a money-affecting or membership-state
 * -affecting route without it fails the build.
 *
 * The failure this prevents: a checkout POST retried by a flaky mobile connection charges twice.
 * The user sees one confirmation and two debits, and the reconciliation only surfaces it days
 * later — by which time the support conversation is about a refund rather than a bug.
 */

import { SetMetadata } from '@nestjs/common';

export const IS_IDEMPOTENT = 'gymmap:idempotent';

/** `mode`: `'required'` returns 400 without the header; `'optional'` honours it if supplied. */
export const Idempotent = (mode: 'required' | 'optional' = 'required'): MethodDecorator =>
  SetMetadata(IS_IDEMPOTENT, mode);
