# Implementation Roadmap — Milestones M-091 … M-120

**Document type:** Delivery roadmap (build order) · **Status:** Baseline for Sprints 11 (tail) – 18
**Owner:** Principal Engineer / Delivery Lead · **Approver:** Technical Lead (`C9.3`)
**Covers:** Sprint 11 completion (2027-02-08 → 2027-02-19) · Sprint 12 (2027-02-22 → 2027-03-05) ·
Sprint 13 (2027-03-08 → 2027-03-19) · Sprint 14 (2027-03-22 → 2027-04-02) · Sprint 15
(2027-04-05 → 2027-04-16) · Sprint 16 (2027-04-19 → 2027-04-30) · Sprint 17 (2027-05-03 →
2027-05-14) · Sprint 18 (2027-05-17 → 2027-05-28)
**Band:** M-091 … M-120 — **the last band** · **Continues from:** `Milestones_060-089.md` ·
**Continues in:** nothing. `M-120` is the end of Phase 1.
**Launch market:** **India** (`LAUNCH_MARKET_INDIA.md`) — INR/paise as `bigint`, `Asia/Kolkata`
**+05:30 with no DST**, GST 18% as CGST 9% + SGST 9%, FY 1 April – 31 March, **Razorpay Route**
behind the `PaymentProvider` port

---

## 0. What this file is

The three preceding bands built a product. This band **finishes the money, proves the product, and
puts it in front of the public.** It contains the only milestones in the roadmap whose acceptance
criteria are commercial rather than technical, and it ends on `M-120`, whose acceptance criteria are
the fifteen `BAC-` rows — because that list, and not a green pipeline, is what "done" means to the
client sponsor.

| This file decides | This file defers to |
| :--- | :--- |
| Build order, branch granularity, per-milestone acceptance and rollback | `SprintPlanning.md` Sprints 11–18 for goals, capacity and exit checklists — **restated, never changed** |
| Which exact files a branch touches | `FolderStructure.md` — every path below is quoted from it; §7 for the twenty-three modules, §5/§6 for the two SPAs |
| Which table, policy and grant land together | `Schema.md` §2.6/§2.7 and `MigrationStrategy.md` MG10, P9, CI-01, CI-02 |
| Which tests are written in which branch | `TestingStrategy.md` §2.1 file map, §4 layer definitions, §5 the isolation suite |
| Nothing about Definition of Ready or Definition of Done | `PROJECT_CONSTITUTION.md` §23 — **cited, never restated as a variant** |
| Nothing about what launch *means* commercially | `MASTER_PRD.md` `§C9.4` and the `BAC-01` … `BAC-15` list — reproduced verbatim in `M-120`, never paraphrased |

**No application code exists.** Every fenced block in this document is labelled
`illustrative — not committed code` and is a shape sketch for a reviewer, never a patch.

### 0.1 The nine standing rules, carried forward unchanged

Identical to `Milestones_060-089.md` §0.1. Restated in one line each so that this file is readable
alone; the authoritative wording is in the preceding band.

