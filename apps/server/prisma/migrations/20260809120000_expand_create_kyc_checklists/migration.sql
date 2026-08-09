-- migration: 20260809120000_expand_create_kyc_checklists
-- phase:            expand                     -- MG3
-- requirement:      M-029, FR-ONB-03, FR-ADMN-06, Schema.md §12.3, SeedStrategy.md §3.5,
--                   LAUNCH_MARKET_INDIA.md §6, ERD.md §9.6
-- tables:           kyc_checklists, kyc_documents (one additive nullable column + FK)
-- rls:              NONE — GLOBAL reference (§C2.3, ERD.md row 75 `GLB`). On the committed
--                   exemption list, with a reason
-- grants:           SELECT only — see THE GRANT-CLASS DIVERGENCE below. NOT resolved here
-- append_only:      no UPDATE and no DELETE are granted to anybody
-- partitioned:      no
-- max_lock:         ACCESS EXCLUSIVE on a table that does not exist yet; ACCESS EXCLUSIVE on
--                   kyc_documents for a NULL-default ADD COLUMN, which is catalogue-only in PG 16
-- rewrite:          none
-- est_duration:     < 50 ms                                               -- MG11
-- backfill_job:     none. kyc_documents.kyc_checklist_id is NULL on the zero existing rows
-- rollback:         FREE. DROP the constraint, the column, then the table
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             Schema.md §12.3, SeedStrategy.md §3.5, ERD.md §9.6
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- M-029 · The KYC checklist, as CONFIGURATION.
--
-- ┌─ WHY THIS IS A TABLE AND NOT A TYPESCRIPT CONSTANT ──────────────────────────────────────────┐
-- │ `FR-ADMN-06`: editing the checklist per country must require no deployment and must be        │
-- │ audited with a reason. A constant satisfies neither — changing the Indian checklist would be   │
-- │ a release, and nobody could say afterwards who changed it or why.                              │
-- │                                                                                              │
-- │ The second market is the sharper reason. A constant makes "add a country" a code change by a  │
-- │ developer who does not know that market's document law; a table makes it a data change by      │
-- │ somebody who does, with an audit row attached.                                                 │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ FOUR ROWS PER COUNTRY, NOT THIRTY-EIGHT — SeedStrategy.md §3.5 ─────────────────────────────┐
-- │ `Schema.md` §12.3 fixes the natural key as `(country_code, entity_type, version)` and the     │
-- │ payload as `items`, and `SeedStrategy.md` §3.5 states the cardinality directly: *"seeded as   │
-- │ four rows — one per `entity_type_enum` value — because the required documents differ by        │
-- │ entity type"*.                                                                                 │
-- │                                                                                              │
-- │ So the unit of versioning is A WHOLE CHECKLIST, not a document. That is the point of the       │
-- │ shape rather than an accident of it: `ERD.md` §9.6 has each application snapshot the checklist │
-- │ VERSION it was submitted against, and a version is only meaningful if it names a complete set. │
-- │ Per-document rows would let a March edit add a tenth requirement that silently reaches every   │
-- │ February application, which is exactly what §9.6 exists to prevent.                            │
-- │                                                                                              │
-- │ `items` is JSONB, and it is one of the thirty-one columns `Schema.md` §11 enumerates by name.  │
-- │ That list ends *"a JSONB column used to avoid designing a schema is a review rejection"* — so  │
-- │ the shape is CONSTRAINED below by jsonpath rather than trusted.                                │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ NO RLS, AND THIS IS ON THE COMMITTED EXEMPTION LIST ────────────────────────────────────────┐
-- │ GLOBAL reference data — `§C2.3`, and `ERD.md` row 75 classes it `GLB`. There is no            │
-- │ `tenant_id` because the Indian checklist is the same Indian checklist for every gym: it is     │
-- │ derived from that market's document law, and a `tenant_id` would raise the unanswerable        │
-- │ question "whose copy of the law is this?".                                                     │
-- │                                                                                              │
-- │ Same class as `roles` and `permissions`, exempt for the same reason rather than by oversight.  │
-- │ `reference-exemption.int-spec.ts` carries the row and `PC2` fails the build if this table ever │
-- │ acquires a `tenant_id` while staying on that list.                                             │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ THE GRANT-CLASS DIVERGENCE — RECORDED, NOT RESOLVED ────────────────────────────────────────┐
-- │ `Schema.md` disagrees with itself about this table's grant class, and the two readings differ │
-- │ in DDL:                                                                                        │
-- │                                                                                              │
-- │   · §1.3 (line 470) lists `kyc_checklists` among the GLOBAL reference tables *"written only    │
-- │     by `admin/` through the audited reason-required path"* — the definition of **G-REF**,      │
-- │     which grants `SELECT, INSERT, UPDATE` to `app_rw`                                          │
-- │   · §12.3 (line 2040) says *"Grants: **G-APPEND** on all three — versioned by validity window, │
-- │     superseded, never edited"* — `SELECT, INSERT`, and never `UPDATE`                          │
-- │   · §10.3's illustrative G-APPEND grant list names `tax_profiles` and `subscription_tiers`     │
-- │     and does NOT name `kyc_checklists`                                                          │
-- │                                                                                              │
-- │ Whether `app_rw` may ever hold `UPDATE` here is not a detail: **CI-02** fails the build if a   │
-- │ G-APPEND table carries it, so the two readings cannot both be satisfied.                       │
-- │                                                                                              │
-- │ `CLAUDE.md` §9.3 forbids reconciling two documents by picking one in code, so this migration   │
-- │ grants **only what both readings agree on — `SELECT`** — and defers the disputed write grant.  │
-- │ Nothing is being deferred that anything needs: the `FR-ADMN-06` write path arrives at          │
-- │ **M-116** (`Milestones_090-119.md` line 1716), the seed runs as the migration role, and no     │
-- │ code today can observe the difference. This is the same posture the committed `roles`,         │
-- │ `permissions` and `role_permissions` grants already take.                                       │
-- │                                                                                              │
-- │ Raised for the owner as **BLK-15**. It must be settled before M-116 writes the admin path.      │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ `country_code`, NOT `country_id` — A SECOND DIVERGENCE, AND THIS ONE IS DECIDABLE ──────────┐
-- │ `ERD.md` (rows 75, 137, 2675) models the key as `country_id uuid` with                        │
-- │ `fk_kyc_checklists__countries`. `Schema.md` §12.3 and its Prisma model both say               │
-- │ `country_code char(2)`. Three facts settle it without an owner decision:                       │
-- │                                                                                              │
-- │   1. `countries` DOES NOT EXIST — no migration creates it, so the ERD reading has no FK        │
-- │      target and is unbuildable today                                                            │
-- │   2. `Schema.md` §12.3 is the column-level authority and its own Prisma model agrees with it   │
-- │   3. the committed `tenants` migration already carries `country_code country_code NOT NULL`     │
-- │      for the same concept, so the code form is the established precedent in this schema         │
-- │                                                                                              │
-- │ When `countries` lands, adding `country_id` beside the code is additive. Noted in              │
-- │ `KNOWN_LIMITATIONS.md` so it is not rediscovered as a surprise.                                 │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

