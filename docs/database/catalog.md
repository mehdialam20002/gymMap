# `catalog` — the tenant's physical footprint, as it is actually built

**Milestone:** `M-031` · **Tables:** `gyms`, `branches`, `gym_amenities` · **Seed:** `v0.6`
**Task:** `T-04.02` (`Epic_04.md`), a `§23.1` Definition-of-Ready artefact

---

## 0. What this file is for, and what it deliberately does not repeat

`Schema.md` §5 specifies these three tables. `Indexes.md` §11 specifies their indexes.
`Constraints.md` specifies their checks. `Relationships.md` specifies their foreign keys. Restating
any of that here would create a fourth copy of a specification, and a fourth copy is how two of them
end up disagreeing — the failure this repository has now recorded four times (`TD-048`, `TD-049`,
`dependency-approval.mjs`'s allowlist, `openapi:emit`'s placeholder map).

So this file holds only what **no other file holds**:

| §   | Contents                                                                     |
| :-- | :--------------------------------------------------------------------------- |
| 1   | The gap between what `Indexes.md` specifies and what the database has        |
| 2   | The `EXPLAIN (ANALYZE, BUFFERS)` baseline required by `IX3` and `M-031 AC-2` |
| 3   | The seed payload at `v0.6`, and why each row is the row it is                |
| 4   | The queries the module issues, and which index serves each                   |

Where this file and a specification disagree, **the specification wins** and this file is wrong and
should be corrected. It is a record of measurement, not a source of requirement.

---

## 1. Indexes — specified, shipped, and the three that were neither

`Indexes.md` §11 gives `branches` six index rows. `20260810120000_expand_create_branches` built
three. The other three were not recorded anywhere as skipped, which `CLAUDE.md` §9.6 forbids on its
own — *"Nothing is silently dropped."*

| `Indexes.md` row               | Columns              | Status                                                       |
| :----------------------------- | :------------------- | :----------------------------------------------------------- |
| `gix_branches__location`       | `location` GiST      | ✅ shipped at M-031                                           |
| `uq_branches__gym_id__primary` | `gym_id` partial     | ✅ shipped as **`uq_branches__one_primary_per_gym`** — `TD-050` |
| `idx_branches__city_id_status` | `city_id, status`    | ✅ shipped as **`idx_branches__city_status`** — `TD-050`       |
| `uq_branches__tenant_id_id`    | `tenant_id, id`      | ➕ added `20260811000000`                                     |
| `idx_branches__tenant_id_gym_id` | `tenant_id, gym_id` | ➕ added `20260811000000`                                     |
| `idx_branches__locality_id`    | `locality_id`        | ➕ added `20260811000000`, partial on `IS NOT NULL`           |

**How the three were found.** Not by re-reading `Indexes.md`. By running `EXPLAIN` against the
branch-list query `M-031` ships, seeing a sequential scan, and then going to the document to ask
whether an index had been specified and skipped or never specified at all. It had been specified —
and one of the three, `idx_branches__tenant_id_gym_id`, carries the purpose *"`WHERE tenant_id=$1
AND gym_id=$2` — `SCR-DASH-004`"*, which is the exact route that had just been built with nothing to
serve it.

**Two names diverge and were deliberately left alone.** Both have the right columns, predicate and
uniqueness; only the label differs from the document. Renaming is a `DROP`/`CREATE` on a constraint
that `AC-3`'s three assertions name directly, for no behavioural gain. `TD-050`.

---

## 2. The `EXPLAIN` baseline

`Scalability.md` **`IX3`**: *"Every PR that adds a query to a tenant-owned table attaches the
`EXPLAIN (ANALYZE, BUFFERS)` output against the `§C8.2` seed grown to `NFR-SCAL-01` volumes."*
`M-031` **`AC-2`** additionally requires the `ST_DWithin` plan *"committed as a CI baseline"*.

Measured **2026-08-11** against PostgreSQL 16 + PostGIS 3.4.3 with **20,000 branches** across 2,000
gyms and 200 tenants, every measurement inside a transaction that was rolled back. `COSTS OFF,
TIMING OFF` so the committed plan is stable across machines — the SHAPE is the baseline, not the
milliseconds.

### 2.1 The measurement that matters most, and why it was almost missed

The first pass ran as `postgres`, for which RLS does not apply. Under that role the branch-list
query's index scan touched **39 buffers**; under `app_rw` with `app.tenant_id` set it touches **2**.

```text
::: GET /v1/tenant/branches — unfiltered first page, AS app_rw, RLS in force
Limit (actual rows=51 loops=1)
  Buffers: shared hit=15
  ->  Sort (actual rows=51 loops=1)
        Sort Key: name, id
        Sort Method: quicksort  Memory: 32kB
        ->  Bitmap Heap Scan on branches (actual rows=100 loops=1)
              Recheck Cond: (tenant_id = (current_setting('app.tenant_id'::text))::uuid)
              Filter: (deleted_at IS NULL)
              Heap Blocks: exact=13
              ->  Bitmap Index Scan on idx_branches__tenant_id_gym_id (actual rows=100 loops=1)
                    Index Cond: (tenant_id = (current_setting('app.tenant_id'::text))::uuid)
                    Buffers: shared hit=2
