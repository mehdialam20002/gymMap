-- migration: 20260808100000_expand_add_refresh_token_write_once
-- phase:            expand                     -- MG3
-- requirement:      M-022 AC-3, Schema.md §4.8, ERD.md §16.1 D-04, FR-AUTH-06, E1.2
-- tables:           refresh_tokens
-- rls:              NONE — IDENTITY class       -- Schema.md §1.3, §4.8
-- grants:           unchanged. D-04's G-COMPLETE grant is not touched
-- append_only:      refresh_tokens, with one completion transition (D-04) — now ENFORCED
-- partitioned:      no
-- max_lock:         ACCESS EXCLUSIVE (create trigger)               -- §4.1
-- rewrite:          none. No existing row is read or written
-- est_duration:     < 50 ms — catalogue only                        -- MG11
-- backfill_job:     none
-- rollback:         FREE. DROP TRIGGER restores the previous behaviour exactly
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             Schema.md §4.8, ERD.md §16.1, docs/DECISION_LOG.md ADR-0035
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- M-022 AC-3 · `refresh_tokens` completion is WRITE-ONCE — `Schema.md` §4.8, `ERD.md` §16.1 D-04.
--
-- ┌─ THE GAP THIS CLOSES, AND HOW IT WAS FOUND ─────────────────────────────────────────────────┐
-- │ The table comment already states the invariant: *"Append-only with ONE completion            │
-- │ transition."* The grant was written to enforce it and does not, quite:                       │
-- │                                                                                              │
-- │     GRANT UPDATE (used_at, superseded_by_id) ON refresh_tokens TO app_rw;                    │
-- │                                                                                              │
-- │ A column-scoped grant restricts WHICH columns may be written. It says nothing about how      │
-- │ MANY times, or in which direction. So `app_rw` — the role every HTTP request runs as — could │
-- │ execute `UPDATE refresh_tokens SET used_at = NULL`, and reuse detection would go quiet.      │
-- │                                                                                              │
-- │ That matters because the entire detection is one inference: `used_at IS NOT NULL` means this │
-- │ generation was already spent, so presenting it again means two parties hold the same token.  │
-- │ Un-spending a row erases the evidence of the replay that spent it, and the theft continues   │
-- │ with the alarm switched off. `refresh-token-grants.int-spec.ts` asserts the refusal.         │
-- │                                                                                              │
-- │ D-04 is unchanged and the grant is untouched. The grant still decides which columns; the     │
-- │ trigger below decides that each may go from NULL to a value exactly once.                    │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ WHY A TRIGGER AND NOT A CHECK CONSTRAINT ──────────────────────────────────────────────────┐
-- │ A CHECK sees one row's proposed state and cannot see what that row held a moment ago —       │
-- │ "was NULL, is now set" is not expressible in it. Write-once is a statement about the         │
-- │ TRANSITION, so it needs `OLD` and `NEW`, and that means a trigger.                            │
-- └──────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- Phase: EXPAND. Additive and reversible — `DROP TRIGGER` restores the previous behaviour exactly,
-- and no existing row is read or rewritten. Nothing in the application performs either of the
-- transitions this refuses, so it cannot break a running release.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

CREATE OR REPLACE FUNCTION refresh_tokens__completion_is_write_once()
    RETURNS trigger
    LANGUAGE plpgsql
AS $$
BEGIN
    -- ── `used_at` ────────────────────────────────────────────────────────────────────────────
    -- Set once, by the rotation that spends this generation. After that it is history.
    IF OLD.used_at IS NOT NULL AND NEW.used_at IS DISTINCT FROM OLD.used_at THEN
        RAISE EXCEPTION
            'refresh_tokens.used_at is write-once (generation % is already spent)', OLD.generation
            USING ERRCODE = '23514',
                  HINT = 'Reuse detection reads used_at. Clearing or moving it erases the evidence '
                         'of the replay that set it. Mint the next generation instead.';
    END IF;

    -- ── `superseded_by_id` ───────────────────────────────────────────────────────────────────
    -- The forward link of the chain. Repointing it would let a replayed generation be handed a
    -- different successor than the one the original rotation minted, which is the TR-28 grace
    -- window turned into a token-issuing oracle.
    IF OLD.superseded_by_id IS NOT NULL
       AND NEW.superseded_by_id IS DISTINCT FROM OLD.superseded_by_id THEN
        RAISE EXCEPTION
            'refresh_tokens.superseded_by_id is write-once (generation % already has a successor)',
            OLD.generation
            USING ERRCODE = '23514',
                  HINT = 'The chain is the audit trail. Append a generation; never repoint one.';
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION refresh_tokens__completion_is_write_once() IS
    'M-022 AC-3. Enforces the ONE completion transition that the G-COMPLETE grant names but a '
    'column-scoped GRANT cannot express: used_at and superseded_by_id each go from NULL to a '
    'value exactly once. Without it, app_rw can set used_at = NULL and silence reuse detection.';

CREATE TRIGGER trg_refresh_tokens__completion_is_write_once
    BEFORE UPDATE ON refresh_tokens
    FOR EACH ROW
    EXECUTE FUNCTION refresh_tokens__completion_is_write_once();
