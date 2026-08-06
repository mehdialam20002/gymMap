# attendance

**Charter (PRD §C1.3):** _tokens, check-in validation, attendance records, analytics._

---

## 1. Bounded context

`attendance/` owns one decision no other module may take: **may this person enter this branch, right
now, and what is the single reason if not.** That decision is the ten-step ordered sequence of
`FR-CHK-04`, evaluated **first-failure-wins**, returning exactly one of the fifteen `§C4.8` denial
reason codes. The module owns the QR token that carries the claim (issued, signed with a `kid`-named
Ed25519 key, valid for 60 seconds against **server** time only — a scanning device's clock is never
trusted), and it owns the immutable record of the attempt whether it succeeded or not: `BR-CHK-10`
requires a _denied_ check-in to be recorded, because a member turned away at a desk is the event a
dispute is about. What it emphatically does not own is entitlement — it asks `memberships/`
_"is there a live entitlement at this branch?"_ and accepts the answer. `ModuleDependency.md` §4.2
names the tempting alternative and forbids it: `attendance → ordering` to check the order was not
refunded is upward-legal but wrong, because `memberships/` already reflects a refund as `REFUNDED`
and two paths to the same answer will eventually disagree.

## 2. PRD identifiers

| Class                       | Identifiers                                                                                                                                                                                                                                                                   |
| :-------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional                  | `FR-CHK-01` … `FR-CHK-14` (`§B5.13`). `FR-CHK-13` heatmap and `FR-CHK-14` daily digest are descoped **D-09** to Sprint 13.                                                                                                                                                    |
| Business rules **owned**    | `BR-CHK-01` … `BR-CHK-07`, `BR-CHK-09`, `BR-CHK-10`; `BR-CHK-08` co-owned with `staff/`; `BR-MEM-06` (a `FROZEN` membership denies check-in — owned **here**, not in `memberships/`)                                                                                          |
| Business rules **co-owned** | `BR-PLN-06` (+`plans/`, +`memberships/`) session allowance and access window; `BR-MEM-13` (+`memberships/`) sharing suspends rather than cancels                                                                                                                              |
| Business rules **consumed** | `BR-TEN-01`, `BR-TEN-05` (a `SUSPENDED` tenant must **not** block check-in — see `CR-05`), `BR-REV-01` (this module is the evidence source), `BR-DAT-06` (the token payload carries no personal datum)                                                                        |
| Non-functional              | **`NFR-PERF-03`** p95 ≤ 2 s at the desk (`AC-CHK-01.1`), `NFR-PERF-08` 500 scans/min platform-wide, `NFR-SCAL-01` 18.25 M rows in Y1, `NFR-SCAL-06` partitioning, `NFR-AVL-02` (check-in is one of the last two things to degrade), `NFR-MNT-09`, `NFR-SEC-07` (key material) |
| State machine               | None of its own. `attendance` rows are **immutable facts, not a state machine** (`BR-CHK-09`); a correction is a second row pointing at the first via `corrects_attendance_id`. The states it reads are `§C4.1`.                                                              |
| Reason taxonomies           | `§C4.8` **check-in denial** (15 codes) and `§C4.8` **check-in override** (7 codes)                                                                                                                                                                                            |
| Jobs                        | **`§C5`** — `attendance.auto-checkout`, `attendance.sharing-scan`                                                                                                                                                                                                             |
| API                         | `API-CHK`; the `GET /me/attendance` row of `API-MEMB`                                                                                                                                                                                                                         |
| Screens served              | `SCR-DASH-009` (the desk), `SCR-DASH-010` (attendance log), `SCR-DASH-001` (live counters), `SCR-WEB-010` (member visit history)                                                                                                                                              |
| Acceptance                  | `AC-CHK-01.1` … `-01.5`, `AC-CHK-02.1` … `-02.3`; `E2E-03` and `E2E-04`                                                                                                                                                                                                       |

## 3. Owned tables

_Planned. No code in this module yet - populated by the milestones listed below._

