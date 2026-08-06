# Implementation Roadmap — Milestones M-001 … M-030

**Document type:** Delivery roadmap (build order) · **Status:** Baseline for Sprint 0
**Owner:** Principal Engineer / Delivery Lead · **Approver:** Technical Lead (`C9.3`)
**Covers:** Sprint 0 (2026-09-07 → 2026-09-18) · Sprint 1 (2026-09-21 → 2026-10-02) · Sprint 2 start (2026-10-05 → 2026-10-16)
**Band:** M-001 … M-030 · **Continues in:** `Milestones_030-059.md`

---

## 0. What this file is

`SprintPlanning.md` gives nineteen sprints with a task board each. The `backlog/Epic_NN.md` files give
features and technical tasks. **This file is the layer between them: the ordered list of branches an
engineer actually cuts.** Every milestone below is one branch, one pull request, one squash-merge —
sized so that it lives ≤ 2 days per `PROJECT_CONSTITUTION.md` §23.1 criterion 15, and so that the
repository is **green** the moment it merges.

| This file decides | This file defers to |
| :--- | :--- |
| Build order, branch granularity, per-milestone acceptance and rollback | `SprintPlanning.md` for sprint goals, capacity and exit checklists — **restated, never changed** |
| Which exact files a branch touches | `FolderStructure.md` — every path below is quoted from it |
| Which table, policy and grant land together | `Schema.md` §2.6/§2.7 and `MigrationStrategy.md` §2.4 |
| Which tests are written in which branch | `TestingStrategy.md` §2–§5 |
| Nothing about Definition of Ready or Definition of Done | `PROJECT_CONSTITUTION.md` §23 — **cited, never restated as a variant** |

**No application code exists yet.** Every fenced block in this document is labelled
`illustrative — not committed code` and is a shape sketch for a reviewer, never a patch.

### 0.1 The starting state, stated so nobody re-does it

The repository already exists on `main` and `develop` with pnpm workspaces, Turborepo, commitlint,
Husky, lint-staged, Prettier and dependency-cruiser installed; `apps/{server,customer-web,gym-dashboard,admin-dashboard}`
and `packages/{ui,types,utils,config}` scaffolded as empty private packages; `.github/`, `.husky/`,
`infra/` and `docs/` present. `BLK-01` is therefore **closed**. M-001 starts from that state — it does
not `git init`, does not add Turborepo and does not write `CODEOWNERS`.

### 0.2 The seven standing rules every milestone below obeys

