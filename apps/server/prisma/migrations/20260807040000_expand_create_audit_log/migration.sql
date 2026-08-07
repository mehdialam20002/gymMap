-- migration: 20260807040000_expand_create_audit_log
-- phase:            expand                     -- MG3
-- requirement:      EP-01 F-01.16, BR-DAT-01, BR-DAT-02, NFR-SEC-13, AC-ADMN-02.3, §C2.2
-- tables:           audit_log (partitioned monthly) + 3 partitions
-- rls:              new table                  -- P9, MG10. DUAL class: tenant_id is NULLABLE
-- grants:           G-AUDIT                    -- P10. INSERT to app_append, SELECT to app_rw
-- append_only:      yes                        -- AP1, §6.7. No UPDATE, no DELETE, ever
-- partitioned:      yes                        -- §5. Monthly by occurred_at, §5.1 analysed below
-- max_lock:         ACCESS EXCLUSIVE (create)  -- §4.1
-- rewrite:          none
-- est_duration:     < 200 ms on an empty database                   -- MG11
-- backfill_job:     none
-- rollback:         FREE                       -- P4. Nothing references it yet
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             AuditStrategy.md §1.3 §2, Constraints.md §9 G-AUDIT, Schema.md §2.2
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- THE GRANT SPLIT IS THE WHOLE POINT, AND IT IS ASYMMETRIC ON PURPOSE
--
--     app_append   INSERT      and NOT SELECT
--     app_rw       SELECT      and NOT INSERT, NOT UPDATE, NOT DELETE
--
-- The writer cannot read the log. That is not tidiness — it is what stops a compromised request
-- path from enumerating what has been recorded about it, and from finding the row it wants to
-- suppress. The reader cannot write, so a bug in reporting code cannot forge an entry.
--
-- Nobody gets UPDATE or DELETE. Not app_rw, not app_platform_ro, not the admin console.
-- AC-ADMN-02.3 states it as a capability claim: "no such capability exists". A mutable audit
-- log is worse than none, because it launders an attacker's actions into apparent legitimacy —
-- the reviewer sees a clean history and concludes nothing happened.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- THE PARTITION TRAP — §2.3.3 obligation 7, CI-10
--
-- PostgreSQL applies a partitioned parent's RLS policies when a partition is reached THROUGH
-- the parent. Addressing a partition BY NAME applies only that partition's OWN policies.
--
--     SELECT * FROM audit_log                 → parent policy applies
--     SELECT * FROM audit_log_y2026m08        → parent policy does NOT apply
--
-- So every partition carries its own ENABLE, FORCE and policy pair, and the maintenance job
-- that creates next month's partition must do the same. A partition created without them is a
-- month of every tenant's audit history readable by any tenant — and it would be created by a
-- cron job at 2am, reviewed by nobody.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

-- ───────────────────────────────────────────────────────────────────────────────────────────
-- 1 · The parent
-- ───────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
    id               uuid                     NOT NULL,
    -- The partition key, and part of the primary key because Postgres requires the partition
    -- key in every unique constraint. Server-generated, UTC, NEVER client-supplied: a client
    -- that can choose `occurred_at` can choose which partition its row lands in, and can
    -- backdate its own trail.
    occurred_at      timestamptz              NOT NULL DEFAULT now(),

    -- NULLABLE, and that is why the tenancy class is DUAL rather than RLS. A platform action —
    -- a super-admin changing a commission rule — has no tenant. The policy below handles both
    -- cases explicitly rather than pretending one is the other.
    tenant_id        uuid                     NULL,

    -- No FK to users. CON-04: the row must outlive the actor when BR-DAT-04 pseudonymises them.
    -- RESTRICT would block the data-subject process; SET NULL would destroy the attribution
    -- that is the entire value of the row.
    actor_id         uuid                     NULL,
    actor_type       actor_type_enum          NOT NULL,
    -- For JOB and WEBHOOK: the job name or the provider. NEVER a person's name — that is C3
    -- personal data and belongs nowhere in this table.
    actor_label      text                     NULL,
    -- BR-DAT-02: present on EVERY row written during an impersonation session, not just the
    -- first. A session where only the opening row names the agent is a session whose later
    -- actions are attributed to the impersonated user.
    impersonated_by  uuid                     NULL,

    entity_type      audit_entity_type_enum   NOT NULL,
    -- No FK. The audited row may be hard-deleted by a retention job while this record survives.
    entity_id        uuid                     NOT NULL,
    action           audit_action_enum        NOT NULL,

    -- Changed fields only, and REDACTED through the same deny-list as the logger (AC-9). An
    -- audit row is not a BR-DAT-06 loophole: `before`/`after` on a user update would otherwise
    -- carry the phone number, the email and the PAN in a table retained for seven years.
    before           jsonb                    NULL,
    after            jsonb                    NULL,

    -- Mandatory for administrative actions, elevations, impersonation, overrides and KYC
    -- access. Enforced by the application, not here: the rule depends on the action, and a
    -- CHECK over thirteen action values would be unreadable and would still miss the cases
    -- that depend on the actor's role.
    reason           text                     NULL,
    reason_code      text                     NULL,
    permission       text                     NULL,
    elevation_scope  text                     NULL,

    -- `inet`, not `text`, so an incident can ask "what else came from this subnet". Stored as
    -- the edge-rewritten forwarded address.
    ip               inet                     NULL,
    user_agent       text                     NULL,

    correlation_id   uuid                     NOT NULL,
    request_id       uuid                     NULL,

    -- Which per-user DEK generation encrypted any C3 values. Without it, key rotation makes
    -- old rows undecryptable — and an audit log you cannot read is an audit log you do not have.
    dek_version      smallint                 NULL,

    CONSTRAINT pk_audit_log PRIMARY KEY (occurred_at, id),
    CONSTRAINT ck_audit_log__user_agent_length CHECK (user_agent IS NULL OR length(user_agent) <= 512),
    -- BR-DAT-02 / IM-3: where an impersonation is recorded, the reason must be substantive.
    CONSTRAINT ck_audit_log__impersonation_has_reason
        CHECK (impersonated_by IS NULL OR (reason IS NOT NULL AND length(reason) >= 20))
) PARTITION BY RANGE (occurred_at);

