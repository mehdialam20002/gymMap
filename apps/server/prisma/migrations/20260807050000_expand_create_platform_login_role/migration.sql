-- migration: 20260807050000_expand_create_platform_login_role
-- phase:            expand                     -- MG3
-- requirement:      EP-01 F-01.8, PE1, AC-FND-05.1, BR-TEN-01, NFR-SEC-09
-- tables:           none                       -- roles only
-- rls:              unchanged                  -- P9. The platform_read policies already exist
-- grants:           granted                    -- P10. app_platform_ro to a login role
-- append_only:      no
-- partitioned:      no
-- max_lock:         none (catalogue only)
-- rewrite:          none
-- est_duration:     < 20 ms
-- rollback:         FREE                       -- P4. DROP ROLE; it owns nothing
-- backfill_job:     none
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             docs/runbooks/tenancy.md, prisma/migrations/20260807010000
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- THE ELEVATION ROLE'S AUTHORITY IS A VISIBLE POLICY, NOT AN INVISIBLE ATTRIBUTE — PE1
--
-- The obvious way to let an admin read across tenants is `BYPASSRLS`. It is refused here and
-- everywhere, because the difference is auditability:
--
--   BYPASSRLS   an attribute in pg_roles. Nothing in pg_policies changes. A reviewer reading
--               the policies sees a correctly isolated schema and is wrong.
--   a policy    `rls_<table>__platform_read`, visible in pg_policies, bound to a named role,
--               SELECT-only. The exception is written down in the same place as the rule.
--
-- `app_platform_ro` therefore holds no BYPASSRLS and never will. Its power is that the
-- platform-read policy names it, and that policy is `FOR SELECT` — so an accidental write under
-- elevation fails in PostgreSQL rather than in a code review.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- A THIRD LOGIN ROLE, AND WHY NOT `SET ROLE`
--
--   gymmap_app        → app_rw            the request path
--   gymmap_audit      → app_append        the audit writer (M-013)
--   gymmap_platform   → app_platform_ro   elevation, SELECT only
--
-- `SET ROLE app_platform_ro` on the request connection would be one forgotten `RESET ROLE` away
-- from leaving an ordinary request able to read every tenant — and the forgetting is silent:
-- everything keeps working, and the extra reach sits there.
--
-- Separate pools also make "which connection read this row" answerable from pg_stat_activity,
-- which matters when the question is asked during an incident about a cross-tenant read.
--
-- Membership is EXCLUSIVE. gymmap_platform is NOT a member of app_rw. RLS policies are
-- permissive and OR'd: a role holding both would match the tenant-isolation policy AND
-- platform_read's `USING (true)` on every query, so it would read every tenant all the time
-- without anyone calling runElevated().
-- ═══════════════════════════════════════════════════════════════════════════════════════════

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gymmap_platform') THEN
        CREATE ROLE gymmap_platform LOGIN INHERIT
            NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
    END IF;
END
$$;

-- Exactly one membership, and app_platform_ro holds SELECT grants only.
GRANT app_platform_ro TO gymmap_platform;
GRANT CONNECT ON DATABASE gymmap TO gymmap_platform;
GRANT USAGE ON SCHEMA public TO gymmap_platform;

COMMENT ON ROLE gymmap_platform IS
  'The elevation login. Member of app_platform_ro ONLY — never app_rw, because RLS policies are OR''d and dual membership would make platform_read''s USING(true) apply to every ordinary query. Reads across tenants; holds no write grant anywhere.';
