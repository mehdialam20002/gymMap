-- migration: 0_init
-- phase:            expand                     -- MG3, CI_CD §7.2
-- requirement:      EP-01 F-01.5, BR-PAY-01, BR-TEN-01, NFR-DQ-02, NFR-SEC-09, ADR-0004, R-M1
-- tables:           none                       -- R-M1: 0_init creates ZERO tables
-- rls:              unchanged                  -- P9. No table exists to carry a policy yet
-- grants:           granted                    -- P10. The four app_* roles and the blanket revoke
-- append_only:      no                         -- AP1
-- partitioned:      no                         -- §5
-- max_lock:         none (catalogue only, no table touched)         -- §4.1
-- rewrite:          none
-- est_duration:     < 2 s on an empty database                      -- MG11
-- backfill_job:     none                       -- MG6
-- rollback:         FREE                       -- P4. Nothing depends on these objects yet
-- concurrent_steps: none                       -- §2.6
-- reviewers:        two, one schema owner      -- MG8
-- docs:             Schema.md §2.4 §2.5, MigrationStrategy.md §2.4, DECISION_LOG R-M1
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- WHAT THIS MIGRATION IS, AND WHY IT CREATES NO TABLES
--
-- Roadmap ruling R-M1. MigrationStrategy.md PM-7 originally described `0_init` as one migration
-- creating 79 tables. That cannot be built inside a milestone that leaves the repository green,
-- and it collides with P5 (one logical change per migration). So `0_init` carries the PHYSICAL
-- FOUNDATIONS only — extensions, domains, the enum catalogue, the four roles, and the blanket
-- revoke. Every table thereafter arrives in its own `<ts>_create_<table>` migration carrying its
-- RLS block and grants in the SAME file (MG10, P9, R-6).
--
-- A reviewer should be able to read this entire file in ten minutes.
--
-- THE TRAP THIS FILE EXISTS TO AVOID (M-006 notes): Prisma's diff engine knows nothing about
-- roles, domains, policies or grants. `prisma migrate dev` would happily generate a migration
-- that drops every object below, because they do not appear in schema.prisma and the diff
-- therefore reads them as drift. That is why this file is HAND-WRITTEN and why
-- `migration-lint` exists. Never regenerate it.
--
-- The enum block was generated from docs/database/Schema.md §2.5 by
-- packages/config/scripts/generate-enum-sql.mjs — 81 types, 460 values. Retyping 460 values by
-- hand is how `CANCELLED` becomes `CANCELED` in one place and not the other.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 1 · EXTENSIONS
--
-- Created HERE, not by the Docker initdb script. infra/compose/initdb/01-extensions.sql only
-- ASSERTS they are available. Two provenances for the same objects would mean local gets its
-- extensions from Docker and production from this migration — so this file would be a silent
-- no-op locally and the only real code path in production, shipping having never run.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS postgis;              -- §C1.1 geospatial. "gyms near me".
CREATE EXTENSION IF NOT EXISTS pg_trgm;              -- §C1.1 fuzzy match. No search cluster (ADR-0007).
CREATE EXTENSION IF NOT EXISTS unaccent;             -- "Andheri" must match "Andhéri".
CREATE EXTENSION IF NOT EXISTS btree_gin;            -- Composite GIN over the search document.
CREATE EXTENSION IF NOT EXISTS btree_gist;           -- BR-PLN-07 overlapping-promotion exclusion.
CREATE EXTENSION IF NOT EXISTS pgcrypto;             -- digest() without an application round trip.
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;   -- Monitoring.md parity; makes an N+1 measurable.

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 2 · DOMAINS — Schema.md §2.4
--
-- Used only where a rule is stable, checkable in the database, and would otherwise be restated
-- on 200 columns. A domain that adds no constraint adds only indirection.
--
-- Branded ids are deliberately NOT domains. Constitution §9.5 puts TenantId/GymId/MembershipId
-- in TypeScript, where they stop a GymId being passed as a TenantId. A per-entity uuid domain
-- would add 78 domains, would not be enforced across a join, and would give the planner nothing.
-- The brand lives in packages/types; the column is `uuid`. Recorded so nobody "completes" it.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- Money. BR-PAY-01, NFR-DQ-02, ADR-0014, constitution §10.1, DB1/DB2.
-- Integer minor units — paise for India. bigint, never numeric, never money, never float.
-- A domain over bigint still reports `bigint` as its base type, so DB2's information_schema
-- scan for `%_minor` columns keeps working, AND the schema now says why the column is a bigint.
CREATE DOMAIN money_minor AS bigint;

