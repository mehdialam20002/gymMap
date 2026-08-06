# `API-DISC` (non-search) + `API-FAV` — Marketplace: the frozen endpoint contract

**Modules:** `discovery`, `catalog` · **Groups:** `DISC`, `FAV` · **Surface count:** 16 endpoints —
10 public discovery reads, 6 authenticated favourites/saved-search operations · **Status:** contract
frozen, no code written · **Launch market:** India (`LAUNCH_MARKET_INDIA.md`) · **Realtime posture:**
A-08 — TanStack Query polling at 10–15 s. **No endpoint in this document streams, upgrades, or holds
a socket open.**

---

## 0. Document control

| Aspect | Value |
| :--- | :--- |
| Owns | Ten of the thirteen `API-DISC` rows of `API_Catalog.md` §3.3, and all six `API-FAV` rows of §3.4, in per-endpoint detail |
| Authoritative index | **`docs/engineering/API_Catalog.md`** — the master endpoint table, the conventions, the error registry, the rate-limit classes, the permission grammar. This document **cites** it and never restates it |
| Contract law | **`docs/apis/README.md`** — the per-endpoint template (§1.4), the twelve enforcement-layer codes (§1.5), the seventeen-code status set (§9.2), the cursor and `ETag` policy |
| Governing law | `PROJECT_CONSTITUTION.md` §13 (Error Handling Law) and §14 (API Rules). Nothing here may contradict either |
| Product source | `MASTER_PRD.md` `B5.7` (`DETL`), `B5.8` (`FAV`), `B5.6` (`SRCH` — for `FR-SRCH-09`/`FR-SRCH-13` only), `B5.5` (`NAV`), `A8.1`–`A8.2` (`BR-GYM`, `BR-PLN`), `A8.8` (`BR-REV`), `C3.1`/`C3.2`, `C6` (analytics), `SCR-WEB-003`/`SCR-WEB-004` |
| Physical model | `docs/database/Schema.md` §5.1 `gyms`, §5.2 `branches`, §5.3 `branch_hours` + `branch_hour_exceptions`, §5.4 `gym_amenities` + `gym_media`, §5.5 `saved_searches`, §6.1 `plans`, §6.2 `plan_branches`, §10.1 `reviews` + `review_responses`, §4.12 `favourites`, §12.1 `cities`/`localities`, §12.2 `amenities`/`gym_categories`, §13.4 `search_documents` |
| Enforcement split | `docs/database/Constraints.md` §13.1 (`BR-TEN`/`BR-GYM`), §13.2 (`BR-PLN`), §13.7 (`BR-REV`). Everything those matrices grade `NONE` or `PARTIAL` is **this layer's** job, and §12 below states which |
| Rule detail | `docs/engineering/BusinessRules.md` — `BR-GYM-01` (§7), `BR-PLN-03`/`BR-PLN-05` (§11), `BR-REV-03`/`BR-REV-07` (§17), `BR-TEN-05` (§6, §18.5) |
| Security | `docs/engineering/Security.md` — the `@Public()` compensating-control set, `RL-PUBLIC`/`RL-SEARCH` tiers, the crawler allowlist |
| Not owned here | `GET /v1/search/gyms` and `GET /v1/search/suggest` — **`Search.md`**. `POST /v1/gyms/:slug/report` — see §1.4. Review *submission* and moderation — **`Reviews.md`**. Plan authoring — **`Gym.md`**. Checkout — **`Payments.md`** and the `ordering` half of `Membership.md` |

> **Every fenced block in this document is labelled `illustrative — not committed code`. No
> application code exists. Zod sketches, TypeScript interfaces and JSON bodies here are the
> *contract*, expressed in the notation the implementation will use; they are not the
> implementation.**

---

## 1. Position, scope boundary, and three findings in the master index

### 1.1 The non-duplication contract

`apis/README.md` §1.1 fixes the three-artefact division: the catalogue answers *which endpoints
exist*, the contract law answers *what rules every endpoint obeys*, and this file answers *what these
sixteen endpoints do*. Accordingly:

| Convention | Defined in | What this document does |
| :--- | :--- | :--- |
| Base `https://api.<domain>/v1`, URL versioning | `API_Catalog.md` §1.1 | Cites. Every path below is relative to it |
| `snake_case` bodies and query names; money as `<name>_minor` **strings** plus adjacent `currency` | §1.2.1 R1–R8, §1.2.3 M1–M6 | Cites. Every amount below is a string of **paise** |
| Timestamps ISO-8601 UTC with `Z`; business dates `YYYY-MM-DD` with the interpreting timezone named per field | §1.2.4 T1–T5 | Cites. Every hours field below is **local wall-clock in `Asia/Kolkata`** and says so |
| Tenant derived from token or resource, **never** the client | §1.5, decision-table row 1 | Cites, and §2 shows exactly how row 1 resolves for an unauthenticated read |
| Cursor pagination `limit` + `cursor`, `next_cursor` terminates | §1.7.1–§1.7.6 | Cites. Applies to `GET /gyms/:slug/reviews` and `GET /me/favourites` only |
| The five offset exceptions — reference data returned whole, `POST /compare` unpaginated | §1.7.4 rows 3 and 4 | Cites. `/amenities`, `/categories`, `/cities` and `/compare` are **not paginated** |
| Error envelope `code` / `message` / `details` / `correlation_id` | §1.9 EV1–EV7 | Cites. §13.4 is the `discovery` slice of the §6.6 registry, expanded per endpoint |
| Rate-limit classes and headers | §1.10, §4.2 | Cites. §13.1 gives the per-endpoint class and the crawler exemption |
| Cache tokens `CDN-3600` / `CDN-300` / `CDN-60` / `NO-STORE` | §1.11 | Cites, and §3 resolves the one place the token alone is insufficient |
| Permission grammar `<module>.<resource>.<action>` | §5.1 | Cites. §13.2 maps the `B3.2` capabilities these endpoints need |

### 1.2 Finding 1 — a real inconsistency: `POST /me/favourites` versus `POST /me/favourites/:gymId`

| Source | Rank | Statement |
| :--- | :-: | :--- |
| `MASTER_PRD.md` `§C3.2 API-FAV` | 2 | `GET/POST/DELETE` · `/me/favourites` · `/me/favourites/:gymId` — **one row covering both paths for all three verbs** |
| `API_Catalog.md` §3.4 | 3 | `POST /me/favourites` (gym identified in the **body**) and `DELETE /me/favourites/:gymId` |

These are not the same contract, and the asymmetry is not harmless: an `Idempotency-Key`
fingerprint is computed over *the resolved route pattern plus the resolved path-parameter values*
plus the canonicalised body (`API_Catalog.md` §1.6.3 components 2 and 5). With the gym in the body,
the fingerprint of "favourite gym A" and "favourite gym B" differ only inside component 5; with the
gym in the path they differ in component 2 as well, which is the form every other create-by-reference
endpoint on the platform uses.

**Resolution `MKT-R1`, adopted by this document.** The canonical create is
**`POST /v1/me/favourites/:gymId`**, with **no request body**. Reasons, in precedence order:

1. `MASTER_PRD.md` is rank 2 and names `/me/favourites/:gymId` on the `POST` row. `API_Catalog.md`
   is rank 3. Under `apis/README.md` §1.2 the PRD wins on *what the contract is*.
2. It makes `POST` and `DELETE` structurally symmetrical, which is what makes the pair testable as
   one idempotent toggle.
3. A body-less `POST` cannot carry a `tenant_id`, a price, or any other field the client must never
   send — `BR-PAY-04` and `API_Catalog.md` §1.5 TD1 become unreachable by construction rather than
   by a `.strict()` rejection.

`API_Catalog.md` §3.4's `POST /me/favourites` row should be amended to `POST /me/favourites/:gymId`.
Recorded as open item **`O-MKT-1`** (§14.2). **No endpoint is added or removed by this finding.**

### 1.3 Finding 2 — `GET /me/favourites` cannot be `NO-STORE` alone

`API_Catalog.md` §3.4 assigns `GET /me/favourites` the `NO-STORE` token (`private, no-store`). That
is correct and insufficient: the response embeds a **current price** for every favourited gym
(`FR-FAV-02`), so it is subject to `BR-PLN-03` in exactly the way §3 describes, and it is served to
an authenticated principal whose identity must never key an intermediary cache. This document
applies **`NO-STORE!`** semantics to it — `private, no-store` **plus `Vary: Authorization`** — while
leaving the catalogue's token unchanged, because the difference is a header, not a policy class.
Recorded as **`O-MKT-2`**.

### 1.4 Finding 3 — `POST /gyms/:slug/report` has no owning domain file

`API_Catalog.md` §3.3 carries a thirteenth `API-DISC` row, `POST /gyms/:slug/report` (derived from
`FR-DETL-06`), authenticated, permission `discovery.gym.report`, class `RL-WRITE`. The Phase-5 split
assigns it to no domain file: it is not search (`Search.md`), and this document's scope statement
does not list it. Its consumer — the moderation queue of `FR-ADMN-12` — is documented in `Admin.md`,
and its sibling `review_reports` intake is documented in `Reviews.md`.

**This document does not claim it.** It is recorded as **`O-MKT-3`**: `POST /gyms/:slug/report`
must be adopted by `Reviews.md` (which already owns the `*_reports` vocabulary and the nine
`§C4.8` `moderation_reason_enum` values) before the Phase-5 gate closes, or the `FR-RBAC-01` CI
gate will pass on a handler that no contract describes.

### 1.5 Scope, stated exhaustively

| # | Endpoint | §  |
| :-: | :--- | :-- |
| 1 | `GET /gyms/:slug` | §5 |
| 2 | `GET /gyms/:slug/plans` | §6 |
| 3 | `GET /gyms/:slug/reviews` | §7 |
| 4 | `GET /gyms/:slug/similar` | §8 |
| 5 | `POST /compare` | §9 |
| 6 | `GET /cities` | §10.1 |
| 7 | `GET /cities/:slug` | §10.2 |
| 8 | `GET /categories` | §10.3 |
| 9 | `GET /categories/:slug` | §10.4 |
| 10 | `GET /amenities` | §10.5 |
| 11 | `GET /me/favourites` | §11.1 |
| 12 | `POST /me/favourites/:gymId` | §11.2 |
| 13 | `DELETE /me/favourites/:gymId` | §11.3 |
| 14 | `GET /me/saved-searches` | §11.4 |
| 15 | `POST /me/saved-searches` | §11.5 |
| 16 | `DELETE /me/saved-searches/:id` | §11.6 |

Endpoints 1–10 are the **only** endpoints on the platform served to unauthenticated traffic at
volume. `FR-NAV-01` is the reason: *"the customer website is fully browsable without
authentication; the auth gate appears at 'select plan → checkout' and nowhere earlier."* Everything
in §2, §3 and §13.1 exists because of that sentence.

---

## 2. Tenant scope `public` — how RLS is satisfied when there is no tenant

This is the one place in the platform where the tenancy model works differently, and it is worth
being precise, because "public endpoint" is exactly the phrase under which a cross-tenant leak gets
written.

### 2.1 The problem stated exactly

`API_Catalog.md` §1.5 TD3 is absolute: every request that touches a **tenant-owned** table executes
`SET LOCAL app.tenant_id = $1` inside the same transaction, through the mandatory Prisma extension
(ADR-0005, A-01). `Schema.md` §2.6 makes the policy predicate
`current_setting('app.tenant_id')::uuid` with **no `missing_ok` argument**, so an unset variable
**raises SQLSTATE `42704`** rather than returning an empty set.

An anonymous visitor loading `GET /v1/gyms/iron-works-andheri` has no token, therefore no
`tenant_context`, therefore no value to set. Three wrong answers are available and all three have
been shipped by other people:

| Wrong answer | Why it is wrong |
| :--- | :--- |
| Accept a tenant hint from the client | `§C3.1` and `PROJECT_CONSTITUTION.md` §11.3 forbid it outright. `API_Catalog.md` §1.5 TD1 returns `400 TENANT_HEADER_NOT_ACCEPTED` rather than ignoring it |
| Give the public read path `BYPASSRLS` | `Schema.md` §2.2 property 2: **no role in the system holds `BYPASSRLS`**. Granting it here would be the one exception that makes `BR-TEN-01` unprovable everywhere |
| Set `app.tenant_id` to a sentinel and add `OR tenant_id = '00000000-…'` to 58 policies | Fifty-eight chances to write the predicate wrongly, and the sentinel becomes a skeleton key the moment one policy is generated by hand |

### 2.2 The answer: the public read path does not read tenant-owned tables

`Schema.md` §13.4 defines `search_documents` as tenancy class **`GLOBAL`** — no `tenant_id` RLS key,
RLS **not enabled**, grant class `G-REF`, *"it contains only `APPROVED`, publicly visible listings,
so it holds no tenant-private fact and is read by unauthenticated traffic."* That single sentence is
the whole tenancy answer for endpoints 1–10.

| Step | What happens |
| :--- | :--- |
| 1 | The handler carries `@Public()` and **no** `@RequiredPermission` — `API_Catalog.md` §3.0.1 correction 2 and §5.4's enumerated allowlist. There is no third state |
| 2 | It carries **no** `@TenantScoped()` decorator, so the tenant-context middleware resolves nothing and the Prisma extension issues no `SET LOCAL` |
| 3 | The use case reads through **`PublicPrismaService`** (`BusinessRules.md` `BR-GYM-01`, `L4-EXT`), a Prisma client whose delegate surface is restricted at the type level to the `GLOBAL` tables: `search_documents`, `cities`, `localities`, `amenities`, `gym_categories`, `countries` |
| 4 | Where the projection is insufficient — the detail page's plan catalogue, hours and reviews — the read runs under **`app_platform_ro`** through the named, audited elevation of `PROJECT_CONSTITUTION.md` §11.6, whose `P-PLATFORM` policy is `FOR SELECT … USING (true)`. It is a *second policy*, not a bypass, and it is visible in `pg_policies` (`Schema.md` §2.6) |
| 5 | Every such read composes the **`PublicVisibilityPredicate`** of §2.3 **inside the query**, never as a post-filter |

**Why an elevation and not a wider projection.** `search_documents` is deliberately one row per
publicly-visible **branch** with a fixed column set (`Schema.md` §13.4). Denormalising the full plan
catalogue, split operating hours, thirty media renditions and a paginated review stream into it would
make the projection larger than the tables it projects and would multiply the invalidation surface
that §3.3 has to keep correct. The elevation is narrower: it is read-only, it is `SELECT`-only, it
is named in code, and the isolation suite asserts the set of endpoints that use it.

### 2.3 `PublicVisibilityPredicate` — one predicate, seven surfaces

`BusinessRules.md` `BR-GYM-01` names it and makes it `AUTHORITATIVE` at `L6-UC`:

> *"one shared `PublicVisibilityPredicate` — `gyms.status = 'APPROVED'` AND tenant not
> `SUSPENDED`/`PAST_DUE`-beyond-7-days AND `≥1` published `PUBLIC` plan — used by every public read
> path: search, map bounds, category and city landing pages, comparison, favourites, sitemap,
> structured data."*

```ts
// illustrative — not committed code
// packages/types or discovery/domain — one definition, imported by every public read.
const PUBLIC_VISIBILITY = {
  gym_status:            'APPROVED',                  // BR-GYM-01, gym_status_enum
  gym_deleted_at:        null,                        // NFR-DQ-04 soft delete
  tenant_not_suspended:  true,                        // BR-TEN-05
  tenant_past_due_days:  { lte: 7 },                  // BR-TEN-06 degradation ladder
  has_published_public_plan: true,                    // FR-SRCH-09, BR-PLN-05
  branch_status:         'ACTIVE',                    // at least one
} as const;
```

| Clause | Rule | Where the database helps | What this layer must still do |
| :--- | :--- | :--- | :--- |
| `gyms.status = 'APPROVED'` | `BR-GYM-01` | `Constraints.md` §13.1 grades it **PARTIAL** — the projection is populated only for `APPROVED`, and the partial index `(status, rating_avg DESC, freshness_score DESC) WHERE status = 'APPROVED'` makes an unfiltered read visibly slow rather than silently wrong | Compose the clause on **every** non-projection read (plans, hours, reviews, media) |
| tenant not `SUSPENDED` | `BR-TEN-05` | **PARTIAL** — the projection excludes suspended tenants | Apply it to the detail read, and produce the `§5.6` informational payload instead of a bare row |
| tenant not `PAST_DUE` beyond 7 days | `BR-TEN-06` | **NONE** — `tenants.subscription_status` enum only | Entirely this layer, reusing the `BR-TEN-05` predicate (`BusinessRules.md` `BR-TEN-06`, `L6-UC`) |
| ≥1 published `PUBLIC` plan | `FR-SRCH-09`, `BR-PLN-05` | **PARTIAL** — `idx_plans__gym_status_visibility (gym_id, status, visibility)` means the public query never filters `STAFF_ONLY` out after the fact | Compose `status = 'PUBLISHED' AND visibility = 'PUBLIC'` in the query, not in the serialiser |

**`BR-PLN-05` deserves its own sentence.** *"A staff-only plan is never returned by any public API or
rendered on any public surface."* A `STAFF_ONLY` plan filtered in the DTO is a `BR-PLN-05` breach
that a serialisation bug re-opens. In this contract the visibility filter is a **`WHERE` clause on
every public plan read**, and `Reviews.md`-style absence assertions in CI (`L12-CI`) prove that no
public response schema in the generated OpenAPI document contains a `visibility` field at all — a
client cannot be trusted to hide what it should never have received.

### 2.4 The three consequences for endpoints 11–16

The `/me` prefix is decision-table row 2: *"the principal, not a tenant."* But `favourites` is a
**tenant-owned, RLS `P-STD` table** (`Schema.md` §4.12) while `saved_searches` is tenancy class
**`IDENTITY`** with RLS not enabled (`Schema.md` §2.6 exemption list). That asymmetry is real and
produces three different mechanics:

| Endpoint | Table | Tenant resolution | Mechanism |
| :--- | :--- | :--- | :--- |
| `GET /me/favourites` | `favourites` (RLS) | **None — the list crosses tenants** | `Schema.md` §4.12: *"the member's own list crosses tenants and is therefore served by a `user_id`-scoped endpoint running under platform read, not by a tenant session."* Reads under `app_platform_ro`, filtered `user_id = sub`, then re-composed with `PublicVisibilityPredicate` per row so `AC-FAV-01.3` can mark a suspended gym unavailable |
| `POST` / `DELETE /me/favourites/:gymId` | `favourites` (RLS) | **From the resource** — decision-table row 1 | The `:gymId` resolves to exactly one gym; that gym's `tenant_id` becomes the context and `SET LOCAL app.tenant_id` runs inside the write transaction. A gym id that fails `PublicVisibilityPredicate` is a `404`, indistinguishable from a nonexistent one (§1.5 TD5) |
| `/me/saved-searches` | `saved_searches` (IDENTITY) | **None, ever** | No `tenant_id` column exists. Scoped by `user_id` and protected by the ownership guard (`AZ8`). Classing it RLS would be the `/me/memberships` bug of `Schema.md` §1.3 |

**The isolation-suite obligation.** `API_Catalog.md` §1.5 TD6: every handler annotated
`@TenantScoped()` must appear in the isolation suite's endpoint inventory. The inverse obligation
binds here — every handler in §5–§10 must appear in the suite's **`@Public()` inventory** with the
assertion that it issues no `SET LOCAL` and touches no `P-STD` table outside an elevation. `BAC-10`
and `E2E-11` carry it.

---

## 3. Caching, the CDN, `ETag`, and the `BR-PLN-03` tension resolved

### 3.1 The tension, stated without softening it

Two requirements pull in opposite directions on exactly these ten endpoints:

> `NFR-SCAL-04` — *"Read-heavy marketplace traffic is served from read replicas and cache; writes
> never contend with search."* `NFR-PERF-02` sets a **2.5 s LCP**, which for a server-rendered
> detail page means the API response must usually come from an edge, not from Mumbai.

> `BR-PLN-03` — *"The price displayed on the marketplace must equal the price charged at checkout
> for the same plan at the same moment."* Invariant `I3`. `RSK-11` scores the failure **12**.
> `Constraints.md` §13.2 grades the database's coverage **`NONE`**: no constraint can relate a figure
> a browser rendered to a figure a later transaction charges.

A cached price is, by construction, a price from the past. `BR-PLN-03` says the displayed price must
equal the charged price *at the same moment*. Taken naively these cannot both hold, and the naive
resolutions are both wrong: `no-store` on the detail page fails `NFR-PERF-02` and `NFR-SCAL-04`, and
a five-minute cache with no further control means a gym that raises its price at 10:00 has visitors
being quoted the old figure until 10:05.

### 3.2 The resolution, in three parts

**Part 1 — the cache is short and the invalidation is event-driven, not TTL-driven.**

| Endpoint class | Token | `Cache-Control` | Why this number |
| :--- | :--- | :--- | :--- |
| `GET /gyms/:slug`, `/plans`, `/reviews`, `/similar`, `/cities/:slug`, `/categories/:slug` | `CDN-300` | `public, max-age=60, s-maxage=300, stale-while-revalidate=60` | The **browser** holds 60 s; the **edge** holds 300 s but is purged on the write (part 2), so 300 s is a ceiling on the pathological case, not the normal case. `stale-while-revalidate=60` means a purge storm never produces an origin thundering herd |
| `POST /compare` | `CDN-60` | `public, max-age=15, s-maxage=60, stale-while-revalidate=30` | A `POST` that is a pure read (§9.1 justifies the verb). Shorter because a comparison table is the surface a buyer reads immediately before checkout |
| `GET /cities`, `/categories`, `/amenities` | `CDN-3600` | `public, max-age=600, s-maxage=3600, stale-while-revalidate=600` | Platform reference data (`§C2.3`), written only by `admin/` through the audited path (`FR-ADMN-07`). Purged wholesale on a taxonomy write |
| `GET /me/favourites`, `/me/saved-searches` | `NO-STORE!` (§1.3) | `private, no-store` + `Vary: Authorization` | Authenticated. `Vary: Authorization` stops any intermediary keying on URL alone |

**Part 2 — invalidation is triggered from the transactional outbox, never inline.**
`API_Catalog.md` §1.11 fixes the mechanism (`§C1.5`, ADR-0017): *"a rolled-back write never purges
and a committed write always does."* The complete purge map for the keys this document owns:

| Outbox event | Purges | Rule served |
| :--- | :--- | :--- |
| `plan.published`, `plan.price_changed`, `plan.archived`, `plan.promotion_started`, `plan.promotion_ended` | `gyms:{slug}`, `gyms:{slug}:plans`, `gyms:{slug}:similar`, `cities:{slug}`, `categories:{slug}`, every `compare:*` key containing the gym | **`BR-PLN-03`**, `FR-PLAN-05`, `BR-PLN-07` |
| `gym.approved` | `cities:{slug}`, `categories:{slug}`, sitemap | `BR-GYM-01`, `FR-ONB-13` (**within 60 s**) |
| `gym.suspended`, `gym.closed`, `tenant.suspended`, `tenant.past_due_day_7` | `gyms:{slug}` (now serving §5.6), `cities:{slug}`, `categories:{slug}`, `compare:*`, sitemap | `BR-TEN-05` (**within 60 s**, `BR-TEN-05-P1`), `BR-TEN-06` |
| `review.published`, `review.unpublished`, `review.removed`, `review.responded` | `gyms:{slug}` (rating block), `gyms:{slug}:reviews` | `BR-REV-07`, `BR-REV-06` |
| `gym.profile_updated`, `gym.media_changed`, `branch.hours_changed` | `gyms:{slug}`, `gyms:{slug}:similar` | `FR-GYM-04`, `FR-DETL-01` |
| `taxonomy.written` (amenity, category, city) | **All** `CDN-3600` keys | `NFR-DQ-06`, `FR-ADMN-07` |

