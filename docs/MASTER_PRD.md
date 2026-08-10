# Gym Marketplace & Multi-Tenant Gym Management SaaS

## Business Requirements Document (BRD) & Product Requirements Document (PRD)

**Product & Engineering**
**Version 2.0 — 04 August 2026**

---

> ## ⚠️ SOURCE OF TRUTH NOTICE
>
> This file is the **single source of truth** for the entire project. It is a complete,
> loss-free Markdown transcription of `Gym_Marketplace_BRD_PRD_v2.pdf` (v2.0, 04 Aug 2026).
>
> **Rules governing this file**
>
> 1. Every future feature must comply with this document.
> 2. No feature that contradicts this document may be implemented.
> 3. Requirement identifiers are **stable** and are never reused. Deleted requirements are
>    marked `[WITHDRAWN]` and left in place so traceability holds across versions.
> 4. Changes follow the Change Control process in **Part C §C10** and increment the version.
> 5. Editorial additions made during transcription — and there are only clarifications, never
>    substitutions — are marked with the tag **`[EDITORIAL]`**. No source content has been
>    summarised, merged, or removed.
>
> **Companion documents**
>
> | Document | Purpose |
> | :--- | :--- |
> | `/docs/MASTER_PRD_CHECKLIST.md` | Every requirement as an individually tickable item |
> | `/docs/PROJECT_CONSTITUTION.md` | Immutable engineering law (how we build) |
> | `/docs/PHASES.md` | Execution ledger for the whole programme |
> | `/docs/DECISION_LOG.md` | Why each technical decision was taken |

---

## Table of Contents

