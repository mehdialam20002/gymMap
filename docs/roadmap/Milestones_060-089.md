# Implementation Roadmap — Milestones M-061 … M-090

**Document type:** Delivery roadmap (build order) · **Status:** Baseline for Sprints 7–11
**Owner:** Principal Engineer / Delivery Lead · **Approver:** Technical Lead (`C9.3`)
**Covers:** Sprint 7 (2026-12-14 → 2026-12-25) · Sprint 8 (2026-12-28 → 2027-01-08) · Sprint 9
(2027-01-11 → 2027-01-22) · Sprint 10 (2027-01-25 → 2027-02-05) · Sprint 11 (2027-02-08 →
2027-02-19), and the `EP-15` foundations that Sprint 12 consumes
**Band:** M-061 … M-090 · **Continues from:** `Milestones_030-059.md` · **Continues in:**
`Milestones_090-119.md`
**Launch market:** **India** (`LAUNCH_MARKET_INDIA.md`) — INR/paise as `bigint`, `Asia/Kolkata`
**+05:30 with no DST**, GST 18% as CGST 9% + SGST 9%, FY 1 April – 31 March, **Razorpay Route**
behind the `PaymentProvider` port

---

## 0. What this file is

`SprintPlanning.md` sizes five sprints in engineer-days. `backlog/Epic_10.md` … `Epic_15.md` give
features and technical tasks. **This file is the layer between them: the ordered list of branches an
engineer actually cuts** through the membership lifecycle, the door, the CRM, the reviews and the
money subsystem. Every milestone below is one branch, one pull request, one squash-merge — sized so
that it lives ≤ 2 days per `PROJECT_CONSTITUTION.md` §23.1 criterion 15, and so that the repository
is **green** the moment it merges.

| This file decides | This file defers to |
| :--- | :--- |
| Build order, branch granularity, per-milestone acceptance and rollback | `SprintPlanning.md` Sprints 7–11 for goals, capacity, exit checklists — **restated, never changed** |
| Which exact files a branch touches | `FolderStructure.md` — every path below is quoted from it, §9 for `memberships/` in full |
| Which table, policy and grant land together | `Schema.md` §2.6/§2.7 and `MigrationStrategy.md` MG10, P9, CI-01, CI-02 |
| Which tests are written in which branch | `TestingStrategy.md` §2.1 file map, §4 layer definitions, §5 the isolation suite |
| Nothing about Definition of Ready or Definition of Done | `PROJECT_CONSTITUTION.md` §23 — **cited, never restated as a variant** |

**No application code exists.** Every fenced block in this document is labelled
`illustrative — not committed code` and is a shape sketch for a reviewer, never a patch.

### 0.1 The nine standing rules every milestone below obeys

