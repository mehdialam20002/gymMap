/**
 * `M-028` · Submitting a version — `FR-ONB-08`, `BR-GYM-05`, `AC-2`, `AC-6`, `AC-7`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * ONE TRANSACTION: THE ROW, THE EVENT, AND NOTHING IN BETWEEN
 *
 * `AC-6`: *"The application-submitted event lands in the outbox inside the submission transaction;
 * a rolled-back submission dispatches nothing."*
 *
 * The failure this prevents is not theoretical and it is not symmetrical:
 *
 *   · publish first, insert second → a reviewer is notified about an application that does not
 *     exist, opens it, and sees a 404 on a queue item the platform told them about
 *   · insert first, publish second → the row exists and nothing ever tells anybody, so the gym sits
 *     unreviewed until the owner complains, which is the failure nobody detects
 *
 * The outbox removes the choice. `OutboxPort.record` takes a transaction handle rather than reading
 * an ambient one, so an event CANNOT be written outside the transaction that produced it — the port
 * makes the correct arrangement the only expressible one.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_WRITE_PORT, type AuditWritePort } from '../../audit/ports/audit-write.port.js';
import { OUTBOX_PORT, type OutboxPort } from '../../common/outbox/outbox.port.js';
import { CLOCK, type Clock } from '../../common/clock/clock.port.js';
import { BusinessRuleException } from '../../common/errors/domain-exception.js';
import { PrismaService } from '../../tenancy/prisma/prisma.service.js';
import { currentTenantContext } from '../../tenancy/context/tenant-context.als.js';
import { MissingTenantContextError } from '../../tenancy/domain/tenancy.errors.js';
import { canTransition, type Actor } from '../domain/application.state-machine.js';

export interface SubmitApplicationCommand {
  /** The frozen claim. Whatever the wizard held at the moment Submit was pressed. */
  readonly snapshot: Record<string, unknown>;
  readonly actor: Actor;
  readonly correlationId: string;
}

export interface SubmitApplicationResult {
  readonly applicationId: string;
  readonly version: number;
}

@Injectable()
export class SubmitApplicationUseCase {
  constructor(
    private readonly db: PrismaService,
    @Inject(OUTBOX_PORT) private readonly outbox: OutboxPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AUDIT_WRITE_PORT) private readonly audit: AuditWritePort,
  ) {}

  async execute(command: SubmitApplicationCommand): Promise<SubmitApplicationResult> {
    const context = currentTenantContext();
    if (context.kind !== 'TENANT') {
      throw new MissingTenantContextError('Application', 'submit');
    }

    /*
     * The transition is checked BEFORE the transaction opens.
     *
     * Nothing about a refused submission needs a database round trip, and holding a transaction
     * open across a validation failure keeps a row locked for the duration of an error path.
     */
    const verdict = canTransition('DRAFT', 'SUBMITTED', command.actor);
    if (!verdict.permitted) {
      throw new BusinessRuleException(
        'APPLICATION_ILLEGAL_TRANSITION',
        'This application cannot be submitted from its current state.',
      );
    }

    const submittedAt = this.clock.now();

    const result = await this.db.client.$transaction(async (tx) => {
      /*
       * The next version is read inside the transaction, and the unique constraint is what actually
       * settles a race — `uq_applications__tenant_version`.
       *
       * Two concurrent submissions both read version 2 and both try to write version 3. One wins;
       * the other raises 23505 and the whole transaction rolls back, taking its outbox row with it.
       * That is the correct outcome and it is why the event must be inside: a losing submission that
       * had already published would announce a version that does not exist.
       */
      const latest = await tx.application.findFirst({
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const version = (latest?.version ?? 0) + 1;

      const created = await tx.application.create({
        data: {
          tenantId: context.tenantId,
          version,
          // `AC-2` — immutable from insert. The grant refuses an UPDATE to this column, so the value
          // written here is the value a reviewer will read, permanently.
          snapshot: command.snapshot as never,
          submittedAt,
        },
        select: { id: true, version: true },
      });

      // Same `tx`. Not a convenience — the port cannot be called any other way.
      await this.outbox.record(tx as never, {
        aggregateType: 'Application',
        aggregateId: created.id,
        eventType: 'application.submitted',
        payload: {
          applicationId: created.id,
          tenantId: context.tenantId,
          version: created.version,
          submittedAt: submittedAt.toISOString(),
        },
      });

      return created;
    });

    /*
     * The audit row is written AFTER the transaction commits, and deliberately outside it.
     *
     * `audit_log` is written by `app_append` on its own connection — a different role with INSERT
     * and nothing else — so it could not join this transaction even if that were wanted. Writing it
     * after means a committed submission with a lost audit row is possible; the alternative, failing
     * a committed submission because its log line did not land, is worse, and the repository already
     * alerts on a swallowed write.
     */
    await this.audit.append({
      tenantId: context.tenantId,
      actorId: command.actor.kind === 'HUMAN' ? command.actor.userId : null,
      actorType: command.actor.kind === 'HUMAN' ? 'USER' : 'SYSTEM',
      entityType: 'APPLICATION',
      entityId: result.id,
      action: 'CREATE',
      before: { status: 'DRAFT' },
      after: { status: 'SUBMITTED', version: result.version },
      reason: 'The owner submitted a verification application.',
      correlationId: command.correlationId,
    });

    return { applicationId: result.id, version: result.version };
  }
}
