# support

**Charter (`MASTER_PRD.md` §C1.3):** _tickets, help centre._

---

## 1. Bounded context

`support/` owns the answer to **"what state is this case in, and is its clock running?"** No other
module may transition a ticket, start or pause an SLA timer, or decide that a breach has occurred.
Two properties of that ownership are unusual enough to be worth stating as decisions rather than
details.

**A breach changes no state.** `M-113` AC 4: breach detection escalates once, through the outbox, and
leaves the ticket exactly as it was — _"a breach is a fact about the clock, not about the work"_. A
breached `OPEN` ticket is still `OPEN`.

**The clock is derived, never held.** Every SLA figure is computed from `created_at`,
`first_responded_at`, `resolved_at` and the `WAITING_ON_CUSTOMER` **interval log**, so a worker
restart mid-window changes nothing. The interval log, rather than a boolean, is what lets a ticket
that has bounced four times have four intervals subtracted.

`support/` is also the only module permitted to assemble a **cross-tenant customer context**, and it
may do so only through the named, audited elevation (`SR-10`) — a raw cross-tenant join inside
`support/` fails `dependency-cruiser`. Contextual attachment stores **references**, never copies
(`FR-SUP-02`): the order, the invoice and the payment are rendered by querying their owners live, so a
support agent never reads a stale echo of another module's fact.

Layer **L7** (`ModuleDependency.md` §2.1). Read by `reporting/` and `admin/`, and by nothing else.

## 2. PRD identifiers

| Class                           | Identifiers                                                                                                                                                                                                                                                                                                                                                                                                      |
| :------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional                      | `FR-SUP-01` … `FR-SUP-07` (`B5.23`). `FR-SUP-07` (satisfaction rating) is priority **`C`** and ships behind a flag that is off. Also `FR-AUTH-12` (impersonation from the console) and `FR-RBAC-05` (effective-permission inspection for support purposes)                                                                                                                                                       |
| Business rules                  | `BR-DAT-02` (impersonation: stated reason, time-boxed, visible to the impersonated user, fully audited), `BR-TEN-01` (the nullable-tenant policy must still isolate), `BR-DAT-06` (ticket bodies are user-authored prose and routinely contain contact details — `Monitoring.md` redaction row 22), `BR-WAL-01` (wallet is Phase 2; its **absence** is contract-tested here) — **there is no `BR-SUP-*` family** |
| Non-functional                  | `NFR-SEC-10` (attachment handling), `NFR-USE-05` (every error states what, why and what next — the reason-code → help-article link is the "what next"), `NFR-AVL-02`, `NFR-MNT-09`                                                                                                                                                                                                                               |
| Objectives / KPIs               | `OBJ-10` (a support agent resolves the ten most common issues without engineering involvement), `KPI-25` (median first response ≤ 4 h), `A6.5` (support cost per tenant is the variable most able to break unit economics)                                                                                                                                                                                       |
| `§C4`                           | **None of the nine.** `FR-SUP-04`'s five-state lifecycle — `OPEN` · `IN_PROGRESS` · `WAITING_ON_CUSTOMER` · `RESOLVED` · `CLOSED` — is not in `StateMachines.md` §1.1 and journals through `audit_log` rather than a dedicated table. `M-113` specifies it as a guarded transition table with registry error codes on refusal and a terminal `CLOSED`                                                            |
| `§C5`                           | **None of the twenty-four**                                                                                                                                                                                                                                                                                                                                                                                      |
| Errors (`API_Catalog.md` §6.13) | `TICKET_CLOSED` (422) · `TICKET_ATTACHMENT_REJECTED` (422)                                                                                                                                                                                                                                                                                                                                                       |
| Screens                         | `SCR-WEB-017` (member support, **deflection-first**), `SCR-ADM-013` (agent console with the impersonation entry point, its reason prompt and its banner)                                                                                                                                                                                                                                                         |
| Flags                           | `rel.support.help-centre`, `rel.support.satisfaction-rating` (both off by default; `D-01` partial)                                                                                                                                                                                                                                                                                                               |
| Caching                         | `GET /help/articles` and `/help/articles/:slug` are the module's only public, unauthenticated routes: `RL-PUBLIC`, `CDN-3600`, purged on write                                                                                                                                                                                                                                                                   |

