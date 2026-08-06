# staff runbook

> **Status: stub.** `NFR-MNT-09` requires a runbook per module covering its top three failure modes.
> The three below are fixed by `PROJECT_CONSTITUTION.md` §18.5.1. The eight-field per-mode structure
> of `Monitoring.md` §9.1 — symptom, alert, blast radius, diagnose, mitigate, fix, verify, prevent —
> is filled in by the milestones named under **Dashboards and queries**; `RB2` requires every query
> here to have been **run**, and none can be before the tables exist.
>
> **No filename conflict here.** `Monitoring.md` §9.6 names this runbook `staff.md` and
> `FolderStructure.md` §8.3 row 9 requires `/docs/runbooks/<module>.md`. The two agree, unlike
> `catalog` and `discovery`.

## Scope

`staff/` owns the employment relationship between a platform identity and a gym business: **which
humans act for this tenant, in what role, at which branches**. `iam/` owns who someone *is* —
credentials, sessions, the role catalogue, the permission matrix; `staff/` owns whether that identity
is currently a `GYM_OWNER`, `GYM_MANAGER`, `RECEPTIONIST` or `TRAINER` **for this tenant**. It owns
`staff`, `staff_branches` and `staff_invitations`. `staff_branches` carries `tenant_id`
**redundantly** so the RLS policy applies without a join — a join inside a policy is a performance
cliff on every branch-scoped query in the system. `staff_invitations` stores `token_hash char(64)`
and never the raw token, holds one live invitation per address per tenant by a partial unique index
`WHERE consumed_at IS NULL`, and **fixes role and branches at invitation time**: the accept endpoint
reads them from the row and ignores anything in the request body.

Two invariants live here and nowhere else, because both are counts over a filtered set that no
`CHECK` can express and that a trigger would evaluate under a race: **a tenant must always retain at
least one `ACTIVE` `GYM_OWNER`** (`FR-STAF-09`, `FR-RBAC-07`) and **`ACTIVE` seats must not exceed
`subscription_tiers.max_staff_seats`** (`FR-STAF-06`). Both run in the aggregate under the same row
lock as the write. A stored `staff_count` column on `tenants` is the obvious implementation and is
the `BR-FIN-01` mistake in a different domain — a number that can be wrong with no way to tell which
side is right.

It publishes `STAFF_QUERY_PORT` (to `crm/`, `ordering/`, `attendance/`, `reviews/`, `reporting/`) and
`STAFF_INVITATION_PORT` (to `onboarding/`, wizard step 6). It consumes exactly five targets:
`common/`, `tenancy/`, `audit/`, `iam/` (`USER_QUERY_PORT`, `ROLE_QUERY_PORT`) and `catalog/`
(`BRANCH_QUERY_PORT`). It owns **no `§C5` job**; the roadmap adds two —
`staff.invitation-expiry` (hourly, M-077) and `staff.seat-reconcile` (nightly, M-079) — and both need
a `§C5` catalogue row before `ALRT-22`'s dead-man threshold can be computed for them.

**Blast radius when this module is down.** Existing sessions keep working: authorisation is evaluated
by `common/`'s guard against the permission epoch, and a cached epoch is a fast path, not a
dependency. What stops is **staff administration** — inviting, accepting, role changes, suspension,
removal — and, more consequentially, the four L4 modules that ask `STAFF_QUERY_PORT` a question they
need answered synchronously: `attendance/` for override authority and branch scope at the desk
(`BR-CHK-08`), `ordering/` for offline-sale attribution, `reviews/` for who may publish an owner
response, `crm/` for note and lead assignment. A degraded `staff/` at 07:00 therefore shows up as a
**receptionist who cannot override a denied check-in**, which is why some failures here escalate
above their apparent severity.

**Kill switches** (`ADR-0026`). `rel.staff.trainer-sessions` is **off for all of Phase 1** (`OQ-15`)
and renders the Phase-2 stub for `/trainers/sessions`; trainers keep their assigned-member list and
workout-plan assignment. `FR-STAF-08` (duty roster) is descoped **D-03**. **Not flaggable:** anything
in `FR-RBAC-01` … `FR-RBAC-07`, the last-owner invariant, the seat check, or `BR-TEN-01`. The
permission epoch has no flag either, and M-079 says why: *"a half-propagating permission system is
not a state anyone should be able to select."*

