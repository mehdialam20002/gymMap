# Stack Additions Register

> **Ruling in force (2026-08-06, project owner).**
> The technology stack named in `MASTER_PRD.md` — Baseline Decisions table and **Part C §C1.1** —
> is **authoritative and unchangeable**. Nothing the PRD names may be substituted, downgraded or
> reinterpreted.
>
> Where the PRD is **silent**, a choice must still be made in order to build. Such a choice is an
> **addition**, not a change. Every addition is registered here, declared to the project owner, and
> **not used in code until its Status column reads `APPROVED`**.

---

## The rule in one line

**Substitution = forbidden. Addition = allowed, but only after it is declared here and approved.**

An addition qualifies only if **all four** are true:

1. The PRD names no technology for that slot.
2. The slot cannot be left empty — something must be chosen to build the feature.
3. The choice contradicts no PRD selection, business rule, NFR or acceptance criterion.
4. It is recorded here with the exact PRD clause that leaves the slot open.

If any one is false, it is a **change**, and a change requires the Part C §C10 Change Control
process — not this register.

---

## Part 1 — The PRD stack (locked, for reference)

Reproduced from `MASTER_PRD.md` §C1.1. **This table is not negotiable.**

| Layer | Locked selection |
| :--- | :--- |
| API | **Node.js 20 + NestJS 10 (TypeScript)** |
| Architecture | **Modular monolith** (explicitly not microservices) |
| Database | **PostgreSQL 16** |
| Geospatial | **PostGIS** |
| Search | Postgres full-text + trigram; **OpenSearch only past ~50k listings** |
| Cache / queue | **Redis 7 + BullMQ** |
| Object storage | **S3-compatible + CDN** |
| Customer website | **Next.js 14 (App Router) + React 18 + TypeScript**, server-rendered for SEO |
| Dashboards (both) | **React 18 + Vite + TypeScript** (SPA) |
| UI system | Shared component library + design tokens *(library not named — see A-03/A-04)* |
| Server state | **TanStack Query** |
| Auth | **JWT access tokens + rotating refresh tokens**, httpOnly |
| Payments | **`PaymentProvider` port + Stripe Connect** reference adapter |
| Notifications | Channel adapters behind one interface |
| PDF | **Headless Chromium** HTML-to-PDF, deterministic |
| Observability | **OpenTelemetry** traces, structured JSON logs, metrics, error tracking |
| CI/CD | Trunk-based, short-lived branches |
| Infrastructure | Containers on a managed orchestrator; managed Postgres and Redis; IaC |

---

## Part 2 — Additions requiring approval

Status values: `PROPOSED` · `APPROVED` · `REJECTED` · `DEFERRED`

### Tier 1 — Blocking. Cannot write code until decided.

| ID | Slot | PRD clause leaving it open | Proposal | Alternatives considered | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A-01** | ORM / data-access layer | §C1.1 names PostgreSQL 16 but **no ORM**. §C1.4 requires `SET LOCAL app.tenant_id` inside every transaction. | **Prisma ORM** | TypeORM (NestJS-native, weaker types); Drizzle (young); Kysely (typed SQL, no migration story); raw `pg` | `APPROVED` |
| **A-02** | Schema validation library | `NFR-SEC-05`: *"All input is validated server-side against a schema"* — names none. | **Zod**, shared in `packages/types`, bridged into NestJS via a validation pipe | class-validator + class-transformer (NestJS default, decorator-based, not shareable with the frontend); Yup; Joi | `APPROVED` |
| **A-03** | CSS framework | §C1.1: *"design tokens as the single source of styling truth"* — names no CSS layer. | **TailwindCSS** with tokens exposed as CSS custom properties | CSS Modules; vanilla-extract; Panda CSS; styled-components | `APPROVED` |
| **A-04** | Component primitives | §C1.1: *"Shared component library consumed by all three surfaces"* — names no library. | **shadcn/ui** (Radix primitives, copied into `packages/ui`, not a runtime dependency) | Radix UI raw; MUI; Mantine; Chakra; fully bespoke | `APPROVED` |
| **A-05** | Monorepo tooling | §C1.3 describes one repository; no tool named. | **pnpm workspaces + Turborepo** | npm/yarn workspaces + Nx; Bazel; Lerna | `APPROVED` |
| **A-06** | Test runners | §C8.1 names eight test **layers** but no tools. | **Jest** (NestJS default) + **Supertest** (contract) + **Testcontainers** (integration incl. RLS) + **Playwright** (E2E) + **k6** (load) + **axe-core** (a11y) | Vitest instead of Jest; Cypress instead of Playwright; Artillery instead of k6 | `APPROVED` |
| **A-07** | Migration tool | §C7 requires backward-compatible migrations; `NFR-AVL-06`. No tool named. | **Prisma Migrate** (follows from A-01) | node-pg-migrate; Flyway; Atlas | `APPROVED` |