## 3. Owned tables

_Planned. No code in this module yet - populated by the milestones listed below._

| Table             | Spec              | Tenancy · retention · grants                                                                                                                   | Note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| :---------------- | :---------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `support_tickets` | `Schema.md` §11.2 | RLS · **P-NULLABLE** · R-OPS · G-CRUD (`M-113` restricts `UPDATE` to `status`, `priority`, `assignee_id`, `first_responded_at`, `resolved_at`) | `tenant_id` is **nullable** because a member's ticket about the platform itself has no tenant. Policy: `USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id')::uuid)` with `WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid)` — a tenant session may _read_ a platform-scope ticket it is party to and may never _create_ one outside its own scope. **RLS alone would let any tenant read every platform ticket**, so the tenant-null read path carries an additional requester gate in the authorisation layer. Y1 ≈ 19,000 |
| `ticket_messages` | `Schema.md` §11.2 | RLS · P-NULLABLE · R-OPS · **G-APPEND**                                                                                                        | _"A message in a thread is what was said"_ — immutable. `is_internal_note` is a distinct message kind that is **never returned to a requester on any endpoint**, asserted structurally and by test (`SR-06`). Y1 ≈ 76,000                                                                                                                                                                                                                                                                                                                                       |

**Not owned.** `referrals` is IDENTITY-scoped with permission `crm.referral.read` — `crm/` owns it,
even though `Epic_20` groups referral runbooks with support ones and `API_Catalog.md` lists
`GET /me/referrals` under the `SUP` group. A wallet table does not exist and must not: `M-113` AC 12
ships `wallet-absence.contract-spec.ts` proving there is **no balance column, no transfer endpoint and
no withdrawal endpoint** (`D-02` taken; `BR-WAL-01-N1`).

> ⚠ **Ownership conflict — resolve before code, record in `DECISION_LOG.md`.** `help_articles` is
> specified in `Schema.md` §12.2 among the twelve **Platform Reference** tables, whose preamble says
> they are _"written **only** by `admin/` through the audited, reason-required path"_. But `M-113`
> creates it in the support sprint (_"two new tables plus `help_articles`"_), places
> `help-articles.controller.ts` in `support/controllers/`, and seeds the ten `§4.4` articles with
> reason-code deep links here. A table belongs to exactly one module. The likely resolution — `admin/`
> writes, `support/` reads and serves — is exactly the shape `admin/` already has with `audit/`, but
> it is not written down anywhere.

**Delivering milestones.** `M-113` (both migrations, the nullable-tenant policy plus the requester
gate, the help centre).

## 4. Public surface

_Planned. No code in this module yet - populated by the milestones listed below._

`support/` **has controllers** and is not one of the four provider-only modules of
`FolderStructure.md` §8.2, so `dto/` and `permissions.ts` are mandatory.

| Exported symbol                                           | Consumers                                                                                                    | Why                                                                                                                                                                                                                 |
| :-------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A ticket **query port**                                   | `reporting/` (`ModuleDependency.md` §4 matrix, row `reporting`, column `sup` = ●) and `admin/` (row `admin`) | The `support-load` platform report — tickets per tenant, per category, resolution time (`M-107`) — and the `SCR-ADM-013` console. The token name is not fixed by any current document                               |
| `type TicketCreatedPayload`, `type TicketResolvedPayload` | `notifications/`, `admin/`                                                                                   | `E7`                                                                                                                                                                                                                |
| `SUPPORT_PERMISSIONS`                                     | Customer web, gym dashboard and admin console via the OpenAPI client                                         | `FR-RBAC-01`. Registry entries: `support.ticket.list` · `.create` · `.read` · `.rate` · `support.ticket_message.create`. The two `/help/articles` routes require **no** permission — they are public and CDN-cached |

**Never exported:** the `Ticket` aggregate, the message thread, and above all `is_internal_note = true`
messages — `SR-06` makes their non-disclosure a structural assertion, not a serialisation option.
Attachments leave only through short-lived signed URLs after a virus scan, with the filename treated
as **untrusted user content**.

**Delivering milestones.** `M-113`.

## 5. Consumed ports

_Planned. No code in this module yet - populated by the milestones listed below._

`ModuleDependency.md` §3.2 edge **45**: `support/ → crm/`, `ordering/`, `memberships/`, `billing/`,
`refunds/` — `*_QUERY_PORT` ×5. The matrix row additionally shows `iam` and `audit`.

| From           | Port                                                  | Why the answer is needed synchronously                                                                                                                                               |
| :------------- | :---------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crm/`         | `MEMBER_QUERY_PORT`                                   | The member the case is about, and the Member-360 context an agent needs to answer without escalating (`OBJ-10`)                                                                      |
| `ordering/`    | `ORDER_QUERY_PORT`                                    | `FR-SUP-02` contextual creation from an order. The reference set — order, invoice, payment — is held as **configuration, not a `switch`**, so adding a fifth source is a data change |
| `memberships/` | `MEMBERSHIP_QUERY_PORT` (`listForMember`)             | Named in `FolderStructure.md` §9.3 as serving _"`SCR-DASH-008` Member 360 and `FR-SUP-02` contextual attachment"_                                                                    |
| `billing/`     | `INVOICE_QUERY_PORT`                                  | The invoice attached to a payment dispute                                                                                                                                            |
| `refunds/`     | `REFUND_QUERY_PORT`                                   | Refund and dispute state on the case; `FR-RFND-01` names support as one of three refund origins                                                                                      |
| `iam/`         | `USER_QUERY_PORT`                                     | The requester's identity, and the impersonation path (`FR-AUTH-12`, `BR-DAT-02`)                                                                                                     |
| `audit/`       | `AUDIT_WRITE_PORT` (via the `@Audited()` interceptor) | Every ticket transition is audited; so is every impersonation start and stop                                                                                                         |

