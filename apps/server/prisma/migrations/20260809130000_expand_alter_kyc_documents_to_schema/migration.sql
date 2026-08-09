-- migration: 20260809130000_expand_alter_kyc_documents_to_schema
-- phase:            expand                     -- MG3
-- requirement:      Schema.md §4.3, NFR-SEC-10, BR-DAT-07, NFR-PRV-04, FR-ONB-03, M-029
-- tables:           kyc_documents
-- rls:              unchanged — the two M-026 policies still apply, and the renames below do not
--                   appear in either predicate
-- grants:           unchanged — G-CRUD minus DELETE. The new columns inherit the table grant
-- append_only:      no
-- partitioned:      no
-- max_lock:         ACCESS EXCLUSIVE, briefly. Every operation here is catalogue-only on PG 16:
--                   ADD COLUMN with no default, DROP NOT NULL, RENAME, and ALTER TYPE on an
--                   EMPTY table
-- rewrite:          none. `SELECT count(*) FROM kyc_documents` is 0 — verified before writing this
-- est_duration:     < 50 ms                                               -- MG11
-- backfill_job:     none, and none is possible: the NOT NULL columns below are added without a
--                   default, which only succeeds because the table is empty
-- rollback:         FREE while the table is empty. Reverse the renames, drop the four columns
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             Schema.md §4.3
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- CORRECTING M-026 AGAINST ITS OWN GOVERNING SPECIFICATION.
--
-- ┌─ THIS IS NOT A DESIGN CHANGE, AND THE DISTINCTION MATTERS ───────────────────────────────────┐
-- │ `20260809110000_expand_create_kyc_documents` names `Schema.md` §4.3 as its requirement source │
-- │ in its own header, and then departs from it in eight places: four columns that section        │
-- │ requires are absent, three are renamed, and one nullability is inverted. No                   │
-- │ `KNOWN_LIMITATIONS.md`, `TECH_DEBT.md` or `DECISION_LOG.md` entry records any of it.           │
-- │                                                                                              │
-- │ So there is no conflict here to halt on. `CLAUDE.md` §2 puts `docs/database/` above code and  │
-- │ says *"code is evidence of intent, never a statement of intent"*. A migration that disagrees  │
-- │ with the schema specification is simply wrong, and the remedy is to correct the code.          │
-- │ Recorded as `TD-037` because the DEVIATION going unrecorded was itself the rule violation.     │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ WHY M-029 IS WHERE THIS SURFACES ───────────────────────────────────────────────────────────┐
-- │ Three of the four missing columns are precisely what the upload pipeline exists to produce:    │
-- │ `content_type` *"determined by content inspection, not by the client's claim"* (`NFR-SEC-10`), │
-- │ `byte_size` *"size limit enforced before write"*, and `checksum_sha256`, which *"proves the    │
-- │ stored object is the reviewed one"* (`BR-DAT-07`). An upload pipeline with nowhere to put its  │
-- │ three findings is not a pipeline. M-026 built the table before anything wrote to it, which is  │
-- │ exactly when an omission is invisible.                                                          │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 1 · `application_id` IS NULLABLE, AND THAT IS THE MOST CONSEQUENTIAL LINE IN THIS FILE
--
-- `Schema.md` §4.3: *"Nullable while the tenant is still assembling a draft."*
--
-- M-026 made it `NOT NULL`, which quietly inverted the onboarding order: a document could not exist
-- until an application row did, so the wizard would have to submit before uploading anything. The
-- specification has it the other way round — evidence accumulates in a draft, and submission freezes
-- a snapshot over documents that are already there (`ERD.md` §9.6).
--
-- The FK and its `ON DELETE RESTRICT` are untouched. A document that DOES name an application still
-- pins it.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE kyc_documents ALTER COLUMN application_id DROP NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 2 · THE FOUR MISSING COLUMNS
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- As uploaded, sanitised for display. Held because a reviewer looking at a rendition needs to know
-- what the applicant thought they were sending; it is NEVER trusted for content type.
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS original_filename text;

-- `NFR-SEC-10`. Determined by INSPECTING THE BYTES, never by the declared header — a `.pdf` that is
-- an executable is rejected, and this column records what the file actually was.
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS content_type text;

-- `bigint`, not `integer`. Every size column in this schema is bigint by rule, and a 2 GB ceiling
-- expressed as an overflow rather than as a policy is the wrong kind of limit.
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS byte_size bigint;

/*
 * The one that is evidence rather than metadata.
 *
 * `Schema.md`: it "proves the stored object is the reviewed one". A reviewer approves what they saw;
 * without a checksum recorded at write time, nothing later can demonstrate that the bytes in the
 * bucket are still those bytes. `char(64)` is the hex digest, fixed width by definition.
 */
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS checksum_sha256 char(64);