-- Prices, fees, gross amounts, tax components. Signed amounts belong to ledger entries.
CREATE DOMAIN money_minor_nonneg AS bigint CHECK (VALUE >= 0);

-- ISO-4217, always adjacent to a money_minor column. The domain cannot enforce adjacency —
-- that is CI-04's job — but it does stop 'inr' and 'INR '.
CREATE DOMAIN currency_code AS char(3) CHECK (VALUE ~ '^[A-Z]{3}$');

-- Rates are integer basis points. 1 bps = 0.01%. §10.4, R1/R3. Never a decimal fraction.
-- The 1,000,000 bps ceiling (10,000%) is deliberately loose: it catches a percentage written
-- as a rate, not a business error.
CREATE DOMAIN basis_points AS integer CHECK (VALUE >= 0 AND VALUE <= 1000000);

-- IANA identifier. TM3: authoritative for all validity computation. Rejects 'IST'.
CREATE DOMAIN iana_timezone AS text CHECK (VALUE ~ '^[A-Za-z_]+/[A-Za-z_+\-0-9/]+$');

CREATE DOMAIN country_code AS char(2) CHECK (VALUE ~ '^[A-Z]{2}$');

CREATE DOMAIN slug AS text
  CHECK (VALUE ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(VALUE) BETWEEN 2 AND 120);

-- E.164. India: +91XXXXXXXXXX. Stored normalised; never a display format.
CREATE DOMAIN phone_e164 AS text CHECK (VALUE ~ '^\+[1-9][0-9]{7,14}$');

