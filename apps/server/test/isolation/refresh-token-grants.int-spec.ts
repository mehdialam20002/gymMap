/**
 * M-022 AC-3 · `refresh_tokens` is **G-COMPLETE** — Deviation `D-04`, `Schema.md` §4.8.
 *
 * ┌─ THE ONE THING THIS TABLE MUST NOT ALLOW ───────────────────────────────────────────────────┐
 * │ Reuse detection is a single inference: `used_at IS NOT NULL` means this generation was       │
 * │ already spent, so a second presentation of it means two parties hold the same token.         │
 * │                                                                                              │
 * │ That inference is only as strong as the impossibility of un-spending a row. An `app_rw` that │
 * │ could write `used_at = NULL`, or move `generation`, or repoint `token_hash`, could erase the │
 * │ evidence of its own replay — and the detection would report nothing while the theft ran.     │
 * │ Which is exactly why the grant is column-scoped rather than a plain `UPDATE`.                │
 * │                                                                                              │
 * │ So: `SELECT`, `INSERT`, and `UPDATE` on `used_at` and `superseded_by_id` ONLY. Everything    │
 * │ else — including `DELETE`, which would remove the chain entirely — must be refused BY THE    │
 * │ DATABASE, because an application-layer rule is bypassed by the next repository that forgets  │
 * │ it exists.                                                                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ CONNECTS AS `gymmap_app`, NEVER AS `postgres` ─────────────────────────────────────────────┐
 * │ `postgres` owns every table and holds every privilege implicitly, so a grant test run as     │
 * │ `postgres` asserts nothing — every statement succeeds, including the ones that must not.     │
 * │ M-012 shipped a whole isolation suite against a superuser before noticing. Same rule here.   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const CONTAINER = 'gymmap-postgres';
const DB = 'gymmap';

interface Result {
  readonly ok: boolean;
  readonly out: string;
  readonly err: string;
}

function run(args: string[], sql: string, env: Record<string, string> = {}): Result {
  const envArgs = Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]);
  try {
    const out = execFileSync(
      'docker',
      ['exec', '-i', ...envArgs, CONTAINER, 'psql', ...args, '-tA', '-v', 'ON_ERROR_STOP=1'],
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return { ok: true, out: out.trim(), err: '' };
  } catch (error) {
    const shell = error as { stdout?: string; stderr?: string };
    return { ok: false, out: (shell.stdout ?? '').trim(), err: (shell.stderr ?? '').trim() };
  }
}

/** As `postgres` — only ever to read the privilege catalogue. */
const psql = (sql: string): Result => run(['-U', 'postgres', '-d', DB], sql);

/** As the login role every HTTP request actually runs as. */
const asApp = (sql: string): Result =>
  run(['-U', 'gymmap_app', '-d', DB], sql, { PGPASSWORD: 'gymmap_local_dev' });

const available = psql('SELECT 1;').ok;

const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    fn();
  });

// ═══════════════════════════════════════════════════════════════════════════
// The catalogue — what was actually granted, not what the migration meant.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-3 · `app_rw` holds column-scoped UPDATE on exactly two columns', () => {
  // Read from `information_schema` rather than from the migration text. The question is what the
  // running database enforces; a migration that was edited after being applied says nothing.
  const granted = psql(`
    SELECT string_agg(column_name, ',' ORDER BY column_name)
      FROM information_schema.column_privileges
     WHERE table_name = 'refresh_tokens'
       AND grantee = 'app_rw'
       AND privilege_type = 'UPDATE';`);

  assert.ok(granted.ok, granted.err);
  assert.equal(
    granted.out,
    'superseded_by_id,used_at',
    'the UPDATE grant covers a column it should not — see D-04',
  );
});

it('AC-3 · `app_rw` holds no table-wide UPDATE, and no DELETE at all', () => {
  const held = psql(`
    SELECT string_agg(DISTINCT privilege_type, ',' ORDER BY privilege_type)
      FROM information_schema.table_privileges
     WHERE table_name = 'refresh_tokens' AND grantee = 'app_rw';`);

  assert.ok(held.ok, held.err);
  // INSERT and SELECT only. A table-level UPDATE row here would silently supersede the
  // column-scoped grant above and make every assertion below pass for the wrong reason.
  assert.equal(held.out, 'INSERT,SELECT');
});

// ═══════════════════════════════════════════════════════════════════════════
// The refusals. A grant is proved by what it stops.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Every statement runs inside an aborted transaction.
 *
 * A privilege check happens at planning time, so `ROLLBACK` still proves the refusal — and the
 * statements that WOULD succeed must not be allowed to leave rows behind for the suites that run
 * after this one.
 */
