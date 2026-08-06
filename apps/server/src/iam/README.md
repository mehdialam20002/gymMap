# iam

**Charter (PRD §C1.3):** _auth, sessions, users, roles, permissions, impersonation._

---

## 1. Bounded context

`iam/` owns the answer to **"who is this principal, has the claim been proven, and what may they
do"** — identity, credential, session, and the `(role, scope, resource, action)` permission
decision. No other module may mint or rotate a session, decide that an actor holds a capability, or
evaluate authorisation from a role alone. It owns identity but **never tenancy**: it _asks_
`tenancy/` which tenant a session is scoped to (`TENANT_RESOLUTION_PORT`) and never resolves one
itself, which is why it sits at **L2**, between the isolation layer and every domain module.
`ModuleDependency.md` §2.1 puts the reason plainly — _everything tenant-scoped needs to know who the
actor is, and `iam/` needs tenancy and audit_. It is the only L0–L2 module with controllers.

## 2. PRD identifiers

| Class                      | Identifiers                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional — auth          | `FR-AUTH-01` … `FR-AUTH-14` (registration by OTP or password · verified phone before purchase · Google social login · Argon2id + breached-list · the six OTP limits · 15-min access / 30-day rotating refresh with reuse revocation · mandatory staff MFA · 10-in-15 lockout · session list and revocation · reset invalidates all sessions · one identity across many tenants · impersonation · staff invitations · duplicate-account merge) |
| Functional — authorisation | `FR-RBAC-01` … `FR-RBAC-07` (every endpoint declares a permission or fails CI · server-side enforcement, never UI hiding · evaluated against the tenant **on the resource** · 60-second propagation without re-authentication · effective-permission inspection · role- and branch-scoped invitations · last-`GYM_OWNER` protection)                                                                                                          |
| Functional — user          | `FR-USER-05` (account activity log: logins, devices, impersonations, exports), `FR-USER-08` (a contact change requires verification of the **new** value)                                                                                                                                                                                                                                                                                     |
| Business rules             | `BR-TEN-02` (tenant switching explicit and audited; no cross-tenant action in one request), `BR-DAT-01`, `BR-DAT-02` (impersonation), `BR-DAT-04` (erasure / pseudonymisation), `BR-DAT-06`                                                                                                                                                                                                                                                   |
| Non-functional             | `NFR-SEC-06` (`RL-AUTH`, `RL-OTP` — tier-1, fail-closed), `NFR-SEC-07` (secrets and token hashing), `NFR-SEC-11` (MFA mandatory for platform staff), `NFR-SEC-01`                                                                                                                                                                                                                                                                             |
| PRD sections               | **§B3.1** (the twelve roles), **§B3.2** (the matrix — 43 capabilities × 12 roles = **516 cells**), **§C1.4 step 1** (the request layer resolves the principal)                                                                                                                                                                                                                                                                                |
| ADRs / stack               | `ADR-0011` (refresh-token families and reuse detection), `A-12` (Argon2id parameters, recorded)                                                                                                                                                                                                                                                                                                                                               |
| C4 state machines          | **None.** `users.status` and `auth_sessions.status` are simple lifecycles; the `StateMachines.md` catalogue assigns `iam/` no `§C4` machine.                                                                                                                                                                                                                                                                                                  |
| `§C5` jobs                 | **None.** See §8.                                                                                                                                                                                                                                                                                                                                                                                                                             |

## 3. Owned tables

_Planned. No code in this module yet — populated by the milestones listed below._

