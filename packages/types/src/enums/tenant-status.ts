/**
 * M-003 · Tenant lifecycle states — §C2.2, §C4.4, `Schema.md` line 313.
 *
 * These strings are the `tenant_status_enum` values in Postgres, character for character
 * (roadmap AC-5, constitution §8.3). A mismatch between this file and the migration is not a
 * type error anywhere — Prisma would hand back a string the application has no branch for, and
 * the tenant would render as neither approved nor rejected.
 *
 * A plain `as const` object rather than a TypeScript `enum`: a TS enum emits a runtime object
 * with reverse mappings, is not erasable (so Node's native type stripping cannot run it), and
 * is nominally typed in a way that makes a database round-trip need a cast at every boundary.
 */

export const TENANT_STATUS = {
  /** Created, not yet submitted. Visible only to its own owner (`BR-GYM-01`). */
  DRAFT: 'DRAFT',
  /** Submitted for review; awaiting reviewer assignment. */
  SUBMITTED: 'SUBMITTED',
  /** A reviewer is assigned and working the application. */
  UNDER_REVIEW: 'UNDER_REVIEW',
  /** The reviewer asked for more; the clock stops and the applicant can edit (`FR-ONB-*`). */
  INFO_REQUESTED: 'INFO_REQUESTED',
  /** Verified. THE ONLY state in which the gym is publicly discoverable (`BR-GYM-01`). */
  APPROVED: 'APPROVED',
  /** Declined with reason codes. May return to `DRAFT` and resubmit (§C4.4). */
  REJECTED: 'REJECTED',
  /** Was approved, now withheld from discovery. Reversible — back to `APPROVED` (§C4.4). */
  SUSPENDED: 'SUSPENDED',
  /** Terminal. Data retained per the retention schedule; never returns to `APPROVED`. */
  CLOSED: 'CLOSED',
} as const satisfies Record<string, string>;

export type TenantStatus = (typeof TENANT_STATUS)[keyof typeof TENANT_STATUS];

export const TENANT_STATUSES = Object.values(TENANT_STATUS) as readonly TenantStatus[];

export function isTenantStatus(raw: unknown): raw is TenantStatus {
  return typeof raw === 'string' && (TENANT_STATUSES as readonly string[]).includes(raw);
}

/**
 * The states in which a gym appears in public discovery.
 *
 * Expressed as a set rather than as `status === 'APPROVED'` scattered across discovery, search
 * indexing, sitemap generation and the ordering guard. Four independent copies of one predicate
 * is how a suspended gym stays bookable after someone updates three of them (`BR-GYM-01`).
 */
export const PUBLICLY_VISIBLE_TENANT_STATUSES: readonly TenantStatus[] = [TENANT_STATUS.APPROVED];

export function isPubliclyVisible(status: TenantStatus): boolean {
  return PUBLICLY_VISIBLE_TENANT_STATUSES.includes(status);
}

/**
 * Legal transitions of the §C4.4 state machine.
 *
 * Encoded here so the guard in `onboarding` (M-020) reads the table rather than reimplementing
 * the diagram. `CLOSED` and the terminal edges are explicit: an empty array means terminal, not
 * "not yet filled in".
 */
export const TENANT_STATUS_TRANSITIONS = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['INFO_REQUESTED', 'APPROVED', 'REJECTED'],
  INFO_REQUESTED: ['UNDER_REVIEW'],
  APPROVED: ['SUSPENDED', 'CLOSED'],
  REJECTED: ['DRAFT'],
  SUSPENDED: ['APPROVED', 'CLOSED'],
  CLOSED: [],
} as const satisfies Record<TenantStatus, readonly TenantStatus[]>;

export function canTransition(from: TenantStatus, to: TenantStatus): boolean {
  return (TENANT_STATUS_TRANSITIONS[from] as readonly TenantStatus[]).includes(to);
}
