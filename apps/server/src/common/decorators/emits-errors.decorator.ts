/**
 * M-008 · `@EmitsErrors()` — PG-5, §13.2.
 *
 * The error codes this route can return. Checked against the registry, so a code that exists
 * only in a `throw` and not in `packages/types/src/errors/registry.ts` fails the build.
 *
 * Why it matters on the CLIENT side: a code absent from the contract is a code the generated
 * client has no branch for, so it falls through to a generic handler. The user is shown
 * "something went wrong" for a condition the server understood exactly — a price change, an
 * exhausted coupon, a frozen membership — and support cannot tell them which.
 */

import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export const EMITS_ERRORS = 'gymmap:emits-errors';

export const EmitsErrors = (...codes: readonly string[]) =>
  applyDecorators(
    SetMetadata(EMITS_ERRORS, codes),
    ApiExtension('x-gymmap-error-codes', [...codes]),
  );
