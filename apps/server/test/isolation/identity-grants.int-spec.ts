/**
 * M-019 AC-3 · The G-REF grant class, proved by being refused.
 *
 * ┌─ CONNECTS AS `gymmap_app`, NOT AS `postgres` ───────────────────────────────────────────────┐
 * │ `postgres` is a superuser and the owner of every table, so it holds every privilege         │
 * │ implicitly. A grant test run as `postgres` asserts nothing at all — every statement          │
 * │ succeeds, including the ones that must not.                                                  │
 * │                                                                                              │
 * │ M-012 learned this the expensive way: its first isolation suite used the postgres URL and    │
 * │ every policy assertion passed against a database with no enforcement. So this file uses the │
 * │ application login role for the refusals, and `postgres` only to read the grant catalogue.    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT G-REF ACTUALLY MEANS HERE ────────────────────────────────────────────────────────────┐
 * │ `Constraints.md` §9: `SELECT` only on the request path; the write path is `admin/`, gated by │
 * │ permission AND a written reason (`FR-ADMN-02`), arriving with M-116. So `app_rw` — the role  │
 * │ every HTTP request runs as — must be able to READ the catalogue and must not be able to      │
 * │ change it. A request that could rewrite `role_permissions` could grant itself anything.      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const CONTAINER = 'gymmap-postgres';
const DB = 'gymmap';

/** The three G-REF tables M-019 creates. */
const REFERENCE_TABLES = ['roles', 'permissions', 'role_permissions'] as const;

interface Result {
  readonly ok: boolean;
  readonly out: string;
  readonly err: string;
}

/** As `postgres` — for reading the catalogue, never for asserting a refusal. */
function psql(sql: string): Result {
  return run(['-U', 'postgres', '-d', DB], sql);
}

/**
 * As `gymmap_app`, the login role the application actually uses. Member of `app_rw` and nothing
 * else — the memberships are EXCLUSIVE because RLS policies are permissive and OR'd together.
 */
function asApp(sql: string): Result {
  return run(['-U', 'gymmap_app', '-d', DB], sql, { PGPASSWORD: 'gymmap_local_dev' });
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
    const e = error as { stdout?: string; stderr?: string };
    return { ok: false, out: (e.stdout ?? '').trim(), err: (e.stderr ?? '').trim() };
  }
}

let available = false;

before(() => {
  const reachable = psql('SELECT 1;').ok;
  const appReachable = asApp('SELECT 1;').ok;
  available = reachable && appReachable;
  if (!available) {
    console.error(
      '\n  SKIPPING — no database, or gymmap_app has no password. Run:\n' +
        '    pnpm --filter @gymmap/server db:setup\n',
    );
  }
});

const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    fn();
  });

// ═══════════════════════════════════════════════════════════════════════════
// The control: the connection is genuinely NOT a superuser.
// ═══════════════════════════════════════════════════════════════════════════

it('the app connection is not a superuser and does not bypass RLS', () => {
  // Without this, every refusal below could be failing for the wrong reason — or worse,
  // succeeding for the wrong reason.
  const result = asApp(
    `SELECT rolsuper::text || '|' || rolbypassrls::text FROM pg_roles WHERE rolname = current_user;`,
  );
  assert.equal(result.out, 'false|false', 'gymmap_app is a superuser or bypasses RLS');
});