COMMENT ON TABLE audit_log IS
  'Append-only, partitioned monthly. NOBODY holds UPDATE or DELETE — AC-ADMN-02.3: no such capability exists. app_append INSERTs and cannot SELECT; app_rw SELECTs and cannot INSERT.';

-- BAC-13. Two access patterns, two indexes.
--   by entity  "what happened to this membership"      — the support and dispute path
--   by actor   "what did this person do"               — the investigation path
CREATE INDEX IF NOT EXISTS idx_audit_log__entity_occurred
    ON audit_log (entity_type, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log__actor_occurred
    ON audit_log (actor_id, occurred_at DESC);

-- ───────────────────────────────────────────────────────────────────────────────────────────
-- 2 · The immutability trigger — §2.8.2, the SECOND line of defence
--
-- The grants already prevent UPDATE and DELETE, so this should be unreachable. It exists
-- because the grants are the kind of thing a future migration can widen by accident — one
-- `GRANT ALL ON ALL TABLES` in a hurry — and the trigger would still refuse.
--
-- Defence in depth is only worth the words when the two layers fail INDEPENDENTLY. A grant is
-- catalogue state changed by DDL; a trigger is a function that has to be dropped by name. The
-- same mistake does not remove both.
-- ───────────────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_log_is_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION
        'audit_log is append-only (BR-DAT-01, NFR-SEC-13, AC-ADMN-02.3). % is not permitted on '
        'this table by any role. If a record is wrong, append a correcting entry — history is '
        'evidence, and evidence that can be edited is not evidence.',
        TG_OP;
END
$$;

COMMENT ON FUNCTION audit_log_is_immutable() IS
  'Second line of defence behind the G-AUDIT grants (§2.8.2). Unreachable while the grants are correct, which is exactly why it exists.';

-- ───────────────────────────────────────────────────────────────────────────────────────────
-- 3 · Partitions, and everything each one needs
--
-- A helper, because a partition created WITHOUT its policy, grants and trigger is a month of
-- every tenant's audit history readable by any tenant. The maintenance job (M-018) calls this
-- same function, so the cron path and the migration path cannot diverge.
-- ───────────────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_log_create_partition(p_month date) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
    partition_name text := format('audit_log_y%sm%s',
                                  to_char(p_month, 'YYYY'), to_char(p_month, 'MM'));
    range_start    date := date_trunc('month', p_month)::date;
    range_end      date := (date_trunc('month', p_month) + interval '1 month')::date;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
        RETURN partition_name || ' (already present)';
    END IF;

    -- `IF NOT EXISTS` as well as the guard above. Belt and braces, and not redundant: the
    -- guard checks `pg_class` across the whole database while this is atomic with the create,
    -- so two maintenance runs racing at a month boundary cannot both pass the guard and then
    -- both attempt the CREATE.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_log FOR VALUES FROM (%L) TO (%L)',
        partition_name, range_start, range_end);

    -- RLS on the PARTITION ITSELF. The parent's policies do not apply when a partition is
    -- addressed by name (§2.3.3 obligation 7, CI-10), and `SELECT * FROM audit_log_y2026m08`
    -- is a perfectly ordinary thing for a reporting query to do.
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', partition_name);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY', partition_name);

    -- DUAL class. `tenant_id IS NULL` is a PLATFORM row — a super-admin action with no tenant —
    -- and it must remain invisible to every tenant. Without the second disjunct a platform row
    -- would be invisible to everyone including the platform, which is the P-STD hazard applied
    -- to a nullable key.
    EXECUTE format(
        'CREATE POLICY rls_%s__tenant_isolation ON %I FOR ALL TO app_rw, app_append
         USING      (tenant_id = current_setting(''app.tenant_id'')::uuid)
         WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid
                     OR tenant_id IS NULL)',
        partition_name, partition_name);

    EXECUTE format(
        'CREATE POLICY rls_%s__platform_read ON %I FOR SELECT TO app_platform_ro USING (true)',
        partition_name, partition_name);

    -- G-AUDIT, per partition. Grants on a parent do NOT propagate to partitions.
    EXECUTE format('GRANT INSERT ON %I TO app_append', partition_name);
    EXECUTE format('GRANT SELECT ON %I TO app_rw, app_platform_ro', partition_name);

    EXECUTE format(
        'CREATE TRIGGER trg_%s__immutable BEFORE UPDATE OR DELETE ON %I
         FOR EACH STATEMENT EXECUTE FUNCTION audit_log_is_immutable()',
        partition_name, partition_name);

    RETURN partition_name || ' (created)';
