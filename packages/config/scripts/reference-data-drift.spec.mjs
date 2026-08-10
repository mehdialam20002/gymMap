/**
 * `M-031` · `reference-data-drift` — `SeedStrategy.md` §2.7, `SEP1`, `SEP9`, `RD2`, `RD4`.
 *
 * Driven with a FAKE psql runner rather than a live database, so every branch is reachable —
 * including the two that need a table to vanish, which no fixture database can arrange.
 *
 * The live database is checked separately by `pnpm ci:reference-drift`. A spec that could only run
 * with Postgres up would be a spec that runs on one machine.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HASH_EXCLUDED_COLUMNS,
  computeFileDigests,
  computeTableHashes,
  diffAgainstManifest,
} from './reference-data-drift.mjs';
import { REFERENCE_DML_TABLES } from './migration-lint.mjs';

const NS = '3f8a2d10-0000-5000-b000-000000000000';

/** A psql stand-in: `present` are the tables that exist, `hashes` what each answers. */
function runner({ present = REFERENCE_DML_TABLES, hashes = {} } = {}) {
  return (sql) => {
    if (sql.includes('pg_tables')) return present.join('\n');
    const table = /FROM ([a-z_]+) t\)/.exec(sql)?.[1] ?? '';
    return hashes[table] ?? ':0';
  };
}

const manifest = (tables, files = {}) => ({ version: 1, namespace: NS, tables, files });

/** Every table built and empty — the shape a fresh database would give. */
const allEmpty = () =>
  Object.fromEntries(REFERENCE_DML_TABLES.map((t) => [t, { hash: '', rows: 0 }]));

test('a database matching its manifest reports no problems', () => {
  const tables = allEmpty();
  assert.deepEqual(diffAgainstManifest(manifest(tables), tables, {}), []);
});

test('§2.7 — the hash excludes created_at and updated_at, and only those', () => {
  // They are DEFAULT now(), so they differ between environments by construction. Including them
  // would make every environment drift from every other on its first day, and a check that always
  // fails is a check that gets skipped.
  assert.deepEqual(HASH_EXCLUDED_COLUMNS, ['created_at', 'updated_at']);
});

test('all sixteen §2.1 tables are hashed — the list is not a subset', () => {
  const tables = computeTableHashes(runner());
  assert.equal(Object.keys(tables).length, 16);
  for (const table of REFERENCE_DML_TABLES) assert.ok(table in tables, `${table} was not hashed`);
});

// ═══════════════════════════════════════════════════════════════════════════
// The three states a table can be in, and why `null` is not an empty hash
// ═══════════════════════════════════════════════════════════════════════════

test('a table that does not exist yet hashes to null, NOT to an empty table', () => {
  /*
   * Eleven of the sixteen are unbuilt at M-031. An empty-table hash would record them as
   * "checked, zero rows", which is a statement of fact about a table that is not there — and the
   * first version of this script did worse: a missing table threw, the CLI caught it, printed
   * "SKIPPED — no database", and the whole gate went green having examined nothing.
   */
  const tables = computeTableHashes(runner({ present: ['countries', 'roles'] }));

  assert.deepEqual(tables['tax_profiles'], null);
  assert.notDeepEqual(tables['countries'], null);
});

test('both-unbuilt is not a problem — it is the honest state of eleven tables', () => {
  const tables = { ...allEmpty(), tax_profiles: null };
  assert.deepEqual(diffAgainstManifest(manifest(tables), tables, {}), []);
});

test('a table ARRIVING is a problem until the manifest records it', () => {
  const committed = { ...allEmpty(), tax_profiles: null };
  const actual = { ...allEmpty(), tax_profiles: { hash: 'abc', rows: 4 } };

  const problems = diffAgainstManifest(manifest(committed), actual, {});
  assert.equal(problems.length, 1);
  assert.match(problems[0], /now exists/);
});

test('a table DISAPPEARING is a problem, and the message says why it is the worse one', () => {
  /*
   * The dangerous direction, and the reason `null` is a distinct value rather than an empty hash.
   * A reference table dropped means a contract migration ran somewhere it should not have, and
   * four foreign keys are now dangling.
   */
  const committed = { ...allEmpty(), countries: { hash: 'abc', rows: 1 } };
  const actual = { ...allEmpty(), countries: null };

  const problems = diffAgainstManifest(manifest(committed), actual, {});
  assert.equal(problems.length, 1);
  assert.match(problems[0], /DOES NOT EXIST/);
  assert.match(problems[0], /branches\.country_code/, 'must name what breaks');
});

