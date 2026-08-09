/**
 * M-013 · The audit writer — the `AuditWritePort` implementation.
 *
 * ┌─ THE CONNECTION IS NOT OWNED HERE, AND THAT IS A CORRECTION ────────────────────────────────┐
 * │ This class built its own `new PrismaClient()` until M-014, and `no-raw-prisma-outside-      │
 * │ tenancy` was right to reject it. The pool now lives in `tenancy/prisma/audit-prisma.        │
 * │ service.ts` alongside the other two, so a reviewer grepping for `new PrismaClient` finds    │
 * │ every connection in this system in one directory.                                            │
 * │                                                                                              │
 * │ Nothing about the isolation property changed: it was, and remains, the `app_append` grant —  │
 * │ `gymmap_audit` CAN insert an audit row and CANNOT read one back, which is what stops a       │
 * │ compromised request path enumerating its own trail.                                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `@prisma/client` is deliberately not imported here, not even as a type — `tsPreCompilationDeps`
 * makes a type-only import a real edge, so `AuditPrismaService.executeRaw` takes and returns
 * nothing Prisma-shaped.
 */

import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { currentImpersonatorId } from '../../common/auth/impersonation.als.js';
import { isStorableCorrelationId } from '../../common/logging/correlation.als.js';
import { REDACTED_FIELD_NAMES } from '../../common/logging/redaction.js';
// A VALUE import, not `import type`. TD-030: a type-only import is erased, so
// emitDecoratorMetadata emits `undefined` and Nest fails at RUNTIME with an error that
// points nowhere near this line. AuditPrismaService is a class and has a runtime value.
import { AuditPrismaService } from '../../tenancy/prisma/audit-prisma.service.js';
import type { AuditEntry, AuditWritePort } from '../ports/audit-write.port.js';

@Injectable()
export class AuditPrismaRepository implements AuditWritePort {
  private readonly logger = new Logger(AuditPrismaRepository.name);

  constructor(private readonly db: AuditPrismaService) {}

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
    /*
     * ┌─ `AC-7` · READ HERE, NOT PASSED BY EVERY CALLER ────────────────────────────────────────┐
     * │ "Every write under the token carries `impersonated_by`" — not only the start event. A     │
     * │ field each call site must remember is one most call sites will not, and the omission is   │
     * │ invisible: the row is written and the actions taken under a borrowed identity are exactly  │
     * │ the ones missing the borrower. This repository is the single point every write already     │
     * │ passes through, including the use cases that bypass the `@Audited()` interceptor.          │
     * │                                                                                          │
     * │ An explicit value still wins, for the ONE row that records the impersonation ending —      │
     * │ written after the frame is gone and needing to name the agent anyway.                      │
     * └──────────────────────────────────────────────────────────────────────────────────────────┘
     */
    const impersonatedBy = entry.impersonatedBy ?? currentImpersonatorId();

    /*
     * The actor TYPE follows the same fact, and must: a row saying `USER` while `impersonated_by`
     * is set contradicts itself, and a report filtering on `SUPPORT_IMPERSONATION` would miss it.
     * Only widened when the caller has not already said something more specific than `USER`.
     */
    const actorType =
      impersonatedBy !== null && entry.actorType === 'USER'
        ? 'SUPPORT_IMPERSONATION'
        : entry.actorType;

