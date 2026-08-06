# onboarding

**Charter (`MASTER_PRD.md` §C1.3).** `applications, KYC documents, verification workflow` — convert an
interested gym owner into a verified, listed, transacting tenant, and stop anyone else (`B5.3`).

---

## 1. Bounded context

Owns the answer to **"has a human decided that this tenant may be seen by the public, on what
evidence, and against which frozen version of that evidence"**. No other module may drive an
application through the `§C4.4` machine, and no other module may produce an approval. `BR-GYM-03`
makes approval a human decision, so the transition is typed on a branded `HumanActor` (M-028) rather
than guarded by a runtime role check: a job, a bulk import or a future automation cannot even
_construct_ the call. That is `RSK-01` — fake gyms, scored 20 — expressed structurally. Onboarding
owns the **decision**, not its consequences: `catalog/` applies `gyms.status` when it handles
`application.approved`, and `discovery/` projects the result into `search_documents`. Three modules,
one invariant (`I4`, verification before visibility), one deciding signature.

Its second owned decision is **what a reviewer is looking at**. `FR-ONB-08` freezes the submitted
dossier into `applications.snapshot`; the owner may keep editing non-material draft fields, and the
reviewer's view does not move. A resubmission is version _n+1_, never an edit (`BR-GYM-05`).

## 2. PRD identifiers

