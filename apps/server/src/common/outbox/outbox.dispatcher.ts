/**
 * The dispatcher — `AC-FND-08.3`, `AC-FND-08.4`, `AC-FND-08.5`, `TR-08`, `TR-20`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * `FOR UPDATE SKIP LOCKED` IS WHY FOUR WORKERS CAN POLL THE SAME TABLE
 *
 * Each worker selects a batch of pending rows and locks them. `SKIP LOCKED` makes a worker step
 * over rows another worker already holds instead of blocking on them — so N workers claim
 * disjoint batches with no coordination, no queue and no leader election.
 *
 * Plain `FOR UPDATE` would serialise every worker behind the first one, turning four workers
 * into one worker and three idle connections. `NOWAIT` would make them error instead of wait,
 * which is worse: the error is indistinguishable from a real failure.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ AT LEAST ONCE, NOT EXACTLY ONCE — AND THAT IS THE HONEST GUARANTEE ────────────────────────┐
 * │ A worker can dispatch a row and die before marking it PUBLISHED. The row is then dispatched │
 * │ again. Exactly-once delivery across a process boundary is not achievable without the        │
 * │ consumer participating, so the system does not claim it: every §C5 job is idempotent by     │
 * │ construction (`AC-FND-12.3`), and that is what makes at-least-once safe.                     │
 * │                                                                                              │
 * │ Claiming exactly-once and being wrong is far more dangerous than claiming at-least-once,     │
 * │ because a consumer written against the wrong claim has no dedup and nobody notices until a   │
 * │ member is charged twice.                                                                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { CLOCK, type Clock } from '../clock/clock.port.js';

/** One event, as a handler sees it. */
export interface DispatchableEvent {
  readonly id: string;
  readonly tenantId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: unknown;
  readonly attempts: number;
  readonly correlationId: string;
}

export type EventHandler = (event: DispatchableEvent) => Promise<void>;

/**
 * The raw SQL surface the dispatcher needs. Structural, so `common/` imports no Prisma type.
 *
 * ┌─ EVERY METHOD HERE IS TENANT-SCOPED EXCEPT `pendingTenants` ────────────────────────────────┐
 * │ The first draft had one cross-tenant gateway, and the integration test refused it with      │
 * │ SQLSTATE 42704 — the RLS policy raising on an unset `app.tenant_id`, which is the design     │
 * │ working exactly as intended. Chasing it down produced a better shape than the one it broke.  │
 * │                                                                                              │
 * │ `SELECT … FOR UPDATE` needs UPDATE privilege, so the elevated role — which holds SELECT and  │
 * │ nothing else — cannot claim rows at all. Giving the dispatcher a role with BOTH cross-tenant │
 * │ read AND write on the outbox would be the one place in this system where such a role exists. │
 * │                                                                                              │
 * │ So the cycle is: an ELEVATED, audited, SELECT-only read of which tenants have work           │
 * │ (`AC-FND-08` criterion 11), then a tenant-scoped claim and dispatch for each — under         │
 * │ `app_rw`, governed by P-STD, with no elevation held while anything is written.               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export interface DispatcherGateway {
  /**
   * Claims a batch AND leases it, in ONE statement.
   *
   * ┌─ THE LOCK DIES AT COMMIT, SO THE LOCK ALONE IS NOT A CLAIM ────────────────────────────┐
   * │ The obvious implementation is `SELECT … FOR UPDATE SKIP LOCKED` in a transaction, then  │
   * │ dispatch, then `markPublished`. It is wrong, and the integration test caught it         │
   * │ dispatching 100 of 500 rows TWICE:                                                       │
   * │                                                                                          │
   * │   the SELECT's transaction commits when the batch is returned                            │
   * │   the row is still PENDING — nothing about it changed                                    │
   * │   the lock is gone, and the next worker to poll claims the same row                      │
   * │                                                                                          │
   * │ The claim has to be a WRITE. This one pushes `available_at` forward by a lease, in the   │
   * │ same `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING *` — so the row   │
   * │ becomes invisible to other pollers the instant it is claimed, atomically.                │
   * │                                                                                          │
   * │ A LEASE rather than a `PROCESSING` status, for two reasons: `outbox_status_enum` is      │
   * │ fixed at PENDING/PUBLISHED/FAILED/DEAD by MG9, and — better — a lease EXPIRES. A worker  │
   * │ that dies mid-dispatch leaves a row that becomes eligible again by itself, where a       │
   * │ PROCESSING row would need a reaper to notice it had been abandoned.                       │
   * └──────────────────────────────────────────────────────────────────────────────────────────┘
   */
  claimBatch(limit: number, now: Date, leaseMs: number): Promise<DispatchableEvent[]>;
  markPublished(id: string, now: Date): Promise<void>;
  /** Records the failure and schedules the retry, or dead-letters at the attempt ceiling. */
  markFailed(id: string, attempts: number, error: string, availableAt: Date): Promise<void>;
  markDead(id: string, error: string): Promise<void>;
  /** `TR-20`. Deletes published rows older than the cutoff. Returns how many went. */
  deletePublishedBefore(cutoff: Date, limit: number): Promise<number>;
}

