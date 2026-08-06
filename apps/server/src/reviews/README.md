# reviews

> Charter (`MASTER_PRD.md` §C1.3): **reviews, responses, moderation, aggregation, anomaly detection.**

---

## 1. Bounded context

`reviews/` owns the answer to _"does a written account of this gym exist, is it visible, and what
number does it contribute?"_ — and it owns that answer against the party with the strongest motive to
change it. No other module may create, edit, unpublish or remove a review; the gym the review
concerns may respond **once** and may report it, and the absence of any third affordance is
structural rather than procedural (`BR-REV-05`, `M-083` AC 5: the tenant database role holds no
`UPDATE` or `DELETE` privilege on `reviews`, and no OpenAPI operation exists that would use one). It
also owns the single `(sum, count)` pair from which both the publicly displayed mean and the private
Bayesian ranking figure are derived, because two rating calculators are how a search card and a
detail page come to disagree (`FR-REV-08`, `M-085` AC 2). What it deliberately does **not** own is
eligibility: that fact lives in `attendance/` and is asked for, never copied (`BR-REV-01`).

## 2. PRD identifiers

| Class           | Identifiers                                                                                                                                                                                |
| :-------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional      | `FR-REV-01` … `FR-REV-11`                                                                                                                                                                  |
| Business rules  | `BR-REV-01` … `BR-REV-07`; `BR-CHK-08` (a `MANUAL`/`OVERRIDE` check-in confers eligibility); `BR-DAT-04` (erasure pseudonymises the author and keeps the review); `BR-DAT-06`; `BR-TEN-01` |
| Non-functional  | `NFR-SEC-05` (server-side validation and output encoding of member-authored prose), `NFR-USE-01`, `NFR-MNT-09`                                                                             |
| State machine   | **`§C4.6`** — `SUBMITTED` → `PUBLISHED` \| `HELD`; `PUBLISHED` ⇄ `UNPUBLISHED`; `REMOVED` terminal                                                                                         |
| Reason taxonomy | `§C4.8` **Moderation** — the nine `moderation_reason_enum` values                                                                                                                          |
| `§C5` jobs      | `review.aggregate`, `review.anomaly-scan`                                                                                                                                                  |
| Acceptance      | `AC-REV-01.1` … `AC-REV-01.3`, `AC-REV-02.1` … `AC-REV-02.3`                                                                                                                               |
| Screens         | `SCR-WEB-003` (review block), `SCR-WEB-013`, `SCR-DASH-019`, `SCR-ADM-012`                                                                                                                 |
| Gates           | Invariant 4 (_verification before visibility, earned reviews only_), `E2E-09`, `BAC-09`, `KPI-13`                                                                                          |

## 3. Owned tables

_Planned. No code in this module yet - populated by the milestones listed below._