| Class          | Identifiers                                                                                                                                         |
| :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional     | `FR-ONB-01` … `FR-ONB-13` (see the note below on `FR-ONB-14`/`-15`)                                                                                 |
| Business rules | `BR-GYM-01` … `BR-GYM-05`, `BR-GYM-08`, `BR-GYM-09` (the decision half); `BR-DAT-07` (KYC access); `BR-DAT-01` (audit on every transition)          |
| Non-functional | `NFR-SEC-02` (KYC bucket, own key), `NFR-SEC-10` (content inspected, not declared), `NFR-MNT-09` (this file's §9), `NFR-PRV-04` (`R-KYC` retention) |
| State machine  | **`§C4.4`** — `DRAFT → SUBMITTED → UNDER_REVIEW → {APPROVED, REJECTED, INFO_REQUESTED}`, `APPROVED ⇄ SUSPENDED`, `APPROVED → CLOSED`                |
| `§C5` jobs     | **None owned.** See §8.                                                                                                                             |
| Reason codes   | `§C4.8` application rejection taxonomy (`application_rejection_reason_enum`)                                                                        |
| Screens        | `SCR-DASH-002` (wizard), `SCR-ADM-002` (approval queue), `SCR-ADM-003` (application review)                                                         |
| Acceptance     | `AC-ONB-01.1` … `-01.3`, `AC-ONB-02.1` … `-02.5` (`MASTER_PRD.md` B5.3); `AC-ONB-04.1` … `-04.5` (`backlog/Epic_03.md` — India KYC)                 |
| Epic / E2E     | `EP-03` · `E2E-01` · `BAC-01`, `BAC-02` · `KPI-03` (median ≤ 48 h to a live listing)                                                                |

**Two `FR-ONB-` ids are not implemented here, and saying so is the point of this table.**
`FR-ONB-15` (bulk member import) is delivered by `crm/` — the endpoint is
`POST /v1/tenant/members/import` under permission `crm.member.import` (`apis/Gym.md` §2.1 row 35,
M-082). `FR-ONB-14` (the activation checklist) is a `gym-dashboard` composition over several
modules' read models (`ui/Navigation.md` §5.4), not a server-side capability of this module.

## 3. Owned tables

_Planned. No code in this module yet - populated by the milestones listed below._

| Table           | Grants                                                                                                                                                                 | Retention | Why it is here                                                                                                                                                                                                                                                                |
| :-------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `applications`  | **G-COMPLETE** — `SELECT, INSERT` plus a column-scoped `UPDATE (status, assigned_to, decided_by, decided_at, decision, reason_codes, reviewer_notes)` and nothing else | `R-KYC`   | The frozen dossier lives entirely in `snapshot`; the six verdict columns are the reviewer's statement _about_ that frozen artefact. `UPDATE snapshot` raises `permission denied` at the grant level. Deviation **D-03** in `database/Schema.md` §4.2, registered in its §16.1 |
| `kyc_documents` | G-CRUD                                                                                                                                                                 | `R-KYC`   | **No `deleted_at`.** The row outlives the tenant; object purge is recorded by the tombstone column, because deleting the row would destroy the evidence that a legally required document once existed (`Schema.md` §4.3)                                                      |

Both carry `tenant_id NOT NULL`, RLS **enabled and forced**, and policy classes **P-STD + P-PLATFORM**
(the verification queue is a platform surface read under `runElevated`).

**Deliberately not owned, though a reader will expect them:**

- `kyc_checklists` — platform-global reference data. `admin/` is the write surface (`FR-ADMN-06`);
  onboarding **reads** it through `common/persistence/reference-data.repository.ts`
  (`ModuleDependency.md` §0 C-3). The checklist _version in force_ is copied into
  `applications.snapshot`, not referenced by FK — otherwise adding a tenth required document in March
  would retroactively make every February application incomplete (`ERD.md` §9.6).
- `payout_accounts` — owned by `settlements/` (permissions `settlements.payout_account.read` /
  `.update`, `apis/Gym.md` §2.1 rows 46–47). Wizard step 5 collects the details; `application.approved`
  triggers creation in `settlements/`, because `onboarding → settlements` is an L3→L6 upward edge and
  is forbidden as an import (`ModuleDependency.md` §4.2).
- `tenants` — owned by `tenancy/` (`tenancy.tenant.create`).
- There is **no `wizard_drafts` table.** The draft _is_ the application at `version = 0`,
  `status = 'DRAFT'`, so there is no second storage mechanism to reconcile at submission (M-027).

**Delivering milestones:** M-026 (both tables, grants, RLS, repositories), M-029 (`kyc_checklists`
reference table and the India ten-document seed).

## 4. Public surface

_Planned. No code in this module yet - populated by the milestones listed below._

`onboarding/` is **not** one of the four provider-only modules of `FolderStructure.md` §8.2, so
`controllers/`, `dto/` and `permissions.ts` are mandatory. It carries three controller audiences,
which is unusual and deliberate: the tenant wizard, the tenant KYC upload path, and the
**admin-audience reviewer surface** — the review controller lives here, not in `admin/`, because the
`§C4.4` transition guard lives here and `admin/` may import only public command interfaces
(`ModuleDependency.md` §3.3).

| Exported from `index.ts`                                                                                                  | Consumers                                                                                                                          |
| :------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------- |
| `ApplicationSubmitted`, `ApplicationApproved`, `ApplicationRejected`, `ApplicationInfoRequested` payload **types** (`E7`) | `catalog/`, `settlements/`, `notifications/`, `admin/` — so a consumer types its handler without importing this module's `domain/` |
| `onboarding.*` permission constants                                                                                       | `iam/`'s `PermissionsGuard`; the two dashboards through the generated OpenAPI client                                               |
| Application status / queue read-model types                                                                               | `admin/` (`FR-ADMN-11` queue), the generated client                                                                                |

Permission strings, from `apis/Gym.md` §2.1 and `apis/Admin.md` §4: `onboarding.application.read`,
`.submit`, `.write`, `.list_all`, `.review`, `.approve`, `.reject`, `.request_info`, `.assign`;
`onboarding.kyc_document.list`, `.upload`, `.delete`.

Routes (all `/v1`): `GET|PUT /tenant/onboarding[/steps/:step]` · `GET|POST /tenant/applications`,
`GET /tenant/applications/:id` · `GET|POST /tenant/kyc-documents`, `DELETE /tenant/kyc-documents/:id`
· `POST /admin/applications/:id/{approve,reject,request-info,assign}` ·
`GET /admin/kyc-documents/:id/access-url`.

> **Open item.** `ModuleDependency.md` §4 marks `admin/ → onboarding/` as **●**, but §3.2 — which
> states _"if a port is not in this table, the edge does not exist"_ — itemises no port on this
> module's `index.ts`. The same gap exists for `onboarding/ → iam/`. Both edges need a named port
> before the first import is written; do not invent one in code.

**Delivering milestones:** M-026 (skeleton, `index.ts`, `permissions.ts`), M-027 (wizard),
M-028 (application lifecycle), M-029 (KYC), M-036 (reviewer decision surface).

## 5. Consumed ports

_Planned. No code in this module yet - populated by the milestones listed below._

| Provider   | Port                                                                                                   | Why the answer must be synchronous                                                                                                                                                                   |
| :--------- | :----------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog/` | `GYM_COMMAND_PORT`                                                                                     | Wizard step 3 creates the gym and its branches **inside the application transaction** — a half-created listing is not a state the reviewer may ever see (`FR-ONB-04`, edge 9)                        |
| `plans/`   | `PLAN_COMMAND_PORT`                                                                                    | Wizard step 4 creates the first plan; `BR-GYM-02` makes "≥ 1 published plan" an approval precondition, so the count must be true at submit time, not eventually (`FR-ONB-05`, edge 10)               |
| `staff/`   | `STAFF_INVITATION_PORT`                                                                                | Wizard step 6 invites staff (`FR-ONB-07`, edge 11)                                                                                                                                                   |
| `common/`  | `Clock`, `IdGenerator`, `Money`, idempotency, outbox, `ReferenceDataRepository` (for `kyc_checklists`) | Universal edge, `ModuleDependency.md` §3.1                                                                                                                                                           |
| `tenancy/` | `TenantContext`, the tenant-scoped Prisma client, `runElevated()`                                      | The two cross-tenant pre-checks (duplicate registration id, duplicate bank account) run **only** through `runElevated('onboarding duplicate pre-check', …)` and are therefore audited (M-014, M-030) |
| `audit/`   | `AUDIT_WRITE_PORT`                                                                                     | `BR-DAT-07`: issuing a signed KYC URL writes the audit row **before** the URL is returned. The ordering is the control, not a convention                                                             |

External dependencies through `§4.5` anti-corruption layers: **DEP-05** object storage (the segregated
KYC bucket, own KMS key, **no CDN**), **DEP-08** the optional KYC verification vendor (null adapter is
the launch default), and the geocoding adapter behind the maps ACL.

**Delivering milestones:** M-027, M-029, M-030, M-036.

## 6. Emitted events

_Planned. No code in this module yet - populated by the milestones listed below._

Every payload additionally carries `tenant_id` and `occurred_at`, and **no personal datum** (`E5`,
`BR-DAT-06`). The outbox row is written inside the same interactive transaction as the state change
(`E2`, ADR-0017); a rolled-back submission dispatches nothing.

| Event                        | Payload beyond the two universals       | Known consumers                                        |
| :--------------------------- | :-------------------------------------- | :----------------------------------------------------- |
| `application.submitted`      | `application_id`, `version`             | `admin/`, `notifications/`                             |
| `application.approved`       | `application_id`, `tenant_id`, `gym_id` | `catalog/`, `settlements/`, `notifications/`, `admin/` |
| `application.rejected`       | `application_id`, `reason_codes[]`      | `notifications/`, `admin/`                             |
| `application.info-requested` | `application_id`, `reason_codes[]`      | `notifications/`, `admin/`                             |

`application.approved` starts `FR-ONB-13`'s **sixty-second** clock: approval to live listing. The
chain is `onboarding → catalog (gyms.status) → discovery (search.reindex)`, and the budget is spent
across all three (M-036, M-043, `BAC-02`).

Analytics events (`§C6` Tenant lifecycle) are a separate taxonomy and are not domain events:
`owner_signup_started`/`completed`, `onboarding_step_completed`,
`application_submitted`/`approved`/`rejected`.

> **Conflict, recorded not resolved.** `engineering/Architecture.md` §5 states that _"`onboarding/`
> owns the approval state machine and emits `gym.approved`"_, while `ModuleDependency.md` §8.2 — the
> event catalogue — lists `gym.approved` as published by `catalog/` and `application.approved` as the
> onboarding event `catalog/` consumes. This file follows `ModuleDependency.md` §8.2, the later and
> more specific document. The two must be reconciled before the first handler is written; per
> `CLAUDE.md` §9.3 the reconciliation is an owner decision recorded in `DECISION_LOG.md`, not a
> choice made in code.

**Delivering milestones:** M-028 (`application.submitted`), M-036 (the three decision events).

## 7. Consumed events

_Planned. No code in this module yet - populated by the milestones listed below._

| Event                           | Publisher  | Handler idempotency key  |
| :------------------------------ | :--------- | :----------------------- |
| `gym.material-change-submitted` | `catalog/` | `gym_id` + `revision`    |
| `config.changed`                | `admin/`   | `config_key` + `version` |
| `flag.changed`                  | `admin/`   | `flag_key` + `version`   |

One domain event, and it is the interesting one. `BR-GYM-06` returns an **approved** gym to review
when a material field changes — legal name, address, geo-location, ownership — while the listing
stays live. `catalog/` owns the `MaterialFieldRegistry` and decides that a change is material;
`onboarding/` owns what happens next, because re-review is a `§C4.4` transition and this module owns
that machine. The handler is idempotent on `(gym_id, revision)`: the dispatcher may deliver more than
once (`E3`), and a duplicate delivery must not open a second review.

`config.changed` matters here specifically because the KYC checklist is configuration
(`FR-ADMN-06`): a checklist edit must **not** retroactively invalidate in-flight applications, which
is why the version in force is snapshotted rather than referenced.

**Delivering milestones:** M-035 (the registry that emits it, in `catalog/`), M-028 (the transition
it drives, here).

## 8. Jobs

_Planned. No code in this module yet - populated by the milestones listed below._

**No `§C5` job is owned by this module.** All twenty-four are enumerated in `MASTER_PRD.md` §C5 and
placed in `Scalability.md` §8.3.1; none carries the `onboarding` queue. That is a real property, not
an omission: nothing in the verification workflow advances on a timer. An application moves because a
human moved it (`BR-GYM-03`), and the one thing that _is_ automated — the pre-check suite — runs on
submission, not on a schedule.

Two BullMQ processors are nevertheless owned here, both on the M-018 harness with a distributed lock,
a `job_runs` record, metrics and a duration alert:

| Processor                      | Trigger                                     | Lock scope                                                                                   | Notes                                                                                                                                                                                                                                                                                                  |
| :----------------------------- | :------------------------------------------ | :------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onboarding.run-prechecks`     | On submission (event-driven, not scheduled) | Per `(application_id, version)` — a re-run **replaces** the result set rather than appending | The six `FR-ONB-12` checks: geo-distance, duplicate address, duplicate registration id, duplicate bank account, image quality, profanity. `PrecheckOutcome` has **no rejecting member** in the type, so "a pre-check never auto-rejects" is structural. A geocoder outage yields `ERROR`, never `PASS` |
| `data.retention-sweep` (child) | Weekly, owned by `admin/`                   | Platform, `data.retention-sweep:platform:{isoWeek}`                                          | Onboarding contributes the `R-KYC` child sweep: the object is purged and `storage_purged_at` set; **the row is tombstoned, never deleted**                                                                                                                                                             |

**Expected duration and queue placement for `onboarding.run-prechecks` are not fixed by the
specification.** `Scalability.md` §8.3.1 covers the twenty-four `§C5` jobs only, and §8.10's grammar
(_"queue name: `<module>`"_) implies `onboarding`, but that is an inference. Name both in the
milestone that builds it rather than defaulting silently.

**Delivering milestones:** M-030 (`run-prechecks` and the six checks), M-018 (the harness).

## 9. Top three failure modes (`NFR-MNT-09`)

Declared in `PROJECT_CONSTITUTION.md` §18.5.1 and not re-derived here.

|  #  | Failure mode                            | Signal                                                                                                                   | First action                                                                                                                                                                                                                                                      |
| :-: | :-------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **KYC storage unavailable**             | 5xx on `POST /v1/tenant/kyc-documents`; `thirdparty_circuit_state{dependency="DEP-05"} == 2` (`ALRT-13`, S2)             | Confirm the failure is the **segregated KYC bucket** and not the media bucket — they are separate buckets under separate keys. Pull `rel.onboarding.kyc-upload`: the KYC step shows an explicit maintenance state and stored documents stay readable to reviewers |
|  2  | **Pre-check (geocoding) provider down** | `precheck_outcome_total{outcome="ERROR"}` rising; `ALRT-13` on the maps dependency                                       | Verify the reviewer is seeing _"could not be checked"_ and **not** a pass. An `ERROR` silently coerced to `PASS` is worse than no check at all. Submission must not be blocked (`DEP-02`)                                                                         |
|  3  | **Verification queue SLA breach**       | `application_queue_oldest_age_hours > 24` or `application_queue_depth > 40`, hourly 09:00–21:00 IST (**`ALRT-35a`**, S3) | Split the queue: blocked awaiting the tenant (`INFO_REQUESTED`) versus awaiting us. `KPI-03` (≤ 48 h to a live listing) and the `§C9.4` city gate both depend on the second number                                                                                |

**Runbook: [`/docs/runbooks/onboarding.md`](../../../../docs/runbooks/onboarding.md)** ·
owner **Operations** · primary alerts `ALRT-35a`, `ALRT-13` (`DEP-08`).

> `Monitoring.md` §9.6 names this runbook `verification-queue.md`, while `FolderStructure.md` §8.3
> row 9 and its §9.12 worked example require `/docs/runbooks/<module>.md`. The file is written at
> `onboarding.md`; the naming conflict is flagged in the runbook itself and needs one owner decision
> across all twenty-three modules.