| # | Rule |
| :-: | :--- |
| **R-1** | 2 to 6 hours for one engineer. Larger is split at refinement. |
| **R-2** | The repository is green on merge — build, lint, every wired gate. |
| **R-3** | Independently revertible: a flag, a `git revert`, or a named expand/contract phase. |
| **R-4** | Buildable strictly in ascending id order; every `Depends on` cites a **lower** id. |
| **R-5** | A milestone that adds an endpoint adds its isolation coverage **in the same milestone** (`BAC-10`, `E2E-11`, `NFR-SEC-09`, DoD #16). |
| **R-6** | A milestone that adds a tenant-owned table adds its RLS policy **and** its grants in the same migration (`MG10`, `P9`, `CI-01`, `CI-02`). |
| **R-7** | A milestone that adds a table extends `prisma/seed/` and bumps `SEED_VERSION`. |
| **R-8** | Money is integer minor units end to end; `round_half_even` once; `bigint` paise serialised as **strings** (`TR-38`, `T-15.35`). |
| **R-9** | Every time computation takes an explicit IANA zone argument. No bare `new Date()`; no whole-hour UTC cron for a local-time job (`TR-24`). |

Two rules become **load-bearing for the first time** in this band and are therefore promoted here:

| # | Rule | Why it appears now |
| :-: | :--- | :--- |
| **R-10** | **`reporting/` has no write path.** `dependency-cruiser` rule `reporting-is-read-only` forbids importing any repository write method or domain command handler. | M-104 gives one module read access to almost every table in the product (`FolderStructure.md` §14 row 18). A single write turns a broad read allowance into a broad write allowance. |
| **R-11** | **A refund reverses at the original rounding, never at today's rate.** Every reversal calls the same `A6.3` function with the **persisted** original figures as its input. | M-101. `BR-REF-05` is the single most likely place for `TR-05` to reappear after `E2E-12` has already gone green once. |

### 0.2 Inbound dependencies — what M-061 … M-090 delivered that this band consumes

| Id | What it delivered that this file consumes |
| :--- | :--- |
| **M-063** | The tenant-timezone scheduling primitive — every job in this band that fires at a local hour uses it (R-9) |
| **M-069** | `attendance` monthly-partitioned and append-only — read by refund eligibility (M-099) and by the dispute evidence pack (M-102) |
| **M-070** | Membership state and the `C4.1` machine — the `→ REFUNDED` terminal edge M-101 drives |
| **M-083 / M-085** | `reviews`, moderation and aggregation — the `review-summary` and `review-integrity` reports (M-106, M-107) |
| **M-086** | Coupon completion, both `funding_source` values — the commission-base split every settlement and reversal figure depends on |
| **M-087** | **`ledger_entries` append-only by grant** — twelve entry types, no `UPDATE`/`DELETE` privilege in any environment |
| **M-088** | The **eight `A6.3` figures** persisted per transaction, never recomputed at display |
| **M-089** | Commission with the rate **frozen at sale**, plus `commission_tax_minor` and the `COMMISSION_TAX` entry type |
| **M-090** | `settlement_batches`, the `C4.7` eight-state machine, the **`BR-FIN-03` closure assertion**, `UNIQUE (tenant_id, period_start, period_end)`, and `rel.settlements.auto-payout` registered **off** |

Shared-kernel ids from `Milestones_000-029.md` are cited directly: **M-010** the Prisma
tenant-context client extension (ADR-0005), **M-013** `audit_log` and the `@Audited()` interceptor,
**M-014** `runElevated()`, **M-015** the cross-tenant isolation suite, **M-016** `Money` and the
`Clock` port, **M-017** `idempotency_keys`, **M-018** the transactional outbox and BullMQ harness,
**M-021** the four notification channel **ports** with their Mailpit and CI-stub adapters, **M-023**
the `B3.2` permission matrix and `PermissionsGuard`.

### 0.3 Six reconciliations recorded before the list

| # | Tension | Ruling |
| :--- | :--- | :--- |
| **R-M11** | The band brief describes this file as *"Sprint 13 through Sprint 18"*, but `SprintPlanning.md` places all of `EP-15` in **Sprint 11** and all of `EP-16` in **Sprint 12**. | **`SprintPlanning.md` wins** — it is the authority for sprint boundaries and its exit checklists are contractual. M-091 … M-097 carry **Sprint 11**, M-098 … M-103 carry **Sprint 12**. The band therefore spans the Sprint-11 tail through Sprint 18. Nothing about the ordering, the content or the gates changes; only the sprint label on seven rows. |
| **R-M12** | `SprintPlanning.md` sprint 13 says a *"10-report platform catalogue"*; `MASTER_PRD.md` `B5.20` enumerates **eleven** rows, and `Epic_18.md` `F-18.7` records the correction against `OQ-18.a`. | **Eleven.** M-107 builds eleven report keys. The eleventh is **`verification-sla`**, which `SprintPlanning.md` omitted from its count but which `FR-ADMN-11` and `KPI-03` both require. `T-18.39` already carries the `DECISION_LOG.md` entry; M-107 writes it. |
| **R-M13** | `T-15.16` (batch assembly, delivered in M-090) declares a dependency on `T-15.18` (`allocate()`), which this band delivers in M-091. A dependency cannot point forward. | M-090 assembled batches with `reserve_held_minor`, `reserve_released_minor` and the opening balance **structurally present and zero**, and its closure assertion already reads all three. M-091 makes them non-zero. The assertion is re-run against non-zero components in M-091's own integration test — the ordering is legitimate precisely because the assertion was written first. |
| **R-M14** | `EP-19` `T-19.05`/`T-19.06` are marked **↰ Sprint 5** — `orders.renewal_sequence`, `commission_rate_bps` and `commission_rule_id` must exist on the order at sale, and `BR-FIN-05` forbids backfilling them in Sprint 15. | Already honoured: M-088 and M-089 persisted all three columns in Sprint 11. M-114 therefore builds **only the resolver and its administration**, never the columns. `CR-03` is recorded as closed by M-114, not opened by it. |
| **R-M15** | `D-02` (referrals and wallet) is **TAKEN at S14**, and `D-10` (scheduled report email) is **TAKEN at S13**. Both appear in `Epic_18.md` and `Epic_20.md` task lists. | The taken items are **not** milestones. M-108 registers `rel.reporting.scheduled-delivery` and ships the job **off** because the job is 1.5 ed and its absence would leave `FR-RPT-04` structurally unreachable; referrals and wallet get **no code at all**, only M-113's absence assertions (`T-20.21`). §9.2 records where each went. |
| **R-M16** | Sprints 16, 17 and 18 hold **8.5 / 17.5 / 27.5 ed of deliberately unfilled reserve** for pen-test remediation, defect fixes and hypercare. A roadmap cannot pre-plan a defect. | M-118, M-119 and M-120 are **gate milestones**: each builds the harness, runs the measurement and defines the pass condition. The remediation the gate provokes is tracked as **defects against the `C8.5` severity ladder**, drawn from the reserve, and is deliberately absent from this list. Filling those reserves with milestones is forbidden (`SprintPlanning.md` §23.3). |

### 0.4 How the band is shaped

| Group | Milestones | Sprint | Exit gate it makes true |
| :--- | :--- | :-: | :--- |
| **G-L′ · Settlement completion** | M-091 … M-097 | 11 | ***`E2E-12` passes with zero variance*** (`C9.1`, `BAC-07`) |
| **G-M · Refunds and disputes** | M-098 … M-103 | 12 | ***`E2E-07` and `E2E-08` pass*** (`BAC-08`) |
| **G-N · Reporting and exports** | M-104 … M-108 | 13 | ***"Report catalogue complete"*** (`BAC-12`) |
| **G-O · Notifications and support** | M-109 … M-113 | 14 | ***"Notification catalogue delivered"*** |
| **G-P · Admin, config, audit** | M-114 … M-117 | 15 | ***"Admin console complete"*** — **M5 feature-complete** (`BAC-13`) |
| **G-Q · Hardening** | M-118 | 16 | ***"All NFR targets met"*** — **M6** (`BAC-11`) |
| **G-R · UAT** | M-119 | 17 | ***"UAT exit criteria met"*** — **M7** (`BAC-14`, `BAC-15`) |
| **G-S · Launch** | M-120 | 18 | ***`BAC-01` … `BAC-15` satisfied*** — **M8** |

---

## 1. Sprint 11 completion — settlements, reserve, payout, reconciliation · `EP-15`

`M-090` left a batch that assembles, refuses to close on a one-paise disagreement, and cannot pay
anybody. The seven milestones below give it an allocation order, a reserve, an approver, a bank, a
daily reconciliation, and a statement a gym owner can read aloud.

### M-091 — `allocate()` — the ordered `TR-26` function, the reserve, the 14-day new-tenant hold

| Field | Value |
| :--- | :--- |
| **Sprint** | 11 |
| **Epic** | EP-15 · F-15.15, F-15.18 · T-15.18, T-15.19, T-15.20 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Money leaving a batch is allocated in **one** documented order — current cycle, then
reserve, then negative balance — and the reserve is a pair of visible ledger lines with a stated
release date, not a number subtracted somewhere.

**Depends on** — M-087, M-088, M-090.

**Unblocks** — M-092, M-093, M-097, M-101, M-103.

**Files**

- `apps/server/src/settlements/domain/allocate.ts` · `.spec.ts` — the ordered `TR-26` allocation: current cycle → reserve → negative balance; a release **nets against** an outstanding negative before it pays out; the reserve is bounded by its configured rate; **no negative payout is representable**; a write-off is a human act and has no code path.
- `apps/server/src/settlements/domain/reserve-policy.vo.ts` · `.spec.ts` — rate in bps, maturity in days (`OQ-04` default 5% at 30 days), the `A6.4` new-tenant 14-day hold from first trade.
- `apps/server/src/settlements/application/use-cases/withhold-reserve.use-case.ts` · `.int-spec.ts` — writes a `RESERVE_HOLD` ledger entry **and** a batch line in the same transaction as batch closure.
- `apps/server/src/settlements/jobs/reserve-release.processor.ts` · `.spec.ts` — daily, at the tenant's local hour through the M-063 primitive; releases matured holds as `RESERVE_RELEASE`; **idempotent per hold id**.
- `apps/server/src/settlements/application/queries/reserve-schedule.query.ts` — the held amount, the reason string, and the **scheduled release date** for `AC-SETL-01.3`.
- `prisma/migrations/<ts>_add_settlement_reserve_config/migration.sql` — header `phase: expand · rls: existing policy unchanged · grants: unchanged`. Adds `tenants.reserve_rate_bps`, `tenants.reserve_maturity_days`, `tenants.first_trade_at`; no new table, therefore no new policy.
- `prisma/seed/settlements.seed.ts` — a tenant inside the 14-day hold, a tenant with a matured hold, a tenant with an exhausted reserve; `SEED_VERSION` bumped (R-7).
- `docs/runbooks/reserve-release-stalled.md`

**Acceptance criteria**

1. `allocate()` applies exactly one order — current cycle, reserve, negative balance — and the order is asserted by a test that would fail if two steps were swapped (`TR-26`, `F-15.18`).
2. A reserve release **nets against** an outstanding negative balance before any payout is computed; a tenant with −₹4,000 carried forward and a ₹3,000 release pays out **nothing** and carries −₹1,000 (`TR-26` Q3).
3. The reserve appears on the statement as **two** lines — the hold in its own cycle and the release in the maturing cycle — each carrying the amount, the reason and the scheduled release date (`FR-SETL-04`, `AC-SETL-01.3`).
4. Reserve is withheld on **`payable_minor`**, closing `OQ-EP15.a` as adopted; the figure is persisted on the batch so the choice is inspectable from the row.
5. A tenant within 14 days of `first_trade_at` is **suppressed from cycle eligibility**, and the suppression carries a reason string and an end date the tenant can see (`A6.4`, `F-15.15`).
6. `reserve.release` is idempotent per hold id: re-running the job on the same day releases nothing a second time, proven by a test that invokes the processor twice.
7. Every allocation output re-satisfies the M-090 closure assertion with **non-zero** `reserve_held_minor` and `reserve_released_minor` — this is the assertion's first real exercise (R-M13).
8. No path exists by which `allocate()` returns a negative payable; the type is constructed through `Money.nonNegative()` and the negative case raises rather than clamping.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `allocate.spec.ts` | Unit | The three-step order; swap detection; release-nets-against-negative; bounded reserve; no negative payout |
| `reserve-policy.vo.spec.ts` | Unit | 5% at 30 days; the 14-day hold from `first_trade_at`; bps arithmetic in integers |
| `withhold-reserve.use-case.int-spec.ts` | Integration | `RESERVE_HOLD` entry and batch line in one transaction; rollback leaves neither |
| `reserve-release.processor.spec.ts` | Unit | Local-hour scheduling; double invocation releases once |
| `closure-assertion-with-reserve.int-spec.ts` | Integration | M-090's assertion holds with non-zero hold and release components |
| `new-tenant-hold.int-spec.ts` | Integration | Day 13 suppressed with a reason and an end date; day 14 eligible |

**Rollback plan** — Expand-phase; the migration adds nullable columns with defaults and is
backward-compatible. `rel.settlements.auto-payout` is still **off**, so no money has moved. `git
revert` restores the M-090 behaviour where hold and release are zero, and the closure assertion still
passes because zero is a valid component. Reserve entries already written are ledger rows and are
retained.

**Notes** — The trap is treating a release as a payout. A release is a **movement between two
buckets the platform already holds**; if it is paid out without first netting against a negative
balance, the platform funds a shortfall it was owed. That mistake nets to zero in every happy-path
test and only appears for a tenant who has both a matured reserve and a negative balance — which is
exactly the tenant who has been refunding.

---

### M-092 — Minimum-payout roll-forward, negative-balance carry-forward, the review trigger

| Field | Value |
| :--- | :--- |
| **Sprint** | 11 |
| **Epic** | EP-15 · F-15.18 · T-15.22, T-15.23 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — A batch too small to pay, and a batch that owes the platform money, both resolve into an
explicit, tenant-visible line in the **next** cycle instead of into silence.

**Depends on** — M-090, M-091.

**Unblocks** — M-097, M-103.

**Files**

- `apps/server/src/settlements/domain/minimum-payout.policy.ts` · `.spec.ts` — the floor, the balance, and the shortfall persisted as the batch's **stated reason**, not derived at render time.
- `apps/server/src/settlements/domain/opening-balance-line.ts` · `.spec.ts` — a negative closing balance materialises as an explicit `OPENING_BALANCE` line at the head of the next batch (`AC-SETL-01.4`).
- `apps/server/src/settlements/jobs/negative-balance-review.processor.ts` · `.spec.ts` — daily; a **second consecutive** negative cycle raises the `RSK-06` checklist to Finance through the outbox.
- `prisma/migrations/<ts>_add_batch_rollforward_reason/migration.sql` — header `phase: expand · rls: existing policy unchanged · grants: restricted UPDATE extended to rollforward_reason only`. Adds `settlement_batches.rollforward_reason jsonb`, `settlement_batches.closing_balance_minor bigint`.
- `apps/server/src/settlements/controllers/tenant-settlements.controller.ts` (modified) · `.int-spec.ts` · `.isolation-spec.ts` — the roll-forward reason exposed on the existing batch resource; **no new endpoint**, so the existing isolation spec is extended rather than duplicated (R-5).
- `infra/monitoring/alerts/settlement-negative-balance.yaml` · `docs/runbooks/persistent-negative-balance.md`

**Acceptance criteria**

1. A batch below the minimum payout **rolls forward** with the floor, the balance and the shortfall persisted on the row, and the tenant sees all three (`FR-SETL-05`).
2. A negative closing balance is recovered as an explicit `OPENING_BALANCE` line at the head of the next batch — never as a silent reduction of gross (`FR-SETL-10`, `AC-SETL-01.4`, `E11.7`).
3. A **second consecutive** negative cycle emits a `TenantNegativeBalanceEscalated` outbox event carrying the `RSK-06` checklist; a first negative cycle does not (`FR-SETL-10`).
4. `gym.settlement.negative_balance_tenants` is emitted and alerted on; the runbook is linked from the alert.
5. The roll-forward reason is a **structured** document — `{ floorMinor, balanceMinor, shortfallMinor, currency }` — not a rendered sentence, so the statement and the API cannot disagree about it.
6. Roll-forward and carry-forward both re-satisfy the closure assertion; a rolled-forward batch closes at `net_payable_minor = 0` rather than failing to close.
7. The restricted `UPDATE` grant is extended to `rollforward_reason` **only**; `append-only-grants` re-asserts that no money column became writable.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `minimum-payout.policy.spec.ts` | Unit | Below floor rolls forward; at floor pays; the three persisted figures |
| `opening-balance-line.spec.ts` | Unit | Negative closing becomes a positive-signed recovery line at the head of the next batch |
| `negative-balance-review.processor.spec.ts` | Unit | First negative silent; second escalates once; third does not re-escalate |
| `rollforward-grants.int-spec.ts` | Integration | Column-level `UPDATE` boundary unchanged for money columns |
| `tenant-settlements.controller.isolation-spec.ts` | Isolation (`IS3`) | Extended: cross-tenant read of the roll-forward reason |

**Rollback plan** — Expand-phase, additive nullable columns. `git revert` returns batches to
paying-or-not with no stated reason; batches already carrying a `rollforward_reason` keep it as inert
data. No ledger entry is written by this milestone, so there is nothing financial to undo.

**Notes** — The trap is the word "carry-forward" sounding like an accounting nicety. It is the only
mechanism by which the platform recovers money a gym owes it after a refund on an already-paid-out
sale, and if it is implemented as a reduction of the next batch's gross rather than as its own line,
the gym owner will read a statement whose gross does not match their own sales records — and will be
right to dispute it.

### M-093 — The statement — `SCR-DASH-014`, where the arithmetic **visibly** sums to the payout

| Field | Value |
| :--- | :--- |
| **Sprint** | 11 |
| **Epic** | EP-15 · F-15.22, F-15.25 · T-15.34, T-15.35, T-15.36, T-15.37, T-15.47 |
| **Size** | 6h |
| **Role** | Full-stack |

**Goal** — A gym owner opens one screen, reads it top to bottom, and arrives at the number that
reached their bank — with every intermediate figure shown and a running total they can follow with a
finger.

**Depends on** — M-060, M-088, M-090, M-091, M-092.

**Unblocks** — M-097, M-106, M-119.

**Files**

- `apps/server/src/billing/infrastructure/renderers/settlement-statement.template.tsx` — the deterministic Chromium template from M-060; **no new renderer**, one more template.
- `apps/server/src/settlements/application/use-cases/generate-statement.use-case.ts` · `.int-spec.ts` — PDF and CSV, `renderer_digest` written to the batch, byte-identical regeneration asserted.
- `apps/server/src/settlements/dto/settlement-batch.response.dto.ts` · `settlement-line.response.dto.ts` · `settlement.openapi.ts` — every paise figure serialised as a **string** with an adjacent `currency` field (`TR-38`, `T-15.35`).
- `apps/server/src/settlements/controllers/tenant-settlements.controller.ts` (modified) · `.int-spec.ts` · `.isolation-spec.ts` — `GET /v1/tenant/settlements`, `GET /v1/tenant/settlements/:id`, `GET /v1/tenant/settlements/:id/statement`.
- `apps/gym-dashboard/src/routes/settlements.route.tsx` — `SCR-DASH-014`.
- `apps/gym-dashboard/src/features/settlements/` — `batch-list.table.tsx`, `batch-detail.panel.tsx`, `running-total.tsx`, `statement-download.button.tsx`, `api/settlements.queries.ts`, plus `empty.tsx`, `loading.tsx`, `error.tsx`, `permission-denied.tsx`.
- `packages/ui/src/money/MoneyCell.tsx` · `.spec.tsx` — right-aligned, tabular-figure, screen-reader-labelled **with the currency word**, never a bare number.
- `apps/gym-dashboard/tests/a11y/settlements.axe-spec.ts`
- `docs/ui/SCR-DASH-014.md`

**Acceptance criteria**

1. The detail view lists **every** transaction with all **nine** persisted figures — gross, discount, net, tax, commission base, commission, `commission_tax_minor`, gateway fee, payable — and none of them is recomputed in the browser (`FR-SETL-02`, `BR-FIN-02`).
2. A **running total column** carries the reader from the opening balance to `net_payable_minor`, and the last cell of that column **equals the payout amount** (`AC-SETL-01.1`, `E11.1`).
3. A refund in the period appears as a **negative line referencing the original sale** (`AC-SETL-01.2`); a reserve hold and its release each appear with amount, reason and scheduled date (`AC-SETL-01.3`); a recovered negative balance appears as the opening-balance line (`AC-SETL-01.4`).
4. `COMMISSION_TAX` is its own line, labelled as GST on the platform commission, not folded into commission (`E11.6`).
5. Regenerating the statement produces a **byte-identical** file and the same `renderer_digest`; the test compares checksums, not visual similarity (`TR-15`).
6. No JSON number in any settlement response carries paise: a contract test walks the generated OpenAPI document and fails on a `type: number` under any `*_minor` field (`T-15.35`, `TR-38`).
7. CSV export carries human-readable headers, money as a plain number, and a **separate currency column** (`E13.5` — the contract M-108 will generalise).
8. `axe-core` is clean and the whole screen is keyboard-operable; money columns are right-aligned and announce their currency (`NFR-USE-01`, `T-15.47`).
9. Isolation coverage ships here for all three endpoints, **including a cross-tenant statement download by object key** (R-5, `T-15.46`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `generate-statement.use-case.int-spec.ts` | Integration | PDF + CSV produced; digest persisted; byte-identical regeneration |
| `settlement-money-serialisation.contract-spec.ts` | Contract | No `*_minor` field typed as a JSON number anywhere in the OpenAPI document |
| `running-total.spec.tsx` | Unit (FE) | Final running-total cell equals `net_payable_minor` across seeded batches including negatives |
| `batch-detail.panel.spec.tsx` | Unit (FE) | Nine figures rendered; refund line references the original sale; reserve lines carry their dates |
| `tenant-settlements.controller.isolation-spec.ts` | Isolation (`IS3`) | Cross-tenant list, detail and **statement object-key download** all refused |
| `settlements.axe-spec.ts` | a11y | Zero violations; keyboard traversal; currency announced |

**Rollback plan** — Read-only milestone: no migration, no ledger write, no money movement. `git
revert` removes the route and the two endpoints; statements already generated remain in object
storage and remain downloadable through the Finance console once M-097 lands. The `MoneyCell`
component is shared, so a revert must keep it if any other surface has adopted it — the revert
instruction in the PR body names this explicitly.

**Notes** — The trap is a "total" computed in the browser. The moment the running total is a
`reduce()` over rendered rows, the screen can agree with itself while disagreeing with the batch, and
the bug is invisible until a gym owner adds the column up by hand. The running total is **read from
the server's persisted components**; the browser renders it and never derives it. The second trap is
`bigint`: `JSON.parse` silently destroys paise above 2^53, which for a mid-size tenant is about
₹90,000 crore — comfortably out of reach, and exactly the kind of "cannot happen" that makes a team
skip the string serialisation and then discover it in a currency with three decimal places.

---

### M-094 — Finance approval, the auto-payout threshold, and dual control above it

| Field | Value |
| :--- | :--- |
| **Sprint** | 11 |
| **Epic** | EP-15 · F-15.20 · T-15.06, T-15.25 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — A payout above the dual-approval threshold cannot be released by one person, and the
database — not the service — is what makes that true.

**Depends on** — M-023, M-090, M-093.

**Unblocks** — M-095, M-097.

**Files**

- `apps/server/src/settlements/domain/approval-policy.ts` · `.spec.ts` — three outcomes: auto-approved below the tenant threshold with `rel.settlements.auto-payout` **on**; single approval; dual approval above the `BR-FIN-08` threshold.
- `apps/server/src/settlements/application/use-cases/approve-batch.use-case.ts` · `.int-spec.ts` — the second approval is a **separate authenticated action** under `access(mfa)`, never a second click in one session.
- `apps/server/src/settlements/controllers/admin-settlements.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts` — `GET /v1/admin/settlements`, `POST /v1/admin/settlements/:id/approve`; platform-scoped, `runElevated()`-wrapped and audited **before** the work (M-014, `SR-10`).
- `apps/server/src/settlements/permissions.ts` (modified) — `admin.settlement.approve`, `admin.settlement.approve_second`.
- `prisma/migrations/<ts>_enforce_dual_approval/migration.sql` — header `phase: expand · rls: platform-scoped table, existing policy · grants: restricted UPDATE unchanged`. Tightens the M-090 `CHECK` so that `approver_2_id IS DISTINCT FROM approver_1_id`, and adds `approved_1_at`, `approved_2_at`, `dual_required boolean`.
- `docs/FEATURE_FLAGS.md` — `rel.settlements.dual-payout-approval` registered **off**; **off is the more restrictive position** (batches above the threshold hold and escalate rather than paying on one signature).
- `docs/runbooks/settlement-approval-stuck.md`

**Acceptance criteria**

1. A batch above the `BR-FIN-08` threshold **cannot reach an approved state with one approver** — enforced by the `CHECK` constraint, and proven by a test that attempts the update through raw SQL as the application role and observes the constraint violation, not a service-layer refusal.
2. The same human cannot supply both approvals: `approver_2_id IS DISTINCT FROM approver_1_id` is a database constraint, and the second approval requires a **fresh MFA step-up** (`NFR-SEC-11`).
3. Auto-approval applies **only** below the tenant's configured threshold and **only** with `rel.settlements.auto-payout` on for that tenant; with the flag off, every batch of every size waits for a human (`FR-SETL-06`).
4. `rel.settlements.dual-payout-approval` **off** holds above-threshold batches in `PENDING_APPROVAL` and escalates; it can never remove an approval the rule requires (`FEATURE_FLAGS.md` §6.1).
5. Every approval writes an `audit_log` row with actor, batch id, amount, threshold, flag state and MFA assertion id (`BR-DAT-01`, `BAC-13`).
6. A tenant-role token on `/v1/admin/settlements` is **refused**, not scoped down (`SR-10`, `AC-RPT-05.3` shape).
7. Isolation coverage for both admin endpoints ships here, including a tenant token attempting an approval on its own batch (R-5).
8. Approval transitions go through the `C4.7` machine from M-090; no state is set by assignment.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `approval-policy.spec.ts` | Unit | The three outcomes across the threshold grid and both flag positions |
| `dual-approval-constraint.int-spec.ts` | Integration | Raw-SQL single-approver update on an above-threshold batch **violates the constraint** |
| `same-approver-refused.int-spec.ts` | Integration | Identical approver ids refused at the database, not only in the service |
| `approve-batch.use-case.int-spec.ts` | Integration | MFA step-up required for the second approval; audit row shape |
| `admin-settlements.controller.isolation-spec.ts` | Isolation (`IS3`) | Tenant token refused; cross-tenant batch approval refused |
| `NEGATIVE: BR-FIN-08` in `settlement-negative.spec.ts` | Unit + Integration | The `BAC-06` negative case for the dual-approval rule |

**Rollback plan** — Expand-phase. The `CHECK` tightening is the only non-additive element; it is
safe because no above-threshold batch has ever been approved (`rel.settlements.auto-payout` has been
off since M-090 and no payout adapter exists until M-095). Contract phase for the loosened M-090
`CHECK` is this same migration — recorded as an in-place tighten, permitted by `MigrationStrategy.md`
because the stricter predicate is satisfied by every existing row, asserted in the migration's own
pre-check. `git revert` restores the looser constraint; approvals already recorded remain valid.

**Notes** — The trap is enforcing dual control in the service layer and calling it done. A service
check protects the endpoint; it does not protect a support script, a migration, or a future
background job written by someone who has not read `BR-FIN-08`. The constraint is the control; the
service check is the error message. The second trap is `approver_2_id IS NOT NULL` as the test —
that is satisfied by the same person approving twice, which is the exact fraud the rule exists to
prevent.

### M-095 — The Razorpay Route payout adapter, and what a bank rejection does

| Field | Value |
| :--- | :--- |
| **Sprint** | 11 |
| **Epic** | EP-15 · F-15.19 · T-15.26, T-15.27, T-15.28, T-15.48 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — An approved batch becomes an instruction to a real bank, and a rejection by that bank
returns the batch to a human with the bank's own reason attached rather than disappearing into a
failed job.

**Depends on** — M-053, M-054, M-090, M-094.

**Unblocks** — M-096, M-097, M-120.

**Files**

- `apps/server/src/payments/ports/payment-provider.port.ts` (modified) — `payout(instruction): PayoutResult` added to the **existing** port; the Stripe reference adapter implements it so the provider-agnostic contract suite from M-053 keeps passing.
- `apps/server/src/payments/infrastructure/adapters/razorpay-route.payout.adapter.ts` · `.int-spec.ts` — Route transfer to the connected account, `X-Payout-Idempotency` keyed on `settlement_batch_id`, the India-specific failure taxonomy normalised into the port's result type.
- `apps/server/src/payments/infrastructure/adapters/stripe-reference.payout.adapter.ts` — the reference implementation that keeps the port honest (`ADR-0018`).
- `apps/server/src/settlements/application/use-cases/execute-payout.use-case.ts` · `.int-spec.ts` — precondition: **a non-positive amount is refused as a precondition, not a validation** (`T-15.27`).
- `apps/server/src/settlements/application/handlers/payout-result.handler.ts` · `.spec.ts` — `PAID` on confirmation; `FAILED → PENDING_APPROVAL` carrying the bank reason and notifying tenant **and** Finance; `ON_HOLD` on the third consecutive failure.
- `apps/server/src/payments/controllers/webhooks/razorpay.webhook.controller.ts` (modified) · `.int-spec.ts` — `payout.processed`, `payout.reversed`, `payout.failed`; signature-verified; **duplicate-safe on the provider payout id**.
- `prisma/migrations/<ts>_create_payout_attempts/migration.sql` — header `phase: expand · rls: new table, policy in this migration · grants: SELECT, INSERT only — no UPDATE, no DELETE`. `payout_attempts` (`tenant_id`, `settlement_batch_id`, `attempt_no`, `provider`, `provider_payout_id`, `amount_minor`, `status`, `failure_code`, `failure_message`, `requested_at`, `resolved_at`), `UNIQUE (settlement_batch_id, attempt_no)`.
- `infra/terraform/modules/secrets/razorpay-payout.tf` — payout credentials in the managed secret store, **separate from the collection credentials** (`NFR-SEC-07`).
- `infra/monitoring/alerts/settlement-payout-failures.yaml` · `docs/runbooks/payout-failure.md`

**Acceptance criteria**

1. `payout()` is a method on the **existing** `PaymentProvider` port, and the M-053 provider-agnostic contract suite passes unchanged against both the Razorpay Route adapter and the Stripe reference (`REG-01`, `ADR-0018`).
2. A payout instruction with `amount_minor <= 0` is refused as a **precondition** — the adapter is never called, and the refusal is a programming error surfaced loudly rather than a user-facing validation message (`T-15.27`, `TR-26` Q3, `AC-EP15-23`).
3. Payout is **idempotent on the batch**: replaying the instruction, or a duplicate `payout.processed` webhook, produces one `payout_attempts` row transition and one ledger effect (`TR-25`, `TR-04`).
4. A bank rejection moves the batch `FAILED → PENDING_APPROVAL` over the `C4.7` machine, persists the **provider's own failure code and message**, and notifies the tenant and Finance (`FR-SETL-08`, `E11`-series).
5. **Three consecutive** failures move the batch to `ON_HOLD` and stop retrying; a fourth attempt is not scheduled.
6. `payout_attempts` is **append-only by grant** — every attempt is a new row; a retry never overwrites the record of the failure that preceded it. `append-only-grants` asserts the absent privileges.
7. Payout credentials are held separately from collection credentials and are never read into a log, span or error message; a CI check greps the payout path for credential-shaped literals (`NFR-SEC-07`).
8. The RLS policy and grants for `payout_attempts` ship in this migration (R-6), and isolation coverage for the tenant-facing payout-status read ships here (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `payment-provider.contract-spec.ts` | Contract | The port suite passes for Route **and** the Stripe reference, `payout()` included |
| `razorpay-route.payout.adapter.int-spec.ts` | Integration | Sandbox transfer; idempotency header keyed on batch; India failure taxonomy mapped |
| `execute-payout.use-case.int-spec.ts` | Integration | Non-positive amount refused before the adapter is reached |
| `payout-result.handler.spec.ts` | Unit | `PAID`; `FAILED → PENDING_APPROVAL` with the bank reason; `ON_HOLD` on the third failure; no fourth attempt |
| `payout-webhook-duplicate.int-spec.ts` | Integration | Duplicate `payout.processed` produces one transition and one ledger effect |
| `payout-attempts-grants.int-spec.ts` | Integration | No `UPDATE`, no `DELETE` privilege in any environment |

**Rollback plan** — `rel.settlements.auto-payout` remains **off**; every payout in this milestone is
a deliberate human action against the sandbox. The migration is expand-phase and additive. `git
revert` removes the adapter and the use case; `payout_attempts` rows are financial records and are
retained. **A payout already instructed cannot be reverted by code** — it is reversed by Finance
through the provider, and the runbook says so in its first line.

**Notes** — The trap is retry. A payout that times out has an unknown outcome, and a naive retry
pays twice. Idempotency is keyed on `settlement_batch_id` at the provider, `attempt_no` is unique in
our table, and the status poll — not the retry — is what resolves an indeterminate attempt. The
second trap is sharing one Razorpay key between collection and payout: a compromised collection key
should not be able to move money out, and separating them costs one Terraform resource today and is
unrecoverable after launch.

---

### M-096 — `settlement.reconcile` at 04:00 IST, and the **per-tenant** variance blocker

| Field | Value |
| :--- | :--- |
| **Sprint** | 11 |
| **Epic** | EP-15 · F-15.24 · T-15.29, T-15.30, T-15.49 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Every day, the gateway's own settlement report is compared **line by line** against the
ledger, a reconciliation record is written whether or not there is a variance, and a variance stops
auto-payout for **that tenant only**.

**Depends on** — M-018, M-063, M-087, M-090, M-095.

**Unblocks** — M-097, M-107, M-120.

**Files**

- `prisma/migrations/<ts>_create_reconciliation_runs/migration.sql` — header `phase: expand · rls: platform-scoped table, policy in this migration · grants: SELECT, INSERT, restricted UPDATE (resolution_note, resolved_by, resolved_at) only`. `reconciliation_runs` (`run_date`, `provider`, `report_reference`, `entries_compared`, `variance_count`, `variance_total_minor`, `status`) and `reconciliation_variances` (`run_id`, `tenant_id`, `ledger_entry_id`, `provider_row_reference`, `kind`, `expected_minor`, `reported_minor`, `delta_minor`, `resolution_note`, `resolved_by`, `resolved_at`).
- `apps/server/src/settlements/jobs/reconcile.processor.ts` · `.spec.ts` — **04:00 IST** resolved through the M-063 primitive to the correct UTC instant (22:30 UTC the previous day), distributed lock, resumable.
- `apps/server/src/settlements/infrastructure/provider-report.ingestor.ts` · `.int-spec.ts` — ingests the provider settlement report; a malformed or partial report **fails the run** rather than reconciling against half a file.
- `apps/server/src/settlements/infrastructure/reconciliation.repository.ts` · `.int-spec.ts` — the one permitted `$queryRaw` aggregate in `settlements/`, written inside the repository with the comment naming the RLS policy that still applies (`FolderStructure.md` P7).
- `apps/server/src/settlements/domain/variance-classifier.ts` · `.spec.ts` — five kinds: `MISSING_IN_LEDGER`, `MISSING_IN_REPORT`, `AMOUNT_MISMATCH`, `FEE_MISMATCH`, `DATE_BOUNDARY`.
- `apps/server/src/settlements/application/use-cases/block-tenant-auto-payout.use-case.ts` · `.int-spec.ts` — per-tenant block; manual override requires a reason and is audited.
- `infra/monitoring/alerts/settlement-reconciliation-variance.yaml` — `gym.settlement.variance.count`, **only acceptable value 0**.
- `docs/runbooks/reconciliation-variance.md`

**Acceptance criteria**

1. Reconciliation compares the provider report **line by line** against `ledger_entries` and writes a `reconciliation_runs` record **either way** — a clean day produces a row, not silence (`FR-SETL-09`, `BR-FIN-07`).
2. Zero variance against the sandbox report on the seeded period is the expected result and is asserted as a test, not observed as an outcome (`E11.2`, `KPI-26` = 100%).
3. A deliberately corrupted fee figure raises a variance, writes a `reconciliation_variances` row classified as `FEE_MISMATCH`, and **blocks auto-payout for that tenant only** — every other tenant pays out in the same run, proven by a two-tenant test (`E11.3`, `BR-FIN-07-N1`).
4. The block is **lifted only** by a human with a recorded reason, and the override is audited with actor, tenant, variance id and reason (`BR-DAT-01`).
5. The job fires at **04:00 in the tenant-facing IST day**, computed through the M-063 primitive; a fixed UTC cron is rejected in review (R-9, `TR-24`).
6. A malformed or truncated provider report **fails the run** and alerts; it never reconciles against a partial file and never reports zero variance for rows it did not see.
7. The reconciliation aggregate is the only raw SQL in `settlements/`, is inside the repository, and carries the `P7` comment; `dependency-cruiser`'s three-path allow-list is unchanged.
8. RLS and grants ship in this migration (R-6); the restricted `UPDATE` grant covers the three resolution columns only, and `append-only-grants` asserts the money columns are immutable.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `reconcile.processor.spec.ts` | Unit | 04:00 IST → 22:30 UTC previous day; lock; resumability after a mid-run kill |
| `provider-report.ingestor.int-spec.ts` | Integration | Truncated report fails the run; malformed row named, not skipped |
| `variance-classifier.spec.ts` | Unit | All five kinds; a date-boundary difference is not an amount mismatch |
| `zero-variance.int-spec.ts` | Integration | Seeded period reconciles at exactly zero (`E11.2`) |
| `per-tenant-block.int-spec.ts` | Integration | Corrupted fee blocks tenant A; tenant B pays out in the same run (`E11.3`) |
| `reconciliation-grants.int-spec.ts` | Integration | Column-level `UPDATE` boundary on the variance table |

**Rollback plan** — Expand-phase, two new tables, no change to existing rows. The blocker writes to
a tenant flag evaluated at payout time, so a revert of this milestone **unblocks every blocked
tenant** — the PR body states that explicitly and the runbook requires Finance sign-off before a
revert. Reconciliation records are retained as financial evidence.

**Notes** — The trap is a platform-wide block. Blocking every tenant because one tenant's fee report
disagrees converts a data-quality problem into an outage that stops paying gyms who did nothing
wrong; `BR-FIN-07-N1` is explicit that the block is per-tenant, and the two-tenant test is the only
thing that will keep it that way through a hurried fix at 04:30. The second trap is reconciling
against a partial report and reporting zero variance — a run that saw 600 of 800 rows and found no
disagreement has found nothing, and must fail rather than reassure.

### M-097 — `SCR-ADM-007`, `SCR-ADM-010`, and `E2E-12` at **zero** variance

| Field | Value |
| :--- | :--- |
| **Sprint** | 11 |
| **Epic** | EP-15 · F-15.14 · T-15.38, T-15.39, T-15.41, T-15.42, T-15.43, T-15.44, T-15.45 |
| **Size** | 6h |
| **Role** | Full-stack |

**Goal** — Finance can approve, pay, and reconcile from the console — and the sprint's exit gate is
green: a mixed period reconciles to **zero**, not to nearly zero.

**Depends on** — M-091, M-092, M-093, M-094, M-095, M-096.

**Unblocks** — M-103, M-107, M-119, M-120.

**Files**

- `apps/admin-dashboard/src/routes/finance-settlements.route.tsx` — `SCR-ADM-007`.
- `apps/admin-dashboard/src/routes/finance-reconciliation.route.tsx` — `SCR-ADM-010`.
- `apps/admin-dashboard/src/features/finance/settlements/` — `runs-by-cycle.table.tsx`, `dual-approval.dialog.tsx` (the second approver's MFA step-up), `payout-status.strip.tsx`, plus the four state components.
- `apps/admin-dashboard/src/features/finance/reconciliation/` — `daily-comparison.table.tsx`, `variance-drilldown.panel.tsx`, `resolution-note.form.tsx`, `zero-target.trend.tsx`.
- `apps/admin-dashboard/src/shared/reason/require-reason.tsx` (consumed) — the variance override reason.
- `apps/server/test/e2e/e2e-12-settlement-zero-variance.e2e-spec.ts` — the gate.
- `apps/server/test/property/money-allocation.property-spec.ts` — allocation across N lines re-sums exactly; rounding parity across commission, tax, proration and reversal, over randomised amounts and line counts.
- `apps/server/test/int/settlement-concurrency.int-spec.ts` — duplicated build job under a simulated Redis failover; same-approver double approval; payout webhook twice; closure racing a late fee report.
- `apps/server/test/int/ledger-grants-all-envs.int-spec.ts` — the grant assertion executed against local, CI, development, staging and production connection profiles.
- `apps/admin-dashboard/tests/a11y/finance.axe-spec.ts`
- `docs/ui/SCR-ADM-007.md` · `docs/ui/SCR-ADM-010.md`

**Acceptance criteria**

1. **`E2E-12` passes at zero variance** over a period containing an online sale, an offline sale, a **gym-funded** coupon, a **platform-funded** coupon, a refund, a reserve hold and a negative opening balance (`E2E-12`, `BAC-07`, `E11.1`).
2. The variance assertion is **exact equality in integer paise**. No tolerance parameter exists anywhere in the suite; a test that introduces one fails review.
3. `SCR-ADM-007` lists runs by cycle with tenant, batch total and status; the dual-control affordance appears **only** above the threshold and requires the second approver to authenticate (`SCR-ADM-007`, `E11`-series).
4. `SCR-ADM-010` shows the daily comparison, the variance list **drilling down to the disagreeing entries**, the resolution note, and the historical trend against a **zero** target (`SCR-ADM-010`, `KPI-26`).
5. The money property suite proves allocation across N lines re-sums exactly and that commission, tax, proration and reversal round identically, over randomised inputs (`TR-05`, `T-15.41`).
6. The concurrency suite covers all four named races and each has a deterministic outcome (`T-15.45`, `TR-25`, `TR-04`).
7. No `UPDATE` or `DELETE` grant exists on `ledger_entries` in **any** of the five environments, asserted automatically (`E11.4`, `T-15.43`).
8. Negative-case tests exist for all eight `BR-FIN-*` rules plus `BR-REF-05-N1` rate-change-between-sale-and-refund (`BAC-06`, `T-15.44`).
9. `axe-core` clean and keyboard-operable on both screens, money right-aligned and currency-announced (`T-15.47`).
10. Isolation coverage extended for the two admin surfaces; a tenant token is refused, not scoped (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `e2e-12-settlement-zero-variance.e2e-spec.ts` | E2E (Playwright + API) | The seven-element mixed period reconciles at exactly zero |
| `money-allocation.property-spec.ts` | Property | Re-summation and rounding parity across randomised inputs |
| `settlement-concurrency.int-spec.ts` | Integration | Duplicated build under failover; same-approver double approval; duplicate payout webhook; late fee report |
| `ledger-grants-all-envs.int-spec.ts` | Integration | Five environments, zero mutating privileges |
| `settlement-negative.spec.ts` | Unit + Integration | The eight `BR-FIN-*` negatives plus `BR-REF-05-N1` |
| `finance.axe-spec.ts` | a11y | Zero violations on both screens; the dual-approval dialog is focus-trapped and escapable |

**Rollback plan** — Test-and-UI only; no migration, no domain change. A revert removes two admin
routes and the gate suite, which is a **downgrade of assurance, not of capability** — and therefore
requires the Technical Lead's approval under `§C10`, not a routine revert. `E2E-12` is a launch gate
through `BAC-07`; removing it is a change request.

**Notes** — The trap is the one the whole band has been walking around: somebody will propose a
tolerance so that a stubborn one-paise difference stops blocking a Friday release. `BAC-07` says
*zero* variance, `KPI-26` says 100%, and a tolerance is the mechanism by which a system stops being
able to tell a rounding artefact from a missing line. If the sum does not tie, something upstream is
wrong and the correct action is to find it. The second trap is demoing `E2E-12` on a period with
only online sales — it passes, and it proves nothing, because the commission base differs between
the two coupon funding sources and that difference is where `TR-05` lives.

---

## 2. Sprint 12 — refunds, disputes and evidence packs · `EP-16`

Six milestones. The through-line is that **the policy the member agreed to is the policy that
applies**, and that a reversal reverses at the original arithmetic — not at today's rate, not at
today's rounding, and not at today's commission override.

### M-098 — `refunds`, the order-snapshot policy, the ten `C4.8` reason codes, the 7-day floor

| Field | Value |
| :--- | :--- |
| **Sprint** | 12 |
| **Epic** | EP-16 · F-16.2, F-16.17, F-16.18 · T-16.01, T-16.02, T-16.04, T-16.05, T-16.07 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A refund's governing policy is parsed from the **order's stored snapshot** and from
nowhere else, so a tenant cannot change its refund terms after a sale and have the change apply
backwards.

**Depends on** — M-010, M-048, M-070, M-087.

**Unblocks** — M-099, M-100, M-101, M-102, M-103.

**Files**

- `prisma/migrations/<ts>_create_refunds/migration.sql` — header `phase: expand · rls: new table, policy in this migration · grants: SELECT, INSERT, restricted UPDATE (status, approver_id, provider_refund_ref, failure_code) only`. `refunds` (`tenant_id`, `order_id`, `payment_id`, `membership_id`, `origin`, `reason_code`, `requested_amount_minor`, `approved_amount_minor`, `currency`, `computation jsonb`, `applied_policy_snapshot jsonb`, `status`, `auto_approved`, `approver_id`, `provider_refund_ref`, `failure_code`, timestamps) — **and no destination column of any kind**.
- Same migration: partial `UNIQUE (order_id) WHERE status IN ('AUTO_APPROVED','PENDING_APPROVAL','PROCESSING','COMPLETED')`; `CHECK (status <> 'PROCESSING' OR approver_id IS NOT NULL OR auto_approved = true)`; `CHECK (reason_code IN (...))` constrained to the ten `C4.8` values; the RLS policy and the grants.
- `apps/server/src/refunds/domain/refund-policy.vo.ts` · `.spec.ts` — window days, proration method (`DAYS` / `SESSIONS` / `NONE`), cancellation fee; **parsed only from the order snapshot**; unparseable input **raises** rather than defaulting.
- `apps/server/src/refunds/domain/refund-reason-code.ts` · `.spec.ts` — the ten `C4.8` values as a constrained enum; mandatory where check-ins exist.
- `apps/server/src/refunds/domain/platform-refund-floor.ts` · `.spec.ts` — the platform-mandated **7-day no-visit cooling-off** applied as a **lower bound** on the tenant window (`OQ-05`).
- `.dependency-cruiser.js` (modified) — rule `refunds-domain-reads-no-tenant-config`: `refunds/domain` may not import the tenant repository or the configuration registry.
- `apps/server/src/refunds/README.md` · `docs/database/refunds.md`
- `prisma/seed/refunds.seed.ts` — an order whose tenant has since shortened its window; `SEED_VERSION` bumped (R-7).

**Acceptance criteria**

1. `RefundPolicy` is constructed **only** from `orders.refund_policy_snapshot`; there is no code path that reads the tenant's current policy during a refund, and `dependency-cruiser` fails the build if one is added (`BR-REF-01`, `BR-REF-02`, `T-16.07`).
2. The **mutate-and-re-evaluate** test proves it: change the tenant's live policy after the sale, re-evaluate the refund, and observe the **original** window, proration method and cancellation fee (`BR-REF-02-N1`).
3. An unparseable or absent snapshot **raises**; it never falls back to a default, because a default here silently invents contractual terms.
4. The platform 7-day no-visit cooling-off is a **lower bound**: a tenant policy of 3 days yields an effective 7; a tenant policy of 14 days yields 14 (`OQ-05`, `F-16.17`, `RSK-05`).
5. `reason_code` is constrained to the ten `C4.8` values by a database `CHECK`, and is mandatory where the membership has recorded check-ins (`BR-REF-06`, `F-16.18`).
6. The partial unique index permits **exactly one live refund per order**; a second concurrent request fails at the database (`BR-REF-09` — exercised fully in M-100).
7. **The table has no destination column.** An OpenAPI structural assertion confirms no refund request or response schema carries a destination, account, UPI id or card field (`BR-REF-04`, `SEC-A04-007`).
8. RLS policy and grants ship in this migration (R-6). No endpoint exists yet, so no isolation spec is due — the generated specs land with the endpoints in M-100 (R-5, and this is the one milestone in the band where R-5 is vacuous rather than waived).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `refund-policy.vo.spec.ts` | Unit | Snapshot-only construction; unparseable raises; all three proration methods parsed |
| `policy-mutation.int-spec.ts` | Integration | **NEGATIVE:** live-policy change does not alter an existing order's refund terms |
| `platform-refund-floor.spec.ts` | Unit | 3 → 7; 14 → 14; the floor never lowers a longer window |
| `refund-reason-code.spec.ts` | Unit | Ten values; an eleventh is a type error and a `CHECK` violation |
| `refunds-schema.int-spec.ts` | Integration | Partial unique index; the two `CHECK`s; RLS deny for tenant B |
| `no-destination-column.contract-spec.ts` | Contract | **NEGATIVE:** no destination-shaped field anywhere in the refunds OpenAPI surface |

**Rollback plan** — Expand-phase; a new table with no writers yet. `git revert` drops nothing that
exists in production data. The `dependency-cruiser` rule is the only cross-cutting change and is
additive.

**Notes** — The trap is convenience: the tenant's current policy is one join away and is always
available, while the snapshot has to be read out of a `jsonb` column and parsed. Every shortcut
taken here is a contract breach that only surfaces when a tenant tightens its terms and a member
refunds under the old ones. The `dependency-cruiser` rule exists because the review that would catch
it is the review that happens at 18:00 on a Friday.

### M-099 — Auto-approve or route, and the pro-rata figure **shown before confirmation**

| Field | Value |
| :--- | :--- |
| **Sprint** | 12 |
| **Epic** | EP-16 · F-16.3, F-16.4 · T-16.06, T-16.08, T-16.13 (preview) |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Every party — member, gym, Finance — sees the **same** refund figure, computed once,
before anybody confirms anything; and whether it auto-approves is decided by four inputs with no
repository lookup in the decision.

**Depends on** — M-069, M-070, M-098.

**Unblocks** — M-100, M-101, M-103.

**Files**

- `apps/server/src/refunds/domain/refund-approval-policy.ts` · `.spec.ts` — four inputs (days since purchase against the **snapshot** window · requested amount against the value threshold · **`ALLOWED` check-in count** against the usage threshold · reason code), two outcomes (`AUTO_APPROVED`, `PENDING_APPROVAL`). **No repository dependency**, enforced by the M-098 `dependency-cruiser` rule.
- `apps/server/src/refunds/domain/refund-amount-calculator.ts` · `.spec.ts` — full · pro-rata unconsumed **days** in the gym's IANA timezone · pro-rata unused **sessions** at purchased-price ÷ purchased-sessions · less the stated cancellation fee.
- `apps/server/src/refunds/domain/refund-computation.document.ts` · `.spec.ts` — the emitted `computation` document: inputs, each intermediate, the rounding step, the final figure. Rendered **identically** on all three surfaces.
- `apps/server/src/refunds/application/queries/refund-preview.query.ts` · `.int-spec.ts`
- `apps/server/src/refunds/application/ports/attendance-count.port.ts` — consumes `attendance/`'s existing query port; `refunds/` never joins to the attendance table.
- `apps/server/src/refunds/controllers/member-refunds.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts` — `GET /v1/me/memberships/:id/refund-preview`, which computes and returns **without creating anything**.
- `apps/server/src/refunds/domain/refund.errors.ts` — `REFUND_WINDOW_EXPIRED`, `REFUND_NOT_ELIGIBLE`, `REFUND_EXCEEDS_PAID_AMOUNT`.
- `docs/features/refunds.md` — the four inputs and the three computation methods, with worked INR examples.

**Acceptance criteria**

1. `RefundApprovalPolicy` takes four inputs and returns one of two outcomes, and it has **no repository dependency** — the test constructs it with plain values and no test double (`FR-RFND-03`, `BR-REF-03`, `BR-REF-06`, `T-16.06`).
2. The usage input is the count of **`ALLOWED`** check-ins only; a denied scan does not consume the member's refund eligibility.
3. Pro-rata on **days** counts unconsumed days in the **gym's** IANA timezone, so a 23:45 IST purchase and a 00:15 IST refund are not one day apart in UTC terms (`TR-24`, `AC-EP16-06`).
4. Pro-rata on **sessions** values a session at purchased-price ÷ purchased-sessions, not at list price, and the two never disagree by a paise across the property grid (`AC-EP16-07`).
5. The cancellation fee is subtracted **after** proration and is itself taken from the snapshot, not from current configuration.
6. The `computation` document is emitted once and is the **only** source for every surface; a test asserts the member preview, the tenant view and the Finance view render byte-identical figures (`FR-RFND-04`).
7. `GET /me/memberships/:id/refund-preview` **creates nothing** — no row, no idempotency key, no audit write beyond a read event — and is safe to call repeatedly (`FR-RFND-02`).
8. Isolation coverage for the preview endpoint ships here, in both directions, including a member requesting a preview for a membership they do not own (R-5).
9. `NEGATIVE:` tests exist for `BR-REF-03` and `BR-REF-06` (`BAC-06`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `refund-approval-policy.spec.ts` | Unit | The four-input grid; no repository double required; **NEGATIVE:** usage above threshold routes rather than auto-approving |
| `refund-amount-calculator.spec.ts` | Unit | Full; days; sessions; cancellation fee ordering; IST day boundaries |
| `refund-proration.property-spec.ts` | Property | Days and sessions methods re-sum exactly; no paise created or destroyed |
| `refund-computation-parity.int-spec.ts` | Integration | Member, tenant and Finance renders are byte-identical |
| `refund-preview.query.int-spec.ts` | Integration | Repeated calls create nothing; response stable |
| `member-refunds.controller.isolation-spec.ts` | Isolation (`IS3`) | Cross-tenant and cross-member preview refused |

**Rollback plan** — No migration, no writes, one read-only endpoint. `git revert` removes the
preview; nothing persists. This is deliberately the last refund milestone with a trivial rollback —
everything after it moves money.

**Notes** — The trap is computing the figure twice: once for the preview and once at execution.
They will diverge, because the second computation happens a day later with one more check-in on the
record, and the member will have confirmed a number they do not receive. The `computation` document
is persisted on the refund row at request time and **execution reads it**; the calculator is invoked
once per refund, not once per surface.

---

### M-100 — The `C4.5` machine, three origins, idempotency on the order, original-instrument execution

| Field | Value |
| :--- | :--- |
| **Sprint** | 12 |
| **Epic** | EP-16 · F-16.1, F-16.5, F-16.12, F-16.14, F-16.16 · T-16.09, T-16.10, T-16.13, T-16.14, T-16.21, T-16.24, T-16.31 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A refund can be requested by any of three actors, is executed **exactly once** per order,
and lands back on the instrument that paid — because the port has no destination parameter to abuse.

**Depends on** — M-017, M-053, M-054, M-098, M-099.

**Unblocks** — M-101, M-102, M-103.

**Files**

- `apps/server/src/refunds/domain/refund.aggregate.ts` · `.spec.ts` — `execute()` takes **only** the originating `paymentId`.
- `apps/server/src/refunds/domain/refund-status.state-machine.ts` · `.spec.ts` — all **seven** `C4.5` states with the exact legal edges and **no `REQUESTED → PROCESSING`** edge.
- `apps/server/src/refunds/application/use-cases/request-refund.use-case.ts` · `.int-spec.ts` — one use case, three entry points, one audit shape.
- `apps/server/src/refunds/application/use-cases/execute-refund.use-case.ts` · `.int-spec.ts` — `SELECT … FOR UPDATE` on the order row; partial-sum guard against `orders.total_minor`.
- `apps/server/src/payments/ports/payment-provider.port.ts` (modified) — `refund(paymentId, amountMinor, idempotencyKey)`. **No destination parameter exists on the signature.**
- `apps/server/src/payments/infrastructure/adapters/razorpay-route.refund.adapter.ts` · `.int-spec.ts` — performs the refund **and** the Route **transfer reversal**, normalising both into one result.
- `apps/server/src/refunds/controllers/member-refunds.controller.ts` (modified) · `tenant-refunds.controller.ts` · `admin-refunds.controller.ts` — each with `.int-spec.ts` and `.isolation-spec.ts`.
- `apps/server/src/refunds/jobs/gateway-status-poll.processor.ts` · `.spec.ts` — every 15 minutes; resolves `PROCESSING` and indeterminate refunds; `FAILED` retries with backoff and a **give-up state that alerts Finance**.
- `apps/server/src/refunds/application/handlers/payment-duplicate-detected.handler.ts` · `.spec.ts` — refunds every non-earliest `CAPTURED` payment through the **standard** use case with reason `DUPLICATE_PAYMENT`.
- `apps/server/src/refunds/domain/refund.errors.ts` (modified) — the ten `API_Catalog.md` §6.12 codes including `ORDER_ALREADY_REFUNDED` (409) and `REFUND_REQUIRES_APPROVAL` whose user-facing message is *routed, not rejected*.
- `docs/runbooks/refund-stuck-in-processing.md`

**Acceptance criteria**

1. The `C4.5` machine carries all seven states and **no** `REQUESTED → PROCESSING` edge; an illegal transition is unrepresentable in the aggregate and returns `422` from the controller (`C4.5`).
2. `PaymentProvider.refund()` has **no destination parameter**, and `Refund.execute()` takes only the originating `paymentId`. The absence is asserted structurally against the generated OpenAPI document and against the port's TypeScript signature (`BR-REF-04`, `FR-RFND-05`).
3. A cash sale is refunded as **recorded cash with staff attribution**, never routed to a gateway instrument (`REG-07`).
4. **A refund is never executed twice on one order.** Two concurrent requests produce exactly one refund: the partial unique index from M-098 plus `SELECT … FOR UPDATE` on the order plus the M-017 idempotency interceptor keyed on the order. The test runs both requests in parallel transactions (`BR-REF-09`, `TR-36`, `E12.6`).
5. A partial refund is bounded by `orders.total_minor` less all prior refunds; exceeding it returns `422 REFUND_EXCEEDS_PAID_AMOUNT`.
6. The Razorpay Route adapter performs refund **and** transfer reversal and returns one normalised result; a reversal failure with a successful refund is a named, alerted state and not a silent success.
7. `refunds.gateway-status-poll` resolves an indeterminate provider response within 15 minutes; the give-up state alerts Finance and the member is never left without an answer (`C4.5`, `F-16.14`, `TR-04`).
8. A duplicate payment is refunded through the **standard** use case — so commission reversal and the credit note happen correctly — within one hour (`BR-PAY-07`, `E2E-08`).
9. Isolation coverage for **all** refund endpoints ships here, in both directions, plus the Gym-Owner-cannot-approve `403` (R-5, `SEC-A04-007`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `refund-status.state-machine.spec.ts` | Unit | Seven states; **NEGATIVE:** `REQUESTED → PROCESSING` refused |
| `no-destination-parameter.contract-spec.ts` | Contract | Port signature and OpenAPI both free of any destination field |
| `refund-idempotency.int-spec.ts` | Integration | Two parallel requests → one refund; replay → `409 ORDER_ALREADY_REFUNDED` |
| `razorpay-route.refund.adapter.int-spec.ts` | Integration | Refund + transfer reversal normalised; reversal-failure state named |
| `gateway-status-poll.processor.spec.ts` | Unit | Indeterminate resolved; backoff; give-up alerts Finance |
| `payment-duplicate-detected.handler.spec.ts` | Unit | Non-earliest captures refunded through the standard path with `DUPLICATE_PAYMENT` |
| `refunds.isolation-spec.ts` | Isolation (`IS3`) | All three controllers, both directions; Gym Owner approval `403` |

**Rollback plan** — `git revert` removes the endpoints and the executor. **A refund already
instructed at the provider cannot be reverted by code** — the runbook's first line says so, and
Finance reverses it at the provider. The `payout`/`refund` port additions are backward-compatible;
the Stripe reference adapter keeps the contract suite green either way.

**Notes** — The trap is a "destination" field added in good faith to support "refund to a different
card because the original expired". That is precisely the fraud vector `BR-REF-04` exists to close,
and the correct answer for an expired instrument is the provider's own reversal handling, not our
API. The structural assertion is there so the field cannot be added quietly. The second trap is
treating a Route **transfer reversal** as optional: without it the platform refunds the member from
its own float while the gym keeps its share.

### M-101 — The credit note in its own sequence, and **proportional commission reversal at the original rounding**

| Field | Value |
| :--- | :--- |
| **Sprint** | 12 |
| **Epic** | EP-16 · F-16.6, F-16.7, F-16.13 · T-16.11, T-16.12, T-16.16, T-16.22, T-16.23 · EP-15 T-15.15 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A refund produces four artefacts from one action — credit note, ledger reversal,
commission reversal, revoked QR — and the reversal reverses at the **order's** stored rate and the
**original** rounding, so the statement still ties out afterwards.

**Depends on** — M-058, M-070, M-087, M-088, M-089, M-091, M-092, M-100.

**Unblocks** — M-102, M-103, M-106.

**Files**

- `apps/server/src/billing/application/use-cases/issue-credit-note.use-case.ts` · `.int-spec.ts` — gapless per-tenant per-FY numbering in a **credit-note sequence of its own**, distinct from the invoice sequence, reusing the M-058 allocator.
- `apps/server/src/refunds/domain/commission-reversal-calculator.ts` · `.spec.ts` — `round_half_even(original_commission × refunded_amount / original_net)` at the **order's** stored `commission_rate_bps`, never at the resolver's current answer (R-11).
- `apps/server/src/ledger/domain/entry-types.ts` (modified) — `COMMISSION_TAX_REVERSAL` added; reverses at the **same rounding** as the original, present and reversing **zero** pending `REG-02`.
- `apps/server/src/refunds/application/use-cases/post-refund-ledger.use-case.ts` · `.int-spec.ts` — `REFUND`, `COMMISSION_REVERSAL`, `COMMISSION_TAX_REVERSAL`, and `GATEWAY_FEE` **only** where the provider reported a reversal; a non-reversed fee becomes a labelled **borne-fee** line.
- `apps/server/src/refunds/application/use-cases/apply-membership-effect.use-case.ts` · `.int-spec.ts` — `→ REFUNDED` on a full refund (terminal in `C4.1`), entitlement adjustment on a partial, **immediate QR revocation** through the `memberships/` command port.
- `apps/server/src/refunds/application/services/recovery-ordering.service.ts` · `.spec.ts` — balance → reserve → negative carry-forward, calling M-091's `allocate()`; `reserve.release` **suspended** for a tenant with an open claim.
- `apps/server/src/refunds/jobs/closure-bulk-run.processor.ts` · `.spec.ts` — consumes `GymCeasedOperating`; per-membership idempotency; **resumable after restart**.
- `docs/KNOWN_LIMITATIONS.md` — the zero `commission_tax_minor` reversal recorded while `REG-02` is open.
- `docs/runbooks/empty-reserve-on-closure-run.md` · `docs/runbooks/provider-reversed-no-fee.md`

**Acceptance criteria**

1. The credit note is issued in a **credit-note sequence**, gapless per tenant per financial year, with void records documented — the invoice sequence is untouched and the two never interleave (`FR-RFND-07`, `FR-INV-02`).
2. Commission reversal is `round_half_even(original_commission × refunded_amount / original_net)` at the **order's** `commission_rate_bps`; a tenant commission override applied after the sale does not change the reversal (`BR-REF-05`, `BR-FIN-05`, `BR-REF-05-N1`).
3. **Rounding parity to the paise**: the reversal suite matches the reversal against the original across a percentage grid, partial refunds, coupon-discounted orders in **both** funding sources, and renewal-rate sales; after each, the statement is re-tied (`E12.3`, `T-16.33`, `TR-05`).
4. `COMMISSION_TAX_REVERSAL` exists as an entry type and reverses at the same rounding, currently at zero pending `REG-02`; the zero is recorded in `KNOWN_LIMITATIONS.md`, not hidden as an absent code path (`T-15.15`).
5. A gateway fee is reversed **only where the provider reported a reversal**; an unreversed fee becomes an explicit labelled borne-fee line, never an estimate (`BR-FIN-06`).
6. All ledger effects are written in the **same transaction** as the refund; a rollback leaves no partial reversal (`FR-RFND-07`).
7. A full refund moves the membership to `REFUNDED` and **revokes the QR credential immediately** — the next scan is denied within the token's own 60-second TTL, asserted by test (`FR-RFND-06`, `AC-EP16-14`).
8. Refunding an already-paid-out sale draws **balance, then reserve, then negative carry-forward**; with an **empty reserve** it produces a negative balance carried forward, **not a failure** (`A6.4`, `E12.5`, `TR-26`).
9. `reserve.release` is suspended for a tenant with an open closure claim (`T-16.23`, `RSK-06`).
10. The gym-closure bulk run is idempotent per membership and resumes correctly after a worker restart mid-run (`BR-REF-07`, `BR-MEM-14`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `commission-reversal-calculator.spec.ts` | Unit | Original rate and rounding; **NEGATIVE:** post-sale override does not alter the reversal |
| `refund-arithmetic-parity.property-spec.ts` | Property | Reversal matches original to the paise across the grid; statement re-ties |
| `issue-credit-note.use-case.int-spec.ts` | Integration | Own sequence; gapless per tenant per FY; void documented |
| `post-refund-ledger.use-case.int-spec.ts` | Integration | One transaction; borne-fee line where no reversal was reported |
| `qr-revocation.int-spec.ts` | Integration | Next scan denied after a full refund |
| `empty-reserve-path.int-spec.ts` | Integration | Negative carry-forward, not a failure (`E12.5`) |
| `closure-bulk-run.processor.spec.ts` | Unit | Per-membership idempotency; resumption after restart |

**Rollback plan** — No schema change beyond an enum value, which is additive and forward-only.
`git revert` removes the reversal path; ledger entries already written are append-only records and
remain. **A credit note already issued is a statutory document and is never deleted** — it is voided
with a documented void record, and the runbook says so.

**Notes** — The trap is `resolveCommission(tenantId, now)`. It is the obvious call, it compiles, it
returns a plausible number, and it is wrong every time the rate has changed since the sale — which is
exactly what M-114's override feature makes routine. R-11 exists for this line of code. The second
trap is the fee: providers often refund the transaction and keep the processing fee, and a system
that assumes symmetry will over-credit the gym by the fee amount on every refund, permanently, and
the statement will still appear to tie because both sides of the error are ours.

---

### M-102 — Chargeback intake, the hold from case opening, and the evidence pack that assembles itself

| Field | Value |
| :--- | :--- |
| **Sprint** | 12 |
| **Epic** | EP-16 · F-16.8, F-16.9, F-16.10, F-16.15 · T-16.03, T-16.17, T-16.18, T-16.19, T-16.20, T-16.25 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — The moment a dispute opens, the disputed amount stops being payable and the evidence pack
already exists — including every attendance record, which is the single most persuasive artefact this
product owns.

**Depends on** — M-056, M-069, M-087, M-090, M-096, M-098, M-101.

**Unblocks** — M-103, M-107.

**Files**

- `prisma/migrations/<ts>_create_disputes/migration.sql` — header `phase: expand · rls: new tables, policies in this migration · grants: SELECT, INSERT, restricted UPDATE (status, outcome, submitted_at) only`. `disputes` (`tenant_id`, `provider_dispute_id UNIQUE`, `payment_id`, `amount_minor`, `reason`, `evidence_due_at NOT NULL`, `status`, `outcome`) with **`outcome` immutable once set**, and `dispute_evidence` (`dispute_id`, `kind`, `object_key`, `sha256`, `assembled_at`, `missing_reason`).
- `apps/server/src/refunds/application/handlers/provider-dispute-opened.handler.ts` · `.int-spec.ts` — normalised provider event → `disputes` row **and** `CHARGEBACK` ledger hold in **one** transaction; duplicate-safe on `provider_dispute_id`; **parks** an event whose payment has not yet arrived (`TR-04` W7).
- `apps/server/src/refunds/application/services/evidence-pack.assembler.ts` · `.int-spec.ts` — order, invoice PDF, payment record, **every** attendance row, accepted terms **with the policy snapshot**, communication log; a missing item is **named in `missing_reason`**, never silently omitted.
- `apps/server/src/refunds/jobs/evidence-pack-assemble.processor.ts` · `.spec.ts` — invoked at case creation, not on demand.
- `apps/server/src/refunds/application/services/balance-hold.service.ts` · `.int-spec.ts` — held amounts **excluded from `settlement.build-batches`**; a favourable resolution writes the release entry and the amount returns to the next batch.
- `apps/server/src/refunds/controllers/admin-disputes.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts` — `GET /v1/admin/disputes`, `POST /v1/admin/disputes/:id/evidence` with the deadline (`410`) and resolved-state (`409`) guards.
- `apps/server/src/refunds/jobs/dispute-deadline-watch.processor.ts` · `.spec.ts` — hourly; escalating reminders at **T−48 h / T−24 h / T−6 h**; breach alarm.
- `infra/monitoring/alerts/dispute-no-pack-under-24h.yaml`
- `docs/runbooks/dispute-deadline-missed.md` · `docs/runbooks/dispute-lost-on-already-refunded-order.md`

**Acceptance criteria**

1. A provider dispute webhook creates the `disputes` row **and** the `CHARGEBACK` ledger hold in **one transaction**; neither can exist without the other (`FR-RFND-08`, `BR-REF-08`).
2. Intake is duplicate-safe on `provider_dispute_id`; a replayed webhook produces one case and one hold (`TR-04`).
3. A dispute event whose payment has not yet arrived is **parked and retried**, never dropped and never failed permanently (`TR-04` W7).
4. **The held amount is excluded from batch construction from the moment the case opens** — the next `settlement.build-batches` run does not include it, proven by an integration test that opens a case mid-cycle (`FR-RFND-10`).
5. A favourable resolution writes the release entry and the amount appears in the next batch (`AC-RFND-02.3`, `E12.8`).
6. The evidence pack is assembled **at case creation**, not when a human opens the case; a case created at 03:00 has a complete pack at 03:01 (`FR-RFND-09`, `F-16.9`).
7. The pack contains **every** attendance row for the membership — not a sample, not the last ten — because attendance is the evidence that the service was delivered (`AC-EP16-22`).
8. A component that cannot be assembled is **named** with a `missing_reason`; the pack is never silently short (`AC-EP16-22`).
9. Evidence submission is refused after the deadline (`410`) and after resolution (`409`); `outcome` is immutable once set, enforced by constraint.
10. Reminders fire at T−48 h, T−24 h and T−6 h, once each; a breach raises an alarm; a dispute with under 24 hours remaining and **no pack** raises its own alert (`F-16.15`, `RSK-05`).
11. RLS policies and grants for both tables ship in this migration (R-6); isolation coverage for both admin endpoints and the **evidence object download** ships here (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `provider-dispute-opened.handler.int-spec.ts` | Integration | One transaction; duplicate-safe; parked event retried |
| `evidence-pack.assembler.int-spec.ts` | Integration | All six components; every attendance row; missing item named |
| `balance-hold.service.int-spec.ts` | Integration | Case opened mid-cycle excludes the amount from the next batch; release returns it |
| `dispute-deadline-watch.processor.spec.ts` | Unit | Three reminders, once each; breach alarm; no-pack alert |
| `dispute-lifecycle.int-spec.ts` | Integration | Open · hold · evidence · duplicate webhook · batch exclusion · win with release · loss with credit note · deadline breach (`T-16.35`) |
| `admin-disputes.controller.isolation-spec.ts` | Isolation (`IS3`) | Cross-tenant case read and **evidence object-key download** refused |

**Rollback plan** — Expand-phase, two new tables. `git revert` removes intake, so **new disputes
would not open a hold** — which is a financial exposure, not a neutral rollback. The PR body requires
Finance sign-off and the runbook prescribes a manual hold in the interim. Existing holds are ledger
entries and survive a revert.

**Notes** — The trap is assembling the pack when a human opens the case. Disputes arrive at 03:00,
deadlines are measured in days, and the pack takes minutes to assemble against object storage — but
the attendance rows it needs are on a **monthly-partitioned** table with a retention sweep, and if the
pack is assembled late enough the rows may have been purged. `O-5` names this tension exactly; the
resolution is that the pack is assembled at case creation and is itself the retained artefact.

### M-103 — `SCR-DASH-015`, `SCR-ADM-008`, `SCR-ADM-009`, the member flow, and `E2E-07` / `E2E-08`

| Field | Value |
| :--- | :--- |
| **Sprint** | 12 |
| **Epic** | EP-16 · F-16.11 · T-16.26, T-16.27, T-16.28, T-16.29, T-16.30, T-16.32, T-16.34, T-16.36, T-16.38, T-16.39 |
| **Size** | 6h |
| **Role** | Full-stack |

**Goal** — Everyone who can start, approve or contest a refund can see the arithmetic **before** they
commit to it, and Sprint 12's exit gate is green.

**Depends on** — M-098, M-099, M-100, M-101, M-102.

**Unblocks** — M-107, M-119, M-120.

**Files**

- `apps/gym-dashboard/src/routes/refunds.route.tsx` — `SCR-DASH-015`.
- `apps/gym-dashboard/src/features/refunds/` — `request-list.table.tsx`, `refund-detail.panel.tsx`, `computation-preview.tsx` (the figure **before** the confirm button), `policy-with-capture-date.tsx`, plus the four state components.
- `apps/gym-dashboard/src/features/settings/refund-policy.section.tsx` — the editor with the **platform floor rendered as a non-editable lower bound** and a preview of what a member sees at checkout (`T-16.28`).
- `apps/admin-dashboard/src/routes/finance-refunds.route.tsx` — `SCR-ADM-008`: queue by age, amount, usage, policy position, tenant, requester; approve/reject with reason.
- `apps/admin-dashboard/src/routes/finance-disputes.route.tsx` — `SCR-ADM-009`: case list with **deadline countdown**, evidence-pack viewer, submission action, outcome and hold status.
- `apps/customer-web/src/app/(account)/memberships/[id]/refund/page.tsx` — the member flow on `SCR-WEB-009`, status on `SCR-WEB-011`: stored policy **with capture date**, preview before confirm, credit-note download, and *routed, not rejected* messaging.
- `apps/server/test/e2e/e2e-07-refund-lifecycle.e2e-spec.ts` · `e2e-08-duplicate-payment.e2e-spec.ts`
- `apps/server/test/unit/refund-negative.spec.ts` — the nine `BR-REF-*` negatives (`BAC-06`).
- `infra/monitoring/dashboards/refund-abuse.json` — `gym.refund.auto_approved_pct`, `gym.refund.rate_by_tenant`, `gym.refund.repeat_member.count`, `gym.dispute.open.count`, `gym.dispute.deadline_hours_remaining`, `gym.refund.cluster_by_branch.count`.
- `docs/ui/SCR-DASH-015.md` · `docs/ui/SCR-ADM-008.md` · `docs/ui/SCR-ADM-009.md`

**Acceptance criteria**

1. **The pro-rata computation is shown before confirmation** on all three surfaces, rendered from the M-099 `computation` document, and the confirm button is disabled until it has loaded (`AC-RFND-01.2`, `E12.2`).
2. The policy shown carries its **capture date** and is byte-identical to what checkout displayed (`FR-RFND-02`, `BR-REF-02`).
3. A routed refund is messaged as **"routed for review"**, never as "rejected" — the copy is asserted by test because it is the difference between a support ticket and a chargeback (`AC-RFND-01.6`, `T-16.31`).
4. `SCR-ADM-008` shows age, amount, usage, policy position, tenant and requester, and an approval requires a reason (`FR-ADMN-02` shape).
5. `SCR-ADM-009` shows the deadline countdown with a **non-visual equivalent** for screen readers, the evidence-pack viewer, and the hold status.
6. The refund-policy editor renders the platform 7-day floor as a **non-editable lower bound** with an explanation, and previews the member-facing text (`BR-REF-01`).
7. **`E2E-07` passes**: request inside the window → auto-approve → gateway refund → credit note → membership `REFUNDED` → QR revoked → tenant balance reduced (`E2E-07`, `BAC-08`, `E12.1`).
8. **`E2E-08` passes**: a duplicate payment produces **one** membership, the duplicate auto-refunded within the hour, and both statement lines **netting to zero** (`E2E-08`, `E12.4`).
9. Refund and dispute history appears on the member record, the order and the tenant's financial views (`FR-RFND-11`).
10. `axe-core` clean and keyboard-operable across all four surfaces (`T-16.39`, `NFR-USE-01`).
11. Isolation coverage extended for every new read surface; a tenant token on `/admin/refunds` is refused, not scoped (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `e2e-07-refund-lifecycle.e2e-spec.ts` | E2E | The seven-step chain end to end |
| `e2e-08-duplicate-payment.e2e-spec.ts` | E2E | One membership; auto-refund within the hour; two statement lines netting to zero |
| `computation-preview.spec.tsx` | Unit (FE) | Confirm disabled until the computation loads; figure identical to the API document |
| `routed-not-rejected.spec.tsx` | Unit (FE) | The messaging assertion for `REFUND_REQUIRES_APPROVAL` |
| `refund-negative.spec.ts` | Unit + Integration | All nine `BR-REF-*` negatives (`BAC-06`) |
| `refunds-disputes.axe-spec.ts` | a11y | Zero violations; the deadline countdown has a non-visual equivalent |

**Rollback plan** — UI and tests. `git revert` removes four surfaces and leaves the API intact, so
refunds remain executable by Finance through the API while the UI is repaired. Removing `E2E-07` or
`E2E-08` is a `§C10` change, not a revert — both are Sprint-12 exit conditions and `BAC-08` is a
launch gate.

**Notes** — The trap is a confirm button that is enabled before the figure arrives. A member who
taps it and *then* sees ₹1,847 where they expected ₹3,000 will open a dispute, and the dispute will
be about trust rather than about money. The second trap is the word "rejected" in the routed case:
the refund has not been refused, it is being reviewed, and the copy difference measurably changes
chargeback volume.

---

## 3. Sprint 13 — reporting, analytics and exports · `EP-18`

Twenty-seven report keys, one execution pipeline, and a module that can read almost everything
precisely because it can write nothing (R-10). This is also the sprint where `TR-12` — cross-tenant
leakage through reporting and exports — is either closed or shipped.

### M-104 — The report harness, the key registry, read preference, and the freshness contract

| Field | Value |
| :--- | :--- |
| **Sprint** | 13 |
| **Epic** | EP-18 · F-18.1, F-18.2, F-18.12, F-18.16 · T-18.01, T-18.02, T-18.03, T-18.04, T-18.06, T-18.13 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — One pipeline executes every report; a financial report **cannot** be routed to a replica
by construction; and a report key without a declared permission and a generated isolation spec fails
the build.

**Depends on** — M-010, M-014, M-023, M-087.

**Unblocks** — M-105, M-106, M-107, M-108, M-117.

**Files**

- `apps/server/src/reporting/domain/report-definition.ts` · `.spec.ts` — key, permission, scope (`TENANT` / `PLATFORM`), **source** (`primary` / `replica`), freshness class, parameter schema (date range, branch), column metadata, chart hint.
- `apps/server/src/reporting/domain/report-key.registry.ts` · `.spec.ts` — the single registry; `REPORT_KEY_UNKNOWN` (404) responds **listing the available keys** for the caller's permissions.
- `apps/server/src/reporting/application/use-cases/execute-report.use-case.ts` · `.int-spec.ts`
- `apps/server/src/reporting/infrastructure/read-preference.resolver.ts` · `.spec.ts` — a `financial` freshness class **cannot** resolve to a replica; the type makes it unrepresentable rather than the code checking for it.
- `apps/server/src/reporting/jobs/materialise.processor.ts` · `.spec.ts` — every 10 minutes for replica-class reports; the stamp is surfaced in the payload and is **never older than 15 minutes**.
- `apps/server/src/reporting/controllers/tenant-reports.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts`
- `apps/server/src/reporting/permissions.ts`
- `tools/ci/assert-report-keys.ts` — every key declares a permission, a scope, a source and a freshness class; **every key has a generated isolation spec**; the build fails otherwise.
- `tools/generators/report-isolation-spec.generator.ts` — generates a both-directions isolation spec per key (`T-18.06`).
- `.dependency-cruiser.js` (modified) — rule `reporting-is-read-only`: `reporting/` may import no repository write method and no domain command handler (R-10).
- `infra/monitoring/alerts/replica-lag.yaml` — alert at **2 s**, automatic fallback to primary above **5 s**.

**Acceptance criteria**

1. Every report is executed by **one** pipeline; a report that bypasses it is a structure-test failure, not a review comment (`FR-RPT-01`, `F-18.1`).
2. A `financial`-class definition **cannot** carry `source: replica` — the combination does not type-check, and a runtime attempt raises (`FR-RPT-02`, `TR-10`).
3. An unknown key returns `404 REPORT_KEY_UNKNOWN` **listing the keys the caller may run** — not a bare 404, because a bare 404 is indistinguishable from a permission failure (`F-18.16`).
4. Replica-class reports carry a freshness stamp in the payload, materialised every 10 minutes and **never older than 15 minutes**; a stale stamp fails the request rather than serving silently old data (`AC-RPT-02.1`, `E13.3`).
5. Replica lag above **2 s** alerts; above **5 s** the resolver falls back to the primary automatically (`F-18.12`, `NFR-SCAL-04`).
6. `assert-report-keys` fails the build for a key missing a permission (`FR-RBAC-01`), a scope, a source, a freshness class **or a generated isolation spec** (R-5, `TR-12`).
7. `reporting-is-read-only` is enforced by `dependency-cruiser` and has a test that adds a write import and observes the build fail (R-10, `AC-RPT-08.1`).
8. Platform-scope execution goes through `runElevated()` and is audited **before** the work (M-014, `SR-10`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `report-definition.spec.ts` | Unit | The seven declared fields; financial + replica is not constructible |
| `read-preference.resolver.spec.ts` | Unit | Financial → primary always; operational → replica; fallback above 5 s |
| `materialise.processor.spec.ts` | Unit | 10-minute cadence; a stamp older than 15 minutes fails the read |
| `report-key-registry.int-spec.ts` | Integration | `REPORT_KEY_UNKNOWN` lists permitted keys only |
| `assert-report-keys.spec.ts` | CI policy | Missing permission / scope / source / freshness / isolation spec each fail |
| `reporting-read-only.structure-spec.ts` | Structure | A write import fails the build |
| `tenant-reports.controller.isolation-spec.ts` | Isolation (`IS3`) | Both directions on the harness endpoint |

**Rollback plan** — No migration; a new module surface with one endpoint and no reports registered
yet. `git revert` removes the harness. The `dependency-cruiser` rule and the CI check are additive
and should be **kept** even on a partial revert — the PR body says so.

**Notes** — The trap is a `financial` report that "just this once" reads the replica because the
primary is busy. It returns numbers that are correct as of some unstated moment, a gym owner
reconciles against them, and the disagreement is unreproducible. `TR-10` is scored at 15 for exactly
this reason, and the mitigation is structural: the combination is not constructible.

### M-105 — Drill-down from any total, the CSV contract, and timezone-correct bucketing

| Field | Value |
| :--- | :--- |
| **Sprint** | 13 |
| **Epic** | EP-18 · F-18.5, F-18.10, F-18.15, F-18.17 · T-18.05, T-18.14, T-18.15, T-18.16, T-18.17 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Every number on every report is traceable to the rows that make it, and those rows
**re-sum to it** — which is the property that makes a report trustworthy rather than decorative.

**Depends on** — M-104.

**Unblocks** — M-106, M-107, M-108, M-117.

**Files**

- `apps/server/src/reporting/domain/drill-ref.vo.ts` · `.spec.ts` — an opaque, signed reference carrying the cell's report key, filters, source and bucket; **not** a client-constructible query.
- `apps/server/src/reporting/application/use-cases/drill-cell.use-case.ts` · `.int-spec.ts` — `GET /v1/tenant/reports/:key/drill/:cell` re-executes with the **same source and the same filters**, cursor-paginated (`ADR-0023`).
- `apps/server/src/reporting/infrastructure/csv.serialiser.ts` · `.spec.ts` — human-readable headers from column metadata, money as a plain integer-derived number **plus a separate currency column**, ISO-8601 **with offset**, UTF-8 BOM.
- `apps/server/src/reporting/domain/bucketing.ts` · `.spec.ts` — day, week, month and weekday-hour buckets computed in the **gym's** IANA zone; property-tested across the 18:30 UTC boundary.
- `apps/server/src/reporting/domain/fy-presets.ts` · `.spec.ts` — *This FY*, *Last FY*, *FY to date* via the shared `financialYearOf(instant, timezone, fyStartMonth)`; agrees with `invoices.financial_year`.
- `packages/utils/src/money/serialise-boundary.ts` (modified) · `.spec.ts` — minor units as strings or safe integers across the boundary, with a round-trip property test (`TR-38`).
- `apps/server/src/reporting/dto/report-cell.response.dto.ts` — every numeric cell carries its `drillRef`.
- `docs/apis/API-RPT.md` (drill-down section)

**Acceptance criteria**

1. **Every numeric cell carries a `drillRef`**, and `GET .../drill/:cell` returns the constituent records (`FR-RPT-05`, `AC-RPT-01.2`).
2. The drill re-executes with the **same source and the same filters** as the parent cell; a drill from a `financial`-class report reads the primary (`TR-10`).
3. The returned row set **re-sums to the parent total, exactly** — this is asserted per report in M-106 and M-107, and the mechanism is asserted here (`E13.2`).
4. `drillRef` is signed and opaque; a client-crafted reference is refused. Drill-down is not a query API in disguise.
5. Drill results are cursor-paginated (`ADR-0023`); a 40,000-row drill does not attempt to serialise 40,000 rows.
6. CSV carries human-readable headers, money as a plain number **beside a separate currency column**, ISO-8601 with offset, and a UTF-8 BOM so Excel in India opens Devanagari member names correctly (`AC-RPT-01.3`, `E13.5`).
7. Buckets are computed in the **gym's** zone: a 23:45 IST check-in counts on the correct local day, and an invoice at 19:00 UTC on 31 March falls in the **new** FY (`TR-19`, `TR-24`, `AC-EP18-24`, `AC-EP18-25`, `T-18.35`).
8. FY presets read `fy_start_month` from the tax profile, never a constant — so M-115's configuration change is honoured without a deploy (`F-19.17`).
9. The money round-trip property test proves no paise is lost across the boundary in either direction (`TR-38`, `AC-EP18-31`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `drill-ref.vo.spec.ts` | Unit | Opaque and signed; a crafted reference is refused |
| `drill-cell.use-case.int-spec.ts` | Integration | Same source, same filters; cursor pagination; row set re-sums |
| `csv.serialiser.spec.ts` | Unit | Headers; plain-number money + currency column; ISO-8601 with offset; BOM |
| `bucketing.property-spec.ts` | Property | Day/week/month/weekday-hour correct across the 18:30 UTC boundary |
| `fy-boundary.int-spec.ts` | Integration | 19:00 UTC 31 March lands in the new FY in the Tax report |
| `money-boundary.property-spec.ts` | Property | Round-trip loses no paise |

**Rollback plan** — Additive; no migration. `git revert` removes drill-down and the CSV contract,
leaving reports renderable but untraceable — which fails `E13.2` and is therefore a `§C10`
conversation rather than a routine revert once Sprint 13 has closed.

**Notes** — The trap is a `drillRef` that is a serialised SQL fragment or a raw filter object. It is
the fastest thing to build and it hands every caller an arbitrary query planner with the reporting
module's very broad read permissions — which is `TR-12` with a bow on it. The reference is opaque and
signed; the server reconstructs the query from the registry, never from the client.

---

### M-106 — The **16-report tenant catalogue** and `SCR-DASH-020`

| Field | Value |
| :--- | :--- |
| **Sprint** | 13 |
| **Epic** | EP-18 · F-18.6, F-18.14 · T-18.07, T-18.08, T-18.09, T-18.21, T-18.25, T-18.29, T-18.30 |
| **Size** | 6h |
| **Role** | Full-stack |

**Goal** — A gym owner can answer the sixteen questions the PRD says they will ask, and can click any
total to see what it is made of.

**Depends on** — M-093, M-101, M-104, M-105.

**Unblocks** — M-108, M-117, M-119.

**Files**

- `apps/server/src/reporting/application/reports/financial/` — `revenue-summary.report.ts`, `revenue-by-plan.report.ts`, `outstanding-balances.report.ts`, `settlement-statement.report.ts`, `tax-report.report.ts`, each `.int-spec.ts`, **all `source: primary`**.
- `apps/server/src/reporting/application/reports/membership/` — `new-members`, `renewals`, `churn-cohort`, `expiring-memberships`, `member-activity`.
- `apps/server/src/reporting/application/reports/operations/` — `attendance-summary`, `peak-hours`, `staff-activity`, `coupon-performance`, `review-summary`, `lead-funnel`.
- `apps/gym-dashboard/src/routes/reports.route.tsx` — `SCR-DASH-020`.
- `apps/gym-dashboard/src/features/reports/` — `catalogue-cards.tsx`, `date-range-branch.filter.tsx`, `report-table.tsx`, `drill-through.panel.tsx`, `export.button.tsx`, plus `empty.tsx`, `loading.tsx`, `error.tsx`, `permission-denied.tsx`.
- `packages/ui/src/charts/AccessibleChart.tsx` · `.spec.tsx` — keyboard-navigable, with a **table alternative and a text summary** for every chart (`T-18.29`).
- `apps/server/test/int/report-accuracy.int-spec.ts` — every total reconciles to its drill-through row set on the seeded dataset.
- `docs/ui/SCR-DASH-020.md` · `docs/features/report-catalogue.md`

**Acceptance criteria**

1. All **sixteen** tenant reports render, filter by date range and branch, chart where meaningful, and export to CSV (`B5.20`, `E13.1`).
2. The five financial reports are declared `source: primary` and are asserted by test to read the primary, not the replica (`FR-RPT-02`, `E13.3`).
3. **Every total drills through to the exact records that compose it, and the row set re-sums to the total** — asserted for all sixteen on the seeded dataset (`FR-RPT-05`, `E13.2`, `AC-RPT-01.1`).
4. `settlement-statement` reads the persisted M-090/M-093 figures and **never recomputes** them; a mismatch between the report and `SCR-DASH-014` is a test failure (`BR-FIN-02`).
5. `tax-report` buckets by FY using M-105's presets and agrees with `invoices.financial_year` row for row.
6. The four carry-ins land here as registered keys: attendance heatmap (`FR-CHK-13`), daily attendance digest (`FR-CHK-14`), coupon performance (`FR-CPN-08`), invoice bulk export (`FR-INV-10`) — closing descope `D-09`, which was deferred from Sprint 8 to Sprint 13 rather than dropped.
7. Every chart has a **keyboard-navigable table alternative and a text summary**; a chart with no alternative fails `axe-core` review (`NFR-USE-01`, `AC-EP18-32`).
8. Each of the sixteen keys has its **generated** isolation spec, both directions, produced by M-104's generator — the build fails for a key without one (R-5, `TR-12`).
9. `permission-denied` is a designed state, not a blank card: a receptionist opening the reports catalogue sees only the keys their role permits (`FR-NAV-03`, and the server still refuses — `FR-RBAC-02`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `report-accuracy.int-spec.ts` | Integration | All sixteen totals re-sum to their drill-through row sets |
| `financial-reads-primary.int-spec.ts` | Integration | The five financial keys read the primary under injected replica lag |
| `settlement-statement.report.int-spec.ts` | Integration | Figures identical to `SCR-DASH-014`; nothing recomputed |
| `tax-report.int-spec.ts` | Integration | FY buckets agree with `invoices.financial_year` |
| `reports-generated.isolation-spec.ts` | Isolation (`IS3`) | Sixteen keys, both directions |
| `reports.axe-spec.ts` | a11y | Zero violations; every chart has a table alternative and a text summary |

**Rollback plan** — Additive registry entries and one route. `git revert` removes the catalogue;
the harness survives. Individual reports can be withdrawn one key at a time by unregistering them,
which is the preferred granular rollback and is what the runbook prescribes for a single misbehaving
report.

**Notes** — The trap is a total that is computed by the report and a drill-through that is computed
by a different query. They agree on the seeded data and disagree in production the first time a
partial refund lands mid-period. The drill re-executes the **same** definition with a narrower
projection; `report-accuracy.int-spec.ts` is what keeps that true.

### M-107 — The **11-report platform catalogue**, `City performance` with the five `C9.4` gates, `SCR-ADM-014`

| Field | Value |
| :--- | :--- |
| **Sprint** | 13 |
| **Epic** | EP-18 · F-18.7, F-18.13 · T-18.10, T-18.11, T-18.12, T-18.23, T-18.24, T-18.26 |
| **Size** | 6h |
| **Role** | Full-stack |

**Goal** — The launch decision becomes a **query**, not a meeting: the five `C9.4` city gates are
columns on a report that reads real data.

**Depends on** — M-014, M-096, M-102, M-104, M-105.

**Unblocks** — M-116, M-120.

**Files**

- `apps/server/src/reporting/application/reports/platform/commercial/` — `gmv-take-rate.report.ts`, `city-performance.report.ts`, `payment-health.report.ts`, `refunds-disputes.report.ts`, `reconciliation.report.ts`.
- `apps/server/src/reporting/application/reports/platform/funnels/` — `tenant-funnel.report.ts`, `tenant-cohort-retention.report.ts`, `marketplace-funnel.report.ts`, `review-integrity.report.ts`, `support-load.report.ts`, **`verification-sla.report.ts`** — the eleventh key (R-M12).
- `apps/server/src/reporting/application/services/elevated-report.runner.ts` · `.int-spec.ts` — `runElevated()` around all eleven, audited **before** the work; a tenant-role token is **refused**, not scoped.
- `apps/server/src/analytics/domain/event-schemas.ts` · `.spec.ts` — all **49** `§C6` event names with typed properties.
- `tools/ci/assert-no-personal-data-in-events.ts` — a CI schema check **refusing any personal-data property** on an analytics event (`BR-DAT-06`).
- `apps/server/src/analytics/application/funnels/` — `marketplace-funnel.ts`, `tenant-activation-funnel.ts`, each with per-step drop-off and **lat/lng precision reduction at emission**.
- `apps/admin-dashboard/src/routes/platform-analytics.route.tsx` — `SCR-ADM-014`, with city, tier and cohort dimensions and the **city-gate view**.
- `apps/admin-dashboard/src/features/analytics/city-gates.panel.tsx` · `.spec.tsx` — five columns, each pass/fail with its measured value.
- `docs/DECISION_LOG.md` — the **11-versus-10** correction against `OQ-18.a` (R-M12, `T-18.39`).
- `docs/features/analytics-events.md` — all 49 events.

**Acceptance criteria**

1. All **eleven** platform reports render with city, tier and cohort dimensions; the eleventh is `verification-sla`, and the `DECISION_LOG.md` entry recording the correction lands in this milestone (R-M12, `OQ-18.a`, `AC-EP18-02`).
2. **`City performance` exposes all five `C9.4` gates as columns** — ≥25 verified activated gyms with published plans · ≥5 localities · ≥90% complete profiles above the freshness threshold · verification SLA met for 2 consecutive weeks · one settlement cycle at zero variance — each showing its **measured value**, not a boolean alone (`F-18.13`, `E13.9`, `RSK-10`).
3. Every platform report runs inside `runElevated()`, and the audit row is written **before** the query executes, so an aborted query still leaves evidence of the attempt (`SR-10`, `AC-RPT-05.2`).
4. A **tenant-role token is refused** on every platform key — not silently scoped to that tenant, because a scoped answer looks like a successful answer (`AC-RPT-05.3`).
5. `reconciliation` reads M-096's runs and variances and trends against a **zero** target; `refunds-disputes` reads M-100 to M-102 (`KPI-26`).
6. All **49** `§C6` analytics events are schema-defined, and the CI check **fails the build** on any personal-data property; lat/lng precision is reduced at emission (`BR-DAT-06`, `AC-RPT-07.2`, `AC-RPT-07.3`).
7. Both derived funnels — marketplace and tenant activation — expose per-step drop-off.
8. Generated isolation specs exist for all eleven keys; the platform surface is asserted to refuse tenant tokens in both directions (R-5).
9. `axe-core` clean on `SCR-ADM-014`, including the city-gate panel, whose pass/fail state has a **non-colour** indicator.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `city-performance.report.int-spec.ts` | Integration | Five gate columns; measured values; a city at 24 gyms fails supply density |
| `elevated-report.runner.int-spec.ts` | Integration | Audit written before the query; tenant token refused not scoped |
| `platform-reports-accuracy.int-spec.ts` | Integration | All eleven totals re-sum to their drill-through row sets |
| `assert-no-personal-data-in-events.spec.ts` | CI policy | An event property named `email` fails the build |
| `funnel-dropoff.spec.ts` | Unit | Per-step drop-off arithmetic; lat/lng reduced at emission |
| `platform-analytics.axe-spec.ts` | a11y | Zero violations; gate state not conveyed by colour alone |

**Rollback plan** — Additive. `git revert` removes eleven registry entries and one admin route. The
`DECISION_LOG.md` entry is **not** reverted — a recorded decision survives the code that prompted it.
Reverting `City performance` would leave `C9.4` unmeasurable and therefore blocks M-120; the PR body
records that dependency explicitly.

**Notes** — The trap is a gate column that is a hand-maintained boolean. `RSK-10` scores 16 because
a technically successful launch can fail commercially, and the whole point of `E18.10` is that the
five gates are **read from the report** rather than asserted in a meeting. A boolean somebody ticks
is an assertion in a meeting wearing a column heading.

---

### M-108 — Async exports, `RL-EXPORT` governance, and the `BR-DAT-05` self-service tenant export

| Field | Value |
| :--- | :--- |
| **Sprint** | 13 |
| **Epic** | EP-18 · F-18.3, F-18.4, F-18.8, F-18.11 · T-18.18, T-18.19, T-18.20, T-18.22, T-18.27, T-18.31, T-18.32, T-18.34 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A tenant can take **all** of their data — members, memberships, payments, attendance —
without asking anyone for it, and no export can read a row belonging to anybody else.

**Depends on** — M-013, M-018, M-104, M-105, M-106.

**Unblocks** — M-117, M-119, M-120.

**Files**

- `apps/server/src/reporting/application/use-cases/request-export.use-case.ts` · `.int-spec.ts` — threshold evaluation, `202 Accepted`, `EXPORT_ALREADY_IN_PROGRESS` (409).
- `apps/server/src/reporting/jobs/export-generate.processor.ts` · `.spec.ts` — streamed generation to object storage in the **Mumbai region**; bounded per-tenant queue concurrency.
- `apps/server/src/reporting/jobs/export-link-expiry-sweep.processor.ts` · `.spec.ts` — `EXPORT_LINK_EXPIRED` (410) after the window.
- `apps/server/src/reporting/application/use-cases/export-tenant-dataset.use-case.ts` · `.int-spec.ts` — members, memberships, payments, attendance; **available to a `PAST_DUE` tenant**; row counts asserted against tenant-scoped counts.
- `apps/server/src/reporting/controllers/exports.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts` — `POST /v1/tenant/exports`, `GET /v1/tenant/exports/:id`, `POST /v1/me/export`.
- `apps/server/src/common/rate-limit/rl-export.tier.ts` · `.spec.ts` — **3/day, 5/hour, concurrency 1**, per tenant.
- `apps/server/src/reporting/application/services/export-audit.service.ts` · `.int-spec.ts` — actor, tenant, key and **row count** on every export.
- `apps/server/src/reporting/jobs/scheduled-delivery.processor.ts` · `.spec.ts` — daily / weekly / monthly, behind `rel.reporting.scheduled-delivery` registered **off** (`D-10` taken — R-M15).
- `apps/gym-dashboard/src/features/reports/async-export.tsx` · `apps/admin-dashboard/src/features/analytics/async-export.tsx` — queued state, progress, notification, time-limited download, expiry recovery.
- `apps/server/test/int/export-leakage.int-spec.ts` — **every** report key and **every** export endpoint attempted cross-tenant, both directions.
- `apps/server/test/load/noisy-neighbour.k6.js` — one tenant's maximal export while another tenant's checkout and search are measured.
- `docs/runbooks/export-stuck-in-queue.md` · `docs/runbooks/export-row-cap-reached.md`

**Acceptance criteria**

1. An export above the size threshold goes **asynchronous** with a `202`, a notification on completion and a **time-limited** download link; below it, synchronous within `NFR-PERF-06`'s 5 s (`FR-RPT-03`, `E13.4`).
2. With `rel.reporting.async-exports` **off**, an over-threshold request is refused with a message **naming the threshold and suggesting a narrower range** — never a timeout, never a silently truncated file.
3. **A tenant exports members, memberships, payments and attendance unaided** — no support ticket, no admin action (`BR-DAT-05`, `BAC-12`, `E13.8`).
4. The self-service export is available to a **`PAST_DUE`** tenant; arrears never hold a tenant's own data hostage (`T-18.19`, and consistent with `BR-TEN-06`, which never blocks check-in either).
5. Every export writes an audit row with actor, tenant, key and **row count**, and the row count is asserted against an independent tenant-scoped count (`E13.6`, `TR-12`).
6. `RL-EXPORT` enforces **3/day, 5/hour, concurrency 1** per tenant, and a per-tenant row cap; exceeding the cap returns a named error and a runbook link, not a truncated file (`SR-11`).
7. **The export leakage suite passes**: every report key and every export endpoint attempted cross-tenant in both directions is refused, and the exported row count matches the tenant-scoped count exactly (`E13.7`, `TR-12`, `E2E-11`).
8. `NFR-PERF-06` is measured server-side across the **ten heaviest** reports at 12-month ranges: each is either ≤ 5 s synchronous or asynchronous (`E13.4`, `T-18.32`).
9. The noisy-neighbour load test shows one tenant's maximal export does not breach `NFR-PERF-01` or `NFR-PERF-05` for another tenant (`SR-11`, `AC-EP18-28`).
10. `rel.reporting.scheduled-delivery` is registered **off**; schedules are **paused, not deleted**, and on restore there is no catch-up burst (`D-10`, R-M15).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `request-export.use-case.int-spec.ts` | Integration | Threshold; `202`; `409` on a second concurrent export; flag-off refusal names the threshold |
| `export-tenant-dataset.use-case.int-spec.ts` | Integration | Four datasets; `PAST_DUE` permitted; row counts match tenant-scoped counts |
| `export-leakage.int-spec.ts` | Isolation (`IS3`) | Every key and every export endpoint, both directions (`E13.7`) |
| `rl-export.tier.spec.ts` | Unit | 3/day, 5/hour, concurrency 1; row cap error is named |
| `report-perf.k6.js` | Load | Ten heaviest reports at 12 months: ≤ 5 s or async |
| `noisy-neighbour.k6.js` | Load | `NFR-PERF-01` and `NFR-PERF-05` hold for tenant B during tenant A's export |
| `export-link-expiry-sweep.processor.spec.ts` | Unit | `410` after the window; expiry recovery path offered |

**Rollback plan** — Two flags do the work: `rel.reporting.async-exports` off returns exports to
synchronous-or-refused, and `rel.reporting.scheduled-delivery` is already off. `git revert` removes
the export surface entirely — which would fail `BAC-12`, so a full revert after Sprint 13 closes is a
`§C10` conversation. Objects already in storage expire on their own sweep.

**Notes** — The trap is the export that is correct and enormous. A tenant with three years of
attendance asks for everything, the job serialises it into memory, and the worker dies — repeatedly,
because the retry does the same thing. Generation is **streamed** to object storage row by row, the
per-tenant queue concurrency is bounded, and the row cap exists so that a legitimate large tenant
gets a named error and a runbook rather than a silent failure. The second trap is the audit row
written **after** the export succeeds — an export that leaked and then crashed leaves no evidence.

---

## 4. Sprint 14 — notifications, templates, preferences and support · `EP-17`, `EP-20`

Sprint 14 carries Holi and Good Friday, a −10% capacity adjustment, the 1 April FY rollover, and the
only external regulator in the plan. `D-02` (referrals and wallet) is **taken** here; §9.2 records
where it went.

### M-109 — Four concrete channel adapters behind the Sprint-0 ports, and `notification_log`

| Field | Value |
| :--- | :--- |
| **Sprint** | 14 |
| **Epic** | EP-17 · F-17.1, F-17.8 · T-17.06, T-17.07, T-17.08, T-17.09, T-17.23, T-17.26, T-17.37 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Nine sprints of feature code that has been sending through a stub starts sending through
real vendors, and **every send records what it cost** — because `RSK-12` is a unit-economics risk,
not a delivery risk.

**Depends on** — M-010, M-018, M-021.

**Unblocks** — M-110, M-111, M-112, M-113, M-119.

**Files**

- `prisma/migrations/<ts>_create_notification_templates/migration.sql` — header `phase: expand · rls: GLOBAL-scope table, platform policy; overrides table is tenant-owned with its policy in this migration · grants: SELECT for gm_app, INSERT/UPDATE restricted to the platform role`. `notification_templates` (`key`, `channel`, `locale`, `version`, `body`, `variables jsonb`, `routing_class`, `dlt_template_id`, `dlt_approval_status`, `supersedes_version_id`, `published_at`) and `notification_template_overrides` keyed by tenant, **email and in-app only**.
- `prisma/migrations/<ts>_create_notification_log/migration.sql` — header `phase: expand · rls: HYBRID policy in this migration · grants: SELECT, INSERT only`. `notification_log` with the **hybrid** policy `tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id')::uuid`; columns for channel, provider, category, `template_version_id` (`ON DELETE RESTRICT`), status, attempt count, provider response, **`cost_minor`**, `currency`; dated retention sweep; monthly partitioning **pre-planned** at 100 M rows.
- `prisma/migrations/<ts>_create_notification_preferences/migration.sql` — `notification_preferences`, `push_subscriptions`, RLS and grants.
- `apps/server/src/notifications/infrastructure/adapters/` — `email.adapter.ts`, `india-sms.adapter.ts` (`A-19`), `in-app.adapter.ts`, `web-push.adapter.ts`, each `.int-spec.ts`; each **records `cost_minor` at send** and normalises the provider's status callback.
- `apps/server/src/notifications/controllers/webhooks/provider-status.webhook.controller.ts` · `.int-spec.ts` — signature-verified ingress.
- `apps/server/src/notifications/jobs/cost-rollup.processor.ts` · `.spec.ts` · `apps/server/src/notifications/controllers/admin-notifications.controller.ts` · `.isolation-spec.ts` — `GET /v1/admin/notifications/costs` per channel per provider per period from **recorded** cost.
- `tools/ci/assert-no-recipient-addresses-in-logs.ts` — greps the dispatch path for address-shaped literals (`BR-DAT-06`).
- `infra/terraform/modules/secrets/notification-vendors.tf` — vendor credentials in the managed secret store.

**Acceptance criteria**

1. All four channels are concrete adapters behind the **existing** M-021 ports; the port signatures are unchanged, and the Mailpit and CI-stub adapters still satisfy the same contract suite (`FR-NOTF-01`, `A-19`).
2. **Every send records `cost_minor` and `currency` at send time**; the cost report reads recorded values and never an estimate (`FR-NOTF-08`, `RSK-12`, `E14.8`).
3. `notification_log`'s **hybrid** RLS policy admits platform rows (`tenant_id IS NULL`) and the current tenant's rows and nothing else, proven in both directions (`ERD.md` line 1659, `BR-TEN-01`).
4. `template_version_id` is `ON DELETE RESTRICT`: a template version that has sent anything cannot be deleted, so a delivery log always resolves to the exact body that was sent.
5. Provider status callbacks are **signature-verified** and idempotent; a replayed callback does not double-count a cost.
6. **No recipient address, phone number or rendered body appears in any log line, span or analytics event.** The CI grep fails the build on an address-shaped literal in the dispatch path (`BR-DAT-06`, `AC-EP17-31`, `T-17.36`).
7. Tenant overrides exist for **email and in-app only**; there is no SMS override capability anywhere in the API or the UI, asserted structurally (`AC-NOTF-04.1`–`04.3`).
8. RLS policies and grants for all four tables ship in their own migrations (R-6); isolation coverage for the admin cost endpoint and the preference endpoints ships here (R-5, `T-17.08`).
9. Monthly partitioning of `notification_log` is **pre-planned and documented** with its trigger threshold at 100 M rows — planned, not yet applied.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `notification-port.contract-spec.ts` | Contract | All four concrete adapters and both stubs satisfy one contract |
| `cost-recording.int-spec.ts` | Integration | `cost_minor` recorded per send; replayed callback does not double-count |
| `notification-log-hybrid-rls.int-spec.ts` | Integration | Platform rows visible; other tenants' rows not; both directions |
| `template-version-restrict.int-spec.ts` | Integration | A sent template version cannot be deleted |
| `no-addresses-in-logs.spec.ts` | CI policy + Unit | **NEGATIVE:** an address-shaped literal in the dispatch path fails the build |
| `sms-override-absence.contract-spec.ts` | Contract | No SMS override operation exists in the OpenAPI document |
| `admin-notifications.controller.isolation-spec.ts` | Isolation (`IS3`) | Cross-tenant cost read refused; tenant token refused on the admin surface |

**Rollback plan** — Expand-phase; four new tables, no existing writer. `ops.notifications.dispatch`
is the kill-switch: pulling it stops all sending while the outbox keeps accumulating, so **nothing is
lost** and the backlog drains under the rate limit on restore. `git revert` returns the ports to
their stub adapters, which is a working state — that is why the ports were built in Sprint 0.

**Notes** — The trap is logging the recipient "just for debugging". `BR-DAT-06` is a privacy
obligation, the dispatch path is the one place in the product where every address in the system flows
through a single function, and a debug line there is a data-protection incident with a stack trace
attached. The CI grep is crude on purpose: it fails on anything that looks like an address, and the
false positives are cheap.

---

### M-110 — The **24-event baseline catalogue** wired to real triggers, and a dispatcher that survives

| Field | Value |
| :--- | :--- |
| **Sprint** | 14 |
| **Epic** | EP-17 · F-17.4, F-17.9, F-17.15 · T-17.15, T-17.19, T-17.20, T-17.21, T-17.22, T-17.24 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — All twenty-four baseline events — thirty-one distinct message types — fire on **real**
domain triggers through the outbox, and the dispatcher survives a worker restart, a Redis failover
and a poison message.

**Depends on** — M-018, M-109.

**Unblocks** — M-111, M-112, M-119.

**Files**

- `apps/server/src/notifications/domain/event-catalogue.ts` · `.spec.ts` — the twenty-four `B5.19` events and their thirty-one message types, each declaring its channel set, category and template key.
- `apps/server/src/notifications/jobs/dispatch.processor.ts` · `.spec.ts` — outbox drain, exponential backoff, **per-attempt** provider logging, idempotency on the **outbox event id**, restart and failover safety, a poison path with an alert.
- `apps/server/src/notifications/application/handlers/` — one handler per publishing module, each importing **nothing** from the publisher beyond its event contract (`FolderStructure.md` §3.4.2).
- `apps/server/src/notifications/jobs/renewal-reminder-batch.processor.ts` · `.spec.ts` — `BR-MEM-11` reminders **batched per tenant per day at 09:00 gym-time** through the M-063 primitive.
- `apps/server/src/notifications/jobs/bulk-send.processor.ts` · `.spec.ts` — `GymCeasedOperating`: 400 recipients inside the `BR-MEM-14` **24-hour SLA**, per-recipient limits respected, an SLA monitor alerting on any undelivered member.
- `apps/server/src/notifications/application/services/non-suppressible.registry.ts` · `.spec.ts` — duplicate payment, dispute deadline, bank-account change, payout initiated, KYC decision.
- `apps/server/src/notifications/controllers/notification-centre.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts` — read/unread and read-all, served through the single `useLiveCounters()` polling seam (`A-08`).
- `apps/server/src/iam/application/services/otp-send-limiter.ts` · `.spec.ts` — per phone, per IP and per tenant; `otp_per_registration_ratio` metric; the `AC-AUTH-01.5` email fallback as the degradation.
- `infra/monitoring/alerts/notification-cost-per-membership.yaml`

**Acceptance criteria**

1. **All 24 baseline events fire on real triggers** across all four channels; a table-driven fixture exists per message type and none is stubbed (`B5.19`, `E14.1`).
2. Dispatch is idempotent on the **outbox event id**: a duplicate outbox delivery sends once, proven under a simulated Redis failover (`TR-08`, `TR-20`, `TR-25`).
3. A worker restart mid-drain loses nothing and duplicates nothing; the test kills the worker between provider call and status write and asserts exactly one delivery.
4. A poison message is parked with an alert after its backoff budget; it never blocks the queue (`FR-NOTF-04`).
5. `BR-MEM-11` renewal reminders are **batched per tenant per day at 09:00 gym-time**; a same-day re-run sends nothing (`BR-MEM-11-P1`, `T-17.35`).
6. The `GymCeasedOperating` bulk path delivers to 400 recipients inside the **24-hour** `BR-MEM-14` SLA with per-recipient limits respected, and alerts on any undelivered member (`AC-NOTF-08.2`).
7. The five non-suppressible notices are wired and **cannot** be suppressed by preference, quiet hours or cap degradation — asserted individually (`BR-PAY-07`, `BR-REF-08`, `BR-GYM-06`).
8. OTP sends are limited per phone, per IP and per tenant, and `otp_per_registration_ratio` is emitted and alerted — the India cost amplifier `RSK-12` names.
9. The notification centre is served through `useLiveCounters()` and renders `LastUpdatedIndicator`; no other polling seam is introduced (`A-08`, `FolderStructure.md` §5.1).
10. Isolation coverage for the notification-centre endpoints ships here (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `event-catalogue.spec.ts` | Unit | 24 events, 31 message types; each declares channel set, category, template key |
| `dispatch-resilience.int-spec.ts` | Integration | Restart mid-drain; Redis failover; duplicate outbox delivery; poison path (`T-17.34`) |
| `renewal-reminder-batch.processor.spec.ts` | Unit | Five sends at 09:00 IST; same-day re-run sends nothing |
| `bulk-send.processor.spec.ts` | Unit | 400 recipients inside 24 h; undelivered member alerts |
| `non-suppressible.registry.spec.ts` | Unit | **NEGATIVE:** each of the five survives preference off, quiet hours and cap degradation |
| `otp-send-limiter.spec.ts` | Unit | Per-phone, per-IP, per-tenant limits; email fallback |
| `notification-centre.controller.isolation-spec.ts` | Isolation (`IS3`) | Cross-tenant and cross-user centre reads refused |

**Rollback plan** — `ops.notifications.dispatch` is the kill-switch and is the correct first move
for any delivery incident: the outbox keeps accumulating and the in-app centre keeps recording, so a
member logging in still sees what happened. `git revert` unwires the handlers; the outbox rows remain
and drain when re-wired.

**Notes** — The trap is a fixed UTC cron for the 09:00 reminder batch. `0 9 * * *` UTC is 14:30 IST
— the middle of the afternoon, after the member has already forgotten. R-9 exists for this, and it
will look correct in every test written by someone reading timestamps in UTC. The second trap is
sending the reminder per membership rather than per tenant per day: a member with two memberships at
one gym gets two messages, and `BR-MEM-11` says one.

### M-111 — Suppression **at send time**, quiet hours in the recipient's timezone, per-category limits

| Field | Value |
| :--- | :--- |
| **Sprint** | 14 |
| **Epic** | EP-17 · F-17.2, F-17.5, F-17.6, F-17.13, F-17.14 · T-17.13, T-17.16, T-17.17, T-17.18, T-17.27, T-17.31 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A preference is evaluated **per message, at dispatch** — never at list-build — so that a
member who opts out at 10:00 is not still receiving a campaign built at 09:00.

**Depends on** — M-109, M-110.

**Unblocks** — M-112, M-113, M-119.

**Files**

- `apps/server/src/notifications/domain/category.ts` · `.spec.ts` — three categories; **transactional is non-opt-out**, enforced at the pipe **and** by constraint.
- `apps/server/src/notifications/application/services/suppression.evaluator.ts` · `.int-spec.ts` — invoked **inside** the dispatcher, per message, per recipient; never at list build.
- `apps/server/src/notifications/domain/quiet-hours.ts` · `.spec.ts` — evaluated in the **recipient's** IANA timezone; the outcome is **deferral**, not suppression.
- `apps/server/src/notifications/jobs/quiet-hours-release.processor.ts` · `.spec.ts`
- `apps/server/src/notifications/application/services/per-recipient-rate-limiter.ts` · `.spec.ts` — per recipient **per category**, in the dispatcher.
- `apps/server/src/notifications/application/services/tenant-cap.service.ts` · `.spec.ts` — per-tenant monthly caps that **degrade the channel to email** rather than dropping the message; the routing policy is a **configuration table**, not a branch (`RSK-12`).
- `apps/server/src/notifications/jobs/cap-window-reset.processor.ts` · `.spec.ts`
- `apps/server/src/notifications/application/use-cases/unsubscribe-by-token.use-case.ts` · `.int-spec.ts` — a **signed, single-purpose** token; `GET /unsubscribe/:token` works **logged out**.
- `apps/server/src/notifications/controllers/preferences.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts`
- `apps/customer-web/src/app/(account)/notifications/page.tsx` — `SCR-WEB-014`: the channel × category matrix with transactional rows **visibly non-editable and explained**.
- `apps/customer-web/src/app/unsubscribe/[token]/page.tsx` — confirmation plus a re-subscribe affordance.
- `packages/ui/src/notifications/NotificationCentre.tsx` — shared across all three surfaces.
- `docs/FEATURE_FLAGS.md` — `rel.notifications.quiet-hours`, `rel.notifications.web-push`.

**Acceptance criteria**

1. **Suppression happens at send time.** Disabling marketing email and then running a campaign that was list-built *before* the change suppresses the message, and the suppression is recorded on the log row (`AC-USER-01.1`, `E14.2`).
2. With **every** optional channel disabled, the T−3 renewal reminder still arrives, because it is transactional and transactional is non-opt-out at the pipe and by constraint (`FR-NOTF-02`, `E14.3`).
3. Quiet hours are evaluated in the **recipient's** timezone and **defer** rather than suppress; a message deferred at 23:00 IST is released the following morning by `notification.quiet-hours-release` (`FR-NOTF-05`, `E14.4`).
4. Transactional messages are **never** subject to quiet hours in either flag position — OTP, payment failure, membership activation and gym closure are unaffected.
5. Per-recipient per-category rate limiting is applied **in the dispatcher**, so a backlog draining after a kill-switch restore does not deliver forty messages in ninety seconds (`FR-NOTF-06`, `ops.notifications.dispatch` restore behaviour).
6. A tenant at its monthly cap has its channel **degraded to email**, not its message dropped; the routing policy is read from a configuration table and changes without a deploy (`RSK-12`, `AC-EP17-20`).
7. **Unsubscribe from an email footer works without logging in**, through a signed single-purpose token, and offers a re-subscribe affordance (`AC-USER-01.3`, `E14.5`).
8. `SCR-WEB-014` renders transactional rows as visibly non-editable **with an explanation**, not as disabled checkboxes with no reason (`NFR-USE-01`).
9. Isolation coverage for the preference endpoints ships here; the unsubscribe token is scoped to one recipient and one category and is single-purpose (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `suppression.evaluator.int-spec.ts` | Integration | Preference changed after list build still suppresses (`E14.2`) |
| `notification-matrix.int-spec.ts` | Integration | 24 events × 4 channels × 3 categories × preference states × quiet hours, table-driven (`T-17.32`) |
| `quiet-hours.spec.ts` | Unit | Recipient timezone; deferral not suppression; transactional exempt in both flag positions |
| `per-recipient-rate-limiter.spec.ts` | Unit | Backlog drain respects the per-category limit |
| `tenant-cap.service.spec.ts` | Unit | Degradation to email; policy read from configuration |
| `unsubscribe-by-token.use-case.int-spec.ts` | Integration | Logged-out unsubscribe; token single-purpose; replay refused |
| `preferences.controller.isolation-spec.ts` | Isolation (`IS3`) | Cross-user and cross-tenant preference reads and writes refused |

**Rollback plan** — `rel.notifications.quiet-hours` off returns to sender-schedule delivery with
transactional behaviour unchanged; `rel.notifications.web-push` off removes push from the matrix and
falls back to email-then-in-app. `git revert` returns to unconditional sending, which is a
**regulatory and reputational** regression, not a neutral one — the PR body says so and names the
Product Manager as the approver.

**Notes** — The trap is the campaign list built at 09:00 and sent at 11:00. Every implementation
that filters at list-build time passes its own tests, because the tests build and send in the same
breath. `AC-USER-01.1` exists because the two-hour gap is where the complaint comes from, and the
only defence is that the evaluator lives inside the dispatcher and takes a single recipient.

---

### M-112 — The TRAI **DLT approval-state machine**, where the previous approved version keeps sending

| Field | Value |
| :--- | :--- |
| **Sprint** | 14 |
| **Epic** | EP-17 · F-17.3, F-17.10, F-17.12 · T-17.10, T-17.11, T-17.12, T-17.14, T-17.25, T-17.28 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Editing an India SMS template starts an approval process **without stopping the messages**,
because the dispatcher resolves the latest **`APPROVED`** version and not the latest version.

**Depends on** — M-013, M-109, M-110.

**Unblocks** — M-113, M-116, M-119.

**Files**

- `apps/server/src/notifications/domain/sms-template-approval.state-machine.ts` · `.spec.ts` — `PENDING_DLT_APPROVAL → APPROVED / REJECTED`; version resolution walks `supersedes_version_id` to the latest `APPROVED`.
- `apps/server/src/notifications/domain/template-version.resolver.ts` · `.spec.ts` — **the dispatcher's only entry point** to a template body.
- `apps/server/src/notifications/domain/variable-set.validator.ts` · `.spec.ts` — compares a save against the **registered DLT variable set** and refuses a divergent save; `routing_class` guard refuses a `PROMOTIONAL`-classed body for a `TRANSACTIONAL` send.
- `apps/server/src/notifications/domain/notification.errors.ts` — `TEMPLATE_PENDING_DLT_APPROVAL` (409) whose message says *the previous approved version continues to send*; `TEMPLATE_VERSION_CONFLICT` (409) on a concurrent edit.
- `apps/server/src/notifications/jobs/dlt-approval-poll.processor.ts` · `.spec.ts` — daily; reconciles approval state with the vendor; stores operator rejection reasons; **alerts on any template pending beyond the stated lead time**.
- `apps/server/src/notifications/application/use-cases/publish-template.use-case.ts` · `.int-spec.ts` — versioned, previewable with sample data, revertible; email and in-app publish **immediately**, SMS enters approval.
- `apps/admin-dashboard/src/features/configuration/templates/` — editor with preview, version history, diff and revert; **`dlt_template_id`, approval state and expected lead time visible on every SMS row**; the pending-versus-sending distinction made explicit.
- `docs/features/dlt-approval.md` · `docs/runbooks/template-stuck-in-dlt-approval.md` · `docs/runbooks/dlt-operator-rejection.md`
- `docs/KNOWN_LIMITATIONS.md` — **`FR-NOTF-03` is partially unmet by law, not by design**, for the SMS channel.

**Acceptance criteria**

1. **Every India SMS template carries a `dlt_template_id` and an approval state**; a template without one cannot be published (`BLK-03` conflict 5, `E14.6`).
2. Editing an approved SMS template creates a new version at `PENDING_DLT_APPROVAL`, and **the previous approved version keeps sending** — asserted by a test that edits and then dispatches (`REG-05`, `E14.6`).
3. **No SMS is dispatched on an unapproved template**, proven by a negative test against a never-approved template (`E14.7`).
4. The dispatcher's **only** path to a body is `TemplateVersionResolver`, which returns the latest `APPROVED`; a structure test forbids any other module reading `notification_templates.body`.
5. A save whose variable set diverges from the registered DLT variable set is **refused** with a named error — because a divergent variable set means the operator will reject the template weeks later (`AC-EP17-11`).
6. A `PROMOTIONAL`-classed body cannot be used for a `TRANSACTIONAL` send; the guard is on the send path, not only on the editor (`AC-EP17-14`).
7. Concurrent edits produce `TEMPLATE_VERSION_CONFLICT` (409), never a lost update.
8. `notification.dlt-approval-poll` reconciles daily, stores operator rejection reasons verbatim, and **alerts on any template pending beyond the stated lead time** — the early-warning `REG-05` requires.
9. Email and in-app templates remain **editable without deployment and publish immediately**; the SMS limitation is recorded in `KNOWN_LIMITATIONS.md` as a requirement partially unmet **by law** (`FR-NOTF-03`, `T-17.41`).
10. Every template create, edit, publish, DLT transition, tenant override and preference change is audited with actor, reason and before/after (`BR-DAT-01`, `NFR-PRV-02`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `sms-template-approval.state-machine.spec.ts` | Unit | The three states and their legal edges; rejection stores the operator reason |
| `template-version.resolver.spec.ts` | Unit | Latest `APPROVED` with a pending version present |
| `dlt-negative.int-spec.ts` | Integration | **NEGATIVE:** no send on a never-approved template; divergent variable set refused; promotional body refused for a transactional send (`T-17.33`) |
| `edit-keeps-sending.int-spec.ts` | Integration | Edit → pending → previous approved version still dispatches (`E14.6`) |
| `template-body-access.structure-spec.ts` | Structure | Only the resolver reads `notification_templates.body` |
| `dlt-approval-poll.processor.spec.ts` | Unit | Daily reconciliation; pending-beyond-lead-time alert |
| `template-audit.int-spec.ts` | Integration | Six audited actions with before/after |

**Rollback plan** — `git revert` returns SMS templates to immediate publication, which would
**dispatch on unapproved templates** — a regulatory breach, not a degradation. The revert is
therefore gated on disabling the SMS channel first (`rel.notifications.web-push` and the routing
policy table give email-only delivery), and the PR body states that order explicitly.

**Notes** — The trap is resolving "the latest version". It is one word different from "the latest
approved version", it passes every test written before an approval is pending, and the first time it
matters is the first time somebody fixes a typo — at which point every SMS on that template starts
failing at the operator, silently, because DLT rejections are asynchronous. The second trap is
treating the lead time as a code problem: it is a **data** dependency with an external regulator,
which is why `T-17.05` submits all sixteen templates in **Sprint 8**, six sprints before this
milestone needs them.

### M-113 — Support ticketing with SLA timers that survive a restart, the help centre, `SCR-ADM-013`

| Field | Value |
| :--- | :--- |
| **Sprint** | 14 |
| **Epic** | EP-20 · F-20.1 … F-20.6, F-20.15 … F-20.20, F-20.23 · T-20.01 … T-20.13, T-20.21, T-20.22, T-20.23, T-20.25, T-20.26, T-20.27 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A ticket opened from an order carries its own context, its SLA clock is derived from
stored timestamps rather than held in memory, and the clock **pauses** while the platform is waiting
on the customer.

**Depends on** — M-010, M-013, M-018, M-110, M-111.

**Unblocks** — M-107 (`support-load` data), M-119.

**Files**

- `prisma/migrations/<ts>_create_support_tickets/migration.sql` — header `phase: expand · rls: nullable-tenant policy in this migration · grants: SELECT, INSERT, restricted UPDATE (status, priority, assignee_id, first_responded_at, resolved_at) only`. `support_tickets` (category, priority, five-state `status`, `first_responded_at`, `resolved_at`, the `WAITING_ON_CUSTOMER` interval log, linked-entity references, **nullable `tenant_id`**) and `ticket_messages` (immutable, `SupportTicket`-owned).
- Same migration: the **nullable-tenant RLS policy** `tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id')::uuid`, **plus a requester gate on tenant-null rows** so a platform-scoped ticket is visible only to its requester and to agents (`F-20.15`).
- `apps/server/src/support/domain/ticket.aggregate.ts` · `.spec.ts` · `ticket-status.state-machine.ts` · `.spec.ts` — the five states with a guarded transition table and a terminal `CLOSED`.
- `apps/server/src/support/domain/sla.ts` · `.spec.ts` — per-priority first-response and resolution targets **as configuration**; business-hours arithmetic in an explicit IANA zone; the clock **paused** across `WAITING_ON_CUSTOMER` intervals; every value **derived from stored timestamps**.
- `apps/server/src/support/jobs/sla-evaluate.processor.ts` · `.spec.ts` — every 5 minutes; breach detection; **once-only** escalation through the outbox; **no state change on breach**; idempotent under the distributed lock.
- `apps/server/src/support/application/services/contextual-creation.service.ts` · `.spec.ts` — order, membership, payment and check-in reference sets held as **configuration**, not a `switch`.
- `apps/server/src/support/application/services/customer-context.aggregator.ts` · `.int-spec.ts` — assembled through the **named audited elevation**, never a raw cross-tenant join (`SR-10`).
- `apps/server/src/support/controllers/support-tickets.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts` · `help-articles.controller.ts` — the public `GET /help/articles` and `/help/articles/:slug` under `RL-PUBLIC`, `CDN-3600`, purged on write.
- `apps/server/src/support/infrastructure/attachment.service.ts` · `.int-spec.ts` — type allow-list, size cap, **virus scan**, Mumbai-region storage, short-lived signed retrieval, filename treated as **untrusted user content**.
- `apps/admin-dashboard/src/routes/support-console.route.tsx` — `SCR-ADM-013`, with the impersonation entry point, its reason prompt and its banner.
- `apps/customer-web/src/app/(account)/support/page.tsx` — `SCR-WEB-017`, **deflection-first**: article search rendered before the ticket form.
- `apps/server/test/contract/wallet-absence.contract-spec.ts` — no balance column, no transfer endpoint, no withdrawal endpoint (`T-20.21`, `BR-WAL-01-N1`).
- `docs/features/wallet-seam.md` — the ordering rule specified now and built never in Phase 1.

**Acceptance criteria**

1. A ticket opened from an order **auto-attaches** the documented reference set — order, invoice, payment — and the reference set is configuration, so adding a fifth source is a data change (`FR-SUP-02`, `E14.9`).
2. **SLA timers survive a worker restart**: every figure is derived from stored timestamps, so restarting mid-breach-window changes nothing (`F-20.16`, `E14.9`).
3. The SLA clock **pauses** across `WAITING_ON_CUSTOMER` intervals and resumes on the customer's reply; business-hours arithmetic uses `Asia/Kolkata` explicitly (`FR-SUP-05`, `TR-24`).
4. Breach detection escalates **once only** through the outbox and **changes no ticket state** — a breached ticket is still `OPEN`, because a breach is a fact about the clock, not about the work (`AC-EP20-10`, `KPI-25`).
5. The five-state lifecycle is a guarded transition table with registry error codes on refusal and a terminal `CLOSED`; every transition is audited (`FR-SUP-04`, `AC-EP20-05`).
6. The nullable-tenant RLS policy admits platform-scoped tickets **and** gates them by requester; both directions are tested, including the tenant-null case (`F-20.15`, `AC-EP20-18`).
7. **Internal notes are a distinct message kind and are never returned to a customer** on any endpoint, asserted structurally and by test (`SR-06`).
8. Customer context is assembled through the named audited elevation; a raw cross-tenant join in `support/` fails `dependency-cruiser` (`SR-10`).
9. Attachments are type-restricted, size-capped, **virus-scanned**, stored in the Mumbai region, retrieved through short-lived signed URLs, and the filename is escaped as untrusted content (`REG-06`, `SR-17`).
10. The **ten** help articles of `§4.4` are seeded with **reason-code deep links** for all five `C4.8` families; the entry point is **deflection-first** and the deflection is recorded as an analytics event carrying **no personal data** (`FR-SUP-06`, `OBJ-10`, `A6.5`).
11. Impersonation from the console requires a reason, is time-boxed to 30 minutes, marks every action `impersonated_by`, and **refuses financial mutations** (`BR-DAT-02`, `SR-06`, `F-20.20`).
12. **Wallet and referrals have no code**: the absence contract test proves no balance column, no transfer endpoint and no withdrawal endpoint exist (`D-02` taken — R-M15, `BR-WAL-01-N1`).
13. Isolation coverage for **every** `/support/*` route including the tenant-null case ships here (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `sla.spec.ts` | Unit | Per-priority targets; business hours in IST; pause across `WAITING_ON_CUSTOMER` |
| `sla-restart.int-spec.ts` | Integration | Worker restart mid-window changes no computed figure (`T-20.26`) |
| `sla-evaluate.processor.spec.ts` | Unit | Once-only escalation; no state change on breach; lock idempotency |
| `ticket-status.state-machine.spec.ts` | Unit | Five states; refused transitions carry registry codes; `CLOSED` terminal |
| `support-isolation.int-spec.ts` | Isolation (`IS3`) | Every `/support/*` route both directions **including tenant-null**; internal notes never returned (`T-20.27`) |
| `attachment.service.int-spec.ts` | Integration | Allow-list; size cap; scan; signed retrieval; filename escaped |
| `wallet-absence.contract-spec.ts` | Contract | **NEGATIVE:** no balance column, no transfer, no withdrawal |

**Rollback plan** — Expand-phase, two new tables plus `help_articles`. `rel.support.help-centre`
off routes every entry point straight to ticket creation — a measurable cost in tickets per tenant,
recorded against `A6.5`, not an outage. `rel.support.satisfaction-rating` is off by default (`D-01`
partial). `git revert` removes the console and the member surface; tickets already open are retained
and are worked through the API.

**Notes** — The trap is an SLA timer held in a scheduler. It is simpler, it is faster, and it is
wrong the first time a worker restarts — which will happen during the deploy that fixes something
else. Every SLA figure is **derived** from `created_at`, `first_responded_at`, `resolved_at` and the
interval log; the evaluator only reads. The second trap is the `WAITING_ON_CUSTOMER` pause being
implemented as a boolean rather than an interval log: a ticket that bounces four times needs four
intervals subtracted, and a boolean can only remember the last one.

---

## 5. Sprint 15 — admin configuration, flags, taxonomy and the audit explorer · `EP-19`

Milestone **M5** is declared at the end of this sprint: feature-complete in staging, every
`M`-priority `FR-` delivered or explicitly descoped with a recorded `§C10` decision. Sprint 16 has no
feature capacity, so anything unfinished here is descoped, never carried.

### M-114 — **One** commission resolver — global < tier < tenant — with the 0 bps floor

| Field | Value |
| :--- | :--- |
| **Sprint** | 15 |
| **Epic** | EP-19 · F-19.3, F-19.14, F-19.15, F-19.16 · T-19.01, T-19.03, T-19.04, T-19.07, T-19.08, T-19.37 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — The rate a tenant is **shown** and the rate a tenant is **charged** come from the same
function, and a tier delta can never drive the effective rate below zero.

**Depends on** — M-088, M-089, M-101.

**Unblocks** — M-115, M-116, M-117, M-119.

**Files**

- `prisma/migrations/<ts>_create_commission_rules/migration.sql` — header `phase: expand · rls: platform-scoped table, policy in this migration · grants: SELECT, INSERT only — append-only, superseded never edited`. `commission_rules` (`level ∈ GLOBAL|TIER|TENANT`, `tier_id?`, `tenant_id?`, `kind ∈ STANDARD|RENEWAL`, `rate_bps?`, `delta_bps?`, `valid_from`, `valid_to`, `actor_id`, `reason`) with an **exclusion constraint preventing overlapping windows at the same level**.
- `packages/utils/src/money/basis-points.ts` · `.spec.ts` — `BasisPoints`: integer, `[0, 10000]`, **cannot be constructed negative**, arithmetic returns `BasisPoints`. Shared, so `ledger/` and `admin/` cannot hold two definitions (`CR-02`).
- `apps/server/src/admin/application/services/resolve-commission.ts` · `.spec.ts` · `.int-spec.ts` — `resolveCommission(tenantId, at, kind)`: global → tier (**delta converted to absolute here**) → tenant override (**absolute, replaces**), clamped to the 0 bps floor, returning `{ rate_bps, source, rule_id, effective_from, effective_to, set_by_actor, reason }`.
- `apps/server/src/admin/jobs/commission-override-expire.processor.ts` · `.spec.ts` — daily; reverts expired overrides; emits outbox events to tenant and Finance; audits the reversion with the **system** actor and the expiry as the reason.
- `.dependency-cruiser.js` (modified) — rule `settlements-does-not-resolve-precedence`: `settlements/` may not compute precedence itself.
- `infra/monitoring/alerts/commission-rate-clamped.yaml` — `gym.commission.rate_clamped.count{tenant_id, tier}`; **a clamp means the configuration is wrong, not the sale**.
- `docs/features/commission-precedence.md` — the resolver, the floor, the renewal sequence, worked India examples.
- `docs/DECISION_LOG.md` — `CR-02` and `CR-03` recorded; `docs/KNOWN_LIMITATIONS.md` — `KL-006` closed (R-M14).

**Acceptance criteria**

1. **Display and settlement call the same resolver** — proven by a test that mocks the resolver once and observes both surfaces change (`E15.5`, `AC-ADMN-01.2`).
2. Precedence is `global < tier < tenant`; a **tier delta is converted to absolute bps at resolution**, and a tenant override is absolute and **replaces** rather than stacking (`FR-ADMN-03`).
3. `BasisPoints` cannot hold a negative value; a −1.5 percentage-point tier delta against a global 12% resolves to **1050 bps**, not to 1050 percent and not to −150 (`CR-02`, `KL-006`(a)).
4. The effective rate is **clamped to a 0 bps floor**, the clamp emits `gym.commission.rate_clamped.count` and **alerts**, because a clamp means somebody configured a delta larger than the base (`E11.9`, `AC-EP19-06`).
5. The resolver returns a **source string** — level, actor, date, reason and expiry — and the tenant detail screen renders it verbatim (`AC-ADMN-01.2`, `E15.2`).
6. `commission_rules` is **append-only**: a superseded rule is never edited, the exclusion constraint forbids overlapping windows at one level, and `append-only-grants` asserts the absent `UPDATE`/`DELETE` privileges.
7. **A historical statement still carries the rate that applied at the time.** Changing an override and reopening last month's statement shows the original rate, because M-089 froze it on the order (`AC-ADMN-01.4`, `E15.4`, `E11.10`).
8. An expired override **reverts automatically** with a notification to tenant and Finance, audited with the system actor (`AC-ADMN-01.3`, `E15.3`).
9. The renewal sequence is read from `orders.renewal_sequence`, persisted at sale by M-088, and is **never recomputed** here (`CR-03`, R-M14).
10. `dependency-cruiser` forbids `settlements/` from computing precedence itself.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `basis-points.spec.ts` | Unit | `[0, 10000]`; negative construction is a type and runtime error; pp-delta conversion |
| `resolve-commission.spec.ts` | Unit | The full precedence matrix; the clamp; the source string |
| `commission-precedence.int-spec.ts` | Integration | Global only · tier delta · tenant override · expired override · overlapping windows · negative-delta clamp · renewal sequence 0/1/2/n · `DIRECT` origin (`T-19.37`) |
| `mock-one-observe-both.int-spec.ts` | Integration | Mocking the resolver changes display **and** settlement (`E15.5`) |
| `historical-rate-immutability.int-spec.ts` | Integration | **NEGATIVE:** an override change does not alter a past statement |
| `commission-override-expire.processor.spec.ts` | Unit | Automatic reversion; both notifications; system-actor audit |
| `commission-rules-grants.int-spec.ts` | Integration | Append-only; overlapping windows refused by the exclusion constraint |

**Rollback plan** — Expand-phase; a new append-only table. `git revert` returns commission
resolution to the M-089 order-frozen rate with no administration surface, which is a **working**
state: historical statements are unaffected because the rate lives on the order. Rules already
written are retained as records.

**Notes** — The trap is percentage points. A tier expressed as "−1.5 percentage points" against a
global 12% is **1050 bps**, and a codebase that mixes percent, percentage-point and bps in one
resolver will be wrong by a factor of 100 somewhere, on a figure nobody reads until a tenant does.
`BasisPoints` exists once, in `packages/utils`, so `ledger/` and `admin/` cannot disagree. The second
trap is the clamp being silent: a clamped rate produces a **plausible** invoice, and the only signal
that the configuration is wrong is the metric.

### M-115 — Tax profiles append-only, the KYC checklist, taxonomy that deprecates and never deletes

| Field | Value |
| :--- | :--- |
| **Sprint** | 15 |
| **Epic** | EP-19 · F-19.5, F-19.6, F-19.7, F-19.17, F-19.19 · T-19.10, T-19.11, T-19.12, T-19.13, T-19.14, T-19.15, T-19.16, T-19.36 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Every configurable value in the product changes **without a deployment**, every change
states a reason and previews its blast radius, and no configuration change can ever rewrite what an
old invoice or an old listing meant.

**Depends on** — M-058, M-059, M-013, M-114.

**Unblocks** — M-116, M-117, M-119, M-120.

**Files**

- `prisma/migrations/<ts>_create_tax_profiles/migration.sql` — header `phase: expand · rls: platform-scoped, policy in this migration · grants: SELECT, INSERT only — versioned, superseded never edited`. Components and rates, inclusive/exclusive, rounding mode, place of supply, SAC/HSN, required invoice fields, **and `fy_start_month` as a field**.
- `prisma/migrations/<ts>_create_kyc_checklists/migration.sql` — document types, mandatory/conditional/advisory flags, validity rules, **format validators as configuration** (PAN `AAAAA9999A`, GSTIN state code), and the India ten-row seed with the Aadhaar-avoidance default.
- `prisma/migrations/<ts>_create_taxonomy/migration.sql` — amenities, categories, cities, localities and **all five `C4.8` reason-code families**, each with `deprecated_at` and **no `DELETE` grant**.
- `apps/server/src/admin/application/services/configuration.registry.ts` · `.spec.ts` — one declaration per configurable value: key, type, default, owner role, **blast-radius query**, Zod schema, surface list.
- `tools/ci/assert-no-constant-duplicates-registry-key.ts` — a constant that duplicates a registry key **fails the build**; every key has an owner and a schema (`T-19.14`).
- `apps/server/src/admin/guards/requires-reason.decorator.ts` · `.spec.ts` — `422 REASON_REQUIRED`.
- `apps/server/src/admin/application/queries/preview-impact.query.ts` · `.int-spec.ts` — `previewImpact(key, newValue)` returning the **affected-entity count per surface**.
- `apps/server/src/admin/application/use-cases/write-config.use-case.ts` · `.int-spec.ts` — the config row and its `audit_log` row **commit together**, then the Redis evaluation-cache entry is invalidated; propagation bounded at **60 s** by TTL.
- `apps/server/src/admin/infrastructure/cdn-purge.service.ts` · `.spec.ts` — taxonomy writes purge the CDN.
- `apps/admin-dashboard/src/features/configuration/{commission,subscription,tax,kyc,taxonomy,flags,templates}/` — seven surfaces over **one registry-driven form harness**, each with the reason guard and the impact preview.
- `docs/features/configuration-registry.md` · `docs/runbooks/config-change-blast-radius-exceeded.md`

**Acceptance criteria**

1. **Tax profiles are append-only and versioned**: a rate change writes a new version with a validity window; the superseded row is never edited, so an invoice issued last year still resolves to the profile that priced it (`FR-ADMN-05`, `BR-PAY-11`).
2. **`fy_start_month` is a field, not a constant.** Setting it to April produces the Indian behaviour; the January↔April round trip is a test, and the invoice sequence follows it without a deploy (`BLK-03` conflict 4, `E15.7`, `AC-INV-01.3`).
3. KYC checklists are configuration per country, including **format validators as data** — the PAN pattern and the GSTIN state-code rule are rows, not regexes in code (`FR-ADMN-06`, `LAUNCH_MARKET_INDIA.md` §6).
4. **Taxonomy deprecates and never deletes.** There is no `DELETE` grant on any taxonomy table; a deprecated amenity disappears from pickers, remains resolvable on every gym that already carries it, and every write purges the CDN (`FR-ADMN-07`).
5. All **five** `C4.8` reason-code families are managed here — check-in denial, refund, verification rejection, moderation and override reasons — with the same deprecate-never-delete semantics.
6. **Every configurable value changes without a deployment** and is verified on its surfaces **within 60 seconds**: tax profile, KYC checklist, taxonomy, tiers, flags, ranking weights and thresholds (`NFR-MNT-07`, `E15.6`).
7. Every administrative write **requires a reason** (`422 REASON_REQUIRED`) and shows a **blast-radius preview** counting affected entities per surface before it commits (`FR-ADMN-02`, `AC-ADMN-03.2`).
8. The config row and its audit row **commit in one transaction**; the cache is invalidated after commit, never before (`AC-ADMN-03.4`).
9. A constant that duplicates a registry key **fails CI**; every registry key has an owner role and a Zod schema (`AC-ADMN-03.5`, `AC-EP19-36`).
10. RLS and grants ship in each migration (R-6); isolation coverage for the tenant-visible configuration reads ships here (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `tax-profile-versioning.int-spec.ts` | Integration | Append-only; a historical invoice resolves to its original profile |
| `fy-start-month-roundtrip.int-spec.ts` | Integration | January↔April without a deploy; invoice sequence follows (`E15.7`) |
| `taxonomy-deprecate.int-spec.ts` | Integration | **NEGATIVE:** no `DELETE` grant; deprecated value still resolves on existing rows; CDN purged |
| `configuration-without-deployment.int-spec.ts` | Integration | Every registry key changed at runtime and verified on its surfaces within 60 s (`T-19.36`) |
| `requires-reason.spec.ts` | Unit | `422 REASON_REQUIRED` on every admin write |
| `preview-impact.query.int-spec.ts` | Integration | Affected-entity counts per surface match a direct count |
| `assert-no-constant-duplicates.spec.ts` | CI policy | A constant duplicating a key fails the build |

**Rollback plan** — Expand-phase; three new configuration tables that are read with a
seeded-default fallback, so a revert leaves the product running on its seeded India profile. `git
revert` removes the administration surface and returns configuration to migration-time seeds — a
degradation of operability, not of correctness. **Tax-profile versions already written are retained**
because invoices reference them.

**Notes** — The trap is `UPDATE tax_profiles SET rate = 18`. It is one statement, it looks like the
obvious way to change a rate, and it silently rewrites the tax basis of every invoice ever issued
under that profile. Append-only with a validity window costs one extra row per change and is the
difference between a configuration system and a time machine. The second trap is deleting a
taxonomy value that is "obviously unused" — it is referenced by a gym profile, a denial reason, or an
audit row from eight months ago, and deleting it turns a historical record into a dangling id.

---

### M-116 — Feature flags with tenant, role, percentage and **city** targeting

| Field | Value |
| :--- | :--- |
| **Sprint** | 15 |
| **Epic** | EP-19 · F-19.8, F-19.18, F-19.24 · T-19.17, T-19.18, T-19.19, T-19.20, T-19.21, T-19.22, T-19.39 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A capability can be turned on for one city, one tenant or five percent of traffic, in that
precedence, and a kill-switch can be pulled by an on-call engineer at 02:00 with a reason recorded.

**Depends on** — M-023, M-107, M-114, M-115.

**Unblocks** — M-117, M-118, M-120.

**Files**

- `apps/server/src/admin/application/services/flag-administration.service.ts` · `.int-spec.ts` — targeting by **tenant, role, percentage (in bps) and city**; precedence **tenant → role → percentage → default, first match wins**; monotonic rollout; `ops.*` targeting **refused**.
- `apps/server/src/admin/domain/flag-bucketing.ts` · `.spec.ts` — stable bucket assignment: raising a rollout from 5% to 10% never moves anybody **out**.
- `apps/server/src/admin/application/services/kill-switch.service.ts` · `.int-spec.ts` — an `OFF` override takes precedence over a 100% rollout; pulling one records a **reason code**.
- `apps/server/src/admin/application/services/platform-staff.service.ts` · `.int-spec.ts` — invite with **mandatory MFA enrolment**, role assignment across the five platform roles, session revocation with 60-second propagation, effective-permission inspection.
- `apps/server/src/admin/application/queries/verification-queue.query.ts` · `.int-spec.ts` — assignment, reassignment with reason and a **non-resetting SLA**, SLA state, workload view.
- `apps/server/src/admin/application/queries/moderation-queues.query.ts` · `.int-spec.ts` — three queues with depth, oldest-item age, triggering signal, assignment and threshold alerting; decisions delegate to `EP-14` and `EP-04`.
- `apps/server/src/admin/application/queries/system-health.query.ts` · `.int-spec.ts` — queue depths, webhook failures, reconciliation status, failed jobs, outbox lag — **assembled from metrics and operational tables, never a live scan**.
- `apps/server/src/admin/controllers/system-queues.controller.ts` — Bull Board mounted **only** under `access(mfa)` + `admin.system_queue.read`, never publicly routable, asserted by a route test (`A-30`).
- `apps/admin-dashboard/src/routes/platform-dashboard.route.tsx` · `tenants.route.tsx` — `SCR-ADM-001` with `useLiveCounters()` 10–15 s polling and a *last updated* indicator (`A-08`); `SCR-ADM-004` with the nine actions, each with a reason dialog, an impact preview and the **effective-rate panel**.
- `tools/ci/assert-flag-registry.ts` — `FF-CI-07`: key naming, owner, expiry date and default position.

**Acceptance criteria**

1. Targeting supports **tenant, role, percentage and city**, with precedence tenant → role → percentage → default and **first match wins** (`FR-ADMN-08`, `F-19.18`, `RSK-10`).
2. **`rel.discovery.city-launch-gate` is targetable by city** — this is the executable form of the five `C9.4` gates and is what M-120 uses to hold consumer marketing closed (`FEATURE_FLAGS.md` §9.1).
3. Rollout is **monotonic**: raising a percentage never moves an already-included subject out, proven by a bucket-stability test across 5% → 10% → 25% (`FF-CI-07`).
4. An **`OFF` override beats a 100% rollout**; a kill-switch pull records a reason code and lands on the deploy alert channel (`NFR-MNT-06`).
5. `ops.*` flags **cannot** be targeted by tenant, role, percentage or city — they are default-only kill-switches, and an attempt to target one **fails the build** (`FEATURE_FLAGS.md` §5.2).
6. Platform staff invitation **requires MFA enrolment**; session revocation propagates within 60 seconds; effective permissions are inspectable (`FR-ADMN-10`, `FR-RBAC-04`, `FR-RBAC-05`).
7. Verification queue reassignment carries a reason and **does not reset the SLA clock** — reassignment is an internal event, not a fresh start (`FR-ADMN-11`, `KPI-03`).
8. System health is **read-only** and assembled from metrics and operational tables; there is no live scan and no mutation path (`FR-ADMN-13`).
9. Bull Board is mounted only behind `access(mfa)` and `admin.system_queue.read` and is proven not publicly routable by a route test (`A-30`).
10. Isolation coverage for every new admin endpoint ships here; a tenant token is refused, not scoped (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `flag-bucketing.spec.ts` | Unit | Stability across a raise; percentage expressed in bps |
| `flag-precedence.int-spec.ts` | Integration | Tenant → role → percentage → default; first match wins; city dimension |
| `kill-switch.service.int-spec.ts` | Integration | `OFF` beats 100%; reason recorded; deploy-channel alert (`T-19.39`) |
| `ops-targeting-refused.spec.ts` | CI policy | **NEGATIVE:** targeting an `ops.*` flag fails the build |
| `platform-staff.service.int-spec.ts` | Integration | MFA mandatory; 60-second revocation; effective permissions |
| `verification-sla-non-reset.int-spec.ts` | Integration | Reassignment does not reset the clock |
| `bull-board-route.spec.ts` | Integration | 404 without MFA and the permission; never publicly routable |

**Rollback plan** — Flags govern themselves: every flag introduced here has a documented **off**
position, and off is the safe direction for all of them. `git revert` returns flag evaluation to its
Sprint-0 static defaults, which is a working state; the city gate then defaults to **closed**, which
is the correct failure mode for `RSK-10`.

**Notes** — The trap is a percentage rollout that re-buckets on every raise. Users flip in and out
of the cohort, the experiment is meaningless, and — worse for a marketplace — a member sees a feature
on Monday and not on Tuesday. Bucketing is stable by construction and the test asserts it across
three raises. The second trap is targeting an `ops.*` kill-switch by percentage: a kill-switch that
is only pulled for 50% of traffic has not been pulled.

### M-117 — The audit explorer — before/after diff, and **no edit or delete affordance anywhere**

| Field | Value |
| :--- | :--- |
| **Sprint** | 15 |
| **Epic** | EP-19 · F-19.9, F-19.20, F-19.21, F-19.22 · T-19.23 … T-19.30, T-19.33, T-19.34, T-19.35, T-19.38, T-19.40, T-19.42 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Every change in the product is reconstructable by actor, entity and time, with a
field-level before/after diff — and the capability to alter that record **does not exist**, proven
five different ways.

**Depends on** — M-013, M-104, M-108, M-115, M-116.

**Unblocks** — M-118, M-119, M-120.

**Files**

- `apps/server/src/audit/application/queries/audit-explorer.query.ts` · `.int-spec.ts` — filter by actor, entity type, entity id, action, date range and **impersonation flag**; cursor pagination with the **100-page cap**; export through the M-108 harness.
- `apps/server/src/audit/application/services/field-diff.service.ts` · `.spec.ts` — structural diff over the JSON snapshots with **redaction of `C4`-classified values**, so a KYC value never appears in a diff (`SR-16`, `BR-DAT-06`).
- `apps/server/src/audit/jobs/partition-maintenance.processor.ts` · `.spec.ts` — monthly partitions on `occurred_at` (UTC), **three months pre-created**, `ENABLE` + `FORCE ROW LEVEL SECURITY` and the tenant policy applied **per partition**, the §10.3 grant set applied per partition, detach beyond 24 months to cold storage, re-attachable as foreign tables.
- `apps/server/src/audit/jobs/daily-seal.processor.ts` · `.spec.ts` — a **hash chain** over the prior day's partition, stored separately, verifiable on demand; detects alteration by anyone holding database credentials (`SR-03`).
- `apps/server/src/audit/controllers/tenant-audit.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts` — `GET /v1/tenant/audit`: the owner's own log, strictly RLS-scoped, **no platform rows and no other tenant's rows in either direction** (`AC-EP19-38`).
- `apps/server/src/audit/controllers/admin-audit.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts`
- `tools/ci/assert-audit-immutability.ts` — no `PATCH`/`DELETE` route; an **OpenAPI assertion** that no mutating operation targets `audit_log`; grant verification (`gm_audit_writer` = `INSERT` only, `gm_app` = `SELECT` only); a **migration-lint rule refusing DDL that would add an update path**.
- `apps/admin-dashboard/src/routes/audit-explorer.route.tsx` — `SCR-ADM-015` with the field-level diff viewer, the impersonation filter, saved filters and export; empty, loading, error and permission-denied states. **No edit control and no delete control exists in the component tree.**
- `apps/gym-dashboard/src/routes/settings.route.tsx` — `SCR-DASH-022`: ten sections including the danger zone, the arrears banner and the read-only degradation past day 14, plus the **self-service data-export entry point** wired to M-108.
- `infra/monitoring/alerts/audit-partition-lead.yaml` · `audit-seal-verification.yaml`
- `docs/features/audit-log.md` · four runbooks (`T-19.44`).

**Acceptance criteria**

1. The explorer filters by actor, entity type, entity id, action, date range and **impersonation flag**, with cursor pagination capped at 100 pages (`FR-ADMN-09`, `AC-ADMN-02.1`).
2. Every row shows a **field-level before/after diff**, with `C4`-classified values **redacted** — a KYC document number never appears in a diff (`SR-16`, `BR-DAT-06`).
3. **No interface anywhere can modify an audit record**, proven **five** ways: no UI affordance, no REST route, no OpenAPI mutating operation targeting `audit_log`, no grant, and a migration-lint rule that refuses DDL adding an update path (`AC-ADMN-02.3`, `INV-DAT-2`, `E15.9`).
4. **A support impersonation is fully reconstructable**: reason, duration, and every action marked `impersonated_by`, surfaced in the impersonated user's **own** activity log (`BR-DAT-02`, `E15.8`, `FR-USER-05`).
5. Impersonation refuses financial mutations; KYC reads are refused for four platform roles and permitted for two, each permitted read writing its own audit row (`BR-DAT-07`, `SEC-A01-006/007/010`).
6. Partition maintenance keeps **three months pre-created** and re-applies `FORCE ROW LEVEL SECURITY`, the tenant policy and the grant set **per partition** — a new partition is never a hole in the tenancy model (`TR-41`, `R-AUD`).
7. `audit.daily-seal` writes a hash chain over the prior day's partition; a tampered row **fails verification**, proven by a test that alters a row with elevated credentials (`SR-03`, `AC-EP19-21`).
8. `GET /tenant/audit` returns the tenant's own rows only — **no platform rows**, no other tenant's rows, in either direction (`B3.2`, `BR-TEN-01`).
9. Alerts fire on partition lead below 1 month and on any seal-verification failure (`T-19.43`).
10. All **15** admin screens are asserted **server-side** permission-gated by an `E15.1` sweep, and `axe-core` is clean on `SCR-ADM-001`, `SCR-ADM-004`, `SCR-ADM-011`, `SCR-ADM-015`, `SCR-DASH-022` and the diff viewer (`T-19.42`, `NFR-USE-01`).
11. **M5 is declarable**: every `M`-priority `FR-` is delivered or explicitly descoped with a recorded `§C10` decision (`E15.10`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `audit-immutability.int-spec.ts` | Integration + Contract | All five proofs: UI, REST, OpenAPI, grants, migration lint (`T-19.38`) |
| `field-diff.service.spec.ts` | Unit | Structural diff; `C4` values redacted |
| `partition-maintenance.processor.spec.ts` | Unit + Integration | Three months lead; RLS and grants re-applied per partition; detach at 24 months |
| `daily-seal.processor.spec.ts` | Integration | Tampered row fails verification |
| `impersonation-reconstruction.int-spec.ts` | Integration | Reason, duration, every action flagged; financial mutation refused (`T-19.40`) |
| `tenant-audit.controller.isolation-spec.ts` | Isolation (`IS3`) | No platform rows; no cross-tenant rows; both directions |
| `admin-screens-permission-sweep.int-spec.ts` | Integration | All 15 screens permission-gated server-side (`E15.1`) |

**Rollback plan** — Read-only surfaces plus two jobs. `git revert` removes the explorer; **audit
rows keep being written** because the writer is the M-013 interceptor, not this milestone. Reverting
`audit.partition-maintenance` is the only dangerous part — without it the pre-created partitions run
out in three months, so the revert instruction requires the partition job to be retained or its work
scheduled manually, and the runbook says so.

**Notes** — The trap is a "fix a typo in the reason field" request. It will be reasonable, it will
come from someone senior, and granting it converts the audit log from evidence into a document. The
five proofs exist so that the answer is *the capability does not exist* rather than *we would rather
not*. The second trap is a new monthly partition created without `FORCE ROW LEVEL SECURITY` — RLS is
not inherited automatically, and a single unprotected partition is a month-wide hole in the tenancy
model that no isolation test will find because the isolation suite queries the parent table.

---

## 6. Sprints 16–18 — hardening, UAT and launch

Three milestones for three sprints. This is deliberate, and R-M16 explains it: **these are gate
milestones.** Each builds the harness, runs the measurement and defines the pass condition. The
remediation each gate provokes is defect-shaped, is drawn from the 8.5 / 17.5 / 27.5 ed reserves, and
is tracked on the defect board against the `C8.5` severity ladder — not here. A roadmap that
pre-plans a penetration-test finding as a 4-hour milestone is a roadmap that has decided what the
penetration test will find.

### M-118 — Every `NFR` target measured, the accessibility audit, the penetration-test gate · **M6**

| Field | Value |
| :--- | :--- |
| **Sprint** | 16 |
| **Epic** | — (hardening) · Sprint tasks 16.1 … 16.14 |
| **Size** | 6h |
| **Role** | QA |

**Goal** — Every non-functional target has a number measured against it under the specified load
profile, every accessibility pass is signed, and every critical and high penetration-test finding has
a closing commit — so that **M6** is a fact rather than an opinion.

**Depends on** — M-104, M-107, M-108, M-113, M-116, M-117 (gate: **M5 feature-complete**).

**Unblocks** — M-119.

**Files**

- `apps/server/test/load/nfr-perf-profile.k6.js` — the `NFR-SCAL-01` year-1 profile: 2,000 tenants, 5,000 branches, 500,000 users, 100,000 concurrent-eligible memberships, **50,000 check-ins/day**, with the `NFR-PERF-08` 500 check-ins/minute and `NFR-PERF-09` 2,000 searches/minute peaks.
- `apps/server/test/load/soak-4h.k6.js` — the four-hour soak; memory and p95 sampled throughout.
- `apps/server/test/load/thresholds.json` — one threshold per `NFR-PERF-01` … `NFR-PERF-10`, each with an explicit **build-failure condition**.
- `apps/customer-web/tests/a11y/manual-pass.checklist.md` · `apps/gym-dashboard/tests/a11y/manual-pass.checklist.md` — the keyboard-only and screen-reader scripts, executed by a human and signed.
- `apps/server/test/chaos/dependency-disable.spec.ts` — each of the eight `DEP-` dependencies disabled in turn; **check-in and payment must still work**.
- `apps/server/src/common/resilience/circuit-breaker.ts` · `.spec.ts` — maps → cached geocodes, SMS → email OTP, email → queue + in-app, storage → placeholder + queued upload, error tracking → local logs.
- `jest.mutation.config.js` — the mutation-score gate on `payments/`, `settlements/`, `ledger/`, `refunds/`, `memberships/`, `tenancy/`.
- `apps/customer-web/size-limit.json` (modified) — ≤ **200 KB gzipped** initial JS, enforced in CI.
- `apps/server/test/isolation/full-sweep.spec.ts` — the isolation suite re-run across **every** endpoint in the product.
- `docs/security/pentest-2027-04/findings.md` · `remediation-log.md` — one row per finding, each with a severity, an owner and a **closing commit hash**.
- `docs/runbooks/restore-drill-2027-04.md` — the production restore drill, **Indian regions only**.

**Acceptance criteria**

1. **`NFR-PERF-01` … `NFR-PERF-10` are all met and evidenced** under the specified load profile, each with a recorded measurement and a CI threshold: search p95 ≤ 500 ms / p99 ≤ 1000 ms · gym-detail LCP ≤ 2.5 s on 4G RUM · check-in scan-to-confirmation p95 ≤ 2 s · dashboard lists p95 ≤ 800 ms · payment-intent creation p95 ≤ 1.5 s · report generation ≤ 5 s or async · invoice PDF ≤ 3 s · 500 check-ins/minute · 2,000 searches/minute · ≤ 200 KB gzipped initial JS (`BAC-11`, `E16.1`, `E16.4`).
2. The **four-hour soak** at the year-1 profile shows **no memory growth and no p95 regression** (`E16.2`).
3. `axe-core` is clean on the customer site and the check-in desk; **keyboard-only checkout** and a **keyboard-only five-scan check-in sequence** both complete; screen-reader passes on `SCR-WEB-003` and `SCR-DASH-009` are signed off (`NFR-USE-01` … `NFR-USE-09`, `E16.3`).
4. **The independent penetration-test report exists**, and **every critical and high finding is closed** with a linked commit; the remediation log has no open row at either severity (`E16.5`).
5. `NFR-SEC-01` … `NFR-SEC-13` are verified, including **no `BYPASSRLS` role in any environment** and **zero payment-instrument data anywhere** (`E16.6`).
6. **The isolation suite passes across 100% of tenant-scoped endpoints** — the sweep enumerates endpoints from the OpenAPI document and fails on any endpoint without coverage (`BAC-10`, `E2E-11`, `E16.7`).
7. The mutation score is above the gate on all six critical modules (`TR-17`, `E16.8`).
8. **Each of the eight external dependencies can be disabled without preventing check-in or payment**, with the named fallback observed in each case (`NFR-AVL-03`, `NFR-AVL-07`, `E16.9`).
9. A **restore drill** meets RPO ≤ 15 min and RTO ≤ 4 h **using Indian regions only** (`NFR-AVL-04`, `LAUNCH_MARKET_INDIA.md` §9, `E16.10`).
10. **M6 is signed off** (`E16.11`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `nfr-perf-profile.k6.js` | Load | Ten thresholds, each a build-failure condition |
| `soak-4h.k6.js` | Load | Flat memory; stable p95 over four hours |
| `manual-pass.checklist.md` | Manual a11y | Keyboard-only checkout; keyboard-only five-scan sequence; two screen-reader passes |
| `dependency-disable.spec.ts` | Chaos | Eight dependencies, each disabled; check-in and payment survive with the named fallback |
| `full-sweep.spec.ts` | Isolation (`IS3`) | 100% endpoint coverage enumerated from OpenAPI |
| `mutation` run | Mutation | Six modules above the gate |
| `restore-drill` | Operational | RPO ≤ 15 min, RTO ≤ 4 h, Indian regions only |

**Rollback plan** — Nothing here is a feature; the rollback for a hardening change is the change
itself, reverted individually, each with its own regression test. **Removing a gate is not a
rollback** — the thresholds file, the isolation sweep and the mutation gate are `BAC-10` and `BAC-11`
evidence, and weakening any of them is a `§C10` **Major** change with the client sponsor's written
approval.

**Notes** — The trap is discovering accessibility in Sprint 16. It is not discovered here:
`axe-core` has been a blocking CI gate since Sprint 0 and every screen shipped clean, so Sprint 16 is
**manual passes only** — keyboard, screen reader, focus order. If this milestone finds automated
violations, the CI gate has been bypassed somewhere and that is the finding. The second trap is
booking the penetration test mid-sprint: there is **no schedule buffer after M-118**, a critical
finding in `payments/` or `tenancy/` consumes the launch-window buffer directly, and the test must
start on **day 1**.

### M-119 — UAT against the six persona scripts, and the freeze enforced **mechanically** · **M7**

| Field | Value |
| :--- | :--- |
| **Sprint** | 17 |
| **Epic** | — (UAT) · Sprint tasks 17.1 … 17.8 |
| **Size** | 6h |
| **Role** | QA |

**Goal** — The client's own people, in their own roles, complete six scripted sessions on a build
nobody can quietly change — and every S1 and S2 defect they find is closed with a regression test that
failed first.

**Depends on** — M-097, M-103, M-106, M-108, M-113, M-117, M-118 (gate: **M6 signed off**).

**Unblocks** — M-120.

**Files**

- `infra/terraform/environments/uat/` — staging refreshed with **anonymised production-shaped** data, sandbox payments, and client accounts in **every** role.
- `tools/uat/anonymise.ts` · `.spec.ts` — the anonymiser; a test asserts no real phone number, email or KYC value survives it (`BR-DAT-06`).
- `docs/uat/UAT-01-owner.md` (90 min) · `UAT-02-receptionist-peak-hour.md` (60 min) · `UAT-03-member-lifecycle.md` (90 min) · `UAT-04-verification-officer.md` (60 min) · `UAT-05-finance-settlement-cycle.md` (120 min) · `UAT-06-super-admin.md` (60 min) — each a numbered script with an observation column and a severity field filled **at capture time**.
- `.github/workflows/release-branch-freeze.yml` — the mechanical freeze: after the freeze date, a PR into the release branch **without an S1/S2 defect id in its title** is rejected by CI (`T-17.8` equivalent, `RSK-15`).
- `docs/uat/defect-board.md` — every defect with severity, owner, disposition and the **commit of the regression test that failed before the fix**.
- `docs/KNOWN_LIMITATIONS.md` (modified) — every S3 defect with its **agreed disposition**.
- `apps/server/test/regression/` — one file per closed S1/S2 defect, named for its defect id.

**Acceptance criteria**

1. **All six scripts are completed by the client's own people in each role** — `UAT-01` owner signup to first sale unaided in 90 minutes · `UAT-02` a simulated peak hour of 20 check-ins including 3 denials, 2 walk-in sales and 1 balance collection · `UAT-03` discover, buy, check in, freeze, renew, review, refund · `UAT-04` 10 applications including 3 rejections and 2 information requests · `UAT-05` a full settlement cycle with a refund and a dispute, reconciled · `UAT-06` suspend a tenant, override a commission, moderate a review, reconstruct an audit trail (`C8.4`, `E17.1`).
2. **Zero S1 and zero S2 defects are open** at exit (`BAC-14`, `E17.2`).
3. Every S3 defect is triaged with an **agreed disposition recorded** in `KNOWN_LIMITATIONS.md` — agreed with the client sponsor, not decided by the team (`E17.3`).
4. **Every fix carries a regression test proven to have failed before the fix**; the defect board links the failing run (`§23.2` item 19, `E17.4`).
5. **No non-defect change was merged after the freeze date**, provable from the release-branch history — and the proof is mechanical, because CI rejected the alternative (`C10` Freeze, `RSK-15`, `E17.6`).
6. `ASM-05` client-supplied assets are in place: brand assets, legal copy, terms, privacy and **refund policy** — without the refund policy `UAT-03` cannot complete, because the policy is displayed at checkout and is contractual (`E17.7`).
7. The UAT environment holds **anonymised** production-shaped data; the anonymiser is tested and no real personal data reaches the environment (`BR-DAT-06`).
8. **Sign-off is recorded per the PRD approval matrix** (`BAC-15`, `E17.5`).
9. **M7 is signed off** (`E17.8`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `anonymise.spec.ts` | Unit | No real phone, email or KYC value survives; referential integrity preserved |
| `release-branch-freeze.yml` | CI policy | **NEGATIVE:** a PR without an S1/S2 defect id is rejected after the freeze date |
| `test/regression/*.spec.ts` | Unit / Integration / E2E | One per closed S1/S2 defect, each failing on the pre-fix commit |
| Full regression suite | All layers | Re-run green after each fix batch (`T-17.3`) |
| Exploratory charters | Manual | Hand-offs **between** personas, which the six scripts do not cover |

**Rollback plan** — There is nothing to roll back: this milestone produces an environment, six
scripts, a CI policy and a defect board. The **freeze workflow** is the one artefact that must not be
reverted before launch — disabling it is how `RSK-15` scope creep re-enters, and the PR body names
the Delivery Manager as the only approver.

**Notes** — The trap is a placeholder-copy build. `UAT-03` displays the refund policy at checkout,
the member accepts it, and the acceptance is snapshotted onto the order by M-098 — so a UAT run on
placeholder copy produces order snapshots referencing text that will never exist, and re-running the
script after the real copy arrives is the only remedy. `ASM-05` is escalated weekly from Sprint 12
for exactly this reason. The second trap is defect severity assigned later: severity decides whether
a fix is permitted under the freeze, and assigning it a day after capture is how an S3 becomes an S2
under pressure.

---

### M-120 — Production cutover, the `C9.4` city gate, hypercare · **M8** · `BAC-01` … `BAC-15`

| Field | Value |
| :--- | :--- |
| **Sprint** | 18 |
| **Epic** | — (launch) · Sprint tasks 18.1 … 18.10 |
| **Size** | 6h |
| **Role** | DevOps |

**Goal** — The platform is live in the India region, a pilot gym has taken real money and recorded a
real check-in, consumer marketing is **held closed by a flag** until a city passes all five gates, and
the fifteen business acceptance criteria are evidenced row by row.

**Depends on** — M-119 (gate: **M7 signed off**). Transitively: all of M-001 … M-119.

**Unblocks** — nothing. This is the end of Phase 1.

**Files**

- `infra/terraform/environments/production/` — **Mumbai primary + a second Indian region for DR** (`OQ-16`, RBI localisation, `LAUNCH_MARKET_INDIA.md` §9).
- `docs/runbooks/production-cutover.md` — dry-run on staging first, with a **rehearsed rollback**.
- `.github/workflows/progressive-shift.yml` — 10% → 50% → 100% with **automatic rollback armed** on error-rate or latency regression.
- `apps/server/test/smoke/production-smoke.spec.ts` — the production smoke suite, read-mostly, safe to run against live.
- `infra/monitoring/dashboards/{oncall,finance,product}.json` · `infra/monitoring/escalation/oncall-rota.yaml` — alert routing tested end to end with a synthetic alert.
- `docs/launch/bac-evidence-pack.md` — one row per `BAC-`, each with its evidence artefact, its owner and its date.
- `docs/launch/city-gate-pilot.md` — the five `C9.4` gates for the pilot city, **read from the `City performance` report**, with the measured value and the date it was read.
- `docs/launch/hypercare.md` — the S1/S2 hotfix SLA, the on-call rota, and the daily review cadence for the first fourteen days.

**Acceptance criteria — the `BAC-01` … `BAC-15` business acceptance list**

This milestone's acceptance criteria are the fifteen `BAC-` rows verbatim, because that list — and not
a green pipeline — is what "done" means commercially. Each is evidenced in production, in the
evidence pack, with an artefact and a date.

1. **`BAC-01`** — A gym owner can complete signup, KYC submission, gym setup and plan creation unaided, and reach "submitted for review" in a single session. *Evidence: the pilot gym's own session, timed, in production.*
2. **`BAC-02`** — A verification officer can review, approve or reject a gym with structured reasons, and the outcome is reflected in marketplace visibility **within 60 seconds**. *Evidence: a timed approval with the listing observed live.*
3. **`BAC-03`** — A consumer can find a gym by location, filter results, compare gyms, view real plans and prices, and purchase a membership online end to end. *Evidence: a real production purchase.*
4. **`BAC-04`** — Payment capture activates the membership, issues a compliant invoice, and provisions a QR credential **without manual intervention**. *Evidence: the webhook-driven activation trace and the GST-compliant invoice PDF.*
5. **`BAC-05`** — A member can check in by QR, and the visit appears in **both** the member's history and the gym's attendance report immediately. *Evidence: the first real check-in, both views screenshotted.*
6. **`BAC-06`** — Every rule in `A8` has at least one passing automated test, and every `M`-priority rule has a test that also proves the **negative** case. *Evidence: the `BAC-06` CI report, zero uncovered rules.*
7. **`BAC-07`** — A settlement run over a period with mixed online sales, offline sales, coupons and one refund produces a statement Finance reconciles to **zero variance** against the gateway report. *Evidence: **one full production settlement cycle**, run with Finance present (`E18.6`).*
8. **`BAC-08`** — A refund flows from request through approval to gateway execution, credit note and ledger reversal, with the gym's next payout correctly reduced. *Evidence: a production refund and the following statement.*
9. **`BAC-09`** — Only a member with a recorded check-in can publish a review, verified by attempting the **negative** case. *Evidence: the negative attempt, refused, in production.*
10. **`BAC-10`** — An automated isolation test suite proves that a user of tenant A cannot read or write any record of tenant B **through any exposed endpoint**. *Evidence: M-118's 100%-coverage sweep, green on the release commit.*
11. **`BAC-11`** — The platform meets `NFR-PERF-01` through `NFR-PERF-05` under the specified load profile. *Evidence: M-118's threshold run and the four-hour soak.*
12. **`BAC-12`** — A tenant can export members, memberships, payments and attendance **without support involvement**. *Evidence: the pilot gym performing the export unaided.*
13. **`BAC-13`** — Audit logs exist for every rule in `A8.10` and are queryable by entity **and** by actor. *Evidence: the M-117 explorer, queried both ways, on production data.*
14. **`BAC-14`** — All `M`-priority functional requirements in Part B are delivered, and **no `M`-priority defect at Severity 1 or 2 is open**. *Evidence: the requirement traceability matrix and the defect board at zero.*
15. **`BAC-15`** — UAT sign-off is recorded from the client sponsor against the scripts in Part C `§C8.4`. *Evidence: the signed record from M-119.*

**Additional launch conditions — non-negotiable, and separate from the `BAC-` list**

16. The production deploy completes with a **backward-compatible migration and zero downtime** (`NFR-AVL-06`, `E18.1`), and the progressive shift 10% → 50% → 100% runs with **automatic rollback armed and rehearsed** (`E18.2`).
17. **The five `C9.4` city gates are read from the `City performance` report, not asserted**: ≥ 25 verified activated gyms with published plans · ≥ 5 localities · ≥ 90% complete profiles above the freshness threshold · verification SLA met for 2 consecutive weeks · one settlement cycle at zero variance (`E18.10`).
18. **Consumer marketing surfaces remain flag-gated off for any city below the gates** — `rel.discovery.city-launch-gate` off means the city landing page is excluded from the sitemap and marked `noindex`, the city is hidden from the picker, and paid-acquisition destinations are disabled. **Supply is never switched off**: gyms in that city stay fully live, fully sellable and reachable by direct link (`E18.11`, `RSK-10`).
19. On-call, finance and product dashboards are live with alerts routed, and a **synthetic alert reaches the on-call phone** (`E18.12`).
20. **M8 is declared** (`E18.13`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `production-smoke.spec.ts` | Smoke | Green in production before the shift passes 10% |
| `progressive-shift.yml` rehearsal | Operational | Rollback triggers at the configured error-rate and latency thresholds |
| Production settlement cycle | Operational + Integration | Zero variance against the **real** gateway report, Finance present |
| `city-gate-pilot.md` verification | Operational | Five gates read from the report with measured values and a date |
| Synthetic alert | Operational | Reaches the on-call phone through the tested escalation path |
| `bac-evidence-pack.md` walkthrough | Acceptance | Fifteen rows, each with an artefact, an owner and a date |

**Rollback plan** — Two independent mechanisms, in this order. **(1)** The progressive traffic
shift with automatic rollback armed: an error-rate or latency regression returns traffic to the
previous image, which is still healthy because the migration was backward-compatible. **(2)** The
city gate: `rel.discovery.city-launch-gate` off closes demand generation in a city **without touching
supply** — gyms keep selling and members keep checking in. Neither mechanism reverses a payment or a
payout; those are Finance operations at the provider, and the hypercare runbook says so in its first
line.

**Notes** — The trap is a technically perfect launch that fails commercially. `RSK-10` scores 16
because a marketplace with 12 gyms in one locality gives a consumer nothing to choose between, and the
consumer does not come back. The five gates exist so that **the launch decision is a query**, and the
city flag exists so that the decision is enforced in code rather than remembered in a meeting. The
second trap is the first production settlement cycle: real gateway fee reporting differs from sandbox,
`BR-FIN-06` already forbids estimating an unreported fee, and the first cycle is therefore run **with
Finance in the room** rather than reported to them afterwards. The third trap is a launch sprint
planned to capacity — the 27.5 ed of dev headroom is the hypercare reserve, and a launch with no
capacity to respond to the launch is not a launch, it is a release.

---

## 7. Band closure

### 7.1 Sprint exit reconciliation

| Sprint | Exit condition (`C9.1`) | Milestones that make it true |
| :-: | :--- | :--- |
| 11 | ***`E2E-12` passes with zero variance*** | M-087 … M-090 (previous band) + **M-091 … M-097** |
| 12 | ***`E2E-07` and `E2E-08` pass*** | M-098 … M-103 |
| 13 | ***"Report catalogue complete"*** | M-104 … M-108 |
| 14 | ***"Notification catalogue delivered"*** | M-109 … M-113 |
| 15 | ***"Admin console complete" — `SCR-ADM-001` … `SCR-ADM-015`*** · **M5** | M-114 … M-117 |
| 16 | ***"All NFR targets met"*** · **M6** | M-118 |
| 17 | ***"UAT exit criteria met"*** · **M7** | M-119 |
| 18 | ***`BAC-01` … `BAC-15` satisfied*** · **M8** | M-120 |

### 7.2 The seven structural guarantees this band adds

| Guarantee | Made true by | Enforced at |
| :--- | :--- | :--- |
| A payout cannot be released by one person above the threshold | M-094 | A database `CHECK` with **distinct** approvers, not a service check |
| A gateway variance stops **one** tenant, never all of them | M-096 | `BR-FIN-07-N1`, asserted by a two-tenant test |
| A refund is governed by the policy the member agreed to | M-098 | `dependency-cruiser` + the mutate-and-re-evaluate test |
| A refund reverses at the **original** rate and rounding | M-101 | R-11, the parity property suite, and the statement re-tie |
| **`reporting/` can read broadly because it can write nothing** | M-104 | `reporting-is-read-only`, asserted in CI |
| No SMS sends on an unapproved DLT template | M-112 | `TemplateVersionResolver` as the only path to a body |
| **An audit record cannot be altered by any interface that exists** | M-117 | Five independent proofs: UI, REST, OpenAPI, grants, migration lint |

### 7.3 The five moments in this band where the schedule has no give

| # | Moment | Why | What absorbs a slip |
| :-: | :--- | :--- | :--- |
| 1 | **M-097** — `E2E-12` at zero variance | `BAC-07` is a launch gate and `KPI-26` requires 100%. Sprint 12 immediately begins reversing the entries Sprint 11 wrote | Nothing downstream. `TR-05` is likeliest under exactly this compression |
| 2 | **M-112** — the DLT state machine | The approval lead time is **weeks**, controlled by an external regulator. `T-17.05` submits all sixteen templates in Sprint 8 for this reason | Nothing. Early submission costs nothing; late submission cannot be recovered |
| 3 | **M-117** — M5 feature-complete | Sprint 16 has **no feature capacity**. Anything unfinished enters hardening as debt | The `§24` descope register, reviewed at Sprint-15 planning **and** at review |
| 4 | **M-118** — pen-test remediation | The least recovery time of any milestone. A critical finding in `payments/` or `tenancy/` consumes the launch-window buffer directly | The 8.5 ed reserve, then the three-week launch-window buffer (§23.3) |
| 5 | **M-120** — 25 verified gyms across 5+ localities | A **supply operation**, not an engineering one. Recruitment must start by Sprint 12 | Nothing engineering can do. The gate holds and the marketing date moves |

---

## 8. The full dependency spine of this band

Ascending-order buildability, stated once as a graph rather than thirty times as a field.

`illustrative — not committed code`

```text
M-090 ─┬─ M-091 ─┬─ M-092 ──────────────┐
       │         └─ M-093 ─── M-094 ─── M-095 ─── M-096 ─── M-097
       └─ M-093                                              │
                                                             ▼
M-098 ─── M-099 ─── M-100 ─── M-101 ─┬─ M-102 ─── M-103 ─────┤
                                     └───────────────────────┤
                                                             ▼
M-104 ─── M-105 ─┬─ M-106 ─┬─ M-108 ───────────────────────► │
                 └─ M-107 ─┘                                 │
                                                             ▼
M-109 ─── M-110 ─── M-111 ─── M-112 ─── M-113 ─────────────► │
                                                             ▼
M-114 ─── M-115 ─── M-116 ─── M-117 ══ M5 gate over M-001…M-117 ══► M-118 ─── M-119 ─── M-120
```

| Property | Value |
| :--- | :--- |
| Longest serial chain in this band | `M-090 → M-091 → M-093 → M-094 → M-095 → M-096 → M-097 → M-103 → M-107 → M-117 → M-118 → M-119 → M-120` |
| Serial focused hours on that chain | **72 h** |
| Milestones with no in-band dependency | M-098 and M-104 — both start from prior-band foundations and can begin the moment their sprint opens |
| Parallelism ceiling | Four (settlements BE, refunds BE, reporting BE, FE) through Sprints 11–13; **one** from M-118 onward, by design |

---

## 9. What is deliberately **not** in the 120, and where it went

A roadmap that lists only what is built is half a roadmap. This section is the other half: what was
considered, decided against, and **written down somewhere it can be found**.

### 9.1 The three destinations

| Destination | What lands there | Who owns it |
| :--- | :--- | :--- |
| **`PHASES.md`** — the Phase 2 roadmap | Capabilities that are coherent products in their own right and were never Phase-1 scope | Product Manager |
| **`SprintPlanning.md` §24** — the descope register | `D-01` … `D-12`, pre-agreed **before** the first line of code so that a capacity failure is a decision already taken. Taking one requires the Delivery Manager to record it in `PHASES.md` **and** `KNOWN_LIMITATIONS.md` | Delivery Manager |
| **`KNOWN_LIMITATIONS.md`** | Requirements met partially, met differently, or blocked by something outside engineering — recorded honestly, with the reason and the trigger for revisiting | Technical Lead |

### 9.2 Descope items taken during this band, and exactly what was lost

| # | Item | Sprint | ed recovered | What is actually lost | Where it went |
| :--- | :--- | :-: | :-: | :--- | :--- |
| **`D-10`** | Scheduled email delivery of reports (`FR-RPT-04`, `S`) | 13 | 1.5 | Push reporting. **Every report still exports on demand**, and the async export path with its notification is fully built | `rel.reporting.scheduled-delivery` registered **off** in M-108; the job exists, schedules are paused not deleted, and no catch-up burst fires on restore. `KNOWN_LIMITATIONS.md` |
| **`D-02`** | **Referrals and wallet in full** (`FR-REFR-01` … `FR-REFR-07`, `FR-REFR-06`, `BR-RFL-01`, `BR-WAL-01`, `SCR-WEB-015`) | 14 | 5.0 | A growth loop, not a launch capability | **No code at all.** M-113 ships only the absence assertions (`T-20.21`): no balance column, no transfer endpoint, no withdrawal endpoint. `ledger_entries.entry_type` reserves `WALLET_CREDIT`/`WALLET_DEBIT`/`WALLET_EXPIRY` **as documentation only**. The wallet **ordering rule** — wallet is a *tender*, not a discount — is specified in `docs/features/wallet-seam.md` and built never. `PHASES.md` Phase 2 |
| **`D-01`** (partial) | Help-centre depth beyond the ten most common issues; satisfaction rating (`FR-SUP-06` partial, `FR-SUP-07`) | 14 | 1.5 | Self-service depth and CSAT. `OBJ-10` is still met by the ten articles | The ten articles ship in M-113 with reason-code deep links; `rel.support.satisfaction-rating` registered **off**. `KNOWN_LIMITATIONS.md` |
| **`D-09`** | Attendance peak heatmap and daily digest (`FR-CHK-13`, `FR-CHK-14`, `S`) | 8 → **13** | 2.5 | Nothing, in the end — **deferred, not dropped** | Delivered as registered report keys in **M-106**. The register row is closed, not carried |

Descopes taken in earlier bands and **not** revisited here: `D-03` shift roster (`FR-STAF-08`), `D-04`
duplicate member merge (`FR-CRM-09`), `D-05` membership transfer (`FR-MEMB-11`, `BR-MEM-08`). Each was
re-tabled at Sprint-13 refinement per the previous band's closing note and each was re-confirmed as
descoped. `D-06`, `D-07`, `D-08`, `D-11` and `D-12` remain **available** and untaken —
approximately 26.5 ed of the original 90 ed pool.

### 9.3 Phase 2 — capabilities that were never Phase-1 scope

| Capability | Why it is Phase 2, not descope | Seam left for it |
| :--- | :--- | :--- |
| **Socket.IO real-time transport** (`A-08`) | Phase 1 polls at 10–15 s through TanStack Query. The decision is not "no real-time", it is "one transport seam" | `apps/gym-dashboard/src/shared/hooks/useLiveCounters.ts` is the **only** file permitted to set a `refetchInterval`; a structure test enforces it. The upgrade touches one file behind `release.attendance.realtime_transport` |
| **Wallet as a tender at checkout** (`FR-REFR-06`, `BR-WAL-01`) | It is a payments-ordering change, not a feature toggle: wallet applies **before** the gateway charge and after every discount | The ordering rule is written now (`docs/features/wallet-seam.md`), the ledger entry types are reserved as documentation, and `rel.ordering.wallet-credit` exists with a documented off position |
| **Trainer sessions and the trainer marketplace** (`FR-STAF-07` split, `OQ-15`) | A second marketplace with its own supply side | `rel.staff.trainer-sessions` renders a stub page — a configuration state, not a hard-coded placeholder |
| **Class booking and capacity management** (`A11`) | Requires a scheduling domain the product does not have | Branch `capacity` values are stored and retained under `rel.catalog.branch-capacity-indicator`, untouched |
| **Multi-currency and a second launch market** | The launch market is India (`OQ-01`) | `Money` carries a currency everywhere; tax profiles are **per country** with `fy_start_month` as a field (M-115); the `PaymentProvider` port already has two adapters |
| **`audit_log` cold-storage query federation** | 24-month detachment is built; querying detached partitions as foreign tables is not | M-117 detaches **re-attachably** as foreign tables; the runbook covers the manual re-attach |
| **GST TCS / income-tax TDS for e-commerce operators** | **`BLK-03` conflict 3** — a liability question for a qualified Indian tax advisor, not an engineering judgement (`BLK-04`) | If the answer lands after Sprint 11 it is a `§C10` **Major** change with re-baselining, not a quiet absorption. It may add ledger entry types, settlement lines and a filing report |

### 9.4 `KNOWN_LIMITATIONS.md` — requirements met partially, and honestly recorded

| Requirement | The limitation | Recorded by | Trigger to revisit |
| :--- | :--- | :--- | :--- |
| **`FR-NOTF-03`** — templates editable without deployment | **True for email and in-app. Not achievable for India SMS by law.** The honest degradation is the approval-state machine with the previous approved version continuing to send | M-112 | TRAI DLT rules change, or a second launch market without DLT |
| **`REG-02`** — GST on platform commission | `commission_tax_minor` and the `COMMISSION_TAX` / `COMMISSION_TAX_REVERSAL` entry types are **present and reversing zero** pending the advisor's answer. The **schema** decision is not deferred, only the rate | M-089 (schema), **M-101** (the zero reversal) | `REG-02` answered |
| **`FR-RPT-04`** — scheduled report delivery | Built, registered, and **off** (`D-10`) | M-108 | Post-launch, when tenant demand is measured rather than assumed |
| **`FR-SUP-07`** — satisfaction rating | Off (`D-01`). SLA timing and breach alerting are unaffected, so response performance stays measurable | M-113 | Post-launch |
| **Referrals and wallet** | Absent by decision, with the seam specified | M-113 | `PHASES.md` Phase 2 |
| **`O-5`** — attendance retention versus dispute evidence | Attendance is monthly-partitioned with a retention sweep; a dispute pack assembled late could reference purged rows | **M-102**, which resolves it by assembling **at case creation** so the pack itself is the retained artefact | Retention policy change |
| **`FR-ADMN-08`** city targeting | If the flag-platform city dimension is not approved in time, the `C9.4` gate runs as a **static allowlist** — same behaviour, worse ergonomics | M-116 (`F-19.18`) | Flag-platform capability review |

### 9.5 What may **never** be descoped, restated because this is the last band

`SprintPlanning.md` §24.1 is the authority. It is restated here because M-118, M-119 and M-120 are
where schedule pressure is highest and where the temptation to weaken a gate is strongest.

RLS, the tenant extension and the isolation suite · the append-only ledger, integer minor units and
the nine persisted `A6.3` figures · server-side price re-validation · human-only gym approval ·
check-in-gated reviews · webhook-driven activation · idempotency on every money-affecting endpoint ·
**gapless per-tenant per-FY invoice numbering** (a statutory obligation in India) · GST correctness
including the CGST/SGST split and `commission_tax_minor` · **reconciliation at zero variance** ·
refund execution to the original instrument · any negative-case test for an `M`-priority rule ·
accessibility gates · audit immutability.

Weakening any of these is a `§C10` **Major** change requiring the client sponsor's written approval.
It is not a rollback, it is not a "temporary tolerance", and it is not something a release manager can
grant at 18:00 on a Friday.

---

## 10. What happens after `M-120`

Out of scope for this file, and named so that nobody looks for it here.

| Horizon | Where it is planned |
| :--- | :--- |
| Hypercare days 1–14 | `docs/launch/hypercare.md` — the S1/S2 hotfix SLA, the on-call rota, the daily review cadence |
| City 2 and city 3 | The same five `C9.4` gates, per city, read from the same report. No new engineering |
| Post-launch months +1 to +3 | `ENGINEERING_PLAN.md` §14.3 — KPI baselining, the `TECH_DEBT.md` burn-down, and the first Phase-2 refinement |
| Phase 2 scope | `PHASES.md` |

---

**END OF FILE — `Milestones_090-119.md` · milestones M-091 … M-120 complete · 30 of 30 written ·
`M-120` closes Phase 1 against `BAC-01` … `BAC-15` · no continuation file.**