END
$$;

COMMENT ON FUNCTION audit_log_create_partition(date) IS
  'Creates one monthly partition WITH its RLS policies, grants and immutability trigger. Called by the migration and by the M-018 maintenance job, so the two cannot diverge.';

-- The current month and the two ahead. Three, not one: a partition-maintenance job that fails
-- silently has two months of runway before an INSERT starts failing, which is the difference
-- between an alert and an outage.
SELECT audit_log_create_partition(date_trunc('month', now())::date);
SELECT audit_log_create_partition((date_trunc('month', now()) + interval '1 month')::date);
SELECT audit_log_create_partition((date_trunc('month', now()) + interval '2 months')::date);

-- ───────────────────────────────────────────────────────────────────────────────────────────
-- 4 · Parent-level RLS, policies, grants and trigger
-- ───────────────────────────────────────────────────────────────────────────────────────────

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE  ROW LEVEL SECURITY;

CREATE POLICY rls_audit_log__tenant_isolation
    ON audit_log
    FOR ALL
    TO app_rw, app_append
    USING      (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid OR tenant_id IS NULL);

CREATE POLICY rls_audit_log__platform_read
    ON audit_log
    FOR SELECT
    TO app_platform_ro
    USING (true);

-- G-AUDIT. Read the asymmetry: app_append gets INSERT and nothing else; app_rw gets SELECT and
-- nothing else. Neither can do the other's job, and neither can UPDATE or DELETE.
GRANT INSERT ON audit_log TO app_append;
GRANT SELECT ON audit_log TO app_rw;
GRANT SELECT ON audit_log TO app_platform_ro;

CREATE TRIGGER trg_audit_log__immutable
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH STATEMENT EXECUTE FUNCTION audit_log_is_immutable();

-- ───────────────────────────────────────────────────────────────────────────────────────────
-- 5 · The audit writer's login role
--
-- A SEPARATE connection, authenticated as a role that is a member of app_append and nothing
-- else. Not `SET ROLE` on the request connection: that would be one statement away from being
-- forgotten, and a forgotten reset leaves the request path holding INSERT on the audit log.
--
-- Two pools is also what makes "which connection wrote this row" answerable from
-- pg_stat_activity during an incident.
--
-- Password set out of band — see 20260807010000 for why it is not in a migration.
-- ───────────────────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gymmap_audit') THEN
        CREATE ROLE gymmap_audit LOGIN INHERIT
            NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
    END IF;
END
$$;

GRANT app_append TO gymmap_audit;
GRANT CONNECT ON DATABASE gymmap TO gymmap_audit;
GRANT USAGE ON SCHEMA public TO gymmap_audit;

COMMENT ON ROLE gymmap_audit IS
  'The audit writer login. Member of app_append ONLY — it can INSERT an audit row and cannot read one back, which is what stops a compromised request path enumerating or suppressing its own trail.';
