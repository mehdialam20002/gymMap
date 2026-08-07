-- migration: 20260807020000_expand_grant_connect_to_application_role
-- phase:            expand                     -- MG3
-- requirement:      BR-TEN-01, NFR-SEC-09, §2.2, ADR-0005
-- tables:           none                       -- database-level privilege only
-- rls:              unchanged                  -- P9
-- grants:           granted                    -- P10. CONNECT on the database
-- append_only:      no
-- partitioned:      no
-- max_lock:         none
-- rewrite:          none
-- est_duration:     < 20 ms
-- backfill_job:     none
-- rollback:         FREE                       -- P4. REVOKE CONNECT
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             prisma/migrations/0_init, 20260807010000_expand_create_application_login_role
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- A CORRECTION, AS A NEW MIGRATION — PM-4
--
-- The previous migration created `gymmap_app` with LOGIN and membership of app_rw. It still
-- could not connect: `0_init` runs `REVOKE ALL ON DATABASE gymmap FROM PUBLIC`, and nothing
-- ever granted CONNECT back. Postgres answered `FATAL: permission denied for database "gymmap"`.
--
-- That is the blanket revoke working exactly as designed — §2.2's whole premise is that ABSENCE
-- is the default and every privilege is a deliberate, visible line. The omission was mine, and
-- it failed loudly at the first connection attempt rather than quietly at the first query.
--
-- Fixed as a NEW migration rather than by editing the previous one, because PM-4 says so and
-- because the previous one has already been applied — editing it would break its checksum and
-- require a database reset. Editing applied migrations is the specific habit that causes
-- production incidents, and the cost of following the rule here is twenty lines.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

-- CONNECT only. Not CREATE, not TEMP.
--
-- TEMP is worth refusing explicitly: a temporary table is not covered by RLS, so a role that
-- can create one can `CREATE TEMP TABLE leak AS SELECT * FROM …` — except that the SELECT is
-- itself policy-filtered, so it buys nothing and costs a shared-buffer footprint per session.
-- No path in this application needs it.
GRANT CONNECT ON DATABASE gymmap TO gymmap_app;