| Table              | Written by       | The constraint that carries a rule                                                                                                                                                                                                                               |
| :----------------- | :--------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reviews`          | This module only | `membership_id` is **`NOT NULL`** and `uq_reviews__user_membership` is unique — _this is_ `BR-REV-02`, and it is also what makes `BR-REV-03`'s "Verified member" marker derivable rather than stored, and therefore incapable of going stale (`Schema.md` §10.1) |
| `review_responses` | This module only | `uq_review_responses__review_id` — one response per review, because `BR-REV-05` says _once_                                                                                                                                                                      |
| `review_reports`   | This module only | `reason_code moderation_reason_enum` constrained to the nine `§C4.8` values; a report never alters `reviews.status` (`BR-REV-06`)                                                                                                                                |

`reviews` is soft-deleted (`R-OPS`, `SD3`); the domain vocabulary is _unpublished_ or _removed_, never
_deleted_. Grants are `SELECT` for the tenant role and `INSERT` restricted to the member role —
**no `UPDATE`, no `DELETE` for any tenant role** — asserted by `append-only-grants` and by a contract
test over the generated OpenAPI document.

> **An unresolved cross-document conflict, recorded rather than settled.** `gyms.rating_avg`,
> `rating_count` and `rating_bayes` are a projection of this module's data on a table `catalog/` owns.
> `Schema.md` §10.1 says the projection is _"owned by the `reviews/` event handler"_;
> `ModuleDependency.md` §0 C-2 and §4.2 say `catalog/` maintains it through its own
> `review.rating-aggregated` handler; `M-085` lists the consumer file under
> `reviews/application/consumers/`. Both documents are binding derived specification at the same
> precedence level (`CLAUDE.md` §2), so this is not resolvable in code. **M-085 must not write the
> consumer until the owner records a decision in `DECISION_LOG.md`** (`CLAUDE.md` §9.3).

**Delivering milestones** — `M-083` (`reviews`), `M-084` (`review_responses`, `review_reports`).

## 4. Public surface

_Planned. No code in this module yet - populated by the milestones listed below._

`reviews/` **has** controllers, so `permissions.ts` is mandatory (`FolderStructure.md` §8.1,
`FR-RBAC-01`). Three audiences, three controllers: member (`/v1/me/reviews`,
`/v1/gyms/:slug/reviews`), tenant (`/v1/tenant/reviews`), and the moderation surface that lives on
`admin/`'s routes (`/v1/admin/moderation/reviews`) but is owned here.

| Exported symbol                         | Kind                 | Consumers                                                                                                                                                                                                                                              |
| :-------------------------------------- | :------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REVIEW_AGGREGATE_PORT` + its interface | Read-model port      | `reporting/` (●), `admin/` (●) — **and nothing else.** `ModuleDependency.md` §11.2 names this token exactly once, and names it as the injection `discovery/` must never make: the `discovery → reviews` matrix cell is **—**, forbidding even an event |
| `REVIEW_PERMISSIONS`                    | Permission constants | `iam/` (enumeration), `admin/`                                                                                                                                                                                                                         |
| `ReviewPublishedPayload`                | Event payload type   | `catalog/`, `notifications/`                                                                                                                                                                                                                           |
| `ReviewFlaggedPayload`                  | Event payload type   | `admin/`                                                                                                                                                                                                                                               |
| `ReviewRatingAggregatedPayload`         | Event payload type   | `catalog/`                                                                                                                                                                                                                                             |

The permission strings are fixed by `API_Catalog.md` §3 and §5: `reviews.review.list_own`,
`reviews.review.check_eligibility`, `reviews.review.create`, `reviews.review.update`,
`reviews.review.delete`, `reviews.review.report`, `reviews.review.list`,
`reviews.response.create`, `reviews.moderation.list`, `reviews.moderation.decide`. The last two are
held by `MODER` and `S.ADMIN` and by **no tenant role** — that assignment is `BR-REV-05` expressed in
the permission matrix.

Never exported: the `Review` aggregate, the screening pipeline, the lexicons, the repositories, and
`rating_bayes` — the ranking figure appears in no response schema anywhere, proven by a contract test
(`M-085` AC 1, `RV3`).

**Delivering milestones** — `M-083` (module shell, `index.ts`, `permissions.ts`, eligibility and
submission controllers), `M-084` (tenant respond/report controller), `M-085` (moderation controller
and the aggregate port).

## 5. Consumed ports

_Planned. No code in this module yet - populated by the milestones listed below._