### Tier 2 — Needed for a PRD feature, but the PRD does not name the mechanism.

| ID | Slot | PRD clause leaving it open | Proposal | Why it is needed | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A-08** | Real-time transport | `SCR-DASH-001` requires a *"currently-in-gym count"*; `SCR-DASH-009` a live *"recent check-ins strip"*. No transport named. | **Phase 1: TanStack Query polling, 10–15 s.** Socket.IO deferred to Phase 2 behind flag `release.attendance.realtime_transport`. | Owner ruled polling for Phase 1 — keeps the app tier stateless per `NFR-SCAL-03`, adds no infrastructure. | `APPROVED` *(polling)* / `DEFERRED` *(Socket.IO → Phase 2)* |
| **A-09** | Form state management | `SCR-DASH-006` (plan editor), `SCR-WEB-005` (checkout), `SCR-DASH-002` (6-step resumable wizard). No library named. | **React Hook Form** + Zod resolver | The onboarding wizard is resumable, multi-step and per-step validated (`FR-ONB-01`). | `APPROVED` |
| **A-10** | QR generation / scanning | `FR-CHK-01` (render QR), `FR-CHK-03` (browser camera scanner). No library named. | **`qrcode`** (render) + **`@zxing/browser`** (scan) | No browser-native QR decoding API with adequate support. | `APPROVED` |
| **A-11** | Token signing for QR | `FR-CHK-02`: signed token, 60 s TTL, server-signed. Algorithm not named. | **EdDSA (Ed25519)** detached signature, rotating key, `kid` in payload | Smaller than RSA, faster to verify at 500 check-ins/min (`NFR-PERF-08`). | `APPROVED` |
| **A-12** | Password hashing | `FR-AUTH-04` names **Argon2id** — *already specified, not an addition*. Library choice open. | **`argon2`** (node binding) | Parameter tuning must be recorded. | `APPROVED` |
| **A-13** | Rate limiting | `NFR-SEC-06`, §C1.5 specify a *"Redis token bucket"*. Implementation not named. | **`rate-limiter-flexible`** on Redis | Algorithm is specified; only the library is open. | `APPROVED` |
| **A-14** | Structured logging | `NFR-MNT-04` requires JSON logs + correlation id. No library named. | **Pino** + `nestjs-pino` + `AsyncLocalStorage` | Fastest JSON logger; redaction built in for `BR-DAT-06`. | `APPROVED` |
| **A-15** | Error tracking / APM | `DEP-07` requires it; vendor deliberately unnamed. | **Sentry** (self-hostable) | `DEP-07` mitigation. Vendor-swappable. | `APPROVED` |
| **A-16** | OpenAPI generation | `NFR-MNT-03`: spec generated from code, drift fails CI. Tool not named. | **`@nestjs/swagger`** + a CI diff gate | Native to the locked framework. | `APPROVED` |
| **A-17** | Image processing | `FR-GYM-02`: resizing to renditions + EXIF stripping. Tool not named. | **Sharp** | EXIF stripping is a privacy requirement, not an optimisation. | `APPROVED` |
| **A-18** | Object-storage client | §C1.1 says "S3-compatible"; SDK not named. | **AWS SDK v3 `@aws-sdk/client-s3`** | Works against any S3-compatible provider. | `APPROVED` |
| **A-19** | Email / SMS / push adapters | `DEP-03`, `DEP-04`, `DEP-06`; `FR-NOTF-01` mandates adapters behind one interface. Vendors unnamed. | Ports defined now; concrete vendors chosen at **`OQ-01`** (launch country) | Vendor availability is country-dependent. | `DEFERRED` — blocked on `OQ-01` |
| **A-20** | CSV import parsing | `FR-ONB-15`: bulk member import with dry-run and per-row errors. | **`papaparse`** (stream mode) | 400+ row imports must stream, not buffer. | `APPROVED` |

