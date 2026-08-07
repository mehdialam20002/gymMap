-- M-009 · IS6 · RLS coverage. CI-01 and its converse PC2.
--
-- Two queries. Both must return ZERO ROWS.
--
-- The pair matters more than either half. CI-01 alone catches a tenant-owned table with no
-- policy — the obvious failure. PC2 catches the way people make CI-01 pass without fixing
-- anything: adding the table to the exemption list. An exemption list with no counter-check is
-- a list that grows every time the gate is inconvenient, and six months later it is the whole
-- schema.

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- CI-01 · Every table with a tenant_id column, plus `tenants` itself, must carry BOTH policies
--         and have RLS enabled AND forced.
--
-- `tenants` is included explicitly because it is policy class P-SELF: it has no `tenant_id`
-- column (its primary key IS the tenant id), so a tenant_id-based scan would skip the single
-- most important table in the system.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
WITH tenant_owned AS (
    SELECT c.oid, c.relname AS table_name, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname NOT IN (
          -- The committed exemption list. Every entry is a GLOBAL platform-reference table
          -- (Constraints.md §9 class G-REF) or infrastructure, and PC2 below proves none of
          -- them has quietly acquired a tenant_id.
          '_prisma_migrations',   -- Prisma bookkeeping
          'spatial_ref_sys',      -- ships with PostGIS
          'countries',            -- G-REF · §C2.3
          'cities',               -- G-REF
          'localities',           -- G-REF
          'amenities',            -- G-REF
          'gym_categories',       -- G-REF
          'reason_codes',         -- G-REF
          'help_articles',        -- G-REF
          'feature_flags',        -- G-REF
          'notification_templates', -- G-REF
          'subscription_tiers',   -- G-REF
          'tax_profiles',         -- G-REF
          'kyc_checklists',       -- G-REF
          'commission_rules',     -- G-REF
          'report_definitions',   -- G-REF
          'roles',                -- IDENTITY class, GLOBAL (Schema.md §1.3)
          'permissions',
          'role_permissions',

          -- ─────────────────────────────────────────────────────────────────────────────────
          -- THE ONE REVIEWED EXCEPTION. `user_roles` HAS a tenant_id and has NO policy.
          --
          -- M-019, AC-2. Everything above is exempt because it has no tenant to be scoped to.
          -- This one is different in kind, so its reason is written out rather than tagged:
          --
          --   A platform-role grant has `tenant_id IS NULL` — the nullable column IS the
          --   discriminator (ERD.md §3.1). A policy `tenant_id = current_setting(...)`
          --   evaluates NULL = <uuid> for every one of those rows, which is NULL, which is
          --   not TRUE. Every platform grant becomes invisible to every session, including
          --   the platform's own, and super-admins silently lose their own permissions.
          --
          --   `user_roles` is also what resolves an identity INTO a tenant membership. A row
          --   that must be read in order to decide which tenant you are cannot itself be
          --   filtered by which tenant you are.
          --
          -- Isolation is not weakened: the table is scoped by `user_id` and protected by
          -- authorisation (Schema.md §1.3 IDENTITY class), and PC2-IDENTITY below asserts
          -- this is the ONLY table allowed to sit here. A second one cannot be added quietly.
          -- ─────────────────────────────────────────────────────────────────────────────────
          'user_roles'
      )
      AND (
          c.relname = 'tenants'                                     -- P-SELF
          OR EXISTS (
              SELECT 1 FROM pg_attribute a
              WHERE a.attrelid = c.oid AND a.attname = 'tenant_id' AND a.attnum > 0
                AND NOT a.attisdropped
          )
      )
)
SELECT
    t.table_name,
    CASE
        WHEN NOT t.relrowsecurity          THEN 'RLS is not ENABLED'
        WHEN NOT t.relforcerowsecurity     THEN 'RLS is enabled but not FORCED — the owner is exempt, and migrations run as an owner'
        -- The real policy name, not a template. A finding that says `rls_<table>__…` makes the
        -- reader do the substitution before they can grep for it.
        WHEN p.isolation_policies = 0      THEN 'no rls_' || t.table_name || '__tenant_isolation policy'
        WHEN p.platform_policies = 0       THEN 'no rls_' || t.table_name || '__platform_read policy — runElevated() cannot read it'
        WHEN p.isolation_with_check = 0    THEN 'the isolation policy has USING but no WITH CHECK — a cross-tenant INSERT is permitted (PC4)'
        WHEN p.permissive_setting > 0      THEN 'the policy uses current_setting(..., true); missing_ok turns a raised error into zero rows'
    END AS finding
