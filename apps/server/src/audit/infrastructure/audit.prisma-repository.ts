/**
 * M-013 · The audit writer — a SEPARATE connection, authenticated as `gymmap_audit`.
 *
 * ┌─ WHY A SECOND POOL AND NOT `SET ROLE` ──────────────────────────────────────────────────────┐
 * │ `SET ROLE app_append` on the request connection would be shorter and is wrong. It is one    │
 * │ forgotten `RESET ROLE` away from leaving the request path holding INSERT on the audit log,  │
 * │ and the forgetting is invisible: everything keeps working, and the extra privilege sits     │
 * │ there until somebody exploits it.                                                            │
 * │                                                                                             │
 * │ Two physically separate connections also make "which connection wrote this row" answerable  │
 * │ from `pg_stat_activity` during an incident, which the SET ROLE version cannot.              │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `gymmap_audit` is a member of `app_append` and nothing else, so this connection CAN insert an
 * audit row and CANNOT read one back — the property that stops a compromised request path
 * enumerating its own trail.
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import type { AppConfig } from '../../common/config/app-config.schema.js';
import { REDACTED_FIELD_NAMES } from '../../common/logging/redaction.js';
import type { AuditEntry, AuditWritePort } from '../ports/audit-write.port.js';

@Injectable()
export class AuditPrismaRepository implements AuditWritePort, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditPrismaRepository.name);
  private readonly appendOnly: PrismaClient;

  constructor(private readonly config: AppConfig) {
    // The audit URL, or the application URL as a documented fallback. In a deployed environment
    // AUDIT_DATABASE_URL is set by Terraform to the gymmap_audit credential; locally, falling
    // back keeps `pnpm infra:up` a one-step setup. The fallback is visible in the log below so
    // nobody discovers it by reading the source during an incident.
    // '' means unset — see the schema for why empty and absent must behave identically.
    const url = this.config.AUDIT_DATABASE_URL || this.config.DATABASE_URL;
    this.appendOnly = new PrismaClient({ datasources: { db: { url } } });
  }

  async onModuleInit(): Promise<void> {
    await this.appendOnly.$connect();
    if (!this.config.AUDIT_DATABASE_URL) {
      this.logger.warn(
        'AUDIT_DATABASE_URL is unset — audit rows are being written on the APPLICATION ' +
          'connection. That connection is a member of app_rw, which holds SELECT on audit_log, ' +
          'so the "writer cannot read the log" property does not hold in this environment. ' +
          'Acceptable locally; set it in anything deployed.',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.appendOnly.$disconnect();
  }

  /**
   * Appends one row.
   *
   * ┌─ A FAILED AUDIT WRITE DOES NOT FAIL THE REQUEST, AND THAT IS A REAL TRADE-OFF ────────────┐
   * │ Two options, both bad in different ways:                                                  │
   * │                                                                                           │
   * │   throw    a database hiccup on the audit connection turns every mutation into a 500.     │
   * │            An audit outage becomes a total outage.                                        │
   * │   swallow  the action happens with no record of it, which is the thing BR-DAT-01 exists   │
   * │            to prevent.                                                                     │
   * │                                                                                           │
   * │ This swallows AND alerts at error level with the full entry, so the record survives in    │
   * │ the log aggregator even when the table write failed. Monitoring.md alert 8 pages on it.   │
   * │                                                                                           │
   * │ For the actions where the record matters MORE than availability — an elevation, an        │
   * │ impersonation, a KYC document view — `runElevated()` (M-014) writes the row FIRST and      │
   * │ refuses to proceed if it cannot. That is the right split: the interceptor is best-effort, │
   * │ the deliberate high-consequence paths are not.                                             │
   * └───────────────────────────────────────────────────────────────────────────────────────────┘
   */
  async append(entry: AuditEntry): Promise<void> {
    try {
      await this.appendOnly.$executeRaw`
        INSERT INTO audit_log (
          id, occurred_at, tenant_id, actor_id, actor_type, actor_label, impersonated_by,
          entity_type, entity_id, action, before, after,
          reason, reason_code, permission, elevation_scope,
          ip, user_agent, correlation_id, request_id
        ) VALUES (
          gen_random_uuid(), now(),
          ${entry.tenantId}::uuid, ${entry.actorId}::uuid, ${entry.actorType}::actor_type_enum,
          ${entry.actorLabel ?? null}, ${entry.impersonatedBy ?? null}::uuid,
          ${entry.entityType}::audit_entity_type_enum, ${entry.entityId}::uuid,
          ${entry.action}::audit_action_enum,
          ${redact(entry.before)}::jsonb, ${redact(entry.after)}::jsonb,
          ${entry.reason ?? null}, ${entry.reasonCode ?? null},
          ${entry.permission ?? null}, ${entry.elevationScope ?? null},
          ${entry.ip ?? null}::inet, ${truncate(entry.userAgent)},
          ${entry.correlationId}::uuid, ${entry.requestId ?? null}::uuid
        )`;
    } catch (error) {
      this.logger.error({
        message: 'AUDIT WRITE FAILED — the action proceeded with no database record',
        // The entry itself, so the record survives here even though the table write did not.
        // Already redacted by `redact()` below, so this is not a BR-DAT-06 loophole.
        entry: { ...entry, before: redact(entry.before), after: redact(entry.after) },
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Redacts `before`/`after` through the SAME deny-list as the logger. AC-9.
 *
 * An audit row is not a BR-DAT-06 loophole. Without this, a `before`/`after` on a user update
 * carries the phone number, the email and the PAN — into a table retained for seven years, in
 * a column nobody thinks of as a log.
 */
function redact(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(redactDeep(value));
}

function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = REDACTED_FIELD_NAMES.some((name) => key.toLowerCase().includes(name.toLowerCase()))
      ? '[REDACTED]'
      : redactDeep(v, depth + 1);
  }
  return out;
}

/** 512 bytes, per the column's CHECK. Truncating here gives a row rather than a failed insert. */
function truncate(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  return userAgent.length > 512 ? userAgent.slice(0, 512) : userAgent;
}
