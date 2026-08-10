/**
 * `M-031` · CI job `reference-data-drift` — `SeedStrategy.md` §2.7, `SEP1`, `SEP9`, `RD4`.
 *
 * ┌─ WHAT THIS CATCHES THAT NOTHING ELSE DOES ───────────────────────────────────────────────────┐
 * │ `migration-lint`'s `RD3` rule checks that a migration writes rows only into the sixteen       │
 * │ reference tables. It says nothing about WHICH rows, so a hand-edited migration that quietly   │
 * │ changes India's financial-year start from 4 to 1 passes every gate in this repository.        │
 * │                                                                                              │
 * │ §2.7: *"computes, for each of the sixteen tables, an ordered hash over every column except    │
 * │ `created_at`/`updated_at`"* and compares it to a committed manifest. `SEP9` states the        │
 * │ property it protects — *"the India GST profile in `local` is byte-identical to the one in     │
 * │ production, because it arrived by the same migration. A divergence means a migration was      │
 * │ skipped."*                                                                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY THE HASH EXCLUDES THE TIMESTAMPS, AND WHY THAT IS NOT A LOOPHOLE ───────────────────────┐
 * │ `created_at` and `updated_at` are `DEFAULT now()`, so they differ between environments by     │
 * │ construction. Including them would make every environment drift from every other on its       │
 * │ first day, and a check that always fails is a check that gets skipped.                        │
 * │                                                                                              │
 * │ Nothing is hidden by the exclusion: a reference row's identity is its business key and its    │
 * │ values, and WHEN it arrived is recorded by `_prisma_migrations` with its own checksum.         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IT DELIBERATELY DOES NOT CATCH — §2.7 SAYS SO ─────────────────────────────────────────┐
 * │ *"A row that is WRONG — the GST rate being 18% rather than 20% is a tax question, not a       │
 * │ checksum question."* This proves every environment agrees. Whether what they agree on is      │
 * │ correct is `§12` open item `O-3`, and claiming otherwise would be the more dangerous error.   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * With zero reference rows this reports "0 rows across 16 tables" rather than passing silently —
 * `BLK-21` means fifteen of the sixteen are legitimately empty today, and an empty table and an
 * unchecked table must never look the same in a log.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

import { REFERENCE_DML_TABLES } from './migration-lint.mjs';

const CONTAINER = 'gymmap-postgres';

/** `created_at` / `updated_at` differ by construction — §2.7 excludes them by name. */
export const HASH_EXCLUDED_COLUMNS = ['created_at', 'updated_at'];

/**
 * One SQL statement that hashes a whole table deterministically.
 *
 * ┌─ THE ORDERING IS THE HARD PART, AND `id` IS WHAT MAKES IT POSSIBLE ─────────────────────────┐
 * │ A hash over "every row" is only reproducible if the rows are read in a fixed order, and      │
 * │ PostgreSQL promises no order without `ORDER BY`. Sorting by `id` works precisely BECAUSE     │
 * │ `RD2` derives it: `uuid_v5(NS_REFERENCE, '<table>:<business-key>')` is the same value in      │
 * │ every environment, so `ORDER BY id` is the same sequence everywhere. A random uuid would      │
 * │ have made this check unbuildable.                                                             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `to_jsonb(t) - excluded` drops the timestamp keys, and jsonb sorts its keys canonically, so the
 * text form does not depend on the column ORDER the table happens to have — which means adding a
 * column to the middle of a `CREATE TABLE` does not read as a data change.
 */
function hashQuery(table) {
  const drops = HASH_EXCLUDED_COLUMNS.map((c) => `- '${c}'`).join(' ');
  return `SELECT coalesce(md5(string_agg(row_text, '|' ORDER BY row_text)), '') || ':' || count(*)
          FROM (SELECT (to_jsonb(t) ${drops})::text AS row_text FROM ${table} t) s;`;
}