| Table        | Grants / class                                                                                                                                 | Why it is shaped this way                                                                                                                                                                                                                                                                                                                                                    | Source           |
| :----------- | :--------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- |
| `attendance` | RLS · P-STD **re-applied per partition** · R-OPS with the review carve-out · **G-COMPLETE** · **monthly range-partitioned on `checked_in_at`** | The largest table in the system: 18.25 M rows and 5.9 GB in Y1, 182.5 M/yr at 10×, largest single monthly partition ~15.5 M rows. Primary key is **`(checked_in_at, id)`** because PostgreSQL requires the partition key in every unique constraint; UUIDv7 keeps the composite near-monotonic so the PK index and the partition key agree on ordering rather than fighting. | `Schema.md` §8.3 |

One table, and that is the whole set. Three things it does **not** own and must not acquire:

- **`memberships.sessions_used`.** The `ALLOWED` path decrements it in the same transaction as the
  insert, but through `MEMBERSHIP_COMMAND_PORT.consumeSession` — the only way this module mutates a
  membership. The column belongs to `memberships/`.
- **The live occupancy counter.** A Redis counter per `(tenant_id, branch_id)`, rebuilt from
  `attendance` every 5 minutes. It is a **cache, never a source**, and the rebuild reports its own
  correction (`gym.attendance.occupancy_drift`) rather than silently fixing itself.
- **The Ed25519 signing keys.** Two slots, `current` and `previous`, in the managed secret store with
  a configured overlap window. No key material in `.env`, none in the image; a start-up assertion
  fails fast if the secret is absent rather than generating a key (`NFR-SEC-07`).

Two properties of the table that are load-bearing and easy to lose:

- **`membership_id` is nullable.** A denied scan with `TOKEN_INVALID` has no resolvable membership,
  and `BR-CHK-10` still requires the record.
- **The `token_nonce` weakening is deliberate and recorded.** A global `UNIQUE (token_nonce)` is not
  creatable on a partitioned table, and `UNIQUE (checked_in_at, token_nonce)` does not express
  _"unique within TTL"_. Nonce uniqueness is therefore enforced by **Redis `SET NX` with the token's
  60-second TTL as the primary synchronous gate** — returning the _original_ attendance record on
  collision, which is exactly what `BR-CHK-06` and `AC-CHK-01.4` ask for — with the per-partition
  unique index as the second line. The only arithmetically possible gap is 60 seconds astride a month
  boundary, and the Redis gate covers it (`Schema.md` §8.3).

**Retention carve-out.** Attendance rows that a `PUBLISHED` review depends on cannot be purged, or
`BR-REV-01`'s verified-member marker becomes unprovable. The purge job excludes `(user_id, gym_id)`
pairs with a published review. This is a real coupling between the Trust and Attendance domains
(`Schema.md` §8.3, open item O-5).

**Delivering milestones.** **M-069** creates `attendance` **partitioned by month from its very first
migration** — the partitioning is not retrofitted — with RLS, grants and the module skeleton
(`attendance.module.ts`, `index.ts`, `README.md`, `permissions.ts`). **M-070** adds the token and key
set; **M-071** the verifier and Redis nonce; **M-072** steps 1–6; **M-073** steps 7–10 and the
entitlement decrement; **M-074** manual check-in, override, check-out and reversals; **M-075** the two
`checkin.recorded` consumers.

## 4. Public surface

_Planned. No code in this module yet - populated by the milestones listed below._

`ModuleDependency.md` §7.4 publishes this module's `index.ts` as **the** worked example of the
enforced shape — four export statements, no more:

| Exported symbol                                            | Kind                                                      | Consumers                                           |
| :--------------------------------------------------------- | :-------------------------------------------------------- | :-------------------------------------------------- |
| `ATTENDANCE_QUERY_PORT`, `type AttendanceQueryPort`        | **Question port** — `hasCheckInAtGym(): Promise<boolean>` | `reviews/` (`BR-REV-01`, invariant 4), `reporting/` |
| `type CheckInEvaluationView`, `type AttendanceSummaryView` | Read models owned here                                    | `reporting/`, `support/`                            |
| `type CheckInRecordedPayload`                              | Event payload type                                        | `reviews/`, `crm/`, `reporting/`                    |
| `ATTENDANCE_PERMISSIONS`                                   | Permission constants, `attendance.<resource>.<action>`    | `iam/`, `admin/` (`FR-RBAC-05`)                     |

`hasCheckInAtGym()` is the canonical **question port**: it answers a question rather than exposing
attendance rows, which is what lets `reviews/` enforce the earned-review gate without ever being able
to read a member's visit history. A `listAttendance()` on this port would be the boundary error.

Controllers exist here — `attendance/` is not one of the four provider-only modules of
`FolderStructure.md` §8.2. Planned: the scan/manual/override/check-out controller (`API-CHK`), the
attendance-log controller, and `live-attendance.controller.ts` exposing
**`GET /v1/tenant/attendance/live` and nothing else**, whose response carries a mandatory
`generated_at` so the dashboard can say _"updated N seconds ago"_ honestly. Phase 1 is **polling at
10–15 s**, not sockets: `A-08` / ADR-0010 are settled, no realtime-transport package may appear in
`package.json`, and `release.attendance.realtime_transport` exists only to record the Phase-2 seam.

**Delivering milestones.** M-069 declares `attendance-query.port.ts` (consumed by `crm/` and
`reviews/`); M-075 adds the live endpoint.

## 5. Consumed ports

_Planned. No code in this module yet - populated by the milestones listed below._

The ten-step sequence is a latency budget as much as a rule set: `NFR-PERF-03` gives the whole desk
interaction 2 s at p95, so every port below must answer **inside one request**, and steps that can be
cached are cached explicitly.

| Port                                                 | Provider       | Step          | Why the answer must be synchronous                                                                                                                                                                      |
| :--------------------------------------------------- | :------------- | :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MEMBERSHIP_QUERY_PORT` (§3.2 row 22)                | `memberships/` | 3–4           | _Is there a live entitlement at this branch, right now?_ A stale answer admits an expired member or refuses a paid one. There is no compensating action for a door.                                     |
| `BRANCH_QUERY_PORT`, `OPERATING_HOURS_PORT` (row 23) | `catalog/`     | 5–6           | Is this branch open now, in its own timezone, accounting for a dated closure exception? `GYM_CLOSED_EXCEPTION` and `OUTSIDE_OPERATING_HOURS` are different denial reasons and the member is told which. |
| `ACCESS_WINDOW_PORT` (row 24)                        | `plans/`       | 7             | The plan's access window (`BR-PLN-06`, denial reason `OUTSIDE_PLAN_ACCESS_WINDOW`).                                                                                                                     |
| `STAFF_QUERY_PORT` (row 25)                          | `staff/`       | override path | Override authority and branch scope (`BR-CHK-08`, `FR-STAF-03`). A staff member may not override at a branch they are not assigned to.                                                                  |
| `MEMBERSHIP_COMMAND_PORT.consumeSession`             | `memberships/` | 10            | The entitlement decrement commits in the same transaction as the insert.                                                                                                                                |
| `common/` — `Clock`, idempotency, outbox, `Money`    | `common/`      | all           | Universal edge (§3.1). **Validation uses server time exclusively.**                                                                                                                                     |
| `tenancy/`, `audit/`                                 | —              | all           | Universal edges.                                                                                                                                                                                        |

`branch_hours` is read through a **Redis cache with a 5-minute TTL invalidated by an event**, not by
TTL alone — two cached reads is the entire step-7 budget.

**Forbidden and worth stating.** `attendance → crm` is **▲ event-only** and `attendance → ordering`
is **—**. Neither the at-risk flag nor the refund status may be reached synchronously from the door.

## 6. Emitted events

_Planned. No code in this module yet - populated by the milestones listed below._

| Event                          | Payload beyond `tenant_id` / `occurred_at`              | Known consumers                                                                                                                                           |
| :----------------------------- | :------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkin.recorded`             | `attendance_id`, `membership_id`, `branch_id`, `method` | `reviews/` (opens `BR-REV-01` eligibility), `crm/` (clears `risk_flagged_at`, `AC-CRM-01.3`), `reporting/`, and this module's own live-occupancy consumer |
| `checkin.denied`               | `membership_id`, `branch_id`, `denial_reason`           | `crm/`, `reporting/`                                                                                                                                      |
| `attendance.sharing-suspected` | `membership_id`, `signal`                               | `memberships/` (`BR-MEM-13` — sets `under_review_since`), `notifications/`                                                                                |

