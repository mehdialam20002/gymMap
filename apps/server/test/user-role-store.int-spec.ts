/**
 * `M-023` · `user_roles` write semantics on real PostgreSQL — `FR-RBAC-07`, `AC-STAF-01.4`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THIS FILE EXISTS BECAUSE 403 GREEN UNIT TESTS MISSED A CONSTRAINT VIOLATION
 *
 * `UserRolePrismaRepository.replaceRole()` shipped revoking the live rows and then INSERTING. That
 * is correct exactly once per `(user_id, role_id, tenant_id)` and then throws, because
 * `uq_user_roles__user_role_tenant` is `UNIQUE NULLS NOT DISTINCT` on that triple and `revoked_at`
 * IS NOT ONE OF ITS COLUMNS:
 *
 *   owner → manager    revokes (ana, owner, t1), inserts (ana, manager, t1)     fine
 *   manager → owner    revokes (ana, manager, t1), inserts (ana, owner, t1)     duplicate key
 *
 * Changing somebody's role back is an ordinary administrative act. It would have surfaced as a raw
 * `P2002` — a 500 on a valid request — and no unit test can catch it, because the rule being broken
 * lives in the database and the double in a unit test has no constraints at all.
 *
 * So these assertions run against the real schema, and the first one is the exact cycle that broke.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ SQL RATHER THAN THE REPOSITORY CLASS, DELIBERATELY ────────────────────────────────────────┐
 * │ What is under test is the CONTRACT BETWEEN the write sequence and the schema. Driving the     │
 * │ Nest provider would need the DI graph, the ALS tenant context and a seeded catalogue, and     │
 * │ every one of those is a way for the test to fail for a reason that is not the constraint.     │
 * │                                                                                              │
 * │ These statements are the sequence the repository issues, in the same order, against the same  │
 * │ table. If the schema ever stops permitting it, this fails — which is the whole job.           │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
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

function sql(statement: string): string[] {
  return psql(statement)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

const one = (statement: string): string => sql(statement)[0] ?? '';

/** The error text, or `''` when the statement succeeded. Counter-examples need the message. */
function failure(statement: string): string {
  try {
    psql(statement);
    return '';
  } catch (error) {
    const shell = error as { stderr?: Buffer | string; message?: string };
    return String(shell.stderr ?? shell.message ?? error);
  }
}

let available = false;

/*
 * Fixture ids are fixed and namespaced into an obviously-synthetic uuid range, so a row left behind
 * by a crashed run is recognisable and is cleaned by the `before` below rather than accumulating.
 */
const TENANT = '0192de00-1023-7000-8000-0000000000a1';
const OTHER_TENANT = '0192de00-1023-7000-8000-0000000000a2';
const ANA = '0192de00-1023-7000-8000-0000000000e1';

/** Deletes only this file's fixtures. Never truncates — another suite may be running. */
function cleanup(): void {
  psql(`DELETE FROM user_roles WHERE user_id = '${ANA}'`);
  psql(`DELETE FROM users WHERE id = '${ANA}'`);
  psql(`DELETE FROM tenants WHERE id IN ('${TENANT}', '${OTHER_TENANT}')`);
}

before(() => {
  try {
    one('SELECT 1');
    available = true;
  } catch {
    available = false;
    console.error(
      '\n  ┌────────────────────────────────────────────────────────────────────────┐\n' +
        '  │ SKIPPING the M-023 user_roles assertions — no database reachable.      │\n' +
        '  │                                                                        │\n' +
        '  │   pnpm infra:up                                                        │\n' +
        '  │   pnpm --filter @gymmap/server db:deploy                               │\n' +
        '  │                                                                        │\n' +
        '  │ These are the ONLY assertions that prove a role can be re-granted.     │\n' +
        '  └────────────────────────────────────────────────────────────────────────┘\n',
    );
    return;
  }

  cleanup();

  // Minimal fixtures. `roles` is reference data seeded by the migration, so it is READ, never
  // inserted — inventing a role here would test a table shape the platform does not have.
  // `DRAFT`, not `APPROVED`. `ck_tenants__pan_required_for_in` requires a PAN once an Indian tenant
  // leaves the pre-approval statuses, and inventing one to satisfy a check about role grants would
  // be working around a real business rule for a test that has nothing to do with onboarding.
  //
  // Columns read from the live table, not assumed. The first attempt used `name` and
  // `slug`, which this schema does not have — the fixture failed and every assertion below reported
  // the same opaque exec error, which is exactly how a broken fixture masquerades as a broken subject.
  psql(
    `INSERT INTO tenants (id, legal_name, entity_type, status) VALUES
       ('${TENANT}', 'Iron House Strength Club', 'COMPANY', 'DRAFT'),
       ('${OTHER_TENANT}', 'Apex CrossFit', 'COMPANY', 'DRAFT')`,
  );
  psql(`INSERT INTO users (id, email, status) VALUES ('${ANA}', 'ana.m023@example.test', 'ACTIVE')`);
});

