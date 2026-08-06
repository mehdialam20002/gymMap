# refunds

> Charter (`MASTER_PRD.md` §C1.3): **refund requests, policy evaluation, disputes.**

---

## 1. Bounded context

`refunds/` owns the decision to give money back — whether, how much, on whose authority — and owns a
chargeback case from provider intake to outcome. Two things make the boundary sharp. First, the
governing policy is the one **captured on the order at the moment of sale** and parsed from nowhere
else, so a tenant cannot shorten its terms after a sale and have the change apply backwards
(`BR-REF-02`); the tenant's current policy is one join away and always available, and reading it is a
contract breach that only surfaces when a member refunds under the old terms. Second, ADR-0029:
_"`billing/` never decides a refund"_ — `billing/` issues the numbered credit note that this module
decided on, `memberships/` marks the membership `REFUNDED` because this module told it to, and
`ledger/` receives the reversal entries this module computed. Four modules, four owners, one atomic
intent.

## 2. PRD identifiers

| Class           | Identifiers                                                                                                                                                                                                                                                                  |
| :-------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional      | `FR-RFND-01` … `FR-RFND-11`                                                                                                                                                                                                                                                  |
| Business rules  | **`BR-REF-01` … `BR-REF-09`**; `BR-PAY-07` (duplicate payments refunded through the standard path); `BR-FIN-05` (the rate frozen at sale governs the reversal); `BR-FIN-06` (a gateway fee is reversed only to the extent the gateway reverses it); `BR-MEM-14`; `BR-TEN-01` |
| Non-functional  | `NFR-DQ-02`, `NFR-SEC-11` (platform decisions are `access(mfa)`), `NFR-USE-01`, `NFR-MNT-09`                                                                                                                                                                                 |
| State machine   | **`§C4.5`** — `REQUESTED → {AUTO_APPROVED, PENDING_APPROVAL} → PROCESSING → COMPLETED`, with `REJECTED` and `FAILED → (retry) → PROCESSING`. Seven states and **no `REQUESTED → PROCESSING` edge**                                                                           |
| Reason taxonomy | `§C4.8` **Refund reason** — the ten `refund_reason_enum` values, constrained by a database `CHECK`                                                                                                                                                                           |
| `§C5` jobs      | **None.** See §8                                                                                                                                                                                                                                                             |
| Acceptance      | `AC-RFND-01.1` … `AC-RFND-01.3`, `AC-RFND-02.1` … `AC-RFND-02.3`                                                                                                                                                                                                             |
| Screens         | `SCR-DASH-015`, `SCR-ADM-008`, `SCR-ADM-009`, `SCR-WEB-009`, `SCR-WEB-011`                                                                                                                                                                                                   |
| Gates           | Invariant 2 (the reversal is _appended_, never an edit), `E2E-07`, `E2E-08`, **`BAC-08`**                                                                                                                                                                                    |

## 3. Owned tables

_Planned. No code in this module yet - populated by the milestones listed below._

| Table              | The constraint that carries a rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `refunds`          | `uq_refunds__order_id_active` — a partial unique index over `status NOT IN ('REJECTED','FAILED')` — **is** `BR-REF-09`, idempotency on the order expressed as an index rather than a service-layer check. `original_payment_id` is `NOT NULL` with an FK to `payments`: _"a refund is never issued to any instrument other than the original"_, and **the FK is the enforcement**. `computation jsonb` holds the full proration arithmetic shown to all parties. `reason_text` is required where check-ins are recorded (`BR-REF-06`). **The table has no destination column of any kind**, and an OpenAPI structural assertion proves no request or response schema carries a destination, account, UPI id or card field |
| `disputes`         | `provider_dispute_id` unique — a replayed webhook produces one case and one hold. `evidence_due_at` `NOT NULL`. `outcome` **immutable once set**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `dispute_evidence` | **G-APPEND.** Evidence submitted before a deadline cannot be revised after it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

`BR-REF-08`'s hold is not a column: a chargeback writes a `CHARGEBACK`-typed **ledger entry**
referencing the dispute, because `BR-FIN-01` forbids a mutable balance anywhere — including one
called `tenants.held_amount`.

**Delivering milestones** — `M-098` (`refunds`, the partial unique index, the two `CHECK`s, the
no-destination contract test), `M-102` (`disputes`, `dispute_evidence`).

## 4. Public surface

_Planned. No code in this module yet - populated by the milestones listed below._

