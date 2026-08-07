/**
 * M-004 · The domain exception hierarchy — constitution §13.1, §13.2, §C3.1.
 *
 * A domain exception carries a REGISTRY CODE, not an HTTP status. The mapping from code to status
 * lives in `@gymmap/types`' registry and is applied once, in the filter. That indirection is the
 * point: a use case in `ordering` should not know or care that a stackability violation is a 422,
 * and if the mapping ever changes it changes in one row rather than in every throw site.
 */

import { type ErrorCode, errorRegistryRow } from '@gymmap/types';

/** A field-level problem, as it appears in the `details[]` array of the §C3.1 envelope. */
export interface ProblemDetail {
  readonly field?: string;
  readonly [key: string]: unknown;
}

/**
 * The base class every domain error extends.
 *
 * `message` here is for OPERATORS — it goes to the log, never to the client. The client receives
 * a message rendered from the registry's `messageKey` in its own locale (NFR-USE-08). Conflating
 * the two is how an internal string like "tenant 7f3a has no active settlement account" reaches a
 * member's browser.
 */
export class DomainException extends Error {
  readonly code: ErrorCode;
  readonly details: readonly ProblemDetail[];
  readonly httpStatus: number;

  /**
   * A client-facing message that OVERRIDES the filter's static per-code text. Usually absent.
   *
   * ┌─ WHY AN OVERRIDE EXISTS AT ALL, GIVEN `message` IS OPERATOR-ONLY ────────────────────────┐
   * │ The filter maps a code to one fixed string, which is right for almost everything: the    │
   * │ member-facing text must not vary with internal state, or it leaks it.                     │
   * │                                                                                           │
   * │ `ACCOUNT_LOCKED` cannot work that way. `UM1` and `Authentication.md` §6 require the       │
   * │ message to state the failure count, the window, the masked unlock channel and the local  │
   * │ time the lock lifts — and §6 says outright that *"'Account locked' alone fails review"*.  │
   * │ Those four values are per-request, so a static map physically cannot carry them.          │
   * │                                                                                           │
   * │ The override is therefore for messages assembled from values ALREADY SAFE to disclose to  │
   * │ this caller about their own account. It is not a general-purpose channel for internal     │
   * │ detail: `message` remains operator-only, and anything set here is read by a member.       │
   * └───────────────────────────────────────────────────────────────────────────────────────────┘
   */
  readonly clientMessage?: string;

  constructor(
    code: ErrorCode,
    operatorMessage: string,
    details: readonly ProblemDetail[] = [],
    clientMessage?: string,
  ) {
    super(operatorMessage);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
    if (clientMessage !== undefined) this.clientMessage = clientMessage;
    // An unregistered code reaches here only via a cast, but it MUST NOT throw: a constructor
    // that throws while building an error replaces the original failure with a TypeError raised
    // at the throw site, losing the real problem entirely — and it would pre-empt the filter's
    // own degrade-to-INTERNAL_ERROR path, which then becomes unreachable.
    this.httpStatus = errorRegistryRow(code)?.httpStatus ?? 500;
    // Without this, `instanceof` fails for subclasses when the output targets ES5-era semantics.
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace?.(this, new.target);
  }
}

/** §C3.1 → 400. A malformed request. */
export class ValidationException extends DomainException {
  constructor(operatorMessage: string, details: readonly ProblemDetail[] = []) {
    super('VALIDATION_FAILED', operatorMessage, details);
  }
}

/** §C3.1 → 404. */
export class NotFoundException extends DomainException {
  constructor(operatorMessage: string, details: readonly ProblemDetail[] = []) {
    super('RESOURCE_NOT_FOUND', operatorMessage, details);
  }
}

/** §C3.1 → 401. */
export class UnauthenticatedException extends DomainException {
  constructor(operatorMessage = 'No valid credential presented.') {
    super('UNAUTHENTICATED', operatorMessage);
  }
}

/** §C3.1 → 403. */
export class PermissionDeniedException extends DomainException {
  constructor(operatorMessage: string, details: readonly ProblemDetail[] = []) {
    super('PERMISSION_DENIED', operatorMessage, details);
  }
}

/**
 * §C3.1 → 422. A well-formed request that a business rule refuses.
 *
 * Distinct from 400 on purpose: 400 means "you sent nonsense", 422 means "you sent something
 * valid that the domain will not do". A client can retry a 400 after fixing the payload; a 422
 * needs the user to make a different choice.
 */
export class BusinessRuleException extends DomainException {}

/** §C3.1 → 409. A state conflict or an idempotency-key replay with a different body. */
export class ConflictException extends DomainException {}

/** §C3.1 → 503. A dependency is down. Retryable. */
export class DependencyUnavailableException extends DomainException {
  constructor(dependency: string) {
    super('DEPENDENCY_UNAVAILABLE', `Dependency unavailable: ${dependency}`);
  }
}

/**
 * §11.5 BR2 / Security.md P3 — no tenant context on a tenant-scoped operation.
 *
 * A 500, never a 403 and never an empty result set. An empty result set is indistinguishable
 * from a correct answer, so the isolation failure would go unnoticed; a 403 suggests the user
 * lacks permission, sending the investigation in the wrong direction entirely.
 */
export class TenantContextMissingException extends DomainException {
  constructor(operation: string) {
    super(
      'TENANT_CONTEXT_MISSING',
      `Tenant-scoped operation "${operation}" ran with no tenant context. This is a programming ` +
        `error, not a user error: the operation must run inside the tenant-context extension ` +
        `(ADR-0005).`,
    );
  }
}
