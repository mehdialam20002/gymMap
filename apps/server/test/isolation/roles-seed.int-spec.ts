/**
 * M-019 AC-3, AC-6, AC-8 · The seeded catalogue, checked against the database that holds it.
 *
 * ┌─ THE CODE ALREADY AGREES WITH THE PRD. THIS ASKS WHETHER THE DATABASE DOES ─────────────────┐
 * │ `rbac-matrix.spec.ts` compares `iam/permissions.ts` against `MASTER_PRD.md` §B3.2 — 504     │
 * │ cells, in memory. It says nothing about what was actually inserted.                          │
 * │                                                                                              │
 * │ A seed can be correct and unapplied, applied once against an older catalogue, or applied     │
 * │ twice. All three produce a green unit suite and a database that grants the wrong things,     │
 * │ so this suite reads the rows back and resolves every one to its key.                         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

import { SEED_ROLE_COUNTS, roleId } from '../../prisma/seed/roles.ts';
import { SEED_PRINCIPALS, SEED_USER_COUNTS, userId } from '../../prisma/seed/users.ts';
import { SEED_VERSION } from '../../prisma/seed/version.ts';
import {
  PERMISSION_KEYS,
  ROLE_DEFINITIONS,
  permissionsFor,
  rolePermissionPairs,
} from '../../src/iam/permissions.ts';
import { PLATFORM_SCOPES } from '../../src/iam/types/iam.types.ts';

const CONTAINER = 'gymmap-postgres';
const DB = 'gymmap';

function psql(sql: string): { ok: boolean; out: string; err: string } {
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

const lines = (out: string): string[] => out.split('\n').filter(Boolean);

let available = false;

before(() => {
  available = psql('SELECT 1;').ok;
  if (!available) console.error('\n  SKIPPING — no database.\n');
});

const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    fn();
  });

// ═══════════════════════════════════════════════════════════════════════════
// AC-6 — twelve roles, exactly.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-6 · exactly twelve roles are seeded, in §B3.1 order', () => {
  // `ORDER BY key` on an enum column sorts by DECLARATION order, not alphabetically — and
  // `platform_role_enum` was declared in §B3.1's order. So this compares the database against
  // the PRD's own sequence, which is a stronger check than a sorted comparison and costs
  // nothing. (It also means a role inserted into the middle of the enum would show up here.)
  const seeded = lines(psql('SELECT key FROM roles ORDER BY key;').out);
  assert.equal(seeded.length, 12, `${seeded.length} roles in the database, expected 12`);
  assert.deepEqual(
    seeded,
    ROLE_DEFINITIONS.map((r) => r.key),
    'the seeded roles differ from §B3.1 in membership or in order',
  );
});

it('AC-6 · a thirteenth role cannot be inserted, because the column is an enum', () => {
  // `roles.key` is `platform_role_enum`. A `text` column would let a row invent a role, and a
  // role that exists in the database but in no policy grants nothing while looking authoritative.
  const result = psql(
    `BEGIN; INSERT INTO roles (id, key, scope, description)
     VALUES (gen_random_uuid(), 'SUPER_DUPER_ADMIN', 'PLATFORM', 'nope'); ROLLBACK;`,
  );
  assert.equal(result.ok, false, 'a thirteenth role was accepted');
  assert.match(result.err, /platform_role_enum/);
});

it('AC-6 · every role has a scope from the closed five-value set', () => {
  const rows = lines(psql("SELECT key || '|' || scope FROM roles ORDER BY key;").out);
  const expected = new Map(ROLE_DEFINITIONS.map((r) => [r.key, r.scope]));
  for (const row of rows) {
    const [key, scope] = row.split('|');
    assert.equal(scope, expected.get(key as never), `${key} has scope ${scope}`);
  }

  const bad = psql(`BEGIN; UPDATE roles SET scope = 'GALAXY' WHERE key = 'MEMBER'; ROLLBACK;`);
  assert.equal(bad.ok, false);
  assert.match(bad.err, /ck_roles__scope/);
});

it('the role ids are the derived ones, so every fixture can name them', () => {
  for (const role of ROLE_DEFINITIONS) {
    const found = psql(`SELECT id FROM roles WHERE key = '${role.key}';`).out;
    assert.equal(found, roleId(role.key), `${role.key} has an unexpected id`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// The permission catalogue.
// ═══════════════════════════════════════════════════════════════════════════

it('every catalogue key is in the database, and nothing else is', () => {
  const seeded = lines(psql('SELECT key FROM permissions ORDER BY key;').out);
  assert.deepEqual(
    seeded,
    [...PERMISSION_KEYS].sort(),
    'the database and the §B3.2 catalogue disagree about which permissions exist',
  );
  assert.equal(seeded.length, SEED_ROLE_COUNTS.permissions);
});

it('`resource` and `action` agree with `key` on every row', () => {
  // Two spellings of one fact that can disagree is a matrix that lies — FR-RBAC-05's
  // effective-permissions screen reads the decomposed columns.
  const mismatched = psql(
    `SELECT key FROM permissions WHERE key NOT LIKE '%.' || resource || '.' || action;`,
  ).out;
  assert.equal(mismatched, '', `these rows have drifted: ${mismatched}`);
});

it('the key-shape CHECK refuses anything that is not three lowercase segments', () => {
  const result = psql(
    `BEGIN; INSERT INTO permissions (id, key, resource, action, description)
     VALUES (gen_random_uuid(), 'Plans.Plan.Read', 'Plan', 'Read', 'x'); ROLLBACK;`,
  );
  assert.equal(result.ok, false, 'a malformed permission key was accepted');
  assert.match(result.err, /ck_permissions__key_shape/);
});

it('the parts CHECK refuses a row whose resource does not match its key', () => {
  const result = psql(
    `BEGIN; UPDATE permissions SET resource = 'coupon' WHERE key = 'plans.plan.read'; ROLLBACK;`,
  );
  assert.equal(result.ok, false, 'a drifted resource was accepted');
  assert.match(result.err, /ck_permissions__key_matches_parts/);
});

// ═══════════════════════════════════════════════════════════════════════════
// role_permissions — every row resolvable, and the matrix reproduced.
// ═══════════════════════════════════════════════════════════════════════════

it('every role_permissions row resolves to a real role and a real permission', () => {
  const orphans = psql(
    `SELECT rp.id FROM role_permissions rp
      LEFT JOIN roles r ON r.id = rp.role_id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE r.id IS NULL OR p.id IS NULL;`,
  ).out;
  assert.equal(orphans, '', `unresolvable role_permissions rows: ${orphans}`);
});

it('the seeded composition reproduces §B3.2 exactly, role by role', () => {
  // The strongest assertion in the suite: for each of the twelve roles, the keys the DATABASE
  // grants are compared against what `permissionsFor()` derives from the matrix.
  for (const role of ROLE_DEFINITIONS) {
    const granted = lines(
      psql(
        `SELECT p.key FROM role_permissions rp
          JOIN roles r ON r.id = rp.role_id
          JOIN permissions p ON p.id = rp.permission_id
          WHERE r.key = '${role.key}' ORDER BY p.key;`,
      ).out,
    );
    assert.deepEqual(
      granted,
      [...permissionsFor(role.key)],
      `${role.key} holds a different permission set in the database than §B3.2 grants it`,
    );
  }
});

it('the total row count matches, so nothing was inserted twice', () => {
  const count = psql('SELECT count(*) FROM role_permissions;').out;
  assert.equal(count, String(SEED_ROLE_COUNTS.rolePermissions));
  assert.equal(count, String(rolePermissionPairs().length));
});

it('a (role, permission) pair cannot be inserted twice', () => {
  const result = psql(
    `BEGIN; INSERT INTO role_permissions (id, role_id, permission_id)
     SELECT gen_random_uuid(), role_id, permission_id FROM role_permissions LIMIT 1; ROLLBACK;`,
  );
  assert.equal(result.ok, false, 'a duplicate grant was accepted');
  assert.match(result.err, /uq_role_permissions__role_permission/);
});

it('deleting a role that still grants permissions is REFUSED, not cascaded', () => {
  // CASCADE would make a silent mass revocation a one-statement accident.
  const result = psql(`BEGIN; DELETE FROM roles WHERE key = 'MEMBER'; ROLLBACK;`);
  assert.equal(result.ok, false, 'a role in use was deleted');
  assert.match(result.err, /fk_role_permissions__roles/);
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-8 — the §6.6 principals.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-8 · all eleven §6.6 principals exist, with their fixed uuids', () => {
  for (const principal of SEED_PRINCIPALS) {
    const found = psql(`SELECT status FROM users WHERE id = '${userId(principal.handle)}';`).out;
    assert.equal(found, 'ACTIVE', `${principal.handle} is missing or not ACTIVE`);
  }
  // Scoped to the seed's own namespace rather than counting the whole table.
  //
  // "Exactly eleven users exist ANYWHERE" is not the property AC-8 is about, and asserting it
  // makes this suite fail for reasons that have nothing to do with the seed: a leftover row from
  // an interrupted run, a developer's own account, the demo dataset. Each of those sends whoever
  // is on call reading a seed assertion to diagnose something else entirely.
  //
  // What AC-8 actually claims is that the eleven §6.6 principals are present, correct and not
  // duplicated. That is what this counts.
  const total = psql(`SELECT count(*) FROM users WHERE email LIKE '%@seed.gymmap.test';`).out;
  assert.equal(total, String(SEED_USER_COUNTS.users));
});

it('AC-8 · each principal holds exactly the role §6.6 assigns them', () => {
  for (const principal of SEED_PRINCIPALS) {
    const rows = lines(
      psql(
        `SELECT r.key || '|' || coalesce(ur.tenant_id::text, 'NULL')
           FROM user_roles ur JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = '${userId(principal.handle)}' AND ur.revoked_at IS NULL;`,
      ).out,
    );
    assert.deepEqual(rows, [`${principal.role}|${principal.tenantId ?? 'NULL'}`], principal.handle);
  }
});

it('AC-8 · `member.dual` holds MEMBER with NO tenant scope — the /me case', () => {
  // Schema.md §1.3's most expensive mistake: class `users` as RLS and this member sees an empty
  // list at three gyms. The fixture only detects it because the grant is tenant-less.
  const row = psql(
    `SELECT ur.tenant_id IS NULL FROM user_roles ur
      WHERE ur.user_id = '${userId('member.dual')}';`,
  ).out;
  assert.equal(row, 't', 'member.dual is scoped to a tenant, so the /me case cannot be tested');
});

it('AC-8 · platform principals have NULL tenant_id, tenant principals have one (AC-4)', () => {
  for (const principal of SEED_PRINCIPALS) {
    const definition = ROLE_DEFINITIONS.find((r) => r.key === principal.role);
    assert.ok(definition, principal.role);
    const isPlatform = PLATFORM_SCOPES.includes(definition.scope);
    assert.equal(
      principal.tenantId === null,
      isPlatform,
      `${principal.handle} holds ${principal.role} (${definition.scope}) with the wrong scoping`,
    );
  }
  assert.equal(SEED_USER_COUNTS.platformGrants, 7);
  assert.equal(SEED_USER_COUNTS.tenantGrants, 4);
});

it('AC-8 · not one principal has a password hash', () => {
  // M-020 owns Argon2id and its recorded parameters (A-12). A seeded hash would either pre-empt
  // that decision or store something weaker, and both are worse than an account nobody can log
  // into — which is the honest state until M-020 lands.
  const withHash = psql(
    `SELECT count(*) FROM users WHERE password_hash IS NOT NULL AND email LIKE '%@seed.gymmap.test';`,
  ).out;
  assert.equal(withHash, '0', 'a seeded principal has a password hash');
});

it('re-running the seed is a no-op, not a duplicate', () => {
  // `ON CONFLICT (id) DO NOTHING` on derived ids. A developer running `db:seed` twice must not
  // get 24 roles, and CI applies the seed to a database that may already have it.
  const before = psql('SELECT count(*) FROM roles, permissions, role_permissions, users;').out;
  execFileSync('node', ['prisma/seed/index.ts', '--apply'], {
    cwd: serverRoot(),
    stdio: 'pipe',
  });
  const after = psql('SELECT count(*) FROM roles, permissions, role_permissions, users;').out;
  assert.equal(after, before, 're-seeding changed the row counts');
});

it('SEED_VERSION was bumped for this payload', () => {
  // 0.3 at M-029, which added the four India KYC checklists. The assertion is a literal rather
  // than a `>=` on purpose: the point is that changing the payload forces somebody to come here
  // and say so, and a comparison would let a payload change slip past under an old version.
  // `0.3` → `0.4` for `ADR-0047`: three new `§B3.2` rows and one amended, so the seed's
  // `permissions` and `role_permissions` payload differs from what `0.3` wrote.
  assert.equal(SEED_VERSION, '0.4');
  assert.ok(SEED_ROLE_COUNTS.capabilities === 45, 'the §B3.2 capability count changed');
});

/** `apps/server`, wherever the suite was invoked from. */
function serverRoot(): string {
  return process
    .cwd()
    .replace(/[\\/]$/, '')
    .endsWith('server')
    ? process.cwd()
    : `${process.cwd()}/apps/server`;
}
