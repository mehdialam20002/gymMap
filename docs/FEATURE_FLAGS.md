# FEATURE_FLAGS — Flag Registry and Governance

**Gym Marketplace & Multi-Tenant Gym Management SaaS**

| Field | Value |
| :--- | :--- |
| Document type | Living document (Phase G deliverable, `/docs/PHASES.md`) |
| Status | Active from 2026-08-06 |
| Owner | Technical Lead / Architect (`C9.3`) |
| Authority | Subordinate to `/docs/PROJECT_CONSTITUTION.md` and `/docs/MASTER_PRD.md` (see `/docs/README.md` precedence order) |
| Governing requirements | `FR-ADMN-08` · `NFR-MNT-07` · `§C1.5` · `FR-ADMN-02` · `SCR-ADM-011` · `B3.2` |
| Companion documents | `/docs/DECISION_LOG.md` · `/docs/TECH_DEBT.md` · `/docs/KNOWN_LIMITATIONS.md` · `/docs/CHANGELOG.md` · `/docs/engineering/STACK_ADDITIONS.md` |

---

> ## ⚠️ UPDATE TRIGGER
>
> **This file is edited in the same commit as the change it records — never afterwards, never in a
> follow-up ticket.** Edit it whenever a flag is:
>
> 1. **Created** — a new key is added anywhere in the codebase, in any surface, for any reason.
> 2. **Changed** — its default flips, its targeting rules change, its owner role changes, its
>    retirement date moves, its description no longer matches what turning it off actually does, or
>    its related PRD identifiers change.
> 3. **Defaulted-on** — it passes gate **G2** in §4 and moves from `ACTIVE` to `DEFAULT-ON`.
> 4. **Retired** — it passes gate **G3**, the losing branch is deleted, and the row moves to
>    `REMOVED`.
>
> Four further triggers, which are edits of the same kind and are equally mandatory:
>
> 5. **Rolled back** — a flag is turned off in production to arrest a defect; the row moves to
>    `ROLLED-BACK` with the defect reference and severity (`C8.5`).
> 6. **Withdrawn** — a `PROPOSED` flag is abandoned before any code exists; the row moves to
>    `WITHDRAWN` and the key is burned, never reused.
> 7. **Reassigned** — the person holding the owner role leaves the flag; the row is reassigned within
>    five working days or the flag is removed (`RSK-14`).
> 8. **Kill-switch pulled or restored** — a `PERMANENT` row records the date, the reason code and the
>    incident reference in its Notes; the row itself never changes status.
>
> **A change to a flag that is not reflected here is a defect, not an oversight.** CI enforces this:
> gate `FF-CI-02` in §6.4 fails any build whose code references a key this registry does not contain.

---

## Table of contents

