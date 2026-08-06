# refunds runbook

> **Status: stub.** `NFR-MNT-09` requires a runbook per module covering its top three failure modes.
> The three below are fixed by `PROJECT_CONSTITUTION.md` §18.5.1. The eight-field per-mode structure
> of `Monitoring.md` §9.1 — symptom, alert, blast radius, diagnose, mitigate, fix, verify, prevent —
> is filled in by the milestones named under **Dashboards and queries**; `RB2` requires every query
> here to have been **run**, and none can be before the tables exist.
>
> Owner **Finance** · primary alerts `ALRT-39`, `ALRT-18` (`Monitoring.md` §9.6).
>
> **Filename conflict, unresolved.** `Monitoring.md` §9.6 names this module's runbook `disputes.md`;
> `FolderStructure.md` §8.3 row 9 requires `/docs/runbooks/<module>.md`, twenty-three files with no
> exceptions. This file follows `FolderStructure.md` so the module `README.md` link resolves, and
> `disputes.md` — if it survives the decision — becomes the topic runbook for failure mode 3. One
> owner decision settles it for all twenty-three modules (`DECISION_LOG.md`, `CLAUDE.md` §9.3).
>
> **An alerting gap, recorded because §9.1 requires the honest statement.** **No `ALRT-nn` in
> `Monitoring.md` §5 is dedicated to refunds.** `ALRT-18` is the duplicate-payment alert and belongs
> to `payments/`; `ALRT-39` is the dispute-deadline alert; `ALRT-21` / `ALRT-22` / `ALRT-23` are the
> generic job, dead-man and dead-letter alerts. Every refund-specific signal below is a dashboard
> metric that `M-103` defines, not an alert that pages. A module whose failure returns the wrong
> amount of money to a member should not be observed only through generics, and that is a finding for
> the milestone, not a gap this file can close.

## Scope

`refunds/` owns the decision to give money back — whether, how much, on whose authority — and owns a
chargeback case from provider intake to outcome. It owns `refunds`, `disputes` and `dispute_evidence`
(the last G-APPEND: evidence submitted before a deadline cannot be revised after it), the `§C4.5`
seven-state machine with **no `REQUESTED → PROCESSING` edge**, and the ten `§C4.8` refund reason
codes. Two properties make the boundary sharp. First, the governing policy is the one **captured on
the order at the moment of sale** and parsed from nowhere else (`BR-REF-02`), so a tenant cannot
shorten its terms after a sale and have the change apply backwards; an absent or unparseable snapshot
**raises** rather than defaulting, because a default here silently invents contractual terms. Second,
ADR-0029: *"`billing/` never decides a refund"* — `billing/` issues the numbered credit note,
`memberships/` marks the membership `REFUNDED`, `ledger/` receives the reversal entries, and all
three do so because this module told them to. Four modules, four owners, one atomic intent.

The table has **no destination column of any kind**, and `PAYMENT_REFUND_PORT`'s signature —
`refund(paymentId, amountMinor, idempotencyKey)` — has **no destination parameter**. Both absences
are asserted structurally, including an OpenAPI assertion that no request or response schema carries
a destination, account, UPI id or card field. A *"refund to a different card because the original
expired"* field added in good faith is exactly the fraud vector `BR-REF-04` closes.

**Idempotency is an index, not a service check.** `uq_refunds__order_id_active` permits at most one
live refund per order, combined with `SUM(approved_amount_minor) <= orders.total_minor` enforced under
`SELECT … FOR UPDATE`. The realistic route to a double refund is not malice but a retry — a support
agent clicking twice, or a failed gateway call retried after it actually succeeded — so `INV-FIN-13`
makes the second call a **no-op returning the original result**, not an error. *Note:*
`BusinessRules.md` `BR-REF-09` writes the predicate as `status IN ('AUTO_APPROVED',
'PENDING_APPROVAL','PROCESSING','COMPLETED')` while the module `README.md` writes it as
`status NOT IN ('REJECTED','FAILED')`; the two differ by `REQUESTED`, and `M-098` must decide whether
a merely-requested refund holds the slot. `BusinessRules.md` governs (`CLAUDE.md` §2).

**Blast radius when this module is down.** Nothing a member can do stops working — sales, check-ins,
memberships and search are untouched — but members who have already asked for money back are left
without an answer, and that is the population least able to wait. `settlements/` is the downstream
casualty: refunds recognised in a period appear as negative lines in the batch being assembled
(`FR-SETL-03`), so refunds that do not complete during a cycle land in the next one and shift the
payable figure a gym has already been shown. Disputes are worse than an outage, because the deadline
is set by the card network and **does not move**.

