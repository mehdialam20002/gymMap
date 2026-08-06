/**
 * M-003 · The error-code registry — constitution §13.2, C1.5, C3.1.
 *
 * §13.2.1 fixes this file as the registry's location and requires a single `as const` object.
 * Every error the platform can return has exactly one row here, and the `ErrorCode` union is
 * DERIVED from it (`error-code.ts`) rather than maintained beside it. That derivation is the
 * point: a hand-maintained union and a hand-maintained table drift, and the drift shows up as
 * a client that cannot branch on a code the server actually emits.
 *
 * Stability rules that make this file append-mostly (§13.2.1):
 *   · A code is never renamed. Clients branch on it and old app versions live for months.
 *   · A code is never reused for a different meaning.
 *   · A retired code stays here marked `RETIRED` with the version that stopped emitting it.
 *
 * This milestone seeds the `common`, `tenancy` and `iam` slices only. Module milestones append
 * their own rows; the CI check in §13.2.1 fails any thrown domain error whose code is absent.
 *
 * ┌─ REGISTRY DISCREPANCY, raised rather than silently resolved ───────────────────────────┐
 * │ `Milestones_000-029.md` M-003 lists `IDEMPOTENCY_KEY_REUSED`. Constitution §13.2.2 —   │
 * │ the registry's own governing clause — lists `IDEMPOTENCY_KEY_MISMATCH` for the same    │
 * │ condition (`BR-PAY-03`, `C1.5`). Two codes for one condition would breach the          │
 * │ uniqueness rule, so this file adopts the constitution's spelling, which outranks the   │
 * │ roadmap. Tracked so the roadmap wording is corrected rather than quietly diverging.    │
 * └────────────────────────────────────────────────────────────────────────────────────────┘
 */

/** §13.1 error classes. Determines the HTTP status and whether the error is the caller's fault. */
export type ErrorClass =
  | 'Validation'
  | 'Authentication'
  | 'Authorisation'
  | 'NotFound'
  | 'Conflict'
  | 'Business'
  | 'RateLimit'
  | 'Gone'
  | 'System';

/** The owning module — one of the twenty-three of §C1.3. A code belongs to exactly one. */
export type OwningModule =
  | 'common'
  | 'tenancy'
  | 'iam'
  | 'onboarding'
  | 'catalog'
  | 'plans'
  | 'discovery'
  | 'ordering'
  | 'payments'
  | 'billing'
  | 'memberships'
  | 'attendance'
  | 'crm'
  | 'staff'
  | 'reviews'
  | 'ledger'
  | 'settlements'
  | 'refunds'
  | 'notifications'
  | 'reporting'
  | 'support'
  | 'admin'
  | 'audit';

/** One registry row. Columns are fixed by §13.2.1. */
export interface ErrorRegistryRow {
  readonly module: OwningModule;
  readonly class: ErrorClass;
  readonly httpStatus: number;
  /** i18n key, `NFR-USE-08`. The wire `message` is rendered from this, never hardcoded English. */
  readonly messageKey: string;
  /** The `BR-`/`FR-`/`NFR-`/`C`-clause identifiers this code enforces. Never empty. */
  readonly enforces: readonly string[];
  /** Whether the caller may retry the identical request unchanged and expect a different result. */
  readonly retryable: boolean;
  /** Shape of the `details[]` entries, when the code carries any. */
  readonly detailsShape?: string;
  /** Set when the code is no longer emitted. The row stays forever (§13.2.1). */
  readonly retiredInVersion?: string;
}