The job that keeps the projection itself honest is `search.reindex` (`§C5`, *on change + nightly*);
the rating projection is `review.aggregate` (*on change + nightly rebuild*); listing freshness is
`gym.freshness-score` (*nightly*). A purge without a completed reindex would serve a fresh-looking
stale document, so the purge is emitted **after** the projection write commits, from the same outbox
consumer.

**Part 3 — and this is the load-bearing one — the cached price is never the price charged.**

The displayed price is a **quotation**, and every plan object on every public surface carries the
fingerprint that makes the quotation verifiable:

```json
// illustrative — not committed code
{
  "plan_id": "01932c7e-4a11-7c3d-9f20-6b8e0c1d2a44",
  "currency": "INR",
  "price_minor": "499900",
  "effective_price_minor": "399900",
  "price_fingerprint": "pf_1_01932c7e4a117c3d_399900_01932d01promo_1754380800",
  "priced_at": "2026-08-05T09:30:00Z"
}
```

`BusinessRules.md` `BR-PLN-03` defines the fingerprint's content — **plan id + price + promotion id +
`updated_at`** — and makes the comparison `AUTHORITATIVE` at `L6-UC`:

> *"at payment initiation the order is re-priced from server-held plan, promotion, coupon and tax
> data inside the same transaction that creates the payment intent; the client-echoed
> `price_fingerprint` is compared, and a difference aborts with `422 PLAN_PRICE_CHANGED`."*

| Property | Consequence |
| :--- | :--- |
| The fingerprint is **opaque** and **not parseable** by a client | It is a comparand, not a data source. The example's readable shape is illustrative; the committed form is a hash |
| It travels **out** on every public plan surface (§5, §6, §9, §11.1) and **back** on `POST /orders` | `Payments.md` and the `ordering` contract own the return leg. This document owns the emission |
| A mismatch is **`422 PLAN_PRICE_CHANGED`** carrying *both* figures | `AC-PLAN-02.2`: show old and new, require re-confirmation. `BR-PLN-03`'s own wording — *"rather than silently charging either figure"* — makes the abort mandatory in **both** directions. Charging the lower figure is also a violation |
| Therefore a stale cache can only ever cost **one extra round trip** | It cannot cost a wrong charge. The worst outcome of a 300-second edge cache is a re-confirmation modal, which is a designed state (`SCR-WEB-005` *"price changed since page load → blocking modal"*), not a failure |

**This is the guarantee, stated once, in the form it will be tested:** *the price shown at
`GET /gyms/:slug/plans` is honoured at checkout **if and only if** the plan's fingerprint is
unchanged; when it has changed, checkout stops and shows both figures. No cached figure is ever
charged, and no figure is ever charged that the buyer did not see and confirm.* Test ids
`BR-PLN-03-P1` and `BR-PLN-03-N1` (`BusinessRules.md`), plus `E2E-02` and `E2E-06`.

### 3.3 `ETag`, `Last-Modified` and `304`

`API_Catalog.md` §1.3.2 requires `ETag` and `Last-Modified` on *"public discovery reads and
reference data"*. `apis/README.md` §9.2 carries `304` in the seventeen-code set for exactly this.

| Rule | Statement |
| :--- | :--- |
| ET1 | `ETag` is a **strong** validator, computed as a hash over the fully-serialised response body **after** the visibility predicate has been applied. It is not a row `updated_at`, because a response composes many rows and a row-derived tag would miss a purge of a joined fact |
| ET2 | `If-None-Match` matching the current tag returns **`304`** with `ETag`, `Cache-Control`, `X-Correlation-Id` and the rate-limit headers, and **no body** |
| ET3 | A `304` **consumes a rate-limit token**. It is a request; pretending otherwise turns conditional GETs into a free scraping channel |
| ET4 | `Last-Modified` is the greatest `updated_at` across the composed rows, truncated to the second, and is advisory. `If-Modified-Since` is honoured but `If-None-Match` wins when both are present |
| ET5 | `Vary: Accept-Language` on every `CDN-*` response — `error.message` and reference-data display strings are i18n-resolved (`NFR-USE-08`), and an edge that ignores the language produces Hindi copy for an English visitor |
| ET6 | **No `Vary: Authorization` on the public ten.** They return identical bytes to an anonymous visitor and to a signed-in one. `is_favourited` is deliberately **absent** from every public response for this reason — see §5.2 note 4 |
| ET7 | The `ETag` changes when the purge lands, because the purge follows the projection write. A client polling with `If-None-Match` therefore sees a new price within one poll of the purge, not one TTL |

### 3.4 What the CDN is permitted to do, and what it must not

| Permitted | Forbidden |
| :--- | :--- |
| Cache the ten public reads by full URL including the query string, normalised to the declared parameter allowlist | Cache **any** `/me/*` response, for any duration, under any condition |
| Serve `stale-while-revalidate` content during an origin revalidation | Serve `stale-if-error` on `GET /gyms/:slug/plans` — a stale price served *because the origin is down* is `BR-PLN-03` failing silently, and a `503` is the honest answer |
| Collapse concurrent identical requests into one origin fetch | Rewrite, inject into, or re-order a JSON body |
| Honour a targeted purge by key | Hold a key past `s-maxage` under any circumstance |

`stale-if-error` **is** permitted on `/cities`, `/categories` and `/amenities` — reference data with
no price in it, where serving yesterday's amenity list beats serving an error.

---

## 4. Shared response objects

Defined once, referenced by every endpoint below, and emitted once into the OpenAPI document as a
shared component (`API_Catalog.md` §9.3). Every field is `snake_case`; absent optional fields are
**omitted, never `null`** (§1.2.1 R8) — which is the mechanism `BR-REV-07` depends on.

### 4.1 `Money`

```ts
// illustrative — not committed code
const Money = z.object({
  amount_minor: z.string().regex(/^\d+$/),   // integer paise as a STRING (M1)
  currency:     z.literal('INR'),            // ISO-4217, adjacent to every amount (M2)
});
```
Inlined in practice as `<subject>_minor` + a sibling `currency` on the parent object, per M1/M2. No
request schema in this document contains a monetary field — M3 makes sending one a
`400 UNKNOWN_FIELD`.

### 4.2 `RatingBlock` — the `BR-REV-07` shape

```ts
// illustrative — not committed code
const RatingBlock = z.object({
  review_count:  z.number().int().min(0),                       // ALWAYS present
  rating_avg:    z.number().min(1).max(5).multipleOf(0.1).optional(),  // ABSENT below threshold
  distribution:  z.record(z.enum(['1','2','3','4','5']), z.number().int()).optional(),
  display_state: z.enum(['RATED', 'INSUFFICIENT_REVIEWS', 'NO_REVIEWS']),
  minimum_reviews_for_rating: z.number().int().min(1),          // platform configuration, echoed
  explanation_key: z.string().optional(),                       // i18n key, present when not RATED
});
```

| `display_state` | Condition | `rating_avg` | `distribution` | `explanation_key` |
| :--- | :--- | :--- | :--- | :--- |
| `RATED` | `review_count >= minimum_reviews_for_rating` (default **3**) | present | present | absent |
| `INSUFFICIENT_REVIEWS` | `1 <= review_count < minimum` | **absent** | **absent** | `rating.insufficient_reviews` |
| `NO_REVIEWS` | `review_count = 0` | **absent** | **absent** | `rating.no_reviews` |

**Four things this shape guarantees, and why each is written down.**

1. **The API does not send a rating the client is trusted to hide.** `BusinessRules.md` `BR-REV-07`
   names the exact bug: *"Sending `0` instead of omitting is the classic bug: the client renders zero
   stars for a gym with no reviews."* The field is **absent**, not `null`, not `0`.
2. **`distribution` is absent too.** `FR-DETL-04` requires the 1–5 distribution *with* the mean; a
   distribution over two reviews reconstructs the mean exactly, so returning it below the threshold
   would defeat the rule through arithmetic. `BR-REV-07-N1` covers this.
3. **`review_count` is always present, including `0`.** It is the count that `AC-DETL-02.1` requires
   to be shown *with an explanation*, and `Constraints.md` §3 makes `gyms.rating_count NOT NULL
   DEFAULT 0` precisely *"so `BR-REV-07`'s below-3 rule is a comparison, never a null test."*
4. **`minimum_reviews_for_rating` is echoed.** `BusinessRules.md` §16 registers the threshold as
   platform configuration (*"must be ≥ 1; below the threshold the field is omitted, never zeroed"*).
   A client that hard-codes `3` breaks when the platform tunes it; echoing it costs one integer.

The mean is the **plain** mean of `PUBLISHED` reviews. The Bayesian-adjusted figure of `FR-REV-08` is
a **ranking input** and is **never** emitted on any surface in this document — `BusinessRules.md`
`BR-REV-07`: *"the two are separate fields that must never be swapped."*

### 4.3 `PlanCard` — `FR-DETL-02` + `FR-DETL-03`

```ts
// illustrative — not committed code
const PlanCard = z.object({
  plan_id:        z.string().uuid(),
  name:           z.string(),
  description:    z.string().optional(),            // sanitised HTML-free text
  plan_type:      z.enum(['DURATION', 'SESSION']),  // plan_type_enum
  duration_value: z.number().int().positive().optional(),  // present iff DURATION
  duration_unit:  z.enum(['DAY','WEEK','MONTH','YEAR']).optional(),
  session_count:  z.number().int().positive().optional(),  // present iff SESSION
  session_validity_days: z.number().int().positive().optional(),
  currency:            z.literal('INR'),
  price_minor:         z.string(),                  // list price
  effective_price_minor: z.string(),                // what a buyer pays NOW (promo applied)
  promotion:      z.object({
                    ends_at: z.string().datetime(),                 // UTC Z
                    saving_minor: z.string(),
                  }).optional(),
  joining_fee_minor:   z.string(),                  // "0" when none; never omitted (FR-DETL-02)
  monthly_equivalent_minor: z.string().optional(),  // FR-DETL-03
  monthly_equivalent_basis: z.enum(['EXACT','NORMALISED','NOT_APPLICABLE']),
  inclusions:     z.array(z.string()),              // ordered, may be empty
  access_window:  z.object({
                    is_unrestricted: z.boolean(),
                    windows: z.array(z.object({ weekday: z.number().int().min(0).max(6),
                                                opens_at: z.string(), closes_at: z.string() })),
                    note_key: z.string().optional(),
                  }),
  min_age:            z.number().int().optional(),
  gender_eligibility: z.enum(['ANY','FEMALE','MALE']),
  freeze_allowed:     z.boolean(),
  freeze_max_days:    z.number().int().optional(),
  transfer_allowed:   z.boolean(),
  available_at_branch_ids: z.array(z.string().uuid()),  // resolved; empty array is IMPOSSIBLE
  price_fingerprint:  z.string(),                   // §3.2 part 3
  priced_at:          z.string().datetime(),
  purchase_action:    z.object({ enabled: z.literal(true), plan_id: z.string().uuid() }),
});
```

**`monthly_equivalent_minor` — how it is computed, because `FR-DETL-03` says "honest".**

| `plan_type` | Rule | `monthly_equivalent_basis` |
| :--- | :--- | :--- |
| `DURATION`, unit `MONTH`, value 1 | `effective_price_minor` unchanged | `EXACT` |
| `DURATION`, unit `MONTH`, value *n* | `round_half_even(effective_price_minor / n)` | `EXACT` |
| `DURATION`, unit `YEAR`, value *n* | `round_half_even(effective_price_minor / (12n))` | `EXACT` |
| `DURATION`, unit `DAY`/`WEEK` | `round_half_even(effective_price_minor × 30.4375 / days)` — the mean Gregorian month | `NORMALISED` |
| `SESSION` | **Omitted.** A session pack has no honest monthly figure; `session_count` and `session_validity_days` are what a buyer compares | `NOT_APPLICABLE` |

The **joining fee is excluded** from the monthly equivalent and returned separately. Amortising a
one-off fee over a duration makes a 12-month plan look cheaper per month than the same plan bought
three times, which is the opposite of the honest comparison `FR-DETL-03` asks for.
`round_half_even` is the platform rounding mode (`A6.3`, `LAUNCH_MARKET_INDIA.md` §2).

### 4.4 `AmenityRef`, `OperatingHours`, `Address`

```ts
// illustrative — not committed code
const AmenityRef = z.object({
  amenity_id: z.string().uuid(),
  key:        z.string(),                 // stable, never re-pointed (NFR-DQ-06)
  name:       z.string(),                 // i18n-resolved display string
  icon:       z.string(),
  display_group: z.string(),              // e.g. "FACILITIES", "EQUIPMENT", "SERVICES"
});

const OperatingHours = z.object({
  timezone: z.literal('Asia/Kolkata'),    // T3: UTC+05:30, no DST
  weekly: z.array(z.object({
    weekday: z.number().int().min(0).max(6),          // 0 = Monday, ISO (Schema.md §5.3)
    is_closed: z.boolean(),                            // TRUE when zero rows exist for the day
    windows: z.array(z.object({ opens_at: z.string(), closes_at: z.string() })),  // "HH:mm" LOCAL
  })).length(7),                                       // always seven, never sparse
  exceptions: z.array(z.object({
    exception_date: z.string(),           // YYYY-MM-DD, Asia/Kolkata
    is_closed: z.boolean(),
    windows: z.array(z.object({ opens_at: z.string(), closes_at: z.string() })),
    reason: z.string().optional(),
  })),
  today: z.object({ weekday: z.number().int(), is_open_now: z.boolean(),
                    closes_at: z.string().optional(), opens_at: z.string().optional(),
                    source: z.enum(['WEEKLY','EXCEPTION']) }),
});

const Address = z.object({
  line1: z.string(), line2: z.string().optional(),
  locality: z.object({ locality_id: z.string().uuid(), name: z.string(), slug: z.string() }).optional(),
  city:  z.object({ city_id: z.string().uuid(), name: z.string(), slug: z.string() }),
  state: z.string(), state_code: z.string().length(2),
  postal_code: z.string().regex(/^[1-9]\d{5}$/),   // Indian PIN: six digits, never leading zero
  country_code: z.literal('IN'),
  location: z.object({ lat: z.number(), lng: z.number() }),   // WGS-84, 5 dp (~1 m)
  landmark: z.string().optional(),
  directions_url: z.string().url(),
});
```

**Four notes.** (1) `weekly` is **always seven entries**, because `Schema.md` §5.3 makes *zero rows
for a weekday mean closed, not unknown* — a sparse array would let a client infer "unknown" and
render a hopeful placeholder. (2) Split hours are **multiple `windows` on one weekday** — Indian
gyms very commonly run 05:00–11:00 and 16:00–23:00, which `§C2.2` anticipates. (3) A window crossing
midnight is **two windows on two weekdays**; `opens_at > closes_at` is unrepresentable
(`ck_branch_hours__opens_before_closes`). (4) An exception **replaces** the date's hours entirely and
`today.source` says which applied — `GYM_CLOSED_EXCEPTION` takes precedence over
`OUTSIDE_OPERATING_HOURS` in the check-in evaluator (`TM8`), and the public surface must agree with
the turnstile.

### 4.5 `GymSummary` — the card shape shared by `/similar`, `/cities/:slug`, `/categories/:slug`, `/me/favourites`

```ts
// illustrative — not committed code
const GymSummary = z.object({
  gym_id: z.string().uuid(), slug: z.string(), name: z.string(),
  is_verified: z.literal(true),                     // BR-GYM-01: if it is visible, it is verified
  category: z.object({ key: z.string(), name: z.string(), slug: z.string() }),
  cover_media: z.object({ url: z.string().url(), width: z.number(), height: z.number(),
                          alt: z.string(), renditions: z.record(z.string(), z.string().url()) }).optional(),
  locality_name: z.string().optional(), city_name: z.string(), city_slug: z.string(),
  distance_metres: z.number().int().optional(),     // present only when the caller supplied lat/lng
  rating: RatingBlock,
  currency: z.literal('INR'),
  lowest_monthly_equivalent_minor: z.string().optional(),   // absent iff every plan is SESSION
  lowest_plan_id: z.string().uuid().optional(),
  price_fingerprint: z.string().optional(),
  top_amenities: z.array(AmenityRef).max(3),        // FR-SRCH-06
  gender_policy: z.enum(['MIXED','WOMEN_ONLY','MEN_ONLY','SCHEDULED']),
  is_open_now: z.boolean(),
  is_featured: z.boolean(),                          // FR-SRCH-11 — labelled, never hidden
  canonical_url: z.string().url(),
});
```

`is_verified` is a **literal `true`**, not a boolean. Anything reachable through these endpoints has
passed `BR-GYM-01` and `BR-GYM-02`; a `false` value is unreachable, and typing it as a boolean would
invite a client to render an "unverified" badge that can never legitimately appear.

---

## 5. `GET /v1/gyms/:slug` — gym detail

| Attribute | Value |
| :--- | :--- |
| **Purpose** | Return the complete `FR-DETL-01` section set for one gym: gallery, name and verified badge, rating summary, address with map and directions, operating hours with today resolved, amenities, gender policy, description, plan summary, review summary, similar-gym pointer, report affordance |
| **Surfaces** | `web` (`SCR-WEB-003`, server-rendered) · not `dash` · not `admin` |
| **Auth mode** | `none` — `@Public()` (`API_Catalog.md` §5.4 allowlist) |
| **Required permission** | **`—`**. `@Public()` and no permission string. There is no third state (§3.0.1 correction 2). The compensating controls are `RL-PUBLIC`, the visibility predicate and the absence of any tenant-owned read outside the §2.2 elevation |
| **Tenant scope** | **`public`** — decision-table row 1. Resolved from the resource *after* the visibility filter, never before |
| **Idempotency** | `N/A` — safe method |
| **Rate-limit class** | `RL-PUBLIC` — 120/min per IP, burst 30; verified-crawler allowlist exempt (§13.1) |
| **Cache policy** | `CDN-300` + `ETag` + `Last-Modified` + `Vary: Accept-Language`. Purged by `plan.*`, `gym.*`, `tenant.*`, `review.*`, `branch.hours_changed` (§3.2 part 2) |

### 5.1 Request

**Path parameters**

| Name | Type | Constraint | Required | Notes |
| :--- | :--- | :--- | :-: | :--- |
| `slug` | string | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 3–120 chars | yes | The `slug` domain of `Schema.md` §2.4. **Unique per city, not globally** (`uq_gyms__city_slug`) — see §5.5 |

**Query parameters** — the allowlist is closed; anything else is `400 UNKNOWN_QUERY_PARAMETER`
(`API_Catalog.md` §1.8, `.strict()` query schemas).

| Name | Type | Default | Constraint | Required | Purpose |
| :--- | :--- | :--- | :--- | :-: | :--- |
| `lat` | number | — | −90…90, ≤5 dp | no | With `lng`, populates `distance_metres` on the gym and on `similar`. Precision is **clamped to 5 dp server-side** before use and is never logged (`BR-DAT-06`) |
| `lng` | number | — | −180…180, ≤5 dp | no | Must be supplied with `lat`; one without the other is `400 VALIDATION_FAILED` |
| `city_slug` | string | — | slug, 2–80 | no | Disambiguates a slug that exists in more than one city (§5.5) |
| `review_preview` | integer | `3` | 0…5 | no | How many reviews to embed. The full list is `GET /gyms/:slug/reviews` |
| `similar_preview` | integer | `4` | 0…6 | no | How many similar gyms to embed. The full list is `GET /gyms/:slug/similar` |

```ts
// illustrative — not committed code
export const GetGymDetailQuery = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  city_slug: z.string().regex(SLUG).min(2).max(80).optional(),
  review_preview: z.coerce.number().int().min(0).max(5).default(3),
  similar_preview: z.coerce.number().int().min(0).max(6).default(4),
}).strict()
  .refine(q => (q.lat === undefined) === (q.lng === undefined), {
    message: 'lat and lng must be supplied together', path: ['lat'],
  });
```

**Body** — none. `GET`.

### 5.2 Response — `200`

