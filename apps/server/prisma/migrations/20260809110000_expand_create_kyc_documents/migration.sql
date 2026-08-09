-- migration: 20260809110000_expand_create_kyc_documents
-- phase:            expand                     -- MG3
-- requirement:      M-026, FR-ONB-03, BR-GYM-02, BR-DAT-07, Schema.md §4.3, retention class R-KYC
-- tables:           kyc_documents
-- rls:              P-STD + P-PLATFORM — ENABLED and FORCED, USING and WITH CHECK
-- grants:           G-CRUD, minus DELETE
-- append_only:      no, but the ROW is: deletion is recorded, never performed
-- partitioned:      no
-- max_lock:         ACCESS EXCLUSIVE on a table that does not exist yet
-- rewrite:          none — CREATE TABLE
-- est_duration:     < 50 ms                                               -- MG11
-- backfill_job:     none
-- rollback:         FREE. DROP TABLE; nothing references it yet
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             Schema.md §4.3, LAUNCH_MARKET_INDIA.md §6
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- M-026 · `kyc_documents` — what the tenant uploaded, and what happened to it.
--
-- ┌─ `AC-4` · THERE IS NO `deleted_at`, AND THAT ABSENCE IS THE DESIGN ──────────────────────────┐
-- │ Every other tenant-owned table here carries `deleted_at` and soft-deletes. This one does not, │
-- │ and adding it "for consistency" would be the bug.                                              │
-- │                                                                                              │
-- │ Retention class `R-KYC`: the row outlives the tenant. A KYC document is evidence that a       │
-- │ legally required check was performed, and the question a regulator asks years later is "did    │
-- │ this gym ever supply a PAN?" — a question a deleted row cannot answer, and a soft-deleted one  │
-- │ answers only if every reader remembers to look past the filter.                                │
-- │                                                                                              │
-- │ So `tombstoned_at` records that the OBJECT was destroyed while the ROW stays. The distinction │
-- │ is not cosmetic: `BR-DAT-07` requires the file itself to be removable on erasure, and this is │
-- │ how both survive — the bytes go, the fact that they existed does not.                          │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

CREATE TABLE IF NOT EXISTS kyc_documents (
    id             uuid        NOT NULL DEFAULT gen_random_uuid(),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    created_by     uuid            NULL,
    updated_by     uuid            NULL,

    tenant_id      uuid        NOT NULL,
    application_id uuid        NOT NULL,

    document_type  kyc_document_type_enum   NOT NULL,

    -- ┌─ `AC-7` · GLOBALLY UNIQUE, NOT TENANT-PREFIXED ──────────────────────────────────────────┐
    -- │ Keys are opaque high-entropy strings, so a collision is not a tenant boundary being       │
    -- │ crossed — it is an infrastructure defect, and one that must surface immediately rather    │
    -- │ than be hidden by a per-tenant scope that makes two tenants' identical keys legal.        │
    -- │                                                                                          │
    -- │ Tenant-scoping the uniqueness would ALSO be actively wrong: object storage has one        │
    -- │ namespace, so two rows with the same key point at one object, and tombstoning either      │
    -- │ destroys the other tenant's evidence.                                                     │
    -- └───────────────────────────────────────────────────────────────────────────────────────────┘
    storage_key    text        NOT NULL,

    -- SHA-256 of the bytes as uploaded. Two purposes: proving the object was not swapped after
    -- review, and recognising a re-upload of the identical file rather than treating it as new.
    content_hash   text        NOT NULL,

    status         kyc_document_status_enum NOT NULL DEFAULT 'PENDING',

    -- The review columns. `reviewed_by` without `reviewed_at` is a review nobody can date.
    reviewed_by    uuid            NULL,
    reviewed_at    timestamptz     NULL,
    rejection_reason text          NULL,

    -- ┌─ NOT `deleted_at`, AND THE NAME MATTERS ─────────────────────────────────────────────────┐
    -- │ `deleted_at` means "pretend this row is gone". `tombstoned_at` means "the OBJECT is gone, │
    -- │ this row is not". A reader filtering on the first would hide the evidence; a reader       │
    -- │ seeing the second knows the document existed and that its bytes were removed, which is    │
    -- │ exactly what an erasure request leaves behind.                                             │
    -- └───────────────────────────────────────────────────────────────────────────────────────────┘
    tombstoned_at  timestamptz     NULL,

    -- Documents expire — a fire-safety NOC is valid for a year. NULL means "does not expire".
    expires_at     timestamptz     NULL,

    CONSTRAINT pk_kyc_documents PRIMARY KEY (id),

    CONSTRAINT uq_kyc_documents__storage_key UNIQUE (storage_key),

    CONSTRAINT ck_kyc_documents__review_is_complete CHECK (
        (reviewed_by IS NULL AND reviewed_at IS NULL)
        OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    ),

    -- A rejection needs a reason. An ACCEPTED document with one is a contradiction.
    CONSTRAINT ck_kyc_documents__rejection_has_reason CHECK (
        (status <> 'REJECTED') OR (rejection_reason IS NOT NULL)
    ),

    CONSTRAINT fk_kyc_documents__tenants
        FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
    CONSTRAINT fk_kyc_documents__applications
        FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE RESTRICT
);

COMMENT ON TABLE kyc_documents IS
    'M-026 · retention class R-KYC — the row outlives the tenant. There is deliberately no '
    'deleted_at: tombstoned_at records that the OBJECT was destroyed while the evidence that it '
    'existed survives (BR-DAT-07).';
COMMENT ON COLUMN kyc_documents.tombstoned_at IS
    'The stored object was destroyed. NOT a soft delete — the row stays visible, because "did this '
    'gym ever supply a PAN?" is a question a hidden row cannot answer.';
COMMENT ON COLUMN kyc_documents.storage_key IS
    'Globally unique. Keys are opaque and high-entropy, so a collision is an infrastructure defect '
    'rather than a tenant boundary; and object storage has one namespace, so two rows sharing a key '
    'would point at one object.';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 2 · INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- "Which documents does this tenant still owe, and of what kind" — the checklist read, run on every
-- view of the dossier. Leads with `tenant_id`, unlike `applications`' queue index, because this one
-- IS a tenant-scoped read.
CREATE INDEX IF NOT EXISTS idx_kyc_documents__tenant_type_status
    ON kyc_documents (tenant_id, document_type, status);

-- The reviewer opening one dossier.
CREATE INDEX IF NOT EXISTS idx_kyc_documents__application
    ON kyc_documents (application_id);

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 3 · RLS — P-STD + P-PLATFORM. ENABLED and FORCED.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents FORCE  ROW LEVEL SECURITY;

CREATE POLICY rls_kyc_documents__tenant_isolation
    ON kyc_documents
    FOR ALL
    TO app_rw, app_append
    USING      (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- The verification officer reads across tenants under `runElevated()`. SELECT only — and
-- `BR-DAT-07` requires every one of those reads to be audited, which `runElevated` does.
CREATE POLICY rls_kyc_documents__platform_read
    ON kyc_documents
    FOR SELECT
    TO app_platform_ro
    USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 4 · GRANTS — class G-CRUD, minus DELETE
--
-- No DELETE for anybody, and unlike `tenants` this is not because a soft delete exists instead.
-- There is no delete at all: `R-KYC` outlives the tenant, so the row is never removed on the
-- request path, and `tombstoned_at` is an UPDATE.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE ON kyc_documents TO app_rw;
GRANT SELECT                 ON kyc_documents TO app_platform_ro;
