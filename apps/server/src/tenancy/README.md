# tenancy

**Charter (PRD §C1.3):** _tenant context resolution, RLS session variable, tenant guard._

---

## 1. Bounded context

`tenancy/` owns the answer to **"which tenant is this unit of work acting for, and on which physical
database connection is that fact set"** — and no other module may take any part of that decision. It
is the only directory in the repository that may construct a `PrismaClient` (`P1`, `P2`), the only
place `set_config('app.tenant_id', $1, true)` is issued (`P3` — the third argument is `is_local`,
because a session-level `SET` on a pooled connection would follow the connection to the next
request), and the only place cross-tenant scope may be entered, through the named, reason-bearing,
audited `runElevated()` call rather than any ambient capability (`§11.6`, `§C1.4`). It also owns the
`tenants` column of the `§C4.4` state machine — `SM-TEN-T09` … `SM-TEN-T12`
(`StateMachines.md` §7.1). It sits at layer **L1** and imports only `common/`; twenty modules import
it. `BR-TEN-01` is _"both a legal obligation and the thing most likely to be violated by an ordinary
coding mistake"_ (`§C1.4`), and this module is the whole of the structural defence.

## 2. PRD identifiers

| Class               | Identifiers                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRD sections        | **§C1.4** (the five-layer enforcement chain, in order), **§C4.4** (the `tenants.status` column of the composite machine)                                                                                                                                                                                                                                                                                                                                       |
| Business rules      | `BR-TEN-01` (invariant 1 — no cross-tenant read or write by any code path), `BR-TEN-02` (one owner, many tenants; switching is explicit and audited; **no cross-tenant action in a single request**), `BR-TEN-04` (soft delete; financial, invoice and audit records retained regardless), `BR-TEN-05` (a suspended tenant leaves search immediately), `BR-TEN-06` (`PAST_DUE` degradation schedule — 7 days visibility, 14 days write access, never check-in) |
| Non-functional      | `NFR-SEC-09` (isolation enforced at the database by RLS, **not solely in application code**, and proven by an automated CI suite)                                                                                                                                                                                                                                                                                                                              |
| Acceptance evidence | `BAC-10`, `E2E-11`, `AC-FND-01.*`, `AC-FND-02.*`, `AC-FND-03.1`, `AC-FND-05.*`, `PE-T1` … `PE-T9`, `PX-1` … `PX-7`, `RS-1` … `RS-12`                                                                                                                                                                                                                                                                                                                           |
| Cross-module        | `FR-ADMN-02` — every elevation carries a mandatory reason and is audited before the work happens                                                                                                                                                                                                                                                                                                                                                               |
| ADRs / stack        | `ADR-0005` (the tenant-context extension), `ADR-0004` (session-mode pooling, never transaction mode), `ADR-0006`, `A-01` — **Prisma's approval is conditional on this extension existing exactly as specified**; a variant is a stack-approval breach, not a design choice                                                                                                                                                                                     |
| Permissions         | `tenancy.ping.read` — the module's single permission constant (M-012)                                                                                                                                                                                                                                                                                                                                                                                          |

> **Stated honestly:** the PRD's functional catalogue (`§B5`) assigns **no `FR-` identifier** to
> `tenancy/`. The module is specified entirely by `§C1.4`, the `BR-TEN-` family, `NFR-SEC-09` and
> the `BAC-10` / `E2E-11` acceptance criteria. Nothing has been invented to fill the column.

## 3. Owned tables

_Planned. No code in this module yet — populated by the milestones listed below._

