# reporting

**Charter (`MASTER_PRD.md` §C1.3):** _report definitions, query layer, exports._

---

## 1. Bounded context

`reporting/` owns the answer to **"what does this number mean, where was it read from, and how do I
get to the rows underneath it?"** — the report-key registry, each key's permission, scope, freshness
class and **read preference**, the signed drill-down reference, the CSV contract, the timezone a
bucket is computed in, and the lifecycle of an export. It owns no business fact whatsoever. Every
figure it renders belongs to another module, and it reaches them through `*_QUERY_PORT` interfaces
only.

That emptiness is the point. `reporting/` holds the **broadest read allowance in the system** — the
`ModuleDependency.md` §4 matrix marks it `●` against nineteen columns — and §3.3 states plainly why
that is safe: _"Widen the read allowance freely; the moment a write appears, the allowance becomes a
liability."_ The `reporting-is-read-only` `dependency-cruiser` rule mechanises it, and
`FolderStructure.md` §18 row 18 lists _"a write path in `reporting/`"_ among the structural failures
that fail the build rather than a review.

The second decision it owns is **which database a number came from**. A `financial`-class report may
never resolve to a replica; `M-104` makes that combination _not constructible_ rather than
runtime-checked, because a financial figure that is correct as of some unstated moment is a figure a
gym owner will reconcile against and then be unable to reproduce.

Layer **L7** (`ModuleDependency.md` §2.1). Only `admin/` reads it.

## 2. PRD identifiers

| Class                           | Identifiers                                                                                                                                                                                                                                                                                                                                                                                                                    |
| :------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional                      | `FR-RPT-01` … `FR-RPT-05` (`B5.20`). Also serves `FR-CRM-08`, `FR-INV-10`, `FR-CHK-13`, `FR-CHK-14`, `FR-CPN-08` as registered report keys (`M-106` AC 6, closing descope `D-09`)                                                                                                                                                                                                                                              |
| Business rules                  | `BR-DAT-05` (a tenant exports its complete operational dataset without contacting support), `BR-DAT-01` (every export is audited with its row count), `BR-DAT-06` (no personal datum on an analytics event), `BR-FIN-01` (financial reports derive from the ledger), `BR-FIN-02` (settlement figures are read, never recomputed), `BR-TEN-01` (`BAC-10` / `E2E-11` isolation on every key) — **there is no `BR-RPT-*` family** |
| Non-functional                  | `NFR-PERF-06` (5 s synchronous budget), `NFR-SCAL-04` (replica routing), `NFR-SCAL-05`, `NFR-SCAL-06`, `NFR-PRV-04`, `NFR-DQ-02`, `NFR-DQ-03`, `NFR-USE-01`, `NFR-MNT-09`                                                                                                                                                                                                                                                      |
| Acceptance                      | `AC-RPT-01.1` · `AC-RPT-01.2` · `AC-RPT-01.3`; `BAC-12`                                                                                                                                                                                                                                                                                                                                                                        |
| `§C4`                           | **None.** `export_jobs.status` has an enum (`QUEUED` · `RUNNING` · `COMPLETED` · `FAILED` · `EXPIRED`, `Schema.md` §2.5) but it is not one of the nine machines of `StateMachines.md` §1.1 — it is a job status, not a business lifecycle, and it has no journal table                                                                                                                                                         |
| `§C5`                           | Job **20** `report.scheduled-delivery` · job **21** `export.generate`                                                                                                                                                                                                                                                                                                                                                          |
| Errors (`API_Catalog.md` §6.13) | `REPORT_KEY_UNKNOWN` (404, **listing the keys the caller may run**) · `REPORT_RANGE_TOO_LARGE` (422) · `EXPORT_ALREADY_IN_PROGRESS` (409) · `EXPORT_LINK_EXPIRED` (410)                                                                                                                                                                                                                                                        |
| Screens                         | `SCR-DASH-020` (tenant catalogue), `SCR-ADM-014` (platform analytics, including the five `§C9.4` city gates)                                                                                                                                                                                                                                                                                                                   |
| Flags                           | `rel.reporting.async-exports`, `rel.reporting.scheduled-delivery` (both registered **off**; `D-10` taken)                                                                                                                                                                                                                                                                                                                      |
| Rate limits                     | `RL-EXPORT` — **3/day, 5/hour, concurrency 1** per tenant, plus a per-tenant row cap                                                                                                                                                                                                                                                                                                                                           |

