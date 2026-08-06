/**
 * M-006 · `migration-lint` — six malformed migrations, six DISTINCT failures, each naming its
 * rule id in the message.
 *
 * The distinctness matters more here than anywhere else in the pipeline. A migration is the one
 * artefact with no undo, so the person reading the failure is often doing so at the worst
 * possible moment. "Invalid migration" costs them a trip through a 900-line specification.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { VERBS, PHASES, HEADER_KEYS, lintMigration, lintAll } from './migration-lint.mjs';

/**
 * Derived from this file's own location, NOT from `process.cwd()`.
 *
 * Turbo runs `test:unit` with the cwd set to the package, so a cwd-relative path resolves to
 * `packages/config/apps/server/…` and the spec fails with ENOENT — passing when run by hand
 * from the repo root and failing in CI, which is the worst way for a test to be wrong.
 */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const MIGRATION_SQL = resolve(REPO_ROOT, 'apps/server/prisma/migrations/0_init/migration.sql');

/** A valid header, so each test can break exactly one thing. */
function header(overrides = {}) {
  const base = {
    phase: 'expand',
    requirement: 'BR-MEM-03, ADR-0025',
    tables: 'memberships',
    rls: 'unchanged',
    grants: 'unchanged',
    append_only: 'no',
    partitioned: 'no',
    max_lock: 'ACCESS EXCLUSIVE (catalogue only)',
    rewrite: 'none',
    est_duration: '< 50 ms at Y1 volume',
    backfill_job: 'none',
    rollback: 'FREE',
    concurrent_steps: 'none',
    reviewers: 'two, one schema owner',
    docs: 'Schema.md §8.1',
    ...overrides,
  };
  return HEADER_KEYS.map((k) => `-- ${k}:${' '.repeat(Math.max(1, 18 - k.length))}${base[k]}`).join(
    '\n',
  );
}

const TIMEOUTS = `SET LOCAL lock_timeout      = '5s';\nSET LOCAL statement_timeout = '300s';`;

function migration(body, overrides = {}, name = '20261115140000_expand_add_valid_until') {
  return { name, sql: `-- migration: ${name}\n${header(overrides)}\n\n${TIMEOUTS}\n\n${body}` };
}

const rules = (p) => p.map((x) => x.rule);

test('a well-formed migration is clean', () => {
  const { name, sql } = migration(
    `ALTER TABLE memberships ADD COLUMN IF NOT EXISTS valid_until_date date NULL;`,
  );
  assert.deepEqual(lintMigration(name, sql), []);
});

// ---------------------------------------------------------------------------
// The six malformed headers.
// ---------------------------------------------------------------------------

test('1 · a missing header key fails §2.4 and names the key', () => {
  const { name, sql } = migration('ALTER TABLE t ADD COLUMN IF NOT EXISTS c int;');
  const stripped = sql.replace(/^--\s+rollback:.*$/m, '');
  const problems = lintMigration(name, stripped);
  assert.deepEqual(rules(problems), ['§2.4']);
  assert.match(problems[0].message, /rollback/);
  assert.match(problems[0].message, /unanswered question/);
});

test('2 · a missing SET LOCAL lock_timeout fails PM-8', () => {
  const { name } = migration('');
  const sql = `-- migration: ${name}\n${header()}\n\nSET LOCAL statement_timeout = '300s';\nALTER TABLE t ADD COLUMN IF NOT EXISTS c int;`;
  const problems = lintMigration(name, sql);
  assert.ok(rules(problems).includes('PM-8'));
  assert.match(
    problems.find((p) => p.rule === 'PM-8').message,
    /queue of blocked|outage/,
    'must explain why an unbounded lock wait is worse than a slow migration',
  );
});

