-- migration: 20260809100000_expand_create_applications
-- phase:            expand                     -- MG3
-- requirement:      M-026, FR-ONB-*, BR-GYM-05, Schema.md §4.2, ERD.md §9.6, D-03
-- tables:           applications
-- rls:              P-STD + P-PLATFORM — ENABLED and FORCED, USING and WITH CHECK
-- grants:           G-COMPLETE (D-03) — SELECT, INSERT, and a COLUMN-SCOPED UPDATE
-- append_only:      the submitted snapshot is. The verdict columns are not
-- partitioned:      no
-- max_lock:         ACCESS EXCLUSIVE on a table that does not exist yet
-- rewrite:          none — CREATE TABLE
-- est_duration:     < 50 ms                                               -- MG11
-- backfill_job:     none
-- rollback:         FREE. DROP TABLE; nothing references it yet
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             Schema.md §4.2, ERD.md §9.6, Indexes.md SC-R06
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- M-026 · `applications` — the verification dossier a tenant submits.
--
-- ┌─ THE SNAPSHOT IS IMMUTABLE, AND THE GRANT IS WHAT MAKES IT SO ──────────────────────────────┐
-- │ `AC-2`: an attempt to UPDATE `snapshot`, `version` or `submitted_at` as `app_rw` must raise   │
-- │ `permission denied` at the GRANT level — not be caught by application code, not be reverted  │
-- │ by a trigger. A column-scoped `GRANT UPDATE (…)` is the only mechanism that refuses the       │
-- │ statement before it runs, for every connection, including a `psql` session at 3am.            │
-- │                                                                                              │
-- │ Why it matters: the snapshot is what the reviewer approved. If it can change afterwards, the  │
-- │ approval refers to a document nobody can reconstruct, and `BR-GYM-01`'s "a human approved     │
-- │ this" becomes unfalsifiable.                                                                   │
-- │                                                                                              │
-- │ `M-022` learned the narrower half of this lesson: a column-scoped grant restricts WHICH        │
-- │ columns may be written and says nothing about how many times or in which direction. That is   │
-- │ enough here, because the forbidden columns must never change at all.                           │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