| Table              | Tenancy class                                                                                                                | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| :----------------- | :--------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`            | **IDENTITY** — no `tenant_id`, **no RLS**, scoped by `user_id` and protected by authorisation · R-OPS · G-CRUD · soft delete | `ck_users__has_contact` — at least one of `email`/`phone`, because an India walk-in member may have only a phone. Both unique indexes are **partial on `deleted_at IS NULL`** so a soft-deleted account frees its address (`SD7`). Erasure nulls `email`, `phone`, `full_name`, `password_hash`, sets `pseudonym_token` and `erased_at`, and runs as `app_migrator` — **never** `app_rw` (`SD5`, `SD8`)                                                                                  |
| `user_roles`       | **IDENTITY** · G-CRUD                                                                                                        | Carries a `tenant_id` column **and no policy** — the single such table in the schema, with an explicit, reviewed `CI-01` exception and a recorded reason. An RLS policy here would make every platform-role row (`tenant_id IS NULL`) invisible to every session, and the symptom would be super-admins losing their own permissions. The nullable column **is** the platform/tenant discriminator. Revocation is `revoked_at`, never a delete, so attribution survives (`AC-STAF-01.4`) |
| `roles`            | **GLOBAL** · R-REF · **G-REF**                                                                                               | Exactly the twelve `§B3.1` roles, typed so a row cannot invent a scope; a thirteenth requires a PRD amendment                                                                                                                                                                                                                                                                                                                                                                            |
| `permissions`      | **GLOBAL** · G-REF                                                                                                           | ~180 atomic capabilities, slug-like keys (`admin.settlements.read_all`). `FR-RBAC-01` **fails CI** on an undeclared permission                                                                                                                                                                                                                                                                                                                                                           |
| `role_permissions` | **GLOBAL** · G-REF                                                                                                           | Composition of the two. Writes only through the audited `admin/` path                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `auth_sessions`    | **IDENTITY** · R-EPH (90 d) · G-CRUD                                                                                         | `family_id` unique — reuse detection keys on it                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `refresh_tokens`   | **IDENTITY** · R-EPH · **G-COMPLETE**                                                                                        | `SELECT, INSERT` plus `UPDATE (used_at, superseded_by_id)` **and nothing else** — Deviation **D-04**. Rotation must leave an unforgeable chain; a rewritten generation defeats reuse detection, which is why nothing else is grantable. The token itself is never stored, only its SHA-256                                                                                                                                                                                               |

MFA state (`mfa_enrolled_at`, `mfa_secret_encrypted`, `mfa_recovery_codes_hashed`) arrives as
nullable **expand**-phase columns on `users` (M-024).

**Not owned here, despite sharing `Schema.md` §4.** `notification_preferences` (§4.9) is
`notifications/`'s (M-109); `staff`, `staff_branches`, `staff_invitations` (§4.10) are `staff/`'s
(M-077) — a staff member is a _user with roles_, and the employment relation is a different
aggregate; `tenants` is `tenancy/`'s.

**Delivering milestones:** **M-019** (`users` … `role_permissions`, the reviewed CI exception, the
twelve roles and ~180 permissions seeded, `SEED_VERSION → 0.2`) · **M-022** (`auth_sessions`,
`refresh_tokens`) · **M-024** (MFA columns).

## 4. Public surface

_Planned. No `index.ts` exists in this module yet — populated by the milestones listed below._

| Exported symbol                                                                                                                | Consumers                                                                                                                                   | Milestone    |
| :----------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ | :----------- |
| `USER_QUERY_PORT`                                                                                                              | `catalog/` (owner and manager attribution, §3.2 edge 3), `staff/` (edge 5), `crm/` (a member record is anchored to a user identity, edge 7) | M-019        |
| `ROLE_QUERY_PORT`                                                                                                              | `staff/` (edge 5 — role definitions live here, `FR-STAF-01`, `FR-RBAC-01`)                                                                  | M-023        |
| `USER_CONTACT_PORT`                                                                                                            | `notifications/` (edge 44 — resolve channel addresses and preferences **at send time, never earlier**, `FR-NOTF-05`, `BR-DAT-06`)           | M-109        |
| `IAM_PERMISSIONS`                                                                                                              | `admin/`, and the `FR-RBAC-01` CI gate that enumerates every module's constants                                                             | M-019        |
| Event payload **types** — `UserRegisteredPayload`, `UserEmailVerifiedPayload`, `ImpersonationStartedPayload` / `…EndedPayload` | `crm/`, `notifications/` — so a consumer types its handler without importing this module's domain (`E7`)                                    | M-020, M-025 |

**Controllers exist here** — `iam/` is not one of the four provider-only modules. One controller,
`auth.controller.ts`, carrying: `POST /v1/auth/register` · `login` · `password/forgot` ·
`password/reset` (M-020) · `otp/request` · `otp/verify` (M-021) · `refresh` · `logout` ·
`GET`/`DELETE /v1/auth/sessions[/:id]` (M-022) · `mfa/enrol` · `mfa/verify` · `DELETE /v1/auth/mfa`
(M-024) · `impersonate` · `impersonate/end` (M-025).

**Where the guards live, and why not here.** `JwtAuthGuard`, `PermissionsGuard`, `MfaGuard`,
`ImpersonationRestrictionGuard` and `ResourceTenantGuard` are in **`common/guards/`**, not in
`iam/`. `iam/` owns the _decision_ — the `§B3.2` matrix as **data** (never as conditionals), the
resolution use case, the permission cache and its explicit invalidation. `common/` owns the
_interception point_, because a guard must be attachable by every module without any of them
importing `iam/`.

> **A gap, recorded rather than papered over.** `ModuleDependency.md` §3.2 names only four edges
> into `iam/` explicitly (rows 3, 5, 7, 44), and rows 45–47 cover `support/`, `reporting/` and
> `admin/` generically as `*_QUERY_PORT`. The §4 matrix, however, marks **sixteen** consumers — the
> remaining nine (`ordering/`, `memberships/`, `attendance/`, `reviews/`, `payments/`, `billing/`,
> `refunds/`, `settlements/`) hold a `●` with **no named port**. Those ports must be named in
> `ModuleDependency.md` §3.2 before the first of those modules is built. No token name has been
> invented here to fill the table.

## 5. Consumed ports

_Planned. No code in this module yet — populated by the milestones listed below._

| From       | Port                                   | Why the answer is needed **synchronously**                                                                                                                                                                                                                                               |
| :--------- | :------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenancy/` | `TENANT_RESOLUTION_PORT` (§3.2 edge 1) | A session cannot be issued without knowing the tenant it is scoped to (`FR-AUTH-11`, `BR-TEN-02`). The tenant is minted **into the token**; there is no later moment at which a wrong claim could be corrected, and `INV-TEN-3` forbids two tenant-scoped roles resolving in one request |
| `audit/`   | `AUDIT_WRITE_PORT` (§3.2 edge 2)       | Impersonation start/stop must be written **before** the elevated session exists (`FR-AUTH-12`, `BR-DAT-02`). A token that exists before its audit row is a token whose use is unattributable, which is exactly the state `BR-DAT-02` forbids                                             |
| `common/`  | The universal edge (§3.1)              | `Clock` (TOTP compares against wall time and must be testable), the error registry, `RL-AUTH`/`RL-OTP` rate-limit classes, the idempotency interceptor, `UnitOfWork`, the redaction deny-list                                                                                            |

