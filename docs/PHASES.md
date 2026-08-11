# PHASES — Master Execution Tracker

> **Purpose.** This file is the single execution ledger for the Gym Marketplace & Multi-Tenant
> Gym Management SaaS project. Every phase, every deliverable, every acceptance gate is listed
> here. Nothing is considered "done" until its box is ticked **and** its acceptance gate passes.
>
> **Rule.** Phases run in order. A phase may not start until the previous phase's gate is green.
> Phase 8 (code) may not start until Phases 0–7 are 100% complete and explicitly approved.

---

## Legend

| Symbol | Meaning |
| :----: | :------ |
| `[ ]`  | Not started |
| `[~]`  | In progress |
| `[x]`  | Done and gate passed |
| `[!]`  | Blocked — see Notes |
| `[-]`  | Deliberately deferred (with recorded reason) |

**Status values:** `NOT STARTED` · `IN PROGRESS` · `DONE` · `BLOCKED` · `DEFERRED`

---

## Phase Summary Board

| # | Phase | Output root | Deliverables | Status | Gate |
| :-: | :--- | :--- | :-: | :--- | :--- |
| 0 | Project Constitution & Engineering Plan | `/docs/` · `/docs/engineering/phase-0/` | 3 | **`DONE`** | ✅ |
| 1 | Master PRD & Requirement Checklist | `/docs/` | 2 | **`DONE`** | ✅ |
| 2 | Engineering Documentation | `/docs/engineering/` | 16 | **`DONE`** | ✅ |
| 3 | Product Backlog (Epics / Stories / Tasks) | `/docs/backlog/` | 21 | **`DONE`** | ✅ |
| 4 | Database Design | `/docs/database/` | 10 | **`DONE`** | ✅ |
| 5 | API Design | `/docs/apis/` | 10 | **`DONE`** | ✅ |
| 6 | UI Documentation | `/docs/ui/` | 8 | **`DONE`** | ✅ |
| 7 | Implementation Roadmap (100+ milestones) | `/docs/roadmap/` | 5 | **`DONE`** | ✅ |
| G | Governance & Living Documents | `/docs/` | 5 | **`DONE`** | ✅ |
| 8 | Implementation (code) | `/apps/` · `/packages/` | 120 milestones | **`IN PROGRESS`** | 🔓 |

### Documentation produced — final totals

| Phase | Location | Files | Lines |
| :-: | :--- | :-: | ---: |
| 0 · 1 · G | `/docs/` | 12 | 20,628 |
| 2 | `/docs/engineering/` | 17 | 32,989 |
| 3 | `/docs/backlog/` | 21 | 15,579 |
| 4 | `/docs/database/` | 10 | 17,233 |
| 5 | `/docs/apis/` | 10 | 21,730 |
| 6 | `/docs/ui/` | 8 | 14,381 |
| 7 | `/docs/roadmap/` | 5 | 9,969 |
| — | misc (`setup/`, `prompts/`) | 2 | 6,749 |
| **Total** | | **85** | **139,258** |

> **Phase 8 unlocked 2026-08-06** by the project owner, conditional on Phase 7 closing — which it
> has, with all 120 milestones defined and no gaps in the M-001 → M-120 sequence.

---

## Phase 0 — Project Constitution & Engineering Plan

**Goal.** Establish the immutable law of the project and the top-level engineering plan.
**Depends on.** Nothing.
**Status.** **`DONE`** — closed 2026-08-06.

### Deliverables

- [x] `/docs/PROJECT_CONSTITUTION.md` — the project law: coding standards, architecture rules,
      folder structure, SOLID, DDD, Clean Architecture, naming conventions, Git strategy,
      security rules, documentation rules. **Never to be changed** except by recorded amendment.
      **4,780 lines · 25 sections** (10 mandated, 15 added for completeness).
- [x] `/docs/engineering/phase-0/ENGINEERING_PLAN.md` — consolidated 20-section engineering
      planning document. **3,678 lines · 25 mermaid diagrams · 20 epics · 1,130 feature points ·
      all 261 `FR-` ids assigned exactly once · 152 endpoint rows · 854 engineer-day P50 estimate
      with a 690 / 854 / 1,110 confidence range and a pre-agreed descope order.**
- [x] `/docs/engineering/STACK_ADDITIONS.md` — the stack ruling and additions register.
      **29 approved · 2 deferred.** *(Added during the phase; not in the original plan.)*

### Acceptance Gate

- [x] Constitution covers all 10 mandated sections. *(Delivered 25.)*
- [x] Constitution contains the *Amendment Procedure* (§24, with an empty Amendment Register) and
      the *Ten Questions Before Code* rule (§2, each question worked through a real domain example).
- [x] Engineering plan contains all 20 mandated sections, each non-empty and specific to this product.
- [x] Zero code written. Every fenced block is a tree, a diagram, or an illustration explicitly
      labelled *"illustrative — not committed code"*.
- [x] No placeholders. Automated scan for `TBD` / `FIXME` / `to be determined` returns zero.
- [x] Stack fidelity verified: NestJS recorded as the framework throughout; `Express` appears only
      as a rejected option, a forbidden import, or a lint-rule name.

---

## Phase 1 — Master PRD & Requirement Checklist

**Goal.** Convert the source BRD/PRD PDF (v2.0, 04 Aug 2026, 77 pages) into the canonical
Markdown source of truth with **zero loss of information**.
**Depends on.** Phase 0.
**Status.** **`DONE`** — closed 2026-08-06.

### Deliverables

- [x] `/docs/MASTER_PRD.md` — complete faithful Markdown transcription.
      Every heading preserved. Every business rule preserved. Every flow preserved.
      Every table preserved. No summarisation. No omission. Expanded only where the source
      was ambiguous, and every expansion marked as an editorial note.
- [x] `/docs/MASTER_PRD_CHECKLIST.md` — every requirement as an individually tickable item,
      grouped by identifier family, with traceability columns.
      **3,095 lines · 1,784 tickable items.**

### Content Inventory that MUST survive transcription

| Family | Prefix | Expected | Verified in `MASTER_PRD.md` | ✔ |
| :--- | :--- | :-- | :-- | :-: |
| Business objectives | `OBJ-` | 10 | 10 | ✅ |
| Success metrics | `KPI-` | 26 | 26 | ✅ |
| Business rules | `BR-` | 95 ids / 13 families | 95 | ✅ |
| Functional requirements | `FR-` | 230+ | 261 | ✅ |
| Non-functional requirements | `NFR-` | 60 | 68 | ✅ |
| User stories | `US-` | 30+ | 38 | ✅ |
| Acceptance criteria | `AC-` | 90+ | 129 | ✅ |
| Screens | `SCR-` | 55 | 55 (18 web + 22 dash + 15 adm) | ✅ |
| API groups | `API-` | 12 | 14 | ✅ |
| Risks | `RSK-` | 15 | 15 | ✅ |
| Open questions | `OQ-` | 20 | 20 | ✅ |
| Assumptions | `ASM-` | 7 | 7 | ✅ |
| Constraints | `CON-` | 5 | 5 | ✅ |
| Dependencies | `DEP-` | 8 | 8 | ✅ |
| Business acceptance criteria | `BAC-` | 15 | 15 | ✅ |
| End-to-end journeys | `E2E-` | 12 | 12 | ✅ |
| UAT scripts | `UAT-` | 6 | 6 | ✅ |
| Modules | — | 24 | 24 | ✅ |
| Background jobs | — | 24 | 24 | ✅ |
| State machines | — | 7 | 7 | ✅ |
| Reason-code taxonomies | — | 5 | 5 | ✅ |

### Acceptance Gate

- [x] Every identifier family count above matches the source document.
- [x] All three Parts (A — Business, B — Product, C — Engineering) transcribed in full.
- [x] All ASCII process flows preserved verbatim in fenced code blocks (5 process flows + 7 state
      machines + system context diagram, 46 fenced blocks total).
- [x] Checklist file cross-references every requirement to its PRD section.
- [x] Zero code written.

---

## Phase 2 — Engineering Documentation

**Goal.** Turn the PRD into an implementable engineering specification.
**Depends on.** Phases 0, 1.
**Status.** **`DONE`** — closed 2026-08-06. **32,955 lines across 16 documents · 98 mermaid diagrams.**

### Deliverables — `/docs/engineering/`

| ✔ | Document | Lines |
| :-: | :--- | ---: |
| [x] | `Security.md` | 2,600 |
| [x] | `SprintPlanning.md` | 2,454 |
| [x] | `SequenceDiagrams.md` | 2,426 |
| [x] | `Monitoring.md` | 2,357 |
| [x] | `TestingStrategy.md` | 2,329 |
| [x] | `Scalability.md` | 2,294 |
| [x] | `API_Catalog.md` | 2,178 |
| [x] | `ERD.md` | 2,008 |
| [x] | `FolderStructure.md` | 1,982 |
| [x] | `RiskAnalysis.md` | 1,960 |
| [x] | `BusinessRules.md` | 1,946 |
| [x] | `CI_CD.md` | 1,869 |
| [x] | `StateMachines.md` | 1,814 |
| [x] | `Architecture.md` | 1,756 |
| [x] | `Deployment.md` | 1,637 |
| [x] | `ModuleDependency.md` | 1,175 |

### Acceptance Gate

- [x] Every document traces back to specific PRD identifiers.
- [x] `ModuleDependency.md` proves the dependency graph is acyclic (topological ordering by layer).
- [x] `BusinessRules.md` covers all **95** `BR-` identifiers across 13 families (BR-TEN ×6, BR-GYM ×9,
      BR-PLN ×7, BR-MEM ×14, BR-PAY ×11, BR-REF ×9, BR-CHK ×10, BR-REV ×7, BR-CPN ×5, BR-RFL ×1,
      BR-WAL ×1, BR-FIN ×8, BR-DAT ×7), each with enforcement point + test id.
      **Verified by set difference against `MASTER_PRD.md`: 95 of 95, zero missing.**
- [x] Zero code written.
- [x] Every document terminates with an explicit closing line — truncation would be detectable.
- [x] Placeholder scan clean (all `TBD`/`FIXME` hits were the legitimate word *placeholder* in
      domain context — image fallbacks, `.env.example` values, DLT template variables).
- [x] Stack-fidelity scan clean: `Express` only as a rejected option; `Socket.IO` only as deferred.
- [x] India decisions propagated: Razorpay Route, GST CGST/SGST split, April–March financial year,
      India-only DR topology, TRAI DLT lead time surfaced in Sprint 0 rather than Sprint 14.

### Delivery note — the failure and the fix

The first attempt launched **all 14 agents simultaneously** because `parallel()` was called eagerly
for all three phase groups. Combined with 250 KB+ outputs, 12 of 14 connections dropped mid-response;
2 documents were left truncated and were deleted rather than patched. Re-run in **waves of 2–3 with
genuinely sequential `await`**, incremental file construction, a 900–1,800 line target and a
mandatory closing line. Second and third attempts: **13 of 13 agents succeeded, zero failures.**

---

## Phase 3 — Product Backlog

**Goal.** Decompose the specification into Epics → Features → User Stories → Technical Tasks.
**Depends on.** Phases 1, 2.
**Status.** **`DONE`** — closed 2026-08-06. **15,579 lines across 21 files.**

### Deliverables — `/docs/backlog/`

- [x] `README.md` — backlog index, estimation scale, definition of ready/done, epic dependency
      graph, sprint-to-epic map, coverage attestation, descope order. **1,079 lines.**
- [x] `Epic_01.md` … `Epic_20.md` — **20 epics**, each carrying all 14 mandated sections
      (metadata · business goal · scope · features · user stories · epic acceptance criteria ·
      business rules enforced · dependencies · technical tasks · estimated time · risks ·
      definition of done · open questions · traceability).

| Epic | Lines | | Epic | Lines |
| :--- | ---: | :-- | :--- | ---: |
| `Epic_20` Support, Referrals & Wallet | 873 | | `Epic_10` Membership Lifecycle | 657 |
| `Epic_01` Platform Foundation & Tenancy | 867 | | `Epic_04` Gym, Branch & Media | 655 |
| `Epic_19` Platform Admin, Config & Audit | 846 | | `Epic_16` Refunds & Disputes | 655 |
| `Epic_15` Ledger, Settlements & Payouts | 815 | | `Epic_05` Plan Catalogue & Pricing | 629 |
| `Epic_06` Marketplace Discovery & SEO | 799 | | `Epic_12` Member CRM & Leads | 627 |
| `Epic_02` Identity, Sessions & RBAC | 757 | | `Epic_18` Reporting & Exports | 665 |
| `Epic_03` Tenant Onboarding & KYC | 754 | | `Epic_13` Staff & Branch Scoping | 684 |
| `Epic_07` Checkout, Orders & Coupons | 730 | | `Epic_09` Invoicing, Tax & Billing | 691 |
| `Epic_08` Payments & Reconciliation | 714 | | `Epic_17` Notifications & Templates | 702 |
| `Epic_14` Reviews & Moderation | 709 | | `Epic_11` QR Check-in & Attendance | 671 |

### Acceptance Gate

- [x] Every one of the 24 PRD modules is covered by at least one epic. **Verified programmatically:
      all 24 claimed, none orphaned.**
- [x] Every `M`-priority functional requirement maps to at least one task.
- [x] Total story points and estimated hours rolled up in `README.md`, reconciled against the
      `ENGINEERING_PLAN.md` §13 figure of 854 engineer-days P50 (690 / 854 / 1,110 range).
- [x] Zero code written.
- [x] All 21 files terminate with an explicit closing line.
- [x] Placeholder scan clean (the single `TBD` hit is a Definition-of-Done item *forbidding* `TBD`).
- [x] `EP-08` corrected to **Razorpay Route** as the India payment adapter; Stripe Connect retained
      only as the `PaymentProvider` port's contract-test reference. *(The `ENGINEERING_PLAN.md` §3
      text predates the India ruling and would otherwise have propagated silently.)*

---

## Phase 4 — Database Design

**Goal.** Produce a complete, reviewable data design before a single migration exists.
**Depends on.** Phases 1, 2.
**Status.** **`DONE`** — closed 2026-08-06. **17,233 lines across 10 documents.**

### Deliverables — `/docs/database/`

| ✔ | Document | Lines |
| :-: | :--- | ---: |
| [x] | `ERD.md` — physical ERD, 79 tables, closes with 9 open items handed to `Schema.md` | 3,167 |
| [x] | `Schema.md` — full physical schema, every column, RLS policy and grant | 2,481 |
| [x] | `Constraints.md` — 1,263 enforced guarantees + the 95-rule coverage matrix | 2,169 |
| [x] | `MigrationStrategy.md` — expand/migrate/contract, backfills, rollback, schema-per-tenant path | 1,679 |
| [x] | `Relationships.md` — all 162 foreign keys with cascade analysis | 1,478 |
| [x] | `SeedStrategy.md` — reference data, fixtures, and the deterministic `§C8.2` seed | 1,472 |
| [x] | `Indexes.md` — 201 logical indexes, 63 declined in writing, ≈11.4 GB Year-1 footprint | 1,336 |
| [x] | `AuditStrategy.md` | 1,311 |
| [x] | `SoftDeleteStrategy.md` | 1,164 |
| [x] | `NamingConvention.md` | 976 |

### Acceptance Gate

- [x] Every table documents purpose, relationships, indexes, constraints, business rules.
- [x] Row-Level-Security policy defined for every tenant-owned table — **183 policies across 61
      tenant-owned tables**; the application role has no `BYPASSRLS`.
- [x] Money columns are integer minor units with adjacent currency column, everywhere.
      **No `numeric` and no `float` appears anywhere in the schema** — `BR-PAY-01` made structural.
- [x] Zero Prisma schema or migration files written yet. *(Prisma + Prisma Migrate = additions
      `A-01` / `A-07`, approved 2026-08-06. `A-01` approved **conditional** on the mandatory
      tenant-context client extension — specified in `Schema.md` §2 and `MigrationStrategy.md` §6.3.)*
- [x] All 10 documents terminate with an explicit closing line; zero build markers remain.
- [x] Business-rule coverage graded for all **95** `BR-` identifiers: 30 `FULL` · 11 `STRUCTURAL` ·
      26 `PARTIAL` · 28 `NONE` with the authoritative layer named for each. **43% of the rulebook is
      carried by the database as `FULL` or `STRUCTURAL`** — a violation is rejected or unrepresentable
      regardless of application behaviour.

### Delivery note — completed by hand after a network outage

Wave 2 lost all three agents (`Indexes`, `Constraints`, `MigrationStrategy`), two to `ENOTFOUND`
rather than load. A resume run then lost all three again, and the Bash safety classifier went down
with them. **Because the incremental-write instruction was already in force, 2,881 lines had already
been flushed to disk and nothing was lost.** The three documents were completed manually from their
exact stopping points — `Indexes.md` §4.9→13, `Constraints.md` §13→14, `MigrationStrategy.md` §6→14 —
matching the established section numbering, rule-id conventions (`IX-R*`, `BF*`, `DO*`, `RB*`, `MT*`,
`IN*`) and voice.

---

## Phase 5 — API Design

**Goal.** Freeze the API contract before implementation.
**Depends on.** Phases 1, 2, 4.
**Status.** **`DONE`** — closed 2026-08-06. **21,730 lines across 10 documents.**

### Deliverables — `/docs/apis/`

- [x] `README.md` — the contract law for the folder: conventions, versioning, errors, pagination,
      idempotency, rate limits, money and time rules. **2,297 lines.**
- [x] `Authentication.md` — `API-AUTH` + `API-USER`. **2,734 lines.**
- [x] `Marketplace.md` — `API-DISC` (non-search) + `API-FAV`. **2,303 lines.**
- [x] `Gym.md` — `API-TEN` management surface. **2,177 lines.**
- [x] `Membership.md` — `API-ORD` + `API-MEMB` + `API-CHK`. **2,176 lines.**
- [x] `Payments.md` — `API-PAY` + the inbound Razorpay webhook. **1,967 lines.**
- [x] `Notifications.md` — `API-NOTF` + `API-SUP`, incl. the TRAI DLT approval state machine. **3,351 lines.**
- [x] `Admin.md` — `API-ADM` + tenant financial reads. **3,281 lines.**
- [x] `Search.md` — `/search/*`, ranking, zero-result guidance. **893 lines.**
- [x] `Reviews.md` — `API-REV` + moderation semantics. **551 lines.**

### Acceptance Gate

- [x] Every endpoint declares a required permission from the `B3.2` matrix (`FR-RBAC-01`).
- [x] Every money- or state-affecting endpoint declares idempotency behaviour (`BR-PAY-03`).
- [x] Every endpoint lists its error codes against the shared registry in `README.md` §9.
- [x] Zero controller or route code written.
- [x] All 10 documents terminate explicitly; **zero build markers remain**.
- [x] India propagated: Razorpay Route webhook contract, GST CGST/SGST, April–March FY on invoice
      numbering, `Asia/Kolkata` +05:30 handling, TRAI DLT template approval, INR paise throughout.

### Findings raised against upstream documents

Phase 5 agents audited their inputs before writing. Two findings are material:

| Finding | Severity | Status |
| :--- | :--- | :--- |
| **`BR-DAT-06`'s log-redaction list contains no location field.** It redacts `token`, `password`, `phone`, `aadhaar`, `pan` — but not `lat`, `lng` or `pincode`. A default request-logging interceptor would write `GET /search/gyms?lat=12.934512&lng=77.610134` into the log aggregator. Six decimal places locates a person to ~0.1 m. This defeats the `C6` precision-reduction requirement entirely and would have shipped silently. | **Privacy-blocking** | `OI-S1` — requires an edit to `BusinessRules.md`. Interim control is access-log path-only for `/search/*`, which is one interceptor setting away from being switched off. |
| **`RL-SEARCH` budget is too tight.** 60 req/min per session covers search *and* autocomplete together. A nine-character locality query emits 3–5 suggest calls; four searches with refinements is ordinary. A legitimate fast user gets rate-limited. | Medium | `OI-S2` — proposed `RL-SUGGEST` split at 120/min. |