-- Deliberately permissive. RFC 5322 in a CHECK constraint is a well-known way to reject
-- valid addresses.
CREATE DOMAIN email_address AS text
  CHECK (VALUE ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' AND length(VALUE) <= 320);

-- India tax identity. LAUNCH_MARKET_INDIA.md §6, ERD.md §12.3.
-- FORMAT ONLY. The semantic checks are application-layer: PAN's 4th character encodes entity
-- type and must agree with tenants.entity_type; GSTIN embeds a state code and a checksum. A
-- CHECK implementing the GSTIN checksum would be unmaintainable SQL, and the failure mode of a
-- wrong checksum is a rejected KYC document, not a corrupted row.
CREATE DOMAIN pan_in AS text CHECK (VALUE ~ '^[A-Z]{5}[0-9]{4}[A-Z]$');
CREATE DOMAIN gstin_in AS text
  CHECK (VALUE ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$');

-- ERD.md §12.6: a stored `2026` is ambiguous on 31 March. '2026-27', never the integer.
CREATE DOMAIN financial_year_label AS text CHECK (VALUE ~ '^[0-9]{4}-[0-9]{2}$');

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 3 · THE ENUM CATALOGUE — Schema.md §2.5
--
-- Names are snake_case singular with an `_enum` suffix; values are SCREAMING_SNAKE_CASE
-- matching the PRD verbatim (constitution §8.7).
--
-- THE NEVER-REMOVE RULE (MG9). A value is ADDED, never removed while any row holds it, and
-- never renamed. A value no longer offered is DEPRECATED — recorded in the catalogue, stopped
-- as Zod *input* while still parsed as *output*, and optionally blocked by a CHECK. This exists
-- because R-FIN retention is eight financial years: a value removed in year two makes a
-- year-one settlement statement unrenderable, and it surfaces during a tax audit.
--
-- `outbox_aggregate_type_enum` is DEFERRED, not forgotten. See the note at the end of this file.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- `BR-DAT-01`, `BR-DAT-02`, `AC2`
CREATE TYPE actor_type_enum AS ENUM (
  'USER',
  'STAFF',
  'SYSTEM',
  'JOB',
  'WEBHOOK',
  'SUPPORT_IMPERSONATION',
  'PLATFORM_ADMIN'
);

-- `BR-GYM-03`, `BR-GYM-04`
CREATE TYPE application_decision_enum AS ENUM (
  'APPROVED',
  'REJECTED',
  'INFO_REQUESTED'
);

-- §C4.8, all sixteen, verbatim
CREATE TYPE application_rejection_reason_enum AS ENUM (
  'KYC_DOCUMENT_MISSING',
  'KYC_DOCUMENT_ILLEGIBLE',
  'KYC_DOCUMENT_EXPIRED',
  'KYC_NAME_MISMATCH',
  'ADDRESS_UNVERIFIABLE',
  'GEO_ADDRESS_MISMATCH',
  'DUPLICATE_LISTING',
  'INSUFFICIENT_PHOTOS',
  'PHOTO_QUALITY',
  'PHOTO_NOT_OF_PREMISES',
  'INCOMPLETE_PROFILE',
  'NO_PUBLISHED_PLAN',
  'BANK_VERIFICATION_FAILED',
  'PROHIBITED_CONTENT',
  'SUSPECTED_FRAUD',
  'OTHER'
);

-- §C4.4. **No `DRAFT`** — a draft is a tenant state, not a submitted application version (`FR-ONB-08`)
CREATE TYPE application_status_enum AS ENUM (
  'SUBMITTED',
  'UNDER_REVIEW',
  'INFO_REQUESTED',
  'APPROVED',
  'REJECTED'
);

-- §C2.2, `BR-CHK-08`
CREATE TYPE attendance_method_enum AS ENUM (
  'SCAN',
  'MANUAL',
  'OVERRIDE'
);

-- `BR-CHK-10`
CREATE TYPE attendance_result_enum AS ENUM (
  'ALLOWED',
  'DENIED'
);

-- `A6.3` attribution. `GYM_OWN_LINK` is the value that makes a sale `DIRECT`, and it must be record...
CREATE TYPE attribution_surface_enum AS ENUM (
  'SEARCH',
  'CATEGORY',
  'GYM_DETAIL',
  'COMPARISON',
  'FAVOURITES',
  'CAMPAIGN_LINK',
  'GYM_OWN_LINK'
);

-- `BR-DAT-01`, `BR-DAT-02`, `PE2`, `SD8`
CREATE TYPE audit_action_enum AS ENUM (
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'IMPERSONATE_START',
  'IMPERSONATE_END',
  'EXPORT',
  'APPROVE',
  'REJECT',
  'ELEVATE',
  'CONFIG_CHANGE',
  'RETENTION_PURGE'
);

-- BR-DAT-01, AuditStrategy.md §1.3 — the 31 governed entities
CREATE TYPE audit_entity_type_enum AS ENUM (
  'TENANT',
  'APPLICATION',
  'KYC_DOCUMENT',
  'PAYOUT_ACCOUNT',
  'USER',
  'USER_ROLE',
  'AUTH_SESSION',
  'TENANT_SESSION',
  'STAFF',
  'STAFF_INVITATION',
  'GYM',
  'BRANCH',
  'GYM_MEDIA',
  'PLAN',
  'ADD_ON',
  'COUPON',
  'ORDER',
  'PAYMENT',
  'INVOICE',
  'CREDIT_NOTE',
  'REFUND',
  'DISPUTE',
  'SETTLEMENT_BATCH',
  'MEMBERSHIP',
  'ATTENDANCE',
  'CRM_MEMBER',
  'MEMBER_NOTE',
  'LEAD',
  'REVIEW',
  'EXPORT_JOB',
  'PLATFORM_CONFIG'
);

-- `FR-AUTH-09`, `FR-AUTH-10`, ADR-0011
CREATE TYPE auth_session_status_enum AS ENUM (
  'ACTIVE',
  'REVOKED',
  'EXPIRED'
);

-- §C2.2
CREATE TYPE branch_status_enum AS ENUM (
  'ACTIVE',
  'INACTIVE'
);

-- §C4.8, all fifteen, verbatim
CREATE TYPE check_in_denial_reason_enum AS ENUM (
  'MEMBERSHIP_EXPIRED',
  'MEMBERSHIP_FROZEN',
  'MEMBERSHIP_PENDING_START',
  'MEMBERSHIP_CANCELLED',
  'MEMBERSHIP_REFUNDED',
  'WRONG_BRANCH',
  'OUTSIDE_OPERATING_HOURS',
  'OUTSIDE_PLAN_ACCESS_WINDOW',
  'GYM_CLOSED_EXCEPTION',
  'NO_SESSIONS_REMAINING',
  'DUPLICATE_WITHIN_COOLDOWN',
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
  'MEMBERSHIP_UNDER_REVIEW',
  'TENANT_SUSPENDED'
);

-- §C4.8, all seven, verbatim
CREATE TYPE check_in_override_reason_enum AS ENUM (
  'MEMBER_PHONE_UNAVAILABLE',
  'TECHNICAL_ISSUE',
  'GRACE_PERIOD_GRANTED',
  'PAYMENT_PENDING_CONFIRMED',
  'TRIAL_VISIT',
  'MANAGEMENT_APPROVAL',
  'OTHER'
);

-- `C9.4` city gating
CREATE TYPE city_status_enum AS ENUM (
  'PLANNED',
  'GATED',
  'LIVE',
  'PAUSED'
);

-- `R5` — `AC-ADMN-01.2` requires the resolved rate **and its source** to be answerable from data
CREATE TYPE commission_rate_source_enum AS ENUM (
  'PLATFORM_DEFAULT',
  'TIER',
  'TENANT_OVERRIDE',
  'NEGOTIATED'
);

-- `BR-CPN-05` — determines the commission base per `A6.3`; immutable after first use
CREATE TYPE coupon_funding_source_enum AS ENUM (
  'PLATFORM',
  'GYM'
);

-- §C2.2, `FR-CPN-02`
CREATE TYPE coupon_scope_enum AS ENUM (
  'PLATFORM',
  'TENANT'
);

-- `BR-CPN-03`, `FR-CPN-05`
CREATE TYPE coupon_status_enum AS ENUM (
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'EXHAUSTED',
  'EXPIRED',
  'ARCHIVED'
);

-- Single-valued today. An enum rather than nothing because `MG9` makes adding a value cheap and add...
CREATE TYPE credit_note_status_enum AS ENUM (
  'ISSUED'
);

-- `FR-CRM-04`, `FR-CRM-09`
CREATE TYPE crm_member_source_enum AS ENUM (
  'MARKETPLACE',
  'WALK_IN',
  'REFERRAL',
  'IMPORT',
  'STAFF_CREATED'
);

-- `NFR-PRV-03`. `PARTIALLY_FULFILLED` is the `CON-04` outcome: identifiers erased, financial record...
CREATE TYPE data_subject_request_status_enum AS ENUM (
  'RECEIVED',
  'IDENTITY_VERIFICATION',
  'IN_PROGRESS',
  'COMPLETED',
  'PARTIALLY_FULFILLED',
  'REJECTED'
);

-- `BR-DAT-03`, `BR-DAT-04`, `NFR-PRV-03`
CREATE TYPE data_subject_request_type_enum AS ENUM (
  'ACCESS',
  'EXPORT',
  'CORRECTION',
  'DELETION'
);

-- `BR-CPN-01`
CREATE TYPE discount_type_enum AS ENUM (
  'PERCENT',
  'FIXED'
);

-- `BR-REF-08`. Nullable until resolution, immutable after
CREATE TYPE dispute_outcome_enum AS ENUM (
  'WON',
  'LOST',
  'PARTIAL',
  'WITHDRAWN'
);

-- `BR-REF-08`
CREATE TYPE dispute_status_enum AS ENUM (
  'OPEN',
  'EVIDENCE_REQUIRED',
  'EVIDENCE_SUBMITTED',
  'UNDER_REVIEW',
  'RESOLVED',
  'EXPIRED'
);

-- `ERD.md` §12.5, TRAI DLT
CREATE TYPE dlt_approval_status_enum AS ENUM (
  'NOT_REQUIRED',
  'PENDING_DLT_APPROVAL',
  'APPROVED',
  'REJECTED'
);

-- §C2.2, `TM12`
CREATE TYPE duration_unit_enum AS ENUM (
  'DAY',
  'WEEK',
  'MONTH',
  'YEAR'
);

-- §C2.2. India's LLP and Udyam-registered entities map to `COMPANY` and `SOLE_PROPRIETOR` via the K...
CREATE TYPE entity_type_enum AS ENUM (
  'SOLE_PROPRIETOR',
  'PARTNERSHIP',
  'COMPANY',
  'OTHER'
);

-- `BR-DAT-05`, `FR-RPT-07`
CREATE TYPE export_job_status_enum AS ENUM (
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'EXPIRED'
);

-- `BR-MEM-05`, `BR-MEM-07`
CREATE TYPE freeze_status_enum AS ENUM (
  'SCHEDULED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED'
);

-- `BR-PLN-01`
CREATE TYPE gender_eligibility_enum AS ENUM (
  'ANY',
  'FEMALE',
  'MALE'
);

-- §C2.2
CREATE TYPE gender_policy_enum AS ENUM (
  'MIXED',
  'WOMEN_ONLY',
  'MEN_ONLY',
  'SCHEDULED'
);

-- §C2.2, `BR-GYM-01`
CREATE TYPE gym_status_enum AS ENUM (
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'SUSPENDED',
  'CLOSED'
);

-- `BR-PAY-10`. There is deliberately **no `VOID` and no `CANCELLED`**: an issued invoice is never v...
CREATE TYPE invoice_status_enum AS ENUM (
  'ISSUED',
  'PARTIALLY_CREDITED',
  'FULLY_CREDITED'
);

-- `FR-ONB-03`, `BR-GYM-02`
CREATE TYPE kyc_document_status_enum AS ENUM (
  'PENDING',
  'UNDER_REVIEW',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'SUPERSEDED'
);

-- `LAUNCH_MARKET_INDIA.md` §6, the ten-document India checklist, plus `OTHER` for a second market
CREATE TYPE kyc_document_type_enum AS ENUM (
  'PAN',
  'GSTIN',
  'BUSINESS_REGISTRATION',
  'SHOP_ESTABLISHMENT',
  'BANK_PROOF',
  'OWNER_IDENTITY',
  'PREMISES_ADDRESS_PROOF',
  'TRADE_LICENCE',
  'FIRE_SAFETY_NOC',
  'MUSIC_LICENCE',
  'OTHER'
);

-- `SCR-DASH-017`, verbatim
CREATE TYPE lead_status_enum AS ENUM (
  'NEW',
  'CONTACTED',
  'TRIAL',
  'CONVERTED',
  'LOST'
);

-- §C2.2, `BR-FIN-01`
CREATE TYPE ledger_direction_enum AS ENUM (
  'CREDIT',
  'DEBIT'
);

-- §C2.2 (twelve, verbatim); the two `COMMISSION_TAX` values are `ERD.md` §12.4 and are **PENDING CL...
CREATE TYPE ledger_entry_type_enum AS ENUM (
  'SALE',
  'COMMISSION',
  'GATEWAY_FEE',
  'TAX',
  'REFUND',
  'COMMISSION_REVERSAL',
  'CHARGEBACK',
  'CHARGEBACK_REVERSAL',
  'RESERVE_HOLD',
  'RESERVE_RELEASE',
  'PAYOUT',
  'ADJUSTMENT',
  'COMMISSION_TAX',
  'COMMISSION_TAX_REVERSAL'
);

-- `ERD.md` §5.3 — the six targets of the polymorphic reference that deliberately carries no FK
CREATE TYPE ledger_reference_type_enum AS ENUM (
  'ORDER',
  'REFUND',
  'DISPUTE',
  'PAYOUT',
  'ADJUSTMENT',
  'SUBSCRIPTION_INVOICE'
);

-- `BR-GYM-07`, `FR-ADMN-12`
CREATE TYPE media_moderation_status_enum AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'REMOVED'
);

-- `FR-GYM-02`
CREATE TYPE media_type_enum AS ENUM (
  'IMAGE',
  'VIDEO'
);

-- §C4.1's trigger column, made a typed vocabulary because `ERD.md` §10.5 makes a subsequent event t...
CREATE TYPE membership_event_reason_enum AS ENUM (
  'PAYMENT_CAPTURED',
  'OFFLINE_PAYMENT_RECORDED',
  'START_DATE_REACHED',
  'FREEZE_REQUESTED',
  'FREEZE_ENDED',
  'END_DATE_REACHED',
  'ENTITLEMENT_EXHAUSTED',
  'CANCELLED_BY_MEMBER',
  'CANCELLED_BY_GYM',
  'ORDER_CANCELLED',
  'PAYMENT_FAILED',
  'REFUND_COMPLETED',
  'SHARING_REVIEW',
  'TRANSFERRED',
  'GYM_CLOSED',
  'ADMIN_CORRECTION'
);

-- `BR-MEM-01`, §C4.1
CREATE TYPE membership_status_enum AS ENUM (
  'PENDING',
  'ACTIVE',
  'FROZEN',
  'EXPIRED',
  'CANCELLED',
  'REFUNDED'
);

-- §C4.8, all nine, verbatim
CREATE TYPE moderation_reason_enum AS ENUM (
  'ABUSIVE_LANGUAGE',
  'PERSONAL_INFORMATION',
  'SPAM',
  'IRRELEVANT',
  'CONFLICT_OF_INTEREST',
  'SUSPECTED_FAKE',
  'PROMOTIONAL',
  'THREAT',
  'OTHER'
);

-- `B5.19`; `SC-R03` retention is keyed on this value
CREATE TYPE notification_category_enum AS ENUM (
  'TRANSACTIONAL',
  'OPERATIONAL',
  'MARKETING',
  'SECURITY'
);

-- `B5.19`, `FR-NOTF-01`
CREATE TYPE notification_channel_enum AS ENUM (
  'EMAIL',
  'SMS',
  'PUSH',
  'IN_APP',
  'WHATSAPP'
);

-- `FR-NOTF-06`. `SUPPRESSED` records a send that preference or DND blocked — `AC-CRM-01.2` requires...
CREATE TYPE notification_status_enum AS ENUM (
  'QUEUED',
  'SENDING',
  'SENT',
  'DELIVERED',
  'FAILED',
  'BOUNCED',
  'SUPPRESSED'
);

-- `A6.3` `G` composition, `FR-CART-02`
CREATE TYPE order_item_type_enum AS ENUM (
  'PLAN',
  'JOINING_FEE',
  'ADD_ON'
);

-- §C2.2, §C4.2
CREATE TYPE order_status_enum AS ENUM (
  'PENDING',
  'AWAITING_PAYMENT',
  'PAID',
  'PARTIALLY_PAID',
  'FAILED',
  'EXPIRED',
  'CANCELLED',
  'REFUNDED'
);

-- ADR-0017
CREATE TYPE outbox_status_enum AS ENUM (
  'PENDING',
  'PUBLISHED',
  'FAILED',
  'DEAD'
);

-- §C2.2. `UPI` is expected to dominate in India (`LAUNCH_MARKET_INDIA.md` §7)
CREATE TYPE payment_method_enum AS ENUM (
  'CARD',
  'UPI',
  'NETBANKING',
  'WALLET',
  'CASH',
  'BANK_TRANSFER',
  'OTHER'
);

-- §C2.2, §C4.3
CREATE TYPE payment_status_enum AS ENUM (
  'CREATED',
  'PENDING',
  'AUTHORISED',
  'CAPTURED',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED'
);

-- `BR-GYM-06` — a bank-account change suspends payouts until re-verified
CREATE TYPE payout_account_status_enum AS ENUM (
  'PENDING_VERIFICATION',
  'VERIFIED',
  'FAILED_VERIFICATION',
  'SUSPENDED',
  'REPLACED'
);

-- §C2.2, `BR-PLN-04`
CREATE TYPE plan_status_enum AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED'
);

