# `API-DISC/SEARCH` — Discovery Search: the frozen endpoint contract and the ranking model

**Module:** `discovery` · **Group:** `DISC` · **Surface count:** 2 endpoints, both unauthenticated ·
**Status:** contract frozen, no code written · **Launch market:** India
(`LAUNCH_MARKET_INDIA.md`) · **Read model:** `search_documents` (`Schema.md` §13.4), never tenant
tables.

---

## 0. Document control

| Aspect | Value |
| :--- | :--- |
| Owns | Exactly two rows of `API_Catalog.md` §3.3 — `GET /search/gyms` and `GET /search/suggest` — in per-endpoint detail, plus the `FR-SRCH-10` ranking model that both depend on |
| Authoritative index | **`docs/engineering/API_Catalog.md`** — the master endpoint table, the representation conventions, the error registry, the rate-limit classes, the cache tokens, the permission grammar. This document **cites** it and never restates it |
| Governing law | `PROJECT_CONSTITUTION.md` §13 (Error Handling Law) and §14 (API Rules). Nothing here may contradict either |
| Product source | `MASTER_PRD.md` `B5.6` (`SRCH` module, `FR-SRCH-01`…`FR-SRCH-15`, `US-SRCH-01`/`US-SRCH-02`, four edge cases), `A8.1` (`BR-GYM-01`, `BR-TEN-05`), `A8.2` (`BR-PLN-03`, `BR-PLN-05`), `B4` `SCR-WEB-002` (Search Results), `C3.1`/`C3.2` (conventions and catalogue), `C6` (analytics taxonomy) |
| Physical model | `docs/database/Schema.md` §13.4 `search_documents` — the **GLOBAL**, non-RLS projection. Also `cities`, `localities`, `amenities`, `gym_categories` (§12 reference data) |
| Index design | `docs/database/Indexes.md` §5 (PostGIS), §6 (full-text and trigram), **§11.4 (the ranking-expression caveat)** |
| Scale design | `docs/engineering/Scalability.md` §6 (the whole search chapter: §6.2 candidate query, §6.3 projection, §6.4 ranking + rule **SR3**, §6.5 facets, §6.6 caching **FC1**–**FC6**, §6.7 freshness **PF1**–**PF5**) |
| Enforcement split | `docs/database/Constraints.md` §13.1 (`BR-TEN-05` **PARTIAL**, `BR-GYM-01` **PARTIAL**) and §13.2 (`BR-PLN-05` **PARTIAL**). Everything those rows grade `PARTIAL` or `NONE` is **this layer's** job |
| Rule detail | `docs/engineering/BusinessRules.md` — `BR-GYM-01`, `BR-TEN-05`, `BR-PLN-05`, `BR-PLN-03`, `BR-DAT-06` enforcement points and test ids |
| Security | `docs/engineering/Security.md` §5.4 (`@Public()` allowlist), tier 7 `RL-SEARCH`, `PR-5` (analytics precision reduction) |
| **Not owned here** | `GET /gyms/:slug`, `GET /gyms/:slug/plans`, `GET /gyms/:slug/reviews`, `GET /gyms/:slug/similar`, `POST /compare`, `GET /cities`, `GET /cities/:slug`, `GET /categories`, `GET /categories/:slug`, `GET /amenities`, and the whole `API-FAV` favourites and saved-searches group. **Those are `docs/apis/Marketplace.md`.** §1.3 draws the line precisely |

> **Every fenced block in this document is labelled `illustrative — not committed code`. No
> application code exists. Zod sketches, TypeScript interfaces, SQL fragments and JSON bodies here
> are the *contract*, expressed in the notation the implementation will use; they are not the
> implementation.**

---

## 1. Position, precedence, and six findings against the source documents

### 1.1 The non-duplication contract

`API_Catalog.md` §0 fixes its own boundary: it is the index and the conventions, and the
per-endpoint detail lives in `/docs/apis/`. This document is the search half of the `discovery`
split.

| Convention | Defined in | What this document does |
| :--- | :--- | :--- |
| Base URL `https://api.<domain>/v1`, URL versioning | `API_Catalog.md` §1.1, §14.1 | Cites. Every path below is relative to that base |
| `snake_case` everywhere; path params `camelCase`; plural kebab-case segments | §1.2.1 R1–R8 | Cites |
| Money: `<subject>_minor` as a **string** of minor units with an adjacent `currency`; **no monetary field in any request** | §1.2.3 M1–M6 | Cites. §3.2 shows how the `FR-SRCH-03` price filter is expressed **without** breaching M3 |
| Timestamps ISO-8601 UTC with `Z`; business dates `YYYY-MM-DD` with a documented interpreting timezone | §1.2.4 T1–T5 | Cites. §10 fixes `Asia/Kolkata` as the interpreting zone for every hours evaluation |
| Enums `SCREAMING_SNAKE_CASE`, declared open or closed | §1.2.5, §8.3 | Cites, and declares open/closed per field in §3.2 |
| Collection envelope `{ data, next_cursor, limit }`, `next_cursor: null` the only end signal | §1.2.6 | Cites. §3.6 shows the additive sibling blocks and why they do not violate it |
| Cursor pagination, opaque base64url cursor, `CURSOR_INVALID` / `CURSOR_SORT_MISMATCH` | §1.7.1–§1.7.2 | Cites |
| Filtering by explicit named parameters; `.strict()` query schemas; `400 UNKNOWN_QUERY_PARAMETER` | §1.8, §9.7 IV2 | Cites, and §3.15 enumerates every rejection |
| Error envelope `code` / `message` / `details` / `correlation_id`, rules EV1–EV7 | §1.9 | Cites. §12 is the search slice of the registry |
| Rate-limit headers `X-RateLimit-*`, `Retry-After` | §1.10 | Cites. §13.2 records one proposed amendment |
| Cache tokens; `CDN-60` = `public, max-age=15, s-maxage=60, stale-while-revalidate=30` | §1.11 | Cites. §7.3 adds the `Vary` contract and the cache-key grammar |
| Permission grammar; `@Public()` allowlist | §5.1, §5.4 | Cites. §13.1 records both endpoints against the allowlist |

### 1.2 Precedence when two sources disagree

`PROJECT_CONSTITUTION.md` → `MASTER_PRD.md` → `API_Catalog.md` → this document. Where a lower
document is more specific and does not contradict a higher one, the more specific text governs.
Where a genuine contradiction exists it is recorded in §1.4 rather than silently resolved.

### 1.3 The scope boundary with `Marketplace.md`

`SCR-WEB-002` is one screen served by several endpoints. Only two of them are here.

