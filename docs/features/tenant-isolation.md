# Tenant isolation

> **`BAC-10` is a business acceptance criterion, not an internal quality measure.** It is the
> artefact handed to the penetration tester (`Security.md` §4.6), the evidence for `OBJ-07` in an
> Enterprise sales conversation, and — under the DPDP Act 2023 — the control standing between an
> ordinary coding mistake and a reportable personal-data breach.

Delivered by **M-015**. Reviewed by the Technical Lead personally; two `CODEOWNERS` approvals.

---

## 1. What it is

Four layers, and the first two are enforced by PostgreSQL rather than by application code.

| Layer | Mechanism | What it survives |
| :--- | :--- | :--- |
| **The database** | `ENABLE` + **`FORCE`** row-level security, `USING` for reads and `WITH CHECK` for writes | Every bug above it. A query with the wrong `WHERE` returns nothing rather than someone else's rows |
| **The role** | `gymmap_app` → `app_rw` only. No `BYPASSRLS`, no superuser | A connection string that leaks. The role cannot see past its policy |
| **The client** | A Prisma extension wrapping every operation in an interactive transaction that sets `app.tenant_id` **first** (`ADR-0005`) | Connection pooling. `set_config` and the query are guaranteed to be on the same connection |
| **The request** | `TenantContextMiddleware` derives the tenant from the **token**, never from a header, query parameter or body | A client that tries to choose its own tenant. Five spellings are refused in three locations |

The tenant id is **never** accepted from a client. `X-Tenant-Id`, `tenant-id`, `tenantid`,
`tenant_id` and `x-tenantid` are refused with `400 TENANT_HEADER_NOT_ACCEPTED` — rejected rather
than ignored, because a client that believes it is scoping requests should be told it is not, and
because somebody sending that header is worth a log line.

---

## 2. How it is proved

The suite is **generated**, not authored. `_inventory.generated.ts` is derived from
`openapi.json`, which is what clients are generated from; the spec iterates it. There is no list
of routes in any test file, and adding one would be the defect.

A hand-authored suite measures the diligence of whoever last added a test. A generated one
measures the system.

### The seven assertions

| # | Assertion | What it catches |
| :-: | :--- | :--- |
| **A1** | A cross-tenant read returns `404`, byte-identical to a nonexistent id | A `403`, which confirms the resource exists and turns a uuid list into a customer census |
| **A2** | A cross-tenant write leaves the row's **checksum** unchanged | *A 404 with a completed side effect is the worst possible outcome.* The status code is decoration |
| **A3** | A collection is filtered, asserted by **count** | A guard that leaks the count, the facets or the pagination total |
| **A4** | **The positive control** — a tenant reading its own data gets a non-empty `200` | The catastrophic false pass |
| **A5** | Search, reports, exports, the audit explorer, notification logs and settlement statements, **by name** | Routes that do not *look* like a resource read |
| **A6** | `app.tenant_id` is set inside the transaction and **gone after it commits** | A pooled connection carrying one request's tenant into the next |
| **A7** | With RLS **disabled**, the subset must **fail** | Without it, the other six are unfalsifiable |

### Why A4 comes first

Suppose `app.tenant_id` were globally broken — misspelled in the policy, so the predicate never
matches for anyone:

```text
A1  tenant B cannot read tenant A     ✓ passes (B reads nothing at all)
A2  tenant B cannot write tenant A    ✓ passes (B writes nothing at all)
A3  B's collection excludes A's rows  ✓ passes (B's collection is empty)
```

All green, and the system returns nothing to everybody. `TestingStrategy.md` §5.4 calls this the
**catastrophic false pass**. A4 is the assertion that distinguishes *"isolation works"* from
*"nothing works"*, and it is the one people skip.

### Why A7 exists

A1, A2 and A3 all assert that something does **not** happen — and every one of them passes on a
suite that is not reaching the database at all. A query that errors, a fixture that is missing, a
client that was never connected: each produces "no cross-tenant rows", which is what the suite
checks for.

So A7 disables row-level security and demands the suite go **red**. A green result there fails the
build with:

