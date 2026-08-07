-- migration: 20260807090000_expand_create_auth_sessions
-- phase:            expand                     -- MG3
-- requirement:      FR-AUTH-09, FR-AUTH-10, ADR-0011, ADR-0035, Schema.md §4.8, D-04
-- tables:           auth_sessions, refresh_tokens
-- rls:              NONE — both IDENTITY class  -- Schema.md §1.3, §4.8
-- grants:           auth_sessions G-CRUD · refresh_tokens G-COMPLETE
-- append_only:      refresh_tokens, with one completion transition (D-04)
-- partitioned:      no
-- max_lock:         ACCESS EXCLUSIVE (create)  -- §4.1
-- rewrite:          none
-- est_duration:     < 150 ms on an empty database                  -- MG11
-- backfill_job:     none
-- rollback:         FREE                       -- P4. Nothing references them yet
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             docs/DECISION_LOG.md ADR-0035, Schema.md §4.8, Constraints.md §9
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- WHY THESE TABLES ARRIVE IN M-020 AND NOT M-022 — ADR-0035
--
-- The roadmap gives them to M-022, and M-022 lists M-020 as a dependency. Neither can be built
-- first. `Epic_02.md` L537 states the edge the other way round, so the plan contains a cycle.
--
-- It resolves in favour of moving the migration because of what each side is:
--
--   FR-AUTH-10 — "a password reset invalidates ALL sessions" — is MASTER_PRD, rank 2. Binding.
--   The milestone a table is created in is `docs/roadmap/`, rank 4, which `CLAUDE.md` §2 calls
--   "a plan of work, never a source of requirements".
--
-- Shipping the reset endpoint without revocation is not a smaller version of the feature.
-- `Authentication.md` §8.8: "Not revoking sessions would violate FR-AUTH-10 and is not a
-- compatibility question." A reset that leaves the attacker's session alive is precisely the
-- scenario a reset exists to end.
--
-- M-020 takes ONLY the tables. JWT issue, rotation and reuse detection stay with M-022, and
-- M-020 writes no session row — it revokes.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- IDENTITY CLASS: NO RLS, AND NEITHER TABLE HAS A `tenant_id`
--
-- A session belongs to a USER, and a user belongs to no single tenant — they may hold
-- memberships at three gyms and one session across all of them. `Schema.md` §1.3 lists
-- `auth_sessions` and `refresh_tokens` in the IDENTITY class beside `users`, for the same
-- reason and with the same control: scoped by `user_id`, protected by authorisation.
--
-- Both are added to the IS6 exemption list in `test/isolation/reference-exemption.int-spec.ts`
-- with their reason, in this change (PC2). Neither carries a `tenant_id`, so PC2's converse
-- check holds for them without an exception — unlike `user_roles`, which needed one.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- `refresh_tokens` IS APPEND-ONLY WITH ONE COMPLETION — DEVIATION D-04
--
-- `ERD.md` §10.1 classes it fully append-only, and §16.1 registers the deviation: `used_at` and
-- `superseded_by_id` are written after the insert. Resolved as grant class G-COMPLETE with a
-- COLUMN-SCOPED update and nothing else.
--
-- The column scope is the whole control. Rotation must leave a CHAIN — generation N marked used
-- and pointing at N+1 — because reuse detection works by finding a second use of a generation
-- that is already spent. A grant that permitted rewriting `token_hash` or `generation` would let
-- the chain be rewritten, and reuse detection would silently stop detecting anything.

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 1 · `auth_sessions` — one authenticated device session. G-CRUD.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS auth_sessions (
    id                   uuid                      NOT NULL,
    created_at           timestamptz               NOT NULL DEFAULT now(),
    updated_at           timestamptz               NOT NULL DEFAULT now(),
    created_by           uuid                          NULL,
    updated_by           uuid                          NULL,

    user_id              uuid                      NOT NULL,

    -- The token family root. Reuse detection keys on it (ADR-0011): every refresh token in a
    -- rotation chain shares one family, so detecting a replayed generation means revoking the
    -- family rather than hunting individual tokens.
    family_id            uuid                      NOT NULL,

    -- Shown on the FR-AUTH-09 sessions screen so a member can recognise their own devices.
    -- `ip` is `inet`, not text: a text column accepts "not an ip" and sorts lexically, so
    -- "10.0.0.2" sorts before "9.0.0.1" and every range query is wrong.
    device_label         text                          NULL,
    user_agent           text                          NULL,
    ip                   inet                          NULL,

    status               auth_session_status_enum  NOT NULL DEFAULT 'ACTIVE',

    -- The TTL sweep boundary. An absolute expiry, not a sliding one — a session that refreshes
    -- forever is a session that never ends, which is what ADR-0011's rotation is bounded by.
    absolute_expires_at  timestamptz               NOT NULL,

    revoked_at           timestamptz                   NULL,
    revoked_reason       text                          NULL,

    CONSTRAINT pk_auth_sessions PRIMARY KEY (id),

    CONSTRAINT uq_auth_sessions__family_id UNIQUE (family_id),

    CONSTRAINT fk_auth_sessions__users
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,

    -- A revoked session must say WHY. "When did this member get logged out and by what" is the
    -- first question of every account-takeover investigation, and `revoked_at` alone answers
    -- half of it. Both or neither.
    CONSTRAINT ck_auth_sessions__revocation_is_complete
        CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL)),

    -- Status and the timestamp cannot disagree. A REVOKED row with no `revoked_at` is a session
    -- the sweep cannot age and the UI cannot explain.
    CONSTRAINT ck_auth_sessions__revoked_status_agrees
        CHECK ((status = 'REVOKED') = (revoked_at IS NOT NULL)),

    CONSTRAINT ck_auth_sessions__expiry_after_creation
        CHECK (absolute_expires_at > created_at)
);

