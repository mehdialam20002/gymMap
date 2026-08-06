# crm

**Charter (PRD §C1.3):** _members, segments, notes, leads._

---

## 1. Bounded context

`crm/` owns the decision **who, in this tenant's own book, a person is** — the gym's record of a
human being, which is deliberately _not_ the platform's record of a user account. `iam/` owns the
identity someone signs in with; `crm/` owns the row the front desk types a walk-in into with a name
and a phone and nothing else (`FR-CRM-04`), the human-readable `member_code` the counter can say out
loud, the private note staff write that the member must never see, and the enquiry sitting on a lead
board before it is a sale. The two are joined by a nullable `user_id` that carries **no foreign key**,
and that absence is the whole point: `BR-DAT-04` erasure of the platform user must be able to
complete while the tenant's operational record survives in pseudonymised form, and a `RESTRICT` would
block a statutory process at the worst possible moment. `crm/` is **L3** in `ModuleDependency.md` §2 —
tenant-configured operating data that knows nothing about money or transactions — which is why every
membership, order and visit fact it displays arrives as an **event-fed projection**, never as a
synchronous read upward into L4.

## 2. PRD identifiers

| Class                            | Identifiers                                                                                                                                                                                                                                                                                     |
| :------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional                       | `FR-CRM-01` … `FR-CRM-10` (`§B5.14`). `FR-CRM-09` duplicate merge is MoSCoW **C**, descoped **D-04**. `FR-ONB-15` bulk import lands here as the CRM writer.                                                                                                                                     |
| Business rules **owned**         | None exclusively. `crm/` is the co-owner of `BR-MEM-12` (an `EXPIRED` membership retains full historical visibility to both member and gym, indefinitely) and `BR-RFL-01` (+`ordering/`, referral attribution).                                                                                 |
| Business rules **enforced here** | `BR-TEN-01` (every table RLS-scoped), `BR-DAT-01` (notes and imports audited with actor), `BR-DAT-03` (+`reporting/` — a tenant sees only its own members), `BR-DAT-04` (+`iam/` — erasure completes without a blocking FK), `BR-DAT-05` (export is a right, and `ALRT-38B` watches its volume) |
| Non-functional                   | `NFR-PRV-03` (erasure), `NFR-PRV-07` (health and fitness information is a **sensitive category** with restricted access and no marketing use), `NFR-DQ-04` (soft delete), `NFR-MNT-09`                                                                                                          |
| State machine                    | **Lead** — `NEW → CONTACTED → TRIAL → CONVERTED \| LOST`. Not one of the eight `§C4` machines; it is declared in `Schema.md` §5.5 (`lead_status_enum`) and `SCR-DASH-017`.                                                                                                                      |
| Jobs                             | **`§C5`** — `crm.risk-flags` (nightly)                                                                                                                                                                                                                                                          |
| API                              | The member, note and lead rows of `API-TEN`: `/tenant/members*`, `/tenant/members/:id/notes`, `/tenant/members/import`, `/tenant/leads*`                                                                                                                                                        |
| Screens served                   | `SCR-DASH-007` (member list), `SCR-DASH-008` (Member 360), `SCR-DASH-017` (leads), `SCR-DASH-001` (the action list)                                                                                                                                                                             |
| Acceptance                       | `AC-CRM-01.1` … `-01.3`, `AC-ONB-03.1` … `-03.4`; `E2E-10` is the sprint-exit journey                                                                                                                                                                                                           |
| Commercial gate                  | CRM beyond the plain member list is **Growth tier and above** (`A6.2`): a Starter tenant gets the list and `402 TIER_UPGRADE_REQUIRED` on segments, at-risk and the leads board                                                                                                                 |

## 3. Owned tables

_Planned. No code in this module yet - populated by the milestones listed below._

