# common

**Charter (PRD §C1.3):** _config, logging, tracing, errors, guards, decorators, money (minor-unit
integer type), pagination, idempotency._

> **Delivery state.** M-001 … M-004 have landed `common.module.ts`, `config/app-config.schema.ts`,
> `logging/` (correlation ALS, middleware, redaction), `errors/` (domain exception + filter),
> `validation/zod-validation.pipe.ts` and `health/`. Everything named in sections 3 – 8 below is
> still the **planned** contract, derived from the specification and not yet built.

---

## 1. Bounded context

`common/` owns the decision of **what a cross-cutting mechanism means, platform-wide** — one `Money`
type, one error envelope, one idempotency semantic, one correlation id, one clock, one pagination
cursor, one rate-limit class registry, one outbox write path. No other module may re-implement,
vary, or locally override any of them: a second money formatter, a second fingerprint algorithm or a
second `new Date()` is a review rejection, not a style preference. It is emphatically **not** a
bounded context — it owns no business decision at all, which is precisely why constitution §7.3.1
row 4 exempts it from `controllers/` and row 9 exempts it from `domain/`. It is layer **L0**, the
sink of the dependency graph (`ModuleDependency.md` §2.1): it imports nothing and is imported by all
twenty-two other modules.

## 2. PRD identifiers

| Class                       | Identifiers                                                                                                                                                                                                                                                               |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PRD sections                | **§C1.5** (all nine cross-cutting mechanisms), **§C3.1** (error envelope, opaque cursor), **§C5** (the job harness all 24 jobs run on)                                                                                                                                    |
| Business rules              | `BR-PAY-01` (money is integer minor units), `BR-PAY-03` (idempotency replay / `409` on fingerprint mismatch), `BR-DAT-06` (no personal data in logs, traces or analytics)                                                                                                 |
| Non-functional              | `NFR-DQ-02`, `NFR-MNT-04` (correlation id across HTTP → queue → job), `NFR-MNT-05` (tracing), `NFR-MNT-06` (job and queue alerting), `NFR-SEC-06` (tiered rate limiting), `NFR-SEC-07`, `NFR-PRV-07` (redaction deny-list), `NFR-SCAL-05` (worker tier binds no listener) |
| Enforcement point only      | `FR-RBAC-01`, `FR-RBAC-02` — the guards and the `@RequiredPermission()` decorator live here; the `(role, scope, resource, action)` **decision** is `iam/`'s                                                                                                               |
| Ports it defines for others | `FR-INV-07` (deterministic PDF renderer port), `A-17`/`A-18` (Sharp renditions, S3 adapter), `ADR-0026` (server-side flag evaluation)                                                                                                                                     |
| ADRs                        | `ADR-0016` (idempotency), `ADR-0017` (transactional outbox), `ADR-0023` (opaque cursor), `ADR-0026` (feature flags)                                                                                                                                                       |
| C4 state machines           | **None.** `common/` has no aggregate and therefore no `§C4` machine.                                                                                                                                                                                                      |

## 3. Owned tables

_Planned. No code in this module yet — populated by the milestones listed below._

| Table              | Tenancy · retention · grants                                                                                                                                                | Why it is `common/`'s                                                                                                                                                                                                                                                 |
| :----------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `outbox`           | RLS · P-STD · R-EPH (30 d after publish) · **G-COMPLETE** (`SELECT, INSERT` + column-scoped `UPDATE` on `status`, `published_at`, `attempts`, `last_error`, `available_at`) | The transactional outbox is a §C1.5 mechanism, not a domain artefact. Every module writes rows through `OUTBOX_PORT`; none owns the table (`Schema.md` §13.1)                                                                                                         |
| `idempotency_keys` | RLS · P-STD · R-EPH (24 h) · G-CRUD-D — one of only six tables where `DELETE` is granted, because the row is a cache entry with an explicit TTL (`Schema.md` §13.2)         | `BR-PAY-03` is a request-pipeline property. `uq_idempotency_keys__key` is globally unique — one of the five closed `SC-R06` exceptions permitted not to lead with `tenant_id` — because the interceptor sits **before** tenant resolution on the public checkout path |
| `job_runs`         | RLS · job name, lock scope, `started_at`, `ended_at`, outcome, error, correlation id                                                                                        | The run record every `§C5` job writes. Not in the 79-table `Schema.md` census; added by M-018                                                                                                                                                                         |

**Not owned here, despite proximity:** `audit_log` → `audit/`; `search_documents` → `discovery/`;
`document_number_counters` → `billing/`; `data_subject_requests` → the data-subject process, not
`common/`. The twelve **Platform Reference** tables of `Schema.md` §12 are _read_ through
`ReferenceDataRepository` and written only by `admin/` — read access is not ownership.

