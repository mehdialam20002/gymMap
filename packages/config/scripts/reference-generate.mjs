/**
 * `M-031` · `pnpm ref:generate` — `SeedStrategy.md` `RD4`, `RD2`, `RD5`, `SEP1`.
 *
 * ┌─ THE MIGRATION IS GENERATED FROM THE DATA FILE, NEVER HAND-WRITTEN ──────────────────────────┐
 * │ `RD4`: *"`prisma/reference/*.csv` and `*.json` are the source of truth a human edits.         │
 * │ `pnpm ref:generate` emits the migration SQL. A hand-edited migration whose content does not   │
 * │ match the data file fails `reference-data-drift`."*                                            │
 * │                                                                                              │
 * │ So a person edits a CSV — a shape they can diff, review and sort — and this turns it into the │
 * │ one artefact `SEP1` permits: a versioned migration. Nobody writes 59 `INSERT` statements by    │
 * │ hand, and nobody has to review 59 of them for a typo in a uuid.                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE ID IS DERIVED HERE, WHICH IS WHY IT NEVER APPEARS IN A CSV ─────────────────────────────┐
 * │ `RD2`: `uuid_v5(NS_REFERENCE, '<table>:<business-key>')`. The generator computes it, so a     │
 * │ data file carries the business key and nothing else — and a human cannot get a uuid wrong,     │
 * │ because a human never types one. It is also what makes `SEP9`'s drift check a set comparison:  │
 * │ the same key gives the same id in every environment and every clone.                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ NO `ON CONFLICT DO NOTHING` — `RD5`, AND IT POINTS THE OPPOSITE WAY TO `PM-9` ──────────────┐
 * │ *"Silent no-op is how two environments diverge without anyone noticing … a reference          │
 * │ migration is written as a plain `INSERT` and is allowed to fail loudly if the row already      │
 * │ exists, because under forward-only migrations (`MG1`) it can only already exist if the         │
 * │ migration ran twice — which is itself the defect."*                                             │
 * │                                                                                              │
 * │ `PM-9` wants `IF NOT EXISTS` on DDL so a partial failure is re-appliable. `RD5` wants DML to   │
 * │ be LOUD. Both are right about their own half, and `migration-lint` checks `CREATE`, not        │
 * │ `INSERT`.                                                                                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/** `RD2`. Distinct from the `§C8.2` seed namespace by `DT2a`, so ids can never collide. */
export const NS_REFERENCE = '3f8a2d10-0000-5000-b000-000000000000';

/**
 * §2.1's stable identifier per table — the business key the uuid derives from.
 *
 * Transcribed from the §2.1 table, not inferred. A wrong key here would give every row in that
 * table a wrong-but-stable id, which is the failure mode that survives every test.
 */
export const BUSINESS_KEY = {
  countries: (row) => row.code,
  cities: (row) => `${row.country_code}:${row.slug}`,
  localities: (row) => `${row.city_slug}:${row.slug}`,
  amenities: (row) => row.key,
  gym_categories: (row) => row.key,
};

export function uuidV5(namespace, name) {
  const nb = Buffer.from(namespace.replaceAll('-', ''), 'hex');
  const h = createHash('sha1').update(nb).update(name, 'utf8').digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const x = b.toString('hex');
  return [x.slice(0, 8), x.slice(8, 12), x.slice(12, 16), x.slice(16, 20), x.slice(20, 32)].join(
    '-',
  );
}

export const referenceUuid = (table, key) => uuidV5(NS_REFERENCE, `${table}:${key}`);

/**
 * A deliberately small CSV reader: header row, comma-separated, no quoting.
 *
 * Not a parser dependency, and not because one would be unapproved — `papaparse` is `A-20` and is
 * approved. It is because these files are a CLOSED set written by this project to a shape this
 * project chose, and a quoted field would mean a name containing a comma, which no display name
 * here has and none should. A reader that cannot express the ambiguity cannot import it.
 */
export function readCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].split(',').map((h) => h.trim());

  return lines.slice(1).map((line, i) => {
    const cells = line.split(',');
    if (cells.length !== header.length) {
      throw new Error(
        `row ${String(i + 2)} has ${String(cells.length)} cells, header has ${String(header.length)}. ` +
          `A display name containing a comma is the likely cause — rename it rather than quoting it.`,
      );
    }
    return Object.fromEntries(header.map((h, j) => [h, cells[j].trim()]));
  });
}

/** `'` doubled. The only values here are display names and slugs; nothing else can appear. */
const quote = (v) => `'${String(v).replaceAll("'", "''")}'`;