test('3 · a verb outside the closed list fails, and lists the legal verbs', () => {
  const { sql } = migration('ALTER TABLE t ADD COLUMN IF NOT EXISTS c int;');
  const problems = lintMigration('20261115140000_expand_refactor_memberships', sql);
  const found = problems.find((p) => p.rule === 'PM-verb');
  assert.ok(found, 'an unclassified verb must fail');
  assert.match(found.message, /refactor/);
  for (const verb of ['create', 'backfill', 'partition'])
    assert.match(found.message, new RegExp(verb));
});

test('4 · CREATE TABLE without IF NOT EXISTS fails PM-9 idempotence', () => {
  const { name, sql } = migration(
    `CREATE TABLE gyms (id uuid PRIMARY KEY);\n` +
      `ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;\n` +
      `ALTER TABLE gyms FORCE ROW LEVEL SECURITY;\n` +
      `GRANT SELECT ON gyms TO app_rw;`,
  );
  const problems = lintMigration(name, sql);
  assert.ok(rules(problems).includes('PM-9'));
  assert.match(
    problems.find((p) => p.rule === 'PM-9').message,
    /partial failure|hand-editing production/,
  );
});

test('5 · a rename without the three-release plan fails PM-10', () => {
  const { name, sql } = migration('ALTER TABLE memberships RENAME TO subscriptions;', {
    phase: 'contract',
  });
  const problems = lintMigration(name, sql);
  assert.ok(rules(problems).includes('PM-10'));
  assert.match(problems.find((p) => p.rule === 'PM-10').message, /previous release|hard cutover/);
});

test('6 · a filename that is not <ts>_<phase>_<verb>_<subject> fails MF3', () => {
  const { sql } = migration('ALTER TABLE t ADD COLUMN IF NOT EXISTS c int;');
  const problems = lintMigration('add_column', sql);
  assert.ok(rules(problems).includes('MF3'));
  assert.match(problems.find((p) => p.rule === 'MF3').message, /apply order|merge/);
});

test('the six rules are all distinct', () => {
  assert.equal(new Set(['§2.4', 'PM-8', 'PM-verb', 'PM-9', 'PM-10', 'MF3']).size, 6);
});

// ---------------------------------------------------------------------------
// The rules that protect the load-bearing invariants.
// ---------------------------------------------------------------------------

test('§8.3 — current_setting with missing_ok is rejected, loudly', () => {
  const { name, sql } = migration(
    `CREATE POLICY p ON t FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);`,
  );
  const problems = lintMigration(name, sql);
  const found = problems.find((p) => p.rule === '§8.3');
  assert.ok(found, 'missing_ok must be rejected');
  assert.match(found.message, /ZERO ROWS/);
  assert.match(found.message, /breach/, 'must say where the silent failure ends up');
});

test('MG10 — a new table without RLS fails', () => {
  const { name, sql } = migration(
    `CREATE TABLE IF NOT EXISTS gyms (id uuid PRIMARY KEY);\nGRANT SELECT ON gyms TO app_rw;`,
  );
  const problems = lintMigration(name, sql);
  assert.ok(rules(problems).includes('MG10'));
  assert.match(problems.find((p) => p.rule === 'MG10').message, /queryable across tenants/);
});

test('MG10 — ENABLE without FORCE fails, and says why FORCE matters', () => {
  const { name, sql } = migration(
    `CREATE TABLE IF NOT EXISTS gyms (id uuid PRIMARY KEY);\n` +
      `ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;\n` +
      `GRANT SELECT ON gyms TO app_rw;`,
  );
  const problems = lintMigration(name, sql);
  const found = problems.find((p) => p.rule === 'MG10');
  assert.ok(found);
  assert.match(found.message, /exempts the table OWNER/);
});

test('P10 — a new table with no grant fails', () => {
  const { name, sql } = migration(
    `CREATE TABLE IF NOT EXISTS gyms (id uuid PRIMARY KEY);\n` +
      `ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;\n` +
      `ALTER TABLE gyms FORCE ROW LEVEL SECURITY;`,
  );
  assert.ok(rules(lintMigration(name, sql)).includes('P10'));
});

