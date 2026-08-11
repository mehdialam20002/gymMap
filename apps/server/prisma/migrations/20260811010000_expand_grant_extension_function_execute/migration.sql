-- migration: 20260811010000_expand_grant_extension_function_execute
-- phase:            expand                     -- MG3
-- requirement:      Schema.md §2.2, §5.2, ADR-0007, FR-GYM-07, FR-SRCH-01, NFR-DQ-06,
--                   Scalability.md §6.2, M-031 AC-2, M-042
-- tables:           none. GRANT EXECUTE on extension-owned functions; SELECT on spatial_ref_sys
-- rls:              unchanged
-- grants:           +EXECUTE on every function owned by the eight installed extensions, to
--                   app_rw, app_append and app_platform_ro. +SELECT on spatial_ref_sys
-- append_only:      no
-- partitioned:      no
-- max_lock:         none. Catalogue-only, no table is touched
-- rewrite:          none
-- est_duration:     < 400 ms — roughly 800 GRANT statements through a DO loop  -- MG11
-- backfill_job:     none
-- rollback:         REVOKE EXECUTE, restoring the state in which the application cannot read a
--                   branch's location at all. Free, and it un-ships M-031's read path
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             docs/database/Schema.md §2.2 · 0_init §5 · docs/database/catalog.md §2
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- THE APPLICATION ROLE COULD NOT CALL A SINGLE POSTGIS FUNCTION.
--
-- ┌─ `0_init` IS RIGHT, AND IT IS INCOMPLETE ────────────────────────────────────────────────────┐
-- │ §5 of `0_init` revokes the world, deliberately, and says why:                                 │
-- │                                                                                              │
-- │     REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;                                  │
-- │     ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC;             │
-- │                                                                                              │
-- │ *"If the default is permissive, then a table added in month twenty inherits access nobody     │
-- │ granted it and nobody reviewed. Making the ABSENCE of privilege the default is the only way    │
-- │ that stays true."* That reasoning is correct and this migration does not weaken it.            │
-- │                                                                                              │
-- │ What `0_init` then grants back is USAGE on the schema, table privileges per class, and USAGE   │
-- │ on all 93 enums and domains — through a `DO` loop, with a comment explaining that a            │
-- │ hand-written list *"would be missing an entry within a month"*. **Functions are the one class  │
-- │ it revoked and never granted back.** `CREATE EXTENSION postgis` installs **777 functions**     │
-- │ into `public`, and `app_rw` holds EXECUTE on none of them.                                     │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ WHY NOTHING CAUGHT IT FOR A DAY, WHICH IS THE PART TO REMEMBER ─────────────────────────────┐
-- │ `branch-write.int-spec.ts` and `catalog-tables.int-spec.ts` shell out to `psql -U postgres`.  │
-- │ The superuser bypasses privilege checks entirely, so twelve integration assertions proved the │
-- │ SQL was correct and could not observe that the application may not run it. `EXPLAIN` output   │
-- │ in `docs/database/catalog.md` was measured the same way.                                       │
-- │                                                                                              │
-- │ It surfaced when an isolation `A4` — the POSITIVE control, *"tenant A can read its OWN         │
-- │ data"* — returned 500 with                                                                     │
-- │                                                                                              │
-- │     ERROR: permission denied for function st_y   (SQLSTATE 42501)                              │
-- │                                                                                              │
-- │ A4 exists for exactly this: a suite that only asserts refusals passes perfectly when           │
-- │ everything is refused.                                                                         │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ SCOPED TO EXTENSION-OWNED FUNCTIONS, NOT `ALL FUNCTIONS IN SCHEMA public` ───────────────────┐
-- │ `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public` would be one line and would also grant every │
-- │ function this repository writes later — triggers, helpers, anything. It would re-create the    │
-- │ permissive default §2.2 exists to refuse, just aimed at a different object class.               │
-- │                                                                                              │
-- │ `pg_depend`'s `deptype = 'e'` names exactly the functions an EXTENSION owns, so the grant       │
-- │ follows the extension rather than the schema. A ninth extension installed tomorrow is NOT      │
-- │ covered by this migration, which is the correct default: it needs its own reviewed line.       │
-- │                                                                                              │
-- │ The `DO` loop is `0_init`'s own idiom for the same reason it gives there — a hand-written list │
-- │ of 777 signatures would be wrong within a week, and overload resolution makes it easy to grant │
-- │ `st_dwithin(geometry,geometry,float8)` while missing the `geography` overload the code calls.   │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ `app_append` IS INCLUDED, AND THAT NEEDS A REASON ──────────────────────────────────────────┐
-- │ `app_append` holds INSERT and not SELECT — it writes audit rows and cannot read them (`P9`).   │
-- │ It gets EXECUTE because an INSERT can legitimately call a function: `gen_random_uuid()` from   │
-- │ `pgcrypto` is in this set, and a column DEFAULT that calls it is evaluated as the INSERTING    │
-- │ role. EXECUTE on a pure function grants no data access, so this widens nothing that `P9`       │
-- │ narrows.                                                                                       │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

DO $$
DECLARE
    fn record;
    granted integer := 0;
BEGIN
    FOR fn IN
        SELECT p.oid::regprocedure::text AS signature
        FROM pg_proc p
        JOIN pg_depend d   ON d.objid = p.oid AND d.deptype = 'e'
        JOIN pg_extension e ON e.oid = d.refobjid
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
    LOOP
        EXECUTE format(
            'GRANT EXECUTE ON FUNCTION %s TO app_rw, app_append, app_platform_ro',
            fn.signature
        );
        granted := granted + 1;
    END LOOP;

    -- A count of zero would mean the join found nothing — a renamed catalogue column, a different
    -- `deptype`, or PostGIS installed into another schema. Silently granting nothing is how this
    -- migration would appear to have run while leaving the application exactly as broken.
    IF granted = 0 THEN
        RAISE EXCEPTION
            'Granted EXECUTE on ZERO extension functions. Expected several hundred (postgis '
            'alone installs ~777). The pg_depend/pg_extension join found nothing, so this '
            'migration has not done what its header claims.';
    END IF;

    RAISE NOTICE 'GRANT EXECUTE on % extension function(s).', granted;
END
$$;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- `spatial_ref_sys` — a TABLE, and PostGIS reads it from inside its own functions
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- `ST_Transform` and any SRID-resolving call read this table as the CALLING role, so EXECUTE alone
-- is not enough. It is reference data — 8,500 rows of coordinate-system definitions shipped by the
-- extension — with no `tenant_id` and no policy, which is why SELECT is safe and why it belongs on
-- the same closed exemption list as `cities` and `countries` (`Schema.md` §1.3).
--
-- SELECT only. Nothing in this application has any business writing an SRID definition.
GRANT SELECT ON TABLE spatial_ref_sys TO app_rw, app_platform_ro;
