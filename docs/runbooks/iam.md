# iam runbook

**Module:** `iam/` · **Layer:** L2, identity · **Owner:** Backend Lead (platform)
**Module README:** [`apps/server/src/iam/README.md`](../../apps/server/src/iam/README.md)
**Satisfies:** `NFR-MNT-09` · **Failure modes declared by:** `PROJECT_CONSTITUTION.md` §18.5.1
**Primary alerts:** `ALRT-32` (authentication anomaly), `ALRT-13` (`DEP-03`, the SMS rail)

> **Status: stub.** The failure modes, signals and first actions below are derived from the
> specification and are binding. Dashboards, queries and incident history are populated by the
> milestones named in each section.
>
> **Naming note.** `Monitoring.md` §9.6 lists this runbook as `runbooks/auth-anomaly.md`.
> `FolderStructure.md` §8.3 requires `/docs/runbooks/<module>.md`, and the M-019, M-022 and M-025
> file lists name `docs/runbooks/iam.md`. **This file is that runbook.** Do not create a second one.

---

## Scope

`iam/` answers *who is this principal, has the claim been proven, and what may they do*. It owns
registration by phone OTP or by email and password, Argon2id credentials with a breached-password
check and a 10-in-15-minutes lockout, the 15-minute access token and the 30-day httpOnly rotating
refresh token with family-wide reuse revocation, TOTP MFA — mandatory for all platform staff roles
and optional for `GYM_OWNER` — the twelve `§B3.1` roles and the 516-cell `§B3.2` permission matrix
held as **data** rather than as conditionals, and support impersonation: a distinctly-typed token,
capped at 30 minutes, carrying a mandatory reason, unable to execute any financial mutation, and
visible to the impersonated user in their own account activity. It resolves the *actor*; it never
resolves the *tenant* — that answer comes from `tenancy/` through `TENANT_RESOLUTION_PORT`, and the
tenant is minted into the token where no later moment exists to correct it.

**Dependencies.** Downward: `common/` (clock, error registry, `RL-AUTH` / `RL-OTP`, idempotency),
`tenancy/` (`TENANT_RESOLUTION_PORT`), `audit/` (`AUDIT_WRITE_PORT` — impersonation start/stop is
written *before* the elevated session exists). Upward: sixteen modules consume it. External:
`DEP-03` the SMS rail (TRAI DLT-governed), the email rail, the breached-password service
(k-anonymity range query), the managed secret store (JWT signing keys, TOTP secret encryption),
Redis (OTP state, permission cache, rate limits, the `family_id` revocation denylist).
**Owned tables:** `users`, `user_roles`, `roles`, `permissions`, `role_permissions`,
`auth_sessions`, `refresh_tokens`.

**Kill switches.** `rel.iam.password-authentication` — *off*, the password routes return `404` and
phone OTP is the only path, which is the `FR-AUTH-01` consumer default anyway.
`rel.iam.phone-otp-login` — *off*, the OTP routes return `404` and email plus password is the only
path; Redis keys expire in 300 s so a rollback leaves no residue.
`rel.iam.session-rotation` — *off*, refresh tokens are issued but not rotated on use: strictly
weaker, still functional, keeps users logged in while a rotation defect is diagnosed.
`rel.iam.mfa-enrolment` — gates the *enrolment surface* only.
`ops.iam.impersonation` (kill-switch, default **on**) — *pulled*, no new impersonation session can
start and existing ones expire naturally within 30 minutes; support falls back to read-only account
inspection.

**Never flagged, and never to be:** reuse detection, family revocation, the mandatory staff MFA gate
(`NFR-SEC-11`), the `PermissionsGuard` itself, and the `@FinancialMutation()` prohibition under
impersonation. `FEATURE_FLAGS.md` §2.2 forbids flagging a security control off; `M-023`'s rollback
is `git revert` of the whole milestone for exactly this reason.

## Top failure modes