> ⚠ **Undefined identifier.** `FR-RPT-07` is cited by `Schema.md` §2.5, §11.3 and `Indexes.md`
> line 640 as the source for `export_jobs.status` and `export_job_status_enum`. `MASTER_PRD.md`
> `B5.20` defines only `FR-RPT-01` … `FR-RPT-05`. Either the PRD is missing two requirements or the
> schema cites an identifier that does not exist. Not resolvable in code.

> ⚠ **Twenty-fourth directory.** `M-107` lists `apps/server/src/analytics/domain/event-schemas.ts`
> and `apps/server/src/analytics/application/funnels/`. `analytics` is **not** one of the 23
> `§C1.3` module folders; `FolderStructure.md` §7 states that adding one _"requires an amendment
> under constitution §24"_, and `FEATURE_FLAGS.md` `FF-CI-07` fails any flag key whose module segment
> is not one of the 23. The `§C6` event taxonomy needs either an amendment or a home inside
> `reporting/`.

## 3. Owned tables

_Planned. No code in this module yet - populated by the milestones listed below._

| Table                | Spec              | Tenancy · retention · grants                                             | Note                                                                                                                                                                                                                                                                                                            |
| :------------------- | :---------------- | :----------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `report_definitions` | `Schema.md` §11.3 | **HYBRID · P-HYBRID** · G-CRUD, soft-deleted (`deleted_at`, `NFR-DQ-04`) | A named parameterised report, platform-supplied (`scope = PLATFORM`) or tenant-defined. `ck_report_definitions__scope_tenant_agree` forbids the two disagreeing. Y1 ≈ 400 rows                                                                                                                                  |
| `export_jobs`        | `Schema.md` §11.3 | RLS · **P-STD** · R-FIN / R-OPS / R-EPH (90 d) · G-CRUD                  | _"`BR-DAT-05` … makes `export_jobs` a first-class table, not a queue artefact: the request, its parameters, its outcome and its size are all auditable facts."_ The row is retained **90 days after the object expires**, and `row_count` / `byte_size` prove what was exported for `BR-DAT-01`. Y1 ≈ 24,000/yr |

**Not owned, despite appearing in the same schema section.** `referrals` (`Schema.md` §11.3) is
IDENTITY-scoped and its permission is `crm.referral.read` (`API_Catalog.md`) — it belongs to `crm/`.
`search_documents` (§13.4) belongs to `discovery/`. `notification_log` belongs to `notifications/`.
`ledger_entries` belongs to `ledger/` and is the source of every financial figure here.

> ⚠ **Rule scope needs qualifying.** `ModuleDependency.md` §3.3 states the `reporting-is-read-only`
> rule forbids `reporting/**` from importing _"any repository"_ — unqualified. But `export.generate`
> must insert and update its own `export_jobs` row, and `Schema.md` §11.3 grants both tables
> **G-CRUD**. The rule plainly means _another module's_ repository and _another module's_ command
> port; it must say so before it is mechanised, or job 21 cannot record its own work.

**Delivering milestones.** `M-104` (registry, harness) · `M-108` (`export_jobs`, `RL-EXPORT`,
audit-before-work).

## 4. Public surface

_Planned. No code in this module yet - populated by the milestones listed below._

`reporting/` **has controllers** — `tenant-reports.controller.ts` and `exports.controller.ts` — so
`dto/` and `permissions.ts` are mandatory. It is not one of the four provider-only modules of
`FolderStructure.md` §8.2.

