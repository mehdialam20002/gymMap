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
**Status.** `IN PROGRESS — Sprint 0 foundations, plus the three UI shells pulled ahead. 16 of 120 milestones. The customer website and admin console shells both build and serve, the cross-tenant isolation suite is green on a real PostgreSQL 16, and the lint gate runs for the first time.`

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
| M-017…M-120 | Per `/docs/roadmap/` | ⬜ `TODO` | — | — |

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

### 🟠 Coverage gaps found while scoping the two front ends

Neither is a conflict — they are **absences**, and both make a stated exit criterion unmeetable:

| Gap | Detail |
| :--- | :--- |
| `SCR-ADM-005`, `SCR-ADM-012` have backend only; **`SCR-ADM-006` appears in no roadmap file at all** | Yet M-117 AC-10 asserts *"all 15 admin screens"* are permission-gated, and the Sprint-15 exit declares the console complete. As written that gate cannot pass. |
| Customer-web screens with no delivering milestone | `SCR-WEB-001` (home), `-005`/`-006`/`-007` (checkout, payment, confirmation), `-008` (account home), `-010` (visit history), `-013` (write review), `-016` (auth), `-018` (for-gyms), and the city/category landing pages that M-120's `rel.discovery.city-launch-gate` assumes exist. |

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