```json
// illustrative — not committed code
// HTTP/1.1 200 OK
// Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=60
// ETag: "W/gd-01932c7e-9f4a13c0"        Last-Modified: Wed, 05 Aug 2026 09:30:00 GMT
// Vary: Accept-Language                  X-Correlation-Id: 01J9Z7K3M8QF2VB6XN4TD0RCPE
// X-RateLimit-Limit: 120   X-RateLimit-Remaining: 118   X-RateLimit-Reset: 1785312000
{
  "gym_id": "01932c7e-3f81-7a04-b2e6-9c11d4a8e770",
  "slug": "iron-works-andheri-west",
  "name": "Iron Works Fitness Studio",
  "listing_state": "LIVE",
  "is_verified": true,
  "verified_since": "2026-03-18T06:45:00Z",
  "category": { "key": "STRENGTH_TRAINING", "name": "Strength Training", "slug": "strength-training" },
  "gender_policy": "MIXED",
  "description": "A 4,200 sq ft strength-first studio in Andheri West with free weights up to 60 kg dumbbells, three squat racks, a dedicated deadlift platform and a small functional zone. Certified trainers on the floor from 06:00 to 10:00 and 17:00 to 22:00.",
  "canonical_url": "https://www.<domain>/gyms/mumbai/iron-works-andheri-west",

  "gallery": {
    "count": 11,
    "cover": {
      "media_id": "01932c80-1b22-7000-8f31-2a5c7e9b1043",
      "url": "https://media.<domain>/gyms/01932c7e/cover-1600.webp",
      "width": 1600, "height": 1200,
      "alt": "Main free-weights floor at Iron Works Fitness Studio, Andheri West",
      "renditions": {
        "thumb_320":  "https://media.<domain>/gyms/01932c7e/cover-320.webp",
        "card_640":   "https://media.<domain>/gyms/01932c7e/cover-640.webp",
        "hero_1600":  "https://media.<domain>/gyms/01932c7e/cover-1600.webp"
      }
    },
    "items": [
      { "media_id": "01932c80-1b22-7000-8f31-2a5c7e9b1043", "media_type": "IMAGE", "sort_order": 0,
        "url": "https://media.<domain>/gyms/01932c7e/cover-1600.webp", "width": 1600, "height": 1200,
        "alt": "Main free-weights floor", "caption": "Free-weights floor" },
      { "media_id": "01932c80-2c33-7000-9e44-3b6d8f0c2154", "media_type": "IMAGE", "sort_order": 1,
        "url": "https://media.<domain>/gyms/01932c7e/rack-1600.webp", "width": 1600, "height": 1067,
        "alt": "Three squat racks with Olympic bars", "caption": "Squat racks" },
      { "media_id": "01932c80-3d44-7000-af55-4c7e9a1d3265", "media_type": "IMAGE", "sort_order": 2,
        "url": "https://media.<domain>/gyms/01932c7e/cardio-1600.webp", "width": 1600, "height": 1200,
        "alt": "Cardio row with treadmills and cross trainers", "caption": "Cardio zone" }
    ]
  },

  "rating": {
    "review_count": 47,
    "rating_avg": 4.6,
    "distribution": { "5": 31, "4": 10, "3": 4, "2": 1, "1": 1 },
    "display_state": "RATED",
    "minimum_reviews_for_rating": 3
  },

  "address": {
    "line1": "2nd Floor, Sai Sadan Complex, Lokhandwala Road",
    "line2": "Off Veera Desai Road",
    "locality": { "locality_id": "01932a11-5e66-7000-9d21-8b4f2c6a7391",
                  "name": "Andheri West", "slug": "andheri-west" },
    "city": { "city_id": "01932a10-4d55-7000-8c10-7a3e1b5f6280", "name": "Mumbai", "slug": "mumbai" },
    "state": "Maharashtra",
    "state_code": "MH",
    "postal_code": "400053",
    "country_code": "IN",
    "location": { "lat": 19.13842, "lng": 72.82615 },
    "landmark": "Above Sharma Medical Stores, 400 m from Andheri Metro Station",
    "directions_url": "https://www.google.com/maps/dir/?api=1&destination=19.13842,72.82615"
  },
  "distance_metres": 2140,

  "branches": [
    { "branch_id": "01932c7f-0a11-7000-91d2-5f8b3c2e6104", "name": "Andheri West (Main)",
      "is_primary": true, "status": "ACTIVE",
      "address_summary": "Lokhandwala Road, Andheri West, Mumbai 400053",
      "location": { "lat": 19.13842, "lng": 72.82615 }, "distance_metres": 2140 },
    { "branch_id": "01932c7f-1b22-7000-a2e3-6a9c4d3f7215", "name": "Jogeshwari West",
      "is_primary": false, "status": "ACTIVE",
      "address_summary": "SV Road, Jogeshwari West, Mumbai 400102",
      "location": { "lat": 19.14071, "lng": 72.84019 }, "distance_metres": 3980 }
  ],

  "operating_hours": {
    "timezone": "Asia/Kolkata",
    "weekly": [
      { "weekday": 0, "is_closed": false, "windows": [ { "opens_at": "05:30", "closes_at": "11:00" }, { "opens_at": "16:00", "closes_at": "23:00" } ] },
      { "weekday": 1, "is_closed": false, "windows": [ { "opens_at": "05:30", "closes_at": "11:00" }, { "opens_at": "16:00", "closes_at": "23:00" } ] },
      { "weekday": 2, "is_closed": false, "windows": [ { "opens_at": "05:30", "closes_at": "11:00" }, { "opens_at": "16:00", "closes_at": "23:00" } ] },
      { "weekday": 3, "is_closed": false, "windows": [ { "opens_at": "05:30", "closes_at": "11:00" }, { "opens_at": "16:00", "closes_at": "23:00" } ] },
      { "weekday": 4, "is_closed": false, "windows": [ { "opens_at": "05:30", "closes_at": "11:00" }, { "opens_at": "16:00", "closes_at": "23:00" } ] },
      { "weekday": 5, "is_closed": false, "windows": [ { "opens_at": "06:00", "closes_at": "13:00" } ] },
      { "weekday": 6, "is_closed": true,  "windows": [] }
    ],
    "exceptions": [
      { "exception_date": "2026-08-15", "is_closed": true, "windows": [], "reason": "Independence Day" },
      { "exception_date": "2026-09-14", "is_closed": false,
        "windows": [ { "opens_at": "06:00", "closes_at": "10:00" } ], "reason": "Anant Chaturdashi — morning only" }
    ],
    "today": { "weekday": 2, "is_open_now": true, "closes_at": "11:00", "source": "WEEKLY" }
  },

  "amenities": [
    { "amenity_id": "01930001-0001-7000-8000-000000000101", "key": "FREE_WEIGHTS", "name": "Free weights", "icon": "dumbbell", "display_group": "EQUIPMENT" },
    { "amenity_id": "01930001-0001-7000-8000-000000000102", "key": "SQUAT_RACK", "name": "Squat rack", "icon": "rack", "display_group": "EQUIPMENT" },
    { "amenity_id": "01930001-0001-7000-8000-000000000103", "key": "CARDIO_MACHINES", "name": "Cardio machines", "icon": "treadmill", "display_group": "EQUIPMENT" },
    { "amenity_id": "01930001-0001-7000-8000-000000000201", "key": "AIR_CONDITIONING", "name": "Air conditioning", "icon": "snowflake", "display_group": "FACILITIES" },
    { "amenity_id": "01930001-0001-7000-8000-000000000202", "key": "SHOWERS", "name": "Showers", "icon": "shower", "display_group": "FACILITIES" },
    { "amenity_id": "01930001-0001-7000-8000-000000000203", "key": "LOCKERS", "name": "Lockers", "icon": "locker", "display_group": "FACILITIES" },
    { "amenity_id": "01930001-0001-7000-8000-000000000204", "key": "TWO_WHEELER_PARKING", "name": "Two-wheeler parking", "icon": "scooter", "display_group": "FACILITIES" },
    { "amenity_id": "01930001-0001-7000-8000-000000000205", "key": "DRINKING_WATER_RO", "name": "RO drinking water", "icon": "water", "display_group": "FACILITIES" },
    { "amenity_id": "01930001-0001-7000-8000-000000000301", "key": "PERSONAL_TRAINING", "name": "Personal training", "icon": "trainer", "display_group": "SERVICES" },
    { "amenity_id": "01930001-0001-7000-8000-000000000302", "key": "DIET_CONSULTATION", "name": "Diet consultation", "icon": "nutrition", "display_group": "SERVICES" }
  ],

  "plans_summary": {
    "plan_count": 5,
    "currency": "INR",
    "lowest_monthly_equivalent_minor": "199900",
    "lowest_plan_id": "01932c81-6f00-7000-b3a4-7d0e5b4c8326",
    "cheapest_plan": {
      "plan_id": "01932c81-6f00-7000-b3a4-7d0e5b4c8326",
      "name": "Annual — Full Access",
      "plan_type": "DURATION", "duration_value": 12, "duration_unit": "MONTH",
      "price_minor": "2999900", "effective_price_minor": "2398800",
      "joining_fee_minor": "100000",
      "monthly_equivalent_minor": "199900", "monthly_equivalent_basis": "EXACT",
      "promotion": { "ends_at": "2026-08-31T18:29:59Z", "saving_minor": "601100" },
      "price_fingerprint": "pf_1_9c11d4a8e770_2398800_01932d0177aa_1754380800",
      "priced_at": "2026-08-05T09:30:00Z"
    },
    "has_trial": true,
    "durations_available": [ { "duration_value": 1, "duration_unit": "MONTH" },
                             { "duration_value": 3, "duration_unit": "MONTH" },
                             { "duration_value": 6, "duration_unit": "MONTH" },
                             { "duration_value": 12, "duration_unit": "MONTH" } ],
    "plans_url": "/v1/gyms/iron-works-andheri-west/plans"
  },

  "reviews_preview": {
    "reviews_url": "/v1/gyms/iron-works-andheri-west/reviews",
    "items": [
      { "review_id": "01932d55-0011-7000-8a12-4b6c8d1e3057",
        "reviewer": { "display_name": "Priya S.", "tenure_band": "MEMBER_6_12_MONTHS", "is_verified_member": true },
        "rating": 5,
        "sub_ratings": { "cleanliness": 5, "equipment": 5, "staff": 4, "value": 5 },
        "body": "Racks are never crowded even at 7 am and the AC actually works through Mumbai summer. Trainers correct form without being asked.",
        "published_at": "2026-07-22T04:15:00Z",
        "response": { "body": "Thank you Priya — we added the third rack in June exactly for the morning rush.",
                      "responded_at": "2026-07-23T05:02:00Z", "author_label": "Iron Works Fitness Studio" } },
      { "review_id": "01932d55-1122-7000-9b23-5c7d9e2f4168",
        "reviewer": { "display_name": "Rahul M.", "tenure_band": "MEMBER_1_3_MONTHS", "is_verified_member": true },
        "rating": 4,
        "sub_ratings": { "cleanliness": 4, "equipment": 5, "staff": 4, "value": 4 },
        "body": "Great equipment. Evening slot after 7 pm gets tight for the bench area.",
        "published_at": "2026-07-09T14:40:00Z" }
    ]
  },

  "similar_preview": {
    "similar_url": "/v1/gyms/iron-works-andheri-west/similar",
    "items": [ "…up to `similar_preview` GymSummary objects — shape in §4.5…" ]
  },

  "seo": {
    "canonical_url": "https://www.<domain>/gyms/mumbai/iron-works-andheri-west",
    "meta_title": "Iron Works Fitness Studio, Andheri West, Mumbai — Gym Membership from ₹1,999/month",
    "meta_description": "Strength-first gym in Andheri West with squat racks, free weights to 60 kg and certified trainers. 4.6 from 47 verified member reviews. Plans from ₹1,999 a month.",
    "robots": "index,follow",
    "hreflang": [ { "lang": "en-IN", "href": "https://www.<domain>/gyms/mumbai/iron-works-andheri-west" } ],
    "link_preview": {
      "og_title": "Iron Works Fitness Studio — Andheri West, Mumbai",
      "og_description": "4.6 from 47 verified member reviews. Plans from ₹1,999 a month.",
      "og_image": "https://media.<domain>/gyms/01932c7e/og-1200x630.jpg",
      "og_image_width": 1200, "og_image_height": 630,
      "og_type": "business.business",
      "twitter_card": "summary_large_image"
    },
    "structured_data": {
      "@context": "https://schema.org",
      "@type": "HealthAndBeautyBusiness",
      "additionalType": "https://schema.org/ExerciseGym",
      "name": "Iron Works Fitness Studio",
      "url": "https://www.<domain>/gyms/mumbai/iron-works-andheri-west",
      "image": "https://media.<domain>/gyms/01932c7e/cover-1600.webp",
      "address": { "@type": "PostalAddress",
                   "streetAddress": "2nd Floor, Sai Sadan Complex, Lokhandwala Road, Off Veera Desai Road",
                   "addressLocality": "Andheri West", "addressRegion": "MH",
                   "postalCode": "400053", "addressCountry": "IN" },
      "geo": { "@type": "GeoCoordinates", "latitude": 19.13842, "longitude": 72.82615 },
      "openingHoursSpecification": [
        { "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
          "opens": "05:30", "closes": "11:00" },
        { "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
          "opens": "16:00", "closes": "23:00" },
        { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Saturday"], "opens": "06:00", "closes": "13:00" }
      ],
      "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.6",
                           "reviewCount": "47", "bestRating": "5", "worstRating": "1" },
      "makesOffer": [
        { "@type": "Offer", "name": "Annual — Full Access", "price": "23988.00",
          "priceCurrency": "INR", "availability": "https://schema.org/InStock",
          "priceValidUntil": "2026-08-31",
          "url": "https://www.<domain>/gyms/mumbai/iron-works-andheri-west?plan=01932c81-6f00-7000-b3a4-7d0e5b4c8326" }
      ]
    }
  },

  "actions": { "can_report": true, "report_url": "/v1/gyms/iron-works-andheri-west/report" },
  "updated_at": "2026-08-05T09:30:00Z"
}
```

**Notes on the payload.**

1. **`listing_state` is always present** and is `LIVE` here. Its other values are the §5.6 contract.
   A client branches on this field, never on the HTTP status.
2. **`plans_summary` is a summary, not the catalogue.** `FR-DETL-01` requires a plan catalogue on the
   page and `SCR-WEB-003` region 3 requires *"a sticky plan panel with the cheapest plan and a 'View
   plans' jump"*. Embedding all five plans would double the payload and double the purge surface;
   the sticky panel needs exactly `cheapest_plan`. The full catalogue is §6, one call, same cache key
   family, same fingerprints.
3. **`sub_ratings` appears on review items but never aggregates into `rating`.** `FR-DETL-04`'s
   summary is the overall mean and distribution; the four sub-scores (`cleanliness`, `equipment`,
   `staff`, `value` — `Schema.md` §10.1) are per-review facts.
4. **There is no `is_favourited` field, deliberately.** It would make the response principal-specific,
   force `Vary: Authorization`, and destroy the shared edge object that `NFR-SCAL-04` depends on
   (ET6). Favourite state is a **separate** authenticated read, `GET /me/favourites`, which the
   client joins on `gym_id`. This is the single highest-leverage caching decision in the document.
5. **`verified_since`** is the `gym.approved` timestamp, the only application-status fact that is
   safe to publish. Nothing else about the application, its versions or its pre-checks is public.
6. **Amounts.** `2399900` paise = ₹23,999. Rendered with Indian digit grouping by one formatter in
   `packages/utils` (`LAUNCH_MARKET_INDIA.md` §2). The wire never carries a formatted amount (M6).

### 5.3 Errors

| Code | HTTP | When | User-facing message (what / why / what next) | Retryable |
| :--- | :-: | :--- | :--- | :--- |
| `VALIDATION_FAILED` | 400 | `slug` fails the pattern, `lat` without `lng`, `review_preview > 5` | "That link doesn't look right. Check the address, or search for the gym by name." | Fix |
| `UNKNOWN_QUERY_PARAMETER` | 400 | A query key outside the §5.1 allowlist | Developer-facing; `details[]` names the parameter. The site never generates one | Fix |
| `TENANT_HEADER_NOT_ACCEPTED` | 400 | `X-Tenant-Id` header or `?tenant_id=` present | Developer-facing. Never ignored — silence would hide the client bug trying to become a vulnerability (§1.5 TD1) | Fix |
| `GYM_NOT_FOUND` | 404 | No gym with this slug, **or** a gym that was never `APPROVED` (`DRAFT`, `PENDING_REVIEW`), **or** a soft-deleted gym | "We couldn't find that gym. It may have been removed, or the link may be wrong. Try searching for it by name or browse gyms in your city." | No |
| `SLUG_AMBIGUOUS` | 409 | The slug exists in more than one city and no `city_slug` was supplied (§5.5) | "There's more than one gym with this name. Choose the city you meant." `details[]` lists each `{ city_slug, city_name, canonical_url }` | Fix |
| `RATE_LIMIT_EXCEEDED` | 429 | `RL-PUBLIC` bucket empty | "You're browsing faster than we can serve. Try again in 30 seconds." `Retry-After` carries the seconds | Wait |
| `INTERNAL_ERROR` | 500 | Unhandled | "Something went wrong at our end. Try again in a moment. If it keeps happening, quote reference `01J9Z7…` to support." (EV6, EV7) | Wait |
| `DEPENDENCY_UNAVAILABLE` | 503 | Read replica pool exhausted, or the projection is mid-rebuild and unreadable | "We can't load this gym right now. Try again in a minute." `Retry-After` present | Wait |

**`404` versus `200`-with-a-message is the whole of §5.6.** The rule in one line: **never approved →
`404`; previously live and now not → `200` with `listing_state`.**

**There is no `403` on this endpoint, ever.** `API_Catalog.md` §2.3: a cross-tenant or
not-permitted-to-see resource returns `404`, because `403` confirms existence and `BR-TEN-01` does
not tolerate the leak.

### 5.4 Business rules enforced, and where

| Rule / FR | What this endpoint owes it | Layer |
| :--- | :--- | :--- |
| `BR-GYM-01` | Composes `PublicVisibilityPredicate` (§2.3) in the query. `Constraints.md` §13.1 grades the DB **PARTIAL**; the remainder is here | **This layer** (`L7-GUARD` `@Public()` + `L6-UC` predicate); `L1-DB` partial index |
| `BR-TEN-05` | A suspended tenant's gym returns the §5.6 payload, never a live listing. Check-in continuity is **not** this endpoint's concern (`BusinessRules.md` §18.5) | `L6-UC` |
| `BR-TEN-06` | `PAST_DUE` beyond 7 days is filtered by the same predicate | `L6-UC` |
| `BR-PLN-05` | `cheapest_plan` is selected by a query filtered on `status='PUBLISHED' AND visibility='PUBLIC'`. A `STAFF_ONLY` plan is never a candidate for `lowest_monthly_equivalent_minor` | `L6-UC` + `L1-DB` `idx_plans__gym_status_visibility` |
| `BR-PLN-03` | Emits `price_fingerprint` and `priced_at` on `cheapest_plan` (§3.2 part 3) | **This layer** (emission); `L6-UC` in `ordering` (comparison) |
| `BR-REV-07` | `rating_avg` and `distribution` are **omitted** below `minimum_reviews_for_rating`, including inside `seo.structured_data` — see §5.7 | **This layer** (`L6-UC` DTO); `L10-JOB` `review.aggregate` maintains the counts |
| `BR-REV-03` | Every embedded review carries `is_verified_member: true`; there is no other shape | `L1-DB` **STRUCTURAL** (`reviews.membership_id NOT NULL`) + this layer's schema |
| `FR-DETL-01` | The full section set is present in one response | This layer |
| `FR-DETL-04` | `rating` carries mean, count and 1–5 distribution when `RATED` | This layer |
| `FR-DETL-07`, `FR-NAV-05` | `canonical_url` and `seo.link_preview` | This layer |
| `FR-DETL-10` | `seo.structured_data` for local business, aggregate rating and offers | This layer |
| `FR-DETL-11` | §5.6 | This layer |
| `FR-GYM-04` | Seven-entry `weekly`, split windows, dated exceptions, resolved `today` | This layer; `L1-DB` `ex_branch_hours__no_overlap` |
| `NFR-DQ-06` | Amenities and category are reference identifiers, never free text | `L1-DB` (`gym_amenities` FK) |
| `NFR-SEC-05` | `description` is sanitised **on write**; the column never holds raw input (`Schema.md` §5.1) | `L6-UC` in `catalog` (write side) |

### 5.5 The slug is unique per city, not globally

`uq_gyms__city_slug` (`Schema.md` §5.1): *"two 'Iron Temple' gyms in different cities are both
legitimate."* `GET /gyms/:slug` therefore has a genuine ambiguity case, and it is resolved rather than
guessed:

| Situation | Behaviour |
| :--- | :--- |
| Exactly one visible gym has the slug | `200`. `city_slug`, if supplied and matching, is ignored; if supplied and **not** matching, `404` |
| Two or more visible gyms share the slug, no `city_slug` | **`409 SLUG_AMBIGUOUS`** with `details[]` enumerating `{ city_slug, city_name, canonical_url }` per candidate |
| Two or more share it, `city_slug` supplied and matching one | `200` |
| Zero visible gyms have it | `404 GYM_NOT_FOUND` (or §5.6 if one is a previously-live match — the informational payload takes precedence over the `404`) |

**Why `409` and not "pick the nearest".** Picking silently means a visitor in Pune who follows a
shared link to a Mumbai gym reads the wrong gym's hours and drives to the wrong address. `409` is a
conflict the caller can resolve, and `NFR-USE-05` is satisfied by `details[]` listing the actual
choices. **The canonical public URL always carries the city** —
`/gyms/{city_slug}/{gym_slug}` — so this case only arises for a hand-typed or legacy API path, never
from a link the platform generated (`FR-NAV-05`).

### 5.6 `listing_state` — `FR-DETL-11`, the `200` that is not a listing

`FR-DETL-11`: *"a suspended, closed or unapproved gym's URL returns a clear informational page, not a
404, when it was previously live."* `API_Catalog.md` §3.3's note makes the split explicit. The rule
that decides which:

| Condition | Response | `listing_state` | Why |
| :--- | :--- | :--- | :--- |
| `gyms.status = 'APPROVED'`, tenant healthy, ≥1 published `PUBLIC` plan | `200` full payload | `LIVE` | §5.2 |
| `gyms.status = 'APPROVED'`, an active `gym_closures` row (`FR-GYM-11`, flag `rel.catalog.temporary-closure`) | `200` informational | `TEMPORARILY_CLOSED` | The gym intends to reopen and says when |
| `gyms.status = 'SUSPENDED'` | `200` informational | `SUSPENDED` | `BR-GYM-01`. It **was** live — someone holds a link, and possibly a membership |
| `gyms.status = 'CLOSED'` | `200` informational | `CLOSED` | Permanent. `410` was considered and rejected below |
| Tenant `SUSPENDED`, or `PAST_DUE` beyond 7 days, gym itself `APPROVED` | `200` informational | `UNAVAILABLE` | `BR-TEN-05`, `BR-TEN-06`. The *gym* did nothing wrong; the payload never says why |
| `gyms.status ∈ { DRAFT, PENDING_REVIEW }`, or a `verified_since` that never existed | **`404 GYM_NOT_FOUND`** | — | Never live. A `200` here would confirm that an unapproved application exists, which is a tenant-private fact |
| Soft-deleted (`deleted_at` set) | **`404 GYM_NOT_FOUND`** | — | `NFR-DQ-04` |

```json
// illustrative — not committed code
// HTTP/1.1 200 OK    Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=60
// X-Robots-Tag: noindex, follow
{
  "gym_id": "01932c92-7e10-7000-9a55-1d3f6b2c8409",
  "slug": "pulse-fitness-koramangala",
  "name": "Pulse Fitness",
  "listing_state": "TEMPORARILY_CLOSED",
  "listing_notice": {
    "title_key": "listing.temporarily_closed.title",
    "body_key": "listing.temporarily_closed.body",
    "effective_from": "2026-07-28",
    "expected_reopen_on": "2026-09-01",
    "timezone": "Asia/Kolkata"
  },
  "address_summary": "5th Block, Koramangala, Bengaluru 560095",
  "city": { "city_id": "01932a10-6f77-7000-a132-9c5e3d7f8402", "name": "Bengaluru", "slug": "bengaluru" },
  "alternatives": {
    "reason_key": "listing.alternatives.nearby",
    "items": [ "…up to 6 GymSummary objects from the same locality, §4.5…" ]
  },
  "seo": { "canonical_url": "https://www.<domain>/gyms/bengaluru/pulse-fitness-koramangala",
           "robots": "noindex,follow" },
  "actions": { "can_report": false },
  "updated_at": "2026-07-28T11:20:00Z"
}
```

| Rule | Statement |
| :--- | :--- |
| LS1 | The informational payload carries **no `plans_summary`, no `price_fingerprint`, no `purchase_action`, no `rating` block and no gallery**. A price that cannot be bought is not a price, and `BR-PLN-03` is satisfied by there being nothing to honour |
| LS2 | It carries **no reason**. `SUSPENDED` and `UNAVAILABLE` render identical copy: *"This gym isn't taking new memberships right now."* Why a tenant is suspended is `BR-TEN-05`'s business and a defamation exposure |
| LS3 | `robots: noindex,follow` **and** the `X-Robots-Tag` header, so a crawler that never parses the body still de-indexes. `follow` is deliberate: `alternatives` are real destinations |
| LS4 | `alternatives` reuses `GymSummary` and the `/similar` ranking of §8, minus the closed gym. `AC-SRCH-01.2`'s "never an empty state" applies here too |
| LS5 | **Existing members are unaffected.** `BusinessRules.md` §18.5: suspension removes the *listing*, not the *membership*; check-in continues. Nothing on this surface implies otherwise, and the informational body links to `/me/memberships` when the caller is authenticated **client-side** — the API response is still principal-independent (ET6) |
| LS6 | **Why not `410 Gone` for `CLOSED`.** `410` is correct HTTP and wrong product: it gives the crawler and the browser nothing to render, and `FR-DETL-11` exists precisely because a member arriving from a two-year-old WhatsApp link deserves a sentence and a nearby alternative rather than a browser error page. The de-indexing job is done by `noindex`, which is the mechanism search engines actually honour |

### 5.7 Structured data must not contradict `BR-REV-07`

`seo.structured_data` is the one place where a rule enforced perfectly in the API body can be
re-broken twelve lines later. `AggregateRating` in JSON-LD is consumed by a crawler that will render
stars in a result page, so:

| Rule | Statement |
| :--- | :--- |
| SD-A | `aggregateRating` is **present only when `rating.display_state = 'RATED'`**. Below `minimum_reviews_for_rating` the key is **absent from the JSON-LD object**, exactly as `rating_avg` is absent from the body. One condition, evaluated once, used twice |
| SD-B | `reviewCount` in JSON-LD is the same integer as `rating.review_count`, never a padded or rounded figure. `NFR-DQ-02` |
| SD-C | `makesOffer` lists **only** `PUBLISHED` + `PUBLIC` plans (`BR-PLN-05`), prices as **major-unit decimal strings** because schema.org requires it, converted by the one formatter, never re-derived. The wire body keeps paise (M1); the JSON-LD is a *rendering*, and it is the only place in the platform where a major-unit amount is emitted |
| SD-D | `priceValidUntil` is the promotion end date when a promotion is running, otherwise 90 days out. An offer with no validity is treated as indefinite, and an indefinitely-advertised promotional price is a `BR-PLN-07` problem |
| SD-E | `@type` is `HealthAndBeautyBusiness` with `additionalType: ExerciseGym`. `LocalBusiness` alone loses the vertical; `SportsActivityLocation` is not a `LocalBusiness` subtype in the vocabulary crawlers reward |
| SD-F | The block is emitted **by the API**, not assembled in the web app, so `FR-DETL-10` is testable in the contract suite rather than in a browser (`OA4`) |

### 5.8 Validation, side effects and future compatibility

| Aspect | Statement |
| :--- | :--- |
| **Validation** | `.strict()` query schema; `slug` matched against the `Schema.md` §2.4 `slug` domain **before** any database call; `lat`/`lng` clamped to 5 dp and cross-validated as a pair; `review_preview`/`similar_preview` bounded so a caller cannot turn the detail read into an unpaginated review dump |
| **Side effects — rows** | **None.** `GET` is safe (`§14` R2). No `attribution_events` row is written here: `A6.3` attribution is recorded on the **click-through to checkout**, not on a page view, and writing one per anonymous detail view would put 5 M rows/year into a table whose index decides commission |
| **Side effects — ledger / outbox / notifications** | None, none, none |
| **Side effects — audit** | None. `audit_log` records mutations (`SD8`); a public read is covered by the access log and the `X-Correlation-Id`, not by an audit row |
| **Analytics** | `gym_detail_viewed` is emitted **by the client** with `source` (§13.5 EVT-06). The API cannot know whether the visitor arrived from search, a category page, a share link or their favourites |
| **Future compatibility** | Additive-only under §14.1: new gallery renditions are new keys inside `renditions`; a new amenity `display_group` is data, not a schema change; `listing_state` may gain values, so a client **must** treat an unknown value as `UNAVAILABLE` and render the notice rather than the listing. Adding `is_favourited` is **forbidden** — it would be an additive field that silently invalidates every edge cache (ET6) |

---

## 6. `GET /v1/gyms/:slug/plans` — the public plan catalogue

| Attribute | Value |
| :--- | :--- |
| **Purpose** | The complete purchasable catalogue for one gym: every `PUBLISHED` + `PUBLIC` plan with price, duration, inclusions, joining fee, access windows, eligibility, freeze and transfer terms, branch availability, a **monthly-equivalent price for every plan** (`FR-DETL-03`) and a `price_fingerprint` per plan (`BR-PLN-03`) |
| **Surfaces** | `web` (`SCR-WEB-003` region 3, the plan panel) · not `dash` · not `admin` |
| **Auth mode** | `none` — `@Public()` |
| **Required permission** | **`—`**. `@Public()`, no permission string (`API_Catalog.md` §5.4 allowlist row 1–12) |
| **Tenant scope** | **`public`** — §2.2 elevation, `PublicVisibilityPredicate` composed in the query |
| **Idempotency** | `N/A` — safe method |
| **Rate-limit class** | `RL-PUBLIC` — 120/min per IP, burst 30 |
| **Cache policy** | `CDN-300` + `ETag` + `Vary: Accept-Language`. **`stale-if-error` is forbidden here** (§3.4) — this is the price surface |

### 6.1 Request

| Name | In | Type | Default | Constraint | Required | Purpose |
| :--- | :--- | :--- | :--- | :--- | :-: | :--- |
| `slug` | path | string | — | §5.1 slug domain | yes | Same resolution and same `409 SLUG_AMBIGUOUS` rule as §5.5 |
| `city_slug` | query | string | — | slug, 2–80 | no | Disambiguation, §5.5 |
| `branch_id` | query | uuid | — | UUIDv7 | no | Return only plans purchasable at that branch (`BR-PLN-01`, `plan_branches`). An unknown or non-`ACTIVE` branch of this gym is `404 BRANCH_NOT_FOUND`; a branch belonging to **another** gym is the same `404` (§1.5 TD5) |
| `plan_type` | query | enum | — | `DURATION` \| `SESSION` | no | Filter |

```ts
// illustrative — not committed code
export const GetGymPlansQuery = z.object({
  city_slug: z.string().regex(SLUG).min(2).max(80).optional(),
  branch_id: z.string().uuid().optional(),
  plan_type: z.enum(['DURATION', 'SESSION']).optional(),
}).strict();
// There is no `visibility` parameter and there never will be one — §6.4.
// Unpaginated by design: API_Catalog.md §1.7.4 row 3. A gym cannot hold enough
// public plans for a cursor to be meaningful, and BR-PLN-06 caps the catalogue.
```

### 6.2 Response — `200`

```json
// illustrative — not committed code
// HTTP/1.1 200 OK    ETag: "W/gp-01932c7e-4b19f207"
// Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=60
{
  "gym_id": "01932c7e-3f81-7a04-b2e6-9c11d4a8e770",
  "slug": "iron-works-andheri-west",
  "currency": "INR",
  "plan_count": 5,
  "priced_at": "2026-08-05T09:30:00Z",
  "plans": [
    { "plan_id": "01932c81-1a11-7000-8b21-4c9d2e7f5011",
      "name": "Day Pass — Trial", "description": "One full-access visit. Buy it, walk in, decide after.",
      "plan_type": "SESSION", "session_count": 1, "session_validity_days": 7,
      "price_minor": "29900", "effective_price_minor": "29900", "joining_fee_minor": "0",
      "monthly_equivalent_basis": "NOT_APPLICABLE",
      "is_trial": true,
      "inclusions": ["Full gym floor", "Locker for the visit"],
      "access_window": { "is_unrestricted": true, "windows": [] },
      "gender_eligibility": "ANY", "freeze_allowed": false, "transfer_allowed": false,
      "available_at_branch_ids": ["01932c7f-0a11-7000-91d2-5f8b3c2e6104",
                                  "01932c7f-1b22-7000-a2e3-6a9c4d3f7215"],
      "price_fingerprint": "pf_1_4c9d2e7f5011_29900_none_1753948800",
      "priced_at": "2026-08-05T09:30:00Z",
      "purchase_action": { "enabled": true, "plan_id": "01932c81-1a11-7000-8b21-4c9d2e7f5011" } },

    { "plan_id": "01932c81-2b22-7000-9c32-5d0e3f806122",
      "name": "Monthly — Full Access", "plan_type": "DURATION",
      "duration_value": 1, "duration_unit": "MONTH",
      "price_minor": "299900", "effective_price_minor": "299900", "joining_fee_minor": "100000",
      "monthly_equivalent_minor": "299900", "monthly_equivalent_basis": "EXACT",
      "inclusions": ["Full gym floor", "Group classes", "Locker", "One body-composition scan"],
      "access_window": { "is_unrestricted": true, "windows": [] },
      "gender_eligibility": "ANY", "freeze_allowed": false, "transfer_allowed": false,
      "available_at_branch_ids": ["01932c7f-0a11-7000-91d2-5f8b3c2e6104",
                                  "01932c7f-1b22-7000-a2e3-6a9c4d3f7215"],
      "price_fingerprint": "pf_1_5d0e3f806122_299900_none_1753948800",
      "priced_at": "2026-08-05T09:30:00Z",
      "purchase_action": { "enabled": true, "plan_id": "01932c81-2b22-7000-9c32-5d0e3f806122" } },

    { "plan_id": "01932c81-3c33-7000-ad43-6e1f40917233",
      "name": "Quarterly — Full Access", "plan_type": "DURATION",
      "duration_value": 3, "duration_unit": "MONTH",
      "price_minor": "749900", "effective_price_minor": "749900", "joining_fee_minor": "100000",
      "monthly_equivalent_minor": "249967", "monthly_equivalent_basis": "EXACT",
      "inclusions": ["Full gym floor", "Group classes", "Locker", "Two body-composition scans"],
      "access_window": { "is_unrestricted": true, "windows": [] },
      "gender_eligibility": "ANY", "freeze_allowed": true, "freeze_max_days": 15,
      "transfer_allowed": false,
      "available_at_branch_ids": ["01932c7f-0a11-7000-91d2-5f8b3c2e6104",
                                  "01932c7f-1b22-7000-a2e3-6a9c4d3f7215"],
      "price_fingerprint": "pf_1_6e1f40917233_749900_none_1753948800",
      "priced_at": "2026-08-05T09:30:00Z",
      "purchase_action": { "enabled": true, "plan_id": "01932c81-3c33-7000-ad43-6e1f40917233" } },

    { "plan_id": "01932c81-4d44-7000-be54-7f2051a28344",
      "name": "Half-Yearly — Full Access", "plan_type": "DURATION",
      "duration_value": 6, "duration_unit": "MONTH",
      "price_minor": "1349900", "effective_price_minor": "1349900", "joining_fee_minor": "0",
      "monthly_equivalent_minor": "224983", "monthly_equivalent_basis": "EXACT",
      "inclusions": ["Full gym floor", "Group classes", "Locker", "Joining fee waived"],
      "access_window": { "is_unrestricted": true, "windows": [] },
      "gender_eligibility": "ANY", "freeze_allowed": true, "freeze_max_days": 30,
      "transfer_allowed": false,
      "available_at_branch_ids": ["01932c7f-0a11-7000-91d2-5f8b3c2e6104"],
      "price_fingerprint": "pf_1_7f2051a28344_1349900_none_1753948800",
      "priced_at": "2026-08-05T09:30:00Z",
      "purchase_action": { "enabled": true, "plan_id": "01932c81-4d44-7000-be54-7f2051a28344" } },

    { "plan_id": "01932c81-6f00-7000-b3a4-7d0e5b4c8326",
      "name": "Annual — Full Access", "plan_type": "DURATION",
      "duration_value": 12, "duration_unit": "MONTH",
      "price_minor": "2999900", "effective_price_minor": "2398800", "joining_fee_minor": "100000",
      "monthly_equivalent_minor": "199900", "monthly_equivalent_basis": "EXACT",
      "promotion": { "ends_at": "2026-08-31T18:29:59Z", "saving_minor": "601100" },
      "inclusions": ["Full gym floor", "Group classes", "Locker", "Four body-composition scans",
                     "Two personal-training sessions"],
      "access_window": { "is_unrestricted": true, "windows": [] },
      "gender_eligibility": "ANY", "freeze_allowed": true, "freeze_max_days": 45,
      "transfer_allowed": true,
      "available_at_branch_ids": ["01932c7f-0a11-7000-91d2-5f8b3c2e6104",
                                  "01932c7f-1b22-7000-a2e3-6a9c4d3f7215"],
      "price_fingerprint": "pf_1_9c11d4a8e770_2398800_01932d0177aa_1754380800",
      "priced_at": "2026-08-05T09:30:00Z",
      "purchase_action": { "enabled": true, "plan_id": "01932c81-6f00-7000-b3a4-7d0e5b4c8326" } }
  ]
}
```

**Six notes.** (1) `plan_count` is the count of **returned** plans, never of rows in `plans` — see
§6.4. (2) `promotion.ends_at` is `2026-08-31T18:29:59Z`, which is 31 August 23:59:59 `Asia/Kolkata`;
the wire is UTC (`T1`) and the client localises. (3) `joining_fee_minor` is `"0"` on the trial and
the half-yearly plan and is **never omitted** — `FR-DETL-02` requires the buyer to see that there is
no fee, and an absent key reads as unknown. (4) Every plan carries its **own** fingerprint; a gym
that changes one plan's price invalidates that plan's fingerprint and no other, so a buyer holding
the annual plan is not forced to re-confirm because the day pass moved. (5) `available_at_branch_ids`
on the half-yearly plan lists one branch — `BR-PLN-01`, and checkout at the other branch is
`422 PLAN_NOT_AVAILABLE_AT_BRANCH`, raised by `ordering`, not here. (6) There is **no `visibility`
field**, no `status` field and no `created_by` on any plan object.

### 6.3 `FR-DETL-03` — a monthly-equivalent price for **every** plan, worked

The rule table is §4.3. This is the same table applied to the five plans above, because
"monthly equivalent" is the field most likely to be implemented three different ways:

| Plan | `effective_price_minor` | Arithmetic | `monthly_equivalent_minor` | Basis |
| :--- | ---: | :--- | ---: | :--- |
| Day Pass — Trial | 29,900 | `SESSION` — no honest monthly figure exists | **omitted** | `NOT_APPLICABLE` |
| Monthly | 299,900 | ÷ 1 | 299,900 | `EXACT` |
| Quarterly | 749,900 | ÷ 3 = 249,966.67 → `round_half_even` | **249,967** | `EXACT` |
| Half-Yearly | 1,349,900 | ÷ 6 = 224,983.33 → `round_half_even` | **224,983** | `EXACT` |
| Annual | 2,398,800 | ÷ 12 | 199,900 | `EXACT` |

| Rule | Statement |
| :--- | :--- |
| ME1 | The divisor is the **promotional** price when a promotion is running, because that is what the buyer would pay today. A monthly equivalent computed from the struck-through list price would advertise a figure nobody can buy |
| ME2 | The **joining fee is excluded** and returned separately (§4.3). Amortising ₹1,000 over 12 months to make the annual plan read ₹2,082/month, while the monthly plan reads ₹2,999 + ₹1,000 once, compares two different things |
| ME3 | `SESSION` plans **omit** the field and set `NOT_APPLICABLE`. A client that renders "—" is correct; a client that renders "₹0" has misread an omission as a zero, which is the `BR-REV-07` bug in another costume |
| ME4 | `NORMALISED` (mean Gregorian month, 30.4375 days) applies only to `DAY`/`WEEK` duration plans. It is labelled so the UI can say *"approx."*, because 30.4375 is a convention and honesty about the convention is `FR-DETL-03`'s actual requirement |
| ME5 | The figure is computed **server-side, once**, and never in the client. Two clients computing it two ways is how a marketplace ends up advertising two prices for one plan |

### 6.4 `BR-PLN-05` — where a staff-only plan is stopped, and it is not the serialiser

> *"A staff-only plan is never returned by any public API or rendered on any public surface."*
> `MASTER_PRD.md` §A8.2, `BusinessRules.md` §11, mandatory.

Iron Works holds a sixth plan — `"Staff & Family — Complimentary"`, `visibility = STAFF_ONLY`,
`status = PUBLISHED` — used by the gym to enrol trainers' families at no charge. It appears in
**none** of: `plans[]`, `plan_count`, `plans_summary.cheapest_plan`, `lowest_monthly_equivalent_minor`,
`durations_available`, `seo.structured_data.makesOffer`, the comparison matrix of §9, the
`search_documents` projection, or the sitemap. Four independent stops, deliberately redundant:

| # | Layer | Mechanism | If this one alone existed |
| :-: | :--- | :--- | :--- |
| 1 | `L1-DB` | `idx_plans__gym_status_visibility (gym_id, status, visibility)` — the public query is index-driven on the composite, so the staff-only row is never fetched | An index is an optimisation, not a guarantee; a query that ignores it still returns the row |
| 2 | **`L6-UC`** — **the enforcement point** | The repository method that serves every public plan read is the **only** method in `catalog` that reads `plans` without a tenant context, and its `where` is `{ gym_id, status: 'PUBLISHED', visibility: 'PUBLIC', deleted_at: null }` with the visibility clause **not parameterised**. There is no code path that can pass `STAFF_ONLY` to it, because it takes no visibility argument | This is the guarantee. The rest is defence in depth |
| 3 | `L8-DTO` | `PlanCard` (§4.3) has **no `visibility` field**, so even a leaked row cannot tell a client what it is | A filtered serialiser is a filter a refactor removes |
| 4 | `L12-CI` | Two absence assertions in the contract suite: (a) **no public response schema in the generated OpenAPI document contains a `visibility` property**; (b) the `BR-PLN-05-N1` fixture — a gym whose *cheapest* plan is `STAFF_ONLY` — returns a catalogue whose minimum price is the cheapest **public** plan, and `plan_count` excludes the hidden row | Without it, stop 2 survives exactly until the first well-meaning refactor |

**The count is the subtle part.** Returning `plan_count: 6` with five plans would disclose that a
private plan exists — the same class of leak that `PLAN_NOT_PUBLISHED`'s message guidance guards
against (*"do not disclose that a private plan exists"*, `README.md` §9.5.4). `plan_count` is
`plans.length`, computed after the predicate, and asserted equal to it in the contract test.

### 6.5 Errors

| Code | HTTP | When | User-facing message | Retryable |
| :--- | :-: | :--- | :--- | :--- |
| `VALIDATION_FAILED` | 400 | `branch_id` not a UUID, `plan_type` outside the enum | "That link doesn't look right." `details[]` names the parameter | Fix |
| `UNKNOWN_QUERY_PARAMETER` | 400 | Any key outside §6.1 — including `visibility`, `status`, `tenant_id` | Developer-facing; naming the parameter is the point (§13.4) | Fix |
| `TENANT_HEADER_NOT_ACCEPTED` | 400 | `X-Tenant-Id` present | Developer-facing | Fix |
| `GYM_NOT_FOUND` | 404 | Unknown slug, never-approved gym, soft-deleted gym | §5.3 wording | No |
| `BRANCH_NOT_FOUND` | 404 | `branch_id` unknown, inactive, or belonging to another gym | "That branch isn't available. Showing all plans instead." The client retries without the parameter | Fix |
| `SLUG_AMBIGUOUS` | 409 | §5.5 | §5.3 wording | Fix |
| `RATE_LIMIT_EXCEEDED` | 429 | `RL-PUBLIC` empty | `Retry-After` in seconds | Wait |
| `INTERNAL_ERROR` | 500 | Unhandled | Correlation id | Wait |
| `DEPENDENCY_UNAVAILABLE` | 503 | Read replica exhausted | **No `stale-if-error`** — the honest answer to "I cannot read the current price" is a `503`, not yesterday's price | Wait |

**A gym with zero public plans is not reachable.** `PublicVisibilityPredicate` requires ≥1 published
`PUBLIC` plan, so `plans: []` cannot be returned by a `200`: the gym would have failed the predicate
and the request would be a `404`. `plans` is non-empty on every `200`, and the contract test asserts
it — which is why `available_at_branch_ids` is documented as never empty in §4.3.

### 6.6 Business rules, validation, side effects, future compatibility

| Aspect | Statement |
| :--- | :--- |
| **`BR-PLN-05`** | §6.4, four stops, enforcement point `L6-UC` |
| **`BR-PLN-03`** | Per-plan `price_fingerprint` + `priced_at`; the comparison happens in `ordering` (§3.2 part 3). This endpoint's obligation is **emission and correctness**, and `BR-PLN-03-P1` asserts that the fingerprint emitted here is byte-identical to the one `POST /orders` recomputes from the same rows |
| **`BR-PLN-07`** | At most one active promotion per plan is a write-side invariant; this surface therefore emits **one** `promotion` object or none, never an array |
| **`BR-PLN-02`** | A price change does not affect existing memberships. Nothing here reveals historical prices — a plan object is *today's* offer |
| **`BR-GYM-01` / `BR-TEN-05` / `BR-TEN-06`** | `PublicVisibilityPredicate` composed in the same query, `L6-UC` |
| **`FR-DETL-02` / `FR-DETL-03`** | §6.2, §6.3 |
| **Validation** | `.strict()`; `branch_id` resolved **against this gym** before use, so a UUID from another tenant cannot select rows; no monetary field is accepted (M3) |
| **Side effects** | None — rows, ledger, outbox, notifications and audit are all untouched. `plan_viewed` (EVT-08) is a **client** event; the server emits nothing |
| **Future compatibility** | Additive. `plan_type` may gain values, so a client must render an unknown type using `name`, `price_minor` and `inclusions` and hide the duration control rather than fail. Instalment plans (`FR-PLAN-09`, Phase 2) arrive as an optional `instalment` object; the top-level price fields keep their meaning. **`visibility` will never be added** — §6.4 stop 4a is a permanent CI assertion |

---

## 7. `GET /v1/gyms/:slug/reviews` — the review stream

| Attribute | Value |
| :--- | :--- |
| **Purpose** | `FR-DETL-05` in full: a **paginated**, **sortable by recency and rating**, **filterable by rating** list of published reviews, each carrying display name, membership tenure band, verified marker, rating, sub-ratings, text, photos, date and the gym's response |
| **Surfaces** | `web` (`SCR-WEB-003` region 6) |
| **Auth mode** | `none` — `@Public()` |
| **Required permission** | **`—`** |
| **Tenant scope** | **`public`** — `reviews` is a `P-STD` tenant table, so this read runs under the §2.2 `app_platform_ro` elevation with `PublicVisibilityPredicate` **and** `reviews.status = 'PUBLISHED'` in the same `WHERE` |
| **Idempotency** | `N/A` |
| **Rate-limit class** | `RL-PUBLIC` |
| **Cache policy** | `CDN-300` + `ETag`. Each cursor page is its own cache key and its own `ETag` (`README.md` §7.4: *"a cursor page is a stable, cacheable object keyed by its cursor"*) |

### 7.1 Request

| Name | In | Type | Default | Constraint | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `slug` | path | string | — | §5.1 | The gym |
| `city_slug` | query | string | — | slug | §5.5 disambiguation |
| `limit` | query | integer | **20** (public discovery default, `README.md` §7.1) | 1…**50** here, below the platform cap of 100 | Above 50 → `400 LIMIT_EXCEEDS_MAXIMUM` stating 50 |
| `cursor` | query | string | absent = first page | opaque (`CO-4`) | Never constructed by a client |
| `sort` | query | enum | `published_at:desc` | `published_at:desc` \| `published_at:asc` \| `rating:desc` \| `rating:asc` | Anything else → `400 SORT_FIELD_NOT_ALLOWED` listing the four |
| `rating` | query | integer | — | 1…5, exact | `FR-DETL-05` "filterable by rating". Exact, not a floor: a visitor filtering to `2` wants to read the two-star reviews, not everything at two and above |
| `has_response` | query | boolean | — | — | Reviews the gym answered. `AC-DETL-02.3` makes the response a first-class object, so filtering on it is free |

```ts
// illustrative — not committed code
export const GetGymReviewsQuery = z.object({
  city_slug: z.string().regex(SLUG).min(2).max(80).optional(),
  limit:  z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(512).optional(),
  sort:   z.enum(['published_at:desc','published_at:asc','rating:desc','rating:asc'])
           .default('published_at:desc'),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  has_response: z.coerce.boolean().optional(),
}).strict();
```

**The mutable-sort hazard, handled.** `README.md` §7.2 warns that a cursor breaks when its sort
column mutates mid-scroll, and `rating` **is** mutable for seven days (`BR-REV-02`). The sort key is
therefore the composite `(rating, published_at DESC, review_id)` — `review_id` is UUIDv7 and
immutable, so an edited review relocates itself and nothing else, and no row is skipped or repeated
except the edited one. `idx_reviews__gym_status_published (gym_id, status, published_at DESC)`
(`Schema.md` §10.1, *"not `tenant_id`-leading: it serves a **public** read of an approved listing"*)
serves the default sort directly.

### 7.2 Response — `200`