-- §C2.2, `BR-PLN-06`
CREATE TYPE plan_type_enum AS ENUM (
  'DURATION',
  'SESSION'
);

-- `BR-PLN-05`
CREATE TYPE plan_visibility_enum AS ENUM (
  'PUBLIC',
  'STAFF_ONLY'
);

-- §B3.1, verbatim. `roles.key` is constrained to this type so a role row cannot invent a scope
CREATE TYPE platform_role_enum AS ENUM (
  'VISITOR',
  'USER',
  'MEMBER',
  'GYM_OWNER',
  'GYM_MANAGER',
  'RECEPTIONIST',
  'TRAINER',
  'SUPER_ADMIN',
  'VERIFICATION_OFFICER',
  'SUPPORT_AGENT',
  'FINANCE',
  'MODERATOR'
);

-- §C2.3 — the five typed taxonomies
CREATE TYPE reason_code_type_enum AS ENUM (
  'APPLICATION_REJECTION',
  'CHECK_IN_DENIAL',
  'REFUND',
  'MODERATION',
  'CHECK_IN_OVERRIDE'
);

-- `BR-RFL-01`
CREATE TYPE referral_status_enum AS ENUM (
  'PENDING',
  'QUALIFIED',
  'REWARDED',
  'VOID'
);

-- §C4.8, all ten, verbatim
CREATE TYPE refund_reason_enum AS ENUM (
  'WITHIN_COOLING_OFF',
  'SERVICE_NOT_AS_DESCRIBED',
  'GYM_CLOSED',
  'MEDICAL',
  'RELOCATION',
  'DUPLICATE_PAYMENT',
  'PRICING_ERROR',
  'GOODWILL',
  'FRAUD',
  'OTHER'
);

