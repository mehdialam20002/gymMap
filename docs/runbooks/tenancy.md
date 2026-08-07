# tenancy runbook

**Module:** `tenancy/` · **Layer:** L1, isolation and attribution · **Owner:** Technical Lead
**Module README:** [`apps/server/src/tenancy/README.md`](../../apps/server/src/tenancy/README.md)
**Satisfies:** `NFR-MNT-09` · **Failure modes declared by:** `PROJECT_CONSTITUTION.md` §18.5.1
**Primary alerts:** `ALRT-25`, `ALRT-26`, `ALRT-27`, `ALRT-33`

> **Status: stub.** The failure modes, signals and first actions below are derived from the
> specification and are binding. Dashboards, queries and incident history are populated by the
> milestones named in each section.
>
> **Naming note.** `Monitoring.md` §9.6 refers to this runbook as `runbooks/tenant-isolation.md`
> and works its `TENANT_CONTEXT_MISSING` section in full at §9.5. `FolderStructure.md` §8.3 requires
> the link from a module README to be `/docs/runbooks/<module>.md`, and the M-010 / M-014 file lists
> name `docs/runbooks/tenancy.md`. **This file is that runbook.** Do not create a second one under
> the other name; if a redirect stub is wanted, it points here.

---

## Scope

`tenancy/` is the structural defence of **invariant 1** — no tenant can ever read or write another
tenant's data. It resolves the tenant for every unit of work from the authenticated principal, from
the requested resource, or (for webhooks) from the **stored** payment intent — **never** from
anything the client sends. It carries that decision in `AsyncLocalStorage`, and it is the only
directory that may construct a `PrismaClient`: the mandatory `$extends` extension wraps every
operation on every model in an interactive transaction that first runs
`set_config('app.tenant_id', $1, true)` on the **same physical connection**, which is the condition
on which `A-01` (Prisma) was approved at all. It owns the `tenants` table with `FORCE`d row-level
security, and it owns `runElevated()` — the single, named, reason-bearing, audited path by which
anything may read across tenants. It also owns the `tenants.status` column of the `§C4.4` machine.

`Schema.md` §2.3.4 states this module's honest limit: **the schema converts a silent leak into a
visible error.** Almost every entry below is a variation on knowing which of the two you are
looking at.

**Dependencies.** Downward: `common/` only. Upward: twenty modules import it. External:
PostgreSQL 16 (RLS, `app_rw` / `app_platform_ro` / `app_append` / `app_migrator`), the connection
pooler — which **must run in session mode, never transaction mode** (`ADR-0004`), because a
transaction-mode pooler can hand the `SET LOCAL` and the query to different server connections.
**Owned tables:** `tenants`.
**Kill switches:** **none, by design.** `FEATURE_FLAGS.md` §2.2 forbids flagging a security control
off, and a flag that disabled tenant scoping would be the breach it is meant to prevent. Rollback of
a defective release is the only lever. Note the corollary from M-010: if the extension is found
defective *after* an endpoint has shipped, the correct response is a **forward fix with the isolation
suite red** — with RLS still forced, a defective extension fails loudly, so "the API returns 500" is
the safe state.

## Top failure modes

