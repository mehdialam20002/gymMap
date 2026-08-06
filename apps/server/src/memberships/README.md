# memberships

**Charter (PRD §C1.3):** _lifecycle state machine, freeze, renewal, upgrade, expiry jobs._

---

## 1. Bounded context

`memberships/` owns exactly one decision that no other module may take: **what state a membership is
in, and when it is allowed to change**. The six states of `BR-MEM-01` and the fifteen transitions of
`§C4.1` are decided here, once, in `domain/membership-status.state-machine.ts`, and every change
writes a `membership_events` row in the same transaction. Everything that looks like it belongs here
and does not, is named deliberately: `payments/` decides whether money arrived and `memberships/`
learns of it by event (`BR-PAY-02`, invariant 5); `plans/` decides what a plan permits and
`memberships/` reads the frozen snapshot of it; `ordering/` decides price; `attendance/` decides
whether a person walks through the door and asks `memberships/` only the narrow question _"is there a
live entitlement at this branch right now?"_. The module is L4 in `ModuleDependency.md` §2, and it
computes no money of its own — the pro-rata figure for `BR-MEM-09` is produced by `ordering/` from
the `plans/` price authority, and `memberships/` records the resulting term.

## 2. PRD identifiers

| Class                                  | Identifiers                                                                                                                                                                                                                                   |
| :------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional                             | `FR-MEMB-01` … `FR-MEMB-12` (`§B5.12`). `FR-MEMB-11` transfer is MoSCoW **C** and is descoped **D-05** for Phase 1 — the table and flag exist, the endpoint does not.                                                                         |
| Business rules **owned**               | `BR-MEM-01`, `BR-MEM-02` (invariant I5), `BR-MEM-03`, `BR-MEM-05`, `BR-MEM-07`, `BR-MEM-08`                                                                                                                                                   |
| Business rules **co-owned**            | `BR-MEM-04` (+`ordering/`), `BR-MEM-09` (+`ordering/`), `BR-MEM-10` (+`payments/`), `BR-MEM-12` (+`crm/`), `BR-MEM-13` (+`attendance/`), `BR-MEM-14` (+`notifications/`, `refunds/`), `BR-PLN-02` and `BR-PLN-06` (+`plans/`, +`attendance/`) |
| Business rules **consumed, not owned** | `BR-MEM-06` (owner `attendance/`), `BR-MEM-11` (owner `notifications/`), `BR-PAY-02` (owner `payments/`), `BR-REF-02` and `BR-REF-09` (owner `refunds/`), `BR-TEN-01` (owner `tenancy/`)                                                      |
| Non-functional                         | `NFR-SCAL-01` (100,000 concurrent-eligible memberships at Y1), `NFR-MNT-06` (job failure and duration signals), `NFR-MNT-09` (§9 and the runbook), `NFR-DQ-02` (integer minor units on `purchased_price_minor`)                               |
| State machine                          | **`§C4.1` Membership** — six states, fifteen edges, `EXPIRED` terminal (renewal creates a _new_ membership; a membership is never reactivated)                                                                                                |
| Jobs                                   | **`§C5`** — `membership.activate-pending`, `membership.expire`, `membership.unfreeze-scheduled`, `membership.renewal-reminders`, `membership.auto-renew`                                                                                      |
| API                                    | `API-MEMB`; the tenant half of `API-TEN` `/tenant/memberships*`                                                                                                                                                                               |
| Screens served                         | `SCR-WEB-009`, `SCR-DASH-007`, `SCR-DASH-008`, `SCR-DASH-001` (expiring list)                                                                                                                                                                 |
| Acceptance                             | `AC-MEMB-01.1` … `-01.5`, `AC-MEMB-02.1` … `-02.3`; `E2E-05` is the sprint-exit journey                                                                                                                                                       |

## 3. Owned tables

_Planned. No code in this module yet - populated by the milestones listed below._

