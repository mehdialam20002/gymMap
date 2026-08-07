-- M-009 · The `tenants` RLS policy pair. Policy class P-SELF.
--
-- ┌─ HOW THIS FILE RELATES TO THE MIGRATION ────────────────────────────────────────────────────┐
-- │ The roadmap says the policy is "applied FROM the migration, never out of band", and that is │
-- │ exactly right: a policy applied by hand against a running database is a policy that exists  │
-- │ in production and in nobody's git history.                                                   │
-- │                                                                                              │
-- │ Prisma Migrate has no include directive, so the statements below cannot literally be         │
-- │ `\i`-ed into 20260807000000_expand_create_tenants/migration.sql. They are inline there, and  │
-- │ this file is the reviewed reference copy — the one place to read the policy without scrolling │
-- │ past a hundred lines of column definitions.                                                   │
-- │                                                                                              │
-- │ The two are kept honest by `rls-policy-parity.spec.mjs`, which fails if the migration does   │
-- │ not contain these statements verbatim. Two copies of security-critical SQL with nothing      │
-- │ comparing them is how one gets fixed and the other does not.                                  │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- P-SELF, not P-STD. `tenants` has no `tenant_id` column: its primary key IS the tenant id.
-- Every OTHER tenant-owned table uses `prisma/rls/_template.sql`, which policies on `tenant_id`.

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE  ROW LEVEL SECURITY;

-- USING filters reads; WITH CHECK constrains writes. Both, always — a USING-only policy
-- permits a cross-tenant INSERT that the inserting tenant then cannot see, so nothing looks
-- wrong from either side (PC4, AC-FND-01.1).
--
-- `current_setting('app.tenant_id')` takes NO second argument. With `missing_ok => true` an
-- unset variable yields NULL, the predicate is NULL, and the query returns zero rows silently.
-- Without it, SQLSTATE 42704. §2.3.4: the schema's whole contribution is turning a silent leak
-- into a visible error.
CREATE POLICY rls_tenants__tenant_isolation
    ON tenants
    FOR ALL
    TO app_rw, app_append
    USING      (id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (id = current_setting('app.tenant_id')::uuid);

-- The elevation path (M-014 runElevated). SELECT ONLY, and only for app_platform_ro. This is
-- what lets the admin approval queue read across tenants without BYPASSRLS existing anywhere.
-- It must never gain INSERT, UPDATE or DELETE.
CREATE POLICY rls_tenants__platform_read
    ON tenants
    FOR SELECT
    TO app_platform_ro
    USING (true);
