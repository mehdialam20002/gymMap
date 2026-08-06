# onboarding runbook

> **Status: stub.** `NFR-MNT-09` requires a runbook per module covering its top three failure modes.
> The three modes below are the declarations of `PROJECT_CONSTITUTION.md` §18.5.1 and are fixed. The
> eight-field per-mode structure of `Monitoring.md` §9.1 — symptom, alert, blast radius, diagnose,
> mitigate, fix, verify, prevent — is filled in by the milestones named under **Dashboards and
> queries**, because `RB2` requires every query in a runbook to have been **run**, and none can be
> run before the tables exist.
>
> **Filename conflict, unresolved.** `Monitoring.md` §9.6 names this runbook
> `verification-queue.md`; `FolderStructure.md` §8.3 row 9 and its §9.12 worked example require
> `/docs/runbooks/<module>.md`. This file follows `FolderStructure.md` because the module `README.md`
> link must resolve. One owner decision settles it for all twenty-three modules — record it in
> `DECISION_LOG.md` and correct the other document (`CLAUDE.md` §9.3).

## Scope

`onboarding/` owns the verification workflow: the six-step resumable wizard (`FR-ONB-01` … `FR-ONB-07`),
the immutable versioned submission snapshot (`FR-ONB-08`), the `§C4.4` application state machine, the
India KYC document set and its segregated encrypted bucket (`FR-ONB-03`, `BR-DAT-07`), the six
automated pre-checks (`FR-ONB-12`), and the reviewer decision surface behind `SCR-ADM-002` /
`SCR-ADM-003`. It owns two tables, `applications` and `kyc_documents`. It owns **no `§C5` job** —
nothing here advances on a timer, because `BR-GYM-03` makes approval a human act. Its output is one
event, `application.approved`, which starts `FR-ONB-13`'s sixty-second approval-to-listing budget and
is consumed by `catalog/`, `settlements/`, `notifications/` and `admin/`.

**Blast radius when this module is down.** No new tenant can be verified, so supply acquisition
stops and the `§C9.4` city-launch gate stalls. **Nothing already live is affected**: existing
listings stay searchable, existing members check in, and money moves normally. That places every
failure mode below at S2 or S3 — never S1 — and the escalation column reflects it.

**Kill switches** (`ADR-0026`, all server-evaluated): `ops.onboarding.new-tenant-signups` (pulled →
new signups become a waitlist capture, in-flight applications stay editable and submittable),
`rel.onboarding.application-submission`, `rel.onboarding.kyc-upload`,
`rel.onboarding.precheck-suite` (off → the reviewer sees *"pre-checks not run"*, an explicit visible
absence rather than a silent pass). **Not flagged, and never flaggable:** the `HumanActor` approval
guard (`BR-GYM-03`, `RSK-01`), the KYC bucket segregation and access audit (`BR-DAT-07`), and the
`BR-GYM-09` partial unique index — a constraint is not a feature.

## Top failure modes