| Table               | Grants / class                                                                  | Why it is here and not elsewhere                                                                                                                                                                                                  | Source           |
| :------------------ | :------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- |
| `memberships`       | RLS · P-STD · R-FIN · G-CRUD + the §2.8.1 immutability trigger · no soft delete | The aggregate root. `sessions_used` and `freeze_days_used` are denormalised counters with **zero** permitted staleness — a drift against `attendance` or `freezes` is a P1 incident, not a nightly correction.                    | `Schema.md` §8.1 |
| `membership_events` | RLS · **G-APPEND** (`INSERT` + `SELECT` only)                                   | The `§C4.1` transition journal, one row per state change, carrying actor, reason and `financial_reference_id`. It is append-only at the _grant_ level because a subsequent event is the only correction mechanism (`FR-MEMB-02`). | `Schema.md` §8.2 |
| `freezes`           | RLS · G-CRUD · `ex_freezes__no_overlap`                                         | One suspension window that extends `end_date` by exactly `days_count` **whole calendar days in the gym's timezone** — not 24-hour periods (`BR-MEM-05`).                                                                          | `Schema.md` §8.2 |

`attendance/` increments `memberships.sessions_used` in the check-in transaction. It does so through
`MEMBERSHIP_COMMAND_PORT.consumeSession` (see §4), **not** by writing the table — the table stays
owned here, and that is what keeps "one table, one module" true under a shared transaction.

> **Specification variance to resolve before M-062 (do not resolve in code).** `Schema.md` §8.2 names
> the freeze table **`freezes`**; `Milestones_060-089.md` M-062 names it **`membership_freezes`**.
> `Schema.md` is the binding derived specification and the roadmap is a plan of work (`CLAUDE.md`
> §2), so `freezes` is written above — but the two documents must be made to agree, in
> `DECISION_LOG.md`, before the migration is authored. M-062 also creates **`membership_transfers`**
> (append-only, RLS, no writer while `rel.memberships.transfer` is off); that table is **not** among
> the 79 tables of `Schema.md` §15.1 and needs the same treatment.

