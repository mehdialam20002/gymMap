# ledger runbook

> **Status: stub.** `NFR-MNT-09` requires a runbook per module covering its top three failure modes.
> The three below are fixed by `PROJECT_CONSTITUTION.md` §18.5.1. The eight-field per-mode structure
> of `Monitoring.md` §9.1 — symptom, alert, blast radius, diagnose, mitigate, fix, verify, prevent —
> is filled in by the milestones named under **Dashboards and queries**; `RB2` requires every query
> here to have been **run**, and none can be before the tables exist.
>
> Owner **Backend Lead (settlements)** · primary alerts `ALRT-17`, `ALRT-47` (`Monitoring.md` §9.6).
> `Monitoring.md` §9.6 names this file `ledger.md`, which is what `FolderStructure.md` §8.3 row 9
> requires — this is one of the few module runbooks where the two documents already agree.

## Scope

`ledger/` owns one table, `ledger_entries`, and through it the derivation of **every** balance in the
system. No other module may state a balance; another module may only append an entry and read the
derivation. `BR-FIN-01` is not a policy this module follows but a boundary property it is shaped to
make unrepresentable: it imports `common/` and `tenancy/` and nothing else (ADR-0029,
`ModuleDependency.md` §0 C-1), so it physically cannot reach into an order or a payment to "check" a
figure. Twelve `entry_type` values land at `M-087` — `SALE`, `COMMISSION`, `GATEWAY_FEE`, `TAX`,
`REFUND`, `COMMISSION_REVERSAL`, `CHARGEBACK`, `CHARGEBACK_REVERSAL`, `RESERVE_HOLD`,
`RESERVE_RELEASE`, `PAYOUT`, `ADJUSTMENT` — plus `COMMISSION_TAX` and `COMMISSION_TAX_REVERSAL`
added inert at `M-089`. `amount_minor` is always non-negative and `direction` carries the sign.
`reference_id` is polymorphic across the six `ledger_reference_type_enum` targets and deliberately
carries **no FK** (`Schema.md` §9.1), so resolvability is checked by the nightly `ops.orphan-scan`
rather than by the planner — the orphan window is one job cycle, which is acceptable only because
the table is append-only.

The enforcement is the **grant shape**, not the interface: `INSERT` for `app_append`, `SELECT` for
`app_rw` and `app_platform_ro`, and `UPDATE (settlement_batch_id)` alone — Deviation **D-05** in
`Schema.md` §16.1, guarded by `ck_ledger_entries__batch_assign_once` so the transition is
`NULL → value` exactly once. `infra/scripts/ledger-grant-assertion.sh` runs on **every deploy in
every environment** and fails the deploy if any other `UPDATE` or any `DELETE` appears. There are no
controllers here — `FolderStructure.md` §8.2 — because a write endpoint on the ledger is the exact
API that would let something adjust a balance.

**Blast radius when this module is down.** Wider than its size suggests, because the writes are not
its own. Every `SALE`, `COMMISSION` and `TAX` entry is written inside the transaction that captured
the payment, so a ledger write failure fails the **capture**, not just the bookkeeping — and
`refunds/` appends its reversal entries synchronously through `LEDGER_APPEND_PORT` inside its own
transaction (`ModuleDependency.md` §12.2), so a refund cannot complete either. What survives:
check-in, search, membership entitlement and every read path, because none of them asks this module
anything. What stops within a day: `settlement.build-batches`, whose candidate set is a scan over
this table, and therefore the whole T+7 payout cycle.

**Kill switches: none, and the absence is the design.** `BR-PAY-01` and `BR-FIN-01` are both on the
`FEATURE_FLAGS.md` §6.3 **protected list** — no flag, of any type, in any state, may gate them.
`mig.ledger.balance-projection` is registered **off** and is not a kill switch: it exists so that the
materialised balance nobody has built yet stays unbuilt, and a structure test proves the settlement
build path never imports a projection (`M-087` AC 11). The only operational lever adjacent to this
module is `ops.settlements.auto-build`, which stops batches being assembled; it does not correct or
suppress a single entry.