## Top failure modes

| Signal | Likely cause | First action | Escalation |
| :--- | :--- | :--- | :--- |
| **1 — Seat limit blocking a legitimate invite.** `409 STAFF_SEAT_LIMIT_REACHED` rate rising for one tenant, and `gym.staff.seat_excess > 0` from the nightly `staff.seat-reconcile`. Symptom: an owner cannot add a receptionist and believes they have bought seats they cannot use | The seat count is filtering wrongly — a `REMOVED`, `SUSPENDED` or soft-deleted row occupying a seat it should not; a tier change that has not propagated to `subscription_tiers.max_staff_seats`; or `INVITED` rows being counted (or not counted) inconsistently between the invitation path and the reconcile job | Count `ACTIVE`, non-soft-deleted staff for the tenant and compare it against the tier allowance **by hand** before touching anything. A `REMOVED` or soft-deleted row **must not** occupy a seat; if it does, the defect is the filter, not the tier. Confirm the count is taken under `SELECT … FOR UPDATE` on the tenant row **inside** the invitation transaction — two concurrent invitations at the last seat must produce exactly one success. And check the `409` body: it **must name the upgrade path**, because a refusal with no route forward is the actual product failure, independent of whether the number was right | Ticket to Backend Lead (platform). Not a page. Escalate to Product if the tier allowance itself is the constraint being hit routinely, because that is a packaging question (`A6.2`), not an incident |
| **2 — Invitation delivery failure.** **`ALRT-38`** — `notification_delivery_total{status=~"FAILED\|BOUNCED"}` above 10% for a channel over 15 m — and, for India specifically, **`ALRT-46`** / `notification_dlt_rejections_total{reason="TEMPLATE_NOT_APPROVED"}`. Symptom: an invited colleague never receives the link, and the owner re-sends repeatedly | In India an SMS failure is more often **regulatory than technical**: TRAI DLT requires the sender header and every message template to be pre-registered, and an edited template must go back through approval before it can send. Otherwise: a bounced or mistyped address, a provider outage (`ALRT-13`, `DEP-03`), or an expired invitation the owner cannot see | Check the SMS template's **DLT approval state first**, before the provider, before the address. Send must refuse on a non-`APPROVED` template and fall back to **email** with the reason recorded (`REG-05`, `LAUNCH_MARKET_INDIA.md` §8) — if it did not fall back, that is the defect and it is larger than this invitation. `DLT_ENTITY_BLOCKED` means no SMS at all, platform-wide, and is a different incident entirely. Then confirm the invitation row still exists and is unexpired; **re-inviting supersedes rather than duplicating**, by the partial unique index, so a resend is always safe | Ticket to Backend Lead (notifications) with Backend Lead (platform) on the invitation half. `ALRT-46`'s `DLT_ENTITY_BLOCKED` pages on-call, the Technical Lead **and** the client sponsor — only the registered entity can resolve it with the operator. A blocked invitation is not gym-critical on its own; a blocked SMS channel is, because it also carries OTP |
| **3 — Last-owner protection triggered unexpectedly.** A `GYM_OWNER` removal **or demotion** refused where the tenant appears to have several owners. Symptom: an owner handing over the business cannot complete the handover | The other owners are `INVITED` (never accepted) or `SUSPENDED` — neither counts. Or a soft-deleted owner is being counted as absent by one path and present by another. Genuine defects are rare here; the usual finding is that the tenant really does have one active owner | Enumerate `ACTIVE`, non-soft-deleted `GYM_OWNER` rows for the tenant and read the statuses out loud. **Protection fires on demotion as well as removal** — both paths call the same aggregate invariant, and demotion is the path a real tenant actually takes, so a refusal on demote is correct behaviour, not a bug. A concurrency test demoting the last two owners simultaneously must let exactly one succeed. If the refusal is genuinely wrong, **the fix is to activate a second owner**, never to bypass the guard | Ticket to Backend Lead (platform). Never a page and never an override: a tenant with zero active owners is unrecoverable through the product's own UI, which is precisely why the invariant exists. Escalate to the Technical Lead only if the count differs between the aggregate and a direct query, because that means two readers of one invariant |