1. [Purpose and the governing PRD requirements](#1-purpose-and-the-governing-prd-requirements)
2. [Flag taxonomy — five types](#2-flag-taxonomy--five-types)
3. [Naming grammar](#3-naming-grammar)
4. [Lifecycle](#4-lifecycle)
5. [Evaluation semantics](#5-evaluation-semantics)
6. [Testing rule](#6-testing-rule)
7. [The registry](#7-the-registry)
8. [What is not a feature flag](#8-what-is-not-a-feature-flag)
9. [Open items, dependencies and pending stack slots](#9-open-items-dependencies-and-pending-stack-slots)

---

## 1. Purpose and the governing PRD requirements

A feature flag on this platform is a **server-evaluated, audited, owned, dated switch** that decides
whether a named capability is available to a named principal. It exists so that three things the PRD
demands can be true at the same time: trunk-based delivery with short-lived branches (`§C7`), zero
user-visible risk from an unfinished feature merged to trunk, and a rollback that takes seconds
rather than a deploy cycle.

### 1.1 The three requirements this document implements

| Requirement | Text (verbatim from `MASTER_PRD.md`) | What this document does about it |
| :--- | :--- | :--- |
| **FR-ADMN-08** (M) | *"Feature flags with targeting by tenant, by role and by percentage rollout, changeable without deployment."* | §5.2 fixes the precedence between the three targeting dimensions and makes it total, so two rules can never both "win". §5.4 defines "changeable without deployment" as a write to the `feature_flags` reference table (`§C2.3`) plus a cache invalidation, propagating in ≤ 60 s. §7 is the registry those rules target. |
| **NFR-MNT-07** | *"Feature flags for all significant new functionality, enabling dark launch and instant rollback."* | §2 defines what counts as *significant* by giving five types with different rules, so the requirement does not degrade into "flag everything" (unreadable) or "flag nothing" (unreleasable). §4 defines dark launch as the `ACTIVE` state at 0% and instant rollback as a targeting write, not a revert. |
| **§C1.5 Cross-cutting mechanisms** | *"Feature flags — evaluated server-side; the client receives the resolved set. Flags support tenant, role and percentage targeting."* | §5.1 makes server-side evaluation the only evaluation, and §5.5 defines exactly which subset of the resolved set each of the three surfaces receives. §6.4 gate `FF-CI-08` fails any build in which a client makes a decision from anything other than the resolved set. |

### 1.2 Two further requirements that constrain every flag change

| Requirement | Constraint |
| :--- | :--- |
| **FR-ADMN-02** (M) | *"Every administrative action requires a reason and is written to the audit log."* A flag change is an administrative action. There is no unreasoned flag change, including a kill-switch pull. §5.7 specifies the audit record. |
| **SCR-ADM-011** | *"Every configuration change requires a reason, shows a preview of affected entities, and is audited."* The flag console must show, before the change is committed, how many tenants and how many users the new targeting resolves to. A flag change with an unknown blast radius is not permitted. |
| **B3.2 permission matrix** | *"Toggle feature flags"* is `●` for `SUPER_ADMIN` and `—` for every other one of the twelve roles. No gym owner, manager, finance analyst, moderator, verification officer or support agent may change a flag, at any scope, ever. Per-tenant flag state is visible to `SUPER_ADMIN` on the tenant detail Configuration tab (`SCR-ADM-004`). |

### 1.3 What flags protect

Flags exist to protect five things, in this order of importance:

1. **Money.** A defect in `ordering`, `payments`, `billing`, `ledger`, `settlements` or `refunds`
   costs real currency and takes a settlement cycle to unwind (`A6.3`, `A6.4`). Anything new in
   those modules ships behind a flag with a named person able to pull it.
2. **Tenancy.** `BR-TEN-01` is a legal obligation. Flags never gate isolation — but new code paths
   that *touch* tenant-scoped reads ship flagged so that a suspected leak can be contained in one
   action while `E2E-11` is re-run.
3. **The door.** Check-in is the daily habit (`B5.13`) and `NFR-AVL-02` makes it and payment the
   last things to degrade. Every kill-switch in §7.3 is specified with an explicit statement that
   check-in keeps working when it is pulled.
4. **Trust.** Verification (`BR-GYM-01`, `BR-GYM-03`) and review integrity (`BR-REV-01`,
   `BR-REV-03`) are the marketplace's only durable moat (`OBJ-03`). Flags may slow these mechanisms
   down; §6.3 forbids them from switching them off.
5. **Launch sequencing.** `RSK-10` (supply–demand imbalance) is the most likely cause of a
   technically successful launch that fails commercially. `C9.4` gates consumer marketing city by
   city; `rel.discovery.city-launch-gate` is the switch behind those five conditions.

### 1.4 Where flags live

| Concern | Mechanism | PRD basis |
| :--- | :--- | :--- |
| Definition of record | `feature_flags`, a **platform-global reference table**, not tenant-scoped, exempt from RLS | `§C2.3` |
| Per-tenant overrides | Rows keyed on `tenant_id`, resolved by the precedence in §5.2, surfaced on the tenant Configuration tab | `FR-ADMN-08`, `SCR-ADM-004` |
| Evaluation cache | Redis 7, 60-second TTL, invalidated on write | `§C1.1`, `FR-RBAC-04` (60-second propagation precedent) |
| Owning module | `admin/` — *"configuration, feature flags, taxonomy, audit explorer"* | `§C1.3` |
| Administrative API | `GET/PUT /admin/config/flags` | `API-ADM` (`§C3.2`) |
| Console | `SCR-ADM-011` Configuration screens, `/config/flags` | `§B4.3`, `§B8` |
| Audit sink | `audit_log`, append-only, partitioned monthly, with `reason` populated | `§C2.2`, `BR-DAT-01`, `NFR-SEC-13` |

> **Sequencing note.** `§C9.1` places the flag **console** in sprint 15. The **evaluator and this
> registry must exist from sprint 0**, because `NFR-MNT-07` applies to the first significant feature
> built, which is in sprint 1. Until sprint 15, targeting changes are made through
> `PUT /admin/config/flags` with the same mandatory reason and the same audit record; only the
> user interface is late. This is recorded so that nobody reads `§C9.1` as permission to build
> sprints 1–14 unflagged.

---

## 2. Flag taxonomy — five types

Five types, five sets of rules. The type is not decoration: it fixes the prefix (§3), the maximum
lifespan (§4), the owning role, whether targeting is permitted, and whether CI's expiry gate applies.

### 2.1 The five types

| Type | Prefix | Definition | Typical lifespan | Owner role | May it become permanent? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Release** | `rel` | Hides functionality that is merged to trunk but not finished, not announced, or not yet decided by the client. Enables dark launch: the code path is live and exercised at 0% before anyone sees it. | **≤ 90 days** from creation | **Product**, delegating day-to-day operation to the backend or frontend engineer owning the `§C1.3` module | **No.** A release flag that survives its feature is dead weight in every code path it touches. It ends `REMOVED`. |
| **Experiment** | `exp` | Splits traffic between two implementations of the same user-facing intent in order to measure a named `KPI-` difference. The arms are equivalent in obligation and differ only in treatment. | **≤ 60 days** from creation | **Product** | **No.** It ends in a decision recorded in `/docs/DECISION_LOG.md`, after which the losing arm is deleted. An experiment left running is a fork of the product nobody chose. |
| **Operational kill-switch** | `ops` | Shuts one subsystem down under incident, load or third-party failure while everything else keeps working. It is the executable form of `NFR-AVL-03` (*"loss of maps, search indexing, notifications or analytics must not prevent check-in, purchase or payment"*) and of product principle 6, *"degrade, do not fail"*. | **The life of the subsystem** | **Engineering** (technical lead, operated by whoever is on call). Money subsystems — `ops.payments.*`, `ops.settlements.*` — are **co-owned by Finance**, and either owner may pull. | **Yes — permanent by design.** These rows are marked `PERMANENT`, carry no retirement date, and are exempt from the CI expiry gate. See §2.3. |
| **Permission / entitlement** | `ent` | Makes a capability available to a subset of principals by **subscription tier** (`A6.2`, `FR-ADMN-04`) or by **role** (`B3.2`). It answers "are you entitled to this?", never "is this finished?". | Until the capability graduates into the tier or permission model | **Commercial** (Sales, `A5.2`), except `ent.iam.*` which is **Engineering** because it gates a security capability | **No, but long-lived.** It ends by **graduation**, not deletion: the entitlement moves into `subscription_tiers` configuration (`FR-ADMN-04`) or the RBAC matrix (`FR-RBAC-01`), and the flag is removed. The retirement date is the graduation deadline. |
| **Migration** | `mig` | Routes traffic between an old and a new implementation of the **same** behaviour during a cutover, with both paths asserted equivalent. Never introduces user-visible change. | **≤ 180 days** from creation | **Engineering** | **No.** It ends when the old path is deleted. A migration flag past 180 days means the migration stalled, which is a `TECH_DEBT.md` entry, not a flag policy question. |

### 2.2 Rules that differ by type

| Rule | `rel` | `exp` | `ops` | `ent` | `mig` |
| :--- | :-: | :-: | :-: | :-: | :-: |
| Default at creation | `OFF` | `OFF` | `ON` | `OFF` | `OFF` |
| Targeting permitted | tenant, role, percentage, city | percentage only | **none — global only** | tenant, role | tenant, percentage |
| Retirement date required | Yes | Yes | **No — `PERMANENT`** | Yes (graduation deadline) | Yes |
| Subject to CI expiry gate `FF-CI-04` | Yes | Yes | **No** | Yes | Yes |
| Both branches must be tested (`FF-CI-05`) | Yes | Yes | Yes | Yes | Yes |
| May gate a background job in `§C5` | Yes | No | Yes | No | Yes |
| Emitted to the `web` resolved set | Yes | Yes | Read-only degradation hints only (§5.5) | Yes | **No** |
| Requires a `DECISION_LOG.md` entry on retirement | Only if the outcome was "do not ship" | **Always** | On creation and on removal of the subsystem | On graduation | On cutover completion |

### 2.3 Why kill-switches are the one permanent type

A release flag protects a feature that is temporarily uncertain. A kill-switch protects a subsystem
whose **dependency** is permanently uncertain — the maps vendor (`DEP-02`), the SMS provider
(`DEP-03`), the email provider (`DEP-04`), the payment gateway (`DEP-01`), or the platform's own
load characteristics under `NFR-SCAL-01`. That uncertainty never expires, so neither does the switch.

Three consequences follow, and all three are enforced:

1. **A kill-switch has no targeting.** Partial availability during an incident is harder to reason
   about than none, and the switch exists to be pulled in ten seconds by someone under pressure at
   03:00. `FF-CI-07` fails a build that attaches a targeting rule to an `ops.*` key.
2. **A kill-switch must be pulled to be trusted.** Adopting the logic of `NFR-AVL-05` — *"a restore
   that has never been tested is not a backup"* — **a kill-switch that has never been pulled is not
   a kill-switch.** Every `ops.*` flag is exercised in a scheduled game-day at least once every 90
   days in the Staging environment (`§C7`), and the drill date is recorded in the row's Notes. A
   switch with no drill in 90 days raises the same alert class as a failed job (`NFR-MNT-06`).
3. **Pulling one is still an audited administrative action.** `FR-ADMN-02` has no incident
   exemption. §5.7 keeps the reason to one click by giving kill-switch pulls a fixed reason-code
   taxonomy rather than free text.

---

## 3. Naming grammar

### 3.1 The scheme

```
<type>.<module>.<subject>
```

Formally:

```
^(rel|exp|ops|ent|mig)\.[a-z]+\.[a-z0-9]+(-[a-z0-9]+){0,3}$
```

with a hard maximum of **60 characters**.

| Segment | Rule |
| :--- | :--- |
| **`<type>`** | Exactly one of the five prefixes in §2.1: `rel`, `exp`, `ops`, `ent`, `mig`. No others exist. The prefix is the type — the Type column in §7 restates it, it does not decide it. |
| **`<module>`** | Exactly one of the **23 backend module folders** named in `§C1.3`: `common`, `tenancy`, `iam`, `onboarding`, `catalog`, `plans`, `discovery`, `ordering`, `payments`, `billing`, `memberships`, `attendance`, `crm`, `staff`, `reviews`, `ledger`, `settlements`, `refunds`, `notifications`, `reporting`, `support`, `admin`, `audit`. Not the `B1.3` product-module code, not a surface name, not a team name. §3.2 maps product codes onto folders. |
| **`<subject>`** | One to four kebab-case words naming the **capability**, as an affirmative noun phrase. `true` always means *the subject is available*. A version suffix (`-v2`) is permitted **only** on `mig.*` keys, where two implementations genuinely coexist. |

### 3.2 Product module code → folder, for the codes that do not map one-to-one

`B1.3` lists 24 product modules; `§C1.3` lists 23 backend folders. They are not the same list. The
key always uses the folder.

| Product module (`B1.3`) | Folder (`§C1.3`) | Basis |
| :--- | :--- | :--- |
| `AUTH`, `USER` | `iam` | *"iam/ auth, sessions, users, roles, permissions, impersonation"* |
| `ONB` | `onboarding` | *"onboarding/ applications, KYC documents, verification workflow"* |
| `GYM` | `catalog` | *"catalog/ gyms, branches, amenities, hours, media"* |
| `PLAN` | `plans` | *"plans/ plans, promotions, add-ons"* |
| `SRCH`, `DETL`, `FAV` | `discovery` | *"discovery/ search, ranking, comparison, favourites, SEO surfaces"* |
| `CART`, `CPN`, `REFR` | `ordering` | *"ordering/ carts, orders, eligibility, coupons"*; referral attribution and wallet application both occur in the order path (`FR-REFR-02`, `FR-REFR-06`) |
| `PAY` | `payments` | *"payments/ provider port, adapters, intents, webhooks, reconciliation"* |
| `INV` | `billing` | *"billing/ invoices, credit notes, tax profiles, subscription billing"* |
| `MEMB` | `memberships` | — |
| `CHK` | `attendance` | *"attendance/ tokens, check-in validation, attendance records, analytics"* |
| `CRM` | `crm` | *"crm/ members, segments, notes, leads"* |
| `STAF` | `staff` | — |
| `REV` | `reviews` | — |
| `NOTF` | `notifications` | — |
| `RPT` | `reporting` | *"reporting/ report definitions, query layer, exports"* |
| `SETL` | `settlements` | — |
| `RFND` | `refunds` | — |
| `SUP` | `support` | — |
| `ADMN` | `admin` | — |

Three folders — `common`, `tenancy`, `audit` — hold no product module and currently hold no flag.
`tenancy` and `audit` hold none **by policy**: §6.3 forbids flagging tenant isolation or audit
writing. `common` holds none because a flag on a cross-cutting mechanism (money type, idempotency,
error model, time handling) would be a flag on `§C1.5` itself.

### 3.3 Good and bad examples

| ✅ Good | ❌ Bad | Why the bad one fails |
| :--- | :--- | :--- |
| `rel.discovery.featured-listings` | `featuredListings` | No type, no module, camelCase. Unsearchable in a codebase and meaningless in an audit log entry. |
| `ops.payments.retry` | `disable-payment-retry` | Negative polarity. Pulling it would mean setting `disable-*` to `true`, so the resolved set becomes a page of double negatives read under incident pressure. |
| `rel.memberships.freeze` | `rel.membership.freeze` | The module segment is the `§C1.3` folder, which is plural: `memberships`. Singular does not resolve and fails `FF-CI-07`. |
| `ops.notifications.dispatch` | `ops.notf.dispatch` | `NOTF` is the `B1.3` product code, not a folder. Use the folder (§3.2). |
| `exp.discovery.ranking-formula-v2` | `rel.discovery.ranking-formula-v2` | A traffic split measured on `KPI-09` and `KPI-10` is an **experiment**, not a release. The wrong prefix imports the wrong lifespan (90 days instead of 60) and the wrong exit condition (removal instead of a recorded decision). |
| `ent.billing.invoice-branding` | `rel.billing.invoice-branding-growth-tier` | The tier is **targeting**, not part of the key. Bake a cohort into a key and you need a new key for every cohort. |
| `mig.ledger.balance-projection` | `rel.ledger.new-balance-code` | "New" is true for about a fortnight. And a cutover between two implementations of one behaviour is `mig`, not `rel`. |
| `rel.attendance.auto-checkout` | `ops.attendance.auto-checkout` | Auto-checkout (`FR-CHK-09`) is a feature being released, not a subsystem being protected from a failing dependency. Typing it `ops` would make it permanent and exempt it from expiry. |
| `rel.support.help-centre` | `rel.support.help_centre` | Snake_case. API **field names** are `snake_case` (`§C3.1`); flag **keys** are dotted segments of kebab-case. Two conventions, two places, no overlap. |
| `rel.plans.session-plans` | `rel.plans.BR-PLN-06` | A key is not a requirement identifier. The requirement goes in the Related PRD id column, where it can be many-to-many with the key. |
| `rel.discovery.saved-searches` | `rel.web.saved-searches` | `web` is a surface (`B1.1`), not a module. A capability can appear on more than one surface; it lives in exactly one module. |
| `rel.ordering.wallet-credit` | `rel.ordering.wallet-credit-phase-1-temp-do-not-remove` | Over 60 characters, encodes schedule and instruction in an identifier, and "do not remove" contradicts the retirement date the row is obliged to carry. |

---

## 4. Lifecycle

### 4.1 States

```
                    G1                    G2                     G3
 PROPOSED  ──────────────►  ACTIVE  ──────────────►  DEFAULT-ON  ──────────────►  REMOVED
     │                        │                          │
     │ withdrawn              │ defect (S1/S2)           │ defect after default-on
     ▼                        ▼                          │
 WITHDRAWN              ROLLED-BACK ◄────────────────────┘
                              │
                              └── fixed ──► back to ACTIVE (re-enters at G1 evidence)

 ops.* only:      PROPOSED ──G1──► PERMANENT   (no G2, no G3, no expiry)
```

| Status | Meaning |
| :--- | :--- |
| `PROPOSED` | Registered here; no code references the key yet. The key is reserved and can never be reused for anything else. |
| `ACTIVE` | The key exists in code, both branches are tested, and the flag is being rolled out. Includes the **dark-launch** condition: `ACTIVE` at 0%, where the code path executes in tests and in shadow but for no real principal. |
| `DEFAULT-ON` | The default value is `ON` for every principal. The off-branch still exists and is still tested, and the flag is still pullable. This state is a **staging area, not a destination** — see §4.4. |
| `REMOVED` | The off-branch and its tests are deleted, the key no longer appears in code or in the resolved set, and the row is retained here for traceability. Keys are never reused. |
| `PERMANENT` | `ops.*` only. No retirement date, exempt from `FF-CI-04`, subject to the 90-day drill in §2.3. |
| `ROLLED-BACK` | Turned off in production to arrest a defect. Carries the defect reference and its `C8.5` severity. A flag may sit here indefinitely; what it may not do is sit here undocumented. |
| `WITHDRAWN` | Abandoned before any code existed. Key burned. |

### 4.2 The gates

| Gate | Transition | Every condition must hold |
| :--- | :--- | :--- |
| **G1** | `PROPOSED` → `ACTIVE` (or → `PERMANENT`) | 1. Key passes the §3.1 grammar and the module segment is a real `§C1.3` folder.<br>2. **Owner role named** — a role from §7.1, held by an identified person.<br>3. **Retirement date set** and within the §2.1 maximum for the type (`ops.*`: marked `PERMANENT` instead).<br>4. At least one `FR-`, `BR-`, `NFR-`, `OQ-`, `SCR-` or `A`-section identifier in Related PRD id.<br>5. **Both branches covered by passing tests** (`FF-CI-05`).<br>6. **Protected-rule check clean** (§6.3) — the flag does not gate any rule on the never-flaggable list.<br>7. Default is `OFF` (`ON` for `ops.*`).<br>8. Description states what turning it **off** does to the user experience, specifically. |
| **G2** | `ACTIVE` → `DEFAULT-ON` | 1. Target cohort has been at **100% for ≥ 7 consecutive days**.<br>2. **Zero S1 or S2 defects** (`§C8.5`) attributed to the flagged path in that window.<br>3. Every `AC-` acceptance criterion for the gated `FR-`s passes in Staging (`§C7`).<br>4. The relevant `NFR-PERF-*` budget is met with the flag on — measured, not assumed.<br>5. The owner records the decision with a reason (`FR-ADMN-02`), and the blast-radius preview (`SCR-ADM-011`) is attached to the audit entry.<br>6. This registry row is updated **in the same commit** as the default change. |
| **G3** | `DEFAULT-ON` → `REMOVED` | 1. The **off-branch code and its tests are deleted in the same commit** — not commented, not left behind a constant.<br>2. The key is removed from the `feature_flags` table and from every resolved set.<br>3. The row here moves to `REMOVED` with the removal date and the commit SHA.<br>4. `/docs/CHANGELOG.md` records the change if it was ever user-visible; `/docs/DECISION_LOG.md` records it if the outcome was "do not ship" or if it was an `exp` or `mig` flag.<br>5. The architecture fitness check (the tool pending `A-23`) confirms no dangling reference. |

### 4.3 The hard rule

> **Every flag carries an owner role and a retirement date. A flag whose retirement date has passed
> FAILS CI.**

Concretely, gate `FF-CI-04` (§6.4) fails the build when, for any row in §7:

```
retirement_date < today  AND  status ∉ { REMOVED, PERMANENT, WITHDRAWN }
```

The failure is a **build failure on trunk**, not a warning, not a nightly report, not a lint notice.
It blocks every merge for every engineer until the flag is removed, because that is the only
pressure that reliably beats the pressure not to touch working code.

**The one exception is the operational kill-switch.** `ops.*` rows are `PERMANENT` by design, carry
`— (permanent)` in the Retirement date column, and are excluded from `FF-CI-04`. They are not
unpoliced: they are subject instead to the 90-day pull drill in §2.3, and a missed drill raises an
operational alert under `NFR-MNT-06`. The exception exists because the dependency risk a kill-switch
answers (`DEP-01` … `DEP-08`, `CON-02`, `NFR-SCAL-01`) does not expire, and forcing an artificial
expiry date onto it would either produce annual date-bumping theatre or delete the platform's
ability to degrade gracefully.

**Extensions.** A retirement date may be extended **once**, by **at most 30 days**, by the owner,
with the reason recorded in the row's Notes and a matching entry opened in `/docs/TECH_DEBT.md`
carrying its interest rate and payoff trigger. A **second** extension is refused. At that point the
choice is binary: remove the flag, or withdraw the feature and remove the flag. There is no third
option and no escalation path to one.

**Orphaned flags.** If the person holding a flag's owner role leaves the flag — reassignment,
departure, or role change — the flag is reassigned within **five working days** or it is removed.
This is the flag-level mitigation for `RSK-14` (key-person dependency).

### 4.4 Why `DEFAULT-ON` is a staging area and not a destination

`DEFAULT-ON` is comfortable. The feature is live, the switch still exists, and nobody has to touch
the code. That comfort is exactly the failure mode: every `DEFAULT-ON` flag is a branch in a code
path that is executed by nobody and maintained by nobody, and it decays until the day someone pulls
it in an incident and discovers the off-branch stopped compiling against reality four months ago.

Therefore gate `FF-CI-10` fails the build when a flag has been `ACTIVE` at 100% or `DEFAULT-ON` for
more than **30 days** without a `REMOVED` transition or a recorded extension. The retirement date is
the outer bound; 30 days at full traffic is the operational bound. In practice a healthy release
flag lives 3 to 6 weeks.

---

## 5. Evaluation semantics

### 5.1 Server-side only, and what that forbids

Flags are evaluated **exclusively on the server**, in the `admin/` module's evaluator, inside the
request's tenant context (`§C1.4`). `§C1.5` states the rule and this section makes it operational.

| Forbidden | Why |
| :--- | :--- |
| Shipping the flag **rules** to any client | The rules encode commercial cohorts, tenant overrides and unreleased capability names. A `web` bundle containing them leaks the roadmap and the tier model to anyone who opens dev tools. |
| A client deciding **anything security-relevant** from a flag | `FR-RBAC-02`: *"Permission checks are enforced server-side. Client-side hiding of UI is presentation only and never a security control."* A resolved flag hides a control; the endpoint behind it refuses the call independently. Both, always. |
| Evaluating a flag **outside** a tenant context on a tenant-scoped surface | The base repository refuses to build a query without an active tenant context (`§C1.4` step 4); the evaluator holds itself to the same standard, so a tenant-targeted flag can never resolve against an ambient or missing tenant. |
| Re-evaluating a flag **mid-request** | A single request resolves the set once, at the start, and uses that snapshot throughout. Otherwise a targeting write landing mid-request produces a response half-on and half-off. |

### 5.2 Targeting precedence

Four inputs, evaluated **top to bottom, first match wins**. The order is total: no two rules can both
apply, so there is never a tie to break.

| # | Rule | Matches on | Notes |
| :-: | :--- | :--- | :--- |
| **1** | **Tenant override** | `tenant_id` of the resolved tenant context | The most specific and the most operationally useful — it is how a single tenant is unblocked, piloted or contained without touching anyone else, exactly as `FR-ADMN-03` does for commission rates. An override may set `ON` **or** `OFF`; an `OFF` override beats a 100% rollout, which is how one tenant is excluded from a rollout that is otherwise complete. |
| **2** | **Role** | The principal's effective roles for the resolved scope, per `B3.1`/`B3.2` | Evaluated as `(role, scope)`, never role alone (`B3.2`: *"Permission evaluation is always `(role, scope, resource, action)` — never role alone"*). Used mainly by `ent.*` and for internal-staff dogfooding of `rel.*` flags before any customer sees them. |
| **3** | **Percentage rollout** | A stable bucket derived in §5.3 | Expressed in **basis points** (0–10000), matching the money convention (`commission_rate_bps`, `reserve_bps` in `§C2.2`) so that one unit of precision means the same thing everywhere in the system. |
| **4** | **Default** | Nothing — the fallback | The value in the Default column of §7. Always defined; there is no "unset" state and no implicit `false`. An unknown key is a build failure (`FF-CI-01`), never a silent `false`. |

The evaluator returns not a boolean but `{ value, source, rule_id }`, where `source` is one of
`tenant_override`, `role`, `percentage`, `default`. That triple is written to the structured log
(the logger pending `A-14`) with the request's correlation id (`NFR-MNT-04`), so "why did this user
see that?" is answerable from logs alone, without reproducing the state.

**City is a fifth dimension, and it is an extension.** `rel.discovery.city-launch-gate` needs to
resolve per **city**, because `C9.4` gates consumer marketing city by city and the principal being
gated is an unauthenticated visitor who belongs to no tenant. `FR-ADMN-08` names three dimensions;
this is a fourth. It **adds** to the requirement without contradicting it, it cannot be expressed as
a tenant cohort (a visitor has no tenant), and it is the executable form of a `C9.4` gate that the
PRD already mandates. It is recorded here as an additive extension requiring the project owner's
approval on the same basis as `/docs/engineering/STACK_ADDITIONS.md` — see §9.1. Until approved, the
city gate is operated as a static allowlist in configuration rather than as a targeting rule.

### 5.3 Consistency — a user must not flip between buckets

A visitor who sees the comparison feature on one page load and does not see it on the next has been
given a broken product, and any experiment measuring them has been given noise. Percentage rollout
is therefore **deterministic, not random**.

```
bucket  = stable_hash( flag_key + ":" + bucketing_id ) mod 10000
included = bucket < rollout_bps
```

| Requirement | Rule |
| :--- | :--- |
| **Bucketing identifier** | Selected in this order and no other: `tenant_id` for `dash` and `admin`; `user_id` for authenticated `web`; `anonymous_id` for unauthenticated `web`. `anonymous_id` is the same identifier the analytics taxonomy uses (`§C6`), so a funnel and a rollout partition the population identically. |
| **Never used for bucketing** | Request id, session id, IP address, wall-clock time, or a random draw. Each of these re-buckets the same person on a subsequent request, which is the exact defect this section exists to prevent. |
| **Salted per flag** | The flag key is part of the hash input, so a user unlucky in one 10% rollout is not systematically unlucky in every other 10% rollout. |
| **Monotonic increase** | Raising `rollout_bps` never re-buckets anyone already included. Because the comparison is `bucket < rollout_bps`, 10% → 25% is strictly additive. |
| **Decrease evicts, and that is stated** | Lowering the percentage does remove people. That is acceptable for a rollback and unacceptable mid-journey — hence the next row. |
| **Journey stickiness** | Flags marked `sticky-journey` are resolved **once** at the start of a multi-step journey and pinned to the record that journey is building: the resolved set is stored on `orders.*` for checkout and on `applications.snapshot` for the onboarding wizard. This is required by `FR-NAV-02` (*"the user returns to the exact point of interruption with prior state intact"*) and `FR-ONB-01` (*"resumable … partial state persists indefinitely"*). A six-week-old resumed application resumes in the flag state it was started in. Sticky flags in §7: `rel.ordering.*`, `rel.plans.add-ons`, `exp.ordering.checkout-single-page`, `rel.onboarding.bulk-member-import`. |
| **Anonymous-to-authenticated transition** | When a visitor authenticates mid-flow (`FR-NAV-01` auth gate), the resolved set computed from `anonymous_id` is **carried forward for the remainder of that journey** and only re-resolves on the next fresh journey. Otherwise the auth gate itself becomes a bucket-flipping event, at the single worst point in the funnel (`KPI-11`). |

### 5.4 "Changeable without deployment"

`FR-ADMN-08` requires it, so it is specified rather than assumed.

| Step | Behaviour |
| :--- | :--- |
| Write | `PUT /admin/config/flags` (`API-ADM`), `SUPER_ADMIN` only (`B3.2`), reason mandatory (`FR-ADMN-02`), blast-radius preview shown first (`SCR-ADM-011`), payload schema-validated server-side (`NFR-SEC-05`, using the validation library pending `A-02`). |
| Persist | One row updated in `feature_flags` (`§C2.3`), inside a transaction that also writes the `audit_log` row. Either both land or neither does. |
| Invalidate | The Redis 7 evaluation cache entry for the key is deleted on commit. |
| Propagate | Worst case **60 seconds**, bounded by the cache TTL. This matches the propagation guarantee `FR-RBAC-04` already gives for role changes, so the platform has one number for "how long until a permission-shaped change takes effect", not two. |
| Clients | The SPA surfaces refetch the bootstrap resolved set on window focus and on cache invalidation (TanStack Query, `§C1.1`); `web` server components evaluate per request, so a server-rendered page is never stale by more than the cache TTL. |
| Rollback | Identical mechanism. **Instant rollback** in `NFR-MNT-07` means one audited write plus ≤ 60 seconds — never a revert, never a redeploy, never a migration. |

### 5.5 The resolved set delivered to the client

The client receives **only** `{ key: boolean }` — never rules, never percentages, never the tenant
override list, never the reason.

| Surface | Receives | Excluded, and why |
| :--- | :--- | :--- |
| `web` (Next.js 14, server-rendered) | `rel.*` and `exp.*` keys that affect rendering for this principal, and `ent.*` keys that affect what this member can see about a gym | All `ops.*` (an incident switch is not the public's business) except a single derived `degraded_capabilities` array naming which panels to render in their degraded state per `AC-SRCH-02.3`; all `mig.*` (a cutover is invisible by definition) |
| `dash` (React + Vite SPA) | `rel.*`, `ent.*` and `exp.*` resolved for the tenant and the staff member's role | All `ops.*` except the same degraded-capability hints; all `mig.*` |
| `admin` (React + Vite SPA) | Every key, with `{ value, source, rule_id }` rather than a bare boolean, because inspecting resolution is the console's job (`FR-RBAC-05` sets the precedent for effective-permission inspection) | Nothing |

Two rules protect the boundary:

- **A flag key never leaks an unreleased capability's name to a surface that cannot use it.** This
  is the same instinct as `BR-PLN-05` (*"a staff-only plan is never returned by any public API"*):
  what the client cannot use, the client is not told about.
- **The resolved set is advisory to the UI and authoritative to nothing.** Every endpoint behind a
  flagged capability re-evaluates the flag server-side and refuses independently. A forged resolved
  set buys a visible button and nothing else.

### 5.6 Interaction between flags

Flags may depend on other flags, and the dependency is declared in the registry rather than
discovered in production.

| Rule | Detail |
| :--- | :--- |
| Declared dependencies only | `ent.discovery.featured-listing-credits` depends on `rel.discovery.featured-listings`. If the parent is off, the child resolves off regardless of tier. The dependency is stated in the child's Description and enforced by the evaluator. |
| No cycles | The dependency graph is acyclic, checked by the architecture fitness test (`A-23`, pending) on the same basis that `§C1.3` module boundaries are checked. |
| Depth limit of 1 | A flag may depend on at most one parent, and a parent may not itself be a child. Two levels of flag dependency is a configuration language, and this is not one. |

### 5.7 Audit — every change, every pull, no exceptions

`FR-ADMN-02` is unconditional: *"Every administrative action requires a reason and is written to the
audit log."* A flag change is an administrative action, including an emergency kill-switch pull.

Each change writes one `audit_log` row (`§C2.2`) carrying: `actor_id`, `actor_type`,
`impersonated_by` (null — see below), `tenant_id` where the change is tenant-scoped, `entity_type =
'feature_flag'`, `entity_id` = the flag key, `action`, `before` and `after` as the full targeting
rule set in JSONB, `ip`, `user_agent`, `correlation_id`, `reason`, `occurred_at`. The table is
append-only on a role with no `UPDATE` or `DELETE` grant (`NFR-SEC-13`), and the entry is queryable
by entity and by actor in the audit explorer (`FR-ADMN-09`, `SCR-ADM-015`), satisfying `BAC-13`.

Three additional rules:

1. **No flag change under impersonation.** `FR-AUTH-12` bars an impersonated session from financial
   mutations; this document extends the same bar to flag changes. A flag change is
   platform-configuration authority, and impersonation borrows a user's identity, not the platform's.
   Attempting it is refused, and the refusal is itself audited.
2. **Kill-switch pulls use a reason-code taxonomy, not free text.** Under incident pressure a
   mandatory free-text field is either skipped (which `FR-ADMN-02` forbids) or filled with "asdf"
   (which is worse than skipped, because it looks like compliance). The taxonomy —
   `THIRD_PARTY_OUTAGE`, `THIRD_PARTY_RATE_LIMIT`, `LATENCY_BUDGET_BREACH`, `ERROR_RATE_BREACH`,
   `DATA_CORRUPTION_SUSPECTED`, `RECONCILIATION_VARIANCE`, `ABUSE_OR_ATTACK`, `COST_CONTROL`,
   `SCHEDULED_DRILL`, `OTHER` (free text then required) — is one click plus an optional note, and it
   makes kill-switch pulls countable in the platform reports. This is a **new reason-code type**
   alongside the five in `§C4.8`; `FR-ADMN-07` already makes reason-code taxonomies configurable
   platform data, so this is an addition within an existing mechanism. It is listed in §9.1 for
   approval.
3. **The audit entry records the blast radius that was previewed.** `SCR-ADM-011` requires a preview
   of affected entities; the counts shown are stored in the `after` payload, so a later
   reconstruction can distinguish "we knew this affected 400 tenants" from "we thought it affected
   four".

---

## 6. Testing rule

### 6.1 Both branches, always

> **Both branches of every flag must be tested. A flag with only its on-branch tested is not a
> flag — it is an unreviewed deploy with a delay built in.**

For every key in §7, the test suite contains at minimum:

| # | Test | Layer (`§C8.1`) |
| :-: | :--- | :--- |
| 1 | The capability behaves per its `AC-` criteria with the flag **on** | Unit + integration, escalating to E2E for the twelve `E2E-` journeys |
| 2 | The capability is **absent and the surface is coherent** with the flag off — not a blank panel, not a 500, not a dead control that does nothing | Unit + integration |
| 3 | Every endpoint behind the capability **refuses server-side** with the flag off, called directly, bypassing the UI | Contract (against the OpenAPI spec, `NFR-MNT-03`) |
| 4 | The flag's **off state is the safe state** for anything touching money, tenancy, the door or trust (§6.3) | Unit, with an explicit negative assertion |
| 5 | Flipping the flag **at runtime** does not corrupt in-flight state — specifically, a sticky-journey flag pinned at journey start stays pinned (§5.3) | Integration |
| 6 | For `exp.*`: both arms satisfy the **identical** obligations — server-side pricing, refund-policy disclosure, terms acceptance, audit writes | Integration |
| 7 | For `mig.*`: a **differential test** asserts old path and new path produce identical output for the seeded dataset (`§C8.2`) | Integration |
| 8 | For `ops.*`: pulling the switch leaves **check-in and payment working** (`NFR-AVL-02`, `NFR-AVL-03`) | E2E, in `PROFILE-DEGRADED` (§6.2) |

Coverage thresholds are unchanged by flags and are not negotiable per branch: `NFR-MNT-01` requires
≥ 80% overall and ≥ 95% on payment, settlement, membership-state and tenancy-isolation code, and
that 95% applies to **both** sides of any flag in those modules.

### 6.2 The flag matrix CI exercises

Testing every combination of 66 flags is 2⁶⁶ configurations and is not a plan. CI exercises a
**bounded, named matrix** instead — four profiles plus one pairwise cell per flag.

| Profile | Composition | Suites run | Purpose |
| :--- | :--- | :--- | :--- |
| **`PROFILE-BASELINE`** | Every flag at its registry default (§7) | Full suite: unit, integration, contract, E2E, isolation | This is production. It is the profile that gates the merge. |
| **`PROFILE-NEXT`** | Every `rel.*` and `mig.*` flag forced **on**; `exp.*` forced to the candidate arm; `ent.*` forced on; `ops.*` on | Full suite | This is production in ~6 weeks. It catches the interaction defect that only appears once three in-flight features are all on, which is the class of defect trunk-based development is otherwise prone to. |
| **`PROFILE-DEGRADED`** | All nine `ops.*` kill-switches **pulled**; everything else at default | E2E subset: `E2E-02` (purchase), `E2E-03` (check-in), `E2E-04` (denial and renew), plus a scripted browse | Proves `NFR-AVL-03` and product principle 6 continuously rather than annually. **A build in which check-in or payment fails with all kill-switches pulled does not merge.** |
| **`PROFILE-MINIMAL`** | Every `rel.*`, `exp.*`, `ent.*` and `mig.*` flag forced **off**; `ops.*` on | Full suite | Proves that the platform without any optional capability is still a coherent product — that the `M`-priority core in `A4.1` stands alone. It is also the exact configuration a brand-new tenant on the Starter tier sees. |
| **Per-flag pair** | One cell per flag: that flag inverted from `PROFILE-BASELINE`, everything else at default | Only the tests tagged to that flag | Satisfies §6.1 rows 1–7 for each key individually, in **2 × 66 = 132** cheap runs rather than a combinatorial explosion. |

Two exclusions keep the matrix honest rather than merely large:

- **Mutually exclusive flags** are declared as such and never forced on together. There are two
  such pairs: `mig.discovery.opensearch-backend` against
  `exp.discovery.ranking-formula-v2` (the candidate formula is defined against the Postgres
  backend), and `mig.tenancy.dedicated-schema-pilot` against
  `mig.attendance.partitioned-reads` (two simultaneous storage cutovers for one tenant is not a
  configuration anyone will run).
- **`PROFILE-DEGRADED` does not pull `mig.*`.** A cutover flag is not an incident control, and
  pulling one mid-incident is how a partial migration becomes a data problem.

### 6.3 A flag may never let a business rule be bypassed

> **No flag, of any type, in any state, may gate a business rule in `A8` in a way that allows the
> rule to be bypassed. Money rules, tenancy rules and review-integrity rules are never
> flag-disableable.**

The rule is directional, and the direction is the whole point:

- **A flag may change the *mechanism* by which a rule is satisfied.** `BR-PAY-07` requires a
  duplicate payment to be refunded within one business day. `ops.payments.duplicate-auto-refund`
  switches that between *automatic refund* and *detected, queued to Finance with an alarm timed to
  fire before the deadline*. The rule holds in both positions.
- **A flag may add a control, never remove one.** `rel.settlements.dual-payout-approval` off means
  every payout above the threshold is **held and escalated**, not paid on one signature. Off is
  more restrictive than on. This is the safe direction, and §6.1 row 4 asserts it.
- **A flag may never make a rule not apply.** There is no flag, and there may never be a flag,
  whose off state means "skip tenant scoping", "skip webhook verification", "skip the check-in
  eligibility requirement for reviews", or "recompute a settlement figure at display time".

#### The protected list — rules no flag may gate

**Money** — `BR-PAY-01` (minor-unit integers), `BR-PAY-02` (webhook-driven activation), `BR-PAY-03`
(idempotency), `BR-PAY-04` (server-side amounts), `BR-PAY-05` (webhook signature and replay),
`BR-PAY-06` (indeterminate payments never auto-activate), `BR-PAY-07` (duplicate refunded within one
business day), `BR-PAY-08` (no card or bank credentials), `BR-PAY-10` (gapless immutable invoices),
`BR-PAY-11` (tax treatment frozen at sale); `BR-PLN-02` (price change never affects a purchased
membership), `BR-PLN-03` (displayed price equals charged price); `BR-CPN-02` (no coupon stacking),
`BR-CPN-03` (server-side re-validation), `BR-CPN-04` (never below zero), `BR-CPN-05`
(`funding_source` immutable after first use); `BR-REF-02` (policy stored on the order governs),
`BR-REF-04` (original instrument only), `BR-REF-05` (proportional commission reversal), `BR-REF-09`
(refund idempotent on the order); `BR-FIN-01` (balances derived from the append-only ledger),
`BR-FIN-02` (all eight figures persisted), `BR-FIN-03` (statement sums exactly), `BR-FIN-04`
(commission on the base only), `BR-FIN-05` (rate effective at sale), `BR-FIN-06` (fees as reported,
never estimated), `BR-FIN-07` (variance blocks auto-payout).

`BR-FIN-08` (dual approval above threshold) is **on the list in the removing direction only**: a
flag may raise the level of approval required, never lower it.

**Tenancy** — `BR-TEN-01` (no cross-tenant access by any code path, including reporting and support
tooling), `BR-TEN-02` (tenant switching explicit and audited, no cross-tenant action in one
request), `BR-TEN-04` (soft delete with statutory retention), `BR-TEN-05` (suspended tenant removed
from search immediately, existing memberships still check in); and the mechanisms that implement
them: `NFR-SEC-09` (RLS at the database, not only in application code) and the five enforcement
layers of `§C1.4`. The `tenancy/` module holds no flag and will hold none.

**Review integrity** — `BR-REV-01` (check-in required to review), `BR-REV-02` (one per member per gym
per term, 7-day edit window, history retained), `BR-REV-03` (every published review carries the
verified marker; there is no unverified review type), `BR-REV-04` (automated screening before
publication), `BR-REV-05` (a gym may respond once and may never edit or delete), `BR-REV-06` (a
reported review stays published while under moderation unless it requires immediate removal).

**Also protected, on the same basis** — audit and privacy: `BR-DAT-01` (append-only audit of every
create/update/delete on the eight listed entity types), `BR-DAT-02` (impersonation reasoned,
time-boxed, visible to the user, audited), `BR-DAT-06` (no personal data in logs, traces or
analytics events), `BR-DAT-07` (KYC encrypted, access-restricted, access-logged). Verification:
`BR-GYM-01` (no marketplace visibility before `APPROVED`), `BR-GYM-03` (approval is a human
decision; no automated path may set `APPROVED`). Check-in integrity: `BR-CHK-02` (60-second signed
token), `BR-CHK-06` (idempotent on the token), `BR-CHK-09` (attendance immutable once written).
Security: `NFR-SEC-11` and the staff half of `FR-AUTH-07` — **MFA for platform staff is mandatory
and has no flag**; `rel.iam.owner-totp-mfa` gates only the optional `GYM_OWNER` half.

#### A worked forbidden example

`mig.billing.invoice-number-sequence-v2` **may not exist.** Invoice numbering is gapless and
sequential per tenant per financial year (`BR-PAY-10`, `FR-INV-02`), and `AC-INV-01.2` states that a
silently skipped number is a defect. A flag that routes numbering between two sequence
implementations produces, at the moment of the flip, either a duplicate or a gap — and there is no
targeting configuration that avoids it, because the invariant is global to the tenant-year, not to
the request. Such a migration is done with a migration script and a maintenance window under
`NFR-AVL-06`, not with a flag. This example is recorded here because it is the kind of flag that
looks reasonable in a pull request.

### 6.4 CI gates

Ten gates. All are **build failures on trunk**, not warnings. Identifiers `FF-CI-*` are conventions
of this document and are not PRD identifiers.

| ID | Gate | Fails when |
| :--- | :--- | :--- |
| **FF-CI-01** | Unknown key | Code references a flag key that this registry does not contain. There is no implicit `false` for an unknown key. |
| **FF-CI-02** | Unregistered flag | A key exists in code, in the `feature_flags` seed, or in a targeting rule but has no row in §7. This is the gate that makes the update trigger real. |
| **FF-CI-03** | Incomplete row | Any row is missing Owner role, Retirement date (or `PERMANENT` for `ops.*`), Related PRD id, Default, Targeting, or a Description that says what **off** does. |
| **FF-CI-04** | **Expiry** | `retirement_date < today` and status ∉ {`REMOVED`, `PERMANENT`, `WITHDRAWN`}. The hard rule of §4.3. |
| **FF-CI-05** | Untested branch | Either branch of a flag lacks a test tagged to that key, or a tagged test does not execute (skipped, filtered out, or unreachable). |
| **FF-CI-06** | **Protected rule** | A flag reference appears inside a code path annotated as enforcing any rule on the §6.3 protected list, unless the reference is annotated `@FlagSafeDirection` and carries a review approval recorded in the pull request. The annotation asserts that off is the more restrictive state; test §6.1 row 4 proves it. |
| **FF-CI-07** | Grammar | A key fails the §3.1 regex, exceeds 60 characters, uses a module segment that is not one of the 23 `§C1.3` folders, uses negative polarity, or attaches a targeting rule to an `ops.*` key. |
| **FF-CI-08** | Client evaluation | Any client bundle contains targeting logic, a percentage, a tenant list, or a role comparison against a flag; or a client makes a security decision from a flag rather than from a server refusal (`FR-RBAC-02`). |
| **FF-CI-09** | Registry density | More than **8 non-`ops` flags are simultaneously `ACTIVE` in one `§C1.3` module**, or more than **30 platform-wide**. Beyond that the interaction surface stops being reviewable and the matrix in §6.2 stops being a meaningful approximation. |
| **FF-CI-10** | Stale default-on | A flag has been at 100% or `DEFAULT-ON` for more than 30 days without removal or a recorded extension (§4.4). |

Gates `FF-CI-01`, `FF-CI-02`, `FF-CI-05`, `FF-CI-06` and `FF-CI-08` run in the pre-merge pipeline
alongside the tenant-isolation suite (`§C7`); `FF-CI-03`, `FF-CI-04`, `FF-CI-07`, `FF-CI-09` and
`FF-CI-10` run on every build including scheduled ones, so that the expiry gate fires on the day it
is due rather than on the day someone next opens a pull request.

---

## 7. The registry

### 7.1 How to read it

| Column | Meaning |
| :--- | :--- |
| **Flag key** | The immutable identifier. Never renamed, never reused, even after `REMOVED`. |
| **Type** | Release · Experiment · Kill-switch · Entitlement · Migration (§2). Restates the prefix; does not decide it. |
| **Description** | What turning the flag **off** actually does to the user experience, and what it deliberately does **not** touch. |
| **Default** | The value returned when no targeting rule matches (precedence step 4, §5.2). Every non-`ops` flag in this initial registry defaults `OFF`; gate **G2** is the only thing that changes that, and the change is recorded here in the same commit. |
| **Targeting** | Which of the dimensions in §5.2 the flag uses: `default only`, `tenant`, `role`, `percentage`, `city`, or a combination. `ops.*` is always `default only` (§2.3). |
| **Owner role** | One of the ten roles in the table below, held by an identified person. Reassigned within five working days or the flag is removed (§4.3). |
| **Created** | The date the flag first exists in the codebase. Every row in this initial registry is *planned*, so this column carries the **start date of the `§C9.1` sprint that builds the gated functionality**. It is overwritten with the actual date, in the same commit, when the flag is created. |
| **Retirement date** | The date after which `FF-CI-04` fails the build. `— (permanent)` for kill-switches only. |
| **Related PRD id** | The identifiers this flag gates or serves. |
| **Status** | §4.1 vocabulary. |

**Owner-role vocabulary** — ten roles, drawn from `§C9.3` (team shape) and `A5.2` (internal
stakeholders):

| Role | Who it is |
| :--- | :--- |
| `Product` | Product manager (`§C9.3`) |
| `Engineering` | Technical lead / architect (`§C9.3`) |
| `Backend` | The backend engineer owning that `§C1.3` module (`§C9.3`) |
| `Web` | Frontend engineer, customer site (`§C9.3`) |
| `Dash` | Frontend engineer, dashboards (`§C9.3`) |
| `DevOps` | DevOps engineer (`§C9.3`; A5.2 *Engineering / DevOps*) |
| `Finance` | Finance (`A5.2`) |
| `Operations` | Operations (`A5.2`) |
| `Commercial` | Sales / commercial owner (`A5.2`; owner of `RSK-07`, `RSK-10`) |
| `Support` | Customer support lead (`A5.2`) |

> **Status of this registry.** Phase 8 is **locked** (`/docs/PHASES.md`). No code exists, therefore
> no flag exists in code, therefore **every row below is `PROPOSED`**. The rows are registered now so
> that the key, the owner, the retirement date and the protected-rule assessment are settled before
> the first line of the feature is written, which is the only point at which settling them is cheap.

### 7.2 Registry index

| Type | Count | Section |
| :--- | :-: | :--- |
| Release (`rel`) | 39 | [§7.3](#73-release-flags) |
| Experiment (`exp`) | 5 | [§7.4](#74-experiment-flags) |
| Operational kill-switch (`ops`) | 9 | [§7.5](#75-operational-kill-switches--permanent) |
| Permission / entitlement (`ent`) | 8 | [§7.6](#76-permission--entitlement-flags) |
| Migration (`mig`) | 5 | [§7.7](#77-migration-flags) |
| **Total** | **66** | |

### 7.3 Release flags

| Flag key | Type | Description | Default | Targeting | Owner role | Created | Retirement date | Related PRD id | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `rel.iam.social-login-google` | Release | **Off:** the login and register screens offer only phone-OTP and email-plus-password. A user who previously signed up through Google is not locked out — they are routed to password reset on their already-verified email. Never offered on `dash` or `admin` in either position, because `FR-AUTH-03` scopes it to the customer website only. | OFF | percentage | Product | 2026-08-31 | 2026-11-29 | `FR-AUTH-03`, `SCR-WEB-016` | PROPOSED |
| `rel.iam.owner-totp-mfa` | Release | **Off:** `GYM_OWNER` accounts see no MFA enrolment card in profile settings, and existing enrolments stop being challenged — enrolment secrets are retained, not deleted, so re-enabling does not force re-enrolment. Mandatory MFA for all twelve platform staff roles is outside this flag's reach entirely (`NFR-SEC-11`). | OFF | tenant + percentage | Engineering | 2026-08-31 | 2026-11-29 | `FR-AUTH-07`, `NFR-SEC-11`, `SCR-WEB-014` | PROPOSED |
| `rel.onboarding.bulk-member-import` | Release | **Off:** `POST /tenant/members/import` returns 404 and the "Import members" entry point disappears from the member list; owners add members one at a time (`FR-CRM-04`). A dry-run already validated but not executed is preserved, not discarded, so a 400-row import is not re-keyed. Sticky-journey. | OFF | tenant | Dash | 2026-12-21 | 2027-03-21 | `FR-ONB-15`, `US-ONB-03`, `AC-ONB-03.1`–`AC-ONB-03.4` | PROPOSED |
| `rel.catalog.temporary-closure` | Release | **Off:** owners cannot declare a dated closure; the closure banner on the gym page, the automatic member notification and the `GYM_CLOSED_EXCEPTION` denial reason are all inert, and an out-of-hours attempt falls back to `OUTSIDE_OPERATING_HOURS`, which is a worse message but a correct decision. Closures already declared remain in force. | OFF | tenant | Product | 2026-10-12 | 2027-01-10 | `FR-GYM-10`, `US-GYM-02`, `BR-MEM-14`, `§C4.8` | PROPOSED |
| `rel.catalog.branch-capacity-indicator` | Release | **Off:** the capacity field is hidden in the branch editor and no crowd indicator renders on the gym detail page or on dashboard home; stored capacity values are retained untouched for the Phase-2 class-booking work (`A11`). Nothing about check-in changes — capacity has never gated entry. | OFF | tenant + percentage | Product | 2026-10-12 | 2027-01-10 | `FR-GYM-09`, `SCR-DASH-004`, `SCR-WEB-003` | PROPOSED |
| `rel.catalog.freshness-demotion` | Release | **Off:** `freshness_score` is still computed nightly and still shown to the owner as a "your listing is going stale" prompt, but it contributes **zero weight** to search ranking, so a listing eighteen months out of date ranks purely on distance, rating and profile completeness. This is the flag that decides whether `RSK-11` has a working mitigation. | OFF | percentage | Product | 2026-10-12 | 2027-01-10 | `FR-GYM-12`, `FR-SRCH-10`, `RSK-11`, `gym.freshness-score` job | PROPOSED |
| `rel.plans.promotional-pricing` | Release | **Off:** the promotion block disappears from the plan editor and every plan sells at list price. Promotions already running continue to their end date and revert automatically, because reversion is a scheduled behaviour and not a UI action — `AC-PLAN-01.1` holds in both positions. | OFF | tenant | Product | 2026-09-28 | 2026-12-27 | `FR-PLAN-03`, `BR-PLN-07`, `US-PLAN-01`, `SCR-DASH-006` | PROPOSED |
| `rel.plans.session-plans` | Release | **Off:** `plan_type` is fixed to `DURATION` in the editor, no session-based plan can be created, and the day-pass and trial products (the `OQ-14` default) are unavailable. Existing `SESSION` memberships keep decrementing entitlement at check-in and keep expiring on exhaustion — the flag gates **creation and sale**, never entitlement enforcement (`BR-PLN-06` is on the protected list in spirit). | OFF | tenant | Product | 2026-09-28 | 2026-12-27 | `BR-PLN-06`, `FR-PLAN-01`, `OQ-14`, `AC-CHK-01.x` | PROPOSED |
| `rel.plans.off-peak-access-windows` | Release | **Off:** the access-window editor is hidden and every newly created plan grants entry at any open hour, removing the cheaper off-peak product from the catalogue. Check-in still evaluates `access_window` for plans that already carry one, so an existing off-peak member is not silently upgraded to all-hours access they did not pay for. | OFF | tenant | Product | 2026-09-28 | 2026-12-27 | `FR-PLAN-02`, `FR-CHK-04`, `§C4.8` `OUTSIDE_PLAN_ACCESS_WINDOW` | PROPOSED |
| `rel.plans.add-ons` | Release | **Off:** no add-on can be attached to a plan, and the add-ons line disappears from the checkout summary and from the order breakdown; lockers, personal-training blocks and diet consultations are sold as separate plans instead. Sticky-journey: an order created with add-ons is priced and invoiced with them regardless of a later flip. | OFF | tenant | Product | 2026-09-28 | 2026-12-27 | `FR-PLAN-09`, `FR-CART-02`, `FR-CART-03`, `SCR-WEB-005` | PROPOSED |
| `rel.discovery.featured-listings` | Release | **Off:** paid placement is neither sold nor rendered anywhere — search results, category pages and the home "Featured gyms" strip all fall back to organic order, and `featured_until` contributes zero ranking weight. Revenue stream 3 of `A6.1` is dormant while this is off, which is the commercial cost of leaving it off. When on, every placement is labelled as promoted, in both the visual and the textual sense, without exception. | OFF | city + percentage | Commercial | 2026-09-28 | 2026-12-27 | `A6.1` stream 3, `FR-SRCH-11`, `FR-SRCH-10`, `OQ-12`, `SCR-WEB-001` | PROPOSED |
| `rel.discovery.gym-comparison` | Release | **Off:** the compare checkbox on result cards, the selection bar and the `/compare` route all disappear; a visitor shortlists with favourites and browser tabs, which is precisely the behaviour `A2.2` identifies as broken. Any comparison set already held client-side is dropped on next load silently rather than erroring. | OFF | percentage | Web | 2026-10-12 | 2027-01-10 | `FR-DETL-08`, `FR-DETL-09`, `US-DETL-01`, `SCR-WEB-004` | PROPOSED |
| `rel.discovery.favourites` | Release | **Off:** the favourite control is removed from result cards, gym detail and comparison, and `/account/favourites` shows a permanent explanatory notice rather than an empty state. Saved rows are retained in full and reappear intact when the flag returns; the post-login completion of a pre-login favourite (`AC-FAV-01.1`) is skipped rather than queued. | OFF | percentage | Web | 2026-10-12 | 2027-01-10 | `FR-FAV-01`–`FR-FAV-04`, `SCR-WEB-012`, `API-FAV` | PROPOSED |
| `rel.discovery.saved-searches` | Release | **Off:** a search cannot be named and saved and no new-match alert is ever queued. The URL still encodes location, query, every filter, sort and page (`AC-SRCH-01.3`), so a visitor can bookmark a search manually — the capability degrades to a browser feature rather than vanishing. | OFF | percentage | Web | 2026-10-12 | 2027-01-10 | `FR-SRCH-14`, `FR-FAV-05`, `API-FAV` saved-searches | PROPOSED |
| `rel.discovery.search-this-area` | Release | **Off:** panning the map does not offer to re-run the search against the new viewport; results stay bound to the location the visitor entered, and the map re-centres on the result set after each new query instead of following the pan. List-and-map hover synchronisation (`AC-SRCH-02.1`) is unaffected. | OFF | percentage | Web | 2026-10-12 | 2027-01-10 | `FR-SRCH-08`, `AC-SRCH-02.2`, `SCR-WEB-002`, `map_area_searched` event | PROPOSED |
| `rel.discovery.city-launch-gate` | Release | **Off for a city:** that city's landing page is excluded from the sitemap and marked `noindex`, the city is hidden from the city picker, and paid-acquisition destinations pointing at it are disabled. Gyms in the city stay fully live, fully sellable and fully reachable by direct link and by search from an adjacent location — supply is never switched off, only demand generation. This is the executable form of the five `C9.4` gates, and it exists so that `RSK-10` is a decision somebody makes rather than an accident that happens. | OFF | city | Commercial | 2027-03-29 | 2027-06-27 | `§C9.4`, `RSK-10`, `KPI-17`, `FR-SRCH-13`, `SCR-WEB-001` | PROPOSED |
| `rel.ordering.abandoned-checkout-recovery` | Release | **Off:** no reminder is generated for an order abandoned after the auth gate. The order still expires at 30 minutes and still releases its coupon reservation (`FR-CART-05`), so nothing about order hygiene depends on this flag — only the recovery message. Suppression by notification preference applies in both positions. | OFF | percentage | Product | 2026-11-09 | 2027-02-07 | `FR-CART-10`, `FR-USER-04`, `KPI-11`, `checkout_abandoned` event | PROPOSED |
| `rel.ordering.offline-partial-payment` | Release | **Off:** a staff-recorded sale must be paid in full at the desk; the "amount received" field accepts only the total and no order can enter `PARTIALLY_PAID`. Balances already outstanding stay collectable and the "collect balance" action stays available — collection is never gated, because gating it would strand money owed to the gym. Online marketplace purchases are unaffected in either position (`AC-CART-02.4`). Sticky-journey. | OFF | tenant | Backend | 2026-12-21 | 2027-03-21 | `BR-PAY-09`, `FR-CART-09`, `US-CART-02`, `SCR-DASH-012`, `E2E-10` | PROPOSED |
| `rel.ordering.coupon-bulk-codes` | Release | **Off:** coupons are created one code at a time, so a win-back campaign needing several thousand single-use codes cannot be run. Codes already generated stay redeemable and keep their per-user limits; redemption is never gated. | OFF | tenant | Product | 2027-01-04 | 2027-04-04 | `FR-CPN-05`, `BR-CPN-01`, `SCR-DASH-016` | PROPOSED |
| `rel.ordering.referral-programme` | Release | **Off:** no referral code is issued, referral links resolve to the plain gym page with no attribution recorded, and `/account/referrals` is hidden. Rewards already **qualified** are still credited, because a reward that has cleared the refund window is a settled obligation and not a feature. Self-referral detection runs in both positions so that turning the flag back on does not admit a backlog of circular attributions. | OFF | percentage | Product | 2027-01-04 | 2027-04-04 | `FR-REFR-01`–`FR-REFR-05`, `FR-REFR-07`, `BR-RFL-01`, `SCR-WEB-015` | PROPOSED |
| `rel.ordering.wallet-credit` | Release | **Off:** the wallet balance is not shown and is not applied at checkout, so the full amount goes to the payment gateway. Balances are **frozen, not expired** — the expiry countdown is suspended for the period the flag is off, so nobody loses credit to an operational decision they had no part in. Sticky-journey: an order that priced wallet credit in keeps it. | OFF | percentage | Finance | 2027-01-04 | 2027-04-04 | `BR-WAL-01`, `FR-REFR-06`, `SCR-WEB-014`, `/account/wallet` | PROPOSED |
| `rel.memberships.freeze` | Release | **Off:** no freeze action appears on any surface for any plan, regardless of each plan's `freeze_allowed` setting, and the freeze-days counter is hidden. Memberships already `FROZEN` continue to unfreeze on schedule and their extended end dates stand — an in-flight freeze is a commitment, not a feature. This is the `OQ-06` launch switch. | OFF | tenant | Product | 2026-11-23 | 2027-02-21 | `BR-MEM-05`, `BR-MEM-06`, `BR-MEM-07`, `FR-MEMB-04`, `FR-MEMB-05`, `OQ-06`, `US-MEMB-01`, `E2E-05` | PROPOSED |
| `rel.memberships.auto-renewal` | Release | **Off:** the auto-renew toggle is hidden at purchase and on membership detail, the daily `membership.auto-renew` job takes no charges, and every member renews by hand. Existing mandates stay tokenised at the provider rather than being revoked, so re-enabling does not force every member to re-consent. Renewal reminders (`BR-MEM-11`) continue unchanged, so nobody's membership lapses because this flag is off. This is the `OQ-07` launch switch. | OFF | tenant + percentage | Product | 2026-11-23 | 2027-02-21 | `BR-MEM-10`, `FR-MEMB-08`, `FR-PAY-11`, `OQ-07`, `KPI-12` | PROPOSED |
| `rel.memberships.transfer` | Release | **Off:** `POST /tenant/memberships/:id/transfer` returns 404 and the transfer action is absent from Member 360; a member wanting to hand a membership over must cancel under the refund policy and have the recipient buy afresh. Plans keep their `transfer_allowed` setting so the data is ready when the flag turns on. | OFF | tenant | Backend | 2026-11-23 | 2027-02-21 | `BR-MEM-08`, `FR-MEMB-11`, `FR-PLAN-01`, `SCR-DASH-008` | PROPOSED |
| `rel.attendance.auto-checkout` | Release | **Off:** check-out is not recorded at all — no check-out control on the desk, no hourly `attendance.auto-checkout` sweep — so `checked_out_at` and `duration_minutes` stay null and the visit-duration column is hidden from the attendance log, the member's visit history and both exports. Check-**in** is completely unaffected, including its `NFR-PERF-03` budget. | OFF | tenant | Backend | 2026-12-07 | 2027-03-07 | `FR-CHK-09`, `FR-CHK-10`, `SCR-DASH-010`, `SCR-WEB-010`, `attendance.auto-checkout` job | PROPOSED |
| `rel.attendance.peak-hour-heatmap` | Release | **Off:** the weekday-by-hour heatmap disappears from the attendance report and the Peak Hours card is removed from the report catalogue. Raw visit counts by day remain, so staffing decisions are still possible but are made by reading a table instead of a picture — which is the difference `OBJ-06` is about. | OFF | tenant | Dash | 2026-12-07 | 2027-03-07 | `FR-CHK-13`, `US-CHK-02`, `AC-CHK-02.1`, `SCR-DASH-010` | PROPOSED |
| `rel.attendance.sharing-detection` | Release | **Off:** the hourly implausible-travel scan does not run and no membership is flagged for sharing review, leaving the 60-second rotating token (`BR-CHK-02`) as the entire defence against credential sharing. Memberships already under review stay under review — clearing them is a human decision and is not reversed by a flag. Turning this off materially raises exposure to `RSK-03` and should be a deliberate, time-boxed act. | OFF | tenant + percentage | Product | 2026-12-07 | 2027-03-07 | `BR-CHK-07`, `FR-CHK-12`, `BR-MEM-13`, `RSK-03`, `attendance.sharing-scan` job | PROPOSED |
| `rel.crm.at-risk-flagging` | Release | **Off:** the nightly baseline recomputation is skipped, the at-risk column and the saved segment disappear from the member list, and the dashboard-home action list falls back to "no visit in 21 days" — a plain filter that needs no per-member baseline. Bulk notification to a filtered list keeps working, so the owner can still act; they just act on a cruder signal. | OFF | tenant | Product | 2026-12-21 | 2027-03-21 | `FR-CRM-06`, `FR-CRM-02`, `US-CRM-01`, `OBJ-05`, `crm.risk-flags` job | PROPOSED |
| `rel.staff.trainer-sessions` | Release | **Off:** `/trainers/sessions` renders the Phase-2 stub page. Trainers keep their assigned-member list and workout-plan assignment (`FR-STAF-07` split), but no personal-training session can be scheduled, logged or reported. This is the `OQ-15` switch and is expected to remain off for the whole of Phase 1; it exists so the stub is a configuration state rather than a hard-coded placeholder. | OFF | tenant | Product | 2026-12-21 | 2027-03-21 | `FR-STAF-07`, `OQ-15`, `A4.2` trainer marketplace, `/trainers/sessions` | PROPOSED |
| `rel.reviews.anomaly-detection` | Release | **Off:** the hourly velocity, account-age and text-clustering scan does not run, so no review is automatically held on anomaly and none is excluded from the aggregate pending review. Submission screening (`BR-REV-04`) and the human moderation queue still operate, so the trust floor holds — what is lost is the early-warning layer that makes `RSK-02` survivable at volume. | OFF | percentage | Operations | 2027-01-04 | 2027-04-04 | `FR-REV-09`, `BR-REV-04`, `RSK-02`, `AC-REV-02.2`, `review.anomaly-scan` job | PROPOSED |
| `rel.reviews.review-prompts` | Release | **Off:** no review request is sent after the member's third check-in, and no day-45 follow-up. A member can still write a review by navigating to the gym, so eligibility (`BR-REV-01`) is untouched and the only consequence is that `KPI-13` falls. Prompts are an operational-category notification and remain subject to preferences and quiet hours in both positions. | OFF | percentage | Product | 2027-01-04 | 2027-04-04 | `FR-REV-10`, `KPI-13`, `BR-REV-01`, `B5.19` catalogue | PROPOSED |
| `rel.settlements.auto-payout` | Release | **Off:** every settlement batch, of every size, for every tenant, waits for explicit Finance approval before a payout instruction is created. Turning it **on** delegates only batches below the tenant's configured auto-approval threshold. The flag can therefore only ever *reduce* manual work below the threshold; it can never remove an approval that `BR-FIN-08` requires. Off is the safe direction and §6.1 row 4 asserts it. | OFF | tenant | Finance | 2027-01-18 | 2027-04-18 | `FR-SETL-06`, `BR-FIN-08`, `BR-FIN-07`, `SCR-ADM-007`, `E2E-12` | PROPOSED |
| `rel.settlements.dual-payout-approval` | Release | **Off:** the second-approver workflow is not offered, and every payout above the dual-approval threshold is held in `PENDING_APPROVAL` and escalated rather than being paid on a single signature. Off is **more** restrictive than on — this flag adds a control and can never remove one. Turning it on is what allows large payouts to move at all. | OFF | tenant | Finance | 2027-01-18 | 2027-04-18 | `BR-FIN-08`, `FR-SETL-06`, `SCR-ADM-007`, `§C4.7` | PROPOSED |
| `rel.reporting.scheduled-delivery` | Release | **Off:** the "Schedule this report" control is hidden and the delivery job takes no work; owners open reports on demand. Schedules already configured are **paused, not deleted**, and when the flag returns no catch-up burst is sent — the next delivery is the next scheduled one, so nobody receives eleven weekly reports in one morning. | OFF | tenant | Dash | 2027-02-15 | 2027-05-16 | `FR-RPT-04`, `FR-NOTF-06`, `SCR-DASH-020`, `report.scheduled-delivery` job | PROPOSED |
| `rel.reporting.async-exports` | Release | **Off:** every export runs synchronously, and any request above the row threshold is refused with an explicit message naming the threshold and suggesting a narrower date range — never a timeout, never a silently truncated file. `NFR-PERF-06`'s five-second synchronous budget is honoured in both positions; the difference is whether large exports are possible or merely declined politely. | OFF | tenant + percentage | Backend | 2027-02-15 | 2027-05-16 | `FR-RPT-03`, `NFR-PERF-06`, `BR-DAT-05`, `export.generate` job | PROPOSED |
| `rel.notifications.web-push` | Release | **Off:** `push` disappears from the notification-preference matrix and every push-eligible message falls back to the next channel in the `B5.19` catalogue — email first, in-app always. This is the flag that keeps `DEP-06` genuinely optional rather than nominally optional: with it off, the platform has no runtime dependency on a push service at all. | OFF | percentage | Backend | 2027-03-01 | 2027-05-30 | `FR-NOTF-01`, `DEP-06`, `FR-USER-04`, `SCR-WEB-014` | PROPOSED |
| `rel.notifications.quiet-hours` | Release | **Off:** the quiet-hours setting is hidden and operational and marketing messages send on the sender's schedule rather than the recipient's clock. Transactional messages were never subject to quiet hours in either position, so nothing time-critical — OTP, payment failure, membership activation, gym closure — changes behaviour. | OFF | percentage | Backend | 2027-03-01 | 2027-05-30 | `FR-NOTF-05`, `FR-NOTF-02`, `FR-USER-04`, `NFR-DQ-03` | PROPOSED |
| `rel.support.help-centre` | Release | **Off:** `/help/articles` and the help-centre search box are hidden, and every support entry point routes straight to ticket creation. The cost is measured directly in tickets per tenant per month — the number that `OBJ-10` exists to hold down and that `A6.5` identifies as the variable most likely to break unit economics. | OFF | percentage | Support | 2027-03-01 | 2027-05-30 | `FR-SUP-06`, `OBJ-10`, `A6.5`, `SCR-WEB-017` | PROPOSED |
| `rel.support.satisfaction-rating` | Release | **Off:** no rating prompt is shown when a ticket resolves, and the CSAT column disappears from the support-load report. SLA timing and breach alerting (`FR-SUP-05`, `KPI-25`) are entirely unaffected, so response performance stays measurable even when satisfaction is not. | OFF | percentage | Support | 2027-03-01 | 2027-05-30 | `FR-SUP-07`, `FR-SUP-05`, `KPI-25`, `SCR-ADM-013` | PROPOSED |

### 7.4 Experiment flags

| Flag key | Type | Description | Default | Targeting | Owner role | Created | Retirement date | Related PRD id | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `exp.discovery.ranking-formula-v2` | Experiment | Splits search traffic between the incumbent relevance weighting and one candidate weighting, measured on `KPI-09` (search-to-detail) and `KPI-10` (detail-to-checkout). **Off:** everyone gets the incumbent formula. The formula's *weights* are configuration and stay configurable without deployment (`FR-SRCH-10`); this flag chooses **which formula is live**, not what its numbers are. Featured placement remains labelled as promoted in both arms. | OFF | percentage | Product | 2026-10-12 | 2026-12-11 | `FR-SRCH-10`, `KPI-09`, `KPI-10`, `FR-SRCH-11` | PROPOSED |
| `exp.discovery.zero-result-relaxation` | Experiment | Splits the zero-result screen between naming the single most restrictive filter with a one-tap relaxation, and offering a ranked list of three relaxations each with its previewed result count. Measured on the rate at which a zero-result search becomes a non-zero one within the same session. **Off:** the single-filter variant, which is the `FR-SRCH-12` baseline and the `AC-SRCH-01.2` wording. | OFF | percentage | Product | 2026-10-12 | 2026-12-11 | `FR-SRCH-12`, `AC-SRCH-01.2`, `search_zero_results` event | PROPOSED |
| `exp.ordering.checkout-single-page` | Experiment | Splits checkout between the three-step flow (`SCR-WEB-005` → `006` → `007`) and a single scrolling page, measured on `KPI-11` (checkout completion). **Off:** the three-step flow. Server-computed amounts, the full refund-policy disclosure, eligibility validation and terms acceptance are byte-identical in both arms — the experiment moves layout, never obligations. Sticky-journey: an order started in one arm finishes in it. | OFF | percentage | Product | 2026-11-09 | 2027-01-08 | `KPI-11`, `SCR-WEB-005`, `FR-CART-02`–`FR-CART-04`, `BR-REF-01` | PROPOSED |
| `exp.reviews.prompt-timing` | Experiment | Splits the review prompt between the third check-in and the seventh, measured on `KPI-13` (review submission rate) **and** on mean rating, to detect whether an earlier prompt skews positive — a metric that would make the experiment a win on volume and a loss on trust. **Off:** the `FR-REV-10` baseline of the third check-in plus a day-45 follow-up. | OFF | percentage | Operations | 2027-01-04 | 2027-03-05 | `FR-REV-10`, `KPI-13`, `OBJ-03`, `BR-REV-07` | PROPOSED |
| `exp.notifications.renewal-reminder-cadence` | Experiment | Splits the renewal reminder schedule between the `BR-MEM-11` baseline (T−15, −7, −3, −1 and on expiry) and a two-touch variant (T−7 and T−1), measured on `KPI-12` (renewal rate) against notification cost per renewal (`FR-NOTF-08`, `RSK-12`). **Off:** the `BR-MEM-11` baseline. A tenant that has overridden its own schedule under `FR-MEMB-10` is excluded from both arms rather than silently overridden. | OFF | percentage | Product | 2027-03-01 | 2027-04-30 | `BR-MEM-11`, `FR-MEMB-10`, `KPI-12`, `FR-NOTF-08`, `RSK-12` | PROPOSED |

### 7.5 Operational kill-switches — permanent

Every row below is `PERMANENT` by design (§2.3): no retirement date, exempt from `FF-CI-04`, no
targeting, and subject to a recorded pull drill at least once every 90 days in Staging. All nine are
pulled together in `PROFILE-DEGRADED` (§6.2), which asserts that check-in and payment survive.

| Flag key | Type | Description | Default | Targeting | Owner role | Created | Retirement date | Related PRD id | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ops.common.idempotency-replay` | Kill-switch | **Pulled:** the interceptor still STORES every `Idempotency-Key` and its fingerprint, and stops REPLAYING stored responses — a retry executes again. Pull it only if a defective fingerprint is turning legitimate second purchases into replayed first ones, which is the one failure mode replay itself can cause. **The flag never disables storage**, because a gap in the store is unrecoverable: the keys missed during the gap can never be reconstructed, so re-enabling replay afterwards would leave a window of requests that are silently non-idempotent. Note the asymmetry — pulling this trades a possible double charge for a certain loss of replay, so it is a last resort rather than a routine lever. | ON | default only | Engineering | 2026-08-07 | — (permanent) | `BR-PAY-03`, `AC-FND-07.2`, `AC-FND-07.4`, `TR-36`, `§14.2.1` | PROPOSED |
| `ops.discovery.marketplace-search` | Kill-switch | **Pulled:** `/search/gyms` and `/search/suggest` return a maintenance state, the search bar is replaced by a city picker, and city and category landing pages serve their last good cached list. Gym detail pages still resolve by slug, checkout still completes, and check-in is untouched — the degradation contract of `NFR-AVL-03`. Pull this when search load threatens the write path (`NFR-SCAL-04`), when a reindex has corrupted results, or when `NFR-PERF-01` is breached platform-wide. | ON | default only | Engineering | 2026-09-28 | — (permanent) | `NFR-AVL-03`, `NFR-SCAL-04`, `NFR-PERF-01`, `FR-SRCH-13`, `search.reindex` job | PROPOSED |
| `ops.discovery.map-provider` | Kill-switch | **Pulled:** no request of any kind is made to the maps or geocoding vendor. The map panel renders the `AC-SRCH-02.3` notice, "search this area" is hidden, pin clustering is skipped, and the directions link degrades to a plain address string. **Distances keep working**, because radius and distance come from PostGIS and not from the vendor — which is why the map failing is a cosmetic event rather than a search outage. Pull this when `DEP-02` fails or its rate limit under `CON-02` is exhausted. | ON | default only | Engineering | 2026-09-28 | — (permanent) | `DEP-02`, `CON-02`, `AC-SRCH-02.3`, `NFR-AVL-03`, `NFR-AVL-07` | PROPOSED |
| `ops.notifications.dispatch` | Kill-switch | **Pulled:** the outbox and the delivery queue stop draining and nothing is sent on any channel. **Nothing is lost:** domain events keep landing in the outbox in the same transaction as their state change (`§C1.5`), and the in-app notification centre keeps recording, so a member logging in still sees what happened. On restore the backlog drains **under the per-recipient per-category rate limit** (`FR-NOTF-06`), so nobody receives forty messages in ninety seconds. Pull this when a provider is failing in a way that burns quota, delivers corrupted content, or double-sends. | ON | default only | Engineering | 2026-10-26 | — (permanent) | `FR-NOTF-04`, `FR-NOTF-06`, `DEP-03`, `DEP-04`, `§C1.5` outbox, `notification.dispatch` job | PROPOSED |
| `ops.payments.retry` | Kill-switch | **Pulled:** a failed payment offers no retry against the same order; the member is offered a fresh order with prices re-validated server-side. Intent creation, capture, webhook processing, the indeterminate-payment poller and reconciliation are all unaffected. Pull this when the provider is failing in a way that makes retrying harmful — most importantly when failures are actually succeeding late, where a retry becomes the duplicate that `BR-PAY-07` then has to clean up. | ON | default only | Engineering + Finance | 2026-10-26 | — (permanent) | `FR-PAY-06`, `BR-PAY-03`, `BR-PAY-06`, `DEP-01`, `KPI-19` | PROPOSED |
| `ops.payments.duplicate-auto-refund` | Kill-switch | **Pulled:** the 15-minute detector still runs and still identifies duplicate captures, but instead of refunding automatically it raises a Finance task with an alarm timed to fire **before** `BR-PAY-07`'s one-business-day deadline. The rule is not suspended — only its automation is, which is the distinction §6.3 turns on. Pull this when the detector is producing false positives against a provider's reporting, where an automatic refund would be refunding a legitimate second purchase. | ON | default only | Finance + Engineering | 2026-11-09 | — (permanent) | `BR-PAY-07`, `FR-PAY-08`, `US-PAY-01`, `E2E-08`, `payment.duplicate-detect` job | PROPOSED |
| `ops.settlements.auto-build` | Kill-switch | **Pulled:** the daily `settlement.build-batches` job assembles nothing. The ledger keeps accruing normally, tenants see their current cycle as still open with an explanatory status, and no payout instruction can be created because no batch exists to approve. Pull this when daily reconciliation (`FR-SETL-09`, `BR-FIN-07`) shows an unexplained variance and money must stop moving before anyone understands why — `KPI-26` requires zero variance and this is how that requirement is defended in real time. | ON | default only | Finance + Engineering | 2027-01-18 | — (permanent) | `FR-SETL-01`, `FR-SETL-09`, `BR-FIN-07`, `KPI-26`, `settlement.build-batches` job | PROPOSED |
| `ops.reviews.publication` | Kill-switch | **Pulled:** newly submitted reviews are accepted, screened and stored as `HELD` (`§C4.6`) instead of `PUBLISHED`; already-published reviews stay published and gym rating aggregates freeze at their last computed value. **No review is rejected, lost or silently dropped** — every held review flows into the moderation queue when the switch is restored. Pull this during a coordinated review attack while the anomaly detector is retuned, which is the acute form of `RSK-02`. | ON | default only | Operations | 2027-01-04 | — (permanent) | `BR-REV-04`, `BR-REV-06`, `FR-REV-07`, `RSK-02`, `§C4.6`, `review.aggregate` job | PROPOSED |
| `ops.onboarding.new-tenant-signups` | Kill-switch | **Pulled:** `POST /tenants` and the `/for-gyms/signup` form are refused with a waitlist capture rather than an error. Applications already in progress continue to be editable and submittable, the approval queue keeps clearing, and every existing tenant is entirely unaffected. Pull this when verification throughput cannot keep up with intake (`FR-ADMN-11`, `KPI-03`), or during a fraudulent-signup wave (`RSK-01`). | ON | default only | Operations | 2026-08-31 | — (permanent) | `FR-ONB-01`, `FR-ADMN-11`, `KPI-03`, `RSK-01`, `§C4.4` | PROPOSED |
| `ops.ordering.new-order-creation` | Kill-switch | **Pulled:** `POST /orders` returns 503 with a customer-language maintenance message and the "Buy now" action is disabled across the marketplace and the dashboard. Orders already `PENDING` can still be paid to completion, every membership stays active, and check-in is untouched. **This is the last switch to pull and the first to restore** — it is the only one that stops the platform earning, and `NFR-AVL-02` names payment as one of the two paths that degrade last. | ON | default only | Engineering + Finance | 2026-10-26 | — (permanent) | `NFR-AVL-02`, `FR-CART-05`, `BR-PAY-04`, `KPI-11`, `KPI-14`, `§C4.2` | PROPOSED |

### 7.6 Permission / entitlement flags

| Flag key | Type | Description | Default | Targeting | Owner role | Created | Retirement date | Related PRD id | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ent.iam.support-impersonation` | Entitlement | Grants the impersonation capability to `SUPPORT_AGENT` and `SUPER_ADMIN` (`B3.2`). **Off:** `POST /auth/impersonate` is refused for everyone and any live impersonated session terminates at its next request rather than running to its 30-minute cap. Every constraint in `FR-AUTH-12` — the stated reason, the cap, the persistent banner, the ban on financial mutations, the entry in the member's own activity log — is code and not flag, and holds whenever the capability is on. **Retires by graduation** into the RBAC permission matrix once `FR-RBAC-01` coverage is complete. | OFF | role | Engineering | 2026-08-31 | 2027-08-31 | `FR-AUTH-12`, `BR-DAT-02`, `B3.2`, `FR-RBAC-05`, `US-AUTH-03` | PROPOSED |
| `ent.discovery.featured-listing-credits` | Entitlement | Grants the Professional tier its bundled featured-placement credits (`A6.2`). **Off for a tenant:** they may still buy placement as a one-off, but no credits accrue and the "included credits" panel is hidden from settings. **Depends on** `rel.discovery.featured-listings`; if the parent is off, this resolves off regardless of tier (§5.6). Retires by graduation into `subscription_tiers` configuration. | OFF | tenant | Commercial | 2026-09-28 | 2027-09-28 | `A6.2` Professional, `A6.1` stream 3, `FR-ADMN-04`, `FR-SRCH-11` | PROPOSED |
| `ent.billing.invoice-branding` | Entitlement | Grants tenant logo and footer text on invoices from the Growth tier upward. **Off for a tenant:** invoices render with platform-neutral styling. Invoices already issued are immutable (`BR-PAY-10`, `FR-INV-03`) and are never re-rendered, so a tier change or a flag flip can never alter a document that has already been sent to a customer or filed by an accountant. | OFF | tenant | Commercial | 2026-11-09 | 2027-11-09 | `FR-INV-11`, `A6.2` Growth, `BR-PAY-10`, `FR-INV-07` | PROPOSED |
| `ent.crm.leads-pipeline` | Entitlement | Grants the enquiry pipeline from the Growth tier upward. **Off for a tenant:** `/leads` is hidden and enquiries are captured but not worked. Nothing is discarded, so an upgrade reveals the accumulated backlog rather than starting from an empty board — the tenant is never punished for the period they were not entitled. | OFF | tenant | Commercial | 2026-12-21 | 2027-12-21 | `A6.2` Growth, `SCR-DASH-017`, `FR-ADMN-04`, `Lead funnel` report | PROPOSED |
| `ent.ordering.coupons` | Entitlement | Grants tenant-created coupons from the Growth tier upward. **Off for a tenant:** `/coupons` is hidden and the tenant cannot create or edit codes. Platform-wide coupons (`FR-CPN-02`) still apply to their plans in both positions, because those are the platform's promotion and not the tenant's entitlement. Existing tenant coupons stay redeemable to their validity end. | OFF | tenant | Commercial | 2027-01-04 | 2028-01-04 | `A6.2` Growth, `FR-CPN-02`, `BR-CPN-01`, `FR-ADMN-04` | PROPOSED |
| `ent.reporting.advanced-reports` | Entitlement | Grants the Growth-tier report set — churn cohort, member activity, coupon performance, lead funnel — on top of the Starter set. **Off for a tenant:** those four cards are hidden from the report catalogue. The underlying data remains theirs and remains fully exportable under `BR-DAT-05`, because `A3.4` principle 1 makes export a right and not a retention lever. Entitlement gates the analysis, never the data. | OFF | tenant | Commercial | 2027-02-15 | 2028-02-15 | `A6.2` Growth, `BR-DAT-05`, `A3.4`, `B5.20` catalogue, `FR-ADMN-04` | PROPOSED |
| `ent.reporting.multi-branch-analytics` | Entitlement | Grants cross-branch roll-up and branch comparison from the Professional tier upward. **Off for a tenant:** every report is either single-branch or all-branches-summed, with no per-branch comparison axis; a three-branch owner can see each branch and the total, but not the three side by side. | OFF | tenant | Commercial | 2027-02-15 | 2028-02-15 | `A6.2` Professional, `FR-RPT-01`, `BR-TEN-03`, `FR-ADMN-04` | PROPOSED |
| `ent.notifications.tenant-template-override` | Entitlement | Grants tenant-level notification template overrides where the tier permits. **Off for a tenant:** platform templates are used verbatim and the template editor is a read-only preview. Overrides already saved are retained and reactivate on upgrade. Transactional template content that carries legal or financial disclosure is not overridable in either position. | OFF | tenant | Commercial | 2027-03-01 | 2028-03-01 | `FR-NOTF-03`, `A6.2`, `SCR-DASH-021`, `FR-ADMN-04` | PROPOSED |

### 7.7 Migration flags

| Flag key | Type | Description | Default | Targeting | Owner role | Created | Retirement date | Related PRD id | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `mig.payments.secondary-provider-adapter` | Migration | Routes **new** payment intents to the second `PaymentProvider` adapter instead of the Stripe Connect reference adapter, per tenant. **Off:** everything goes to the reference adapter. Existing intents, captures, refunds and webhooks always resolve against the adapter that created them — the flag routes new work only and never re-homes an in-flight payment. This flag is the live proof that `DEP-01`'s stated mitigation ("second adapter ready") is real rather than architectural theatre. | OFF | tenant | Engineering | 2027-02-01 | 2027-07-31 | `FR-PAY-01`, `DEP-01`, `ASM-03`, `§C1.1` PaymentProvider port | PROPOSED |
| `mig.attendance.partitioned-reads` | Migration | Points attendance **reads** at the monthly-partitioned tables instead of the flat table during the `NFR-SCAL-06` cutover. **Off:** reads use the flat table. Writes go to both throughout, so the flag only chooses which side is authoritative for reads, and a shadow comparison logs any row-count divergence rather than failing the user's request. Check-in write latency (`NFR-PERF-03`) is unaffected in either position. | OFF | tenant + percentage | Engineering | 2027-02-15 | 2027-08-14 | `NFR-SCAL-06`, `§C2.2` attendance partitioning, `NFR-PERF-03`, `audit.partition-maintenance` job | PROPOSED |
| `mig.ledger.balance-projection` | Migration | Serves tenant balances from a materialised projection instead of aggregating `ledger_entries` on every request. **Off:** aggregate live. The append-only ledger remains the sole source of truth in both positions (`BR-FIN-01`) — the projection is a read cache, the settlement build never reads it, and a nightly job asserts projection equals aggregate **to the minor unit** and alerts on any difference. This flag changes performance, never arithmetic. | OFF | tenant + percentage | Engineering | 2027-02-15 | 2027-08-14 | `BR-FIN-01`, `BR-FIN-02`, `§C2.2` ledger_entries, `NFR-PERF-04` | PROPOSED |
| `mig.discovery.opensearch-backend` | Migration | Switches free-text and facet search from PostgreSQL full-text plus trigram to OpenSearch, once the catalogue justifies it at roughly 50,000 listings. **Off:** Postgres serves search, which is the `§C1.1` position and stays the position until the data says otherwise. Geospatial radius filtering stays in PostGIS in both arms. The flag exists so the cutover is reversible in one action if p95 regresses against `NFR-PERF-01`. Mutually exclusive with `exp.discovery.ranking-formula-v2` (§6.2). | OFF | percentage | Engineering | 2027-03-29 | 2027-09-25 | `§C1.1` search selection, `NFR-PERF-01`, `NFR-PERF-09`, `NFR-SCAL-02` | PROPOSED |
| `mig.tenancy.dedicated-schema-pilot` | Migration | Routes one named large tenant's queries to a dedicated schema instead of the shared one, exercising the migration path `§C1.4` promises. **Off:** shared schema with row-level security. Row-level security, the `SET LOCAL app.tenant_id` discipline, the tenant-scoped repository layer and the CI isolation suite apply **identically** in both arms — the flag changes where the rows live, never whether isolation is enforced (`BR-TEN-01` is on the protected list and this flag does not gate it). Mutually exclusive with `mig.attendance.partitioned-reads` for the same tenant. | OFF | tenant | Engineering | 2027-03-29 | 2027-09-25 | `§C1.4` migration path, `BR-TEN-01`, `NFR-SEC-09`, `E2E-11`, `BAC-10` | PROPOSED |

---

## 8. What is not a feature flag

Registry bloat is the failure mode that kills flag governance: once there are 300 keys, nobody reads
the registry, the matrix in §6.2 stops approximating anything, and the expiry gate becomes a thing
people route around. The defence is a strict boundary between **flags** and **configuration**.

| It is configuration, not a flag | Mechanism | PRD basis |
| :--- | :--- | :--- |
| Commission rates — global, per tier, per tenant override, with effective-rate resolution | `FR-ADMN-03` configuration screens | `FR-ADMN-03`, `AC-ADMN-01.1`–`01.4`, `BR-FIN-05` |
| Subscription tier limits, features and prices | `subscription_tiers` reference table | `FR-ADMN-04`, `A6.2` |
| Tax profiles per country: rates, inclusive or exclusive, rounding, invoice fields | `tax_profiles` reference table | `FR-ADMN-05`, `FR-INV-05`, `BR-PAY-11` |
| KYC document checklists per country | `kyc_checklists` reference table | `FR-ADMN-06`, `FR-ONB-03` |
| Taxonomy: amenities, categories, cities, localities, and all five reason-code sets | `FR-ADMN-07` taxonomy management | `FR-ADMN-07`, `NFR-DQ-06`, `§C4.8` |
| Notification template content and versions | `notification_templates` reference table | `FR-NOTF-03` |
| Ranking formula **weights** | `FR-SRCH-10`, explicitly *"configurable without deployment"* | `FR-SRCH-10` |
| Check-in cooldown duration, auto-checkout threshold, override reason list | Tenant settings | `BR-CHK-04`, `FR-CHK-09`, `OQ-08`, `SCR-DASH-022` |
| Settlement cycle days, reserve basis points, minimum payout, auto-approval threshold | Tenant financial settings | `A6.4`, `§C2.2` `tenants`, `OQ-04` |
| Refund policy: window, proration method, cancellation fee | `tenants.refund_policy` JSONB, snapshotted onto the order | `BR-REF-01`, `BR-REF-02`, `OQ-05` |
| Minimum reviews before a numeric rating displays | Platform setting | `BR-REV-07`, `OQ-10` |
| Freeze allowance, transfer allowance, stackability, access windows **per plan** | Plan attributes | `FR-PLAN-01`, `BR-MEM-05`, `BR-MEM-08` |
| Environment differences — sandbox payments, stubbed providers, seeded data | Environment configuration | `§C7` |

The distinguishing test, applied at G1: **if the value is a business parameter that an authorised
non-engineer sets as part of running the platform, it is configuration. If it selects between two
code paths, one of which is intended to stop existing, it is a flag.** A payment sandbox is not a
flag; it is an environment. A commission rate is not a flag; it is a rate with a `FR-ADMN-03`
precedence chain of its own.

---

## 9. Open items, dependencies and pending stack slots

### 9.1 Additions requiring the project owner's approval

Both items below are **additions** in the sense of `/docs/engineering/STACK_ADDITIONS.md` — they fill
a slot the PRD leaves open and contradict no PRD selection — and neither is used until approved.

| # | Item | PRD clause that leaves the slot open | Why it is needed | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FF-A-01** | **City as a fourth targeting dimension** (§5.2) | `FR-ADMN-08` names tenant, role and percentage. `§C9.4` mandates city-by-city gating of consumer marketing; the gated principal is an unauthenticated visitor with no tenant, so no combination of the three named dimensions expresses it. | `rel.discovery.city-launch-gate`; mitigation of `RSK-10`. | `PROPOSED` — until approved, the city gate is operated as a static configuration allowlist, not as a targeting rule. |
| **FF-A-02** | **A `flag change` reason-code taxonomy** (§5.7) | `§C4.8` defines five reason-code taxonomies; `FR-ADMN-07` makes reason-code taxonomies platform-managed configuration, so adding a sixth uses an existing mechanism rather than inventing one. | `FR-ADMN-02` requires a reason for every administrative action including an emergency kill-switch pull; a mandatory free-text box under incident pressure produces either non-compliance or noise. | `PROPOSED` |

### 9.2 Pending stack slots this document depends on

No third-party feature-flag vendor is proposed. The evaluator is first-party, lives in the `admin/`
module (`§C1.3`), and is built on PRD-named technology only: the `feature_flags` reference table in
PostgreSQL 16 and the Redis 7 cache. **If a vendor were ever proposed it would be a new row in
`/docs/engineering/STACK_ADDITIONS.md`, which currently ends at `A-30`, and would require approval
before use.**

The mechanisms in §5 and §6 do depend on slots that are registered and pending:

| Slot | Used for | Register id |
| :--- | :--- | :--- |
| ORM / data-access layer | Reading and writing `feature_flags` and `audit_log` inside the tenant-scoped transaction | pending `A-01` |
| Schema validation library | Validating the `PUT /admin/config/flags` payload server-side (`NFR-SEC-05`) | pending `A-02` |
| Test runners (unit, contract, integration, E2E) | The four profiles and 132 per-flag cells in §6.2 | pending `A-06` |
| Structured logging | Emitting `{ value, source, rule_id }` with the correlation id (`NFR-MNT-04`) | pending `A-14` |
| Architecture fitness tests | Gates `FF-CI-06`, `FF-CI-07`, `FF-CI-08`, and the acyclic dependency check in §5.6 | pending `A-23` |
| CI runner | Executing all ten `FF-CI-*` gates | pending `A-26` |

Where this document says "the ORM" or "the validation library", it means the slot, not a product. No
row in §7 assumes a specific library for any of them.

### 9.3 Open questions that decide a flag's fate

Nine of the twenty `OQ-` items in `§C11` resolve directly into a default value or a removal decision
in this registry. Until each is answered, the corresponding flag stays `PROPOSED` with the PRD's
stated default as its planned launch position.

| Open question | Flag it decides | PRD default if undecided |
| :--- | :--- | :--- |
| `OQ-06` — Is membership freeze available at launch? | `rel.memberships.freeze` | Yes, plan-configurable, default off |
| `OQ-07` — Auto-renewal at launch? | `rel.memberships.auto-renewal` | Yes, opt-in, off by default |
| `OQ-12` — Featured listings at launch? | `rel.discovery.featured-listings`, `ent.discovery.featured-listing-credits` | Yes, as a manually-sold placement with an automated slot |
| `OQ-13` — Is SMS mandatory, or email-only for cost control? | `rel.notifications.web-push`, `exp.notifications.renewal-reminder-cadence` | SMS for OTP and expiry, email for everything else |
| `OQ-14` — Trial or day-pass plans at launch? | `rel.plans.session-plans` | Yes, as a session-type plan with a session count of 1 |
| `OQ-15` — Trainer module in Phase 1 beyond role and assignment? | `rel.staff.trainer-sessions` | No; assignment only, sessions deferred |
| `OQ-01` — Launch country and city | `rel.discovery.city-launch-gate` (blocking) | Blocking; no default |
| `OQ-04` — Settlement cycle and reserve | `rel.settlements.auto-payout` threshold | T+7, 5% reserve released at 30 days |
| `OQ-19` — Support hours and staffing model | `rel.support.help-centre`, `rel.support.satisfaction-rating` | Business hours, email and in-app, 4-hour first response |

### 9.4 Known limitations of this scheme

Recorded here and cross-referenced into `/docs/KNOWN_LIMITATIONS.md` rather than discovered later.

1. **The matrix is an approximation.** Four profiles plus 132 pairwise cells do not test 2⁶⁶
   configurations. A defect that requires three specific non-default flags simultaneously will not
   be caught by `PROFILE-BASELINE` and may not be caught by `PROFILE-NEXT`. Gate `FF-CI-09`'s ceiling
   of eight concurrent active flags per module exists to keep the approximation defensible; it does
   not make it complete.
2. **Sticky-journey pinning trades freshness for coherence.** A resumed six-week-old onboarding
   application runs in the flag state it was started in (§5.3). That is required by `FR-ONB-01` and
   it means a rollback does not reach every in-flight journey immediately. A kill-switch is the tool
   for a defect that must reach everyone at once; kill-switches are deliberately never sticky.
3. **Sixty-second propagation is a ceiling, not a guarantee of ordering.** Two flag changes made
   within the same TTL window may become visible to different clients in different orders. Flags
   with a declared dependency (§5.6) are resolved together on the server, so the ordering hazard
   never reaches a dependent pair — but two independent flags changed a second apart may briefly
   disagree across surfaces.
4. **`PERMANENT` is a governance risk that has to be actively managed.** Nine keys exempt from the
   expiry gate is nine keys nobody is forced to look at. The 90-day pull drill in §2.3 is the entire
   counterweight, and a missed drill is treated with the same seriousness as an untested backup
   restore under `NFR-AVL-05`.
