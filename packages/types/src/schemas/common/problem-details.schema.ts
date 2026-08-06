/**
 * M-003 · The error envelope — §C3.1, AC-FND-09.1, constitution §13.3.
 *
 * Exactly `{ error: { code, message, details[], correlation_id } }`. Every non-2xx response,
 * without exception.
 *
 * The field names are snake_case and the envelope is nested under `error` because §C3.1 shows
 * that literal shape in a signed contract. RFC 7807 `application/problem+json` would have been
 * the conventional choice and was NOT adopted: `type`/`title`/`status`/`detail` is a different
 * wire format, and matching a published contract outranks matching a convention.
 *
 * `.strict()` on the inner object is deliberate. An extra field on an error response is usually
 * a stack trace, an internal message or an ORM error leaking through a hastily written filter —
 * exactly the payload BR-DAT-06 and NFR-SEC-04 forbid. Failing our own contract test is a much
 * cheaper way to find that than a penetration test is.
 */

import { z } from 'zod';

import { ERROR_CODES } from '../../errors/error-code.js';

/**
 * One field-level problem.
 *
 * Loose by design: `PLAN_PRICE_CHANGED` carries `{ field, previous, current }` while
 * `VALIDATION_FAILED` carries `{ field, rule }`. The per-code shape is documented in the
 * registry's `detailsShape` column and asserted by each module's contract test, which is where
 * the knowledge actually lives.
 */
export const problemDetailSchema = z
  .object({
    field: z.string().optional(),
  })
  .catchall(z.unknown());

export const problemDetailsSchema = z
  .object({
    error: z
      .object({
        /** Constrained to the registry — §13.2.1's uniqueness rule enforced at the boundary. */
        code: z.enum(ERROR_CODES as unknown as [string, ...string[]]),
        /** Rendered from `messageKey` in the caller's locale (NFR-USE-08). Never a raw exception. */
        message: z.string().min(1),
        details: z.array(problemDetailSchema).default([]),
        /** ULID. Ties the response to the log line and the trace (NFR-OBS-02). */
        correlation_id: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