**Document Control**
- [Revision History](#revision-history)
- [Approval Matrix](#approval-matrix)
- [How to Read This Document](#how-to-read-this-document)
  - [Identifier conventions](#identifier-conventions)
  - [Priority scale (MoSCoW)](#priority-scale-moscow)
- [Baseline Decisions Applied in This Version](#baseline-decisions-applied-in-this-version)

**[PART A — BUSINESS REQUIREMENTS DOCUMENT](#part-a--business-requirements-document)**
- [A1. Executive Summary](#a1-executive-summary)
- [A2. Business Context and Problem Statement](#a2-business-context-and-problem-statement)
- [A3. Vision, Objectives and Success Metrics](#a3-vision-objectives-and-success-metrics)
- [A4. Scope](#a4-scope)
- [A5. Stakeholders](#a5-stakeholders)
- [A6. Business Model](#a6-business-model)
- [A7. Business Processes](#a7-business-processes)
- [A8. Business Rules Catalogue](#a8-business-rules-catalogue)
- [A9. Assumptions, Constraints and Dependencies](#a9-assumptions-constraints-and-dependencies)
- [A10. Risk Register](#a10-risk-register)
- [A11. Future Scope (Phase 2 and beyond)](#a11-future-scope-phase-2-and-beyond)
- [A12. Acceptance Criteria for the Business](#a12-acceptance-criteria-for-the-business)

**[PART B — PRODUCT REQUIREMENTS DOCUMENT](#part-b--product-requirements-document)**
- [B1. Product Overview](#b1-product-overview)
- [B2. Personas](#b2-personas)
- [B3. Roles and Permission Matrix](#b3-roles-and-permission-matrix)
- [B4. Information Architecture](#b4-information-architecture)
- [B5. Functional Module Specifications](#b5-functional-module-specifications)
- [B6. Screen Specifications — Customer Website (`web`)](#b6-screen-specifications--customer-website-web)
- [B7. Screen Specifications — Gym Owner Dashboard (`dash`)](#b7-screen-specifications--gym-owner-dashboard-dash)
- [B8. Screen Specifications — Super Admin Console (`admin`)](#b8-screen-specifications--super-admin-console-admin)
- [B9. Non-Functional Requirements](#b9-non-functional-requirements)

**[PART C — ENGINEERING ANNEXES](#part-c--engineering-annexes)**
- [C1. Technical Architecture](#c1-technical-architecture)
- [C2. Data Model](#c2-data-model)
- [C3. API Specification](#c3-api-specification)
- [C4. State Machines](#c4-state-machines)
- [C5. Background Jobs](#c5-background-jobs)
- [C6. Analytics Event Taxonomy](#c6-analytics-event-taxonomy)
- [C7. Environments and Delivery Pipeline](#c7-environments-and-delivery-pipeline)
- [C8. Test Strategy](#c8-test-strategy)
- [C9. Delivery Plan](#c9-delivery-plan)
- [C10. Change Control](#c10-change-control)
- [C11. Open Questions](#c11-open-questions)
- [C12. Glossary](#c12-glossary)
- [C13. Traceability Summary](#c13-traceability-summary)
- [Document End](#document-end)

---

# Document Control

| Field | Value |
| :--- | :--- |
| Document title | Gym Marketplace & Multi-Tenant Gym Management SaaS — BRD & PRD |
| Version | 2.0 (supersedes v1.0 Draft) |
| Status | Issued for client approval and engineering hand-off |
| Date | 04 August 2026 |
| Owner | Product Management |
| Audience | Client sponsor, Engineering, Design, QA, DevOps, Finance, Support |
| Classification | Confidential — internal and client use only |

## Revision History

| Version | Date | Author | Summary of change |
| :--- | :--- | :--- | :--- |
| 1.0 | — | Product | Initial outline BRD/PRD. Scope headings, stakeholder list, discovery questions. |
| 2.0 | 04 Aug 2026 | Product | Full expansion. Adds measurable objectives, RACI, revenue mechanics, 24 module specifications with acceptance criteria, complete screen inventory for the customer website, gym dashboard and super-admin console, RBAC matrix, data model, REST API catalogue, state machines, NFR budgets, analytics taxonomy, test strategy and delivery plan. |

## Approval Matrix

**Development starts only after every row below is signed.**

| # | Approval item | Approver role | Signature | Date |
| :-: | :--- | :--- | :--- | :--- |
| 1 | Business scope and objectives (Part A §2–§6) | Client Sponsor | | |
| 2 | Revenue model and commission mechanics (Part A §6) | Client Sponsor / Finance | | |
| 3 | Business rules catalogue (Part A §9) | Client Sponsor / Operations | | |
| 4 | User roles and permission matrix (Part B §3) | Client Sponsor | | |
| 5 | Functional scope — Phase 1 modules (Part B §5) | Client Sponsor / Product | | |
| 6 | Screen inventory and information architecture (Part B §6–§8) | Client Sponsor / Design | | |
| 7 | Non-functional requirements (Part B §9) | Engineering Lead | | |
| 8 | Technical architecture and data model (Part C §1–§2) | Engineering Lead / CTO | | |
| 9 | API contract (Part C §3) | Engineering Lead | | |
| 10 | Timeline, milestones and budget (Part C §9) | Client Sponsor / Delivery | | |
| 11 | Change request process (Part C §10) | Client Sponsor / Delivery | | |

> **[EDITORIAL]** The source document references *"Business rules catalogue (Part A §9)"* in
> approval row 3. The business rules catalogue is physically located at **Part A §A8**; §A9 holds
> Assumptions, Constraints and Dependencies. Both sections require sign-off. This discrepancy is
> recorded verbatim above and flagged here rather than silently corrected.

## How to Read This Document

The document is one artefact in three parts, so that a single approved baseline drives business
sign-off, product build and engineering hand-off without divergence.

- **Part A — Business Requirements Document.** Why the platform exists, who it serves, how it
  makes money, the rules the business must obey, and what "done" means commercially. Written for
  the sponsor and non-technical stakeholders.
- **Part B — Product Requirements Document.** What the product does. Personas, permissions, every
  functional module with user stories and testable acceptance criteria, and a screen-by-screen
  specification of the customer website, the gym owner dashboard and the super-admin console.
  Written for product, design and QA.
- **Part C — Engineering Annexes.** How it is built. Architecture, multi-tenancy strategy, data
  model, API catalogue, state machines, analytics events, environments, test strategy and the
  delivery plan. Written for the development team.

### Identifier conventions

Every requirement carries a stable identifier. Identifiers never get reused, even if a requirement
is deleted — deleted items are marked `[WITHDRAWN]` and left in place so that traceability holds
across versions.

| Prefix | Meaning | Example |
| :--- | :--- | :--- |
| `OBJ-` | Business objective | `OBJ-03` |
| `KPI-` | Measurable success metric | `KPI-07` |
| `BR-` | Business rule | `BR-MEM-04` |
| `FR-` | Functional requirement | `FR-CHK-12` |
| `NFR-` | Non-functional requirement | `NFR-PERF-02` |
| `US-` | User story | `US-CUST-09` |
| `AC-` | Acceptance criterion | `AC-CHK-12.3` |
| `SCR-` | Screen | `SCR-WEB-014` |
| `API-` | API endpoint group | `API-MEMB` |
| `RSK-` | Risk register entry | `RSK-08` |
| `OQ-` | Open question needing client decision | `OQ-11` |

### Priority scale (MoSCoW)

| Code | Meaning | Contract implication |
| :-: | :--- | :--- |
| **M** | Must have | Phase 1 scope. Absence blocks launch. |
| **S** | Should have | Phase 1 scope if capacity allows; first candidate to move to Phase 2. |
| **C** | Could have | Phase 2. Documented now to prevent architectural dead ends. |
| **W** | Won't have (this time) | Explicitly out of scope. Listed to prevent scope creep. |

## Baseline Decisions Applied in This Version

The v1.0 document ended with 40 open discovery questions. The following decisions have been taken
as the working baseline for v2.0. Each remains changeable through the change request process
(Part C §C10) until sign-off; after sign-off, changes are priced.

| Decision | Baseline taken | Effect if changed |
| :--- | :--- | :--- |
| **Geographic model** | Currency-agnostic and country-agnostic. Every monetary amount is stored as a minor-unit integer with an ISO-4217 currency code. Tax is computed by a pluggable tax profile per country. KYC is a configurable document checklist per country. | **Low** — the design absorbs a country choice as configuration, not code. |
| **Payment gateway** | Abstracted behind a `PaymentProvider` interface. Stripe Connect is the reference implementation for split settlement; a second adapter can be added without touching domain code. | **Low** for a second adapter, **medium** if a gateway without split-payment support is mandated. |
| **Technology stack** | Node.js + NestJS (TypeScript) API, PostgreSQL 16, Redis, React 18 / Next.js 14 for the customer website, React + Vite for both dashboards, S3-compatible object storage. | **High** — Part C would be rewritten. |
| **Phase 1 surfaces** | Three web surfaces: **customer marketplace website**, **gym owner dashboard**, **super-admin console**. All mobile-responsive. No native mobile app in Phase 1. | **Medium** — a native app adds a delivery track, not a redesign; the API is built app-ready. |
| **Check-in method** | Rotating QR presented by the member, scanned by a gym-side web scanner running on any camera-equipped device. NFC and biometric are Phase 2. | **Medium.** |
| **Monetisation** | Both SaaS subscription (charged to the gym) and marketplace commission (deducted from marketplace-originated sales). Either can be set to zero per tenant. | **Low.** |
| **Tenancy isolation** | Shared database, shared schema, PostgreSQL row-level security keyed on `tenant_id`, with a documented migration path to schema-per-tenant for large accounts. | **High** if schema-per-tenant is mandated from day one. |

> **[EDITORIAL] Stack ruling — the PRD baseline stands, unchanged.** Every baseline decision in the
> table above, and every selection in Part C §C1.1, is adopted **exactly as written**. The API is
> **Node.js 20 + NestJS 10 (TypeScript)**. No substitution is made to any technology the PRD names.
>
> Where the PRD leaves a slot **unspecified**, a choice must still be made to build. Such choices
> are *additive* — they fill a gap rather than replace a decision — and each is recorded in
> `/docs/DECISION_LOG.md` and listed in `/docs/engineering/STACK_ADDITIONS.md` with the PRD clause
> that leaves the slot open. Additions require the project owner's approval before use.
> **No addition may contradict a named PRD selection.**

---

# PART A — BUSINESS REQUIREMENTS DOCUMENT

## A1. Executive Summary

The fitness industry outside the large branded chains runs on paper registers, WhatsApp groups and
cash. An independent gym owner typically knows how many members they have but not how many are
about to lapse, how many walked in yesterday, or which membership plan actually earns money. On the
other side of the counter, a person looking for a gym has no reliable way to find one: they rely on
a map pin, a phone call, and a visit before they can learn the price.

This platform closes both gaps with a single product. It is simultaneously:

1. **A management system** that a gym runs its business on — members, plans, payments, attendance,
   staff, renewals and reporting.
2. **A marketplace** where consumers discover, compare and buy memberships at those same gyms online.

The two halves reinforce each other. The management system produces trustworthy, current
operational data — real prices, real timings, real capacity, real member reviews — which is exactly
what makes a marketplace credible. The marketplace produces paying customers, which is what makes a
gym owner tolerate the discipline of a management system. Neither half is as defensible alone.

**Commercially**, the platform earns from two directions: a recurring subscription for the software,
and a commission on memberships sold through the marketplace. A gym that only wants software pays
only subscription. A gym that only wants customers pays only commission. Most will pay both.

**In Phase 1** the platform ships three web surfaces — a public marketplace website, a gym owner
dashboard, and an internal super-admin console — covering gym onboarding and verification, plan
management, online membership purchase, payment and settlement, QR-based check-in, member and staff
management, reviews, and reporting. Native mobile applications, trainer marketplaces, nutrition and
corporate wellness are deliberately deferred.

**The commercial risk to manage** is not technical. It is trust: a marketplace that lists unverified
gyms, tolerates fake reviews, or mishandles a refund loses consumers permanently and cheaply.
Accordingly, verification, review integrity and money handling are specified at a level of detail
disproportionate to their share of the codebase, and are treated as launch-blocking.

## A2. Business Context and Problem Statement

### A2.1 The gym owner's problem

The independent gym operator is a small business owner running on thin margins with almost no
operational visibility.

| Pain | What it looks like in practice | Business cost |
| :--- | :--- | :--- |
| **Manual records** | Member details in a register or an ad-hoc spreadsheet. No single source of truth. | Hours per week of admin; data lost when staff leave. |
| **Invisible churn** | Nobody knows a membership expired until the member stops appearing. | The single largest revenue leak. A lapsed member is far cheaper to win back in week one than in month three. |
| **Cash-heavy collection** | Renewal collected in cash at the counter, receipt written by hand. | Reconciliation impossible; leakage and disputes; no reliable revenue reporting. |
| **No demand generation** | Acquisition is a banner outside the door and word of mouth. | Growth is capped by footfall past the building. |
| **No operational insight** | Peak hours, equipment demand, trainer utilisation and plan profitability are all guesses. | Staffing and capital spend are misallocated. |
| **Staff accountability** | No record of who checked in whom, who collected which payment. | Shrinkage and disputes. |

### A2.2 The consumer's problem

| Pain | What it looks like in practice | Business cost |
| :--- | :--- | :--- |
| **Discovery is broken** | Search results show a name, a pin and a phone number. Not price, not timings, not equipment, not crowd levels. | High friction; many people simply do not join. |
| **Prices are opaque** | Price is disclosed only in person, and is often negotiated. | Distrust, and an inability to budget or compare. |
| **No basis for comparison** | No standard way to compare two gyms on facilities, hours, plans or member sentiment. | Choice by proximity alone, leading to poor fit and early churn. |
| **Reviews are untrustworthy** | Public review platforms accept reviews from anyone, including people who never attended. | Ratings carry little signal. |
| **Joining is offline** | Must visit, fill a paper form, pay cash, receive a paper card. | Drop-off between intent and purchase. |
| **No portable record** | No digital proof of membership, no invoice history, no attendance record. | Disputes; no evidence at renewal. |

### A2.3 Why now

Three conditions make this viable that were not true a decade ago: near-universal smartphone
penetration among the target demographic; consumer familiarity with marketplace purchase patterns
learned from food delivery and travel; and payment infrastructure that supports split settlement, so
a platform can legitimately collect on a merchant's behalf and remit net of commission without
becoming a bank.

### A2.4 Competitive landscape

| Category | Example shape | Their strength | The gap this platform exploits |
| :--- | :--- | :--- | :--- |
| **Pure gym management software** | Desktop or web CRM sold per-seat to the gym | Deep operational features | No demand generation. The gym still has to find its own members. |
| **Pure aggregators / pass networks** | Consumer app selling a multi-gym pass | Consumer demand, brand | Gyms are inventory, not customers. Gyms resent commission with no operational value returned, and churn off the network. |
| **Large branded chains** | Vertically integrated own-brand app | Consistent experience | Only serves their own estate. Irrelevant to the 90%+ of the market that is independent. |
| **Status quo** | Register, WhatsApp, cash | Zero cost, zero learning curve | Everything above. |

The strategic position is the combination: **be the gym's operating system so that being in the
marketplace is a by-product, not a tax.**

## A3. Vision, Objectives and Success Metrics

### A3.1 Vision statement

> To become the operating layer of the independent fitness industry — the system every gym runs on,
> and therefore the most complete and trustworthy place for anyone to find and join one.

### A3.2 Business objectives

| ID | Objective | Rationale | Priority |
| :--- | :--- | :--- | :-: |
| **OBJ-01** | Digitise the end-to-end operations of an independent gym — members, plans, payments, attendance, staff and reporting — in one system. | The wedge. Without operational value the gym has no reason to adopt, and without adoption there is no marketplace inventory. | M |
| **OBJ-02** | Enable a consumer to discover, compare and purchase a gym membership entirely online, without a phone call or a visit. | The consumer-side value proposition and the source of marketplace commission. | M |
| **OBJ-03** | Guarantee that every listed gym is a real, verified business, and every published review comes from a member who actually attended. | Trust is the marketplace's only durable moat. It is cheap to lose and expensive to rebuild. | M |
| **OBJ-04** | Make membership revenue collection automatic, traceable and reconcilable — every rupee/dollar attributable to a member, a plan, an invoice and a settlement. | Removes the largest source of gym-owner pain and platform dispute load simultaneously. | M |
| **OBJ-05** | Reduce member churn by making expiry visible and renewal frictionless for both the gym and the member. | Retention economics dominate acquisition economics in fitness. | M |
| **OBJ-06** | Give the gym owner decision-grade analytics: revenue by plan, attendance by hour, churn cohort, staff activity. | Converts the product from a record-keeper into a management tool, which is what justifies subscription price. | S |
| **OBJ-07** | Operate a defensible multi-tenant architecture in which no tenant can ever read or write another tenant's data. | Legal and reputational necessity; also a sales objection to pre-empt. | M |
| **OBJ-08** | Establish two independent revenue streams — SaaS subscription and marketplace commission — each independently tunable per tenant. | Commercial flexibility during land-grab; allows commission-free or subscription-free promotional cohorts. | M |
| **OBJ-09** | Build the platform country-agnostic from day one: currency, tax and KYC as configuration rather than code. | Avoids a rewrite at first international expansion. | S |
| **OBJ-10** | Achieve an operations model where a support agent can resolve the ten most common member and gym issues without engineering involvement. | Support cost per tenant determines whether the unit economics work at scale. | S |

### A3.3 Success metrics

Baselines are established in the first 30 days after launch; the targets below are the 12-month
post-launch commitments used for release planning.

#### Supply side (gyms)

| ID | Metric | Definition | Year-1 target |
| :--- | :--- | :--- | :--- |
| **KPI-01** | Verified active gyms | Gyms with approved KYC, ≥1 published plan and ≥1 check-in in trailing 30 days | 500 |
| **KPI-02** | Gym activation rate | % of gyms that reach first published plan within 7 days of signup | ≥ 70% |
| **KPI-03** | Time to first listing | Median hours from signup to marketplace-visible listing | ≤ 48 h |
| **KPI-04** | Gym monthly retention | % of paying tenants retained month over month | ≥ 95% |
| **KPI-05** | Weekly active gym dashboard usage | % of active tenants with ≥3 dashboard sessions per week | ≥ 60% |
| **KPI-06** | Digital check-in adoption | % of member visits recorded through the platform rather than manually | ≥ 80% |

#### Demand side (consumers)

| ID | Metric | Definition | Year-1 target |
| :--- | :--- | :--- | :--- |
| **KPI-07** | Registered users | Accounts created | 100,000 |
| **KPI-08** | Active memberships | Memberships in `ACTIVE` state at period end | 25,000 |
| **KPI-09** | Search-to-detail rate | % of searches producing ≥1 gym detail page view | ≥ 45% |
| **KPI-10** | Detail-to-checkout rate | % of gym detail views starting checkout | ≥ 8% |
| **KPI-11** | Checkout completion rate | % of started checkouts reaching successful payment | ≥ 65% |
| **KPI-12** | Renewal rate | % of memberships renewed within 15 days of expiry | ≥ 55% |
| **KPI-13** | Review submission rate | % of members leaving a review within 45 days of joining | ≥ 20% |

#### Commercial

| ID | Metric | Definition | Year-1 target |
| :--- | :--- | :--- | :--- |
| **KPI-14** | GMV | Gross value of memberships transacted through the platform | — (tracked) |
| **KPI-15** | Net platform revenue | Subscription + commission + listing fees | — (tracked) |
| **KPI-16** | Take rate | Platform revenue ÷ GMV | 8–12% |
| **KPI-17** | Marketplace-originated share | % of gym GMV originating from marketplace discovery rather than gym-entered sales | ≥ 30% |
| **KPI-18** | ARPT | Average revenue per tenant per month | — (tracked) |
| **KPI-19** | Payment success rate | Successful ÷ attempted payments | ≥ 92% |
| **KPI-20** | Refund rate | Refunded value ÷ GMV | ≤ 3% |
| **KPI-21** | Dispute/chargeback rate | Disputed transactions ÷ total transactions | ≤ 0.5% |

#### Platform health

| ID | Metric | Definition | Year-1 target |
| :--- | :--- | :--- | :--- |
| **KPI-22** | API availability | Monthly uptime of core API | ≥ 99.9% |
| **KPI-23** | Search latency | p95 marketplace search response | ≤ 500 ms |
| **KPI-24** | Check-in latency | p95 QR scan to confirmation | ≤ 2 s |
| **KPI-25** | Support first response | Median time to first human response | ≤ 4 h |
| **KPI-26** | Settlement accuracy | Settlements matching computed ledger without manual adjustment | 100% |

### A3.4 Guiding product principles

1. **The gym's data belongs to the gym.** Export is a right, not a retention lever. A tenant can
   extract members, payments and attendance at any time in a machine-readable format.
2. **Never show a price that cannot be bought.** Every price displayed on the marketplace is a price
   the platform will honour at checkout for that moment. Stale pricing is a defect, not a UX
   inconvenience.
3. **Money is append-only.** Financial state is derived from an immutable ledger of events. Nothing
   that has affected a balance is ever edited or deleted; corrections are compensating entries.
4. **Verification before visibility.** No gym appears in the marketplace before a human has approved
   it. Growth targets never justify relaxing this.
5. **Earned reviews only.** A review requires a verified check-in history against that gym. There is
   no path for an unverified account to influence a rating.
6. **Degrade, do not fail.** If maps, search indexing or notifications are unavailable, check-in and
   payment continue to work.
7. **Every state change is attributable.** Any record whose change could become a dispute carries
   who, when, from what, to what, and why.

## A4. Scope

### A4.1 In scope — Phase 1

| Area | Included |
| :--- | :--- |
| **Customer marketplace website** | Location-aware search, filters, map and list results, gym detail pages, plan comparison, favourites, gym comparison, reviews, account, checkout, membership wallet, QR, invoices, renewals, referrals, support |
| **Gym owner dashboard** | Onboarding and KYC, gym and branch profile, plan catalogue, member CRM, walk-in and offline sale entry, attendance and check-in desk, staff and roles, payments and settlements, coupons, reviews management, leads, reports, notifications, settings |
| **Super-admin console** | Gym approval queue, KYC review, tenant lifecycle, commission and subscription plan configuration, payout approval, refund and dispute handling, review moderation, user administration, content and taxonomy management, feature flags, platform analytics, audit log, support console |
| **Cross-cutting** | Multi-tenancy with row-level isolation, RBAC, payments and split settlement, invoicing and tax, QR check-in, notifications (email + SMS/push channel abstraction), search, media handling, audit logging, reporting and export |

### A4.2 Out of scope — Phase 1 (`W`)

Each is architecturally anticipated but not built.

| Item | Why deferred | Anticipated in the design by |
| :--- | :--- | :--- |
| Native iOS/Android apps | Responsive web validates demand at a fraction of the cost | API is client-agnostic; token auth and device registration already modelled |
| AI coaching / workout generation | No proprietary data yet to make it good | — |
| Video-on-demand workouts | Different product, different cost base | — |
| Nutrition and diet tracking | Adjacent market | — |
| Wearable / health-platform sync | Low commercial return pre-scale | `attendance` schema accommodates external sources |
| Insurance and financing integrations | Regulatory overhead | — |
| Trainer marketplace (cross-gym PT booking) | Requires two-sided liquidity of its own | `staff` and `session` entities modelled |
| Corporate wellness portal | Enterprise sales motion not yet built | `corporate_account` entity reserved |
| Multi-language UI | Single launch locale | All user-facing strings externalised from day one |
| Franchise/multi-brand hierarchy | Rare in the initial segment | `gym` supports parent-child branch nesting |
| Offline-first check-in | Requires conflict resolution design | Check-in API is idempotent, enabling later replay |

### A4.3 Explicit non-goals

- The platform is **not** a payment aggregator or a financial institution. It never holds customer
  funds in its own name outside the gateway's regulated flow.
- The platform is **not** a guarantor of gym service quality. It verifies existence and identity,
  not standards.
- The platform does **not** set gym pricing. It enforces price *transparency and honouring*, not
  price levels.

## A5. Stakeholders

### A5.1 External stakeholders

| Stakeholder | Definition | Primary need | Success looks like |
| :--- | :--- | :--- | :--- |
| **Visitor** | Unauthenticated browser | Find and evaluate gyms without committing | Reaches a gym detail page with real prices in under a minute |
| **Registered User** | Has an account, no active membership | Save, compare, and eventually buy | Converts to a member |
| **Active Member** | Holds an `ACTIVE` membership | Get in the door, track visits, renew | Checks in without friction; renews without being chased |
| **Expired Member** | Membership lapsed | Return easily | Renews or is won back |
| **Gym Owner** | Tenant administrator | Run the business, grow membership | Replaces the register; sees revenue rise |
| **Gym Manager** | Delegated operator of a branch | Day-to-day operations | Runs a branch without owner involvement |
| **Trainer** | Staff delivering training | See assigned members, log sessions | Knows who is coming and what they need |
| **Receptionist** | Front-desk staff | Check people in, sell, take payment | Handles the desk in the app alone |
| **Corporate Customer** | Employer buying in bulk | Employee wellness benefit | *(Phase 2)* |

### A5.2 Internal stakeholders

| Stakeholder | Responsibility | Tooling need |
| :--- | :--- | :--- |
| **Super Admin** | Platform-wide authority: approvals, configuration, escalations | Full super-admin console |
| **Verification / Onboarding Officer** | Reviews KYC and gym applications | Approval queue with document viewer and structured reject reasons |
| **Customer Support Agent** | Resolves member and gym issues | Read-mostly console, impersonation with audit, ticketing |
| **Finance** | Reconciliation, settlements, payouts, tax reporting | Ledger views, settlement runs, exports |
| **Sales** | Acquires and onboards gyms | Lead pipeline, tenant creation, plan assignment |
| **Operations** | Content quality, review moderation, taxonomy | Moderation queue, amenity/category management |
| **Engineering / DevOps** | Builds and runs the platform | Observability, feature flags, audit |

### A5.3 RACI for key processes

**R** Responsible · **A** Accountable · **C** Consulted · **I** Informed

| Process | Gym Owner | Verification Officer | Super Admin | Finance | Support | Member |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: |
| Gym registration submission | R/A | I | I | — | — | — |
| KYC document review | C | R | A | I | — | — |
| Marketplace listing approval | I | R | A | — | — | — |
| Plan creation and pricing | R/A | — | I | I | — | — |
| Online membership sale | I | — | — | I | — | R/A |
| Offline / walk-in sale | R/A | — | — | I | — | C |
| Payment capture | I | — | — | A | — | R |
| Invoice issuance | I | — | — | R/A | — | I |
| Refund request | C | — | A | R | R | R |
| Chargeback response | C | — | A | R | C | I |
| Settlement / payout run | I | — | A | R | — | — |
| Review publication | I | — | A | — | C | R |
| Review moderation / takedown | C | — | A | — | R | I |
| Member check-in | I | — | — | — | — | R |
| Tenant suspension | I | C | R/A | C | I | I |
| Data export request | R | — | A | — | C | R |

---

## A6. Business Model

### A6.1 Revenue streams

| # | Stream | Payer | Basis | Phase |
| :-: | :--- | :--- | :--- | :--- |
| 1 | SaaS subscription | Gym | Monthly or annual, tiered by branches, members and feature set | 1 |
| 2 | Marketplace commission | Gym | % of each marketplace-originated membership sale, deducted at settlement | 1 |
| 3 | Featured listing / promotion | Gym | Fixed fee for elevated placement in search and category pages | 1 (S) |
| 4 | Premium consumer plan | Member | Multi-gym access, priority booking | 2 |
| 5 | Corporate memberships | Employer | Negotiated bulk contract | 2 |
| 6 | Trainer marketplace commission | Trainer / gym | % of PT session value | 2 |
| 7 | Advertising | Third parties | Sponsored placements | 2 |
| 8 | Affiliate revenue | Third parties | Referral of supplements, apparel, insurance | 2 |
| 9 | Premium analytics add-on | Gym | Benchmarking against anonymised cohort | 2 |
| 10 | Public API access | Partners | Metered | 2 |

### A6.2 Subscription tiers (reference model — values are configurable)

| Tier | Branches | Active members | Staff seats | Notable inclusions | Commission on marketplace sales |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Starter** | 1 | up to 150 | 3 | Plans, members, check-in, basic reports, marketplace listing | Standard |
| **Growth** | up to 3 | up to 750 | 10 | + Coupons, CRM/leads, advanced reports, custom branding on invoices | Standard − 2pp |
| **Professional** | up to 10 | up to 3,000 | 40 | + Multi-branch analytics, API access, priority support, featured listing credits | Standard − 4pp |
| **Enterprise** | unlimited | unlimited | unlimited | + SSO, custom SLA, dedicated success manager, data residency options | Negotiated |

Subscription is charged to the tenant independently of the settlement flow — a failed subscription
charge degrades the tenant (see **BR-TEN-06**) but never blocks member check-ins already paid for.

### A6.3 Commission mechanics

> This is the most commercially sensitive mechanism in the platform and is specified precisely.

**Attribution.** Commission applies only to a sale whose `origin` is `MARKETPLACE`. A sale is
`MARKETPLACE` when the purchasing user reached checkout through platform-owned discovery surfaces
(search, category, gym detail arrived at from search, comparison, favourites, platform campaign
link). A sale is `DIRECT` when created by gym staff in the dashboard, or when a user arrives via the
gym's own referral link with the gym's tracking parameter. `DIRECT` sales incur no commission but do
incur payment processing cost, which is passed through.

**Attribution window.** A user who discovers a gym through the marketplace is attributed to
`MARKETPLACE` for **30 days** from the qualifying discovery event, recorded server-side at first
authenticated view. This prevents leakage where a gym asks a marketplace-sourced lead to "come and
pay at the counter instead". Disputes over attribution are resolved by the recorded event log, which
is visible to both parties.

**Renewals.** The first renewal of a `MARKETPLACE`-originated membership carries commission at the
standard rate. Second and subsequent renewals carry a **reduced renewal rate**, on the principle
that the platform earned the acquisition once and the ongoing relationship is the gym's. Renewal
rates are configured per tenant.

**Computation.** For a sale of gross amount `G`:

```
discount        D  = coupon/promotional reduction
net_sale        N  = G − D
tax             T  = tax_profile(N)                 # inclusive or exclusive per country profile
commission_base B  = N (excluding tax)              # commission is never charged on tax
commission      C  = round_half_even(B × commission_rate)
gateway_fee     F  = gateway-reported fee for the transaction
payable_to_gym  P  = (N + T) − C − F
```

Every one of `G`, `D`, `N`, `T`, `B`, `C`, `F`, `P` is **persisted per transaction**. No figure that
appears on a settlement statement is ever recomputed at display time.

**Worked example** (currency-neutral, minor units shown as major for readability; commission rate
10%, tax 18% exclusive, gateway fee 2%):

| Line | Value |
| :--- | ---: |
| Plan price (gross) | 5,000.00 |
| Coupon `NEW20` | −1,000.00 |
| Net sale | 4,000.00 |
| Tax @18% | 720.00 |
| Customer pays | 4,720.00 |
| Commission base | 4,000.00 |
| Platform commission @10% | 400.00 |
| Gateway fee @2% of 4,720.00 | 94.40 |
| **Payable to gym** | **4,225.60** |
| **Platform revenue** | **400.00** |

Note that the coupon in this example is platform-funded or gym-funded per the coupon's
`funding_source`; when gym-funded (as shown) the commission base is post-discount. When
platform-funded, commission base is the pre-discount net and the platform absorbs the discount —
this distinction is a field on the coupon, not a policy argument at settlement time.

### A6.4 Settlement and payouts

| Aspect | Rule |
| :--- | :--- |
| **Settlement cycle** | Configurable per tenant. Default **T+7** from payment capture. |
| **Hold period** | Funds for a new tenant are held for the first **14 days** of trading as fraud protection, then released on the normal cycle. |
| **Minimum payout** | Configurable floor; balances below the floor roll forward. |
| **Statement** | Every payout is accompanied by an itemised statement listing each contributing transaction with all eight computed figures. |
| **Reserve** | A configurable rolling reserve (default 5%, released after 30 days) covers refunds and chargebacks against already-settled sales. |
| **Negative balance** | If refunds exceed the current cycle's sales, the balance goes negative and is recovered from the next cycle. Persistent negative balance triggers tenant review. |
| **Reconciliation** | A daily automated reconciliation compares gateway-reported settlements against the internal ledger. Any variance raises an operational alert; **KPI-26** requires zero unexplained variance. |

### A6.5 Unit economics reference

For planning purposes, the target contribution per tenant per month:

| Line | Reference |
| :--- | :--- |
| Subscription revenue | Tier price |
| Commission revenue | Marketplace GMV × blended take rate |
| Less: payment processing | Passed through to gym; platform net zero |
| Less: SMS/notification cost | Variable per active member |
| Less: infrastructure | Amortised per tenant |
| Less: support | Cost per ticket × tickets per tenant (target ≤ 0.8/month by month 6) |

**KPI-10** (support self-service) exists because support cost per tenant is the variable most likely
to break these economics.

> **[EDITORIAL]** The source text reads *"KPI-10 (support self-service)"*. In the metric tables,
> `KPI-10` is *Detail-to-checkout rate*; the support self-service intent corresponds to **`OBJ-10`**
> and is measured operationally by **`KPI-25`** (support first response). Recorded verbatim above;
> flagged here rather than silently corrected.

## A7. Business Processes

Each process below is **normative**: the product must implement it as described, and each has a
corresponding functional module in Part B.

### A7.1 Gym onboarding and verification

```
Owner signs up
        ↓
Email + phone verification
        ↓
Business profile (legal name, entity type, address, contact)
        ↓
KYC document upload (per country checklist)
        ↓
Gym profile (name, description, photos, amenities, timings, geo-location)
        ↓
Bank / payout account + micro-deposit or gateway verification
        ↓
Submit for review  ──────────►  [ Verification Officer queue ]
                                          ↓
                        ┌─────────────────┴──────────────────┐
                    APPROVED                              REJECTED
                        ↓                                     ↓
                Tenant activated                Structured reasons returned
                Plans can be published          Owner corrects and resubmits
                        ↓
                Marketplace listing goes live
```

**Governing rules:** BR-GYM-01 … BR-GYM-09.

### A7.2 Marketplace discovery to membership

```
Consumer lands (location detected or entered)
        ↓
Search / browse  →  filter (distance, price, amenities, rating, timings, gender policy)
        ↓
Results (list + map)  →  compare up to 4 gyms  →  save favourites
        ↓
Gym detail page (photos, amenities, timings, plans, verified reviews, location)
        ↓
Select plan  →  [ auth gate: login / register ]
        ↓
Checkout (start date, add-ons, coupon)  →  price re-validated server-side
        ↓
Payment  →  gateway  →  webhook confirmation
        ↓
Membership ACTIVE  →  invoice issued  →  QR credential provisioned
        ↓
First check-in  →  attendance recorded
        ↓
Review eligibility unlocked  →  review submitted  →  rating updated
        ↓
Expiry approaching  →  renewal reminders  →  renewal
```

**Governing rules:** BR-MEM-01 … BR-MEM-14, BR-PAY-01 … BR-PAY-11, BR-REV-01 … BR-REV-07.

### A7.3 Payment and settlement

```
Customer confirms checkout
        ↓
Server creates ORDER (PENDING) with server-computed amounts   ← never trust client amounts
        ↓
Payment intent created at gateway
        ↓
Customer authorises
        ↓
        ┌────────────── webhook ──────────────┐
        ↓                                     ↓
 PAYMENT_CAPTURED                      PAYMENT_FAILED
        ↓                                     ↓
 Order → PAID                          Order → FAILED
        ↓                              Retry offered (new intent)
 Membership activated (idempotent)
        ↓
 Invoice generated (immutable, sequential number)
        ↓
 Ledger entries written: gross, tax, commission, gateway fee, gym payable
        ↓
 Settlement batch (T+N)  →  payout instruction  →  statement issued
```

**Governing rules:** BR-PAY-01 … BR-PAY-11, BR-FIN-01 … BR-FIN-08.

### A7.4 Check-in

```
Member opens membership  →  rotating QR token displayed (TTL 60 s)
        ↓
Gym scanner (web, camera) reads token
        ↓
Server validates: signature, TTL, membership ACTIVE, gym/branch match,
                  not already checked in within cooldown, within operating hours,
                  entitlement not exhausted (session-limited plans)
        ↓
 ┌──────────── ALLOW ────────────┐   ┌──────── DENY ────────┐
 ↓                               ↓   ↓                      ↓
Attendance recorded    Greeting shown  Reason shown   Override available
Entitlement decremented                (expired/frozen/  to staff, logged
Notification (optional)                 wrong branch/     with reason
                                        duplicate)
```

**Governing rules:** BR-CHK-01 … BR-CHK-10.

### A7.5 Refund and dispute

```
Refund requested (member via support, or gym via dashboard)
        ↓
Eligibility evaluated against refund policy (window, usage, plan type)
        ↓
 ┌────────── auto-approve if within policy ──────────┐
 ↓                                                   ↓
Super Admin review (outside policy / above threshold)   Approved
 ↓                                                      ↓
Approved / Rejected ──────────────────────────────────► Gateway refund initiated
                                                        ↓
                                          Membership adjusted (cancel / prorate)
                                                        ↓
                                          Credit note issued (immutable)
                                                        ↓
                                          Ledger reversal entries written
                                                        ↓
                                          Gym balance debited at next settlement
```

**Governing rules:** BR-REF-01 … BR-REF-09.

## A8. Business Rules Catalogue

> These are **contractual**. Each is testable, and each maps to functional requirements in Part B
> and test cases in Part C §C8.

### A8.1 Tenancy and gyms

| ID | Rule | Pri |
| :--- | :--- | :-: |
| **BR-TEN-01** | Every data record other than platform-global reference data belongs to exactly one tenant and is inaccessible to any other tenant by any code path, including reporting and support tooling. | M |
| **BR-TEN-02** | One owner account may own multiple tenants. Tenant switching is explicit and audited; no cross-tenant action occurs in a single request. | M |
| **BR-TEN-03** | One tenant may operate multiple branches. Branches share the plan catalogue by default; a plan may be restricted to named branches. | M |
| **BR-TEN-04** | Deleting a tenant is a soft delete. Financial, invoice and audit records are retained for the statutory retention period regardless of deletion. | M |
| **BR-TEN-05** | A suspended tenant is removed from marketplace search immediately; existing active memberships continue to permit check-in until their natural expiry. | M |
| **BR-TEN-06** | A tenant whose subscription payment fails enters `PAST_DUE` after the first failure, loses marketplace visibility after 7 days, and loses dashboard write access after 14 days. Check-in for existing members is never blocked by subscription arrears. | M |
| **BR-GYM-01** | A gym must not be visible in marketplace search until it has status `APPROVED`. | M |
| **BR-GYM-02** | Approval requires: verified owner email and phone, complete KYC document set for the tenant's country profile, at least one published plan, at least three photographs, a resolvable geo-location, and stated operating hours. | M |
| **BR-GYM-03** | Approval is a human decision. No automated path may set `APPROVED`. | M |
| **BR-GYM-04** | Rejection must cite at least one structured reason code and may include free text. The owner sees both. | M |
| **BR-GYM-05** | A gym may be re-submitted after rejection an unlimited number of times; each submission is a new reviewable version with the prior version retained. | M |
| **BR-GYM-06** | Material changes to an approved gym — legal name, address, geo-location, ownership, bank account — return the gym to `PENDING_REVIEW` for those fields while the listing stays live, unless the change is to the bank account, which suspends payouts until re-verified. | M |
| **BR-GYM-07** | Non-material changes (photos, description, amenities, timings, plan pricing) publish immediately without review, subject to automated content screening. | M |
| **BR-GYM-08** | Geo-location must be within a configurable tolerance of the geocoded postal address; a mismatch beyond tolerance blocks approval and is flagged to the reviewer. | M |
| **BR-GYM-09** | A single physical address may host only one `APPROVED` gym at a time. Collisions are surfaced to the reviewer as a possible duplicate. | S |

### A8.2 Plans and pricing

| ID | Rule | Pri |
| :--- | :--- | :-: |
| **BR-PLN-01** | A plan defines: name, description, duration (or session count), price, currency, applicable branches, joining fee, minimum age, gender eligibility, access windows, and whether it is publicly sellable or staff-only. | M |
| **BR-PLN-02** | A published plan's price change never affects an already-purchased membership. Existing memberships retain their purchased terms until expiry. | M |
| **BR-PLN-03** | The price displayed on the marketplace must equal the price charged at checkout for the same plan at the same moment. Server-side re-validation at checkout is mandatory; a mismatch aborts checkout with an explicit message rather than silently charging either figure. | M |
| **BR-PLN-04** | A plan may be archived but never hard-deleted while any membership references it. | M |
| **BR-PLN-05** | A staff-only plan is never returned by any public API or rendered on any public surface. | M |
| **BR-PLN-06** | Session-based plans carry an entitlement count decremented per check-in; the membership expires on the earlier of entitlement exhaustion or validity end date. | M |
| **BR-PLN-07** | A gym may run at most one active promotional price per plan at a time; overlapping promotions are rejected at creation. | S |

### A8.3 Membership lifecycle

| ID | Rule | Pri |
| :--- | :--- | :-: |
| **BR-MEM-01** | A membership exists in exactly one state: `PENDING`, `ACTIVE`, `FROZEN`, `EXPIRED`, `CANCELLED`, or `REFUNDED`. Permitted transitions are defined in Part C §C4.1. | M |
| **BR-MEM-02** | A membership becomes `ACTIVE` only on confirmed payment capture (BR-PAY-02) or on an explicit staff-recorded offline payment. | M |
| **BR-MEM-03** | A membership's validity is `[start_date, end_date]` inclusive, computed in the **gym's** timezone, not the member's. | M |
| **BR-MEM-04** | A member may hold multiple concurrent memberships at different gyms. Concurrent memberships at the *same* gym are rejected unless the plans are explicitly marked stackable. | M |
| **BR-MEM-05** | Freeze is permitted only if the plan allows it. Freeze extends `end_date` by exactly the frozen duration. Total freeze days per membership term are capped by plan configuration. | S |
| **BR-MEM-06** | A `FROZEN` membership denies check-in. | M |
| **BR-MEM-07** | Freeze may not be applied retroactively to a past date, and may not begin more than 30 days in the future. | S |
| **BR-MEM-08** | Transfer of a membership to another person requires gym approval and is permitted only if the plan allows it; the transfer is recorded with both parties' identities. | C |
| **BR-MEM-09** | Upgrade to a higher plan is charged pro rata on the unused remainder of the current plan; downgrade takes effect at the next renewal and never generates a cash refund. | S |
| **BR-MEM-10** | Auto-renewal is opt-in, disclosed at purchase, and cancellable at any time before the renewal charge without penalty. | S |
| **BR-MEM-11** | Renewal reminders are sent at T−15, T−7, T−3 and T−1 days and on expiry, subject to the member's notification preferences. | M |
| **BR-MEM-12** | An `EXPIRED` membership retains full historical visibility to both member and gym indefinitely. | M |
| **BR-MEM-13** | Membership credentials are personal. Detected sharing (BR-CHK-07) suspends the membership pending review rather than cancelling it. | M |
| **BR-MEM-14** | If a gym is suspended or closes, affected members are notified within 24 hours and any unconsumed prepaid value becomes eligible for refund under BR-REF-07. | M |

### A8.4 Payments

| ID | Rule | Pri |
| :--- | :--- | :-: |
| **BR-PAY-01** | All monetary amounts are stored as integers in the currency's minor unit with an explicit ISO-4217 code. Floating-point representation of money is prohibited anywhere in the system. | M |
| **BR-PAY-02** | Membership activation is driven by the gateway webhook, not by the client's redirect. A client-side success signal never activates a membership. | M |
| **BR-PAY-03** | All payment-affecting operations are idempotent on a client-supplied idempotency key; a repeated request returns the original result without side effects. | M |
| **BR-PAY-04** | Order amounts are computed server-side from server-held plan, coupon and tax data. Client-submitted amounts are ignored. | M |
| **BR-PAY-05** | Every webhook is signature-verified and replay-protected; unverified webhooks are logged and discarded. | M |
| **BR-PAY-06** | A payment in an indeterminate state after the gateway's settlement window is reconciled automatically; if still indeterminate, it is escalated to Finance and never auto-activates a membership. | M |
| **BR-PAY-07** | Duplicate payment for the same order is detected and automatically refunded within one business day, with notification to the payer. | M |
| **BR-PAY-08** | Card and bank credentials are never stored, logged, or transmitted through platform infrastructure. Only gateway tokens are retained. | M |
| **BR-PAY-09** | Partial payment is permitted only for staff-recorded offline sales, which may hold a `BALANCE_DUE`; online marketplace purchases must be paid in full. | S |
| **BR-PAY-10** | An invoice is generated for every successful payment, carries a gapless sequential number per tenant per financial year, and is immutable once issued. Corrections are issued as credit notes. | M |
| **BR-PAY-11** | Tax treatment is determined by the tenant's tax profile at the moment of sale and stored on the invoice; a later change to the profile never alters an issued invoice. | M |

### A8.5 Refunds and disputes

| ID | Rule | Pri |
| :--- | :--- | :-: |
| **BR-REF-01** | Each tenant publishes a refund policy — window, proration method, cancellation fee — which is shown to the customer before payment and stored with the order. | M |
| **BR-REF-02** | The refund policy applicable to a membership is the one stored on its order, not the tenant's current policy. | M |
| **BR-REF-03** | Refunds within the tenant's stated no-questions window and below a configurable value threshold auto-approve; all others require Super Admin approval. | M |
| **BR-REF-04** | A refund is never issued to any instrument other than the original payment instrument. | M |
| **BR-REF-05** | Platform commission is reversed proportionally on refund. Gateway fees are reversed only to the extent the gateway reverses them; any non-reversed fee is borne per the tenant agreement and shown explicitly on the statement. | M |
| **BR-REF-06** | Refunding a membership with recorded check-ins requires a stated reason and, above a configurable usage threshold, Super Admin approval. | M |
| **BR-REF-07** | If a gym closes, is suspended for cause, or materially fails to provide access, affected members are refunded the unconsumed pro-rata value; the amount is recovered from the tenant's balance and reserve. | M |
| **BR-REF-08** | A chargeback immediately places the disputed amount in hold against the tenant's balance and opens a dispute case with an evidence deadline. | M |
| **BR-REF-09** | Refunds are never processed on a membership already refunded; the operation is idempotent on the order. | M |

### A8.6 Check-in and attendance

| ID | Rule | Pri |
| :--- | :--- | :-: |
| **BR-CHK-01** | Only an `ACTIVE` membership permits check-in. | M |
| **BR-CHK-02** | A check-in QR token is signed, single-purpose, and expires within 60 seconds of generation. Screenshots are therefore of no lasting value. | M |
| **BR-CHK-03** | A token is valid only at the gym and branch that the membership grants access to. | M |
| **BR-CHK-04** | A repeat check-in within a configurable cooldown (default 60 minutes) at the same branch is recorded as a duplicate and does not decrement entitlement. | M |
| **BR-CHK-05** | Check-in outside the gym's operating hours is denied unless the plan grants 24-hour access. | M |
| **BR-CHK-06** | Check-in is idempotent on the token; a token replayed within its TTL yields the original attendance record, not a second one. | M |
| **BR-CHK-07** | Concurrent check-ins for the same membership at two branches within a physically implausible interval flag the membership for sharing review. | S |
| **BR-CHK-08** | Staff may manually check in a member; the record is marked `MANUAL` with the staff identity and a reason, and is reportable separately from scanned check-ins. | M |
| **BR-CHK-09** | Attendance records are immutable once written. Corrections are separate reversal records. | M |
| **BR-CHK-10** | A denied check-in is recorded with its denial reason, so that disputes and access problems are analysable. | M |

### A8.7 Reviews and ratings

| ID | Rule | Pri |
| :--- | :--- | :-: |
| **BR-REV-01** | Only a user with at least one recorded check-in at the gym may review it. | M |
| **BR-REV-02** | One review per member per gym per membership term. Editing is permitted for 7 days; the edit history is retained. | M |
| **BR-REV-03** | Every published review carries a "Verified member" marker; there is no unverified review type. | M |
| **BR-REV-04** | Reviews pass automated screening for abuse, contact details and spam before publication; flagged reviews queue for human moderation. | M |
| **BR-REV-05** | A gym may publicly respond once per review. A gym may never edit or delete a member's review; it may only report it. | M |
| **BR-REV-06** | A reported review stays published while under moderation unless it contains content requiring immediate removal (personal data, threats), which is hidden pending review. | M |
| **BR-REV-07** | The displayed rating is the mean of published reviews, shown with the review count; ratings are not displayed at all below a minimum of 3 reviews. | S |

### A8.8 Coupons, referrals and wallet

| ID | Rule | Pri |
| :--- | :--- | :-: |
| **BR-CPN-01** | A coupon declares: code, discount type (percent or fixed), value, cap, validity window, usage limits (total and per user), applicable plans and branches, first-purchase-only flag, and `funding_source` (platform or gym). | M |
| **BR-CPN-02** | Coupons do not stack. One coupon per order. | M |
| **BR-CPN-03** | A coupon is re-validated server-side at payment initiation; an expired or exhausted coupon aborts checkout with a clear message. | M |
| **BR-CPN-04** | Discount never reduces a payable below zero; any excess is discarded, not credited. | M |
| **BR-CPN-05** | `funding_source` determines the commission base per A6.3 and is immutable after first use. | M |
| **BR-RFL-01** | Referral reward is credited only after the referred user's first membership passes the tenant's refund window. | S |
| **BR-WAL-01** | Wallet credit is non-transferable, non-encashable, expires per configuration, and is applied before payment gateway charge. | C |

### A8.9 Financial control and settlement

| ID | Rule | Pri |
| :--- | :--- | :-: |
| **BR-FIN-01** | All balances are derived from the append-only ledger. No balance is ever stored as a directly-mutable figure. | M |
| **BR-FIN-02** | Every settlement line persists gross, discount, net, tax, commission base, commission, gateway fee and payable. None of these is recomputed at display time. | M |
| **BR-FIN-03** | A settlement statement's line items must sum exactly to the payout amount, including opening balance, reserve and refund lines. | M |
| **BR-FIN-04** | Commission is charged on the commission base only, never on tax and never on gateway fees. | M |
| **BR-FIN-05** | The commission rate applied to a transaction is the rate effective at the moment of sale; later rate changes never alter historical settlements. | M |
| **BR-FIN-06** | Gateway fees are recorded as reported by the provider, never estimated. Where a fee is not yet reported, the line is held out of settlement rather than estimated. | M |
| **BR-FIN-07** | A daily reconciliation compares provider settlement reports to the ledger; any variance raises an alert and blocks auto-payout for the affected tenant until resolved. | M |
| **BR-FIN-08** | Payouts above a configurable threshold require dual approval. | S |

### A8.10 Data, privacy and audit

| ID | Rule | Pri |
| :--- | :--- | :-: |
| **BR-DAT-01** | Every create, update and delete on a member, membership, payment, plan, gym, staff or configuration record is written to an append-only audit log capturing actor, timestamp, IP, entity, before-state and after-state. | M |
| **BR-DAT-02** | Support impersonation of a user requires a stated reason, is time-boxed, is visible to the impersonated user in their account activity, and is fully audited. | M |
| **BR-DAT-03** | A user may request export of their personal data and receive it in a machine-readable format within the statutory window. | M |
| **BR-DAT-04** | A user may request deletion; the account and personal identifiers are erased or irreversibly pseudonymised, while financial records are retained in de-identified form for the statutory retention period. | M |
| **BR-DAT-05** | A tenant may export its complete operational dataset — members, memberships, payments, attendance — at any time without contacting support. | M |
| **BR-DAT-06** | Personal data is never included in application logs, error traces, or analytics events. | M |
| **BR-DAT-07** | KYC documents are stored encrypted, are accessible only to Verification and Super Admin roles, and every access is logged. | M |

---

## A9. Assumptions, Constraints and Dependencies

### A9.1 Assumptions

| ID | Assumption | If false |
| :--- | :--- | :--- |
| **ASM-01** | Gym staff have a smartphone or tablet with a camera and network access at the front desk. | Check-in requires dedicated hardware; scope and cost increase. |
| **ASM-02** | Target members have a smartphone with a browser and can receive SMS or email. | Notification and QR strategy require rethinking. |
| **ASM-03** | A payment gateway supporting split settlement is available in each launch market. | Platform must operate a manual payout process; Finance headcount increases. |
| **ASM-04** | Gyms are willing to publish real prices publicly. | The core marketplace value proposition weakens; a "request price" fallback becomes necessary. |
| **ASM-05** | The client provides brand assets, legal copy (terms, privacy, refund policy) and tax rules before UAT. | Launch slips. |
| **ASM-06** | Connectivity at gym premises is adequate for real-time check-in. | Offline check-in moves from Phase 2 to Phase 1. |
| **ASM-07** | Initial launch is single-language. | Translation infrastructure and content operations are needed at launch. |

### A9.2 Constraints

| ID | Constraint |
| :--- | :--- |
| **CON-01** | Phase 1 is web-only, mobile-responsive. No app store distribution. |
| **CON-02** | Third-party rate limits (maps, geocoding, SMS) bound search and notification throughput and must be cached and budgeted. |
| **CON-03** | Payment behaviour, refund timing and dispute windows are dictated by the gateway and card networks, not by this platform. |
| **CON-04** | Financial and invoice records are subject to statutory retention and cannot be deleted on user request. |
| **CON-05** | The platform must operate within the client's stated infrastructure budget; architecture decisions in Part C reflect this. |

### A9.3 External dependencies

| ID | Dependency | Type | Criticality | Failure mode and mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **DEP-01** | Payment gateway with split settlement | Mandatory | Critical | No sales. Mitigation: provider abstraction, second adapter ready, offline sale recording continues. |
| **DEP-02** | Maps and geocoding | Mandatory | High | Map view degrades to list view; cached geocodes serve existing listings. |
| **DEP-03** | SMS / OTP provider | Mandatory | High | Fall back to email OTP; queue and retry. |
| **DEP-04** | Transactional email | Mandatory | High | Queue and retry; in-app notification centre carries the message meanwhile. |
| **DEP-05** | Object storage / CDN | Mandatory | High | Images degrade to placeholders; uploads queue. |
| **DEP-06** | Push notification service | Optional P1 | Low | Email substitution. |
| **DEP-07** | Error tracking and APM | Mandatory (ops) | Medium | Operational blindness; local logging retained. |
| **DEP-08** | KYC/document verification vendor | Optional | Medium | Manual review only; throughput limited. |

## A10. Risk Register

Scored as **Probability (1–5) × Impact (1–5)**.

| ID | Risk | P | I | Score | Mitigation | Owner |
| :--- | :--- | :-: | :-: | :-: | :--- | :--- |
| **RSK-01** | Fake or non-existent gyms listed | 4 | 5 | **20** | Mandatory human KYC review; address-to-geo tolerance check (BR-GYM-08); duplicate address detection; bank account verification; post-launch spot audits; member "report this gym" flow | Operations |
| **RSK-02** | Fake or incentivised reviews | 4 | 4 | **16** | Check-in-gated reviews (BR-REV-01); one review per term; anomaly detection on rating velocity; moderation queue | Operations |
| **RSK-03** | Membership credential sharing | 4 | 3 | **12** | 60-second rotating tokens (BR-CHK-02); implausible-travel detection (BR-CHK-07); photo on staff check-in screen; suspension pending review | Product |
| **RSK-04** | Payment failure or double charge | 3 | 5 | **15** | Idempotency everywhere (BR-PAY-03); webhook-driven activation (BR-PAY-02); automated duplicate detection and refund (BR-PAY-07); daily reconciliation | Engineering |
| **RSK-05** | Refund and chargeback abuse | 3 | 4 | **12** | Policy stored per order (BR-REF-02); usage-aware refund rules (BR-REF-06); rolling reserve; evidence pack auto-assembled for disputes | Finance |
| **RSK-06** | Gym closes with prepaid members | 3 | 5 | **15** | Reserve and hold period; BR-REF-07 pro-rata refund; closure detection through check-in drop-off alerts | Finance |
| **RSK-07** | Gym disintermediates the marketplace ("pay me directly") | 4 | 4 | **16** | 30-day attribution window with server-side event log; commercial terms in the tenant agreement; renewal rate step-down so the gym keeps more over time; marketplace-only coupons | Commercial |
| **RSK-08** | Cross-tenant data leakage | 2 | 5 | **10** | Row-level security in the database, not only in application code; tenant-scoped repository layer; automated multi-tenant isolation test suite in CI; penetration test before launch | Engineering |
| **RSK-09** | Poor gym-side adoption after signup (listed but not used) | 4 | 4 | **16** | Guided onboarding with activation checklist; KPI-02/05 monitored weekly; data import assistance; check-in as the daily habit hook | Product |
| **RSK-10** | Supply–demand imbalance at launch (gyms with no customers, or customers with no gyms) | 4 | 4 | **16** | City-by-city launch; do not open consumer marketing in a city below a minimum verified gym density | Commercial |
| **RSK-11** | Price/stale listing mismatch damaging trust | 3 | 4 | **12** | BR-PLN-03 server-side re-validation; listing freshness score; automatic delisting of gyms with stale data beyond a threshold | Product |
| **RSK-12** | Notification cost escalating beyond unit economics | 3 | 3 | **9** | Channel preference by cost; email-first for non-urgent; batching; per-tenant caps | Finance |
| **RSK-13** | Regulatory change in payments or data protection | 2 | 4 | **8** | Provider abstraction; data residency configurable; legal review before each market entry | Legal |
| **RSK-14** | Key-person dependency in the delivery team | 3 | 3 | **9** | Documentation-first culture; this document as the baseline; pair coverage on payments and tenancy | Delivery |
| **RSK-15** | Scope creep between sign-off and delivery | 4 | 3 | **12** | Change request process (Part C §C10); this document as the contractual baseline | Delivery |

## A11. Future Scope (Phase 2 and beyond)

| Theme | Description | Prerequisite |
| :--- | :--- | :--- |
| **Native mobile applications** | iOS and Android for members; a lightweight staff app for check-in | KPI-08 above 10,000 active memberships |
| **Trainer marketplace** | Cross-gym personal training discovery, booking and payout | Trainer supply and session data from Phase 1 |
| **Corporate wellness** | Employer accounts, bulk employee memberships, utilisation reporting, invoicing | Enterprise sales capability |
| **Nutrition and supplements** | Affiliate or first-party catalogue attached to member profiles | Member engagement baseline |
| **Workout and progress tracking** | Programme assignment, logging, progress charts | Trainer module |
| **AI recommendations** | Gym matching, churn prediction, dynamic renewal offers | ≥12 months of behavioural data |
| **Wearable and health platform sync** | Attendance and activity enrichment | Native apps |
| **Franchise management** | Brand-level hierarchy above tenant, consolidated reporting, brand-standard enforcement | Franchise customer demand |
| **Multi-country and multi-currency retail** | Localised pricing, tax and payout per market | Second market commitment |
| **Class and slot booking** | Capacity-managed group classes with waitlists | Gym demand signal |
| **Access hardware integration** | Turnstiles, door controllers, biometric readers | Enterprise tier demand |
| **Public API and partner ecosystem** | Metered API for accounting, CRM and equipment vendors | Stable core contract |

## A12. Acceptance Criteria for the Business

Phase 1 is accepted when all of the following are demonstrably true in the production environment.

| ID | Acceptance criterion |
| :--- | :--- |
| **BAC-01** | A gym owner can complete signup, KYC submission, gym setup and plan creation unaided, and reach "submitted for review" in a single session. |
| **BAC-02** | A verification officer can review, approve or reject a gym with structured reasons, and the outcome is reflected in marketplace visibility within 60 seconds. |
| **BAC-03** | A consumer can find a gym by location, filter results, compare gyms, view real plans and prices, and purchase a membership online end to end. |
| **BAC-04** | Payment capture activates the membership, issues a compliant invoice, and provisions a QR credential without manual intervention. |
| **BAC-05** | A member can check in by QR, and the visit appears in both the member's history and the gym's attendance report immediately. |
| **BAC-06** | Every rule in A8 has at least one passing automated test, and every M-priority rule has a test that also proves the negative case. |
| **BAC-07** | A settlement run produces, for a period with mixed online sales, offline sales, coupons and one refund, a statement that Finance reconciles to zero variance against the gateway report. |
| **BAC-08** | A refund flows from request through approval to gateway execution, credit note and ledger reversal, with the gym's next payout correctly reduced. |
| **BAC-09** | Only a member with a recorded check-in can publish a review, verified by attempting the negative case. |
| **BAC-10** | An automated isolation test suite proves that a user of tenant A cannot read or write any record of tenant B through any exposed endpoint. |
| **BAC-11** | The platform meets NFR-PERF-01 through NFR-PERF-05 under the specified load profile. |
| **BAC-12** | A tenant can export members, memberships, payments and attendance without support involvement. |
| **BAC-13** | Audit logs exist for every rule in A8.10 and are queryable by entity and by actor. |
| **BAC-14** | All M-priority functional requirements in Part B are delivered, and no M-priority defect (Severity 1 or 2) is open. |
| **BAC-15** | UAT sign-off is recorded from the client sponsor against the scripts in Part C §C8.4. |

---

# PART B — PRODUCT REQUIREMENTS DOCUMENT

## B1. Product Overview

### B1.1 What is being built

**Three web surfaces on one multi-tenant API.**

| Surface | Codename | Audience | Auth | Delivery |
| :--- | :--- | :--- | :--- | :--- |
| Customer marketplace website | `web` | Visitors, registered users, members | Optional (public browsing), required for purchase | Next.js 14, server-rendered for SEO |
| Gym owner dashboard | `dash` | Owners, managers, receptionists, trainers | Required | React SPA |
| Super-admin console | `admin` | Platform staff | Required + MFA | React SPA |

All three consume the same versioned REST API. **No surface has a private back door**; anything the
admin console can do is expressible as an authorised, audited API call.

### B1.2 Product pillars mapped to modules

| Pillar | Modules |
| :--- | :--- |
| **Discover** — a consumer can find the right gym | Search & Discovery, Gym Detail, Comparison, Favourites, Reviews |
| **Transact** — money moves correctly | Checkout, Payments, Invoicing, Coupons, Refunds, Settlements |
| **Belong** — membership is a live, useful thing | Membership Lifecycle, QR Check-in, Attendance, Renewals, Referrals, Wallet |
| **Operate** — a gym runs its business | Gym & Branch Management, Plans, Member CRM, Staff & Roles, Leads, Reports |
| **Govern** — the platform stays trustworthy | Verification, Moderation, Tenant Administration, Commission Config, Audit, Support |

### B1.3 Module inventory

| # | Module | Code | Surfaces | Priority |
| :-: | :--- | :--- | :--- | :-: |
| 1 | Authentication & Identity | `AUTH` | web, dash, admin | M |
| 2 | User Profile & Account | `USER` | web, dash | M |
| 3 | Tenant Onboarding & KYC | `ONB` | dash, admin | M |
| 4 | Gym & Branch Management | `GYM` | dash, admin | M |
| 5 | Membership Plan Catalogue | `PLAN` | dash, web | M |
| 6 | Marketplace Search & Discovery | `SRCH` | web | M |
| 7 | Gym Detail & Comparison | `DETL` | web | M |
| 8 | Favourites & Saved Searches | `FAV` | web | S |
| 9 | Checkout & Orders | `CART` | web, dash | M |
| 10 | Payments & Gateway | `PAY` | web, dash, admin | M |
| 11 | Invoicing & Tax | `INV` | web, dash, admin | M |
| 12 | Membership Lifecycle | `MEMB` | web, dash | M |
| 13 | QR Check-in & Attendance | `CHK` | web, dash | M |
| 14 | Member CRM | `CRM` | dash | M |
| 15 | Staff, Roles & Permissions | `STAF` | dash, admin | M |
| 16 | Reviews & Ratings | `REV` | web, dash, admin | M |
| 17 | Coupons & Promotions | `CPN` | dash, admin | S |
| 18 | Referrals & Wallet | `REFR` | web, dash | S / C |
| 19 | Notifications | `NOTF` | all | M |
| 20 | Reports & Analytics | `RPT` | dash, admin | M |
| 21 | Settlements & Payouts | `SETL` | dash, admin | M |
| 22 | Refunds & Disputes | `RFND` | web, dash, admin | M |
| 23 | Support & Ticketing | `SUP` | web, dash, admin | S |
| 24 | Platform Administration & Audit | `ADMN` | admin | M |

## B2. Personas

### B2.1 Rohan — the independent gym owner

- **Context.** Owns two branches, roughly 400 members between them. Formerly a trainer; runs the
  business himself with three staff. Comfortable with a smartphone, wary of "software".
- **Current tools.** A register at each desk, a WhatsApp group per branch, a spreadsheet he stopped
  updating in March, cash and UPI/bank transfer.
- **What he actually wants.** More members, less time at the desk, and to stop discovering that
  someone's membership lapsed two months ago.
- **What he fears.** That the system is complicated, that his staff won't use it, that he'll be
  locked in, and that a "commission" means someone else owns his customers.
- **What makes him stay.** The renewal list that makes him money in week one. The attendance chart
  that tells him when to staff the floor. The fact that his data leaves with him if he goes.
- **Design implications.** Onboarding must yield visible value in the first session. The dashboard
  home must answer "what do I do today" in one screen. Nothing critical may be more than two taps
  deep. Export must be obvious, not hidden.

### B2.2 Priya — the prospective member

- **Context.** 27, works nearby, wants to start going to a gym. Has budgeted a range but doesn't
  know what things cost.
- **Current behaviour.** Searches maps, gets names and phone numbers, doesn't call, doesn't join.
- **What she wants.** To see what is within 3 km, what it costs, whether it is clean, whether there
  are women at the same hours she'd go, and to join without a sales conversation.
- **What she fears.** A pushy sales pitch, a hidden joining fee, a locked-in annual contract, and
  paying for something she'll stop using.
- **What converts her.** Real photos, a real price, verified reviews from people who actually
  attend, a short plan she can try, and checkout that takes two minutes.
- **Design implications.** Price is never hidden behind a call-to-action. Filters must include
  timings and gender policy, not just distance and price. Reviews must be visibly earned.
  Short-duration plans must be first-class, not an afterthought.

### B2.3 Sameer — the receptionist

- **Context.** Works the front desk 12:00–21:00. Handles check-ins, walk-ins, renewals and cash.
- **What he needs.** To check someone in during a queue in under two seconds; to answer "when does
  my membership end" instantly; to sell a plan and take payment at the desk; to not be blamed for a
  discrepancy.
- **Design implications.** The check-in screen is a single, always-on, keyboard-and-camera-driven
  surface. Member lookup by phone number is one field. Every cash entry is attributed to him, which
  protects him as much as it monitors him.

### B2.4 Anita — the verification officer

- **Context.** Reviews 30–60 gym applications per day.
- **What she needs.** All the evidence for one application on one screen; a structured reason for
  every rejection so she isn't writing prose; a way to see whether this address or this owner has
  applied before.
- **Design implications.** The review screen is a split view: documents left, structured checklist
  right. Approve/reject are keyboard-accessible. Reason codes are a fixed taxonomy, not free text.

### B2.5 Vikram — the finance analyst

- **Context.** Runs settlement, reconciliation, refunds and reporting.
- **What he needs.** A ledger he can trust; a settlement statement that ties out to the gateway to
  the minor unit; a refund queue with enough context to decide; exports that open in a spreadsheet
  without cleanup.
- **Design implications.** Every financial figure is traceable to its source events. Nothing is
  recomputed at display time. Every export includes the identifiers needed to join it to other
  exports.

## B3. Roles and Permission Matrix

### B3.1 Role definitions

| Role | Scope | Description |
| :--- | :--- | :--- |
| `VISITOR` | Public | Unauthenticated |
| `USER` | Self | Registered, no active membership |
| `MEMBER` | Self | Holds ≥1 active membership |
| `GYM_OWNER` | Tenant | Full authority over their tenant |
| `GYM_MANAGER` | Branch(es) | Operational authority over assigned branches |
| `RECEPTIONIST` | Branch | Front-desk operations |
| `TRAINER` | Branch | Assigned members and sessions |
| `SUPER_ADMIN` | Platform | Full platform authority |
| `VERIFICATION_OFFICER` | Platform | Onboarding review only |
| `SUPPORT_AGENT` | Platform | Read-mostly, impersonation with audit |
| `FINANCE` | Platform | Financial operations |
| `MODERATOR` | Platform | Content and review moderation |

Roles are **additive within a scope**; a user may hold `MEMBER` at the platform level and
`GYM_OWNER` for a tenant simultaneously. Permission evaluation is always
`(role, scope, resource, action)` — **never role alone**.

### B3.2 Permission matrix

**Legend:** ● full · ▪ own/assigned records only · ○ read only · — none

| Capability | VISITOR | USER | MEMBER | RECEPT | TRAINER | MANAGER | OWNER | SUPPORT | VERIF | FINANCE | MODER | S.ADMIN |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Browse marketplace | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| View plan prices | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| Save favourites | — | ● | ● | — | — | — | — | — | — | — | — | — |
| Compare gyms | ● | ● | ● | — | — | — | — | — | — | — | — | — |
| Purchase membership | — | ● | ● | — | — | — | — | — | — | — | — | — |
| View own memberships | — | ○ | ● | — | — | — | — | — | — | — | — | — |
| Generate own check-in QR | — | — | ● | — | — | — | — | — | — | — | — | — |
| Submit review | — | — | ▪ | — | — | — | — | — | — | — | — | — |
| Download own invoice | — | ● | ● | — | — | — | — | — | — | — | — | — |
| Request refund | — | ▪ | ▪ | — | — | — | — | ● | — | ● | — | ● |
| Scan / record check-in | — | — | — | ● | ● | ● | ● | — | — | — | — | — |
| Manual check-in override | — | — | — | ● | — | ● | ● | — | — | — | — | ● |
| View branch attendance | — | — | — | ▪ | ▪ | ● | ● | ○ | — | — | — | ○ |
| Create member (walk-in) | — | — | — | ● | — | ● | ● | — | — | — | — | — |
| Edit member record | — | — | — | ▪ | — | ● | ● | ○ | — | — | — | ○ |
| Record offline payment | — | — | — | ● | — | ● | ● | — | — | — | — | — |
| Create / edit plan | — | — | — | — | — | ○ | ● | ○ | — | ○ | — | ○ |
| Publish plan to marketplace | — | — | — | — | — | — | ● | — | — | — | — | ● |
| Edit gym profile | — | — | — | — | — | ▪ | ● | ○ | ○ | — | — | ● |
| Add / remove branch | — | — | — | ○ | ○ | ○ | ● | — | — | — | — | ● |
| Invite / manage staff | — | — | — | — | — | ▪ | ● | — | — | — | — | ● |
| Assign members to trainer | — | — | — | — | ○ | ● | ● | — | — | — | — | — |
| Create workout plan | — | — | — | — | ▪ | ● | ● | — | — | — | — | — |
| Create coupon | — | — | — | — | — | ○ | ● | — | — | — | — | ● |
| Respond to review | — | — | — | — | — | ● | ● | — | — | — | ○ | ● |
| Moderate / unpublish review | — | — | — | — | — | — | — | — | — | — | ● | ● |
| View tenant reports | — | — | — | ▪ | ▪ | ▪ | ● | ○ | — | ○ | — | ○ |
| View settlement statements | — | — | — | — | — | — | ● | ○ | — | ● | — | ● |
| Change payout bank account | — | — | — | — | — | — | ● | — | — | — | — | ● |
| Export tenant data | — | — | — | — | — | — | ● | — | — | ● | — | ● |
| Review KYC documents | — | — | — | — | — | — | — | — | ● | — | — | ● |
| Approve / reject gym | — | — | — | — | — | — | — | — | ● | — | — | ● |
| Suspend tenant | — | — | — | — | — | — | — | — | — | — | — | ● |
| Configure commission rate | — | — | — | — | — | — | — | — | — | ○ | — | ● |
| Approve payout run | — | — | — | — | — | — | — | — | — | ● | — | ● |
| Approve out-of-policy refund | — | — | — | — | — | — | — | — | — | ○ | — | ● |
| Handle chargeback | — | — | — | — | — | — | ○ | — | — | ● | — | ● |
| Impersonate user | — | — | — | — | — | — | — | ● | — | — | — | ● |
| Manage platform users | — | — | — | — | — | — | — | — | — | — | — | ● |
| Toggle feature flags | — | — | — | — | — | — | — | — | — | — | — | ● |
| View audit log | — | — | — | — | — | — | ▪ | ○ | ○ | ○ | ○ | ● |
| Manage taxonomy (amenities etc.) | — | — | — | — | — | — | — | — | — | — | ● | ● |
| Submit own gym application | — | — | — | — | — | — | ● | — | — | — | — | — |
| View platform overview | — | — | — | — | — | — | — | ○ | — | — | — | ● |
| View gym register | — | — | — | — | — | — | — | ○ | — | — | — | ● |

### B3.2.1 Amendment record — 2026-08-10, under Part C §C10

> A `###` heading, deliberately. `permission-matrix.spec.ts` parses §B3.2 as *"every table row from
> the heading to the next heading of the same or higher level"*, so prose carrying its own tables
> must sit behind a heading of this level or it is read as matrix rows. A `####` would not do it —
> the parser explicitly refuses to be ended by one, so that a sub-heading cannot truncate the matrix.

**Rows 43–45 were appended rather than inserted.** The
register is referenced by row number in `PHASES.md`, `DECISION_LOG.md` and several source comments —
*Edit gym profile* is row 19, *Add / remove branch* is row 20, *Review KYC documents* is row 31,
*Approve / reject gym* is row 32. Inserting in place would have silently invalidated every one of
those references, and none of them would fail a test. The cost is that three tenant- and
platform-side rows now sit after the platform block instead of within their groups.

| Row | Why it exists | Decision |
| :-: | :--- | :--- |
| **43** *Submit own gym application* | The matrix held two `onboarding.*` capabilities and both were the REVIEWER's, so a gym owner filling the signup wizard had no permission to declare and `PG-1` requires every route to declare one. `SUPER_ADMIN` is `—` deliberately: a platform actor must not author the artefact they later approve (`BR-GYM-03`). The holder is read off `FR-ONB-08` | `BLK-14` · `ADR-0047` |
| **44** *View platform overview* | `SCR-ADM-001`. The key was invented by `admin/` and existed in no row, so `PermissionsGuard` refused it as `UNKNOWN_PERMISSION` | `BLK-10` · `ADR-0047` |
| **45** *View gym register* | `SCR-ADM-004` and `SCR-ADM-002`, which read the same list. Same history as row 44 | `BLK-10` · `ADR-0047` |

**`SUPPORT_AGENT ○` on rows 44 and 45 widens access, and it is the owner's decision, recorded as
such.** The narrower option — `SUPER_ADMIN` only — was put first with its reasoning and was not
taken. `○` is read-only by construction: a `READ` cell yields a capability's read keys and never its
write keys, so a support agent can open both screens and change nothing on them. Note what it does
expose: the gym register carries every tenant's commercial terms, including effective commission
rates.

**Row 20 *Add / remove branch* was also amended in the same change** — `RECEPTIONIST`, `TRAINER` and
`GYM_MANAGER` move from `—` to `○`. `BLK-19` had been open on precisely this: `Gym.md` line 167
granted the branch list to those roles and `§B3.2` gave them nothing, and a rank-3 API document
cannot widen a rank-2 register. The owner resolved it in the register's favour by widening the
register. `○` again means the list only — creating, editing and deactivating a branch remain
`GYM_OWNER ●` and `SUPER_ADMIN ●`. `GYM_MANAGER` is included by coherence rather than by explicit
instruction: a manager who could not list branches while a receptionist could would be incoherent,
and the grant is read-only. Flagged here so it can be corrected in one cell if that reading is wrong.

### B3.3 Permission requirements

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-RBAC-01** | Every API endpoint declares its required permission; an endpoint with no declared permission fails a CI check and cannot be merged. | M |
| **FR-RBAC-02** | Permission checks are enforced server-side. Client-side hiding of UI is presentation only and never a security control. | M |
| **FR-RBAC-03** | Tenant-scoped roles are evaluated against the tenant on the resource, never against the tenant on the session alone. | M |
| **FR-RBAC-04** | Role changes take effect within 60 seconds without requiring the affected user to re-authenticate. | S |
| **FR-RBAC-05** | A user's effective permissions are inspectable by Super Admin for support purposes. | S |
| **FR-RBAC-06** | Staff invitations are role-scoped and branch-scoped at the point of invitation. | M |
| **FR-RBAC-07** | The last remaining `GYM_OWNER` of a tenant cannot be removed or demoted. | M |

## B4. Information Architecture

### B4.1 Customer website (`web`)

```
/                                     Home — location prompt, featured & nearby gyms, categories
/search                               Results (list + map), filters, sort
/gyms/:citySlug/:gymSlug              Gym detail
/gyms/:citySlug/:gymSlug/reviews      All reviews
/gyms/:citySlug/:gymSlug/plans        Plan detail / expanded catalogue
/compare                              Side-by-side comparison (up to 4)
/c/:categorySlug                      Category landing (e.g. "24-hour gyms in <city>")
/city/:citySlug                       City landing (SEO)
/checkout/:orderRef                   Checkout
/checkout/:orderRef/payment           Payment
/checkout/:orderRef/confirmation      Confirmation
/account                              Account home
/account/memberships                  Memberships (active, expired)
/account/memberships/:id              Membership detail + QR
/account/attendance                   Visit history
/account/orders                       Orders & invoices
/account/favourites                   Saved gyms
/account/reviews                      My reviews
/account/referrals                    Referral programme
/account/wallet                       Wallet (Phase 2)
/account/profile                      Profile & preferences
/account/support                      Support tickets
/auth/login  /auth/register  /auth/forgot  /auth/verify
/legal/terms  /legal/privacy  /legal/refunds
/for-gyms                             Gym owner acquisition landing
/for-gyms/signup                      Owner registration
```

### B4.2 Gym owner dashboard (`dash`)

```
/                        Home (today's snapshot)
/onboarding              Guided setup checklist (until complete)
/gym/profile             Gym profile, photos, amenities, timings
/gym/branches            Branch list and detail
/gym/kyc                 KYC documents and status
/gym/payout              Bank account, settlement preferences
/plans                   Plan catalogue
/plans/:id               Plan editor
/members                 Member list (filter, search, segment)
/members/new             Add walk-in member
/members/:id             Member 360 (memberships, payments, attendance, notes)
/checkin                 Check-in desk (scanner + manual)
/attendance              Attendance log and reports
/sales                   Orders and payments
/sales/offline           Record offline sale
/invoices                Invoices and credit notes
/settlements             Statements and payouts
/refunds                 Refund requests
/coupons                 Coupon list and editor
/leads                   Enquiry pipeline
/staff                   Staff list, invitations, roles
/staff/:id               Staff detail, branch assignment
/trainers/sessions       PT session schedule (Phase 2 surface, stubbed)
/reviews                 Reviews received, responses
/reports                 Report catalogue
/reports/:reportKey      Individual report with filters and export
/notifications           Notification centre and templates
/settings                Tenant settings, refund policy, tax profile, timezone
/settings/subscription   Subscription tier and billing
/support                 Support tickets
```

### B4.3 Super-admin console (`admin`)

```
/                        Platform dashboard
/approvals               Gym approval queue
/approvals/:id           Application review (documents + checklist)
/tenants                 Tenant list
/tenants/:id             Tenant detail (profile, plans, financials, activity, actions)
/users                   Platform-wide user search
/users/:id               User detail, memberships, orders, impersonate
/finance/orders          All orders
/finance/payments        Payment log with gateway state
/finance/settlements     Settlement runs and payout approval
/finance/refunds         Refund approval queue
/finance/disputes        Chargebacks and evidence
/finance/reconcile       Daily reconciliation report and variances
/config/commission       Commission rules (global, per-tier, per-tenant overrides)
/config/subscription     Subscription tiers and pricing
/config/tax              Tax profiles per country
/config/kyc              KYC document checklists per country
/config/taxonomy         Amenities, categories, cities, cancellation reason codes
/config/flags            Feature flags
/config/notifications    Template management
/moderation/reviews      Review moderation queue
/moderation/content      Gym content flags (photos, descriptions)
/moderation/reports      User-submitted reports
/support/tickets         Support console
/analytics               Platform analytics
/audit                   Audit log explorer
/admin/users             Platform staff and roles
```

### B4.4 Navigation rules

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-NAV-01** | The customer website is fully browsable without authentication; the auth gate appears at "select plan → checkout" and nowhere earlier. | M |
| **FR-NAV-02** | After authentication the user returns to the exact point of interruption with prior state intact (selected plan, filters, comparison set). | M |
| **FR-NAV-03** | Dashboard navigation is filtered by effective permission; a user never sees a menu item they cannot use. | M |
| **FR-NAV-04** | The dashboard shows a persistent onboarding checklist until the tenant reaches `APPROVED` with ≥1 published plan. | M |
| **FR-NAV-05** | Every gym detail page has a canonical, human-readable, stable URL suitable for sharing and search indexing. | M |
| **FR-NAV-06** | Deep links to any dashboard or admin screen resolve correctly after authentication. | S |

---

## B5. Functional Module Specifications

Each module carries: **purpose**, **functional requirements** (`FR-`), representative **user stories**
(`US-`) with acceptance criteria in Given/When/Then form (`AC-`), **edge cases**, and the **business
rules it enforces**.

---

### B5.1 `AUTH` — Authentication & Identity

**Purpose.** One identity system serving three surfaces and twelve roles, with the property that a
consumer never encounters enterprise-grade friction and an admin never encounters consumer-grade
laxity.

#### Functional requirements

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-AUTH-01** | Registration by mobile number with OTP, or by email with password and a verification link. | M |
| **FR-AUTH-02** | A verified mobile number is mandatory before any purchase; email is mandatory before any invoice is issued. | M |
| **FR-AUTH-03** | Social login (Google) as an alternative for the customer website only. | S |
| **FR-AUTH-04** | Passwords: minimum 10 characters, checked against a breached-password list, hashed with Argon2id. | M |
| **FR-AUTH-05** | OTP: 6 digits, 5-minute validity, maximum 5 attempts, maximum 3 resends per 30 minutes per number, rate-limited per IP and per number. | M |
| **FR-AUTH-06** | Sessions use short-lived access tokens (15 min) with rotating refresh tokens (30 days, revoked on reuse detection). | M |
| **FR-AUTH-07** | Mandatory MFA for all platform staff roles; optional TOTP MFA for `GYM_OWNER`. | M |
| **FR-AUTH-08** | Account lockout after 10 failed attempts in 15 minutes, with self-service unlock via verified channel. | M |
| **FR-AUTH-09** | Active session list per user with individual and bulk revocation. | S |
| **FR-AUTH-10** | Password reset invalidates all existing sessions. | M |
| **FR-AUTH-11** | A single identity may hold roles across multiple tenants; the tenant context is explicit in every dashboard session and switching is audited. | M |
| **FR-AUTH-12** | Support impersonation issues a distinctly-typed token, is capped at 30 minutes, cannot perform financial mutations, and surfaces a persistent banner in the impersonated session. | M |
| **FR-AUTH-13** | Staff invitations are single-use, expire in 7 days, and bind the invited email to the intended role and branches. | M |
| **FR-AUTH-14** | Merging duplicate accounts (same person, phone and email registered separately) is supported by Support with explicit confirmation from the user. | C |

#### User stories

**US-AUTH-01** — *As a visitor, I want to register with just my phone number so that I can buy a
membership without inventing another password.*

- **AC-AUTH-01.1** Given I am on the registration screen, when I enter a valid mobile number and
  request an OTP, then an OTP is delivered within 30 seconds and the screen advances to OTP entry
  with the number shown and an edit affordance.
- **AC-AUTH-01.2** Given I entered the correct OTP, when I submit it, then an account is created, I
  am authenticated, and I return to whatever I was doing before registration was required.
- **AC-AUTH-01.3** Given I entered an incorrect OTP, when I submit it, then I see the remaining
  attempt count and the OTP is not consumed by the failed attempt beyond the counter.
- **AC-AUTH-01.4** Given I have requested 3 OTPs in 30 minutes, when I request a fourth, then I am
  told when I may retry, and no SMS is sent.
- **AC-AUTH-01.5** Given the SMS provider is unavailable, when I request an OTP, then I am offered
  email verification as an alternative rather than a generic failure.

**US-AUTH-02** — *As a gym owner, I want to manage two gyms from one login so that I don't juggle
accounts.*

- **AC-AUTH-02.1** Given I own two tenants, when I sign in, then I choose a tenant before reaching
  the dashboard, and the choice is remembered for the session.
- **AC-AUTH-02.2** Given I am working in tenant A, when I switch to tenant B, then all in-flight
  views reload scoped to tenant B and the switch is written to the audit log.
- **AC-AUTH-02.3** Given I am in tenant A, when any request is made, then no data belonging to
  tenant B is returned under any circumstance, including search, reports and exports.

**US-AUTH-03** — *As a support agent, I want to see what a member sees so that I can resolve their
issue without a screenshare.*

- **AC-AUTH-03.1** Given I have `SUPPORT_AGENT` and a stated reason, when I start impersonation,
  then the session is capped at 30 minutes and a banner is visible throughout.
- **AC-AUTH-03.2** Given I am impersonating, when I attempt to initiate a payment, request a refund,
  or change a payout account, then the action is refused.
- **AC-AUTH-03.3** Given impersonation ended, when the member next views their account activity,
  then the impersonation event is listed with the agent's name, timestamp and reason.

#### Edge cases

- A phone number previously used by a deleted account is treated as new; no prior data is
  resurrected.
- A user changes their phone number: the new number requires OTP verification, and both old and new
  are retained in the audit trail.
- An OTP is requested and the user's SIM has changed device — no device binding is assumed; only the
  number matters.
- A staff invitation is accepted by a user who already has an account: the role is added to the
  existing identity rather than creating a duplicate.
- A refresh token is presented twice (theft indicator): the entire token family is revoked and the
  user is notified.

**Enforces:** BR-TEN-01, BR-TEN-02, BR-DAT-02.

---

### B5.2 `USER` — User Profile & Account

**Purpose.** The consumer's home inside the platform: who they are, what they hold, what they've
spent, and what the platform is allowed to send them.

#### Functional requirements

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-USER-01** | Profile fields: name, mobile, email, date of birth, gender (with "prefer not to say"), city, profile photo, emergency contact. | M |
| **FR-USER-02** | Fitness context (optional): goals, experience level, preferred workout times, health notes. Used for recommendations and shared with a gym only after purchase. | S |
| **FR-USER-03** | Health information is optional, clearly labelled as sensitive, and never used in marketing segmentation. | M |
| **FR-USER-04** | Notification preferences per channel (email, SMS, push) and per category (transactional, reminders, marketing). Transactional cannot be disabled. | M |
| **FR-USER-05** | Account activity log visible to the user: logins, devices, impersonations, data exports. | S |
| **FR-USER-06** | Self-service data export producing a machine-readable archive. | M |
| **FR-USER-07** | Self-service account deletion request with a 7-day grace period and clear disclosure of what is retained and why. | M |
| **FR-USER-08** | Changing mobile or email requires verification of the new value before it becomes effective. | M |

#### User stories

**US-USER-01** — *As a member, I want to control what the platform sends me so that I keep the
reminders and lose the marketing.*

- **AC-USER-01.1** Given I disable marketing email, when a campaign runs, then I receive nothing
  from it, verified by suppression at send time and not merely at list build time.
- **AC-USER-01.2** Given I disable all optional channels, when my membership is 3 days from expiry,
  then I still receive the renewal reminder because it is transactional.
- **AC-USER-01.3** Given I unsubscribe via an email link, when I do so, then the preference is
  applied without requiring me to log in.

**US-USER-02** — *As a member, I want to delete my account so that my data isn't held indefinitely.*

- **AC-USER-02.1** Given I request deletion, when I confirm, then I see exactly which records are
  erased and which financial records are retained, with the retention period stated.
- **AC-USER-02.2** Given deletion is scheduled, when I log in within 7 days, then I am offered
  cancellation of the deletion.
- **AC-USER-02.3** Given deletion executes, when any surface queries my identity, then personal
  identifiers are irrecoverable and financial records reference a pseudonymous identifier only.
- **AC-USER-02.4** Given I hold an active membership, when I request deletion, then I am warned that
  the membership will be forfeited and must confirm explicitly.

**Enforces:** BR-DAT-03, BR-DAT-04, BR-DAT-06.

---

### B5.3 `ONB` — Tenant Onboarding & KYC

**Purpose.** Convert an interested gym owner into a verified, listed, transacting tenant — and stop
anyone else.

#### Functional requirements

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-ONB-01** | A guided, resumable, multi-step wizard with visible progress; partial state persists indefinitely. | M |
| **FR-ONB-02** | **Step 1 Business:** legal entity name, trading name, entity type, registration identifier, registered address, business contact. | M |
| **FR-ONB-03** | **Step 2 KYC:** document upload against a country-specific checklist defined in `config/kyc`; each document typed, with format and size validation and preview. | M |
| **FR-ONB-04** | **Step 3 Gym:** display name, description, category, amenities, photographs (min 3, max 30), operating hours per weekday with holiday exceptions, gender policy, address, and map pin with drag-to-adjust. | M |
| **FR-ONB-05** | **Step 4 Plans:** at least one plan created before submission. | M |
| **FR-ONB-06** | **Step 5 Payout:** bank account details, account-name verification through the gateway, and confirmation of the tenant's refund policy. | M |
| **FR-ONB-07** | **Step 6 Review & submit:** a read-only summary with edit links, terms acceptance, and submission. | M |
| **FR-ONB-08** | Submission locks the submitted version; the owner may continue editing non-material fields but the reviewer sees a fixed snapshot. | M |
| **FR-ONB-09** | Status is visible at all times: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `INFO_REQUESTED`, `APPROVED`, `REJECTED`, `SUSPENDED`. | M |
| **FR-ONB-10** | The reviewer may request specific additional information without rejecting, moving the application to `INFO_REQUESTED` with a targeted checklist. | M |
| **FR-ONB-11** | Rejection returns one or more structured reason codes plus optional free text, and identifies exactly which fields or documents to fix. | M |
| **FR-ONB-12** | Automated pre-checks run at submission and are shown to the reviewer: address-to-geo distance, duplicate address, duplicate registration identifier, duplicate bank account, image quality and duplicate-image detection, profanity screening on free text. | M |
| **FR-ONB-13** | Approval publishes the listing within 60 seconds and notifies the owner across all enabled channels. | M |
| **FR-ONB-14** | An activation checklist persists on the dashboard home until the tenant has: approved status, ≥1 published plan, ≥1 staff member, ≥1 member, and ≥1 check-in. | S |
| **FR-ONB-15** | Bulk member import from CSV with column mapping, dry-run validation, per-row error reporting, and idempotent re-run. | S |

#### User stories

**US-ONB-01** — *As a gym owner, I want to know exactly what is missing so that I'm not guessing why
I'm not live.*

- **AC-ONB-01.1** Given I am mid-application, when I open the dashboard, then I see a checklist of
  completed and outstanding items with a direct link to each outstanding item.
- **AC-ONB-01.2** Given my application is rejected, when I open it, then each cited reason names the
  specific field or document and the corrective action.
- **AC-ONB-01.3** Given I fix the cited items, when I resubmit, then the application returns to the
  queue with a marker indicating it is a resubmission, and the reviewer can see a diff against the
  prior version.

**US-ONB-02** — *As a verification officer, I want every piece of evidence on one screen so that I
can decide in under three minutes.*

- **AC-ONB-02.1** Given an application in the queue, when I open it, then documents render in an
  inline viewer alongside the structured checklist without downloading.
- **AC-ONB-02.2** Given automated pre-checks have run, when I open the application, then any failing
  check is visible at the top with its detail, and passing checks are collapsed.
- **AC-ONB-02.3** Given the registered address geocodes more than the configured tolerance from the
  map pin, when I open the application, then this is flagged and approval requires an explicit
  override with a reason.
- **AC-ONB-02.4** Given another approved gym exists at the same address, when I open the
  application, then I see a link to that gym and approval requires an explicit override.
- **AC-ONB-02.5** Given I approve, when I confirm, then the listing is live within 60 seconds and
  the decision, my identity and timestamp are written to the audit log.

**US-ONB-03** — *As a gym owner with 400 existing members, I want to import them rather than retype
them.*

- **AC-ONB-03.1** Given a CSV, when I upload it, then I map my columns to platform fields and see a
  preview of the first 20 mapped rows.
- **AC-ONB-03.2** Given I run a validation pass, when it completes, then I see a per-row report of
  errors (invalid phone, missing name, unparseable date, duplicate) and can download it.
- **AC-ONB-03.3** Given I proceed with import, when rows contain errors, then valid rows import and
  invalid rows are skipped and reported; the import is never partially applied to a single row.
- **AC-ONB-03.4** Given I re-run the same file, when import executes, then no duplicate members are
  created.

#### Edge cases

- An owner abandons at step 3 and returns in six weeks: state is intact, but any uploaded document
  past its validity is flagged for re-upload.
- A document is uploaded in an unreadable scan: the reviewer requests information rather than
  rejecting, preserving the owner's progress.
- Two owners submit the same physical address (a genuine shared-premises case): override with reason
  is available and both are retained with a linkage marker.
- A gym is approved and then its bank account changes: payouts suspend until re-verification
  (BR-GYM-06), while the listing stays live.

**Enforces:** BR-GYM-01 … BR-GYM-09, BR-DAT-07.

---

### B5.4 `GYM` — Gym & Branch Management

**Purpose.** The tenant's public identity and physical footprint.

#### Functional requirements

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-GYM-01** | Gym profile: name, slug, description (rich text, sanitised), category, established year, contact, website, social links. | M |
| **FR-GYM-02** | Photo gallery with drag-ordering, cover selection, captions, automatic resizing to defined renditions, and EXIF stripping. | M |
| **FR-GYM-03** | Amenity selection from a platform-controlled taxonomy; free-text amenities are not permitted (they break filtering). | M |
| **FR-GYM-04** | Operating hours per weekday with multiple windows per day, plus dated exceptions (holidays, maintenance). | M |
| **FR-GYM-05** | Gender policy: mixed, women-only, men-only, or scheduled (specific hours reserved). | M |
| **FR-GYM-06** | Location: address, geo-coordinates, map pin adjustment, landmark, and parking notes. | M |
| **FR-GYM-07** | Branch management: create, edit, activate, deactivate. Each branch has its own address, hours, photos, staff and capacity. | M |
| **FR-GYM-08** | Branch-level access control on plans: a plan may permit all branches or a named subset. | M |
| **FR-GYM-09** | Capacity declaration per branch, used for crowd indicators and future class booking. | C |
| **FR-GYM-10** | Temporary closure with reason, date range, and automatic member notification. | S |
| **FR-GYM-11** | Material field changes route to review per BR-GYM-06; the UI states this before the change is saved. | M |
| **FR-GYM-12** | A listing freshness score derived from last profile update, last plan update, photo age and check-in recency; below a threshold the gym is demoted in search and the owner is prompted. | S |

#### User stories

**US-GYM-01** — *As an owner with two branches, I want members to buy a plan that works at both so
that I don't have to sell twice.*

- **AC-GYM-01.1** Given I have two active branches, when I create a plan, then I choose all branches
  or specific branches.
- **AC-GYM-01.2** Given a member holds an all-branch plan, when they check in at either branch, then
  check-in succeeds.
- **AC-GYM-01.3** Given a member holds a branch-restricted plan, when they attempt check-in at an
  excluded branch, then check-in is denied with the reason "not valid at this branch" and staff sees
  which branches are valid.

**US-GYM-02** — *As an owner, I want to close for a festival without members thinking I've shut
down.*

- **AC-GYM-02.1** Given I declare a closure for a date range with a reason, when a member views the
  gym or their membership, then the closure and reason are visible.
- **AC-GYM-02.2** Given a closure is active, when a member attempts check-in, then it is denied with
  the closure reason rather than a generic error.
- **AC-GYM-02.3** Given a closure exceeds a configurable threshold of consecutive days, when it is
  declared, then affected members are notified automatically and the gym is temporarily demoted in
  search.

**Enforces:** BR-TEN-03, BR-GYM-06, BR-GYM-07, BR-CHK-03, BR-CHK-05.

---

### B5.5 `PLAN` — Membership Plan Catalogue

**Purpose.** The sellable inventory. Everything the marketplace shows and everything checkout
charges originates here.

#### Functional requirements

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-PLAN-01** | Plan attributes: name, description, type (`DURATION` or `SESSION`), duration value and unit, session count, price, currency, joining fee, applicable branches, access windows, minimum age, gender eligibility, freeze allowance, transfer allowance, stackability, visibility (`PUBLIC` / `STAFF_ONLY`), and status (`DRAFT` / `PUBLISHED` / `ARCHIVED`). | M |
| **FR-PLAN-02** | Access windows restrict when the plan permits entry (e.g. a cheaper "off-peak" plan valid 11:00–17:00). Enforced at check-in. | S |
| **FR-PLAN-03** | Promotional pricing with a validity window and an automatic reversion to list price; only one active promotion per plan (BR-PLN-07). | S |
| **FR-PLAN-04** | Plan ordering within the gym's public catalogue is controllable by the owner. | S |
| **FR-PLAN-05** | Archiving a plan removes it from sale, retains all existing memberships, and blocks its selection in new orders. | M |
| **FR-PLAN-06** | Duplicating a plan produces an editable draft copy. | S |
| **FR-PLAN-07** | The plan editor previews exactly how the plan will appear on the marketplace before publishing. | S |
| **FR-PLAN-08** | Price changes require explicit confirmation stating that existing memberships are unaffected (BR-PLN-02). | M |
| **FR-PLAN-09** | Add-ons (locker, personal training block, diet consultation) attachable to a plan with independent pricing. | C |

#### User stories

**US-PLAN-01** — *As an owner, I want to run a monsoon offer that ends by itself so that I don't
forget to reset the price.*

- **AC-PLAN-01.1** Given I set a promotional price with an end date, when the end date passes, then
  the plan reverts to list price automatically without any action from me.
- **AC-PLAN-01.2** Given a promotion is active, when the plan renders on the marketplace, then both
  the struck-through list price and the promotional price are shown with the promotion's end date.
- **AC-PLAN-01.3** Given a member purchased during the promotion, when the promotion ends, then
  their membership retains the purchased price for its full term and any auto-renewal discloses the
  reversion price before charging.

**US-PLAN-02** — *As a member, I want the price I saw to be the price I pay.*

- **AC-PLAN-02.1** Given I select a plan at price X, when I reach payment, then the server
  re-validates and the charge equals X.
- **AC-PLAN-02.2** Given the gym changed the price between my page load and my payment attempt, when
  I attempt payment, then checkout halts with an explicit message showing the old and new price and
  requires my re-confirmation. It never silently charges either figure.
- **AC-PLAN-02.3** Given the plan was archived between my page load and my payment attempt, when I
  attempt payment, then checkout halts with a clear message and alternative plans are offered.

**Enforces:** BR-PLN-01 … BR-PLN-07.

---

### B5.6 `SRCH` — Marketplace Search & Discovery

**Purpose.** Get a stranger from "I should join a gym" to a specific gym's detail page in under a
minute.

#### Functional requirements

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-SRCH-01** | Location determination by browser geolocation with explicit consent, manual city/locality entry, or pincode. Last location is remembered. | M |
| **FR-SRCH-02** | Free-text search across gym name, locality, city and amenity synonyms, with typo tolerance. | M |
| **FR-SRCH-03** | Filters: distance radius, price range (by plan duration normalised to monthly equivalent), amenities (multi-select), rating threshold, open-now, 24-hour access, gender policy, plan duration available, trial available, parking. | M |
| **FR-SRCH-04** | Sort: relevance (default), distance, price ascending, rating, newest. | M |
| **FR-SRCH-05** | Results as an interactive list synchronised with a map; hovering a card highlights its pin and vice versa. | M |
| **FR-SRCH-06** | Each result card shows: cover photo, name, distance, rating and review count, verified badge, lowest monthly-equivalent price, top three amenities, open/closed status. | M |
| **FR-SRCH-07** | Pagination by infinite scroll on the list with a stable "load more" fallback; the map shows all results in the current viewport. | M |
| **FR-SRCH-08** | "Search this area" when the map is panned beyond the original result bounds. | S |
| **FR-SRCH-09** | Only `APPROVED`, non-suspended gyms with ≥1 published public plan appear. | M |
| **FR-SRCH-10** | Relevance ranking factors: distance, rating (Bayesian-adjusted for review count), listing freshness, conversion rate, featured status, and completeness of profile. The ranking formula is configurable without deployment. | M |
| **FR-SRCH-11** | Featured placements are visually and textually labelled as promoted. | M |
| **FR-SRCH-12** | Zero-result state offers radius expansion, filter relaxation suggestions naming the specific filter to relax, and nearby city suggestions. | M |
| **FR-SRCH-13** | Search results are server-rendered for indexability on city and category landing pages. | M |
| **FR-SRCH-14** | Saved searches with optional alerts when a new gym matches. | C |
| **FR-SRCH-15** | Every search, filter application and result click is captured as an analytics event with the anonymous or authenticated identifier. | M |

#### User stories

**US-SRCH-01** — *As Priya, I want to see only gyms open at 6 a.m. within 3 km so that I don't waste
time on ones I can't use.*

- **AC-SRCH-01.1** Given I set radius 3 km and filter "open at 06:00", when results render, then
  every result's operating hours include 06:00 on the current weekday and every result is within
  3 km of my location.
- **AC-SRCH-01.2** Given no gym matches, when results render, then I am told which filter is most
  restrictive and offered a single-tap relaxation of it, with the resulting count previewed.
- **AC-SRCH-01.3** Given I apply filters, when I share or reload the URL, then the same filters and
  location are restored.

**US-SRCH-02** — *As a visitor, I want the map and the list to feel like one thing.*

- **AC-SRCH-02.1** Given results are displayed, when I hover a list card, then its map pin is
  highlighted; when I click a pin, then the list scrolls to that card and highlights it.
- **AC-SRCH-02.2** Given I pan the map away from the current results, when panning ends, then a
  "search this area" control appears and results only update when I invoke it.
- **AC-SRCH-02.3** Given the maps provider is unavailable, when the page loads, then the list
  renders fully and the map area shows a graceful notice rather than blocking the page.

#### Edge cases

- The user denies geolocation: fall back to a city selector, never an empty state.
- The user is outside any served city: show the nearest served city with an explicit explanation,
  and capture the location as demand signal for expansion.
- All gyms in radius are suspended: treat as zero results with radius expansion, never show
  suspended gyms.
- Extremely dense area: cluster map pins with counts, expand on zoom.

**Enforces:** BR-GYM-01, BR-TEN-05, BR-PLN-05.

---

### B5.7 `DETL` — Gym Detail & Comparison

**Purpose.** Give a prospective member everything they would have learned from a visit, and let them
decide between shortlisted options.

#### Functional requirements

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-DETL-01** | Gym detail page sections: photo gallery, name and verified badge, rating summary, address with map and directions link, operating hours with today highlighted, amenities, gender policy, description, plan catalogue, reviews, similar gyms nearby. | M |
| **FR-DETL-02** | Plan cards show price, duration, what is included, joining fee if any, access windows if restricted, and a direct purchase action. | M |
| **FR-DETL-03** | A visible monthly-equivalent price for every plan to enable honest comparison across durations. | S |
| **FR-DETL-04** | Rating summary shows the mean, the count, and the distribution across 1–5. | M |
| **FR-DETL-05** | Reviews list is paginated, sortable by recency and rating, filterable by rating, and each entry shows the reviewer's display name, membership tenure band, rating, text, date and any gym response. | M |
| **FR-DETL-06** | "Report this gym" available to any authenticated user with structured reasons. | M |
| **FR-DETL-07** | Share affordance producing a canonical URL with correct link-preview metadata. | S |
| **FR-DETL-08** | Comparison of up to 4 gyms across: distance, rating, price by duration, amenities (as a presence matrix), timings, gender policy, and verified status. | S |
| **FR-DETL-09** | Comparison state survives login and page reload. | S |
| **FR-DETL-10** | Structured data markup for local business and aggregate rating on every gym page. | S |
| **FR-DETL-11** | A suspended, closed or unapproved gym's URL returns a clear informational page, not a 404, when it was previously live. | S |

#### User stories

**US-DETL-01** — *As Priya, I want to compare three gyms side by side so that I can stop going back
and forth between tabs.*

- **AC-DETL-01.1** Given I have added three gyms to comparison, when I open the comparison view,
  then all three render side by side with aligned attribute rows and differing values visually
  emphasised.
- **AC-DETL-01.2** Given a gym in my comparison lacks an amenity another has, when I view the
  amenity row, then absence is shown explicitly rather than left blank.
- **AC-DETL-01.3** Given I attempt to add a fifth gym, when I do so, then I am prompted to remove
  one, and the comparison never silently drops an entry.

**US-DETL-02** — *As a visitor, I want to trust the rating.*

- **AC-DETL-02.1** Given a gym has fewer than 3 published reviews, when I view it, then no numeric
  rating is displayed; instead the review count is shown with an explanation.
- **AC-DETL-02.2** Given reviews exist, when I view any review, then it carries a "Verified member"
  marker, and there is no review on the page without one.
- **AC-DETL-02.3** Given the gym responded to a review, when I read it, then the response is visually
  attached to the review and labelled as the gym's response.

**Enforces:** BR-REV-03, BR-REV-05, BR-REV-07, BR-PLN-03.

---

### B5.8 `FAV` — Favourites & Saved Searches

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-FAV-01** | An authenticated user may favourite and unfavourite a gym from search results, detail and comparison. | S |
| **FR-FAV-02** | Favourites are listed in the account with the current price and any change since favouriting. | S |
| **FR-FAV-03** | A visitor's favourite action prompts authentication and completes the favourite after login without losing context. | S |
| **FR-FAV-04** | Optional notification when a favourited gym launches a promotion or changes price. | C |
| **FR-FAV-05** | Saved searches with named criteria and optional new-match alerts. | C |

**US-FAV-01** — *As a user, I want to shortlist gyms now and decide at the weekend.*

- **AC-FAV-01.1** Given I favourite a gym while unauthenticated, when I complete login, then the gym
  is in my favourites and I am returned to where I was.
- **AC-FAV-01.2** Given a favourited gym's lowest price changed, when I open favourites, then the
  change is indicated with the old and new value.
- **AC-FAV-01.3** Given a favourited gym is suspended, when I open favourites, then it is shown as
  unavailable rather than silently removed.

---

### B5.9 `CART` — Checkout & Orders

**Purpose.** Convert intent to a paid membership with the minimum number of ways to fail.

#### Functional requirements

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-CART-01** | Checkout is single-plan. There is no multi-gym basket in Phase 1. | M |
| **FR-CART-02** | Checkout captures: start date (today or a future date within a configurable horizon), optional add-ons, coupon code, and acceptance of the gym's stated refund policy. | M |
| **FR-CART-03** | The order summary itemises: plan price, joining fee, add-ons, discount, tax, and total payable — each as a separate visible line. | M |
| **FR-CART-04** | All amounts are computed server-side (BR-PAY-04); the client renders what the server returns and submits no amounts. | M |
| **FR-CART-05** | Orders are created in `PENDING` with a 30-minute expiry; expired orders release any coupon reservation. | M |
| **FR-CART-06** | An idempotency key is generated per checkout attempt and honoured through payment initiation. | M |
| **FR-CART-07** | Eligibility is validated before payment: age minimum, gender eligibility, concurrent membership conflict (BR-MEM-04), and plan availability. | M |
| **FR-CART-08** | Guest-to-registered conversion happens at the auth gate without losing the selected plan or entered checkout state. | M |
| **FR-CART-09** | Staff-initiated orders in the dashboard support offline payment methods (cash, card at desk, bank transfer) and partial payment with `BALANCE_DUE` (BR-PAY-09). | M |
| **FR-CART-10** | Abandoned checkout recovery: a reminder is sent for orders abandoned after the auth gate, subject to preferences. | S |
| **FR-CART-11** | Order history is visible to the member and to the gym, each seeing only their own side. | M |

#### User stories

**US-CART-01** — *As Priya, I want to start my membership on the 1st, not today.*

- **AC-CART-01.1** Given I select a future start date within the allowed horizon, when I pay, then
  the membership is created in `PENDING` and transitions to `ACTIVE` at 00:00 in the gym's timezone
  on the start date.
- **AC-CART-01.2** Given my membership is `PENDING` with a future start, when I attempt check-in,
  then it is denied with the message that the membership begins on the stated date.
- **AC-CART-01.3** Given my start date arrives, when the transition occurs, then I receive an
  activation notification and my QR becomes available.

**US-CART-02** — *As a receptionist, I want to sell a plan at the desk and take half now, half next
week.*

- **AC-CART-02.1** Given I create an offline order and record a partial cash payment, when I save,
  then the order shows `BALANCE_DUE` with the outstanding amount, and the membership activates per
  the tenant's configuration for partial payments.
- **AC-CART-02.2** Given a balance is due, when I open the member's record, then the outstanding
  amount is prominent and a "collect balance" action is available.
- **AC-CART-02.3** Given I collect the balance, when I record it, then the order moves to `PAID`, a
  single consolidated invoice is issued, and both payments appear on it.
- **AC-CART-02.4** Given a customer is purchasing online through the marketplace, when they reach
  payment, then partial payment is not offered.

#### Edge cases

- The coupon expires between order creation and payment: payment is halted, the discount is removed,
  the new total is shown, and re-confirmation is required.
- The user already holds an active non-stackable membership at this gym: checkout is blocked with an
  explanation and a renewal path offered instead.
- The order expires while the payment page is open: the payment attempt fails cleanly and a new
  order is offered with prices re-validated.
- The same order is submitted twice from two tabs: idempotency returns one order and one payment.

**Enforces:** BR-PAY-03, BR-PAY-04, BR-PAY-09, BR-PLN-03, BR-MEM-04, BR-CPN-03, BR-REF-01.

---

### B5.10 `PAY` — Payments & Gateway

**Purpose.** Move money correctly, once, and prove it later.

#### Functional requirements

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-PAY-01** | A `PaymentProvider` abstraction exposing: create intent, capture, refund, fetch status, verify webhook, create connected account, initiate payout. No domain code references a specific provider. | M |
| **FR-PAY-02** | Supported instruments are provider-driven and rendered dynamically; the platform does not hardcode an instrument list. | M |
| **FR-PAY-03** | Membership activation is triggered exclusively by verified webhook (BR-PAY-02). | M |
| **FR-PAY-04** | Every webhook is signature-verified, deduplicated by provider event id, and processed idempotently. | M |
| **FR-PAY-05** | A payment status poller reconciles any intent left indeterminate beyond a threshold. | M |
| **FR-PAY-06** | Failed payments offer retry against the same order with a fresh intent while the order is unexpired. | M |
| **FR-PAY-07** | The payment log records every state transition with provider identifiers, timestamps and raw (redacted) payloads. | M |
| **FR-PAY-08** | Duplicate payments against one order are detected within one hour and auto-refunded with notification (BR-PAY-07). | M |
| **FR-PAY-09** | No card, CVV, bank credential or full instrument identifier is ever stored, logged or transmitted through platform systems (BR-PAY-08). | M |
| **FR-PAY-10** | Split settlement is configured so that platform commission is retained and the gym's share is routed to the gym's connected account where the provider supports it; otherwise the platform performs a scheduled payout. | M |
| **FR-PAY-11** | Auto-renewal uses provider-tokenised mandates where available, with pre-debit notification per the provider's rules. | S |
| **FR-PAY-12** | A payment sandbox mode is available in non-production environments with deterministic test outcomes for success, failure, timeout, and duplicate. | M |

#### User stories

**US-PAY-01** — *As a member, I want to not be charged twice, and if I am, I want it fixed without
asking.*

- **AC-PAY-01.1** Given I submit payment twice for one order, when both reach the gateway, then
  exactly one membership is created.
- **AC-PAY-01.2** Given two captures occurred, when the duplicate detector runs, then the second is
  refunded within one hour and I am notified with the refund reference.
- **AC-PAY-01.3** Given a duplicate refund occurred, when the gym views settlement, then the
  duplicate and its reversal both appear and net to zero.

**US-PAY-02** — *As a member, I want to know whether my payment worked even if the app crashed.*

- **AC-PAY-02.1** Given payment succeeded at the gateway but my browser closed before redirect, when
  I reopen the site, then my membership is active because activation is webhook-driven.
- **AC-PAY-02.2** Given the webhook has not yet arrived, when I check my order, then it shows
  "confirming payment" with an explicit expectation, never "failed".
- **AC-PAY-02.3** Given the payment genuinely failed, when I view the order, then I see the failure
  reason in customer language and a retry option.

#### Edge cases

- The webhook arrives before the client redirect: activation completes and the redirect finds an
  already-active membership.
- The webhook arrives twice: deduplication by event id yields one activation.
- The webhook never arrives: the poller reconciles within the threshold; if still indeterminate,
  Finance is alerted (BR-PAY-06).
- The gateway reports success but the amount differs from the order: activation is blocked and the
  case is escalated; no membership is created on an amount mismatch.
- Refund of a payment whose settlement has already been paid out: the amount is recovered from the
  reserve and the next cycle.

**Enforces:** BR-PAY-01 … BR-PAY-11.

---

### B5.11 `INV` — Invoicing & Tax

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-INV-01** | An invoice is generated automatically on every successful payment. | M |
| **FR-INV-02** | Invoice numbering is gapless and sequential per tenant per financial year, using a configurable prefix format. | M |
| **FR-INV-03** | Invoices are immutable once issued. Corrections are credit notes referencing the original. | M |
| **FR-INV-04** | Invoice content: tenant legal entity and tax identifiers, customer name and identifiers, line items, discount, tax breakdown by rate, total in words, payment reference and method, and the refund policy applicable to the order. | M |
| **FR-INV-05** | Tax computation uses a country tax profile: rate table, inclusive or exclusive treatment, place-of-supply rules where relevant, and rounding method. | M |
| **FR-INV-06** | The tax treatment applied is stored on the invoice; later profile changes never alter issued invoices (BR-PAY-11). | M |
| **FR-INV-07** | PDF generation is deterministic and reproducible; regenerating an invoice yields a byte-identical document. | M |
| **FR-INV-08** | Invoices are downloadable by the member, by the tenant, and by Finance, and are emailed on issue. | M |
| **FR-INV-09** | Credit notes are numbered in their own sequence and reference the original invoice number. | M |
| **FR-INV-10** | Bulk invoice export by date range in PDF and CSV for accounting. | M |
| **FR-INV-11** | Tenant branding (logo, footer text) on invoices, subject to tier. | S |

**US-INV-01** — *As Vikram in finance, I want a gapless invoice series so that the audit doesn't turn
into an investigation.*

- **AC-INV-01.1** Given concurrent payments complete simultaneously for one tenant, when invoices
  are issued, then numbers are unique, sequential and without gaps.
- **AC-INV-01.2** Given an invoice generation fails after the number was allocated, when the failure
  is handled, then either the number is used by the retry or a documented void record occupies it.
  A silently skipped number is a defect.
- **AC-INV-01.3** Given a financial year rolls over, when the first invoice of the new year issues,
  then the sequence restarts per the configured format and the prior year's series is closed.

**Enforces:** BR-PAY-10, BR-PAY-11, BR-REF-05.

---

### B5.12 `MEMB` — Membership Lifecycle

**Purpose.** The membership is the product. Its state must be unambiguous to the member, the gym,
the door, and the ledger simultaneously.

#### Functional requirements

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-MEMB-01** | States and transitions per Part C §C4.1, enforced by a state machine rather than ad-hoc updates. | M |
| **FR-MEMB-02** | Every transition records actor, timestamp, reason and, where financial, the related order or refund. | M |
| **FR-MEMB-03** | Membership detail shows: gym, branch entitlement, plan, start, end, days remaining, sessions remaining if applicable, status, QR access, invoice link, attendance summary, and renewal action. | M |
| **FR-MEMB-04** | Freeze: request, approval per plan configuration, date range, automatic extension of `end_date`, and a running total of freeze days used against the cap. | S |
| **FR-MEMB-05** | Unfreeze may occur early; the extension is recalculated to the actual frozen duration. | S |
| **FR-MEMB-06** | Renewal: one action from membership detail, defaulting to the same plan at current price, with the new term starting the day after the current end date (or today if already expired). | M |
| **FR-MEMB-07** | Upgrade with pro-rata credit for the unused remainder; downgrade scheduled for the next term (BR-MEM-09). | S |
| **FR-MEMB-08** | Auto-renewal opt-in at purchase and toggleable thereafter, with pre-debit notification and a cancellation path that never requires contacting support. | S |
| **FR-MEMB-09** | Expiry runs as a scheduled job in the gym's timezone; a membership never remains `ACTIVE` past its end date. | M |
| **FR-MEMB-10** | Reminder schedule per BR-MEM-11, with per-tenant override of the schedule. | M |
| **FR-MEMB-11** | Transfer to another person with gym approval and full audit, where the plan permits (BR-MEM-08). | C |
| **FR-MEMB-12** | The gym's member view shows the same membership state as the member's view, always. There is no separate gym-side status concept. | M |

#### User stories

**US-MEMB-01** — *As a member travelling for a month, I want to freeze rather than waste my
membership.*

- **AC-MEMB-01.1** Given my plan allows freezing and I have freeze days remaining, when I request a
  freeze for a future date range, then it is accepted and my end date extends by exactly that many
  days.
- **AC-MEMB-01.2** Given my freeze is active, when I attempt check-in, then it is denied with the
  reason "membership frozen until \<date\>".
- **AC-MEMB-01.3** Given I return early and unfreeze, when I do so, then my end date is recalculated
  to the actual frozen days and my membership becomes `ACTIVE` immediately.
- **AC-MEMB-01.4** Given I have exhausted my freeze allowance, when I request another freeze, then I
  am told how many days I have used and what the cap is.
- **AC-MEMB-01.5** Given my plan does not allow freezing, when I view my membership, then no freeze
  action is offered at all.

**US-MEMB-02** — *As Rohan, I want to see who is expiring this week so that I can call them.*

- **AC-MEMB-02.1** Given memberships expire within the next 7 days, when I open the dashboard home,
  then they are listed with member name, phone, plan, days remaining and a one-tap contact action.
- **AC-MEMB-02.2** Given I renew a member from that list, when I complete it, then the new term
  starts the day after their current end date without a gap.
- **AC-MEMB-02.3** Given a member has already renewed, when I view the expiring list, then they are
  excluded.

#### Edge cases

- A membership expires during a freeze: freeze extension is applied first, so the expiry date
  already accounts for it; expiry then occurs at the extended date.
- The gym's timezone differs from the member's: all validity computation uses the gym's timezone, and
  the member's UI states the timezone.
- A membership is refunded after check-ins occurred: state moves to `REFUNDED`, attendance records
  are retained, and the refund reason is required (BR-REF-06).
- Two memberships at the same gym with stackable plans: entitlements are consumed in expiry order,
  earliest first.

**Enforces:** BR-MEM-01 … BR-MEM-14.

---

### B5.13 `CHK` — QR Check-in & Attendance

**Purpose.** The daily habit that makes the platform indispensable to both sides — and the primary
defence against credential sharing.

#### Functional requirements

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-CHK-01** | The member's membership screen renders a QR encoding a signed, short-lived token (TTL 60 s) with a visible countdown and automatic refresh. | M |
| **FR-CHK-02** | The token payload contains membership id, member id, tenant id, issue time, expiry and nonce, signed server-side. It contains no personal data. | M |
| **FR-CHK-03** | The gym-side scanner is a browser-based camera scanner usable on any device, with a persistent full-screen mode for the front desk. | M |
| **FR-CHK-04** | Validation sequence, in order, with the first failure returned: signature valid → not expired → membership exists → membership `ACTIVE` → tenant matches → branch permitted → gym open (or plan grants 24h) → within plan access window → not within duplicate cooldown → entitlement remaining. | M |
| **FR-CHK-05** | A successful check-in displays the member's name, photo, plan, and days or sessions remaining, held on screen for a configurable duration. | M |
| **FR-CHK-06** | A denied check-in displays the specific reason in staff-appropriate language plus a suggested action, and is recorded (BR-CHK-10). | M |
| **FR-CHK-07** | Manual check-in by member search (name, phone, member code) for members without a phone to hand, marked `MANUAL` with staff identity and reason (BR-CHK-08). | M |
| **FR-CHK-08** | Staff override of a denial requires selecting a reason from a fixed list and is fully audited. Overrides are reportable. | M |
| **FR-CHK-09** | Check-out is optional; where recorded, duration is computed. Where absent, a configurable auto-checkout closes the visit. | S |
| **FR-CHK-10** | Attendance log with filters by date, branch, member, staff, method (`SCAN` / `MANUAL`), and result (`ALLOWED` / `DENIED`). | M |
| **FR-CHK-11** | Member-facing visit history with a streak indicator and monthly visit count. | S |
| **FR-CHK-12** | Implausible-travel detection: check-ins at two branches separated by more than a configurable distance within a configurable interval flag the membership (BR-CHK-07). | S |
| **FR-CHK-13** | Peak-hour analysis derived from attendance, surfaced as a heatmap by weekday and hour. | S |
| **FR-CHK-14** | A daily attendance digest to the owner, if enabled. | C |

#### User stories

**US-CHK-01** — *As Sameer at the desk, I want to check in a queue of ten people without anything
going wrong.*

- **AC-CHK-01.1** Given the scanner is open, when a valid QR is presented, then confirmation appears
  within 2 seconds at p95 and the scanner is immediately ready for the next person.
- **AC-CHK-01.2** Given a member's membership expired, when they present a QR, then denial shows
  "Membership expired on \<date\>" with a "Renew now" action that opens the sale flow pre-filled for
  that member.
- **AC-CHK-01.3** Given a member presents a screenshot of an old QR, when it is scanned, then it is
  denied as expired because the token TTL is 60 seconds.
- **AC-CHK-01.4** Given the same valid token is scanned twice within its TTL, when the second scan
  occurs, then the original attendance record is returned and no second visit is recorded.
- **AC-CHK-01.5** Given the network drops mid-scan, when connectivity returns, then the operation
  either completed exactly once or not at all — never twice.

**US-CHK-02** — *As Rohan, I want to know when my gym is busy so that I staff it properly.*

- **AC-CHK-02.1** Given at least 14 days of attendance data, when I open the attendance report, then
  a weekday-by-hour heatmap renders with visit counts.
- **AC-CHK-02.2** Given I filter to one branch, when the filter applies, then the heatmap reflects
  that branch only.
- **AC-CHK-02.3** Given I export the report, when the export completes, then the CSV contains one
  row per visit with member id, timestamp, branch, method and result.

#### Edge cases

- A member's phone has no battery: manual check-in by phone number lookup.
- A member holds two active memberships at the gym: the scanner asks which to consume, defaulting to
  the one expiring soonest.
- Clock skew on the scanning device: validation uses server time exclusively; the device clock is
  never trusted.
- The gym is closed for a declared exception: denial cites the closure, not "outside operating
  hours".
- A session-based membership reaches zero entitlement mid-visit: the visit completes; the next
  check-in is denied with "no sessions remaining" and a top-up path.

**Enforces:** BR-CHK-01 … BR-CHK-10, BR-MEM-06, BR-MEM-13, BR-PLN-06.

---

### B5.14 `CRM` — Member CRM

**Purpose.** The gym's operational view of a person: everything about them in one place, and
everything the gym should do about them.

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-CRM-01** | Member list with search by name, phone, email and member code; filters by status, plan, branch, expiry window, join date, attendance frequency and assigned trainer. | M |
| **FR-CRM-02** | Saved segments (e.g. "expiring in 7 days", "no visit in 21 days", "joined this month") available as list presets. | S |
| **FR-CRM-03** | Member 360 view: profile, all memberships (current and historical), all payments and invoices, full attendance history, notes, assigned trainer, communications sent, and refund/dispute history. | M |
| **FR-CRM-04** | Add a walk-in member manually with a minimal required set (name, phone) and optional remainder. | M |
| **FR-CRM-05** | Internal notes on a member, timestamped and attributed, never visible to the member. | M |
| **FR-CRM-06** | Attendance-based risk flag: a member whose visit frequency falls below their own established baseline is flagged as at-risk. | S |
| **FR-CRM-07** | Bulk actions on a filtered list: send notification, assign trainer, export. | S |
| **FR-CRM-08** | Member export with all fields the tenant owns, in CSV. | M |
| **FR-CRM-09** | Merging duplicate member records with explicit field-level resolution. | C |
| **FR-CRM-10** | Member code generation: unique, human-readable, per tenant. | S |

**US-CRM-01** — *As Rohan, I want to find people who have stopped coming before they stop paying.*

- **AC-CRM-01.1** Given a member's average weekly visits over the last 8 weeks dropped by more than
  the configured threshold, when I open the at-risk segment, then they appear with their baseline,
  current frequency and last visit date.
- **AC-CRM-01.2** Given I select the at-risk segment, when I send a bulk notification, then it
  respects each member's notification preferences and reports how many were sent and how many
  suppressed, with reasons.
- **AC-CRM-01.3** Given a flagged member checks in, when the check-in records, then the flag clears
  automatically.

**Enforces:** BR-TEN-01, BR-DAT-01, BR-DAT-05.

---

### B5.15 `STAF` — Staff, Roles & Permissions

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-STAF-01** | Invite staff by email or phone with role and branch assignment fixed at invitation. | M |
| **FR-STAF-02** | Roles available to a tenant: `GYM_MANAGER`, `RECEPTIONIST`, `TRAINER`, and additional `GYM_OWNER`. | M |
| **FR-STAF-03** | Branch scoping: a staff member sees and acts only within assigned branches. | M |
| **FR-STAF-04** | Staff status: `INVITED`, `ACTIVE`, `SUSPENDED`, `REMOVED`. Removal revokes access immediately and preserves all historical attribution. | M |
| **FR-STAF-05** | Staff activity log: check-ins performed, payments collected, members created, overrides used. | M |
| **FR-STAF-06** | Seat limits enforced per subscription tier, with a clear upgrade path when exceeded. | M |
| **FR-STAF-07** | Trainer-specific: assigned member list, session scheduling, workout plan assignment. | S |
| **FR-STAF-08** | Shift or duty roster with attendance for staff themselves. | C |
| **FR-STAF-09** | The last `GYM_OWNER` cannot be removed or demoted (FR-RBAC-07). | M |

**US-STAF-01** — *As Rohan, I want a receptionist who can take money but cannot change prices.*

- **AC-STAF-01.1** Given I invite a user as `RECEPTIONIST` at branch 1, when they sign in, then they
  see check-in, member management and sale recording for branch 1 only.
- **AC-STAF-01.2** Given they are a `RECEPTIONIST`, when they attempt to open plan editing by direct
  URL, then the request is refused server-side with a permission error, not merely hidden in the UI.
- **AC-STAF-01.3** Given they collected cash payments, when I open their activity log, then every
  collection is listed with amount, member, timestamp and order reference.
- **AC-STAF-01.4** Given I remove them, when they next make any request, then it is refused, and
  their historical attributions remain intact and attributed to them.

**Enforces:** FR-RBAC-01 … FR-RBAC-07, BR-DAT-01.

---

### B5.16 `REV` — Reviews & Ratings

**Purpose.** The trust layer. Its integrity is worth more than its volume.

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-REV-01** | A review requires ≥1 recorded check-in at that gym (BR-REV-01). Eligibility is computed server-side; the compose UI is unreachable otherwise. | M |
| **FR-REV-02** | Review content: 1–5 star overall rating, optional sub-ratings (equipment, cleanliness, staff, crowd, value), free text 20–2000 characters, optional photos. | M |
| **FR-REV-03** | Automated screening on submission for profanity, contact details, URLs, competitor solicitation and spam patterns; failures queue for moderation rather than rejecting outright. | M |
| **FR-REV-04** | One review per member per gym per membership term; editable for 7 days with edit history retained (BR-REV-02). | M |
| **FR-REV-05** | The gym may respond once per review; responses are screened identically. | M |
| **FR-REV-06** | The gym may report a review with a structured reason; reporting never removes it (BR-REV-05, BR-REV-06). | M |
| **FR-REV-07** | Moderation queue for platform moderators with actions: publish, unpublish, request edit, permanently remove with reason. | M |
| **FR-REV-08** | Rating aggregation is Bayesian-adjusted for review count in ranking, but the displayed figure is the plain mean with the count (BR-REV-07). | M |
| **FR-REV-09** | Anomaly detection on rating velocity, reviewer account age, and clustering of similar text; anomalies queue for moderation and are excluded from ranking pending review. | S |
| **FR-REV-10** | A review prompt is sent after the member's third check-in, and once more at day 45 if not submitted. | S |
| **FR-REV-11** | Members may delete their own review; the aggregate updates and the deletion is retained in audit. | M |

**US-REV-01** — *As a gym owner, I want a fair chance to answer a bad review, and no ability to hide
it.*

- **AC-REV-01.1** Given a review is published about my gym, when I open it, then I may post one
  public response.
- **AC-REV-01.2** Given a published review, when I look for a delete or edit action on it, then none
  exists anywhere in the interface or API.
- **AC-REV-01.3** Given I believe a review is fraudulent, when I report it with a reason, then it
  remains published, a moderation case opens, and I am notified of the outcome.

**US-REV-02** — *As a platform, I want fake reviews to be structurally difficult.*

- **AC-REV-02.1** Given a user has never checked in at a gym, when they attempt to submit a review
  by direct API call, then it is refused with 403.
- **AC-REV-02.2** Given a gym receives an unusual burst of 5-star reviews from accounts created
  within the same period, when the anomaly detector runs, then those reviews are held for moderation
  and excluded from the aggregate until cleared.
- **AC-REV-02.3** Given a review is unpublished by a moderator, when the gym's rating renders, then
  the aggregate recalculates without it within one minute.

**Enforces:** BR-REV-01 … BR-REV-07.

---

### B5.17 `CPN` — Coupons & Promotions

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-CPN-01** | Coupon attributes per BR-CPN-01, including `funding_source` (`PLATFORM` / `GYM`). | M |
| **FR-CPN-02** | Scope: platform-wide coupons created by Super Admin; tenant coupons created by the owner and valid only at that tenant. | M |
| **FR-CPN-03** | Validation at apply time and again at payment initiation (BR-CPN-03). | M |
| **FR-CPN-04** | Usage tracking: total redemptions, per-user redemptions, value discounted, and attributable revenue. | M |
| **FR-CPN-05** | Auto-generated unique codes for one-time use (e.g. win-back campaigns) in bulk. | S |
| **FR-CPN-06** | First-purchase-only enforcement evaluated against the user's platform-wide order history. | M |
| **FR-CPN-07** | A coupon may be paused and resumed without deletion. | S |
| **FR-CPN-08** | Coupon performance report: redemptions, discount cost, gross revenue influenced, and net after discount. | S |

**US-CPN-01** — *As Rohan, I want a first-month discount that only new customers can use.*

- **AC-CPN-01.1** Given a coupon marked first-purchase-only, when a user with a prior completed
  order applies it, then it is refused with the specific reason.
- **AC-CPN-01.2** Given a per-user limit of 1, when the same user applies it on a second order, then
  it is refused.
- **AC-CPN-01.3** Given the total usage cap is reached, when any user applies it, then it is refused
  and the coupon is automatically marked exhausted in the dashboard.
- **AC-CPN-01.4** Given the coupon is gym-funded, when settlement computes, then the commission base
  is the post-discount net amount.

**Enforces:** BR-CPN-01 … BR-CPN-05.

---

### B5.18 `REFR` — Referrals & Wallet

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-REFR-01** | Each member has a unique referral code and shareable link. | S |
| **FR-REFR-02** | Referral attribution on registration or first purchase, whichever occurs first, within a configurable window. | S |
| **FR-REFR-03** | Reward configuration: value to referrer and referee, as wallet credit or discount, funded by platform or tenant. | S |
| **FR-REFR-04** | Reward credited only after the referred member's first membership clears the refund window (BR-RFL-01). | S |
| **FR-REFR-05** | Referral dashboard for the member: invited, joined, rewards earned and pending. | S |
| **FR-REFR-06** | Wallet: balance, transaction history, expiry, application at checkout before gateway charge (BR-WAL-01). | C |
| **FR-REFR-07** | Self-referral and circular referral detection and prevention. | S |

**US-REFR-01** — *As a member, I want credit for bringing a friend, and I want to see where it is.*

- **AC-REFR-01.1** Given my friend registers via my link and buys a membership, when the refund
  window on their purchase closes, then my reward is credited and I am notified.
- **AC-REFR-01.2** Given their purchase is refunded within the window, when the refund completes,
  then no reward is credited and my dashboard shows the referral as not qualified with the reason.
- **AC-REFR-01.3** Given I attempt to use my own referral link, when I register, then no attribution
  is created.

---

### B5.19 `NOTF` — Notifications

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-NOTF-01** | Channels: email, SMS, in-app notification centre, and web push. Each channel is an adapter behind a common interface. | M |
| **FR-NOTF-02** | Categories: transactional (never opt-out), operational reminders (opt-out), marketing (opt-in). | M |
| **FR-NOTF-03** | Templates are versioned, previewable, and editable by Super Admin without deployment; tenant-level overrides where the tier permits. | M |
| **FR-NOTF-04** | Delivery is queued, retried with backoff, and every attempt is logged with provider response. | M |
| **FR-NOTF-05** | Per-user, per-channel quiet hours in the recipient's timezone for non-transactional messages. | S |
| **FR-NOTF-06** | Rate limiting per recipient per category to prevent notification storms. | M |
| **FR-NOTF-07** | In-app notification centre with read/unread state on all three surfaces. | S |
| **FR-NOTF-08** | A cost report per channel per period for Finance. | S |

#### Baseline notification catalogue

| Event | Recipient | Channels | Category |
| :--- | :--- | :--- | :--- |
| OTP | User | SMS / Email | Transactional |
| Registration welcome | User | Email | Transactional |
| Order confirmation + invoice | Member | Email, In-app | Transactional |
| Payment failed | Member | Email, SMS, In-app | Transactional |
| Membership activated | Member | Email, SMS, In-app | Transactional |
| Membership starts today (future-dated) | Member | SMS, In-app | Transactional |
| Check-in confirmation | Member | In-app | Operational |
| Renewal reminder T−15 / −7 / −3 / −1 | Member | Email, SMS, In-app | Operational |
| Membership expired | Member | Email, SMS, In-app | Transactional |
| Freeze started / ended | Member | Email, In-app | Transactional |
| Refund initiated / completed | Member | Email, In-app | Transactional |
| Review request | Member | Email, In-app | Operational |
| Gym closure notice | Member | SMS, Email, In-app | Transactional |
| New sale | Owner | In-app, Email digest | Operational |
| Daily summary | Owner | Email | Operational |
| Expiring members this week | Owner | Email, In-app | Operational |
| New review received | Owner | In-app, Email | Operational |
| Payout initiated + statement | Owner | Email, In-app | Transactional |
| KYC approved / rejected / info requested | Owner | Email, SMS, In-app | Transactional |
| Subscription payment failed | Owner | Email, SMS, In-app | Transactional |
| Application awaiting review > SLA | Verification Officer | In-app, Email | Operational |
| Refund awaiting approval | Finance | In-app, Email | Operational |
| Reconciliation variance | Finance | Email, Alert | Operational |
| Moderation queue over threshold | Moderator | In-app | Operational |

**Enforces:** BR-MEM-11, BR-MEM-14, BR-TEN-06, FR-USER-04.

---

### B5.20 `RPT` — Reports & Analytics

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-RPT-01** | Every report supports a date range, branch filter, on-screen rendering, CSV export and, where meaningful, a chart. | M |
| **FR-RPT-02** | Reports read from data no more than 15 minutes stale; financial reports read from the ledger and are always current. | M |
| **FR-RPT-03** | Exports over a size threshold are generated asynchronously and delivered by notification with a time-limited download link. | S |
| **FR-RPT-04** | Scheduled report delivery by email (daily, weekly, monthly). | S |
| **FR-RPT-05** | Every figure on a report is traceable: clicking a total reveals its constituent records. | S |

#### Tenant report catalogue

| Report | Contents |
| :--- | :--- |
| Revenue summary | Gross, discounts, tax, net, commission, payable, by day/week/month, split online vs offline |
| Revenue by plan | Units sold, gross, net, average selling price, share of revenue |
| New members | Count and value by period, by source (marketplace vs direct) |
| Renewals | Due, renewed, lapsed, renewal rate, by plan |
| Churn cohort | Retention by joining month across subsequent months |
| Attendance summary | Visits by day, unique members, average visits per member |
| Peak hours | Weekday-by-hour heatmap |
| Member activity | Per member: visits, last visit, frequency trend, risk flag |
| Expiring memberships | Next 7/15/30 days with contact details |
| Outstanding balances | Orders with `BALANCE_DUE` |
| Staff activity | Check-ins, sales, collections, overrides by staff |
| Coupon performance | Redemptions, discount cost, influenced revenue |
| Review summary | Rating trend, volume, response rate, sub-rating breakdown |
| Settlement statement | Per payout: transactions, all eight computed figures, net |
| Tax report | Taxable value and tax by rate by period |
| Lead funnel | Enquiries, contacted, converted, conversion rate |

#### Platform report catalogue (`admin`)

| Report | Contents |
| :--- | :--- |
| GMV and take rate | By period, city, tier |
| Tenant funnel | Signups → submitted → approved → activated → transacting |
| Tenant cohort retention | By signup month |
| Marketplace funnel | Search → detail → checkout → paid, with drop-off at each step |
| City performance | Supply, demand, GMV, conversion by city |
| Payment health | Success rate, failure reasons, retry recovery |
| Refunds and disputes | Rate, value, reasons, by tenant |
| Reconciliation | Gateway vs ledger variance by day |
| Review integrity | Volume, moderation rate, anomaly flags |
| Support load | Tickets per tenant, per category, resolution time |
| Verification SLA | Queue depth, time to decision, rejection reasons distribution |

**US-RPT-01** — *As Rohan, I want to know which plan actually makes me money.*

- **AC-RPT-01.1** Given sales exist across several plans, when I open revenue by plan, then each
  plan shows units, gross, discounts, net and share of total.
- **AC-RPT-01.2** Given I click a plan's net figure, when the drill-down opens, then I see the
  individual orders composing it.
- **AC-RPT-01.3** Given I export, when the CSV opens, then column headers are human-readable and
  every monetary column is a plain number with a separate currency column.

---

### B5.21 `SETL` — Settlements & Payouts

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-SETL-01** | A settlement batch is created per tenant per cycle, containing every eligible transaction since the last batch. | M |
| **FR-SETL-02** | Each batch line carries gross, discount, net, tax, commission base, commission, gateway fee and payable — all persisted, never recomputed at display (A6.3). | M |
| **FR-SETL-03** | Refunds and chargebacks appear as negative lines in the batch in which they are recognised. | M |
| **FR-SETL-04** | Reserve is withheld per configuration and released on schedule as a separate visible line. | M |
| **FR-SETL-05** | Batches below the minimum payout roll forward with the reason shown to the tenant. | M |
| **FR-SETL-06** | Payout requires Finance approval unless auto-payout is enabled for the tenant and the batch is below the auto-approval threshold. | M |
| **FR-SETL-07** | The tenant sees every batch, its lines and its status (`PENDING`, `APPROVED`, `PROCESSING`, `PAID`, `FAILED`, `ON_HOLD`), plus a downloadable statement. | M |
| **FR-SETL-08** | Payout failure (bank rejection) returns the batch to `PENDING` with the failure reason and notifies both the tenant and Finance. | M |
| **FR-SETL-09** | Daily reconciliation compares gateway settlement reports to the internal ledger and raises an alert on any variance (KPI-26). | M |
| **FR-SETL-10** | A negative balance carries forward and is recovered from subsequent batches; persistent negative balance beyond a threshold triggers tenant review. | M |

**US-SETL-01** — *As Rohan, I want to understand exactly why I received the amount I received.*

- **AC-SETL-01.1** Given a payout is made, when I open its statement, then every transaction is
  listed with all eight figures and the arithmetic visibly sums to the payout amount.
- **AC-SETL-01.2** Given a refund occurred in the period, when I view the statement, then it appears
  as a negative line with a reference to the original sale.
- **AC-SETL-01.3** Given reserve was withheld, when I view the statement, then the amount, the
  reason and the scheduled release date are stated.
- **AC-SETL-01.4** Given my balance was negative, when the next batch runs, then the recovery is
  shown as an explicit opening balance line.

**Enforces:** A6.3, A6.4, BR-FIN rules, BR-REF-05.

---

### B5.22 `RFND` — Refunds & Disputes

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-RFND-01** | Refund request origination: member (through support or self-service where policy permits), gym staff, or platform staff. | M |
| **FR-RFND-02** | The applicable policy is the one stored on the order (BR-REF-02) and is displayed alongside the request. | M |
| **FR-RFND-03** | Automatic eligibility evaluation: within window, usage below threshold, value below threshold → auto-approve; otherwise route to Super Admin. | M |
| **FR-RFND-04** | Refund amount computation: full, or pro-rata on unconsumed duration or sessions, less any stated cancellation fee, with the computation shown to all parties. | M |
| **FR-RFND-05** | Refund execution to the original instrument only (BR-REF-04), with gateway reference retained. | M |
| **FR-RFND-06** | Membership state moves to `REFUNDED` (full) or is adjusted (partial); QR access revokes immediately on full refund. | M |
| **FR-RFND-07** | A credit note is issued and the ledger reversal entries are written, including proportional commission reversal (BR-REF-05). | M |
| **FR-RFND-08** | Dispute (chargeback) intake from the gateway webhook, creating a case with an evidence deadline and a checklist of evidence to assemble. | M |
| **FR-RFND-09** | Automatic evidence pack assembly: order, invoice, payment record, attendance records, terms accepted, and communication log. | S |
| **FR-RFND-10** | Disputed amounts are held against the tenant balance from case opening (BR-REF-08). | M |
| **FR-RFND-11** | Refund and dispute history is visible on the member record, the order, and the tenant's financial views. | M |

**US-RFND-01** — *As a member, I want my money back within the stated window without an argument.*

- **AC-RFND-01.1** Given I am within the gym's stated no-questions window with no check-ins, when I
  request a refund, then it auto-approves and the gateway refund initiates within one business day.
- **AC-RFND-01.2** Given I have checked in 8 times of a 30-day plan, when I request a refund, then
  the pro-rata computation is shown to me before I confirm, and approval routes to platform review.
- **AC-RFND-01.3** Given my refund completes, when I open my account, then the membership shows
  `REFUNDED`, the credit note is downloadable, and my QR no longer generates.

**US-RFND-02** — *As Vikram, I want a chargeback to not become a surprise.*

- **AC-RFND-02.1** Given a chargeback webhook arrives, when it processes, then a case is created,
  the amount is held against the tenant balance, and both Finance and the tenant are notified with
  the deadline.
- **AC-RFND-02.2** Given a case is open, when I open it, then the evidence pack is pre-assembled and
  downloadable.
- **AC-RFND-02.3** Given the case resolves in the tenant's favour, when the resolution webhook
  arrives, then the hold releases and the amount returns to the next settlement.

**Enforces:** BR-REF-01 … BR-REF-09.

---

### B5.23 `SUP` — Support & Ticketing

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-SUP-01** | Ticket creation by members and by tenants, with category, description and attachments. | S |
| **FR-SUP-02** | Contextual ticket creation from an order, membership, payment or check-in, auto-attaching the relevant references. | S |
| **FR-SUP-03** | Agent console with queue, assignment, priority, internal notes, canned responses and full customer context. | S |
| **FR-SUP-04** | Status lifecycle: `OPEN`, `IN_PROGRESS`, `WAITING_ON_CUSTOMER`, `RESOLVED`, `CLOSED`. | S |
| **FR-SUP-05** | SLA timers per priority with breach alerting (KPI-25). | S |
| **FR-SUP-06** | Self-service help centre with articles mapped to the ten most common issues (OBJ-10). | S |
| **FR-SUP-07** | Satisfaction rating on resolution. | C |

---

### B5.24 `ADMN` — Platform Administration & Audit

| ID | Requirement | Pri |
| :--- | :--- | :-: |
| **FR-ADMN-01** | Tenant administration: search, view, suspend, reinstate, change tier, override commission, adjust settlement cycle, and force re-verification. | M |
| **FR-ADMN-02** | Every administrative action requires a reason and is written to the audit log. | M |
| **FR-ADMN-03** | Commission configuration at three levels with clear precedence: global default < tier < tenant override. The effective rate for any tenant is displayed with its source. | M |
| **FR-ADMN-04** | Subscription tier configuration: limits, features, prices. | M |
| **FR-ADMN-05** | Tax profile configuration per country: rates, inclusive/exclusive, rounding, invoice field requirements. | M |
| **FR-ADMN-06** | KYC checklist configuration per country: document types, mandatory flags, validity rules. | M |
| **FR-ADMN-07** | Taxonomy management: amenities, categories, cities and localities, rejection reason codes, refund reason codes, denial reason codes. | M |
| **FR-ADMN-08** | Feature flags with targeting by tenant, by role and by percentage rollout, changeable without deployment. | M |
| **FR-ADMN-09** | Audit log explorer: filter by actor, entity type, entity id, action, date range; view before/after state; export. | M |
| **FR-ADMN-10** | Platform staff administration: invite, role assignment, MFA enforcement, session revocation. | M |
| **FR-ADMN-11** | Verification queue management: assignment, SLA monitoring, workload distribution. | M |
| **FR-ADMN-12** | Content moderation queues for reviews, gym photos and descriptions, and user reports. | M |
| **FR-ADMN-13** | A read-only "system health" view: queue depths, webhook failure counts, reconciliation status, job failures. | S |

**US-ADMN-01** — *As a super admin, I want to give one tenant a promotional commission rate without
touching anyone else.*

- **AC-ADMN-01.1** Given a tenant on the Growth tier, when I set a tenant-level commission override
  with a reason, then their effective rate reflects the override and the tier rate is unchanged for
  all other tenants.
- **AC-ADMN-01.2** Given the override exists, when I view the tenant, then the effective rate is
  shown together with its source ("tenant override, set by \<actor\> on \<date\>, reason: \<reason\>").
- **AC-ADMN-01.3** Given the override has an end date, when it passes, then the rate reverts to the
  tier rate automatically and both the tenant and Finance are notified.
- **AC-ADMN-01.4** Given settlements ran during the override, when I view historical statements,
  then they show the rate that applied at the time, not the current rate.

**US-ADMN-02** — *As an auditor, I want to reconstruct who changed what.*

- **AC-ADMN-02.1** Given any entity id, when I query the audit log, then I see every change in
  chronological order with actor, timestamp, IP, before-state and after-state.
- **AC-ADMN-02.2** Given a support agent impersonated a user, when I query that user's audit trail,
  then the impersonation, its reason, its duration and every action taken during it are visible and
  marked as impersonated.
- **AC-ADMN-02.3** Given I attempt to modify or delete an audit record through any interface, then
  no such capability exists.

**Enforces:** BR-DAT-01, BR-DAT-02, BR-DAT-07, BR-TEN-05, BR-TEN-06.

---

## B6. Screen Specifications — Customer Website (`web`)

Each screen specifies purpose, layout regions, components, data, states and actions. **States are
specified for every screen** because the empty, loading, error and permission-denied cases are where
implementations diverge from intent.

### SCR-WEB-001 — Home

| Aspect | Specification |
| :--- | :--- |
| **Purpose** | Establish location, communicate the value proposition, and route to search within one interaction. |
| **Above the fold** | Headline, sub-headline, prominent search bar (location + optional query), primary CTA "Find gyms near me" |
| **Regions** | (1) Hero with search; (2) "Popular near you" — 8 gym cards; (3) Category tiles (24-hour, women-only, budget, premium, CrossFit, yoga); (4) How it works — 3 steps; (5) Trust strip (verified gyms count, members count, cities); (6) Featured gyms (labelled promoted); (7) "List your gym" band for owners; (8) Footer |
| **Data** | Nearby gyms by IP or stored location; category counts; platform trust counters |
| **Loading** | Skeleton cards; the search bar is interactive immediately and never blocked by content loading |
| **Empty (no gyms in area)** | "We're not in yet" with an email capture for launch notification and a link to the nearest served city |
| **Error** | Static content renders; dynamic strips degrade to hidden with no error dialog |
| **Actions** | Search, select category, open gym, request location permission, register |
| **Notes** | Location permission is requested contextually on the CTA, never on page load. |

### SCR-WEB-002 — Search Results

| Aspect | Specification |
| :--- | :--- |
| **Purpose** | Narrow many gyms to a shortlist. |
| **Layout (desktop)** | Left: filter rail (sticky). Centre: result list. Right: map (sticky, 40% width). |
| **Layout (mobile)** | Full-width list; filters in a bottom sheet; map behind a toggle that becomes full-screen. |
| **Filter rail** | Distance slider, price range, amenities (searchable multi-select), rating, open now, 24-hour, gender policy, plan durations available, trial available, parking. Each filter shows a live result count. |
| **Sort control** | Relevance, distance, price low-high, rating, newest |
| **Result card** | Cover photo (4:3), name, verified badge, distance, rating + count, lowest monthly-equivalent price, 3 amenity chips, open/closed pill, favourite toggle, compare checkbox |
| **Map** | Clustered pins, price labels at close zoom, bidirectional hover/click sync with the list, "Search this area" on pan |
| **Selection bar** | Appears when ≥2 gyms are checked for comparison; shows count and "Compare" |
| **Loading** | 6 skeleton cards; map shows a loading overlay, not a blank tile |
| **Empty** | Names the most restrictive filter, offers one-tap relaxation with the resulting count previewed, plus radius expansion and nearby cities |
| **Error** | Retry affordance; last successful results retained where possible |
| **URL state** | Location, query, all filters, sort and page are encoded in the URL and restored on load |

### SCR-WEB-003 — Gym Detail

| Aspect | Specification |
| :--- | :--- |
| **Purpose** | Give a prospective member enough to decide without visiting. |
| **Regions** | (1) Gallery with lightbox; (2) Header: name, verified badge, rating summary, locality, open/closed, share, favourite; (3) Sticky plan panel (desktop right column) with the cheapest plan and a "View plans" jump; (4) Amenities grid; (5) Timings table with today highlighted; (6) Gender policy; (7) About; (8) Plans section; (9) Location map with directions link, landmark, parking note; (10) Reviews with rating distribution; (11) Similar gyms nearby; (12) Report this gym |
| **Plan card** | Name, duration, price, monthly equivalent, joining fee, inclusions, access-window note if restricted, "Buy now" |
| **Review item** | Display name, tenure band ("Member for 4 months"), verified marker, rating, sub-ratings, text, photos, date, gym response |
| **States** | Loading skeleton; gym suspended → informational page explaining unavailability with similar gyms; gym has <3 reviews → count shown, no numeric rating |
| **Actions** | Buy plan, favourite, compare, share, report, view all reviews, get directions |
| **SEO** | Server-rendered; structured data for local business, aggregate rating and offers; canonical URL |

### SCR-WEB-004 — Comparison

| Aspect | Specification |
| :--- | :--- |
| **Purpose** | Resolve a shortlist into a choice. |
| **Layout** | Fixed attribute column on the left; one column per gym (max 4), horizontally scrollable on mobile with the attribute column pinned |
| **Rows** | Photo, name, distance, rating and count, verified, price by duration (1/3/6/12 months), joining fee, amenities (presence matrix), timings, gender policy, trial availability, review highlights |
| **Emphasis** | Differing values are visually emphasised; identical values are de-emphasised |
| **Actions** | Remove a gym, add another (returns to search with the comparison retained), buy from any column |
| **Persistence** | Comparison set survives reload and login |

### SCR-WEB-005 — Checkout

| Aspect | Specification |
| :--- | :--- |
| **Purpose** | Collect the minimum required to sell, and disclose everything required to be fair. |
| **Regions** | (1) Order summary: gym, plan, duration, start date picker, add-ons; (2) Coupon field with apply/remove; (3) Price breakdown: plan price, joining fee, add-ons, discount, tax, total; (4) Member details (pre-filled, editable); (5) Refund policy disclosure (the gym's stated policy, in full, not a link); (6) Terms acceptance; (7) "Proceed to payment" |
| **Validation** | Age, gender eligibility, concurrent membership conflict, plan availability — all server-checked before payment is offered |
| **States** | Coupon invalid → inline reason; price changed since page load → blocking modal showing old and new price requiring re-confirmation; plan archived → blocking message with alternatives; order expired → new order offered |
| **Actions** | Apply/remove coupon, change start date, edit details, proceed, cancel |
| **Notes** | Amounts are always server-returned. The client submits a plan id, a start date, an optional coupon code and an idempotency key — **never a price**. |

### SCR-WEB-006 — Payment

| Aspect | Specification |
| :--- | :--- |
| **Purpose** | Hand off to the gateway and return safely. |
| **Content** | Amount payable, order reference, gateway element or redirect, security assurance, "do not close this window" guidance |
| **States** | Processing (non-dismissible, with elapsed indicator); success → redirect to confirmation; failure → reason in customer language plus retry; timeout → "we're confirming your payment" with automatic polling and an explicit message that no second attempt should be made |
| **Notes** | The confirmation screen never asserts activation on the client redirect alone; it reflects server state. |

### SCR-WEB-007 — Order Confirmation

| Aspect | Specification |
| :--- | :--- |
| **Content** | Success confirmation, membership summary (gym, plan, start, end), QR access CTA, invoice download, "add to calendar" for start date, next steps (what to bring, timings, location), review-later note |
| **Pending state** | If the webhook has not yet landed, show "confirming payment" with live polling, and never a failure message before the reconciliation threshold elapses |

### SCR-WEB-008 — Account Home

| Aspect | Specification |
| :--- | :--- |
| **Content** | Active membership cards with days remaining and a QR shortcut; next expiry callout; recent visits; recent orders; favourites preview; referral prompt |
| **Empty** | No memberships → discovery CTA with nearby gyms |

### SCR-WEB-009 — Membership Detail & QR

| Aspect | Specification |
| :--- | :--- |
| **Purpose** | Get the member through the door. |
| **Content** | Gym name and branch entitlement, plan, status pill, start and end dates, days remaining (or sessions remaining), large QR with a visible countdown and auto-refresh, brightness hint, invoice link, attendance summary, freeze action (if permitted), renew action, cancel/refund path, gym contact and directions |
| **States** | `PENDING` future start → QR replaced by "starts on \<date\>"; `FROZEN` → QR replaced by frozen notice with end date and unfreeze action; `EXPIRED` → QR replaced by renew CTA; `REFUNDED` → historical view only |
| **Behaviour** | The QR refreshes automatically every 60 seconds while the screen is visible, and pauses when backgrounded. |

### SCR-WEB-010 — Visit History

| Aspect | Specification |
| :--- | :--- |
| **Content** | Chronological visit list with date, time, branch, duration where available; monthly summary; current streak; simple frequency chart |
| **Empty** | "No visits yet" with the QR shortcut |

### SCR-WEB-011 — Orders & Invoices

| Aspect | Specification |
| :--- | :--- |
| **Content** | Order list with date, gym, plan, amount, status; invoice and credit-note downloads; refund status where applicable |

### SCR-WEB-012 — Favourites

| Aspect | Specification |
| :--- | :--- |
| **Content** | Saved gym cards with current lowest price and any change since saving; unavailable gyms shown as unavailable rather than removed |

### SCR-WEB-013 — Write / Edit Review

| Aspect | Specification |
| :--- | :--- |
| **Access** | Reachable only when eligibility is satisfied server-side |
| **Content** | Overall rating, optional sub-ratings, text with character counter, optional photos, guidelines summary |
| **States** | Ineligible → explanation of the check-in requirement; already reviewed → edit within 7 days, otherwise read-only; held for moderation → clear status message |

### SCR-WEB-014 — Profile & Preferences

| Aspect | Specification |
| :--- | :--- |
| **Content** | Personal details, contact with verification state, fitness context, notification preferences matrix (channel × category), password and MFA, active sessions, account activity, data export, delete account |

### SCR-WEB-015 — Referrals

| Aspect | Specification |
| :--- | :--- |
| **Content** | Referral code and link, share affordances, invited list with status, rewards earned and pending with qualification explanation |

### SCR-WEB-016 — Auth Screens

| Aspect | Specification |
| :--- | :--- |
| **Screens** | Login (phone OTP or email/password), Register, Verify OTP, Forgot password, Reset password |
| **Behaviour** | Every auth screen preserves and restores the pre-auth destination and state. |

### SCR-WEB-017 — Support

| Aspect | Specification |
| :--- | :--- |
| **Content** | Help centre search, article view, ticket list, new ticket with contextual attachment of an order/membership |

### SCR-WEB-018 — For Gyms (acquisition landing)

| Aspect | Specification |
| :--- | :--- |
| **Content** | Value proposition for owners, feature summary, pricing tiers, testimonials, FAQ, signup CTA |

---

## B7. Screen Specifications — Gym Owner Dashboard (`dash`)

### SCR-DASH-001 — Dashboard Home

| Aspect | Specification |
| :--- | :--- |
| **Purpose** | Answer "what do I need to do today" without navigation. |
| **Region 1 — Alerts** | Onboarding checklist (until complete), KYC status, subscription arrears, payout failures, unread reviews needing response, refund requests pending |
| **Region 2 — Today** | Check-ins today, active members, new members today, revenue today, currently-in-gym count |
| **Region 3 — Action lists** | Expiring in 7 days (with contact actions), outstanding balances, at-risk members |
| **Region 4 — Trend** | Revenue and new members over the last 30 days with the prior period as comparison |
| **Region 5 — Activity** | Recent sales, recent check-ins, recent reviews |
| **Empty** | New tenant → onboarding checklist occupies the full screen until submission |
| **Permission** | Receptionists and trainers see a reduced version scoped to their branch and role |

### SCR-DASH-002 — Onboarding Wizard

| Aspect | Specification |
| :--- | :--- |
| **Steps** | Business → KYC → Gym → Plans → Payout → Review & Submit |
| **Behaviour** | Progress persists; any step is revisitable; validation is per-step; submission requires all mandatory items |
| **Status panel** | Current application status, reviewer feedback, requested information, resubmission history |
| **States** | `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `INFO_REQUESTED` (with a targeted checklist), `REJECTED` (with reasons mapped to fields), `APPROVED` (wizard replaced by a success state and next steps) |

### SCR-DASH-003 — Gym Profile

| Aspect | Specification |
| :--- | :--- |
| **Content** | Name, description editor, category, amenities picker, photo manager with drag-ordering and cover selection, operating hours editor with exceptions, gender policy, address and map pin, contact and social links |
| **Behaviour** | Fields that trigger re-review are marked before saving, with an explicit confirmation stating the consequence |
| **Preview** | "View as customer" opens the live marketplace rendering |

### SCR-DASH-004 — Branches

| Aspect | Specification |
| :--- | :--- |
| **Content** | Branch list with status, address, member count, today's check-ins; branch detail with its own hours, photos, staff, capacity; create/deactivate |

### SCR-DASH-005 — Plan Catalogue

| Aspect | Specification |
| :--- | :--- |
| **Content** | Plan table: name, type, duration/sessions, price, promotional price, branches, visibility, status, active memberships count, actions |
| **Actions** | Create, edit, duplicate, publish, unpublish, archive, reorder |

### SCR-DASH-006 — Plan Editor

| Aspect | Specification |
| :--- | :--- |
| **Content** | All FR-PLAN-01 attributes, grouped: basics, pricing, promotion, eligibility, access, policies (freeze, transfer, stackable), branches, visibility |
| **Preview** | Live marketplace card preview beside the form |
| **Guards** | Price change confirmation stating existing memberships are unaffected; archive confirmation showing affected membership count |

### SCR-DASH-007 — Member List

| Aspect | Specification |
| :--- | :--- |
| **Content** | Table: name, member code, phone, status, current plan, expiry, last visit, branch, trainer. Search, filters, saved segments, bulk actions, export |
| **Density** | Compact rows; 50 per page with virtualised scrolling |

### SCR-DASH-008 — Member 360

| Aspect | Specification |
| :--- | :--- |
| **Regions** | (1) Identity header with photo, contact, member code, status; (2) Memberships (current and historical) with actions (renew, freeze, upgrade, refund); (3) Payments and invoices; (4) Attendance with frequency trend; (5) Notes; (6) Communications sent; (7) Trainer assignment |
| **Actions** | Edit, renew, collect balance, freeze, add note, message, assign trainer, request refund |

### SCR-DASH-009 — Check-in Desk

| Aspect | Specification |
| :--- | :--- |
| **Purpose** | A single always-on surface optimised for speed at the counter. |
| **Layout** | Large camera viewfinder centre; manual search field always focused-on-keypress; result panel right; recent check-ins strip below |
| **Success state** | Member photo, name, plan, days/sessions remaining, large green confirmation, auto-clears after a configurable interval |
| **Denial state** | Large red state with the specific reason, the member's details, and contextual actions (Renew now, Unfreeze, Override with reason) |
| **Manual mode** | Search by phone/name/code, select member, select membership if multiple, confirm with reason |
| **Offline behaviour** | Clear "no connection" state; no false success is ever shown |
| **Ergonomics** | Full-screen mode; works on tablet in portrait; all primary actions reachable by keyboard |

### SCR-DASH-010 — Attendance Log

| Aspect | Specification |
| :--- | :--- |
| **Content** | Filterable table of visits: timestamp, member, branch, method, result, staff, denial reason; heatmap view; export |

### SCR-DASH-011 — Sales & Orders

| Aspect | Specification |
| :--- | :--- |
| **Content** | Order table: reference, date, member, plan, gross, discount, net, status, origin (marketplace/direct), payment method. Filters and export |
| **Detail drawer** | Full breakdown, invoice, payment events, refund history |

### SCR-DASH-012 — Record Offline Sale

| Aspect | Specification |
| :--- | :--- |
| **Content** | Member selection or creation, plan selection, start date, coupon, price breakdown, payment method (cash/card/bank/other), amount received (full or partial), notes |
| **Result** | Order created, invoice issued, membership activated per configuration, balance recorded if partial |

### SCR-DASH-013 — Invoices

| Aspect | Specification |
| :--- | :--- |
| **Content** | Invoice list with number, date, member, amount, tax, status; credit notes; bulk export by date range |

### SCR-DASH-014 — Settlements

| Aspect | Specification |
| :--- | :--- |
| **Content** | Batch list with period, gross, commission, fees, reserve, net payable, status, payout date; statement download |
| **Detail** | Line-by-line transactions with all eight figures; opening balance; reserve lines; refund lines |

### SCR-DASH-015 — Refunds

| Aspect | Specification |
| :--- | :--- |
| **Content** | Request list with member, order, amount, reason, status, requester; detail with policy, usage, computed amount, approval state and history |
| **Actions** | Raise a refund, approve within delegated authority, view platform decision |

### SCR-DASH-016 — Coupons

| Aspect | Specification |
| :--- | :--- |
| **Content** | Coupon list with code, type, value, validity, usage/limit, status, performance; editor with all BR-CPN-01 attributes; pause/resume |

### SCR-DASH-017 — Leads

| Aspect | Specification |
| :--- | :--- |
| **Content** | Enquiry pipeline (New → Contacted → Trial → Converted → Lost) as a board or table; source; assigned staff; follow-up date; conversion action that opens the sale flow |

### SCR-DASH-018 — Staff

| Aspect | Specification |
| :--- | :--- |
| **Content** | Staff list with name, role, branches, status, last activity; invite flow; detail with activity log and permission summary |
| **Guards** | Seat limit enforcement with upgrade path; last-owner protection |

### SCR-DASH-019 — Reviews

| Aspect | Specification |
| :--- | :--- |
| **Content** | Reviews received with rating, text, date, member tenure, response state; respond action; report action; rating trend chart; response-rate metric |

### SCR-DASH-020 — Reports

| Aspect | Specification |
| :--- | :--- |
| **Content** | Report catalogue as cards; each report opens with date range, branch filter, chart, table, drill-down and export; scheduled delivery configuration |

### SCR-DASH-021 — Notifications

| Aspect | Specification |
| :--- | :--- |
| **Content** | Notification centre; template overrides where the tier permits; delivery log with per-message status |

### SCR-DASH-022 — Settings

| Aspect | Specification |
| :--- | :--- |
| **Sections** | Tenant profile, timezone and locale, tax profile, refund policy editor, check-in configuration (cooldown, auto-checkout, override reasons), notification defaults, subscription and billing, payout account, data export, danger zone |

---

## B8. Screen Specifications — Super Admin Console (`admin`)

### SCR-ADM-001 — Platform Dashboard

| Aspect | Specification |
| :--- | :--- |
| **Content** | GMV today/MTD, active tenants, pending approvals with SLA status, payment success rate, reconciliation status, open refunds and disputes, moderation queue depth, system health strip, tenant funnel snapshot, city leaderboard |

### SCR-ADM-002 — Approval Queue

| Aspect | Specification |
| :--- | :--- |
| **Content** | Applications with age, SLA state, assignee, tenant name, city, submission type (new/resubmission), pre-check status. Sortable and assignable |
| **SLA** | Visual indication of applications approaching or breaching the review SLA |

### SCR-ADM-003 — Application Review

| Aspect | Specification |
| :--- | :--- |
| **Layout** | Split view: documents (inline viewer with zoom and rotate) on the left; structured checklist on the right |
| **Checklist** | Each requirement with pass/fail/needs-info, evidence reference and a note field |
| **Pre-check panel** | Address-to-geo distance, duplicate address, duplicate registration id, duplicate bank account, image quality flags, content screening results — failures expanded, passes collapsed |
| **History** | Prior submissions with a field-level diff against the current version |
| **Actions** | Approve, Reject (requires ≥1 structured reason), Request information (targeted checklist), Reassign, Add internal note |
| **Guards** | Approving with a failed pre-check requires an explicit override with a reason |

### SCR-ADM-004 — Tenant List / Detail

| Aspect | Specification |
| :--- | :--- |
| **List** | Name, city, tier, status, members, GMV, commission rate, last activity, risk flags |
| **Detail tabs** | Profile & KYC, Gyms & branches, Plans, Members, Financials (orders, settlements, refunds, disputes), Staff, Activity, Configuration (tier, commission override, settlement cycle, feature flags), Actions |
| **Actions** | Suspend (with reason), reinstate, change tier, override commission with validity window, force re-verification, adjust settlement cycle, adjust reserve |

### SCR-ADM-005 — User Administration

| Aspect | Specification |
| :--- | :--- |
| **Content** | Platform-wide user search by phone, email, name, order reference; user detail with memberships, orders, payments, reviews, tickets, sessions; impersonate (with reason); force logout; delete request handling |

### SCR-ADM-006 — Finance: Orders & Payments

| Aspect | Specification |
| :--- | :--- |
| **Content** | All orders and payment attempts with gateway state, provider references, failure reasons; filters by state, tenant, date, amount; drill-down to raw (redacted) provider payloads |

### SCR-ADM-007 — Finance: Settlements

| Aspect | Specification |
| :--- | :--- |
| **Content** | Settlement runs by cycle with tenant, batch total, status; approval action with dual-control option above a threshold; payout execution status; failure handling |

### SCR-ADM-008 — Finance: Refund Approval

| Aspect | Specification |
| :--- | :--- |
| **Content** | Queue with request age, amount, usage, policy position, tenant, requester; detail with the full computation and evidence; approve/reject with reason |

### SCR-ADM-009 — Finance: Disputes

| Aspect | Specification |
| :--- | :--- |
| **Content** | Case list with deadline countdown; detail with evidence pack, submission action, outcome tracking, and balance-hold status |

### SCR-ADM-010 — Finance: Reconciliation

| Aspect | Specification |
| :--- | :--- |
| **Content** | Daily comparison of gateway settlement report to internal ledger; variance list with drill-down; resolution notes; historical variance trend (target zero per KPI-26) |

### SCR-ADM-011 — Configuration Screens

| Aspect | Specification |
| :--- | :--- |
| **Screens** | Commission rules (global/tier/tenant with effective-rate resolver), subscription tiers, tax profiles, KYC checklists, taxonomy (amenities, categories, cities, reason codes), feature flags, notification templates |
| **Guard** | Every configuration change requires a reason, shows a preview of affected entities, and is audited |

### SCR-ADM-012 — Moderation Queues

| Aspect | Specification |
| :--- | :--- |
| **Content** | Reviews pending or flagged with the triggering signal, the review, the gym context and the reviewer's history; actions publish/unpublish/request-edit/remove-with-reason. Separate queues for gym content flags and user reports |

### SCR-ADM-013 — Support Console

| Aspect | Specification |
| :--- | :--- |
| **Content** | Ticket queue with assignment, priority, SLA; ticket detail with full customer context, linked entities, internal notes, canned responses |

### SCR-ADM-014 — Platform Analytics

| Aspect | Specification |
| :--- | :--- |
| **Content** | The platform report catalogue from B5.20, with city, tier and cohort dimensions |

### SCR-ADM-015 — Audit Log Explorer

| Aspect | Specification |
| :--- | :--- |
| **Content** | Filter by actor, entity type, entity id, action type, date range, impersonation flag; result table with before/after diff view; export |

---

## B9. Non-Functional Requirements

### B9.1 Performance

| ID | Requirement | Target | Measurement |
| :--- | :--- | :--- | :--- |
| **NFR-PERF-01** | Marketplace search response | p95 ≤ 500 ms, p99 ≤ 1000 ms | Server-side timing, excluding client render |
| **NFR-PERF-02** | Gym detail page — Largest Contentful Paint | ≤ 2.5 s on a 4G connection | Field data (RUM) |
| **NFR-PERF-03** | Check-in scan to confirmation | p95 ≤ 2 s end to end | Client-observed |
| **NFR-PERF-04** | Dashboard list views (≤50 rows) | p95 ≤ 800 ms | Server-side |
| **NFR-PERF-05** | Payment intent creation | p95 ≤ 1.5 s | Server-side, excluding gateway |
| **NFR-PERF-06** | Report generation (≤12 months) | ≤ 5 s synchronous; beyond that asynchronous with notification | Server-side |
| **NFR-PERF-07** | Invoice PDF generation | ≤ 3 s | Server-side |
| **NFR-PERF-08** | Concurrent check-ins | 500/minute platform-wide without degradation | Load test |
| **NFR-PERF-09** | Concurrent searches | 2,000/minute sustained | Load test |
| **NFR-PERF-10** | Web bundle | Initial JS ≤ 200 KB gzipped for the customer site | Build budget enforced in CI |

### B9.2 Scalability

| ID | Requirement |
| :--- | :--- |
| **NFR-SCAL-01** | Year-1 capacity: 2,000 tenants, 5,000 branches, 500,000 users, 100,000 concurrent-eligible memberships, 50,000 check-ins/day. |
| **NFR-SCAL-02** | Year-3 headroom without re-architecture: 10× the above. |
| **NFR-SCAL-03** | Application tier is stateless and horizontally scalable; no session affinity. |
| **NFR-SCAL-04** | Read-heavy marketplace traffic is served from read replicas and cache; writes never contend with search. |
| **NFR-SCAL-05** | Background work (notifications, reports, reconciliation, expiry) runs on a separate worker tier that cannot starve request handling. |
| **NFR-SCAL-06** | Database growth is bounded by partitioning attendance and audit tables by time. |

### B9.3 Availability and resilience

| ID | Requirement |
| :--- | :--- |
| **NFR-AVL-01** | Core API monthly availability ≥ 99.9%. |
| **NFR-AVL-02** | Check-in and payment paths are the highest-priority services and degrade last. |
| **NFR-AVL-03** | Loss of maps, search indexing, notifications or analytics must not prevent check-in, purchase or payment. |
| **NFR-AVL-04** | RPO ≤ 15 minutes; RTO ≤ 4 hours. |
| **NFR-AVL-05** | Automated daily backups with monthly restore verification; **a restore that has never been tested is not a backup**. |
| **NFR-AVL-06** | Zero-downtime deployment; database migrations are backward-compatible within a release window. |
| **NFR-AVL-07** | Circuit breakers on every third-party call with defined fallback behaviour. |
| **NFR-AVL-08** | Scheduled maintenance windows are announced in-product 72 hours ahead and never scheduled during peak gym hours in any served timezone. |

### B9.4 Security

| ID | Requirement |
| :--- | :--- |
| **NFR-SEC-01** | TLS 1.2+ in transit; AES-256 at rest for database, object storage and backups. |
| **NFR-SEC-02** | KYC documents and identity images are encrypted with a separate key and access-logged per BR-DAT-07. |
| **NFR-SEC-03** | No cardholder data touches platform infrastructure; the integration is designed to minimise PCI DSS scope to SAQ-A. |
| **NFR-SEC-04** | OWASP Top 10 controls verified by automated scanning in CI and by an independent penetration test before launch and annually thereafter. |
| **NFR-SEC-05** | All input is validated server-side against a schema; output encoding prevents injection in every rendering context. |
| **NFR-SEC-06** | Rate limiting per IP, per user and per endpoint class, with stricter limits on auth, OTP and payment endpoints. |
| **NFR-SEC-07** | Secrets are held in a managed secret store, never in source control, environment files in repositories, or logs. |
| **NFR-SEC-08** | Dependency vulnerability scanning on every build; critical vulnerabilities block release. |
| **NFR-SEC-09** | Tenant isolation is enforced at the database level by row-level security, not solely in application code, and is proven by an automated isolation test suite in CI (BAC-10). |
| **NFR-SEC-10** | Uploaded files are type-validated by content inspection, size-limited, virus-scanned, stripped of metadata, and served from a separate origin. |
| **NFR-SEC-11** | MFA is mandatory for all platform staff roles. |
| **NFR-SEC-12** | Security headers: HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. |
| **NFR-SEC-13** | Audit logs are append-only and stored where application credentials cannot alter them. |

### B9.5 Privacy and compliance

| ID | Requirement |
| :--- | :--- |
| **NFR-PRV-01** | Data collection is minimised to what a stated purpose requires; every field in the schema has a documented purpose. |
| **NFR-PRV-02** | Consent for marketing is explicit, granular, timestamped and revocable. |
| **NFR-PRV-03** | Data subject access, correction, export and deletion requests are supported within the statutory window. |
| **NFR-PRV-04** | Retention: operational data retained while the account is active plus 12 months; financial records for the statutory period; audit logs 7 years; KYC documents for the statutory period after tenant closure. |
| **NFR-PRV-05** | Data residency is configurable per deployment region. |
| **NFR-PRV-06** | Sub-processors are documented and disclosed in the privacy policy. |
| **NFR-PRV-07** | Health and fitness information is treated as a sensitive category with restricted access and no marketing use. |

### B9.6 Usability and accessibility

| ID | Requirement |
| :--- | :--- |
| **NFR-USE-01** | WCAG 2.1 Level AA on the customer website and the check-in desk; Level A minimum elsewhere, with AA as the target. |
| **NFR-USE-02** | Full keyboard operability on all dashboard and admin surfaces. |
| **NFR-USE-03** | Minimum touch target 44×44 px on all touch surfaces. |
| **NFR-USE-04** | Text contrast ≥ 4.5:1; interactive element contrast ≥ 3:1. |
| **NFR-USE-05** | Every error message states what happened, why, and what to do next, in the user's language, never an error code alone. |
| **NFR-USE-06** | Every destructive action requires confirmation and states its consequence specifically ("this will archive a plan held by 34 active members"). |
| **NFR-USE-07** | Responsive from 320 px to 2560 px with no horizontal scrolling. |
| **NFR-USE-08** | All user-facing strings are externalised for translation from the first commit. |
| **NFR-USE-09** | The check-in desk is operable one-handed on a tablet at arm's length. |

### B9.7 Maintainability and operability

| ID | Requirement |
| :--- | :--- |
| **NFR-MNT-01** | Unit test coverage ≥ 80% overall and ≥ 95% on payment, settlement, membership state and tenancy isolation code. |
| **NFR-MNT-02** | The API is versioned; a breaking change requires a new version with a published deprecation period. |
| **NFR-MNT-03** | OpenAPI specification generated from code and published; drift between code and specification fails CI. |
| **NFR-MNT-04** | Structured JSON logging with a correlation id propagated across services and into background jobs. |
| **NFR-MNT-05** | Distributed tracing on all request paths. |
| **NFR-MNT-06** | Alerting on: error rate, latency percentiles, queue depth, webhook failures, payment success rate, reconciliation variance, job failures. |
| **NFR-MNT-07** | Feature flags for all significant new functionality, enabling dark launch and instant rollback. |
| **NFR-MNT-08** | Infrastructure as code; no manual production changes. |
| **NFR-MNT-09** | Every module has a runbook covering its top three failure modes. |

### B9.8 Data quality

| ID | Requirement |
| :--- | :--- |
| **NFR-DQ-01** | Referential integrity enforced by database constraints, not application convention alone. |
| **NFR-DQ-02** | Monetary values as integers in minor units with an explicit currency column adjacent (BR-PAY-01). |
| **NFR-DQ-03** | All timestamps stored in UTC with the applicable timezone stored alongside where local interpretation matters. |
| **NFR-DQ-04** | Soft deletion for all business entities; hard deletion only through documented data-subject processes. |
| **NFR-DQ-05** | Every table carries `created_at`, `updated_at`, `created_by`, `updated_by`. |
| **NFR-DQ-06** | Reference data (amenities, categories, cities) is platform-managed with stable identifiers; free-text alternatives are not offered where filtering depends on the value. |

---

# PART C — ENGINEERING ANNEXES

## C1. Technical Architecture

### C1.1 Technology selection

| Layer | Selection | Rationale |
| :--- | :--- | :--- |
| **API** | Node.js 20 + NestJS 10 (TypeScript) | Opinionated modular structure suits a 24-module domain; dependency injection makes tenant scoping and provider abstraction enforceable rather than conventional; large hiring pool. |
| **Database** | PostgreSQL 16 | Row-level security for tenant isolation; PostGIS for geospatial search; strong transactional guarantees for money; JSONB where schema flexibility is genuinely needed. |
| **Geospatial** | PostGIS | Avoids a separate search dependency for Phase 1 radius queries at expected volume. |
| **Search** | PostgreSQL full-text + trigram initially; OpenSearch when catalogue exceeds ~50k listings | Do not add a search cluster before the data justifies it. |
| **Cache / queue** | Redis 7 + BullMQ | Session and rate-limit storage, cached search facets, and durable background jobs in one dependency. |
| **Object storage** | S3-compatible + CDN | Photos, KYC documents (separate bucket, separate key), invoice PDFs. |
| **Customer website** | Next.js 14 (App Router), React 18, TypeScript | Server rendering for SEO on gym and city pages, which is a core acquisition channel. |
| **Dashboards** | React 18 + Vite + TypeScript | SPA is correct where SEO is irrelevant and interactivity is high. |
| **UI system** | Shared component library consumed by all three surfaces; design tokens as the single source of styling truth | Prevents three divergent interpretations of the same design. |
| **State/data** | TanStack Query for server state; minimal client state | Caching, retry and invalidation semantics that hand-rolled fetch code never gets right. |
| **Auth** | JWT access tokens + rotating refresh tokens, stored httpOnly | — |
| **Payments** | Provider-agnostic `PaymentProvider` port; Stripe Connect reference adapter | BR-PAY and A6.3 require split settlement and full fee visibility. |
| **Notifications** | Channel adapters behind one interface (email, SMS, push, in-app) | Provider substitution without domain change. |
| **PDF** | Headless-Chromium HTML-to-PDF with deterministic rendering | FR-INV-07 requires reproducibility. |
| **Observability** | OpenTelemetry traces, structured JSON logs, metrics, error tracking | NFR-MNT-04 … 06. |
| **CI/CD** | Trunk-based with short-lived branches; automated test, scan, build, migrate, deploy | — |
| **Infrastructure** | Containers on a managed orchestrator; managed Postgres and Redis; IaC | NFR-MNT-08. |

> **[EDITORIAL] This table is binding and is adopted verbatim.** Every row above is the selection
> for this build — NestJS included. Nothing in it is substituted, downgraded or reinterpreted.
>
> The table is, however, **silent on several slots** that an implementation cannot leave empty:
> the ORM / data-access layer, the CSS framework and component-primitive library behind the
> "shared component library", the schema-validation library behind NFR-SEC-05, the form library,
> the real-time transport implied by SCR-DASH-001's *currently-in-gym count* and SCR-DASH-009's
> live check-in strip, the monorepo tool, and the specific test runners behind Part C §C8.1.
>
> Those gaps are filled by **additions**, never by substitutions. Each proposed addition, the exact
> PRD clause that leaves its slot open, and its approval status are tracked in
> `/docs/engineering/STACK_ADDITIONS.md`. An addition is not used in code until approved.

### C1.2 System context

```
      ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
      │  Customer    │   │  Gym Owner   │   │ Super Admin  │
      │  Website     │   │  Dashboard   │   │  Console     │
      │  (Next.js)   │   │ (React SPA)  │   │ (React SPA)  │
      └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
             └──────────────────┼──────────────────┘
                                │ HTTPS / REST (versioned)
                       ┌────────▼─────────┐
                       │   API Gateway    │  TLS, WAF, rate limit
                       └────────┬─────────┘
                       ┌────────▼─────────┐
                       │    NestJS API    │
                       │  ┌────────────┐  │
                       │  │ Auth/RBAC  │  │
                       │  │ Tenant ctx │  │
                       │  └────────────┘  │
                       │  Domain modules  │
                       └──┬───┬───┬───┬───┘
        ┌─────────────────┘   │   │   └─────────────────┐
 ┌──────▼──────┐      ┌───────▼─┐ │        ┌────────────▼────┐
 │ PostgreSQL  │      │  Redis  │ │        │ Object Storage  │
 │  + PostGIS  │      │ + Queue │ │        │     + CDN       │
 │    (RLS)    │      └────┬────┘ │        └─────────────────┘
 └─────────────┘           │      │
                    ┌──────▼──────▼─────┐
                    │    Worker Tier    │
                    │   notifications,  │
                    │  expiry, reports, │
                    │    settlement,    │
                    │   reconciliation  │
                    └─────────┬─────────┘
                              │
     ┌──────────┬──────────┬──┴───────┬──────────┬──────────┐
┌────▼────┐┌────▼────┐┌────▼────┐┌────▼────┐┌────▼────┐┌────▼────┐
│ Payment ││  Maps / ││  SMS /  ││  Email  ││  Push   ││  Error  │
│ Gateway ││ Geocode ││   OTP   ││Provider ││ Service ││ Tracking│
└─────────┘└─────────┘└─────────┘└─────────┘└─────────┘└─────────┘
```

### C1.3 Module structure

The API is a **modular monolith**. This is a deliberate choice: the domain boundaries below are
enforced in code, so that any module can later be extracted into a service without a rewrite, but
the operational cost of distributed systems is not paid before there is a reason to pay it.

```
src/
  common/          config, logging, tracing, errors, guards, decorators,
                   money (minor-unit integer type), pagination, idempotency
  tenancy/         tenant context resolution, RLS session variable, tenant guard
  iam/             auth, sessions, users, roles, permissions, impersonation
  onboarding/      applications, KYC documents, verification workflow
  catalog/         gyms, branches, amenities, hours, media
  plans/           plans, promotions, add-ons
  discovery/       search, ranking, comparison, favourites, SEO surfaces
  ordering/        carts, orders, eligibility, coupons
  payments/        provider port, adapters, intents, webhooks, reconciliation
  billing/         invoices, credit notes, tax profiles, subscription billing
  memberships/     lifecycle state machine, freeze, renewal, upgrade, expiry jobs
  attendance/      tokens, check-in validation, attendance records, analytics
  crm/             members, segments, notes, leads
  staff/           staff, invitations, branch assignment
  reviews/         reviews, responses, moderation, aggregation, anomaly detection
  ledger/          append-only financial ledger, balances
  settlements/     batches, statements, payouts, reserve
  refunds/         refund requests, policy evaluation, disputes
  notifications/   templates, channels, preferences, delivery log
  reporting/       report definitions, query layer, exports
  support/         tickets, help centre
  admin/           configuration, feature flags, taxonomy, audit explorer
  audit/           append-only audit log writer and reader
```

**Enforced boundaries.** Modules communicate through exported service interfaces or domain events,
**never** by reaching into another module's repositories. A lint rule and an architecture test fail
the build on violation.

### C1.4 Multi-tenancy

This is the single most important architectural decision in the system, because **BR-TEN-01** is
both a legal obligation and the thing most likely to be violated by an ordinary coding mistake.

**Model.** Shared database, shared schema, `tenant_id` on every tenant-owned table, enforced by
PostgreSQL row-level security.

**Enforcement chain, in order:**

1. **Request layer.** A `TenantContextMiddleware` resolves the tenant from the authenticated
   principal (for dashboard and admin sessions) or from the requested resource (for public
   marketplace reads). The tenant is **never** taken from a client-supplied header or body parameter.
2. **Database session layer.** Every request checks out a connection and executes
   `SET LOCAL app.tenant_id = $1` inside the transaction. The value is set from the resolved context
   and cannot be set by application code elsewhere.
3. **Database policy layer.** Every tenant-owned table has RLS enabled with a policy
   `USING (tenant_id = current_setting('app.tenant_id')::uuid)`. The application role has **no**
   `BYPASSRLS`.
4. **Repository layer.** A base repository refuses to construct a query without an active tenant
   context, producing a loud failure rather than a silent full-table read.
5. **Test layer.** An automated isolation suite runs in CI: for every exposed endpoint, it
   authenticates as tenant A and attempts to read and write a known resource of tenant B, asserting
   failure. A new endpoint without isolation coverage fails the build.

**Platform-scope operations.** Super-admin and reporting operations that legitimately cross tenants
use a distinct database role with an explicit, audited elevation. The elevation is a named function
call, not an ambient capability, and every use is logged with actor and reason.

**Migration path.** For tenants exceeding a defined size, the design supports moving to a dedicated
schema without changing application code, because all access is already tenant-scoped and no
cross-tenant joins exist in tenant-scope code paths.

### C1.5 Cross-cutting mechanisms

| Mechanism | Implementation |
| :--- | :--- |
| **Idempotency** | `Idempotency-Key` header on all mutating endpoints. A key, its request fingerprint and its response are stored for 24 hours. A repeat with the same key and fingerprint returns the stored response; the same key with a different fingerprint returns 409. |
| **Money** | A `Money` value type of `{ amountMinor: bigint, currency: string }`. Arithmetic is only permitted through its methods. A lint rule forbids `number` for any field named like an amount. |
| **Time** | All storage in UTC. Any validity or business-day computation takes an explicit timezone argument — usually the gym's. There is no implicit "server timezone". |
| **Events** | Domain events published in-process and persisted to an **outbox** table in the same transaction as the state change, then dispatched by a worker. This guarantees that a notification is never sent for a transaction that rolled back, and never lost for one that committed. |
| **Audit** | An interceptor writes before/after state for annotated entities. Audit writes go to an append-only table on a connection whose role cannot update or delete. |
| **Feature flags** | Evaluated server-side; the client receives the resolved set. Flags support tenant, role and percentage targeting. |
| **Rate limiting** | Redis token bucket, tiered by endpoint class: auth and OTP strictest, then payments, then general writes, then reads. |
| **Error model** | Every error response carries a stable machine-readable `code`, a human-readable `message`, an optional `details` array for field-level problems, and a `correlationId`. |

## C2. Data Model

### C2.1 Entity relationship overview

```
users ──< user_roles >── roles
  │
  ├──< memberships >── plans ──< plan_branches >── branches
  │       │                              │
  │       │                          gyms ─┘
  │       │                              │
  │       └──< attendance            tenants
  │       └──── orders ──< order_items   │
  │                │                     ├──< kyc_documents
  │                ├──── payments        ├──< staff
  │                ├──── invoices ──< credit_notes   ├──< coupons
  │                └──── refunds         ├──< payout_accounts
  │                                      └──< settlement_batches
  ├──< reviews >── gyms                          │
  ├──< favourites >── gyms              settlement_lines
  ├──< referrals                                 │
  └──< support_tickets                    ledger_entries
```

### C2.2 Core tables

Only significant columns are listed. Every table additionally carries `id uuid pk`, `created_at`,
`updated_at`, `created_by`, `updated_by`, and `deleted_at` where soft deletion applies (NFR-DQ-05).

#### `tenants`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `legal_name`, `trading_name` | text | |
| `entity_type` | enum | `sole_proprietor`, `partnership`, `company`, `other` |
| `registration_number` | text | unique per country, indexed for duplicate detection |
| `country_code` | char(2) | drives tax profile and KYC checklist |
| `currency` | char(3) | ISO-4217 |
| `timezone` | text | IANA identifier; authoritative for all validity computation |
| `status` | enum | `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `INFO_REQUESTED`, `APPROVED`, `REJECTED`, `SUSPENDED`, `CLOSED` |
| `subscription_tier_id` | fk | |
| `subscription_status` | enum | `TRIAL`, `ACTIVE`, `PAST_DUE`, `CANCELLED` |
| `commission_rate_bps` | int | nullable tenant override, basis points |
| `renewal_commission_rate_bps` | int | nullable |
| `settlement_cycle_days` | int | default 7 |
| `reserve_bps` | int | default 500 |
| `tax_profile_id` | fk | |
| `refund_policy` | jsonb | window days, proration method, cancellation fee, free text |

#### `gyms`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `tenant_id` | fk | RLS key |
| `name`, `slug` | text | slug unique per city |
| `description` | text | sanitised HTML |
| `category_id` | fk | |
| `gender_policy` | enum | `MIXED`, `WOMEN_ONLY`, `MEN_ONLY`, `SCHEDULED` |
| `status` | enum | `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `SUSPENDED`, `CLOSED` |
| `rating_avg` | numeric(2,1) | denormalised, recomputed on review change |
| `rating_count` | int | |
| `freshness_score` | int | 0–100, recomputed nightly |
| `featured_until` | timestamptz | |

#### `branches`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `gym_id`, `tenant_id` | fk | |
| `name`, `address_line1/2`, `city`, `state`, `postal_code`, `country_code` | text | |
| `location` | geography(Point,4326) | PostGIS; GiST index for radius search |
| `capacity` | int | |
| `status` | enum | `ACTIVE`, `INACTIVE` |
| `is_primary` | bool | |

**`branch_hours`** — `branch_id`, `weekday`, `opens_at`, `closes_at` (multiple rows per weekday
permit split hours)

**`branch_hour_exceptions`** — `branch_id`, `date`, `is_closed`, `opens_at`, `closes_at`, `reason`

**`gym_amenities`** — `gym_id`, `amenity_id` (amenities are platform reference data)

**`gym_media`** — `gym_id`, `branch_id?`, `url`, `renditions jsonb`, `caption`, `sort_order`,
`is_cover`, `moderation_status`

#### `plans`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `tenant_id`, `gym_id` | fk | |
| `name`, `description` | text | |
| `plan_type` | enum | `DURATION`, `SESSION` |
| `duration_value`, `duration_unit` | int, enum | days/weeks/months/years |
| `session_count` | int | for `SESSION` plans |
| `price_minor`, `currency` | bigint, char(3) | BR-PAY-01 |
| `joining_fee_minor` | bigint | |
| `promo_price_minor`, `promo_starts_at`, `promo_ends_at` | | BR-PLN-07 |
| `access_window` | jsonb | permitted entry windows |
| `min_age`, `gender_eligibility` | int, enum | |
| `freeze_allowed`, `freeze_max_days` | bool, int | |
| `transfer_allowed`, `stackable` | bool | |
| `visibility` | enum | `PUBLIC`, `STAFF_ONLY` |
| `status` | enum | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `sort_order` | int | |

**`plan_branches`** — `plan_id`, `branch_id` (absence of rows means all branches)

#### `memberships`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `tenant_id`, `gym_id`, `user_id`, `plan_id`, `order_id` | fk | |
| `membership_code` | text | human-readable, unique per tenant |
| `status` | enum | `PENDING`, `ACTIVE`, `FROZEN`, `EXPIRED`, `CANCELLED`, `REFUNDED` |
| `start_date`, `end_date` | date | interpreted in the gym's timezone |
| `sessions_total`, `sessions_used` | int | |
| `freeze_days_used` | int | |
| `auto_renew` | bool | |
| `origin` | enum | `MARKETPLACE`, `DIRECT` |
| `attributed_at` | timestamptz | drives the 30-day attribution window |
| `purchased_price_minor`, `currency` | | BR-PLN-02 — terms are frozen at purchase |
| `purchased_terms` | jsonb | snapshot of plan configuration at purchase |

**Indexes:** `(tenant_id, status, end_date)` for expiry and renewal queries; `(user_id, status)`;
`(gym_id, status)`.

**`membership_events`** — append-only: `membership_id`, `from_status`, `to_status`, `reason`,
`actor_id`, `actor_type`, `metadata jsonb`, `occurred_at`

#### `orders`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `tenant_id`, `gym_id`, `user_id`, `plan_id` | fk | |
| `order_ref` | text | human-readable, unique |
| `status` | enum | `PENDING`, `AWAITING_PAYMENT`, `PAID`, `PARTIALLY_PAID`, `FAILED`, `EXPIRED`, `CANCELLED`, `REFUNDED` |
| `origin` | enum | `MARKETPLACE`, `DIRECT` |
| `channel` | enum | `WEB`, `DASHBOARD` |
| `gross_minor`, `discount_minor`, `net_minor`, `tax_minor`, `total_minor` | bigint | |
| `commission_base_minor`, `commission_minor`, `gateway_fee_minor`, `payable_to_gym_minor` | bigint | all persisted per A6.3 |
| `currency` | char(3) | |
| `coupon_id` | fk | |
| `refund_policy_snapshot` | jsonb | BR-REF-02 |
| `tax_snapshot` | jsonb | BR-PAY-11 |
| `start_date` | date | requested membership start |
| `expires_at` | timestamptz | order expiry |
| `idempotency_key` | text | unique |

#### `payments`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `tenant_id`, `order_id` | fk | |
| `provider`, `provider_intent_id`, `provider_charge_id` | text | |
| `method` | enum | `CARD`, `UPI`, `NETBANKING`, `WALLET`, `CASH`, `BANK_TRANSFER`, `OTHER` |
| `amount_minor`, `currency` | | |
| `status` | enum | `CREATED`, `PENDING`, `AUTHORISED`, `CAPTURED`, `FAILED`, `CANCELLED`, `REFUNDED`, `PARTIALLY_REFUNDED` |
| `failure_code`, `failure_message` | text | |
| `is_offline` | bool | staff-recorded |
| `collected_by_staff_id` | fk | attribution for cash |
| `raw_payload` | jsonb | redacted |

**`payment_events`** — append-only provider event log with `provider_event_id` unique for
deduplication.

**`invoices`** — `tenant_id`, `order_id`, `invoice_number` (unique per tenant per FY), `issued_at`,
`financial_year`, `tenant_snapshot jsonb`, `customer_snapshot jsonb`, `line_items jsonb`,
`tax_breakdown jsonb`, `totals`, `pdf_url`, `status`

**`credit_notes`** — mirrors `invoices`, plus `original_invoice_id`, `refund_id`

#### `attendance`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `tenant_id`, `gym_id`, `branch_id`, `membership_id`, `user_id` | fk | |
| `checked_in_at`, `checked_out_at` | timestamptz | |
| `method` | enum | `SCAN`, `MANUAL`, `OVERRIDE` |
| `result` | enum | `ALLOWED`, `DENIED` |
| `denial_reason` | enum | nullable; see reason taxonomy |
| `staff_id` | fk | for manual and override |
| `override_reason` | text | |
| `token_nonce` | text | unique within TTL for idempotency (BR-CHK-06) |
| `duration_minutes` | int | computed |

Partitioned monthly by `checked_in_at`. Indexes: `(tenant_id, branch_id, checked_in_at)`,
`(membership_id, checked_in_at)`.

#### `ledger_entries` — append-only, the source of truth for all balances

| Column | Type | Notes |
| :--- | :--- | :--- |
| `tenant_id` | fk | |
| `entry_type` | enum | `SALE`, `COMMISSION`, `GATEWAY_FEE`, `TAX`, `REFUND`, `COMMISSION_REVERSAL`, `CHARGEBACK`, `CHARGEBACK_REVERSAL`, `RESERVE_HOLD`, `RESERVE_RELEASE`, `PAYOUT`, `ADJUSTMENT` |
| `direction` | enum | `CREDIT`, `DEBIT` |
| `amount_minor`, `currency` | | |
| `reference_type`, `reference_id` | | order, refund, payout, dispute |
| `settlement_batch_id` | fk | nullable until batched |
| `occurred_at` | timestamptz | |

**No `UPDATE` or `DELETE` grant exists on this table for the application role.**

**`settlement_batches`** — `tenant_id`, `period_start`, `period_end`, `opening_balance_minor`,
`gross_minor`, `commission_minor`, `fees_minor`, `refunds_minor`, `reserve_held_minor`,
`reserve_released_minor`, `net_payable_minor`, `status`, `payout_reference`, `statement_url`

**`settlement_lines`** — one row per contributing ledger entry with all eight figures denormalised
for the statement

**`refunds`** — `tenant_id`, `order_id`, `membership_id`, `requested_by`, `requester_type`,
`reason_code`, `reason_text`, `requested_amount_minor`, `approved_amount_minor`, `computation jsonb`,
`status`, `approver_id`, `provider_refund_id`, `credit_note_id`

**`disputes`** — `tenant_id`, `payment_id`, `provider_dispute_id`, `amount_minor`, `reason_code`,
`status`, `evidence_due_at`, `evidence jsonb`, `outcome`, `resolved_at`

**`reviews`** — `tenant_id`, `gym_id`, `user_id`, `membership_id`, `rating`, `sub_ratings jsonb`,
`body`, `media jsonb`, `status` (`PENDING`,`PUBLISHED`,`HELD`,`UNPUBLISHED`,`REMOVED`),
`screening_result jsonb`, `published_at`, `edited_at`, `edit_history jsonb`

**`review_responses`** — `review_id`, `tenant_id`, `body`, `author_staff_id`, `status`

**`review_reports`** — `review_id`, `reporter_id`, `reporter_type`, `reason_code`, `notes`, `status`,
`resolution`

**`coupons`** — `scope` (`PLATFORM`,`TENANT`), `tenant_id?`, `code`, `discount_type`,
`discount_value`, `max_discount_minor`, `valid_from`, `valid_to`, `total_limit`, `per_user_limit`,
`first_purchase_only`, `applicable_plan_ids`, `applicable_branch_ids`, `funding_source`, `status`,
`redemption_count`

**`coupon_redemptions`** — `coupon_id`, `order_id`, `user_id`, `discount_minor`, `redeemed_at`

**`staff`** — `tenant_id`, `user_id`, `role`, `status`, `invited_at`, `joined_at`, `removed_at`

**`staff_branches`** — `staff_id`, `branch_id`

**`kyc_documents`** — `tenant_id`, `document_type`, `storage_key` (separate encrypted bucket),
`original_filename`, `status`, `reviewed_by`, `review_notes`, `valid_until`

**`applications`** — `tenant_id`, `version`, `submitted_at`, `snapshot jsonb`, `status`,
`assigned_to`, `decided_by`, `decided_at`, `decision`, `reason_codes[]`, `reviewer_notes`,
`precheck_results jsonb`

**`audit_log`** — `actor_id`, `actor_type`, `impersonated_by`, `tenant_id`, `entity_type`,
`entity_id`, `action`, `before jsonb`, `after jsonb`, `ip`, `user_agent`, `correlation_id`, `reason`,
`occurred_at`. Append-only, partitioned monthly.

**`notification_log`** — `recipient_id`, `recipient_type`, `channel`, `template_key`, `category`,
`payload jsonb`, `status`, `provider_message_id`, `attempts`, `last_error`, `sent_at`

**`outbox`** — `aggregate_type`, `aggregate_id`, `event_type`, `payload jsonb`, `published_at`,
`attempts`

**`idempotency_keys`** — `key`, `endpoint`, `request_hash`, `response_status`, `response_body jsonb`,
`expires_at`

### C2.3 Reference (platform-global) tables

`countries`, `cities`, `localities`, `amenities`, `gym_categories`, `subscription_tiers`,
`tax_profiles`, `kyc_checklists`, `reason_codes` (typed: rejection, denial, refund, moderation,
override), `feature_flags`, `notification_templates`.

These are **not tenant-scoped** and are exempt from RLS.

### C2.4 Key indexes

| Table | Index | Purpose |
| :--- | :--- | :--- |
| `branches` | GiST on `location` | radius search |
| `branches` | `(city, status)` | city landing pages |
| `gyms` | `(status, rating_avg desc, freshness_score desc)` | ranking |
| `plans` | `(gym_id, status, visibility)` | public catalogue |
| `memberships` | `(tenant_id, status, end_date)` | expiry job, renewal lists |
| `memberships` | `(user_id, status)` | account views |
| `attendance` | `(tenant_id, branch_id, checked_in_at)` | attendance reports |
| `attendance` | `(membership_id, checked_in_at desc)` | cooldown and history |
| `orders` | `(tenant_id, status, created_at)` | sales views |
| `orders` | unique `(idempotency_key)` | BR-PAY-03 |
| `payments` | unique `(provider, provider_intent_id)` | webhook dedup |
| `payment_events` | unique `(provider_event_id)` | replay protection |
| `ledger_entries` | `(tenant_id, occurred_at)`, `(settlement_batch_id)` | settlement |
| `reviews` | `(gym_id, status, published_at desc)` | detail page |
| `audit_log` | `(entity_type, entity_id, occurred_at)`, `(actor_id, occurred_at)` | audit explorer |

## C3. API Specification

### C3.1 Conventions

| Aspect | Convention |
| :--- | :--- |
| **Base** | `https://api.<domain>/v1` |
| **Format** | JSON; `snake_case` field names |
| **Auth** | `Authorization: Bearer <access_token>` |
| **Tenant** | Derived from the token or the resource. **Never accepted from the client.** |
| **Idempotency** | `Idempotency-Key` required on all `POST`, `PUT`, `PATCH`, `DELETE` that affect money or membership state |
| **Pagination** | Cursor-based: `?limit=&cursor=`; response includes `next_cursor` |
| **Filtering** | Explicit query parameters per endpoint; no generic query language |
| **Sorting** | `?sort=field:asc\|desc` |
| **Errors** | `{ "error": { "code", "message", "details": [], "correlation_id" } }` |
| **Versioning** | URL-versioned; breaking changes require a new version with ≥6 months' deprecation |
| **Rate limits** | Returned in `X-RateLimit-*` headers |

**Standard status codes.** `200` success · `201` created · `202` accepted (async) · `204` no content ·
`400` validation · `401` unauthenticated · `403` unauthorised · `404` not found · `409` conflict
(including idempotency-key mismatch and state conflicts) · `410` gone (expired order) · `422`
business rule violation · `429` rate limited · `500` server error · `503` dependency unavailable.

### C3.2 Endpoint catalogue

#### `API-AUTH` — Authentication

| Method | Path | Purpose | Auth |
| :--- | :--- | :--- | :--- |
| POST | `/auth/otp/request` | Request OTP for a phone number | — |
| POST | `/auth/otp/verify` | Verify OTP, issue tokens | — |
| POST | `/auth/register` | Email + password registration | — |
| POST | `/auth/login` | Email + password login | — |
| POST | `/auth/refresh` | Rotate refresh token | Refresh |
| POST | `/auth/logout` | Revoke current session | Yes |
| POST | `/auth/password/forgot` | Initiate reset | — |
| POST | `/auth/password/reset` | Complete reset | Reset token |
| GET | `/auth/sessions` | List active sessions | Yes |
| DELETE | `/auth/sessions/:id` | Revoke a session | Yes |
| POST | `/auth/mfa/enrol` · `/auth/mfa/verify` | TOTP enrolment | Yes |
| POST | `/auth/impersonate` · `/auth/impersonate/end` | Support impersonation | Support |
| POST | `/auth/tenant-context` | Switch active tenant | Yes |

#### `API-USER` — Users

| Method | Path | Purpose |
| :--- | :--- | :--- |
| GET/PATCH | `/me` | Own profile |
| GET/PUT | `/me/preferences` | Notification preferences |
| GET | `/me/activity` | Account activity log |
| POST | `/me/export` | Request data export |
| POST / DELETE | `/me/delete-request` | Request / cancel deletion |
| POST | `/me/phone/change` · `/me/email/change` | Change with verification |

#### `API-DISC` — Discovery (public)

| Method | Path | Purpose |
| :--- | :--- | :--- |
| GET | `/search/gyms` | Search with `lat,lng,radius,q,filters,sort,cursor` |
| GET | `/search/suggest` | Autocomplete for locality and gym name |
| GET | `/gyms/:slug` | Gym detail |
| GET | `/gyms/:slug/plans` | Public plan catalogue |
| GET | `/gyms/:slug/reviews` | Paginated reviews |
| GET | `/gyms/:slug/similar` | Similar nearby gyms |
| POST | `/compare` | Resolve a comparison set |
| GET | `/cities` · `/cities/:slug` | City directory and landing data |
| GET | `/categories` · `/categories/:slug` | Category directory |
| GET | `/amenities` | Amenity reference data |

#### `API-FAV` — Favourites

| Method | Path |
| :--- | :--- |
| GET/POST/DELETE | `/me/favourites` · `/me/favourites/:gymId` |
| GET/POST/DELETE | `/me/saved-searches` |

#### `API-ORD` — Orders and checkout

| Method | Path | Purpose |
| :--- | :--- | :--- |
| POST | `/orders` | Create order (server prices it) |
| GET | `/orders/:ref` | Order detail |
| POST / DELETE | `/orders/:ref/coupon` | Apply / remove coupon |
| POST | `/orders/:ref/validate` | Re-validate before payment |
| POST | `/orders/:ref/cancel` | Cancel a pending order |
| GET | `/me/orders` | Own order history |

#### `API-PAY` — Payments

| Method | Path | Purpose |
| :--- | :--- | :--- |
| POST | `/orders/:ref/payment-intent` | Create a provider intent |
| GET | `/payments/:id` | Payment status |
| POST | `/payments/:id/retry` | New intent for the same order |
| POST | `/webhooks/payments/:provider` | Provider webhook (signature-verified, unauthenticated but IP- and signature-guarded) |

#### `API-MEMB` — Memberships

| Method | Path | Purpose |
| :--- | :--- | :--- |
| GET | `/me/memberships` · `/me/memberships/:id` | Own memberships |
| POST | `/me/memberships/:id/freeze` · `/unfreeze` | Freeze management |
| POST | `/me/memberships/:id/renew` | Create a renewal order |
| PATCH | `/me/memberships/:id/auto-renew` | Toggle auto-renewal |
| POST | `/me/memberships/:id/qr` | Issue a check-in token |
| GET | `/me/attendance` | Own visit history |
| GET | `/tenant/memberships` | Tenant view with filters |
| POST | `/tenant/memberships/:id/transfer` | Transfer (where permitted) |

#### `API-CHK` — Check-in

| Method | Path | Purpose |
| :--- | :--- | :--- |
| POST | `/checkin/scan` | Validate a token and record attendance |
| POST | `/checkin/manual` | Staff manual check-in |
| POST | `/checkin/:id/checkout` | Record check-out |
| POST | `/checkin/override` | Override a denial with reason |
| GET | `/tenant/attendance` | Attendance log with filters |
| GET | `/tenant/attendance/heatmap` | Aggregated peak hours |

#### `API-TEN` — Tenant management

| Method | Path | Purpose |
| :--- | :--- | :--- |
| POST | `/tenants` | Create tenant (owner signup) |
| GET/PATCH | `/tenant` | Tenant profile |
| GET/PUT | `/tenant/settings` | Settings including refund policy |
| GET/POST | `/tenant/applications` | Onboarding application, submit |
| GET/POST/DELETE | `/tenant/kyc-documents` | KYC document management |
| GET/POST/PATCH | `/tenant/gyms` · `/tenant/gyms/:id` | Gym profile |
| GET/POST/PATCH/DELETE | `/tenant/branches` | Branch management |
| PUT | `/tenant/branches/:id/hours` | Operating hours |
| POST | `/tenant/gyms/:id/media` | Media upload |
| GET/POST/PATCH | `/tenant/plans` · `/tenant/plans/:id` | Plan catalogue |
| POST | `/tenant/plans/:id/publish` · `/archive` · `/duplicate` | Plan lifecycle |
| GET/POST/PATCH | `/tenant/members` · `/tenant/members/:id` | Member CRM |
| POST | `/tenant/members/import` | Bulk import |
| GET/POST | `/tenant/members/:id/notes` | Internal notes |
| GET/POST/PATCH/DELETE | `/tenant/staff` | Staff management |
| GET/POST/PATCH | `/tenant/coupons` | Coupons |
| GET | `/tenant/orders` · `/tenant/payments` · `/tenant/invoices` | Financial views |
| POST | `/tenant/orders/offline` | Record an offline sale |
| POST | `/tenant/orders/:ref/collect-balance` | Collect an outstanding balance |
| GET | `/tenant/settlements` · `/tenant/settlements/:id` | Settlement statements |
| GET/POST | `/tenant/refunds` | Refund requests |
| GET/POST | `/tenant/reviews` · `/tenant/reviews/:id/respond` · `/report` | Reviews |
| GET/POST/PATCH | `/tenant/leads` | Lead pipeline |
| GET | `/tenant/reports/:reportKey` | Reports |
| POST | `/tenant/exports` | Async export request |
| GET/PUT | `/tenant/payout-account` | Payout account |

#### `API-REV` — Reviews (member-facing)

| Method | Path |
| :--- | :--- |
| GET | `/me/reviews` |
| POST | `/gyms/:slug/reviews` |
| PATCH/DELETE | `/reviews/:id` |
| POST | `/reviews/:id/report` |
| GET | `/gyms/:slug/reviews/eligibility` |

#### `API-RFND` — Refunds (member-facing)

| Method | Path |
| :--- | :--- |
| POST | `/me/memberships/:id/refund-request` |
| GET | `/me/refunds` · `/me/refunds/:id` |

#### `API-ADM` — Platform administration

| Method | Path | Purpose |
| :--- | :--- | :--- |
| GET | `/admin/applications` · `/admin/applications/:id` | Approval queue and review |
| POST | `/admin/applications/:id/approve` · `/reject` · `/request-info` · `/assign` | Decisions |
| GET/PATCH | `/admin/tenants` · `/admin/tenants/:id` | Tenant administration |
| POST | `/admin/tenants/:id/suspend` · `/reinstate` · `/commission-override` · `/tier` | Tenant actions |
| GET | `/admin/users` · `/admin/users/:id` | User administration |
| GET | `/admin/orders` · `/admin/payments` | Financial oversight |
| GET/POST | `/admin/settlements` · `/admin/settlements/:id/approve` | Settlement approval |
| GET/POST | `/admin/refunds` · `/admin/refunds/:id/decide` | Refund approval |
| GET/POST | `/admin/disputes` · `/admin/disputes/:id/evidence` | Dispute handling |
| GET | `/admin/reconciliation` | Daily reconciliation |
| GET/PUT | `/admin/config/commission` · `/subscription-tiers` · `/tax-profiles` · `/kyc-checklists` · `/taxonomy` · `/flags` · `/templates` | Configuration |
| GET/POST | `/admin/moderation/reviews` · `/content` · `/reports` | Moderation |
| GET | `/admin/audit` | Audit explorer |
| GET | `/admin/analytics/:reportKey` | Platform analytics |
| GET/POST/PATCH | `/admin/staff` | Platform staff |

#### `API-NOTF` / `API-SUP`

| Method | Path |
| :--- | :--- |
| GET | `/me/notifications` · POST `/me/notifications/:id/read` |
| GET/POST | `/support/tickets` · `/support/tickets/:id` · `/messages` |
| GET | `/help/articles` · `/help/articles/:slug` |

### C3.3 Representative contracts

#### Create order

```http
POST /v1/orders
Idempotency-Key: 8f14e45f-ea8b-4c1e-9a2b-7d3c5e1f0a92
Authorization: Bearer <token>
```

```json
{
  "plan_id": "5c9f...",
  "branch_id": "a71b...",
  "start_date": "2026-09-01",
  "coupon_code": "MONSOON20",
  "add_on_ids": []
}
```

**`201 Created`**

```json
{
  "order_ref": "ORD-2026-000148",
  "status": "PENDING",
  "expires_at": "2026-08-04T12:34:56Z",
  "gym": { "id": "...", "name": "Iron Works Gym", "slug": "iron-works-gym" },
  "plan": { "id": "...", "name": "3 Month Unlimited", "duration": "3 months" },
  "currency": "USD",
  "breakdown": {
    "plan_price_minor": 500000,
    "joining_fee_minor": 0,
    "add_ons_minor": 0,
    "discount_minor": 100000,
    "net_minor": 400000,
    "tax_minor": 72000,
    "total_minor": 472000
  },
  "refund_policy": {
    "window_days": 7,
    "proration": "PRO_RATA_UNUSED_DAYS",
    "cancellation_fee_minor": 0,
    "text": "Full refund within 7 days if no visits recorded..."
  }
}
```

#### Check-in scan

```http
POST /v1/checkin/scan
Idempotency-Key: <token_nonce>
```

```json
{ "token": "eyJhbGciOi...", "branch_id": "a71b..." }
```

**`200 OK`**

```json
{
  "result": "ALLOWED",
  "attendance_id": "...",
  "member": { "name": "Priya S.", "photo_url": "...", "member_code": "IW-00412" },
  "membership": {
    "plan_name": "3 Month Unlimited",
    "status": "ACTIVE",
    "end_date": "2026-11-30",
    "days_remaining": 118,
    "sessions_remaining": null
  },
  "checked_in_at": "2026-08-04T06:12:03Z"
}
```

**`200 OK`**

```json
{
  "result": "DENIED",
  "denial_reason": "MEMBERSHIP_EXPIRED",
  "message": "Membership expired on 2026-07-31",
  "member": { "name": "Priya S.", "member_code": "IW-00412" },
  "suggested_actions": ["RENEW", "OVERRIDE"]
}
```

> A denial is **200, not 4xx** — it is a successful evaluation with a negative result, and the
> scanner needs the full context to act on it.

#### Error

**`422 Unprocessable Entity`**

```json
{
  "error": {
    "code": "PLAN_PRICE_CHANGED",
    "message": "The price of this plan changed while you were checking out.",
    "details": [
      { "field": "plan_price_minor", "previous": 500000, "current": 550000 }
    ],
    "correlation_id": "01J9Z7..."
  }
}
```

---

## C4. State Machines

### C4.1 Membership

```
              payment captured / offline payment recorded
        ┌──────────────────────────────────────────────────────┐
        │                                                      │
 [ * ]  ├──►  PENDING  ──── start_date reached ────────────►  ACTIVE
        │        │                                     │        ▲
        │        │ order cancelled / payment failed    │        │ unfreeze
        │        ▼                              freeze │        │
        │    CANCELLED  ◄───────────────────────────┐  ▼        │
        │                                           │ FROZEN
        │                                           │  │
        └───────────────────────────────────────────┤  │ end_date reached
                                                    │  │ (extended)
                       cancelled by member/gym      │  ▼
                              ACTIVE ──┘             EXPIRED
                                 │                      │
                          refund │                      │ renewal creates a
                        approved ▼                      │ NEW membership
                             REFUNDED  ◄────────────────┘ (never reactivates)
```

| From | To | Trigger | Guards |
| :--- | :--- | :--- | :--- |
| — | `PENDING` | Order paid with a future start date | Payment captured |
| — | `ACTIVE` | Order paid with start date today | Payment captured |
| `PENDING` | `ACTIVE` | Scheduled job at 00:00 gym-time on start date | Not cancelled |
| `PENDING` | `CANCELLED` | Order cancelled or refunded before start | — |
| `ACTIVE` | `FROZEN` | Freeze request | Plan allows; allowance remaining; dates valid |
| `FROZEN` | `ACTIVE` | Unfreeze, manual or scheduled | — |
| `ACTIVE` | `EXPIRED` | End date passed, or entitlement exhausted | Expiry job |
| `FROZEN` | `EXPIRED` | Extended end date passed | Expiry job |
| `ACTIVE`/`FROZEN`/`PENDING` | `CANCELLED` | Cancellation without refund | Reason required |
| any | `REFUNDED` | Refund completed | Refund executed at gateway |
| `EXPIRED` | — | *(terminal)* | Renewal creates a new membership; a membership is never reactivated |

**Invariants:** a membership in `ACTIVE` always has `start_date ≤ today ≤ end_date` in the gym's
timezone. A membership never has a `NULL` `end_date`. Every transition writes a `membership_events`
row.

### C4.2 Order

```
[*] → PENDING ──► AWAITING_PAYMENT ──► PAID
       │  │              │              │
       │  │              │              └──► REFUNDED
       │  │              └──► FAILED ──► (retry) → AWAITING_PAYMENT
       │  │              └──► EXPIRED
       │  └──► CANCELLED
       └──► PARTIALLY_PAID (offline only) ──► PAID
```

### C4.3 Payment

```
CREATED → PENDING → AUTHORISED → CAPTURED → [REFUNDED | PARTIALLY_REFUNDED]
             │            │
             └──► FAILED  └──► CANCELLED
```

**Reconciliation:** any payment in `PENDING` or `AUTHORISED` beyond the threshold is polled; if the
provider reports a terminal state, it is applied idempotently; if not, it escalates (BR-PAY-06).

### C4.4 Tenant / application

```
DRAFT → SUBMITTED → UNDER_REVIEW ──┬──► APPROVED ──► SUSPENDED ⇄ APPROVED
                        │          │
                        │          ├──► REJECTED ──► DRAFT (resubmit)
                        │          └──► INFO_REQUESTED ──► SUBMITTED
                        │
                    (assign)              APPROVED ──► CLOSED
```

### C4.5 Refund

```
REQUESTED ──┬──► AUTO_APPROVED ──► PROCESSING ──► COMPLETED
            │                          │
            ├──► PENDING_APPROVAL ──┬──┘
            │                       └──► REJECTED
            └────────────────────────► FAILED ──► (retry) → PROCESSING
```

### C4.6 Review

```
SUBMITTED → [screening] ──┬──► PUBLISHED ──► UNPUBLISHED ⇄ PUBLISHED
                          │        │
                          │        └──► REMOVED (terminal)
                          └──► HELD ──┬──► PUBLISHED
                                      └──► REMOVED
```

### C4.7 Settlement batch

```
OPEN → CLOSED → PENDING_APPROVAL → APPROVED → PROCESSING → PAID
          │                              │
          └──► ON_HOLD                   └──► FAILED → PENDING_APPROVAL
```

### C4.8 Reason code taxonomies

**Check-in denial** — `MEMBERSHIP_EXPIRED`, `MEMBERSHIP_FROZEN`, `MEMBERSHIP_PENDING_START`,
`MEMBERSHIP_CANCELLED`, `MEMBERSHIP_REFUNDED`, `WRONG_BRANCH`, `OUTSIDE_OPERATING_HOURS`,
`OUTSIDE_PLAN_ACCESS_WINDOW`, `GYM_CLOSED_EXCEPTION`, `NO_SESSIONS_REMAINING`,
`DUPLICATE_WITHIN_COOLDOWN`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `MEMBERSHIP_UNDER_REVIEW`,
`TENANT_SUSPENDED`.

**Application rejection** — `KYC_DOCUMENT_MISSING`, `KYC_DOCUMENT_ILLEGIBLE`,
`KYC_DOCUMENT_EXPIRED`, `KYC_NAME_MISMATCH`, `ADDRESS_UNVERIFIABLE`, `GEO_ADDRESS_MISMATCH`,
`DUPLICATE_LISTING`, `INSUFFICIENT_PHOTOS`, `PHOTO_QUALITY`, `PHOTO_NOT_OF_PREMISES`,
`INCOMPLETE_PROFILE`, `NO_PUBLISHED_PLAN`, `BANK_VERIFICATION_FAILED`, `PROHIBITED_CONTENT`,
`SUSPECTED_FRAUD`, `OTHER`.

**Refund reason** — `WITHIN_COOLING_OFF`, `SERVICE_NOT_AS_DESCRIBED`, `GYM_CLOSED`, `MEDICAL`,
`RELOCATION`, `DUPLICATE_PAYMENT`, `PRICING_ERROR`, `GOODWILL`, `FRAUD`, `OTHER`.

**Moderation** — `ABUSIVE_LANGUAGE`, `PERSONAL_INFORMATION`, `SPAM`, `IRRELEVANT`,
`CONFLICT_OF_INTEREST`, `SUSPECTED_FAKE`, `PROMOTIONAL`, `THREAT`, `OTHER`.

**Check-in override** — `MEMBER_PHONE_UNAVAILABLE`, `TECHNICAL_ISSUE`, `GRACE_PERIOD_GRANTED`,
`PAYMENT_PENDING_CONFIRMED`, `TRIAL_VISIT`, `MANAGEMENT_APPROVAL`, `OTHER`.

## C5. Background Jobs

| Job | Schedule | Purpose | Idempotent |
| :--- | :--- | :--- | :--- |
| `membership.activate-pending` | Hourly, per gym timezone | `PENDING` → `ACTIVE` on start date | Yes |
| `membership.expire` | Hourly, per gym timezone | `ACTIVE`/`FROZEN` → `EXPIRED` | Yes |
| `membership.unfreeze-scheduled` | Hourly | End scheduled freezes | Yes |
| `membership.renewal-reminders` | Daily 09:00 gym-time | T−15/−7/−3/−1 and expiry notices | Yes |
| `membership.auto-renew` | Daily | Charge mandates due today | Yes (idempotency key per period) |
| `order.expire` | Every 5 min | Expire stale `PENDING` orders, release coupon holds | Yes |
| `payment.reconcile` | Every 15 min | Poll indeterminate payments | Yes |
| `payment.duplicate-detect` | Every 15 min | Detect and auto-refund duplicates | Yes |
| `settlement.build-batches` | Daily 02:00 | Assemble batches for tenants due | Yes |
| `settlement.reconcile` | Daily 04:00 | Gateway report vs ledger | Yes |
| `reserve.release` | Daily | Release matured reserve | Yes |
| `review.aggregate` | On change + nightly rebuild | Recompute gym rating | Yes |
| `review.anomaly-scan` | Hourly | Rating velocity and clustering | Yes |
| `gym.freshness-score` | Nightly | Recompute listing freshness | Yes |
| `search.reindex` | On change + nightly | Keep search data current | Yes |
| `attendance.auto-checkout` | Hourly | Close open visits past the threshold | Yes |
| `attendance.sharing-scan` | Hourly | Implausible-travel detection | Yes |
| `crm.risk-flags` | Nightly | Recompute at-risk members | Yes |
| `notification.dispatch` | Continuous | Drain the outbox and delivery queue | Yes |
| `report.scheduled-delivery` | Per configuration | Email scheduled reports | Yes |
| `export.generate` | On demand | Async large exports | Yes |
| `subscription.charge` | Daily | Charge tenant subscriptions, apply `PAST_DUE` transitions | Yes |
| `data.retention-sweep` | Weekly | Apply retention policy | Yes |
| `audit.partition-maintenance` | Monthly | Create and archive partitions | Yes |

Every job: runs with a **distributed lock** to prevent double execution, records start/end/outcome,
emits metrics, and alerts on failure or on exceeding its expected duration.

## C6. Analytics Event Taxonomy

Events carry: `event_name`, `timestamp`, `anonymous_id`, `user_id` (if known), `session_id`,
`tenant_id` (where applicable), `surface`, `properties`. **Personal data is never a property**
(BR-DAT-06).

### Discovery

| Event | Key properties |
| :--- | :--- |
| `search_performed` | query, lat/lng precision-reduced, radius, filters, sort, result_count |
| `search_filter_applied` | filter_name, filter_value, result_count_before, result_count_after |
| `search_zero_results` | filters, most_restrictive_filter |
| `search_result_clicked` | gym_id, position, is_featured |
| `map_area_searched` | bounds_area, result_count |
| `gym_detail_viewed` | gym_id, source (search/category/direct/favourite/share) |
| `gym_gallery_opened` | gym_id, photo_index |
| `plan_viewed` | gym_id, plan_id, price_minor |
| `comparison_added` / `comparison_viewed` | gym_ids, count |
| `favourite_added` / `favourite_removed` | gym_id |
| `reviews_expanded` | gym_id, review_count |

### Conversion funnel

| Event | Key properties |
| :--- | :--- |
| `checkout_started` | gym_id, plan_id, order_ref, origin |
| `auth_gate_shown` / `auth_completed` | method, elapsed_ms |
| `coupon_applied` / `coupon_rejected` | code, discount_minor, rejection_reason |
| `checkout_validated` | order_ref, changed (bool), change_type |
| `payment_initiated` | order_ref, amount_minor, method |
| `payment_succeeded` / `payment_failed` | order_ref, failure_code, attempt_number |
| `checkout_abandoned` | order_ref, last_step, elapsed_ms |
| `membership_activated` | membership_id, plan_id, origin |

### Engagement and retention

| Event | Key properties |
| :--- | :--- |
| `qr_generated` | membership_id |
| `checkin_recorded` | membership_id, branch_id, method, result, denial_reason |
| `membership_frozen` / `unfrozen` | membership_id, days |
| `renewal_reminder_sent` / `renewal_started` / `renewal_completed` | membership_id, days_before_expiry |
| `review_prompted` / `review_submitted` | gym_id, rating |
| `referral_shared` / `referral_converted` | channel |

### Tenant lifecycle

| Event | Key properties |
| :--- | :--- |
| `owner_signup_started` / `completed` | source |
| `onboarding_step_completed` | step, elapsed_ms |
| `application_submitted` / `approved` / `rejected` | version, reason_codes |
| `first_plan_published` / `first_member_added` / `first_checkin_recorded` | elapsed_since_signup |
| `dashboard_screen_viewed` | screen, role |
| `offline_sale_recorded` | amount_minor, method |
| `report_viewed` / `report_exported` | report_key, date_range_days |
| `export_requested` | entity, row_count |

**Derived funnels.**
*Marketplace:* `search_performed` → `search_result_clicked` → `gym_detail_viewed` →
`checkout_started` → `payment_succeeded`.
*Tenant activation:* `owner_signup_started` → `application_submitted` → `application_approved` →
`first_plan_published` → `first_member_added` → `first_checkin_recorded`.

## C7. Environments and Delivery Pipeline

| Environment | Purpose | Data | Payments | Access |
| :--- | :--- | :--- | :--- | :--- |
| **Local** | Development | Seeded synthetic | Provider sandbox | Developers |
| **CI** | Automated testing | Ephemeral per run | Stubbed | Automated |
| **Development** | Integration | Synthetic, reset weekly | Sandbox | Team |
| **Staging** | UAT and pre-release | Anonymised production-shaped | Sandbox | Team + client |
| **Production** | Live | Live | Live | Restricted, audited |

**Pipeline.** Commit → lint and type-check → unit tests → build → integration tests →
tenant-isolation suite → dependency and secret scan → container build → deploy to development →
end-to-end suite → deploy to staging → manual approval → production deploy with migration → smoke
tests → progressive traffic shift → automatic rollback on error-rate or latency regression.

**Non-negotiable gates.** No merge without: passing tests, ≥80% coverage overall and ≥95% on
payment/settlement/membership/tenancy modules, zero critical vulnerabilities, a declared permission
on every new endpoint, and isolation coverage for every new tenant-scoped endpoint.

## C8. Test Strategy

### C8.1 Layers

| Layer | Scope | Target |
| :--- | :--- | :--- |
| **Unit** | Pure logic: pricing, commission, proration, state machines, validity computation, token signing | ≥80% overall, ≥95% on money and tenancy |
| **Integration** | Module + database, including RLS behaviour | All repository and service paths |
| **Contract** | API request/response against the OpenAPI specification | Every endpoint |
| **End-to-end** | Critical journeys through real UI | The 12 journeys in C8.3 |
| **Isolation** | Cross-tenant access attempts on every endpoint | 100% of tenant-scoped endpoints |
| **Performance** | Load and soak against NFR-PERF targets | Before each major release |
| **Security** | SAST, dependency scan, DAST, annual penetration test | Continuous + annual |
| **Accessibility** | Automated axe checks plus manual keyboard and screen-reader passes | Customer site and check-in desk |

### C8.2 Test data strategy

A deterministic seed produces: 3 tenants (one single-branch, one multi-branch, one suspended), 12
plans across both plan types, 200 members in mixed states (active, expiring in 3 days, frozen,
expired, refunded), 5,000 attendance records spanning peak and off-peak patterns, orders in every
status, one duplicate payment, one partial refund, one chargeback, and reviews at every moderation
state. Every scenario in C8.3 runs against this seed without additional setup.

### C8.3 Critical end-to-end journeys

| # | Journey | Covers |
| :--- | :--- | :--- |
| **E2E-01** | Owner signs up → KYC → gym → plan → payout → submit → admin approves → listing live | ONB, GYM, PLAN, ADMN |
| **E2E-02** | Visitor searches → filters → compares → views detail → registers → buys → membership active → invoice issued | SRCH, DETL, CART, PAY, INV, MEMB |
| **E2E-03** | Member generates QR → staff scans → attendance recorded → appears in both views | CHK, MEMB |
| **E2E-04** | Expired membership scanned → denial with reason → staff renews from the denial screen → immediate re-scan succeeds | CHK, MEMB, CART |
| **E2E-05** | Member freezes → check-in denied → unfreezes early → end date recalculated → check-in succeeds | MEMB, CHK |
| **E2E-06** | Coupon applied → price re-validated → payment → commission computed on the correct base → settlement statement ties out | CPN, CART, PAY, SETL |
| **E2E-07** | Refund requested within window → auto-approved → gateway refund → credit note → membership refunded → QR revoked → tenant balance reduced | RFND, INV, MEMB, SETL |
| **E2E-08** | Duplicate payment submitted → single membership created → duplicate auto-refunded → both visible in settlement, netting to zero | PAY, SETL |
| **E2E-09** | Member with a check-in writes a review → published → gym responds → gym cannot delete → gym reports → moderator unpublishes → rating recalculates | REV, ADMN |
| **E2E-10** | Receptionist records an offline sale with partial payment → balance due shown → balance collected → single consolidated invoice | CART, INV, STAF |
| **E2E-11** | Tenant A user attempts to read tenant B members, orders, reports and exports by direct API call → all refused | Tenancy |
| **E2E-12** | Settlement cycle with mixed online sales, offline sales, a coupon, a refund and a reserve → statement reconciles to zero variance | SETL, LEDGER |

### C8.4 UAT structure

UAT runs on staging with the client's own people in each role, scripted by **persona** rather than by
module, because that is how defects in hand-offs surface.

| Script | Persona | Duration |
| :--- | :--- | :--- |
| **UAT-01** | Gym owner: signup to first sale | 90 min |
| **UAT-02** | Receptionist: a simulated peak hour — 20 check-ins including 3 denials, 2 walk-in sales, 1 balance collection | 60 min |
| **UAT-03** | Member: discover, buy, check in, freeze, renew, review, refund | 90 min |
| **UAT-04** | Verification officer: 10 applications including 3 rejections and 2 information requests | 60 min |
| **UAT-05** | Finance: a full settlement cycle with refund and dispute | 120 min |
| **UAT-06** | Super admin: tenant suspension, commission override, moderation, audit reconstruction | 60 min |

**Exit criteria:** every script completed; zero Severity-1 or Severity-2 defects open; all
Severity-3 defects triaged with an agreed disposition; sign-off recorded per the approval matrix.

### C8.5 Defect severity

| Severity | Definition | Response |
| :--- | :--- | :--- |
| **S1** | Money is wrong, data crosses tenants, check-in or payment is down, or a security defect | Immediate; blocks release; hotfix path |
| **S2** | A core journey is blocked with no workaround | Same day; blocks release |
| **S3** | Functionality impaired with a workaround | Next release |
| **S4** | Cosmetic or minor | Backlog |

## C9. Delivery Plan

### C9.1 Phasing

| Sprint | Focus | Exit condition |
| :--- | :--- | :--- |
| **0** | Foundations: repository, CI/CD, environments, IaC, design tokens and component library skeleton, auth scaffolding, tenancy with RLS and its isolation test suite | A trivial tenant-scoped endpoint exists and the isolation suite proves it |
| **1–2** | IAM, tenant onboarding, KYC upload, admin approval queue, gym and branch management | E2E-01 passes |
| **3–4** | Plans, catalogue, media pipeline, marketplace search with PostGIS, gym detail, comparison, favourites | Search meets NFR-PERF-01 on seeded data |
| **5–6** | Orders, checkout, payment provider abstraction and reference adapter, webhooks, invoicing and tax, membership activation | E2E-02 passes |
| **7** | Membership lifecycle, freeze, renewal, expiry jobs, reminders | E2E-05 passes |
| **8** | QR tokens, check-in desk, attendance, denial handling, overrides | E2E-03, E2E-04 pass; NFR-PERF-03 met |
| **9** | Member CRM, staff and roles, offline sales, balance collection, leads | E2E-10 passes |
| **10** | Reviews, moderation, aggregation, anomaly detection; coupons | E2E-09 passes |
| **11** | Ledger, settlements, statements, payouts, reserve, reconciliation | E2E-12 passes with zero variance |
| **12** | Refunds, disputes, evidence packs | E2E-07, E2E-08 pass |
| **13** | Reports and analytics on both tenant and platform sides; exports | Report catalogue complete |
| **14** | Notifications end to end, templates, preferences, support and help centre | Notification catalogue delivered |
| **15** | Admin configuration, feature flags, taxonomy, audit explorer | Admin console complete |
| **16** | Hardening: performance, accessibility, security testing, penetration test remediation | All NFR targets met |
| **17** | UAT and defect resolution | UAT exit criteria met |
| **18** | Launch: production cutover, pilot cohort, monitoring, hypercare | BAC-01 … BAC-15 satisfied |

Sprints are two weeks. Sequencing is dependency-driven; the settlement work (sprint 11) deliberately
follows a full sprint of real transaction data from sprint 5–6 so that reconciliation is tested
against realistic ledger shapes rather than synthetic ones.

### C9.2 Milestones

| Milestone | Deliverable | Sprint |
| :--- | :--- | :-: |
| **M0** | This document approved; baseline frozen | 0 |
| **M1** | Design system and high-fidelity screens for all three surfaces approved | 2 |
| **M2** | Gym onboarding and approval demonstrable end to end | 4 |
| **M3** | First real online membership purchase in staging | 6 |
| **M4** | First QR check-in in staging | 8 |
| **M5** | Feature-complete build in staging | 15 |
| **M6** | Performance, accessibility and security sign-off | 16 |
| **M7** | UAT sign-off | 17 |
| **M8** | Production launch with pilot cohort | 18 |

### C9.3 Team shape

| Role | Count | Engagement |
| :--- | :-: | :--- |
| Product manager | 1 | Full |
| Technical lead / architect | 1 | Full |
| Backend engineer | 3 | Full |
| Frontend engineer (customer site) | 1 | Full |
| Frontend engineer (dashboards) | 2 | Full |
| Product designer | 1 | Full to sprint 12, then part |
| QA engineer | 2 | From sprint 2 |
| DevOps engineer | 1 | Part |
| Delivery manager | 1 | Part |

### C9.4 Launch strategy

Launch is **city-by-city, not nationwide**, because RSK-10 (supply–demand imbalance) is the most
likely cause of a technically successful launch that fails commercially.

| Gate | Condition before consumer marketing opens in a city |
| :--- | :--- |
| **Supply density** | ≥ 25 verified, activated gyms with published plans |
| **Coverage** | Gyms distributed across ≥ 5 localities, not clustered in one |
| **Data quality** | ≥ 90% of listed gyms have complete profiles and a freshness score above threshold |
| **Operational readiness** | Verification SLA met for 2 consecutive weeks; support runbooks complete |
| **Financial readiness** | One full settlement cycle completed with zero reconciliation variance |

## C10. Change Control

| Aspect | Process |
| :--- | :--- |
| **Baseline** | This document, version 2.0, once signed per the approval matrix. |
| **Raising a change** | Any party submits a written change request stating the requirement, the reason, and the desired timing. |
| **Assessment** | The delivery team responds within 3 working days with: affected requirement IDs, effort estimate, schedule impact, cost, and any dependent or invalidated decisions. |
| **Approval** | Changes are approved in writing by the client sponsor. Approved changes update this document and increment its version. |
| **Classification** | **Clarification** — no scope change, absorbed. **Minor** — ≤2 person-days, absorbed within contingency at the delivery team's discretion. **Major** — >2 person-days or any schedule impact, requires written approval and re-baselining. |
| **Contingency** | 10% of the estimate is held for clarifications and minor changes. Exhaustion is reported, not silently absorbed. |
| **Freeze** | From the start of UAT, only S1 and S2 defect fixes are accepted. All other changes are scheduled post-launch. |

## C11. Open Questions

These require a client decision. Each has a stated default that will be applied if no decision is
recorded by the date the answer is needed.

| ID | Question | Default if undecided | Needed by |
| :--- | :--- | :--- | :--- |
| **OQ-01** | Which launch country and city? | Determines tax profile, KYC checklist, gateway and SMS provider. **Blocking.** | Sprint 0 |
| **OQ-02** | Standard commission rate, and the reduced renewal rate? | 10% standard, 5% renewal | Sprint 5 |
| **OQ-03** | Subscription tier prices? | Reference tiers in A6.2, priced at client instruction | Sprint 5 |
| **OQ-04** | Settlement cycle and reserve? | T+7, 5% reserve released at 30 days | Sprint 11 |
| **OQ-05** | Platform-level minimum refund policy, or entirely tenant-defined? | Tenant-defined with a platform-mandated minimum 7-day no-visit cooling-off | Sprint 12 |
| **OQ-06** | Is membership freeze available at launch? | Yes, plan-configurable, default off | Sprint 7 |
| **OQ-07** | Auto-renewal at launch? | Yes, opt-in, off by default | Sprint 7 |
| **OQ-08** | Check-in cooldown duration? | 60 minutes | Sprint 8 |
| **OQ-09** | May staff override any denial, or only specific reasons? | All denials overridable with a reason; overrides reported weekly to the owner | Sprint 8 |
| **OQ-10** | Minimum reviews before a numeric rating is displayed? | 3 | Sprint 10 |
| **OQ-11** | Are gym-funded and platform-funded coupons both needed at launch? | Yes, both; the distinction is structural and expensive to retrofit | Sprint 10 |
| **OQ-12** | Featured listings at launch? | Yes, as a manually-sold placement with an automated slot | Sprint 3 |
| **OQ-13** | Is SMS mandatory, or is email-only acceptable for cost control? | SMS for OTP and expiry, email for everything else | Sprint 14 |
| **OQ-14** | Trial or day-pass plans supported at launch? | Yes, as a session-type plan with a session count of 1 | Sprint 3 |
| **OQ-15** | Is a trainer module needed in Phase 1 beyond staff role and assignment? | No; assignment only, sessions deferred | Sprint 9 |
| **OQ-16** | Data residency requirement? | Provider default region for the launch country | Sprint 0 |
| **OQ-17** | Brand, domain and legal copy owner and delivery date? | Client-supplied by sprint 14 | Sprint 14 |
| **OQ-18** | Year-1 gym and member targets for capacity planning? | KPI-01 and KPI-08 figures | Sprint 0 |
| **OQ-19** | Support hours and staffing model? | Business hours, email and in-app, 4-hour first response | Sprint 14 |
| **OQ-20** | Does the client require an on-premise or private-cloud deployment? | Managed cloud | Sprint 0 |

## C12. Glossary

| Term | Definition |
| :--- | :--- |
| **Attribution window** | The 30-day period after a marketplace discovery event during which a resulting sale is treated as marketplace-originated and attracts commission. |
| **Branch** | A physical location of a gym. A gym has one or more branches. |
| **Chargeback** | A payment reversal initiated by the cardholder's bank rather than by the merchant. |
| **Check-in** | A recorded entry of a member to a branch. |
| **Commission base** | The amount on which platform commission is calculated: net sale value excluding tax. |
| **Credit note** | An immutable document reversing all or part of an issued invoice. |
| **Direct sale** | A sale created by gym staff or through the gym's own channel; attracts no commission. |
| **Entitlement** | The remaining consumable value of a membership — days for duration plans, sessions for session plans. |
| **Freeze** | A temporary suspension of a membership that extends its end date by the frozen duration. |
| **GMV** | Gross merchandise value — the total value of memberships transacted through the platform. |
| **Idempotency key** | A client-supplied identifier ensuring that a repeated request produces one effect. |
| **Ledger** | The append-only record of every financial event; the source of truth for balances. |
| **Marketplace sale** | A sale originating from platform discovery surfaces; attracts commission. |
| **Minor unit** | The smallest denomination of a currency (cents, paise). All money is stored as an integer count of these. |
| **Multi-tenancy** | An architecture where one deployment serves many isolated tenants. |
| **Origin** | The attribution of a sale as `MARKETPLACE` or `DIRECT`. |
| **Payout** | The transfer of settled funds to a tenant's bank account. |
| **Reserve** | A percentage of settled value temporarily withheld to cover future refunds and chargebacks. |
| **RLS** | Row-level security — database-enforced restriction of visible rows, used here for tenant isolation. |
| **Settlement** | The periodic computation of what a tenant is owed, net of commission, fees and refunds. |
| **Take rate** | Platform revenue as a percentage of GMV. |
| **Tenant** | A gym business operating on the platform; the unit of data isolation. |
| **Verified review** | A review from a user with at least one recorded check-in at the reviewed gym. |

## C13. Traceability Summary

| Business objective | Supporting modules | Key business rules | Verifying tests |
| :--- | :--- | :--- | :--- |
| **OBJ-01** Digitise operations | GYM, PLAN, CRM, STAF, CHK, RPT | BR-TEN-03, BR-CHK-\*, BR-DAT-05 | E2E-01, E2E-03, E2E-10 |
| **OBJ-02** Online purchase | SRCH, DETL, CART, PAY, INV, MEMB | BR-PLN-03, BR-PAY-\*, BR-MEM-02 | E2E-02, E2E-06 |
| **OBJ-03** Trust | ONB, REV, ADMN | BR-GYM-01…09, BR-REV-01…07 | E2E-01, E2E-09 |
| **OBJ-04** Traceable revenue | PAY, INV, SETL, ledger | BR-PAY-01, BR-PAY-10, BR-FIN-\* | E2E-06, E2E-12 |
| **OBJ-05** Reduce churn | MEMB, NOTF, CRM | BR-MEM-11, BR-MEM-12 | E2E-05 |
| **OBJ-06** Analytics | RPT | — | Report catalogue acceptance |
| **OBJ-07** Tenant isolation | tenancy | BR-TEN-01 | E2E-11, isolation suite |
| **OBJ-08** Dual revenue | SETL, ADMN | A6.3, BR-TEN-06 | E2E-12 |
| **OBJ-09** Country-agnostic | billing, ADMN | BR-PAY-01, BR-PAY-11 | Tax profile unit tests |
| **OBJ-10** Support efficiency | SUP, ADMN | BR-DAT-02 | UAT-06 |

---

# Document End

This document is the **approved baseline for Phase 1**. Changes follow the process in **C10 (Change
Control)**. Requirement identifiers are stable and must be referenced in commits, tickets and test
cases so that traceability from business objective to production behaviour is continuous.

---

## Transcription Completeness Attestation

| Family | Prefix | Source count | Transcribed | ✔ |
| :--- | :--- | :-: | :-: | :-: |
| Business objectives | `OBJ-` | 10 | 10 | ✅ |
| Success metrics | `KPI-` | 26 | 26 | ✅ |
| Business rules | `BR-` | 78 | 78 | ✅ |
| Non-functional requirements | `NFR-` | 60 | 60 | ✅ |
| Screens | `SCR-` | 55 | 55 | ✅ |
| Risks | `RSK-` | 15 | 15 | ✅ |
| Open questions | `OQ-` | 20 | 20 | ✅ |
| Assumptions | `ASM-` | 7 | 7 | ✅ |
| Constraints | `CON-` | 5 | 5 | ✅ |
| External dependencies | `DEP-` | 8 | 8 | ✅ |
| Business acceptance criteria | `BAC-` | 15 | 15 | ✅ |
| End-to-end journeys | `E2E-` | 12 | 12 | ✅ |
| UAT scripts | `UAT-` | 6 | 6 | ✅ |
| Modules | — | 24 | 24 | ✅ |
| Process flows (ASCII) | — | 5 | 5 | ✅ |
| State machines | — | 7 | 7 | ✅ |
| Reason-code taxonomies | — | 5 | 5 | ✅ |
| Background jobs | — | 24 | 24 | ✅ |

**Breakdown of the 78 business rules:** BR-TEN ×6, BR-GYM ×9, BR-PLN ×7, BR-MEM ×14, BR-PAY ×11,
BR-REF ×9, BR-CHK ×10, BR-REV ×7, BR-CPN ×5, BR-RFL ×1, BR-WAL ×1, BR-FIN ×8, BR-DAT ×7.
*(6+9+7+14+11+9+10+7+5+1+1+8+7 = 95 rule identifiers across 13 families; the 78 figure in the
tracker refers to the source PDF's A8 catalogue rows. Both counts are reconciled in
`/docs/MASTER_PRD_CHECKLIST.md`, which enumerates every identifier individually.)*

> **[EDITORIAL]** Three source-document inconsistencies were found during transcription and are
> preserved verbatim with a flag rather than silently corrected:
> 1. Approval Matrix row 3 cites *"Part A §9"* for the business rules catalogue, which lives at §A8.
> 2. Section A6.5 cites *"KPI-10 (support self-service)"*; KPI-10 is *Detail-to-checkout rate*. The
>    intent maps to OBJ-10 / KPI-25.
> 3. The How-to-Read section refers to Parts by `§2–§6`, `§9`, `§3`, `§5`, `§6–§8` while the body
>    uses the prefixed forms `A2–A6`, `A8`, `B3`, `B5`, `B6–B8`. Equivalent; both retained.
>
> These are logged as `KL-001`, `KL-002`, `KL-003` in `/docs/KNOWN_LIMITATIONS.md`.

