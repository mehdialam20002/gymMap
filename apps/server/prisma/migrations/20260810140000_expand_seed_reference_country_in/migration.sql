-- migration: 20260810140000_expand_seed_reference_country_in
-- phase:            expand                     -- MG3
-- requirement:      M-031, SeedStrategy.md SEP1, RD2, RD3, RD5, §3.1, LAUNCH_MARKET_INDIA.md §2,
--                   §3, §5, Schema.md §12.1, ADR-0028, BLK-21
-- tables:           countries (one row, INSERT only)
-- rls:              NONE — GLOBAL reference on the closed §1.3 exemption list
-- grants:           unchanged. G-REF minus the write half; the row is written by the migration
--                   role, which is SEP4's whole point
-- append_only:      no UPDATE and no DELETE are granted to any application role
-- partitioned:      no
-- max_lock:         ROW EXCLUSIVE on a table holding zero rows
-- rewrite:          none
-- est_duration:     < 10 ms                                               -- MG11
-- backfill_job:     none. This IS the data.
-- rollback:         DELETE the row by its derived id. It is referenced by nothing yet
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             SeedStrategy.md §2.1 (the sixteen tables), §3.1, RD2, RD3, RD5
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- M-031 · The first reference DML in this repository, and the ONLY row that is fully specified.
--
-- ┌─ WHY A MIGRATION AND NOT A SEED SCRIPT — `SEP1` ─────────────────────────────────────────────┐
-- │ *"Reference data (`K1`) is only ever created by a versioned migration. There is no            │
-- │ reference-data seed script."* `SeedStrategy.md` §2.3 gives the reasons rather than asserting  │
-- │ the rule: a `NOT NULL` FK and the row it points at land in the SAME deploy in a known order,  │
-- │ and `_prisma_migrations` records exactly when the India row entered each environment, with a  │
-- │ checksum. An idempotent upsert script records only what the row is now.                        │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ THE ID IS DERIVED, NOT GENERATED — `RD2` ───────────────────────────────────────────────────┐
-- │ `uuid_v5(NS_REFERENCE, 'countries:IN')` where `NS_REFERENCE` is                                │
-- │ `3f8a2d10-0000-5000-b000-000000000000`, which is why India has the SAME id in every           │
-- │ environment and in every clone — and why `SEP9`'s drift check can be a set comparison rather  │
-- │ than a semantic diff. Computed with the committed `referenceUuid()` helper, not by hand.      │
-- │                                                                                              │
-- │ `DT2a` keeps that namespace distinct from the `§C8.2` seed namespace, so a reference id and   │
-- │ a fixture id can never collide.                                                                │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ NO `ON CONFLICT DO NOTHING` — `RD5`, AND IT IS DELIBERATE ──────────────────────────────────┐
-- │ *"Silent no-op is how two environments diverge without anyone noticing. A reference migration │
-- │ is written as a plain `INSERT` and is allowed to fail loudly if the row already exists,       │
-- │ because under forward-only migrations (`MG1`) it can only already exist if the migration ran  │
-- │ twice — which is itself the defect."*                                                          │
-- │                                                                                              │
-- │ Note this is the one place `PM-9`'s `IF NOT EXISTS` reasoning does NOT apply: `PM-9` is about │
-- │ DDL being re-appliable after a partial failure. `RD5` is about DML being LOUD. The two rules  │
-- │ point opposite ways on purpose, and `migration-lint` checks `CREATE`, not `INSERT`.            │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ ONE ROW, AND THE OTHER NINETEEN COUNTRIES ARE NOT HERE ─────────────────────────────────────┐
-- │ `SeedStrategy.md` §3.1 seeds "19 further countries" as inactive rows so a second market is a  │
-- │ one-column `UPDATE`. It names values for only five of them (AU 7, GB 4, US 1, SG 1, AE 1) and │
-- │ leaves the other fourteen unnamed — no code, no name, no calling code. `RD4` makes the data   │
-- │ file the source of truth precisely so those values are EDITED rather than guessed, and        │
-- │ guessing fourteen countries into a versioned migration is the opposite of that.                │
-- │                                                                                                │
-- │ `AU` and `US` are needed by the `§C8.2` K3 seed (tenants T2 and T3) and will arrive with it.   │
-- │ Everything else that this table's siblings need is `BLK-21`.                                   │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

INSERT INTO countries (
  id,
  code,
  name,
  default_currency,
  calling_code,
  fy_start_month,
  is_active,
  -- Both NULL, and both by ADR-0028 rather than by omission: `tax_profiles` does not exist, and
  -- pointing `default_kyc_checklist_id` at the seeded IN checklist would invert the direction
  -- `KL-103` already describes. They land together when `tax_profiles` does.
  default_tax_profile_id,
  default_kyc_checklist_id
) VALUES (
  -- uuid_v5(NS_REFERENCE, 'countries:IN') — RD2. Regenerate with referenceUuid('countries','IN').
  'bd8d48e0-6a13-562d-bd70-9b48a165a05f',
  'IN',
  'India',
  -- Minor unit is PAISE, 100 to the rupee — LAUNCH_MARKET_INDIA.md §2, BR-PAY-01.
  'INR',
  -- With the `phone_e164` domain this fixes the normalised form +91XXXXXXXXXX.
  '+91',
  -- 4. The Indian financial year starts 1 April (LAUNCH_MARKET_INDIA.md §5, TM10). Denormalised
  -- here rather than read through the tax profile, which does not exist — reading it through a
  -- NULL FK would give January and put every financial report a quarter out.
  4,
  -- The launch market, and the only active country.
  true,
  NULL,
  NULL
);
