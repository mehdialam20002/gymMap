/**
 * M-019 AC-1, AC-2, AC-4 · The IDENTITY tenancy class, asserted against a real PostgreSQL 16.
 *
 * ┌─ THIS SUITE ASSERTS AN ABSENCE, WHICH IS THE HARD KIND ─────────────────────────────────────┐
 * │ Every isolation suite since M-009 has asserted that a policy EXISTS. This one asserts that  │
 * │ five tables have none — and an absence is trivially satisfiable by looking in the wrong     │
 * │ place, so each assertion here also has a positive control that proves the query can see a   │
 * │ policy when there is one.                                                                    │
 * │                                                                                              │
 * │ The failure being guarded against runs in both directions:                                   │
 * │                                                                                              │
 * │   A policy ADDED to `users` — the /me/memberships bug of Schema.md §1.3. A member holding    │
 * │   memberships at three gyms sees an empty list, and it looks like data loss.                 │
 * │                                                                                              │
 * │   A policy ADDED to `user_roles` — every platform grant (tenant_id IS NULL) becomes          │
 * │   invisible to every session, and super-admins lose their own permissions.                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const CONTAINER = 'gymmap-postgres';
const DB = 'gymmap';

/** The five tables M-019 creates, and the class each belongs to (Schema.md §1.3). */
const IDENTITY_TABLES = ['users', 'user_roles'] as const;
const GLOBAL_TABLES = ['roles', 'permissions', 'role_permissions'] as const;
const ALL_FIVE = [...IDENTITY_TABLES, ...GLOBAL_TABLES];

interface Result {
  readonly ok: boolean;
  readonly out: string;
  readonly err: string;
}

function psql(sql: string): Result {
  try {
    const out = execFileSync(
      'docker',
      ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', DB, '-tA', '-v', 'ON_ERROR_STOP=1'],
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
  available = psql('SELECT 1;').ok;
  if (!available) {
    console.error(
      '\n  SKIPPING — no database. pnpm infra:up && pnpm --filter @gymmap/server db:deploy\n',
    );
  }
});

const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    fn();
  });

// ═══════════════════════════════════════════════════════════════════════════
// AC-1 — no RLS on any of the five.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-1 · all five tables exist', () => {
  const result = psql(
    `SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND relname IN (${ALL_FIVE.map((t) => `'${t}'`).join(',')})
      ORDER BY relname;`,
  );
  assert.deepEqual(result.out.split('\n').sort(), [...ALL_FIVE].sort());
});

it('AC-1 · not one of the five has an RLS policy', () => {
  const result = psql(
    `SELECT tablename || ' :: ' || policyname FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN (${ALL_FIVE.map((t) => `'${t}'`).join(',')})
      ORDER BY 1;`,
  );
  assert.equal(
    result.out,
    '',
    `an identity table acquired a policy:\n${result.out}\n\n` +
      'Schema.md §1.3 classes these IDENTITY and GLOBAL. A policy on `users` is the ' +
      '/me/memberships bug; a policy on `user_roles` hides every platform-role grant.',
  );
});

it('AC-1 · RLS is not even ENABLED on them', () => {
  // Distinct from "has no policy". `ENABLE ROW LEVEL SECURITY` with no policy denies EVERYTHING
  // to a non-owner — so this table would 0-row rather than error, and the symptom would be an
  // empty user list rather than a failure anybody investigates.
  const result = psql(
    `SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND relname IN (${ALL_FIVE.map((t) => `'${t}'`).join(',')})
        AND (c.relrowsecurity OR c.relforcerowsecurity)
      ORDER BY relname;`,
  );
  assert.equal(
    result.out,
    '',
    `RLS is enabled with no policy on: ${result.out}. That denies every row to every ` +
      'non-owner session, silently.',
  );
});

it('AC-1 · the positive control — the query DOES see policies where they exist', () => {
  // Without this, the three assertions above pass equally well against a typo in the table
  // name. `tenants` has exactly two policies and has since M-009.
  const result = psql(
    `SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenants';`,
  );
  assert.equal(result.out, '2', 'the policy query is looking at nothing');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-2 — `user_roles` is the one reviewed exception, and the list says so.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-2 · `user_roles` carries a tenant_id, which is what makes it an exception at all', () => {
  const result = psql(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'tenant_id';`,
  );
  assert.equal(result.out, 'tenant_id');
});

it('AC-2 · `users` has NO tenant_id — it is not an exception, it is out of scope', () => {
  // The distinction matters. `users` needs no entry in any allowlist because CI-01 never looks
  // at it; adding one would imply a decision nobody made.
  const result = psql(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'tenant_id';`,
  );
  assert.equal(result.out, '', '`users` grew a tenant_id — Schema.md §4.6 says it has none');
});

it('AC-2 · exactly ONE table in the whole schema has a tenant_id and no policy', () => {
  // This is PC2-IDENTITY expressed directly rather than through the coverage file, so a failure
  // here names the table even if somebody edited the .sql.
  const result = psql(
    `SELECT c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id'
                         AND a.attnum > 0 AND NOT a.attisdropped
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND NOT EXISTS (SELECT 1 FROM pg_policies p
                        WHERE p.schemaname = 'public' AND p.tablename = c.relname)
      ORDER BY c.relname;`,
  );
  assert.equal(
    result.out,
    'user_roles',
    'the set of policy-less tenant_id tables is no longer exactly {user_roles}. Whatever is ' +
      'listed here is readable across tenants by anything that can reach the database.',
  );
});