| Table          | Grants / class                             | Why it is shaped this way                                                                                                                                                                                                                                                                                                                                                                                                            | Source           |
| :------------- | :----------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- |
| `crm_members`  | RLS · P-STD · R-OPS · G-CRUD + soft delete | The tenant's record of a person. `user_id` carries **no FK** (see §1). `member_code` is unique per tenant and allocated **inside** the creating transaction — a `MAX(code)+1` read outside it produces duplicates under exactly the load a busy front desk creates. `merged_into_id` is a self-FK: duplicate resolution keeps both rows and the loser points at the winner.                                                          | `Schema.md` §5.5 |
| `member_notes` | RLS · P-STD · R-OPS · G-CRUD               | Staff-authored, timestamped, attributed, and **never visible to the member** — asserted as structural absence over the generated OpenAPI document, not by inspection. `is_sensitive_category` gates read at the authorisation layer **and excludes the note from every export** unless the requester holds the elevated permission (`NFR-PRV-07`). `editable_until` makes it mutable by its author for a window and immutable after. | `Schema.md` §8.4 |
| `leads`        | RLS · P-STD · R-OPS · G-CRUD + soft delete | An enquiry at a branch that is not yet a member. `converted_order_id` is the sale the conversion produced.                                                                                                                                                                                                                                                                                                                           | `Schema.md` §5.5 |
| `segments`     | RLS · P-STD · R-OPS · G-CRUD + soft delete | `definition jsonb` is a **filter definition re-evaluated on read — never a materialised member list**. A materialised list goes stale the moment a member checks in, and `AC-CRM-01.3` requires the at-risk flag to clear automatically.                                                                                                                                                                                             | `Schema.md` §8.4 |

`crm_members.balance_due_minor` is a **derived projection** of `orders`, written by order events and
never typed in by a human. Money stays where `BR-PAY-09` put it, and the collect-balance action links
to the order rather than editing the figure.

> **Specification variance to resolve (do not resolve in code).** `Milestones_060-089.md` M-082
> creates an **`import_jobs`** table (kind, status, `column_mapping`, `natural_key_hash`, row counts,
> `error_report_url`, `dry_run`) under `crm/`. That table is **not** among the 79 tables of
> `Schema.md` §15.1, and `balance_due_minor` is likewise absent from the `crm_members` column list in
> `Schema.md` §5.5 while being an explicit acceptance criterion of M-080. Both need a `Schema.md`
> amendment and a `DECISION_LOG.md` entry before the migrations are authored.

**Delivering milestones.** **M-080** creates `crm_members`, `member_notes` and `leads` with their RLS
policies and grants in one migration, plus the member-code generator and the walk-in path. **M-081**
adds `segments` and the covering indexes for the nine filter dimensions. **M-082** adds `import_jobs`
and the streamed CSV importer.

## 4. Public surface

_Planned. No code in this module yet - populated by the milestones listed below._