**Delivering milestones.** `memberships` is created in **M-059** (_"the `memberships` table is created
here, because a table cannot be created after its first writer"_ — R-M8) and this module takes
ownership of every subsequent transition at **M-061**, which also creates `membership_events`, the
deferred one-event-per-transition constraint trigger, and revokes M-059's direct `status` write path.
**M-062** adds `freezes`, the `btree_gist` exclusion constraint enforcing `BR-MEM-04` concurrency in
the **database**, `is_stackable`, `freeze_days_used`, `under_review_since` and
`renewed_from_membership_id`.

## 4. Public surface

_Planned. No code in this module yet - populated by the milestones listed below._

`index.ts` is the only file another module may import (`ModuleDependency.md` §7.1,
`module-public-api-only`). Four kinds of symbol, and nothing else:

| Exported symbol                                                                                    | Kind                                                    | Consumers                                                                                                               |
| :------------------------------------------------------------------------------------------------- | :------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------- |
| `MEMBERSHIP_QUERY_PORT`, `type MembershipQueryPort`                                                | Question + read-model port                              | `attendance/` (`findActiveEntitlementAtBranch`, `FR-CHK-04` step 3), `support/` (`FR-SUP-02`), `reporting/`, `refunds/` |
| `MEMBERSHIP_COMMAND_PORT`, `type MembershipCommandPort`                                            | Command port                                            | `refunds/` (`markRefunded`, edge `T05`/`T12`–`T15`), `admin/`, `attendance/` (`consumeSession` only — M-073)            |
| `type MembershipSummaryView`, `type MembershipEntitlementView`                                     | Read models owned here                                  | `attendance/`, `support/`, `reporting/`                                                                                 |
| `type MembershipActivatedPayload`, `type MembershipExpiredPayload`, `type MembershipFrozenPayload` | Event payload types                                     | `attendance/`, `crm/`, `reviews/`, `notifications/` — so a handler is typed without importing our domain (`E7`)         |
| `MEMBERSHIP_PERMISSIONS`                                                                           | Permission constants, `memberships.<resource>.<action>` | `iam/` and `admin/` for `FR-RBAC-05` effective-permission inspection                                                    |

**Never exported, and each for a different reason:** the `Membership` aggregate (two modules would
share one consistency boundary and `BR-MEM-01` would have two callers); `MembershipRepository`
(persistence shape leaks and §2 Q4 deletability is lost); any `dto/` class (it carries
`@nestjs/swagger` decorators, which would drag the framework into a consumer's domain layer); any
Prisma model or delegate. There is deliberately **no** `getMembership(id)` — the "give me the whole
entity" method is the anti-pattern `PROJECT_CONSTITUTION.md` §3.4.1 **X3** names.

Controllers exist here (`memberships/` is not one of the four provider-only modules of
`FolderStructure.md` §8.2): `membership.controller.ts` serves `/v1/me/memberships*` and
`tenant-membership.controller.ts` serves `/v1/tenant/memberships*`. Both read the **same** `status`
column — `FR-MEMB-12` forbids a separate gym-side status concept, and the contract test asserts
field-for-field equality of the status projection.

**Delivering milestones.** M-061 declares `membership-query.port.ts` and `membership-command.port.ts`;
M-073 extends the command port with `consumeSession`; M-070 adds
`POST /v1/me/memberships/:id/qr` (the response DTO lives here, the token codec lives in
`attendance/`).

## 5. Consumed ports

_Planned. No code in this module yet - populated by the milestones listed below._

Each row is an edge in `ModuleDependency.md` §3.2. Each is implemented by an adapter under
`infrastructure/adapters/` so the use case depends on an interface this module declares, never on the
provider's shape.

| Port                                         | Provider    | Why the answer must be synchronous                                                                                                                                                                                                                 |
| :------------------------------------------- | :---------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PLAN_TERMS_PORT` (§3.2 row 18)              | `plans/`    | Freeze cap, stackability, access window and session allowance are **guards on the transaction that is about to commit**. An eventually-consistent cap lets a freeze exceed `BR-MEM-05`; there is no compensating action for a day already granted. |
| `ORDER_SNAPSHOT_PORT` (row 19)               | `ordering/` | The purchased-terms snapshot is what `BR-PLN-02` freezes and what `BR-REF-02` later reads. It must be resolved before the membership row exists, because the snapshot _is_ part of the row.                                                        |
| `GYM_TIMEZONE_PORT` (row 20)                 | `catalog/`  | `BR-MEM-03` computes validity in the **gym's** timezone. At `Asia/Kolkata` +05:30 with no DST, a wrong zone shifts every boundary by a fraction of a day and produces an off-by-one `end_date` that nothing downstream can detect.                 |
| `MEMBER_QUERY_PORT` (row 21)                 | `crm/`      | The membership is anchored to the tenant's own record of the person (`memberships.crm_member_id`).                                                                                                                                                 |
| `UNIT_OF_WORK`, `OUTBOX`, `CLOCK`, `Money`   | `common/`   | Universal edge (§3.1). The outbox row is written **inside** the same interactive transaction as the state change (`E2`, `§C1.5`, ADR-0017).                                                                                                        |
| Tenant-scoped Prisma client, `TenantContext` | `tenancy/`  | Universal edge. No repository here may touch the raw client (`A-01`).                                                                                                                                                                              |
| `AUDIT_WRITE_PORT`                           | `audit/`    | Universal edge, injected by the `@Audited()` interceptor (`BR-DAT-01`).                                                                                                                                                                            |

**Forbidden and worth stating.** `memberships → payments` is **▲ event-only** in the §4 matrix. This
module must never ask _"was this paid?"_ — it learns from `payment.captured`. That cell is `BR-PAY-02`
and ADR-0013 expressed as a build rule. `memberships → staff` is **—**: there is no edge at all.

## 6. Emitted events

_Planned. No code in this module yet - populated by the milestones listed below._

Payloads carry `tenant_id` and `occurred_at` and **never** a name, phone, email or any other personal
datum (`E5`, `BR-DAT-06`).

| Event                                       | Payload beyond the two universals                | Known consumers                                                       |
| :------------------------------------------ | :----------------------------------------------- | :-------------------------------------------------------------------- |
| `membership.created`                        | `membership_id`, `order_id`, `plan_id`, `status` | `crm/`, `notifications/`                                              |
| `membership.activated`                      | `membership_id`, `start_date`, `end_date`        | `attendance/`, `crm/`, `notifications/`                               |
| `membership.frozen` / `membership.unfrozen` | `membership_id`, `freeze_id`, `days`             | `attendance/`, `notifications/`                                       |
| `membership.expired`                        | `membership_id`, `end_date`                      | `crm/`, `reviews/` (opens the review prompt window), `notifications/` |
| `membership.renewal-due`                    | `membership_id`, `days_before_expiry`            | `notifications/` — the `BR-MEM-11` T−15/−7/−3/−1 ladder               |
| `membership.suspended-for-sharing`          | `membership_id`, `evidence_ref`                  | `crm/`, `notifications/` (`BR-MEM-13`)                                |

Source: `ModuleDependency.md` §8.2. `FolderStructure.md` §9.1 additionally lists
`membership-cancelled`, `membership-refunded` and `membership-transferred` event files; those three
have **no row in the §8.2 catalogue and therefore no declared consumer**, so they are in-process
domain events only until a consumer is registered.

> **Specification variance (flagged, not resolved).** `Architecture.md` §10 carries a second event
> table that names `membership.renewed` (payload `membershipId`, `renewalIndex`) with **`ledger/` as a
> consumer, for the `A6.3` renewal commission step-down**, and `membership.expiring` where
> `ModuleDependency.md` §8.2 has `membership.renewal-due`. Both documents sit at the same precedence
> tier. The `membership.renewed → ledger/` edge is commercially load-bearing (renewal index ≥ 2 is
> charged at the reduced rate) and is missing from the §8.2 catalogue. This needs a `DECISION_LOG.md`
> entry before M-066 is built.

## 7. Consumed events

_Planned. No code in this module yet - populated by the milestones listed below._

Handlers live in `application/handlers/`, import **nothing** from the publishing module, and are
idempotent because the dispatcher may deliver more than once (`E3`).

| Event                               | Publisher     | Handler idempotency key         | What the handler decides                                                                                                                                                                                                         |
| :---------------------------------- | :------------ | :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payment.captured`                  | `payments/`   | `payment_id`                    | The only path to `→ ACTIVE`. Creates `PENDING` for a future start date, `ACTIVE` for today (`BR-PAY-02`, invariant 5, `E2E-02`).                                                                                                 |
| `order.paid`                        | `ordering/`   | `order_id`                      | The offline-sale equivalent of the above (`BR-MEM-02` staff-recorded payment).                                                                                                                                                   |
| `order.cancelled` / `order.expired` | `ordering/`   | `order_id`                      | `PENDING → CANCELLED` before start.                                                                                                                                                                                              |
| `refund.completed`                  | `refunds/`    | `refund_id`                     | `any → REFUNDED`. Attendance records are retained (`§B5.12` edge cases).                                                                                                                                                         |
| `gym.suspended`                     | `catalog/`    | `gym_id` + `occurred_at`        | Notify within 24 h and flag refund eligibility under `BR-REF-07` (`BR-MEM-14`).                                                                                                                                                  |
| `attendance.sharing-suspected`      | `attendance/` | `scan_run_id` + `membership_id` | Sets `under_review_since` — a **marker orthogonal to `status`**, not a seventh state. `BR-MEM-13` says _suspend pending review_, and `CR-04` in `BusinessRules.md` §21 records that this is not one of `BR-MEM-01`'s six states. |

A failing handler never rolls back the emitter (`E6`); it retries with backoff and then dead-letters
with an alert.

## 8. Jobs

_Planned. No code in this module yet - populated by the milestones listed below._

Five of the twenty-four `§C5` jobs. Every one runs under a distributed lock, records
start/end/outcome, emits `job_duration_seconds` and `job_outcomes_total`, and alerts on failure or on
exceeding its envelope.

| `§C5` job                       | Schedule                                                                              | Lock scope                                                                                                                                                                  | Expected duration                                                                                                                                                          |
| :------------------------------ | :------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `membership.activate-pending`   | Hourly, **per gym timezone**                                                          | `membership.activate-pending:{zone}:{localDate}` — one bucket per zone, **never per tenant**; two tenants in `Asia/Kolkata` are one bucket or the lock granularity is wrong | Not published in `§C5` or `Monitoring.md`; the envelope is declared by the delivering milestone and asserted by `ALRT-21`. `job_duration_seconds` buckets run 1 s → 7200 s |
| `membership.expire`             | Hourly, per gym timezone                                                              | `membership.expire:{zone}:{localDate}`                                                                                                                                      | As above. This is the job whose silence lets an expired member through the door — `ALRT-22` dead-man is S1 for it                                                          |
| `membership.unfreeze-scheduled` | Hourly                                                                                | Per zone and local date, same shape                                                                                                                                         | As above                                                                                                                                                                   |
| `membership.renewal-reminders`  | Daily **09:00 gym-time**, five offsets (T−15/−7/−3/−1 and expiry), tenant-overridable | Per zone and local date                                                                                                                                                     | As above                                                                                                                                                                   |
| `membership.auto-renew`         | Daily                                                                                 | Per zone and local date; the charge itself is idempotent on `(membership_id, period)`                                                                                       | As above                                                                                                                                                                   |

Two properties that are easy to get wrong and are therefore stated: `end_date` is **re-read inside**
the locking transaction, so a freeze committed between selection and update leaves the membership
`FROZEN` with the extended date rather than expiring it (`BusinessRules.md` §18.1); and the
`auto_renew` flag is re-read **inside** the charging transaction, so a cancellation after selection
yields zero charges (`BR-MEM-10`).

`Asia/Kolkata` is `+05:30`. **No whole-hour UTC cron can express local midnight there** — the
scheduling primitive of M-063 (`nextLocalMidnightUtc`) exists for exactly this, and
`nextLocalMidnightUtc('Asia/Kolkata', 2027-03-31T12:00:00Z)` is asserted as the literal
`2027-03-31T18:30:00Z`.

**Delivering milestones.** M-063 (the zone primitive), M-067 (`membership.expire`,
`membership.activate-pending`), M-068 (`membership.renewal-reminders`, `membership.auto-renew`).
`membership.unfreeze-scheduled` is delivered with the freeze pair, M-064 / M-065.

## 9. Top three failure modes

`NFR-MNT-09`. The three are declared in `PROJECT_CONSTITUTION.md` §18.5.1 and are the section-5
headings of the runbook — see **[`/docs/runbooks/memberships.md`](../../../../docs/runbooks/memberships.md)**.

|  #  | Declared mode                                  | Signal                                                                                                                                                                                                                                                                                                                                         | First action                                                                                                                                                                                                                                                                                                                                   |
| :-: | :--------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **Expiry job missed its window in a timezone** | `ALRT-22` job dead-man: `time() - job_last_success_timestamp_seconds{job_name="membership.expire"} >` 2× the interval, **or** `job_items_processed_total` flat across three runs. The visible second-order signal is `ALRT-24` — a `MEMBERSHIP_EXPIRED` denial cohort that is _smaller_ than expected, or expired members still being admitted | Read the scheduler tick's deterministic correlation id, then the distributed lock: is a dead holder still holding `membership.expire:{zone}:{localDate}`? Confirm the tick fired at local midnight `Asia/Kolkata`, not at 00:00 UTC                                                                                                            |
|  2  | **Activation not triggered by capture**        | `ALRT-24` with `denial_reason = MEMBERSHIP_NOT_FOUND` (S1), preceded by `ALRT-10` webhook lag or `ALRT-21B` outbox dispatch lag. Members have paid and have no membership — invariant 5 breaking                                                                                                                                               | Follow the chain in order: is Razorpay delivering? is the receiver returning 2xx? is `outbox_oldest_unpublished_age_seconds` rising for `payment.captured`? Never activate by hand from a client success signal — replay the outbox row                                                                                                        |
|  3  | **Freeze extension miscomputed across DST**    | A freeze whose `days_count` does not equal the shift in `end_date`; `freeze_days_used` disagreeing with `SUM(freezes.days_count)` for the term                                                                                                                                                                                                 | Recompute the interval as **whole calendar days in the gym's zone**, not elapsed hours. **Note for the launch market:** `Asia/Kolkata` has _no DST_, so the declared mode's stated cause cannot occur in India. The live risk is the `+05:30` offset and calendar-day counting — the correction is a compensating freeze record, never an edit |

Kill switches: `rel.memberships.freeze` (off ⇒ no freeze action on any surface, but in-flight freezes
still unfreeze on schedule and their extended end dates stand — an in-flight freeze is a commitment),
`rel.memberships.auto-renewal` (off ⇒ the daily job takes no charges; reminders continue, so nobody
lapses because the flag is off), `rel.memberships.transfer` (off ⇒ `404`). All three are `OFF` at
launch per `FEATURE_FLAGS.md`. None of them can disable `BR-MEM-01`, `BR-MEM-02` or `BR-MEM-03` —
membership state is not flag-disableable (`CLAUDE.md` §9.7, `BusinessRules.md` §20.2).
