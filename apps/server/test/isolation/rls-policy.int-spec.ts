/**
 * M-009 · The RLS policy suite — cases RS-1, RS-2, RS-3, RS-7, RS-8, RS-10.
 *
 * ┌─ RAW SQL. NO NEST. NO PRISMA. DELIBERATELY. ────────────────────────────────────────────────┐
 * │ This suite tests the DATABASE's guarantee, not the application's. If it went through the    │
 * │ Prisma extension it would be testing the extension — and the extension is the thing most    │
 * │ likely to be wrong, so a green run would prove nothing about what happens when someone      │
 * │ bypasses it.                                                                                 │
 * │                                                                                              │
 * │ BR-TEN-01 says isolation is enforced IN THE DATABASE. This is the file that checks that      │
 * │ sentence is literally true. It connects as `app_rw`, sets `app.tenant_id` by hand, and       │
 * │ asks Postgres directly.                                                                      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The cases (TestingStrategy.md):
 *   RS-1   a tenant reads its own row
 *   RS-2   a tenant CANNOT read another tenant's row — zero rows, not an error
 *   RS-3   a tenant CANNOT insert a row owned by another tenant — WITH CHECK raises
 *   RS-7   with no context set, the query RAISES rather than returning everything
 *   RS-8   a malformed context never widens the result set
 *   RS-10  no role holds BYPASSRLS
 *
 * RS-4…RS-6, RS-9, RS-11 and RS-12 are parameterised across every table in M-015.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

import { TENANT_A, TENANT_B, TENANT_C, seedTenantsSql } from '../../prisma/seed/tenants.ts';

const CONTAINER = 'gymmap-postgres';
const DB = 'gymmap';

export { TENANT_A, TENANT_B, TENANT_C };

interface Result {
  readonly ok: boolean;
  readonly out: string;
  readonly err: string;
}

/**
 * psql echoes a command tag for every statement — `SET`, `BEGIN`, `COMMIT`, `INSERT 0 1`. Those
 * are protocol noise, not results, and leaving them in means an assertion like
 * `assert.equal(out, '1')` compares against `'SET\nBEGIN\nSET\n1\nCOMMIT'` and fails for a
 * reason that has nothing to do with what is being tested.
 */
const COMMAND_TAG =
  /^(SET|BEGIN|COMMIT|ROLLBACK|RESET|DO|CREATE|DROP|ALTER|GRANT|REVOKE|TRUNCATE|COPY|ANALYZE|VACUUM)\b|^(INSERT|UPDATE|DELETE|SELECT|MERGE)\s+\d/;

function dataOnly(raw: string): string {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !COMMAND_TAG.test(l))
    .join('\n');
}

/**
 * Runs SQL as a given role.
 *
 * `SET ROLE` rather than a separate connection: the four app_* roles are NOLOGIN by design
 * (they are privilege sets, not accounts), so there is no password to connect with. `SET ROLE`
 * from the superuser session is how the application will reach them too, via a login role that
 * has been GRANTed one of them.
 */