| # | Signal | Likely cause | First action | Escalation |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **`TENANT_CONTEXT_MISSING` spike.** `ALRT-26` — `increase(tenancy_context_missing_total[5m]) > 0`, i.e. the error occurring **at all**; equivalently `db.tenant_context_set=false` on any tenant-scoped `db.transaction` span. Users see a `500` | A new route not marked `@TenantScoped()`, a code path reaching the repository outside the middleware's ALS scope, or a job enqueued without the context copied into its payload. **Or**: a tenant-owned table shipped with no RLS policy — which presents identically and is far worse | Read the `route_template` label: it names the endpoint. Then answer the one question that sets the blast radius — **missing context, or missing policy?** Run the coverage query below. Missing context is a broken feature: loud, safe, one endpoint. Missing policy means that table has been readable across tenants for as long as the policy has been absent, and this becomes failure mode 2. If the route is new, roll back the deploy that introduced it | **S1. Never silenced.** Page primary on-call **and** the Technical Lead. `PROJECT_CONSTITUTION.md` §11 **BR2**: it is a *defect*, never a user-facing `403`, because a user should never be able to cause it |
| **2** | **RLS policy missing on a new table.** `ALRT-27` — `db_rls_policy_count != <expected constant>`, **or** `increase(tenancy_isolation_canary_failures_total[10m]) > 0` from the 60-second production synthetic cross-tenant probe | A migration added a table with a `tenant_id` column and no `rls_<table>__tenant_isolation` policy. **CI cannot see this** while the table has no endpoint — and will see it very clearly the day it gets one. A close variant: a new `audit_log` partition created without inheriting policy and grants (`CI-10`) | **Automatic rollback of the current release** is the configured response; confirm it happened. Then run the `pg_tables` × `pg_policies` cross-join to enumerate every table with a `tenant_id` column and no policy, and check whether any endpoint has served it. Also verify the policy uses `current_setting('app.tenant_id')` with **no** `missing_ok` argument — a permissive policy is how this becomes failure mode 3's silent version | **S1.** Page on-call, Technical Lead **and** the security owner **simultaneously** — one of only three alert families where parallel notification is mandatory. **The client sponsor is informed the same day**, before root cause is known, because possible cross-tenant exposure is a disclosure question, not only an engineering one. Postmortem mandatory regardless of impact |
| **3** | **Connection-pool saturation from interactive transactions.** `ALRT-33` — `db_pool_connections_waiting > 5` for 5 m, in-use/max `> 0.85` for 5 m, `db_transaction_duration_seconds` p99 `> 5 s`, or `increase(db_deadlocks_total[15m]) > 3` | `ADR-0005`'s interactive transactions hold a connection for the whole use case, so a slow external call or an over-broad unit of work inside a transaction consumes the pool. Recurring suspects: polling load (`ADR-0010`, check `ALRT-40`), a nested transaction, an N+1 inside a `$transaction` | Query `pg_stat_activity` for long-running transactions, then attribute them by the `module` span attribute on `db_transaction_duration_seconds`. **Exhaustion arrives before latency does and takes the whole platform with it**, so treat a rising `waiting` count as the leading indicator, not the p99. Verify the pooler is in **session mode** before resizing anything | **S1** if check-in or payment routes are affected, otherwise S2. Page on-call; Technical Lead if a schema or index change is implicated |

**The alert that is not a failure mode, and outranks all three.** `ALRT-25` —
`tenant_isolation_violations_total > 0`, **any** increment ever, or
`tenancy_cross_tenant_denied_total > 0` in production (expected in CI, alarming in production). One
confirmed cross-tenant read is a notifiable event and a simultaneous contract breach with every
tenant. Pull the `correlation_id` from the violation log line — **not** from the metric — open its
trace, check `db.tenant_context_set` on every `db.transaction` span, and identify the route and the
two tenants from the log. Consider immediate rollback if it correlates with a deploy.

## Dashboards and queries

_To be populated by **M-010** (the extension and its pool arithmetic against `OQ-18` volumes),
**M-014** (the elevation inventory) and **M-015** (the generated isolation suite)._ The intended
content:

- **Isolation panel:** `tenant_isolation_violations_total` (must be a flat zero line — its shape *is*
  the signal), `tenancy_context_missing_total` by `route_template`,
  `tenancy_cross_tenant_denied_total`, `tenancy_isolation_canary_failures_total`,
  `db_rls_policy_count` against the expected constant.
- **RLS coverage query** (`IS6`, `apps/server/test/isolation/rls-coverage.sql`): every table carrying
  a `tenant_id` column cross-joined against `pg_policies`, minus the committed, reason-annotated
  exemption list — of which `user_roles` is the single reviewed entry.
- **Same-connection proof:** the `PX-1` assertion as a production probe — `pg_backend_pid()`
  captured beside the `set_config` and beside the query must be identical.