-- FR-AUTH-10's access path, and the one M-020 actually uses: every ACTIVE session for a user,
-- revoked in a single set-based UPDATE. Partial on the status so revoked rows — which
-- accumulate forever, because revocation is not deletion — never grow the hot index.
CREATE INDEX IF NOT EXISTS idx_auth_sessions__user_active
    ON auth_sessions (user_id) WHERE status = 'ACTIVE';

-- The FR-AUTH-09 sessions screen: this user's sessions, newest first, including revoked ones.
CREATE INDEX IF NOT EXISTS idx_auth_sessions__user_created
    ON auth_sessions (user_id, created_at DESC);

-- The TTL sweep, which runs across all users as app_migrator.
CREATE INDEX IF NOT EXISTS idx_auth_sessions__absolute_expires_at
    ON auth_sessions (absolute_expires_at) WHERE status = 'ACTIVE';

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 2 · `refresh_tokens` — one rotation generation. G-COMPLETE (D-04).
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id                uuid         NOT NULL,
    created_at        timestamptz  NOT NULL DEFAULT now(),

    session_id        uuid         NOT NULL,

    -- SHA-256 of the token. THE TOKEN ITSELF IS NEVER STORED (NFR-SEC-07).
    --
    -- `char(64)` and a hex CHECK rather than plain text: a column that accepts anything accepts
    -- the raw token, and the failure mode of storing it is that a database read is a full
    -- session takeover. The shape constraint makes the mistake un-committable.
    token_hash        char(64)     NOT NULL,

    -- Monotonic within the family. Unique per session so two rows cannot claim generation 3 —
    -- which is what makes "a second use of a spent generation" a detectable event rather than
    -- an ambiguous one.
    generation        integer      NOT NULL,

    -- Set when rotated. A WRITE, not an update of the chain: see the header on D-04.
    superseded_by_id  uuid             NULL,

    used_at           timestamptz      NULL,
    expires_at        timestamptz  NOT NULL,

    CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),

    CONSTRAINT uq_refresh_tokens__token_hash UNIQUE (token_hash),
    CONSTRAINT uq_refresh_tokens__session_generation UNIQUE (session_id, generation),

    CONSTRAINT fk_refresh_tokens__auth_sessions
        FOREIGN KEY (session_id) REFERENCES auth_sessions (id) ON DELETE RESTRICT,

    -- Self-FK. The chain is the evidence; a dangling supersede would break the walk that reuse
    -- detection performs.
    CONSTRAINT fk_refresh_tokens__superseded_by
        FOREIGN KEY (superseded_by_id) REFERENCES refresh_tokens (id) ON DELETE RESTRICT,

    -- Lowercase hex, exactly 64 characters. `char(64)` alone would accept 64 spaces.
    CONSTRAINT ck_refresh_tokens__token_hash_is_sha256
        CHECK (token_hash ~ '^[0-9a-f]{64}$'),

    CONSTRAINT ck_refresh_tokens__generation_positive CHECK (generation >= 1),

    CONSTRAINT ck_refresh_tokens__expiry_after_creation CHECK (expires_at > created_at),

    -- A token cannot supersede itself: that is a cycle, and the reuse-detection walk would not
    -- terminate.
    CONSTRAINT ck_refresh_tokens__no_self_supersede CHECK (superseded_by_id IS DISTINCT FROM id)
);