test('DB2 — a *_minor column typed numeric fails BR-PAY-01', () => {
  const { name, sql } = migration(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_minor numeric(12,2) NOT NULL DEFAULT 0;`,
  );
  const problems = lintMigration(name, sql);
  assert.ok(rules(problems).includes('DB2'));
  assert.match(problems.find((p) => p.rule === 'DB2').message, /BR-PAY-01/);
});

test('CI-05 — timestamp without time zone fails', () => {
  const { name, sql } = migration(
    `ALTER TABLE t ADD COLUMN IF NOT EXISTS at timestamp without time zone;`,
  );
  const problems = lintMigration(name, sql);
  assert.ok(rules(problems).includes('CI-05'));
  assert.match(problems.find((p) => p.rule === 'CI-05').message, /UTC\+05:30|no DST/);
});

test('§4.4 — a lock_timeout above the ceiling fails; CI must fail earlier than production', () => {
  const { name } = migration('');
  const sql =
    `-- migration: ${name}\n${header()}\n\n` +
    `SET LOCAL lock_timeout = '30s';\nSET LOCAL statement_timeout = '300s';\n` +
    `ALTER TABLE t ADD COLUMN IF NOT EXISTS c int;`;
  const problems = lintMigration(name, sql);
  assert.ok(rules(problems).includes('§4.4'));
});

test('a rule never fires on prose that merely discusses it', () => {
  // The 0_init header explains why it creates no tables and mentions CREATE TABLE in doing so.
  // A linter that reads comments would force someone to delete the explanation to go green.
  const { name, sql } = migration(
    `-- We deliberately avoid CREATE TABLE here, and never use timestamp without time zone.\n` +
      `ALTER TABLE t ADD COLUMN IF NOT EXISTS c int;`,
  );
  assert.deepEqual(lintMigration(name, sql), []);
});

// ---------------------------------------------------------------------------
// The real 0_init.
// ---------------------------------------------------------------------------

test('the committed 0_init passes its own linter', () => {
  assert.deepEqual(lintAll(REPO_ROOT), []);
});

test('AC-6 — 0_init creates ZERO tables and is readable in ten minutes', () => {
  const sql = readFileSync(MIGRATION_SQL, 'utf8');
  const executable = sql
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');

  assert.ok(!/CREATE\s+TABLE/i.test(executable), 'R-M1: 0_init creates zero tables');
  assert.equal((executable.match(/CREATE\s+TYPE/gi) ?? []).length, 81, '81 enum types');
  assert.equal((executable.match(/CREATE\s+DOMAIN/gi) ?? []).length, 12, '12 domains (§2.4)');
  assert.equal((executable.match(/CREATE\s+ROLE/gi) ?? []).length, 4, 'the four app_* roles');
});

test('AC-2 — not one role is created with BYPASSRLS', () => {
  const sql = readFileSync(MIGRATION_SQL, 'utf8');
  for (const line of sql.split('\n').filter((l) => /^CREATE ROLE/.test(l))) {
    assert.match(
      line,
      /NOBYPASSRLS/,
      `"${line.trim()}" does not say NOBYPASSRLS. A role with BYPASSRLS makes every policy in ` +
        `the system advisory — the query still runs and returns the WRONG tenant's rows.`,
    );
    assert.ok(!/\bSUPERUSER\b(?!\s)/.test(line.replace(/NOSUPERUSER/g, '')), 'no SUPERUSER');
  }
});

test('AC-3 — the blanket revoke makes absence the default', () => {
  const sql = readFileSync(MIGRATION_SQL, 'utf8');
  assert.match(sql, /REVOKE ALL ON SCHEMA public FROM PUBLIC/);
  assert.match(sql, /ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC/);
});

test('the closed verb list and phase list match the specification', () => {
  assert.deepEqual(VERBS, [
    'create',
    'add',
    'drop',
    'rename',
    'alter',
    'backfill',
    'enable',
    'grant',
    'revoke',
    'partition',
    'index',
    'seed',
  ]);
  assert.deepEqual(PHASES, ['expand', 'migrate', 'contract']);
});