/**
 * Columns whose SQL is an EXPRESSION rather than a literal, keyed by table.
 *
 * ┌─ `centroid` IS THE ONLY ONE, AND IT HAS TO BE ───────────────────────────────────────────────┐
 * │ `cities.centroid` is `geography(Point,4326)`. A CSV can hold two numbers; it cannot hold a    │
 * │ PostGIS constructor, and quoting one would emit a string literal that fails the cast.          │
 * │                                                                                              │
 * │ `ST_MakePoint` takes LONGITUDE FIRST. That argument order is the single easiest thing to get  │
 * │ wrong here, and getting it wrong puts Mumbai in the Indian Ocean off Somalia — a plausible    │
 * │ point, on the right planet, that no test comparing "is it a valid geography" would catch. The │
 * │ CSV names its columns `latitude` and `longitude` so the swap has to be made deliberately.      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const EXPRESSIONS = {
  cities: {
    centroid: (row) =>
      `ST_SetSRID(ST_MakePoint(${Number(row.longitude)}, ${Number(row.latitude)}), 4326)::geography`,
  },
};

/** A column's SQL: an expression where one is registered, otherwise a quoted literal. */
function cell(table, column, row) {
  const expression = EXPRESSIONS[table]?.[column];
  return expression === undefined ? quote(row[column]) : expression(row);
}

/**
 * One table's `INSERT`, rows ordered by business key.
 *
 * Ordered so the generated SQL is stable across runs — an unordered emit would produce a different
 * file from the same CSV and `reference-data-drift` would report a change nobody made.
 */
export function emitInsert(table, rows, columns) {
  const keyed = rows
    .map((row) => ({ id: referenceUuid(table, BUSINESS_KEY[table](row)), row }))
    .sort((a, b) => (BUSINESS_KEY[table](a.row) < BUSINESS_KEY[table](b.row) ? -1 : 1));

  const values = keyed
    .map(
      ({ id, row }) => `  (${[quote(id), ...columns.map((c) => cell(table, c, row))].join(', ')})`,
    )
    .join(',\n');

  return `INSERT INTO ${table} (id, ${columns.join(', ')}) VALUES\n${values};`;
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
  const dir = resolve(root, 'apps/server/prisma/reference');

  /** Which CSV feeds which table, and which columns it emits. `id` is always derived. */
  const PLAN = [
    {
      file: 'amenities.csv',
      table: 'amenities',
      columns: ['key', 'name', 'icon', 'display_group', 'sort_order'],
    },
    {
      file: 'gym-categories.csv',
      table: 'gym_categories',
      columns: ['key', 'name', 'slug', 'sort_order'],
    },
    {
      file: 'cities.csv',
      table: 'cities',
      columns: ['country_code', 'name', 'slug', 'centroid', 'status', 'timezone'],
    },
  ];

  /*
   * `--tables=a,b` selects which of the plan lands in this migration.
   *
   * Needed because a reference migration is one deploy of one decision, not "every CSV that
   * exists". The taxonomy shipped before cities did, and re-emitting the taxonomy into the cities
   * migration would attempt 74 duplicate INSERTs — which `RD5` correctly makes fail loudly.
   */
  const only = process.argv
    .find((a) => a.startsWith('--tables='))
    ?.slice('--tables='.length)
    .split(',');

  const blocks = [];
  for (const { file, table, columns } of PLAN.filter((p) => !only || only.includes(p.table))) {
    const path = resolve(dir, file);
    if (!existsSync(path)) {
      console.error(`ref:generate: ${file} is absent — skipping ${table}`);
      continue;
    }
    const rows = readCsv(readFileSync(path, 'utf8'));
    blocks.push({ table, file, count: rows.length, sql: emitInsert(table, rows, columns) });
  }

  if (blocks.length === 0) {
    console.error('ref:generate: no data files found. Nothing emitted.');
    process.exit(1);
  }

  const target = process.argv[2];
  if (target === undefined) {
    for (const b of blocks) console.log(`${b.sql}\n`);
    console.error(
      `\nref:generate: printed ${String(blocks.reduce((n, b) => n + b.count, 0))} row(s). ` +
        `Pass a migration directory name to write a file.`,
    );
    process.exit(0);
  }

  const outDir = resolve(root, 'apps/server/prisma/migrations', target);
  mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, 'migration.sql');

  /*
   * A header per migration, not one shared template.
   *
   * `§2.4`'s fifteen header keys include `tables`, `est_duration` and `rollback`, and those are
   * different for every reference migration — a shared header would be wrong for all but the first,
   * and a header that is wrong is worse than none because `migration-lint` still passes it.
   */
  const headerPath = resolve(dir, `HEADER.${target}.sql`);
  if (!existsSync(headerPath)) {
    console.error(`ref:generate: no header at ${headerPath}. Write one — §2.4 wants fifteen keys.`);
    process.exit(1);
  }
  const header = readFileSync(headerPath, 'utf8');
  const body = blocks
    .map((b) => `-- ${b.table}: ${String(b.count)} row(s), generated from ${b.file}\n${b.sql}`)
    .join('\n\n');

  writeFileSync(out, `${header}\n${body}\n`);
  console.log(`ref:generate: wrote ${out}`);
  for (const b of blocks) console.log(`  ${b.table}: ${String(b.count)} row(s)`);
}