function asRole(role: string, statements: string): Result {
  const sql = `SET ROLE ${role};\n${statements}`;
  try {
    const out = execFileSync(
      'docker',
      ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', DB, '-tA', '-v', 'ON_ERROR_STOP=1'],
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return { ok: true, out: dataOnly(out), err: '' };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    return { ok: false, out: dataOnly(e.stdout ?? ''), err: (e.stderr ?? '').trim() };
  }
}

function superuser(statements: string): Result {
  try {
    const out = execFileSync(
      'docker',
      ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', DB, '-tA', '-v', 'ON_ERROR_STOP=1'],
      { input: statements, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return { ok: true, out: dataOnly(out), err: '' };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    return { ok: false, out: dataOnly(e.stdout ?? ''), err: (e.stderr ?? '').trim() };
  }
}

/** Everything inside one transaction, so `SET LOCAL app.tenant_id` is scoped exactly to it. */
function asTenant(tenantId: string, statements: string, role = 'app_rw'): Result {
  return asRole(role, `BEGIN;\nSET LOCAL app.tenant_id = '${tenantId}';\n${statements}\nCOMMIT;`);
}

let available = false;

before(() => {
  const probe = superuser('SELECT 1;');
  available = probe.ok;
  if (!available) {
    console.error(
      '\n  SKIPPING the RLS policy suite — no database reachable.\n' +
        '    pnpm infra:up && pnpm --filter @gymmap/server db:deploy\n' +
        '  These assertions are the only place BR-TEN-01 is proved true rather than intended.\n',
    );
    return;
  }

  // The fixtures come from the SEED, not from a copy inlined here.
  //
  // The first version of this file inlined three INSERTs without a PAN, and every one of them
  // was rejected by `ck_tenants__pan_required_for_in` — an APPROVED Indian tenant must have a
  // PAN, which is the constraint doing exactly its job against a fixture that was wrong. Two
  // definitions of "the three tenants" is the same drift problem as two copies of a policy.
  const setup = superuser(`
    SET session_replication_role = 'replica';
    DELETE FROM tenants WHERE id IN ('${TENANT_A}','${TENANT_B}','${TENANT_C}');
    SET session_replication_role = 'origin';
    ${seedTenantsSql()}
  `);
  if (!setup.ok) {
    available = false;
    console.error(`\n  SKIPPING — fixture setup failed:\n${setup.err}\n`);
  }
});

const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    fn();
  });

// ---------------------------------------------------------------------------

it('RS-1 · a tenant reads its own row', () => {
  const result = asTenant(TENANT_A, `SELECT legal_name FROM tenants;`);
  assert.ok(result.ok, `query failed: ${result.err}`);
  assert.match(result.out, /Iron Temple Fitness Private Limited/);
});

it('RS-1 · P-SELF means a tenant sees EXACTLY ONE row — not the customer list', () => {
  const result = asTenant(TENANT_A, `SELECT count(*) FROM tenants;`);
  assert.ok(result.ok, result.err);
  assert.equal(
    result.out,
    '1',
    "a tenant that can count the tenants table can count the platform's customers. " +
      'P-SELF exists so the answer is always 1.',
  );
});

it('RS-2 · a tenant CANNOT read another tenant, and gets zero rows rather than an error', () => {
  // Zero rows, not 403. A row that is invisible must be indistinguishable from a row that does
  // not exist, or the error itself confirms the other tenant exists (§15.8).
  const result = asTenant(TENANT_A, `SELECT count(*) FROM tenants WHERE id = '${TENANT_B}';`);
  assert.ok(result.ok, result.err);
  assert.equal(result.out, '0');
});

it('RS-3 · WITH CHECK blocks an INSERT owned by another tenant (AC-FND-01.1)', () => {
  // The case that proves USING alone is insufficient. Without WITH CHECK this INSERT succeeds,
  // the inserting tenant cannot then see the row, and nothing looks wrong from either side.
  const result = asTenant(
    TENANT_A,
    `INSERT INTO tenants (id, legal_name, entity_type) ` +
      `VALUES ('01912f00-0000-7000-8000-0000000000ff', 'Smuggled', 'COMPANY');`,
  );
  assert.equal(result.ok, false, 'a cross-tenant INSERT must be rejected');
  assert.match(
    result.err,
    /row-level security/i,
    `expected an RLS violation, got: ${result.err.slice(0, 200)}`,
  );
});

it('RS-3 · a tenant CANNOT re-key its own row into another tenant', () => {
  const result = asTenant(
    TENANT_A,
    `UPDATE tenants SET id = '${TENANT_B}' WHERE id = '${TENANT_A}';`,
  );
  assert.equal(result.ok, false, 'an UPDATE that moves a row out of scope must be rejected');
});

it('RS-7 · THE TRAP — with no context set, the query RAISES rather than returning rows', () => {
  // This is the assertion the whole milestone note is about. With `missing_ok => true` in the
  // policy this returns zero rows silently, the bug presents as "the data is missing", someone
  // widens the policy to make the data appear, and that is the breach.
  const result = asRole('app_rw', `SELECT count(*) FROM tenants;`);
  assert.equal(
    result.ok,
    false,
    'an unset app.tenant_id must RAISE. It returned a result instead, which means the policy ' +
      'was written with missing_ok — converting a loud failure into a silent one.',
  );
  assert.match(
    result.err,
    /unrecognized configuration parameter|42704/i,
    `expected SQLSTATE 42704, got: ${result.err.slice(0, 200)}`,
  );
});

it('RS-7 · and it certainly never returns all three tenants', () => {
  const result = asRole('app_rw', `SELECT count(*) FROM tenants;`);
  assert.notEqual(result.out, '3', 'an unset context returned the whole table');
});

it('RS-8 · a malformed tenant id raises and never widens the result set', () => {
  const result = asRole(
    'app_rw',
    `BEGIN; SET LOCAL app.tenant_id = 'not-a-uuid'; SELECT count(*) FROM tenants; COMMIT;`,
  );
  assert.equal(result.ok, false, 'a malformed uuid must raise on the cast');
  assert.notEqual(result.out, '3');
});

it('RS-8 · an empty tenant id raises too', () => {
  const result = asRole(
    'app_rw',
    `BEGIN; SET LOCAL app.tenant_id = ''; SELECT count(*) FROM tenants; COMMIT;`,
  );
  assert.equal(result.ok, false);
});

it('RS-8 · a well-formed uuid for a tenant that does not exist returns zero, not everything', () => {
  const result = asTenant(
    '01912f00-0000-7000-8000-0000000000zz'.replace(/z/g, '9'),
    `SELECT count(*) FROM tenants;`,
  );
  assert.ok(result.ok, result.err);
  assert.equal(result.out, '0');
});

it('RS-10 · no role holds BYPASSRLS, re-asserted now that a policy exists (E0.8)', () => {
  const result = superuser(
    `SELECT count(*) FROM pg_roles WHERE rolname LIKE 'app\\_%' AND (rolbypassrls OR rolsuper);`,
  );
  assert.ok(result.ok, result.err);
  assert.equal(result.out, '0');
});

// ---------------------------------------------------------------------------
// The platform-read path — what makes the approval queue possible.
// ---------------------------------------------------------------------------

it('app_platform_ro reads across tenants — this is the elevation path (M-014)', () => {
  const result = asRole('app_platform_ro', `SELECT count(*) FROM tenants;`);
  assert.ok(result.ok, result.err);
  assert.ok(
    Number(result.out) >= 3,
    'the platform role must see every tenant, or the admin approval queue cannot exist without ' +
      'granting BYPASSRLS somewhere',
  );
});

it('app_platform_ro CANNOT write — SELECT only, always', () => {
  const result = asRole(
    'app_platform_ro',
    `UPDATE tenants SET legal_name = 'hijacked' WHERE id = '${TENANT_A}';`,
  );
  assert.equal(
    result.ok,
    false,
    'the elevation role gained a write path. runElevated() is auditable precisely because it ' +
      'can only read; a cross-tenant write defeats the entire model.',
  );
});

it('app_rw cannot DELETE — the domain operation is a soft delete (ADR-0024)', () => {
  const result = asTenant(TENANT_A, `DELETE FROM tenants WHERE id = '${TENANT_A}';`);
  assert.equal(result.ok, false, 'G-CRUD grants no DELETE on a table carrying deleted_at');
});

// ---------------------------------------------------------------------------
// IS6 — RLS coverage. Every tenant-owned table has both policies.
// ---------------------------------------------------------------------------

it('IS6 · tenants has BOTH policies, and RLS is enabled AND forced', () => {
  const flags = superuser(
    `SELECT relrowsecurity::text || '|' || relforcerowsecurity::text
     FROM pg_class WHERE relname = 'tenants';`,
  );
  assert.equal(flags.out, 'true|true', 'RLS must be both ENABLED and FORCED (IS6)');

  const policies = superuser(
    `SELECT policyname FROM pg_policies WHERE tablename = 'tenants' ORDER BY policyname;`,
  );
  assert.deepEqual(
    policies.out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    ['rls_tenants__platform_read', 'rls_tenants__tenant_isolation'],
  );
});

it('IS6 · the isolation policy carries a WITH CHECK, not only a USING', () => {
  const result = superuser(
    `SELECT COALESCE(with_check, '(none)') FROM pg_policies
     WHERE tablename = 'tenants' AND policyname = 'rls_tenants__tenant_isolation';`,
  );
  assert.notEqual(
    result.out,
    '(none)',
    'a USING-only policy permits a cross-tenant INSERT (PC4, AC-FND-01.1)',
  );
  assert.match(result.out, /app\.tenant_id/);
});

it('THE TRAP · the policy does NOT use missing_ok', () => {
  // Asserted on the stored policy text, so it survives someone "fixing" the test above by
  // making the suite quieter.
  const result = superuser(
    `SELECT qual FROM pg_policies
     WHERE tablename = 'tenants' AND policyname = 'rls_tenants__tenant_isolation';`,
  );
  assert.match(result.out, /current_setting\('app\.tenant_id'::text\)/);
  assert.ok(
    !/current_setting\([^)]*,\s*true\s*\)/i.test(result.out),
    "the policy uses current_setting(..., true). §2.3.4: the schema's entire contribution is " +
      'converting a silent leak into a visible error, and missing_ok throws that away.',
  );
});

after(() => {
  if (available) {
    superuser(`
      SET session_replication_role = 'replica';
      DELETE FROM tenants WHERE id IN ('${TENANT_A}','${TENANT_B}','${TENANT_C}');
      SET session_replication_role = 'origin';
    `);
  }
});
