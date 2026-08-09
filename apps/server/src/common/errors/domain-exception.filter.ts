/**
 * M-004 · The one error shape — §C3.1, AC-FND-09.1, AC-FND-09.3, AC-FND-09.6, SEC-A03-005.
 *
 * Every non-2xx response leaving this server passes through here and comes out as
 * `{ error: { code, message, details[], correlation_id } }`. No exceptions, no second shape for
 * "internal" errors, no framework default leaking through.
 *
 * ┌─ THE RULE THAT MATTERS MOST: AC-FND-09.6 / SEC-A03-005 ─────────────────────────────────┐
 * │ An unrecognised throwable becomes a 500 INTERNAL_ERROR and its raw message is NOT        │
 * │ echoed to the client. The reason is concrete: a Prisma error message contains the SQL,   │
 * │ the column names and often a parameter value; a filesystem error contains an absolute    │
 * │ path; an axios error contains the upstream URL with its query string. Every one of those │
 * │ is reconnaissance handed to an attacker, and at least one is a BR-DAT-06 breach. The     │
 * │ full error goes to the log with the correlation id, so support loses nothing.            │
 * └──────────────────────────────────────────────────────────────────────────────────────────┘
 */

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { isErrorCode, type ErrorCode } from '@gymmap/types';

import { CORRELATION_HEADER, currentCorrelationId } from '../logging/correlation.als.js';
import { redactDeep } from '../logging/redaction.js';
import { DomainException, type ProblemDetail } from './domain-exception.js';

/** The §C3.1 envelope. The only error body this server emits. */
interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: ProblemDetail[];
    correlation_id: string;
  };
}

/**
 * Client-safe messages, keyed by code.
 *
 * Deliberately generic. The specific reason lives in the log against the correlation id, and the
 * localised member-facing text is rendered from the registry's `messageKey` by the i18n layer
 * (NFR-USE-08) once M-019 lands. Until then these are the fallbacks, and they are written to be
 * useful without being informative to an attacker.
 */
