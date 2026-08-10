-- migration: 20260810150000_expand_alter_state_code_to_gst_numeric
-- phase:            expand                     -- MG3
-- requirement:      BLK-20 RESOLVED, BR-PAY-01, LAUNCH_MARKET_INDIA.md §4, Constraints.md §13.4,
--                   NamingConvention.md §9, Schema.md §5.2, ADR-0038
-- tables:           branches (CHECK tightened), tenants (CHECK renamed to its specified name)
-- rls:              unchanged
-- grants:           unchanged
-- append_only:      no
-- partitioned:      no
-- max_lock:         ACCESS EXCLUSIVE on branches while the CHECK is revalidated; the table holds
--                   zero rows, so the scan is instant. RENAME CONSTRAINT is catalogue-only
-- rewrite:          none. A CHECK change revalidates, it does not rewrite
-- est_duration:     < 30 ms                                               -- MG11
-- backfill_job:     none. branches holds zero rows; tenants' existing rows already satisfy the
--                   constraint being renamed, because it is the same constraint
-- rollback:         widen the CHECK back to ^[A-Z0-9]{2}$ and rename the tenants constraint back
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             docs/DECISION_LOG.md ADR-0038 · Constraints.md §13.4 · NamingConvention.md §9
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- BLK-20 RESOLVED · `state_code` is the GST 2-digit NUMERIC code, and always was.
--
-- ┌─ THE BLOCKER I RAISED WAS MIS-FRAMED, AND SO WAS ONE OF ITS FACTS ───────────────────────────┐
-- │ I recorded `BLK-20` as *"two rank-3 documents give two alphabets"*. On re-reading, it is not  │
-- │ a rule-versus-rule conflict at all. Every ALPHA occurrence — `Marketplace.md` lines 662,      │
-- │ 1694, 1699, 1704, 1709, 1731 and `MigrationStrategy.md` line 604 — sits inside a ```json      │
-- │ fence whose banner reads `// illustrative — not committed code`. Verified line by line.       │
-- │                                                                                              │
-- │ Every NUMERIC occurrence is a RULE: `SeedStrategy.md` §3.6's 38-row table (which has no alpha │
-- │ column at all), `Constraints.md` line 638, `NamingConvention.md` line 340, `Schema.md` line   │
-- │ 795, and `Gym.md` line 1387's Zod — `z.string().regex(/^\d{2}$/)  // GST state code`.          │
-- │                                                                                              │
-- │ Rule beats example. The precedence question never arose.                                      │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ AND THE SECOND CORRECTION IS WORSE, BECAUSE IT WAS AN ABSENCE CLAIM ────────────────────────┐
-- │ `BLK-20` also asserted that `ck_tenants__state_code_matches_gstin` *"was never created, so    │
-- │ tenants.state_code is unvalidated too"*. That is false. The constraint EXISTS and has since   │
-- │ `20260807000000_expand_create_tenants` — under a REVERSED name:                                │
-- │                                                                                              │
-- │     ck_tenants__gstin_state_matches                                                            │
-- │       CHECK (gstin IS NULL OR state_code IS NULL OR state_code = substring(gstin FROM 1 FOR 2))│
-- │                                                                                              │
-- │ I searched `pg_constraint` for the specified name, found nothing, and concluded absence. An   │
-- │ absence claim needs more than one spelling — the exact trap this repository has hit before.    │
-- │                                                                                              │
-- │ It also settles the alphabet on its own: a GSTIN's first two characters are digits, so under  │
-- │ the ISO reading `'MH' = '27'` and every GST-registered tenant becomes unsavable. Option B was │
-- │ never merely expensive; it was already physically refused by a shipped constraint.             │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ WHAT THIS MIGRATION FIXES ──────────────────────────────────────────────────────────────────┐
-- │ 1. `ck_branches__state_code_shape` was `^[A-Z0-9]{2}$` — MY defect, shipped in                │
-- │    `20260810120000`. It accepted `27` and `MH` alike, which is the conflict procedure's        │
-- │    step 1 violated (*"do not implement both"*) dressed as a permissive constraint. Now         │
-- │    `^[0-9]{2}$`, matching `Gym.md`'s Zod exactly.                                              │
-- │ 2. The `tenants` constraint is renamed to the name `Constraints.md` line 638 and               │
-- │    `NamingConvention.md` line 340 both specify. Catalogue-only, and it stops the next person   │
-- │    grepping for the specified name from concluding what I concluded.                            │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

-- 1 · branches: the shape check narrows to GST numeric.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_branches__state_code_shape') THEN
    ALTER TABLE branches DROP CONSTRAINT ck_branches__state_code_shape;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_branches__state_code_shape') THEN
    ALTER TABLE branches
      ADD CONSTRAINT ck_branches__state_code_shape CHECK (state_code ~ '^[0-9]{2}$');
  END IF;
END $$;

/*
 * 2 · tenants: the constraint keeps its definition and takes the name both documents specify.
 *
 * A rename rather than a drop-and-recreate: the definition is already correct and revalidating it
 * would scan a table that has rows, for no gain. `IF EXISTS` on the old name so the migration is a
 * no-op on a database where it has already run (PM-9's reasoning, applied to a rename).
 */
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tenants__gstin_state_matches') THEN
    ALTER TABLE tenants RENAME CONSTRAINT ck_tenants__gstin_state_matches
                                       TO ck_tenants__state_code_matches_gstin;
  END IF;
END $$;
END $;

/*
 * 2 · tenants: the constraint keeps its definition and takes the name both documents specify.
 *
 * A rename rather than a drop-and-recreate: the definition is already correct and revalidating it
 * would scan a table that has rows, for no gain. `IF EXISTS` on the old name so the migration is a
 * no-op on a database where it has already run (PM-9's reasoning, applied to a rename).
 */
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tenants__gstin_state_matches') THEN
    ALTER TABLE tenants RENAME CONSTRAINT ck_tenants__gstin_state_matches
                                       TO ck_tenants__state_code_matches_gstin;
  END IF;
END $$;
