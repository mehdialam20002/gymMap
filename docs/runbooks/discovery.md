# discovery runbook

> **Status: stub.** `NFR-MNT-09` requires a runbook per module covering its top three failure modes.
> The three below are fixed by `PROJECT_CONSTITUTION.md` §18.5.1. The eight-field per-mode structure
> of `Monitoring.md` §9.1 — symptom, alert, blast radius, diagnose, mitigate, fix, verify, prevent —
> is filled in by the milestones named under **Dashboards and queries**; `RB2` requires every query
> here to have been **run**, and none can be before the tables exist.
>
> **Filename conflict, unresolved.** `Monitoring.md` §9.6 names this runbook `discovery-integrity.md`;
> `FolderStructure.md` §8.3 row 9 requires `/docs/runbooks/<module>.md`. This file follows
> `FolderStructure.md` so the module `README.md` link resolves. One owner decision settles it for all
> twenty-three modules (`DECISION_LOG.md`, `CLAUDE.md` §9.3).

## Scope

`discovery/` owns the marketplace read side: `search_documents`, `favourites` and `saved_searches`.
`search_documents` is the denormalised projection that lets `GET /v1/search/gyms` answer any search
by reading **one relation with no join** — one row per publicly-visible **branch**, six indexes
(GiST on `location`, GIN on `search_tsv`, two `gin_trgm_ops` indexes on `name` and `locality`, GIN on
`amenity_ids`, and the `city_id`/price/rating composite), and a `bit(336)` `hours_bitmap` so
`open_now` is a mask test rather than a join to `branch_hours`. It is tenancy class **`GLOBAL`** and
carries **no RLS policy**: it holds only publicly-visible listings, and `tenant_id` on it is for
invalidation and click-through, not an RLS key. It owns the `PublicVisibilityPredicate` — the five
`FR-SRCH-09` conditions — and, critically, enforces it **by existence rather than by filtering**
(`SC-R10`, `Search.md` §7): a non-visible listing has no row, so there is no `WHERE` clause a future
refactor can drop. It owns the ten `FR-SRCH-03` filters with their per-dimension facet counts, the
`FR-SRCH-12` zero-result repair kit, the six-factor `FR-SRCH-10` ranking over at most 500 candidates,
and one `§C5` job, **`search.reindex`** (job 15, queue `discovery`, P2, on change + nightly) plus the
non-`§C5` `search.backfill`.

It reads two modules and only two: `catalog/`'s `GYM_SEARCH_VIEW_PORT` (which carries the rating
projection — `discovery → reviews` is **`—`**, not even an event) and `plans/`'s `PLAN_SUMMARY_PORT`
for price. The search path itself touches neither: it reads the projection through
`PublicPrismaService` with no `SET LOCAL` at all, which is why 2,000 searches per minute cost the
connection pool almost nothing.

**Blast radius when this module is down.** The marketplace stops being browsable and `KPI-09`
collapses, but `NFR-AVL-03` is explicit that *"loss of maps, search indexing, notifications or
analytics must not prevent check-in, purchase or payment"* — a member with a URL can still buy, and
the door still opens. Nothing downstream reads this module synchronously: down the `dsc` column of
the `ModuleDependency.md` §4 matrix only `admin/` is `●`, `catalog/` and `plans/` are `▲` (they
publish *to* it), and every other module is `—`. That isolation is the reason a
`discovery/` incident is almost never an S1 on availability grounds. It becomes an S1 on **integrity**
grounds, which is a different axis and the one to watch.

**Kill switches** (`ADR-0026`). Unusually many, and each is a deliberate degradation:
`rel.discovery.search` (endpoint `503`, `customer-web` renders the city selector),
`ops.discovery.result-cache` (every request goes to Postgres — the escape hatch when a 60-second
cache is masking a projection bug), `ops.discovery.projection-consumer` (**outbox rows accumulate
rather than drop**, so re-enabling drains and converges), `rel.discovery.suggest`,
`rel.discovery.trigram-fallback`, `rel.discovery.facets` (chips without counts — a visible reduction,
never a wrong number), `rel.discovery.zero-result-guidance`, `ops.discovery.analytics-emission`,
`rel.discovery.map`, `rel.discovery.configurable-ranking`, `rel.discovery.featured-slots`,
`rel.discovery.comparison`, `rel.discovery.favourites`. **Not flaggable:** the visibility predicate
and the filters themselves. A search that silently ignores a filter is the failure `.strict()`
validation exists to prevent, and a visibility switch would be a switch on invariant 4.

## Top failure modes

