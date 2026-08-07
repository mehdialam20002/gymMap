-- migration: 20260807000000_expand_create_tenants
-- phase:            expand                     -- MG3, CI_CD §7.2
-- requirement:      EP-01 F-01.5, BR-TEN-01, BR-TEN-04, BR-TEN-06, NFR-SEC-09, §C2.2, §C4.4
-- tables:           tenants                    -- the first tenant-owned table
-- rls:              new table                  -- P9, MG10. Enabled AND forced, USING and WITH CHECK
-- grants:           G-CRUD                     -- P10, Constraints.md §9
-- append_only:      no                         -- AP1. Soft delete via deleted_at (ADR-0024)
-- partitioned:      no                         -- §5
-- max_lock:         ACCESS EXCLUSIVE (create, empty table)          -- §4.1
-- rewrite:          none
-- est_duration:     < 100 ms on an empty database                   -- MG11
-- backfill_job:     none                       -- MG6
-- rollback:         FREE                       -- P4. Nothing references it yet
-- concurrent_steps: none                       -- §2.6
-- reviewers:        two, one schema owner      -- MG8
-- docs:             Schema.md §4.1, Constraints.md §8.3 §9, prisma/rls/_template.sql
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- THIS TABLE IS POLICY CLASS **P-SELF**, NOT P-STD. Read this before copying the pattern.
--
-- Every other tenant-owned table carries a `tenant_id` column and is policed on
--     tenant_id = current_setting('app.tenant_id')::uuid
--
-- `tenants` has no `tenant_id` column, because its own PRIMARY KEY *is* the tenant id. The
-- policy is therefore on `id`. Adding a self-referencing `tenant_id` here would be a second
-- copy of the same fact, and the two could disagree — at which point a tenant is visible to
-- itself under one column and to somebody else under the other.
--
-- Consequence worth stating: `SELECT count(*) FROM tenants` as `app_rw` returns exactly 1.
-- A tenant cannot enumerate the platform's customer list. That is the whole point.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
--
-- THE TRAP THIS MILESTONE NAMES: writing the policy PERMISSIVELY, as
--     current_setting('app.tenant_id', true)
-- because it makes the local suite quieter. The `true` is `missing_ok`. With it, an unset
-- variable yields NULL, the predicate is NULL, and the query returns ZERO ROWS — silently.
--
-- §2.3.4 states the schema's contribution honestly: it converts a SILENT LEAK into a VISIBLE
-- ERROR. Without `missing_ok` an unset context raises SQLSTATE 42704 and someone fixes the
-- context. With it, the bug presents as "the data is missing", somebody widens the policy to
-- make the data appear, and THAT is the breach. Do not trade it for a tidier log.

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 1 · THE TABLE — Schema.md §4.1 plus the §1.2 universal column set
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tenants (
    -- §1.2 universal columns. `id` is application-supplied UUIDv7 (ERD.md §11.5): the id must
    -- exist BEFORE the insert so an outbox row and its aggregate can reference each other in
    -- one transaction, and a sequential key would leak volume across tenants (§15.8 rule 2).
    id                            uuid                        NOT NULL,
    created_at                    timestamptz                 NOT NULL DEFAULT now(),
    updated_at                    timestamptz                 NOT NULL DEFAULT now(),
    -- No FK to users. CON-04: an audit-bearing row must outlive the actor when BR-DAT-04
    -- pseudonymises them. RESTRICT would block the data-subject process; SET NULL would
    -- destroy attribution. Resolvability is checked by ops.orphan-scan, not by the planner.
    created_by                    uuid                        NULL,
    updated_by                    uuid                        NULL,

    -- Identity
    legal_name                    text                        NOT NULL,
    trading_name                  text                        NULL,
    entity_type                   entity_type_enum            NOT NULL,
    registration_number           text                        NULL,
    country_code                  country_code                NOT NULL DEFAULT 'IN',
    currency                      currency_code               NOT NULL DEFAULT 'INR',
    timezone                      iana_timezone               NOT NULL DEFAULT 'Asia/Kolkata',
    status                        tenant_status_enum          NOT NULL DEFAULT 'DRAFT',

    -- Subscription
    subscription_tier_id          uuid                        NULL,
    subscription_status           subscription_status_enum    NOT NULL DEFAULT 'TRIAL',
    subscription_past_due_since   timestamptz                 NULL,

    -- Commercial terms. Every rate is basis points, never a decimal fraction (§10.4, R3).
    commission_rate_bps           basis_points                NULL,
    renewal_commission_rate_bps   basis_points                NULL,
    settlement_cycle_days         integer                     NOT NULL DEFAULT 7,
    reserve_bps                   basis_points                NOT NULL DEFAULT 500,
    reserve_release_days          integer                     NOT NULL DEFAULT 30,
    payout_hold_until             date                        NULL,
    minimum_payout_minor          money_minor_nonneg          NOT NULL DEFAULT 0,

    -- Tax identity. India: LAUNCH_MARKET_INDIA.md §6, ERD.md §12.3.
    tax_profile_id                uuid                        NULL,
    pan                           pan_in                      NULL,
    gstin                         gstin_in                    NULL,
    state_code                    char(2)                     NULL,
    tax_registration_status       tax_registration_status_enum NOT NULL DEFAULT 'NOT_REGISTERED',

    -- Registered address, printed on the invoice header (FR-INV-03).
    registered_address_line1      text                        NULL,
    registered_address_line2      text                        NULL,
    registered_city               text                        NULL,
    registered_state              text                        NULL,
    registered_postal_code        text                        NULL,

    refund_policy                 jsonb                       NOT NULL DEFAULT '{"schema_version":1}',

    -- ADR-0024 soft delete. Financial, invoice and audit records are retained regardless
    -- (BR-TEN-04, TL1).
    deleted_at                    timestamptz                 NULL,

    CONSTRAINT pk_tenants PRIMARY KEY (id),

    CONSTRAINT ck_tenants__legal_name_length
        CHECK (length(legal_name) BETWEEN 1 AND 200),
    CONSTRAINT ck_tenants__trading_name_length
        CHECK (trading_name IS NULL OR length(trading_name) BETWEEN 1 AND 200),
    CONSTRAINT ck_tenants__settlement_cycle_positive
        CHECK (settlement_cycle_days > 0),
    CONSTRAINT ck_tenants__reserve_release_days_positive
        CHECK (reserve_release_days > 0),

    -- India: PAN is mandatory, but only once the tenant is APPROVED. A DRAFT applicant has
    -- not uploaded documents yet, and a constraint that blocked the first INSERT would make
    -- the onboarding wizard unimplementable (FR-ONB-*). The rule bites at the transition that
    -- matters — the one after which invoices carry the PAN.
    CONSTRAINT ck_tenants__pan_required_for_in
        CHECK (
            country_code <> 'IN'
            OR pan IS NOT NULL
            OR status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'REJECTED')
        ),

    -- GSTIN embeds the state code in its first two characters. When both are present they must
    -- agree, because state_code is what decides CGST+SGST versus IGST — a disagreement is a
    -- tax return that is wrong in a way nobody notices until an assessment.
    CONSTRAINT ck_tenants__gstin_state_matches
        CHECK (
            gstin IS NULL
            OR state_code IS NULL
            OR state_code = substring(gstin FROM 1 FOR 2)
        ),

    CONSTRAINT ck_tenants__refund_policy_versioned
        CHECK (refund_policy ? 'schema_version'),

    -- BR-TEN-06 needs an anchor for the 7-day visibility loss and the 14-day write-access
    -- loss. PAST_DUE without a timestamp makes the schedule unimplementable (TL3).
    CONSTRAINT ck_tenants__past_due_has_anchor
        CHECK (subscription_status <> 'PAST_DUE' OR subscription_past_due_since IS NOT NULL)
);

