-- migration: 20260807010000_expand_create_application_login_role
-- phase:            expand                     -- MG3
-- requirement:      BR-TEN-01, NFR-SEC-09, ADR-0005, §2.2, AC-FND-02.1
-- tables:           none                       -- roles only
-- rls:              unchanged                  -- P9. No policy changes; this is who they apply TO
-- grants:           granted                    -- P10. app_rw granted to the login role
-- append_only:      no
-- partitioned:      no
-- max_lock:         none (catalogue only)
-- rewrite:          none
-- est_duration:     < 50 ms
-- backfill_job:     none
-- rollback:         FREE                       -- P4. DROP ROLE; nothing owns objects
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             Schema.md §2.2, prisma/migrations/0_init, docs/runbooks/tenancy.md
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- WHY THIS EXISTS — a gap that only running the code found
--
-- `0_init` creates four app_* roles, all NOLOGIN, and describes them correctly as "privilege
-- sets, not accounts". What it did not create is the ACCOUNT that assumes one. So after M-009
-- the only login role in the cluster was `postgres` — a SUPERUSER.
--
-- A superuser bypasses row-level security entirely. Not "is exempt unless FORCE": FORCE lifts
-- the exemption for the table OWNER, and does nothing about superusers. So the application,
-- connecting as `postgres`, read all three tenants through a policy that was correct, forced,
-- and completely inert.
--
-- Every isolation assertion still passed, because they use SET ROLE to reach app_rw explicitly.
-- The extension's own end-to-end test is what caught it: `client.tenant.findMany()` returned 3
-- rows where P-SELF guarantees 1. Worth stating plainly — the schema was right, the policy was
-- right, the tests of the policy were right, and the application was still unprotected.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- WHY app_platform_ro IS **NOT** GRANTED HERE
--
-- The obvious shortcut is one login role holding both app_rw and app_platform_ro, switching
-- with SET ROLE. It is wrong, and quietly so.
--
-- RLS policies are PERMISSIVE and OR'd together. A role that is a member of both app_rw and
-- app_platform_ro matches `rls_<t>__tenant_isolation` (TO app_rw) AND `rls_<t>__platform_read`
-- (TO app_platform_ro, USING (true)) on every query — so `true` wins and the session reads
-- every tenant, all the time, without anyone calling runElevated().
--
-- The elevation path therefore gets its OWN login role and its own pool, added by M-014. Two
-- physically separate connections is a much stronger boundary than a SET ROLE somebody can
-- forget to reset, and it makes "which connection read this row" answerable from pg_stat_activity.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- THE PASSWORD IS NOT HERE
--
-- A migration is committed to git. A password in a migration is a credential in git, in every
-- clone, and in the CI cache — and rotating it would mean editing an applied migration, which
-- PM-4 forbids.
--
-- The role is created able to log in but with NO password, which cannot authenticate over TCP
-- under scram-sha-256. The password is set out of band:
--   local       infra/compose/set-local-role-password.sql, applied by `pnpm db:setup`
--   deployed    Terraform, from the secret store, never passing through a developer's shell
-- ═══════════════════════════════════════════════════════════════════════════════════════════

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gymmap_app') THEN
        -- LOGIN, and nothing else. No SUPERUSER (which would bypass RLS), no BYPASSRLS,
        -- no CREATEDB, no CREATEROLE. It is an account, and its only power is the membership
        -- granted below.
        --
        -- INHERIT so that membership of app_rw takes effect without an explicit SET ROLE on
        -- every connection — Prisma has no per-connection init hook, and a SET ROLE that has
        -- to be remembered is a SET ROLE that gets missed on the pool's second connection.
        CREATE ROLE gymmap_app LOGIN INHERIT
            NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
    END IF;
END
$$;

-- Exactly one membership. See the note above on why app_platform_ro is excluded.
GRANT app_rw TO gymmap_app;

-- Needed to resolve names in `public`; grants no access to any object by itself.
GRANT USAGE ON SCHEMA public TO gymmap_app;

COMMENT ON ROLE gymmap_app IS
  'The application''s login account. Member of app_rw ONLY — never app_platform_ro, because RLS policies are OR''d and dual membership would make platform_read''s USING(true) apply to every query. Password set out of band (Terraform / pnpm db:setup).';
