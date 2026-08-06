# discovery

**Charter (`MASTER_PRD.md` §C1.3).** `search, ranking, comparison, favourites, SEO surfaces` — the
read side of the marketplace, and the only surface a stranger ever sees.

---

## 1. Bounded context

Owns the answer to **"which gyms may a stranger see, in what order, and what does the screen say when
the answer is none"**. The first of those is invariant 4 and it is the reason this module is shaped
the way it is. `FR-SRCH-09` — _only `APPROVED`, non-suspended gyms with ≥1 published public plan
appear_ — is **not** enforced as a `WHERE` clause. It is enforced by **what enters the projection**:
a row exists in `search_documents` only while all five conditions of `Search.md` §7 hold, and
`Scalability.md` **`SC-R10`** makes that row's existence the single enforcement point. A predicate
omitted by mistake leaks an unverified listing into public search, which is `RSK-01`; a row that was
never written cannot leak. That is the whole design, and it is why §7 of this file is load-bearing
rather than administrative.

The second owned decision is **order**. `FR-SRCH-10`'s six factors — distance, Bayesian-adjusted
rating, freshness, conversion, featured, completeness — are combined by a weighted expression over
**at most 500 candidates** (`SR3`), never by an index, because the weights are configuration and an
expression index would silently stop being used the moment one changed. The index narrows; the
expression orders.

The third is **the zero-result state**, which `FR-SRCH-12` makes a product feature rather than an
empty array: name the single most restrictive filter, with the count that removing it would recover.

What this module deliberately does **not** own: the rating (it arrives inside `catalog/`'s read
model), the price (it arrives from the pricing authority in `plans/`), and approval (a human decision
in `onboarding/`). Everything in `search_documents` is derivable from tables owned elsewhere —
**nothing here is a source of truth** — which is what makes M-042's drop-and-rebuild a supported
operation for the life of the product.

## 2. PRD identifiers

| Class            | Identifiers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| :--------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional       | `FR-SRCH-01` … `FR-SRCH-15`; `FR-DETL-01` … `FR-DETL-11`; `FR-FAV-01` … `FR-FAV-05`. `FR-SRCH-14`/`FR-FAV-05` (saved-search alerts) are descoped **D-08** for Phase 1                                                                                                                                                                                                                                                                                                                         |
| Business rules   | **`BR-GYM-01`** (invariant 4, owner `catalog/` + `discovery/`), `BR-TEN-05` (suspension removes the listing, owner `tenancy/` + `discovery/`), `BR-TEN-06` (`PAST_DUE` beyond 7 days), `BR-PLN-05` (a `STAFF_ONLY` plan on no public surface, owner `plans/` + `discovery/`), `BR-PLN-03` (invariant 3 — the projection carries a _display_ price only), `BR-REV-07` (the three-review display floor, owner `reviews/` + `discovery/`), `BR-DAT-06` (no personal datum in an analytics event) |
| Non-functional   | **`NFR-PERF-01`** (p95 ≤ 500 ms, p99 ≤ 1,000 ms), `NFR-PERF-02` (detail LCP ≤ 2.5 s on 4G), `NFR-PERF-09` (2,000 searches/min sustained), `NFR-PERF-10`, `NFR-SCAL-02` (10× without re-architecture), `NFR-SCAL-04` (search never contends with writes), `NFR-AVL-03` (loss of maps or indexing must not stop purchase or check-in), `NFR-PRV-01`, `NFR-MNT-09`                                                                                                                               |
| State machine    | **None.** `§C4` declares eight machines and none belongs here. `search_documents` has a `status` column, but it is a _computed visibility flag_ (`SC-R10`), not a lifecycle — nothing transitions it, events recompute it                                                                                                                                                                                                                                                                     |
| `§C5` jobs       | **`search.reindex`** (job 15). See §8                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Screens          | `SCR-WEB-001` (home), `SCR-WEB-002` (search results), `SCR-WEB-003` (gym detail), `SCR-WEB-004` (comparison), `SCR-WEB-012` (favourites); `SCR-ADM-011` (the ranking weight configuration)                                                                                                                                                                                                                                                                                                    |
| Acceptance       | `AC-SRCH-01.1` … `-01.3`, `AC-SRCH-02.1` … `-02.3`, `AC-DETL-01.1` … `-01.3`, `AC-DETL-02.1`, `AC-FAV-01.1` … `-01.3`                                                                                                                                                                                                                                                                                                                                                                         |
| Epic / E2E / KPI | `EP-06` · `E2E-02` · `KPI-09` (search→detail ≥ 45%), `KPI-23` / `SLO-02` (search p95) · `RSK-01`, `RSK-11`                                                                                                                                                                                                                                                                                                                                                                                    |