| Signal | Likely cause | First action | Escalation |
| :--- | :--- | :--- | :--- |
| **1 — Search latency breach.** `histogram_quantile(0.95, search_duration_seconds) > 0.5` for 10 m, or p99 > 1.0 for 10 m (**`ALRT-03`**, S2). `SLO-02` permits ≈86 breaching 5-minute windows a month. Symptom: the top of the entire consumer funnel slows, and it never appears as an error — `KPI-09` and GMV fall with a green error rate | `ORDER BY ST_Distance(...)` reintroduced in place of the `<->` KNN operator (not indexable; fine on 2,000 rows, fatal under load); the 500-candidate ceiling raised or bypassed; facet counts computed on every request instead of only the cached page-1/≤3-dimension case (`FC1`); Redis cold or evicting (`search_cache_hit_ratio` below its 65% target, `FC6`); replica lag; a trigram index dropped by a migration | Split the span before touching SQL. The `D-ENG` search panel separates the **PostGIS child span** (90 ms p95 budget), the **text child span** and the **facet child span** (110 ms — the most expensive block of the 270 ms total), and the three have entirely different fixes. Then check the cache hit ratio, then `EXPLAIN` against the committed M-042 CI baseline — a plan that no longer matches the baseline names the regression directly | Ticket to Backend Lead (discovery); **page if sustained 30 m or coinciding with `ALRT-01`**. Gym-visible. **Escalation must not include introducing a search cluster** — ADR-0007 makes OpenSearch a rejected substitution and `E4.4` asserts its absence in CI; the sanctioned responses, in order, are materialised projection columns, composite index tuning, cache TTL extension, replica routing, ranking simplification, and only then a `§C10` escalation |
| **2 — Maps provider unavailable.** `thirdparty_circuit_state{dependency="DEP-02"} == 2` for 5 m (**`ALRT-13`**, S2). Symptom: the map pane on `SCR-WEB-002` shows a notice; the list is unaffected | The tile or geocoding provider is down, rate-limiting, or the breaker opened on latency rather than errors | Confirm the **declared fallback actually engaged** — that is the whole diagnosis. `map.available: false` must be present as a first-class response field, not an omission: a client cannot distinguish *"no pins because the provider is down"* from *"no pins because nothing matched"* by absence, and those need different UI (`AC-SRCH-02.3`). The list must render at full width (`E4.8`). If **search itself** degraded, the incident is not this one: something put a geocode on the hot path, which `Architecture.md` §1.3 forbids — geocoding belongs to `catalog/` on address save | Ticket, not a page; a breaker open beyond 30 m escalates one level. A correctly-degraded maps failure is **explicitly excluded from the error budget** (`Monitoring.md` §6.2, `AC-SRCH-02.3` list-only maps *"is not downtime"*) — do not let it consume one. Search still failing while maps are down is a separate, higher-severity finding |
| **3 — Zero-result rate spike.** `search_zero_results_total / search_requests > 25%` for 1 h in a launched city (**`ALRT-36`**, S3 leg). Symptom: visitors search and find nothing; `KPI-09` falls with no latency or error signal at all | Two unrelated causes with two different owners. **Supply**: density in the city has fallen below the `§C9.4` launch gate, or acquisition slowed, and consumer marketing is spending into an empty marketplace. **Defect**: facets computed with all filters applied instead of with each dimension's own filter removed; a filter matching nothing after a taxonomy or projection change; the projection shrinking because mode-adjacent reindex removed rows it should not have | Read the `most_restrictive_filter` breakdown first — it separates the two causes before anyone argues. Concentrated on geography or price band in one city is **supply**. Spread across filters, or starting at a deploy boundary, is a **defect**: check the projection row count for the city against `gyms` passing the five visibility conditions, then check that a single dimension has not started returning zero for every value. The counterfactual work runs **only on the zero-result path** by design; if it is running on every search, that is a second, self-inflicted load problem | Supply → ticket to Product **and** Operations; the `§C9.4` gate decision is theirs and may mean pausing city spend. Defect → ticket to Backend Lead (discovery). Escalate to S2 if the zero-result rate and `search_index_lag_seconds` move together, because that combination is the projection shrinking, not the market being thin |

> **The §18.5.1 list is not the severity ranking.** The two most serious failures this module can have
> are not among the three above. **`ALRT-28`** — `discovery_unverified_listing_leaks_total` above zero,
> a synthetic probe that searches for a known `PENDING_REVIEW` gym every 60 seconds — is **S1** and is
> invariant `I4`: an unverified gym visible to consumers is the failure that makes the verification
> promise a lie (`BR-GYM-01`, `OBJ-03`). **`ALRT-36`'s lag leg** — `search_index_lag_seconds > 300`
> for 10 m — is the same invariant through the back door, because a just-suspended tenant may still be
> visible (`BR-TEN-05`) and a just-published plan may be unbuyable (`KPI-03`). For `ALRT-28`: purge the
> CDN entry and force a reindex immediately, then establish **which surface leaked** — search index,
> cached detail page, or the sitemap — because the three have different purge paths. Page on-call and
> Operations.