Three controllers and therefore a mandatory `permissions.ts` (`FR-RBAC-01`), one per origin, because
`FR-RFND-01` gives a refund three: member, gym staff, platform staff. Member:
`POST /v1/me/memberships/:id/refund-request`, `GET /v1/me/memberships/:id/refund-preview`,
`GET /v1/me/refunds`, `GET /v1/me/refunds/:id`. Tenant: `GET|POST /v1/tenant/refunds`. Platform:
`GET /v1/admin/refunds`, `POST /v1/admin/refunds/:id/decide`, `GET /v1/admin/disputes`,
`GET /v1/admin/disputes/:id`, `POST /v1/admin/disputes/:id/evidence`.

| Exported symbol                                                                                                               | Kind                 | Consumers                                                                                                                                               |
| :---------------------------------------------------------------------------------------------------------------------------- | :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `REFUND_QUERY_PORT` + interface                                                                                               | Read-model port      | `settlements/` (●, negative lines) and `support/` (●, `FR-SUP-02` contextual attachment, which stores **references** and renders them by querying live) |
| `REFUND_PERMISSIONS`                                                                                                          | Permission constants | `iam/` (enumeration), `admin/`                                                                                                                          |
| `RefundRequestedPayload`, `RefundApprovedPayload`, `RefundCompletedPayload`, `DisputeOpenedPayload`, `DisputeResolvedPayload` | Event payload types  | `ledger/`, `memberships/`, `billing/`, `settlements/`, `notifications/`, `admin/`                                                                       |

Permission strings from `API_Catalog.md`: `refunds.refund.request`, `refunds.refund.preview`,
`refunds.refund.list_own`, `refunds.refund.read_own`, `refunds.refund.list`,
`refunds.refund.create`, `refunds.refund.create_platform`, `refunds.refund.list_all`,
`refunds.refund.decide`, `refunds.dispute.list`, `refunds.dispute.read`,
`refunds.dispute.submit_evidence`, `refunds.dispute.manage`, `refunds.dispute.intake_manual`.
A Gym Owner holds no approval permission — the `403` is asserted by test (`M-100` AC 9).

Never exported: the `Refund` aggregate, `RefundPolicy`, the approval policy, the amount calculator,
the evidence assembler, or the repositories. `reporting/` (●) and `admin/` (●) read through the query
port and the command interface respectively.

**Delivering milestones** — `M-099` (member preview controller and `index.ts`), `M-100` (all three
refund controllers and `permissions.ts`), `M-102` (the disputes controller), `M-103` (the four UI
surfaces that consume them).

## 5. Consumed ports

_Planned. No code in this module yet - populated by the milestones listed below._