after(() => {
  if (available) cleanup();
});

const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    fn();
  });

/*
 * `gen_random_uuid()` appears in every insert below because `user_roles.id` has NO database default.
 * Prisma's `@default(uuid())` is generated CLIENT-side, so the column is plain `not null` in
 * PostgreSQL and raw SQL must supply it — a difference invisible from the Prisma schema alone.
 */
const roleId = (key: string): string => one(`SELECT id FROM roles WHERE key = '${key}'`);

/** The repository's sequence: revoke the others, then resurrect-or-create the target. */
function replaceRole(role: string): void {
  const target = roleId(role);
  psql(
    `BEGIN;
     UPDATE user_roles SET revoked_at = now()
       WHERE tenant_id = '${TENANT}' AND user_id = '${ANA}'
         AND revoked_at IS NULL AND role_id <> '${target}';
     INSERT INTO user_roles (id, user_id, tenant_id, role_id, granted_at)
       SELECT gen_random_uuid(), '${ANA}', '${TENANT}', '${target}', now()
       WHERE NOT EXISTS (
         SELECT 1 FROM user_roles
          WHERE tenant_id = '${TENANT}' AND user_id = '${ANA}' AND role_id = '${target}');
     UPDATE user_roles SET revoked_at = NULL, granted_at = now()
       WHERE tenant_id = '${TENANT}' AND user_id = '${ANA}' AND role_id = '${target}'
         AND revoked_at IS NOT NULL;
     COMMIT;`,
  );
}

const liveRoles = (): string[] =>
  sql(
    `SELECT r.key FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      WHERE ur.tenant_id = '${TENANT}' AND ur.user_id = '${ANA}' AND ur.revoked_at IS NULL
      ORDER BY r.key`,
  );

// ═══════════════════════════════════════════════════════════════════════════
// The regression
// ═══════════════════════════════════════════════════════════════════════════

it('the constraint ignores revocation — proving why an INSERT cannot be the re-grant', () => {
  // ┌─ THE COUNTER-EXAMPLE, RUN FIRST ───────────────────────────────────────────────────────────┐
  // │ Asserted before the fix is exercised, because a regression test whose failing case is never │
  // │ demonstrated is a test nobody can trust. This IS the bug: revoke, then insert the same       │
  // │ triple, and PostgreSQL refuses.                                                             │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const owner = roleId('GYM_OWNER');

  psql(
    `INSERT INTO user_roles (id, user_id, tenant_id, role_id) VALUES (gen_random_uuid(), '${ANA}', '${TENANT}', '${owner}')`,
  );
  psql(
    `UPDATE user_roles SET revoked_at = now()
      WHERE user_id = '${ANA}' AND tenant_id = '${TENANT}' AND role_id = '${owner}'`,
  );

  const error = failure(
    `INSERT INTO user_roles (id, user_id, tenant_id, role_id) VALUES (gen_random_uuid(), '${ANA}', '${TENANT}', '${owner}')`,
  );

  assert.match(
    error,
    /duplicate key value violates unique constraint/i,
    'a revoked row no longer occupies the triple — the schema changed and replaceRole can be simplified',
  );
  assert.match(error, /uq_user_roles__user_role_tenant/, `unexpected constraint: ${error}`);

  psql(`DELETE FROM user_roles WHERE user_id = '${ANA}'`);
});

it('FR-RBAC-07 — owner → manager → owner completes, which is the cycle that used to throw', () => {
  replaceRole('GYM_OWNER');
  assert.deepEqual(liveRoles(), ['GYM_OWNER']);

  replaceRole('GYM_MANAGER');
  assert.deepEqual(liveRoles(), ['GYM_MANAGER'], 'the owner grant was not revoked');

  // The step that raised P2002 before the fix.
  replaceRole('GYM_OWNER');
  assert.deepEqual(liveRoles(), ['GYM_OWNER'], 'the role could not be granted back');

  // And exactly one row per triple, still. Two rows would mean the constraint had been dropped.
  assert.equal(
    one(
      `SELECT count(*) FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = '${ANA}' AND ur.tenant_id = '${TENANT}' AND r.key = 'GYM_OWNER'`,
    ),
    '1',
  );

  psql(`DELETE FROM user_roles WHERE user_id = '${ANA}'`);
});