`FR-DETL-02`/`-03`'s plan cards and the public plan catalogue (`GET /v1/gyms/:slug/plans`) are
**`plans/`** requirements, not this module's: the price on them must come from the authority, not from
a projection. This module composes the detail page around them.

## 3. Owned tables

_Planned. No code in this module yet - populated by the milestones listed below._

| Table              | Notes that matter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `search_documents` | **Tenancy class `GLOBAL`, no RLS policy, grant class `G-REF`** — `SELECT` to `app_rw`, writes to the projection role only. The exemption is argued in the migration header, not assumed: the table holds only publicly-visible listings, and `tenant_id` is present for invalidation and click-through and is **explicitly not an RLS key** (`Schema.md` §13.4). `RLS ENABLE` "for safety" here would make every unauthenticated search require a tenant context that does not exist, and the fix under time pressure would be `BYPASSRLS` — `P9`'s worst outcome. One row per publicly-visible **branch**, not per gym. `hours_bitmap` is `bit(336)` (7 days × 48 half-hours) so `open_now` is a mask test rather than a join to `branch_hours`. `rating_bayes` is **stored and never returned by any endpoint** — the plain mean displays, the Bayesian figure ranks. `projected_at` exists because `BR-PLN-03` governs this table absolutely: `min_price_minor` is a _display_ figure and a lagging document is invalidated rather than served |
| `favourites`       | RLS `P-STD` · **G-CRUD-D** (a hard delete is the correct domain operation) · `uq_favourites__user_gym`. The asymmetry that catches people: the **list crosses tenants**, so `GET /me/favourites` runs under the `app_platform_ro` elevation filtered on `user_id` and re-composes the visibility predicate **per row** — a suspended gym is _labelled unavailable_, not dropped (`AC-FAV-01.3`). The two mutations resolve the tenant **from the resource** and run `SET LOCAL app.tenant_id` inside the write transaction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `saved_searches`   | Tenancy class **`IDENTITY`** — RLS not enabled, **no `tenant_id` column exists**. Scoped by `user_id` behind an ownership guard. Classing it RLS would be the `/me/memberships` bug of `Schema.md` §1.3. G-CRUD-D; `query jsonb` is one of the thirty-one sanctioned JSONB columns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

**Not owned:** `gyms`, `branches`, `branch_hours`, `gym_media`, `gym_amenities` (→ `catalog/`);
`plans`, `plan_branches` (→ `plans/`); `reviews` (→ `reviews/`). Also not owned, and read through
`common/`'s `ReferenceDataRepository` rather than by importing `admin/` (`ModuleDependency.md`
§0 C-3): `cities`, `localities`, `amenities`, `gym_categories`, `countries`.

The six indexes on `search_documents`, all created `CONCURRENTLY` per `MG4`:
`gix_search_documents__location` (GiST), `gin_search_documents__search_tsv`,
`gin_search_documents__name_trgm` and `gin_search_documents__locality_trgm` (both `gin_trgm_ops`),
`gin_search_documents__amenity_ids`, and the scalar composite
`idx_search_documents__city_price_rating`. `IX4` warns that a trigram index is frequently **larger
than the data it indexes**; the three here are measured and recorded in
`docs/database/indexes-observed.md`, and a fourth needs a size estimate in the PR.