Source: `ModuleDependency.md` §8.2. `Architecture.md` §10 records the same first event as
`checkin.recorded` with payload `attendanceId`, `branchId`, `result`, `denialReason?` — i.e. one event
covering both outcomes rather than two. The §8.2 two-event split is used above because it is the
document that also declares the idempotency keys; the variance is flagged for `DECISION_LOG.md` and
must be settled before M-073 writes the outbox payload.

**`attendance.sharing-suspected` flags and never blocks.** There is no code path from a sharing signal
to a denial, and that absence is asserted structurally by `dependency-cruiser`: the sharing consumer
has no import reaching the validation sequence. A member who trains at two branches in one day is
ordinary; a family sharing one QR is not; the evaluator cannot tell them apart from a single signal,
which is why two signals are required and why the outcome is a flag on a staff screen rather than a
locked door.

## 7. Consumed events

_Planned. No code in this module yet - populated by the milestones listed below._

| Event                                       | Publisher       | Handler idempotency key            | Why this module cares                                                                                                                                                          |
| :------------------------------------------ | :-------------- | :--------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `membership.activated`                      | `memberships/`  | `membership_id` + `activation_seq` | Warms the entitlement view the desk hits at step 3 and invalidates any negative cache for that member.                                                                         |
| `membership.frozen` / `membership.unfrozen` | `memberships/`  | `freeze_id`                        | `BR-MEM-06` — a `FROZEN` membership denies check-in, and the denial names the date the freeze ends (`AC-MEMB-01.2`).                                                           |
| `checkin.recorded`                          | **this module** | `attendance_id`                    | Two in-module consumers: the sharing-signal evaluator and the live-occupancy counter. Both are idempotent on the attendance row id, because the outbox delivers at-least-once. |

`branch.hours-changed` invalidates the step-7 hours cache. That event appears in `Architecture.md`
§10 (publisher `catalog/`) but has **no row in the `ModuleDependency.md` §8.2 catalogue of 52** and
therefore no declared `attendance/` consumer — a second variance for the same `DECISION_LOG.md` entry
as §6.

## 8. Jobs

_Planned. No code in this module yet - populated by the milestones listed below._

| Job                        | `§C5`?                    | Schedule        | Lock scope                                                       | Expected duration                                                                                                                       |
| :------------------------- | :------------------------ | :-------------- | :--------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `attendance.auto-checkout` | **Yes**                   | Hourly          | Per gym timezone and local date, on the M-063 zone primitive     | Not published in `§C5` or `Monitoring.md`; the envelope is declared by the delivering milestone and asserted by `ALRT-21`               |
| `attendance.sharing-scan`  | **Yes**                   | Hourly          | Per scan run; the handler key is `scan_run_id` + `membership_id` | As above                                                                                                                                |
| `occupancy-rebuild`        | **No — roadmap addition** | Every 5 minutes | Per `(tenant_id, branch_id)` shard                               | Short by design; it recounts the **current partition only**, which is what makes a 10–15 s poll affordable without a realtime transport |

Two honest notes rather than a tidy table:

1. **`attendance.sharing-scan` is specified as an hourly `§C5` job but delivered as an event
   consumer.** `Milestones_060-089.md` M-075 implements `BR-CHK-07` as
   `sharing-detection.consumer.ts` reacting to `checkin.recorded`, not as an hourly sweep. Event-driven
   is the better design — implausible travel is detectable at the second scan, not up to an hour later
   — but `§C5` is the PRD and the roadmap is a plan of work. This needs a `DECISION_LOG.md` entry, and
   if the job row is retired, `Monitoring.md`'s _"24 `§C5` jobs"_ cardinality note follows it.
2. **`occupancy-rebuild` is a twenty-fifth job.** Same treatment: it is real, it is necessary (the
   counter is a cache and drift must be corrected _observably_), and it is not in `§C5`.

`attendance.auto-checkout` is behind `rel.attendance.auto-checkout`. With the flag **off**, check-out
is not recorded at all: no control on the desk, no hourly sweep, `checked_out_at` and
`duration_minutes` stay null, and the duration column is hidden from the log, the member's visit
history and both exports. Check-**in** is completely unaffected, including its `NFR-PERF-03` budget.

## 9. Top three failure modes

`NFR-MNT-09`. The three are declared in `PROJECT_CONSTITUTION.md` §18.5.1 — see
**[`/docs/runbooks/attendance.md`](../../../../docs/runbooks/attendance.md)**. (`Monitoring.md` §9.6
lists the same runbook under the filename `checkin.md`; the module-README contract of
`FolderStructure.md` §8.3 requires `<module>.md`, and `Milestones_060-089.md` M-070 also writes
`docs/runbooks/attendance.md`, so that is the canonical path and `checkin.md` should be retired or
aliased.)

|  #  | Declared mode                          | Signal                                                                                                                                                                                                                                             | First action                                                                                                                                                                                                                                                                                                                                                                 |
| :-: | :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **Scan latency breach at peak**        | `ALRT-08` (**S1**): `checkin_client_duration_seconds` p95 > 2 s for 5 m, **or** 5xx on `/tenant/checkin/scan` > 1% for 3 m, **or** `checkin_total{result="ALLOWED"}` falling > 40% below the same weekday-hour trailing-4-week baseline for 10 m   | Open the `D-ONCALL` check-in panel and split the span three ways — token verification, membership load, attendance write. They have different fixes. A queue at a desk at 07:00 in Bengaluru is the most visible failure the platform has (`NFR-AVL-02`)                                                                                                                     |
|  2  | **Token signing key rotation failure** | `ALRT-31` (**S1**): `checkin_token_verification_failures_total{reason=~"BAD_SIGNATURE\|UNKNOWN_KID"}` > 10 in 10 m or > 1% of scans. `reason="EXPIRED"` is **excluded** — at a 60 s TTL expiry is ordinary                                         | Split the two reasons; they are different incidents. `UNKNOWN_KID` means a rotation went wrong and **legitimate members are being refused** — compare the active `kid` set against the overlap window and page immediately. `BAD_SIGNATURE` at volume is attempted forged entry — group by branch in `attendance` to see whether it is one desk, and page the security owner |
|  3  | **Duplicate-cooldown false positives** | `ALRT-24` (S1/S2 by reason) with `denial_reason = DUPLICATE_WITHIN_COOLDOWN` above its trailing-4-week same-weekday-same-hour baseline; also `ALRT-24B`, a staff-override spike, because staff paper over a wrong validation rather than report it | Confirm the configured cooldown for the tenant (default 60 minutes, `BR-CHK-04`) and check whether a legitimate second visit is being caught. Then check `decremented_entitlement` — a duplicate must **not** decrement, and if it did, the session count is now wrong for every affected member (`BR-PLN-06`, `BusinessRules.md` §18.4)                                     |

`rel.attendance.sharing-detection` off leaves the 60-second rotating token as the _entire_ defence
against credential sharing and materially raises `RSK-03` exposure; memberships already under review
stay under review, because clearing one is a human decision. Nothing here may be flag-disabled that
would let an unentitled person through the door.
