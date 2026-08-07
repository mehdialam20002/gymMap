-- migration: 20260807080000_expand_create_identity_tables
-- phase:            expand                     -- MG3
-- requirement:      EP-02 F-02.1, T-02.01, §B3.1, §B3.2, FR-RBAC-01 … FR-RBAC-06, AC-STAF-01.4
-- tables:           users, user_roles, roles, permissions, role_permissions
-- rls:              NONE ON ANY OF THE FIVE     -- and that is the whole point. See below.
-- grants:           users G-CRUD · user_roles G-CRUD · the other three G-REF
-- append_only:      no
-- partitioned:      no
-- max_lock:         ACCESS EXCLUSIVE (create)  -- §4.1
-- rewrite:          none
-- est_duration:     < 200 ms on an empty database                  -- MG11
-- backfill_job:     none
-- rollback:         FREE                       -- P4. Nothing references these yet
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             Schema.md §1.3, §4.6, §4.7 · Constraints.md §9 · MASTER_PRD.md §B3.1
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- NOT ONE OF THESE FIVE TABLES HAS AN RLS POLICY, AND EACH FOR A DIFFERENT REASON
--
-- Everything shipped since M-009 has had RLS ENABLED and FORCED, so five tables arriving
-- without it needs stating rather than noticing.
--
--   users, user_roles                  IDENTITY. Scoped by `user_id`, protected by
--                                      authorisation (Schema.md §1.3, §4.6, §4.7).
--   roles, permissions,                GLOBAL platform reference. There is no tenant whose
--   role_permissions                   rows these are (Schema.md §4.7, §C2.3).
--
-- `Schema.md` §1.3 states the trap in its own words, and it is worth reproducing because it is
-- the most expensive mistake available in this file:
--
--   "user-owned, cross-tenant data — a user's profile, favourites across gyms, orders at
--    several tenants — is scoped by user_id, not by tenant_id. Classing `users` as RLS would
--    make /me/memberships return an empty list to a member who holds memberships at three
--    gyms, and the bug would look like data loss."
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- `user_roles` CARRIES A `tenant_id` AND HAS NO POLICY. THIS IS THE ONLY SUCH TABLE.
--
-- Every previous milestone has enforced the opposite rule: a `tenant_id` column means two
-- policies, ENABLE and FORCE, no exceptions. CI-01 exists to make that mechanical. So this
-- table is a deliberate, reviewed hole in a control that is otherwise absolute, and the reason
-- has to survive the person who wrote it.
--
--   A platform role row has `tenant_id IS NULL` — the nullable column IS the discriminator
--   (ERD.md §3.1). An RLS policy of the form `tenant_id = current_setting('app.tenant_id')`
--   evaluates `NULL = <uuid>` for every platform row, which is NULL, which is not TRUE, so
--   the row is invisible. To EVERY session, including the platform's own.
--
--   The symptom is super-admins silently losing their own permissions — and the natural
--   diagnosis is "the RBAC seed is wrong", which sends someone to re-seed a table that was
--   correct all along.
--
-- `user_roles` is also the mechanism by which a tenant sees a person AT ALL: it is what
-- resolves an identity into a tenant membership. A row that must be readable in order to
-- decide which tenant you are cannot itself be filtered by which tenant you are.
--
-- The exception is recorded in `apps/server/test/isolation/rls-coverage.sql` with this reason
-- attached, and PC2-IDENTITY there asserts that `user_roles` is the ONLY table permitted to
-- hold a `tenant_id` without policies. A second one cannot be added quietly.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- `ck_users__has_contact` HAD TO BE WIDENED, OR ERASURE COULD NEVER RUN
--
-- `Schema.md` §4.6's Notes paragraph states two rules one sentence apart:
--
--   "At least one of email/phone must be present:
--    ck_users__has_contact CHECK (email IS NOT NULL OR phone IS NOT NULL)"
--
--   "Erasure sets email, phone, full_name, password_hash to NULL, populates pseudonym_token
--    and erased_at ..."
--
-- Taken literally the second violates the first EVERY TIME. `data.retention-sweep` would raise
-- 23514 on every erasure, and BR-DAT-04 — a DPDP Act obligation, not a preference — would be
-- unexecutable. This is the same shape of defect M-018 found in M-017's `release()`: a CHECK
-- that the system's own documented operation breaks on every call.
--
-- The predicate is therefore `erased_at IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL`.
-- This is not choosing one rule over the other — it makes both true at once. A LIVE user with
-- no contact point is still refused, which is the entire purpose of the constraint; an ERASED
-- user has no contact point BY DESIGN, which is the entire purpose of erasure. Asserted from
-- both sides in `users-constraints.int-spec.ts`.

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 1 · `roles` — the twelve §B3.1 roles. G-REF, GLOBAL.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS roles (
    id           uuid                NOT NULL,
    created_at   timestamptz         NOT NULL DEFAULT now(),
    updated_at   timestamptz         NOT NULL DEFAULT now(),
    created_by   uuid                    NULL,
    updated_by   uuid                    NULL,

    -- Typed, not text. §B3.1 is a closed list of twelve and `platform_role_enum` is that list;
    -- a text column would let a row invent a thirteenth role, and a role that exists in the
    -- database but in no policy grants nothing while looking authoritative.
    key          platform_role_enum  NOT NULL,

    -- Permission evaluation is (role, scope, resource, action), NEVER role alone (§B3.1).
    -- GYM_MANAGER and GYM_OWNER share capabilities and differ only in scope; collapsing the
    -- pair to a role check is how a manager acquires tenant-wide authority.
    scope        text                NOT NULL,

    description  text                NOT NULL,

    CONSTRAINT pk_roles PRIMARY KEY (id),
    CONSTRAINT uq_roles__key UNIQUE (key),

    CONSTRAINT ck_roles__scope
        CHECK (scope IN ('PUBLIC', 'SELF', 'TENANT', 'BRANCH', 'PLATFORM')),

    CONSTRAINT ck_roles__description_present CHECK (length(btrim(description)) > 0)
);

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 2 · `permissions` — one atomic capability an endpoint declares. G-REF, GLOBAL.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS permissions (
    id          uuid         NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now(),
    created_by  uuid             NULL,
    updated_by  uuid             NULL,

    -- `<module>.<resource>.<action>`, the shape `api-gates` PG-3 already enforces on every
    -- route's declared permission and `tenancy/permissions.ts` already follows. The CHECK is
    -- here as well as in CI because a permission key that matches no route guards nothing
    -- while looking exactly like one that does.
    key         text         NOT NULL,

    -- Decomposed for the §B3.2 matrix view. Derived from `key`, and constrained to agree with
    -- it below — two spellings of the same fact that can disagree is a matrix that lies.
    resource    text         NOT NULL,
    action      text         NOT NULL,

    description text         NOT NULL,

    CONSTRAINT pk_permissions PRIMARY KEY (id),
    CONSTRAINT uq_permissions__key UNIQUE (key),

    CONSTRAINT ck_permissions__key_shape
        CHECK (key ~ '^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),

    -- `key` = '<module>.' || resource || '.' || action. Without this, `resource`/`action` drift
    -- from `key` and the FR-RBAC-05 effective-permissions screen shows a different answer from
    -- the one the guard computed.
    CONSTRAINT ck_permissions__key_matches_parts
        CHECK (key LIKE '%.' || resource || '.' || action),

    CONSTRAINT ck_permissions__description_present CHECK (length(btrim(description)) > 0)
);

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 3 · `role_permissions` — the §B3.2 composition. G-REF, GLOBAL.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS role_permissions (
    id            uuid         NOT NULL,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now(),
    created_by    uuid             NULL,
    updated_by    uuid             NULL,

    role_id       uuid         NOT NULL,
    permission_id uuid         NOT NULL,

    CONSTRAINT pk_role_permissions PRIMARY KEY (id),
    CONSTRAINT uq_role_permissions__role_permission UNIQUE (role_id, permission_id),

    -- RESTRICT, not CASCADE. Deleting a role that still grants permissions is not a cleanup,
    -- it is a silent revocation for everyone holding it — and CASCADE would make that a
    -- one-statement accident.
    CONSTRAINT fk_role_permissions__roles
        FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE RESTRICT,
    CONSTRAINT fk_role_permissions__permissions
        FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_role_permissions__permission_id
    ON role_permissions (permission_id);

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 4 · `users` — a platform identity. IDENTITY class: no tenant_id, no RLS. G-CRUD.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
    id                     uuid              NOT NULL,
    created_at             timestamptz       NOT NULL DEFAULT now(),
    updated_at             timestamptz       NOT NULL DEFAULT now(),
    created_by             uuid                  NULL,
    updated_by             uuid                  NULL,

    -- Both contact points are NULLABLE and at least one is required — see the header for why
    -- the CHECK also admits an erased row. An India walk-in member may have only a phone
    -- (FR-CRM-04); an owner registering from the web may have only an email.
    email                  email_address         NULL,
    email_verified_at      timestamptz           NULL,
    phone                  phone_e164            NULL,
    phone_verified_at      timestamptz           NULL,

    -- Argon2id. NULL for OTP-only accounts, which in India is the common case, not the edge
    -- case. NEVER logged, never exported (NFR-SEC-01, BR-DAT-06).
    password_hash          text                  NULL,

    full_name              text                  NULL,
    display_locale         text              NOT NULL DEFAULT 'en-IN',

    -- PRESENTATION AND QUIET HOURS ONLY (TM6, TM11). A validity window is computed from the
    -- GYM's timezone, never from the member's — a member who travels does not thereby change
    -- when their membership expires.
    presentation_timezone  iana_timezone         NULL,

    status                 user_status_enum  NOT NULL DEFAULT 'PENDING_VERIFICATION',

    -- Mandatory for platform staff roles (NFR-SEC-11). Enforced in the authorisation layer at
    -- M-024, not by a constraint: the requirement is a property of the ROLE the user holds,
    -- and `user_roles` is a different table.
    mfa_enabled            boolean           NOT NULL DEFAULT false,

    last_login_at          timestamptz           NULL,

    -- The stable, irreversible token that replaces identifiers on erasure. Financial records
    -- reference it, which is what lets BR-DAT-04 erasure coexist with the seven-year retention
    -- BR-FIN-01 requires (AC-USER-02.3).
    pseudonym_token        text                  NULL,

    -- Distinct from `deleted_at`, deliberately. A deleted account can be restored; an erased
    -- one cannot, because the data is gone.
    erased_at              timestamptz           NULL,
    deleted_at             timestamptz           NULL,

    CONSTRAINT pk_users PRIMARY KEY (id),

    -- See the header. Both halves are asserted in users-constraints.int-spec.ts.
    CONSTRAINT ck_users__has_contact
        CHECK (erased_at IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL),

    -- Erasure is all-or-nothing. A row with `erased_at` still holding an email is a data-
    -- subject request that reported success and did not complete — the worst outcome available
    -- here, because the requester is told it is done.
    CONSTRAINT ck_users__erasure_is_complete
        CHECK (
            erased_at IS NULL
            OR (email IS NULL AND phone IS NULL AND full_name IS NULL
                AND password_hash IS NULL AND pseudonym_token IS NOT NULL)
        ),

    -- ERASED is the terminal state of user_status_enum and it must agree with `erased_at`.
    -- Two representations of one fact that can disagree is a status column nobody can trust.
    CONSTRAINT ck_users__erased_status_agrees
        CHECK ((status = 'ERASED') = (erased_at IS NOT NULL)),

    CONSTRAINT ck_users__display_locale_shape
        CHECK (display_locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),

    -- A verification timestamp for a contact point that does not exist is meaningless, and
    -- BR-GYM-02 makes "verified owner email" an approval precondition — so a stray
    -- `email_verified_at` on a row with no email would satisfy a check it should not.
    CONSTRAINT ck_users__email_verified_needs_email
        CHECK (email_verified_at IS NULL OR email IS NOT NULL),
    CONSTRAINT ck_users__phone_verified_needs_phone
        CHECK (phone_verified_at IS NULL OR phone IS NOT NULL)
);

-- PARTIAL on `deleted_at IS NULL` (SD7): a soft-deleted account frees its address, so a person
-- who deletes their account can register again with the same email. A total unique index would
-- make deletion permanent from the user's point of view while the row still existed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users__email
    ON users (email) WHERE deleted_at IS NULL AND email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users__phone
    ON users (phone) WHERE deleted_at IS NULL AND phone IS NOT NULL;

-- NOT partial. The pseudonym must be unique across all time including deleted rows — its whole
-- purpose is to be the durable reference a financial record keeps after the identity is gone,
-- and a reused token would merge two people's histories.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users__pseudonym_token
    ON users (pseudonym_token) WHERE pseudonym_token IS NOT NULL;

-- SCR-ADM-005, the platform user list: filtered by status, ordered by newest.
CREATE INDEX IF NOT EXISTS ix_users__status_created_at
    ON users (status, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 5 · `user_roles` — one role granted to one user, optionally within one tenant.
--     IDENTITY class. Carries `tenant_id` and has NO POLICY. See the header.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_roles (
    id          uuid         NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now(),
    created_by  uuid             NULL,
    updated_by  uuid             NULL,

    user_id     uuid         NOT NULL,
    role_id     uuid         NOT NULL,

    -- NULLABLE, AND THE NULL IS THE DISCRIMINATOR (ERD.md §3.1).
    -- NULL  → a platform role: SUPER_ADMIN, FINANCE, MODERATOR, SUPPORT_AGENT, …
    -- set   → a tenant role:   GYM_OWNER, GYM_MANAGER, RECEPTIONIST, TRAINER
    tenant_id   uuid             NULL,

    granted_at  timestamptz  NOT NULL DEFAULT now(),

    -- AC-STAF-01.4. Revocation is a TIMESTAMP, never a DELETE, so "who could do this in March"
    -- is still answerable in November. A deleted grant makes every historical audit row
    -- reference an authority nobody can confirm existed.
    revoked_at  timestamptz      NULL,

    CONSTRAINT pk_user_roles PRIMARY KEY (id),

    -- NULLS NOT DISTINCT is load-bearing, not a stylistic choice.
    --
    -- PostgreSQL's default treats two NULLs as distinct, so a plain UNIQUE on
    -- (user_id, role_id, tenant_id) would permit `(alice, SUPER_ADMIN, NULL)` TWICE — and
    -- every platform grant has a NULL tenant_id, so the constraint would be inert for exactly
    -- the rows that matter most. Revoking one of the two duplicates would then leave the user
    -- still a super-admin, from a row nobody was looking at.
    --
    -- PostgreSQL 15+. This repository targets 16 (A-09), asserted by infra:verify.
    CONSTRAINT uq_user_roles__user_role_tenant
        UNIQUE NULLS NOT DISTINCT (user_id, role_id, tenant_id),

    CONSTRAINT fk_user_roles__users
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_user_roles__roles
        FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE RESTRICT,
    CONSTRAINT fk_user_roles__tenants
        FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,

    CONSTRAINT ck_user_roles__revoked_after_granted
        CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

-- The authorisation read path, run on EVERY authenticated request: "what does this user hold,
-- right now". `revoked_at IS NULL` is in the index predicate rather than only in the query so
-- that revoked grants do not grow the hot index for the life of the platform.
CREATE INDEX IF NOT EXISTS ix_user_roles__user_active
    ON user_roles (user_id, tenant_id) WHERE revoked_at IS NULL;

-- "Who has access to this tenant" — the staff screen, and the offboarding checklist.
CREATE INDEX IF NOT EXISTS ix_user_roles__tenant_active
    ON user_roles (tenant_id, role_id) WHERE revoked_at IS NULL AND tenant_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- RLS — DELIBERATELY ABSENT ON ALL FIVE.
--
-- No ENABLE, no FORCE, no policy. `rls-coverage.sql` carries the reviewed exception for
-- `user_roles` (the only tenant_id-bearing table permitted one) and the pre-existing GLOBAL
-- exemptions for roles/permissions/role_permissions. `users` needs no entry at all: it has no
-- tenant_id, so CI-01 never looks at it.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- Grants.
--
--   users, user_roles   G-CRUD — SELECT, INSERT, UPDATE. No DELETE: `users` carries
--                       `deleted_at` (ADR-0024) and CI-02 fails any role holding DELETE on a
--                       table that does. `user_roles` has no `deleted_at` and still gets no
--                       DELETE, because AC-STAF-01.4 makes revocation a timestamp — a grant
--                       that can be deleted is attribution that can be erased.
--
--   roles, permissions, G-REF — SELECT ONLY on the request path. The write path is `admin/`,
--   role_permissions    gated by permission AND a written reason (FR-ADMN-02), arriving with
--                       M-116. Seeding runs as the migration role, not as app_rw.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE ON users, user_roles TO app_rw;
GRANT SELECT                 ON users, user_roles TO app_platform_ro;

GRANT SELECT ON roles, permissions, role_permissions TO app_rw, app_platform_ro;

COMMENT ON TABLE users IS
  'Schema.md §4.6. IDENTITY class: no tenant_id, NO RLS, scoped by user_id and protected by authorisation. Classing this RLS is the /me/memberships bug of §1.3 — a member holding memberships at three gyms would see an empty list, and it would look like data loss.';

COMMENT ON COLUMN users.pseudonym_token IS
  'BR-DAT-04 / AC-USER-02.3. The stable irreversible token that replaces identifiers on erasure. Financial records reference it, which is what lets a DPDP erasure coexist with the seven-year retention BR-FIN-01 requires. Unique across ALL rows including deleted ones — a reused token merges two people''s histories.';

COMMENT ON COLUMN users.presentation_timezone IS
  'TM6, TM11. Presentation and quiet hours ONLY. A validity window is computed from the GYM''s timezone — a member who travels does not thereby change when their membership expires.';

COMMENT ON CONSTRAINT ck_users__has_contact ON users IS
  'Widened from Schema.md §4.6''s literal text with `erased_at IS NOT NULL OR ...`. As written the constraint and the erasure procedure in the same paragraph contradict each other: erasure NULLs both contact points, so every BR-DAT-04 erasure would raise 23514. Both rules now hold — a LIVE user with no contact point is still refused.';

COMMENT ON TABLE user_roles IS
  'Schema.md §4.7. IDENTITY class. THE ONE TABLE IN THIS SCHEMA WITH A tenant_id AND NO RLS POLICY, by reviewed exception recorded in test/isolation/rls-coverage.sql. A policy of the form tenant_id = current_setting(...) evaluates NULL = uuid for every platform-role row, making super-admins invisible to themselves.';

COMMENT ON COLUMN user_roles.tenant_id IS
  'ERD.md §3.1. NULLABLE IS THE DISCRIMINATOR: NULL is a platform role, a value is a tenant role. Never fill it with a sentinel.';

COMMENT ON COLUMN user_roles.revoked_at IS
  'AC-STAF-01.4. Revocation is a timestamp, never a delete, so "who could approve a payout in March" is still answerable in November.';

COMMENT ON CONSTRAINT uq_user_roles__user_role_tenant ON user_roles IS
  'NULLS NOT DISTINCT (PostgreSQL 15+). The default treats NULLs as distinct, which would permit the same platform role twice for one user — and every platform grant has a NULL tenant_id, so the constraint would be inert for exactly the rows that matter most.';

COMMENT ON TABLE roles IS
  'MASTER_PRD.md §B3.1. Exactly twelve, typed as platform_role_enum so a row cannot invent a thirteenth. GLOBAL, G-REF: SELECT on the request path; writes through the audited admin/ path only.';

COMMENT ON COLUMN roles.scope IS
  '§B3.1. Permission evaluation is (role, scope, resource, action), NEVER role alone. GYM_MANAGER and GYM_OWNER share capabilities and differ only here.';

COMMENT ON TABLE permissions IS
  'FR-RBAC-01. One atomic capability an endpoint declares. `<module>.<resource>.<action>` — the same shape api-gates PG-3 enforces on every route, because a permission key that matches no route guards nothing while looking exactly like one that does.';