it('the app connection reaches app_rw and nothing else', () => {
  const result = asApp(
    `SELECT string_agg(b.rolname, ',' ORDER BY b.rolname)
       FROM pg_auth_members m
       JOIN pg_roles b ON b.oid = m.roleid
       JOIN pg_roles r ON r.oid = m.member
      WHERE r.rolname = current_user;`,
  );
  assert.equal(
    result.out,
    'app_rw',
    'gymmap_app holds more than app_rw. Memberships are EXCLUSIVE — RLS policies are ' +
      'permissive and OR together, so a role in two groups gets the union of both.',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-3 — G-REF: read yes, write no.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-3 · app_rw CAN read all three reference tables', () => {
  // The positive half. A refusal test alone would pass against a table the role cannot reach at
  // all, which would break every authorisation check in the platform.
  for (const table of REFERENCE_TABLES) {
    const result = asApp(`SELECT count(*) FROM ${table};`);
    assert.ok(result.ok, `app_rw cannot read ${table}: ${result.err}`);
    assert.ok(Number(result.out) > 0, `${table} read back as empty`);
  }
});

it('AC-3 · app_rw CANNOT insert into roles', () => {
  const result = asApp(
    `INSERT INTO roles (id, key, scope, description)
     VALUES (gen_random_uuid(), 'MODERATOR', 'PLATFORM', 'smuggled');`,
  );
  assert.equal(result.ok, false, 'app_rw inserted a role');
  assert.match(result.err, /permission denied/i);
});

it('AC-3 · app_rw CANNOT insert into permissions', () => {
  const result = asApp(
    `INSERT INTO permissions (id, key, resource, action, description)
     VALUES (gen_random_uuid(), 'admin.everything.write', 'everything', 'write', 'x');`,
  );
  assert.equal(result.ok, false, 'app_rw inserted a permission');
  assert.match(result.err, /permission denied/i);
});

it('AC-3 · app_rw CANNOT insert into role_permissions — the privilege-escalation path', () => {
  // The one that matters most. A request path that can write this table can grant its own
  // principal `admin.tenant_suspension.create` and then use it, inside one request.
  const result = asApp(
    `INSERT INTO role_permissions (id, role_id, permission_id)
     SELECT gen_random_uuid(), r.id, p.id
       FROM roles r, permissions p
      WHERE r.key = 'MEMBER' AND p.key = 'admin.tenant_suspension.create';`,
  );
  assert.equal(result.ok, false, 'app_rw granted a permission to a role');
  assert.match(result.err, /permission denied/i);
});

it('AC-3 · app_rw CANNOT update or delete any of the three', () => {
  for (const table of REFERENCE_TABLES) {
    const updated = asApp(`UPDATE ${table} SET updated_at = now();`);
    assert.equal(updated.ok, false, `app_rw updated ${table}`);
    assert.match(updated.err, /permission denied/i);

    const deleted = asApp(`DELETE FROM ${table};`);
    assert.equal(deleted.ok, false, `app_rw deleted from ${table}`);
    assert.match(deleted.err, /permission denied/i);
  }
});

it('AC-3 · the grant catalogue says SELECT and only SELECT', () => {
  // Belt to the braces above: the refusals prove today's behaviour, this proves the intent is
  // recorded where CI-02 can read it.
  for (const table of REFERENCE_TABLES) {
    const result = psql(
      `SELECT string_agg(privilege_type, ',' ORDER BY privilege_type)
         FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND table_name = '${table}' AND grantee = 'app_rw';`,
    );
    assert.equal(result.out, 'SELECT', `app_rw holds ${result.out} on ${table}, expected SELECT`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// The identity tables are G-CRUD, which is a different answer.
// ═══════════════════════════════════════════════════════════════════════════

it('app_rw CAN write `users` and `user_roles` — they are G-CRUD, not G-REF', () => {
  // The contrast is the point. If every table in this milestone refused writes, the tests above
  // would prove only that the role is broken.
  const result = asApp(
    `BEGIN;
     INSERT INTO users (id, email) VALUES (gen_random_uuid(), 'grant.probe@example.com');
     ROLLBACK;`,
  );
  assert.ok(result.ok, `app_rw cannot insert a user: ${result.err}`);
});

it('app_rw CANNOT delete a user — `users` carries deleted_at (ADR-0024, CI-02)', () => {
  const result = asApp(`DELETE FROM users WHERE email = 'member.solo@seed.gymmap.test';`);
  assert.equal(result.ok, false, 'app_rw hard-deleted a user');
  assert.match(result.err, /permission denied/i);
});

it('app_rw CANNOT delete a role grant — AC-STAF-01.4 makes revocation a timestamp', () => {
  const result = asApp(`DELETE FROM user_roles;`);
  assert.equal(result.ok, false, 'app_rw deleted role grants');
  assert.match(result.err, /permission denied/i);
});

it('app_rw CAN revoke by timestamp, which is the supported path', () => {
  const result = asApp(
    `BEGIN; UPDATE user_roles SET revoked_at = now() WHERE revoked_at IS NULL; ROLLBACK;`,
  );
  assert.ok(result.ok, `app_rw cannot revoke a grant: ${result.err}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// The platform read-only role.
// ═══════════════════════════════════════════════════════════════════════════

it('app_platform_ro holds SELECT on all five and write on none', () => {
  for (const table of [...REFERENCE_TABLES, 'users', 'user_roles']) {
    const result = psql(
      `SELECT string_agg(privilege_type, ',' ORDER BY privilege_type)
         FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND table_name = '${table}'
          AND grantee = 'app_platform_ro';`,
    );
    assert.equal(result.out, 'SELECT', `app_platform_ro holds ${result.out} on ${table}`);
  }
});

it('app_append holds NOTHING on any of the five', () => {
  // `app_append` exists for the audit log. Reaching identity from it would give the audit writer
  // a path to read every user in the platform.
  const result = psql(
    `SELECT table_name || ':' || privilege_type FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee = 'app_append'
        AND table_name IN ('roles','permissions','role_permissions','users','user_roles')
      ORDER BY 1;`,
  );
  assert.equal(result.out, '', `app_append holds: ${result.out}`);
});

it('the seed is intact after every probe', () => {
  assert.equal(psql('SELECT count(*) FROM roles;').out, '12');
  assert.equal(psql('SELECT count(*) FROM users;').out, '11');
  assert.equal(psql('SELECT count(*) FROM user_roles WHERE revoked_at IS NULL;').out, '11');
});