```text
Isolation suite passes with RLS disabled — it is not exercising the database policy
```

It runs inside a transaction that is rolled back, so a killed process leaves nothing to restore.

---

## 3. The coverage gate

`isolation-coverage` runs **before** the suite, so an uncovered route fails with a message naming
it rather than as an absent test nobody looks for.

| Gate | Fails when |
| :--- | :--- |
| **IG-1** | A `@TenantScoped()` route is absent from the inventory — *the Friday-afternoon case* |
| **IG-2** | An inventory entry names a route that no longer exists, inflating apparent coverage |
| **IG-3** | An item route has a path parameter the seed cannot fill, so its cases would silently skip |
| **IG-4** | A collection or search has a **zero** expected tenant-A count, so A4 proves nothing |
| **IG-5** | `TURBO_FORCE` is unset in CI — a cached isolation result is a result from another commit |
| **IG-6** | Satisfied upstream: a `@TenantScoped()` handler with no permission fails `api-gates` first |

The inventory is **committed**, so a regeneration that drops routes shows up as deleted lines
under `CODEOWNERS` review. A gitignored one would let coverage fall without a diff.

---

## 4. Running it

```bash
pnpm infra:up
pnpm --filter @gymmap/server db:setup
pnpm --filter @gymmap/server build

pnpm ci:isolation-coverage                     # IG-1 … IG-6, and the summary
pnpm --filter @gymmap/server test:isolation    # A1 … A7
```

Regenerate the inventory after adding a tenant-scoped route, and **read the diff**:

```bash
pnpm ci:isolation-coverage --write
```

---

## 5. Operating it

**A failing isolation gate is never re-run "to see if it passes" and never waived.**
`CI_CD.md` §0.5 marks invariant `I1` unwaivable. If the suite is wrong, the fix is forward —
correct the generator, never delete the case. If the suite is *slow*, the answer is more runner
CPU: removing job 13 from the critical path *"is not a lever; it is the failure the pipeline
exists to prevent"*.

**There is no rollback for this milestone.** Reverting it removes a merge gate rather than a
feature.

### Two numbers that should shrink

Both are printed in job 13's summary, so they are answered on every pull request rather than in
nobody's head:

- **declared exceptions** (`_exceptions.ts`) — routes with no case group, each with a reason, an
  alternative control and an owner. Currently **0**.
- **RLS exemptions** (`reference-exemption.int-spec.ts`) — tables with no policy. Currently **2**,
  both created by the toolchain.

### The production canary

Defined, not yet armed. Two synthetic canary tenants, six probed routes, a 60-second cadence, and
a `tenant_isolation_violations_total` counter that must be zero. Non-zero triggers automatic
rollback (`§5.12`, `§16.7`). Wired at the first staging deploy, not before.

---

## 6. Three defects this milestone found

Recorded because each was invisible to the tests that existed, and each explains a rule above.

| Defect | Why nothing caught it |
| :--- | :--- |
| `TenantContextMiddleware` was registered with `.forRoutes({ path: '*path' })` — Express 5 syntax on Express 4, matching **nothing**. It never ran. `X-Tenant-Id` had never actually been refused, and every `@TenantScoped()` route answered `500`. | Its 29 unit tests instantiate the class and call `use()` directly. **A unit test cannot see a registration that matches nothing** — only a request can. Hence `middleware-registration.int-spec.ts`. |
| The middleware read `request.principal`, which `JwtAuthGuard` sets — and Nest runs middleware **before** guards, so it was always `undefined`. Recorded in M-011 as a known gap deferred to M-022. | Nothing asserted over HTTP. M-015 needed a working tenant-scoped endpoint, so the fix came forward: `AccessTokenVerifier` was extracted, the middleware resolves, the guard still rejects. |
| `test:isolation` globbed `*.int-spec.ts` and `*.isolation-spec.ts`, silently excluding `dropped-policy.negative-spec.ts` — **A7 itself**. | A file that exists and is never run reports no failures. The glob is now one pattern, and `isolation-coverage.spec.mjs` asserts every spec file matches it. |