-- §C4.5, verbatim
CREATE TYPE refund_status_enum AS ENUM (
  'REQUESTED',
  'PENDING_APPROVAL',
  'AUTO_APPROVED',
  'PROCESSING',
  'COMPLETED',
  'REJECTED',
  'FAILED'
);

-- `BR-REV-05`, `BR-REV-06`
CREATE TYPE reporter_type_enum AS ENUM (
  'MEMBER',
  'TENANT',
  'PLATFORM',
  'AUTOMATED'
);

-- `BR-REF-03`, `FR-RFND-02`
CREATE TYPE requester_type_enum AS ENUM (
  'MEMBER',
  'GYM_STAFF',
  'PLATFORM_ADMIN',
  'SYSTEM'
);

-- `A6.4` rolling reserve
CREATE TYPE reserve_status_enum AS ENUM (
  'HELD',
  'RELEASED',
  'CONSUMED'
);

-- `BR-REV-06`
CREATE TYPE review_report_status_enum AS ENUM (
  'OPEN',
  'UNDER_REVIEW',
  'UPHELD',
  'DISMISSED'
);

-- `BR-REV-05`
CREATE TYPE review_response_status_enum AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'REMOVED'
);

-- §C2.2, §C4.6
CREATE TYPE review_status_enum AS ENUM (
  'PENDING',
  'PUBLISHED',
  'HELD',
  'UNPUBLISHED',
  'REMOVED'
);

