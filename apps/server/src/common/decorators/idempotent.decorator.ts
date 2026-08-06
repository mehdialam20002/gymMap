/**
 * M-008 · `@Idempotent()` — BR-PAY-03, §14.2.1, PG-2.
 *
 * Declares that this route requires an `Idempotency-Key`. `api-gates.mjs` cross-checks the
 * declaration against the §14.2.1 REQ classes by path shape, so a money-affecting route without
 * it fails the build rather than waiting to be noticed.
 *
 * The failure this prevents: a checkout POST retried by a flaky mobile connection charges twice.
 * The user sees one confirmation and two debits, and it surfaces days later as a refund request
 * rather than as a bug report.
 */

import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiExtension, ApiHeader } from '@nestjs/swagger';

export const IS_IDEMPOTENT = 'gymmap:idempotent';

export const Idempotent = (mode: 'required' | 'optional' = 'required') =>
  applyDecorators(
    SetMetadata(IS_IDEMPOTENT, mode),
    ApiExtension('x-gymmap-idempotent', mode),
    // Documented on the operation as well, so a client generator emits the parameter rather
    // than leaving an integrator to discover the 400 at runtime.
    ApiHeader({
      name: 'Idempotency-Key',
      required: mode === 'required',
      description:
        'Client-chosen, unique per logical operation. Replaying it returns the stored response ' +
        'for 24 hours; a different body under the same key is 409 IDEMPOTENCY_KEY_MISMATCH.',
    }),
  );
