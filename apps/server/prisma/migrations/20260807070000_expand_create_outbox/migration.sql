-- migration: 20260807070000_expand_create_outbox
-- phase:            expand                     -- MG3
-- requirement:      EP-01 F-01.10, AC-FND-08.1 … AC-FND-08.5, TR-08, TR-20, §C1.5, ADR-0017
-- tables:           outbox                     -- Schema.md §13.1
-- rls:              new table                  -- P9, MG10. P-STD + P-PLATFORM
-- grants:           G-COMPLETE                 -- P10. Column-scoped UPDATE, per Constraints.md §9
-- append_only:      append + a NAMED column list. `payload` is NOT updatable
-- partitioned:      no                         -- R-EPH, purged 30 days after publish (TR-20)
-- max_lock:         ACCESS EXCLUSIVE (create)  -- §4.1
-- rewrite:          none
-- est_duration:     < 100 ms on an empty database                 -- MG11
-- backfill_job:     none
-- rollback:         FREE                       -- P4. Nothing references it yet
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             Schema.md §13.1, docs/runbooks/common.md, Constraints.md §9 G-COMPLETE
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- THE ROW IS WRITTEN IN THE SAME TRANSACTION AS THE STATE CHANGE. THAT IS THE WHOLE IDEA.
--
-- The failure it removes is "the database committed and the event was lost":
--
--   save the order, THEN publish        the process dies between the two. The order exists and
--                                       nothing downstream ever hears about it — no invoice, no
--                                       notification, no settlement line. Silent, and permanent.
--   publish, THEN save the order        the publish succeeds and the save fails. Downstream acts
--                                       on an order that does not exist.
--
-- Writing the event as a ROW, in the same transaction, makes both impossible: either both land or
-- neither does. §C1.5 states the property this buys — *"a notification is never sent for a
-- transaction that rolled back, and never lost for one that committed"*.
--
-- The trap in the M-018 notes: writing the row through a SECOND connection "because the publisher
-- is a different service" destroys the guarantee entirely, and looks completely normal in review.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- `aggregate_type` IS `text`, NOT `outbox_aggregate_type_enum` — BLK-07, carried from M-006
--
-- Schema.md §2.5 defines that enum's values as *"one value per aggregate root of ERD.md §6 — 26
-- at Phase 1"*, and `Relationships.md` repeats *"the 26 aggregate roots of ERD.md §6.1"*. Both
-- citations are wrong: ERD.md §6 and §6.1 are the foreign-key register and the four FK
-- conventions, and neither contains a list of aggregate roots. Deriving the set from the entity
-- register yields 36 candidates — including `outbox` itself, `audit_log` and `idempotency_keys`,
-- which are plainly not event-emitting aggregates. There is no defensible way to pick 26 of 36.
--
-- `MG9` makes an enum value PERMANENT: it can be added but never removed while a row holds it,
-- and never renamed. A guessed value is a wrong value in the catalogue for eight financial years.
--
-- So the column is `text` with a shape CHECK. Tightening it to the enum once the owner supplies
-- the list is a CONTRACT-phase migration — reversible, cheap, and correct. Guessing now is not.

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

-- `outbox_status_enum` already exists — 0_init created it with PENDING, PUBLISHED, FAILED, DEAD.
-- NOT re-created here: MG9 means the values are fixed, and a second CREATE TYPE would fail the
-- migration rather than reconcile anything.

