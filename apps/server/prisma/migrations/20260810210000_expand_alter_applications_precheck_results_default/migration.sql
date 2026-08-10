-- migration: 20260810210000_expand_alter_applications_precheck_results_default
-- phase:            expand                     -- MG3
-- requirement:      Schema.md §4.2 line 885, BLK-22 (the uncontested part), BR-GYM-08, BR-GYM-09
-- tables:           applications (one column DEFAULT; no data change)
-- rls:              unchanged
-- grants:           unchanged — and deliberately so. See the warning below
-- append_only:      no
-- partitioned:      no
-- max_lock:         ACCESS EXCLUSIVE, catalogue-only. A DEFAULT change rewrites nothing
-- rewrite:          none
-- est_duration:     < 10 ms                                              -- MG11
-- backfill_job:     none needed — `applications` holds ZERO rows, verified before writing
-- rollback:         SET DEFAULT '{}'::jsonb, restoring the drift
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             docs/PHASES.md BLK-22 · docs/database/Schema.md §4.2
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- ONE OF THE THREE UNCONTESTED CORRECTIONS FROM `BLK-22`. THE OTHER TWO ARE NOT SQL.
--
-- ┌─ WHAT DRIFTED ───────────────────────────────────────────────────────────────────────────────┐
-- │ `Schema.md` §4.2 line 885 gives the column's default as `'{"schema_version":1}'`.             │
-- │ `20260809100000_expand_create_applications` line 85 shipped `DEFAULT '{}'::jsonb`, and        │
-- │ `schema.prisma` carries the same `@default("{}")`. Three places, two of them wrong.            │
-- │                                                                                              │
-- │ Not cosmetic. Every reader of `precheck_results` has to answer "which shape is this?" and     │
-- │ `{}` answers nothing — a row that has never been checked and a row written by a future        │
-- │ schema version are indistinguishable. `schema_version` is the discriminator, and a default    │
-- │ that omits it means the discriminator is absent exactly when it is most needed: on a row      │
-- │ nobody has touched.                                                                            │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ DO NOT "FIX" `BLK-22` BY GRANTING UPDATE ON THIS COLUMN ────────────────────────────────────┐
-- │ `PrecheckResultPrismaStore.replaceFor` UPDATEs `applications.precheck_results` and is refused │
-- │ under `app_rw`, because `D-03`'s column-scoped UPDATE list deliberately excludes it. The      │
-- │ one-line fix — `GRANT UPDATE (precheck_results) ON applications TO app_rw` — makes the code   │
-- │ work and is a **rank-5 override of `Schema.md` §4.2**, whose list is exhaustive and           │
-- │ registered in §16.1.                                                                           │
-- │                                                                                              │
-- │ It would also open a post-decision mutation path on the artefact a reviewer's approval rests  │
-- │ on. A `FLAG` could be rewritten to `PASS` after the fact, and `BR-GYM-01`'s *"a human          │
-- │ approved this, on this evidence"* becomes unfalsifiable — which is precisely what the         │
-- │ snapshot grant exists to prevent, and `Security.md` names `precheck_results` as part of the   │
-- │ answer to *"who approved this gym, on what evidence"*.                                         │
-- │                                                                                              │
-- │ `onboarding-tables.int-spec.ts` now pins the refusal so this cannot be done quietly.          │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

-- Idempotent by inspection rather than by `IF NOT EXISTS`, which `ALTER COLUMN … SET DEFAULT` has
-- no form of. Re-applying is harmless anyway; the guard keeps the migration honest under `PM-9`.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications'
      AND column_name = 'precheck_results'
      AND column_default IS DISTINCT FROM '''{"schema_version": 1}''::jsonb'
  ) THEN
    ALTER TABLE applications
      ALTER COLUMN precheck_results SET DEFAULT '{"schema_version": 1}'::jsonb;
  END IF;
END $$;

-- No backfill. `SELECT count(*) FROM applications` returned 0 before this was written, so there is
-- no row carrying the old `{}`. Had there been one, a backfill would be impossible under `D-03`
-- without the grant the banner above refuses — which is itself worth knowing, and is recorded in
-- `BLK-22` as the reason the ports should land before persistence is wired.
