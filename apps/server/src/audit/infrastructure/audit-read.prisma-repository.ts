/**
 * `M-025` · Reading the audit log — `FR-USER-05`, `AC-8`, `BAC-13`.
 *
 * ┌─ A DIFFERENT SERVICE FROM THE WRITER, AND THE GRANTS SAY WHY ───────────────────────────────┐
 * │ `AuditPrismaService` runs as `app_append`, which holds INSERT on `audit_log` and nothing else │
 * │ — it exposes only `executeRaw`, deliberately, so the append-only client cannot be turned into │
 * │ a reader by a convenient method. `app_rw` holds SELECT and no INSERT.                          │
 * │                                                                                              │
 * │ The database enforces the split, so this reader uses the ORDINARY `PrismaService`. Adding a    │
 * │ `queryRaw` to the append service would have been one line and would have put read and write   │
 * │ behind the same role, which is the arrangement the two grants exist to prevent.                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Both queries are index-backed (`BAC-13`): `idx_audit_log__entity_occurred` and
 * `idx_audit_log__actor_occurred`. A third query shape would be a sequential scan over a table that
 * only grows, which is why the port offers exactly these two.
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../tenancy/prisma/prisma.service.js';
import type { AuditQuery, AuditReadPort, AuditRow } from '../ports/audit-read.port.js';

/** The row shape the two queries return. `after` carries the durations and counts a caller needs. */
interface RawRow {
  id: string;
  occurred_at: Date;
  actor_id: string | null;
  actor_type: string;
  impersonated_by: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  reason: string | null;
  after: unknown;
  correlation_id: string;
}

/** Bounded, and not by the caller alone. An unbounded read of an append-only table is a page-out. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class AuditReadPrismaRepository implements AuditReadPort {
  constructor(private readonly db: PrismaService) {}

  async findByEntity(query: AuditQuery): Promise<readonly AuditRow[]> {
    const rows = await this.db.client.$queryRaw<RawRow[]>`
      SELECT id, occurred_at, actor_id, actor_type, impersonated_by,
             entity_type, entity_id, action, reason, after, correlation_id
        FROM audit_log
       WHERE entity_id = ${query.entityId}::uuid
         AND (${query.entityType ?? null}::text IS NULL OR entity_type::text = ${query.entityType ?? null})
         AND (${query.from ?? null}::timestamptz IS NULL OR occurred_at >= ${query.from ?? null}::timestamptz)
         AND (${query.to ?? null}::timestamptz IS NULL OR occurred_at <= ${query.to ?? null}::timestamptz)
       ORDER BY occurred_at DESC
       LIMIT ${boundedLimit(query.limit)}`;

    return rows.map(toRow);
  }

  async findByActor(query: AuditQuery): Promise<readonly AuditRow[]> {
    const rows = await this.db.client.$queryRaw<RawRow[]>`
      SELECT id, occurred_at, actor_id, actor_type, impersonated_by,
             entity_type, entity_id, action, reason, after, correlation_id
        FROM audit_log
       WHERE actor_id = ${query.actorId}::uuid
         AND (${query.from ?? null}::timestamptz IS NULL OR occurred_at >= ${query.from ?? null}::timestamptz)
         AND (${query.to ?? null}::timestamptz IS NULL OR occurred_at <= ${query.to ?? null}::timestamptz)
       ORDER BY occurred_at DESC
       LIMIT ${boundedLimit(query.limit)}`;

    return rows.map(toRow);
  }
}

/**
 * Clamped, never trusted.
 *
 * A caller asking for a million rows is not malicious most of the time and the effect is the same:
 * the table only grows, so the worst request is the one written before it was big.
 */
function boundedLimit(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested) || requested < 1) return DEFAULT_LIMIT;
  return Math.min(Math.trunc(requested), MAX_LIMIT);
}

function toRow(raw: RawRow): AuditRow {
  return {
    id: raw.id,
    occurredAt: raw.occurred_at,
    actorId: raw.actor_id,
    actorType: raw.actor_type,
    impersonatedBy: raw.impersonated_by,
    entityType: raw.entity_type,
    entityId: raw.entity_id,
    action: raw.action,
    reason: raw.reason,
    after: raw.after,
    correlationId: raw.correlation_id,
  };
}
