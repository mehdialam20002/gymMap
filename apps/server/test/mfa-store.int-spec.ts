/**
 * `M-024` · `users` MFA write semantics on real PostgreSQL — `FR-AUTH-07`, `Security.md` §2.8.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * TWO THINGS NO UNIT TEST CAN CHECK
 *
 *   1  `ck_users__mfa_enabled_has_timestamp` — the flag and its timestamp cannot disagree. A
 *      doubled store has no constraints, so a partial write passes every unit test in the suite.
 *   2  `recordAcceptedStep` must never move the high-water mark BACKWARDS. The guard lives in the
 *      `WHERE` clause, so only the database can be asked whether it works.
 *
 * The second is the one that matters. Two requests verifying at once both read the same
 * `mfa_last_step`, and whichever UPDATE lands second wins — if that is the older step, the newer
 * code becomes replayable. A read-then-compare in JavaScript cannot fix it; the comparison has to
 * be part of the write, and this file is where that is proved.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const CONTAINER = 'gymmap-postgres';
const DB = 'gymmap';

function psql(statement: string): string {
  return execFileSync(
    'docker',
    ['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', DB, '-tAc', statement],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

const one = (statement: string): string =>
  psql(statement)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)[0] ?? '';

/** The error text, or `''` when the statement succeeded. */
function failure(statement: string): string {
  try {
    psql(statement);
    return '';
  } catch (error) {
    const shell = error as { stderr?: Buffer | string; message?: string };
    return String(shell.stderr ?? shell.message ?? error);
  }
}

const ANA = '0192de00-2024-7000-8000-0000000000f1';
let available = false;

function cleanup(): void {
  psql(`DELETE FROM users WHERE id = '${ANA}'`);
}

before(() => {
  try {
    one('SELECT 1');
    available = true;
  } catch {
    available = false;
    console.error(
      '\n  ┌────────────────────────────────────────────────────────────────────────┐\n' +
        '  │ SKIPPING the M-024 MFA assertions — no database reachable.             │\n' +
        '  │   pnpm infra:up && pnpm --filter @gymmap/server db:deploy              │\n' +
        '  │ These are the ONLY assertions that prove the step counter cannot move  │\n' +
        '  │ backwards, and that the flag cannot disagree with its timestamp.       │\n' +
        '  └────────────────────────────────────────────────────────────────────────┘\n',
    );
    return;
  }

  cleanup();
  psql(`INSERT INTO users (id, email, status) VALUES ('${ANA}', 'ana.m024@example.test', 'ACTIVE')`);
});

after(() => {
  if (available) cleanup();
});

const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    fn();
  });

/** Exactly the predicate `MfaPrismaRepository.recordAcceptedStep` puts in its WHERE. */
function recordAcceptedStep(step: number): void {
  psql(
    `UPDATE users SET mfa_last_step = ${String(step)}
      WHERE id = '${ANA}' AND (mfa_last_step IS NULL OR mfa_last_step < ${String(step)})`,
  );
}

const lastStep = (): string => one(`SELECT coalesce(mfa_last_step::text,'null') FROM users WHERE id = '${ANA}'`);

// ═══════════════════════════════════════════════════════════════════════════
// The CHECK
// ═══════════════════════════════════════════════════════════════════════════

it('the flag cannot be set without its timestamp', () => {
  const error = failure(`UPDATE users SET mfa_enabled = true WHERE id = '${ANA}'`);
  assert.match(error, /ck_users__mfa_enabled_has_timestamp/, `unexpected: ${error}`);
});

it('the timestamp cannot be set without the flag', () => {
  // The other direction, which is the one a "clear" that forgets the flag would produce.
  const error = failure(`UPDATE users SET mfa_enrolled_at = now() WHERE id = '${ANA}'`);
  assert.match(error, /ck_users__mfa_enabled_has_timestamp/, `unexpected: ${error}`);
});

it('activating both together is accepted', () => {
  psql(`UPDATE users SET mfa_enabled = true, mfa_enrolled_at = now() WHERE id = '${ANA}'`);
  assert.equal(one(`SELECT mfa_enabled FROM users WHERE id = '${ANA}'`), 't');

  // …and clearing both together is too. An implementation that nulled the secret and left the flag
  // on would leave an account demanding a factor it no longer holds.
  psql(
    `UPDATE users SET mfa_enabled = false, mfa_enrolled_at = NULL, mfa_secret_encrypted = NULL,
       mfa_recovery_codes_hashed = '{}', mfa_last_step = NULL WHERE id = '${ANA}'`,
  );
  assert.equal(one(`SELECT mfa_enabled FROM users WHERE id = '${ANA}'`), 'f');
});

// ═══════════════════════════════════════════════════════════════════════════
// The high-water mark
// ═══════════════════════════════════════════════════════════════════════════

it('§2.8 — the step counter advances', () => {
  psql(`UPDATE users SET mfa_last_step = NULL WHERE id = '${ANA}'`);

  recordAcceptedStep(100);
  assert.equal(lastStep(), '100');

  recordAcceptedStep(101);
  assert.equal(lastStep(), '101');
});

it('§2.8 — the step counter NEVER moves backwards, even when told to', () => {
  // ┌─ THE CONCURRENCY BUG THIS IS THE ONLY GUARD AGAINST ───────────────────────────────────────┐
  // │ Two requests verify at once and both read `lastStep = 100`. One accepts step 101, the other │
  // │ accepts 100 from the drift window. Whichever UPDATE lands second wins — and if that is 100, │
  // │ the code for 101 is replayable. The predicate in the WHERE is what makes the loser a no-op. │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  psql(`UPDATE users SET mfa_last_step = 101 WHERE id = '${ANA}'`);

  recordAcceptedStep(100);
  assert.equal(lastStep(), '101', 'an older step overwrote a newer one');

  recordAcceptedStep(50);
  assert.equal(lastStep(), '101');
});

it('re-recording the SAME step is a no-op, not an advance', () => {
  // `<` rather than `<=`. Equal means the step was already accepted, which is a replay — and
  // writing it again would make the row look freshly updated for an attempt that was refused.
  psql(`UPDATE users SET mfa_last_step = 200 WHERE id = '${ANA}'`);

  recordAcceptedStep(200);
  assert.equal(lastStep(), '200');
});

it('the first step is accepted when the counter is NULL', () => {
  // The `IS NULL` branch. Without it a brand-new enrolment could never record its first step, and
  // every code would be treated as a replay from the very beginning.
  psql(`UPDATE users SET mfa_last_step = NULL WHERE id = '${ANA}'`);

  recordAcceptedStep(1);
  assert.equal(lastStep(), '1');
});

// ═══════════════════════════════════════════════════════════════════════════
// Grants — the failure that only appears at runtime
// ═══════════════════════════════════════════════════════════════════════════

it('app_rw can write every MFA column', () => {
  // `users` grants per COLUMN, so a column added without a grant is unwritable and the failure
  // arrives as `permission denied for table users` from a route that looks correct.
  const missing = psql(
    `SELECT c.column_name FROM information_schema.columns c
      WHERE c.table_name = 'users' AND c.column_name LIKE 'mfa%'
        AND NOT EXISTS (
          SELECT 1 FROM information_schema.column_privileges p
           WHERE p.table_name = 'users' AND p.grantee = 'app_rw'
             AND p.column_name = c.column_name AND p.privilege_type = 'UPDATE')`,
  )
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  assert.deepEqual(missing, [], `app_rw cannot UPDATE: ${missing.join(', ')}`);
});