## Dashboards and queries

_To be populated by **M-042** (the projection, the six indexes and the committed `EXPLAIN` baseline),
**M-043** (reindex lag in both directions, and the backfill), **M-044** (the latency span split and
the result cache), **M-046** (facet cost and correctness), **M-047** (the zero-result instrument) and
**M-049** (the k6 gate and `ranking_version`)._

Intended content, named now so those milestones have a target:

- **Panel — search latency, split by span.** `search_duration_seconds` p50/p95/p99 against the 500 ms
  and 1,000 ms lines, decomposed into the PostGIS, text and facet child spans of `Monitoring.md`
  §4.3.5 with each span's budget from `Search.md` §8.1 (90 ms, — , 110 ms of a 270 ms total) drawn as
  a threshold. A single aggregate latency number hides which of the three moved, which is the whole
  diagnosis for failure mode 1.
- **Panel — cache health.** `search_cache_hit_ratio` against the ≥65% target (`FC6`, early warning
  below 60% for a week), result-cache and facet-cache key counts against the `Scalability.md` §6.6
  cardinality bounds, and Redis eviction rate. The cache database runs `allkeys-lru` and eviction
  there is correct behaviour; eviction on the **queue and lock** database is data loss and belongs on
  a different panel.
- **Panel — projection freshness.** `search_index_lag_seconds` and `search_reindex_lag_seconds`
  (`PF2`: alert 60 s, escalate 300 s), `search.reindex` job outcome and duration against its 50 ms
  incremental / 100 s nightly envelope, and queue depth against the ≤200-after-60-s envelope. The
  `FR-ONB-13` alert is wired **in both directions** — a suspended gym still present, and an approved
  gym still absent — because those are different business failures (`BR-TEN-05` versus `KPI-03`).
- **Panel — listing integrity.** `discovery_unverified_listing_leaks_total`, which must be **zero**
  (`ALRT-28`, invariant `I4`), beside the count of `APPROVED` gyms with no row in `search_documents`
  — the same defect seen from the other side, shared with the `catalog` runbook.
- **Panel — zero results.** `search_zero_results_total` broken down by `most_restrictive_filter`, per
  city, against the 25% `ALRT-36` threshold, with the launched-city set from `§C9.4` overlaid. This
  panel is read by Product as often as by engineering and is the input to a city-spend decision.
- **Query — projection versus source.** Read-only, `LIMIT`-bounded: gyms and branches satisfying all
  five `FR-SRCH-09` conditions that have **no** `search_documents` row, and rows in
  `search_documents` whose gym **fails** any of the five. The first set is `KPI-03` leaking; the
  second set is `ALRT-28` waiting to fire. Both must be empty.
- **Query — the eleven-entry trigger registry against recent outbox traffic.** For each `event_type`
  published in the last hour by `catalog/`, `plans/` and the tenant-status path, whether the registry
  maps it to a handler. A published event type absent from the registry is M-043's *"twelfth event"*,
  and it is the defect class that produces a green job and a stale index.
- **Query — index usage on the hot path.** `EXPLAIN (ANALYZE, BUFFERS)` for the canonical search
  shape, diffed against the CI baseline committed in M-042, plus `pg_stat_user_indexes` for the six
  indexes — an index with zero scans since the last deploy has either lost its query shape or been
  replaced by a sequential scan.
- **Query — trigram index size.** The three `gin_trgm_ops` indexes against the table size, tracked in
  `docs/database/indexes-observed.md`. `IX4` warns a trigram index is frequently larger than the data
  it indexes; this is the query that keeps that warning honest.
- **Data recovery note.** **`search_documents` holds no fact that does not exist elsewhere.** Every
  column is derivable from `gyms`, `branches`, `plans`, `branch_hours` and `gym_amenities`, so
  drop-and-rebuild is a supported operation for the life of the product — `search.backfill` is the
  documented path, chunked by city and resumable, and its output must be byte-identical to the
  incremental projection for the same inputs. Nothing in this module may ever write a fact to
  `search_documents` that exists nowhere else; that single rule is what makes recovery trivial.
  `favourites` is `G-CRUD-D` — a hard delete is the correct domain operation, so an unfavourite is
  **not** recoverable and must not be presented as such.

## Known incidents

_None yet._
