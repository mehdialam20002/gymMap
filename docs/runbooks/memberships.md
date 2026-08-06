# memberships runbook

> `NFR-MNT-09`: *"Every module has a runbook covering its top three failure modes."*
> Owner: **Backend Lead (memberships)** · Primary alerts: `ALRT-22` (expiry job dead-man), `ALRT-24`
> (check-in denial anomaly) · Module README:
> [`apps/server/src/memberships/README.md`](../../apps/server/src/memberships/README.md)
>
> **Status: stub.** No code exists in `apps/server/src/memberships/` yet. The failure modes below are
> the three declared in `PROJECT_CONSTITUTION.md` §18.5.1 and are binding; the dashboards, queries and
> mitigations are named but not yet verified against a running system.

## Scope

`memberships/` owns the state of every membership on the platform — the six states of `BR-MEM-01`,
the fifteen transitions of `§C4.1`, the freeze window that extends `end_date`, the renewal that
creates a *new* membership rather than reactivating the old one, and the five `§C5` jobs that move
memberships between states on schedule in **the gym's own timezone**. It owns `memberships`,
`membership_events` (append-only) and `freezes`. When this module is wrong, four audiences disagree
at once: the member sees one status in the app, the gym sees another on `SCR-DASH-008`, the door
admits or refuses on a third, and the ledger settles against a fourth. That simultaneity is why
`§B5.12` calls the membership *the product* and why every failure below is at least S2.

## Top failure modes

| Signal | Likely cause | First action | Escalation |
| :--- | :--- | :--- | :--- |
| **1. Expiry job missed its window in a timezone.** `ALRT-22` dead-man on `job_name="membership.expire"` (no success in 2× the hourly interval), or `job_items_processed_total` flat for three consecutive runs. Second-order: `ALRT-24` shows an expiry-denial cohort that never arrives, and expired members are admitted at the door | A naive whole-hour UTC cron cannot express local midnight at `Asia/Kolkata` `+05:30` (`LAUNCH_MARKET_INDIA.md` §3). Or a dead lock holder still holds `membership.expire:{zone}:{localDate}`. Or the zone bucketing was written per **tenant** instead of per **zone**, so two tenants in one zone fight for one lock | Read the scheduler tick's deterministic correlation id (`Monitoring.md` §2.4) and confirm the tick fired at local midnight, not 00:00 UTC. Then inspect the distributed lock for the affected `{zone}:{localDate}` and release it only if the holder is provably dead. Re-run the job for the missed zone/date — it is idempotent by construction | Money and membership jobs **page on-call** (`ALRT-21`/`ALRT-22`). Gym-visible: yes. Unresolved at 1 h → Technical Lead |
| **2. Activation not triggered by capture.** `ALRT-24` with `denial_reason = MEMBERSHIP_NOT_FOUND` (**S1**), typically preceded by `ALRT-10` (webhook lag > 120 s) or `ALRT-21B` (outbox oldest unpublished > 300 s). Members have paid and hold no membership — **invariant 5 is breaking** | Razorpay stopped delivering (`ALRT-11` dead-man), the receiver is returning non-2xx, the `payments` queue is backed up (`ALRT-20`), or the `payment.captured` outbox row is stuck behind a poisoned handler | Diagnose strictly in chain order — the fix is different at each link: (a) Razorpay dashboard delivery log and endpoint status; (b) our webhook receiver's response codes; (c) `SELECT event_type, count(*), min(created_at) FROM outbox WHERE published_at IS NULL GROUP BY 1 ORDER BY 3;` — one dominant `event_type` is a poisoned handler, a flat spread is the dispatcher; (d) `payment.reconcile` is the stopgap that recovers stranded payments. **Never activate a membership by hand from a client success signal** — `BR-PAY-02` has no exception | Page on-call **and** Finance. Members who paid and were refused at a desk are notified by us first, not by the gym |
| **3. Freeze extension miscomputed.** A `freezes` row whose `days_count` does not equal the shift in `memberships.end_date`; or `freeze_days_used` disagreeing with `SUM(freezes.days_count)` for the term; or a freeze accepted retroactively or more than 30 days ahead (`BR-MEM-07`) | Elapsed-hours arithmetic instead of **whole calendar days in the gym's zone**; the `+05:30` offset applied on one side of the interval only; or the `BR-MEM-07` bounds evaluated against server time rather than `todayIn(zone)`. The constitution names *"across DST"* as the cause — see the note below | Recompute the interval in the gym's zone with `daysBetweenInZone`. Correct by **appending a compensating freeze record**, never by editing the original — `freeze_days_used` has zero permitted staleness and an edit destroys the evidence. Then check whether the same membership was expired by mode 1 while frozen (`BusinessRules.md` §18.1) | Ticket to Backend Lead (memberships). Escalate to S2 if more than one tenant is affected, because that indicates the arithmetic, not one bad row |

> **On failure mode 3 and DST.** `PROJECT_CONSTITUTION.md` §18.5.1 states the mode as *"freeze
> extension miscomputed across DST"*. The launch market is India and **`Asia/Kolkata` observes no
> DST** — the stated cause cannot occur here. Treat the mode as *"freeze extension miscomputed"*: the
> live risks are the half-hour offset and calendar-day-versus-24-hour-period counting. Do not let the
> absence of DST be read as the absence of the failure mode.

## Dashboards and queries

_To be populated by **M-067** (the two zone-bucketed jobs and their lock keys) and **M-068** (the
reminder ladder and auto-renewal), with the freeze arithmetic panels added by **M-064** / **M-065**._

Intended content, named now so the milestones have a target:

- **Job health panel** — `job_duration_seconds{job_name=~"membership\\..*"}` against each job's
  declared envelope, `job_outcomes_total` split by `outcome` (`SUCCEEDED`, `FAILED`,
  `SKIPPED_LOCK_HELD`, `SKIPPED_NOTHING_TO_DO`, `DEAD_LETTERED`), and `job_last_success_timestamp_seconds`
  **per timezone bucket** — a single platform-wide "last success" hides exactly the failure mode 1 is.
- **Expiry cohort reconciliation** — the count of memberships due to expire on a given IST date,
  against the count actually transitioned, against the `MEMBERSHIP_EXPIRED` denial count at the door.
  The three should agree; `ALRT-24`'s runbook step is this comparison.
- **State-distribution panel** — memberships by `§C4.1` status, feeding `KPI-08` (active memberships,
  target 25,000). `FROZEN` is excluded from `ACTIVE` and reported alongside it: freeze is a retention
  tool, not churn.
- **Transition-journal query** — the timeline for one membership from `membership_events` ordered by
  `occurred_at`, with `from_status`, `to_status`, `reason`, `actor_type` and `financial_reference_id`.
  This is the first thing a dispute needs and the reason the table is append-only.
- **Counter-drift query** — `memberships.freeze_days_used` versus `SUM(freezes.days_count)`, and
  `memberships.sessions_used` versus the `attendance` rows with `decremented_entitlement = true`.
  Both are declared zero-staleness counters (`Schema.md` §8.1); a non-zero difference is a P1
  incident, not a nightly correction job.
- **Outbox lag by event type** for `membership.*`, so a stalled `membership.renewal-due` is visible
  before `KPI-12` (renewal rate ≥ 55%) moves.

## Known incidents

_None yet._