| # | Signal | Likely cause | First action | Escalation |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **OTP provider unavailable.** `ALRT-13` on `DEP-03` — `thirdparty_circuit_state` open or `thirdparty_call_duration_seconds` degrading; `auth_failures_total` rising with users unable to complete `purpose: LOGIN`; `notification_dlt_rejections_total` if TRAI DLT is implicated | SMS vendor outage or throttling; a DLT template rejected or a header deregistered (`TEMPLATE_NOT_APPROVED`, `HEADER_NOT_REGISTERED`, `DLT_ENTITY_BLOCKED`); or the per-IP / per-number budget doing its job during an abuse wave | Confirm the **email fallback engaged**: the designed behaviour is still `202` with `channel: 'EMAIL'` and `fallback: 'EMAIL'`, and only a *both-rails-down* condition is `503 DEPENDENCY_UNAVAILABLE`. If the cause is DLT, the previous **approved** template version keeps sending and somebody must be told — see `ALRT-46` and the DLT template runbook. Do not raise the OTP limits to "get through it": the ₹0.15-per-message cost makes an unbounded OTP endpoint a direct financial exposure (`CON-02`), which is why the per-IP ceiling exists **independently** of the per-number one | S2, or S1 if OTP is the only live authentication path in the current release. Ticket Backend Lead (platform); notify Backend Lead (notifications) for the rail |
| **2** | **Refresh-token reuse spike.** `ALRT-32` — **any** `increase(refresh_token_reuse_detected_total[5m]) > 0`. Users report being logged out of every device at once | Either genuine token theft and replay — a session hijack — or the **parallel-tab false positive** (`TR-28`): a mobile browser restoring two tabs refreshes twice within milliseconds, and a naive implementation revokes the family and calls it a security event | Decide which it is **before** acting, because the two need opposite responses. Concentration on one `session_id`/`actor_id` with a plausible client, and a cluster of near-simultaneous refreshes on the same family, points to the false positive — the fix is the grace window on the immediately-previous generation, or the rotation lock. Genuine reuse needs **no containment action**: the family is already revoked by design; the work is identifying the user and notifying them. Check `auth_failures_total` alongside — concentrated on one account is targeted, spread across many is credential stuffing | **S1.** Page the security owner; on-call assists with tightening `RL-AUTH` / `RL-OTP`. `ALRT-32` also fires on `rate(auth_failures_total[10m])` exceeding 5× the trailing-7-day same-hour baseline |
| **3** | **Permission evaluation latency.** Route p95 rising across *all* permissioned endpoints at once; `cache_operations_total{cache="permissions", result="miss"}` climbing; `ALRT-33` if it starts pulling database connections | A role change invalidating too broadly (a flush rather than explicit keys); the cache cold after a Redis restart; or the matrix being evaluated per request instead of read from the cached resolved set | Check the permission cache hit rate and whether an invalidation storm is in progress — `FR-RBAC-04` is served by **explicit invalidation on role change**, not by a flush. **Do not shorten the token TTL to "propagate faster"**: that is expressly the wrong lever, and it moves the load onto `POST /v1/auth/refresh`, which is a heavier path. Verify the 60-second propagation requirement is still met while you diagnose | S2. Ticket Backend Lead (platform); on-call if `ALRT-33` is co-firing, because pool pressure here affects every module |

## Dashboards and queries

_To be populated by **M-020** (credentials, lockout, `RL-AUTH`), **M-021** (OTP and the fallback),
**M-022** (sessions, rotation, reuse detection), **M-023** (the matrix and the cache) and **M-025**
(impersonation)._ The intended content:

- **Authentication panel:** `auth_failures_total` by `reason` against its trailing-7-day same-hour
  baseline; `refresh_token_reuse_detected_total` (must be a flat zero — its shape *is* the signal);
  lockout rate; login success rate split by method (password / OTP / social).
- **Enumeration guard:** response-status, body-shape and **timing-band** parity for a registered
  versus an unregistered address or number. `purpose: 'LOGIN'` for a number with no account must
  return the same `202`, the same body and the same timing band — a `404` here is an enumeration
  oracle and is forbidden, not merely breaking.
- **OTP panel:** request and verify rates; the five limits at their boundaries (6 digits, 300 s
  validity, 5 verify attempts, 3 sends per 30 min per number, 30 s cool-down, 20 ops/hour per IP);
  captcha-required rate above 10 per-IP ops/hour; fallback-to-email rate; `DEP-03` circuit state.
  Cost belongs on this panel too — `notification_cost_minor_total{channel="SMS"}` is the abuse
  signal that a request-count graph hides.
- **Session panel:** active sessions, rotations per minute, family revocations, and the
  concurrent-refresh distribution that distinguishes `TR-28` from theft.
- **Permission panel:** `cache_operations_total{cache="permissions"}` hit ratio, evaluation p95,
  role-change propagation time against the 60-second `FR-RBAC-04` budget.
- **Impersonation oversight:** `impersonation_sessions_total` (`BR-DAT-02`), and the `audit_log`
  query returning every write carrying `impersonated_by` — a report by actor must show **both**
  identities. The refusal count on `@FinancialMutation()` handlers under an impersonation token
  belongs here as evidence that the prohibition is exercised, not merely present.
- **Never on a dashboard:** the plaintext OTP, a phone number, an email address, a token or a token
  hash. Redis holds an HMAC; the Pino redaction list covers `otp` and `phone`; `BR-DAT-06` and the
  `Monitoring.md` §3.7 label ban apply to every panel above.