| Concern | Endpoint | Document |
| :--- | :--- | :--- |
| Radius + text + filter search, ranking, facets, map data, zero-result guidance | `GET /search/gyms` | **This document** |
| Locality and gym-name autocomplete | `GET /search/suggest` | **This document** |
| The result card's *favourite* toggle state | `GET /me/favourites` | `Marketplace.md` |
| The result card's *compare* checkbox target | `POST /compare` | `Marketplace.md` |
| Gym detail behind a result click | `GET /gyms/:slug` | `Marketplace.md` |
| Plan catalogue and monthly-equivalent arithmetic **at the plan level** | `GET /gyms/:slug/plans` | `Marketplace.md` |
| The canonical city list backing the city selector of §9.1 | `GET /cities` | `Marketplace.md` |
| The canonical amenity taxonomy backing `amenity_id` | `GET /amenities` | `Marketplace.md` |
| The canonical category taxonomy backing `category` | `GET /categories` | `Marketplace.md` |
| City and category **landing** payloads (`FR-SRCH-13`) | `GET /cities/:slug`, `GET /categories/:slug` | `Marketplace.md` |
| Saved searches and alerts (`FR-SRCH-14`, priority **C**, not Phase 1) | `POST /me/saved-searches` | `Marketplace.md` |

**The one shared object.** The `FR-SRCH-06` result card defined in §3.7 is also emitted by
`GET /cities/:slug`, `GET /categories/:slug` and `GET /gyms/:slug/similar`. It is a single named
schema, `GymResultCard`, declared once in `packages/types` and imported by both documents. A change
to it is a change to four endpoints and is reviewed as such. `Marketplace.md` cites this section for
its shape and does not redefine it.

### 1.4 Six findings against the source documents

These are recorded, not fixed unilaterally. Each names the document that must change.

#### Finding S-F01 — the projection table is named two different things

`Schema.md` §13.4 names the physical table **`search_documents`** and `Indexes.md` §2/§5 refers to
`search_documents.location`, `search_documents.search_tsv` and `search_documents.amenity_ids`. But
`Indexes.md` §6.2's illustrative DDL creates the generated column on **`gym_search_projection`**, and
its index names are `gin_gym_search_projection__*`. `Scalability.md` §6.2/§6.3 uses
`search_documents` throughout.

**Resolution for this document:** the table is `search_documents`, per `Schema.md` §13.4, which
`PROJECT_CONSTITUTION.md` §15.1 makes authoritative for physical existence. `Indexes.md` §6.2 and
§6.4 should be corrected to match. This is a documentation defect with no contract consequence — the
API never exposes a table name — but it will produce two migrations if left.

#### Finding S-F02 — `Schema.md` §13.4's column list is a strict subset of the columns the contract needs

`Scalability.md` §6.3 specifies seven column groups on the projection, including `gym_slug`,
`city_slug`, `cover_media_url`, `cover_renditions`, `top_amenity_ids`, `rating_bayes`,
`conversion_rate_bps`, `completeness_pct`, `gender_policy`, `has_24h_access`, `has_parking`,
`trial_available`, `plan_duration_units`, `hours_bitmap bit(168)`, `lowest_monthly_equiv_minor`,
`promo_active` and `status`. `Schema.md` §13.4's table lists roughly half of them and its Prisma
sketch lists ten.

Every field of the §3.7 result card and every predicate of the §3.2 filter set is served from one of
those columns. **`Schema.md` §13.4 must be expanded to the full `Scalability.md` §6.3 set before
Phase 6.** Until it is, `Schema.md` §13.4 is incomplete rather than wrong. This document treats
`Scalability.md` §6.3 as the projection's column contract and names the source column for every
response field in §3.7.

#### Finding S-F03 — a dangling cross-reference to a non-existent section

`Indexes.md` §4 (the *considered and rejected* table) says *"that query is answered by
`search_documents.hours_bitmap` with a bitwise `AND` (§6.5)"*. `Indexes.md` §6 has subsections 6.1
to 6.4 and no §6.5. The bitmap mechanism is specified in **`Scalability.md` §6.2**, not in
`Indexes.md`. The cross-reference should be re-pointed.

#### Finding S-F04 — the master index omits `FR-SRCH-08` and `FR-SRCH-15` from the `/search/gyms` row

`API_Catalog.md` §3.3 lists the row's requirements as `FR-SRCH-01…FR-SRCH-07, FR-SRCH-09…FR-SRCH-12`.

- **`FR-SRCH-08`** (*"search this area" when the map is panned*, priority **S**) is a query-parameter
  change to this endpoint and nothing else. Its parameters are specified in §3.2 and frozen now, but
  are **flag-gated** (`search_map_bounds`) and not part of the Phase-1 acceptance set. The catalogue
  row should gain `FR-SRCH-08` when the flag ships.
- **`FR-SRCH-15`** (*every search, filter application and result click is an analytics event*) is
  partly a contract obligation of this endpoint: the server supplies the precision-reduced location
  and the derived counts the client cannot compute. §11 specifies it. The catalogue row should gain
  `FR-SRCH-15`.

Neither is a contradiction; both are omissions.

#### Finding S-F05 — `RL-SEARCH`'s 60/min session budget is shared between search and autocomplete

`API_Catalog.md` §4.2 and `Security.md` tier 7 give `RL-SEARCH` **600/min per IP** and
**60/min per session**, covering `/search/*` and `/compare` together. A user typing a nine-character
locality name with a 150 ms client debounce emits three to five `/search/suggest` calls; four
searches with two refinements each in one minute is ordinary behaviour. The combined session budget
of 60 is reachable by a legitimate, fast user on a flaky connection where the client retries.

**Proposed amendment to `API_Catalog.md` §4.2, not applied here:** split a sub-class `RL-SUGGEST` at
**120/min per session, 1,200/min per IP**, leaving `RL-SEARCH` at 60/240 for `/search/gyms` and
`/compare`. Until that amendment is accepted, §6 documents `/search/suggest` under `RL-SEARCH` as
the catalogue states, and §13.2 records the risk.

#### Finding S-F06 — `BR-DAT-06`'s redaction field list does not cover location

`BusinessRules.md` `BR-DAT-06` enumerates the Pino redaction list as `token`, `authorization`,
`cookie`, `password`, `otp`, `email`, `phone`, `name`, `dob`, `address`, `card`, `cvv`, `aadhaar`,
`pan`, `health_notes`. It contains **no location field**. `PROJECT_CONSTITUTION.md` `PR-5` and `C6`
both require location to be precision-reduced in `search_performed`, but a request-logging
interceptor that logs the query string of `GET /search/gyms?lat=12.9345&lng=77.6101` writes a
household-resolution coordinate pair into the log aggregator and defeats `PR-5` entirely.

**Required additions to the `BR-DAT-06` redaction list:** `lat`, `lng`, `pincode`. Plus the rule in
§11.4: the access log records the **path only** for `/search/*`, never the raw query string.

---

## 2. Cross-cutting contracts on this surface

Six properties hold for both endpoints and are stated once.