**Delivering milestones:** M-042 (`search_documents`, the six indexes), M-045 (`search_tsv` as a
generated column plus `gin_localities__name_trgm`), M-050 (`favourites`). **`saved_searches` has no
delivering milestone** — `FR-SRCH-14` is descoped `D-08`.

## 4. Public surface

_Planned. No code in this module yet - populated by the milestones listed below._

`discovery/` is not one of the four provider-only modules of `FolderStructure.md` §8.2, so
`controllers/`, `dto/` and `permissions.ts` are mandatory. Its shape is nevertheless unusual, and the
`ModuleDependency.md` §4 matrix says why: down the `dsc` **column**, `catalog/` and `plans/` are `▲`
(event only), every other module is `—`, and `admin/` alone is `●`. **Nothing imports this module's
`index.ts` except `admin/`.** `discovery/` is a leaf — L4 rank 0, the module ADR-0003 calls _"the
cleanest extraction seam"_ — so its public surface is almost entirely HTTP rather than ports.

| Surface                                          | Auth                          | Notes                                                                                                                                                                                                 |
| :----------------------------------------------- | :---------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/search/gyms`                            | `@Public()`                   | Rate class `RL-SEARCH`; `Cache-Control: public, max-age=60, stale-while-revalidate=120`; `.strict()` query schema — a typo'd `amenties=` is a `400` naming it, never a silently unfiltered result set |
| `GET /v1/search/suggest`                         | `@Public()`                   | p95 ≤ **150 ms**, tighter than `NFR-PERF-01` because it fires per keystroke past a 150 ms debounce                                                                                                    |
| `GET /v1/gyms/:slug`                             | `@Public()`                   | The twelve `B6` regions from **one** query plan; `listing_state` carries the `FR-DETL-11` previously-live case as a `200`, never a `404`                                                              |
| `POST /v1/compare`                               | `@Public()`                   | Up to four gyms, explicit absence rather than blank cells; every candidate re-checked against the visibility predicate                                                                                |
| `GET`/`POST`/`DELETE /v1/me/favourites[/:gymId]` | Authenticated                 | `POST` takes **no body** (`Marketplace.md` §1.2 finding 1)                                                                                                                                            |
| `/v1/me/saved-searches`                          | Authenticated                 | Contract exists; `D-08` descoped                                                                                                                                                                      |
| `PUT /v1/admin/config/ranking`                   | `admin.config.ranking.update` | Reason required, audited, one-click revert; gated by the `TR-22` golden-set evaluator                                                                                                                 |

Permission strings owned here (`apis/Marketplace.md` §11): `discovery.favourite.list`, `.create`,
`.delete` · `discovery.saved_search.list`, `.create`, `.delete` · `discovery.gym.report`. Every
`@Public()` route carries the decorator **by declaration** so the `FR-RBAC-01` CI check sees a
decision rather than an omission — this is the only permission-free route class in the system, and
each route is registered in `TestingStrategy.md` §5.5's non-tenant-scoped register with its written
justification and its **negative** assertion: a suspended tenant's gym returns zero rows (`IS4`).

`is_favourited` is `null` server-side for **every** caller, authenticated or not, so one cached
response serves everyone and no public payload varies on `Authorization` (`ET6`). Adding the field
later is forbidden: it would be an additive change that silently invalidates every edge cache.

> **Conflict, recorded not resolved.** `apis/Marketplace.md` §2.3 requires _one shared
> `PublicVisibilityPredicate` … used by every public read path: search, map bounds, category and city
> landing pages, comparison, favourites, sitemap, structured data_, and M-042 places it at
> `discovery/domain/public-visibility.predicate.ts`. But the public plan catalogue lives in `plans/`
> (that module's README §4), and `plans → discovery` is **▲** (event only) in the §4 matrix, so
> `plans/` cannot import it. `ModuleDependency.md` §7.1 separately forbids exporting a domain value
> object from `index.ts`. The shape that satisfies both is the alternative Marketplace.md §2.3 already
> names in its own comment — **`packages/types`** — with `discovery/` composing it rather than owning
> it. One owner decision in `DECISION_LOG.md` before M-042 begins; a predicate that exists twice is
> the exact failure invariant 4 is guarding against.

**Delivering milestones:** M-042 (`index.ts`, `permissions.ts`, the predicate), M-044
(`/v1/search/gyms`), M-045 (`/v1/search/suggest`), M-046 (filters and facets), M-049 (the ranking
configuration route), M-050 (detail, comparison, favourites).

## 5. Consumed ports

_Planned. No code in this module yet - populated by the milestones listed below._

| Provider   | Port                                                                                                                                                                                                          | Why the answer must be synchronous                                                                                                                                                                                                |
| :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog/` | `GYM_SEARCH_VIEW_PORT`                                                                                                                                                                                        | The approved-gym read model, **carrying the rating projection** (edge 12, `BR-GYM-01`, `FR-SRCH-01`). Consumed by the projection composer, not by the request path                                                                |
| `plans/`   | `PLAN_SUMMARY_PORT`                                                                                                                                                                                           | The "from ₹X" price and the monthly equivalent on a result card must be the authority's figure, not local arithmetic (edge 13, `BR-PLN-03`, `FR-SRCH-06`)                                                                         |
| `common/`  | `Money`, `Clock`, `IdGenerator`, the outbox port, the opaque cursor codec, the `RL-SEARCH` rate-limit registry entry, and `ReferenceDataRepository` for `cities`, `localities`, `amenities`, `gym_categories` | Universal edge                                                                                                                                                                                                                    |
| `tenancy/` | `TenantContext` and the tenant-scoped client — **for the favourites write path only**                                                                                                                         | The search path deliberately runs through **`PublicPrismaService`** with no `SET LOCAL` at all. At 2,000 searches/min that saves ≈3,000 round trips per minute, and it is why marketplace search is cheap (`Scalability.md` §5.6) |
| `audit/`   | `AUDIT_WRITE_PORT`                                                                                                                                                                                            | Universal edge. A ranking weight change is reason-required and audited before/after (`BR-DAT-01`, `TR-22`)                                                                                                                        |