| Signal | Likely cause | First action | Escalation |
| :--- | :--- | :--- | :--- |
| **1 — KYC storage unavailable.** 5xx on `POST /v1/tenant/kyc-documents`; `thirdparty_circuit_state{dependency="DEP-05"} == 2` for 5 m (`ALRT-13`, S2); wizard step 2 stalls for every owner mid-application | Object-storage outage or credential/KMS-key failure on the **segregated KYC bucket**; `block_public_access` runtime assertion failing closed | Confirm which bucket. KYC and media are two buckets under two keys (`NFR-SEC-02`) — a media outage is `catalog` failure mode 1 and a different incident. Then pull `rel.onboarding.kyc-upload`: the step shows an explicit maintenance state, and documents already stored remain readable to reviewers so the queue keeps draining | Ticket to Backend Lead (onboarding) + DevOps. Notify Operations — the verification queue will thin, then spike |
| **2 — Pre-check (geocoding) provider down.** `precheck_outcome_total{outcome="ERROR"}` rising; `ALRT-13` on the maps dependency (S2) | Geocoder outage, quota exhaustion, or the `§4.5` ACL failing open | **Verify the reviewer is seeing *"could not be checked"*, not a pass.** `PrecheckOutcome` has no rejecting member and an outage must yield `ERROR`, never `PASS` — "checked and fine" and "could not be checked" are different statements and only one of them is true. Submission must not block (`DEP-02`). If the distinction has collapsed, pull `rel.onboarding.precheck-suite` rather than let it lie | Ticket to Backend Lead (onboarding). If any application was approved while `ERROR` was being rendered as `PASS`, that is an `RSK-01` exposure — escalate to the Technical Lead and re-review the affected decisions |
| **3 — Verification queue SLA breach.** `application_queue_oldest_age_hours > 24` **or** `application_queue_depth > 40`, evaluated hourly 09:00–21:00 IST (**`ALRT-35a`**, S3) | Reviewer capacity below the arrival rate; a pre-check false-positive storm forcing manual overrides; a launch-city marketing push landing supply faster than review | Split the queue by who is blocking: `INFO_REQUESTED` (awaiting the tenant) versus `SUBMITTED`/`UNDER_REVIEW` (awaiting us). Only the second number is ours. Then check whether one pre-check is generating the overrides — a duplicate-address false positive is the known offender and is why pre-checks flag rather than reject | Ticket to Operations, business hours. `> 48 h` escalates to the Operations manager. Sustained breach informs Product: `KPI-03` (median ≤ 48 h to a live listing), `KPI-02` (≥ 70% activation in 7 days) and the `§C9.4` ≥ 25-verified-gyms city gate all depend on this queue |

## Dashboards and queries

_To be populated by **M-030** (pre-check metrics and the geocoder-outage path) and **M-036** (the
reviewer decision surface and its queue instrumentation), with the KYC-storage panels landing at
**M-029**._

Intended content, named now so the milestones have a target:

- **Panel — verification queue health.** `application_queue_depth` and
  `application_queue_oldest_age_hours` (`Monitoring.md` §5.7), split by `status`, with the `ALRT-35a`
  thresholds drawn. `SprintPlanning.md` Sprint 2 requires **reviewer time-per-application to be
  instrumented from day one**, so the panel carries that histogram beside the depth — Anita's
  30–60 applications per day is an assumption, and it stays unvalidated until `UAT-04` unless it is
  measured.
- **Panel — pre-check outcomes.** `precheck_outcome_total` by `check` and `outcome`
  (`PASS`/`FLAG`/`ERROR`). An `ERROR` share above baseline is a dependency incident; a `FLAG` share
  above baseline on `duplicate-address` is a normaliser regression against the committed
  200-Indian-address fixture corpus.
- **Panel — KYC access audit.** Count of `audit_log` rows with action `EXPORT` on `kyc_documents`,
  by actor role. `BR-DAT-07` restricts reads to `VERIFICATION_OFFICER` and `SUPER_ADMIN`; any other
  role appearing here is a security finding, not an ops one.
- **Query — the queue, by who is blocking.** Read-only, `LIMIT`-bounded, run under `runElevated`
  because the queue is a platform surface. Groups `applications` by `status` with
  `now() - submitted_at` bucketed, and never selects `snapshot` (it carries personal data —
  `RB6`).
- **Query — approvals with an outstanding `FLAG`.** Joins the recorded override reason to the
  decision, so a reviewer approving over flags without stating why is visible after the fact
  (`AC-ONB-02.3`, `AC-ONB-02.4`, `E2.5`).
- **Query — `application.approved` to live listing.** The `FR-ONB-13` sixty-second budget measured
  end to end across `onboarding → catalog → discovery`; when it breaches, this query says which of
  the three legs spent it.
- **Data recovery note.** `applications` is insert-plus-verdict-only and `kyc_documents` is
  tombstoned, never deleted. Recovery is **compensation**, never a row edit: a wrong decision is
  corrected by a new transition through the `§C4.4` machine with a reason, not by rewriting the
  verdict columns.

## Known incidents

_None yet._
