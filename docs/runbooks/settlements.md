# settlements runbook

> **Status: stub.** `NFR-MNT-09` requires a runbook per module covering its top three failure modes.
> The three below are fixed by `PROJECT_CONSTITUTION.md` §18.5.1. The eight-field per-mode structure
> of `Monitoring.md` §9.1 — symptom, alert, blast radius, diagnose, mitigate, fix, verify, prevent —
> is filled in by the milestones named under **Dashboards and queries**; `RB2` requires every query
> here to have been **run**, and none can be before the tables exist.
>
> Owner **Finance + Backend Lead (settlements)** — jointly, because Finance owns the number and
> engineering owns the cause · primary alerts `ALRT-14`, `ALRT-15`, `ALRT-22B` (`Monitoring.md` §9.6).
>
> **Filename conflict, unresolved.** `Monitoring.md` §9.6 gives this module **two** topic runbooks,
> `reconciliation-variance.md` and `payout-failure.md`, and §9.4 works the first of them in full;
> `M-094` adds a third, `settlement-approval-stuck.md`. `FolderStructure.md` §8.3 row 9 requires
> `/docs/runbooks/<module>.md`, one file per module, twenty-three with no exceptions. **This page is
> the module index** and the topic runbooks are written alongside the milestones below; the same
> owner decision that settles `catalog.md` versus `catalog-media.md` settles this
> (`DECISION_LOG.md`, `CLAUDE.md` §9.3).
>
> **Table-naming conflict, also unresolved.** §9.4's worked queries read from
> `settlement_reconciliation`, `gateway_settlement_lines` and `ledger_settlement_lines`. `M-096`
> names `reconciliation_runs` and `reconciliation_variances`. `RB2` requires every query in a runbook
> to be copy-pasteable and to have been run, so one of the two must move before `M-096` ships. Names
> below are given as `M-096`'s, with the §9.4 name in parentheses on first use.

## Scope

`settlements/` owns the answer to *"how much of this tenant's money is payable, when, and on what
evidence?"* It is the only module that may close a batch, instruct a payout, withhold or release
reserve, and declare a cycle reconciled. It owns `settlement_batches`, `settlement_lines` (G-APPEND,
with all eight `A6.3` figures denormalised per line so a statement rendered in 2029 shows the
arithmetic that applied in 2026), `reserves`, `payout_accounts`, `payout_attempts` and the two
reconciliation tables. The decision that defines the boundary is **where the figures come from**: a
batch is a derived aggregate over `ledger_entries`, never over orders — `ModuleDependency.md` §11.3
calls reading `orders.net_minor` here *"the most expensive mistake on this list and the only one
tooling cannot prevent"*. The one legal read from `ordering/` is `coupon.funding_source` and nothing
else, because `BR-CPN-05` selects the commission base.

Three of the twenty-four `§C5` jobs live here and all three are class **P0 `MONEY_CRITICAL`** — never
throttled, never shed, never delayed, and a double execution is a Severity-1 defect (ADR-0009).
`settlement.build-batches` runs daily at **02:00 in the tenant's timezone**, which for
`Asia/Kolkata` is 20:30 UTC the previous day and never a fixed UTC cron; `settlement.reconcile` at
**04:00 IST**; `reserve.release` daily at the tenant's local hour. Re-execution is a no-op by
**database constraint** rather than by application check: `UNIQUE (tenant_id, period_start,
period_end)` for the first, the `§C4.7` status-transition guard for the other two.

**Blast radius when this module is down.** Narrow in the moment, wide by the end of the week. Sales,
check-ins, refunds and the ledger are entirely unaffected — the ledger keeps accruing and every fact
needed to rebuild a batch survives, which is what makes an outage here recoverable by re-running
rather than by reconstruction. What stops is money reaching gyms: the T+7 cycle (`A6.4`), the
statement at `SCR-DASH-014`, and the two admin surfaces `SCR-ADM-007` and `SCR-ADM-010`. Payout
reliability is the single loudest determinant of tenant trust and feeds `KPI-04` retention, so a
two-day outage is a commercial event even though no data is at risk.

**Kill switches, and what they do not do.** `ops.settlements.auto-build` stops batch assembly
entirely — pull it when reconciliation shows an unexplained variance and money must stop moving
before anyone understands why; the ledger keeps accruing and tenants see the cycle as still open with
an explanatory status. `rel.settlements.auto-payout` off means every batch of every size waits for a
human. `rel.settlements.dual-payout-approval` off is **more restrictive**, not less: above-threshold
batches hold and escalate rather than paying on one signature (`FEATURE_FLAGS.md` §6.1 row 4, §6.3).
**None of the three corrects a figure.** They stop an activity. `BR-FIN-01`, `BR-FIN-03`, `BR-FIN-05`
and `BR-FIN-06` are on the §6.3 protected list and no flag may gate them in any state.