**Not consumed, and each absence is the design.** `discovery/ → reviews/` is **`—`** — not even an
event. A rating reaches this module inside `catalog/`'s gym read model, because two sources of a
rating is precisely how a search card shows 4.6 and the detail page shows 4.4 (`ModuleDependency.md`
§0 C-2, §11.2). `discovery/ → iam/` is **`—`**: this module never asks who the caller is, which is
the same property that makes `is_favourited` server-side `null`.

External dependencies: **`DEP-02`** maps and geocoding, and only as a **client-side tile layer**.
Geocoding on address save belongs to `catalog/` and, per `Architecture.md` §1.3, is _"never on the
search path"_. That is why the `NFR-AVL-03` degradation is free rather than engineered: the list is a
SQL query and the map is somebody else's tiles (`Architecture.md` §10.1).

> **Port-name discrepancy.** `ModuleDependency.md` §3.2 edge 13 and the `plans/` README both name
> **`PLAN_SUMMARY_PORT`** as this module's plan edge; M-043 acceptance criterion 8 names
> **`PLAN_PRICING_PORT`** (whose declared consumer is `ordering/`). The edge list is the higher
> authority and is followed here. Either way the binding half is unchanged: `lowest_monthly_equiv_minor`
> comes from M-039's `monthlyEquivalent()` through a port, or the marketplace and checkout will
> disagree about what a ₹18,000 annual plan costs per month.

**Delivering milestones:** M-042, M-043 (the composition edges), M-044.

## 6. Emitted events

_Planned. No code in this module yet - populated by the milestones listed below._

**No domain event.** Not one of the fifty-two rows in `ModuleDependency.md` §8.2 names `discovery/` as
a publisher, and that follows from the module's position: it is a read side. Nothing downstream may
learn a fact from search that it could not learn from the tables search projects.

The §4 matrix nevertheless marks `discovery → notifications` and `discovery → reporting` as **▲**.
Those two arrows are the **`§C6` analytics stream**, emitted server-side through the outbox (M-047):