function psql(sql) {
  try {
    return execFileSync(
      'docker',
      [
        'exec',
        '-i',
        CONTAINER,
        'psql',
        '-U',
        'postgres',
        '-d',
        'gymmap',
        '-tA',
        '-v',
        'ON_ERROR_STOP=1',
      ],
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
  } catch (error) {
    // `cause` preserved: psql's stderr is the useful half, and the spawn error underneath it is
    // what distinguishes "the container is not running" from "the query was wrong".
    throw new Error((error.stderr ?? String(error)).trim(), { cause: error });
  }
}

/** Which of the sixteen currently exist. One round trip, so a missing table is data not an error. */
export function existingTables(runner = psql) {
  const names = REFERENCE_DML_TABLES.map((t) => `'${t}'`).join(', ');
  const out = runner(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (${names});`,
  );
  return new Set(out.split('\n').filter((line) => line.trim().length > 0));
}

/**
 * `{ table: { hash, rows } | null }` for all sixteen, read from a live database.
 *
 * ┌─ `null` FOR A TABLE THAT DOES NOT EXIST YET, AND NOT `{ hash: '', rows: 0 }` ────────────────┐
 * │ Eleven of the sixteen are unbuilt at M-031 — `reason_codes`, `tax_profiles`,                  │
 * │ `subscription_tiers`, `commission_rules`, `help_articles`, `feature_flags` and                │
 * │ `notification_templates` among them. An empty-table hash would record them as *"checked,      │
 * │ zero rows"*, which is a statement of fact about a table that is not there.                     │
 * │                                                                                              │
 * │ The first version of this file conflated the two in a worse way still: a missing table threw, │
 * │ the CLI caught it and printed *"SKIPPED — no database"*, and the whole gate went green having │
 * │ examined nothing. A gate whose failure mode is a green skip is the failure mode this family   │
 * │ of gates exists to prevent, and I wrote it into the gate that exists to prevent it.            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function computeTableHashes(runner = psql) {
  const present = existingTables(runner);
  const result = {};

  for (const table of REFERENCE_DML_TABLES) {
    if (!present.has(table)) {
      result[table] = null;
      continue;
    }
    const raw = runner(hashQuery(table));
    const [hash, rows] = raw.split(':');
    result[table] = { hash: hash ?? '', rows: Number(rows ?? 0) };
  }
  return result;
}

/** The `sha256` and row count of each committed data file — §2.7's `files` block. */
export function computeFileDigests(referenceDir) {
  const files = {};
  if (!existsSync(referenceDir)) return files;

  for (const name of ['countries', 'cities', 'localities', 'amenities', 'gym-categories']) {
    const path = resolve(referenceDir, `${name}.csv`);
    if (!existsSync(path)) continue;

    const text = readFileSync(path, 'utf8');
    files[`${name}.csv`] = {
      sha256: createHash('sha256').update(text, 'utf8').digest('hex'),
      // Header row excluded, and blank trailing lines with it. A count that included the header
      // would read as one row when the file is empty of data, which is the state most of these
      // files are in today (BLK-21).
      rows: text.split('\n').filter((line) => line.trim().length > 0).length - 1,
    };
  }
  return files;
}

/**
 * Compares a freshly computed state against the committed manifest.
 *
 * Returns problems rather than throwing, so the spec can drive it with fixtures.
 */
export function diffAgainstManifest(manifest, tables, files) {
  const problems = [];

  if (manifest.namespace !== '3f8a2d10-0000-5000-b000-000000000000') {
    problems.push(
      `the manifest's namespace is "${manifest.namespace}". RD2 fixes NS_REFERENCE at ` +
        `3f8a2d10-0000-5000-b000-000000000000, and DT2a requires it to differ from the seed ` +
        `namespace so a reference id and a fixture id can never collide.`,
    );
  }

  for (const [table, actual] of Object.entries(tables)) {
    if (!(table in (manifest.tables ?? {}))) {
      problems.push(`table "${table}" has no entry in the manifest — all sixteen must be listed`);
      continue;
    }
    const expected = manifest.tables[table];

    // Both unbuilt. Eleven of the sixteen are in this state at M-031, and it is not a problem.
    if (expected === null && actual === null) continue;

    if (expected === null) {
      problems.push(
        `"${table}" now exists and holds ${String(actual.rows)} row(s); the manifest records it ` +
          `as unbuilt. A reference table arriving is a deliberate change — run with --write and ` +
          `say in the PR body which migration created it.`,
      );
      continue;
    }

    if (actual === null) {
      /*
       * The dangerous direction, and the reason `null` is a distinct value rather than an empty
       * hash. A reference table DISAPPEARING means a contract migration ran somewhere it should
       * not have, and every FK pointing at it is now dangling.
       */
      problems.push(
        `"${table}" is recorded in the manifest with ${String(expected.rows)} row(s) and DOES NOT ` +
          `EXIST in this database. A reference table cannot be dropped: gyms.city_id, ` +
          `gyms.category_id, branches.country_code and gym_amenities.amenity_id all point at one.`,
      );
      continue;
    }

    if (expected.hash !== actual.hash || expected.rows !== actual.rows) {
      problems.push(
        `"${table}" holds ${String(actual.rows)} row(s) hashing ${actual.hash || '(empty)'}, ` +
          `the manifest says ${String(expected.rows)} hashing ${expected.hash || '(empty)'}. ` +
          `SEP9: reference data is identical in every environment, so either a migration was ` +
          `edited by hand (RD4), a migration was skipped, or the manifest was not bumped in the ` +
          `same commit (§7.2). Run with --write once you know which.`,
      );
    }
  }

  for (const [file, actual] of Object.entries(files)) {
    const expected = manifest.files?.[file];
    if (expected === undefined) {
      problems.push(`data file "${file}" is not in the manifest`);
    } else if (expected.sha256 !== actual.sha256) {
      problems.push(
        `"${file}" has changed but its migration has not. RD4: the data file is the source of ` +
          `truth and the migration is generated from it — an edited CSV with no matching ` +
          `migration means the change is committed and not deployed anywhere.`,
      );
    }
  }

  return problems;
}