CREATE TABLE IF NOT EXISTS kyc_checklists (
    id            uuid        NOT NULL DEFAULT gen_random_uuid(),
    created_at    timestamptz NOT NULL DEFAULT now(),   -- CI-06
    updated_at    timestamptz NOT NULL DEFAULT now(),
    created_by    uuid            NULL,
    updated_by    uuid            NULL,

    -- ISO 3166-1 alpha-2, via the `country_code` domain of `0_init`. `IN` today; the column exists
    -- so that the second market is a row rather than a release.
    country_code  country_code     NOT NULL,

    -- The required documents genuinely differ: a company files a Certificate of Incorporation, a
    -- partnership a deed, a sole proprietor a Udyam/MSME registration. One checklist per value.
    entity_type   entity_type_enum NOT NULL,

    -- ┌─ VERSIONED, AND `ERD.md` §9.6 IS WHY ─────────────────────────────────────────────────────┐
    -- │ An application snapshots WHICH version it was submitted against. Adding a tenth required   │
    -- │ document in March must not retroactively make every February application incomplete — so a │
    -- │ change publishes a NEW version and the old one stays readable for every application that   │
    -- │ referenced it. That is also why nothing below grants UPDATE.                                │
    -- └───────────────────────────────────────────────────────────────────────────────────────────┘
    version       integer     NOT NULL,

    -- The ordered checklist. Element shape is enforced by the jsonpath constraints below, not by
    -- convention: `{documentType, obligation, displayOrder, label, helpText?, condition?,
    -- acceptedDocuments?}`.
    items         jsonb       NOT NULL,

    -- When this version stopped being the live one. NULL is live. A superseded version is never
    -- deleted — an application that cited it must stay readable.
    superseded_at timestamptz     NULL,

    CONSTRAINT pk_kyc_checklists PRIMARY KEY (id),

    -- `Schema.md` §12.3, verbatim.
    CONSTRAINT uq_kyc_checklists__country_entity_version
        UNIQUE (country_code, entity_type, version),

    CONSTRAINT ck_kyc_checklists__version_positive CHECK (version >= 1),

    -- ── The JSONB payload is CONSTRAINED, because §11 says an unconstrained one is a rejection ──
    --
    -- `@?` is `jsonb_path_exists`, immutable for a jsonpath with no variables, so it is legal in a
    -- CHECK. Each rule below is phrased as "no element violates this", because a jsonpath that
    -- matches nothing is the only way to express a universal in a constraint.

    CONSTRAINT ck_kyc_checklists__items_is_nonempty_array
        CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0),

    -- Every element must name a document type and an order, or the wizard renders a blank line.
    CONSTRAINT ck_kyc_checklists__items_have_required_keys
        CHECK (NOT (items @? '$[*] ? (!exists(@.documentType) || !exists(@.obligation) || !exists(@.displayOrder) || !exists(@.label))')),

    -- ┌─ THREE OBLIGATIONS, NOT A BOOLEAN ────────────────────────────────────────────────────────┐
    -- │ `ALWAYS`      required of every applicant — PAN, bank proof, premises address              │
    -- │ `CONDITIONAL` required when `condition` holds — GSTIN above the registration threshold     │
    -- │ `ADVISORY`    requested and NON-BLOCKING — the music licence                                │
    -- │                                                                                            │
    -- │ `SeedStrategy.md` §3.5's legend is *"M mandatory · C conditional · A advisory"*, and the    │
    -- │ music licence is marked **A** with *"advisory, never blocking"*. A boolean `required` would │
    -- │ force that case into one of the other two: mandatory blocks an approval over a licence the  │
    -- │ law does not require, and optional means nobody is ever asked for it.                       │
    -- └───────────────────────────────────────────────────────────────────────────────────────────┘
    CONSTRAINT ck_kyc_checklists__items_obligation_known
        CHECK (NOT (items @? '$[*] ? (@.obligation != "ALWAYS" && @.obligation != "CONDITIONAL" && @.obligation != "ADVISORY")')),

    -- A CONDITIONAL item with no condition is required of everybody while claiming not to be — the
    -- worst of both, and invisible until somebody reads the rendered checklist and wonders.
    CONSTRAINT ck_kyc_checklists__conditional_has_condition
        CHECK (NOT (items @? '$[*] ? (@.obligation == "CONDITIONAL" && !exists(@.condition))')),

    -- ┌─ PAN IS ALWAYS, AND THIS CONSTRAINT IS LOAD-BEARING ──────────────────────────────────────┐
    -- │ `gstin.vo.ts` skips the PAN cross-check when no PAN is supplied, and justifies it with     │
    -- │ *"the checklist, not this function, is what makes PAN mandatory"*. That reasoning is only  │
    -- │ sound while it is TRUE. A future checklist version that demoted PAN to CONDITIONAL would   │
    -- │ turn a documented non-hole into a real one, silently, in data rather than in code.          │
    -- │ So the premise is enforced where the data lives.                                            │
    -- └───────────────────────────────────────────────────────────────────────────────────────────┘
    CONSTRAINT ck_kyc_checklists__pan_is_always
        CHECK (items @? '$[*] ? (@.documentType == "PAN" && @.obligation == "ALWAYS")')
);