export const CLIENT_SAFE_MESSAGE: Partial<Record<ErrorCode, string>> = {
  // Listed explicitly even though it equals GENERIC_500. The alternative is exempting it in the
  // coverage test, and an exemption is a hole somebody widens later — "INTERNAL_ERROR is
  // allowed to be missing" becomes "this code is basically internal too". An entry that
  // happens to match the fallback costs one line and keeps the rule absolute.
  INTERNAL_ERROR: 'An internal error occurred.',
  VALIDATION_FAILED: 'The request could not be validated.',
  RESOURCE_NOT_FOUND: 'The requested resource does not exist.',
  UNAUTHENTICATED: 'Authentication is required.',
  PERMISSION_DENIED: 'You do not have permission to perform this action.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again shortly.',
  DEPENDENCY_UNAVAILABLE: 'A required service is temporarily unavailable. Please try again.',
  IDEMPOTENCY_KEY_REQUIRED: 'This operation requires an Idempotency-Key header.',
  IDEMPOTENCY_KEY_MISMATCH: 'This idempotency key was already used with a different request.',
  CURRENCY_MISMATCH: 'The currency of this amount does not match the expected currency.',
  TENANT_HEADER_NOT_ACCEPTED: 'Tenant may not be supplied by the client.',
  TENANT_CONTEXT_MISSING: 'An internal error occurred.',
  TENANT_CONTEXT_ALREADY_SET: 'An internal error occurred.',
  ELEVATION_REFUSED: 'You do not have permission to perform this action.',

  // --- M-023, RBAC ---------------------------------------------------------
  //
  // The only message in this map that tells the caller what to DO. It can afford to: the fact that
  // a gym has one owner is not a secret from that gym's own administrator, and "not permitted"
  // would send them to support for something they can fix in one step themselves.
  LAST_OWNER_PROTECTED:
    'This is the only owner of this gym. Add a second owner before removing or demoting this one.',

  // --- M-025, impersonation -------------------------------------------------

  // Names the remedy, because there is one and it takes a single click. A bare "forbidden"
  // would send a support agent to raise a ticket about a restriction working as designed.
  IMPERSONATION_FINANCIAL_MUTATION_REFUSED:
    'Money cannot be moved while impersonating another user. End the session and try again as ' +
    'yourself.',

  IMPERSONATION_REFUSED:
    'That impersonation session cannot be started. Check the reason and the duration.',

  // --- M-024, the second factor -------------------------------------------

  // ┌─ DELIBERATELY UNINFORMATIVE, AND THAT IS THE REQUIREMENT ────────────────────────────────┐
  // │ Wrong code, replayed code, wrong recovery code, no enrolment at all — one sentence for all │
  // │ of them. Any hint of which turns the endpoint into an oracle for whether an account holds  │
  // │ a second factor, and a staff account is exactly what an attacker wants to identify.        │
  // └────────────────────────────────────────────────────────────────────────────────────────────┘
  MFA_VERIFICATION_FAILED: 'That code was not accepted. Check your authenticator and try again.',

  // The opposite: as informative as possible, because the client is meant to ACT on it —
  // `Security.md` §2.8 has the console start enrolment from this exact code.
  MFA_ENROLMENT_REQUIRED:
    'Your account needs a second factor before you can continue. Set one up to carry on.',

  // Says what to do INSTEAD, because the person reading it has almost certainly lost their phone
  // and is looking for the exit rather than an explanation of policy.
  MFA_MANDATORY_FOR_ROLE:
    'Two-factor authentication cannot be switched off for this account. If you have lost your ' +
    'device, sign in with a recovery code and set up a new authenticator.',

  MFA_NOT_AVAILABLE_FOR_ROLE:
    'Two-factor authentication is not available for this kind of account yet.',

  // --- M-020, the password path -------------------------------------------
  //
  // `ACCOUNT_LOCKED`'s real message is assembled per request and arrives on the exception's
  // `clientMessage` — UM1 requires the count, the window, the masked channel and the local
  // unlock time, and a static map cannot carry them. This entry is the floor if that is ever
  // absent, and it is deliberately still actionable rather than a bare "Account locked", which
  // Authentication.md §6 says fails review.
  ACCOUNT_LOCKED:
    'This account is temporarily locked after repeated unsuccessful sign-in attempts. ' +
    'You can unlock it with a verification code, or wait for the lock to lift.',
  PASSWORD_BREACHED:
    'This password has appeared in a known data breach, so it is one of the first an attacker ' +
    'will try. Please choose a different one.',
  // Both conflicts name the field WITHOUT confirming an account exists to an unauthenticated
  // caller — the address was submitted by that caller, so echoing the fact tells them nothing
  // they did not already supply. Registration is the one place §1.6's enumeration rule bends,
  // and Authentication.md §8.3 accepts it: refusing to say would make the form unusable.
  EMAIL_ALREADY_REGISTERED:
    'An account already exists with this email address. Try signing in, or reset your password.',
  PHONE_ALREADY_REGISTERED:
    'An account already exists with this mobile number. Try signing in, or reset your password.',
  // "Invalid or expired" as ONE message, deliberately. Distinguishing them tells an attacker
  // whether a guessed token ever existed.
  RESET_TOKEN_INVALID:
    'This password reset link is invalid or has expired. Please request a new one.',
  VERIFICATION_TOKEN_INVALID:
    'This verification link is invalid or has expired. Please request a new one.',

  // --- M-021, phone OTP ----------------------------------------------------
  //
  // OTP_INVALID carries `attempts_remaining` in details and a per-request clientMessage that
  // quotes it — AC-AUTH-01.3, because "wrong code" without a count leaves the member guessing
  // whether the next attempt locks them out. This is the floor if that is ever absent.
  OTP_INVALID: 'That code is not correct. Please check the message and try again.',
  OTP_EXPIRED: 'That code has expired — codes are valid for 5 minutes. Please request a new one.',
  OTP_ATTEMPTS_EXCEEDED:
    'Too many incorrect attempts. That code is no longer valid — please request a new one.',
  OTP_RESEND_LIMIT_REACHED:
    'You have requested several codes recently. Please wait before requesting another, or ' +
    'sign in with your password instead.',
  OTP_RESEND_TOO_SOON:
    'A code was just sent. Please wait a moment before requesting another — it can take up to ' +
    'a minute to arrive.',
  CAPTCHA_REQUIRED:
    'Please complete the verification challenge to continue. This protects the service from ' +
    'automated abuse.',
};

