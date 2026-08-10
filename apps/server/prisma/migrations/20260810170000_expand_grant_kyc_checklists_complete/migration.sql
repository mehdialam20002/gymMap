-- migration: 20260810170000_expand_grant_kyc_checklists_complete
-- phase:            expand                     -- MG3
-- requirement:      BLK-15 RESOLVED, ADR-0040, FR-ONB-03, FR-ADMN-06, Schema.md §1.3, §2.7,
--                   §12.3, SeedStrategy.md §2.1
-- tables:           kyc_checklists (grants only)
-- rls:              unchanged. GLOBAL reference on the closed §1.3 exemption list
-- grants:           G-COMPLETE — SELECT, INSERT to app_rw, plus column-scoped UPDATE on
--                   superseded_at, updated_at and updated_by. NOT on items, country_code,
--                   entity_type or version
-- append_only:      effectively. The payload columns are ungrantable for UPDATE by any
--                   application role, so a published checklist cannot be edited — only closed
-- partitioned:      no
-- max_lock:         ACCESS EXCLUSIVE briefly per GRANT. Catalogue-only
-- rewrite:          none
-- est_duration:     < 20 ms                                               -- MG11
-- backfill_job:     none
-- rollback:         REVOKE INSERT and the column-scoped UPDATE, returning to SELECT-only
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             docs/DECISION_LOG.md ADR-0040 · Schema.md §2.7 · PHASES.md BLK-15
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- BLK-15 RESOLVED · G-COMPLETE is the only class under which BOTH statements are true.
--
-- ┌─ THE TWO STATEMENTS, AND WHY NEITHER SIDE HAD TO LOSE ───────────────────────────────────────┐
-- │ `Schema.md` §1.3 line 470 lists `kyc_checklists` among the GLOBAL tables *"written only by     │
-- │ `admin/` through the audited reason-required path"* — which §2.7 defines as **G-REF**:         │
-- │ `SELECT, INSERT, UPDATE`.                                                                       │
-- │                                                                                              │
-- │ `Schema.md` §12.3 line 2040 says *"**Grants: G-APPEND** on all three — versioned by validity   │
-- │ window, superseded, never edited"* — `SELECT, INSERT`, and never `UPDATE`.                      │
-- │                                                                                              │
-- │ Read as a choice between two classes, one document has to lose. Read for what each is          │
-- │ PROTECTING, they agree completely:                                                              │
-- │                                                                                              │
-- │   §12.3 protects the PAYLOAD — a published checklist is never edited, because an application   │
-- │        cited a version and that version must still say what it said.                            │
-- │   §1.3  protects the WRITE PATH — the checklist is configuration, editable without a deploy     │
-- │        (`FR-ADMN-06`), through an audited path.                                                  │
-- │                                                                                              │
-- │ And here is the thing that makes pure G-APPEND unbuildable: **superseding IS an UPDATE.**      │
-- │ `superseded_at` is a column on this table, and closing a version means writing it. Under       │
-- │ `SELECT, INSERT` alone, §12.3's own versioning model cannot be executed at all.                 │
-- │                                                                                              │
-- │ `G-COMPLETE` — §2.7: *"`SELECT, INSERT`, plus column-scoped `UPDATE` on named columns"* — is    │
-- │ the class that satisfies both. Neither document is amended; both are honoured.                  │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ WHAT IS AND IS NOT GRANTABLE, AND WHY THE COLUMN LIST IS THE WHOLE CONTROL ─────────────────┐
-- │ GRANTED:     superseded_at · updated_at · updated_by                                            │
-- │ NOT GRANTED: items · country_code · entity_type · version                                       │
-- │                                                                                              │
-- │ So publishing a new checklist is: INSERT the successor and close the predecessor, in one       │
-- │ transaction, from the reason-gated `admin/` path — and **nothing else is physically possible**. │
-- │ A defect, a compromised request path or a well-meaning migration cannot edit `items` on a      │
-- │ version an application already cited. That is the guarantee `ERD.md` §9.6 depends on when it   │
-- │ freezes the claim and the checklist version together.                                           │
-- │                                                                                              │
-- │ The precedent is `D-03` on `applications.snapshot`, from M-026: the same technique, the same   │
-- │ reasoning — a column-scoped grant is the only control that holds when the application itself   │
-- │ is the attacker (§2.7's opening line).                                                          │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ `app_platform_ro` KEEPS SELECT AND GAINS NOTHING ───────────────────────────────────────────┐
-- │ It reads the checklist to render a reviewer's console. A platform role that could close a      │
-- │ version would be able to change which documents an in-flight application is judged against,    │
-- │ from outside any tenant scope and outside the `FR-ADMN-06` reason path.                          │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

-- The append half. A new version is a new row; there is no other way to publish one.
GRANT INSERT ON kyc_checklists TO app_rw;

/*
 * The completion half — three columns and no more.
 *
 * `updated_at` and `updated_by` ride along because closing a version IS an update and the audit
 * columns must move with it; leaving them out would force the writer to lie about when the change
 * happened, or fail.
 */
GRANT UPDATE (superseded_at, updated_at, updated_by) ON kyc_checklists TO app_rw;
