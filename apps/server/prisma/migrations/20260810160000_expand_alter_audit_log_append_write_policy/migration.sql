-- migration: 20260810160000_expand_alter_audit_log_append_write_policy
-- phase:            expand                     -- MG3
-- requirement:      BLK-18 RESOLVED, BR-DAT-01, BR-DAT-02, NFR-SEC-13, AC-FND-11.2, ADR-0039,
--                   AuditStrategy.md §2.3, Constraints.md §8.3 (NOT amended), Schema.md §13.3
-- tables:           audit_log (parent) + audit_log_y2026m08/m09/m10, and the function that
--                   creates future partitions
-- rls:              the tenant-isolation policy narrows from FOR ALL to FOR SELECT, matching the
--                   grant that already shipped; a NEW FOR INSERT policy is added for app_append
-- grants:           UNCHANGED. app_rw already held SELECT only, app_append INSERT only
-- append_only:      yes, and still enforced by audit_log_is_immutable() plus the absent grants
-- partitioned:      YES — every policy is applied to the parent AND to all three partitions AND
--                   inside audit_log_create_partition(), or the cron path diverges next month
-- max_lock:         ACCESS EXCLUSIVE per table while policies are swapped. audit_log holds zero
--                   rows in every environment, because BLK-18 meant no write ever succeeded
-- rewrite:          none. A policy change is catalogue-only
-- est_duration:     < 60 ms                                               -- MG11
-- backfill_job:     none. There is nothing to backfill — that is the defect being fixed
-- rollback:         restore the FOR ALL policy from 20260807040000 and drop the append policy.
--                   This re-breaks BR-DAT-01, so a rollback is an incident, not a retreat
-- concurrent_steps: none
-- reviewers:        two, one schema owner, one security   -- MG8
-- docs:             docs/DECISION_LOG.md ADR-0039 · AuditStrategy.md §2.3 · PHASES.md BLK-18
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- BLK-18 RESOLVED · every audit write failed, and the fix is to make the POLICY match the GRANT.
--
-- ┌─ THE DEFECT, REPRODUCED AS THE DEPLOYED CREDENTIAL BEFORE AND AFTER ─────────────────────────┐
-- │ As `gymmap_audit` (a member of `app_append` and nothing else):                                 │
-- │                                                                                              │
-- │     ERROR:  unrecognized configuration parameter "app.tenant_id"        -- SQLSTATE 42704      │
-- │                                                                                              │
-- │ `AuditPrismaService` is DELIBERATELY not tenant-extended — its own header explains why: *"an   │
-- │ audit row's `tenant_id` is frequently NULL (an elevation belongs to no tenant, and neither     │
-- │ does a platform-admin login), and the extension refuses any operation with no tenant in        │
-- │ scope."* So `app.tenant_id` is never set on that connection.                                   │
-- │                                                                                              │
-- │ The shipped policy was `FOR ALL TO app_rw, app_append` with                                    │
-- │ `WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid OR tenant_id IS NULL)`. The    │
-- │ one-argument `current_setting` RAISES when the setting is absent, and PostgreSQL does not      │
-- │ promise to short-circuit `OR` — here it evaluates the left operand first. So every insert      │
-- │ failed, INCLUDING the `tenant_id IS NULL` rows that clause exists to permit, and               │
-- │ `AuditPrismaRepository.append()` catches and logs by design. `audit_log` held ZERO rows.        │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ WHY THIS IS NOT A NEW DECISION: THE GRANTS ALREADY SAID IT ─────────────────────────────────┐
-- │ Read from `information_schema.role_table_grants` before writing a line of this migration:      │
-- │                                                                                              │
-- │     app_append      : INSERT                                                                   │
-- │     app_platform_ro : SELECT                                                                   │
-- │     app_rw          : SELECT                                                                   │
-- │                                                                                              │
-- │ `app_rw` holds NO INSERT. So a `FOR ALL` policy for `app_rw` covered operations it could never │
-- │ perform, and the tenant predicate on the WRITE side applied only to `app_append` — the one     │
-- │ role that structurally cannot satisfy it. The policy was out of step with the grant, and       │
-- │ aligning them is what this migration does.                                                     │
-- │                                                                                              │
-- │ `AuditStrategy.md` §2.3's own illustrative block specifies exactly this shape:                 │
-- │     CREATE POLICY rls_audit_log_y2026m11__tenant_isolation ON audit_log_y2026m11               │
-- │       FOR SELECT TO app_rw USING (tenant_id = current_setting('app.tenant_id')::uuid);          │
-- │     GRANT INSERT ON audit_log_y2026m11 TO app_append;                                          │
-- │ — a SELECT-only policy, and a GRANT for the writer. The write path was always meant to be      │
-- │ governed by the grant rather than by a predicate.                                              │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ `missing_ok` IS NOT WRITTEN, AND `Constraints.md` §8.3 IS NOT AMENDED ───────────────────────┐
-- │ The obvious fix — `current_setting('app.tenant_id', true)` — was written, applied and reverted │
-- │ within the hour at M-029, because §8.3 says in one line: *"`missing_ok` is `false`. It is      │
-- │ never written."* `migration-lint` enforces it and refused the migration. The rule is right.    │
-- │                                                                                              │
-- │ Its reasoning is about the READ side: a NULL predicate returns zero rows silently, the bug     │
-- │ looks like missing data, somebody widens the policy to "fix" it, and THAT is the breach. This  │
-- │ migration leaves the read policy's one-argument `current_setting` exactly as it is — so an     │
-- │ unset variable on a READ still raises loudly, which is what §8.3 wants.                         │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ WHAT `WITH CHECK (true)` FOR `app_append` DOES AND DOES NOT PERMIT ─────────────────────────┐
-- │ PERMITS: `app_append` inserting a row carrying any `tenant_id`, including NULL.                 │
-- │ DOES NOT PERMIT: reading anything at all (no SELECT grant), updating anything (no UPDATE        │
-- │   grant, and `audit_log_is_immutable()` refuses regardless), deleting anything, or any access   │
-- │   whatsoever by `app_rw` beyond its tenant-scoped SELECT.                                       │
-- │                                                                                              │
-- │ The alternative — keeping a tenant predicate on the write — was rejected on inspection at      │
-- │ M-029 and again here: the writer would be choosing the value it is then checked against, which │
-- │ is §8.4's tautology in a different costume. It constrains nothing and costs every audit row.   │
-- │                                                                                              │
-- │ Tenant ISOLATION is unaffected, and that is the invariant that matters. It lives on the READ   │
-- │ side, where `app_rw` — the role every request uses — keeps `FOR SELECT` with the tenant         │
-- │ predicate. No tenant can read another tenant's audit rows before or after this change.          │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

