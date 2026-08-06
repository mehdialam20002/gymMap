-- M-006 · The `P-STD` policy template. Constraints.md §8.3, BR-TEN-01, NFR-SEC-09, ADR-0005.
--
-- COPY THIS INTO EVERY `create_<table>` MIGRATION FOR A TENANT-OWNED TABLE.
-- MG10 / P9 / R-6: the policy ships in the SAME migration as the table. A table without a
-- policy, even for the duration of one commit, is a queryable table.
--
-- Replace <table> throughout. Nothing else changes.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- THE FOUR THINGS BELOW THAT LOOK OPTIONAL AND ARE NOT
-- ═══════════════════════════════════════════════════════════════════════════════════════════
--
-- 1 · `FORCE ROW LEVEL SECURITY`, not just `ENABLE`.
--     `ENABLE` alone exempts the table OWNER. Migrations run as an owner, and so does anything
--     that is accidentally connected as one. Without FORCE, the policy is advisory for exactly
--     the connection most likely to do damage.
--
-- 2 · `current_setting('app.tenant_id')` with NO `missing_ok` argument.
--     Constraints.md §8.3 calls this "the single most consequential omission available". With
--     `missing_ok => true`, an unset variable yields NULL, the predicate is NULL, and the query
--     returns ZERO ROWS — silently. The bug then presents as "the data is missing", someone
--     widens the policy to fix it, and that is the breach. Without it, an unset variable RAISES
--     SQLSTATE 42704. Fail loudly (Security.md P3).
--
-- 3 · `WITH CHECK` as well as `USING`.
--     `USING` filters what you can READ. `WITH CHECK` constrains what you can WRITE. A policy
--     with only `USING` lets a tenant INSERT a row stamped with ANOTHER tenant's id — which it
--     then cannot see, so nothing looks wrong from either side.
--
-- 4 · The platform-read policy is `SELECT` only, for `app_platform_ro` only.
--     This is what makes the admin approval queue possible without granting BYPASSRLS anywhere.
--     It must never gain INSERT, UPDATE or DELETE: a cross-tenant write path defeats the whole
--     model, and `runElevated()` (M-014) is auditable precisely because it can only read.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <table> FORCE  ROW LEVEL SECURITY;

-- The tenant path. Read and write, scoped to the session's tenant.
CREATE POLICY rls_<table>__tenant_isolation
  ON <table>
  FOR ALL
  TO app_rw, app_append
  USING      (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

-- The platform path. SELECT ONLY, across tenants, and only for the elevation role.
CREATE POLICY rls_<table>__platform_read
  ON <table>
  FOR SELECT
  TO app_platform_ro
  USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- The isolation suite (M-015) generates a case group per table from the OpenAPI document and
-- asserts A1-A7 against it. A table added without this block fails CI job 13, which is
-- unwaivable — and if it somehow did not, the failure would be invisible until a tenant read
-- another tenant's rows in production.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