```json
// illustrative — not committed code
// HTTP/1.1 200 OK    ETag: "W/gr-01932c7e-p1-6d20a8f4"
// Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=60
{
  "gym_id": "01932c7e-3f81-7a04-b2e6-9c11d4a8e770",
  "rating": {
    "review_count": 47, "rating_avg": 4.6,
    "distribution": { "5": 31, "4": 10, "3": 4, "2": 1, "1": 1 },
    "display_state": "RATED", "minimum_reviews_for_rating": 3
  },
  "applied": { "sort": "published_at:desc", "rating": null, "has_response": null },
  "items": [
    {
      "review_id": "01932d55-0011-7000-8a12-4b6c8d1e3057",
      "reviewer": { "display_name": "Priya S.", "tenure_band": "MEMBER_6_12_MONTHS",
                    "is_verified_member": true },
      "rating": 5,
      "sub_ratings": { "cleanliness": 5, "equipment": 5, "staff": 4, "value": 5 },
      "body": "Racks are never crowded even at 7 am and the AC actually works through Mumbai summer. Trainers correct form without being asked.",
      "photos": [],
      "published_at": "2026-07-22T04:15:00Z",
      "edited_at": null,
      "response": {
        "body": "Thank you Priya — we added the third rack in June exactly for the morning rush.",
        "responded_at": "2026-07-23T05:02:00Z",
        "author_label": "Iron Works Fitness Studio"
      }
    },
    {
      "review_id": "01932d55-1122-7000-9b23-5c7d9e2f4168",
      "reviewer": { "display_name": "Rahul M.", "tenure_band": "MEMBER_1_3_MONTHS",
                    "is_verified_member": true },
      "rating": 4,
      "sub_ratings": { "cleanliness": 4, "equipment": 5, "staff": 4, "value": 4 },
      "body": "Great equipment. Evening slot after 7 pm gets tight for the bench area.",
      "photos": [],
      "published_at": "2026-07-09T14:40:00Z",
      "edited_at": "2026-07-11T06:12:00Z"
    },
    {
      "review_id": "01932d55-2233-7000-ac34-6d8e0f305279",
      "reviewer": { "display_name": "Sneha K.", "tenure_band": "MEMBER_12_PLUS_MONTHS",
                    "is_verified_member": true },
      "rating": 2,
      "sub_ratings": { "cleanliness": 2, "equipment": 4, "staff": 3, "value": 3 },
      "body": "Equipment is good but the washrooms were not cleaned twice last month.",
      "photos": [],
      "published_at": "2026-06-28T03:05:00Z",
      "edited_at": null,
      "response": {
        "body": "You're right and we've moved to two cleaning rounds a day since 1 July. Please tell the front desk if it slips again.",
        "responded_at": "2026-06-29T09:30:00Z",
        "author_label": "Iron Works Fitness Studio"
      }
    }
  ],
  "next_cursor": "eyJ2IjoxLCJzb3J0IjoicHVibGlzaGVkX2F0OmRlc2MiLCJrIjpbIjIwMjYtMDYtMjhUMDM6MDU6MDBaIiwiMDE5MzJkNTUtMjIzMy03MDAwLWFjMzQtNmQ4ZTBmMzA1Mjc5Il19",
  "limit": 20
}
```

| Field | Contract |
| :--- | :--- |
| `reviewer.display_name` | **First name plus surname initial**, derived at read time from `users.full_name`. Never the full name, never the phone, never the email, never the `user_id` — `NFR-PRV-07`, `BR-DAT-06`. A member who has not set a name renders as the i18n key `review.reviewer.anonymous_member`, still verified |
| `reviewer.tenure_band` | §7.3. A **band**, never a date and never a day count, because a join date plus a check-in pattern re-identifies a person in a small gym |
| `reviewer.is_verified_member` | Literal `true`, exactly as `GymSummary.is_verified` is (§4.5). §7.4 |
| `sub_ratings` | The four `Schema.md` §10.1 axes — `cleanliness`, `equipment`, `staff`, `value`. All four or none; a partial object is unrepresentable |
| `body` | May be **absent** — `FR-REV-01` permits a rating with no text. Absent, never `""` (R8) |
| `photos` | Always present, **always `[]` in Phase 1**. `Schema.md` §10.1 has no review-media table and `FR-DETL-05` does not require one; the key is reserved so that Phase-2 review photos are an additive change to an existing array rather than a new field. Open item **`O-MKT-4`** |
| `edited_at` | Present and `null`, or a timestamp. This is the **one** nullable field in the document, and it is nullable rather than omitted because "this review was edited" is a fact a reader is entitled to, and an omission would read as "not edited" only by convention |
| `response` | Omitted when the gym has not replied. At most one, ever — `uq_review_responses__review_id`, `BR-REV-05` |
| `applied` | The echo of the resolved filter set, so a client renders "3-star reviews (4)" from the response rather than from its own state |
| `next_cursor` | `null` **only** at the end (`README.md` §7.1). A page shortened by the visibility predicate still carries a non-null cursor |

### 7.3 Tenure bands — `FR-DETL-05`'s "membership tenure"

Computed at read time from the membership that earned the review (`reviews.membership_id`), as
elapsed time between `memberships.start_date` and `reviews.published_at`, in `Asia/Kolkata`:

| Band | Condition | Why the band and not the number |
| :--- | :--- | :--- |
| `NEW_MEMBER` | < 1 month | A first-week review is worth reading *and* worth discounting; the reader decides |
| `MEMBER_1_3_MONTHS` | 1 – 3 months | |
| `MEMBER_3_6_MONTHS` | 3 – 6 months | |
| `MEMBER_6_12_MONTHS` | 6 – 12 months | |
| `MEMBER_12_PLUS_MONTHS` | ≥ 12 months | The band saturates; "4 years" would identify the gym's oldest member to anyone who knows the gym |

The band is **frozen at publication**, not recomputed on read. A review written in month two does not
become a twelve-month member's opinion because a year passed — and a value that changes underneath a
cached page would also make the `ETag` lie (`ET1`).

### 7.4 `BR-REV-03` — there is no unverified review type, and the schema is why

> *"Every published review carries a 'Verified member' marker; there is no unverified review type."*
> `BusinessRules.md` `BR-REV-03`, enforcement **STRUCTURAL**, `AUTHORITATIVE`.

| Layer | What holds the rule |
| :--- | :--- |
| `L1-DB` | `reviews.membership_id` is **`NOT NULL`** and `BR-REV-01` requires a recorded check-in on that membership. An unverified review is **unrepresentable** — not filtered, not hidden, *unrepresentable* |
| `L1-DB` (negative) | `reviews` has **no `is_verified` column**, and a migration adding a verification-status column **fails a schema check** (`BR-REV-03-N1`). There is no field to set wrongly |
| `L8-DTO` | `is_verified_member` is a `z.literal(true)` render-time constant. It is derived from the row's existence, so it cannot go stale |
| `L12-CI` | `BR-REV-03-P1`: **every** review object returned by **every** public endpoint in this document — §5.2's preview, §7.2's stream, §9's comparison — carries the marker. The assertion iterates the generated OpenAPI response schemas, not a hand-listed set |

`AC-DETL-02.2` is therefore satisfied by construction: *"there is no review on the page without one."*
A gym cannot buy reviews, because a review requires a membership and a turnstile record; and this
endpoint cannot accidentally publish an unverified one, because none exists to publish.

### 7.5 Errors, side effects and future compatibility

| Code | HTTP | When | Retryable |
| :--- | :-: | :--- | :--- |
| `VALIDATION_FAILED` | 400 | `rating` outside 1–5, `limit` below 1, malformed `has_response` | Fix |
| `SORT_FIELD_NOT_ALLOWED` | 400 | `sort` outside the four values — `details[]` lists all four | Fix |
| `LIMIT_EXCEEDS_MAXIMUM` | 400 | `limit > 50` — the message states 50 | Fix |
| `CURSOR_INVALID` | 400 | Corrupt, foreign or version-mismatched cursor. **"Reload the list" — never a silent reset to page one** (`README.md` §9.5.1) | Fix |
| `UNKNOWN_QUERY_PARAMETER` | 400 | Any key outside §7.1 — notably `user_id`, `status` and `offset` | Fix |
| `GYM_NOT_FOUND` · `SLUG_AMBIGUOUS` | 404 · 409 | §5.3 | No · Fix |
| `RATE_LIMIT_EXCEEDED` · `INTERNAL_ERROR` · `DEPENDENCY_UNAVAILABLE` | 429 · 500 · 503 | §6.5 | Wait |

**A gym with zero reviews is a `200`,** with `items: []`, `next_cursor: null`, and a `rating` block in
state `NO_REVIEWS` carrying `explanation_key`. An empty collection is not an error
(`README.md` §9.1) and `AC-DETL-02.1` requires the count *with an explanation*, which is exactly what
`RatingBlock` carries.

| Aspect | Statement |
| :--- | :--- |
| **Business rules** | `BR-REV-03` §7.4 · `BR-REV-07` — the `rating` block obeys §4.2 here as it does in §5.2, and the two blocks are produced by **one** serialiser so they cannot disagree · `BR-REV-05` — one response, enforced by a unique index · `BR-REV-06` — an unpublished or removed review disappears from this stream within one purge (§3.2) · `BR-GYM-01`, `BR-TEN-05` |
| **Validation** | `.strict()`; `sort` allowlisted, not parsed; the cursor's embedded sort must equal the requested sort or the request is `CURSOR_INVALID` — changing `sort` mid-scroll starts a new scroll (`README.md` §7.1) |
| **Side effects** | None. `reviews_expanded` (EVT-13) is emitted by the client on the *expand* interaction, not by the server on a fetch — the server cannot distinguish a human expanding a list from a crawler paginating it |
| **Future compatibility** | `photos` is reserved (`O-MKT-4`). A fifth sub-rating axis would be a new key inside `sub_ratings`, and a client must render unknown axes generically rather than enumerate the four. Helpfulness voting (`FR-REV-09`, Phase 2) arrives as an optional `helpful_count` plus a new `sort` value; adding a sort value is additive because `sort` is an allowlist the server owns |

---

## 8. `GET /v1/gyms/:slug/similar` — nearby comparable gyms

| Attribute | Value |
| :--- | :--- |
| **Purpose** | The last section of `FR-DETL-01`: *"similar gyms nearby"*. A deterministic, non-personalised set of visible gyms comparable to this one on **locality, category and price band**, used by the detail page strip, by the §5.6 informational payload's `alternatives`, and by the zero-result recovery of `FR-SRCH-12` |
| **Surfaces** | `web` (`SCR-WEB-003` region 8) |
| **Auth mode** | `none` — `@Public()` · **Required permission** `—` · **Tenant scope** `public` |
| **Idempotency** | `N/A` · **Rate-limit class** `RL-PUBLIC` · **Cache** `CDN-300` + `ETag`, purged with `gyms:{slug}:similar` on `gym.*`, `plan.*` and `tenant.*` (§3.2) |

### 8.1 Request and the similarity definition

| Name | In | Type | Default | Constraint | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `slug` | path | string | — | §5.1 | The subject gym, always excluded from its own results |
| `city_slug` | query | string | — | slug | §5.5 |
| `limit` | query | integer | **6** | 1…12 | Unpaginated: there is no `cursor` and no `next_cursor`. A "similar" list longer than twelve is a search, and the client should link to `/search/gyms` instead |
| `lat` / `lng` | query | number | — | §5.1 clamping | Populates `distance_metres` **relative to the visitor**; the ranking itself always measures from the subject gym's primary branch, never from the visitor |

**The ranking, stated so it can be tested rather than tuned in an argument.** Candidates are scored
over the `search_documents` projection (§2.2), which is why this endpoint costs one indexed query:

| # | Term | Weight | Source |
| :-: | :--- | :-- | :--- |
| 1 | `ST_DWithin` from the subject's primary branch, expanding **2 km → 5 km → 10 km** until `limit` candidates exist | Hard filter, then inverse-distance | `gix_search_documents__location`, ADR-0007 |
| 2 | Same `category_id` | ×1.5 | `gyms.category_id` |
| 3 | `min_price_minor` within ±40% of the subject's lowest monthly equivalent | ×1.3 | `FR-DETL-03`, `FR-SRCH-04` |
| 4 | Amenity overlap, Jaccard over `amenity_ids` | ×1.2 max | `FR-SRCH-03` |
| 5 | `rating_avg`, **Bayesian-adjusted** for review count | ×1.2 max | `FR-SRCH-10`. The adjusted figure is a **ranking input only** and is never emitted (§4.2) |
| 6 | Same `gender_policy` when the subject is `WOMEN_ONLY` | Hard filter | A women-only gym's visitor is not served a mixed gym as "similar" |

| Rule | Statement |
| :--- | :--- |
| SIM1 | **`is_featured` contributes zero weight.** It is echoed on each card because `FR-SRCH-11` requires promoted placements to be *labelled*, but a paid placement that reorders a "similar gyms" strip turns an editorial affordance into an unlabelled ad unit. Featured placement belongs to search, where it is disclosed |
| SIM2 | **At most two results from any one tenant**, so a nine-branch chain cannot fill the strip. The cap is applied after scoring, before truncation |
| SIM3 | Every candidate passes `PublicVisibilityPredicate` (§2.3). A suspended gym is not "similar", it is absent |
| SIM4 | The result is **independent of the caller**, including of `lat`/`lng` — those only annotate `distance_metres`. If the ordering depended on the visitor, the response could not be cached at an edge (§3.4) and `ET6` would break |
| SIM5 | Fewer than `limit` results — including **zero** — is a `200` with a short array and `expansion_applied: "10km"`. A gym in a city with three listings has no similar gyms, and that is a fact, not a failure |

### 8.2 Response — `200`

```json
// illustrative — not committed code
{
  "gym_id": "01932c7e-3f81-7a04-b2e6-9c11d4a8e770",
  "basis": { "category": "STRENGTH_TRAINING", "city_slug": "mumbai",
             "locality_name": "Andheri West",
             "reference_monthly_equivalent_minor": "199900", "currency": "INR" },
  "radius_metres_used": 5000,
  "expansion_applied": "5km",
  "items": [
    { "gym_id": "01932c8a-5e11-7000-9f42-3b7d1c5e9048", "slug": "the-lift-room-versova",
      "name": "The Lift Room", "is_verified": true,
      "category": { "key": "STRENGTH_TRAINING", "name": "Strength Training", "slug": "strength-training" },
      "locality_name": "Versova", "city_name": "Mumbai", "city_slug": "mumbai",
      "distance_metres": 2870,
      "rating": { "review_count": 22, "rating_avg": 4.4,
                  "distribution": { "5": 12, "4": 7, "3": 2, "2": 1, "1": 0 },
                  "display_state": "RATED", "minimum_reviews_for_rating": 3 },
      "currency": "INR", "lowest_monthly_equivalent_minor": "216600",
      "lowest_plan_id": "01932c8b-1c00-7000-8d13-4e6f2a7b1159",
      "price_fingerprint": "pf_1_4e6f2a7b1159_216600_none_1753948800",
      "top_amenities": [
        { "amenity_id": "01930001-0001-7000-8000-000000000101", "key": "FREE_WEIGHTS",
          "name": "Free weights", "icon": "dumbbell", "display_group": "EQUIPMENT" },
        { "amenity_id": "01930001-0001-7000-8000-000000000102", "key": "SQUAT_RACK",
          "name": "Squat rack", "icon": "rack", "display_group": "EQUIPMENT" },
        { "amenity_id": "01930001-0001-7000-8000-000000000204", "key": "TWO_WHEELER_PARKING",
          "name": "Two-wheeler parking", "icon": "scooter", "display_group": "FACILITIES" }
      ],
      "gender_policy": "MIXED", "is_open_now": true, "is_featured": false,
      "canonical_url": "https://www.<domain>/gyms/mumbai/the-lift-room-versova" },

    { "gym_id": "01932c8c-6f22-7000-a053-4c8e2d6f0159", "slug": "shakti-strength-jogeshwari",
      "name": "Shakti Strength Club", "is_verified": true,
      "category": { "key": "STRENGTH_TRAINING", "name": "Strength Training", "slug": "strength-training" },
      "locality_name": "Jogeshwari West", "city_name": "Mumbai", "city_slug": "mumbai",
      "distance_metres": 4120,
      "rating": { "review_count": 2, "display_state": "INSUFFICIENT_REVIEWS",
                  "minimum_reviews_for_rating": 3, "explanation_key": "rating.insufficient_reviews" },
      "currency": "INR", "lowest_monthly_equivalent_minor": "166600",
      "lowest_plan_id": "01932c8d-2d11-7000-9e24-5f703b8c226a",
      "price_fingerprint": "pf_1_5f703b8c226a_166600_none_1753948800",
      "top_amenities": [
        { "amenity_id": "01930001-0001-7000-8000-000000000101", "key": "FREE_WEIGHTS",
          "name": "Free weights", "icon": "dumbbell", "display_group": "EQUIPMENT" },
        { "amenity_id": "01930001-0001-7000-8000-000000000205", "key": "DRINKING_WATER_RO",
          "name": "RO drinking water", "icon": "water", "display_group": "FACILITIES" },
        { "amenity_id": "01930001-0001-7000-8000-000000000301", "key": "PERSONAL_TRAINING",
          "name": "Personal training", "icon": "trainer", "display_group": "SERVICES" }
      ],
      "gender_policy": "MIXED", "is_open_now": true, "is_featured": false,
      "canonical_url": "https://www.<domain>/gyms/mumbai/shakti-strength-jogeshwari" }
  ]
}
```

**Note the second card.** `Shakti Strength Club` has two reviews, so its `rating` block carries
`review_count`, `display_state: INSUFFICIENT_REVIEWS` and an `explanation_key`, and carries **no**
`rating_avg` and **no** `distribution` (§4.2). It is still ranked — term 5 uses the Bayesian-adjusted
figure internally — and it is still shown. `BR-REV-07` governs what is *displayed*, not what is
*ranked*, and conflating the two would bury every new gym.

