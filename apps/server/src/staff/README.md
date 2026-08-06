# staff

**Charter (PRD §C1.3):** _staff, invitations, branch assignment._

---

## 1. Bounded context

`staff/` owns the decision **which humans act for this tenant, in what role, at which branches** — the
employment relationship between a platform identity and a gym business. `iam/` owns who someone _is_
(credentials, sessions, the role catalogue and the permission matrix); `staff/` owns whether that
identity is currently a `GYM_OWNER`, `GYM_MANAGER`, `RECEPTIONIST` or `TRAINER` **for this tenant**,
which branches that grants, and whether the seat they occupy is within the tier the tenant pays for.
Two invariants live here and nowhere else, because both are counts over a filtered set that no
`CHECK` constraint can express and that a trigger would evaluate under a race: **a tenant must always
retain at least one `ACTIVE` `GYM_OWNER`** (`FR-STAF-09` / `FR-RBAC-07`), and **`ACTIVE` seats must
not exceed `subscription_tiers.max_staff_seats`** (`FR-STAF-06`). Both are checked in the aggregate
under the same row lock as the write. The module is **L3**, and it never learns what a staff member
did — only what they may do.

## 2. PRD identifiers

| Class                            | Identifiers                                                                                                                                                                                                                                                                          |
| :------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional                       | `FR-STAF-01` … `FR-STAF-09` (`§B5.15`). `FR-STAF-07` trainer sessions is MoSCoW **S**, gated behind `rel.staff.trainer-sessions` and expected to stay **off** for all of Phase 1 (`OQ-15`); `FR-STAF-08` duty roster is MoSCoW **C**, descoped **D-03**.                             |
| Enforces                         | `FR-RBAC-01` … `FR-RBAC-07` — every route declares a permission; branch scope is resolved from the session and from the **resource**, never from the request; a role change propagates within 60 seconds without re-authentication; the last owner cannot be removed **or demoted**. |
| Business rules **co-owned**      | `BR-CHK-08` (+`attendance/`) — a manual or override check-in is marked with the staff identity and a reason, and override usage is reportable **per staff member**, which is the `staff/` half of the rule                                                                           |
| Business rules **enforced here** | `BR-TEN-01` (all three tables RLS-scoped; `staff_branches` carries `tenant_id` redundantly so RLS applies without a join), `BR-DAT-01` (every role, status and assignment change audited)                                                                                            |
| Non-functional                   | `NFR-SEC-07` (invitation tokens stored hashed, `char(64)`, single-use, expiring, bound to the invited identifier), `NFR-MNT-09`                                                                                                                                                      |
| State machine                    | **Staff status** — `INVITED → ACTIVE → SUSPENDED ⇄ ACTIVE → REMOVED` (`FR-STAF-04`). Not one of the eight `§C4` machines; declared in `Schema.md` §4.10 (`staff_status_enum`). Removal revokes access immediately and preserves **all** historical attribution.                      |
| Jobs                             | **None in `§C5`.** See §8.                                                                                                                                                                                                                                                           |
| API                              | The `/tenant/staff*` rows of `API-TEN`                                                                                                                                                                                                                                               |
| Screens served                   | `SCR-DASH-018` (staff), `SCR-ADM-005` (user administration and the effective-permission inspector)                                                                                                                                                                                   |
| Acceptance                       | `AC-STAF-01.1` … `-01.4`                                                                                                                                                                                                                                                             |
| Commercial input                 | `A6.2` subscription tiers supply `max_staff_seats`                                                                                                                                                                                                                                   |

## 3. Owned tables

_Planned. No code in this module yet - populated by the milestones listed below._

| Table               | Grants / class                             | Why it is shaped this way                                                                                                                                                                                                                                                                                                                                                                              | Source            |
| :------------------ | :----------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| `staff`             | RLS · P-STD · R-OPS · G-CRUD + soft delete | The employment of a platform identity by a tenant. `ck_staff__role_is_tenant_scoped` limits `role` to the four tenant-assignable values at the **database**, not only in Zod — a `SUPER_ADMIN` value is refused by `CHECK`. `uq_staff__tenant_user` is partial on `deleted_at IS NULL`. `invited_at` / `joined_at` / `removed_at` are kept because removal must preserve attribution (`AC-STAF-01.4`). | `Schema.md` §4.10 |
| `staff_branches`    | RLS · P-STD · R-OPS · **G-CRUD-D**         | Branch scoping. Carries `tenant_id` **redundantly** so the RLS policy applies without a join — a join in a policy is a performance cliff and a correctness risk on every branch-scoped query in the system.                                                                                                                                                                                            | `Schema.md` §4.10 |
| `staff_invitations` | RLS · P-STD · R-OPS · G-CRUD (TTL)         | One live invitation per address per tenant, by a partial unique index `WHERE consumed_at IS NULL`; re-inviting supersedes rather than duplicating. `token_hash char(64)` is unique and the raw token is never stored. Role and branches are **fixed at invitation time** and read from this row on acceptance — the accept endpoint ignores anything in the request body.                              | `Schema.md` §4.10 |

