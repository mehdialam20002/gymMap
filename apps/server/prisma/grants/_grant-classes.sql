-- M-006 · The seven grant classes. Constraints.md §9, Schema.md §2.7.
--
-- COPY THE RELEVANT BLOCK INTO EVERY `create_<table>` MIGRATION. P10: the grant ships with the
-- table. `0_init`'s `ALTER DEFAULT PRIVILEGES … REVOKE ALL … FROM PUBLIC` means a new table
-- starts with NO access at all — so a forgotten grant fails immediately and loudly, rather
-- than a forgotten revoke leaking quietly. That asymmetry is the whole design.
--
-- Every table belongs to EXACTLY ONE class, recorded on its Schema.md entry. The classes
-- partition all 79 tables: 41 + 5 + 15 + 3 + 1 + 14 = 79. `ledger_entries` is the single table
-- carrying two (G-LEDGER fixes who writes it; G-COMPLETE fixes which one column may change).
--
-- Replace <table> throughout.

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- G-CRUD · 41 tables · the ordinary mutable ones
--
-- DELETE IS ABSENT, and that is not an oversight. Every one of these carries `deleted_at`
-- (ADR-0024): the domain operation is a soft delete, and a hard DELETE would destroy history
-- that a settlement statement or an audit may need years later. The genuine hard-delete paths
-- BR-DAT-04 requires run as `app_migrator`, in a reviewed job, with the tenant named in the
-- transaction — never on the request path.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT, UPDATE ON <table> TO app_rw;
GRANT SELECT                 ON <table> TO app_platform_ro;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- G-CRUD-D · 5 tables · favourites, saved_searches, gym_amenities, plan_branches, staff_branches
--
-- The five where a hard delete IS the domain operation and destroys no history. Un-favouriting
-- a gym is not an event anyone needs to reconstruct; keeping a tombstone would be the odd choice.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO app_rw;
GRANT SELECT                         ON <table> TO app_platform_ro;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- G-APPEND · 15 tables · ERD.md §10.1
--
-- No UPDATE and no DELETE. A correction is a new row, never an edit (BR-FIN-01).
-- ═══════════════════════════════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT ON <table> TO app_rw;
GRANT SELECT         ON <table> TO app_platform_ro;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- G-COMPLETE · 3 tables · attendance, outbox, ledger_entries
--
-- Append, plus UPDATE on a NAMED COLUMN LIST and nothing else. Column-scoped because these
-- rows have exactly one field that legitimately changes after write — an outbox row's status,
-- a ledger entry's settlement batch — and a table-wide UPDATE grant would also permit editing
-- the amount. Name the columns explicitly; never widen this to a bare UPDATE.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT           ON <table> TO app_rw;
GRANT UPDATE (<column_list>)   ON <table> TO app_rw;
GRANT SELECT                   ON <table> TO app_platform_ro;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- G-AUDIT · 1 table · audit_log
--
-- THE SPLIT IS THE POINT, and it is AC-3 of this milestone:
--   app_append holds INSERT and NOT SELECT.
--   app_rw     holds SELECT and NOT INSERT.
--
-- The writer cannot read the log. An attacker who reaches the request path cannot enumerate
-- what has been recorded about them, and cannot write a row through the reading role. P9:
-- history is evidence, and a mutable audit log is worse than none because it launders an
-- attacker's actions into apparent legitimacy (AC-ADMN-02.3: "no such capability exists").
-- ═══════════════════════════════════════════════════════════════════════════════════════════
GRANT INSERT ON audit_log TO app_append;
GRANT SELECT ON audit_log TO app_rw;
GRANT SELECT ON audit_log TO app_platform_ro;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- G-LEDGER · ledger_entries · dual-classed with G-COMPLETE (Constraints.md §9.5)
--
-- Only app_append may INSERT. app_rw may read, and may set settlement_batch_id — the one
-- column that changes after write, when an entry is swept into a batch. It may not write an
-- entry, and it may not touch an amount. BR-FIN-01: nothing that affected a balance is edited.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
GRANT INSERT                        ON ledger_entries TO app_append;
GRANT SELECT                        ON ledger_entries TO app_rw;
GRANT UPDATE (settlement_batch_id)  ON ledger_entries TO app_rw;
GRANT SELECT                        ON ledger_entries TO app_platform_ro;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- G-REF · 14 tables · the platform-global reference data of §C2.3
--
-- SELECT on the request path. The admin write path runs as the SAME role and is gated by
-- permission plus a written reason (REASON_REQUIRED, 422) rather than by a separate grant —
-- because a second role would need a second connection pool, and the reason string is the
-- control that actually matters for a config change with platform-wide blast radius.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
GRANT SELECT, INSERT, UPDATE ON <table> TO app_rw;
GRANT SELECT                 ON <table> TO app_platform_ro;

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- Sequences. A table with a sequence needs USAGE, or the INSERT grant above is useless and the
-- failure is a permission error at runtime on the first insert rather than at migration time.
-- Note that UUIDv7 primary keys are application-generated (ERD.md §11.5), so most tables here
-- have no sequence at all.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- GRANT USAGE, SELECT ON SEQUENCE <sequence> TO app_rw;
