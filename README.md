# GYM MAP

**Gym Marketplace & Multi-Tenant Gym Management SaaS.**

Two halves of one product. A **management system** an independent gym runs its business on — members,
plans, payments, attendance, staff, renewals, reporting. And a **marketplace** where consumers
discover, compare and buy memberships at those same gyms online. The management system produces
trustworthy operational data, which makes the marketplace credible; the marketplace produces paying
customers, which makes the gym tolerate the management system.

Revenue comes from a SaaS subscription charged to the gym and a commission on marketplace-originated
sales, each independently tunable per tenant. Launch market: **India**.

---

## This repository is documentation-first

~90,000 lines of binding specification live under [`docs/`](docs/). **Code is downstream of those
documents, never upstream of them.** Start at [`docs/README.md`](docs/README.md).

| Read                                                           | What it is                                 |
| :------------------------------------------------------------- | :----------------------------------------- |
| [`CLAUDE.md`](CLAUDE.md)                                       | Operating rules for this repository        |
| [`docs/PROJECT_CONSTITUTION.md`](docs/PROJECT_CONSTITUTION.md) | The immutable law — how we build           |
| [`docs/MASTER_PRD.md`](docs/MASTER_PRD.md)                     | The single source of truth — what we build |
| [`docs/PHASES.md`](docs/PHASES.md)                             | The execution ledger. Read every session.  |

> **Phase 8 (implementation) is LOCKED.** Phases 5, 6 and 7 are not yet started. No application code
> is written until Phases 0–7 are complete and the owner records approval in `PHASES.md`.

---

## Getting started

### Prerequisites

| Tool           | Version  | Notes                                             |
| :------------- | :------- | :------------------------------------------------ |
| Node.js        | 22.x LTS | pinned in [`.nvmrc`](.nvmrc)                      |
| pnpm           | 11.x     | `corepack enable` or https://pnpm.io/installation |
| Docker Desktop | latest   | **requires WSL 2 on Windows**                     |
| Git            | 2.45+    |                                                   |

### Setup

```bash
pnpm install                 # workspace tooling only — no app dependencies yet
cp .env.example .env.local   # then fill in the CHANGEME values
pnpm infra:up                # Postgres 16+PostGIS · Redis 7 · MinIO · Mailpit
pnpm infra:ps                # confirm every service is healthy
```

| Service              | Endpoint                            | Credentials                 |
| :------------------- | :---------------------------------- | :-------------------------- |
| PostgreSQL + PostGIS | `localhost:5432`, database `gymmap` | `postgres` / `postgres`     |
| Redis                | `localhost:6379`                    | —                           |
| MinIO S3 API         | `localhost:9000`                    | `minioadmin` / `minioadmin` |
| MinIO console        | http://localhost:9001               | `minioadmin` / `minioadmin` |
| Mailpit SMTP         | `localhost:1025`                    | —                           |
| Mailpit web UI       | http://localhost:8025               | —                           |

These credentials are local-only and deliberately weak. They are allowlisted in
[`.gitleaks.toml`](.gitleaks.toml) precisely because they must never be anything else.

---

## Layout

```
apps/
  customer-web/      Next.js 14 App Router · React 18 · SSR for SEO      (surface `web`)
  gym-dashboard/     React 18 + Vite · SPA                              (surface `dash`)
  admin-dashboard/   React 18 + Vite · SPA · MFA required               (surface `admin`)
  server/            NestJS 10 · the modular monolith
packages/
  ui/                Design tokens + shadcn/ui primitives — presentation only
  types/             Branded ids · Money contract · PRD enums · shared Zod
  utils/             Pure functions: money maths, gym-timezone dates, cursors
  config/            eslint · prettier · tsconfig · jest · playwright · commitlint
infra/
  compose/           Local development stack
  docker/            Dockerfiles
  terraform/         Infrastructure as code
  k8s/               Orchestrator manifests
docs/                Governance and the seven derived specification folders
```

The layout is **normative** — see [`docs/engineering/FolderStructure.md`](docs/engineering/FolderStructure.md)
§2. A directory not listed there does not exist without an amendment under constitution §24.

---

## Scripts

```bash
pnpm build            pnpm lint             pnpm typecheck
pnpm test:unit        pnpm test:int         pnpm test:contract
pnpm test:isolation   pnpm test:e2e         pnpm test:a11y
pnpm format           pnpm format:check     pnpm architecture

pnpm infra:up         pnpm infra:down       pnpm infra:reset
pnpm infra:ps         pnpm infra:logs
```

Most `turbo` tasks are no-ops until Phase 8 creates the workspace packages they run in.

---

## Contributing

Branch: `<type>/<PRD-id>-<kebab-summary>`, ≤ 60 characters.
Commit: `<type>(<PRD-ID>): <imperative summary>`

```
feat/FR-CHK-04-checkin-validation-sequence
feat(FR-CHK-04): enforce the ten-step check-in validation order
```

Every commit cites at least one PRD identifier — commitlint enforces it. Trunk-based development with
short-lived branches: target ≤ 2 days, hard limit 5. Direct pushes to `main` and `develop` are blocked
by the pre-push hook.

**Before implementing anything**, read `CLAUDE.md` §1. If a request conflicts with the constitution or
the PRD: **stop, explain the conflict, and wait.** Do not resolve it in code.

---

## Environment setup

[`docs/setup/INSTALLATION_REPORT.md`](docs/setup/INSTALLATION_REPORT.md) records exactly what is
installed, what versions, what still needs administrator rights, and the open decisions the setup
raised.

---

## Licence

UNLICENSED — proprietary. Nothing in this repository is published to a registry.
