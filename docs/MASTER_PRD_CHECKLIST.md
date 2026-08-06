# MASTER PRD CHECKLIST — Gym Marketplace & Multi-Tenant Gym Management SaaS

> **Companion to** `/docs/MASTER_PRD.md` (BRD/PRD v2.0, 04 Aug 2026).
> **Purpose.** Every requirement in the Master PRD, decomposed into one individually tickable line.
> Nothing in the PRD is summarised, sampled, grouped or collapsed here. If a requirement exists in
> the PRD, it has exactly one row in this file, and that row can be ticked.

| Field | Value |
| :--- | :--- |
| Document | `/docs/MASTER_PRD_CHECKLIST.md` |
| Source of truth | `/docs/MASTER_PRD.md` (v2.0) — this file never overrides it |
| Execution ledger | `/docs/PHASES.md` (Phase 1, deliverable 2) |
| Stack ruling | `/docs/engineering/STACK_ADDITIONS.md` |
| Total tickable items | **1,648** |
| Ticked | **0** |
| Overall completion | **0.0%** |
| Phase-1 launch-blocking items | **286** (271 `M`-priority + `BAC-01` … `BAC-15`) |
| Phase-1 launch-blocking ticked | **0** |

---

## 1. How to use this checklist

### 1.1 The tick convention

| Mark | Meaning |
| :--: | :--- |
| `[ ]` | Not started. No implementation, no test, no documentation. |
| `[~]` | In progress. At least one of implement / test / document is done, but not all three. |
| `[x]` | **Done.** Implemented **and** tested **and** documented. See §1.2. |
| `[!]` | Blocked. The `Status` cell names the blocker and its owner. |
| `[-]` | Deliberately deferred. The `Status` cell records who deferred it, when, and why, and links the entry in `/docs/KNOWN_LIMITATIONS.md`. |

### 1.2 The three-gate rule — an item is `[x]` only when all three are true

An item may be ticked **only** when every one of the following holds. Two out of three is `[~]`,
never `[x]`.

1. **IMPLEMENTED.** The behaviour exists in the shipped code path on the trunk, behind no
   permanently-disabled feature flag, and satisfies the requirement text in this row in full — not
   the easy 80% of it.
2. **TESTED.** At least one automated test of the kind named in the `Verifying test` column exists,
   executes in CI, and fails if the behaviour is removed. For every `M`-priority row the suite must
   also prove the **negative** case (`BAC-06`). A test that passes whether or not the feature works
   does not satisfy this gate.
3. **DOCUMENTED.** The behaviour is described in the Phase-2…6 engineering artefact that owns it
   (`/docs/engineering/`, `/docs/database/`, `/docs/apis/`, `/docs/ui/`), the row's PRD identifier is
   cited in that artefact, and any decision taken along the way is recorded in
   `/docs/DECISION_LOG.md`.

### 1.3 The unticking rule

A tick is a claim. Removing one is an event, not a correction.

- An item may move from `[x]` back to `[ ]`, `[~]`, `[!]` or `[-]` **only with a dated note appended
  to §22 Untick Register** stating: the identifier, the date, the actor, which of the three gates
  broke, the defect or change-request reference, and the remediation owner.
- The `Status` cell of the unticked row must be changed in the same commit to point at that register
  entry.
- Unticking an `M`-priority row or any `BAC-` row is a release blocker and is raised in the daily
  stand-up on the day it happens.
- A silent untick — a tick removed with no register entry — is treated as a Severity-2 process
  defect under §C8.5.

### 1.4 Column definitions

| Column | Meaning |
| :--- | :--- |
| `[ ]` | The tick box. One per requirement. Never shared between two requirements. |
| **ID** | The stable PRD identifier. Never reused, never renumbered. Withdrawn items stay in place marked `[WITHDRAWN]`. |
| **Requirement** | The requirement itself, reproduced from the PRD. Compressed only where compression loses no meaning. |
| **Pri** | MoSCoW priority **as stated in the PRD**. `—` means the source states no priority for that family; such rows are not counted in the launch-blocking subtotal. |
| **Module** | The owning backend module from §C1.3, and/or the owning surface (`web`, `dash`, `admin`). |
| **PRD §** | The section of `/docs/MASTER_PRD.md` the row comes from. |
| **Verifying test** | The §C8.1 test layer(s) that must cover the row, plus any PRD-declared journey (`E2E-`), UAT script (`UAT-`) or business acceptance criterion (`BAC-`) that exercises it. |
| **Status** | Free text. Blocker, deferral reason, untick-register pointer, or PR reference. |

### 1.5 Standing rules for anyone editing this file

1. **Tick in the same change as the work.** A tick committed separately from the code it describes is
   not evidence; it is a claim about a commit nobody reviewed together.
2. **Never collapse rows.** `BR-MEM-01 … BR-MEM-14` is fourteen rows here, permanently. Ranges are
   forbidden in this file even where they would read more neatly.
3. **Never delete a row.** A requirement removed by change control is marked `[WITHDRAWN]` in the
   Requirement cell, with the change-request reference, and keeps its box and its identifier.
4. **The PRD wins.** If a row here disagrees with `/docs/MASTER_PRD.md`, the PRD is correct and this
   file is defective. Fix this file and log the discrepancy in `/docs/PHASES.md` → Progress Log.
5. **New requirements enter through §C10 Change Control only**, and arrive with a new identifier in
   the correct family — never by reusing a retired one.

### 1.6 Standing note on technology

The technology stack named in the PRD — the *Baseline Decisions* table and **Part C §C1.1** — is
authoritative and unchangeable. The API is **NestJS 10 on Node.js 20 (TypeScript)**, built as a
**modular monolith**, on **PostgreSQL 16 + PostGIS**, with **PostgreSQL full-text + trigram** search
(OpenSearch only past ~50k listings), **Redis 7 + BullMQ**, **S3-compatible object storage + CDN**,
**Next.js 14 App Router + React 18** for `web`, **React 18 + Vite** SPAs for `dash` and `admin`, a
shared component library over design tokens, **TanStack Query** for server state, **JWT access tokens
+ rotating refresh tokens** stored httpOnly, a **`PaymentProvider` port with a Stripe Connect
reference adapter**, channel-adapter notifications, **headless-Chromium deterministic PDF**,
**OpenTelemetry** traces with structured JSON logs and metrics, trunk-based CI/CD, and containers on a
managed orchestrator with managed Postgres and Redis under IaC.

Where a row below depends on a technology the PRD does **not** name — the ORM, the schema-validation
library, the CSS framework, the component-primitive library, the form library, the real-time
transport, the monorepo tool, the test runners, the QR render/scan libraries, the logging library, the
image processor, the CSV parser — that slot is referred to generically and carries its pending
register identifier, for example *"the ORM (pending A-01)"* or *"the validation library (pending
A-02)"*. Those slots are tracked as `A-01` … `A-30` in `/docs/engineering/STACK_ADDITIONS.md` and
**none of them is approved**. No row in this checklist may be ticked on the strength of an unapproved
addition.

---

## 2. Progress Dashboard

### 2.1 Completion by identifier family

Counts are the source counts verified against `/docs/MASTER_PRD.md`. All `Done` values are zero
because no implementation work has begun — Phase 8 is locked per `/docs/PHASES.md`.

| # | Family | Prefix | Total | Done | Remaining | % |
| :-: | :--- | :--- | ---: | ---: | ---: | ---: |
| 1 | Guiding product principles | `PRIN-` | 7 | 0 | 7 | 0.0% |
| 2 | Business objectives | `OBJ-` | 10 | 0 | 10 | 0.0% |
| 3 | Success metrics | `KPI-` | 26 | 0 | 26 | 0.0% |
| 4 | RACI process rows | `RACI-` | 16 | 0 | 16 | 0.0% |
| 5 | Business rules | `BR-` | 95 | 0 | 95 | 0.0% |
| 6 | Functional requirements | `FR-` | 261 | 0 | 261 | 0.0% |
| 7 | Non-functional requirements | `NFR-` | 68 | 0 | 68 | 0.0% |
| 8 | User stories | `US-` | 38 | 0 | 38 | 0.0% |
| 9 | Acceptance criteria | `AC-` | 129 | 0 | 129 | 0.0% |
| 10 | Screens | `SCR-` | 55 | 0 | 55 | 0.0% |
| 11 | Mandatory screen states | `SCR-…-L/E/X/P` | 220 | 0 | 220 | 0.0% |
| 12 | API endpoints | `API-` | 193 | 0 | 193 | 0.0% |
| 13 | Risks | `RSK-` | 15 | 0 | 15 | 0.0% |
| 14 | Open questions | `OQ-` | 20 | 0 | 20 | 0.0% |
| 15 | Assumptions | `ASM-` | 7 | 0 | 7 | 0.0% |
| 16 | Constraints | `CON-` | 5 | 0 | 5 | 0.0% |
| 17 | External dependencies | `DEP-` | 8 | 0 | 8 | 0.0% |
| 18 | Business acceptance criteria | `BAC-` | 15 | 0 | 15 | 0.0% |
| 19 | End-to-end journeys | `E2E-` | 12 | 0 | 12 | 0.0% |
| 20 | UAT scripts | `UAT-` | 6 | 0 | 6 | 0.0% |
| 21 | Background jobs | `JOB-` | 24 | 0 | 24 | 0.0% |
| 22 | Analytics events | `EVT-` | 49 | 0 | 49 | 0.0% |
| 23 | Derived analytics funnels | `FNL-` | 2 | 0 | 2 | 0.0% |
| 24 | State machines | `SM-` | 7 | 0 | 7 | 0.0% |
| 25 | State-machine transitions | `SMT-` | 64 | 0 | 64 | 0.0% |
| 26 | State-machine invariants | `SMI-` | 3 | 0 | 3 | 0.0% |
| 27 | Reason-code taxonomies | `RCT-` | 5 | 0 | 5 | 0.0% |
| 28 | Reason codes | `RC-` | 57 | 0 | 57 | 0.0% |
| 29 | Core tables (§C2.2) | `TBL-` | 35 | 0 | 35 | 0.0% |
| 30 | ERD-only entities (§C2.1) | `TBL-` | 8 | 0 | 8 | 0.0% |
| 31 | Reference tables (§C2.3) | `REF-` | 11 | 0 | 11 | 0.0% |
| 32 | Indexes (§C2.4 + inline §C2.2) | `IDX-` | 19 | 0 | 19 | 0.0% |
| 33 | Partition declarations (§C2.2) | `IDX-` | 2 | 0 | 2 | 0.0% |
| 34 | Module inventory (§B1.3) | `MOD-` | 24 | 0 | 24 | 0.0% |
| 35 | Business processes (§A7) | `PROC-` | 5 | 0 | 5 | 0.0% |
| 36 | Revenue streams (§A6.1) | `REVS-` | 10 | 0 | 10 | 0.0% |
| 37 | Subscription tiers (§A6.2) | `TIER-` | 4 | 0 | 4 | 0.0% |
| 38 | Personas (§B2) | `PERS-` | 5 | 0 | 5 | 0.0% |
| 39 | Role definitions (§B3.1) | `ROLE-` | 12 | 0 | 12 | 0.0% |
| 40 | Permission matrix capability rows (§B3.2) | `PERM-` | 42 | 0 | 42 | 0.0% |
| 41 | Baseline notification catalogue (§B5.19) | `NOTIF-` | 24 | 0 | 24 | 0.0% |
| 42 | Tenant report catalogue (§B5.20) | `RPT-T-` | 16 | 0 | 16 | 0.0% |
| 43 | Platform report catalogue (§B5.20) | `RPT-P-` | 11 | 0 | 11 | 0.0% |
| 44 | Editorial flags carried forward | `KL-` | 3 | 0 | 3 | 0.0% |
| | **TOTAL** | | **1,648** | **0** | **1,648** | **0.0%** |

### 2.2 MoSCoW priority split

Only three families carry a MoSCoW priority in the PRD: `OBJ-` (§A3.2), `BR-` (§A8) and `FR-` (§B3.3,
§B4.4, §B5). Every other family is enumerated without a priority column in the source and is counted
below as *no stated priority*. Nothing here is assigned a priority the PRD does not state.

| Priority | Meaning (PRD → *Priority scale (MoSCoW)*) | OBJ | BR | FR | Total | Done | % |
| :-: | :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| **M** | Must have. Phase 1 scope. Absence blocks launch. | 7 | 82 | 182 | **271** | 0 | 0.0% |
| **S** | Should have. Phase 1 if capacity allows; first candidate to move to Phase 2. | 3 | 11 | 67 | **81** | 0 | 0.0% |
| **C** | Could have. Phase 2. Documented now to prevent architectural dead ends. | 0 | 2 | 12 | **14** | 0 | 0.0% |
| **W** | Won't have this time. Explicitly out of scope — the 11 deferred items in §A4.2 and the 3 non-goals in §A4.3, tracked as scope guards rather than buildable rows. | 0 | 0 | 0 | **0** | 0 | — |
| **—** | No priority stated in the source for that family. | — | — | — | **1,282** | 0 | 0.0% |
| | **TOTAL** | **10** | **95** | **261** | **1,648** | **0** | **0.0%** |

#### `M` / `S` / `C` split per requirement family

| Family | M | S | C | Total |
| :--- | ---: | ---: | ---: | ---: |
| `OBJ-` | 7 | 3 | 0 | 10 |
| `BR-TEN-` | 6 | 0 | 0 | 6 |
| `BR-GYM-` | 8 | 1 | 0 | 9 |
| `BR-PLN-` | 6 | 1 | 0 | 7 |
| `BR-MEM-` | 9 | 4 | 1 | 14 |
| `BR-PAY-` | 10 | 1 | 0 | 11 |
| `BR-REF-` | 9 | 0 | 0 | 9 |
| `BR-CHK-` | 9 | 1 | 0 | 10 |
| `BR-REV-` | 6 | 1 | 0 | 7 |
| `BR-CPN-` | 5 | 0 | 0 | 5 |
| `BR-RFL-` | 0 | 1 | 0 | 1 |
| `BR-WAL-` | 0 | 0 | 1 | 1 |
| `BR-FIN-` | 7 | 1 | 0 | 8 |
| `BR-DAT-` | 7 | 0 | 0 | 7 |
| `FR-RBAC-` | 5 | 2 | 0 | 7 |
| `FR-NAV-` | 5 | 1 | 0 | 6 |
| `FR-AUTH-` | 11 | 2 | 1 | 14 |
| `FR-USER-` | 6 | 2 | 0 | 8 |
| `FR-ONB-` | 13 | 2 | 0 | 15 |
| `FR-GYM-` | 9 | 2 | 1 | 12 |
| `FR-PLAN-` | 3 | 5 | 1 | 9 |
| `FR-SRCH-` | 13 | 1 | 1 | 15 |
| `FR-DETL-` | 5 | 6 | 0 | 11 |
| `FR-FAV-` | 0 | 3 | 2 | 5 |
| `FR-CART-` | 10 | 1 | 0 | 11 |
| `FR-PAY-` | 11 | 1 | 0 | 12 |
| `FR-INV-` | 10 | 1 | 0 | 11 |
| `FR-MEMB-` | 7 | 4 | 1 | 12 |
| `FR-CHK-` | 9 | 4 | 1 | 14 |
| `FR-CRM-` | 5 | 4 | 1 | 10 |
| `FR-STAF-` | 7 | 1 | 1 | 9 |
| `FR-REV-` | 9 | 2 | 0 | 11 |
| `FR-CPN-` | 5 | 3 | 0 | 8 |
| `FR-REFR-` | 0 | 6 | 1 | 7 |
| `FR-NOTF-` | 5 | 3 | 0 | 8 |
| `FR-RPT-` | 2 | 3 | 0 | 5 |
| `FR-SETL-` | 10 | 0 | 0 | 10 |
| `FR-RFND-` | 10 | 1 | 0 | 11 |
| `FR-SUP-` | 0 | 6 | 1 | 7 |
| `FR-ADMN-` | 12 | 1 | 0 | 13 |
| **TOTAL** | **271** | **81** | **14** | **366** |

### 2.3 Phase 1 launch-blocking subtotal

Launch-blocking = every `M`-priority requirement (which by the PRD's own MoSCoW definition blocks
launch) **plus** the fifteen business acceptance criteria `BAC-01` … `BAC-15`, which §A12 defines as
the conditions under which Phase 1 is accepted.

| Component | Count | Done | Remaining | % |
| :--- | ---: | ---: | ---: | ---: |
| `M`-priority business objectives (`OBJ-`) | 7 | 0 | 7 | 0.0% |
| `M`-priority business rules (`BR-`) | 82 | 0 | 82 | 0.0% |
| `M`-priority functional requirements (`FR-`) | 182 | 0 | 182 | 0.0% |
| Business acceptance criteria (`BAC-01` … `BAC-15`) | 15 | 0 | 15 | 0.0% |
| **PHASE 1 LAUNCH-BLOCKING TOTAL** | **286** | **0** | **286** | **0.0%** |

**Release gate.** Phase 1 does not launch while any of these 286 boxes is unticked. `BAC-14` restates
the same condition from the business side: *all M-priority functional requirements in Part B are
delivered, and no M-priority defect (Severity 1 or 2) is open.*

### 2.4 In scope but not launch-blocking

| Component | Count | Done | Note |
| :--- | ---: | ---: | :--- |
| `S`-priority items | 81 | 0 | Phase 1 if capacity allows; first candidates to move to Phase 2 |
| `C`-priority items | 14 | 0 | Phase 2. Present here so the architecture does not foreclose them |
| Items with no stated priority | 1,282 | 0 | Principles, KPIs, RACI rows, screens, screen states, endpoints, jobs, events, funnels, state machines, transitions, invariants, reason-code taxonomies, reason codes, tables, reference tables, indexes, partitions, risks, open questions, assumptions, constraints, dependencies, journeys and UAT scripts |

---

## 3. Guiding Product Principles — `PRIN-01` … `PRIN-07`

**Source:** §A3.4. These are not aspirations. Each is a testable constraint on the build, and each is
ticked only when a mechanism enforces it, a test proves the mechanism, and the mechanism is written
down. Identifiers `PRIN-01` … `PRIN-07` are assigned here in source order; the PRD numbers them 1–7
without a prefix.

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **PRIN-01** | **The gym's data belongs to the gym.** Export is a right, not a retention lever. A tenant can extract members, payments and attendance at any time in a machine-readable format. | — | `reporting/` · `admin/` · `dash` | A3.4 #1 | Integration + Contract; `BAC-12`; `UAT-01` | NOT STARTED |
| `[ ]` | **PRIN-02** | **Never show a price that cannot be bought.** Every price displayed on the marketplace is a price the platform will honour at checkout for that moment. Stale pricing is a defect, not a UX inconvenience. | — | `plans/` · `ordering/` · `discovery/` | A3.4 #2 | Unit + Integration + E2E; `E2E-02`, `E2E-06`; `BR-PLN-03` negative case | NOT STARTED |
| `[ ]` | **PRIN-03** | **Money is append-only.** Financial state is derived from an immutable ledger of events. Nothing that has affected a balance is ever edited or deleted; corrections are compensating entries. | — | `ledger/` · `settlements/` · `refunds/` | A3.4 #3 | Integration (no `UPDATE`/`DELETE` grant on `ledger_entries`); `E2E-12`; `BAC-07` | NOT STARTED |
| `[ ]` | **PRIN-04** | **Verification before visibility.** No gym appears in the marketplace before a human has approved it. Growth targets never justify relaxing this. | — | `onboarding/` · `discovery/` · `admin/` | A3.4 #4 | Integration + E2E; `E2E-01`; `BR-GYM-03` negative case; `BAC-02` | NOT STARTED |
| `[ ]` | **PRIN-05** | **Earned reviews only.** A review requires a verified check-in history against that gym. There is no path for an unverified account to influence a rating. | — | `reviews/` · `attendance/` | A3.4 #5 | Integration + Contract; `E2E-09`; `AC-REV-02.1`; `BAC-09` | NOT STARTED |
| `[ ]` | **PRIN-06** | **Degrade, do not fail.** If maps, search indexing or notifications are unavailable, check-in and payment continue to work. | — | `common/` · `attendance/` · `payments/` | A3.4 #6 | Integration (fault injection) + E2E; `NFR-AVL-03`, `NFR-AVL-07`; `AC-SRCH-02.3` | NOT STARTED |
| `[ ]` | **PRIN-07** | **Every state change is attributable.** Any record whose change could become a dispute carries who, when, from what, to what, and why. | — | `audit/` · `common/` | A3.4 #7 | Integration + E2E; `BAC-13`; `US-ADMN-02`; `BR-DAT-01` | NOT STARTED |

---

## 4. Business Objectives — `OBJ-01` … `OBJ-10`

**Source:** §A3.2. Each row carries the PRD's own rationale, because the rationale is what tells a
future reader whether a proposed change still serves the objective. An objective is ticked when the
modules named in §C13 Traceability Summary are complete and the verifying journeys pass.

| `[ ]` | ID | Requirement (objective · rationale) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **OBJ-01** | **Digitise the end-to-end operations of an independent gym** — members, plans, payments, attendance, staff and reporting — in one system. *Rationale: the wedge. Without operational value the gym has no reason to adopt, and without adoption there is no marketplace inventory.* | M | `catalog/` · `plans/` · `crm/` · `staff/` · `attendance/` · `reporting/` | A3.2 · C13 | `E2E-01`, `E2E-03`, `E2E-10`; `UAT-01`, `UAT-02` | NOT STARTED |
| `[ ]` | **OBJ-02** | **Enable a consumer to discover, compare and purchase a gym membership entirely online**, without a phone call or a visit. *Rationale: the consumer-side value proposition and the source of marketplace commission.* | M | `discovery/` · `ordering/` · `payments/` · `billing/` · `memberships/` | A3.2 · C13 | `E2E-02`, `E2E-06`; `UAT-03`; `BAC-03` | NOT STARTED |
| `[ ]` | **OBJ-03** | **Guarantee that every listed gym is a real, verified business, and every published review comes from a member who actually attended.** *Rationale: trust is the marketplace's only durable moat. It is cheap to lose and expensive to rebuild.* | M | `onboarding/` · `reviews/` · `admin/` | A3.2 · C13 | `E2E-01`, `E2E-09`; `UAT-04`; `BAC-02`, `BAC-09` | NOT STARTED |
| `[ ]` | **OBJ-04** | **Make membership revenue collection automatic, traceable and reconcilable** — every rupee/dollar attributable to a member, a plan, an invoice and a settlement. *Rationale: removes the largest source of gym-owner pain and platform dispute load simultaneously.* | M | `payments/` · `billing/` · `settlements/` · `ledger/` | A3.2 · C13 | `E2E-06`, `E2E-12`; `UAT-05`; `BAC-07` | NOT STARTED |
| `[ ]` | **OBJ-05** | **Reduce member churn by making expiry visible and renewal frictionless** for both the gym and the member. *Rationale: retention economics dominate acquisition economics in fitness.* | M | `memberships/` · `notifications/` · `crm/` | A3.2 · C13 | `E2E-05`; `US-MEMB-02`; `KPI-12` instrumentation | NOT STARTED |
| `[ ]` | **OBJ-06** | **Give the gym owner decision-grade analytics:** revenue by plan, attendance by hour, churn cohort, staff activity. *Rationale: converts the product from a record-keeper into a management tool, which is what justifies subscription price.* | S | `reporting/` | A3.2 · C13 | Report catalogue acceptance (§B5.20); `US-RPT-01`; `US-CHK-02` | NOT STARTED |
| `[ ]` | **OBJ-07** | **Operate a defensible multi-tenant architecture in which no tenant can ever read or write another tenant's data.** *Rationale: legal and reputational necessity; also a sales objection to pre-empt.* | M | `tenancy/` | A3.2 · C13 | Isolation suite (§C8.1); `E2E-11`; `BAC-10`; `NFR-SEC-09` | NOT STARTED |
| `[ ]` | **OBJ-08** | **Establish two independent revenue streams — SaaS subscription and marketplace commission — each independently tunable per tenant.** *Rationale: commercial flexibility during land-grab; allows commission-free or subscription-free promotional cohorts.* | M | `settlements/` · `admin/` · `billing/` | A3.2 · C13 | `E2E-12`; `US-ADMN-01`; `A6.3` computation unit tests | NOT STARTED |
| `[ ]` | **OBJ-09** | **Build the platform country-agnostic from day one:** currency, tax and KYC as configuration rather than code. *Rationale: avoids a rewrite at first international expansion.* | S | `billing/` · `admin/` | A3.2 · C13 | Tax profile unit tests; `BR-PAY-01`, `BR-PAY-11`; `FR-ADMN-05`, `FR-ADMN-06` | NOT STARTED |
| `[ ]` | **OBJ-10** | **Achieve an operations model where a support agent can resolve the ten most common member and gym issues without engineering involvement.** *Rationale: support cost per tenant determines whether the unit economics work at scale.* | S | `support/` · `admin/` | A3.2 · C13 | `UAT-06`; `FR-SUP-06`; `BR-DAT-02` | NOT STARTED |

---

## 5. Success Metrics — `KPI-01` … `KPI-26`

**Source:** §A3.3. Baselines are established in the first 30 days after launch; the targets below are
the 12-month post-launch commitments used for release planning. A KPI row is ticked when the metric
is **instrumented, computed, displayed and reconcilable** — not when the target is met. Meeting the
target is a commercial outcome; instrumenting it is the engineering deliverable.

### 5.1 Supply side (gyms)

| `[ ]` | ID | Requirement (metric · definition · Year-1 target) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **KPI-01** | **Verified active gyms** — gyms with approved KYC, ≥1 published plan and ≥1 check-in in trailing 30 days. **Target: 500.** | — | `reporting/` · `admin` | A3.3 | Integration; platform report *Tenant funnel*; `EVT-` tenant-lifecycle events | NOT STARTED |
| `[ ]` | **KPI-02** | **Gym activation rate** — % of gyms that reach first published plan within 7 days of signup. **Target: ≥ 70%.** | — | `reporting/` · `admin` | A3.3 | Integration; `EVT-first_plan_published` vs `EVT-owner_signup_started` | NOT STARTED |
| `[ ]` | **KPI-03** | **Time to first listing** — median hours from signup to marketplace-visible listing. **Target: ≤ 48 h.** | — | `reporting/` · `admin` | A3.3 | Integration; `EVT-application_approved` elapsed-since-signup | NOT STARTED |
| `[ ]` | **KPI-04** | **Gym monthly retention** — % of paying tenants retained month over month. **Target: ≥ 95%.** | — | `reporting/` · `billing/` | A3.3 | Integration; platform report *Tenant cohort retention* | NOT STARTED |
| `[ ]` | **KPI-05** | **Weekly active gym dashboard usage** — % of active tenants with ≥3 dashboard sessions per week. **Target: ≥ 60%.** | — | `reporting/` · `dash` | A3.3 | Integration; `EVT-dashboard_screen_viewed` | NOT STARTED |
| `[ ]` | **KPI-06** | **Digital check-in adoption** — % of member visits recorded through the platform rather than manually. **Target: ≥ 80%.** | — | `attendance/` · `reporting/` | A3.3 | Integration; `attendance.method` split `SCAN` vs `MANUAL`; `FR-CHK-10` | NOT STARTED |

### 5.2 Demand side (consumers)

| `[ ]` | ID | Requirement (metric · definition · Year-1 target) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **KPI-07** | **Registered users** — accounts created. **Target: 100,000.** | — | `iam/` · `reporting/` | A3.3 | Integration; registration counter | NOT STARTED |
| `[ ]` | **KPI-08** | **Active memberships** — memberships in `ACTIVE` state at period end. **Target: 25,000.** | — | `memberships/` · `reporting/` | A3.3 | Integration; `memberships (tenant_id, status, end_date)` index query | NOT STARTED |
| `[ ]` | **KPI-09** | **Search-to-detail rate** — % of searches producing ≥1 gym detail page view. **Target: ≥ 45%.** | — | `discovery/` · `reporting/` | A3.3 | Integration; `EVT-search_performed` → `EVT-gym_detail_viewed` funnel | NOT STARTED |
| `[ ]` | **KPI-10** | **Detail-to-checkout rate** — % of gym detail views starting checkout. **Target: ≥ 8%.** | — | `discovery/` · `ordering/` · `reporting/` | A3.3 | Integration; `EVT-gym_detail_viewed` → `EVT-checkout_started` funnel | NOT STARTED |
| `[ ]` | **KPI-11** | **Checkout completion rate** — % of started checkouts reaching successful payment. **Target: ≥ 65%.** | — | `ordering/` · `payments/` · `reporting/` | A3.3 | Integration; `EVT-checkout_started` → `EVT-payment_succeeded` funnel | NOT STARTED |
| `[ ]` | **KPI-12** | **Renewal rate** — % of memberships renewed within 15 days of expiry. **Target: ≥ 55%.** | — | `memberships/` · `reporting/` | A3.3 | Integration; tenant report *Renewals*; `EVT-renewal_completed` | NOT STARTED |
| `[ ]` | **KPI-13** | **Review submission rate** — % of members leaving a review within 45 days of joining. **Target: ≥ 20%.** | — | `reviews/` · `reporting/` | A3.3 | Integration; `EVT-review_submitted`; `FR-REV-10` prompt schedule | NOT STARTED |

### 5.3 Commercial

| `[ ]` | ID | Requirement (metric · definition · Year-1 target) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **KPI-14** | **GMV** — gross value of memberships transacted through the platform. **Target: — (tracked).** | — | `ledger/` · `reporting/` | A3.3 | Integration; platform report *GMV and take rate*; `E2E-12` | NOT STARTED |
| `[ ]` | **KPI-15** | **Net platform revenue** — subscription + commission + listing fees. **Target: — (tracked).** | — | `ledger/` · `billing/` · `reporting/` | A3.3 | Integration; ledger aggregation across `COMMISSION` entries + subscription charges | NOT STARTED |
| `[ ]` | **KPI-16** | **Take rate** — platform revenue ÷ GMV. **Target: 8–12%.** | — | `reporting/` | A3.3 | Unit (ratio) + Integration; platform report *GMV and take rate* | NOT STARTED |
| `[ ]` | **KPI-17** | **Marketplace-originated share** — % of gym GMV originating from marketplace discovery rather than gym-entered sales. **Target: ≥ 30%.** | — | `ordering/` · `reporting/` | A3.3 | Integration; `orders.origin` = `MARKETPLACE` vs `DIRECT`; A6.3 attribution window | NOT STARTED |
| `[ ]` | **KPI-18** | **ARPT** — average revenue per tenant per month. **Target: — (tracked).** | — | `reporting/` | A3.3 | Integration; platform analytics | NOT STARTED |
| `[ ]` | **KPI-19** | **Payment success rate** — successful ÷ attempted payments. **Target: ≥ 92%.** | — | `payments/` · `reporting/` | A3.3 | Integration; platform report *Payment health*; `EVT-payment_succeeded`/`payment_failed` | NOT STARTED |
| `[ ]` | **KPI-20** | **Refund rate** — refunded value ÷ GMV. **Target: ≤ 3%.** | — | `refunds/` · `reporting/` | A3.3 | Integration; platform report *Refunds and disputes* | NOT STARTED |
| `[ ]` | **KPI-21** | **Dispute/chargeback rate** — disputed transactions ÷ total transactions. **Target: ≤ 0.5%.** | — | `refunds/` · `reporting/` | A3.3 | Integration; `disputes` aggregation; `FR-RFND-08` | NOT STARTED |

### 5.4 Platform health

| `[ ]` | ID | Requirement (metric · definition · Year-1 target) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **KPI-22** | **API availability** — monthly uptime of core API. **Target: ≥ 99.9%.** | — | `common/` · platform ops | A3.3 | Synthetic monitoring; `NFR-AVL-01` | NOT STARTED |
| `[ ]` | **KPI-23** | **Search latency** — p95 marketplace search response. **Target: ≤ 500 ms.** | — | `discovery/` | A3.3 | Performance (§C8.1); `NFR-PERF-01`; `BAC-11` | NOT STARTED |
| `[ ]` | **KPI-24** | **Check-in latency** — p95 QR scan to confirmation. **Target: ≤ 2 s.** | — | `attendance/` | A3.3 | Performance (§C8.1); `NFR-PERF-03`; `AC-CHK-01.1` | NOT STARTED |
| `[ ]` | **KPI-25** | **Support first response** — median time to first human response. **Target: ≤ 4 h.** | — | `support/` | A3.3 | Integration; `FR-SUP-05` SLA timers; platform report *Support load* | NOT STARTED |
| `[ ]` | **KPI-26** | **Settlement accuracy** — settlements matching computed ledger without manual adjustment. **Target: 100%.** | — | `settlements/` · `ledger/` | A3.3 · A6.4 | `E2E-12`; `FR-SETL-09`; `BAC-07`; daily reconciliation job `JOB-10` | NOT STARTED |

---

## 6. RACI for Key Processes — `RACI-01` … `RACI-16`

**Source:** §A5.3. **R** Responsible · **A** Accountable · **C** Consulted · **I** Informed.
Each row is ticked when the permission matrix (§B3.2), the notification catalogue (§B5.19) and the
audit trail (§B5.24) together make the stated accountability real in the product — i.e. the `R` can
act, the `A` can approve or veto, the `C` is asked, and the `I` is told. Identifiers `RACI-01` …
`RACI-16` are assigned here in source-table order.

| `[ ]` | ID | Requirement (process · Gym Owner / Verification Officer / Super Admin / Finance / Support / Member) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **RACI-01** | **Gym registration submission** — Owner **R/A**; Verification Officer **I**; Super Admin **I**; Finance —; Support —; Member —. | — | `onboarding/` | A5.3 | Integration + RBAC; `E2E-01`; `FR-ONB-07` | NOT STARTED |
| `[ ]` | **RACI-02** | **KYC document review** — Owner **C**; Verification Officer **R**; Super Admin **A**; Finance **I**; Support —; Member —. | — | `onboarding/` · `admin/` | A5.3 | Integration + RBAC; `UAT-04`; `BR-DAT-07` | NOT STARTED |
| `[ ]` | **RACI-03** | **Marketplace listing approval** — Owner **I**; Verification Officer **R**; Super Admin **A**; Finance —; Support —; Member —. | — | `onboarding/` · `admin/` · `discovery/` | A5.3 | `E2E-01`; `BAC-02`; `BR-GYM-03` | NOT STARTED |
| `[ ]` | **RACI-04** | **Plan creation and pricing** — Owner **R/A**; Verification Officer —; Super Admin **I**; Finance **I**; Support —; Member —. | — | `plans/` | A5.3 | Integration + RBAC; `FR-PLAN-01`; `AC-STAF-01.2` negative case | NOT STARTED |
| `[ ]` | **RACI-05** | **Online membership sale** — Owner **I**; Verification Officer —; Super Admin —; Finance **I**; Support —; Member **R/A**. | — | `ordering/` · `payments/` | A5.3 | `E2E-02`; `BAC-03` | NOT STARTED |
| `[ ]` | **RACI-06** | **Offline / walk-in sale** — Owner **R/A**; Verification Officer —; Super Admin —; Finance **I**; Support —; Member **C**. | — | `ordering/` · `staff/` | A5.3 | `E2E-10`; `UAT-02`; `FR-CART-09` | NOT STARTED |
| `[ ]` | **RACI-07** | **Payment capture** — Owner **I**; Verification Officer —; Super Admin —; Finance **A**; Support —; Member **R**. | — | `payments/` | A5.3 | `E2E-02`; `BR-PAY-02` | NOT STARTED |
| `[ ]` | **RACI-08** | **Invoice issuance** — Owner **I**; Verification Officer —; Super Admin —; Finance **R/A**; Support —; Member **I**. | — | `billing/` | A5.3 | `E2E-02`, `E2E-10`; `US-INV-01`; `BR-PAY-10` | NOT STARTED |
| `[ ]` | **RACI-09** | **Refund request** — Owner **C**; Verification Officer —; Super Admin **A**; Finance **R**; Support **R**; Member **R**. | — | `refunds/` · `support/` | A5.3 | `E2E-07`; `UAT-05`; `FR-RFND-01` | NOT STARTED |
| `[ ]` | **RACI-10** | **Chargeback response** — Owner **C**; Verification Officer —; Super Admin **A**; Finance **R**; Support **C**; Member **I**. | — | `refunds/` | A5.3 | `US-RFND-02`; `UAT-05`; `FR-RFND-08`, `FR-RFND-09` | NOT STARTED |
| `[ ]` | **RACI-11** | **Settlement / payout run** — Owner **I**; Verification Officer —; Super Admin **A**; Finance **R**; Support —; Member —. | — | `settlements/` | A5.3 | `E2E-12`; `UAT-05`; `FR-SETL-06`; `BR-FIN-08` | NOT STARTED |
| `[ ]` | **RACI-12** | **Review publication** — Owner **I**; Verification Officer —; Super Admin **A**; Finance —; Support **C**; Member **R**. | — | `reviews/` | A5.3 | `E2E-09`; `BAC-09`; `BR-REV-01` | NOT STARTED |
| `[ ]` | **RACI-13** | **Review moderation / takedown** — Owner **C**; Verification Officer —; Super Admin **A**; Finance —; Support **R**; Member **I**. | — | `reviews/` · `admin/` | A5.3 | `E2E-09`; `FR-REV-07`; `BR-REV-06` | NOT STARTED |
| `[ ]` | **RACI-14** | **Member check-in** — Owner **I**; Verification Officer —; Super Admin —; Finance —; Support —; Member **R**. | — | `attendance/` | A5.3 | `E2E-03`; `UAT-02`; `BAC-05` | NOT STARTED |
| `[ ]` | **RACI-15** | **Tenant suspension** — Owner **I**; Verification Officer **C**; Super Admin **R/A**; Finance **C**; Support **I**; Member **I**. | — | `admin/` · `tenancy/` | A5.3 | `UAT-06`; `FR-ADMN-01`; `BR-TEN-05` | NOT STARTED |
| `[ ]` | **RACI-16** | **Data export request** — Owner **R**; Verification Officer —; Super Admin **A**; Finance —; Support **C**; Member **R**. | — | `reporting/` · `iam/` | A5.3 | `BAC-12`; `FR-USER-06`; `BR-DAT-03`, `BR-DAT-05` | NOT STARTED |

---

## 7. Business Rules — 95 identifiers across 13 families

**Source:** §A8. The PRD states these are **contractual**: each is testable, and each maps to
functional requirements in Part B and test cases in §C8. `BAC-06` raises the bar further — *every rule
in A8 has at least one passing automated test, and every M-priority rule has a test that also proves
the negative case.* A `BR-` row is therefore ticked only when both the positive and, for `M` rules,
the negative test exist and pass.

**Family counts (all enumerated individually below):** `BR-TEN` ×6 · `BR-GYM` ×9 · `BR-PLN` ×7 ·
`BR-MEM` ×14 · `BR-PAY` ×11 · `BR-REF` ×9 · `BR-CHK` ×10 · `BR-REV` ×7 · `BR-CPN` ×5 · `BR-RFL` ×1 ·
`BR-WAL` ×1 · `BR-FIN` ×8 · `BR-DAT` ×7 = **95**.

### 7.1 Tenancy — `BR-TEN-01` … `BR-TEN-06` (§A8.1)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **BR-TEN-01** | Every data record other than platform-global reference data belongs to exactly one tenant and is inaccessible to any other tenant by any code path, including reporting and support tooling. | M | `tenancy/` | A8.1 | Isolation suite (100% of tenant-scoped endpoints); `E2E-11`; `BAC-10`; `NFR-SEC-09` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-TEN-02** | One owner account may own multiple tenants. Tenant switching is explicit and audited; no cross-tenant action occurs in a single request. | M | `tenancy/` · `iam/` | A8.1 | Integration + Isolation; `AC-AUTH-02.1`, `AC-AUTH-02.2`, `AC-AUTH-02.3` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-TEN-03** | One tenant may operate multiple branches. Branches share the plan catalogue by default; a plan may be restricted to named branches. | M | `catalog/` · `plans/` | A8.1 | Integration; `US-GYM-01`; `FR-GYM-08`; `plan_branches` absence-means-all semantics — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-TEN-04** | Deleting a tenant is a soft delete. Financial, invoice and audit records are retained for the statutory retention period regardless of deletion. | M | `tenancy/` · `billing/` · `audit/` | A8.1 | Integration; `NFR-DQ-04`, `NFR-PRV-04`, `CON-04` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-TEN-05** | A suspended tenant is removed from marketplace search immediately; existing active memberships continue to permit check-in until their natural expiry. | M | `tenancy/` · `discovery/` · `attendance/` | A8.1 | Integration + E2E; `FR-SRCH-09`; `AC-FAV-01.3`; `UAT-06` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-TEN-06** | A tenant whose subscription payment fails enters `PAST_DUE` after the first failure, loses marketplace visibility after 7 days, and loses dashboard write access after 14 days. Check-in for existing members is never blocked by subscription arrears. | M | `billing/` · `tenancy/` · `attendance/` | A8.1 · A6.2 | Integration; `JOB-22 subscription.charge`; `FR-ADMN-04` — negative case mandatory (check-in must still succeed) | NOT STARTED |

### 7.2 Gyms — `BR-GYM-01` … `BR-GYM-09` (§A8.1)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **BR-GYM-01** | A gym must not be visible in marketplace search until it has status `APPROVED`. | M | `onboarding/` · `discovery/` | A8.1 | Integration + E2E; `E2E-01`; `FR-SRCH-09`; `PRIN-04` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-GYM-02** | Approval requires: verified owner email and phone, complete KYC document set for the tenant's country profile, at least one published plan, at least three photographs, a resolvable geo-location, and stated operating hours. | M | `onboarding/` | A8.1 | Integration; `FR-ONB-02` … `FR-ONB-07`; `UAT-04` — negative case mandatory for each missing precondition | NOT STARTED |
| `[ ]` | **BR-GYM-03** | Approval is a human decision. No automated path may set `APPROVED`. | M | `onboarding/` · `admin/` | A8.1 | Integration + Contract; `AC-ONB-02.5`; `PRIN-04` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-GYM-04** | Rejection must cite at least one structured reason code and may include free text. The owner sees both. | M | `onboarding/` · `admin/` | A8.1 | Integration; `FR-ONB-11`; `RCT-02` application-rejection taxonomy; `AC-ONB-01.2` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-GYM-05** | A gym may be re-submitted after rejection an unlimited number of times; each submission is a new reviewable version with the prior version retained. | M | `onboarding/` | A8.1 | Integration; `AC-ONB-01.3`; `applications.version`; `SCR-ADM-003` history diff — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-GYM-06** | Material changes to an approved gym — legal name, address, geo-location, ownership, bank account — return the gym to `PENDING_REVIEW` for those fields while the listing stays live, unless the change is to the bank account, which suspends payouts until re-verified. | M | `catalog/` · `onboarding/` · `settlements/` | A8.1 | Integration; `FR-GYM-11`; §B5.3 edge case *bank account changes* — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-GYM-07** | Non-material changes (photos, description, amenities, timings, plan pricing) publish immediately without review, subject to automated content screening. | M | `catalog/` | A8.1 | Integration; `FR-GYM-11`; `FR-ADMN-12` content moderation — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-GYM-08** | Geo-location must be within a configurable tolerance of the geocoded postal address; a mismatch beyond tolerance blocks approval and is flagged to the reviewer. | M | `onboarding/` · `catalog/` | A8.1 | Integration; `FR-ONB-12`; `AC-ONB-02.3`; `RSK-01` mitigation — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-GYM-09** | A single physical address may host only one `APPROVED` gym at a time. Collisions are surfaced to the reviewer as a possible duplicate. | S | `onboarding/` | A8.1 | Integration; `AC-ONB-02.4`; `FR-ONB-12` duplicate-address pre-check | NOT STARTED |

### 7.3 Plans and pricing — `BR-PLN-01` … `BR-PLN-07` (§A8.2)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **BR-PLN-01** | A plan defines: name, description, duration (or session count), price, currency, applicable branches, joining fee, minimum age, gender eligibility, access windows, and whether it is publicly sellable or staff-only. | M | `plans/` | A8.2 | Unit + Integration; `FR-PLAN-01`; `SCR-DASH-006` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-PLN-02** | A published plan's price change never affects an already-purchased membership. Existing memberships retain their purchased terms until expiry. | M | `plans/` · `memberships/` | A8.2 | Unit + Integration; `FR-PLAN-08`; `memberships.purchased_price_minor` / `purchased_terms`; `AC-PLAN-01.3` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-PLN-03** | The price displayed on the marketplace must equal the price charged at checkout for the same plan at the same moment. Server-side re-validation at checkout is mandatory; a mismatch aborts checkout with an explicit message rather than silently charging either figure. | M | `plans/` · `ordering/` | A8.2 | Unit + Integration + E2E; `AC-PLAN-02.1`, `AC-PLAN-02.2`; `E2E-02`, `E2E-06`; `PRIN-02` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-PLN-04** | A plan may be archived but never hard-deleted while any membership references it. | M | `plans/` | A8.2 | Integration (FK + soft delete); `FR-PLAN-05`; `NFR-DQ-01`, `NFR-DQ-04` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-PLN-05** | A staff-only plan is never returned by any public API or rendered on any public surface. | M | `plans/` · `discovery/` | A8.2 | Contract + Integration; `FR-SRCH-09`; `plans (gym_id, status, visibility)` index — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-PLN-06** | Session-based plans carry an entitlement count decremented per check-in; the membership expires on the earlier of entitlement exhaustion or validity end date. | M | `plans/` · `memberships/` · `attendance/` | A8.2 | Unit + Integration; `FR-CHK-04`; `SMT-07`; §B5.13 edge case *zero entitlement mid-visit* — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-PLN-07** | A gym may run at most one active promotional price per plan at a time; overlapping promotions are rejected at creation. | S | `plans/` | A8.2 | Unit + Integration; `FR-PLAN-03`; `US-PLAN-01` | NOT STARTED |

### 7.4 Membership lifecycle — `BR-MEM-01` … `BR-MEM-14` (§A8.3)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **BR-MEM-01** | A membership exists in exactly one state: `PENDING`, `ACTIVE`, `FROZEN`, `EXPIRED`, `CANCELLED`, or `REFUNDED`. Permitted transitions are defined in Part C §C4.1. | M | `memberships/` | A8.3 · C4.1 | Unit (state machine) + Integration; `SM-01`, `SMT-01` … `SMT-11` — negative case mandatory (illegal transitions refused) | NOT STARTED |
| `[ ]` | **BR-MEM-02** | A membership becomes `ACTIVE` only on confirmed payment capture (`BR-PAY-02`) or on an explicit staff-recorded offline payment. | M | `memberships/` · `payments/` | A8.3 | Integration + E2E; `E2E-02`, `E2E-10`; `AC-PAY-02.1` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-MEM-03** | A membership's validity is `[start_date, end_date]` inclusive, computed in the **gym's** timezone, not the member's. | M | `memberships/` | A8.3 | Unit (timezone matrix) + Integration; §C1.5 *Time*; §B5.12 edge case *timezone differs* — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-MEM-04** | A member may hold multiple concurrent memberships at different gyms. Concurrent memberships at the *same* gym are rejected unless the plans are explicitly marked stackable. | M | `memberships/` · `ordering/` | A8.3 | Integration; `FR-CART-07`; §B5.9 edge case *non-stackable conflict* — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-MEM-05** | Freeze is permitted only if the plan allows it. Freeze extends `end_date` by exactly the frozen duration. Total freeze days per membership term are capped by plan configuration. | S | `memberships/` | A8.3 | Unit + Integration; `AC-MEMB-01.1`, `AC-MEMB-01.4`, `AC-MEMB-01.5`; `E2E-05` | NOT STARTED |
| `[ ]` | **BR-MEM-06** | A `FROZEN` membership denies check-in. | M | `memberships/` · `attendance/` | A8.3 | Integration + E2E; `AC-MEMB-01.2`; `E2E-05`; `RC-02 MEMBERSHIP_FROZEN` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-MEM-07** | Freeze may not be applied retroactively to a past date, and may not begin more than 30 days in the future. | S | `memberships/` | A8.3 | Unit (boundary) + Integration; `FR-MEMB-04` | NOT STARTED |
| `[ ]` | **BR-MEM-08** | Transfer of a membership to another person requires gym approval and is permitted only if the plan allows it; the transfer is recorded with both parties' identities. | C | `memberships/` | A8.3 | Integration; `FR-MEMB-11`; `API-MEMB POST /tenant/memberships/:id/transfer` | NOT STARTED |
| `[ ]` | **BR-MEM-09** | Upgrade to a higher plan is charged pro rata on the unused remainder of the current plan; downgrade takes effect at the next renewal and never generates a cash refund. | S | `memberships/` · `ordering/` | A8.3 | Unit (proration) + Integration; `FR-MEMB-07` | NOT STARTED |
| `[ ]` | **BR-MEM-10** | Auto-renewal is opt-in, disclosed at purchase, and cancellable at any time before the renewal charge without penalty. | S | `memberships/` · `payments/` | A8.3 | Integration; `FR-MEMB-08`; `FR-PAY-11`; `JOB-05 membership.auto-renew` | NOT STARTED |
| `[ ]` | **BR-MEM-11** | Renewal reminders are sent at T−15, T−7, T−3 and T−1 days and on expiry, subject to the member's notification preferences. | M | `memberships/` · `notifications/` | A8.3 | Integration; `FR-MEMB-10`; `JOB-04 membership.renewal-reminders`; `AC-USER-01.2` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-MEM-12** | An `EXPIRED` membership retains full historical visibility to both member and gym indefinitely. | M | `memberships/` | A8.3 | Integration; `FR-MEMB-12`; `SCR-WEB-009` `EXPIRED` state — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-MEM-13** | Membership credentials are personal. Detected sharing (`BR-CHK-07`) suspends the membership pending review rather than cancelling it. | M | `memberships/` · `attendance/` | A8.3 | Integration; `FR-CHK-12`; `RC-14 MEMBERSHIP_UNDER_REVIEW`; `JOB-17 attendance.sharing-scan` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-MEM-14** | If a gym is suspended or closes, affected members are notified within 24 hours and any unconsumed prepaid value becomes eligible for refund under `BR-REF-07`. | M | `memberships/` · `notifications/` · `refunds/` | A8.3 | Integration; `FR-GYM-10`; notification catalogue *Gym closure notice*; `RSK-06` — negative case mandatory | NOT STARTED |

### 7.5 Payments — `BR-PAY-01` … `BR-PAY-11` (§A8.4)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **BR-PAY-01** | All monetary amounts are stored as integers in the currency's minor unit with an explicit ISO-4217 code. Floating-point representation of money is prohibited anywhere in the system. | M | `common/` (Money type) · all financial modules | A8.4 | Unit (Money type) + architecture fitness test + Integration; `NFR-DQ-02`; §C1.5 *Money* — negative case mandatory (lint forbids `number` for amount fields) | NOT STARTED |
| `[ ]` | **BR-PAY-02** | Membership activation is driven by the gateway webhook, not by the client's redirect. A client-side success signal never activates a membership. | M | `payments/` · `memberships/` | A8.4 | Integration + E2E; `FR-PAY-03`; `AC-PAY-02.1`; `E2E-02` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-PAY-03** | All payment-affecting operations are idempotent on a client-supplied idempotency key; a repeated request returns the original result without side effects. | M | `common/` · `payments/` · `ordering/` | A8.4 | Integration + Contract; `orders` unique `(idempotency_key)`; §C1.5 *Idempotency*; `E2E-08` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-PAY-04** | Order amounts are computed server-side from server-held plan, coupon and tax data. Client-submitted amounts are ignored. | M | `ordering/` | A8.4 | Contract + Integration; `FR-CART-04`; `SCR-WEB-005` notes — negative case mandatory (client-supplied price rejected) | NOT STARTED |
| `[ ]` | **BR-PAY-05** | Every webhook is signature-verified and replay-protected; unverified webhooks are logged and discarded. | M | `payments/` | A8.4 | Integration + Security; `FR-PAY-04`; `payment_events` unique `(provider_event_id)` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-PAY-06** | A payment in an indeterminate state after the gateway's settlement window is reconciled automatically; if still indeterminate, it is escalated to Finance and never auto-activates a membership. | M | `payments/` | A8.4 | Integration; `FR-PAY-05`; `JOB-07 payment.reconcile`; `SM-03` reconciliation rule — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-PAY-07** | Duplicate payment for the same order is detected and automatically refunded within one business day, with notification to the payer. | M | `payments/` · `refunds/` | A8.4 | Integration + E2E; `FR-PAY-08`; `JOB-08 payment.duplicate-detect`; `E2E-08`; `AC-PAY-01.2` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-PAY-08** | Card and bank credentials are never stored, logged, or transmitted through platform infrastructure. Only gateway tokens are retained. | M | `payments/` | A8.4 | Security (SAST + log inspection) + Integration; `FR-PAY-09`; `NFR-SEC-03` (SAQ-A scope) — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-PAY-09** | Partial payment is permitted only for staff-recorded offline sales, which may hold a `BALANCE_DUE`; online marketplace purchases must be paid in full. | S | `ordering/` · `payments/` | A8.4 | Integration + E2E; `FR-CART-09`; `AC-CART-02.4`; `E2E-10` | NOT STARTED |
| `[ ]` | **BR-PAY-10** | An invoice is generated for every successful payment, carries a gapless sequential number per tenant per financial year, and is immutable once issued. Corrections are issued as credit notes. | M | `billing/` | A8.4 | Integration (concurrency) + E2E; `FR-INV-01`, `FR-INV-02`, `FR-INV-03`; `AC-INV-01.1`, `AC-INV-01.2` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-PAY-11** | Tax treatment is determined by the tenant's tax profile at the moment of sale and stored on the invoice; a later change to the profile never alters an issued invoice. | M | `billing/` | A8.4 | Unit + Integration; `FR-INV-06`; `orders.tax_snapshot`; `AC-INV-01.3` — negative case mandatory | NOT STARTED |

### 7.6 Refunds and disputes — `BR-REF-01` … `BR-REF-09` (§A8.5)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **BR-REF-01** | Each tenant publishes a refund policy — window, proration method, cancellation fee — which is shown to the customer before payment and stored with the order. | M | `refunds/` · `ordering/` | A8.5 | Integration + E2E; `FR-CART-02`; `SCR-WEB-005` region 5; `orders.refund_policy_snapshot` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-REF-02** | The refund policy applicable to a membership is the one stored on its order, not the tenant's current policy. | M | `refunds/` | A8.5 | Unit + Integration; `FR-RFND-02`; `E2E-07` — negative case mandatory (policy changed after purchase) | NOT STARTED |
| `[ ]` | **BR-REF-03** | Refunds within the tenant's stated no-questions window and below a configurable value threshold auto-approve; all others require Super Admin approval. | M | `refunds/` | A8.5 | Unit (thresholds) + Integration; `FR-RFND-03`; `AC-RFND-01.1`; `SM-05` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-REF-04** | A refund is never issued to any instrument other than the original payment instrument. | M | `refunds/` · `payments/` | A8.5 | Integration + Contract; `FR-RFND-05` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-REF-05** | Platform commission is reversed proportionally on refund. Gateway fees are reversed only to the extent the gateway reverses them; any non-reversed fee is borne per the tenant agreement and shown explicitly on the statement. | M | `refunds/` · `ledger/` · `settlements/` | A8.5 | Unit (proportional reversal) + `E2E-07`, `E2E-12`; `FR-RFND-07`; ledger `COMMISSION_REVERSAL` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-REF-06** | Refunding a membership with recorded check-ins requires a stated reason and, above a configurable usage threshold, Super Admin approval. | M | `refunds/` · `attendance/` | A8.5 | Integration; `AC-RFND-01.2`; `RCT-03` refund reason taxonomy — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-REF-07** | If a gym closes, is suspended for cause, or materially fails to provide access, affected members are refunded the unconsumed pro-rata value; the amount is recovered from the tenant's balance and reserve. | M | `refunds/` · `settlements/` | A8.5 | Unit (proration) + Integration; `BR-MEM-14`; `RSK-06` mitigation — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-REF-08** | A chargeback immediately places the disputed amount in hold against the tenant's balance and opens a dispute case with an evidence deadline. | M | `refunds/` · `ledger/` | A8.5 | Integration; `FR-RFND-08`, `FR-RFND-10`; `AC-RFND-02.1`; ledger `CHARGEBACK` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-REF-09** | Refunds are never processed on a membership already refunded; the operation is idempotent on the order. | M | `refunds/` | A8.5 | Integration + Contract; `E2E-07` replay; §C1.5 *Idempotency* — negative case mandatory | NOT STARTED |

### 7.7 Check-in and attendance — `BR-CHK-01` … `BR-CHK-10` (§A8.6)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **BR-CHK-01** | Only an `ACTIVE` membership permits check-in. | M | `attendance/` | A8.6 | Integration + E2E; `FR-CHK-04` step 4; `E2E-04`; `RC-01`, `RC-02`, `RC-03`, `RC-04`, `RC-05` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-CHK-02** | A check-in QR token is signed, single-purpose, and expires within 60 seconds of generation. Screenshots are therefore of no lasting value. | M | `attendance/` | A8.6 | Unit (token TTL + signature) + E2E; `FR-CHK-01`, `FR-CHK-02`; `AC-CHK-01.3`; token signing algorithm pending `A-11` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-CHK-03** | A token is valid only at the gym and branch that the membership grants access to. | M | `attendance/` · `catalog/` | A8.6 | Integration; `FR-CHK-04` steps 5–6; `AC-GYM-01.3`; `RC-06 WRONG_BRANCH` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-CHK-04** | A repeat check-in within a configurable cooldown (default 60 minutes) at the same branch is recorded as a duplicate and does not decrement entitlement. | M | `attendance/` | A8.6 | Unit + Integration; `OQ-08` default 60 min; `RC-11 DUPLICATE_WITHIN_COOLDOWN` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-CHK-05** | Check-in outside the gym's operating hours is denied unless the plan grants 24-hour access. | M | `attendance/` · `catalog/` | A8.6 | Integration; `FR-CHK-04` step 7; `RC-07 OUTSIDE_OPERATING_HOURS`; `branch_hours` + `branch_hour_exceptions` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-CHK-06** | Check-in is idempotent on the token; a token replayed within its TTL yields the original attendance record, not a second one. | M | `attendance/` | A8.6 | Integration + Contract; `attendance.token_nonce`; `AC-CHK-01.4`, `AC-CHK-01.5` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-CHK-07** | Concurrent check-ins for the same membership at two branches within a physically implausible interval flag the membership for sharing review. | S | `attendance/` | A8.6 | Integration; `FR-CHK-12`; `JOB-17 attendance.sharing-scan`; `RSK-03` mitigation | NOT STARTED |
| `[ ]` | **BR-CHK-08** | Staff may manually check in a member; the record is marked `MANUAL` with the staff identity and a reason, and is reportable separately from scanned check-ins. | M | `attendance/` · `staff/` | A8.6 | Integration; `FR-CHK-07`, `FR-CHK-10`; `KPI-06` split — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-CHK-09** | Attendance records are immutable once written. Corrections are separate reversal records. | M | `attendance/` | A8.6 | Integration (no `UPDATE` path); `NFR-DQ-04`; `PRIN-07` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-CHK-10** | A denied check-in is recorded with its denial reason, so that disputes and access problems are analysable. | M | `attendance/` | A8.6 | Integration; `FR-CHK-06`; `attendance.result = DENIED` + `denial_reason`; `RCT-01` — negative case mandatory | NOT STARTED |

### 7.8 Reviews and ratings — `BR-REV-01` … `BR-REV-07` (§A8.7)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **BR-REV-01** | Only a user with at least one recorded check-in at the gym may review it. | M | `reviews/` · `attendance/` | A8.7 | Integration + Contract; `AC-REV-02.1` (403 on direct API call); `BAC-09`; `E2E-09` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-REV-02** | One review per member per gym per membership term. Editing is permitted for 7 days; the edit history is retained. | M | `reviews/` | A8.7 | Integration; `FR-REV-04`; `reviews.edit_history`; `SCR-WEB-013` states — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-REV-03** | Every published review carries a "Verified member" marker; there is no unverified review type. | M | `reviews/` · `web` | A8.7 | Integration + E2E; `AC-DETL-02.2`; `FR-DETL-05` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-REV-04** | Reviews pass automated screening for abuse, contact details and spam before publication; flagged reviews queue for human moderation. | M | `reviews/` | A8.7 | Unit + Integration; `FR-REV-03`; `SM-06`; `RCT-04` moderation taxonomy — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-REV-05** | A gym may publicly respond once per review. A gym may never edit or delete a member's review; it may only report it. | M | `reviews/` | A8.7 | Integration + Contract; `AC-REV-01.1`, `AC-REV-01.2` (no such capability exists in UI or API); `E2E-09` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-REV-06** | A reported review stays published while under moderation unless it contains content requiring immediate removal (personal data, threats), which is hidden pending review. | M | `reviews/` | A8.7 | Integration; `FR-REV-06`; `AC-REV-01.3`; `RC-43 PERSONAL_INFORMATION`, `RC-49 THREAT` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-REV-07** | The displayed rating is the mean of published reviews, shown with the review count; ratings are not displayed at all below a minimum of 3 reviews. | S | `reviews/` · `web` | A8.7 | Unit + E2E; `FR-REV-08`; `AC-DETL-02.1`; `OQ-10` default 3 | NOT STARTED |

### 7.9 Coupons, referrals and wallet — `BR-CPN-01` … `BR-CPN-05`, `BR-RFL-01`, `BR-WAL-01` (§A8.8)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **BR-CPN-01** | A coupon declares: code, discount type (percent or fixed), value, cap, validity window, usage limits (total and per user), applicable plans and branches, first-purchase-only flag, and `funding_source` (platform or gym). | M | `ordering/` | A8.8 | Unit + Integration; `FR-CPN-01`; `coupons` table; `SCR-DASH-016` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-CPN-02** | Coupons do not stack. One coupon per order. | M | `ordering/` | A8.8 | Integration + Contract; `API-ORD POST /orders/:ref/coupon` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-CPN-03** | A coupon is re-validated server-side at payment initiation; an expired or exhausted coupon aborts checkout with a clear message. | M | `ordering/` · `payments/` | A8.8 | Integration + E2E; `FR-CPN-03`; §B5.9 edge case *coupon expires between order and payment*; `E2E-06` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-CPN-04** | Discount never reduces a payable below zero; any excess is discarded, not credited. | M | `ordering/` | A8.8 | Unit (boundary) + Integration — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-CPN-05** | `funding_source` determines the commission base per §A6.3 and is immutable after first use. | M | `ordering/` · `settlements/` | A8.8 · A6.3 | Unit (commission base) + `E2E-06`; `AC-CPN-01.4` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-RFL-01** | Referral reward is credited only after the referred user's first membership passes the tenant's refund window. | S | `crm/` · `refunds/` | A8.8 | Integration; `FR-REFR-04`; `AC-REFR-01.1`, `AC-REFR-01.2` | NOT STARTED |
| `[ ]` | **BR-WAL-01** | Wallet credit is non-transferable, non-encashable, expires per configuration, and is applied before payment gateway charge. | C | `ordering/` · `ledger/` | A8.8 | Unit + Integration; `FR-REFR-06` | NOT STARTED |

### 7.10 Financial control and settlement — `BR-FIN-01` … `BR-FIN-08` (§A8.9)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **BR-FIN-01** | All balances are derived from the append-only ledger. No balance is ever stored as a directly-mutable figure. | M | `ledger/` | A8.9 | Integration (no `UPDATE`/`DELETE` grant on `ledger_entries`) + architecture fitness test; `PRIN-03`; `E2E-12` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-FIN-02** | Every settlement line persists gross, discount, net, tax, commission base, commission, gateway fee and payable. None of these is recomputed at display time. | M | `settlements/` | A8.9 · A6.3 | Integration; `FR-SETL-02`; `settlement_lines`; `AC-SETL-01.1` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-FIN-03** | A settlement statement's line items must sum exactly to the payout amount, including opening balance, reserve and refund lines. | M | `settlements/` | A8.9 | Unit (arithmetic) + `E2E-12`; `AC-SETL-01.1`, `AC-SETL-01.3`, `AC-SETL-01.4`; `BAC-07` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-FIN-04** | Commission is charged on the commission base only, never on tax and never on gateway fees. | M | `settlements/` | A8.9 · A6.3 | Unit (worked example from §A6.3) + `E2E-06` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-FIN-05** | The commission rate applied to a transaction is the rate effective at the moment of sale; later rate changes never alter historical settlements. | M | `settlements/` · `admin/` | A8.9 | Unit + Integration; `AC-ADMN-01.4`; `FR-ADMN-03` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-FIN-06** | Gateway fees are recorded as reported by the provider, never estimated. Where a fee is not yet reported, the line is held out of settlement rather than estimated. | M | `settlements/` · `payments/` | A8.9 | Integration; `FR-SETL-01`, `FR-SETL-02`; `E2E-12` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-FIN-07** | A daily reconciliation compares provider settlement reports to the ledger; any variance raises an alert and blocks auto-payout for the affected tenant until resolved. | M | `settlements/` | A8.9 · A6.4 | Integration; `FR-SETL-09`; `JOB-10 settlement.reconcile`; `KPI-26`; `SCR-ADM-010` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-FIN-08** | Payouts above a configurable threshold require dual approval. | S | `settlements/` | A8.9 | Integration + RBAC; `FR-SETL-06`; `SCR-ADM-007` dual-control | NOT STARTED |

### 7.11 Data, privacy and audit — `BR-DAT-01` … `BR-DAT-07` (§A8.10)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **BR-DAT-01** | Every create, update and delete on a member, membership, payment, plan, gym, staff or configuration record is written to an append-only audit log capturing actor, timestamp, IP, entity, before-state and after-state. | M | `audit/` · `common/` | A8.10 | Integration (per entity type) + E2E; `BAC-13`; `AC-ADMN-02.1`; `audit_log` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-DAT-02** | Support impersonation of a user requires a stated reason, is time-boxed, is visible to the impersonated user in their account activity, and is fully audited. | M | `iam/` · `audit/` | A8.10 | Integration + E2E; `FR-AUTH-12`; `AC-AUTH-03.1`, `AC-AUTH-03.2`, `AC-AUTH-03.3`; `UAT-06` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-DAT-03** | A user may request export of their personal data and receive it in a machine-readable format within the statutory window. | M | `iam/` · `reporting/` | A8.10 | Integration; `FR-USER-06`; `NFR-PRV-03`; `API-USER POST /me/export` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-DAT-04** | A user may request deletion; the account and personal identifiers are erased or irreversibly pseudonymised, while financial records are retained in de-identified form for the statutory retention period. | M | `iam/` · `billing/` | A8.10 | Integration; `FR-USER-07`; `AC-USER-02.1` … `AC-USER-02.4`; `CON-04` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-DAT-05** | A tenant may export its complete operational dataset — members, memberships, payments, attendance — at any time without contacting support. | M | `reporting/` | A8.10 | Integration; `BAC-12`; `PRIN-01`; `API-TEN POST /tenant/exports` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-DAT-06** | Personal data is never included in application logs, error traces, or analytics events. | M | `common/` · all modules | A8.10 | Security (log scanning) + Unit (redaction); §C6 preamble; logging library pending `A-14` — negative case mandatory | NOT STARTED |
| `[ ]` | **BR-DAT-07** | KYC documents are stored encrypted, are accessible only to Verification and Super Admin roles, and every access is logged. | M | `onboarding/` · `audit/` | A8.10 | Integration + RBAC + Security; `NFR-SEC-02`; `kyc_documents.storage_key` separate encrypted bucket — negative case mandatory | NOT STARTED |

---

## 8. Functional Requirements — 261 identifiers across 26 families

**Source:** §B3.3 (`FR-RBAC`), §B4.4 (`FR-NAV`) and §B5.1 … §B5.24 (the twenty-four module
specifications). Every identifier in the PRD has its own row. The family ranges below were verified
against `/docs/MASTER_PRD.md` identifier by identifier; the counts are:

`FR-RBAC` ×7 · `FR-NAV` ×6 · `FR-AUTH` ×14 · `FR-USER` ×8 · `FR-ONB` ×15 · `FR-GYM` ×12 ·
`FR-PLAN` ×9 · `FR-SRCH` ×15 · `FR-DETL` ×11 · `FR-FAV` ×5 · `FR-CART` ×11 · `FR-PAY` ×12 ·
`FR-INV` ×11 · `FR-MEMB` ×12 · `FR-CHK` ×14 · `FR-CRM` ×10 · `FR-STAF` ×9 · `FR-REV` ×11 ·
`FR-CPN` ×8 · `FR-REFR` ×7 · `FR-NOTF` ×8 · `FR-RPT` ×5 · `FR-SETL` ×10 · `FR-RFND` ×11 ·
`FR-SUP` ×7 · `FR-ADMN` ×13 = **261**.

### 8.1 `FR-RBAC` — Permission requirements (§B3.3) — 7 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-RBAC-01** | Every API endpoint declares its required permission; an endpoint with no declared permission fails a CI check and cannot be merged. | M | `iam/` · `common/` | B3.3 | Contract + CI gate (§C7 non-negotiable gates); architecture fitness test | NOT STARTED |
| `[ ]` | **FR-RBAC-02** | Permission checks are enforced server-side. Client-side hiding of UI is presentation only and never a security control. | M | `iam/` | B3.3 | Contract + Security; `AC-STAF-01.2` (direct-URL access refused server-side) | NOT STARTED |
| `[ ]` | **FR-RBAC-03** | Tenant-scoped roles are evaluated against the tenant on the resource, never against the tenant on the session alone. | M | `iam/` · `tenancy/` | B3.3 | Isolation suite; `E2E-11`; `BR-TEN-01` | NOT STARTED |
| `[ ]` | **FR-RBAC-04** | Role changes take effect within 60 seconds without requiring the affected user to re-authenticate. | S | `iam/` | B3.3 | Integration (timing); `FR-STAF-04` | NOT STARTED |
| `[ ]` | **FR-RBAC-05** | A user's effective permissions are inspectable by Super Admin for support purposes. | S | `iam/` · `admin/` | B3.3 | Integration + RBAC; `SCR-DASH-018` permission summary; `SCR-ADM-005` | NOT STARTED |
| `[ ]` | **FR-RBAC-06** | Staff invitations are role-scoped and branch-scoped at the point of invitation. | M | `staff/` · `iam/` | B3.3 | Integration; `FR-AUTH-13`, `FR-STAF-01`; `AC-STAF-01.1` | NOT STARTED |
| `[ ]` | **FR-RBAC-07** | The last remaining `GYM_OWNER` of a tenant cannot be removed or demoted. | M | `staff/` | B3.3 | Integration (negative); `FR-STAF-09`; `SCR-DASH-018` last-owner protection | NOT STARTED |

### 8.2 `FR-NAV` — Navigation rules (§B4.4) — 6 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-NAV-01** | The customer website is fully browsable without authentication; the auth gate appears at "select plan → checkout" and nowhere earlier. | M | `web` · `discovery/` | B4.4 | E2E; `E2E-02`; `SCR-WEB-001` … `SCR-WEB-004` unauthenticated | NOT STARTED |
| `[ ]` | **FR-NAV-02** | After authentication the user returns to the exact point of interruption with prior state intact (selected plan, filters, comparison set). | M | `web` | B4.4 | E2E; `AC-FAV-01.1`; `FR-CART-08`; `FR-DETL-09`; `SCR-WEB-016` behaviour | NOT STARTED |
| `[ ]` | **FR-NAV-03** | Dashboard navigation is filtered by effective permission; a user never sees a menu item they cannot use. | M | `dash` · `iam/` | B4.4 | E2E + RBAC; `SCR-DASH-001` permission variant; `AC-STAF-01.1` | NOT STARTED |
| `[ ]` | **FR-NAV-04** | The dashboard shows a persistent onboarding checklist until the tenant reaches `APPROVED` with ≥1 published plan. | M | `dash` · `onboarding/` | B4.4 | E2E; `FR-ONB-14`; `SCR-DASH-001` region 1; `AC-ONB-01.1` | NOT STARTED |
| `[ ]` | **FR-NAV-05** | Every gym detail page has a canonical, human-readable, stable URL suitable for sharing and search indexing. | M | `web` · `discovery/` | B4.4 | Contract + E2E; `FR-DETL-07`, `FR-DETL-10`; `/gyms/:citySlug/:gymSlug` | NOT STARTED |
| `[ ]` | **FR-NAV-06** | Deep links to any dashboard or admin screen resolve correctly after authentication. | S | `dash` · `admin` | B4.4 | E2E; `SCR-DASH-001` … `SCR-ADM-015` route resolution | NOT STARTED |

### 8.3 `FR-AUTH` — Authentication & Identity (§B5.1) — 14 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-AUTH-01** | Registration by mobile number with OTP, or by email with password and a verification link. | M | `iam/` | B5.1 | Contract + E2E; `US-AUTH-01`; `API-AUTH /auth/otp/request`, `/auth/register` | NOT STARTED |
| `[ ]` | **FR-AUTH-02** | A verified mobile number is mandatory before any purchase; email is mandatory before any invoice is issued. | M | `iam/` · `ordering/` · `billing/` | B5.1 | Integration (negative); `E2E-02` | NOT STARTED |
| `[ ]` | **FR-AUTH-03** | Social login (Google) as an alternative for the customer website only. | S | `iam/` · `web` | B5.1 | Contract + E2E; surface-scoped negative test on `dash` and `admin` | NOT STARTED |
| `[ ]` | **FR-AUTH-04** | Passwords: minimum 10 characters, checked against a breached-password list, hashed with Argon2id. | M | `iam/` | B5.1 | Unit (policy) + Security; Argon2id is PRD-specified, the binding library is pending `A-12` | NOT STARTED |
| `[ ]` | **FR-AUTH-05** | OTP: 6 digits, 5-minute validity, maximum 5 attempts, maximum 3 resends per 30 minutes per number, rate-limited per IP and per number. | M | `iam/` · `common/` | B5.1 | Unit (boundaries) + Integration; `AC-AUTH-01.3`, `AC-AUTH-01.4`; `NFR-SEC-06`; rate-limit library pending `A-13` | NOT STARTED |
| `[ ]` | **FR-AUTH-06** | Sessions use short-lived access tokens (15 min) with rotating refresh tokens (30 days, revoked on reuse detection). | M | `iam/` | B5.1 | Unit + Integration + Security; §B5.1 edge case *refresh token presented twice → family revoked* | NOT STARTED |
| `[ ]` | **FR-AUTH-07** | Mandatory MFA for all platform staff roles; optional TOTP MFA for `GYM_OWNER`. | M | `iam/` | B5.1 | Integration + RBAC; `NFR-SEC-11`; `API-AUTH /auth/mfa/enrol`, `/auth/mfa/verify` | NOT STARTED |
| `[ ]` | **FR-AUTH-08** | Account lockout after 10 failed attempts in 15 minutes, with self-service unlock via verified channel. | M | `iam/` | B5.1 | Unit (counter) + Integration; `NFR-SEC-06` | NOT STARTED |
| `[ ]` | **FR-AUTH-09** | Active session list per user with individual and bulk revocation. | S | `iam/` | B5.1 | Contract + E2E; `API-AUTH GET /auth/sessions`, `DELETE /auth/sessions/:id`; `SCR-WEB-014` | NOT STARTED |
| `[ ]` | **FR-AUTH-10** | Password reset invalidates all existing sessions. | M | `iam/` | B5.1 | Integration (negative — old session refused after reset) | NOT STARTED |
| `[ ]` | **FR-AUTH-11** | A single identity may hold roles across multiple tenants; the tenant context is explicit in every dashboard session and switching is audited. | M | `iam/` · `tenancy/` · `audit/` | B5.1 | Isolation + Integration; `AC-AUTH-02.1` … `AC-AUTH-02.3`; `BR-TEN-02` | NOT STARTED |
| `[ ]` | **FR-AUTH-12** | Support impersonation issues a distinctly-typed token, is capped at 30 minutes, cannot perform financial mutations, and surfaces a persistent banner in the impersonated session. | M | `iam/` | B5.1 | Integration + Contract (negative on financial mutations); `AC-AUTH-03.1`, `AC-AUTH-03.2`; `BR-DAT-02` | NOT STARTED |
| `[ ]` | **FR-AUTH-13** | Staff invitations are single-use, expire in 7 days, and bind the invited email to the intended role and branches. | M | `iam/` · `staff/` | B5.1 | Integration (single-use + expiry negative); `FR-RBAC-06`; §B5.1 edge case *invitee already has an account* | NOT STARTED |
| `[ ]` | **FR-AUTH-14** | Merging duplicate accounts (same person, phone and email registered separately) is supported by Support with explicit confirmation from the user. | C | `iam/` · `support/` | B5.1 | Integration; audit trail per `BR-DAT-01` | NOT STARTED |

### 8.4 `FR-USER` — User Profile & Account (§B5.2) — 8 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-USER-01** | Profile fields: name, mobile, email, date of birth, gender (with "prefer not to say"), city, profile photo, emergency contact. | M | `iam/` · `web` | B5.2 | Contract + E2E; `SCR-WEB-014`; validation library pending `A-02` | NOT STARTED |
| `[ ]` | **FR-USER-02** | Fitness context (optional): goals, experience level, preferred workout times, health notes. Used for recommendations and shared with a gym only after purchase. | S | `iam/` · `crm/` | B5.2 | Integration (negative — not shared pre-purchase); `NFR-PRV-07` | NOT STARTED |
| `[ ]` | **FR-USER-03** | Health information is optional, clearly labelled as sensitive, and never used in marketing segmentation. | M | `iam/` · `notifications/` | B5.2 | Integration (negative — excluded from segmentation); `NFR-PRV-07` | NOT STARTED |
| `[ ]` | **FR-USER-04** | Notification preferences per channel (email, SMS, push) and per category (transactional, reminders, marketing). Transactional cannot be disabled. | M | `notifications/` | B5.2 | Integration; `AC-USER-01.1`, `AC-USER-01.2`; `FR-NOTF-02` | NOT STARTED |
| `[ ]` | **FR-USER-05** | Account activity log visible to the user: logins, devices, impersonations, data exports. | S | `iam/` · `audit/` | B5.2 | Integration; `AC-AUTH-03.3`; `API-USER GET /me/activity` | NOT STARTED |
| `[ ]` | **FR-USER-06** | Self-service data export producing a machine-readable archive. | M | `iam/` · `reporting/` | B5.2 | Integration; `BR-DAT-03`; `NFR-PRV-03`; `API-USER POST /me/export` | NOT STARTED |
| `[ ]` | **FR-USER-07** | Self-service account deletion request with a 7-day grace period and clear disclosure of what is retained and why. | M | `iam/` | B5.2 | Integration + E2E; `AC-USER-02.1` … `AC-USER-02.4`; `BR-DAT-04`; `CON-04` | NOT STARTED |
| `[ ]` | **FR-USER-08** | Changing mobile or email requires verification of the new value before it becomes effective. | M | `iam/` | B5.2 | Integration (negative — unverified value not effective); §B5.1 edge case *user changes phone number* | NOT STARTED |

### 8.5 `FR-ONB` — Tenant Onboarding & KYC (§B5.3) — 15 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-ONB-01** | A guided, resumable, multi-step wizard with visible progress; partial state persists indefinitely. | M | `onboarding/` · `dash` | B5.3 | E2E; `SCR-DASH-002`; `E2E-01`; `UAT-01`; form library pending `A-09` | NOT STARTED |
| `[ ]` | **FR-ONB-02** | **Step 1 Business:** legal entity name, trading name, entity type, registration identifier, registered address, business contact. | M | `onboarding/` | B5.3 | Contract + E2E; `tenants.legal_name`/`trading_name`/`entity_type`/`registration_number`; `E2E-01` | NOT STARTED |
| `[ ]` | **FR-ONB-03** | **Step 2 KYC:** document upload against a country-specific checklist defined in `config/kyc`; each document typed, with format and size validation and preview. | M | `onboarding/` | B5.3 | Integration + Security; `FR-ADMN-06`; `NFR-SEC-10`; `BR-DAT-07`; `E2E-01` | NOT STARTED |
| `[ ]` | **FR-ONB-04** | **Step 3 Gym:** display name, description, category, amenities, photographs (min 3, max 30), operating hours per weekday with holiday exceptions, gender policy, address, and map pin with drag-to-adjust. | M | `onboarding/` · `catalog/` | B5.3 | Integration (boundary 3/30) + E2E; `BR-GYM-02`; `E2E-01` | NOT STARTED |
| `[ ]` | **FR-ONB-05** | **Step 4 Plans:** at least one plan created before submission. | M | `onboarding/` · `plans/` | B5.3 | Integration (negative — submission blocked with zero plans); `BR-GYM-02`; `RC-27 NO_PUBLISHED_PLAN` | NOT STARTED |
| `[ ]` | **FR-ONB-06** | **Step 5 Payout:** bank account details, account-name verification through the gateway, and confirmation of the tenant's refund policy. | M | `onboarding/` · `settlements/` | B5.3 | Integration; `BR-REF-01`; `RC-28 BANK_VERIFICATION_FAILED`; `E2E-01` | NOT STARTED |
| `[ ]` | **FR-ONB-07** | **Step 6 Review & submit:** a read-only summary with edit links, terms acceptance, and submission. | M | `onboarding/` | B5.3 | E2E; `E2E-01`; `BAC-01`; `UAT-01` | NOT STARTED |
| `[ ]` | **FR-ONB-08** | Submission locks the submitted version; the owner may continue editing non-material fields but the reviewer sees a fixed snapshot. | M | `onboarding/` | B5.3 | Integration; `applications.snapshot`; `BR-GYM-05` | NOT STARTED |
| `[ ]` | **FR-ONB-09** | Status is visible at all times: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `INFO_REQUESTED`, `APPROVED`, `REJECTED`, `SUSPENDED`. | M | `onboarding/` · `dash` | B5.3 | Integration + E2E; `SM-04`; `SCR-DASH-002` status panel | NOT STARTED |
| `[ ]` | **FR-ONB-10** | The reviewer may request specific additional information without rejecting, moving the application to `INFO_REQUESTED` with a targeted checklist. | M | `onboarding/` · `admin/` | B5.3 | Integration + E2E; `SMT-35`; `UAT-04` (2 information requests) | NOT STARTED |
| `[ ]` | **FR-ONB-11** | Rejection returns one or more structured reason codes plus optional free text, and identifies exactly which fields or documents to fix. | M | `onboarding/` · `admin/` | B5.3 | Integration; `BR-GYM-04`; `RCT-02`; `AC-ONB-01.2`; `UAT-04` (3 rejections) | NOT STARTED |
| `[ ]` | **FR-ONB-12** | Automated pre-checks run at submission and are shown to the reviewer: address-to-geo distance, duplicate address, duplicate registration identifier, duplicate bank account, image quality and duplicate-image detection, profanity screening on free text. | M | `onboarding/` | B5.3 | Integration (one case per pre-check) ; `AC-ONB-02.2`; `BR-GYM-08`, `BR-GYM-09`; `SCR-ADM-003` pre-check panel | NOT STARTED |
| `[ ]` | **FR-ONB-13** | Approval publishes the listing within 60 seconds and notifies the owner across all enabled channels. | M | `onboarding/` · `discovery/` · `notifications/` | B5.3 | E2E (timed); `AC-ONB-02.5`; `BAC-02`; `E2E-01` | NOT STARTED |
| `[ ]` | **FR-ONB-14** | An activation checklist persists on the dashboard home until the tenant has: approved status, ≥1 published plan, ≥1 staff member, ≥1 member, and ≥1 check-in. | S | `onboarding/` · `dash` | B5.3 | E2E; `FR-NAV-04`; `SCR-DASH-001` region 1; `RSK-09` mitigation | NOT STARTED |
| `[ ]` | **FR-ONB-15** | Bulk member import from CSV with column mapping, dry-run validation, per-row error reporting, and idempotent re-run. | S | `onboarding/` · `crm/` | B5.3 | Integration + E2E; `AC-ONB-03.1` … `AC-ONB-03.4`; CSV parser pending `A-20` | NOT STARTED |

### 8.6 `FR-GYM` — Gym & Branch Management (§B5.4) — 12 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-GYM-01** | Gym profile: name, slug, description (rich text, sanitised), category, established year, contact, website, social links. | M | `catalog/` | B5.4 | Contract + Security (sanitisation); `gyms` table; `NFR-SEC-05` | NOT STARTED |
| `[ ]` | **FR-GYM-02** | Photo gallery with drag-ordering, cover selection, captions, automatic resizing to defined renditions, and EXIF stripping. | M | `catalog/` | B5.4 | Integration + Security; `gym_media.renditions`; `NFR-SEC-10`; image processor pending `A-17` | NOT STARTED |
| `[ ]` | **FR-GYM-03** | Amenity selection from a platform-controlled taxonomy; free-text amenities are not permitted (they break filtering). | M | `catalog/` | B5.4 | Contract (negative — free text refused); `NFR-DQ-06`; `REF-04 amenities` | NOT STARTED |
| `[ ]` | **FR-GYM-04** | Operating hours per weekday with multiple windows per day, plus dated exceptions (holidays, maintenance). | M | `catalog/` | B5.4 | Integration; `branch_hours`, `branch_hour_exceptions`; `BR-CHK-05` | NOT STARTED |
| `[ ]` | **FR-GYM-05** | Gender policy: mixed, women-only, men-only, or scheduled (specific hours reserved). | M | `catalog/` | B5.4 | Integration; `gyms.gender_policy` enum; `FR-SRCH-03` filter | NOT STARTED |
| `[ ]` | **FR-GYM-06** | Location: address, geo-coordinates, map pin adjustment, landmark, and parking notes. | M | `catalog/` | B5.4 | Integration; `branches.location geography(Point,4326)`; `BR-GYM-08` | NOT STARTED |
| `[ ]` | **FR-GYM-07** | Branch management: create, edit, activate, deactivate. Each branch has its own address, hours, photos, staff and capacity. | M | `catalog/` | B5.4 | Contract + E2E; `SCR-DASH-004`; `BR-TEN-03` | NOT STARTED |
| `[ ]` | **FR-GYM-08** | Branch-level access control on plans: a plan may permit all branches or a named subset. | M | `catalog/` · `plans/` | B5.4 | Integration; `plan_branches` (absence = all); `AC-GYM-01.1` … `AC-GYM-01.3` | NOT STARTED |
| `[ ]` | **FR-GYM-09** | Capacity declaration per branch, used for crowd indicators and future class booking. | C | `catalog/` | B5.4 | Integration; `branches.capacity` | NOT STARTED |
| `[ ]` | **FR-GYM-10** | Temporary closure with reason, date range, and automatic member notification. | S | `catalog/` · `notifications/` | B5.4 | Integration + E2E; `AC-GYM-02.1` … `AC-GYM-02.3`; `RC-09 GYM_CLOSED_EXCEPTION`; `BR-MEM-14` | NOT STARTED |
| `[ ]` | **FR-GYM-11** | Material field changes route to review per `BR-GYM-06`; the UI states this before the change is saved. | M | `catalog/` · `onboarding/` | B5.4 | Integration + E2E; `SCR-DASH-003` behaviour; `BR-GYM-06`, `BR-GYM-07` | NOT STARTED |
| `[ ]` | **FR-GYM-12** | A listing freshness score derived from last profile update, last plan update, photo age and check-in recency; below a threshold the gym is demoted in search and the owner is prompted. | S | `catalog/` · `discovery/` | B5.4 | Unit (scoring) + Integration; `gyms.freshness_score`; `JOB-14 gym.freshness-score`; `RSK-11` mitigation | NOT STARTED |

### 8.7 `FR-PLAN` — Membership Plan Catalogue (§B5.5) — 9 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-PLAN-01** | Plan attributes: name, description, type (`DURATION` or `SESSION`), duration value and unit, session count, price, currency, joining fee, applicable branches, access windows, minimum age, gender eligibility, freeze allowance, transfer allowance, stackability, visibility (`PUBLIC` / `STAFF_ONLY`), and status (`DRAFT` / `PUBLISHED` / `ARCHIVED`). | M | `plans/` | B5.5 | Contract + Integration; `plans` table; `BR-PLN-01`; `SCR-DASH-006` | NOT STARTED |
| `[ ]` | **FR-PLAN-02** | Access windows restrict when the plan permits entry (e.g. a cheaper "off-peak" plan valid 11:00–17:00). Enforced at check-in. | S | `plans/` · `attendance/` | B5.5 | Integration; `FR-CHK-04` step 8; `RC-08 OUTSIDE_PLAN_ACCESS_WINDOW` | NOT STARTED |
| `[ ]` | **FR-PLAN-03** | Promotional pricing with a validity window and an automatic reversion to list price; only one active promotion per plan (`BR-PLN-07`). | S | `plans/` | B5.5 | Unit + Integration; `AC-PLAN-01.1`, `AC-PLAN-01.2`; `plans.promo_*` columns | NOT STARTED |
| `[ ]` | **FR-PLAN-04** | Plan ordering within the gym's public catalogue is controllable by the owner. | S | `plans/` | B5.5 | Integration; `plans.sort_order`; `SCR-DASH-005` reorder action | NOT STARTED |
| `[ ]` | **FR-PLAN-05** | Archiving a plan removes it from sale, retains all existing memberships, and blocks its selection in new orders. | M | `plans/` · `ordering/` | B5.5 | Integration (negative — archived plan not orderable); `AC-PLAN-02.3`; `BR-PLN-04` | NOT STARTED |
| `[ ]` | **FR-PLAN-06** | Duplicating a plan produces an editable draft copy. | S | `plans/` | B5.5 | Contract; `API-TEN POST /tenant/plans/:id/duplicate` | NOT STARTED |
| `[ ]` | **FR-PLAN-07** | The plan editor previews exactly how the plan will appear on the marketplace before publishing. | S | `plans/` · `dash` | B5.5 | E2E; `SCR-DASH-006` preview | NOT STARTED |
| `[ ]` | **FR-PLAN-08** | Price changes require explicit confirmation stating that existing memberships are unaffected (`BR-PLN-02`). | M | `plans/` · `dash` | B5.5 | E2E; `SCR-DASH-006` guards; `NFR-USE-06` | NOT STARTED |
| `[ ]` | **FR-PLAN-09** | Add-ons (locker, personal training block, diet consultation) attachable to a plan with independent pricing. | C | `plans/` · `ordering/` | B5.5 | Integration; `FR-CART-02` add-ons; order breakdown `add_ons_minor` | NOT STARTED |

### 8.8 `FR-SRCH` — Marketplace Search & Discovery (§B5.6) — 15 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-SRCH-01** | Location determination by browser geolocation with explicit consent, manual city/locality entry, or pincode. Last location is remembered. | M | `discovery/` · `web` | B5.6 | E2E; `SCR-WEB-001` notes (contextual permission); §B5.6 edge case *geolocation denied* | NOT STARTED |
| `[ ]` | **FR-SRCH-02** | Free-text search across gym name, locality, city and amenity synonyms, with typo tolerance. | M | `discovery/` | B5.6 | Integration; PostgreSQL full-text + trigram per §C1.1 | NOT STARTED |
| `[ ]` | **FR-SRCH-03** | Filters: distance radius, price range (by plan duration normalised to monthly equivalent), amenities (multi-select), rating threshold, open-now, 24-hour access, gender policy, plan duration available, trial available, parking. | M | `discovery/` | B5.6 | Integration (one case per filter); `AC-SRCH-01.1`; `SCR-WEB-002` filter rail | NOT STARTED |
| `[ ]` | **FR-SRCH-04** | Sort: relevance (default), distance, price ascending, rating, newest. | M | `discovery/` | B5.6 | Contract + Integration; `SCR-WEB-002` sort control | NOT STARTED |
| `[ ]` | **FR-SRCH-05** | Results as an interactive list synchronised with a map; hovering a card highlights its pin and vice versa. | M | `web` | B5.6 | E2E; `AC-SRCH-02.1`; `SCR-WEB-002` map | NOT STARTED |
| `[ ]` | **FR-SRCH-06** | Each result card shows: cover photo, name, distance, rating and review count, verified badge, lowest monthly-equivalent price, top three amenities, open/closed status. | M | `web` · `discovery/` | B5.6 | E2E; `SCR-WEB-002` result card | NOT STARTED |
| `[ ]` | **FR-SRCH-07** | Pagination by infinite scroll on the list with a stable "load more" fallback; the map shows all results in the current viewport. | M | `web` | B5.6 | E2E + Contract (cursor pagination per §C3.1) | NOT STARTED |
| `[ ]` | **FR-SRCH-08** | "Search this area" when the map is panned beyond the original result bounds. | S | `web` | B5.6 | E2E; `AC-SRCH-02.2`; `EVT-05 map_area_searched` | NOT STARTED |
| `[ ]` | **FR-SRCH-09** | Only `APPROVED`, non-suspended gyms with ≥1 published public plan appear. | M | `discovery/` | B5.6 | Integration (negative for each exclusion); `BR-GYM-01`, `BR-TEN-05`, `BR-PLN-05` | NOT STARTED |
| `[ ]` | **FR-SRCH-10** | Relevance ranking factors: distance, rating (Bayesian-adjusted for review count), listing freshness, conversion rate, featured status, and completeness of profile. The ranking formula is configurable without deployment. | M | `discovery/` | B5.6 | Unit (ranking) + Integration; `FR-REV-08`; `gyms (status, rating_avg desc, freshness_score desc)` index | NOT STARTED |
| `[ ]` | **FR-SRCH-11** | Featured placements are visually and textually labelled as promoted. | M | `web` · `discovery/` | B5.6 | E2E; `gyms.featured_until`; `SCR-WEB-001` region 6 | NOT STARTED |
| `[ ]` | **FR-SRCH-12** | Zero-result state offers radius expansion, filter relaxation suggestions naming the specific filter to relax, and nearby city suggestions. | M | `web` · `discovery/` | B5.6 | E2E; `AC-SRCH-01.2`; `SCR-WEB-002-E`; `EVT-03 search_zero_results` | NOT STARTED |
| `[ ]` | **FR-SRCH-13** | Search results are server-rendered for indexability on city and category landing pages. | M | `web` | B5.6 | E2E + SEO assertion; Next.js 14 App Router server rendering per §C1.1 | NOT STARTED |
| `[ ]` | **FR-SRCH-14** | Saved searches with optional alerts when a new gym matches. | C | `discovery/` | B5.6 | Contract + Integration; `FR-FAV-05`; `API-FAV /me/saved-searches` | NOT STARTED |
| `[ ]` | **FR-SRCH-15** | Every search, filter application and result click is captured as an analytics event with the anonymous or authenticated identifier. | M | `discovery/` | B5.6 | Integration; `EVT-01`, `EVT-02`, `EVT-04`; `BR-DAT-06` (no personal data) | NOT STARTED |

### 8.9 `FR-DETL` — Gym Detail & Comparison (§B5.7) — 11 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-DETL-01** | Gym detail page sections: photo gallery, name and verified badge, rating summary, address with map and directions link, operating hours with today highlighted, amenities, gender policy, description, plan catalogue, reviews, similar gyms nearby. | M | `web` · `discovery/` | B5.7 | E2E; `SCR-WEB-003` regions 1–11 | NOT STARTED |
| `[ ]` | **FR-DETL-02** | Plan cards show price, duration, what is included, joining fee if any, access windows if restricted, and a direct purchase action. | M | `web` · `plans/` | B5.7 | E2E; `SCR-WEB-003` plan card; `PRIN-02` | NOT STARTED |
| `[ ]` | **FR-DETL-03** | A visible monthly-equivalent price for every plan to enable honest comparison across durations. | S | `web` · `plans/` | B5.7 | Unit (normalisation) + E2E; `FR-SRCH-03` price filter parity | NOT STARTED |
| `[ ]` | **FR-DETL-04** | Rating summary shows the mean, the count, and the distribution across 1–5. | M | `web` · `reviews/` | B5.7 | E2E; `FR-REV-08`; `BR-REV-07` | NOT STARTED |
| `[ ]` | **FR-DETL-05** | Reviews list is paginated, sortable by recency and rating, filterable by rating, and each entry shows the reviewer's display name, membership tenure band, rating, text, date and any gym response. | M | `web` · `reviews/` | B5.7 | Contract + E2E; `SCR-WEB-003` review item; `API-DISC GET /gyms/:slug/reviews` | NOT STARTED |
| `[ ]` | **FR-DETL-06** | "Report this gym" available to any authenticated user with structured reasons. | M | `web` · `admin/` | B5.7 | Contract + Integration; `FR-ADMN-12` user reports queue; `RSK-01` mitigation | NOT STARTED |
| `[ ]` | **FR-DETL-07** | Share affordance producing a canonical URL with correct link-preview metadata. | S | `web` | B5.7 | E2E; `FR-NAV-05` | NOT STARTED |
| `[ ]` | **FR-DETL-08** | Comparison of up to 4 gyms across: distance, rating, price by duration, amenities (as a presence matrix), timings, gender policy, and verified status. | S | `web` · `discovery/` | B5.7 | E2E; `AC-DETL-01.1`, `AC-DETL-01.2`, `AC-DETL-01.3`; `SCR-WEB-004` | NOT STARTED |
| `[ ]` | **FR-DETL-09** | Comparison state survives login and page reload. | S | `web` | B5.7 | E2E; `FR-NAV-02`; `SCR-WEB-004` persistence | NOT STARTED |
| `[ ]` | **FR-DETL-10** | Structured data markup for local business and aggregate rating on every gym page. | S | `web` | B5.7 | E2E + SEO assertion; `SCR-WEB-003` SEO row | NOT STARTED |
| `[ ]` | **FR-DETL-11** | A suspended, closed or unapproved gym's URL returns a clear informational page, not a 404, when it was previously live. | S | `web` · `discovery/` | B5.7 | Contract + E2E; `SCR-WEB-003` suspended state; `AC-FAV-01.3` | NOT STARTED |

### 8.10 `FR-FAV` — Favourites & Saved Searches (§B5.8) — 5 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-FAV-01** | An authenticated user may favourite and unfavourite a gym from search results, detail and comparison. | S | `discovery/` · `web` | B5.8 | Contract + E2E; `API-FAV /me/favourites`; `EVT-11`, `EVT-12` | NOT STARTED |
| `[ ]` | **FR-FAV-02** | Favourites are listed in the account with the current price and any change since favouriting. | S | `discovery/` · `web` | B5.8 | E2E; `AC-FAV-01.2`; `SCR-WEB-012` | NOT STARTED |
| `[ ]` | **FR-FAV-03** | A visitor's favourite action prompts authentication and completes the favourite after login without losing context. | S | `discovery/` · `web` | B5.8 | E2E; `AC-FAV-01.1`; `FR-NAV-02` | NOT STARTED |
| `[ ]` | **FR-FAV-04** | Optional notification when a favourited gym launches a promotion or changes price. | C | `discovery/` · `notifications/` | B5.8 | Integration; `FR-NOTF-02` category *marketing/operational* | NOT STARTED |
| `[ ]` | **FR-FAV-05** | Saved searches with named criteria and optional new-match alerts. | C | `discovery/` | B5.8 | Contract + Integration; `FR-SRCH-14`; `API-FAV /me/saved-searches` | NOT STARTED |

### 8.11 `FR-CART` — Checkout & Orders (§B5.9) — 11 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-CART-01** | Checkout is single-plan. There is no multi-gym basket in Phase 1. | M | `ordering/` | B5.9 | Contract (negative — second plan refused); `SCR-WEB-005` | NOT STARTED |
| `[ ]` | **FR-CART-02** | Checkout captures: start date (today or a future date within a configurable horizon), optional add-ons, coupon code, and acceptance of the gym's stated refund policy. | M | `ordering/` | B5.9 | Contract + E2E; `AC-CART-01.1`; `BR-REF-01`; `SCR-WEB-005` region 1 | NOT STARTED |
| `[ ]` | **FR-CART-03** | The order summary itemises: plan price, joining fee, add-ons, discount, tax, and total payable — each as a separate visible line. | M | `ordering/` · `web` | B5.9 | E2E + Contract; §C3.3 *Create order* breakdown; `SCR-WEB-005` region 3 | NOT STARTED |
| `[ ]` | **FR-CART-04** | All amounts are computed server-side (`BR-PAY-04`); the client renders what the server returns and submits no amounts. | M | `ordering/` | B5.9 | Contract (negative — client-supplied amount ignored/rejected); `SCR-WEB-005` notes | NOT STARTED |
| `[ ]` | **FR-CART-05** | Orders are created in `PENDING` with a 30-minute expiry; expired orders release any coupon reservation. | M | `ordering/` | B5.9 | Integration; `orders.expires_at`; `JOB-06 order.expire`; §B5.9 edge case *order expires while payment page open* | NOT STARTED |
| `[ ]` | **FR-CART-06** | An idempotency key is generated per checkout attempt and honoured through payment initiation. | M | `ordering/` · `common/` | B5.9 | Contract + Integration; `orders` unique `(idempotency_key)`; §B5.9 edge case *submitted twice from two tabs* | NOT STARTED |
| `[ ]` | **FR-CART-07** | Eligibility is validated before payment: age minimum, gender eligibility, concurrent membership conflict (`BR-MEM-04`), and plan availability. | M | `ordering/` | B5.9 | Integration (one negative per rule); `SCR-WEB-005` validation | NOT STARTED |
| `[ ]` | **FR-CART-08** | Guest-to-registered conversion happens at the auth gate without losing the selected plan or entered checkout state. | M | `ordering/` · `web` | B5.9 | E2E; `FR-NAV-01`, `FR-NAV-02`; `EVT-15 auth_gate_shown`, `EVT-16 auth_completed` | NOT STARTED |
| `[ ]` | **FR-CART-09** | Staff-initiated orders in the dashboard support offline payment methods (cash, card at desk, bank transfer) and partial payment with `BALANCE_DUE` (`BR-PAY-09`). | M | `ordering/` · `dash` | B5.9 | E2E; `AC-CART-02.1` … `AC-CART-02.3`; `E2E-10`; `SCR-DASH-012` | NOT STARTED |
| `[ ]` | **FR-CART-10** | Abandoned checkout recovery: a reminder is sent for orders abandoned after the auth gate, subject to preferences. | S | `ordering/` · `notifications/` | B5.9 | Integration; `EVT-23 checkout_abandoned`; `FR-USER-04` preference suppression | NOT STARTED |
| `[ ]` | **FR-CART-11** | Order history is visible to the member and to the gym, each seeing only their own side. | M | `ordering/` | B5.9 | Isolation + Contract; `API-ORD GET /me/orders`; `API-TEN GET /tenant/orders`; `BR-TEN-01` | NOT STARTED |

---
### 8.12 `FR-PAY` — Payments & Gateway (§B5.10) — 12 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-PAY-01** | A `PaymentProvider` abstraction exposing: create intent, capture, refund, fetch status, verify webhook, create connected account, initiate payout. No domain code references a specific provider. | M | `payments/` | B5.10 | Unit + architecture fitness test (no provider import outside the adapter); §C1.1 Stripe Connect reference adapter | NOT STARTED |
| `[ ]` | **FR-PAY-02** | Supported instruments are provider-driven and rendered dynamically; the platform does not hardcode an instrument list. | M | `payments/` · `web` | B5.10 | Contract + E2E; `payments.method` enum is a record of what happened, not a UI whitelist | NOT STARTED |
| `[ ]` | **FR-PAY-03** | Membership activation is triggered exclusively by verified webhook (`BR-PAY-02`). | M | `payments/` · `memberships/` | B5.10 | Integration (negative — client redirect alone does not activate); `AC-PAY-02.1`; `E2E-02` | NOT STARTED |
| `[ ]` | **FR-PAY-04** | Every webhook is signature-verified, deduplicated by provider event id, and processed idempotently. | M | `payments/` | B5.10 | Integration + Security; `payment_events` unique `(provider_event_id)`; §B5.10 edge case *webhook arrives twice* | NOT STARTED |
| `[ ]` | **FR-PAY-05** | A payment status poller reconciles any intent left indeterminate beyond a threshold. | M | `payments/` | B5.10 | Integration; `JOB-07 payment.reconcile`; `BR-PAY-06`; `SM-03` | NOT STARTED |
| `[ ]` | **FR-PAY-06** | Failed payments offer retry against the same order with a fresh intent while the order is unexpired. | M | `payments/` · `ordering/` | B5.10 | Contract + E2E; `API-PAY POST /payments/:id/retry`; `AC-PAY-02.3`; `SMT-19` | NOT STARTED |
| `[ ]` | **FR-PAY-07** | The payment log records every state transition with provider identifiers, timestamps and raw (redacted) payloads. | M | `payments/` | B5.10 | Integration + Security (redaction); `payments.raw_payload`; `BR-DAT-06` | NOT STARTED |
| `[ ]` | **FR-PAY-08** | Duplicate payments against one order are detected within one hour and auto-refunded with notification (`BR-PAY-07`). | M | `payments/` · `refunds/` | B5.10 | Integration (timed) + E2E; `JOB-08 payment.duplicate-detect`; `E2E-08`; `AC-PAY-01.2` | NOT STARTED |
| `[ ]` | **FR-PAY-09** | No card, CVV, bank credential or full instrument identifier is ever stored, logged or transmitted through platform systems (`BR-PAY-08`). | M | `payments/` | B5.10 | Security (SAST + log scan + DAST); `NFR-SEC-03` SAQ-A scope | NOT STARTED |
| `[ ]` | **FR-PAY-10** | Split settlement is configured so that platform commission is retained and the gym's share is routed to the gym's connected account where the provider supports it; otherwise the platform performs a scheduled payout. | M | `payments/` · `settlements/` | B5.10 | Integration (both branches); `A6.3`, `A6.4`; `DEP-01` | NOT STARTED |
| `[ ]` | **FR-PAY-11** | Auto-renewal uses provider-tokenised mandates where available, with pre-debit notification per the provider's rules. | S | `payments/` · `memberships/` | B5.10 | Integration; `JOB-05 membership.auto-renew`; `BR-MEM-10` | NOT STARTED |
| `[ ]` | **FR-PAY-12** | A payment sandbox mode is available in non-production environments with deterministic test outcomes for success, failure, timeout, and duplicate. | M | `payments/` | B5.10 | Integration; §C7 environment table (Local/CI/Development/Staging use sandbox or stub) | NOT STARTED |

### 8.13 `FR-INV` — Invoicing & Tax (§B5.11) — 11 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-INV-01** | An invoice is generated automatically on every successful payment. | M | `billing/` | B5.11 | Integration + E2E; `BR-PAY-10`; `E2E-02`; `BAC-04` | NOT STARTED |
| `[ ]` | **FR-INV-02** | Invoice numbering is gapless and sequential per tenant per financial year, using a configurable prefix format. | M | `billing/` | B5.11 | Integration (concurrency); `AC-INV-01.1`, `AC-INV-01.3`; `invoices.invoice_number` unique per tenant per FY | NOT STARTED |
| `[ ]` | **FR-INV-03** | Invoices are immutable once issued. Corrections are credit notes referencing the original. | M | `billing/` | B5.11 | Integration (no update path); `credit_notes.original_invoice_id`; `PRIN-03` | NOT STARTED |
| `[ ]` | **FR-INV-04** | Invoice content: tenant legal entity and tax identifiers, customer name and identifiers, line items, discount, tax breakdown by rate, total in words, payment reference and method, and the refund policy applicable to the order. | M | `billing/` | B5.11 | Unit (renderer) + E2E; `invoices.tenant_snapshot`/`customer_snapshot`/`line_items`/`tax_breakdown` | NOT STARTED |
| `[ ]` | **FR-INV-05** | Tax computation uses a country tax profile: rate table, inclusive or exclusive treatment, place-of-supply rules where relevant, and rounding method. | M | `billing/` | B5.11 | Unit (tax profile matrix); `FR-ADMN-05`; `OBJ-09` | NOT STARTED |
| `[ ]` | **FR-INV-06** | The tax treatment applied is stored on the invoice; later profile changes never alter issued invoices (`BR-PAY-11`). | M | `billing/` | B5.11 | Integration (negative — profile changed after issue); `orders.tax_snapshot` | NOT STARTED |
| `[ ]` | **FR-INV-07** | PDF generation is deterministic and reproducible; regenerating an invoice yields a byte-identical document. | M | `billing/` | B5.11 | Unit (byte comparison); headless-Chromium HTML-to-PDF per §C1.1; `NFR-PERF-07` | NOT STARTED |
| `[ ]` | **FR-INV-08** | Invoices are downloadable by the member, by the tenant, and by Finance, and are emailed on issue. | M | `billing/` · `notifications/` | B5.11 | Contract + RBAC + E2E; notification catalogue *Order confirmation + invoice* | NOT STARTED |
| `[ ]` | **FR-INV-09** | Credit notes are numbered in their own sequence and reference the original invoice number. | M | `billing/` | B5.11 | Integration; `credit_notes`; `E2E-07` | NOT STARTED |
| `[ ]` | **FR-INV-10** | Bulk invoice export by date range in PDF and CSV for accounting. | M | `billing/` · `reporting/` | B5.11 | Integration; `SCR-DASH-013`; `FR-RPT-03` async threshold | NOT STARTED |
| `[ ]` | **FR-INV-11** | Tenant branding (logo, footer text) on invoices, subject to tier. | S | `billing/` | B5.11 | Integration; §A6.2 Growth tier *custom branding on invoices* | NOT STARTED |

### 8.14 `FR-MEMB` — Membership Lifecycle (§B5.12) — 12 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-MEMB-01** | States and transitions per Part C §C4.1, enforced by a state machine rather than ad-hoc updates. | M | `memberships/` | B5.12 · C4.1 | Unit (state machine) + architecture fitness test; `SM-01`; `SMT-01` … `SMT-11` | NOT STARTED |
| `[ ]` | **FR-MEMB-02** | Every transition records actor, timestamp, reason and, where financial, the related order or refund. | M | `memberships/` · `audit/` | B5.12 | Integration; `membership_events`; `PRIN-07`; `BR-DAT-01` | NOT STARTED |
| `[ ]` | **FR-MEMB-03** | Membership detail shows: gym, branch entitlement, plan, start, end, days remaining, sessions remaining if applicable, status, QR access, invoice link, attendance summary, and renewal action. | M | `memberships/` · `web` | B5.12 | E2E; `SCR-WEB-009` | NOT STARTED |
| `[ ]` | **FR-MEMB-04** | Freeze: request, approval per plan configuration, date range, automatic extension of `end_date`, and a running total of freeze days used against the cap. | S | `memberships/` | B5.12 | Unit + E2E; `AC-MEMB-01.1`, `AC-MEMB-01.4`; `E2E-05`; `memberships.freeze_days_used` | NOT STARTED |
| `[ ]` | **FR-MEMB-05** | Unfreeze may occur early; the extension is recalculated to the actual frozen duration. | S | `memberships/` | B5.12 | Unit + E2E; `AC-MEMB-01.3`; `E2E-05`; `JOB-03 membership.unfreeze-scheduled` | NOT STARTED |
| `[ ]` | **FR-MEMB-06** | Renewal: one action from membership detail, defaulting to the same plan at current price, with the new term starting the day after the current end date (or today if already expired). | M | `memberships/` · `ordering/` | B5.12 | Integration + E2E; `AC-MEMB-02.2`; `E2E-04`; `SMT-11` (renewal creates a new membership) | NOT STARTED |
| `[ ]` | **FR-MEMB-07** | Upgrade with pro-rata credit for the unused remainder; downgrade scheduled for the next term (`BR-MEM-09`). | S | `memberships/` · `ordering/` | B5.12 | Unit (proration) + Integration | NOT STARTED |
| `[ ]` | **FR-MEMB-08** | Auto-renewal opt-in at purchase and toggleable thereafter, with pre-debit notification and a cancellation path that never requires contacting support. | S | `memberships/` | B5.12 | Contract + E2E; `API-MEMB PATCH /me/memberships/:id/auto-renew`; `BR-MEM-10` | NOT STARTED |
| `[ ]` | **FR-MEMB-09** | Expiry runs as a scheduled job in the gym's timezone; a membership never remains `ACTIVE` past its end date. | M | `memberships/` | B5.12 | Integration (timezone matrix); `JOB-02 membership.expire`; `SMI-01` invariant | NOT STARTED |
| `[ ]` | **FR-MEMB-10** | Reminder schedule per `BR-MEM-11`, with per-tenant override of the schedule. | M | `memberships/` · `notifications/` | B5.12 | Integration; `JOB-04 membership.renewal-reminders`; `AC-USER-01.2` | NOT STARTED |
| `[ ]` | **FR-MEMB-11** | Transfer to another person with gym approval and full audit, where the plan permits (`BR-MEM-08`). | C | `memberships/` | B5.12 | Integration; `API-MEMB POST /tenant/memberships/:id/transfer`; `BR-DAT-01` | NOT STARTED |
| `[ ]` | **FR-MEMB-12** | The gym's member view shows the same membership state as the member's view, always. There is no separate gym-side status concept. | M | `memberships/` | B5.12 | Integration (state parity assertion across both read paths); `E2E-03` | NOT STARTED |

### 8.15 `FR-CHK` — QR Check-in & Attendance (§B5.13) — 14 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-CHK-01** | The member's membership screen renders a QR encoding a signed, short-lived token (TTL 60 s) with a visible countdown and automatic refresh. | M | `attendance/` · `web` | B5.13 | E2E; `SCR-WEB-009` behaviour; `BR-CHK-02`; QR render library pending `A-10` | NOT STARTED |
| `[ ]` | **FR-CHK-02** | The token payload contains membership id, member id, tenant id, issue time, expiry and nonce, signed server-side. It contains no personal data. | M | `attendance/` | B5.13 | Unit (payload + signature) + Security; `BR-DAT-06`; signing algorithm pending `A-11` | NOT STARTED |
| `[ ]` | **FR-CHK-03** | The gym-side scanner is a browser-based camera scanner usable on any device, with a persistent full-screen mode for the front desk. | M | `attendance/` · `dash` | B5.13 | E2E + Accessibility; `SCR-DASH-009`; `ASM-01`; scanner library pending `A-10` | NOT STARTED |
| `[ ]` | **FR-CHK-04** | Validation sequence, in order, with the first failure returned: signature valid → not expired → membership exists → membership `ACTIVE` → tenant matches → branch permitted → gym open (or plan grants 24h) → within plan access window → not within duplicate cooldown → entitlement remaining. | M | `attendance/` | B5.13 | Unit (ordered sequence, one negative per step) + Integration; `RCT-01` denial codes | NOT STARTED |
| `[ ]` | **FR-CHK-05** | A successful check-in displays the member's name, photo, plan, and days or sessions remaining, held on screen for a configurable duration. | M | `attendance/` · `dash` | B5.13 | E2E; `SCR-DASH-009` success state; §C3.3 *Check-in scan* `ALLOWED` response | NOT STARTED |
| `[ ]` | **FR-CHK-06** | A denied check-in displays the specific reason in staff-appropriate language plus a suggested action, and is recorded (`BR-CHK-10`). | M | `attendance/` · `dash` | B5.13 | E2E; `SCR-DASH-009` denial state; §C3.3 `DENIED` response with `suggested_actions`; `NFR-USE-05` | NOT STARTED |
| `[ ]` | **FR-CHK-07** | Manual check-in by member search (name, phone, member code) for members without a phone to hand, marked `MANUAL` with staff identity and reason (`BR-CHK-08`). | M | `attendance/` · `dash` | B5.13 | Integration + E2E; `API-CHK POST /checkin/manual`; §B5.13 edge case *no battery*; `UAT-02` | NOT STARTED |
| `[ ]` | **FR-CHK-08** | Staff override of a denial requires selecting a reason from a fixed list and is fully audited. Overrides are reportable. | M | `attendance/` · `audit/` | B5.13 | Integration; `RCT-05` override taxonomy; `API-CHK POST /checkin/override`; `OQ-09` | NOT STARTED |
| `[ ]` | **FR-CHK-09** | Check-out is optional; where recorded, duration is computed. Where absent, a configurable auto-checkout closes the visit. | S | `attendance/` | B5.13 | Integration; `attendance.checked_out_at`/`duration_minutes`; `JOB-16 attendance.auto-checkout` | NOT STARTED |
| `[ ]` | **FR-CHK-10** | Attendance log with filters by date, branch, member, staff, method (`SCAN` / `MANUAL`), and result (`ALLOWED` / `DENIED`). | M | `attendance/` · `dash` | B5.13 | Contract + E2E; `SCR-DASH-010`; `API-CHK GET /tenant/attendance` | NOT STARTED |
| `[ ]` | **FR-CHK-11** | Member-facing visit history with a streak indicator and monthly visit count. | S | `attendance/` · `web` | B5.13 | E2E; `SCR-WEB-010`; `API-MEMB GET /me/attendance` | NOT STARTED |
| `[ ]` | **FR-CHK-12** | Implausible-travel detection: check-ins at two branches separated by more than a configurable distance within a configurable interval flag the membership (`BR-CHK-07`). | S | `attendance/` | B5.13 | Integration; `JOB-17 attendance.sharing-scan`; `RSK-03`; `BR-MEM-13` | NOT STARTED |
| `[ ]` | **FR-CHK-13** | Peak-hour analysis derived from attendance, surfaced as a heatmap by weekday and hour. | S | `attendance/` · `reporting/` | B5.13 | Integration + E2E; `AC-CHK-02.1`, `AC-CHK-02.2`; `API-CHK GET /tenant/attendance/heatmap` | NOT STARTED |
| `[ ]` | **FR-CHK-14** | A daily attendance digest to the owner, if enabled. | C | `attendance/` · `notifications/` | B5.13 | Integration; notification catalogue *Daily summary* | NOT STARTED |

### 8.16 `FR-CRM` — Member CRM (§B5.14) — 10 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-CRM-01** | Member list with search by name, phone, email and member code; filters by status, plan, branch, expiry window, join date, attendance frequency and assigned trainer. | M | `crm/` · `dash` | B5.14 | Contract + E2E; `SCR-DASH-007`; `NFR-PERF-04` | NOT STARTED |
| `[ ]` | **FR-CRM-02** | Saved segments (e.g. "expiring in 7 days", "no visit in 21 days", "joined this month") available as list presets. | S | `crm/` | B5.14 | Integration; `SCR-DASH-007` saved segments; `US-MEMB-02` | NOT STARTED |
| `[ ]` | **FR-CRM-03** | Member 360 view: profile, all memberships (current and historical), all payments and invoices, full attendance history, notes, assigned trainer, communications sent, and refund/dispute history. | M | `crm/` · `dash` | B5.14 | E2E; `SCR-DASH-008` regions 1–7; `FR-RFND-11` | NOT STARTED |
| `[ ]` | **FR-CRM-04** | Add a walk-in member manually with a minimal required set (name, phone) and optional remainder. | M | `crm/` | B5.14 | Contract + E2E; `SCR-DASH-012`; `UAT-02`; `E2E-10` | NOT STARTED |
| `[ ]` | **FR-CRM-05** | Internal notes on a member, timestamped and attributed, never visible to the member. | M | `crm/` | B5.14 | Integration (negative — not exposed on any member-facing endpoint); `API-TEN /tenant/members/:id/notes` | NOT STARTED |
| `[ ]` | **FR-CRM-06** | Attendance-based risk flag: a member whose visit frequency falls below their own established baseline is flagged as at-risk. | S | `crm/` · `attendance/` | B5.14 | Unit (baseline) + Integration; `AC-CRM-01.1`, `AC-CRM-01.3`; `JOB-18 crm.risk-flags` | NOT STARTED |
| `[ ]` | **FR-CRM-07** | Bulk actions on a filtered list: send notification, assign trainer, export. | S | `crm/` | B5.14 | Integration; `AC-CRM-01.2` (preference-respecting with suppression reporting) | NOT STARTED |
| `[ ]` | **FR-CRM-08** | Member export with all fields the tenant owns, in CSV. | M | `crm/` · `reporting/` | B5.14 | Integration; `BR-DAT-05`; `BAC-12`; `PRIN-01` | NOT STARTED |
| `[ ]` | **FR-CRM-09** | Merging duplicate member records with explicit field-level resolution. | C | `crm/` | B5.14 | Integration; audit per `BR-DAT-01` | NOT STARTED |
| `[ ]` | **FR-CRM-10** | Member code generation: unique, human-readable, per tenant. | S | `crm/` | B5.14 | Integration (uniqueness under concurrency); `memberships.membership_code` analogue | NOT STARTED |

### 8.17 `FR-STAF` — Staff, Roles & Permissions (§B5.15) — 9 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-STAF-01** | Invite staff by email or phone with role and branch assignment fixed at invitation. | M | `staff/` · `iam/` | B5.15 | Integration + E2E; `FR-AUTH-13`; `FR-RBAC-06`; `AC-STAF-01.1` | NOT STARTED |
| `[ ]` | **FR-STAF-02** | Roles available to a tenant: `GYM_MANAGER`, `RECEPTIONIST`, `TRAINER`, and additional `GYM_OWNER`. | M | `staff/` | B5.15 | Contract (negative — no platform role assignable by a tenant); §B3.1 role definitions | NOT STARTED |
| `[ ]` | **FR-STAF-03** | Branch scoping: a staff member sees and acts only within assigned branches. | M | `staff/` · `iam/` | B5.15 | Isolation + RBAC; `staff_branches`; `AC-STAF-01.1`; `AC-STAF-01.2` | NOT STARTED |
| `[ ]` | **FR-STAF-04** | Staff status: `INVITED`, `ACTIVE`, `SUSPENDED`, `REMOVED`. Removal revokes access immediately and preserves all historical attribution. | M | `staff/` | B5.15 | Integration; `AC-STAF-01.4`; `FR-RBAC-04` (≤60 s) | NOT STARTED |
| `[ ]` | **FR-STAF-05** | Staff activity log: check-ins performed, payments collected, members created, overrides used. | M | `staff/` · `audit/` | B5.15 | Integration; `AC-STAF-01.3`; tenant report *Staff activity*; `payments.collected_by_staff_id` | NOT STARTED |
| `[ ]` | **FR-STAF-06** | Seat limits enforced per subscription tier, with a clear upgrade path when exceeded. | M | `staff/` · `billing/` | B5.15 | Integration (negative — invitation beyond seat cap refused); §A6.2 tier seats; `SCR-DASH-018` guards | NOT STARTED |
| `[ ]` | **FR-STAF-07** | Trainer-specific: assigned member list, session scheduling, workout plan assignment. | S | `staff/` | B5.15 | Integration + RBAC; §B3.2 *Assign members to trainer*, *Create workout plan*; `OQ-15` | NOT STARTED |
| `[ ]` | **FR-STAF-08** | Shift or duty roster with attendance for staff themselves. | C | `staff/` | B5.15 | Integration | NOT STARTED |
| `[ ]` | **FR-STAF-09** | The last `GYM_OWNER` cannot be removed or demoted (`FR-RBAC-07`). | M | `staff/` | B5.15 | Integration (negative); `SCR-DASH-018` last-owner protection | NOT STARTED |

### 8.18 `FR-REV` — Reviews & Ratings (§B5.16) — 11 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-REV-01** | A review requires ≥1 recorded check-in at that gym (`BR-REV-01`). Eligibility is computed server-side; the compose UI is unreachable otherwise. | M | `reviews/` · `attendance/` | B5.16 | Contract (403) + E2E; `AC-REV-02.1`; `BAC-09`; `API-REV GET /gyms/:slug/reviews/eligibility` | NOT STARTED |
| `[ ]` | **FR-REV-02** | Review content: 1–5 star overall rating, optional sub-ratings (equipment, cleanliness, staff, crowd, value), free text 20–2000 characters, optional photos. | M | `reviews/` | B5.16 | Unit (boundaries 20/2000) + Contract; `reviews.sub_ratings`; validation library pending `A-02` | NOT STARTED |
| `[ ]` | **FR-REV-03** | Automated screening on submission for profanity, contact details, URLs, competitor solicitation and spam patterns; failures queue for moderation rather than rejecting outright. | M | `reviews/` | B5.16 | Unit (one case per signal) + Integration; `SMT-51` → `HELD`; `BR-REV-04` | NOT STARTED |
| `[ ]` | **FR-REV-04** | One review per member per gym per membership term; editable for 7 days with edit history retained (`BR-REV-02`). | M | `reviews/` | B5.16 | Integration (negative — second review in same term refused); `reviews.edit_history`; `SCR-WEB-013` | NOT STARTED |
| `[ ]` | **FR-REV-05** | The gym may respond once per review; responses are screened identically. | M | `reviews/` | B5.16 | Integration (negative — second response refused); `review_responses`; `AC-REV-01.1` | NOT STARTED |
| `[ ]` | **FR-REV-06** | The gym may report a review with a structured reason; reporting never removes it (`BR-REV-05`, `BR-REV-06`). | M | `reviews/` | B5.16 | Integration; `review_reports`; `AC-REV-01.3`; `RCT-04` | NOT STARTED |
| `[ ]` | **FR-REV-07** | Moderation queue for platform moderators with actions: publish, unpublish, request edit, permanently remove with reason. | M | `reviews/` · `admin/` | B5.16 | Integration + RBAC + E2E; `SCR-ADM-012`; `E2E-09`; `SM-06` | NOT STARTED |
| `[ ]` | **FR-REV-08** | Rating aggregation is Bayesian-adjusted for review count in ranking, but the displayed figure is the plain mean with the count (`BR-REV-07`). | M | `reviews/` · `discovery/` | B5.16 | Unit (both figures) + Integration; `JOB-12 review.aggregate`; `gyms.rating_avg`/`rating_count` | NOT STARTED |
| `[ ]` | **FR-REV-09** | Anomaly detection on rating velocity, reviewer account age, and clustering of similar text; anomalies queue for moderation and are excluded from ranking pending review. | S | `reviews/` | B5.16 | Integration; `AC-REV-02.2`; `JOB-13 review.anomaly-scan`; `RSK-02` | NOT STARTED |
| `[ ]` | **FR-REV-10** | A review prompt is sent after the member's third check-in, and once more at day 45 if not submitted. | S | `reviews/` · `notifications/` | B5.16 | Integration; `EVT-32 review_prompted`; `KPI-13` | NOT STARTED |
| `[ ]` | **FR-REV-11** | Members may delete their own review; the aggregate updates and the deletion is retained in audit. | M | `reviews/` · `audit/` | B5.16 | Contract + Integration; `API-REV DELETE /reviews/:id`; `AC-REV-02.3` (recalculation within one minute) | NOT STARTED |

### 8.19 `FR-CPN` — Coupons & Promotions (§B5.17) — 8 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-CPN-01** | Coupon attributes per `BR-CPN-01`, including `funding_source` (`PLATFORM` / `GYM`). | M | `ordering/` | B5.17 | Contract + Integration; `coupons` table; `SCR-DASH-016`; `OQ-11` | NOT STARTED |
| `[ ]` | **FR-CPN-02** | Scope: platform-wide coupons created by Super Admin; tenant coupons created by the owner and valid only at that tenant. | M | `ordering/` · `admin/` | B5.17 | Isolation + RBAC; `coupons.scope`; `BR-TEN-01` | NOT STARTED |
| `[ ]` | **FR-CPN-03** | Validation at apply time and again at payment initiation (`BR-CPN-03`). | M | `ordering/` · `payments/` | B5.17 | Integration (both points) + E2E; `E2E-06`; `EVT-17`, `EVT-18` | NOT STARTED |
| `[ ]` | **FR-CPN-04** | Usage tracking: total redemptions, per-user redemptions, value discounted, and attributable revenue. | M | `ordering/` | B5.17 | Integration; `coupon_redemptions`; `coupons.redemption_count`; `AC-CPN-01.2`, `AC-CPN-01.3` | NOT STARTED |
| `[ ]` | **FR-CPN-05** | Auto-generated unique codes for one-time use (e.g. win-back campaigns) in bulk. | S | `ordering/` | B5.17 | Integration (uniqueness at bulk scale) | NOT STARTED |
| `[ ]` | **FR-CPN-06** | First-purchase-only enforcement evaluated against the user's platform-wide order history. | M | `ordering/` | B5.17 | Integration (negative — user with prior completed order refused); `AC-CPN-01.1` | NOT STARTED |
| `[ ]` | **FR-CPN-07** | A coupon may be paused and resumed without deletion. | S | `ordering/` | B5.17 | Integration; `coupons.status`; `SCR-DASH-016` pause/resume | NOT STARTED |
| `[ ]` | **FR-CPN-08** | Coupon performance report: redemptions, discount cost, gross revenue influenced, and net after discount. | S | `reporting/` | B5.17 | Integration; tenant report *Coupon performance* | NOT STARTED |

### 8.20 `FR-REFR` — Referrals & Wallet (§B5.18) — 7 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-REFR-01** | Each member has a unique referral code and shareable link. | S | `crm/` · `web` | B5.18 | Integration (uniqueness) + E2E; `SCR-WEB-015` | NOT STARTED |
| `[ ]` | **FR-REFR-02** | Referral attribution on registration or first purchase, whichever occurs first, within a configurable window. | S | `crm/` | B5.18 | Unit (window boundaries) + Integration; `EVT-34 referral_shared`, `EVT-35 referral_converted` | NOT STARTED |
| `[ ]` | **FR-REFR-03** | Reward configuration: value to referrer and referee, as wallet credit or discount, funded by platform or tenant. | S | `crm/` · `ledger/` | B5.18 | Integration; funding parity with `BR-CPN-05` | NOT STARTED |
| `[ ]` | **FR-REFR-04** | Reward credited only after the referred member's first membership clears the refund window (`BR-RFL-01`). | S | `crm/` · `refunds/` | B5.18 | Integration; `AC-REFR-01.1`, `AC-REFR-01.2` | NOT STARTED |
| `[ ]` | **FR-REFR-05** | Referral dashboard for the member: invited, joined, rewards earned and pending. | S | `crm/` · `web` | B5.18 | E2E; `SCR-WEB-015` | NOT STARTED |
| `[ ]` | **FR-REFR-06** | Wallet: balance, transaction history, expiry, application at checkout before gateway charge (`BR-WAL-01`). | C | `ordering/` · `ledger/` | B5.18 | Unit + Integration; `/account/wallet` (Phase 2 surface) | NOT STARTED |
| `[ ]` | **FR-REFR-07** | Self-referral and circular referral detection and prevention. | S | `crm/` | B5.18 | Integration (negative); `AC-REFR-01.3` | NOT STARTED |

### 8.21 `FR-NOTF` — Notifications (§B5.19) — 8 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-NOTF-01** | Channels: email, SMS, in-app notification centre, and web push. Each channel is an adapter behind a common interface. | M | `notifications/` | B5.19 | Unit + architecture fitness test (no vendor import in domain code); `DEP-03`, `DEP-04`, `DEP-06`; vendors pending `A-19` (blocked on `OQ-01`) | NOT STARTED |
| `[ ]` | **FR-NOTF-02** | Categories: transactional (never opt-out), operational reminders (opt-out), marketing (opt-in). | M | `notifications/` | B5.19 | Integration (negative — transactional cannot be suppressed); `AC-USER-01.1`, `AC-USER-01.2` | NOT STARTED |
| `[ ]` | **FR-NOTF-03** | Templates are versioned, previewable, and editable by Super Admin without deployment; tenant-level overrides where the tier permits. | M | `notifications/` · `admin/` | B5.19 | Integration; `REF-11 notification_templates`; `SCR-ADM-011`; `SCR-DASH-021` | NOT STARTED |
| `[ ]` | **FR-NOTF-04** | Delivery is queued, retried with backoff, and every attempt is logged with provider response. | M | `notifications/` | B5.19 | Integration; `notification_log.attempts`/`last_error`; Redis 7 + BullMQ per §C1.1; `JOB-19 notification.dispatch` | NOT STARTED |
| `[ ]` | **FR-NOTF-05** | Per-user, per-channel quiet hours in the recipient's timezone for non-transactional messages. | S | `notifications/` | B5.19 | Unit (timezone) + Integration | NOT STARTED |
| `[ ]` | **FR-NOTF-06** | Rate limiting per recipient per category to prevent notification storms. | M | `notifications/` | B5.19 | Integration; `RSK-12` mitigation; rate-limit library pending `A-13` | NOT STARTED |
| `[ ]` | **FR-NOTF-07** | In-app notification centre with read/unread state on all three surfaces. | S | `notifications/` · `web` · `dash` · `admin` | B5.19 | Contract + E2E; `API-NOTF GET /me/notifications`, `POST /me/notifications/:id/read` | NOT STARTED |
| `[ ]` | **FR-NOTF-08** | A cost report per channel per period for Finance. | S | `notifications/` · `reporting/` | B5.19 | Integration; `RSK-12`; §A6.5 unit economics | NOT STARTED |

### 8.22 `FR-RPT` — Reports & Analytics (§B5.20) — 5 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-RPT-01** | Every report supports a date range, branch filter, on-screen rendering, CSV export and, where meaningful, a chart. | M | `reporting/` | B5.20 | Integration (per report in both catalogues) + E2E; `SCR-DASH-020`; `SCR-ADM-014` | NOT STARTED |
| `[ ]` | **FR-RPT-02** | Reports read from data no more than 15 minutes stale; financial reports read from the ledger and are always current. | M | `reporting/` · `ledger/` | B5.20 | Integration (staleness assertion); `PRIN-03`; `NFR-PERF-06` | NOT STARTED |
| `[ ]` | **FR-RPT-03** | Exports over a size threshold are generated asynchronously and delivered by notification with a time-limited download link. | S | `reporting/` | B5.20 | Integration; `JOB-21 export.generate`; `NFR-PERF-06`; `202 Accepted` per §C3.1 | NOT STARTED |
| `[ ]` | **FR-RPT-04** | Scheduled report delivery by email (daily, weekly, monthly). | S | `reporting/` · `notifications/` | B5.20 | Integration; `JOB-20 report.scheduled-delivery` | NOT STARTED |
| `[ ]` | **FR-RPT-05** | Every figure on a report is traceable: clicking a total reveals its constituent records. | S | `reporting/` | B5.20 | E2E; `AC-RPT-01.2`; persona §B2.5 *nothing is recomputed at display time* | NOT STARTED |

### 8.23 `FR-SETL` — Settlements & Payouts (§B5.21) — 10 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-SETL-01** | A settlement batch is created per tenant per cycle, containing every eligible transaction since the last batch. | M | `settlements/` | B5.21 | Integration + E2E; `JOB-09 settlement.build-batches`; `E2E-12`; `settlement_batches` | NOT STARTED |
| `[ ]` | **FR-SETL-02** | Each batch line carries gross, discount, net, tax, commission base, commission, gateway fee and payable — all persisted, never recomputed at display (§A6.3). | M | `settlements/` | B5.21 | Integration; `settlement_lines`; `BR-FIN-02`; `AC-SETL-01.1` | NOT STARTED |
| `[ ]` | **FR-SETL-03** | Refunds and chargebacks appear as negative lines in the batch in which they are recognised. | M | `settlements/` · `ledger/` | B5.21 | Integration + E2E; `AC-SETL-01.2`; `E2E-07`, `E2E-08`, `E2E-12` | NOT STARTED |
| `[ ]` | **FR-SETL-04** | Reserve is withheld per configuration and released on schedule as a separate visible line. | M | `settlements/` | B5.21 | Integration; `AC-SETL-01.3`; `JOB-11 reserve.release`; `tenants.reserve_bps` default 500; `OQ-04` | NOT STARTED |
| `[ ]` | **FR-SETL-05** | Batches below the minimum payout roll forward with the reason shown to the tenant. | M | `settlements/` | B5.21 | Integration; §A6.4 *Minimum payout*; `SCR-DASH-014` | NOT STARTED |
| `[ ]` | **FR-SETL-06** | Payout requires Finance approval unless auto-payout is enabled for the tenant and the batch is below the auto-approval threshold. | M | `settlements/` | B5.21 | Integration + RBAC; `BR-FIN-08`; `SCR-ADM-007`; `SMT-60` | NOT STARTED |
| `[ ]` | **FR-SETL-07** | The tenant sees every batch, its lines and its status (`PENDING`, `APPROVED`, `PROCESSING`, `PAID`, `FAILED`, `ON_HOLD`), plus a downloadable statement. | M | `settlements/` · `dash` | B5.21 | Contract + E2E; `SCR-DASH-014`; `API-TEN GET /tenant/settlements` | NOT STARTED |
| `[ ]` | **FR-SETL-08** | Payout failure (bank rejection) returns the batch to `PENDING` with the failure reason and notifies both the tenant and Finance. | M | `settlements/` · `notifications/` | B5.21 | Integration; `SMT-63`, `SMT-64`; `SCR-DASH-001` alert *payout failures* | NOT STARTED |
| `[ ]` | **FR-SETL-09** | Daily reconciliation compares gateway settlement reports to the internal ledger and raises an alert on any variance (`KPI-26`). | M | `settlements/` · `ledger/` | B5.21 | Integration + E2E; `JOB-10 settlement.reconcile`; `BR-FIN-07`; `E2E-12`; `SCR-ADM-010` | NOT STARTED |
| `[ ]` | **FR-SETL-10** | A negative balance carries forward and is recovered from subsequent batches; persistent negative balance beyond a threshold triggers tenant review. | M | `settlements/` | B5.21 | Integration; `AC-SETL-01.4`; §A6.4 *Negative balance* | NOT STARTED |

### 8.24 `FR-RFND` — Refunds & Disputes (§B5.22) — 11 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-RFND-01** | Refund request origination: member (through support or self-service where policy permits), gym staff, or platform staff. | M | `refunds/` | B5.22 | Contract + RBAC; `refunds.requester_type`; §B3.2 *Request refund* | NOT STARTED |
| `[ ]` | **FR-RFND-02** | The applicable policy is the one stored on the order (`BR-REF-02`) and is displayed alongside the request. | M | `refunds/` | B5.22 | Integration; `orders.refund_policy_snapshot`; `SCR-DASH-015` | NOT STARTED |
| `[ ]` | **FR-RFND-03** | Automatic eligibility evaluation: within window, usage below threshold, value below threshold → auto-approve; otherwise route to Super Admin. | M | `refunds/` | B5.22 | Unit (three thresholds) + E2E; `AC-RFND-01.1`, `AC-RFND-01.2`; `E2E-07`; `SM-05` | NOT STARTED |
| `[ ]` | **FR-RFND-04** | Refund amount computation: full, or pro-rata on unconsumed duration or sessions, less any stated cancellation fee, with the computation shown to all parties. | M | `refunds/` | B5.22 | Unit (proration matrix) + E2E; `refunds.computation`; `AC-RFND-01.2` | NOT STARTED |
| `[ ]` | **FR-RFND-05** | Refund execution to the original instrument only (`BR-REF-04`), with gateway reference retained. | M | `refunds/` · `payments/` | B5.22 | Integration (negative — alternative instrument refused); `refunds.provider_refund_id` | NOT STARTED |
| `[ ]` | **FR-RFND-06** | Membership state moves to `REFUNDED` (full) or is adjusted (partial); QR access revokes immediately on full refund. | M | `refunds/` · `memberships/` · `attendance/` | B5.22 | Integration + E2E; `AC-RFND-01.3`; `E2E-07`; `SMT-10` | NOT STARTED |
| `[ ]` | **FR-RFND-07** | A credit note is issued and the ledger reversal entries are written, including proportional commission reversal (`BR-REF-05`). | M | `refunds/` · `billing/` · `ledger/` | B5.22 | Integration + E2E; `E2E-07`, `E2E-12`; ledger `REFUND` + `COMMISSION_REVERSAL` | NOT STARTED |
| `[ ]` | **FR-RFND-08** | Dispute (chargeback) intake from the gateway webhook, creating a case with an evidence deadline and a checklist of evidence to assemble. | M | `refunds/` · `payments/` | B5.22 | Integration; `AC-RFND-02.1`; `disputes.evidence_due_at`; `BR-REF-08` | NOT STARTED |
| `[ ]` | **FR-RFND-09** | Automatic evidence pack assembly: order, invoice, payment record, attendance records, terms accepted, and communication log. | S | `refunds/` | B5.22 | Integration; `AC-RFND-02.2`; `SCR-ADM-009`; `RSK-05` mitigation | NOT STARTED |
| `[ ]` | **FR-RFND-10** | Disputed amounts are held against the tenant balance from case opening (`BR-REF-08`). | M | `refunds/` · `ledger/` | B5.22 | Integration + E2E; ledger `CHARGEBACK` / `CHARGEBACK_REVERSAL`; `AC-RFND-02.3` | NOT STARTED |
| `[ ]` | **FR-RFND-11** | Refund and dispute history is visible on the member record, the order, and the tenant's financial views. | M | `refunds/` · `crm/` | B5.22 | Contract + E2E; `SCR-DASH-008` region 2; `SCR-DASH-011` detail drawer; `SCR-WEB-011` | NOT STARTED |

### 8.25 `FR-SUP` — Support & Ticketing (§B5.23) — 7 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-SUP-01** | Ticket creation by members and by tenants, with category, description and attachments. | S | `support/` | B5.23 | Contract + E2E; `API-SUP POST /support/tickets`; `SCR-WEB-017`; `NFR-SEC-10` on attachments | NOT STARTED |
| `[ ]` | **FR-SUP-02** | Contextual ticket creation from an order, membership, payment or check-in, auto-attaching the relevant references. | S | `support/` | B5.23 | Integration; `SCR-WEB-017`; linked-entity assertion | NOT STARTED |
| `[ ]` | **FR-SUP-03** | Agent console with queue, assignment, priority, internal notes, canned responses and full customer context. | S | `support/` · `admin` | B5.23 | E2E + RBAC; `SCR-ADM-013` | NOT STARTED |
| `[ ]` | **FR-SUP-04** | Status lifecycle: `OPEN`, `IN_PROGRESS`, `WAITING_ON_CUSTOMER`, `RESOLVED`, `CLOSED`. | S | `support/` | B5.23 | Unit (state machine) + Integration | NOT STARTED |
| `[ ]` | **FR-SUP-05** | SLA timers per priority with breach alerting (`KPI-25`). | S | `support/` | B5.23 | Integration; `NFR-MNT-06` alerting; `OQ-19` default 4-hour first response | NOT STARTED |
| `[ ]` | **FR-SUP-06** | Self-service help centre with articles mapped to the ten most common issues (`OBJ-10`). | S | `support/` · `web` | B5.23 | Contract + E2E; `API-SUP GET /help/articles`, `/help/articles/:slug` | NOT STARTED |
| `[ ]` | **FR-SUP-07** | Satisfaction rating on resolution. | C | `support/` | B5.23 | Integration | NOT STARTED |

### 8.26 `FR-ADMN` — Platform Administration & Audit (§B5.24) — 13 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FR-ADMN-01** | Tenant administration: search, view, suspend, reinstate, change tier, override commission, adjust settlement cycle, and force re-verification. | M | `admin/` | B5.24 | Contract + RBAC + E2E; `SCR-ADM-004` actions; `UAT-06`; `BR-TEN-05` | NOT STARTED |
| `[ ]` | **FR-ADMN-02** | Every administrative action requires a reason and is written to the audit log. | M | `admin/` · `audit/` | B5.24 | Integration (negative — action without reason refused); `BR-DAT-01`; `PRIN-07` | NOT STARTED |
| `[ ]` | **FR-ADMN-03** | Commission configuration at three levels with clear precedence: global default < tier < tenant override. The effective rate for any tenant is displayed with its source. | M | `admin/` · `settlements/` | B5.24 | Unit (precedence) + E2E; `AC-ADMN-01.1`, `AC-ADMN-01.2`, `AC-ADMN-01.3`; `BR-FIN-05` | NOT STARTED |
| `[ ]` | **FR-ADMN-04** | Subscription tier configuration: limits, features, prices. | M | `admin/` · `billing/` | B5.24 | Integration; `REF-06 subscription_tiers`; §A6.2; `OQ-03` | NOT STARTED |
| `[ ]` | **FR-ADMN-05** | Tax profile configuration per country: rates, inclusive/exclusive, rounding, invoice field requirements. | M | `admin/` · `billing/` | B5.24 | Unit + Integration; `REF-07 tax_profiles`; `FR-INV-05`; `OBJ-09` | NOT STARTED |
| `[ ]` | **FR-ADMN-06** | KYC checklist configuration per country: document types, mandatory flags, validity rules. | M | `admin/` · `onboarding/` | B5.24 | Integration; `REF-08 kyc_checklists`; `FR-ONB-03`; `OQ-01` | NOT STARTED |
| `[ ]` | **FR-ADMN-07** | Taxonomy management: amenities, categories, cities and localities, rejection reason codes, refund reason codes, denial reason codes. | M | `admin/` | B5.24 | Integration + RBAC; `REF-02` … `REF-05`, `REF-09`; `RCT-01` … `RCT-05`; `NFR-DQ-06` | NOT STARTED |
| `[ ]` | **FR-ADMN-08** | Feature flags with targeting by tenant, by role and by percentage rollout, changeable without deployment. | M | `admin/` · `common/` | B5.24 | Integration; `REF-10 feature_flags`; §C1.5 *Feature flags*; `NFR-MNT-07` | NOT STARTED |
| `[ ]` | **FR-ADMN-09** | Audit log explorer: filter by actor, entity type, entity id, action, date range; view before/after state; export. | M | `admin/` · `audit/` | B5.24 | Contract + E2E; `SCR-ADM-015`; `AC-ADMN-02.1`, `AC-ADMN-02.2`; `BAC-13` | NOT STARTED |
| `[ ]` | **FR-ADMN-10** | Platform staff administration: invite, role assignment, MFA enforcement, session revocation. | M | `admin/` · `iam/` | B5.24 | Integration + RBAC; `NFR-SEC-11`; `API-ADM /admin/staff` | NOT STARTED |
| `[ ]` | **FR-ADMN-11** | Verification queue management: assignment, SLA monitoring, workload distribution. | M | `admin/` · `onboarding/` | B5.24 | Integration + E2E; `SCR-ADM-002` SLA; platform report *Verification SLA*; `UAT-04` | NOT STARTED |
| `[ ]` | **FR-ADMN-12** | Content moderation queues for reviews, gym photos and descriptions, and user reports. | M | `admin/` · `reviews/` · `catalog/` | B5.24 | Integration + E2E; `SCR-ADM-012`; `E2E-09`; `BR-GYM-07` | NOT STARTED |
| `[ ]` | **FR-ADMN-13** | A read-only "system health" view: queue depths, webhook failure counts, reconciliation status, job failures. | S | `admin/` | B5.24 | Integration; `NFR-MNT-06`; `SCR-ADM-001` system health strip; queue observability pending `A-30` | NOT STARTED |

---

## 9. Non-Functional Requirements — 68 identifiers across 8 families

**Source:** §B9. The PRD's NFR tables carry **no MoSCoW column**, so the `Pri` cell reads `—` for
every row and these rows are excluded from the launch-blocking subtotal in §2.3. That is a counting
convention, not a licence to skip them: `BAC-11` makes `NFR-PERF-01` … `NFR-PERF-05` an explicit
business acceptance condition, `BAC-10` does the same for `NFR-SEC-09`, and §C7's *non-negotiable
gates* make `NFR-MNT-01` and `NFR-SEC-08` merge blockers.

**Family counts:** `NFR-PERF` ×10 · `NFR-SCAL` ×6 · `NFR-AVL` ×8 · `NFR-SEC` ×13 · `NFR-PRV` ×7 ·
`NFR-USE` ×9 · `NFR-MNT` ×9 · `NFR-DQ` ×6 = **68**.

### 9.1 `NFR-PERF` — Performance (§B9.1) — 10 items

| `[ ]` | ID | Requirement (target · measurement) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **NFR-PERF-01** | **Marketplace search response** — p95 ≤ 500 ms, p99 ≤ 1000 ms. Measured by server-side timing, excluding client render. | — | `discovery/` | B9.1 | Performance (§C8.1) before each major release; `BAC-11`; `KPI-23`; sprint 3–4 exit condition | NOT STARTED |
| `[ ]` | **NFR-PERF-02** | **Gym detail page — Largest Contentful Paint** — ≤ 2.5 s on a 4G connection. Measured by field data (RUM). | — | `web` | B9.1 | Performance + RUM; `BAC-11`; `SCR-WEB-003` | NOT STARTED |
| `[ ]` | **NFR-PERF-03** | **Check-in scan to confirmation** — p95 ≤ 2 s end to end. Client-observed. | — | `attendance/` · `dash` | B9.1 | Performance; `BAC-11`; `KPI-24`; `AC-CHK-01.1`; sprint 8 exit condition | NOT STARTED |
| `[ ]` | **NFR-PERF-04** | **Dashboard list views (≤50 rows)** — p95 ≤ 800 ms. Server-side. | — | `dash` · `crm/` | B9.1 | Performance; `BAC-11`; `SCR-DASH-007` (50 per page, virtualised) | NOT STARTED |
| `[ ]` | **NFR-PERF-05** | **Payment intent creation** — p95 ≤ 1.5 s. Server-side, excluding gateway. | — | `payments/` | B9.1 | Performance; `BAC-11`; `API-PAY POST /orders/:ref/payment-intent` | NOT STARTED |
| `[ ]` | **NFR-PERF-06** | **Report generation (≤12 months)** — ≤ 5 s synchronous; beyond that asynchronous with notification. Server-side. | — | `reporting/` | B9.1 | Performance; `FR-RPT-03`; `JOB-21 export.generate` | NOT STARTED |
| `[ ]` | **NFR-PERF-07** | **Invoice PDF generation** — ≤ 3 s. Server-side. | — | `billing/` | B9.1 | Performance; `FR-INV-07`; headless-Chromium renderer per §C1.1 | NOT STARTED |
| `[ ]` | **NFR-PERF-08** | **Concurrent check-ins** — 500/minute platform-wide without degradation. Load test. | — | `attendance/` | B9.1 | Performance (load); token verification cost drives the QR signing choice pending `A-11` | NOT STARTED |
| `[ ]` | **NFR-PERF-09** | **Concurrent searches** — 2,000/minute sustained. Load test. | — | `discovery/` | B9.1 | Performance (load + soak); `NFR-SCAL-04` read replicas and cache | NOT STARTED |
| `[ ]` | **NFR-PERF-10** | **Web bundle** — initial JS ≤ 200 KB gzipped for the customer site. Build budget enforced in CI. | — | `web` | B9.1 | CI build-budget gate; bundle-size tool pending `A-29` | NOT STARTED |

### 9.2 `NFR-SCAL` — Scalability (§B9.2) — 6 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **NFR-SCAL-01** | Year-1 capacity: 2,000 tenants, 5,000 branches, 500,000 users, 100,000 concurrent-eligible memberships, 50,000 check-ins/day. | — | platform-wide | B9.2 | Performance (load at stated capacity); `OQ-18` capacity planning inputs | NOT STARTED |
| `[ ]` | **NFR-SCAL-02** | Year-3 headroom without re-architecture: 10× the above. | — | platform-wide | B9.2 | Architecture review + capacity model; §C1.4 migration path to schema-per-tenant | NOT STARTED |
| `[ ]` | **NFR-SCAL-03** | Application tier is stateless and horizontally scalable; no session affinity. | — | `common/` | B9.2 | Integration (node-kill under load) + architecture fitness test; constrains the real-time transport pending `A-08` | NOT STARTED |
| `[ ]` | **NFR-SCAL-04** | Read-heavy marketplace traffic is served from read replicas and cache; writes never contend with search. | — | `discovery/` · `common/` | B9.2 | Performance (soak with concurrent writes); Redis 7 cache per §C1.1 | NOT STARTED |
| `[ ]` | **NFR-SCAL-05** | Background work (notifications, reports, reconciliation, expiry) runs on a separate worker tier that cannot starve request handling. | — | worker tier | B9.2 | Performance (saturate workers, assert API latency holds); §C1.2 worker tier; BullMQ per §C1.1 | NOT STARTED |
| `[ ]` | **NFR-SCAL-06** | Database growth is bounded by partitioning attendance and audit tables by time. | — | `attendance/` · `audit/` | B9.2 | Integration; `IDX-20`, `IDX-21` partition declarations; `JOB-24 audit.partition-maintenance` | NOT STARTED |

### 9.3 `NFR-AVL` — Availability and resilience (§B9.3) — 8 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **NFR-AVL-01** | Core API monthly availability ≥ 99.9%. | — | platform-wide | B9.3 | Synthetic monitoring + SLO report; `KPI-22` | NOT STARTED |
| `[ ]` | **NFR-AVL-02** | Check-in and payment paths are the highest-priority services and degrade last. | — | `attendance/` · `payments/` | B9.3 | Integration (fault injection with prioritised degradation); `PRIN-06` | NOT STARTED |
| `[ ]` | **NFR-AVL-03** | Loss of maps, search indexing, notifications or analytics must not prevent check-in, purchase or payment. | — | platform-wide | B9.3 | Integration (fault injection per dependency); `AC-SRCH-02.3`; `DEP-02`, `DEP-03`, `DEP-04`, `DEP-06` | NOT STARTED |
| `[ ]` | **NFR-AVL-04** | RPO ≤ 15 minutes; RTO ≤ 4 hours. | — | platform ops | B9.3 | Disaster-recovery drill with measured RPO/RTO | NOT STARTED |
| `[ ]` | **NFR-AVL-05** | Automated daily backups with monthly restore verification; **a restore that has never been tested is not a backup**. | — | platform ops | B9.3 | Monthly automated restore verification job with recorded evidence | NOT STARTED |
| `[ ]` | **NFR-AVL-06** | Zero-downtime deployment; database migrations are backward-compatible within a release window. | — | platform ops | B9.3 · C7 | CI/CD pipeline test (deploy under traffic); migration tool pending `A-07` | NOT STARTED |
| `[ ]` | **NFR-AVL-07** | Circuit breakers on every third-party call with defined fallback behaviour. | — | `common/` | B9.3 | Integration (breaker open/half-open/closed per dependency); `DEP-01` … `DEP-08` | NOT STARTED |
| `[ ]` | **NFR-AVL-08** | Scheduled maintenance windows are announced in-product 72 hours ahead and never scheduled during peak gym hours in any served timezone. | — | `notifications/` · platform ops | B9.3 | Process check + Integration (in-product announcement 72 h ahead); peak hours from `FR-CHK-13` heatmap | NOT STARTED |

### 9.4 `NFR-SEC` — Security (§B9.4) — 13 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **NFR-SEC-01** | TLS 1.2+ in transit; AES-256 at rest for database, object storage and backups. | — | platform ops | B9.4 | Security (config scan + DAST) | NOT STARTED |
| `[ ]` | **NFR-SEC-02** | KYC documents and identity images are encrypted with a separate key and access-logged per `BR-DAT-07`. | — | `onboarding/` · `audit/` | B9.4 | Security + Integration; separate bucket and key per §C1.1; `kyc_documents.storage_key` | NOT STARTED |
| `[ ]` | **NFR-SEC-03** | No cardholder data touches platform infrastructure; the integration is designed to minimise PCI DSS scope to SAQ-A. | — | `payments/` | B9.4 | Security (SAST + log scan) + scope assessment; `BR-PAY-08`; `FR-PAY-09` | NOT STARTED |
| `[ ]` | **NFR-SEC-04** | OWASP Top 10 controls verified by automated scanning in CI and by an independent penetration test before launch and annually thereafter. | — | platform-wide | B9.4 | Security (SAST + DAST in CI); annual penetration test; sprint 16 hardening | NOT STARTED |
| `[ ]` | **NFR-SEC-05** | All input is validated server-side against a schema; output encoding prevents injection in every rendering context. | — | `common/` · all modules | B9.4 | Contract + Security; validation library pending `A-02`; per-context output encoding tests | NOT STARTED |
| `[ ]` | **NFR-SEC-06** | Rate limiting per IP, per user and per endpoint class, with stricter limits on auth, OTP and payment endpoints. | — | `common/` | B9.4 · C1.5 | Integration (per class) + Security; Redis token bucket per §C1.5; library pending `A-13` | NOT STARTED |
| `[ ]` | **NFR-SEC-07** | Secrets are held in a managed secret store, never in source control, environment files in repositories, or logs. | — | platform ops | B9.4 | CI secret scanning on every commit; secret-scan tooling pending `A-25` | NOT STARTED |
| `[ ]` | **NFR-SEC-08** | Dependency vulnerability scanning on every build; critical vulnerabilities block release. | — | platform ops | B9.4 · C7 | CI gate (§C7 *zero critical vulnerabilities*); scanners pending `A-25` | NOT STARTED |
| `[ ]` | **NFR-SEC-09** | Tenant isolation is enforced at the database level by row-level security, not solely in application code, and is proven by an automated isolation test suite in CI (`BAC-10`). | — | `tenancy/` | B9.4 · C1.4 | Isolation suite on 100% of tenant-scoped endpoints; `E2E-11`; `BAC-10`; `BR-TEN-01` | NOT STARTED |
| `[ ]` | **NFR-SEC-10** | Uploaded files are type-validated by content inspection, size-limited, virus-scanned, stripped of metadata, and served from a separate origin. | — | `catalog/` · `onboarding/` · `support/` | B9.4 | Security + Integration (one negative per control); `FR-GYM-02` EXIF stripping | NOT STARTED |
| `[ ]` | **NFR-SEC-11** | MFA is mandatory for all platform staff roles. | — | `iam/` | B9.4 | Integration (negative — staff login without MFA refused); `FR-AUTH-07`; `FR-ADMN-10` | NOT STARTED |
| `[ ]` | **NFR-SEC-12** | Security headers: HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. | — | `common/` · `web` · `dash` · `admin` | B9.4 | Security (header assertion per surface, one test per header) | NOT STARTED |
| `[ ]` | **NFR-SEC-13** | Audit logs are append-only and stored where application credentials cannot alter them. | — | `audit/` | B9.4 · C1.5 | Integration (no `UPDATE`/`DELETE` grant for the application role); `AC-ADMN-02.3`; `BR-DAT-01` | NOT STARTED |

### 9.5 `NFR-PRV` — Privacy and compliance (§B9.5) — 7 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **NFR-PRV-01** | Data collection is minimised to what a stated purpose requires; every field in the schema has a documented purpose. | — | all modules | B9.5 | Schema review gate in `/docs/database/Schema.md`; every column carries a purpose | NOT STARTED |
| `[ ]` | **NFR-PRV-02** | Consent for marketing is explicit, granular, timestamped and revocable. | — | `iam/` · `notifications/` | B9.5 | Integration; `FR-USER-04`; `AC-USER-01.1`, `AC-USER-01.3` | NOT STARTED |
| `[ ]` | **NFR-PRV-03** | Data subject access, correction, export and deletion requests are supported within the statutory window. | — | `iam/` | B9.5 | Integration; `BR-DAT-03`, `BR-DAT-04`; `FR-USER-06`, `FR-USER-07` | NOT STARTED |
| `[ ]` | **NFR-PRV-04** | Retention: operational data retained while the account is active plus 12 months; financial records for the statutory period; audit logs 7 years; KYC documents for the statutory period after tenant closure. | — | all modules | B9.5 | Integration; `JOB-23 data.retention-sweep`; `CON-04` | NOT STARTED |
| `[ ]` | **NFR-PRV-05** | Data residency is configurable per deployment region. | — | platform ops | B9.5 | Deployment configuration test; `OQ-16`; `RSK-13` mitigation | NOT STARTED |
| `[ ]` | **NFR-PRV-06** | Sub-processors are documented and disclosed in the privacy policy. | — | platform ops | B9.5 | Documentation gate; `DEP-01` … `DEP-08`; `ASM-05` (client supplies legal copy) | NOT STARTED |
| `[ ]` | **NFR-PRV-07** | Health and fitness information is treated as a sensitive category with restricted access and no marketing use. | — | `iam/` · `crm/` · `notifications/` | B9.5 | Integration (negative — excluded from segmentation); `FR-USER-02`, `FR-USER-03` | NOT STARTED |

### 9.6 `NFR-USE` — Usability and accessibility (§B9.6) — 9 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **NFR-USE-01** | WCAG 2.1 Level AA on the customer website and the check-in desk; Level A minimum elsewhere, with AA as the target. | — | `web` · `dash` · `admin` | B9.6 | Accessibility (§C8.1): automated axe checks plus manual keyboard and screen-reader passes | NOT STARTED |
| `[ ]` | **NFR-USE-02** | Full keyboard operability on all dashboard and admin surfaces. | — | `dash` · `admin` | B9.6 | Accessibility (manual keyboard pass per screen); `SCR-DASH-009` ergonomics | NOT STARTED |
| `[ ]` | **NFR-USE-03** | Minimum touch target 44×44 px on all touch surfaces. | — | `web` · `dash` · `admin` | B9.6 | Accessibility (automated measurement) | NOT STARTED |
| `[ ]` | **NFR-USE-04** | Text contrast ≥ 4.5:1; interactive element contrast ≥ 3:1. | — | design tokens · all surfaces | B9.6 | Accessibility (automated contrast audit over the token palette) | NOT STARTED |
| `[ ]` | **NFR-USE-05** | Every error message states what happened, why, and what to do next, in the user's language, never an error code alone. | — | all surfaces · `common/` | B9.6 | E2E (error copy assertion per error code in the §C1.5 error model); `FR-CHK-06` | NOT STARTED |
| `[ ]` | **NFR-USE-06** | Every destructive action requires confirmation and states its consequence specifically ("this will archive a plan held by 34 active members"). | — | `dash` · `admin` | B9.6 | E2E per destructive action; `SCR-DASH-006` guards; `FR-PLAN-08` | NOT STARTED |
| `[ ]` | **NFR-USE-07** | Responsive from 320 px to 2560 px with no horizontal scrolling. | — | `web` · `dash` · `admin` | B9.6 | E2E (viewport matrix at 320 / 768 / 1024 / 1440 / 2560 px) | NOT STARTED |
| `[ ]` | **NFR-USE-08** | All user-facing strings are externalised for translation from the first commit. | — | all surfaces | B9.6 | Architecture fitness test (no literal user-facing string in components); `ASM-07`; §A4.2 *Multi-language UI* | NOT STARTED |
| `[ ]` | **NFR-USE-09** | The check-in desk is operable one-handed on a tablet at arm's length. | — | `dash` | B9.6 | Accessibility + `UAT-02` (simulated peak hour, 20 check-ins); `SCR-DASH-009` | NOT STARTED |

### 9.7 `NFR-MNT` — Maintainability and operability (§B9.7) — 9 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **NFR-MNT-01** | Unit test coverage ≥ 80% overall and ≥ 95% on payment, settlement, membership state and tenancy isolation code. | — | platform-wide | B9.7 · C7 | CI coverage gate (§C7 non-negotiable gates); test runners pending `A-06` | NOT STARTED |
| `[ ]` | **NFR-MNT-02** | The API is versioned; a breaking change requires a new version with a published deprecation period. | — | `common/` | B9.7 · C3.1 | Contract; URL versioning `/v1`; ≥6 months' deprecation per §C3.1 | NOT STARTED |
| `[ ]` | **NFR-MNT-03** | OpenAPI specification generated from code and published; drift between code and specification fails CI. | — | `common/` | B9.7 | CI drift gate; OpenAPI generation pending `A-16` | NOT STARTED |
| `[ ]` | **NFR-MNT-04** | Structured JSON logging with a correlation id propagated across services and into background jobs. | — | `common/` | B9.7 · C1.5 | Integration (correlation id present end to end including workers); logging library pending `A-14`; `BR-DAT-06` redaction | NOT STARTED |
| `[ ]` | **NFR-MNT-05** | Distributed tracing on all request paths. | — | `common/` | B9.7 | Integration; OpenTelemetry per §C1.1 | NOT STARTED |
| `[ ]` | **NFR-MNT-06** | Alerting on: error rate, latency percentiles, queue depth, webhook failures, payment success rate, reconciliation variance, job failures. | — | platform ops | B9.7 | Integration (one alert rule per named signal — seven rules); `FR-ADMN-13` | NOT STARTED |
| `[ ]` | **NFR-MNT-07** | Feature flags for all significant new functionality, enabling dark launch and instant rollback. | — | `common/` · `admin/` | B9.7 | Integration; `FR-ADMN-08`; §C1.5 *Feature flags* | NOT STARTED |
| `[ ]` | **NFR-MNT-08** | Infrastructure as code; no manual production changes. | — | platform ops | B9.7 · C1.1 | Drift detection against IaC state; IaC tool pending `A-27` | NOT STARTED |
| `[ ]` | **NFR-MNT-09** | Every module has a runbook covering its top three failure modes. | — | all 23 §C1.3 modules | B9.7 | Documentation gate: 23 runbooks × 3 failure modes, reviewed before launch | NOT STARTED |

### 9.8 `NFR-DQ` — Data quality (§B9.8) — 6 items

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **NFR-DQ-01** | Referential integrity enforced by database constraints, not application convention alone. | — | all modules | B9.8 | Integration (constraint violation attempted at the database layer); schema review | NOT STARTED |
| `[ ]` | **NFR-DQ-02** | Monetary values as integers in minor units with an explicit currency column adjacent (`BR-PAY-01`). | — | all financial modules | B9.8 | Schema assertion + architecture fitness test; §C1.5 *Money*; lint forbids `number` for amount fields | NOT STARTED |
| `[ ]` | **NFR-DQ-03** | All timestamps stored in UTC with the applicable timezone stored alongside where local interpretation matters. | — | all modules | B9.8 · C1.5 | Schema assertion + Unit; `BR-MEM-03`; `tenants.timezone` | NOT STARTED |
| `[ ]` | **NFR-DQ-04** | Soft deletion for all business entities; hard deletion only through documented data-subject processes. | — | all modules | B9.8 | Schema assertion (`deleted_at` present) + Integration; `BR-TEN-04`; `BR-DAT-04` | NOT STARTED |
| `[ ]` | **NFR-DQ-05** | Every table carries `created_at`, `updated_at`, `created_by`, `updated_by`. | — | all modules | B9.8 · C2.2 | Schema assertion across all 46 tables (§C2.2 + §C2.3 + §C2.1 ERD entities) | NOT STARTED |
| `[ ]` | **NFR-DQ-06** | Reference data (amenities, categories, cities) is platform-managed with stable identifiers; free-text alternatives are not offered where filtering depends on the value. | — | `admin/` · `catalog/` | B9.8 | Contract (negative — free-text amenity refused); `FR-GYM-03`; `FR-ADMN-07` | NOT STARTED |

---

## 10. User Stories and Acceptance Criteria — 38 `US-` and 129 `AC-`

**Source:** §B5.1 … §B5.24. Every user story is a tickable row, and every acceptance criterion nested
beneath it is a separately tickable row carrying its **full Given/When/Then text**. A `US-` row may
only be ticked when **all** of its `AC-` rows are ticked — a story is not "mostly done".

**Story counts by module:** `AUTH` ×3 · `USER` ×2 · `ONB` ×3 · `GYM` ×2 · `PLAN` ×2 · `SRCH` ×2 ·
`DETL` ×2 · `FAV` ×1 · `CART` ×2 · `PAY` ×2 · `INV` ×1 · `MEMB` ×2 · `CHK` ×2 · `CRM` ×1 · `STAF` ×1 ·
`REV` ×2 · `CPN` ×1 · `REFR` ×1 · `RPT` ×1 · `SETL` ×1 · `RFND` ×2 · `ADMN` ×2 = **38**, carrying
**129** acceptance criteria in total.

### 10.1 `AUTH` — Authentication & Identity (§B5.1)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-AUTH-01** | *As a visitor, I want to register with just my phone number so that I can buy a membership without inventing another password.* | — | `iam/` · `web` | B5.1 | E2E; all of `AC-AUTH-01.1` … `AC-AUTH-01.5` | NOT STARTED |
| `[ ]` | ↳ **AC-AUTH-01.1** | **Given** I am on the registration screen, **when** I enter a valid mobile number and request an OTP, **then** an OTP is delivered within 30 seconds and the screen advances to OTP entry with the number shown and an edit affordance. | — | `iam/` | B5.1 | Integration (timed) + E2E; `FR-AUTH-01`, `FR-AUTH-05` | NOT STARTED |
| `[ ]` | ↳ **AC-AUTH-01.2** | **Given** I entered the correct OTP, **when** I submit it, **then** an account is created, I am authenticated, and I return to whatever I was doing before registration was required. | — | `iam/` · `web` | B5.1 | E2E; `FR-NAV-02`; `FR-CART-08` | NOT STARTED |
| `[ ]` | ↳ **AC-AUTH-01.3** | **Given** I entered an incorrect OTP, **when** I submit it, **then** I see the remaining attempt count and the OTP is not consumed by the failed attempt beyond the counter. | — | `iam/` | B5.1 | Integration (negative); `FR-AUTH-05` (max 5 attempts) | NOT STARTED |
| `[ ]` | ↳ **AC-AUTH-01.4** | **Given** I have requested 3 OTPs in 30 minutes, **when** I request a fourth, **then** I am told when I may retry, and no SMS is sent. | — | `iam/` · `notifications/` | B5.1 | Integration (negative — provider not called); `FR-AUTH-05` (max 3 resends / 30 min) | NOT STARTED |
| `[ ]` | ↳ **AC-AUTH-01.5** | **Given** the SMS provider is unavailable, **when** I request an OTP, **then** I am offered email verification as an alternative rather than a generic failure. | — | `iam/` · `notifications/` | B5.1 | Integration (fault injection); `DEP-03` mitigation; `NFR-AVL-07` | NOT STARTED |
| `[ ]` | **US-AUTH-02** | *As a gym owner, I want to manage two gyms from one login so that I don't juggle accounts.* | — | `iam/` · `tenancy/` | B5.1 | E2E + Isolation; all of `AC-AUTH-02.1` … `AC-AUTH-02.3` | NOT STARTED |
| `[ ]` | ↳ **AC-AUTH-02.1** | **Given** I own two tenants, **when** I sign in, **then** I choose a tenant before reaching the dashboard, and the choice is remembered for the session. | — | `tenancy/` · `dash` | B5.1 | E2E; `FR-AUTH-11`; `BR-TEN-02`; `API-AUTH POST /auth/tenant-context` | NOT STARTED |
| `[ ]` | ↳ **AC-AUTH-02.2** | **Given** I am working in tenant A, **when** I switch to tenant B, **then** all in-flight views reload scoped to tenant B and the switch is written to the audit log. | — | `tenancy/` · `audit/` | B5.1 | Integration + E2E; `BR-TEN-02`; `BR-DAT-01` | NOT STARTED |
| `[ ]` | ↳ **AC-AUTH-02.3** | **Given** I am in tenant A, **when** any request is made, **then** no data belonging to tenant B is returned under any circumstance, including search, reports and exports. | — | `tenancy/` | B5.1 | Isolation suite (all endpoints incl. search, reports, exports); `E2E-11`; `BAC-10` | NOT STARTED |
| `[ ]` | **US-AUTH-03** | *As a support agent, I want to see what a member sees so that I can resolve their issue without a screenshare.* | — | `iam/` · `support/` | B5.1 | E2E; all of `AC-AUTH-03.1` … `AC-AUTH-03.3` | NOT STARTED |
| `[ ]` | ↳ **AC-AUTH-03.1** | **Given** I have `SUPPORT_AGENT` and a stated reason, **when** I start impersonation, **then** the session is capped at 30 minutes and a banner is visible throughout. | — | `iam/` | B5.1 | Integration (cap) + E2E (banner); `FR-AUTH-12`; `BR-DAT-02` | NOT STARTED |
| `[ ]` | ↳ **AC-AUTH-03.2** | **Given** I am impersonating, **when** I attempt to initiate a payment, request a refund, or change a payout account, **then** the action is refused. | — | `iam/` · `payments/` · `refunds/` · `settlements/` | B5.1 | Contract (three negatives); `FR-AUTH-12` | NOT STARTED |
| `[ ]` | ↳ **AC-AUTH-03.3** | **Given** impersonation ended, **when** the member next views their account activity, **then** the impersonation event is listed with the agent's name, timestamp and reason. | — | `iam/` · `audit/` | B5.1 | Integration + E2E; `FR-USER-05`; `BR-DAT-02`; `SCR-WEB-014` | NOT STARTED |

### 10.2 `USER` — User Profile & Account (§B5.2)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-USER-01** | *As a member, I want to control what the platform sends me so that I keep the reminders and lose the marketing.* | — | `notifications/` · `iam/` | B5.2 | E2E; all of `AC-USER-01.1` … `AC-USER-01.3` | NOT STARTED |
| `[ ]` | ↳ **AC-USER-01.1** | **Given** I disable marketing email, **when** a campaign runs, **then** I receive nothing from it, verified by suppression at send time and not merely at list build time. | — | `notifications/` | B5.2 | Integration (suppression asserted at dispatch, not at list build); `FR-USER-04`; `FR-NOTF-02` | NOT STARTED |
| `[ ]` | ↳ **AC-USER-01.2** | **Given** I disable all optional channels, **when** my membership is 3 days from expiry, **then** I still receive the renewal reminder because it is transactional. | — | `notifications/` · `memberships/` | B5.2 | Integration; `BR-MEM-11` (T−3); `FR-NOTF-02` transactional never opt-out | NOT STARTED |
| `[ ]` | ↳ **AC-USER-01.3** | **Given** I unsubscribe via an email link, **when** I do so, **then** the preference is applied without requiring me to log in. | — | `notifications/` | B5.2 | Integration + E2E (unauthenticated preference update via signed link); `NFR-PRV-02` | NOT STARTED |
| `[ ]` | **US-USER-02** | *As a member, I want to delete my account so that my data isn't held indefinitely.* | — | `iam/` | B5.2 | E2E; all of `AC-USER-02.1` … `AC-USER-02.4` | NOT STARTED |
| `[ ]` | ↳ **AC-USER-02.1** | **Given** I request deletion, **when** I confirm, **then** I see exactly which records are erased and which financial records are retained, with the retention period stated. | — | `iam/` · `web` | B5.2 | E2E; `FR-USER-07`; `BR-DAT-04`; `NFR-PRV-04`; `CON-04` | NOT STARTED |
| `[ ]` | ↳ **AC-USER-02.2** | **Given** deletion is scheduled, **when** I log in within 7 days, **then** I am offered cancellation of the deletion. | — | `iam/` | B5.2 | Integration (7-day grace boundary) + E2E; `FR-USER-07` | NOT STARTED |
| `[ ]` | ↳ **AC-USER-02.3** | **Given** deletion executes, **when** any surface queries my identity, **then** personal identifiers are irrecoverable and financial records reference a pseudonymous identifier only. | — | `iam/` · `billing/` | B5.2 | Integration (negative — identifiers unrecoverable across all read paths); `BR-DAT-04` | NOT STARTED |
| `[ ]` | ↳ **AC-USER-02.4** | **Given** I hold an active membership, **when** I request deletion, **then** I am warned that the membership will be forfeited and must confirm explicitly. | — | `iam/` · `memberships/` | B5.2 | E2E; `NFR-USE-06` (consequence stated specifically) | NOT STARTED |

### 10.3 `ONB` — Tenant Onboarding & KYC (§B5.3)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-ONB-01** | *As a gym owner, I want to know exactly what is missing so that I'm not guessing why I'm not live.* | — | `onboarding/` · `dash` | B5.3 | E2E; `E2E-01`; `UAT-01`; all of `AC-ONB-01.1` … `AC-ONB-01.3` | NOT STARTED |
| `[ ]` | ↳ **AC-ONB-01.1** | **Given** I am mid-application, **when** I open the dashboard, **then** I see a checklist of completed and outstanding items with a direct link to each outstanding item. | — | `onboarding/` · `dash` | B5.3 | E2E; `FR-ONB-14`; `FR-NAV-04`; `SCR-DASH-001` region 1 | NOT STARTED |
| `[ ]` | ↳ **AC-ONB-01.2** | **Given** my application is rejected, **when** I open it, **then** each cited reason names the specific field or document and the corrective action. | — | `onboarding/` | B5.3 | Integration + E2E; `FR-ONB-11`; `BR-GYM-04`; `RCT-02` | NOT STARTED |
| `[ ]` | ↳ **AC-ONB-01.3** | **Given** I fix the cited items, **when** I resubmit, **then** the application returns to the queue with a marker indicating it is a resubmission, and the reviewer can see a diff against the prior version. | — | `onboarding/` · `admin/` | B5.3 | Integration + E2E; `BR-GYM-05`; `SCR-ADM-003` history; `SCR-ADM-002` submission type | NOT STARTED |
| `[ ]` | **US-ONB-02** | *As a verification officer, I want every piece of evidence on one screen so that I can decide in under three minutes.* | — | `onboarding/` · `admin` | B5.3 | E2E; `UAT-04`; all of `AC-ONB-02.1` … `AC-ONB-02.5` | NOT STARTED |
| `[ ]` | ↳ **AC-ONB-02.1** | **Given** an application in the queue, **when** I open it, **then** documents render in an inline viewer alongside the structured checklist without downloading. | — | `onboarding/` · `admin` | B5.3 | E2E; `SCR-ADM-003` split view; `BR-DAT-07` access logging | NOT STARTED |
| `[ ]` | ↳ **AC-ONB-02.2** | **Given** automated pre-checks have run, **when** I open the application, **then** any failing check is visible at the top with its detail, and passing checks are collapsed. | — | `onboarding/` · `admin` | B5.3 | E2E; `FR-ONB-12`; `SCR-ADM-003` pre-check panel | NOT STARTED |
| `[ ]` | ↳ **AC-ONB-02.3** | **Given** the registered address geocodes more than the configured tolerance from the map pin, **when** I open the application, **then** this is flagged and approval requires an explicit override with a reason. | — | `onboarding/` | B5.3 | Integration (negative — approval without override refused); `BR-GYM-08`; `RC-21 GEO_ADDRESS_MISMATCH` | NOT STARTED |
| `[ ]` | ↳ **AC-ONB-02.4** | **Given** another approved gym exists at the same address, **when** I open the application, **then** I see a link to that gym and approval requires an explicit override. | — | `onboarding/` | B5.3 | Integration; `BR-GYM-09`; `RC-22 DUPLICATE_LISTING`; §B5.3 edge case *shared premises* | NOT STARTED |
| `[ ]` | ↳ **AC-ONB-02.5** | **Given** I approve, **when** I confirm, **then** the listing is live within 60 seconds and the decision, my identity and timestamp are written to the audit log. | — | `onboarding/` · `discovery/` · `audit/` | B5.3 | E2E (timed); `FR-ONB-13`; `BAC-02`; `BR-GYM-03`; `BR-DAT-01` | NOT STARTED |
| `[ ]` | **US-ONB-03** | *As a gym owner with 400 existing members, I want to import them rather than retype them.* | — | `onboarding/` · `crm/` | B5.3 | E2E; all of `AC-ONB-03.1` … `AC-ONB-03.4`; CSV parser pending `A-20` | NOT STARTED |
| `[ ]` | ↳ **AC-ONB-03.1** | **Given** a CSV, **when** I upload it, **then** I map my columns to platform fields and see a preview of the first 20 mapped rows. | — | `onboarding/` | B5.3 | E2E; `FR-ONB-15`; `NFR-SEC-10` upload controls | NOT STARTED |
| `[ ]` | ↳ **AC-ONB-03.2** | **Given** I run a validation pass, **when** it completes, **then** I see a per-row report of errors (invalid phone, missing name, unparseable date, duplicate) and can download it. | — | `onboarding/` | B5.3 | Integration (one case per error class — four) + E2E; `FR-ONB-15` dry-run | NOT STARTED |
| `[ ]` | ↳ **AC-ONB-03.3** | **Given** I proceed with import, **when** rows contain errors, **then** valid rows import and invalid rows are skipped and reported; the import is never partially applied to a single row. | — | `onboarding/` · `crm/` | B5.3 | Integration (per-row atomicity); `FR-ONB-15` | NOT STARTED |
| `[ ]` | ↳ **AC-ONB-03.4** | **Given** I re-run the same file, **when** import executes, **then** no duplicate members are created. | — | `onboarding/` · `crm/` | B5.3 | Integration (idempotent re-run); `FR-ONB-15` | NOT STARTED |

### 10.4 `GYM` — Gym & Branch Management (§B5.4)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-GYM-01** | *As an owner with two branches, I want members to buy a plan that works at both so that I don't have to sell twice.* | — | `catalog/` · `plans/` | B5.4 | E2E; all of `AC-GYM-01.1` … `AC-GYM-01.3` | NOT STARTED |
| `[ ]` | ↳ **AC-GYM-01.1** | **Given** I have two active branches, **when** I create a plan, **then** I choose all branches or specific branches. | — | `plans/` | B5.4 | E2E; `FR-GYM-08`; `plan_branches`; `BR-TEN-03` | NOT STARTED |
| `[ ]` | ↳ **AC-GYM-01.2** | **Given** a member holds an all-branch plan, **when** they check in at either branch, **then** check-in succeeds. | — | `attendance/` | B5.4 | Integration + E2E; `FR-CHK-04` step 6; `BR-CHK-03` | NOT STARTED |
| `[ ]` | ↳ **AC-GYM-01.3** | **Given** a member holds a branch-restricted plan, **when** they attempt check-in at an excluded branch, **then** check-in is denied with the reason "not valid at this branch" and staff sees which branches are valid. | — | `attendance/` | B5.4 | Integration (negative) + E2E; `RC-06 WRONG_BRANCH`; `FR-CHK-06` | NOT STARTED |
| `[ ]` | **US-GYM-02** | *As an owner, I want to close for a festival without members thinking I've shut down.* | — | `catalog/` · `notifications/` | B5.4 | E2E; all of `AC-GYM-02.1` … `AC-GYM-02.3` | NOT STARTED |
| `[ ]` | ↳ **AC-GYM-02.1** | **Given** I declare a closure for a date range with a reason, **when** a member views the gym or their membership, **then** the closure and reason are visible. | — | `catalog/` · `web` | B5.4 | E2E on both surfaces; `FR-GYM-10`; `branch_hour_exceptions` | NOT STARTED |
| `[ ]` | ↳ **AC-GYM-02.2** | **Given** a closure is active, **when** a member attempts check-in, **then** it is denied with the closure reason rather than a generic error. | — | `attendance/` | B5.4 | Integration (negative); `RC-09 GYM_CLOSED_EXCEPTION`; §B5.13 edge case *declared exception* | NOT STARTED |
| `[ ]` | ↳ **AC-GYM-02.3** | **Given** a closure exceeds a configurable threshold of consecutive days, **when** it is declared, **then** affected members are notified automatically and the gym is temporarily demoted in search. | — | `catalog/` · `notifications/` · `discovery/` | B5.4 | Integration; `BR-MEM-14`; `FR-GYM-12` demotion; notification catalogue *Gym closure notice* | NOT STARTED |

### 10.5 `PLAN` — Membership Plan Catalogue (§B5.5)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-PLAN-01** | *As an owner, I want to run a monsoon offer that ends by itself so that I don't forget to reset the price.* | — | `plans/` | B5.5 | E2E; all of `AC-PLAN-01.1` … `AC-PLAN-01.3` | NOT STARTED |
| `[ ]` | ↳ **AC-PLAN-01.1** | **Given** I set a promotional price with an end date, **when** the end date passes, **then** the plan reverts to list price automatically without any action from me. | — | `plans/` | B5.5 | Integration (clock advance); `FR-PLAN-03`; `plans.promo_ends_at` | NOT STARTED |
| `[ ]` | ↳ **AC-PLAN-01.2** | **Given** a promotion is active, **when** the plan renders on the marketplace, **then** both the struck-through list price and the promotional price are shown with the promotion's end date. | — | `plans/` · `web` | B5.5 | E2E; `SCR-WEB-003` plan card; `PRIN-02` | NOT STARTED |
| `[ ]` | ↳ **AC-PLAN-01.3** | **Given** a member purchased during the promotion, **when** the promotion ends, **then** their membership retains the purchased price for its full term and any auto-renewal discloses the reversion price before charging. | — | `plans/` · `memberships/` | B5.5 | Integration; `BR-PLN-02`; `memberships.purchased_price_minor`; `FR-PAY-11` pre-debit notification | NOT STARTED |
| `[ ]` | **US-PLAN-02** | *As a member, I want the price I saw to be the price I pay.* | — | `plans/` · `ordering/` | B5.5 | E2E; `E2E-02`; all of `AC-PLAN-02.1` … `AC-PLAN-02.3` | NOT STARTED |
| `[ ]` | ↳ **AC-PLAN-02.1** | **Given** I select a plan at price X, **when** I reach payment, **then** the server re-validates and the charge equals X. | — | `ordering/` | B5.5 | Integration + E2E; `BR-PLN-03`; `API-ORD POST /orders/:ref/validate` | NOT STARTED |
| `[ ]` | ↳ **AC-PLAN-02.2** | **Given** the gym changed the price between my page load and my payment attempt, **when** I attempt payment, **then** checkout halts with an explicit message showing the old and new price and requires my re-confirmation. It never silently charges either figure. | — | `ordering/` | B5.5 | Integration (negative) + E2E; §C3.3 error `PLAN_PRICE_CHANGED` (422); `SCR-WEB-005` blocking modal | NOT STARTED |
| `[ ]` | ↳ **AC-PLAN-02.3** | **Given** the plan was archived between my page load and my payment attempt, **when** I attempt payment, **then** checkout halts with a clear message and alternative plans are offered. | — | `ordering/` · `plans/` | B5.5 | Integration (negative) + E2E; `FR-PLAN-05`; `SCR-WEB-005` states | NOT STARTED |

### 10.6 `SRCH` — Marketplace Search & Discovery (§B5.6)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-SRCH-01** | *As Priya, I want to see only gyms open at 6 a.m. within 3 km so that I don't waste time on ones I can't use.* | — | `discovery/` · `web` | B5.6 | E2E; `E2E-02`; all of `AC-SRCH-01.1` … `AC-SRCH-01.3` | NOT STARTED |
| `[ ]` | ↳ **AC-SRCH-01.1** | **Given** I set radius 3 km and filter "open at 06:00", **when** results render, **then** every result's operating hours include 06:00 on the current weekday and every result is within 3 km of my location. | — | `discovery/` | B5.6 | Integration (assert every returned row satisfies both predicates); `FR-SRCH-03`; PostGIS radius query | NOT STARTED |
| `[ ]` | ↳ **AC-SRCH-01.2** | **Given** no gym matches, **when** results render, **then** I am told which filter is most restrictive and offered a single-tap relaxation of it, with the resulting count previewed. | — | `discovery/` · `web` | B5.6 | E2E; `FR-SRCH-12`; `SCR-WEB-002-E`; `EVT-03 search_zero_results` | NOT STARTED |
| `[ ]` | ↳ **AC-SRCH-01.3** | **Given** I apply filters, **when** I share or reload the URL, **then** the same filters and location are restored. | — | `web` | B5.6 | E2E; `SCR-WEB-002` URL state row | NOT STARTED |
| `[ ]` | **US-SRCH-02** | *As a visitor, I want the map and the list to feel like one thing.* | — | `web` | B5.6 | E2E; all of `AC-SRCH-02.1` … `AC-SRCH-02.3` | NOT STARTED |
| `[ ]` | ↳ **AC-SRCH-02.1** | **Given** results are displayed, **when** I hover a list card, **then** its map pin is highlighted; **when** I click a pin, **then** the list scrolls to that card and highlights it. | — | `web` | B5.6 | E2E (both directions); `FR-SRCH-05`; `SCR-WEB-002` map | NOT STARTED |
| `[ ]` | ↳ **AC-SRCH-02.2** | **Given** I pan the map away from the current results, **when** panning ends, **then** a "search this area" control appears and results only update when I invoke it. | — | `web` · `discovery/` | B5.6 | E2E (negative — no auto-refetch on pan); `FR-SRCH-08`; `EVT-05 map_area_searched` | NOT STARTED |
| `[ ]` | ↳ **AC-SRCH-02.3** | **Given** the maps provider is unavailable, **when** the page loads, **then** the list renders fully and the map area shows a graceful notice rather than blocking the page. | — | `web` | B5.6 | E2E (fault injection); `DEP-02` mitigation; `NFR-AVL-03`; `PRIN-06` | NOT STARTED |

### 10.7 `DETL` — Gym Detail & Comparison (§B5.7)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-DETL-01** | *As Priya, I want to compare three gyms side by side so that I can stop going back and forth between tabs.* | — | `discovery/` · `web` | B5.7 | E2E; `SCR-WEB-004`; all of `AC-DETL-01.1` … `AC-DETL-01.3` | NOT STARTED |
| `[ ]` | ↳ **AC-DETL-01.1** | **Given** I have added three gyms to comparison, **when** I open the comparison view, **then** all three render side by side with aligned attribute rows and differing values visually emphasised. | — | `web` | B5.7 | E2E; `FR-DETL-08`; `SCR-WEB-004` emphasis row | NOT STARTED |
| `[ ]` | ↳ **AC-DETL-01.2** | **Given** a gym in my comparison lacks an amenity another has, **when** I view the amenity row, **then** absence is shown explicitly rather than left blank. | — | `web` | B5.7 | E2E; `FR-DETL-08` presence matrix | NOT STARTED |
| `[ ]` | ↳ **AC-DETL-01.3** | **Given** I attempt to add a fifth gym, **when** I do so, **then** I am prompted to remove one, and the comparison never silently drops an entry. | — | `web` | B5.7 | E2E (negative — max 4 enforced without silent eviction); `FR-DETL-08` | NOT STARTED |
| `[ ]` | **US-DETL-02** | *As a visitor, I want to trust the rating.* | — | `reviews/` · `web` | B5.7 | E2E; all of `AC-DETL-02.1` … `AC-DETL-02.3` | NOT STARTED |
| `[ ]` | ↳ **AC-DETL-02.1** | **Given** a gym has fewer than 3 published reviews, **when** I view it, **then** no numeric rating is displayed; instead the review count is shown with an explanation. | — | `reviews/` · `web` | B5.7 | E2E (boundary at 2 and 3); `BR-REV-07`; `OQ-10` default 3 | NOT STARTED |
| `[ ]` | ↳ **AC-DETL-02.2** | **Given** reviews exist, **when** I view any review, **then** it carries a "Verified member" marker, and there is no review on the page without one. | — | `reviews/` · `web` | B5.7 | E2E (assert every rendered review carries the marker); `BR-REV-03`; `PRIN-05` | NOT STARTED |
| `[ ]` | ↳ **AC-DETL-02.3** | **Given** the gym responded to a review, **when** I read it, **then** the response is visually attached to the review and labelled as the gym's response. | — | `reviews/` · `web` | B5.7 | E2E; `FR-REV-05`; `review_responses`; `SCR-WEB-003` review item | NOT STARTED |

### 10.8 `FAV` — Favourites & Saved Searches (§B5.8)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-FAV-01** | *As a user, I want to shortlist gyms now and decide at the weekend.* | — | `discovery/` · `web` | B5.8 | E2E; `SCR-WEB-012`; all of `AC-FAV-01.1` … `AC-FAV-01.3` | NOT STARTED |
| `[ ]` | ↳ **AC-FAV-01.1** | **Given** I favourite a gym while unauthenticated, **when** I complete login, **then** the gym is in my favourites and I am returned to where I was. | — | `discovery/` · `web` | B5.8 | E2E; `FR-FAV-03`; `FR-NAV-02` | NOT STARTED |
| `[ ]` | ↳ **AC-FAV-01.2** | **Given** a favourited gym's lowest price changed, **when** I open favourites, **then** the change is indicated with the old and new value. | — | `discovery/` · `web` | B5.8 | Integration + E2E; `FR-FAV-02`; `SCR-WEB-012` | NOT STARTED |
| `[ ]` | ↳ **AC-FAV-01.3** | **Given** a favourited gym is suspended, **when** I open favourites, **then** it is shown as unavailable rather than silently removed. | — | `discovery/` · `web` | B5.8 | Integration + E2E; `BR-TEN-05`; `FR-DETL-11` | NOT STARTED |

### 10.9 `CART` — Checkout & Orders (§B5.9)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-CART-01** | *As Priya, I want to start my membership on the 1st, not today.* | — | `ordering/` · `memberships/` | B5.9 | E2E; all of `AC-CART-01.1` … `AC-CART-01.3` | NOT STARTED |
| `[ ]` | ↳ **AC-CART-01.1** | **Given** I select a future start date within the allowed horizon, **when** I pay, **then** the membership is created in `PENDING` and transitions to `ACTIVE` at 00:00 in the gym's timezone on the start date. | — | `memberships/` | B5.9 | Integration (timezone matrix); `SMT-01`, `SMT-03`; `JOB-01 membership.activate-pending`; `BR-MEM-03` | NOT STARTED |
| `[ ]` | ↳ **AC-CART-01.2** | **Given** my membership is `PENDING` with a future start, **when** I attempt check-in, **then** it is denied with the message that the membership begins on the stated date. | — | `attendance/` | B5.9 | Integration (negative); `RC-03 MEMBERSHIP_PENDING_START`; `BR-CHK-01` | NOT STARTED |
| `[ ]` | ↳ **AC-CART-01.3** | **Given** my start date arrives, **when** the transition occurs, **then** I receive an activation notification and my QR becomes available. | — | `memberships/` · `notifications/` · `attendance/` | B5.9 | Integration + E2E; notification catalogue *Membership starts today (future-dated)*; `SCR-WEB-009` `PENDING` state | NOT STARTED |
| `[ ]` | **US-CART-02** | *As a receptionist, I want to sell a plan at the desk and take half now, half next week.* | — | `ordering/` · `dash` | B5.9 | E2E; `E2E-10`; `UAT-02`; all of `AC-CART-02.1` … `AC-CART-02.4` | NOT STARTED |
| `[ ]` | ↳ **AC-CART-02.1** | **Given** I create an offline order and record a partial cash payment, **when** I save, **then** the order shows `BALANCE_DUE` with the outstanding amount, and the membership activates per the tenant's configuration for partial payments. | — | `ordering/` · `memberships/` | B5.9 | Integration; `FR-CART-09`; `BR-PAY-09`; `orders.status = PARTIALLY_PAID` | NOT STARTED |
| `[ ]` | ↳ **AC-CART-02.2** | **Given** a balance is due, **when** I open the member's record, **then** the outstanding amount is prominent and a "collect balance" action is available. | — | `crm/` · `dash` | B5.9 | E2E; `SCR-DASH-008`; tenant report *Outstanding balances* | NOT STARTED |
| `[ ]` | ↳ **AC-CART-02.3** | **Given** I collect the balance, **when** I record it, **then** the order moves to `PAID`, a single consolidated invoice is issued, and both payments appear on it. | — | `ordering/` · `billing/` | B5.9 | Integration + E2E; `E2E-10`; `SMT-19`; `API-TEN POST /tenant/orders/:ref/collect-balance` | NOT STARTED |
| `[ ]` | ↳ **AC-CART-02.4** | **Given** a customer is purchasing online through the marketplace, **when** they reach payment, **then** partial payment is not offered. | — | `ordering/` · `web` | B5.9 | Contract (negative — partial payment refused on the `WEB` channel); `BR-PAY-09` | NOT STARTED |

---
### 10.10 `PAY` — Payments & Gateway (§B5.10)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-PAY-01** | *As a member, I want to not be charged twice, and if I am, I want it fixed without asking.* | — | `payments/` · `refunds/` | B5.10 | E2E; `E2E-08`; all of `AC-PAY-01.1` … `AC-PAY-01.3` | NOT STARTED |
| `[ ]` | ↳ **AC-PAY-01.1** | **Given** I submit payment twice for one order, **when** both reach the gateway, **then** exactly one membership is created. | — | `payments/` · `memberships/` | B5.10 | Integration (concurrent submit) + E2E; `BR-PAY-03`; `E2E-08` | NOT STARTED |
| `[ ]` | ↳ **AC-PAY-01.2** | **Given** two captures occurred, **when** the duplicate detector runs, **then** the second is refunded within one hour and I am notified with the refund reference. | — | `payments/` · `refunds/` · `notifications/` | B5.10 | Integration (timed) ; `JOB-08 payment.duplicate-detect`; `BR-PAY-07`; `FR-PAY-08` | NOT STARTED |
| `[ ]` | ↳ **AC-PAY-01.3** | **Given** a duplicate refund occurred, **when** the gym views settlement, **then** the duplicate and its reversal both appear and net to zero. | — | `settlements/` · `ledger/` | B5.10 | Integration + E2E; `E2E-08`; `FR-SETL-03`; `BR-FIN-03` | NOT STARTED |
| `[ ]` | **US-PAY-02** | *As a member, I want to know whether my payment worked even if the app crashed.* | — | `payments/` | B5.10 | E2E; all of `AC-PAY-02.1` … `AC-PAY-02.3` | NOT STARTED |
| `[ ]` | ↳ **AC-PAY-02.1** | **Given** payment succeeded at the gateway but my browser closed before redirect, **when** I reopen the site, **then** my membership is active because activation is webhook-driven. | — | `payments/` · `memberships/` | B5.10 | Integration + E2E (client abort); `BR-PAY-02`; `FR-PAY-03` | NOT STARTED |
| `[ ]` | ↳ **AC-PAY-02.2** | **Given** the webhook has not yet arrived, **when** I check my order, **then** it shows "confirming payment" with an explicit expectation, never "failed". | — | `payments/` · `web` | B5.10 | E2E; `SCR-WEB-007` pending state; `NFR-USE-05` | NOT STARTED |
| `[ ]` | ↳ **AC-PAY-02.3** | **Given** the payment genuinely failed, **when** I view the order, **then** I see the failure reason in customer language and a retry option. | — | `payments/` · `web` | B5.10 | E2E; `FR-PAY-06`; `SCR-WEB-006` failure state; `NFR-USE-05` | NOT STARTED |

### 10.11 `INV` — Invoicing & Tax (§B5.11)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-INV-01** | *As Vikram in finance, I want a gapless invoice series so that the audit doesn't turn into an investigation.* | — | `billing/` | B5.11 | Integration; `UAT-05`; all of `AC-INV-01.1` … `AC-INV-01.3` | NOT STARTED |
| `[ ]` | ↳ **AC-INV-01.1** | **Given** concurrent payments complete simultaneously for one tenant, **when** invoices are issued, **then** numbers are unique, sequential and without gaps. | — | `billing/` | B5.11 | Integration (concurrency stress); `FR-INV-02`; `BR-PAY-10` | NOT STARTED |
| `[ ]` | ↳ **AC-INV-01.2** | **Given** an invoice generation fails after the number was allocated, **when** the failure is handled, **then** either the number is used by the retry or a documented void record occupies it. A silently skipped number is a defect. | — | `billing/` | B5.11 | Integration (fault injection mid-issue); `FR-INV-02`; `invoices.status` void record | NOT STARTED |
| `[ ]` | ↳ **AC-INV-01.3** | **Given** a financial year rolls over, **when** the first invoice of the new year issues, **then** the sequence restarts per the configured format and the prior year's series is closed. | — | `billing/` | B5.11 | Integration (clock advance across FY boundary); `invoices.financial_year` | NOT STARTED |

### 10.12 `MEMB` — Membership Lifecycle (§B5.12)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-MEMB-01** | *As a member travelling for a month, I want to freeze rather than waste my membership.* | — | `memberships/` | B5.12 | E2E; `E2E-05`; `UAT-03`; all of `AC-MEMB-01.1` … `AC-MEMB-01.5` | NOT STARTED |
| `[ ]` | ↳ **AC-MEMB-01.1** | **Given** my plan allows freezing and I have freeze days remaining, **when** I request a freeze for a future date range, **then** it is accepted and my end date extends by exactly that many days. | — | `memberships/` | B5.12 | Unit (exact extension) + E2E; `BR-MEM-05`; `SMT-05`; `OQ-06` | NOT STARTED |
| `[ ]` | ↳ **AC-MEMB-01.2** | **Given** my freeze is active, **when** I attempt check-in, **then** it is denied with the reason "membership frozen until \<date\>". | — | `attendance/` | B5.12 | Integration (negative) + E2E; `BR-MEM-06`; `RC-02 MEMBERSHIP_FROZEN` | NOT STARTED |
| `[ ]` | ↳ **AC-MEMB-01.3** | **Given** I return early and unfreeze, **when** I do so, **then** my end date is recalculated to the actual frozen days and my membership becomes `ACTIVE` immediately. | — | `memberships/` | B5.12 | Unit (recalculation) + E2E; `FR-MEMB-05`; `SMT-06`; `E2E-05` | NOT STARTED |
| `[ ]` | ↳ **AC-MEMB-01.4** | **Given** I have exhausted my freeze allowance, **when** I request another freeze, **then** I am told how many days I have used and what the cap is. | — | `memberships/` | B5.12 | Integration (negative at the cap boundary); `memberships.freeze_days_used`; `plans.freeze_max_days` | NOT STARTED |
| `[ ]` | ↳ **AC-MEMB-01.5** | **Given** my plan does not allow freezing, **when** I view my membership, **then** no freeze action is offered at all. | — | `memberships/` · `web` | B5.12 | E2E + Contract (negative — endpoint also refuses); `plans.freeze_allowed`; `SCR-WEB-009` | NOT STARTED |
| `[ ]` | **US-MEMB-02** | *As Rohan, I want to see who is expiring this week so that I can call them.* | — | `memberships/` · `crm/` · `dash` | B5.12 | E2E; all of `AC-MEMB-02.1` … `AC-MEMB-02.3` | NOT STARTED |
| `[ ]` | ↳ **AC-MEMB-02.1** | **Given** memberships expire within the next 7 days, **when** I open the dashboard home, **then** they are listed with member name, phone, plan, days remaining and a one-tap contact action. | — | `memberships/` · `dash` | B5.12 | E2E; `SCR-DASH-001` region 3; tenant report *Expiring memberships*; `memberships (tenant_id, status, end_date)` index | NOT STARTED |
| `[ ]` | ↳ **AC-MEMB-02.2** | **Given** I renew a member from that list, **when** I complete it, **then** the new term starts the day after their current end date without a gap. | — | `memberships/` · `ordering/` | B5.12 | Unit (date arithmetic) + E2E; `FR-MEMB-06` | NOT STARTED |
| `[ ]` | ↳ **AC-MEMB-02.3** | **Given** a member has already renewed, **when** I view the expiring list, **then** they are excluded. | — | `memberships/` · `crm/` | B5.12 | Integration (negative — renewed member absent from the segment); `FR-CRM-02` | NOT STARTED |

### 10.13 `CHK` — QR Check-in & Attendance (§B5.13)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-CHK-01** | *As Sameer at the desk, I want to check in a queue of ten people without anything going wrong.* | — | `attendance/` · `dash` | B5.13 | E2E; `E2E-03`, `E2E-04`; `UAT-02`; all of `AC-CHK-01.1` … `AC-CHK-01.5` | NOT STARTED |
| `[ ]` | ↳ **AC-CHK-01.1** | **Given** the scanner is open, **when** a valid QR is presented, **then** confirmation appears within 2 seconds at p95 and the scanner is immediately ready for the next person. | — | `attendance/` · `dash` | B5.13 | Performance + E2E; `NFR-PERF-03`; `KPI-24`; `SCR-DASH-009` | NOT STARTED |
| `[ ]` | ↳ **AC-CHK-01.2** | **Given** a member's membership expired, **when** they present a QR, **then** denial shows "Membership expired on \<date\>" with a "Renew now" action that opens the sale flow pre-filled for that member. | — | `attendance/` · `ordering/` | B5.13 | E2E; `E2E-04`; `RC-01 MEMBERSHIP_EXPIRED`; §C3.3 `suggested_actions: ["RENEW","OVERRIDE"]` | NOT STARTED |
| `[ ]` | ↳ **AC-CHK-01.3** | **Given** a member presents a screenshot of an old QR, **when** it is scanned, **then** it is denied as expired because the token TTL is 60 seconds. | — | `attendance/` | B5.13 | Integration (negative, clock advance); `BR-CHK-02`; `RC-12 TOKEN_EXPIRED`; `RSK-03` | NOT STARTED |
| `[ ]` | ↳ **AC-CHK-01.4** | **Given** the same valid token is scanned twice within its TTL, **when** the second scan occurs, **then** the original attendance record is returned and no second visit is recorded. | — | `attendance/` | B5.13 | Integration (idempotency); `BR-CHK-06`; `attendance.token_nonce` | NOT STARTED |
| `[ ]` | ↳ **AC-CHK-01.5** | **Given** the network drops mid-scan, **when** connectivity returns, **then** the operation either completed exactly once or not at all — never twice. | — | `attendance/` | B5.13 | Integration (partition injection); `BR-CHK-06`; `SCR-DASH-009` offline behaviour (no false success) | NOT STARTED |
| `[ ]` | **US-CHK-02** | *As Rohan, I want to know when my gym is busy so that I staff it properly.* | — | `attendance/` · `reporting/` | B5.13 | E2E; all of `AC-CHK-02.1` … `AC-CHK-02.3` | NOT STARTED |
| `[ ]` | ↳ **AC-CHK-02.1** | **Given** at least 14 days of attendance data, **when** I open the attendance report, **then** a weekday-by-hour heatmap renders with visit counts. | — | `attendance/` · `reporting/` | B5.13 | Integration + E2E; `FR-CHK-13`; `API-CHK GET /tenant/attendance/heatmap`; tenant report *Peak hours* | NOT STARTED |
| `[ ]` | ↳ **AC-CHK-02.2** | **Given** I filter to one branch, **when** the filter applies, **then** the heatmap reflects that branch only. | — | `attendance/` · `reporting/` | B5.13 | Integration; `FR-RPT-01` branch filter; `attendance (tenant_id, branch_id, checked_in_at)` index | NOT STARTED |
| `[ ]` | ↳ **AC-CHK-02.3** | **Given** I export the report, **when** the export completes, **then** the CSV contains one row per visit with member id, timestamp, branch, method and result. | — | `reporting/` | B5.13 | Integration (column assertion); `FR-CHK-10`; `AC-RPT-01.3` export conventions | NOT STARTED |

### 10.14 `CRM` — Member CRM (§B5.14)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-CRM-01** | *As Rohan, I want to find people who have stopped coming before they stop paying.* | — | `crm/` · `attendance/` | B5.14 | E2E; all of `AC-CRM-01.1` … `AC-CRM-01.3` | NOT STARTED |
| `[ ]` | ↳ **AC-CRM-01.1** | **Given** a member's average weekly visits over the last 8 weeks dropped by more than the configured threshold, **when** I open the at-risk segment, **then** they appear with their baseline, current frequency and last visit date. | — | `crm/` | B5.14 | Unit (baseline computation over 8 weeks) + Integration; `FR-CRM-06`; `JOB-18 crm.risk-flags` | NOT STARTED |
| `[ ]` | ↳ **AC-CRM-01.2** | **Given** I select the at-risk segment, **when** I send a bulk notification, **then** it respects each member's notification preferences and reports how many were sent and how many suppressed, with reasons. | — | `crm/` · `notifications/` | B5.14 | Integration (suppression report); `FR-CRM-07`; `FR-USER-04`; `FR-NOTF-02` | NOT STARTED |
| `[ ]` | ↳ **AC-CRM-01.3** | **Given** a flagged member checks in, **when** the check-in records, **then** the flag clears automatically. | — | `crm/` · `attendance/` | B5.14 | Integration; `FR-CRM-06`; `JOB-18 crm.risk-flags` | NOT STARTED |

### 10.15 `STAF` — Staff, Roles & Permissions (§B5.15)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-STAF-01** | *As Rohan, I want a receptionist who can take money but cannot change prices.* | — | `staff/` · `iam/` | B5.15 | E2E + RBAC; `E2E-10`; all of `AC-STAF-01.1` … `AC-STAF-01.4` | NOT STARTED |
| `[ ]` | ↳ **AC-STAF-01.1** | **Given** I invite a user as `RECEPTIONIST` at branch 1, **when** they sign in, **then** they see check-in, member management and sale recording for branch 1 only. | — | `staff/` · `dash` | B5.15 | E2E + Isolation; `FR-STAF-03`; `FR-NAV-03`; `staff_branches` | NOT STARTED |
| `[ ]` | ↳ **AC-STAF-01.2** | **Given** they are a `RECEPTIONIST`, **when** they attempt to open plan editing by direct URL, **then** the request is refused server-side with a permission error, not merely hidden in the UI. | — | `iam/` · `plans/` | B5.15 | Contract (403 negative); `FR-RBAC-02`; §B3.2 *Create / edit plan* | NOT STARTED |
| `[ ]` | ↳ **AC-STAF-01.3** | **Given** they collected cash payments, **when** I open their activity log, **then** every collection is listed with amount, member, timestamp and order reference. | — | `staff/` · `payments/` | B5.15 | Integration; `FR-STAF-05`; `payments.collected_by_staff_id`; tenant report *Staff activity* | NOT STARTED |
| `[ ]` | ↳ **AC-STAF-01.4** | **Given** I remove them, **when** they next make any request, **then** it is refused, and their historical attributions remain intact and attributed to them. | — | `staff/` · `iam/` | B5.15 | Contract (negative) + Integration (attribution retained); `FR-STAF-04`; `FR-RBAC-04` | NOT STARTED |

### 10.16 `REV` — Reviews & Ratings (§B5.16)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-REV-01** | *As a gym owner, I want a fair chance to answer a bad review, and no ability to hide it.* | — | `reviews/` | B5.16 | E2E; `E2E-09`; all of `AC-REV-01.1` … `AC-REV-01.3` | NOT STARTED |
| `[ ]` | ↳ **AC-REV-01.1** | **Given** a review is published about my gym, **when** I open it, **then** I may post one public response. | — | `reviews/` | B5.16 | Integration; `FR-REV-05`; `review_responses`; `BR-REV-05` | NOT STARTED |
| `[ ]` | ↳ **AC-REV-01.2** | **Given** a published review, **when** I look for a delete or edit action on it, **then** none exists anywhere in the interface or API. | — | `reviews/` | B5.16 | Contract (no such endpoint) + E2E (no such control); `BR-REV-05`; `E2E-09` | NOT STARTED |
| `[ ]` | ↳ **AC-REV-01.3** | **Given** I believe a review is fraudulent, **when** I report it with a reason, **then** it remains published, a moderation case opens, and I am notified of the outcome. | — | `reviews/` · `notifications/` | B5.16 | Integration + E2E; `FR-REV-06`; `BR-REV-06`; `review_reports` | NOT STARTED |
| `[ ]` | **US-REV-02** | *As a platform, I want fake reviews to be structurally difficult.* | — | `reviews/` | B5.16 | E2E; `BAC-09`; all of `AC-REV-02.1` … `AC-REV-02.3` | NOT STARTED |
| `[ ]` | ↳ **AC-REV-02.1** | **Given** a user has never checked in at a gym, **when** they attempt to submit a review by direct API call, **then** it is refused with 403. | — | `reviews/` · `attendance/` | B5.16 | Contract (403 negative); `BR-REV-01`; `FR-REV-01`; `BAC-09`; `PRIN-05` | NOT STARTED |
| `[ ]` | ↳ **AC-REV-02.2** | **Given** a gym receives an unusual burst of 5-star reviews from accounts created within the same period, **when** the anomaly detector runs, **then** those reviews are held for moderation and excluded from the aggregate until cleared. | — | `reviews/` | B5.16 | Integration; `FR-REV-09`; `JOB-13 review.anomaly-scan`; `RSK-02` | NOT STARTED |
| `[ ]` | ↳ **AC-REV-02.3** | **Given** a review is unpublished by a moderator, **when** the gym's rating renders, **then** the aggregate recalculates without it within one minute. | — | `reviews/` | B5.16 | Integration (timed) + E2E; `FR-REV-08`; `JOB-12 review.aggregate`; `E2E-09` | NOT STARTED |

### 10.17 `CPN` — Coupons & Promotions (§B5.17)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-CPN-01** | *As Rohan, I want a first-month discount that only new customers can use.* | — | `ordering/` | B5.17 | E2E; `E2E-06`; all of `AC-CPN-01.1` … `AC-CPN-01.4` | NOT STARTED |
| `[ ]` | ↳ **AC-CPN-01.1** | **Given** a coupon marked first-purchase-only, **when** a user with a prior completed order applies it, **then** it is refused with the specific reason. | — | `ordering/` | B5.17 | Integration (negative); `FR-CPN-06`; `EVT-18 coupon_rejected` | NOT STARTED |
| `[ ]` | ↳ **AC-CPN-01.2** | **Given** a per-user limit of 1, **when** the same user applies it on a second order, **then** it is refused. | — | `ordering/` | B5.17 | Integration (negative); `coupons.per_user_limit`; `coupon_redemptions` | NOT STARTED |
| `[ ]` | ↳ **AC-CPN-01.3** | **Given** the total usage cap is reached, **when** any user applies it, **then** it is refused and the coupon is automatically marked exhausted in the dashboard. | — | `ordering/` · `dash` | B5.17 | Integration (negative at the cap boundary); `coupons.total_limit`; `SCR-DASH-016` | NOT STARTED |
| `[ ]` | ↳ **AC-CPN-01.4** | **Given** the coupon is gym-funded, **when** settlement computes, **then** the commission base is the post-discount net amount. | — | `ordering/` · `settlements/` | B5.17 | Unit (commission base per §A6.3) + `E2E-06`; `BR-CPN-05`; `BR-FIN-04` | NOT STARTED |

### 10.18 `REFR` — Referrals & Wallet (§B5.18)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-REFR-01** | *As a member, I want credit for bringing a friend, and I want to see where it is.* | — | `crm/` · `web` | B5.18 | E2E; `SCR-WEB-015`; all of `AC-REFR-01.1` … `AC-REFR-01.3` | NOT STARTED |
| `[ ]` | ↳ **AC-REFR-01.1** | **Given** my friend registers via my link and buys a membership, **when** the refund window on their purchase closes, **then** my reward is credited and I am notified. | — | `crm/` · `refunds/` · `notifications/` | B5.18 | Integration (clock advance past the window); `BR-RFL-01`; `FR-REFR-04` | NOT STARTED |
| `[ ]` | ↳ **AC-REFR-01.2** | **Given** their purchase is refunded within the window, **when** the refund completes, **then** no reward is credited and my dashboard shows the referral as not qualified with the reason. | — | `crm/` · `refunds/` | B5.18 | Integration (negative); `BR-RFL-01`; `FR-REFR-05` | NOT STARTED |
| `[ ]` | ↳ **AC-REFR-01.3** | **Given** I attempt to use my own referral link, **when** I register, **then** no attribution is created. | — | `crm/` | B5.18 | Integration (negative); `FR-REFR-07` self-referral prevention | NOT STARTED |

### 10.19 `RPT` — Reports & Analytics (§B5.20)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-RPT-01** | *As Rohan, I want to know which plan actually makes me money.* | — | `reporting/` | B5.20 | E2E; tenant report *Revenue by plan*; all of `AC-RPT-01.1` … `AC-RPT-01.3` | NOT STARTED |
| `[ ]` | ↳ **AC-RPT-01.1** | **Given** sales exist across several plans, **when** I open revenue by plan, **then** each plan shows units, gross, discounts, net and share of total. | — | `reporting/` | B5.20 | Integration; tenant report *Revenue by plan*; `FR-RPT-01` | NOT STARTED |
| `[ ]` | ↳ **AC-RPT-01.2** | **Given** I click a plan's net figure, **when** the drill-down opens, **then** I see the individual orders composing it. | — | `reporting/` | B5.20 | E2E; `FR-RPT-05` traceability | NOT STARTED |
| `[ ]` | ↳ **AC-RPT-01.3** | **Given** I export, **when** the CSV opens, **then** column headers are human-readable and every monetary column is a plain number with a separate currency column. | — | `reporting/` | B5.20 | Integration (column-shape assertion); `NFR-DQ-02`; `BR-PAY-01`; persona §B2.5 | NOT STARTED |

### 10.20 `SETL` — Settlements & Payouts (§B5.21)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-SETL-01** | *As Rohan, I want to understand exactly why I received the amount I received.* | — | `settlements/` | B5.21 | E2E; `E2E-12`; `UAT-05`; all of `AC-SETL-01.1` … `AC-SETL-01.4` | NOT STARTED |
| `[ ]` | ↳ **AC-SETL-01.1** | **Given** a payout is made, **when** I open its statement, **then** every transaction is listed with all eight figures and the arithmetic visibly sums to the payout amount. | — | `settlements/` | B5.21 | Unit (arithmetic) + E2E; `BR-FIN-02`, `BR-FIN-03`; `SCR-DASH-014` detail | NOT STARTED |
| `[ ]` | ↳ **AC-SETL-01.2** | **Given** a refund occurred in the period, **when** I view the statement, **then** it appears as a negative line with a reference to the original sale. | — | `settlements/` · `refunds/` | B5.21 | Integration + E2E; `FR-SETL-03`; `E2E-07`, `E2E-12` | NOT STARTED |
| `[ ]` | ↳ **AC-SETL-01.3** | **Given** reserve was withheld, **when** I view the statement, **then** the amount, the reason and the scheduled release date are stated. | — | `settlements/` | B5.21 | Integration + E2E; `FR-SETL-04`; ledger `RESERVE_HOLD` / `RESERVE_RELEASE`; `OQ-04` | NOT STARTED |
| `[ ]` | ↳ **AC-SETL-01.4** | **Given** my balance was negative, **when** the next batch runs, **then** the recovery is shown as an explicit opening balance line. | — | `settlements/` | B5.21 | Integration; `FR-SETL-10`; `settlement_batches.opening_balance_minor` | NOT STARTED |

### 10.21 `RFND` — Refunds & Disputes (§B5.22)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-RFND-01** | *As a member, I want my money back within the stated window without an argument.* | — | `refunds/` | B5.22 | E2E; `E2E-07`; `UAT-03`; all of `AC-RFND-01.1` … `AC-RFND-01.3` | NOT STARTED |
| `[ ]` | ↳ **AC-RFND-01.1** | **Given** I am within the gym's stated no-questions window with no check-ins, **when** I request a refund, **then** it auto-approves and the gateway refund initiates within one business day. | — | `refunds/` | B5.22 | Integration (timed) + E2E; `FR-RFND-03`; `BR-REF-03`; `SMT-41`; `OQ-05` | NOT STARTED |
| `[ ]` | ↳ **AC-RFND-01.2** | **Given** I have checked in 8 times of a 30-day plan, **when** I request a refund, **then** the pro-rata computation is shown to me before I confirm, and approval routes to platform review. | — | `refunds/` · `attendance/` | B5.22 | Unit (proration) + E2E; `FR-RFND-04`; `BR-REF-06`; `SMT-42` | NOT STARTED |
| `[ ]` | ↳ **AC-RFND-01.3** | **Given** my refund completes, **when** I open my account, **then** the membership shows `REFUNDED`, the credit note is downloadable, and my QR no longer generates. | — | `refunds/` · `memberships/` · `billing/` · `attendance/` | B5.22 | E2E; `E2E-07`; `FR-RFND-06`; `SMT-10`; `SCR-WEB-009` `REFUNDED` state | NOT STARTED |
| `[ ]` | **US-RFND-02** | *As Vikram, I want a chargeback to not become a surprise.* | — | `refunds/` | B5.22 | E2E; `UAT-05`; all of `AC-RFND-02.1` … `AC-RFND-02.3` | NOT STARTED |
| `[ ]` | ↳ **AC-RFND-02.1** | **Given** a chargeback webhook arrives, **when** it processes, **then** a case is created, the amount is held against the tenant balance, and both Finance and the tenant are notified with the deadline. | — | `refunds/` · `ledger/` · `notifications/` | B5.22 | Integration; `FR-RFND-08`, `FR-RFND-10`; `BR-REF-08`; `disputes.evidence_due_at` | NOT STARTED |
| `[ ]` | ↳ **AC-RFND-02.2** | **Given** a case is open, **when** I open it, **then** the evidence pack is pre-assembled and downloadable. | — | `refunds/` · `admin` | B5.22 | Integration + E2E; `FR-RFND-09`; `SCR-ADM-009` | NOT STARTED |
| `[ ]` | ↳ **AC-RFND-02.3** | **Given** the case resolves in the tenant's favour, **when** the resolution webhook arrives, **then** the hold releases and the amount returns to the next settlement. | — | `refunds/` · `settlements/` · `ledger/` | B5.22 | Integration + E2E; ledger `CHARGEBACK_REVERSAL`; `FR-SETL-03` | NOT STARTED |

### 10.22 `ADMN` — Platform Administration & Audit (§B5.24)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **US-ADMN-01** | *As a super admin, I want to give one tenant a promotional commission rate without touching anyone else.* | — | `admin/` · `settlements/` | B5.24 | E2E; `UAT-06`; all of `AC-ADMN-01.1` … `AC-ADMN-01.4` | NOT STARTED |
| `[ ]` | ↳ **AC-ADMN-01.1** | **Given** a tenant on the Growth tier, **when** I set a tenant-level commission override with a reason, **then** their effective rate reflects the override and the tier rate is unchanged for all other tenants. | — | `admin/` | B5.24 | Integration (blast-radius negative on a sibling tenant); `FR-ADMN-03`; `tenants.commission_rate_bps` | NOT STARTED |
| `[ ]` | ↳ **AC-ADMN-01.2** | **Given** the override exists, **when** I view the tenant, **then** the effective rate is shown together with its source ("tenant override, set by \<actor\> on \<date\>, reason: \<reason\>"). | — | `admin/` | B5.24 | E2E; `FR-ADMN-03` effective-rate resolver; `SCR-ADM-011` | NOT STARTED |
| `[ ]` | ↳ **AC-ADMN-01.3** | **Given** the override has an end date, **when** it passes, **then** the rate reverts to the tier rate automatically and both the tenant and Finance are notified. | — | `admin/` · `notifications/` | B5.24 | Integration (clock advance); `FR-ADMN-03`; `SCR-ADM-004` validity window | NOT STARTED |
| `[ ]` | ↳ **AC-ADMN-01.4** | **Given** settlements ran during the override, **when** I view historical statements, **then** they show the rate that applied at the time, not the current rate. | — | `settlements/` | B5.24 | Integration; `BR-FIN-05`; `settlement_lines` persisted figures | NOT STARTED |
| `[ ]` | **US-ADMN-02** | *As an auditor, I want to reconstruct who changed what.* | — | `audit/` · `admin/` | B5.24 | E2E; `BAC-13`; `UAT-06`; all of `AC-ADMN-02.1` … `AC-ADMN-02.3` | NOT STARTED |
| `[ ]` | ↳ **AC-ADMN-02.1** | **Given** any entity id, **when** I query the audit log, **then** I see every change in chronological order with actor, timestamp, IP, before-state and after-state. | — | `audit/` | B5.24 | Integration + E2E; `FR-ADMN-09`; `BR-DAT-01`; `audit_log (entity_type, entity_id, occurred_at)` index | NOT STARTED |
| `[ ]` | ↳ **AC-ADMN-02.2** | **Given** a support agent impersonated a user, **when** I query that user's audit trail, **then** the impersonation, its reason, its duration and every action taken during it are visible and marked as impersonated. | — | `audit/` · `iam/` | B5.24 | Integration; `audit_log.impersonated_by`; `BR-DAT-02`; `SCR-ADM-015` impersonation filter | NOT STARTED |
| `[ ]` | ↳ **AC-ADMN-02.3** | **Given** I attempt to modify or delete an audit record through any interface, **then** no such capability exists. | — | `audit/` | B5.24 | Contract (no such endpoint) + Integration (no `UPDATE`/`DELETE` grant); `NFR-SEC-13` | NOT STARTED |

---

## 11. Screens — 55 `SCR-` plus 220 mandatory state sub-rows

**Source:** §B6 (customer website, 18), §B7 (gym owner dashboard, 22), §B8 (super-admin console, 15)
= **55 screens**.

§B6 opens with the governing rule: *"**States are specified for every screen** because the empty,
loading, error and permission-denied cases are where implementations diverge from intent."* Every
screen therefore carries **four** mandatory state sub-rows, giving **55 × 4 = 220** state rows:

| Suffix | State | Tick condition |
| :-- | :--- | :--- |
| `-L` | **Loading** | A deliberate loading treatment exists (skeleton, overlay, progressive region) — never an unstyled blank, never a layout shift on arrival. |
| `-E` | **Empty** | A first-run / no-data treatment exists that explains the emptiness and offers the next action. Where the PRD specifies the empty copy or behaviour, it is reproduced in the row. |
| `-X` | **Error** | A recoverable failure treatment exists that states what happened, why, and what to do next (`NFR-USE-05`), with a retry affordance where retry is meaningful. |
| `-P` | **Permission-denied** | An unauthorised actor reaching the screen — by menu, deep link or direct URL — is refused **server-side** (`FR-RBAC-02`) and shown an explanatory state, not a blank page and not a silently-empty list. |

Where the PRD specifies a state explicitly, its text is reproduced. Where it does not, the state is
still mandatory and the row states the rule that governs it. `-P` is mandatory even on public
screens: on `web` the rule is that the screen must remain fully usable unauthenticated up to the auth
gate (`FR-NAV-01`), and any authenticated-only affordance on it must degrade to an auth prompt rather
than an error.

### 11.1 Customer Website (`web`) — `SCR-WEB-001` … `SCR-WEB-018` (§B6)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **SCR-WEB-001** | **Home.** Establish location, communicate the value proposition, and route to search within one interaction. Above the fold: headline, sub-headline, prominent search bar (location + optional query), primary CTA "Find gyms near me". Regions: (1) hero with search; (2) "Popular near you" — 8 gym cards; (3) category tiles (24-hour, women-only, budget, premium, CrossFit, yoga); (4) how it works — 3 steps; (5) trust strip (verified gyms count, members count, cities); (6) featured gyms (labelled promoted); (7) "List your gym" band for owners; (8) footer. Data: nearby gyms by IP or stored location, category counts, platform trust counters. Actions: search, select category, open gym, request location permission, register. **Note:** location permission is requested contextually on the CTA, never on page load. | — | `web` · `discovery/` | B6 | E2E; `FR-SRCH-01`, `FR-SRCH-11`; `EVT-` discovery events | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-001-L** | **Loading** — skeleton cards; the search bar is interactive immediately and never blocked by content loading. | — | `web` | B6 | E2E (search bar interactive during load) | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-001-E** | **Empty (no gyms in area)** — "We're not in yet" with an email capture for launch notification and a link to the nearest served city. | — | `web` | B6 | E2E; §B5.6 edge case *user outside any served city*; demand-signal capture | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-001-X** | **Error** — static content renders; dynamic strips degrade to hidden with no error dialog. | — | `web` | B6 | E2E (fault injection); `PRIN-06` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-001-P** | **Permission-denied** — fully public; no authenticated-only affordance may error. Favourite and register CTAs route to the auth gate with return context intact. | — | `web` | B6 | E2E; `FR-NAV-01`, `FR-NAV-02`, `FR-FAV-03` | NOT STARTED |
| `[ ]` | **SCR-WEB-002** | **Search Results.** Narrow many gyms to a shortlist. Desktop layout: left filter rail (sticky), centre result list, right map (sticky, 40% width). Mobile layout: full-width list, filters in a bottom sheet, map behind a toggle that becomes full-screen. Filter rail: distance slider, price range, amenities (searchable multi-select), rating, open now, 24-hour, gender policy, plan durations available, trial available, parking — each filter shows a live result count. Sort control: relevance, distance, price low-high, rating, newest. Result card: cover photo (4:3), name, verified badge, distance, rating + count, lowest monthly-equivalent price, 3 amenity chips, open/closed pill, favourite toggle, compare checkbox. Map: clustered pins, price labels at close zoom, bidirectional hover/click sync with the list, "Search this area" on pan. Selection bar appears when ≥2 gyms are checked for comparison, showing count and "Compare". URL state: location, query, all filters, sort and page are encoded in the URL and restored on load. | — | `web` · `discovery/` | B6 | E2E; `US-SRCH-01`, `US-SRCH-02`; `FR-SRCH-03` … `FR-SRCH-08`; `NFR-PERF-01` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-002-L** | **Loading** — 6 skeleton cards; map shows a loading overlay, not a blank tile. | — | `web` | B6 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-002-E** | **Empty** — names the most restrictive filter, offers one-tap relaxation with the resulting count previewed, plus radius expansion and nearby cities. | — | `web` · `discovery/` | B6 | E2E; `AC-SRCH-01.2`; `FR-SRCH-12`; `EVT-03 search_zero_results` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-002-X** | **Error** — retry affordance; last successful results retained where possible. | — | `web` | B6 | E2E (fault injection); `NFR-USE-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-002-P** | **Permission-denied** — public. Favourite and compare-save affordances route to the auth gate preserving filters, sort, location and comparison set. | — | `web` | B6 | E2E; `FR-NAV-01`, `FR-NAV-02`; `FR-DETL-09` | NOT STARTED |
| `[ ]` | **SCR-WEB-003** | **Gym Detail.** Give a prospective member enough to decide without visiting. Regions: (1) gallery with lightbox; (2) header — name, verified badge, rating summary, locality, open/closed, share, favourite; (3) sticky plan panel (desktop right column) with the cheapest plan and a "View plans" jump; (4) amenities grid; (5) timings table with today highlighted; (6) gender policy; (7) about; (8) plans section; (9) location map with directions link, landmark, parking note; (10) reviews with rating distribution; (11) similar gyms nearby; (12) report this gym. Plan card: name, duration, price, monthly equivalent, joining fee, inclusions, access-window note if restricted, "Buy now". Review item: display name, tenure band ("Member for 4 months"), verified marker, rating, sub-ratings, text, photos, date, gym response. Actions: buy plan, favourite, compare, share, report, view all reviews, get directions. SEO: server-rendered; structured data for local business, aggregate rating and offers; canonical URL. | — | `web` · `discovery/` | B6 | E2E; `FR-DETL-01` … `FR-DETL-07`, `FR-DETL-10`; `NFR-PERF-02` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-003-L** | **Loading** — loading skeleton across all regions with no layout shift when content arrives. | — | `web` | B6 | E2E; `NFR-PERF-02` (LCP ≤ 2.5 s on 4G) | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-003-E** | **Empty** — gym has <3 reviews → count shown, no numeric rating. Empty amenity, media or plan collections render an explicit "not provided" rather than a blank region. | — | `web` · `reviews/` | B6 | E2E; `AC-DETL-02.1`; `BR-REV-07` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-003-X** | **Error** — gym suspended → informational page explaining unavailability with similar gyms (never a 404 for a previously-live URL). Transient failures show a retry affordance. | — | `web` | B6 | E2E; `FR-DETL-11`; `BR-TEN-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-003-P** | **Permission-denied** — public. "Report this gym" is available only to authenticated users and routes to the auth gate; a staff-only plan is never rendered here to anyone. | — | `web` · `plans/` | B6 | E2E + Contract negative; `FR-DETL-06`; `BR-PLN-05` | NOT STARTED |
| `[ ]` | **SCR-WEB-004** | **Comparison.** Resolve a shortlist into a choice. Layout: fixed attribute column on the left; one column per gym (max 4), horizontally scrollable on mobile with the attribute column pinned. Rows: photo, name, distance, rating and count, verified, price by duration (1/3/6/12 months), joining fee, amenities (presence matrix), timings, gender policy, trial availability, review highlights. Emphasis: differing values are visually emphasised; identical values are de-emphasised. Actions: remove a gym, add another (returns to search with the comparison retained), buy from any column. Persistence: comparison set survives reload and login. | — | `web` · `discovery/` | B6 | E2E; `US-DETL-01`; `FR-DETL-08`, `FR-DETL-09` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-004-L** | **Loading** — column skeletons with the attribute column rendered immediately so the row structure is stable. | — | `web` | B6 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-004-E** | **Empty** — no gyms in the comparison set → prompt to add from search, with a direct link back to results. | — | `web` | B6 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-004-X** | **Error** — a gym that fails to resolve is shown as an errored column with retry; the remaining columns still render. | — | `web` | B6 | E2E (partial failure); `PRIN-06` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-004-P** | **Permission-denied** — public; buy actions route to the auth gate preserving the comparison set and selected plan. | — | `web` | B6 | E2E; `FR-NAV-02`; `FR-DETL-09` | NOT STARTED |
| `[ ]` | **SCR-WEB-005** | **Checkout.** Collect the minimum required to sell, and disclose everything required to be fair. Regions: (1) order summary — gym, plan, duration, start date picker, add-ons; (2) coupon field with apply/remove; (3) price breakdown — plan price, joining fee, add-ons, discount, tax, total; (4) member details (pre-filled, editable); (5) refund policy disclosure (the gym's stated policy, in full, not a link); (6) terms acceptance; (7) "Proceed to payment". Validation: age, gender eligibility, concurrent membership conflict, plan availability — all server-checked before payment is offered. Actions: apply/remove coupon, change start date, edit details, proceed, cancel. **Note:** amounts are always server-returned; the client submits a plan id, a start date, an optional coupon code and an idempotency key — **never a price**. | — | `web` · `ordering/` | B6 | E2E; `E2E-02`, `E2E-06`; `FR-CART-02` … `FR-CART-07`; form library pending `A-09` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-005-L** | **Loading** — price breakdown renders as a skeleton until the server returns; the "Proceed to payment" control is disabled until amounts are authoritative. | — | `web` | B6 | E2E; `FR-CART-04` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-005-E** | **Empty** — order expired → a new order is offered with prices re-validated. | — | `web` · `ordering/` | B6 | E2E; `FR-CART-05`; §B5.9 edge case *order expires while payment page open*; `410 Gone` per §C3.1 | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-005-X** | **Error** — coupon invalid → inline reason; price changed since page load → blocking modal showing old and new price requiring re-confirmation; plan archived → blocking message with alternatives. | — | `web` · `ordering/` | B6 | E2E; `AC-PLAN-02.2`, `AC-PLAN-02.3`; §C3.3 `PLAN_PRICE_CHANGED` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-005-P** | **Permission-denied** — authentication is required here (the auth gate sits immediately before this screen); an ineligible buyer (age, gender, concurrent non-stackable membership) is refused server-side with the specific reason and a renewal path where applicable. | — | `web` · `ordering/` | B6 | E2E + Contract negative; `FR-NAV-01`; `FR-CART-07`; `BR-MEM-04` | NOT STARTED |
| `[ ]` | **SCR-WEB-006** | **Payment.** Hand off to the gateway and return safely. Content: amount payable, order reference, gateway element or redirect, security assurance, "do not close this window" guidance. **Note:** the confirmation screen never asserts activation on the client redirect alone; it reflects server state. | — | `web` · `payments/` | B6 | E2E; `BR-PAY-02`; `NFR-PERF-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-006-L** | **Loading / processing** — non-dismissible, with an elapsed indicator. | — | `web` | B6 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-006-E** | **Empty / timeout** — "we're confirming your payment" with automatic polling and an explicit message that no second attempt should be made. | — | `web` · `payments/` | B6 | E2E; `AC-PAY-02.2`; `FR-PAY-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-006-X** | **Error / failure** — reason in customer language plus retry; success → redirect to confirmation. | — | `web` · `payments/` | B6 | E2E; `AC-PAY-02.3`; `FR-PAY-06`; `NFR-USE-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-006-P** | **Permission-denied** — a payment page for an order belonging to another user is refused server-side; the order reference alone never grants access. | — | `web` · `ordering/` | B6 | Contract negative + Isolation; `BR-TEN-01`; `FR-CART-11` | NOT STARTED |
| `[ ]` | **SCR-WEB-007** | **Order Confirmation.** Content: success confirmation, membership summary (gym, plan, start, end), QR access CTA, invoice download, "add to calendar" for start date, next steps (what to bring, timings, location), review-later note. | — | `web` · `ordering/` | B6 | E2E; `E2E-02`; `BAC-04` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-007-L** | **Loading** — summary skeleton while server state is fetched; never an optimistic success rendered from client state. | — | `web` | B6 | E2E; `BR-PAY-02` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-007-E** | **Pending state** — if the webhook has not yet landed, show "confirming payment" with live polling, and never a failure message before the reconciliation threshold elapses. | — | `web` · `payments/` | B6 | E2E; `AC-PAY-02.2`; `BR-PAY-06` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-007-X** | **Error** — genuine failure past the threshold shows the reason and a retry against the same unexpired order. | — | `web` · `payments/` | B6 | E2E; `FR-PAY-06` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-007-P** | **Permission-denied** — confirmation for another user's order is refused server-side. | — | `web` | B6 | Contract negative + Isolation; `BR-TEN-01` | NOT STARTED |
| `[ ]` | **SCR-WEB-008** | **Account Home.** Content: active membership cards with days remaining and a QR shortcut; next expiry callout; recent visits; recent orders; favourites preview; referral prompt. | — | `web` · `memberships/` | B6 | E2E; `FR-MEMB-03`; `FR-CHK-11`; `FR-REFR-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-008-L** | **Loading** — per-region skeletons; membership cards load first because they are the reason the member opened the page. | — | `web` | B6 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-008-E** | **Empty** — no memberships → discovery CTA with nearby gyms. | — | `web` · `discovery/` | B6 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-008-X** | **Error** — a failing region degrades to a retry affordance without taking down the rest of the page. | — | `web` | B6 | E2E (per-region fault injection); `PRIN-06` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-008-P** | **Permission-denied** — unauthenticated access redirects to login and returns here afterwards; never shows another user's account. | — | `web` · `iam/` | B6 | E2E + Isolation; `FR-NAV-02` | NOT STARTED |
| `[ ]` | **SCR-WEB-009** | **Membership Detail & QR.** Get the member through the door. Content: gym name and branch entitlement, plan, status pill, start and end dates, days remaining (or sessions remaining), large QR with a visible countdown and auto-refresh, brightness hint, invoice link, attendance summary, freeze action (if permitted), renew action, cancel/refund path, gym contact and directions. Behaviour: the QR refreshes automatically every 60 seconds while the screen is visible, and pauses when backgrounded. | — | `web` · `attendance/` · `memberships/` | B6 | E2E; `E2E-03`; `FR-CHK-01`; `BR-CHK-02`; QR render library pending `A-10` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-009-L** | **Loading** — status and dates render before the QR; the QR area reserves its space so the layout does not shift when the token arrives. | — | `web` | B6 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-009-E** | **Empty / non-scannable states** — `PENDING` future start → QR replaced by "starts on \<date\>"; `FROZEN` → QR replaced by frozen notice with end date and unfreeze action; `EXPIRED` → QR replaced by renew CTA; `REFUNDED` → historical view only. | — | `web` · `memberships/` | B6 | E2E (one case per state); `AC-CART-01.2`; `AC-MEMB-01.2`; `AC-RFND-01.3` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-009-X** | **Error** — token issuance failure shows an explicit retry and never a stale or fabricated QR. | — | `web` · `attendance/` | B6 | E2E (fault injection); `FR-CHK-01` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-009-P** | **Permission-denied** — only the membership's own holder may generate its token; any other principal is refused server-side. | — | `attendance/` | B6 | Contract negative + Isolation; §B3.2 *Generate own check-in QR* | NOT STARTED |
| `[ ]` | **SCR-WEB-010** | **Visit History.** Content: chronological visit list with date, time, branch, duration where available; monthly summary; current streak; simple frequency chart. | — | `web` · `attendance/` | B6 | E2E; `FR-CHK-11`; `API-MEMB GET /me/attendance` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-010-L** | **Loading** — list skeleton with the monthly summary reserved. | — | `web` | B6 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-010-E** | **Empty** — "No visits yet" with the QR shortcut. | — | `web` | B6 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-010-X** | **Error** — retry affordance; the summary and chart hide rather than render wrong figures. | — | `web` | B6 | E2E (fault injection) | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-010-P** | **Permission-denied** — only the member's own attendance is readable here. | — | `attendance/` | B6 | Contract negative + Isolation; `BR-TEN-01` | NOT STARTED |
| `[ ]` | **SCR-WEB-011** | **Orders & Invoices.** Content: order list with date, gym, plan, amount, status; invoice and credit-note downloads; refund status where applicable. | — | `web` · `ordering/` · `billing/` | B6 | E2E; `FR-INV-08`; `FR-RFND-11`; `FR-CART-11` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-011-L** | **Loading** — table skeleton; download controls disabled until the document reference resolves. | — | `web` | B6 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-011-E** | **Empty** — no orders → discovery CTA rather than a bare empty table. | — | `web` | B6 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-011-X** | **Error** — a failed PDF fetch reports the specific failure and offers retry; it never silently serves a stale document. | — | `web` · `billing/` | B6 | E2E; `FR-INV-07` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-011-P** | **Permission-denied** — invoices and credit notes are readable only by the member, the tenant and Finance; any other principal is refused. | — | `billing/` | B6 | Contract negative + RBAC; `FR-INV-08` | NOT STARTED |
| `[ ]` | **SCR-WEB-012** | **Favourites.** Content: saved gym cards with current lowest price and any change since saving; unavailable gyms shown as unavailable rather than removed. | — | `web` · `discovery/` | B6 | E2E; `US-FAV-01`; `FR-FAV-02` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-012-L** | **Loading** — card skeletons; price-change indicators appear only once current prices resolve. | — | `web` | B6 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-012-E** | **Empty** — no favourites → prompt to shortlist from search with a link to results. | — | `web` | B6 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-012-X** | **Error** — a gym that fails to resolve renders as an errored card with retry; the rest of the list still renders. | — | `web` | B6 | E2E (partial failure) | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-012-P** | **Permission-denied** — authentication required; an unauthenticated arrival is sent to login and returned here with the pending favourite applied. | — | `web` | B6 | E2E; `AC-FAV-01.1`; `FR-FAV-03` | NOT STARTED |
| `[ ]` | **SCR-WEB-013** | **Write / Edit Review.** Access: reachable only when eligibility is satisfied server-side. Content: overall rating, optional sub-ratings, text with character counter, optional photos, guidelines summary. | — | `web` · `reviews/` | B6 | E2E; `E2E-09`; `FR-REV-01`, `FR-REV-02` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-013-L** | **Loading** — eligibility is resolved before the form renders; the compose UI never appears speculatively. | — | `web` · `reviews/` | B6 | E2E; `API-REV GET /gyms/:slug/reviews/eligibility` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-013-E** | **Empty / ineligible** — ineligible → explanation of the check-in requirement. | — | `web` · `reviews/` | B6 | E2E; `BR-REV-01`; `PRIN-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-013-X** | **Error / non-editable states** — already reviewed → edit within 7 days, otherwise read-only; held for moderation → clear status message. Submission failures preserve the drafted text. | — | `web` · `reviews/` | B6 | E2E; `FR-REV-04`; `BR-REV-02`; `SM-06` `HELD` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-013-P** | **Permission-denied** — direct API submission by a user with no recorded check-in is refused with 403. | — | `reviews/` | B6 | Contract negative (403); `AC-REV-02.1`; `BAC-09` | NOT STARTED |
| `[ ]` | **SCR-WEB-014** | **Profile & Preferences.** Content: personal details, contact with verification state, fitness context, notification preferences matrix (channel × category), password and MFA, active sessions, account activity, data export, delete account. | — | `web` · `iam/` | B6 | E2E; `FR-USER-01` … `FR-USER-08`; `FR-AUTH-07`, `FR-AUTH-09` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-014-L** | **Loading** — section-level skeletons; the preferences matrix is disabled until current values load so no default is submitted by accident. | — | `web` | B6 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-014-E** | **Empty** — no active sessions beyond the current one, no recorded activity, or no fitness context → each renders an explicit "nothing recorded" rather than a blank section. | — | `web` | B6 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-014-X** | **Error** — a failed preference save reverts the control to its stored value and states the failure; it never leaves the UI showing an unsaved state as saved. | — | `web` · `notifications/` | B6 | E2E; `NFR-USE-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-014-P** | **Permission-denied** — a user may read and write only their own profile; impersonating agents see the banner and are refused financial mutations. | — | `iam/` | B6 | Contract negative + Isolation; `AC-AUTH-03.2` | NOT STARTED |
| `[ ]` | **SCR-WEB-015** | **Referrals.** Content: referral code and link, share affordances, invited list with status, rewards earned and pending with qualification explanation. | — | `web` · `crm/` | B6 | E2E; `US-REFR-01`; `FR-REFR-01`, `FR-REFR-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-015-L** | **Loading** — code and link render first; the invited list and rewards load progressively. | — | `web` | B6 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-015-E** | **Empty** — nobody invited yet → share prompt explaining the reward terms and when a reward qualifies. | — | `web` | B6 | E2E; `BR-RFL-01` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-015-X** | **Error** — retry affordance; a pending reward is never displayed as earned when its state cannot be confirmed. | — | `web` · `crm/` | B6 | E2E; `AC-REFR-01.2` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-015-P** | **Permission-denied** — authentication required; another member's referral data is never readable. | — | `crm/` | B6 | Contract negative + Isolation | NOT STARTED |
| `[ ]` | **SCR-WEB-016** | **Auth Screens.** Screens: Login (phone OTP or email/password), Register, Verify OTP, Forgot password, Reset password. Behaviour: every auth screen preserves and restores the pre-auth destination and state. | — | `web` · `iam/` | B6 | E2E; `US-AUTH-01`; `FR-AUTH-01` … `FR-AUTH-05`, `FR-AUTH-10`; `FR-NAV-02` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-016-L** | **Loading** — submit controls disable during in-flight requests to prevent double submission; OTP resend shows its cooldown. | — | `web` | B6 | E2E; `FR-AUTH-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-016-E** | **Empty** — first-visit state with no pre-filled identifier still preserves the return destination captured at the gate. | — | `web` | B6 | E2E; `FR-NAV-02` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-016-X** | **Error** — wrong OTP shows remaining attempts; rate limit states when retry is possible; lockout states the unlock path; SMS provider failure offers email verification instead of a generic failure. | — | `web` · `iam/` | B6 | E2E; `AC-AUTH-01.3`, `AC-AUTH-01.4`, `AC-AUTH-01.5`; `FR-AUTH-08` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-016-P** | **Permission-denied** — an already-authenticated user reaching an auth screen is routed to their destination rather than shown a second login; a reset token that is expired, used or belongs to another identity is refused. | — | `web` · `iam/` | B6 | E2E + Contract negative; `FR-AUTH-10` | NOT STARTED |
| `[ ]` | **SCR-WEB-017** | **Support.** Content: help centre search, article view, ticket list, new ticket with contextual attachment of an order/membership. | — | `web` · `support/` | B6 | E2E; `FR-SUP-01`, `FR-SUP-02`, `FR-SUP-06` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-017-L** | **Loading** — article and ticket skeletons; the search field is interactive immediately. | — | `web` | B6 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-017-E** | **Empty** — no tickets → help-centre suggestions for the ten most common issues before offering ticket creation. | — | `web` · `support/` | B6 | E2E; `FR-SUP-06`; `OBJ-10` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-017-X** | **Error** — a failed attachment upload names the reason (type, size, scan failure) and preserves the drafted ticket. | — | `web` · `support/` | B6 | E2E; `NFR-SEC-10`; `NFR-USE-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-017-P** | **Permission-denied** — a member sees only their own tickets; help articles are public. | — | `support/` | B6 | Contract negative + Isolation | NOT STARTED |
| `[ ]` | **SCR-WEB-018** | **For Gyms (acquisition landing).** Content: value proposition for owners, feature summary, pricing tiers, testimonials, FAQ, signup CTA. | — | `web` | B6 | E2E; `/for-gyms`, `/for-gyms/signup`; §A6.2 tier reference | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-018-L** | **Loading** — static content renders immediately; only dynamic pricing figures use a skeleton. | — | `web` | B6 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-018-E** | **Empty** — absent testimonials or unpublished tier pricing hide their sections cleanly rather than rendering empty frames. | — | `web` | B6 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-018-X** | **Error** — dynamic tier pricing failure falls back to static copy and a "contact us" path; the signup CTA never breaks. | — | `web` | B6 | E2E (fault injection); `PRIN-06` | NOT STARTED |
| `[ ]` | ↳ **SCR-WEB-018-P** | **Permission-denied** — fully public; an owner who already has a tenant is routed to their dashboard rather than a duplicate signup. | — | `web` · `tenancy/` | B6 | E2E; `BR-TEN-02` | NOT STARTED |

---
### 11.2 Gym Owner Dashboard (`dash`) — `SCR-DASH-001` … `SCR-DASH-022` (§B7)

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **SCR-DASH-001** | **Dashboard Home.** Answer "what do I need to do today" without navigation. Region 1 — Alerts: onboarding checklist (until complete), KYC status, subscription arrears, payout failures, unread reviews needing response, refund requests pending. Region 2 — Today: check-ins today, active members, new members today, revenue today, currently-in-gym count. Region 3 — Action lists: expiring in 7 days (with contact actions), outstanding balances, at-risk members. Region 4 — Trend: revenue and new members over the last 30 days with the prior period as comparison. Region 5 — Activity: recent sales, recent check-ins, recent reviews. | — | `dash` | B7 | E2E; `AC-MEMB-02.1`; `FR-NAV-04`; the *currently-in-gym count* is satisfiable by polling — real-time transport pending `A-08` and not required for Phase 1 | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-001-L** | **Loading** — each of the five regions loads independently with its own skeleton; the alert region resolves first because it is the reason to open the screen. | — | `dash` | B7 | E2E; `NFR-PERF-04` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-001-E** | **Empty** — new tenant → onboarding checklist occupies the full screen until submission. Post-approval, a region with no data states so explicitly ("no check-ins yet today"). | — | `dash` · `onboarding/` | B7 | E2E; `FR-ONB-14`; `AC-ONB-01.1` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-001-X** | **Error** — a failing region degrades to a retry tile; the remaining regions still render, and no figure is shown that could not be computed. | — | `dash` | B7 | E2E (per-region fault injection); `PRIN-06` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-001-P** | **Permission-denied** — receptionists and trainers see a reduced version scoped to their branch and role; regions they may not see are absent, not empty. | — | `dash` · `iam/` | B7 | E2E + RBAC; `FR-NAV-03`; `FR-STAF-03` | NOT STARTED |
| `[ ]` | **SCR-DASH-002** | **Onboarding Wizard.** Steps: Business → KYC → Gym → Plans → Payout → Review & Submit. Behaviour: progress persists; any step is revisitable; validation is per-step; submission requires all mandatory items. Status panel: current application status, reviewer feedback, requested information, resubmission history. | — | `dash` · `onboarding/` | B7 | E2E; `E2E-01`; `UAT-01`; `FR-ONB-01` … `FR-ONB-08`; form library pending `A-09` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-002-L** | **Loading** — a resumed wizard restores the persisted step and its entered values before the form becomes editable, so no keystroke is lost to a late hydration. | — | `dash` | B7 | E2E; `FR-ONB-01` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-002-E** | **Empty / status states** — `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `INFO_REQUESTED` (with a targeted checklist), `REJECTED` (with reasons mapped to fields), `APPROVED` (wizard replaced by a success state and next steps). | — | `dash` · `onboarding/` | B7 | E2E (one case per status — six); `SM-04`; `FR-ONB-09` … `FR-ONB-11` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-002-X** | **Error** — a failed document upload names the reason (type, size, scan) and preserves the rest of the step; a failed submission never leaves the application in an ambiguous state. | — | `dash` · `onboarding/` | B7 | E2E; `NFR-SEC-10`; `NFR-USE-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-002-P** | **Permission-denied** — only `GYM_OWNER` may submit; other tenant roles see the wizard read-only. KYC documents are never readable by tenant staff other than the owner. | — | `dash` · `iam/` | B7 | RBAC negative; `BR-DAT-07`; §B3.2 | NOT STARTED |
| `[ ]` | **SCR-DASH-003** | **Gym Profile.** Content: name, description editor, category, amenities picker, photo manager with drag-ordering and cover selection, operating hours editor with exceptions, gender policy, address and map pin, contact and social links. Behaviour: fields that trigger re-review are marked before saving, with an explicit confirmation stating the consequence. Preview: "View as customer" opens the live marketplace rendering. | — | `dash` · `catalog/` | B7 | E2E; `FR-GYM-01` … `FR-GYM-06`, `FR-GYM-11`; `NFR-USE-06` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-003-L** | **Loading** — form skeleton; the save control is disabled until current values load so a partial form cannot overwrite stored data. | — | `dash` | B7 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-003-E** | **Empty** — no photos, no amenities or no hours each render an explicit prompt naming the approval requirement they block. | — | `dash` · `onboarding/` | B7 | E2E; `BR-GYM-02` (min 3 photographs, stated hours) | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-003-X** | **Error** — an image that fails processing or content screening reports the specific reason; a failed save preserves the edits in the form. | — | `dash` · `catalog/` | B7 | E2E; `FR-GYM-02`; `BR-GYM-07` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-003-P** | **Permission-denied** — `GYM_MANAGER` edits only assigned branches' fields; `RECEPTIONIST` and `TRAINER` have no access; refusal is server-side. | — | `dash` · `iam/` | B7 | RBAC negative; §B3.2 *Edit gym profile*; `FR-RBAC-02` | NOT STARTED |
| `[ ]` | **SCR-DASH-004** | **Branches.** Content: branch list with status, address, member count, today's check-ins; branch detail with its own hours, photos, staff, capacity; create/deactivate. | — | `dash` · `catalog/` | B7 | E2E; `FR-GYM-07`, `FR-GYM-09`; `BR-TEN-03` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-004-L** | **Loading** — list skeleton; per-branch counts load after the list so the structure appears immediately. | — | `dash` | B7 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-004-E** | **Empty** — single-branch tenants see the primary branch with an explicit "add a branch" affordance rather than an empty table. | — | `dash` | B7 | E2E; `branches.is_primary` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-004-X** | **Error** — retry affordance; deactivation that would orphan active memberships or staff states the consequence and the count before proceeding. | — | `dash` · `catalog/` | B7 | E2E; `NFR-USE-06` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-004-P** | **Permission-denied** — only `GYM_OWNER` may add or remove a branch; managers see only their assigned branches. | — | `dash` · `iam/` | B7 | RBAC negative; §B3.2 *Add / remove branch*; `FR-STAF-03` | NOT STARTED |
| `[ ]` | **SCR-DASH-005** | **Plan Catalogue.** Content: plan table — name, type, duration/sessions, price, promotional price, branches, visibility, status, active memberships count, actions. Actions: create, edit, duplicate, publish, unpublish, archive, reorder. | — | `dash` · `plans/` | B7 | E2E; `FR-PLAN-04`, `FR-PLAN-05`, `FR-PLAN-06` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-005-L** | **Loading** — table skeleton; the active-memberships count resolves after the rows. | — | `dash` | B7 | E2E; `NFR-PERF-04` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-005-E** | **Empty** — no plans → prompt naming the approval requirement (`≥1 published plan`) with a direct create action. | — | `dash` · `plans/` | B7 | E2E; `FR-ONB-05`; `RC-27 NO_PUBLISHED_PLAN` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-005-X** | **Error** — a failed publish or archive states the reason and leaves the plan in its prior status; the table never shows an unconfirmed status. | — | `dash` · `plans/` | B7 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-005-P** | **Permission-denied** — `GYM_MANAGER` has read-only access; only `GYM_OWNER` (or `SUPER_ADMIN`) may publish to the marketplace. | — | `dash` · `iam/` | B7 | RBAC negative; §B3.2 *Create / edit plan*, *Publish plan to marketplace* | NOT STARTED |
| `[ ]` | **SCR-DASH-006** | **Plan Editor.** Content: all `FR-PLAN-01` attributes, grouped — basics, pricing, promotion, eligibility, access, policies (freeze, transfer, stackable), branches, visibility. Preview: live marketplace card preview beside the form. Guards: price change confirmation stating existing memberships are unaffected; archive confirmation showing affected membership count. | — | `dash` · `plans/` | B7 | E2E; `FR-PLAN-01`, `FR-PLAN-07`, `FR-PLAN-08`; `NFR-USE-06`; form library pending `A-09` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-006-L** | **Loading** — grouped form skeleton; the preview renders only once authoritative values load so it never shows a price the marketplace would not honour. | — | `dash` | B7 | E2E; `PRIN-02` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-006-E** | **Empty** — a new draft opens with explicit defaults and an empty-state preview labelled as unpublished. | — | `dash` | B7 | E2E; `plans.status = DRAFT` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-006-X** | **Error** — an overlapping promotion is refused with the conflicting window named; validation failures are shown per field, never as a single generic banner. | — | `dash` · `plans/` | B7 | E2E; `BR-PLN-07`; `NFR-USE-05`; validation library pending `A-02` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-006-P** | **Permission-denied** — a `RECEPTIONIST` opening the editor by direct URL is refused server-side with a permission error, not merely hidden in the UI. | — | `dash` · `iam/` | B7 | Contract negative (403); `AC-STAF-01.2`; `FR-RBAC-02` | NOT STARTED |
| `[ ]` | **SCR-DASH-007** | **Member List.** Content: table — name, member code, phone, status, current plan, expiry, last visit, branch, trainer. Search, filters, saved segments, bulk actions, export. Density: compact rows; 50 per page with virtualised scrolling. | — | `dash` · `crm/` | B7 | E2E; `FR-CRM-01`, `FR-CRM-02`, `FR-CRM-07`, `FR-CRM-08`; `NFR-PERF-04` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-007-L** | **Loading** — row skeletons at the configured density; the search field is interactive immediately. | — | `dash` | B7 | E2E; `NFR-PERF-04` (p95 ≤ 800 ms for ≤50 rows) | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-007-E** | **Empty** — no members at all → import and walk-in-creation prompts; no members matching the filter → names the filter and offers to clear it. | — | `dash` · `crm/` | B7 | E2E (both cases); `FR-ONB-15`; `FR-CRM-04` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-007-X** | **Error** — retry affordance; a failed bulk action reports how many succeeded and how many failed, with reasons, and never claims a partial success as complete. | — | `dash` · `crm/` | B7 | E2E; `AC-CRM-01.2` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-007-P** | **Permission-denied** — branch-scoped staff see only their assigned branches' members; cross-tenant access is impossible. | — | `dash` · `tenancy/` | B7 | Isolation + RBAC; `FR-STAF-03`; `BR-TEN-01` | NOT STARTED |
| `[ ]` | **SCR-DASH-008** | **Member 360.** Regions: (1) identity header with photo, contact, member code, status; (2) memberships (current and historical) with actions (renew, freeze, upgrade, refund); (3) payments and invoices; (4) attendance with frequency trend; (5) notes; (6) communications sent; (7) trainer assignment. Actions: edit, renew, collect balance, freeze, add note, message, assign trainer, request refund. | — | `dash` · `crm/` | B7 | E2E; `FR-CRM-03`, `FR-CRM-05`; `AC-CART-02.2`; `FR-RFND-11` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-008-L** | **Loading** — the identity header resolves first; the six data regions load independently with their own skeletons. | — | `dash` | B7 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-008-E** | **Empty** — a member with no memberships, no payments, no visits, no notes or no communications shows an explicit per-region empty state, never a blank panel. | — | `dash` | B7 | E2E (one case per region) | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-008-X** | **Error** — a failing region degrades to a retry tile; financial regions never render a partial figure. | — | `dash` | B7 | E2E (per-region fault injection); `PRIN-03` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-008-P** | **Permission-denied** — internal notes are never visible to the member; `RECEPTIONIST` edits only their own-created records; refund initiation follows §B3.2. | — | `dash` · `iam/` | B7 | RBAC negative; `FR-CRM-05`; §B3.2 *Edit member record*, *Request refund* | NOT STARTED |
| `[ ]` | **SCR-DASH-009** | **Check-in Desk.** A single always-on surface optimised for speed at the counter. Layout: large camera viewfinder centre; manual search field always focused-on-keypress; result panel right; recent check-ins strip below. Success state: member photo, name, plan, days/sessions remaining, large green confirmation, auto-clears after a configurable interval. Denial state: large red state with the specific reason, the member's details, and contextual actions (Renew now, Unfreeze, Override with reason). Manual mode: search by phone/name/code, select member, select membership if multiple, confirm with reason. Ergonomics: full-screen mode; works on tablet in portrait; all primary actions reachable by keyboard. | — | `dash` · `attendance/` | B7 | E2E; `E2E-03`, `E2E-04`; `UAT-02`; `NFR-PERF-03`, `NFR-USE-02`, `NFR-USE-09`; scanner library pending `A-10` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-009-L** | **Loading** — camera permission and viewfinder initialisation show explicit progress; the manual search field is usable before the camera is ready. | — | `dash` | B7 | E2E; `ASM-01` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-009-E** | **Empty** — no scans yet in the session → the recent check-ins strip states so; a manual search with no match offers walk-in creation. | — | `dash` · `crm/` | B7 | E2E; `FR-CRM-04` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-009-X** | **Error / offline behaviour** — clear "no connection" state; **no false success is ever shown**. A dropped scan resolves to exactly once or not at all on reconnect. | — | `dash` · `attendance/` | B7 | E2E (partition injection); `AC-CHK-01.5`; `BR-CHK-06` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-009-P** | **Permission-denied** — scanning is available to `RECEPTIONIST`, `TRAINER`, `GYM_MANAGER` and `GYM_OWNER`; manual override is not available to `TRAINER`; a staff member cannot scan for a branch they are not assigned to. | — | `dash` · `iam/` | B7 | RBAC negative; §B3.2 *Scan / record check-in*, *Manual check-in override*; `FR-STAF-03` | NOT STARTED |
| `[ ]` | **SCR-DASH-010** | **Attendance Log.** Content: filterable table of visits — timestamp, member, branch, method, result, staff, denial reason; heatmap view; export. | — | `dash` · `attendance/` | B7 | E2E; `FR-CHK-10`, `FR-CHK-13`; `AC-CHK-02.1` … `AC-CHK-02.3` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-010-L** | **Loading** — table and heatmap skeletons; filters remain interactive during load. | — | `dash` | B7 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-010-E** | **Empty** — no visits in range → states the range and offers to widen it; the heatmap states the 14-day minimum rather than rendering a misleading grid. | — | `dash` | B7 | E2E; `AC-CHK-02.1` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-010-X** | **Error** — retry affordance; an export that exceeds the synchronous threshold switches to async delivery rather than failing. | — | `dash` · `reporting/` | B7 | E2E; `FR-RPT-03`; `NFR-PERF-06` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-010-P** | **Permission-denied** — branch-scoped staff see only their branches; `SUPPORT_AGENT` and `SUPER_ADMIN` see read-only per §B3.2. | — | `dash` · `iam/` | B7 | RBAC negative + Isolation; §B3.2 *View branch attendance* | NOT STARTED |
| `[ ]` | **SCR-DASH-011** | **Sales & Orders.** Content: order table — reference, date, member, plan, gross, discount, net, status, origin (marketplace/direct), payment method. Filters and export. Detail drawer: full breakdown, invoice, payment events, refund history. | — | `dash` · `ordering/` | B7 | E2E; `FR-CART-11`; `FR-RFND-11`; `KPI-17` origin split | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-011-L** | **Loading** — table skeleton; the detail drawer loads its own regions independently. | — | `dash` | B7 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-011-E** | **Empty** — no orders in range → states the range and offers the offline-sale action. | — | `dash` | B7 | E2E; `SCR-DASH-012` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-011-X** | **Error** — retry affordance; monetary columns are hidden rather than shown partial when a figure cannot be read from the persisted order. | — | `dash` · `ordering/` | B7 | E2E; `BR-FIN-02` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-011-P** | **Permission-denied** — cross-tenant order access is impossible; branch-scoped staff see only their branches' sales. | — | `dash` · `tenancy/` | B7 | Isolation + RBAC; `E2E-11`; `BR-TEN-01` | NOT STARTED |
| `[ ]` | **SCR-DASH-012** | **Record Offline Sale.** Content: member selection or creation, plan selection, start date, coupon, price breakdown, payment method (cash/card/bank/other), amount received (full or partial), notes. Result: order created, invoice issued, membership activated per configuration, balance recorded if partial. | — | `dash` · `ordering/` | B7 | E2E; `E2E-10`; `UAT-02`; `FR-CART-09`; `BR-PAY-09` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-012-L** | **Loading** — the price breakdown renders as a skeleton until the server prices the order; the save control is disabled until then. | — | `dash` | B7 | E2E; `BR-PAY-04` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-012-E** | **Empty** — no member selected → inline walk-in creation with the minimal required set (name, phone). | — | `dash` · `crm/` | B7 | E2E; `FR-CRM-04` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-012-X** | **Error** — coupon rejection, eligibility failure or invoice-issuance failure each state the specific reason and preserve the entered sale. | — | `dash` · `ordering/` · `billing/` | B7 | E2E; `FR-CART-07`; `AC-INV-01.2`; `NFR-USE-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-012-P** | **Permission-denied** — available to `RECEPTIONIST`, `GYM_MANAGER` and `GYM_OWNER` only; `TRAINER` is refused server-side. | — | `dash` · `iam/` | B7 | RBAC negative; §B3.2 *Record offline payment* | NOT STARTED |
| `[ ]` | **SCR-DASH-013** | **Invoices.** Content: invoice list with number, date, member, amount, tax, status; credit notes; bulk export by date range. | — | `dash` · `billing/` | B7 | E2E; `FR-INV-08`, `FR-INV-09`, `FR-INV-10` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-013-L** | **Loading** — table skeleton; download controls disabled until each document reference resolves. | — | `dash` | B7 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-013-E** | **Empty** — no invoices in range → states the range; a gap in the number series is surfaced as a defect signal, never hidden. | — | `dash` · `billing/` | B7 | E2E; `AC-INV-01.1`, `AC-INV-01.2` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-013-X** | **Error** — a failed bulk export switches to async delivery with a time-limited link; a failed PDF fetch never serves a stale document. | — | `dash` · `reporting/` | B7 | E2E; `FR-RPT-03`; `FR-INV-07` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-013-P** | **Permission-denied** — visible to the tenant and Finance per §B3.2; branch-scoped staff see only their branches' invoices. | — | `dash` · `iam/` | B7 | RBAC negative + Isolation | NOT STARTED |
| `[ ]` | **SCR-DASH-014** | **Settlements.** Content: batch list with period, gross, commission, fees, reserve, net payable, status, payout date; statement download. Detail: line-by-line transactions with all eight figures; opening balance; reserve lines; refund lines. | — | `dash` · `settlements/` | B7 | E2E; `US-SETL-01`; `E2E-12`; `FR-SETL-07`; `BR-FIN-02`, `BR-FIN-03` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-014-L** | **Loading** — batch list skeleton; statement lines load on expansion, never as a partially-summed table. | — | `dash` | B7 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-014-E** | **Empty** — no batches yet → states the settlement cycle and the next run date; a batch below the minimum payout states the roll-forward reason. | — | `dash` · `settlements/` | B7 | E2E; `FR-SETL-05`; `tenants.settlement_cycle_days` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-014-X** | **Error** — a payout failure shows the bank rejection reason and the batch's return to `PENDING`; a statement whose lines do not sum is reported as an error, never rendered. | — | `dash` · `settlements/` | B7 | E2E; `FR-SETL-08`; `BR-FIN-03` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-014-P** | **Permission-denied** — visible to `GYM_OWNER`, Finance and `SUPER_ADMIN`; other tenant roles are refused server-side. | — | `dash` · `iam/` | B7 | RBAC negative; §B3.2 *View settlement statements* | NOT STARTED |
| `[ ]` | **SCR-DASH-015** | **Refunds.** Content: request list with member, order, amount, reason, status, requester; detail with policy, usage, computed amount, approval state and history. Actions: raise a refund, approve within delegated authority, view platform decision. | — | `dash` · `refunds/` | B7 | E2E; `E2E-07`; `FR-RFND-01` … `FR-RFND-04` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-015-L** | **Loading** — list skeleton; the computed refund amount renders only once the server computes it. | — | `dash` | B7 | E2E; `FR-RFND-04` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-015-E** | **Empty** — no refund requests → states so; a request awaiting platform decision states that it is out of the tenant's delegated authority and why. | — | `dash` · `refunds/` | B7 | E2E; `BR-REF-03` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-015-X** | **Error** — a gateway refund failure states the reason and keeps the request in a retriable state; it never shows a refund as completed before the gateway confirms. | — | `dash` · `refunds/` | B7 | E2E; `SMT-43`, `SMT-48`; `FR-RFND-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-015-P** | **Permission-denied** — approval beyond delegated authority is refused server-side and routed to `SUPER_ADMIN`. | — | `dash` · `iam/` | B7 | RBAC negative; `BR-REF-03`; §B3.2 *Approve out-of-policy refund* | NOT STARTED |
| `[ ]` | **SCR-DASH-016** | **Coupons.** Content: coupon list with code, type, value, validity, usage/limit, status, performance; editor with all `BR-CPN-01` attributes; pause/resume. | — | `dash` · `ordering/` | B7 | E2E; `US-CPN-01`; `FR-CPN-01`, `FR-CPN-04`, `FR-CPN-07`, `FR-CPN-08` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-016-L** | **Loading** — list skeleton; performance figures resolve after the rows. | — | `dash` | B7 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-016-E** | **Empty** — no coupons → create prompt explaining the `funding_source` distinction and its commission consequence. | — | `dash` | B7 | E2E; `BR-CPN-05`; `AC-CPN-01.4` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-016-X** | **Error** — an exhausted coupon is automatically marked exhausted rather than erroring on next use; validation failures are per field. | — | `dash` · `ordering/` | B7 | E2E; `AC-CPN-01.3` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-016-P** | **Permission-denied** — `GYM_MANAGER` is read-only; only `GYM_OWNER` (or `SUPER_ADMIN`) may create. Platform-scope coupons are not editable by a tenant. | — | `dash` · `iam/` | B7 | RBAC negative + Isolation; §B3.2 *Create coupon*; `FR-CPN-02` | NOT STARTED |
| `[ ]` | **SCR-DASH-017** | **Leads.** Content: enquiry pipeline (New → Contacted → Trial → Converted → Lost) as a board or table; source; assigned staff; follow-up date; conversion action that opens the sale flow. | — | `dash` · `crm/` | B7 | E2E; tenant report *Lead funnel*; `API-TEN /tenant/leads` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-017-L** | **Loading** — column or row skeletons per pipeline stage. | — | `dash` | B7 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-017-E** | **Empty** — no leads → states so and explains how enquiries arrive, rather than showing five empty columns with no context. | — | `dash` | B7 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-017-X** | **Error** — a failed stage change reverts the card to its stored stage and states the failure. | — | `dash` | B7 | E2E; `NFR-USE-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-017-P** | **Permission-denied** — branch-scoped staff see only leads for their assigned branches. | — | `dash` · `iam/` | B7 | RBAC negative + Isolation; `FR-STAF-03` | NOT STARTED |
| `[ ]` | **SCR-DASH-018** | **Staff.** Content: staff list with name, role, branches, status, last activity; invite flow; detail with activity log and permission summary. Guards: seat limit enforcement with upgrade path; last-owner protection. | — | `dash` · `staff/` | B7 | E2E; `US-STAF-01`; `FR-STAF-01` … `FR-STAF-06`, `FR-STAF-09`; `FR-RBAC-05`, `FR-RBAC-07` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-018-L** | **Loading** — list skeleton; the permission summary computes server-side and renders only when resolved. | — | `dash` | B7 | E2E; `FR-RBAC-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-018-E** | **Empty** — only the owner exists → invite prompt naming the activation checklist item it satisfies. | — | `dash` · `onboarding/` | B7 | E2E; `FR-ONB-14` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-018-X** | **Error** — an invitation beyond the seat cap states the cap, the current usage and the upgrade path; removing the last owner is refused with the reason. | — | `dash` · `staff/` | B7 | E2E (both negatives); `FR-STAF-06`; `FR-STAF-09` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-018-P** | **Permission-denied** — `GYM_MANAGER` manages only their assigned branches' staff; `RECEPTIONIST` and `TRAINER` have no access. | — | `dash` · `iam/` | B7 | RBAC negative; §B3.2 *Invite / manage staff* | NOT STARTED |
| `[ ]` | **SCR-DASH-019** | **Reviews.** Content: reviews received with rating, text, date, member tenure, response state; respond action; report action; rating trend chart; response-rate metric. | — | `dash` · `reviews/` | B7 | E2E; `US-REV-01`; `E2E-09`; `FR-REV-05`, `FR-REV-06`; tenant report *Review summary* | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-019-L** | **Loading** — list skeleton; trend chart renders after the aggregate resolves. | — | `dash` | B7 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-019-E** | **Empty** — no reviews → states the review-eligibility rule so the owner understands why volume is low. | — | `dash` · `reviews/` | B7 | E2E; `BR-REV-01`; `PRIN-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-019-X** | **Error** — a response that fails screening states the reason and preserves the draft; a failed report submission never appears as filed. | — | `dash` · `reviews/` | B7 | E2E; `FR-REV-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-019-P** | **Permission-denied** — **no delete or edit action on a member's review exists here at all**; only respond and report. `GYM_MANAGER` and `GYM_OWNER` may respond. | — | `dash` · `reviews/` | B7 | E2E + Contract negative; `AC-REV-01.2`; `BR-REV-05` | NOT STARTED |
| `[ ]` | **SCR-DASH-020** | **Reports.** Content: report catalogue as cards; each report opens with date range, branch filter, chart, table, drill-down and export; scheduled delivery configuration. | — | `dash` · `reporting/` | B7 | E2E; `US-RPT-01`; `FR-RPT-01` … `FR-RPT-05`; all 16 tenant reports in §B5.20 | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-020-L** | **Loading** — catalogue cards render immediately; an individual report shows a progress state and switches to async beyond the synchronous threshold. | — | `dash` · `reporting/` | B7 | E2E; `NFR-PERF-06` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-020-E** | **Empty** — no data in the selected range → states the range and the earliest date with data, rather than an empty chart. | — | `dash` | B7 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-020-X** | **Error** — a failed report states the failure and offers retry; a financial report never renders a figure it could not derive from the ledger. | — | `dash` · `ledger/` | B7 | E2E; `FR-RPT-02`; `PRIN-03` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-020-P** | **Permission-denied** — branch-scoped staff see only their branches' figures; settlement and tax reports follow §B3.2's financial permissions. | — | `dash` · `iam/` | B7 | RBAC negative + Isolation; §B3.2 *View tenant reports* | NOT STARTED |
| `[ ]` | **SCR-DASH-021** | **Notifications.** Content: notification centre; template overrides where the tier permits; delivery log with per-message status. | — | `dash` · `notifications/` | B7 | E2E; `FR-NOTF-03`, `FR-NOTF-04`, `FR-NOTF-07` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-021-L** | **Loading** — centre and log skeletons; unread counts resolve before the badge renders so it never flickers a wrong number. | — | `dash` | B7 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-021-E** | **Empty** — no notifications and no delivery attempts each state so explicitly. | — | `dash` | B7 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-021-X** | **Error** — a failed delivery shows the provider response and the retry schedule rather than a bare "failed". | — | `dash` · `notifications/` | B7 | E2E; `notification_log.last_error`; `FR-NOTF-04` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-021-P** | **Permission-denied** — template override is available only where the subscription tier permits, and the refusal names the tier requirement. | — | `dash` · `billing/` | B7 | RBAC negative; `FR-NOTF-03`; §A6.2 | NOT STARTED |
| `[ ]` | **SCR-DASH-022** | **Settings.** Sections: tenant profile, timezone and locale, tax profile, refund policy editor, check-in configuration (cooldown, auto-checkout, override reasons), notification defaults, subscription and billing, payout account, data export, danger zone. | — | `dash` · `tenancy/` | B7 | E2E; `BR-REF-01`; `BR-CHK-04`; `BAC-12`; `FR-ADMN-05` tax profiles | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-022-L** | **Loading** — section skeletons; save controls disabled until current values load. | — | `dash` | B7 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-022-E** | **Empty** — an unset refund policy or unset payout account is shown as an explicit blocking gap, not as a blank field. | — | `dash` · `onboarding/` | B7 | E2E; `FR-ONB-06`; `BR-REF-01` | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-022-X** | **Error** — a bank-account change that fails verification states the consequence: payouts suspend until re-verified while the listing stays live. | — | `dash` · `settlements/` | B7 | E2E; `BR-GYM-06`; §B5.3 edge case *bank account changes* | NOT STARTED |
| `[ ]` | ↳ **SCR-DASH-022-P** | **Permission-denied** — only `GYM_OWNER` may change the payout bank account or use the danger zone; every other tenant role is refused server-side. | — | `dash` · `iam/` | B7 | RBAC negative; §B3.2 *Change payout bank account*; `AC-AUTH-03.2` (impersonation also refused) | NOT STARTED |

---
### 11.3 Super Admin Console (`admin`) — `SCR-ADM-001` … `SCR-ADM-015` (§B8)

Every `admin` screen carries `NFR-SEC-11` as a precondition: MFA is mandatory for all platform staff
roles, so the `-P` state on each screen is tested both for the wrong role and for a staff session
without MFA.

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **SCR-ADM-001** | **Platform Dashboard.** Content: GMV today/MTD, active tenants, pending approvals with SLA status, payment success rate, reconciliation status, open refunds and disputes, moderation queue depth, system health strip, tenant funnel snapshot, city leaderboard. | — | `admin` | B8 | E2E; `KPI-14`, `KPI-19`, `KPI-26`; `FR-ADMN-13` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-001-L** | **Loading** — each tile loads independently with its own skeleton; no tile blocks the others. | — | `admin` | B8 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-001-E** | **Empty** — a pre-launch platform with no tenants, no GMV and no queues shows zeroes with explicit "no data yet" labelling, never blank tiles. | — | `admin` | B8 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-001-X** | **Error** — a failing tile degrades to a retry state; the reconciliation tile shows "unknown" rather than "zero variance" when it cannot be computed. | — | `admin` · `settlements/` | B8 | E2E (fault injection); `KPI-26`; `BR-FIN-07` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-001-P** | **Permission-denied** — platform staff only, MFA enforced; role-scoped tiles (finance, moderation, verification) are absent for roles that may not see them. | — | `admin` · `iam/` | B8 | RBAC negative + MFA negative; `NFR-SEC-11`; `FR-NAV-03` | NOT STARTED |
| `[ ]` | **SCR-ADM-002** | **Approval Queue.** Content: applications with age, SLA state, assignee, tenant name, city, submission type (new/resubmission), pre-check status. Sortable and assignable. SLA: visual indication of applications approaching or breaching the review SLA. | — | `admin` · `onboarding/` | B8 | E2E; `UAT-04`; `FR-ADMN-11`; platform report *Verification SLA* | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-002-L** | **Loading** — queue skeleton; sort and assign controls disabled until rows resolve. | — | `admin` | B8 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-002-E** | **Empty** — an empty queue is stated as an achievement with the current SLA position, not as a blank table. | — | `admin` | B8 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-002-X** | **Error** — retry affordance; an application whose pre-check status cannot be read is shown as "pre-checks unavailable", never as passing. | — | `admin` · `onboarding/` | B8 | E2E; `FR-ONB-12` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-002-P** | **Permission-denied** — `VERIFICATION_OFFICER` and `SUPER_ADMIN` only; every other platform role is refused server-side. | — | `admin` · `iam/` | B8 | RBAC negative; §B3.2 *Review KYC documents*, *Approve / reject gym* | NOT STARTED |
| `[ ]` | **SCR-ADM-003** | **Application Review.** Layout: split view — documents (inline viewer with zoom and rotate) on the left; structured checklist on the right. Checklist: each requirement with pass/fail/needs-info, evidence reference and a note field. Pre-check panel: address-to-geo distance, duplicate address, duplicate registration id, duplicate bank account, image quality flags, content screening results — failures expanded, passes collapsed. History: prior submissions with a field-level diff against the current version. Actions: Approve, Reject (requires ≥1 structured reason), Request information (targeted checklist), Reassign, Add internal note. Guards: approving with a failed pre-check requires an explicit override with a reason. | — | `admin` · `onboarding/` | B8 | E2E; `US-ONB-02`; `E2E-01`; `UAT-04`; `BR-GYM-03`, `BR-GYM-04`, `BR-GYM-08`, `BR-GYM-09` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-003-L** | **Loading** — the checklist renders before the documents so the reviewer can start; document rendering shows per-document progress. | — | `admin` | B8 | E2E; `AC-ONB-02.1` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-003-E** | **Empty** — a first submission shows the history panel as "no prior submissions"; a checklist item with no evidence attached is explicitly marked missing rather than left unmarked. | — | `admin` | B8 | E2E; `BR-GYM-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-003-X** | **Error** — an unreadable document offers "request information" rather than forcing a rejection, preserving the owner's progress. A failed decision submission never leaves the application in an ambiguous state. | — | `admin` · `onboarding/` | B8 | E2E; §B5.3 edge case *unreadable scan*; `FR-ONB-10` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-003-P** | **Permission-denied** — KYC documents are readable only by Verification and Super Admin roles, and every access is logged; approval is never available to an automated actor. | — | `admin` · `onboarding/` · `audit/` | B8 | RBAC negative + Integration (access log written); `BR-DAT-07`; `BR-GYM-03`; `NFR-SEC-02` | NOT STARTED |
| `[ ]` | **SCR-ADM-004** | **Tenant List / Detail.** List: name, city, tier, status, members, GMV, commission rate, last activity, risk flags. Detail tabs: Profile & KYC, Gyms & branches, Plans, Members, Financials (orders, settlements, refunds, disputes), Staff, Activity, Configuration (tier, commission override, settlement cycle, feature flags), Actions. Actions: suspend (with reason), reinstate, change tier, override commission with validity window, force re-verification, adjust settlement cycle, adjust reserve. | — | `admin` | B8 | E2E; `US-ADMN-01`; `UAT-06`; `FR-ADMN-01`, `FR-ADMN-03` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-004-L** | **Loading** — list skeleton; each detail tab loads on selection with its own skeleton. | — | `admin` | B8 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-004-E** | **Empty** — a tenant with no gyms, no plans, no members or no financial history shows an explicit per-tab empty state naming the onboarding step that would populate it. | — | `admin` | B8 | E2E (one case per tab) | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-004-X** | **Error** — an action that fails states the reason and leaves the tenant unchanged; a commission override that would conflict with an existing window is refused with both windows named. | — | `admin` | B8 | E2E; `FR-ADMN-03`; `AC-ADMN-01.1` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-004-P** | **Permission-denied** — suspension and commission configuration are `SUPER_ADMIN` only (Finance is read-only on commission); every action requires a reason and is audited. | — | `admin` · `iam/` · `audit/` | B8 | RBAC negative; §B3.2 *Suspend tenant*, *Configure commission rate*; `FR-ADMN-02` | NOT STARTED |
| `[ ]` | **SCR-ADM-005** | **User Administration.** Content: platform-wide user search by phone, email, name, order reference; user detail with memberships, orders, payments, reviews, tickets, sessions; impersonate (with reason); force logout; delete request handling. | — | `admin` · `iam/` | B8 | E2E; `UAT-06`; `FR-AUTH-12`; `BR-DAT-02`, `BR-DAT-04` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-005-L** | **Loading** — search results skeleton; the detail panel loads each region independently. | — | `admin` | B8 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-005-E** | **Empty** — no match → states which identifiers were searched; a user with no memberships, orders or tickets shows explicit per-region empty states. | — | `admin` | B8 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-005-X** | **Error** — a failed impersonation start never leaves a partially-elevated session; a failed force-logout states which sessions were and were not revoked. | — | `admin` · `iam/` | B8 | E2E; `FR-AUTH-09`, `FR-AUTH-12` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-005-P** | **Permission-denied** — impersonation is `SUPPORT_AGENT` and `SUPER_ADMIN` only, requires a stated reason, is capped at 30 minutes, and cannot perform financial mutations; the impersonated user sees it in their activity. | — | `admin` · `iam/` · `audit/` | B8 | RBAC negative + Contract negative; `AC-AUTH-03.1` … `AC-AUTH-03.3`; `BR-DAT-02` | NOT STARTED |
| `[ ]` | **SCR-ADM-006** | **Finance: Orders & Payments.** Content: all orders and payment attempts with gateway state, provider references, failure reasons; filters by state, tenant, date, amount; drill-down to raw (redacted) provider payloads. | — | `admin` · `payments/` | B8 | E2E; `FR-PAY-07`; platform report *Payment health*; `KPI-19` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-006-L** | **Loading** — table skeleton; payload drill-down loads on demand, never eagerly. | — | `admin` | B8 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-006-E** | **Empty** — no orders or payments in the filter → states the filter and offers to widen it. | — | `admin` | B8 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-006-X** | **Error** — a payment whose provider state cannot be read is shown as indeterminate with its reconciliation status, never as failed or succeeded. | — | `admin` · `payments/` | B8 | E2E; `BR-PAY-06`; `FR-PAY-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-006-P** | **Permission-denied** — Finance and `SUPER_ADMIN` only; raw payloads are redacted for every viewer and contain no instrument data. | — | `admin` · `iam/` | B8 | RBAC negative + Security (redaction assertion); `BR-PAY-08`; `BR-DAT-06` | NOT STARTED |
| `[ ]` | **SCR-ADM-007** | **Finance: Settlements.** Content: settlement runs by cycle with tenant, batch total, status; approval action with dual-control option above a threshold; payout execution status; failure handling. | — | `admin` · `settlements/` | B8 | E2E; `E2E-12`; `UAT-05`; `FR-SETL-06`; `BR-FIN-08` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-007-L** | **Loading** — run list skeleton; the approval control is disabled until the batch total and its variance status resolve. | — | `admin` | B8 | E2E; `BR-FIN-07` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-007-E** | **Empty** — no runs due in the cycle → states the next scheduled run; batches rolled forward below the minimum payout are listed with the reason. | — | `admin` | B8 | E2E; `FR-SETL-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-007-X** | **Error** — a reconciliation variance blocks auto-payout for the affected tenant and says so explicitly; a payout execution failure shows the bank reason and the return to `PENDING`. | — | `admin` · `settlements/` | B8 | E2E; `BR-FIN-07`; `FR-SETL-08`; `SMT-63`, `SMT-64` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-007-P** | **Permission-denied** — Finance and `SUPER_ADMIN` only; above the dual-approval threshold a single approver cannot complete the action. | — | `admin` · `iam/` | B8 | RBAC negative + Integration (dual control); `BR-FIN-08`; §B3.2 *Approve payout run* | NOT STARTED |
| `[ ]` | **SCR-ADM-008** | **Finance: Refund Approval.** Content: queue with request age, amount, usage, policy position, tenant, requester; detail with the full computation and evidence; approve/reject with reason. | — | `admin` · `refunds/` | B8 | E2E; `E2E-07`; `UAT-05`; `BR-REF-03`, `BR-REF-06` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-008-L** | **Loading** — queue skeleton; the computation panel renders only when the server-side computation resolves. | — | `admin` | B8 | E2E; `FR-RFND-04` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-008-E** | **Empty** — an empty queue is stated with the current auto-approval thresholds so the reviewer knows what is being handled without them. | — | `admin` | B8 | E2E; `BR-REF-03` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-008-X** | **Error** — a decision that fails to persist is never shown as decided; a refund whose order policy cannot be read is blocked rather than decided on the current tenant policy. | — | `admin` · `refunds/` | B8 | E2E; `BR-REF-02` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-008-P** | **Permission-denied** — out-of-policy approval is `SUPER_ADMIN` only; Finance is read-only on that decision per §B3.2. | — | `admin` · `iam/` | B8 | RBAC negative; §B3.2 *Approve out-of-policy refund* | NOT STARTED |
| `[ ]` | **SCR-ADM-009** | **Finance: Disputes.** Content: case list with deadline countdown; detail with evidence pack, submission action, outcome tracking, and balance-hold status. | — | `admin` · `refunds/` | B8 | E2E; `US-RFND-02`; `UAT-05`; `FR-RFND-08`, `FR-RFND-09`, `FR-RFND-10` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-009-L** | **Loading** — case list skeleton; evidence pack assembly shows progress and states which components are still being gathered. | — | `admin` | B8 | E2E; `AC-RFND-02.2` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-009-E** | **Empty** — no open cases → states so with the trailing dispute rate against the `KPI-21` target. | — | `admin` | B8 | E2E; `KPI-21` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-009-X** | **Error** — an incomplete evidence pack names the missing component rather than submitting silently; a failed submission before the deadline raises an alert. | — | `admin` · `refunds/` | B8 | E2E; `FR-RFND-09`; `NFR-MNT-06` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-009-P** | **Permission-denied** — Finance and `SUPER_ADMIN` handle chargebacks; the tenant has read-only visibility per §B3.2. | — | `admin` · `iam/` | B8 | RBAC negative; §B3.2 *Handle chargeback* | NOT STARTED |
| `[ ]` | **SCR-ADM-010** | **Finance: Reconciliation.** Content: daily comparison of gateway settlement report to internal ledger; variance list with drill-down; resolution notes; historical variance trend (target zero per `KPI-26`). | — | `admin` · `settlements/` · `ledger/` | B8 | E2E; `E2E-12`; `BAC-07`; `FR-SETL-09`; `JOB-10 settlement.reconcile` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-010-L** | **Loading** — comparison skeleton; the variance verdict renders only when both sides have loaded, never from one side alone. | — | `admin` | B8 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-010-E** | **Empty** — a day with zero variance states "zero variance" explicitly against the `KPI-26` target, distinct from "not yet run". | — | `admin` | B8 | E2E; `KPI-26` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-010-X** | **Error** — a gateway report that cannot be fetched shows "reconciliation not run" and blocks auto-payout, rather than implying agreement. | — | `admin` · `settlements/` | B8 | E2E (fault injection); `BR-FIN-07` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-010-P** | **Permission-denied** — Finance and `SUPER_ADMIN` only. | — | `admin` · `iam/` | B8 | RBAC negative | NOT STARTED |
| `[ ]` | **SCR-ADM-011** | **Configuration Screens.** Screens: commission rules (global/tier/tenant with effective-rate resolver), subscription tiers, tax profiles, KYC checklists, taxonomy (amenities, categories, cities, reason codes), feature flags, notification templates. Guard: every configuration change requires a reason, shows a preview of affected entities, and is audited. | — | `admin` | B8 | E2E (one case per configuration screen — seven); `FR-ADMN-03` … `FR-ADMN-08`; `FR-NOTF-03` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-011-L** | **Loading** — the affected-entity preview computes server-side and the save control stays disabled until it resolves, so no change is committed blind. | — | `admin` | B8 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-011-E** | **Empty** — an unconfigured country (no tax profile, no KYC checklist) is shown as an explicit blocking gap for that country, not as an empty list. | — | `admin` | B8 | E2E; `OQ-01`; `OBJ-09` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-011-X** | **Error** — a change that fails validation names the conflicting configuration; a partially-applied taxonomy change is never left in place. | — | `admin` | B8 | E2E; `NFR-DQ-06` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-011-P** | **Permission-denied** — commission and tier configuration are `SUPER_ADMIN` only (Finance read-only); taxonomy is `MODERATOR` and `SUPER_ADMIN`; feature flags are `SUPER_ADMIN` only. | — | `admin` · `iam/` | B8 | RBAC negative (three cases); §B3.2 *Configure commission rate*, *Manage taxonomy*, *Toggle feature flags* | NOT STARTED |
| `[ ]` | **SCR-ADM-012** | **Moderation Queues.** Content: reviews pending or flagged with the triggering signal, the review, the gym context and the reviewer's history; actions publish/unpublish/request-edit/remove-with-reason. Separate queues for gym content flags and user reports. | — | `admin` · `reviews/` | B8 | E2E; `E2E-09`; `FR-REV-07`; `FR-ADMN-12`; `SM-06` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-012-L** | **Loading** — queue skeleton per queue; the reviewer-history panel loads on selection. | — | `admin` | B8 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-012-E** | **Empty** — each of the three queues states its own empty condition separately, so an empty review queue is not mistaken for an empty content-flag queue. | — | `admin` | B8 | E2E (three queues) | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-012-X** | **Error** — a failed moderation action leaves the item in its prior state and states the failure; the aggregate is never recomputed from an unconfirmed decision. | — | `admin` · `reviews/` | B8 | E2E; `AC-REV-02.3`; `JOB-12 review.aggregate` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-012-P** | **Permission-denied** — `MODERATOR` and `SUPER_ADMIN` only; a gym owner has no access to this surface at all and can never unpublish a review. | — | `admin` · `iam/` | B8 | RBAC negative; §B3.2 *Moderate / unpublish review*; `BR-REV-05` | NOT STARTED |
| `[ ]` | **SCR-ADM-013** | **Support Console.** Content: ticket queue with assignment, priority, SLA; ticket detail with full customer context, linked entities, internal notes, canned responses. | — | `admin` · `support/` | B8 | E2E; `FR-SUP-03`, `FR-SUP-04`, `FR-SUP-05`; `KPI-25` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-013-L** | **Loading** — queue skeleton; customer context loads per region on ticket selection. | — | `admin` | B8 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-013-E** | **Empty** — an empty queue states the current first-response median against the `KPI-25` target. | — | `admin` | B8 | E2E; `KPI-25` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-013-X** | **Error** — a failed reply preserves the drafted text; an SLA timer that cannot be computed is shown as unknown, never as within SLA. | — | `admin` · `support/` | B8 | E2E; `FR-SUP-05` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-013-P** | **Permission-denied** — `SUPPORT_AGENT` is read-mostly with impersonation under audit; financial mutations from this surface are refused. | — | `admin` · `iam/` | B8 | RBAC negative + Contract negative; `AC-AUTH-03.2`; §A5.2 | NOT STARTED |
| `[ ]` | **SCR-ADM-014** | **Platform Analytics.** Content: the platform report catalogue from §B5.20, with city, tier and cohort dimensions. | — | `admin` · `reporting/` | B8 | E2E (one case per platform report — eleven); `FR-RPT-01`; `API-ADM GET /admin/analytics/:reportKey` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-014-L** | **Loading** — catalogue renders immediately; an individual report shows progress and switches to async beyond the synchronous threshold. | — | `admin` · `reporting/` | B8 | E2E; `NFR-PERF-06`; `FR-RPT-03` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-014-E** | **Empty** — no data for the chosen dimension states the earliest date with data rather than rendering an empty chart. | — | `admin` | B8 | E2E | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-014-X** | **Error** — a failed report states the failure and offers retry; GMV and take-rate figures are never rendered partial. | — | `admin` · `ledger/` | B8 | E2E; `FR-RPT-02`; `PRIN-03` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-014-P** | **Permission-denied** — platform staff only, role-filtered; financial dimensions are hidden from roles without financial permission. | — | `admin` · `iam/` | B8 | RBAC negative; `FR-NAV-03` | NOT STARTED |
| `[ ]` | **SCR-ADM-015** | **Audit Log Explorer.** Content: filter by actor, entity type, entity id, action type, date range, impersonation flag; result table with before/after diff view; export. | — | `admin` · `audit/` | B8 | E2E; `US-ADMN-02`; `BAC-13`; `UAT-06`; `FR-ADMN-09` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-015-L** | **Loading** — result skeleton; the diff view loads per record on expansion. | — | `admin` | B8 | E2E; `audit_log (entity_type, entity_id, occurred_at)` index | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-015-E** | **Empty** — no matching records states the filter used; the absence of audit records for an entity that should have them is surfaced as an anomaly, not as a normal empty. | — | `admin` · `audit/` | B8 | E2E; `BR-DAT-01` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-015-X** | **Error** — a query that exceeds limits switches to async export rather than truncating results silently. | — | `admin` · `reporting/` | B8 | E2E; `FR-RPT-03` | NOT STARTED |
| `[ ]` | ↳ **SCR-ADM-015-P** | **Permission-denied** — read scope follows §B3.2 (`GYM_OWNER` own-tenant only; Support, Verification, Finance and Moderator read-only; `SUPER_ADMIN` full). **No interface exists anywhere to modify or delete an audit record.** | — | `admin` · `audit/` | B8 | RBAC negative + Contract negative; `AC-ADMN-02.3`; `NFR-SEC-13` | NOT STARTED |

---

## 12. API Endpoints — 193 endpoints across 14 `API-` groups

**Source:** §C3.2. Every endpoint printed in the PRD's catalogue gets its own row; where the source
prints several verbs against one path row, each verb is enumerated separately, because a `GET` and a
`DELETE` on the same path are two different permission declarations and two different contract tests.

**Group counts:** `API-AUTH` ×15 · `API-USER` ×10 · `API-DISC` ×12 · `API-FAV` ×6 · `API-ORD` ×7 ·
`API-PAY` ×4 · `API-MEMB` ×10 · `API-CHK` ×6 · `API-TEN` ×57 · `API-REV` ×6 · `API-RFND` ×3 ·
`API-ADM` ×48 · `API-NOTF` ×2 · `API-SUP` ×7 = **193**.

**Every endpoint row is ticked only when all §C3.1 conventions and all §C7 gates hold for it:**

1. Base `https://api.<domain>/v1`, JSON with `snake_case` fields.
2. `Authorization: Bearer <access_token>` where authenticated.
3. Tenant derived from the token or the resource — **never accepted from the client**.
4. `Idempotency-Key` required on every `POST` / `PUT` / `PATCH` / `DELETE` that affects money or membership state.
5. Cursor pagination `?limit=&cursor=` with `next_cursor` in the response, on every collection.
6. Explicit query parameters per endpoint; no generic query language.
7. `?sort=field:asc|desc` where sorting is offered.
8. Errors as `{ "error": { "code", "message", "details": [], "correlation_id" } }`.
9. Rate limits returned in `X-RateLimit-*` headers.
10. A **declared required permission** — an endpoint without one fails CI and cannot be merged (`FR-RBAC-01`).
11. **Isolation coverage** for every tenant-scoped endpoint — a new endpoint without it fails the build (§C1.4 step 5, §C7).
12. Documented status codes drawn from: `200` · `201` · `202` · `204` · `400` · `401` · `403` · `404` · `409` · `410` · `422` · `429` · `500` · `503`.

### 12.1 `API-AUTH` — Authentication (§C3.2) — 15 endpoints

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **API-AUTH-01** | `POST /auth/otp/request` — request OTP for a phone number. Auth: none. | — | `iam/` | C3.2 | Contract + rate-limit test; `FR-AUTH-05`; `AC-AUTH-01.1`, `AC-AUTH-01.4` | NOT STARTED |
| `[ ]` | **API-AUTH-02** | `POST /auth/otp/verify` — verify OTP, issue tokens. Auth: none. | — | `iam/` | C3.2 | Contract; `AC-AUTH-01.2`, `AC-AUTH-01.3`; `FR-AUTH-06` | NOT STARTED |
| `[ ]` | **API-AUTH-03** | `POST /auth/register` — email + password registration. Auth: none. | — | `iam/` | C3.2 | Contract; `FR-AUTH-01`, `FR-AUTH-04` | NOT STARTED |
| `[ ]` | **API-AUTH-04** | `POST /auth/login` — email + password login. Auth: none. | — | `iam/` | C3.2 | Contract + Security; `FR-AUTH-04`, `FR-AUTH-08` | NOT STARTED |
| `[ ]` | **API-AUTH-05** | `POST /auth/refresh` — rotate refresh token. Auth: refresh token. | — | `iam/` | C3.2 | Contract + Security (reuse detection revokes the family); `FR-AUTH-06` | NOT STARTED |
| `[ ]` | **API-AUTH-06** | `POST /auth/logout` — revoke current session. Auth: yes. | — | `iam/` | C3.2 | Contract; `FR-AUTH-09` | NOT STARTED |
| `[ ]` | **API-AUTH-07** | `POST /auth/password/forgot` — initiate reset. Auth: none. | — | `iam/` | C3.2 | Contract + rate-limit test; `NFR-SEC-06` | NOT STARTED |
| `[ ]` | **API-AUTH-08** | `POST /auth/password/reset` — complete reset. Auth: reset token. | — | `iam/` | C3.2 | Contract; `FR-AUTH-10` (all sessions invalidated) | NOT STARTED |
| `[ ]` | **API-AUTH-09** | `GET /auth/sessions` — list active sessions. Auth: yes. | — | `iam/` | C3.2 | Contract + pagination; `FR-AUTH-09` | NOT STARTED |
| `[ ]` | **API-AUTH-10** | `DELETE /auth/sessions/:id` — revoke a session. Auth: yes. | — | `iam/` | C3.2 | Contract + negative (another user's session); `FR-AUTH-09` | NOT STARTED |
| `[ ]` | **API-AUTH-11** | `POST /auth/mfa/enrol` — TOTP enrolment. Auth: yes. | — | `iam/` | C3.2 | Contract; `FR-AUTH-07`; `NFR-SEC-11` | NOT STARTED |
| `[ ]` | **API-AUTH-12** | `POST /auth/mfa/verify` — TOTP verification. Auth: yes. | — | `iam/` | C3.2 | Contract + negative; `FR-AUTH-07`; `NFR-SEC-11` | NOT STARTED |
| `[ ]` | **API-AUTH-13** | `POST /auth/impersonate` — start support impersonation. Auth: Support. | — | `iam/` | C3.2 | Contract + RBAC + audit; `FR-AUTH-12`; `BR-DAT-02` | NOT STARTED |
| `[ ]` | **API-AUTH-14** | `POST /auth/impersonate/end` — end support impersonation. Auth: Support. | — | `iam/` | C3.2 | Contract + audit; `AC-AUTH-03.3` | NOT STARTED |
| `[ ]` | **API-AUTH-15** | `POST /auth/tenant-context` — switch active tenant. Auth: yes. | — | `tenancy/` | C3.2 | Contract + Isolation + audit; `AC-AUTH-02.1`, `AC-AUTH-02.2`; `BR-TEN-02` | NOT STARTED |

### 12.2 `API-USER` — Users (§C3.2) — 10 endpoints

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **API-USER-01** | `GET /me` — own profile. | — | `iam/` | C3.2 | Contract + Isolation; `FR-USER-01` | NOT STARTED |
| `[ ]` | **API-USER-02** | `PATCH /me` — update own profile. | — | `iam/` | C3.2 | Contract + validation; `FR-USER-01`; validation library pending `A-02` | NOT STARTED |
| `[ ]` | **API-USER-03** | `GET /me/preferences` — read notification preferences. | — | `notifications/` | C3.2 | Contract; `FR-USER-04` | NOT STARTED |
| `[ ]` | **API-USER-04** | `PUT /me/preferences` — replace notification preferences. | — | `notifications/` | C3.2 | Contract + negative (transactional cannot be disabled); `FR-NOTF-02` | NOT STARTED |
| `[ ]` | **API-USER-05** | `GET /me/activity` — account activity log. | — | `iam/` · `audit/` | C3.2 | Contract + pagination; `FR-USER-05`; `AC-AUTH-03.3` | NOT STARTED |
| `[ ]` | **API-USER-06** | `POST /me/export` — request data export. | — | `iam/` · `reporting/` | C3.2 | Contract (`202 Accepted`); `FR-USER-06`; `BR-DAT-03` | NOT STARTED |
| `[ ]` | **API-USER-07** | `POST /me/delete-request` — request account deletion. | — | `iam/` | C3.2 | Contract; `FR-USER-07`; `AC-USER-02.1`, `AC-USER-02.4` | NOT STARTED |
| `[ ]` | **API-USER-08** | `DELETE /me/delete-request` — cancel a scheduled deletion. | — | `iam/` | C3.2 | Contract (within the 7-day grace period); `AC-USER-02.2` | NOT STARTED |
| `[ ]` | **API-USER-09** | `POST /me/phone/change` — change mobile with verification. | — | `iam/` | C3.2 | Contract + negative (unverified value not effective); `FR-USER-08` | NOT STARTED |
| `[ ]` | **API-USER-10** | `POST /me/email/change` — change email with verification. | — | `iam/` | C3.2 | Contract + negative; `FR-USER-08`; `FR-AUTH-02` | NOT STARTED |

### 12.3 `API-DISC` — Discovery, public (§C3.2) — 12 endpoints

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **API-DISC-01** | `GET /search/gyms` — search with `lat,lng,radius,q,filters,sort,cursor`. | — | `discovery/` | C3.2 | Contract + Performance; `NFR-PERF-01`; `FR-SRCH-03`, `FR-SRCH-04`, `FR-SRCH-09` | NOT STARTED |
| `[ ]` | **API-DISC-02** | `GET /search/suggest` — autocomplete for locality and gym name. | — | `discovery/` | C3.2 | Contract; `FR-SRCH-02` typo tolerance | NOT STARTED |
| `[ ]` | **API-DISC-03** | `GET /gyms/:slug` — gym detail. | — | `discovery/` · `catalog/` | C3.2 | Contract; `FR-DETL-01`; `FR-DETL-11` (informational page, not 404) | NOT STARTED |
| `[ ]` | **API-DISC-04** | `GET /gyms/:slug/plans` — public plan catalogue. | — | `plans/` | C3.2 | Contract + negative (`STAFF_ONLY` never returned); `BR-PLN-05` | NOT STARTED |
| `[ ]` | **API-DISC-05** | `GET /gyms/:slug/reviews` — paginated reviews. | — | `reviews/` | C3.2 | Contract + pagination + sort/filter; `FR-DETL-05` | NOT STARTED |
| `[ ]` | **API-DISC-06** | `GET /gyms/:slug/similar` — similar nearby gyms. | — | `discovery/` | C3.2 | Contract; `FR-DETL-01` region 11 | NOT STARTED |
| `[ ]` | **API-DISC-07** | `POST /compare` — resolve a comparison set. | — | `discovery/` | C3.2 | Contract + negative (max 4); `FR-DETL-08`; `AC-DETL-01.3` | NOT STARTED |
| `[ ]` | **API-DISC-08** | `GET /cities` — city directory. | — | `discovery/` | C3.2 | Contract; `REF-02 cities`; `FR-SRCH-13` | NOT STARTED |
| `[ ]` | **API-DISC-09** | `GET /cities/:slug` — city landing data. | — | `discovery/` | C3.2 | Contract + SEO; `FR-SRCH-13`; `/city/:citySlug` | NOT STARTED |
| `[ ]` | **API-DISC-10** | `GET /categories` — category directory. | — | `discovery/` | C3.2 | Contract; `REF-05 gym_categories` | NOT STARTED |
| `[ ]` | **API-DISC-11** | `GET /categories/:slug` — category landing data. | — | `discovery/` | C3.2 | Contract + SEO; `/c/:categorySlug` | NOT STARTED |
| `[ ]` | **API-DISC-12** | `GET /amenities` — amenity reference data. | — | `discovery/` · `admin/` | C3.2 | Contract; `REF-04 amenities`; `FR-GYM-03` | NOT STARTED |

### 12.4 `API-FAV` — Favourites (§C3.2) — 6 endpoints

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **API-FAV-01** | `GET /me/favourites` — list favourited gyms. | — | `discovery/` | C3.2 | Contract + pagination + Isolation; `FR-FAV-02` | NOT STARTED |
| `[ ]` | **API-FAV-02** | `POST /me/favourites` — favourite a gym. | — | `discovery/` | C3.2 | Contract; `FR-FAV-01`; `EVT-11 favourite_added` | NOT STARTED |
| `[ ]` | **API-FAV-03** | `DELETE /me/favourites/:gymId` — unfavourite a gym. | — | `discovery/` | C3.2 | Contract + negative (another user's favourite); `EVT-12 favourite_removed` | NOT STARTED |
| `[ ]` | **API-FAV-04** | `GET /me/saved-searches` — list saved searches. | — | `discovery/` | C3.2 | Contract + pagination; `FR-FAV-05`; `FR-SRCH-14` | NOT STARTED |
| `[ ]` | **API-FAV-05** | `POST /me/saved-searches` — create a saved search. | — | `discovery/` | C3.2 | Contract; `FR-FAV-05` | NOT STARTED |
| `[ ]` | **API-FAV-06** | `DELETE /me/saved-searches` — delete a saved search. *(The PRD prints one path for all three verbs; the identifier binding is fixed in `/docs/apis/` at Phase 5 without changing this row's scope.)* | — | `discovery/` | C3.2 | Contract + negative; `FR-FAV-05` | NOT STARTED |

### 12.5 `API-ORD` — Orders and checkout (§C3.2) — 7 endpoints

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **API-ORD-01** | `POST /orders` — create order; **the server prices it**. Idempotency-Key required. | — | `ordering/` | C3.2 · C3.3 | Contract (§C3.3 request/response shape) + Integration; `BR-PAY-03`, `BR-PAY-04`; `FR-CART-04`, `FR-CART-06` | NOT STARTED |
| `[ ]` | **API-ORD-02** | `GET /orders/:ref` — order detail. | — | `ordering/` | C3.2 | Contract + Isolation; `FR-CART-11` | NOT STARTED |
| `[ ]` | **API-ORD-03** | `POST /orders/:ref/coupon` — apply coupon. Idempotency-Key required. | — | `ordering/` | C3.2 | Contract + negative (stacking refused); `BR-CPN-02`, `BR-CPN-03` | NOT STARTED |
| `[ ]` | **API-ORD-04** | `DELETE /orders/:ref/coupon` — remove coupon. Idempotency-Key required. | — | `ordering/` | C3.2 | Contract; `FR-CPN-03` re-validation on removal | NOT STARTED |
| `[ ]` | **API-ORD-05** | `POST /orders/:ref/validate` — re-validate before payment. | — | `ordering/` | C3.2 | Contract (422 `PLAN_PRICE_CHANGED` per §C3.3); `BR-PLN-03`; `AC-PLAN-02.2` | NOT STARTED |
| `[ ]` | **API-ORD-06** | `POST /orders/:ref/cancel` — cancel a pending order. Idempotency-Key required. | — | `ordering/` | C3.2 | Contract; `SMT-14`; `FR-CART-05` | NOT STARTED |
| `[ ]` | **API-ORD-07** | `GET /me/orders` — own order history. | — | `ordering/` | C3.2 | Contract + pagination + Isolation; `FR-CART-11` | NOT STARTED |

### 12.6 `API-PAY` — Payments (§C3.2) — 4 endpoints

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **API-PAY-01** | `POST /orders/:ref/payment-intent` — create a provider intent. Idempotency-Key required. | — | `payments/` | C3.2 | Contract + Performance; `NFR-PERF-05`; `BR-PAY-03` | NOT STARTED |
| `[ ]` | **API-PAY-02** | `GET /payments/:id` — payment status. | — | `payments/` | C3.2 | Contract + Isolation; `SM-03` | NOT STARTED |
| `[ ]` | **API-PAY-03** | `POST /payments/:id/retry` — new intent for the same order. Idempotency-Key required. | — | `payments/` | C3.2 | Contract + negative (expired order refused with `410`); `FR-PAY-06` | NOT STARTED |
| `[ ]` | **API-PAY-04** | `POST /webhooks/payments/:provider` — provider webhook, signature-verified, unauthenticated but IP- and signature-guarded. | — | `payments/` | C3.2 | Contract + Security (unsigned discarded, replay deduplicated); `BR-PAY-05`; `FR-PAY-04` | NOT STARTED |

### 12.7 `API-MEMB` — Memberships (§C3.2) — 10 endpoints

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **API-MEMB-01** | `GET /me/memberships` — own memberships. | — | `memberships/` | C3.2 | Contract + pagination + Isolation; `memberships (user_id, status)` index | NOT STARTED |
| `[ ]` | **API-MEMB-02** | `GET /me/memberships/:id` — own membership detail. | — | `memberships/` | C3.2 | Contract + negative (another user's membership); `FR-MEMB-03` | NOT STARTED |
| `[ ]` | **API-MEMB-03** | `POST /me/memberships/:id/freeze` — request a freeze. Idempotency-Key required. | — | `memberships/` | C3.2 | Contract + negative (plan disallows, allowance exhausted, retroactive date); `BR-MEM-05`, `BR-MEM-07` | NOT STARTED |
| `[ ]` | **API-MEMB-04** | `POST /me/memberships/:id/unfreeze` — end a freeze early. Idempotency-Key required. | — | `memberships/` | C3.2 | Contract; `FR-MEMB-05`; `AC-MEMB-01.3`; `SMT-06` | NOT STARTED |
| `[ ]` | **API-MEMB-05** | `POST /me/memberships/:id/renew` — create a renewal order. Idempotency-Key required. | — | `memberships/` · `ordering/` | C3.2 | Contract; `FR-MEMB-06`; `AC-MEMB-02.2` | NOT STARTED |
| `[ ]` | **API-MEMB-06** | `PATCH /me/memberships/:id/auto-renew` — toggle auto-renewal. Idempotency-Key required. | — | `memberships/` | C3.2 | Contract; `BR-MEM-10`; `FR-MEMB-08` | NOT STARTED |
| `[ ]` | **API-MEMB-07** | `POST /me/memberships/:id/qr` — issue a check-in token. | — | `attendance/` | C3.2 | Contract + Security (60 s TTL, no personal data in payload); `BR-CHK-02`; `FR-CHK-02` | NOT STARTED |
| `[ ]` | **API-MEMB-08** | `GET /me/attendance` — own visit history. | — | `attendance/` | C3.2 | Contract + pagination + Isolation; `FR-CHK-11` | NOT STARTED |
| `[ ]` | **API-MEMB-09** | `GET /tenant/memberships` — tenant view with filters. | — | `memberships/` | C3.2 | Contract + Isolation + RBAC; `FR-MEMB-12`; `E2E-11` | NOT STARTED |
| `[ ]` | **API-MEMB-10** | `POST /tenant/memberships/:id/transfer` — transfer where permitted. Idempotency-Key required. | — | `memberships/` | C3.2 | Contract + negative (plan disallows); `BR-MEM-08`; `FR-MEMB-11` | NOT STARTED |

### 12.8 `API-CHK` — Check-in (§C3.2) — 6 endpoints

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **API-CHK-01** | `POST /checkin/scan` — validate a token and record attendance. Idempotency-Key = token nonce. **A denial is `200`, not `4xx`** — a successful evaluation with a negative result, returning full context. | — | `attendance/` | C3.2 · C3.3 | Contract (both `ALLOWED` and `DENIED` shapes per §C3.3) + Performance; `NFR-PERF-03`; `BR-CHK-06` | NOT STARTED |
| `[ ]` | **API-CHK-02** | `POST /checkin/manual` — staff manual check-in. Idempotency-Key required. | — | `attendance/` | C3.2 | Contract + RBAC; `FR-CHK-07`; `BR-CHK-08` | NOT STARTED |
| `[ ]` | **API-CHK-03** | `POST /checkin/:id/checkout` — record check-out. Idempotency-Key required. | — | `attendance/` | C3.2 | Contract; `FR-CHK-09`; `attendance.duration_minutes` | NOT STARTED |
| `[ ]` | **API-CHK-04** | `POST /checkin/override` — override a denial with reason. Idempotency-Key required. | — | `attendance/` · `audit/` | C3.2 | Contract + RBAC + audit; `FR-CHK-08`; `RCT-05`; `OQ-09` | NOT STARTED |
| `[ ]` | **API-CHK-05** | `GET /tenant/attendance` — attendance log with filters. | — | `attendance/` | C3.2 | Contract + pagination + Isolation + RBAC; `FR-CHK-10` | NOT STARTED |
| `[ ]` | **API-CHK-06** | `GET /tenant/attendance/heatmap` — aggregated peak hours. | — | `attendance/` · `reporting/` | C3.2 | Contract + Isolation; `FR-CHK-13`; `AC-CHK-02.1`, `AC-CHK-02.2` | NOT STARTED |

### 12.9 `API-TEN` — Tenant management (§C3.2) — 57 endpoints

Every endpoint in this group is tenant-scoped and therefore requires isolation coverage before merge
(§C7). None accepts a tenant identifier from the client (§C3.1).

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **API-TEN-01** | `POST /tenants` — create tenant (owner signup). | — | `tenancy/` | C3.2 | Contract; `E2E-01`; `BR-TEN-02` | NOT STARTED |
| `[ ]` | **API-TEN-02** | `GET /tenant` — tenant profile. | — | `tenancy/` | C3.2 | Contract + Isolation | NOT STARTED |
| `[ ]` | **API-TEN-03** | `PATCH /tenant` — update tenant profile. | — | `tenancy/` | C3.2 | Contract + Isolation + RBAC + audit; `BR-GYM-06` material-change routing | NOT STARTED |
| `[ ]` | **API-TEN-04** | `GET /tenant/settings` — read settings including refund policy. | — | `tenancy/` | C3.2 | Contract + Isolation; `BR-REF-01` | NOT STARTED |
| `[ ]` | **API-TEN-05** | `PUT /tenant/settings` — replace settings including refund policy. | — | `tenancy/` | C3.2 | Contract + audit; `BR-REF-01`, `BR-REF-02`; `SCR-DASH-022` | NOT STARTED |
| `[ ]` | **API-TEN-06** | `GET /tenant/applications` — onboarding application state. | — | `onboarding/` | C3.2 | Contract + Isolation; `FR-ONB-09`; `SM-04` | NOT STARTED |
| `[ ]` | **API-TEN-07** | `POST /tenant/applications` — submit an application. Idempotency-Key required. | — | `onboarding/` | C3.2 | Contract; `FR-ONB-07`, `FR-ONB-08`, `FR-ONB-12`; `E2E-01` | NOT STARTED |
| `[ ]` | **API-TEN-08** | `GET /tenant/kyc-documents` — list KYC documents. | — | `onboarding/` | C3.2 | Contract + RBAC + access log; `BR-DAT-07` | NOT STARTED |
| `[ ]` | **API-TEN-09** | `POST /tenant/kyc-documents` — upload a KYC document. | — | `onboarding/` | C3.2 | Contract + Security (type, size, virus scan, metadata strip); `NFR-SEC-02`, `NFR-SEC-10` | NOT STARTED |
| `[ ]` | **API-TEN-10** | `DELETE /tenant/kyc-documents` — remove a KYC document. | — | `onboarding/` | C3.2 | Contract + audit; `BR-DAT-07` | NOT STARTED |
| `[ ]` | **API-TEN-11** | `GET /tenant/gyms` — list gyms. | — | `catalog/` | C3.2 | Contract + Isolation | NOT STARTED |
| `[ ]` | **API-TEN-12** | `POST /tenant/gyms` — create a gym. | — | `catalog/` | C3.2 | Contract + RBAC; `FR-GYM-01` | NOT STARTED |
| `[ ]` | **API-TEN-13** | `PATCH /tenant/gyms/:id` — update a gym. | — | `catalog/` | C3.2 | Contract + audit; `FR-GYM-11`; `BR-GYM-06`, `BR-GYM-07` | NOT STARTED |
| `[ ]` | **API-TEN-14** | `GET /tenant/branches` — list branches. | — | `catalog/` | C3.2 | Contract + Isolation; `BR-TEN-03` | NOT STARTED |
| `[ ]` | **API-TEN-15** | `POST /tenant/branches` — create a branch. | — | `catalog/` | C3.2 | Contract + RBAC; `FR-GYM-07`; §B3.2 *Add / remove branch* | NOT STARTED |
| `[ ]` | **API-TEN-16** | `PATCH /tenant/branches` — update a branch. | — | `catalog/` | C3.2 | Contract + audit; `FR-GYM-07` | NOT STARTED |
| `[ ]` | **API-TEN-17** | `DELETE /tenant/branches` — deactivate/remove a branch. | — | `catalog/` | C3.2 | Contract + negative (consequence stated, `NFR-USE-06`); `FR-GYM-07` | NOT STARTED |
| `[ ]` | **API-TEN-18** | `PUT /tenant/branches/:id/hours` — set operating hours. | — | `catalog/` | C3.2 | Contract; `FR-GYM-04`; `branch_hours`, `branch_hour_exceptions` | NOT STARTED |
| `[ ]` | **API-TEN-19** | `POST /tenant/gyms/:id/media` — media upload. | — | `catalog/` | C3.2 | Contract + Security; `FR-GYM-02`; `NFR-SEC-10`; image processor pending `A-17` | NOT STARTED |
| `[ ]` | **API-TEN-20** | `GET /tenant/plans` — list plans. | — | `plans/` | C3.2 | Contract + Isolation | NOT STARTED |
| `[ ]` | **API-TEN-21** | `POST /tenant/plans` — create a plan. | — | `plans/` | C3.2 | Contract + RBAC; `FR-PLAN-01`; `BR-PLN-01` | NOT STARTED |
| `[ ]` | **API-TEN-22** | `PATCH /tenant/plans/:id` — update a plan. | — | `plans/` | C3.2 | Contract + negative (overlapping promotion refused); `BR-PLN-07`; `FR-PLAN-08` | NOT STARTED |
| `[ ]` | **API-TEN-23** | `POST /tenant/plans/:id/publish` — publish a plan. | — | `plans/` | C3.2 | Contract + RBAC (`GYM_OWNER` / `SUPER_ADMIN` only); §B3.2 *Publish plan to marketplace* | NOT STARTED |
| `[ ]` | **API-TEN-24** | `POST /tenant/plans/:id/archive` — archive a plan. | — | `plans/` | C3.2 | Contract + negative (hard delete impossible while referenced); `BR-PLN-04`; `FR-PLAN-05` | NOT STARTED |
| `[ ]` | **API-TEN-25** | `POST /tenant/plans/:id/duplicate` — duplicate a plan as a draft. | — | `plans/` | C3.2 | Contract; `FR-PLAN-06` | NOT STARTED |
| `[ ]` | **API-TEN-26** | `GET /tenant/members` — member list with search and filters. | — | `crm/` | C3.2 | Contract + pagination + Isolation + Performance; `FR-CRM-01`; `NFR-PERF-04` | NOT STARTED |
| `[ ]` | **API-TEN-27** | `POST /tenant/members` — create a walk-in member. | — | `crm/` | C3.2 | Contract + RBAC; `FR-CRM-04` | NOT STARTED |
| `[ ]` | **API-TEN-28** | `PATCH /tenant/members/:id` — update a member. | — | `crm/` | C3.2 | Contract + RBAC + audit; §B3.2 *Edit member record*; `BR-DAT-01` | NOT STARTED |
| `[ ]` | **API-TEN-29** | `POST /tenant/members/import` — bulk CSV import. Idempotency required for re-run. | — | `crm/` · `onboarding/` | C3.2 | Contract (`202 Accepted`) + Integration; `AC-ONB-03.1` … `AC-ONB-03.4` | NOT STARTED |
| `[ ]` | **API-TEN-30** | `GET /tenant/members/:id/notes` — list internal notes. | — | `crm/` | C3.2 | Contract + negative (never exposed to the member); `FR-CRM-05` | NOT STARTED |
| `[ ]` | **API-TEN-31** | `POST /tenant/members/:id/notes` — add an internal note. | — | `crm/` | C3.2 | Contract (timestamped and attributed); `FR-CRM-05` | NOT STARTED |
| `[ ]` | **API-TEN-32** | `GET /tenant/staff` — list staff. | — | `staff/` | C3.2 | Contract + Isolation + RBAC; `FR-STAF-03` | NOT STARTED |
| `[ ]` | **API-TEN-33** | `POST /tenant/staff` — invite staff with role and branches. | — | `staff/` · `iam/` | C3.2 | Contract + negative (seat cap); `FR-STAF-01`, `FR-STAF-06`; `FR-RBAC-06` | NOT STARTED |
| `[ ]` | **API-TEN-34** | `PATCH /tenant/staff` — update staff role, branches or status. | — | `staff/` | C3.2 | Contract + negative (last owner cannot be demoted); `FR-STAF-09`; `FR-RBAC-07` | NOT STARTED |
| `[ ]` | **API-TEN-35** | `DELETE /tenant/staff` — remove staff. | — | `staff/` | C3.2 | Contract + negative (last owner) + Integration (attribution retained); `AC-STAF-01.4` | NOT STARTED |
| `[ ]` | **API-TEN-36** | `GET /tenant/coupons` — list coupons. | — | `ordering/` | C3.2 | Contract + Isolation; `FR-CPN-02` | NOT STARTED |
| `[ ]` | **API-TEN-37** | `POST /tenant/coupons` — create a tenant coupon. | — | `ordering/` | C3.2 | Contract + RBAC; `FR-CPN-01`; `BR-CPN-01` | NOT STARTED |
| `[ ]` | **API-TEN-38** | `PATCH /tenant/coupons` — update, pause or resume a coupon. | — | `ordering/` | C3.2 | Contract + negative (`funding_source` immutable after first use); `BR-CPN-05`; `FR-CPN-07` | NOT STARTED |
| `[ ]` | **API-TEN-39** | `GET /tenant/orders` — tenant order view. | — | `ordering/` | C3.2 | Contract + pagination + Isolation; `E2E-11` | NOT STARTED |
| `[ ]` | **API-TEN-40** | `GET /tenant/payments` — tenant payment view. | — | `payments/` | C3.2 | Contract + pagination + Isolation | NOT STARTED |
| `[ ]` | **API-TEN-41** | `GET /tenant/invoices` — tenant invoice view. | — | `billing/` | C3.2 | Contract + pagination + Isolation; `FR-INV-08`, `FR-INV-10` | NOT STARTED |
| `[ ]` | **API-TEN-42** | `POST /tenant/orders/offline` — record an offline sale. Idempotency-Key required. | — | `ordering/` | C3.2 | Contract + RBAC; `FR-CART-09`; `BR-PAY-09`; `E2E-10` | NOT STARTED |
| `[ ]` | **API-TEN-43** | `POST /tenant/orders/:ref/collect-balance` — collect an outstanding balance. Idempotency-Key required. | — | `ordering/` · `billing/` | C3.2 | Contract; `AC-CART-02.3` (single consolidated invoice); `SMT-16` | NOT STARTED |
| `[ ]` | **API-TEN-44** | `GET /tenant/settlements` — list settlement batches. | — | `settlements/` | C3.2 | Contract + pagination + Isolation + RBAC; `FR-SETL-07` | NOT STARTED |
| `[ ]` | **API-TEN-45** | `GET /tenant/settlements/:id` — settlement statement detail. | — | `settlements/` | C3.2 | Contract; `AC-SETL-01.1` … `AC-SETL-01.4`; `BR-FIN-02`, `BR-FIN-03` | NOT STARTED |
| `[ ]` | **API-TEN-46** | `GET /tenant/refunds` — list refund requests. | — | `refunds/` | C3.2 | Contract + pagination + Isolation; `FR-RFND-11` | NOT STARTED |
| `[ ]` | **API-TEN-47** | `POST /tenant/refunds` — raise a refund request. Idempotency-Key required. | — | `refunds/` | C3.2 | Contract + negative (already refunded is idempotent on the order); `BR-REF-09` | NOT STARTED |
| `[ ]` | **API-TEN-48** | `GET /tenant/reviews` — reviews received. | — | `reviews/` | C3.2 | Contract + pagination + Isolation; `SCR-DASH-019` | NOT STARTED |
| `[ ]` | **API-TEN-49** | `POST /tenant/reviews/:id/respond` — respond to a review, once. | — | `reviews/` | C3.2 | Contract + negative (second response refused); `FR-REV-05`; `BR-REV-05` | NOT STARTED |
| `[ ]` | **API-TEN-50** | `POST /tenant/reviews/:id/report` — report a review with a structured reason. | — | `reviews/` | C3.2 | Contract + Integration (review stays published); `FR-REV-06`; `BR-REV-06` | NOT STARTED |
| `[ ]` | **API-TEN-51** | `GET /tenant/leads` — lead pipeline. | — | `crm/` | C3.2 | Contract + pagination + Isolation; `SCR-DASH-017` | NOT STARTED |
| `[ ]` | **API-TEN-52** | `POST /tenant/leads` — create a lead. | — | `crm/` | C3.2 | Contract; tenant report *Lead funnel* | NOT STARTED |
| `[ ]` | **API-TEN-53** | `PATCH /tenant/leads` — update a lead's stage, owner or follow-up. | — | `crm/` | C3.2 | Contract; `SCR-DASH-017` pipeline stages | NOT STARTED |
| `[ ]` | **API-TEN-54** | `GET /tenant/reports/:reportKey` — run a tenant report. | — | `reporting/` | C3.2 | Contract (all 16 tenant reports) + Performance; `FR-RPT-01`, `FR-RPT-02`; `NFR-PERF-06` | NOT STARTED |
| `[ ]` | **API-TEN-55** | `POST /tenant/exports` — request an asynchronous export. | — | `reporting/` | C3.2 | Contract (`202 Accepted`); `BR-DAT-05`; `BAC-12`; `FR-RPT-03` | NOT STARTED |
| `[ ]` | **API-TEN-56** | `GET /tenant/payout-account` — read the payout account. | — | `settlements/` | C3.2 | Contract + RBAC (`GYM_OWNER` only); §B3.2 *Change payout bank account* | NOT STARTED |
| `[ ]` | **API-TEN-57** | `PUT /tenant/payout-account` — replace the payout account. | — | `settlements/` | C3.2 | Contract + Integration (payouts suspend until re-verified) + audit; `BR-GYM-06`; `AC-AUTH-03.2` | NOT STARTED |

### 12.10 `API-REV` — Reviews, member-facing (§C3.2) — 6 endpoints

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **API-REV-01** | `GET /me/reviews` — own reviews. | — | `reviews/` | C3.2 | Contract + pagination + Isolation; `SCR-WEB-013` | NOT STARTED |
| `[ ]` | **API-REV-02** | `POST /gyms/:slug/reviews` — submit a review. | — | `reviews/` | C3.2 | Contract (403 without a recorded check-in); `AC-REV-02.1`; `BR-REV-01`; `BAC-09` | NOT STARTED |
| `[ ]` | **API-REV-03** | `PATCH /reviews/:id` — edit own review within 7 days. | — | `reviews/` | C3.2 | Contract + negative (past 7 days) + Integration (edit history retained); `BR-REV-02` | NOT STARTED |
| `[ ]` | **API-REV-04** | `DELETE /reviews/:id` — delete own review; aggregate updates, deletion retained in audit. | — | `reviews/` · `audit/` | C3.2 | Contract + Integration; `FR-REV-11` | NOT STARTED |
| `[ ]` | **API-REV-05** | `POST /reviews/:id/report` — report a review. | — | `reviews/` | C3.2 | Contract; `RCT-04`; `BR-REV-06` | NOT STARTED |
| `[ ]` | **API-REV-06** | `GET /gyms/:slug/reviews/eligibility` — server-side eligibility check. | — | `reviews/` · `attendance/` | C3.2 | Contract (both eligible and ineligible); `FR-REV-01`; `SCR-WEB-013-E` | NOT STARTED |

### 12.11 `API-RFND` — Refunds, member-facing (§C3.2) — 3 endpoints

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **API-RFND-01** | `POST /me/memberships/:id/refund-request` — request a refund. Idempotency-Key required. | — | `refunds/` | C3.2 | Contract + negative (already refunded); `BR-REF-09`; `AC-RFND-01.1`, `AC-RFND-01.2` | NOT STARTED |
| `[ ]` | **API-RFND-02** | `GET /me/refunds` — own refund list. | — | `refunds/` | C3.2 | Contract + pagination + Isolation | NOT STARTED |
| `[ ]` | **API-RFND-03** | `GET /me/refunds/:id` — own refund detail with the computation shown. | — | `refunds/` | C3.2 | Contract; `FR-RFND-04`; `refunds.computation` | NOT STARTED |

### 12.12 `API-ADM` — Platform administration (§C3.2) — 48 endpoints

Every endpoint in this group is platform-scope, requires MFA (`NFR-SEC-11`), requires a reason where
it mutates (`FR-ADMN-02`), and is audited (`BR-DAT-01`). Cross-tenant reads use the distinct,
explicitly-elevated database role described in §C1.4, never an ambient capability.

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **API-ADM-01** | `GET /admin/applications` — approval queue. | — | `admin/` · `onboarding/` | C3.2 | Contract + RBAC + pagination; `FR-ADMN-11`; `SCR-ADM-002` | NOT STARTED |
| `[ ]` | **API-ADM-02** | `GET /admin/applications/:id` — application review detail with pre-checks and history. | — | `admin/` · `onboarding/` | C3.2 | Contract + RBAC + access log; `AC-ONB-02.1`, `AC-ONB-02.2`; `BR-DAT-07` | NOT STARTED |
| `[ ]` | **API-ADM-03** | `POST /admin/applications/:id/approve` — approve an application. | — | `admin/` · `onboarding/` | C3.2 | Contract + RBAC + negative (failed pre-check requires override with reason); `BR-GYM-03`, `BR-GYM-08`; `AC-ONB-02.5` | NOT STARTED |
| `[ ]` | **API-ADM-04** | `POST /admin/applications/:id/reject` — reject with ≥1 structured reason code. | — | `admin/` · `onboarding/` | C3.2 | Contract + negative (no reason code refused); `BR-GYM-04`; `RCT-02` | NOT STARTED |
| `[ ]` | **API-ADM-05** | `POST /admin/applications/:id/request-info` — move to `INFO_REQUESTED` with a targeted checklist. | — | `admin/` · `onboarding/` | C3.2 | Contract; `FR-ONB-10`; `SMT-35` | NOT STARTED |
| `[ ]` | **API-ADM-06** | `POST /admin/applications/:id/assign` — assign a reviewer. | — | `admin/` · `onboarding/` | C3.2 | Contract; `FR-ADMN-11`; `SMT-32` | NOT STARTED |
| `[ ]` | **API-ADM-07** | `GET /admin/tenants` — tenant list. | — | `admin/` | C3.2 | Contract + RBAC + pagination; `SCR-ADM-004` | NOT STARTED |
| `[ ]` | **API-ADM-08** | `GET /admin/tenants/:id` — tenant detail across all tabs. | — | `admin/` | C3.2 | Contract + RBAC; `FR-ADMN-01` | NOT STARTED |
| `[ ]` | **API-ADM-09** | `PATCH /admin/tenants` — bulk tenant attribute update. | — | `admin/` | C3.2 | Contract + audit + reason; `FR-ADMN-02` | NOT STARTED |
| `[ ]` | **API-ADM-10** | `PATCH /admin/tenants/:id` — update a single tenant's attributes. | — | `admin/` | C3.2 | Contract + audit + reason; `FR-ADMN-01`, `FR-ADMN-02` | NOT STARTED |
| `[ ]` | **API-ADM-11** | `POST /admin/tenants/:id/suspend` — suspend a tenant with a reason. | — | `admin/` · `tenancy/` | C3.2 | Contract + Integration (removed from search immediately; check-in still permitted); `BR-TEN-05`; `UAT-06` | NOT STARTED |
| `[ ]` | **API-ADM-12** | `POST /admin/tenants/:id/reinstate` — reinstate a suspended tenant. | — | `admin/` · `tenancy/` | C3.2 | Contract + audit; `SMT-42`, `SMT-43` | NOT STARTED |
| `[ ]` | **API-ADM-13** | `POST /admin/tenants/:id/commission-override` — set a tenant commission override with a validity window. | — | `admin/` · `settlements/` | C3.2 | Contract + Integration (no blast radius); `AC-ADMN-01.1` … `AC-ADMN-01.4`; `BR-FIN-05` | NOT STARTED |
| `[ ]` | **API-ADM-14** | `POST /admin/tenants/:id/tier` — change subscription tier. | — | `admin/` · `billing/` | C3.2 | Contract + audit; `FR-ADMN-04`; §A6.2 limits | NOT STARTED |
| `[ ]` | **API-ADM-15** | `GET /admin/users` — platform-wide user search. | — | `admin/` · `iam/` | C3.2 | Contract + RBAC + pagination; `SCR-ADM-005` | NOT STARTED |
| `[ ]` | **API-ADM-16** | `GET /admin/users/:id` — user detail with memberships, orders, payments, reviews, tickets, sessions. | — | `admin/` · `iam/` | C3.2 | Contract + RBAC; `SCR-ADM-005` | NOT STARTED |
| `[ ]` | **API-ADM-17** | `GET /admin/orders` — all orders across tenants. | — | `admin/` · `ordering/` | C3.2 | Contract + RBAC + elevated-role audit; §C1.4 platform-scope operations | NOT STARTED |
| `[ ]` | **API-ADM-18** | `GET /admin/payments` — payment log with gateway state and redacted payloads. | — | `admin/` · `payments/` | C3.2 | Contract + Security (redaction); `FR-PAY-07`; `BR-PAY-08` | NOT STARTED |
| `[ ]` | **API-ADM-19** | `GET /admin/settlements` — settlement runs across tenants. | — | `admin/` · `settlements/` | C3.2 | Contract + RBAC; `SCR-ADM-007` | NOT STARTED |
| `[ ]` | **API-ADM-20** | `POST /admin/settlements/:id/approve` — approve a payout, with dual control above the threshold. | — | `admin/` · `settlements/` | C3.2 | Contract + Integration (dual control); `BR-FIN-08`; `FR-SETL-06` | NOT STARTED |
| `[ ]` | **API-ADM-21** | `GET /admin/refunds` — refund approval queue. | — | `admin/` · `refunds/` | C3.2 | Contract + RBAC + pagination; `SCR-ADM-008` | NOT STARTED |
| `[ ]` | **API-ADM-22** | `POST /admin/refunds/:id/decide` — approve or reject a refund with a reason. | — | `admin/` · `refunds/` | C3.2 | Contract + negative (no reason refused); `BR-REF-03`, `BR-REF-06`; `SMT-45`, `SMT-46` | NOT STARTED |
| `[ ]` | **API-ADM-23** | `GET /admin/disputes` — chargeback case list. | — | `admin/` · `refunds/` | C3.2 | Contract + RBAC; `FR-RFND-08`; `SCR-ADM-009` | NOT STARTED |
| `[ ]` | **API-ADM-24** | `POST /admin/disputes/:id/evidence` — submit the evidence pack. | — | `admin/` · `refunds/` | C3.2 | Contract + negative (incomplete pack named); `FR-RFND-09`; `AC-RFND-02.2` | NOT STARTED |
| `[ ]` | **API-ADM-25** | `GET /admin/reconciliation` — daily reconciliation report and variances. | — | `admin/` · `settlements/` | C3.2 | Contract; `FR-SETL-09`; `KPI-26`; `BAC-07` | NOT STARTED |
| `[ ]` | **API-ADM-26** | `GET /admin/config/commission` — read commission rules (global / tier / tenant). | — | `admin/` | C3.2 | Contract + RBAC; `FR-ADMN-03` effective-rate resolver | NOT STARTED |
| `[ ]` | **API-ADM-27** | `PUT /admin/config/commission` — replace commission rules. | — | `admin/` | C3.2 | Contract + audit + reason + affected-entity preview; `FR-ADMN-03`; `SCR-ADM-011` | NOT STARTED |
| `[ ]` | **API-ADM-28** | `GET /admin/config/subscription-tiers` — read subscription tiers. | — | `admin/` · `billing/` | C3.2 | Contract; `REF-06 subscription_tiers` | NOT STARTED |
| `[ ]` | **API-ADM-29** | `PUT /admin/config/subscription-tiers` — replace subscription tiers. | — | `admin/` · `billing/` | C3.2 | Contract + audit + reason; `FR-ADMN-04`; `OQ-03` | NOT STARTED |
| `[ ]` | **API-ADM-30** | `GET /admin/config/tax-profiles` — read tax profiles per country. | — | `admin/` · `billing/` | C3.2 | Contract; `REF-07 tax_profiles` | NOT STARTED |
| `[ ]` | **API-ADM-31** | `PUT /admin/config/tax-profiles` — replace tax profiles. | — | `admin/` · `billing/` | C3.2 | Contract + Integration (issued invoices unaffected); `FR-ADMN-05`; `BR-PAY-11` | NOT STARTED |
| `[ ]` | **API-ADM-32** | `GET /admin/config/kyc-checklists` — read KYC checklists per country. | — | `admin/` · `onboarding/` | C3.2 | Contract; `REF-08 kyc_checklists` | NOT STARTED |
| `[ ]` | **API-ADM-33** | `PUT /admin/config/kyc-checklists` — replace KYC checklists. | — | `admin/` · `onboarding/` | C3.2 | Contract + audit + reason; `FR-ADMN-06`; `OQ-01` | NOT STARTED |
| `[ ]` | **API-ADM-34** | `GET /admin/config/taxonomy` — read amenities, categories, cities, localities and reason codes. | — | `admin/` | C3.2 | Contract; `REF-02` … `REF-05`, `REF-09` | NOT STARTED |
| `[ ]` | **API-ADM-35** | `PUT /admin/config/taxonomy` — replace taxonomy entries. | — | `admin/` | C3.2 | Contract + audit + reason + RBAC (`MODERATOR` / `SUPER_ADMIN`); `FR-ADMN-07`; `NFR-DQ-06` | NOT STARTED |
| `[ ]` | **API-ADM-36** | `GET /admin/config/flags` — read feature flags and their targeting. | — | `admin/` · `common/` | C3.2 | Contract; `REF-10 feature_flags`; §C1.5 | NOT STARTED |
| `[ ]` | **API-ADM-37** | `PUT /admin/config/flags` — set feature flags by tenant, role or percentage. | — | `admin/` · `common/` | C3.2 | Contract + audit + RBAC (`SUPER_ADMIN` only); `FR-ADMN-08`; `NFR-MNT-07` | NOT STARTED |
| `[ ]` | **API-ADM-38** | `GET /admin/config/templates` — read notification templates. | — | `admin/` · `notifications/` | C3.2 | Contract; `REF-11 notification_templates` | NOT STARTED |
| `[ ]` | **API-ADM-39** | `PUT /admin/config/templates` — update notification templates without deployment. | — | `admin/` · `notifications/` | C3.2 | Contract + versioning + preview; `FR-NOTF-03` | NOT STARTED |
| `[ ]` | **API-ADM-40** | `GET /admin/moderation/reviews` — review moderation queue. | — | `admin/` · `reviews/` | C3.2 | Contract + RBAC (`MODERATOR` / `SUPER_ADMIN`); `FR-REV-07` | NOT STARTED |
| `[ ]` | **API-ADM-41** | `POST /admin/moderation/reviews` — publish / unpublish / request-edit / remove-with-reason. | — | `admin/` · `reviews/` | C3.2 | Contract (four actions) + Integration (aggregate recalculates); `AC-REV-02.3`; `SM-06` | NOT STARTED |
| `[ ]` | **API-ADM-42** | `GET /admin/moderation/content` — gym content flags (photos, descriptions). | — | `admin/` · `catalog/` | C3.2 | Contract + RBAC; `FR-ADMN-12`; `BR-GYM-07` | NOT STARTED |
| `[ ]` | **API-ADM-43** | `POST /admin/moderation/content` — act on a gym content flag. | — | `admin/` · `catalog/` | C3.2 | Contract + audit + reason; `FR-ADMN-12` | NOT STARTED |
| `[ ]` | **API-ADM-44** | `GET /admin/moderation/reports` — user-submitted reports queue. | — | `admin/` | C3.2 | Contract + RBAC; `FR-DETL-06`; `FR-ADMN-12` | NOT STARTED |
| `[ ]` | **API-ADM-45** | `POST /admin/moderation/reports` — act on a user-submitted report. | — | `admin/` | C3.2 | Contract + audit + reason; `RSK-01` mitigation | NOT STARTED |
| `[ ]` | **API-ADM-46** | `GET /admin/audit` — audit explorer with filters, diff view and export. | — | `admin/` · `audit/` | C3.2 | Contract + RBAC + negative (no mutation endpoint exists); `FR-ADMN-09`; `AC-ADMN-02.1` … `AC-ADMN-02.3`; `BAC-13` | NOT STARTED |
| `[ ]` | **API-ADM-47** | `GET /admin/analytics/:reportKey` — platform analytics report. | — | `admin/` · `reporting/` | C3.2 | Contract (all 11 platform reports) + Performance; `FR-RPT-01`; `SCR-ADM-014` | NOT STARTED |
| `[ ]` | **API-ADM-48** | `GET` / `POST` / `PATCH` `/admin/staff` — platform staff administration: read, invite, and update role / MFA / sessions. *(Three verbs on one path; each carries its own permission declaration and contract test.)* | — | `admin/` · `iam/` | C3.2 | Contract (three verbs) + RBAC + MFA enforcement; `FR-ADMN-10`; `NFR-SEC-11` | NOT STARTED |

> **Counting note.** `API-ADM-48` covers the PRD's single `GET/POST/PATCH /admin/staff` row. It is
> enumerated here as one row carrying three verbs because the source prints one path with no
> sub-resources; the three verb-level permission declarations and contract tests are named inside the
> row and are individually required before it may be ticked. The group total of 48 counts each verb:
> 45 single-verb rows + this 3-verb row.

### 12.13 `API-NOTF` — Notifications (§C3.2) — 2 endpoints

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **API-NOTF-01** | `GET /me/notifications` — in-app notification centre. | — | `notifications/` | C3.2 | Contract + pagination + Isolation; `FR-NOTF-07` | NOT STARTED |
| `[ ]` | **API-NOTF-02** | `POST /me/notifications/:id/read` — mark a notification read. | — | `notifications/` | C3.2 | Contract + negative (another user's notification); `FR-NOTF-07` | NOT STARTED |

### 12.14 `API-SUP` — Support and help centre (§C3.2) — 7 endpoints

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **API-SUP-01** | `GET /support/tickets` — list own tickets. | — | `support/` | C3.2 | Contract + pagination + Isolation; `FR-SUP-01` | NOT STARTED |
| `[ ]` | **API-SUP-02** | `POST /support/tickets` — create a ticket with category, description and attachments. | — | `support/` | C3.2 | Contract + Security (attachment controls); `FR-SUP-01`; `NFR-SEC-10` | NOT STARTED |
| `[ ]` | **API-SUP-03** | `GET /support/tickets/:id` — ticket detail with linked entities. | — | `support/` | C3.2 | Contract + negative (another user's ticket); `FR-SUP-02` | NOT STARTED |
| `[ ]` | **API-SUP-04** | `GET /support/tickets/:id/messages` — ticket message thread. | — | `support/` | C3.2 | Contract + pagination; `FR-SUP-03` | NOT STARTED |
| `[ ]` | **API-SUP-05** | `POST /support/tickets/:id/messages` — post a message to a ticket. | — | `support/` | C3.2 | Contract; `FR-SUP-04` status transitions | NOT STARTED |
| `[ ]` | **API-SUP-06** | `GET /help/articles` — help-centre article list and search. | — | `support/` | C3.2 | Contract (public); `FR-SUP-06`; `OBJ-10` | NOT STARTED |
| `[ ]` | **API-SUP-07** | `GET /help/articles/:slug` — help-centre article detail. | — | `support/` | C3.2 | Contract (public); `FR-SUP-06` | NOT STARTED |

---

## 13. State Machines — 7 machines, 64 transitions, 3 invariants

**Source:** §C4.1 … §C4.7. Each machine gets a row, each individual transition gets a row, and the
membership machine's three stated invariants get rows of their own. `FR-MEMB-01` requires that
transitions are *"enforced by a state machine rather than ad-hoc updates"* — so a transition row is
ticked only when the legal path is implemented **and** the illegal paths into that state are proven
refused.

### 13.1 `SM-01` — Membership (§C4.1) — 11 transitions + 3 invariants

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **SM-01** | **Membership state machine.** States: `PENDING`, `ACTIVE`, `FROZEN`, `EXPIRED`, `CANCELLED`, `REFUNDED`. Implemented as an explicit machine; every transition writes a `membership_events` row with actor, timestamp, reason and, where financial, the related order or refund. | — | `memberships/` | C4.1 | Unit (full transition matrix incl. illegal paths) + Integration; `BR-MEM-01`; `FR-MEMB-01`, `FR-MEMB-02` | NOT STARTED |
| `[ ]` | ↳ **SMT-01** | — → `PENDING`. Trigger: order paid with a future start date. Guard: payment captured. | — | `memberships/` | C4.1 | Unit + Integration; `AC-CART-01.1`; `BR-MEM-02` | NOT STARTED |
| `[ ]` | ↳ **SMT-02** | — → `ACTIVE`. Trigger: order paid with start date today. Guard: payment captured. | — | `memberships/` | C4.1 | Unit + Integration; `E2E-02`; `BR-PAY-02` | NOT STARTED |
| `[ ]` | ↳ **SMT-03** | `PENDING` → `ACTIVE`. Trigger: scheduled job at 00:00 gym-time on the start date. Guard: not cancelled. | — | `memberships/` | C4.1 | Integration (timezone matrix); `JOB-01 membership.activate-pending`; `AC-CART-01.3` | NOT STARTED |
| `[ ]` | ↳ **SMT-04** | `PENDING` → `CANCELLED`. Trigger: order cancelled or refunded before start. Guard: — | — | `memberships/` | C4.1 | Integration; `SMT-14` (order cancelled) | NOT STARTED |
| `[ ]` | ↳ **SMT-05** | `ACTIVE` → `FROZEN`. Trigger: freeze request. Guards: plan allows; allowance remaining; dates valid. | — | `memberships/` | C4.1 | Unit (three guards, each negative) + E2E; `BR-MEM-05`, `BR-MEM-07`; `AC-MEMB-01.1` | NOT STARTED |
| `[ ]` | ↳ **SMT-06** | `FROZEN` → `ACTIVE`. Trigger: unfreeze, manual or scheduled. Guard: — | — | `memberships/` | C4.1 | Integration; `JOB-03 membership.unfreeze-scheduled`; `AC-MEMB-01.3` | NOT STARTED |
| `[ ]` | ↳ **SMT-07** | `ACTIVE` → `EXPIRED`. Trigger: end date passed, or entitlement exhausted. Guard: expiry job. | — | `memberships/` | C4.1 | Integration (both triggers); `JOB-02 membership.expire`; `BR-PLN-06`; `FR-MEMB-09` | NOT STARTED |
| `[ ]` | ↳ **SMT-08** | `FROZEN` → `EXPIRED`. Trigger: extended end date passed. Guard: expiry job. | — | `memberships/` | C4.1 | Integration; §B5.12 edge case *membership expires during a freeze* | NOT STARTED |
| `[ ]` | ↳ **SMT-09** | `ACTIVE` / `FROZEN` / `PENDING` → `CANCELLED`. Trigger: cancellation without refund. Guard: reason required. | — | `memberships/` | C4.1 | Integration (three source states; negative without reason); `FR-MEMB-02` | NOT STARTED |
| `[ ]` | ↳ **SMT-10** | any → `REFUNDED`. Trigger: refund completed. Guard: refund executed at gateway. | — | `memberships/` · `refunds/` | C4.1 | Integration + E2E; `E2E-07`; `AC-RFND-01.3`; `FR-RFND-06` | NOT STARTED |
| `[ ]` | ↳ **SMT-11** | `EXPIRED` → — *(terminal)*. Renewal creates a **new** membership; a membership is never reactivated. | — | `memberships/` | C4.1 | Integration (negative — no path reactivates an expired membership); `FR-MEMB-06`; `E2E-04` | NOT STARTED |
| `[ ]` | ↳ **SMI-01** | **Invariant:** a membership in `ACTIVE` always has `start_date ≤ today ≤ end_date` in the gym's timezone. | — | `memberships/` | C4.1 | Unit (property test across timezones) + a scheduled data-integrity check; `BR-MEM-03`; `FR-MEMB-09` | NOT STARTED |
| `[ ]` | ↳ **SMI-02** | **Invariant:** a membership never has a `NULL` `end_date`. | — | `memberships/` | C4.1 | Schema `NOT NULL` constraint + Integration; `NFR-DQ-01` | NOT STARTED |
| `[ ]` | ↳ **SMI-03** | **Invariant:** every transition writes a `membership_events` row. | — | `memberships/` | C4.1 | Integration (one assertion per transition, all eleven); `FR-MEMB-02`; `PRIN-07` | NOT STARTED |

### 13.2 `SM-02` — Order (§C4.2) — 10 transitions

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **SM-02** | **Order state machine.** States: `PENDING`, `AWAITING_PAYMENT`, `PAID`, `PARTIALLY_PAID`, `FAILED`, `EXPIRED`, `CANCELLED`, `REFUNDED`. | — | `ordering/` | C4.2 | Unit (full matrix incl. illegal paths) + Integration; `orders.status` enum | NOT STARTED |
| `[ ]` | ↳ **SMT-12** | `[*]` → `PENDING`. Order created, server-priced, 30-minute expiry set. | — | `ordering/` | C4.2 | Contract + Integration; `FR-CART-05`; `BR-PAY-04` | NOT STARTED |
| `[ ]` | ↳ **SMT-13** | `PENDING` → `AWAITING_PAYMENT`. Payment intent created at the gateway. | — | `ordering/` · `payments/` | C4.2 | Integration; `API-PAY-01`; `NFR-PERF-05` | NOT STARTED |
| `[ ]` | ↳ **SMT-14** | `PENDING` → `CANCELLED`. Customer or staff cancels a pending order. | — | `ordering/` | C4.2 | Contract + Integration; `API-ORD-06`; coupon reservation released | NOT STARTED |
| `[ ]` | ↳ **SMT-15** | `PENDING` → `PARTIALLY_PAID` *(offline only)*. Staff records a partial payment against a desk sale. | — | `ordering/` | C4.2 | Integration + negative (marketplace channel refused); `BR-PAY-09`; `AC-CART-02.1`, `AC-CART-02.4` | NOT STARTED |
| `[ ]` | ↳ **SMT-16** | `PARTIALLY_PAID` → `PAID`. Outstanding balance collected; a single consolidated invoice is issued showing both payments. | — | `ordering/` · `billing/` | C4.2 | Integration + E2E; `AC-CART-02.3`; `E2E-10` | NOT STARTED |
| `[ ]` | ↳ **SMT-17** | `AWAITING_PAYMENT` → `PAID`. Verified capture webhook received. | — | `ordering/` · `payments/` | C4.2 | Integration + E2E; `BR-PAY-02`; `E2E-02` | NOT STARTED |
| `[ ]` | ↳ **SMT-18** | `AWAITING_PAYMENT` → `FAILED`. Gateway reports failure. | — | `ordering/` · `payments/` | C4.2 | Integration; `AC-PAY-02.3`; `EVT-22 payment_failed` | NOT STARTED |
| `[ ]` | ↳ **SMT-19** | `FAILED` → `AWAITING_PAYMENT` *(retry)*. A fresh intent is created against the same unexpired order. | — | `ordering/` · `payments/` | C4.2 | Contract + Integration; `FR-PAY-06`; `API-PAY-03` | NOT STARTED |
| `[ ]` | ↳ **SMT-20** | `AWAITING_PAYMENT` → `EXPIRED`. Order expiry elapses; coupon holds are released. | — | `ordering/` | C4.2 | Integration; `JOB-06 order.expire`; §B5.9 edge case *order expires while the payment page is open*; `410 Gone` | NOT STARTED |
| `[ ]` | ↳ **SMT-21** | `PAID` → `REFUNDED`. Refund completed against the order. | — | `ordering/` · `refunds/` | C4.2 | Integration + E2E; `E2E-07`; `BR-REF-09` idempotent on the order | NOT STARTED |

### 13.3 `SM-03` — Payment (§C4.3) — 8 transitions

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **SM-03** | **Payment state machine.** States: `CREATED`, `PENDING`, `AUTHORISED`, `CAPTURED`, `FAILED`, `CANCELLED`, `REFUNDED`, `PARTIALLY_REFUNDED`. | — | `payments/` | C4.3 | Unit (full matrix) + Integration; `payments.status` enum | NOT STARTED |
| `[ ]` | ↳ **SMT-22** | `CREATED` → `PENDING`. Intent submitted to the provider. | — | `payments/` | C4.3 | Integration; `EVT-20 payment_initiated` | NOT STARTED |
| `[ ]` | ↳ **SMT-23** | `PENDING` → `AUTHORISED`. Customer authorises at the gateway. | — | `payments/` | C4.3 | Integration (webhook-driven); `FR-PAY-04` | NOT STARTED |
| `[ ]` | ↳ **SMT-24** | `AUTHORISED` → `CAPTURED`. Funds captured; membership activation is triggered from this event only. | — | `payments/` · `memberships/` | C4.3 | Integration + E2E; `BR-PAY-02`; `E2E-02` | NOT STARTED |
| `[ ]` | ↳ **SMT-25** | `CAPTURED` → `REFUNDED`. Full refund executed at the gateway. | — | `payments/` · `refunds/` | C4.3 | Integration + E2E; `E2E-07`; `FR-RFND-05` | NOT STARTED |
| `[ ]` | ↳ **SMT-26** | `CAPTURED` → `PARTIALLY_REFUNDED`. Partial refund executed at the gateway. | — | `payments/` · `refunds/` | C4.3 | Integration; `FR-RFND-04` pro-rata; `FR-RFND-06` partial adjustment | NOT STARTED |
| `[ ]` | ↳ **SMT-27** | `PENDING` → `FAILED`. Provider reports failure. | — | `payments/` | C4.3 | Integration; `payments.failure_code`/`failure_message`; platform report *Payment health* | NOT STARTED |
| `[ ]` | ↳ **SMT-28** | `AUTHORISED` → `CANCELLED`. Authorisation voided before capture. | — | `payments/` | C4.3 | Integration; `SM-02` order consequence asserted | NOT STARTED |
| `[ ]` | ↳ **SMT-29** | **Reconciliation rule.** Any payment in `PENDING` or `AUTHORISED` beyond the threshold is polled; if the provider reports a terminal state it is applied idempotently; if not, it escalates (`BR-PAY-06`) and never auto-activates a membership. | — | `payments/` | C4.3 | Integration (both branches); `JOB-07 payment.reconcile`; `FR-PAY-05`; §B5.10 edge case *webhook never arrives* | NOT STARTED |

### 13.4 `SM-04` — Tenant / application (§C4.4) — 11 transitions

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **SM-04** | **Tenant / application state machine.** States: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `INFO_REQUESTED`, `APPROVED`, `REJECTED`, `SUSPENDED`, `CLOSED`. | — | `onboarding/` · `tenancy/` | C4.4 | Unit (full matrix) + E2E; `tenants.status` enum; `FR-ONB-09` | NOT STARTED |
| `[ ]` | ↳ **SMT-30** | `DRAFT` → `SUBMITTED`. Owner submits; the submitted version is locked as a reviewer snapshot. | — | `onboarding/` | C4.4 | Integration + E2E; `FR-ONB-08`; `E2E-01` | NOT STARTED |
| `[ ]` | ↳ **SMT-31** | `SUBMITTED` → `UNDER_REVIEW`. A reviewer picks the application up. | — | `onboarding/` · `admin/` | C4.4 | Integration; `SCR-ADM-002` | NOT STARTED |
| `[ ]` | ↳ **SMT-32** | *(assign)* — an application is assigned or reassigned to a named reviewer, with SLA and workload tracking. | — | `admin/` | C4.4 | Integration; `FR-ADMN-11`; `API-ADM-06` | NOT STARTED |
| `[ ]` | ↳ **SMT-33** | `UNDER_REVIEW` → `APPROVED`. Human decision only; a failed pre-check requires an explicit override with a reason. | — | `onboarding/` · `admin/` | C4.4 | Integration (negative — no automated path); `BR-GYM-03`; `AC-ONB-02.5`; `BAC-02` | NOT STARTED |
| `[ ]` | ↳ **SMT-34** | `UNDER_REVIEW` → `REJECTED`. Requires ≥1 structured reason code plus optional free text. | — | `onboarding/` · `admin/` | C4.4 | Integration (negative without a code); `BR-GYM-04`; `RCT-02` | NOT STARTED |
| `[ ]` | ↳ **SMT-35** | `UNDER_REVIEW` → `INFO_REQUESTED`. Targeted checklist returned without rejecting, preserving the owner's progress. | — | `onboarding/` · `admin/` | C4.4 | Integration + E2E; `FR-ONB-10`; `UAT-04` | NOT STARTED |
| `[ ]` | ↳ **SMT-36** | `REJECTED` → `DRAFT` *(resubmit)*. Unlimited resubmissions; each is a new reviewable version with the prior retained. | — | `onboarding/` | C4.4 | Integration; `BR-GYM-05`; `AC-ONB-01.3` | NOT STARTED |
| `[ ]` | ↳ **SMT-37** | `INFO_REQUESTED` → `SUBMITTED`. Owner supplies the requested information and returns to the queue. | — | `onboarding/` | C4.4 | Integration + E2E; `UAT-04` | NOT STARTED |
| `[ ]` | ↳ **SMT-38** | `APPROVED` → `SUSPENDED`. Platform suspension with a reason; removed from search immediately, existing memberships still permit check-in. | — | `tenancy/` · `admin/` | C4.4 | Integration + E2E; `BR-TEN-05`; `API-ADM-11`; `UAT-06` | NOT STARTED |
| `[ ]` | ↳ **SMT-39** | `SUSPENDED` → `APPROVED`. Reinstatement; marketplace visibility restored. | — | `tenancy/` · `admin/` | C4.4 | Integration; `API-ADM-12`; `FR-ADMN-01` | NOT STARTED |
| `[ ]` | ↳ **SMT-40** | `APPROVED` → `CLOSED`. Tenant closure; a soft delete that retains financial, invoice and audit records for the statutory period. | — | `tenancy/` | C4.4 | Integration; `BR-TEN-04`; `NFR-PRV-04`; `CON-04` | NOT STARTED |

### 13.5 `SM-05` — Refund (§C4.5) — 8 transitions

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **SM-05** | **Refund state machine.** States: `REQUESTED`, `AUTO_APPROVED`, `PENDING_APPROVAL`, `REJECTED`, `PROCESSING`, `COMPLETED`, `FAILED`. | — | `refunds/` | C4.5 | Unit (full matrix) + E2E; `refunds.status`; `FR-RFND-03` | NOT STARTED |
| `[ ]` | ↳ **SMT-41** | `REQUESTED` → `AUTO_APPROVED`. Within the stated no-questions window, usage below threshold and value below threshold. | — | `refunds/` | C4.5 | Unit (three thresholds) + E2E; `BR-REF-03`; `AC-RFND-01.1`; `E2E-07` | NOT STARTED |
| `[ ]` | ↳ **SMT-42** | `REQUESTED` → `PENDING_APPROVAL`. Outside policy, above the value threshold, or above the usage threshold. | — | `refunds/` | C4.5 | Integration; `BR-REF-03`, `BR-REF-06`; `AC-RFND-01.2` | NOT STARTED |
| `[ ]` | ↳ **SMT-43** | `REQUESTED` → `FAILED`. The request cannot be evaluated or executed at intake. | — | `refunds/` | C4.5 | Integration (fault injection); `NFR-USE-05` | NOT STARTED |
| `[ ]` | ↳ **SMT-44** | `AUTO_APPROVED` → `PROCESSING`. Gateway refund initiated to the original instrument. | — | `refunds/` · `payments/` | C4.5 | Integration; `BR-REF-04`; `FR-RFND-05` | NOT STARTED |
| `[ ]` | ↳ **SMT-45** | `PENDING_APPROVAL` → `PROCESSING`. Super Admin approves; gateway refund initiated. | — | `refunds/` · `admin/` | C4.5 | Integration + RBAC; `API-ADM-22`; `BR-REF-03` | NOT STARTED |
| `[ ]` | ↳ **SMT-46** | `PENDING_APPROVAL` → `REJECTED`. Super Admin rejects with a reason; the requester is informed. | — | `refunds/` · `admin/` | C4.5 | Integration (negative without a reason); `RCT-03`; `SCR-ADM-008` | NOT STARTED |
| `[ ]` | ↳ **SMT-47** | `PROCESSING` → `COMPLETED`. Gateway confirms; credit note issued, ledger reversal written, membership adjusted, QR revoked on full refund. | — | `refunds/` · `billing/` · `ledger/` · `memberships/` | C4.5 | Integration + E2E; `E2E-07`; `FR-RFND-06`, `FR-RFND-07`; `AC-RFND-01.3` | NOT STARTED |
| `[ ]` | ↳ **SMT-48** | `FAILED` → `PROCESSING` *(retry)*. A failed refund is retriable and is never shown as completed before the gateway confirms. | — | `refunds/` | C4.5 | Integration; `SCR-DASH-015-X` | NOT STARTED |

### 13.6 `SM-06` — Review (§C4.6) — 8 transitions

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **SM-06** | **Review state machine.** States: `SUBMITTED`, `PENDING`, `PUBLISHED`, `HELD`, `UNPUBLISHED`, `REMOVED`. | — | `reviews/` | C4.6 | Unit (full matrix) + E2E; `reviews.status`; `E2E-09` | NOT STARTED |
| `[ ]` | ↳ **SMT-49** | `SUBMITTED` → *[screening]*. Automated screening runs for profanity, contact details, URLs, competitor solicitation and spam patterns. | — | `reviews/` | C4.6 | Unit (one case per signal — five); `FR-REV-03`; `BR-REV-04` | NOT STARTED |
| `[ ]` | ↳ **SMT-50** | *[screening]* → `PUBLISHED`. Screening passes; the review publishes with a "Verified member" marker and the aggregate recomputes. | — | `reviews/` | C4.6 | Integration; `BR-REV-03`; `JOB-12 review.aggregate` | NOT STARTED |
| `[ ]` | ↳ **SMT-51** | *[screening]* → `HELD`. Screening flags the review; it queues for human moderation rather than being rejected outright. | — | `reviews/` | C4.6 | Integration; `FR-REV-03`; `SCR-ADM-012` | NOT STARTED |
| `[ ]` | ↳ **SMT-52** | `PUBLISHED` → `UNPUBLISHED`. Moderator action; the aggregate recalculates without it within one minute. | — | `reviews/` · `admin/` | C4.6 | Integration (timed) + E2E; `AC-REV-02.3`; `FR-REV-07` | NOT STARTED |
| `[ ]` | ↳ **SMT-53** | `UNPUBLISHED` → `PUBLISHED`. Moderator restores; the aggregate recalculates with it. | — | `reviews/` · `admin/` | C4.6 | Integration; `FR-REV-07`; `FR-REV-08` | NOT STARTED |
| `[ ]` | ↳ **SMT-54** | `PUBLISHED` → `REMOVED` *(terminal)*. Permanent removal with a reason; the action is retained in audit. | — | `reviews/` · `admin/` · `audit/` | C4.6 | Integration (negative — no path back from `REMOVED`); `RCT-04`; `BR-DAT-01` | NOT STARTED |
| `[ ]` | ↳ **SMT-55** | `HELD` → `PUBLISHED`. Moderator clears the hold; the review enters the aggregate. | — | `reviews/` · `admin/` | C4.6 | Integration; `AC-REV-02.2`; `FR-REV-09` | NOT STARTED |
| `[ ]` | ↳ **SMT-56** | `HELD` → `REMOVED`. Moderator removes a held review with a reason. | — | `reviews/` · `admin/` | C4.6 | Integration; `RCT-04`; `FR-REV-07` | NOT STARTED |

### 13.7 `SM-07` — Settlement batch (§C4.7) — 8 transitions

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **SM-07** | **Settlement batch state machine.** States: `OPEN`, `CLOSED`, `PENDING_APPROVAL`, `APPROVED`, `PROCESSING`, `PAID`, `FAILED`, `ON_HOLD`. | — | `settlements/` | C4.7 | Unit (full matrix) + E2E; `settlement_batches.status`; `FR-SETL-07` | NOT STARTED |
| `[ ]` | ↳ **SMT-57** | `OPEN` → `CLOSED`. The cycle ends; every eligible transaction since the last batch is included, and unreported gateway fees hold their lines out rather than being estimated. | — | `settlements/` | C4.7 | Integration; `JOB-09 settlement.build-batches`; `BR-FIN-06` | NOT STARTED |
| `[ ]` | ↳ **SMT-58** | `CLOSED` → `PENDING_APPROVAL`. The batch is presented for Finance approval with all eight figures per line. | — | `settlements/` | C4.7 | Integration; `BR-FIN-02`; `AC-SETL-01.1` | NOT STARTED |
| `[ ]` | ↳ **SMT-59** | `CLOSED` → `ON_HOLD`. A reconciliation variance or an operational hold blocks the batch. | — | `settlements/` | C4.7 | Integration; `BR-FIN-07`; `FR-SETL-09`; `SCR-ADM-010` | NOT STARTED |
| `[ ]` | ↳ **SMT-60** | `PENDING_APPROVAL` → `APPROVED`. Finance approves, with dual control above the configured threshold. | — | `settlements/` · `admin/` | C4.7 | Integration + RBAC (dual control); `BR-FIN-08`; `FR-SETL-06`; `API-ADM-20` | NOT STARTED |
| `[ ]` | ↳ **SMT-61** | `APPROVED` → `PROCESSING`. Payout instruction issued to the provider. | — | `settlements/` · `payments/` | C4.7 | Integration; `FR-PAY-10` | NOT STARTED |
| `[ ]` | ↳ **SMT-62** | `PROCESSING` → `PAID`. Payout confirmed; an itemised statement is issued to the tenant. | — | `settlements/` | C4.7 | Integration + E2E; `E2E-12`; `AC-SETL-01.1`; §A6.4 *Statement* | NOT STARTED |
| `[ ]` | ↳ **SMT-63** | `APPROVED` → `FAILED`. Bank rejection or provider failure. | — | `settlements/` | C4.7 | Integration; `FR-SETL-08` | NOT STARTED |
| `[ ]` | ↳ **SMT-64** | `FAILED` → `PENDING_APPROVAL`. The batch returns for approval with the failure reason; the tenant and Finance are both notified. | — | `settlements/` · `notifications/` | C4.7 | Integration; `FR-SETL-08`; notification catalogue *Payout initiated + statement* | NOT STARTED |

---

## 14. Reason-Code Taxonomies — 5 taxonomies, 57 codes

**Source:** §C4.8. Reason codes are platform reference data (`REF-09 reason_codes`, typed: rejection,
denial, refund, moderation, override) and are managed through `FR-ADMN-07`. A taxonomy row is ticked
when the full code set is seeded, enumerable through the API, and enforced — free text is never
accepted in place of a code. A code row is ticked when the code exists, is emitted by the path that
should emit it, and is rendered in language appropriate to its audience (`NFR-USE-05`).

### 14.1 `RCT-01` — Check-in denial — 15 codes

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **RCT-01** | **Check-in denial taxonomy** — a fixed set of 15 codes. Every denial is recorded with its code (`BR-CHK-10`) and returned as `200` with full context, never as a `4xx` (§C3.3). | — | `attendance/` · `admin/` | C4.8 | Contract + Integration (all 15 emitted); `FR-CHK-06`; `FR-ADMN-07` | NOT STARTED |
| `[ ]` | ↳ **RC-01** | `MEMBERSHIP_EXPIRED` — the membership's end date has passed. | — | `attendance/` | C4.8 | Integration; `AC-CHK-01.2`; `E2E-04`; `BR-CHK-01` | NOT STARTED |
| `[ ]` | ↳ **RC-02** | `MEMBERSHIP_FROZEN` — the membership is in `FROZEN`. | — | `attendance/` | C4.8 | Integration; `AC-MEMB-01.2`; `BR-MEM-06`; `E2E-05` | NOT STARTED |
| `[ ]` | ↳ **RC-03** | `MEMBERSHIP_PENDING_START` — the membership is in `PENDING` with a future start date. | — | `attendance/` | C4.8 | Integration; `AC-CART-01.2` | NOT STARTED |
| `[ ]` | ↳ **RC-04** | `MEMBERSHIP_CANCELLED` — the membership is in `CANCELLED`. | — | `attendance/` | C4.8 | Integration; `SMT-09` | NOT STARTED |
| `[ ]` | ↳ **RC-05** | `MEMBERSHIP_REFUNDED` — the membership is in `REFUNDED`; QR access revoked. | — | `attendance/` | C4.8 | Integration; `AC-RFND-01.3`; `FR-RFND-06` | NOT STARTED |
| `[ ]` | ↳ **RC-06** | `WRONG_BRANCH` — the plan does not grant access at the scanning branch. | — | `attendance/` | C4.8 | Integration; `AC-GYM-01.3`; `BR-CHK-03` | NOT STARTED |
| `[ ]` | ↳ **RC-07** | `OUTSIDE_OPERATING_HOURS` — the branch is closed at the scan time and the plan does not grant 24-hour access. | — | `attendance/` | C4.8 | Integration; `BR-CHK-05`; `branch_hours` | NOT STARTED |
| `[ ]` | ↳ **RC-08** | `OUTSIDE_PLAN_ACCESS_WINDOW` — the scan falls outside the plan's permitted entry window. | — | `attendance/` · `plans/` | C4.8 | Integration; `FR-PLAN-02`; `plans.access_window` | NOT STARTED |
| `[ ]` | ↳ **RC-09** | `GYM_CLOSED_EXCEPTION` — a declared closure exception covers the scan date; the denial cites the closure, not generic hours. | — | `attendance/` · `catalog/` | C4.8 | Integration; `AC-GYM-02.2`; `branch_hour_exceptions` | NOT STARTED |
| `[ ]` | ↳ **RC-10** | `NO_SESSIONS_REMAINING` — a session-based plan has exhausted its entitlement; a top-up path is offered. | — | `attendance/` | C4.8 | Integration; `BR-PLN-06`; §B5.13 edge case *zero entitlement mid-visit* | NOT STARTED |
| `[ ]` | ↳ **RC-11** | `DUPLICATE_WITHIN_COOLDOWN` — a repeat scan inside the configurable cooldown; recorded as a duplicate and entitlement is not decremented. | — | `attendance/` | C4.8 | Integration; `BR-CHK-04`; `OQ-08` default 60 minutes | NOT STARTED |
| `[ ]` | ↳ **RC-12** | `TOKEN_EXPIRED` — the token is past its 60-second TTL, evaluated against **server** time. | — | `attendance/` | C4.8 | Integration; `AC-CHK-01.3`; §B5.13 edge case *clock skew* | NOT STARTED |
| `[ ]` | ↳ **RC-13** | `TOKEN_INVALID` — signature verification fails or the payload is malformed. | — | `attendance/` | C4.8 | Integration + Security; `FR-CHK-04` step 1; signing algorithm pending `A-11` | NOT STARTED |
| `[ ]` | ↳ **RC-14** | `MEMBERSHIP_UNDER_REVIEW` — the membership is suspended pending a credential-sharing review. | — | `attendance/` | C4.8 | Integration; `BR-MEM-13`; `BR-CHK-07`; `JOB-17 attendance.sharing-scan` | NOT STARTED |
| `[ ]` | ↳ **RC-15** | `TENANT_SUSPENDED` — the tenant is suspended. *(Note: `BR-TEN-05` keeps existing active memberships checking in until natural expiry, so this code applies where the tenant-level block is the operative reason.)* | — | `attendance/` · `tenancy/` | C4.8 | Integration; `BR-TEN-05` boundary asserted explicitly | NOT STARTED |

### 14.2 `RCT-02` — Application rejection — 16 codes

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **RCT-02** | **Application rejection taxonomy** — a fixed set of 16 codes. Rejection requires ≥1 code plus optional free text; the owner sees both, and each cited reason names the specific field or document and the corrective action. | — | `onboarding/` · `admin/` | C4.8 | Contract (negative without a code) + E2E; `BR-GYM-04`; `AC-ONB-01.2`; `UAT-04` | NOT STARTED |
| `[ ]` | ↳ **RC-16** | `KYC_DOCUMENT_MISSING` — a document required by the country checklist was not supplied. | — | `onboarding/` | C4.8 | Integration; `FR-ONB-03`; `FR-ADMN-06` | NOT STARTED |
| `[ ]` | ↳ **RC-17** | `KYC_DOCUMENT_ILLEGIBLE` — a supplied document cannot be read. *(Preferred handling is "request information" rather than rejection — §B5.3 edge case.)* | — | `onboarding/` | C4.8 | Integration; `FR-ONB-10` | NOT STARTED |
| `[ ]` | ↳ **RC-18** | `KYC_DOCUMENT_EXPIRED` — a supplied document is past its validity. | — | `onboarding/` | C4.8 | Integration; `kyc_documents.valid_until`; §B5.3 edge case *document past validity flagged for re-upload* | NOT STARTED |
| `[ ]` | ↳ **RC-19** | `KYC_NAME_MISMATCH` — the document name does not match the declared legal entity. | — | `onboarding/` | C4.8 | Integration; `FR-ONB-02` | NOT STARTED |
| `[ ]` | ↳ **RC-20** | `ADDRESS_UNVERIFIABLE` — the registered address cannot be verified. | — | `onboarding/` | C4.8 | Integration; `FR-ONB-12` | NOT STARTED |
| `[ ]` | ↳ **RC-21** | `GEO_ADDRESS_MISMATCH` — the map pin is beyond the configured tolerance from the geocoded postal address. | — | `onboarding/` | C4.8 | Integration; `BR-GYM-08`; `AC-ONB-02.3` | NOT STARTED |
| `[ ]` | ↳ **RC-22** | `DUPLICATE_LISTING` — another `APPROVED` gym already occupies the address. | — | `onboarding/` | C4.8 | Integration; `BR-GYM-09`; `AC-ONB-02.4` | NOT STARTED |
| `[ ]` | ↳ **RC-23** | `INSUFFICIENT_PHOTOS` — fewer than the required minimum of three photographs. | — | `onboarding/` | C4.8 | Integration (boundary at 2 and 3); `BR-GYM-02`; `FR-ONB-04` | NOT STARTED |
| `[ ]` | ↳ **RC-24** | `PHOTO_QUALITY` — supplied photographs fail the image-quality pre-check. | — | `onboarding/` | C4.8 | Integration; `FR-ONB-12` | NOT STARTED |
| `[ ]` | ↳ **RC-25** | `PHOTO_NOT_OF_PREMISES` — supplied photographs do not depict the declared premises. | — | `onboarding/` | C4.8 | Integration; `RSK-01` mitigation | NOT STARTED |
| `[ ]` | ↳ **RC-26** | `INCOMPLETE_PROFILE` — required gym profile fields are missing. | — | `onboarding/` | C4.8 | Integration; `BR-GYM-02`; `FR-ONB-04` | NOT STARTED |
| `[ ]` | ↳ **RC-27** | `NO_PUBLISHED_PLAN` — no plan has been created and published. | — | `onboarding/` · `plans/` | C4.8 | Integration; `FR-ONB-05`; `BR-GYM-02` | NOT STARTED |
| `[ ]` | ↳ **RC-28** | `BANK_VERIFICATION_FAILED` — account-name verification through the gateway failed. | — | `onboarding/` · `settlements/` | C4.8 | Integration; `FR-ONB-06` | NOT STARTED |
| `[ ]` | ↳ **RC-29** | `PROHIBITED_CONTENT` — free text or media failed content screening. | — | `onboarding/` | C4.8 | Integration; `FR-ONB-12` profanity screening | NOT STARTED |
| `[ ]` | ↳ **RC-30** | `SUSPECTED_FRAUD` — the application shows fraud indicators. | — | `onboarding/` | C4.8 | Integration; `RSK-01` mitigation | NOT STARTED |
| `[ ]` | ↳ **RC-31** | `OTHER` — any reason not covered above; free text is mandatory when this code is used. | — | `onboarding/` | C4.8 | Integration (negative — `OTHER` without free text refused); `BR-GYM-04` | NOT STARTED |

### 14.3 `RCT-03` — Refund reason — 10 codes

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **RCT-03** | **Refund reason taxonomy** — a fixed set of 10 codes stored on `refunds.reason_code`. A refund on a membership with recorded check-ins requires a stated reason (`BR-REF-06`). | — | `refunds/` · `admin/` | C4.8 | Contract + Integration (all 10); `FR-ADMN-07`; `SCR-ADM-008` | NOT STARTED |
| `[ ]` | ↳ **RC-32** | `WITHIN_COOLING_OFF` — inside the tenant's stated no-questions window. | — | `refunds/` | C4.8 | Integration; `BR-REF-03`; `AC-RFND-01.1`; `OQ-05` | NOT STARTED |
| `[ ]` | ↳ **RC-33** | `SERVICE_NOT_AS_DESCRIBED` — the gym materially differs from its listing. | — | `refunds/` | C4.8 | Integration; `BR-REF-07` | NOT STARTED |
| `[ ]` | ↳ **RC-34** | `GYM_CLOSED` — the gym closed or was suspended for cause. | — | `refunds/` | C4.8 | Integration; `BR-REF-07`; `BR-MEM-14`; `RSK-06` | NOT STARTED |
| `[ ]` | ↳ **RC-35** | `MEDICAL` — a medical reason prevents use of the membership. | — | `refunds/` | C4.8 | Integration; `NFR-PRV-07` (health data handling) | NOT STARTED |
| `[ ]` | ↳ **RC-36** | `RELOCATION` — the member has moved away from the branch. | — | `refunds/` | C4.8 | Integration | NOT STARTED |
| `[ ]` | ↳ **RC-37** | `DUPLICATE_PAYMENT` — an automatically-detected duplicate capture. | — | `refunds/` · `payments/` | C4.8 | Integration + E2E; `BR-PAY-07`; `E2E-08`; `JOB-08` | NOT STARTED |
| `[ ]` | ↳ **RC-38** | `PRICING_ERROR` — the charged amount was wrong. | — | `refunds/` | C4.8 | Integration; `BR-PLN-03`; §B5.10 edge case *amount mismatch* | NOT STARTED |
| `[ ]` | ↳ **RC-39** | `GOODWILL` — a discretionary refund outside policy. | — | `refunds/` | C4.8 | Integration + RBAC (`SUPER_ADMIN` approval); `BR-REF-03` | NOT STARTED |
| `[ ]` | ↳ **RC-40** | `FRAUD` — the transaction is fraudulent. | — | `refunds/` | C4.8 | Integration; `RSK-05` mitigation | NOT STARTED |
| `[ ]` | ↳ **RC-41** | `OTHER` — any reason not covered above; free text is mandatory when this code is used. | — | `refunds/` | C4.8 | Integration (negative — `OTHER` without free text refused) | NOT STARTED |

### 14.4 `RCT-04` — Moderation — 9 codes

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **RCT-04** | **Moderation taxonomy** — a fixed set of 9 codes used on review reports and moderation decisions. Two of these codes (`PERSONAL_INFORMATION`, `THREAT`) trigger immediate hiding pending review under `BR-REV-06`; the rest leave the review published while under moderation. | — | `reviews/` · `admin/` | C4.8 | Contract + Integration (all 9, and the two immediate-removal cases specifically); `BR-REV-06`; `FR-REV-06`, `FR-REV-07` | NOT STARTED |
| `[ ]` | ↳ **RC-42** | `ABUSIVE_LANGUAGE` — abusive or offensive content. | — | `reviews/` | C4.8 | Integration; `FR-REV-03` profanity screening | NOT STARTED |
| `[ ]` | ↳ **RC-43** | `PERSONAL_INFORMATION` — personal data in the review. **Hidden immediately pending review** per `BR-REV-06`. | — | `reviews/` | C4.8 | Integration (immediate hide asserted); `BR-REV-06`; `BR-DAT-06` | NOT STARTED |
| `[ ]` | ↳ **RC-44** | `SPAM` — spam patterns. | — | `reviews/` | C4.8 | Integration; `FR-REV-03` | NOT STARTED |
| `[ ]` | ↳ **RC-45** | `IRRELEVANT` — content unrelated to the gym. | — | `reviews/` | C4.8 | Integration | NOT STARTED |
| `[ ]` | ↳ **RC-46** | `CONFLICT_OF_INTEREST` — the reviewer has an undisclosed interest. | — | `reviews/` | C4.8 | Integration; `FR-REV-09` anomaly signals | NOT STARTED |
| `[ ]` | ↳ **RC-47** | `SUSPECTED_FAKE` — the review is suspected inauthentic. | — | `reviews/` | C4.8 | Integration; `AC-REV-02.2`; `RSK-02`; `JOB-13` | NOT STARTED |
| `[ ]` | ↳ **RC-48** | `PROMOTIONAL` — promotional content or competitor solicitation. | — | `reviews/` | C4.8 | Integration; `FR-REV-03` | NOT STARTED |
| `[ ]` | ↳ **RC-49** | `THREAT` — threatening content. **Hidden immediately pending review** per `BR-REV-06`. | — | `reviews/` | C4.8 | Integration (immediate hide asserted); `BR-REV-06` | NOT STARTED |
| `[ ]` | ↳ **RC-50** | `OTHER` — any reason not covered above; free text is mandatory when this code is used. | — | `reviews/` | C4.8 | Integration (negative — `OTHER` without free text refused) | NOT STARTED |

### 14.5 `RCT-05` — Check-in override — 7 codes

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **RCT-05** | **Check-in override taxonomy** — a fixed set of 7 codes. Staff override of a denial requires selecting a code from this fixed list, is fully audited, and is reportable. The `OQ-09` default is that all denials are overridable with a reason and overrides are reported weekly to the owner. | — | `attendance/` · `audit/` | C4.8 | Contract (negative — free text alone refused) + Integration (all 7); `FR-CHK-08`; `OQ-09` | NOT STARTED |
| `[ ]` | ↳ **RC-51** | `MEMBER_PHONE_UNAVAILABLE` — the member cannot present a QR (no device, no battery). | — | `attendance/` | C4.8 | Integration; §B5.13 edge case *no battery*; `FR-CHK-07` | NOT STARTED |
| `[ ]` | ↳ **RC-52** | `TECHNICAL_ISSUE` — a scanner, network or platform problem prevented normal check-in. | — | `attendance/` | C4.8 | Integration; `SCR-DASH-009-X` | NOT STARTED |
| `[ ]` | ↳ **RC-53** | `GRACE_PERIOD_GRANTED` — staff grant entry despite expiry or another denial. | — | `attendance/` | C4.8 | Integration; `RC-01`; `E2E-04` | NOT STARTED |
| `[ ]` | ↳ **RC-54** | `PAYMENT_PENDING_CONFIRMED` — payment is confirmed out of band but not yet reflected. | — | `attendance/` · `payments/` | C4.8 | Integration; `BR-PAY-06` escalation path asserted separately | NOT STARTED |
| `[ ]` | ↳ **RC-55** | `TRIAL_VISIT` — a trial or day-pass visit granted at the desk. | — | `attendance/` | C4.8 | Integration; `OQ-14` (trial as a session-type plan with a session count of 1) | NOT STARTED |
| `[ ]` | ↳ **RC-56** | `MANAGEMENT_APPROVAL` — a manager authorised the entry. | — | `attendance/` · `staff/` | C4.8 | Integration + RBAC; `FR-STAF-05` override attribution | NOT STARTED |
| `[ ]` | ↳ **RC-57** | `OTHER` — any reason not covered above; free text is mandatory when this code is used. | — | `attendance/` | C4.8 | Integration (negative — `OTHER` without free text refused) | NOT STARTED |

---

## 15. Background Jobs — `JOB-01` … `JOB-24`

**Source:** §C5. The section closes with a rule that applies to **every** job, and every job row below
is ticked only when all five parts of it hold: *"Every job: runs with a **distributed lock** to prevent
double execution, records start/end/outcome, emits metrics, and alerts on failure or on exceeding its
expected duration."* Every job in the source is additionally declared idempotent, and that is a
test, not a comment. Jobs run on the separate worker tier that cannot starve request handling
(`NFR-SCAL-05`), on Redis 7 + BullMQ (§C1.1).

| `[ ]` | ID | Requirement (job · schedule · purpose · idempotent) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **JOB-01** | `membership.activate-pending` — **hourly, per gym timezone.** `PENDING` → `ACTIVE` on the start date. **Idempotent: yes.** | — | `memberships/` | C5 | Integration (timezone matrix + double-run); `SMT-03`; `AC-CART-01.1`, `AC-CART-01.3` | NOT STARTED |
| `[ ]` | **JOB-02** | `membership.expire` — **hourly, per gym timezone.** `ACTIVE` / `FROZEN` → `EXPIRED`. **Idempotent: yes.** | — | `memberships/` | C5 | Integration (both source states + double-run); `SMT-07`, `SMT-08`; `FR-MEMB-09`; `SMI-01` | NOT STARTED |
| `[ ]` | **JOB-03** | `membership.unfreeze-scheduled` — **hourly.** End scheduled freezes. **Idempotent: yes.** | — | `memberships/` | C5 | Integration (double-run); `SMT-06`; `FR-MEMB-05` | NOT STARTED |
| `[ ]` | **JOB-04** | `membership.renewal-reminders` — **daily 09:00 gym-time.** T−15 / −7 / −3 / −1 and expiry notices. **Idempotent: yes.** | — | `memberships/` · `notifications/` | C5 | Integration (four offsets + expiry, double-run sends once); `BR-MEM-11`; `AC-USER-01.2` | NOT STARTED |
| `[ ]` | **JOB-05** | `membership.auto-renew` — **daily.** Charge mandates due today. **Idempotent: yes (idempotency key per period).** | — | `memberships/` · `payments/` | C5 | Integration (double-run charges once); `BR-MEM-10`; `FR-PAY-11`; `FR-MEMB-08` | NOT STARTED |
| `[ ]` | **JOB-06** | `order.expire` — **every 5 min.** Expire stale `PENDING` orders, release coupon holds. **Idempotent: yes.** | — | `ordering/` | C5 | Integration; `SMT-20`; `FR-CART-05`; coupon reservation release asserted | NOT STARTED |
| `[ ]` | **JOB-07** | `payment.reconcile` — **every 15 min.** Poll indeterminate payments. **Idempotent: yes.** | — | `payments/` | C5 | Integration (terminal and still-indeterminate branches); `SMT-29`; `BR-PAY-06`; `FR-PAY-05` | NOT STARTED |
| `[ ]` | **JOB-08** | `payment.duplicate-detect` — **every 15 min.** Detect and auto-refund duplicates. **Idempotent: yes.** | — | `payments/` · `refunds/` | C5 | Integration + E2E; `E2E-08`; `BR-PAY-07`; `AC-PAY-01.2` (within one hour) | NOT STARTED |
| `[ ]` | **JOB-09** | `settlement.build-batches` — **daily 02:00.** Assemble batches for tenants due. **Idempotent: yes.** | — | `settlements/` | C5 | Integration + E2E; `E2E-12`; `SMT-57`; `FR-SETL-01`; `BR-FIN-06` | NOT STARTED |
| `[ ]` | **JOB-10** | `settlement.reconcile` — **daily 04:00.** Gateway report vs ledger. **Idempotent: yes.** | — | `settlements/` · `ledger/` | C5 | Integration + E2E; `BR-FIN-07`; `FR-SETL-09`; `KPI-26`; `BAC-07` | NOT STARTED |
| `[ ]` | **JOB-11** | `reserve.release` — **daily.** Release matured reserve. **Idempotent: yes.** | — | `settlements/` · `ledger/` | C5 | Integration; ledger `RESERVE_RELEASE`; `FR-SETL-04`; `AC-SETL-01.3`; `OQ-04` | NOT STARTED |
| `[ ]` | **JOB-12** | `review.aggregate` — **on change + nightly rebuild.** Recompute gym rating. **Idempotent: yes.** | — | `reviews/` | C5 | Integration (both triggers, timed); `AC-REV-02.3` (within one minute); `FR-REV-08` | NOT STARTED |
| `[ ]` | **JOB-13** | `review.anomaly-scan` — **hourly.** Rating velocity and clustering. **Idempotent: yes.** | — | `reviews/` | C5 | Integration; `FR-REV-09`; `AC-REV-02.2`; `RSK-02` | NOT STARTED |
| `[ ]` | **JOB-14** | `gym.freshness-score` — **nightly.** Recompute listing freshness. **Idempotent: yes.** | — | `catalog/` · `discovery/` | C5 | Integration; `FR-GYM-12`; `gyms.freshness_score`; `RSK-11` | NOT STARTED |
| `[ ]` | **JOB-15** | `search.reindex` — **on change + nightly.** Keep search data current. **Idempotent: yes.** | — | `discovery/` | C5 | Integration (both triggers); `NFR-AVL-03` (index loss must not block check-in or payment) | NOT STARTED |
| `[ ]` | **JOB-16** | `attendance.auto-checkout` — **hourly.** Close open visits past the threshold. **Idempotent: yes.** | — | `attendance/` | C5 | Integration; `FR-CHK-09`; `attendance.duration_minutes` | NOT STARTED |
| `[ ]` | **JOB-17** | `attendance.sharing-scan` — **hourly.** Implausible-travel detection. **Idempotent: yes.** | — | `attendance/` | C5 | Integration; `BR-CHK-07`; `BR-MEM-13`; `FR-CHK-12`; `RSK-03` | NOT STARTED |
| `[ ]` | **JOB-18** | `crm.risk-flags` — **nightly.** Recompute at-risk members. **Idempotent: yes.** | — | `crm/` | C5 | Integration; `FR-CRM-06`; `AC-CRM-01.1`, `AC-CRM-01.3` | NOT STARTED |
| `[ ]` | **JOB-19** | `notification.dispatch` — **continuous.** Drain the outbox and delivery queue. **Idempotent: yes.** | — | `notifications/` | C5 | Integration (outbox semantics: never sent for a rolled-back transaction, never lost for a committed one); §C1.5 *Events*; `FR-NOTF-04` | NOT STARTED |
| `[ ]` | **JOB-20** | `report.scheduled-delivery` — **per configuration.** Email scheduled reports. **Idempotent: yes.** | — | `reporting/` · `notifications/` | C5 | Integration (daily/weekly/monthly); `FR-RPT-04` | NOT STARTED |
| `[ ]` | **JOB-21** | `export.generate` — **on demand.** Async large exports. **Idempotent: yes.** | — | `reporting/` | C5 | Integration (`202 Accepted` + time-limited link); `FR-RPT-03`; `BAC-12`; `NFR-PERF-06` | NOT STARTED |
| `[ ]` | **JOB-22** | `subscription.charge` — **daily.** Charge tenant subscriptions, apply `PAST_DUE` transitions. **Idempotent: yes.** | — | `billing/` · `tenancy/` | C5 | Integration (first failure → `PAST_DUE`, 7-day visibility loss, 14-day write loss, check-in never blocked); `BR-TEN-06` | NOT STARTED |
| `[ ]` | **JOB-23** | `data.retention-sweep` — **weekly.** Apply retention policy. **Idempotent: yes.** | — | all modules | C5 | Integration (one case per retention class); `NFR-PRV-04`; `BR-TEN-04`; `CON-04` | NOT STARTED |
| `[ ]` | **JOB-24** | `audit.partition-maintenance` — **monthly.** Create and archive partitions. **Idempotent: yes.** | — | `audit/` | C5 | Integration; `IDX-21`; `NFR-SCAL-06`; `NFR-SEC-13` (append-only preserved across partitions) | NOT STARTED |

---

## 16. Analytics Events — `EVT-01` … `EVT-49` and `FNL-01` … `FNL-02`

**Source:** §C6. Every event carries `event_name`, `timestamp`, `anonymous_id`, `user_id` (if known),
`session_id`, `tenant_id` (where applicable), `surface`, `properties`. **Personal data is never a
property** (`BR-DAT-06`) — every event row below is ticked only when a test asserts that no personal
identifier appears in its property payload.

### 16.1 Discovery — 13 events

| `[ ]` | ID | Requirement (event · key properties) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **EVT-01** | `search_performed` — query, lat/lng precision-reduced, radius, filters, sort, result_count. | — | `discovery/` | C6 | Integration + `BR-DAT-06` assertion (coordinates precision-reduced); `FR-SRCH-15`; `KPI-09` | NOT STARTED |
| `[ ]` | **EVT-02** | `search_filter_applied` — filter_name, filter_value, result_count_before, result_count_after. | — | `discovery/` | C6 | Integration; `FR-SRCH-15` | NOT STARTED |
| `[ ]` | **EVT-03** | `search_zero_results` — filters, most_restrictive_filter. | — | `discovery/` | C6 | Integration; `AC-SRCH-01.2`; `FR-SRCH-12` | NOT STARTED |
| `[ ]` | **EVT-04** | `search_result_clicked` — gym_id, position, is_featured. | — | `discovery/` | C6 | Integration; `FR-SRCH-11`, `FR-SRCH-15`; `KPI-09` | NOT STARTED |
| `[ ]` | **EVT-05** | `map_area_searched` — bounds_area, result_count. | — | `discovery/` | C6 | Integration; `FR-SRCH-08`; `AC-SRCH-02.2` | NOT STARTED |
| `[ ]` | **EVT-06** | `gym_detail_viewed` — gym_id, source (search / category / direct / favourite / share). | — | `discovery/` | C6 | Integration (one case per source — five); `KPI-09`, `KPI-10` | NOT STARTED |
| `[ ]` | **EVT-07** | `gym_gallery_opened` — gym_id, photo_index. | — | `discovery/` | C6 | Integration; `SCR-WEB-003` region 1 | NOT STARTED |
| `[ ]` | **EVT-08** | `plan_viewed` — gym_id, plan_id, price_minor. | — | `discovery/` · `plans/` | C6 | Integration; `NFR-DQ-02` (minor units in the payload) | NOT STARTED |
| `[ ]` | **EVT-09** | `comparison_added` — gym_ids, count. | — | `discovery/` | C6 | Integration; `FR-DETL-08` | NOT STARTED |
| `[ ]` | **EVT-10** | `comparison_viewed` — gym_ids, count. | — | `discovery/` | C6 | Integration; `SCR-WEB-004` | NOT STARTED |
| `[ ]` | **EVT-11** | `favourite_added` — gym_id. | — | `discovery/` | C6 | Integration; `FR-FAV-01` | NOT STARTED |
| `[ ]` | **EVT-12** | `favourite_removed` — gym_id. | — | `discovery/` | C6 | Integration; `FR-FAV-01` | NOT STARTED |
| `[ ]` | **EVT-13** | `reviews_expanded` — gym_id, review_count. | — | `discovery/` · `reviews/` | C6 | Integration; `FR-DETL-05` | NOT STARTED |

### 16.2 Conversion funnel — 11 events

| `[ ]` | ID | Requirement (event · key properties) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **EVT-14** | `checkout_started` — gym_id, plan_id, order_ref, origin. | — | `ordering/` | C6 | Integration; `KPI-10`, `KPI-11`; `KPI-17` origin split | NOT STARTED |
| `[ ]` | **EVT-15** | `auth_gate_shown` — method, elapsed_ms. | — | `iam/` · `web` | C6 | Integration; `FR-NAV-01`; `FR-CART-08` | NOT STARTED |
| `[ ]` | **EVT-16** | `auth_completed` — method, elapsed_ms. | — | `iam/` · `web` | C6 | Integration; `AC-AUTH-01.2` | NOT STARTED |
| `[ ]` | **EVT-17** | `coupon_applied` — code, discount_minor, rejection_reason. | — | `ordering/` | C6 | Integration; `FR-CPN-03` | NOT STARTED |
| `[ ]` | **EVT-18** | `coupon_rejected` — code, discount_minor, rejection_reason. | — | `ordering/` | C6 | Integration (one case per rejection reason); `AC-CPN-01.1` … `AC-CPN-01.3` | NOT STARTED |
| `[ ]` | **EVT-19** | `checkout_validated` — order_ref, changed (bool), change_type. | — | `ordering/` | C6 | Integration (both `changed` values); `BR-PLN-03`; `API-ORD-05` | NOT STARTED |
| `[ ]` | **EVT-20** | `payment_initiated` — order_ref, amount_minor, method. | — | `payments/` | C6 | Integration; `SMT-22`; `KPI-19` | NOT STARTED |
| `[ ]` | **EVT-21** | `payment_succeeded` — order_ref, failure_code, attempt_number. | — | `payments/` | C6 | Integration; `KPI-11`, `KPI-19`; `FNL-01` | NOT STARTED |
| `[ ]` | **EVT-22** | `payment_failed` — order_ref, failure_code, attempt_number. | — | `payments/` | C6 | Integration; platform report *Payment health*; `SMT-18` | NOT STARTED |
| `[ ]` | **EVT-23** | `checkout_abandoned` — order_ref, last_step, elapsed_ms. | — | `ordering/` | C6 | Integration; `FR-CART-10` recovery trigger | NOT STARTED |
| `[ ]` | **EVT-24** | `membership_activated` — membership_id, plan_id, origin. | — | `memberships/` | C6 | Integration; `KPI-08`; `BR-PAY-02` | NOT STARTED |

### 16.3 Engagement and retention — 11 events

| `[ ]` | ID | Requirement (event · key properties) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **EVT-25** | `qr_generated` — membership_id. | — | `attendance/` | C6 | Integration + `BR-DAT-06` (no token material in the payload); `FR-CHK-01` | NOT STARTED |
| `[ ]` | **EVT-26** | `checkin_recorded` — membership_id, branch_id, method, result, denial_reason. | — | `attendance/` | C6 | Integration (allowed and denied, scan and manual); `KPI-06`, `KPI-24`; `RCT-01` | NOT STARTED |
| `[ ]` | **EVT-27** | `membership_frozen` — membership_id, days. | — | `memberships/` | C6 | Integration; `SMT-05` | NOT STARTED |
| `[ ]` | **EVT-28** | `membership_unfrozen` — membership_id, days. | — | `memberships/` | C6 | Integration; `SMT-06`; `AC-MEMB-01.3` | NOT STARTED |
| `[ ]` | **EVT-29** | `renewal_reminder_sent` — membership_id, days_before_expiry. | — | `memberships/` · `notifications/` | C6 | Integration (all four offsets); `BR-MEM-11`; `JOB-04` | NOT STARTED |
| `[ ]` | **EVT-30** | `renewal_started` — membership_id, days_before_expiry. | — | `memberships/` | C6 | Integration; `FR-MEMB-06`; `KPI-12` | NOT STARTED |
| `[ ]` | **EVT-31** | `renewal_completed` — membership_id, days_before_expiry. | — | `memberships/` | C6 | Integration; `KPI-12`; tenant report *Renewals* | NOT STARTED |
| `[ ]` | **EVT-32** | `review_prompted` — gym_id, rating. | — | `reviews/` · `notifications/` | C6 | Integration (third check-in and day-45 prompts); `FR-REV-10` | NOT STARTED |
| `[ ]` | **EVT-33** | `review_submitted` — gym_id, rating. | — | `reviews/` | C6 | Integration; `KPI-13`; `BR-REV-01` | NOT STARTED |
| `[ ]` | **EVT-34** | `referral_shared` — channel. | — | `crm/` | C6 | Integration; `FR-REFR-01` | NOT STARTED |
| `[ ]` | **EVT-35** | `referral_converted` — channel. | — | `crm/` | C6 | Integration; `FR-REFR-02`; `BR-RFL-01` | NOT STARTED |

### 16.4 Tenant lifecycle — 14 events

| `[ ]` | ID | Requirement (event · key properties) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **EVT-36** | `owner_signup_started` — source. | — | `tenancy/` | C6 | Integration; `KPI-02`; `FNL-02` | NOT STARTED |
| `[ ]` | **EVT-37** | `owner_signup_completed` — source. | — | `tenancy/` | C6 | Integration; platform report *Tenant funnel* | NOT STARTED |
| `[ ]` | **EVT-38** | `onboarding_step_completed` — step, elapsed_ms. | — | `onboarding/` | C6 | Integration (all six wizard steps); `FR-ONB-01` … `FR-ONB-07` | NOT STARTED |
| `[ ]` | **EVT-39** | `application_submitted` — version, reason_codes. | — | `onboarding/` | C6 | Integration (new and resubmission); `BR-GYM-05`; `FNL-02` | NOT STARTED |
| `[ ]` | **EVT-40** | `application_approved` — version, reason_codes. | — | `onboarding/` | C6 | Integration; `KPI-03`; `AC-ONB-02.5`; `FNL-02` | NOT STARTED |
| `[ ]` | **EVT-41** | `application_rejected` — version, reason_codes. | — | `onboarding/` | C6 | Integration; `RCT-02`; platform report *Verification SLA* | NOT STARTED |
| `[ ]` | **EVT-42** | `first_plan_published` — elapsed_since_signup. | — | `plans/` | C6 | Integration; `KPI-02` (≥70% within 7 days); `FNL-02` | NOT STARTED |
| `[ ]` | **EVT-43** | `first_member_added` — elapsed_since_signup. | — | `crm/` | C6 | Integration; `FR-ONB-14` activation checklist; `FNL-02` | NOT STARTED |
| `[ ]` | **EVT-44** | `first_checkin_recorded` — elapsed_since_signup. | — | `attendance/` | C6 | Integration; `KPI-01`; `FR-ONB-14`; `FNL-02` | NOT STARTED |
| `[ ]` | **EVT-45** | `dashboard_screen_viewed` — screen, role. | — | `dash` | C6 | Integration (screen and role dimensions); `KPI-05` | NOT STARTED |
| `[ ]` | **EVT-46** | `offline_sale_recorded` — amount_minor, method. | — | `ordering/` | C6 | Integration; `KPI-17`; `FR-CART-09` | NOT STARTED |
| `[ ]` | **EVT-47** | `report_viewed` — report_key, date_range_days. | — | `reporting/` | C6 | Integration; `KPI-05`; `FR-RPT-01` | NOT STARTED |
| `[ ]` | **EVT-48** | `report_exported` — report_key, date_range_days. | — | `reporting/` | C6 | Integration; `FR-RPT-01`; `AC-RPT-01.3` | NOT STARTED |
| `[ ]` | **EVT-49** | `export_requested` — entity, row_count. | — | `reporting/` | C6 | Integration; `BR-DAT-05`; `BAC-12`; `JOB-21` | NOT STARTED |

### 16.5 Derived funnels — 2

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **FNL-01** | **Marketplace funnel** — `search_performed` → `search_result_clicked` → `gym_detail_viewed` → `checkout_started` → `payment_succeeded`, with drop-off at each step. | — | `reporting/` | C6 | Integration (end-to-end funnel over the §C8.2 seed); `KPI-09`, `KPI-10`, `KPI-11`; platform report *Marketplace funnel* | NOT STARTED |
| `[ ]` | **FNL-02** | **Tenant activation funnel** — `owner_signup_started` → `application_submitted` → `application_approved` → `first_plan_published` → `first_member_added` → `first_checkin_recorded`. | — | `reporting/` | C6 | Integration (end-to-end funnel); `KPI-01`, `KPI-02`, `KPI-03`; platform report *Tenant funnel* | NOT STARTED |

---

## 17. Data Model — 43 tables, 11 reference tables, 19 indexes, 2 partition declarations

**Source:** §C2.1 (ERD), §C2.2 (core tables), §C2.3 (reference tables), §C2.4 (key indexes).

Every table row is ticked only when **all** of the following hold, because these are stated as
universal in §C2.2 and §B9.8 rather than per table:

1. `id uuid pk`, `created_at`, `updated_at`, `created_by`, `updated_by` present (`NFR-DQ-05`), and
   `deleted_at` where soft deletion applies (`NFR-DQ-04`).
2. `tenant_id` present **and RLS enabled** with policy `USING (tenant_id = current_setting('app.tenant_id')::uuid)` on every tenant-owned table; the application role has **no** `BYPASSRLS` (§C1.4).
3. Referential integrity enforced by database constraints, not application convention (`NFR-DQ-01`).
4. Money as minor-unit integers with an adjacent currency column (`NFR-DQ-02`, `BR-PAY-01`).
5. Timestamps in UTC, with the applicable timezone stored alongside where local interpretation matters (`NFR-DQ-03`).
6. Every column has a documented purpose (`NFR-PRV-01`).
7. Isolation-suite coverage for every endpoint that reads or writes it (§C1.4 step 5).

The ORM and migration tooling that will express all of this are **pending** `A-01` and `A-07`; no
table may be built on an unapproved addition.

### 17.1 Core tables (§C2.2) — `TBL-01` … `TBL-35`

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **TBL-01** | **`tenants`** — `legal_name`, `trading_name`, `entity_type` (`sole_proprietor` / `partnership` / `company` / `other`), `registration_number` (unique per country, indexed for duplicate detection), `country_code char(2)` (drives tax profile and KYC checklist), `currency char(3)` ISO-4217, `timezone` (IANA, authoritative for all validity computation), `status` (`DRAFT`/`SUBMITTED`/`UNDER_REVIEW`/`INFO_REQUESTED`/`APPROVED`/`REJECTED`/`SUSPENDED`/`CLOSED`), `subscription_tier_id`, `subscription_status` (`TRIAL`/`ACTIVE`/`PAST_DUE`/`CANCELLED`), `commission_rate_bps` (nullable tenant override, basis points), `renewal_commission_rate_bps` (nullable), `settlement_cycle_days` (default 7), `reserve_bps` (default 500), `tax_profile_id`, `refund_policy jsonb` (window days, proration method, cancellation fee, free text). | — | `tenancy/` | C2.2 | Schema + Integration; `SM-04`; `BR-TEN-01`, `BR-TEN-06`; `BR-REF-01`; `OQ-04` | NOT STARTED |
| `[ ]` | **TBL-02** | **`gyms`** — `tenant_id` (RLS key), `name`, `slug` (unique per city), `description` (sanitised HTML), `category_id`, `gender_policy` (`MIXED`/`WOMEN_ONLY`/`MEN_ONLY`/`SCHEDULED`), `status` (`DRAFT`/`PENDING_REVIEW`/`APPROVED`/`SUSPENDED`/`CLOSED`), `rating_avg numeric(2,1)` (denormalised, recomputed on review change), `rating_count int`, `freshness_score int` 0–100 (recomputed nightly), `featured_until timestamptz`. | — | `catalog/` | C2.2 | Schema + RLS + Integration; `BR-GYM-01`; `FR-GYM-12`; `JOB-12`, `JOB-14` | NOT STARTED |
| `[ ]` | **TBL-03** | **`branches`** — `gym_id`, `tenant_id`, `name`, `address_line1/2`, `city`, `state`, `postal_code`, `country_code`, `location geography(Point,4326)` (PostGIS; GiST index for radius search), `capacity int`, `status` (`ACTIVE`/`INACTIVE`), `is_primary bool`. | — | `catalog/` | C2.2 | Schema + RLS + PostGIS radius query; `FR-GYM-06`, `FR-GYM-07`, `FR-GYM-09`; `IDX-01` | NOT STARTED |
| `[ ]` | **TBL-04** | **`branch_hours`** — `branch_id`, `weekday`, `opens_at`, `closes_at`. Multiple rows per weekday permit split hours. | — | `catalog/` | C2.2 | Schema + Integration (split-hours case); `FR-GYM-04`; `BR-CHK-05` | NOT STARTED |
| `[ ]` | **TBL-05** | **`branch_hour_exceptions`** — `branch_id`, `date`, `is_closed`, `opens_at`, `closes_at`, `reason`. | — | `catalog/` | C2.2 | Schema + Integration; `FR-GYM-10`; `RC-09 GYM_CLOSED_EXCEPTION`; `AC-GYM-02.2` | NOT STARTED |
| `[ ]` | **TBL-06** | **`gym_amenities`** — `gym_id`, `amenity_id` (amenities are platform reference data). | — | `catalog/` | C2.2 | Schema + Contract negative (free text refused); `FR-GYM-03`; `NFR-DQ-06` | NOT STARTED |
| `[ ]` | **TBL-07** | **`gym_media`** — `gym_id`, `branch_id?`, `url`, `renditions jsonb`, `caption`, `sort_order`, `is_cover`, `moderation_status`. | — | `catalog/` | C2.2 | Schema + Integration + Security; `FR-GYM-02` (renditions, EXIF stripping); `FR-ADMN-12` | NOT STARTED |
| `[ ]` | **TBL-08** | **`plans`** — `tenant_id`, `gym_id`, `name`, `description`, `plan_type` (`DURATION`/`SESSION`), `duration_value`, `duration_unit` (days/weeks/months/years), `session_count`, `price_minor bigint`, `currency char(3)`, `joining_fee_minor bigint`, `promo_price_minor`, `promo_starts_at`, `promo_ends_at`, `access_window jsonb`, `min_age int`, `gender_eligibility`, `freeze_allowed bool`, `freeze_max_days int`, `transfer_allowed bool`, `stackable bool`, `visibility` (`PUBLIC`/`STAFF_ONLY`), `status` (`DRAFT`/`PUBLISHED`/`ARCHIVED`), `sort_order int`. | — | `plans/` | C2.2 | Schema + RLS + Integration; `BR-PLN-01`, `BR-PLN-04`, `BR-PLN-05`, `BR-PLN-07`; `BR-PAY-01`; `IDX-04` | NOT STARTED |
| `[ ]` | **TBL-09** | **`plan_branches`** — `plan_id`, `branch_id`. **Absence of rows means all branches.** | — | `plans/` | C2.2 | Schema + Integration (absence semantics asserted explicitly); `FR-GYM-08`; `AC-GYM-01.1` | NOT STARTED |
| `[ ]` | **TBL-10** | **`memberships`** — `tenant_id`, `gym_id`, `user_id`, `plan_id`, `order_id`, `membership_code` (human-readable, unique per tenant), `status` (`PENDING`/`ACTIVE`/`FROZEN`/`EXPIRED`/`CANCELLED`/`REFUNDED`), `start_date`, `end_date` (interpreted in the gym's timezone), `sessions_total`, `sessions_used`, `freeze_days_used`, `auto_renew bool`, `origin` (`MARKETPLACE`/`DIRECT`), `attributed_at timestamptz` (drives the 30-day attribution window), `purchased_price_minor` + `currency` (terms frozen at purchase), `purchased_terms jsonb` (snapshot of plan configuration at purchase). | — | `memberships/` | C2.2 | Schema + RLS + Integration; `SM-01`; `BR-MEM-01`, `BR-MEM-03`; `BR-PLN-02`; `IDX-05`, `IDX-06`, `IDX-19` | NOT STARTED |
| `[ ]` | **TBL-11** | **`membership_events`** — **append-only**: `membership_id`, `from_status`, `to_status`, `reason`, `actor_id`, `actor_type`, `metadata jsonb`, `occurred_at`. | — | `memberships/` | C2.2 | Schema (no `UPDATE`/`DELETE` path) + Integration (one row per transition); `SMI-03`; `FR-MEMB-02` | NOT STARTED |
| `[ ]` | **TBL-12** | **`orders`** — `tenant_id`, `gym_id`, `user_id`, `plan_id`, `order_ref` (human-readable, unique), `status` (`PENDING`/`AWAITING_PAYMENT`/`PAID`/`PARTIALLY_PAID`/`FAILED`/`EXPIRED`/`CANCELLED`/`REFUNDED`), `origin` (`MARKETPLACE`/`DIRECT`), `channel` (`WEB`/`DASHBOARD`), `gross_minor`, `discount_minor`, `net_minor`, `tax_minor`, `total_minor`, `commission_base_minor`, `commission_minor`, `gateway_fee_minor`, `payable_to_gym_minor` (all persisted per §A6.3), `currency char(3)`, `coupon_id`, `refund_policy_snapshot jsonb`, `tax_snapshot jsonb`, `start_date`, `expires_at timestamptz`, `idempotency_key` (unique). | — | `ordering/` | C2.2 | Schema + RLS + Integration; `SM-02`; `BR-FIN-02`; `BR-REF-02`; `BR-PAY-11`; `IDX-09`, `IDX-10` | NOT STARTED |
| `[ ]` | **TBL-13** | **`payments`** — `tenant_id`, `order_id`, `provider`, `provider_intent_id`, `provider_charge_id`, `method` (`CARD`/`UPI`/`NETBANKING`/`WALLET`/`CASH`/`BANK_TRANSFER`/`OTHER`), `amount_minor` + `currency`, `status` (`CREATED`/`PENDING`/`AUTHORISED`/`CAPTURED`/`FAILED`/`CANCELLED`/`REFUNDED`/`PARTIALLY_REFUNDED`), `failure_code`, `failure_message`, `is_offline bool` (staff-recorded), `collected_by_staff_id` (attribution for cash), `raw_payload jsonb` (redacted). | — | `payments/` | C2.2 | Schema + RLS + Security (redaction); `SM-03`; `BR-PAY-08`; `AC-STAF-01.3`; `IDX-11` | NOT STARTED |
| `[ ]` | **TBL-14** | **`payment_events`** — **append-only** provider event log with `provider_event_id` **unique** for deduplication. | — | `payments/` | C2.2 | Schema (unique constraint) + Integration (replay yields one effect); `BR-PAY-05`; `FR-PAY-04`; `IDX-12` | NOT STARTED |
| `[ ]` | **TBL-15** | **`invoices`** — `tenant_id`, `order_id`, `invoice_number` (unique per tenant per FY), `issued_at`, `financial_year`, `tenant_snapshot jsonb`, `customer_snapshot jsonb`, `line_items jsonb`, `tax_breakdown jsonb`, `totals`, `pdf_url`, `status`. | — | `billing/` | C2.2 | Schema (unique per tenant per FY) + Integration (concurrency, gaplessness, immutability); `BR-PAY-10`; `AC-INV-01.1` … `AC-INV-01.3` | NOT STARTED |
| `[ ]` | **TBL-16** | **`credit_notes`** — mirrors `invoices`, plus `original_invoice_id`, `refund_id`. Numbered in their own sequence. | — | `billing/` | C2.2 | Schema + Integration; `FR-INV-09`; `E2E-07` | NOT STARTED |
| `[ ]` | **TBL-17** | **`attendance`** — `tenant_id`, `gym_id`, `branch_id`, `membership_id`, `user_id`, `checked_in_at`, `checked_out_at`, `method` (`SCAN`/`MANUAL`/`OVERRIDE`), `result` (`ALLOWED`/`DENIED`), `denial_reason` (nullable; `RCT-01`), `staff_id` (manual and override), `override_reason`, `token_nonce` (unique within TTL for idempotency), `duration_minutes` (computed). **Partitioned monthly by `checked_in_at`.** | — | `attendance/` | C2.2 | Schema + RLS + Integration (immutability, idempotency); `BR-CHK-06`, `BR-CHK-09`, `BR-CHK-10`; `IDX-07`, `IDX-08`, `IDX-20` | NOT STARTED |
| `[ ]` | **TBL-18** | **`ledger_entries`** — **append-only, the source of truth for all balances.** `tenant_id`, `entry_type` (`SALE`/`COMMISSION`/`GATEWAY_FEE`/`TAX`/`REFUND`/`COMMISSION_REVERSAL`/`CHARGEBACK`/`CHARGEBACK_REVERSAL`/`RESERVE_HOLD`/`RESERVE_RELEASE`/`PAYOUT`/`ADJUSTMENT`), `direction` (`CREDIT`/`DEBIT`), `amount_minor` + `currency`, `reference_type` + `reference_id` (order, refund, payout, dispute), `settlement_batch_id` (nullable until batched), `occurred_at`. **No `UPDATE` or `DELETE` grant exists on this table for the application role.** | — | `ledger/` | C2.2 | Schema (grant assertion) + Integration (all 12 entry types) + E2E; `BR-FIN-01`; `PRIN-03`; `E2E-12`; `IDX-13`, `IDX-14` | NOT STARTED |
| `[ ]` | **TBL-19** | **`settlement_batches`** — `tenant_id`, `period_start`, `period_end`, `opening_balance_minor`, `gross_minor`, `commission_minor`, `fees_minor`, `refunds_minor`, `reserve_held_minor`, `reserve_released_minor`, `net_payable_minor`, `status`, `payout_reference`, `statement_url`. | — | `settlements/` | C2.2 | Schema + RLS + Integration; `SM-07`; `BR-FIN-03`; `AC-SETL-01.4` | NOT STARTED |
| `[ ]` | **TBL-20** | **`settlement_lines`** — one row per contributing ledger entry with all eight figures denormalised for the statement. | — | `settlements/` | C2.2 | Schema + Integration (eight figures persisted, never recomputed); `BR-FIN-02`; `AC-SETL-01.1` | NOT STARTED |
| `[ ]` | **TBL-21** | **`refunds`** — `tenant_id`, `order_id`, `membership_id`, `requested_by`, `requester_type`, `reason_code`, `reason_text`, `requested_amount_minor`, `approved_amount_minor`, `computation jsonb`, `status`, `approver_id`, `provider_refund_id`, `credit_note_id`. | — | `refunds/` | C2.2 | Schema + RLS + Integration; `SM-05`; `RCT-03`; `FR-RFND-04`; `BR-REF-09` | NOT STARTED |
| `[ ]` | **TBL-22** | **`disputes`** — `tenant_id`, `payment_id`, `provider_dispute_id`, `amount_minor`, `reason_code`, `status`, `evidence_due_at`, `evidence jsonb`, `outcome`, `resolved_at`. | — | `refunds/` | C2.2 | Schema + RLS + Integration; `BR-REF-08`; `FR-RFND-08`, `FR-RFND-09`, `FR-RFND-10`; `KPI-21` | NOT STARTED |
| `[ ]` | **TBL-23** | **`reviews`** — `tenant_id`, `gym_id`, `user_id`, `membership_id`, `rating`, `sub_ratings jsonb`, `body`, `media jsonb`, `status` (`PENDING`/`PUBLISHED`/`HELD`/`UNPUBLISHED`/`REMOVED`), `screening_result jsonb`, `published_at`, `edited_at`, `edit_history jsonb`. | — | `reviews/` | C2.2 | Schema + RLS + Integration; `SM-06`; `BR-REV-01`, `BR-REV-02`, `BR-REV-04`; `IDX-15` | NOT STARTED |
| `[ ]` | **TBL-24** | **`review_responses`** — `review_id`, `tenant_id`, `body`, `author_staff_id`, `status`. One response per review. | — | `reviews/` | C2.2 | Schema (uniqueness on `review_id`) + Integration; `BR-REV-05`; `FR-REV-05` | NOT STARTED |
| `[ ]` | **TBL-25** | **`review_reports`** — `review_id`, `reporter_id`, `reporter_type`, `reason_code`, `notes`, `status`, `resolution`. | — | `reviews/` | C2.2 | Schema + Integration (review stays published while reported); `BR-REV-06`; `RCT-04` | NOT STARTED |
| `[ ]` | **TBL-26** | **`coupons`** — `scope` (`PLATFORM`/`TENANT`), `tenant_id?`, `code`, `discount_type`, `discount_value`, `max_discount_minor`, `valid_from`, `valid_to`, `total_limit`, `per_user_limit`, `first_purchase_only`, `applicable_plan_ids`, `applicable_branch_ids`, `funding_source`, `status`, `redemption_count`. | — | `ordering/` | C2.2 | Schema + RLS (tenant scope) + Integration; `BR-CPN-01`, `BR-CPN-05`; `FR-CPN-02` | NOT STARTED |
| `[ ]` | **TBL-27** | **`coupon_redemptions`** — `coupon_id`, `order_id`, `user_id`, `discount_minor`, `redeemed_at`. | — | `ordering/` | C2.2 | Schema + Integration (per-user and total caps enforced under concurrency); `AC-CPN-01.2`, `AC-CPN-01.3` | NOT STARTED |
| `[ ]` | **TBL-28** | **`staff`** — `tenant_id`, `user_id`, `role`, `status`, `invited_at`, `joined_at`, `removed_at`. | — | `staff/` | C2.2 | Schema + RLS + Integration; `FR-STAF-02`, `FR-STAF-04`, `FR-STAF-09`; `AC-STAF-01.4` | NOT STARTED |
| `[ ]` | **TBL-29** | **`staff_branches`** — `staff_id`, `branch_id`. | — | `staff/` | C2.2 | Schema + Isolation (branch scoping enforced); `FR-STAF-03`; `AC-STAF-01.1` | NOT STARTED |
| `[ ]` | **TBL-30** | **`kyc_documents`** — `tenant_id`, `document_type`, `storage_key` (**separate encrypted bucket**), `original_filename`, `status`, `reviewed_by`, `review_notes`, `valid_until`. | — | `onboarding/` | C2.2 | Schema + RLS + Security (separate key, access logged); `BR-DAT-07`; `NFR-SEC-02` | NOT STARTED |
| `[ ]` | **TBL-31** | **`applications`** — `tenant_id`, `version`, `submitted_at`, `snapshot jsonb`, `status`, `assigned_to`, `decided_by`, `decided_at`, `decision`, `reason_codes[]`, `reviewer_notes`, `precheck_results jsonb`. | — | `onboarding/` | C2.2 | Schema + RLS + Integration (versioning and snapshot immutability); `SM-04`; `BR-GYM-05`; `FR-ONB-08`, `FR-ONB-12` | NOT STARTED |
| `[ ]` | **TBL-32** | **`audit_log`** — `actor_id`, `actor_type`, `impersonated_by`, `tenant_id`, `entity_type`, `entity_id`, `action`, `before jsonb`, `after jsonb`, `ip`, `user_agent`, `correlation_id`, `reason`, `occurred_at`. **Append-only, partitioned monthly.** | — | `audit/` | C2.2 | Schema (no `UPDATE`/`DELETE` grant) + Integration + E2E; `BR-DAT-01`, `BR-DAT-02`; `NFR-SEC-13`; `BAC-13`; `IDX-16`, `IDX-17`, `IDX-21` | NOT STARTED |
| `[ ]` | **TBL-33** | **`notification_log`** — `recipient_id`, `recipient_type`, `channel`, `template_key`, `category`, `payload jsonb`, `status`, `provider_message_id`, `attempts`, `last_error`, `sent_at`. | — | `notifications/` | C2.2 | Schema + Integration + Security (`BR-DAT-06` — no personal data in the logged payload beyond what delivery requires); `FR-NOTF-04` | NOT STARTED |
| `[ ]` | **TBL-34** | **`outbox`** — `aggregate_type`, `aggregate_id`, `event_type`, `payload jsonb`, `published_at`, `attempts`. Written in the **same transaction** as the state change, dispatched by a worker. | — | `common/` | C2.2 · C1.5 | Integration (never sent for a rolled-back transaction; never lost for a committed one); `JOB-19`; §C1.5 *Events* | NOT STARTED |
| `[ ]` | **TBL-35** | **`idempotency_keys`** — `key`, `endpoint`, `request_hash`, `response_status`, `response_body jsonb`, `expires_at`. Stored 24 hours; same key + same fingerprint replays the stored response, same key + different fingerprint returns `409`. | — | `common/` | C2.2 · C1.5 | Contract (both replay cases) + Integration; `BR-PAY-03`; §C1.5 *Idempotency* | NOT STARTED |

### 17.2 ERD entities named in §C2.1 but not detailed in §C2.2 — `TBL-36` … `TBL-43`

The §C2.1 entity-relationship overview names eight entities that §C2.2 does not expand. They are
enumerated here so nothing in the ERD is lost; their columns are specified in Phase 4
(`/docs/database/Schema.md`) and must satisfy the same seven universal conditions listed above.

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **TBL-36** | **`users`** — the platform identity. Root of `user_roles`, `memberships`, `orders`, `reviews`, `favourites`, `referrals`, `support_tickets` in the §C2.1 ERD. Platform-scope, not tenant-owned. | — | `iam/` | C2.1 | Schema + Integration; `FR-USER-01`; `BR-DAT-04` pseudonymisation | NOT STARTED |
| `[ ]` | **TBL-37** | **`user_roles`** — the join between `users` and `roles`, carrying the scope against which a role is evaluated. Permission evaluation is always `(role, scope, resource, action)`, never role alone. | — | `iam/` | C2.1 · B3.1 | Schema + RBAC; `FR-RBAC-03`; `FR-AUTH-11` | NOT STARTED |
| `[ ]` | **TBL-38** | **`roles`** — the twelve roles of §B3.1: `VISITOR`, `USER`, `MEMBER`, `GYM_OWNER`, `GYM_MANAGER`, `RECEPTIONIST`, `TRAINER`, `SUPER_ADMIN`, `VERIFICATION_OFFICER`, `SUPPORT_AGENT`, `FINANCE`, `MODERATOR`. Roles are additive within a scope. | — | `iam/` | C2.1 · B3.1 | Schema + RBAC (all twelve, against the §B3.2 matrix); `FR-RBAC-01` … `FR-RBAC-07` | NOT STARTED |
| `[ ]` | **TBL-39** | **`order_items`** — the line composition of an order (plan, joining fee, add-ons), consistent with the `FR-CART-03` itemisation and the §C3.3 breakdown. | — | `ordering/` | C2.1 | Schema + RLS + Integration; `FR-CART-03`; `FR-PLAN-09` add-ons | NOT STARTED |
| `[ ]` | **TBL-40** | **`payout_accounts`** — the tenant's bank/payout destination, verified through the gateway; a change suspends payouts until re-verified. | — | `settlements/` | C2.1 | Schema + RLS + Integration; `FR-ONB-06`; `BR-GYM-06`; `API-TEN-56`, `API-TEN-57` | NOT STARTED |
| `[ ]` | **TBL-41** | **`favourites`** — the join between `users` and `gyms` for saved gyms. Platform-scope on the user side, referencing tenant-owned gyms. | — | `discovery/` | C2.1 | Schema + Isolation; `FR-FAV-01`, `FR-FAV-02`; `API-FAV-01` … `API-FAV-03` | NOT STARTED |
| `[ ]` | **TBL-42** | **`referrals`** — referral codes, attribution, qualification state and reward status per `BR-RFL-01`. | — | `crm/` | C2.1 | Schema + Integration; `FR-REFR-01` … `FR-REFR-05`, `FR-REFR-07`; `AC-REFR-01.1` … `AC-REFR-01.3` | NOT STARTED |
| `[ ]` | **TBL-43** | **`support_tickets`** — tickets raised by members and tenants, with the `FR-SUP-04` status lifecycle and the linked entities of `FR-SUP-02`. | — | `support/` | C2.1 | Schema + Isolation; `FR-SUP-01` … `FR-SUP-05`; `API-SUP-01` … `API-SUP-05` | NOT STARTED |

### 17.3 Reference (platform-global) tables (§C2.3) — `REF-01` … `REF-11`

These are **not tenant-scoped and are exempt from RLS**. Every one of them must be proven exempt
deliberately — an accidental RLS omission on a tenant-owned table and a deliberate exemption here look
identical in the schema and must not be confused.

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **REF-01** | **`countries`** — the country register that drives tax profile and KYC checklist selection. | — | `admin/` | C2.3 | Schema + Integration (RLS exemption deliberate and documented); `OBJ-09`; `OQ-01` | NOT STARTED |
| `[ ]` | **REF-02** | **`cities`** — the city register backing city landing pages and the search location model. | — | `admin/` · `discovery/` | C2.3 | Schema + Integration; `FR-SRCH-13`; `API-DISC-08`, `API-DISC-09`; `IDX-02` | NOT STARTED |
| `[ ]` | **REF-03** | **`localities`** — sub-city localities used in search, filtering and coverage reporting. | — | `admin/` · `discovery/` | C2.3 | Schema + Integration; `FR-SRCH-02`; §C9.4 coverage gate (≥5 localities) | NOT STARTED |
| `[ ]` | **REF-04** | **`amenities`** — the platform-controlled amenity taxonomy; free-text amenities are not permitted. | — | `admin/` · `catalog/` | C2.3 | Schema + Contract negative; `FR-GYM-03`; `NFR-DQ-06`; `API-DISC-12` | NOT STARTED |
| `[ ]` | **REF-05** | **`gym_categories`** — the category taxonomy backing category tiles and landing pages. | — | `admin/` · `discovery/` | C2.3 | Schema + Integration; `API-DISC-10`, `API-DISC-11`; `SCR-WEB-001` region 3 | NOT STARTED |
| `[ ]` | **REF-06** | **`subscription_tiers`** — Starter / Growth / Professional / Enterprise limits, features and prices per §A6.2. | — | `admin/` · `billing/` | C2.3 | Schema + Integration (seat and branch caps enforced); `FR-ADMN-04`; `FR-STAF-06`; `OQ-03` | NOT STARTED |
| `[ ]` | **REF-07** | **`tax_profiles`** — per-country rate table, inclusive/exclusive treatment, place-of-supply rules, rounding method. | — | `admin/` · `billing/` | C2.3 | Schema + Unit (tax matrix); `FR-INV-05`; `FR-ADMN-05`; `BR-PAY-11` | NOT STARTED |
| `[ ]` | **REF-08** | **`kyc_checklists`** — per-country document types, mandatory flags and validity rules. | — | `admin/` · `onboarding/` | C2.3 | Schema + Integration; `FR-ONB-03`; `FR-ADMN-06`; `BR-GYM-02` | NOT STARTED |
| `[ ]` | **REF-09** | **`reason_codes`** — typed: rejection, denial, refund, moderation, override. Backs all five taxonomies (`RCT-01` … `RCT-05`, 57 codes). | — | `admin/` | C2.3 | Schema + Integration (all 57 codes seeded and enumerable); `FR-ADMN-07` | NOT STARTED |
| `[ ]` | **REF-10** | **`feature_flags`** — flags with tenant, role and percentage targeting, evaluated server-side with the resolved set sent to the client. | — | `admin/` · `common/` | C2.3 · C1.5 | Schema + Integration (three targeting modes); `FR-ADMN-08`; `NFR-MNT-07` | NOT STARTED |
| `[ ]` | **REF-11** | **`notification_templates`** — versioned, previewable, editable without deployment, with tenant-level overrides where the tier permits. | — | `admin/` · `notifications/` | C2.3 | Schema + Integration (versioning and override precedence); `FR-NOTF-03` | NOT STARTED |

### 17.4 Indexes (§C2.4 plus the one declared inline in §C2.2) — `IDX-01` … `IDX-19`

§C2.4 lists 15 table rows containing 18 distinct indexes (two rows declare two indexes each).
`IDX-19` is the third `memberships` index declared inline in §C2.2 but absent from the §C2.4 table; it
is enumerated here so it is not lost. Every index row is ticked only when the index exists **and** a
performance test demonstrates the query it exists for actually uses it.

| `[ ]` | ID | Requirement (table · index · purpose) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **IDX-01** | `branches` — **GiST on `location`** — radius search. | — | `catalog/` · `discovery/` | C2.4 | Performance + query-plan assertion; `NFR-PERF-01`; `AC-SRCH-01.1` | NOT STARTED |
| `[ ]` | **IDX-02** | `branches` — `(city, status)` — city landing pages. | — | `catalog/` · `discovery/` | C2.4 | Performance + query-plan assertion; `FR-SRCH-13` | NOT STARTED |
| `[ ]` | **IDX-03** | `gyms` — `(status, rating_avg desc, freshness_score desc)` — ranking. | — | `discovery/` | C2.4 | Performance + query-plan assertion; `FR-SRCH-10` | NOT STARTED |
| `[ ]` | **IDX-04** | `plans` — `(gym_id, status, visibility)` — public catalogue. | — | `plans/` | C2.4 | Performance + query-plan assertion; `BR-PLN-05`; `API-DISC-04` | NOT STARTED |
| `[ ]` | **IDX-05** | `memberships` — `(tenant_id, status, end_date)` — expiry job, renewal lists. | — | `memberships/` | C2.4 · C2.2 | Performance + query-plan assertion; `JOB-02`; `AC-MEMB-02.1` | NOT STARTED |
| `[ ]` | **IDX-06** | `memberships` — `(user_id, status)` — account views. | — | `memberships/` | C2.4 · C2.2 | Performance + query-plan assertion; `API-MEMB-01` | NOT STARTED |
| `[ ]` | **IDX-07** | `attendance` — `(tenant_id, branch_id, checked_in_at)` — attendance reports. | — | `attendance/` | C2.4 · C2.2 | Performance + query-plan assertion; `AC-CHK-02.2`; `FR-CHK-10` | NOT STARTED |
| `[ ]` | **IDX-08** | `attendance` — `(membership_id, checked_in_at desc)` — cooldown and history. | — | `attendance/` | C2.4 · C2.2 | Performance + query-plan assertion; `BR-CHK-04`; `NFR-PERF-03` | NOT STARTED |
| `[ ]` | **IDX-09** | `orders` — `(tenant_id, status, created_at)` — sales views. | — | `ordering/` | C2.4 | Performance + query-plan assertion; `SCR-DASH-011`; `NFR-PERF-04` | NOT STARTED |
| `[ ]` | **IDX-10** | `orders` — **unique `(idempotency_key)`** — `BR-PAY-03`. | — | `ordering/` | C2.4 | Integration (concurrent duplicate submit yields one order); `FR-CART-06`; `AC-PAY-01.1` | NOT STARTED |
| `[ ]` | **IDX-11** | `payments` — **unique `(provider, provider_intent_id)`** — webhook deduplication. | — | `payments/` | C2.4 | Integration (duplicate webhook yields one effect); `FR-PAY-04` | NOT STARTED |
| `[ ]` | **IDX-12** | `payment_events` — **unique `(provider_event_id)`** — replay protection. | — | `payments/` | C2.4 | Integration + Security (replayed event discarded); `BR-PAY-05` | NOT STARTED |
| `[ ]` | **IDX-13** | `ledger_entries` — `(tenant_id, occurred_at)` — settlement. | — | `ledger/` | C2.4 | Performance + query-plan assertion; `JOB-09`; `E2E-12` | NOT STARTED |
| `[ ]` | **IDX-14** | `ledger_entries` — `(settlement_batch_id)` — settlement. | — | `ledger/` | C2.4 | Performance + query-plan assertion; `FR-SETL-02` | NOT STARTED |
| `[ ]` | **IDX-15** | `reviews` — `(gym_id, status, published_at desc)` — detail page. | — | `reviews/` | C2.4 | Performance + query-plan assertion; `FR-DETL-05`; `API-DISC-05` | NOT STARTED |
| `[ ]` | **IDX-16** | `audit_log` — `(entity_type, entity_id, occurred_at)` — audit explorer. | — | `audit/` | C2.4 | Performance + query-plan assertion; `AC-ADMN-02.1`; `FR-ADMN-09` | NOT STARTED |
| `[ ]` | **IDX-17** | `audit_log` — `(actor_id, occurred_at)` — audit explorer. | — | `audit/` | C2.4 | Performance + query-plan assertion; `FR-ADMN-09` (filter by actor) | NOT STARTED |
| `[ ]` | **IDX-18** | `tenants` — `registration_number` indexed for duplicate detection *(declared in the §C2.2 `tenants` table notes as "unique per country, indexed for duplicate detection")*. | — | `tenancy/` · `onboarding/` | C2.2 | Integration (duplicate registration identifier pre-check); `FR-ONB-12` | NOT STARTED |
| `[ ]` | **IDX-19** | `memberships` — `(gym_id, status)` *(declared inline in §C2.2 alongside `IDX-05` and `IDX-06`, absent from the §C2.4 table)*. | — | `memberships/` | C2.2 | Performance + query-plan assertion; `API-MEMB-09` tenant membership view | NOT STARTED |

### 17.5 Partition declarations (§C2.2) — `IDX-20`, `IDX-21`

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **IDX-20** | **`attendance` is partitioned monthly by `checked_in_at`.** | — | `attendance/` | C2.2 | Schema + Integration (cross-partition query correctness); `NFR-SCAL-06` | NOT STARTED |
| `[ ]` | **IDX-21** | **`audit_log` is append-only and partitioned monthly.** | — | `audit/` | C2.2 | Schema + Integration; `JOB-24 audit.partition-maintenance`; `NFR-SEC-13`; `NFR-SCAL-06` | NOT STARTED |

---

## 18. Risks, Open Questions, Assumptions, Constraints and Dependencies

### 18.1 Risk Register — `RSK-01` … `RSK-15` (§A10)

Scored as **Probability (1–5) × Impact (1–5)**. **A risk row is ticked when its mitigation is
implemented** — not when the risk is considered acceptable, and not when the mitigation is merely
planned.

| `[ ]` | ID | Requirement (risk · P × I = score · mitigation · owner) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **RSK-01** | **Fake or non-existent gyms listed.** P4 × I5 = **20**. *Mitigation:* mandatory human KYC review; address-to-geo tolerance check (`BR-GYM-08`); duplicate address detection; bank account verification; post-launch spot audits; member "report this gym" flow. *Owner:* Operations. | — | `onboarding/` · `admin/` | A10 | `E2E-01`; `BR-GYM-03`, `BR-GYM-08`, `BR-GYM-09`; `FR-ONB-12`; `FR-DETL-06`; `UAT-04` | NOT STARTED |
| `[ ]` | **RSK-02** | **Fake or incentivised reviews.** P4 × I4 = **16**. *Mitigation:* check-in-gated reviews (`BR-REV-01`); one review per term; anomaly detection on rating velocity; moderation queue. *Owner:* Operations. | — | `reviews/` | A10 | `E2E-09`; `BAC-09`; `FR-REV-01`, `FR-REV-04`, `FR-REV-09`; `JOB-13` | NOT STARTED |
| `[ ]` | **RSK-03** | **Membership credential sharing.** P4 × I3 = **12**. *Mitigation:* 60-second rotating tokens (`BR-CHK-02`); implausible-travel detection (`BR-CHK-07`); photo on staff check-in screen; suspension pending review. *Owner:* Product. | — | `attendance/` · `memberships/` | A10 | `AC-CHK-01.3`; `FR-CHK-05`, `FR-CHK-12`; `JOB-17`; `BR-MEM-13`; `RC-14` | NOT STARTED |
| `[ ]` | **RSK-04** | **Payment failure or double charge.** P3 × I5 = **15**. *Mitigation:* idempotency everywhere (`BR-PAY-03`); webhook-driven activation (`BR-PAY-02`); automated duplicate detection and refund (`BR-PAY-07`); daily reconciliation. *Owner:* Engineering. | — | `payments/` | A10 | `E2E-08`; `US-PAY-01`; `JOB-07`, `JOB-08`, `JOB-10`; `IDX-10`, `IDX-11`, `IDX-12` | NOT STARTED |
| `[ ]` | **RSK-05** | **Refund and chargeback abuse.** P3 × I4 = **12**. *Mitigation:* policy stored per order (`BR-REF-02`); usage-aware refund rules (`BR-REF-06`); rolling reserve; evidence pack auto-assembled for disputes. *Owner:* Finance. | — | `refunds/` · `settlements/` | A10 | `E2E-07`; `FR-RFND-02`, `FR-RFND-09`; `FR-SETL-04`; `KPI-20`, `KPI-21` | NOT STARTED |
| `[ ]` | **RSK-06** | **Gym closes with prepaid members.** P3 × I5 = **15**. *Mitigation:* reserve and hold period; `BR-REF-07` pro-rata refund; closure detection through check-in drop-off alerts. *Owner:* Finance. | — | `refunds/` · `settlements/` · `attendance/` | A10 | `BR-REF-07`; `BR-MEM-14`; §A6.4 hold period (14 days) and reserve; `NFR-MNT-06` alerting | NOT STARTED |
| `[ ]` | **RSK-07** | **Gym disintermediates the marketplace ("pay me directly").** P4 × I4 = **16**. *Mitigation:* 30-day attribution window with server-side event log; commercial terms in the tenant agreement; renewal rate step-down so the gym keeps more over time; marketplace-only coupons. *Owner:* Commercial. | — | `ordering/` · `settlements/` | A10 | §A6.3 attribution; `memberships.attributed_at`; `tenants.renewal_commission_rate_bps`; `KPI-17` | NOT STARTED |
| `[ ]` | **RSK-08** | **Cross-tenant data leakage.** P2 × I5 = **10**. *Mitigation:* row-level security in the database, not only in application code; tenant-scoped repository layer; automated multi-tenant isolation test suite in CI; penetration test before launch. *Owner:* Engineering. | — | `tenancy/` | A10 | Isolation suite; `E2E-11`; `BAC-10`; `NFR-SEC-09`; `NFR-SEC-04` penetration test | NOT STARTED |
| `[ ]` | **RSK-09** | **Poor gym-side adoption after signup (listed but not used).** P4 × I4 = **16**. *Mitigation:* guided onboarding with activation checklist; `KPI-02`/`KPI-05` monitored weekly; data import assistance; check-in as the daily habit hook. *Owner:* Product. | — | `onboarding/` · `crm/` · `attendance/` | A10 | `FR-ONB-14`, `FR-ONB-15`; `KPI-02`, `KPI-05`, `KPI-06`; `FNL-02` | NOT STARTED |
| `[ ]` | **RSK-10** | **Supply–demand imbalance at launch (gyms with no customers, or customers with no gyms).** P4 × I4 = **16**. *Mitigation:* city-by-city launch; do not open consumer marketing in a city below a minimum verified gym density. *Owner:* Commercial. | — | commercial · `reporting/` | A10 | §C9.4 launch gates (≥25 verified gyms, ≥5 localities, ≥90% complete profiles, SLA met 2 weeks, one clean settlement cycle); platform report *City performance* | NOT STARTED |
| `[ ]` | **RSK-11** | **Price/stale listing mismatch damaging trust.** P3 × I4 = **12**. *Mitigation:* `BR-PLN-03` server-side re-validation; listing freshness score; automatic delisting of gyms with stale data beyond a threshold. *Owner:* Product. | — | `plans/` · `catalog/` · `discovery/` | A10 | `AC-PLAN-02.1`, `AC-PLAN-02.2`; `FR-GYM-12`; `JOB-14`; `PRIN-02` | NOT STARTED |
| `[ ]` | **RSK-12** | **Notification cost escalating beyond unit economics.** P3 × I3 = **9**. *Mitigation:* channel preference by cost; email-first for non-urgent; batching; per-tenant caps. *Owner:* Finance. | — | `notifications/` | A10 | `FR-NOTF-06`, `FR-NOTF-08`; `OQ-13`; §A6.5 unit economics | NOT STARTED |
| `[ ]` | **RSK-13** | **Regulatory change in payments or data protection.** P2 × I4 = **8**. *Mitigation:* provider abstraction; data residency configurable; legal review before each market entry. *Owner:* Legal. | — | `payments/` · platform ops | A10 | `FR-PAY-01` port abstraction; `NFR-PRV-05`; `OQ-16`; `DEP-01` | NOT STARTED |
| `[ ]` | **RSK-14** | **Key-person dependency in the delivery team.** P3 × I3 = **9**. *Mitigation:* documentation-first culture; this document as the baseline; pair coverage on payments and tenancy. *Owner:* Delivery. | — | delivery | A10 | `NFR-MNT-09` runbooks; `/docs/` completeness gates in `/docs/PHASES.md`; `NFR-MNT-01` ≥95% coverage on payments and tenancy | NOT STARTED |
| `[ ]` | **RSK-15** | **Scope creep between sign-off and delivery.** P4 × I3 = **12**. *Mitigation:* change request process (Part C §C10); this document as the contractual baseline. *Owner:* Delivery. | — | delivery | A10 | §C10 change control operating; §C10 *Freeze* rule from the start of UAT; this checklist as the scope register | NOT STARTED |

### 18.2 Open Questions — `OQ-01` … `OQ-20` (§C11)

**A row is ticked when the client decision is recorded** — in `/docs/DECISION_LOG.md`, with a date and
an approver. The stated default is applied if no decision is recorded by the date the answer is
needed; applying a default is itself a decision and must be recorded the same way.

| `[ ]` | ID | Requirement (question · stated default · needed by) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **OQ-01** | **Which launch country and city?** *Default:* determines tax profile, KYC checklist, gateway and SMS provider. **Blocking.** *Needed by:* Sprint 0. | — | `admin/` · `billing/` · `onboarding/` | C11 | Decision recorded in `/docs/DECISION_LOG.md`; unblocks `A-19` (email/SMS/push vendors); `REF-01`, `REF-07`, `REF-08` seeded | NOT STARTED |
| `[ ]` | **OQ-02** | **Standard commission rate, and the reduced renewal rate?** *Default:* 10% standard, 5% renewal. *Needed by:* Sprint 5. | — | `settlements/` · `admin/` | C11 | Decision recorded; `FR-ADMN-03`; `tenants.commission_rate_bps`, `renewal_commission_rate_bps`; `KPI-16` | NOT STARTED |
| `[ ]` | **OQ-03** | **Subscription tier prices?** *Default:* reference tiers in §A6.2, priced at client instruction. *Needed by:* Sprint 5. | — | `billing/` · `admin/` | C11 | Decision recorded; `REF-06`; `FR-ADMN-04`; `KPI-18` | NOT STARTED |
| `[ ]` | **OQ-04** | **Settlement cycle and reserve?** *Default:* T+7, 5% reserve released at 30 days. *Needed by:* Sprint 11. | — | `settlements/` | C11 | Decision recorded; `tenants.settlement_cycle_days`, `reserve_bps`; `FR-SETL-04`; `JOB-11` | NOT STARTED |
| `[ ]` | **OQ-05** | **Platform-level minimum refund policy, or entirely tenant-defined?** *Default:* tenant-defined with a platform-mandated minimum 7-day no-visit cooling-off. *Needed by:* Sprint 12. | — | `refunds/` | C11 | Decision recorded; `BR-REF-01`, `BR-REF-03`; `AC-RFND-01.1`; `RC-32` | NOT STARTED |
| `[ ]` | **OQ-06** | **Is membership freeze available at launch?** *Default:* yes, plan-configurable, default off. *Needed by:* Sprint 7. | — | `memberships/` | C11 | Decision recorded; `BR-MEM-05`; `FR-MEMB-04`; `plans.freeze_allowed`; `E2E-05` | NOT STARTED |
| `[ ]` | **OQ-07** | **Auto-renewal at launch?** *Default:* yes, opt-in, off by default. *Needed by:* Sprint 7. | — | `memberships/` · `payments/` | C11 | Decision recorded; `BR-MEM-10`; `FR-MEMB-08`; `FR-PAY-11`; `JOB-05` | NOT STARTED |
| `[ ]` | **OQ-08** | **Check-in cooldown duration?** *Default:* 60 minutes. *Needed by:* Sprint 8. | — | `attendance/` | C11 | Decision recorded; `BR-CHK-04`; `RC-11`; `SCR-DASH-022` check-in configuration | NOT STARTED |
| `[ ]` | **OQ-09** | **May staff override any denial, or only specific reasons?** *Default:* all denials overridable with a reason; overrides reported weekly to the owner. *Needed by:* Sprint 8. | — | `attendance/` | C11 | Decision recorded; `FR-CHK-08`; `RCT-05`; tenant report *Staff activity* | NOT STARTED |
| `[ ]` | **OQ-10** | **Minimum reviews before a numeric rating is displayed?** *Default:* 3. *Needed by:* Sprint 10. | — | `reviews/` | C11 | Decision recorded; `BR-REV-07`; `AC-DETL-02.1`; `FR-REV-08` | NOT STARTED |
| `[ ]` | **OQ-11** | **Are gym-funded and platform-funded coupons both needed at launch?** *Default:* yes, both; the distinction is structural and expensive to retrofit. *Needed by:* Sprint 10. | — | `ordering/` · `settlements/` | C11 | Decision recorded; `BR-CPN-01`, `BR-CPN-05`; `AC-CPN-01.4`; §A6.3 commission base | NOT STARTED |
| `[ ]` | **OQ-12** | **Featured listings at launch?** *Default:* yes, as a manually-sold placement with an automated slot. *Needed by:* Sprint 3. | — | `discovery/` | C11 | Decision recorded; `FR-SRCH-11`; `gyms.featured_until`; §A6.1 revenue stream 3 | NOT STARTED |
| `[ ]` | **OQ-13** | **Is SMS mandatory, or is email-only acceptable for cost control?** *Default:* SMS for OTP and expiry, email for everything else. *Needed by:* Sprint 14. | — | `notifications/` | C11 | Decision recorded; `DEP-03`; `RSK-12`; §B5.19 notification catalogue channel columns | NOT STARTED |
| `[ ]` | **OQ-14** | **Trial or day-pass plans supported at launch?** *Default:* yes, as a session-type plan with a session count of 1. *Needed by:* Sprint 3. | — | `plans/` | C11 | Decision recorded; `FR-PLAN-01` (`SESSION` type); `FR-SRCH-03` *trial available* filter; `RC-55 TRIAL_VISIT` | NOT STARTED |
| `[ ]` | **OQ-15** | **Is a trainer module needed in Phase 1 beyond staff role and assignment?** *Default:* no; assignment only, sessions deferred. *Needed by:* Sprint 9. | — | `staff/` | C11 | Decision recorded; `FR-STAF-07`; `/trainers/sessions` stubbed surface | NOT STARTED |
| `[ ]` | **OQ-16** | **Data residency requirement?** *Default:* provider default region for the launch country. *Needed by:* Sprint 0. | — | platform ops | C11 | Decision recorded; `NFR-PRV-05`; `RSK-13` | NOT STARTED |
| `[ ]` | **OQ-17** | **Brand, domain and legal copy owner and delivery date?** *Default:* client-supplied by sprint 14. *Needed by:* Sprint 14. | — | `web` · platform ops | C11 | Decision recorded; `ASM-05`; `NFR-PRV-06`; `/legal/terms`, `/legal/privacy`, `/legal/refunds` | NOT STARTED |
| `[ ]` | **OQ-18** | **Year-1 gym and member targets for capacity planning?** *Default:* `KPI-01` and `KPI-08` figures. *Needed by:* Sprint 0. | — | platform ops | C11 | Decision recorded; `NFR-SCAL-01`; `KPI-01` (500 gyms), `KPI-08` (25,000 memberships) | NOT STARTED |
| `[ ]` | **OQ-19** | **Support hours and staffing model?** *Default:* business hours, email and in-app, 4-hour first response. *Needed by:* Sprint 14. | — | `support/` | C11 | Decision recorded; `KPI-25`; `FR-SUP-05` SLA timers | NOT STARTED |
| `[ ]` | **OQ-20** | **Does the client require an on-premise or private-cloud deployment?** *Default:* managed cloud. *Needed by:* Sprint 0. | — | platform ops | C11 | Decision recorded; §C1.1 *Infrastructure*; `NFR-MNT-08`; `CON-05` | NOT STARTED |

### 18.3 Assumptions — `ASM-01` … `ASM-07` (§A9.1)

**A row is ticked when the assumption is validated in the live environment** — not when it is merely
stated. Each carries the PRD's own statement of what happens if it turns out false.

| `[ ]` | ID | Requirement (assumption · if false) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **ASM-01** | Gym staff have a smartphone or tablet with a camera and network access at the front desk. *If false:* check-in requires dedicated hardware; scope and cost increase. | — | `attendance/` · `dash` | A9.1 | Validated in `UAT-02` on the client's own devices; `FR-CHK-03`; `NFR-USE-09` | NOT STARTED |
| `[ ]` | **ASM-02** | Target members have a smartphone with a browser and can receive SMS or email. *If false:* notification and QR strategy require rethinking. | — | `web` · `notifications/` | A9.1 | Validated in `UAT-03`; `FR-CHK-01`; `FR-NOTF-01`; `AC-AUTH-01.5` fallback | NOT STARTED |
| `[ ]` | **ASM-03** | A payment gateway supporting split settlement is available in each launch market. *If false:* the platform must operate a manual payout process; Finance headcount increases. | — | `payments/` | A9.1 | Validated at `OQ-01`; `DEP-01`; `FR-PAY-10` (both branches implemented) | NOT STARTED |
| `[ ]` | **ASM-04** | Gyms are willing to publish real prices publicly. *If false:* the core marketplace value proposition weakens; a "request price" fallback becomes necessary. | — | `plans/` · `discovery/` | A9.1 | Validated in `UAT-01` and pilot cohort; `PRIN-02`; `KPI-02` | NOT STARTED |
| `[ ]` | **ASM-05** | The client provides brand assets, legal copy (terms, privacy, refund policy) and tax rules before UAT. *If false:* launch slips. | — | `web` · `billing/` | A9.1 | Tracked to `OQ-17`; `NFR-PRV-06`; §C9.2 milestone M7 | NOT STARTED |
| `[ ]` | **ASM-06** | Connectivity at gym premises is adequate for real-time check-in. *If false:* offline check-in moves from Phase 2 to Phase 1. | — | `attendance/` | A9.1 | Validated in `UAT-02`; `SCR-DASH-009-X` (no false success offline); §A4.2 *Offline-first check-in* deferral | NOT STARTED |
| `[ ]` | **ASM-07** | Initial launch is single-language. *If false:* translation infrastructure and content operations are needed at launch. | — | all surfaces | A9.1 | `NFR-USE-08` (strings externalised from the first commit regardless); §A4.2 *Multi-language UI* | NOT STARTED |

### 18.4 Constraints — `CON-01` … `CON-05` (§A9.2)

**A row is ticked when the constraint is respected and enforced** — a constraint is honoured, not
delivered.

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **CON-01** | Phase 1 is web-only, mobile-responsive. No app store distribution. | — | all surfaces | A9.2 | `NFR-USE-07` (320–2560 px, no horizontal scrolling); §A4.2 *Native iOS/Android apps* deferred; no app-store artefact exists | NOT STARTED |
| `[ ]` | **CON-02** | Third-party rate limits (maps, geocoding, SMS) bound search and notification throughput and must be cached and budgeted. | — | `discovery/` · `notifications/` | A9.2 | Integration (cache-hit assertions and budget alarms); `DEP-02`, `DEP-03`; `NFR-SCAL-04`; `RSK-12` | NOT STARTED |
| `[ ]` | **CON-03** | Payment behaviour, refund timing and dispute windows are dictated by the gateway and card networks, not by this platform. | — | `payments/` · `refunds/` | A9.2 | Integration (deadlines sourced from the provider, never hardcoded); `DEP-01`; `BR-REF-08` evidence deadline | NOT STARTED |
| `[ ]` | **CON-04** | Financial and invoice records are subject to statutory retention and cannot be deleted on user request. | — | `billing/` · `iam/` | A9.2 | Integration (deletion request retains de-identified financial records); `BR-DAT-04`; `BR-TEN-04`; `NFR-PRV-04`; `AC-USER-02.1` | NOT STARTED |
| `[ ]` | **CON-05** | The platform must operate within the client's stated infrastructure budget; architecture decisions in Part C reflect this. | — | platform ops | A9.2 | Cost model reviewed against §A6.5 unit economics; §C1.1 *no search cluster before the data justifies it*; `OQ-20` | NOT STARTED |

### 18.5 External Dependencies — `DEP-01` … `DEP-08` (§A9.3)

**A row is ticked when the dependency is integrated *and* its stated failure mode and mitigation are
implemented and tested.** An integration without its fallback is half-done.

| `[ ]` | ID | Requirement (dependency · type · criticality · failure mode and mitigation) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **DEP-01** | **Payment gateway with split settlement.** Mandatory · Critical. *Failure:* no sales. *Mitigation:* provider abstraction, second adapter ready, offline sale recording continues. | — | `payments/` | A9.3 | Integration (fault injection: offline sales still recordable); `FR-PAY-01`; `ASM-03`; `NFR-AVL-07` | NOT STARTED |
| `[ ]` | **DEP-02** | **Maps and geocoding.** Mandatory · High. *Failure:* map view degrades to list view; cached geocodes serve existing listings. | — | `discovery/` | A9.3 | Integration (fault injection); `AC-SRCH-02.3`; `NFR-AVL-03`; `CON-02` caching | NOT STARTED |
| `[ ]` | **DEP-03** | **SMS / OTP provider.** Mandatory · High. *Failure:* fall back to email OTP; queue and retry. | — | `notifications/` · `iam/` | A9.3 | Integration (fault injection); `AC-AUTH-01.5`; `FR-NOTF-04`; vendor pending `A-19` (blocked on `OQ-01`) | NOT STARTED |
| `[ ]` | **DEP-04** | **Transactional email.** Mandatory · High. *Failure:* queue and retry; the in-app notification centre carries the message meanwhile. | — | `notifications/` | A9.3 | Integration (fault injection); `FR-NOTF-04`, `FR-NOTF-07`; vendor pending `A-19` | NOT STARTED |
| `[ ]` | **DEP-05** | **Object storage / CDN.** Mandatory · High. *Failure:* images degrade to placeholders; uploads queue. | — | `catalog/` · `billing/` | A9.3 | Integration (fault injection); `SCR-WEB-003-X`; S3-compatible + CDN per §C1.1; SDK pending `A-18` | NOT STARTED |
| `[ ]` | **DEP-06** | **Push notification service.** Optional P1 · Low. *Failure:* email substitution. | — | `notifications/` | A9.3 | Integration (fault injection → email path); `FR-NOTF-01`; vendor pending `A-19` | NOT STARTED |
| `[ ]` | **DEP-07** | **Error tracking and APM.** Mandatory (ops) · Medium. *Failure:* operational blindness; local logging retained. | — | platform ops | A9.3 | Integration (local structured logs retained when the vendor is unreachable); `NFR-MNT-04`; vendor pending `A-15` | NOT STARTED |
| `[ ]` | **DEP-08** | **KYC/document verification vendor.** Optional · Medium. *Failure:* manual review only; throughput limited. | — | `onboarding/` | A9.3 | Integration (manual review path complete without the vendor); `BR-GYM-03`; `FR-ADMN-11` workload distribution | NOT STARTED |

---

## 19. Acceptance — `BAC-01` … `BAC-15`, `E2E-01` … `E2E-12`, `UAT-01` … `UAT-06`

### 19.1 Business Acceptance Criteria — `BAC-01` … `BAC-15` (§A12)

**Phase 1 is accepted when all fifteen are demonstrably true in the production environment.** All
fifteen are launch-blocking by definition and are counted in the §2.3 subtotal.

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **BAC-01** | A gym owner can complete signup, KYC submission, gym setup and plan creation unaided, and reach "submitted for review" in a single session. | M | `onboarding/` · `dash` | A12 | `E2E-01`; `UAT-01`; production demonstration | NOT STARTED |
| `[ ]` | **BAC-02** | A verification officer can review, approve or reject a gym with structured reasons, and the outcome is reflected in marketplace visibility within 60 seconds. | M | `onboarding/` · `admin/` · `discovery/` | A12 | `E2E-01` (timed); `UAT-04`; `FR-ONB-13`; `BR-GYM-04` | NOT STARTED |
| `[ ]` | **BAC-03** | A consumer can find a gym by location, filter results, compare gyms, view real plans and prices, and purchase a membership online end to end. | M | `discovery/` · `ordering/` · `payments/` | A12 | `E2E-02`; `UAT-03`; production demonstration | NOT STARTED |
| `[ ]` | **BAC-04** | Payment capture activates the membership, issues a compliant invoice, and provisions a QR credential without manual intervention. | M | `payments/` · `memberships/` · `billing/` · `attendance/` | A12 | `E2E-02`; `BR-PAY-02`; `FR-INV-01`; `FR-CHK-01` | NOT STARTED |
| `[ ]` | **BAC-05** | A member can check in by QR, and the visit appears in both the member's history and the gym's attendance report immediately. | M | `attendance/` | A12 | `E2E-03`; `UAT-02`; `FR-CHK-10`, `FR-CHK-11`; `NFR-PERF-03` | NOT STARTED |
| `[ ]` | **BAC-06** | Every rule in §A8 has at least one passing automated test, and every M-priority rule has a test that also proves the negative case. | M | all modules | A12 | Coverage report over all 95 `BR-` rows in §7 above; 82 negative-case tests for the `M` rules | NOT STARTED |
| `[ ]` | **BAC-07** | A settlement run produces, for a period with mixed online sales, offline sales, coupons and one refund, a statement that Finance reconciles to zero variance against the gateway report. | M | `settlements/` · `ledger/` | A12 | `E2E-12`; `UAT-05`; `JOB-10`; `KPI-26`; `BR-FIN-03`, `BR-FIN-07` | NOT STARTED |
| `[ ]` | **BAC-08** | A refund flows from request through approval to gateway execution, credit note and ledger reversal, with the gym's next payout correctly reduced. | M | `refunds/` · `billing/` · `ledger/` · `settlements/` | A12 | `E2E-07`; `UAT-05`; `FR-RFND-07`; `FR-SETL-03` | NOT STARTED |
| `[ ]` | **BAC-09** | Only a member with a recorded check-in can publish a review, verified by attempting the negative case. | M | `reviews/` · `attendance/` | A12 | `E2E-09`; `AC-REV-02.1` (403 on direct API call); `BR-REV-01`; `PRIN-05` | NOT STARTED |
| `[ ]` | **BAC-10** | An automated isolation test suite proves that a user of tenant A cannot read or write any record of tenant B through any exposed endpoint. | M | `tenancy/` | A12 | Isolation suite over 100% of tenant-scoped endpoints; `E2E-11`; `NFR-SEC-09`; `BR-TEN-01` | NOT STARTED |
| `[ ]` | **BAC-11** | The platform meets `NFR-PERF-01` through `NFR-PERF-05` under the specified load profile. | M | platform-wide | A12 | Performance suite against the `NFR-SCAL-01` load profile; sprint 16 sign-off; milestone M6 | NOT STARTED |
| `[ ]` | **BAC-12** | A tenant can export members, memberships, payments and attendance without support involvement. | M | `reporting/` | A12 | Integration + E2E over all four entities; `BR-DAT-05`; `PRIN-01`; `API-TEN-55` | NOT STARTED |
| `[ ]` | **BAC-13** | Audit logs exist for every rule in §A8.10 and are queryable by entity and by actor. | M | `audit/` | A12 | Integration over `BR-DAT-01` … `BR-DAT-07`; `AC-ADMN-02.1`; `IDX-16`, `IDX-17` | NOT STARTED |
| `[ ]` | **BAC-14** | All M-priority functional requirements in Part B are delivered, and no M-priority defect (Severity 1 or 2) is open. | M | all modules | A12 | All 182 `M`-priority `FR-` rows in §8 ticked; defect board shows zero open S1/S2 per §C8.5 | NOT STARTED |
| `[ ]` | **BAC-15** | UAT sign-off is recorded from the client sponsor against the scripts in Part C §C8.4. | M | delivery | A12 | `UAT-01` … `UAT-06` complete; §C8.4 exit criteria met; signature recorded in the Approval Matrix | NOT STARTED |

### 19.2 Critical End-to-End Journeys — `E2E-01` … `E2E-12` (§C8.3)

Each journey runs against the §C8.2 deterministic seed — 3 tenants (one single-branch, one
multi-branch, one suspended), 12 plans across both plan types, 200 members in mixed states, 5,000
attendance records, orders in every status, one duplicate payment, one partial refund, one chargeback,
and reviews at every moderation state — **without additional setup**. E2E runner pending `A-06`.

| `[ ]` | ID | Requirement (journey · covers) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **E2E-01** | Owner signs up → KYC → gym → plan → payout → submit → admin approves → listing live. *Covers:* ONB, GYM, PLAN, ADMN. | — | `onboarding/` · `catalog/` · `plans/` · `admin/` | C8.3 | Sprint 1–2 exit condition; `BAC-01`, `BAC-02`; `SM-04` | NOT STARTED |
| `[ ]` | **E2E-02** | Visitor searches → filters → compares → views detail → registers → buys → membership active → invoice issued. *Covers:* SRCH, DETL, CART, PAY, INV, MEMB. | — | `discovery/` · `ordering/` · `payments/` · `billing/` · `memberships/` | C8.3 | Sprint 5–6 exit condition; `BAC-03`, `BAC-04` | NOT STARTED |
| `[ ]` | **E2E-03** | Member generates QR → staff scans → attendance recorded → appears in both views. *Covers:* CHK, MEMB. | — | `attendance/` · `memberships/` | C8.3 | Sprint 8 exit condition; `BAC-05`; `FR-MEMB-12` | NOT STARTED |
| `[ ]` | **E2E-04** | Expired membership scanned → denial with reason → staff renews from the denial screen → immediate re-scan succeeds. *Covers:* CHK, MEMB, CART. | — | `attendance/` · `memberships/` · `ordering/` | C8.3 | Sprint 8 exit condition; `AC-CHK-01.2`; `RC-01`; `SMT-11` | NOT STARTED |
| `[ ]` | **E2E-05** | Member freezes → check-in denied → unfreezes early → end date recalculated → check-in succeeds. *Covers:* MEMB, CHK. | — | `memberships/` · `attendance/` | C8.3 | Sprint 7 exit condition; `US-MEMB-01`; `SMT-05`, `SMT-06`; `RC-02` | NOT STARTED |
| `[ ]` | **E2E-06** | Coupon applied → price re-validated → payment → commission computed on the correct base → settlement statement ties out. *Covers:* CPN, CART, PAY, SETL. | — | `ordering/` · `payments/` · `settlements/` | C8.3 | `AC-CPN-01.4`; `BR-CPN-05`; `BR-FIN-04`; §A6.3 worked example | NOT STARTED |
| `[ ]` | **E2E-07** | Refund requested within window → auto-approved → gateway refund → credit note → membership refunded → QR revoked → tenant balance reduced. *Covers:* RFND, INV, MEMB, SETL. | — | `refunds/` · `billing/` · `memberships/` · `settlements/` | C8.3 | Sprint 12 exit condition; `BAC-08`; `SM-05`; `AC-RFND-01.1`, `AC-RFND-01.3` | NOT STARTED |
| `[ ]` | **E2E-08** | Duplicate payment submitted → single membership created → duplicate auto-refunded → both visible in settlement, netting to zero. *Covers:* PAY, SETL. | — | `payments/` · `settlements/` | C8.3 | Sprint 12 exit condition; `US-PAY-01`; `BR-PAY-03`, `BR-PAY-07`; `JOB-08` | NOT STARTED |
| `[ ]` | **E2E-09** | Member with a check-in writes a review → published → gym responds → gym cannot delete → gym reports → moderator unpublishes → rating recalculates. *Covers:* REV, ADMN. | — | `reviews/` · `admin/` | C8.3 | Sprint 10 exit condition; `BAC-09`; `AC-REV-01.2`; `SM-06`; `AC-REV-02.3` | NOT STARTED |
| `[ ]` | **E2E-10** | Receptionist records an offline sale with partial payment → balance due shown → balance collected → single consolidated invoice. *Covers:* CART, INV, STAF. | — | `ordering/` · `billing/` · `staff/` | C8.3 | Sprint 9 exit condition; `US-CART-02`; `BR-PAY-09`; `SMT-15`, `SMT-16` | NOT STARTED |
| `[ ]` | **E2E-11** | Tenant A user attempts to read tenant B members, orders, reports and exports by direct API call → all refused. *Covers:* Tenancy. | — | `tenancy/` | C8.3 | Sprint 0 exit condition (proven on a trivial endpoint, then extended); `BAC-10`; `BR-TEN-01`; `NFR-SEC-09` | NOT STARTED |
| `[ ]` | **E2E-12** | Settlement cycle with mixed online sales, offline sales, a coupon, a refund and a reserve → statement reconciles to zero variance. *Covers:* SETL, LEDGER. | — | `settlements/` · `ledger/` | C8.3 | Sprint 11 exit condition (zero variance); `BAC-07`; `KPI-26`; `BR-FIN-03` | NOT STARTED |

### 19.3 UAT Scripts — `UAT-01` … `UAT-06` (§C8.4)

UAT runs on **staging** with the client's own people in each role, scripted by **persona** rather than
by module, because that is how defects in hand-offs surface. **Exit criteria:** every script
completed; zero Severity-1 or Severity-2 defects open; all Severity-3 defects triaged with an agreed
disposition; sign-off recorded per the approval matrix.

| `[ ]` | ID | Requirement (script · persona · duration) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **UAT-01** | **Gym owner: signup to first sale.** 90 min. | — | `onboarding/` · `plans/` · `ordering/` | C8.4 | Script completed on staging with the client's own owner persona; `BAC-01`; `E2E-01` | NOT STARTED |
| `[ ]` | **UAT-02** | **Receptionist: a simulated peak hour** — 20 check-ins including 3 denials, 2 walk-in sales, 1 balance collection. 60 min. | — | `attendance/` · `ordering/` · `staff/` | C8.4 | Script completed; `BAC-05`; `NFR-PERF-03`, `NFR-USE-09`; `ASM-01`, `ASM-06` | NOT STARTED |
| `[ ]` | **UAT-03** | **Member: discover, buy, check in, freeze, renew, review, refund.** 90 min. | — | `discovery/` · `ordering/` · `attendance/` · `memberships/` · `reviews/` · `refunds/` | C8.4 | Script completed; `BAC-03`, `BAC-09`; `E2E-02`, `E2E-05`, `E2E-07` | NOT STARTED |
| `[ ]` | **UAT-04** | **Verification officer: 10 applications including 3 rejections and 2 information requests.** 60 min. | — | `onboarding/` · `admin/` | C8.4 | Script completed; `BAC-02`; `RCT-02`; `SMT-33`, `SMT-34`, `SMT-35` | NOT STARTED |
| `[ ]` | **UAT-05** | **Finance: a full settlement cycle with refund and dispute.** 120 min. | — | `settlements/` · `refunds/` · `ledger/` | C8.4 | Script completed; `BAC-07`, `BAC-08`; `E2E-07`, `E2E-12`; `US-RFND-02` | NOT STARTED |
| `[ ]` | **UAT-06** | **Super admin: tenant suspension, commission override, moderation, audit reconstruction.** 60 min. | — | `admin/` · `tenancy/` · `reviews/` · `audit/` | C8.4 | Script completed; `BAC-13`; `US-ADMN-01`, `US-ADMN-02`; `OBJ-10` | NOT STARTED |

---

## 20. Additional enumerated PRD inventories

The PRD contains several exhaustively-enumerated inventories that carry no `XXX-` prefix in the
source. They are enumerated here with locally-assigned identifiers so that nothing in the document
is lost, and so the §21 attestation can be honest. Identifiers are assigned in source order and are
stable from this point.

### 20.1 Module inventory (§B1.3) — `MOD-01` … `MOD-24`

The PRD gives each module a priority. That priority is an **aggregate** of its constituent `FR-`
rows, so these 24 rows are deliberately **excluded from the §2.2 MoSCoW split** to avoid counting the
same requirement twice. A module row is ticked when every `FR-` row in its family is ticked.

| `[ ]` | ID | Requirement (# · module · code · surfaces · priority) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **MOD-01** | 1 · **Authentication & Identity** · `AUTH` · web, dash, admin. | M † | `iam/` | B1.3 | All 14 `FR-AUTH-` rows ticked; `US-AUTH-01` … `US-AUTH-03` | NOT STARTED |
| `[ ]` | **MOD-02** | 2 · **User Profile & Account** · `USER` · web, dash. | M † | `iam/` | B1.3 | All 8 `FR-USER-` rows ticked; `US-USER-01`, `US-USER-02` | NOT STARTED |
| `[ ]` | **MOD-03** | 3 · **Tenant Onboarding & KYC** · `ONB` · dash, admin. | M † | `onboarding/` | B1.3 | All 15 `FR-ONB-` rows ticked; `E2E-01` | NOT STARTED |
| `[ ]` | **MOD-04** | 4 · **Gym & Branch Management** · `GYM` · dash, admin. | M † | `catalog/` | B1.3 | All 12 `FR-GYM-` rows ticked; `US-GYM-01`, `US-GYM-02` | NOT STARTED |
| `[ ]` | **MOD-05** | 5 · **Membership Plan Catalogue** · `PLAN` · dash, web. | M † | `plans/` | B1.3 | All 9 `FR-PLAN-` rows ticked; `US-PLAN-01`, `US-PLAN-02` | NOT STARTED |
| `[ ]` | **MOD-06** | 6 · **Marketplace Search & Discovery** · `SRCH` · web. | M † | `discovery/` | B1.3 | All 15 `FR-SRCH-` rows ticked; `NFR-PERF-01` | NOT STARTED |
| `[ ]` | **MOD-07** | 7 · **Gym Detail & Comparison** · `DETL` · web. | M † | `discovery/` | B1.3 | All 11 `FR-DETL-` rows ticked; `US-DETL-01`, `US-DETL-02` | NOT STARTED |
| `[ ]` | **MOD-08** | 8 · **Favourites & Saved Searches** · `FAV` · web. | S † | `discovery/` | B1.3 | All 5 `FR-FAV-` rows ticked; `US-FAV-01` | NOT STARTED |
| `[ ]` | **MOD-09** | 9 · **Checkout & Orders** · `CART` · web, dash. | M † | `ordering/` | B1.3 | All 11 `FR-CART-` rows ticked; `E2E-02`, `E2E-10` | NOT STARTED |
| `[ ]` | **MOD-10** | 10 · **Payments & Gateway** · `PAY` · web, dash, admin. | M † | `payments/` | B1.3 | All 12 `FR-PAY-` rows ticked; `E2E-08` | NOT STARTED |
| `[ ]` | **MOD-11** | 11 · **Invoicing & Tax** · `INV` · web, dash, admin. | M † | `billing/` | B1.3 | All 11 `FR-INV-` rows ticked; `US-INV-01` | NOT STARTED |
| `[ ]` | **MOD-12** | 12 · **Membership Lifecycle** · `MEMB` · web, dash. | M † | `memberships/` | B1.3 | All 12 `FR-MEMB-` rows ticked; `E2E-05`; `SM-01` | NOT STARTED |
| `[ ]` | **MOD-13** | 13 · **QR Check-in & Attendance** · `CHK` · web, dash. | M † | `attendance/` | B1.3 | All 14 `FR-CHK-` rows ticked; `E2E-03`, `E2E-04` | NOT STARTED |
| `[ ]` | **MOD-14** | 14 · **Member CRM** · `CRM` · dash. | M † | `crm/` | B1.3 | All 10 `FR-CRM-` rows ticked; `US-CRM-01` | NOT STARTED |
| `[ ]` | **MOD-15** | 15 · **Staff, Roles & Permissions** · `STAF` · dash, admin. | M † | `staff/` | B1.3 | All 9 `FR-STAF-` rows ticked; `US-STAF-01` | NOT STARTED |
| `[ ]` | **MOD-16** | 16 · **Reviews & Ratings** · `REV` · web, dash, admin. | M † | `reviews/` | B1.3 | All 11 `FR-REV-` rows ticked; `E2E-09` | NOT STARTED |
| `[ ]` | **MOD-17** | 17 · **Coupons & Promotions** · `CPN` · dash, admin. | S † | `ordering/` | B1.3 | All 8 `FR-CPN-` rows ticked; `E2E-06` | NOT STARTED |
| `[ ]` | **MOD-18** | 18 · **Referrals & Wallet** · `REFR` · web, dash. | S / C † | `crm/` · `ledger/` | B1.3 | All 7 `FR-REFR-` rows ticked; `US-REFR-01` | NOT STARTED |
| `[ ]` | **MOD-19** | 19 · **Notifications** · `NOTF` · all surfaces. | M † | `notifications/` | B1.3 | All 8 `FR-NOTF-` rows and all 24 `NOTIF-` catalogue rows ticked | NOT STARTED |
| `[ ]` | **MOD-20** | 20 · **Reports & Analytics** · `RPT` · dash, admin. | M † | `reporting/` | B1.3 | All 5 `FR-RPT-` rows, 16 `RPT-T-` and 11 `RPT-P-` rows ticked | NOT STARTED |
| `[ ]` | **MOD-21** | 21 · **Settlements & Payouts** · `SETL` · dash, admin. | M † | `settlements/` | B1.3 | All 10 `FR-SETL-` rows ticked; `E2E-12` | NOT STARTED |
| `[ ]` | **MOD-22** | 22 · **Refunds & Disputes** · `RFND` · web, dash, admin. | M † | `refunds/` | B1.3 | All 11 `FR-RFND-` rows ticked; `E2E-07` | NOT STARTED |
| `[ ]` | **MOD-23** | 23 · **Support & Ticketing** · `SUP` · web, dash, admin. | S † | `support/` | B1.3 | All 7 `FR-SUP-` rows ticked; `UAT-06` | NOT STARTED |
| `[ ]` | **MOD-24** | 24 · **Platform Administration & Audit** · `ADMN` · admin. | M † | `admin/` · `audit/` | B1.3 | All 13 `FR-ADMN-` rows ticked; `BAC-13` | NOT STARTED |

> **†** Module priority is an aggregate of its constituent `FR-` rows and is **not** counted in the
> §2.2 MoSCoW split, to avoid double-counting. The 24 modules carry 20 `M`, 3 `S` and 1 `S / C` in the
> source. Separately, §C1.3 defines **23** backend module folders — `common/`, `tenancy/`, `iam/`,
> `onboarding/`, `catalog/`, `plans/`, `discovery/`, `ordering/`, `payments/`, `billing/`,
> `memberships/`, `attendance/`, `crm/`, `staff/`, `reviews/`, `ledger/`, `settlements/`, `refunds/`,
> `notifications/`, `reporting/`, `support/`, `admin/`, `audit/` — which are the values used in the
> **Module** column throughout this file. The 24 product modules and the 23 code folders are
> different groupings of the same domain and are not in conflict.

### 20.2 Business processes (§A7) — `PROC-01` … `PROC-05`

Each process is **normative**: the product must implement it as described.

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **PROC-01** | **Gym onboarding and verification.** Owner signs up → email + phone verification → business profile → KYC upload (per country checklist) → gym profile → bank/payout account with micro-deposit or gateway verification → submit for review → Verification Officer queue → APPROVED (tenant activated, plans publishable, listing live) or REJECTED (structured reasons returned, owner corrects and resubmits). *Governing rules:* `BR-GYM-01` … `BR-GYM-09`. | — | `onboarding/` | A7.1 | `E2E-01`; `UAT-01`, `UAT-04`; all nine `BR-GYM-` rows | NOT STARTED |
| `[ ]` | **PROC-02** | **Marketplace discovery to membership.** Consumer lands (location detected or entered) → search/browse → filter → results (list + map) → compare up to 4 → save favourites → gym detail → select plan → auth gate → checkout (start date, add-ons, coupon) with server-side price re-validation → payment → gateway → webhook confirmation → membership `ACTIVE` → invoice issued → QR provisioned → first check-in → attendance recorded → review eligibility unlocked → review submitted → rating updated → expiry approaching → renewal reminders → renewal. *Governing rules:* `BR-MEM-01` … `BR-MEM-14`, `BR-PAY-01` … `BR-PAY-11`, `BR-REV-01` … `BR-REV-07`. | — | `discovery/` · `ordering/` · `payments/` · `memberships/` · `reviews/` | A7.2 | `E2E-02`, `E2E-03`, `E2E-09`; `UAT-03`; all `BR-MEM-`, `BR-PAY-`, `BR-REV-` rows | NOT STARTED |
| `[ ]` | **PROC-03** | **Payment and settlement.** Customer confirms checkout → server creates ORDER (`PENDING`) with server-computed amounts (never trust client amounts) → payment intent created at gateway → customer authorises → webhook → `PAYMENT_CAPTURED` (order → `PAID`, membership activated idempotently, invoice generated with immutable sequential number, ledger entries written for gross/tax/commission/gateway fee/gym payable) or `PAYMENT_FAILED` (order → `FAILED`, retry offered with a new intent) → settlement batch (T+N) → payout instruction → statement issued. *Governing rules:* `BR-PAY-01` … `BR-PAY-11`, `BR-FIN-01` … `BR-FIN-08`. | — | `ordering/` · `payments/` · `billing/` · `ledger/` · `settlements/` | A7.3 | `E2E-02`, `E2E-06`, `E2E-12`; `UAT-05`; all `BR-PAY-`, `BR-FIN-` rows | NOT STARTED |
| `[ ]` | **PROC-04** | **Check-in.** Member opens membership → rotating QR token displayed (TTL 60 s) → gym scanner (web, camera) reads token → server validates signature, TTL, membership `ACTIVE`, gym/branch match, not already checked in within cooldown, within operating hours, entitlement not exhausted → **ALLOW** (attendance recorded, entitlement decremented, greeting shown, optional notification) or **DENY** (reason shown — expired / frozen / wrong branch / duplicate — with staff override available and logged with reason). *Governing rules:* `BR-CHK-01` … `BR-CHK-10`. | — | `attendance/` | A7.4 | `E2E-03`, `E2E-04`, `E2E-05`; `UAT-02`; all ten `BR-CHK-` rows; `RCT-01`, `RCT-05` | NOT STARTED |
| `[ ]` | **PROC-05** | **Refund and dispute.** Refund requested (member via support, or gym via dashboard) → eligibility evaluated against the refund policy (window, usage, plan type) → auto-approve if within policy, otherwise Super Admin review (outside policy / above threshold) → approved or rejected → gateway refund initiated → membership adjusted (cancel / prorate) → credit note issued (immutable) → ledger reversal entries written → gym balance debited at next settlement. *Governing rules:* `BR-REF-01` … `BR-REF-09`. | — | `refunds/` · `billing/` · `ledger/` · `settlements/` | A7.5 | `E2E-07`, `E2E-08`; `UAT-05`; all nine `BR-REF-` rows; `SM-05` | NOT STARTED |

### 20.3 Revenue streams (§A6.1) — `REVS-01` … `REVS-10`

| `[ ]` | ID | Requirement (# · stream · payer · basis · phase) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **REVS-01** | 1 · **SaaS subscription** · payer: Gym · basis: monthly or annual, tiered by branches, members and feature set · **Phase 1**. | — | `billing/` | A6.1 | `JOB-22 subscription.charge`; `BR-TEN-06`; `REF-06`; `KPI-15` | NOT STARTED |
| `[ ]` | **REVS-02** | 2 · **Marketplace commission** · payer: Gym · basis: % of each marketplace-originated membership sale, deducted at settlement · **Phase 1**. | — | `settlements/` | A6.1 | §A6.3 computation; `BR-FIN-04`, `BR-FIN-05`; `E2E-06`, `E2E-12`; `KPI-16` | NOT STARTED |
| `[ ]` | **REVS-03** | 3 · **Featured listing / promotion** · payer: Gym · basis: fixed fee for elevated placement in search and category pages · **Phase 1 (S)**. | — | `discovery/` · `billing/` | A6.1 | `FR-SRCH-11`; `gyms.featured_until`; `OQ-12` | NOT STARTED |
| `[ ]` | **REVS-04** | 4 · **Premium consumer plan** · payer: Member · basis: multi-gym access, priority booking · **Phase 2**. | — | — | A6.1 | Architecturally anticipated only; no Phase 1 build. Recorded so the design does not foreclose it | NOT STARTED |
| `[ ]` | **REVS-05** | 5 · **Corporate memberships** · payer: Employer · basis: negotiated bulk contract · **Phase 2**. | — | — | A6.1 | `corporate_account` entity reserved per §A4.2; no Phase 1 build | NOT STARTED |
| `[ ]` | **REVS-06** | 6 · **Trainer marketplace commission** · payer: Trainer / gym · basis: % of PT session value · **Phase 2**. | — | — | A6.1 | `staff` and `session` entities modelled per §A4.2; `OQ-15`; no Phase 1 build | NOT STARTED |
| `[ ]` | **REVS-07** | 7 · **Advertising** · payer: Third parties · basis: sponsored placements · **Phase 2**. | — | — | A6.1 | No Phase 1 build; `FR-SRCH-11` labelling precedent applies when built | NOT STARTED |
| `[ ]` | **REVS-08** | 8 · **Affiliate revenue** · payer: Third parties · basis: referral of supplements, apparel, insurance · **Phase 2**. | — | — | A6.1 | No Phase 1 build; §A11 *Nutrition and supplements* | NOT STARTED |
| `[ ]` | **REVS-09** | 9 · **Premium analytics add-on** · payer: Gym · basis: benchmarking against anonymised cohort · **Phase 2**. | — | — | A6.1 | No Phase 1 build; depends on `MOD-20` reporting foundation | NOT STARTED |
| `[ ]` | **REVS-10** | 10 · **Public API access** · payer: Partners · basis: metered · **Phase 2**. | — | — | A6.1 | No Phase 1 build; `NFR-MNT-02` versioning and `NFR-MNT-03` published OpenAPI are the prerequisites | NOT STARTED |

### 20.4 Subscription tiers (§A6.2) — `TIER-01` … `TIER-04`

Values are configurable; the tiers below are the reference model. Subscription is charged to the
tenant independently of the settlement flow — a failed subscription charge degrades the tenant
(`BR-TEN-06`) but never blocks member check-ins already paid for.

| `[ ]` | ID | Requirement (tier · branches · active members · staff seats · notable inclusions · commission) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **TIER-01** | **Starter** — 1 branch · up to 150 active members · 3 staff seats · plans, members, check-in, basic reports, marketplace listing · commission: **Standard**. | — | `billing/` | A6.2 | Integration (each cap enforced with a clear upgrade path); `FR-STAF-06`; `REF-06`; `OQ-03` | NOT STARTED |
| `[ ]` | **TIER-02** | **Growth** — up to 3 branches · up to 750 active members · 10 staff seats · **+** coupons, CRM/leads, advanced reports, custom branding on invoices · commission: **Standard − 2pp**. | — | `billing/` | A6.2 | Integration (caps + feature gating); `FR-INV-11`; `FR-ADMN-03`; `AC-ADMN-01.1` | NOT STARTED |
| `[ ]` | **TIER-03** | **Professional** — up to 10 branches · up to 3,000 active members · 40 staff seats · **+** multi-branch analytics, API access, priority support, featured listing credits · commission: **Standard − 4pp**. | — | `billing/` | A6.2 | Integration (caps + feature gating); `REVS-03`; `FR-ADMN-04` | NOT STARTED |
| `[ ]` | **TIER-04** | **Enterprise** — unlimited branches · unlimited active members · unlimited staff seats · **+** SSO, custom SLA, dedicated success manager, data residency options · commission: **Negotiated**. | — | `billing/` | A6.2 | Integration (uncapped path + per-tenant commission override); `NFR-PRV-05`; `FR-ADMN-03` | NOT STARTED |

### 20.5 Personas (§B2) — `PERS-01` … `PERS-05`

A persona row is ticked when its **design implications** — the concrete product constraints the PRD
derives from the persona — are all satisfied and demonstrated in UAT by a real person in that role.

| `[ ]` | ID | Requirement (persona · design implications) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **PERS-01** | **Rohan — the independent gym owner.** Two branches, ~400 members, three staff, formerly a trainer, wary of "software". *Design implications:* onboarding must yield visible value in the first session; the dashboard home must answer "what do I do today" in one screen; nothing critical may be more than two taps deep; export must be obvious, not hidden. | — | `dash` | B2.1 | `UAT-01`; `SCR-DASH-001`; `FR-ONB-14`; `BAC-01`, `BAC-12`; `PRIN-01` | NOT STARTED |
| `[ ]` | **PERS-02** | **Priya — the prospective member.** 27, budgeted a range, doesn't know what things cost, fears a sales pitch and a hidden joining fee. *Design implications:* price is never hidden behind a call-to-action; filters must include timings and gender policy, not just distance and price; reviews must be visibly earned; short-duration plans must be first-class, not an afterthought. | — | `web` | B2.2 | `UAT-03`; `US-SRCH-01`; `FR-SRCH-03`; `FR-DETL-02`; `PRIN-02`, `PRIN-05`; `OQ-14` | NOT STARTED |
| `[ ]` | **PERS-03** | **Sameer — the receptionist.** Front desk 12:00–21:00; check-ins, walk-ins, renewals and cash. *Design implications:* the check-in screen is a single, always-on, keyboard-and-camera-driven surface; member lookup by phone number is one field; every cash entry is attributed to him, which protects him as much as it monitors him. | — | `dash` | B2.3 | `UAT-02`; `SCR-DASH-009`; `NFR-USE-02`, `NFR-USE-09`; `AC-STAF-01.3` | NOT STARTED |
| `[ ]` | **PERS-04** | **Anita — the verification officer.** Reviews 30–60 gym applications per day. *Design implications:* the review screen is a split view — documents left, structured checklist right; approve/reject are keyboard-accessible; reason codes are a fixed taxonomy, not free text. | — | `admin` | B2.4 | `UAT-04`; `SCR-ADM-003`; `NFR-USE-02`; `RCT-02`; `US-ONB-02` (decide in under three minutes) | NOT STARTED |
| `[ ]` | **PERS-05** | **Vikram — the finance analyst.** Runs settlement, reconciliation, refunds and reporting. *Design implications:* every financial figure is traceable to its source events; nothing is recomputed at display time; every export includes the identifiers needed to join it to other exports. | — | `admin` | B2.5 | `UAT-05`; `BR-FIN-01`, `BR-FIN-02`; `FR-RPT-05`; `AC-RPT-01.3` | NOT STARTED |

### 20.6 Role definitions (§B3.1) — `ROLE-01` … `ROLE-12`

Roles are **additive within a scope** — a user may hold `MEMBER` at the platform level and
`GYM_OWNER` for a tenant simultaneously. Permission evaluation is always
`(role, scope, resource, action)` — **never role alone**.

| `[ ]` | ID | Requirement (role · scope · description) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **ROLE-01** | `VISITOR` · scope: Public · unauthenticated. | — | `iam/` | B3.1 | RBAC matrix row-by-row against §B3.2; `FR-NAV-01` | NOT STARTED |
| `[ ]` | **ROLE-02** | `USER` · scope: Self · registered, no active membership. | — | `iam/` | B3.1 | RBAC against §B3.2 (favourites, purchase, invoice download, refund request ▪) | NOT STARTED |
| `[ ]` | **ROLE-03** | `MEMBER` · scope: Self · holds ≥1 active membership. | — | `iam/` | B3.1 | RBAC against §B3.2 (QR generation, review submission ▪) | NOT STARTED |
| `[ ]` | **ROLE-04** | `GYM_OWNER` · scope: Tenant · full authority over their tenant. | — | `iam/` · `staff/` | B3.1 | RBAC + `FR-RBAC-07` (last owner protected); `FR-STAF-09` | NOT STARTED |
| `[ ]` | **ROLE-05** | `GYM_MANAGER` · scope: Branch(es) · operational authority over assigned branches. | — | `iam/` · `staff/` | B3.1 | RBAC + Isolation (branch scoping); `FR-STAF-03` | NOT STARTED |
| `[ ]` | **ROLE-06** | `RECEPTIONIST` · scope: Branch · front-desk operations. | — | `iam/` · `staff/` | B3.1 | RBAC; `AC-STAF-01.1`, `AC-STAF-01.2`; `UAT-02` | NOT STARTED |
| `[ ]` | **ROLE-07** | `TRAINER` · scope: Branch · assigned members and sessions. | — | `iam/` · `staff/` | B3.1 | RBAC; `FR-STAF-07`; `OQ-15` | NOT STARTED |
| `[ ]` | **ROLE-08** | `SUPER_ADMIN` · scope: Platform · full platform authority. | — | `iam/` · `admin/` | B3.1 | RBAC + MFA (`NFR-SEC-11`); `UAT-06` | NOT STARTED |
| `[ ]` | **ROLE-09** | `VERIFICATION_OFFICER` · scope: Platform · onboarding review only. | — | `iam/` · `onboarding/` | B3.1 | RBAC negative (no financial or moderation capability); `UAT-04`; `BR-DAT-07` | NOT STARTED |
| `[ ]` | **ROLE-10** | `SUPPORT_AGENT` · scope: Platform · read-mostly, impersonation with audit. | — | `iam/` · `support/` | B3.1 | RBAC + Contract negative on financial mutations; `AC-AUTH-03.2`; `BR-DAT-02` | NOT STARTED |
| `[ ]` | **ROLE-11** | `FINANCE` · scope: Platform · financial operations. | — | `iam/` · `settlements/` | B3.1 | RBAC; `BR-FIN-08` dual approval; §B3.2 financial rows | NOT STARTED |
| `[ ]` | **ROLE-12** | `MODERATOR` · scope: Platform · content and review moderation. | — | `iam/` · `reviews/` | B3.1 | RBAC; `FR-REV-07`; `FR-ADMN-07` taxonomy; `FR-ADMN-12` | NOT STARTED |

### 20.7 Permission matrix capability rows (§B3.2) — `PERM-01` … `PERM-42`

**Legend:** ● full · ▪ own/assigned records only · ○ read only · — none.
Column order throughout: VISITOR · USER · MEMBER · RECEPT · TRAINER · MANAGER · OWNER · SUPPORT ·
VERIF · FINANCE · MODER · S.ADMIN. Each row is ticked when all twelve cells are enforced
**server-side** (`FR-RBAC-02`) and each is covered by a positive and a negative test.

| `[ ]` | ID | Requirement (capability · twelve role cells in column order) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **PERM-01** | **Browse marketplace** — ● ● ● ● ● ● ● ● ● ● ● ● | — | `discovery/` | B3.2 | RBAC (12 cells); `FR-NAV-01` | NOT STARTED |
| `[ ]` | **PERM-02** | **View plan prices** — ● ● ● ● ● ● ● ● ● ● ● ● | — | `plans/` | B3.2 | RBAC (12 cells); `PRIN-02`; `BR-PLN-05` (staff-only plans still hidden) | NOT STARTED |
| `[ ]` | **PERM-03** | **Save favourites** — — ● ● — — — — — — — — — | — | `discovery/` | B3.2 | RBAC (12 cells); `FR-FAV-01` | NOT STARTED |
| `[ ]` | **PERM-04** | **Compare gyms** — ● ● ● — — — — — — — — — | — | `discovery/` | B3.2 | RBAC (12 cells); `FR-DETL-08` | NOT STARTED |
| `[ ]` | **PERM-05** | **Purchase membership** — — ● ● — — — — — — — — — | — | `ordering/` | B3.2 | RBAC (12 cells); `FR-NAV-01` auth gate | NOT STARTED |
| `[ ]` | **PERM-06** | **View own memberships** — — ○ ● — — — — — — — — — | — | `memberships/` | B3.2 | RBAC (12 cells) + Isolation; `API-MEMB-01` | NOT STARTED |
| `[ ]` | **PERM-07** | **Generate own check-in QR** — — — ● — — — — — — — — — | — | `attendance/` | B3.2 | RBAC (12 cells) + Contract negative; `SCR-WEB-009-P` | NOT STARTED |
| `[ ]` | **PERM-08** | **Submit review** — — — ▪ — — — — — — — — — | — | `reviews/` | B3.2 | RBAC (12 cells); `BR-REV-01`; `AC-REV-02.1` | NOT STARTED |
| `[ ]` | **PERM-09** | **Download own invoice** — — ● ● — — — — — — — — — | — | `billing/` | B3.2 | RBAC (12 cells) + Isolation; `FR-INV-08` | NOT STARTED |
| `[ ]` | **PERM-10** | **Request refund** — — ▪ ▪ — — — — ● — ● — ● | — | `refunds/` | B3.2 | RBAC (12 cells); `FR-RFND-01`; `AC-AUTH-03.2` (impersonation refused) | NOT STARTED |
| `[ ]` | **PERM-11** | **Scan / record check-in** — — — — ● ● ● ● — — — — — | — | `attendance/` | B3.2 | RBAC (12 cells) + branch scoping; `FR-STAF-03` | NOT STARTED |
| `[ ]` | **PERM-12** | **Manual check-in override** — — — — ● — ● ● — — — — ● | — | `attendance/` | B3.2 | RBAC (12 cells); `FR-CHK-08`; `RCT-05` | NOT STARTED |
| `[ ]` | **PERM-13** | **View branch attendance** — — — — ▪ ▪ ● ● ○ — — — ○ | — | `attendance/` | B3.2 | RBAC (12 cells) + Isolation; `FR-CHK-10` | NOT STARTED |
| `[ ]` | **PERM-14** | **Create member (walk-in)** — — — — ● — ● ● — — — — — | — | `crm/` | B3.2 | RBAC (12 cells); `FR-CRM-04` | NOT STARTED |
| `[ ]` | **PERM-15** | **Edit member record** — — — — ▪ — ● ● ○ — — — ○ | — | `crm/` | B3.2 | RBAC (12 cells); `FR-CRM-03`; `BR-DAT-01` | NOT STARTED |
| `[ ]` | **PERM-16** | **Record offline payment** — — — — ● — ● ● — — — — — | — | `ordering/` | B3.2 | RBAC (12 cells); `FR-CART-09`; `AC-STAF-01.3` | NOT STARTED |
| `[ ]` | **PERM-17** | **Create / edit plan** — — — — — — ○ ● ○ — ○ — ○ | — | `plans/` | B3.2 | RBAC (12 cells); `AC-STAF-01.2` (403 by direct URL) | NOT STARTED |
| `[ ]` | **PERM-18** | **Publish plan to marketplace** — — — — — — — ● — — — — ● | — | `plans/` | B3.2 | RBAC (12 cells); `API-TEN-23` | NOT STARTED |
| `[ ]` | **PERM-19** | **Edit gym profile** — — — — — — ▪ ● ○ ○ — — ● | — | `catalog/` | B3.2 | RBAC (12 cells); `FR-GYM-11`; `BR-GYM-06` | NOT STARTED |
| `[ ]` | **PERM-20** | **Add / remove branch** — — — — — — — ● — — — — ● | — | `catalog/` | B3.2 | RBAC (12 cells); `FR-GYM-07` | NOT STARTED |
| `[ ]` | **PERM-21** | **Invite / manage staff** — — — — — — ▪ ● — — — — ● | — | `staff/` | B3.2 | RBAC (12 cells); `FR-STAF-01`; `FR-RBAC-06` | NOT STARTED |
| `[ ]` | **PERM-22** | **Assign members to trainer** — — — — — ○ ● ● — — — — — | — | `staff/` · `crm/` | B3.2 | RBAC (12 cells); `FR-STAF-07` | NOT STARTED |
| `[ ]` | **PERM-23** | **Create workout plan** — — — — — ▪ ● ● — — — — — | — | `staff/` | B3.2 | RBAC (12 cells); `FR-STAF-07`; `OQ-15` | NOT STARTED |
| `[ ]` | **PERM-24** | **Create coupon** — — — — — — ○ ● — — — — ● | — | `ordering/` | B3.2 | RBAC (12 cells); `FR-CPN-02` scope separation | NOT STARTED |
| `[ ]` | **PERM-25** | **Respond to review** — — — — — — ● ● — — — ○ ● | — | `reviews/` | B3.2 | RBAC (12 cells); `FR-REV-05`; `BR-REV-05` | NOT STARTED |
| `[ ]` | **PERM-26** | **Moderate / unpublish review** — — — — — — — — — — — ● ● | — | `reviews/` | B3.2 | RBAC (12 cells) + negative for `GYM_OWNER`; `AC-REV-01.2` | NOT STARTED |
| `[ ]` | **PERM-27** | **View tenant reports** — — — — ▪ ▪ ▪ ● ○ — ○ — ○ | — | `reporting/` | B3.2 | RBAC (12 cells) + Isolation; `FR-RPT-01` | NOT STARTED |
| `[ ]` | **PERM-28** | **View settlement statements** — — — — — — — ● ○ — ● — ● | — | `settlements/` | B3.2 | RBAC (12 cells); `FR-SETL-07` | NOT STARTED |
| `[ ]` | **PERM-29** | **Change payout bank account** — — — — — — — ● — — — — ● | — | `settlements/` | B3.2 | RBAC (12 cells) + impersonation negative; `BR-GYM-06`; `AC-AUTH-03.2` | NOT STARTED |
| `[ ]` | **PERM-30** | **Export tenant data** — — — — — — — ● — — ● — ● | — | `reporting/` | B3.2 | RBAC (12 cells); `BR-DAT-05`; `BAC-12` | NOT STARTED |
| `[ ]` | **PERM-31** | **Review KYC documents** — — — — — — — — — ● — — ● | — | `onboarding/` | B3.2 | RBAC (12 cells) + access logging; `BR-DAT-07`; `NFR-SEC-02` | NOT STARTED |
| `[ ]` | **PERM-32** | **Approve / reject gym** — — — — — — — — — ● — — ● | — | `onboarding/` | B3.2 | RBAC (12 cells); `BR-GYM-03`; `SMT-33`, `SMT-34` | NOT STARTED |
| `[ ]` | **PERM-33** | **Suspend tenant** — — — — — — — — — — — — ● | — | `admin/` · `tenancy/` | B3.2 | RBAC (12 cells); `BR-TEN-05`; `API-ADM-11` | NOT STARTED |
| `[ ]` | **PERM-34** | **Configure commission rate** — — — — — — — — — — ○ — ● | — | `admin/` | B3.2 | RBAC (12 cells); `FR-ADMN-03`; `AC-ADMN-01.1` | NOT STARTED |
| `[ ]` | **PERM-35** | **Approve payout run** — — — — — — — — — — ● — ● | — | `settlements/` | B3.2 | RBAC (12 cells) + dual control; `BR-FIN-08`; `FR-SETL-06` | NOT STARTED |
| `[ ]` | **PERM-36** | **Approve out-of-policy refund** — — — — — — — — — — ○ — ● | — | `refunds/` | B3.2 | RBAC (12 cells); `BR-REF-03`; `API-ADM-22` | NOT STARTED |
| `[ ]` | **PERM-37** | **Handle chargeback** — — — — — — — ○ — — ● — ● | — | `refunds/` | B3.2 | RBAC (12 cells); `BR-REF-08`; `FR-RFND-08` | NOT STARTED |
| `[ ]` | **PERM-38** | **Impersonate user** — — — — — — — — ● — — — ● | — | `iam/` | B3.2 | RBAC (12 cells); `FR-AUTH-12`; `BR-DAT-02` | NOT STARTED |
| `[ ]` | **PERM-39** | **Manage platform users** — — — — — — — — — — — — ● | — | `admin/` · `iam/` | B3.2 | RBAC (12 cells); `FR-ADMN-10`; `NFR-SEC-11` | NOT STARTED |
| `[ ]` | **PERM-40** | **Toggle feature flags** — — — — — — — — — — — — ● | — | `admin/` · `common/` | B3.2 | RBAC (12 cells); `FR-ADMN-08`; `REF-10` | NOT STARTED |
| `[ ]` | **PERM-41** | **View audit log** — — — — — — — ▪ ○ ○ ○ ○ ● | — | `audit/` | B3.2 | RBAC (12 cells) + Isolation (`GYM_OWNER` own tenant only); `FR-ADMN-09`; `AC-ADMN-02.3` | NOT STARTED |
| `[ ]` | **PERM-42** | **Manage taxonomy** — amenities, gym categories, cities, localities, and the rejection, denial, refund, moderation and override reason-code sets — — — — — — — — — — — ● ● | — | `admin/` | B3.2 | RBAC (12 cells); `FR-ADMN-07`; `NFR-DQ-06`; `REF-02` … `REF-05`, `REF-09` | NOT STARTED |

### 20.8 Baseline notification catalogue (§B5.19) — `NOTIF-01` … `NOTIF-24`

Every entry is ticked when the template exists, is versioned and previewable (`FR-NOTF-03`), is
dispatched on the correct trigger through every listed channel adapter (`FR-NOTF-01`), respects the
recipient's preferences for its category (`FR-NOTF-02`), is queued and retried with every attempt
logged (`FR-NOTF-04`), and contains **no personal data in logs or analytics** (`BR-DAT-06`).

| `[ ]` | ID | Requirement (event · recipient · channels · category) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **NOTIF-01** | **OTP** → User · SMS / Email · **Transactional**. | — | `notifications/` · `iam/` | B5.19 | Integration; `FR-AUTH-05`; `AC-AUTH-01.1`, `AC-AUTH-01.5`; `DEP-03` | NOT STARTED |
| `[ ]` | **NOTIF-02** | **Registration welcome** → User · Email · **Transactional**. | — | `notifications/` | B5.19 | Integration; `FR-AUTH-01` | NOT STARTED |
| `[ ]` | **NOTIF-03** | **Order confirmation + invoice** → Member · Email, In-app · **Transactional**. | — | `notifications/` · `billing/` | B5.19 | Integration; `FR-INV-08`; `E2E-02`; `SCR-WEB-007` | NOT STARTED |
| `[ ]` | **NOTIF-04** | **Payment failed** → Member · Email, SMS, In-app · **Transactional**. | — | `notifications/` · `payments/` | B5.19 | Integration; `AC-PAY-02.3`; `SMT-18` | NOT STARTED |
| `[ ]` | **NOTIF-05** | **Membership activated** → Member · Email, SMS, In-app · **Transactional**. | — | `notifications/` · `memberships/` | B5.19 | Integration; `SMT-02`; `EVT-24` | NOT STARTED |
| `[ ]` | **NOTIF-06** | **Membership starts today (future-dated)** → Member · SMS, In-app · **Transactional**. | — | `notifications/` · `memberships/` | B5.19 | Integration; `AC-CART-01.3`; `SMT-03`; `JOB-01` | NOT STARTED |
| `[ ]` | **NOTIF-07** | **Check-in confirmation** → Member · In-app · **Operational**. | — | `notifications/` · `attendance/` | B5.19 | Integration; `FR-CHK-05`; preference-respecting (operational, opt-out) | NOT STARTED |
| `[ ]` | **NOTIF-08** | **Renewal reminder T−15 / −7 / −3 / −1** → Member · Email, SMS, In-app · **Operational**. | — | `notifications/` · `memberships/` | B5.19 | Integration (all four offsets); `BR-MEM-11`; `JOB-04`; `AC-USER-01.2` | NOT STARTED |
| `[ ]` | **NOTIF-09** | **Membership expired** → Member · Email, SMS, In-app · **Transactional**. | — | `notifications/` · `memberships/` | B5.19 | Integration; `SMT-07`, `SMT-08`; `JOB-02` | NOT STARTED |
| `[ ]` | **NOTIF-10** | **Freeze started / ended** → Member · Email, In-app · **Transactional**. | — | `notifications/` · `memberships/` | B5.19 | Integration (both events); `SMT-05`, `SMT-06`; `EVT-27`, `EVT-28` | NOT STARTED |
| `[ ]` | **NOTIF-11** | **Refund initiated / completed** → Member · Email, In-app · **Transactional**. | — | `notifications/` · `refunds/` | B5.19 | Integration (both events); `SMT-44`, `SMT-47`; `E2E-07` | NOT STARTED |
| `[ ]` | **NOTIF-12** | **Review request** → Member · Email, In-app · **Operational**. | — | `notifications/` · `reviews/` | B5.19 | Integration (third check-in and day-45); `FR-REV-10`; `EVT-32` | NOT STARTED |
| `[ ]` | **NOTIF-13** | **Gym closure notice** → Member · SMS, Email, In-app · **Transactional**. | — | `notifications/` · `catalog/` | B5.19 | Integration (within 24 hours); `BR-MEM-14`; `AC-GYM-02.3`; `FR-GYM-10` | NOT STARTED |
| `[ ]` | **NOTIF-14** | **New sale** → Owner · In-app, Email digest · **Operational**. | — | `notifications/` · `ordering/` | B5.19 | Integration; `SCR-DASH-001` region 5 | NOT STARTED |
| `[ ]` | **NOTIF-15** | **Daily summary** → Owner · Email · **Operational**. | — | `notifications/` · `reporting/` | B5.19 | Integration; `FR-CHK-14`; `JOB-20` | NOT STARTED |
| `[ ]` | **NOTIF-16** | **Expiring members this week** → Owner · Email, In-app · **Operational**. | — | `notifications/` · `memberships/` | B5.19 | Integration; `AC-MEMB-02.1`; tenant report *Expiring memberships* | NOT STARTED |
| `[ ]` | **NOTIF-17** | **New review received** → Owner · In-app, Email · **Operational**. | — | `notifications/` · `reviews/` | B5.19 | Integration; `SCR-DASH-001` region 1 (unread reviews needing response) | NOT STARTED |
| `[ ]` | **NOTIF-18** | **Payout initiated + statement** → Owner · Email, In-app · **Transactional**. | — | `notifications/` · `settlements/` | B5.19 | Integration; `SMT-61`, `SMT-62`; `AC-SETL-01.1` | NOT STARTED |
| `[ ]` | **NOTIF-19** | **KYC approved / rejected / info requested** → Owner · Email, SMS, In-app · **Transactional**. | — | `notifications/` · `onboarding/` | B5.19 | Integration (all three outcomes); `FR-ONB-13`; `SMT-33`, `SMT-34`, `SMT-35` | NOT STARTED |
| `[ ]` | **NOTIF-20** | **Subscription payment failed** → Owner · Email, SMS, In-app · **Transactional**. | — | `notifications/` · `billing/` | B5.19 | Integration; `BR-TEN-06`; `JOB-22`; `SCR-DASH-001` arrears alert | NOT STARTED |
| `[ ]` | **NOTIF-21** | **Application awaiting review > SLA** → Verification Officer · In-app, Email · **Operational**. | — | `notifications/` · `admin/` | B5.19 | Integration; `FR-ADMN-11`; `SCR-ADM-002` SLA indication | NOT STARTED |
| `[ ]` | **NOTIF-22** | **Refund awaiting approval** → Finance · In-app, Email · **Operational**. | — | `notifications/` · `refunds/` | B5.19 | Integration; `SMT-42`; `SCR-ADM-008` | NOT STARTED |
| `[ ]` | **NOTIF-23** | **Reconciliation variance** → Finance · Email, Alert · **Operational**. | — | `notifications/` · `settlements/` | B5.19 | Integration; `BR-FIN-07`; `JOB-10`; `NFR-MNT-06` | NOT STARTED |
| `[ ]` | **NOTIF-24** | **Moderation queue over threshold** → Moderator · In-app · **Operational**. | — | `notifications/` · `reviews/` | B5.19 | Integration; `FR-ADMN-12`; `SCR-ADM-001` moderation queue depth | NOT STARTED |

### 20.9 Tenant report catalogue (§B5.20) — `RPT-T-01` … `RPT-T-16`

Every report must satisfy `FR-RPT-01` (date range, branch filter, on-screen rendering, CSV export,
chart where meaningful), `FR-RPT-02` (≤15 minutes stale; financial reports read from the ledger and
are always current) and `FR-RPT-05` (every figure traceable by drill-down).

| `[ ]` | ID | Requirement (report · contents) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **RPT-T-01** | **Revenue summary** — gross, discounts, tax, net, commission, payable, by day/week/month, split online vs offline. | — | `reporting/` | B5.20 | Integration; `BR-FIN-02`; `KPI-17` origin split | NOT STARTED |
| `[ ]` | **RPT-T-02** | **Revenue by plan** — units sold, gross, net, average selling price, share of revenue. | — | `reporting/` | B5.20 | `US-RPT-01`; `AC-RPT-01.1`, `AC-RPT-01.2`, `AC-RPT-01.3` | NOT STARTED |
| `[ ]` | **RPT-T-03** | **New members** — count and value by period, by source (marketplace vs direct). | — | `reporting/` | B5.20 | Integration; `orders.origin`; `KPI-17` | NOT STARTED |
| `[ ]` | **RPT-T-04** | **Renewals** — due, renewed, lapsed, renewal rate, by plan. | — | `reporting/` | B5.20 | Integration; `KPI-12`; `EVT-30`, `EVT-31` | NOT STARTED |
| `[ ]` | **RPT-T-05** | **Churn cohort** — retention by joining month across subsequent months. | — | `reporting/` | B5.20 | Integration; `OBJ-05`; `OBJ-06` | NOT STARTED |
| `[ ]` | **RPT-T-06** | **Attendance summary** — visits by day, unique members, average visits per member. | — | `reporting/` · `attendance/` | B5.20 | Integration; `IDX-07`; `KPI-06` | NOT STARTED |
| `[ ]` | **RPT-T-07** | **Peak hours** — weekday-by-hour heatmap. | — | `reporting/` · `attendance/` | B5.20 | `AC-CHK-02.1`, `AC-CHK-02.2`; `FR-CHK-13`; `API-CHK-06` | NOT STARTED |
| `[ ]` | **RPT-T-08** | **Member activity** — per member: visits, last visit, frequency trend, risk flag. | — | `reporting/` · `crm/` | B5.20 | Integration; `FR-CRM-06`; `AC-CRM-01.1`; `JOB-18` | NOT STARTED |
| `[ ]` | **RPT-T-09** | **Expiring memberships** — next 7/15/30 days with contact details. | — | `reporting/` · `memberships/` | B5.20 | Integration (all three windows); `AC-MEMB-02.1`, `AC-MEMB-02.3` | NOT STARTED |
| `[ ]` | **RPT-T-10** | **Outstanding balances** — orders with `BALANCE_DUE`. | — | `reporting/` · `ordering/` | B5.20 | Integration; `AC-CART-02.2`; `SMT-15`; `BR-PAY-09` | NOT STARTED |
| `[ ]` | **RPT-T-11** | **Staff activity** — check-ins, sales, collections, overrides by staff. | — | `reporting/` · `staff/` | B5.20 | Integration; `FR-STAF-05`; `AC-STAF-01.3`; `OQ-09` weekly override reporting | NOT STARTED |
| `[ ]` | **RPT-T-12** | **Coupon performance** — redemptions, discount cost, influenced revenue. | — | `reporting/` · `ordering/` | B5.20 | Integration; `FR-CPN-08`; `coupon_redemptions` | NOT STARTED |
| `[ ]` | **RPT-T-13** | **Review summary** — rating trend, volume, response rate, sub-rating breakdown. | — | `reporting/` · `reviews/` | B5.20 | Integration; `SCR-DASH-019`; `FR-REV-08` | NOT STARTED |
| `[ ]` | **RPT-T-14** | **Settlement statement** — per payout: transactions, all eight computed figures, net. | — | `reporting/` · `settlements/` | B5.20 | `AC-SETL-01.1`; `BR-FIN-02`, `BR-FIN-03`; `E2E-12` | NOT STARTED |
| `[ ]` | **RPT-T-15** | **Tax report** — taxable value and tax by rate by period. | — | `reporting/` · `billing/` | B5.20 | Integration; `FR-INV-05`; `invoices.tax_breakdown`; `REF-07` | NOT STARTED |
| `[ ]` | **RPT-T-16** | **Lead funnel** — enquiries, contacted, converted, conversion rate. | — | `reporting/` · `crm/` | B5.20 | Integration; `SCR-DASH-017` pipeline stages | NOT STARTED |

### 20.10 Platform report catalogue (§B5.20, `admin`) — `RPT-P-01` … `RPT-P-11`

| `[ ]` | ID | Requirement (report · contents) | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **RPT-P-01** | **GMV and take rate** — by period, city, tier. | — | `reporting/` · `admin` | B5.20 | Integration; `KPI-14`, `KPI-16`; `SCR-ADM-014` | NOT STARTED |
| `[ ]` | **RPT-P-02** | **Tenant funnel** — signups → submitted → approved → activated → transacting. | — | `reporting/` · `admin` | B5.20 | Integration; `FNL-02`; `KPI-01`, `KPI-02`, `KPI-03` | NOT STARTED |
| `[ ]` | **RPT-P-03** | **Tenant cohort retention** — by signup month. | — | `reporting/` · `admin` | B5.20 | Integration; `KPI-04` | NOT STARTED |
| `[ ]` | **RPT-P-04** | **Marketplace funnel** — search → detail → checkout → paid, with drop-off at each step. | — | `reporting/` · `admin` | B5.20 | Integration; `FNL-01`; `KPI-09`, `KPI-10`, `KPI-11` | NOT STARTED |
| `[ ]` | **RPT-P-05** | **City performance** — supply, demand, GMV, conversion by city. | — | `reporting/` · `admin` | B5.20 | Integration; `RSK-10`; §C9.4 launch gates | NOT STARTED |
| `[ ]` | **RPT-P-06** | **Payment health** — success rate, failure reasons, retry recovery. | — | `reporting/` · `admin` | B5.20 | Integration; `KPI-19`; `EVT-21`, `EVT-22`; `FR-PAY-06` | NOT STARTED |
| `[ ]` | **RPT-P-07** | **Refunds and disputes** — rate, value, reasons, by tenant. | — | `reporting/` · `admin` | B5.20 | Integration; `KPI-20`, `KPI-21`; `RCT-03` | NOT STARTED |
| `[ ]` | **RPT-P-08** | **Reconciliation** — gateway vs ledger variance by day. | — | `reporting/` · `admin` | B5.20 | Integration; `KPI-26`; `SCR-ADM-010`; `JOB-10` | NOT STARTED |
| `[ ]` | **RPT-P-09** | **Review integrity** — volume, moderation rate, anomaly flags. | — | `reporting/` · `admin` | B5.20 | Integration; `RSK-02`; `FR-REV-09`; `JOB-13` | NOT STARTED |
| `[ ]` | **RPT-P-10** | **Support load** — tickets per tenant, per category, resolution time. | — | `reporting/` · `admin` | B5.20 | Integration; `KPI-25`; `OBJ-10`; `FR-SUP-05` | NOT STARTED |
| `[ ]` | **RPT-P-11** | **Verification SLA** — queue depth, time to decision, rejection reasons distribution. | — | `reporting/` · `admin` | B5.20 | Integration; `FR-ADMN-11`; `KPI-03`; `RCT-02` distribution | NOT STARTED |

---

## 21. "Nothing Lost" Attestation

**Method.** Every family was counted twice: once by reading `/docs/MASTER_PRD.md` section by section,
and once by extracting the identifiers mechanically and de-duplicating them. Both counts are recorded
below against the number of rows actually written in this file. A family passes only when
**source count = checklist count**, exactly. There is no tolerance and no rounding.

### 21.1 Attestation by family

| Family | Prefix | PRD § | Source count | Checklist count | ✔ |
| :--- | :--- | :--- | ---: | ---: | :-: |
| Guiding product principles | `PRIN-` | A3.4 | 7 | 7 | ✅ |
| Business objectives | `OBJ-` | A3.2 | 10 | 10 | ✅ |
| Success metrics | `KPI-` | A3.3 | 26 | 26 | ✅ |
| RACI process rows | `RACI-` | A5.3 | 16 | 16 | ✅ |
| Business rules — tenancy | `BR-TEN-` | A8.1 | 6 | 6 | ✅ |
| Business rules — gyms | `BR-GYM-` | A8.1 | 9 | 9 | ✅ |
| Business rules — plans | `BR-PLN-` | A8.2 | 7 | 7 | ✅ |
| Business rules — membership | `BR-MEM-` | A8.3 | 14 | 14 | ✅ |
| Business rules — payments | `BR-PAY-` | A8.4 | 11 | 11 | ✅ |
| Business rules — refunds | `BR-REF-` | A8.5 | 9 | 9 | ✅ |
| Business rules — check-in | `BR-CHK-` | A8.6 | 10 | 10 | ✅ |
| Business rules — reviews | `BR-REV-` | A8.7 | 7 | 7 | ✅ |
| Business rules — coupons | `BR-CPN-` | A8.8 | 5 | 5 | ✅ |
| Business rules — referrals | `BR-RFL-` | A8.8 | 1 | 1 | ✅ |
| Business rules — wallet | `BR-WAL-` | A8.8 | 1 | 1 | ✅ |
| Business rules — financial control | `BR-FIN-` | A8.9 | 8 | 8 | ✅ |
| Business rules — data & audit | `BR-DAT-` | A8.10 | 7 | 7 | ✅ |
| **Business rules — total** | `BR-` | A8 | **95** | **95** | ✅ |
| Functional requirements — RBAC | `FR-RBAC-` | B3.3 | 7 | 7 | ✅ |
| Functional requirements — navigation | `FR-NAV-` | B4.4 | 6 | 6 | ✅ |
| Functional requirements — auth | `FR-AUTH-` | B5.1 | 14 | 14 | ✅ |
| Functional requirements — user | `FR-USER-` | B5.2 | 8 | 8 | ✅ |
| Functional requirements — onboarding | `FR-ONB-` | B5.3 | 15 | 15 | ✅ |
| Functional requirements — gym | `FR-GYM-` | B5.4 | 12 | 12 | ✅ |
| Functional requirements — plan | `FR-PLAN-` | B5.5 | 9 | 9 | ✅ |
| Functional requirements — search | `FR-SRCH-` | B5.6 | 15 | 15 | ✅ |
| Functional requirements — detail | `FR-DETL-` | B5.7 | 11 | 11 | ✅ |
| Functional requirements — favourites | `FR-FAV-` | B5.8 | 5 | 5 | ✅ |
| Functional requirements — checkout | `FR-CART-` | B5.9 | 11 | 11 | ✅ |
| Functional requirements — payments | `FR-PAY-` | B5.10 | 12 | 12 | ✅ |
| Functional requirements — invoicing | `FR-INV-` | B5.11 | 11 | 11 | ✅ |
| Functional requirements — membership | `FR-MEMB-` | B5.12 | 12 | 12 | ✅ |
| Functional requirements — check-in | `FR-CHK-` | B5.13 | 14 | 14 | ✅ |
| Functional requirements — CRM | `FR-CRM-` | B5.14 | 10 | 10 | ✅ |
| Functional requirements — staff | `FR-STAF-` | B5.15 | 9 | 9 | ✅ |
| Functional requirements — reviews | `FR-REV-` | B5.16 | 11 | 11 | ✅ |
| Functional requirements — coupons | `FR-CPN-` | B5.17 | 8 | 8 | ✅ |
| Functional requirements — referrals | `FR-REFR-` | B5.18 | 7 | 7 | ✅ |
| Functional requirements — notifications | `FR-NOTF-` | B5.19 | 8 | 8 | ✅ |
| Functional requirements — reports | `FR-RPT-` | B5.20 | 5 | 5 | ✅ |
| Functional requirements — settlements | `FR-SETL-` | B5.21 | 10 | 10 | ✅ |
| Functional requirements — refunds | `FR-RFND-` | B5.22 | 11 | 11 | ✅ |
| Functional requirements — support | `FR-SUP-` | B5.23 | 7 | 7 | ✅ |
| Functional requirements — admin | `FR-ADMN-` | B5.24 | 13 | 13 | ✅ |
| **Functional requirements — total** | `FR-` | B3.3 · B4.4 · B5 | **261** | **261** | ✅ |
| Non-functional — performance | `NFR-PERF-` | B9.1 | 10 | 10 | ✅ |
| Non-functional — scalability | `NFR-SCAL-` | B9.2 | 6 | 6 | ✅ |
| Non-functional — availability | `NFR-AVL-` | B9.3 | 8 | 8 | ✅ |
| Non-functional — security | `NFR-SEC-` | B9.4 | 13 | 13 | ✅ |
| Non-functional — privacy | `NFR-PRV-` | B9.5 | 7 | 7 | ✅ |
| Non-functional — usability | `NFR-USE-` | B9.6 | 9 | 9 | ✅ |
| Non-functional — maintainability | `NFR-MNT-` | B9.7 | 9 | 9 | ✅ |
| Non-functional — data quality | `NFR-DQ-` | B9.8 | 6 | 6 | ✅ |
| **Non-functional — total** | `NFR-` | B9 | **68** | **68** | ✅ |
| User stories | `US-` | B5.1–B5.24 | 38 | 38 | ✅ |
| Acceptance criteria | `AC-` | B5.1–B5.24 | 129 | 129 | ✅ |
| Screens — customer website | `SCR-WEB-` | B6 | 18 | 18 | ✅ |
| Screens — gym dashboard | `SCR-DASH-` | B7 | 22 | 22 | ✅ |
| Screens — super-admin console | `SCR-ADM-` | B8 | 15 | 15 | ✅ |
| **Screens — total** | `SCR-` | B6–B8 | **55** | **55** | ✅ |
| Mandatory screen states (4 per screen) | `-L/-E/-X/-P` | B6 preamble | 220 | 220 | ✅ |
| API endpoints — `API-AUTH` | `API-AUTH-` | C3.2 | 15 | 15 | ✅ |
| API endpoints — `API-USER` | `API-USER-` | C3.2 | 10 | 10 | ✅ |
| API endpoints — `API-DISC` | `API-DISC-` | C3.2 | 12 | 12 | ✅ |
| API endpoints — `API-FAV` | `API-FAV-` | C3.2 | 6 | 6 | ✅ |
| API endpoints — `API-ORD` | `API-ORD-` | C3.2 | 7 | 7 | ✅ |
| API endpoints — `API-PAY` | `API-PAY-` | C3.2 | 4 | 4 | ✅ |
| API endpoints — `API-MEMB` | `API-MEMB-` | C3.2 | 10 | 10 | ✅ |
| API endpoints — `API-CHK` | `API-CHK-` | C3.2 | 6 | 6 | ✅ |
| API endpoints — `API-TEN` | `API-TEN-` | C3.2 | 57 | 57 | ✅ |
| API endpoints — `API-REV` | `API-REV-` | C3.2 | 6 | 6 | ✅ |
| API endpoints — `API-RFND` | `API-RFND-` | C3.2 | 3 | 3 | ✅ |
| API endpoints — `API-ADM` | `API-ADM-` | C3.2 | 48 | 48 | ✅ |
| API endpoints — `API-NOTF` | `API-NOTF-` | C3.2 | 2 | 2 | ✅ |
| API endpoints — `API-SUP` | `API-SUP-` | C3.2 | 7 | 7 | ✅ |
| **API groups** | `API-` | C3.2 | **14** | **14** | ✅ |
| **API endpoints — total** | `API-` | C3.2 | **193** | **193** | ✅ |
| Risks | `RSK-` | A10 | 15 | 15 | ✅ |
| Open questions | `OQ-` | C11 | 20 | 20 | ✅ |
| Assumptions | `ASM-` | A9.1 | 7 | 7 | ✅ |
| Constraints | `CON-` | A9.2 | 5 | 5 | ✅ |
| External dependencies | `DEP-` | A9.3 | 8 | 8 | ✅ |
| Business acceptance criteria | `BAC-` | A12 | 15 | 15 | ✅ |
| End-to-end journeys | `E2E-` | C8.3 | 12 | 12 | ✅ |
| UAT scripts | `UAT-` | C8.4 | 6 | 6 | ✅ |
| Background jobs | `JOB-` | C5 | 24 | 24 | ✅ |
| Analytics events — discovery | `EVT-` | C6 | 13 | 13 | ✅ |
| Analytics events — conversion funnel | `EVT-` | C6 | 11 | 11 | ✅ |
| Analytics events — engagement/retention | `EVT-` | C6 | 11 | 11 | ✅ |
| Analytics events — tenant lifecycle | `EVT-` | C6 | 14 | 14 | ✅ |
| **Analytics events — total** | `EVT-` | C6 | **49** | **49** | ✅ |
| Derived analytics funnels | `FNL-` | C6 | 2 | 2 | ✅ |
| State machines | `SM-` | C4.1–C4.7 | 7 | 7 | ✅ |
| State-machine transitions — membership | `SMT-01`…`11` | C4.1 | 11 | 11 | ✅ |
| State-machine transitions — order | `SMT-12`…`21` | C4.2 | 10 | 10 | ✅ |
| State-machine transitions — payment | `SMT-22`…`29` | C4.3 | 8 | 8 | ✅ |
| State-machine transitions — tenant/application | `SMT-30`…`40` | C4.4 | 11 | 11 | ✅ |
| State-machine transitions — refund | `SMT-41`…`48` | C4.5 | 8 | 8 | ✅ |
| State-machine transitions — review | `SMT-49`…`56` | C4.6 | 8 | 8 | ✅ |
| State-machine transitions — settlement batch | `SMT-57`…`64` | C4.7 | 8 | 8 | ✅ |
| **State-machine transitions — total** | `SMT-` | C4 | **64** | **64** | ✅ |
| State-machine invariants (membership) | `SMI-` | C4.1 | 3 | 3 | ✅ |
| Reason-code taxonomies | `RCT-` | C4.8 | 5 | 5 | ✅ |
| Reason codes — check-in denial | `RC-01`…`15` | C4.8 | 15 | 15 | ✅ |
| Reason codes — application rejection | `RC-16`…`31` | C4.8 | 16 | 16 | ✅ |
| Reason codes — refund reason | `RC-32`…`41` | C4.8 | 10 | 10 | ✅ |
| Reason codes — moderation | `RC-42`…`50` | C4.8 | 9 | 9 | ✅ |
| Reason codes — check-in override | `RC-51`…`57` | C4.8 | 7 | 7 | ✅ |
| **Reason codes — total** | `RC-` | C4.8 | **57** | **57** | ✅ |
| Core tables | `TBL-01`…`35` | C2.2 | 35 | 35 | ✅ |
| ERD entities not detailed in §C2.2 | `TBL-36`…`43` | C2.1 | 8 | 8 | ✅ |
| Reference (platform-global) tables | `REF-` | C2.3 | 11 | 11 | ✅ |
| Indexes declared in the §C2.4 table | `IDX-01`…`18` | C2.4 | 18 | 18 | ✅ |
| Index declared inline in §C2.2 only | `IDX-19` | C2.2 | 1 | 1 | ✅ |
| Partition declarations | `IDX-20`, `IDX-21` | C2.2 | 2 | 2 | ✅ |
| Module inventory | `MOD-` | B1.3 | 24 | 24 | ✅ |
| Backend module folders | *(Module column)* | C1.3 | 23 | 23 | ✅ |
| Business processes | `PROC-` | A7.1–A7.5 | 5 | 5 | ✅ |
| Revenue streams | `REVS-` | A6.1 | 10 | 10 | ✅ |
| Subscription tiers | `TIER-` | A6.2 | 4 | 4 | ✅ |
| Personas | `PERS-` | B2.1–B2.5 | 5 | 5 | ✅ |
| Role definitions | `ROLE-` | B3.1 | 12 | 12 | ✅ |
| Permission matrix capability rows | `PERM-` | B3.2 | 42 | 42 | ✅ |
| Baseline notification catalogue | `NOTIF-` | B5.19 | 24 | 24 | ✅ |
| Tenant report catalogue | `RPT-T-` | B5.20 | 16 | 16 | ✅ |
| Platform report catalogue | `RPT-P-` | B5.20 | 11 | 11 | ✅ |
| Editorial flags carried forward | `KL-` | Attestation | 3 | 3 | ✅ |
| **GRAND TOTAL — tickable rows** | | | **1,648** | **1,648** | ✅ |

**Result: 0 families failing. Nothing in `/docs/MASTER_PRD.md` is unrepresented in this checklist.**

### 21.2 Reconciliation of the PRD's own attestation figures

The Transcription Completeness Attestation at the end of `/docs/MASTER_PRD.md` and the Content
Inventory table in `/docs/PHASES.md` quote figures that differ in four places from the identifier
counts enumerated above. The PRD explicitly delegates this reconciliation here — *"Both counts are
reconciled in `/docs/MASTER_PRD_CHECKLIST.md`, which enumerates every identifier individually."*
Each difference is a counting convention, not a lost requirement.

| Family | PRD attestation figure | `PHASES.md` figure | Enumerated here | Explanation | ✔ |
| :--- | ---: | ---: | ---: | :--- | :-: |
| Business rules `BR-` | 78 | 95 | **95** | **78** counts the source PDF's §A8 catalogue **rows**; **95** counts individual rule **identifiers** across the 13 families: `BR-TEN` ×6 + `BR-GYM` ×9 + `BR-PLN` ×7 + `BR-MEM` ×14 + `BR-PAY` ×11 + `BR-REF` ×9 + `BR-CHK` ×10 + `BR-REV` ×7 + `BR-CPN` ×5 + `BR-RFL` ×1 + `BR-WAL` ×1 + `BR-FIN` ×8 + `BR-DAT` ×7 = 95. This checklist ticks **identifiers**, so 95 is the operative number. No rule is lost either way. | ✅ |
| Functional requirements `FR-` | — | 261 (expected "230+") | **261** | The source stated a floor of 230+; the transcription and this enumeration both find exactly 261 distinct identifiers across 26 families. | ✅ |
| Non-functional requirements `NFR-` | 60 | 68 (expected 60) | **68** | The **60** figure is the source PDF's stated NFR count; the transcription preserves **68** distinct identifiers across the 8 §B9 families (10+6+8+13+7+9+9+6). All 68 are enumerated. | ✅ |
| User stories `US-` / criteria `AC-` | — | 38 / 129 (expected "30+" / "90+") | **38 / 129** | Both source figures were floors, not exact counts. Enumeration finds exactly 38 stories carrying exactly 129 criteria. | ✅ |
| API groups `API-` | — | 14 (expected 12) | **14** | The source's "12" predates the `API-NOTF` and `API-SUP` groups being split out in §C3.2. Fourteen groups are catalogued; all 14 are enumerated, carrying 193 endpoints. | ✅ |
| Modules | 24 | 24 | **24 product modules / 23 code folders** | §B1.3 lists **24 product modules**; §C1.3 lists **23 backend folders**. These are two groupings of the same domain — `AUTH` and `USER` both live in `iam/`, `SETL` and the ledger split across `settlements/` and `ledger/`, and `common/`, `tenancy/` and `audit/` are cross-cutting folders with no single product module. Neither number is wrong. | ✅ |

### 21.3 Editorial flags carried forward from the PRD

Three source-document inconsistencies were preserved verbatim in `/docs/MASTER_PRD.md` with an
`[EDITORIAL]` flag and logged as `KL-001` … `KL-003` in `/docs/KNOWN_LIMITATIONS.md`. They are
recorded here so a reader of this checklist does not rediscover them as defects.

| `[ ]` | ID | Requirement | Pri | Module | PRD § | Verifying test | Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- |
| `[ ]` | **KL-001** | Approval Matrix row 3 cites *"Business rules catalogue (Part A §9)"*; the catalogue is physically at **§A8**, while §A9 holds Assumptions, Constraints and Dependencies. **Both sections require sign-off.** Preserved verbatim, flagged, not silently corrected. | — | documentation | Document Control | Approval Matrix signature covers both §A8 and §A9 | NOT STARTED |
| `[ ]` | **KL-002** | §A6.5 cites *"KPI-10 (support self-service)"*; `KPI-10` is *Detail-to-checkout rate*. The support self-service intent corresponds to **`OBJ-10`** and is measured operationally by **`KPI-25`**. Preserved verbatim, flagged. | — | documentation | A6.5 | `OBJ-10` and `KPI-25` rows carry the support-efficiency intent | NOT STARTED |
| `[ ]` | **KL-003** | The *How to Read This Document* section refers to Parts by `§2–§6`, `§9`, `§3`, `§5`, `§6–§8` while the body uses the prefixed forms `A2–A6`, `A8`, `B3`, `B5`, `B6–B8`. Equivalent; both retained. | — | documentation | Document Control | Cross-reference audit of `/docs/` against both numbering forms | NOT STARTED |

### 21.4 What this checklist deliberately does **not** contain

Recorded so that an absence is never mistaken for an omission.

| Item | Why it is not a tickable row here |
| :--- | :--- |
| §A4.2 out-of-scope items (11) and §A4.3 non-goals (3) | These are `W` — explicitly out of Phase 1 scope. They are scope guards, not deliverables. Each is referenced from the rows whose design they constrain (`CON-01`, `NFR-USE-08`, `ASM-06`, `ASM-07`, `REVS-04` … `REVS-10`). |
| §A11 Future Scope themes (12) | Phase 2 and beyond, each with a stated prerequisite. Referenced where they shape a Phase 1 decision (`REVS-04` … `REVS-10`, `MOD-18`, `OQ-15`). |
| §B4.1–§B4.3 information-architecture route lists | Routes are the addresses of the screens already enumerated in §11; ticking a route separately from its screen would double-count. Every route appears in its screen's row. |
| §C7 environments (5) and pipeline stages | Phase 0/2 engineering deliverables tracked in `/docs/PHASES.md` and `/docs/engineering/CI_CD.md`; the non-negotiable gates they enforce are carried on the rows they gate (`NFR-MNT-01`, `NFR-SEC-08`, `FR-RBAC-01`, `NFR-SEC-09`). |
| §C8.1 test layers (8), §C8.2 seed, §C8.5 defect severities (4) | These define **how** rows are verified; they populate the `Verifying test` column on all 1,648 rows rather than being rows themselves. |
| §C9 delivery plan (19 sprints, 9 milestones, team shape, 5 launch gates) | Programme management, tracked in `/docs/PHASES.md` and `/docs/roadmap/`. Sprint exit conditions are cited on the `E2E-` rows they gate. |
| §C10 change control and §C12 glossary (23 terms) | Process and vocabulary. `RSK-15` carries change control as a mitigation; glossary terms are used throughout rather than ticked. |
| §C13 traceability summary (10 rows) | A view over `OBJ-01` … `OBJ-10`, already enumerated in §4 with the same module and test mappings. |
| `A-01` … `A-30` stack additions | Not PRD content. They are gap-fills tracked in `/docs/engineering/STACK_ADDITIONS.md`, and none is approved. They are named on every row that depends on one so that no row is ticked on an unapproved addition. |

---

## 22. Untick Register

Every removal of a tick is recorded here, in the same commit that removes it, per §1.3. An empty
register means no tick has ever been removed — not that the rule is unused.

| # | Date | Identifier | Actor | Gate that broke (Implemented / Tested / Documented) | Defect or CR reference | Remediation owner | Re-ticked on |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| — | — | — | — | — | — | — | — |

**Register status: empty. Zero ticks recorded, therefore zero unticks.**

---

## 23. Change Log for This File

| Date | Change | By |
| :--- | :--- | :--- |
| 2026-08-06 | File created. 1,648 tickable rows enumerated across 44 identifier families from `/docs/MASTER_PRD.md` v2.0. All counts attested in §21. Zero rows ticked — Phase 8 is locked per `/docs/PHASES.md`. Stack references follow the ruling in `/docs/engineering/STACK_ADDITIONS.md`: PRD selections are authoritative, unnamed slots are referred to generically with their pending `A-nn` identifier. | Product / Engineering |

---

## Document End

This checklist is the **completeness instrument** for `/docs/MASTER_PRD.md`. It does not add
requirements, it does not interpret them, and it does not override them. Where it disagrees with the
PRD, the PRD is right and this file is defective.

**1,648 rows. 0 ticked. 286 of them block launch.**
