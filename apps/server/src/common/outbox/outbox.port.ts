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

/**
 * The 26 aggregate roots of `docs/engineering/ERD.md` §6.1, in that section's own order.
 *
 * ┌─ WHY THIS IS A UNION AND NOT `string`, AND WHAT `string` COST ───────────────────────────────┐
 * │ It was `string` until `BLK-07` closed, because the register was believed missing. The price  │
 * │ came due immediately: `upload-kyc-document.use-case.ts` emitted `aggregateType: 'KycDocument'`│
 * │ — which is not an aggregate root at all (§6.1 row 2 CONTAINS `kyc_documents` inside           │
 * │ `Application`) — and nothing caught it. Not the `PascalCase` CHECK, which it satisfied. Not  │
 * │ the compiler, because this port widened it back to `string` one line before the call.         │
 * │ Its own comment even cited the right precedent and then did something else.                   │
 * │                                                                                              │
 * │ A domain type declared in `common/` rather than imported from Prisma: the constitution keeps │
 * │ ORM types out of ports (§3.4.3), and a port that imports `$Enums` is a port that knows which │
 * │ database it has. `outbox-aggregate-type.spec.ts` asserts this list against §6.1, so the      │
 * │ independence costs an assertion rather than a divergence.                                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export const AGGREGATE_TYPES = [
  'Tenant',
  'Application',
  'User',
  'Staff',
  'Gym',
  'Branch',
  'Plan',
  'Order',
  'Payment',
  'Invoice',
  'CreditNote',
  'Membership',
  'CheckIn',
  'CrmMember',
  'Lead',
  'Review',
  'LedgerEntry',
  'SettlementBatch',
  'Refund',
  'Dispute',
  'Coupon',
  'SupportTicket',
  'Segment',
  'Referral',
  'SubscriptionInvoice',
  'AttributionEvent',
] as const;

export type AggregateType = (typeof AGGREGATE_TYPES)[number];

export interface DomainEvent {
  /**
   * The aggregate root the event belongs to — `Order`, `Membership`.
   *
   * A CONTAINED entity never appears here. `kyc_documents` is part of `Application`, so a document
   * event carries `Application` and the application's id (rule A4: an aggregate is loaded and
   * saved whole). Naming the contained row instead gives consumers an aggregate they cannot load.
   */
  readonly aggregateType: AggregateType;
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
