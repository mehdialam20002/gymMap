# catalog runbook

> **Status: stub.** `NFR-MNT-09` requires a runbook per module covering its top three failure modes.
> The three below are fixed by `PROJECT_CONSTITUTION.md` §18.5.1. The eight-field per-mode structure
> of `Monitoring.md` §9.1 — symptom, alert, blast radius, diagnose, mitigate, fix, verify, prevent —
> is filled in by the milestones named under **Dashboards and queries**; `RB2` requires every query
> here to have been **run**, and none can be before the tables exist.
>
> **Filename conflict, unresolved.** `Monitoring.md` §9.6 names this runbook `catalog-media.md`;
> `FolderStructure.md` §8.3 row 9 requires `/docs/runbooks/<module>.md`. This file follows
> `FolderStructure.md` so the module `README.md` link resolves. One owner decision settles it for all
> twenty-three modules (`DECISION_LOG.md`, `CLAUDE.md` §9.3).

## Scope

`catalog/` owns the tenant's public identity and physical footprint: `gyms`, `branches`,
`branch_hours`, `branch_hour_exceptions`, `gym_amenities`, `gym_media`. It owns the only
`geography(Point,4326)` in the system — one column behind one GiST index serving radius search,
nearby, comparison and the `BR-GYM-08` approval check. It owns the single `OperatingHours` evaluator
that answers *"is this branch open at instant t, in its own IANA zone"*, with dated exceptions always
beating weekday windows. It owns `gyms.status`, the listing switch, which it may set to `APPROVED`
only on `application.approved` from `onboarding/` (`BR-GYM-03`). It owns the `MaterialFieldRegistry`
that decides `BR-GYM-06` (return to review) versus `BR-GYM-07` (publish immediately) — one enumerated
list and its computed complement, never two lists. It owns one `§C5` job, `gym.freshness-score`
(job 14, nightly, P3), and the non-`§C5` media rendition processor.

Seven modules read it: `plans/`, `staff/`, `ordering/`, `attendance/`, `memberships/`, `reviews/` and
`discovery/`, through `BRANCH_QUERY_PORT`, `GYM_STATUS_PORT`, `GYM_TIMEZONE_PORT`,
`OPERATING_HOURS_PORT`, `GYM_QUERY_PORT` and `GYM_SEARCH_VIEW_PORT`.

**Blast radius when this module is down.** Reads are widely cached and the search path is served from
`discovery/`'s projection, not from these tables — so the marketplace keeps working with the data it
last projected. What stops: profile and branch edits, media upload, hours changes, and the two
synchronous questions that sit on latency-budgeted paths. `attendance/` asking
`OPERATING_HOURS_PORT` at check-in step 5 is inside the `NFR-PERF-03` 2 s budget, so a slow catalog
is a **queue at the desk at 07:00**, which `NFR-AVL-02` ranks as one of the last things allowed to
degrade. That single edge is why some failures here escalate above their apparent severity.

**Kill switches** (`ADR-0026`): media upload and the rendition pipeline are flaggable — degrading to
"photographs unavailable" is survivable. **Not flaggable:** the `gyms.status` gate (`BR-GYM-01`,
invariant `I4`), the `MaterialFieldRegistry` (`BR-GYM-06` is a compliance obligation, not a feature),
and the description sanitiser (`NFR-SEC-05` sanitises on **write**; the column never holds raw
input, so there is nothing to switch off at read time).

## Top failure modes

