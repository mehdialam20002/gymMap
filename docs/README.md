# Documentation Index

**Gym Marketplace & Multi-Tenant Gym Management SaaS**

Everything about this project lives here. Code is downstream of these documents, never upstream of
them.

---

## Read these first, in this order

| # | Document | What it is | When you read it |
| :-: | :--- | :--- | :--- |
| 1 | [PROJECT_CONSTITUTION.md](PROJECT_CONSTITUTION.md) | The immutable law: architecture rules, SOLID, DDD, Clean Architecture, naming, Git, security, documentation. | Before your first commit, and again before any architectural change. |
| 2 | [MASTER_PRD.md](MASTER_PRD.md) | The single source of truth. Complete transcription of the client BRD/PRD v2.0. | Before implementing anything. Every feature must comply. |
| 3 | [MASTER_PRD_CHECKLIST.md](MASTER_PRD_CHECKLIST.md) | Every requirement as a tickable item with traceability. | To find what is done and what is not. |
| 4 | [PHASES.md](PHASES.md) | The execution ledger. Phase status, deliverables, gates, blockers. | Every session. This is the project heartbeat. |

---

## Precedence order

When two documents disagree, the higher one wins:

```
PROJECT_CONSTITUTION.md        (how we build — immutable)
        ↓
MASTER_PRD.md                  (what we build — changes only via C10 Change Control)
        ↓
docs/engineering/ · database/ · apis/ · ui/     (design detail)
        ↓
docs/backlog/ · roadmap/       (sequencing)
        ↓
code and code comments
```

**A conflict halts work.** Do not resolve it in code. Raise it, record the resolution in
[DECISION_LOG.md](DECISION_LOG.md), and only then proceed.

---

## Directory map

| Path | Contents | Phase |
| :--- | :--- | :-: |
| [`docs/`](.) | Constitution, PRD, checklist, phase tracker, living documents | 0–1, G |
| [`docs/engineering/`](engineering/) | Architecture, folder structure, module dependency, ERD, API catalogue, business rules, sequence diagrams, state machines, sprint planning, risk, testing, deployment, monitoring, CI/CD, security, scalability | 2 |
| [`docs/engineering/phase-0/`](engineering/phase-0/) | The consolidated 20-section engineering plan | 0 |
| [`docs/backlog/`](backlog/) | Epics → features → user stories → technical tasks | 3 |
| [`docs/database/`](database/) | ERD, schema, indexes, constraints, relationships, naming, migration, seed, soft delete, audit | 4 |
| [`docs/apis/`](apis/) | Endpoint-by-endpoint API contracts | 5 |
| [`docs/ui/`](ui/) | Screen specifications for all three surfaces, design system, accessibility, responsive behaviour | 6 |
| [`docs/roadmap/`](roadmap/) | 100+ implementation milestones of 2–6 hours each | 7 |
| [`docs/features/`](features/) | One file per shipped feature: business rules, database, API, flow, future improvements | 8 |
| [`docs/adr/`](adr/) | Individual architecture decision records, if any grow beyond the log | ongoing |

---

## Living documents

These are never "finished". Each declares its own update trigger.

| Document | Update trigger |
| :--- | :--- |
| [DECISION_LOG.md](DECISION_LOG.md) | Any architectural or technology decision, including reversals. |
| [CHANGELOG.md](CHANGELOG.md) | Every release, and every user-visible change within it. |
| [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) | Any deliberate gap between what was asked for and what was built. |
| [TECH_DEBT.md](TECH_DEBT.md) | Any knowing shortcut. No shortcut may be taken without an entry. |
| [FEATURE_FLAGS.md](FEATURE_FLAGS.md) | Any flag created, defaulted-on, or retired. |

---

## The product in one paragraph

Two halves of one product. A **management system** an independent gym runs its business on —
members, plans, payments, attendance, staff, renewals, reporting. And a **marketplace** where
consumers discover, compare and buy memberships at those same gyms online. The management system
produces trustworthy operational data, which makes the marketplace credible; the marketplace
produces paying customers, which makes the gym tolerate the management system. Revenue comes from a
SaaS subscription charged to the gym and a commission on marketplace-originated sales, each
independently tunable per tenant.

**Phase 1 ships three web surfaces on one multi-tenant API:** the customer marketplace website
(`web`), the gym owner dashboard (`dash`), and the super-admin console (`admin`).

---

## The five things that must never be got wrong

These are the load-bearing walls. Everything else is negotiable; these are not.

| # | Invariant | Governing rules |
| :-: | :--- | :--- |
| 1 | **No tenant can ever read or write another tenant's data** — enforced in the database, not only in application code. | BR-TEN-01 · NFR-SEC-09 · BAC-10 · E2E-11 |
| 2 | **Money is an append-only ledger of integer minor units.** Nothing that affected a balance is ever edited or deleted; corrections are compensating entries. | BR-PAY-01 · BR-FIN-01 · NFR-DQ-02 |
| 3 | **The price displayed is the price charged.** Server-side re-validation at checkout is mandatory; a mismatch aborts rather than silently charging either figure. | BR-PLN-03 · FR-CART-04 · AC-PLAN-02.2 |
| 4 | **Verification before visibility, and earned reviews only.** No gym is listed before a human approves it; no review exists without a recorded check-in. | BR-GYM-01 · BR-GYM-03 · BR-REV-01 · BR-REV-03 |
| 5 | **Membership activation is webhook-driven.** A client-side success signal never activates a membership. | BR-PAY-02 · FR-PAY-03 · AC-PAY-02.1 |

---

## Before you write any code

Answer the **Ten Questions Before Code** in
[PROJECT_CONSTITUTION.md](PROJECT_CONSTITUTION.md). If the answer to any is "no", explain why before
writing the code.

Then confirm the work does not conflict with the PRD. **If it conflicts: stop, explain the conflict,
and wait for confirmation.** Do not implement it.