## Sprint 0 state — the tables and the catalogue exist; nothing can log in (`M-019`)

Everything above describes `iam/` at the end of the auth track. What is deployed today is the five
tables, their tenancy class, and the seeded §B3.1 / §B3.2 catalogue. Login arrives at M-020–M-022.

| Question | Answer today |
| :--- | :--- |
| Can anyone authenticate? | **Yes, as of M-020** — `POST /v1/auth/login` verifies a password. It issues NO SESSION: `SE1` forbids a bearer string in a response body, and session creation with rotation is M-022's. So login is verifiable and not yet useful. The eleven seeded principals still have `password_hash IS NULL` and cannot sign in; register one to get an account that can. |
| Why is a login returning 401 when the password is right? | Check the lockout first — `GET auth:fail:{user_id}` in Redis. Ten failures in fifteen minutes is a **403 `ACCOUNT_LOCKED`**, not a 401. A 401 with a correct password means the stored hash does not match: look for a second account on the same address differing in case, which `normaliseIdentifier` exists to prevent. |
| A member says the reset link does not work | It is single-use and 30 minutes. All three of unknown, spent and expired are ONE 422 by design — a token is a bearer credential and distinguishing them says whether a guessed value was ever real. Completing a reset also revokes every OTHER outstanding link for that user. |
| Why does registration accept a breached password? | It does not check. `BLK-09` / `KL-099`: `A-32` is `PROPOSED` and absent from `STACK_ADDITIONS.md`. The `breach_check_skipped` counter is at 100% and will stay there until an adapter lands — that is the gap being visible, not a fault to chase. |
| What is seeded? | 12 roles · 64 permissions · 191 `role_permissions` · 11 principals (7 platform-scoped, 4 tenant-scoped). `SEED_VERSION = 0.2`. |
| Where does the permission catalogue come from? | `MASTER_PRD.md` §B3.2, mechanically — `rbac-matrix.spec.ts` re-parses the PRD and compares all 504 cells on every run. Edit the PRD or `iam/permissions.ts` alone and the build fails. |
| Why 64 and not the "~180" in `Schema.md` §4.7? | That figure is in §4.7's **Volume** sentence, beside `user_roles` **520,000** and a 10× column — a capacity projection for a table that grows as endpoints land, not a register. The enumerated source is §B3.2's 42 capabilities. |

### The two things about this schema that will confuse you at 3am

**1. `users` and `user_roles` have NO RLS policy, and that is correct.**

Every other tenant-bearing table in this database has `ENABLE` + `FORCE` and two policies. These do
not. `Schema.md` §1.3 classes them **IDENTITY** — scoped by `user_id`, protected by authorisation.

If someone "fixes" this by adding a policy, here is what you will see:

| Table given a policy | Symptom | Why |
| :--- | :--- | :--- |
| `users` | A member with memberships at three gyms sees an empty list at `/me/memberships`. **Looks exactly like data loss.** | A user belongs to no single tenant. |
| `user_roles` | Super-admins lose their own permissions. Platform staff can no longer do anything. | A platform grant has `tenant_id IS NULL`; `NULL = <uuid>` is NULL, not TRUE, so every platform row becomes invisible to every session — including the platform's own. |

`user_roles` is **the only table in the schema with a `tenant_id` and no policy.** The reviewed
exception is in `apps/server/test/isolation/rls-coverage.sql`, and **PC2-IDENTITY** in the same
file fails the build if a second table ever joins it.

**2. `app_rw` cannot write `roles`, `permissions` or `role_permissions`.**

`SELECT` and nothing else — grant class **G-REF** (`Constraints.md` §9). If you are debugging
"permission denied for table role_permissions" on the request path, that is the control working.
The write path is `admin/`, gated by permission **and a written reason** (`FR-ADMN-02`), and it
arrives with **M-116**. Until then a catalogue change is a migration or a seed re-run, both as the
migration role.

### Re-seeding

```bash
pnpm --filter @gymmap/server exec node prisma/seed/index.ts           # print the SQL, change nothing
pnpm --filter @gymmap/server exec node prisma/seed/index.ts --apply   # execute it
```

Idempotent: every id is derived from its key (UUIDv5 over a fixed namespace), and every insert is
`ON CONFLICT (id) DO NOTHING`. Running it twice does not duplicate anything —
`roles-seed.int-spec.ts` asserts exactly that by running it a second time mid-suite.

**It will not update an existing row.** `DO NOTHING`, not `DO UPDATE`. If a role description or a
permission's `resource` changed in the catalogue, the seed leaves the old value in place and the
suite goes red on the comparison rather than silently converging. Fix it with a migration, or drop
the rows and re-seed on a local database.

## Known incidents

_None yet._