-- `ERD.md` §12.5 — a property of the **template**, distinct from `notification_log.category` which ...
CREATE TYPE routing_class_enum AS ENUM (
  'TRANSACTIONAL',
  'PROMOTIONAL'
);

-- §C2.2
CREATE TYPE sale_channel_enum AS ENUM (
  'WEB',
  'DASHBOARD'
);

-- `A6.3`. **One type, used by `orders.origin` and `memberships.origin`** — the values must not be a...
CREATE TYPE sale_origin_enum AS ENUM (
  'MARKETPLACE',
  'DIRECT'
);

-- §C4.7, all eight, verbatim. See **Deviation D-02**, §16.1
CREATE TYPE settlement_batch_status_enum AS ENUM (
  'OPEN',
  'CLOSED',
  'PENDING_APPROVAL',
  'APPROVED',
  'PROCESSING',
  'PAID',
  'ON_HOLD',
  'FAILED'
);

-- `FR-STAF-04`, `AC-STAF-01.4`
CREATE TYPE staff_status_enum AS ENUM (
  'INVITED',
  'ACTIVE',
  'SUSPENDED',
  'REMOVED'
);

-- §C2.2, `BR-TEN-06`
CREATE TYPE subscription_status_enum AS ENUM (
  'TRIAL',
  'ACTIVE',
  'PAST_DUE',
  'CANCELLED'
);