CREATE TABLE IF NOT EXISTS applications (
    id          uuid        NOT NULL DEFAULT gen_random_uuid(),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    created_by  uuid            NULL,
    updated_by  uuid            NULL,

    tenant_id   uuid        NOT NULL,

    -- ┌─ THE VERSION IS THE TENANT'S RESUBMISSION COUNT, AND IT IS UNFORGEABLE ──────────────────┐
    -- │ `BR-GYM-05`. A rejected application is not edited; a new VERSION is submitted, so the     │
    -- │ history of what was claimed and when survives. `uq_applications__tenant_version` below is │
    -- │ what stops two rows claiming to be version 3 — without it a tenant could submit a second  │
    -- │ "version 2" and the earlier rejection would appear to belong to a document nobody sent.   │
    -- └───────────────────────────────────────────────────────────────────────────────────────────┘
    version     integer     NOT NULL,

    -- ┌─ `AC-5` · THE CHECKLIST VERSION LIVES INSIDE THE SNAPSHOT, NOT AS A FOREIGN KEY ─────────┐
    -- │ `ERD.md` §9.6. A foreign key to a checklist table would mean adding a tenth required      │
    -- │ document in March retroactively makes every February application incomplete — applications │
    -- │ that were approved against the rules as they stood. The snapshot freezes the rules WITH    │
    -- │ the claim, which is the only arrangement in which "this was complete when approved" stays │
    -- │ true.                                                                                      │
    -- └───────────────────────────────────────────────────────────────────────────────────────────┘
    snapshot    jsonb       NOT NULL,

    status      application_status_enum NOT NULL DEFAULT 'SUBMITTED',

    -- The reviewer currently holding it. NULL is the unassigned queue, which is the normal state.
    assigned_to uuid            NULL,

    -- The verdict. All four move together or none do — see the CHECK below.
    decided_by   uuid                       NULL,
    decided_at   timestamptz                NULL,
    decision     application_decision_enum  NULL,
    -- `text[]` of `application_rejection_reason_enum` labels. An array rather than one column,
    -- because a rejection usually has several reasons and a reviewer who can give only one picks
    -- the most defensible instead of the complete list.
    reason_codes text[]        NOT NULL DEFAULT '{}',

    -- Free text for the officer. Never shown to the tenant verbatim — `Admin.md` RD2 requires the
    -- structured reason codes to carry what the applicant is told.
    reviewer_notes text          NULL,

    -- Automated checks run before a human looks. Stored so a reviewer can see WHY the queue
    -- ordered things as it did, and so a precheck that was wrong is auditable after the fact.
    precheck_results jsonb    NOT NULL DEFAULT '{}'::jsonb,

    submitted_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_applications PRIMARY KEY (id),

    -- `BR-GYM-05`. The version sequence is per tenant and cannot repeat.
    CONSTRAINT uq_applications__tenant_version UNIQUE (tenant_id, version),

    CONSTRAINT ck_applications__version_positive CHECK (version >= 1),

    -- ┌─ A VERDICT IS ALL FOUR COLUMNS OR NONE ──────────────────────────────────────────────────┐
    -- │ A row with `decision = 'REJECTED'` and no `decided_by` is a rejection nobody made, and it │
    -- │ is indistinguishable from one somebody did. The CHECK makes the half-written verdict       │
    -- │ unrepresentable rather than merely discouraged — the same reasoning as                     │
    -- │ `ck_users__mfa_enabled_has_timestamp`.                                                     │
    -- └───────────────────────────────────────────────────────────────────────────────────────────┘
    CONSTRAINT ck_applications__verdict_is_complete CHECK (
        (decision IS NULL AND decided_by IS NULL AND decided_at IS NULL)
        OR (decision IS NOT NULL AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
    ),

    -- A decision cannot predate the submission it decides.
    CONSTRAINT ck_applications__decided_after_submitted CHECK (
        decided_at IS NULL OR decided_at >= submitted_at
    ),

    CONSTRAINT fk_applications__tenants
        FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT
);

COMMENT ON TABLE applications IS
    'M-026 · one submitted verification dossier per (tenant, version). BR-GYM-05: a rejected '
    'application is superseded by a new version, never edited. The snapshot is immutable at the '
    'grant level (D-03).';
COMMENT ON COLUMN applications.snapshot IS
    'ERD.md §9.6 · the claim AND the checklist version it was made against, frozen together. A '
    'foreign key to a checklist would make a later rule change retroactively invalidate approved '
    'applications.';
COMMENT ON COLUMN applications.precheck_results IS
    'Automated checks, kept so a reviewer can see why the queue ordered things as it did and so a '
    'wrong precheck is auditable afterwards.';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 2 · INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- ┌─ `AC-6` · THIS INDEX DELIBERATELY DOES NOT LEAD WITH `tenant_id` ────────────────────────────┐
-- │ Every other tenant-owned index in this schema leads with `tenant_id`, because every other     │
-- │ read is inside one tenant. The verification queue is not: it is a PLATFORM surface read under │
-- │ `runElevated()` (`FR-ADMN-11`), so every tenant's rows are in scope and a leading `tenant_id` │
-- │ would make the index useless for the one query it exists to serve.                             │
-- │                                                                                              │
-- │ Recorded as exception `SC-R06` in `Indexes.md` precisely because it looks like the mistake     │
-- │ `CI-08` exists to catch.                                                                       │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
CREATE INDEX IF NOT EXISTS idx_applications__status_submitted_at
    ON applications (status, submitted_at);

-- The tenant's own view: "where is my application". Leads with `tenant_id` like everything else.
CREATE INDEX IF NOT EXISTS idx_applications__tenant_submitted_at
    ON applications (tenant_id, submitted_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 3 · RLS — P-STD + P-PLATFORM. ENABLED and FORCED.
--
-- FORCE, not just ENABLE: ENABLE alone exempts the table OWNER, and migrations run as an owner, so
-- without FORCE the policy is advisory for exactly the connection most able to do damage.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications FORCE  ROW LEVEL SECURITY;

-- USING filters READS, WITH CHECK constrains WRITES. Both, always: a USING-only policy permits a
-- cross-tenant INSERT that the inserting tenant then cannot see, so nothing looks wrong from either
-- side and the row sits in another tenant's scope indefinitely (`AC-FND-01.1`).
CREATE POLICY rls_applications__tenant_isolation
    ON applications
    FOR ALL
    TO app_rw, app_append
    USING      (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- The verification queue. SELECT ONLY, across tenants, for the elevation role alone. This is what
-- makes the admin queue possible without granting BYPASSRLS anywhere, and it must never gain
-- INSERT, UPDATE or DELETE — a reviewer's verdict is written through `app_rw` inside the tenant.
CREATE POLICY rls_applications__platform_read
    ON applications
    FOR SELECT
    TO app_platform_ro
    USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 4 · GRANTS — class G-COMPLETE, deviation D-03 (Schema.md §4.2)
--
-- ┌─ THE COLUMN LIST IS THE WHOLE CONTROL ───────────────────────────────────────────────────────┐
-- │ `app_rw` may write the VERDICT columns and nothing else. `snapshot`, `version` and            │
-- │ `submitted_at` are absent from the UPDATE grant, so `UPDATE applications SET snapshot = …`    │
-- │ raises `permission denied for table applications` before the statement runs.                   │
-- │                                                                                              │
-- │ No DELETE for anybody. A dossier that was submitted stays submitted; `R-KYC` retention        │
-- │ outlives the tenant, and the genuine erasure path runs as `app_migrator` in a reviewed job.   │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘

GRANT SELECT, INSERT ON applications TO app_rw;
GRANT UPDATE (status, assigned_to, decided_by, decided_at, decision, reason_codes, reviewer_notes,
              updated_at, updated_by)
    ON applications TO app_rw;

GRANT SELECT ON applications TO app_platform_ro;
