/**
 * M-009 · IS6 · The RLS coverage query returns an empty set — and provably would not if a
 * policy were missing.
 *
 * Running the query and asserting "no rows" is only half a test. A query with a typo in a table
 * name also returns no rows, and so does one whose `WHERE` can never be true. Both look exactly
 * like success.
 *
 * So this file does the other half: it DROPS a policy inside a rolled-back transaction, re-runs
 * the same query, and asserts it now reports the table. That is the only way to know the gate
 * can see anything at all.
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const CONTAINER = 'gymmap-postgres';
const DB = 'gymmap';

/**
 * Locates the repository root by walking up for `pnpm-workspace.yaml`.
 *
 * NOT `import.meta.url`, which is the obvious choice and does not compile: `apps/server` has no
 * `"type": "module"`, so TypeScript emits CommonJS for these files and raises TS1470. Node
 * happens to reparse them as ESM at runtime because it detects `import` syntax, so the file
 * would have RUN fine and failed `typecheck` — a split between the two that is worth avoiding
 * rather than suppressing.
 *
 * Anchoring on the workspace marker also means the suite works whether it is invoked from
 * `apps/server` (pnpm --filter) or from the repository root (turbo).
 */
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

const COVERAGE_SQL = resolve(repoRoot(), 'apps/server/test/isolation/rls-coverage.sql');

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
let coverageSql = '';

before(() => {
  available = psql('SELECT 1;').ok;
  if (available) coverageSql = readFileSync(COVERAGE_SQL, 'utf8');
  else {
    console.error(
      '\n  SKIPPING IS6 coverage — no database. pnpm infra:up && pnpm --filter @gymmap/server db:deploy\n',
    );
  }
});

const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    fn();
  });

it('IS6 · the coverage query returns an empty set', () => {
  const result = psql(coverageSql);
  assert.ok(result.ok, `the coverage query itself failed: ${result.err}`);
  assert.equal(
    result.out,
    '',
    `tables without complete RLS coverage:\n${result.out}\n\n` +
      'Every tenant-owned table needs RLS enabled AND forced, an isolation policy with both ' +
      'USING and WITH CHECK, and a platform-read policy. MG10 requires all of it in the same ' +
      'migration as the table.',
  );
});

it('IS6 · the query is not vacuous — dropping a policy makes it report', () => {
  // Inside a transaction that is ROLLED BACK, so the database is unchanged afterwards. A gate
  // that has never been seen to fail is a gate nobody has proved works.
  const probe = psql(
    [
      'BEGIN;',
      'DROP POLICY rls_tenants__tenant_isolation ON tenants;',
      coverageSql,
      'ROLLBACK;',
    ].join('\n'),
  );
  assert.ok(probe.ok, probe.err);
  assert.match(
    probe.out,
    /tenants/,
    'the coverage query did not notice a missing isolation policy on `tenants`. It is looking ' +
      'at nothing — which returns no rows and reads as success.',
  );
  assert.match(probe.out, /no rls_tenants__tenant_isolation policy/);
});

it('IS6 · un-forcing RLS is reported, not just disabling it', () => {
  // The subtler of the two. `ENABLE` without `FORCE` looks correct in a migration diff and
  // exempts the table owner — and migrations run as an owner.
  const probe = psql(
    ['BEGIN;', 'ALTER TABLE tenants NO FORCE ROW LEVEL SECURITY;', coverageSql, 'ROLLBACK;'].join(
      '\n',
    ),
  );
  assert.ok(probe.ok, probe.err);
  assert.match(probe.out, /not FORCED/);
});

it('IS6 · dropping the platform-read policy is reported', () => {
  const probe = psql(
    ['BEGIN;', 'DROP POLICY rls_tenants__platform_read ON tenants;', coverageSql, 'ROLLBACK;'].join(
      '\n',
    ),
  );
  assert.ok(probe.ok, probe.err);
  assert.match(probe.out, /platform_read/);
});

