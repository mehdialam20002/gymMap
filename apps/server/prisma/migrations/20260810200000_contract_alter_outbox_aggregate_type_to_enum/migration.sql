-- migration: 20260810200000_contract_alter_outbox_aggregate_type_to_enum
-- phase:            contract                   -- MG3
-- requirement:      BLK-07 RESOLVED, ADR-0045, TD-031 PAID, Schema.md §2.5,
--                   Relationships.md 714, engineering/ERD.md §6.1, MG9
-- tables:           outbox (one column type; no data change)
-- rls:              unchanged
-- grants:           unchanged
-- append_only:      no
-- partitioned:      no. `ERD.md` §9.4 specifies a partitioned outbox; the shipped table is
--                   `relkind = r`, verified. See the divergence note at the foot of this file
-- max_lock:         ACCESS EXCLUSIVE on `outbox` for the type change
-- rewrite:          none in practice — the table holds ZERO rows, verified before writing this
-- est_duration:     < 50 ms                                              -- MG11
-- backfill_job:     none
-- rollback:         ALTER COLUMN back to `text` USING aggregate_type::text, re-add the CHECK,
--                   DROP TYPE. Free while the table is empty; after that the values survive the
--                   round trip because every enum label is a legal `text` value
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             docs/DECISION_LOG.md ADR-0045 · docs/PHASES.md BLK-07 · TECH_DEBT.md TD-031
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- BLK-07 RESOLVED · the register was never missing. There are TWO files named `ERD.md`.
--
-- ┌─ WHAT THE DEFERRAL NOTE IN `0_init` SAID, AND WHY IT WAS WRONG ──────────────────────────────┐
-- │ *"Schema.md §2.5 defines its values as 'one value per aggregate root of ERD.md §6 — 26 at    │
-- │ Phase 1', and Relationships.md line 714 repeats 'the 26 aggregate roots of ERD.md §6.1'.     │
-- │ **BOTH citations are wrong:** ERD.md §6 and §6.1 are the foreign-key register and the four   │
-- │ FK conventions. Neither contains a list of aggregate roots."*                                 │
-- │                                                                                              │
-- │ That is an accurate description of `docs/database/ERD.md`. It is not the file the citations  │
-- │ mean. `docs/engineering/ERD.md` §6 is **"The aggregate map"** and §6.1 is **"Aggregate       │
-- │ composition"** — a numbered table of exactly **26** roots, which is the number both citing   │
-- │ documents give. The citations were correct all along; they resolve to a file with a twin.    │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ THE "36 CANDIDATES, NO DEFENSIBLE WAY TO PICK 26" OBJECTION IS ANSWERED IN THAT SECTION ────┐
-- │ The note objected that deriving the set yields 36 and *"includes rows that are plainly not   │
-- │ event-emitting aggregates — `outbox` itself, `audit_log`, `idempotency_keys`."*               │
-- │                                                                                              │
-- │ §6.1 excludes precisely those, by name: *"**Six entities belong to no aggregate.** They are  │
-- │ platform infrastructure with no domain invariant of their own: `audit_log`, `outbox`,        │
-- │ `idempotency_keys`, `notification_log`, `export_jobs`, `report_definitions`."* Plus sixteen  │
-- │ reference rows *"managed by `admin/` as configuration, not as aggregates"*. The derivation   │
-- │ the note performed by hand was already done, in the file the citation pointed at.            │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ `PROJECT_CONSTITUTION.md` §4.3 NAMES 18, AND THAT IS AN ELABORATION, NOT A CONFLICT ────────┐
-- │ Rank 1 lists 18 roots. Rank 3's §6.1 lists 26 and says so openly: *"This section does what   │
-- │ the constitution does not: it assigns **all 76 entities** to an aggregate."* The eight extra  │
-- │ are `User`, `CreditNote`, `CrmMember`, `Lead`, `Segment`, `Referral`, `SubscriptionInvoice`   │
-- │ and `AttributionEvent`.                                                                       │
-- │                                                                                              │
-- │ The check that settles it is inside the constitution itself. Its **"Referenced by id only"**  │
-- │ column names `User` (on `Order`) and `CreditNote` (on `Invoice`) — and rule **A2** says       │
-- │ *"aggregates reference each other by id only"*. A by-id reference IS an aggregate boundary,   │
-- │ so rank 1 already implies roots its own table does not enumerate. Rank 3 finished the job it  │
-- │ says it is finishing. Nothing is overridden.                                                  │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ WHY SHIPPING THE ENUM IS NOW SAFE UNDER `MG9`, WHICH IS THE WHOLE REASON IT WAITED ─────────┐
-- │ `MG9`: an enum value is permanent — addable, never removable while a row holds it, never     │
-- │ renamed. Shipping 36 and learning the answer was 26 would leave ten values that can never be │
-- │ withdrawn. That risk was real and the deferral was right.                                     │
-- │                                                                                              │
-- │ It is gone now for two independent reasons. The set is READ OUT of the register rather than  │
-- │ derived — `outbox-aggregate-type.spec.ts` greps `engineering/ERD.md` §6.1 and fails if the   │
-- │ enum and the document disagree in either direction. And `MG9` cuts the other way here: values│
-- │ are ADDABLE, so a 27th aggregate is one migration, while a wrong value would have been       │
-- │ forever. The asymmetry that argued for waiting now argues for shipping.                       │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