/**
 * The elevated half — criterion 11.
 *
 * Which tenants have pending work, oldest first. SELECT-only, so it runs through `runElevated()`
 * with the reason "outbox dispatch" and appears in the audit log and the elevation inventory.
 *
 * Ordered by each tenant's OLDEST pending row, which is what stops the starvation the naive
 * per-tenant loop would cause: iterating tenants by id would let a tenant whose id sorts last
 * wait behind every other tenant's backlog, forever.
 */
export interface PendingTenantsGateway {
  pendingTenants(now: Date, limit: number): Promise<string[]>;
}

export interface DispatcherOptions {
  /** Rows per poll. Small enough that a batch's lock is short. */
  readonly batchSize: number;
  /** Attempts before dead-lettering. */
  readonly maxAttempts: number;
  /** `TR-20`. Published rows are purged this many days after publication. */
  readonly retentionDays: number;
  /**
   * How long a claimed row stays invisible to other pollers.
   *
   * Long enough that a slow handler finishes inside it; short enough that a worker killed
   * mid-dispatch does not strand the event for an operator-visible period. Thirty seconds
   * against a handler budget measured in single-digit seconds.
   */
  readonly leaseMs: number;
}

export const DEFAULT_DISPATCHER_OPTIONS: DispatcherOptions = {
  batchSize: 100,
  // Six attempts over roughly ten minutes of backoff. Enough to ride out a provider blip;
  // short enough that a genuinely poisoned event reaches the dead-letter queue while somebody
  // is still looking at the incident that produced it.
  maxAttempts: 6,
  // Schema.md §13.1 — R-EPH, purged 30 days after publish.
  retentionDays: 30,
  leaseMs: 30_000,
};

/**
 * Exponential backoff with a ceiling.
 *
 * 2s, 4s, 8s, 16s, 32s, 64s. The ceiling matters more than the curve: unbounded doubling puts
 * attempt twelve four hours out, so an event that would have succeeded on a retry sits in the
 * table long enough to look like a stall — and somebody replays it by hand.
 */
export function backoffMs(attempts: number): number {
  const MAX_BACKOFF_MS = 300_000;
  return Math.min(2 ** attempts * 1000, MAX_BACKOFF_MS);
}

@Injectable()
export class OutboxDispatcher {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private readonly handlers = new Map<string, EventHandler>();

  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  /**
   * Registers a handler for an event type.
   *
   * One handler per type, and a second registration THROWS rather than replacing. Silent
   * replacement is how two modules both claim `payment.captured` and only the second one runs —
   * with no error, and the missing behaviour discovered by a member who was never notified.
   */
  on(eventType: string, handler: EventHandler): void {
    if (this.handlers.has(eventType)) {
      throw new Error(
        `Two handlers registered for "${eventType}". One event type has one handler; a second ` +
          'registration would silently replace the first, and the missing behaviour would be ' +
          'discovered by whoever it was supposed to happen to.',
      );
    }
    this.handlers.set(eventType, handler);
  }