-- Registration number is unique PER COUNTRY, not globally: two countries' registries assign
-- overlapping numbers, and a global unique index would reject a legitimate second-country
-- tenant. Partial on `deleted_at IS NULL` so a soft-deleted tenant frees its number (SD7).
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants__country_registration_number
    ON tenants (country_code, registration_number)
    WHERE registration_number IS NOT NULL AND deleted_at IS NULL;

-- Serves the admin approval queue and the §C4.4 state dashboards.
CREATE INDEX IF NOT EXISTS idx_tenants__status_created_at
    ON tenants (status, created_at DESC)
    WHERE deleted_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 2 · COLUMN COMMENTS — NFR-PRV-01
--
-- Every column says what it is FOR. A schema browser is the first place anyone looks when
-- asked "what personal data do we hold", and a column with no comment is a column somebody has
-- to guess about during a DPDP response.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE  tenants IS
  'The gym business: unit of data isolation, commercial contract, tax identity and settlement. RLS policy class P-SELF — the primary key IS the tenant id (BR-TEN-01).';
COMMENT ON COLUMN tenants.id IS 'UUIDv7, application-supplied. Also the RLS key for this table (P-SELF).';
COMMENT ON COLUMN tenants.legal_name IS 'Registered legal name, printed on every invoice (FR-INV-03).';
COMMENT ON COLUMN tenants.trading_name IS 'The name customers know, where it differs from the legal name.';
COMMENT ON COLUMN tenants.entity_type IS 'Drives the KYC checklist branch and the PAN 4th-character check.';
COMMENT ON COLUMN tenants.registration_number IS 'Company/partnership registration. Unique per country.';
COMMENT ON COLUMN tenants.country_code IS 'Drives tax profile, KYC checklist, FY start month and currency default (ADR-0028).';
COMMENT ON COLUMN tenants.currency IS 'ISO-4217. Authoritative for every child table that carries money (BR-PAY-01).';
COMMENT ON COLUMN tenants.timezone IS 'AUTHORITATIVE for all validity computation — membership start/end, operating hours, FY boundary, job scheduling (TM3, ADR-0025).';
COMMENT ON COLUMN tenants.status IS 'The §C4.4 state machine. Only APPROVED is publicly discoverable (BR-GYM-01).';
COMMENT ON COLUMN tenants.subscription_status IS 'Drives the BR-TEN-06 degradation schedule.';
COMMENT ON COLUMN tenants.subscription_past_due_since IS 'Anchors the 7-day visibility loss and 14-day write-access loss (TL3).';
COMMENT ON COLUMN tenants.commission_rate_bps IS 'Tenant override in basis points. NULL means resolve from tier, then platform default (R5).';
COMMENT ON COLUMN tenants.renewal_commission_rate_bps IS 'Override for second and subsequent renewals (A6.3).';
COMMENT ON COLUMN tenants.settlement_cycle_days IS 'T+N from capture (A6.4).';
COMMENT ON COLUMN tenants.reserve_bps IS 'Rolling reserve, basis points. Default 5%.';
COMMENT ON COLUMN tenants.payout_hold_until IS 'New-tenant 14-day fraud hold; also set when a bank change re-triggers verification (BR-GYM-06).';
COMMENT ON COLUMN tenants.minimum_payout_minor IS 'Integer minor units. Balances below the floor roll forward (BR-PAY-01).';
COMMENT ON COLUMN tenants.pan IS 'PERSONAL/FINANCIAL IDENTIFIER (India). Permanent account number. Printed on every invoice. Redacted from logs (BR-DAT-06).';
COMMENT ON COLUMN tenants.gstin IS 'FINANCIAL IDENTIFIER (India). 15 characters; embeds state code, PAN and a checksum.';
COMMENT ON COLUMN tenants.state_code IS 'Decides intra-state (CGST+SGST) versus inter-state (IGST). Derived from GSTIN when present.';
COMMENT ON COLUMN tenants.refund_policy IS 'Snapshotted onto every order at sale time (BR-REF-01). Versioned by schema_version.';
COMMENT ON COLUMN tenants.deleted_at IS 'Soft delete (ADR-0024). Financial, invoice and audit records are retained regardless (BR-TEN-04).';

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 3 · ROW-LEVEL SECURITY — the P-SELF policy pair
--
-- FORCE, not just ENABLE. ENABLE alone exempts the table OWNER, and migrations run as an
-- owner — so without FORCE the policy is advisory for exactly the connection most able to do
-- damage (§2.3.3 obligation 2, IS6).
-- ═══════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE  ROW LEVEL SECURITY;