| Table     | Class                                                                                 | Notes                                                                                                                                                                                                                                                                                                                                                                                                               |
| :-------- | :------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tenants` | RLS · policy class **P-SELF** · retention **R-FIN** · grants **G-CRUD** · soft delete | The **one** table whose policy is not `P-STD`, because the table _is_ the tenant: `USING (id = current_setting('app.tenant_id')::uuid)`. RLS is `ENABLE`d **and `FORCE`d**, so the owner is not exempt. A second policy, `rls_tenants__platform_read FOR SELECT TO app_platform_ro USING (true)`, is how the approval queue and `FR-ADMN-01` read across tenants — **not** by relaxing the first (`Schema.md` §4.1) |

**No balance column exists on `tenants` and none may be added.** `BR-FIN-01`: all balances derive
from `ledger_entries`. A `current_balance_minor` here would be the single most tempting and most
damaging denormalisation in the schema.

**Not owned here, despite sharing `Schema.md` §4.** `applications` and `kyc_documents` are
`onboarding/`'s (M-026); `staff`, `staff_branches`, `staff_invitations` are `staff/`'s; `users` and
the RBAC tables are `iam/`'s (M-019); `attribution_events` and `favourites` belong to the discovery
and commerce modules. `Schema.md` groups them for a schema reviewer's convenience, not by module.
`payout_accounts` and `subscription_invoices` are assigned to the money modules; the roadmap does not
name their creating milestone, so no owner is asserted here.

**Delivering milestones:** **M-009** (table, `FORCE` RLS, both `USING` and `WITH CHECK`, the
platform-read policy, `G-CRUD` grants, `SEED_VERSION = 0.1` with three fixed-uuid tenants in three
timezones) · **M-012** (`tenant.prisma-repository.ts` and its mandatory RLS `int-spec`).

## 4. Public surface

_Planned. No `index.ts` exists in this module yet — populated by the milestones listed below._

`tenancy.module.ts` is `@Global()` — the second and last permitted (`§3.4.3`). Per
`ModuleDependency.md` §3.1 the edge `* → tenancy/` applies to **all twenty-one tenant-scoped
modules** (everything but `common/` and `audit/`), so twenty modules import the context symbols.

| Exported symbol                                                                                                         | Consumers                                                                                                                           | Milestone |
| :---------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- | :-------- |
| `TenantContext` — a discriminated union `NONE \| TENANT \| PLATFORM` (`§9.4`)                                           | All 20 tenant-scoped modules                                                                                                        | M-010     |
| `TenantId` — **branded**; a plain `string` is how isolation bugs are written                                            | All 20                                                                                                                              | M-010     |
| `TenantGuard` — refuses a `@TenantScoped()` handler when the resolved context is `NONE`                                 | Every module with controllers                                                                                                       | M-011     |
| The tenant-scoped Prisma client (`$extends` over `$allModels.$allOperations`), bound to `common/`'s `UNIT_OF_WORK_PORT` | Every `infrastructure/` directory, **only** through `TenantScopedRepository` — never directly                                       | M-010     |
| `TENANT_RESOLUTION_PORT`                                                                                                | **`iam/` only** (§3.2 edge 1)                                                                                                       | M-011     |
| `runElevated()` + `PlatformPrismaService`                                                                               | **`admin/`, `reporting/`, `settlements/`, `audit/` only** — `dependency-cruiser` fails an import from anywhere else (`AC-FND-05.3`) | M-014     |
| `MissingTenantContextError` → `TENANT_CONTEXT_MISSING`, `TenantContextAlreadySetError` → `TENANT_CONTEXT_ALREADY_SET`   | All 20; both map to HTTP **500**, never `403`                                                                                       | M-010     |
| `TENANCY_PERMISSIONS` (`tenancy.ping.read`)                                                                             | `iam/` and `admin/`, which enumerate permission constants                                                                           | M-012     |

**Why there are effectively no `controllers/` (`FolderStructure.md` §8.2).** _Exposing tenant
context over HTTP is precisely the `§11.3` failure_ — the tenant id **never** comes from the client.
An `X-Tenant-Id` header, a `?tenant_id=` query parameter or a `tenant_id` body field on any route
returns `400 TENANT_HEADER_NOT_ACCEPTED` and is logged as a security signal. What replaces a
controller is the middleware and the guard: for dashboard and admin sessions the tenant comes from
the authenticated principal; for public marketplace reads it is derived from the requested
**resource** by database lookup; for `/webhooks` it comes from the **stored** payment intent, never
the payload (`BR-PAY-05`).

> **One tension, recorded rather than smoothed over.** `FolderStructure.md` §8.2 lists `tenancy/`
> among the modules with no controller, while M-012 places
> `apps/server/src/tenancy/controllers/tenant-ping.controller.ts`. §8.1 is the governing row and it
> reads _"**Mandatory** … except `common/`, `tenancy/`, `ledger/`, `audit/`"_ — an exemption from
> _mandatory_, not a prohibition. `GET /v1/tenant/ping` is not a tenant-context API: it returns the
> caller's **own** tenant row reduced to `id`, `trading_name`, `timezone`, `status`, and it exists
> so the isolation suite has a positive control (assertion **A4**) that proves the other three
> assertions are not passing vacuously. No second route may be added on that precedent.

## 5. Consumed ports

**None.** `tenancy/`'s row in the `ModuleDependency.md` §4 matrix is `●` for `common/` and `—` for
every other column. This is structural: twenty modules import `tenancy/`, so any synchronous edge
outward would be a cycle, and — more importantly — a tenancy decision that depended on another
module's answer would mean isolation could be affected by that module being wrong or slow. The
universal `tenancy/ → common/` edge carries `Money`, the error taxonomy, `Clock`, the
`UnitOfWork` port and the correlation ALS, nothing more.

## 6. Emitted events

**None.** Not one of the fifty-two events in the `ModuleDependency.md` §8.2 catalogue is published by
`tenancy/`. Tenant status transitions are journaled to `audit_log` (`StateMachines.md` §7:
_"Journal `audit_log`"_), not to the outbox.

This has a consequence worth stating, because it is the kind of thing an engineer looks for and
fails to find: **`BR-TEN-05` — "a suspended tenant is removed from marketplace search immediately" —
is not carried by a tenant event.** It is carried by `catalog/`'s `gym.suspended`
(`gym_id`, `reason_code` → `discovery/`, `memberships/`, `notifications/`), because the thing search
indexes is a gym listing, not a tenant. A `tenant.suspended` event would give `discovery/` a second
source of truth for the same fact, which is the mistake `ModuleDependency.md` §0 **C-2** exists to
prevent.

## 7. Consumed events

**None.** `tenancy/` declares no handler. Layer L1 must be correct before any event is dispatched at
all — the dispatcher itself runs _through_ `runElevated()` — so a handler here would make the
isolation mechanism depend on the delivery mechanism it underwrites. `flag.changed` and
`config.changed` reach this module the same way they reach every other: through `common/config`,
never through a local handler (`ModuleDependency.md` §0 **C-3**).

## 8. Jobs

**`tenancy/` owns none of the twenty-four `§C5` jobs.** No entry in the `Scalability.md` §8.3
placement table names the `tenancy` queue.

Two scheduled behaviours nonetheless touch this module and are named so nobody looks for them here:

| Behaviour                                                                                                                                        | Where it actually lives                                                                                                                                                                                                                                              |
| :----------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The **production isolation canary** — a synthetic cross-tenant probe every 60 s, feeding `tenancy_isolation_canary_failures_total` and `ALRT-27` | The monitoring stack (`Monitoring.md` §5.5), not a `§C5` job. It is the only thing that catches a table shipped without a policy _after_ the migration ran, which CI cannot see while the table has no endpoint                                                      |
| `data.retention-sweep` (job 23, `admin`-parented, weekly, P4)                                                                                    | The parent fans out **one child per owning module**, each in its own queue under its own lock (`Scalability.md` §8.3). `tenancy/`'s child applies the `BR-TEN-04` soft-delete retention rule to `tenants`, retaining financial, invoice and audit records regardless |

**Delivering milestones:** **M-014** (elevation, and the elevation inventory that CI diffs against a
committed copy) · **M-018** (the harness the retention children run on) · the `admin/` band for
job 23 itself.

## 9. Top three failure modes (`NFR-MNT-09`)

Declared by `PROJECT_CONSTITUTION.md` §18.5.1. Runbook: **[`/docs/runbooks/tenancy.md`](../../../../docs/runbooks/tenancy.md)**

|  #  | Failure mode                                                 | Signal                                                                                                                                                                                                            | First action                                                                                                                                                                                                                                                                                                                                                                       |
| :-: | :----------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **`TENANT_CONTEXT_MISSING` spike**                           | `ALRT-26` — `increase(tenancy_context_missing_total[5m]) > 0`, i.e. the error occurring **at all**; equivalently `db.tenant_context_set=false` on any tenant-scoped `db.transaction` span. **S1, never silenced** | Read the `route_template` label — it names the endpoint. Establish whether this is a _missing context_ (a broken feature, loud and safe) or a _missing policy_ (a table readable across tenants for as long as the policy has been absent), because the second escalates to `ALRT-27` with a far larger blast radius. If the route is new, roll back the deploy that introduced it |
|  2  | **RLS policy missing on a new table**                        | `ALRT-27` — `db_rls_policy_count != <expected constant>`, or an isolation-canary failure. **S1, automatic rollback of the current release**                                                                       | Run the `pg_tables` × `pg_policies` cross-join to list tables carrying a `tenant_id` column with no `rls_<table>__tenant_isolation` policy. Because a possible cross-tenant exposure is a disclosure question, the client sponsor is informed **the same day**, before root cause is known                                                                                         |
|  3  | **Connection-pool saturation from interactive transactions** | `ALRT-33` — `db_pool_connections_waiting > 5` for 5 m, or in-use/max `> 0.85` for 5 m, or `db_transaction_duration_seconds` p99 `> 5 s`                                                                           | `ADR-0005`'s interactive transactions hold a connection for the whole use case, so **exhaustion arrives before latency does and takes the entire platform with it**. Find the long transactions in `pg_stat_activity`, then attribute them by the `module` span attribute. Check `ALRT-40` (polling load) as the recurring suspect before resizing anything                        |