/*
 * One loop over the parent and every existing partition.
 *
 * Written as a loop rather than four copied blocks because `§2.3.3` obligation 7 and `CI-10` make
 * this the exact place a partition gets forgotten: the parent's policies do NOT apply when a
 * partition is addressed by name, and `SELECT * FROM audit_log_y2026m08` is an ordinary thing for a
 * reporting query to write. A copied block is a block somebody adds three of and forgets the fourth.
 */
DO $$
DECLARE
  target text;
BEGIN
  FOR target IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname LIKE 'audit_log%'
      AND c.relkind IN ('p', 'r')
    ORDER BY c.relname
  LOOP
    -- The FOR ALL policy goes. Its name is reused for the narrowed SELECT policy, so the parity
    -- check in `rls-policy-parity.spec.mjs` keeps finding a `__tenant_isolation` policy per table.
    EXECUTE format('DROP POLICY IF EXISTS rls_%s__tenant_isolation ON %I', target, target);

    EXECUTE format(
      'CREATE POLICY rls_%s__tenant_isolation ON %I
         FOR SELECT TO app_rw
         USING (tenant_id = current_setting(''app.tenant_id'')::uuid)',
      target, target);

    /*
     * The write policy. INSERT only, `app_append` only, no predicate.
     *
     * `WITH CHECK (true)` and not a tenant comparison — see the header. The isolation this role is
     * subject to is its GRANT: one table, insert only, reads nothing.
     */
    EXECUTE format('DROP POLICY IF EXISTS rls_%s__append_write ON %I', target, target);

    EXECUTE format(
      'CREATE POLICY rls_%s__append_write ON %I
         FOR INSERT TO app_append
         WITH CHECK (true)',
      target, target);
  END LOOP;
END $$;

/*
 * And the function that creates NEXT month's partition, or the cron path re-introduces the defect
 * on the first of the month and nobody is watching.
 *
 * This is the half a "fix the tables" migration forgets. The body is reproduced from the shipped
 * function with the two policy statements replaced; everything else — the double existence guard,
 * the ENABLE + FORCE, the platform read policy, the grants — is unchanged.
 */
CREATE OR REPLACE FUNCTION audit_log_create_partition(p_month date)
  RETURNS text
  LANGUAGE plpgsql
AS $function$
DECLARE
    partition_name text := format('audit_log_y%sm%s',
                                  to_char(p_month, 'YYYY'), to_char(p_month, 'MM'));
    range_start    date := date_trunc('month', p_month)::date;
    range_end      date := (date_trunc('month', p_month) + interval '1 month')::date;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
        RETURN partition_name || ' (already present)';
    END IF;

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_log FOR VALUES FROM (%L) TO (%L)',
        partition_name, range_start, range_end);

    -- RLS on the PARTITION ITSELF. The parent's policies do not apply when a partition is
    -- addressed by name (§2.3.3 obligation 7, CI-10).
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', partition_name);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY', partition_name);

    -- READ. Tenant-scoped, SELECT only, app_rw only — which is the only privilege app_rw holds.
    EXECUTE format(
        'CREATE POLICY rls_%s__tenant_isolation ON %I
           FOR SELECT TO app_rw
           USING (tenant_id = current_setting(''app.tenant_id'')::uuid)',
        partition_name, partition_name);

    -- WRITE. app_append, INSERT only, no predicate — BLK-18 / ADR-0039. A tenant predicate here
    -- fails on every row, because this connection deliberately opens no tenant context.
    EXECUTE format(
        'CREATE POLICY rls_%s__append_write ON %I
           FOR INSERT TO app_append
           WITH CHECK (true)',
        partition_name, partition_name);

    EXECUTE format(
        'CREATE POLICY rls_%s__platform_read ON %I FOR SELECT TO app_platform_ro USING (true)',
        partition_name, partition_name);

    -- Grants are NOT inherited from the parent. The write role and the read role are different.
    EXECUTE format('GRANT INSERT ON %I TO app_append', partition_name);
    EXECUTE format('GRANT SELECT ON %I TO app_rw, app_platform_ro', partition_name);

    RETURN partition_name || ' (created)';
END;
$function$;