### Tier 3 — Quality tooling. Not feature-blocking, but the constitution assumes them.

| ID | Slot | Proposal | Enforces | Status |
| :--- | :--- | :--- | :--- | :--- |
| **A-21** | Linting | **ESLint** + `@typescript-eslint` | Constitution coding standards | `APPROVED` |
| **A-22** | Formatting | **Prettier** | Constitution coding standards | `APPROVED` |
| **A-23** | Architecture fitness tests | **`dependency-cruiser`** | §C1.3 *"a lint rule and an architecture test fail the build on violation"* | `APPROVED` |
| **A-24** | Commit hooks | **Husky** + **lint-staged** + **commitlint** | Conventional Commits carrying PRD ids | `APPROVED` |
| **A-25** | Dependency & secret scanning | **Dependabot** + **Trivy** + **Gitleaks** | `NFR-SEC-07`, `NFR-SEC-08` | `APPROVED` |
| **A-26** | CI runner | **GitHub Actions** | §C7 pipeline | `APPROVED` |
| **A-27** | IaC | **Terraform** | `NFR-MNT-08` | `APPROVED` |
| **A-28** | Local dev environment | **Docker Compose** (Postgres+PostGIS, Redis, MinIO, Mailpit) | §C7 *Local* environment row | `APPROVED` |
| **A-29** | Bundle-size budget gate | **`size-limit`** | `NFR-PERF-10` (≤200 KB gzipped) | `APPROVED` |
| **A-30** | Queue observability | **Bull Board** (admin-only, behind RBAC) | `FR-ADMN-13` system health view | `APPROVED` |

---

## Part 3 — Decisions that are *not* additions

Recorded so they are not mistaken for open slots later.

| Item | Ruling |
| :--- | :--- |
| **Express** | **Rejected.** The PRD names NestJS. Substituting it is a change, not an addition. Not proceeding. |
| **Microservices** | **Rejected.** §C1.3 explicitly selects a modular monolith. |
| **MongoDB / any non-Postgres primary store** | **Rejected.** §C1.1 names PostgreSQL 16. |
| **A dedicated search cluster at launch** | **Rejected for Phase 1.** §C1.1: *"Do not add a search cluster before the data justifies it"* — OpenSearch only past ~50k listings. |
| **Schema-per-tenant at day one** | **Rejected.** Baseline Decisions rates this *"High"* impact; §C1.4 selects shared-schema RLS with a documented migration path. |
| **Native mobile apps** | **Out of scope.** `A4.2`, `CON-01`. |
| **Redux / Zustand / MobX for server state** | **Not applicable.** §C1.1 names TanStack Query for server state and *"minimal client state"*. |

---

## Part 4 — The two contested proposals, and how they were decided

Both were put to the project owner rather than slipped in. Both are now settled.

### A-08 — Socket.IO: **DEFERRED to Phase 2. Polling approved for Phase 1.**

The PRD never asks for real-time. It asks for two live figures: `SCR-DASH-001`'s *currently-in-gym
count* and `SCR-DASH-009`'s *recent check-ins strip*. Both are satisfiable by TanStack Query
polling on a 10–15 s interval, which costs nothing new.

| | Socket.IO | Polling |
| :--- | :--- | :--- |
| New infrastructure | WebSocket layer, sticky sessions or a Redis adapter | none |
| Conflict with `NFR-SCAL-03` (*"stateless, no session affinity"*) | Needs the Redis adapter specifically to avoid this | none |
| Check-in desk feel | Instant | ≤15 s stale |
| Phase-1 necessity | **No** | — |

**DECIDED 2026-08-06 — polling for Phase 1, Socket.IO deferred.** The app tier stays stateless per
`NFR-SCAL-03`. No WebSocket layer, no Redis adapter, no sticky sessions in Phase 1.

