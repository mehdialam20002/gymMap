# reviews runbook

> `NFR-MNT-09`: *"Every module has a runbook covering its top three failure modes."*
> Owner: **Backend Lead (reviews)** · Primary alerts: `ALRT-35b` (moderation queue depth), `ALRT-21` /
> `ALRT-22` (`review.aggregate` failure and dead-man), `ALRT-28` (invariant **I4**, adjacent) ·
> Module README: [`apps/server/src/reviews/README.md`](../../apps/server/src/reviews/README.md)
>
> **Status: stub.** No code exists in `apps/server/src/reviews/` yet. The failure modes below are the
> three declared in `PROJECT_CONSTITUTION.md` §18.5.1 and are binding; the dashboards, queries and
> mitigations are named but not yet verified against a running system (`RB2`, `RB3`).

## Scope

`reviews/` is the trust layer, and `§B5.16` states its governing trade-off in one line: *"its
integrity is worth more than its volume."* It owns the three tables `reviews`, `review_responses` and
`review_reports`; the `§C4.6` publication machine; the five-detector screening pipeline whose only
outcomes are `PASS` and `HOLD`; the moderation decisions of `FR-REV-07`; and the single `(sum, count)`
pair from which both the publicly displayed mean (`rating_avg`) and the private ranking figure
(`rating_bayes`) derive. Two properties define the blast radius. First, no tenant principal anywhere
in the system can alter or delete a member's review — the database role holds no `UPDATE` or `DELETE`
privilege and no OpenAPI operation exists that would use one — so a reviews incident is never a
data-loss incident for review content. Second, the aggregate this module publishes is projected onto
`gyms`, which feeds search ranking; a wrong number here is visible on every search result card for
that gym. `BR-REV-07` withholds a rating entirely below three published reviews, so the boundary
between "no number" and "a wrong number" is three rows.

## Top failure modes

| Signal | Likely cause | First action | Escalation |
| :--- | :--- | :--- | :--- |
| **1. Aggregation lag after moderation.** A moderator publishes, unpublishes or removes a review and the gym's star rating does not move within the `AC-REV-02.3` sixty-second budget. `gym.review.aggregate_lag_seconds` past 60 s; `ALRT-21` on `job_name="review.aggregate"`; `ALRT-22` dead-man if the nightly rebuild has not succeeded in 2× its interval; `ALRT-21B` if the outbox itself is behind | The `review.aggregate` job is failing, contending on `review.aggregate:gym_{id}:{changeSeq}` behind a dead lock holder, or — far more often — the outbox dispatcher is stalled and *every* projection in the system is behind, not just this one. A third cause is the aggregate being frozen rather than lagging: `ops.reviews.publication` off freezes aggregates by design | **Check `outbox_oldest_unpublished_age_seconds` before touching the job.** `SELECT event_type, count(*), min(created_at) FROM outbox WHERE published_at IS NULL GROUP BY 1 ORDER BY 3;` — a dominant `review.*` row is a poisoned handler, a flat spread across event types is the dispatcher and this is `ALRT-21B`, not a reviews incident. Then confirm the flag state before assuming a fault. Re-running `review.aggregate` is safe: ADR-0017 requires an aggregation handler to recompute from source rather than increment | Ticket to Backend Lead (reviews). Escalate to S2 if the lag spans more than one tenant, because that points at the dispatcher. A frozen aggregate is loud rather than silent only because the nightly reconcile survives independently — if that job is also down, treat the incident as S2 immediately |
| **2. Screening unavailable or mis-versioned.** Reviews accumulate in `SUBMITTED` instead of resolving to `PUBLISHED` or `HELD`; members receive `201` and see nothing appear; `review_moderation_queue_depth` climbs with no matching decision rate | The active screening lexicon version does not resolve, or `rel.reviews.screening_lexicon_version` points at a version that was never shipped. **Note the design:** `M-084` runs the five detectors in-process against versioned lexicon **data files** — there is no external screening provider, so the mode as worded in §18.5.1 cannot occur here | Read the `screening_result` document on a stuck review: it records the active lexicon version, which is what makes any decision reproducible. Compare against the flag. **Do not publish unscreened reviews to clear the backlog** — `BR-REV-04` has no fast path, and the union type has no `REJECT` member precisely so that automated judgement can never be final. Holding costs a moderator seconds; the alternative destroys a genuine member's account of their experience | Ticket to Backend Lead (reviews). If a lexicon file is missing from the deployed artefact, that is a build/packaging incident and goes to DevOps as well |
| **3. Anomaly-detector false-positive burst.** `review_anomalies_flagged_total{signal}` spikes on one signal; `ALRT-35b` fires (`review_moderation_queue_depth > 50` for 4 h, or the oldest item older than 48 h). Genuine reviews are held and excluded from the aggregate, so a gym's rating stops moving during its best week | The four signals — rating velocity, reviewer account age, text clustering, shared-device/network — flag on **any two**, and a genuine post-campaign burst trips velocity and account-age together. `RSK-02` scores this 16, and `M-085` AC 7 makes the false-positive case a **merge gate** for exactly this reason | Determine whether one tenant dominates the flagged set and whether the burst has a campaign behind it. Clearing a hold is a moderation decision and is audited; **do not bulk-clear**. Turning `rel.reviews.anomaly-detection` off stops new flags and clears none — held reviews stay queued for a human, which is the safe state and the specified rollback | Ticket to Operations for the queue, Backend Lead (reviews) for the thresholds. Thresholds live in `FEATURE_FLAGS.md` as configuration, not constants, so a retune is a config change and not a release |