**Errors** are exactly §6.5's set minus `BRANCH_NOT_FOUND`: `VALIDATION_FAILED`,
`UNKNOWN_QUERY_PARAMETER`, `TENANT_HEADER_NOT_ACCEPTED`, `GYM_NOT_FOUND`, `SLUG_AMBIGUOUS`,
`RATE_LIMIT_EXCEEDED`, `INTERNAL_ERROR`, `DEPENDENCY_UNAVAILABLE`. **Side effects:** none.
**Future compatibility:** the weights of §8.1 are **configuration** (`FR-SRCH-10`: *"the ranking
formula is configurable without deployment"*), so tuning them is not an API change; `basis` is
echoed so a client can explain the strip without knowing the formula, and new `basis` keys are
additive.

---

## 9. `POST /v1/compare` — resolve a comparison set of up to four gyms

| Attribute | Value |
| :--- | :--- |
| **Purpose** | `FR-DETL-08`: resolve 1–4 gym ids into one aligned comparison payload across **distance, rating, price by duration, amenities as a presence matrix, timings, gender policy and verified status** |
| **Surfaces** | `web` (`SCR-WEB-004`) |
| **Auth mode** | `none` — `@Public()` · **Required permission** `—` · **Tenant scope** `public` |
| **Idempotency** | **`N/A`** — see §9.1. A supplied `Idempotency-Key` is ignored, not rejected, because a proxy that adds one to every `POST` must not break a read |
| **Rate-limit class** | `RL-SEARCH` — 600/min per IP, burst 30 (`API_Catalog.md` §3.3). Higher than `RL-PUBLIC` because a comparison is edited repeatedly: add, remove, add again |
| **Cache policy** | `CDN-60` — `public, max-age=15, s-maxage=60, stale-while-revalidate=30`, keyed on **path + a canonical hash of the sorted `gym_ids`**, purged by every `compare:*` key containing any gym in the set (§3.2 part 2) |

### 9.1 Why a `POST` is the right verb for a pure read, and what that costs

| Consideration | Resolution |
| :--- | :--- |
| It writes nothing | Correct, and stated in the contract: **no row, no ledger entry, no outbox event, no audit record**. `PROJECT_CONSTITUTION.md` §14 does not require a read to be a `GET`; it requires a mutation not to be one |
| Then why not `GET /compare?gym_id=…&gym_id=…` | `API_Catalog.md` §3.3 fixes the verb as `POST`, and the reason survives inspection: four UUIDv7 values plus optional coordinates is ~160 characters of query string that some intermediaries truncate and most log verbatim, and repeated-key query parameters are the least consistently normalised thing in HTTP caching |
| Caching a `POST` | The edge caches it on **path + `SHA-256` of the canonicalised body** with the `gym_ids` array **sorted**, so `[A,B]` and `[B,A]` are one cache entry. `Cache-Control` is emitted on the response and the CDN is configured to honour it for this route only |
| Idempotency posture | **`N/A`, not `OPT`.** `BR-PAY-03` binds *money and state mutations*. Declaring `OPT` here would create an idempotency record for a read, which is a Redis write on the cheapest path on the site |
| `FR-DETL-09` — comparison state survives login and reload | **Client-side**, and deliberately so: the set lives in `localStorage` and rides the `FR-NAV-02` deferred-intent mechanism through the auth gate. The server holds no comparison state, which is exactly why the set survives a login that changes the principal |

### 9.2 Request

```ts
// illustrative — not committed code
export const CompareBody = z.object({
  gym_ids: z.array(z.string().uuid())
            .min(1)                       // 1 is legal: the client re-resolves after a removal
            .max(4)                       // AC-DETL-01.3 — the server is the second line, not the first
            .refine(a => new Set(a).size === a.length, { message: 'gym_ids must be unique' }),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
}).strict()                               // no tenant_id, no amounts, no sort — M3, TD1
  .refine(b => (b.lat === undefined) === (b.lng === undefined));
```

**`AC-DETL-01.3` — the fifth gym prompts a removal and is never silently dropped.**

| Where | Behaviour |
| :--- | :--- |
| Client (`SCR-WEB-004`) | Adding a fifth gym opens the "remove one to add this" prompt. The fifth id is **never sent** |
| Server, if it is sent anyway | **`422 COMPARE_SET_TOO_LARGE`** (`README.md` §9.5.4 — *"state the limit of four"*), with `details[]` listing **all five** ids that were submitted, in submission order, so the client can render the removal prompt from the error rather than from its own state |
| What the server must never do | Truncate to the first four and return `200`. A silent drop is the failure `AC-DETL-01.3` was written to forbid, and it is invisible in a UI that renders exactly what it receives |
| Duplicate ids | `400 VALIDATION_FAILED`. Deduplicating silently would let `[A,A,B,C,D]` become a legal five-gym set after dedup, which re-opens the same hole from the other side |

### 9.3 Response — `200`

```json
// illustrative — not committed code
// HTTP/1.1 200 OK   Cache-Control: public, max-age=15, s-maxage=60, stale-while-revalidate=30
// ETag: "W/cmp-3f9a12c8e05b7d64"
{
  "compared_at": "2026-08-05T09:31:12Z",
  "currency": "INR",
  "count": 3,
  "gyms": [
    { "gym_id": "01932c7e-3f81-7a04-b2e6-9c11d4a8e770", "slug": "iron-works-andheri-west",
      "name": "Iron Works Fitness Studio", "city_slug": "mumbai",
      "canonical_url": "https://www.<domain>/gyms/mumbai/iron-works-andheri-west",
      "cover_url": "https://media.<domain>/gyms/01932c7e/cover-640.webp" },
    { "gym_id": "01932c8a-5e11-7000-9f42-3b7d1c5e9048", "slug": "the-lift-room-versova",
      "name": "The Lift Room", "city_slug": "mumbai",
      "canonical_url": "https://www.<domain>/gyms/mumbai/the-lift-room-versova",
      "cover_url": "https://media.<domain>/gyms/01932c8a/cover-640.webp" },
    { "gym_id": "01932c8c-6f22-7000-a053-4c8e2d6f0159", "slug": "shakti-strength-jogeshwari",
      "name": "Shakti Strength Club", "city_slug": "mumbai",
      "canonical_url": "https://www.<domain>/gyms/mumbai/shakti-strength-jogeshwari",
      "cover_url": "https://media.<domain>/gyms/01932c8c/cover-640.webp" }
  ],
  "rows": {
    "verified":       [ { "value": true }, { "value": true }, { "value": true } ],
    "distance_metres":[ { "value": 2140 }, { "value": 3960 }, { "value": 5310 } ],
    "rating": [
      { "review_count": 47, "rating_avg": 4.6, "display_state": "RATED", "minimum_reviews_for_rating": 3 },
      { "review_count": 22, "rating_avg": 4.4, "display_state": "RATED", "minimum_reviews_for_rating": 3 },
      { "review_count": 2, "display_state": "INSUFFICIENT_REVIEWS", "minimum_reviews_for_rating": 3,
        "explanation_key": "rating.insufficient_reviews" }
    ],
    "price_by_duration": [
      { "duration_value": 1,  "duration_unit": "MONTH",
        "cells": [ { "available": true,  "monthly_equivalent_minor": "299900", "effective_price_minor": "299900",
                     "plan_id": "01932c81-2b22-7000-9c32-5d0e3f806122",
                     "price_fingerprint": "pf_1_5d0e3f806122_299900_none_1753948800" },
                   { "available": true,  "monthly_equivalent_minor": "324900", "effective_price_minor": "324900",
                     "plan_id": "01932c8b-1c00-7000-8d13-4e6f2a7b1159",
                     "price_fingerprint": "pf_1_4e6f2a7b1159_324900_none_1753948800" },
                   { "available": true,  "monthly_equivalent_minor": "199900", "effective_price_minor": "199900",
                     "plan_id": "01932c8d-2d11-7000-9e24-5f703b8c226a",
                     "price_fingerprint": "pf_1_5f703b8c226a_199900_none_1753948800" } ] },
      { "duration_value": 3,  "duration_unit": "MONTH",
        "cells": [ { "available": true,  "monthly_equivalent_minor": "249967", "effective_price_minor": "749900",
                     "plan_id": "01932c81-3c33-7000-ad43-6e1f40917233",
                     "price_fingerprint": "pf_1_6e1f40917233_749900_none_1753948800" },
                   { "available": false, "reason_key": "compare.plan_not_offered" },
                   { "available": true,  "monthly_equivalent_minor": "183300", "effective_price_minor": "549900",
                     "plan_id": "01932c8d-3e22-7000-af35-6071429d337b",
                     "price_fingerprint": "pf_1_6071429d337b_549900_none_1753948800" } ] },
      { "duration_value": 12, "duration_unit": "MONTH",
        "cells": [ { "available": true,  "monthly_equivalent_minor": "199900", "effective_price_minor": "2398800",
                     "plan_id": "01932c81-6f00-7000-b3a4-7d0e5b4c8326",
                     "price_fingerprint": "pf_1_9c11d4a8e770_2398800_01932d0177aa_1754380800",
                     "promotion": { "ends_at": "2026-08-31T18:29:59Z", "saving_minor": "601100" } },
                   { "available": true,  "monthly_equivalent_minor": "216600", "effective_price_minor": "2599200",
                     "plan_id": "01932c8b-4f33-7000-9046-718253ae448c",
                     "price_fingerprint": "pf_1_718253ae448c_2599200_none_1753948800" },
                   { "available": false, "reason_key": "compare.plan_not_offered" } ] }
    ],
    "amenities": [
      { "amenity_id": "01930001-0001-7000-8000-000000000101", "key": "FREE_WEIGHTS",
        "name": "Free weights", "display_group": "EQUIPMENT", "present": [ true, true, true ] },
      { "amenity_id": "01930001-0001-7000-8000-000000000102", "key": "SQUAT_RACK",
        "name": "Squat rack", "display_group": "EQUIPMENT", "present": [ true, true, false ] },
      { "amenity_id": "01930001-0001-7000-8000-000000000201", "key": "AIR_CONDITIONING",
        "name": "Air conditioning", "display_group": "FACILITIES", "present": [ true, false, false ] },
      { "amenity_id": "01930001-0001-7000-8000-000000000204", "key": "TWO_WHEELER_PARKING",
        "name": "Two-wheeler parking", "display_group": "FACILITIES", "present": [ true, true, false ] },
      { "amenity_id": "01930001-0001-7000-8000-000000000301", "key": "PERSONAL_TRAINING",
        "name": "Personal training", "display_group": "SERVICES", "present": [ true, false, true ] }
    ],
    "hours_today": [
      { "weekday": 2, "is_open_now": true,  "opens_at": "05:30", "closes_at": "11:00",
        "timezone": "Asia/Kolkata", "source": "WEEKLY" },
      { "weekday": 2, "is_open_now": true,  "opens_at": "06:00", "closes_at": "22:00",
        "timezone": "Asia/Kolkata", "source": "WEEKLY" },
      { "weekday": 2, "is_open_now": false, "opens_at": "16:00", "closes_at": "22:00",
        "timezone": "Asia/Kolkata", "source": "WEEKLY" }
    ],
    "gender_policy": [ { "value": "MIXED" }, { "value": "MIXED" }, { "value": "MIXED" } ]
  },
  "unavailable": [
    { "gym_id": "01932c92-7e10-7000-9a55-1d3f6b2c8409",
      "listing_state": "TEMPORARILY_CLOSED",
      "name": "Pulse Fitness",
      "reason_key": "compare.gym_unavailable" }
  ]
}
```

### 9.4 `AC-DETL-01.2` — an absent amenity is `false`, never a missing key

> *"Given a gym in my comparison lacks an amenity another has, when I view the amenity row, then
> absence is shown explicitly rather than left blank."*

| Rule | Statement |
| :--- | :--- |
| CM1 | `rows.amenities` is the **union** of the amenity sets of every gym in the comparison, one row per distinct amenity, sorted by `display_group` then `sort_order` from the taxonomy (`Schema.md` §12.2) |
| CM2 | Each row's `present` array has **exactly `count` entries**, positionally aligned with `gyms[]`, and every entry is a **boolean literal**. There is no `null`, no omission, no sparse object keyed by `gym_id`. `Shakti Strength Club` has no squat rack and the wire says `false` — the client renders a cross, not a blank cell |
| CM3 | This is the **one deliberate exception** to the omit-absent-fields rule of §1.1 R8. Elsewhere absence means "not applicable"; in a comparison matrix absence means "we did not check", and the whole point of `AC-DETL-01.2` is that the buyer must not have to guess which |
| CM4 | The same alignment law governs **every** row: `distance_metres`, `rating`, `hours_today`, `gender_policy` and each `price_by_duration.cells` array are all length `count` and positionally aligned. A row shorter than `count` is a contract violation, and the contract test asserts the lengths |
| CM5 | An unavailable duration is `{ "available": false, "reason_key": "compare.plan_not_offered" }` — an **object that says no**, not a missing cell. Same principle, applied to price |
| CM6 | The duration axis is the **union of durations offered by the compared gyms**, so a gym that sells only 1 and 12 months shows an explicit `false` at 3 and 6 rather than shifting its column |

**`unavailable[]` — the `AC-FAV-01.3` principle applied to comparison.** A gym id that resolves but
fails `PublicVisibilityPredicate` is returned in `unavailable[]` with its `listing_state` and its
name, and is **excluded from `gyms[]` and from every row**, so alignment holds. It is never silently
dropped, because a buyer who put four gyms in a comparison and receives three has been told nothing.
An id that resolves to **nothing at all** — never existed, or soft-deleted — is
`404 GYM_NOT_FOUND` with `details[]` naming the id; the client removes it from `localStorage` and
re-resolves.

### 9.5 Errors, business rules and future compatibility

| Code | HTTP | When | Retryable |
| :--- | :-: | :--- | :--- |
| `VALIDATION_FAILED` | 400 | Empty `gym_ids`, a non-UUID, duplicate ids, `lat` without `lng` | Fix |
| `UNKNOWN_FIELD` | 400 | Any body key outside `gym_ids`, `lat`, `lng` — `.strict()` (M3) | Fix |
| `TENANT_HEADER_NOT_ACCEPTED` | 400 | `X-Tenant-Id`, or a `tenant_id` in the body | Fix |
| `GYM_NOT_FOUND` | 404 | One or more ids resolve to nothing; `details[]` names each | No |
| `COMPARE_SET_TOO_LARGE` | **422** | More than four ids; `details[]` echoes all submitted ids | Fix |
| `RATE_LIMIT_EXCEEDED` · `INTERNAL_ERROR` · `DEPENDENCY_UNAVAILABLE` | 429 · 500 · 503 | §6.5 | Wait |

| Aspect | Statement |
| :--- | :--- |
| **Business rules** | `BR-GYM-01` and `BR-TEN-05`/`BR-TEN-06` via `PublicVisibilityPredicate`, per gym, before assembly · `BR-PLN-05` — every cell is drawn from the §6.4 repository method, so a `STAFF_ONLY` plan cannot become a comparison cell · `BR-PLN-03` — every priced cell carries its plan's `price_fingerprint`, so a buyer who clicks through from the comparison is protected by the same re-price abort · `BR-REV-07` — the `rating` cell is the §4.2 block, unchanged |
| **Validation** | Body `.strict()`; ids validated as UUIDs before any query; the resolved set re-checked for length after visibility filtering, because four submitted ids of which two are suspended is a legal two-gym comparison, not an error |
| **Side effects** | **None.** `comparison_added` (EVT-09) and `comparison_viewed` (EVT-10) are client events (§13.5) |
| **Future compatibility** | New rows are new keys under `rows`, and a client must render unknown row keys generically or skip them — never fail. The four-gym cap is `FR-DETL-08` and is **configuration**, so raising it is a config change plus a new `COMPARE_SET_TOO_LARGE` message value, not a schema change. `rows` will never become a map keyed by `gym_id`: positional alignment is what makes `AC-DETL-01.2` assertable |

---

## 10. Reference data and the SEO landing endpoints

**One header for all five.** `GET /cities`, `GET /cities/:slug`, `GET /categories`,
`GET /categories/:slug`, `GET /amenities` share every operational attribute, so it is stated once:

| Attribute | Value |
| :--- | :--- |
| **Auth mode** | `none` — `@Public()` · **Required permission** `—` |
| **Tenant scope** | **`public`**, and here it is *trivially* public: `cities`, `localities`, `amenities` and `gym_categories` are tenancy class **`GLOBAL`** with RLS **not enabled** (`Schema.md` §2.6 exemption list, `§C2.3` verbatim, grant class `G-REF`). `PublicPrismaService` reads them directly; no elevation is involved |
| **Idempotency** | `N/A` — safe methods |
| **Rate-limit class** | `RL-PUBLIC` — 120/min per IP, crawler allowlist exempt |
| **Cache policy** | `CDN-3600` — `public, max-age=600, s-maxage=3600, stale-while-revalidate=600`, plus `ETag`, `Last-Modified` and `Vary: Accept-Language`. **`stale-if-error` is permitted** on all five (§3.4): yesterday's amenity list beats an error page, and none of them carries a price except the landing aggregates, which are labelled `from` figures |
| **Pagination** | **None.** `README.md` §1.7.4 row 3 — reference data is returned whole. 120 cities, ~2,500 localities, ~40 amenities and ~12 categories (`Schema.md` §12.1, §12.2 volumes) |
| **Purge** | `taxonomy.written` purges **all** `CDN-3600` keys; `gym.approved`, `gym.suspended` and `plan.price_changed` purge the affected `cities:{slug}` and `categories:{slug}` (§3.2 part 2) |
| **Side effects** | None on any of the five: no rows, no ledger, no outbox, no notifications, no audit |
| **Errors** | `VALIDATION_FAILED` 400 · `UNKNOWN_QUERY_PARAMETER` 400 · `TENANT_HEADER_NOT_ACCEPTED` 400 · `CITY_NOT_FOUND` / `CATEGORY_NOT_FOUND` 404 (§10.2, §10.4) · `RATE_LIMIT_EXCEEDED` 429 · `INTERNAL_ERROR` 500 · `DEPENDENCY_UNAVAILABLE` 503 |

### 10.1 `GET /v1/cities` — the city directory

**Purpose** `FR-SRCH-13`'s index page and the city selector that `AC-SRCH-02` falls back to when
geolocation is denied. **Query:** `active_only` (boolean, default `true`), `country_code` (default
`IN`, and `IN` is the only accepted value at launch — `LAUNCH_MARKET_INDIA.md` §1).

```json
// illustrative — not committed code
{ "count": 4, "country_code": "IN",
  "items": [
    { "city_id": "01932a10-4d55-7000-8c10-7a3e1b5f6280", "name": "Mumbai", "slug": "mumbai",
      "state": "Maharashtra", "state_code": "MH", "is_launched": true,
      "listed_gym_count": 412, "locality_count": 74,
      "centroid": { "lat": 19.07600, "lng": 72.87770 },
      "canonical_url": "https://www.<domain>/gyms/mumbai" },
    { "city_id": "01932a10-6f77-7000-a132-9c5e3d7f8402", "name": "Bengaluru", "slug": "bengaluru",
      "state": "Karnataka", "state_code": "KA", "is_launched": true,
      "listed_gym_count": 337, "locality_count": 61,
      "centroid": { "lat": 12.97160, "lng": 77.59460 },
      "canonical_url": "https://www.<domain>/gyms/bengaluru" },
    { "city_id": "01932a10-7a88-7000-b243-ad6f4e809513", "name": "Pune", "slug": "pune",
      "state": "Maharashtra", "state_code": "MH", "is_launched": true,
      "listed_gym_count": 198, "locality_count": 43,
      "centroid": { "lat": 18.52040, "lng": 73.85670 },
      "canonical_url": "https://www.<domain>/gyms/pune" },
    { "city_id": "01932a10-8b99-7000-c354-be705f91a624", "name": "Hyderabad", "slug": "hyderabad",
      "state": "Telangana", "state_code": "TG", "is_launched": false,
      "listed_gym_count": 0, "locality_count": 38,
      "centroid": { "lat": 17.38500, "lng": 78.48670 },
      "canonical_url": "https://www.<domain>/gyms/hyderabad" } ] }
```

| Rule | Statement |
| :--- | :--- |
| CT1 | `listed_gym_count` counts gyms passing `PublicVisibilityPredicate`, maintained by the `search.reindex` projection job, **not** counted per request. A `COUNT(*)` over `gyms` per city on the hottest cached endpoint on the site is how a reference read becomes a database incident |
| CT2 | `is_launched` is the `rel.discovery.city-launch-gate` flag (`Epic_06`). An unlaunched city is returned **with a zero count** rather than hidden, because `FR-SRCH-12`'s *"nearest served city with an explicit explanation"* needs to name the city the visitor actually typed, and `A3` captures the miss as expansion demand |
| CT3 | Cities are ordered by `listed_gym_count DESC, name ASC`. Alphabetical order alone puts an empty city above Mumbai |

### 10.2 `GET /v1/cities/:slug` — the city landing page

**Purpose** `FR-SRCH-13` server-rendered indexable landing data, plus `FR-SRCH-12`'s facets.
**Path** `slug`. **Query:** `category_slug` (narrows every facet and the preview), `limit` (preview
size, default 12, max 24). **`404 CITY_NOT_FOUND`** on an unknown slug — a city is a global
reference row, so there is no visibility subtlety and no `409`.

```json
// illustrative — not committed code
{ "city": { "city_id": "01932a10-4d55-7000-8c10-7a3e1b5f6280", "name": "Mumbai", "slug": "mumbai",
            "state": "Maharashtra", "state_code": "MH", "is_launched": true,
            "centroid": { "lat": 19.07600, "lng": 72.87770 } },
  "listed_gym_count": 412,
  "currency": "INR",
  "price_band": { "lowest_monthly_equivalent_minor": "89900",
                  "median_monthly_equivalent_minor": "249900",
                  "highest_monthly_equivalent_minor": "1499900" },
  "facets": {
    "localities": [ { "locality_id": "01932a11-5e66-7000-9d21-8b4f2c6a7391",
                      "name": "Andheri West", "slug": "andheri-west", "gym_count": 38 },
                    { "locality_id": "01932a11-6f77-7000-ae32-9c5f3d7b8402",
                      "name": "Bandra West", "slug": "bandra-west", "gym_count": 29 },
                    { "locality_id": "01932a11-7088-7000-bf43-ad604e8c9513",
                      "name": "Powai", "slug": "powai", "gym_count": 21 } ],
    "categories":  [ { "key": "STRENGTH_TRAINING", "slug": "strength-training", "gym_count": 164 },
                     { "key": "CROSSFIT", "slug": "crossfit", "gym_count": 47 },
                     { "key": "YOGA_STUDIO", "slug": "yoga-studio", "gym_count": 58 } ],
    "amenities":   [ { "key": "AIR_CONDITIONING", "gym_count": 301 },
                     { "key": "TWO_WHEELER_PARKING", "gym_count": 268 },
                     { "key": "PERSONAL_TRAINING", "gym_count": 245 } ],
    "gender_policy": [ { "value": "MIXED", "gym_count": 372 },
                       { "value": "WOMEN_ONLY", "gym_count": 40 } ] },
  "preview": { "items": [ "…up to `limit` GymSummary objects, §4.5, ranked by FR-SRCH-10…" ],
               "search_url": "/v1/search/gyms?city_slug=mumbai" },
  "seo": {
    "canonical_url": "https://www.<domain>/gyms/mumbai",
    "meta_title": "Gyms in Mumbai — 412 verified gyms with member reviews and prices",
    "meta_description": "Compare 412 verified gyms across Andheri West, Bandra West, Powai and 71 other Mumbai localities. Memberships from ₹899 a month. Real reviews from checked-in members.",
    "robots": "index,follow",
    "structured_data": {
      "@context": "https://schema.org", "@type": "ItemList", "numberOfItems": 12,
      "itemListElement": [ "…one ListItem per preview gym, position 1…12…" ] },
    "breadcrumb": { "@context": "https://schema.org", "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Gyms", "item": "https://www.<domain>/gyms" },
        { "@type": "ListItem", "position": 2, "name": "Mumbai", "item": "https://www.<domain>/gyms/mumbai" } ] } } }
```

| Rule | Statement |
| :--- | :--- |
| CL1 | Facet counts are **projection counts**, recomputed by `search.reindex` and cached with the page. They may lag a purge by one job cycle; a facet that says 38 and returns 37 is acceptable, and `FR-SRCH-12` never promises the count is transactional |
| CL2 | `price_band` figures are **`from` prices**, not quotations: they carry **no `price_fingerprint`** and **no `plan_id`**, so nothing on this page can be clicked through to a checkout that would need re-pricing. This is how `BR-PLN-03` stays true on a page cached for an hour (§3.2 part 3 applied to aggregates) |
| CL3 | An **unlaunched** city returns `200` with `listed_gym_count: 0`, no `price_band`, an empty `preview.items`, and `robots: "noindex,follow"`. A zero-listing page that search engines index is a thin-content penalty, and `FR-SRCH-13` wants the *good* pages indexed |
| CL4 | Localities are ordered by `gym_count DESC` and truncated to the top 24; the full list is a locality endpoint the platform does not need in Phase 1 (`O-MKT-5`) |

### 10.3 `GET /v1/categories` — the category directory

**Purpose** the `FR-SRCH-13` category index. **Query:** `active_only` (boolean, default `true`),
`city_slug` (scopes `listed_gym_count` to one city).

```json
// illustrative — not committed code
{ "count": 3, "items": [
  { "category_id": "01930002-0001-7000-8000-000000000001", "key": "STRENGTH_TRAINING",
    "name": "Strength Training", "slug": "strength-training", "icon": "dumbbell",
    "description": "Free weights, racks and platforms with floor coaching.",
    "sort_order": 1, "listed_gym_count": 1180,
    "canonical_url": "https://www.<domain>/gyms/category/strength-training" },
  { "category_id": "01930002-0001-7000-8000-000000000002", "key": "CROSSFIT",
    "name": "CrossFit & Functional", "slug": "crossfit", "icon": "kettlebell",
    "description": "Class-based functional training in timed formats.",
    "sort_order": 2, "listed_gym_count": 262,
    "canonical_url": "https://www.<domain>/gyms/category/crossfit" },
  { "category_id": "01930002-0001-7000-8000-000000000003", "key": "YOGA_STUDIO",
    "name": "Yoga Studio", "slug": "yoga-studio", "icon": "lotus",
    "description": "Mat-based practice, guided classes and breathwork.",
    "sort_order": 3, "listed_gym_count": 341,
    "canonical_url": "https://www.<domain>/gyms/category/yoga-studio" } ] }
```

`key` is the stable identifier and `slug` is the URL token; they are separate because `NFR-DQ-06`
makes the key **never re-pointed** while a slug may be re-spelled for SEO. A client filters on `key`
and links on `slug`, and `gyms.category_id` is an FK with no snapshot, so a reclassification applies
retroactively and correctly (`Schema.md` §5.1, `ERD.md` §9.8).

### 10.4 `GET /v1/categories/:slug` — the category landing page

Same shape as §10.2 with the axes transposed: `category` replaces `city`, `facets.cities` replaces
`facets.localities`, and the `ItemList` is the top gyms **nationally** unless `city_slug` is
supplied, in which case the canonical URL becomes `/gyms/{city}/category/{category}` and the
breadcrumb gains a third `ListItem`. **`404 CATEGORY_NOT_FOUND`** on an unknown slug. `robots` is
`noindex,follow` when `listed_gym_count` is zero, by CL3. Cross-facet URLs beyond city × category —
category × amenity, city × price band — are **not** minted in Phase 1: every one is an indexable
page that must earn its content, and an unbounded facet grid is the classic thin-content SEO
failure. Recorded as **`O-MKT-6`**.

### 10.5 `GET /v1/amenities` — the amenity taxonomy

**Purpose** the filter chips of `FR-SRCH-03`, the amenity rows of §9, and the gym-side picker of
`FR-GYM-03`. **Query:** `active_only` (boolean, default `true`), `display_group` (filter).

```json
// illustrative — not committed code
{ "count": 3, "groups": ["EQUIPMENT", "FACILITIES", "SERVICES"],
  "items": [
    { "amenity_id": "01930001-0001-7000-8000-000000000101", "key": "FREE_WEIGHTS",
      "name": "Free weights", "icon": "dumbbell", "display_group": "EQUIPMENT",
      "sort_order": 1, "is_active": true, "is_filterable": true },
    { "amenity_id": "01930001-0001-7000-8000-000000000204", "key": "TWO_WHEELER_PARKING",
      "name": "Two-wheeler parking", "icon": "scooter", "display_group": "FACILITIES",
      "sort_order": 24, "is_active": true, "is_filterable": true },
    { "amenity_id": "01930001-0001-7000-8000-000000000302", "key": "DIET_CONSULTATION",
      "name": "Diet consultation", "icon": "nutrition", "display_group": "SERVICES",
      "sort_order": 42, "is_active": false, "is_filterable": false } ] }
```

| Rule | Statement |
| :--- | :--- |
| AM1 | **Retired, never deleted** (`Schema.md` §12.2). A retired amenity returns with `is_active: false` when `active_only=false`, because a gym approved two years ago may still carry it and a comparison row must be able to name it |
| AM2 | **There is no free-text amenity, anywhere.** A gym submitting one gets `400 AMENITY_NOT_IN_TAXONOMY` on the write side (`README.md` §9.5.4). `NFR-DQ-06`: *"filtering depends on the value, so free text is not offered"* |
| AM3 | `TWO_WHEELER_PARKING` is not a translation artefact — two-wheeler parking is a top-three decision factor for an Indian gym member and is a first-class amenity, as are `DRINKING_WATER_RO` and `POWER_BACKUP` (`LAUNCH_MARKET_INDIA.md` §3, `§C2.3`) |

---

## 11. `API-FAV` — favourites and saved searches

**One header for all six.** These are the only authenticated endpoints in this document.

| Attribute | Value |
| :--- | :--- |
| **Auth mode** | `access` — a 15-minute access token (`Authentication.md` §4). No `@Public()` |
| **Surfaces** | `web` (`SCR-WEB-003`, `SCR-WEB-004`, the account area) · not `dash` · not `admin` |
| **Tenant scope** | **`user`** — decision-table row 2, *"the principal, not a tenant"*. The three different mechanics are §2.4, and they are genuinely different: `favourites` is RLS `P-STD`, `saved_searches` is `IDENTITY` |
| **Cache policy** | **`NO-STORE!`** (§1.3) — `private, no-store` **plus `Vary: Authorization`** on all six, including the two `GET`s. No `ETag`, no conditional request, no edge |
| **Rate-limit class** | `RL-READ` on the two reads (300/min per user); `RL-WRITE` on the four mutations (60/min per user, 300/hour per IP) |
| **Idempotency** | `OPT` on all four mutations (`API_Catalog.md` §3.4). A supplied `Idempotency-Key` is honoured under `§1.6`: replay returns the **stored response** with `Idempotency-Replayed: true`; a fingerprint mismatch is `409 IDEMPOTENCY_KEY_MISMATCH`. `REQ` was rejected — a favourite moves no money, and forcing a key on a heart icon guarantees clients that generate one badly |
| **Common errors** | `UNAUTHENTICATED` 401 · `PERMISSION_DENIED` 403 · `TENANT_HEADER_NOT_ACCEPTED` 400 · `VALIDATION_FAILED` 400 · `RATE_LIMIT_EXCEEDED` 429 · `INTERNAL_ERROR` 500 · `DEPENDENCY_UNAVAILABLE` 503 |

**Why favourite state is not on the public read, restated as a consequence.** §5.2 note 4 removed
`is_favourited` from every public payload to keep the edge object shared. The cost lands here: a
signed-in visitor's detail page issues **two** requests — the cached public one and `GET
/me/favourites` — and the client joins them on `gym_id`. That is one extra round trip on an
authenticated session, against a shared cache entry for every anonymous visitor on the site.
`NFR-SCAL-04` makes that trade obvious in one direction only.

### 11.1 `GET /v1/me/favourites`

| Attribute | Value |
| :--- | :--- |
| **Purpose** | `FR-FAV-01` + `FR-FAV-02`: the member's shortlist **with the current price and any change since favouriting**, and with unavailable gyms shown as unavailable |
| **Required permission** | **`discovery.favourite.list`** (`B3.2`, `FR-RBAC-01`) |
| **Tenant scope** | `user`, **crossing tenants** — `Schema.md` §4.12: *"the member's own list crosses tenants and is therefore served by a `user_id`-scoped endpoint running under platform read, not by a tenant session"*. Reads under `app_platform_ro`, `WHERE user_id = sub`, then re-composes `PublicVisibilityPredicate` **per row** so a suspended gym can be labelled rather than dropped |
| **Pagination** | Cursor, `limit` default 25, max 100; `sort` = `favourited_at:desc` (default) \| `price_change:desc` |

```json
// illustrative — not committed code
// HTTP/1.1 200 OK   Cache-Control: private, no-store   Vary: Authorization
{ "count": 3, "currency": "INR",
  "items": [
    { "gym_id": "01932c7e-3f81-7a04-b2e6-9c11d4a8e770", "slug": "iron-works-andheri-west",
      "name": "Iron Works Fitness Studio", "city_name": "Mumbai", "city_slug": "mumbai",
      "locality_name": "Andheri West", "is_verified": true,
      "cover_url": "https://media.<domain>/gyms/01932c7e/cover-640.webp",
      "rating": { "review_count": 47, "rating_avg": 4.6, "display_state": "RATED",
                  "minimum_reviews_for_rating": 3 },
      "availability": { "state": "AVAILABLE" },
      "favourited_at": "2026-07-14T15:22:00Z",
      "price": { "lowest_monthly_equivalent_minor": "199900",
                 "lowest_plan_id": "01932c81-6f00-7000-b3a4-7d0e5b4c8326",
                 "price_fingerprint": "pf_1_9c11d4a8e770_2398800_01932d0177aa_1754380800",
                 "priced_at": "2026-08-05T09:30:00Z",
                 "change": { "direction": "DECREASED",
                             "previous_monthly_equivalent_minor": "249900",
                             "current_monthly_equivalent_minor": "199900",
                             "delta_minor": "-50000",
                             "observed_at": "2026-08-01T04:00:00Z" } },
      "canonical_url": "https://www.<domain>/gyms/mumbai/iron-works-andheri-west" },

    { "gym_id": "01932c92-7e10-7000-9a55-1d3f6b2c8409", "slug": "pulse-fitness-koramangala",
      "name": "Pulse Fitness", "city_name": "Bengaluru", "city_slug": "bengaluru",
      "locality_name": "Koramangala", "is_verified": true,
      "cover_url": "https://media.<domain>/gyms/01932c92/cover-640.webp",
      "rating": { "review_count": 18, "rating_avg": 4.2, "display_state": "RATED",
                  "minimum_reviews_for_rating": 3 },
      "availability": { "state": "UNAVAILABLE", "listing_state": "TEMPORARILY_CLOSED",
                        "notice_key": "favourites.gym_unavailable",
                        "expected_reopen_on": "2026-09-01" },
      "favourited_at": "2026-06-02T09:10:00Z",
      "canonical_url": "https://www.<domain>/gyms/bengaluru/pulse-fitness-koramangala" },

    { "gym_id": "01932c8a-5e11-7000-9f42-3b7d1c5e9048", "slug": "the-lift-room-versova",
      "name": "The Lift Room", "city_name": "Mumbai", "city_slug": "mumbai",
      "locality_name": "Versova", "is_verified": true,
      "cover_url": "https://media.<domain>/gyms/01932c8a/cover-640.webp",
      "rating": { "review_count": 22, "rating_avg": 4.4, "display_state": "RATED",
                  "minimum_reviews_for_rating": 3 },
      "availability": { "state": "AVAILABLE" },
      "favourited_at": "2026-05-19T18:44:00Z",
      "price": { "lowest_monthly_equivalent_minor": "216600",
                 "lowest_plan_id": "01932c8b-4f33-7000-9046-718253ae448c",
                 "price_fingerprint": "pf_1_718253ae448c_2599200_none_1753948800",
                 "priced_at": "2026-08-05T09:30:00Z",
                 "change": { "direction": "INCREASED",
                             "previous_monthly_equivalent_minor": "199900",
                             "current_monthly_equivalent_minor": "216600",
                             "delta_minor": "16700",
                             "observed_at": "2026-07-20T04:00:00Z" } },
      "canonical_url": "https://www.<domain>/gyms/mumbai/the-lift-room-versova" }
  ],
  "next_cursor": null, "limit": 25 }
```

| `AC` | How it is discharged |
| :--- | :--- |
| **`AC-FAV-01.2`** — *"the change is indicated with the old and new value"* | `price.change` carries **both** figures, the signed `delta_minor`, a `direction` of `INCREASED` \| `DECREASED`, and `observed_at`. The object is **omitted entirely** when nothing has changed — R8, and an omitted `change` is unambiguous where a `direction: "NONE"` invites a client to render "0% change" |
| **`AC-FAV-01.3`** — *"shown as unavailable rather than silently removed"* | `availability.state = UNAVAILABLE` with the §5.6 `listing_state`, and the row keeps its position in the list. The `favourites` row is **never deleted by the platform** — only the member deletes a favourite. A gym that becomes visible again reverts to `AVAILABLE` with no member action |
| **Price on an unavailable row** | **Omitted.** A gym that cannot be bought has no offer; emitting a fingerprint for it would create a quotation with nothing to honour it (LS1) |

**Where the `previous` figure comes from.** It is **not** stored on `favourites` — that table holds
exactly three columns (`Schema.md` §4.12). It is the last value observed by the `favourites.price-watch`
job (`§C5`, nightly), which reads the projection and writes a small per-`(user_id, gym_id)` observation
into Redis with a 90-day TTL, keyed off the `plan.price_changed` outbox event for immediacy. This is
also `FR-FAV-04`'s trigger: the same observation that renders the badge queues the optional
notification. If the observation is missing — a favourite added after the last run — `change` is
omitted, which is correct: nothing has been *observed* to change.

### 11.2 `POST /v1/me/favourites/:gymId` — favourite a gym

| Attribute | Value |
| :--- | :--- |
| **Purpose** | `FR-FAV-01`, and the landing point of `FR-FAV-03`'s deferred intent |
| **Path** | `gymId` — UUIDv7. **Resolution `MKT-R1` (§1.2): no request body at all.** A body of any kind is `400 UNKNOWN_FIELD` |
| **Required permission** | **`discovery.favourite.create`** |
| **Tenant scope** | `user` for authorisation, **`resource` for the write** — the gym resolves to exactly one `tenant_id`, which becomes the context for `SET LOCAL app.tenant_id` inside the write transaction (§2.4). The client never names it, and cannot |
| **Rate limit / idempotency** | `RL-WRITE` · `OPT` |

| Status | When | Body |
| :-: | :--- | :--- |
| **`201 Created`** | The favourite did not exist | `{ "gym_id": …, "favourited_at": …, "created": true }` |
| **`200 OK`** | It already existed — the same member favouriting twice | The same body with `"created": false`. **Not a `409`.** `uq_favourites__user_gym` makes the second insert a conflict at the database; the use case converts it to the idempotent success it obviously is |

| Code | HTTP | When |
| :--- | :-: | :--- |
| `GYM_NOT_FOUND` | 404 | Unknown id, soft-deleted, **or** a gym failing `PublicVisibilityPredicate`. A suspended gym cannot be newly favourited, and the `404` does not reveal which of the three it was (`§1.5` TD5) |
| `FAVOURITE_LIMIT_REACHED` | 422 | More than **200** favourites. A shortlist is not a crawl; the limit is configuration and the message states the number |
| `IDEMPOTENCY_KEY_MISMATCH` | 409 | Same key, different `:gymId` — which is precisely the bug `MKT-R1` makes detectable, because the path is part of the fingerprint (`API_Catalog.md` §1.6.3 component 2) |

**`AC-FAV-01.1` — favourite while signed out, then log in.** *"the gym is in my favourites and I am
returned to where I was."* No endpoint implements this; the mechanism is `FR-NAV-02` deferred intent
held client-side across the auth gate, and the API sees one ordinary `POST` afterwards. The contract
obligation it creates is **replay safety**: the intent can fire twice — two tabs, or a retry after a
token refresh — and the `200`/`201` split above is what makes the second one harmless without an
idempotency key. `E2E-10` covers the full path.

**Side effects.**

| Effect | Detail |
| :--- | :--- |
| Rows | One `favourites` row (`tenant_id`, `user_id`, `gym_id`), `G-CRUD-D` |
| Rows | One `attribution_events` row, `surface = MARKETPLACE`, `expires_at = now + attribution_window` — `A6.3` makes favouriting a **qualifying discovery surface**, and `idx_attribution_events__user_gym_expires` is what decides `orders.origin` and therefore commission at checkout. **This is the commercially consequential side effect on this surface**, and it is why a favourite is a tenant-owned row rather than a purely personal one |
| Outbox | `favourite.added` — consumed by `favourites.price-watch` to start observing (§11.1) and by analytics |
| Notifications | None at the moment of favouriting. `FR-FAV-04`'s promotion and price alerts are `PROMOTIONAL` category and respect `notification_preferences` and quiet hours (`FR-NOTF-05`) |
| Audit | None. `audit_log` is for administrative and financial mutations (`SD8`); the attribution row is the durable record |
| Cache | Nothing to purge — the response is `no-store` and no public object contains favourite state (ET6) |

### 11.3 `DELETE /v1/me/favourites/:gymId` — unfavourite

**Permission `discovery.favourite.delete`** · `RL-WRITE` · `OPT` · tenant from the resource.
**`204 No Content`** on success **and** when no favourite existed — a toggle that returns `404` for
"already off" forces every client to track state it does not have. The `uq_favourites__user_gym`
unique key makes the operation naturally idempotent, and `G-CRUD-D` makes it a **real delete**:
`Schema.md` §2.7 lists `favourites` among the five tables where a hard delete destroys no history.

| Side effect | Detail |
| :--- | :--- |
| Rows | The `favourites` row is deleted |
| Rows **not** touched | The `attribution_events` row **survives**. An attribution already earned is a commercial fact with a `A6.3` expiry window, and letting a member erase it by toggling a heart would make the origin classification manipulable by the buyer. `TECH_DEBT.md` `A6.3` records the same reasoning from the commission side |
| Outbox | `favourite.removed` — stops the price watch |
| Errors | `GYM_NOT_FOUND` **is not raised** for a gym that exists but was never favourited (that is the `204`); it is raised only when `:gymId` resolves to no gym at all |

### 11.4 `GET /v1/me/saved-searches`

**Permission `discovery.saved_search.list`** · `RL-READ` · `NO-STORE!` · **no tenant context ever** —
`saved_searches` is tenancy class `IDENTITY` with no `tenant_id` column; scoping is `user_id = sub`
plus the ownership guard `AZ8` (§2.4). Unpaginated: the cap of §11.5 is 20.

```json
// illustrative — not committed code
{ "count": 2, "limit_per_user": 20, "items": [
  { "saved_search_id": "01932e01-1a11-7000-8c12-3d5e7f901234",
    "name": "Andheri strength gyms under ₹2,500",
    "query": { "city_slug": "mumbai", "locality_slugs": ["andheri-west", "versova"],
               "category_keys": ["STRENGTH_TRAINING"],
               "amenity_keys": ["SQUAT_RACK", "AIR_CONDITIONING"],
               "max_monthly_equivalent_minor": "250000",
               "gender_policy": "MIXED", "open_now": false, "sort": "relevance" },
    "query_schema_version": 1,
    "alert_cadence": "WEEKLY",
    "result_count_at_save": 14,
    "new_match_count": 3,
    "last_alert_sent_at": "2026-08-03T02:30:00Z",
    "search_url": "/v1/search/gyms?city_slug=mumbai&locality_slug=andheri-west&locality_slug=versova&category_key=STRENGTH_TRAINING&amenity_key=SQUAT_RACK&amenity_key=AIR_CONDITIONING&max_price_minor=250000",
    "created_at": "2026-07-11T06:02:00Z" },
  { "saved_search_id": "01932e01-2b22-7000-9d23-4e6f80a12345",
    "name": "Women-only, Powai",
    "query": { "city_slug": "mumbai", "locality_slugs": ["powai"],
               "gender_policy": "WOMEN_ONLY", "sort": "distance" },
    "query_schema_version": 1, "alert_cadence": "NONE",
    "result_count_at_save": 4, "new_match_count": 0,
    "search_url": "/v1/search/gyms?city_slug=mumbai&locality_slug=powai&gender_policy=WOMEN_ONLY&sort=distance",
    "created_at": "2026-06-28T13:40:00Z" } ] }
```

`new_match_count` is maintained by the `search.saved-search-alerts` job (`§C5`, daily) and is the
count of gyms matching the stored `query` that became visible **after** `created_at` or the last
alert — `FR-SRCH-14`. It is a count, never a preview: rendering the matches would require running
every stored query on a `NO-STORE` read path, and the job already ran them.

### 11.5 `POST /v1/me/saved-searches`

**Permission `discovery.saved_search.create`** · `RL-WRITE` · `OPT` · `201 Created` returning the
object of §11.4.

```ts
// illustrative — not committed code
export const CreateSavedSearchBody = z.object({
  name: z.string().trim().min(1).max(80),
  query: SearchCriteriaSchema,        // owned by Search.md; imported, never re-declared here
  alert_cadence: z.enum(['NONE', 'DAILY', 'WEEKLY']).default('NONE'),
}).strict();                          // no user_id, no tenant_id, no counts — the server owns all three
```

| Rule | Statement |
| :--- | :--- |
| SS1 | **`query` is validated against the live search schema**, not stored as opaque JSON. `Schema.md` §5.5 applies snapshot rules `S1`–`S7`, of which `S1` is the schema version: the stored object carries `query_schema_version`, and a job that meets an older version migrates it forward rather than silently mismatching |
| SS2 | An **unknown filter key is rejected**, not stripped. A saved search that quietly drops `gender_policy: WOMEN_ONLY` alerts a member about gyms she deliberately excluded |
| SS3 | `max_monthly_equivalent_minor` is a **filter bound**, not a price the client is quoting, so it does not breach M3: it constrains a search, and no order can be created from it |
| SS4 | **20 saved searches per user**, configuration; the 21st is `422 SAVED_SEARCH_LIMIT_REACHED` stating the number and naming deletion as the remedy |
| SS5 | Duplicate `name` for one user is **allowed**. Names are labels, not keys; a unique constraint on a human label produces a `409` that no member can act on sensibly |
| SS6 | `alert_cadence` other than `NONE` requires a verified contact channel; without one the search is created with `NONE` and the response carries `alert_downgraded: true` rather than failing the create. `FR-NOTF-02` makes only the **transactional** category non-optional, and a saved-search alert is `PROMOTIONAL` |

| Code | HTTP | When |
| :--- | :-: | :--- |
| `VALIDATION_FAILED` | 400 | Empty or over-long `name`, malformed `query`, unknown `alert_cadence` |
| `SAVED_SEARCH_QUERY_INVALID` | 422 | `query` parses but is not a satisfiable search — an unknown `city_slug`, a retired `amenity_key`, a `max` below the platform minimum. `details[]` names the offending key |
| `SAVED_SEARCH_LIMIT_REACHED` | 422 | The 21st search |

**Side effects:** one `saved_searches` row (`IDENTITY`, `G-CRUD-D`); one `saved_search.created`
outbox event that enrols the row in the alert job; **no** `attribution_events` row — a saved search
is not a discovery surface for any single gym, so `A6.3` has nothing to attribute; no audit row.

### 11.6 `DELETE /v1/me/saved-searches/:id`

**Permission `discovery.saved_search.delete`** · `RL-WRITE` · `OPT` · **`204 No Content`**. A hard
delete (`G-CRUD-D`).

| Rule | Statement |
| :--- | :--- |
| SD1 | The ownership guard `AZ8` runs **before** the delete: `saved_searches` has no RLS, so nothing below the application layer prevents one user deleting another's row. This is the single most important line in §11 — `Security.md` §4.4's *"protected by authorisation, not by RLS"* is a statement of obligation, not of comfort |
| SD2 | Another user's id returns **`404 SAVED_SEARCH_NOT_FOUND`**, never `403`. Same reasoning as `API_Catalog.md` §2.3: `403` confirms the row exists |
| SD3 | An unknown id also returns `404`, so the two cases are indistinguishable — an enumeration attempt learns nothing |
| SD4 | The outbox event `saved_search.deleted` removes it from the alert job. A member who deletes a saved search and keeps receiving its alerts has been told the platform ignores them |

---

## 12. Business rules — the database's share and this layer's share

`Constraints.md` §13 grades what the schema can enforce. Everything it grades `NONE` or `PARTIAL` is
an application obligation, and an obligation with no named owner is an obligation nobody has.

| Rule | DB grade | What the DB does | What **this document's endpoints** must do | Test ids |
| :--- | :--- | :--- | :--- | :--- |
| `BR-GYM-01` visibility | **PARTIAL** | Projection holds only `APPROVED`; partial index on `(status, rating_avg, freshness_score) WHERE status='APPROVED'` | Compose `PublicVisibilityPredicate` (§2.3) on **every** non-projection read: §5, §6, §7, §8, §9, §10.2, §10.4, §11.1 | `BR-GYM-01-P1/N1`, `E2E-01` |
| `BR-TEN-05` suspended tenant | **PARTIAL** | Projection excludes suspended tenants | §5.6 `listing_state`, §9's `unavailable[]`, §11.1's `availability` — **labelled, never dropped** | `BR-TEN-05-P1` |
| `BR-TEN-06` `PAST_DUE` > 7 days | **NONE** | Enum only | Same predicate, same three surfaces | `BR-TEN-06-P1` |
| `BR-PLN-05` staff-only invisible | **PARTIAL** | `idx_plans__gym_status_visibility` | §6.4's four stops; enforcement point is the single `L6-UC` repository method | `BR-PLN-05-P1/N1` |
| `BR-PLN-03` displayed = charged | **NONE** | No constraint can relate a rendered figure to a later charge | Emit `price_fingerprint` + `priced_at` on every plan object (§3.2 part 3); emit **no** fingerprint on aggregate `from` prices (CL2); forbid `stale-if-error` on the price surfaces (§3.4) | `BR-PLN-03-P1/N1`, `E2E-02`, `E2E-06` |
| `BR-REV-03` verified only | **STRUCTURAL** | `reviews.membership_id NOT NULL`; no verification column may be added | Emit `is_verified_member: true` on every review object on every surface; assert absence of any other shape | `BR-REV-03-P1/N1` |
| `BR-REV-07` no rating below 3 | **PARTIAL** | `rating_count NOT NULL DEFAULT 0` so the test is a comparison, never a null test | Omit `rating_avg` **and** `distribution` **and** the JSON-LD `aggregateRating` together (§4.2, SD-A) | `BR-REV-07-P1/N1` |
| `BR-REV-05` one gym response | **STRUCTURAL** | `uq_review_responses__review_id` | Serialise `response` as an object, never an array (§7.2) | `BR-REV-05-N1` |
| `BR-TEN-01` isolation | **STRUCTURAL** | RLS on 62 tables, `FORCE ROW LEVEL SECURITY`, `WITH CHECK` | Appear in the isolation suite's **`@Public()` inventory** with the assertion of no `SET LOCAL` and no `P-STD` read outside the §2.2 elevation; `AZ8` ownership guard on `saved_searches` (SD1) | `BAC-10`, `E2E-11` |
| `NFR-DQ-06` reference integrity | **STRUCTURAL** | FKs to `amenities`, `gym_categories`, `cities` | Emit `key` **and** `slug` separately (§10.3); never emit or accept free-text amenities (AM2) | `NFR-DQ-06-P1` |
| `BR-PLN-01` branch availability | **PARTIAL** | `plan_branches` rows | Resolve `available_at_branch_ids` (§4.3) and validate `?branch_id` against **this** gym (§6.1) | `BR-PLN-01-N1` |
| `BR-DAT-06` data minimisation | **NONE** | — | Clamp `lat`/`lng` to 5 dp and never log them (§5.1); never emit a reviewer's full name, phone, email or `user_id` (§7.2); bands not dates (§7.3) | `SEC-A01-006` |

---

## 13. The cross-cutting contract

### 13.1 Rate-limit class per endpoint, and the crawler exemption

| Endpoints | Class | Keys | Why this class |
| :--- | :--- | :--- | :--- |
| §5, §6, §7, §8, §10.1–§10.5 | **`RL-PUBLIC`** | 120/min per IP, burst 30 | `CON-02`. A detail page is one request plus assets; 120/min is generous for a human and cheap to enforce before the auth guard (RLM4) |
| §9 `POST /compare` | **`RL-SEARCH`** | 600/min per IP, burst 30 | `API_Catalog.md` §3.3. A comparison is edited repeatedly and is one indexed read |
| §11.1, §11.4 | **`RL-READ`** | 300/min per user, 1,200/hour per IP, burst 60 | A-08 polling headroom |
| §11.2, §11.3, §11.5, §11.6 | **`RL-WRITE`** | 60/min per user, 300/hour per IP, burst 15 | `NFR-SEC-06` |

| Rule | Statement |
| :--- | :--- |
| RL-M1 | A **`304`** consumes a token (ET3). A conditional `GET` is still a request, and exempting it would create a free scraping channel behind `If-None-Match` |
| RL-M2 | The **verified-crawler allowlist** exempts Googlebot, Bingbot and the platform's own sitemap fetcher from `RL-PUBLIC`, verified by **forward-confirmed reverse DNS**, never by `User-Agent` alone (`Security.md`). `FR-SRCH-13` is worthless if the crawler is throttled off the site |
| RL-M3 | An edge hit **never reaches** the limiter. The 120/min ceiling therefore applies to cache misses and to `no-store` reads, which is the traffic that costs anything |
| RL-M4 | `429` carries `Retry-After` in seconds plus the three `X-RateLimit-*` headers describing **the bucket that emptied** (`README.md` §10.2) |

### 13.2 Permissions — `FR-RBAC-01`

Every endpoint declares a permission from the `B3.2` matrix **or** carries `@Public()`, and CI gate
`PG-4`/`PG-5` fails a handler that declares neither, both, or an unregistered string.

| Endpoint | Declaration | Roles holding it (`B3.2`) |
| :--- | :--- | :--- |
| §5–§10 (ten public reads) | **`@Public()`**, no permission string. Present in the §5.4 allowlist as rows 1–12 with the compensating controls named | — |
| `GET /me/favourites` | `discovery.favourite.list` | `MEMBER`, and any authenticated principal acting as itself |
| `POST /me/favourites/:gymId` | `discovery.favourite.create` | `MEMBER` |
| `DELETE /me/favourites/:gymId` | `discovery.favourite.delete` | `MEMBER` |
| `GET /me/saved-searches` | `discovery.saved_search.list` | `MEMBER` |
| `POST /me/saved-searches` | `discovery.saved_search.create` | `MEMBER` |
| `DELETE /me/saved-searches/:id` | `discovery.saved_search.delete` | `MEMBER` |

**The `/me` permissions are self-scoped, and that is not the same as unguarded.** Holding
`discovery.favourite.delete` authorises deleting **your own** favourite; the row is selected by
`user_id = sub` in the query and never from a client-supplied identifier. `FR-RBAC-03` — a
permission check that passes on the wrong row is an authorisation bug the permission cannot catch —
is why SD1 exists.

### 13.3 SEO payload — `FR-SRCH-13`, `FR-DETL-10`, `FR-NAV-05`

| Surface | Canonical URL | `robots` | Structured data | Link preview |
| :--- | :--- | :--- | :--- | :--- |
| Gym detail (§5) | `/gyms/{city_slug}/{gym_slug}` | `index,follow` | `HealthAndBeautyBusiness` + `ExerciseGym`, `PostalAddress`, `GeoCoordinates`, `openingHoursSpecification`, `aggregateRating` (conditional, SD-A), `makesOffer` | `og:title/description/image` 1200×630, `og:type business.business`, `twitter:card summary_large_image` |
| Gym detail, not live (§5.6) | Unchanged | **`noindex,follow`** + `X-Robots-Tag` | **None** — a closed gym must not carry an `Offer` | Title and description only |
| City landing (§10.2) | `/gyms/{city_slug}` | `index,follow`; `noindex,follow` when the count is zero (CL3) | `ItemList` + `BreadcrumbList` | City cover, count and `from` price |
| Category landing (§10.4) | `/gyms/category/{slug}` or `/gyms/{city}/category/{slug}` | as above | `ItemList` + `BreadcrumbList` (3 items when scoped to a city) | as above |
| Reviews, plans, similar, compare | — | Not indexable surfaces; they are data endpoints behind the pages above | — | — |

| Rule | Statement |
| :--- | :--- |
| SEO1 | **`FR-NAV-05`: the canonical URL is stable forever.** A slug is never re-pointed; `GYM_SLUG_TAKEN` exists on the write side to keep it that way, and a rename mints a **new** slug with a 301 from the old one served by the web tier, never by this API |
| SEO2 | The canonical always carries the city (`/gyms/mumbai/iron-works-andheri-west`), which is what makes §5.5's ambiguity a hand-typed-URL case rather than a live-traffic case |
| SEO3 | **The API emits the SEO block; the web app renders it.** `FR-DETL-10` is therefore verified in the contract suite (`OA4`) rather than by scraping a rendered page, and one gym's structured data cannot drift from another's |
| SEO4 | `hreflang` carries `en-IN` only at launch; `NFR-USE-08` Hindi copy adds `hi-IN` as an additional entry, never a replacement |
| SEO5 | The sitemap is generated from the same `PublicVisibilityPredicate` and is purged by `gym.approved` **within 60 s** (`FR-ONB-13`, §3.2). A gym approved at 10:00 is crawlable at 10:01 |
| SEO6 | JSON-LD prices are major-unit decimal strings (SD-C) — **the only** major-unit amounts the platform emits, produced by the one formatter and never re-derived |

### 13.4 The complete error-code table for this document

Registry rules: `API_Catalog.md` §6.1 (flat `SCREAMING_SNAKE_CASE`, globally unique, never renamed,
never reused) and §6.2 (**No** / **Fix** / **Wait**). A code emitted here and absent from
`packages/types/src/errors/registry.ts` **fails CI gate `PG-5`**.

**Owned by `discovery` / `catalog` and emitted by these endpoints:**

| Code | HTTP | Emitted by | When | Retry |
| :--- | :-: | :--- | :--- | :-- |
| `GYM_NOT_FOUND` | 404 | §5, §6, §7, §8, §9, §11.2, §11.3 | Unknown slug or id, never-approved gym, soft-deleted gym, or a `:gymId` failing the visibility predicate on §11.2 | No |
| `SLUG_AMBIGUOUS` | 409 | §5, §6, §7, §8 | The slug exists in more than one city and no `city_slug` was given; `details[]` enumerates the candidates | Fix |
| `BRANCH_NOT_FOUND` | 404 | §6 | `?branch_id` unknown, inactive, or belonging to another gym | Fix |
| `COMPARE_SET_TOO_LARGE` | 422 | §9 | More than four gyms; `details[]` echoes every submitted id (`README.md` §9.5.4) | Fix |
| `CITY_NOT_FOUND` | 404 | §10.2 | Unknown city slug | No |
| `CATEGORY_NOT_FOUND` | 404 | §10.4 | Unknown category slug | No |
| `FAVOURITE_LIMIT_REACHED` | 422 | §11.2 | Above 200 favourites; the message states the number | Fix |
| `SAVED_SEARCH_NOT_FOUND` | 404 | §11.6 | Unknown id **or** another user's id — indistinguishable by design (SD2, SD3) | No |
| `SAVED_SEARCH_LIMIT_REACHED` | 422 | §11.5 | The 21st saved search | Fix |
| `SAVED_SEARCH_QUERY_INVALID` | 422 | §11.5 | `query` parses but is unsatisfiable; `details[]` names the key | Fix |

**Emitted here, owned elsewhere:** `VALIDATION_FAILED` 400 · `UNKNOWN_QUERY_PARAMETER` 400 ·
`UNKNOWN_FIELD` 400 · `TENANT_HEADER_NOT_ACCEPTED` 400 · `CURSOR_INVALID` 400 ·
`SORT_FIELD_NOT_ALLOWED` 400 · `LIMIT_EXCEEDS_MAXIMUM` 400 · `UNAUTHENTICATED` 401 ·
`PERMISSION_DENIED` 403 · `IDEMPOTENCY_KEY_MISMATCH` 409 · `IDEMPOTENT_REQUEST_IN_PROGRESS` 409 ·
`RATE_LIMIT_EXCEEDED` 429 · `INTERNAL_ERROR` 500 · `DEPENDENCY_UNAVAILABLE` 503 — all `common` or
`iam`.

**Status codes used:** 200 · 201 · 204 · 304 · 400 · 401 · 403 · 404 · 409 · 422 · 429 · 500 · 503.

| Never used here | Why |
| :--- | :--- |
| **`403` on the public ten** | A not-visible gym is a `404`. `403` confirms existence, and `BR-TEN-01` does not tolerate the leak (§5.3) |
| **`410 Gone`** | Considered for a permanently closed gym and rejected: `FR-DETL-11` needs a rendered page with alternatives, and `noindex` does the de-indexing (LS6) |
| **`202 Accepted`** | Nothing here is asynchronous |
| **`412`/`428`** | No endpoint in this document takes a precondition; the `ETag` traffic is `If-None-Match` on reads only |

### 13.5 Analytics — the eight `§C6` events this surface produces

Every one is **client-emitted**. The API is stateless about intent and cannot distinguish a human
opening a gallery from a crawler fetching a page; the server's contribution is to return the
identifiers the event needs.

| Event | `§C6` id | Properties | Emitted when | Consumed by |
| :--- | :--- | :--- | :--- | :--- |
| `gym_detail_viewed` | `EVT-06` | `gym_id`, `source` ∈ `search` \| `category` \| `direct` \| `favourite` \| `share` | `GET /gyms/:slug` renders, including the §5.6 informational state (with `listing_state` as an extra property) | **`KPI-09`** search→detail ≥45%, **`KPI-10`** detail→checkout ≥8%, `FNL-01` |
| `gym_gallery_opened` | `EVT-07` | `gym_id`, `photo_index` | The gallery lightbox opens (`SCR-WEB-003` region 1) | Media-quality reporting; `FR-ONB-04` photo guidance |
| `plan_viewed` | `EVT-08` | `gym_id`, `plan_id`, `price_minor` | A plan card enters the viewport on `GET /gyms/:slug/plans`. `price_minor` is **minor units** — `NFR-DQ-02` — and is the `effective_price_minor` the buyer actually saw | Price-sensitivity analysis; `BR-PLN-03` forensics when a buyer disputes a figure |
| `comparison_added` | `EVT-09` | `gym_ids`, `count` | A gym is added to the set, including the add that triggers the `AC-DETL-01.3` prompt | `FR-DETL-08` adoption |
| `comparison_viewed` | `EVT-10` | `gym_ids`, `count` | `SCR-WEB-004` renders a resolved `POST /compare` | `FR-DETL-08` |
| `favourite_added` | `EVT-11` | `gym_id` | `201`/`200` from §11.2, **once** per user action even when the deferred intent replays | `FR-FAV-01`; the funnel that justifies `A6.3` attribution |
| `favourite_removed` | `EVT-12` | `gym_id` | `204` from §11.3 | `FR-FAV-01` |
| `reviews_expanded` | `EVT-13` | `gym_id`, `review_count` | The reader expands the review block or pages §7 | `FR-DETL-05`; `KPI-13` context |

| Rule | Statement |
| :--- | :--- |
| AN1 | **No event carries a price as a formatted string, a float, or a major-unit number.** `price_minor` is an integer string of paise (`NFR-DQ-02`, M1) |
| AN2 | No event carries a `tenant_id` supplied by a client. Where a tenant dimension is needed, the warehouse resolves it from `gym_id` |
| AN3 | Anonymous events carry the session identifier, not a fingerprint; `FR-SRCH-15`'s *"anonymous or authenticated identifier"* is satisfied by the session id, and `BR-DAT-06` forbids widening it |
| AN4 | `gym_detail_viewed.source` is the **only** way the platform learns how a listing was reached, and `A6.3` attribution depends on the same distinction being recorded server-side in `attribution_events` (§11.2). The event is the analytics view; the row is the commercial record. **They are not interchangeable and must not be reconciled into one** — `TECH_DEBT.md` `A6.3` |

### 13.6 Observability and testing obligations

| Obligation | Detail |
| :--- | :--- |
| Metrics | `discovery.detail.duration_ms` and `discovery.plans.duration_ms` p95 against `NFR-PERF-01` (500 ms); **`discovery.cache.hit_ratio`** per endpoint class — a detail-page hit ratio below 0.8 means the purge map of §3.2 is over-firing and `NFR-SCAL-04` is at risk; `discovery.purge.lag_ms` from outbox commit to edge acknowledgement, alerting above 60 s because `BR-TEN-05-P1` and `FR-ONB-13` both name that number |
| Metrics | `discovery.visibility_predicate.filtered_count` — rows the predicate removed. A sudden fall to zero means the predicate stopped composing, which is the failure mode no functional test notices |
| Contract (`OA4`) | Supertest against the **generated** OpenAPI document for all sixteen routes and every documented status code, including `304`, the `Cache-Control` string per class, and `Vary: Authorization` on the six `/me` routes |
| Absence assertions | (1) No public response schema contains `visibility` (§6.4). (2) No public response contains `is_favourited` (ET6). (3) No review DTO exists without `is_verified_member` (§7.4). (4) No request schema in this document contains a monetary field (M3) |
| Isolation (`BAC-10`, `E2E-11`) | The ten public handlers appear in the **`@Public()` inventory** asserting no `SET LOCAL` and no `P-STD` read outside the §2.2 elevation; the four favourites handlers appear in the tenant inventory with two real tenants; `saved_searches` carries an explicit cross-user negative test (SD1) |
| Business rules | `BR-GYM-01-P1/N1` · `BR-TEN-05-P1` · `BR-TEN-06-P1` · `BR-PLN-03-P1/N1` · `BR-PLN-05-P1/N1` · `BR-REV-03-P1/N1` · `BR-REV-07-P1/N1` |
| End-to-end | `E2E-01` (search → detail → plans), `E2E-02` (discovery → purchase → activation, carrying the fingerprint through), `E2E-10` (favourite while signed out → login → favourite present, `AC-FAV-01.1`) |
| Performance | `NFR-PERF-01` 500 ms p95 on §5 and §6 at cache miss; `NFR-PERF-02` 2.5 s LCP for the server-rendered page built on §5 |

---

## 14. Closing — what this contract fixes, what it defers

### 14.1 The five decisions this document exists to make

| # | Decision | Where | What breaks without it |
| :-: | :--- | :--- | :--- |
| 1 | **The public read path touches no tenant-owned table without a named, audited, `SELECT`-only elevation, and no tenant hint is ever accepted from a client** | §2 | The one plausible route to a cross-tenant leak on a platform whose isolation is otherwise structural |
| 2 | **A cached price is a quotation, not a charge.** Every plan object carries `price_fingerprint` + `priced_at`; checkout re-prices and aborts with `422 PLAN_PRICE_CHANGED` in **both** directions; aggregate `from` prices carry no fingerprint and no `plan_id`, so nothing cached for an hour can be clicked into a checkout | §3.2 part 3, CL2 | `BR-PLN-03` (`RSK-11`, score 12) becomes unprovable the moment the CDN is switched on |
| 3 | **`is_favourited` is absent from every public response**, making the ten public reads byte-identical for every visitor and cacheable at the edge | §5.2 note 4, ET6 | `NFR-SCAL-04` and `NFR-PERF-02`; one boolean would fragment the cache per principal |
| 4 | **Absence is always explicit where a buyer would otherwise guess** — `false` in the comparison matrix (CM2), `{available:false}` for a missing duration (CM5), `availability.state` on a suspended favourite (`AC-FAV-01.3`), `listing_state` instead of a `404` (§5.6) — and always **omitted** where absence means "not applicable" (`rating_avg` below three reviews, `monthly_equivalent_minor` on a session pack) | §4.2, §5.6, §9.4, §11.1 | The two opposite conventions collapse into one, and a client renders zero stars for an unrated gym or a blank cell for a missing squat rack |
| 5 | **A staff-only plan is stopped at a repository method that takes no visibility argument**, not at a serialiser | §6.4 | `BR-PLN-05` survives exactly until the first refactor of a DTO |

### 14.2 Open items

| ID | Item | Owner | Deadline | Consequence of drift |
| :--- | :--- | :--- | :--- | :--- |
| **`O-MKT-1`** | Amend `API_Catalog.md` §3.4 row 2 to **`POST /me/favourites/:gymId`**, adopting resolution `MKT-R1` (§1.2), or overturn it | Principal Architect | **Before Sprint 6** | Two documents describe two paths; the implementation follows whichever the engineer opened, and the idempotency fingerprint differs between them (`API_Catalog.md` §1.6.3 component 2) |
| **`O-MKT-2`** | Record `NO-STORE!` (`private, no-store` + `Vary: Authorization`) as the token for `GET /me/favourites` and `GET /me/saved-searches` in `API_Catalog.md` §3.4 (§1.3) | Principal Architect | Before Sprint 6 | A header, not a policy class — but an intermediary that keys on URL alone would serve one member's shortlist to another |
| **`O-MKT-3`** | **`POST /gyms/:slug/report` has no owning domain file** (§1.4). `Reviews.md` must adopt it — it already owns the `*_reports` vocabulary and the nine `§C4.8` `moderation_reason_enum` values | Backend Lead, `reviews` | **Before the Phase-5 gate closes** | The `FR-RBAC-01` CI gate passes on a handler no contract describes, and `FR-DETL-06` ships undocumented |
| **`O-MKT-4`** | Decide whether review photos exist in Phase 2. `photos` is reserved as an always-empty array (§7.2); `Schema.md` §10.1 has no review-media table and `FR-DETL-05` does not require one | Product Manager + Backend Lead, `reviews` | Before Sprint 12 | Additive if decided in advance; a new field and a new moderation queue (`FR-ADMN-12`) if retrofitted |
| **`O-MKT-5`** | A locality endpoint (`GET /v1/cities/:slug/localities`). §10.2 truncates facets to the top 24 and Phase 1 needs no more; a city with 74 localities eventually will | Backend Lead, `discovery` | Before Sprint 14 | A new endpoint, therefore an `API_Catalog.md` amendment, not a change to any contract here |
| **`O-MKT-6`** | Ratify the **closed** set of indexable landing URLs: `/gyms/{city}`, `/gyms/category/{cat}`, `/gyms/{city}/category/{cat}` and nothing else (§10.4) | Growth + Principal Architect | Before the first sitemap submission | An unbounded facet grid is thin content at scale, and de-indexing it afterwards costs more than never minting it |
| **`V-MKT-1`** | Confirm the CDN honours **`POST` caching keyed on path + canonical body hash** for `/v1/compare` (§9.1). If it does not, `POST /compare` falls back to `NO-STORE` and the §3.2 `CDN-60` row is amended — **no contract change**, one cache token | Platform engineer | Before Sprint 7 | A `POST` that silently caches on path alone would serve one comparison set's payload for another's |

### 14.3 Cross-references — what lives elsewhere

| Surface | Document | Why not here |
| :--- | :--- | :--- |
| `GET /search/gyms`, `GET /search/suggest`, and `SearchCriteriaSchema` (imported by §11.5) | **`Search.md`** | Ranking, facets, map bounds and radius are one subject; this document consumes the criteria schema and never re-declares it |
| `POST /gyms/:slug/reviews`, review editing, screening, gym responses, moderation intake | **`Reviews.md`** | This document only **reads** published reviews (§7). `BR-REV-01`'s check-in gate lives with submission |
| `POST /gyms/:slug/report` | **`Reviews.md`**, pending `O-MKT-3` | §1.4 |
| Plan authoring, pricing, promotions, archiving; `plan_branches` | **`Gym.md`** | §6 reads the published result; `BR-PLN-02`, `BR-PLN-04`, `BR-PLN-07` are write-side rules |
| `POST /orders` and the `price_fingerprint` **return** leg, `422 PLAN_PRICE_CHANGED` | **`Payments.md`** and the `ordering` contract | This document owns emission; that one owns comparison and abort (§3.2 part 3) |
| Notification delivery for `FR-FAV-04` price and promotion alerts, quiet hours, DLT templates | **`Notifications.md`** | §11.2 emits the outbox event and stops there |
| Sitemap generation, `robots.txt`, the crawler allowlist's operational configuration | **`Search.md`** and `Security.md` | §13.3 states the payload contract; the fetchers are infrastructure |

### 14.4 Traceability

| Identifier | Discharged in |
| :--- | :--- |
| `FR-DETL-01` · `02` · `03` · `04` · `05` | §5.2 · §6.2 · §6.3 · §4.2, §5.2 · §7 in full |
| `FR-DETL-07` · `08` · `09` · `10` · `11` | §5.2 `seo.link_preview` · §9 in full · §9.1 · §5.2, §5.7, §13.3 · §5.6 |
| `FR-FAV-01` · `02` · `03` · `04` · `05` | §11.2, §11.3 · §11.1 · §11.2 (`AC-FAV-01.1`) · §11.1, §11.2 side effects · §11.4–§11.6 |
| `FR-SRCH-09` · `12` · `13` · `14` | §2.3 · §10.2 facets, §8 · §10.2, §10.4, §13.3 · §11.4, §11.5 |
| `FR-NAV-01` · `NAV-05` | §1.5, §2 · §13.3 SEO1, SEO2 |
| `FR-GYM-03` · `GYM-04` · `GYM-11` | §10.5 · §4.4, §5.2 · §5.6 `TEMPORARILY_CLOSED` |
| `BR-GYM-01` · `BR-TEN-05` · `BR-TEN-06` | §2.3, §12 · §5.6, §9.4, §11.1 · §2.3, §12 |
| `BR-PLN-01` · `03` · `05` · `07` | §6.1, §6.6 · §3.2 part 3, §6.6, §14.1 #2 · §6.4 · §6.6 |
| `BR-REV-03` · `05` · `06` · `07` | §7.4 · §7.2 · §3.2 part 2 · §4.2, §5.7 SD-A, §8.2 |
| `BR-TEN-01` · `BR-DAT-06` | §2 in full, §13.6 · §5.1, §7.2, §7.3 |
| `AC-DETL-01.1` · `01.2` · `01.3` · `02.1` · `02.2` · `02.3` | §9.3 alignment · §9.4 CM2 · §9.2 · §4.2, §7.5 · §7.4 · §7.2 `response` |
| `AC-FAV-01.1` · `01.2` · `01.3` | §11.2 · §11.1 `price.change` · §11.1 `availability`, §9.4 `unavailable[]` |
| `NFR-PERF-01` · `PERF-02` · `SCAL-04` · `SEC-06` · `DQ-02` · `DQ-06` · `PRV-07` · `USE-05` | §13.6 · §3.1 · §3, §14.1 #3 · §13.1 · AN1 · §10.3, AM2 · §7.2 · every message in §5.3, §6.5, §9.5 |
| `KPI-09` · `KPI-10` | `EVT-06` in §13.5 |
| ADR-0002 · ADR-0005 · ADR-0007 · ADR-0017 · ADR-0023 | Stack · §2.1 · §8.1, §10.2 · §3.2 part 2 · §7.1 |
| `LAUNCH_MARKET_INDIA.md` §1 · §2 · §3 · §9 | §10.1 `country_code` · §4.3 rounding, §5.2 note 6 · AM3 · §2.2 read replicas |

---

**END OF `docs/apis/Marketplace.md` — `API-DISC` (non-search) + `API-FAV` contract complete:
16 endpoints, 10 public reads and 6 authenticated operations, 10 owned error codes, 8 analytics
events, 7 open items. Nothing below this line.**