// ═══════════════════════════════════════════════════════════════════════════
// The drift the check exists for — RD4's hand-edited migration
// ═══════════════════════════════════════════════════════════════════════════

test('RD4 — a row edited in place is caught, and the message names the three causes', () => {
  /*
   * The concrete case: someone changes India's `fy_start_month` from 4 to 1 in the committed
   * migration. `migration-lint`'s RD3 rule passes it — `countries` is on the allow-list — and no
   * other gate reads the row at all. Every Indian financial report then starts in January.
   */
  const committed = { ...allEmpty(), countries: { hash: 'fy-is-4', rows: 1 } };
  const actual = { ...allEmpty(), countries: { hash: 'fy-is-1', rows: 1 } };

  const problems = diffAgainstManifest(manifest(committed), actual, {});
  assert.equal(problems.length, 1);
  assert.match(problems[0], /SEP9/);
  assert.match(problems[0], /edited by hand \(RD4\)/);
  assert.match(problems[0], /migration was skipped/);
  assert.match(problems[0], /manifest was not bumped/);
});

test('a row COUNT change is caught even when the hash somehow matches', () => {
  const committed = { ...allEmpty(), countries: { hash: 'same', rows: 1 } };
  const actual = { ...allEmpty(), countries: { hash: 'same', rows: 20 } };
  assert.equal(diffAgainstManifest(manifest(committed), actual, {}).length, 1);
});

test('a table missing from the manifest entirely is a problem', () => {
  const actual = allEmpty();
  const committed = { ...actual };
  delete committed['amenities'];

  const problems = diffAgainstManifest(manifest(committed), actual, {});
  assert.match(problems[0], /no entry in the manifest/);
});

// ═══════════════════════════════════════════════════════════════════════════
// RD2 — the namespace, and RD4's other direction
// ═══════════════════════════════════════════════════════════════════════════

test('RD2 — a manifest on the wrong namespace is refused', () => {
  /*
   * `ORDER BY id` is only reproducible across environments BECAUSE the id derives from
   * `NS_REFERENCE`. A manifest built under a different namespace would hash a different ordering
   * and every comparison after it would be meaningless — so the namespace is checked before the
   * hashes are trusted.
   */
  const tables = allEmpty();
  const wrong = { ...manifest(tables), namespace: '6f2b7c1e-0000-5000-a000-000000000000' };

  const problems = diffAgainstManifest(wrong, tables, {});
  assert.match(
    problems[0],
    /DT2a/,
    'must explain that the seed namespace is a DIFFERENT namespace',
  );
});

test('RD4 — an edited CSV whose migration has not moved is caught', () => {
  const tables = allEmpty();
  const committed = manifest(tables, { 'countries.csv': { sha256: 'old', rows: 1 } });
  const actual = { 'countries.csv': { sha256: 'new', rows: 1 } };

  const problems = diffAgainstManifest(committed, tables, actual);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /source of truth/);
  assert.match(problems[0], /committed and not deployed/);
});

test('a data file absent from the manifest is caught', () => {
  const tables = allEmpty();
  const problems = diffAgainstManifest(manifest(tables), tables, {
    'amenities.csv': { sha256: 'x', rows: 59 },
  });
  assert.match(problems[0], /not in the manifest/);
});

// ═══════════════════════════════════════════════════════════════════════════
// The committed state
// ═══════════════════════════════════════════════════════════════════════════

test('the committed countries.csv holds one data row, and the header is not counted', () => {
  // A count that included the header would read as one row for an EMPTY file, which is the state
  // most of these files are in today (BLK-21) — so the off-by-one would hide the emptiness.
  const digests = computeFileDigests('apps/server/prisma/reference');

  assert.ok('countries.csv' in digests, 'the India CSV is missing');
  assert.equal(digests['countries.csv'].rows, 1);
  assert.match(digests['countries.csv'].sha256, /^[0-9a-f]{64}$/);
});
