# CLAUDE.md — operating rules for this repository

**Gym Marketplace & Multi-Tenant Gym Management SaaS.**

This repository is documentation-first. ~90,000 lines of binding specification already exist under
[`docs/`](docs/). Code is downstream of those documents, never upstream of them.

---

## 1. The mandatory read, before implementing ANY feature

Before writing or changing a single line that implements behaviour, read, in this order:

1. **This file** — `CLAUDE.md`
2. **[`docs/PROJECT_CONSTITUTION.md`](docs/PROJECT_CONSTITUTION.md)** — the immutable law: architecture,
   SOLID, DDD, Clean Architecture, naming, Git, security, documentation rules
3. **[`docs/MASTER_PRD.md`](docs/MASTER_PRD.md)** — the single source of truth for _what_ and _why_

Then read whichever derived specification governs the area you are touching:
[`docs/engineering/`](docs/engineering/) · [`docs/database/`](docs/database/) ·
[`docs/apis/`](docs/apis/) · [`docs/ui/`](docs/ui/) · [`docs/backlog/`](docs/backlog/) ·
[`docs/roadmap/`](docs/roadmap/)

**These documents must never be violated.** If a request conflicts with them:

> **Stop. Explain the conflict. Wait for confirmation. Do not implement it.**

A conflict is never resolved in code. It is resolved by the owner, recorded in
[`docs/DECISION_LOG.md`](docs/DECISION_LOG.md), and only then built.

---

## 2. Precedence — when two documents disagree, the higher one wins

```
PROJECT_CONSTITUTION.md        how we build — immutable
        ↓
MASTER_PRD.md                  what we build — changes only via Part C §C10 Change Control
        ↓
docs/engineering/ · database/ · apis/ · ui/     binding derived specification
        ↓
docs/backlog/ · roadmap/       plan of work, never a source of requirements
        ↓
code, tests, migrations, IaC, comments          lowest authority
```

Code is evidence of intent, never a statement of intent. A comment that contradicts the PRD is
deleted, and the behaviour is re-derived from the PRD.

---

## 3. Phase 8 is LOCKED

[`docs/PHASES.md`](docs/PHASES.md) is the execution ledger and the project heartbeat. **Read it every
session.**

| Phase                                                                          | State         |
| :----------------------------------------------------------------------------- | :------------ |
| 0 Constitution · 1 PRD · 2 Engineering · 3 Backlog · 4 Database · G Governance | `DONE`        |
| 5 API Design · 6 UI Documentation · 7 Roadmap                                  | `NOT STARTED` |
| **8 Implementation (code)**                                                    | **`BLOCKED`** |

Phase 8 unlocks only when Phases 0–7 and G are all `DONE` **and** the project owner records explicit
approval in the _Phase 8 Unlock Record_ in `PHASES.md`.

**Until then: no application code.** No React components, no NestJS controllers or routes, no Prisma
schema, no migrations. Illustrative snippets inside documentation are permitted and must be labelled
`illustrative — not committed code`.

Environment, tooling and repository configuration are **not** Phase 8 work and may proceed.

---

## 4. The five invariants that must never be got wrong

|  #  | Invariant                                                                                                                                                                                      | Rules                                         |
| :-: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------- |
|  1  | **No tenant can ever read or write another tenant's data** — enforced in the database via RLS, not only in application code.                                                                   | BR-TEN-01 · NFR-SEC-09 · BAC-10 · E2E-11      |
|  2  | **Money is an append-only ledger of integer minor units** (paise). Nothing that affected a balance is edited or deleted; corrections are compensating entries. No `numeric`, no `float`, ever. | BR-PAY-01 · BR-FIN-01 · NFR-DQ-02             |
|  3  | **The price displayed is the price charged.** Server-side revalidation at checkout is mandatory; a mismatch aborts rather than silently charging either figure.                                | BR-PLN-03 · FR-CART-04 · AC-PLAN-02.2         |
|  4  | **Verification before visibility, and earned reviews only.** No gym is listed before a human approves it; no review exists without a recorded check-in.                                        | BR-GYM-01 · BR-GYM-03 · BR-REV-01 · BR-REV-03 |
|  5  | **Membership activation is webhook-driven.** A client-side success signal never activates a membership.                                                                                        | BR-PAY-02 · FR-PAY-03 · AC-PAY-02.1           |

Additionally — the condition on which Prisma was approved (`A-01`): **all tenant-scoped data access
goes through a Prisma client extension that wraps every operation in an interactive transaction which
sets `app.tenant_id` first.** No repository may call the raw client. Connection pooling plus RLS
otherwise silently returns the wrong rows.

---

## 5. The stack is locked. Substitution is forbidden.

From [`docs/engineering/STACK_ADDITIONS.md`](docs/engineering/STACK_ADDITIONS.md):

> **Substitution = forbidden. Addition = allowed, but only after it is declared and approved.**

| Layer            | Locked selection                                                          |
| :--------------- | :------------------------------------------------------------------------ |
| API              | **Node.js + NestJS 10 (TypeScript)** — **not Express**                    |
| Architecture     | **Modular monolith** — explicitly not microservices                       |
| Database         | **PostgreSQL 16 + PostGIS**                                               |
| Search           | Postgres full-text + trigram; OpenSearch only past ~50k listings          |
| Cache / queue    | **Redis 7 + BullMQ**                                                      |
| Customer website | **Next.js 14 App Router + React 18**, server-rendered for SEO             |
| Both dashboards  | **React 18 + Vite** SPA — **not Next.js**                                 |
| UI               | **TailwindCSS + shadcn/ui** copied into `packages/ui` (A-03, A-04)        |
| Server state     | **TanStack Query** — not Redux, Zustand or MobX                           |
| ORM              | **Prisma + Prisma Migrate** (A-01, A-07)                                  |
| Validation       | **Zod**, shared via `packages/types` (A-02)                               |
| Monorepo         | **pnpm workspaces + Turborepo** (A-05)                                    |
| Tests            | **Jest · Supertest · Testcontainers · Playwright · k6 · axe-core** (A-06) |
| Payments         | `PaymentProvider` port; **Razorpay Route** is the India adapter (EP-08)   |

