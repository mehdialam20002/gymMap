# settlements

> Charter (`MASTER_PRD.md` §C1.3): **batches, statements, payouts, reserve.**

---

## 1. Bounded context

`settlements/` owns the answer to _"how much of this tenant's money is payable, when, and on what
evidence?"_ It is the only module that may close a batch, instruct a payout, withhold or release
reserve, and declare a cycle reconciled. The decision that defines the boundary is **where the
figures come from**: a batch is a _derived aggregate over `ledger_entries`_, never over orders
(`BR-FIN-01`, `ModuleDependency.md` §11.3 — _"the most expensive mistake on this list and the only
one tooling cannot prevent"_). It also owns the refusal at the end of the pipeline: the closure
assertion is exact equality in integer paise with **zero tolerance**, and a one-paise difference
leaves the batch `OPEN` rather than paying an amount nobody can derive.

## 2. PRD identifiers

| Class          | Identifiers                                                                                                                                                                                                                                    |
| :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional     | `FR-SETL-01` … `FR-SETL-10`                                                                                                                                                                                                                    |
| Business rules | `BR-FIN-01` … `BR-FIN-08`; `BR-REF-05` and `BR-REF-08` (refunds and disputed amounts as negative lines / held amounts); `BR-CPN-05` (coupon `funding_source` selects the commission base); `BR-TEN-01`                                         |
| Non-functional | `NFR-DQ-02`, `NFR-SEC-07` (payout credentials held separately from collection credentials), `NFR-SEC-11` (MFA step-up on the second approval), `NFR-USE-01`, `NFR-MNT-09`                                                                      |
| Commercial     | **`A6.3`** (the eight persisted figures; nine with `commission_tax_minor`), **`A6.4`** (T+7 default cycle, 14-day new-tenant hold, minimum payout, 5%/30-day reserve, negative-balance carry-forward, daily reconciliation)                    |
| State machine  | **`§C4.7`** — `OPEN → CLOSED → PENDING_APPROVAL → APPROVED → PROCESSING → PAID`, with `CLOSED → ON_HOLD` and `FAILED → PENDING_APPROVAL`. Eight states internally; the six of `FR-SETL-07` are a tenant-facing **mapping**, not a redefinition |
| `§C5` jobs     | `settlement.build-batches`, `settlement.reconcile`, `reserve.release`                                                                                                                                                                          |
| Acceptance     | `AC-SETL-01.1` … `AC-SETL-01.4`                                                                                                                                                                                                                |
| Screens        | `SCR-DASH-014`, `SCR-ADM-007`, `SCR-ADM-010`                                                                                                                                                                                                   |
| Gates          | Invariant 2, **`BAC-07`** (zero variance is a launch condition), `E2E-12`, `KPI-26` (100%, no error budget)                                                                                                                                    |

## 3. Owned tables

_Planned. No code in this module yet - populated by the milestones listed below._

| Table                                             | Source                                       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                             |
| :------------------------------------------------ | :------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settlement_batches`                              | `Schema.md` §9.2                             | `UNIQUE (tenant_id, period_start, period_end)` is the `TR-25` idempotency guarantee **at the database**, not in the job. `ck_settlement_batches__sums_to_payable` is `BR-FIN-03` as a constraint. `payout_snapshot` copies the bank identifiers at batch creation, so a later bank-detail change cannot rewrite where the money is shown to have gone. `approved_by_1`/`approved_by_2` with a distinctness `CHECK` is `BR-FIN-08` |
| `settlement_lines`                                | `Schema.md` §9.2                             | **G-APPEND.** All eight `A6.3` figures denormalised per line so a statement rendered in 2029 shows the arithmetic that applied in 2026. `gateway_fee_minor` is **nullable, and the nullability is load-bearing**: it makes _"not yet reported"_ representable instead of guessable (`BR-FIN-06`)                                                                                                                                  |
| `reserves`                                        | `Schema.md` §9.2                             | `rate_bps` persisted with the hold, `matures_on` default 30 days, hold and release each pointing at their batch                                                                                                                                                                                                                                                                                                                   |
| `payout_accounts`                                 | `Schema.md` §4.4, `ENGINEERING_PLAN.md` §4.3 | Created here on `application.approved` — `ModuleDependency.md` §4.2 names _"create the payout account in step 4"_ as the forbidden `onboarding → settlements` edge, resolved as an event. `uq_payout_accounts__one_primary` is a partial unique index; `ifsc` carries the India format check                                                                                                                                      |
| `payout_attempts`                                 | `M-095`                                      | `SELECT, INSERT` only, `UNIQUE (settlement_batch_id, attempt_no)`. Every attempt is a new row — a retry never overwrites the record of the failure that preceded it                                                                                                                                                                                                                                                               |
| `reconciliation_runs`, `reconciliation_variances` | `M-096`                                      | A run row is written **either way**; a clean day produces a row, not silence                                                                                                                                                                                                                                                                                                                                                      |

Not owned here: **`commission_rules`** is platform-global, written by `admin/` (`M-114`) and read
through `common/persistence/reference-data.repository.ts` (`ModuleDependency.md` §0 C-3). And a wrong
batch is never edited — it is closed, paid or cancelled per `§C4.7`, and the correction appears as
adjustment lines in the **next** batch with the opening balance carrying the difference.

> **Two naming discrepancies to close before `M-096`.** The last three tables are roadmap additions
> and do not appear among `Schema.md`'s 79. Separately, `Monitoring.md` §9.4's worked diagnostic
> queries read from a table called `settlement_reconciliation`, and from `gateway_settlement_lines`
> and `ledger_settlement_lines`; `M-096` names `reconciliation_runs` and `reconciliation_variances`.
> `RB2` requires every runbook query to be copy-pasteable and to have been run, so one of the two
> must move. Recorded here rather than guessed at.

**Delivering milestones** — `M-088` (`settlement_lines`), `M-090` (`settlement_batches`),
`M-091` (`reserves` and the tenant reserve configuration), `M-092` (roll-forward columns),
`M-095` (`payout_attempts`), `M-096` (the two reconciliation tables). `payout_accounts` has no
milestone in `M-001` … `M-120` that creates it by name — the earliest binding reference is
`PUT /v1/tenant/payout-account` in `API_Catalog.md`, and the gap should be raised at Sprint-11
refinement.

## 4. Public surface

_Planned. No code in this module yet - populated by the milestones listed below._

Two controllers and therefore a mandatory `permissions.ts` (`FR-RBAC-01`). Tenant:
`GET /v1/tenant/settlements`, `GET /v1/tenant/settlements/:id`,
`GET /v1/tenant/settlements/:id/statement`, `GET|PUT /v1/tenant/payout-account`. Platform:
`GET /v1/admin/settlements`, `GET /v1/admin/settlements/:id`,
`POST /v1/admin/settlements/:id/approve`, `GET /v1/admin/reconciliation` — all `access(mfa)`,
`runElevated()`-wrapped and audited **before** the work.

| Exported symbol                                                                                             | Kind                                                                            | Consumers                             |
| :---------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------ | :------------------------------------ |
| `SETTLEMENT_PERMISSIONS`                                                                                    | Permission constants                                                            | `iam/` (enumeration), `admin/`        |
| `SettlementStatementSummary` and the batch/line read-model types                                            | Read-model types — named as the canonical example in `ModuleDependency.md` §7.1 | `reporting/` (●), `admin/` (●)        |
| `SettlementBatchBuiltPayload`, `SettlementPaidPayload`, `SettlementFailedPayload`, `ReserveReleasedPayload` | Event payload types                                                             | `ledger/`, `notifications/`, `admin/` |

The permission strings are fixed by `API_Catalog.md`: `settlements.batch.list`,
`settlements.batch.read`, `settlements.batch.list_all`, `settlements.batch.read_all`,
`settlements.batch.approve`, `settlements.batch.build`, `settlements.payout_run.approve`,
`settlements.reconciliation.read`, `settlements.reconciliation.resolve`,
`settlements.statement.read`, `settlements.payout_account.read`,
`settlements.payout_account.update`. `M-094` adds `admin.settlement.approve` and
`admin.settlement.approve_second`.

> **No query or command port token is named for `settlements/` anywhere in the specification.**
> `ModuleDependency.md` §3.2 row 46 gives `reporting/` a `*_QUERY_PORT` and row 47 gives `admin/` a
> command interface, but neither is named, and §3.2's own preamble says _"if a port is not in this
> table, the edge does not exist."_ The naming grammar implies `SETTLEMENT_QUERY_PORT` and a
> settlement command port; they are **not** invented here. `M-093` and `M-094` must name them and add
> the rows.

Never exported: the `SettlementBatch` aggregate, `allocate()`, the closure assertion, the commission
calculators, the reconciliation repository (which holds the module's only permitted `$queryRaw`), or
any Prisma type.

**Delivering milestones** — `M-088` (module shell and `index.ts`), `M-090` and `M-093` (tenant
controller), `M-094` (admin controller and `permissions.ts` additions), `M-097` (the two admin
screens).

## 5. Consumed ports

_Planned. No code in this module yet - populated by the milestones listed below._

| From                            | Port                                | Why the answer must be synchronous                                                                                                                                                                                                                                                                            |
| :------------------------------ | :---------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ledger/`                       | `LEDGER_READ_PORT`                  | `BR-FIN-01`: a batch **is** a derived aggregate over ledger facts. Assembly runs at `REPEATABLE READ` (`Schema.md` §2.10) because the roll-ups and the lines must see one identical set of entries, or the `BR-FIN-03` sum-to-payout check fails intermittently — an event-delivered view could not give that |
| `payments/`                     | `PAYOUT_PORT`, `PAYMENT_QUERY_PORT` | The Razorpay Route transfer must return before `§C4.7` may advance past `PROCESSING`; and the gateway fee, which `BR-FIN-06` forbids estimating, must be read as reported                                                                                                                                     |
| `billing/`                      | `INVOICE_QUERY_PORT`                | Statement lines cite invoice numbers, and the statement is generated inside the batch-closure flow (`FR-SETL-04`)                                                                                                                                                                                             |
| `refunds/`                      | `REFUND_QUERY_PORT`                 | Refunds recognised in the period appear as negative lines in the batch being assembled (`FR-SETL-03`, `BR-REF-05`)                                                                                                                                                                                            |
| `ordering/`                     | `ORDER_QUERY_PORT`                  | **`coupon.funding_source` only.** `BR-CPN-05` selects the commission base — gym-funded gives `B = N`, platform-funded gives `B = N + D`. `ModuleDependency.md` §11.3 restricts this legal edge to exactly that one fact; reading `orders.net_minor` here is the named failure                                 |
| `common/`                       | `ReferenceDataRepository`           | `commission_rules`, as platform-global reference data — never by importing `admin/`                                                                                                                                                                                                                           |
| `common/`, `tenancy/`, `audit/` | Universal edges                     | `Money`, `Clock`, the outbox port; the tenant-scoped client; `AUDIT_WRITE_PORT` — every approval writes actor, batch id, amount, threshold, flag state and MFA assertion id (`BR-DAT-01`, `BAC-13`)                                                                                                           |

> `ModuleDependency.md` §4's matrix marks `settlements → iam` as **●** but §3.2 names no port on that
> pair. Approver identity is the plausible need and `M-094` is where it would surface; until a port is
> named and a §3.2 row added, no injection is planned.

**Delivering milestones** — `M-090` (`ledger/`), `M-093` (`billing/`), `M-094` (`audit/`),
`M-095` (`payments/`), `M-097` (`refunds/`, `ordering/`).

## 6. Emitted events

_Planned. No code in this module yet - populated by the milestones listed below._

| Event                    | Payload beyond `tenant_id`, `occurred_at`        | Known consumers                       | Handler key downstream |
| :----------------------- | :----------------------------------------------- | :------------------------------------ | :--------------------- |
| `settlement.batch-built` | `batch_id`, `line_count`, `payable_to_gym_minor` | `notifications/`, `admin/`            | `batch_id`             |
| `settlement.paid`        | `batch_id`, `payout_ref`, `paid_at`              | `ledger/`, `notifications/`, `admin/` | `batch_id`             |
| `settlement.failed`      | `batch_id`, `failure_code`                       | `notifications/`, `admin/`            | `batch_id` + `attempt` |
| `reserve.released`       | `reserve_id`, `amount_minor`                     | `ledger/`, `notifications/`           | `reserve_id`           |

`M-092` additionally specifies a `TenantNegativeBalanceEscalated` outbox event carrying the `RSK-06`
checklist, emitted on a **second consecutive** negative cycle and not on the first. It is not among
the fifty-two catalogued in `ModuleDependency.md` §8.2 and needs a row there — including a name in
the `<aggregate>.<past-tense-verb>` grammar of `E4`, which the current PascalCase working name does
not satisfy.

**Delivering milestones** — `M-090` (`settlement.batch-built`), `M-091` (`reserve.released`),
`M-095` (`settlement.paid`, `settlement.failed`), `M-092` (the negative-balance escalation).

## 7. Consumed events

_Planned. No code in this module yet - populated by the milestones listed below._

| Event                                 | Publisher     | Handler idempotency key | Why it matters here                                                                                                                                                                                                                                                                        |
| :------------------------------------ | :------------ | :---------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `application.approved`                | `onboarding/` | `application_id`        | Creates the payout account. The synchronous alternative would be an upward L3→L6 edge                                                                                                                                                                                                      |
| `ledger.entry-appended`               | `ledger/`     | `ledger_entry_id`       | The batch's candidate set grows as facts land                                                                                                                                                                                                                                              |
| `invoice.issued`                      | `billing/`    | `invoice_id`            | Statement lines cite the invoice number                                                                                                                                                                                                                                                    |
| `refund.completed`                    | `refunds/`    | `refund_id`             | The negative line. Its payload carries `commission_reversal_minor` — the one place in the catalogue where an event payload carries a derived money figure, and it does so **because this module must produce the negative line before it can re-read the ledger in the next batch window** |
| `dispute.opened` / `dispute.resolved` | `refunds/`    | `dispute_id` + `status` | `BR-REF-08`: from case opening the disputed amount is excluded from batch construction; a favourable resolution returns it to the next batch                                                                                                                                               |

The reverse pair is asymmetric on purpose: `settlements → refunds` is a synchronous **●** (a batch
must include the period's refunds), while `refunds → settlements` is **▲** — a completed refund
_notifies_ settlements, it never reaches into a batch.

**Delivering milestones** — `M-090` (`ledger.entry-appended`), `M-093` (`invoice.issued`),
`M-097` (`refund.completed`), `M-102` (the two dispute events and the batch exclusion they drive).
`application.approved` has no named delivering milestone; see the `payout_accounts` gap in §3.

## 8. Jobs

_Planned. No code in this module yet - populated by the milestones listed below._

Three of the twenty-four `§C5` jobs. All three are class **P0** `MONEY_CRITICAL`: never throttled,
never shed, never delayed, and a double execution is a Severity-1 defect (ADR-0009).

| `§C5` job                  | Schedule                                                                                                                     | Queue · class · conc. · scope                   | Lock scope                                                                                                                                                                                 | Expected duration                                                                                                                                                 |
| :------------------------- | :--------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settlement.build-batches` | Daily **02:00 in the tenant's timezone** — for `Asia/Kolkata` that is **20:30 UTC the previous day**, never a fixed UTC cron | `settlements` · P0 · 2 (tenant batches) · PL→TS | `settlement.build-batches:tenant_{id}:{periodStart}_{periodEnd}` — per tenant per period. The lock is an **optimisation**; `UNIQUE (tenant_id, period_start, period_end)` is the guarantee | 10 min Y1 (286 tenant-batches) → 100 min at 10× (2,860). Depth 0 by 06:00; it must finish inside the 02:00–06:00 window and at 10× consumes most of it (`SC-F14`) |
| `settlement.reconcile`     | Daily **04:00 IST** = 22:30 UTC the previous day                                                                             | `settlements` · P0 · 2 · PL                     | `settlement.reconcile:tenant_{id}:{date}`                                                                                                                                                  | 8 min Y1 → 80 min at 10×. Depth 0 by 08:00. `SLO-05` has **no error budget**                                                                                      |
| `reserve.release`          | Daily, at the tenant's local hour                                                                                            | `settlements` · P0 · 1 · TS                     | `reserve.release:tenant_{id}:{date}`; idempotent **per hold id**                                                                                                                           | 15 s Y1 → 2 min at 10×. Depth 0 by 06:00                                                                                                                          |

Re-execution is a no-op by database constraint, not by application check: job 9 by the batch
uniqueness, jobs 10 and 11 by the `§C4.7` status-transition guard — a batch already reconciled is
skipped.

`M-092` adds a fourth, non-`§C5` processor: `negative-balance-review`, daily, escalating on a second
consecutive negative cycle. It has no `§C5` row and no envelope in `Scalability.md` §8.3.2 and needs
one or an explicit exemption.

**Delivering milestones** — `M-090` (`settlement.build-batches`), `M-091` (`reserve.release`),
`M-096` (`settlement.reconcile`), `M-092` (`negative-balance-review`).

## 9. Top three failure modes (`NFR-MNT-09`)

The three declared for `settlements/` in `PROJECT_CONSTITUTION.md` §18.5.1. All three are money
failures and none has a kill switch that makes them go away — `rel.settlements.auto-payout` and
`ops.settlements.auto-build` stop the _activity_, they do not correct a figure.

|  #  | Failure mode                         | Signal                                                                                                                                                                                                                                    | First action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| :-: | :----------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|  1  | **Reconciliation variance**          | **`ALRT-14`** — `settlement_reconciliation_variance_minor != 0` for any tenant. One occurrence, no sustain window, **never silenced**. S1 always                                                                                          | **Do nothing to the payout.** `BR-FIN-07` has already blocked auto-payout for the affected tenants and that is correct. Establish scope, then direction (sign), then the IST/UTC period boundary — third, because it is the most common cause and the cheapest to confirm. Correct **only** by compensating entry; a correction that edits a ledger row is a worse incident than the variance                                                                                                                                         |
|  2  | **Payout rejected by bank**          | `ALRT-15` — `payout_outcomes_total{outcome=~"REJECTED\|RETURNED"}` increasing, or `settlement_batches_total{status="FAILED"}` climbing; `gym.settlement.payout_failures`                                                                  | Read the provider's own rejection code and message off the `payout_attempts` row — the batch carries the bank's words, not ours. Check whether the payout account or KYC changed. **Never retry a timed-out payout blindly**: the outcome is unknown, idempotency is keyed on `settlement_batch_id` at the provider, and the status poll — not the retry — is what resolves it. Three consecutive failures move the batch to `ON_HOLD` and stop retrying                                                                              |
|  3  | **Batch build exceeding its window** | `ALRT-21` (duration overrun) or `ALRT-22` (dead-man: no success in 2× the interval) on `job_name="settlement.build-batches"`; `settlement_batch_build_duration_seconds` past its envelope; `gym.settlement.batch_close_failures` non-zero | Distinguish _slow_ from _refusing to close_. A close failure is the `BR-FIN-03` assertion doing its job: each component is persisted on the batch, so the disagreement is diagnosable from the row without re-running. If it is genuinely slow, check `idx_settlement_lines__eligible` and `idx_ledger_entries__unbatched`. **Under no circumstances introduce a tolerance** — `BAC-07` requires zero variance, and a tolerance is the mechanism by which the system stops being able to tell a rounding artefact from a missing line |

**Runbook:** [`/docs/runbooks/settlements.md`](../../../../docs/runbooks/settlements.md) · see also
the fully worked `reconciliation-variance.md` (`Monitoring.md` §9.4).