**Why references and not copies.** `FR-SUP-02` says the contextual attachment stores references and
_"renders them by querying live"_. A snapshot would be a second copy of another module's fact, and the
first time a refund lands after the ticket was opened the agent would be reading a number the member
can see is wrong. The `customer-context.aggregator` therefore composes at render time — through
`runElevated()` when the composition crosses tenants, never through a raw join.

**Delivering milestones.** `M-113`.

## 6. Emitted events

_Planned. No code in this module yet - populated by the milestones listed below._

| Event             | Payload beyond `tenant_id` + `occurred_at` | Known consumers            | Consumer idempotency key |
| :---------------- | :----------------------------------------- | :------------------------- | :----------------------- |
| `ticket.created`  | `ticket_id`, `category`                    | `notifications/`, `admin/` | `ticket_id` + `status`   |
| `ticket.resolved` | `ticket_id`, `category`                    | `notifications/`, `admin/` | `ticket_id` + `status`   |

`E5` matters here more than almost anywhere: a ticket subject is free text written by a member and
`Monitoring.md`'s redaction list row 22 classes ticket bodies alongside review prose as _"user-authored
prose [that] routinely contains contact details and health claims"_. The payload carries an id and a
category and nothing else.

> ⚠ **Missing from the catalogue.** `M-113` AC 4 requires SLA breach escalation _"once only through
> the outbox"_. `ModuleDependency.md` §8.2 has no such row among its fifty-two events. Either the
> escalation is an internal notification trigger rather than a domain event, or the catalogue needs a
> `ticket.sla-breached` row with its consumers and idempotency key.

**Delivering milestones.** `M-113`.

## 7. Consumed events

_Planned. No code in this module yet - populated by the milestones listed below._

**None domain-specific**, other than the two platform broadcasts every configurable module receives:
`config.changed` (`config_key` + `version`) and `flag.changed` (`flag_key` + `version`) from `admin/`,
which is how the per-priority SLA targets, the contextual reference sets, `rel.support.help-centre` and
`rel.support.satisfaction-rating` change without a deployment.

