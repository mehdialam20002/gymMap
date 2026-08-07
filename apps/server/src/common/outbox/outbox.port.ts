/**
 * The outbox port — `AC-FND-08.1`, `AC-FND-08.2`, `§C1.5`, `ADR-0017`.
 *
 * ┌─ A USE CASE DEPENDS ON THIS, NOT ON THE WRITER ─────────────────────────────────────────────┐
 * │ The interface says "record that this happened". It does NOT say "insert a row", and it must  │
 * │ never grow a `publish()` — the whole design is that nothing publishes synchronously, and a   │
 * │ port with a publish method is a port somebody will call from a use case.                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

export const OUTBOX_PORT = Symbol('OutboxPort');

export interface DomainEvent {
  /** The aggregate root — `Order`, `Membership`. PascalCase; see BLK-07 in the migration. */
  readonly aggregateType: string;
  readonly aggregateId: string;
  /** `order.placed`, `payment.captured`. The routing key a consumer subscribes to. */
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  /**
   * Delay before the event becomes eligible. For a "remind me in 24 hours" event, which is a
   * real §C5 case and would otherwise need a second scheduling mechanism.
   */
  readonly availableAt?: Date;
}

export interface OutboxPort {
  /**
   * Records an event.
   *
   * ┌─ THE TRANSACTION IS THE CALLER'S, AND THAT IS NOT AN IMPLEMENTATION DETAIL ──────────────┐
   * │ `tx` is the caller's interactive transaction — the SAME one the aggregate was saved in.   │
   * │ Passing it is what makes the guarantee true, and the milestone notes name the alternative │
   * │ as the trap: writing through a second connection "because the publisher is a different    │
   * │ service" destroys the guarantee entirely and looks completely normal in review.            │
   * │                                                                                            │
   * │ It is a required parameter rather than an optional one for exactly that reason. An         │
   * │ optional `tx` is a `tx` somebody omits, and the omission produces a system that works      │
   * │ perfectly until the day a transaction rolls back.                                          │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  record(tx: OutboxTransaction, event: DomainEvent): Promise<void>;
}

/**
 * The subset of a Prisma transaction client the writer needs.
 *
 * Structural rather than `Prisma.TransactionClient`, so `common/` does not import
 * `@prisma/client` — `no-raw-prisma-outside-tenancy` forbids it, and `tsPreCompilationDeps`
 * makes even a type-only import a real edge to dependency-cruiser.
 */
export interface OutboxTransaction {
  readonly outboxEvent: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}