**Delivering milestones:** **M-017** (`idempotency_keys` + interceptor) · **M-018** (`outbox`,
`job_runs`, the `SKIP LOCKED` dispatcher, the BullMQ harness).

## 4. Public surface

_Planned. No `index.ts` exists in this module yet — populated by the milestones listed below._

`common.module.ts` is `@Global()` — one of only two permitted (`§3.4.3`; the other is `tenancy/`).
Per `ModuleDependency.md` §3.1 the edge `* → common/` applies to **all twenty-two** other modules,
so every symbol below has the same consumer list unless stated otherwise.

| Exported symbol                                                                                                                     | Consumers                                                                                                                      | Milestone                              |
| :---------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- | :------------------------------------- |
| `Money` value type + `CURRENCY_MISMATCH` error; arithmetic **only** through its methods                                             | All money-bearing modules: `ordering/`, `payments/`, `billing/`, `ledger/`, `refunds/`, `settlements/`, `plans/`, `reporting/` | M-016                                  |
| `Result<T, E>` and the error taxonomy — `ErrorCode` registry + `ProblemDetails` mapper → `{code, message, details, correlation_id}` | All 22                                                                                                                         | M-004 (landed), extended per milestone |
| Guards: `JwtAuthGuard`, `PermissionsGuard`, `MfaGuard`, `ImpersonationRestrictionGuard`, `ResourceTenantGuard`                      | Every module with controllers                                                                                                  | M-011, M-023, M-024, M-025             |
| Decorators: `@RequiredPermission()`, `@TenantScoped()`, `@Idempotent()`, `@Audited()`, `@RateLimit()`, `@FinancialMutation()`       | Every module with controllers                                                                                                  | M-008 → M-025                          |
| `OUTBOX_PORT` (write) and the dispatcher contract                                                                                   | Every emitting module (all publishers in `ModuleDependency.md` §8.2)                                                           | M-018                                  |
| `UNIT_OF_WORK_PORT` — exactly **one** interactive transaction per use case (`§11.4.2` P4)                                           | Every module that persists                                                                                                     | M-010                                  |
| `CLOCK_PORT`, `ID_GENERATOR_PORT` — the domain never calls `Date.now()`                                                             | All 22; enforced by the `no-bare-date` lint rule                                                                               | M-016                                  |
| `FEATURE_FLAG_PORT` — server-side evaluation; the client receives the resolved set                                                  | All 22                                                                                                                         | M-116                                  |
| `TenantScopedRepository`, `ReferenceDataRepository` base classes                                                                    | Every `infrastructure/` directory                                                                                              | M-012                                  |
| Opaque pagination cursor codec                                                                                                      | Every list endpoint                                                                                                            | M-008                                  |
| Rate-limit class registry (`RL-AUTH`, `RL-OTP`, `RL-READ`, `RL-EXPORT`, …)                                                          | Every controller                                                                                                               | M-020, M-108                           |
| Storage S3 port, Sharp rendition port, deterministic PDF renderer port                                                              | `catalog/`, `billing/`, `reporting/`, `onboarding/`                                                                            | M-029, M-033, M-060                    |
| BullMQ queue registry, distributed-lock helper, timezone schedule, `JobRunner`                                                      | Every module owning a `§C5` job                                                                                                | M-018                                  |

**Why there are no `controllers/` (`FolderStructure.md` §8.2).** `common/` is _a mechanism library,
not a bounded context_. There is nothing here for a client to address: a mechanism is consumed by
dependency injection, and an HTTP surface over it would be an API for changing how the platform
computes money or replays a request. Nothing replaces it.

> **One nuance worth stating, because it looks like a breach and is not.** `common/health/` already
> exposes `/healthz` and `/readyz` (M-004). Those are constitution §18.6 **HL1** infrastructure
> probes — unversioned, untenanted, permissionless, and outside `/v1` — and they do not live in a
> `controllers/` directory. §8.1 exempts `common/` from _mandatory_ controllers; it does not create
> a business surface here, and none may be added.

## 5. Consumed ports

**None.** `common/` imports no module — its row in the `ModuleDependency.md` §4 matrix is `—` in
every column but its own. This is not an accident of layering; it is the property that makes the
graph acyclic (§5.3), because all twenty-two other modules import `common/`. Any port consumed here
would create a cycle immediately, and `dependency-cruiser`'s layer rules fail the build on an import
from `common/**` into any sibling module.

## 6. Emitted events