| From                            | Port                                     | Why the answer must be synchronous                                                                                                                                                                                                                                                                                                                             |
| :------------------------------ | :--------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ordering/`                     | `ORDER_SNAPSHOT_PORT`                    | **`BR-REF-02`.** The policy comes from the order's stored snapshot and never from current tenant settings. It is read inside the evaluation, and an unparseable or absent snapshot **raises** rather than defaulting — a default here silently invents contractual terms                                                                                       |
| `ledger/`                       | `LEDGER_READ_PORT`, `LEDGER_APPEND_PORT` | **`BR-REF-05`.** The proportional commission reversal is computed from ledger facts and the reversal entries are appended **inside this module's own transaction** — an intentional shared unit of work that `ModuleDependency.md` §12.2 records as the reason `refunds/` scores 1 out of 5 on extraction readiness. A rollback must leave no partial reversal |
| `payments/`                     | `PAYMENT_REFUND_PORT`                    | The gateway refund must succeed before `§C4.5` advances. The signature is `refund(paymentId, amountMinor, idempotencyKey)` and **has no destination parameter** — the absence is asserted structurally, because a "refund to a different card because the original expired" field added in good faith is exactly the fraud vector `BR-REF-04` closes           |
| `billing/`                      | `CREDIT_NOTE_PORT`                       | `refunds/` decides, `billing/` issues the numbered document in its own gapless per-tenant-per-FY credit-note sequence (ADR-0029)                                                                                                                                                                                                                               |
| `memberships/`                  | `MEMBERSHIP_COMMAND_PORT`                | `markRefunded` — the membership must reach `REFUNDED` in the **same decision**, and the QR credential must be revoked inside the token's own 60 s TTL (`FR-RFND-06`, `§C4.1`)                                                                                                                                                                                  |
| `common/`                       | `ReferenceDataRepository`                | `reason_codes` — the ten `§C4.8` refund reasons — as platform-global reference data, never by importing `admin/` (`ModuleDependency.md` §0 C-3, which names `refunds/` explicitly)                                                                                                                                                                             |
| `common/`, `tenancy/`, `audit/` | Universal edges                          | `Money.allocate()` (which guarantees the parts sum back exactly), `Clock`, the outbox port; the tenant-scoped client; `AUDIT_WRITE_PORT` on every decision                                                                                                                                                                                                     |

> **A conflict that must be resolved before `M-099` is built.** `FR-RFND-03` and `BR-REF-06` need the
> count of **`ALLOWED`** check-ins to decide auto-approval, and `M-099` accordingly specifies
> `refunds/application/ports/attendance-count.port.ts`, _"consumes `attendance/`'s existing query
> port"_. But `ModuleDependency.md` §4's matrix marks `refunds → attendance` as **—**: forbidden in
> both directions, not even an event. `dependency-cruiser` will fail the build on the import as
> specified.
>
> Under `CLAUDE.md` §2, `docs/engineering/` is binding derived specification and `docs/roadmap/` is
> _"plan of work, never a source of requirements"_ — so the matrix governs and the milestone is the
> document that must move. The two candidate resolutions are an amendment adding the edge with a
> named port and a §3.2 row, or routing the usage count through `memberships/`, which already sits on
> a permitted edge. **This is a conflict, and a conflict halts work** (`CLAUDE.md` §9.3): it is
> recorded here and belongs in `DECISION_LOG.md`, not settled in code.

> `refunds → iam` is **●** in the matrix with no port named in §3.2; requester and approver identity
> travel on the authenticated principal, so no injection is planned.

**Delivering milestones** — `M-098` (`ordering/`), `M-099` (the usage count, pending the conflict
above), `M-100` (`payments/`), `M-101` (`ledger/`, `billing/`, `memberships/`).

## 6. Emitted events

_Planned. No code in this module yet - populated by the milestones listed below._

| Event                                  | Payload beyond `tenant_id`, `occurred_at`                                | Known consumers                                                         | Downstream key          |
| :------------------------------------- | :----------------------------------------------------------------------- | :---------------------------------------------------------------------- | :---------------------- |
| `refund.requested` / `refund.approved` | `refund_id`, `order_id`, `amount_minor`, `reason_code`                   | `notifications/`, `admin/`                                              | `refund_id` + `status`  |
| `refund.completed`                     | `refund_id`, `order_id`, `amount_minor`, **`commission_reversal_minor`** | `ledger/`, `memberships/`, `billing/`, `settlements/`, `notifications/` | `refund_id`             |
| `dispute.opened` / `dispute.resolved`  | `dispute_id`, `payment_id`, `outcome`                                    | `settlements/`, `notifications/`, `admin/`                              | `dispute_id` + `status` |

`commission_reversal_minor` is the **only** derived money figure carried on any of the fifty-two
catalogued event payloads, and `ModuleDependency.md` §8.2 states the reason: `settlements/` must be
able to produce the negative line before it can re-read the ledger in the next batch window. Five
consumers on one event is the widest fan-out in the money path and is `E2E-07`'s whole chain.

**Delivering milestones** — `M-100` (`refund.requested`, `refund.approved`), `M-101`
(`refund.completed` and its four effects), `M-102` (the two dispute events).

## 7. Consumed events

_Planned. No code in this module yet - populated by the milestones listed below._

| Event                        | Publisher   | Handler idempotency key | What the handler does                                                                                                                                                                                                                      |
| :--------------------------- | :---------- | :---------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payment.duplicate-detected` | `payments/` | `payment_id`            | Refunds every non-earliest `CAPTURED` payment through the **standard** use case with reason `DUPLICATE_PAYMENT`, so commission reversal and the credit note happen correctly — a bespoke fast path would skip both (`BR-PAY-07`, `E2E-08`) |
| `credit-note.issued`         | `billing/`  | `credit_note_id`        | Attaches the issued document to the refund record for `AC-RFND-01.3`'s download                                                                                                                                                            |

Two further inbound signals are **not** domain events and are handled differently:

- **The provider dispute webhook** arrives at `payments/`' signature-verified webhook controller and
  is normalised; `M-102` places the handler at
  `refunds/application/handlers/provider-dispute-opened.handler.ts`. It creates the `disputes` row
  **and** the `CHARGEBACK` ledger hold in one transaction, is duplicate-safe on `provider_dispute_id`,
  and **parks** an event whose payment has not yet arrived rather than dropping or failing it
  (`TR-04` W7).
- **Gym closure** (`BR-REF-07`) drives `M-101`'s resumable, per-membership-idempotent bulk run. The
  milestone names the trigger `GymCeasedOperating`, but no such event exists in
  `ModuleDependency.md` §8.2; the nearest catalogued event is `gym.suspended`, whose consumer list
  does **not** include `refunds/`. Either the catalogue gains a row or `M-101` binds to
  `gym.suspended` and the catalogue gains a consumer. Recorded, not guessed.

**Delivering milestones** — `M-100` (`payment.duplicate-detected`), `M-101` (`credit-note.issued`,
the closure run), `M-102` (dispute intake).