**Binding consequences of this decision:**

| Item | Consequence |
| :--- | :--- |
| Dashboard live figures | `SCR-DASH-001` currently-in-gym count and `SCR-DASH-009` recent-check-ins strip refresh by TanStack Query polling at 10–15 s. |
| Staleness disclosure | Both surfaces must show a "last updated" indicator. A stale figure presented as live is a defect. |
| Check-in confirmation | Unaffected. `NFR-PERF-03` (p95 ≤ 2 s scan→confirmation) is a **request/response** path, not a push path, and is met by the `POST /checkin/scan` round trip. Polling changes nothing here. |
| Upgrade path | The dashboard consumes a single `useLiveCounters()` hook. Swapping its transport to Socket.IO in Phase 2 touches that hook only — no component changes. |
| Flag | `release.attendance.realtime_transport`, default off, owned by Technical Lead. |
| Recorded as | `TD-0xx` in `TECH_DEBT.md` — polling is the cheaper choice, not the better one, and carries a known cost at scale. |
| Revisit trigger | Any of: a tenant with >200 check-ins/hour at one branch; poll traffic exceeding 5% of total API requests; or explicit gym-owner complaints about desk-counter lag. |

### A-01 — Prisma: **APPROVED**, with the RLS discipline below made mandatory

Approved 2026-08-06. One friction point was disclosed before approval, because it touches the single
most important rule in the system (`BR-TEN-01`, tenant isolation), and the mitigation below is now a
**constitutional requirement**, not a suggestion:

PostgreSQL RLS needs `SET LOCAL app.tenant_id = …` to run **inside the same transaction** as every
query. Prisma's connection pooling means a naive `prisma.user.findMany()` can take a *different*
pooled connection than the one the tenant variable was set on — and RLS would then see no tenant,
returning nothing or, if the policy were written permissively, the wrong rows.

The fix is well understood and non-negotiable: **all tenant-scoped access goes through a Prisma
client extension that wraps every operation in an interactive transaction which sets the tenant
variable first.** No repository may call the raw client. This is enforced by the architecture
fitness test (A-23), and the CI isolation suite (`E2E-11`, `BAC-10`) proves it holds.

TypeORM has the same underlying issue; it is a property of pooling plus RLS, not of Prisma. I
mention it because it is the kind of detail that is cheap now and expensive in month nine.

---

## Approval record

| Date | Approver | Decision | Scope |
| :--- | :--- | :--- | :--- |
| 2026-08-06 | Project owner | PRD stack is authoritative; substitutions forbidden; additions permitted only when declared and approved | All |
| 2026-08-06 | Project owner | **A-01 Prisma — APPROVED**, conditional on the mandatory tenant-context client extension in Part 4 | A-01, A-07 |
| 2026-08-06 | Project owner | **A-08 — polling APPROVED for Phase 1; Socket.IO DEFERRED to Phase 2** behind `release.attendance.realtime_transport` | A-08 |
| 2026-08-06 | Project owner | **Remaining 28 additions APPROVED as a block** — conventional tooling, no PRD conflict | A-02…A-07, A-09…A-30 |

### Current status roll-up

| Status | Count | Items |
| :--- | :-: | :--- |
| `APPROVED` | 29 | A-01 … A-18, A-20 … A-30 |
| `DEFERRED` | 2 | **A-08** Socket.IO → Phase 2 · **A-19** notification vendors → blocked on `OQ-01` (launch country) |

**A-19 remains the only open Tier-2 slot.** Email, SMS and push vendors cannot be chosen before the
launch country is known (`OQ-01`, marked *Blocking*, needed by Sprint 0). The **ports** are designed
now per `FR-NOTF-01`; only the concrete adapters wait. If `OQ-01` is still unanswered at Sprint 0,
the PRD default applies and a provider is selected for the default region, recorded here as an
amendment.

### Standing rule from this point

Any technology not listed in Part 1 (locked) or Part 2 (approved) is **unapproved** and may not
appear in code, in a `package.json`, or in an infrastructure definition. Adding one requires a new
`A-NN` row here and the owner's approval first. A dependency present in the repository without a
corresponding approved row is a **review blocker**.