## Top failure modes

| Signal | Likely cause | First action | Escalation |
| :--- | :--- | :--- | :--- |
| **1 — Entry write failure inside a capture transaction.** `ALRT-17` (**S1**) on `increase(ledger_balance_mismatch_total[1h]) > 0`. Upstream tells of the same incident: `ALRT-10` webhook lag, or `ALRT-33` database health with deadlocks concentrated on ledger writes. What a human sees is a member who paid and has nothing, or a statement that will not tie out at 04:00 | A deadlock or pool exhaustion inside the capture transaction; a handler that opened its own transaction instead of joining the caller's; or `app.tenant_id` not set, so the RLS-forced insert had no rows it was allowed to write | **Establish whether the capture also failed.** The entry and its cause share one transaction (`M-087` AC 8), so a failure should leave **neither**. A captured payment with no `SALE` entry means the atomicity was broken, and *that* is the incident — the missing row is a symptom. Do not insert the entry by hand to "catch up": a manual entry has no `reference_id` anyone can audit and reproduces the divergence next cycle | Page **Finance on-call + Backend Lead (settlements)** together (`Monitoring.md` §10.1). Payouts for affected tenants are frozen pending explanation, which `ALRT-17` states as policy, not as a responder's choice |
| **2 — Balance derivation slow at scale.** `db_transaction_duration_seconds` p99 on the derivation query; `ALRT-33` pool saturation; `settlement.build-batches` approaching its **10 min (Y1) / 100 min (10×)** envelope and raising `ALRT-21` on duration overrun. The 02:00–06:00 window is what is actually at risk — at 10× the job consumes most of it (`SC-F14`) | The candidate scan is the one query that crosses a tenant's whole ledger history and it grows monotonically, because `R-FIN` means nothing is ever deleted. A dropped or unused partial index turns that scan linear | Confirm `idx_ledger_entries__unbatched` — the partial index on `(tenant_id, occurred_at) WHERE settlement_batch_id IS NULL` — is being **used**, not merely present; `EXPLAIN` the candidate scan for the slowest tenant. **Do not add a materialised balance.** `M-087`'s closing note names it as the trap: it will be correct for months, then diverge, and at that moment there is no way to determine which number is right | Ticket to Backend Lead (settlements); DevOps if the pool rather than the plan is the constraint. If the batch window is genuinely breached, that is an `ALRT-21` money-job page, because a missed window pushes `settlement.reconcile` behind it and a late reconcile **hides `ALRT-14`** |
| **3 — Reversal without a matching original.** `ALRT-17`; `ledger_entries_written_total{entry_type="COMMISSION_REVERSAL"}` incrementing without a corresponding `COMMISSION`; the nightly `ops.orphan-scan` reporting an unresolvable `reference_id` | A reversal computed against the current commission rate rather than the rate frozen on the order; a refund path that appended the reversal but rolled back the original lookup; or a `reference_id` pointing at a target of the wrong `reference_type` | **Identify the originating `reference_id` before writing anything.** `BR-REF-05` requires the reversal to be a **proportion of the persisted commission**, computed at the order's stored rate and the original rounding — never a rate multiplication. A reversal recomputed at today's rate is `BR-REF-05-N1`: a different and worse defect than a missing original, because it is plausible and will pass every arithmetic check except the statement sum | Ticket to Backend Lead (settlements) + Finance. Escalate to S1 the moment the orphan count is greater than one tenant, because a systematic reversal error propagates into `BR-FIN-03`'s exact-sum assertion and surfaces as `ALRT-14` the next morning |