export const ERROR_REGISTRY = {
  // --- common -------------------------------------------------------------
  VALIDATION_FAILED: {
    module: 'common',
    class: 'Validation',
    httpStatus: 400,
    messageKey: 'error.common.validation_failed',
    enforces: ['C1.5', 'C3.1', 'NFR-SEC-05'],
    retryable: false,
    detailsShape: '{ field: string; rule: string; }',
  },
  /**
   * The terminal fallback. Emitted when an unrecognised throwable reaches the global filter, and
   * when a code with no registry row would otherwise reach the wire.
   *
   * Carries no detail by design (AC-FND-09.6 / SEC-A03-005): a Prisma message contains the SQL
   * and often a parameter value, a filesystem error an absolute path, an HTTP client error the
   * upstream URL with its query string. The full error goes to the log against the correlation
   * id, so support loses nothing while an attacker gains nothing.
   */
  INTERNAL_ERROR: {
    module: 'common',
    class: 'System',
    httpStatus: 500,
    messageKey: 'error.common.internal_error',
    enforces: ['AC-FND-09.6', 'SEC-A03-005', 'C3.1'],
    retryable: false,
  },
  RESOURCE_NOT_FOUND: {
    module: 'common',
    class: 'NotFound',
    httpStatus: 404,
    messageKey: 'error.common.resource_not_found',
    enforces: ['C3.1'],
    retryable: false,
  },
  UNAUTHENTICATED: {
    module: 'common',
    class: 'Authentication',
    httpStatus: 401,
    messageKey: 'error.common.unauthenticated',
    enforces: ['C1.4', 'FR-AUTH-01'],
    retryable: false,
  },
  RATE_LIMIT_EXCEEDED: {
    module: 'common',
    class: 'RateLimit',
    httpStatus: 429,
    messageKey: 'error.common.rate_limit_exceeded',
    enforces: ['NFR-SEC-06', 'C3.1'],
    // Retryable after the window. `Retry-After` and `X-RateLimit-*` carry the wait (§C3.1).
    retryable: true,
  },
  DEPENDENCY_UNAVAILABLE: {
    module: 'common',
    class: 'System',
    httpStatus: 503,
    messageKey: 'error.common.dependency_unavailable',
    enforces: ['NFR-AVL-03', 'NFR-AVL-07'],
    retryable: true,
  },
  IDEMPOTENCY_KEY_REQUIRED: {
    module: 'common',
    class: 'Validation',
    httpStatus: 400,
    messageKey: 'error.common.idempotency_key_required',
    enforces: ['C3.1', 'BR-PAY-03'],
    retryable: false,
  },
  IDEMPOTENCY_KEY_MISMATCH: {
    module: 'common',
    class: 'Conflict',
    httpStatus: 409,
    messageKey: 'error.common.idempotency_key_mismatch',
    enforces: ['BR-PAY-03', 'C1.5'],
    // Emphatically NOT retryable. The key was already used with a DIFFERENT body; retrying the
    // same request reproduces the conflict, and retrying with a new key may double-charge.
    retryable: false,
    detailsShape: '{ idempotency_key: string; first_seen_at: string; }',
  },
  CURRENCY_MISMATCH: {
    module: 'common',
    class: 'Validation',
    httpStatus: 422,
    messageKey: 'error.common.currency_mismatch',
    enforces: ['BR-PAY-01', 'NFR-DQ-02'],
    retryable: false,
    detailsShape: '{ expected: string; received: string; }',
  },

  // --- tenancy ------------------------------------------------------------
  TENANT_HEADER_NOT_ACCEPTED: {
    module: 'tenancy',
    class: 'Validation',
    httpStatus: 400,
    messageKey: 'error.tenancy.tenant_header_not_accepted',
    enforces: ['C1.4', 'C3.1', 'BR-TEN-01', '§11.3'],
    retryable: false,
  },
  TENANT_CONTEXT_MISSING: {
    module: 'tenancy',
    class: 'System',
    httpStatus: 500,
    messageKey: 'error.tenancy.tenant_context_missing',
    enforces: ['C1.4', 'BR-TEN-01', '§11.5 BR2'],
    // A 500, never a 403 and never an empty result set (Security.md P3). An empty result set is
    // indistinguishable from a correct answer, so the isolation failure would go unnoticed.
    retryable: false,
  },
  TENANT_CONTEXT_ALREADY_SET: {
    module: 'tenancy',
    class: 'System',
    httpStatus: 500,
    messageKey: 'error.tenancy.tenant_context_already_set',
    enforces: ['BR-TEN-01', 'ADR-0005', '§11.5'],
    // Re-entrant context means one transaction spans two tenants. Fail before the query runs.
    retryable: false,
  },

  // --- iam ----------------------------------------------------------------
  PERMISSION_DENIED: {
    module: 'iam',
    class: 'Authorisation',
    httpStatus: 403,
    messageKey: 'error.iam.permission_denied',
    enforces: ['FR-RBAC-01', 'FR-RBAC-02'],
    retryable: false,
  },
} as const satisfies Record<string, ErrorRegistryRow>;