| Signal | Likely cause | First action | Escalation |
| :--- | :--- | :--- | :--- |
| **1 — Media pipeline backlog.** `queue_depth{queue="media"}` above the 500 envelope, or `queue_oldest_job_age_seconds` above 600 s, for 15 m (**`ALRT-20`**, S2). Owners see photographs stuck at "processing"; new listings cannot meet `BR-GYM-02`'s three-photograph minimum and stall in the verification queue | Worker deaths (not volume); an upload burst after a marketing push; object storage or the virus scanner degraded; a decode hitting the pixel/memory cap repeatedly on retry | Check workers **before** volume: `queue_active_workers == 0` with `queue_depth > 0` always pages, and is a different incident from a deep-but-draining queue. Then Bull Board (`A-30`, admin-only) → is one job type dominating? A single oversized or malformed upload must **not** block the queue — the failure path marks the row degraded and keeps the original; if it is blocking, that path is broken and is the real defect | Ticket to Backend Lead (catalog); DevOps if workers are absent. Notify Operations if the backlog is feeding the `ALRT-35a` verification queue |
| **2 — Geocode drift beyond tolerance.** `branches.geo_tolerance_metres` exceeding the configured tolerance on new submissions; a `FLAG` spike on `onboarding/`'s `geo-distance` pre-check | The geocoding provider changed its results; the tolerance configuration was edited; an address-normaliser regression against the committed 200-Indian-address fixture corpus | Establish scale first. Many submissions drifting at once is a **provider or configuration** change, not forty owners simultaneously dropping bad pins — re-run the check against the fixture corpus, which exists precisely so a regression is visible. Approval over the flag remains possible with a recorded override reason (`BR-GYM-08`, `AC-ONB-02.3`); it is never auto-rejected | Ticket to Backend Lead (catalog). If the tolerance configuration was changed, that is an `admin/` blast-radius question and goes to the Technical Lead — the change is audited and reason-required (`FR-ADMN-02`) |
| **3 — Search reindex lag after a profile edit.** `search_index_lag_seconds > 300` for 10 m (**`ALRT-36`**, S2); `search_reindex_lag_seconds` alerts at 60 s and escalates at 300 s (`PF2`). Symptom: an owner edits a price or suspends, and the marketplace still shows the old value | The job is owned by `discovery/`, but the cause is usually here: an event that should invalidate a document and is **not** in M-043's eleven-entry `reindex-trigger.registry`; or an outbox row never written because the publish happened outside the transaction (`E2`) | Work backwards, not forwards. (a) Did the emitting transaction write its outbox row? (b) Is the event in the trigger registry? Only then (c) look at the processor. Fixing the processor for a missing trigger produces a green job and a stale index | Ticket to Backend Lead (discovery) with Backend Lead (catalog) on the trigger question; page if lag exceeds 15 m. **A stale price shown to a customer is a defect, not a UX inconvenience** (`A3.4` principle 2, `RSK-11`), even though `BR-PLN-03`'s checkout re-validation catches it before money moves |

## Dashboards and queries

_To be populated by **M-033** (the media pipeline and its queue panels), **M-034** (the operating-hours
evaluator), **M-035** (the material-field registry) and **M-043** (reindex lag, jointly with
`discovery/`)._

Intended content, named now so those milestones have a target:

- **Panel — media pipeline.** `queue_depth{queue="media"}`, `queue_oldest_job_age_seconds`,
  `queue_active_workers`, and rendition outcomes split `OK` / `DEGRADED` / `REJECTED`, with the
  rejection reason (`magic-bytes mismatch`, `virus`, `decode cap`, `size ceiling`). The `ALRT-20`
  envelope drawn as a threshold line.
- **Panel — listing integrity.** Count of `gyms` by `status`; `discovery_unverified_listing_leaks_total`
  (must be **zero** — the `ALRT-28` synthetic probe, invariant `I4`); and the count of `APPROVED`
  gyms with no row in `search_documents`, which is the same defect seen from the other side.
- **Panel — geo health.** Distribution of `branches.geo_tolerance_metres` against the configured
  tolerance, and the `geo-distance` pre-check `PASS`/`FLAG`/`ERROR` split shared with the
  `onboarding` runbook.
- **Panel — freshness.** `gym.freshness-score` job outcome and duration against its 10 s / 100 s
  envelope, plus the distribution of `gyms.freshness_score` — a distribution collapsing toward the
  demotion threshold is a supply-quality signal for Product, not an ops alert.
- **Query — approved gyms missing from the projection.** Read-only, `LIMIT`-bounded, joins `gyms`
  and `branches` against `search_documents` on `branch_id` under the `PublicVisibilityPredicate`'s
  five conditions. This is the diagnostic for failure mode 3 and the verification that recovery is
  real.
- **Query — split-hours and midnight-crossing sanity.** Lists branches whose `branch_hours` rows
  imply a crossing that was stored as `opens_at > closes_at` (which must never exist) or whose
  weekday has zero rows while the branch is `ACTIVE` — zero rows means **closed**, so this query
  distinguishes "genuinely shut on Sundays" from "hours never entered".
- **Query — material-field edits awaiting review.** Gyms with an open `BR-GYM-06` re-review, with
  the changed field set, so the pair of modules can be reconciled: the change is here, the review
  state is in `onboarding/`.
- **Data recovery note.** `gyms`, `branches`, `gym_media` and the hours tables are soft-deleted
  (`deleted_at`), so recovery is an unset, not a restore. `gym_media` renditions are **derived** and
  can always be regenerated from the stored original — losing a rendition is never data loss.
  `search_documents` holds no fact that does not exist here, so a drop-and-rebuild of the projection
  is always a safe recovery (M-042 rollback plan, M-043 backfill).

## Known incidents

_None yet._