**Kill switches.** `ops.payments.duplicate-auto-refund` is the only one adjacent to this module, and
it lives in `payments/`: pulled, the 15-minute detector still identifies duplicate captures but
raises a Finance task with an alarm timed to fire **before** `BR-PAY-07`'s one-business-day deadline,
rather than refunding automatically. The rule is not suspended, only its automation — which is the
distinction `FEATURE_FLAGS.md` §6.3 turns on. **There is no flag that suspends a refund obligation,
and there may never be one:** `BR-REF-05`'s reversal arithmetic and `BR-FIN-01` are on the protected
list.

## Top failure modes

| Signal | Likely cause | First action | Escalation |
| :--- | :--- | :--- | :--- |
| **1 — Gateway refund failure.** Refunds ageing in `PROCESSING`; the `refunds.gateway-status-poll` give-up state (`M-100`, every 15 min); `error`-level events for gateway refund failure (`Monitoring.md` §3); `ALRT-13` if `thirdparty_circuit_state{dependency="DEP-01"}` shows the provider degraded platform-wide. The member sees a refund that was promised and has not arrived | The provider rejected it; the original payment is too old for the provider's refund window; the platform's own balance is insufficient for the instruction; or — most often — the call **timed out** and the outcome is genuinely unknown | **Resolve the outcome; do not retry.** A refund that timed out has an unknown state and the poll, not the retry, is what settles it. **For a Route sale, check the transfer reversal separately from the refund** — a successful refund with a failed reversal is a named, alerted state, and treating it as success means the platform refunded the member from its own float while the gym kept its share. `FAILED` retries with backoff and reaches a give-up state that alerts Finance, so a member is never left without an answer by the design; if a refund is silently ageing without reaching that state, the **poller** is the incident | Ticket to Finance; page Finance on-call if the ageing set spans more than one tenant, which points at the provider rather than at a case. An unrecovered transfer reversal is a **money** incident and is paged with engineering, because it lands in the next settlement cycle as a variance |
| **2 — Approval queue backlog.** `gym.refund.auto_approved_pct` (computed from `refunds_total{outcome}`) falling; the `SCR-ADM-008` queue ageing; refunds sitting in `PENDING_APPROVAL` past the `AC-RFND-01.1` one-business-day expectation | Check routing before staffing: `RefundApprovalPolicy` takes four inputs and **no repository**, so a mis-set threshold or usage value routes cases that should auto-approve. Genuine causes are a policy change, a promotion that produced atypical order values, or a closure event feeding the queue in bulk | Confirm the policy inputs before adding people to the queue — a routing defect looks exactly like a staffing shortfall on the dashboard and is fixed in minutes rather than days. **A backlogged approval queue converts into chargebacks**, which cost the platform the dispute fee on top of the refund and degrade `KPI-21`, so the backlog is more expensive than the refunds it is holding. Member-facing copy must say **"routed for review"**, never "rejected" | Ticket to Finance for the queue, Backend Lead (refunds) for the policy inputs. A Gym Owner holds no approval permission and the `403` is asserted by test (`M-100` AC 9) — a request to "let the gym clear its own queue" is a permission change, not an operational mitigation |
| **3 — Dispute evidence deadline missed.** **`ALRT-39`** (S2) — `dispute_deadline_hours_remaining_min < 48`, evaluated hourly, the **minimum** across all open disputes; the `dispute-no-pack-under-24h` alert; `gym.dispute.open.count` rising without matching submissions | The pack was never assembled, or a component of it could not be gathered. `M-102` assembles **on case creation, not on demand** — a case created at 03:00 has a complete pack at 03:01 — and that is not an optimisation: the pack needs every attendance row, `attendance` is monthly-partitioned with a retention sweep, and a late assembly may find them purged (open item `O-5`) | Confirm the pack exists **and is complete**. A component that could not be assembled is **named** in `missing_reason`; the pack is never silently short. Submission is refused after the deadline (`410`) and after resolution (`409`), so **there is no late path** — the only mitigation is upstream, in assembling at case creation, and the only action available inside the window is to submit what exists. A missed deadline is an automatic loss: the money goes, plus the dispute fee, and `KPI-21`'s ≤0.5% degrades | Ticket to Finance; **under 24 h remaining pages Finance on-call**. `BR-REF-08` has already excluded the disputed amount from batch construction from case opening, so no payout decision is waiting on this — a favourable resolution returns the amount to the next batch |