## Top failure modes

| Signal | Likely cause | First action | Escalation |
| :--- | :--- | :--- | :--- |
| **1 — Reconciliation variance.** **`ALRT-14`** — `settlement_reconciliation_variance_minor != 0` for **any** tenant. One occurrence, **no sustain window, never silenced** (`AL3`, `AL7`), **S1 always**. It is the one sanctioned `tenant_id` metric label (`MT2`) and the healthy state is **no series at all**. Finance sees a red count on `D-FINANCE`'s top row; the tenant sees a payout that has not arrived and asks within a day | Ordered by how often it is actually the cause: an **IST/UTC period boundary** (a report cut at UTC midnight against a ledger cut at IST midnight strands a 5½-hour band of transactions in the wrong cycle); a capture we never recorded, usually behind a webhook backlog; a gateway fee that was estimated somewhere instead of recorded as reported; or `commission_tax_minor` missing, which shows as a uniform offset of exactly 18% of commission | **Do nothing to the payout.** `BR-FIN-07` has already blocked auto-payout **for the affected tenants only** — deliberately per-tenant, because blocking globally converts a one-tenant data problem into a platform-wide payout outage, which is the availability failure `TA-1` would aim for. Then scope (one tenant, many-with-the-same, or many-with-different), then direction from the sign of `variance_minor`, then the period boundary **third** — most common cause, cheapest to confirm. Correct **only** by compensating entry; a correction that edits a ledger row is a worse incident than the variance | Page **Finance on-call and engineering on-call together**, immediately. Unresolved at 24 h → Technical Lead + Finance lead. Unresolved at 72 h, or affecting more than 5% of tenants → client sponsor, and it appears in the monthly service report regardless of how fast it was fixed. `SLO-05` has **no error budget** and `KPI-26` demands 100% |
| **2 — Payout rejected by bank.** `ALRT-15` (S2) — `increase(payout_outcomes_total{outcome=~"REJECTED\|RETURNED"}[15m]) > 0`, or `settlement_batches_total{status="FAILED"}` climbing. A gym expecting money on its T+7 cycle did not receive it | Payout account details changed or KYC lapsed; an IFSC or account-number validation failure the format check did not catch; a bank-side return days after an apparently successful instruction; or the provider rejecting on its own risk rules | Read the provider's **own** rejection code and message off the `payout_attempts` row — the record carries the bank's words, not our paraphrase, and every attempt is a new row because `UNIQUE (settlement_batch_id, attempt_no)` and the append-only grant mean a retry never overwrites the failure that preceded it. Then check whether `payout_accounts` changed: `payout_snapshot` on the batch holds the identifiers **as at batch creation**, so a later bank-detail change cannot rewrite where the money is shown to have gone. **Never retry a timed-out payout blindly** — the outcome is unknown, idempotency is keyed on `settlement_batch_id` at the provider, and the **status poll**, not the retry, is what resolves it. Three consecutive failures move the batch to `ON_HOLD` and stop retrying | Ticket to Finance **plus an automatic tenant notification** — a gym owner who discovers a missing payout themselves is a retention event. Finance escalates to the banking partner. A bank-detail change immediately before a rejection is the second half of the `TA-6` fraud pattern (`BR-GYM-06` material-field change plus a payout redirect) and goes to the security owner, not to Finance alone |
| **3 — Batch build exceeding its window.** `ALRT-21` (duration overrun) or `ALRT-22` (dead-man: no success in 2× the interval) on `job_name="settlement.build-batches"`; `settlement_batch_build_duration_seconds` past its **10 min Y1 / 100 min 10×** envelope; depth must be 0 by 06:00 and at 10× the job consumes most of the 02:00–06:00 window (`SC-F14`) | Two different incidents wearing one alert: genuinely slow (the `idx_ledger_entries__unbatched` candidate scan degrading, or pool contention), versus **refusing to close** — which is `ck_settlement_batches__sums_to_payable` and the `BR-FIN-03` assertion working correctly | **Distinguish slow from refusing.** A close failure is not a fault: `BR-FIN-03` asserts `opening_balance + Σ(lines) + reserve_released − reserve_held = net_payable` in integer paise with **zero tolerance**, and each component is persisted on the batch, so the disagreement is diagnosable from the row **without re-running the job**. A one-paise difference leaves the batch `OPEN` rather than paying an amount nobody can derive. If it is genuinely slow, check `idx_settlement_lines__eligible` and `idx_ledger_entries__unbatched`. **Under no circumstances introduce a tolerance** — `BAC-07` requires zero variance, and a tolerance is precisely the mechanism by which the system stops being able to tell a rounding artefact from a missing line | `ALRT-21` on a money job pages on-call. A build that slips past 06:00 pushes `settlement.reconcile` behind it, and a late reconcile **hides `ALRT-14`** — so a duration overrun on this job is escalated one level above its apparent severity for that reason alone |

