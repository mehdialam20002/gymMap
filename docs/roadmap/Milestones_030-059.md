# Implementation Roadmap — Milestones M-031 … M-060

**Document type:** Delivery roadmap (build order) · **Status:** Baseline for Sprints 2-tail → 6
**Owner:** Principal Engineer / Delivery Lead · **Approver:** Technical Lead (`C9.3`)
**Covers:** Sprint 2 tail (2026-10-05 → 2026-10-16) · Sprint 3 (2026-10-19 → 2026-10-30) · Sprint 4 (2026-11-02 → 2026-11-13, Diwali) · Sprint 5 (2026-11-16 → 2026-11-27) · Sprint 6 (2026-11-30 → 2026-12-11)
**Band:** M-031 … M-060 · **Continues from:** `Milestones_000-029.md` · **Continues in:** `Milestones_060-089.md`

---

## 0. What this file is

`Milestones_000-029.md` ended at M-030 with the six automated onboarding pre-checks merged and the
Sprint-2 exit gate still open. **This file carries the catalogue, the price authority, the
marketplace, checkout and money.** It is the band in which the platform stops being infrastructure
and starts being a product a stranger can buy from.

Every rule of `Milestones_000-029.md` §0.2 — **R-1** through **R-7** — applies here unchanged and is
not restated. In particular:

| Rule | Restated in one line, because this band is where they bite hardest |
| :--- | :--- |
| **R-1** | 2–6 focused hours for one engineer. Nothing in this file is 8 h with an optimistic label. |
| **R-2** | The repository is green on merge. A half-wired projection is worse than no projection. |
| **R-3** | Independently revertible: a flag, a `git revert`, or a named expand/contract phase. |
| **R-4** | Buildable strictly in ascending id order. Every `Depends on` cites a **lower** id. |
| **R-5** | **A milestone that adds an endpoint adds its isolation coverage in the same milestone.** CI job 13 is unwaivable (`CI_CD.md` §0.5 invariant I1, `BAC-10`, `E2E-11`, DoD #16). |
| **R-6** | **A milestone that adds a tenant-owned table adds its RLS policy *and* its grants in the same migration file** (`Schema.md` §2.6 P-STD template, §2.7 grant classes, `MG10`, `P9`). |
| **R-7** | A milestone that adds a table extends `prisma/seed/` and bumps `SEED_VERSION` (`TestingStrategy.md` §6.7). |

**No application code exists.** Every fenced block in this document is labelled
`illustrative — not committed code` and is a shape sketch for a reviewer, never a patch.

### 0.1 The starting state this file assumes

M-001 … M-030 are merged and green. Concretely, the following are **already true** and are never
rebuilt below: the strict compiler contract and `packages/{config,types,utils}`; the NestJS 10
bootstrap with the `§C3.1` error envelope; Docker Compose with PostgreSQL 16 + PostGIS + `pg_trgm` +
`btree_gist`, Redis 7, MinIO and Mailpit; `0_init` with the extensions, domains, enum catalogue and
the four roles; the ten always-on `pr.yml` gates plus `api-gates`, `migration-safety`, `integration`,
`isolation` and `unit`; **`tenants` + RLS (M-009), the Prisma tenant-context extension (M-010), the
middleware and ALS carrier (M-011), `TenantScopedRepository` (M-012), `audit_log` and the audit
interceptor (M-013), `runElevated()` (M-014), the generated isolation suite (M-015), `Money`/`Clock`
(M-016), `idempotency_keys` (M-017) and the transactional outbox with the `SKIP LOCKED` dispatcher
and the BullMQ harness (M-018)**; identity, sessions, RBAC, MFA and impersonation (M-019 … M-025);
and `applications`, `kyc_documents`, the `§C4.4` state machine, the India KYC checklist and the six
persisted pre-checks (M-026 … M-030).

> **`BR-TEN-01` is therefore already a structural property of the database.** Nothing in M-031 …
> M-060 is permitted to re-open that question, and every table below arrives with its P-STD policy
> and its grant class in the same file. The one table in this band that is **not** RLS-scoped —
> `search_documents` (M-042) — is `GLOBAL` by design and its exemption is argued in the milestone
> itself, not assumed.

### 0.2 Four reconciliations recorded before the list

`Milestones_000-029.md` §0.4 recorded R-M1 … R-M3. This file continues the series.

| # | Tension | Ruling |
| :--- | :--- | :--- |
| **R-M4** | `Milestones_000-029.md` §1 deferred the Sprint-0 frontend foundation — design tokens, the `packages/ui` skeleton, the three app shells and the TanStack Query provider (tasks 0.24 – 0.27) — to *"`Milestones_030-059.md`, FE band"*. Making them four standalone milestones would consume four of this file's thirty slots and leave three shells with no screen in them, which fails **R-2**: a shell with no route is half-wired by definition. | **The foundation ships inside the first frontend milestone of each surface, scoped to routing, providers, layout and tokens only.** `packages/ui` tokens plus the `admin-dashboard` shell land in **M-036**; the `gym-dashboard` shell in **M-041**; the `customer-web` shell, the TanStack Query defaults (ADR-0021) and `size-limit` wiring in **M-048**. Each of those three milestones names the shell files explicitly in its **Files** list and each is sized with the shell included. Job 18 `a11y`, job 19 `bundle-budget` and job 24 `lighthouse-lcp` become enforcing at M-036, M-048 and M-050 respectively. |
| **R-M5** | `Epic_04.md` T-04.04 names a **`gym_closures`** table. `Schema.md` §5 does not contain one: §5.3 models a dated closure as a `branch_hour_exceptions` row with `is_closed = true` and a `reason`, and `Schema.md` §15.1's table count has no room for a seventh catalogue table. Precedence (`roadmap/README.md` header) puts `engineering/`+`database/` above `backlog/`. | **`Schema.md` wins. There is no `gym_closures` table.** `FR-GYM-10` temporary closure is a **use case** (M-034) that writes a contiguous run of `branch_hour_exceptions` rows inside one transaction, keyed by a `closure_group_id` column added to that table in the same migration, and emits one `GymClosureDeclared` event for the run. The `GYM_CLOSED_EXCEPTION` denial reason, the `BR-MEM-14` notification and the consecutive-day demotion threshold all read the group, not a separate table. Recorded in `DECISION_LOG.md` by M-034. |
| **R-M6** | `SprintPlanning.md` places **EP-04 in Sprint 2** (tasks 2.8 – 2.12, 2.15, 2.16) and the reviewer console in Sprint 2 task 2.16, while this file's band nominally opens at Sprint 3. `Milestones_000-029.md` §1 explicitly deferred both here. | **M-031 … M-036 carry the sprint label `2`, not `3`.** A milestone's `Sprint` field states the sprint that owns it in `SprintPlanning.md`, never the file it happens to be written in. The Sprint-2 exit checklist `E2.7` (*listing live in under 60 seconds*) is satisfied by **M-036** emitting the publication event and **M-042/M-043** consuming it; until M-043 merges, `E2.7` is measured against outbox emission latency with the consumer stubbed, and the sprint review says so out loud. |
| **R-M7** | `SprintPlanning.md` Sprint 5 is the worst-committed sprint in the plan (backend 34.0 against 24.5, **139%**) and Sprint 6 is second (32.0 against 28.0). A roadmap that quietly schedules the full task list into ten milestones would be lying about capacity. | **This file schedules only the scope that survives the `SprintPlanning.md` Sprint-5 and Sprint-6 mitigations.** Task 5.9 (order history) and 5.10 (abandoned-checkout reminder) are **not** in this band — they land with CRM in Sprint 9. Task 5.8 (staff-initiated offline orders) is reduced here to the `channel = 'DASHBOARD'` / `PARTIALLY_PAID` **schema and constraint** in M-051; the desk flow and `SCR-DASH-012` are Sprint 9. Task 6.9 (RBI e-mandate) and task 6.17 (subscription charging) are **not** in this band — Sprint 6 mitigation moves 6.17 to Sprint 15 and the mandate lifecycle to `Milestones_060-089.md`. Task 6.15/6.22 (deterministic PDF and the India template) are **not** here: M-060 issues the numbered, immutable, GST-correct invoice **record**; the Chromium renderer is the next band. Each omission is named again in §2. |

### 0.3 Sprint bands

| Milestones | Sprint | Theme | `C9.1` exit condition served |
| :--- | :-: | :--- | :--- |
| M-031 … M-036 | 2 | **EP-04 catalogue** — gyms, branches, amenities, media, hours, the material-change classifier — and the EP-03 reviewer decision surface | `E2.3`, `E2.5` … `E2.10`, toward `E2E-01` |
| M-037 … M-041 | 3 | **EP-05 the price authority** — plans, entitlement, `resolvePrice()`, promotions, the editor | `E3.1` … `E3.4`, `E3.9` |
| M-042 … M-048 | 3 | **EP-06a discovery** — the projection, radius, text, filters, facets, zero-result, `SCR-WEB-002` | `E3.5` … `E3.8` |
| M-049 … M-050 | 4 | **EP-06b** — configurable ranking, featured slots, the `NFR-PERF-01` gate, detail, comparison, favourites | `E4.1` … `E4.12` — *"search meets `NFR-PERF-01` on seeded data"* |
| M-051 … M-057 | 5 | **EP-07 + EP-08a money in** — orders, server-side pricing, `BR-PLN-03`, coupons, the port, Razorpay Route, intents | `E5.1` … `E5.11` |
| M-058 … M-060 | 6 | **EP-08b + EP-09** — the webhook, activation, reconciliation, duplicates, the gapless GST invoice | `E6.1` … `E6.8`, toward `E2E-02` |

### 0.4 Index

| Id | Title | Sprint | Epic | Size | Role |
| :--- | :--- | :-: | :--- | :-: | :--- |
| M-031 | `gyms`, `branches`, `gym_amenities` and the branch lifecycle | 2 | EP-04 F-04.1/.6/.7 | 6h | BE |
| M-032 | The `Gym` aggregate — canonical slug, sanitised rich text, screening, amenities | 2 | EP-04 F-04.1/.3/.5 | 6h | BE |
| M-033 | `gym_media`, the upload gate and the Sharp rendition worker with **EXIF stripping** | 2 | EP-04 F-04.2 | 6h | BE |
| M-034 | `branch_hours`, `branch_hour_exceptions`, `OperatingHours` and temporary closure | 2 | EP-04 F-04.4/.10 | 6h | BE |
| M-035 | **`MaterialFieldRegistry`** — `BR-GYM-06` versus `BR-GYM-07`, one registry, one complement | 2 | EP-04 F-04.11 | 6h | BE |
| M-036 | The reviewer decision surface, `SCR-ADM-002`, `SCR-ADM-003`, `packages/ui` tokens | 2 | EP-03 F-03.10/.11/.13 | 6h | Full-stack |
| M-037 | `plans` — the `DURATION`/`SESSION` discriminated union in one Zod definition | 3 | EP-05 F-05.1 | 4h | BE |
| M-038 | `plan_branches`, `add_ons`, the `Plan` status machine and the archive path | 3 | EP-05 F-05.5/.6 | 6h | BE |
| M-039 | **`resolvePrice()`** — the single price authority, `PriceQuote` and the fingerprint | 3 | EP-05 F-05.10 | 6h | BE |
| M-040 | Promotional pricing and the `BR-PLN-07` exclusion constraint | 3 | EP-05 F-05.3 | 4h | BE |
| M-041 | `SCR-DASH-005`/`SCR-DASH-006` — the editor, the live preview, the price confirmation | 3 | EP-05 F-05.7/.8 | 6h | FE-dash |
| M-042 | `search_documents`, the six indexes and the `PublicVisibilityPredicate` | 3 | EP-06 F-06.9 | 6h | BE |
| M-043 | `search.reindex` — the outbox projection and the 60-second budget | 3 | EP-06 F-06.9 | 4h | BE |
| M-044 | `GET /v1/search/gyms` — `ST_DWithin` first, the 500-candidate ceiling, sorts, cache | 3 | EP-06 F-06.4/.7 | 6h | BE |
| M-045 | Free text — `tsvector`, `pg_trgm`, amenity synonyms and `/v1/search/suggest` | 3 | EP-06 F-06.2 | 6h | BE |
| M-046 | The ten `FR-SRCH-03` filters and facet counts in the same request | 3 | EP-06 F-06.3 | 6h | BE |
| M-047 | Zero-result guidance naming the most restrictive filter, and the `§C6` events | 3 | EP-06 F-06.12/.15 | 4h | BE |
| M-048 | `SCR-WEB-002` — list ↔ map synchronisation, URL state, the `customer-web` shell | 3 | EP-06 F-06.5/.7/.8 | 6h | FE-web |
| M-049 | **The configurable `FR-SRCH-10` ranking** and the `NFR-PERF-01` k6 gate | 4 | EP-06 F-06.10/.11 | 6h | BE |
| M-050 | Detail composition, comparison, favourites and `SCR-WEB-003` server-rendered | 4 | EP-06 F-06.16/.22/.26 | 6h | Full-stack |
| M-051 | `orders` and `order_items` — the nine `A6.3` figures and the `C4.2` machine | 5 | EP-07 F-07.5 | 6h | BE |
| M-052 | **Server-side amount computation** — `OrderPricingService` and the snapshot set | 5 | EP-07 F-07.4/.22 | 6h | BE |
| M-053 | **`BR-PLN-03` re-validation as a state-machine guard** → `422 PLAN_PRICE_CHANGED` | 5 | EP-07 F-07.23 | 4h | BE |
| M-054 | `coupons`, `coupon_redemptions`, `Coupon.evaluate()` and the `BR-CPN-04` cap | 5 | EP-07 F-07.12/.14/.20 | 6h | BE |
| M-055 | The `PaymentProvider` port, the Stripe reference adapter, the contract suite | 5 | EP-08 F-08.1/.15/.18 | 6h | BE |
| M-056 | **The Razorpay Route adapter** and the deterministic sandbox | 5 | EP-08 F-08.2/.3/.13 | 6h | BE |
| M-057 | `payments`, `payment_events` and `POST /v1/orders/:ref/payment-intent` | 5 | EP-08 F-08.14 | 6h | BE |
| M-058 | **The webhook receiver** — signature, dedup, replay, `C4.3`, durable-first `2xx` | 6 | EP-08 F-08.5 | 6h | BE |
| M-059 | **Webhook-exclusive activation**, `payment.reconcile`, `payment.duplicate-detect` | 6 | EP-08 F-08.4/.6/.9 | 6h | BE |
| M-060 | **The gapless per-tenant-per-FY invoice number** and the India GST breakdown | 6 | EP-09 F-09.2/.12/.13 | 6h | BE |

---

# PART A — SPRINT 2 TAIL · THE CATALOGUE (M-031 … M-036)

> **`EP-04` produces the artefact a stranger acts on.** Everything upstream established that a gym
> is *real*; everything downstream assumes the listing is *accurate enough to buy from without
> visiting*. The band closes the Sprint-2 exit checklist and unlocks `EP-05` (plans need a gym) and
> `EP-06` (search needs approved listings with coordinates).

### M-031 — `gyms`, `branches`, `gym_amenities` and the branch lifecycle

| Field | Value |
| :--- | :--- |
| **Sprint** | 2 |
| **Epic** | EP-04 · F-04.1, F-04.6, F-04.7 · T-04.03, T-04.05, T-04.15 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A tenant has a gym with a category and a city, and one or more branches each carrying a
structured address and a `geography(Point,4326)` pin behind a GiST index, and no tenant can read or
write another tenant's row on any of the three tables.

**Depends on** — M-009, M-010, M-011, M-012, M-013, M-015, M-023, M-026.

**Unblocks** — M-032, M-033, M-034, M-035, M-037, M-042.

**Files**

- `apps/server/prisma/migrations/<ts>_create_gyms/migration.sql` — `gyms` per `Schema.md` §5.1: `tenant_id`, `name`, `slug slug`, `city_id`, `description`, `category_id`, `gender_policy`, `status gym_status_enum DEFAULT 'DRAFT'`, `rating_avg numeric(2,1)`, `rating_count`, `freshness_score smallint`, `featured_until`, `parent_gym_id` with `ck_gyms__no_hierarchy CHECK (parent_gym_id IS NULL)`, `deleted_at`. Indexes `uq_gyms__city_slug`, `idx_gyms__tenant_id_status`, `idx_gyms__status_rating_freshness`. **RLS block and `GRANT SELECT, INSERT, UPDATE` (G-CRUD) in this same file** (R-6).
- `.../<ts>_create_branches/migration.sql` — `branches` per §5.2 including `state_code char(2)` (India place of supply), `location geography(Point,4326)` declared in raw SQL because Prisma has no geography scalar (ADR-0007), `geo_tolerance_metres`, `capacity CHECK (> 0)`, `is_primary`, `status branch_status_enum`. Indexes `gix_branches__location` (GiST), `idx_branches__city_status`, and `uq_branches__one_primary_per_gym` as a **partial unique index** `ON branches (gym_id) WHERE is_primary AND deleted_at IS NULL`. RLS + G-CRUD in the same file.
- `.../<ts>_create_gym_amenities/migration.sql` — `gym_amenities` per §5.4 with `uq_gym_amenities__gym_amenity`; grant class **G-CRUD-D** (§2.7) because a de-selected amenity is a genuine hard delete that destroys no history.
- `apps/server/prisma/migrations/concurrent.sql` — `gix_branches__location` created `CONCURRENTLY` per `MigrationStrategy.md` §2.6 / `MG4`.
- `apps/server/src/catalog/{index.ts, catalog.module.ts, permissions.ts, README.md, types/catalog.types.ts}` — the module's public surface: `GYM_TIMEZONE_PORT` (consumed by `memberships/` later), the read-model types, the `catalog.*` permission constants.
- `apps/server/src/catalog/domain/{branch.entity.ts, branch.entity.spec.ts, branch-deactivation.policy.ts, branch-deactivation.policy.spec.ts, catalog.errors.ts}` — `LAST_ACTIVE_BRANCH`, the `is_primary` invariant, the affected-membership count contract.
- `apps/server/src/catalog/application/{create-branch,update-branch,deactivate-branch,list-branches}.use-case.ts` + specs · `.../commands/*.command.ts`.
- `apps/server/src/catalog/controllers/branch.controller.ts` + spec · `apps/server/src/catalog/dto/{create-branch,update-branch,branch}.{request,response}.dto.ts` · `branch.openapi.ts`.
- `apps/server/src/catalog/infrastructure/{gym.prisma-repository.ts, branch.prisma-repository.ts}` + `.int-spec.ts` each (Testcontainers, **including the mandatory RLS assertion** per `FolderStructure.md` §9.9) + `{gym,branch}.mapper.ts`.
- `apps/server/prisma/seed/catalog.seed.ts` · `SEED_VERSION → 0.6` (R-7) — three gyms and five branches across the three fixed-uuid tenants, coordinates inside Bengaluru and Pune so the M-042 radius tests have real geography.
- `docs/database/catalog.md` (T-04.02) · `docs/apis/api-ten-catalog.md` (T-04.01) — the `§23.1` #5 and #6 Definition-of-Ready artefacts, authored in this PR because the epic includes designing its own contract.

**Acceptance criteria**

1. All three tables carry `tenant_id`, `ENABLE`+**`FORCE` ROW LEVEL SECURITY**, the `P-STD` policy pair generated from the §2.6 template, and their grant class — in the same migration file as the `CREATE TABLE` (`R-6`, `MG10`, `P9`, CI job 11).
2. `branches.location` is `geography`, not `geometry`, and `EXPLAIN` on `ST_DWithin(location, $1, $2)` shows `gix_branches__location` in use with no sequential scan; the plan is committed as a CI baseline (`EAC-04.11`, `TR-06`).
3. `uq_branches__one_primary_per_gym` is a **partial unique index, not a trigger**: promotion and demotion of the primary branch happen in one transaction and a counting trigger would race (`Schema.md` §5.2 note).
4. Deactivating a branch that is the gym's **only** active branch is refused with `LAST_ACTIVE_BRANCH` and the error names the closure flow instead (`AC-GYM-09.3`).
5. Deactivating a non-last branch states the **exact** affected-membership count before proceeding and requires an explicit reason; the count is computed, never approximated (`AC-GYM-09.1`, `NFR-USE-06`). With `memberships` absent until Sprint 7, the count resolves through a port whose Sprint-2 adapter returns `0` and whose contract test asserts the port is called — the number is wired, not invented.
6. Deactivation is a **status change, never a delete**: historical reads still resolve the branch name and address (`AC-GYM-09.4`, `NFR-DQ-04`).
7. `ck_gyms__no_hierarchy` is present and `parent_gym_id` is `NULL` on every seeded row; an attempt to set it fails loudly (`A4.2`, `ERD.md` §7.6).
8. Isolation coverage for all five branch routes is generated by the M-015 suite in this PR: A1–A7 per route, cross-tenant read and write, by id and by list (`R-5`, `IS5`, `BAC-10`).
9. Every branch mutation writes an append-only `audit_log` row with before/after and actor (`BR-DAT-01`, `BAC-13`).
10. `pnpm --filter server test:int` runs green against Testcontainers with the extended seed, and `SEED_VERSION` is `0.6` with the fixed uuids of `TestingStrategy.md` §6.1 unchanged (`R-7`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `branch.entity.spec.ts` | Unit | `is_primary` invariant; a second primary on the same gym is refused by the aggregate before the index sees it |
| `branch-deactivation.policy.spec.ts` | Unit | `NEGATIVE:` — last active branch refused; non-last requires a reason; a blank reason is not a reason (`BAC-06`) |
| `branch.prisma-repository.int-spec.ts` | Integration | Testcontainers; `SET LOCAL app.tenant_id` present; a read under tenant B returns zero rows for tenant A's branch (the mandatory RLS assertion) |
| `postgis-radius.int-spec.ts` | Integration | `ST_DWithin` returns the seeded Bengaluru branches at 3 km and excludes Pune; `EXPLAIN` output matches the committed baseline |
| `one-primary-per-gym.int-spec.ts` | Integration | Two concurrent transactions both setting `is_primary` produce exactly one success and one unique violation |
| `catalog.isolation-spec.ts` (generated) | Isolation | A1–A7 on `GET/POST /v1/tenant/branches`, `GET/PATCH/DELETE /v1/tenant/branches/:id` |

**Rollback plan** — Migration phase: **expand**. Three `CREATE TABLE` migrations and one
`CONCURRENTLY` index; the contract migration drops them in reverse order and drops the index
`CONCURRENTLY`. No data exists outside the seed, so the drop is genuinely reversible for the only
time in this table's life — after M-036 publishes a listing it never is again. No feature flag: a
table is not a feature.

**Notes** — Two traps. First, `geometry` instead of `geography`: `geometry` needs a projection step
to yield metres and `ST_DWithin(geometry, …)` then measures in **degrees**, which silently returns a
plausible-looking wrong radius. `Schema.md` §5.2 fixes `geography` for exactly this reason. Second,
the affected-membership count in criterion 5: the temptation at Sprint 2, with no `memberships`
table, is to omit the port and add it later. Later is Sprint 7, by which time the confirmation
dialogue has shipped saying nothing, and `NFR-USE-06` has been quietly broken for five sprints. Wire
the port now with a zero-returning adapter and a contract test that proves it is consulted.

---

### M-032 — The `Gym` aggregate — canonical slug, sanitised rich text, screening, amenities

| Field | Value |
| :--- | :--- |
| **Sprint** | 2 |
| **Epic** | EP-04 · F-04.1, F-04.3, F-04.5 · T-04.06, T-04.07, T-04.08, T-04.11, T-04.14 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — An owner can create and edit a gym profile whose description is sanitised and screened
before it is stored, whose slug is canonical, city-unique and stable after publication, and whose
amenities are platform taxonomy ids that no request path can turn into free text.

**Depends on** — M-013, M-016, M-023, M-031.

**Unblocks** — M-033, M-035, M-036, M-042, M-050.

**Files**

- `apps/server/src/catalog/domain/gym.entity.ts` + spec — the aggregate root, its invariants, and `applyChange()` declared as the single mutation entry point (the routing body arrives in M-035; here it routes everything to `IMMEDIATE`).
- `.../domain/{slug.vo.ts, gender-policy.vo.ts}` + specs — `GenderPolicy` covers `MIXED`, `WOMEN_ONLY`, `MEN_ONLY` and `SCHEDULED` with its reserved windows, and exports the denial-reason contribution `attendance/` will consume in Sprint 8.
- `.../application/{create-gym,update-gym,get-gym,set-amenities}.use-case.ts` + specs.
- `.../application/services/canonical-slug.service.ts` + spec — transliteration of Devanagari and Latin-with-diacritics to ASCII, city scoping, collision suffixing, **immutability after first publication**, and the 301 alias row on a deliberate change (`FR-NAV-05`).
- `.../application/services/content-screening.service.ts` + spec — phone numbers in Indian and international forms, email addresses, URLs including obfuscated ones (`dot`, `[.]`), and the prohibited-term list; returns `HOLD` with the matched spans, never a silent strip (`BR-GYM-07`, `FR-ADMN-12`).
- `.../infrastructure/adapters/html-sanitiser.adapter.ts` + spec — an allow-list of tags, **no attributes beyond `href` with a scheme allow-list**; the column never holds raw input (`Schema.md` §5.1, `NFR-SEC-05`).
- `apps/server/src/catalog/controllers/gym.controller.ts` + spec · `dto/{create-gym,update-gym,gym,set-amenities}.{request,response}.dto.ts` with `.strict()` Zod re-exported from `@gymmap/types` (A-02, ADR-0022) · `gym.openapi.ts`.
- `packages/types/src/schemas/catalog/{gym,amenity-selection}.schema.ts` — the one definition shared by API, dashboard form and tests.
- `apps/server/prisma/migrations/<ts>_create_gym_slug_aliases/migration.sql` — the 301 alias table, `(city_id, old_slug)` unique, RLS + G-APPEND (an alias is never edited).
- `apps/server/prisma/seed/catalog.seed.ts` — extended with fifteen amenity assignments per seeded gym; `SEED_VERSION → 0.7`.

**Acceptance criteria**

1. Every `FR-GYM-01` attribute round-trips through create → read → update unchanged, including a rich-text description that survives sanitisation **without losing legitimate formatting** (`EAC-04.01`).
2. The slug is canonical, human-readable, **unique per city and not globally** — two "Iron Temple" gyms in Bengaluru and Pune are both legitimate (`Schema.md` §5.1) — and renaming the gym does **not** change a published slug without an explicit action that also writes the 301 alias (`EAC-04.02`, `FR-NAV-05`).
3. A description containing a phone number, an email address or a URL is **held**, does not publish, and the response names the matched span so the owner can fix it (`EAC-04.03`, `BR-GYM-07-N1`).
4. A free-text amenity is refused **at the validation pipe** with `400`, on every entry path including bulk edit; the DTO has no field of type `string` capable of carrying one (`EAC-04.04`, `BR-GYM-07-N2`, `NFR-DQ-06`).
5. Renaming an amenity term in the platform taxonomy changes every gym's rendered label with **no tenant action**, because the reference is a stable id (`AC-GYM-04.2`).
6. Gender policy `SCHEDULED` stores its exact windows and the `GenderPolicy` value object exports them; the policy is a first-class field, not a sentence in the description (`AC-GYM-08.1`).
7. Sanitisation happens **on write**: reading the column back yields the sanitised HTML, and a direct-to-database insert of raw input is out of scope for the application role by construction because the write path is the only one granted (`Schema.md` §5.1).
8. Isolation coverage for the five gym routes and the amenity route is generated in this PR (`R-5`).
9. No personal data — owner phone, owner email — appears in any `catalog/` log line, trace or analytics event; the Pino redaction paths are configured and asserted (`EAC-04.26`, `BR-DAT-06`).
10. Every user-facing string added here is externalised through `NFR-USE-08`'s catalogue; CI job 23 `i18n-config-literals` is green.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `canonical-slug.service.spec.ts` | Unit | Transliteration table; city-scoped collision suffixing; **immutability after publication**; alias emitted on deliberate change |
| `content-screening.service.spec.ts` | Unit | Nine positive cases — `+91 98765 43210`, `98765-43210`, `name at domain dot com`, `bit.ly/x`, `wa.me/91…` — and four negatives that must **not** hold (a street number, a plan duration, a price, a year) |
| `html-sanitiser.adapter.spec.ts` | Unit | `<script>`, `onerror=`, `javascript:` and `data:` hrefs stripped; `<strong>`, `<ul>`, `<a href="https://…">` retained |
| `set-amenities.use-case.spec.ts` | Unit | `NEGATIVE:` — a taxonomy id that does not exist is `422`; a string that is not a uuid is `400` at the pipe (`BAC-06`) |
| `gym.controller.spec.ts` | Unit | `@RequiredPermission('catalog.gym.update')` present on every route (`FR-RBAC-01`, CI job 3) |
| `gym-profile.contract-spec.ts` | Contract | Supertest against the generated OpenAPI: the request schema has **no** free-text amenity field and **no** `slug` field on update |
| `catalog-gym.isolation-spec.ts` (generated) | Isolation | A1–A7 on all six routes |

**Rollback plan** — Migration phase: **expand** (`gym_slug_aliases` only). Flag
`rel.catalog.content-screening` (**new**, default *on*): *off*, descriptions publish without the
screening hold and every published description is queued to the `SCR-ADM-012` moderation backlog
instead — a visible, auditable degradation rather than a silent one. Sanitisation is **not** flagged;
it is a security control (`NFR-SEC-05`) and `P10` forbids a migration or a flag that disables a
protection.

**Notes** — The trap is treating screening and sanitisation as the same thing. Sanitisation is
**always on**, removes dangerous markup, and is invisible to a legitimate author. Screening is a
**policy** control that holds content a human then judges, and it produces false positives — a gym
called "Studio 91" or an address containing "Plot 98765" will trip a naive phone-number regex. That
is why screening holds rather than rejects, why the response names the matched span, and why the
flag exists. Conflating them produces either an XSS hole or an owner who cannot publish their own
address.

---

### M-033 — `gym_media`, the upload gate and the Sharp rendition worker with EXIF stripping

| Field | Value |
| :--- | :--- |
| **Sprint** | 2 |
| **Epic** | EP-04 · F-04.2 · T-04.19, T-04.20, T-04.21 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A photograph uploaded from an owner's phone is type-verified by its bytes, scanned,
stripped of every EXIF block, rendered into four sizes in three formats, and served from a CDN
origin — and the stored object can be read back and proven to carry no location metadata.

**Depends on** — M-016, M-018, M-029 (the segregated-bucket pattern and the storage adapter), M-031, M-032.

**Unblocks** — M-035, M-036, M-042, M-050.

**Files**

- `apps/server/prisma/migrations/<ts>_create_gym_media/migration.sql` — `gym_media` per `Schema.md` §5.4: `gym_id`, nullable `branch_id`, `media_type`, `storage_key` with `uq_gym_media__storage_key`, `renditions jsonb DEFAULT '{"schema_version":1}'` (S1–S7), `caption`, `sort_order`, `is_cover`, `moderation_status media_moderation_status_enum DEFAULT 'PENDING'`, `deleted_at`. Indexes `idx_gym_media__gym_sort`, the **partial** `idx_gym_media__moderation_status … WHERE moderation_status = 'PENDING'`, and `uq_gym_media__one_cover_per_gym` as a partial unique index `ON gym_media (gym_id) WHERE is_cover AND deleted_at IS NULL`. RLS + G-CRUD in the same file (R-6).
- `apps/server/src/catalog/application/{request-media-upload,confirm-media-upload,reorder-media,set-cover-media,delete-media}.use-case.ts` + specs.
- `apps/server/src/catalog/domain/{media-asset.entity.ts, rendition-set.vo.ts, upload-constraints.policy.ts}` + specs — the count caps (30 per gym, 15 per branch, `OQ-NEW-04.3` default) and the 12 MB size ceiling as **configuration**, not constants.
- `apps/server/src/catalog/infrastructure/adapters/{object-storage.adapter.ts, virus-scanner.adapter.ts, image-inspector.adapter.ts}` + specs — the `§4.5` anti-corruption layers; the inspector reads **magic bytes**, never the declared `Content-Type`.
- `apps/server/src/catalog/jobs/media-process.processor.ts` + spec — the BullMQ processor on the M-018 harness: distributed lock, `job_runs` record, bounded concurrency, a decode memory and pixel-count cap (`TR-40`), Sharp renditions `thumb` 320w / `card` 640w / `hero` 1280w / `lightbox` 2048w in AVIF + WebP + JPEG, **`.withMetadata(false)` plus an explicit EXIF/XMP/IPTC strip**, and a failure path that marks the row degraded without losing the original.
- `apps/server/src/catalog/controllers/gym-media.controller.ts` + spec · `dto/{request-upload,confirm-upload,reorder-media,media}.{request,response}.dto.ts` · `gym-media.openapi.ts`.
- `infra/terraform/modules/storage/media.tf` — the India-region media bucket, public-read **via the CDN only**, KMS key, access logging, lifecycle rules; the KYC bucket segregation from M-029 reaffirmed by an assertion, not by comment (`OQ-16`, `NFR-PRV-05`).
- `apps/server/test/fixtures/media/` — a GPS-tagged JPEG, a PDF renamed `.jpg`, a 40,000 × 40,000 decompression bomb, a 13 MB oversize file, and two perceptually identical photographs.
- `docs/runbooks/catalog-media.md` — rendition backlog, scanner outage, CDN purge.

**Acceptance criteria**

1. A JPEG carrying GPS EXIF tags produces renditions and an original-size derivative that contain **no EXIF block**, verified by reading the **stored object's bytes**, not by trusting the library (`AC-GYM-03.1`, `EAC-04.05`, `NFR-SEC-10`, Sprint-2 exit `E2.10`).
2. A file whose extension is `.jpg` but whose magic bytes are a PDF is refused with `UNSUPPORTED_MEDIA_TYPE` **before any decode is attempted** (`AC-GYM-03.4`, `TR-40`).
3. A decompression bomb is refused inside the worker's resource envelope — dimensions, pixel count and wall time — and cannot exhaust the worker (`TR-40`).
4. All four renditions in all three formats are produced for every accepted upload; a failed rendition marks the row **degraded** and retains the original rather than losing it (`EAC-04.06`).
5. Exactly one photograph per gym carries `is_cover = true`, enforced by the partial unique index and proven by a **concurrent** double-set attempt, not by the UI (`AC-GYM-03.3`, `EAC-04.07`).
6. A photograph awaiting moderation is **absent from the public gallery** while remaining visible to the owner with a "pending review" marker; display is gated on `moderation_status`, and EP-04 sets the field while EP-19 owns the queue that resolves it (`AC-GYM-03.5`).
7. While the virus scanner is unavailable, uploads land in `PENDING_SCAN` and the owner sees a pending state; nothing publishes unscanned (`Epic_04.md` §8.3, `DEP` degradation).
8. Reordering persists a full ordering in one transaction — gap-tolerant, never a sequence of pairwise swaps that can interleave (`AC-GYM-03.2`).
9. Media objects are served from a **separate origin** behind the CDN, in an **India region**, and an anonymous fetch of the raw bucket URL returns `403` (`Schema.md` §5.4, `OQ-16`).
10. Isolation coverage for all five media routes is generated in this PR, including the assertion that tenant B cannot obtain an upload URL scoped to tenant A's gym (`R-5`).
11. `gym.catalog.media.process.duration_ms` and a rendition-failure-rate alert are emitted and wired (`NFR-MNT-04` … `06`, `§23.1` #13).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `exif-stripped.int-spec.ts` | Integration | Uploads the GPS-tagged fixture, downloads every stored rendition **from object storage**, and asserts zero EXIF/XMP/IPTC markers on the bytes |
| `image-inspector.adapter.spec.ts` | Unit | Magic-byte accept/reject matrix over JPEG, PNG, WebP, AVIF, PDF-as-jpg, SVG-as-png, and a zero-byte file |
| `media-process.processor.spec.ts` | Unit | Twelve outputs per input; degraded-on-failure keeps the original; idempotent re-run replaces rather than appends; the lock prevents double execution |
| `decompression-bomb.spec.ts` | Unit | `NEGATIVE:` — the bomb fixture is refused inside the pixel-count cap and the worker's RSS does not exceed the envelope (`BAC-06`) |
| `one-cover-per-gym.int-spec.ts` | Integration | Two concurrent `set-cover` calls → exactly one success, one unique violation, no row left coverless |
| `media-bucket-public.int-spec.ts` | Integration | Anonymous direct-bucket `GET` → `403`; the CDN URL → `200`; the object is not in the KYC bucket |
| `gym-media.isolation-spec.ts` (generated) | Isolation | A1–A7 on all five routes; cross-tenant presigned-URL request refused |

**Rollback plan** — Migration phase: **expand** for `gym_media`; the partial unique index is created
`CONCURRENTLY` in `concurrent.sql`. Flag `rel.catalog.media-upload` (**new**): *off*, the upload
endpoint accepts nothing and the gallery shows an explicit maintenance state; objects already stored
remain readable and already-generated renditions keep serving. **EXIF stripping, byte inspection and
the resource caps are not flagged** — `P10` and `NFR-SEC-10`.

**Notes** — The trap is `sharp(...).toFormat('jpeg')` being assumed to drop metadata. It preserves
some by default depending on the input and version, and a library upgrade can change that silently.
`E2.10` is written as *"verified by reading the stored object"* precisely because a library-behaviour
assertion is not the same claim. The second trap is the CDN: putting media behind the **same**
distribution as the M-029 KYC bucket is a one-line convenience that makes a signed-URL leak
permanent and cacheable.

---

### M-034 — `branch_hours`, `branch_hour_exceptions`, `OperatingHours` and temporary closure

| Field | Value |
| :--- | :--- |
| **Sprint** | 2 |
| **Epic** | EP-04 · F-04.4, F-04.10 · T-04.12, T-04.13, T-04.18 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A branch can declare several open windows on one weekday and a dated exception that
overrides them, and one value object answers *"is this branch open at this instant"* in
`Asia/Kolkata` without a second database round-trip on the check-in path.

**Depends on** — M-016 (the `Clock` port and time discipline), M-018, M-031.

**Unblocks** — M-035, M-042, M-046, M-050.

**Files**

- `apps/server/prisma/migrations/<ts>_create_branch_hours/migration.sql` — `branch_hours` per `Schema.md` §5.3: `weekday smallint CHECK 0–6` (0 = Monday, ISO), `opens_at`/`closes_at` as `time` **wall-clock in the tenant's timezone**, `ck_branch_hours__opens_before_closes`, `uq_branch_hours__branch_weekday_opens`, and `ex_branch_hours__no_overlap EXCLUDE USING gist (branch_id WITH =, weekday WITH =, timerange(opens_at, closes_at) WITH &&)` — which is why `btree_gist` is installed by `0_init`. RLS + G-CRUD in the same file.
- `.../<ts>_create_branch_hour_exceptions/migration.sql` — `exception_date date`, `is_closed`, `ck_..__closed_has_no_times`, nullable `opens_at`/`closes_at`, `reason`, `uq_..__branch_date`, **plus `closure_group_id uuid NULL`** per **R-M5**. RLS + G-CRUD.
- `apps/server/src/catalog/domain/operating-hours.vo.ts` + spec — N windows per weekday, dated exceptions, **exception-always-wins** resolution, an **explicit IANA timezone argument** and no implicit server zone (`TR-07`, `TR-24`).
- `.../domain/closure-window.vo.ts` + spec — a validated date range in the gym's timezone, overlap refusal against existing exceptions, and the consecutive-day threshold (default **7**, `OQ-NEW-04.1`) as configuration.
- `.../application/{replace-branch-hours,declare-closure,cancel-closure}.use-case.ts` + specs · `.../commands/*.command.ts`.
- `.../domain/events/gym-closure-declared.event.ts` — one event per closure **group**, carrying gym, branch set, range and reason; consumed by `notifications/` in Sprint 14 and by `discovery/` for the demotion signal.
- `.../infrastructure/branch-hours.cache.ts` + spec — the per-branch resolved structure in Redis, invalidated by the outbox rather than by TTL, so check-in adds **no** round-trip beyond the branch row already loaded (`NFR-PERF-03`, `NFR-PERF-08`).
- `apps/server/src/catalog/controllers/branch-hours.controller.ts` + spec · `dto/{replace-hours,declare-closure,hours}.{request,response}.dto.ts` · `branch-hours.openapi.ts` — `PUT /v1/tenant/branches/:id/hours` is a **replace**, not a patch.
- `apps/server/prisma/seed/catalog.seed.ts` — split weekday hours (05:00–11:00, 16:00–23:00), one midnight-crossing pair, one 15 August closure; `SEED_VERSION → 0.8`.

**Acceptance criteria**

1. A weekday supports **≥ 2 windows**; there is deliberately no unique on `(branch_id, weekday)` because Indian gyms routinely close through the afternoon (`Schema.md` §5.3, `EAC-04.08`).
2. **Zero rows for a weekday means closed**, not unknown; the evaluator denies with `OUTSIDE_OPERATING_HOURS` (`Schema.md` §5.3).
3. A period crossing midnight is **two rows on two weekdays**; `opens_at > closes_at` is refused by `ck_branch_hours__opens_before_closes`. Evaluated at 00:30 IST the branch is open, and the result does not depend on the server's local zone (`AC-GYM-05.2`, `TR-07`, `TR-24`).
4. Overlapping windows on the same weekday are refused by the **exclusion constraint**, not by a read-then-write check a concurrent editor can defeat.
5. A dated exception **replaces** the day's hours entirely; it never merges. Where both apply, `GYM_CLOSED_EXCEPTION` is returned in preference to `OUTSIDE_OPERATING_HOURS` (`AC-GYM-05.3`, `AC-GYM-05.4`, `TM8`).
6. A temporary closure writes a contiguous run of exception rows in **one transaction** sharing a `closure_group_id`, refuses to overlap an existing closure, and emits exactly **one** `GymClosureDeclared` event for the run (**R-M5**, `FR-GYM-10`).
7. A closure exceeding the configured consecutive-day threshold sets the demotion signal and raises the `BR-MEM-14` notification event; delivery, channels and quiet hours belong to EP-17 and are **not** implemented here (`AC-GYM-02.3`).
8. Hours evaluation on the check-in path adds **no additional database round-trip**: the resolved structure is served from the Redis cache and the cache is invalidated by an outbox event, never by expiry (`EAC-04.09`, `NFR-PERF-03`).
9. Property-based tests cover boundary instants at the IST **+05:30** offset, including the 18:30 UTC day boundary, and the suite does **not** rely on India having no DST (`EAC-04.08`, `LAUNCH_MARKET_INDIA.md` §3).
10. Isolation coverage for the three hours/closure routes is generated in this PR (`R-5`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `operating-hours.vo.spec.ts` | Unit (property-based) | Generated instants across a week × the seeded window sets; exception precedence; the 00:30 midnight-crossing case; zero-rows-means-closed |
| `hours-timezone.spec.ts` | Unit | The same instant evaluated with `TZ=UTC`, `TZ=America/New_York` and `TZ=Asia/Kolkata` in the process gives **identical** answers (`TR-24`) |
| `no-overlap.int-spec.ts` | Integration | The `EXCLUDE USING gist` constraint refuses an overlapping window under two concurrent transactions |
| `declare-closure.use-case.spec.ts` | Unit | One event per group; overlap refused; a range inverted or longer than the configured maximum refused (`BAC-06`) |
| `branch-hours.cache.int-spec.ts` | Integration | A window edit invalidates the cached structure through the outbox within the budget; a read after invalidation issues **one** query, not two |
| `branch-hours.isolation-spec.ts` (generated) | Isolation | A1–A7 on `PUT /hours`, `POST /closures`, `DELETE /closures/:groupId` |

**Rollback plan** — Migration phase: **expand** for both tables; `closure_group_id` arrives with the
exceptions table so no later `ALTER` is needed (`P4`). Flag `rel.catalog.temporary-closure`
(`FEATURE_FLAGS.md` §7, already declared): *off*, the closure endpoints return `404` and existing
exception rows continue to be honoured by the evaluator — the flag gates **declaration**, never
**enforcement**, because a member turned away at a door the platform said was open is the failure
this epic exists to prevent.

**Notes** — Two traps. First, storing `opens_at`/`closes_at` as `timestamptz`: they are **wall-clock
local times**, not instants, and converting them at write time bakes in an offset that is wrong the
moment a tenant's timezone is corrected. `Schema.md` §5.3 fixes `time` for exactly this reason.
Second, modelling the midnight-crossing window as `22:00 > 02:00` on one row: every comparison
operator downstream then needs to know about wraparound, which is a bug generator with a two-year
tail. Two rows on two weekdays is uglier to write and impossible to get wrong.

---

### M-035 — `MaterialFieldRegistry` — `BR-GYM-06` versus `BR-GYM-07`, one registry, one complement

| Field | Value |
| :--- | :--- |
| **Sprint** | 2 |
| **Epic** | EP-04 · F-04.11 · T-04.09, T-04.10 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Every editable gym, branch and tenant field resolves to exactly one of `IMMEDIATE`,
`REQUIRES_REVIEW`, `IMMUTABLE` or `PAYOUTS_SUSPENDED` from **one** registry whose complement is
computed rather than listed, the consequence is stated to the caller **before** the write, and a
payout-account change suspends payouts instead of taking the listing down.

**Depends on** — M-013, M-014, M-025 (the impersonation token type), M-028, M-031, M-032, M-033, M-034.

**Unblocks** — M-036, M-042.

**Files**

- `apps/server/prisma/migrations/<ts>_create_pending_field_reviews/migration.sql` — `pending_field_reviews` keyed `uq_pending_field_reviews__gym_field (gym_id, field_name)`, carrying `proposed_value jsonb` (S1–S7), `approved_value jsonb`, `requested_by`, `requested_at`, `decided_at`, `decision`. RLS + G-CRUD in the same file (R-6).
- `apps/server/src/catalog/domain/material-field.registry.ts` + spec — the enumerated `REQUIRES_REVIEW` set of `apis/Gym.md` §6.1: `tenant.legal_name`, `tenant.entity_type`, `tenant.registration_number`, `tenant.pan`, `tenant.gstin`, `tenant.registered_address_*`, `branch.address_line1`, `branch.address_line2`, `branch.city_id`, `branch.state`, `branch.state_code`, `branch.postal_code`, `branch.location`, plus ownership changes; `gym.slug` as `IMMUTABLE`; the payout account as the `PAYOUTS_SUSPENDED` special case. **Everything else is the computed complement** — there is no second list (`BR-GYM-07`).
- `.../domain/gym.entity.ts` — `applyChange()` completed: it consults the registry, splits the diff, writes the immediate half to `gyms`/`branches` and the material half to `pending_field_reviews`, and never does both to the same field.
- `.../application/{classify-change,decide-field-review}.use-case.ts` + specs.
- `.../application/services/change-class-preflight.service.ts` + spec — builds the `field_change_classes` map returned alongside every `PATCH`-able representation (`apis/Gym.md` §6.3 mechanism 1).
- `.../guards/acknowledge-review.guard.ts` + spec — a `PATCH` touching a `REQUIRES_REVIEW` field **without** `"acknowledge_review": true` is refused `422 APPLICATION_PRECHECK_OVERRIDE_REQUIRED` whose `details[]` enumerate the detected material fields and the consequence (mechanism 2).
- `.../ports/payout-suspension.port.ts` — exported from `catalog/index.ts`; `settlements/` implements it in Sprint 11 and holds the batch with reason `PAYOUT_ACCOUNT_UNVERIFIED`.
- `apps/server/src/catalog/controllers/payout-account.controller.ts` + spec — `PUT /v1/tenant/payout-account` decorated `@FinancialMutation()` so an impersonating support agent is refused (`AC-GYM-06.4`, `SEC-A01-007`).
- `apps/server/test/catalog/material-field-drift.spec.ts` — the CI drift test that enumerates **every** editable field on the three aggregates and asserts each resolves to exactly one class.
- `docs/features/gym-catalogue.md` · `apps/server/src/catalog/README.md` (T-04.41 shape).

**Acceptance criteria**

1. The material and non-material sets are **complements of one registry**; a CI test enumerates every editable field across `gyms`, `branches` and `tenants` and fails naming any field that resolves to zero or two classes (`EAC-04.18`, `BR-GYM-06`/`BR-GYM-07` drift test).
2. Changing address or geo-location places **that field** in review while the listing **stays live at the last approved coordinates**; search continues to return the gym at the old pin until the review is decided (`EAC-04.15`, `AC-GYM-06.2`, `BR-GYM-06-P1`).
3. `gyms.status` moves `APPROVED → PENDING_REVIEW` while marketplace visibility, checkout, check-in, settlement and payouts all **continue unaffected** (`apis/Gym.md` §6.2).
4. The consequence is disclosed **before** the write: a test asserts the `field_change_classes` map is present on the read that precedes the mutation **and** that the mutation without `acknowledge_review` is refused — a banner alone does not pass (`EAC-04.17`, `FR-GYM-11`).
5. Classification is computed **inside the write transaction** from a diff against freshly read state; there is no `/preview` endpoint whose answer can disagree with the write it precedes (`apis/Gym.md` §6.3, `L6-UC`).
6. Changing the payout bank account **does not touch `gyms.status`**: it sets `payout_accounts.status → PENDING_VERIFICATION` and `tenants.payout_hold_until`, and the next settlement batch holds with `PAYOUT_ACCOUNT_UNVERIFIED` (`EAC-04.16`, `BR-GYM-06-P2`).
7. An impersonating actor attempting the payout-account change is **refused**, proven by a negative test against the `@FinancialMutation()` guard (`AC-GYM-06.4`, `AC-AUTH-03.2`).
8. A photograph, a description, an amenity, a timing or a plan price publishes **immediately** with no review step, subject only to the M-032 screening (`AC-GYM-06.5`, `BR-GYM-07-P1`).
9. A pin edit that would move the branch beyond the `BR-GYM-08` tolerance is routed to `FIELD_REVIEW`, never applied silently (`BR-GYM-08-N1`).
10. Every classification decision and every field-review decision writes an `audit_log` row carrying the field name, both values and the actor (`BR-DAT-01`, `BAC-13`).
11. Isolation coverage for `PUT /v1/tenant/payout-account` and the two field-review routes is generated in this PR (`R-5`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `material-field-drift.spec.ts` | Unit | Every editable field resolves to exactly one class; a field added to an entity without a registry entry **fails the build** |
| `material-field.registry.spec.ts` | Unit | The eighteen `REQUIRES_REVIEW` entries of `apis/Gym.md` §6.1 verbatim; `slug` is `IMMUTABLE`; the payout account is `PAYOUTS_SUSPENDED` and **not** `REQUIRES_REVIEW` |
| `apply-change.use-case.spec.ts` | Unit | A mixed diff splits correctly; the immediate half commits, the material half lands in `pending_field_reviews`, and neither field appears in both |
| `acknowledge-review.guard.spec.ts` | Unit | `NEGATIVE:` — `PATCH` without the acknowledgement is `422` and the `details[]` name the fields (`BAC-06`) |
| `listing-stays-live.int-spec.ts` | Integration | After an address change the search projection still returns the **old approved** coordinates and the detail page still resolves |
| `payout-impersonation.int-spec.ts` | Integration | `NEGATIVE:` — an impersonation token on `PUT /payout-account` is refused; a normal owner token succeeds |
| `catalog-material.isolation-spec.ts` (generated) | Isolation | A1–A7 on the three routes |

**Rollback plan** — Migration phase: **expand** for `pending_field_reviews`. Flag
`rel.catalog.material-change-routing` (**new**): *off*, **every** change routes to `REQUIRES_REVIEW`
and nothing publishes immediately. The OFF position is deliberately the **conservative** one, not the
permissive one — a flag failure must not turn the takeover control off. The `@FinancialMutation()`
guard on the payout path is **not** flagged.

**Notes** — This is the single most consequential design decision in EP-04 and the reason a
"Moderate" complexity rating still earns 55 points. The trap is writing the non-material set as a
second literal list: the two lists drift within a sprint, a field lands in neither, and the default
becomes whatever the last `else` branch says. Compute the complement. The second trap is the payout
account: routing it to `PENDING_REVIEW` like the other material fields would take the listing down
and stop sales, which punishes the 99.9% of owners correcting a typo in their IFSC while doing
nothing extra to stop the 0.1% takeover — `BR-GYM-06`'s special case exists because suspending
**payouts** is the proportionate control.

---

### M-036 — The reviewer decision surface, `SCR-ADM-002`, `SCR-ADM-003` and `packages/ui` tokens

| Field | Value |
| :--- | :--- |
| **Sprint** | 2 |
| **Epic** | EP-03 · F-03.10, F-03.11, F-03.13, F-03.16 · tasks 2.6, 2.7, 2.16 |
| **Size** | 6h |
| **Role** | Full-stack |

**Goal** — A verification officer can read an application's documents inline, see the six persisted
pre-checks, approve only by overriding each outstanding flag with a written reason, and the approved
listing is queued for publication within sixty seconds — and there is no automated path to
`APPROVED`.

**Depends on** — M-023, M-024 (staff MFA), M-025, M-028, M-029, M-030, M-031, M-032, M-033, M-035.

**Unblocks** — M-042, M-043, the Sprint-2 exit gate, `E2E-01`.

**Files**

- `apps/server/src/onboarding/application/{approve-application,reject-application,request-information}.use-case.ts` + specs — each consuming the M-028 state machine and the M-030 `approval-override.policy.ts`.
- `apps/server/src/onboarding/controllers/application-review.controller.ts` + spec — `POST /v1/admin/applications/:id/{approve,reject,request-info,assign}` per `ui/AdminDashboard.md` §6.3.1: `AdminActionBase` + `expected_version` + `precheck_overrides[]`, `Idempotency-Key` **required**, `auth_time ≤ 900 s`.
- `apps/server/src/onboarding/domain/rejection-reason.vo.ts` + spec — the sixteen `§C4.8` structured reason codes, each mapped to the specific field the owner must correct (`FR-ONB-11`).
- `apps/server/src/onboarding/domain/events/application-approved.event.ts` + the outbox emitter — the publication event `discovery/` consumes in M-043; the sixty-second budget starts here (`FR-ONB-13`, `BAC-02`).
- `packages/ui/src/tokens/{colour,spacing,type,radius,elevation,motion}.ts` · `packages/ui/src/primitives/{Button,Input,Select,Dialog,Table,Badge,Tabs,Toast}.tsx` + stories · `packages/ui/tailwind-preset.ts` · `packages/ui/src/index.ts` — **R-M4**: the design-token layer and the eight primitives the reviewer console needs, no more.
- `apps/admin-dashboard/src/app/{router.tsx, providers.tsx, layout.tsx}` · `apps/admin-dashboard/src/shared/{api/fetcher.ts, query/client.ts, auth/session.tsx}` — **R-M4**: the admin shell, TanStack Query defaults (ADR-0021), the auth boundary. Routing and providers only.
- `apps/admin-dashboard/src/features/approvals/` — `components/{ApprovalQueue,ApplicationReview,PrecheckPanel,DocumentViewer,ChecklistPanel,OverrideDialog,VersionDiff}.tsx`, `hooks/use-application.ts`, `schemas/decision.schema.ts` re-exported from `@gymmap/types`.
- `docs/ui/scr-adm-002.md` · `docs/ui/scr-adm-003.md` — loading, empty, error, permission-denied plus the domain states (pre-check failed, document not provided, resubmission diff) per `§23.1` #7.

**Acceptance criteria**

1. **`→ APPROVED` is unreachable from any automated code path.** The guard requires an authenticated `VERIFICATION_OFFICER` or `SUPER_ADMIN` with a fresh `auth_time`, and a negative test proves the transition cannot be driven by a job, an event handler or a webhook (`E2.6`, `BR-GYM-03`, `RSK-01`).
2. Approving while any pre-check outcome is `FLAG` **forces** a recorded override carrying a non-empty reason per flag; the reason is persisted on the decision and audited (`E2.5`, M-030's `approval-override.policy.ts`).
3. The document viewer renders a server-generated preview **inline** and there is **no download control** anywhere on the reviewer path; the signed URL is time-limited, single-use and audited **before** it is returned (`SCR-ADM-003`, `BR-DAT-07`).
4. A rejection carries **at least one and at most sixteen** structured reason codes, each mapped to a named field, and the owner's dashboard renders a field-level correction list (`E2.8`, `FR-ONB-11`, `§C4.8`).
5. `INFO_REQUESTED` produces a checklist of one to twenty requested items with an optional `respond_by`, and the application returns to the queue with its version preserved (`FR-ONB-10`).
6. Approval emits the publication event and the listing is visible in the search projection within **60 seconds** — measured, from the event's `occurred_at`, by the Sprint-2 demo stopwatch and by an automated assertion once M-043 lands (`E2.7`, `BAC-02`, **R-M6**).
7. `Alt + A` / `Alt + R` / `Alt + I` open the confirmation for approve, reject and request-info; **no shortcut performs a destructive action directly** (`ui/AdminDashboard.md` K6); `[`/`]` page the document viewer; `1`…`9` jump the checklist.
8. `SCR-ADM-002` and `SCR-ADM-003` are **axe-core clean** and fully keyboard operable, and both are workable at **768 px** (`ui/AdminDashboard.md` §D5, `NFR-USE-01`, `NFR-USE-02`). CI job 18 `a11y` becomes enforcing at this milestone (**R-M4**).
9. Time-per-application is instrumented from the first merge — `gym.onboarding.review.duration_ms` with a percentile view — because Anita's 30–60 applications per day is an assumption that stays unvalidated until `UAT-04` unless it is measured (`SprintPlanning.md` Sprint 2 risk 4, `FR-ADMN-11`).
10. Idempotency is enforced on all four decision endpoints: a replayed key with an identical fingerprint returns the stored response, a different fingerprint returns `409` (`BR-PAY-03` pattern, M-017).
11. Isolation coverage for the four admin routes is generated in this PR; the admin surface is platform-scoped, so the suite asserts the `runElevated` path is used and audited rather than asserting tenant isolation (`R-5`, `IS5` platform case, M-014).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `approve-application.use-case.spec.ts` | Unit | `NEGATIVE:` — approval with an outstanding `FLAG` and no reason is refused; with a reason per flag it succeeds and the reasons persist (`BAC-06`) |
| `no-automated-approval.contract-spec.ts` | Contract | The OpenAPI document exposes exactly one route that can produce `APPROVED`, and it carries the `VERIFICATION_OFFICER` permission — a CI **absence** assertion, job 9 |
| `rejection-reason.vo.spec.ts` | Unit | All sixteen `§C4.8` codes map to a field; an unmapped code fails to construct |
| `publication-latency.int-spec.ts` | Integration | The outbox row exists before the response returns; end-to-end latency to projection is asserted once M-043 merges and is skipped-with-reason until then |
| `document-viewer.a11y-spec.ts` | Accessibility | axe-core clean; focus order through pre-check panel → viewer → checklist → decision bar; no download control in the accessibility tree |
| `approval-keyboard.e2e-spec.ts` | E2E (Playwright) | `Alt + A` opens the confirmation and does **not** approve; the full decision is completable without a mouse |
| `admin-approvals.isolation-spec.ts` (generated) | Isolation | Platform-scope case group: elevation used, audit row written, no unelevated cross-tenant read |

**Rollback plan** — No migration. Flag `rel.onboarding.reviewer-console` (**new**): *off*, the four
decision endpoints return `503` with a maintenance problem-details body and the queue renders
read-only; **applications remain in their current state and nothing auto-decides**. The
human-only guard and the override-with-reason policy are **not** flagged — they are `RSK-01`'s
entire defence. `packages/ui` and the admin shell revert by `git revert`; no consumer outside
`admin-dashboard` exists yet.

**Notes** — `SprintPlanning.md` calls this *"the most consequential screen in the platform"* and it
is the one place in the band where a UI convenience is a security decision. Three traps. First, a
download button: once a KYC document is on a reviewer's laptop the platform's access log stops being
the record of who saw it. Second, a bulk-approve affordance — it will be asked for on day two, and
it converts a per-application human judgement into a single click over a page of applications, which
is `RSK-01` with a keyboard shortcut. Third, `E2.7`'s sixty seconds: the temptation is to publish
synchronously inside the approval transaction to "guarantee" it. That couples a human decision to a
projection rebuild and turns a slow reindex into a failed approval. Emit the event, commit, and let
M-043 be fast.

---

# PART B — SPRINT 3 · THE PRICE AUTHORITY (M-037 … M-041)

> **`EP-05` is not a CRUD epic. It is the construction of the one function every money surface in
> the platform will call for the next fifteen sprints.** `FolderStructure.md` §1 invariant 3 states
> it flatly: pricing authority is *"a single directory, `apps/server/src/plans/domain/`, and a single
> exported port"*, and no other module may contain a file matching `*price*` in a `domain/` folder.
> M-037 … M-040 build that authority. M-041 is the only surface that may edit it.

### M-037 — `plans` — the `DURATION`/`SESSION` discriminated union in one Zod definition

| Field | Value |
| :--- | :--- |
| **Sprint** | 3 |
| **Epic** | EP-05 · F-05.1, F-05.2, F-05.4 · T-05.01, T-05.02, T-05.04, T-05.09 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — A gym owner can create a `DURATION` plan or a `SESSION` plan whose type-specific fields
are *unrepresentable* when wrong rather than merely rejected, priced in integer paise with an
adjacent currency, and no tenant can read or write another tenant's plan.

**Depends on** — M-010, M-012, M-013, M-016, M-023, M-031, M-032.

**Unblocks** — M-038, M-039, M-040, M-041, M-042, M-051.

**Files**

- `apps/server/prisma/migrations/<ts>_create_plans/migration.sql` — `plans` per `Schema.md` §6.1: `tenant_id`, `gym_id`, `name`, `description`, `plan_type plan_type_enum`, `duration_value`, `duration_unit duration_unit_enum`, `session_count`, `session_validity_days`, `price_minor money_minor_nonneg`, `joining_fee_minor DEFAULT 0`, `currency currency_code`, `min_age smallint CHECK (0..120)`, `gender_eligibility DEFAULT 'ANY'`, `freeze_allowed DEFAULT false`, `freeze_max_days`, `transfer_allowed`, `stackable`, `access_window jsonb DEFAULT '{"schema_version":1}'`, `visibility plan_visibility_enum DEFAULT 'PUBLIC'`, `status plan_status_enum DEFAULT 'DRAFT'`, `sort_order`, `deleted_at`. Checks `ck_plans__type_fields_present` and `ck_plans__freeze_cap_requires_freeze`. Index `idx_plans__gym_status_visibility (gym_id, status, visibility)`. **RLS `ENABLE` + `FORCE`, the `§2.6` P-STD policy pair and `G-CRUD` grants in this same file** (R-6); retention class **R-FIN** recorded in the migration header comment.
- `packages/types/src/schemas/plans/plan.schema.ts` — **the single `z.discriminatedUnion('plan_type', [DurationPlan, SessionPlan])`**, re-exported by the DTOs, the dashboard form and the seed. One definition, three consumers (A-02, ADR-0022).
- `apps/server/src/plans/{index.ts, plans.module.ts, permissions.ts, README.md, types/plan-read-model.types.ts}` — the module's only public surface: `PLAN_PRICING_PORT` and `PLAN_TERMS_PORT` tokens (declared here, implemented in M-039), the `plans.plan.*` permission constants.
- `apps/server/src/plans/domain/{plan.entity.ts, plan-type.vo.ts, access-window.vo.ts, plans.errors.ts}` + specs — `AccessWindow` parses `plans.access_window`, validates ≤ 21 windows, and is exported for `attendance/` to consume at check-in in Sprint 8 (`F-05.2`, `BR-CHK-05`).
- `apps/server/src/plans/application/{create-plan,update-plan,get-plan,list-plans}.use-case.ts` + specs · `commands/*.command.ts`.
- `apps/server/src/plans/controllers/plan.controller.ts` + spec · `dto/{create-plan,update-plan,plan}.{request,response}.dto.ts` · `dto/plan.openapi.ts`.
- `apps/server/src/plans/infrastructure/{plan.prisma-repository.ts, plan.mapper.ts}` + `plan.prisma-repository.int-spec.ts` (Testcontainers, with the mandatory RLS assertion of `FolderStructure.md` §9.9).
- `apps/server/prisma/seed/plans.seed.ts` · `SEED_VERSION → 0.9` (R-7) — twelve plans across the three fixed-uuid tenants per `TestingStrategy.md` §6.2, including one `SESSION` plan with `session_count = 1` (the `OQ-14` trial default) and one ₹2,50,000 annual corporate plan for the `E3.9` digit-grouping check.
- `docs/database/plans.md` · `docs/apis/api-ten-plans.md` — the `§23.1` #5/#6 Ready artefacts.

**Acceptance criteria**

1. `ck_plans__type_fields_present` makes a `SESSION` plan carrying `duration_unit`, and a `DURATION` plan carrying `session_count`, **impossible at the database level**, not merely rejected by a validator (`BR-PLN-01`, `Schema.md` §6.1).
2. The Zod discriminated union is defined **once** in `packages/types`; a grep proves no second plan-shape schema exists in `apps/server` or either dashboard (`AC-PLAN-01.1`, A-02).
3. `plan_type` is immutable after creation — a `PATCH` attempting to change it is `422 PLAN_TYPE_IMMUTABLE`, and the field is absent from the update DTO (`SCR-DASH-006` §8.2).
4. All money is `bigint` minor units with `currency` adjacent; a float, a formatted string or a JSON number for `price_minor` is `400 VALIDATION_FAILED` (`BR-PAY-01`, CI job `no-float-money`).
5. `session_validity_days` is stored and the entity exposes *"expires on the earlier of exhaustion or validity end"* as a single method; two call sites cannot disagree (`BR-PLN-06`).
6. `freeze_max_days` without `freeze_allowed` is refused by the check constraint **and** by the aggregate, with `422 CONFIG_VALIDATION_FAILED` (`SCR-DASH-006` §8.2).
7. `sort_order` is honoured by every list read, tenant-facing and public, in one shared ordering clause (`F-05.4`, `FR-PLAN-04`).
8. `status` is created as `DRAFT` always — the field is absent from the creation DTO, so no request can create a `PUBLISHED` plan (`SCR-DASH-006` §8.2 "absent by design").
9. Isolation coverage for the five plan routes is generated by the M-015 suite in this PR: A1–A7 per route (`R-5`, `IS5`, `BAC-10`).
10. `SEED_VERSION` is `0.9`, the fixed uuids of `TestingStrategy.md` §6.1 are unchanged, and `pnpm --filter server test:int` is green (`R-7`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `plan-type.vo.spec.ts` | Unit | The union's two branches; a mixed-shape object fails to type-check *and* fails to parse |
| `access-window.vo.spec.ts` | Unit | 21-window cap; overlapping windows on one weekday; a window crossing midnight |
| `create-plan.use-case.spec.ts` | Unit | `NEGATIVE:` — `freeze_max_days` without `freeze_allowed`; `min_age` 121; `price_minor` as a float (`BAC-06`) |
| `plan.prisma-repository.int-spec.ts` | Integration | Testcontainers; `SET LOCAL app.tenant_id` on the same connection; tenant B reads zero of tenant A's plans |
| `plan-type-check.int-spec.ts` | Integration | A raw `INSERT` violating `ck_plans__type_fields_present` is refused by Postgres, proving the guard is not application-only |
| `plans.isolation-spec.ts` (generated) | Isolation | A1–A7 on `GET/POST /v1/tenant/plans`, `GET/PATCH/DELETE /v1/tenant/plans/:id` |

**Rollback plan** — Migration phase: **expand**. One `CREATE TABLE`; the contract migration drops it.
Reversible only until M-051 writes the first `orders.plan_id`, after which the R-FIN retention class
binds and the table is permanent. No feature flag — a table is not a feature.

**Notes** — The trap is modelling `DURATION` as an interval. `TM12` and `Schema.md` §6.1 require an
integer plus a named unit, because *"3 months"* from 30 November is not *"90 days"* and a serialised
`interval` hides which one the owner meant. The second trap is the temptation to give the union a
shared base object with optional fields on both branches; that is a union in name only and it makes
criterion 1 unenforceable at the type level.

---

### M-038 — `plan_branches`, `add_ons`, the `Plan` status machine and the archive path

| Field | Value |
| :--- | :--- |
| **Sprint** | 3 |
| **Epic** | EP-05 · F-05.5, F-05.6, F-05.9 · T-05.05, T-05.06, T-05.11, T-05.14 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A plan can be restricted to named branches under open-world semantics, carries priced
add-ons, moves `DRAFT → PUBLISHED → ARCHIVED` through a machine with no delete edge, and archiving
takes it off sale and out of new orders while every existing membership keeps its terms.

**Depends on** — M-031, M-034, M-037.

**Unblocks** — M-039, M-041, M-042, M-051, M-052.

**Files**

- `apps/server/prisma/migrations/<ts>_create_plan_branches_add_ons/migration.sql` — `plan_branches` per `Schema.md` §6.2 with `uq_plan_branches__plan_branch` and grant class **G-CRUD-D** (a de-selected branch is a genuine hard delete); `add_ons` with `price_minor`/`currency` adjacent, `is_recurring`, `deleted_at`, grant class **G-CRUD**. **RLS P-STD on both, in this file** (R-6).
- `apps/server/src/plans/domain/{plan-status.machine.ts, branch-scope.vo.ts, archive.policy.ts, add-on.entity.ts}` + specs — the machine's four states and its three legal edges; `BranchScope` encodes **zero rows = all branches** and exposes `resolve(branchIds)`; `ArchivePolicy` computes the affected counts.
- `apps/server/src/plans/application/{publish-plan,archive-plan,duplicate-plan,set-plan-branches,create-add-on,list-add-ons}.use-case.ts` + specs.
- `apps/server/src/plans/application/services/archive-preview.service.ts` + spec — the **two-phase** `{confirm:false}` preview that writes nothing and the `{confirm:true}` commit that echoes the same block (`SCR-DASH-006` §8.6).
- `apps/server/src/plans/ports/plan-membership-count.port.ts` — the port `ArchivePolicy` consults for active and pending membership counts; the Sprint-3 adapter returns zeroes and a contract test asserts the port is called. Replaced by a real adapter in Sprint 7.
- `apps/server/src/plans/controllers/plan.controller.ts` (extended) · `dto/{publish-plan,archive-plan,duplicate-plan,set-plan-branches,add-on}.{request,response}.dto.ts`.
- `apps/server/src/plans/infrastructure/{plan-branch.prisma-repository.ts, add-on.prisma-repository.ts}` + int-specs.
- `apps/server/prisma/seed/plans.seed.ts` — two branch-restricted plans, one unrestricted, three add-ons; `SEED_VERSION → 0.10`.

**Acceptance criteria**

1. **Absence of `plan_branches` rows means all branches.** There is no `is_all_branches` column anywhere and the response echoes `branch_scope: { mode: "ALL_BRANCHES" | "SPECIFIC", resolved_branch_ids: [...] }` (`Schema.md` §6.2, `SCR-DASH-006` §8.2).
2. Removing the **last** `plan_branches` row is a **widening**, and the confirmation payload says so in those words — *"including branches you add later"* — because a narrowing-shaped message here is a mis-sale (`NFR-USE-06`).
3. The status machine has states `DRAFT`, `PUBLISHED`, `ARCHIVED` and edges `DRAFT→PUBLISHED`, `PUBLISHED→ARCHIVED`, `DRAFT→ARCHIVED`. **There is no un-archive edge and no delete path in any layer** — the repository exposes no `delete*` method (`BR-PLN-04`, `F-05.5`).
4. Archiving removes the plan from sale immediately, **blocks it in new orders**, and leaves every existing membership untouched; the invariant is asserted against the seed rather than argued (`E3.2`, `AC-PLAN-03.1`).
5. `POST /v1/tenant/plans/:id/archive` with `{"confirm": false}` returns `200`, writes nothing, and carries active count, pending count, earliest and latest end dates, and mid-checkout order count. With `{"confirm": true}` the same block is echoed as the record of what was true at that instant (`SCR-DASH-006` §8.6).
6. Publishing a plan whose gym has no `ACTIVE` branch is `422 CONFIG_VALIDATION_FAILED`; publishing under a non-approved tenant is `403 TENANT_NOT_APPROVED`; publishing an archived plan is `422 PLAN_ARCHIVED` (`SCR-DASH-006` §8.5).
7. Duplicate produces a new plan in `DRAFT` with a distinct id, `plan_branches` and `add_ons` copied, and **no** promotion copied — a promotional window is time-bound and copying it silently re-runs a past offer (`F-05.6`, `FR-PLAN-06`).
8. Add-ons carry independent `price_minor`/`currency` and `is_recurring`; they contribute to `G` and never to `D` (`A6.3`, `F-05.9`).
9. Isolation coverage for the six added routes is generated in this PR (`R-5`).
10. Every archive and publish writes an `audit_log` row with before/after, actor and the confirmation payload as `reason` context (`BR-DAT-01`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `plan-status.machine.spec.ts` | Unit | All 12 state × edge combinations; `NEGATIVE:` — `ARCHIVED → PUBLISHED` is refused, and the machine has no edge to add it |
| `branch-scope.vo.spec.ts` | Unit | Zero rows resolves to all active branches; removing the last row is reported as `WIDENING`, never `NARROWING` |
| `archive.policy.spec.ts` | Unit | Preview and commit produce identical blocks; the membership-count port is consulted exactly once |
| `no-plan-delete.structure-spec.ts` | Unit | A structure test: no method name matching `/^(delete\|remove\|destroy)/` exists in `plans/infrastructure/` |
| `archive-blocks-orders.int-spec.ts` | Integration | An archived plan is absent from the sellable projection and the reason is `PLAN_ARCHIVED`, asserted through the port `ordering/` will use in M-051 |
| `plan-lifecycle.isolation-spec.ts` (generated) | Isolation | A1–A7 on publish, archive, duplicate, set-branches and the two add-on routes |

**Rollback plan** — Migration phase: **expand** (two tables). Flag `rel.plans.add-ons` (**new**,
default *off* until M-052 prices them): *off*, the two add-on routes return `404` and the checkout
summary has no add-on line — no partially-priced order can exist. The status machine and the archive
path are **not** flagged: `BR-PLN-04` is a data-integrity rule, and a flag that restores a delete
path is exactly what `P10` forbids.

**Notes** — Two traps. First, closed-world branch scoping: if zero rows meant *"no branches"*, adding
a branch next month would silently un-sell every existing plan, and if a boolean sat beside the list
there would be two sources of truth that drift. `Schema.md` §6.2 chose open-world for that reason and
this milestone must not "improve" it. Second, the archive preview: the temptation is to compute the
counts outside the transaction for speed. `BR-PLN-02`'s assurance to the owner — *"the 412 members who
already bought this keep their price"* — is worthless if 412 is stale, and it is the number the owner
makes the decision on.

---

### M-039 — `resolvePrice()` — the single price authority, `PriceQuote` and the fingerprint

| Field | Value |
| :--- | :--- |
| **Sprint** | 3 |
| **Epic** | EP-05 · F-05.10 · T-05.16, T-05.17, T-05.20, T-05.31 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Exactly one function in the repository can turn a plan into money, it returns a
`PriceQuote` that cannot be constructed from a request body, and a `STAFF_ONLY` plan is structurally
absent from every public surface rather than filtered out of one.

**Depends on** — M-016, M-037, M-038.

**Unblocks** — M-040, M-041, M-042, M-050, M-052, M-053.

**Files**

- `apps/server/src/plans/domain/pricing/resolve-price.ts` + spec — **the authority.** Signature `resolvePrice(plan: Plan, at: Instant, context: PricingContext): PriceQuote`. Pure, `Clock`-injected, no repository access, no I/O.
- `apps/server/src/plans/domain/pricing/{price-quote.vo.ts, price-fingerprint.ts, monthly-equivalent.ts}` + specs — `PriceQuote` has a **private constructor and no `fromJSON`**; `priceFingerprint()` is a SHA-256 over the canonical tuple `(plan_id, price_minor, joining_fee_minor, promo_price_minor, promo_window, currency, plan_version)`; `monthlyEquivalent()` normalises a `DURATION` plan to `lowest_monthly_equiv_minor` for `FR-SRCH-06` and `FR-DETL-03`.
- `apps/server/src/plans/ports/plan-pricing.port.ts` — `PLAN_PRICING_PORT`, the **only** exported way for `discovery/`, `ordering/` and `billing/` to obtain a price. `plans/index.ts` exports the token and the interface, never the implementation.
- `apps/server/src/plans/domain/public-visibility/public-plan.predicate.ts` + spec — `status = 'PUBLISHED' AND visibility = 'PUBLIC' AND deleted_at IS NULL`, expressed once and consumed by the projection (M-042), the public plan catalogue and the detail composition (M-050).
- `apps/server/src/plans/controllers/public-plan.controller.ts` + spec · `dto/public-plan-list.response.dto.ts` — `GET /v1/gyms/:slug/plans` per `Marketplace.md` §6, `@Public()`, no tenant header, scope `public`.
- `apps/server/src/plans/infrastructure/plan-pricing.adapter.ts` — binds the port to the domain function; contains no arithmetic of its own.
- `packages/config/src/dependency-cruiser/rules/pricing-authority-single-home.cjs` — **the CI rule**: no file matching `*price*` or `*pricing*` may exist in any `domain/` folder other than `plans/domain/pricing/` (`FolderStructure.md` §1 invariant 3).
- `apps/server/test/contract/staff-only-absence.contract-spec.ts` — the **absence** assertion suite.
- `docs/apis/api-pub-plans.md` · `docs/adr/` note recording that reversion is computed, not scheduled.

**Acceptance criteria**

1. `resolvePrice()` is the only function in `apps/server` that multiplies, discounts or selects a plan price; `pricing-authority-single-home` fails the build if a second appears (`FolderStructure.md` §1 invariant 3, `E5.8`-style structural proof).
2. `PriceQuote` cannot be constructed from a DTO: no public constructor, no `static fromJSON`, no `z.infer` that produces it. A test attempts every route and fails to compile, asserted by `tsd` (`F-07.4`, `BR-PAY-04`).
3. The quote carries `base_minor`, `joining_fee_minor`, `effective_minor`, `promo_applied`, `currency`, `resolved_at` and `fingerprint`. The fingerprint is stable across processes and changes when **any** input changes (`BR-PLN-03` — this is the token M-053 compares).
4. `monthlyEquivalent()` normalises correctly for `DAY`, `WEEK`, `MONTH`, `QUARTER`, `HALF_YEAR`, `YEAR` using `round_half_even`, so a ₹18,000 annual plan and a ₹1,899 monthly plan compare honestly (`FR-SRCH-06`, `FR-DETL-03`).
5. A `SESSION` plan has **no** monthly equivalent and returns `null`, not a fabricated figure derived from `session_validity_days` (`Search.md` §3.6).
6. **A `STAFF_ONLY` plan is absent from `GET /v1/gyms/:slug/plans`, from the search projection input and from detail composition, proven by a contract test that asserts absence rather than by inspection** (`E3.4`, `BR-PLN-05`, `F-05.10`).
7. The predicate exists once; a grep proves no second `status = 'PUBLISHED'` literal in a public read path (`F-06.9` — the shared `PublicVisibilityPredicate` M-042 extends).
8. `GET /v1/gyms/:slug/plans` is `@Public()` with an explicit declaration so `FR-RBAC-01`'s CI check sees a decision, not an omission (`Search.md` §3, `Marketplace.md` §6).
9. Isolation coverage: the public route is registered in the `TestingStrategy.md` §5.5 non-tenant-scoped register with its justification, and the tenant-facing plan routes keep their A1–A7 coverage (`R-5`, `IS4`).
10. No response body anywhere contains an internal ranking or cost figure — `rating_bayes`, `commission_rate_bps` and the raw `price_minor` of a `STAFF_ONLY` plan are absent (`Search.md` §4.2).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `resolve-price.spec.ts` | Unit | 24 cases: each plan type × promo before/during/after × joining fee zero/non-zero; `round_half_even` at the half-paisa boundary |
| `price-fingerprint.spec.ts` | Unit | Determinism across two processes; a one-paisa change alters the digest; field reordering does not |
| `monthly-equivalent.spec.ts` | Unit | All six duration units; `SESSION` returns `null`; a 366-day year does not shift the figure |
| `price-quote.tsd-spec.ts` | Unit (type) | `PriceQuote` is unconstructable from a plain object — the test **must not compile** if it becomes constructable |
| `staff-only-absence.contract-spec.ts` | Contract | Supertest over the generated OpenAPI: the `STAFF_ONLY` seeded plan appears in **zero** public responses across the plan list, gym detail and search fixtures |
| `pricing-authority.structure-spec.ts` | Unit | `dependency-cruiser` run in-process returns zero violations of `pricing-authority-single-home` |

**Rollback plan** — No migration. No feature flag: a flag on the price authority would create a
second code path for money, which is the thing this milestone exists to prevent. Reverting is
`git revert` of the branch; the only consumer at this point is `plans/` itself and the public
controller, both introduced here.

**Notes** — The trap is the *convenience overload*. Within two sprints someone will want
`resolvePrice(planId)` that loads the plan itself, and that overload puts a repository call inside the
pure function, which makes it untestable at the boundary and, worse, makes it possible to price
against a **stale** read. The port exists so callers fetch the plan and pass it in. The second trap is
`STAFF_ONLY`: filtering it in the controller is the obvious implementation and it fails the moment a
seventh public surface is added. The predicate is the enforcement point precisely because a new
surface has to *ask* for plans and there is only one way to ask.

---

### M-040 — Promotional pricing and the `BR-PLN-07` exclusion constraint

| Field | Value |
| :--- | :--- |
| **Sprint** | 3 |
| **Epic** | EP-05 · F-05.3 · T-05.07, T-05.08, T-05.22 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — A plan can carry one promotional price over one window, a second overlapping promotion is
refused **by the database** rather than by a read-then-write check, and the promotion reverts at its
end instant without a job running.

**Depends on** — M-016, M-037, M-039.

**Unblocks** — M-041, M-042, M-052.

**Files**

- `apps/server/prisma/migrations/<ts>_add_plan_promotions/migration.sql` — adds `promo_price_minor money_minor_nonneg`, `promo_starts_at`, `promo_ends_at`, `promo_label text`; `ck_plans__promo_window_complete CHECK (num_nonnulls(promo_price_minor, promo_starts_at, promo_ends_at) IN (0,3))`; and **`ex_plans__one_active_promotion EXCLUDE USING gist (plan_id WITH =, tstzrange(promo_starts_at, promo_ends_at) WITH &&) WHERE (promo_price_minor IS NOT NULL)`**, which requires `btree_gist` (present since `0_init`, M-004). All three columns are nullable, so the migration is backward-compatible (`MG2`).
- `apps/server/src/plans/domain/pricing/promotion.vo.ts` + spec — the window, the label, `isActiveAt(instant)` with **half-open `[start, end)`** semantics, and `mustBeBelowBasePrice()`.
- `apps/server/src/plans/domain/pricing/resolve-price.ts` (modified) — the promotion branch — `effective_minor` takes `promo_price_minor` when the window contains the supplied instant and `price_minor` otherwise. **Reversion is a comparison, not a scheduled write.**
- `apps/server/src/plans/application/{set-promotion,clear-promotion}.use-case.ts` + specs · `commands/`.
- `apps/server/src/plans/infrastructure/plan.prisma-repository.ts` (modified) — maps the `23P01` exclusion violation to `422 PROMOTION_OVERLAPS_EXISTING` carrying the conflicting promotion's **label and dates**.
- `apps/server/src/common/errors/error-code.registry.ts` (modified) — `PROMOTION_OVERLAPS_EXISTING`, `PROMO_PRICE_NOT_BELOW_BASE`, owning module `plans`, HTTP `422`, requirement `BR-PLN-07`.
- `apps/server/prisma/seed/plans.seed.ts` — one plan with a live promotion, one with an expired promotion, one with a future promotion; `SEED_VERSION → 0.11`.

**Acceptance criteria**

1. Two overlapping promotions on one plan are refused **by `ex_plans__one_active_promotion`**, proven by two concurrent transactions in an integration test where exactly one commits (`BR-PLN-07`, `Schema.md` §6.1).
2. The `422` response names the conflicting promotion — *"'Monsoon offer' already runs 1 Aug – 30 Sep"* — because an owner told only *"overlapping promotion"* cannot find it in a catalogue of forty plans (`SCR-DASH-006` §8.2).
3. Promotion windows are **half-open**: a promotion ending 30 Sep 23:59:59.999 IST and one starting 1 Oct 00:00:00 IST do **not** overlap, and the `tstzrange` default `[)` bound is asserted explicitly (`AC-PLAN-04.1`).
4. **Reversion is automatic and jobless**: at `promo_ends_at` the next `resolvePrice()` call returns the base price with no write, no job and no cache purge on the authority itself (`E3.3`, `FR-PLAN-03`).
5. A promo price greater than or equal to the base price is `422 PROMO_PRICE_NOT_BELOW_BASE` — a "promotion" that raises the price is a mis-sale (`BR-PLN-07-N1`).
6. `ck_plans__promo_window_complete` makes a partially-filled promotion impossible: all three columns or none (`Schema.md` §6.1).
7. The promotional price flows into `lowest_monthly_equiv_minor` and `promo_active` on the search card, so the marketplace shows the promoted figure (`Search.md` §3.6).
8. Isolation coverage for `PUT/DELETE /v1/tenant/plans/:id/promotion` is generated in this PR (`R-5`).
9. Setting or clearing a promotion writes an `audit_log` row; the promotion is a price change and `BR-PLN-02` applies, so it also requires `confirm_price_change` (`SCR-DASH-006` §8.4).
10. `SEED_VERSION` is `0.11`, with the three promotion states seeded against the **fixed** clock so the reversion tests are deterministic (`TestingStrategy.md` §6.3).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `promotion.vo.spec.ts` | Unit | Half-open boundary at both ends; a zero-length window is refused; a window entirely in the past is legal to store and inactive to read |
| `resolve-price.spec.ts` (extended) | Unit | Reversion at the exact end instant under the fixed `Clock`; the instant *before* still promotes |
| `promotion-exclusion.int-spec.ts` | Integration | Two concurrent `SET promotion` transactions → one commit, one `23P01`; the mapped error carries the conflicting label and dates |
| `promo-window-check.int-spec.ts` | Integration | A raw `UPDATE` setting only `promo_price_minor` is refused by `ck_plans__promo_window_complete` |
| `promotion.isolation-spec.ts` (generated) | Isolation | A1–A7 on the two promotion routes |

**Rollback plan** — Migration phase: **expand** — four nullable columns, one check, one exclusion
constraint; the contract migration drops the constraint first, then the columns. Flag
`rel.plans.promotions` (**new**, default *on*): *off*, `PUT /promotion` returns `503` and
`resolvePrice()` **ignores** the promotion columns entirely, so every plan sells at base price. That
degradation is safe in exactly one direction — it can only overcharge relative to a promotion the
customer never saw, because the projection reads the same authority and reverts with it in the same
60-second window.

**Notes** — The trap is enforcing "one active promotion" with a `SELECT … WHERE overlaps` followed by
an `INSERT`. Two owners — or one owner and one retrying client — race through the gap and the plan
ends with two promotions, after which `resolvePrice()` has to pick one and whichever it picks is
someone's bug. `Schema.md` §6.1 chose an exclusion constraint for exactly this. The second trap is
scheduling reversion: a `plan.revert-promotion` job looks tidy and introduces a window in which the
database says the promotion ended and the price still says otherwise. Compute it.

---

### M-041 — `SCR-DASH-005`/`SCR-DASH-006` — the editor, the live preview, the price confirmation

| Field | Value |
| :--- | :--- |
| **Sprint** | 3 |
| **Epic** | EP-05 · F-05.7, F-05.8, F-05.4 · T-05.24, T-05.25, T-05.27, T-05.33 |
| **Size** | 6h |
| **Role** | FE-dash |

**Goal** — A gym owner can author, price, promote, publish and archive a plan from the dashboard,
sees the marketplace card the customer will see rendered by the **server's** projection, and cannot
change a price without reading the server's real affected-membership count first. The
`gym-dashboard` shell ships with it (**R-M4**).

**Depends on** — M-023, M-037, M-038, M-039, M-040.

**Unblocks** — M-048 (`packages/ui` primitives), M-050.

**Files**

- `apps/gym-dashboard/{index.html, src/main.tsx, src/app.tsx, vite.config.ts, size-limit.json, playwright.config.ts}` — **the shell (R-M4)**: React 18 + Vite, the route table, the `QueryClientProvider` with the ADR-0021 defaults, the error boundary, the `NFR-USE-02` skip link and the `packages/ui` theme provider. Routing, providers and layout **only** — no business logic.
- `apps/gym-dashboard/src/routes/{plans.route.tsx, plan-editor.route.tsx}` — `SCR-DASH-005` at `/plans`, `SCR-DASH-006` at `/plans/:id` and `/plans/new`.
- `apps/gym-dashboard/src/features/plans/components/{plan-catalogue-table.tsx, plan-editor-form.tsx, marketplace-preview-panel.tsx, price-change-dialog.tsx, archive-dialog.tsx, promotion-fields.tsx, branch-scope-field.tsx, access-window-editor.tsx}` + specs.
- `apps/gym-dashboard/src/features/plans/hooks/{use-plans.ts, use-plan.ts, use-save-plan.ts, use-archive-preview.ts}` — TanStack Query; mutations invalidate rather than hand-patch the cache.
- `apps/gym-dashboard/src/shared/{api/client.ts, query/query-client.ts, auth/session.tsx, i18n/, analytics/}` — the shell's cross-cutting seams, sized in.
- `packages/ui/src/{tokens/, components/{button,input,money-input,dialog,table,badge,switch,select,form-field}}` + stories — the first `packages/ui` consumers beyond `admin-dashboard`; `money-input` renders `₹` as a prefix adornment and groups **lakh/crore** as the owner types, submitting integer paise as a **string**.
- `apps/gym-dashboard/e2e/{plan-editor.e2e-spec.ts, plan-archive.e2e-spec.ts}` · `apps/gym-dashboard/src/features/plans/plans.a11y-spec.ts`.

**Acceptance criteria**

1. The editor renders **one branch of the discriminated union at a time**: choosing `SESSION` removes the duration fields from the DOM, not merely disables them, so a resubmitted form cannot carry both (`SCR-DASH-006` §8.2, `F-05.1`).
2. `plan_type` is locked after creation with a visible lock affordance and an explanation, not a silently disabled control (`SCR-DASH-006` §8.2, `NFR-USE-06`).
3. The preview panel renders **`marketplace_preview.card` returned by `GET /v1/tenant/plans/:id`** — the same projection code the public API uses. A client-side reimplementation of the card is a review rejection (`F-05.7`, `FR-PLAN-07`).
4. The four preview cases render distinctly: published-public shows the live card; draft-public shows the card with a *"Not published yet"* ribbon; `STAFF_ONLY` shows `preview_unavailable_reason: "STAFF_ONLY"` as an explanation; unsaved edits show the last saved card with *"Preview updates when you save"* (`SCR-DASH-006` §8.3).
5. A price change without `confirm_price_change: true` receives `422 PLAN_PRICE_CONFIRMATION_REQUIRED` and the dialog renders **the server's** affected count and the sentence that names the protection first — *"affects new purchases only"* (`F-05.8`, `BR-PLN-02`, `SCR-DASH-006` §8.4). Focus defaults to **Cancel**.
6. The confirmation is server-enforced: a Playwright test that issues the `PATCH` directly, skipping the dialog, still receives `422` (`FR-RBAC-02`, `AC-STAF-01.2`).
7. Removing the last branch renders the **widening** sentence verbatim from the server's confirmation payload, never a client-authored string (`Schema.md` §6.2, `NFR-USE-06`).
8. The archive dialog calls the preview phase first, always, and renders every returned figure: active and pending counts, earliest and latest end dates, mid-checkout order count, and *"Archived plans are never un-archived"* (`SCR-DASH-006` §8.6).
9. `422 PROMOTION_OVERLAPS_EXISTING` renders the named conflicting promotion **with its dates**, and focus moves to the promotion date field (`SCR-DASH-006` §8.2).
10. All four mandatory states — loading, empty, error, populated — exist for both screens; axe-core is clean at AA; the full editor is completable by keyboard; `size-limit` is green for the `gym-dashboard` entry (`NFR-USE-01`, `NFR-PERF-10`, CI jobs 18 and 19 become enforcing for this app here).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `plan-editor-form.spec.ts` | Unit | Union branch swap removes the other branch's inputs from the DOM; `freeze_max_days` disabled until `freeze_allowed` |
| `money-input.spec.ts` | Unit | `250000` renders `₹2,50,000` not `₹250,000`; submits `"25000000"` paise as a string; a pasted float is rejected at the field (`E3.9`) |
| `marketplace-preview-panel.spec.ts` | Unit | All four preview cases; **no card is synthesised client-side when the server returns none** |
| `price-change-dialog.spec.ts` | Unit | Renders the server count; Cancel is the default focus; Confirm re-sends with the flag |
| `plan-editor.e2e-spec.ts` | E2E (Playwright) | Create → price → promote → publish → archive; the direct-`PATCH` bypass still receives `422` |
| `plans.a11y-spec.ts` | Accessibility | axe-core clean on both screens; focus order form → preview → action bar; the lock affordance is announced |

**Rollback plan** — No migration. Flag `rel.plans.editor` (**new**, default *on*): *off*, `/plans`
renders read-only with a maintenance banner and the editor route 404s; **no authoring path is
partially available**. The shell itself is not flagged — it has no behaviour to disable — and reverts
by `git revert`; `admin-dashboard` already consumes `packages/ui`, so a revert of the new primitives
must be checked against it, which the `packages/ui` build in CI does.

**Notes** — The trap is the live preview. Re-rendering the card locally on every keystroke feels
better and produces a second implementation of the marketplace card — which is precisely the failure
`FR-PLAN-07` exists to prevent, because the two implementations will disagree on the day a promotion
label is added and the owner will publish something they never saw. The panel shows the **last saved**
server card and says so. `SprintPlanning.md` also lists frontend as the binding pool this sprint at
124%; this milestone is sized with the shell included because splitting it would leave a shell with no
route, which fails **R-2**.

---

# PART C — SPRINT 3 · MARKETPLACE DISCOVERY (M-042 … M-048)

> **This is the largest block in the file and the one with a hard number attached to it.**
> `NFR-PERF-01` — p95 ≤ 500 ms, p99 ≤ 1,000 ms at `NFR-PERF-09`'s 2,000 searches per minute — is met
> or the `E4.1` gate fails, and ADR-0007 has already ruled that a search cluster is a **rejected
> substitution**. The architecture that makes the number achievable is decided here, in M-042: a
> denormalised projection that the request path reads **without a single join**.

### M-042 — `search_documents`, the six indexes and the `PublicVisibilityPredicate`

| Field | Value |
| :--- | :--- |
| **Sprint** | 3 |
| **Epic** | EP-06 · F-06.9 · T-06.01, T-06.02, T-06.09, T-06.14 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A single denormalised table exists that can answer any marketplace search without joining
to `gyms`, `branches`, `plans` or `branch_hours`, and the five conditions of `FR-SRCH-09` are
expressed once, as the rule that decides whether a row exists at all.

**Depends on** — M-031, M-034, M-037, M-038, M-039.

**Unblocks** — M-043, M-044, M-045, M-046, M-047, M-049, M-050.

**Files**

- `apps/server/prisma/migrations/<ts>_create_search_documents/migration.sql` — the table per `Schema.md` §13.4 **plus** the columns `Search.md` §3.2 filters on and §3.6 renders from: `branch_id` (unique), `gym_id`, `tenant_id`, `name`, `slug`, `city_id`, `city_slug`, `locality_name`, `category_id`, `category_slug`, `location geography(Point,4326)`, `amenity_ids uuid[]`, `top_amenity_ids uuid[]`, `search_tsv tsvector`, `min_price_minor`, `lowest_monthly_equiv_minor`, `currency`, `rating_avg`, `rating_count`, `rating_bayes`, `freshness_score`, `conversion_rate_bps`, `completeness_pct`, `featured_until`, `gender_policy`, `hours_bitmap bit(336)`, `has_24h_access`, `has_parking`, `trial_available`, `plan_duration_units duration_unit_enum[]`, `promo_active`, `cover_renditions jsonb`, `projected_at`. **Tenancy class `GLOBAL`** — see criterion 2 — with grant class **G-REF**: `GRANT SELECT ON search_documents TO app_rw` and `INSERT/UPDATE/DELETE` to the projection role only.
- `apps/server/prisma/migrations/concurrent.sql` (extended) — the six indexes, all `CONCURRENTLY` per `MG4`: `gix_search_documents__location` (GiST), `gin_search_documents__amenity_ids`, `gin_search_documents__search_tsv`, `gin_search_documents__name_trgm` (`gin_trgm_ops`), `gin_search_documents__locality_trgm`, and the scalar composite `idx_search_documents__city_price_rating (city_id, lowest_monthly_equiv_minor, rating_bayes)`.
- `apps/server/src/discovery/{index.ts, discovery.module.ts, permissions.ts, README.md, types/search-document.types.ts}` — the module skeleton at L4; `permissions.ts` is present and **empty by declaration**, with a comment naming `Search.md` §3 as the reason (the only permission-free class in the system).
- `apps/server/src/discovery/domain/public-visibility.predicate.ts` + spec — the five `FR-SRCH-09` conditions as one composable object, extending M-039's plan predicate: gym `APPROVED`, tenant not `SUSPENDED`, ≥ 1 plan `PUBLISHED` + `PUBLIC`, branch `ACTIVE`, `gyms.deleted_at IS NULL`.
- `apps/server/src/discovery/domain/{hours-bitmap.ts, search-document.entity.ts}` + specs — `hours_bitmap` is 336 bits (7 days × 48 half-hours) built from `branch_hours` in `Asia/Kolkata`, so `open_now` and `open_at` are a bit test rather than a join.
- `apps/server/src/discovery/infrastructure/search-document.prisma-repository.ts` + `int-spec.ts` — the **only** `$queryRaw` site in `discovery/`, allow-listed by `dependency-cruiser` per `FolderStructure.md` §7.3 P7, carrying the mandatory comment naming the reason and the visibility rule that replaces RLS here.
- `apps/server/test/isolation/non-tenant-scoped.register.ts` (modified) — `search_documents` and the two `/v1/search/*` routes registered under `TestingStrategy.md` §5.5 with their written justification (`IS4`).
- `apps/server/prisma/seed/search.seed.ts` · `SEED_VERSION → 0.12` — **2,000 gyms across 5 cities**, the corpus `E4.1` is measured on, generated deterministically from the fixed uuid space.

**Acceptance criteria**

1. Every column `Search.md` §3.2 filters on and §3.6 renders is **present on this table**; a query plan for the hot path shows exactly one relation and **no join** (`Search.md` §2.1, §8.2).
2. **The table is `GLOBAL` and carries no RLS policy, and the exemption is argued in the migration header, not assumed**: it contains only `APPROVED`, publicly visible listings, so it holds no tenant-private fact; `tenant_id` is present for invalidation and click-through only and is explicitly **not** an RLS key (`Schema.md` §13.4). The `IS6` `pg_policies` check is given the exemption entry so it fails if the table is ever silently made tenant-scoped or silently left unprotected while holding private data.
3. `PublicVisibilityPredicate` exists **once** and all five conditions are named in it; a grep proves no public read path re-states `status = 'APPROVED'` (`F-06.9`, `BR-GYM-01`, `BR-TEN-05`, `BR-PLN-05`).
4. **The enforcement mode is existence, not filtering**: the search query contains no visibility `WHERE` clause a future refactor could drop, because a non-visible listing has no row (`Search.md` §7).
5. `location` is `geography`, and `EXPLAIN` on the seeded corpus shows `gix_search_documents__location` in use with no sequential scan; the plan is committed as a CI baseline (`E4.2`, `TR-06`).
6. All six indexes are created `CONCURRENTLY`; the trigram index sizes are measured and recorded in `docs/database/indexes-observed.md`, because `IX4` warns a trigram index is frequently larger than the data it indexes.
7. `hours_bitmap` answers `open_now` and `open_at` in `Asia/Kolkata` for all 336 half-hour slots including a midnight-crossing window, with no join to `branch_hours` (`FR-SRCH-03`, `Search.md` §3.2).
8. `rating_bayes` is stored and is **never** returned by any endpoint; only `rating_avg` and `rating_count` are public, and `rating_avg` is `null` below the three-review floor (`FR-REV-08`, `BR-REV-07`).
9. `SEED_VERSION` is `0.12` and the 2,000-gym corpus regenerates byte-identically twice in a row (`TestingStrategy.md` §6.3).
10. No isolation A1–A7 case group applies to this table; the §5.5 register entry, its justification and the **negative** assertion — a suspended tenant's gym returns zero rows from search — are added instead (`IS4`, `Search.md` §7).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `public-visibility.predicate.spec.ts` | Unit | All 32 combinations of the five conditions; only the all-true case is visible |
| `hours-bitmap.spec.ts` | Unit | 336 slots; `05:00–11:00` + `16:00–23:00` split windows; a `22:00–02:00` crossing; a dated `is_closed` exception clears the day |
| `search-document.prisma-repository.int-spec.ts` | Integration | Testcontainers; the hot query touches one relation; `EXPLAIN` matches the committed baseline |
| `search-index-usage.int-spec.ts` | Integration | Each of the six indexes is used by the query shape it exists for; a regression that drops one fails here, not in k6 |
| `search-documents-grants.int-spec.ts` | Integration | `app_rw` can `SELECT` and **cannot** `INSERT`, `UPDATE` or `DELETE` — the projection role is the only writer |
| `suspended-tenant-absent.int-spec.ts` | Integration | The `IS4` negative: a suspended tenant's seeded gym is absent from the projection |

**Rollback plan** — Migration phase: **expand**. One `CREATE TABLE` and six `CONCURRENTLY` indexes;
the contract migration drops the indexes `CONCURRENTLY` and then the table. **The projection holds no
source of truth** — every column is derivable from `gyms`, `branches`, `plans`, `branch_hours` and
`gym_amenities` — so dropping and rebuilding it is a supported operation for the life of the product,
and M-043's backfill is the rebuild path. That property is worth protecting: nothing in this band may
write a fact to `search_documents` that exists nowhere else.

**Notes** — Three traps. First, `RLS ENABLE` on a `GLOBAL` table "for safety": it would make every
unauthenticated search require a tenant context that does not exist, and the fix under time pressure
would be `BYPASSRLS`, which is `P9`'s worst outcome. The correct control is that nothing private is in
the table. Second, `hours_bitmap` as a `jsonb` of windows: it reads well and turns `open_now` into a
per-row function call over 500 candidates. A `bit(336)` is one mask operation. Third, deriving
`lowest_monthly_equiv_minor` here with local arithmetic — it must come from M-039's
`monthlyEquivalent()` through the port, or the marketplace and checkout will disagree about what a
₹18,000 annual plan costs per month.

---

### M-043 — `search.reindex` — the outbox projection and the 60-second budget

| Field | Value |
| :--- | :--- |
| **Sprint** | 3 |
| **Epic** | EP-06 · F-06.9 · T-06.03, T-06.10, T-06.11 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — A gym approval, a plan publication, a price change, a media upload, a branch
deactivation or a tenant suspension changes what the marketplace shows within sixty seconds, driven
by the transactional outbox, with no synchronous work on any authoring request path.

**Depends on** — M-018, M-036, M-039, M-040, M-042.

**Unblocks** — M-044, M-049, M-050.

**Files**

- `apps/server/src/discovery/application/jobs/search-reindex.processor.ts` + spec — the BullMQ processor on the M-018 harness; idempotency key `branch_id`; concurrency bounded; a failed projection retries with the harness's backoff and never blocks the emitting transaction.
- `apps/server/src/discovery/application/projection/{project-branch.use-case.ts, compose-search-document.service.ts, remove-search-document.use-case.ts}` + specs — composition reads `catalog/index.ts` and `plans/index.ts` **read-model ports only**, never their repositories (`FolderStructure.md` §1 invariant 4, `no-cross-module-repository`).
- `apps/server/src/discovery/application/projection/reindex-trigger.registry.ts` + spec — the **enumerated** list of the eleven events that invalidate a document: `GymApproved`, `GymUpdated`, `GymSuspended`, `BranchUpdated`, `BranchDeactivated`, `PlanPublished`, `PlanArchived`, `PlanPriceChanged`, `PromotionChanged`, `MediaRenditionsReady`, `TenantStatusChanged`. A twelfth event that should invalidate and is not in this registry is the defect class this file exists to make findable.
- `apps/server/src/discovery/infrastructure/search-document.writer.ts` — the **only** writer; runs under the projection role, uses `INSERT … ON CONFLICT (branch_id) DO UPDATE`, and deletes the row when the predicate goes false.
- `apps/server/src/discovery/application/jobs/search-backfill.command.ts` + spec — the full rebuild path, chunked by city, resumable, and the documented recovery for M-042's drop-and-rebuild property.
- `apps/server/src/common/queue/queue.registry.ts` (modified) — registers `search.reindex` and `search.backfill` with their concurrency, retry and dead-letter settings (`§C5`).
- `infra/monitoring/alerts/search-projection-lag.yaml` — the `FR-ONB-13` sixty-second alert **in both directions**: a suspended gym still present, and an approved gym still absent (`Search.md` §7).
- `apps/server/test/integration/projection-latency.int-spec.ts` · `apps/server/prisma/seed/search.seed.ts` (modified — the seed now runs through the projection rather than writing documents directly, so seed and production share one code path).

**Acceptance criteria**

1. Every one of the eleven registry events produces a projection within **60 seconds** measured end to end on the seeded corpus; the measurement is an assertion, not a dashboard (`E2.7`, `FR-ONB-13`, `AC-ONB-05.1`).
2. **Nothing in the authoring path waits for the projection.** The approval, publish and price-change transactions commit after an outbox insert and return; a synchronous reindex inside any of them fails a structure test (`ADR-0017`, M-036's Notes).
3. A tenant suspension **removes** its rows rather than marking them hidden, and the removal is asserted through the public endpoint, not the table (`BR-TEN-05`, `Search.md` §7).
4. The processor is idempotent on `branch_id`: replaying the same event ten times yields one row and identical content, including `projected_at` monotonicity (`§C5` idempotency key rule).
5. Out-of-order events do not regress a document: a stale event carrying an older `aggregate_version` is discarded, not applied (**TR-04**-shaped reasoning applied to projections).
6. The backfill rebuilds the entire corpus from source tables, is chunked and resumable, and produces a projection **byte-identical** to the incremental path for the same inputs — the property that makes M-042's rollback plan real.
7. Composition uses only `catalog/index.ts` and `plans/index.ts` read-model ports; `dependency-cruiser` fails on any repository import across the module boundary (`FolderStructure.md` §4 invariant 4).
8. `lowest_monthly_equiv_minor` and `min_price_minor` come from `PLAN_PRICING_PORT`, never from local arithmetic (`BR-PLN-03`, M-039).
9. The lag alert fires in both directions and is wired to the on-call route; a projection stalled for 120 seconds pages (`Monitoring.md`, `Search.md` §7).
10. The seed populates the projection **through the processor**, so a defect in composition breaks the seed and is found at `test:int` rather than in staging (`TestingStrategy.md` §6.3).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `reindex-trigger.registry.spec.ts` | Unit | All eleven event types map to a handler; an unmapped event type throws at registration, not at runtime |
| `compose-search-document.service.spec.ts` | Unit | Composition from port fixtures; `STAFF_ONLY`-only gyms compose to **no document**; price comes from the pricing port |
| `search-reindex.processor.int-spec.ts` | Integration | Ten replays → one row; a stale-version event is discarded; a suspension deletes |
| `projection-latency.int-spec.ts` | Integration | Approve → visible in `< 60 s` wall clock on the seeded corpus; the `E2.7` assertion M-036 deferred to this milestone |
| `search-backfill.int-spec.ts` | Integration | Drop the table, rebuild, and diff against the incremental projection — zero differences |
| `no-sync-reindex.structure-spec.ts` | Unit | No use case outside `discovery/application/projection/` imports the writer |

**Rollback plan** — No migration. Flag `ops.discovery.projection-consumer` (**new**, default *on*):
*off*, the processor stops consuming and outbox rows **accumulate** rather than being dropped, so
turning it back on drains and converges — the outbox is the buffer that makes this safe. The
authoring paths are unaffected because they never waited. `search.backfill` is the recovery for any
divergence introduced while the consumer was off.

**Notes** — The trap is the twelfth event. Every projection eventually acquires a source of truth
someone forgot to invalidate on — here the likely candidate is the M-033 media rendition worker, which
finishes **after** the gym is approved and changes the card's cover image. The registry is an explicit
enumeration so that adding a new mutating use case forces a decision rather than allowing an omission,
and `reindex-trigger.registry.spec.ts` is the test that makes forgetting expensive at review time
instead of cheap until a customer notices a missing photo.

---

### M-044 — `GET /v1/search/gyms` — `ST_DWithin` first, the 500-candidate ceiling, sorts, cache

| Field | Value |
| :--- | :--- |
| **Sprint** | 3 |
| **Epic** | EP-06 · F-06.4, F-06.7 · T-06.04, T-06.15, T-06.19, T-06.23 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — The marketplace search endpoint exists, resolves a location by the four-step precedence,
narrows by radius through the GiST index to at most 500 candidates, sorts by the five-member
allowlist, paginates by opaque cursor, and is cached in Redis and at the CDN.

**Depends on** — M-016, M-042, M-043.

**Unblocks** — M-045, M-046, M-047, M-048, M-049, M-050.

**Files**

- `apps/server/src/discovery/controllers/search.controller.ts` + spec — `GET /v1/search/gyms`, `@Public()` **declared explicitly** so the `FR-RBAC-01` CI check sees a decision, rate-limit class `RL-SEARCH`, `Cache-Control: public, max-age=60, stale-while-revalidate=120`.
- `packages/types/src/schemas/search/search-gyms.query.schema.ts` — the `.strict()` query schema; an unrecognised parameter is `400 VALIDATION_FAILED` **naming it**, because a typo'd `amenties=` that silently returns unfiltered results is worse than an error (`Search.md` §3.2).
- `apps/server/src/discovery/application/search-gyms.use-case.ts` + spec · `commands/search-gyms.command.ts`.
- `apps/server/src/discovery/application/services/location-resolver.service.ts` + spec — the §3.3 precedence: `lat`/`lng` → `pincode` centroid → `city_slug` centroid → `422 LOCATION_REQUIRED` carrying the served-city list. Emits `location_precision` of `EXACT`, `PINCODE` or `CITY`.
- `apps/server/src/discovery/infrastructure/search-query.builder.ts` + `int-spec.ts` — the parameterised `$queryRaw`: `ST_DWithin(location, $1::geography, $2)` for the predicate and the **`<->` KNN operator** for distance ordering; `ST_Distance` appears only in the projection list, never in `ORDER BY` (`Search.md` §8.2).
- `apps/server/src/discovery/domain/{candidate-ceiling.ts, sort-allowlist.ts, distance.vo.ts}` + specs — the 500-row ceiling with `ranking_truncated`, and the closed allowlist `relevance | distance | price_asc | rating | newest`.
- `apps/server/src/discovery/dto/{search-gyms.request.dto.ts, gym-result-card.response.dto.ts, search-gyms.response.dto.ts}` · `search.openapi.ts` — `GymResultCard` exactly as `Search.md` §3.6, including `is_favourited: null` and `rating.displayable`.
- `apps/server/src/discovery/infrastructure/search-cache.adapter.ts` + spec — Redis result cache keyed on the normalised query **with location rounded to ~100 m before it becomes a key**, 60 s TTL, jittered.
- `apps/server/src/common/pagination/` (reused) — the opaque cursor codec; the cursor encodes the ranking score and the tie-break id (`§C3.1`, ADR-0023).
- `apps/server/test/load/search.k6.ts` — the profile authored here, **run as a gate in M-049**.

**Acceptance criteria**

1. Location resolution follows the four-step precedence exactly, and *"none of the above"* is `422 LOCATION_REQUIRED` **carrying the served-city list** — never an empty result set (`Search.md` §3.3, §9.1).
2. `radius_m` defaults to 5,000 and is bounded 500…50,000; outside that is `400 RADIUS_OUT_OF_BOUNDS`. Coordinates beyond **6 decimal places** are `400 COORDINATE_PRECISION_EXCEEDED`, which is a privacy control, not a validation nicety (`Search.md` §3.2, §11.4).
3. **The index narrows and the expression orders**: stage 1 is `ST_DWithin` on the GiST index, stage 2 is the scalar and GIN predicates, stage 3 is the **500-candidate ceiling**, and beyond it the set is truncated by raw distance with `ranking_truncated: true` in the response (`Search.md` §4.3, `Scalability.md` §5).
4. `ORDER BY` never contains `ST_Distance(...)`; the KNN `<->` form is used, and a review-visible comment says why (`Search.md` §8.2, `Indexes.md` §5.2).
5. The five sorts are a **closed allowlist**; anything else is `400 INVALID_SORT_FIELD`. `price_asc` sorts on `lowest_monthly_equiv_minor`; `rating` sorts on `rating_bayes` and excludes gyms below the three-review floor rather than sorting them as zero (`Search.md` §4.7, `FR-SRCH-04`).
6. `total_estimated` is estimated and **named so**; there is no exact-count query on the hot path (`Search.md` §3.4, `README.md` §7).
7. `distance_m` is absent when `location_precision` is `CITY`, because a distance from a city centroid is noise presented as precision (`Search.md` §3.6).
8. `is_favourited` is `null` server-side for every caller, authenticated or not, so one cached response serves every user; the client hydrates from `GET /me/favourites` (`Search.md` §3.6, §8.2).
9. **Location is rounded into the cache key before use**, serving `NFR-PRV-07` and the hit rate simultaneously; the raw coordinate never appears in a Redis key or a log line (`Search.md` §8.3, §11.4).
10. The route is registered in the `TestingStrategy.md` §5.5 non-tenant-scoped register with its justification and its **negative** isolation case: a suspended tenant's gym returns zero rows (`IS4`, `R-5`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `location-resolver.service.spec.ts` | Unit | All four precedence steps; `CITY_NOT_SERVED` carries the nearest served city; `PINCODE_UNRESOLVABLE` on a well-formed unknown PIN |
| `candidate-ceiling.spec.ts` | Unit | 501 candidates truncate by distance and set `ranking_truncated`; 500 exactly does not |
| `sort-allowlist.spec.ts` | Unit | Five members; `NEGATIVE:` — `created_at`, `price_minor` and a SQL fragment are all `400` (`BAC-06`) |
| `search-query.builder.int-spec.ts` | Integration | `EXPLAIN` shows the GiST scan; no `ST_Distance` in `ORDER BY`; the plan matches the M-042 baseline |
| `search-cache.adapter.spec.ts` | Unit | Two coordinates 50 m apart produce **one** cache key; the key contains no un-rounded coordinate |
| `search-gyms.contract-spec.ts` | Contract | Response matches the generated OpenAPI; `is_favourited` is `null`; `rating.average` is `null` at `count < 3` |
| `search-visibility.isolation-spec.ts` | Isolation (§5.5) | The negative control: suspended tenant → zero rows; unapproved gym → zero rows |

**Rollback plan** — No migration. Flag `rel.discovery.search` (**new**, default *on*): *off*, the
endpoint returns `503` with a problem-details body and `customer-web` renders the city-selector
landing rather than a broken results page. Flag `ops.discovery.result-cache` (**new**, default *on*):
*off*, every request goes to Postgres — a deliberate escape hatch for the case where a projection bug
is being masked by a 60-second cache, and the p95 consequence is understood and accepted while it is
off.

**Notes** — Two traps, both of which look like optimisations. First, `ORDER BY ST_Distance(location,
$1)`: it is the obvious way to write "nearest first", it is not indexable, and on 2,000 rows it will
look fine in development and fall over in the k6 gate. Second, caching before rounding: rounding the
coordinate *after* building the key gives a 100% miss rate and puts a user's exact position into Redis
— the performance defect and the privacy defect are the same line of code, which is why `Search.md`
§8.3 states the ordering explicitly.

---

### M-045 — Free text — `tsvector`, `pg_trgm`, amenity synonyms and `/v1/search/suggest`

| Field | Value |
| :--- | :--- |
| **Sprint** | 3 |
| **Epic** | EP-06 · F-06.2 · T-06.05, T-06.06, T-06.16 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A query typed as `"crossfitt"` returns the CrossFit gyms, a query for `"AC"` returns gyms
whose amenity is *air conditioned*, and an autocomplete fires on every keystroke inside a p95 of
150 ms.

**Depends on** — M-042, M-043, M-044.

**Unblocks** — M-046, M-047, M-048, M-049.

**Files**

- `apps/server/prisma/migrations/<ts>_add_search_tsv_generated/migration.sql` — `search_tsv` as a **generated** column over `name`, `locality_name`, `city_name` and the expanded amenity synonym text, with weights `A`, `B`, `C`, `D`; the synonym text is materialised into a `synonym_text` column by the projection so the generated expression stays immutable (`Schema.md` §13.4, `MG7`).
- `apps/server/src/discovery/domain/text/{synonym-expansion.ts, query-normaliser.ts, trigram-threshold.ts}` + specs — the amenity synonym table (`AC` → *air conditioned*, `cardio` → *treadmill, cross trainer*, `PT` → *personal training*, `crossfit` → *functional training*), trimming, control-character stripping and the 64-character cap.
- `apps/server/src/discovery/infrastructure/text-search.builder.ts` + `int-spec.ts` — `websearch_to_tsquery` **parameterised, never concatenated**, with a trigram fallback when the `tsquery` matches nothing.
- `apps/server/src/discovery/controllers/suggest.controller.ts` + spec · `dto/suggest.{request,response}.dto.ts` — `GET /v1/search/suggest`, `@Public()`, `q` required 2…64, `types` of `LOCALITY | CITY | GYM`, `limit` 1…15, `Cache-Control: public, max-age=300`.
- `apps/server/src/discovery/application/suggest.use-case.ts` + spec — locality above city above gym at equal similarity, because a locality narrows a search and a gym name ends it.
- `apps/server/src/discovery/infrastructure/suggest-cache.adapter.ts` + spec — Redis on the **normalised prefix**, 300 s TTL; the trigram query is the cache miss.
- `apps/server/prisma/migrations/concurrent.sql` (extended) — `gin_localities__name_trgm`.

**Acceptance criteria**

1. `"Andehri"` returns the same results as `"Andheri"`: trigram tolerance is proven on a misspelling that `tsvector` alone returns **zero** rows for (`FR-SRCH-02`, `Search.md` §6.1, demo step 4).
2. `q` is **parameterised into both the FTS and the trigram path**; a `'; DROP` payload is data, and a SAST rule plus a test assert no string concatenation reaches SQL (`NFR-SEC-05`).
3. Amenity synonyms expand at **projection** time into `synonym_text`, not at query time — a per-query expansion would put a lookup inside the hot path (`Search.md` §8.2).
4. Ranking weights `A`…`D` place a name match above a locality match above a city match above a synonym match, asserted on fixtures rather than eyeballed.
5. `q` shorter than 2 characters on `/suggest` returns an **empty array**, never the whole taxonomy; longer than 64 is `400 VALIDATION_FAILED` (`Search.md` §6).
6. A `LOCALITY` or `CITY` suggestion carries coordinates so selection needs no second round trip; a `GYM` suggestion carries its slug so selection navigates straight to detail (`Search.md` §6).
7. `/suggest` p95 ≤ **150 ms** measured under the k6 profile — tighter than `NFR-PERF-01` because it fires per keystroke past a 150 ms client debounce (`Search.md` §6.2).
8. Both routes are `@Public()` by declaration and registered in the §5.5 non-tenant-scoped register; the suspended-tenant negative applies to `/suggest` as well as `/gyms` (`IS4`, `R-5`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `synonym-expansion.spec.ts` | Unit | Twelve synonym pairs; an unmapped term expands to itself; expansion is idempotent |
| `query-normaliser.spec.ts` | Unit | Control characters stripped; 65 characters rejected; a Devanagari query survives normalisation |
| `text-search.builder.int-spec.ts` | Integration | `"crossfitt"` → zero under `tsquery`, correct under trigram fallback; `EXPLAIN` shows both GIN indexes |
| `suggest.use-case.spec.ts` | Unit | Type ordering at equal similarity; `limit` honoured; empty array below 2 characters |
| `suggest-latency.k6.ts` | Performance | p95 ≤ 150 ms on the 2,000-gym corpus with the Redis prefix cache warm |

**Rollback plan** — Migration phase: **expand** — a generated column plus one `CONCURRENTLY` index;
the contract migration drops both. Flag `rel.discovery.suggest` (**new**, default *on*): *off*, the
route returns `503` and the search bar degrades to plain submit-on-enter, which still works.
Flag `rel.discovery.trigram-fallback` (**new**, default *on*): *off*, only exact FTS is used — a
narrower but correct result set, which is the right degradation if trigram cost becomes the p95
problem.

**Notes** — The trap is expanding synonyms at query time because it is easier to change. It puts a
dictionary lookup and a query rewrite inside a path budgeted at 90 ms for the whole PostGIS stage, and
the "easier to change" benefit is illusory because changing a synonym requires a reprojection either
way. Expand at projection time and make the synonym table a reindex trigger.

---

### M-046 — The ten `FR-SRCH-03` filters and facet counts in the same request

| Field | Value |
| :--- | :--- |
| **Sprint** | 3 |
| **Epic** | EP-06 · F-06.3 · T-06.07, T-06.08, T-06.17 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Every filter of `FR-SRCH-03` works with the correct `AND`/`OR` semantics, and each
unapplied filter shows the count it would produce, computed with its own dimension removed.

**Depends on** — M-042, M-044, M-045.

**Unblocks** — M-047, M-048, M-049.

**Files**

- `apps/server/src/discovery/domain/filters/{filter-set.vo.ts, amenity-filter.ts, price-filter.ts, hours-filter.ts, rating-filter.ts, gender-filter.ts, duration-filter.ts, boolean-filters.ts}` + specs — one file per semantic class, each declaring its own combinator so `AND` versus `OR` is a property of the filter, not of the query builder.
- `apps/server/src/discovery/infrastructure/filter-predicate.builder.ts` + `int-spec.ts` — amenities via `amenity_ids @> $1` on the GIN index (**`AND` semantics**); `gender_policy` and `plan_duration` via `= ANY($1)` (**`OR` semantics**); hours via a `hours_bitmap` mask test.
- `apps/server/src/discovery/application/services/facet-counter.service.ts` + spec — ten faceted dimensions, each counted **with its own filter removed and all others intact**.
- `apps/server/src/discovery/infrastructure/facet-cache.adapter.ts` + spec — the coarse key: location rounded to ~1 km, filters **excluding** the faceted dimension, 300 s TTL, separate from the result cache (`Search.md` §3.7, `Scalability.md` §6.4).
- `apps/server/src/discovery/dto/{search-facets.response.dto.ts, applied-filters.response.dto.ts}` — `applied_filters` echoes every parameter **as the server resolved it**.
- `packages/types/src/schemas/search/search-gyms.query.schema.ts` (modified) — the full parameter set with its bounds: `amenity_id` ≤ 12, `rating_min` 1.0…5.0 one decimal place, `open_at` `HH:MM`, `open_on` `MON`…`SUN`.
- `apps/server/test/integration/filter-matrix.int-spec.ts` — the ten-filter combinatorial suite.

**Acceptance criteria**

1. All ten filters function: distance, price, amenities, rating, open-now/open-at, 24-hour, gender, plan durations, trial and parking (`E3.6`, `FR-SRCH-03`).
2. **Amenities are `AND`** — all selected must be present — and **gender policy and plan duration are `OR`**, because Priya wants women-only *or* scheduled, not both simultaneously (`Search.md` §3.2, `B2.2`).
3. More than 12 amenity values is `400 TOO_MANY_AMENITY_FILTERS`; an amenity id outside the platform taxonomy is `400`, not a silent no-match.
4. `rating_min` **excludes gyms below the `BR-REV-07` three-review floor**: a gym with no displayable rating cannot satisfy a rating filter, rather than being treated as zero (`Search.md` §3.2).
5. `open_now` and `open_at` are evaluated in **`Asia/Kolkata`** against `hours_bitmap`, and a dated `branch_hour_exceptions` closure removes the gym for that day (`FR-SRCH-03`, `AC-SRCH-01.1`, M-034).
6. Price filters compare against `lowest_monthly_equiv_minor`, **not** raw plan price, so a yearly plan is not excluded by a monthly budget (`Search.md` §3.2).
7. **Facets are computed with the faceted dimension's own filter removed**; computing them with all filters applied would show zero beside every unselected option, which is true and useless (`Search.md` §3.7, `SCR-WEB-002` §7.4).
8. Facet counts are consistent with the result set for the applied dimensions, cached separately on the coarse key, and the response carries both blocks in **one** request — the client never issues a second call for counts (`E3.6`).
9. `applied_filters` echoes each parameter as resolved — a `pincode` echoes with derived coordinates, an omitted `radius_m` echoes as `5000` — so the client rebuilds its URL from the echo (`Search.md` §3.5, `AC-SRCH-01.3`).
10. Isolation: the §5.5 register entry is extended with the filter routes' negative control; no new tenant-scoped route is added (`IS4`, `R-5`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `filter-set.vo.spec.ts` | Unit | Each filter's combinator; a filter cannot be constructed with the wrong one |
| `hours-filter.spec.ts` | Unit | `open_at 06:00` on a split-window gym; a midnight-crossing window; a `15 August` closure exception |
| `facet-counter.service.spec.ts` | Unit | Self-exclusion per dimension; a dimension with all options at zero is still returned with zeroes, not omitted |
| `filter-matrix.int-spec.ts` | Integration | Ten filters × five sorts on the seeded corpus; every combination returns a result set consistent with its facets |
| `facet-cache.adapter.spec.ts` | Unit | The coarse key excludes the faceted dimension; two searches differing only in that dimension share the entry |

**Rollback plan** — No migration. Flag `rel.discovery.facets` (**new**, default *on*): *off*, the
`facets` block is omitted from the response and `SCR-WEB-002` renders filter chips without counts —
a visible reduction, not a wrong number. The filters themselves are not flagged: a search that
silently ignores a filter is the failure mode `.strict()` validation exists to prevent.

**Notes** — Facets are the most expensive block in the endpoint at a p95 of 110 ms of the 270 ms
budget. The trap is computing them with the same filter set as the results, which is one fewer query
shape and produces a UI where every unselected option reads zero. The second trap is caching facets
on the same key as results: they tolerate 300 seconds of staleness and results tolerate 60, and
merging the keys costs a five-fold increase in facet computation for no correctness gain.

---

### M-047 — Zero-result guidance naming the most restrictive filter, and the `§C6` events

| Field | Value |
| :--- | :--- |
| **Sprint** | 3 |
| **Epic** | EP-06 · F-06.12, F-06.15 · T-06.12, T-06.13, T-06.20 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — A search that matches nothing returns a `200` carrying a repair kit that names the single
most restrictive filter with a previewed recovery count, and every `§C6` Discovery event is emitted
server-side without personal data or precise location.

**Depends on** — M-044, M-045, M-046.

**Unblocks** — M-048, M-049.

**Files**

- `apps/server/src/discovery/application/services/zero-result-guidance.service.ts` + spec — for each applied filter, the counterfactual count with **that one** filter removed; the filter whose removal recovers the most results is the most restrictive.
- `apps/server/src/discovery/domain/relaxation.vo.ts` + spec — the three actions `REMOVE_FILTER`, `EXPAND_RADIUS`, `RELAX_PRICE`, ordered by recovered results descending, capped at three, and a relaxation recovering **zero is omitted**.
- `apps/server/src/discovery/application/services/nearby-cities.service.ts` + spec — served, `C9.4`-gated cities within a configurable distance that have results.
- `apps/server/src/discovery/dto/zero-result-guidance.response.dto.ts` — the payload shape of `Search.md` §5.
- `apps/server/src/discovery/application/events/discovery-analytics.emitter.ts` + spec — the eleven `§C6` Discovery events emitted **through the outbox**, never blocking the response.
- `apps/server/src/discovery/domain/location-precision.policy.ts` + spec — analytics carry location at **city or ~1 km** granularity only; the raw coordinate never reaches an event (`Search.md` §11.4, `BR-DAT-06`).
- `infra/monitoring/alerts/zero-result-rate.yaml` — the threshold above which the counterfactual computation stops being cheap, which is itself the signal that discovery is failing.

**Acceptance criteria**

1. Zero matches is a **`200` with guidance**, never a `404` and never a bare empty array (`Search.md` §3.8, `FR-SRCH-12`).
2. `most_restrictive_filter` is determined by **counterfactual counting**, one query per applied filter, and the response carries `results_if_removed` (`E3.7`, `AC-SRCH-01.2`, `Search.md` §5.1).
3. **Radius expansion is offered, never applied**: the response suggests 5 km and returns the 3 km result set, because a user who set 3 km meant 3 km (`Search.md` §5.2).
4. Relaxations are ordered by recovered results descending, capped at three, and one that recovers nothing is **omitted** rather than shown (`Search.md` §5).
5. The counterfactual work runs **only on the zero-result path**; a test asserts the extra queries are absent when results exist (`Search.md` §5.1).
6. `nearby_cities` excludes cities that are not served or not `C9.4`-gated open, even when they have gyms — a consumer must never be sent to a city that has not opened.
7. All eleven `§C6` Discovery events are emitted **server-side**, contain no personal data, and carry location no finer than ~1 km (`FR-SRCH-15`, `BR-DAT-06`, `NFR-PRV-07`).
8. Analytics emission **never blocks**: it is an outbox insert inside the existing transaction, budgeted at 2 ms p95, and a failing analytics consumer cannot fail a search (`Search.md` §8.1, §11.3).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `zero-result-guidance.service.spec.ts` | Unit | Six applied filters → six counterfactuals; the maximum-recovery filter is named; ties break deterministically |
| `relaxation.vo.spec.ts` | Unit | Ordering, the cap at three, omission of zero-recovery relaxations |
| `location-precision.policy.spec.ts` | Unit | `NEGATIVE:` — a six-decimal coordinate cannot be placed on an event; the policy rounds or refuses (`BAC-06`) |
| `zero-result.int-spec.ts` | Integration | A deliberately over-filtered search on the corpus produces the full payload; a matching search issues **no** counterfactual queries |
| `discovery-events.contract-spec.ts` | Contract | All eleven `§C6` names emitted with their documented payload shape; no field matches the PII deny-list |

**Rollback plan** — No migration. Flag `rel.discovery.zero-result-guidance` (**new**, default *on*):
*off*, the response carries `results: []` with the served-city list only, and the UI falls back to
its generic empty state — worse guidance, never a wrong count. Flag
`ops.discovery.analytics-emission` (**new**, default *on*) drops event emission without touching the
response, which is the correct lever if the analytics consumer becomes the bottleneck.

**Notes** — The trap is computing the guidance on **every** search "so the code path is always
warmed". `n` counting queries per search at 33 searches per second is a self-inflicted load problem,
and the whole affordability argument in `Search.md` §5.1 rests on this being the zero-result path
only. The second trap is precise location in analytics: the events are the `KPI-09` instrument and it
is tempting to keep full precision "for better analysis". `Search.md` §11.4 makes rounding a contract,
and a location-precision defect in an analytics store is not retractable.

---

### M-048 — `SCR-WEB-002` — list ↔ map synchronisation, URL state, the `customer-web` shell

| Field | Value |
| :--- | :--- |
| **Sprint** | 3 |
| **Epic** | EP-06 · F-06.1, F-06.5, F-06.7, F-06.8 · T-06.25, T-06.27, T-06.29, T-06.31 |
| **Size** | 6h |
| **Role** | FE-web |

**Goal** — A visitor can search, filter, scroll and pan on one screen whose entire state is in the
URL, with the list and the map synchronised in both directions, and the results never change under
them because the map moved. The `customer-web` shell ships with it (**R-M4**).

**Depends on** — M-044, M-045, M-046, M-047.

**Unblocks** — M-049, M-050.

**Files**

- `apps/customer-web/app/{layout.tsx, page.tsx, error.tsx, not-found.tsx, loading.tsx, robots.ts, sitemap.ts, manifest.webmanifest}` and `app/search/page.tsx` — **the shell (R-M4)**: Next.js 14 App Router, `<html lang>`, the `NFR-USE-02` skip link, the TanStack Query provider with the ADR-0021 defaults, and `size-limit.json` wired as a **blocking** gate (job 19 becomes enforcing here).
- `apps/customer-web/src/features/discovery/components/{search-results-list.tsx, results-map.tsx, filter-bar.tsx, filter-sheet.tsx, gym-result-card.tsx, zero-result-panel.tsx, search-this-area-button.tsx, load-more.tsx}` + specs.
- `apps/customer-web/src/features/discovery/hooks/{use-search-params-state.ts, use-search-results.ts, use-map-sync.ts, use-location.ts}` — `use-search-params-state` is the **single** owner of URL ↔ state; no component writes `history` directly.
- `apps/customer-web/src/features/discovery/location/{geolocation-consent.tsx, city-selector.tsx, pincode-field.tsx}` — contextual consent, never a prompt on load (`FR-SRCH-01`, `CustomerApp.md` §6.4).
- `apps/customer-web/src/shared/{api/client.ts, query/query-client.ts, analytics/, i18n/, money/format-inr.ts}` — the shell's seams; `format-inr` re-exports the single `packages/utils` formatter, it does not reimplement it.
- `apps/customer-web/e2e/{search-map-sync.e2e-spec.ts, search-url-state.e2e-spec.ts}` · `src/features/discovery/discovery.a11y-spec.ts`.

**Acceptance criteria**

1. **The URL is the state**: every filter, the sort, the location and the cursor are in the query string, and a pasted URL restores the exact result set (`AC-SRCH-01.3`, `NX7`, `CustomerApp.md` §7.3). The client rebuilds the URL from `applied_filters`, not from what it thinks it sent.
2. Hovering a card highlights its pin and hovering a pin highlights its card, in both directions, with `collapse_by_gym=false` on the map request so no matching branch is a missing pin (`FR-SRCH-05`, `AC-SRCH-02.1`, `Search.md` §4.6).
3. **Panning the map never auto-updates results**; a "Search this area" control appears and the user decides (`FR-SRCH-08`, `E3.6` demo step 6). Map bounds are sent only when the `search_map_bounds` flag is on.
4. Infinite scroll has a "load more" fallback that works with the keyboard and with JavaScript-degraded assistive navigation (`FR-SRCH-07`).
5. Each filter chip shows its **server-supplied** facet count; the client computes no counts of its own (`SCR-WEB-002` §7.4).
6. Geolocation is requested **contextually with an explanation**, never on load; denial falls back to the city selector and never to an empty state (`FR-SRCH-01`, `Search.md` §9.1, `CustomerApp.md` §6.4).
7. With the maps provider disabled by flag, the list renders fully and search still works (`E4.8`, `NFR-AVL-03`).
8. All four mandatory states exist; axe-core is clean at AA; the list ↔ map relationship is exposed to assistive technology as text, not as hover-only behaviour; `size-limit` proves initial JS ≤ **200 KB gzipped** (`NFR-USE-01`, `NFR-PERF-10`, `E4.10`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `use-search-params-state.spec.ts` | Unit | Round-trip of all ten filters through the URL; an unknown parameter is dropped, not forwarded |
| `results-map.spec.ts` | Unit | Pan produces no fetch; "Search this area" produces exactly one |
| `zero-result-panel.spec.ts` | Unit | Renders the server's named filter and counts verbatim; no client-authored suggestion |
| `search-map-sync.e2e-spec.ts` | E2E (Playwright) | Bidirectional hover; paste-URL restoration; maps-disabled fallback |
| `discovery.a11y-spec.ts` | Accessibility | axe-core clean; keyboard traversal of list, filters and the map's list-equivalent |

**Rollback plan** — No migration. Flag `rel.discovery.map` (**new**, default *on*): *off*, the map
region is not rendered and the list occupies the full width — the `NFR-AVL-03` degradation, exercised
deliberately rather than discovered. Flag `search_map_bounds` (**existing**, default *off*) already
gates bounds-based querying. The shell reverts by `git revert`; nothing outside `customer-web`
consumes it yet.

**Notes** — The trap is auto-searching on pan. It feels responsive, it is what a map wants to do, and
it produces a result list that changes while the user is reading it — the *"why am I seeing gyms in
Whitefield"* reaction that `Search.md` §5.2 describes for radius and that applies identically here.
`FR-SRCH-08` requires the explicit control, and `SprintPlanning.md` names this the largest single
frontend item in the plan for a reason.

---

# PART D — SPRINT 4 · RANKING, DETAIL AND THE PERFORMANCE GATE (M-049 … M-050)

> Sprint 4 is the **Diwali sprint** at −10% capacity and it owns the `C9.1` exit condition *"search
> meets `NFR-PERF-01` on seeded data"*. Two milestones, both of which can fail the gate.

### M-049 — The configurable `FR-SRCH-10` ranking and the `NFR-PERF-01` k6 gate

| Field | Value |
| :--- | :--- |
| **Sprint** | 4 |
| **Epic** | EP-06 · F-06.10, F-06.11 · T-06.33, T-06.34, T-06.36 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Result order is produced by six named, bounded factors whose weights change through
audited configuration **without a deployment**, applied in memory to at most 500 candidates, and the
endpoint sustains 2,000 searches per minute inside `NFR-PERF-01`.

**Depends on** — M-042, M-044, M-046, M-047.

**Unblocks** — M-050, M-051.

**Files**

- `apps/server/src/discovery/domain/ranking/{ranking-formula.ts, ranking-weights.schema.ts, bayesian-rating.ts, featured-boost.ts}` + specs — the six factors of `Search.md` §4.1 (distance, `rating_bayes`, freshness, conversion, featured, completeness), each normalised to `[0,1]` before weighting so a weight change cannot be swamped by an unbounded input.
- `apps/server/src/discovery/application/services/ranking-config.service.ts` + spec — reads the versioned weight document from `feature_flags`-adjacent runtime configuration, caches it with a bounded TTL, and stamps `ranking_version` on every response.
- `apps/server/src/discovery/controllers/admin-ranking.controller.ts` + spec · `dto/ranking-weights.{request,response}.dto.ts` — `PUT /v1/admin/config/ranking`, permission `admin.config.ranking.update`, **reason required**, audited, with one-click revert to the previous version.
- `apps/server/src/discovery/application/services/golden-set.evaluator.ts` + spec — the `TR-22` gate: a fixed query set with expected orderings that a weight change is scored against before it is accepted.
- `apps/server/test/load/search.k6.ts` (modified) — the **gate**: 2,000 req/min for 10 minutes against the 2,000-gym, 5-city seed, asserting p95 ≤ 500 ms, p99 ≤ 1,000 ms and cache hit ratio ≥ 60%.
- `.github/workflows/perf.yml` — job 25 `search-perf`, blocking on `main` and on any PR touching `discovery/`.

**Acceptance criteria**

1. Weights change through configuration and take effect **without a deployment**, proven by changing one weight and re-running the same query in the same process (`E4.5`, `FR-SRCH-10`).
2. **The formula is never an index.** The index narrows to ≤ 500 candidates and the expression orders them in memory; an expression index would silently stop being used when the configuration changed (`Search.md` §4.3, `Indexes.md` §11.4).
3. `rating_bayes = (C × m + Σ ratings) / (C + n)` ranks; **the plain mean displays**, and `rating_bayes` appears in **no** response body (`FR-REV-08`, `Search.md` §4.2).
4. The featured boost is **additive and capped**: it cannot move a 12 km gym above a 900 m one, at most **two** featured results appear per page of twenty, and `is_featured` is on the card so the client labels it — an unlabelled featured result is a compliance defect (`FR-SRCH-11`, `Search.md` §4.4, `E4.6`).
5. Every response carries `ranking_version`, so a support complaint about ordering is reproducible (`Search.md` §3.4).
6. A weight change is refused unless it passes the golden-set evaluator, and every accepted change writes an `audit_log` row with actor, reason, previous and next document (**TR-22**, `BR-DAT-01`).
7. **`E4.1`**: k6 at 2,000 searches/minute sustained yields p95 ≤ 500 ms and p99 ≤ 1,000 ms server-side on the 2,000-gym seed, with `EXPLAIN` showing GiST index usage and no sequential scan on the hot path (`NFR-PERF-01`, `NFR-PERF-09`, `E4.2`).
8. **`E4.4`**: no search cluster has been introduced — `package.json` and Terraform contain no OpenSearch, asserted by a CI absence check (ADR-0007, `STACK_ADDITIONS.md` Part 3).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `ranking-formula.spec.ts` | Unit | Each factor normalised to `[0,1]`; a zero weight removes a factor entirely; the sum is order-stable under ties |
| `bayesian-rating.spec.ts` | Unit | A 5.0 from three reviews does not outrank a 4.6 from two hundred; `C` and `m` are configuration, not constants |
| `featured-boost.spec.ts` | Unit | The displacement cap; at most two per page; the boost cannot invert a large distance gap |
| `search.k6.ts` | Performance | The `E4.1` gate, with p95/p99 and cache-hit evidence captured as CI artefacts |
| `no-search-cluster.contract-spec.ts` | Contract | A CI **absence** assertion over `package.json`, lockfile and Terraform |

**Rollback plan** — No migration. Flag `rel.discovery.configurable-ranking` (**new**, default *on*):
*off*, ranking falls back to the compiled default weight document and `PUT /admin/config/ranking`
returns `503`; ordering stays correct and stops being tunable. `featured_boost` has its own flag
`rel.discovery.featured-slots` (**new**, default *off* until commercial sign-off) — with it off the
weight is zero and no result is labelled promoted, which is the safe commercial default.

**Notes** — The trap under gate pressure is reaching for OpenSearch. `SprintPlanning.md` names the
sanctioned responses in order: materialised projection columns, composite index tuning per `§C2.4`,
cache TTL extension, replica routing, ranking simplification. A cluster is a **rejected substitution**
and requires `§C10` escalation. The second trap is exposing `rating_bayes` in the card "for
transparency": a reviewer who later finds the discrepancy between the ranked and displayed figure and
"fixes" it changes ranking for every gym on the platform.

---

### M-050 — Detail composition, comparison, favourites and `SCR-WEB-003` server-rendered

| Field | Value |
| :--- | :--- |
| **Sprint** | 4 |
| **Epic** | EP-06 · F-06.16, F-06.17, F-06.18, F-06.22, F-06.23, F-06.24, F-06.26, F-06.27, F-06.28 · T-06.38 … T-06.46 |
| **Size** | 6h |
| **Role** | Full-stack |

**Goal** — A gym has a public, server-rendered detail page with structured data and an LCP under
2.5 s on 4G, up to four gyms can be compared with an honest presence matrix, and a favourite survives
the login gate without losing the visitor's place.

**Depends on** — M-033, M-039, M-042, M-044, M-048, M-049.

**Unblocks** — M-051 (checkout is entered from this page), and the Sprint-10 review regions.

**Files**

- `apps/server/src/discovery/controllers/gym-detail.controller.ts` + spec · `dto/gym-detail.response.dto.ts` — `GET /v1/gyms/:slug` per `Marketplace.md` §5, the **twelve regions of `B6` from a single query plan**, `@Public()`, with `listing_state` for the `FR-DETL-11` previously-live case.
- `apps/server/src/discovery/controllers/compare.controller.ts` + spec — `POST /v1/compare`, up to four gyms, presence matrix with **explicit absence** rather than blank cells (`Marketplace.md` §9).
- `apps/server/src/discovery/controllers/favourites.controller.ts` + spec — `GET/POST/DELETE /v1/me/favourites/:gymId`, authenticated, **`POST` with no request body** (`Marketplace.md` §11.2).
- `apps/server/prisma/migrations/<ts>_create_favourites/migration.sql` — `favourites` per `Schema.md` §4.12 with `uq_favourites__user_gym`, **RLS P-STD keyed on the owning user's tenant-free scope per §4.12, and its grants, in this file** (R-6); grant class G-CRUD-D.
- `apps/customer-web/app/gyms/[citySlug]/[gymSlug]/page.tsx`, `.../plans/page.tsx`, `.../opengraph-image.tsx`, `app/compare/page.tsx`, `app/account/favourites/page.tsx` — `SCR-WEB-003`, `SCR-WEB-004`, `SCR-WEB-012`, server-rendered with ISR and JSON-LD `LocalBusiness` + `AggregateRating` + `Offer`.
- `apps/customer-web/src/features/discovery/components/{detail-regions/*.tsx, comparison-matrix.tsx, favourite-button.tsx}` + specs · `e2e/{detail.e2e-spec.ts, compare-persistence.e2e-spec.ts, deferred-favourite.e2e-spec.ts}`.
- `apps/server/prisma/seed/favourites.seed.ts` · `SEED_VERSION → 0.13`.

**Acceptance criteria**

1. All twelve `B6` regions render from **one** query plan; a per-region fan-out is a review rejection (`FR-DETL-01`, `SCR-WEB-003` §8.1).
2. Plan cards show **monthly-equivalent** pricing from M-039's `monthlyEquivalent()`, the joining fee and the access-window note; the figure is identical to the search card's (`FR-DETL-02`, `FR-DETL-03`).
3. **A rating with fewer than three reviews displays no numeric figure** — `displayable: false` and an explanation, never a zero (`E4.9`, `BR-REV-07`, `OQ-10`, `SCR-WEB-003` §8.2).
4. A previously-live, now-unavailable gym returns a `200` with `listing_state` and an informational page, not a `404` — the SEO and the trust consequences of a hard 404 on an indexed URL are both worse (`FR-DETL-11`, `SCR-WEB-003` §8.3).
5. Comparison accepts up to four gyms, marks a missing attribute as **explicitly absent**, emphasises differences, and prompts on a fifth; it persists across reload **and** across login (`FR-DETL-08`, `FR-DETL-09`, `E4` demo step 5).
6. A favourite tapped while logged out is **completed after login**, returning the visitor to the same gym and the same scroll position (`FR-FAV-03`, `FR-NAV-02`, `NX6`).
7. `POST /v1/me/favourites/:gymId` takes **no body**; the favourites list shows the current price and the change since favouriting, and an unavailable gym is shown as unavailable rather than removed (`FR-FAV-02`, `SCR-WEB-012`).
8. **`E4.7`**: detail LCP ≤ 2.5 s on a throttled 4G profile with job 24 `lighthouse-lcp` enforcing; structured data validates; `size-limit` and axe-core are green on `SCR-WEB-003`, `SCR-WEB-004` and `SCR-WEB-012` (`NFR-PERF-02`, `E4.11`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `gym-detail.use-case.spec.ts` | Unit | Twelve regions composed; `STAFF_ONLY` plans absent; rating suppressed below three reviews |
| `single-query-plan.int-spec.ts` | Integration | The detail request issues one query for the composition; a regression that fans out fails here |
| `favourites.isolation-spec.ts` (generated) | Isolation | A1–A7 on the three favourite routes; one user cannot read another's favourites |
| `deferred-favourite.e2e-spec.ts` | E2E (Playwright) | Favourite while logged out → login → favourite applied, same gym, same scroll offset |
| `detail-lcp.lighthouse-spec.ts` | Performance | LCP ≤ 2.5 s on the 4G profile; `LocalBusiness` and `AggregateRating` present in the served HTML |

**Rollback plan** — Migration phase: **expand** (`favourites` only). Flag `rel.discovery.comparison`
(**new**, default *on*) and `rel.discovery.favourites` (**new**, default *on*): *off*, the affordances
are not rendered and the endpoints return `404`, leaving detail and search fully functional. Detail
itself is not flagged — it is the checkout entry point and `E2E-02` depends on it.

**Notes** — The trap is the fan-out. Twelve regions invite twelve queries, each individually fast, and
the page then costs twelve round trips under a 2.5 s LCP budget on 4G. `FR-DETL-01` says *one query
plan* for that reason. The second trap is the deferred favourite: implementing it as "redirect to
login, then home" is a one-line shortcut that discards the visitor's context, and `NX6` treats losing
context at the auth gate as a defect, not a UX preference.

---

# PART E — SPRINT 5 · ORDERS, PRICING AND THE PAYMENT PORT (M-051 … M-057)

> **Money enters the system here.** Pair programming on every milestone in this part is mandatory
> (`RSK-14`), `CODEOWNERS` requires two approvals on `ordering/` and `payments/`, and the coverage
> floor for these paths is **95%** (`NFR-MNT-01`, `FolderStructure.md` §1617). `SprintPlanning.md`
> records Sprint 5 as the worst-committed sprint in the plan; per **R-M7** this file schedules only
> the scope that survives its mitigations.

### M-051 — `orders` and `order_items` — the nine `A6.3` figures and the `C4.2` machine

| Field | Value |
| :--- | :--- |
| **Sprint** | 5 |
| **Epic** | EP-07 · F-07.1, F-07.5, F-07.6 · T-07.01, T-07.03, T-07.05, T-07.11 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — An order exists as an immutable-after-payment commercial record carrying every `A6.3`
figure as a persisted column, moves through the `§C4.2` machine, expires after thirty minutes, and
cannot be created twice by one idempotency key.

**Depends on** — M-013, M-016, M-017, M-018, M-031, M-037, M-038.

**Unblocks** — M-052, M-053, M-054, M-057, M-059, M-060.

**Files**

- `apps/server/prisma/migrations/<ts>_create_orders/migration.sql` — `orders` per `Schema.md` §7.1 with all nine money columns (`gross_minor`, `discount_minor`, `net_minor`, `tax_minor`, `commission_base_minor`, `commission_minor`, **`commission_tax_minor` nullable pending O-1**, `gateway_fee_minor`, `payable_to_gym_minor`), `currency` adjacent, `origin sale_origin_enum`, `channel sale_channel_enum`, `order_ref` unique, `idempotency_key` **globally unique**, `refund_policy_snapshot`, `tax_snapshot`, `start_date`, `expires_at`; checks `ck_orders__net_equals_gross_minus_discount`, `ck_orders__discount_not_exceeding_gross`, `ck_orders__commission_zero_when_direct`, `ck_orders__payable_identity`; index `idx_orders__tenant_status_created_at`. **RLS P-STD + G-CRUD + the §2.8.1 immutability trigger in this file** (R-6); retention **R-FIN**, **no soft delete**.
- `.../<ts>_create_order_items/migration.sql` — `order_items` per §7.2, grant class **G-APPEND** with `DELETE` deliberately absent even while `PENDING`: a removed line is a **new order**, because the idempotency key is on the order.
- `apps/server/src/ordering/{index.ts, ordering.module.ts, permissions.ts, README.md, types/}` · `ports/order-snapshot.port.ts` (declared here, consumed by `memberships/` in Sprint 7).
- `apps/server/src/ordering/domain/{order.aggregate.ts, order-status.machine.ts, order-ref.vo.ts, ordering.errors.ts}` + specs — the `§C4.2` states `PENDING`, `AWAITING_PAYMENT`, `PAID`, `FAILED`, `EXPIRED`, `CANCELLED`, `PARTIALLY_PAID`, `REFUNDED`; `order_ref` is `ORD-YYYY-` plus six Crockford characters with no `I`, `L`, `O`, `0` or `1`.
- `apps/server/src/ordering/application/{create-order,get-order,cancel-order}.use-case.ts` + specs · `jobs/order-expire.processor.ts` + spec — every 5 minutes, expiring `PENDING` orders past `expires_at` and releasing coupon holds.
- `apps/server/src/ordering/controllers/order.controller.ts` + spec · `dto/` · `infrastructure/{order.prisma-repository.ts, order.mapper.ts}` + int-specs · `prisma/seed/orders.seed.ts` · `SEED_VERSION → 0.14`.

**Acceptance criteria**

1. All nine `A6.3` figures are **columns**, `bigint` minor units with `currency` adjacent; nothing on any surface recomputes a figure at display time (`A6.3`, `BR-FIN-02`, `NFR-DQ-02`).
2. `commission_tax_minor` exists, is **nullable and `NULL` on every row** pending O-1, and `ck_orders__payable_identity` already carries the term through `COALESCE` — so adopting O-1 changes **no DDL** (`Schema.md` §7.1, §14.3, `BLK-03` conflict 2).
3. `trg_orders__freeze_money_after_paid` freezes the money columns at `PAID`, with the **single** permitted exception that `gateway_fee_minor` and `payable_to_gym_minor` may transition once from `NULL` to a value (`Schema.md` §2.8.1, `INV-FIN-3`).
4. `ck_orders__commission_zero_when_direct` makes a commissioned `DIRECT` sale impossible at the database level (`A6.3`).
5. The `§C4.2` machine rejects every illegal transition rather than forcing it, and `EXPIRED`, `CANCELLED` and `REFUNDED` are terminal (`§C4.2`, **TR-04** reasoning applied to orders).
6. `SUM(order_items.line_total_minor)` equals `orders.gross_minor`, asserted at creation and by the reconciliation job — **not** by a constraint, because a cross-row sum is not expressible in a `CHECK` (`Schema.md` §7.2).
7. `idempotency_key` is **globally unique, not tenant-prefixed**, because the interceptor sits before tenant resolution on the public checkout path; a duplicate key with an identical fingerprint returns the stored response and a different fingerprint returns **409** (`E5.4`, `BR-PAY-03`, `Schema.md` §5.4 exception).
8. A `PENDING` order expires at **30 minutes** and the expiry job releases its coupon hold; 50 concurrent checkouts for one tenant produce 50 distinct orders (`E5.6`, `E5.11`, `FR-CART-05`).
9. `channel = 'DASHBOARD'` and status `PARTIALLY_PAID` exist as schema and constraint per **R-M7**; the desk flow and `SCR-DASH-012` are Sprint 9 and no route for them is added here (`F-07.9`).
10. Isolation coverage for all order routes is generated in this PR, and every order mutation writes an `audit_log` row (`R-5`, `BR-DAT-01`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `order-status.machine.spec.ts` | Unit | All 64 state × transition pairs; illegal transitions are refused, never coerced |
| `order-ref.vo.spec.ts` | Unit | The Crockford alphabet excludes `I`, `L`, `O`, `0`, `1`; 100,000 generated refs collide zero times |
| `money-freeze-trigger.int-spec.ts` | Integration | An `UPDATE` of `commission_minor` after `PAID` is refused; `gateway_fee_minor` `NULL → value` is permitted **once** |
| `order-idempotency.int-spec.ts` | Integration | Same key + same fingerprint → stored response; same key + different fingerprint → `409`; 50 concurrent → 50 orders |
| `order-expire.processor.int-spec.ts` | Integration | Expiry at 30 minutes; the coupon hold is released; an already-`PAID` order is untouched |
| `orders.isolation-spec.ts` (generated) | Isolation | A1–A7 on every order route, by id and by list |

**Rollback plan** — Migration phase: **expand** (two tables plus one trigger). The contract migration
drops the trigger first, then `order_items`, then `orders`. **This is the last milestone in which
those drops are genuinely reversible** — once M-057 records a payment against an order, R-FIN binds
and the tables are permanent. No feature flag on the tables; `rel.ordering.checkout` (**new**, default
*off* until M-053 merges) gates the creation endpoint so no order can be created before price
re-validation exists.

**Notes** — The trap is treating `commission_tax_minor` as something to add later. `SprintPlanning.md`
is explicit: decide in Sprint 5, implement in Sprint 11, **and the order-time snapshot written here
must already carry the field** — otherwise Sprint 11 backfills historical orders, which is expensive
and changes a settlement statement Finance has already seen. The column costs nothing now and the
`COALESCE` in the identity check means adopting it later is a data change, not a migration.

---

### M-052 — Server-side amount computation — `OrderPricingService` and the snapshot set

| Field | Value |
| :--- | :--- |
| **Sprint** | 5 |
| **Epic** | EP-07 · F-07.2, F-07.3, F-07.4, F-07.7, F-07.21, F-07.22 · T-07.04, T-07.06, T-07.09, T-07.41 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Every figure on an order is computed by the server from server-held plan, add-on, tax and
commission data, the client submits no amount at all, and the five order-time snapshots are resolved
and frozen at the moment of sale.

**Depends on** — M-016, M-039, M-040, M-051.

**Unblocks** — M-053, M-054, M-057, M-060.

**Files**

- `apps/server/src/ordering/domain/pricing/{order-pricing.service.ts, tax-computation.ts, commission-computation.ts, rounding.ts}` + specs — `G → D → N → T → B → C → F → P` in that order, `round_half_even` throughout, all arithmetic through `Money` (`§C1.5`, `BR-PAY-01`); the plan price arrives from `PLAN_PRICING_PORT` and is never recomputed here.
- `apps/server/src/ordering/domain/snapshots/{refund-policy-snapshot.ts, tax-snapshot.ts, purchased-terms.ts}` + specs — the `S1`–`S7` snapshot rules: `schema_version` first key, Zod shapes in `packages/types`, money as JSON **strings**, every value a literal so nothing must be resolved to be understood.
- `apps/server/src/ordering/domain/eligibility/{age.rule.ts, gender.rule.ts, concurrency.rule.ts, plan-availability.rule.ts}` + specs — `min_age`, `gender_eligibility`, same-gym concurrency unless `stackable`, plan `PUBLISHED` + `PUBLIC` (`FR-CART-07`, `BR-MEM-04`, `BR-PLN-05`).
- `apps/server/src/ordering/application/services/attribution.service.ts` + spec — `origin` and `attributed_at` written **server-side** at first authenticated view from a discovery surface, immutable, 30-day window (`F-07.21`, `RSK-07`, `A6.3`).
- `packages/types/src/schemas/ordering/create-order.schema.ts` — the `.strict()` request schema: `plan_id`, `start_date`, optional `add_on_ids`, optional `coupon_code`, refund-policy acceptance. **No amount field of any kind exists.**

**Acceptance criteria**

1. **An order cannot be created with a client-supplied amount: the field does not exist in the request schema**, and `amount_minor`, `total_minor`, `net_minor`, `tax_minor`, `discount_minor`, `commission_minor`, `commission_rate_bps` and `currency` each produce `400 VALIDATION_FAILED` with `rule: "unknown_field"` (`E5.1`, `BR-PAY-04`, `F-07.4`).
2. The eight computed figures follow `A6.3` exactly, in order, with `round_half_even`; `B` is `N` excluding tax, post-discount when the coupon is gym-funded and pre-discount when platform-funded (`BR-CPN-05`, `BR-FIN-04`).
3. `C` is zero whenever `origin = 'DIRECT'`, and `commission_rate_bps`, `commission_rule_id` and `commission_rate_source` are persisted so the figure is **explicable**, not merely correct (`A6.3`, `BR-FIN-05`, `R4`, `R5`).
4. `tax_snapshot` carries components, rates, inclusivity, rounding mode, place-of-supply rule, SAC code and profile version; `refund_policy_snapshot` carries the tenant's policy as it stood at order creation and is binding thereafter (`BR-PAY-11`, `BR-REF-01`, `BR-REF-02`).
5. Snapshots obey `S1`–`S7`: `schema_version` first, Zod-validated on write and on read, money as strings, no unresolvable reference, and **never updated** — enforced by the §2.8.1 trigger (`Schema.md` §2.13).
6. The itemised summary renders plan price, joining fee, add-ons, discount, **CGST 9%**, **SGST 9%** and total payable as distinct lines derived from `order_items` and `tax_snapshot` (`F-07.3`, `SCR-WEB-005`).
7. Eligibility refusals are specific: `422 AGE_BELOW_MINIMUM`, `422 GENDER_NOT_ELIGIBLE`, `422 CONCURRENT_MEMBERSHIP_NOT_STACKABLE`, `422 PLAN_NOT_AVAILABLE` — never one generic message (`FR-CART-07`, `NFR-USE-06`).
8. **`attributed_at` cannot be set, altered or cleared by any client-supplied value**, proven by a negative test over every entry path (`E5.10`, `RSK-07`).
9. Isolation coverage for the order-creation and quote routes is generated in this PR (`R-5`).
10. Coverage on `ordering/domain/pricing/**` is ≥ **95%**, the money-path floor (`NFR-MNT-01`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `order-pricing.service.spec.ts` | Unit | The `A6.3` worked example to the paisa; gym-funded versus platform-funded commission bases; `DIRECT` yields `C = 0` |
| `rounding.spec.ts` | Property | `round_half_even` over 10,000 generated amounts; per-component tax rounding then summing never differs from the persisted `T` |
| `create-order.schema.spec.ts` | Unit | `NEGATIVE:` — each of the twenty forbidden fields is `400` with `rule: "unknown_field"` (`BAC-06`) |
| `snapshots.spec.ts` | Unit | `S1`–`S7` on all three snapshots; a `V2` document is refused by a `V1` reader **loudly** |
| `attribution.service.int-spec.ts` | Integration | Server-written `attributed_at`; the 30-day window; every client attempt to influence it fails |
| `ordering.isolation-spec.ts` (generated) | Isolation | A1–A7 on the creation and quote routes |

**Rollback plan** — No migration. No feature flag on the computation: a flag would create a second
pricing path, which is the defect class this milestone exists to eliminate. Reverting is `git revert`
behind `rel.ordering.checkout`, which is still *off* until M-053.

**Notes** — The trap is accepting an amount "for validation, to check the client and server agree".
That field then exists, and the first defect that makes the server trust it is a free-membership bug.
`BR-PAY-04`'s enforcement is the **absence** of the field, which is why criterion 1 is a schema
assertion rather than a comparison.

---

### M-053 — `BR-PLN-03` re-validation as a state-machine guard → `422 PLAN_PRICE_CHANGED`

| Field | Value |
| :--- | :--- |
| **Sprint** | 5 |
| **Epic** | EP-07 · F-07.23 · T-07.07, T-07.08, T-07.43 |
| **Size** | 4h |
| **Role** | BE |

**Goal** — Price displayed equals price charged, because the `PENDING → AWAITING_PAYMENT` transition
cannot occur without re-validating the order's price fingerprint against live plan data, and a
mismatch aborts the checkout at **both** prices.

**Depends on** — M-039, M-051, M-052.

**Unblocks** — M-054, M-057.

**Files**

- `apps/server/src/ordering/domain/guards/price-revalidation.guard.ts` + spec — **a guard on the transition, not a callable step**: the `§C4.2` machine will not move an order to `AWAITING_PAYMENT` unless the guard has run and passed in the same transaction.
- `apps/server/src/ordering/domain/order-status.machine.ts` (modified) — the transition declares its guard; a transition registered without one fails at module construction, not at runtime.
- `apps/server/src/ordering/application/revalidate-order-price.use-case.ts` + spec — re-resolves through `PLAN_PRICING_PORT`, compares the M-039 fingerprint, and on mismatch returns `422 PLAN_PRICE_CHANGED` carrying **both** figures and the plan name.
- `apps/server/src/common/errors/error-code.registry.ts` (modified) — `PLAN_PRICE_CHANGED`, owning module `ordering`, HTTP `422`, requirement `BR-PLN-03` / `AC-PLAN-02.2`.
- `apps/customer-web/src/features/checkout/components/price-change-modal.tsx` + spec — the blocking re-confirmation showing previous and current, charging neither silently (`F-07.23`, `SCR-WEB-005` States row).

**Acceptance criteria**

1. Changing a plan price between page load and submit produces `422 PLAN_PRICE_CHANGED` with **both** figures, and **no charge occurs at either price** (`E5.2`, invariant 3, `AC-PLAN-02.2`).
2. **The re-validation is a state-machine guard, not a callable step** — proven by a test that attempts `PENDING → AWAITING_PAYMENT` without it and is refused by the machine (`E5.3`).
3. The comparison is on the **fingerprint**, not on a single price field, so a change to the joining fee, the promotion or the currency also aborts (`BR-PLN-03`, M-039 criterion 3).
4. Re-validation and the transition happen in **one** transaction; a price changed between the check and the write cannot slip through (`§11.4.2 P4`, one interactive transaction per use case).
5. The `422` body names the plan and both amounts in the caller's locale, formatted by the single `packages/utils` INR formatter (`F-07.24`, `LAUNCH_MARKET_INDIA.md` §2).
6. A price change that makes the order **cheaper** also aborts — silently charging less is still charging a price the customer did not agree to, and it corrupts the commission base.
7. The modal is blocking, offers *"Use the new price"* and *"Cancel"*, and neither path re-uses the stale quote; accepting creates a **new** quote through M-052 (`SCR-WEB-005`).
8. Isolation coverage for the transition endpoint is generated in this PR; coverage on `ordering/domain/guards/**` is ≥ 95% (`R-5`, `NFR-MNT-01`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `price-revalidation.guard.spec.ts` | Unit | Match passes; any fingerprint field change fails; a cheaper price also fails |
| `machine-guard-required.spec.ts` | Unit | Registering `PENDING → AWAITING_PAYMENT` without the guard throws at construction |
| `revalidate-order-price.int-spec.ts` | Integration | Concurrent price change during the transaction → abort, no payment row, order still `PENDING` |
| `price-changed.contract-spec.ts` | Contract | The `422` body carries both figures and the plan name; the schema is in the OpenAPI document |
| `price-change-modal.spec.ts` | Unit | Blocking; accepting requests a fresh quote; cancelling charges nothing |

**Rollback plan** — No migration. **No feature flag.** A flag that disables price re-validation
disables invariant 3 and `P10` forbids a flag that turns off a protection; the only rollback is
`git revert` of the branch, which also reverts `rel.ordering.checkout` to *off*.

**Notes** — The trap is exposing re-validation as `POST /orders/:ref/revalidate` so the client can
"check first". A callable step can be skipped, and it will be skipped by the retry path that someone
writes in Sprint 12. Making it a guard means the only way to reach `AWAITING_PAYMENT` is through it.

---

### M-054 — `coupons`, `coupon_redemptions`, `Coupon.evaluate()` and the `BR-CPN-04` cap

| Field | Value |
| :--- | :--- |
| **Sprint** | 5 |
| **Epic** | EP-07 · F-07.12, F-07.14, F-07.20 · T-07.19, T-07.21, T-07.24, T-07.28 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A discount instrument exists with scope, limits, applicability and an immutable funding
source; it is validated through **one** evaluation path at both apply time and payment initiation;
it cannot stack, cannot be over-redeemed and cannot drive the payable below zero.

**Depends on** — M-013, M-016, M-051, M-052, M-053.

**Unblocks** — M-057, M-060.

**Files**

- `apps/server/prisma/migrations/<ts>_create_coupons/migration.sql` — `coupons` per `Schema.md` §7.3 as **HYBRID · P-HYBRID**: the discriminated policy whose `USING` admits `scope = 'PLATFORM'` and whose `WITH CHECK` admits only `scope = 'TENANT' AND tenant_id = current_setting(...)`, so a tenant session **reads** platform coupons and can **never write one**. Two partial unique indexes on `code`. `coupon_redemptions` RLS P-STD, **G-APPEND**, `uq_coupon_redemptions__coupon_user_order`. Both policies and grants in this file (R-6).
- `apps/server/src/ordering/domain/coupon/{coupon.entity.ts, coupon-evaluation.ts, discount-cap.ts, funding-source.vo.ts}` + specs — **`Coupon.evaluate(order, user, at)` is the single evaluation path**; `discount-cap` applies `max_discount_minor` and then `Money.subtractFloorZero()` with the discarded excess **reported, not credited**.
- `apps/server/src/ordering/application/{apply-coupon,remove-coupon}.use-case.ts` + specs — apply counts under the unique constraint rather than reading then writing; removal is legal only while `PENDING`.
- `apps/server/src/ordering/infrastructure/coupon.prisma-repository.ts` + `int-spec.ts` — redemption insert and `redemption_count` increment in **one** transaction; a `23505` maps to `422 COUPON_LIMIT_REACHED`.
- `apps/server/prisma/seed/coupons.seed.ts` · `SEED_VERSION → 0.15` — one platform-funded and one gym-funded coupon, one first-purchase-only, one exhausted, one paused, one expired.

**Acceptance criteria**

1. **Coupons do not stack**, and the enforcement is the *absence* of a join table: `orders.coupon_id` is a single nullable column (`E5.5`, `BR-CPN-02`, `Schema.md` §7.3).
2. **A coupon can never drive the payable below zero**: the excess is discarded, reported in the response as `discarded_excess_minor`, and never credited (`BR-CPN-04`, `F-07.20`).
3. A percentage discount is in **basis points** and a fixed discount is in **minor units**; `max_discount_minor` caps the percentage case (`BR-CPN-01`, `R3`).
4. Validation runs through `Coupon.evaluate()` at **both** apply time and payment initiation; a second validation implementation anywhere fails a structure test (`F-07.14`, `FR-CPN-03`, `BR-CPN-03`).
5. Over-redemption is prevented by **counting under `uq_coupon_redemptions__coupon_user_order`**, not by a read-then-write; 20 concurrent redemptions of a coupon with `total_limit = 5` yield exactly 5 (`Schema.md` §7.3, `E5.11`).
6. `funding_source` decides the commission base per `A6.3` and is **immutable once `redemption_count > 0`**, enforced by a use-case guard reading the count — not a trigger, because the rule is *"after first use"* (`BR-CPN-05`, `Schema.md` §7.3).
7. The RLS asymmetry holds: a tenant session reads platform coupons and every write attempt against a `PLATFORM` row fails at the database, asserted directly in SQL (`ERD.md` §7.7, `TestingStrategy.md` §5.8).
8. Tenant-first resolution when a tenant code collides with a platform code (`FR-CPN-03`); a paused coupon refuses with a **distinct** reason from an expired one (`FR-CPN-07`).
9. Order expiry releases the coupon hold, and a released hold is re-redeemable by the same user (`E5.6`, M-051).
10. Isolation coverage for all coupon routes is generated in this PR, including the platform-scope case group for the admin write path (`R-5`, `IS5`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `coupon-evaluation.spec.ts` | Unit | The full `SprintPlanning.md` 5.24 matrix: platform-funded × gym-funded × first-purchase × per-user cap × expiry × pause |
| `discount-cap.spec.ts` | Property | Over 10,000 generated orders the payable is never negative and the discarded excess is exactly the clipped amount |
| `coupon-concurrency.int-spec.ts` | Integration | 20 concurrent redemptions against `total_limit = 5` → 5 successes, 15 `422 COUPON_LIMIT_REACHED` |
| `coupon-rls.sql-spec.ts` | Integration (SQL) | `§5.8` direct policy test: tenant session reads platform rows, cannot write them |
| `funding-source-immutability.int-spec.ts` | Integration | Mutable at `redemption_count = 0`; `422` at 1 |
| `coupons.isolation-spec.ts` (generated) | Isolation | A1–A7 on the tenant routes; platform-scope group on the admin route |

**Rollback plan** — Migration phase: **expand** (two tables). Flag `rel.ordering.coupons` (**new**,
default *on*): *off*, the coupon field is absent from checkout and `POST /orders/:ref/coupon` returns
`404`; existing orders keep their applied discount because it is already persisted on the order. The
`BR-CPN-04` floor is **not** flagged.

**Notes** — The trap is enforcing limits with `SELECT count(*)` followed by an `INSERT`. Under the
50-concurrent-checkout test this over-redeems, and the resulting free memberships are indistinguishable
from fraud in the ledger. The unique index is trust layer 3 for exactly this reason.

---

### M-055 — The `PaymentProvider` port, the Stripe reference adapter, the contract suite

| Field | Value |
| :--- | :--- |
| **Sprint** | 5 |
| **Epic** | EP-08 · F-08.1, F-08.15, F-08.18 · T-08.01, T-08.02, T-08.40, T-08.44 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — One port describes every payment capability the platform needs, a second implementation
proves the port is a real abstraction rather than a Razorpay-shaped hole, and no domain code anywhere
names a provider.

**Depends on** — M-016, M-051.

**Unblocks** — M-056, M-057, M-058, M-059.

**Files**

- `apps/server/src/payments/ports/payment-provider.port.ts` — the seven capabilities of `FR-PAY-01`: `createIntent`, `capture`, `refund`, `getStatus`, `verifyWebhook`, `createConnectedAccount`, `payout`. Provider-neutral request and result types; **no field named after a provider**.
- `apps/server/src/payments/{index.ts, payments.module.ts, permissions.ts, README.md}` · `domain/{payment-intent.vo.ts, provider-error.taxonomy.ts, money-guard.ts}` + specs — the error taxonomy maps every provider failure onto a platform code so `ordering/` never sees a provider string.
- `apps/server/src/payments/infrastructure/adapters/stripe-connect.payment-provider.adapter.ts` + spec — the **reference implementation**, never production traffic in India, existing so the port has two implementers (`F-08.15`, ADR-0018, `C1.1`).
- `apps/server/src/payments/infrastructure/acl/{provider-identifier.ts, payload-redaction.ts}` + specs — provider-namespaced identifiers and the redaction applied **before** anything is persisted or logged (`F-08.18`, `BR-PAY-08`).
- `apps/server/test/contract/payment-provider.contract-suite.ts` — the shared suite every adapter must pass, parameterised over adapters and run twice in CI.
- `packages/config/src/dependency-cruiser/rules/no-provider-name-outside-payments-infra.cjs` — the rule enforcing `E5.8`.

**Acceptance criteria**

1. The port declares all seven capabilities with provider-neutral types; adding an eighth is a port change reviewed as such (`FR-PAY-01`, `§C1.1`).
2. **No domain code outside `payments/infrastructure/` names a provider**, enforced by `dependency-cruiser` — the string `razorpay`, `stripe`, `rzp_` or `pi_` outside that directory fails the build (`E5.8`, `F-08.18`).
3. The contract suite passes identically against the reference adapter and, from M-056, against Razorpay Route; a capability implemented by only one adapter is a suite failure, not a documented difference (`E5.7`, `F-08.15`).
4. Every provider error maps to a platform code through the taxonomy; an unmapped provider code raises `PAYMENT_PROVIDER_UNMAPPED` and is alerted, rather than being passed through to a customer.
5. `payments.provider` is `text`, not an enum, so a second adapter is data rather than a migration (`Schema.md` §14.1).
6. **No instrument data crosses the port**: the request and result types contain no card number, CVV, VPA or UPI id, asserted by a schema-shape test (`BR-PAY-08`, `NFR-SEC-03`, `E6.11`).
7. Redaction happens **before** persistence and before logging, and the redaction test runs against recorded provider fixtures in `test/fixtures/{razorpay,stripe}/` (`FolderStructure.md` §7, `BR-PAY-08`).
8. Amount and currency crossing the port are `Money`, never numbers; a float in an adapter fails `no-float-money` (`BR-PAY-01`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `payment-provider.contract-suite.ts` | Contract | All seven capabilities against the reference adapter; success, decline, timeout and duplicate for each |
| `provider-error.taxonomy.spec.ts` | Unit | Every fixture error code maps; an unknown code raises the alerting error rather than leaking |
| `payload-redaction.spec.ts` | Unit | Recorded fixtures redact PAN, CVV, VPA and bank references; the redacted payload still identifies the event |
| `no-provider-name.structure-spec.ts` | Unit | `dependency-cruiser` in-process: zero occurrences of a provider name outside `payments/infrastructure/` |
| `port-shape.tsd-spec.ts` | Unit (type) | No instrument-shaped field can be added to a port type without failing the test |

**Rollback plan** — No migration. No flag: the port has no runtime behaviour to disable and the
reference adapter is never configured in production India. Reverting is `git revert`; nothing outside
`payments/` imports it yet.

**Notes** — `SprintPlanning.md` moved the reference adapter out of Sprint 5 under capacity pressure
and this file keeps it here deliberately: **a port with one implementation is a guess.** The trap is
letting a Razorpay concept — a linked account id, a transfer object, an `order_id` distinct from the
platform's — reach the port's vocabulary. The moment it does, the second adapter needs a translation
layer inside the domain and `E5.8` becomes unenforceable.

---

### M-056 — The Razorpay Route adapter and the deterministic sandbox

| Field | Value |
| :--- | :--- |
| **Sprint** | 5 |
| **Epic** | EP-08 · F-08.2, F-08.3, F-08.13 · T-08.03, T-08.05, T-08.07, T-08.31 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — The India payment rail works behind the port: orders created, UPI/card/netbanking/wallet
instruments offered by the **provider**, linked accounts and transfers for split settlement, and a
sandbox that produces success, failure, timeout and duplicate deterministically.

**Depends on** — M-055.

**Unblocks** — M-057, M-058, M-059.

**Files**

- `apps/server/src/payments/infrastructure/adapters/razorpay-route.payment-provider.adapter.ts` + spec — the Phase-1 adapter: order create, capture, refund, status, webhook verification, **linked account** creation and **transfer** with on-hold support (`LAUNCH_MARKET_INDIA.md` §7, `FR-PAY-10`).
- `apps/server/src/payments/infrastructure/adapters/razorpay/{client.ts, mapper.ts, error-map.ts, instrument-catalogue.ts}` + specs — the ACL: Razorpay vocabulary in, port vocabulary out; `instrument-catalogue` reads what the **provider** offers and orders **UPI first for India**, hardcoding no list (`F-08.3`, `FR-PAY-02`).
- `apps/server/src/payments/infrastructure/sandbox/{sandbox.provider.adapter.ts, outcome-selector.ts}` + specs — deterministic outcomes keyed by a seeded amount suffix: success, failure, timeout, duplicate (`F-08.13`, `FR-PAY-12`, `§C7`).
- `apps/server/test/fixtures/razorpay/{order-created,payment-captured,payment-failed,refund-processed,transfer-created,duplicate-capture}.json` — recorded payloads, redacted, used by the contract suite and by M-058's chaos suite.
- `apps/server/src/common/config/app-config.schema.ts` (modified) — `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_ACCOUNT_ID` declared here and **nowhere else**, validated at boot (`FolderStructure.md` §7.2).

**Acceptance criteria**

1. The M-055 contract suite passes **identically** against this adapter and the reference adapter; the run is two CI invocations of one suite (`E5.7`, demo step 6).
2. Instruments are rendered from the **provider's** response; the platform hardcodes no instrument list and validates nothing against one, with UPI ordered first for India (`FR-PAY-02`, `F-08.3`).
3. Linked accounts and transfers are exercised against the sandbox, including an **on-hold** transfer, because split settlement is what Route exists for (`FR-PAY-10`, `LAUNCH_MARKET_INDIA.md` §7).
4. **A gateway amount differing from the order amount creates no membership and raises an alert** — the mismatch is detected in the adapter's result mapping, before any domain effect (`E5.9`, `B5.10`, `BR-PAY-02-N2`).
5. The sandbox produces the four outcomes deterministically from the same input every run, so `E2E-02` and the chaos suite are reproducible (`FR-PAY-12`).
6. Secrets exist only in `app-config.schema.ts` and the environment; no key, id or secret appears in code, fixtures or logs, asserted by the `pii-redaction` and secret-scan CI jobs.
7. All Razorpay vocabulary stays inside `payments/infrastructure/adapters/razorpay/`; `no-provider-name-outside-payments-infra` is green (`E5.8`, `F-08.18`).
8. Adapter failures map onto the M-055 taxonomy, including the three that matter operationally: `GATEWAY_TIMEOUT`, `INSUFFICIENT_FUNDS` and `MANDATE_NOT_SUPPORTED`.

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `razorpay-route.adapter.spec.ts` | Unit | Every mapper direction against the recorded fixtures; no un-mapped field reaches the port |
| `payment-provider.contract-suite.ts` (second run) | Contract | The same suite, this adapter, identical results |
| `instrument-catalogue.spec.ts` | Unit | Order derived from the provider response with UPI first; an unknown instrument passes through, unrendered rather than dropped |
| `amount-mismatch.int-spec.ts` | Integration | A sandbox mismatch produces no domain effect and one alert |
| `sandbox-determinism.spec.ts` | Unit | The four outcomes are stable across 100 runs with a fixed seed |

**Rollback plan** — No migration. Flag `ops.payments.provider` (**new**, value `razorpay`): set to
`sandbox` to route all traffic to the deterministic adapter, which is the staging default and the
production break-glass. Reverting the adapter itself is `git revert`; the port and the reference
adapter survive independently, which is the property M-055 bought.

**Notes** — `BLK-03` conflict 1 must be resolved before Sprint 5 starts and this milestone is the
resolution. The trap is Razorpay's own `order_id`: it is not the platform's `order_ref` and treating
the two as interchangeable produces a correlation bug that only appears when a customer retries. The
adapter namespaces provider identifiers for exactly this reason (`F-08.18`).

---

### M-057 — `payments`, `payment_events` and `POST /v1/orders/:ref/payment-intent`

| Field | Value |
| :--- | :--- |
| **Sprint** | 5 |
| **Epic** | EP-08 · F-08.14 · T-08.09, T-08.11, T-08.13, T-08.26 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A customer can obtain a provider handoff for an order: the server re-prices, creates
exactly one `payments` row, gets an intent, and returns the material the hosted element needs — while
taking no money and activating nothing.

**Depends on** — M-017, M-051, M-052, M-053, M-054, M-055, M-056.

**Unblocks** — M-058, M-059, M-060.

**Files**

- `apps/server/prisma/migrations/<ts>_create_payments/migration.sql` — `payments` and `payment_events` per `Schema.md` §7.4: `uq_payments__provider_intent`, `idx_payments__order_status`, `payment_events.provider_event_id` **globally unique**, `ck_payment_events__verified_only`. `payments` G-CRUD, `payment_events` **G-APPEND** plus `GRANT UPDATE (processed_at)` (G-COMPLETE). **RLS P-STD and grants on both, in this file** (R-6); retention **R-FIN**.
- `apps/server/src/payments/domain/{payment.aggregate.ts, payment-status.machine.ts, payments.errors.ts}` + specs — the `§C4.3` machine `CREATED → PENDING → AUTHORISED → CAPTURED → [REFUNDED | PARTIALLY_REFUNDED]` with `FAILED` and `CANCELLED` branches; illegal transitions are **rejected, never forced** (**TR-04**).
- `apps/server/src/payments/application/create-payment-intent.use-case.ts` + spec — re-validates through M-053's guard, creates one payment row, calls the port, persists `provider_intent_id`.
- `apps/server/src/payments/controllers/payment.controller.ts` + spec · `dto/create-payment-intent.{request,response}.dto.ts` — the `.strict()` body of `Payments.md` §4.2 in which **every** amount, identifier and callback field is absent; `Idempotency-Key` **required**; rate-limit class `RL-PAY`; `Cache-Control: private, no-store`.
- `apps/server/src/payments/infrastructure/{payment.prisma-repository.ts, payment-event.prisma-repository.ts}` + int-specs · `prisma/seed/payments.seed.ts` · `SEED_VERSION → 0.16`.

**Acceptance criteria**

1. The request body is **entirely optional** and `.strict()`: `{}` is a complete valid request, and each of the twenty forbidden fields — `amount_minor`, `plan_id`, `coupon_code`, `callback_url`, `vpa`, `card_number` among them — is `400 VALIDATION_FAILED` with `rule: "unknown_field"` (`Payments.md` §4.2, `BR-PAY-04`).
2. `return_surface` is a **key into a server-held allowlist**, never a URL; there is no endpoint that accepts a callback target (`API_Catalog.md` §1.13 C4).
3. The order's tenant is reached through the ownership join `orders.user_id = sub`, never from anything the client sends (`Payments.md` §4.1, `BR-TEN-01`).
4. `Idempotency-Key` is required — the **same** UUID as `POST /orders` — and is honoured through payment initiation; a repeat returns the stored response and a changed fingerprint returns `409` (`E5.4`, `FR-CART-06`, `BR-PAY-03`).
5. Exactly **one** `payments` row is created per intent; `uq_payments__provider_intent` makes a second impossible, and a retry against an unexpired order issues a **fresh intent on the same order** (`FR-PAY-06`).
6. **The endpoint takes no money and activates nothing**: a contract test asserts no membership-creating or ledger-writing call is reachable from this handler (`BR-PAY-02`, invariant 5).
7. `payment_events` rows are written **only** when `signature_verified = true`; the check constraint makes an unverified event unstorable (`Schema.md` §7.4, `BR-PAY-05`).
8. `raw_payload` is redacted before insert; no PAN, card number or bank credential can enter the column, asserted against the M-056 fixtures (`BR-PAY-08`, `NFR-SEC-03`, `E6.11`).
9. Intent creation p95 ≤ **1.5 s** under the k6 payment profile (`NFR-PERF-05`, `E6.10`).
10. Isolation coverage for the intent and payment-read routes is generated in this PR; coverage on `payments/**` is ≥ 95% (`R-5`, `NFR-MNT-01`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `payment-status.machine.spec.ts` | Unit | The `§C4.3` graph; every illegal transition rejected with its own error, not a generic one |
| `create-payment-intent.use-case.spec.ts` | Unit | Re-validation runs first; one payment row; the port is called once |
| `payment-intent.contract-spec.ts` | Contract | `{}` succeeds; all twenty forbidden fields `400`; `no-store` headers present |
| `intent-idempotency.int-spec.ts` | Integration | Same key → one payment; changed fingerprint → `409`; concurrent duplicates → one row |
| `no-activation-from-intent.contract-spec.ts` | Contract | A CI **absence** assertion: no activation or ledger call is reachable from this controller |
| `payments.isolation-spec.ts` (generated) | Isolation | A1–A7 on the intent and read routes |

**Rollback plan** — Migration phase: **expand** (two tables). Flag `rel.payments.intent` (**new**,
default *off* until M-058 can receive the resulting webhook): *off*, the endpoint returns `503` and
checkout stops at the summary — **no order can reach a provider whose callback the platform cannot
process.** Turning it on is the last step of the Sprint-5 exit.

**Notes** — The trap is the *convenience* return URL. Every provider integration wants one, and an
endpoint that accepts a redirect target is an open-redirect primitive on the highest-value flow in the
product. `return_surface` as an allowlist key costs one enum and closes it permanently.

---

# PART F — SPRINT 6 · THE WEBHOOK, ACTIVATION AND THE INVOICE (M-058 … M-060)

> Sprint 6 carries **two of the five standing invariants** — webhook-driven activation and the money
> trail that starts at the invoice — and milestone **M3**. `TR-04` (webhook ordering and loss) is the
> highest-scoring technical risk in the plan at 20, and `TR-03` (invoice gaps under concurrency) is
> the one whose defect is discovered by an auditor rather than by a test.

### M-058 — The webhook receiver — signature, dedup, replay, `§C4.3`, durable-first `2xx`

| Field | Value |
| :--- | :--- |
| **Sprint** | 6 |
| **Epic** | EP-08 · F-08.5, F-08.8 · T-08.15, T-08.17, T-08.19, T-08.22 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — The platform can accept a provider event from the public internet, prove it is genuine,
store it exactly once, acknowledge it only after it is durable, and hand the effect to the worker
tier — with no path by which a forged or replayed payload changes state.

**Depends on** — M-018, M-055, M-056, M-057.

**Unblocks** — M-059, M-060.

**Files**

- `apps/server/src/payments/controllers/webhooks/razorpay.webhook.controller.ts` + spec — `POST /v1/webhooks/payments/:provider`, `@Public()` **with `compensatingControl` declared** so CI gate `PG-1` recognises it as deliberately unauthenticated, rate-limit class `RL-WEBHOOK` counted **only after** verification, `no-store`.
- `apps/server/src/payments/infrastructure/webhook/{raw-body.middleware.ts, signature-verifier.ts, event-deduplicator.ts, replay-window.ts}` + specs — the JSON parser is **disabled** for this route and the body is read as `Buffer`; HMAC-SHA256 compared in **constant time**; dedup on `provider_event_id`; a timestamp outside the bounded window is rejected.
- `apps/server/src/payments/application/receive-webhook.use-case.ts` + spec — persist the verified event, commit, **then** `2xx`; enqueue the effect on the M-018 harness.
- `apps/server/src/payments/application/handlers/{payment-captured,payment-failed,payment-authorised,refund-processed}.handler.ts` + specs — **order-independent and idempotent**: a refund arriving before its capture does not corrupt state, it is parked for the reconciler.
- `apps/server/test/chaos/webhook-chaos.spec.ts` — the six-scenario suite: out-of-order, duplicated, delayed, missing, replayed, wrong-signature.

**Acceptance criteria**

1. An invalid signature yields **`204`** with `WEBHOOK_SIGNATURE_INVALID` logged and **nothing persisted**; the response never tells an attacker which check failed (`Payments.md` §7.2, resolution `PAY-R1`).
2. The body is read as a `Buffer` with the framework parser disabled; a re-serialised body must not verify, and a test proves it does not — this is the classic *"signature always invalid"* incident, inverted (`API_Catalog.md` §7.2 W2).
3. Comparison is **constant time**; a timing-comparison test asserts the absence of an early-return equality check (`NFR-SEC-05`).
4. `provider_event_id` uniqueness is **global, not tenant-prefixed**, because the event arrives carrying an event id and nothing else, before the tenant is resolvable; a replay is a no-op returning `2xx` (`E6.3`, `BR-PAY-05`, `Schema.md` §5.4 exception 1).
5. **`2xx` is returned only after the event is durably stored**, so an unstored event is retried by the provider rather than silently lost (`FR-PAY-04`, `TR-04` mitigation).
6. Handlers are **order-independent and idempotent**: the chaos suite's out-of-order refund-before-capture leaves consistent state and the `§C4.3` machine **rejects rather than forces** the illegal transition (`E6.3`, **TR-04**).
7. An unknown `:provider` is `404 WEBHOOK_PROVIDER_UNKNOWN` and **never falls back to a default secret** (`API_Catalog.md` §7.5).
8. No query parameter is accepted on this route — data outside the signature is a signature-bypass primitive (`Payments.md` §7.2).
9. `RL-WEBHOOK` is counted after verification only, at 3,000/min per provider, because a rate limit that drops a genuine capture would break `BR-PAY-02` (`Security.md` §10 tier 8).
10. The route is registered in the §5.5 non-tenant-scoped register with its `TB-6` / `TA-8` justification; coverage on the webhook path is ≥ 95% (`IS4`, `NFR-MNT-01`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `signature-verifier.spec.ts` | Unit | Valid, invalid, truncated, absent and wrong-algorithm signatures; re-serialised body fails |
| `event-deduplicator.int-spec.ts` | Integration | Three replays of one `provider_event_id` → one row, three `2xx`, one effect |
| `durable-before-ack.int-spec.ts` | Integration | Killing the process between persist and ack leaves the event stored; killing before persist yields no ack |
| `webhook-chaos.spec.ts` | Chaos | All six scenarios of `SprintPlanning.md` 6.24; illegal transitions rejected, state consistent |
| `webhook-public-declaration.contract-spec.ts` | Contract | The `@Public()` allowlist entry exists with `compensatingControl`; no other permissionless handler exists |

**Rollback plan** — No migration. Flag `ops.payments.webhook-receiver` (**new**, default *on*):
*off*, the endpoint returns `503` so the provider **retries** rather than considering the event
delivered — the only safe failure mode. `ops.payments.pull_only_mode` (**new**, default *off*, `F-08.19`)
is the paired contingency: with the receiver off, the M-059 reconciler tightens to one minute and
activation still never comes from the client.

**Notes** — The trap is returning `4xx` on an invalid signature. It is semantically tidy and it tells
`TA-8` — the payment-provider impersonator `Security.md` models explicitly — exactly when a forged
signature is close. `204` and a log entry gives an attacker nothing. The second trap is acknowledging
before storing, which converts a database blip into a permanently lost capture, because the provider
will not retry a `2xx`.

---

### M-059 — Webhook-exclusive activation, `payment.reconcile`, `payment.duplicate-detect`

| Field | Value |
| :--- | :--- |
| **Sprint** | 6 |
| **Epic** | EP-08 · F-08.4, F-08.6, F-08.9 · T-08.24, T-08.27, T-08.30, T-08.33 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — A captured payment activates a membership, and **the only caller of that command is the
webhook handler**; an indeterminate payment escalates and never auto-activates; a duplicate capture
is detected within the hour and refunded automatically.

**Depends on** — M-051, M-057, M-058.

**Unblocks** — M-060, M-061.

**Files**

- `apps/server/prisma/migrations/<ts>_create_memberships/migration.sql` — **the `memberships` table is created here, because a table cannot be created after its first writer** (see **R-M8**): `tenant_id`, `gym_id`, `user_id`, `plan_id`, `order_id`, `status membership_status_enum`, `start_date`/`end_date date` with `CHECK (end_date >= start_date)`, `purchased_terms jsonb`, `auto_renew DEFAULT false`. **RLS P-STD, G-CRUD and the §2.8.1 snapshot-immutability trigger in this file** (R-6); R-FIN. M-061 takes ownership and routes every subsequent transition through the `§C4.1` machine.
- `apps/server/src/memberships/application/activate-membership.command-handler.ts` + spec — **the single activation command**, reachable only from `payments/application/handlers/payment-captured.handler.ts` through `membership-command.port.ts`; `purchased_terms` is snapshotted from the order, never re-resolved.
- `apps/server/src/payments/application/jobs/payment-reconcile.processor.ts` + spec — every **15 minutes**, polls `PENDING`/`AUTHORISED` payments past the threshold, applies a terminal provider state idempotently, and **escalates to Finance when indeterminate** (`FR-PAY-05`, `BR-PAY-06`).
- `apps/server/src/payments/application/jobs/payment-duplicate-detect.processor.ts` + spec — finds two `CAPTURED` payments on one order in one index scan via `idx_payments__order_status`, refunds the later automatically and notifies both parties (`FR-PAY-08`, `BR-PAY-07`).
- `apps/server/test/contract/activation-single-caller.contract-spec.ts` — the **absence** assertion that makes invariant 5 structural.

**Acceptance criteria**

1. **The browser can be closed before the redirect and the membership is nonetheless `ACTIVE`** (`E6.2`, `AC-PAY-02.1`, invariant 5).
2. **There is no client activation path to disable**: the activation command has exactly one caller, proven by a CI absence test over the call graph, and adding a second fails the build (`E5` risk row, `BR-PAY-02`, `F-08.4`, `I5`).
3. Activation is idempotent on `payment_id`: three replays of a capture produce **one** membership, one invoice and one ledger effect (`E6.3`, demo step 3).
4. An **indeterminate** payment escalates to Finance and **never auto-activates**; the escalation carries the order, the payment, the provider state and the elapsed time (`E6.4`, `BR-PAY-06`).
5. The reconciler runs every 15 minutes, applies terminal states idempotently, and resolves the chaos suite's refund-before-capture case within one cycle (`FR-PAY-05`, demo step 4).
6. A duplicate capture is detected and **auto-refunded within one hour** with notification to both parties (`E6.5`, `BR-PAY-07`).
7. A gateway amount differing from the order amount creates **no** membership and raises an alert, re-asserted here at the domain boundary as well as in M-056's adapter (`E5.9`, `B5.10`).
8. `memberships` arrives with RLS, grants and the snapshot-immutability trigger in the creating migration; `purchased_terms` obeys `S1`–`S7` and is authoritative over `plans` absolutely (`R-6`, `BR-PLN-02`, `Schema.md` §8.1).
9. Isolation coverage for the membership read routes added here is generated in this PR; the activation command has no HTTP surface at all (`R-5`).
10. Coverage on `payments/application/**` and the activation handler is ≥ 95% (`NFR-MNT-01`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `activation-single-caller.contract-spec.ts` | Contract | A CI **absence** assertion over the call graph: exactly one caller, and it is the webhook handler |
| `activation-idempotency.int-spec.ts` | Integration | Three capture replays → one membership, one invoice, one ledger effect |
| `payment-reconcile.processor.int-spec.ts` | Integration | Terminal states applied idempotently; the indeterminate case escalates and creates nothing |
| `duplicate-detect.int-spec.ts` | Integration | Two `CAPTURED` rows on one order → the later auto-refunded inside the hour, both notifications emitted |
| `browser-closed.e2e-spec.ts` | E2E (Playwright) | The `E6.2` proof: kill the browser after authorisation, reopen, membership already `ACTIVE` |
| `memberships.isolation-spec.ts` (generated) | Isolation | A1–A7 on the membership read routes |

**Rollback plan** — Migration phase: **expand** (`memberships`). Flag `ops.payments.reconciler`
(**new**, default *on*) and `ops.payments.duplicate-detect` (**new**, default *on*) each stop their
job without touching activation; outbox and provider retries make both catch up on resume.
**Activation itself is not flagged** — invariant 5 has no off switch, and a flag that disabled it
would leave paid customers without memberships.

**Notes** — The trap is a *"manual activation"* admin action added for support. It creates a second
caller, breaks criterion 2, and the CI absence test is the only thing standing between that ticket and
`BR-PAY-02`. The supported answer is to replay the provider event, which is why M-058 stores the raw
verified payload. **R-M8**: `EP-10` nominally creates `memberships` in Sprint 7, but Sprint 6
activation writes membership rows, so the table is created here and Sprint 7 takes ownership —
recorded in `DECISION_LOG.md` by this milestone.

---

### M-060 — The gapless per-tenant-per-FY invoice number and the India GST breakdown

| Field | Value |
| :--- | :--- |
| **Sprint** | 6 |
| **Epic** | EP-09 · F-09.1, F-09.2, F-09.3, F-09.6, F-09.12, F-09.13, F-09.15 · T-09.01, T-09.04, T-09.08, T-09.15, T-09.22 |
| **Size** | 6h |
| **Role** | BE |

**Goal** — Every captured payment produces an immutable Indian tax invoice whose number is gapless
and sequential **per tenant per financial year**, allocated by a row-locked counter inside the
issuing transaction, with CGST and SGST as two separate components summing to the persisted tax.

**Depends on** — M-016, M-051, M-052, M-057, M-058, M-059.

**Unblocks** — the `Milestones_060-089.md` band: the deterministic PDF renderer, credit notes, the
ledger and settlement.

**Files**

- `apps/server/prisma/migrations/<ts>_create_invoices_and_counters/migration.sql` — `invoices` per `Schema.md` §7.5 with `uq_invoices__tenant_fy_number (tenant_id, financial_year, invoice_number)`, `tenant_snapshot`, `customer_snapshot`, `line_items`, `tax_breakdown`, `place_of_supply_state_code`, `sac_code`, the five copied money columns with `ck_invoices__total_identity`, `status invoice_status_enum` with **no `VOID` label**; and `document_number_counters` per §13.6 keyed `(tenant_id, document_kind, financial_year)` with `next_value`. **RLS P-STD on both; `invoices` is G-APPEND plus `GRANT UPDATE (status, pdf_url)`; no soft delete, ever** (R-6). `credit_notes` is created in the next band.
- `apps/server/src/billing/domain/{financial-year.vo.ts, document-number.allocator.ts, invoice.aggregate.ts, void-record.ts}` + specs — **`financialYearOf(instant, timezone, fyStartMonth)` is one function** used by the allocator, the report, the export and the PDF; `fyStartMonth` comes from the tax profile and defaults to **4**, never a constant (`F-09.13`, ADR-0028).
- `apps/server/src/billing/domain/tax/{tax-component.vo.ts, gst-split.policy.ts, place-of-supply.ts}` + specs — intra-state yields **two** components CGST 9% + SGST 9%; inter-state yields **one** IGST 18%; place of supply is the **branch's** state; rounding is applied **per component, then summed** (`F-09.12`, `LAUNCH_MARKET_INDIA.md` §4).
- `apps/server/src/billing/application/issue-invoice.use-case.ts` + spec · `handlers/payment-captured.handler.ts` — driven by the `payment.captured` outbox event, one invoice per captured payment (`F-09.1`).
- `apps/server/src/billing/application/jobs/sequence-contiguity.processor.ts` + spec — the nightly assurance job: `count(*) = max(number)` per tenant per FY, alerting on any hole (`F-09.15`, **TR-03** mitigation).
- `apps/server/src/billing/infrastructure/{invoice.prisma-repository.ts, document-number-counter.repository.ts}` + int-specs · `prisma/seed/billing.seed.ts` · `SEED_VERSION → 0.17`.

**Acceptance criteria**

1. **The number is allocated by an `UPDATE … RETURNING next_value - 1` against a row-locked counter row inside the issuing transaction, never by a PostgreSQL `SEQUENCE`** — sequences are non-transactional and a rollback consumes a number, which is the definition of a gap (`Schema.md` §2.12, `PROJECT_CONSTITUTION.md` §15.8 rule 3, `FR-INV-02`).
2. **50 concurrent invoice issuances for one tenant produce 50 contiguous numbers with zero gaps**, and the lock is held only for the issuing transaction — PDF rendering, which owns the `NFR-PERF-07` three-second budget, is **outside** it (`E6.6`, `AC-INV-01.1`, `TR-03`).
3. **The financial year is derived in the tenant's timezone, never in UTC.** An invoice issued 23:45 IST on 31 March 2027 is FY `2026-27`; one issued 00:15 IST on 1 April 2027 is `2027-28`. In UTC those instants are **18:15 and 18:45 on the same UTC day**, and computing the FY in UTC would place both in one year, break the sequence, and surface the defect once a year, in April, in production, in a tax document (`Schema.md` §2.12, §14.2, `LAUNCH_MARKET_INDIA.md` §5).
4. The **18:30 UTC boundary** is asserted directly: a table-driven test issues invoices at 18:29:59Z, 18:30:00Z and 18:30:01Z on 31 March and asserts the FY label flips at exactly 18:30:00Z, the `Asia/Kolkata` UTC+05:30 midnight (`AC-INV-01.3`, `TM7`).
5. Rollover is **implicit**: a new `(tenant, kind, FY)` key materialises with `next_value = 1` by upsert inside the first invoice transaction of the year; the counter is never manually advanced (`Schema.md` §2.12, `F-09.13`).
6. A post-allocation failure produces a documented **void record**, not a hole; the counter is never rewound, and `invoice_status_enum` still has no `VOID` label because the void record is a separate artefact from a cancelled document (`E6.6`, `AC-INV-01.2`, `BR-PAY-10`).
7. Three independent sequences exist per tenant per FY — `INVOICE`, `CREDIT_NOTE`, `SUBSCRIPTION_INVOICE` — through **one** counter table with a `document_kind` discriminator, because three tables would be three code paths and three chances for one to use a sequence (`Schema.md` §2.12).
8. `tax_breakdown` is an **array of component objects**: intra-state two rows CGST 9% + SGST 9%, inter-state one row IGST 18%, same shape either way so the renderer does not branch. `SUM(amount_minor)` **must equal** `tax_minor`; a mismatch **blocks the invoice, it does not round** (`E6.7`, `F-09.12`, `Schema.md` §7.5).
9. The invoice is **immutable**: G-APPEND grants with `UPDATE` limited to `status` and `pdf_url`; every figure is copied from the order at issuance and **never recomputed**, and no read path joins to `tax_profiles` (`BR-PAY-10`, `BR-PAY-11`, `F-09.3`, `F-09.6`).
10. The nightly contiguity job runs across every tenant and FY and alerts on any hole; isolation coverage for the invoice read routes is generated in this PR; coverage on `billing/**` is ≥ 95% (`F-09.15`, `R-5`, `NFR-MNT-01`).

**Testing**

| Test | Layer | Asserts |
| :--- | :--- | :--- |
| `financial-year.vo.spec.ts` | Unit | The **18:30 UTC** boundary table: 18:29:59Z → `2026-27`, 18:30:00Z → `2027-28`; a non-April `fyStartMonth` from configuration; a UTC computation fails the test |
| `document-number.allocator.int-spec.ts` | Integration | **50 concurrent issuances → 50 contiguous numbers, zero gaps**; a rolled-back transaction reuses the number; two tenants do not contend |
| `void-record.int-spec.ts` | Integration | A forced post-allocation failure produces a void record, not a hole, and the counter is untouched |
| `gst-split.policy.spec.ts` | Unit | Intra-state two components, inter-state one; per-component rounding then summing; a one-paisa mismatch **blocks** issuance |
| `invoice-immutability.int-spec.ts` | Integration | Every column except `status` and `pdf_url` is refused an `UPDATE` by grant; a snapshot rewrite is refused by trigger |
| `sequence-contiguity.processor.int-spec.ts` | Integration | An injected hole is detected and alerted; a clean corpus passes silently |
| `invoices.isolation-spec.ts` (generated) | Isolation | A1–A7 on the tenant and member invoice read routes |

**Rollback plan** — Migration phase: **expand** (two tables). **This is the least reversible
migration in the band**: `invoices` is R-FIN, G-APPEND and legally retained, so once one invoice is
issued the contract phase does not exist and the only forward path is a credit note. Flag
`rel.billing.invoice-issuance` (**new**, default *on*): *off*, the `payment.captured` handler enqueues
issuance and the job **defers** rather than dropping — invoices are produced late, never skipped,
which is the only acceptable degradation for a statutory document. Numbering, immutability and the
GST split are **not** flagged.

**Notes** — Three traps, and all three are the same mistake at different depths. First, a `SEQUENCE`:
it is the obvious tool, it is fast, and it gaps on rollback — and a gap in a filed GST series is
discovered by an auditor, not by a test. Second, an advisory lock instead of the counter row: it
serialises correctly and leaves nothing durable, so a crash between allocation and commit is
unresolvable. Third, and the one that survives review most often, computing the FY from `issued_at`
in UTC because *"timestamps are UTC everywhere else"*. They are — and the **label** is a local-time
interpretation of the instant. `LAUNCH_MARKET_INDIA.md` flags April–March as a Medium-severity open
item precisely because it is cheap now and painful in April.

---

## 1. Dependency spine

Every edge points from a lower id to a higher one, so the band builds strictly in ascending order
(**R-4**). The critical path through this file is:

```text
illustrative — not committed code
M-031 ─► M-032 ─► M-035 ─► M-036 ──────────────► M-042 ─► M-043 ─► M-044 ─┬─► M-045 ─► M-046 ─► M-047 ─► M-048
   └──► M-033 ─► M-034 ──┘                          ▲                     └─► M-049 ─► M-050 ──┐
                                                    │                                          │
M-037 ─► M-038 ─► M-039 ─► M-040 ─► M-041 ──────────┘                                          │
                     └──────────────────────────────────────────────────────────────────────► M-051
M-051 ─► M-052 ─► M-053 ─► M-054 ─┐
M-055 ─► M-056 ────────────────────┴─► M-057 ─► M-058 ─► M-059 ─► M-060 ─► (Milestones_060-089.md)
```

| Property | Statement |
| :--- | :--- |
| **Longest chain** | M-031 → M-032 → M-039 → M-042 → M-043 → M-044 → M-046 → M-049 → M-051 → M-052 → M-053 → M-057 → M-058 → M-059 → M-060 — fifteen milestones, and the reason no single engineer can serialise this band |
| **Parallel front, Sprint 3** | M-037 … M-041 (plans) and M-042 … M-048 (discovery) share only M-039; two backend engineers work them concurrently after M-039 merges |
| **Parallel front, Sprint 5** | M-055 → M-056 (the port and the adapter) is independent of M-051 → M-054 (orders and coupons) until M-057 joins them |
| **Hard serialisation** | M-057 → M-058 → M-059 → M-060 cannot be parallelised: each writes the state the next reads, and all four are money paths under mandatory pairing (`RSK-14`) |
| **Cross-file edges out** | M-039 (`PLAN_TERMS_PORT`) → M-062/M-064 · M-051 (`ORDER_SNAPSHOT_PORT`) → M-066 · M-059 (`memberships`) → M-061 · M-060 (`document_number_counters`) → the credit-note sequence |

## 2. What this band deliberately does not contain

Named again, per **R-M7**, so that an absence is never mistaken for an omission.

| Scope | Where it went | Why |
| :--- | :--- | :--- |
| Order history, two-sided (`F-07.11`, task 5.9) | **Sprint 9**, with CRM | Sprint-5 backend is at 139%; history reads state this band creates and blocks nothing |
| Abandoned-checkout reminder (`F-07.10`, task 5.10) | **Sprint 9** | Same mitigation; it needs the notification preferences layer |
| Staff-initiated offline orders and `SCR-DASH-012` (`F-07.9`, task 5.8) | **Sprint 9** | Reduced here to the `channel = 'DASHBOARD'` / `PARTIALLY_PAID` schema and constraint in M-051, so no migration is needed later |
| RBI e-mandate lifecycle and subscription charging (`F-08.16`, `F-09.11`, tasks 6.9, 6.17) | **`Milestones_060-089.md`** and **Sprint 15** | Sprint-6 mitigation; thresholds are configuration, so a late value is a data change |
| Deterministic Chromium PDF and the India template (`F-09.7`, `F-09.16`, tasks 6.15, 6.22) | **Next band** | M-060 issues the numbered, immutable, GST-correct **record**; the renderer is a separate risk (`TR-15`) with its own container work |
| Credit notes (`F-09.3` issuance path) | **Next band**, with refunds | The second gapless sequence reuses M-060's allocator unchanged, which is the point of the `document_kind` discriminator |
| Saved searches (`F-06.14`) and the unavailable-gym page (`F-06.25`) | **Sprint 4 carry-out** | Pre-designated Diwali carry-outs in `SprintPlanning.md` |
| Platform commission tax invoice series (`F-09.14`) | **Scaffolded Sprint 6, issuance blocked on `REG-02`** | Open item O-1; `commission_tax_minor` is already a nullable column on `orders` (M-051) so adoption changes no DDL |

## 3. Exit-condition coverage

| Sprint | `C9.1` exit condition | Milestones that satisfy it | Residual risk at band close |
| :-: | :--- | :--- | :--- |
| 2 | `E2.3`, `E2.5`–`E2.10`, toward `E2E-01` | M-031 … M-036, with `E2.7`'s sixty seconds measured end to end by **M-043** | None; `E2.7` closes when M-043 merges |
| 3 | `E3.1`–`E3.9` | M-037 … M-048 | `E3.8` records the p95; it is **met** in Sprint 4 |
| 4 | *"Search meets `NFR-PERF-01` on seeded data"* — `E4.1`–`E4.12` | M-049, M-050 | `E4.1` is a gate that can fail; the sanctioned responses are named in M-049's Notes and a search cluster is not among them |
| 5 | `E5.1`–`E5.11` | M-051 … M-057 | `E5.7` needs both adapters green; `BLK-03` conflicts 2 and 3 must be **decided**, not implemented |
| 6 | `E2E-02` passes — `E6.1`–`E6.12` | M-058 … M-060, plus M-050 for the discovery half of the journey | `E6.9` (byte-identical PDF) and `E6.10`'s 3-second render belong to the next band; `E6.6`, `E6.7` and `E6.8` close here |

## 4. Standing obligations restated for the reviewer

| # | Obligation | Where it is checked |
| :-: | :--- | :--- |
| 1 | Every new endpoint ships its isolation coverage in the **same** milestone | CI job 13, unwaivable (`BAC-10`, `E2E-11`, DoD #16) |
| 2 | Every new tenant-owned table ships its RLS policy **and** grants in the **same** migration file | CI job 11, `IS6` `pg_policies` check (`MG10`, `P9`) |
| 3 | Every new table extends `prisma/seed/` and bumps `SEED_VERSION` — `0.9` → `0.17` across this band | `TestingStrategy.md` §6.7 |
| 4 | Money paths (`ordering/`, `payments/`, `billing/`) hold a **95%** coverage floor and require two approvals | `NFR-MNT-01`, `CODEOWNERS`, `RSK-14` pairing blocks |
| 5 | No figure on any surface is recomputed at display time | `BR-FIN-02`, asserted in M-051, M-052 and M-060 |
| 6 | Every fenced block in this document is labelled `illustrative — not committed code` | Review; **no application code exists at the time of writing** |

---

**End of `Milestones_030-059.md`.** 30 milestones, **M-031 … M-060**, covering Sprint 2 tail through
Sprint 6: the catalogue, the price authority, marketplace discovery, checkout, payments and the first
statutory invoice. Continues in **`Milestones_060-089.md`** at **M-061**.