it('PC2 · a tenant_id column on an exempted table is reported', () => {
  /*
   * The check that stops the exemption list becoming an escape hatch. The easiest way to make
   * `CI-01` green is to add the offending table to the list; this makes that impossible.
   *
   * ┌─ THE PROBE USED TO CREATE A TABLE CALLED `countries`, AND M-031 BUILT ONE ───────────────────┐
   * │ `CREATE TABLE countries (…)` inside a rolled-back transaction was safe for as long as the     │
   * │ real table did not exist. M-031 created it, and the probe began failing with *"relation        │
   * │ countries already exists"* — a fixture colliding with production schema, not a rule breaking.  │
   * │                                                                                              │
   * │ `feature_flags` is the replacement: it is on the §1.3 exemption list (so `PC2` applies to it)  │
   * │ and it is one of the seven §2.1 tables that do not exist yet, so nothing can collide. If a     │
   * │ later milestone builds it, this probe fails the same way — which is why the name is chosen     │
   * │ from the unbuilt set rather than invented, and why that is said here.                            │
   * └──────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const probe = psql(
    [
      'BEGIN;',
      'CREATE TABLE feature_flags (key text PRIMARY KEY, tenant_id uuid NOT NULL);',
      coverageSql,
      'ROLLBACK;',
    ].join('\n'),
  );
  assert.ok(probe.ok, probe.err);
  assert.match(probe.out, /feature_flags/);
  assert.match(probe.out, /exemption list but HAS a tenant_id/);
});

// ═══════════════════════════════════════════════════════════════════════════
// M-019 · PC2-IDENTITY — one reviewed exception is a decision, two is a pattern.
// ═══════════════════════════════════════════════════════════════════════════

it('PC2-IDENTITY · `user_roles` really is the exception it claims to be', () => {
  // If a later milestone gives `user_roles` policies, the exception becomes stale and the
  // paragraph of justification in three files becomes misleading. Assert the actual state
  // rather than trusting the comment that describes it.
  const hasTenantId = psql(
    `SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'tenant_id';`,
  );
  assert.equal(hasTenantId.out, '1', '`user_roles` lost its tenant_id — the exception is moot');

  const policies = psql(`SELECT count(*) FROM pg_policies WHERE tablename = 'user_roles';`);
  assert.equal(
    policies.out,
    '0',
    '`user_roles` acquired a policy. If that is intended, the reviewed exception in ' +
      'rls-coverage.sql, the migration header and Schema.md §4.7 are all now wrong — and a ' +
      'policy here makes every platform-role row (tenant_id IS NULL) invisible to every ' +
      'session, so super-admins silently lose their own permissions.',
  );
});

it('PC2-IDENTITY · a SECOND policy-less tenant_id table is reported by name', () => {
  // The escape hatch this closes: adding a table to CI-01's exemption list. PC2 catches that
  // only for names already on the list; a NEW table added to the list would sail through both.
  // This query looks at the schema rather than at the list, so it cannot be edited around
  // without editing the query — which is a diff a reviewer sees.
  const probe = psql(
    [
      'BEGIN;',
      'CREATE TABLE staff_invitations (id uuid PRIMARY KEY, tenant_id uuid NOT NULL);',
      coverageSql,
      'ROLLBACK;',
    ].join('\n'),
  );
  assert.ok(probe.ok, probe.err);
  assert.match(probe.out, /staff_invitations/);
  assert.match(probe.out, /single reviewed exception/);
});

it('PC2-IDENTITY · it does not fire on `user_roles` itself', () => {
  // The positive control. A query that reported every policy-less tenant_id table INCLUDING
  // the sanctioned one would be red permanently, and a permanently red gate gets deleted.
  const result = psql(coverageSql);
  assert.doesNotMatch(result.out, /user_roles/);
});

it('the database is unchanged after the probes rolled back', () => {
  const result = psql(coverageSql);
  assert.equal(result.out, '', 'a probe leaked out of its transaction');

  const policies = psql(`SELECT count(*) FROM pg_policies WHERE tablename = 'tenants';`);
  assert.equal(policies.out, '2');
});