| # | Rule | Consequence if broken |
| :-: | :--- | :--- |
| **R-1** | **2 to 6 hours for one engineer.** Larger is split; smaller is merged into its neighbour. | Estimation becomes guesswork (`§23.1` #15) |
| **R-2** | **The repository is green on merge.** Build succeeds, every wired gate passes, nothing is half-wired behind a comment. | A red trunk blocks 8 people |
| **R-3** | **Independently revertible.** Every milestone names its revert: a flag, a `git revert`, or a contract-phase migration. | `§16.7` rollback triggers become unactionable |
| **R-4** | **Buildable strictly in ascending id order.** The dependency graph is acyclic and every `Depends on` cites a **lower** id. | The roadmap stops being a build order |
| **R-5** | **A milestone that adds an endpoint adds its isolation coverage in the same milestone.** `PG-4`/`IG-1` fail the build otherwise (`BAC-10`, `E2E-11`, `NFR-SEC-09`, DoD #16). | The suite silently lapses on a Friday |
| **R-6** | **A milestone that adds a tenant-owned table adds its RLS policy *and* its grants in the same migration file.** `MG10`, `P9`, `CI-01`, `CI-02`. | A table exists that every tenant can read |
| **R-7** | **A milestone that adds a table extends `prisma/seed/` and bumps `SEED_VERSION`.** The `§C8.2` seed grows with the schema; see R-M2. | `IG-3`/`IG-4` fail for want of a tenant-B fixture |

### 0.3 The prerequisite band — read this before scheduling anything

> **`BR-TEN-01` must be a structural property of the database before a single feature touches
> tenant data.** `EP-01` §2 states it: isolation is *"a structural property of the database rather
> than a promise made by developers"*. `SprintPlanning.md` Sprint 0 states the scheduling
> consequence: *"Nothing in sprints 1–18 may start before EP-01 lands."*
>
> **Concretely, in this file: no milestone numbered M-019 or above may begin until M-009 … M-016
> are merged and green.** That band is the five-layer enforcement chain of `§C1.4` — the `tenants`
> table with RLS (M-009), the Prisma tenant-context extension (M-010), the middleware (M-011), the
> scoped repository (M-012), the audit writer (M-013), the named elevation (M-014), the **CI
> isolation suite** (M-015) and the `Money`/`Clock` value primitives (M-016). M-017 (idempotency)
> and M-018 (outbox + job harness) complete the shared kernel and are prerequisites for any
> milestone that mutates state or emits an event — which is every one of M-019 … M-030.
>
> This is repeated in the `Depends on` and `Notes` of every feature milestone below. It is repeated
> on purpose.

### 0.4 Three reconciliations recorded before the list

| # | Tension | Ruling |
| :--- | :--- | :--- |
| **R-M1** | `MigrationStrategy.md` PM-7 describes `0_init` as one migration creating 79 tables. A 79-table migration cannot be built inside a 2–6 hour milestone that leaves the repository green, and it collides with **P5** (*one logical change per migration*). | **`0_init` (M-006) carries the physical foundations only** — extensions, domains, the enum catalogue, the four roles, the blanket `REVOKE` and `ALTER DEFAULT PRIVILEGES`. It creates **zero tables**. Every table thereafter arrives in its own `<ts>_create_<table>` migration carrying its RLS block and grants in the same file (`MG10`, `P9`, R-6). PM-4 (append-only directory), PM-7 (≤ one logical change), P5, CI-01 and CI-02 are all preserved. Recorded in `DECISION_LOG.md` by M-006. |
| **R-M2** | `TestingStrategy.md` §6 specifies seed v1 as 3 tenants, 12 plans, 200 members and 5,000 attendance rows — but `plans`, `memberships` and `attendance` do not exist until Sprints 3–8. | The seed is **versioned and grown** per `TestingStrategy.md` §6.7. M-009 lands `SEED_VERSION = 0.1` (the three fixed-uuid tenants). Every table milestone extends it. Seed v1 completeness is asserted at the Sprint-8 exit, not at Sprint 0. Fixed uuids never change once published. |
| **R-M3** | R-5 requires isolation coverage in the same milestone as the endpoint, but the **generated** suite does not exist until M-015, and `GET /v1/tenant/ping` — the endpoint the Sprint-0 exit condition names — ships at M-012. | M-012 ships a **hand-written** `tenancy.isolation-spec.ts` implementing assertions **A1–A4** against the ping route. M-015 replaces it with the generated case group and adds **A5–A7** plus the `IG-1 … IG-6` gate. This is the only hand-written isolation spec permitted in the programme, it is deleted by M-015, and `IG-F` bans any successor. |

### 0.5 Sprint bands

| Milestones | Sprint | Theme | `C9.1` exit condition served |
| :--- | :-: | :--- | :--- |
| M-001 … M-008 | 0 | Toolchain, server bootstrap, local environment, migrations, pipeline, contract generation | Enables `E0.9`, `E0.11` |
| M-009 … M-016 | 0 | **Tenancy, isolation and the money/time primitives** | `E0.1` … `E0.8`, `E0.12` — *"a trivial tenant-scoped endpoint exists and the isolation suite proves it"* |
| M-017 … M-018 | 0 | Idempotency, outbox, job harness — the rest of the shared kernel | `AC-EP01-14`, `AC-EP01-15`, `AC-EP01-19` |
| M-019 … M-025 | 1 | Identity: credentials, OTP, sessions, tokens, RBAC, MFA, impersonation | `E1.1` … `E1.10` |
| M-026 … M-027 | 1 | Onboarding start: the dossier tables and the resumable wizard shell | `FR-ONB-01`, `FR-ONB-02` |
| M-028 … M-030 | 2 | Onboarding: state machine, KYC, the India checklist, the six pre-checks | `E2.2` … `E2.5`, toward `E2E-01` |

### 0.6 Index

| Id | Title | Sprint | Epic | Size | Role |
| :--- | :--- | :-: | :--- | :-: | :--- |
| M-001 | `tsconfig.base.json` and the compiler contract | 0 | EP-01 F-01.1 | 3h | DevOps |
| M-002 | `packages/config` — one configuration source, four custom rules | 0 | EP-01 F-01.1 | 6h | BE |
| M-003 | `packages/types` — branded ids, Money contract, error registry | 0 | EP-01 F-01.2 | 4h | BE |
| M-004 | NestJS 10 bootstrap, typed config, error envelope, redacted logging | 0 | EP-01 F-01.11/.12 | 6h | BE |
| M-005 | Docker Compose: Postgres 16+PostGIS, Redis 7, MinIO, Mailpit | 0 | EP-01 F-01.20 | 3h | DevOps |
| M-006 | Prisma init and `0_init` — extensions, domains, enums, four roles | 0 | EP-01 F-01.5 | 6h | BE |
| M-007 | `pr.yml` skeleton — the ten always-on gates | 0 | EP-01 F-01.19 | 6h | DevOps |
| M-008 | OpenAPI generation, `/v1` versioning, `api-gates`, drift gate | 0 | EP-01 F-01.19 | 4h | BE |
| M-009 | `tenants` — the first tenant-owned table, RLS enabled | 0 | EP-01 F-01.5 | 3h | BE |
| M-010 | **The Prisma tenant-context client extension** (ADR-0005) | 0 | EP-01 F-01.4 | 6h | BE |
| M-011 | `TenantContextMiddleware`, the ALS carrier, the principal scaffold | 0 | EP-01 F-01.3 | 6h | BE |
| M-012 | `TenantScopedRepository` and `GET /v1/tenant/ping` | 0 | EP-01 F-01.6 | 4h | BE |
| M-013 | `audit_log`, the append-only writer and the audit interceptor | 0 | EP-01 F-01.16 | 6h | BE |
| M-014 | `runElevated()` — platform scope as a named, audited call | 0 | EP-01 F-01.8 | 4h | BE |
| M-015 | **THE CROSS-TENANT ISOLATION SUITE** (`BAC-10`, `E2E-11`) | 0 | EP-01 F-01.7 | 6h | BE |
| M-016 | `Money`, the Indian formatter, the `Clock` port, time discipline | 0 | EP-01 F-01.2/.18 | 6h | BE |
| M-017 | `idempotency_keys` and the idempotency interceptor | 0 | EP-01 F-01.9 | 4h | BE |
| M-018 | Transactional outbox, `SKIP LOCKED` dispatcher, BullMQ harness | 0 | EP-01 F-01.10/.17 | 6h | BE |
| M-019 | Identity and RBAC tables — `users` … `role_permissions` | 1 | EP-02 F-02.1 | 4h | BE |
| M-020 | Argon2id credentials, password policy, breached list, lockout | 1 | EP-02 F-02.2/.7 | 6h | BE |
| M-021 | Phone OTP request and verify — the `FR-AUTH-05` limits | 1 | EP-02 F-02.1 | 6h | BE |
| M-022 | `auth_sessions`, `refresh_tokens`, JWT issue and rotation | 1 | EP-02 F-02.5 | 6h | BE |
| M-023 | The `B3.2` matrix as data, `PermissionsGuard`, `FR-RBAC-01` gate | 1 | EP-02 F-02.13/.14/.15 | 6h | BE |
| M-024 | TOTP MFA — enrolment, recovery codes, the mandatory staff gate | 1 | EP-02 F-02.6 | 4h | BE |
| M-025 | Impersonation and the financial-mutation prohibition | 1 | EP-02 F-02.10 | 4h | BE |
| M-026 | `applications` and `kyc_documents` — the dossier tables | 1 | EP-03 F-03.1 | 4h | BE |
| M-027 | The resumable wizard shell and step 1 business identity | 1 | EP-03 F-03.1/.2 | 4h | BE |
| M-028 | The `C4.4` state machine, submission snapshot and versioning | 2 | EP-03 F-03.8/.9 | 6h | BE |
| M-029 | KYC: the India checklist, the segregated bucket, the upload path | 2 | EP-03 F-03.3 | 6h | BE |
| M-030 | The six automated pre-checks and their orchestration job | 2 | EP-03 F-03.12 | 6h | BE |

---

# PART A — SPRINT 0 FOUNDATIONS (M-001 … M-008)

### M-001 — `tsconfig.base.json` and the compiler contract

| Field | Value |
| :--- | :--- |
| **Sprint** | 0 |
| **Epic** | EP-01 · F-01.1 · T-01.02 |
| **Size** | 3h |
| **Role** | DevOps |

**Goal** — Every one of the eight workspace packages compiles under one strict TypeScript
configuration that no package may loosen, and `turbo run typecheck` is green across the whole graph.

**Depends on** — none.

**Unblocks** — M-002, M-003, M-004, M-005, M-006, M-007.

**Files**

- `tsconfig.base.json` — the `PROJECT_CONSTITUTION.md` §9.1 flag set: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `useUnknownInCatchVariables`, `target: ES2022`, `moduleResolution: bundler` for browser packages and `node16` for node packages.
- `packages/config/tsconfig/{base,node,react,nest}.json` — the four presets, each `extends` the root.
- `apps/{server,customer-web,gym-dashboard,admin-dashboard}/tsconfig.json` · `packages/{types,utils,ui,config}/tsconfig.json` — eight files, each extending exactly one preset, each adding only `include`/`outDir`.
- `turbo.json` — `globalDependencies` gains `tsconfig.base.json`; the `typecheck` task is declared with `dependsOn: ["^build"]`.
- `package.json` (eight of them) — the §3.6 script contract; a `no-op` is the literal string `echo "no-op"`, never a missing script.

**Acceptance criteria**

1. `pnpm turbo run typecheck` exits 0 across all eight packages (`§3.4`).
2. Every package's *effective* configuration — resolved by `tsc --showConfig`, not by reading the file — has all §9.1 flags on. A package that re-declares a flag as `false` fails the assertion (`AC-FND-14.1` typecheck clause; CI job 4's "effective-tsconfig assertion").
3. No package declares `skipLibCheck: false` → `true` drift, no package declares `strict: false`, and no `// @ts-nocheck` exists anywhere (`§9.2.1`).
4. Every package exposes all nine scripts of `FolderStructure.md` §3.6; `turbo run <task>` needs no `--filter` list.
5. `tsconfig.base.json` appears in `turbo.json` `globalDependencies`, so editing it invalidates the whole cache rather than silently reusing stale type information.
6. The root `package.json` has **no** `dependencies` block at all — absent, not empty (`R1a`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `packages/config/tsconfig/effective-config.spec.ts` | Unit | Runs `tsc --showConfig` per package and diffs against the §9.1 expected flag map; fails naming the package and the flag |
| `scripts-contract.spec.ts` (in `packages/config`) | Unit | All eight `package.json` files expose the nine §3.6 scripts |
| CI job 4 `typecheck` | Pipeline | `tsc --noEmit` clean; wired in M-007 |

**Rollback plan** — `git revert` of a single commit. No migration, no flag, no runtime artefact. The
only external effect is the Turborepo cache, which is invalidated by the revert itself.

**Notes** — The trap is `exactOptionalPropertyTypes`. Turning it on later, once `packages/types` has
optional fields, is a multi-day refactor across three apps; turning it on now costs nothing because
there is no code. `noUncheckedIndexedAccess` is the same bet — it is the flag that makes
`assert-never.ts` (§9.6) meaningful rather than decorative.

---

### M-002 — `packages/config` — one configuration source and its four custom rules

| Field | Value |
| :--- | :--- |
| **Sprint** | 0 |
| **Epic** | EP-01 · F-01.1 · T-01.02, T-01.03 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A single versioned package supplies ESLint, Prettier, Jest, dependency-cruiser,
commitlint, Playwright and `size-limit` configuration to all eight workspaces, and the four custom
rules the constitution needs but ESLint lacks are live and provably biting.

**Depends on** — M-001.

**Unblocks** — M-003, M-004, M-007, M-012, M-016.

**Files**

- `packages/config/eslint/{base,node,react,nest}.cjs` — four presets; `warnings are errors` is set here, not per app.
- `packages/config/eslint/rules/no-global-module.cjs` — `@Global()` permitted only in `common/` and `tenancy/` (`§3.4.3`).
- `packages/config/eslint/rules/no-tenant-id-parameter.cjs` — a repository method signature containing `tenantId` (`§11.5` **BR5**).
- `packages/config/eslint/rules/no-float-money.cjs` — `number` on a field matching `amount|price|fee|total|minor|balance` (`§10.3`, `BR-PAY-01`).
- `packages/config/eslint/rules/require-permission-decorator.cjs` — every controller route method (`FR-RBAC-01`).
- `packages/config/eslint/rules/no-default-export.cjs` — `§9.9`.
- `packages/config/eslint/rules/*.spec.cjs` — one `RuleTester` spec per rule, valid and invalid cases.
- `packages/config/dependency-cruiser/index.cjs` + `module-layers.cjs` — the `§3.7` rule set and the eight-layer rank table from `ModuleDependency.md` §7.
- `packages/config/jest/{node,react}.cjs` — including the `NFR-MNT-01` threshold map: 95% on `src/payments/**`, `src/billing/**`, `src/ledger/**`, `src/settlements/**`, `src/refunds/**`, `src/memberships/**`, `src/tenancy/**`; 100% on `packages/utils/money`; 80% elsewhere.
- `packages/config/{prettier/index.cjs, commitlint/index.cjs, playwright/index.ts, size-limit/budgets.json, tailwind/preset.ts}`.
- `.dependency-cruiser.cjs` (root) — re-exports the rule set; no rules of its own.

**Acceptance criteria**

1. Each of the five custom rules has a `RuleTester` spec with at least one `valid` and one `invalid` case, and the invalid case's message names the constitution clause it enforces (`AC-FND-06.2` for `no-float-money`).
2. `no-float-money` fails on `price: number` and passes on `priceMinor: bigint` with an adjacent `currency: CurrencyCode` (`AC-FND-06.2`).
3. `dependency-cruiser` encodes the `§4.5` allowed-dependency matrix and the four forbidden edges of `FolderStructure.md` §3.2 — `ui → utils`, `types → utils`, `apps/* → apps/*`, `server → ui`.
4. Prettier and ESLint disagree about nothing: `eslint-config-prettier` is last in every preset and a formatting conflict fails `lint`, not `format`.
5. The coverage threshold map contains **eight** 95% globs and a non-empty-glob assertion, so a glob that matches no file fails rather than trivially passing (`§17.5`, CI job 7).
6. Commitlint requires Conventional Commits **with a PRD identifier in the scope** (`§8.13`); `feat(FR-ONB-01): …` passes, `feat(onboarding): …` fails.
7. `size-limit/budgets.json` declares the `NFR-PERF-10` 200 KB gzipped initial-JS budget per browser surface, even though the surfaces are empty shells until `Milestones_030-059.md`.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `no-global-module.spec.cjs`, `no-tenant-id-parameter.spec.cjs`, `no-float-money.spec.cjs`, `require-permission-decorator.spec.cjs`, `no-default-export.spec.cjs` | Unit (`RuleTester`) | Each rule's valid/invalid matrix |
| `dependency-cruiser-rules.spec.ts` | Unit | The four forbidden edges are present in the compiled rule set and each carries a `comment` naming its rule id |
| `coverage-thresholds.spec.ts` | Unit | Eight 95% globs exist and each matches ≥ 0 files today but is syntactically resolvable |

**Rollback plan** — `git revert`. A rule that proves too noisy is disabled by deleting its entry from
the preset in a follow-up commit; rules are never disabled by inline `eslint-disable`, which job 3's
suppression-comment scan rejects.

**Notes** — The trap is writing `no-float-money` as a name check only. It must inspect the **resolved
type**, otherwise `const total = 1.5` in a variable named `total` passes while `amount_minor: number`
in an interface fails — exactly backwards. Use the type checker service, accept the slower lint, and
budget for it in job 3's 1:10.

---

### M-003 — `packages/types` — branded ids, the Money contract and the error registry

| Field | Value |
| :--- | :--- |
| **Sprint** | 0 |
| **Epic** | EP-01 · F-01.2 · T-01.04 (contract half) |
| **Size** | 4h |
| **Role** | BE |

**Goal** — The vocabulary shared by the server and all three browser surfaces exists as one
runtime-free package, so that a `GymId` can never be passed where a `TenantId` belongs and an error
`code` can never be invented at a call site.

**Depends on** — M-001, M-002.

**Unblocks** — M-004, M-008, M-009, M-016, M-019.

**Files**

- `packages/types/src/ids/branded.ts` — the twenty branded ids of `FolderStructure.md` §11: `TenantId`, `GymId`, `BranchId`, `PlanId`, `MembershipId`, `OrderId`, `PaymentId`, `InvoiceId`, `LedgerEntryId`, `SettlementBatchId`, `RefundId`, `DisputeId`, `ReviewId`, `CouponId`, `StaffId`, `UserId`, `MemberId`, `AttendanceId`, `ApplicationId`, `TicketId` (`§9.5`).
- `packages/types/src/money.ts` — `{ amountMinor: bigint; currency: CurrencyCode }`, type only, no arithmetic (`BR-PAY-01`).
- `packages/types/src/currency.ts` — `CurrencyCode` and the minor-unit exponent table; `INR → 2`.
- `packages/types/src/time.ts` — `IanaTimeZone`, `IsoDate`, `IsoInstant` as branded types.
- `packages/types/src/errors/error-code.ts` — the `§13.2` registry **type** and the union of codes; seeded with the `common` and `tenancy` slices: `VALIDATION_FAILED`, `RESOURCE_NOT_FOUND`, `UNAUTHENTICATED`, `PERMISSION_DENIED`, `RATE_LIMIT_EXCEEDED`, `DEPENDENCY_UNAVAILABLE`, `IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_KEY_REUSED`, `CURRENCY_MISMATCH`, `TENANT_CONTEXT_MISSING`, `TENANT_CONTEXT_ALREADY_SET`, `TENANT_HEADER_NOT_ACCEPTED`.
- `packages/types/src/pagination.ts` — `Page<T>`, `Cursor` and the `§C3.1` envelope.
- `packages/types/src/schemas/common/{pagination,problem-details,money}.schema.ts` — the three shapes both client and server validate (A-02).
- `packages/types/src/enums/tenant-status.ts` — the `§C4.4` tenant states, `SCREAMING_SNAKE_CASE` verbatim.
- `packages/types/src/index.ts` · `packages/types/README.md`.

**Acceptance criteria**

1. The package's only runtime dependency is `zod` (`R4`); `pnpm why` proves it and `dependency-cruiser` fails a second one.
2. A branded id is not assignable from a plain `string` and not assignable across brands; a `tsd`-style negative type test proves both (`§9.5`).
3. `Money` is a **type**, not a class — arithmetic lives in `packages/utils/money` (M-016) and `common/money` (M-016). A method on this type fails review (`R4`).
4. Every error `code` in the union appears in `docs/engineering/Security.md` §2.3's registry or is added there in this PR; a code in source and absent from the registry fails CI job 8 (`AC-FND-09.2`).
5. Enum members match the PRD string verbatim; `tenant_status_enum` values equal the `§C4.4` values character for character (`§8.3`).
6. `problem-details.schema.ts` is exactly `{ error: { code, message, details[], correlation_id } }` (`§C3.1`, `AC-FND-09.1`).
7. `src/api/generated/` exists as an empty directory with a `.gitkeep` and a `CODEOWNERS` lock; it is written by CI from M-008 onward and is never hand-edited.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `branded.type-spec.ts` | Unit (type-level) | Cross-brand assignment fails to compile; `expectError` per pair for the five most-confused pairs (`TenantId`/`GymId`, `MemberId`/`UserId`, `OrderId`/`PaymentId`, `PlanId`/`MembershipId`, `BranchId`/`GymId`) |
| `error-code.registry.spec.ts` | Unit | Union is sorted, unique, `SCREAMING_SNAKE_CASE`, and every member has a registry row |
| `money.schema.spec.ts` | Unit | `amountMinor` parses from a **string** and rejects a JS `number`, proving `TR-38` at the schema boundary |

**Rollback plan** — `git revert`. No consumers exist yet; the package is not published (`R7`).

**Notes** — The trap is `money.schema.ts` accepting `z.number()` "for convenience during
development". A `bigint` crossing JSON as a `number` loses precision above 2^53 paise — ₹90,071,992,547.40,
which a large chain's annual GMV reaches. The schema accepts a **string** and coerces to `bigint`;
`AC-FND-06.6` and `TR-38` are the citations, and the contract test in M-008 re-proves it end to end.

---

### M-004 — NestJS 10 bootstrap, typed configuration, error envelope and redacted logging

| Field | Value |
| :--- | :--- |
| **Sprint** | 0 |
| **Epic** | EP-01 · F-01.11, F-01.12 · T-01.24, T-01.25 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — `apps/server` boots as a NestJS 10 application on Node 20 with a validated environment,
answers `/healthz` and `/readyz`, emits one error shape with a correlation id, and cannot write a
personal-data field to a log.

**Depends on** — M-001, M-002, M-003.

**Unblocks** — M-006, M-007, M-008, M-010, M-011.

**Files**

- `apps/server/src/main.ts` — HTTP role: Nest factory, `nestjs-pino`, `ZodValidationPipe` (A-02), global exception filter, graceful shutdown hooks.
- `apps/server/src/worker.ts` — BullMQ role: **binds no HTTP listener** (`NFR-SCAL-05`, `L2`); processors are registered from M-018.
- `apps/server/src/app.module.ts` — composition root; imports `CommonModule` only for now, the remaining 22 module directories are created in M-007's `module-structure` gate work.
- `apps/server/src/instrumentation.ts` — OTel SDK bootstrap + Sentry init with `sendDefaultPii: false` (A-15, `AC-FND-10.4`).
- `apps/server/src/common/common.module.ts` — `@Global()`, one of only two permitted (`§3.4.3`).
- `apps/server/src/common/config/app-config.schema.ts` — every environment variable declared here and nowhere else; validated at boot; the process **exits non-zero** on a missing or malformed variable (`§8.9`).
- `apps/server/src/common/errors/error-code.registry.ts` — code · owning module · HTTP status · `BR-`/`FR-` id.
- `apps/server/src/common/errors/domain-exception.filter.ts` — maps to `{ error: { code, message, details[], correlation_id } }`.
- `apps/server/src/common/logging/correlation.als.ts` — `AsyncLocalStorage` carrier crossing HTTP → queue → job.
- `apps/server/src/common/logging/redaction.ts` — the reviewed deny-list (`BR-DAT-06`).
- `apps/server/src/common/index.ts` · `README.md` (the nine §8.3 headings).
- `apps/server/{nest-cli.json,jest.config.ts,.dependency-cruiser.cjs,tsconfig.build.json}`.

**Acceptance criteria**

1. `pnpm --filter @gymmap/server start` boots and `GET /healthz` returns `200` with a body containing **no** internal detail — no version of a dependency, no tenant count, no database host (`API_Catalog.md` §1.2).
2. `GET /readyz` returns `503` until Postgres and Redis are reachable and `200` thereafter; the check is a real round-trip, not a cached boolean.
3. Removing any required environment variable makes the process **fail to start** with a message naming the variable — never boot with a default (`§8.9`, DoR #8).
4. Every error response conforms to `§C3.1` exactly; a thrown `Error` with no registry code becomes `500 INTERNAL_ERROR` with a correlation id and the raw message is **not** echoed (`AC-FND-09.1`, `AC-FND-09.6`, `SEC-A03-005`).
5. The `§C3.1` status mapping holds: validation `400`, business rule `422`, state or idempotency conflict `409`, authorisation `403`, expired order `410` (`AC-FND-09.3`).
6. The Pino redaction list covers, at minimum, `token`, `authorization`, `cookie`, `password`, `otp`, `email`, `phone`, `name`, `dob`, `address`, `card`, `cvv`, `aadhaar`, `pan`, `health_notes` (`AC-FND-10.1`).
7. An ESLint rule fails a log message built by string concatenation, because redaction can only reach structured fields (`AC-FND-10.3`).
8. `worker.ts` binds no port; a test asserts `app.getHttpServer()` is absent from the worker bootstrap (`NFR-SCAL-05`).
9. The correlation id is generated at the edge, returned in a response header, and present on every log line of that request (`NFR-MNT-04`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `app-config.schema.spec.ts` | Unit | Each required variable, removed individually, fails validation with a message naming it |
| `domain-exception.filter.spec.ts` | Unit | The five `§C3.1` mappings; the unregistered-code path; the no-echo rule |
| `redaction.spec.ts` | Unit | A synthetic PII corpus through the serialiser yields zero personal data (`BR-DAT-06-P1` unit half) |
| `health.controller.spec.ts` | Unit | `/healthz` body shape; `/readyz` degrades on a stubbed dependency failure |
| `worker-no-listener.spec.ts` | Unit | The worker bootstrap exposes no HTTP server (`NFR-SCAL-05`) |

**Rollback plan** — `git revert`. The server has no consumers and no persisted state at this point;
`docker compose down` clears the local environment. No flag is needed because nothing is reachable
by a user.

**Notes** — This milestone sits at the 6h ceiling deliberately and is **not** split. The error
envelope, the correlation id and the redaction list must all exist before the first log line and the
first thrown error in M-010, and shipping the exception filter without the registry — or the logger
without redaction — would leave the repository in exactly the half-wired state **R-2** forbids.
The second trap: `AsyncLocalStorage` must be entered in the **HTTP middleware**, not in an
interceptor, or the correlation id is missing from the very validation errors support most needs it
for.

---

### M-005 — Docker Compose: Postgres 16 + PostGIS, Redis 7, MinIO, Mailpit

| Field | Value |
| :--- | :--- |
| **Sprint** | 0 |
| **Epic** | EP-01 · F-01.20 · T-01.34 |
| **Size** | 3h |
| **Role** | DevOps |

**Goal** — `docker compose up` yields four healthy containers with no manual steps, so that every
engineer and every CI job runs against the same dependency versions (`E0.9`, A-28).

**Depends on** — M-001.

**Unblocks** — M-006, M-007.

**Files**

- `infra/compose/compose.yaml` — four services with health checks and pinned digests: `postgres:16` with PostGIS, `redis:7`, `minio`, `mailpit`.
- `infra/compose/initdb/01-extensions.sql` — asserts, does not create, the extensions `0_init` will require (`postgis`, `pg_trgm`, `pgcrypto`, `btree_gist`).
- `infra/compose/README.md` — one-command bring-up, port map, reset procedure.
- `.env.example` — every variable in `app-config.schema.ts`, with a safe local default and a comment naming the production source (`NFR-SEC-07`: the real value comes from the managed secret store, never from a file).
- `apps/server/test/harness/containers.ts` — Testcontainers bootstrap reusing the same image digests.
- `package.json` (root) — `dev:up`, `dev:down`, `dev:reset` scripts.

**Acceptance criteria**

1. `docker compose -f infra/compose/compose.yaml up -d` brings all four services to `healthy` with no interactive prompt and no host-installed tool beyond Docker (`E0.9`, `AC-FND-14.6`).
2. Redis exposes **three logical databases** — `cache`, `queue`, `ratelimit` — matching the Terraform module's split, so a local flush of the cache cannot drop a queue (`infra/terraform/modules/redis`).
3. MinIO starts with **two** buckets created: `media` and `kyc`. `kyc` has public access blocked at bring-up, mirroring the production assertion of M-029 (`BR-DAT-07`).
4. Mailpit is the only mail sink; the SMTP host in `.env.example` points at it, so a stray production SMTP credential cannot be picked up locally (A-19: vendors deferred).
5. Postgres runs in **session-mode** pooling posture with no transaction-mode pooler in the local path — the §2.3.3 obligation 5 hazard is absent locally as it is in production (ADR-0004).
6. Image digests are pinned; a floating `:latest` fails the `pipeline-integrity` job (M-007).
7. `dev:reset` drops and recreates the database volume and reapplies migrations plus the seed in one command (`MigrationStrategy.md` §2.9 weekly reset).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `compose-health.int-spec.ts` | Integration | All four services reach `healthy` inside 90 s from cold |
| `postgis-available.int-spec.ts` | Integration | `SELECT postgis_version()` succeeds — the extension is present before `0_init` asserts it |
| `minio-kyc-private.int-spec.ts` | Integration | An anonymous `GET` against a `kyc` object returns `403`, and against `media` returns `200` |

**Rollback plan** — `git revert` plus `docker compose down -v`. There is no shared state: every
engineer's environment is disposable by construction.

**Notes** — The trap is a PostGIS image that ships Postgres 15. `NFR-DQ-*` and the `Indexes.md`
GiST predicates assume 16, and the difference surfaces months later as a planner regression. The
`initdb` script therefore **asserts the server version** and refuses to start on anything but 16.

---

### M-006 — Prisma init and `0_init` — extensions, domains, enums and the four roles

| Field | Value |
| :--- | :--- |
| **Sprint** | 0 |
| **Epic** | EP-01 · F-01.5 · T-01.07, T-01.08 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — The database has its physical foundations — extensions, custom domains, the enum
catalogue and the four `app_*` roles with no `BYPASSRLS` anywhere — and the migration workflow that
every later table must obey is enforced by a linter rather than by memory.

**Depends on** — M-004, M-005.

**Unblocks** — M-007, M-009, M-013, M-017, M-019, M-026.

**Files**

- `apps/server/prisma/schema.prisma` — datasource, generator, **zero models**; PascalCase models → snake_case tables via `@@map` (`§8.6`).
- `apps/server/prisma/migration_lock.toml` — `provider = "postgresql"`, committed, never edited (PM-5).
- `apps/server/prisma/migrations/0_init/migration.sql` — the §2.4 header block; `SET LOCAL lock_timeout`/`statement_timeout` as the first two statements (PM-8); extension assertions; the §2.4 domains `money_minor`, `money_minor_nonneg`, `currency_code`, `basis_points`, `iana_timezone`, `country_code`, `slug`, `phone_e164`, `email_address`, `pan_in`, `gstin_in`, `financial_year_label`; the §2.5 enum catalogue; `CREATE ROLE app_migrator | app_rw | app_append | app_platform_ro`; the blanket `REVOKE ALL … FROM PUBLIC` and `ALTER DEFAULT PRIVILEGES`.
- `apps/server/prisma/rls/_template.sql` — the `P-STD` policy template (`rls_<table>__tenant_isolation` + `rls_<table>__platform_read`).
- `apps/server/prisma/grants/_grant-classes.sql` — `G-CRUD`, `G-CRUD-D`, `G-APPEND`, `G-COMPLETE`, `G-AUDIT`, `G-LEDGER`, `G-REF` as reusable fragments.
- `apps/server/prisma/seed/index.ts` · `seed/version.ts` — `SEED_VERSION = 0.1`, empty payload (R-M2).
- `packages/config/scripts/migration-lint.mjs` — parses the §2.4 header, enforces PM-8, PM-9, PM-10, the closed verb list and the `MF3` phase infix.
- `apps/server/test/harness/{database.ts,migrate.ts}` — Testcontainers bootstrap that applies migrations then runs the catalogue checks.
- `docs/DECISION_LOG.md` — the **R-M1** ruling recorded as an entry.

**Acceptance criteria**

1. `pnpm prisma migrate deploy` against a fresh container applies `0_init` and exits 0; re-running is a no-op (`PM-9` idempotence).
2. `SELECT rolbypassrls FROM pg_roles WHERE rolname LIKE 'app\_%'` returns **false for all four** roles, asserted automatically in local, CI and later in `development` (`CI-03`, `RS3`, `PE1`, `E0.8`, `AC-FND-01.2`).
3. `app_append` holds no `SELECT` and `app_rw` holds no `INSERT` on any future audit table — the default-privilege revoke makes the *absence* the default, so a table added in month twenty inherits nothing (`§2.2`).
4. Every domain rejects its counter-example: `pan_in` rejects `ABCDE1234`, `gstin_in` rejects a 14-character value, `phone_e164` rejects a bare 10-digit number, `iana_timezone` rejects `IST`, `financial_year_label` rejects `2026` (`§2.4`).
5. `migration-lint` **fails** a migration file that omits the header, omits either `SET LOCAL`, uses a verb outside `create · add · drop · rename · alter · backfill · enable · grant · revoke · partition · index · seed`, or changes a `@@map` string without the three-release plan (PM-10).
6. `0_init` creates **zero tables**; a reviewer can read the entire file in ten minutes. The R-M1 ruling is in `DECISION_LOG.md` in this same PR (DoD #25).
7. The `information_schema` check for `timestamp without time zone` (`CI-05`) and the `%_minor`-must-be-`bigint` check (`CI-04`) both run and both pass vacuously — they are wired now so they are not "added later".
8. The Testcontainers harness reuses the M-005 image digests, so CI and local cannot diverge on Postgres minor version.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `migration-lint.spec.mjs` | Unit | Six malformed headers, six distinct failures, each with the rule id in the message |
| `roles.int-spec.ts` | Integration (Testcontainers) | The four roles exist; none has `BYPASSRLS`; `PUBLIC` holds no table privilege (`CI-03`) |
| `domains.int-spec.ts` | Integration | One accept and one reject per domain — twelve pairs |
| `catalogue-checks.int-spec.ts` | Integration | `CI-04`, `CI-05`, `CI-06` run against the migrated container and report zero findings |

**Rollback plan** — Migration phase: **expand**. `0_init` creates only roles and types; the contract
step is a follow-up `drop` migration, never an edit to `0_init` (PM-4 — *"a correction is a new
migration"*). Locally, `pnpm dev:reset` recreates the volume. No environment beyond `development`
exists yet, so there is no forward-fix obligation.

**Notes** — The trap is Prisma's diff engine, which knows nothing about roles, domains, policies or
grants. If a later `migrate dev` decides a change is easier as drop-and-create, the generated SQL
**omits them silently** (`MigrationStrategy.md` §2.5). The three controls are all wired here:
`migration-lint` rejects `DROP TABLE` outside a contract migration, `CI-01`/`CI-02` query the live
catalogue after every run, and the §10 checklist requires the reviewer to read the generated SQL
rather than trust it.

---

### M-007 — `pr.yml` skeleton — the ten always-on gates

| Field | Value |
| :--- | :--- |
| **Sprint** | 0 |
| **Epic** | EP-01 · F-01.19 · T-01.37 |
| **Size** | 6h |
| **Role** | DevOps |

**Goal** — Every pull request runs the ten gates that can run before any feature exists, branch
protection names exactly one required check, and a deliberate violation of each gate fails **that
gate and only that gate**.

**Depends on** — M-002, M-004, M-005, M-006.

**Unblocks** — M-008, M-015, and every milestone thereafter (nothing merges without it).

**Files**

- `.github/workflows/pr.yml` — jobs **1** `setup`, **2** `commit-grammar`, **3** `lint`, **4** `typecheck`, **5** `architecture`, **6** `module-structure`, **15** `scan-deps`, **16** `scan-secrets`, **25** `pipeline-integrity`, **26** `gate-summary` (`CI_CD.md` §4.3).
- `.github/workflows/security.yml` — Gitleaks, Trivy filesystem, dependency review (A-25).
- `.github/workflows/nightly.yml` — placeholder wiring for the k6 and restore-drill jobs that arrive in later bands; runs the full uncached matrix.
- `.github/actions/setup-workspace/action.yml` — frozen-lockfile install, pnpm store cache, affected-graph computation published to the job summary.
- `apps/server/src/{common,tenancy,audit,iam,catalog,plans,staff,crm,onboarding,discovery,ordering,memberships,attendance,reviews,payments,billing,ledger,settlements,refunds,notifications,reporting,support,admin}/README.md` — the 23 module directories created with the nine §8.3 headings each, so job 6 has something to assert.
- `docs/runbooks/{common,tenancy,iam,onboarding,catalog,plans,discovery,ordering,payments,billing,memberships,attendance,crm,staff,reviews,ledger,settlements,refunds,notifications,reporting,support,admin,audit}.md` — 23 stubs, one per module (`NFR-MNT-09`).
- `packages/config/scripts/module-structure.mjs` — asserts the §7.3.1 mandated file set and the §7.3.2 forbidden directory names.
- `.github/deliberate-violations/` — one fixture branch script per wired gate, consumed by the matrix job that proves each gate bites (`E0.11`, `AC-FND-14.2`).

**Acceptance criteria**

1. All ten jobs run on every `pull_request`; `gate-summary` is the **only** check named by branch protection and it fails if any upstream job is neither `success` nor legitimately `neutral` (`CI_CD.md` §4.3 job 26).
2. The deliberate-violation matrix proves each of the ten bites individually: an unformatted file fails 3 only; a `PrismaClient` import outside `tenancy/prisma` fails 5 only; a missing `permissions.ts` fails 6 only; a committed AWS key fails 16 only; a commit message without a PRD identifier fails 2 only (`E0.11`).
3. Job 5 runs the **full** dependency-cruiser rule set, is never cached and never affected-filtered, and publishes the module graph as an artefact (`CI_CD.md` §4.3).
4. Job 3 treats warnings as errors and scans for suppression comments; an `eslint-disable` without a `DECISION_LOG.md` reference fails.
5. All 23 module directories exist with a `README.md` carrying the nine §8.3 headings and a matching runbook stub; a 24th directory fails job 6 (`§C1.3` — *"not twenty-two, not twenty-four"*).
6. Job 25 runs `terraform validate` and the IaC misconfiguration scan against `infra/terraform/`, which is empty at this point and must therefore pass without a special case.
7. Every third-party action is pinned by commit SHA, not by tag (`CI_CD.md` §2.5).
8. Job 1 publishes the affected-workspace table to the summary, including an explicit statement of which jobs still ran when the affected set is empty.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `.github/deliberate-violations/*.spec.sh` × 10 | Pipeline | One scripted violation per gate; each asserts exactly one job red |
| `module-structure.spec.mjs` | Unit | A missing `index.ts`, a missing `README.md`, a forbidden `services/` directory and a 24th module each fail with a distinct message |
| `workflow-lint` (`actionlint`) inside job 25 | Pipeline | `pr.yml`, `security.yml`, `nightly.yml` parse and pin every action (`AP-5`) |

**Rollback plan** — `git revert` of `.github/workflows/pr.yml` restores the previous (empty) gate
set. Because branch protection names `gate-summary` and nothing else, a revert does not require a
branch-protection change — the required check keeps its name across every future job addition. That
naming choice is the rollback plan.

**Notes** — This milestone deliberately wires **ten** of the twenty-six jobs. Jobs 7 (`unit`), 8–10
(`api-gates`, `api-absence-assertions`, `openapi-drift`), 11 (`migration-safety`), 12
(`integration`), 13 (`isolation`), 14 (`contract`), 17 (`scan-sast`), 21 (`bac06-report`) and 22
(`docs-traceability`) are added by the milestone that first has something for them to check — M-008,
M-009, M-015, M-016 — and the browser-surface jobs 18, 19 and 24 by `Milestones_030-059.md`. Wiring a
job with nothing to assert produces a green check that means nothing, which is worse than an absent
one.

---

### M-008 — OpenAPI generation, `/v1` versioning, `api-gates` and the drift gate

| Field | Value |
| :--- | :--- |
| **Sprint** | 0 |
| **Epic** | EP-01 · F-01.19 · T-01.32 · EP-02 F-02.13 (the gate half) |
| **Size** | 4h |
| **Role** | BE |

**Goal** — The API contract is generated from code into a committed `openapi.json`, drift fails the
build, and an endpoint that declares no permission cannot merge — before a single endpoint exists.

**Depends on** — M-003, M-004, M-007.

**Unblocks** — M-012, M-015, M-023, and every endpoint milestone.

**Files**

- `apps/server/src/main.ts` — `app.enableVersioning({ type: URI, defaultVersion: '1' })`; `@nestjs/swagger` document factory (A-16).
- `apps/server/src/common/decorators/{required-permission.decorator.ts,public.decorator.ts,tenant-scoped.decorator.ts,idempotent.decorator.ts,rate-limit.decorator.ts,audited.decorator.ts}` — the six metadata decorators the reflection pass reads.
- `apps/server/src/common/openapi/document.factory.ts` — deterministic ordering, so a regeneration diff is a real diff and not a key-order shuffle.
- `packages/config/scripts/api-gates.mjs` — **one** reflection pass asserting `PG-1` (every route declares a permission or is on the `@Public()` allowlist), `PG-2` (idempotency where `§14.2.1` says **REQ**), `PG-3` (permission strings are well-formed `<module>.<resource>.<action>`), `PG-5` (rate-limit class present and every emitted error code is in the registry); writes `openapi.json`.
- `packages/config/scripts/api-absence-assertions.mjs` — the four `API_Catalog.md` §9.4 proofs that an operation does **not** exist: no client-signal activation, no monetary request field, no client-supplied tenant id, no gym-edits-review route.
- `openapi.json` (repository root) — the committed generated artefact, `CODEOWNERS`-locked against hand edits (`OA2`).
- `.github/workflows/pr.yml` — jobs **8** `api-gates`, **9** `api-absence-assertions`, **10** `openapi-drift`, **14** `contract` added.
- `packages/types/src/api/generated/` — the client types, written by CI from `openapi.json`.

**Acceptance criteria**

1. `pnpm --filter @gymmap/server openapi:emit` produces a byte-stable `openapi.json`; running it twice yields no diff (deterministic ordering).
2. Job 10 fails when the committed artefact differs from the regenerated one, and renders the diff into the job summary as a **mandatory review item** (`NFR-MNT-03`, `API_Catalog.md` §9.5).
3. A controller route with no `@RequiredPermission()` and not on the `@Public()` allowlist fails job 8 with `PG-1`; the allowlist is a committed file with a reason per row (`FR-RBAC-01`, `AC-FND-14.4`, `E1.4`).
4. A permission string that is not `<module>.<resource>.<action>` — three lowercase dot-separated segments whose first segment is one of the 23 module folders — fails `PG-3`.
5. `/healthz` and `/readyz` are **unversioned**; every other route is under `/v1` and carries one of the five closed audience prefixes: none, `/me`, `/tenant`, `/admin`, `/webhooks` (`API_Catalog.md` §1.2 R7). A sixth prefix fails job 8.
6. Job 9 proves the four absences; each assertion names the invariant it defends (I1, I3, I4, I5).
7. Job 14 `contract` runs Supertest request **and** response validation against the generated document for every route; with zero routes it passes with an explicit "0 routes validated" summary line rather than silently.
8. `packages/types/src/api/generated/` is regenerated by CI and a hand edit fails the `CODEOWNERS` lock plus a content-hash check.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `api-gates.spec.mjs` | Unit | Four fixture controllers — no permission, malformed permission, missing `@Idempotent()` on a REQ route, unregistered error code — each fail with their own `PG-` id |
| `openapi-determinism.spec.ts` | Unit | Two consecutive emissions are byte-identical |
| `versioning.contract-spec.ts` | Contract | `/healthz` unversioned `200`; `/v1/…` resolves; a route registered outside the five prefixes fails the gate |
| `absence-assertions.spec.mjs` | Unit | Each of the four absences fails when a fixture deliberately introduces the forbidden operation |

**Rollback plan** — `git revert`. Jobs 8, 9, 10 and 14 are removed from `pr.yml` by the same revert
and `gate-summary` keeps its name, so branch protection is untouched. `openapi.json` is a generated
artefact; deleting it has no runtime effect.

**Notes** — Two traps. First, `PG-1` must read the **Nest route table**, not the source text: a route
registered by a dynamic module or a mixin is invisible to a grep and is exactly where an undeclared
permission hides. Second, `CI_CD.md` §0.3 correction **C-5** applies — this is **one** reflection
pass emitting `PG-1`, `PG-2`, `PG-3` and `PG-5`, not three separate boots. `PG-4` (isolation
coverage) is deliberately **not** here; it lives in job 13 where the isolation inventory lives, and
it arrives with M-015.

---

# PART B — TENANCY, ISOLATION AND THE SHARED KERNEL (M-009 … M-018)

> **Scheduling rule, restated.** This is the most important sequence in the roadmap. `BR-TEN-01`
> must be structurally true in PostgreSQL before any feature touches tenant data, so **no milestone
> from M-019 onward may start until M-009 … M-016 are merged and green**, and no milestone that
> mutates state or emits an event may start until M-017 and M-018 are green too. `EP-01` §8.2:
> *"Nothing in sprints 1–18 may start before EP-01 lands."* The five layers of `§C1.4` map onto this
> band exactly: **layer 1** middleware (M-011), **layer 2** the Prisma extension (M-010), **layer 3**
> RLS (M-009), **layer 4** the scoped repository (M-012), **layer 5** the isolation suite (M-015).

### M-009 — `tenants` — the first tenant-owned table, RLS enabled

| Field | Value |
| :--- | :--- |
| **Sprint** | 0 |
| **Epic** | EP-01 · F-01.5 · T-01.09 |
| **Size** | 3h |
| **Role** | BE |

**Goal** — One tenant-owned table exists with row-level security **forced**, both a `USING` and a
`WITH CHECK` policy, a platform-read policy on a second role, and a CI check that will fail any
future migration that omits any of the three.

**Depends on** — M-006.

**Unblocks** — M-010, M-011, M-012, M-013, M-014, M-015, M-019, M-026.

**Files**

- `apps/server/prisma/schema.prisma` — the `Tenant` model mapped to `tenants`: `legal_name`, `trading_name`, `entity_type`, `registration_number`, `country_code` default `'IN'`, `currency` default `'INR'`, `timezone` default `'Asia/Kolkata'`, `status` default `'DRAFT'`, `subscription_tier_id`, the universal column set, `deleted_at` (`Schema.md` §4.1).
- `apps/server/prisma/migrations/<ts>_create_tenants/migration.sql` — header per §2.4; the table; `uq_tenants__country_registration_number`; `ENABLE` + **`FORCE`** `ROW LEVEL SECURITY`; the `P-SELF` policy `rls_tenants__tenant_isolation` on `id = current_setting('app.tenant_id')::uuid`; the `P-PLATFORM` policy `rls_tenants__platform_read` `FOR SELECT TO app_platform_ro USING (true)`; `G-CRUD` grants; `COMMENT ON` for every column (`NFR-PRV-01`).
- `apps/server/prisma/rls/tenants.sql` — the policy SQL, applied **from** the migration, never out of band.
- `apps/server/test/isolation/rls-coverage.sql` — the `IS6` `pg_policies` query with the committed eleven-table reference exemption list.
- `apps/server/test/isolation/rls-policy.sql-spec.ts` — the raw-`pg` policy suite, seeded with cases **RS-1, RS-2, RS-3, RS-7, RS-8, RS-10** (the subset that a single table can carry; RS-4 … RS-6, RS-9, RS-11, RS-12 are parameterised in M-015).
- `apps/server/prisma/seed/tenants.ts` — `SEED_VERSION = 0.1`: tenant A `single-branch`, tenant B `multi-branch`, tenant C `suspended`, fixed uuids, three distinct timezones including `Asia/Kolkata` (`TestingStrategy.md` §6.1, `TR-07`).
- `.github/workflows/pr.yml` — job **11** `migration-safety` added, running `CI-01`, `CI-02`, `CI-03`, `CI-05`, `CI-06` and the lock budget; job **12** `integration` added.

**Acceptance criteria**

1. `tenants` has RLS **enabled and forced**; the owner (`app_migrator`) is not exempt (`§2.3.3` obligation 2, `IS6`).
2. The policy uses `current_setting('app.tenant_id')` with **no** `missing_ok` argument, so an unset variable raises SQLSTATE `42704` rather than yielding `NULL` (`§2.3.3` obligation 1).
3. Both `USING` **and** `WITH CHECK` are present. `PC4` proves the converse: a `USING`-only policy permits a cross-tenant `INSERT` and is rejected by the check (`AC-FND-01.1`).
4. `CI-01` fails the build for any table with a `tenant_id` column and no `rls_<table>__tenant_isolation` policy, and `PC2` fails the converse — a table on the exemption list that carries a `tenant_id` column (`§5.7`).
5. `CI-03` re-asserts no role holds `BYPASSRLS`, now against a table that has policies (`E0.8`).
6. Connected as `app_rw` with `app.tenant_id` set to tenant A, `SELECT count(*) FROM tenants` returns exactly **1** — the `P-SELF` class means the table's own primary key is the RLS key (`Schema.md` §2.6).
7. With `app.tenant_id` unset, the same query returns **zero rows or raises** — never all three (`RS-7`).
8. The seed produces three tenants with fixed uuids published in `TestingStrategy.md` §6.3, and `SEED_VERSION` is bumped to `0.1` (R-7, R-M2).
9. The migration header declares `rls: new table` and `grants: G-CRUD`, and `migration-lint` fails a tenant-owned table whose header says `rls: unchanged` (`P9`, `MG10`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `rls-policy.sql-spec.ts` cases RS-1, RS-2, RS-3, RS-7, RS-8, RS-10 | Isolation (raw `pg`, no Nest, no Prisma) | Read admitted for A; read of B returns zero rows; insert of a B-owned row raises `new row violates row-level security policy`; unset context returns nothing; malformed uuid never returns another tenant; `rolbypassrls` false |
| `rls-coverage.int-spec.ts` | Integration | `IS6` query returns an empty set; a fixture migration that drops the policy makes it non-empty and fails |
| `tenants.seed.int-spec.ts` | Integration | Three tenants, three distinct `timezone` values, uuids equal to the published constants |

**Rollback plan** — Migration phase: **expand** (a `create`, nothing depends on it yet). The
contract is a follow-up `<ts>_drop_tenants` migration, never an edit (PM-4). `pnpm dev:reset`
locally. No deployed environment exists, so there is no data-loss exposure.

**Notes** — The trap is writing the policy **permissively** — `current_setting('app.tenant_id', true)`
with `missing_ok = true` — because it makes the local test suite quieter. It also converts the
pooling hazard of `§2.3.1` from *a loud failure* into *another tenant's rows*. `§2.3.4` states the
schema's entire contribution honestly: it converts a silent leak into a visible error. Do not throw
that away for a tidier log.

---

### M-010 — The Prisma tenant-context client extension (ADR-0005)

| Field | Value |
| :--- | :--- |
| **Sprint** | 0 |
| **Epic** | EP-01 · F-01.4 · T-01.11, T-01.12 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Every tenant-scoped database operation runs inside an interactive transaction that first
executes `set_config('app.tenant_id', $1, true)` on **the same connection**, and no code outside
`tenancy/prisma/` can construct a Prisma client at all.

**Depends on** — M-004, M-009.

**Unblocks** — M-011, M-012, M-013, M-014, M-015, M-017, M-018.

**Files**

- `apps/server/src/tenancy/tenancy.module.ts` — `@Global()`, the second and last permitted (`§3.4.3`).
- `apps/server/src/tenancy/prisma/prisma.service.ts` — lifecycle, pool sizing, `$on('query')` sampling for OTel. **The only construction site of `PrismaClient` in the repository** (`P1`, `P2`).
- `apps/server/src/tenancy/prisma/tenant-scoped-client.ts` — the mandatory `$extends` extension over `$allModels`, `$allOperations`.
- `apps/server/src/tenancy/prisma/tenant-scoped-client.int-spec.ts` — the `PX-1` … `PX-6` cases.
- `apps/server/src/tenancy/context/tenant-context.als.ts` — the `AsyncLocalStorage` carrier (`P5`).
- `apps/server/src/tenancy/context/tenant-context.vo.ts` — the discriminated union `NONE | TENANT | PLATFORM` (`§9.4`).
- `apps/server/src/tenancy/domain/tenant-id.vo.ts` — branded; a plain string is how isolation bugs are written.
- `apps/server/src/tenancy/domain/tenancy.errors.ts` — `MissingTenantContextError → TENANT_CONTEXT_MISSING`, `TenantContextAlreadySetError → TENANT_CONTEXT_ALREADY_SET`.
- `apps/server/src/common/persistence/unit-of-work.port.ts` — one interactive transaction per use case (`§11.4.2` **P4**).
- `packages/config/dependency-cruiser/index.cjs` — rules `no-raw-prisma-client` and `no-platform-prisma-outside-allowlist`.
- `docs/runbooks/tenancy.md` — failure modes: pool exhaustion under interactive transactions, `TENANT_CONTEXT_MISSING` storm, transaction-timeout tuning.

**Acceptance criteria**

1. Every operation on **every** model is intercepted — the extension binds `$allModels.$allOperations`, and a model added in the same pull request is protected the moment it exists (`PX-5`, `P6`).
2. `set_config('app.tenant_id', $1, true)` — the third argument is `is_local`. A session-level `SET` is forbidden because a pooled connection returned to the pool would carry it to the next request (`P3`).
3. `pg_backend_pid()` captured beside the `set_config` and beside the query are **identical** (`PX-1`, `E0.6`, `AC-FND-02.1`).
4. After the transaction commits, `current_setting('app.tenant_id', true)` on the same physical connection is **unset** (`PX-2`).
5. With `AsyncLocalStorage` empty, any tenant-scoped operation **throws** `TENANT_CONTEXT_MISSING` — never executes unfiltered, never returns a `403` a user could provoke (`PX-4`, `AC-FND-02.2`, `BR-TEN-01-N3`, `BR2`).
6. Re-entering with a **different** tenant inside one request throws `TENANT_CONTEXT_ALREADY_SET` (`BR-TEN-02-N1`, `AC-EP01-10`).
7. A nested `$transaction` inside an extension-opened transaction throws — exactly one interactive transaction per unit of work (`PX-6`, `P4`).
8. Under a pool of **2** connections and 20 concurrent interleaved operations across two tenants, every result set belongs to its own caller's tenant; zero cross-contamination (`PX-3`, `TR-01`).
9. `dependency-cruiser` fails the build on any `PrismaClient` import outside `apps/server/src/tenancy/prisma/` (`PX-7`, `E0.7`, `AC-FND-02.3`).
10. Pool arithmetic is documented against `OQ-18` volumes, with a transaction timeout and a pool-exhaustion alert configured (`TR-37`, T-01.12).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `tenant-scoped-client.int-spec.ts` — `PX-1`, `PX-2`, `PX-4`, `PX-5`, `PX-6` | Integration (Testcontainers, real Postgres, real RLS) | Same connection; `is_local` true; missing-context throw; `$allModels` coverage via DMMF introspection; nested-transaction refusal |
| `prisma-extension-pool.int-spec.ts` — `PX-3` | Integration | Pool starvation with two tenants interleaved, zero contamination |
| `no-raw-prisma-client.arch-spec.ts` | Architecture (dependency-cruiser) | `PrismaClient` constructed in exactly one directory (`PX-7`) |
| `tenancy.errors.spec.ts` | Unit | Both errors map to their registry codes and to HTTP `500`, not `403` |

**Rollback plan** — `git revert`. Nothing consumes the extension until M-011, so the revert is
clean. If the extension is found defective **after** M-012 has shipped an endpoint, the correct
response is not a revert but a **forward fix with the isolation suite red** — a defective extension
with RLS still forced fails loudly rather than leaking (`§2.3.4`), so the safe state is "the API
returns 500", which the strict policy guarantees.

**Notes** — This is `TR-01`, scored 15, and `SprintPlanning.md` names it *"the single
highest-consequence task in the programme"*. It is pair-programmed by the Technical Lead plus one
backend engineer and requires **two approvals** under `CODEOWNERS` for `apps/server/src/tenancy/**`.
Two traps. First, `A-01`'s approval is **conditional** on this being built exactly as
`STACK_ADDITIONS.md` Part 4 specifies — a variant is a stack-approval breach, not a design choice.
Second, `ADR-0004`'s implementation note is load-bearing infrastructure, not application code:
**connection pooling runs in session mode, never transaction mode**, because a transaction-mode
pooler can hand the `SET LOCAL` and the query to different server connections, which is `PX-1`'s
failure with a different actor. The schema cannot defend against it; M-005 and the Terraform module
must.

---

### M-011 — `TenantContextMiddleware`, the ALS carrier and the Sprint-0 principal scaffold

| Field | Value |
| :--- | :--- |
| **Sprint** | 0 |
| **Epic** | EP-01 · F-01.3 · T-01.10 · EP-02 F-02.5 (skeleton) |
| **Size** | 6h |
| **Role** | BE |

**Goal** — The tenant on a request is derived from the authenticated principal or from the requested
resource and **never** from anything the client sends, and there is a verifiable access token for
the isolation suite to authenticate with.

**Depends on** — M-004, M-010.

**Unblocks** — M-012, M-014, M-015, M-022, M-023.

**Files**

- `apps/server/src/tenancy/context/tenant-context.middleware.ts` — resolution order: `dash`/`admin` from the authenticated principal; public reads from the requested resource; `/webhooks` from the **stored** payment intent, never the payload (`§11.3`, `BR-PAY-05`).
- `apps/server/src/tenancy/guards/tenant.guard.ts` — refuses a handler marked `@TenantScoped()` when the resolved context is `NONE`.
- `apps/server/src/common/guards/jwt-auth.guard.ts` — **verification only**: signature, `exp`, `nbf`, `iss`, `aud`, `typ`. Issuance, rotation, MFA and the role matrix are M-022 … M-025.
- `apps/server/src/common/guards/index.ts` · `apps/server/src/tenancy/index.ts` — the public surfaces.
- `apps/server/test/harness/mint-token.ts` — the test-only minter that signs a Sprint-0 access token with the same key material, carrying `sub`, `tenant_id`, `roles[]`, `typ: 'ACCESS'`.
- `apps/server/src/common/errors/error-code.registry.ts` — `TENANT_HEADER_NOT_ACCEPTED` (400) registered.
- `apps/server/src/tenancy/README.md` — the nine §8.3 headings, filled.

**Acceptance criteria**

1. An `X-Tenant-Id` header, a `?tenant_id=` query parameter or a `tenant_id` body field on any route returns **`400 TENANT_HEADER_NOT_ACCEPTED`**, and the attempt is logged as a security signal (`TD1`, `§11.3`, `apis/Authentication.md` §8.1 error table).
2. For a `dash` or `admin` request the tenant comes from the principal's active tenant claim; the middleware never reads the URL for it.
3. For a public read the tenant is derived from the **resource** — the gym or branch being fetched — and the resolution is a database lookup, not a parse.
4. The resolved context enters `AsyncLocalStorage` **in the middleware**, before any guard or interceptor, so a validation error raised in the pipe already carries the correlation id and the tenant scope (`AC-FND-09.5`).
5. A handler annotated `@TenantScoped()` reached with context `NONE` is refused before the use case runs; the refusal is a `500` with `TENANT_CONTEXT_MISSING`, because a user must not be able to provoke it (`BR2`).
6. A single request resolves **exactly one** tenant; an attempt to re-resolve throws `TENANT_CONTEXT_ALREADY_SET` (`BR-TEN-02`, `INV-TEN-3`).
7. `JwtAuthGuard` rejects an unsigned token, a token signed with the wrong key, an expired token and a token whose `typ` is not `ACCESS`, each with `401 UNAUTHENTICATED` and no detail about which check failed.
8. The token minter lives under `test/harness/` and is **not** reachable from `src/`; `dependency-cruiser` fails an import of it from application code.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `tenant-context.middleware.spec.ts` | Unit | Principal-derived, resource-derived and webhook-derived resolution; the three client-supplied rejections |
| `tenant-context.als.int-spec.ts` | Integration | The context set in the middleware is visible inside the repository's transaction and absent after the response |
| `jwt-auth.guard.spec.ts` | Unit | Four rejection cases, one accept case, uniform error body |
| `tenant-header-rejected.contract-spec.ts` | Contract | `400 TENANT_HEADER_NOT_ACCEPTED` for all three client-supplied shapes, against the generated document |

**Rollback plan** — `git revert`. No table, no flag. The only externally visible behaviour is on
`/healthz` and `/readyz`, which are unversioned and untenanted, so a revert changes nothing a client
can observe.

**Notes** — Two traps. First, resolving the tenant in a **guard** instead of the middleware puts the
`AsyncLocalStorage` entry after validation, and the first thing anyone debugs — a `400` from the Zod
pipe — arrives with no tenant and no correlation id. Second, the Sprint-0 `JwtAuthGuard` is a
**scaffold**, and `SprintPlanning.md` task 0.21 names it as such. It must not accumulate role logic:
`PermissionsGuard` and the `B3.2` matrix are M-023, and a "temporary" role check here is how a
security control ends up implemented twice.

---

### M-012 — `TenantScopedRepository` and `GET /v1/tenant/ping`

| Field | Value |
| :--- | :--- |
| **Sprint** | 0 |
| **Epic** | EP-01 · F-01.6 · T-01.13, T-01.14, T-01.18 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — A repository base class refuses to build a query when no tenant context is active, and the
trivial tenant-scoped endpoint that the Sprint-0 exit condition names exists, is authorised, appears
in the OpenAPI document and returns `404` — never `403` — across tenants.

**Depends on** — M-008, M-010, M-011.

**Unblocks** — M-013, M-014, M-015, M-026.

**Files**

- `apps/server/src/common/persistence/tenant-scoped.repository.ts` — the base class; a context-free query is a **loud typed failure**, never a silent full-table read (`§C1.4` step 4, `§11.5`).
- `apps/server/src/common/persistence/reference-data.repository.ts` — the platform-global counterpart, RLS-exempt **by design** and greppable (`BR4`).
- `apps/server/src/tenancy/controllers/tenant-ping.controller.ts` — `GET /v1/tenant/ping`, `@TenantScoped()`, `@RequiredPermission('tenancy.ping.read')`, `@RateLimit('RL-READ')`.
- `apps/server/src/tenancy/permissions.ts` — `tenancy.ping.read`, the module's first permission constant (`FR-RBAC-01`).
- `apps/server/src/tenancy/dto/{ping.response.dto.ts,ping.openapi.ts}` — the response is the caller's own tenant row reduced to `id`, `trading_name`, `timezone`, `status`.
- `apps/server/src/tenancy/infrastructure/tenant.prisma-repository.ts` + `.int-spec.ts` — extends the base; the `int-spec` carries the mandatory RLS assertion (`§7.3.1` row 20).
- `apps/server/test/isolation/tenancy.isolation-spec.ts` — **the one hand-written isolation spec** (R-M3), assertions A1–A4, deleted by M-015.
- `packages/config/eslint/rules/no-tenant-id-parameter.cjs` — enabled for `apps/server/src/**/infrastructure/**`.
- `docs/features/tenant-ping.md` — the five §21.3 sections (DoD #23).
- `apps/server/prisma/rls/_raw-sql-allowlist.md` — the reviewed `$queryRaw` escape-hatch list: **empty today**, with the three future entries named (`discovery/` PostGIS radius, `discovery/` FTS ranking, `settlements/` reconciliation aggregate) and the process for adding a fourth (`P7`, `TR-34`, `AC-FND-02.4`).

**Acceptance criteria**

1. Constructing any query through `TenantScopedRepository` with `AsyncLocalStorage` empty throws `TENANT_CONTEXT_MISSING` before a statement is sent to Postgres (`§C1.4` step 4).
2. **No repository method signature contains a `tenantId` parameter.** If one appears the boundary is wrong; the ESLint rule fails the build (`BR5`, `§11.5`).
3. `GET /v1/tenant/ping` with tenant A's token returns `200` and **tenant A's row** (`E0.2`).
4. The same route with tenant B's token for tenant A's resource returns **`404`, not `403`**, and the body contains **no** field derived from tenant A's row (`E0.3`, `AC-FND-03.1`, `RSK-08`).
5. The route declares a permission and appears in the generated OpenAPI document; job 8 `PG-1` and job 10 `openapi-drift` both pass with it present (`E0.1`).
6. The repository `int-spec` includes an RLS assertion executed against a real Postgres through Testcontainers, not a mocked repository (`AC-FND-01.3`, `BR-TEN-01-P1`, DoD #14).
7. A parameterised query with `OR 1=1` injected **as a value** returns only tenant A's rows (`AC-FND-01.4`, `BR-TEN-01-N2`, `SEC-A03-002`).
8. `$queryRaw`/`$executeRaw` anywhere outside `tenancy/` fails CI unless the call site is on the committed allow-list with a comment and a `DECISION_LOG.md` entry (`TR-34`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `tenant-scoped.repository.spec.ts` | Unit | Context-free construction throws; the error carries the registry code |
| `tenant.prisma-repository.int-spec.ts` | Integration | Tenant A sees one row, tenant B sees zero for A's id, the `OR 1=1` value injection is inert |
| `tenant-ping.controller.spec.ts` | Unit | Permission metadata present; response shape matches the DTO |
| `tenancy.isolation-spec.ts` (A1–A4) | Isolation | Read refused `404`; write refused with byte-identity; collection filtered by **count**; positive control returns a **non-empty** body |
| `raw-sql-allowlist.arch-spec.ts` | Architecture | A fixture `$queryRaw` outside `tenancy/` and off the list fails |

**Rollback plan** — `git revert`. The endpoint is behind no flag because it has no business
behaviour to gate; reverting removes the route and job 10 records the OpenAPI deletion as an
intentional diff. The repository base class has no persisted state.

**Notes** — Assertion **A4** is the one people skip. A globally broken tenant variable that returns
nothing for everyone makes A1, A2 and A3 pass trivially — the *catastrophic false pass* of
`TestingStrategy.md` §5.4 and `E0.5`. The positive control asserting a **non-empty** result is what
makes the other three mean anything, and it is why the seed must contain tenant-A data on every
route. This hand-written spec is temporary by construction (R-M3); M-015 deletes it and `IG-F` bans
a successor.

---

### M-013 — `audit_log`, the append-only writer and the audit interceptor

| Field | Value |
| :--- | :--- |
| **Sprint** | 0 |
| **Epic** | EP-01 · F-01.16 · T-01.30 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Every create, update and delete on an audited entity produces an immutable record of who,
when, from what, to what and why — written on a database role that holds no `UPDATE` and no `DELETE`
grant, so that no interface, API or role can alter it.

**Depends on** — M-006, M-009, M-010.

**Unblocks** — M-014, M-015, M-021, M-022, M-025, M-028, M-029.

**Files**

- `apps/server/prisma/migrations/<ts>_create_audit_log/migration.sql` — `audit_log` **partitioned monthly by `occurred_at`** with the first three partitions; columns `actor_id`, `actor_type`, `impersonated_by`, `tenant_id`, `entity_type`, `entity_id`, `action`, `before jsonb`, `after jsonb`, `ip inet`, `user_agent`, `correlation_id`, `reason`, `occurred_at` (`§C2.2`, `BR-DAT-01`); RLS `P-STD` + `P-PLATFORM`; grant class **G-AUDIT** — `INSERT` to `app_append` only, `SELECT` to `app_rw` and `app_platform_ro`, **no** `UPDATE`, **no** `DELETE`; the two `BAC-13` indexes `(entity_type, entity_id, occurred_at)` and `(actor_id, occurred_at)`; a `BEFORE UPDATE OR DELETE` trigger raising unconditionally as the second line of defence (`§2.8.2`).
- `apps/server/src/audit/audit.module.ts` · `index.ts` · `README.md` — provider-only, **no controllers** (`§8.2`).
- `apps/server/src/audit/ports/audit-write.port.ts` — internal, injected by the interceptor only.
- `apps/server/src/audit/ports/audit-read.port.ts` — exported for `admin/` (`FR-ADMN-09`, EP-19).
- `apps/server/src/audit/infrastructure/audit.prisma-repository.ts` — uses a **separate connection** authenticated as `app_append`.
- `apps/server/src/audit/application/write-audit-entry.use-case.ts` + `.spec.ts`.
- `apps/server/src/common/interceptors/audit.interceptor.ts` — reads `@Audited()`, captures before/after.
- `packages/config/scripts/audited-annotation.mjs` — the CI check that every entity in the seven audited classes carries the annotation.
- `apps/server/src/audit/jobs/audit-partition-maintenance.processor.ts` — declared here, scheduled by the harness in M-018.
- `docs/runbooks/audit.md` · `docs/database/AuditStrategy.md` cross-reference update.

**Acceptance criteria**

1. An audit row carries all fourteen fields of `AC-FND-11.1`, including `impersonated_by` (populated from M-025 onward) and `reason`.
2. As `app_rw`, `UPDATE audit_log …` and `DELETE FROM audit_log …` both raise **`permission denied`** at the **grant** level, before any policy is consulted (`RS-9`, `AC-FND-11.4`, `NFR-SEC-13`, `BR-DAT-01-N1`).
3. As `app_append`, `SELECT * FROM audit_log` raises `permission denied` — the path that produces audit rows cannot read them back, edit them or suppress them (`Schema.md` §2.2 property 1).
4. `AC-ADMN-02.3` holds verbatim: given an audit record exists, no interface, API or role permits modification (`AC-FND-11.3`).
5. A background job writing to an audited entity produces a row through the **same** `AuditWriter` primitive — coverage is not HTTP-shaped (`AC-FND-11.2`, `BR-DAT-01-N2`).
6. Rows are queryable by entity and by actor through the two named indexes, and `EXPLAIN` shows an index scan, not a sequential scan, at seeded volume (`BAC-13`, `AC-FND-11.5`).
7. Before-state capture adds **no second read** to a hot path — the before image comes from the aggregate already loaded by the use case (`AC-FND-11.6`, `TR-32`).
8. A **new partition** created by the maintenance job inherits its policy and its grants; reading `audit_log_y2026m11` **by name** as tenant A returns no tenant-B row (`CI-10`, `§2.3.3` obligation 7, `ERD.md` §11.4).
9. `before` and `after` are redacted through the same deny-list as the logger — an audit row is not a `BR-DAT-06` loophole.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `audit-grants.int-spec.ts` | Integration | `RS-9`: `UPDATE`/`DELETE` as `app_rw` raise; `SELECT` as `app_append` raises (`CI-09`) |
| `audit.interceptor.spec.ts` | Unit | `@Audited()` produces exactly one row per mutation; an un-annotated handler produces none |
| `audit-partition.int-spec.ts` | Integration | `CI-10`: a freshly created partition, read by name, is policed and granted identically |
| `audit-write.job.int-spec.ts` | Integration | A job-path write produces an audit row (`BR-DAT-01-N2`) |
| `audit-redaction.spec.ts` | Unit | A `before`/`after` pair containing `phone`, `pan` and `health_notes` is redacted |
| `audited-annotation.spec.mjs` | Unit | An entity in one of the seven classes without `@Audited()` fails CI |

**Rollback plan** — Migration phase: **expand**. Contract is a later `drop` migration, never an edit
(PM-4). The interceptor is behind no flag: an audit write that fails must fail the **request**, not
be skipped, so there is deliberately no kill-switch. If audit writing becomes an availability
problem the correct response is to scale the `app_append` pool, recorded in `docs/runbooks/audit.md`.

**Notes** — The trap is a trigger instead of a grant. A trigger can be disabled by the table owner
and the maintenance job runs as the owner; `RSK-08` scores that failure mode 2 × 5. The grant is the
only control that survives the application being wrong (`ERD.md` §10.2), which is why the trigger of
`§2.8.2` is explicitly the **second** line and never the only one. Second trap: partitions inherit
neither policies nor grants, so `audit.partition-maintenance` must apply both, and `CI-10` is the
test that proves it did.

---

### M-014 — `runElevated()` — platform scope as a named, audited call

| Field | Value |
| :--- | :--- |
| **Sprint** | 0 |
| **Epic** | EP-01 · F-01.8 · T-01.15 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — The only way to read across tenants is an explicit function call carrying a reason and an
actor, executed on a `SELECT`-only role, audited before the work happens — and there is no ambient
capability to elevate.

**Depends on** — M-010, M-011, M-013.

**Unblocks** — M-015, M-030.

**Files**

- `apps/server/src/tenancy/prisma/platform-elevation.ts` — `runElevated(reason: NonEmptyReason, actor: HumanActor | SystemActor, scope: ElevationScope, fn)`; the reason is required **at the type level** and re-checked at runtime.
- `apps/server/src/tenancy/prisma/platform-prisma.service.ts` — the `app_platform_ro` client; separate pool, `SELECT` grants only.
- `apps/server/src/tenancy/context/tenant-context.vo.ts` — the `PLATFORM` arm of the union becomes reachable.
- `packages/config/dependency-cruiser/index.cjs` — `PlatformPrismaService` importable **only** from `admin/`, `reporting/`, `settlements/`, `audit/` (`AC-FND-05.3`).
- `packages/config/scripts/elevation-inventory.mjs` — emits every `runElevated` call site with its permission and scope; diffed against `apps/server/test/isolation/_elevation-inventory.committed.json` (`PE-T7`).
- `apps/server/test/isolation/platform-elevation.int-spec.ts` — `PE-T1` … `PE-T9`.
- `docs/runbooks/tenancy.md` — the elevation section: how to read the inventory, what growth means.

**Acceptance criteria**

1. `runElevated()` is the **only** cross-tenant path; there is no ambient capability, no request-scoped elevation flag and no elevated session (`AC-FND-05.1`, `PE4`).
2. Every call writes an `audit_log` row **before** the work, carrying actor, permission, stated reason, scope, correlation id and IP (`AC-FND-05.2`, `PE-T2`, `PE2`).
3. A missing or empty `reason` is refused at the type level and, defensively, at runtime — an unexplained cross-tenant read is indistinguishable from an attack in the audit log (`PE-T9`, `FR-ADMN-02`).
4. Under `READ_ALL_TENANTS` scope an attempted `INSERT`, `UPDATE` or `DELETE` raises `permission denied` at the **grant** level, because `app_platform_ro` holds no write grant (`PE-T4`, `PE1`).
5. Elevation is bounded to the single call: the next query on the same request context is tenant-scoped again, proven by asserting `current_setting('app.tenant_id')` after the callback returns (`PE-T6`).
6. Elevation is **never** available during impersonation, and is not available to `SUPPORT_AGENT` for financial mutation — both assertions exist now as refusals against the scaffolded principal and are re-run against real roles in M-025 (`PE-T5`, `AC-AUTH-03.2`).
7. The elevation inventory is emitted by CI and diffed against the committed copy; growth requires the two `CODEOWNERS` reviewers on `apps/server/src/tenancy/**` (`PE-T7`, `PE5`).
8. No role acquires `BYPASSRLS` to make this work — the elevated role's authority is a **second policy** visible in `pg_policies`, not an invisible attribute in `pg_roles` (`Schema.md` §2.6, `PE1`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `platform-elevation.int-spec.ts` — `PE-T1`, `PE-T2`, `PE-T4`, `PE-T6`, `PE-T9` | Isolation | Cross-tenant read succeeds and returns rows from more than one tenant; the audit row precedes the work; writes raise; scope ends with the callback; empty reason refused |
| `platform-elevation.arch-spec.ts` | Architecture | `PlatformPrismaService` unreachable outside the four allowed modules |
| `elevation-inventory.spec.mjs` | Unit | An added call site not in the committed inventory fails the build |
| `run-elevated.spec.ts` | Unit | `NonEmptyReason` rejects `''`, `'   '` and `undefined` at compile time and at runtime |

**Rollback plan** — `git revert`. Nothing depends on elevation until M-015 uses it for the A2
byte-identity checksum and M-030 uses it for the cross-tenant duplicate pre-checks. Because
elevation is a *capability*, its rollback is genuinely a revert and never a flag — a flag that
disables elevation would leave the audit trail describing calls that did not happen.

**Notes** — The subtle point: `runElevated` is used by the **isolation suite itself** (M-015) to take
the before/after checksum in assertion A2, with the reason string
`"isolation-suite byte-identity check"`. That call is audited like any other, and `PE-T2` asserts
those rows appear. A test harness that bypassed elevation to read tenant B's row would be testing a
path that does not exist in production.

---

### M-015 — THE CROSS-TENANT ISOLATION SUITE

| Field | Value |
| :--- | :--- |
| **Sprint** | 0 |
| **Epic** | EP-01 · F-01.7 · T-01.16, T-01.17, T-01.19 |
| **Size** | 6h |
| **Role** | BE |

> **This is the single most important milestone in the roadmap.** `BAC-10` is a **business**
> acceptance criterion, not an internal quality measure: it is the artefact handed to the
> penetration tester (`Security.md` §4.6), the evidence for `OBJ-07` in an Enterprise sales
> conversation, and — under the DPDP Act 2023 — the control that stands between an ordinary coding
> mistake and a reportable personal-data breach. It is reviewed by the Technical Lead personally
> and requires two `CODEOWNERS` approvals.

**Goal** — A **generated** suite derives every tenant-scoped route from the OpenAPI document, applies
seven assertions to each, proves the policies refuse in raw SQL with no application tier present,
proves the suite itself would go red if RLS were disabled, and **fails the build for any
tenant-scoped endpoint that has no case group**.

**Depends on** — M-008, M-009, M-010, M-011, M-012, M-013, M-014.

**Unblocks** — every endpoint-bearing milestone from M-021 onward. Nothing that exposes a
tenant-scoped route may merge before this exists.

**Files**

- `apps/server/test/isolation/_inventory.ts` — the generator; source-of-truth precedence is (1) the `@nestjs/swagger` document, (2) the Nest route table via `DiscoveryService` used **only** to cross-check (`IG-A` … `IG-F`).
- `apps/server/test/isolation/_inventory.generated.ts` — **committed**, so a regeneration that silently drops routes shows up as deleted lines under `CODEOWNERS` review (`IG-E`).
- `apps/server/test/isolation/_assertions.ts` — A1 … A6 as reusable functions, including `platformChecksum()` which hashes every column of a row through `runElevated`.
- `apps/server/test/isolation/_exceptions.ts` — the declared exception list: route, reason, alternative control, owner. **Length is reported in the CI job summary and is a number that should shrink.**
- `apps/server/test/isolation/tenancy.isolation-spec.ts` — regenerated; the hand-written version from M-012 is **deleted** in this commit (R-M3).
- `apps/server/test/isolation/rls-policy.sql-spec.ts` — extended to the full `RS-1` … `RS-12`, with `RS-2`, `RS-3` and `RS-11` **parameterised over every table** returned by the `IS6` query.
- `apps/server/test/isolation/prisma-extension.int-spec.ts` — `PX-1` … `PX-9` promoted out of `tenancy/` into the suite.
- `apps/server/test/isolation/dropped-policy.negative-spec.ts` — the A7 negative control.
- `apps/server/test/isolation/reference-exemption.int-spec.ts` — asserts the RLS-exempt list is **exactly** the eleven `§C2.3` reference tables plus the reviewed `GLOBAL`/`IDENTITY` additions, by diffing `pg_class`/`pg_policies` against a committed list (`RS4`, `BR4`).
- `packages/config/scripts/isolation-coverage.mjs` — the `IG-1` … `IG-6` gate.
- `.github/workflows/pr.yml` — job **13** `isolation`, `TURBO_FORCE` set, never cached, never affected-filtered; `PG-4` moves here.
- `.github/workflows/nightly.yml` — the production cross-tenant canary definition and its `§16.7` rollback wiring (T-01.19).
- `docs/features/tenant-isolation.md` — the five §21.3 sections.

**The seven per-route assertions, as built**

| # | Assertion | Concretely, for a route `R` and tenant-B resource `b` | Catches |
| :-: | :--- | :--- | :--- |
| **A1** | Read refused | `GET R(b)` as A → `404` with `RESOURCE_NOT_FOUND` in the `§C3.1` envelope, and the body contains **no** field derived from B's row | Existence disclosure; a `403` that confirms the resource exists |
| **A2** | Write refused with byte-identity | `POST`/`PATCH`/`PUT`/`DELETE` `R(b)` as A → `404`, **and** a checksum of B's row taken before and after through `runElevated` is identical | *"A 404 with a completed side effect is the worst possible outcome"* |
| **A3** | Collections filtered, not per-row checked | `GET R` as A returns exactly `SEED.tenantA.<count>` rows, asserted by **count** against a direct tenant-scoped query, and every row's `tenant_id` is A | A guard that leaks the count, the facets or the pagination total |
| **A4** | Positive control non-empty | The same route against A's **own** seeded resource returns `200` with a **non-empty** body | The catastrophic false pass — a globally broken tenant variable |
| **A5** | The leaky six, by name | Search, reports, exports, the audit explorer, notification delivery logs and settlement statements are covered **by name**, because `E2E-11` and `IS5` name them | Routes that do not *look* like a resource read |
| **A6** | Session variable set inside the transaction | During the A4 call, a `pg_stat_activity` probe plus a `current_setting('app.tenant_id')` assertion inside the same transaction | `TR-01` / `TD-010`; invisible to any black-box request test |
| **A7** | Dropped-policy negative control | On a **scratch** container with `ALTER TABLE … DISABLE ROW LEVEL SECURITY`, a representative subset of A1–A3 must **fail** | Without it, the other six are unfalsifiable |

**Acceptance criteria**

1. The inventory is **generated**, not authored. A `@TenantScoped()` route added on a Friday afternoon with no spec fails the build with `Handler <METHOD> <path> is @TenantScoped but absent from the isolation inventory` (`IG-1`, `IS3`, `PG-4`, `AC-FND-04.2`, DoD #16).
2. `IG-2` fails a case group targeting a route that no longer exists, so dead cases cannot accumulate and inflate apparent coverage.
3. `IG-3` fails a route of kind `ITEM` or `ACTION` for which the seed supplies no tenant-B id — a seed defect fails **here**, never as a silent skip.
4. `IG-4` fails a `COLLECTION`, `SEARCH`, `REPORT` or `EXPORT` route whose tenant-A expected count is zero, because A4 could not then prove anything.
5. `IG-5` asserts the suite runs unfiltered and uncached: job 13 fails if `TURBO_FORCE` is unset (`CI_CD.md` §3.4).
6. `IG-6` is satisfied upstream — a `@TenantScoped()` handler with no `@RequiredPermission()` fails job 8 before the inventory is built.
7. `expectedRefusal` follows `API_Catalog.md` §2.3: a cross-tenant **item** read is `404`, **never** `403`; collections and searches return an **empty set**, not an error; only a route whose documented behaviour is `403` expects `403` (`IG-D`).
8. **A7 is the falsifiability proof.** On a scratch container with RLS disabled on `memberships`, `orders` and `ledger_entries`, the re-run subset must **fail**; if it passes, the spec fails the build with `Isolation suite passes with RLS disabled — it is not exercising the database policy` (`E0.4`, `AC-EP01-04`).
9. `RS-11` parameterises the raw-SQL refusal cases over **every** table returned by the `IS6` query, so a policy correct on the tables someone thought of and absent on the rest is caught (`§5.8`).
10. The non-tenant audiences are each handled rather than skipped: public reads get the publishable-field projection test; `/me` routes assert they return the user's memberships across **all** their tenants and none from anyone else's; `/admin` routes go to the inverted suite of M-014; `/webhooks` asserts the tenant is derived from the **stored** payment intent and never from the payload; the eleven reference tables are diffed against the committed exemption list; `/healthz` is asserted to expose no internal detail (`§5.5`).
11. Every excluded route appears in `_exceptions.ts` with a route, a reason, the alternative control and an owner, and the list length is printed in the job summary (`§5.5`).
12. The hand-written `tenancy.isolation-spec.ts` from M-012 is **deleted** in this commit, and a lint rule fails any manual edit to `_inventory.generated.ts` (`IG-F`, R-M3).
13. Job 13's summary reports endpoints covered, endpoints uncovered (**must be zero**) and the positive-control results (`CI_CD.md` §4.5).
14. The production canary is **defined** — two synthetic canary tenants, six probed routes, 60-second cadence, the `tenant_isolation_violations_total` counter that must be zero, and the automatic rollback trigger on non-zero (`§5.12`, `§16.7`). It is wired in `nightly.yml` and armed at the first staging deploy, not before.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `*.isolation-spec.ts` (generated) | Isolation | A1 … A6 per tenant-scoped route; today that is `GET /v1/tenant/ping` |
| `dropped-policy.negative-spec.ts` | Isolation | A7 — the subset **fails** with RLS disabled; a green result here fails the build |
| `rls-policy.sql-spec.ts` `RS-1` … `RS-12` | Isolation (raw `pg`) | Policies refuse with no NestJS and no Prisma in the picture (`NFR-SEC-09`) |
| `prisma-extension.int-spec.ts` `PX-1` … `PX-9` | Isolation | Same connection, `is_local`, pool starvation, missing context, `$allModels`, nested-transaction, raw-client unreachable, sanctioned raw SQL scoped, public client narrow |
| `reference-exemption.int-spec.ts` | Isolation | The exemption list is exactly the reviewed set; `PC2` converse holds |
| `isolation-coverage.spec.mjs` | Unit | Six fixtures, one per `IG-` gate, each failing with its own message |

**Rollback plan** — **There is no rollback for this milestone.** Reverting it removes a merge gate
rather than a feature, and `CI_CD.md` §0.5 marks invariant **I1** *unwaivable*: a failing isolation
gate is never re-run "to see if it passes" and never waived. If the suite is wrong, the fix is
forward — correct the generator, never delete the case. If the suite is *slow*, the answer is more
runner CPU: `CI_CD.md` §3.6 states plainly that removing job 13 from the critical path *"is not a
lever; it is the failure the pipeline exists to prevent"*. The only revertible artefact here is the
canary's `nightly.yml` schedule.

**Notes** — Four traps, each of which has produced a green suite that proved nothing in some other
programme.

1. **Generation, not authorship.** A hand-authored suite measures the diligence of whoever last
   added a test; a generated suite measures the system (`§5.2`). This is settled and is not
   revisited.
2. **A4 before A1.** Write the positive control first. If tenant A cannot read its own row, A1–A3
   are vacuous and the suite is a very expensive `expect(true)`.
3. **A2's checksum, not A2's status code.** A `404` with a completed write is the exact shape
   produced by a session-only tenant check that filters the response but not the mutation. The
   before/after hash is the assertion; the status code is the decoration.
4. **The suite polices the people who wrote it.** QA does not join until Sprint 2 (`C9.3`). The
   mitigation is on the board: the Technical Lead reviews every isolation spec personally, and
   Sprint 2 task 2.19 is a full QA audit of this suite hunting for false passes. Do not treat that
   audit as a formality — `E0.5` exists because someone expected it to be one.

---

### M-016 — `Money`, the Indian formatter, the `Clock` port and time discipline

| Field | Value |
| :--- | :--- |
| **Sprint** | 0 |
| **Epic** | EP-01 · F-01.2, F-01.18 · T-01.04, T-01.05, T-01.06, T-01.33 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Money is integer minor units with an explicit currency and arithmetic only through its own
methods, `₹2,50,000.00` renders from one formatter, and no domain code can call `new Date()`.

**Depends on** — M-002, M-003.

**Unblocks** — M-021 (OTP TTL), M-022 (token expiry), M-028 (submission timestamps), and every
money-bearing milestone from Sprint 5.

**Files**

- `apps/server/src/common/money/money.ts` — the value type; `add`, `subtract`, `multiplyByBps`, `negate`, `allocate`, `compare`; **no operator arithmetic escapes the class**.
- `apps/server/src/common/money/money.errors.ts` — `CURRENCY_MISMATCH`.
- `packages/utils/src/money/{minor-units.ts,round-half-even.ts,allocate.ts,basis-points.ts,format-indian-grouping.ts,format-currency.ts}` + one `*.spec.ts` each.
- `packages/utils/src/time/{gym-timezone.ts,validity-window.ts,local-midnight-utc.ts,financial-year.ts}` + specs.
- `apps/server/src/common/clock/{clock.port.ts,system-clock.adapter.ts,fixed-clock.adapter.ts,id-generator.port.ts}`.
- `packages/config/eslint/rules/no-bare-date.cjs` + spec — bans `new Date()` and `Date.now()` in domain code; the `Clock` port is injected instead (`AC-FND-13.3`).
- `packages/config/eslint/rules/no-float-money.cjs` — enabled repository-wide (declared in M-002, switched on here now that `Money` exists).
- `apps/server/src/common/money/money.property-spec.ts` — property-based cases to **100% line and branch**.
- `.github/workflows/pr.yml` — job **7** `unit` added with the eight 95% globs, the 100% money glob and the non-empty-glob assertion; `CI-04` promoted from vacuous to enforcing.
- `infra/` — worker clock-skew monitor definition (`TR-21`).

**Acceptance criteria**

1. Every monetary value is `bigint` minor units with an adjacent explicit `currency char(3)`; for India that is **paise** (`BR-PAY-01`, `NFR-DQ-02`, `AC-FND-06.1`, `LAUNCH_MARKET_INDIA.md` §2).
2. Adding two `Money` values in different currencies throws `CURRENCY_MISMATCH` rather than coercing (`AC-FND-06.3`).
3. 250,000 paise renders `₹2,500.00`; **25,000,000 paise renders `₹2,50,000.00`** with lakh grouping — from **one** formatter in `packages/utils`; a hand-rolled formatter elsewhere fails review (`AC-FND-06.4`, `AC-EP01-13`).
4. Rounding is `round_half_even` and is the **only** rounding in the money path (`A6.3`, `AC-FND-06.5`).
5. `allocate()` uses largest-remainder so parts sum **exactly** to the whole, proven by a property test over 10,000 random splits (`BR-FIN-03`).
6. A `Money` crossing the API boundary is a **string** or a structured object, never a JavaScript `number`; a contract test proves no precision is lost above 2^53 paise (`AC-FND-06.6`, `TR-38`).
7. `no-float-money` fails a `number`-typed field named `amount`, `price`, `fee`, `total`, `balance` or `*_minor` (`AC-FND-06.2`).
8. Coverage on `packages/utils/money` is **100% line and 100% branch** with no exemptions; the glob is asserted non-empty (`§17.5`, `AC-EP01-12`).
9. Every business-date function takes an **explicit `IanaTimeZone` argument**; there is no default parameter (`AC-FND-13.2`, `§C1.5`).
10. `local-midnight-utc.ts` returns **18:30 UTC on the previous day** for `00:00 Asia/Kolkata` — the +05:30 offset with no DST (`LAUNCH_MARKET_INDIA.md` §3, `TR-24`).
11. `financial_year.ts` takes the FY start month as a **parameter**; India is April, and the value comes from the tax profile, never a constant (`FR-INV-02`, `LAUNCH_MARKET_INDIA.md` §5).
12. `new Date()` or `Date.now()` in domain code fails lint; the `FixedClock` adapter makes time testable (`AC-FND-13.3`).
13. Timestamps are stored UTC with the applicable IANA zone stored alongside wherever local interpretation matters; `CI-05` fails any `timestamp without time zone` (`AC-FND-13.1`, `DB6`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `money.property-spec.ts` | Unit (property-based) | Associativity and commutativity of `add`; `allocate` sums exactly; `round_half_even` at every half-way case; 100/100 coverage |
| `format-indian-grouping.spec.ts` | Unit | `₹2,500.00`, `₹2,50,000.00`, `₹1,00,00,000.00`, zero, and the negative case |
| `money-boundary.contract-spec.ts` | Contract | 9,007,199,254,740,993 paise survives a round trip as a string (`TR-38`) |
| `local-midnight-utc.spec.ts` | Unit | `Asia/Kolkata` midnight → 18:30 UTC previous day; a DST-observing zone included so the design does not *depend* on India's lack of DST |
| `no-bare-date.spec.cjs`, `no-float-money.spec.cjs` | Unit (`RuleTester`) | Both rules bite on their fixtures |

**Rollback plan** — `git revert`. No table, no endpoint, no flag. Reverting also removes job 7's
coverage thresholds, which is why the revert must be a single commit — a partial revert leaving the
thresholds without the code would fail the non-empty-glob assertion, which is the intended
behaviour.

**Notes** — `KPI-26` sets settlement accuracy at **100%**, which is arithmetically unreachable if
money is ever a float or if rounding happens twice. Building this in Sprint 0 rather than Sprint 5
is deliberate: `EP-01` §2 puts it plainly — the primitives exist *before the first rupee moves*. The
timezone trap is `TR-07`/`TR-24`: a naive hourly UTC cron fires at the wrong local moment for every
one of the 24 `§C5` jobs, because midnight gym-time in India is 18:30 UTC the **previous day**. The
seed represents three timezones for exactly this reason (`AC-FND-13.4`).

---

### M-017 — `idempotency_keys` and the idempotency interceptor

| Field | Value |
| :--- | :--- |
| **Sprint** | 0 |
| **Epic** | EP-01 · F-01.9 · T-01.20, T-01.21, T-01.22 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — A retried mutating request has the same effect as one request, a reused key with a
different body is refused, and two concurrent requests carrying the same key produce exactly one
execution — all in place **before** the first payment path exists.

**Depends on** — M-006, M-008, M-010, M-013.

**Unblocks** — M-021, M-022, M-028, and every `REQ`-class endpoint in the programme.

**Files**

- `apps/server/prisma/migrations/<ts>_create_idempotency_keys/migration.sql` — `key`, `endpoint`, `request_hash`, `response_status`, `response_body jsonb`, `tenant_id`, `created_at`, `expires_at`; `uq_idempotency_keys__key`; RLS `P-STD` + `P-PLATFORM`; grants `G-CRUD` minus `DELETE` (the sweep runs as `app_migrator`).
- `apps/server/src/common/idempotency/{idempotency.interceptor.ts,idempotency.store.ts,request-fingerprint.ts}` + specs.
- `apps/server/src/common/decorators/idempotent.decorator.ts` — `@Idempotent('REQ' | 'OPT')`; declared in M-008, given behaviour here.
- `apps/server/src/common/idempotency/idempotency.errors.ts` — `IDEMPOTENCY_KEY_REQUIRED` (400), `IDEMPOTENCY_KEY_REUSED` (409).
- `apps/server/src/common/idempotency/jobs/idempotency-sweep.processor.ts` — declared; scheduled by M-018.
- `apps/server/test/isolation/` — regenerated inventory; no new route, so no new case group, and `IG-2` confirms nothing became stale.
- `docs/DECISION_LOG.md` — the retention-window comparison against the payment provider's retry window, recorded with the numbers (`TR-36`, `AC-FND-07.5`).

**Acceptance criteria**

1. A `§14.2.1` **REQ**-class endpoint called with no `Idempotency-Key` returns `400 IDEMPOTENCY_KEY_REQUIRED` (`AC-FND-07.1`).
2. The same key with the **same** request fingerprint inside 24 hours returns the stored response with **no side effects** (`AC-FND-07.2`, `BR-PAY-03`).
3. The same key with a **different** fingerprint returns `409 IDEMPOTENCY_KEY_REUSED` (`AC-FND-07.3`).
4. Two concurrent requests with the same key: exactly one executes; the other **waits for and returns** the stored result. Proven by a concurrency test, not a sequential one (`AC-FND-07.4`).
5. The fingerprint neither over- nor under-matches: it covers method, path, tenant and a canonicalised body, and **excludes** volatile headers such as `User-Agent` and `traceparent`, so the same logical retry from a different client build is still a retry.
6. Retention is **configuration**, is ≥ the payment provider's retry window, and the comparison is recorded with both numbers (`AC-FND-07.5`, `TR-36`).
7. `idempotency_keys` is tenant-owned and carries its RLS policy and grants in the same migration (R-6); `uq_idempotency_keys__key` is one of the five closed `SC-R06` exceptions permitted not to lead with `tenant_id`, because the key is already unique across the table (`Schema.md` §2.9).
8. A stored response is replayed **byte-identically**, including its `correlation_id`, so a support agent tracing a retry finds the original request.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `idempotency.interceptor.spec.ts` | Unit | The four `BR-PAY-03` paths: missing key, same fingerprint, different fingerprint, expired key |
| `request-fingerprint.spec.ts` | Unit | Key ordering, whitespace and header noise do not change the hash; a changed body value does |
| `idempotency-concurrency.int-spec.ts` | Integration | Twenty simultaneous identical requests → **one** execution, twenty identical responses (`AC-FND-07.4`) |
| `idempotency-rls.int-spec.ts` | Integration | Tenant B cannot read or replay tenant A's key (`BR-TEN-01`) |

**Rollback plan** — Migration phase: **expand**. The interceptor is behind flag
`ops.common.idempotency-replay` (**new** — register in `FEATURE_FLAGS.md` §7 in this PR, DoD #25),
whose *pulled* position stores keys but does not replay, so a defective fingerprint cannot turn a
legitimate second purchase into a replayed first one. The flag never disables **storage**, because a
gap in the store is unrecoverable.

**Notes** — `SprintPlanning.md` Sprint 5–6 states the scheduling rule and this milestone honours it:
*"Idempotency (`BR-PAY-03`) must be in place before the first payment path ships, not
retrofitted."* The trap is a fingerprint that includes a timestamp or a client-generated request id,
which makes every retry a `409` and turns a safety mechanism into an outage. Canonicalise the body,
sort the keys, exclude the volatile headers, and test the negative case explicitly.

---

### M-018 — Transactional outbox, the `SKIP LOCKED` dispatcher and the BullMQ job harness

| Field | Value |
| :--- | :--- |
| **Sprint** | 0 |
| **Epic** | EP-01 · F-01.10, F-01.17 · T-01.23, T-01.31 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A domain event is written in the **same transaction** as the state change it describes,
dispatched exactly once by any number of workers, dead-lettered rather than allowed to stall the
queue — and every one of the 24 `§C5` jobs has a harness with locks, run records and duration alerts
to run on.

**Depends on** — M-010, M-013, M-016.

**Unblocks** — M-021, M-022, M-028, M-029, M-030; every `§C5` job in the programme.

**Files**

- `apps/server/prisma/migrations/<ts>_create_outbox/migration.sql` — `outbox`: `aggregate_type`, `aggregate_id`, `event_type`, `payload jsonb`, `status`, `attempts`, `available_at`, `published_at`, `last_error`, `tenant_id`, `occurred_at`; RLS `P-STD` + `P-PLATFORM`; grant class **G-COMPLETE** — `SELECT, INSERT` plus column-scoped `UPDATE (status, published_at, attempts, last_error, available_at)`; index `(status, available_at)` leading with `tenant_id` per `SC-R06` except where the dispatcher's platform scan requires otherwise, recorded in `Indexes.md`.
- `apps/server/prisma/migrations/<ts>_create_job_runs/migration.sql` — `job_runs`: job name, lock scope, `started_at`, `ended_at`, outcome, error, correlation id.
- `apps/server/src/common/outbox/{outbox.writer.ts,outbox.dispatcher.ts,outbox.port.ts}` + specs.
- `apps/server/src/common/queue/{queue.registry.ts,distributed-lock.ts,timezone-schedule.ts,job-runner.ts}` + specs — the harness all 24 `§C5` jobs consume.
- `apps/server/src/worker.ts` — registers the dispatcher and the harness; still binds no HTTP listener.
- `apps/server/src/audit/jobs/audit-partition-maintenance.processor.ts` — **the harness's first consumer** (`TR-41`).
- `apps/server/src/common/idempotency/jobs/idempotency-sweep.processor.ts` — the second consumer.
- `apps/server/src/notifications/ports/{email,sms,in-app,web-push}.channel.port.ts` — the four EP-17 F-17.1 channel **ports** with a Mailpit local adapter; vendors deferred (A-19).
- `docs/runbooks/common.md` — outbox backlog, dead-letter drain, lock contention.

**Acceptance criteria**

1. An `outbox` row commits in the **same transaction** as the state change; if the transaction rolls back, no event is dispatched because the row rolled back too (`AC-FND-08.1`, `AC-FND-08.2`).
2. Multiple dispatcher workers polling concurrently claim each row **exactly once** under `FOR UPDATE SKIP LOCKED` (`AC-FND-08.3`, `TR-08`).
3. A dispatch failing beyond the configured attempt count moves to a dead-letter state, fires an alert, and **does not stall the dispatcher behind it** (`AC-FND-08.4`).
4. A retention sweep removes dispatched rows older than the configured window so the table cannot grow without bound (`AC-FND-08.5`, `TR-20`).
5. A job scheduled on more than one worker executes **once** per schedule fire, enforced by a distributed lock; a deliberate double-trigger is part of the demo (`AC-FND-12.1`, `TR-25`, `AC-EP01-19`).
6. Every job records start, end and outcome in `job_runs`, emits metrics, and alerts on failure **and** on exceeding its expected duration (`AC-FND-12.2`).
7. Every job is idempotent by construction — all 24 `§C5` jobs are marked *Idempotent: Yes*, and the harness re-runs a partially-failed job in the integration test to prove it (`AC-FND-12.3`).
8. A job scheduled "per gym timezone" fires at the correct **local** moment for `Asia/Kolkata`: midnight gym-time is 18:30 UTC the previous day (`AC-FND-12.4`, `TR-24`), computed through `local-midnight-utc.ts` from M-016 and never by a naive UTC cron.
9. The worker tier is separate from the request tier and cannot starve request handling; `worker.ts` binds no listener (`AC-FND-12.5`, `NFR-SCAL-05`).
10. The correlation id propagates from the originating HTTP request into the job's logs and spans (`AC-FND-09.5`, DoD #29).
11. `outbox` and `job_runs` each carry RLS and grants in their own migration (R-6); the dispatcher's cross-tenant scan runs through `runElevated` with the reason `"outbox dispatch"` and is therefore audited (M-014).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `outbox.writer.int-spec.ts` | Integration | Commit writes the row; rollback leaves none; the write shares the use case's single interactive transaction (`P4`) |
| `outbox.dispatcher.int-spec.ts` | Integration | Four concurrent dispatchers over 500 rows → each row claimed once; dead-letter after N attempts; the queue keeps draining past a poisoned row |
| `distributed-lock.int-spec.ts` | Integration | A deliberate double-trigger yields one execution and one `job_runs` row |
| `timezone-schedule.spec.ts` | Unit | `Asia/Kolkata` daily-at-midnight resolves to 18:30 UTC previous day; a DST zone included |
| `job-correlation.int-spec.ts` | Integration | The HTTP correlation id appears on the job's log lines and span |
| `outbox-rls.int-spec.ts` | Integration | Tenant B cannot read tenant A's outbox rows |

**Rollback plan** — Migration phase: **expand** for both tables. The dispatcher is behind kill-switch
`ops.notifications.dispatch` (already catalogued in `FEATURE_FLAGS.md` §7): *pulled*, the outbox and
the delivery queue stop draining and **nothing is lost**, because domain events keep landing in the
outbox in the same transaction as their state change and drain under the per-recipient rate limit on
restore. The harness itself is reverted by `git revert`; the two consumer processors are removed by
the same commit.

**Notes** — Two traps. First, writing the outbox row through a **second** connection "because the
writer is a different service" destroys the entire guarantee — the row must be written by the same
`UnitOfWork` transaction the aggregate is saved in (`P4`, `§C1.5`). Second, `TR-20`: a dispatcher
with no pruning sweep is a table that grows forever and a `(status, available_at)` index that
degrades until dispatch latency breaches the `BAC-02` 60-second listing-publication window in Sprint
2. The sweep ships **here**, not when someone notices.

---

# PART C — IDENTITY, SESSIONS AND RBAC (M-019 … M-025)

> **Prerequisite, restated.** Not one milestone in this part may start before **M-009 … M-016** are
> merged and green, and every one of them writes tenant data, so M-017 (idempotency) and M-018
> (outbox) are prerequisites too. `EP-02` §1 lists its dependency as *"**EP-01** (all of it)"*.
> Every endpoint below ships its generated isolation case group in the same milestone (R-5).

### M-019 — Identity and RBAC tables — `users` … `role_permissions`

| Field | Value |
| :--- | :--- |
| **Sprint** | 1 |
| **Epic** | EP-02 · F-02.1 · T-02.01 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — The five identity tables exist with the correct tenancy class — `users` and `user_roles`
are **IDENTITY, not RLS**; `roles`, `permissions` and `role_permissions` are **GLOBAL** — and the one
place in the schema where a `tenant_id` column legitimately has no policy is a *reviewed*, recorded
CI exception rather than a hole.

**Depends on** — M-009, M-013, M-015.

**Unblocks** — M-020, M-021, M-022, M-023, M-024, M-025, M-026.

**Files**

- `apps/server/prisma/migrations/<ts>_create_identity_tables/migration.sql` — `users` (`email`, `phone`, `full_name`, `password_hash`, `status`, `email_verified_at`, `phone_verified_at`, `pseudonym_token`, `erased_at`, `deleted_at`), `user_roles` (`user_id`, `role_id`, **nullable** `tenant_id` as the platform/tenant discriminator, `granted_at`, `revoked_at`), `roles` (the twelve `§B3.1` roles), `permissions` (~180 atomic capabilities with `scope`, `resource`, `action`), `role_permissions`.
- Constraints: `ck_users__has_contact CHECK (email IS NOT NULL OR phone IS NOT NULL)`; both unique indexes **partial on `deleted_at IS NULL`** so a soft-deleted account frees its address (`SD7`); `uq_user_roles__user_role_tenant`; `permissions.scope CHECK IN ('PUBLIC','SELF','TENANT','BRANCH','PLATFORM')`; `idx_users__status_created_at` for `SCR-ADM-005`.
- `apps/server/test/isolation/rls-coverage.sql` — the **reviewed exception** for `user_roles` added to the committed list, with its reason string.
- `apps/server/src/iam/{iam.module.ts,index.ts,README.md,permissions.ts,types/iam.types.ts}`.
- `apps/server/prisma/seed/{roles.ts,permissions.ts,users.ts}` — the twelve roles, the permission catalogue, and the `§C8.2` seeded principals; `SEED_VERSION → 0.2`.
- `docs/database/Schema.md` cross-reference tick; `docs/runbooks/iam.md` stub filled.

**Acceptance criteria**

1. `users`, `user_roles`, `auth`-adjacent identity data carry **no RLS policy**, because they are scoped by `user_id` and protected by authorisation; classing them RLS would produce the `/me/memberships` bug of `Schema.md` §1.3.
2. `user_roles` carries a `tenant_id` column **and** no policy. This is the single such table in the schema; `CI-01` carries an explicit, reviewed exception for it with a reason recorded in the committed list — an unexplained entry in a CI allowlist fails review (`Schema.md` §4.7).
3. `roles`, `permissions` and `role_permissions` are platform-global, grant class **G-REF**: `SELECT` to `app_rw`, writes only through the audited `admin/` path (`§C2.3`, `RS4`).
4. A platform role row has `tenant_id IS NULL`; a tenant role row always has one. The nullable column **is** the discriminator (`ERD.md` §3.1).
5. Revocation is `revoked_at`, never a delete, so attribution survives (`AC-STAF-01.4`).
6. Twelve roles exactly, matching `§B3.1` verbatim; a thirteenth requires a PRD amendment.
7. Erasure sets `email`, `phone`, `full_name`, `password_hash` to `NULL`, populates `pseudonym_token` and `erased_at`, and runs as `app_migrator` in the audited `data.retention-sweep` job — **never** as `app_rw` (`SD5`, `SD8`).
8. `SEED_VERSION` bumped; the seeded principals of `TestingStrategy.md` §6.6 exist with fixed uuids, including a member holding memberships at two tenants for the `/me` isolation cases (`§5.5`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `identity-tenancy-class.int-spec.ts` | Integration | `users`/`user_roles` have no policy; the `IS6` query's exception list is exactly the reviewed set (`PC2`) |
| `users-constraints.int-spec.ts` | Integration | `ck_users__has_contact` rejects a row with neither; the partial unique indexes permit re-registering a soft-deleted address |
| `roles-seed.int-spec.ts` | Integration | Twelve roles, ~180 permissions, every `role_permissions` row resolvable |
| `identity-grants.int-spec.ts` | Integration | `app_rw` cannot `INSERT` into `roles`/`permissions` (`G-REF`) |

**Rollback plan** — Migration phase: **expand**; contract is a later `drop` migration. The seed is
versioned, so a revert restores `SEED_VERSION = 0.1` and `dev:reset` reproduces it exactly.

**Notes** — The trap is "everything with a `tenant_id` gets RLS", applied mechanically. `user_roles`
is the mechanism by which a tenant sees a person at all; an RLS policy on it would make every
platform-role row (`tenant_id IS NULL`) invisible to every session, and the symptom would be
super-admins losing their own permissions. The exception is correct, and it is written down because
controls rot when their exceptions are undocumented.

---

### M-020 — Argon2id credentials, password policy, breached list and lockout

| Field | Value |
| :--- | :--- |
| **Sprint** | 1 |
| **Epic** | EP-02 · F-02.2, F-02.7 · T-02.04, T-02.09 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A password is stored as an Argon2id hash with recorded parameters, a known-breached
password cannot be chosen, ten failures in fifteen minutes lock the account, and a reset invalidates
**every** session.

**Depends on** — M-016, M-017, M-019.

**Unblocks** — M-022, M-023, M-024.

**Files**

- `apps/server/src/iam/domain/{password.vo.ts,password-policy.ts,lockout.policy.ts,iam.errors.ts}` + specs.
- `apps/server/src/iam/infrastructure/adapters/argon2.hasher.adapter.ts` — Argon2id, parameters (memory, iterations, parallelism) tuned on the target instance class and **recorded in `DECISION_LOG.md`** (A-12).
- `apps/server/src/iam/infrastructure/adapters/breached-password.adapter.ts` — k-anonymity range query; a provider outage **fails open on the check and closed on the log**, never blocking registration silently.
- `apps/server/src/iam/application/{register-with-password.use-case.ts,request-password-reset.use-case.ts,reset-password.use-case.ts,verify-email.use-case.ts}` + specs.
- `apps/server/src/iam/controllers/auth.controller.ts` — `POST /v1/auth/register`, `POST /v1/auth/login`, `POST /v1/auth/password/forgot`, `POST /v1/auth/password/reset` (`apis/Authentication.md` §8.3, §8.4, §8.7, §8.8).
- `apps/server/src/iam/dto/*.{request,response}.dto.ts` + `*.openapi.ts`; schemas re-exported from `@gymmap/types/schemas/auth.schema.ts`.
- `apps/server/src/common/ratelimit/class-registry.ts` — `RL-AUTH` and `RL-OTP` classes activated (`NFR-SEC-06`, A-13).
- `apps/server/test/isolation/iam.isolation-spec.ts` — generated; these routes are `public` audience and are covered by the §5.5 public treatment plus the enumeration assertions below.
- `docs/features/password-authentication.md`.

**Acceptance criteria**

1. Passwords are ≥ 10 characters and are checked against a breached-password list by **k-anonymity range query** — the full password never leaves the process (`FR-AUTH-04`).
2. Argon2id parameters are explicit, recorded, and asserted by a test so a dependency upgrade cannot silently weaken them (A-12).
3. Ten failed attempts in fifteen minutes lock the account; unlock is self-service **through a verified channel** (`FR-AUTH-08`, `apis/Authentication.md` §6).
4. A password reset invalidates **all** sessions for that user, not just the current one (`FR-AUTH-10`).
5. Login timing and response shape are identical for an unknown address and a wrong password — no enumeration oracle (`Security.md` §1.6).
6. `POST /v1/auth/register` is `@Idempotent('OPT')`; a replayed key returns the stored response rather than a second verification email.
7. Every response uses the `§C3.1` envelope with a registry code; `VALIDATION_FAILED` names the field and **never echoes the value** (`AC-FND-09.6`).
8. Verification tokens are single-use, time-boxed, and stored **hashed** — the token itself is never persisted (`NFR-SEC-07`).
9. Rate-limit class `RL-AUTH` is applied and a burst test proves its ceiling; tier-1 classes **fail closed** when Redis is unavailable (`RLM3`).
10. Generated isolation coverage exists for all four routes; the `/me`-scoped assertions confirm no cross-user data is reachable (R-5, `IG-1`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `password-policy.spec.ts` | Unit | Length floor; breached rejection; the `NEGATIVE:` case for each (`BAC-06`) |
| `argon2.hasher.adapter.spec.ts` | Unit | Parameters equal the recorded values; a verify round trip; a wrong password fails |
| `lockout.policy.spec.ts` | Unit | The 10/15 boundary from both sides; unlock resets the counter |
| `reset-invalidates-sessions.int-spec.ts` | Integration | Every session row for the user is revoked in one transaction |
| `login-enumeration.int-spec.ts` | Integration | Unknown address and wrong password are indistinguishable by status, body and timing band |
| `auth.contract-spec.ts` | Contract | All four routes, request **and** response, against the generated document |

**Rollback plan** — Flag `rel.iam.password-authentication` (**new** — register in `FEATURE_FLAGS.md`
§7 in this PR): *off*, the password routes return `404` and phone OTP (M-021) is the only path, which
is the `FR-AUTH-01` consumer default anyway. The migration adding `password_hash` was already applied
in M-019, so no schema change is involved in the rollback.

**Notes** — The trap is the breached-password provider becoming a hard dependency of registration.
`CON-02` budgets third-party cost, and `NFR-AVL-*` does not permit a sign-up outage because a
reputation service is slow. The check times out fast, logs the miss, and lets the registration
proceed; the alternative is an availability incident caused by a control that is advisory.

---

### M-021 — Phone OTP request and verify — the `FR-AUTH-05` limits

| Field | Value |
| :--- | :--- |
| **Sprint** | 1 |
| **Epic** | EP-02 · F-02.1 · T-02.02, T-02.03 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — An Indian mobile number receives a 6-digit code valid for 5 minutes, with 5 verify
attempts, 3 resends per 30 minutes per number and an independent per-IP ceiling — and a number that
has no account is indistinguishable from one that does.

**Depends on** — M-016, M-017, M-018, M-019, M-020.

**Unblocks** — M-022, M-024, M-027.

**Files**

- `apps/server/src/iam/application/{request-otp.use-case.ts,verify-otp.use-case.ts}` + specs.
- `apps/server/src/iam/domain/{otp-challenge.vo.ts,otp-purpose.ts,otp.policy.ts}` + specs — purposes `REGISTER`, `LOGIN`, `PHONE_CHANGE`, `UNLOCK`, `SENSITIVE_STEP_UP`.
- `apps/server/src/iam/infrastructure/otp.redis-store.ts` — `otp:code:{purpose}:{phone_hmac}` holding the **HMAC**, `issued_at`, `attempts`, `generation`, TTL 300 s; `otp:resend:*` sorted set; `otp:ip:{ip_hash}` counter. **No PostgreSQL row is written** — an abandoned OTP flow leaves nothing (`SM1`).
- `apps/server/src/iam/controllers/auth.controller.ts` — `POST /v1/auth/otp/request` (`202`), `POST /v1/auth/otp/verify` (`200`).
- `apps/server/src/iam/dto/otp-{request,verify}.{request,response}.dto.ts` — `indianPhone` = `/^\+91[6-9]\d{9}$/`, `.strict()` so any extra field is `400`.
- `apps/server/src/common/errors/error-code.registry.ts` — `OTP_INVALID`, `OTP_EXPIRED`, `OTP_ATTEMPTS_EXCEEDED`, `OTP_RESEND_LIMIT_REACHED`, `OTP_RESEND_TOO_SOON`, `PHONE_ALREADY_REGISTERED`, `CAPTCHA_REQUIRED` (`apis/Authentication.md` §14.3).
- `apps/server/src/notifications/` — the outbox → `notification.dispatch` path using the M-018 SMS **port** with the Mailpit/stub adapter; `notification_log` row carries the template variables' **names**, never the code (DLT-5).
- `docs/features/phone-otp.md`.

**Acceptance criteria**

1. Six digits, **300-second** validity, **5** verify attempts per code, **3** sends per 30 minutes per number, a **30-second** cool-down between sends, and **20** OTP operations per hour per IP (`FR-AUTH-05`, `apis/Authentication.md` §8.1).
2. The 4th send in 30 minutes returns **`429 OTP_RESEND_LIMIT_REACHED`** with `retry_after_seconds` and a `Retry-After` header, **and no SMS is sent** — the budget is checked **before** the outbox enqueue, never after (`AC-AUTH-01.4`).
3. A send inside the 30-second cool-down returns `429 OTP_RESEND_TOO_SOON`.
4. Above 10 per-IP operations in the current hour, a `captcha_token` becomes required and its absence returns `403 CAPTCHA_REQUIRED` — the challenge arrives **before** the block (`§8.1` validation table).
5. `purpose: 'LOGIN'` for a number with **no account** returns the same `202`, the same body shape and the same timing as one with an account; the SMS is simply not sent. Returning `404` here is **forbidden**, not merely breaking — it is an enumeration oracle (`§8.1` future-compatibility table).
6. When the SMS rail is unavailable the response is still `202` with `channel: 'EMAIL'` and `fallback: 'EMAIL'`; only when **both** rails are down is it `503 DEPENDENCY_UNAVAILABLE` (`AC-AUTH-01.5`).
7. The plaintext code is **never persisted and never logged**; Redis holds an HMAC and the Pino redaction list covers `otp` and `phone` (`BR-DAT-06`, DLT-5).
8. Verification is constant-time and single-use: a consumed code fails with `OTP_INVALID` on replay, and both endpoints are `@Idempotent('OPT')` so a double-tapped button replays the stored response instead of sending twice.
9. A bare 10-digit number is **rejected, not guessed**; a `+1` or `+971` number is rejected at the pipe — Phase 1 is India-only (`LAUNCH_MARKET_INDIA.md`).
10. Both routes carry `RL-OTP` (tier 1, fail-closed) and generated isolation coverage under the public-audience treatment (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `otp.policy.spec.ts` | Unit | Each of the five limits at its boundary, from both sides |
| `request-otp.use-case.spec.ts` | Unit | The `NEGATIVE:` cases — 4th resend sends nothing; cool-down; captcha threshold |
| `otp-enumeration.int-spec.ts` | Integration | Registered and unregistered numbers are indistinguishable by status, body and timing band |
| `otp-fallback.int-spec.ts` | Integration | SMS port down → `202` with `EMAIL`; both down → `503` |
| `otp-no-plaintext.int-spec.ts` | Integration | The code appears in no Redis value, no log sink and no `notification_log.payload` |
| `otp.contract-spec.ts` | Contract | `202`/`200` envelopes and all seven error codes against the generated document |

**Rollback plan** — Flag `rel.iam.phone-otp-login` (**new**): *off*, OTP routes return `404` and email
plus password (M-020) is the only path. Redis keys expire in 300 seconds, so a rollback leaves no
residue. No migration is involved — this milestone writes nothing to PostgreSQL.

**Notes** — Two traps. First, the ₹0.15-per-message cost makes an unbounded OTP endpoint a direct
financial exposure, which is why the per-IP ceiling exists **independently** of the per-number one
(`CON-02`); implementing only one of the two is the common mistake. Second, TRAI DLT: every SMS
template must be pre-registered, a rejected template means the previous approved version keeps
sending, and somebody must be told — `infra/runbooks/dlt-template-rejected.md` is the runbook and
`FR-NOTF-03` the requirement.

---

### M-022 — `auth_sessions`, `refresh_tokens`, JWT issue and rotation with reuse detection

| Field | Value |
| :--- | :--- |
| **Sprint** | 1 |
| **Epic** | EP-02 · F-02.5, F-02.8 · T-02.06, T-02.07, T-02.10 · ADR-0011 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A login produces a 15-minute access token and a 30-day httpOnly rotating refresh token,
each rotation leaves an unforgeable chain, and replaying a used generation revokes the **entire
family** and forces re-authentication.

**Depends on** — M-013, M-017, M-018, M-019, M-020, M-021.

**Unblocks** — M-023, M-024, M-025, M-027.

**Files**

- `apps/server/prisma/migrations/<ts>_create_auth_sessions_refresh_tokens/migration.sql` — `auth_sessions` (`user_id`, `family_id` unique, `device_label`, `user_agent`, `ip inet`, `status`, `absolute_expires_at`, `revoked_at`, `revoked_reason`) grant class **G-CRUD**; `refresh_tokens` (`session_id`, `token_hash char(64)` unique, `generation` unique within family, `superseded_by_id` self-FK, `used_at`, `expires_at`) grant class **G-COMPLETE** — `SELECT, INSERT` plus `UPDATE (used_at, superseded_by_id)` and nothing else (Deviation **D-04**, `Schema.md` §4.8). Both are **IDENTITY** class: no `tenant_id`, no RLS.
- `apps/server/src/iam/domain/{session.entity.ts,token-family.ts,refresh-rotation.policy.ts}` + specs.
- `apps/server/src/iam/application/{issue-session.use-case.ts,rotate-refresh.use-case.ts,revoke-session.use-case.ts,list-sessions.use-case.ts}` + specs.
- `apps/server/src/iam/infrastructure/{jwt.signer.adapter.ts,session.prisma-repository.ts,refresh-token.prisma-repository.ts}` + `int-spec`s.
- `apps/server/src/iam/controllers/auth.controller.ts` — `POST /v1/auth/refresh`, `POST /v1/auth/logout`, `GET /v1/auth/sessions`, `DELETE /v1/auth/sessions/:id` (`apis/Authentication.md` §8.5, §8.6, §8.9, §8.10).
- `apps/server/src/common/guards/jwt-auth.guard.ts` — the M-011 scaffold replaced by the real verifier reading the signing keys from the secret store, with key rotation support.
- `apps/server/test/isolation/iam.isolation-spec.ts` — regenerated; the `/auth/sessions` routes get their `/me`-scope treatment (`§5.5`).
- `docs/features/session-lifecycle.md` · `docs/runbooks/iam.md` — the refresh-family false-positive failure mode.

**Acceptance criteria**

1. Access token 15 minutes, refresh token 30 days, refresh delivered as an **httpOnly** cookie and absent from any JS-readable storage (`FR-AUTH-06`, `E1.1`).
2. The refresh token itself is **never stored** — `refresh_tokens.token_hash` is its SHA-256 (`NFR-SEC-07`).
3. Rotation writes a **new** generation and sets `used_at` and `superseded_by_id` on the old one; a rewritten generation would defeat reuse detection, which is why nothing else is grantable (`Schema.md` §4.8).
4. Replaying a **used** generation revokes the entire `family_id` and forces re-authentication on every device in it; the user is notified of the detected reuse (`E1.2`, `FR-AUTH-06`, ADR-0011).
5. The parallel-tab race is handled explicitly — a short grace on the immediately-previous generation, or a rotation lock — and is tested with genuinely concurrent refreshes, not sequential ones (`TR-28`, `apis/Authentication.md` §5.1).
6. `GET /v1/auth/sessions` lists device, IP and last-seen; individual and bulk revocation propagate within 60 seconds (`FR-AUTH-09`).
7. Session revocation and password reset (M-020) share one code path, so a fix to either cannot diverge.
8. `auth_sessions` and `refresh_tokens` are IDENTITY class with **no** RLS; the `IS6` exemption list is extended in the same PR with a reason (`PC2`).
9. Every route declares a permission or is on the `@Public()` allowlist, and generated isolation coverage exists for all four (R-5, `IG-1`).
10. A revoked or expired session's access token is rejected within its remaining TTL by a short-lived denylist keyed on `family_id`, so revocation is not merely "the next refresh fails".

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `refresh-rotation.policy.spec.ts` | Unit | Rotation increments the generation; the chain is intact; a replayed generation is detected |
| `refresh-reuse-revokes-family.int-spec.ts` | Integration | `NEGATIVE:` — replaying a used token revokes every session in the family (`E1.2`, `BAC-06`) |
| `refresh-parallel-tabs.int-spec.ts` | Integration | Two simultaneous refreshes on one family both succeed or one waits; neither triggers a false reuse alarm (`TR-28`) |
| `refresh-token-grants.int-spec.ts` | Integration | `app_rw` may update only `used_at` and `superseded_by_id`; any other column raises `permission denied` |
| `session-revocation.int-spec.ts` | Integration | Revocation is visible to the access-token guard inside 60 s |
| `auth-sessions.contract-spec.ts` | Contract | All four routes against the generated document |

**Rollback plan** — Migration phase: **expand**. Flag `rel.iam.session-rotation` (**new**): *off*,
refresh tokens are issued but not rotated on use — a strictly weaker but functional posture that
keeps users logged in while a rotation defect is diagnosed. The flag **never** disables reuse
detection or family revocation; those are security controls, and `FEATURE_FLAGS.md` §2.2 forbids
flagging a security control off.

**Notes** — The trap is a **false positive** in reuse detection. A mobile browser restoring two tabs
from cache will refresh twice within milliseconds, and a naive implementation logs both users out and
calls it a security event. `TR-28` is the register entry; the grace window or the rotation lock is
the mitigation; the concurrent test is the proof. `docs/runbooks/iam.md` names "refresh-family false
positive" as one of the module's top three failure modes for exactly this reason.

---

### M-023 — The `B3.2` matrix as data, `PermissionsGuard` and the `FR-RBAC-01` gate

| Field | Value |
| :--- | :--- |
| **Sprint** | 1 |
| **Epic** | EP-02 · F-02.13, F-02.14, F-02.15, F-02.16, F-02.18 · T-02.15 … T-02.18, T-02.20 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Authorisation is evaluated server-side as `(role, scope, resource, action)` against the
tenant **on the resource**, the 516-cell `B3.2` matrix is data with a generated test per cell, and a
UI-first implementation cannot subvert any of it.

**Depends on** — M-013, M-015, M-019, M-022.

**Unblocks** — M-024, M-025, M-026, M-027, and every permissioned endpoint thereafter.

**Files**

- `apps/server/src/iam/domain/permission-matrix.ts` — the `§B3.2` matrix, **43 capabilities × 12 roles**, encoded as **data**, never as conditionals.
- `apps/server/src/iam/domain/permission-matrix.generated-spec.ts` — one test per cell, emitted from the same data by a generator.
- `apps/server/src/common/guards/permissions.guard.ts` — deny-by-default; resolves `(role, scope, resource, action)`; branch-scope resolution; **never role alone**.
- `apps/server/src/iam/application/{resolve-effective-permissions.use-case.ts,change-user-role.use-case.ts}` + specs.
- `apps/server/src/iam/infrastructure/permission-cache.redis.ts` — short-TTL cache with **explicit invalidation** on role change (`FR-RBAC-04`).
- `apps/server/src/iam/domain/last-owner.policy.ts` — the last remaining `GYM_OWNER` cannot be removed or demoted, enforced at the **service** layer (`FR-RBAC-07`, `FR-STAF-09`).
- `apps/server/src/common/guards/resource-tenant.guard.ts` — loads the resource's tenant **before** deciding; a cross-tenant resource id yields `404`, consistent with the isolation suite (`FR-RBAC-03`).
- `apps/server/src/*/permissions.ts` — every module with controllers now declares its constants; `PG-1` moves from vacuous to enforcing across the whole route table.
- `apps/server/test/isolation/` — regenerated inventory; `IG-6` now has teeth.
- `docs/features/rbac.md`.

**Acceptance criteria**

1. Permission is evaluated as `(role, scope, resource, action)` — **never role alone** (`FR-RBAC-02`, `§B3.1`).
2. Permission is resolved against the tenant **on the resource**, not the tenant on the session alone, proven with a cross-tenant resource id that yields `404` (`FR-RBAC-03`, `E1.6`).
3. A `RECEPTIONIST`-role token calling a plan-editor endpoint **by direct `curl`** receives a server-side `403` with the standard envelope and a stable code — demonstrated by API call, never by clicking (`FR-RBAC-02`, `E1.5`).
4. All 516 cells of `B3.2` have a generated test; adding a capability or a role regenerates the suite, and a hand-edited generated file fails lint.
5. Deny-by-default: a resource/action pair absent from the matrix is refused, and the refusal is logged as a configuration gap rather than a user error.
6. A role change propagates to a live session within **60 seconds without re-authentication**, via cache invalidation and not via a shorter token TTL (`FR-RBAC-04`, `E1.7`).
7. The last `GYM_OWNER` cannot be removed or demoted; the check is in the service layer, so it holds for the API, a job and a future bulk import alike (`FR-RBAC-07`).
8. Job 8 `PG-1` now fails the build for **any** endpoint with no declared permission, across all 23 modules; a deliberately undeclared route is part of the CI violation matrix (`FR-RBAC-01`, `E1.4`, `AC-FND-14.4`).
9. Every role change writes an audit row through the M-013 writer with actor, before, after and reason (`BR-DAT-01`).
10. Generated isolation coverage exists for every route this milestone touches, and `IG-6` confirms no `@TenantScoped()` handler lacks `@RequiredPermission()` (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `permission-matrix.generated-spec.ts` | Unit | 516 cells, each allow or deny, from the same data the guard reads |
| `permissions.guard.spec.ts` | Unit | Deny-by-default; scope resolution for `SELF`, `TENANT`, `BRANCH`, `PLATFORM`; the `NEGATIVE:` case per scope (`BAC-06`) |
| `resource-tenant.guard.int-spec.ts` | Integration | A cross-tenant resource id yields `404`, matching assertion A1 exactly (`FR-RBAC-03`) |
| `role-change-propagation.int-spec.ts` | Integration | A live session gains the new capability inside 60 s with no re-login |
| `last-owner.policy.spec.ts` | Unit | Removal and demotion both refused; a second owner makes both permitted |
| `rbac.contract-spec.ts` | Contract | `403` envelopes carry a registry code and a correlation id |

**Rollback plan** — **Not revertible by flag.** A flag that disabled the `PermissionsGuard` would
disable authorisation, which `FEATURE_FLAGS.md` §2.2 forbids. Rollback is `git revert` of the whole
milestone, which also reverts `PG-1` to its pre-population state; the matrix data and the guard must
move together, so the milestone is one commit.

**Notes** — Two traps. First, `FR-RBAC-02` is violated most often by a UI-first implementation —
*"the menu is hidden, so it is safe"*. Every frontend task in Sprint 1 has a paired negative API test
in its DoD, and `E1.5` is demoed by `curl`. Second, the matrix must be **data**. Twelve roles × three
surfaces is the largest single matrix in the product, a missed cell is a security defect, and a
matrix expressed as conditionals cannot be tested cell by cell nor inspected by the
effective-permission inspector (`FR-RBAC-05`, carried into Sprint 2 by the Sprint-1 capacity
mitigation and scheduled in `Milestones_030-059.md`).

---

### M-024 — TOTP MFA — enrolment, recovery codes and the mandatory staff gate

| Field | Value |
| :--- | :--- |
| **Sprint** | 1 |
| **Epic** | EP-02 · F-02.6 · T-02.08 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — A platform-staff account cannot complete login without a TOTP second factor, a
`GYM_OWNER` may opt in, and single-use recovery codes exist so that a lost device is a support
conversation rather than an account loss.

**Depends on** — M-013, M-020, M-021, M-022, M-023.

**Unblocks** — M-025.

**Files**

- `apps/server/prisma/migrations/<ts>_add_mfa_columns_to_users/migration.sql` — **expand** phase: `mfa_enrolled_at`, `mfa_secret_encrypted`, `mfa_recovery_codes_hashed text[]`, all nullable; IDENTITY class, no RLS.
- `apps/server/src/iam/domain/{mfa-enrolment.vo.ts,recovery-code.vo.ts,mfa.policy.ts}` + specs.
- `apps/server/src/iam/application/{enrol-mfa.use-case.ts,verify-mfa.use-case.ts,disable-mfa.use-case.ts}` + specs.
- `apps/server/src/common/guards/mfa.guard.ts` — refuses to complete a session for any of the five platform-staff roles until the factor is presented.
- `apps/server/src/iam/controllers/auth.controller.ts` — `POST /v1/auth/mfa/enrol`, `POST /v1/auth/mfa/verify`, `DELETE /v1/auth/mfa` (`apis/Authentication.md` §8.11 – §8.13).
- `apps/server/src/iam/infrastructure/adapters/totp.adapter.ts` — RFC 6238, 30-second step, ±1 step drift window, provisioning URI for the QR.
- `apps/server/test/isolation/iam.isolation-spec.ts` — regenerated for the three new routes.
- `docs/features/mfa.md`.

**Acceptance criteria**

1. MFA is **mandatory** for all platform-staff roles and **optional** for `GYM_OWNER`; a staff login without the factor never reaches a session (`FR-AUTH-07`, `NFR-SEC-11`, `E1.3`).
2. Enrolment returns a provisioning URI and requires a **verified** code before the factor is activated — an enrolment that is never confirmed leaves the account unchanged.
3. Ten single-use recovery codes are issued at enrolment, stored **hashed**, shown once, and each is consumable exactly once; consuming one writes an audit row.
4. The TOTP secret is encrypted at rest with a key from the managed secret store, never in source, never in an environment file (`NFR-SEC-07`).
5. Drift tolerance is exactly ±1 step; a code from two steps ago is refused, and replaying an accepted code inside its own step is refused.
6. `DELETE /v1/auth/mfa` is refused for a platform-staff role — the factor is mandatory, so disabling it is not an available operation, and the refusal is a `422` with a registry code rather than a `403`.
7. Verification attempts are rate-limited under `RL-AUTH` and count toward the M-020 lockout policy.
8. All three routes declare permissions and carry generated isolation coverage (R-5); each writes an audit row (`BR-DAT-01`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `mfa.policy.spec.ts` | Unit | Mandatory for the five staff roles; optional for `GYM_OWNER`; `NEGATIVE:` — staff cannot disable (`BAC-06`) |
| `totp.adapter.spec.ts` | Unit | ±1 step accepted, ±2 refused, replay within a step refused, against a `FixedClock` from M-016 |
| `recovery-code.spec.ts` | Unit | Ten codes, hashed, single-use, audited on consumption |
| `staff-login-requires-mfa.int-spec.ts` | Integration | A platform-staff login without the factor issues **no** session (`E1.3`) |
| `mfa.contract-spec.ts` | Contract | Three routes against the generated document |

**Rollback plan** — Migration phase: **expand** (three nullable columns; contract is a later
migration). Flag `rel.iam.mfa-enrolment` (**new**) gates the *enrolment* surface only. The
**mandatory staff gate is not flagged** — `NFR-SEC-11` is a security control and `FEATURE_FLAGS.md`
§2.2 forbids flagging one off. If enrolment is defective, staff accounts are provisioned with
recovery codes by an audited admin path rather than by relaxing the gate.

**Notes** — The trap is the clock. TOTP compares against wall time, `TR-21` puts bounded, monitored
clock skew on the worker hosts, and a test written with `new Date()` instead of the M-016 `Clock`
port will pass on a developer laptop and fail in CI at 30-second boundaries. Inject `FixedClock`.

---

### M-025 — Impersonation and the financial-mutation prohibition

| Field | Value |
| :--- | :--- |
| **Sprint** | 1 |
| **Epic** | EP-02 · F-02.10 · T-02.12, T-02.24 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — A support agent can act as a user for at most 30 minutes, with a stated reason, under a
typed token that **cannot execute any financial mutation**, and every action is attributable to both
identities.

**Depends on** — M-013, M-014, M-022, M-023, M-024.

**Unblocks** — M-026, and the `SCR-ADM-005` admin surface in `Milestones_030-059.md`.

**Files**

- `apps/server/src/iam/domain/{impersonation.vo.ts,impersonation.policy.ts}` + specs — `typ: 'IMPERSONATION'`, mandatory non-empty reason, hard 30-minute cap.
- `apps/server/src/iam/application/{start-impersonation.use-case.ts,end-impersonation.use-case.ts}` + specs.
- `apps/server/src/common/decorators/financial-mutation.decorator.ts` — `@FinancialMutation()`.
- `apps/server/src/common/guards/impersonation-restriction.guard.ts` — refuses any `@FinancialMutation()` handler under an impersonation token.
- `apps/server/src/iam/controllers/auth.controller.ts` — `POST /v1/auth/impersonate`, `POST /v1/auth/impersonate/end` (`apis/Authentication.md` §8.14, §8.15).
- `apps/server/src/audit/` — `audit_log.impersonated_by` populated on **every** write made under the token, not only on the start event.
- `apps/server/src/iam/application/record-account-activity.use-case.ts` — the impersonation appears in the **user's own** activity log (`FR-USER-05`).
- `packages/config/scripts/api-gates.mjs` — a new assertion: every route the `§14.2.1` money set names must carry `@FinancialMutation()`; a missing one fails job 8.
- `docs/features/impersonation.md` · `docs/runbooks/iam.md`.

**Acceptance criteria**

1. The impersonation token is a **distinct type** (`typ: 'IMPERSONATION'`), not a normal access token with a claim, so a mis-scoped verifier cannot confuse the two (`FR-AUTH-12`).
2. A reason is **mandatory** and non-empty at the type level and at runtime; the session is refused without one.
3. The cap is 30 minutes, enforced by `exp` **and** re-checked server-side, so a clock-skewed client cannot extend it.
4. **No financial mutation is executable** under the token: refunds, payouts, price changes, credit notes and manual ledger adjustments all refuse with a registry code (`BR-DAT-02`, `E1.8`).
5. Impersonation **never elevates** the agent's own permissions — the effective set is the intersection of the agent's and the impersonated user's, not the union (`FR-AUTH-12`).
6. `runElevated()` is **unavailable** during impersonation; the M-014 assertion `PE-T5` now runs against real roles rather than the scaffolded principal (`PE3`, `AC-AUTH-03.2`).
7. Every write under the token carries `impersonated_by` in its audit row; a report by actor shows both identities (`BR-DAT-01`, `AC-FND-11.1`).
8. The impersonated user sees the session in their own account activity log with the reason and the duration (`FR-USER-05`).
9. Both routes require a platform-staff role **with MFA satisfied** (M-024) and declare their permissions; generated isolation coverage exists (R-5).
10. Ending the session is idempotent, and an expired session ends itself without an operator action.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `impersonation.policy.spec.ts` | Unit | Reason required; 30-minute cap; intersection-not-union of permissions |
| `financial-mutation-refused.int-spec.ts` | Integration | `NEGATIVE:` — a refund attempt under impersonation refuses with its registry code and **no** state change (`BR-DAT-02`, `E1.8`, `BAC-06`) |
| `impersonation-no-elevation.int-spec.ts` | Isolation | `PE-T5` — `runElevated` refuses under an impersonation token |
| `impersonated-by-audit.int-spec.ts` | Integration | Every write under the token carries `impersonated_by`; a query by actor returns both identities |
| `impersonation.contract-spec.ts` | Contract | Both routes; the `422` refusal envelope |

**Rollback plan** — Flag `ops.iam.impersonation` (**new**, kill-switch, default **on**): *pulled*, no
new impersonation session can be started and existing ones expire naturally within 30 minutes;
support falls back to read-only account inspection. The `@FinancialMutation()` prohibition is **not**
flagged — it is the control the feature exists to be safe under.

**Notes** — `SprintPlanning.md` Sprint 1 demo step 7 is the acceptance conversation: start a support
impersonation, show the persistent banner, **attempt a refund**, show the refusal, then show the
audit record with reason and duration. The banner itself is frontend work (`AC-AUTH-03.1`,
`Milestones_030-059.md`); the refusal is backend and must not wait for it. The trap is implementing
the prohibition in the controller layer — it belongs in a guard reading `@FinancialMutation()`
metadata, so that a refund path added in Sprint 12 inherits it without anyone remembering.

---

# PART D — TENANT ONBOARDING AND VERIFICATION (M-026 … M-030)

> **Prerequisite, restated for the last time in this file.** Every milestone here writes tenant data,
> so **M-009 … M-016 must be green** and M-017/M-018 must exist before any of them starts. `EP-03`
> additionally depends on **EP-02** for an authenticated owner: M-019 … M-025. `RSK-01` — fake gyms,
> scored 20 — is the risk this part exists to defend, and its whole defence is here.

### M-026 — `applications` and `kyc_documents` — the dossier tables

| Field | Value |
| :--- | :--- |
| **Sprint** | 1 |
| **Epic** | EP-03 · F-03.1 · T-03.01 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — The two tables that hold a tenant's verification dossier exist, both tenant-owned with RLS,
with the grant classes that make the submitted snapshot immutable and the document rows tombstoned
rather than deleted.

**Depends on** — M-009, M-013, M-015, M-019, M-023.

**Unblocks** — M-027, M-028, M-029, M-030.

**Files**

- `apps/server/prisma/migrations/<ts>_create_applications/migration.sql` — `applications`: `tenant_id`, `version`, `snapshot jsonb`, `status`, `assigned_to`, `decided_by`, `decided_at`, `decision`, `reason_codes text[]`, `reviewer_notes`, `precheck_results jsonb`, `submitted_at`. RLS **P-STD** + **P-PLATFORM**; grant class **G-COMPLETE** — `SELECT, INSERT` plus `UPDATE (status, assigned_to, decided_by, decided_at, decision, reason_codes, reviewer_notes)` and nothing else (Deviation **D-03**, `Schema.md` §4.2). Indexes `uq_applications__tenant_version (tenant_id, version)` and `idx_applications__status_submitted_at (status, submitted_at)` for the `FR-ADMN-11` queue.
- `apps/server/prisma/migrations/<ts>_create_kyc_documents/migration.sql` — `kyc_documents`: `tenant_id`, `application_id`, `document_type`, `storage_key` (globally unique), `content_hash`, `status`, `tombstoned_at`, review columns. RLS **P-STD** + **P-PLATFORM**; grant class **G-CRUD**; **no `deleted_at`** — retention class `R-KYC` means the row outlives the tenant (`Schema.md` §4.3). Index `idx_kyc_documents__tenant_type_status`.
- `apps/server/src/onboarding/{onboarding.module.ts,index.ts,README.md,permissions.ts,types/onboarding.types.ts}`.
- `apps/server/src/onboarding/infrastructure/{application.prisma-repository.ts,kyc-document.prisma-repository.ts}` + `int-spec`s with the mandatory RLS assertions.
- `apps/server/prisma/seed/applications.ts` — one dossier per seeded tenant in a distinct state; `SEED_VERSION → 0.3` (R-7).
- `docs/runbooks/onboarding.md` — stub filled with the three failure modes.

**Acceptance criteria**

1. Both tables carry `tenant_id NOT NULL`, RLS **enabled and forced**, and both a `USING` and a `WITH CHECK` policy in the same migration (R-6, `AC-FND-01.1`).
2. `applications` is insert-plus-verdict-only: an attempt to `UPDATE snapshot`, `version` or `submitted_at` as `app_rw` raises **`permission denied`** at the grant level (D-03, `AP1`).
3. `uq_applications__tenant_version` makes the version sequence unforgeable; a duplicate `(tenant_id, version)` raises (`BR-GYM-05`).
4. `kyc_documents` has **no** `deleted_at`; deletion of the object is recorded by `tombstoned_at`, because deleting the row would destroy the evidence that a legally required document once existed (`R-KYC`).
5. The KYC **checklist version** lives inside `applications.snapshot`, not as a foreign key — otherwise adding a tenth required document in March would retroactively make every February application incomplete (`ERD.md` §9.6).
6. `idx_applications__status_submitted_at` deliberately does **not** lead with `tenant_id`: the verification queue is a **platform** surface read under `runElevated`, so every tenant's rows are in scope. The exception is recorded in `Indexes.md` (`SC-R06`, `CI-08`).
7. `storage_key` is globally unique rather than tenant-prefixed, because keys are opaque high-entropy strings and a collision is an infrastructure defect (`Schema.md` §4.3).
8. Both repositories extend `TenantScopedRepository`; neither method signature contains a `tenantId` parameter (`BR5`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `application.prisma-repository.int-spec.ts` | Integration | Tenant A sees only its dossiers; the RLS assertion is present per `§7.3.1` row 20 |
| `applications-grants.int-spec.ts` | Integration | `UPDATE snapshot` raises; `UPDATE status` succeeds; `DELETE` raises (`CI-02`) |
| `application-version-unique.int-spec.ts` | Integration | A duplicate `(tenant_id, version)` raises |
| `kyc-documents-rls.int-spec.ts` | Integration | Tenant B cannot read A's document rows; `RS-3` insert of a B-owned row raises |

**Rollback plan** — Migration phase: **expand** (two `create` migrations, one logical change each per
P5). Contract is a later `drop`, never an edit (PM-4). `SEED_VERSION` reverts with the code.

**Notes** — The design tension is recorded, not rediscovered: six verdict columns change after
insert on a table `ERD.md` §10.1 calls append-only. `Schema.md` §4.2 resolves it — **the submitted
dossier is what is frozen, and it lives entirely in `snapshot`**; the verdict is the reviewer's
statement *about* that frozen artefact, granted column-by-column. Implementing it as a full
`G-APPEND` table with a child `application_decisions` was considered and rejected: a one-row join on
every queue query.

---

### M-027 — The resumable wizard shell and step 1 business identity

| Field | Value |
| :--- | :--- |
| **Sprint** | 1 |
| **Epic** | EP-03 · F-03.1, F-03.2 · T-03.03, T-03.04 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — An owner can begin the six-step onboarding wizard, leave, and resume from exactly where
they stopped with partial state intact — and step 1 captures the business identity in a form that the
duplicate-registration pre-check can later normalise and compare.

**Depends on** — M-017, M-021, M-022, M-023, M-026.

**Unblocks** — M-028, M-029, M-030.

**Files**

- `apps/server/src/onboarding/domain/{wizard-step.ts,wizard-progress.vo.ts,business-identity.vo.ts,onboarding.errors.ts}` + specs — the six steps as a closed enum: `BUSINESS_IDENTITY`, `KYC`, `GYM_PROFILE`, `PLANS`, `PAYOUT`, `REVIEW`.
- `apps/server/src/onboarding/application/{save-wizard-step.use-case.ts,get-wizard-state.use-case.ts,validate-step.use-case.ts}` + specs.
- `apps/server/src/onboarding/controllers/onboarding-wizard.controller.ts` — `GET /v1/tenant/onboarding`, `PUT /v1/tenant/onboarding/steps/:step`; `@TenantScoped()`, `@RequiredPermission('onboarding.application.write')`, `@Idempotent('OPT')`.
- `apps/server/src/onboarding/dto/*` + `@gymmap/types/schemas/onboarding.schema.ts` — one Zod schema per step, shared with the dashboard (A-02).
- `apps/server/src/onboarding/infrastructure/wizard-draft.prisma-repository.ts` + `int-spec` — the draft is `applications` at `version = 0` with `status = 'DRAFT'`, so there is no second storage mechanism to keep consistent.
- `apps/server/src/onboarding/domain/registration-number.normaliser.ts` + spec — case, whitespace and separator normalisation, so `BR-GYM-08`'s duplicate check in M-030 compares like with like.
- `apps/server/test/isolation/onboarding.isolation-spec.ts` — generated, covering both routes.
- `docs/features/onboarding-wizard.md`.

**Acceptance criteria**

1. Partial state persists **indefinitely** and the wizard resumes from any step after a browser close, with prior answers intact (`FR-ONB-01`, `E2.2`).
2. Validation is **per step**: saving step 1 validates step 1 only, so an incomplete step 4 never blocks progress through step 3 (`FR-ONB-01`).
3. Any step is revisitable; step completion is tracked as data and returned by `GET /v1/tenant/onboarding` so the client renders progress from the server, not from local state.
4. Step 1 captures legal entity name, trading name, `entity_type`, registration identifier, registered address and business contact (`FR-ONB-02`).
5. The registration identifier is stored **as entered** and **as normalised**; the normaliser is deterministic and unit-tested against the variants the duplicate pre-check must catch.
6. `entity_type` drives the KYC checklist branch and the PAN fourth-character consistency rule consumed in M-029 (`LAUNCH_MARKET_INDIA.md` §6).
7. Both routes declare permissions, appear in the generated OpenAPI document, and carry generated isolation coverage: tenant B cannot read or write tenant A's draft, and the positive control returns a **non-empty** draft (R-5, A1–A4).
8. Every step save writes an audit row through the M-013 writer (`BR-DAT-01`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `save-wizard-step.use-case.spec.ts` | Unit | Per-step validation; an invalid step 4 does not invalidate a saved step 1 |
| `wizard-resume.int-spec.ts` | Integration | Save steps 1–3, discard the session, re-authenticate, resume at step 3 with state intact (`E2.2`) |
| `registration-number.normaliser.spec.ts` | Unit | Case, spacing, `/`, `-` and leading-zero variants normalise to one value |
| `onboarding.isolation-spec.ts` | Isolation | A1–A4 on both routes |
| `onboarding.contract-spec.ts` | Contract | Both routes against the generated document |

**Rollback plan** — Flag `ops.onboarding.new-tenant-signups` (already catalogued in
`FEATURE_FLAGS.md` §7, default **on**): *pulled*, new signups are refused with a **waitlist capture**
rather than an error, while applications already in progress remain editable and submittable. No
migration is added by this milestone, so the rollback is flag-then-revert.

**Notes** — The trap is a second storage mechanism for drafts — a `wizard_drafts` table, or Redis.
The draft **is** the application at version 0; anything else creates two sources of truth for the
same dossier and a reconciliation problem at submission. `BAC-01` requires the whole thing to be
completable *"in one session, unaided"*, which is a usability target, not permission to hold state
somewhere the tenant policy does not reach.

---

### M-028 — The `C4.4` state machine, submission snapshot and versioning

| Field | Value |
| :--- | :--- |
| **Sprint** | 2 |
| **Epic** | EP-03 · F-03.8, F-03.9 · T-03.12, T-03.13, T-03.14 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Submitting an application freezes an immutable versioned snapshot, the seven `C4.4` states
are expressed once as a domain state machine with typed illegal-transition errors, and the owner can
keep editing non-material fields without altering what a reviewer is looking at.

**Depends on** — M-013, M-017, M-018, M-023, M-026, M-027.

**Unblocks** — M-029, M-030, and the reviewer console in `Milestones_030-059.md`.

**Files**

- `apps/server/src/onboarding/domain/application.state-machine.ts` + `.spec.ts` — the seven `C4.4` states and the **full transition table including every illegal transition**.
- `apps/server/src/onboarding/domain/application.entity.ts` + spec — the aggregate root; `version`, `snapshot` and `submitted_at` are immutable from insert.
- `apps/server/src/onboarding/domain/material-field.policy.ts` + spec — which draft fields are material (and therefore require a new version) and which are not (`FR-ONB-08`, `BR-GYM-05`).
- `apps/server/src/onboarding/application/{submit-application.use-case.ts,transition-application.use-case.ts,get-application-status.use-case.ts}` + specs.
- `apps/server/src/onboarding/controllers/application.controller.ts` — `POST /v1/tenant/applications` (`@Idempotent('REQ')`), `GET /v1/tenant/applications`, `GET /v1/tenant/applications/:id`.
- `apps/server/src/onboarding/domain/events/application-submitted.event.ts` — written to the outbox in the **same transaction** as the insert (M-018).
- `apps/server/src/onboarding/domain/onboarding.errors.ts` — `APPLICATION_ILLEGAL_TRANSITION`, `APPLICATION_ALREADY_SUBMITTED`, `APPLICATION_SNAPSHOT_IMMUTABLE`.
- `apps/server/test/isolation/onboarding.isolation-spec.ts` — regenerated for the three routes.
- `docs/engineering/StateMachines.md` cross-reference tick; `docs/features/application-lifecycle.md`.

**Acceptance criteria**

1. The `C4.4` machine is expressed **once**, in `domain/`, and every illegal transition raises a typed error rather than being silently ignored (`FR-ONB-09`, `§7.3.1` row 10).
2. Submission inserts a **new immutable row** with `version = previous + 1` and a full `snapshot jsonb`; the previous version is untouched (`FR-ONB-08`, `BR-GYM-05`).
3. The owner may continue editing **non-material** draft fields after submission; a material edit requires a new submission and the policy enumerates which is which (`FR-ONB-08`).
4. `POST /v1/tenant/applications` is `@Idempotent('REQ')`: no key is `400 IDEMPOTENCY_KEY_REQUIRED`; a replayed key returns the stored `201` **without creating a second version** (`§6.11`, M-017).
5. `→ APPROVED` is **unreachable from any automated code path**: the transition guard requires an authenticated `VERIFICATION_OFFICER` or `SUPER_ADMIN` typed as a `HumanActor`, and a negative test proves a system actor is refused (`BR-GYM-03`, `E2.6`, `RSK-01`).
6. The application-submitted event lands in the outbox inside the submission transaction; a rolled-back submission dispatches nothing (`AC-FND-08.1`, `AC-FND-08.2`).
7. Every transition writes an audit row with actor, before-state, after-state and reason; a rejection carries **at least one** of the sixteen `C4.8` reason codes, enforced by a non-empty `CHECK` (`FR-ONB-11`, `BR-GYM-04`).
8. Status is visible to the owner across all seven states with reviewer feedback and resubmission history (`FR-ONB-09`).
9. All three routes declare permissions and carry generated isolation coverage; assertion **A2**'s byte-identity check proves a cross-tenant `POST` leaves tenant B's latest version unchanged (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `application.state-machine.spec.ts` | Unit | The full transition table, legal **and** illegal, all 49 ordered pairs |
| `human-only-approval.int-spec.ts` | Integration | `NEGATIVE:` — a system actor attempting `→ APPROVED` is refused (`BR-GYM-03`, `E2.6`, `BAC-06`) |
| `submission-snapshot-immutable.int-spec.ts` | Integration | `UPDATE snapshot` raises `permission denied`; a material draft edit creates version *n+1* |
| `submit-idempotency.int-spec.ts` | Integration | A replayed `Idempotency-Key` returns the stored `201` and version count stays at 1 |
| `application-outbox.int-spec.ts` | Integration | Commit writes the outbox row; rollback writes none |
| `onboarding.isolation-spec.ts` | Isolation | A1–A4 plus A2's checksum on all three routes |

**Rollback plan** — No migration is added (the columns exist from M-026). Flag
`rel.onboarding.application-submission` (**new**): *off*, the wizard remains editable but
`POST /v1/tenant/applications` returns a maintenance state and no new version can be created;
existing applications continue through review untouched. The `HumanActor` approval guard is **not**
flagged — it is the `RSK-01` defence.

**Notes** — `RSK-01`, fake gyms, scores 20 and this criterion is its keystone: **no automated path
may reach `APPROVED`**. Implement it as a branded `HumanActor` type on the transition signature, not
as a runtime role check, so that a job or a future bulk-import cannot even construct the call. The
second trap is treating the snapshot as a pointer to live data — a `snapshot` that references the
draft by id rather than copying it means a reviewer and the owner are looking at different documents,
and `FR-ONB-08` exists precisely to prevent that.

---

### M-029 — KYC: the India checklist, the segregated bucket and the upload path

| Field | Value |
| :--- | :--- |
| **Sprint** | 2 |
| **Epic** | EP-03 · F-03.3 · T-03.02, T-03.05, T-03.06, T-03.07, T-03.08 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — The ten India KYC document types are configuration rather than code, every uploaded
document lands in a **separate encrypted bucket under its own key with no CDN**, and every single
access to one writes an audit row.

**Depends on** — M-013, M-014, M-018, M-023, M-026, M-027.

**Unblocks** — M-030, and the reviewer console in `Milestones_030-059.md`.

**Files**

- `apps/server/prisma/migrations/<ts>_create_kyc_checklists/migration.sql` — `kyc_checklists`, a **platform-global** reference table (`§C2.3`, grant class `G-REF`, RLS-exempt by design and on the committed exemption list).
- `apps/server/prisma/reference/kyc_checklists.in.v1.json` — the **India ten-document seed**, versioned and idempotent (`P11`): PAN (always), GSTIN (conditional above threshold), business registration proof (by `entity_type`), Shop & Establishment registration, bank account proof, owner identity, premises address proof, trade licence (conditional), fire safety NOC (conditional), music licence (advisory, non-blocking) — `LAUNCH_MARKET_INDIA.md` §6.
- `apps/server/src/onboarding/application/resolve-checklist.use-case.ts` + spec — renders the country checklist, resolves conditional-mandatory rules from declared data, filters registration proofs by `entity_type`.
- `apps/server/src/onboarding/domain/{pan.vo.ts,gstin.vo.ts}` + specs — PAN `AAAAA9999A` with the **fourth-character entity-type consistency** rule; GSTIN 15 characters with the **embedded-PAN cross-check** and the state code.
- `apps/server/src/onboarding/infrastructure/kyc-storage.adapter.ts` — the segregated bucket: its own KMS key, `block_public_access` asserted at call time, **no CDN**, per-access signed URL with a short TTL.
- `apps/server/src/onboarding/application/{upload-kyc-document.use-case.ts,issue-kyc-access-url.use-case.ts}` + specs — the latter writes an `audit_log` row with action `EXPORT` **before** returning the URL.
- `apps/server/src/onboarding/controllers/kyc.controller.ts` — `POST /v1/tenant/kyc-documents`, `GET /v1/tenant/kyc-documents`, `GET /v1/admin/kyc-documents/:id/access-url`.
- `apps/server/src/onboarding/infrastructure/upload-pipeline.ts` — content-type **inspection** (not the declared header), size limits, virus scan, metadata stripping, inline preview rendition for the reviewer.
- `infra/terraform/modules/object-storage/` — the two buckets with the KYC segregation, KMS key and access logging asserted in `terraform plan`.
- `apps/server/test/isolation/kyc.isolation-spec.ts` — generated; the KYC routes are named **explicitly** per `IS5`.

**Acceptance criteria**

1. All ten India document types are offered, each validated for format and size and previewable (`E2.3`, `LAUNCH_MARKET_INDIA.md` §6).
2. The checklist is **configuration**: editing it per country requires no deployment, is audited with a reason, and previews the affected in-flight applications (`FR-ADMN-06`, `FR-ADMN-02`).
3. Conditional-mandatory rules resolve from declared data — GSTIN required above the registration threshold; business registration proof filtered by `entity_type` (`AC-ONB-04.1`, `-04.2`).
4. PAN format `AAAAA9999A` is enforced **and** its fourth character must agree with `tenants.entity_type`; a malformed PAN is rejected at the pipe with a field-named message (`AC-ONB-04.3`).
5. GSTIN is 15 characters, embeds the state code and the PAN, and the embedded PAN must match the supplied one (`AC-ONB-04.4`).
6. **Aadhaar is not collected by default.** The platform's recorded position is PAN plus a non-Aadhaar identity document; the redaction deny-list nevertheless carries an Aadhaar pattern, because a support attachment or a free-text note can carry one regardless of policy (`LAUNCH_MARKET_INDIA.md` §6, `BR-DAT-06`).
7. Objects live in a bucket that is **separate from media**, encrypted under its own key, never fronted by the CDN, with `block_public_access` asserted by both Terraform and a runtime check (`BR-DAT-07`, `NFR-SEC-02`).
8. **Every access is logged**: issuing a signed URL writes an `audit_log` row with actor, reason and correlation id **before** the URL is returned, and read access is restricted to `VERIFICATION_OFFICER` and `SUPER_ADMIN` (`BR-DAT-07`).
9. Content type is determined by **inspecting the bytes**, not by trusting the declared header; a `.pdf` that is an executable is rejected. Metadata including EXIF is stripped before storage (`NFR-SEC-10`).
10. The reviewer's preview rendition is generated server-side and served inline; **there is no download control** on the reviewer path (`SCR-ADM-003`).
11. Generated isolation coverage names the KYC routes explicitly, and tenant B cannot obtain a signed URL for tenant A's document (`IS5`, R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `pan.vo.spec.ts`, `gstin.vo.spec.ts` | Unit | Format accept/reject pairs; the entity-type fourth character; the embedded-PAN cross-check |
| `resolve-checklist.use-case.spec.ts` | Unit | Each `entity_type` branch; the GSTIN threshold at and below the boundary |
| `kyc-storage-segregation.int-spec.ts` | Integration | An anonymous fetch of a KYC object returns `403`; the object is in the KYC bucket, not media |
| `kyc-access-audit.int-spec.ts` | Integration | `NEGATIVE:` — no signed URL is issued unless the audit row committed first (`BR-DAT-07`, `BAC-06`) |
| `upload-pipeline.spec.ts` | Unit | Byte-inspection rejects a mislabelled file; metadata stripped; size ceiling enforced |
| `kyc.isolation-spec.ts` | Isolation | A1–A4 on all three routes, KYC named explicitly per `IS5` |

**Rollback plan** — Migration phase: **expand** for `kyc_checklists`; the reference payload is
versioned and additive, never overwritten (`P11`). Flag `rel.onboarding.kyc-upload` (**new**): *off*,
the KYC step accepts no new uploads and the wizard shows an explicit maintenance state; documents
already stored remain readable to reviewers. The bucket segregation and the access-audit rule are
**not** flagged.

**Notes** — `SprintPlanning.md` Sprint 2 makes the ordering a rule, not a preference: *"task 2.3 is
done **before** task 2.1 completes — no upload endpoint ships until the segregated bucket, separate
key and access log exist."* This milestone therefore builds storage and the checklist **before** the
upload route is routable. The trap is the CDN: putting KYC behind the same distribution as gym media
is a one-line configuration convenience that makes a signed-URL leak permanent and cacheable.

---

### M-030 — The six automated pre-checks and their orchestration job

| Field | Value |
| :--- | :--- |
| **Sprint** | 2 |
| **Epic** | EP-03 · F-03.12 · T-03.15 … T-03.20 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Every submission runs six automated pre-checks whose results are **persisted on the
application**, none of which can auto-reject — they flag, a human decides, and approving over a
failed flag forces a recorded override with a reason.

**Depends on** — M-013, M-014, M-016, M-018, M-023, M-026, M-027, M-028, M-029.

**Unblocks** — the reviewer console, `E2E-01`, and the Sprint-2 exit gate (`Milestones_030-059.md`).

**Files**

- `apps/server/src/onboarding/domain/precheck-result.vo.ts` + spec — `{ check, outcome: PASS | FLAG | ERROR, evidence, ranAt }`; **no `REJECT` outcome exists in the type**.
- `apps/server/src/onboarding/application/prechecks/geo-distance.check.ts` — geocode the typed address through the maps anti-corruption layer, compare with `ST_Distance` against the dropped pin, tolerance as **configuration** (`BR-GYM-08`).
- `.../duplicate-address.check.ts` — the address normaliser plus an `ST_DWithin` radius probe against approved gyms; backed by a **partial unique index** on the normalised physical address (`BR-GYM-09`, `E2.9`).
- `.../duplicate-registration-id.check.ts` and `.../duplicate-bank-account.check.ts` — cross-tenant lookups executed through `runElevated('onboarding duplicate pre-check', …)` and therefore audited (M-014).
- `.../image-quality.check.ts` — decode with resource limits, resolution and blur thresholds, perceptual-hash duplicate detection against existing listings (`TR-40`).
- `.../profanity.check.ts` — prohibited-content screening on free text, including embedded contact details and URLs (`BR-GYM-07` adjacency).
- `apps/server/src/onboarding/jobs/run-prechecks.processor.ts` + spec — on the M-018 BullMQ harness: distributed lock, run record, duration alert, idempotent re-run.
- `apps/server/src/onboarding/domain/approval-override.policy.ts` + spec — approving with a `FLAG` outstanding requires a non-empty reason, recorded on the decision.
- `apps/server/prisma/migrations/<ts>_add_normalised_address_unique_index/migration.sql` — the `BR-GYM-09` partial unique index, created `CONCURRENTLY` in `concurrent.sql` (`§2.6`, `MG4`).
- `apps/server/src/onboarding/infrastructure/adapters/geocoding.adapter.ts` — the `§4.5` ACL with recorded fixtures under `test/fixtures/maps/`.
- `docs/runbooks/onboarding.md` — geocoder outage during submission, pre-check false-positive storm.

**Acceptance criteria**

1. All six pre-checks run at submission and their results are **persisted** on `applications.precheck_results` (`FR-ONB-12`, `AC-ONB-02.3`, `E2.4`).
2. **A pre-check never auto-rejects.** It flags; the `PrecheckOutcome` type has no rejecting member, so the prohibition is structural rather than procedural (`FR-ONB-12`).
3. A deliberate 4 km mismatch between the typed address and the map pin is flagged, and approval with a failed pre-check **forces a recorded override with a reason** (`E2.5`, `BR-GYM-08`).
4. A second application for the same **normalised physical address** is refused by the partial unique index, not merely warned about (`BR-GYM-09`, `E2.9`).
5. The address normaliser is tuned against **200 real Indian addresses including flat and floor variants**, and its corpus is committed as a fixture so a regression is visible (`SprintPlanning.md` Sprint 2 risk row 3).
6. The two cross-tenant checks run **only** through `runElevated` with a stated reason, and each execution writes its audit row; a direct cross-tenant query fails the isolation suite (`PE-T2`, M-014).
7. Image decoding is resource-limited — dimensions, pixel count and time — so a decompression bomb cannot exhaust a worker (`TR-40`).
8. A geocoder outage yields `outcome: ERROR` with the reason recorded, **never** a `PASS` and never a blocked submission; the reviewer sees "could not be checked", which is a different statement from "checked and fine" (`DEP-02`, `docs/runbooks/onboarding.md`).
9. The orchestration job is idempotent: re-running it on the same version replaces the result set rather than appending, and re-running is safe after a partial failure (`AC-FND-12.3`).
10. The job runs on the M-018 harness with a distributed lock, a `job_runs` record, metrics and a duration alert (`AC-FND-12.1`, `AC-FND-12.2`).
11. No new HTTP route is added by this milestone; the regenerated inventory shows zero uncovered routes and `IG-2` confirms no case group became stale (R-5).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `geo-distance.check.spec.ts` | Unit | Inside tolerance → `PASS`; 4 km outside → `FLAG`; geocoder throw → `ERROR`, never `PASS` |
| `duplicate-address.check.int-spec.ts` | Integration | The 200-address corpus normalises correctly; `ST_DWithin` finds a co-located approved gym; the partial unique index refuses the second insert (`E2.9`) |
| `cross-tenant-prechecks.int-spec.ts` | Isolation | Duplicate registration-id and bank-account checks run under elevation and write their audit rows; the same query without elevation is refused (`PE-T2`, `PE-T3`) |
| `image-quality.check.spec.ts` | Unit | A decompression bomb is refused inside the resource limit; a perceptual-hash duplicate is flagged |
| `profanity.check.spec.ts` | Unit | Prohibited terms, an embedded phone number and an embedded URL each flag |
| `run-prechecks.processor.spec.ts` | Unit | Idempotent re-run; the lock prevents a double execution; the duration alert fires past budget |
| `approval-override.policy.spec.ts` | Unit | `NEGATIVE:` — approval with an outstanding `FLAG` and no reason is refused (`E2.5`, `BAC-06`) |

**Rollback plan** — Migration phase: **expand**; the partial unique index is created `CONCURRENTLY`
in `concurrent.sql` and dropped `CONCURRENTLY` by a contract migration if it must go (`§2.6`). Flag
`rel.onboarding.precheck-suite` (**new**): *off*, submissions succeed and the reviewer sees "pre-checks
not run" — an explicit, visible absence rather than a silent pass. The `BR-GYM-09` unique index is
**not** flagged; it is a constraint, and a constraint is not a feature.

**Notes** — Two traps, both of which turn a fraud control into an availability incident. First, a
false duplicate-address positive blocks a legitimate gym, which is why pre-checks **flag and never
auto-reject**, why every flag is overridable with a reason, and why the normaliser is tuned against
real Indian addresses with their flat, floor and wing variants rather than against a generic
formatter. Second, an `ERROR` silently coerced to `PASS` is worse than no check at all: it tells a
reviewer that something was verified when nothing was. `SprintPlanning.md` Sprint 2 also requires the
reviewer's time-per-application to be **instrumented from day one**, because Anita's 30–60
applications per day is an assumption that stays unvalidated until `UAT-04` unless it is measured.

---

## 1. What this file deliberately does not cover

Recorded so that the boundary is a decision rather than an oversight. Each item is Sprint 0–2 scope
that belongs to another band or another discipline, with its destination named.

| Item | Sprint | Destination |
| :--- | :-: | :--- |
| Design tokens, `packages/ui` skeleton, the three app shells, the TanStack Query provider (tasks 0.24 – 0.27) | 0 | `Milestones_030-059.md`, FE band |
| Terraform `development` and `staging`, the Mumbai region plan, the secret store (tasks 0.29, 1.28) | 0–1 | `Milestones_030-059.md`, DevOps band |
| Feature-flag service, OpenTelemetry span detail, Redis token-bucket tuning (F-01.13, F-01.14, F-01.15) | 0 → 1 | `Milestones_030-059.md`; the two permitted Sprint-0 spillovers are recorded in `SprintPlanning.md` Sprint 0 |
| Google social login, duplicate-account merge, the effective-permission inspector (F-02.3, F-02.12, F-02.17) | 1 → 2 | `Milestones_030-059.md`; the two carry-ins are the Sprint-1 capacity mitigation |
| Profile, notification preferences, activity log, export and deletion requests (F-02.19 … F-02.24) | 1 | `Milestones_030-059.md` |
| Wizard steps 3–6 (gym profile, plans gate, payout account, review), which bind to EP-04 and EP-05 entities | 2 | `Milestones_030-059.md` |
| The reviewer console, `INFO_REQUESTED`, structured rejection, approval publication within 60 s (F-03.10, F-03.11, F-03.13, F-03.16) | 2 | `Milestones_030-059.md` |
| Gym and branch management, the media pipeline, EXIF stripping (EP-04) | 2 | `Milestones_030-059.md` |
| `E2E-01` Playwright automation and the QA retro-audit of Sprints 0–1 (tasks 2.19, 2.20) | 2 | `Milestones_030-059.md`, QA band |

## 2. Gate coverage accumulated by M-030

| `pr.yml` job | Wired at | Enforcing from |
| :--- | :--- | :--- |
| 1 `setup`, 2 `commit-grammar`, 3 `lint`, 4 `typecheck`, 5 `architecture`, 6 `module-structure`, 15 `scan-deps`, 16 `scan-secrets`, 25 `pipeline-integrity`, 26 `gate-summary` | M-007 | M-007 |
| 8 `api-gates`, 9 `api-absence-assertions`, 10 `openapi-drift`, 14 `contract` | M-008 | M-012 (first route); `PG-1` fully populated at M-023 |
| 11 `migration-safety`, 12 `integration` | M-009 | M-009 |
| 13 `isolation` | M-015 | M-015 — **unwaivable** (`CI_CD.md` §0.5, invariant I1) |
| 7 `unit` with the eight 95% globs and the 100% money glob | M-016 | M-016 |
| 17 `scan-sast`, 21 `bac06-report`, 22 `docs-traceability`, 23 `i18n-config-literals` | M-007 (declared) | M-020 onward, once there is domain code and user-facing text to police |
| 18 `a11y`, 19 `bundle-budget`, 20 `build-images`, 24 `lighthouse-lcp` | `Milestones_030-059.md` | FE band |

---

**END OF FILE — `Milestones_000-029.md` · milestones M-001 through M-030 · complete · continues in `Milestones_030-059.md` at M-031.**

