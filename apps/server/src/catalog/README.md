# catalog

**Charter (`MASTER_PRD.md` §C1.3).** `gyms, branches, amenities, hours, media` — the tenant's public
identity and physical footprint (`B5.4`).

---

## 1. Bounded context

Owns the answer to **"what is this gym, where exactly is it, when is it open, and is it currently
listable"**. Three of those are irreducibly its own. The `geography(Point,4326)` pin on `branches` is
the single coordinate the whole system uses — radius search, nearby, comparison and the `BR-GYM-08`
approval geo-check are one column behind one GiST index. `OperatingHours` is the single evaluator of
"is this branch open at instant _t_ in its own IANA zone", with exceptions always winning over
weekday windows; `attendance/` asks it at check-in step 5 and `discovery/` bakes its answer into a
336-bit mask. And `gyms.status` is the listing switch: `catalog/` sets it, but it may only set
`APPROVED` on receipt of `application.approved` — the human decision belongs to `onboarding/`
(`BR-GYM-03`), and the database default is `DRAFT` precisely so no automated path can start
elsewhere.

The fourth owned decision is the one most likely to be got wrong: **which field edits require review
and which publish immediately**. `BR-GYM-06` and `BR-GYM-07` are complements, and the
`MaterialFieldRegistry` enumerates only the `REQUIRES_REVIEW` set. Everything else is the _computed_
complement. There is no second list, because two lists drift and the drift is invisible.

## 2. PRD identifiers