-- Reuse detection's lookup: present a token, find its row by hash. The UNIQUE constraint
-- already provides the index; named here only so the access path is stated.
CREATE INDEX IF NOT EXISTS idx_refresh_tokens__session
    ON refresh_tokens (session_id, generation DESC);

-- The sweep, across all users as app_migrator.
CREATE INDEX IF NOT EXISTS idx_refresh_tokens__expires_at
    ON refresh_tokens (expires_at);

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- RLS — DELIBERATELY ABSENT ON BOTH. IDENTITY class, Schema.md §1.3.
--
-- Neither table has a `tenant_id`, so CI-01 never looks at them; they need no entry in
-- rls-coverage.sql's list. They ARE added to the RS4 exemption list in
-- reference-exemption.int-spec.ts, which diffs every policy-less table against a reviewed set.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- Grants.
--
--   auth_sessions    G-CRUD — SELECT, INSERT, UPDATE. No DELETE: a session is revoked, never
--                    removed, so "when was this member logged out, and why" survives.
--
--   refresh_tokens   G-COMPLETE — SELECT, INSERT, and UPDATE on EXACTLY TWO COLUMNS. This is
--                    the deviation D-04 grant, and the column list is the control: with
--                    `token_hash` or `generation` writable, the rotation chain could be
--                    rewritten and reuse detection would stop detecting.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE ON auth_sessions TO app_rw;
GRANT SELECT                 ON auth_sessions TO app_platform_ro;

GRANT SELECT, INSERT                              ON refresh_tokens TO app_rw;
GRANT UPDATE (used_at, superseded_by_id)          ON refresh_tokens TO app_rw;
GRANT SELECT                                      ON refresh_tokens TO app_platform_ro;

COMMENT ON TABLE auth_sessions IS
  'Schema.md §4.8. One authenticated device session, listable and revocable by its owner (FR-AUTH-09). IDENTITY class: no tenant_id, no RLS — a session belongs to a user, and a user belongs to no single tenant. No DELETE grant: revocation is a status and a timestamp, so an account-takeover investigation can still answer "when was this session ended, and why".';

COMMENT ON COLUMN auth_sessions.family_id IS
  'ADR-0011. The token family root. Reuse detection keys on it: a replayed generation revokes the whole family rather than one token.';

COMMENT ON TABLE refresh_tokens IS
  'Schema.md §4.8, ERD.md §16.1 deviation D-04. Append-only with ONE completion transition. Grant class G-COMPLETE: SELECT, INSERT, and UPDATE on (used_at, superseded_by_id) only. Rotation must leave a chain — a rewritten generation defeats reuse detection, which is why nothing else is grantable.';

COMMENT ON COLUMN refresh_tokens.token_hash IS
  'NFR-SEC-07. SHA-256 of the token. THE TOKEN ITSELF IS NEVER STORED — a database read must not be a session takeover. char(64) plus a lowercase-hex CHECK, so a column that would accept the raw token cannot exist.';