-- `NFR-PRV-04`. Set when the OBJECT is purged on retention expiry; the ROW is never deleted, so the
-- fact that a legally required check happened outlives the bytes it was performed on.
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS storage_purged_at timestamptz;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 3 · THE RENAMES
--
-- Free today and never free again: the table is empty, nothing reads these names in production, and
-- the only consumer is `kyc-document.prisma-repository.ts`, updated in the same commit.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    -- `content_hash` → `checksum_sha256`. The new column above IS the spec's column, so the M-026
    -- one is dropped rather than renamed — keeping both would leave two places to write a digest
    -- and no rule about which is authoritative.
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'kyc_documents' AND column_name = 'content_hash') THEN
        ALTER TABLE kyc_documents DROP COLUMN IF EXISTS content_hash;
    END IF;

    -- `rejection_reason` → `review_notes`. `Schema.md` §4.3 cites `BR-GYM-04`, and the wider name is
    -- the right one: a reviewer's note on an ACCEPTED document is worth keeping too.
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'kyc_documents' AND column_name = 'rejection_reason') THEN
        ALTER TABLE kyc_documents RENAME COLUMN rejection_reason TO review_notes;
    END IF;

    -- `expires_at timestamptz` → `valid_until date`. A document's expiry is printed on it as a DATE;
    -- storing an instant invents a time of day and then makes it timezone-dependent, so the same
    -- licence expires on different days for two readers.
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'kyc_documents' AND column_name = 'expires_at') THEN
        ALTER TABLE kyc_documents RENAME COLUMN expires_at TO valid_until;
        ALTER TABLE kyc_documents ALTER COLUMN valid_until TYPE date USING valid_until::date;
    END IF;

    -- `tombstoned_at` → `storage_purged_at`. Same meaning, and §4.3's name. The M-026 header's
    -- reasoning was right and is preserved in the comment on the new column; only the name moves.
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'kyc_documents' AND column_name = 'tombstoned_at')
       AND EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'kyc_documents' AND column_name = 'storage_purged_at') THEN
        -- Both exist because the ADD above ran. Keep the spec's column, drop M-026's.
        ALTER TABLE kyc_documents DROP COLUMN IF EXISTS tombstoned_at;
    END IF;
END
$$;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 4 · NOT NULL, NOW THAT THE COLUMNS EXIST
--
-- Applied as a second step rather than inline. `ADD COLUMN ... NOT NULL` with no default fails on a
-- non-empty table; splitting it means this migration says out loud that it depends on the table
-- being empty, and fails loudly rather than half-applying if that ever stops being true.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE kyc_documents ALTER COLUMN original_filename SET NOT NULL;
ALTER TABLE kyc_documents ALTER COLUMN content_type      SET NOT NULL;
ALTER TABLE kyc_documents ALTER COLUMN byte_size         SET NOT NULL;
ALTER TABLE kyc_documents ALTER COLUMN checksum_sha256   SET NOT NULL;

/*
 * ┌─ GUARDED, BECAUSE `ADD CONSTRAINT` HAS NO `IF NOT EXISTS` ────────────────────────────────────┐
 * │ PostgreSQL offers `IF NOT EXISTS` for columns and indexes and NOT for table constraints, so   │
 * │ the guard has to be written out. `PM-9` states the rule this satisfies: a migration re-applied │
 * │ after a partial failure must be a no-op, or recovering from the first failure means            │
 * │ hand-editing production.                                                                        │
 * │                                                                                                │
 * │ This was found by re-applying the migration rather than by reading it — `migration-lint`       │
 * │ checks `DROP COLUMN` for the same property and does not yet check `ADD CONSTRAINT`.            │
 * └────────────────────────────────────────────────────────────────────────────────────────────────┘
 */
DO $$
BEGIN
    -- `Schema.md` §4.3 states the constraint as `> 0`. A zero-byte upload is not a document, and it
    -- is what an aborted multipart write leaves behind.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'ck_kyc_documents__byte_size_positive') THEN
        ALTER TABLE kyc_documents
            ADD CONSTRAINT ck_kyc_documents__byte_size_positive CHECK (byte_size > 0);
    END IF;

    -- The digest is lower-case hex, fixed width. `char(64)` already fixes the width and pads
    -- anything shorter with spaces, which is how a truncated digest becomes a valid-looking value.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'ck_kyc_documents__checksum_is_hex') THEN
        ALTER TABLE kyc_documents
            ADD CONSTRAINT ck_kyc_documents__checksum_is_hex
            CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$');
    END IF;
END
$$;

COMMENT ON COLUMN kyc_documents.content_type IS
    'NFR-SEC-10 — determined by inspecting the bytes, never by the client''s declared header.';
COMMENT ON COLUMN kyc_documents.checksum_sha256 IS
    'BR-DAT-07 — proves the stored object is the one the reviewer approved.';
COMMENT ON COLUMN kyc_documents.storage_purged_at IS
    'NFR-PRV-04 — the OBJECT was purged on retention expiry. The ROW is never deleted: the fact '
    'that a legally required check happened must outlive the bytes it was performed on.';
COMMENT ON COLUMN kyc_documents.application_id IS
    'Schema.md §4.3 — NULLABLE while the tenant is still assembling a draft. Evidence accumulates '
    'before submission; submission freezes a snapshot over documents already present (ERD.md §9.6).';