| `§C6` Discovery event                                                                                   | Key properties                                                                                           | Note                                                                                         |
| :------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| `search_performed`                                                                                      | `query`, precision-reduced `lat`/`lng`, `radius_m`, `filters`, `sort`, `result_count`, `ranking_version` | Denominator of `KPI-09`                                                                      |
| `search_filter_applied`                                                                                 | `filter_name`, `filter_value`, `result_count_before`, `result_count_after`                               | Counts are **server-supplied**; a client cannot compute a counterfactual                     |
| `search_zero_results`                                                                                   | `filters`, `most_restrictive_filter`                                                                     | Feeds `search_zero_results_total{most_restrictive_filter}` and the `ALRT-36` zero-result leg |
| `search_result_clicked`                                                                                 | `gym_id`, `position`, `is_featured`                                                                      | Numerator of `KPI-09`                                                                        |
| `map_area_searched`                                                                                     | `bounds_area`, `result_count`                                                                            | `FR-SRCH-08` bounds search                                                                   |
| `gym_detail_viewed` · `gym_gallery_opened` · `plan_viewed`                                              | `gym_id`, `source` / `photo_index` / `plan_id`, `price_minor`                                            | `gym_detail_viewed` chains `KPI-09` → `KPI-10`                                               |
| `comparison_added` · `comparison_viewed` · `favourite_added` · `favourite_removed` · `reviews_expanded` | `gym_ids`, `count`, `gym_id`, `review_count`                                                             |                                                                                              |

Two rules bind every one of them. **`PR1`: analytics carry two decimal places** — about 1.1 km. A raw
coordinate at six places locates a person to roughly 0.1 m, which household and which floor, and
`Search.md` finding **`S-F06`** records that the `BR-DAT-06` redaction list currently contains **no
location field at all**. Until `OI-S1` lands that amendment, `PR2` (access logs record the path only
for `/search/*`) is the only control standing between a request log and a household-resolution
location trace. And **emission never blocks**: an outbox insert inside the existing transaction,
budgeted at 2 ms p95, behind `ops.discovery.analytics-emission`. A failing analytics consumer cannot
fail a search (`NFR-AVL-03`).

The one domain event this module would plausibly publish — a saved-search new-match alert to
`notifications/` — is `FR-SRCH-14`, descoped **`D-08`**.

**Delivering milestones:** M-047.

## 7. Consumed events

_Planned. No code in this module yet - populated by the milestones listed below._

This is where invariant 4 actually lives. **A gym enters the read model only on approval, and leaves
it on suspension**, and both are event-driven with a sixty-second budget (`FR-ONB-13`, `BAC-02`).
M-043's `reindex-trigger.registry.ts` is an **enumerated** list of eleven invalidating events; the
processor's idempotency key is **`branch_id`**, and a stale event carrying an older
`aggregate_version` is **discarded, not applied**.

| Registry entry                                                                                                        | Publisher                                 | Catalogue event (`ModuleDependency.md` §8.2)                       | Idempotency key                                   |
| :-------------------------------------------------------------------------------------------------------------------- | :---------------------------------------- | :----------------------------------------------------------------- | :------------------------------------------------ |
| `GymApproved`                                                                                                         | `catalog/`                                | `gym.approved`                                                     | `branch_id` (+ `gym_id` at source)                |
| `GymSuspended`                                                                                                        | `catalog/`                                | `gym.suspended`                                                    | `branch_id`                                       |
| `PlanPublished` / `PlanArchived`                                                                                      | `plans/`                                  | `plan.published` / `plan.archived`                                 | `branch_id`                                       |
| `PlanPriceChanged`                                                                                                    | `plans/`                                  | `plan.price-changed`                                               | `branch_id`                                       |
| `GymUpdated`, `BranchUpdated`, `BranchDeactivated`, `PromotionChanged`, `MediaRenditionsReady`, `TenantStatusChanged` | `catalog/`, `plans/`, `billing/`/`admin/` | **No row in the fifty-two-event catalogue** — see below            | `branch_id`                                       |
| `gym.rating-recomputed`                                                                                               | `catalog/`                                | present in the catalogue, **absent from the registry** — see below | `gym_id` + `revision`                             |
| `config.changed` / `flag.changed`                                                                                     | `admin/`                                  | broadcast                                                          | `config_key` + `version` / `flag_key` + `version` |