| From                            | Port                                          | Why the answer must be synchronous                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| :------------------------------ | :-------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attendance/`                   | `ATTENDANCE_QUERY_PORT` — `hasCheckInAtGym()` | **Invariant 4.** `BR-REV-01`. Eligibility is checked **twice**: asynchronously on `checkin.recorded` to open the window, and again _synchronously at submission_, because the window can open and the check-in can later be voided (`ModuleDependency.md` §8.4 chain 3). It is a **question port** — it returns a boolean and never exposes an attendance row (§7.3). The predicate is `result = 'ALLOWED'`; a member denied at the door has a row and has not attended |
| `catalog/`                      | `GYM_QUERY_PORT`                              | The gym being reviewed must exist and be resolvable from a public slug in the same request, and the owner must be resolvable for the response path (`FR-REV-06`)                                                                                                                                                                                                                                                                                                        |
| `staff/`                        | `STAFF_QUERY_PORT`                            | Who may publish an owner response, and under which branch scope, decided inside the write (`FR-REV-05`, `FR-REV-06`)                                                                                                                                                                                                                                                                                                                                                    |
| `common/`                       | `ReferenceDataRepository`                     | `reason_codes` — the `§C4.8` moderation reasons — read as platform-global reference data, **never** by importing `admin/` (`ModuleDependency.md` §0 C-3)                                                                                                                                                                                                                                                                                                                |
| `common/`, `tenancy/`, `audit/` | Universal edges                               | `Clock`, outbox port, error taxonomy; `TenantContext` and the tenant-scoped Prisma client; `AUDIT_WRITE_PORT` for every moderation decision (`BR-DAT-01`)                                                                                                                                                                                                                                                                                                               |

> `ModuleDependency.md` §4's matrix marks `reviews → iam` as **●**, but §3.2's edge list — which
> states _"if a port is not in this table, the edge does not exist"_ — names no port on that pair.
> No injection of `iam/` is planned here; author identity travels on the authenticated principal.
> The discrepancy is recorded, not exploited.

**Delivering milestones** — `M-083` (the `attendance/` adapter and eligibility service), `M-084`
(`staff/` for the response path), `M-085` (audit on moderation).

## 6. Emitted events

_Planned. No code in this module yet - populated by the milestones listed below._

Every payload additionally carries `tenant_id` and `occurred_at`, and none carries a name, phone,
email or any other personal datum (`E5`, `BR-DAT-06`). The outbox row is written **inside** the same
interactive transaction as the state change (`E2`, ADR-0017).

| Event                      | Payload beyond the two universals      | Known consumers                                  |
| :------------------------- | :------------------------------------- | :----------------------------------------------- |
| `review.published`         | `review_id`, `gym_id`, `rating`        | `catalog/` (rating projection), `notifications/` |
| `review.flagged`           | `review_id`, `reason_code`             | `admin/` (moderation queue)                      |
| `review.rating-aggregated` | `gym_id`, `rating_bps`, `review_count` | `catalog/`                                       |

`rating_bps` is basis points, not a float — the rating crosses a module boundary as an integer for
the same reason money does. Note that `review.published` and `review.rating-aggregated` are two
events and not one: publication is a decision, aggregation is a recomputation, and `AC-REV-02.3`'s
sixty-second budget applies to the second.

**Delivering milestones** — `M-084` (`review.flagged`), `M-085` (`review.published`,
`review.rating-aggregated`).

## 7. Consumed events

_Planned. No code in this module yet - populated by the milestones listed below._

| Event                | Publisher      | Handler idempotency key      | What the handler does                                                                                                                                                                                        |
| :------------------- | :------------- | :--------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkin.recorded`   | `attendance/`  | `attendance_id`              | Opens the eligibility window and schedules the `FR-REV-10` prompt after the member's third check-in. It does **not** cache eligibility — the synchronous re-ask at submission is what makes `BR-REV-01` hold |
| `membership.expired` | `memberships/` | `membership_id` + `end_date` | Opens the second `FR-REV-10` prompt window at day 45 if no review was submitted                                                                                                                              |

Handlers are idempotent because the dispatcher may deliver more than once (`E3`), and a failing
handler never rolls back its emitter (`E6`).

**Delivering milestones** — `M-083` (the `checkin.recorded` handler), `M-085`
(`membership.expired` and the prompt ladder; prompt timing is behind `exp.reviews.prompt-timing` and
`rel.reviews.review-prompts`).

## 8. Jobs

_Planned. No code in this module yet - populated by the milestones listed below._

Two of the twenty-four `§C5` jobs are owned here. Queue, class, concurrency, lock grammar and
duration envelopes are from `Scalability.md` §8.3.1 and §8.3.2.