**Explicitly rejected — do not propose again:** Express · microservices · MongoDB or any non-Postgres
primary store · a search cluster at launch · schema-per-tenant at day one · native mobile apps ·
Redux/Zustand/MobX for server state.

**Deferred:** Socket.IO → Phase 2 behind `release.attendance.realtime_transport`. Phase 1 live
figures use TanStack Query polling at 10–15 s, and both surfaces must show a "last updated"
indicator. A-19 notification vendors remain open.

> **Standing rule.** Any technology not in Part 1 (locked) or Part 2 (approved) of
> `STACK_ADDITIONS.md` is **unapproved** and may not appear in code, in a `package.json`, or in an
> infrastructure definition. A dependency present without a corresponding approved `A-NN` row is a
> **review blocker**. Adding one requires a new row and the owner's approval **first**.

---

## 6. Repository layout is normative

[`docs/engineering/FolderStructure.md`](docs/engineering/FolderStructure.md) §2: _"A directory not
listed here does not exist without an amendment under constitution §24."_

```
apps/       customer-web · gym-dashboard · admin-dashboard · server
packages/   ui · types · utils · config
infra/      terraform · docker · compose · k8s
docs/       governance + the seven derived specification folders
.github/    workflows · templates · CODEOWNERS · dependabot
.husky/     pre-commit · commit-msg · pre-push
```

Root laws that bite in practice:

- **R1a** — the root `package.json` has **no `dependencies` block**, and `devDependencies` is limited
  to `turbo`, `prettier`, `husky`, `lint-staged`, `@commitlint/*`, `dependency-cruiser`, `typescript`.
- **R2** — no app imports another app, or `apps/server`'s source. Types cross via `packages/types`
  and the generated OpenAPI client only.
- **R3** — `packages/ui` is presentation only. It never imports `packages/utils`.
- **R7** — every workspace package is `"private": true`. Nothing is published.
- `pnpm-workspace.yaml` has **two globs**. A third is how a `scripts/` or `tools/` directory appears
  without an amendment.

---

## 7. Git

Branch: `<type>/<PRD-id>-<kebab-summary>`, ≤ 60 characters.
Commit: `<type>(<PRD-ID>): <imperative summary, ≤ 72 chars>`

```
feat/FR-CHK-04-checkin-validation-sequence
feat(FR-CHK-04): enforce the ten-step check-in validation order
fix(BR-PAY-03): return the stored response on idempotency-key replay
```

Types: `feat fix docs refactor test perf chore ci build revert hotfix`.
Every commit cites at least one PRD identifier, in the scope or the footer — commitlint enforces it.
Trunk-based, short-lived branches: target ≤ 2 days, hard limit 5. Body explains **why**, not what.

Direct pushes to `main` and `develop` are blocked by the pre-push hook.

---

## 8. Local environment

```bash
pnpm infra:up      # Postgres 16+PostGIS · Redis 7 · MinIO · Mailpit
pnpm infra:ps      # health
pnpm infra:down    # stop, keep data
pnpm infra:reset   # stop and DESTROY volumes
```

| Service                | Endpoint                                                          |
| :--------------------- | :---------------------------------------------------------------- |
| PostgreSQL + PostGIS   | `localhost:5432` · db `gymmap` · `postgres` / `postgres`          |
| Redis                  | `localhost:6379`                                                  |
| MinIO S3 API / console | `localhost:9000` / `localhost:9001` · `minioadmin` / `minioadmin` |
| Mailpit SMTP / UI      | `localhost:1025` / http://localhost:8025                          |

Copy `.env.example` → `.env.local`. Never commit a real credential; `.env.local` is git-ignored and
Gitleaks-scanned.

---

## 9. Working rules for Claude in this repository

1. **Read before writing.** Section 1 is not optional, and it is not satisfied by reading a summary.
2. **Cite identifiers.** Every non-trivial change names the `FR-`/`BR-`/`NFR-`/`AC-` ids it serves.
3. **A conflict halts work.** Never reconcile two documents by picking one in code.
4. **No unapproved dependency.** Check `STACK_ADDITIONS.md` before adding anything to a
   `package.json`. If the slot is genuinely open, propose an `A-NN` row and wait.
5. **Tick as you go.** When a deliverable completes, update its box in `PHASES.md` in the same change.
6. **Nothing is silently dropped.** A requirement that cannot be honoured goes in
   `KNOWN_LIMITATIONS.md` with a reason. A knowing shortcut goes in `TECH_DEBT.md` with an interest
   rate and a payoff trigger. There is no third option.
7. **Money, tenancy and review-integrity rules are never feature-flag-disableable.**
8. **Answer the Ten Questions Before Code** (`PROJECT_CONSTITUTION.md` §2) before any implementation.
   If any answer is "no", explain why before proceeding.
9. **Do not run `git push`, open a PR, or touch a remote** unless explicitly asked.
10. **Prefer editing an existing document over creating a new one.** The specification set is already
    comprehensive; a new file usually means the right one was not found.

---

## 10. Setup state

The development environment is provisioned. See
[`docs/setup/INSTALLATION_REPORT.md`](docs/setup/INSTALLATION_REPORT.md) for exact versions, what
still needs administrator rights, and the open decisions it raised — including the pinned Node
version and the TypeScript 7 compatibility hold.