| Exported symbol                  | Consumers                                                                                                             | Why                                                                                                                                                                                              |
| :------------------------------- | :-------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A platform-report **query port** | `admin/` only (`ModuleDependency.md` §4 matrix, row `admin`, column `rpt` = ●; §2 diagram edge `ADMIN --> REPORTING`) | `GET /admin/analytics/:reportKey` (`FR-RPT-01`, `FR-RPT-02`) runs the eleven platform keys. `admin/` is the only module permitted to import `reporting/`; nothing else needs a report at runtime |
| `type ExportCompletedPayload`    | `notifications/`                                                                                                      | `E7`. The completion notice with its time-limited download link (`FR-RPT-03`)                                                                                                                    |
| `REPORTING_PERMISSIONS`          | The tenant dashboard and admin console via the OpenAPI client                                                         | `FR-RBAC-01`. Registry entries: `reporting.report.read` · `reporting.export.create` · `reporting.export.read` · `reporting.platform_report.read`                                                 |

**Never exported:** a report definition's query, the `DrillRef` internals, any repository, any
`*Command*` symbol. `DrillRef` is **opaque and signed** (`M-105` AC 4) — the server reconstructs the
query from the registry and never from the client, because a serialised filter object hands every
caller an arbitrary query planner backed by this module's very broad read permissions.

`REPORT_KEY_UNKNOWN` returns **404 listing the keys the caller may run** (`M-104` AC 3): a bare 404 is
indistinguishable from a permission failure, and the difference matters to the person debugging it.

**Delivering milestones.** `M-104` (registry and controller) · `M-105` (drill-down, CSV) ·
`M-107` (platform surface) · `M-108` (exports controller).

## 5. Consumed ports

_Planned. No code in this module yet - populated by the milestones listed below._

Read-only, `*_QUERY_PORT` only, downward. Per the `ModuleDependency.md` §4 matrix (which the document
declares _"the machine-readable truth"_), row `reporting` is `●` against: `common` `tenancy` `audit`
`iam` `catalog` `plans` `staff` `crm` `ordering` `memberships` `attendance` `reviews` `ledger`
`payments` `billing` `refunds` `settlements` `notifications` `support` — and `—` against `onboarding`,
`discovery` and `admin`.