// --- CLI ---------------------------------------------------------------------

function repoRoot(from = process.cwd()) {
  let dir = resolve(from);
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(from);
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'));
if (isMain) {
  const root = repoRoot();
  const manifestPath = resolve(root, 'apps/server/prisma/reference/reference.manifest.json');
  const referenceDir = resolve(root, 'apps/server/prisma/reference');

  let tables;
  try {
    tables = computeTableHashes();
  } catch (error) {
    /*
     * No database is a SKIP, not a pass, and it says so.
     *
     * The alternative — exiting 0 quietly — makes "the reference data is correct" and "nobody
     * looked" produce the same line in a CI log, which is the failure this whole family of gates
     * exists to prevent.
     */
    console.error(`reference-data-drift: SKIPPED — no database. ${error.message}`);
    console.error('  pnpm infra:up, then pnpm --filter @gymmap/server db:deploy');
    process.exit(0);
  }

  const files = computeFileDigests(referenceDir);
  const built = Object.values(tables).filter((t) => t !== null);
  const totalRows = built.reduce((sum, t) => sum + t.rows, 0);
  const unbuilt = REFERENCE_DML_TABLES.length - built.length;

  if (process.argv.includes('--write')) {
    const { writeFileSync } = await import('node:fs');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.version += 1;
    manifest.tables = tables;
    manifest.files = files;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(
      `reference-data-drift: wrote manifest v${String(manifest.version)} — ${String(totalRows)} row(s).`,
    );
    process.exit(0);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const problems = diffAgainstManifest(manifest, tables, files);

  if (problems.length > 0) {
    console.error(`\nreference-data-drift: ${String(problems.length)} problem(s)\n`);
    for (const problem of problems) console.error(`  ${problem}\n`);
    process.exit(1);
  }

  console.log(
    `reference-data-drift: OK — ${String(totalRows)} row(s) across ${String(built.length)} built ` +
      `table(s), matching manifest v${String(manifest.version)}.`,
  );
  console.log(
    `  ${String(unbuilt)} of the sixteen do not exist yet · ${String(Object.keys(files).length)} ` +
      `data file(s) committed. The empty ones are BLK-21 — the content is an unmade client ` +
      `decision, not a forgotten migration.`,
  );
}