| Class          | Identifiers                                                                                                                                                                                                                                                                                                                                  |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional     | `FR-GYM-01` … `FR-GYM-12`                                                                                                                                                                                                                                                                                                                    |
| Business rules | `BR-GYM-01` (status gate), `BR-GYM-02` (approval preconditions this module supplies: ≥ 3 photographs, resolvable geo, stated hours), `BR-GYM-06`, `BR-GYM-07`, `BR-GYM-08`, `BR-GYM-09`; `BR-TEN-03` (multi-branch); `BR-CHK-03`, `BR-CHK-05` (the hours and branch facts check-in denies on); `BR-REV-07` (the rating projection it stores) |
| Non-functional | `NFR-SEC-05` (description sanitised on write, never on read), `NFR-SEC-10` (media type by magic bytes, not the declared header), `NFR-DQ-06` (city, locality, amenity and category are reference data, never free text), `NFR-MNT-09`                                                                                                        |
| State machine  | No `§C4` machine of its own. `gym_status_enum` and `branch_status_enum` are lifecycle columns driven by `onboarding/`'s `§C4.4` decisions and by owner action                                                                                                                                                                                |
| `§C5` jobs     | **`gym.freshness-score`** (job 14). See §8                                                                                                                                                                                                                                                                                                   |
| Screens        | `SCR-DASH-003` (gym profile), `SCR-DASH-004` (branches), `SCR-WEB-003` regions 1–6 (rendered from this module's read model via `discovery/`)                                                                                                                                                                                                 |
| Epic / E2E     | `EP-04` · `E2E-01` · `RSK-11` (stale listings)                                                                                                                                                                                                                                                                                               |

Note the split with `MASTER_PRD.md` B5.3: `FR-ONB-04` (wizard step 3 — gym, hours, photographs,
map pin) is an **onboarding** requirement satisfied through this module's `GYM_COMMAND_PORT`.
The wizard does not write `gyms` directly.

## 3. Owned tables

_Planned. No code in this module yet - populated by the milestones listed below._

| Table                    | Notes that matter                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gyms`                   | `slug` is unique **per city**, not globally — two "Iron Temple" gyms in different cities are both legitimate. `status` defaults to `DRAFT` and **no automated path may set `APPROVED`**. `rating_avg` / `rating_count` are a **projection** owned by the `review.rating-aggregated` handler, not a fact. `parent_gym_id` carries `ck_gyms__no_hierarchy CHECK (parent_gym_id IS NULL)` so the first developer who needs a franchise group gets a loud failure instead of half a system |
| `branches`               | `location geography(Point,4326)` declared in raw SQL — Prisma has no geography scalar (ADR-0007). `state_code char(2)` drives **India place of supply**, and therefore CGST+SGST versus IGST on every invoice for a sale at this branch. `uq_branches__one_primary_per_gym` is a **partial unique index**, not a trigger, because promotion and demotion happen in one transaction and a counting trigger would race                                                                   |
| `branch_hours`           | Keyed `(branch_id, weekday, opens_at)` with **no** unique on `(branch_id, weekday)`: Indian gyms routinely close through the afternoon, so 05:00–11:00 plus 16:00–23:00 is two rows. **Zero rows for a weekday means closed**, not unknown. A window crossing midnight is two rows on two weekdays, never `opens_at > closes_at`. Non-overlap is an exclusion constraint (`btree_gist`)                                                                                                |
| `branch_hour_exceptions` | An exception **replaces** the date's hours entirely; it does not merge. `GYM_CLOSED_EXCEPTION` is returned in preference to `OUTSIDE_OPERATING_HOURS` when both apply (`TM8`)                                                                                                                                                                                                                                                                                                          |
| `gym_amenities`          | G-CRUD-D. Amenities are platform reference data by stable id; free text is not offered because filtering depends on the value (`FR-GYM-03`, `NFR-DQ-06`)                                                                                                                                                                                                                                                                                                                               |
| `gym_media`              | `renditions jsonb` with each rendition object immutable; `is_cover` a partial unique per gym; `moderation_status` served by a partial index because the queue is a tiny fraction of the table. `BR-GYM-02`'s three-photograph minimum is an **approval gate, not a storage gate** — deleting below three is permitted and warned about                                                                                                                                                 |

**Not owned, despite living in `database/Schema.md` §5 "Catalogue":** `saved_searches` (→ `discovery/`),
`crm_members` and `leads` (→ `crm/`). The schema's ten groups are a reviewer's grouping, not the
module boundary; `FolderStructure.md` §8.3 requires each table to appear under exactly one **module**.
Also not owned: `payout_accounts` (→ `settlements/`) and `tenants` (→ `tenancy/`), even though
`M-035` routes the payout-account change and `tenants.payout_hold_until` through this module's
material-field logic.

**Delivering milestones:** M-031 (`gyms`, `branches`, `gym_amenities`), M-033 (`gym_media`),
M-034 (`branch_hours`, `branch_hour_exceptions`).

## 4. Public surface

_Planned. No code in this module yet - populated by the milestones listed below._

`catalog/` is not one of the four provider-only modules of `FolderStructure.md` §8.2, so
`controllers/`, `dto/` and `permissions.ts` are mandatory. It is nevertheless the most heavily
_consumed_ module in L3 — six distinct ports on `index.ts`, which is what "the tenant's physical
footprint" means once five other modules need to ask about it.

| Exported from `index.ts`         | Consumers                                                               | The question it answers                                                                                      |
| :------------------------------- | :---------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| `GYM_COMMAND_PORT`               | `onboarding/`                                                           | Create the gym and branches inside the application transaction (edge 9)                                      |
| `BRANCH_QUERY_PORT`              | `plans/`, `staff/`, `ordering/`, `attendance/`                          | Does this branch exist, and does it belong to this gym (edges 4, 6, 15, 23)                                  |
| `GYM_STATUS_PORT`                | `ordering/`                                                             | Is this gym suspended — an order against a suspended gym must fail **before** payment (edge 15, `BR-GYM-01`) |
| `GYM_TIMEZONE_PORT`              | `memberships/`                                                          | The IANA zone `BR-MEM-03` computes validity in — `Asia/Kolkata`, +05:30, no DST (edge 20)                    |
| `OPERATING_HOURS_PORT`           | `attendance/`                                                           | Is this branch open **now**, in its own zone (edge 23, `BR-CHK-05`)                                          |
| `GYM_QUERY_PORT`                 | `reviews/`                                                              | The gym being reviewed and its owner, for the response path (edge 27)                                        |
| `GYM_SEARCH_VIEW_PORT`           | `discovery/`                                                            | The approved-gym read model, **carrying the rating projection** (edge 12)                                    |
| `gym.*` event payload **types**  | `discovery/`, `memberships/`, `onboarding/`, `notifications/`, `admin/` | `E7` — a consumer types its handler without importing this module's `domain/`                                |
| `catalog.*` permission constants | `iam/`'s `PermissionsGuard`; both dashboards via the generated client   |

`GYM_SEARCH_VIEW_PORT` is load-bearing in a way its name hides. It is the **only** path by which a
rating reaches search. `discovery/ → reviews/` is `—` in the `ModuleDependency.md` §4 matrix — not
even an event — because two sources of a rating is exactly how a search card shows 4.6 and the detail
page shows 4.4 (§0 C-2, §11.2).

Permission strings (`apis/Gym.md` §2.1 rows 11–23): `catalog.gym.list`, `.create`, `.read`, `.update`
· `catalog.gym_media.create`, `.reorder`, `.delete` · `catalog.branch.list`, `.create`, `.read`,
`.update`, `.deactivate` · `catalog.branch_hours.update`.

**Delivering milestones:** M-031 (`index.ts`, `GYM_TIMEZONE_PORT`), M-032 (the `Gym` aggregate),
M-033, M-034 (`OPERATING_HOURS_PORT`), M-035 (the material-field registry).

## 5. Consumed ports

_Planned. No code in this module yet - populated by the milestones listed below._

| Provider   | Port                                                                                                                                             | Why the answer must be synchronous                                                                                       |
| :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| `iam/`     | `USER_QUERY_PORT`                                                                                                                                | Owner and manager attribution on a gym record; the write must fail rather than record an unresolvable actor (edge 3)     |
| `common/`  | `Clock`, `IdGenerator`, outbox, pagination, and `ReferenceDataRepository` for `amenities`, `gym_categories`, `countries`, `cities`, `localities` | Universal edge. Reference data is read through `common/`, **never** by importing `admin/` (`ModuleDependency.md` §0 C-3) |
| `tenancy/` | `TenantContext`, the tenant-scoped Prisma client                                                                                                 | Universal edge; every table here is RLS-forced                                                                           |
| `audit/`   | `AUDIT_WRITE_PORT`                                                                                                                               | `BR-DAT-01`: every gym, branch and media mutation is audited before/after                                                |

**Not consumed, and the absences are the design.** `catalog/ → reviews/` is forbidden (upward L3→L4)
even though this module _stores_ the rating: the projection is fine, the import is not
(`ModuleDependency.md` §4.2). `catalog/ → plans/` is forbidden, which is why `BR-GYM-02`'s
"≥ 1 published plan" precondition is asserted by `onboarding/` at the `PENDING_REVIEW` transition
and recorded in `applications.precheck_results`, not evaluated here.

External dependencies through `§4.5` ACLs: **DEP-05** object storage and the Sharp rendition pipeline
(`A-17`), the virus scanner, the image inspector (magic bytes), and the geocoder used for the
`BR-GYM-08` tolerance measurement stored on `branches.geo_tolerance_metres`.

**Delivering milestones:** M-031, M-032, M-033.

## 6. Emitted events

_Planned. No code in this module yet - populated by the milestones listed below._

Every payload carries `tenant_id` and `occurred_at` and **no personal datum** (`E5`). The outbox row
is written inside the state-changing transaction (`E2`).

| Event                           | Payload beyond the two universals      | Known consumers                                |
| :------------------------------ | :------------------------------------- | :--------------------------------------------- |
| `gym.approved`                  | `gym_id`, `city_id`                    | `discovery/`, `notifications/`                 |
| `gym.suspended`                 | `gym_id`, `reason_code`                | `discovery/`, `memberships/`, `notifications/` |
| `gym.material-change-submitted` | `gym_id`, `changed_fields[]`           | `onboarding/` (re-review, `BR-GYM-06`)         |
| `gym.rating-recomputed`         | `gym_id`, `rating_bps`, `review_count` | `discovery/` (reindex)                         |

`gym.suspended` is the one to understand. It fans to two modules with opposite jobs: `discovery/`
removes the listing **immediately** (`BR-TEN-05`), and `memberships/` does **nothing to entitlement**
— existing active memberships continue to permit check-in until natural expiry. A handler that
suspended memberships here would break `BR-TEN-05` and `BR-MEM-14` in one move.

Note that `rating_bps` is basis points — an integer — while `gyms.rating_avg` is `numeric(2,1)`. A
rating is not money, so `DB2` does not apply, but the event payload is integral anyway so that
consumers cannot introduce float drift.

> **Conflict, recorded not resolved.** `engineering/Architecture.md` §5 attributes `gym.approved` to
> `onboarding/`. `ModuleDependency.md` §8.2 attributes it to `catalog/` and gives `onboarding/` the
> `application.approved` event that `catalog/` consumes. This file follows §8.2. Reconciliation is an
> owner decision recorded in `DECISION_LOG.md`, not a choice made in code (`CLAUDE.md` §9.3).

**Delivering milestones:** M-032 (`gym.*` profile events), M-035 (`gym.material-change-submitted`),
M-036 (the `application.approved` handler that produces `gym.approved`).

## 7. Consumed events

_Planned. No code in this module yet - populated by the milestones listed below._

| Event                             | Publisher     | Handler idempotency key                           |
| :-------------------------------- | :------------ | :------------------------------------------------ |
| `application.approved`            | `onboarding/` | `application_id`                                  |
| `review.published`                | `reviews/`    | `review_id`                                       |
| `review.rating-aggregated`        | `reviews/`    | `gym_id` + `aggregation_run_id`                   |
| `config.changed` / `flag.changed` | `admin/`      | `config_key` + `version` / `flag_key` + `version` |

Both review handlers are **projection** handlers, and ADR-0017 fixes their shape: a projection
handler is an **upsert**, and an aggregation handler **recomputes from source** rather than
incrementing. Incrementing `rating_count` on delivery would double-count the moment the dispatcher
redelivers, which `E3` says it may.

`application.approved` is the handler that sets `gyms.status = 'APPROVED'`. It is automated, and that
does not violate `BR-GYM-03`, because the human decision it is transcribing already happened in
`onboarding/` under a `HumanActor` signature. The handler must be incapable of reaching `APPROVED`
by any other trigger.

**Delivering milestones:** M-036 (`application.approved`), M-085 (`review.*` aggregation, in
`reviews/`; the handler lands here).

## 8. Jobs

_Planned. No code in this module yet - populated by the milestones listed below._

One `§C5` job, and one processor that is not a `§C5` job.

| Job                                      | Queue     | Class | Schedule | Conc | Scope | Lock key                              | Duration Y1 / 10× |
| :--------------------------------------- | :-------- | :---: | :------- | :--: | :---: | :------------------------------------ | :---------------- |
| **`gym.freshness-score`** (`§C5` job 14) | `catalog` |  P3   | Nightly  |  2   | PL→TS | `gym.freshness-score:platform:{date}` | 10 s / 100 s      |

Depth envelope **0 after 6 h**. If it falls behind, stale listings keep their freshness score and are
not demoted at the staleness threshold, so `RSK-11`'s mitigation stops working — visible as a
gradually worse search result set, not as an error. Severity **P3**. Idempotency is by recomputation
from source and upsert, not by incrementing (ADR-0017). The score derives from last profile update,
last plan update, photo age and check-in recency (`FR-GYM-12`), and it is a **ranking input** consumed
by `discovery/` through the projection, never a filter.

| Processor                       | Queue                                 | Trigger                | Notes                                                                                                                                                                                                                                                                                                                           |
| :------------------------------ | :------------------------------------ | :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `catalog.media-process` (M-033) | `media` per `Monitoring.md` `ALRT-20` | On upload confirmation | Bounded concurrency, a decode memory and pixel-count cap (`TR-40`, decompression bombs), Sharp renditions `thumb` 320w / `card` 640w / `hero` 1280w / `lightbox` 2048w in AVIF + WebP + JPEG, `.withMetadata(false)` **plus** an explicit EXIF/XMP/IPTC strip. A failure marks the row degraded **without losing the original** |

> **Queue-naming discrepancy.** `Monitoring.md` `ALRT-20` enumerates a `media` queue with a 500 / 600 s
> envelope, while `Scalability.md` §8.10's grammar is _"queue name: `<module>`"_ — which would give
> `catalog`. §8.3.1 does not settle it because it covers the twenty-four `§C5` jobs only, and this
> processor is not one of them. Name the queue explicitly in M-033 rather than letting the two
> documents disagree in code.

**Delivering milestones:** M-033 (`media-process`), M-043-adjacent (`gym.freshness-score` feeds the
projection; the job itself is scheduled from the M-018 harness).

## 9. Top three failure modes (`NFR-MNT-09`)

Declared in `PROJECT_CONSTITUTION.md` §18.5.1.

|  #  | Failure mode                                | Signal                                                                                                                                                                      | First action                                                                                                                                                                                                                                                                                                                                                                                 |
| :-: | :------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **Media pipeline backlog**                  | `queue_depth{queue="media"}` above its 500 envelope, or `queue_oldest_job_age_seconds` above 600 s, for 15 m (**`ALRT-20`**, S2); owners see photographs stuck "processing" | Check whether workers are alive before assuming volume: `queue_active_workers == 0` with depth > 0 always pages. A single oversized upload hitting the decode cap will not block the queue — the failure path marks the row degraded and keeps the original                                                                                                                                  |
|  2  | **Geocode drift beyond tolerance**          | `branches.geo_tolerance_metres` exceeding the configured tolerance on new submissions; a `FLAG` spike on the `geo-distance` pre-check in `onboarding/`                      | Determine whether the geocoder changed or the tolerance configuration did. A drift affecting many submissions at once is a provider change, not 40 owners suddenly dropping bad pins. Approval over the flag stays possible with a recorded override reason (`BR-GYM-08`)                                                                                                                    |
|  3  | **Search reindex lag after a profile edit** | `search_index_lag_seconds > 300` for 10 m (**`ALRT-36`**, S2); `search_reindex_lag_seconds` alerting at 60 s and escalating at 300 s (`PF2`)                                | The job is owned by `discovery/`, but the _cause_ is frequently here — an event that should invalidate a document and is not in M-043's eleven-entry `reindex-trigger.registry`. Confirm the emitting transaction wrote its outbox row, then check the registry before touching the processor. A stale **price** displayed this way is a defect, not a UX inconvenience (`A3.4` principle 2) |

**Runbook: [`/docs/runbooks/catalog.md`](../../../../docs/runbooks/catalog.md)** ·
owner **Backend Lead (catalog)** · primary alerts `ALRT-20` (`media`), `ALRT-36`.

> `Monitoring.md` §9.6 names this runbook `catalog-media.md`; `FolderStructure.md` §8.3 requires
> `/docs/runbooks/<module>.md`. Written at `catalog.md`; the conflict is flagged in the runbook and
> needs one owner decision across all twenty-three modules.