> **On `ALRT-28` and this module.** `discovery_unverified_listing_leaks_total` is `catalog/` and
> `discovery/`'s alert, but it and `review_rejected_total{reason="NO_CHECK_IN"}` are the two signals
> of invariant **I4**. `review_rejected_total{reason="NO_CHECK_IN"}` **going to zero** is a finding,
> not good news: it means the earned-review gate stopped being reached, and the most likely cause is
> that the `result = 'ALLOWED'` predicate was dropped from the eligibility test.

## Dashboards and queries

_To be populated by **M-085** (aggregation, moderation and the anomaly scan), with the screening
panels added by **M-084** and the eligibility panels by **M-083**._

Intended content, named now so the milestones have a target:

- **Aggregate freshness panel** — time from a `§C4.6` status change to the corresponding
  `gyms.rating_avg` write, p50/p95/max, against the 60 s `AC-REV-02.3` budget; plus
  `job_last_success_timestamp_seconds{job_name="review.aggregate"}` for the nightly rebuild.
- **Aggregate drift query** — the nightly reconcile's recomputation against the stored
  `rating_avg`/`rating_count`/`rating_bayes` per gym, ordered by absolute correction.
  `gym.reviews.aggregate_drift` above **0.05** on any gym pages the on-call; a frozen aggregate shows
  up here even when the consumer is silent.
- **Exclusion-set audit** — the count of reviews in `HELD`, `UNPUBLISHED`, `REMOVED` and un-cleared
  anomaly states per gym, next to `rating_count`. One predicate defines the exclusion set for both
  the consumer and the reconcile; this panel is how a second predicate would be caught.
- **Below-three panel** — gyms with one or two published reviews, and gyms that crossed back below
  three after a moderation action. `BR-REV-07` returns `null`, not `0`, and the sharp edge is
  documented as working-as-specified; the panel exists so support can answer the question.
- **Screening outcome split** — `PASS` versus `HOLD` by detector and by lexicon version, with the
  India fixtures (Devanagari, Hinglish, `+91`, bare 10-digit, `wa.me`, UPI VPA) tracked separately.
  A detector whose hold rate moves after a lexicon bump is the signal that a bump went wrong.
- **Moderation queue age histogram** — feeding `ALRT-35b`, split by whether the item arrived from
  screening or from the anomaly scan. They are different queues of work with different urgencies.
- **Eligibility funnel** — `review_rejected_total{reason}`, `GET …/reviews/eligibility` outcomes, and
  submissions, against `KPI-13` (≥ 20% of members submitting within 45 days of activation).

## Known incidents

_None yet._