## 8. Jobs

_Planned. No code in this module yet - populated by the milestones listed below._

**None of the twenty-four `§C5` jobs belongs to `refunds/`,** and `Scalability.md` §8.3.1 places none
of them in a `refunds` queue. That is coherent: a refund is an event-driven decision with a human or
a policy at its head, not a scheduled sweep, and the two scheduled money-recovery behaviours that
touch refunds — `payment.reconcile` and `payment.duplicate-detect` — belong to `payments/`, which
owns the provider relationship.

Four scheduled or triggered processors are nevertheless specified by the roadmap, and **none has a
`§C5` row, a queue assignment, a priority class, a lock-key grammar or a duration envelope**:

| Processor                     | Milestone | Cadence                         | What it does                                                                                                                                                                                                                                   |
| :---------------------------- | :-------- | :------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `refunds.gateway-status-poll` | `M-100`   | Every 15 min                    | Resolves `PROCESSING` and indeterminate refunds; `FAILED` retries with backoff and a **give-up state that alerts Finance**, so a member is never left without an answer                                                                        |
| `evidence-pack-assemble`      | `M-102`   | On case creation, not on demand | A case created at 03:00 has a complete pack at 03:01. This is not an optimisation: the pack needs every attendance row, `attendance` is monthly-partitioned with a retention sweep, and a late assembly may find them purged (open item `O-5`) |
| `dispute-deadline-watch`      | `M-102`   | Hourly                          | Escalating reminders at T−48 h / T−24 h / T−6 h, once each; a breach raises an alarm; a dispute under 24 h with no pack raises its own                                                                                                         |
| `closure-bulk-run`            | `M-101`   | Event-triggered, resumable      | `BR-REF-07` mass pro-rata refunds on gym closure; idempotent per membership, resumes after a worker restart mid-run                                                                                                                            |

`§C5` requires that **every** job runs under a distributed lock, records start/end/outcome, emits
metrics and alerts on failure or on exceeding its expected duration. These four need either `§C5`
rows and `Scalability.md` §8.3 entries, or a recorded exemption, before `M-100` and `M-102` ship.

**Delivering milestones** — `M-100`, `M-101`, `M-102`.

## 9. Top three failure modes (`NFR-MNT-09`)

The three declared for `refunds/` in `PROJECT_CONSTITUTION.md` §18.5.1. Note that **no `ALRT-nn` in
`Monitoring.md` §5 is dedicated to refunds**: `ALRT-18` covers duplicate payments, `ALRT-21`/`ALRT-23`
are the generic job and dead-letter alerts, and the refund-specific signals are the dashboard metrics
`M-103` defines. That gap is itself a finding — a module whose failure returns the wrong amount of
money to a member should not be observed only through generics.

|  #  | Failure mode                         | Signal                                                                                                                                                                                         | First action                                                                                                                                                                                                                                                                                                                                                                                                |
| :-: | :----------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **Gateway refund failure**           | Refunds ageing in `PROCESSING`; the `gateway-status-poll` give-up state; `error`-level events for gateway refund failure (`Monitoring.md` §3); `ALRT-13` if the provider is slow platform-wide | Resolve the _outcome_, do not retry. A refund that timed out has an unknown state, and the poll — not the retry — is what settles it. For a Route sale, check the **transfer reversal** separately from the refund: a successful refund with a failed reversal is a named, alerted state, and treating it as success means the platform refunded the member from its own float while the gym kept its share |
|  2  | **Approval queue backlog**           | `gym.refund.auto_approved_pct` falling; the `SCR-ADM-008` queue ageing; refunds sitting in `PENDING_APPROVAL` past the `AC-RFND-01.1` one-business-day expectation                             | Check whether routing is correct before staffing the queue: `RefundApprovalPolicy` takes four inputs and no repository, so a mis-set value or usage threshold routes cases that should auto-approve. A backlogged approval queue converts into chargebacks, which cost the platform more than the refunds would have — and the member-facing copy must say **"routed for review"**, never "rejected"        |
|  3  | **Dispute evidence deadline missed** | `gym.dispute.deadline_hours_remaining` approaching zero; the `dispute-no-pack-under-24h` alert; `gym.dispute.open.count` rising without matching submissions                                   | Confirm the pack exists and is complete — a component that could not be assembled is **named** in `missing_reason` and the pack is never silently short. Submission is refused after the deadline (`410`) and after resolution (`409`), so there is no late path; the mitigation is upstream, in assembling at case creation. A dispute lost on an already-refunded order has its own runbook               |

**Runbook:** [`/docs/runbooks/refunds.md`](../../../../docs/runbooks/refunds.md)