Three properties are not negotiable. **A tenant suspension removes rows rather than marking them
hidden**, and the removal is asserted through the public endpoint, not the table (`BR-TEN-05`).
**A projection row is not deleted on un-publish** — it must remain to receive the event that re-lists
it; deletion happens only when the branch is deleted, or when the visibility predicate goes false
(`SC-R10`). And **nothing in the authoring path waits for the projection**: approval, publish and
price-change transactions commit after an outbox insert and return, and a synchronous reindex inside
any of them fails a structure test (`ADR-0017`).

> **Registry-versus-catalogue gap, recorded not resolved.** Six of the eleven registry entries have no
> row in `ModuleDependency.md` §8.2, and one catalogue event that names `discovery/` as a consumer
> (`gym.rating-recomputed`) has no registry entry. `TenantStatusChanged` is the clearest case: it
> exists in `Architecture.md` §8.3 as `tenant.past-due` / `tenant.suspended` / `tenant.reinstated`,
> published by `billing/` and `admin/` and consumed by `discovery/` _"for visibility at 7 days"_, and
> it has no §8.2 row at all. This is M-043's _"twelfth event"_ trap seen from the other side, and the
> whole point of the registry being an explicit enumeration: **reconcile the two documents before
> M-043 is built**, in `DECISION_LOG.md`, not by adding a handler and hoping. An event that should
> invalidate and is not in the registry produces a green job and a stale index.

**Delivering milestones:** M-043 (the registry, the processor, the backfill), M-049 (`config.changed`
for the ranking weight document).

## 8. Jobs

_Planned. No code in this module yet - populated by the milestones listed below._

| Job                                 | Queue       | Class  | Schedule            | Conc | Scope | Lock key                                                  | Duration Y1 / 10×                                           |
| :---------------------------------- | :---------- | :----: | :------------------ | :--: | :---: | :-------------------------------------------------------- | :---------------------------------------------------------- |
| **`search.reindex`** (`§C5` job 15) | `discovery` | **P2** | On change + nightly |  3   |  PL   | `search.reindex:gym_{id}:{changeSeq}` / `:nightly:{date}` | 50 ms incremental, 100 s nightly full / 17 min nightly full |

Depth envelope **≤ 200 after 60 s**. If it falls behind, **a stale price is displayed** — `PF2` alerts
at 60 s and escalates at 300 s, and `A3.4` principle 2 calls that _"a defect, not a UX
inconvenience"_, even though `BR-PLN-03`'s checkout re-validation catches it before money moves. The
queue name follows `Scalability.md` §8.10's grammar _"queue name: `<module>`"_ and §8.10 settles it
explicitly for this job; there is no `catalog`-style discrepancy here.

Two design properties are worth stating because they are what make the job survivable. **`PF3`: a
nightly full rebuild runs regardless of event health**, so a lost event self-heals within 24 hours
rather than persisting indefinitely — which is also why `§C5` schedules the job as _"on change +
nightly"_ rather than on change alone. And the projection consumer's kill switch
(`ops.discovery.projection-consumer`, default _on_) **accumulates** outbox rows rather than dropping
them when off, so turning it back on drains and converges.

