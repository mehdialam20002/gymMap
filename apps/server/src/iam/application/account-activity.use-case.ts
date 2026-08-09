/**
 * `M-025` `AC-8` · What the account holder can see about their own account — `FR-USER-05`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * A PROJECTION OF `audit_log`, NOT A SECOND TABLE — AND THE CHOICE WAS FORCED
 *
 * `Schema.md` §4's table register is CLOSED at seventy-nine. An eightieth is a constitution §24
 * amendment, which is the owner's and not a milestone's — the same wall `BLK-08` hit for
 * `job_runs`. So `account_activity` could not be created, and this reads the rows that already
 * exist.
 *
 * It is also the better answer for a reason that is not availability: two tables recording the same
 * event drift. The row a user sees and the row an investigator sees would be written by different
 * code, and the first bug is the pair disagreeing about an event the user is disputing.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ THE RISK A PROJECTION CARRIES, AND WHAT IS DONE ABOUT IT ──────────────────────────────────┐
 * │ Filtering an operational log into a user-facing view is how "we only show the ones we think   │
 * │ you need to know about" happens by accident: somebody adds an event type, nobody adds it to    │
 * │ the filter, and the user's log silently stops being complete.                                  │
 * │                                                                                              │
 * │ So the allowlist below is EXPLICIT and its omissions are stated. `FR-USER-05` names four       │
 * │ things — logins, devices, impersonations, data exports — and the entity types are mapped one   │
 * │ by one, with the ones that do not exist yet listed rather than silently absent.                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_READ_PORT, type AuditReadPort, type AuditRow } from '../../audit/ports/audit-read.port.js';

/**
 * `FR-USER-05`: *"logins, devices, impersonations, data exports"*.
 *
 * | Requirement    | Entity type      | State                                              |
 * | :------------- | :--------------- | :------------------------------------------------- |
 * | impersonations | `AUTH_SESSION`   | written by `M-025`                                  |
 * | devices        | `AUTH_SESSION`   | same type — a session IS the device record          |
 * | logins         | `AUTH_SESSION`   | `M-020` writes login events under this type         |
 * | data exports   | `EXPORT_JOB`     | NOT YET WRITTEN — the export path is a later epic   |
 *
 * `EXPORT_JOB` is listed anyway. When the export milestone writes its first row, the user's log
 * shows it without anybody remembering this file exists — which is the failure mode an allowlist
 * usually causes, avoided by naming the type before it has rows rather than after.
 */
export const ACCOUNT_ACTIVITY_ENTITY_TYPES: readonly string[] = [
  'AUTH_SESSION',
  'USER',
  'EXPORT_JOB',
];

export interface AccountActivityEntry {
  readonly occurredAt: Date;
  readonly kind: 'IMPERSONATION_STARTED' | 'IMPERSONATION_ENDED' | 'SECURITY_CHANGE' | 'SESSION';
  /** `AC-8` — the reason, verbatim, for an impersonation. */
  readonly reason: string | null;
  /** `AC-8` — how long it lasted, for the row that ended one. */
  readonly durationMinutes: number | null;
  /**
   * Whether somebody ELSE was acting as this user.
   *
   * A boolean, not the agent's id. The user is entitled to know an impersonation happened, and
   * naming the individual support agent to a customer is a staff-safety question nobody has
   * decided — so the fact is shown and the identity stays in `audit_log` for the investigation.
   */
  readonly wasImpersonated: boolean;
}

@Injectable()
export class AccountActivityUseCase {
  constructor(@Inject(AUDIT_READ_PORT) private readonly audit: AuditReadPort) {}

  /**
   * One user's own activity, newest first.
   *
   * `entityId` is the caller's own `sub` and is never a parameter from the request — a `/me` route
   * that accepted an id would be an audit-log read for any account, dressed as a self-service page.
   */
  async forUser(userId: string, limit = 50): Promise<readonly AccountActivityEntry[]> {
    const rows = await this.audit.findByEntity({ entityId: userId, limit });

    return rows
      .filter((row) => ACCOUNT_ACTIVITY_ENTITY_TYPES.includes(row.entityType))
      .map((row) => toEntry(row));
  }
}

function toEntry(row: AuditRow): AccountActivityEntry {
  return {
    occurredAt: row.occurredAt,
    kind: kindOf(row),
    reason: row.reason,
    durationMinutes: durationOf(row.after),
    wasImpersonated: row.impersonatedBy !== null,
  };
}

/**
 * The duration `end-impersonation` wrote into `after`, or `null`.
 *
 * Narrowed rather than cast. `after` is `jsonb` and therefore genuinely `unknown` — a row written by
 * a future code path may hold anything, and a cast would turn that into a number-shaped lie on a
 * screen the user is reading to decide whether to complain.
 */
function durationOf(after: unknown): number | null {
  if (typeof after !== 'object' || after === null) return null;
  const value = (after as Record<string, unknown>)['durationMinutes'];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function kindOf(row: AuditRow): AccountActivityEntry['kind'] {
  if (row.entityType === 'USER') return 'SECURITY_CHANGE';
  if (row.impersonatedBy === null) return 'SESSION';
  return row.action === 'DELETE' ? 'IMPERSONATION_ENDED' : 'IMPERSONATION_STARTED';
}