**Last-owner protection is not a constraint, and that is deliberate.** It is a count over a filtered
set (`status = 'ACTIVE' AND role = 'GYM_OWNER' AND deleted_at IS NULL`), which no `CHECK` can express
and which a trigger would evaluate under a race. It lives in the `Staff` aggregate and runs under the
same row lock as the write. The seat limit is likewise a use-case guard reading
`subscription_tiers.max_staff_seats` — **a stored `staff_count` column on `tenants` is the obvious
implementation and it is the `BR-FIN-01` mistake in a different domain**: a number that can be wrong
with no way to tell which side is right.

The **staff activity log** (`FR-STAF-05`) owns **no table**. It is a read model over `audit_log`,
`attendance` and `orders` — see the conflict note in §5.

**Delivering milestones.** **M-077** creates all three tables with their RLS policies, grants,
partial unique indexes and the `role` check in one migration, plus the `Staff` aggregate holding the
last-owner invariant and the seat-accounting service. **M-079** adds the permission epoch, the
role-change / suspend / remove use cases and the activity read model.

## 4. Public surface

_Planned. No code in this module yet - populated by the milestones listed below._

| Exported symbol                                            | Kind                                              | Consumers                                                                                                                                                                                                                                                  |
| :--------------------------------------------------------- | :------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STAFF_QUERY_PORT`, `type StaffQueryPort`                  | Question + read-model port                        | `crm/` (notes and leads carry an assigned staff member), `ordering/` (offline-sale attribution, `FR-CART-11`), `attendance/` (override authority and branch scope, `BR-CHK-08`), `reviews/` (who may publish an owner response, `FR-REV-06`), `reporting/` |
| `STAFF_INVITATION_PORT`, `type StaffInvitationPort`        | Command port                                      | `onboarding/` — wizard step 6 invites staff inside the application transaction (`FR-ONB-07`)                                                                                                                                                               |
| `type StaffSummaryView`, `type EffectivePermissionView`    | Read models owned here                            | `admin/` (`SCR-ADM-005`), `reporting/`                                                                                                                                                                                                                     |
| `type StaffInvitedPayload`, `type StaffDeactivatedPayload` | Event payload types                               | `notifications/`                                                                                                                                                                                                                                           |
| `STAFF_PERMISSIONS`                                        | Permission constants, `staff.<resource>.<action>` | `iam/`, `admin/` (`FR-RBAC-05`)                                                                                                                                                                                                                            |

Controllers exist here — `staff/` is not one of the four provider-only modules of
`FolderStructure.md` §8.2. Planned: `staff-invitations.controller.ts`, `staff.controller.ts` and
`staff-activity.controller.ts`, each with its own isolation spec.

> **Specification conflict — `BranchScope` (halting; do not resolve in code).**
> `Milestones_060-089.md` M-078 places `BranchScope` at `staff/domain/branch-scope.vo.ts` — a **value
> object** — and its guard at `common/guards/branch-scope.guard.ts`, then makes it a required
> parameter on branch-aware repository methods in `attendance/`, `memberships/` and `ordering/`. Two
> binding rules say that cannot stand as written:
>
> - `ModuleDependency.md` §7.1 forbids exporting **domain value objects** from a module's `index.ts`.
> - `common/` imports **no module** — it is the sink of the dependency graph (§3.1) — so a guard in
>   `common/guards/` cannot import a type from `staff/domain/`.
>
> The shape that satisfies both is a **branded contract type in `packages/types` (or `common/`)** with
> the _resolution_ — `BranchScope.fromSession(principal)`, reading `staff_branches` — remaining a
> `staff/` service behind a port. That preserves M-078's real requirement, which is that the type be
> **unconstructable from a request body**: no `fromRequest`, no `fromDto`, no public `all()`. Record
> the decision in `DECISION_LOG.md` before M-078 begins; the sweep lands whole or not at all, and a
> half-applied scope is worse than none.

**Delivering milestones.** M-077 (`index.ts`, `permissions.ts`, the invitation port and controller),
M-078 (`BranchScope` and the scoping sweep), M-079 (the staff and activity controllers, the
effective-permission inspector).

## 5. Consumed ports

_Planned. No code in this module yet - populated by the milestones listed below._

| Port                                                             | Provider   | Why the answer must be synchronous                                                                                                                                                                                                                                                                |
| :--------------------------------------------------------------- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `USER_QUERY_PORT`, `ROLE_QUERY_PORT` (§3.2 row 5)                | `iam/`     | A staff member **is** a user with roles, and the role definitions live in `iam/`. An invitation cannot be issued for a role that does not exist, and acceptance must bind to the invited identifier — accepting while authenticated as a different email or phone is `403`, not a silent re-bind. |
| `BRANCH_QUERY_PORT` (§3.2 row 6)                                 | `catalog/` | Branch assignment must resolve to a branch that exists and belongs to this tenant, at the moment the invitation is written (`FR-STAF-03`). Role and branches are frozen at invitation, so a later-deleted branch cannot be caught afterwards.                                                     |
| `ReferenceDataRepository` → `subscription_tiers.max_staff_seats` | `common/`  | The seat limit is read inside the invitation transaction, under `SELECT … FOR UPDATE` on the tenant row. Platform-global configuration is read through `common/`, **never** by importing `admin/` (`ModuleDependency.md` §0 C-3).                                                                 |
| `AUDIT_WRITE_PORT`                                               | `audit/`   | Universal edge. Every role, status and assignment change is audited (`BR-DAT-01`).                                                                                                                                                                                                                |
| `common/`, `tenancy/`                                            | —          | Universal edges.                                                                                                                                                                                                                                                                                  |

That is the complete set. The §4 matrix gives `staff/` exactly five permitted synchronous targets:
`common`, `tenancy`, `audit`, `iam`, `catalog`.

> **Conflict — the staff activity log (halting; do not resolve in code).**
> `Milestones_060-089.md` M-079 specifies `staff/infrastructure/staff-activity.query.ts` reading
> _"`audit_log`, `attendance` and `orders` through their query ports"_. The §4 matrix marks both
> `staff → att` and `staff → ord` as **—** (forbidden in both directions): `staff/` is L3 and both
> targets are L4. It also matters that `FolderStructure.md` §8.2 scopes
> `audit/ports/audit-read.port.ts` to `admin/` only — the universal `* → audit/` edge carries
> `AUDIT_WRITE_PORT`, not the read port.
>
> `FR-STAF-05` is a real requirement and `AC-STAF-01.3` is testable, so the question is only _where_
> it lives. Two shapes satisfy the graph: make it a **`reporting/` read model** (L7 may read `staff`,
> `attendance`, `ordering` and `audit`, and is provably write-free), or keep it in `staff/` as an
> **event-fed projection** built from `checkin.recorded`, `order.paid` and the audit stream. The first
> is cheaper and is the module the matrix already designed for wide reads. Record the choice in
> `DECISION_LOG.md` before M-079 is built.

## 6. Emitted events

_Planned. No code in this module yet - populated by the milestones listed below._

| Event               | Payload beyond `tenant_id` / `occurred_at` | Known consumers  | Idempotency key for the consumer |
| :------------------ | :----------------------------------------- | :--------------- | :------------------------------- |
| `staff.invited`     | `staff_id`, `branch_ids[]`                 | `notifications/` | `staff_id` + `occurred_at`       |
| `staff.deactivated` | `staff_id`, `branch_ids[]`                 | `notifications/` | `staff_id` + `occurred_at`       |

Two events, and no personal datum in either: the invitee's email and phone are resolved by
`notifications/` at send time through `USER_CONTACT_PORT`, never carried in the payload (`E5`,
`BR-DAT-06`, `FR-NOTF-05`).

> **Specification variance (flagged, not resolved).** `Architecture.md` §10 lists a
> `role.changed` / `staff.changed` event published by `iam/` and `staff/`, payload `userId` +
> `permVersion`, consumed by a permission-counter increment for the `FR-RBAC-04` 60-second
> propagation. `ModuleDependency.md` §8.2 has no such row, and `Milestones_060-089.md` M-079
> implements the same requirement as a **Redis permission epoch** compared per request rather than as
> an event. Three documents, three mechanisms for one requirement. Settle it in `DECISION_LOG.md`
> before M-079; the epoch is the strongest of the three, because it makes the token's claims
> _checkable_ rather than _trusted_ and fails **closed** to a database re-resolve when Redis is
> unavailable.

## 7. Consumed events

_Planned. No code in this module yet - populated by the milestones listed below._

**None from the domain.** `staff/` sits at L3 and every state change it holds — an invitation issued,
accepted, superseded or expired; a role changed; a staff member suspended or removed — originates in
this module's own controllers or its own job. There is no upstream module whose decision changes a
staff row, so there is nothing to subscribe to, and inventing a subscription would only create a
second writer for the last-owner and seat invariants that §1 exists to keep single.

The two platform broadcasts of `ModuleDependency.md` §8.2 reach here as they reach every module:
`config.changed` (key `config_key` + `version`) and `flag.changed` (key `flag_key` + `version`), both
consumed through `common/config` rather than by importing `admin/`. `rel.staff.trainer-sessions` is
evaluated that way.

## 8. Jobs

_Planned. No code in this module yet - populated by the milestones listed below._

**No `§C5` job.** None of the twenty-four background jobs in the PRD belongs to `staff/`, and that is
consistent with the module's shape: nothing here transitions on a clock the way a membership expires
or a settlement batch closes.

The roadmap nevertheless adds two, and both are **additions to the `§C5` catalogue** rather than
implementations of it:

| Job                       | `§C5`?                            | Schedule                                       | Lock scope              | Expected duration                                                                                                                   |
| :------------------------ | :-------------------------------- | :--------------------------------------------- | :---------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `staff.invitation-expiry` | **No — roadmap addition (M-077)** | Hourly, per tenant zone on the M-063 primitive | Per zone and local date | Trivial; it marks lapsed invitations **without deleting them**                                                                      |
| `staff.seat-reconcile`    | **No — roadmap addition (M-079)** | Nightly                                        | Per tenant              | Trivial; asserts `ACTIVE` seats ≤ tier allowance and emits `gym.staff.seat_excess`, whose only acceptable steady-state value is `0` |

Both need a `§C5` row and a `DECISION_LOG.md` entry before they are built: `Monitoring.md` §3.5 sizes
`job_duration_seconds` at _"24 `§C5` jobs × buckets"_, and a job with no catalogue row has no declared
interval, which means `ALRT-22`'s dead-man threshold (2× the declared interval) cannot be computed for
it.

## 9. Top three failure modes

`NFR-MNT-09`. The three are declared in `PROJECT_CONSTITUTION.md` §18.5.1 — see
**[`/docs/runbooks/staff.md`](../../../../docs/runbooks/staff.md)**.

|  #  | Declared mode                                    | Signal                                                                                                                                                                                                     | First action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| :-: | :----------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **Seat limit blocking a legitimate invite**      | `409 STAFF_SEAT_LIMIT_REACHED` rate rising for one tenant, and `gym.staff.seat_excess > 0` from the nightly reconcile                                                                                      | Count `ACTIVE`, non-soft-deleted staff for the tenant and compare against `subscription_tiers.max_staff_seats`. A `REMOVED` or soft-deleted row **must not** occupy a seat; if it does, the count is filtering wrongly rather than the tier being too small. The `409` must always **name the upgrade path** — a refusal with no route forward is the actual product failure                                                                                                                     |
|  2  | **Invitation delivery failure**                  | `ALRT-38` — `notification_delivery_total{status=~"FAILED\|BOUNCED"}` over 10% for a channel — and, for India specifically, `ALRT-46` / `notification_dlt_rejections_total{reason="TEMPLATE_NOT_APPROVED"}` | Check the SMS template's TRAI **DLT approval state** before anything else: send must refuse on a non-`APPROVED` template and fall back to **email** with the reason recorded (`REG-05`, `LAUNCH_MARKET_INDIA.md` §8). Then confirm the invitation row still exists and is unexpired — re-inviting supersedes rather than duplicating, so a resend is always safe                                                                                                                                 |
|  3  | **Last-owner protection triggered unexpectedly** | A `GYM_OWNER` removal or **demotion** refused where the tenant appears to have several owners                                                                                                              | Enumerate `ACTIVE`, non-soft-deleted `GYM_OWNER` rows for the tenant. The usual cause is that the other owners are `INVITED` (never accepted) or `SUSPENDED`, neither of which counts. **Protection fires on demotion as well as removal** — both paths call the same aggregate invariant — and a concurrency test demoting the last two owners simultaneously must let exactly one succeed. If the refusal is genuinely wrong, the fix is to activate a second owner, never to bypass the guard |

`rel.staff.trainer-sessions` off renders the Phase-2 stub for `/trainers/sessions`; trainers keep
their assigned-member list and workout-plan assignment. Nothing in `FR-RBAC-01` … `FR-RBAC-07`, the
last-owner invariant or `BR-TEN-01` is flag-disableable.
