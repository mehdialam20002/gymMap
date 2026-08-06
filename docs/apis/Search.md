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

<!-- APPEND-MARKER -->