```

**This is why `Indexes.md` puts `tenant_id` first.** The repository never writes
`where: { tenantId }` — §11.5 `BR5` forbids it, and `Scalability.md` §5.4 restates that the rule *"is
about the index, not about the query"*. RLS supplies the predicate, so the leading column is present
on **every** query against this table whether or not the caller filtered by anything. An index led by
`gym_id` would be unusable for the default request.

It also means **any performance measurement taken as a superuser understates these indexes**, and a
benchmark run that way would conclude the leading column is wasted. Measure as `app_rw`.

### 2.2 The rest of the module's queries

| Query                                     | Plan at 20,000 rows                              | Index                            |
| :---------------------------------------- | :----------------------------------------------- | :------------------------------- |
| `list()` filtered by one `gym_id`         | Bitmap Heap Scan, 10 rows, 49 buffers            | `idx_branches__tenant_id_gym_id` |
| `activeInGym()`                           | Bitmap Heap Scan → Sort, 10 rows                 | `idx_branches__tenant_id_gym_id` |
| `gymOf()` / `findInGym()` by id           | **Index Scan**, 3 buffers                        | `branches_pkey`                  |
| tenant-wide scan (composite-FK referent)  | Bitmap Heap Scan, 100 rows, 14 buffers           | `idx_branches__tenant_id_gym_id` |

The tenant-wide scan chooses `idx_branches__tenant_id_gym_id` over `uq_branches__tenant_id_id`
because both lead on `tenant_id` and the planner prefers the narrower one. `uq_branches__tenant_id_id`
is not redundant: it exists so `plan_branches`, `attendance`, `staff_branches` and `leads` can declare
a composite `(tenant_id, branch_id)` foreign key at all — Postgres requires a **unique** index on the
referenced columns, and the other one is not unique.

### 2.3 `AC-2` — `ST_DWithin` and the k-NN order

Requirement: *"`EXPLAIN` on `ST_DWithin(location, $1, $2)` shows `gix_branches__location` in use with
no sequential scan."* Coordinates spread across India (68–98 E, 8–36 N) so a 3 km radius is genuinely
selective.

```text
::: ST_DWithin — 3 km around Pune
Index Scan using gix_branches__location on branches (actual rows=0 loops=1)
  Index Cond: (location && _st_expand('…'::geography, '3000'::double precision))
  Filter: ((deleted_at IS NULL) AND st_dwithin(location, '…'::geography, '3000', true))
  Buffers: shared hit=4

::: ORDER BY location <-> $centre LIMIT 20   (Scalability.md §6.2)
Limit (actual rows=20 loops=1)
  ->  Index Scan using gix_branches__location on branches (actual rows=20 loops=1)
        Order By: (location <-> '…'::geography)
        Buffers: shared hit=88