| Processor                 | `§C5`?                    | Trigger   | Notes                                                                                                                                                                                                                               |
| :------------------------ | :------------------------ | :-------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search.backfill` (M-043) | **No — roadmap addition** | On demand | The full rebuild from source tables, chunked by city and resumable. It must produce a projection **byte-identical** to the incremental path for the same inputs; that equality is what makes M-042's drop-and-rebuild rollback real |

`search.backfill` needs a `§C5` row and a `DECISION_LOG.md` entry before it is built, for the same
reason `staff/`'s two additions do: `Monitoring.md` §3.5 sizes `job_duration_seconds` at _"24 `§C5`
jobs × buckets"_, and a job with no catalogue row has no declared interval, so `ALRT-22`'s dead-man
threshold (2× the declared interval) cannot be computed for it.

**Delivering milestones:** M-043 (`search.reindex` and `search.backfill`, on the M-018 harness).

> **Milestone-numbering caveat (`BLK-05`, open).** `PHASES.md` records that `roadmap/README.md` §5 and
> the `Milestones_*.md` detail files assign different work to the same ids. Every `M-NNN` cited above
> is from the **`Milestones_*.md` detail files**; treat the numbers as provisional until the owner
> declares which document is normative.

## 9. Top three failure modes (`NFR-MNT-09`)

Declared in `PROJECT_CONSTITUTION.md` §18.5.1.

|  #  | Failure mode                  | Signal                                                                                                                                                                              | First action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| :-: | :---------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|  1  | **Search latency breach**     | `histogram_quantile(0.95, search_duration_seconds) > 0.5` for 10 m, or p99 > 1.0 for 10 m (**`ALRT-03`**, S2). `SLO-02` allows ≈86 breaching 5-minute windows per month and no more | Split before tuning. The `D-ENG` search panel separates the **PostGIS child span** (90 ms p95 budget), the **text child span** and the **facet child span** (110 ms — the most expensive block), and the three have different fixes. Check `search_cache_hit_ratio` against its ≥65% target (`FC6`) before touching SQL, and check that `ORDER BY` still uses the `<->` KNN operator: `ST_Distance(...)` in `ORDER BY` is not indexable, looks fine on 2,000 rows, and is the regression this alert most often means. **Reaching for a search cluster is a rejected substitution** requiring `§C10` escalation (ADR-0007) |
|  2  | **Maps provider unavailable** | `thirdparty_circuit_state{dependency="DEP-02"} == 2` for 5 m (**`ALRT-13`**, S2)                                                                                                    | Confirm the declared fallback actually engaged: `map.available: false` in the response and the list rendering at full width (`AC-SRCH-02.3`, `E4.8`). This is a **degradation, not an outage** — search is a SQL query and the map is a client-side tile layer, so a correct fallback here is explicitly excluded from the error budget (`Monitoring.md` §6.2). If search itself degraded, the failure is that something put a geocode on the hot path, which `Architecture.md` §1.3 forbids                                                                                                                              |
|  3  | **Zero-result rate spike**    | `search_zero_results_total / search_requests > 25%` for 1 h in a launched city (**`ALRT-36`**, S3 leg)                                                                              | Read the `most_restrictive_filter` breakdown first — it distinguishes the two causes, which go to different people. Concentrated on geography or price band in one city is a **supply-density** signal: the `§C9.4` city gate has slipped and consumer marketing is spending into an empty marketplace (Product + Operations). Spread across filters, or coincident with a projection change, is a **defect** — check that facets are still computed with each dimension's own filter removed, and that a filter has not started matching nothing (Backend Lead)                                                          |

**Two modes this module carries that the §18.5.1 list does not name**, both in the runbook because
they outrank all three above: **`ALRT-28`** — `discovery_unverified_listing_leaks_total` above zero,
**S1**, the synthetic probe for invariant `I4` — and **`ALRT-36`'s lag leg**,
`search_index_lag_seconds > 300` for 10 m, which is invariant 4 through the back door because a
just-suspended tenant may still be visible.

**Runbook: [`/docs/runbooks/discovery.md`](../../../../docs/runbooks/discovery.md)** ·
owner **Backend Lead (discovery)** · primary alerts `ALRT-03`, `ALRT-28`, `ALRT-36`.

> `Monitoring.md` §9.6 names this runbook `discovery-integrity.md`; `FolderStructure.md` §8.3 requires
> `/docs/runbooks/<module>.md`. Written at `discovery.md`; the conflict is flagged in the runbook and
> needs one owner decision across all twenty-three modules.