| `§C5` job             | Schedule                    | Queue · class · conc.                    | Lock scope                                                                                                              | Expected duration                                                                                                                                                                                                            |
| :-------------------- | :-------------------------- | :--------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `review.aggregate`    | On change + nightly rebuild | `reviews` · **P2** · 3 · tenant-scoped   | `review.aggregate:gym_{id}:{changeSeq}` and `review.aggregate:nightly:{date}` — **per gym**, so two gyms never contend  | 200 ms per gym; 6 min nightly (Y1) → 60 min nightly at 10×. Depth ≤ 100 after 5 min. `AC-REV-02.3` requires the rating to move within **60 s** of a moderation decision, and the ADR-0017 relay's 5 s tick leaves the margin |
| `review.anomaly-scan` | Hourly                      | `reviews` · **P3** · 1 · platform-scoped | `review.anomaly-scan:platform:{hour}` — one holder platform-wide, because clustering signals are cross-tenant by nature | 30 s (Y1) → 5 min at 10×. Depth 0 after 2 h                                                                                                                                                                                  |

Re-execution is a no-op by construction: ADR-0017 requires an aggregation handler to **recompute from
source rather than increment**, so a duplicated `review.aggregate` produces the same `(sum, count)`.

Two further scheduled processors are specified by the roadmap and are **not** among the twenty-four:
`review-aggregate-reconcile` (nightly full recompute, alerting on any correction above `0.05` on any
gym) and `reviews-audit-eligibility` (weekly re-run of the `BR-REV-01` `EXISTS` test; a failure
**unpublishes pending investigation and never deletes**). Both are `M-085` deliverables. Neither has
a row in `§C5` or a duration envelope in `Scalability.md` §8.3.2, and `§C5` requires every job to
carry a distributed lock, start/end/outcome recording, metrics and an expected-duration alarm — so
both need either a `§C5` amendment or an explicit exemption before they ship.

**Delivering milestones** — `M-085` (all four processors).

## 9. Top three failure modes (`NFR-MNT-09`)

The three below are the ones declared for `reviews/` in `PROJECT_CONSTITUTION.md` §18.5.1. They are
binding; the signals are named here so the milestone that builds each one has a target.

|  #  | Failure mode                              | Signal                                                                                                                                                                       | First action                                                                                                                                                                                                                                                                                                                                                   |
| :-: | :---------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **Aggregation lag after moderation**      | `gym.review.aggregate_lag_seconds` breaching the `AC-REV-02.3` 60 s budget; `ALRT-21`/`ALRT-22` on `job_name="review.aggregate"`; `ALRT-21B` if the outbox itself is stalled | Establish whether the aggregate is stale or _frozen_: check `outbox_oldest_unpublished_age_seconds` for `review.*` before touching the job. A stalled dispatcher is a platform incident wearing a reviews costume                                                                                                                                              |
|  2  | **Screening unavailable**                 | Reviews accumulating in `SUBMITTED` rather than resolving to `PUBLISHED` or `HELD`; `review_moderation_queue_depth` climbing without a matching moderation decision rate     | Confirm the active lexicon version recorded on `screening_result` matches `rel.reviews.screening_lexicon_version`. Do **not** publish unscreened reviews to clear a backlog — `BR-REV-04` has no fast path                                                                                                                                                     |
|  3  | **Anomaly-detector false-positive burst** | `review_anomalies_flagged_total{signal}` spiking on one `signal`; `ALRT-35b` (`review_moderation_queue_depth > 50` for 4 h, or oldest item > 48 h)                           | Identify whether one tenant dominates the flags. A genuine post-campaign burst of twenty honest reviews looks exactly like an attack (`M-085` AC 7); the merge gate exists because that case must pass un-flagged. Turning `rel.reviews.anomaly-detection` off stops new flags and clears none — held reviews stay queued for a human, which is the safe state |

> **On failure mode 2, stated precisely.** §18.5.1 words it as _"screening provider unavailable"_. The
> `M-084` design has **no external screening provider**: the five detectors run in-process against
> versioned lexicon **data files**, tunable without a deployment. The declared mode therefore cannot
> occur as written; the live equivalent is a missing, corrupt or mis-versioned lexicon, and the
> `screening_result` document records the version so any decision is reproducible. Do not read the
> absence of the provider as the absence of the failure mode.

**Runbook:** [`/docs/runbooks/reviews.md`](../../../../docs/runbooks/reviews.md)