**Four processors run here and none is a `§C5` job.** `refunds.gateway-status-poll` (`M-100`, every
15 min), `evidence-pack-assemble` (`M-102`, on case creation), `dispute-deadline-watch` (`M-102`,
hourly, escalating at T−48 h / T−24 h / T−6 h once each) and `closure-bulk-run` (`M-101`,
event-triggered, resumable, idempotent per membership for `BR-REF-07` mass pro-rata refunds on gym
closure). **None has a `§C5` row, a queue assignment, a priority class, a lock-key grammar or a
duration envelope**, which means none is covered by `ALRT-21` or `ALRT-22` — the dead-man alert that
would tell an operator the poller stopped does not exist. They need `§C5` rows and
`Scalability.md` §8.3 entries, or a recorded exemption, before `M-100` and `M-102` ship.

**One adjacent alert that arrives here and belongs to `payments/`.** `ALRT-18` fires on duplicate
captures; `BR-PAY-07` requires each non-earliest `CAPTURED` payment to be refunded through the
**standard** use case with reason `DUPLICATE_PAYMENT`, so commission reversal and the credit note
happen correctly. A bespoke fast path would skip both. `{resolution="MANUAL_REVIEW"}` is the
higher-severity variant and means idempotency did **not** contain it.

## Dashboards and queries

_To be populated by **M-098** (`refunds`, the order-snapshot policy, the ten `§C4.8` reason codes and
the 7-day floor), **M-099** (auto-approve or route, and the pro-rata figure shown before
confirmation), **M-100** (the `§C4.5` machine, three origins, idempotency on the order,
original-instrument execution), **M-101** (the credit note and proportional commission reversal at
the original rounding), **M-102** (chargeback intake, the hold from case opening, the self-assembling
evidence pack) and **M-103** (`SCR-DASH-015`, `SCR-ADM-008`, `SCR-ADM-009`, the member flow, and
`E2E-07` / `E2E-08`)._

Intended content, named now so those milestones have a target:

- **Panel — refunds and disputes on `D-FINANCE`.** Refund rate against **`KPI-20` ≤ 3% by value, not
  count** — `refund_amount_minor_total` over GMV, because the count alone cannot compute a value
  ratio; dispute rate against **`KPI-21` ≤ 0.5%**; open disputes with **deadline countdowns**; and
  chargeback outcomes. The dispute table is a **database** panel, not a metrics panel — `tenant_id`
  was removed from `gym.dispute.open.count` under correction **C-2**, so the tenant is named by a
  query and not by a label.
- **Panel — the `§C4.5` funnel.** Refunds by state with age in state, split by the three origins of
  `FR-RFND-01` (member, gym staff, platform staff), and `refund_amount_minor_total` by `reason_code`
  across the ten `§C4.8` values. A reason distribution that collapses onto one code is a product
  signal, not an ops alert.
- **Panel — auto-approval health.** `gym.refund.auto_approved_pct` with the `PENDING_APPROVAL` queue
  depth and oldest-item age beside it, and the `AC-RFND-01.1` one-business-day line drawn. The two
  series read together are what distinguishes a routing defect from a staffing shortfall.
- **Query — refunds ageing in `PROCESSING`.** Ordered by age with the gateway reference and the last
  poll timestamp, which is the manual work queue failure mode 1 escalates into. `LIMIT`-bounded and
  read-only (`RB6`); it must never `SELECT *`, because `reason_text` is member-written free text.
- **Query — refund without a matching reversal.** `COMPLETED` refunds whose `refund_id` has no
  `COMMISSION_REVERSAL` entry in `ledger_entries`. This is the settlement-side consequence of failure
  mode 1 seen a day early, and it is the pair to `ledger.md`'s orphan-reversal query.
- **Query — Route refund versus transfer reversal.** Completed refunds on Route sales where the
  transfer reversal is not confirmed. Named separately from the query above because it is the
  specific state in which the member is whole, the gym is whole, and the platform paid for both.
- **Query — open disputes by deadline.** `dispute_id`, `deadline_at`, evidence-pack status and
  `missing_reason`, ordered ascending. `ALRT-39` names the first half of this; the pack status is
  what makes it actionable rather than merely alarming.
- **Query — the idempotency invariant, checked directly.** Orders carrying more than one live refund
  under the `BR-REF-09` predicate. The partial unique index means the result set should be
  **empty by construction**; a row is not a backlog, it is evidence the index is missing.
- **Data recovery note.** Nothing in this module is repaired by editing. `disputes.outcome` is
  **immutable once set** and `dispute_evidence` is G-APPEND, so a wrong submission is superseded, not
  corrected. `BR-REF-08`'s hold is not a column but a `CHARGEBACK`-typed **ledger entry** referencing
  the dispute — `BR-FIN-01` forbids a mutable balance anywhere, including one called
  `tenants.held_amount` — so releasing a hold is a compensating `CHARGEBACK_REVERSAL`, never a
  deletion. An over-refund is corrected the same way: a compensating entry plus a credit-note
  correction in `billing/`'s own gapless sequence, never a second refund netted against the first.

## Known incidents

_None yet._