  /**
   * One poll. Returns what it did, so the caller can log and meter it.
   *
   * Each event is dispatched INDEPENDENTLY. A failure marks that row and moves on — `AC-FND-08.4`
   * requires that a poisoned event does not stall the ones behind it, and a batch-level
   * try/catch would abandon the rest of the batch on the first failure.
   */
  async dispatchOnce(
    gateway: DispatcherGateway,
    options: DispatcherOptions = DEFAULT_DISPATCHER_OPTIONS,
  ): Promise<{ claimed: number; published: number; failed: number; dead: number }> {
    const now = this.clock.now();
    const batch = await gateway.claimBatch(options.batchSize, now, options.leaseMs);

    let published = 0;
    let failed = 0;
    let dead = 0;

    for (const event of batch) {
      const handler = this.handlers.get(event.eventType);

      if (!handler) {
        // An event nobody handles is NOT an error — a module that has not shipped yet is the
        // normal case for most of this programme. It is left PENDING and its attempt count is
        // untouched, so it dispatches the moment its handler registers rather than
        // dead-lettering while somebody writes the consumer.
        this.logger.debug({ message: 'no handler yet', eventType: event.eventType, id: event.id });
        continue;
      }

      try {
        await handler(event);
        await gateway.markPublished(event.id, this.clock.now());
        published += 1;
      } catch (error) {
        const message = truncate(error instanceof Error ? error.message : String(error));
        const attempts = event.attempts + 1;

        if (attempts >= options.maxAttempts) {
          await gateway.markDead(event.id, message);
          dead += 1;
          // ERROR, not warn. A dead-lettered event is work that was supposed to happen and did
          // not — a notification never sent, a settlement line never created — and it needs a
          // human. Monitoring.md alerts on this counter.
          this.logger.error({
            message: 'OUTBOX EVENT DEAD-LETTERED — this work did not happen',
            id: event.id,
            eventType: event.eventType,
            aggregateId: event.aggregateId,
            attempts,
            error: message,
          });
        } else {
          const availableAt = new Date(this.clock.now().getTime() + backoffMs(attempts));
          await gateway.markFailed(event.id, attempts, message, availableAt);
          failed += 1;
        }
      }
    }

    return { claimed: batch.length, published, failed, dead };
  }

  /**
   * `TR-20` / `AC-FND-08.5` — the retention sweep.
   *
   * Ships HERE, with the dispatcher, not when someone notices. A dispatcher with no pruning is a
   * table that grows forever and an `idx_outbox__pending` that degrades until publication
   * latency breaches `BAC-02`'s sixty-second window — which surfaces in Sprint 2 as "listings
   * take a while to appear" rather than as an index problem.
   */
  async sweep(
    gateway: DispatcherGateway,
    options: DispatcherOptions = DEFAULT_DISPATCHER_OPTIONS,
  ): Promise<{ deleted: number }> {
    const cutoff = new Date(
      this.clock.now().getTime() - options.retentionDays * 24 * 60 * 60 * 1000,
    );

    let deleted = 0;
    for (;;) {
      // Batched. A single unbounded DELETE takes a lock proportional to the row count, and the
      // outbox is written on the request path — so that lock would be held across checkout.
      const removed = await gateway.deletePublishedBefore(cutoff, 5_000);
      deleted += removed;
      if (removed < 5_000) break;
    }

    return { deleted };
  }

  /**
   * One full cycle across every tenant with work.
   *
   * `enterTenant` is supplied by the caller rather than imported, so this file depends on
   * neither the tenancy module nor Prisma — `common/` may not reach for either, and the
   * dispatcher is the piece most likely to be tempted to.
   */
  async dispatchCycle(
    pending: PendingTenantsGateway,
    enterTenant: <T>(tenantId: string, work: () => Promise<T>) => Promise<T>,
    gatewayFor: (tenantId: string) => DispatcherGateway,
    options: DispatcherOptions = DEFAULT_DISPATCHER_OPTIONS,
  ): Promise<{ tenants: number; published: number; failed: number; dead: number }> {
    const tenants = await pending.pendingTenants(this.clock.now(), options.batchSize);

    let published = 0;
    let failed = 0;
    let dead = 0;

    for (const tenant of tenants) {
      // Each tenant INDEPENDENTLY. A failure in one tenant's batch must not abandon the rest —
      // one gym's poisoned event would otherwise stop every other gym's notifications, which is
      // a single-tenant defect presenting as a platform outage.
      try {
        const result = await enterTenant(tenant, () =>
          this.dispatchOnce(gatewayFor(tenant), options),
        );
        published += result.published;
        failed += result.failed;
        dead += result.dead;
      } catch (error) {
        this.logger.error({
          message: 'outbox dispatch failed for one tenant; continuing with the rest',
          tenantId: tenant,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { tenants: tenants.length, published, failed, dead };
  }

  /** For the spec, and for the runbook's "which events have a consumer" question. */
  registeredEventTypes(): string[] {
    return [...this.handlers.keys()].sort();
  }
}

function truncate(message: string): string {
  // Matches the column's CHECK. Truncating here gives a recorded failure rather than a failed
  // UPDATE that loses the reason the dispatch failed in the first place.
  return message.length > 2000 ? message.slice(0, 2000) : message;
}