COMMENT ON TABLE kyc_checklists IS
    'M-029 · GLOBAL reference (§C2.3), FR-ONB-03. One row per (country, entity_type, version); the '
    'ordered document set lives in items. Versioned as a WHOLE checklist so that an application '
    'snapshotting a version names a complete set (ERD.md §9.6).';
COMMENT ON COLUMN kyc_checklists.items IS
    'Ordered checklist items. obligation is ALWAYS | CONDITIONAL | ADVISORY — three, not a boolean: '
    'an advisory document must be requested without blocking approval, which neither mandatory nor '
    'optional expresses. Shape enforced by the ck_kyc_checklists__items_* jsonpath constraints.';

-- ┌─ AT MOST ONE LIVE VERSION PER (COUNTRY, ENTITY TYPE) ────────────────────────────────────────┐
-- │ The resolver reads "the live checklist for this applicant". Two live rows would make that     │
-- │ query return whichever the planner reached first — a checklist that differs between two page  │
-- │ loads, with no error anywhere. A partial unique index is the only place that invariant can be │
-- │ stated once and hold against every writer.                                                     │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
CREATE UNIQUE INDEX IF NOT EXISTS uq_kyc_checklists__one_live_per_entity_type
    ON kyc_checklists (country_code, entity_type)
    WHERE superseded_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- `ERD.md` §2176 · fk_kyc_documents__kyc_checklists — templated_by
--
-- Added here rather than in the `kyc_documents` migration because this is the migration in which
-- the FK target begins to exist. Nullable and RESTRICT: a checklist version that any document
-- cites cannot be deleted, which is the same guarantee §9.6 makes about application snapshots.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE kyc_documents
    ADD COLUMN IF NOT EXISTS kyc_checklist_id uuid NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_kyc_documents__kyc_checklists'
    ) THEN
        ALTER TABLE kyc_documents
            ADD CONSTRAINT fk_kyc_documents__kyc_checklists
            FOREIGN KEY (kyc_checklist_id) REFERENCES kyc_checklists (id) ON DELETE RESTRICT;
    END IF;
END
$$;

-- CI-07: every foreign-key column has an index. Without one, the RESTRICT check on the parent side
-- degrades to a sequential scan of every KYC document in the platform.
CREATE INDEX IF NOT EXISTS idx_kyc_documents__kyc_checklist_id
    ON kyc_documents (kyc_checklist_id);

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- GRANTS — the intersection of G-REF and G-APPEND, pending BLK-15
--
-- SELECT to both application roles. No INSERT, no UPDATE, no DELETE, for anybody: the seed runs as
-- the migration role, and the `FR-ADMN-06` write path arrives at M-116 once the class is settled.
--
-- The absence of INSERT for `app_rw` is a property worth naming rather than a side effect of the
-- deferral: a checklist any request could write is a checklist an application could edit to remove
-- the document it does not have.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

GRANT SELECT ON kyc_checklists TO app_rw, app_platform_ro;
