# reporting runbook

`NFR-MNT-09`. Module: [`apps/server/src/reporting`](../../apps/server/src/reporting/README.md).

## Scope

`reporting/` executes every report in the product through **one** pipeline: the sixteen-report tenant
catalogue (`SCR-DASH-020`), the eleven-report platform catalogue (`SCR-ADM-014`, including the five
`§C9.4` city-launch gates), drill-down from any total to the rows that compose it, CSV serialisation,
and the asynchronous export path that makes `BR-DAT-05` — *a tenant may export its complete
operational dataset at any time without contacting support* — a working feature rather than a promise.
It owns two tables, `report_definitions` and `export_jobs`, and no business fact. Every figure it shows
belongs to another module and is read live through a query port, which is why its incidents are almost
always about **provenance** (which database, how fresh, does it re-sum) rather than about availability.
It runs in priority class **P4**, whose semaphore is zero during gym peak hours: reporting yields to
check-in, by design, without argument.

## Top failure modes

| Signal | Likely cause | First action | Escalation |
| :--- | :--- | :--- | :--- |
| Replica lag > **2 s** (alert), > **5 s** (automatic fallback to primary) | Long-running write transaction on the primary, a bulk import, or a heavy export competing for I/O | Confirm the fallback engaged. Verify no `financial`-class key resolved to a replica — the combination is not constructible and a runtime attempt raises, so a violation here means the type guard was bypassed. Then treat the lag as a database incident | Ticket to Backend Lead; page if a `financial` key served from a replica, because every downstream reconciliation is then suspect |
| A report request fails with a stale-freshness error | The `materialise` processor (10-minute cadence) is behind, so the stamp exceeded 15 minutes | Check the P4 semaphore: at gym peak it is **0** by design and a lag here is expected, not an incident. Off-peak, check queue `reports` depth and worker liveness | Ticket to Backend Lead if sustained off-peak. **Do not** widen the freshness bound to make the error go away — failing the request is the designed behaviour (`M-104` AC 4) |
| A total disagrees with its drill-through row set | The parent total and the drill executed different queries, different filters, or different sources | Re-run the drill and sum it. Compare the `DrillRef`'s recorded key, filters, source and bucket against the parent cell's. Unregister the single offending report key — granular rollback is the prescribed move; the harness and the other keys survive | S2 and a trust incident, not a display bug. Notify Backend Lead and, if a tenant has already reconciled against the figure, Finance |
| `queue_depth{queue="reports"} > 200` for 15 m, or `queue_oldest_job_age_seconds{queue="reports"} > 600` (`ALRT-20`, S2) | Export backlog, a poisoned export job, or workers unavailable | Bull Board (`access(mfa)` + `admin.system_queue.read`). Distinguish "queued because P4 is throttled at peak" from "not draining at all" — `queue_active_workers == 0` with a non-empty queue is the dead-man condition | Ticket to the owning module lead; zero-workers always pages |
| An export dies repeatedly on the same request | The job is materialising the whole result set in memory instead of streaming | Confirm streamed generation to object storage and the bounded per-tenant queue concurrency. Check whether the tenant is above the per-tenant row cap — the cap must produce a **named error with a runbook link**, never a truncated file | Ticket to Backend Lead. A legitimate large tenant needing more than the cap is a product decision, not an ops override |
| `increase(export_rows_total[1h])` > 5× the trailing-7-day same-hour baseline, or any single export above 250,000 rows (`ALRT-38B`, S2) | Legitimate large export, or data exfiltration by a departing staff member or a compromised session — the two are indistinguishable from the metric alone | Query `audit_log` for the export events: which actor, which tenant, which entity, **and was the session impersonated?** Every export writes its audit row with actor, tenant, key and row count **before** the work begins, so an export that leaked and then crashed still left evidence | Ticket to the security owner. **Page** if the actor holds a platform role rather than a tenant role |
| `report_generation_duration_seconds{mode="SYNC"}` p95 > 5 s for 15 m (`ALRT-07`, S3) | A report key over-running its `NFR-PERF-06` budget at large date ranges | Identify the key from the `report_key` label. Either move it above the async threshold or narrow its default range; the ten heaviest keys are measured at 12-month ranges by the `M-108` load gate | Ticket to Backend Lead |
| `EXPORT_LINK_EXPIRED` (410) reported by a tenant | The signed URL's TTL elapsed before download; the row is retained 90 days after the object expires | The expiry-recovery path regenerates the link. Confirm `export-link-expiry-sweep` is running and that the row still exists for audit | None — this is designed behaviour surfaced clearly |

## Dashboards and queries

_To be populated by `M-104` – `M-108` (Sprint 13, `EP-18`)._ Intended content:

- **Report health** — `report_generation_duration_seconds` by `report_key` and `mode`, p50/p95/p99
  against the `NFR-PERF-06` 5 s synchronous budget; error rate split so that `REPORT_KEY_UNKNOWN` and
  a permission denial are distinguishable from each other.
- **Source and freshness** — per key: declared `source` and freshness class, observed materialisation
  age, replica lag, and a count of automatic primary-fallbacks in the window.
- **Export board** — `export_rows_total` by `entity` with the trailing-7-day baseline overlay, queue
  `reports` depth and oldest-job age, `RL-EXPORT` rejections (3/day, 5/hour, concurrency 1), and
  row-cap hits.
- **Accuracy** — the CI result of `report-accuracy.int-spec.ts` and
  `platform-reports-accuracy.int-spec.ts` surfaced as a build-health tile: all 16 tenant totals and
  all 11 platform totals re-summing to their drill-through row sets.
- **City gates** — the five `§C9.4` gates from `city-performance`, each with its **measured value**,
  not a boolean: ≥25 verified activated gyms with published plans · ≥5 localities · ≥90% complete
  profiles above the freshness threshold · verification SLA met two consecutive weeks · one settlement
  cycle at zero variance.
- **Named queries** to be written here: exports in `RUNNING` older than their duration envelope; the
  exported row count versus an independent tenant-scoped count for the same window (`E13.6`); report
  keys registered without a generated isolation spec (structurally impossible — the build fails
  first — so a non-empty result is itself the finding).
- **Alert file** — `infra/monitoring/alerts/replica-lag.yaml` (`M-104`).
- **Adjacent runbooks** planned by `M-108`: `export-stuck-in-queue.md`, `export-row-cap-reached.md`.

## Known incidents

_None yet._