| From                                       | Port                                                                         | Why the answer is needed synchronously                                                                                                                                                |
| :----------------------------------------- | :--------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ledger/`                                  | `LEDGER_READ_PORT`                                                           | `BR-FIN-01` — _financial reports read from the ledger and are always current_ (`FR-RPT-02`). Not from orders, not from a projection, not from a replica                               |
| `settlements/`, `billing/`                 | `INVOICE_QUERY_PORT`, batch/statement reads                                  | `BR-FIN-02` — `settlement-statement` reads the **persisted** `A6.3` figures and never recomputes them; a mismatch against `SCR-DASH-014` is a test failure, not a rounding difference |
| `ordering/`, `payments/`, `refunds/`       | `ORDER_QUERY_PORT`, `PAYMENT_QUERY_PORT`, `REFUND_QUERY_PORT`                | Revenue, payment-health and refund reports, and the drill-through beneath every total                                                                                                 |
| `memberships/`, `attendance/`, `crm/`      | `MEMBERSHIP_QUERY_PORT`, `ATTENDANCE_QUERY_PORT`, `MEMBER_QUERY_PORT`        | Renewals, churn cohort, peak hours, member activity, expiring memberships                                                                                                             |
| `catalog/`, `plans/`, `staff/`, `reviews/` | `GYM_QUERY_PORT`, `PLAN_SUMMARY_PORT`, `STAFF_QUERY_PORT`, review aggregates | Revenue by plan, staff activity, review summary, city performance                                                                                                                     |
| `support/`                                 | ticket query port                                                            | The `support-load` platform report (`M-107`) — tickets per tenant, per category, resolution time                                                                                      |
| `notifications/`                           | delivery/cost query port                                                     | Channel cost and delivery health on the platform catalogue (`FR-NOTF-08`)                                                                                                             |
| `iam/`, `audit/`                           | `USER_QUERY_PORT`, `AUDIT_WRITE_PORT`                                        | Actor attribution; and **every export writes its audit row before the work begins**, so an export that leaked and then crashed still leaves evidence (`M-108` note)                   |

**Why synchronous rather than a projection.** `FR-RPT-05` requires that clicking any total reveals its
constituent records, and `M-105` AC 3 requires the returned row set to **re-sum to the parent total,
exactly**. A total computed by the report and a drill computed by a different query agree on seeded
data and disagree in production the first time a partial refund lands mid-period. The drill therefore
re-executes the **same definition** against the **same source** with a narrower projection — which is
only possible if both go through the same live port in the same request.

> ⚠ **Count discrepancy inside one document.** `ModuleDependency.md` §3.2 row 46 says
> `reporting/ → ` _"10 modules (see §4)"_. §4's matrix — declared the machine-readable truth and the
> generator input for `dependency-cruiser` — shows nineteen. The generated rule set will follow the
> matrix; the prose needs correcting.

**Delivering milestones.** `M-104`, `M-105`, `M-106`, `M-107`.

## 6. Emitted events

_Planned. No code in this module yet - populated by the milestones listed below._

| Event              | Payload beyond `tenant_id` + `occurred_at` | Known consumers  | Consumer idempotency key |
| :----------------- | :----------------------------------------- | :--------------- | :----------------------- |
| `export.completed` | `export_job_id`, `object_key`              | `notifications/` | `export_job_id`          |

One event, and it is a _notification trigger_, not a domain fact — consistent with a module that
changes nothing about the business. A report being run emits an **analytics** event (`report_viewed`,
`report_exported`, `export_requested` — `§C6`), which is telemetry, not a domain event, and carries no
personal datum (`BR-DAT-06`, enforced by `tools/ci/assert-no-personal-data-in-events.ts`).

**Delivering milestones.** `M-108`.

## 7. Consumed events

_Planned. No code in this module yet - populated by the milestones listed below._

| Event                             | Publisher        | Handler idempotency key (`§8.2`)                  |
| :-------------------------------- | :--------------- | :------------------------------------------------ |
| `ledger.entry-appended`           | `ledger/`        | `ledger_entry_id`                                 |
| `checkin.recorded`                | `attendance/`    | `attendance_id`                                   |
| `checkin.denied`                  | `attendance/`    | `attempt_id`                                      |
| `notification.failed`             | `notifications/` | `notification_id` + `attempt`                     |
| `config.changed` / `flag.changed` | `admin/`         | `config_key` + `version` / `flag_key` + `version` |

These drive **materialisation, not fact-keeping**. ADR-0017 is explicit that _"an aggregation handler
recomputes from source rather than incrementing"_, so a lost or duplicated delivery costs a
recomputation, never a wrong figure — which is the property that lets a replica-class report be
materialised every 10 minutes and still be trustworthy within its declared 15-minute freshness bound.

**Delivering milestones.** `M-104` (materialise processor and the freshness contract).

## 8. Jobs

_Planned. No code in this module yet - populated by the milestones listed below._

Both jobs sit in class **P4 `BULK`**, whose tier-wide semaphore is **1 normally and 0 during gym peak
hours**. `Scalability.md` §8.4 states the principle without hedging: _"a performance mitigation that
slows check-in to speed up reporting is rejected — the converse is that reporting yields to check-in
without argument."_

| Field              | `report.scheduled-delivery`                                                                                                     | `export.generate`                                                                                                                                           |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `§C5` #            | **20**                                                                                                                          | **21**                                                                                                                                                      |
| Queue · class      | `reporting` · **P4**                                                                                                            | `reporting` · **P4**                                                                                                                                        |
| Schedule           | Per configuration (daily / weekly / monthly)                                                                                    | On demand                                                                                                                                                   |
| Concurrency        | 2                                                                                                                               | 2                                                                                                                                                           |
| Scope              | `TS`                                                                                                                            | `TS`                                                                                                                                                        |
| Lock key           | `report.scheduled-delivery:tenant_{id}:{reportKey}:{period}`                                                                    | `export.generate:tenant_{id}:{requestId}`                                                                                                                   |
| Duration Y1 · 10×  | ≤ 5 s per report · ≤ 5 s                                                                                                        | ≤ 5 min · ≤ 30 min                                                                                                                                          |
| Depth envelope     | ≤ 20 after 2 h                                                                                                                  | ≤ 10 after 4 h                                                                                                                                              |
| If it falls behind | `FR-RPT-04` emails are late. Visible to the owner, harmless to the platform. **Sev P3**                                         | The `FR-RPT-03` link is issued late. **Sheddable under backpressure (`BP1`). Sev P3**                                                                       |
| Flag               | `rel.reporting.scheduled-delivery` **off** — schedules are _paused, not deleted_, and there is **no catch-up burst** on restore | `rel.reporting.async-exports` **off** — over-threshold requests are refused with a message naming the threshold, never a timeout and never a truncated file |

Queue envelope for `ALRT-20`: `reports` = depth **200** / age **600 s**.

**Planned processors outside the twenty-four.** `M-104` adds `materialise.processor` (every 10
minutes, replica-class reports only, stamp never older than 15 minutes) and `M-108` adds
`export-link-expiry-sweep` (`EXPORT_LINK_EXPIRED`, 410, after the window). Neither has a `§C5` row,
a class or a lock-key grammar instance — the same gap flagged in `notifications/`.

**Streaming is not an optimisation here.** `M-108`'s note names the trap precisely: a tenant with three
years of attendance asks for everything, the job serialises it into memory, and the worker dies —
repeatedly, because the retry does the same thing. Generation streams to object storage row by row in
the Mumbai region, per-tenant queue concurrency is bounded, and a legitimate large tenant hitting the
row cap gets a **named error and a runbook link**, not a silent truncation.

**Delivering milestones.** `M-104` · `M-108`.

## 9. Top three failure modes (`NFR-MNT-09`)

|  #  | Failure                                                                                                                                                                                                          | Signal                                                                                                                                                                                                                                                | First action                                                                                                                                                                                                                                                                            |
| :-: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **Replica lag, or a stale materialisation served as current.** The dangerous version is silent: numbers that are correct as of an unstated moment, reconciled against by an owner, and unreproducible afterwards | Replica-lag alert at **2 s**; automatic fallback to primary above **5 s** (`infra/monitoring/alerts/replica-lag.yaml`). A freshness stamp older than 15 minutes **fails the request** rather than serving old data                                    | Confirm the fallback engaged and that no `financial`-class key resolved to a replica — by construction it cannot, and a runtime attempt raises. Then treat the lag itself as a database incident                                                                                        |
|  2  | **A total that disagrees with its drill-through.** The report computes one query, the drill computes another; they agree on seeded data and diverge the first time a partial refund lands mid-period             | `report-accuracy.int-spec.ts` failing in CI; in production, an owner's reconciliation dispute. There is no metric for this — the defence is the test                                                                                                  | Re-run the drill and sum it. If the parent used a different `source` or different filters than the child, that is the bug. Unregister the single misbehaving key — the preferred granular rollback — rather than reverting the catalogue                                                |
|  3  | **Export stuck, capped, or anomalous in volume.** `BR-DAT-05` makes self-service export a right, and `TR-12` makes an unusual export volume indistinguishable from exfiltration                                  | `queue_depth{queue="reports"} > 200` or `queue_oldest_job_age_seconds{queue="reports"} > 600` (`ALRT-20`, S2); `increase(export_rows_total[1h])` > 5× the trailing-7-day same-hour baseline, or any single export above 250,000 rows (`ALRT-38B`, S2) | For a stall: Bull Board, check P4 semaphore occupancy — at gym peak it is **0** by design, so a queued export during peak hours is not yet an incident. For volume: read `audit_log` for the export events — which actor, which tenant, which entity, **was the session impersonated?** |

Also watched: `report_generation_duration_seconds{mode="SYNC"}` p95 > 5 s for 15 m (`ALRT-07`, S3,
`NFR-PERF-06`).

Runbook: [`/docs/runbooks/reporting.md`](/docs/runbooks/reporting.md)