| # | Rule | Consequence if broken |
| :-: | :--- | :--- |
| **R-1** | **2 to 6 hours for one engineer.** Larger is split at refinement; smaller is merged into its neighbour. | Estimation becomes guesswork (`§23.1` #15) |
| **R-2** | **The repository is green on merge.** Build succeeds, every wired gate passes, nothing is half-wired behind a comment. | A red trunk blocks 8 people |
| **R-3** | **Independently revertible.** Every milestone names its revert: a flag, a `git revert`, or an expand/contract phase. | `§16.7` rollback triggers become unactionable |
| **R-4** | **Buildable strictly in ascending id order.** Every `Depends on` cites a **lower** id. | The roadmap stops being a build order |
| **R-5** | **A milestone that adds an endpoint adds its isolation coverage in the same milestone.** `IS3` fails the build otherwise (`BAC-10`, `E2E-11`, `NFR-SEC-09`, DoD #16). | The suite silently lapses on a Friday |
| **R-6** | **A milestone that adds a tenant-owned table adds its RLS policy *and* its grants in the same migration file.** `MG10`, `P9`, `CI-01`, `CI-02`. | A table exists that every tenant can read |
| **R-7** | **A milestone that adds a table extends `prisma/seed/` and bumps `SEED_VERSION`.** Seed v1 completeness (`TestingStrategy.md` §6 — 3 tenants, 12 plans, 200 members, 5,000 attendance rows) is asserted at the **Sprint-8 exit**, and M-069 is the milestone that makes it assertable. | `IG-3`/`IG-4` fail for want of a tenant-B fixture |
| **R-8** | **Money is integer minor units end to end.** `Money` from `packages/utils/src/money/`, `round_half_even` once, `no-float-money` lint, `bigint` paise serialised as **strings** across the API boundary (`TR-38`, `T-15.35`). | `TR-05`: statements stop tying out, and `BAC-07` is a launch blocker |
| **R-9** | **Every time computation takes an explicit IANA zone argument.** No bare `new Date()` in domain code; no whole-hour UTC cron governs a local-time job. | `TR-24` (score 16) compounding `TR-07` — the +05:30 half-hour offset silently fires jobs 30 minutes late for every Indian tenant |

### 0.2 Inbound dependencies — what M-031 … M-060 must have delivered

This band starts from a repository where Sprint 0–6 is merged. The milestones below cite these ids;
if the M-031 … M-060 band is renumbered at refinement, **only this table changes.**

| Id | What it delivered that this file consumes |
| :--- | :--- |
| **M-033** | `branches`, `branch_hours` (multi-window per weekday) and `branch_hour_exceptions` — read by check-in step 7 |
| **M-037** | `plans` with `freeze_allowed`, `freeze_max_days`, `is_stackable`, `transfer_allowed`, `plan_type`, `sessions_total`, `access_window`, branch entitlement |
| **M-042** | The discovery read model and the gym detail composition — the surface `rating_avg` suppression lands on |
| **M-048** | `orders`, `order_items`, the `C4.2` order state machine, RLS and grants |
| **M-049** | `OrderPricingService` and server-side amount computation — no client-supplied amount is in the schema |
| **M-050** | `coupons`, `coupon_redemptions`, `Coupon.evaluate()` as the single evaluation path, `funding_source` |
| **M-053** | The `PaymentProvider` port and its provider-agnostic contract suite |
| **M-054** | The **Razorpay Route** adapter — order create, UPI-first, connected accounts |
| **M-056** | The webhook receiver and **webhook-exclusive activation**: `payment.captured` creates the `memberships` row at `PENDING` or `ACTIVE` (`BR-PAY-02`, ADR-0013). **This is the milestone that creates the `memberships` table** — see reconciliation R-M4 |
| **M-058** | Gapless per-tenant per-FY invoice numbering with documented void records |
| **M-059** | The India GST tax profile — CGST 9% + SGST 9%, IGST 18%, SAC 9997xx, place of supply |
| **M-060** | The deterministic Chromium invoice/statement renderer and its byte-identical checksum test |

Shared-kernel ids from `Milestones_000-029.md` are cited directly: **M-010** the Prisma
tenant-context client extension (ADR-0005), **M-013** `audit_log` and the `@Audited()` interceptor,
**M-014** `runElevated()`, **M-015** the cross-tenant isolation suite, **M-016** `Money` and the
`Clock` port, **M-017** `idempotency_keys`, **M-018** the transactional outbox and BullMQ harness,
**M-023** the `B3.2` permission matrix and `PermissionsGuard`.

### 0.3 Four reconciliations recorded before the list

| # | Tension | Ruling |
| :--- | :--- | :--- |
| **R-M4** | `EP-10` T-10.01 creates `memberships` in Sprint 7, but Sprint 6 activation (`M-056`) already writes membership rows. A table cannot be created after its first writer. | **`memberships` is created by M-056** with the six-label `membership_status_enum`, `start_date`/`end_date` as `date`, `CHECK (end_date >= start_date)`, `auto_renew DEFAULT false`, its RLS policy and grants. **M-061 takes ownership**: it adds `membership_events`, revokes the ad-hoc `status` write M-056 used, and routes every transition through the `C4.1` machine. `SprintPlanning.md` Sprint 7 says exactly this — *"activation creates the memberships this sprint manages"*. Recorded in `DECISION_LOG.md` by M-061. |
| **R-M5** | `EP-10` F-10.1 says the `C4.1` machine has **eleven edges**; `StateMachines.md` §4 tabulates **fifteen**, `SM-MEM-T01` … `SM-MEM-T15`. | `StateMachines.md` wins — it is the machine's specification. The transition table M-061 lands carries **all fifteen**. The five `refund.completed` edges (`T05`, `T12`, `T13`, `T14`, `T15`) are declared in the table with a guard that refuses them until `refunds/` exists; M-061's negative suite asserts they are **unreachable from any controller** until `EP-16` lands them in Sprint 12. The epic's "eleven" is the count `EP-10` itself drives. |
| **R-M6** | `A6.3` persists **eight** figures (`G`, `D`, `N`, `T`, `B`, `C`, `F`, `P`). `LAUNCH_MARKET_INDIA.md` §11 and `ERD.md` §12.4 add `commission_tax_minor` as a **ninth**, gated on open item **O-1** / `BLK-03` conflict 2. | M-088 persists the **eight `A6.3` figures**. M-089 adds `commission_tax_minor` **present and zero** with the `COMMISSION_TAX` enum value, so no DDL changes on adoption (`Schema.md` §14.3). If `BLK-03` conflict 2 is still open when Sprint 11 starts, M-089 ships with the column and the entry type and the rate resolving to 0 bps — **the schema decision is not deferred, only the rate is.** |
| **R-M7** | `EP-11` needs an `under_review` marker on `memberships` that `EP-10` owns; `EP-12` needs an at-risk baseline over `attendance` that `EP-11` owns; `EP-14` needs an attendance existence check that `EP-11` owns. Three cross-epic reaches. | None becomes a repository reach. `memberships/` exposes `membership-command.port.ts` (M-061); `attendance/ports/attendance-query.port.ts` is declared by `attendance/` in M-069 and consumed by `crm/` (M-081) and `reviews/` (M-083) through adapters named `attendance-attendance-query.adapter.ts`. `no-cross-module-repository` and `no-cross-module-internal` enforce it (`FolderStructure.md` §4 invariant 4). |

### 0.4 Sprint bands

| Milestones | Sprint | Theme | `C9.1` exit condition served |
| :--- | :-: | :--- | :--- |
| M-061 … M-068 | 7 | **Membership lifecycle** — the `C4.1` machine, freeze arithmetic, renewal, gym-timezone jobs, the reminder ladder, RBI-bound auto-renewal | `E7.1` … `E7.11` — ***`E2E-05` passes*** |
| M-069 … M-076 | 8 | **QR check-in and attendance** — Ed25519 tokens, the ten-step validation, the fifteen `C4.8` denials, the desk | `E8.1` … `E8.13` — ***`E2E-03` and `E2E-04` pass; `NFR-PERF-03` met*** · **Milestone M4** |
| M-077 … M-082 | 9 | **Branch scoping, staff and CRM** — `BranchScope`, invitations, the last-owner invariant, member list, Member 360, CSV import | `E9.1` … `E9.10` — ***`E2E-10` passes*** |
| M-083 … M-086 | 10 | **Reviews, moderation, aggregation and coupons** — earned reviews, screening that holds, the Bayesian split | `E10.1` … `E10.9` — ***`E2E-09` passes*** |
| M-087 … M-090 | 11 | **The ledger and settlement foundations** — append-only by grant, `A6.3` commission, the batch and its closure assertion | Toward `E11.1` … `E11.10` — ***`E2E-12` passes with zero variance*** |

### 0.5 Feature flags this band registers

Every one is added to `FEATURE_FLAGS.md` in the milestone that creates it, with its off-behaviour
stated (DoD §23.2 #32). `rel.memberships.freeze` (M-064) · `rel.memberships.auto-renewal` (M-068) ·
`rel.memberships.transfer` (registered M-062, **off**, endpoint returns 404 — descope **D-05**) ·
`rel.attendance.auto-checkout` (M-074) · `rel.attendance.sharing-detection` (M-075) ·
`release.attendance.realtime_transport` (M-075, Phase-2 placeholder, ADR-0010) ·
`rel.crm.at-risk-flagging` (M-081) · `release.coupons.bulk_codes` (M-086) ·
`rel.reviews.anomaly-detection` (M-085) · `ops.reviews.publication` (M-084 kill switch) ·
`mig.ledger.balance-projection` (M-087, **off**) · `rel.settlements.auto-payout` (M-090).

### 0.6 What this band deliberately does not carry

The **frontend lane** builds `SCR-WEB-008`/`-009`/`-010`, `SCR-DASH-007`/`-008`/`-014`/`-017`/`-018`/
`-019` and `SCR-ADM-007`/`-010`/`-012` inside the same sprints; they are tracked in the frontend
band, not here. The one screen in this file is **`SCR-DASH-009`** (M-076), because its acceptance is
a **performance and accessibility gate** (`NFR-PERF-03`, `NFR-USE-01` AA as a merge gate) rather than
a rendering task. Also **not** here: `FR-MEMB-11` transfer (MoSCoW `C`, descope **D-05**),
`FR-CRM-09` merge (**D-04**, taken at Sprint 9), `FR-STAF-08` roster (**D-03**, taken at Sprint 9),
`FR-CHK-13`/`FR-CHK-14` heatmap and digest (**D-09**, moved to Sprint 13), `FR-CPN-08` coupon
performance report (moved to Sprint 13 with the report harness), and all of `EP-16` — Sprint 12's
refunds, disputes and evidence packs continue in `Milestones_090-119.md`.

### 0.7 Index

| Id | Title | Sprint | Epic | Size | Role |
| :--- | :--- | :-: | :--- | :-: | :--- |
| M-061 | The `C4.1` machine and `membership_events` written atomically | 7 | EP-10 F-10.1/.2 | 6h | BE |
| M-062 | `membership_freezes`, the GiST concurrency constraint, `PurchasedTerms` | 7 | EP-10 F-10.4/.13 | 4h | BE |
| M-063 | The gym-timezone scheduling primitive (`TR-24`) | 7 | EP-10 F-10.16 | 3h | BE |
| M-064 | Freeze — plan gate, allowance under `FOR UPDATE`, exact extension | 7 | EP-10 F-10.4 | 6h | BE |
| M-065 | Early unfreeze recalculating to **actual** frozen days | 7 | EP-10 F-10.5 | 4h | BE |
| M-066 | Renewal creating a **new** membership; pro-rata upgrade; downgrade | 7 | EP-10 F-10.6/.7 | 6h | BE |
| M-067 | `membership.expire` and `membership.activate-pending` per gym zone | 7 | EP-10 F-10.9/.19 | 6h | BE |
| M-068 | The T−15/−7/−3/−1 ladder and RBI-bound auto-renewal | 7 | EP-10 F-10.10/.8 | 6h | BE |
| M-069 | `attendance` — monthly range partitioning from the first migration | 8 | EP-11 F-11.9 | 4h | BE |
| M-070 | Ed25519 token signing, `kid` rotation, a payload with no personal data | 8 | EP-11 F-11.1/.2 | 6h | BE |
| M-071 | The verifier, the 60-second server-time TTL, the Redis nonce | 8 | EP-11 F-11.4 | 4h | BE |
| M-072 | `FR-CHK-04` steps 1–6, first-failure, the fifteen `C4.8` codes | 8 | EP-11 F-11.3/.6 | 6h | BE |
| M-073 | Steps 7–10 — hours, plan window, cooldown, entitlement decrement | 8 | EP-11 F-11.3/.8 | 6h | BE |
| M-074 | Manual check-in, the seven-code override, check-out, reversals | 8 | EP-11 F-11.7/.8 | 6h | BE |
| M-075 | The two `CheckInRecorded` consumers — sharing scan and live counters | 8 | EP-11 F-11.12/.16 | 6h | BE |
| M-076 | `SCR-DASH-009` desk — `@zxing/browser`, p95 ≤ 2 s, WCAG AA gate | 8 | EP-11 F-11.14 | 6h | FE-dash |
| M-077 | `staff`, invitations with role and branch **fixed**, the last-owner guard | 9 | EP-13 F-13.1/.9 | 6h | BE |
| M-078 | `BranchScope` and the server-side scoping sweep | 9 | EP-13 F-13.3/.12 | 6h | BE |
| M-079 | Permission epoch, revocation preserving attribution, activity log | 9 | EP-13 F-13.4/.5/.10 | 4h | BE |
| M-080 | `members`, `member_notes`, `leads`; member code; walk-in; notes | 9 | EP-12 F-12.4/.5/.10 | 6h | BE |
| M-081 | Member list — nine filters, saved segments; Member 360; at-risk | 9 | EP-12 F-12.1/.2/.3/.6 | 6h | BE |
| M-082 | Streamed CSV bulk import — dry run, per-row errors, idempotent | 9 | EP-03 F-03.15 | 6h | BE |
| M-083 | `reviews` gated on a recorded check-in; **no `UPDATE`/`DELETE` grant** | 10 | EP-14 F-14.1/.2 | 6h | BE |
| M-084 | Screening that **holds**; one gym response; the report that never removes | 10 | EP-14 F-14.3/.5/.6 | 6h | BE |
| M-085 | Moderation, the Bayesian-versus-mean split, aggregation within 60 s | 10 | EP-14 F-14.7/.8/.9 | 6h | BE |
| M-086 | Coupon completion — scoping, bulk single-use codes, pause/resume | 10 | EP-07 F-07.13…18 | 4h | BE |
| M-087 | **`ledger_entries` — append-only by grant, not by discipline** | 11 | EP-15 F-15.1 | 6h | BE |
| M-088 | The **eight `A6.3` figures** persisted per transaction | 11 | EP-15 F-15.2 | 4h | BE |
| M-089 | Commission with the rate **frozen at sale**; `commission_tax_minor` | 11 | EP-15 F-15.3/.4/.16 | 6h | BE |
| M-090 | Settlement batch assembly and the `BR-FIN-03` closure assertion | 11 | EP-15 F-15.5/.14 | 6h | BE |

**Band total: 30 milestones · 163 focused hours · 20.4 engineer-days of demand.**

---

# PART A — SPRINT 7 · MEMBERSHIP LIFECYCLE (M-061 … M-068)

> **Sprint goal (`SprintPlanning.md` Sprint 7).** *"Make membership state unambiguous to the member,
> the gym, the door and the ledger simultaneously, in the gym's timezone."* Exit condition `C9.1`:
> ***`E2E-05` passes.*** Christmas sprint, capacity −10%; backend lands at 22.0/22.1 ed once
> `FR-MEMB-11` transfer (**D-05**) is dropped, which this band does by never scheduling it.

### M-061 — The `C4.1` machine and `membership_events` written atomically

| Field | Value |
| :--- | :--- |
| **Sprint** | 7 |
| **Epic** | EP-10 · F-10.1, F-10.2, F-10.12 · T-10.02, T-10.03, T-10.05, T-10.08 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — After this milestone `memberships.status` cannot change anywhere in the codebase except
through `Membership.transitionTo()`, and every change it makes writes exactly one
`membership_events` row inside the same transaction.

**Depends on** — M-056, M-013, M-016, M-018.

**Unblocks** — M-062, M-063, M-064, M-066, M-067, M-072, M-081, M-083.

**Files**

- `prisma/migrations/<ts>_create_membership_events/migration.sql` — header `phase: expand · rls: new table, policy in this migration (MG10) · grants: tenant INSERT+SELECT · append_only: YES · partitioned: no`. Columns `id`, `tenant_id`, `membership_id`, `from_status`, `to_status`, `reason_code`, `actor_type`, `actor_id`, `financial_reference_type`, `financial_reference_id`, `occurred_at`. RLS policy, `REVOKE UPDATE, DELETE`, index `(membership_id, occurred_at)`.
- The same migration adds the `AFTER UPDATE OF status` constraint trigger on `memberships` asserting one and only one `membership_events` row per status change in the transaction, and **revokes** the direct-`status` write path M-056 used.
- `apps/server/src/memberships/domain/membership-status.state-machine.ts` — the fifteen `SM-MEM-T01` … `SM-MEM-T15` edges **as data**, guard functions, `INVALID_MEMBERSHIP_TRANSITION` on any undefined pair.
- `apps/server/src/memberships/domain/membership-status.state-machine.spec.ts`
- `apps/server/src/memberships/domain/membership.entity.ts` · `membership.entity.spec.ts` — the aggregate root; `transitionTo()` the sole mutator; `status` has no public setter.
- `apps/server/src/memberships/domain/membership.errors.ts`
- `apps/server/src/memberships/application/ports/membership-event-repository.port.ts`
- `apps/server/src/memberships/infrastructure/membership-event.prisma-repository.ts` · `.int-spec.ts`
- `apps/server/src/memberships/ports/membership-command.port.ts` · `membership-query.port.ts` — the exported surface consumed later by `attendance/`, `crm/`, `reviews/`, `refunds/`.
- `packages/config/eslint/rules/no-membership-status-assignment.cjs` — bans assignment to `.status` outside `membership.entity.ts`.
- `packages/config/dependency-cruiser/index.cjs` — `membership-status.state-machine.ts` importable only from `memberships/domain/`.
- `apps/server/test/contract/memberships.contract-spec.ts` — extended with the status-projection equality case.

**Acceptance criteria**

1. Each of the fifteen `C4.1` edges succeeds under its stated guard and writes **exactly one** `membership_events` row carrying actor, reason and timestamp (`AC-EP10-01`, `BR-MEM-01-P1`, `INV-MEM-4`).
2. A table-driven case attempts **every** state pair not in `C4.1` — including `EXPIRED → ACTIVE`, the renewal trap — and each returns `INVALID_MEMBERSHIP_TRANSITION` with **no row written** (`AC-EP10-02`, `BR-MEM-01-N1`).
3. A direct repository write to `status` is refused: the ESLint rule fails the build, and the constraint trigger raises if the rule is bypassed. Two independent controls, one static and one in the database (`AC-EP10-03`, `E7.6`).
4. The five `refund.completed` edges (`T05`, `T12`–`T15`) exist in the table, are guarded closed, and are **unreachable from any controller** — asserted by enumerating the generated OpenAPI document (R-M5).
5. The member view and the gym view of a membership read the **same column**; the contract test asserts field-for-field equality of the status projection (`FR-MEMB-12`, `INV-MEM-6`, `AC-EP10-33`).
6. Every membership list query defaults to **all** statuses; the unfiltered count equals the sum of the per-status counts (`BR-MEM-12-N1`, `AC-EP10-34`).
7. `membership_events` is append-only at the **grant** level: the tenant application role holds `INSERT` and `SELECT` and nothing else, asserted in local, CI and development by `CI-02`.
8. RLS is on and forced; a tenant-B principal reading tenant A's events gets zero rows, not an error (`BR-TEN-01`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `membership-status.state-machine.spec.ts` — `SM-MEM-T01-P1` … `SM-MEM-T15-P1` | Unit | Each legal edge, each guard, each rejection reason |
| `membership-status.state-machine.spec.ts` — exhaustive negative | Unit | All 6×6 pairs minus the fifteen legal edges return `INVALID_MEMBERSHIP_TRANSITION` |
| `membership-event.prisma-repository.int-spec.ts` | Integration | The mandatory RLS assertion; one-event-per-transition trigger; `UPDATE` and `DELETE` raise `permission denied` |
| `membership.entity.spec.ts` | Unit | `transitionTo()` is the only mutator; the aggregate refuses a transition with no reason |
| `memberships.contract-spec.ts` — status projection | Contract | `/me/memberships/:id` and `/tenant/memberships/:id` emit an identical `status` block |
| `memberships.isolation-spec.ts` | Isolation | A1–A7 on the two existing membership routes, regenerated from the route inventory |

**Rollback plan** — Feature-flag-free; revert is a **contract-phase** operation. `git revert` the
application commit restores the M-056 activation path immediately. The migration is undone by a
follow-on contract migration dropping `membership_events` and the trigger — **not** before the
35-day PITR gate (`MigrationStrategy.md` §8.4), because a restore into the window would produce a
database with the trigger and code without it. Until then the table is harmless: nothing reads it.

**Notes** — The trap is the trigger's transaction scope. A constraint trigger declared
`DEFERRABLE INITIALLY DEFERRED` fires at commit, which is what makes "exactly one event per status
change" checkable; a plain `AFTER UPDATE` row trigger cannot see whether the event row arrives later
in the same transaction. Write it deferred, and write the negative test that a transaction changing
`status` twice with one event row **rolls back**.

---

### M-062 — `membership_freezes`, the GiST concurrency constraint and `PurchasedTerms`

| Field | Value |
| :--- | :--- |
| **Sprint** | 7 |
| **Epic** | EP-10 · F-10.4, F-10.13, F-10.15 · T-10.01, T-10.04, T-10.07, T-10.23 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — The database now refuses a second overlapping non-stackable membership at the same gym,
holds freeze intervals as real ranges, and carries the `under_review` marker as a column orthogonal
to `status`.

**Depends on** — M-061, M-037, M-048.

**Unblocks** — M-064, M-066, M-072, M-075.

**Files**

- `prisma/migrations/<ts>_create_membership_freezes/migration.sql` — `membership_freezes` (`tenant_id`, `membership_id`, `requested_start`, `requested_end`, `actual_end`, `days_debited`, `status`, `created_by`), RLS policy, grants, `CHECK (requested_end >= requested_start)`, exclusion constraint preventing two open freezes on one membership.
- `prisma/migrations/<ts>_expand_add_membership_concurrency_and_markers/migration.sql` — header `phase: expand · rls: unchanged · grants: unchanged`. Adds to `memberships`: `is_stackable boolean NOT NULL` snapshotted at purchase, `freeze_days_used int NOT NULL DEFAULT 0 CHECK (freeze_days_used >= 0)`, `under_review_since timestamptz NULL`, `under_review_reason text NULL`, `renewed_from_membership_id uuid NULL`. Adds the **GiST exclusion constraint** on `(user_id WITH =, gym_id WITH =, daterange(start_date, end_date, '[]') WITH &&) WHERE (is_stackable = false AND status IN ('PENDING','ACTIVE','FROZEN'))` and `CREATE EXTENSION IF NOT EXISTS btree_gist`.
- `prisma/migrations/<ts>_create_membership_transfers/migration.sql` — the append-only `membership_transfers` table, RLS, grants. Created now so `rel.memberships.transfer` has a home; the endpoint is **not** built (D-05).
- `apps/server/src/memberships/domain/entitlement.vo.ts` · `.spec.ts`
- `apps/server/src/memberships/domain/stackability.policy.ts` · `.spec.ts`
- `apps/server/src/memberships/domain/freeze.vo.ts` · `freeze-allowance.vo.ts` · `freeze-allowance.vo.spec.ts`
- `apps/server/src/memberships/application/ports/plan-terms.port.ts`
- `apps/server/src/memberships/infrastructure/adapters/plans-plan-terms.adapter.ts` · `ordering-order-snapshot.adapter.ts`
- `apps/server/src/memberships/infrastructure/freeze.prisma-repository.ts` · `.int-spec.ts`
- `prisma/seed/memberships.seed.ts` — a stackable pair, a non-stackable pair, an exhausted-allowance member; `SEED_VERSION` bumped.
- `docs/FEATURE_FLAGS.md` — `rel.memberships.transfer` registered **off**, off-behaviour: endpoint returns **404**, action absent from Member 360 (`AC-MEMB-08.4`).

**Acceptance criteria**

1. A second overlapping non-stackable membership at the same gym is refused by the **database** exclusion constraint, mapped to `422 CONCURRENT_MEMBERSHIP_CONFLICT`; two concurrent checkouts from two connections produce exactly one membership (`BR-MEM-04-N1`, `BR-MEM-04-N2`, `AC-EP10-30`).
2. Two **stackable** plans at the same gym coexist, and entitlement is consumed in expiry order, earliest first (`BR-MEM-04-P2`, `AC-EP10-31`).
3. `is_stackable`, `freeze_allowed`, `freeze_max_days`, `transfer_allowed`, `plan_type`, `sessions_total` and the access window are read from the **order snapshot**, never re-derived from the live plan; changing the plan afterwards does not change an existing membership's terms (`BR-PLN-02`, `T-10.04`).
4. `under_review_since` is a marker, not a seventh state: setting it leaves `status` untouched and `membership_events` records the flag as an event with `from_status = to_status` (`BR-MEM-13`, `CR-04`).
5. `freeze_days_used` cannot go negative — the `CHECK` raises, and the domain error maps to `422` rather than a 500.
6. `membership_transfers` exists with RLS, grants and no writer; the route-absence test asserts no `POST /v1/tenant/memberships/:id/transfer` operation is in the generated OpenAPI document while the flag is off.
7. The seed carries a stackable pair, a non-stackable pair and an allowance-exhausted member in **two** tenants, so `IG-3`/`IG-4` have a tenant-B fixture.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `freeze.prisma-repository.int-spec.ts` | Integration | RLS assertion; the exclusion constraint from **two connections**, not two sequential inserts |
| `stackability.policy.spec.ts` | Unit | Stackable coexistence; earliest-expiry consumption order |
| `freeze-allowance.vo.spec.ts` | Unit | Cap arithmetic at 0, at cap−1, at cap, at cap+1 |
| `entitlement.vo.spec.ts` | Unit | Snapshot immunity: mutating the live plan fixture changes nothing |
| `memberships.contract-spec.ts` — route absence | Contract | No transfer operation while `rel.memberships.transfer` is off |

**Rollback plan** — Expand-only, so revert is `git revert` of the application commit; the added
columns are nullable or defaulted and the old code ignores them (`MG2` compatibility). The exclusion
constraint is the one destructive-on-rollback element: dropping it is a separate contract migration,
and it is safe to leave in place because it only refuses writes the application already refuses.

**Notes** — `btree_gist` is required because the constraint mixes equality on two `uuid` columns
with `&&` on a `daterange`. Without it `CREATE CONSTRAINT` fails with a message about no default
operator class, and the instinct is to fall back to an application-level check. Do not: `BR-MEM-04`
is a **concurrency** rule and an application check loses the race that `AC-EP10-30` tests for.

---

### M-063 — The gym-timezone scheduling primitive (`TR-24`)

| Field | Value |
| :--- | :--- |
| **Sprint** | 7 |
| **Epic** | EP-10 · F-10.16 · T-10.09 |
| **Size** | 3h |
| **Role** | BE |

**Goal** — Every date question in the domain now takes an explicit IANA zone, and the scheduler can
name the UTC instant of the next local midnight for any zone — including `Asia/Kolkata`, whose
+05:30 offset no whole-hour cron can express.

**Depends on** — M-016, M-018.

**Unblocks** — M-064, M-065, M-066, M-067, M-068, M-073, M-079, M-084, M-090.

**Files**

- `apps/server/src/common/time/gym-timezone.ts` — `todayIn(zone: IanaTimeZone): LocalDate`, `nextLocalMidnightUtc(zone, from: Instant): Instant`, `nextLocalTimeUtc(zone, hhmm, from)`, `daysBetweenInZone(a, b, zone)`, `bucketTenantsByZone(rows)`. **Every signature takes the zone positionally and none defaults it.**
- `apps/server/src/common/time/gym-timezone.spec.ts`
- `apps/server/src/common/time/iana-time-zone.vo.ts` — a branded type validated against the ICU zone list at construction.
- `apps/server/src/memberships/application/ports/gym-timezone.port.ts`
- `apps/server/src/memberships/infrastructure/adapters/catalog-gym-timezone.adapter.ts`
- `packages/config/eslint/rules/no-bare-date.cjs` — bans `new Date()`, `Date.now()`, `dayjs()` with no argument inside `apps/server/src/**/domain/**` and `**/jobs/**`.
- `packages/config/eslint/index.cjs` — the rule wired at `error` for the two globs.
- `docs/engineering/StateMachines.md` §16 — no change; cited by the job milestones that follow.

**Acceptance criteria**

1. `nextLocalMidnightUtc('Asia/Kolkata', 2027-03-31T12:00:00Z)` returns **2027-03-31T18:30:00Z** — the half-hour offset is asserted as a literal, not computed by the test (`E7.5`, `AC-MEMB-05.5`).
2. `todayIn('Asia/Kolkata')` at the fixed instants `2027-03-31T18:29:59Z` and `2027-03-31T18:30:00Z` returns `2027-03-31` and `2027-04-01` respectively — the boundary pair used by every downstream job and read model (`TR-24`).
3. The same two functions are asserted against **two DST-observing seed zones**, at a spring-forward and an autumn-back instant, proving the implementation does not depend on India having no DST (`A11`, `OBJ-09`).
4. `IanaTimeZone` refuses `'IST'`, `'+05:30'`, `''` and `'Asia/Calcutta'`-with-a-typo at construction; a tenant row with an invalid zone fails at the adapter boundary with a named error, never silently as UTC.
5. `bucketTenantsByZone()` returns a stable, sorted map from zone to tenant ids — the input shape the hourly jobs consume, so no job ever iterates tenants one at a time.
6. The `no-bare-date` rule fails the build on a single bare `new Date()` added to `memberships/domain/`, proven by a fixture in the rule's own test.
7. No function in this file reads a process-wide default zone, and `TZ` is not consulted; the container's timezone is irrelevant to the result (`R-9`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `gym-timezone.spec.ts` — the +05:30 pair | Unit | The two literal instants of AC-2, and the 18:30 UTC boundary of AC-1 |
| `gym-timezone.spec.ts` — DST property | Unit | Round-trip `todayIn`/`nextLocalMidnightUtc` across a spring-forward and an autumn-back day in two zones |
| `iana-time-zone.vo.spec.ts` | Unit | The four rejected inputs; a valid zone survives serialisation |
| `no-bare-date.spec.mjs` | Unit (lint rule) | A bare `new Date()` in a `domain/` fixture is reported; one in a `controllers/` fixture is not |

**Rollback plan** — `git revert`. Nothing depends on it yet; it is consumed first by M-064. The lint
rule is the only part with blast radius, and it is additive: reverting it cannot break existing code.

**Notes** — The trap is `Intl.DateTimeFormat` returning a *formatted string* rather than an instant.
`nextLocalMidnightUtc` must be built by formatting the target zone's civil date, constructing the
civil midnight, and resolving it back through the zone's offset **for that date** — not by
subtracting a fixed offset. India makes this easy and therefore dangerous: the code that works for
`Asia/Kolkata` by subtracting 5.5 hours is exactly the code that breaks for `America/New_York` in
March, which is why AC-3 exists and why the seed carries DST-observing tenants.

---

### M-064 — Freeze: plan gate, allowance under `FOR UPDATE`, exact extension

| Field | Value |
| :--- | :--- |
| **Sprint** | 7 |
| **Epic** | EP-10 · F-10.4 · T-10.13 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A member with freeze days remaining can freeze a future range, and the membership's
`end_date` moves by **exactly** the frozen duration, computed in the gym's timezone, as one
indivisible operation that two concurrent requests cannot over-spend.

**Depends on** — M-062, M-063, M-017, M-023.

**Unblocks** — M-065, M-066, M-072, M-076.

**Files**

- `apps/server/src/memberships/controllers/membership.controller.ts` — `POST /v1/me/memberships/:id/freeze`, `Idempotency-Key` required, `membership-ownership.guard.ts` applied.
- `apps/server/src/memberships/controllers/tenant-membership.controller.ts` — the staff-initiated equivalent under `memberships.membership.freeze`.
- `apps/server/src/memberships/dto/freeze-membership.request.dto.ts` — `{ start_date, end_date, reason }`, Zod `.strict()`, dates as `LocalDate` strings.
- `apps/server/src/memberships/dto/membership.openapi.ts` — decoration; drift fails CI (`NFR-MNT-03`).
- `apps/server/src/memberships/application/freeze-membership.use-case.ts` · `.spec.ts`
- `apps/server/src/memberships/application/commands/freeze-membership.command.ts` · `freeze-membership.result.ts`
- `apps/server/src/memberships/domain/freeze-window.policy.ts` · `.spec.ts` — not retroactive, ≤ 30 days ahead, both evaluated at the **gym-timezone** day boundary.
- `apps/server/src/memberships/domain/validity-window.vo.ts` · `.spec.ts`
- `apps/server/src/memberships/domain/events/membership-frozen.event.ts`
- `apps/server/src/memberships/guards/membership-ownership.guard.ts` · `.spec.ts`
- `apps/server/test/isolation/memberships.isolation-spec.ts` — the freeze route's generated case group.
- `docs/FEATURE_FLAGS.md` — `rel.memberships.freeze`, off-behaviour: the endpoint returns 404 **and** the affordance is absent, never disabled (`AC-MEMB-01.5`).

**Acceptance criteria**

1. A freeze for 14 days extends `end_date` by **exactly 14 days**, computed in the gym's timezone; the response states the new end date before any notification is emitted (`E7.1`, `AC-MEMB-01.1`).
2. A plan with `freeze_allowed = false` returns `422 FREEZE_NOT_PERMITTED`, and the affordance is **absent** from the payload the UI renders — not present-and-disabled (`AC-EP10-08`, `BR-MEM-05-N1`, `AC-MEMB-01.5`).
3. Exhausting the allowance returns the **numbers**: days used, cap, days remaining — never a generic refusal (`AC-EP10-09`, `AC-MEMB-01.4`, `E7.4`).
4. A freeze starting yesterday returns `422 FREEZE_RETROACTIVE`; one starting in 31 days returns `422 FREEZE_TOO_FAR_AHEAD`; the boundaries at 0 and 30 days are asserted **at the gym-timezone day boundary**, not at UTC midnight (`AC-EP10-11`, `BR-MEM-07-N1`, `BR-MEM-07-N2`).
5. Two concurrent freezes that each fit the cap but jointly exceed it yield exactly **one** success and one `FREEZE_ALLOWANCE_EXHAUSTED` — the membership row is taken `SELECT … FOR UPDATE` and the allowance is read inside that lock (`AC-EP10-10`, `BR-MEM-05-N3`).
6. Requesting a freeze at 23:55 IST on the membership's `end_date` returns `422 MEMBERSHIP_EXPIRED` even though the hourly expiry job has not yet run — validity is evaluated, not inferred from `status` (`AC-MEMB-01.6`, `BusinessRules.md` §18.1).
7. `membership_freezes` gains one row, `memberships.freeze_days_used` is debited, `end_date` is extended and one `membership_events` row is written — **all four in one transaction**; a failure at any point leaves none of them.
8. The route appears in the isolation suite in this milestone: a tenant-B principal freezing a tenant-A membership receives `404`, and the audit row records the attempt (`R-5`, `BAC-10`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `freeze-membership.use-case.spec.ts` | Unit | The four refusal paths; the exact-extension arithmetic; event emission on success only |
| `freeze-window.policy.spec.ts` | Unit | Day 0 accepted, day −1 refused, day 30 accepted, day 31 refused — each at a fixed IST instant |
| `membership.prisma-repository.int-spec.ts` — concurrency | Integration | Two connections racing the cap; exactly one success; RLS assertion present |
| `memberships.contract-spec.ts` — freeze | Contract | Request/response match the generated OpenAPI; `Idempotency-Key` absence returns `400` |
| `memberships.isolation-spec.ts` — freeze route | Isolation | A1–A7 on `POST /v1/me/memberships/:id/freeze` |

**Rollback plan** — Flag `rel.memberships.freeze` → off. The endpoint returns 404 and the affordance
disappears; no data is lost and existing freezes continue to be honoured by the read model. The
schema landed in M-062 and is untouched here, so there is no migration to reverse.

**Notes** — The trap is doing the allowance check and the extension as two statements. They must be
one transaction with the membership row locked, because `BR-MEM-05` is a **budget** and every budget
in this system is a lost-update waiting to happen. The second trap is quieter: extending `end_date`
by adding days to a `timestamptz` gives 14×24 hours, which is not 14 days across a DST boundary.
`end_date` is a `date` and the arithmetic is calendar arithmetic in the gym's zone — which is why
this milestone depends on M-063 and not merely on `Money`/`Clock`.

---

### M-065 — Early unfreeze recalculating to **actual** frozen days

| Field | Value |
| :--- | :--- |
| **Sprint** | 7 |
| **Epic** | EP-10 · F-10.5 · T-10.14, T-10.15 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — Unfreezing on day 6 of a 14-day freeze moves the end date by **+6, not +14**, debits the
allowance by 6, and returns the membership to `ACTIVE` immediately.

**Depends on** — M-064.

**Unblocks** — M-067, M-072, M-076.

**Files**

- `apps/server/src/memberships/controllers/membership.controller.ts` — `POST /v1/me/memberships/:id/unfreeze`.
- `apps/server/src/memberships/dto/unfreeze-membership.request.dto.ts` — `{ effective_date }`, defaulting to `todayIn(gymZone)`.
- `apps/server/src/memberships/application/unfreeze-membership.use-case.ts` · `.spec.ts`
- `apps/server/src/memberships/application/commands/unfreeze-membership.command.ts` · `unfreeze-membership.result.ts`
- `apps/server/src/memberships/domain/events/membership-unfrozen.event.ts`
- `apps/server/src/memberships/jobs/membership-unfreeze-scheduled.processor.ts` · `.spec.ts` — hourly, closes freezes whose `requested_end` has passed in the gym's zone, idempotent, distributed-locked.
- `apps/server/src/memberships/jobs/index.ts` — the processor registered against the `C5` job catalogue.
- `apps/server/test/integration/memberships/freeze-arithmetic.int-spec.ts` — the `T-10.36` matrix.

**Acceptance criteria**

1. Unfreezing on day 6 of a requested 14-day freeze recalculates `end_date` to **+6** and sets `freeze_days_used` to the prior value **+6**; the freeze row's `actual_end` and `days_debited` record the same figure (`FR-MEMB-05`, `AC-MEMB-01.3`, `E7.3`).
2. The membership becomes `ACTIVE` immediately via `SM-MEM-T07`, and one `membership_events` row is written (`AC-EP10-12`).
3. If the recomputed `end_date` is already in the past in the gym's zone, the machine routes to `SM-MEM-T09` (`FROZEN → EXPIRED`) instead of `T07` — the freeze-then-expire edge case, tested explicitly (`StateMachines.md` `SM-MEM-T07` guard, `BusinessRules.md` §18.1).
4. `membership.unfreeze-scheduled` running hourly closes a freeze at its `requested_end` with the **full** requested days debited, and running it twice for the same freeze is a no-op (`C5`, idempotency).
5. Re-freezing after an early unfreeze is permitted while allowance remains, and the second freeze's bounds are evaluated against the **recomputed** `end_date` (`T-10.36` matrix rows 3 and 4).
6. Cancelling while `FROZEN` (`SM-MEM-T11`) closes the open freeze with its actual days and does **not** return the allowance to the member (`SM-MEM-T11` guard).
7. The unfreeze route carries its isolation case group in this milestone (`R-5`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `unfreeze-membership.use-case.spec.ts` | Unit | +6 not +14; allowance debited by actual; the `T07`/`T09` routing decision |
| `freeze-arithmetic.int-spec.ts` | Integration | The six-row matrix: freeze · unfreeze early · re-freeze · allowance exhausted · freeze-then-expire · freeze racing the expiry job (`BR-X-01`) |
| `membership-unfreeze-scheduled.processor.spec.ts` | Unit | Lock key construction; the processor holds no business logic; double-run is a no-op |
| `memberships.isolation-spec.ts` — unfreeze route | Isolation | A1–A7 |

**Rollback plan** — Behind the same `rel.memberships.freeze` flag as M-064; turning it off disables
both halves, which is correct — a freeze that cannot be ended is worse than no freeze at all. The
scheduled processor is deregistered by the same flag check inside `bootstrap`, so no orphan job
remains on the queue.

**Notes** — The trap is that "actual frozen days" is a **closed-range** count in the gym's zone, and
the off-by-one is real money: `daysBetweenInZone(start, effectiveDate, zone)` on an inclusive range
differs by one from the exclusive reading, and the difference is a day of gym access. Fix the
convention in `freeze.vo.ts`, assert it in the matrix, and never compute it at a call site.

---

### M-066 — Renewal creating a **new** membership; pro-rata upgrade; downgrade at next term

| Field | Value |
| :--- | :--- |
| **Sprint** | 7 |
| **Epic** | EP-10 · F-10.6, F-10.7 · T-10.16, T-10.17, T-10.18 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Renewal produces a **new** membership row whose term starts the day after the current one
ends, an upgrade charges only the differential on unused days, and a downgrade moves no cash at all.

**Depends on** — M-061, M-062, M-063, M-048, M-049.

**Unblocks** — M-067, M-076, M-088.

**Files**

- `apps/server/src/memberships/controllers/membership.controller.ts` — `POST /v1/me/memberships/:id/renew`.
- `apps/server/src/memberships/controllers/tenant-membership.controller.ts` — the staff renewal used by the expiring-this-week flow.
- `apps/server/src/memberships/dto/renew-membership.request.dto.ts` — `{ plan_id?, start_date? }`.
- `apps/server/src/memberships/application/renew-membership.use-case.ts` · `.spec.ts`
- `apps/server/src/memberships/application/upgrade-membership.use-case.ts` · `.spec.ts`
- `apps/server/src/memberships/application/schedule-downgrade.use-case.ts` · `.spec.ts`
- `apps/server/src/memberships/application/commands/renew-membership.command.ts` · `.result.ts` · `upgrade-membership.command.ts` · `.result.ts`
- `apps/server/src/memberships/domain/renewal-term.vo.ts` — day-after-end, or **today** if already expired.
- `apps/server/src/memberships/domain/proration.policy.ts` · `.spec.ts` — integer days × `Money`, `round_half_even`.
- `apps/server/src/memberships/application/ports/order-snapshot.port.ts` — extended with the differential-order creation contract.
- `packages/config/dependency-cruiser/index.cjs` — **`memberships/ → refunds/` forbidden**, so a downgrade has no path to a refund.
- `apps/server/test/integration/memberships/downgrade-ledger-diff.int-spec.ts`

**Acceptance criteria**

1. Renewing a membership ending on the 20th on the 18th starts the new term on the **21st**; renewing one that expired on the 10th when today is the 15th starts it **today** (`AC-MEMB-06.1`, `AC-MEMB-06.2`, `AC-EP10-19`, `E7.8`).
2. A **new** `memberships` row exists with `renewed_from_membership_id` set; the old row remains `EXPIRED`. **No row is reactivated** — `EXPIRED → ACTIVE` is not an edge of `C4.1` and M-061's negative suite already proves it (`AC-MEMB-06.4`, `C4.1` terminal rule).
3. The renewal is priced at the **current** published price, re-validated through the `BR-PLN-03` guard, and a price change since purchase is shown before confirmation and returns `422 PLAN_PRICE_CHANGED` if the client's quote is stale (`AC-MEMB-06.3`).
4. A pro-rata upgrade with 100 of 365 days used charges exactly the differential on the **265 unused days**, in integer paise, with `round_half_even` asserted to the paise; the quote shows unused days, credit and payable **before** confirmation (`AC-EP10-21`, `AC-MEMB-04.1`, `E7.9`).
5. On payment of the differential order the upgraded plan applies **from today** and the term end date is **unchanged** (`AC-MEMB-04.2`).
6. A downgrade is a **scheduled plan change** applied at next renewal: the current term is untouched, and a ledger diff across the operation shows **no `REFUND` entry and no gateway refund call** (`AC-EP10-22`, `BR-MEM-09-N1`, `AC-MEMB-04.3`).
7. Two upgrades submitted concurrently with the same `Idempotency-Key` produce exactly **one** differential order (`AC-MEMB-04.4`, `BR-PAY-03`).
8. `dependency-cruiser` fails the build on any import from `memberships/` into `refunds/` — the structural reason a downgrade cannot become a refund.
9. Both new routes carry their isolation case groups in this milestone (`R-5`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `renewal-term.vo.spec.ts` | Unit | Day-after-end; today-if-expired; the boundary when `end_date` is today in the gym's zone |
| `proration.policy.spec.ts` — property | Unit | Credit + charge re-sums **exactly** to the new plan price across randomised day counts and prices (`TR-05`) |
| `renew-membership.use-case.spec.ts` | Unit | A new aggregate is constructed; the predecessor is never mutated |
| `downgrade-ledger-diff.int-spec.ts` | Integration | `ledger_entries` before/after diff is empty; the `PaymentProvider` refund method is never invoked (spy) |
| `memberships.contract-spec.ts` — renew/upgrade | Contract | Quote shape; `422 PLAN_PRICE_CHANGED` payload |
| `memberships.isolation-spec.ts` — renew route | Isolation | A1–A7 on both new routes |

**Rollback plan** — `git revert`. No migration; the `renewed_from_membership_id` column landed in
M-062 and is nullable, so reverting the application leaves it unread. Any memberships already created
by a renewal remain valid — they are ordinary memberships, which is the point of the design.

**Notes** — The trap is the gapless term start when the predecessor is `FROZEN`. `end_date` at that
moment already includes the freeze extension, and it may still move if the member unfreezes early
after renewing. `renewal-term.vo.ts` therefore computes the start from the predecessor's `end_date`
**at the moment of renewal** and records it on the new row; it does not hold a reference that
re-reads. `AC-MEMB-02.3`'s successor-existence exclusion depends on that row existing, which is why
the expiring-this-week query in M-067 filters on `renewed_from_membership_id` and not on a flag.

---

### M-067 — `membership.expire` and `membership.activate-pending` per gym zone

| Field | Value |
| :--- | :--- |
| **Sprint** | 7 |
| **Epic** | EP-10 · F-10.9, F-10.19 · T-10.10, T-10.11, T-10.12, T-10.27, T-10.40 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Memberships expire and activate at **their own gym's local midnight**, on an hourly job
bucketed by IANA zone, and a missed bucket raises an alert rather than passing silently.

**Depends on** — M-063, M-065, M-066, M-018.

**Unblocks** — M-068, M-072, M-081.

**Files**

- `apps/server/src/memberships/jobs/membership-expire.processor.ts` · `.spec.ts` — hourly; buckets tenants by zone; selects `status IN ('ACTIVE','FROZEN') AND end_date < todayIn(zone)`; `SELECT … FOR UPDATE` per membership with `end_date` **re-read inside** the transaction; distributed lock keyed `membership.expire:{zone}:{localDate}`.
- `apps/server/src/memberships/jobs/membership-activate-pending.processor.ts` · `.spec.ts` — hourly; guards on not-cancelled, not-refunded, tenant not `CLOSED`; a `SUSPENDED` tenant does **not** block (`BR-TEN-05`, `INV-TEN-4`).
- `apps/server/src/memberships/application/expire-memberships.use-case.ts` · `.spec.ts`
- `apps/server/src/memberships/application/activate-pending-memberships.use-case.ts` · `.spec.ts`
- `apps/server/src/memberships/application/queries/expiring-memberships.query.ts` — the 7-day window in gym time with **successor-membership exclusion**, branch-scoped, one-tap contact payload.
- `apps/server/src/memberships/domain/events/membership-expired.event.ts`
- `apps/server/src/memberships/controllers/tenant-membership.controller.ts` — `GET /v1/tenant/memberships?expiring_within_days=7`.
- `infra/monitoring/alerts/membership-jobs.yaml` — duration alert, **missed-run detection per zone bucket**, affected-row-count gauge with an alert when rows cluster at `:00` UTC rather than at the expected local boundary.
- `docs/runbooks/memberships.md` — *the expiry job missed a zone*; *wrong-day expiry recovery*; *freeze racing expire*.
- `apps/server/test/integration/memberships/timezone-property.int-spec.ts` — the `T-10.35` suite.

**Acceptance criteria**

1. For a gym in `Asia/Kolkata` with a membership ending 31 March: at **17:30 UTC** (23:00 IST) it is still `ACTIVE` and admits; at **19:00 UTC** (00:30 IST on 1 April) it is `EXPIRED` and denies (`AC-MEMB-05.1`, `AC-MEMB-05.2`).
2. The job fires at **midnight gym-time**; for `Asia/Kolkata` a test asserts the 18:30 UTC boundary as a literal (`E7.5`, `AC-MEMB-05.5`).
3. Gyms in three zones including one DST-observing zone each expire at their **own** local midnight in the same job run (`AC-MEMB-05.4`).
4. No cron expression with a hard-coded minute field of `0` governs a local-time job; the schedule is a UTC instant derived per zone from `nextLocalMidnightUtc()` (`AC-MEMB-05.5`, R-9).
5. A `SESSION` plan whose `sessions_used` reaches `sessions_total` expires via `SM-MEM-T08` — evaluated **both** on the decrement path (M-073) and by this job, so exhaustion is never missed because nobody scanned again (`BR-PLN-06`, `T-10.12`).
6. `end_date` is re-read inside the locking transaction; a freeze committed between selection and update leaves the membership `FROZEN` with the extended date, not expired (`BR-X-01`, `BusinessRules.md` §18.1).
7. Running the job twice for the same zone and local date is a **no-op**: the distributed lock refuses the second, and the use case is idempotent even if the lock is lost.
8. The expiring-this-week list excludes members who have **already renewed**, and the exclusion is on the **existence of a successor membership**, not on a flag (`AC-MEMB-02.3`).
9. A missed zone bucket raises `gym.membership.expire.missed_bucket{zone}`; the alert is wired and its runbook entry exists (`NFR-MNT-06`, `T-10.40`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `timezone-property.int-spec.ts` | Integration | Validity, freeze extension, expiry and reminder selection across `Asia/Kolkata` and two DST zones at fixed instants `18:29:59Z` / `18:30:00Z` |
| `membership-expire.processor.spec.ts` | Unit | Lock key per zone and local date; no business logic in the processor; double-run no-op |
| `expire-memberships.use-case.spec.ts` | Unit | The `end_date` re-read; the `SESSION` exhaustion path; the `FROZEN → EXPIRED` edge |
| `expiring-memberships.query.spec.ts` | Unit | Successor exclusion; the 7-day window computed in gym time, not UTC |
| `memberships.isolation-spec.ts` — expiring list | Isolation | A1–A7 on `GET /v1/tenant/memberships` with the expiry filter |

**Rollback plan** — Deregister both processors from the `C5` catalogue and `git revert`. There is no
flag: a disabled expiry job is a correctness failure, not a feature toggle, and hiding it behind a
flag would let it be switched off in production by a config change with no review. Recovery from a
bad run is the runbook's *wrong-day expiry recovery* procedure — re-transition through `C4.1` with a
reason code, never a direct `UPDATE`.

**Notes** — The trap that this whole sprint exists to prevent: an hourly UTC cron with
`minute = 0` fires at 05:30, 06:30 … IST — that is, **30 minutes past every local hour** for every
Indian tenant. The membership expires half an hour late, every day, and no test catches it because
every test asserts "expired by tomorrow". `E7.5` asserts the *instant*, which is why it is phrased as
18:30 UTC and not as "midnight". The second trap: bucketing by zone is not the same as bucketing by
tenant — two tenants in the same zone must be one bucket, or the lock granularity is wrong and the
job self-throttles at 5,000 branches.

---

### M-068 — The T−15/−7/−3/−1 ladder and RBI-bound auto-renewal

| Field | Value |
| :--- | :--- |
| **Sprint** | 7 |
| **Epic** | EP-10 · F-10.8, F-10.10 · T-10.19, T-10.21, T-10.22 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Every expiring membership is told five times on a schedule the tenant can override, and
auto-renewal charges only where a live mandate, a dispatched pre-debit notice and an un-cancelled
flag all hold **inside** the charging transaction.

**Depends on** — M-067, M-053, M-021.

**Unblocks** — M-081, M-089.

**Files**

- `apps/server/src/memberships/jobs/membership-renewal-reminders.processor.ts` · `.spec.ts` — daily at **09:00 gym time**, selection on `(tenant_id, status, end_date)`, five offsets, outbox emission for `EP-17`.
- `apps/server/src/memberships/jobs/membership-auto-renew.processor.ts` · `.spec.ts` — daily; the `auto_renew` flag re-read **inside** the charging transaction; idempotency key per `(membership_id, period)`.
- `prisma/migrations/<ts>_create_membership_reminder_sends/migration.sql` — `membership_reminder_sends` with `UNIQUE (membership_id, offset_days)` as the send key, RLS, grants, append-only.
- `prisma/migrations/<ts>_expand_add_auto_renew_mandate_to_memberships/migration.sql` — `mandate_reference`, `mandate_max_amount_minor bigint`, `pre_debit_notified_at`, `auto_renew_disclosure_at`. `phase: expand · rls: unchanged`.
- `apps/server/src/memberships/controllers/membership.controller.ts` — `PATCH /v1/me/memberships/:id/auto-renew`.
- `apps/server/src/memberships/dto/set-auto-renew.request.dto.ts` — `{ is_enabled }`.
- `apps/server/src/memberships/application/set-auto-renew.use-case.ts` · `.spec.ts`
- `apps/server/src/memberships/domain/auto-renew-mandate.vo.ts` — opt-in, cancellable, pre-debit notice, per-transaction ceiling.
- `apps/server/src/memberships/domain/events/membership-renewal-due.event.ts`
- `apps/server/src/memberships/application/ports/reminder-schedule.port.ts` — the per-tenant override, validated and audited.
- `docs/FEATURE_FLAGS.md` — `rel.memberships.auto-renewal`, default **off**.
- `docs/LAUNCH_MARKET_INDIA.md` §7 — cited, not amended.

**Acceptance criteria**

1. The ladder fires **exactly five times** — T−15, T−7, T−3, T−1 and expiry — at **09:00 `Asia/Kolkata`**, on enabled channels only (`AC-EP10-26`, `BR-MEM-11-P1`, `E7.7`).
2. Re-running the reminder job for the same day sends nothing further; the send key `(membership_id, offset_days)` is **unique in the database**, not deduplicated in memory (`AC-EP10-27`, `BR-MEM-11-N1`).
3. A tenant override of the ladder is honoured, validated against the platform bounds, and is itself an **audited configuration change**; an invalid override falls back to the platform ladder rather than sending nothing (`AC-EP10-28`, `FR-MEMB-10`).
4. `memberships.auto_renew` defaults to `false` at the **schema** level, so opt-in is structural rather than a UI convention (`AC-MEMB-03.4`, `AC-EP10-23`).
5. The auto-renew job re-reads `auto_renew` **inside** the charging transaction and does not charge a membership cancelled after batch selection; the test cancels between selection and charge and asserts zero gateway calls (`AC-EP10-24`, `BR-MEM-10-N1`, `AC-MEMB-03.2`).
6. A **pre-debit notification** is dispatched in advance of the charge, its timestamp persisted, and the charge is refused if it is absent — RBI e-mandate rules make the notice a precondition, not a courtesy (`AC-MEMB-03.3`, `LAUNCH_MARKET_INDIA.md` §7).
7. The mandate's per-transaction ceiling is checked before the debit; a renewal priced above the registered ceiling **fails to a member-visible action**, never a silent skip (RBI e-mandate, `REG-01`).
8. Cancellation is self-service on `SCR-WEB-009`, requires no support contact, no phone call and no reason, and levies **no fee** (`AC-MEMB-03.1`, `BR-MEM-10`).
9. Cancelling the mandate does **not** stop the reminder ladder — a cancelled mandate is not an opt-out of being told the membership ends (`AC-MEMB-03.5`).
10. The `PATCH` route carries its isolation case group in this milestone (`R-5`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `membership-renewal-reminders.processor.spec.ts` | Unit | Five offsets, once each; 09:00 gym-time scheduling; tenant override resolution and fallback |
| `reminder-send-key.int-spec.ts` | Integration | The unique constraint refuses the duplicate; a re-run inserts zero rows |
| `membership-auto-renew.processor.spec.ts` | Unit | Flag re-read inside the transaction; cancel-after-selection yields zero charges; missing pre-debit notice refuses |
| `auto-renew-mandate.vo.spec.ts` | Unit | Ceiling comparison at, below and above the registered amount |
| `memberships.isolation-spec.ts` — auto-renew route | Isolation | A1–A7 |

**Rollback plan** — Flag `rel.memberships.auto-renewal` → off: the job deregisters, the `PATCH`
route returns 404, and existing mandates are left registered but undrawn — which is the safe
direction, because cancelling mandates on rollback would require a provider call that cannot be
undone. The reminder ladder is **not** behind the flag and stays on; it has no financial effect.

**Notes** — The trap is treating the pre-debit notice as a notification rather than as a
precondition. If the notice is emitted through the outbox and the charge proceeds in the same run,
a notification failure produces a charge with no notice — which is the exact RBI breach. The
sequence is: notify on day T−2, persist `pre_debit_notified_at`, and let the **next day's** job
find the notified cohort and charge it. Two runs, not one.

---

# PART B — SPRINT 8 · QR CHECK-IN AND ATTENDANCE (M-069 … M-076)

> **Sprint goal (`SprintPlanning.md` Sprint 8).** *"Deliver a rotating-token check-in that a
> receptionist can run one-handed on a tablet at peak hour, inside a 2-second client-observed
> budget."* Exit `C9.1`: ***`E2E-03` and `E2E-04` pass; `NFR-PERF-03` met.*** **Milestone M4** — the
> first QR check-in completes in staging. New Year sprint, capacity −10%; task 8.12 (heatmap and
> digest) is already moved to Sprint 13 as **D-09** and is therefore absent from this band.

### M-069 — `attendance` — monthly range partitioning from the first migration

| Field | Value |
| :--- | :--- |
| **Sprint** | 8 |
| **Epic** | EP-11 · F-11.9 · T-11.01, T-11.04, T-11.42 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — `attendance` exists partitioned by month from its very first migration, append-only at
the grant level, with the two indexes the 2-second path depends on — and partition maintenance is
wired with a failure alert before a single row is written.

**Depends on** — M-010, M-013, M-018.

**Unblocks** — M-070, M-071, M-072, M-073, M-074, M-075, M-081, M-083.

**Files**

- `prisma/migrations/<ts>_create_attendance_partitioned/migration.sql` — header `phase: expand · rls: new table, policy in this migration (MG10) · grants: tenant INSERT+SELECT · append_only: YES · partitioned: monthly RANGE on checked_in_at, IST month boundaries`. Columns `id`, `tenant_id`, `branch_id`, `membership_id` (nullable — `TRIAL_VISIT`), `member_id`, `staff_id`, `method` (`SCAN`/`MANUAL`/`OVERRIDE`), `result` (`ALLOWED`/`DENIED`), `denial_reason`, `override_reason`, `token_nonce`, `checked_in_at`, `checked_out_at`, `duration_minutes`, `reversal_of_id`, `correlation_id`.
- Same migration: `UNIQUE (token_nonce)`; `CHECK ((result = 'DENIED') = (denial_reason IS NOT NULL))`; `CHECK (method = 'SCAN' OR staff_id IS NOT NULL)`; indexes `(tenant_id, branch_id, checked_in_at)` and `(membership_id, checked_in_at DESC)`; RLS policy; `REVOKE UPDATE, DELETE ON attendance FROM app_tenant`; twelve initial monthly partitions plus a `DEFAULT` partition that **alerts if it ever receives a row**.
- `apps/server/src/attendance/attendance.module.ts` · `index.ts` · `README.md` · `permissions.ts`
- `apps/server/src/attendance/domain/attendance-record.entity.ts` · `.spec.ts`
- `apps/server/src/attendance/domain/check-in-method.vo.ts` · `check-in-result.vo.ts`
- `apps/server/src/attendance/infrastructure/attendance.prisma-repository.ts` · `.int-spec.ts`
- `apps/server/src/attendance/ports/attendance-query.port.ts` — declared here, consumed by `crm/` (M-081) and `reviews/` (M-083) per reconciliation R-M7.
- `apps/server/src/attendance/application/ports/attendance-repository.port.ts`
- `packages/config/scripts/append-only-grants.mjs` — extended to cover `attendance`; runs in CI and on every deploy.
- `infra/monitoring/alerts/partition-maintenance.yaml` — `TR-41` failure alert; an unnoticed maintenance failure stops writes.
- `prisma/seed/attendance.seed.ts` — 5,000 rows across two tenants and three months, completing seed v1 (`TestingStrategy.md` §6, R-7); `SEED_VERSION` bumped.

**Acceptance criteria**

1. `attendance` is **monthly-partitioned from its first migration**, not retrofitted; `pg_partitioned_table` confirms the RANGE strategy and twelve child partitions exist (`E8.12`, `NFR-SCAL-06`, `TR-14`).
2. Partition boundaries are **IST month boundaries** — the first partition begins at `2026-12-31T18:30:00Z`, asserted as a literal, so an Indian tenant's calendar month is one partition (`T-11.01`, R-9).
3. The tenant application role holds `INSERT` and `SELECT` only: `UPDATE` and `DELETE` raise `permission denied` in local, CI and development, asserted by `append-only-grants` (`BR-CHK-09`, `CI-02`).
4. RLS is enabled **and forced** on the parent and inherited by every partition; a partition-aware isolation assertion proves a tenant-B principal reads zero tenant-A rows from a child partition directly (`BR-TEN-01`, `T-11.39`).
5. `UNIQUE (token_nonce)` exists and is enforced **across partitions** — the constraint is declared on the partition key plus the nonce, or as a per-partition unique index with an application-level guarantee documented in `Constraints.md`; whichever is chosen is stated in the migration header.
6. The two `CHECK` constraints hold: a `DENIED` row without a reason is refused, and a `MANUAL`/`OVERRIDE` row without a `staff_id` is refused.
7. Partition maintenance is registered with `audit.partition-maintenance` and alerts on failure; a row landing in the `DEFAULT` partition raises `gym.attendance.default_partition_rows > 0` (`TR-41`, `TD-014`).
8. Seed v1 is complete: 3 tenants, 12 plans, 200 members, **5,000 attendance rows** — the Sprint-8 exit assertion from R-7 now passes.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `attendance.prisma-repository.int-spec.ts` | Integration | The mandatory RLS assertion; `UPDATE`/`DELETE` raise; insert routes to the correct partition |
| `attendance-partitioning.int-spec.ts` | Integration | Twelve partitions; IST boundary literal; a row for next January lands in the January partition |
| `append-only-grants.spec.mjs` | Unit | A synthetic `GRANT UPDATE` on `attendance` fails the check |
| `attendance-record.entity.spec.ts` | Unit | The entity exposes no mutator; a reversal is a **new** record referencing the original |
| `seed-v1.int-spec.ts` | Integration | Row counts per `TestingStrategy.md` §6; fixed uuids unchanged |

**Rollback plan** — Contract-phase. `git revert` removes the module; the table is dropped only by a
later contract migration and only after the 35-day PITR gate, because a restore into the window
would produce a database with partitions and code without them. No flag: an unreachable table is
already inert.

**Notes** — The trap is Prisma. Its diff engine does not know the partition scheme, the RLS policy
or the grants exist; a later `migrate dev` that decides to drop-and-create this table will emit SQL
that silently omits all three (`MigrationStrategy.md` §2.6). The three controls are already in place
— `migration-lint` rejecting `DROP TABLE` outside a contract migration, `CI-01`/`CI-02` querying the
live catalogue, and the reviewer reading the generated SQL — but this is the table where they matter
most, because a partition-less `attendance` will not fail until it has 18M rows.

---

### M-070 — Ed25519 token signing, `kid` rotation, a payload with no personal data

| Field | Value |
| :--- | :--- |
| **Sprint** | 8 |
| **Epic** | EP-11 · F-11.1, F-11.2 · T-11.02, T-11.03, T-11.41 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A member's app can obtain a detached-EdDSA-signed check-in token that carries no personal
data, names the key that signed it, and expires 60 seconds after issue — and the signing key can be
rotated with both keys valid during an overlap window.

**Depends on** — M-069, M-061.

**Unblocks** — M-071, M-076.

**Files**

- `apps/server/src/attendance/domain/check-in-token.vo.ts` · `.spec.ts` — the payload contract `{ membershipId, memberId, tenantId, iat, exp, nonce, kid }` as a closed type.
- `apps/server/src/attendance/domain/check-in-token.codec.ts` · `.spec.ts` — compact encoding, detached Ed25519 signature (`A-11`, `node:crypto` `sign`/`verify` with `Ed25519`).
- `apps/server/src/attendance/infrastructure/token-key-set.ts` — `kid`-indexed key set loaded from the **managed secret store**; no key material in `.env`, no key material in the image.
- `apps/server/src/attendance/infrastructure/token-key-set.int-spec.ts`
- `apps/server/src/attendance/application/issue-check-in-token.use-case.ts` · `.spec.ts`
- `apps/server/src/memberships/controllers/membership.controller.ts` — `POST /v1/me/memberships/:id/qr` returning `issue-qr-token.response.dto.ts` `{ token, expires_at, kid }`.
- `apps/server/src/memberships/dto/issue-qr-token.response.dto.ts`
- `infra/terraform/modules/secrets/checkin-keys.tf` — two key slots, `current` and `previous`, with the overlap window as a variable.
- `docs/runbooks/attendance.md` — **the Ed25519 key rotation runbook** with its overlap procedure, rehearsed once before Sprint 8 closes (`T-11.41`).
- `docs/engineering/Security.md` — no change; cited for `NFR-SEC-07` secret handling.

**Acceptance criteria**

1. Tokens are signed with **Ed25519** detached signatures; the algorithm is named in the token header and a token signed with any other algorithm is rejected at parse, not at verify (`A-11`, `BR-CHK-02`, `TR-09`).
2. The payload contains **no personal data** — no name, no phone, no email, no photo URL. A test decodes a live token and asserts the field set is exactly the seven declared keys; the type makes any other field **unrepresentable** (`BR-DAT-06`, `E8.10`, `AC-EP11-*`).
3. `exp − iat` is exactly **60 seconds** at issue; a request for a longer TTL is not expressible through the API surface (`BR-CHK-02`).
4. Every token carries a `kid`; the key set resolves `kid → public key` and a token whose `kid` is **retired** is rejected with `TOKEN_INVALID`, never with a message naming the key (`T-11.36`).
5. Key material is loaded from the managed secret store at boot and is **never** read from an environment file; a start-up assertion fails fast if the secret is absent, rather than generating a key (`NFR-SEC-07`).
6. Rotation keeps both keys valid for the configured overlap: a token signed by `previous` verifies during the window and fails after it, asserted by advancing the clock rather than by waiting.
7. The QR endpoint is rate-limited under an `RL-` class and refuses to issue for a membership that is not the caller's — the ownership guard applies before any signing work (`FR-RBAC-03`).
8. The route carries its isolation case group in this milestone (`R-5`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `check-in-token.codec.spec.ts` | Unit | Round-trip; signature over the exact canonical bytes; tampering any field fails verification |
| `check-in-token.vo.spec.ts` | Unit | The seven-key field set; a personal field is a **compile** error, proven by a `tsd` type test |
| `token-key-set.int-spec.ts` | Integration | Secret-store load; retired `kid` rejection; overlap window boundary with a stubbed clock |
| `issue-check-in-token.use-case.spec.ts` | Unit | 60 s TTL exactly; ownership refusal precedes signing |
| `attendance.isolation-spec.ts` — QR route | Isolation | A1–A7 on `POST /v1/me/memberships/:id/qr` |

**Rollback plan** — `git revert`. Nothing verifies these tokens yet (M-071 does), so a revert
removes an endpoint nobody depends on. The Terraform secret slots are left in place deliberately:
destroying key material on a code rollback would invalidate tokens issued in the last 60 seconds and
turn a deployment into a door outage.

**Notes** — The trap is choosing a JWT library. A JWT gives you `alg`, and `alg` gives you
`alg: none` and algorithm-confusion. This token is not a JWT: it is a compact custom encoding with
a **detached** Ed25519 signature over canonical bytes, and the verifier never reads an algorithm
from the token — it knows there is exactly one. The second trap is the nonce: it is generated here
but means nothing until M-071 reserves it, and a reviewer seeing an unused field will be tempted to
delete it. It is in the payload from the first commit because adding a field to a signed structure
later is a rotation, not an edit.

---

### M-071 — The verifier, the 60-second server-time TTL, the Redis nonce

| Field | Value |
| :--- | :--- |
| **Sprint** | 8 |
| **Epic** | EP-11 · F-11.4 · T-11.05, T-11.13 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — A presented token is verified against **server** time only, before any database read, and
scanning the same live token twice produces one attendance row and returns the original record.

**Depends on** — M-070, M-017.

**Unblocks** — M-072, M-073, M-074.

**Files**

- `apps/server/src/attendance/domain/check-in-token.verifier.ts` · `.spec.ts` — steps 1–2 of `FR-CHK-04`: signature, then expiry. Both execute **before any database access**.
- `apps/server/src/attendance/infrastructure/nonce-reservation.redis.ts` · `.int-spec.ts` — `SET nonce:{value} 1 NX EX 90`; the 90-second TTL deliberately exceeds the token's 60 so a replay at the boundary still collides.
- `apps/server/src/attendance/application/ports/nonce-reservation.port.ts`
- `apps/server/src/attendance/application/record-check-in.use-case.ts` — the insert-then-catch path on `UNIQUE (token_nonce)` returning the existing row.
- `apps/server/src/attendance/domain/attendance.errors.ts` — `TOKEN_INVALID`, `TOKEN_EXPIRED` mapped as **denial reasons inside a `200`**, not as HTTP errors (`API_Catalog.md` §6.1).
- `apps/server/src/common/time/clock-skew.guard.ts` — the documented grace margin, set **above** the NTP alert threshold of 250 ms.
- `infra/monitoring/alerts/clock-skew.yaml` — `QR_TOKEN_EXPIRED` clustering on one instance as the `TR-21` early-warning signal.
- `apps/server/test/integration/attendance/token-security.int-spec.ts` — the `T-11.36` suite.

**Acceptance criteria**

1. A screenshot of a **90-second-old** QR is denied `TOKEN_EXPIRED`, evaluated against **server** time; the device's clock is never consulted and no client-supplied timestamp appears in the request (`AC-CHK-01.3`, `E8.3`).
2. A token presented at 61 seconds is denied; at 59 seconds it is allowed; both asserted with a stubbed server clock, not with `setTimeout` (`AC-CHK-03.1`).
3. Steps 1 and 2 execute before any database read — proven by a spy on the Prisma client asserting **zero** queries on the forged-token and expired-token paths. This is what makes a forgery burst cheap to absorb (`T-11.05`, `NFR-PERF-08`).
4. Scanning the same live token twice produces **one** attendance row and returns the **original** record, not a second success (`BR-CHK-06`, `AC-CHK-01.4`, `E8.4`).
5. The nonce guarantee is **two-layered**: a Redis `SET NX` reservation for speed and `UNIQUE (token_nonce)` for durability. Losing Redis degrades latency, never correctness — the test kills Redis mid-suite and asserts the unique constraint still yields exactly one row.
6. A network interruption mid-scan leaves the operation completed **exactly once or not at all**; the standard `Idempotency-Key` mechanism applies as a second, independent guarantee alongside the nonce (`E8.5`, `AC-CHK-01.5`).
7. Device clock skew in **both** directions is tolerated by the documented grace margin, and the margin is larger than the NTP alert threshold so an alert always precedes a user-visible failure (`TR-21`).
8. A token from tenant A presented at tenant B's scanner returns `TOKEN_INVALID` — **not** `WRONG_BRANCH` — and discloses nothing about the membership's existence (`BR-CHK-03-N2`, `AC-EP11-14`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `token-security.int-spec.ts` | Integration | Forgery; replay inside and outside TTL; the 90-second screenshot; skew both directions; rotation overlap; retired `kid`; oversized TTL |
| `check-in-token.verifier.spec.ts` | Unit | Zero database calls on the two failure paths (Prisma spy) |
| `nonce-reservation.redis.int-spec.ts` | Integration | `SET NX` collision; the 90 s TTL; Redis-down degradation to the unique constraint |
| `record-check-in.use-case.spec.ts` | Unit | Insert-then-catch returns the original row, not a new one |

**Rollback plan** — `git revert`. The verifier has no callers until M-072; the Redis key namespace is
self-expiring, so nothing needs cleaning. Rolling back after M-072 is a different operation and is
covered there by the `ops.attendance.*` kill switch.

**Notes** — The trap is deriving "expired" from the token's own `exp` alone. `exp` is signed, so it
cannot be forged — but a server whose clock has drifted forward by three seconds rejects 5% of the
entire TTL window, and a server drifted backward accepts stale tokens. Both nodes are "correct"
about a signed value and disagree about reality. The rule is single-authority server time plus a
grace margin, plus the alert that fires **before** the margin is exhausted; `QR_TOKEN_EXPIRED`
clustering on one instance is the signal, and the runbook entry names it.

---

### M-072 — `FR-CHK-04` steps 1–6, first-failure, the fifteen `C4.8` codes

| Field | Value |
| :--- | :--- |
| **Sprint** | 8 |
| **Epic** | EP-11 · F-11.3, F-11.4, F-11.6 · T-11.06, T-11.07, T-11.10 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — `POST /v1/checkin/scan` exists and decides, and the first six steps of `FR-CHK-04` run in
the stated order and return the **first** failure as a `200` carrying one of the fifteen `C4.8`
codes — with an `attendance` row written on **every** exit, including the ones that resolve no
membership.

**Depends on** — M-023, M-061, M-069, M-070, M-071.

**Unblocks** — M-073, M-074, M-075, M-076, M-083.

**Files**

- `apps/server/src/attendance/domain/check-in-validation.sequence.ts` · `.spec.ts` — the ordered step list as **data**, each step a `(id, evaluate, denialReason)` triple, so the order is inspectable rather than expressed as nested `if`s.
- `apps/server/src/attendance/domain/denial-reason.vo.ts` · `.spec.ts` — the fifteen `check_in_denial_reason_enum` values, each carrying its `step`, its `overridable` flag and its `suggested_actions[]`; the `TENANT_SUSPENDED` sixteenth condition is modelled at step 5 as the specification states.
- `apps/server/src/attendance/application/use-cases/scan-check-in.use-case.ts` · `.spec.ts`
- `apps/server/src/attendance/application/services/denial-writer.service.ts` · `.spec.ts` — `BR-CHK-10`: one row per exit, written **before** the response is produced.
- `apps/server/src/attendance/controllers/check-in.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts`
- `apps/server/src/attendance/controllers/dto/scan-check-in.request.dto.ts` (Zod `.strict()`, `token` + `branch_id` only) · `check-in-result.response.dto.ts`
- `apps/server/src/attendance/infrastructure/adapters/membership-membership-query.adapter.ts` — the `memberships/` port consumed through `index.ts`, per reconciliation R-M7.
- `apps/server/src/attendance/attendance.i18n.ts` + `packages/i18n/src/en-IN/checkin.json` — two message keys per reason (staff and member phrasings, `§13.7 UM3`).
- `docs/apis/Membership.md` — no change; this milestone implements the frozen contract of §5.1 and §6.

**Acceptance criteria**

1. The six steps execute **in `FR-CHK-04` order** — signature, expiry, membership exists, status `ACTIVE`, tenant match, branch permitted — and a step-order test drives each one to failure *with every later step also failing* and asserts the **earlier** reason is returned (`AC-EP11-09`, `FR-CHK-04`).
2. Step 4 maps each non-`ACTIVE` status to its own code: `MEMBERSHIP_EXPIRED`, `MEMBERSHIP_FROZEN`, `MEMBERSHIP_PENDING_START`, `MEMBERSHIP_CANCELLED`, `MEMBERSHIP_REFUNDED`, `MEMBERSHIP_UNDER_REVIEW` — six distinct denials from one column (`C4.8`, `BR-MEM-06`, `BR-MEM-13`).
3. Steps 1, 3 and 5 all return `TOKEN_INVALID`, byte-identical on the wire, so a forged token cannot be used to probe whether a membership id exists or which tenant owns it (`BR-CHK-03-N2`, `BR-TEN-01`).
4. Step 6 reads `purchased_terms.entitled_branch_ids` from the **membership row snapshot**, never a live plan join, so a plan edited after sale cannot change who gets through the door (`BR-PLN-02`, M-062).
5. **A denial is a `200`,** not a `4xx`: the evaluation succeeded and produced an answer. The response body carries `result`, `denial_reason`, the resolved `message`, and `suggested_actions[]` as an **open** enum (`API_Catalog.md` §6.1, `apis/README.md` §1136).
6. `TENANT_SUSPENDED` fires only for suspension **for cause**. No file under `attendance/` reads `tenants.subscription_status` — asserted by a structural grep test, because `BR-TEN-06` says arrears never block an existing member (`INV-TEN-5`).
7. Every exit writes exactly one `attendance` row before responding, including `TOKEN_INVALID` with a `NULL` `membership_id`; a row counter runs across all fifteen branches (`BR-CHK-10`, `BR-CHK-10-N1`).
8. Isolation coverage lands in this milestone: a tenant-B principal scanning a tenant-A token gets `TOKEN_INVALID`, and `GET` of another tenant's attendance row is `404`, not `403` (R-5, `BAC-10`, `E2E-11`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `check-in-validation.sequence.spec.ts` | Unit | Step order with all-later-steps-failing; the returned reason is the earliest |
| `denial-reason.vo.spec.ts` | Unit | Fifteen values, no more; each carries step, overridability and actions; `DUPLICATE_WITHIN_COOLDOWN` and the five hard denials are non-overridable |
| `check-in.controller.int-spec.ts` | Integration | Six steps end-to-end against Testcontainers; a denial is `200`; one row per exit |
| `check-in.controller.isolation-spec.ts` | Isolation (`IS3`) | Cross-tenant token; cross-tenant read; no reason disclosure |
| `no-subscription-status-read.structure-spec.ts` | Structure | Zero occurrences of `subscription_status` under `src/attendance/**` |

**Rollback plan** — `git revert`. The controller is new, so reverting removes the route entirely;
`attendance` rows already written stay, which is correct — they are historical fact. No flag: the
kill switch `ops.attendance.*` is registered in M-074 once staff paths exist that would need
disabling independently of the scan path.

**Notes** — The trap is expressing the sequence as nested conditionals. It compiles, it passes the
happy path, and then someone reorders two branches during a refactor and the denial reason silently
changes for a class of members — with no failing test, because most suites assert *a* denial rather
than *which* denial. Modelling the order as data and asserting it as data is the only version of
this that survives six months. The second trap: step 6 is tempting to implement as a join to
`plan_branches`. That join is correct today and wrong the moment a gym edits the plan.

---

### M-073 — Steps 7–10 — hours, plan window, cooldown, entitlement decrement

| Field | Value |
| :--- | :--- |
| **Sprint** | 8 |
| **Epic** | EP-11 · F-11.3, F-11.8 · T-11.08, T-11.09, T-11.11 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — The check-in decision is complete: operating hours with exception override, the plan
access window, the duplicate cooldown and the session entitlement all evaluate in the gym's zone,
and an `ALLOWED` scan decrements `sessions_used` in the same transaction as the `attendance` insert.

**Depends on** — M-033, M-037, M-062, M-063, M-072.

**Unblocks** — M-074, M-075, M-076, M-081.

**Files**

- `apps/server/src/attendance/domain/operating-hours.evaluator.ts` · `.spec.ts` — multi-window `branch_hours` per weekday; `branch_hour_exceptions` for the date **overrides** the weekday entirely; the plan's 24-hour grant short-circuits both.
- `apps/server/src/attendance/domain/access-window.evaluator.ts` · `.spec.ts` — reads `purchased_terms.access_window`; an empty window means 24-hour, never "no access".
- `apps/server/src/attendance/domain/cooldown.evaluator.ts` · `.spec.ts` — most recent `ALLOWED` row for this membership **at this branch** within `cooldown_minutes` (tenant configuration, default 60).
- `apps/server/src/attendance/domain/entitlement.evaluator.ts` · `.spec.ts` — `sessions_total IS NULL` is a duration plan and always passes.
- `apps/server/src/attendance/infrastructure/branch-hours.cache.ts` · `.int-spec.ts` — Redis, 5-minute TTL, invalidated by the `branch.hours-changed` event; two cached reads is the step-7 budget.
- `apps/server/src/attendance/application/use-cases/scan-check-in.use-case.ts` — extended; the `ALLOWED` path becomes `INSERT attendance` + `UPDATE memberships SET sessions_used = sessions_used + 1` + `INSERT outbox` in **one** transaction.
- `apps/server/src/attendance/application/events/check-in-recorded.event.ts` — the outbox payload consumed in M-075 and M-081.
- `apps/server/src/memberships/application/ports/membership-command.port.ts` — extended with `consumeSession`, which is the only way `attendance/` mutates a membership (R-M7).
- `prisma/migrations/<ts>_add_attendance_decremented_entitlement/migration.sql` — header `phase: expand · rls: existing policy unchanged · grants: unchanged`; adds `decremented_entitlement boolean NOT NULL DEFAULT false`.

**Acceptance criteria**

1. A declared closure returns `GYM_CLOSED_EXCEPTION`, **not** `OUTSIDE_OPERATING_HOURS` — the `B5.13` edge case verbatim, asserted by `BR-CHK-05-N1`.
2. Multi-window hours work: a branch open 06:00–11:00 and 16:00–22:00 admits at 09:00 and 17:00 and denies at 13:00, all evaluated in `Asia/Kolkata` (`R-9`, `TR-24`).
3. A plan carrying 24-hour access short-circuits step 7 **and only step 7**; step 8 still evaluates, because a 24-hour building and an off-peak plan are independent facts.
4. `DUPLICATE_WITHIN_COOLDOWN` writes a row with `decremented_entitlement = false` and **no** `sessions_used` change; a test asserts the counter is unchanged after a duplicate scan (`BR-CHK-04-N1`, `C4.8` row 11).
5. The cooldown is scoped **per branch**: the same member scanning at Bandra West and then Andheri East inside the window is allowed twice, because two branches is two visits.
6. On `ALLOWED` for a session plan the insert, the decrement and the outbox row commit **atomically**; a failure injected between them leaves zero rows and zero decrements (`BR-CHK-06`, `M-018`).
7. Exhausting the last session decrements to `sessions_total` and lets the `C4.1` machine expire the membership through `M-061`'s transition path — `attendance/` never writes `memberships.status` directly (`BR-PLN-06`, R-M7).
8. The whole ten-step evaluation completes within the server-side portion of the `NFR-PERF-03` budget with **≤ 3 database round trips** on the allowed path, asserted by a query counter in the integration test.
9. Isolation coverage extends to the new reads: branch hours for tenant A are unreadable under tenant B's context even though the branch id is guessable (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `operating-hours.evaluator.spec.ts` | Unit | Multi-window; exception overrides weekday; midnight-crossing window; 24-hour short-circuit |
| `cooldown.evaluator.spec.ts` | Unit | Per-branch scoping; boundary at exactly `cooldown_minutes`; a `DENIED` row does not start a cooldown |
| `scan-check-in.use-case.spec.ts` | Unit | Atomicity of insert + decrement + outbox; duplicate decrements nothing |
| `check-in-full-sequence.int-spec.ts` | Integration | All ten steps; all fifteen reasons individually reproducible (`D-11.7`); round-trip counter |
| `branch-hours.cache.int-spec.ts` | Integration | TTL; invalidation on `branch.hours-changed`; a cache miss is still correct |

**Rollback plan** — `git revert` for the code. The `decremented_entitlement` column is **expand
phase** — nullable-with-default, written but not yet read by any report, so reverting the code
leaves a harmless column. Contract is scheduled with the Sprint-13 reporting work, not here.

**Notes** — The trap is the midnight-crossing window. A branch open 05:00–01:00 has an interval that
ends on the *next* calendar day, and naive `time` comparison denies everyone between midnight and
01:00 — in the gym's zone, on a day the gym is demonstrably open. The evaluator normalises to an
instant range anchored on the gym's local date before comparing, and the test that catches this
scans at 00:30 IST. Second trap: caching branch hours is necessary for the 2-second budget and is
the exact thing that will serve stale hours on the day a gym changes them for Diwali. Hence the
event-driven invalidation rather than TTL alone.

---

### M-074 — Manual check-in, the seven-code override, check-out, reversals

| Field | Value |
| :--- | :--- |
| **Sprint** | 8 |
| **Epic** | EP-11 · F-11.7, F-11.8, F-11.10 · T-11.15, T-11.16, T-11.17 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A member without a working phone can be admitted, a denial can be overridden by named
staff with a structured reason, a visit can be closed, and a mistake can be undone — all without any
path that mutates or deletes an `attendance` row.

**Depends on** — M-023, M-069, M-072, M-073.

**Unblocks** — M-075, M-076, M-079, M-081.

**Files**

- `apps/server/src/attendance/application/use-cases/manual-check-in.use-case.ts` · `.spec.ts` — runs the **full** `FR-CHK-04` sequence with steps 1 and 2 replaced by member lookup (`apis/Membership.md` §14).
- `apps/server/src/attendance/application/use-cases/override-check-in.use-case.ts` · `.spec.ts`
- `apps/server/src/attendance/application/use-cases/check-out.use-case.ts` · `.spec.ts` — writes `checked_out_at` and `duration_minutes`; this is the **one** permitted mutation and it is a column the append-only grant carve-out names explicitly.
- `apps/server/src/attendance/application/use-cases/reverse-check-in.use-case.ts` · `.spec.ts` — writes a **new** row with `reversal_of_id`; nothing is deleted.
- `apps/server/src/attendance/domain/override-reason.vo.ts` · `.spec.ts` — the seven `C4.8` override reasons as a closed enum.
- `apps/server/src/attendance/controllers/manual-check-in.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts`
- `apps/server/src/attendance/controllers/override.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts`
- `apps/server/src/attendance/attendance.permissions.ts` — `attendance.checkin.manual` and `attendance.checkin.override` as **distinct** permissions; `TRAINER` holds the first and not the second (`B3.2`, `SCR-DASH-009` header row).
- `prisma/migrations/<ts>_attendance_checkout_grant_carveout/migration.sql` — header `phase: expand · grants: GRANT UPDATE (checked_out_at, duration_minutes) ON attendance TO app_tenant`; column-level, nothing wider.
- `apps/server/src/attendance/jobs/attendance-auto-checkout.job.ts` · `.spec.ts` — behind `rel.attendance.auto-checkout`; closes open visits at the tenant-configured duration using the M-063 zone primitive.
- `docs/FEATURE_FLAGS.md` — `rel.attendance.auto-checkout` (**off**: visits stay open, `duration_minutes` stays null) and `ops.attendance.manual_paths` kill switch (**off**: manual and override return `503`, the scan path is untouched).

**Acceptance criteria**

1. Manual check-in runs steps 3–10 unchanged. A frozen membership is refused manually exactly as it is refused by scan; the only way in is an override with a reason (`BR-MEM-06-N1`).
2. An override without one of the **seven** `C4.8` reasons is rejected **at the pipe** with `400 OVERRIDE_REASON_NOT_IN_TAXONOMY`; free text alone is refused, and free text is required *in addition* where the reason is `OTHER` (`RS4`, `AC-CHK-05.1`).
3. Override is refused with `422` on `MEMBERSHIP_CANCELLED`, `MEMBERSHIP_REFUNDED`, `DUPLICATE_WITHIN_COOLDOWN`, `TOKEN_EXPIRED`, `TOKEN_INVALID` and `TENANT_SUSPENDED`; `MEMBERSHIP_UNDER_REVIEW` is permitted only for `GYM_MANAGER` and `GYM_OWNER` (`C4.8` note 6, §9.4).
4. An override **does** decrement a session entitlement, except when the reason is `TRIAL_VISIT` — the resolution recorded against `OQ-11.g`.
5. `method` is written honestly: `SCAN`, `MANUAL` or `OVERRIDE`, never laundered. `CHECK (method = 'SCAN' OR staff_id IS NOT NULL)` makes an unattributed manual row unrepresentable (`BR-CHK-08` `L1-DB`).
6. Branch scope is enforced as **refusal**, not filtering: staff not assigned to the branch get `403 BRANCH_NOT_ASSIGNED_TO_STAFF`, and no list is silently narrowed (`FR-STAF-03`, `BR-CHK-08` `L7-GUARD`). The full `BranchScope` object arrives in M-078; this milestone consumes the session's assigned-branch set directly and M-078 replaces the call site.
7. A reversal creates a **new** row referencing the original and re-credits the session if one was consumed; the original row is byte-unchanged, proven by comparing a row hash before and after (`BR-CHK-09`).
8. The column-level `UPDATE` grant covers `checked_out_at` and `duration_minutes` **only**; `append-only-grants` asserts that an attempt to update `result`, `denial_reason` or `checked_in_at` still raises `permission denied`.
9. Every manual, override, check-out and reversal action is `@Audited()` with actor, member, branch, reason and correlation id (`BR-DAT-01`, `FR-STAF-05`).
10. Isolation coverage for both new controllers ships here (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `override-reason.vo.spec.ts` | Unit | Seven values; the six non-overridable denials; the `MANAGER`/`OWNER` gate on `UNDER_REVIEW` |
| `manual-check-in.use-case.spec.ts` | Unit | Steps 3–10 run; steps 1–2 skipped; frozen still refused |
| `override.controller.int-spec.ts` | Integration | Pipe rejection; `422` set; `TRIAL_VISIT` does not decrement; audit row written |
| `attendance-append-only.int-spec.ts` | Integration | Column-level grant boundary; reversal leaves the original unchanged |
| `attendance-branch-refusal.int-spec.ts` | Integration | `403` rather than an empty list, for both endpoints |
| `manual-check-in.controller.isolation-spec.ts` | Isolation (`IS3`) | Cross-tenant member id; cross-tenant branch id |

**Rollback plan** — `ops.attendance.manual_paths` off returns `503` on both new endpoints and leaves
the scan path fully operational — which is the point of separating them. `rel.attendance.auto-checkout`
off stops the job. The grant migration is expand-phase; its contract is a `REVOKE`, which is
instantaneous and safe at any time.

**Notes** — The trap is treating the check-out grant as "the append-only rule has an exception".
It does not: the rule is expressed as a **column-level** grant, so the exception is enumerable and
CI can assert its exact shape. The moment someone widens it to `GRANT UPDATE ON attendance`, the
append-only check fails, which is the design. Second trap: an override that silently succeeds
without decrementing looks generous and produces a session pack that never exhausts.

---

### M-075 — The two `CheckInRecorded` consumers — sharing scan and live counters

| Field | Value |
| :--- | :--- |
| **Sprint** | 8 |
| **Epic** | EP-11 · F-11.12, F-11.16 · T-11.20, T-11.21, T-11.24 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — The events the door emits become two products: a sharing-detection signal that flags and
never blocks, and the single live-occupancy endpoint the dashboard polls — with polling, not
sockets, as `A-08` requires for Phase 1.

**Depends on** — M-018, M-069, M-073, M-074.

**Unblocks** — M-076, M-081.

**Files**

- `apps/server/src/attendance/application/consumers/sharing-detection.consumer.ts` · `.spec.ts` — behind `rel.attendance.sharing-detection`; the `BR-CHK-07` signals — the same nonce at two branches, implausible inter-branch travel time, and a scan cadence inconsistent with one human.
- `apps/server/src/attendance/domain/sharing-signal.evaluator.ts` · `.spec.ts` — pure, deterministic, no clock of its own.
- `apps/server/src/attendance/application/consumers/live-occupancy.consumer.ts` · `.spec.ts` — maintains a Redis counter per `(tenant_id, branch_id)` with a rebuild-from-database path so a lost Redis is self-healing.
- `apps/server/src/attendance/controllers/live-attendance.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts` — `GET /v1/tenant/attendance/live` **and nothing else** (`ui/GymDashboard.md` §185): current count, the recent-check-ins strip, `generated_at`.
- `apps/server/src/attendance/controllers/dto/live-attendance.response.dto.ts` — `generated_at` is mandatory so the client can render *"updated N seconds ago"* honestly.
- `apps/server/src/attendance/jobs/occupancy-rebuild.job.ts` · `.spec.ts` — every 5 minutes, recount from `attendance` and correct drift; the counter is a cache, never a source.
- `infra/monitoring/alerts/attendance-occupancy-drift.yaml` — alerts when a rebuild corrects by more than a configured delta.
- `docs/FEATURE_FLAGS.md` — `rel.attendance.sharing-detection` (**off**: no flags raised, check-ins unaffected) and `release.attendance.realtime_transport` (**off**, Phase-2 placeholder, ADR-0010).

**Acceptance criteria**

1. Sharing detection **flags and never blocks**. There is no code path from a sharing signal to a denial, asserted structurally: `sharing-detection.consumer.ts` has no import reaching the validation sequence (`BR-CHK-07`, `dependency-cruiser`).
2. The `409 IDEMPOTENCY_FINGERPRINT_MISMATCH` case — the same nonce presented at a **different branch** — raises the highest-confidence signal, because it is physically impossible rather than merely suspicious (`ui/GymDashboard.md` §11.4).
3. Both consumers are **idempotent**: the outbox delivers at-least-once, and replaying the same `CheckInRecorded` message produces one flag and one counter increment, keyed on the attendance row id (`M-018`).
4. `GET /v1/tenant/attendance/live` returns in ≤ 200 ms p95 and is served from Redis, not from a `COUNT(*)` over a partitioned table — a Prisma spy asserts zero aggregate queries on the hot path (`NFR-PERF-08`).
5. The endpoint is **branch-scoped**: a receptionist assigned to one branch sees that branch's number, and the response names which branch it is, so a wrong number is never ambiguous.
6. The 5-minute rebuild corrects drift, and the correction is **observable** — `gym.attendance.occupancy_drift` is emitted every run, target zero.
7. Phase 1 is **polling**. No Socket.IO dependency is added to `package.json`, asserted by a dependency test; `release.attendance.realtime_transport` exists only to record the Phase-2 seam (`A-08`, ADR-0010).
8. Isolation coverage: the live endpoint under tenant B returns tenant B's count even when tenant A's branch id is supplied explicitly (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `sharing-signal.evaluator.spec.ts` | Unit | Each signal in isolation; two signals required to flag; a genuine two-branch member in one day does **not** flag |
| `sharing-detection.consumer.spec.ts` | Unit | Replay idempotency; no path to denial |
| `live-attendance.controller.int-spec.ts` | Integration | Redis-served; branch scoping; `generated_at` present; zero aggregate queries |
| `occupancy-rebuild.job.spec.ts` | Unit | Drift correction; metric emitted; counter treated as cache |
| `no-socket-io.dependency-spec.ts` | Structure | No realtime transport package in the server manifest |

**Rollback plan** — `rel.attendance.sharing-detection` off silences the consumer with no effect on
check-in. The live endpoint has no flag because it is read-only and additive; `git revert` removes
it and `SCR-DASH-001`/`SCR-DASH-009` degrade to a static strip, which is the documented off-state.

**Notes** — The trap is the false positive that becomes an accusation. A member who trains at two
branches in one day is normal; a family sharing one QR is not; the evaluator cannot tell them apart
from a single signal, which is why two are required and why the outcome is a flag on a staff screen
rather than a locked door. The second trap is the occupancy counter drifting quietly for a week
because nobody reads it — hence the rebuild that reports its own correction rather than silently
fixing it.

---

### M-076 — `SCR-DASH-009` desk — `@zxing/browser`, p95 ≤ 2 s, WCAG AA as a merge gate

| Field | Value |
| :--- | :--- |
| **Sprint** | 8 |
| **Epic** | EP-11 · F-11.14 · T-11.30, T-11.31, T-11.47 |
| **Size** | 6h |
| **Role** | FE-dash |

**Goal** — Sameer can serve a queue of ten from a tablet: the camera never closes, the search field
is always listening, a result clears itself, and the whole scan-to-confirmation path is measured at
p95 ≤ 2 s in CI rather than asserted in a review comment.

**Depends on** — M-072, M-073, M-074, M-075.

**Unblocks** — the Sprint-8 exit (`E8.1`…`E8.13`, Milestone **M4**).

**Files**

- `apps/gym-dashboard/src/routes/checkin-desk.route.tsx`
- `apps/gym-dashboard/src/features/checkin-desk/CheckInDeskScanner.tsx` — `@zxing/browser` **dynamically imported by this feature only** (`A-10`, FP3), so no other route pays the bundle.
- `apps/gym-dashboard/src/features/checkin-desk/CheckInResultPanel.tsx` · `CheckInDenialPanel.tsx` · `RecentCheckInsStrip.tsx` · `ManualSearchField.tsx` · `OverrideDialog.tsx` · `BranchBinder.tsx`
- `apps/gym-dashboard/src/features/checkin-desk/use-check-in-scan.hook.ts` — sends `Idempotency-Key: <token_nonce>`, **not** a fresh UUID, and reuses it on retry.
- `apps/gym-dashboard/src/features/checkin-desk/use-live-strip.hook.ts` — TanStack Query polling at the configured interval; the **confirmation is never polled** (LC7).
- `apps/gym-dashboard/src/features/checkin-desk/local-nonce-dedupe.ts` · `.spec.ts` — a camera reading one code five times in 200 ms produces one interaction.
- `packages/ui/src/components/ResultBanner.tsx` — tick + word + colour, three carriers, because colour is never the sole carrier (`AX9`).
- `apps/gym-dashboard/e2e/checkin-desk.spec.ts` (Playwright) · `apps/gym-dashboard/e2e/checkin-desk.a11y.spec.ts` (axe-core)
- `tests/perf/k6/checkin-desk-scan.js` — the `NFR-PERF-03` gate.
- `docs/ui/GymDashboard.md` — no change; this milestone implements §11.

**Acceptance criteria**

1. **p95 ≤ 2 s, client-observed, scan → confirmation**, measured in CI on the reference tablet profile and failing the build above it (`NFR-PERF-03`, `SCR-DASH-009` Budget row).
2. The camera stream is **held open** across check-ins and is not stopped on success; a test asserts exactly one `getUserMedia` call across ten consecutive scans (§11.3 behaviour 1, FP6).
3. Any keypress anywhere on the screen focuses the manual search field, unless focus is already in a text input (§11.3 behaviour 2).
4. The result panel auto-clears after the tenant-configured interval, default 5 s, and **Keep on screen** cancels the timer; a new valid scan **replaces** a displayed result immediately (§11.3 behaviours 3 and 4).
5. `branch_id` comes from the **station binding**, never from the token; the bound branch is visible in the header and persists across reloads (§11.4).
6. Each of the five contract responses renders its own state: `200 ALLOWED`, `200 DENIED` with reason and actions, `409 IDEMPOTENCY_FINGERPRINT_MISMATCH` as the distinct *"used at another branch — do not admit"* state, `409 MEMBERSHIP_AMBIGUOUS` as a two-item chooser defaulting to the soonest expiry, and `403 BRANCH_NOT_ASSIGNED_TO_STAFF`.
7. `attendance.checkin.override` is a **distinct** permission: a `TRAINER` sees the denial and no override affordance, and hiding it is a convenience — the server refuses regardless (`B3.2`).
8. **WCAG 2.1 AA is a merge gate.** axe-core reports zero violations on every state, the whole flow is keyboard-operable without the camera, and a manual keyboard plus screen-reader pass is recorded each release (`NFR-USE-01`, `AX1`, `ui/GymDashboard.md` §304).
9. At `md` portrait no primary action sits above 60% screen height — one-handed operation as a testable layout constraint (`NFR-USE-09`, `AX6`).
10. The device clock is never transmitted; the header clock is display-only and labelled IST.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `checkin-desk.spec.ts` | E2E (Playwright) | `E2E-03` scan-to-allowed; `E2E-04` scan-to-denied; queue of ten with the camera held open; nonce reuse on retry |
| `checkin-desk.a11y.spec.ts` | E2E (axe-core) | Zero violations on ready, success, denial, ambiguous, refused and offline states |
| `local-nonce-dedupe.spec.ts` | Unit | Five decodes in 200 ms → one request |
| `use-check-in-scan.hook.spec.ts` | Unit | `Idempotency-Key` is the nonce; retry reuses it; no clock sent |
| `checkin-desk-scan.js` | Performance (k6) | p95 ≤ 2 s at 500 check-ins/minute platform-wide (`NFR-PERF-08`) |
| `checkin-desk-portrait.spec.ts` | E2E | No primary control above 60% height at 768×1024 |

**Rollback plan** — Route-level. `git revert` removes the route and the navigation entry; the
backend endpoints stay and stay tested, so the desk can be re-landed without re-verifying the
server. There is no partial state to unwind because the screen stores nothing but its branch
binding, which is local.

**Notes** — The trap is that the 2-second budget is spent before the network is touched. Camera
acquisition is 300–900 ms and decode is 100–400 ms on desk hardware; if the stream is torn down
between members the budget is gone and no amount of backend tuning recovers it. The second trap is
the accessibility gate: a camera-first screen is exactly the one a team is tempted to exempt, and
`NFR-USE-01` names this screen specifically as AA. The keyboard path through manual search is not a
fallback — it is the accessible primary path, and it must be as fast as the camera.

---

# PART C — SPRINT 9 · BRANCH SCOPING, STAFF AND CRM (M-077 … M-082)

> **Sprint goal (`SprintPlanning.md` Sprint 9).** *"Give the gym its own staff and its own book of
> members, with every list, aggregate and export narrowed by the branch the person actually works
> at."* Exit condition `C9.1`: ***`E2E-10` passes.*** `FR-STAF-08` roster (**D-03**) and `FR-CRM-09`
> merge (**D-04**) are descoped at this sprint and are not scheduled below.

### M-077 — `staff`, invitations with role and branch **fixed**, the last-owner guard

| Field | Value |
| :--- | :--- |
| **Sprint** | 9 |
| **Epic** | EP-13 · F-13.1, F-13.2, F-13.9, F-13.14, F-13.15 · T-13.01…T-13.06 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A tenant can invite a colleague by email or phone with the role and the branches decided
**at invitation time**, the seat count cannot be raced past the tier limit, and no sequence of
actions can leave a tenant with zero active owners.

**Depends on** — M-013, M-014, M-017, M-023, M-033.

**Unblocks** — M-078, M-079, M-080, M-084.

**Files**

- `prisma/migrations/<ts>_create_staff_and_invitations/migration.sql` — header `phase: expand · rls: three new tables, policies in this migration (MG10) · grants: staff G-CRUD + soft delete, staff_branches G-CRUD-D, staff_invitations G-CRUD`. Creates `staff` (`tenant_id`, `user_id`, `role`, `status`, `invited_at`, `joined_at`, `removed_at`, `deleted_at`), `staff_branches` (`staff_id`, `branch_id`, `tenant_id` carried redundantly so RLS needs no join), `staff_invitations` (`tenant_id`, `email`, `phone`, `role`, `branch_ids`, `token_hash char(64)`, `expires_at`, `consumed_at`, `dlt_template_id`).
- Same migration: `ck_staff__role_is_tenant_scoped` limiting `role` to the four tenant-assignable values; `uq_staff__tenant_user` partial on `deleted_at IS NULL`; `uq_staff_branches__staff_branch`; `uq_staff_invitations__tenant_email` partial `WHERE consumed_at IS NULL`; `uq_staff_invitations__token_hash`; RLS policies and grants for all three.
- `apps/server/src/staff/staff.module.ts` · `index.ts` · `README.md` · `permissions.ts`
- `apps/server/src/staff/domain/staff.aggregate.ts` · `.spec.ts` — holds the last-owner invariant.
- `apps/server/src/staff/domain/staff-invitation.entity.ts` · `.spec.ts`
- `apps/server/src/staff/application/use-cases/invite-staff.use-case.ts` · `.spec.ts` · `accept-invitation.use-case.ts` · `.spec.ts` · `revoke-invitation.use-case.ts`
- `apps/server/src/staff/application/services/seat-accounting.service.ts` · `.int-spec.ts` — a `COUNT` under `SELECT … FOR UPDATE` on the tenant row **inside** the invitation transaction; never a stored counter.
- `apps/server/src/staff/controllers/staff-invitations.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts`
- `apps/server/src/staff/infrastructure/staff.prisma-repository.ts` · `.int-spec.ts`
- `apps/server/src/staff/jobs/staff-invitation-expiry.job.ts` · `.spec.ts` — hourly, on the M-063 zone primitive.
- `packages/notifications/templates/staff-invitation.sms.json` — carries `dlt_template_id` and its approval state; email is always available as fallback (`REG-05`, `TR-16`).
- `prisma/seed/staff.seed.ts` — three tenants × four roles; `SEED_VERSION` bumped (R-7).

**Acceptance criteria**

1. **Role and branches are fixed at invitation.** The accept endpoint reads them from the invitation row and ignores anything in the request body; a test posts a `GYM_OWNER` role on acceptance of a `RECEPTIONIST` invitation and gets a `RECEPTIONIST` (`FR-STAF-01`, `FR-RBAC-06`).
2. The token is single-use, expiring, stored **hashed** (`char(64)`), and **bound to the invited identifier** — accepting while authenticated as a different email or phone is `403`, not a silent re-bind (`FR-AUTH-13`, `NFR-SEC-07`).
3. One live invitation per address per tenant, enforced by the partial unique index; re-inviting supersedes rather than duplicating.
4. Only the four tenant-assignable roles are creatable: `GYM_OWNER`, `GYM_MANAGER`, `RECEPTIONIST`, `TRAINER`. A `SUPER_ADMIN` value is refused by `CHECK` at the database, not only by Zod (`B3.1`).
5. **Last-owner protection fires on demotion as well as removal.** Both paths call the same aggregate invariant; a concurrency test demotes the two remaining owners simultaneously and exactly one succeeds, because the check runs under the same row lock as the write (`FR-STAF-09`, `FR-RBAC-07`).
6. Seat limits read `subscription_tiers.max_staff_seats` under the tenant row lock; two concurrent invitations at the last seat produce one success and one `409 STAFF_SEAT_LIMIT_REACHED` that **names the upgrade path** (`FR-STAF-06`, `A6.2`, F-13.15).
7. India delivery: SMS uses a **DLT-pre-approved** template and refuses to send if the template's approval state is not `APPROVED`, falling back to email with the reason recorded (`LAUNCH_MARKET_INDIA.md` §8, `REG-05`).
8. All three tables carry RLS **and** grants in this migration; a tenant-B principal reads zero tenant-A staff rows including via `staff_branches`, which is why `tenant_id` is carried on it (R-6, `BR-TEN-01`).
9. `staff.invitation-expiry` runs hourly per tenant zone and marks lapsed invitations without deleting them.
10. Isolation coverage for the invitation controller ships here (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `staff.aggregate.spec.ts` | Unit | Last-owner refusal on removal **and** demotion; a soft-deleted owner does not count |
| `seat-accounting.service.int-spec.ts` | Integration | Two concurrent invitations at the last seat; the `409` names the upgrade |
| `accept-invitation.use-case.spec.ts` | Unit | Role and branch taken from the invitation; body ignored; identifier binding |
| `staff.prisma-repository.int-spec.ts` | Integration | Mandatory RLS assertion on all three tables; the partial unique indexes |
| `staff-invitations.controller.isolation-spec.ts` | Isolation (`IS3`) | Cross-tenant invitation read, accept and revoke |
| `staff-invitation-sms.spec.ts` | Unit | Unapproved DLT template refuses and falls back to email |

**Rollback plan** — Expand-phase migration; `git revert` removes the module and the routes, leaving
three unreferenced tables that a Sprint-13 contract migration drops after the 35-day PITR window.
No flag — staff invitation is a new capability with no prior behaviour to restore.

**Notes** — The trap is the seat counter. A stored `staff_count` on `tenants` is the obvious
implementation and it is the `BR-FIN-01` mistake in a different domain: a number that can be wrong
with no way to tell which side is right. Counting under a lock costs one extra query per invitation
— a few times a week per tenant — and removes an entire class of "we have nine seats on an
eight-seat plan" tickets. The second trap: last-owner protection written only into the removal path.
Demotion reaches the same end state and is the path a real tenant takes.

---

### M-078 — `BranchScope` and the server-side scoping sweep

| Field | Value |
| :--- | :--- |
| **Sprint** | 9 |
| **Epic** | EP-13 · F-13.3, F-13.12, F-13.13 · T-13.09…T-13.13 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — `BranchScope` exists as a value object resolvable **only** from the session, every
branch-aware repository signature requires it, and the sweep that retrofits it across the existing
surfaces is complete and asserted — so branch scoping is a type error to omit rather than a review
comment to remember.

**Depends on** — M-010, M-023, M-033, M-074, M-077.

**Unblocks** — M-079, M-080, M-081, M-082.

**Files**

- `apps/server/src/staff/domain/branch-scope.vo.ts` · `.spec.ts` — a branded type with a private constructor; the only factory is `BranchScope.fromSession(principal)`. There is no `fromRequest`, no `fromDto`, no `all()` public factory (`PROJECT_CONSTITUTION.md` §5, F-13.12).
- `apps/server/src/staff/application/services/branch-scope-resolver.service.ts` · `.spec.ts` — resolves from `staff_branches`; a `GYM_OWNER` resolves to every branch of the tenant, which is a resolution, not a bypass.
- `apps/server/src/common/guards/branch-scope.guard.ts` · `.spec.ts` — attaches the resolved scope to the request context; refuses with `403 BRANCH_NOT_ASSIGNED_TO_STAFF` when an explicit `branch_id` falls outside it.
- `apps/server/src/attendance/infrastructure/attendance.prisma-repository.ts` — signature change: every list and aggregate method takes `BranchScope` as a required first parameter.
- `apps/server/src/memberships/infrastructure/membership.prisma-repository.ts` · `apps/server/src/ordering/infrastructure/order.prisma-repository.ts` — the same sweep.
- `apps/server/src/attendance/controllers/*.controller.ts` · `apps/server/src/memberships/controllers/*.controller.ts` — call sites updated; M-074's direct assigned-branch read is replaced here as promised.
- `tools/eslint-rules/require-branch-scope.js` · `.spec.js` — a lint rule failing any repository method whose name matches `list*|find*|count*|sum*|export*` on a branch-aware table and does not take `BranchScope`.
- `tests/isolation/branch-scope.isolation-spec.ts` — the branch dimension added to the M-015 suite.
- `docs/engineering/Security.md` — the `AZ8` section updated with the resolved shape.

**Acceptance criteria**

1. `BranchScope` is **unconstructable from a request body.** A test attempts every route into the constructor — DTO, query parameter, header, JSON body — and each fails to compile or throws; the branded type makes a cast the only workaround and `no-unsafe-cast` forbids it (F-13.12).
2. Scoping is enforced **server-side on every list, aggregate, export and mutation** of a branch-aware entity. The sweep is complete, not partial: the lint rule enumerates the branch-aware repositories and fails the build on an unscoped method (`FR-STAF-03`, `FR-RBAC-02`, `FR-RBAC-03`).
3. **Refusal versus filtering is per-operation and deliberate.** A *list* is filtered to the scope; an *action on a named entity outside the scope* is refused with `403`. Both behaviours are tested, and the choice per endpoint is recorded in `staff/README.md` (`BR-CHK-08` `L7-GUARD`).
4. A `GYM_OWNER` resolves to all branches through the resolver, not by skipping the guard — so removing a branch from an owner is a data change, not a code change.
5. Multi-branch staff resolve to the union of their assignments; the resolution is cached per request, not per process, so an M-079 epoch bump takes effect on the next request.
6. Scoping composes **under** RLS, never instead of it: a branch filter with a broken scope still cannot cross a tenant boundary, proven by a test that deliberately injects an empty scope and asserts zero rows rather than all rows (`BR-TEN-01`, `TR-12`).
7. The isolation suite gains a branch dimension: for every branch-aware endpoint, a principal scoped to branch 1 gets nothing from branch 2 in the same tenant (R-5, `E2E-11`).
8. Existing endpoints keep their contracts — this is a scoping sweep, not an API change; the contract tests from Sprints 5–8 pass unmodified.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `branch-scope.vo.spec.ts` | Unit | No public constructor; no DTO factory; owner resolution; union for multi-branch |
| `branch-scope.guard.spec.ts` | Unit | `403` on an out-of-scope explicit `branch_id`; pass-through on in-scope |
| `require-branch-scope.spec.js` | Unit (lint) | A synthetic unscoped `listAttendance` fails the rule |
| `branch-scope.isolation-spec.ts` | Isolation (`IS3`) | Every branch-aware endpoint across the branch dimension |
| `branch-scope-empty.int-spec.ts` | Integration | An empty scope yields zero rows, never all rows |

**Rollback plan** — `git revert`. This is a signature sweep with no schema change and no flag: a
half-applied scope is worse than none, so it lands whole or not at all. The revert restores the
pre-sweep signatures and the pre-sweep isolation suite, both of which still pass.

**Notes** — The trap is the empty-scope default. Written naively, "no branches assigned" produces a
`WHERE branch_id IN ()` that some query builders optimise into no predicate at all — and a
receptionist with a misconfigured assignment sees the entire tenant. The rule is that an empty scope
is a **deny**, expressed explicitly and tested explicitly. Second trap: filtering where the spec
says refuse. Silently narrowing a list is defensible; silently narrowing an *action* means a staff
member clicks "check in" on a member at another branch and gets a shrug instead of an answer.

---

### M-079 — Permission epoch, revocation preserving attribution, activity log

| Field | Value |
| :--- | :--- |
| **Sprint** | 9 |
| **Epic** | EP-13 · F-13.4, F-13.5, F-13.10, F-13.11, F-13.16 · T-13.14…T-13.18 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — A role, branch or status change takes effect within 60 seconds **without the affected
person re-authenticating**, a removed staff member loses access immediately while every action they
ever took keeps their name on it, and an owner can see what each person did.

**Depends on** — M-013, M-023, M-074, M-077, M-078.

**Unblocks** — M-080, M-081, M-082.

**Files**

- `apps/server/src/staff/application/services/permission-epoch.service.ts` · `.int-spec.ts` — a monotonic integer per `(user_id, tenant_id)` in Redis, bumped on any role, branch or status change, with a database fallback so a Redis loss fails **closed** to a re-resolve rather than open to a stale allow.
- `apps/server/src/common/guards/permissions.guard.ts` — extended to compare the token's embedded epoch against the current one and re-resolve on mismatch (`FR-RBAC-04`).
- `apps/server/src/staff/application/use-cases/change-staff-role.use-case.ts` · `.spec.ts` · `suspend-staff.use-case.ts` · `remove-staff.use-case.ts` · `.spec.ts`
- `apps/server/src/staff/application/services/effective-permissions.service.ts` · `.spec.ts` — given `(user, tenant)`, returns the resolved `(role, scope, resource, action)` set **with the reason each entry is held** (`FR-RBAC-05`, `SCR-ADM-005`).
- `apps/server/src/staff/controllers/staff.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts` · `staff-activity.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts`
- `apps/server/src/staff/infrastructure/staff-activity.query.ts` · `.int-spec.ts` — reads `audit_log`, `attendance` and `orders` through their query ports; it is a **read model**, and it owns no table.
- `apps/server/src/staff/jobs/staff-seat-reconcile.job.ts` · `.spec.ts` — nightly, asserts `ACTIVE` seats ≤ tier allowance and alerts on excess (F-13.16).
- `infra/monitoring/alerts/staff-seat-excess.yaml`

**Acceptance criteria**

1. A role change propagates **within 60 seconds without re-authentication**; the test changes a role, waits for the epoch bump and asserts the very next request is evaluated under the new role with the same access token (`FR-RBAC-04`).
2. Revocation is **immediate**, not epoch-bounded: `remove` and `suspend` bump the epoch **and** invalidate the session, so the next request is rejected regardless of timing (`FR-STAF-04`).
3. **Historical attribution survives removal.** After removal, the `attendance` rows, `orders` and `audit_log` entries the person created still resolve to their name; a test removes a staff member and re-reads a check-in they performed (`AC-STAF-01.4`).
4. Redis unavailability fails **closed**: the guard re-resolves from the database rather than trusting the token's embedded epoch. Latency degrades; authorisation does not.
5. The activity log shows check-ins performed, payments collected, members created and overrides used, each with amount, member, timestamp and order reference — branch-scoped through M-078 (`FR-STAF-05`, `AC-STAF-01.3`).
6. Override usage is reportable **per staff member**, which is the `staff/` half of `BR-CHK-08` and the reason F-13.13 spans two epics (`FR-CHK-08`, `OQ-09`).
7. The effective-permission inspector returns the reason per entry — "held because role `GYM_MANAGER`", "scoped to branches X and Y" — so an access question has a factual answer (`FR-RBAC-05`).
8. `staff.seat-reconcile` runs nightly and alerts on any excess; the only acceptable steady-state value of `gym.staff.seat_excess` is 0.
9. Isolation coverage for both new controllers ships here (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `permission-epoch.int-spec.ts` | Integration | Bump on role, branch and status change; ≤ 60 s propagation; Redis-down fails closed |
| `remove-staff.use-case.spec.ts` | Unit | Session invalidated immediately; attribution preserved; last-owner guard still fires |
| `staff-activity.query.int-spec.ts` | Integration | The four activity kinds; branch scoping; a removed member's history still resolves |
| `effective-permissions.service.spec.ts` | Unit | Reason per entry; owner resolution; suspended staff resolve to the empty set |
| `staff.controller.isolation-spec.ts` | Isolation (`IS3`) | Cross-tenant staff read, role change and activity read |

**Rollback plan** — `git revert`. The epoch is a Redis key namespace that expires on its own; the
guard degrades to its pre-epoch behaviour, which is correct but slower to propagate. No migration,
no flag — a half-propagating permission system is not a state anyone should be able to select.

**Notes** — The trap is embedding permissions in the access token and calling the 60-second
requirement satisfied by a short TTL. It is not: a 15-minute token means a demoted manager keeps
manager rights for up to 15 minutes, and shortening the TTL to 60 seconds trades one problem for a
refresh storm. The epoch is a cheap integer compare per request that makes the token's claims
*checkable* rather than *trusted*. Second trap: hard-deleting a removed staff row to "clean up",
which orphans every attendance row they attributed and turns an audit trail into a list of nulls.

---

### M-080 — `crm_members`, `member_notes`, `leads`; member code; walk-in; notes

| Field | Value |
| :--- | :--- |
| **Sprint** | 9 |
| **Epic** | EP-12 · F-12.4, F-12.5, F-12.10, F-12.11, F-12.14 · T-12.01…T-12.07 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — The gym has its own book of people: a walk-in can be recorded in seconds with name and
phone alone, every member carries a human-readable code the counter can say out loud, staff can
write private notes, and an enquiry can sit on a lead board before it is a sale.

**Depends on** — M-013, M-033, M-048, M-077, M-078.

**Unblocks** — M-081, M-082, M-084.

**Files**

- `prisma/migrations/<ts>_create_crm_members_notes_leads/migration.sql` — header `phase: expand · rls: three new tables, policies in this migration (MG10) · grants: G-CRUD + soft delete on crm_members and leads, G-CRUD on member_notes`. `crm_members` (`tenant_id`, `user_id` **with no FK** so `BR-DAT-04` erasure can complete, `member_code`, `full_name`, `phone`, `email`, `source`, `assigned_trainer_staff_id`, `risk_flagged_at`, `attendance_baseline_per_week numeric(4,2)`, `merged_into_id` self-FK, `balance_due_minor bigint`, `deleted_at`); `member_notes` (`tenant_id`, `crm_member_id`, `body`, `author_staff_id`, `is_sensitive_category`, `editable_until`); `leads` (`tenant_id`, `branch_id`, `full_name`, `phone`, `email`, `status`, `source`, `assigned_staff_id`, `follow_up_on`, `converted_order_id`, `deleted_at`).
- Same migration: `uq_crm_members__tenant_member_code`; `idx_leads__tenant_status_follow_up (tenant_id, status, follow_up_on)`; the three RLS policies and their grants.
- `apps/server/src/crm/crm.module.ts` · `index.ts` · `README.md` · `permissions.ts`
- `apps/server/src/crm/domain/member-code.generator.ts` · `.spec.ts` — tenant prefix plus a zero-padded sequence, allocated inside the creating transaction.
- `apps/server/src/crm/domain/crm-member.aggregate.ts` · `.spec.ts` · `lead.aggregate.ts` · `.spec.ts` — `NEW → CONTACTED → TRIAL → CONVERTED | LOST`.
- `apps/server/src/crm/application/use-cases/create-walk-in-member.use-case.ts` · `.spec.ts` · `add-member-note.use-case.ts` · `.spec.ts` · `convert-lead.use-case.ts` · `.spec.ts`
- `apps/server/src/crm/controllers/members.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts` · `member-notes.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts` · `leads.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts`
- `apps/server/src/crm/infrastructure/crm-member.prisma-repository.ts` · `.int-spec.ts`
- `prisma/seed/crm.seed.ts` — 200 members across three tenants completing the seed-v1 CRM slice; `SEED_VERSION` bumped (R-7).

**Acceptance criteria**

1. Walk-in creation requires **name and phone only**; every other field is optional and the record is immediately usable at the desk (`FR-CRM-04`).
2. `member_code` is unique **per tenant** and allocated inside the creating transaction; a concurrency test creates 50 members simultaneously and gets 50 distinct codes with no gaps attributable to the allocator (`FR-CRM-10`).
3. `crm_members.user_id` carries **no foreign key**, and a test proves a `BR-DAT-04` erasure of the platform user completes while the tenant's operational row survives in pseudonymised form (`NFR-PRV-03`, `Schema.md` §5.5 note).
4. Notes are **never member-visible**. No endpoint under `/v1/me/**` returns a `member_notes` row, asserted as structural absence over the generated OpenAPI document rather than by inspection (`FR-CRM-05`).
5. `is_sensitive_category` gates read access at the authorisation layer **and excludes the note from every export** unless the requester holds the elevated permission (`NFR-PRV-07`).
6. A note is editable by its author until `editable_until` and immutable after; an edit attempt past the window is `422`, not a silent no-op (`ERD.md` §4.4).
7. `balance_due_minor` is a **derived projection** of `orders`, written by the order events, never typed in — money stays where `BR-PAY-09` put it, and the collect-balance action links to the order (`E2E-10`, F-12.14).
8. Every member and lead list, filter and export is branch-scoped through `BranchScope` from M-078 (F-12.12, `TR-12`).
9. All three tables carry RLS and grants in this migration (R-6); isolation coverage for all three controllers ships here (R-5).
10. CRM is **Growth-tier and above**: a Starter tenant gets the member list and receives `402 TIER_UPGRADE_REQUIRED` on segments, at-risk and the leads board (`A6.2`, `Epic_12.md` §36).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `member-code.generator.spec.ts` | Unit | Format; per-tenant uniqueness; 50-way concurrency |
| `create-walk-in-member.use-case.spec.ts` | Unit | Minimal set; code allocated in-transaction; source recorded |
| `member-notes.controller.int-spec.ts` | Integration | Editability window; sensitive-category gating; export exclusion |
| `notes-not-member-visible.contract-spec.ts` | Contract | No `/v1/me/**` operation returns a note — structural absence |
| `crm-member.prisma-repository.int-spec.ts` | Integration | Mandatory RLS assertion on all three tables; erasure with no FK block |
| `crm-*.controller.isolation-spec.ts` | Isolation (`IS3`) | Cross-tenant member, note and lead access on all three controllers |

**Rollback plan** — Expand-phase; `git revert` removes the module and routes, leaving three
unreferenced tables for a later contract migration after the 35-day PITR gate. No flag; the tier gate
is configuration and already restricts exposure.

**Notes** — The trap is the foreign key on `user_id`. It is the natural thing to write, it is
correct in every ordinary sense, and it makes a statutory DPDP erasure fail on a `RESTRICT` at the
worst possible moment. The absence is deliberate and is documented in the migration header so nobody
"fixes" it. Second trap: `member_code` allocated by a `MAX(code)+1` read outside the transaction,
which produces duplicates under exactly the load a busy front desk creates.

---

### M-081 — Member list — nine filters, saved segments; Member 360; at-risk

| Field | Value |
| :--- | :--- |
| **Sprint** | 9 |
| **Epic** | EP-12 · F-12.1, F-12.2, F-12.3, F-12.6, F-12.13 · T-12.08…T-12.16 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — An owner can find any member on four search fields and nine filters, save the filter as a
segment, open one screen that answers every question about that person in one query plan, and see
who has stopped coming — with the flag clearing itself the moment they come back.

**Depends on** — M-069, M-073, M-078, M-080.

**Unblocks** — M-082, the Sprint-9 exit (`E2E-10`).

**Files**

- `prisma/migrations/<ts>_create_segments/migration.sql` — header `phase: expand · rls: new table, policy in this migration · grants: G-CRUD + soft delete`. `segments` (`tenant_id`, `gym_id`, `name`, `definition jsonb`, `deleted_at`) with `uq_segments__tenant_name`.
- Same migration: covering indexes for the nine filter dimensions on `crm_members`, chosen from `Indexes.md` rather than invented.
- `apps/server/src/crm/domain/member-filter.vo.ts` · `.spec.ts` — the nine dimensions as a closed set: status, plan, branch, expiry window, join date, attendance frequency, assigned trainer, at-risk flag, balance due.
- `apps/server/src/crm/domain/segment-definition.vo.ts` · `.spec.ts` — a **definition**, re-evaluated on read; never a materialised member list.
- `apps/server/src/crm/application/queries/list-members.query.ts` · `.int-spec.ts` — keyset pagination, `BranchScope` required.
- `apps/server/src/crm/application/queries/member-360.query.ts` · `.int-spec.ts` — the seven regions in **one** query plan.
- `apps/server/src/crm/application/queries/dashboard-action-list.query.ts` · `.int-spec.ts` — expiring, at risk, balance due, overdue lead follow-ups (`SCR-DASH-001`, `RSK-09`).
- `apps/server/src/crm/jobs/crm-risk-flags.job.ts` · `.spec.ts` — nightly per gym zone on the M-063 primitive; behind `rel.crm.at-risk-flagging`.
- `apps/server/src/crm/application/consumers/clear-risk-on-check-in.consumer.ts` · `.spec.ts` — consumes `CheckInRecorded` from M-073 and clears `risk_flagged_at`.
- `apps/server/src/crm/infrastructure/adapters/attendance-attendance-query.adapter.ts` — the M-069 port, consumed through `index.ts` (R-M7).
- `apps/server/src/crm/controllers/members.controller.ts` · `segments.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts`
- `docs/FEATURE_FLAGS.md` — `rel.crm.at-risk-flagging` (**off**: no flags set, the segment renders empty with an explanatory state).

**Acceptance criteria**

1. Search covers **four fields** — name, phone, email, member code — and filters cover **all nine** dimensions, each independently testable and combinable (`FR-CRM-01`, `SCR-DASH-007`).
2. The five platform segments exist as presets — expiring in 7 days, no visit in 21 days, joined this month, at risk, balance due — alongside tenant-defined saved filters (`FR-CRM-02`).
3. A segment stores a **definition**, not a snapshot. A test saves a segment, checks a member in, and re-reads the segment to find them gone — with no recomputation step in between (`Schema.md` §8.4 note, `AC-CRM-01.3`).
4. Member 360 returns its **seven regions in one query plan**; a query counter asserts the region count does not multiply into seven round trips (`FR-CRM-03`, `SCR-DASH-008`).
5. The at-risk rule is a **per-member baseline**, not a platform constant: average weekly visits over the last 8 weeks dropped by more than the configured threshold, and the segment shows baseline, current frequency and last-visit date so the owner can judge (`AC-CRM-01.1`, `FR-CRM-06`).
6. **The flag clears automatically on check-in**, driven by the `CheckInRecorded` event rather than by the nightly job, so the list is never a day stale (`AC-CRM-01.3`).
7. The at-risk computation reads attendance **only** through `attendance-query.port.ts`; `no-cross-module-repository` proves `crm/` never touches the attendance repository (R-M7, `FolderStructure.md` §4 invariant 4).
8. The nightly job runs at the gym's local hour via M-063 — never a whole-hour UTC cron, because `Asia/Kolkata` is `+05:30` (R-9, `TR-24`).
9. Every list, segment evaluation and the action list are branch-scoped; a two-branch tenant's manager scoped to one branch sees one branch's at-risk members (M-078).
10. Isolation coverage for both controllers ships here (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `member-filter.vo.spec.ts` | Unit | Nine dimensions; combination semantics; an unknown dimension is refused, not ignored |
| `list-members.query.int-spec.ts` | Integration | Keyset pagination stability; each filter individually; branch scoping |
| `member-360.query.int-spec.ts` | Integration | Seven regions; single query plan; round-trip counter |
| `crm-risk-flags.job.spec.ts` | Unit | Per-member baseline; threshold boundary; IST scheduling via the `Clock` port |
| `clear-risk-on-check-in.consumer.spec.ts` | Unit | Flag cleared on `ALLOWED`; **not** cleared on `DENIED`; replay idempotent |
| `segments.controller.isolation-spec.ts` | Isolation (`IS3`) | Cross-tenant segment read, evaluation and delete |

**Rollback plan** — `rel.crm.at-risk-flagging` off stops the job and renders the segment empty with
an explanatory state; the rest of the list is unaffected. The `segments` migration is expand-phase.
`git revert` removes the queries; `SCR-DASH-007` and `-008` degrade to the basic list from M-080.

**Notes** — The trap is a materialised segment. Caching the member list behind "at risk" is the
obvious performance move and it directly breaks `AC-CRM-01.3`: the member checks in, the flag clears
on the row, and the cached list still names them. A stale at-risk list is worse than none — it
trains the owner to ignore the feature, which is exactly what `Epic_12.md` §53 warns about. Second
trap: a platform-wide "fewer than 2 visits a week" threshold. A member whose baseline is one visit a
week has not lapsed; a member whose baseline is five and now visits twice has.

---

### M-082 — Streamed CSV bulk import — dry run, per-row errors, idempotent re-run

| Field | Value |
| :--- | :--- |
| **Sprint** | 9 |
| **Epic** | EP-03 · F-03.15 · T-03.26, T-03.27 (backend half) |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A gym arriving with 400 members on a spreadsheet can load them: mapped, previewed,
validated without committing, imported row-atomically, and re-runnable after a fix without creating
a single duplicate.

**Depends on** — M-017, M-018, M-078, M-080.

**Unblocks** — the Sprint-9 exit (`E9.1`…`E9.10`), the `SCR-DASH-019` frontend half.

**Files**

- `prisma/migrations/<ts>_create_import_jobs/migration.sql` — header `phase: expand · rls: new table, policy in this migration · grants: G-CRUD`. `import_jobs` (`tenant_id`, `kind`, `status`, `source_filename`, `column_mapping jsonb`, `natural_key_hash`, `total_rows`, `valid_rows`, `imported_rows`, `error_report_url`, `dry_run boolean`, `created_by_staff_id`).
- `apps/server/src/crm/application/services/member-import.service.ts` · `.spec.ts` — `papaparse` **stream mode** (`A-20`); the file is never fully buffered.
- `apps/server/src/crm/domain/import-row.validator.ts` · `.spec.ts` — one `Zod` schema per mapped column; a row's errors are collected, not thrown on the first.
- `apps/server/src/crm/domain/import-natural-key.ts` · `.spec.ts` — `(tenant_id, normalised phone)` is the idempotency key; `+91` normalisation is India-specific and lives in `packages/utils/src/phone/`.
- `apps/server/src/crm/jobs/member-import.job.ts` · `.spec.ts` — BullMQ, resumable from the last committed row.
- `apps/server/src/crm/controllers/member-import.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts`
- `apps/server/src/crm/infrastructure/import-error-report.writer.ts` · `.spec.ts` — a downloadable CSV with the original row number, the original values and the reason per failure.
- `tests/fixtures/imports/` — `valid-400.csv`, `mixed-errors-400.csv`, `duplicate-phones.csv`, `formula-injection.csv`, `utf8-bom-devanagari.csv`.

**Acceptance criteria**

1. A 400-row file **streams**; peak heap growth stays within the configured ceiling and a 10,000-row file completes without buffering, asserted by a memory-bounded test (`AC-EP03-31`, `A-20`).
2. Column mapping is explicit and a **20-row preview** renders the mapped result before anything is written (`FR-ONB-15`).
3. **Dry run validates and writes nothing.** The same file run as dry-run then as commit produces identical validation output, and after the dry run `crm_members` is unchanged — asserted by a row count and a checksum (`AC-ONB-03.2`).
4. Errors are **per row**, downloadable, and name the original row number and the offending value; valid rows import and invalid rows do not, in the same run (`AC-ONB-03.1`, `AC-ONB-03.3`).
5. **Row atomicity**: a row is never half-applied — the member and its code allocate in one transaction, so a failure mid-row leaves nothing (`Epic_03.md` §615).
6. **Idempotent re-run**: re-running the same file creates zero duplicates, keyed on `(tenant_id, normalised phone)`; a re-run after fixing three rows imports exactly three (`AC-ONB-03.4`).
7. Members **only** — no memberships are created, and the response states so explicitly, per the `OQ-EP03-08` resolution recorded in `KNOWN_LIMITATIONS.md`.
8. Formula injection is neutralised on the **error report** as well as on export: a cell beginning `=`, `+`, `-` or `@` is prefixed, because the error report is the file the owner opens in Excel (`SEC-A03-006`, `BR-DAT-05-N1`).
9. The import is branch-scoped and audited with actor, filename, row counts and the dry-run flag (`TR-12`, `BR-DAT-01`).
10. `import_jobs` carries RLS and grants in this migration (R-6); isolation coverage ships here (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `member-import.service.spec.ts` | Unit | Stream mode; per-row error collection; row atomicity on injected failure |
| `member-import.int-spec.ts` | Integration | 400-row dry run writes nothing; commit imports valid only; re-run creates zero duplicates |
| `import-natural-key.spec.ts` | Unit | `+91` normalisation; `09876…` and `+919876…` collapse to one key |
| `import-error-report.writer.spec.ts` | Unit | Row numbers preserved; formula neutralisation; UTF-8 BOM and Devanagari names survive |
| `member-import.controller.isolation-spec.ts` | Isolation (`IS3`) | Cross-tenant job read and error-report download |

**Rollback plan** — `git revert` for the code; `import_jobs` is expand-phase and drops in a later
contract migration. Imported members are **not** rolled back by a revert — that is a data operation,
and the runbook `docs/runbooks/reverse-member-import.md` (written in this milestone) names the
`import_job_id` filter that identifies them.

**Notes** — The trap is the natural key. Phone numbers arrive as `9876543210`, `09876543210`,
`+91 98765 43210` and `+919876543210` in the same file, and any two of those treated as distinct
turn "idempotent re-run" into "duplicate everything". Normalisation happens once, in
`packages/utils`, and is tested against the India formats specifically. Second trap: reporting
errors by *parsed* row index after skipping blanks, so the owner is told row 214 is wrong when their
spreadsheet's row 214 is fine.

---

# PART D — SPRINT 10 · REVIEWS, MODERATION AND COUPON COMPLETION (M-083 … M-086)

> **Sprint goal (`SprintPlanning.md` Sprint 10).** *"Let members who actually trained say so, in
> public, without giving anyone — gym or platform — a quiet way to delete what they said."* Exit
> condition `C9.1`: ***`E2E-09` passes.***

### M-083 — `reviews` gated on a recorded check-in; **no `UPDATE`/`DELETE` grant**

| Field | Value |
| :--- | :--- |
| **Sprint** | 10 |
| **Epic** | EP-14 · F-14.1, F-14.2, F-14.4, F-14.16, F-14.18 · T-14.01…T-14.07 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Only a member with a recorded **`ALLOWED`** check-in can review a gym, one review per
membership term, and no tenant principal anywhere in the system holds the privilege to change or
delete what a member wrote.

**Depends on** — M-069, M-072, M-073, M-080.

**Unblocks** — M-084, M-085.

**Files**

- `prisma/migrations/<ts>_create_reviews/migration.sql` — header `phase: expand · rls: new table, policy in this migration · grants: tenant SELECT only; INSERT restricted to the member role; NO UPDATE, NO DELETE for any tenant role`. `reviews` (`tenant_id`, `gym_id`, `user_id` no FK, `membership_id` **NOT NULL**, `rating smallint`, `sub_ratings jsonb`, `body`, `media jsonb`, `status`, `screening_result jsonb`, `published_at`, `edited_at`, `edit_history jsonb`, `deleted_at`).
- Same migration: `uq_reviews__user_membership` — **this constraint *is* `BR-REV-02`**; `ck_reviews__rating_1_5`; `idx_reviews__gym_status_published (gym_id, status, published_at DESC)`, deliberately not `tenant_id`-leading because it serves a public read; the RLS policy and the grant set.
- `apps/server/src/reviews/reviews.module.ts` · `index.ts` · `README.md` · `permissions.ts`
- `apps/server/src/reviews/domain/review.aggregate.ts` · `.spec.ts` · `review-status.state-machine.ts` · `.spec.ts` — `C4.6` with `SUBMITTED` as the entry state per `SM-OQ-05`.
- `apps/server/src/reviews/application/services/review-eligibility.service.ts` · `.int-spec.ts`
- `apps/server/src/reviews/infrastructure/adapters/attendance-attendance-query.adapter.ts` — the M-069 port; `reviews/` has no repository reach into `attendance/` (R-M7).
- `apps/server/src/reviews/controllers/review-eligibility.controller.ts` · `reviews.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts`
- `apps/server/src/reviews/application/services/exif-stripper.service.ts` · `.spec.ts`
- `packages/config/scripts/append-only-grants.mjs` — extended to assert the `reviews` grant shape.

**Acceptance criteria**

1. Eligibility is `EXISTS (SELECT 1 FROM attendance WHERE user_id = $me AND gym_id = $gym AND result = 'ALLOWED')`. **`result = 'ALLOWED'` is load-bearing** — a member denied at the door has an attendance row and has not attended (`BR-REV-01`, `apis/Reviews.md` §3.2).
2. A `MANUAL` or `OVERRIDE` check-in **does** confer eligibility: the member was physically admitted, and `method` is for reporting, not entitlement (`BR-CHK-08`).
3. A direct API call without a check-in is `403 REVIEW_REQUIRES_CHECK_IN`, while `GET …/reviews/eligibility` returns **`200` either way** with a reason code so the client can explain rather than 403 the member's own browser (`AC-REV-02.1`, `BAC-09`, F-14.18).
4. `membership_id` is `NOT NULL` and unique per user, which makes an unverified review **unrepresentable** — `BR-REV-03`'s "Verified member" marker is derivable and can never go stale (`Schema.md` §10.1 note).
5. **No tenant principal can mutate or delete a review.** Two independent proofs ship here: a grant assertion that the tenant DB role holds no `UPDATE`/`DELETE` on `reviews`, and a contract test over the generated OpenAPI document proving no operation exists (F-14.16, `SEC-A04-003`).
6. Content model: overall rating 1–5, five optional sub-ratings, a 20–2000 character body, optional photos with **EXIF stripped** before storage (`FR-REV-02`, `NFR-SEC-05`).
7. The **7-day edit window** works and edits **append** to `edit_history` rather than overwriting; an edit at day 8 is `422` (`BR-REV-02`).
8. A review lands `SUBMITTED`, never `PUBLISHED` — M-084 owns the transition, and a test asserts no code path publishes on insert (`C4.6`).
9. Isolation coverage ships here, including a cross-tenant review submission and a cross-tenant eligibility probe (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `review-eligibility.service.int-spec.ts` | Integration | `ALLOWED` grants; `DENIED` does not; `MANUAL` and `OVERRIDE` do; cross-gym does not |
| `review.aggregate.spec.ts` | Unit | Rating bounds; body length; 7-day window; `edit_history` appends |
| `reviews-no-mutation.contract-spec.ts` | Contract | No OpenAPI operation mutates or deletes a review — structural absence |
| `reviews-grants.int-spec.ts` | Integration | `UPDATE` and `DELETE` as the tenant role raise `permission denied` |
| `reviews.controller.isolation-spec.ts` | Isolation (`IS3`) | Cross-tenant submission, read and eligibility probe |

**Rollback plan** — Expand-phase migration; `git revert` removes the module and routes. Reviews
already written are retained — deleting them on rollback would be the exact action the grant model
exists to prevent. No flag here; `ops.reviews.publication` arrives with publication in M-084.

**Notes** — The trap is omitting `result = 'ALLOWED'`. It reads like a redundant predicate — of
course the row means they attended — and `BR-CHK-10` is precisely why it is not: every denied
attempt is also a row. Without the clause, anyone who ever stood in a doorway with an expired card
can review the gym, which is the hole `BR-REV-01` exists to close. Second trap: enforcing "one
review per member per gym" in application code. It is a unique index on `(user_id, membership_id)`,
and expressing it as a constraint is what makes it true under concurrency.

---

### M-084 — Screening that **holds**; one gym response; the report that never removes

| Field | Value |
| :--- | :--- |
| **Sprint** | 10 |
| **Epic** | EP-14 · F-14.3, F-14.5, F-14.6, F-14.15, F-14.17 · T-14.08…T-14.14 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Every review and every gym response passes the same automated screen, a suspect one is
**held for a human** rather than rejected, a gym may reply **once**, and a gym's report starts a
moderation review without removing anything.

**Depends on** — M-018, M-077, M-083.

**Unblocks** — M-085.

**Files**

- `prisma/migrations/<ts>_create_review_responses_and_reports/migration.sql` — header `phase: expand · rls: two new tables, policies in this migration · grants: G-CRUD on both, no DELETE on review_responses`. `review_responses` (`tenant_id`, `review_id`, `body`, `author_staff_id`, `status`) with `uq_review_responses__review_id` — **one response, expressed as a unique index because `BR-REV-05` says once**; `review_reports` (`tenant_id`, `review_id`, `reporter_id`, `reporter_type`, `reason_code moderation_reason_enum`, `notes`, `status`, `resolution`).
- `apps/server/src/reviews/domain/screening/screening-pipeline.ts` · `.spec.ts` — five detectors: profanity, contact details, URLs, solicitation, spam. The outcome is `PASS` or `HOLD`. **There is no `REJECT` outcome**, and its absence is a typed impossibility, not a convention.
- `apps/server/src/reviews/domain/screening/lexicons/` — Devanagari and Hinglish profanity, `+91` and bare-10-digit mobiles, `wa.me` links, **UPI VPAs** — held as **versioned data files**, not code, tunable without deployment (F-14.15, `RSK-07`).
- `apps/server/src/reviews/application/use-cases/submit-review.use-case.ts` — extended: screen, then `SUBMITTED → PUBLISHED` or `SUBMITTED → HELD`.
- `apps/server/src/reviews/application/use-cases/respond-to-review.use-case.ts` · `.spec.ts` — the response runs the **same** pipeline (`FR-REV-05`).
- `apps/server/src/reviews/application/use-cases/report-review.use-case.ts` · `.spec.ts`
- `apps/server/src/reviews/controllers/tenant-reviews.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts` — `GET /v1/tenant/reviews`, `POST …/:id/respond`, `POST …/:id/report`.
- `docs/FEATURE_FLAGS.md` — `ops.reviews.publication` kill switch and `rel.reviews.screening_lexicon_version`.

**Acceptance criteria**

1. Screening **queues rather than rejects**. A flagged review is stored `HELD` and the member receives `201`, not an error — the submission succeeded; publication is pending (`BR-REV-04`, `apis/Reviews.md` §4.1).
2. The `PASS`/`HOLD` union has **no third member**. A test asserts the type admits no `REJECT`, and a structural grep confirms no code path deletes or refuses a screened review (`FR-REV-03`).
3. **The same pipeline screens gym responses.** A response containing a phone number is held exactly as a review would be — the gym is not privileged (`FR-REV-05`).
4. Lexicons are **data, not code**: a new Hinglish term is added by shipping a versioned lexicon file and bumping `rel.reviews.screening_lexicon_version`, with no deployment; the active version is recorded on each `screening_result` so a decision is reproducible (F-14.15).
5. India patterns are covered by name: Devanagari profanity, `+91` and bare-10-digit mobiles, `wa.me` links and **UPI VPAs** (`name@bank`), each with its own fixture (`LAUNCH_MARKET_INDIA.md`).
6. **One response per review**, enforced by `uq_review_responses__review_id`; a second attempt is `409`, and editing an existing response is a distinct, audited action rather than a silent overwrite (`BR-REV-05`).
7. **A report never removes the review.** `POST …/report` writes a `review_reports` row with one of the **nine** `C4.8` `moderation_reason_enum` values plus optional free text, and the review's `status` is byte-unchanged — asserted by comparing status before and after (`BR-REV-06`, `RS4`).
8. `ops.reviews.publication` off: new reviews are still accepted, screened and stored `HELD`; already-published reviews stay published; aggregates freeze; and every held review flows into the moderation queue on restore (F-14.17).
9. Both new tables carry RLS and grants in this migration (R-6); isolation coverage for the tenant controller ships here (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `screening-pipeline.spec.ts` | Unit | Five detectors; `HOLD` not reject; no third outcome; lexicon version recorded |
| `screening-india.spec.ts` | Unit | Devanagari, Hinglish, `+91`, bare 10-digit, `wa.me`, UPI VPA fixtures |
| `respond-to-review.use-case.spec.ts` | Unit | Same pipeline; second response `409`; edit is a distinct audited action |
| `report-review.use-case.spec.ts` | Unit | Nine reason codes; review status unchanged; report is not a removal |
| `reviews-kill-switch.int-spec.ts` | Integration | Flag off: accepted, held, aggregates frozen, published untouched; restore drains the queue |
| `tenant-reviews.controller.isolation-spec.ts` | Isolation (`IS3`) | Cross-tenant respond, report and list |

**Rollback plan** — `ops.reviews.publication` is the kill switch and its off-state is fully
specified above. The migration is expand-phase. `git revert` removes responses and reports; existing
reviews and their published state are untouched, because nothing in this milestone writes a review's
body or rating.

**Notes** — The trap is a `REJECT` outcome. It is one enum value away at all times, it looks like a
kindness to the gym, and it turns an automated classifier into a censor with no appeal — a false
positive silently destroys a genuine member's account of their experience. Holding costs a moderator
a few seconds and is reversible; rejecting is not. The second trap is screening reviews and not
responses: a gym that replies with *"call me on 98765 43210 for a better deal"* has moved the
transaction off-platform, which is a commission leak as well as a policy breach.

---

### M-085 — Moderation, the Bayesian-versus-mean split, aggregation within 60 s

| Field | Value |
| :--- | :--- |
| **Sprint** | 10 |
| **Epic** | EP-14 · F-14.7, F-14.8, F-14.9, F-14.12, F-14.13, F-14.14, F-14.20 · T-14.15…T-14.24 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A moderator can publish, unpublish, request an edit or remove with a reason over the
`C4.6` machine; the gym's **displayed** mean and its **ranking** Bayesian figure are computed by one
function from one `(sum, count)` pair; and any moderation action is reflected in the aggregate within
sixty seconds.

**Depends on** — M-042, M-083, M-084.

**Unblocks** — the Sprint-10 exit (`E2E-09`), the Sprint-13 search-ranking work.

**Files**

- `apps/server/src/reviews/domain/rating-of-gym.ts` · `.spec.ts` — **one function, two consumers**: returns `{ mean, count, bayes }` from a single `(sum, count)` pair with the prior `(m, C)` as versioned configuration (F-14.13, `TR-23`).
- `apps/server/src/reviews/domain/review-status.state-machine.ts` — completed: `SUBMITTED`, `PUBLISHED`, `HELD`, `UNPUBLISHED`, `REMOVED` with the exact legal `C4.6` edges.
- `apps/server/src/reviews/application/use-cases/moderate-review.use-case.ts` · `.spec.ts` — publish, unpublish, request-edit, remove-with-reason; every decision `@Audited()`.
- `apps/server/src/reviews/application/consumers/review-aggregate.consumer.ts` · `.int-spec.ts` — outbox-driven; updates `gyms.rating_avg`, `gyms.rating_count` and `gyms.rating_bayes` **in the same transaction as the status change** (F-14.13).
- `apps/server/src/reviews/jobs/review-anomaly-scan.job.ts` · `.spec.ts` — hourly, four signals, **any two flag**; behind `rel.reviews.anomaly-detection`.
- `apps/server/src/reviews/jobs/review-aggregate-reconcile.job.ts` · `.spec.ts` — nightly full recompute; alerts on any correction above **0.05** on any gym (F-14.14).
- `apps/server/src/reviews/jobs/reviews-audit-eligibility.job.ts` · `.spec.ts` — weekly re-run of the §3.2 `EXISTS` test; a failure **unpublishes pending investigation, never deletes**.
- `apps/server/src/reviews/application/services/author-pseudonymisation.service.ts` · `.spec.ts` — `BR-DAT-04` erasure pseudonymises the reviewer while body and rating survive (F-14.20).
- `apps/server/src/admin/controllers/review-moderation.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts` — `SCR-ADM-012`.
- `docs/FEATURE_FLAGS.md` — `rel.reviews.anomaly-detection` with its `E10.7` false-positive thresholds recorded as configuration, not constants (F-14.19).

**Acceptance criteria**

1. **The displayed number and the ranking number are different fields and are never swapped.** `rating_avg` is the plain mean with count and is public; `rating_bayes` ranks and **never appears in a response body** — a contract test over the OpenAPI document proves its absence (`RV3`, `FR-REV-08`, `FR-SRCH-10`).
2. Both figures come from **one function and one `(sum, count)` pair**; two independent calculators cannot exist, asserted by a structure test on the module (F-14.13, `TD-004`, `TD-015`).
3. Below **three** published reviews the API returns **`null`** for `rating_avg` — not `0`, not a client-side hide (`BR-REV-07`). The sharp edge is documented: a gym at exactly three that loses one to moderation loses its number entirely, and that is *"working as specified"*.
4. **Aggregate recomputation lands within 60 seconds** of any moderation action, measured end-to-end from decision to `gyms.rating_avg` (`AC-REV-02.3`, `C5 review.aggregate`).
5. `HELD`, `UNPUBLISHED`, `REMOVED` and un-cleared anomalies are all **excluded** from the aggregate; the exclusion set is one predicate used by both the consumer and the nightly reconcile, never two.
6. Anomaly detection uses four signals — rating velocity, reviewer account age, text clustering, and shared-device or shared-network heuristics — and **any two** flag. A flagged review is **held and excluded pending review**, never auto-removed (`FR-REV-09`, `AC-REV-02.2`).
7. **The false-positive gate is a merge gate**: a genuine 20-review post-campaign burst from the seeded distribution must **pass** un-flagged, and the thresholds live in `FEATURE_FLAGS.md` (`E10.7`, F-14.19, `RSK-02`).
8. Changing the Bayesian prior `(m, C)` triggers a **full recompute**, because a silent prior change reorders every search result (`TR-23`).
9. The nightly reconcile recomputes both figures from `reviews` and alerts on any correction; `gym.reviews.aggregate_drift` above 0.05 on any gym pages the on-call.
10. A `BR-DAT-04` erasure pseudonymises the author and **keeps the review**, because deleting it would silently rewrite the gym's rating history (F-14.20, `CON-04`).
11. Isolation coverage for the moderation controller ships here; platform moderation acts under `runElevated()` from M-014 with the elevation recorded (R-5, `BR-TEN-02`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `rating-of-gym.spec.ts` | Unit | Mean and Bayes from one pair; prior applied; below-3 returns `null`; property test over random distributions |
| `rating-bayes-not-exposed.contract-spec.ts` | Contract | `rating_bayes` appears in no response schema |
| `review-aggregate.consumer.int-spec.ts` | Integration | ≤ 60 s from decision to aggregate; same-transaction update; exclusion set |
| `review-anomaly-scan.job.spec.ts` | Unit | Two-signal threshold; hold not remove; the 20-review genuine burst passes |
| `review-aggregate-reconcile.job.spec.ts` | Unit | Full recompute; 0.05 alarm; prior change forces recompute |
| `review-moderation.controller.isolation-spec.ts` | Isolation (`IS3`) | Cross-tenant moderation; elevation recorded |

**Rollback plan** — `rel.reviews.anomaly-detection` off stops the scan and clears no existing holds
(they remain queued for a human, which is safe). `git revert` removes moderation and the consumer;
`gyms.rating_avg` freezes at its last value and the nightly reconcile — which survives independently
— continues to report drift, so a frozen aggregate is loud rather than silent.

**Notes** — The trap is two rating calculators. The displayed mean is trivially computable inline in
a DTO mapper and someone will do it, and from that day the search ranking and the gym card disagree
by a rounding step that nobody can reproduce. One function, two named outputs, one `(sum, count)`
pair. The second trap is the anomaly detector tuned only against synthetic attacks: a gym that runs
a genuine campaign and collects twenty honest reviews in a week looks exactly like a burst, and a
detector that holds them all has punished the platform's best-behaved tenant.

---

### M-086 — Coupon completion — scoping, bulk single-use codes, pause/resume

| Field | Value |
| :--- | :--- |
| **Sprint** | 10 |
| **Epic** | EP-07 · F-07.13, F-07.15, F-07.16, F-07.17, F-07.18 · T-07.23, T-07.24 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — The coupon subsystem M-050 started is finished: platform-wide and tenant coupons each
scope-validated, usage tracked, bulk single-use codes generated for win-back campaigns, first-purchase
evaluated platform-wide, and a coupon pausable without deleting it.

**Depends on** — M-014, M-048, M-049, M-050, M-077.

**Unblocks** — M-089 (`commission_base_minor` depends on `funding_source` being complete).

**Files**

- `prisma/migrations/<ts>_coupon_bulk_codes_and_pause/migration.sql` — header `phase: expand · rls: existing policies unchanged · grants: unchanged`. Adds `coupons.paused_at`, `coupons.parent_campaign_id` self-FK, and `uq_coupons__tenant_code` extended to cover platform-scope rows where `tenant_id IS NULL`.
- `apps/server/src/ordering/domain/coupon.aggregate.ts` — extended with `pause()` / `resume()`; `evaluate()` gains the `COUPON_PAUSED` refusal, and it is a **distinct** reason from expiry or exhaustion.
- `apps/server/src/ordering/domain/coupon-scope.validator.ts` · `.spec.ts` — a tenant coupon validates against **that tenant's** plans and branches; a platform coupon validates against the platform catalogue.
- `apps/server/src/ordering/application/use-cases/generate-bulk-codes.use-case.ts` · `.spec.ts` — behind `release.coupons.bulk_codes`; codes are cryptographically random, collision-checked at the unique index, and generated in a single transaction per batch.
- `apps/server/src/ordering/application/queries/coupon-usage.query.ts` · `.int-spec.ts` — `redemption_count`, per-user redemptions, value discounted, attributable revenue (`FR-CPN-04`).
- `apps/server/src/ordering/application/services/first-purchase.checker.ts` · `.spec.ts` — evaluated against the user's **platform-wide** completed-order history, under `runElevated()` because it deliberately crosses tenants (`FR-CPN-06`, M-014).
- `apps/server/src/ordering/controllers/coupons.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts` · `admin-coupons.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts`

**Acceptance criteria**

1. A tenant coupon scoped to a plan the tenant does not own is refused at creation with a message naming the plan; a platform coupon scoped to a single tenant's branch is likewise refused (`FR-CPN-02`).
2. **Pause is not deletion.** A paused coupon refuses with a **distinct** reason `COUPON_PAUSED`, existing redemptions are untouched, and resume restores exactly the prior state including remaining limits (`FR-CPN-07`).
3. Evaluation still runs through the **single** `Coupon.evaluate()` path from M-050 — the pause check is a new clause inside it, not a second gate at the controller (`BR-CPN-03`).
4. Bulk codes are single-use by construction: each row carries `max_redemptions = 1` and its own `parent_campaign_id`; generating 5,000 codes produces 5,000 distinct rows with zero collisions, asserted by count and by index (`FR-CPN-05`).
5. `first_purchase_only` is evaluated **platform-wide**, not per tenant: a user who bought at gym A is not a first purchaser at gym B. The cross-tenant read is explicit, elevated and audited — never an RLS bypass by accident (`FR-CPN-06`, `BR-TEN-02`).
6. Usage tracking reports discounted **value in paise as a string** across the API boundary and never as a JSON number (R-8, `TR-38`).
7. `funding_source` remains mandatory on every coupon, because M-089's commission base is `N` for `GYM` and `N + D` for `PLATFORM` and an unfunded coupon makes the base unresolvable (`BR-CPN-05`).
8. `release.coupons.bulk_codes` off: the generation endpoint returns `404` and every other coupon behaviour is unaffected.
9. Isolation coverage for both controllers ships here, including a tenant attempting to pause a platform coupon (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `coupon-scope.validator.spec.ts` | Unit | Tenant scope against tenant catalogue; platform scope; the two refusals |
| `coupon.aggregate.spec.ts` | Unit | `COUPON_PAUSED` distinct from expired and exhausted; resume restores limits |
| `generate-bulk-codes.use-case.spec.ts` | Unit | 5,000 distinct single-use codes; collision retry; one transaction per batch |
| `first-purchase.checker.spec.ts` | Unit | Platform-wide history; elevation recorded; a cancelled order does not count |
| `coupons.controller.isolation-spec.ts` | Isolation (`IS3`) | Cross-tenant coupon read, pause and bulk generation |

**Rollback plan** — `release.coupons.bulk_codes` off for generation. The migration is expand-phase;
`paused_at` unread by reverted code is inert, but any coupon paused before the revert would become
**active again** — so the runbook step is to expire those coupons by end date before reverting, and
that step is written into `docs/runbooks/coupon-rollback.md` here.

**Notes** — The trap is the first-purchase check. Written under the tenant context it silently means
"first purchase *at this gym*", which is a different and much weaker offer, and it will not fail any
test that uses a single tenant. It must be elevated, deliberate and audited. Second trap: pause
implemented as `end_date = now()`, which is irreversible in a way the owner does not expect and
corrupts the coupon performance report.

---

# PART E — SPRINT 11 · THE LEDGER AND SETTLEMENT FOUNDATIONS (M-087 … M-090)

> **Sprint goal (`SprintPlanning.md` Sprint 11).** *"Make the money provable: an append-only record
> nobody can quietly adjust, eight figures persisted at sale, and a batch that refuses to close
> unless its lines sum exactly to the payout."* Exit condition `C9.1`: ***`E2E-12` passes with zero
> variance.*** Sprint 12's refunds, disputes and evidence packs (`EP-16`) continue in
> `Milestones_090-119.md` and consume every port this band declares.

### M-087 — **`ledger_entries` — append-only by grant, not by discipline**

| Field | Value |
| :--- | :--- |
| **Sprint** | 11 |
| **Epic** | EP-15 · F-15.1, F-15.23 · T-15.01, T-15.02, T-15.03, T-15.08, T-15.09, T-15.32 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — `ledger_entries` exists, and `BR-FIN-01` is true because **the application database role
does not hold the `UPDATE` or `DELETE` privilege** — not because the code is careful, not because
the repository lacks a method, but because the privilege is absent and the deploy fails if it ever
appears.

**Depends on** — M-010, M-013, M-016, M-018, M-048.

**Unblocks** — M-088, M-089, M-090, and all of `EP-16` in Sprint 12.

**Files**

- `prisma/migrations/<ts>_create_ledger_entries/migration.sql` — header `phase: expand · rls: new table, policy in this migration (MG10) · grants: SELECT, INSERT only — NO UPDATE, NO DELETE · append_only: YES (grant-enforced)`. Columns `id`, `tenant_id`, `entry_type ledger_entry_type_enum`, `direction`, `amount_minor bigint`, `currency char(3)`, `reference_type`, `reference_id`, `settlement_batch_id` nullable, `occurred_at timestamptz`, `correlation_id`.
- Same migration: the **twelve** `§C2.2` entry types — `SALE`, `COMMISSION`, `GATEWAY_FEE`, `TAX`, `REFUND`, `COMMISSION_REVERSAL`, `CHARGEBACK`, `CHARGEBACK_REVERSAL`, `RESERVE_HOLD`, `RESERVE_RELEASE`, `PAYOUT`, `ADJUSTMENT`; indexes `(tenant_id, occurred_at)` and `(settlement_batch_id)`; the RLS policy; and the grant statement written **explicitly as `GRANT SELECT, INSERT`**, never as `GRANT ALL` narrowed later.
- `apps/server/src/ledger/ledger.module.ts` · `index.ts` · `README.md` — **no `controllers/`**: `ledger/` is provider-only, and a write endpoint on the ledger is the exact API that would let something adjust a balance (`FolderStructure.md` §7.3.1, line 837).
- `apps/server/src/ledger/ports/ledger-append.port.ts` · `ledger-read.port.ts` — append-only **by signature**; there is no `update` and no `delete` in either interface.
- `apps/server/src/ledger/domain/ledger-entry.entity.ts` · `.spec.ts` — constructed complete, no mutators.
- `apps/server/src/ledger/domain/tenant-balance.vo.ts` · `.spec.ts` — `SUM(CASE direction WHEN 'CREDIT' THEN amount_minor ELSE -amount_minor END)`; computed, no setter, no stored figure.
- `apps/server/src/ledger/application/services/ledger-writer.service.ts` · `.int-spec.ts` — the entry is written in the **same transaction** as the state change that caused it.
- `apps/server/src/ledger/infrastructure/ledger.prisma-repository.ts` · `.int-spec.ts`
- `packages/config/scripts/append-only-grants.mjs` — extended for `ledger_entries`.
- `packages/config/scripts/ban-balance-columns.mjs` · `.spec.mjs` — fails any migration adding a column named `balance` to a tenant-owned table.
- `infra/scripts/ledger-grant-assertion.sh` — runs on **every deploy in every environment** and **fails the deploy** if an `UPDATE` or `DELETE` grant exists on `ledger_entries` (T-15.32, `E11.4`).
- `docs/FEATURE_FLAGS.md` — `mig.ledger.balance-projection` (**off**; the projection is a cache and the settlement build never reads it).

**Acceptance criteria**

1. **The grant model, not application discipline, is what makes `BR-FIN-01` true.** `UPDATE ledger_entries` and `DELETE FROM ledger_entries` as `app_rw` both raise `permission denied` in local, CI, staging and production. Careful code, an append-only repository interface and a mutator-free entity are all present — and all three are **defence in depth behind the absent privilege**, not the enforcement (`BR-FIN-01` `L3-GRANT` AUTHORITATIVE, `BR-FIN-01-N1`, `C2.2`, ADR-0015).
2. The privilege check runs at **three** independent moments: `CI-02` in the pipeline against the live catalogue, `append-only-grants` as a unit-testable script, and `ledger-grant-assertion.sh` on **every deploy**, which fails the deploy rather than warning (`E11.4`, T-15.32).
3. `gym.ledger.grant_violation` is emitted continuously and its **only acceptable value is 0**; a non-zero reading pages immediately (T-15.49).
4. **No balance is stored.** No `balance` column exists on any tenant-owned table, and a synthetic migration adding one **fails CI** — the negative test is the proof, not the absence today (`BR-FIN-01-N2`).
5. `TenantBalance` is derived. A mixed cycle — sales, refunds, fees, reserve holds, a payout — reconciles at **every intermediate point** to the arithmetic sum of entries (`BR-FIN-01-P1`).
6. `ledger/` has **no controllers directory**, and the structure test that enforces the `controllers/` requirement carries `ledger/` in its exemption list with the reason recorded (`FolderStructure.md` §7.3.1).
7. **No method name under `ledger/infrastructure/**` begins with `update` or `delete`** — the method name is the affordance, and if it exists someone will call it (`FolderStructure.md` §19 rule 17, invariant 14).
8. A ledger entry is written in the **same transaction** as its cause; a failure injected between the state change and the append leaves neither (`BR-FIN-01`, `M-018`).
9. `amount_minor` is `bigint` paise and crosses the API boundary as a **string** with an adjacent currency field; no JSON number carries paise anywhere in this module (R-8, `TR-38`, T-15.35).
10. RLS is enabled and forced; a tenant-B principal reads zero tenant-A entries, and the mandatory isolation assertion is in the repository integration spec (R-6, `BR-TEN-01`).
11. `mig.ledger.balance-projection` is registered **off**, and a structure test proves the settlement build path never imports the projection (T-15.33, `AC-SETL-07.5`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `ledger-grants.int-spec.ts` | Integration | `UPDATE` and `DELETE` as `app_rw` both raise `permission denied` (`BR-FIN-01-N1`) |
| `ban-balance-columns.spec.mjs` | Unit | A synthetic migration adding `tenants.balance` fails the check (`BR-FIN-01-N2`) |
| `tenant-balance.vo.spec.ts` | Unit | Derived sum; no setter; credit/debit sign convention across all twelve types |
| `ledger-balance-cycle.int-spec.ts` | Integration | Mixed cycle reconciles at every intermediate point (`BR-FIN-01-P1`) |
| `ledger-writer.service.int-spec.ts` | Integration | Same-transaction append; injected failure leaves neither row |
| `ledger-no-mutators.structure-spec.ts` | Structure | No `update*`/`delete*` under `ledger/infrastructure/**`; no `controllers/` directory |
| `ledger.prisma-repository.int-spec.ts` | Integration | Mandatory RLS assertion; index usage on both indexes |

**Rollback plan** — Expand-phase; `git revert` removes the module. The table is **never dropped by a
revert** — a contract migration after the 35-day PITR window is the only way it goes, and it
requires Finance sign-off recorded in `DECISION_LOG.md`. The `mig.ledger.balance-projection` flag
stays off. Note explicitly: rolling back this milestone does **not** revoke anything, because the
milestone grants nothing beyond `SELECT, INSERT`.

**Notes** — The trap is believing an append-only repository interface is the control. It is not: a
`$executeRaw` two modules away, a Prisma `migrate dev` that regenerates the table with default
grants, a hotfix run as the migration role — each bypasses the interface entirely and none of them
looks wrong in review. The privilege is the control because it is the only layer that is true for
**every** connection, including the ones nobody anticipated. This is also why the grant is written
as an explicit `GRANT SELECT, INSERT` rather than `GRANT ALL` followed by `REVOKE`: the intermediate
state of the second form is a table anyone can delete from, and a migration that fails halfway
leaves exactly that. The second trap is the materialised balance introduced later "for the dashboard".
It will be correct for months and then diverge, and at that moment there is no way to determine which
number is right — which is precisely the condition `ADR-0015` exists to prevent.

---

### M-088 — The **eight `A6.3` figures** persisted per transaction

| Field | Value |
| :--- | :--- |
| **Sprint** | 11 |
| **Epic** | EP-15 · F-15.2, F-15.13, F-15.22 · T-15.05, T-15.07, T-15.35 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — Every settled transaction carries its **eight `A6.3` figures written at sale** — gross,
discount, net, tax, commission base, commission, gateway fee, payable — so a statement issued in
March still says in December what it said in March.

**Depends on** — M-049, M-050, M-058, M-059, M-087.

**Unblocks** — M-089, M-090.

**Files**

- `prisma/migrations/<ts>_create_settlement_lines/migration.sql` — header `phase: expand · rls: new table, policy in this migration · grants: SELECT, INSERT only (append-only)`. `settlement_lines` (`tenant_id`, `settlement_batch_id` nullable, `ledger_entry_id`, `order_id`, `gross_minor`, `discount_minor`, `net_minor`, `tax_minor`, `commission_base_minor`, `commission_minor`, `gateway_fee_minor` **nullable**, `payable_minor`, `commission_tax_minor` nullable, `occurred_at`) — every money column `bigint`.
- Same migration: `idx_settlement_lines__eligible` — a **partial filtered index** on `(tenant_id, occurred_at)` `WHERE gateway_fee_minor IS NOT NULL AND settlement_batch_id IS NULL`, which is what drives batch selection (T-15.07).
- `apps/server/src/settlements/settlements.module.ts` · `index.ts` · `README.md`
- `apps/server/src/settlements/domain/settlement-figures.vo.ts` · `.spec.ts` — the eight figures as one immutable object with `N = G − D` and `P = (N + T) − C − F` checked at construction.
- `apps/server/src/settlements/application/services/settlement-line-writer.service.ts` · `.int-spec.ts` — writes the line in the **same transaction** as the `SALE` ledger entry.
- `apps/server/src/settlements/infrastructure/settlement-line.prisma-repository.ts` · `.int-spec.ts`
- `packages/types/src/money-wire.ts` · `.spec.ts` — `bigint` paise serialised as **strings** with an adjacent currency field, applied to every settlement DTO.

**Acceptance criteria**

1. All **eight** `A6.3` figures are persisted per line and **never recomputed at display**; the statement renderer performs no arithmetic beyond summation, enforced by `dependency-cruiser` forbidding it to import any calculator (`BR-FIN-02`, `Epic_15.md` §3.3).
2. The `A6.3` worked example reproduces **exactly in paise**: gross 5,000 · discount 1,000 · net 4,000 · tax 720 · base 4,000 · commission 400 · fee 94.40 · payable 4,225.60 — as a to-the-paise unit test (`AC-EP15-12`, `BR-FIN-04-P1`).
3. **`gateway_fee_minor` is nullable, and that nullability is load-bearing.** It makes *"not yet reported"* representable instead of guessable; a fee is written **as reported by the provider, never estimated** (`BR-FIN-06`).
4. The partial filtered index means an **unreported fee cannot be swept into a batch by accident** — a line with a null fee is structurally invisible to batch selection, not merely filtered out in application code (`BR-FIN-06` `L1-DB`, T-15.07).
5. `settlement_lines` is append-only by grant, exactly as `ledger_entries` is; `append-only-grants` covers it (R-6, M-087 criterion 1).
6. Every money field crosses the API boundary as a **string** with an adjacent currency field; a contract test asserts **no JSON number carries paise** anywhere in the settlement DTOs (R-8, `TR-38`, `NFR-DQ-02`).
7. Figures are integer minor units end to end with **one** `round_half_even`, applied once, in `packages/utils/src/money/`; `no-float-money` passes (R-8, `TR-05`).
8. RLS and grants ship in this migration; isolation coverage extends the M-015 suite to `settlement_lines` (R-5, R-6).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `settlement-figures.vo.spec.ts` | Unit | `N = G − D`; `P = (N + T) − C − F`; construction refuses an inconsistent set; the `AC-EP15-12` worked example |
| `settlement-line-writer.service.int-spec.ts` | Integration | Same-transaction write with the `SALE` entry; null fee permitted; append-only grant |
| `eligible-lines-index.int-spec.ts` | Integration | A null-fee line is invisible to batch selection; `EXPLAIN` confirms the partial index is used |
| `money-wire.spec.ts` | Unit | `bigint` → string; currency adjacent; round-trip fidelity at 9,007,199,254,740,993 paise |
| `settlement-lines.isolation-spec.ts` | Isolation (`IS3`) | Cross-tenant line read |

**Rollback plan** — Expand-phase; `git revert` removes the writer. Lines already written are
retained and remain readable — they are financial records. The contract migration is Finance-approved
and post-PITR, as in M-087.

**Notes** — The trap is defaulting `gateway_fee_minor` to `0`. Zero is a *reported* fee of nothing;
null is *not yet reported*. Collapse them and a batch closes with a fee of zero on a transaction that
will later report ₹94.40, and the payout is wrong by exactly that — with a statement that ties out
perfectly to the wrong number. The nullability plus the partial index is the whole mechanism.

---

### M-089 — Commission with the rate **frozen at sale**; `commission_tax_minor`

| Field | Value |
| :--- | :--- |
| **Sprint** | 11 |
| **Epic** | EP-15 · F-15.3, F-15.4, F-15.16, F-15.17 · T-15.10…T-15.15 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Commission is computed from a branded base that only one resolver can construct, at the
rate resolved **at the moment of sale and persisted on the order**, so a later rate change can never
reach back into settled history — and the ninth India figure is present and zero.

**Depends on** — M-048, M-049, M-050, M-059, M-086, M-087, M-088.

**Unblocks** — M-090, and `EP-16`'s `BR-REF-05` commission reversal in Sprint 12.

**Files**

- `prisma/migrations/<ts>_add_commission_tax_and_reversal_types/migration.sql` — header `phase: expand · rls: unchanged · grants: unchanged`. Adds the `COMMISSION_TAX` and `COMMISSION_TAX_REVERSAL` values to `ledger_entry_type_enum` and confirms `commission_tax_minor` on `orders`, `settlement_lines` and `settlement_batches` — **columns present, values zero** (reconciliation **R-M6**, `Schema.md` §14.3).
- `apps/server/src/settlements/domain/commission-base.ts` · `.spec.ts` — a **branded** type constructible only by `CommissionBaseResolver`: `GYM → B = N`, `PLATFORM → B = N + D` (`BR-CPN-05`).
- `apps/server/src/settlements/domain/commission-base.resolver.ts` · `.spec.ts`
- `apps/server/src/settlements/domain/commission.calculator.ts` · `.spec.ts` — `C = round_half_even(B × bps / 10000)` in **integer** arithmetic; `BasisPoints` is an integer type with no floating-point constructor.
- `apps/server/src/settlements/application/services/commission-rate.resolver.ts` · `.int-spec.ts` — `global < tier < tenant override` on **absolute bps**, tier percentage-point deltas converted at resolution, result **clamped to 0 bps**, and the resolved value **persisted on the order** (T-15.12, `KL-006`(a)).
- `apps/server/src/settlements/application/services/renewal-generation.resolver.ts` · `.spec.ts` — derived from the prior membership on `(user_id, gym_id)` and persisted on the order; first renewal at standard, second onward reduced (T-15.13, `OQ-02`).
- `apps/server/src/settlements/application/services/commission-tax.calculator.ts` · `.spec.ts` — 18% GST on `C` at the tax-profile rate, **resolving to 0 bps** until `REG-02` is decided.
- `tests/property/money-rounding.property-spec.ts` — the shared rounding-parity suite (T-15.41).

**Acceptance criteria**

1. The commission base is **unconstructable** outside `CommissionBaseResolver`; a test attempts direct construction from a plain number and from a DTO and both fail to compile (`BR-FIN-04` `L5-DOM`).
2. `B = N` for a **gym-funded** coupon and `B = N + D` for a **platform-funded** one — the platform does not charge the gym commission on a discount the platform paid for (`BR-CPN-05`, `Epic_15.md` §18.3).
3. **The rate is frozen at sale.** It is resolved once, persisted on the order as `commission_rate_bps`, and every downstream computation reads the persisted value. A test changes the tenant override *after* a sale and asserts the settled line is byte-identical (`BR-FIN-05`, `AC-ADMN-01.4`).
4. Rate resolution is `global < tier < tenant override` on **absolute bps**, with tier percentage-point deltas converted at resolution and the result **clamped to 0** — a negative commission is not representable (T-15.12, `KL-006`(a)).
5. `C = round_half_even(B × bps / 10000)` in integer arithmetic with **one** rounding step; the `A6.3` worked example reproduces to the paise (`BR-FIN-04-P1`, `AC-EP15-12`).
6. Renewal generation is derived from `(user_id, gym_id)` and **persisted on the order**, because a later membership deletion must not silently reprice history (`A6.3`, `KL-006`(b), `OQ-02`).
7. **`commission_tax_minor` ships present and zero**, with `COMMISSION_TAX` and `COMMISSION_TAX_REVERSAL` in the enum, so a `REG-02` "yes" is a configuration change plus a backfill and **not a schema migration through settled money** (R-M6, `F-15.16`, `F-15.17`, `BLK-03` conflict 2).
8. The reversal type reverses **at the same rounding as the original**, not by recomputing — recomputation at a changed rate is `BR-REF-05-N1`'s failure (T-15.15, §13.1 finding 2).
9. The property suite holds: allocation across N lines re-sums exactly, and rounding is consistent across commission, tax, proration and reversal over randomised amounts and line counts (T-15.41, `TR-05`, `AC-EP15-42`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `commission-base.resolver.spec.ts` | Unit | `GYM → N`; `PLATFORM → N + D`; branded type unconstructable elsewhere |
| `commission.calculator.spec.ts` | Unit | Integer `round_half_even`; the worked example; half-way cases at .5 paise in both directions |
| `commission-rate.resolver.int-spec.ts` | Integration | Three-level precedence; delta conversion; clamp at 0; persisted on the order |
| `rate-frozen-at-sale.int-spec.ts` | Integration | Override changed after sale leaves the settled line byte-identical (`BR-FIN-05`) |
| `commission-tax.calculator.spec.ts` | Unit | Zero at 0 bps; correct at 18% when enabled; reversal at the original rounding |
| `money-rounding.property-spec.ts` | Property | N-line allocation re-sums exactly across 10,000 randomised cases |

**Rollback plan** — Expand-phase. The enum values and the zero-valued column are **additive and
inert**; reverting the code leaves them unused, which is exactly the state R-M6 designed for. No
flag — a commission calculator behind a flag would mean an order priced with no commission at all.

**Notes** — The trap is resolving the rate at settlement time instead of at sale time. It is simpler,
it is one fewer column, and it means every historical statement silently reprices the day the
platform changes its commission — which is both a contractual breach and unprovable after the fact.
The second trap is percentage-point deltas: a tier expressed as "−1.5 percentage points" against a
global 12% is **1050 bps**, and a codebase that mixes percent, percentage-point and bps in one
resolver will be off by a factor of 100 somewhere, on a figure nobody reads until a tenant does.

---

### M-090 — Settlement batch assembly and the `BR-FIN-03` closure assertion

| Field | Value |
| :--- | :--- |
| **Sprint** | 11 |
| **Epic** | EP-15 · F-15.4, F-15.14, F-15.20, F-15.21 · T-15.04, T-15.06, T-15.16, T-15.17, T-15.24, T-15.31 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A tenant's cycle assembles into a batch of lines over the `C4.7` machine, at 02:00 in the
tenant's own timezone, exactly once per period — and the batch **refuses to close** unless its
components sum to the payout in integer paise with no tolerance.

**Depends on** — M-018, M-063, M-087, M-088, M-089.

**Unblocks** — `Milestones_090-119.md` — approval and dual control, reserve release, the Razorpay
Route payout adapter, daily reconciliation and `SCR-DASH-014`.

**Files**

- `prisma/migrations/<ts>_create_settlement_batches/migration.sql` — header `phase: expand · rls: new table, policy in this migration · grants: SELECT, INSERT, restricted UPDATE (status, approver columns, payout_reference) only`. `settlement_batches` (`tenant_id`, `period_start`, `period_end`, `opening_balance_minor`, `gross_minor`, `commission_minor`, `commission_tax_minor`, `fees_minor`, `refunds_minor`, `reserve_held_minor`, `reserve_released_minor`, `net_payable_minor`, `status settlement_batch_status_enum`, `payout_reference`, `statement_url`, `approver_1_id`, `approver_2_id`, `renderer_digest`).
- Same migration: **`UNIQUE (tenant_id, period_start, period_end)`** — the `TR-25` idempotency guarantee at the database, not in the job; the `BR-FIN-08` dual-approval `CHECK` requiring **distinct** approvers; `CHECK (net_payable_minor >= 0)`; the RLS policy and grants.
- `apps/server/src/settlements/domain/settlement-batch.aggregate.ts` · `.spec.ts` · `settlement-status.state-machine.ts` · `.spec.ts` — all **eight** `C4.7` states with the exact legal edges including `FAILED → PENDING_APPROVAL` and `CLOSED → ON_HOLD`, plus the §3.4 six-state tenant-facing mapping.
- `apps/server/src/settlements/domain/closure-assertion.ts` · `.spec.ts` — `opening_balance + Σ(lines) + reserve_released − reserve_held = net_payable`, integer minor units, **refuses to close on any difference**.
- `apps/server/src/settlements/application/use-cases/assemble-batch.use-case.ts` · `.int-spec.ts`
- `apps/server/src/settlements/jobs/settlement-build-batches.job.ts` · `.spec.ts` — 02:00 **in the tenant's zone** via the M-063 primitive; a distributed lock plus the database uniqueness.
- `apps/server/src/settlements/infrastructure/settlement-batch.prisma-repository.ts` · `.int-spec.ts`
- `apps/server/src/settlements/controllers/tenant-settlements.controller.ts` · `.int-spec.ts` · `.isolation-spec.ts`
- `infra/monitoring/alerts/settlement-batch-close-failures.yaml` · `docs/runbooks/settlement-batch-close-failure.md`
- `docs/FEATURE_FLAGS.md` — `rel.settlements.auto-payout` registered **off**; assembly runs, payout does not.

**Acceptance criteria**

1. **The closure assertion is a refusal, not a warning.** `opening_balance + Σ(lines) + reserve_released − reserve_held = net_payable` is checked in integer paise with **zero tolerance**, and a difference of one paise leaves the batch `OPEN` with `gym.settlement.batch_close_failures` incremented and the runbook named (`BR-FIN-03`, `F-15.14`, `E11.1`).
2. Each component of the assertion is **persisted on the batch**, so a disagreement is diagnosable from the row rather than by re-running the job (T-15.24).
3. **A duplicated job execution cannot build a second batch for one period.** `UNIQUE (tenant_id, period_start, period_end)` is the guarantee; the distributed lock is an optimisation, and the test kills the lock mid-run under a simulated Redis failover and asserts the second execution fails on the constraint (`TR-25`, F-15.20).
4. Scheduling is **IST-anchored**: the job computes the next UTC instant corresponding to 02:00 in the **tenant's** timezone — 02:00 IST is **20:30 UTC the previous day** — never a fixed UTC cron (R-9, `TR-24`, F-15.21).
5. Only lines with a **reported** gateway fee and no batch are selected, through the M-088 partial index; an unreported fee holds its line out of the batch by construction (`BR-FIN-06`).
6. The `C4.7` machine carries all **eight** states with the exact legal edges; an illegal transition raises `422 INVALID_SETTLEMENT_TRANSITION` and is unrepresentable in the aggregate. The tenant sees the **six** of `FR-SETL-07` through the §3.4 mapping — the mapping reconciles them, neither definition is changed.
7. `CHECK (net_payable_minor >= 0)` holds: a negative payout is not representable, and a negative balance carries forward as an explicit opening-balance line in the next cycle rather than as a negative payout (`TR-26` Q3).
8. Batch assembly writes no ledger entry it did not compute from persisted line figures — the batch **never recomputes** a figure `A6.3` already froze (`BR-FIN-02`).
9. The restricted `UPDATE` grant covers `status`, the two approver columns and `payout_reference` **only**; `append-only-grants` asserts that updating any money column raises `permission denied` — the same column-level technique M-074 used for check-out.
10. RLS and grants ship in this migration (R-6); isolation coverage for the tenant controller, including a cross-tenant batch read and statement download, ships here (R-5, T-15.46).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `closure-assertion.spec.ts` | Unit | Exact equality; a one-paise difference refuses; each component persisted |
| `settlement-status.state-machine.spec.ts` | Unit | Eight states; every legal edge; `FAILED → PENDING_APPROVAL`; `CLOSED → ON_HOLD`; the six-state mapping |
| `assemble-batch.use-case.int-spec.ts` | Integration | Eligible-line selection; unreported fee held out; figures copied not recomputed |
| `batch-idempotency.int-spec.ts` | Integration | Duplicated execution under a killed lock fails on the unique constraint (`TR-25`) |
| `settlement-build-batches.job.spec.ts` | Unit | 02:00 IST resolves to 20:30 UTC the previous day; per-tenant zones |
| `settlement-batch-grants.int-spec.ts` | Integration | Column-level `UPDATE` boundary; money columns immutable |
| `tenant-settlements.controller.isolation-spec.ts` | Isolation (`IS3`) | Cross-tenant batch read and statement download |

**Rollback plan** — Expand-phase; `rel.settlements.auto-payout` stays **off** through this milestone,
so no money moves regardless. `git revert` removes assembly; batches already closed are retained as
financial records and remain readable. Because no payout has been instructed, a revert here has zero
external effect — which is exactly why assembly and payout are separate milestones across a sprint
boundary.

**Notes** — The trap is a tolerance. Someone will propose `abs(difference) <= 1` to absorb "rounding",
and the moment that exists the system can no longer distinguish a rounding artefact from a missing
line — and `BAC-07` and `E2E-12` require **zero** variance, not small variance. If the sum does not
tie, the arithmetic is wrong somewhere upstream and the batch must not close. The second trap is the
UTC cron. `0 2 * * *` UTC is 07:30 IST — inside business hours, mid-cycle, with a tenant's sales
still arriving — and it will look correct in every test written by someone in UTC.

---

## 8. Band closure

### 8.1 Sprint exit reconciliation

| Sprint | Exit condition (`C9.1`) | Milestones that make it true |
| :-: | :--- | :--- |
| 7 | ***`E2E-05` passes*** — the membership lifecycle end to end | M-061 … M-068 |
| 8 | ***`E2E-03` and `E2E-04` pass; `NFR-PERF-03` met*** — **Milestone M4** | M-069 … M-076 |
| 9 | ***`E2E-10` passes*** — offline sale, member record, branch-scoped operation | M-077 … M-082 |
| 10 | ***`E2E-09` passes*** — earned review, screening, moderation, aggregate | M-083 … M-086 |
| 11 | ***`E2E-12` passes with zero variance*** — begun here, completed in `Milestones_090-119.md` | M-087 … M-090 |

### 8.2 The four structural guarantees this band adds

| Guarantee | Made true by | Enforced at |
| :--- | :--- | :--- |
| Attendance is append-only and monthly-partitioned from birth | M-069 | Grant + `CI-02` + `append-only-grants` |
| Branch scope is unforgeable from a request | M-078 | Branded type + lint rule + isolation suite |
| A member's review cannot be altered by anyone who is not the member | M-083, M-084 | Absent grant + OpenAPI structural absence |
| **A balance cannot be adjusted, only appended to** | **M-087** | **Absent `UPDATE`/`DELETE` privilege, asserted on every deploy** |

### 8.3 Carried into `Milestones_090-119.md`

`EP-16` refunds, disputes and evidence packs (Sprint 12) · settlement approval and dual control
(T-15.25) · reserve withholding and release (T-15.19) · the **Razorpay Route payout adapter**
(T-15.26) · daily reconciliation and the per-tenant auto-payout block (T-15.29, T-15.30) ·
`SCR-DASH-014`, `SCR-ADM-007` and `SCR-ADM-010` · `E2E-12` automation (T-15.42) · the descoped
`D-03`, `D-04`, `D-05` and `D-09` items, each re-tabled at the Sprint-13 refinement, not dropped.

### 8.4 Open items this band must not outrun

| Item | Needed by | Consequence if unresolved |
| :--- | :--- | :--- |
| **`REG-02` / `BLK-03` c2** — GST on platform commission | Before Sprint 11 starts | M-089 ships the column and the entry types at **0 bps** (R-M6). The schema decision is not deferred, only the rate |
| **`OQ-EP15.a`** — reserve on `payable` or `net` | Sprint 11, day 1 | Adopted: on `payable_minor` (`P`). M-090 persists `reserve_held_minor` either way |
| **`O-5`** — attendance retention versus review eligibility | Before the Sprint-13 retention sweep | Purging attendance would make M-083's verified-member marker unprovable |
| **`OQ-11.g`** — override and session entitlement | Resolved in M-074 | Yes, unless the reason is `TRIAL_VISIT` |

---

**END OF FILE — `Milestones_060-089.md` · milestones M-061 … M-090 complete · 30 of 30 written ·
continues in `Milestones_090-119.md` at M-091.**