-- `ERD.md` §12.3. India uses `CGST`+`SGST` intra-state, `IGST` inter-state; the remainder exist so ...
CREATE TYPE tax_component_enum AS ENUM (
  'CGST',
  'SGST',
  'IGST',
  'UTGST',
  'CESS',
  'VAT',
  'GST',
  'SALES_TAX'
);

-- `ERD.md` §12.3
CREATE TYPE tax_registration_status_enum AS ENUM (
  'NOT_REGISTERED',
  'REGISTERED',
  'COMPOSITION',
  'PENDING'
);

-- §C2.2, §C4.4
CREATE TYPE tenant_status_enum AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'INFO_REQUESTED',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'CLOSED'
);

-- `B5.23`
CREATE TYPE ticket_category_enum AS ENUM (
  'ACCOUNT',
  'PAYMENT',
  'MEMBERSHIP',
  'CHECK_IN',
  'REFUND',
  'LISTING',
  'TECHNICAL',
  'OTHER'
);

-- `FR-SUP-04`, `KPI-25`
CREATE TYPE ticket_priority_enum AS ENUM (
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
);

-- `FR-SUP-04`
CREATE TYPE ticket_status_enum AS ENUM (
  'OPEN',
  'PENDING_CUSTOMER',
  'PENDING_INTERNAL',
  'RESOLVED',
  'CLOSED'
);

-- `FR-AUTH`, `BR-DAT-04`. `ERASED` is the terminal pseudonymised state
CREATE TYPE user_status_enum AS ENUM (
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'DEACTIVATED',
  'ERASED'
);
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 4 · THE FOUR APPLICATION ROLES
--
-- NOT ONE OF THEM HAS BYPASSRLS. That is the single most important line in this file.
--
-- BR-TEN-01 is enforced in the DATABASE, not in application code. A role with BYPASSRLS makes
-- every policy in the system advisory: the query still runs, still returns rows, and returns
-- the WRONG tenant's rows with nothing thrown and nothing logged. It is also invisible in
-- review — the offending grant is one word in a migration nobody re-reads.
--
-- CI-03 asserts `rolbypassrls = false` for all four, in local, in CI, and in development.
--
-- NOLOGIN on every role: these are privilege sets, not accounts. The application connects as a
-- login role that has been GRANTed one of these. Separating the two means rotating a password
-- never touches the privilege model, and a leaked application credential cannot be used to
-- change what that credential is allowed to do.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- Runs migrations. Owns nothing at runtime.
CREATE ROLE app_migrator NOLOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

-- The ordinary request path. SELECT/INSERT/UPDATE, and DELETE only where a table is in G-CRUD-D.
CREATE ROLE app_rw NOLOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

-- Append-only writer for the five evidence tables (audit_log, ledger_entries, …).
-- Holds INSERT and NOT SELECT. P9: history is evidence and evidence is immutable — a role that
-- can write an audit row must not be able to read the log and learn what to overwrite.
CREATE ROLE app_append NOLOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

