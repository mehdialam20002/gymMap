# attendance runbook

> `NFR-MNT-09`: *"Every module has a runbook covering its top three failure modes."*
> Owner: **Backend Lead (attendance)** · Primary alerts: `ALRT-08` (check-in degraded or down),
> `ALRT-24` / `ALRT-24B` (denial and override anomalies), `ALRT-31` (QR signature failures) ·
> Module README: [`apps/server/src/attendance/README.md`](../../apps/server/src/attendance/README.md)
>
> **Status: stub.** No code exists in `apps/server/src/attendance/` yet. The failure modes below are
> the three declared in `PROJECT_CONSTITUTION.md` §18.5.1 and are binding; the dashboards, queries and
> mitigations are named but not yet verified against a running system.
>
> **Filename note.** `Monitoring.md` §9.6 lists this module's runbook as `checkin.md`, and alerts
> `ALRT-08`, `ALRT-24`, `ALRT-24B` and `ALRT-31` all link there. `FolderStructure.md` §8.3 requires the
> module README to link `/docs/runbooks/<module>.md`, and `Milestones_060-089.md` M-070 writes
> `docs/runbooks/attendance.md` by name. This file is canonical; `checkin.md` should be retired or made
> an alias, and the `Monitoring.md` links updated in the same change.
>
> **This runbook also carries the Ed25519 key-rotation procedure** (M-070, task `T-11.41`), which must
> be rehearsed once before Sprint 8 closes.

## Scope

`attendance/` is the door. It issues the 60-second Ed25519-signed QR token, runs the ten ordered steps
of `FR-CHK-04` and returns the **first** failure as one of the fifteen `§C4.8` denial reason codes,
and writes an immutable `attendance` row for every attempt — allowed or denied, scanned or manual or
overridden. It owns the largest table in the system (18.25 M rows in year one, monthly range
partitions), the Redis nonce gate that makes `BR-CHK-06` idempotent within a token's TTL, and the
live-occupancy counter the dashboard polls. `NFR-AVL-02` ranks check-in and payment as the last two
things to degrade, and `NFR-PERF-03` gives the whole desk interaction 2 s at p95: a member standing at
a counter at 07:00 with a queue behind them is the most visible failure mode the platform has, and the
fastest route to `KPI-04` churn. When in doubt during an incident, **degrade towards letting members
in with a recorded manual check-in, never towards a locked door** — `BR-CHK-08` exists so a desk is
never blocked, and `FR-CHK-08` makes every override reportable afterwards.

## Top failure modes

| Signal | Likely cause | First action | Escalation |
| :--- | :--- | :--- | :--- |
| **1. Scan latency breach at peak.** `ALRT-08` (**S1**): `checkin_client_duration_seconds` p95 > 2 s for 5 m, **or** 5xx on `/tenant/checkin/scan` > 1% for 3 m, **or** `checkin_total{result="ALLOWED"}` more than 40% below the same weekday-hour trailing-4-week baseline for 10 m | One of three spans, and they have different fixes: token verification (CPU, or a key-set reload), the `MEMBERSHIP_QUERY_PORT` load (`memberships/` slow, or a cold entitlement read), or the attendance write (partition bloat, index contention, or `ALRT-33` connection-pool saturation from long interactive transactions) | Open the `D-ONCALL` check-in panel and read the three child spans of `checkin.scan` (`Monitoring.md` §4.3.1) before touching anything — the panel names the layer in one glance. If the write is the culprit, check whether the current monthly partition exists (the partition-maintenance job is monthly, and a missing partition is an insert error, not a slow one) | **Page primary on-call immediately.** Inside the gym-critical window also notify the tenant-facing status page. 15 m no ack → secondary; 30 m → Technical Lead. Gym-visible: yes |
| **2. Token signing key rotation failure.** `ALRT-31` (**S1**): `checkin_token_verification_failures_total{reason=~"BAD_SIGNATURE\|UNKNOWN_KID"}` > 10 in 10 m, or > 1% of scans in 10 m. `reason="EXPIRED"` is deliberately excluded — at a 60 s TTL expiry is ordinary and a screenshot being refused is the feature working | `UNKNOWN_KID`: a rotation published `current` without keeping `previous` valid for the overlap window, or the secret store returned a key set the running instances have not reloaded. `BAD_SIGNATURE`: attempted forged entry, or a member's client is signing against a retired key | **Split the two reasons first — they are different incidents.** `UNKNOWN_KID` → compare the active `kid` set against the configured overlap window; legitimate members are being refused *right now*, so restore the previous key slot before root-causing. `BAD_SIGNATURE` → group by branch in `attendance` to see whether it is one desk (a device or a person) or platform-wide (a rotation). **Never** disable signature verification to restore service | `UNKNOWN_KID` pages on-call immediately. `BAD_SIGNATURE` pages the security owner and notifies the affected tenant. Gym-visible: yes |
| **3. Duplicate-cooldown false positives.** `ALRT-24` with `denial_reason = DUPLICATE_WITHIN_COOLDOWN` above its trailing-4-week same-weekday-same-hour baseline by > 8 pp for 15 m; and `ALRT-24B`, staff overrides at 3× baseline for 1 h — staff paper over a wrong validation rather than report it, so the override spike often fires first | The tenant's cooldown is configured too long for its usage pattern (default 60 minutes, `BR-CHK-04`); or the Redis nonce gate is returning the original record for a genuinely new scan; or — the expensive variant — a duplicate is **decrementing entitlement**, which it must never do | Confirm the tenant's configured cooldown, then run the branch-localising query below. Then check `decremented_entitlement` on the duplicates: `BR-CHK-04` × `BR-PLN-06` (`BusinessRules.md` §18.4) requires a duplicate to record but not consume. If sessions were consumed, every affected member's `sessions_used` is now wrong and `memberships/` counter-drift is a P1 | S2: ticket the owning lead **and** notify the affected tenant's account owner — a gym whose members are being denied should hear it from us first. Escalate to S1 if entitlement was decremented |