CREATE TABLE IF NOT EXISTS outbox (
    id             uuid                NOT NULL DEFAULT gen_random_uuid(),
    tenant_id      uuid                NOT NULL,

    -- BLK-07 above. PascalCase aggregate root name — `Order`, `Membership`, `Payment`.
    aggregate_type text                NOT NULL,

    -- NO foreign key, deliberately (Schema.md §13.1): the outbox is purged 30 days after publish
    -- while aggregates live for years, so the FK direction is wrong and the lifetimes do not nest.
    aggregate_id   uuid                NOT NULL,

    -- `order.placed`, `payment.captured`. The routing key a consumer subscribes to.
    event_type     text                NOT NULL,
    payload        jsonb               NOT NULL,

    status         outbox_status_enum  NOT NULL DEFAULT 'PENDING',
    attempts       integer             NOT NULL DEFAULT 0,

    -- When the row becomes eligible. Pushed forward on each failure for exponential backoff —
    -- without it a failing event is retried in a tight loop, drowning the log while starving
    -- every row behind it.
    available_at   timestamptz         NOT NULL DEFAULT now(),

    -- SET ONCE (§C1.5). The column-scoped grant permits the write; nothing un-publishes a row.
    published_at   timestamptz             NULL,

    last_error     text                    NULL,
    created_at     timestamptz         NOT NULL DEFAULT now(),

    -- NFR-MNT-04 / AC-FND-09.5. Propagated INTO the job, so a trace does not stop at the HTTP
    -- boundary and "what request caused this notification" stays answerable.
    correlation_id uuid                NOT NULL,

    CONSTRAINT pk_outbox PRIMARY KEY (id),
    CONSTRAINT ck_outbox__attempts CHECK (attempts >= 0),

    -- A PUBLISHED row has a timestamp and nothing else does. Either half alone is a row whose
    -- state cannot be reasoned about during a backlog incident, which is exactly when it is read.
    CONSTRAINT ck_outbox__published
        CHECK ((status = 'PUBLISHED') = (published_at IS NOT NULL)),

    -- BLK-07's shape guard, standing in for the enum: PascalCase, so a lowercase table name or a
    -- free-text description cannot enter the column while the value set is still open.
    CONSTRAINT ck_outbox__aggregate_type
        CHECK (aggregate_type ~ '^[A-Z][A-Za-z]{2,49}$'),

    CONSTRAINT ck_outbox__event_type
        CHECK (event_type ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*){1,3}$'),

    -- An unbounded provider error in a column read during an incident is a column that makes the
    -- incident harder to read.
    CONSTRAINT ck_outbox__last_error_length
        CHECK (last_error IS NULL OR length(last_error) <= 2000)
);

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- THE MOST FREQUENT QUERY IN THE SYSTEM — Schema.md §13.1
--
-- The relay's `SELECT … FOR UPDATE SKIP LOCKED LIMIT n` runs every five seconds, forever. A
-- full scan here is the first thing that falls over.
--
-- PARTIAL, on PENDING only. The table is mostly PUBLISHED rows awaiting the retention sweep, so
-- a full index would be almost entirely dead weight the planner still has to traverse — and it
-- would grow without bound between sweeps.
--
-- This index does NOT lead with `tenant_id`, and that is an SC-R06 exception recorded here: the
-- dispatcher scans ACROSS tenants for the oldest pending rows. A per-tenant scan needs one query
-- per tenant and starves whichever tenants sort last. Isolation is unaffected — the dispatcher
-- reads through `runElevated()` (M-014), which is SELECT-only and audited, and the application
-- path uses `idx_outbox__aggregate`, which is governed by the P-STD policy.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_outbox__pending
    ON outbox (available_at, id)
    WHERE status = 'PENDING';

-- ADR-0017's per-aggregate ordering guarantee: events for one aggregate replay in the order they
-- were written.
CREATE INDEX IF NOT EXISTS idx_outbox__aggregate
    ON outbox (aggregate_type, aggregate_id, id);

-- TR-20. Without pruning this table grows forever and `idx_outbox__pending` degrades until
-- publication latency breaches BAC-02's 60-second window — which surfaces in Sprint 2 as
-- "listings take a while to appear" rather than as an index problem. The sweep ships with the
-- dispatcher, not when someone notices.
CREATE INDEX IF NOT EXISTS idx_outbox__retention
    ON outbox (published_at)
    WHERE status = 'PUBLISHED';

-- The dead-letter queue an operator actually reads during an incident.
CREATE INDEX IF NOT EXISTS idx_outbox__dead
    ON outbox (created_at)
    WHERE status = 'DEAD';

ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox FORCE  ROW LEVEL SECURITY;

CREATE POLICY rls_outbox__tenant_isolation
    ON outbox
    FOR ALL
    TO app_rw, app_append
    USING      (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY rls_outbox__platform_read
    ON outbox
    FOR SELECT
    TO app_platform_ro
    USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- G-COMPLETE — append, plus UPDATE on a NAMED COLUMN LIST and nothing else.
--
-- Column-scoped because an outbox row has exactly five fields that legitimately change after
-- write. A bare `GRANT UPDATE` would also permit editing `payload` — rewriting what an event
-- SAID after it was recorded, which is the same class of problem as a mutable audit log, in a
-- table that drives money movement.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT ON outbox TO app_rw;
GRANT UPDATE (status, published_at, attempts, last_error, available_at) ON outbox TO app_rw;
GRANT SELECT ON outbox TO app_platform_ro;

COMMENT ON TABLE outbox IS
  'AC-FND-08.1 / §C1.5. A domain event written in the SAME transaction as the state change it describes, so "the database committed and the event was lost" cannot happen. Dispatched at-least-once under FOR UPDATE SKIP LOCKED; every consumer is idempotent (AC-FND-12.3). `payload` is deliberately absent from the UPDATE grant — an event must not be able to say something different after the fact.';

COMMENT ON COLUMN outbox.aggregate_type IS
  'text, not outbox_aggregate_type_enum — BLK-07. Schema.md §2.5 and Relationships.md both cite a list of 26 aggregate roots at ERD.md §6, which contains no such list; deriving it yields 36 candidates. MG9 makes an enum value permanent, so guessing would put a wrong value in the catalogue for eight financial years. The CHECK enforces the shape; the enum arrives in a contract-phase migration once the owner supplies the list.';

COMMENT ON COLUMN outbox.available_at IS
  'When the row becomes eligible. Pushed forward on each failure for exponential backoff — without it a failing event is retried in a tight loop, drowning the log while starving every row behind it.';

COMMENT ON COLUMN outbox.correlation_id IS
  'NFR-MNT-04. Propagated INTO the dispatched job, so a trace does not stop at the HTTP boundary and "what request caused this notification" stays answerable.';