-- ─── 1 · the type ──────────────────────────────────────────────────────────────────────────────
--
-- `CREATE TYPE` has no `IF NOT EXISTS` form, so `PM-9`'s re-appliability is bought with a guard.
-- The order below is `engineering/ERD.md` §6.1's own row order, 1 … 26, NOT alphabetical — a
-- reviewer diffing this against the document reads down two columns rather than sorting one.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outbox_aggregate_type_enum') THEN
    CREATE TYPE outbox_aggregate_type_enum AS ENUM (
      'Tenant',              --  1
      'Application',         --  2
      'User',                --  3
      'Staff',               --  4
      'Gym',                 --  5
      'Branch',              --  6
      'Plan',                --  7
      'Order',               --  8
      'Payment',             --  9
      'Invoice',             -- 10
      'CreditNote',          -- 11
      'Membership',          -- 12
      'CheckIn',             -- 13
      'CrmMember',           -- 14
      'Lead',                -- 15
      'Review',              -- 16
      'LedgerEntry',         -- 17
      'SettlementBatch',     -- 18
      'Refund',              -- 19
      'Dispute',             -- 20
      'Coupon',              -- 21
      'SupportTicket',       -- 22
      'Segment',             -- 23
      'Referral',            -- 24
      'SubscriptionInvoice', -- 25
      'AttributionEvent'     -- 26
    );
  END IF;
END $$;

-- ─── 2 · the CHECK goes FIRST ──────────────────────────────────────────────────────────────────
--
-- Not tidying, and not reorderable. `ck_outbox__aggregate_type` is `aggregate_type ~ '^[A-Z]…'`,
-- a regex over `text`. Once the column is an enum there is no `enum ~ text` operator, so leaving
-- the constraint in place makes step 3 fail on revalidation. Dropping it afterwards is too late.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_outbox__aggregate_type') THEN
    ALTER TABLE outbox DROP CONSTRAINT ck_outbox__aggregate_type;
  END IF;
END $$;

-- ─── 3 · the column ────────────────────────────────────────────────────────────────────────────
--
-- `USING` is required: there is no implicit text → enum cast. Every existing value must be a
-- label or this raises `22P02` and the transaction rolls back — which is the correct behaviour,
-- because a value outside the register is precisely what the enum exists to make impossible.
-- Verified empty before writing this migration (`SELECT count(*) FROM outbox` → 0), so no row
-- can fail and no rewrite is paid.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
    WHERE c.relname = 'outbox' AND a.attname = 'aggregate_type'
      AND format_type(a.atttypid, a.atttypmod) = 'text'
  ) THEN
    ALTER TABLE outbox
      ALTER COLUMN aggregate_type TYPE outbox_aggregate_type_enum
      USING aggregate_type::outbox_aggregate_type_enum;
  END IF;
END $$;

-- ─── 4 · the comment, which currently documents a blocker that is closed ───────────────────────

COMMENT ON COLUMN outbox.aggregate_type IS
  'outbox_aggregate_type_enum — the 26 aggregate roots of engineering/ERD.md §6.1, in that section''s own order. Schema.md §2.5 and Relationships.md 714 both cite it; the citations always resolved, to docs/engineering/ERD.md rather than to docs/database/ERD.md, whose §6 is the foreign-key register. BLK-07, closed by ADR-0045. MG9: a value is addable but never removable, so the set is asserted against the document by outbox-aggregate-type.spec.ts rather than trusted to transcription.';

COMMENT ON TYPE outbox_aggregate_type_enum IS
  'One value per aggregate root of engineering/ERD.md §6.1. PROJECT_CONSTITUTION.md §4.3 names 18 of these; §6.1 completes the assignment of all 76 entities and adds User, CreditNote, CrmMember, Lead, Segment, Referral, SubscriptionInvoice and AttributionEvent. Not a conflict — the constitution''s own "Referenced by id only" column names User and CreditNote, and rule A2 makes a by-id reference an aggregate boundary.';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- DIVERGENCE, RECORDED RATHER THAN FIXED HERE (CLAUDE.md §9.6)
--
-- `ERD.md` §9.1 *"Three, not two"* lists `outbox` among the partitioned tables alongside
-- `attendance` and `audit_log`, and §9.4 specifies it. The shipped table is `relkind = r` — a
-- plain table — and no migration creates an outbox partition or a partition-maintenance function
-- for it. That is a real divergence and it is **not** this migration's to close: partitioning a
-- table is a different change with a different lock profile, and doing it inside a type change
-- would hide it. Raised separately; this header states it so the next reader is not surprised by
-- `partitioned: no` above.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