**Why none.** Nothing in the domain creates a support case. A ticket is opened by a person deciding
they need help, so there is no state change anywhere else that `support/` must learn about
asynchronously. Everything it needs to _show_ about an order, membership, invoice or refund it fetches
live through a port at render time (§5) — deliberately, so it never holds a projection that can drift
from its owner. A module with no inbound handlers is a module whose data cannot go stale.

**Delivering milestones.** None. This section is expected to stay empty; a new inbound handler here
should prompt the question of whether the fact belongs in `crm/` instead.

## 8. Jobs

_Planned. No code in this module yet - populated by the milestones listed below._

**No `§C5` job.** `Scalability.md` §8.2 allocates all twenty-four across fourteen queues and lists no
`support` queue, because this module owns none of them.

`M-113` nonetheless specifies one processor:

| Field                             | Value                                                                                                                                                                                    |
| :-------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Processor                         | `sla-evaluate` — breach detection                                                                                                                                                        |
| Schedule                          | Every **5 minutes**                                                                                                                                                                      |
| Behaviour                         | Reads only. Detects a breach, escalates **once** through the outbox, and **changes no ticket state**. Idempotent under the distributed lock                                              |
| Lock scope                        | **Not specified.** `§8.10`'s grammar (`<job-name>:<scope>:<period>`) would give `support.sla-evaluate:platform:{5minBucket}`, matching `order.expire`'s shape — derived here, not quoted |
| Queue · class · duration envelope | **Not specified.** No `§C5` row, therefore no priority class, no concurrency cap and no expected duration                                                                                |

`data.retention-sweep` (`§C5` job 23) additionally fans out **one child job per owning module**
(`Scalability.md` §8.2), each running in its own module's queue under its own lock, so a `support`
child will exist for `support_tickets` and `ticket_messages` retention even though the parent lives in
`admin/`.

> ⚠ **Flag.** A recurring processor with no `§C5` row has no class, no semaphore share, no lock-key
> grammar instance, no duration envelope and no `ALRT-20` queue envelope — which means it has no
> defined behaviour when it falls behind, and falling behind is precisely how `KPI-25` degrades
> unnoticed. Either `§C5` gains a twenty-fifth row under `§C10`, or the evaluation is folded into an
> existing job.

**Delivering milestones.** `M-113`.

## 9. Top three failure modes (`NFR-MNT-09`)

|  #  | Failure                                                                                                                                                                                               | Signal                                                                                                                                                                               | First action                                                                                                                                                                                                                         |
| :-: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **SLA evaluator stalled.** Breaches stop being detected. Because a breach changes no ticket state, there is no visible symptom on the ticket itself — the only evidence is a metric that stops moving | Rolling 24 h median `support_first_response_seconds > 4 h`, or `increase(support_sla_breaches_total{priority="P1"}[1h]) > 0` (`ALRT-35c`; S3 for the median, **S2** for a P1 breach) | Confirm the 5-minute processor is running and holding its lock. Because every figure is **derived from stored timestamps**, restarting it recomputes correctly and loses nothing — there is no in-memory clock to rebuild            |
|  2  | **A ticket stuck in `WAITING_ON_CUSTOMER` past the auto-close window.** The SLA clock is paused, so the case is invisible to breach detection while remaining open indefinitely                       | Tickets in `WAITING_ON_CUSTOMER` with an interval-log entry older than the auto-close window; rising open-ticket count against a flat breach count                                   | Inspect the interval log, not a boolean — a ticket that has bounced four times has four intervals. Confirm the customer reply path resumed the clock on the last inbound message                                                     |
|  3  | **An attachment that fails scanning, or is retrieved without one.** Attachments are member-supplied files reaching platform staff; `NFR-SEC-10` and `REG-06` both bear on it                          | `TICKET_ATTACHMENT_REJECTED` (422) rate, and any retrieval served without a completed scan                                                                                           | Verify the type allow-list, the size cap, that the scan **precedes** retrievability (`API_Catalog.md` U3 — uploads return `202` for exactly this reason), and that the filename is escaped as untrusted content rather than rendered |

Runbook: [`/docs/runbooks/support.md`](/docs/runbooks/support.md)
