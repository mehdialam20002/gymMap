-- migration: 20260807060000_expand_create_idempotency_keys
-- phase:            expand                     -- MG3
-- requirement:      EP-01 F-01.9, BR-PAY-03, AC-FND-07.1 … AC-FND-07.5, §14.2.1, TR-36
-- tables:           idempotency_keys
-- rls:              new table                  -- P9, MG10. P-STD + P-PLATFORM
-- grants:           G-CRUD minus DELETE        -- P10. The sweep runs as app_migrator
-- append_only:      no                         -- the response is written once, after the work
-- partitioned:      no
-- max_lock:         ACCESS EXCLUSIVE (create)  -- §4.1
-- rewrite:          none
-- est_duration:     < 100 ms on an empty database                   -- MG11
-- backfill_job:     none
-- rollback:         FREE                       -- P4. Nothing references it yet
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             docs/DECISION_LOG.md (retention window), Schema.md §2.9, Constraints.md §9
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- THE UNIQUE CONSTRAINT ON `key` ALONE IS WHAT MAKES CONCURRENCY WORK
--
-- `uq_idempotency_keys__key` does not lead with `tenant_id`, and `SC-R06` normally requires
-- that every unique index does. This is one of the five closed exceptions (`Schema.md` §2.9),
-- and the reason is mechanical rather than stylistic:
--
--   The key is client-chosen and already unique across the table. Two concurrent requests
--   carrying the same key must COLLIDE — that collision, raised by PostgreSQL as SQLSTATE
--   23505 on a single `INSERT`, is the entire concurrency control. It is what makes
--   "exactly one executes" true without a lock, a queue or a distributed mutex.
--
--   A composite `(tenant_id, key)` index would let the same key insert twice under two
--   tenants. Harmless in itself — but the interceptor's claim would then be "unique per
--   tenant", and the first cross-tenant replay attempt would be a 404 rather than a refusal,
--   which is a different and much subtler failure to reason about.
--
-- Isolation is NOT weakened by this. The ROW still carries `tenant_id` and is still governed by
-- the P-STD policy, so tenant B cannot read or replay tenant A's stored response. The unique
-- index constrains INSERTS; the policy constrains READS. They are different mechanisms and only
-- one of them is about isolation.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- NO DELETE GRANT, AND THE SWEEP IS A MIGRATION-ROLE JOB
--
-- `G-CRUD` minus DELETE. Expiry is enforced by `expires_at` on read, and the physical removal
-- runs as `app_migrator` in a reviewed job (M-018 schedules it).
--
-- If the request path could DELETE, a retry could delete the very record that would have made
-- it a replay — turning a safety mechanism into a second charge, from code that looks like
-- cleanup. The flag `ops.common.idempotency-replay` can disable REPLAY; it can never disable
-- STORAGE, because a gap in the store is unrecoverable.

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id               uuid         NOT NULL DEFAULT gen_random_uuid(),

    -- Client-chosen. Unique across the WHOLE table — see the header for why not per tenant.
    key              text         NOT NULL,

    -- The tenant that owns the record. NOT NULL: an unauthenticated route cannot be REQ-class,
    -- because §14.2.1's REQ set is money-affecting and all of it is behind authentication.
    tenant_id        uuid         NOT NULL,

    -- `POST /v1/tenant/orders`, as routed. Stored so a replay can be checked against the same
    -- endpoint — the same key arriving at a DIFFERENT endpoint is a client bug, and returning
    -- the first endpoint's response for it would be worse than refusing.
    endpoint         text         NOT NULL,

    -- SHA-256 of the canonicalised request. The fingerprint is what distinguishes "the same
    -- request again" from "a different request reusing a key", and getting it wrong in either
    -- direction is a real outage: too broad and a legitimate second purchase is silently
    -- replayed; too narrow and every retry is a 409.
    request_hash     char(64)     NOT NULL,

    -- NULL until the work completes. A row with a key and no response is a request that is
    -- IN FLIGHT, and that state is what a concurrent second request waits on.
    response_status  smallint         NULL,
    response_body    jsonb            NULL,

    -- Replayed byte-identically WITH the original correlation id (AC-FND-07.5's companion), so
    -- a support agent tracing a retry lands on the original request rather than on a trail that
    -- stops at a replay.
    correlation_id   uuid         NOT NULL,

    created_at       timestamptz  NOT NULL DEFAULT now(),
    completed_at     timestamptz      NULL,

    -- Configuration, not a constant. TR-36 / AC-FND-07.5: the window must be at least the
    -- payment provider's retry window, and both numbers are recorded in DECISION_LOG.md. The
    -- default is 24 h; the interceptor supplies the configured value on insert.
    expires_at       timestamptz  NOT NULL,

    CONSTRAINT pk_idempotency_keys PRIMARY KEY (id),

    -- The concurrency control. See the header.
    CONSTRAINT uq_idempotency_keys__key UNIQUE (key),

    -- A response status is either absent (in flight) or a real HTTP status. A row with a body
    -- and no status, or a status of 0, would be replayed as a malformed response.
    CONSTRAINT ck_idempotency_keys__status
        CHECK (response_status IS NULL OR (response_status BETWEEN 100 AND 599)),

    -- Completed means both. A row with a status and no `completed_at` cannot be aged out
    -- correctly, and one with `completed_at` and no status would replay as an empty response.
    CONSTRAINT ck_idempotency_keys__completion
        CHECK ((response_status IS NULL) = (completed_at IS NULL)),

    CONSTRAINT ck_idempotency_keys__expiry CHECK (expires_at > created_at)
);