`iam/`'s matrix row shows `●` for exactly these three and `▲` — event only — toward `crm/` and
`notifications/`. It imports no domain module, which is what keeps L2 beneath L3.

**Delivering milestones:** **M-011** (resolution port and the scaffold guard) · **M-013** (audit
write) · **M-022**, **M-025** (the impersonation path that makes edge 2 load-bearing).

## 6. Emitted events

_Planned. No code in this module yet — populated by the milestones listed below._

| Event                              | Payload (beyond `tenant_id`, `occurred_at`) | Known consumers                                                                           |
| :--------------------------------- | :------------------------------------------ | :---------------------------------------------------------------------------------------- |
| `user.registered`                  | `user_id`, `origin`                         | `crm/`, `notifications/`                                                                  |
| `user.email-verified`              | `user_id`                                   | `notifications/`                                                                          |
| `impersonation.started` / `.ended` | `actor_id`, `subject_id`, `reason_code`     | `audit/` **(via the interceptor — a synchronous write, not a handler)**, `notifications/` |

Rule **`E5`** bites hardest here and is the thing to get right: **no payload carries an email, a
phone number, a name or any other personal datum.** `notifications/` resolves contact points at send
time through `USER_CONTACT_PORT`, which is `FR-NOTF-05` and `BR-DAT-06` expressed as an event
contract rather than a policy. Every row is written to the `outbox` **inside** the same interactive
transaction as the state change (`E2`).

**Delivering milestones:** **M-020** (`user.registered`, `user.email-verified`) · **M-025**
(`impersonation.*`).

## 7. Consumed events