Four further findings are documentation defects with no contract consequence: the search projection
table is named `search_documents` in `Schema.md` and `gym_search_projection` in `Indexes.md` §6.2;
`Schema.md` §13.4's column list is a strict subset of what `Scalability.md` §6.3 specifies; a
dangling cross-reference to a non-existent `Indexes.md` §6.5; and `API_Catalog.md` §3.3 omits
`FR-SRCH-08` and `FR-SRCH-15` from the `/search/gyms` row.

### Delivery note — sustained Anthropic capacity outage

Phase 5 has been interrupted repeatedly by `529 Overloaded`, a server-side capacity failure distinct
from the earlier connection drops and DNS errors:

| Run | Agents | Outcome |
| :--- | :-: | :--- |
| Batch A | 6 | 3 succeeded, 3 lost to `529` |
| Batch B | 7 | 2 succeeded, 5 lost to `529` |
| Single-agent retry | 4 | **0 succeeded** — all refused at zero tokens and zero tool calls |

The final run confirms a total subagent outage rather than a load problem: the agents never started.
Direct tool calls from the main session continued to work throughout, which is how `Membership.md`
was completed by hand (§9 check-in endpoints, §10 error registry, §11 timezone rules, §12–13
traceability and open items).

The incremental-write rule has now protected work through **three distinct failure modes** —
oversized responses, DNS `ENOTFOUND`, and capacity `529` — and is confirmed as permanent policy.

Each endpoint documents: Purpose · Authentication · Authorization · Validation · Request ·
Response · Errors · Business Rules · Rate limiting · Future Compatibility.

### Acceptance Gate

- [ ] Every endpoint declares a required permission (constitution rule).
- [ ] Every money-affecting or state-changing endpoint declares idempotency behaviour.
- [ ] Every endpoint lists its error codes from the shared error taxonomy.
- [ ] Zero controller or route code written.

---

## Phase 6 — UI Documentation

**Goal.** Specify all three surfaces screen by screen, state by state.
**Depends on.** Phases 1, 2, 5.
**Status.** **`DONE`** — closed 2026-08-06. **14,381 lines across 8 documents.**

### Deliverables — `/docs/ui/`

| ✔ | Document | Lines |
| :-: | :--- | ---: |
| [x] | `GymDashboard.md` — 22 screens | 2,833 |
| [x] | `CustomerApp.md` — 18 screens | 2,142 |
| [x] | `Components.md` — shared inventory in `packages/ui` | 1,946 |
| [x] | `AdminDashboard.md` — 15 screens | 1,854 |
| [x] | `DesignSystem.md` — tokens, colour, type, density | 1,707 |
| [x] | `Navigation.md` — IA, guards, URL state, tenant switching | 1,492 |
| [x] | `ResponsiveBehavior.md` — breakpoints, budgets, 55-screen matrix | 1,469 |
| [x] | `Accessibility.md` — WCAG 2.1 AA, testing, risk register | 938 |

### Acceptance Gate

- [x] All 55 `SCR-` screens specified with loading / empty / error / permission-denied states.
- [x] Accessibility targets stated per surface (WCAG 2.1 AA on `web` **and** the check-in desk).
- [x] Component inventory maps to shadcn/ui primitives and shared `packages/ui`.
- [x] Zero component code written; every fenced block labelled *illustrative — not committed code*.
- [x] All 8 documents terminate explicitly; zero markers remain.
- [x] India propagated: lakh-crore money grouping, `+91` phone input, 6-digit PIN, `Asia/Kolkata`,
      Devanagari type-metric considerations for `NFR-USE-08`.

### Notable decisions recorded in this phase

| Decision | Where |
| :--- | :--- |
| **The check-in desk is held to AA, not A**, despite being internal. Sameer performs the action 200×/day — a failure there is a defect hit every four minutes for a whole shift, not a rare edge case. The counter-argument is recorded so it need not be re-litigated. | `Accessibility.md` §13.1 |
| **Allow/deny uses three redundant channels** — colour, icon *shape* (circle vs octagon), and text. A greyscale perceptual-diff CI gate fails any change that leaves hue as the only differentiator. | `Accessibility.md` §5.2 |
| **`DestructiveConfirmDialog` takes a required consequence string** and refuses to render generic copy, making `NFR-USE-06` structural rather than a review checklist item. | `Components.md` |
| **Filter changes `replace` history; mobile overlays `push`.** Back must undo the last *perceived* navigation, not the last route change. | `Navigation.md` §9.2 |
| **A suspended gym returns `200` + informational page, not `410`.** `410` asserts permanence and would de-index a URL that `BR-TEN-05` contemplates reinstating. | `Navigation.md` §12.3 |
| **Three `dash` screens break the 768 px floor** — Home, Check-in Desk, Member 360 — because an owner checks Home from bed and looks a member up mid-conversation. The other 19 are deskwork. | `ResponsiveBehavior.md` §11.2 |
| **`SCR-WEB-009` is the one screen that is best at 320 px.** The QR caps at 420 px because past that the scanner's focus distance, not code size, is the limit. | `ResponsiveBehavior.md` §11.4 |

---

## Phase 7 — Implementation Roadmap

**Goal.** Break the entire build into 100+ milestones of 2–6 hours each.
**Depends on.** Phases 2, 3, 4, 5, 6.
**Status.** `NOT STARTED`

### Deliverables — `/docs/roadmap/`

- [ ] `README.md` — roadmap index, milestone numbering, dependency ordering
- [ ] `Milestones_000-029.md`
- [ ] `Milestones_030-059.md`
- [ ] `Milestones_060-089.md`
- [ ] `Milestones_090-119.md`

Each milestone contains: Goal · Files · Dependencies · Acceptance Criteria · Testing · Rollback Plan.

### Acceptance Gate

- [ ] ≥ 100 milestones defined.
- [ ] Every milestone is 2–6 hours of work.
- [ ] Every milestone has a rollback plan.
- [ ] Dependency ordering contains no cycles.
- [ ] Zero code written.

---

## Phase G — Governance & Living Documents

**Goal.** Create the documents that keep the project honest over its lifetime.
**Depends on.** Phases 0–7 (content), but files are created alongside.
**Status.** **`DONE`** — closed 2026-08-06. These files now stay open for the life of the project.

### Deliverables — `/docs/`

- [x] `DECISION_LOG.md` — **30 ADRs**, each with context, ≥3 real options with rejection reasons,
      honest positive/negative/neutral consequences, a measurable revisit trigger and implementation
      notes. Plus a decision-dependency map, a business-rule → ADR cross-reference, the `OQ-` defaults
      the ADRs assume, and a supersession register. **5,252 lines.**
- [x] `CHANGELOG.md` — Keep-a-Changelog 1.1.0 + SemVer, with a two-stream version policy defining
      MAJOR/MINOR/PATCH separately for the public `/v1` API and for the product. **429 lines.**
- [x] `KNOWN_LIMITATIONS.md` — **110 `KL-` entries** across 8 categories, each with a revisit
      trigger. Includes the three-question defect/limitation/debt test. **331 lines.**
- [x] `TECH_DEBT.md` — **28 `TD-` entries**, each with an interest rate and payoff trigger, plus a
      Debt Budget with ten shortcuts that may never be taken as debt, and a four-class repayment
      schedule mapped to C9.1 sprints. **812 lines.**
- [x] `FEATURE_FLAGS.md` — flag taxonomy, naming grammar, lifecycle, evaluation semantics, and the
      registry. Includes the rule that a flag past its retirement date **fails CI**, and that money,
      tenancy and review-integrity rules are never flag-disableable. **864 lines.**

### Acceptance Gate

- [x] `DECISION_LOG.md` answers, at minimum: Why Prisma? Why PostgreSQL? Why Redis? Why BullMQ?
      Why NestJS? Why JWT? Why refresh tokens? Why QR? Why modular monolith? Why RLS?
      Why minor-unit integers? Why webhook-driven activation? *(All 12 covered, plus 18 more.)*
- [x] Every living document declares its update trigger (when it must be edited).

---

## Phase 8 — Implementation (IN PROGRESS)

**Goal.** Build the platform, milestone by milestone, per `/docs/roadmap/`.
**Depends on.** Phases 0–7 and G, all `DONE`, plus explicit owner approval.
**Status.** `IN PROGRESS — Sprint 0 complete, the auth track well under way, plus the three UI shells pulled ahead. 21 of 120 milestones. A member can register and sign in with a password OR a phone OTP over HTTP; an unknown identifier and a wrong password are indistinguishable in status, body and measured latency; and the OpenAPI contract is regenerable for the first time since M-010.`

### Pre-flight, mandatory before *any* code

- [x] Read `/docs/PROJECT_CONSTITUTION.md`
- [x] Read `/docs/MASTER_PRD.md`
- [x] Read `/docs/engineering/`
- [x] Read `/docs/database/`
- [x] Read `/docs/apis/`
- [x] Read `/docs/ui/`
- [x] Read `/docs/backlog/`
- [x] Read `/docs/roadmap/`
- [x] Confirm the requested work does not conflict with any of the above.
      **If it conflicts: stop, explain the conflict, wait for confirmation.**

### Milestone ledger

Ticked the moment a milestone lands green and committed (Cross-Phase Rule 4).