-- Platform-wide reads for runElevated() (M-014). SELECT ONLY, across tenants, always audited.
-- This is the role that makes the approval queue possible without giving anything BYPASSRLS.
CREATE ROLE app_platform_ro NOLOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

COMMENT ON ROLE app_migrator IS 'Runs migrations. No BYPASSRLS (CI-03).';
COMMENT ON ROLE app_rw IS 'Request path. No BYPASSRLS; every read is RLS-scoped (BR-TEN-01).';
COMMENT ON ROLE app_append IS 'Append-only evidence writer. INSERT without SELECT (P9).';
COMMENT ON ROLE app_platform_ro IS 'runElevated() platform reads. SELECT only, audited (M-014).';

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 5 · THE BLANKET REVOKE, AND DEFAULT PRIVILEGES
--
-- This is the part that has to happen NOW rather than later, and the reason is §2.2.
--
-- PostgreSQL grants every new table's owner full rights and, historically, grants PUBLIC rights
-- on the schema. If the default is permissive, then a table added in month twenty inherits
-- access nobody granted it and nobody reviewed. Making the ABSENCE of privilege the default
-- means every future grant is a deliberate, visible line in the migration that adds the table.
--
-- Concretely: this is what makes AC-3 hold — `app_append` holds no SELECT and `app_rw` holds no
-- INSERT on an audit table that does not exist yet.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE gymmap FROM PUBLIC;

-- The four roles may resolve names in `public`; they hold no object rights by virtue of that.
GRANT USAGE ON SCHEMA public TO app_migrator, app_rw, app_append, app_platform_ro;
GRANT CREATE ON SCHEMA public TO app_migrator;

-- Nothing created from here on grants anything to PUBLIC, ever.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE ON TYPES FROM PUBLIC;

-- ───────────────────────────────────────────────────────────────────────────────────────────
-- Types are the exception PostgreSQL makes to "no default access", and it caught this file out.
--
-- `REVOKE ALL ON SCHEMA public FROM PUBLIC` does NOT touch type privileges: every CREATE TYPE
-- and CREATE DOMAIN grants USAGE to PUBLIC implicitly. So after the first real run of this
-- migration, PUBLIC held USAGE on all 93 types while the comment above claimed otherwise.
--
-- To be clear about the stakes: type USAGE grants no access to any DATA. It permits referencing
-- the type in a definition and calling its I/O functions, nothing more. This is not a
-- vulnerability, and it is corrected anyway — because §2.2's whole design is that ABSENCE is the
-- default and every privilege is a deliberate, visible line. An exception that only holds for
-- types is an exception someone has to remember, and the next person reading the comment above
-- would have believed it.
--
-- A loop rather than 93 statements: a hand-written list would be missing an entry within a month.
-- ───────────────────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN
        SELECT format('%I.%I', n.nspname, ty.typname) AS qualified
        FROM pg_type ty
        JOIN pg_namespace n ON n.oid = ty.typnamespace
        WHERE n.nspname = 'public'
          AND ty.typtype IN ('e', 'd')          -- enums and domains
    LOOP
        EXECUTE format('REVOKE ALL ON TYPE %s FROM PUBLIC', t.qualified);
        EXECUTE format(
            'GRANT USAGE ON TYPE %s TO app_rw, app_append, app_platform_ro, app_migrator',
            t.qualified
        );
    END LOOP;
END
$$;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 6 · DEFERRED, AND WHY — nothing here is silently dropped (CLAUDE.md §9.6)
--
-- `outbox_aggregate_type_enum` is NOT created by this migration.
--
-- Schema.md §2.5 defines its values as "one value per aggregate root of ERD.md §6 — 26 at
-- Phase 1", and Relationships.md line 714 repeats "the 26 aggregate roots of ERD.md §6.1".
-- BOTH citations are wrong: ERD.md §6 and §6.1 are the foreign-key register and the four FK
-- conventions. Neither contains a list of aggregate roots.
--
-- Deriving the set from the entity register (Root = *self*) yields 36 candidates, not 26, and
-- includes rows that are plainly not event-emitting aggregates — `outbox` itself, `audit_log`,
-- `idempotency_keys`. There is no defensible way to pick 26 of 36.
--
-- Creating the enum with a guessed set would be worse than omitting it. MG9 makes an enum value
-- permanent: it can be added but never removed while a row holds it, and never renamed. A
-- wrong value guessed today is a wrong value in the catalogue for eight financial years.
--
-- Nothing needs it until M-018 (the transactional outbox), so the cost of deferring is zero and
-- the question gets answered by whoever owns it. Tracked in docs/PHASES.md.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