**None.** No row in the `ModuleDependency.md` §8.2 catalogue names `iam/` as a consumer, and its
matrix row is outbound-only (`▲` toward `crm/` and `notifications/`).

The reason is a design decision, not an omission: **an identity decision must be synchronous and
must not depend on the dispatcher's liveness.** An eventually-consistent permission is an
authorisation bug — `FR-RBAC-04`'s 60-second propagation is achieved by **cache invalidation with
explicit keys**, not by an outbox handler and not by shortening the token TTL. Flag and configuration
changes reach this module through `common/config`, as they do every other (`ModuleDependency.md` §0
**C-3**).

## 8. Jobs

**`iam/` owns none of the twenty-four `§C5` jobs.** No entry in the `Scalability.md` §8.3 placement
table names an `iam` queue.

Two scheduled behaviours are nonetheless owned here, and are named so nobody goes looking for a
`§C5` row that does not exist:

| Behaviour                                                                                   | How it runs                                                                                                                                                                                                                                                                            |
| :------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R-EPH sweeps** — `auth_sessions` (90 days) and `refresh_tokens` (refresh TTL + 30 days)   | A `data.retention-sweep` **child** (job 23, `admin`-parented, weekly, P4). The parent fans out one child per owning module, each in its own queue under its own lock; the parent enforces dry-run-first and assembles the report, the children do the deleting (`Scalability.md` §8.3) |
| **`BR-DAT-04` erasure** — nulling identifiers, populating `pseudonym_token` and `erased_at` | The same child, running as **`app_migrator`**, never as `app_rw` (`SD5`, `SD8`). The work item is a `data_subject_requests` row, so `CON-04`'s partial fulfilment has somewhere to record what could not be deleted and why                                                            |

**OTP state needs no sweep at all.** It is Redis-only — `otp:code:{purpose}:{phone_hmac}` holding an
HMAC with a 300-second TTL, plus resend and per-IP counters. No PostgreSQL row is written, so an
abandoned OTP flow leaves nothing behind (`SM1`, M-021).

**Delivering milestones:** **M-018** (the harness) · **M-021** (the Redis OTP store) · the `admin/`
band for job 23.

## 9. Top three failure modes (`NFR-MNT-09`)

Declared by `PROJECT_CONSTITUTION.md` §18.5.1. Runbook: **[`/docs/runbooks/iam.md`](../../../../docs/runbooks/iam.md)**

|  #  | Failure mode                      | Signal                                                                                                                                                                             | First action                                                                                                                                                                                                                                                                                                                                                                                     |
| :-: | :-------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **OTP provider unavailable**      | `ALRT-13` on `DEP-03` — `thirdparty_circuit_state` open, or `thirdparty_call_duration_seconds` degrading; `auth_failures_total` rising with users unable to complete `LOGIN`       | Confirm the **email fallback** engaged: the correct response to an SMS rail outage is `202` with `channel: 'EMAIL'`, and only a _both-rails-down_ condition is `503 DEPENDENCY_UNAVAILABLE`. If DLT is implicated, check `notification_dlt_rejections_total` — a rejected template means the previous approved version keeps sending, and somebody must be told                                  |
|  2  | **Refresh-token reuse spike**     | `ALRT-32` — **any** `increase(refresh_token_reuse_detected_total[5m]) > 0`. **S1**, pages the security owner                                                                       | Decide first whether this is theft or the **parallel-tab false positive** (`TR-28`): a mobile browser restoring two tabs refreshes twice within milliseconds, and a naive implementation logs both users out and calls it a security event. Genuine reuse needs no containment action — the family is already revoked by design; the work is identifying the `session_id` and notifying the user |
|  3  | **Permission evaluation latency** | Route p95 rising across _all_ permissioned endpoints simultaneously; `cache_operations_total{cache="permissions", result="miss"}` climbing; `ALRT-33` if it is pulling connections | Check the permission cache's hit rate and whether an invalidation storm is in progress — a role change is supposed to invalidate explicit keys, not flush the cache. **Do not "fix" this by shortening the token TTL**: `FR-RBAC-04` is served by invalidation, and a shorter TTL moves the load to `POST /v1/auth/refresh`                                                                      |
