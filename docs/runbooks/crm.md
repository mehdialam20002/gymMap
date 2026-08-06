# crm runbook

> `NFR-MNT-09`: *"Every module has a runbook covering its top three failure modes."*
> Owner: **Backend Lead (crm)** · Primary alerts: `ALRT-20` (import queue), `ALRT-38B` (data-egress
> anomaly), `ALRT-21` / `ALRT-22` (`crm.risk-flags`) · Module README:
> [`apps/server/src/crm/README.md`](../../apps/server/src/crm/README.md)
>
> **Status: stub.** No code exists in `apps/server/src/crm/` yet. The failure modes below are the three
> declared in `PROJECT_CONSTITUTION.md` §18.5.1 and are binding; the dashboards, queries and
> mitigations are named but not yet verified against a running system.
>
> The module README records an **unresolved conflict** between `Milestones_060-089.md` M-081 (a
> synchronous `crm/ → attendance/` adapter) and the `ModuleDependency.md` §4 matrix (that edge is
> forbidden). Resolve it in `DECISION_LOG.md` before M-081 is built, not here.

## Scope

`crm/` is the gym's own book of people. It owns `crm_members` (the tenant's record of a human, which
may or may not have a platform account behind it), `member_notes` (private to staff, invisible to the
member, with a sensitive-category flag that also excludes the note from exports), `leads` (the
enquiry pipeline before a sale) and `segments` (saved filter *definitions*, re-evaluated on read). It
is layer L3: it holds no money, decides no membership state, and shows membership, order and visit
facts as **projections fed by events** from the modules that own those decisions. Its two operational
surfaces are the member list and Member 360 on `SCR-DASH-007` / `-008` — the screens a gym owner has
open all day — and the streamed CSV importer that a gym arriving with four hundred members on a
spreadsheet uses on day one. Failures here are rarely dramatic and almost always *quiet*: a stale
at-risk list, a half-loaded import, an export nobody noticed leaving.

## Top failure modes

| Signal | Likely cause | First action | Escalation |
| :--- | :--- | :--- | :--- |
| **1. Import job partial failure.** `ALRT-20` on the `maintenance` queue (depth > 1,000 or oldest job age > 3,600 s for 15 m; `queue_active_workers == 0` with depth > 0 **always** pages), or an `import_jobs` row whose `imported_rows` sits below `valid_rows` with no progress | A worker died mid-file and the job did not resume from its last committed row; or the natural key is collapsing distinct people (or failing to collapse the same person) so re-running duplicates everything; or a row is being half-applied because the member and its `member_code` are not allocating in one transaction | Re-run the same file. The import is **idempotent on `(tenant_id, normalised phone)`**, so a re-run after fixing three rows imports exactly three and creates zero duplicates. Verify the phone normalisation first — `9876543210`, `09876543210`, `+91 98765 43210` and `+919876543210` must collapse to one key, and any two treated as distinct turns "idempotent re-run" into "duplicate everything". **A code revert does not roll back imported members**; that is a data operation and `import_job_id` is the filter that identifies them | Ticket to Backend Lead (crm). Zero active workers pages. Notify the tenant if their onboarding import is the blocked one — this is usually day one of the relationship |
| **2. At-risk baseline stale (declared as "segment recomputation lag").** `ALRT-21` (job failed twice consecutively, or `job_duration_seconds` over envelope) or `ALRT-22` (dead-man at 2× the nightly interval) on `job_name="crm.risk-flags"`; or `crm_members.risk_flagged_at` values older than one local day; or a member who checked in this morning still showing as at-risk | A stale **set** flag is the nightly job: it did not tick, or it ticked at 00:00 UTC instead of the gym's local hour (`Asia/Kolkata` is `+05:30` and no whole-hour UTC cron expresses local midnight there). A stale **cleared** flag is the outbox: the `checkin.recorded` consumer is not draining (`ALRT-21B`) | Establish which of the two it is before touching anything — they have different owners. Job: check the tick's correlation id and the zone bucket. Consumer: `SELECT event_type, count(*), min(created_at) FROM outbox WHERE published_at IS NULL GROUP BY 1 ORDER BY 3;`. Then re-run the job; it **recomputes from source** rather than incrementing, so it is safe to run twice | Ticket to Backend Lead (crm). Not gym-visible as an alert, but very gym-visible as a product: a stale at-risk list trains the owner to ignore the feature |
| **3. Export size exceeding synchronous budget.** `ALRT-38B`: `export_rows_total` more than 5× the trailing-7-day same-hour baseline, **or** any single export above 250,000 rows, **or** `http_response_size_bytes` p99 above its route budget | Either a legitimate large tenant exporting under `BR-DAT-05`, or a member-list export that should have been routed to the async path, or exfiltration — a departing staff member or a compromised session | Read `audit_log` for the export events: **which actor, which tenant, which entity, and was the session impersonated?** Size alone does not distinguish a right from a leak; the actor does. Then confirm formula neutralisation is applied — a cell beginning `=`, `+`, `-` or `@` must be prefixed on the *error report* as well as the export, because the error report is the file the owner opens in Excel | Ticket to the **security owner**; page if the actor is a platform role rather than a tenant role |

## Dashboards and queries

_To be populated by **M-080** (member and note surfaces), **M-081** (the nine filters, Member 360 and
the at-risk baseline) and **M-082** (the streamed importer and its error report)._

Intended content, named now so the milestones have a target:

- **Import job board** — `import_jobs` by `status`, with `total_rows` / `valid_rows` / `imported_rows`
  side by side and the dry-run flag visible. A dry run that wrote rows, or a commit whose imported
  count never reaches its valid count, is the whole of failure mode 1 on one line.
- **Natural-key collision query** — members created by an import whose normalised phone matches an
  existing row. The check that proves idempotency held, run after every large import rather than after
  the first complaint.
- **`crm.risk-flags` health** — `job_outcomes_total{job_name="crm.risk-flags"}` split by outcome,
  `job_last_success_timestamp_seconds` **per timezone bucket**, and the count of members whose
  `risk_flagged_at` predates the last successful run.
- **Flag-clearing latency** — time between a `checkin.recorded` event and `risk_flagged_at` being
  cleared for that member. `AC-CRM-01.3` requires this to be immediate, and the metric is how
  "immediate" stops being an aspiration.
- **Segment freshness proof** — a standing check that saving a segment, checking a member in, and
  re-reading the segment finds them gone *with no recomputation step in between*. If this ever needs a
  cache warm, someone has materialised a segment and `Schema.md` §8.4 has been violated.
- **Export audit query** — exports in the last 24 h from `audit_log` joined to actor role, entity and
  row count, ordered by rows descending. The first query of every `ALRT-38B`.
- **Sensitive-note exclusion check** — that no export artefact contains a `member_notes` row with
  `is_sensitive_category = true` unless the requester held the elevated permission (`NFR-PRV-07`).
- **Erasure drill** — a `BR-DAT-04` erasure of a platform user completing while the tenant's
  `crm_members` row survives pseudonymised. The absent foreign key on `user_id` is deliberate and this
  is the check that stops someone "fixing" it.

## Known incidents

_None yet._
