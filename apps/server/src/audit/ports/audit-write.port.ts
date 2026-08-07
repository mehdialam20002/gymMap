/**
 * M-013 · `AUDIT_WRITE_PORT` — INTERNAL. Injected by the interceptor and by `runElevated()`.
 *
 * ┌─ NOT EXPORTED FROM `audit/index.ts`, AND THAT IS DELIBERATE ────────────────────────────────┐
 * │ FolderStructure.md §8.2: the audit WRITER must not be reachable from the administration UI. │
 * │ A module that can write an audit row can write a FALSE one — and a false entry in an        │
 * │ append-only log is permanent, unfalsifiable and indistinguishable from a true one.          │
 * │                                                                                             │
 * │ `admin/` gets `AUDIT_READ_PORT` and nothing else. The only writers are the `@Audited()`     │
 * │ interceptor and `runElevated()`, both of which write BEFORE the work they describe.          │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/** One row. Fourteen fields of AC-FND-11.1 plus the structured extras of AuditStrategy §2. */
export interface AuditEntry {
  readonly tenantId: string | null;
  readonly actorId: string | null;
  readonly actorType: string;
  /** For JOB and WEBHOOK: the job name or provider. NEVER a person's name — that is C3. */
  readonly actorLabel?: string | null;
  /** BR-DAT-02: present on EVERY row of an impersonation session, not just the first. */
  readonly impersonatedBy?: string | null;
  readonly entityType: string;
  readonly entityId: string;
  readonly action: string;
  /** Changed fields only, already redacted. Never the whole row. */
  readonly before?: unknown;
  readonly after?: unknown;
  readonly reason?: string | null;
  readonly reasonCode?: string | null;
  readonly permission?: string | null;
  readonly elevationScope?: string | null;
  readonly ip?: string | null;
  readonly userAgent?: string | null;
  readonly correlationId: string;
  readonly requestId?: string | null;
}

export interface AuditWritePort {
  /**
   * Appends one row.
   *
   * Never throws into the caller's path on a WRITE failure — see the repository for why, and
   * for what it does instead.
   */
  append(entry: AuditEntry): Promise<void>;
}

export const AUDIT_WRITE_PORT = Symbol('AuditWritePort');
