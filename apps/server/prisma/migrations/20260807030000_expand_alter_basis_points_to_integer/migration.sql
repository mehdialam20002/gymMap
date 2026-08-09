-- migration: 20260807030000_expand_alter_basis_points_to_integer
-- phase:            expand                     -- MG3
-- requirement:      BLK-06, Schema.md §2.4, ADR-0005, A-01, §10.4 R3
-- tables:           tenants                    -- the three bps columns
-- rls:              unchanged                  -- P9
-- grants:           unchanged                  -- P10
-- append_only:      no
-- partitioned:      no
-- max_lock:         ACCESS EXCLUSIVE (type change on an empty table)   -- §4.1
-- rewrite:          full (empty table, so free)
-- est_duration:     < 50 ms at current volume  -- MG11
-- backfill_job:     none
-- rollback:         FREE                       -- P4. Recreate the domain and alter back
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             docs/PHASES.md BLK-06, Schema.md §2.4
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- BLK-06 — RESOLVED, AND THE SCOPE IS ONE DOMAIN, NOT TWELVE
--
-- Prisma cannot bind a parameter for a Postgres DOMAIN over `integer`. A write raises
--
--     SQLSTATE 22P03 — incorrect binary data format in bind parameter N
--
-- BEFORE the statement reaches the RLS policy. The first reading of this was alarming: twelve
-- domains in §2.4 versus a locked ORM, apparently irreconcilable.
--
-- Testing each numeric domain in isolation narrowed it to one:
--
--     basis_points        integer   FAILS
--     money_minor         bigint    works
--     money_minor_nonneg  bigint    works
--     plain integer                 works  (control)
--     the nine text/char domains    work   (bound in the same statement, before the failure)
--
-- So the conflict is not "domains versus Prisma". It is `int4` domains specifically, and exactly
-- one domain in this schema is over `int4`.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- WHAT IS KEPT, AND WHAT IS LOST
--
-- KEPT: the rule. `basis_points` carried `CHECK (VALUE >= 0 AND VALUE <= 1000000)`, and that
-- constraint is reproduced on every column below with the same bounds and a greppable name. No
-- validation is weakened — a negative or absurd rate is still rejected by the database.
--
-- LOST: the named type. A schema browser now shows `integer` rather than `basis_points`, so the
-- column no longer says WHY it is an integer. §2.4's stated purpose — "a rule that would
-- otherwise be restated on 200 columns" — is genuinely diminished: the CHECK is now restated
-- per column. That cost is real and is accepted here because the alternative is either
-- hand-written SQL for every write in the system, or a schema whose column types depend on
-- whether the application writes them.
--
-- The other ELEVEN domains are untouched.
--
-- §10.4 R3 is unaffected: a rate is still an integer count of basis points, never a decimal
-- fraction. `0.10` remains unrepresentable.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

ALTER TABLE tenants
    ALTER COLUMN commission_rate_bps         TYPE integer,
    ALTER COLUMN renewal_commission_rate_bps TYPE integer,
    ALTER COLUMN reserve_bps                 TYPE integer;

-- The domain's CHECK, reproduced per column.
--
-- The upper bound of 1,000,000 bps (10,000%) is deliberately loose, exactly as §2.4 had it: it
-- catches a percentage written as a rate — someone entering `10` meaning 10% when the column
-- wants 1000 — rather than trying to encode a business limit. The business floor and ceiling
-- belong to the commission resolver (M-114), which also enforces the 0 bps floor.
-- Guarded per PM-9: PostgreSQL has no `IF NOT EXISTS` for a table constraint, so re-applying this
-- migration after a partial failure would fail with "constraint already exists" — which is exactly
-- the recovery case the rule exists for. Caught by `migration-lint` once the rule was written.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'ck_tenants__commission_rate_bps_range') THEN
        ALTER TABLE tenants
            ADD CONSTRAINT ck_tenants__commission_rate_bps_range
                CHECK (commission_rate_bps IS NULL
                       OR (commission_rate_bps >= 0 AND commission_rate_bps <= 1000000));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'ck_tenants__renewal_commission_rate_bps_range') THEN
        ALTER TABLE tenants
            ADD CONSTRAINT ck_tenants__renewal_commission_rate_bps_range
                CHECK (renewal_commission_rate_bps IS NULL
                       OR (renewal_commission_rate_bps >= 0
                           AND renewal_commission_rate_bps <= 1000000));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'ck_tenants__reserve_bps_range') THEN
        ALTER TABLE tenants
            ADD CONSTRAINT ck_tenants__reserve_bps_range
                CHECK (reserve_bps >= 0 AND reserve_bps <= 1000000);
    END IF;
END
$$;

-- Dropped rather than left defined. An unused domain is dead code that the next person will
-- reasonably assume is safe to use — and using it would reintroduce BLK-06 on a table nobody
-- is looking at. `RESTRICT` is the default and is what we want: if any column anywhere still
-- depends on it, this fails loudly rather than cascading a silent type change.
DROP DOMAIN IF EXISTS basis_points RESTRICT;

COMMENT ON COLUMN tenants.commission_rate_bps IS
  'Tenant override in BASIS POINTS, never a decimal fraction (§10.4 R3). Was domain basis_points; plain integer since BLK-06 — Prisma cannot bind an int4 domain. Range enforced by ck_tenants__commission_rate_bps_range.';
COMMENT ON COLUMN tenants.reserve_bps IS
  'Rolling reserve in BASIS POINTS. Default 500 = 5%. Range enforced by ck_tenants__reserve_bps_range (see BLK-06).';