**Denial-reason triage, because the shape names the cause.** `ALRT-24` fires per `denial_reason` as
well as in aggregate. A rise in denials is one of exactly three things and only the first is
acceptable:

- **Correct** — a genuine wave of expiries. Predictable from the expiry cohort for that IST day, so an
  *unpredicted* spike is not this.
- **A defect** — `MEMBERSHIP_EXPIRED` without a matching cohort means the expiry job ran in the wrong
  timezone (`memberships/` failure mode 1); `MEMBERSHIP_NOT_FOUND` means the activation pipeline
  stalled (`ALRT-10`, `ALRT-21B`); `WRONG_BRANCH` or `OUTSIDE_OPERATING_HOURS` usually means a tenant
  configuration change landed an hour ago.
- **Abuse** — pass sharing, which is what the sharing scan is for.

## Dashboards and queries

_To be populated by **M-072** and **M-073** (the ten-step sequence, its per-step spans and the fifteen
`§C4.8` codes), **M-075** (occupancy drift and the sharing signals) and **M-076** (the desk's own
`NFR-PERF-03` gate)._

Intended content, named now so the milestones have a target:

- **The check-in panel on `D-ONCALL`** — client p95 against the 2 s line, scans per minute against the
  500/min `NFR-PERF-08` ceiling, the `ALLOWED`/`DENIED` split, and `checkin_token_verification_failures_total`
  by `reason`. Four numbers, one screen, because this is what someone reads at 07:00.
- **Per-step span breakdown** of `checkin.scan` — token verify, membership load, hours lookup, plan
  window, cooldown, write. `NFR-PERF-03` is a budget and the budget has to be attributable.
- **Branch localisation query.** Metric cardinality rules (`Monitoring.md` correction **C-3**) removed
  `branch_id` from `checkin_total` — 5,000 branches × 15 reasons × 4 methods is 300,000 series from one
  counter — so the metric **detects** and SQL **localises**:
  `SELECT branch_id, denial_reason, count(*) FROM attendance WHERE checked_in_at > now() - interval '1 hour' GROUP BY 1,2 ORDER BY 3 DESC;`
  This is the step every `ALRT-24` page begins with.
- **Override audit query** — overrides by `reason_code`, then by branch and staff member, joining
  `attendance` to `audit_log`. `BR-CHK-08` makes overrides separately reportable precisely so this
  query exists.
- **Occupancy drift** — `gym.attendance.occupancy_drift` per rebuild run, target zero. The counter is a
  cache; the rebuild must report its correction rather than silently fix it, or it drifts quietly for a
  week because nobody reads it.
- **Ed25519 key-rotation procedure** — the `current` / `previous` slots, the overlap window variable,
  the reload path, and the rehearsal checklist. A token signed by `previous` must verify during the
  window and fail after it, and that is asserted by advancing the clock rather than by waiting.
- **Partition-health check** — that next month's `attendance` partition exists, and that RLS and grants
  were re-applied to it. A partition created without its policy is `ALRT-27` territory (RLS coverage
  drift) on the largest table in the system.

## Known incidents

_None yet._