    /*
     * ┌─ THE SECOND HALF OF THE FIX IN `correlation.middleware.ts`, AND IT IS NOT REDUNDANT ──────┐
     * │ `correlation_id` is `uuid NOT NULL`, this cast is inside the `try`, and the `catch` only  │
     * │ logs. So ANY unstorable correlation id does not fail the audit write — it deletes it, and │
     * │ the action proceeds unrecorded. That was reachable from a request header until the        │
     * │ middleware was fixed to demand a uuid.                                                     │
     * │                                                                                          │
     * │ The middleware closes the HTTP door. This closes the rest of them: a job, a test harness,  │
     * │ a future caller constructing a context by hand. Losing the whole row over the one field    │
     * │ that identifies nothing about WHO did WHAT is the worst available trade, so an unstorable  │
     * │ id is replaced rather than allowed to take the record with it — loudly, because a          │
     * │ correlation id that reaches here in the wrong shape is a bug somewhere upstream.           │
     * └──────────────────────────────────────────────────────────────────────────────────────────┘
     */
    /*
     * ┌─ THE SAME DEFECT AS THE CORRELATION ID, ON THE OTHER CLIENT-INFLUENCED FIELD ─────────────┐
     * │ `ip` is `inet` and reaches `${entry.ip ?? null}::inet` inside the same `try` whose `catch` │
     * │ only logs. `SELECT 'not-an-ip'::inet` raises, so ANY unparseable address deletes the whole │
     * │ audit row rather than the one field — the identical failure the correlation guard above    │
     * │ exists for, found by an adversarial review of that fix.                                     │
     * │                                                                                            │
     * │ `Security.md` `RL-5` says the edge strips any client-supplied `X-Forwarded-For` before      │
     * │ rewriting it, so in a correct deployment this value is trustworthy. That edge (`TB-1`) does │
     * │ not exist yet, and "the infrastructure will make this safe" is not a thing to rely on in    │
     * │ the writer of an evidence table.                                                            │
     * │                                                                                            │
     * │ Substituted with NULL rather than a placeholder address. The column is nullable and NULL    │
     * │ means "not known", which is true; a fabricated `0.0.0.0` would be a recorded fact that is   │
     * │ false, in a table whose whole worth is that its contents happened.                          │
     * └────────────────────────────────────────────────────────────────────────────────────────────┘
     */
    let ip = entry.ip ?? null;
    if (ip !== null && !isStorableInet(ip)) {
      this.logger.error({
        message:
          'AUDIT ip is not an address — recorded as NULL so the row survives. Fix the caller.',
        entityType: entry.entityType,
        action: entry.action,
      });
      ip = null;
    }

    let correlationId = entry.correlationId;
    if (!isStorableCorrelationId(correlationId)) {
      this.logger.error({
        message:
          'AUDIT correlation id is not a uuid — replaced so the row survives. Fix the caller.',
        unstorableCorrelationId: correlationId,
        entityType: entry.entityType,
        action: entry.action,
      });
      correlationId = randomUUID();
    }

    try {
      await this.db.executeRaw`
        INSERT INTO audit_log (
          id, occurred_at, tenant_id, actor_id, actor_type, actor_label, impersonated_by,
          entity_type, entity_id, action, before, after,
          reason, reason_code, permission, elevation_scope,
          ip, user_agent, correlation_id, request_id
        ) VALUES (
          gen_random_uuid(), now(),
          ${entry.tenantId}::uuid, ${entry.actorId}::uuid, ${actorType}::actor_type_enum,
          ${entry.actorLabel ?? null}, ${impersonatedBy}::uuid,
          ${entry.entityType}::audit_entity_type_enum, ${entry.entityId}::uuid,
          ${entry.action}::audit_action_enum,
          ${redact(entry.before)}::jsonb, ${redact(entry.after)}::jsonb,
          ${entry.reason ?? null}, ${entry.reasonCode ?? null},
          ${entry.permission ?? null}, ${entry.elevationScope ?? null},
          ${ip}::inet, ${truncate(entry.userAgent)},
          ${correlationId}::uuid, ${entry.requestId ?? null}::uuid
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

/**
 * Whether PostgreSQL's `inet` will accept this text.
 *
 * Deliberately conservative and hand-written rather than a dependency: `inet` accepts IPv4, IPv6,
 * and either with a CIDR suffix, and the only thing that matters here is that a value this returns
 * `true` for will always cast. A value it rejects is recorded as NULL, which costs one field; a
 * value that reaches the cast and fails costs the entire row.
 */
function isStorableInet(value: string): boolean {
  const [address, prefix] = value.split('/');
  if (address === undefined || address.length === 0) return false;
  if (prefix !== undefined && !/^\d{1,3}$/.test(prefix)) return false;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (ipv4 !== null) {
    return ipv4.slice(1).every((octet) => Number(octet) <= 255 && !/^0\d/.test(octet));
  }

  // IPv6, including the `::` compressed forms and the IPv4-mapped `::ffff:1.2.3.4`.
  return /^[0-9a-f:]+$/i.test(address) && address.includes(':') && !address.includes(':::');
}