FROM tenant_owned t
LEFT JOIN LATERAL (
    SELECT
        count(*) FILTER (WHERE policyname = 'rls_' || t.table_name || '__tenant_isolation') AS isolation_policies,
        count(*) FILTER (WHERE policyname = 'rls_' || t.table_name || '__platform_read')    AS platform_policies,
        count(*) FILTER (WHERE policyname = 'rls_' || t.table_name || '__tenant_isolation'
                           AND with_check IS NOT NULL)                                      AS isolation_with_check,
        count(*) FILTER (WHERE qual ~ 'current_setting\([^)]*,\s*true\s*\)')                AS permissive_setting
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = t.table_name
) p ON true
WHERE NOT t.relrowsecurity
   OR NOT t.relforcerowsecurity
   OR p.isolation_policies = 0
   OR p.platform_policies = 0
   OR p.isolation_with_check = 0
   OR p.permissive_setting > 0;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- PC2 · The converse. No table on the exemption list may carry a tenant_id column.
--
-- This is the check that stops the exemption list being used as an escape hatch: the easiest
-- way to make CI-01 green is to add the offending table to the list, and this makes that
-- impossible for anything that is actually tenant-owned.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
SELECT
    c.relname AS table_name,
    'is on the CI-01 exemption list but HAS a tenant_id column — it is tenant-owned and must ' ||
    'carry policies, not an exemption' AS finding
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id' AND a.attnum > 0
                   AND NOT a.attisdropped
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
      'countries', 'cities', 'localities', 'amenities', 'gym_categories', 'reason_codes',
      'help_articles', 'feature_flags', 'notification_templates', 'subscription_tiers',
      'tax_profiles', 'kyc_checklists', 'commission_rules', 'report_definitions',
      'roles', 'permissions', 'role_permissions'
      -- `user_roles` is deliberately NOT in this list. It is on CI-01's exemption list AND it
      -- has a tenant_id, which is exactly what PC2 exists to forbid — so it is held to
      -- PC2-IDENTITY below instead, which is a stricter check, not a weaker one.
  );

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- PC2-IDENTITY · `user_roles` is the ONLY table permitted a tenant_id without policies.
--
-- M-019, AC-2. PC2 above assumes an exempted table has no tenant to be scoped to. `user_roles`
-- breaks that assumption for a documented reason (see CI-01's list, and the migration header),
-- and one reviewed exception is a decision. TWO is a pattern, and the second one arrives in a
-- pull request that cites the first as precedent.
--
-- So this query allows exactly one name. Any other table that acquires a tenant_id and no
-- policy — whether by being added to CI-01's list or by a policy being dropped from a table
-- already there — is reported by name. Adding a second entry means editing this query too, in
-- a diff a reviewer cannot miss.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
SELECT
    c.relname AS table_name,
    'has a tenant_id column and NO RLS policy. `user_roles` is the single reviewed exception ' ||
    '(Schema.md §4.7, M-019 AC-2); every other tenant_id-bearing table must carry both ' ||
    'policies. If this exception is genuinely correct, it needs its own written reason in ' ||
    'CI-01''s list AND an amendment to PC2-IDENTITY — not a quiet addition to an allowlist'
        AS finding
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id' AND a.attnum > 0
                   AND NOT a.attisdropped
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname <> 'user_roles'
  AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = c.relname
  );