it('AC-2 · the reviewed exception carries its REASON in the committed list', () => {
  // "An unexplained entry in a CI allowlist fails review" — Schema.md §4.7. A test that only
  // checked the name would let the justification be deleted.
  const sql = readFileSync(
    resolve(repoRoot(), 'apps/server/test/isolation/rls-coverage.sql'),
    'utf8',
  );

  assert.match(sql, /'user_roles'/, '`user_roles` is not on the CI-01 exemption list');
  assert.match(sql, /THE ONE REVIEWED EXCEPTION/, 'the exception lost its heading');
  assert.match(
    sql,
    /NULL = <uuid>/,
    'the reason no longer explains WHY — that a policy makes every platform grant invisible',
  );
  assert.match(sql, /PC2-IDENTITY/, 'the counter-check is not referenced from the list');
});

/** Walks up to the workspace marker; the suite runs from either the root or `apps/server`. */
function repoRoot(): string {
  let dir = process.cwd();
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`could not locate the repository root from ${process.cwd()}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// AC-4 — the nullable tenant_id IS the discriminator.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-4 · a platform role row has tenant_id IS NULL, a tenant role row has one', () => {
  const result = psql(
    `SELECT r.scope, ur.tenant_id IS NULL AS platform_scoped, count(*)
       FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      GROUP BY 1, 2 ORDER BY 1, 2;`,
  );
  assert.ok(result.ok, result.err);

  for (const line of result.out.split('\n').filter(Boolean)) {
    const [scope, platformScoped] = line.split('|');
    const isPlatformScope = ['PUBLIC', 'SELF', 'PLATFORM'].includes(scope!);
    assert.equal(
      platformScoped,
      isPlatformScope ? 't' : 'f',
      `a ${scope} role is granted with tenant_id ${platformScoped === 't' ? 'NULL' : 'set'}. ` +
        'ERD.md §3.1: the nullable column IS the discriminator — a platform role has no tenant ' +
        'scope and a tenant role always does.',
    );
  }
});

it('AC-4 · `NULLS NOT DISTINCT` makes a duplicate platform grant impossible', () => {
  // THE defect this constraint exists to stop. PostgreSQL's DEFAULT treats two NULLs as
  // distinct, so a plain UNIQUE would accept `(alice, SUPER_ADMIN, NULL)` twice — and every
  // platform grant has a NULL tenant. Revoking one would leave the user still a super-admin,
  // from a row nobody was looking at.
  const probe = psql(
    `BEGIN;
     INSERT INTO user_roles (id, user_id, role_id, tenant_id)
     SELECT gen_random_uuid(), ur.user_id, ur.role_id, NULL
       FROM user_roles ur WHERE ur.tenant_id IS NULL LIMIT 1;
     ROLLBACK;`,
  );
  assert.equal(probe.ok, false, 'a duplicate platform-role grant was accepted');
  assert.match(probe.err, /uq_user_roles__user_role_tenant/);
});

it('AC-4 · the same role at TWO tenants is still permitted', () => {
  // The positive control for the constraint. NULLS NOT DISTINCT must not accidentally collapse
  // distinct tenants — an owner of two gyms holds GYM_OWNER twice, legitimately.
  const probe = psql(
    `BEGIN;
     INSERT INTO user_roles (id, user_id, role_id, tenant_id)
     SELECT gen_random_uuid(), ur.user_id, ur.role_id,
            '01912f00-0000-7000-8000-00000000000c'
       FROM user_roles ur
      WHERE ur.tenant_id = '01912f00-0000-7000-8000-00000000000a' LIMIT 1;
     ROLLBACK;`,
  );
  assert.ok(probe.ok, `the same role at a second tenant was refused: ${probe.err}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-5 — revocation is a timestamp.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-5 · no APPLICATION role holds DELETE on user_roles, so a grant cannot be erased', () => {
  // Scoped to the three application roles. `postgres` owns every table and therefore holds
  // everything implicitly — migrations run as an owner, and CI-02's "any role holds DELETE" is
  // about grantable privilege, not about ownership. Asserting over all grantees would make this
  // permanently red, and a permanently red gate is a deleted gate.
  const result = psql(
    `SELECT grantee || ':' || privilege_type FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'user_roles'
        AND grantee IN ('app_rw', 'app_append', 'app_platform_ro')
        AND privilege_type IN ('DELETE', 'TRUNCATE')
      ORDER BY 1;`,
  );
  assert.equal(
    result.out,
    '',
    `DELETE on user_roles is granted to: ${result.out}. AC-STAF-01.4 makes revocation a ` +
      'timestamp so "who could approve a payout in March" is answerable in November.',
  );
});

it('AC-5 · the same holds for `users`, which carries deleted_at (ADR-0024, CI-02)', () => {
  const result = psql(
    `SELECT grantee || ':' || privilege_type FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'users'
        AND grantee IN ('app_rw', 'app_append', 'app_platform_ro')
        AND privilege_type IN ('DELETE', 'TRUNCATE')
      ORDER BY 1;`,
  );
  assert.equal(result.out, '', `DELETE on users is granted to: ${result.out}`);
});

it('AC-5 · the positive control — the grant query DOES see the privileges that exist', () => {
  const result = psql(
    `SELECT privilege_type FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'user_roles' AND grantee = 'app_rw'
      ORDER BY privilege_type;`,
  );
  assert.deepEqual(result.out.split('\n'), ['INSERT', 'SELECT', 'UPDATE']);
});

it('AC-5 · revoked_at cannot precede granted_at', () => {
  const probe = psql(
    `BEGIN;
     UPDATE user_roles SET revoked_at = granted_at - interval '1 day'
      WHERE id = (SELECT id FROM user_roles LIMIT 1);
     ROLLBACK;`,
  );
  assert.equal(probe.ok, false, 'a grant was revoked before it was granted');
  assert.match(probe.err, /ck_user_roles__revoked_after_granted/);
});