**A fourth signal that is not one of the three, and is the quietest.** `ALRT-22B` (S3) fires when a
tenant's derived balance is negative for **two consecutive settlement cycles**. It usually means
refunds exceeded sales: a gym that has closed (`RSK-06`), or one gaming refunds. Unrecovered, the
platform absorbs it. `M-092` adds the escalation and it deliberately does **not** fire on the first
negative cycle — one bad month is a business, two is a signature. A collapsing check-in trend
alongside rising refunds is the closure pattern, and if closure is suspected the `BR-MEM-14`
member-notification path runs within 24 h.

## Dashboards and queries

_To be populated by **M-090** (batch assembly and the `BR-FIN-03` closure assertion), **M-091**
(`allocate()`, the reserve and the 14-day new-tenant hold), **M-092** (roll-forward and the
negative-balance review trigger), **M-093** (the statement at `SCR-DASH-014`), **M-094** (Finance
approval and dual control), **M-095** (the Razorpay Route payout adapter), **M-096**
(`settlement.reconcile` at 04:00 IST and the per-tenant variance blocker) and **M-097**
(`SCR-ADM-007`, `SCR-ADM-010`, and `E2E-12` at zero variance)._

Intended content, named now so those milestones have a target:

- **Panel — variance, the top row of `D-FINANCE`, always.** Reconciliation variance count with a
  target line at **zero**; the list of tenants with a non-zero variance and each one's auto-payout
  block status; days since the last non-zero variance. `KPI-26`, `BAC-07`, `BR-FIN-07`.
- **Panel — batches and payouts.** `settlement_batches_total` by `§C4.7` status;
  `settlement_batch_build_duration_seconds` and `settlement_batch_lines_total` against their
  envelopes; `payout_outcomes_total` split `INSTRUCTED` / `SUCCEEDED` / `REJECTED` / `RETURNED`;
  batches pending approval **including those above the `BR-FIN-08` dual-approval threshold**.
- **Panel — held lines.** `settlement_held_lines_current` by `reason` ∈ {`FEE_NOT_REPORTED`,
  `VARIANCE_BLOCK`, `RESERVE`, `NEW_TENANT_HOLD`}. A held line is a **first-class state, not a
  workaround**: `BR-FIN-06` records a gateway fee as reported and never estimates one, so
  `gateway_fee_minor` being nullable is what makes *"not yet reported"* representable instead of
  guessable, and this panel is where that nullability becomes visible.
- **Query — scope and magnitude.** `reconciliation_variances` (§9.4: `settlement_reconciliation`)
  for the last seven days where the variance is non-zero, ordered by `abs(delta_minor)` descending,
  carrying `expected_minor`, `reported_minor` and the run's `entries_compared`. Step 1 of the six.
- **Query — line-level diff for one tenant and one day.** A `FULL OUTER JOIN` on the provider payment
  id classifying every row as `GATEWAY_ONLY` (a capture we never recorded), `LEDGER_ONLY` (something
  we recorded that the gateway did not settle) or `AMOUNT_DIFF` (a fee or tax computation
  difference). Step 4, and the one that names the cause.
- **Query — the `BR-FIN-03` identity, checked after the fact.** Each component read off
  `settlement_batches` and re-summed, so a refused close is explained from the persisted row rather
  than by re-running a P0 job at 03:00.
- **Query — payout attempt history for a batch.** Every `payout_attempts` row in `attempt_no` order
  with `failure_code`, `failure_message` and both timestamps. Append-only by grant, so this is the
  complete record and not the latest state.
- **Query — dual-approval audit.** Batches above threshold with `approver_1_id`, `approver_2_id`,
  both timestamps and the MFA assertion id from the audit row. The `CHECK` already forbids the same
  id twice (`BR-FIN-08-N1`); this query is how a periodic control review evidences that it held.
- **Data recovery note.** A wrong batch is **never edited**. It is closed, paid or cancelled per
  `§C4.7`, and the correction appears as adjustment lines in the **next** batch with the opening
  balance carrying the difference. Rebuilding is always safe because a batch holds no fact that does
  not exist in `ledger_entries` — but `settlement_lines` is G-APPEND, so a rebuild is a new batch and
  never an overwrite. Releasing a `BR-FIN-07` block is **explicit, by a named Finance actor, recorded
  in `audit_log`**: the block never lifts automatically, because "the number changed" is not the same
  as "we understand why". One clean cycle proves the correction; two prove the cause.

## Known incidents

_None yet._