| # | Property | Consequence |
| :-: | :--- | :--- |
| **SC1** | **Tenant scope is `public`.** Neither endpoint carries tenant context. | No `SET LOCAL app.tenant_id`. Both read `search_documents`, which is populated **only** with rows satisfying `FR-SRCH-09`, so the tenancy question is answered by what is in the projection rather than by a policy predicate. `Marketplace.md` §2 makes the same argument for gym detail. |
| **SC2** | **Authentication is optional and never required.** | `FR-NAV-01`: the site is fully browsable unauthenticated and the auth gate appears at *select plan → checkout*, nowhere earlier. A bearer token, if present, is used **only** to hydrate `is_favourited` on the result card and to attribute the analytics event to a `user_id` instead of an `anonymous_id`. A malformed or expired token on these endpoints is **ignored**, not rejected — a stale token must never turn a public search into a `401`. |
| **SC3** | **Idempotency is not applicable.** | Both are `GET`. Nothing to key. |
| **SC4** | **Reads are served from a replica.** | `NFR-SCAL-04`. Replication lag is bounded and the response carries `as_of`. A gym approved sixty seconds ago may not appear yet, which is why `FR-ONB-13`'s *"live within 60 seconds"* is measured against the projection write, not against the replica read — recorded as `OI-S4`. |
| **SC5** | **No write, no side effect, no audit row.** | The single exception is the analytics event of §11, which is emitted asynchronously through the outbox and never blocks the response. |
| **SC6** | **Money is never formatted.** | `lowest_monthly_equiv_minor` is an integer count of **paise** with an adjacent `currency`. The client applies lakh-crore grouping (`README.md` §11). A search response never contains a `₹` character. |

### 2.1 The projection is the only table either endpoint reads

Neither endpoint joins `gyms`, `branches`, `plans`, `gym_amenities`, `branch_hours` or `gym_media` at
request time. Everything is served from **`search_documents`** (finding S-F01), one row per
**branch**, maintained transactionally through the outbox (`ADR-0017`).

This is not an optimisation; it is what makes `NFR-PERF-01` (p95 ≤ 500 ms) and `NFR-PERF-09`
(2,000 searches/minute) arithmetically possible. Assembling the §3.7 card from six tables per row,
for twenty rows, at thirty-three searches a second, is not reachable on the stated infrastructure
budget (`CON-05`).

> **The freshness obligation this creates.** `A3.4` principle 2 — *never show a price that cannot be
> bought* — and `BR-PLN-03` both bind the projection, not just the checkout path. The outbox commits
> the projection update **in the same transaction** as the price change, so a published price and its
> searchable copy cannot diverge. A projection updated by a nightly job would violate `BR-PLN-03`
> every night, and the fact that search is a read path does not exempt it.

### 2.2 One row per branch, one card per branch

`SCR-WEB-002`'s result card shows a **distance**, and distance is a property of a branch, not of a
gym. A two-branch gym in Indiranagar and Koramangala is **two rows** in the projection and **two
cards** in a search that covers both — because the answer to *"how far is it"* differs, and merging
them would require picking one distance and discarding the other.

Deduplication is therefore a **client-side or ranking-side** concern, not a storage one. §4.6
specifies the `collapse_by_gym` behaviour that limits one gym to its nearest matching branch, default
`true`, so the default result set reads as a list of gyms while the underlying rows stay per-branch.

---

## 3. `GET /v1/search/gyms`

**Purpose** the marketplace search that `OBJ-02` and `KPI-09` are measured on · **Surfaces** `web`
(`SCR-WEB-002` Search Results; also `SCR-WEB-001` *"Popular near you"* with a fixed radius) ·
**Auth** optional (`SC2`) · **Permission** **none** — the only permission-free class in the system,
declared explicitly as `@Public()` so `FR-RBAC-01`'s CI check sees a declaration rather than an
omission · **Scope** `public` · **Idempotency** N/A · **RL** `RL-SEARCH` (finding S-F05) ·
**Cache** `public, max-age=60, stale-while-revalidate=120` — see §8.3.

### 3.1 Signature

```http
GET /v1/search/gyms
  ?lat=12.9716&lng=77.5946&radius_m=3000
  &q=crossfit
  &amenity_id=a_parking&amenity_id=a_shower
  &price_max_minor=250000
  &open_at=06:00
  &gender_policy=WOMEN_ONLY
  &sort=relevance&limit=20
```

### 3.2 The filter set — every parameter of `FR-SRCH-03`