```

**`AC-2` is satisfied.** No sequential scan, and the k-NN ordering rides the same index — *"one index,
four features"*, as `Indexes.md` row 400 puts it.

Note the `Index Cond` is `&& _st_expand(…)`, not `ST_DWithin` itself: the GiST index answers a
bounding-box question and `ST_DWithin` re-checks the survivors as a `Filter`. That two-stage shape is
correct and is what makes the `geography` type's metre semantics affordable.

### 2.4 What is NOT baselined, and why

- **`ORDER BY name ASC, id ASC` is a Sort, not an index scan.** No index on `(name, id)` exists and
  `Indexes.md` specifies none. At ≤10 branches per tenant — the figure `Indexes.md` row 404 itself
  gives — sorting ten rows after an index scan of ten rows is free, and an index on `name` would be
  written on every branch rename to save nothing. Revisit if a tenant ever holds hundreds.
- **Anything on `gyms`.** `M-032` owns the gym read paths; this milestone's queries reach `gyms` only
  through `statusOf()` and `timezoneFor()`, both single-row lookups on the primary key.

---

## 3. Seed `v0.6` — three gyms, five branches, ten amenity claims

`prisma/seed/catalog.ts`. The payload was **already described** by `tenants.ts`, which has carried
these three sentences since `M-009` while no seed wrote a single catalogue row:

| Tenant     | `tenants.ts` note                                              | What v0.6 gives it                          |
| :--------- | :-------------------------------------------------------------- | :------------------------------------------ |
| `TENANT_A` | *"Single branch, the ordinary case."*                          | Iron Temple Andheri, Mumbai — 1 branch      |
| `TENANT_B` | *"Multi-branch."*                                              | Peak Performance Pune — 3, one `INACTIVE`   |
| `TENANT_C` | *"Suspended, so `BR-GYM-01` visibility can be tested."*        | Summit Strength, Bengaluru — `SUSPENDED`    |

Four properties are deliberate rather than incidental:

1. **Reference rows are joined by business key.** `city_id`, `category_id` and `amenity_id` are
   `(SELECT id FROM … WHERE slug = …)` subselects, never pasted uuids. `TD-041` is exactly the failure
   that prevents: the dev database holds reference rows under a pre-`ADR-0038` namespace, so derived
   ids in code no longer match ids in the database. A subselect survives a re-seed, and a missing
   reference row yields `NULL` into a `NOT NULL` column — a loud failure rather than a dangling id.
2. **Two different GST state codes.** `27` Maharashtra and `29` Karnataka. A place-of-supply bug that
   hardcodes one state passes every fixture where all branches share a state.
3. **Kharadi is `INACTIVE` and NOT soft-deleted.** A real deactivation sets both; splitting them here
   lets a suite distinguish *"the list keeps INACTIVE"* from *"the list drops soft-deleted"* without
   performing a deactivation first. Its `capacity` is `NULL` — a nullable column with an actual null
   in it, which is the only way to catch a mapper that assumes otherwise.
4. **Summit is 734 km from Koregaon Park**, measured with `ST_Distance` against these exact rows. It
   is the negative half of the geography-versus-geometry pair: a 3 km radius around Pune must return
   zero for it, and `ST_DWithin(geometry, …, 3000)` reads 3,000 as **degrees** and matches everything
   on Earth. A positive-only test passes under either type and proves nothing.

`Milestones_030-059.md` asks for *"coordinates inside Bengaluru and Pune"*. Mumbai is used for Iron
Temple instead of a third Pune address because `branch-deactivation.int-spec.ts` already fixtures
"Andheri" at Mumbai's coordinates, and three distinct cities give the `M-042` radius tests three
centres rather than two.

---

## 4. Queries the module issues

| Method                          | Route                          | Reads              | Index                            |
| :------------------------------ | :----------------------------- | :----------------- | :------------------------------- |
| `list(query)`                   | `GET /v1/tenant/branches`      | `branches`         | `idx_branches__tenant_id_gym_id` |
| `byId(id)`                      | `GET …/branches/:id`           | `branches`         | `branches_pkey`                  |
| `gymOf(id)`                     | `PATCH`, `DELETE …/:id`        | `branches`         | `branches_pkey`                  |
| `findInGym(gymId, branchId)`    | internal + `BRANCH_QUERY_PORT` | `branches`         | `branches_pkey`                  |
| `activeInGym(gymId)`            | deactivation policy input      | `branches`         | `idx_branches__tenant_id_gym_id` |
| `create(branch)`                | `POST /v1/tenant/branches`     | writes `branches`  | —                                |
| `update(id, patch)`             | `PATCH …/:id`                  | writes `branches`  | `branches_pkey`                  |
| `deactivate(id, promoteTo)`     | `DELETE …/:id`                 | writes, one txn    | `uq_branches__one_primary_per_gym` |
| `statusOf(gymId)`               | deactivation + `ordering/`     | `gyms`             | `gyms_pkey`                      |
| `timezoneFor(gymId)`            | `memberships/` later           | `gyms` → `tenants` | `gyms_pkey`                      |

Two of them carry a property no index expresses:

- **`create()` binds `state_code` with no `::char(2)` cast.** `'291'::char(2)` is `'29'` *silently*;
  `INSERT '291'` into a `char(2)` column is *"value too long"*. `state_code` decides CGST + SGST versus
  IGST on every future invoice for a sale at this branch, `'29'` is a real state, and
  `ck_branches__state_code_shape` passes the truncated value. See
  `test/isolation/branch-write.int-spec.ts`.
- **`deactivate()` is two statements in ONE transaction.** `uq_branches__one_primary_per_gym` is a
  partial unique index: promote first and two primaries exist momentarily, which the index refuses;
  demote first and a crash between the two leaves a gym with none, which nothing refuses.