it('AC-STAF-01.4 — the superseded grant is REVOKED, never deleted', () => {
  // Attribution is the reason `revoked_at` exists. If a role change removed the row, the record
  // that the person ever held it would be gone, and the audit row would be the only trace of a
  // fact the table is supposed to carry.
  replaceRole('GYM_OWNER');
  replaceRole('RECEPTIONIST');

  assert.equal(
    one(
      `SELECT count(*) FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = '${ANA}' AND ur.tenant_id = '${TENANT}'
          AND r.key = 'GYM_OWNER' AND ur.revoked_at IS NOT NULL`,
    ),
    '1',
    'the superseded owner grant was deleted rather than revoked',
  );

  psql(`DELETE FROM user_roles WHERE user_id = '${ANA}'`);
});

it('re-granting a role the user already holds does NOT restamp granted_at', () => {
  // A no-op change must not rewrite the date somebody actually received their role. The repository
  // excludes the target row from the revoke sweep precisely so this stays true.
  replaceRole('GYM_OWNER');
  const first = one(
    `SELECT granted_at FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = '${ANA}' AND ur.tenant_id = '${TENANT}' AND r.key = 'GYM_OWNER'`,
  );

  replaceRole('GYM_OWNER');
  const second = one(
    `SELECT granted_at FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = '${ANA}' AND ur.tenant_id = '${TENANT}' AND r.key = 'GYM_OWNER'`,
  );

  assert.equal(second, first, 'granted_at moved on a no-op role change');

  psql(`DELETE FROM user_roles WHERE user_id = '${ANA}'`);
});

// ═══════════════════════════════════════════════════════════════════════════
// The tenancy half — `user_roles` carries a tenant_id and NO RLS policy
// ═══════════════════════════════════════════════════════════════════════════

it('BR-TEN-01 — a grant in another tenant is untouched by a replace in this one', () => {
  // ┌─ WHY THIS IS THE SHARPEST TENANCY ASSERTION IN THE MILESTONE ──────────────────────────────┐
  // │ `user_roles` is an IDENTITY model: the Prisma extension does not wrap it and the table has  │
  // │ no RLS policy, so nothing but the repository's own WHERE clause keeps one gym's role change │
  // │ out of another gym's grants. Drop the `tenant_id` filter and this test is the only thing in │
  // │ the suite that notices.                                                                     │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const owner = roleId('GYM_OWNER');
  psql(
    `INSERT INTO user_roles (id, user_id, tenant_id, role_id) VALUES (gen_random_uuid(), '${ANA}', '${OTHER_TENANT}', '${owner}')`,
  );

  replaceRole('RECEPTIONIST');

  assert.equal(
    one(
      `SELECT count(*) FROM user_roles
        WHERE user_id = '${ANA}' AND tenant_id = '${OTHER_TENANT}' AND revoked_at IS NULL`,
    ),
    '1',
    "the other tenant's grant was revoked by a role change in this tenant",
  );

  psql(`DELETE FROM user_roles WHERE user_id = '${ANA}'`);
});

it('a platform grant (tenant_id IS NULL) is not a tenant grant, and survives', () => {
  // `NULL` is the discriminator (`ERD.md` §3.1). A SUPER_ADMIN is not one of this gym's staff, so a
  // tenant-scoped replace must not reach the row — and `tenant_id = '…'` correctly excludes NULL,
  // which is the behaviour this pins in case somebody "fixes" it to `IS NOT DISTINCT FROM`.
  const admin = roleId('SUPER_ADMIN');
  psql(`INSERT INTO user_roles (id, user_id, tenant_id, role_id) VALUES (gen_random_uuid(), '${ANA}', NULL, '${admin}')`);

  replaceRole('GYM_MANAGER');

  assert.equal(
    one(
      `SELECT count(*) FROM user_roles
        WHERE user_id = '${ANA}' AND tenant_id IS NULL AND revoked_at IS NULL`,
    ),
    '1',
    'a platform grant was revoked by a tenant-scoped role change',
  );

  psql(`DELETE FROM user_roles WHERE user_id = '${ANA}'`);
});