const GENERIC_500 = 'An internal error occurred.';

/**
 * Structural check rather than `instanceof ZodError` — the DUAL-PACKAGE HAZARD.
 *
 * zod ships both a CJS and an ESM build. `instanceof` compares against ONE constructor, so an
 * error produced by the ESM copy fails an `instanceof` against the CJS copy even though both are
 * genuinely `ZodError`. The two copies coexist whenever anything in the graph resolves the other
 * format — a workspace package, a test runner, a bundler. The failure mode is silent and severe:
 * every schema failure degrades from a 400 with field-level details to an opaque 500, and it only
 * appears once the resolution graph changes.
 *
 * Duck-typing on `name` plus a well-formed `issues` array is stable across both copies.
 */
function isZodError(value: unknown): value is ZodError {
  return (
    value instanceof Error &&
    value.name === 'ZodError' &&
    Array.isArray((value as { issues?: unknown }).issues)
  );
}

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = currentCorrelationId();

    const { status, body, logLevel, operatorMessage } = this.translate(exception, correlationId);

    // The operator-facing record. Carries everything the envelope deliberately omits.
    const logPayload = {
      correlation_id: correlationId,
      code: body.error.code,
      status,
      method: request?.method,
      // `route.path` is the PATTERN (`/v1/gyms/:id`), not the populated URL. The populated URL
      // can carry an id or a search term in the query string, which BR-DAT-06 keeps out of logs.
      route: request?.route?.path ?? '(unmatched)',
      err:
        exception instanceof Error
          ? { name: exception.name, message: exception.message }
          : exception,
      details: redactDeep(body.error.details),
    };

    if (logLevel === 'error') {
      this.logger.error(operatorMessage, (exception as Error)?.stack, JSON.stringify(logPayload));
    } else {
      this.logger.warn(`${operatorMessage} ${JSON.stringify(logPayload)}`);
    }

    // Always echo the correlation id, including on errors — this is the value support asks for.
    response.setHeader(CORRELATION_HEADER, correlationId);
    response.status(status).json(body);
  }

  private translate(
    exception: unknown,
    correlationId: string,
  ): { status: number; body: ErrorEnvelope; logLevel: 'warn' | 'error'; operatorMessage: string } {
    // --- 1. A domain exception: the expected path. Status comes from the registry. ---
    if (exception instanceof DomainException) {
      return {
        status: exception.httpStatus,
        // A 5xx domain exception is our bug even though it is typed; a 4xx is the caller's.
        logLevel: exception.httpStatus >= 500 ? 'error' : 'warn',
        operatorMessage: exception.message,
        body: this.envelope(
          exception.code,
          // The per-request override first — see `DomainException.clientMessage`. Only
          // `ACCOUNT_LOCKED` uses it today, because UM1 requires four per-request values in
          // the text and a static map cannot carry them. The map is the floor, GENERIC_500
          // the floor beneath that.
          exception.clientMessage ?? CLIENT_SAFE_MESSAGE[exception.code] ?? GENERIC_500,
          [...exception.details],
          correlationId,
        ),
      };
    }

    // --- 2. A Zod failure that escaped the validation pipe. ---
    if (isZodError(exception)) {
      return {
        status: HttpStatus.BAD_REQUEST,
        logLevel: 'warn',
        operatorMessage: 'Request failed schema validation.',
        body: this.envelope(
          'VALIDATION_FAILED',
          CLIENT_SAFE_MESSAGE.VALIDATION_FAILED!,
          exception.issues.map((issue): ProblemDetail => {
            const field = issue.path.join('.');
            // The key is OMITTED rather than set to undefined — `exactOptionalPropertyTypes` is
            // on, and `{ field: undefined }` also serialises to a null-ish field on the wire.
            // Zod's message names the constraint, not the submitted value, so it is safe to
            // return. `received` is deliberately NOT included: for a password or an OTP that
            // would echo the secret straight back into the client's console and our logs.
            return field
              ? { field, rule: issue.code, message: issue.message }
              : { rule: issue.code, message: issue.message };
          }),
          correlationId,
        ),
      };
    }

    // --- 3. A Nest HttpException — 404s from the router, guard rejections, etc. ---
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = this.codeForStatus(status);
      return {
        status,
        logLevel: status >= 500 ? 'error' : 'warn',
        operatorMessage: exception.message,
        body: this.envelope(
          code,
          // A framework 4xx message ("Cannot GET /admin") is safe and useful; a 5xx one is not.
          status < 500
            ? (CLIENT_SAFE_MESSAGE[code as ErrorCode] ?? exception.message)
            : GENERIC_500,
          [],
          correlationId,
        ),
      };
    }

    // --- 4. Anything else. AC-FND-09.6: never echo the raw message. ---
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      logLevel: 'error',
      operatorMessage: 'Unhandled exception reached the global filter.',
      body: this.envelope('INTERNAL_ERROR', GENERIC_500, [], correlationId),
    };
  }

  /**
   * AC-FND-09.3 — the §C3.1 status mapping, for FRAMEWORK exceptions that carry no code.
   *
   * Only the statuses Nest itself raises are mapped: 404 from the router, 401/403 from guards,
   * 400 from pipes, 429 from the throttler. 410 and 422 are absent deliberately — those come
   * from domain code, which throws a `DomainException` carrying its own specific registry code
   * (`ORDER_EXPIRED`, `MEMBERSHIP_NOT_STACKABLE`, …) and never reaches this branch. Inventing
   * generic 410/422 codes here would give call sites a vague code to reach for instead of the
   * precise one their module owns.
   */
  private codeForStatus(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_FAILED';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHENTICATED';
      case HttpStatus.FORBIDDEN:
        return 'PERMISSION_DENIED';
      case HttpStatus.NOT_FOUND:
        return 'RESOURCE_NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'IDEMPOTENCY_KEY_MISMATCH';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'DEPENDENCY_UNAVAILABLE';
      default:
        return 'INTERNAL_ERROR';
    }
  }

  /**
   * Builds the envelope, refusing to put an unregistered code on the wire.
   *
   * §13.2.1 makes the registry the platform's entire error vocabulary: clients branch on these
   * strings and old app versions live for months. A typo'd or invented code would be a contract
   * a client can never rely on, so it degrades to `INTERNAL_ERROR` and logs loudly rather than
   * shipping quietly (Security.md P3 — fail loudly, never silently).
   */
  private envelope(
    code: string,
    message: string,
    details: ProblemDetail[],
    correlationId: string,
  ): ErrorEnvelope {
    if (!isErrorCode(code)) {
      this.logger.error(
        `Error code "${code}" is not in the §13.2 registry and was replaced with INTERNAL_ERROR. ` +
          `Add a row to packages/types/src/errors/registry.ts. correlation_id=${correlationId}`,
      );
      return {
        error: {
          code: 'INTERNAL_ERROR',
          message: GENERIC_500,
          details: [],
          correlation_id: correlationId,
        },
      };
    }
    return { error: { code, message, details, correlation_id: correlationId } };
  }
}
