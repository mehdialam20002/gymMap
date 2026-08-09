-- migration: 20260809000000_expand_add_mfa_columns_to_users
-- phase:            expand                     -- MG3
-- requirement:      M-024, FR-AUTH-07, NFR-SEC-11, Security.md §2.8, E1.3
-- tables:           users
-- rls:              NONE — IDENTITY class       -- Schema.md §1.3, §4.6
-- grants:           column-level, added for the four new columns. See the GRANT block below —
--                   `users` grants app_rw per COLUMN, so a new column is unwritable until named
-- append_only:      no
-- partitioned:      no
-- max_lock:         ACCESS EXCLUSIVE, held for the catalogue update only   -- §4.1
-- rewrite:          NONE. Four nullable columns with no DEFAULT — PostgreSQL 11+ adds these to the
--                   catalogue without touching a single heap page
-- est_duration:     < 50 ms                                               -- MG11
-- backfill_job:     none. NULL is the correct value for every existing row: nobody is enrolled
-- rollback:         FREE while no row has a non-NULL value. DROP COLUMN restores the previous shape
-- concurrent_steps: none
-- reviewers:        two, one schema owner      -- MG8
-- docs:             Security.md §2.8, MASTER_PRD.md §B3.1
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- M-024 · TOTP enrolment state on `users` — `FR-AUTH-07`, `NFR-SEC-11`, `Security.md` §2.8.
--
-- ┌─ FOUR COLUMNS, AND THE FOURTH IS NOT IN THE ROADMAP'S FILE LIST ─────────────────────────────┐
-- │ The roadmap names three: `mfa_enrolled_at`, `mfa_secret_encrypted`, `mfa_recovery_codes_hashed`.│
-- │ `mfa_last_step` is added because `Security.md` §2.8 requires it in the same breath as the      │
-- │ acceptance window:                                                                             │
-- │                                                                                                │
-- │   "The last accepted step counter is stored per user; a code from an already-accepted step is  │
-- │    refused. Without this, a code observed over the shoulder is valid for up to 90 seconds."     │
-- │                                                                                                │
-- │ Without the column there is nowhere to put that counter, so the ±1 drift window silently        │
-- │ becomes a 90-second code lifetime and replay protection cannot be implemented at all. The       │
-- │ roadmap is rank 4 and a plan of work; `Security.md` is rank 3 derived specification, so the     │
-- │ column is in.                                                                                   │
-- └────────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ `users.mfa_enabled` ALREADY EXISTS, AND THAT IS THE FLAG — THIS ADDS THE REST ──────────────┐
-- │ `M-019` created `mfa_enabled boolean NOT NULL DEFAULT false` with the comment *"Mandatory for  │
-- │ platform staff roles (NFR-SEC-11). Enforced in the authorisation layer at M-024"*. It is the   │
-- │ placeholder for exactly this milestone, and nothing has ever read it.                           │
-- │                                                                                                │
-- │ The first draft of this migration missed it and introduced `mfa_enrolled_at` as "the single     │
-- │ source of truth for whether the factor is active". That would have been a SECOND answer to one  │
-- │ question, and the two would diverge the first time a code path set one and not the other —      │
-- │ with the boolean, the one an authorisation check reaches for by name, silently winning.         │
-- │                                                                                                │
-- │ So: `mfa_enabled` stays the flag, `mfa_enrolled_at` records WHEN it became true (which the      │
-- │ audit needs and a boolean cannot express), and a CHECK makes disagreement unrepresentable       │
-- │ rather than merely discouraged.                                                                 │
-- └────────────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ THE NEW COLUMNS ARE ALL NULLABLE, AND THE PENDING-ENROLMENT STATE IS WHY ───────────────────┐
-- │ Enrolment is two-step by design (§2.8: "requires password re-authentication, then a live code  │
-- │ to confirm before the secret becomes effective"), so there is a legitimate intermediate state:  │
-- │ a secret exists, `mfa_enabled` is still false. Forcing the secret to move with the flag would   │
-- │ make that state unrepresentable and push the pending secret somewhere worse — a Redis key or    │
-- │ the session — where it is audited by nothing.                                                    │
-- │                                                                                                │
-- │ The CHECK below therefore ties ONLY the flag to its timestamp, and says nothing about the       │
-- │ secret.                                                                                          │
-- └────────────────────────────────────────────────────────────────────────────────────────────────┘

SET LOCAL lock_timeout       = '5s';    -- PM-8. first statement, always
SET LOCAL statement_timeout  = '300s';  -- PM-8. second statement, always

-- Missing from the first version of this file, and `migration-lint` PM-8 caught it. The rule
-- is not ceremony: without a lock_timeout this ALTER waits indefinitely behind a long
-- transaction while a queue of blocked queries builds behind IT, and a catalogue-only change
-- that should take 50ms becomes an outage. `5s` fails fast instead, and the deploy retries.

ALTER TABLE users
    -- WHEN `mfa_enabled` became true. Not a second flag — the CHECK below binds them.
    ADD COLUMN IF NOT EXISTS mfa_enrolled_at timestamptz NULL,

    -- ┌─ C5 · NEVER THE RAW SECRET ─────────────────────────────────────────────────────────────┐
    -- │ §2.8: "160-bit CSPRNG, encrypted at rest under the application data key, never returned  │
    -- │ after enrolment." `text` rather than `bytea` because what is stored is an ENVELOPE — the │
    -- │ algorithm, the key id, the IV, the ciphertext and the auth tag — and an envelope needs to │
    -- │ be readable by an operator diagnosing a decryption failure at 3am without a hex dump.    │
    -- │                                                                                          │
    -- │ The key id inside it is what makes rotation possible: re-encrypting every row is a       │
    -- │ migration, but decrypting an old row with the key it names is just reading the envelope. │
    -- └──────────────────────────────────────────────────────────────────────────────────────────┘
    ADD COLUMN IF NOT EXISTS mfa_secret_encrypted text NULL,

    -- ┌─ AN ARRAY, AND THE ENTRIES ARE ARGON2id PHC STRINGS ─────────────────────────────────────┐
    -- │ Ten hashes on the user row rather than a `mfa_recovery_codes` table. The set is bounded  │
    -- │ at ten, is always read whole (a submitted code is compared against all remaining), is    │
    -- │ always written whole (regeneration replaces the set), and never needs its own identity   │
    -- │ or foreign key. A child table would add a join to every verification for no gain.        │
    -- │                                                                                          │
    -- │ CONSUMPTION IS REMOVAL FROM THE ARRAY, which is the one thing to get right: a `used_at`  │
    -- │ per code would need the child table, and leaving a spent hash in place makes "how many   │
    -- │ remain" a question nobody can answer cheaply — and §2.8 prompts regeneration below three.│
    -- └──────────────────────────────────────────────────────────────────────────────────────────┘
    ADD COLUMN IF NOT EXISTS mfa_recovery_codes_hashed text[] NULL,

    -- The highest TOTP step already accepted. `bigint` because the step counter for the year 2286
    -- exceeds int4, and a wrapped counter would accept every replay from that moment on.
    ADD COLUMN IF NOT EXISTS mfa_last_step bigint NULL;

COMMENT ON COLUMN users.mfa_enrolled_at IS
    'FR-AUTH-07 · when mfa_enabled became true. NOT a second flag: ck_users__mfa_enabled_has_timestamp '
    'binds the two. NULL exactly when mfa_enabled is false.';
COMMENT ON COLUMN users.mfa_secret_encrypted IS
    'Security.md §2.8 · C5. The 160-bit TOTP secret in an encryption envelope (algorithm, key id, '
    'IV, ciphertext, tag). Never logged, never returned after enrolment.';
COMMENT ON COLUMN users.mfa_recovery_codes_hashed IS
    'Security.md §2.8 · ten Argon2id PHC strings, shown once in plaintext at enrolment. Consuming '
    'a code REMOVES its hash from the array, so cardinality is the remaining count.';
COMMENT ON COLUMN users.mfa_last_step IS
    'Security.md §2.8 · the highest accepted TOTP step. Refusing anything at or below it is what '
    'stops a code being replayed for the 90 seconds the +/-1 drift window would otherwise allow.';

-- ┌─ THE FLAG AND ITS TIMESTAMP CANNOT DISAGREE ────────────────────────────────────────────────┐
-- │ Two columns describing one fact is a bug waiting for a code path that updates one of them. A  │
-- │ CHECK is the only place the rule holds regardless of which repository, migration or manual     │
-- │ UPDATE does the writing — and the failure it produces names the constraint, which is a far     │
-- │ better incident than an account that reports MFA on while no factor was ever enrolled.         │
-- │                                                                                                │
-- │ NOT VALID is deliberate: every existing row has `mfa_enabled = false` and a NULL timestamp, so  │
-- │ they already satisfy it — but VALIDATE is a separate, lock-light statement, and running it      │
-- │ immediately keeps the constraint honest without holding ACCESS EXCLUSIVE over a full scan.      │
-- └────────────────────────────────────────────────────────────────────────────────────────────────┘
ALTER TABLE users
    ADD CONSTRAINT ck_users__mfa_enabled_has_timestamp
    CHECK (mfa_enabled = (mfa_enrolled_at IS NOT NULL)) NOT VALID;

ALTER TABLE users VALIDATE CONSTRAINT ck_users__mfa_enabled_has_timestamp;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- GRANTS — the part that is invisible until it fails at runtime.
--
-- ┌─ `users` GRANTS app_rw PER COLUMN, NOT PER TABLE ────────────────────────────────────────────┐
-- │ A column added without a grant is readable by nobody and writable by nobody, and the failure   │
-- │ arrives as `permission denied for table users` from a route that looks correct — a 500 during  │
-- │ enrolment, on a code path a unit test with a doubled repository never touches.                  │
-- │                                                                                                │
-- │ INSERT is granted alongside UPDATE because `app_rw` writes the full column list on user        │
-- │ creation; omitting it makes registration fail rather than enrolment, which is a confusing      │
-- │ place to discover a missing grant on an MFA column.                                             │
-- └────────────────────────────────────────────────────────────────────────────────────────────────┘
GRANT SELECT (mfa_enrolled_at, mfa_secret_encrypted, mfa_recovery_codes_hashed, mfa_last_step)
    ON users TO app_rw;
GRANT INSERT (mfa_enrolled_at, mfa_secret_encrypted, mfa_recovery_codes_hashed, mfa_last_step)
    ON users TO app_rw;
GRANT UPDATE (mfa_enrolled_at, mfa_secret_encrypted, mfa_recovery_codes_hashed, mfa_last_step)
    ON users TO app_rw;

-- ┌─ `app_platform_ro` IS NOT NAMED HERE, AND IT STILL SEES THESE COLUMNS ───────────────────────┐
-- │ Its SELECT on `users` is TABLE-level, granted before this migration, so it picks up every      │
-- │ future column automatically — including the encrypted secret. That is a pre-existing shape and │
-- │ narrowing it is a separate change to a role several read paths depend on, not a line to slip   │
-- │ into an MFA migration.                                                                          │
-- │                                                                                                │
-- │ It is defensible as it stands: the column holds ciphertext under a key from the secret store,  │
-- │ which `app_platform_ro` has no access to, so reading the row yields nothing usable. Recorded   │
-- │ so the next person does not mistake the omission for an oversight.                              │
-- └────────────────────────────────────────────────────────────────────────────────────────────────┘

-- Finding the staff who have not yet enrolled — the operational query behind the mandate. Partial,
-- because the rows that matter are the NULLs and an index over the enrolled majority is wasted.
CREATE INDEX IF NOT EXISTS ix_users__mfa_not_enrolled
    ON users (id) WHERE mfa_enrolled_at IS NULL AND deleted_at IS NULL;