**Separate from all three, and louder.** `db_append_only_grant_violations_total` and its
`gym.ledger.grant_violation` alias have exactly one acceptable value: **0**. Any increment means code
exists that believes it may rewrite history — the grant blocked it, and this counts the attempt
(`ERD.md` §10). It pages immediately under `ALRT-17`, and the log line's `module` and
`correlation_id` name the offending code path exactly, so triage is a grep and not an investigation.

**One adjacent alert that will look like `ledger/` and is not.** `ALRT-47` compares metric-derived
GMV, refund value and dispute count against the ledger-derived figures daily at 05:00 IST and fires
above 0.5%. It is S2 **until you know which side is wrong** — a systematic offset usually means a
UTC-versus-`Asia/Kolkata` day boundary and the counters are at fault; a random offset means dropped
counter increments. If the **ledger** side is the short one, it escalates to S1 and becomes this
runbook's failure mode 1.

## Dashboards and queries

_To be populated by **M-087** ("`ledger_entries` — append-only by grant, not by discipline"),
**M-089** (commission with the rate frozen at sale, and `commission_tax_minor`) and **M-101** (the
credit note and proportional commission reversal at the original rounding). `ALRT-47`'s panel is
shared with **M-096**, which owns `settlement.reconcile`._

Intended content, named now so those milestones have a target:

- **Panel — append-only integrity.** `db_append_only_grant_violations_total` by `table` and
  `ledger_balance_mismatch_total`, both rendered as **red-if-nonzero stat tiles**, never sparklines —
  `Monitoring.md` §18 dashboard 7 makes that explicit, because a sparkline hides a single event and a
  single event is the whole signal here.
- **Panel — entry mix.** `ledger_entries_written_total` by `entry_type` and `direction`. The two
  India entry types added inert at `M-089` should read **zero** until `REG-02` is settled; a non-zero
  `COMMISSION_TAX` before that decision is a finding, not a feature.
- **Panel — derivation cost.** `db_transaction_duration_seconds` p99 for the derivation query and for
  the `settlement.build-batches` candidate scan, drawn as **separate series** against the 10 min / 100
  min envelope, so a slow batch is never mistaken for a slow balance.
- **Panel — telemetry divergence.** The `ALRT-47` pair: metric-derived versus ledger-derived `KPI-14`
  GMV and `KPI-20` refund value for the same IST day, with the 0.5% band drawn.
- **Query — derived balance per tenant, ordered by mismatch magnitude.** The query `ALRT-17` names in
  its diagnosis column. Read-only, `LIMIT`-bounded (`RB6`), and the first thing run on any imbalance.
- **Query — unbatched entries older than one cycle.** `settlement_batch_id IS NULL` with
  `occurred_at` before the last closed period start. Entries that should have been swept into a batch
  and were not are the shape a missed build window leaves behind.
- **Query — orphan reversals.** `COMMISSION_REVERSAL` and `CHARGEBACK_REVERSAL` entries whose
  `reference_id` has no matching original at the same `reference_type`. This is failure mode 3's
  diagnostic and the verification that a correction landed.
- **Query — the grant assertion, as a query.** The same predicate
  `infra/scripts/ledger-grant-assertion.sh` runs, read from `information_schema.role_table_grants`,
  so an on-call engineer can confirm the privilege state without a deploy. It is a **check**, never a
  remedy: if it returns a row, the fix is a migration, not a `REVOKE` typed at 03:00.
- **Data recovery note.** Nothing here is recoverable by editing, and nothing needs to be. A
  correction is a **compensating entry** — same `reference_id`, opposite `direction` — because
  `BR-FIN-01` forbids a mutable balance and the grants forbid the alternative. PITR restores money by
  **replay**, never by edit (ADR-0015, `Deployment.md`). The one repairable field is
  `settlement_batch_id`, and only in the `NULL → value` direction: a batch that assigned the wrong
  entries is cancelled per `§C4.7` and the correction appears as adjustment lines in the **next**
  batch, with the opening balance carrying the difference.

## Known incidents

_None yet._