- **Pool panel:** `db_pool_connections_waiting`, in-use/max, `db_transaction_duration_seconds` p99
  **by `module`**, `db_deadlocks_total`, alongside `ALRT-40` polling load.
- **Elevation inventory:** `tenancy_platform_elevations_total` by `reason_class`, read next to the
  CI-emitted inventory of every `runElevated` call site with its permission and scope, diffed
  against `_elevation-inventory.committed.json`. **Growth in that file is the signal**; it requires
  two `CODEOWNERS` approvals on `apps/server/src/tenancy/**`.
- **Elevation audit query:** `audit_log` filtered to rows carrying `permission` and
  `elevation_scope`, which `runElevated()` writes **before** the work begins (`PE2`).

## Known incidents

_None yet._

---

## M-010 · The Prisma tenant-context extension — operational notes

Added when the extension landed. These are the failure modes it introduces.

### 1 · Pool exhaustion under interactive transactions

**Signal.** p95 latency climbs on every endpoint at once; `pg_stat_activity` shows many rows in
`idle in transaction`; Prisma raises `Timed out fetching a new connection from the pool`.

**Why this module causes it.** Every tenant-scoped operation opens an INTERACTIVE transaction,
which pins one pooled connection for its whole body — not just for the query. A slow external
call inside a transaction holds a connection for its entire duration. This is the cost of
ADR-0005, accepted deliberately: the alternative is a session-level `SET` that a pooled
connection carries into the next request.

**First action.**

```sql
SELECT pid, state, now() - xact_start AS age, query
FROM pg_stat_activity
WHERE datname = 'gymmap' AND state = 'idle in transaction'
ORDER BY age DESC LIMIT 20;
```

Anything older than the 10 s transaction timeout is a leak, not load.

**Escalation.** If every age is short, this is genuine load — raise the pool. If one query
dominates, it is holding a connection across an `await` it should not.

### 2 · `TENANT_CONTEXT_MISSING` storm

**Signal.** A run of 500s carrying `TENANT_CONTEXT_MISSING`, usually on one route or one job.

**Read the code before the database.** This error means the server reached a query without
knowing whose data it was about. It is never caused by user input and cannot be provoked by a
caller — which is why it is a 500 that pages someone rather than a 403 a dashboard absorbs.

**Three causes, in order of likelihood.**

1. A route that skipped `TenantContextMiddleware` — check the module's middleware registration.
2. A background job that ran outside `runWithTenant()`.
3. An async boundary that escaped the `AsyncLocalStorage` frame: a `setTimeout`, an un-awaited
   promise, or an `EventEmitter` listener registered inside a request and fired outside it.

**Do not "fix" it by relaxing the RLS policy.** The error is the system refusing to run an
unscoped query. A permissive policy converts this loud failure into a silent one that returns
another tenant's rows.

### 3 · Transaction timeout tuning

**Signal.** `Transaction already closed` or `Transaction API error` in logs.

The 10 s default is a POOL-PROTECTION control (`TR-37`), not a performance setting. Raising it
trades one problem for a worse one: a longer timeout means a stuck transaction holds its
connection longer, so the pool exhausts sooner under the same fault.

**First action.** Find what the transaction is waiting on. Work that legitimately needs more
than 10 s does not belong inside one.

### The two configuration facts that are not in this repository

| Fact | Enforced by | Why it matters here |
| :--- | :--- | :--- |
| The pooler runs in **session mode**, never transaction mode | M-005 compose, Terraform | `ADR-0004`. A transaction-mode pooler can hand the `set_config` and the query to different server connections — `PX-1`'s failure with a different actor. No application code defends against it. |
| The application connects as `gymmap_app`, never a superuser | Terraform · `pnpm db:setup` | A superuser bypasses RLS entirely. `FORCE` lifts the exemption for the table OWNER and does nothing about superusers, so an app connected as `postgres` has RLS in its schema and none at runtime. This was a real gap, found by M-010's own test. |