## Dashboards and queries

_To be populated by **M-077** (the three tables, the `Staff` aggregate, the seat-accounting service
and `staff.invitation-expiry`), **M-078** (`BranchScope` and the server-side scoping sweep) and
**M-079** (the permission epoch, the role-change / suspend / remove use cases,
`staff.seat-reconcile` and the activity read model)._

Intended content, named now so those milestones have a target:

- **Panel — seat occupancy.** `ACTIVE` non-soft-deleted staff per tenant against
  `subscription_tiers.max_staff_seats`, with the `gym.staff.seat_excess` gauge from the nightly
  reconcile beside it. **The only acceptable steady-state value of `seat_excess` is 0**; a persistent
  non-zero value means the invitation path and the reconcile job are counting differently, which is
  the failure mode 1 diagnosis rendered as a chart.
- **Panel — invitation funnel.** Invitations issued → delivered → accepted → expired, split by
  channel, with `notification_delivery_total{status}` for the `staff-invitation` template and
  `notification_templates_pending_dlt_current` overlaid. An SMS template sitting in
  `PENDING_DLT_APPROVAL` for more than 72 hours is an S3 ticket in its own right (`ALRT-46`) and is
  visible here before anyone notices the invitations failing.
- **Panel — permission propagation.** Time from a role, branch or status change to the epoch bump
  being observed by the guard, against the `FR-RBAC-04` **60-second** requirement, plus the rate of
  guard re-resolves. A rising re-resolve rate with Redis healthy means the epoch is being bumped far
  more often than roles are changing.
- **Query — owner integrity.** Every tenant, with its count of `ACTIVE`, non-soft-deleted
  `GYM_OWNER` rows. A tenant at **zero** is an unrecoverable state and must never appear; a tenant at
  exactly one is the population that will hit failure mode 3, and is worth watching before the
  handover rather than during it.
- **Query — seats occupied by rows that should not occupy them.** `staff` rows counted toward a
  tenant's seat total whose `status` is `REMOVED` or `SUSPENDED`, or whose `deleted_at` is set. This
  must return zero rows; it is the single fastest test of whether failure mode 1 is a filter defect
  or a genuine tier limit.
- **Query — live invitations and their state.** Per tenant: unexpired, unconsumed invitations with
  role, branch set, channel and `dlt_template_id` approval state, and the age of each. Read-only and
  `LIMIT`-bounded, and it must **never select the token hash** — `RB5` and `RB6`.
- **Query — orphaned branch assignments.** `staff_branches` rows whose `branch_id` no longer resolves
  to an `ACTIVE` branch of the same tenant. Role and branches are frozen at invitation, so a branch
  deactivated afterwards leaves a scope entry pointing at nothing — a staff member scoped to zero
  usable branches looks to the product like a permissions bug.
- **Query — attribution after removal.** For a removed staff member, the `attendance` rows, `orders`
  and `audit_log` entries that still resolve to their name (`AC-STAF-01.4`). This is the check that
  proves a removal preserved history rather than orphaning it, and it is the verification step for
  any incident that touched the removal path.
- **Data recovery note.** `staff` is soft-deleted, so recovery is an **unset of `deleted_at`**, not a
  restore — but recovery is rarely the right move: removal is meant to be a real revocation, and
  re-inviting produces a clean row with a fresh role and branch decision. **Never hard-delete a
  removed staff row to "clean up"**: it orphans every attendance row and order they attributed and
  turns an audit trail into a list of nulls. `staff_branches` is `G-CRUD-D` — a hard delete is the
  correct domain operation there, and a lost assignment is re-created, not restored.
  `staff_invitations` are marked lapsed by `staff.invitation-expiry` and **not deleted**, so the
  history of who was invited to what survives.

## Known incidents

_None yet._