| Milestone | Title | Status | Commit | Verification |
| :--- | :--- | :--- | :--- | :--- |
| M-001 | `tsconfig` presets and the compiler contract | ✅ `DONE` | `370d4c5` | 9/9 typecheck · 30/30 tests |
| M-002 | `packages/config` — custom lint rules, architecture boundaries | ✅ `DONE` *(partial, see below)* | `f02a6ce` | 42/42 tests · depcruise 0 errors |
| M-003 | `packages/types` — branded ids, Money, error registry | ✅ `DONE` | `9e8bfa5` | 29/29 tests |
| M-004 | NestJS bootstrap, typed config, error envelope, redacted logging | ✅ `DONE` | `78ebf18` | 58/58 tests · booted and curled |
| M-005 | Docker Compose: Postgres 16 + PostGIS, Redis 7, MinIO, Mailpit | ✅ `DONE` | `6e54781` | **4/4 services healthy · infra:verify 7/7** |
| M-006 | Prisma init and `0_init` — extensions, domains, enums, four roles | ✅ `DONE` | `075bd88` | **23/23 integration tests on real PG16** · 81 enums · 460 values · 12 domains · 4 roles · 0 tables |
| M-007 | `pr.yml` — the ten always-on gates, 23 modules, 23 runbooks | ✅ `DONE` | `075bd88` | 15/15 structure tests · 3 violation fixtures prove the gates bite |
| M-008 | OpenAPI generation, `/v1` versioning, api-gates, the drift gate | ✅ `DONE` | `3fdac69` | 45/45 gate fixtures · byte-stable emission · 4 absence proofs |
| M-009 | `tenants` — the first tenant-owned table, RLS enabled and FORCED | ✅ `DONE` | — | **23/23 isolation tests on real PG16** · RS-1/2/3/7/8/10 · IS6 coverage proved non-vacuous |
| M-010 | The Prisma tenant-context client extension (ADR-0005) | ✅ `DONE` | — | **PX-1…PX-6 on real PG16** · 16/16 extension · 39/39 isolation · found 4 real defects |
| M-011 | `TenantContextMiddleware`, the ALS carrier, the principal scaffold | ✅ `DONE` | — | 20/20 guard · 29/29 middleware · 5 spellings × 3 locations refused |
| M-012 | `TenantScopedRepository` and `GET /v1/tenant/ping` | ✅ `DONE` | — | 50/50 isolation · A1–A4 incl. the positive control · 404 not 403 proved byte-identical |
| M-013 | `audit_log`, the append-only writer, the `@Audited()` interceptor | ✅ `DONE` | — | 19/19 audit-grant tests · trigger refuses even a superuser · CI-10 partition trap proved |
| M-014 | `runElevated()` — platform scope as a named, audited call | ✅ `DONE` | — | **20/20 elevation tests on real PG16** · PE-T1 positive control returns 2 tenants · 13/13 inventory tests · found 3 real defects |
| **UI-1** | `packages/ui` — the three token tiers, both themes, the contrast proof | ✅ `DONE` | — | **85/85** · all 60 documented contrast ratios recomputed and verified · 530 CSS declarations generated |
| **UI-2** | `apps/customer-web` — the Next.js 14 App Router shell | ✅ `DONE` | — | **23/23** · builds · served and curled · 87.4 kB first load · CSP nonce per response |
| **UI-3** | `apps/admin-dashboard` — the React 18 + Vite shell, MFA-gated | ✅ `DONE` | — | **24/24** · builds · served and curled · 15 SCR-ADM routes declared |
| M-015 | **THE CROSS-TENANT ISOLATION SUITE** — generated, `BAC-10` | ✅ `DONE` | — | **114/114 isolation on real PG16** · A1…A7 · A7 proves the suite goes RED with RLS off · 23/23 coverage-gate fixtures · found 3 real defects |
| M-016 | `Money`, the Indian formatter, the `Clock` port, time discipline | ✅ `DONE` | — | **36 money + 27 time + 17 Money/Clock** · 10,000-split property test · TR-24 asserted at 18:30 UTC · **`pnpm lint` passes for the first time** |
| M-017 | `idempotency_keys` and the idempotency interceptor | ✅ `DONE` | — | **11 integration on real PG16** incl. the twenty-way concurrency case · 17 fingerprint · 15 interceptor · found 1 real defect |
| M-018 | The transactional **outbox**, the `SKIP LOCKED` dispatcher, the §C5 job harness | ✅ `DONE` | — | **12 outbox integration on real PG16** — 4 concurrent dispatchers × 500 rows, each claimed **exactly once** · 23 job-harness incl. the `TR-25` deliberate double-trigger · 14 channel-port · found 1 real defect in M-017 · raised `BLK-07`, `BLK-08` |
| M-019 | Identity and RBAC tables — `users` … `role_permissions` | ✅ `DONE` | — | **69 integration on real PG16** + 19 matrix · all **504** §B3.2 cells re-parsed from the PRD and compared · `app_rw` proved unable to write `role_permissions` · found **2 real defects in the schema spec** |
| M-020 | Argon2id credentials, password policy, lockout, the four `/v1/auth/*` routes | ✅ `DONE` | — | **21 endpoint tests over real HTTP** incl. the enumeration assertion measured against real Argon2id · 18 hasher · 19 policy · 18 Redis · found **6 real defects, 5 pre-existing** · raised `BLK-09` |
| M-021 | Phone OTP — the `FR-AUTH-05` limits, two independent ceilings | ✅ `DONE` | — | **18 endpoint over real HTTP** + 18 Redis + 19 policy · every limit asserted from both sides · "no SMS is sent" asserted by COUNTING deliveries · found 1 real off-by-one |
| M-022 | `auth_sessions`, `refresh_tokens`, JWT issue and rotation with reuse detection | ✅ `DONE` | — | **11 revocation over real HTTP** (AC-6, AC-10) · **6 reuse/family** (E1.2) · **5 parallel-tab under genuine concurrency** (TR-28, up to 5-way) · **15 grant** incl. a write-once trigger the column GRANT could not express · 12 rotation-policy unit · 9 contract · found **3 real defects** |
| — | **Client demo surfaces** (off roadmap order, at the owner's request) | ✅ `DONE` | — | Admin console signed in against the live API · website search + gym page over a **fixture** catalogue · 27 web + 24 admin unit · found the `/readyz` probe gap and a soft-404 · runbook at `docs/setup/DEMO.md` |
| — | **Admin console redesign** (off roadmap order, at the owner's request) | ✅ `DONE` — all 11 phases | — | Brand re-based on `wine` (`ADR-0036`, brand-600 vs danger-600 measured 2.18:1) · `packages/ui` given 20 components against `Components.md` (`overlay`, `timeline`, `page-header`, `command-palette`) with **22 structural tests** · `SCR-ADM-003` built · `SCR-ADM-002` and `-004` rebuilt to `AdminDashboard.md` §6.2/§6.4 · the eleven unbuilt screens given their real §B8 specification instead of a placeholder · **`turbo run lint` extended from five workspaces to eight**, which found two independent rupee formatters and a JSON-LD injection on the customer surface · new `gymmap/no-surface-currency-format` rule implementing `FolderStructure.md` §12 rule 14 · new `ci:tailwind-tokens` gate after 13 Tailwind classes were found emitting nothing · verification SLA moved server-side per `Admin.md` §5.1.1 (**15 tests**) after the console was found deciding it with `waitingDays > 7` · `NFR-USE-06` confirmation added to session revocation, which had none · `REASON_MIN_LENGTH` corrected 20→10 to match `RS3` · `KL-100` and `TD-035` recorded · `ADR-0037` lifted visual prescription at the owner's instruction and kept the accessibility floor |
| — | **Customer marketplace build-out** (off roadmap order, at the owner's request) | ✅ `DONE` — 10 of 10 phases | `01efcc3` | **20 routes, 137/137 web unit, `turbo run typecheck lint test:unit build` green across all 8 workspaces** · 87.2 kB shared first-load JS against `NFR-PERF-10`'s 200 kB · home, search with five live-counted facets, gym page with a photo mosaic, compare-in-the-URL, a GST-broken-down checkout, the member account, city and activity landings, For Gyms · **found nine real defects, seven of them silent**: `next/image` `fill` positioning dropped by the CSP, `bg-surface/95` emitting no rule at all (a fully transparent sticky header), Next's route announcer unhidden by the same policy, a grid track 2,571px wide inside a 1,408px page, a `1fr` row sized to its content instead of to a share of a definite height, a GST column that read ₹1 short of its own total, five `CSP_*` variables orphaned in the wrong `.env.example`, `nav-model.ts` citing a spec that did not exist, and every Phosphor import on a name deprecated in 2.1 |
| M-023 | The `§B3.2` matrix as data, `PermissionsGuard`, `(role, scope, resource, action)` | 🟨 `BE DONE` | `5a637b9` `09d7f19` `55c5dd9` `d0c5d6c` | **64 authorisation unit** · `USER_ROLE_STORE` on Prisma, and the tenant filtered BY HAND because `user_roles` is an `IDENTITY_MODEL` with a `tenant_id` and **no RLS policy** — an omitted filter would have counted other gyms' owners and permitted demoting the last one · wiring proved by booting the real DI graph and by deleting the store binding to watch it exit 1 · permission cache's three failure paths pinned, `invalidate` alone propagating · `FR-RBAC-05`'s domain resolver carries the granting role, scope and the ●/▪/○ qualifier that `permissionsFor()` cannot recover · its ENDPOINT blocked by `BLK-11`, `docs/features/rbac.md` by `BLK-12` · earlier evidence: **40 authorisation unit** · all **504** cells checked **against `MASTER_PRD` §B3.2 itself**, parsed from the document — a suite generated FROM the matrix could only agree with the matrix, typo included · proved to bite by flipping one cell in `dist` · `ResourceTenantGuard` answers **404, not 403**, so a cross-tenant id is byte-identical to a nonexistent one (`A1`) · last-owner counted by DISTINCT user · `LAST_OWNER_PROTECTED` at **422 not 403** · role change propagates by **cache invalidation, never a shorter token TTL** (`AC-6`) · permission cache fails to the TRUTH where `AC-10`'s denylist fails open, and `invalidate()` alone does not swallow · **global** guard registration still waits on `BLK-10` |
| M-024 | TOTP MFA — enrolment, recovery codes, the mandatory staff gate | 🟨 `BE DONE` | `be1fd3a` `7cf1977` `9d97db5` `ef01ec8` `3a62279` `91dd1ea` `ebe8a49` `a1caea5` `29a234f` | **87 MFA unit + 8 integration on real PG16** · TOTP hand-rolled over `node:crypto` because `A-33` is inside the contested block that is `BLK-09` — verified against **RFC 6238 Appendix B's own six vectors**, including the T=20000000000 row that catches a 32-bit counter · replay protection is a high-water mark whose guard lives in the `WHERE`, proved on real PG16 to refuse an older step · one endpoint and one lockout budget for TOTP and recovery codes, sharing M-020's counter · every failure returns one code, so the endpoint is not an enrolment oracle · recovery loop checks all ten hashes rather than stopping at the match · enrolment is two-step, and `begin` writes no audit row · secret sealed in an AES-256-GCM envelope with a key id for rotation · `ck_users__mfa_enabled_has_timestamp` makes the flag and its timestamp unable to disagree · DI graph booted against live Postgres and Redis · 19 operations in the contract · **`amr` per-session freshness is `KL-102`**, the secret store is `KL-101`, and `docs/features/mfa.md` waits on `BLK-12` |
| M-025 | Impersonation — the intersection, the financial refusal, the audit trail | 🟨 `BE DONE` | `98a95dc` `19616c8` `cebf644` `a7ebb69` `b8886a9` | The intersection was **measured, not assumed**: `SUPPORT_AGENT`×`GYM_OWNER` is 9 of 34 and `SUPER_ADMIN`×`GYM_OWNER` 23 of 34, so it is strictly narrower than the subject's set in every combination and mint-time narrowing is impossible — the token therefore carries both `roles` and `imp_roles` and `effectiveGrants()` intersects at the DECISION point · `runAsImpersonator` **throws on nesting** rather than layering two contexts · the ALS is read by `AuditPrismaRepository.append()` so `AC-7`'s *every* row is a property of the repository rather than of every call site remembering · ending a session **revokes the token**, it does not merely log that it ended · `PG-6` fails the build on a money route with no `@FinancialMutation()` · `docs/features/impersonation.md` waits on `BLK-12` |
| M-026 | The verification dossier — `applications`, `kyc_documents`, RLS and the `D-03` grant | ✅ `DONE` | `c0cc20f` `dc720ae` `e0ee8b2` | Both tables TENANT-OWNED with RLS enabled **and forced**, both policy halves proved · the snapshot is immutable at the GRANT level (`D-03` column-scoped `UPDATE`), so `app_rw` cannot rewrite a submitted claim even if the application tried · `kyc_documents` carries `tombstoned_at` and **no `deleted_at`** (`R-KYC`) — a reader filtering it out would hide the evidence that a legally required check happened · `uq_kyc_documents__storage_key` is GLOBALLY unique, because object storage has one namespace and two rows sharing a key would let one tenant's tombstone destroy another's evidence · `e0ee8b2` fixed six use cases writing `audit_entity_type_enum` values PostgreSQL rejects — the audit repository swallows write failures by design, so the tests were green over zero rows |
| M-027 | The wizard's shape, the registration-number normaliser | 🟨 `BE DONE` | `20f7404` | Draft state lives where the schema says it does rather than in a second store · the normaliser is the one place a registration number is canonicalised, so two spellings cannot become two tenants · **routes blocked by `BLK-14`** — `§B3.2` defines no capability for a tenant submitting its own application, and `onboarding/permissions.ts` reads its keys OUT of `CAPABILITY_MATRIX` by label so it throws at import rather than inventing one |
| M-028 | The application state machine and the submission transaction | ✅ `DONE` | `751a37b` `2f005c7` `22de181` | Eight states, and `Actor` is a discriminated union so **a job cannot approve a gym — the TYPE is what stops it**, not a runtime check · two distinct refusals (`ILLEGAL_TRANSITION` vs `HUMAN_REVIEWER_REQUIRED`) because they mean different things to whoever hits them · materiality has **three** states, and `isMaterialField` is *not-non-material* so an unclassified field defaults to MATERIAL — my first version had it backwards and my own tests caught it · `AC-6` proved by forcing a rollback AFTER both inserts and again by losing the `uq_applications__tenant_version` race, so a rolled-back submission dispatches nothing |
| M-029 | India identity validation and the KYC checklist as configuration | 🟨 `BE DONE` | `b31c3e2` | **PAN's fourth character cross-checked against `tenants.entity_type`** — the only part of PAN validation that catches a wrong DOCUMENT rather than a wrong keystroke; `SOLE_PROPRIETOR`→`P` because a proprietorship trades on a personal PAN, and `OTHER` accepts a set rather than skipping the check so it is not the dropdown option that turns validation off · GSTIN's **embedded PAN** compared to the supplied one, which catches two individually-valid documents belonging to different businesses · `kyc_checklists` built as GLOBAL reference per `Schema.md` §12.3 — four rows, one per `entity_type_enum`, `items` constrained by **jsonpath `CHECK`s** rather than trusted, including `ck_kyc_checklists__pan_is_always` which is load-bearing for the GSTIN cross-check's documented skip · a partial unique index makes two live versions unstorable · resolution has **four** states, and `AWAITING_DECLARATION` is the point: defaulting an unanswered "does your municipality require a trade licence?" to false drops a required document with no error anywhere · **no threshold figure is stated in the seed** (`O-TEN-4`, `LAUNCH_MARKET_INDIA.md` §13) and **no Aadhaar option** (§6, §13.6), both asserted by tests · grant class raised as **`BLK-15`**, the `country_id` divergence recorded as **`KL-103`** · **the enclave, as far as it can honestly go:** `ObjectStoragePort` and `MalwareScanPort` in `common/storage/` per `FolderStructure.md` §7.2, both bound to adapters that answer **`UNAVAILABLE`** / **`UNSCANNED`** and never `CLEAN` — for each there is a one-word change that would make the pipeline work today and be a breach, and `storage-ports.spec.ts` exists to make that change fail · `StorageArea` is a two-value union so a passport scan cannot be written to the media bucket by getting an argument wrong · `isPrivate()` refuses rather than answering, because `true` is an unchecked all-clear on the control `AC-7` names · **`AC-9` byte inspection built first-party**, no dependency (`file-type` has no `A-NN` row; the lockfile's transitive confers nothing) — whitelist not blacklist, and the executable check runs BEFORE it, because JPEG's signature is two bytes and a polyglot dies on the ordering · `storage_key` added to the redaction deny-list (`KY9`) · **`TD-037` paid**: `kyc_documents` had diverged from `Schema.md` §4.3 in eight places with nothing recording it, including `application_id NOT NULL`, which had inverted the onboarding order — corrected while the table held zero rows, and the assertion that would have caught it added · enclave conflicts raised as **`BLK-16`** (TTL 300 s vs 15 min, single-use unprovidable by a presigned GET, `K-03`/`K-09` unrepresentable in config), audit semantics as **`BLK-17`** (`EXPORT` vs `ELEVATE`, and `AC-8`'s before-the-URL guarantee unreachable through a port that cannot refuse), scanner as **`KL-104`**, flag inoperability as **`KL-105`** · **remaining:** the upload use cases and routes (`BLK-14`, `BLK-17`), the PDF rendition (no rasteriser has an `A-NN` row, and Sharp's prebuilt binaries have no PDF loader), and `infra/terraform/modules/object-storage/` — **not buildable at all**, because no cloud provider is approved in `STACK_ADDITIONS.md` Part 1 and `resource "aws_s3_bucket"` would put an unapproved technology in an infrastructure definition (`DP2`). The `pr.yml` terraform gate was silently blind to nested modules — missing `globstar` — and was fixed while the directory is still empty |
| M-030 | The six automated pre-checks and their orchestration job | 🟨 `BE DONE` | `b9971c9` `6d28e82` | **51 pre-check unit + 5 DI-boot** · **`PrecheckOutcome` has no `REJECT` member**, so `AC-2`'s "a pre-check never auto-rejects" is a type rather than a rule anyone has to remember · `AC-4` asks for the opposite — *"refused by the partial unique index"* — and **four higher documents forbid it**: `MASTER_PRD` BR-GYM-09 says *surfaced to the reviewer*, `BusinessRules.md` makes the `ST_DWithin` probe AUTHORITATIVE and the index *"advisory in Phase 1"*, `Constraints.md` §6.4 row 19 says *"deliberately not a constraint"*, `Schema.md` §5 says *"this is not a unique index"*. The migration was **not** written; `CLAUDE.md` §2 makes `roadmap/` *"a plan of work, never a source of requirements"*, and the divergence is `KL-108` so the next reader does not "finish" it · the address normaliser found **three real defects by hand-probing** that its own corpus missed — `M G Road` vs `MG Road`, a landmark pattern whose `[^,]*` ate the locality once commas became spaces, and `CHS Ltd` · `maxTotalPixels` was first set to 12,000,000 with a comment calling it "a modern phone at full resolution"; a 12 MP photo is 4032×3024 = **12,192,768**, so every ordinary upload would have flagged until reviewers learned the check was noise — **caught by a control test, not by re-reading the constant** · the bomb guard reads dimensions out of the file HEADER and hands nothing to a decoder, because a limit that runs after decoding runs after the worker is already dead · `Promise.allSettled`, never `all`: one geocoder outage must not empty the panel, since a reviewer reads an empty panel as *"nothing to worry about"* rather than *"nothing ran"* · the result set is written **whole** — appending would leave a flag cleared by a re-run sitting beside its own resolution, so approval would keep demanding a reason for a finding that no longer exists · lock scoped per APPLICATION, not globally, or `NFR-SCAL-01` volumes queue behind one another · `DUPLICATE_ADDRESS` and `DUPLICATE_BANK_ACCOUNT` **refuse rather than pretend** (`UNAVAILABLE` → `ERROR`), because a stub answering "no duplicates found" is the `AC-8` coercion in a different costume — `KL-109`; the bank check's `ERROR` branch is dead code today **with a live test on it**, so the day wizard step 5 supplies a fingerprint the gap surfaces instead of silently passing · `gymmap/no-float-money` grew the physical units after `maxTotalPixels` matched MONEY_NAME on "total" — suffix-anchored, with `pixelPriceMinor`, `bytesTransferredFee` and `msPerRupeeTotal` added as invalid cases to prove the anchor holds · **`pnpm typecheck` was found red on committed code across five commits** (`2c81028`): CI job 4 runs it, nothing had been pushed, and my local sweep was lint plus the unit suites · `KL-107` (constructed corpus, not `AC-5`'s 200 real addresses), `KL-108`, `KL-109`, `KL-110` (no decoder → no blur, no perceptual hash) · **remaining:** the geocoding ACL adapter and its recorded fixtures, `precheck_outcome_total` metrics (no metrics facility exists yet), and the runbook's dashboard section, which `RB2` will not let me write until the queries can be run |
| M-031 | `gyms`, `branches`, `gym_amenities` and the branch lifecycle | 🟨 `DB + PORTS DONE` | `1fa5591` `33fb005` | **19 catalogue integration on real PG16 + PostGIS** · **no milestone in the roadmap creates the reference tables three milestones depend on** — searching for one that builds `cities`, `countries`, `localities`, `gym_categories` or `amenities` returns M-031, M-032 and M-036, all consumers; `KL-103` had already recorded the same hole from the other side at M-029. Built here, scoped to exactly what the six foreign keys need, because the alternative is `city_id uuid` with nothing pointing at it — which `NFR-DQ-06` forbids in as many words, and which is the free-text alternative with the type system's blessing. `KL-111` · **the `geometry`/`geography` trap was measured, not assumed**: `ST_DWithin(geometry, …, 3000)` reads 3,000 as DEGREES, so the committed assertion is a PAIR and the half that bites is that a 3 km radius around **Pune** must return zero for a Bengaluru branch 840 km away — proved on the live database that geography answers 0 and geometry answers 1, so a positive-only test would have passed under either type · one-primary-per-gym is a **partial unique index, not a trigger** (`AC-3`), with three assertions rather than one: a second primary refused, two NON-primary branches still fine so the index has not quietly become "one branch per gym", and a soft-deleted primary not occupying the slot forever — without that last clause a gym that reopened its flagship could never name a primary again, surfacing months later as an unexplained unique violation on an ordinary edit · `ck_gyms__no_hierarchy` proved to refuse, so the first developer reaching for a franchise "group" fails loudly rather than getting half a system · `gym_amenities` is the one `DELETE` grant this milestone issues (G-CRUD-D, `Schema.md` §2.7) and the vocabulary it draws from is the opposite class — the CLAIM is tenant-owned with both policy halves, the `amenities` term is GLOBAL and only ever retired · **the int-spec's first run omitted `ON_ERROR_STOP=1` and seven "this must be refused" assertions passed vacuously**, psql reporting the error and still exiting 0 — the same defect this repo already hit in `audit-correlation.int-spec.ts`, now noted in the file · **remaining:** the `catalog/` module itself — entities, the deactivation policy, use cases, controllers, repositories, the `SEED_VERSION 0.6` seed, `docs/database/catalog.md` and `docs/apis/api-ten-catalog.md`. `AC-8`'s five branch routes also need `§B3.2` capability keys, and inventing one is what produced `BLK-10` · **three blockers raised after the tables landed, two of them mine:** `BLK-19` — four of the five branch routes cannot declare a permission, because `API_Catalog.md` names five keys and `Security.md` plus the shipped `CAPABILITY_MATRIX` name two, only `catalog.branch.read` is in both, and `§B3.2` holds no key strings at all to break the tie; `BLK-20` — **I shipped `ck_branches__state_code_shape` as `^[A-Z0-9]{2}$`, which accepts `27` and `MH`**, papering over a live numeric-versus-alpha conflict on the column that decides CGST+SGST versus IGST, now pinned as a canary rather than tightened because tightening is picking a side; `BLK-21` — the reference tables' keys are fixed and every `NOT NULL` display column is not, so 74 names, 59 icons, 15 slugs and 12 centroids would have to be invented, which `Epic_04.md` already calls an unmade client decision · **`PG-7` built in response** (`50c29ed`): `Security.md` `RB3` was specified and absent, so a well-formed key that exists in no `permissions.ts` passed CI and failed at request time — the shape behind `BLK-10`, `-11`, `-14` and `-19`, proved to bite by injecting `API_Catalog.md`'s own `POST /v1/tenant/branches` into the live document · **the `catalog/` module built to the scope its own README declares** (`b58fc92`): §4 names six ports and says M-031 delivers *"`index.ts`, `GYM_TIMEZONE_PORT`"*, which is narrower than the roadmap's file list and is the module's own committed contract — `BRANCH_QUERY_PORT` came with it because branches are this milestone's table. `GYM_TIMEZONE_PORT` reads `tenants.timezone` and **not** `cities.timezone`, which is one join shorter, populated, and marked *"presentation default; never authoritative"* by `TM3`: reaching for it computes membership boundaries a few hours out, invisible to any test using a single timezone and visible only as a member refused entry on the last day they paid for · `BRANCH_QUERY_PORT` answers existence AND ownership in one call, because a plan sold at another gym's branch **inside the same tenant** passes every RLS policy — RLS is about tenants, this is about gyms · **the wiring spec earned itself on its first run**, failing with *"Nest can't resolve dependencies of the `ElevatedTenantReader`"*: `tenancy` cannot boot without `audit`, because the reader writes its audit row before the elevation runs, and `catalog/` inherits that while touching neither · **`RD3` built** (`26bcf9c`) — *"a migration may `INSERT`/`UPDATE` only into the sixteen tables of §2.1"* was specified and absent, and the false positive that would have made it unshippable is that every FK in the repo carries `ON DELETE RESTRICT`, so the match is anchored to start-of-statement · **the deactivation rule built to `Gym.md` §12.4** (`4c19735`), which is rank 3 and richer than the roadmap's version: `BRANCH_HAS_ACTIVE_MEMBERSHIPS` and `CONFIG_VALIDATION_FAILED` registered from `API_Catalog.md` §6.6 and §6.13 (39 → 41 codes), and **`LAST_ACTIVE_BRANCH` deliberately NOT registered** — it appears in two rank-4 documents with no status attached and has no row in the error catalogue at all · **the affected-membership port answers `UNAVAILABLE`, not `0`**, against the roadmap's instruction: `0` is a number, and it states as a fact that closing the branch strands nobody — said by something that cannot count. The day `memberships` ships in Sprint 7 a `0`-returning adapter keeps saying "nobody affected", and nothing about adding a table makes anyone re-read the policy; `memberCount: null` separates *checked, nobody* from *could not check* · three decisions inside the rule: last-branch is checked **before** the count, so an owner is not sent to move 1,247 members and then met with a refusal no amount of moving clears; `PENDING_REVIEW` counts as listed alongside `APPROVED`, because a submission with no location is one a reviewer cannot assess; and **permission is not a boolean** — `uq_branches__one_primary_per_gym` forbids two primaries and not zero, so the verdict names the branch to promote · **2026-08-11 — the five branch routes SHIPPED and `BLK-19` is closed** (`6158e8d`): `GET`, `POST`, `GET/:id`, `PATCH`, `DELETE` on `/v1/tenant/branches`, each declaring a `CATALOG_PERMISSIONS` key, `PATCH` on `§B3.2` row 19 and the other four on row 20 — which reproduces `Gym.md` line 171 exactly (a manager may **edit** a branch and may not **open or close** one) · **`GYM_STATUS_PORT`'s adapter delivered here rather than at `M-032`**, because `mayDeactivate()` takes `DeactivationFacts.gymStatus` and the `DELETE` route cannot run without it; the README gives it to M-032 for `ordering/`'s sake and the branch lifecycle needed it first · `AFFECTED_MEMBERSHIPS_PORT` bound to an adapter that **only ever refuses** — unbound would fail DI at boot and take all five routes down, bound-and-refusing leaves four working · **`CatalogModule` was never in `AppModule`, for three commits.** `catalog-wiring.int-spec.ts` passed throughout because it boots the module in ISOLATION, so the DI graph was provably sound and the application never constructed it — the routes existed in source, in `openapi.json` and in no route table. That is `TD-045` one layer up, and the lesson did not transfer because the guard version was caught by a test asserting REGISTRATION while this one asserted only resolution. The spec now boots the real `AppModule` and probes all five paths over HTTP: **401 proves the route is served, 404 proves nothing is** · **two gates were green for the wrong reason:** `permissions-guard-registered.spec.ts` hard-coded four `permissions.ts` paths under a comment reading *"a list would go stale the first time a route was added"* — it had, and `catalog`'s five keys reported as *"defined in no permissions.ts"*; and `openapi:emit` held a hand-written placeholder for every env variable and died on `CLAMAV_HOST`, the same staleness its own header records from M-010 to M-020. Both now derive rather than list; the emitter reads `.env.example`, which `env-example-parity.spec.ts` already proves boots. **26 operations, up from 21** · **`APPLICATION_PRECHECK_OVERRIDE_REQUIRED` registered** (44 → 45): three rank-3 statements name it, the registry carried no row, and the DTO was ALSO missing `acknowledge_review` — so the error was unsatisfiable by any well-formed request and the material-field gate could never be passed · **the int-spec changed the repository.** `create()` bound `${stateCode}::char(2)`, and PostgreSQL treats an explicit `bpchar` cast and a column assignment differently: `'291'::char(2)` is `'29'` **silently**, `INSERT '291'` into a `char(2)` column is *"value too long"*. `state_code` decides **CGST + SGST versus IGST on every future invoice for a sale at this branch**, `'29'` is Karnataka, and `ck_branches__state_code_shape` passes the truncated value happily — so the DTO's `^\d{2}$` was the only layer. Cast removed; both halves asserted · `KL-113`…`KL-119` record what the routes cannot do, and **`KL-116` is a security gap**: no staff-to-branch table until `M-037`, so §12.1's *"a branch-scoped caller receives only assigned branches"* is unenforceable and every holder of `catalog.branch.list` sees the whole tenant — read only, same tenant, RLS untouched · **2026-08-11, later the same day — the four owed items landed** (`2b6e3bc`): **`catalog.seed.ts` at `SEED_VERSION 0.6`.** The payload was described in `tenants.ts` at `M-009` and never written — *"Single branch, the ordinary case"*, *"Multi-branch"*, *"Suspended, so `BR-GYM-01` visibility can be tested"* are three statements about a catalogue that held zero rows, so "multi-branch" described data that did not exist. Now three gyms, five branches, ten amenity claims, reference rows joined by **business key rather than a pasted uuid** — which is `TD-041`'s exact failure, and which makes a missing reference row a `NOT NULL` violation rather than a dangling id · **three indexes `Indexes.md` §11 specifies that the creating migration never built** (`20260811000000`), found by running `EXPLAIN` against the new branch list, seeing a sequential scan, and asking the document whether an index had been specified and skipped. It had — and one of the three, `idx_branches__tenant_id_gym_id`, carries the purpose *"`WHERE tenant_id=$1 AND gym_id=$2` — `SCR-DASH-004`"*, the route shipped hours earlier with nothing to serve it. Nothing recorded the omission, which `CLAUDE.md` §9.6 forbids on its own. Two further names diverge from the document with correct columns and predicates — `TD-050`, ACCEPTED, because renaming is a `DROP`/`CREATE` on a constraint `AC-3` names directly · **`AC-2` satisfied**: `ST_DWithin` plans as `Index Scan using gix_branches__location`, no sequential scan, k-NN ordering on the same index, measured at 20,000 branches and committed to `docs/database/catalog.md` §2 · **the measurement that nearly went wrong is the one worth keeping:** the first pass ran as `postgres`, where RLS does not apply, and the list query's index scan touched **39 buffers**; as `app_rw` with `app.tenant_id` set it touches **2**, because RLS supplies `tenant_id` — which is why `Indexes.md` puts it first, and why any benchmark taken as a superuser understates these indexes and would conclude the leading column is wasted · **`pnpm db:seed` could not run at all**: `describePermission()` searched `readKey` and `writeKey` only and threw *"is not in the §B3.2 matrix"* for `admin.user.read_permissions`, an `extraReadKeys` entry from `ADR-0043`. The message was also wrong — the key IS in the matrix; §5.6's header is *"Permission string(s)"*, plural, and five keys now live on `extraWriteKeys` alone, so a function knowing two of a row's keys reads an older matrix than the one shipped · **`AC-8` closed**: `ci:isolation-coverage` reports **7/7 tenant-scoped routes covered, 0 uncovered**. It had flagged all four `{id}`/collection branch routes, and both gaps were satisfiable only because the seed now exists — `IG-3` needed a tenant-B branch id, `IG-4` a non-zero tenant-A count. Tenant A holds **one** branch deliberately: tenant B holds three, so a globally broken tenant variable produces the wrong count rather than a plausible one · `docs/database/catalog.md` holds the baseline and the index reconciliation and deliberately repeats no specification; `docs/apis/api-ten-catalog.md` documents the five routes that exist and names the six that do not with the milestone owning each — `T-04.01` asks for eleven, and writing six contracts against no implementation is how a document starts being wrong · **`KL-120`** records `AC-5`'s *"requires an explicit reason"*: the criterion lives only in `Epic_04.md` and `Milestones_030-059.md`, **both rank 4**, and `Gym.md` §12.4 is rank 3 and specifies a bodiless DELETE — and the criterion's own words say *"the **confirmation** … requires an explicit reason"*, which is `SCR-DASH-004`'s dialogue. The rank check was run before the word "conflict" was written down, which is the lesson `PLAN.md` records · **STILL NOT `DONE`, and the two remaining items are named rather than rounded away:** `one-primary-per-gym.int-spec.ts` — *"two concurrent transactions both setting `is_primary` produce exactly one success and one unique violation"*, which needs two real sessions and is the only assertion in the milestone that a single-connection suite structurally cannot make — and `postgis-radius.int-spec.ts`, whose `EXPLAIN` half is now baselined and whose row-level half is not. `gym.prisma-repository.ts` and `branch.entity.ts` from the roadmap's file list are `M-032`'s aggregate work, not this milestone's acceptance criteria · 845 unit · 12 branch-write integration on real PG16 · 11 deactivation + wiring · depcruise **0 errors** (the last one was not M-031's: `onboarding`'s duplicate probe imported `type ElevationActor` out of `tenancy/prisma/`, a type-only edge the rule is right to refuse, re-exported from the public surface) |
| M-032…M-120 | Per `/docs/roadmap/` | ⬜ `TODO` | — | — |

**The demo surfaces were built off roadmap order, and two defects fell out of doing it.**

The owner needed something to show clients. Both surfaces are honest about what is behind them —
the admin console's unbuilt tiles carry a milestone name and **no figure**, and every page of the
website's fixture catalogue carries a banner saying the gyms are invented. A zero meaning "not
built" and a zero meaning "nothing to approve today" look identical, and only one needs an operator.

| Defect | Why it mattered | Fix |
| :--- | :--- | :--- |
| `ReadinessService.register()` was called by nobody, so `/readyz` always answered `not_ready` with an empty dependency map | Reporting not-ready until an infrastructure module wires in is CORRECT — which made this worse, not better: the pod would never become ready, never receive traffic, and stall a deployment around a process that was working perfectly. It had been latent since M-010 | Postgres and Redis register their own probes, next to the connections they probe |
| `app/loading.tsx` turned every website route into a streamed response | A stream commits its HTTP status with the first flushed byte, so `notFound()` on the gym route rendered the not-found page under a **200**. Invisible in a browser, and a soft-404 is exactly what `FR-SRCH-13` cannot afford — a crawler reading 200 keeps the dead URL indexed | The skeleton moved to `app/search/`, which never 404s. `soft-404.spec.ts` asserts no route calling `notFound()` has a `loading.tsx` above it |

The second one is worth remembering as a shape: it is committed by **adding a file**, in a
directory away from the route it breaks, and no reviewer looking at the diff would flag it.

**M-022's trap is the FALSE POSITIVE, and the roadmap says so before the code exists.**

A mobile browser restoring two tabs fires two refreshes within milliseconds carrying the same
generation. A naive detector reads the second as a replay, revokes the family, signs the member out
of every device they own, and files a security event that did not happen. `docs/runbooks/iam.md`
names this one of the module's top three failure modes because the damage is silent: members are
logged out at random, support cannot reproduce it, and the alert that would catch a real theft
drowns. `TR-28` permits a grace window **or** a rotation lock; the grace was chosen.

| | A distributed rotation lock | The 10-second grace (chosen) |
| :--- | :--- | :--- |
| Mechanism | serialise every refresh on a family through one mutex | compare `used_at` against a timestamp already on the row |
| Cost | a lock on the hottest authenticated path in the system | a stolen token stays worth something for ten seconds |
| Failure mode | a lock left holding after a crash signs the member out for its whole TTL | an attacker must replay **inside** ten seconds of a legitimate rotation |

The second failure mode is the smaller one. An attacker who can replay within ten seconds of the
real rotation was already watching in real time, and a real-time attacker holds the live token
anyway. `AC-5` demands the proof be **genuinely concurrent**, so `refresh-parallel-tabs.int-spec.ts`
fires with `Promise.all` and no clock manipulation at all — two tabs, then five.

**Three real defects, and the first one only a grant test could have found.**

| Defect | Why it mattered | Fix |
| :--- | :--- | :--- |
| `GRANT UPDATE (used_at, superseded_by_id)` permits `used_at = NULL` | The table comment already claimed *"append-only with ONE completion transition"*, and the grant was written to enforce it. A column-scoped GRANT restricts **which** column, never how many times or in which direction — so `app_rw` could un-spend a generation and silence reuse detection for the theft it was committing. | Migration `20260808100000_expand_add_refresh_token_write_once`: a `BEFORE UPDATE` trigger, because write-once is a statement about the **transition** and a CHECK cannot see `OLD` |
| The M-020 cleanup hook was failing silently | Every identity FK is `ON DELETE RESTRICT`. The moment login started minting a refresh token, the two-statement cleanup hit the FK instead of cleaning, and left accounts, sessions and tokens behind. The symptom surfaced in a different file — `users-constraints` counted 39 users against a seed of 11 and blamed its own probes. | Children first, and the cleanup now runs on **entry** as well as exit, so an interrupted run cannot fail the next one |
| `@ApiOkResponse` on login still described the pre-session body | Three front-ends and the generated client are built from `openapi.json`, not from the controller. The route returned a token the contract did not mention, so no typed client could read it. | `auth-sessions.contract-spec.ts` asserts the document, and asserts the refresh token is **absent** from every session-route body (`SE1`, `TK7`) |

**`AC-10` is the criterion that separates revocation from wishful thinking.** An access token is a
signed assertion with a fifteen-minute life, and revoking a session changes none of its bytes.
Without a denylist, *"revoked"* means *"the next refresh fails"* — and a thief whose family was just
detected and revoked stays authenticated for the rest of the quarter hour, after detection, after
the member pressed the button the product gave them. The Redis denylist is keyed on `family_id` with
a TTL equal to the access-token lifetime, so it holds only families revoked inside the current token
window. It is asserted **through the guard over HTTP**, never by reading the key back: a denylist
nobody consults is precisely the defect worth catching.

**M-021's two ceilings are independent, and implementing one is the documented trap.**

| Ceiling | Protects | What the other one misses |
| :--- | :--- | :--- |
| 3 sends per 30 min **per number**, 30 s cool-down | the MEMBER, from being SMS-bombed by anyone who knows their number | an attacker cycling ten thousand numbers never trips it once |
| 20 operations per hour **per IP**, captcha above 10 | the PLATFORM — at ~₹0.15 a message this is a direct financial exposure (`CON-02`) | one number hammered from many addresses still needs the per-number limit |

Both directions are asserted. The captcha threshold sits ten below the hard block deliberately: a
shared NAT — an office, a college, an Indian carrier's CGNAT, which is most consumer traffic —
legitimately produces many requests from one address, so blocking at 10 would deny real members
while challenging at 10 lets a human through and stops a script. A solved captcha does not lift the
hard ceiling; it proves a human, not an entitlement.

**`AC-AUTH-01.4` is two claims, and the second is the one a status assertion misses.**

*"The 4th send returns 429 **and no SMS is sent**."* The endpoint suite substitutes a **recording**
delivery adapter and asserts the delivery count did not move — a test checking only the status
passes against an implementation that sends first and refuses afterwards, which is exactly the
₹0.15-per-refusal failure the limit exists to prevent.

**One real defect, found by the endpoint spec.** `recordIpOperation` returns the post-increment
count, and the comparison used it directly — so the captcha landed on the **tenth** request rather
than *"above 10"*. One request early sounds harmless and is not: the threshold was chosen against
real CGNAT traffic, and every step earlier turns more legitimate members into people who must solve
a puzzle to sign in.

**And the suite found the control working against itself.** Seven tests failed on the first run with
`CAPTCHA_REQUIRED`, because every request in the file comes from `127.0.0.1` and the ceiling counted
the whole suite as one abuser. The per-IP counter is now cleared between tests — each is an
independent situation — and the ceiling is exercised deliberately by two tests that do not clear it.

**M-020 resolved three specification conflicts before writing any code — ADR-0033, 0034, 0035.**

| Conflict | Resolution |
| :--- | :--- |
| Password maximum: `Security.md` §2.4.1 says **128**, `Authentication.md` §5.2 says **256**, and `CLAUDE.md` §2 ranks them equally | **128** — not because one document wins, but because each states a *ceiling* and 128 is the only value leaving both true. Login keeps `min(1).max(256)`: a stored password may predate any policy, and refusing a LOGIN for it locks a member out with no path forward. |
| The verification and reset tokens have **no specified home**, and `Schema.md` §4's register is closed at 79 tables | Redis (`ADR-0034`). Also the better answer: the TTL *is* the storage so an expired token cannot be read at all, `GETDEL` makes single-use atomic, and nothing survives into a backup restored six months later. |
| `auth_sessions` is created by **M-022**, which depends on **M-020** — a cycle | Move the tables into M-020. `FR-AUTH-10` is rank 2; the milestone a table lands in is rank 4, *"a plan of work, never a source of requirements"*. `Authentication.md` §8.8: shipping a reset that leaves sessions alive *"is not a compatibility question"*. |

**`openapi:emit` had been dead since M-010, and every gate stayed green.**

The emitter boots the real `AppModule` against placeholder credentials. M-010 added `TenancyModule`,
whose three Prisma services `$connect()` in `onModuleInit` — so it died on *"Authentication failed
against database server"* and `openapi.json` was last written at **M-012**.

`ci:api-gates` **reads that document**. So PG-1, PG-2, PG-3 and PG-5 were being applied to a frozen
snapshot, reporting four operations passing while the application had moved on. No route actually
escaped the gate, because M-012's ping routes happened to be the last ones added before M-020 — that
is luck, not a control. Fixed with an explicit contract-only mode, plus a drift spec that runs the
emitter and diffs the committed document. The document now carries 8 operations.

**The tenancy extension had no notion of the IDENTITY class, and the whole auth track needed it.**

Every `/v1/auth/*` route returned `500 TENANT_CONTEXT_MISSING`: the extension wraps every model
operation in a transaction demanding `app.tenant_id`, and `users` is IDENTITY class — read *before*
a tenant is known, because the tenant is a **consequence** of the roles an identity holds.

`IDENTITY_MODELS` is a second exemption set rather than four more entries in `GLOBAL_MODELS`.
`GLOBAL` rests on *"there is no `tenant_id` here"*, which `rls-coverage.sql` PC2 proves
independently — and `UserRole` has one. Merging them would have made PC2's own premise false while
every test still passed.

**Three more defects, each found by a test written for something else:**

- **The Redis client kept the process alive.** Two isolation suites that boot a real app went from
  3 s to a 150 s timeout. In production the symptom is quieter and worse: `SIGTERM` never completes,
  so every rolling deploy waits out its grace period and is `SIGKILL`ed with requests in flight.
- **`ELEVATION_REFUSED` had no client-safe message**, shipped in M-014. Status right, code right,
  envelope right — the only wrong thing was the sentence a member reads. A coverage test now makes a
  registry row without a message impossible.
- **`markEmailVerified` moved the status to `ACTIVE` unconditionally** while its own comment said
  *"`PENDING_VERIFICATION` only"*. A suspended account could be revived by clicking a verification
  link sent before the suspension — an admin action undone from an old email.

**Two things in this milestone are deliberately absent.**

There is **no error code that distinguishes an unknown identifier from a wrong password**, and
`iam.errors.ts` defines no class for one. Both absences are the enforcement, and the spec asserts
the names stay unregistered: a distinct code is the easiest possible enumeration oracle — read
straight from the response body, no timing analysis needed — and it would undo the decoy-hash work
with a single line.

**Login issues no session.** `SE1` forbids a bearer string in a response body, and session creation
with rotation and reuse detection is M-022's (ADR-0011). M-020's login is verifiable and not yet
useful, which is the honest shape of a half-built auth track; the feature flag keeps the routes off
until it is whole.

**M-019 found two defects, both in constraints that would have failed in production and not in CI.**

**1. `ck_users__has_contact` made `BR-DAT-04` erasure impossible.** `Schema.md` §4.6 states two
rules one sentence apart: `CHECK (email IS NOT NULL OR phone IS NOT NULL)`, and *"erasure sets
email, phone, full_name, password_hash to NULL"*. Taken literally the second violates the first
**every time** — `data.retention-sweep` would raise 23514 on every DPDP erasure, and a legal
obligation would be unexecutable. The predicate is widened to
`erased_at IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL`, which makes **both** rules true:
a LIVE user with no contact point is still refused. Asserted from both sides, plus the real
`UPDATE` the sweep will run rather than an insert-shaped approximation.

**2. `UNIQUE (user_id, role_id, tenant_id)` was inert for exactly the rows that matter.** PostgreSQL
treats two NULLs as distinct, and **every platform-role grant has `tenant_id IS NULL`** — so the
constraint permitted `(alice, SUPER_ADMIN, NULL)` twice. Revoking one duplicate would leave the user
still a super-admin, from a row nobody was looking at. Fixed with `UNIQUE NULLS NOT DISTINCT`
(PostgreSQL 15+; this repository targets 16), with a positive control proving the same role at two
*different* tenants is still permitted.

**The one table in this schema with a `tenant_id` and no RLS policy.**

`user_roles`, and it is deliberate. A policy `tenant_id = current_setting('app.tenant_id')`
evaluates `NULL = <uuid>` for every platform grant — NULL, not TRUE — so every one becomes invisible
to every session including the platform's own, and the symptom is super-admins losing their own
permissions while the RBAC seed looks correct. `user_roles` is also what resolves an identity *into*
a tenant membership: a row that must be read to decide which tenant you are cannot be filtered by
which tenant you are.

M-019 adds **PC2-IDENTITY** to `rls-coverage.sql` so this stays one exception and not a precedent —
it reads the schema rather than the allowlist, so a second policy-less `tenant_id` table is reported
by name and cannot be added by editing a list.

**The permission catalogue is generated from the PRD, not transcribed.**

§B3.2 is 42 capabilities × 12 roles = **504 authorisation cells**, and one `—` typed as `●` is a
silent privilege change that no diff looks like. So `rbac-matrix.spec.ts` re-parses
`MASTER_PRD.md` §B3.2 at test time and compares every cell; the PRD stays the source of truth and
an edit to either side that is not mirrored fails the build. The `●`/`▪`/`○` legend is kept as three
distinct grants — flattening `○` into `●` would give a support agent write access to tenant pricing,
which is `PE-T5`'s refusal one layer down.

`Schema.md` §4.7's *"permissions **~180**"* is in its **Volume** sentence, beside `user_roles`
**520,000** and a 10× column — a capacity projection, not a register. The enumerated binding source
is §B3.2, which yields **64** keys. Seeding 180 invented keys to match a projection would put an
authorisation matrix nobody specified into the database.

**Twenty control tests had stopped running, and the suite still printed `fail 0`.**

The worst finding of the milestone, and it was found by accident. `pnpm infra:reset` destroys the
volume; the migrations recreate `gymmap_platform` and `gymmap_audit` with `LOGIN` and **no
password**, and `set-local-role-password.sql` set only `gymmap_app`'s. Neither role could connect.

Every isolation spec had the same `try { connect } catch { available = false }` shape, and every one
called that outcome *"no database"*. So the whole of `platform-elevation.int-spec.ts` reported
**SKIP** — `runElevated()`'s audit-row-before-work ordering, the `PE-T4` grant refusals, the `PE-T5`
refusal inside a tenant scope and during impersonation — and the run reported **`fail 0`**.

A control that silently stops running is worse than one that was never written: the green tick
becomes evidence for a claim nobody is checking. Two fixes:

- `set-local-role-password.sql` now provisions **all three** login roles and asserts, at apply time,
  that each reaches exactly one group role — memberships are exclusive because RLS policies are
  permissive and OR together.
- `test/isolation/_availability.ts` separates **"no database at all"** (a legitimate skip; a
  developer without Docker should not face 200 red tests) from **"database up, role out"**, which
  now **throws**. Verified by breaking the password on purpose and watching the suite go red.

Isolation is now **212 passing, 0 skipped** — up from a reported 137 that was really 137 of 157.

**A second real defect in M-017, from the same clock family as M-018's.**

`IdempotencyStore.claim()` supplied `expires_at` from the injected `Clock` and left `created_at` to
the column's `DEFAULT now()` — so `ck_idempotency_keys__expiry` was comparing **two machines'
clocks**. Skew larger than the retention window makes every claim raise 23514: on the payment path,
a total outage caused by NTP rather than by anything in the request. It surfaced because the
suite's `FixedClock` is pinned to a literal instant, real UTC passed it during the working day, and
a one-hour-retention fixture began failing on a test nobody had touched. Both timestamps now come
from the same clock, and the skew case is pinned by a test that sets the clock six years back.

**The migration ledger had drifted, and the fix was to prove the migrations from scratch.**

`_prisma_migrations` showed M-017 unfinished and M-018 absent, while both sets of objects existed —
they had been applied by hand during development. Rather than `prisma migrate resolve --applied`,
which would have papered over any real divergence, the database was **reset and all ten migrations
replayed on an empty volume**. That is what CI job 11 does, and it is the stronger evidence: the
migration files alone now demonstrably produce the schema.

**M-018 · `SELECT … FOR UPDATE SKIP LOCKED` is a lock, not a claim — and the difference cost 100 rows.**

The first dispatcher took the documented shape: `SELECT … FOR UPDATE SKIP LOCKED` to pick a batch,
process it, then `UPDATE … SET status = 'PUBLISHED'`. Four concurrent dispatchers over 500 pending
rows dispatched 600 times. **One hundred events were published twice.**

`FOR UPDATE` holds its row lock only until the transaction commits. The batch was selected in one
transaction, and the row went back to `PENDING` and unlocked the moment that transaction ended —
so the next dispatcher's `SKIP LOCKED` did not skip it, because there was nothing left to skip. The
fix is to claim and lease in a single statement:

```sql
UPDATE outbox SET available_at = <now + leaseMs>
WHERE id IN (SELECT id FROM outbox WHERE status = 'PENDING' AND available_at <= now()
             ORDER BY available_at, id LIMIT $1 FOR UPDATE SKIP LOCKED)
RETURNING …
```

The `UPDATE` makes the claim durable; the lease makes a worker that dies mid-batch recoverable
without a human. A sequential test passes against the broken version, which is why `AC-EP01-19` is
asserted with four *simultaneous* dispatchers rather than four sequential ones.

**One real defect found in M-017, which its own tests could not see.**

`IdempotencyStore.release()` set `expiresAt = now - 1000` to mark a claim dead. `idempotency_keys`
carries `ck_idempotency_keys__expiry` — `expires_at > created_at` — so **every release violated the
CHECK and threw**, every time. The interceptor's `.catch(() => undefined)` swallowed it. The visible
consequence: a failed request's claim was never released, and every retry of that key for the next
twenty-four hours waited ten seconds and timed out. Fixed to `createdAt + 1ms`, and the catch now
logs rather than discards — a swallowed error is a defect with a hiding place.

**`AC-FND-08.2` failed first, in exactly the way the invariant predicts.**

The outbox row must be written in the SAME transaction as the state change, or a crash between the
two produces a payment that succeeded and a membership nobody was told about. The first test used
`client.$transaction` on the *extended* client, so the writer opened a second, independent
transaction that committed on its own — the aggregate rolled back and the event survived. The trap
is that the code reads correctly. Fixed by entering through `runInTenantTransaction(raw, …)`, and
the test now rolls the outer transaction back and asserts the row is gone.

**M-017's concurrency guarantee is the UNIQUE constraint, not a lock.**

Twenty simultaneous requests carrying the same key all attempt one `INSERT`; PostgreSQL lets
exactly one succeed and raises 23505 on the other nineteen, atomically, at the storage engine.
Every alternative is worse — a `SELECT` then `INSERT` has a race between the statements, a Redis
lock adds a system that can be down while Postgres is fine, and an advisory lock holds a
connection for the duration of the work. `AC-FND-07.4` is asserted with twenty *simultaneous*
claims through twenty real connections, because a sequential test passes against an
implementation that has the race.

**One real defect, found by writing the failure-path test:**

A handler that throws SYNCHRONOUSLY — a guard clause or a validation throw in the method body —
threw before `.pipe` was reached, so the error escaped the `switchMap` projection and the `tap`'s
error branch never ran. The claim would have sat `IN_FLIGHT` until it expired, and every retry
for the next twenty-four hours would have waited ten seconds and timed out. Fixed with
`defer(() => next.handle())`, which turns the synchronous throw into an error notification the
release can see.

**M-016 turned on the lint gate, and it had never run.**

`no-float-money`, `no-tenant-id-parameter` and `no-type-import-in-ctor` were written in M-002
with passing `RuleTester` specs — and there was no ESLint configuration file to register them in,
so `pnpm lint` exited 2 (*"could not find a configuration file"*) and had done since. CI job 3
would have failed on the first pull request. A rule with a green unit test and no config is a
rule that has never seen the codebase.

Creating the flat config found six things. None was a defect the tests could have caught, because
the tests were the thing that was not running:

| Finding | Resolution |
| :--- | :--- |
| `AccessTokenVerifier` checked token expiry against `Date.now()` | The `Clock` is now injected and **required** — not optional-with-a-fallback, which would put the ambient clock back one level down where nothing flags it. Token lifetime is testable without waiting fifteen minutes. |
| Three Prisma services took `AppConfig` through the reflected parameter type | Now `@Inject(APP_CONFIG)`. They are provided by factory today, so TD-030 could not bite — but it would the moment somebody registered one by class reference, and the failure appears at boot pointing nowhere near the constructor. |
| `AuditPrismaRepository` used `import type` for `AuditPrismaService`, which is a real class | A value import, exactly as the rule says. |
| `no-float-money` fired on `minorExponent: number` | A false positive: it is a count of decimal digits, as much not-money as `commissionRateBps`. `exponent`, `precision`, `scale` and `digits` added to the rule's `NOT_MONEY` list. |
| `no-tenant-id-parameter` fired on `setCorrelationTenant` | A false positive: it attaches the tenant to the **log line**, which records the scope RLS already decided rather than choosing one. `logging/` exempted. |
| Two `eslint-disable` directives were dead, and `no-console` was not enabled | `no-console` is on now — `console.log(user)` bypasses Pino's redaction and puts personal data in a seven-year log estate (`BR-DAT-06`). The two bootstrap files keep narrow per-line disables, cited as CI job 3 requires, rather than a whole-file exemption in which a later `console.log` would go unflagged. |

The first attempt at the `no-type-import-in-ctor` exemption was *"the class carries no
decorator"*, which is broader than the reason for it: it silently disabled the rule for the plain
`class S { … }` shape the rule's own fixtures use, so the rule would have kept passing its unit
tests while catching nothing they describe. Replaced with `extends Error`, which is the actual
argument — an exception is never a Nest provider.

**M-015 found three defects, and two of them were live holes rather than test gaps.**

| Defect | Consequence | Why nothing caught it |
| :--- | :--- | :--- |
| `TenantContextMiddleware` was registered with `.forRoutes({ path: '*path' })` — Express 5 syntax on Express 4, which matches **nothing**. The middleware never executed. | `X-Tenant-Id` had **never been refused** in a real request — `AC-1`'s control against a client choosing its own tenant had not run. And every `@TenantScoped()` route answered `500`. | Its 29 unit tests instantiate the class and call `use()` directly. A unit test cannot see a registration that matches nothing; only a request can. `middleware-registration.int-spec.ts` now asserts it over HTTP. |
| The middleware read `request.principal`, which `JwtAuthGuard` sets — and Nest runs middleware **before** guards, so it was always `undefined`. | Recorded in M-011 as a known gap deferred to M-022, and it hid the defect above: both produce the same 500. | Nothing asserted over HTTP at all. M-015 needs a working tenant-scoped endpoint, so the fix came forward: `AccessTokenVerifier` was extracted and the middleware resolves the principal itself. The guard remains the **sole** rejecter, so `AC-7`'s single error shape still comes from one place. |
| `test:isolation` globbed `*.int-spec.ts` and `*.isolation-spec.ts`, silently excluding `dropped-policy.negative-spec.ts` — **A7 itself**, the assertion that makes the other six falsifiable. | A7 would never have run in CI. | A file that exists and is never run reports no failures, which is indistinguishable from passing. The glob is now one pattern, and `isolation-coverage.spec.mjs` asserts every spec file matches it. |

`GET /v1/tenant/ping` — the Sprint-0 exit-condition endpoint — **worked over HTTP for the first
time in this milestone**. A4, the positive control, is what reported that it did not.

### The UI shells were pulled ahead of the roadmap, deliberately

`docs/roadmap/` puts the first `packages/ui` tokens in **M-036** and the `customer-web` shell in
**M-048** — sprint 2 and sprint 3, roughly twenty and thirty-four milestones out. On 2026-08-07 the
project owner directed that the shells be built first, so that something is visible while the
backend milestones continue.

This is a change to the **plan of work**, which `CLAUDE.md` §2 places below the derived
specification and which the owner may re-order. It is **not** a change to any requirement: every
shell is built against `docs/ui/DesignSystem.md`, `Accessibility.md` and `Security.md` §11 as
written, and the three numbered items above cite the same acceptance criteria their original
milestones do.

What the re-ordering costs, stated rather than discovered later:

| Cost | Detail |
| :--- | :--- |
| `packages/ui` tokens were fixed before their first component | §12's process governs a token change, so a component that needs a value the scale lacks now requires an amendment rather than an edit. Accepted: the scale is taken verbatim from a specification that already enumerated every step. |
| M-036 and M-048 shrink | Both keep their screens (`SCR-ADM-002/003`, `SCR-WEB-002`) and lose their scaffolding. Their `PHASES.md` rows will say so when they land. |
| Two `M-002` deferrals discharged early | Tailwind preset + design tokens (was M-036) and the front-end `build` scripts (was M-034/M-048). Playwright and `size-limit` stay deferred — there is no journey to drive and no bundle whose budget means anything against a static page. |
| **Playwright discharged too, on 2026-08-10** | The clause above expired the moment `/search` rendered real listings from the catalogue: there is a journey. `apps/customer-web` now runs 88 checks across two viewports — route sweep, the crawler's view of the served response, rendered-DOM accessibility, and hit-testing over each control — so `test:e2e` and `test:a11y` have stopped being `echo "no-op"` and `packages/config`'s script contract no longer carries a `customer-web` `test:e2e` deferral. `@playwright/test` is `A-06`, and it is installed in the app rather than the root because `FolderStructure.md` R1a fixes the root `devDependencies` at seven. `size-limit` genuinely does stay deferred. |

**Three defects found while building the shells**, each fixed in the same change:

| Defect | Why it mattered |
| :--- | :--- |
| `DesignSystem.md` §2.4 puts the Tailwind preset re-export in `packages/config`, which makes `config` depend on `ui`. `packages/ui` already depended on `config` for its tsconfig preset, and **turbo refuses the resulting `build → build` cycle outright**. | Resolved by breaking the weaker edge: `packages/ui/tsconfig.json` extends the preset by relative path. The normative file location is preserved; the convenience is not. Recorded here because a relative tsconfig path looks like an oversight. |
| `not-to-dev-dep` rejected `tailwind.config.ts` importing `tailwindcss` for its `Config` type. | A false positive of the rule, not of the code: build configuration is executed by the build tool in the dev environment and never enters a pruned production image. The exemption now covers `*.config.*` and the preset, and `rules.spec.cjs` asserts application code is still **not** exempt. |
| A third structural test failed on its own documentation — a scan for `<MfaGate>` matched the header describing where the gate goes, after earlier scans matched `runElevated(` and `unsafe-inline` in comments. | Fixed structurally rather than case by case: both shell specs now strip comments before any structural assertion, and the CSP is asserted against the **emitted** policy string rather than the source that produces it. |

**M-014 found three defects that were not in its scope**, all of them gates that were reporting
success without doing any work. Each is fixed in the same commit:

| Defect | How long it had been wrong | Why nothing caught it |
| :--- | :--- | :--- |
| `apps/server/src/audit/infrastructure/` built its own `new PrismaClient()`, violating `no-raw-prisma-outside-tenancy` | Since M-013 | The local sweep ran `turbo run architecture`, and **every workspace's `architecture` script is `echo "no-op"`** — so three milestones were verified as "depcruise 0 errors" having cruised nothing. CI job 5 runs the real command and would have caught it on the first PR. The root script now runs what CI runs. The pool moved to `tenancy/prisma/audit-prisma.service.ts`, so all three `PrismaClient` constructions now sit in one directory. |
| `api-gates.spec.mjs` checked the LIVE `openapi.json` against its own three-code **fixture** registry | Since M-012 | It passed while there were no endpoints. The first real route emitted `UNAUTHENTICATED` — which *is* registered — so the spec failed and the gate passed. The live-document test now loads the real registry via `loadRealConfig()`. |
| `apps/server`'s `openapi:check` resolved `openapi.json` against `process.cwd()` | Since M-008 | It exited 1 every time it ran from the workspace, while the root `pnpm ci:api-gates` worked — two entry points disagreeing about where the repository is. Fixed with a `pnpm-workspace.yaml` walk-up. |

**M-002 deferrals**, made under the owner's *"do what is necessary, otherwise move on"* steer.
Each is deferred to the milestone that first creates a consumer for it — none is dropped:

| Deferred | Discharged by | Why it cannot be built yet |
| :--- | :--- | :--- |
| Jest preset + the NFR-MNT-01 coverage threshold map | M-005 / M-015 | Node 22's native type stripping runs the current specs; a Jest preset is needed once there are integration and Testcontainers layers to configure. |
| Playwright config | M-034 | No UI surface exists to drive. |
| `size-limit` budgets | M-034 | No bundle exists to measure against NFR-PERF-10. |
| Tailwind preset + design tokens | M-036 | Tokens are defined with the first `packages/ui` component, not before. |

**Deviations recorded during Sprint 0**

| # | Deviation | Resolution |
| :-: | :--- | :--- |
| D-1 | `nest.json` must set `verbatimModuleSyntax: false` (TS1287 — NestJS is CommonJS-first) | Recorded as **TD-030**; the residual hazard is closed by the `no-type-import-in-ctor` lint rule shipped in M-002. |
| D-2 | `nest.json` must set `strictPropertyInitialization: false` | Recorded as **TD-029**. |
| D-3 | `moduleResolution: node10` is deprecated in TypeScript 6 | Override removed; `nest.json` inherits `NodeNext`, which resolves as CJS because `apps/server` declares no `"type": "module"`. |
| D-4 | Roadmap M-003 names `IDEMPOTENCY_KEY_REUSED`; constitution §13.2.2 names `IDEMPOTENCY_KEY_MISMATCH` for the same condition | Constitution wins — it governs the registry, and §13.2.1 forbids two codes for one condition. Roadmap wording to be corrected. Noted in `packages/types/src/errors/registry.ts`. |
| D-5 | Roadmap M-003 AC-4 cites `Security.md` §2.3 as the error registry; §2.3 is the OTP design | Registry lives at `packages/types/src/errors/registry.ts` per constitution §13.2.1. The union is **derived** from it, so AC-4's intent is structural rather than CI-checked. |
| D-6 | Nest's built-in `ValidationPipe` requires `class-validator`, which would be a **substitution** for Zod (A-02) and is forbidden | Wrote `ZodValidationPipe` instead, which is what M-004's file list specified. Discovered empirically: the server refused to boot. |

### 🔴 BLK-05 — the roadmap has two incompatible milestone numbering schemes

**Status: OPEN. Halts front-end scheduling, per CLAUDE.md §3 and §9.3.**

`docs/roadmap/README.md` §5 and the four `Milestones_*.md` detail files assign **completely
different work to the same milestone ids**. This is not a drift of one or two rows — the schemes
disagree wholesale:

| id | `README.md` §5 says | `Milestones_*.md` detail says |
| :--- | :--- | :--- |
| `M-023` | Three app shells + TanStack Query provider — *FE-web* | The B3.2 matrix as data, `PermissionsGuard` — *BE* |
| `M-034` | Auth screens `SCR-WEB-016` — *FE-web* | `branch_hours`, `OperatingHours` — *BE* |
| `M-036` | Onboarding wizard steps 1–6 — *BE* | Reviewer console + **`packages/ui` tokens** — *Full-stack* |
| `M-042` | Reviewer console `SCR-ADM-002`/`003` — *FE-dash* | `search_documents`, the six indexes — *BE* |
| `M-048` | Zero-result recovery + Redis cache — *BE, 3h* | `SCR-WEB-002` + the **customer-web shell** — *FE* |

`README.md`'s own tie-break rule — *"this index wins on id, sprint, epic, size, role and
depends-on"* — **cannot be applied**, because the two documents do not describe the same work
under those ids. Applying it would silently reassign every front-end milestone.

**Why this blocks the front ends specifically.** Both schemes place the creation of `packages/ui`
and the three app shells in *different milestones in different sprints*. Until it is resolved
there is no defensible answer to "which milestone builds the admin dashboard shell".

**Resolution required from the project owner:** declare which document is normative for milestone
identity, then correct the other. Record in `DECISION_LOG.md`. Work below M-019 (the current
front) is unaffected and continues.

### ✅ BLK-06 — RESOLVED by ADR-0031. Scope was ONE domain, not twelve.

**Found by running M-012. Resolved 2026-08-07.**

The first reading was alarming and wrong. The conflict is not "domains versus Prisma" but
**`int4` domains specifically** — and exactly one domain in this schema is over `int4`. Testing
each numeric domain in isolation is what narrowed it:

| Domain | Base | Prisma write |
| :--- | :--- | :--- |
| `basis_points` | `integer` | **fails** |
| `money_minor` | `bigint` | works |
| `money_minor_nonneg` | `bigint` | works |
| the nine text/char domains | — | work |

`basis_points` is now a plain `integer` with an equivalent per-column `CHECK`. Every validation
rule survives; the other **eleven domains are untouched**. See ADR-0031.

<details><summary>The original analysis, kept for the record</summary>


Two binding decisions do not compose:

| Decision | Source |
| :--- | :--- |
| The schema uses **12 custom domains** — `money_minor`, `basis_points`, `currency_code`, `pan_in`, … | `Schema.md` §2.4 |
| **Prisma** is the ORM | `STACK_ADDITIONS.md` A-01 |

**Reads work. Writes fail.** A `prisma.tenant.create()` raises before the statement reaches the
RLS policy:

```
SQLSTATE 22P03 — incorrect binary data format in bind parameter 12
```

Parameter 12 is `reserve_bps`, domain `basis_points` over `integer`. Parameter 11
(`settlement_cycle_days`, a plain `integer`) binds fine.

**Proved, not inferred.** Altering that one column to plain `integer` makes the identical insert
succeed; altering it back reproduces the failure. Prisma sends the base type's binary format
while Postgres describes the parameter as the domain's own type.

**Why this is not resolvable in code.** Dropping the domains is a change to a binding
specification, and adopting a different ORM is a substitution `STACK_ADDITIONS.md` forbids.
CLAUDE.md §3 puts this decision with the owner.

**The options, with what each costs:**

| Option | Keeps | Loses |
| :--- | :--- | :--- |
| **A · Domains become table-level `CHECK` constraints** | Every validation rule, unchanged. Prisma writes work. | The named reusable type; §2.4's "would otherwise be restated on 200 columns" becomes literally true — the CHECK is restated per column. Recommended: the *validation* is what protects data, and it is fully preserved. |
| **B · Keep domains; writes go through `$queryRaw`** | §2.4 exactly as written. | Every write in the system becomes hand-written SQL, which defeats the ORM and multiplies the injection surface. |
| **C · Keep domains only on read-only columns** | Both, partially. | An inconsistent schema where the type of a column depends on whether the application writes it — the least defensible of the three. |

**Interim state at the time.** M-012 was complete and its isolation assertions proved: A2's
cross-tenant INSERT is exercised in raw SQL, which confirms `WITH CHECK` refuses it. Option A was
chosen — see ADR-0031 for the narrowed analysis and what it actually cost.

</details>

### ✅ BLK-07 — RESOLVED by ADR-0045. The register exists; two files share the name `ERD.md`.

**Found by M-006, deferred; forced by M-018, which had to create the column.**

`Schema.md` §2.5 and `Relationships.md` both say the `outbox` aggregate type is one of **the 26
aggregate roots listed at `ERD.md` §6**. `ERD.md` §6 lists none — it is a section about aggregate
boundaries, not a register. Deriving the set from the 79-table schema yields **36** candidates, not
26, and the ten-row difference is not obviously resolvable by reading: it turns on whether things
like `Invoice` and `SettlementBatch` are roots in their own right or parts of `Order` and `Payout`.

**`MG9` is why this cannot be guessed.** An enum value is permanent — addable, never removable
while a row holds it. Shipping a 36-value `outbox_aggregate_type_enum` and discovering the answer
was 26 leaves ten values that can never be withdrawn.

**What M-018 shipped instead.** `aggregate_type text` with a `CHECK` enforcing PascalCase. The
shape is constrained, no typo passes, and the day the register exists the column becomes an enum in
one migration with no data change. Recorded in `TECH_DEBT.md`.

**Resolved 2026-08-10, and no owner amendment was needed.** The analysis above is a faithful account
of **`docs/database/ERD.md`** §6, which is the *Foreign-key inventory*. The citations mean
**`docs/engineering/ERD.md`**, whose §6 is *"The aggregate map"* and whose §6.1 is *"Aggregate
composition"* — a numbered table of exactly **26**. Both citing documents were right; the search
that found nothing ran against the twin.

The paragraph above asks whether *"`Invoice` and `SettlementBatch` are roots in their own right or
parts of `Order` and `Payout`"*. §6.1 answers directly: rows **10** and **18**, roots in their own
right. And the 36-versus-26 gap closes on that section's own exclusions — six infrastructure
entities (`audit_log`, `outbox`, `idempotency_keys`, `notification_log`, `export_jobs`,
`report_definitions`) and sixteen reference rows *"managed by `admin/` as configuration, not as
aggregates"*.

`MG9` was the reason to wait and is now the reason to ship: a value is **addable** but never
removable, so a 27th aggregate costs one migration while a wrong value would have been permanent.
See `ADR-0045` — including the `KycDocument` defect the enum exposed the moment it landed.

### 🟠 BLK-08 — `job_runs` is not in the schema register, so it is a log line

**Found by M-018.**

`AC-FND-12.2` requires that a job which SUCCEEDS LATE raises an overrun alert, which means run
history has to be recorded somewhere. The obvious somewhere is a `job_runs` table. **`Schema.md` §4
is a closed register of 79 tables and does not contain one.** An eightieth table is a schema
amendment under constitution §24, not a milestone's prerogative.

**What M-018 shipped instead.** `JOB_RUN_SINK` — a port, with `LoggingJobRunSink` behind it — plus
**Postgres advisory locks** for the single-execution guarantee rather than a claims table. The
advisory lock is arguably the better mechanism regardless: it is released automatically when the
session ends, so a worker killed mid-job does not leave a claim row that blocks every subsequent
run until a human clears it.

If the owner amends `Schema.md`, a database adapter drops in behind the same port and **no job
changes**. Recorded in `TECH_DEBT.md`.

### 🟠 Coverage gaps found while scoping the two front ends

Neither is a conflict — they are **absences**, and both make a stated exit criterion unmeetable:

| Gap | Detail |
| :--- | :--- |
| `SCR-ADM-005`, `SCR-ADM-012` have backend only; **`SCR-ADM-006` appears in no roadmap file at all** | Yet M-117 AC-10 asserts *"all 15 admin screens"* are permission-gated, and the Sprint-15 exit declares the console complete. As written that gate cannot pass. |
| Customer-web screens with no delivering milestone | `SCR-WEB-001` (home), `-005`/`-006`/`-007` (checkout, payment, confirmation), `-008` (account home), `-010` (visit history), `-013` (write review), `-016` (auth), `-018` (for-gyms), and the city/category landing pages that M-120's `rel.discovery.city-launch-gate` assumes exist. |
| **A backend one, found later — 2026-08-10, while writing `roadmap/PLAN.md`.** `payout_accounts` is created by **no milestone** | `Schema.md` §4.4 specifies the table in full — `ifsc` with its `^[A-Z]{4}0[A-Z0-9]{6}$` check, `is_primary`, the `uq_payout_accounts__one_primary` partial unique index, the RLS key. `API_Catalog.md` 987–988 freezes `GET` and `PUT /tenant/payout-account` against `FR-ONB-06`. `§B3.2`'s *Change payout bank account* is shipped in `CAPABILITY_MATRIX` (`iam/permissions.ts` 643). And the string `payout_accounts` appears **zero times** across all four `Milestones_*.md`. So `FR-ONB-06` has no delivering milestone and the money path has no bank account to pay into. **Two adjacent claims were checked and are less severe, recorded so the gap is not overstated:** `commission_rules` **is** created — `Milestones_090-119.md` 1650, full migration spec, merely late; and `tax_profiles` appears exactly once, inside the *negative* clause *"no read path joins to `tax_profiles`"*, so it is referenced without being created and falls inside `BLK-04` regardless. |

`README.md` §9.3 is explicit that screen-by-screen build-out of all 55 `SCR-` ids is **not** in the
120 milestones, and estimates full decomposition at ~1,420 milestones / ~6,832 focused hours. The
120-milestone roadmap is a **structural spine**, not a complete build plan. `SCR-WEB-015`
(referrals) is correctly absent — descope `D-02` is taken.

### Phase 8 Unlock Record

| Field | Value |
| :--- | :--- |
| Unlocked | ✅ **Yes** — conditional on Phase 7 closing |
| Approved by | Project owner |
| Date | 2026-08-06 |
| Approved scope | Implementation per `/docs/roadmap/`, beginning at **M-001** and proceeding in ascending milestone order |
| Condition | Phase 7 must be `DONE` and verified before the first code commit |

**Standing constraints carried into Phase 8**

| # | Constraint |
| :-: | :--- |
| 1 | **Milestone order is not optional.** M-009…M-016 (tenancy, the Prisma tenant-context extension, the base repository, the CI isolation suite) must land before **any** feature touches tenant data. `BR-TEN-01` is made structurally true first, never retrofitted. |
| 2 | Every endpoint milestone ships its **isolation-suite coverage in the same milestone**. CI fails a tenant-scoped endpoint without it. |
| 3 | Every table milestone ships its **RLS policy and grants in the same milestone**. A table without a policy, even for one commit, is queryable. |
| 4 | Each milestone leaves the repository **green** — tests pass, build succeeds, nothing half-wired. A multi-milestone feature stays behind a flag until its last milestone. |
| 5 | **The scaffold already exists.** pnpm + Turborepo + commitlint + husky + lint-staged + prettier + dependency-cruiser installed; `apps/` and `packages/` created; git on `main`/`develop` with Conventional Commits in use. M-001 starts from there, not from `git init`. |
| 6 | Framework is **NestJS**, per the PRD. `apps/server/` currently holds only a README, so nothing has committed to an alternative. |
| 7 | Open blockers `BLK-03` and `BLK-04` gate **Sprint 11** (settlements), not Sprint 0. Work proceeds; the settlement milestones stop at the blocker unless answered. |
| 8 | Documentation written by this session is **untracked in git** and should be committed before the first code commit, so the baseline is recorded. |

---

## Cross-Phase Rules (apply to every phase)

1. **No code before Phase 8.** Illustrative snippets inside documentation are permitted and are
   explicitly labelled `illustrative — not committed code`.
2. **Traceability is mandatory.** Every artefact references the PRD identifiers it satisfies.
3. **Nothing is lost.** If a source requirement cannot be honoured, it is recorded in
   `KNOWN_LIMITATIONS.md` with a reason — never silently dropped.
4. **Tick as you go.** The moment a deliverable is complete, its box in this file is ticked and
   the phase status line updated in the same change.
5. **Conflicts stop work.** Any contradiction between documents halts the phase until resolved
   and recorded in `DECISION_LOG.md`.

---

## Progress Log

| Date | Phase | Event | Notes |
| :--- | :---- | :---- | :---- |
| 2026-08-05 | — | Tracker created | Workspace empty; documentation skeleton created under `/docs`. |
| 2026-08-05 | 1 | `MASTER_PRD.md` complete | 4,193 lines / 265 KB. Full three-part transcription of the source PDF. All 21 content-inventory families verified against source counts. Three source inconsistencies preserved verbatim and flagged `[EDITORIAL]` (logged as KL-001…003). |
| 2026-08-05 | 0 / 1 / G | Parallel authoring started | Constitution, PRD checklist, Phase-0 engineering plan, decision log and the four living documents dispatched. |
| 2026-08-06 | 0 / 1 / G | **Run aborted and rolled back** | Project owner ruled: *the PRD tech stack is authoritative and unchangeable; additions permitted only with prior approval.* The in-flight run had been briefed with Express in place of the PRD's NestJS. Run stopped; three contaminated partial drafts (`PROJECT_CONSTITUTION.md`, `CHANGELOG.md`, `MASTER_PRD_CHECKLIST.md`) deleted rather than patched. Both `[EDITORIAL]` stack notes in `MASTER_PRD.md` rewritten to record the PRD baseline as binding. |
| 2026-08-06 | 0 | `STACK_ADDITIONS.md` created | Gap-fill register: every slot the PRD leaves unspecified, the proposed addition, the PRD clause that opens the slot, and an approval column. Nothing marked approved without the owner's sign-off. |
| 2026-08-06 | 0 | **Stack additions approved** | A-01 Prisma approved (conditional on the mandatory tenant-context client extension). A-08 resolved: **polling for Phase 1**, Socket.IO deferred to Phase 2 behind `release.attendance.realtime_transport` — keeps the app tier stateless per `NFR-SCAL-03`. Remaining 28 approved as a block. A-19 (notification vendors) stays deferred pending `OQ-01`. **29 approved · 2 deferred.** |
| 2026-08-06 | 0 / 1 / G | **Phases 0, 1 and G CLOSED** | ~23,750 lines of documentation across 12 files. All acceptance gates green. Verified independently of the authoring agents: zero placeholders (`TBD`/`FIXME` scan clean), 30/30 ADRs carry all six required sections, 1,784 tickable checklist items, 110 `KL-` entries, 28 `TD-` entries, 35 mermaid diagrams, and zero framework contamination (`Express` appears only as a rejected option, a forbidden import, or a lint-rule name). |
| 2026-08-06 | — | **Three defects found in this tracker by an authoring agent, and fixed** | (1) Phase-G gate asked *"Why Express?"* — residue from the superseded draft; now *"Why NestJS?"*. (2) Phase-2 gate said *"all 78 `BR-` rules"*; the enumerated catalogue holds **95** identifiers across 13 families — corrected with the family breakdown. (3) Phase-4 and Phase-6 gates presupposed Prisma and shadcn/ui; both are now approved additions (`A-01`, `A-04`) and the gates cite them explicitly. Self-audit by a document-authoring agent is now a standing expectation. |
| 2026-08-06 | 6 | **Phase 6 CLOSED** | 8 UI documents, **14,381 lines**. All 55 screens specified with their four mandatory states. Wave 3 (`Navigation`, `Accessibility`, `ResponsiveBehavior`) was cut off by an **account session limit** — a different failure from the earlier `529` capacity errors — and was completed by hand from the agents' stopping points. Running documentation total: **≈ 129,250 lines across 80 files**. |
| 2026-08-06 | 5 | **Phase 5 CLOSED** | 10 API contracts, **21,730 lines**. Survived a sustained Anthropic capacity outage: three runs, 17 agents attempted, 12 lost to `529`, one run refused entirely at zero tokens. `Membership.md` §9–13, `Search.md` §2–13, `Reviews.md` in full and `Admin.md` §12–22 were completed by hand. Two material findings raised against upstream docs — a location-in-logs privacy gap (`OI-S1`) and a too-tight rate-limit budget (`OI-S2`). Running documentation total: **≈ 112,400 lines across 72 files**. |
| 2026-08-06 | — | **Repository and monorepo scaffold appeared** | Not created by this session. Git initialised with `main` and `develop`; `apps/{customer-web,gym-dashboard,admin-dashboard,server}`, `packages/{ui,types,utils,config}`, `infra/{docker,k8s,terraform}`, `.github/`; turbo, pnpm, commitlint, husky, lint-staged, prettier, dependency-cruiser installed. Faithful to the documentation — `pnpm-workspace.yaml` cites `A-05 · FolderStructure.md §3.1` and the two-glob rule. `apps/server/` holds only a README, so no framework is committed and NestJS remains open as specified. **`BLK-01` is resolved.** |
| 2026-08-06 | 4 | **Phase 4 CLOSED** | 10 database documents, **17,233 lines**. 79 tables, 183 RLS policies, 1,263 enforced constraints, 201 logical indexes with 63 declined in writing, 162 foreign keys. All 95 `BR-` identifiers graded for database coverage. Running documentation total: **≈ 90,000 lines**. |
| 2026-08-06 | 4 | Network outage; three documents completed by hand | Two waves lost all three of `Indexes`/`Constraints`/`MigrationStrategy` — the second time to `ENOTFOUND` (DNS), not load, and the Bash classifier went down alongside. The incremental-write rule meant 2,881 lines had already reached disk, so **nothing was lost**. Completed manually from the exact stopping points, matching established numbering and rule-id conventions. Confirms the incremental-write instruction as permanent policy: it converted a total loss into a partial one twice. |
| 2026-08-06 | 3 | **Phase 3 CLOSED** | 20 epics + index, **15,579 lines**. 8/8 agents clean. Verified: all 24 PRD modules claimed, all 21 files properly terminated, placeholder scan clean. `EP-08` corrected to Razorpay Route before the stale Stripe reference could propagate into the backlog. Running documentation total: **≈ 72,500 lines**. |
| 2026-08-06 | 2 | **Phase 2 CLOSED** | 16 engineering documents, **32,955 lines**, 98 mermaid diagrams. All gates green, verified independently of the authoring agents: 95/95 business rules covered (set-difference check against the PRD), zero placeholders, zero stack contamination, every document explicitly terminated. Running documentation total: **≈ 57,000 lines**. |
| 2026-08-06 | 2 | Mass agent failure, diagnosed and fixed | First attempt lost 12 of 14 agents to `Connection closed mid-response`. Root cause was mine: `parallel()` invoked eagerly for all three phase groups, so every agent started at once instead of in waves, against 250 KB+ outputs. Fixed by sequential `await` per wave, batches of 2–3, incremental file construction and a length target. Re-runs: 13/13 clean. |
| 2026-08-06 | — | **Launch market decided: INDIA** | `OQ-01` — the PRD's only *Blocking* open question — answered. Also resolves `OQ-02` (**10% standard / 5% renewal**, landing blended take rate inside `KPI-16`'s 8–12% band), `OQ-16` (India region, now **mandatory** under RBI payment-data localisation rather than configurable) and `OQ-20` (managed cloud). Full localisation analysis in `LAUNCH_MARKET_INDIA.md`: INR/paise with lakh-crore digit grouping · `Asia/Kolkata` at **UTC+05:30 with no DST** · GST 18% split CGST+SGST on intra-state supply · **April–March financial year** · a 10-document India KYC checklist · DPDP Act 2023. Six PRD conflicts raised as `BLK-03`. |
| 2026-08-06 | — | `BLK-01` deferred, `BLK-03` and `BLK-04` opened | Owner declined `git init` for now. Two new blockers opened from the India analysis, both requiring client or professional input rather than engineering work. |
| 2026-08-06 | 0 | Backend folder structure ruling | The PRD's §C1.3 23-module layout supersedes the 14-module list in the original engineering brief. Rationale: §C1.3 separates `ledger/`, `settlements/`, `refunds/` and `billing/`, which the brief collapsed into a single `payments` module — an unacceptable boundary for money code under `BR-FIN-01`. |

---

## Open Blockers

| ID | Blocker | Phase | Owner | Raised | Status |
| :-- | :--- | :-- | :--- | :--- | :--- |
| BLK-01 | Workspace is not a Git repository. Branch strategy in the constitution cannot be applied until `git init` is run. | 0 | Project owner | 2026-08-05 | ✅ **RESOLVED** 2026-08-06. Repository initialised outside this session with `main` and `develop` branches and Conventional Commits already in use (`chore(setup):`, `docs(setup):`). The constitution §20 branch strategy is now enforceable. **Note:** documentation written by this session is currently untracked and should be committed. |
| BLK-02 | 20 open questions (`OQ-01` … `OQ-20`) in the source PRD are unanswered. Documented defaults will be applied and recorded in `DECISION_LOG.md`. | 1 | Client sponsor | 2026-08-05 | **PARTIALLY RESOLVED** 2026-08-06 — `OQ-01`, `OQ-02`, `OQ-16`, `OQ-20` answered (see `LAUNCH_MARKET_INDIA.md`). 16 remain on documented defaults. |
| BLK-03 | **India launch surfaces six conflicts with PRD baselines.** Two are High severity and change the settlement design: (2) GST on platform commission is unmodelled by `A6.3`, needing a ninth persisted figure `commission_tax_minor`; (3) GST TCS / income-tax TDS obligations for e-commerce operators are entirely absent from the PRD. Also (1) Stripe Connect is not a viable India split-settlement adapter. | 2 → 5 | Client sponsor + tax advisor | 2026-08-06 | **OPEN — must resolve before Sprint 5, and conflict 2 before Sprint 11.** See `LAUNCH_MARKET_INDIA.md` §11. |
| BLK-04 | Seven items require a qualified Indian tax advisor and legal counsel, not engineering judgement — TCS/TDS applicability and rates, the correct SAC code, multi-state GST registration, RBI e-mandate thresholds, Aadhaar handling, and DPDP significant-data-fiduciary status. | 4 → 5 | Client sponsor | 2026-08-06 | **OPEN.** Architecture holds all of these as configuration, so resolution is a data task, not a code change. |
| BLK-05 | **The roadmap carries two incompatible milestone numbering schemes.** The same `M-NNN` id means different work in different files, so "milestone order is not optional" (Standing constraint 1) cannot be mechanically checked. | 3 | Project owner | 2026-08-07 | **OPEN.** See the section above. Work proceeds against `Milestones_000-029.md`, which is the more detailed of the two. |
| BLK-06 | `int4`-based Prisma domains reject binary bind parameters (SQLSTATE 22P03). | 5 | Project owner | 2026-08-07 | ✅ **RESOLVED** 2026-08-07 by ADR-0031. Scope was **one** domain, `basis_points`, now a plain `integer` with an equivalent per-column `CHECK`. The other eleven domains are untouched. |
| BLK-07 | **`outbox.aggregate_type` has no enumerable value set.** `Schema.md` §2.5 and `Relationships.md` both cite "the 26 aggregate roots at `ERD.md` §6"; that section lists none, and deriving the set yields 36. `MG9` makes an enum value permanent, so the ten-row difference cannot be guessed. | 3 | Project owner | 2026-08-07 | ✅ **RESOLVED** 2026-08-10 by **ADR-0045**, and the whole finding is one sentence: **there are two files named `ERD.md`.** The deferral note committed in `0_init` says *"BOTH citations are wrong: ERD.md §6 and §6.1 are the foreign-key register and the four FK conventions."* That accurately describes **`docs/database/ERD.md`**. It is not the file the citations mean. **`docs/engineering/ERD.md` §6 is "The aggregate map"** and **§6.1 is "Aggregate composition"** — a numbered table of exactly **26** roots, the number both `Schema.md` §2.5 and `Relationships.md` 714 give. The citations were correct for three weeks. **The "36 candidates" objection is answered in that same section**, by name: *"Six entities belong to no aggregate … `audit_log`, `outbox`, `idempotency_keys`, `notification_log`, `export_jobs`, `report_definitions`"* — precisely the rows the note called *"plainly not event-emitting aggregates"*. **Rank 1 is not overridden:** `PROJECT_CONSTITUTION.md` §4.3 names 18, §6.1 names 26 and says it is completing what the constitution does not do; the constitution's own *"Referenced by id only"* column names `User` and `CreditNote`, and rule **A2** makes a by-id reference an aggregate boundary — so rank 1 already implies roots its table omits. A test pins the 18 as a **subset**, because the day that stops holding, elaboration has become override. `20260810200000_contract_alter_outbox_aggregate_type_to_enum` ships the type, drops the old `CHECK` **first** (no `enum ~ text` operator exists, so leaving it makes the cast fail on revalidation) and converts the column; zero rows, verified first, so no rewrite. Probed live: 26 labels · `'Membership'` accepted · `'Outbox'` refused. **`TD-031` PAID.** **And the enum immediately found a real defect:** `upload-kyc-document.use-case.ts` emitted `aggregateType: 'KycDocument'`, which §6.1 lists among the entities **contained in** `Application`. It passed the PascalCase `CHECK`, passed the compiler because `DomainEvent.aggregateType` was `string`, and passed review even though the use case's own comment cited the right precedent. `DomainEvent` now types the field as the 26 — declared in `common/` rather than imported from Prisma, since §3.4.3 keeps ORM types out of ports. |
| BLK-08 | **`job_runs` is absent from `Schema.md` §4's closed 79-table register.** `AC-FND-12.2` needs run history to raise an overrun alert; an eightieth table is a §24 amendment, not a milestone's prerogative. | 3 | Project owner | 2026-08-07 | **OPEN, not blocking.** M-018 shipped `JOB_RUN_SINK` (a port) plus Postgres advisory locks — which self-release on session end, so a killed worker leaves nothing to clear. A database adapter drops in behind the port and no job changes. In `TECH_DEBT.md`. |
| BLK-09 | **The breached-password corpus has no approved `A-NN` row.** `Security.md` §0.4 registers it as `A-32` / `PROPOSED`; `STACK_ADDITIONS.md` holds A-01…A-30 and no A-31+ of any status. The number is *also* claimed by `CI_CD.md` (artefact signing) and `Monitoring.md` §11.2 (log store) — `Deployment.md` DP-O2 already records the collision. Two peer-rank documents additionally specify different MECHANISMS: a self-hosted Bloom filter (`Security.md`, which explicitly rejects the alternative) versus a third-party k-anonymity API (`Authentication.md` §8.3), differing in whether a new sub-processor exists at all under `OQ-16` residency. | 1 | Project owner + Data Protection | 2026-08-07 | **OPEN, not blocking.** M-020 ships the port with no adapter, per `Security.md` §0.4's own procedure. The bound implementation answers `UNAVAILABLE` and never `NOT_BREACHED`, so the gap is a counter pinned at 100% rather than a stub reporting success. In `KNOWN_LIMITATIONS.md` as `KL-099`. |
| BLK-10 | **`§B3.2` defines no capability for the two platform-wide admin reads.** `apps/server/src/admin/permissions.ts` declares `admin.platform_overview.read` and `admin.gym_register.read`; neither is in the 42-capability matrix, so `M-023`'s `PermissionsGuard` refuses both as `UNKNOWN_PERMISSION` — which is deny-by-default working correctly and reveals that the two keys were invented by the module rather than derived from the PRD. The nearest matrix keys are wrong in a dangerous direction: `catalog.gym_profile.read` is the PUBLIC marketplace read held by `VISITOR`, so mapping the register onto it would expose every tenant's commercial terms to an unauthenticated visitor. The matrix is rank-2 PRD data and cannot gain a capability from an implementation decision. | 1 | Project owner + Security | 2026-08-08 | **OPEN, not blocking — and this cell contained a FALSE STATEMENT until 2026-08-10.** It read: *"`PermissionsGuard` is registered per route rather than globally, so it governs only routes whose permission IS a matrix capability."* **It is registered nowhere.** Verified directly: `grep -rn "APP_GUARD" apps/server/src` returns four hits, all in `app.module.ts`, binding exactly `JwtAuthGuard`, `TenantGuard` and `PlatformRoleGuard`; `grep -rn "UseGuards" apps/server/src` returns **zero**. `PermissionsGuard` is exported from the guards barrel and referenced only in comments and READMEs. So the mitigation this row recorded does not exist, **`FR-RBAC-01` and `FR-RBAC-02` are unenforced at runtime across the entire API**, and `TD-034` — *"`/v1/admin/*` gated on PLATFORM role membership, not the `§B3.2` matrix"* — understates itself: the matrix gates nothing anywhere, not just `/admin`. Recorded as **`TD-045`**. **The blocker itself is unchanged**, and registering the guard is NOT the quick fix it looks like: an adversarial pass found that global registration **403s every authenticated route in the application**, because all seven currently declared permission keys sit outside `PERMISSION_KEYS` — including the three the `@Public()` exemption does not cover. What is needed remains either two new `§B3.2` rows under `MASTER_PRD` Part C §C10 change control, or a decision that `SCR-ADM-001` and `SCR-ADM-004` are covered by an existing capability. |
| BLK-11 | **`FR-RBAC-05`'s own endpoint declares a permission `§B3.2` does not define.** `API_Catalog.md` line 1077 freezes `GET /admin/users/:id/permissions` with permission `admin.user.read_permissions`; that key is not among the 42 capabilities, so `PermissionsGuard` would refuse the route as `UNKNOWN_PERMISSION`. This is `BLK-10`'s family and arguably its sharper form: the permission that gates the effective-permission INSPECTOR is itself absent from the matrix the inspector reports on. Mapping it onto a neighbour is not available either — the nearest keys are staff-management writes, and a support read must not imply a write. `API_Catalog.md` is rank-3 derived spec; the matrix is rank-2 PRD data and cannot gain a capability from it (`CLAUDE.md` §2). | 8 | Project owner + Security | 2026-08-09 | ✅ **RESOLVED** 2026-08-10 by **ADR-0043**, and one word in the framing above was carrying it: *"cannot **gain a capability** from it."* True, and inapplicable — no capability is gained. `API_Catalog.md` line 1119 classifies this endpoint as a **derived row** in its own words: *"`FR-RBAC-05` requires effective permissions to be inspectable by Super Admin; without an endpoint the requirement is unimplementable."* So the capability arrives from **`FR-RBAC-05`** — `MASTER_PRD.md` 1174, **rank 2**, which names its own holder — and rank 3 supplied only the STRING, which §5.6 says is precisely rank 3's job. `admin.user.read_permissions` is therefore a third permission string on the existing *Manage platform users* row, via a new `extraReadKeys` field. **Three tests, checked not asserted:** resource and scope match (the row governs platform-side accounts; the route's `scope` column is `platform` and its subject is a platform user's own permission set) · it is a READ, and `extraReadKeys` structurally cannot emit a write · the holder set is READ OFF `FR-RBAC-05` and matched against the row, never chosen. **Why this was safe when `BLK-19` was not, and it is a structural property rather than care:** all four refused escalations rode the same mechanism — `permissionsFor()` emits a read key for every non-`NONE` grant, so a multi-holder row widens silently. **This row has exactly one non-`NONE` grant.** There is no second role to widen to. Held by a general gate: `an extra read key may only hang off a capability ONE role holds` fails the build on any future multi-holder attribution, which turns capability shopping into something somebody has to write down. Plus twelve role assertions, because a test checking only `SUPER_ADMIN` passes just as happily when `SUPPORT_AGENT` gains it too. **The module prefix differs (`admin` vs this row's `iam`) and that is correct:** §5.1 constrains `<module>` to `§C1.3`'s 23 and nothing more, §7.3.1 makes it the module that OWNS THE ENDPOINT, and no rule requires a capability's keys to share a prefix. **`BLK-10` and `BLK-14` are NOT closed by this** — a derived row reaches an EXISTING capability; those two need one that does not exist, which is the `§C10` change. |
| BLK-12 | **The constitution and both shipped feature documents disagree about what a feature document is.** §21.3 `FD1` mandates five sections in a fixed order — Business Rules, Database, API, Flow, Future Improvements — and DoD item 23 requires all five; `DG3` requires a mermaid sequence diagram in every one. `docs/features/tenant-isolation.md` and `docs/features/session-lifecycle.md` both use a narrative spine instead (`## 1. What it is`, `## 2. How it is proved`, …) with ```text ASCII diagrams, and `M-015`'s own roadmap entry claims the file has "the five §21.3 sections" when it does not. CI job 22 checks only that a feature document EXISTS, which is why the drift survived two reviews. The divergence appears in none of `DECISION_LOG.md`, `TECH_DEBT.md` or `KNOWN_LIMITATIONS.md`, which `CLAUDE.md` §9.6 forbids. | 8 | Project owner + Technical Lead | 2026-08-09 | ✅ **RESOLVED** 2026-08-10 by **ADR-0041** — and the framing above was generous to the code. This was never a disagreement between documents of comparable rank: `PROJECT_CONSTITUTION.md` is **rank 1**, two files under `docs/features/` do not conform to it, and nothing recorded that — which `CLAUDE.md` §9.6 forbids on its own, conflict or no conflict. What made it read as a conflict is that both files are GOOD: narrative, readable, and one is even claimed by `M-015`'s roadmap entry to have the five sections. Drift with a plausible face is the kind that survives review. **The reading that decides it, and it costs less than this row assumed:** `FD1` says the five sections are *"mandatory and appear in that order"* — **not exclusive**, and no clause elsewhere makes them so. So a document carrying the five plus narrative conforms. The two existing files are non-conforming because they omit **all five**, not because they added prose, and the remedy is to add the five around what is already there. `docs/features/rbac.md` is therefore unblocked and written to §21.3 from the start. The two existing files and the missing CI shape-check are **`TD-043`**. |
| BLK-13 | **The hero image's alt text is specified twice, incompatibly.** `CustomerApp.md` line 447 says *"The hero image carries an empty `alt`"* — decorative. `apps/customer-web/test/hero.spec.ts` line 104 requires `alt={t('web.home.hero.photoAlt')}` and forbids `aria-hidden`, and the catalogue carries a real description. Both cannot hold. `ADR-0037` made layout, column order and the wireframes advisory; it did not touch alt-text policy, so this is not resolved by that decision. | 8 | Project owner + Accessibility | 2026-08-09 | ✅ **RESOLVED** 2026-08-10 by **ADR-0044**, and it should never have been raised. **This is not two documents disagreeing — it is a rank-3 specification and a rank-5 test file.** `CLAUDE.md` §2 puts *"code, tests, migrations, IaC, comments"* at the bottom of the ladder and calls code *"evidence of intent, never a statement of intent."* Precedence settles it outright: `CustomerApp.md` wins, the test is corrected. No owner, no Accessibility review, and not eight days. **What the row should have recorded is worse than what it did:** for those eight days the shipped component followed the TEST and not the specification — a rank-5 artefact overriding a rank-3 rule, unrecorded, the same class of drift `ADR-0041` found in `docs/features/`. **Both halves are now moot for a legitimate reason.** The "Chalk & Iron" rebuild (`e4b7144`, `42a5b1b`) removed the photograph entirely — verified, `hero.tsx` contains no `<Image`, no `<img` and no `alt=` at all, and the five tests that guarded it were replaced by one asserting its absence. Clause 1 is vacuous and honoured in substance (`aria-hidden="true"` on the drawn background is the same accessibility semantics `alt=""` would give); clause 2, *"every gym cover carries the API's `alt` text"*, is binding and honoured at `gym-photo.tsx` 60 and `gallery.tsx` 60/92. Removing the photograph was permitted by **`ADR-0037`**, which made `CustomerApp.md` §6.x layouts advisory while explicitly NOT lifting the accessibility floor (`AX2`, `AX4`, `AX8`, `AX9`, `NFR-USE-02`, `NFR-USE-04`) — so the alt-text policy stayed binding throughout and is satisfied rather than escaped. **Fifth mis-framing of the same kind**, alongside `BLK-12`, `BLK-18`, `BLK-20` and `BLK-21`: **the rank check belongs BEFORE the word "conflict" is written down.** |
| BLK-14 | **`§B3.2` defines no capability for a tenant SUBMITTING its own onboarding application.** The matrix holds two `onboarding.*` capabilities and both are the REVIEWER's — row 31 *Review KYC documents* (`onboarding.kyc_document.read`, `onboarding.kyc_review.create`) and row 32 *Approve / reject gym* (`onboarding.application_decision.create`), held by `VERIFICATION_OFFICER` and `SUPER_ADMIN`. No row grants a `GYM_OWNER` anything in `onboarding.*`, so `M-027`'s wizard has no permission to declare and `PG-1` requires every route to declare one. The near neighbours are wrong in a dangerous direction: `catalog.gym_profile.update` is editing a LIVE listing, which an unapproved applicant must not hold. Same family as `BLK-10` and `BLK-11` — a module needing a key the rank-2 matrix does not define. | 8 | Project owner + Security | 2026-08-09 | **OPEN, blocks `M-027`'s routes only.** `M-026`'s tables, RLS, grants and the reviewer-side keys are built and verified; `onboarding/permissions.ts` reads its keys OUT of `CAPABILITY_MATRIX` by capability label, so it throws at import if a row is renamed and cannot silently invent one. What is needed is one new `§B3.2` row under `MASTER_PRD` Part C §C10, ideally decided together with `BLK-10` and `BLK-11` so three related answers are one decision. ✅ **RESOLVED 2026-08-10 by ADR-0047 — the owner answered directly.** One new `§B3.2` row, **"Submit own gym application"**, `GYM_OWNER ●` and eleven `—`. `SUPER_ADMIN` is `—` deliberately: a platform actor must not author the artefact they later approve (`BR-GYM-03`). The holder set is **read off `FR-ONB-08`**, not chosen — `ADR-0043`'s rule. It carries five permission strings already frozen verbatim in `API_Catalog.md` §3.9, so no vocabulary is invented. **An adversarial pass found a deadlock behind it, settled by precedence rather than by a second decision:** `Gym.md` §9.2 refuses submission until *"≥1 **published** plan"*, but publishing needs an APPROVED tenant and approval needs submission — every owner would deadlock at step 4 forever. Rank-2 `FR-ONB-05` says *"at least one plan **created** before submission"* and §9.2's own side-effects paragraph says *"Nothing is published"*. **Created, not published.** **Two things this does NOT do:** KYC upload still cannot work (`ObjectStoragePort` and `MalwareScanPort` answer `UNAVAILABLE`/`UNSCANNED` by design), and it resolves **none** of the seven keys `TD-045` names — those are `admin.*`, `iam.*`, `tenancy.*`. Binding `PermissionsGuard` still 403s the application. Also surfaced: `POST /tenants` (wizard step 1) declares `tenancy.tenant.create`, which is in no matrix row — a second `BLK-14`-shaped hole nobody had raised. |
| BLK-15 | **`Schema.md` gives `kyc_checklists` two different grant classes, and they prescribe different DDL.** §1.3 (line 470) lists it among the GLOBAL reference tables *"written only by `admin/` through the audited reason-required path"* — the definition of **G-REF**, which §10.3 grants `SELECT, INSERT, UPDATE` to `app_rw`. §12.3 (line 2040) says *"Grants: **G-APPEND** on all three — versioned by validity window, superseded, never edited"* — `SELECT, INSERT`, and never `UPDATE`. §10.3's own illustrative G-APPEND grant list names `tax_profiles` and `subscription_tiers` and does **not** name `kyc_checklists`, so the file disagrees with itself in three places. This is not cosmetic: **CI-02** fails the build if a G-APPEND table carries `UPDATE` for `app_rw`, so the two readings cannot both be satisfied. The roadmap's M-029 entry says G-REF, but `docs/roadmap/` is *"a plan of work, never a source of requirements"* and does not settle it. | 8 | Project owner + Technical Lead | 2026-08-09 | ✅ **RESOLVED** 2026-08-10 by **ADR-0040** — grant class **G-COMPLETE**, and neither clause is amended. Read as a choice between two class names one document had to lose; read for what each is PROTECTING they never disagreed. §12.3 protects the PAYLOAD (a cited version must still say what it said — `ERD.md` §9.6 depends on it); §1.3 protects the WRITE PATH (configuration editable without a deploy, `FR-ADMN-06`). The fact that settles it: **superseding IS an UPDATE.** `superseded_at` is a column here, so under pure `G-APPEND` §12.3's own versioning model cannot be executed at all — the clause naming that class describes a behaviour the class forbids. `20260810170000_expand_grant_kyc_checklists_complete` grants `INSERT` plus column-scoped `UPDATE (superseded_at, updated_at, updated_by)`; `items`, `country_code`, `entity_type` and `version` stay ungrantable for UPDATE by any application role. Probed as `gymmap_app` rather than argued: `SET items` → permission denied · `SET version = 99` → permission denied · `SET superseded_at = now()` → `UPDATE 4`. Publishing a version is now INSERT-the-successor and close-the-predecessor in one transaction from the reason-gated `admin/` path, and nothing else is physically possible. Same technique and same reasoning as `D-03` on `applications.snapshot`. |
| BLK-16 | **The KYC enclave is specified in four ways that cannot all be built, and two of its four separations have nowhere to live in configuration.** `Security.md` §8.3 defines the enclave as four separations — separate bucket, separate KMS CMK (`K-03`), separate storage credential (`K-09`), and no CDN ever. Four problems, and they are one decision rather than four: **(1) TTL.** `Security.md` `KY2` says the signed URL lives **300 seconds**; `Admin.md` §5.2 line 753 says **15 minutes**. Both are rank-3 `docs/` specifications, so neither outranks the other. **(2) Single-use.** `Admin.md` §5.2 and `CP3` both require the URL to be *"time-limited, **single-use**, audited"*. A presigned S3 GET is **not single-use** and the AWS SDK cannot make it so — delivering this needs a redirect endpoint that no specification describes. **(3) `K-03` and `K-09` have no configuration keys.** `app-config.schema.ts` declares one `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` pair shared between the media and KYC buckets, and no KMS key id at all — so two of §8.3's four separations are currently *unrepresentable*, not merely unimplemented. **(4) Runtime `block_public_access`.** `AC-7` asks for it to be asserted *"by both Terraform and a runtime check"*, and the only source for the runtime half is `docs/roadmap/`, which is "a plan of work, never a source of requirements". | 8 | Project owner + Security + Engineering / DevOps | 2026-08-09 | **OPEN, and SHARPENED on 2026-08-10 — a researched reconciliation was REFUSED.** The recommendation was that the TTL conflict is not one: that `view_url` is a 15-minute URL on the platform's own origin and `KY2`'s 300 seconds times a separate presigned GET minted at redirect. Checked, and the documents do not support it. **`KY5` is decisive against it:** *"the `admin` CSP therefore admits **the enclave's signed-URL host** in `img-src` only"* — the browser fetches from the ENCLAVE, so `view_url` IS the presigned URL, and 15 minutes and 300 seconds time the same object. `KY3` agrees, putting `Content-Disposition` *"on the **presigned** response"*. That is a real conflict, now with evidence rather than as a suspicion. **The second half is worse and independent.** `Admin.md` line 753 calls `view_url` *"Time-limited, **single-use**, audited"*. A presigned S3 GET cannot be single-use — the signature is verified, not consumed. So either `view_url` is not presigned (contradicting `KY5`) or single-use is unachievable (contradicting `Admin.md`). Both cannot hold. **Both halves point at the same missing thing, and it is missing.** A platform redirect endpoint would make every clause true at once: the platform mints a 15-minute single-use token against its own origin, consumes it on redirect, and mints a 300-second presigned URL at that moment. **No such route exists.** Searched `API_Catalog.md` under six patterns — `kyc-documents/.*view`, `documents/:.*/view`, `view_url`, `/kyc/`, `kyc.*download`, `document.*redirect` — **zero hits**; the only KYC rows in the catalogue are the two checklist-config routes at lines 1096-1097. Adding it is an architectural addition, not a reading: an extra hop on every document view, a new `API_Catalog.md` row, and a permission key — which lands straight back in `BLK-19`. **That is why it was refused rather than adopted.** The owner's decision is one question: does the enclave get a platform redirect endpoint, or does one of `KY2`/`Admin.md` 753 give way? **Nothing is blocked on it today** — `KL-104` quarantines every uploaded document as `UNSCANNED`, so no reviewer can open one by any route, and `ObjectStoragePort.isPrivate()` refuses rather than answering. |
| BLK-17 | **A KYC document access is specified as two different audit rows, and the writer cannot guarantee either.** `Schema.md` §4.3 and `Gym.md` imply `action = 'EXPORT'` on `entity_type = 'KYC_DOCUMENT'`; `Admin.md` §3.4 line 436 says the row is `action = 'ELEVATE'` with `elevation_scope = 'KYC_DOCUMENT_ACCESS'`. **Both are writable** — `elevation_scope` is `text NULL`, not an enum — so the wrong choice produces a silently wrong row rather than an error, and the audit explorer's `FR-ADMN-09` question *"who looked at this owner's passport, when, and why"* would be answered by a filter that misses half the rows. Compounding it: `AC-8` requires that *"no signed URL is issued unless the audit row committed first"*, and **neither existing path can promise that**. `AuditPrismaRepository.append()` swallows write failures by design (`BR-DAT-01` availability trade-off), so it cannot refuse; and `runElevated()`'s own documented guarantee — *"BEFORE the work. If this throws, the elevation does not happen"* — is already false in committed code for the same reason. `ELEVATION_SCOPES` is additionally a closed four-value list that would throw on `KYC_DOCUMENT_ACCESS`. | 8 | Project owner + Security | 2026-08-09 | **OPEN, blocks `issue-kyc-access-url.use-case.ts`.** Note this route is *not* caught by `BLK-14` — its permission key exists (`onboarding.kyc_document.read`, row 31 of `§B3.2`). One decision settles both halves: whether a KYC access goes through `runElevated()` — needing a fifth `ELEVATION_SCOPES` value and a strict, throwing write path — or through a direct `EXPORT` append, needing `AuditWritePort` to grow an `appendOrThrow` and thereby changing a deliberate availability trade-off. Either edits modules outside `onboarding/`, which is why it is the owner's rather than the milestone's. Same family as `BLK-10`, `BLK-11` and `BLK-14` and best decided with them. **Separately and already fixed, because it needed no ruling:** a client-supplied `X-Correlation-Id` that passed the log-injection sanitiser but was not a uuid failed the `::uuid` cast inside that same swallowing `catch`, so **any caller could suppress their own audit row with one header** — see `d9119ce`. ✅ **RESOLVED 2026-08-10 by ADR-0047 — the owner chose `ELEVATE`.** `elevation_scope = 'KYC_DOCUMENT_ACCESS'` becomes the fifth value of the closed `ELEVATION_SCOPES` list. The deciding reason is that an elevation is what this **is** — a platform actor reading a tenant's private document — and `runElevated()` already carries the audit-before-work discipline the requirement needs. **`AC-8`'s ordering guarantee needs the second half of this row honoured, and that is the hard part:** `AuditPrismaRepository.append()` swallows write failures by design under `BR-DAT-01`, so it can never promise *"no signed URL unless the audit row committed first"*. A new **throwing** writer, `AuditWritePort.appendOrThrow`, is the mechanism — a deliberate, narrow exception to that availability trade-off, scoped to this path only and to nothing else. Recorded rather than generalised: the swallowing behaviour stays correct everywhere it already is. |
| BLK-18 | **As the deployed audit credential, EVERY audit write fails — and the failure is swallowed, so `BR-DAT-01` is unsatisfiable in any environment that uses it.** `AuditPrismaService` connects as `gymmap_audit`, a member of `app_append` and nothing else, and is **deliberately not** extended with the tenant-context extension. Its own header says why: *"an audit row's `tenant_id` is frequently NULL (an elevation belongs to no tenant, and neither does a platform-admin login), and the extension refuses any operation with no tenant in scope."* So `app.tenant_id` is never set on that connection. But `rls_audit_log__tenant_isolation`'s WITH CHECK reads `(tenant_id = current_setting('app.tenant_id')::uuid) OR (tenant_id IS NULL)`, and the **one-argument** `current_setting` **raises** `42704` when the setting is absent. PostgreSQL does not promise to short-circuit `OR`, and here it does not — the left operand raises before the right one, which is `TRUE`, is ever reached. **Every insert fails, including exactly the `tenant_id IS NULL` rows that clause exists to permit**, and `AuditPrismaRepository.append()` catches and logs by design. Proved as `gymmap_audit` against the live database: the insert fails with `42704`, and the identical insert **succeeds** once `app.tenant_id` is set — isolating the cause to the missing setting rather than to the grant, the enums or a NOT NULL column. It is invisible locally because `AUDIT_DATABASE_URL` is unset and the documented fallback is `DATABASE_URL` → `postgres`, a **superuser, which bypasses RLS entirely**. `audit_log` held **zero rows** when this was found. | 8 | Project owner + Security + Schema Owner | 2026-08-09 | ✅ **RESOLVED** 2026-08-10 by **ADR-0039**, and the fix turned out to be an ALIGNMENT rather than a new decision. `information_schema.role_table_grants` already said what the policy should have been: `app_rw : SELECT`, `app_append : INSERT`, `app_platform_ro : SELECT`. So the `FOR ALL` policy covered operations `app_rw` can never perform, and the tenant predicate on the write side applied only to `app_append` — the one role that structurally cannot satisfy it. `AuditStrategy.md` §2.3's own illustrative block specifies exactly the adopted shape: `FOR SELECT TO app_rw` for the read, a bare `GRANT INSERT` for the write. `20260810160000_expand_alter_audit_log_append_write_policy` narrows the read policy and adds `rls_<t>__append_write` — `FOR INSERT TO app_append WITH CHECK (true)` — to the parent, to all three partitions, **and inside `audit_log_create_partition()`**, because the parent's policies do not apply to a partition addressed by name and the cron path would otherwise re-introduce the defect on the first of the month. **`Constraints.md` §8.3 is NOT amended;** `missing_ok` is still never written, and a READ with no tenant context still raises — asserted. Seven properties probed against the live database rather than argued: the append write succeeds including `tenant_id IS NULL`; `app_append` is refused SELECT, UPDATE and DELETE; tenant A sees 1 of 2 rows; a tenant sees 0 platform rows; a context-less read raises `42704`; `app_platform_ro` still reads across tenants. The canary in `audit-correlation.int-spec.ts` was written to go red when this was fixed — it did, and is now three positive assertions. |
| BLK-19 | **The five tenant branch routes cannot declare a permission — and the framing below is a CORRECTION of what this row said before.** **What I got wrong.** I recorded this as *"`Security.md` and the shipped `CAPABILITY_MATRIX` agree on two keys, `API_Catalog.md` names five"*. The agreement is **coincidental and confined to row 20**. Spot-checked against the shipped matrix: *Browse marketplace* is `discovery.gym.search` in `Security.md` and `discovery.listing.read` in code; *Manage platform users* is `admin.platform_user.write` versus `iam.platform_user.read`; *Manage taxonomy* is `admin.taxonomy.write` versus `catalog.taxonomy.read`. Different **modules**, not different actions. `Security.md` §3.3.1 is therefore not the registry it presents itself as, and adopting it would require rewriting most of a shipped guard. **What IS settled, and it was written down all along.** `API_Catalog.md` §5.6: *"The `B3.2` matrix is expressed as **capabilities by role**; the API is expressed as **permissions by endpoint**. The join is `permissions.ts`, and it must be exact — a capability with no permission is unreachable, and a permission with no capability row is an ungoverned grant."* Its column header is **"Permission string(s)"**, plural, and its own rows carry three keys for one capability. So five keys deriving from one `§B3.2` row is not a conflict at all — it is the documented shape. **The vocabulary question is answered.** **What is actually open, and it is not what I thought.** The GRANT WIDTH. `Gym.md` line 167 attributes `GET /tenant/branches` to *"Edit gym profile (read half)"* with `● ▪ ▪ ▪` across `GYM_OWNER`, `GYM_MANAGER`, `RECEPTIONIST` and `TRAINER`. `§B3.2` row 19 (*Edit gym profile*) gives `GYM_MANAGER ▪`, `GYM_OWNER ●`, `SUPPORT ○`, `VERIF ○`, `SUPER_ADMIN ●` — and **`RECEPTIONIST` and `TRAINER` are both `—`**. Row 20 (*Add / remove branch*) is `GYM_OWNER ●` and `SUPER_ADMIN ●` and nothing else. A rank-3 API document is granting two roles a capability the rank-2 PRD gives neither. Precedence settles it in `§B3.2`'s favour — which means `SCR-DASH-004` as designed cannot be built, and that is a PRODUCT decision under `§C10`, not an engineering one. | 19 | Project owner + Security + Product | 2026-08-10 | **OPEN, and one researched recommendation was REFUSED on 2026-08-10.** A delegated attempt to settle the whole vocabulary was put through an adversarial pass and came back **FLAWED**, with four latent privilege escalations. Recorded here so the next attempt does not re-make them: **(1)** `admin.tenant.list` / `.read` re-attributed to *Edit gym profile*, widening them from `S.ADMIN ●`-only to include `SUPPORT ○` and `VERIF ○` — cross-tenant tenant search and detail, including effective commission rates. **(2)** `permissionsFor()` (`iam/permissions.ts`) emits a capability's read key for every grant that is not `NONE` and its write key for every grant that is not `READ`, so attributing a platform key to a tenant-held capability hands tenant roles platform keys mechanically. **(3)** `GYM_MANAGER` is `▪` on *Edit gym profile*, and `▪ !== READ`, so every write key attributed to that capability reaches it — including `onboarding.kyc_document.upload` and `.delete`, which `Gym.md` gives `MANAGER —`. **(4)** `catalog.branch.list` widened from `▪` to `●`; for a branch-scoped role that is the difference between listing assigned branches and listing every branch in the tenant, on a route `API_Catalog.md` tags `BR-TEN-03`. The structural flaw underneath all four: with 42 capabilities to choose from, any desired holder set can be legalised by naming whichever row happens to contain it — **capability shopping**, and the refused draft did exactly that, letting the wanted role set pick the capability rather than the reverse. Any future attempt needs a scope/module clause, not only a role-superset test. **What survived the pass:** §5.6's many-keys rule (independently verified), and **`BLK-11` resolves cleanly** — `admin.user.read_permissions` under *Manage platform users* is `S.ADMIN ●` with eleven `—`, which is exactly `FR-RBAC-05`. **`PG-7` is the lasting mitigation** (`50c29ed`): a key absent from every `permissions.ts` now fails the build instead of failing at request time. It cannot catch a key that is present but over-granted, which is what the four escalations are — that is `RB2`'s job and `RB2` remains unbuilt. ✅ **RESOLVED 2026-08-10 by ADR-0047 — the owner answered the product question directly: `RECEPTIONIST` and `TRAINER` DO see the branch list.** `§B3.2` rows 19 and 20 gain both roles. `SCR-DASH-004` can be built as designed and `M-031`'s five branch routes are unblocked. **Scope, stated because the answer did not distinguish it and the difference is large:** *"all three branches"* is read as **READ ONLY** — the list is visible; creating, editing and deactivating a branch stay with the owner. Widening a write is not something to infer from an answer about seeing a list, so it is written down rather than assumed. **This widens access, and it was the owner's to widen.** `ADR-0043`'s rule refuses *me* widening access without a document forcing it; the owner is the `§C10` authority. The narrower option (*"sirf apna assigned branch"*) was put first with its reasoning and was not taken — recorded so the choice is visible rather than looking like drift. `BLK-10` is separately advanced by the same session: `SUPPORT_AGENT ○` on the two platform-admin capabilities. |
| BLK-20 | **`state_code` — RAISED IN ERROR, and the error was mine twice over.** I recorded this as *"two rank-3 documents specify two different alphabets"* and shipped `ck_branches__state_code_shape` as `^[A-Z0-9]{2}$`, which accepted `27` **and** `MH` — the conflict procedure's step 1 violated (*"do not implement both"*) dressed as a permissive constraint. Both halves of the framing were wrong. **(1) It is not rule-versus-rule.** Every ISO-alpha occurrence sits inside a fence banner-marked `// illustrative — not committed code`: `Marketplace.md` 662 (banner 603), 1694/1699/1704/1709/1731 (banner 1690), `MigrationStrategy.md` 604 (banner 602) — verified line by line. Every numeric occurrence is a RULE: `SeedStrategy.md` §3.6's 38-row table with no alpha column at all, `Constraints.md` 638, `NamingConvention.md` 340, `Schema.md` 795, and `Gym.md` 1387's Zod `z.string().regex(/^\d{2}$/)  // GST state code`. **(2) The absence claim was false.** I wrote that `ck_tenants__state_code_matches_gstin` *"was never created, so tenants.state_code is unvalidated too"*. It has existed since `20260807000000` under a REVERSED name, `ck_tenants__gstin_state_matches` — I searched one spelling and concluded absence. That constraint settles the alphabet by itself: `state_code = substring(gstin, 1, 2)`, and a GSTIN opens with two DIGITS, so under the alpha reading every GST-registered tenant is unsavable. | 20 | Project owner + Finance + Schema Owner | 2026-08-10 | ✅ **RESOLVED** 2026-08-10 by **ADR-0038** — GST 2-digit numeric everywhere; ISO alpha enters no column. `20260810150000_expand_alter_state_code_to_gst_numeric` narrows the `branches` CHECK to `^[0-9]{2}$` and renames the `tenants` constraint to the name both documents specify, so the next reader grepping for it does not repeat my mistake. The canary in `catalog-tables.int-spec.ts` **flipped**: `MH` is now asserted as REFUSED, and tightening it turned five unrelated assertions red at once because the fixture had been using `'KA'` — which is the constraint doing its job. Six illustrative payloads in two documents are corrected alongside. **Worth keeping visible:** the blocker itself was the defect here. A permissive constraint is not a neutral holding position — it ships both readings and looks like caution. |
| BLK-21 | **The reference tables' business KEYS are fixed and their DISPLAY columns are not, and the schema makes the display columns `NOT NULL` — so four of the five tables cannot be populated at all.** `SeedStrategy.md` §3.7 enumerates **59 amenity keys** in six display groups (Facilities 16, Equipment 16, Classes 12, Services 6, Accessibility 6, Hours 3) and **15 `gym_categories` keys**; §3.6 fixes **twelve city slugs** with their GST state code, `status = 'PLANNED'` and `timezone = 'Asia/Kolkata'`. Not one `amenities.name`, `amenities.icon`, `gym_categories.name`, `gym_categories.slug`, `cities.name` or `cities.centroid` is fixed anywhere — and `Schema.md` §12.1/§12.2 make every one of them `NOT NULL`, which the shipped migration faithfully reproduces. Writing the rows therefore means inventing 74 display names, 59 icons, 15 slugs, 74 sort orders and 12 coordinate pairs. `docs/backlog/Epic_04.md` line 349 already classifies exactly this as an unmade **client decision**: *"Amenity taxonomy content — the actual list of amenity terms and their display priority for the top-three card slots."* | 21 | Project owner + Product Designer + Client Sponsor | 2026-08-10 | ✅ **RESOLVED** 2026-08-10 by **ADR-0042** — and this row rested on a misreading of its own single source. `Epic_04.md` line 349, read in full, says *"Search filters ship with a **placeholder taxonomy**; retrofitting terms is cheap, retrofitting **ids** is not, so the id scheme is fixed in Sprint 2 regardless"* — it ASKS for a placeholder and says the ids are what must be right. Against it, `SeedStrategy.md` §1.4 is **rank 3** and states a requirement: 59 amenity rows, 15 category rows. `docs/backlog/` is rank 4 and `CLAUDE.md` §2 calls it *"a plan of work, never a source of requirements"*, so it could not have held this hostage even if it had been trying to. **Fourth blocker of mine mis-framed the same way.** **Why this was safe to decide when the permission vocabulary was not:** `RD2` derives every id from the KEY, and §3.7 fixes every key — so the permanent part was never in question, and the part decided (four display columns) is editable through the `FR-ADMN-06` path without touching a foreign key. Reversibility is the whole difference from `BLK-19`. **Shipped:** `prisma/reference/{amenities,gym-categories,cities}.csv`, a `pnpm ref:generate` that emits the migration from them (`RD4` — no hand-written reference DML), and `20260810180000_expand_seed_reference_taxonomy`. Applied: 59 amenities, 15 categories and the **twelve §3.6 metros** — the last on a different footing, because a city name and a centroid are FACTS rather than choices, and the four coordinates `Marketplace.md` §10.1 carries match these to four decimal places. Every city is `PLANNED`: the launch city is a `C9.4` gate decision with five measurable criteria, not a data edit. Group counts group counts reconciling to §3.7 exactly (Facilities 16 · Equipment 16 · Classes 12 · Services 6 · Accessibility 6 · Hours 3) and **59 distinct icons**. 13 assertions, of which the load-bearing ones GREP `SeedStrategy.md` rather than restating it — an invented key would get a permanent id. **The caveat, stated rather than buried:** `lucide-react` is NOT installed, so every icon name was chosen against knowledge of the library and could not be checked against the package. `scooter` for `PARKING_TWO_WHEELER` is the likeliest miss and would be a fourth custom icon needing a §12 amendment; the fallback is in `ADR-0042`. A build-time check on unknown exports is owed the day the package lands. |
| BLK-22 | **The pre-check suite cannot be composed where both a rank-1 rule and a rank-3 rule want it, and the two want opposite things.** `apis/Gym.md` line 472 (**rank 3**) says the six `BR-GYM-09` pre-checks run *"synchronously inside the submission transaction"*. `PROJECT_CONSTITUTION.md` line 2773 `PE6` (**rank 1**) says *"A user request never fans out across tenants synchronously"*, and names the remedy: a pre-aggregated platform projection built by an **elevated job**. Two of the six checks — `DUPLICATE_REGISTRATION_ID` and `DUPLICATE_BANK_ACCOUNT` — are exactly cross-tenant fan-out. Precedence says rank 1 wins and the checks belong in an out-of-band job; `Gym.md`'s `422 GEO_ADDRESS_MISMATCH` at submission then cannot fire, which is why this is a real conflict rather than a reading. **It is live today, not theoretical:** `platform-elevation.ts` refuses `runElevated` inside a tenant scope, so under the synchronous shape those two checks report `ERROR` on **every** submission — and the refusal throws **before** the `PE2` audit append, so each one is an unlogged refused elevation. That destroys a security signal: the condition the probe's own comment calls *"the shape of an accidental privilege escalation"* would fire on 100% of legitimate traffic, making a genuine attempt indistinguishable from routine. **Two constraints must survive whichever shape the owner picks.** (1) `duplicate-registration-id.check.ts` writes `otherTenants: [{ tenantId, status }]` — other tenants' UUIDs and lifecycle status — into `precheck_results`, a column inside the submitting tenant's own RLS row that `Gym.md` line 1023 also puts in the tenant-facing `202` body. Cross-tenant evidence must never be composed in a tenant-scoped request nor serialised to a tenant-facing response, or `BR-TEN-01` leaks. (2) With four of six ports unbound today (`GEOCODING_PORT` has no adapter, duplicate-address and duplicate-bank have none) and `precheck_results` correctly outside `D-03`'s UPDATE grant, whatever ships **freezes four permanent `ERROR`s into every historical application** with no path to re-run them — and `approval-override.policy.ts` demands a written override reason for anything not `PASS`, so every approval acquires a boilerplate justification. That is the *"it flags, a human clicks Approve"* degradation the policy's own docblock exists to prevent. **The ports should land before persistence is wired, not after.** | 30 | Project owner + Security + Technical Lead | 2026-08-10 | **OPEN.** Raised after an adversarial pass **refused** a researched fix that would have moved the write into the submission transaction: the plan rested entirely on `Gym.md` 472 and was overruled by `PE6`. Filing it as tech debt was considered and rejected — `CLAUDE.md` §9.6 makes `TECH_DEBT.md` the home of a knowing shortcut, not a route around rank 1. **Nothing is blocked on it today** in the sense that nothing works either way: `SubmitApplicationUseCase` is itself unregistered and uncalled (`grep` returns only its own declaration), so the suite has no live caller regardless. Three sub-corrections ARE uncontested and safe to take now, and widen nothing: the migration's `DEFAULT '{}'::jsonb` drifts from `Schema.md` 885's `'{"schema_version":1}'`, `schema.prisma` carries the same drift, and a regression lock should pin `precheck_results` into the denied-column loop so nobody "fixes" this by granting `UPDATE` — which would open a post-decision mutation path on the very artefact a reviewer's approval rests on. |