**None.** `common/` owns the outbox _mechanism_, not any aggregate. Event names obey `E4`
(`<aggregate>.<past-tense-verb>`) and `common/` has no aggregate to name — every one of the
fifty-two events in the `ModuleDependency.md` §8.2 catalogue is published by a module that owns a
consistency boundary. A `common.*` event would mean a mechanism had acquired a domain.

## 7. Consumed events

_Planned. No code in this module yet — populated by the milestones listed below._

| Event            | Publisher | Idempotency key          | Why `common/` is the consumer                                                                                                                                                                                                |
| :--------------- | :-------- | :----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flag.changed`   | `admin/`  | `flag_key` + `version`   | The §8.2 catalogue names the consumer as _"every module (via `common/config`)"_. The single invalidation point is `common/config`'s flag cache; twenty-three separate handlers would be twenty-three separate staleness bugs |
| `config.changed` | `admin/`  | `config_key` + `version` | Same shape. `ModuleDependency.md` §0 **C-3**: platform-global configuration is read through `common/`, **never** by importing `admin/`                                                                                       |

Both handlers are pure cache invalidation and hold no state, which is what makes `E3` (idempotent
handlers, at-least-once delivery) trivially satisfied here.

**Delivering milestones:** **M-116** (`flag.changed`, targeting by tenant, role, percentage and
city) · the `admin/` configuration band **M-114 … M-116** for `config.changed`.

## 8. Jobs

_Planned. No code in this module yet — populated by the milestones listed below._

**`common/` owns none of the twenty-four `§C5` jobs.** It owns the harness every one of them runs
on, which is a different thing and is why the distinction is stated rather than assumed.

| What lives here                                                                                       | Detail                                                                                                                                                                                                                                                                                                                                                                                        |
| :---------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The **harness** — `queue.registry.ts`, `distributed-lock.ts`, `timezone-schedule.ts`, `job-runner.ts` | Class semaphore acquired **before** a connection (`SC-R13`), `job_runs` start/end/outcome, duration-envelope alerting, correlation-id propagation into the job. `audit.partition-maintenance` is deliberately its first consumer (`TR-41`)                                                                                                                                                    |
| The **outbox dispatcher**                                                                             | `FOR UPDATE SKIP LOCKED`, dead-letter after N attempts without stalling the queue behind a poisoned row. The scheduled job that drives it is `notification.dispatch` — **`§C5` job 19, owned by `notifications/`**, class P2, continuous 5 s relay. The dispatcher's cross-tenant scan runs through `tenancy/`'s `runElevated()` with the reason `"outbox dispatch"` and is therefore audited |
| `idempotency-sweep`                                                                                   | **Not a `§C5` job.** A TTL sweep declared by M-017; it runs as `app_migrator`, and `DELETE` is granted on `idempotency_keys` for exactly this reason                                                                                                                                                                                                                                          |
| Outbox pruning                                                                                        | Not a job of its own either — `outbox` is _"pruned by `data.retention-sweep`"_ (`Scalability.md` §5, job 23), the `admin/`-parented weekly sweep that fans out one child per owning module                                                                                                                                                                                                    |

**Delivering milestone:** **M-018** (harness + dispatcher; also the point at which `worker.ts` stops
being a stub and still binds no HTTP listener, `NFR-SCAL-05`).

## 9. Top three failure modes (`NFR-MNT-09`)

Declared by `PROJECT_CONSTITUTION.md` §18.5.1. Runbook: **[`/docs/runbooks/common.md`](../../../../docs/runbooks/common.md)**

|  #  | Failure mode                                  | Signal                                                                                                                                                   | First action                                                                                                                                                                                                                                            |
| :-: | :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|  1  | **Correlation-id propagation lost into jobs** | Log lines from `worker.ts` carrying no `correlation_id`; a trace that ends at the HTTP span with no `job.execute` child. `ALRT-26` is the adjacent alert | Check that the enqueue path copied the ALS value into the job data — the loss is at the boundary, never inside the job. Do **not** regenerate an id in the processor; that hides the break                                                              |
|  2  | **Idempotency store unavailable**             | `ALRT-35` — any `redis_evicted_keys_total` increment on the instance holding idempotency records, or `redis_memory_used_bytes / max > 0.85` for 10 m     | **Treat as a money-correctness incident, not an infrastructure one.** An evicted idempotency record turns a client retry into a second charge (`BR-PAY-03`, `ADR-0016`). Stop the bleeding on the Redis instance before touching the application        |
|  3  | **Config validation failure at boot**         | The process logs `fatal` and exits; `/readyz` never becomes ready and the instance stays out of rotation                                                 | Diff the deployed environment against `app-config.schema.ts`. The schema is the **only** place an environment variable is declared; a variable read anywhere else is the defect. Failing closed here is correct — do not relax the schema to get a boot |