-- USING filters what can be READ. WITH CHECK constrains what can be WRITTEN.
--
-- PC4 proves why both are mandatory: a USING-only policy permits a cross-tenant INSERT. The
-- inserting tenant then cannot see the row it just created, so nothing looks wrong from either
-- side, and the row sits in another tenant's scope indefinitely (AC-FND-01.1).
CREATE POLICY rls_tenants__tenant_isolation
    ON tenants
    FOR ALL
    TO app_rw, app_append
    USING      (id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (id = current_setting('app.tenant_id')::uuid);

-- The platform path. SELECT ONLY, across tenants, and only for the elevation role that
-- runElevated() assumes (M-014). This is what makes the admin approval queue possible without
-- granting BYPASSRLS anywhere. It must never gain INSERT, UPDATE or DELETE.
CREATE POLICY rls_tenants__platform_read
    ON tenants
    FOR SELECT
    TO app_platform_ro
    USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 4 · GRANTS — class G-CRUD (Constraints.md §9)
--
-- No DELETE. `tenants` carries `deleted_at`, so the domain operation is a soft delete
-- (ADR-0024). The genuine hard-delete path BR-DAT-04 requires runs as app_migrator in a
-- reviewed job, never on the request path.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE ON tenants TO app_rw;
GRANT SELECT                 ON tenants TO app_platform_ro;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 5 · FOREIGN KEYS — DEFERRED, and why
--
-- Schema.md §4.1 declares three: fk_tenants__countries, fk_tenants__subscription_tiers and
-- fk_tenants__tax_profiles. None of those parent tables exists yet — they are `admin/` G-REF
-- reference tables delivered by M-114 and M-115.
--
-- The columns are created NOW so no later migration has to rewrite the table to add them; the
-- constraints arrive with their parents. This is recorded rather than silently omitted, and a
-- migration that creates `countries` without also adding fk_tenants__countries is incomplete.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