const probe = (sql: string): Result => asApp(`BEGIN;\n${sql}\nROLLBACK;`);

const FORBIDDEN_UPDATES: ReadonlyArray<[string, string, string]> = [
  [
    'token_hash',
    `UPDATE refresh_tokens SET token_hash = repeat('a', 64);`,
    'repointing the hash lets a stolen token be re-pointed at a live row',
  ],
  [
    'generation',
    `UPDATE refresh_tokens SET generation = 99;`,
    'moving a generation breaks the ordering the whole chain is inferred from',
  ],
  [
    'session_id',
    `UPDATE refresh_tokens SET session_id = gen_random_uuid();`,
    'moving a token between families defeats family-wide revocation',
  ],
  [
    'expires_at',
    `UPDATE refresh_tokens SET expires_at = now() + interval '10 years';`,
    'a 30-day credential must not be extendable by the request path that holds it',
  ],
];

for (const [column, sql, why] of FORBIDDEN_UPDATES) {
  it(`NEGATIVE: \`app_rw\` cannot UPDATE ${column} — ${why}`, () => {
    const result = probe(sql);
    assert.equal(result.ok, false, `the update succeeded; ${why}`);
    assert.match(result.err, /permission denied/i, result.err);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Write-once — the half a column-scoped GRANT cannot express.
// ═══════════════════════════════════════════════════════════════════════════

const SESSION_ID = '11111111-1111-4111-8111-11111111aaaa';
const TOKEN_ID = '11111111-1111-4111-8111-111111111111';

/**
 * A session and one SPENT generation on it, inside the caller's transaction.
 *
 * Built here rather than reused from whatever the database happens to hold: the assertion is
 * about a SECOND write to a row that already has one, so the row's history is the whole subject.
 * An earlier draft selected an existing session with `LIMIT 1` and silently inserted nothing when
 * the table was empty — every negative assertion then "passed" against zero rows.
 */
const SPEND_ONE = `
  INSERT INTO auth_sessions (id, user_id, family_id, absolute_expires_at)
  SELECT '${SESSION_ID}', u.id, gen_random_uuid(), now() + interval '30 days'
    FROM users u ORDER BY u.id LIMIT 1;

  INSERT INTO refresh_tokens (id, session_id, token_hash, generation, expires_at, used_at)
  VALUES ('${TOKEN_ID}', '${SESSION_ID}', repeat('c', 64), 998,
          now() + interval '30 days', now());`;

it('NEGATIVE: `used_at` cannot be cleared — the grant allows the column, the trigger does not', () => {
  // The gap this closes: `GRANT UPDATE (used_at, ...)` restricts WHICH column may be written and
  // says nothing about direction or how many times. Reuse detection is the single inference
  // "used_at IS NOT NULL means already spent" — so a role that can null it can silence the alarm
  // for the theft it is committing. This assertion failed before the write-once trigger existed.
  const result = probe(`${SPEND_ONE}
    UPDATE refresh_tokens SET used_at = NULL
     WHERE id = '${TOKEN_ID}';`);

  assert.equal(result.ok, false, 'a spent generation was un-spent');
  assert.match(result.err, /used_at is write-once/i, result.err);
});

it('NEGATIVE: `used_at` cannot be MOVED to a different timestamp either', () => {
  // Not just nulling. Pushing `used_at` forward would slide the TR-28 grace window along with it
  // and keep a stolen generation replayable indefinitely, ten seconds at a time.
  const result = probe(`${SPEND_ONE}
    UPDATE refresh_tokens SET used_at = now() + interval '1 hour'
     WHERE id = '${TOKEN_ID}';`);

  assert.equal(result.ok, false, 'a spent timestamp was moved');
  assert.match(result.err, /used_at is write-once/i, result.err);
});

it('NEGATIVE: `superseded_by_id` cannot be repointed once the chain is written', () => {
  // A real successor row, because `superseded_by_id` is a self-FK — and not the row itself,
  // because `ck_refresh_tokens__no_self_supersede` already refuses a one-element cycle.
  const successor = '11111111-1111-4111-8111-111111111222';
  const result = probe(`${SPEND_ONE}
    INSERT INTO refresh_tokens (id, session_id, token_hash, generation, expires_at)
    VALUES ('${successor}', '${SESSION_ID}', repeat('e', 64), 999, now() + interval '30 days');

    UPDATE refresh_tokens SET superseded_by_id = '${successor}' WHERE id = '${TOKEN_ID}';
    UPDATE refresh_tokens SET superseded_by_id = NULL          WHERE id = '${TOKEN_ID}';`);

  assert.equal(result.ok, false, 'the chain was repointed');
  assert.match(result.err, /superseded_by_id is write-once/i, result.err);
});

it('an UNSPENT generation still accepts its one completion — rotation is not broken', () => {
  // The trigger refuses a SECOND write, not the first. Getting this backwards would make every
  // rotation in the platform fail, which is a louder failure than the one being prevented but
  // no less real.
  const result = probe(`
    INSERT INTO auth_sessions (id, user_id, family_id, absolute_expires_at)
    SELECT '22222222-2222-4222-8222-22222222aaaa', u.id, gen_random_uuid(),
           now() + interval '30 days'
      FROM users u ORDER BY u.id LIMIT 1;

    INSERT INTO refresh_tokens (id, session_id, token_hash, generation, expires_at)
    VALUES ('22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-22222222aaaa',
            repeat('d', 64), 997, now() + interval '30 days');

    UPDATE refresh_tokens SET used_at = now(), superseded_by_id = NULL
     WHERE id = '22222222-2222-4222-8222-222222222222';`);

  assert.ok(result.ok, `the first completion was refused — rotation cannot work: ${result.err}`);
});

it('NEGATIVE: `app_rw` cannot DELETE a refresh token', () => {
  // The chain IS the audit trail. A row that can be deleted is a replay that can be denied.
  const result = probe(`DELETE FROM refresh_tokens;`);
  assert.equal(result.ok, false, 'the delete succeeded — the reuse chain is erasable');
  assert.match(result.err, /permission denied/i, result.err);
});

it('NEGATIVE: `app_rw` cannot TRUNCATE the table', () => {
  // TRUNCATE is a separate privilege from DELETE, and it is the faster way to lose the same data.
  const result = probe(`TRUNCATE refresh_tokens CASCADE;`);
  assert.equal(result.ok, false, 'the truncate succeeded');
  assert.match(result.err, /permission denied|must be owner/i, result.err);
});

// ═══════════════════════════════════════════════════════════════════════════
// The permissions. A grant that refuses everything is also broken.
// ═══════════════════════════════════════════════════════════════════════════

it('`app_rw` CAN read, and CAN spend a generation — rotation still works', () => {
  // The other half of the assertion. Five refusals above prove nothing if the grant is so tight
  // that the application cannot rotate at all; that failure would surface as every member being
  // logged out after fifteen minutes, which is worse than the leak this grant prevents.
  const select = probe(`SELECT count(*) FROM refresh_tokens;`);
  assert.ok(select.ok, `app_rw cannot read its own table: ${select.err}`);

  // Scoped to UNSPENT rows. A blanket update would re-write rows that are already spent and be
  // refused by the write-once trigger below, which is a different assertion than this one.
  const spend = probe(
    `UPDATE refresh_tokens SET used_at = now(), superseded_by_id = NULL WHERE used_at IS NULL;`,
  );
  assert.ok(spend.ok, `app_rw cannot spend a generation — rotation is impossible: ${spend.err}`);
});

it('`app_rw` CAN insert the next generation', () => {
  const insert = probe(`
    INSERT INTO refresh_tokens (id, session_id, token_hash, generation, expires_at)
    SELECT gen_random_uuid(), s.id, repeat('b', 64), 999, now() + interval '30 days'
      FROM auth_sessions s LIMIT 1;`);

  // An empty `auth_sessions` makes the INSERT a no-op rather than a failure, which still proves
  // the privilege — the planner checks it either way.
  assert.ok(insert.ok, `app_rw cannot mint a new generation: ${insert.err}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// IDENTITY class — AC-8, PC2.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-8 · neither table carries RLS, and neither has a `tenant_id`', () => {
  // These are IDENTITY-class tables: a session belongs to a PERSON, who may hold roles in several
  // tenants or none. Adding a `tenant_id` here would force a session to pick one, and the first
  // consequence would be a member of two gyms being signed out of one by logging into the other.
  const shape = psql(`
    SELECT c.relname || ':' || c.relrowsecurity::text
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname IN ('auth_sessions','refresh_tokens')
     ORDER BY c.relname;`);

  assert.ok(shape.ok, shape.err);
  assert.equal(
    shape.out
      .split('\n')
      .sort((a, b) => a.localeCompare(b))
      .join('|'),
    'auth_sessions:false|refresh_tokens:false',
  );

  const tenantColumns = psql(`
    SELECT count(*) FROM information_schema.columns
     WHERE table_name IN ('auth_sessions','refresh_tokens') AND column_name = 'tenant_id';`);
  assert.equal(tenantColumns.out, '0', 'an IDENTITY-class table grew a tenant_id');
});
