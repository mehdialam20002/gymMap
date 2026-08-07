/**
 * M-009 · `prisma/rls/<table>.sql` and the migration that applies it must not drift.
 *
 * Prisma Migrate has no include directive, so a policy exists twice: inline in the migration
 * (which is what actually runs) and in `prisma/rls/` (which is what people read and review).
 * Two copies of security-critical SQL with nothing comparing them is how one gets fixed during
 * an incident and the other quietly keeps the old predicate — and the one that keeps it is the
 * one the next fresh database is built from.
 *
 * Needs no Docker: this compares two files.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const RLS_DIR = resolve(REPO_ROOT, 'apps/server/prisma/rls');
const MIGRATIONS_DIR = resolve(REPO_ROOT, 'apps/server/prisma/migrations');

/** Strips comments and collapses whitespace, so formatting differences are not failures. */
function statements(sql) {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function allMigrationSql() {
  if (!existsSync(MIGRATIONS_DIR)) return '';
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(MIGRATIONS_DIR, e.name, 'migration.sql'))
    .filter((p) => existsSync(p))
    .map((p) => readFileSync(p, 'utf8'))
    .join('\n');
}

const referenceFiles = existsSync(RLS_DIR)
  ? readdirSync(RLS_DIR).filter((f) => f.endsWith('.sql') && !f.startsWith('_'))
  : [];

test('there is at least one policy reference file to check', () => {
  // Guards against this whole suite silently passing because the directory moved.
  assert.ok(referenceFiles.length > 0, `no <table>.sql files found in ${RLS_DIR}`);
});

for (const file of referenceFiles) {
  const table = file.replace(/\.sql$/, '');

  test(`${table} · every statement in prisma/rls/${file} appears in a migration`, () => {
    const migrations = statements(allMigrationSql());
    const reference = statements(readFileSync(join(RLS_DIR, file), 'utf8'));

    assert.ok(reference.length >= 3, `${file} should carry ENABLE, FORCE and at least one policy`);

    for (const statement of reference) {
      assert.ok(
        migrations.includes(statement),
        `${file} declares a statement no migration applies:\n\n  ${statement}\n\n` +
          `The reference copy is what reviewers read; the migration is what runs. A statement ` +
          `in one and not the other means the database does not have the policy people believe ` +
          `it has.`,
      );
    }
  });

  test(`${table} · the reference declares ENABLE, FORCE, USING and WITH CHECK`, () => {
    const sql = readFileSync(join(RLS_DIR, file), 'utf8');
    const executable = sql
      .split('\n')
      .map((l) => l.replace(/--.*$/, ''))
      .join('\n');

    assert.match(executable, /ENABLE ROW LEVEL SECURITY/i, 'RLS is not enabled');
    assert.match(
      executable,
      /FORCE\s+ROW LEVEL SECURITY/i,
      'ENABLE without FORCE exempts the table owner, and migrations run as an owner',
    );
    assert.match(executable, new RegExp(`rls_${table}__tenant_isolation`), 'no isolation policy');
    assert.match(executable, new RegExp(`rls_${table}__platform_read`), 'no platform-read policy');
    assert.match(
      executable,
      /WITH CHECK/i,
      'a USING-only policy permits a cross-tenant INSERT (PC4, AC-FND-01.1)',
    );
  });

  test(`${table} · THE TRAP — no missing_ok on current_setting`, () => {
    const sql = readFileSync(join(RLS_DIR, file), 'utf8');
    const executable = sql
      .split('\n')
      .map((l) => l.replace(/--.*$/, ''))
      .join('\n');

    assert.ok(
      !/current_setting\s*\([^)]*,\s*true\s*\)/i.test(executable),
      `${file} uses current_setting(..., true). §2.3.4: with missing_ok an unset context yields ` +
        `NULL, the predicate is NULL, and the query returns ZERO ROWS silently — so the bug ` +
        `presents as "the data is missing", somebody widens the policy to make it appear, and ` +
        `THAT is the breach.`,
    );
  });

  test(`${table} · the platform-read policy is SELECT only`, () => {
    const sql = readFileSync(join(RLS_DIR, file), 'utf8');
    const block = sql.slice(sql.indexOf(`rls_${table}__platform_read`));
    assert.match(
      block,
      /FOR SELECT/i,
      'the elevation role must be read-only. runElevated() is auditable precisely because it ' +
        'cannot write; a cross-tenant write path defeats the whole model.',
    );
  });
}
