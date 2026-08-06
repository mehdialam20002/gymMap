# support runbook

`NFR-MNT-09`. Module: [`apps/server/src/support`](../../apps/server/src/support/README.md).

## Scope

`support/` runs the ticketing system and the help centre: ticket creation by members and tenants
(`FR-SUP-01`), contextual creation from an order, membership, payment or check-in that auto-attaches
the relevant references (`FR-SUP-02`), the agent console with queue, assignment, priority, internal
notes and full customer context (`FR-SUP-03`, `SCR-ADM-013`), the five-state lifecycle (`FR-SUP-04`),
per-priority SLA timers with breach alerting (`FR-SUP-05`, `KPI-25`), and the deflection-first help
centre whose ten articles map to the ten most common issues (`FR-SUP-06`, `OBJ-10`). It owns
`support_tickets` and `ticket_messages`, both with a **nullable** `tenant_id`, which makes their RLS
policy the most delicate in the product: the policy alone would let any tenant read every
platform-scope ticket, so a requester gate in the authorisation layer sits on top of it. Nothing here
is on the check-in or payment path, so a support outage is a cost and reputation incident, never an
availability one — which is exactly why its degradations are easy to miss.

## Top failure modes

| Signal | Likely cause | First action | Escalation |
| :--- | :--- | :--- | :--- |
| Rolling 24 h median `support_first_response_seconds > 4 h`, or `increase(support_sla_breaches_total{priority="P1"}[1h]) > 0` (`ALRT-35c`) | The 5-minute `sla-evaluate` processor stalled or lost its lock; or genuine agent under-capacity | Confirm the processor is running. Every SLA figure is **derived from stored timestamps**, so a restart recomputes correctly and loses nothing — if the numbers are wrong after a restart, the defect is a timer held in memory, not a scheduling problem. Then break ticket volume down by category | S3 for the median, **S2** for a P1 breach. Ticket to the Support lead; a P1 breach notifies the Delivery manager. A spike in one category usually points at a product defect that self-service should have absorbed |
| Open-ticket count rising while breach count stays flat | Tickets parked in `WAITING_ON_CUSTOMER` past the auto-close window, with the clock legitimately paused | Query tickets in `WAITING_ON_CUSTOMER` whose latest interval-log entry predates the auto-close window. Check that the last inbound customer message resumed the clock — a ticket that has bounced four times needs four intervals subtracted, and a boolean can only remember the last one | Ticket to the Support lead. Auto-close is a policy value, not a code change |
| A breached ticket has silently changed status | A handler is mutating state on breach | Stop and treat as a defect: `M-113` AC 4 requires breach escalation to change **no** ticket state, because a breach is a fact about the clock and not about the work. Look for a state write in the evaluator | S2 to Backend Lead. Reporting on `KPI-25` is unreliable until it is fixed |
| `TICKET_ATTACHMENT_REJECTED` (422) rate rising, or a file retrievable before its scan completed | Scanner unavailable, allow-list drift, or the upload path returning the object before scanning | Verify type allow-list, size cap, that the virus scan **precedes** retrievability (uploads return `202` for exactly this reason), Mumbai-region storage, and that retrieval is a short-lived signed URL. Confirm filenames are escaped as untrusted user content, not rendered | S2 to the security owner if anything was retrievable pre-scan; otherwise ticket to Backend Lead |
| An internal note appears in a customer-visible response | `is_internal_note` treated as a display flag rather than a distinct message kind | Contain first — identify affected tickets by `ticket_id` and time window. `SR-06` makes non-disclosure a structural assertion; a leak means the assertion is absent from a code path, not that a filter was misconfigured | **S1** privacy incident. Page the security owner and the Support lead |
| A tenant can read a platform-scope ticket it is not party to | The requester gate on tenant-null rows is missing or bypassed; RLS alone does not cover this case | Reproduce with the isolation suite in both directions **including the tenant-null case**. This is `BR-TEN-01`, the first invariant | **S1**. Page on-call and the Technical Lead. Isolation defects are never "fixed forward" quietly |
| Help articles serving stale content, or `/help/articles` unavailable | CDN not purged on write (`CDN-3600`), or `rel.support.help-centre` pulled | Purge and confirm the write path triggers purge. If the flag is off, every entry point routes straight to ticket creation — a **measurable cost in tickets per tenant** recorded against `A6.5`, not an outage | Ticket to the Support lead. If the flag was pulled deliberately, confirm it has an owner and a restore date |
| A referral credited in error, or a referral-velocity alert | Referral qualification ran before the order's refund window closed | **`referrals` is owned by `crm/`, not by this module** — `Epic_20` T-20.31 groups these runbooks with support because the member-facing surface is here. Route to the `crm/` owner; `qualifies_at` is materialised from the order's refund-policy snapshot (`BR-RFL-01`, `BR-REF-02`) | Ticket to Backend Lead (crm) |

## Dashboards and queries

_To be populated by `M-113` (Sprint 14, `EP-20`)._ Intended content:

- **SLA board** — `support_first_response_seconds` histogram by `priority` against the `KPI-25` 4-hour
  median target (`SLO-04`), `support_sla_breaches_total` by `priority`, and time-to-resolution split
  by whether the clock was paused.
- **Queue composition** — open tickets by category, by priority, by assignee, and by *whether we are
  waiting on the customer or the customer is waiting on us*. The second split is the one that tells a
  rising open count from a rising backlog.
- **Deflection** — help-article views versus tickets created from the same entry point, per category.
  This is the `OBJ-10` measurement and the direct input to the `A6.5` support-cost-per-tenant figure.
  The deflection event carries **no personal data**.
- **Attachment health** — rejection rate by cause (type, size, scan), scan latency, and the count of
  objects awaiting scan.
- **Impersonation** — sessions started from `SCR-ADM-013`, their reasons, their durations against the
  30-minute cap, and any attempted financial mutation (which must be zero — the attempt is refused and
  counted).
- **Named queries** to be written here: tickets in `WAITING_ON_CUSTOMER` past the auto-close window;
  tickets whose `sla_due_at` has passed with `first_response_at` still null; tenant-null tickets and
  the requester that gates each one; the `support-load` figures that `M-107`'s platform report reads.
- **Related report** — `support-load` in the eleven-key platform catalogue (`SCR-ADM-014`).

## Known incidents

_None yet._