-- The sweep's access path: expired rows, oldest first. Not a tenant-scoped index, because the
-- sweep runs as app_migrator across every tenant — a per-tenant sweep would need one query per
-- tenant and would miss the tenants that have gone quiet, which are exactly the ones with the
-- oldest rows.
CREATE INDEX IF NOT EXISTS ix_idempotency_keys__expires_at
    ON idempotency_keys (expires_at);

-- The read path when a caller replays: tenant first, because every read is tenant-scoped by the
-- policy and a leading tenant_id lets the index serve the policy predicate too.
CREATE INDEX IF NOT EXISTS ix_idempotency_keys__tenant_key
    ON idempotency_keys (tenant_id, key);

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- RLS — P-STD. Read AND write scoped to the session tenant; platform reads across, SELECT only.
--
-- `current_setting` with NO `missing_ok`: an unset variable RAISES 42704 rather than yielding
-- NULL and silently matching nothing. A silently-empty idempotency table means every retry is
-- treated as a first attempt, which on a payment path is a double charge.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE  ROW LEVEL SECURITY;

CREATE POLICY rls_idempotency_keys__tenant_isolation
    ON idempotency_keys
    FOR ALL
    TO app_rw, app_append
    USING      (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY rls_idempotency_keys__platform_read
    ON idempotency_keys
    FOR SELECT
    TO app_platform_ro
    USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- Grants — G-CRUD minus DELETE.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE ON idempotency_keys TO app_rw;
GRANT SELECT                 ON idempotency_keys TO app_platform_ro;

COMMENT ON TABLE idempotency_keys IS
  'BR-PAY-03. One row per client-supplied Idempotency-Key. The UNIQUE constraint on `key` alone is the concurrency control: two simultaneous requests collide on 23505 and exactly one executes. No DELETE grant — the sweep runs as app_migrator, because a request path that can delete a key can delete the record that would have made a retry a replay.';

COMMENT ON COLUMN idempotency_keys.request_hash IS
  'SHA-256 of method, path, tenant and the canonicalised body. Excludes volatile headers (User-Agent, traceparent) so the same logical retry from a different client build is still a retry. A timestamp or a client request id in here makes every retry a 409 and turns a safety mechanism into an outage.';

COMMENT ON COLUMN idempotency_keys.response_status IS
  'NULL means IN FLIGHT. That state is what a concurrent second request waits on, and it is why the row is inserted BEFORE the work rather than after it.';

COMMENT ON COLUMN idempotency_keys.correlation_id IS
  'The ORIGINAL request''s correlation id, replayed with the stored response so a support agent tracing a retry lands on the request that actually did the work.';
