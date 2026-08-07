/**
 * The outbox writer — `AC-FND-08.1`, `AC-FND-08.2`, `P4`, `§C1.5`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * EIGHT LINES OF WORK, AND ONE PROPERTY THAT IS THE WHOLE MILESTONE
 *
 * The row is inserted through the CALLER'S transaction. If that transaction rolls back, the
 * event row rolls back with it and nothing is ever dispatched. If it commits, the event is
 * durably recorded before any worker has looked at it.
 *
 * §C1.5 states the property this buys: *"a notification is never sent for a transaction that
 * rolled back, and never lost for one that committed."*
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { Inject, Injectable } from '@nestjs/common';

import { CLOCK, ID_GENERATOR, type Clock, type IdGenerator } from '../clock/clock.port.js';
import { currentCorrelation } from '../logging/correlation.als.js';
import { currentTenantContext } from '../../tenancy/context/tenant-context.als.js';
import { isTenantScope } from '../../tenancy/context/tenant-context.vo.js';
import { MissingTenantContextError } from '../../tenancy/domain/tenancy.errors.js';
import type { DomainEvent, OutboxPort, OutboxTransaction } from './outbox.port.js';

@Injectable()
export class OutboxWriter implements OutboxPort {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async record(tx: OutboxTransaction, event: DomainEvent): Promise<void> {
    // The tenant comes from the CONTEXT, never from the event. §11.5 BR5: a caller that can pass
    // a tenant id can pass the wrong one, and the resulting row is syntactically valid — it
    // simply belongs to somebody else, and the event fires against their data.
    const context = currentTenantContext();
    if (!isTenantScope(context)) {
      throw new MissingTenantContextError('OutboxWriter', `record(${event.eventType})`);
    }

    await tx.outboxEvent.create({
      data: {
        tenantId: context.tenantId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload,
        availableAt: event.availableAt ?? this.clock.now(),
        // NFR-MNT-04 / AC-FND-09.5. Captured HERE, at the moment of the request, because by the
        // time a worker picks the row up the originating request is long gone — and "which
        // request caused this notification" is the question asked during every incident.
        //
        // `currentCorrelation()` and NOT `currentCorrelationId()`. The latter returns the string
        // 'no-correlation-context' when no frame is open — a deliberate LOG-LINE marker, and not
        // a uuid. Writing it to this `uuid` column raised "Error creating UUID, invalid
        // character" and killed the event, which is the one outcome the outbox exists to make
        // impossible. An event raised by a job legitimately has no inbound request, so a fresh
        // id is minted: a row with no trace id at all is a row nothing can be joined to.
        correlationId: currentCorrelation()?.correlationId ?? this.ids.uuid(),
      },
    });
  }
}