| Exported symbol                                  | Kind                                            | Consumers                                                                                                                                                                                                                                  |
| :----------------------------------------------- | :---------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MEMBER_QUERY_PORT`, `type MemberQueryPort`      | Question + read-model port                      | `ordering/` (eligibility: age minimum, gender policy, existing relationship — `FR-CART-07`), `memberships/` (the member a membership belongs to), `billing/` (bill-to party), `support/` (`FR-SUP-02` contextual attachment), `reporting/` |
| `type MemberSummaryView`, `type LeadSummaryView` | Read models owned here                          | `support/`, `reporting/`, `admin/`                                                                                                                                                                                                         |
| `CRM_PERMISSIONS`                                | Permission constants, `crm.<resource>.<action>` | `iam/`, `admin/` (`FR-RBAC-05`)                                                                                                                                                                                                            |

No event payload type is exported, because no event is published (see §6).

Controllers exist here — `crm/` is not one of the four provider-only modules of `FolderStructure.md`
§8.2. Planned: `members.controller.ts`, `member-notes.controller.ts`, `leads.controller.ts`,
`segments.controller.ts`, `member-import.controller.ts`. Every list, filter, segment evaluation,
export and mutation is **branch-scoped** through `BranchScope` (see §5) as well as tenant-scoped, and
the refusal-versus-filtering choice is per operation and deliberate: a _list_ is filtered to the
scope; an _action on a named member outside the scope_ is refused with `403`.

**Delivering milestones.** M-080 (module skeleton, `index.ts`, `permissions.ts`, three controllers),
M-081 (`segments.controller.ts` and the Member 360 / action-list queries), M-082 (the import
controller).

## 5. Consumed ports

_Planned. No code in this module yet - populated by the milestones listed below._

| Port                            | Provider | Why the answer must be synchronous                                                                                                                   |
| :------------------------------ | :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| `USER_QUERY_PORT` (§3.2 row 7)  | `iam/`   | A member record that _does_ correspond to a platform account is anchored to that identity at creation (`FR-CRM-01`).                                 |
| `STAFF_QUERY_PORT` (§3.2 row 8) | `staff/` | Notes and leads carry an assigned staff member, and `assigned_trainer_staff_id` must resolve to a real, active staff row (`FR-CRM-04`, `FR-CRM-08`). |
| `BranchScope` resolution        | `staff/` | Every list and mutation is scoped to the caller's assigned branches before it is executed, not filtered afterwards (`FR-STAF-03`, `TR-12`).          |
| `common/`, `tenancy/`, `audit/` | —        | Universal edges (§3.1).                                                                                                                              |

That is the complete set. `crm/` is L3, and the §4 matrix gives it exactly five permitted synchronous
targets: `common`, `tenancy`, `audit`, `iam`, `staff`.

> **Conflict — halting, not resolvable in code (`CLAUDE.md` §9.3).** `Milestones_060-089.md` **M-081**
> specifies `apps/server/src/crm/infrastructure/adapters/attendance-attendance-query.adapter.ts` and
> makes it an acceptance criterion that _"the at-risk computation reads attendance only through
> `attendance-query.port.ts`"_. That is a **synchronous L3 → L4 import**, and the
> `ModuleDependency.md` §4 matrix marks the `crm → att` cell **—**, with §4.2 naming the closely
> related `crm → memberships` as forbidden for exactly this reason: _"`crm/` receives
> `membership.activated` / `.expired` and maintains its own projection, which is also what
> `FR-CRM-06`'s at-risk flag needs."_ Under the precedence order in `CLAUDE.md` §2, `ModuleDependency.md`
> wins and the roadmap does not — so **§5 above is written without the attendance edge**, and the
> at-risk baseline must be computed from a `crm/`-owned projection fed by `checkin.recorded`. This
> must be recorded in `DECISION_LOG.md` and M-081 amended **before** the milestone is built;
> `dependency-cruiser` will fail the build otherwise, which is the intended outcome.

## 6. Emitted events

_Planned. No code in this module yet - populated by the milestones listed below._

**None.** No event in the `ModuleDependency.md` §8.2 catalogue of fifty-two has `crm/` as its
publisher, and that is a property of the module's position rather than an omission: `crm/` is a
**terminal projection** of facts other modules own. A membership activating, a visit being recorded,
an order being paid — each is already published by the module that owns the decision, and re-emitting
a `crm.member-updated` derived from those would give downstream consumers two sources for one fact
and a guaranteed eventual disagreement.

The §4 matrix does reserve two **event-only** edges out of this module — `crm → notifications` and
`crm → reporting` — with no catalogued event yet occupying them. The obvious future occupant is
`FR-CRM-07` bulk notification to a filtered list: `notifications/` is L7 and cannot be imported from
L3, so when that ships it ships as an event, and it gets a §8.2 row at that point rather than being
invented at the call site.

## 7. Consumed events

_Planned. No code in this module yet - populated by the milestones listed below._

This is where the module actually gets its content. Every handler is idempotent (`E3`) and imports
nothing from the publisher (`E7`).

| Event                              | Publisher      | Handler idempotency key            | What the handler maintains                                                                                                                                                            |
| :--------------------------------- | :------------- | :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `user.registered`                  | `iam/`         | `user_id`                          | Links a new platform account to an existing walk-in row where the phone matches.                                                                                                      |
| `membership.created`               | `memberships/` | `membership_id`                    | The member's membership projection on `SCR-DASH-008`.                                                                                                                                 |
| `membership.activated`             | `memberships/` | `membership_id` + `activation_seq` | Status, term and the expiring-soon action list.                                                                                                                                       |
| `membership.expired`               | `memberships/` | `membership_id` + `end_date`       | The lapsed cohort, and the `BR-MEM-12` historical view that must remain visible indefinitely.                                                                                         |
| `membership.suspended-for-sharing` | `memberships/` | `membership_id` + `occurred_at`    | Surfaces the `BR-MEM-13` review state to staff.                                                                                                                                       |
| `checkin.recorded`                 | `attendance/`  | `attendance_id`                    | **Clears `risk_flagged_at` immediately** (`AC-CRM-01.3`) and feeds the per-member attendance baseline. Driven by the event, not by the nightly job, so the list is never a day stale. |
| `checkin.denied`                   | `attendance/`  | `attempt_id`                       | Denial history on Member 360, so a member complaining they _"could not get in"_ has an answer.                                                                                        |

Two consumers that the roadmap requires and the §8.2 catalogue does not yet declare, flagged for the
same `DECISION_LOG.md` entry as §3: `balance_due_minor` is _"written by the order events"_ (M-080
AC 7) but §8.2 lists `order.paid`'s consumers as `ledger/`, `billing/`, `memberships/` — not `crm/`;
and `Architecture.md` §10 lists `crm/` as a consumer of `order.created` (lead state) and
`payment.failed`, neither of which `ModuleDependency.md` §8.2 records.

## 8. Jobs

_Planned. No code in this module yet - populated by the milestones listed below._

| Job              | `§C5`?                    | Schedule                                                                                                                            | Lock scope              | Expected duration                                                                                                                                                                                                         |
| :--------------- | :------------------------ | :---------------------------------------------------------------------------------------------------------------------------------- | :---------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `crm.risk-flags` | **Yes**                   | Nightly, **at the gym's local hour** via the M-063 zone primitive — never a whole-hour UTC cron, because `Asia/Kolkata` is `+05:30` | Per zone and local date | Not published in `§C5` or `Monitoring.md`; the envelope is declared by M-081 and asserted by `ALRT-21`. It **recomputes from source** rather than incrementing, which is what makes it idempotent (`Architecture.md` §11) |
| `member-import`  | **No — roadmap addition** | On demand (BullMQ), resumable from the last committed row                                                                           | Per `import_job_id`     | Streamed: a 10,000-row file completes without buffering. Runs on the `maintenance` queue, whose `ALRT-20` envelope is depth 1,000 / age 3,600 s                                                                           |

The at-risk rule is a **per-member baseline**, not a platform constant: average weekly visits over the
last eight weeks dropped by more than the configured threshold. A platform-wide _"fewer than 2 visits
a week"_ threshold is the trap — a member whose baseline is one visit a week has not lapsed; a member
whose baseline is five and now visits twice has. The segment shows baseline, current frequency and
last-visit date so the owner can judge rather than trust (`AC-CRM-01.1`).

Behind `rel.crm.at-risk-flagging`. With the flag **off**, the nightly recomputation is skipped, the
at-risk column and saved segment disappear, and the dashboard action list falls back to _"no visit in
21 days"_ — a plain filter that needs no baseline. Bulk notification keeps working, so the owner can
still act on a cruder signal.

## 9. Top three failure modes

`NFR-MNT-09`. The three are declared in `PROJECT_CONSTITUTION.md` §18.5.1 — see
**[`/docs/runbooks/crm.md`](../../../../docs/runbooks/crm.md)**.

|  #  | Declared mode                                                                                            | Signal                                                                                                                                                                                                           | First action                                                                                                                                                                                                                                                                                                            |
| :-: | :------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **Import job partial failure**                                                                           | `ALRT-20` on the `maintenance` queue (depth > 1,000 or oldest job > 3,600 s for 15 m; zero active workers with depth > 0 always pages), plus an `import_jobs` row stuck between `total_rows` and `imported_rows` | Read the job's `natural_key_hash` and re-run the same file: the import is idempotent on `(tenant_id, normalised phone)`, so a re-run after fixing three rows imports exactly three. **A revert does not roll back imported members** — that is a data operation, and the `import_job_id` filter is what identifies them |
|  2  | **Segment recomputation lag** — _see the note below; the accurate reading is at-risk baseline staleness_ | `ALRT-21` / `ALRT-22` on `crm.risk-flags` (failure, duration overrun, or dead-man at 2× the nightly interval), and `risk_flagged_at` values older than one local day                                             | Confirm the job ticked at the gym's local hour and not at 00:00 UTC. Then confirm the `checkin.recorded` consumer is draining — the flag is supposed to clear on the event, so a stale _set_ flag is the job and a stale _cleared_ flag is the outbox (`ALRT-21B`)                                                      |
|  3  | **Export size exceeding synchronous budget**                                                             | `ALRT-38B` data-egress anomaly: `export_rows_total` > 5× the trailing-7-day same-hour baseline, any single export over 250,000 rows, or `http_response_size_bytes` p99 above its route budget                    | Read `audit_log` for the export events — which actor, which tenant, which entity, was the session impersonated? Tenant export is a right under `BR-DAT-05`, and an unusual export volume is also what exfiltration looks like; the two are distinguished by the actor, not by the size                                  |

> **On failure mode 2.** The constitution names _"segment recomputation lag"_, but `Schema.md` §8.4
> and M-081 AC 3 both require a segment to be a **definition re-evaluated on read, never a
> materialised list** — so there is nothing named "segment" that recomputes. The thing that does
> recompute nightly is the **per-member attendance baseline** behind the at-risk flag. Read the
> declared mode as that, and treat any proposal to cache a materialised segment as the incident's
> root cause rather than its fix: the member checks in, the flag clears on the row, and the cached
> list still names them. A stale at-risk list is worse than none, because it trains the owner to
> ignore the feature.

No rule in `BR-DAT-*` is flag-disableable. `rel.crm.at-risk-flagging` turns off a _signal_, never
tenant isolation, note visibility or the sensitive-category export exclusion.