| Parameter | Type | Default | Bounds / validation | Source column | FR |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `lat` | decimal | — | −90…90, **6 dp maximum**; more is a `400` (§11.4) | `location` | `FR-SRCH-01` |
| `lng` | decimal | — | −180…180, 6 dp maximum | `location` | `FR-SRCH-01` |
| `radius_m` | integer | `5000` | 500…50,000. Above 50 km the result set stops being a shortlist | `location` | `FR-SRCH-03` |
| `city_slug` | slug | — | Must exist and be `is_served`. **Alternative to `lat`/`lng`**, not additive | `city_slug` | `FR-SRCH-01` |
| `pincode` | string(6) | — | `^[1-9][0-9]{5}$` — Indian PIN, first digit never zero. Resolved to a centroid server-side | `location` | `FR-SRCH-01` |
| `q` | string | — | ≤ 64 chars, trimmed, control characters stripped. Parameterised into FTS and trigram — **never concatenated** | `search_tsv`, `gym_name` | `FR-SRCH-02` |
| `price_min_minor` / `price_max_minor` | integer | — | ≥ 0, `min ≤ max`, paise. Compared against **`lowest_monthly_equiv_minor`**, not raw plan price | `lowest_monthly_equiv_minor` | `FR-SRCH-03` |
| `amenity_id` | repeated slug | — | ≤ 12 values, each in the platform taxonomy. **`AND` semantics** — all must be present | `amenity_ids` (GIN) | `FR-SRCH-03` |
| `rating_min` | decimal | — | 1.0…5.0, one dp. **Excludes gyms below the `BR-REV-07` three-review floor** — a gym with no displayable rating cannot satisfy a rating filter | `rating_avg`, `rating_count` | `FR-SRCH-03` |
| `open_now` | boolean | `false` | Evaluated in **`Asia/Kolkata`** against `hours_bitmap` | `hours_bitmap` | `FR-SRCH-03` |
| `open_at` | `HH:MM` | — | 24-hour. Applies to the **current weekday** unless `open_on` is given | `hours_bitmap` | `FR-SRCH-03`, `AC-SRCH-01.1` |
| `open_on` | `MON`…`SUN` | today | Only meaningful with `open_at` | `hours_bitmap` | `FR-SRCH-03` |
| `twenty_four_hour` | boolean | `false` | | `has_24h_access` | `FR-SRCH-03` |
| `gender_policy` | enum ×4 | — | `MIXED`, `WOMEN_ONLY`, `MEN_ONLY`, `SCHEDULED`. **Repeatable, `OR` semantics** — Priya wants women-only *or* scheduled, not both simultaneously | `gender_policy` | `FR-SRCH-03`, `B2.2` |
| `plan_duration` | repeated enum | — | `DAY`, `WEEK`, `MONTH`, `QUARTER`, `HALF_YEAR`, `YEAR`. `OR` semantics | `plan_duration_units` | `FR-SRCH-03` |
| `trial_available` | boolean | `false` | A session plan with `session_count = 1` (`OQ-14`'s default) | `trial_available` | `FR-SRCH-03`, `OQ-14` |
| `parking` | boolean | `false` | | `has_parking` | `FR-SRCH-03` |
| `category_slug` | slug | — | Backs `/c/:categorySlug` landings | `category_slug` | `FR-SRCH-13` |
| `collapse_by_gym` | boolean | `true` | §4.6 | — | — |
| `sw_lat`/`sw_lng`/`ne_lat`/`ne_lng` | decimal | — | **Flag-gated** `search_map_bounds` (`FR-SRCH-08`, finding S-F04). Mutually exclusive with `radius_m` | `location` | `FR-SRCH-08` |
| `sort` | enum ×5 | `relevance` | §4.7 allowlist | — | `FR-SRCH-04` |
| `limit` | integer | `20` | 1…50 | — | `FR-SRCH-07` |
| `cursor` | opaque | — | `README.md` §7 | — | `FR-SRCH-07` |

**Validation is `.strict()`.** An unrecognised parameter is a `400 VALIDATION_FAILED` naming it, not
a silent ignore — a typo'd `amenties=` that quietly returns unfiltered results is worse than an
error, because the user believes the filter applied.

### 3.3 Location resolution, in precedence order

1. `lat` + `lng` — used directly.
2. `pincode` — resolved to a centroid. Accuracy is PIN-area level and the response says so via
   `location_precision: "PINCODE"`, because a distance of *"2.1 km"* from a PIN centroid is not the
   same claim as 2.1 km from a GPS fix.
3. `city_slug` — city centroid, `location_precision: "CITY"`.
4. **None of the above** — `422 LOCATION_REQUIRED` carrying the served-city list, which is what
   drives the city-selector fallback of §9.1. *"Never an empty state"* is a contract obligation, not
   a UI nicety.

`radius_m` is ignored when map bounds are supplied.

### 3.4 The response envelope

```jsonc
// illustrative — not committed code
{
  "results": [ /* GymResultCard[] — §3.7 */ ],
  "total_estimated": 47,
  "next_cursor": "eyJyIjowLjgxNCwiaWQiOiIwMTkyZjMuLi4ifQ",
  "as_of": "2026-08-06T15:42:11+05:30",
  "location": {
    "lat": 12.9716, "lng": 77.5946,
    "precision": "EXACT",
    "city_slug": "bengaluru", "city_name": "Bengaluru"
  },
  "applied_filters": { /* echo of every parameter as resolved — §3.6 */ },
  "facets": { /* §3.8 */ },
  "map": {
    "bounds": { "sw_lat": 12.9421, "sw_lng": 77.5610, "ne_lat": 12.9998, "ne_lng": 77.6281 },
    "clusters": [ { "lat": 12.9611, "lng": 77.6387, "count": 14 } ],
    "available": true
  },
  "ranking_version": "2026-08-01.3"
}
```

`total_estimated` is **estimated, and named so**. An exact count over the projection at every search
costs a second aggregate scan for a number the user reads as *"about fifty"*. `README.md` §7 already
forbids a mandatory `total_count`; this is the same reasoning with an honest field name.

`ranking_version` exists because `FR-SRCH-10` makes the formula configurable at runtime. Without it,
an A/B result or a support complaint about ordering is unreproducible — you cannot ask *"which
weights produced this?"* after the fact.

### 3.5 `applied_filters` is an echo, and it is load-bearing

`AC-SRCH-01.3` requires filters and location to restore from a shared or reloaded URL. The echo
returns each parameter **as the server resolved it** — a `pincode` echoes with its derived
coordinates, an unsupplied `radius_m` echoes as `5000`. The client rebuilds its URL from the echo
rather than from what it thinks it sent, so a server-side default change does not silently desync the
two.

### 3.6 `GymResultCard` — the shared schema of §1.3

```jsonc
// illustrative — not committed code
{
  "gym_id": "0192f3a1-...", "branch_id": "0192f3b7-...",
  "slug": "iron-works-indiranagar", "city_slug": "bengaluru",
  "name": "Iron Works Gym",
  "locality_name": "Indiranagar",
  "distance_m": 1840,
  "cover": { "url": "https://cdn.example.in/g/0192f3a1/cover-800.webp",
             "renditions": { "400": "...", "800": "...", "1600": "..." },
             "alt": "Iron Works Gym, Indiranagar" },
  "rating": { "average": 4.3, "count": 128, "displayable": true },
  "is_verified": true,
  "lowest_monthly_equiv_minor": 189900,
  "currency": "INR",
  "promo_active": true,
  "top_amenities": [
    { "id": "a_parking", "name": "Parking" },
    { "id": "a_shower",  "name": "Showers" },
    { "id": "a_ac",      "name": "Air conditioned" }
  ],
  "open_state": { "is_open_now": true, "closes_at": "22:00", "next_opens_at": null },
  "gender_policy": "MIXED",
  "is_featured": false,
  "is_favourited": null
}
```

| Field | Source column | Rule |
| :--- | :--- | :--- |
| `distance_m` | computed `ST_Distance` | Integer metres. **Absent** when `location_precision` is `CITY` — a distance from a city centroid is noise |
| `rating.average` | `rating_avg` | **`null` when `count < 3`** (`BR-REV-07`). `displayable` states which case this is so the client renders the explanation rather than a zero |
| `rating.count` | `rating_count` | Always present, even below the floor — the count is honest information |
| `lowest_monthly_equiv_minor` | `lowest_monthly_equiv_minor` | `FR-SRCH-06`, `FR-DETL-03`. **Normalised** so a ₹18,000 annual plan and a ₹1,899 monthly plan compare correctly |
| `is_verified` | derived from `status='APPROVED'` | Always `true` in a search result — an unapproved gym is not in the projection. Present because the same card renders in contexts where it must be shown |
| `is_featured` | `featured_until > now()` | `FR-SRCH-11`: the API returns the flag; the client **must** label it as promoted. Never inferred from position |
| `is_favourited` | not in the projection | `null` when unauthenticated. Hydrated by the client from `GET /me/favourites` (`Marketplace.md`) — a per-user join would defeat the shared cache of §8.3 |
| `top_amenities` | `top_amenity_ids` | Exactly three, in taxonomy sort order — **not** the three that matched the filter, which would make two searches show different cards for the same gym |

### 3.7 Facets

Counts for the filters the user has **not** yet applied, so a filter can display its result count
before it is tapped (`SCR-WEB-002`: *"Each filter shows a live result count"*).

Facets are computed over the result set **with the faceted dimension's own filter removed** — the
amenity facet counts what would match if only the amenity constraint changed. Computing them with
all filters applied would show zero next to every unselected option, which is technically true and
completely useless.

Ten faceted dimensions at `NFR-PERF-01` latency is the expensive part of this endpoint.
`Scalability.md` §6.4 caches the facet block separately on a coarser key (location rounded to
~1 km, filters excluding the faceted dimension) with a 300-second TTL, because facet counts tolerate
staleness that result rows do not.

### 3.8 Errors

| Code | HTTP | When |
| :--- | :-: | :--- |
| `LOCATION_REQUIRED` | 422 | No `lat`/`lng`, `pincode` or `city_slug`. Carries the served-city list (§9.1) |
| `CITY_NOT_SERVED` | 422 | Valid city, `is_served = false`. Carries the nearest served city (§9.2) |
| `PINCODE_UNRESOLVABLE` | 422 | Well-formed but unknown PIN |
| `COORDINATE_PRECISION_EXCEEDED` | 400 | More than 6 dp on `lat`/`lng` (§11.4) |
| `RADIUS_OUT_OF_BOUNDS` | 400 | Outside 500…50,000 m |
| `TOO_MANY_AMENITY_FILTERS` | 400 | More than 12 |
| `INVALID_SORT_FIELD` | 400 | Outside the §4.7 allowlist |
| `MAP_BOUNDS_NOT_ENABLED` | 400 | Bounds supplied while `search_map_bounds` is off |
| `VALIDATION_FAILED` | 400 | Any `.strict()` violation, naming the offending parameter |
| `RATE_LIMITED` | 429 | `RL-SEARCH` |

**There is no `404` and no empty-array-with-no-guidance.** Zero matches is a `200` carrying the §5
relaxation payload.

---

## 4. Ranking — `FR-SRCH-10`

### 4.1 The six factors

| Factor | Source | Why |
| :--- | :--- | :--- |
| **Distance** | `ST_Distance` normalised over `radius_m` | The dominant signal. `B2.2`: Priya wants what is *near* |
| **Rating, Bayesian-adjusted** | `rating_bayes` | A 5.0 from three reviews must not outrank a 4.6 from two hundred |
| **Listing freshness** | `freshness_score` | `FR-GYM-12`, `RSK-11`. Stale listings are demoted, which is the enforcement mechanism behind *"never show a price that cannot be bought"* |
| **Conversion rate** | `conversion_rate_bps` | Detail-view → checkout, smoothed. Rewards listings that convert rather than merely attract |
| **Featured status** | `featured_until` | `A6.1` stream 3. **A bounded boost, never a guaranteed top slot** — see §4.4 |
| **Profile completeness** | `completeness_pct` | Rewards the behaviour `KPI-02` and `RSK-09` need |

### 4.2 Bayesian adjustment, and the two-rating problem

`FR-REV-08` is explicit: the Bayesian figure ranks, the plain mean displays.

```text
rating_bayes = (C × m + Σ ratings) / (C + n)
```

with `C` the confidence constant and `m` the platform prior mean, both runtime configuration.

**The card returns the plain mean.** `rating_bayes` is never in a response body. Two numbers exist
and only one is public — which `Reviews.md` also states, because a reviewer who finds the discrepancy
in the code and "fixes" it would silently change ranking for every gym on the platform.

### 4.3 The formula is configuration, so it cannot be an index

`Indexes.md` §11.4 establishes this and it is the central performance constraint of the endpoint. An
expression index is fixed at creation; a runtime-configurable expression would silently stop using it
while still returning correct results, slowly — a failure that looks like a capacity problem and is
actually a configuration change.

**So: the index narrows, the expression orders.**

| Stage | Mechanism | Output |
| :-: | :--- | :--- |
| 1 | `gist_search_documents__location` — `ST_DWithin` | Rows in radius |
| 2 | Scalar and GIN predicates | Rows matching filters |
| 3 | **Candidate-set ceiling** | ≤ **500** rows |
| 4 | Ranking expression, in memory | Ordered |
| 5 | `limit` + cursor | Page |

**The ceiling is 500** (`Scalability.md` §5). Beyond it, the set is truncated by raw distance
before ranking and the response sets `ranking_truncated: true`. This is honest degradation: in a
dense metro at a 10 km radius the 501st-nearest gym was not going to rank first on any weighting.

`Monitoring.md` alerts when truncation exceeds a share of searches — the signal that either the
ceiling or the default radius needs revisiting (`OI-X5` in `Indexes.md` §13.3).

### 4.4 Featured placement is bounded

`FR-SRCH-11` requires promoted results to be *"visually and textually labelled"*. Three rules make
that honest rather than cosmetic:

1. The boost is **additive and capped** — it cannot move a 12 km gym above a 900 m one.
2. **At most two** featured results in any page of twenty.
3. `is_featured` is on the card; the client renders the label. **A featured result that renders
   unlabelled is a compliance defect**, not a styling bug.

### 4.5 Weight configuration

```jsonc
// illustrative — not committed code
{
  "version": "2026-08-01.3",
  "weights": { "distance": 0.40, "rating_bayes": 0.20, "freshness": 0.15,
               "conversion": 0.10, "completeness": 0.10, "featured_boost": 0.05 },
  "bayesian": { "confidence_c": 20, "prior_m": 3.8 },
  "featured": { "max_per_page": 2, "max_rank_displacement": 3 },
  "candidate_ceiling": 500
}
```

Changed through `PUT /v1/admin/config/...` (`Admin.md`), audited with a reason like every
configuration change, and stamped into `ranking_version` on every response.

### 4.6 `collapse_by_gym`

Default `true`: one card per gym, the nearest matching branch. `false` returns every matching branch
— which is what `SCR-WEB-002`'s map needs, since a hidden branch is a missing pin.

### 4.7 The `sort` allowlist

`relevance` (default) · `distance` · `price_asc` · `rating` · `newest`.

A closed allowlist, not a field name passed through. `price_asc` sorts on
`lowest_monthly_equiv_minor`; `rating` sorts on **`rating_bayes`**, not the displayed mean, and
excludes gyms below the three-review floor rather than sorting them as zero.

---

## 5. Zero results — `FR-SRCH-12`

A search that matches nothing is a `200` carrying a repair kit. `AC-SRCH-01.2` requires the response
to name **which filter is most restrictive** and offer a single-tap relaxation **with the resulting
count previewed**. Both halves are server obligations — the client cannot compute either without
issuing the counterfactual searches itself.

```jsonc
// illustrative — not committed code
{
  "results": [],
  "total_estimated": 0,
  "zero_result_guidance": {
    "most_restrictive_filter": {
      "parameter": "open_at",
      "label": "Open at 06:00",
      "results_if_removed": 23
    },
    "relaxations": [
      { "action": "REMOVE_FILTER",  "parameter": "open_at",
        "label": "Show gyms open at any time",       "result_count": 23 },
      { "action": "EXPAND_RADIUS",  "parameter": "radius_m",
        "label": "Search within 5 km instead of 3 km","result_count": 11,
        "suggested_value": 5000 },
      { "action": "RELAX_PRICE",    "parameter": "price_max_minor",
        "label": "Increase budget to ₹2,500/month",   "result_count": 8,
        "suggested_value": 250000 }
    ],
    "nearby_cities": [
      { "city_slug": "mysuru", "city_name": "Mysuru", "distance_km": 143, "gym_count": 12 }
    ]
  }
}
```

### 5.1 How "most restrictive" is determined

For each applied filter, the server counts what would match with **that one filter removed** and all
others intact. The filter whose removal recovers the most results is the most restrictive.

This is `n` counting queries for `n` applied filters. It is affordable **only because it runs on the
zero-result path**, which is by definition a small share of traffic and already has no rows to
serialise. `Monitoring.md` tracks the zero-result rate; if it rises above a threshold this
computation stops being cheap, and that threshold is itself the signal that discovery is failing —
which is the more important alarm.

Relaxations are ordered by **recovered results descending**, capped at three. A relaxation recovering
zero is omitted rather than offered, because a suggestion that fixes nothing erodes trust in the rest.

### 5.2 Radius expansion is offered, never applied

The response suggests 5 km; it does not silently return 5 km results. A user who set 3 km meant 3 km,
and quietly widening it produces the *"why am I seeing gyms in Whitefield"* reaction that makes people
stop trusting a filter set.

### 5.3 Nearby cities

Populated only when the served-city list has a city within a configurable distance that has results.
`C9.4`'s city gating means an ungated city is excluded even when it has gyms — a consumer must not be
sent to a city that has not opened.

---

## 6. `GET /v1/search/suggest`

**Purpose** locality and gym-name autocomplete · **Surfaces** `web` (`SCR-WEB-001` hero,
`SCR-WEB-002` search bar) · **Auth** optional · **Permission** none, `@Public()` · **Scope**
`public` · **RL** `RL-SEARCH` — with the caveat of finding S-F05 · **Cache**
`public, max-age=300`.

| Parameter | Type | Default | Notes |
| :--- | :--- | :--- | :--- |
| `q` | string | — | **Required**, 2…64 chars. Below 2 the client must not call — the server returns an empty array rather than the whole taxonomy |
| `lat` / `lng` | decimal | — | Optional. Biases results toward the user without filtering them out |
| `types` | repeated enum | all | `LOCALITY`, `CITY`, `GYM` |
| `limit` | integer | `8` | 1…15 |

```jsonc
// illustrative — not committed code
{
  "suggestions": [
    { "type": "LOCALITY", "id": "l_indiranagar", "label": "Indiranagar",
      "sublabel": "Bengaluru", "city_slug": "bengaluru", "gym_count": 34,
      "lat": 12.9784, "lng": 77.6408 },
    { "type": "GYM", "id": "0192f3a1-...", "label": "Iron Works Gym",
      "sublabel": "Indiranagar, Bengaluru", "slug": "iron-works-indiranagar",
      "city_slug": "bengaluru" }
  ]
}
```

A `LOCALITY` or `CITY` suggestion carries coordinates so selecting it needs no second round trip. A
`GYM` suggestion carries its slug so selection navigates straight to detail, skipping search entirely
— the fastest path in the product for a user who already knows the name.

### 6.1 Matching

Trigram similarity (`gin_localities__name_trgm`, and the gym-name trigram on the projection), not
full-text. `FR-SRCH-02` requires typo tolerance, and `tsvector` has none: **`"crossfitt"` matches
nothing under full-text and matches correctly under trigram.**

Localities rank above cities above gyms at equal similarity, because a locality narrows a search
while a gym name ends it — and a user who typed three characters is usually still narrowing.

### 6.2 Latency

**p95 ≤ 150 ms**, tighter than the `NFR-PERF-01` search budget. This fires on every keystroke past
the client's 150 ms debounce, so a 500 ms budget would make the field feel broken. Achieved by
serving from Redis with a 300-second TTL keyed on the normalised prefix; the trigram query is the
cache miss.

### 6.3 Errors

`400 VALIDATION_FAILED` (`q` too short or too long) · `429 RATE_LIMITED`. **No `404`** — no matches
is an empty array, which is a normal state for an autocomplete.

---

## 7. Visibility — `FR-SRCH-09`

> *Only `APPROVED`, non-suspended gyms with ≥1 published public plan appear.*

Enforced by **what enters the projection**, not by a filter at query time. A row exists in
`search_documents` only while all five conditions hold:

| # | Condition | Rule |
| :-: | :--- | :--- |
| 1 | `gyms.status = 'APPROVED'` | `BR-GYM-01` — and `BR-GYM-03` makes that a human decision |
| 2 | `tenants.status ≠ 'SUSPENDED'` | `BR-TEN-05` — removed from search **immediately** |
| 3 | ≥ 1 plan `PUBLISHED` **and** `visibility = 'PUBLIC'` | `BR-PLN-05` — a staff-only plan is never on a public surface |
| 4 | `branches.status = 'ACTIVE'` | An inactive branch is not a place you can go |
| 5 | `gyms.deleted_at IS NULL` | `SD3` |

**The projection is the enforcement point, so the failure mode is deletion, not filtering.** When a
tenant is suspended the outbox consumer *removes* its rows. There is no `WHERE status = 'APPROVED'`
in the search query that a future refactor could drop.

> **Why this is stronger than a predicate.** A predicate omitted by mistake leaks unapproved gyms into
> public search — the exact `RSK-01` failure the whole verification apparatus exists to prevent. A row
> that was never written cannot leak. The isolation suite asserts the negative: a suspended tenant's
> gym must return zero rows from `/search/gyms` within the projection's propagation window.

**The propagation window is the honest weakness.** `BR-TEN-05` says *immediately* and the outbox is
near-real-time but not synchronous. Measured lag is the `OI-S4` open item, and `Monitoring.md` alerts
if it exceeds the `FR-ONB-13` sixty-second budget in either direction — a suspended gym lingering is
a trust failure, and an approved gym missing is a `KPI-03` failure.

---

## 8. Performance and caching

### 8.1 The budget

`NFR-PERF-01`: **p95 ≤ 500 ms, p99 ≤ 1000 ms**, server-side, excluding client render.
`NFR-PERF-09`: **2,000 searches/minute sustained** — 33/second.

| Hop | p50 | p95 | Notes |
| :--- | ---: | ---: | :--- |
| Gateway, TLS, routing | 5 ms | 15 ms | |
| Validation (Zod `.strict()`) | 1 ms | 3 ms | |
| Location resolution | 0 ms | 20 ms | 0 on `lat`/`lng`; a PIN or city lookup is a cached read |
| **PostGIS + filters → candidates** | 25 ms | **90 ms** | The GiST scan and predicate filtering |
| Ranking in memory (≤ 500) | 4 ms | 12 ms | |
| Facets | 30 ms | **110 ms** | Separately cached (§3.8) — the most expensive block |
| Card serialisation | 6 ms | 18 ms | |
| Analytics enqueue | 1 ms | 2 ms | Outbox insert, never blocking |
| **Total** | **72 ms** | **270 ms** | Headroom against the 500 ms p95 |

The headroom is deliberate. `NFR-SCAL-02` requires 10× without re-architecture, and a budget consumed
at launch has none.

### 8.2 What must never enter the hot path

- **No join to `gyms`, `plans` or `branch_hours`.** Everything is projection columns (§2.1).
- **No per-user data.** `is_favourited` is `null` server-side (§3.6) precisely so one cached response
  serves every user.
- **No exact count.** §3.4.
- **No `ORDER BY ST_Distance(...)`** — the function form is not indexable. The `<->` KNN operator is
  (`Indexes.md` §5.2). A review that sees the function form in this path rejects it.

### 8.3 Caching

| Layer | Key | TTL | Invalidated by |
| :--- | :--- | :--- | :--- |
| CDN | Full normalised query string, location rounded to ~100 m | 60 s | TTL only |
| Redis result | Same, plus `ranking_version` | 60 s | Projection write for any gym in the tile |
| Redis facet | Coarse: location ~1 km, filters minus the faceted dimension | 300 s | TTL only |
| Redis suggest | Normalised prefix | 300 s | TTL only |

**Location is rounded into the cache key before it is used**, which serves the privacy requirement of
§11.4 and the hit rate simultaneously — two users 50 m apart share a cache entry, and neither's exact
position is ever a key.

> **The 60-second TTL and `BR-PLN-03`.** A cached card can be at most 60 seconds stale, so a price
> changed at T is visible in search until T+60. This does **not** violate `BR-PLN-03`, because that
> rule binds *checkout*, and checkout re-validates server-side against live plan data and aborts on
> mismatch (`AC-PLAN-02.2`). The cache can show a price briefly out of date; it can never cause the
> wrong price to be **charged**. That distinction is the whole reason re-validation exists, and
> `Marketplace.md` §8 makes the identical argument for gym detail at a longer TTL.

### 8.4 `stale-while-revalidate`

`stale-while-revalidate=120` lets the CDN serve a 61-second-old response while refreshing behind it.
Under a traffic spike — a city launch, a campaign — this is what keeps p95 flat instead of every
expired key stampeding the origin simultaneously.

---

## 9. Edge cases

### 9.1 Geolocation denied → city selector, never an empty state

The `SRCH` edge-case list is explicit: *"fall back to a city selector, never an empty state."*
`422 LOCATION_REQUIRED` therefore carries the payload the selector needs:

```jsonc
// illustrative — not committed code
{
  "error": {
    "code": "LOCATION_REQUIRED",
    "message": "Choose a city to see gyms near you.",
    "details": [],
    "correlation_id": "01J9Z7..."
  },
  "served_cities": [
    { "city_slug": "bengaluru", "city_name": "Bengaluru", "gym_count": 218 }
  ]
}
```

An error envelope carrying a data block is unusual and deliberate: the client must render something
useful, and a second round trip to `GET /cities` to recover from a `422` is a worse experience than
one slightly unconventional response. Recorded as an intentional deviation from `README.md` §9.

### 9.2 Outside any served city

`422 CITY_NOT_SERVED` with the nearest served city and its distance — and the location is **captured
as a demand signal** (`A11`, city expansion). The capture is precision-reduced like every other
location record (§11.4); expansion planning needs city-level demand, not household coordinates.

### 9.3 Every gym in radius suspended

Treated as **zero results with the §5 payload**, never as a list of unavailable gyms. Rows leave the
projection on suspension, so this needs no special handling — it is the general zero-result path.

### 9.4 Dense areas

Map pins cluster with counts, expanding on zoom. The `map.clusters` block is server-computed because
clustering 500 candidates client-side on a mid-range Android phone is where `NFR-PERF-02`'s LCP
budget goes.

### 9.5 A gym with no displayable rating

`rating.average` is `null`, `displayable` is `false`, `count` is honest. Ranking uses `rating_bayes`,
which is defined for every gym because the prior supplies the missing mass — so a new gym is neither
excluded nor flattered.

---

## 10. Degradation — `NFR-AVL-03`

> *Loss of maps, search indexing, notifications or analytics must not prevent check-in, purchase or
> payment.*

| Failure | Search behaviour | User sees |
| :--- | :--- | :--- |
| **Maps provider down** (`DEP-02`) | **List renders fully.** `map.available: false` | `AC-SRCH-02.3`: a graceful notice in the map pane, list unaffected |
| Redis cache down | Every request is a cache miss | Slower; p95 degrades toward 400 ms; correct results |
| Replica lag high | `as_of` skews | Recently approved gyms appear late |
| Projection consumer stalled | Results go stale | **Alerted.** Beyond a threshold, `BR-PLN-03`'s risk is real enough to warrant the `search` kill switch |
| PostGIS unavailable | `503` on search | Purchase, check-in and payment **continue** — the point of `NFR-AVL-03` |

`map.available: false` is a first-class response field, not an omission. A client cannot distinguish
*"no pins because the provider is down"* from *"no pins because nothing matched"* by absence, and
those need different UI.

---

## 11. Analytics — `FR-SRCH-15`, and the location-privacy obligation

### 11.1 Events emitted

| Event | When | Key properties |
| :--- | :--- | :--- |
| `search_performed` | Every `/search/gyms` | `query`, **precision-reduced** `lat`/`lng`, `radius_m`, `filters`, `sort`, `result_count`, `ranking_version` |
| `search_filter_applied` | Client-emitted, server-enriched | `filter_name`, `filter_value`, `result_count_before`, `result_count_after` |
| `search_zero_results` | `result_count = 0` | `filters`, `most_restrictive_filter` |
| `search_result_clicked` | Client-emitted | `gym_id`, `position`, `is_featured` |
| `map_area_searched` | `FR-SRCH-08` bounds search | `bounds_area`, `result_count` |

`result_count_before/after` and `most_restrictive_filter` are **server-supplied** — the client cannot
compute a counterfactual count.

### 11.2 The events are the `KPI-09` instrument

`KPI-09` (search-to-detail ≥ 45%) is `search_result_clicked` over `search_performed`. `KPI-10`
(detail-to-checkout ≥ 8%) chains through `gym_detail_viewed`. If these events are wrong, the two
metrics the marketplace is steered by are wrong — which is why they are contract obligations of the
endpoint rather than a client concern.

### 11.3 Emission never blocks

Outbox insert inside the request transaction, dispatched by a worker (`ADR-0017`). Analytics
unavailability degrades to a queue backlog, never a failed search — `NFR-AVL-03` again.

### 11.4 Location precision — finding S-F06 restated as a contract

**This is the privacy-critical part of the document.**

`BR-DAT-06` forbids personal data in logs, traces and analytics. A raw coordinate pair at six decimal
places locates a person to roughly **0.1 metres** — which household, which floor. Finding S-F06
records that the `BR-DAT-06` redaction list currently contains **no location field at all**, so a
default request-logging interceptor would write
`GET /search/gyms?lat=12.934512&lng=77.610134` into the log aggregator and defeat the requirement
entirely.

Four rules, all binding on this endpoint:

| # | Rule |
| :-: | :--- |
| **PR1** | **Analytics carry 2 decimal places** — ~1.1 km. Enough for city and locality demand analysis, not enough to locate a person |
| **PR2** | **Access logs record the path only** for `/search/*`. Never the raw query string |
| **PR3** | **`lat`, `lng` and `pincode` are added to the `BR-DAT-06` redaction list.** Required change to `BusinessRules.md` |
| **PR4** | **Cache keys round to ~100 m** (§8.3). A cache key is stored and inspectable, so it is a disclosure surface |

Requests are capped at 6 dp (`COORDINATE_PRECISION_EXCEEDED`) because more precision is meaningless
for gym search and only increases what a compromised log would reveal.

> `OI-S1` tracks the `BusinessRules.md` amendment. **Until it lands, PR2 is the only control
> standing between a request log and a household-resolution location trace** — and PR2 is one
> interceptor configuration away from being switched off by someone who does not know why it is
> there. That is why this is a finding rather than a note.

---

## 12. Error registry

Codes owned by this document. Shared codes live in `README.md` §9.

| Code | HTTP | Retryable | User-facing message |
| :--- | :-: | :-: | :--- |
| `LOCATION_REQUIRED` | 422 | after selection | *"Choose a city to see gyms near you."* |
| `CITY_NOT_SERVED` | 422 | ✗ | *"We're not in Mysuru yet. The nearest city we serve is Bengaluru, 143 km away."* |
| `PINCODE_UNRESOLVABLE` | 422 | ✗ | *"We couldn't find that PIN code. Try a city or locality instead."* |
| `COORDINATE_PRECISION_EXCEEDED` | 400 | after rounding | Developer-facing; a real client never triggers it |
| `RADIUS_OUT_OF_BOUNDS` | 400 | ✗ | *"Choose a distance between 0.5 km and 50 km."* |
| `TOO_MANY_AMENITY_FILTERS` | 400 | ✗ | *"You can filter by up to 12 amenities."* |
| `INVALID_SORT_FIELD` | 400 | ✗ | Developer-facing |
| `MAP_BOUNDS_NOT_ENABLED` | 400 | ✗ | Developer-facing; flag off |
| `VALIDATION_FAILED` | 400 | ✗ | Names the parameter |
| `RATE_LIMITED` | 429 | after `Retry-After` | *"Too many searches. Try again in a few seconds."* |
| `DEPENDENCY_UNAVAILABLE` | 503 | ✔ | *"Search is temporarily unavailable. You can still open a gym you've saved."* |

---

## 13. Traceability, risks and open items

### 13.1 Traceability

| Requirement | Section |
| :--- | :--- |
| `FR-SRCH-01` location determination | §3.2, §3.3, §9.1 |
| `FR-SRCH-02` free-text + typo tolerance | §3.2, §6.1 |
| `FR-SRCH-03` the filter set | §3.2 |
| `FR-SRCH-04` sort | §4.7 |
| `FR-SRCH-05` list/map sync | §3.4 `map` block |
| `FR-SRCH-06` result card | §3.6 |
| `FR-SRCH-07` pagination | §3.2, §3.4 |
| `FR-SRCH-08` search this area | §3.2 (flag-gated) |
| `FR-SRCH-09` visibility | §7 |
| `FR-SRCH-10` ranking | §4 |
| `FR-SRCH-11` featured labelling | §3.6, §4.4 |
| `FR-SRCH-12` zero results | §5 |
| `FR-SRCH-13` SEO landings | `Marketplace.md`; card shared per §1.3 |
| `FR-SRCH-15` analytics | §11 |
| `AC-SRCH-01.1/.2/.3` · `AC-SRCH-02.2/.3` | §3.2, §5, §3.5, §3.2, §10 |
| `NFR-PERF-01` · `-09` | §8.1 |
| `BR-GYM-01` · `BR-TEN-05` · `BR-PLN-05` · `BR-REV-07` · `BR-DAT-06` | §7, §7, §7, §3.6, §11.4 |
| `KPI-09` · `KPI-23` | §11.2, §8.1 |

### 13.2 Risks

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **`RL-SEARCH` session budget too tight** (finding S-F05) | A fast, legitimate user is rate-limited mid-search | Split `RL-SUGGEST` at 120/min. **Unresolved** — `OI-S2` |
| **Location in logs** (finding S-F06) | `BR-DAT-06` breach; household-resolution trace | PR1–PR4. PR3 unresolved — `OI-S1` |
| Ranking config error | Bad ordering platform-wide, no deploy to roll back | `ranking_version` on every response; config change audited with a reason; `Monitoring.md` alerts on CTR shift |
| Candidate ceiling truncation | Best match invisible in a dense metro | `ranking_truncated` flag; alert on rate; ceiling is configuration |
| Projection lag | Suspended gym still listed (`RSK-01`); approved gym missing (`KPI-03`) | Alert both directions against the 60 s budget |
| Facet cost | Ten dimensions at p95 | Separate coarse cache, 300 s |
| Trigram at scale | Degrades past ~50k listings | `ADR-0007`'s OpenSearch trigger |

### 13.3 Open items

| # | Item | Owner |
| :-: | :--- | :--- |
| **OI-S1** | Add `lat`, `lng`, `pincode` to the `BR-DAT-06` redaction list (PR3). **Privacy-blocking; must land before any request logging is enabled in a shared environment** | Engineering |
| **OI-S2** | Split `RL-SUGGEST` from `RL-SEARCH` in `API_Catalog.md` §4.2 (finding S-F05) | Engineering |
| **OI-S3** | Expand `Schema.md` §13.4 to the full `Scalability.md` §6.3 column set (finding S-F02), and settle the table name (S-F01) | Engineering |
| **OI-S4** | Define and alert on the projection propagation window; `BR-TEN-05` says *immediately* and the outbox is not synchronous | Engineering |
| **OI-S5** | Amenity synonym ring (`Indexes.md` `OI-X2`) has no owner; `FR-SRCH-02` synonyms are unserved without it | Operations |
| **OI-S6** | The `'simple'` text-search configuration is provisional pending the launch-city language review (`Indexes.md` `OI-X1`) | Product |
| **OI-S7** | `API_Catalog.md` §3.3 should gain `FR-SRCH-08` and `FR-SRCH-15` (finding S-F04) | Engineering |

---

*End of Search.md.*
