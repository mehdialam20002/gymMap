/**
 * M-006 · Generates the `CREATE TYPE … AS ENUM` block of `0_init` from the specification.
 *
 * 81 enum types and 460 values. Retyping those by hand is how a value ends up as `CANCELED`
 * in the database and `CANCELLED` in `packages/types` — a mismatch that no test catches until
 * a row fails to insert in whatever month that path first runs.
 *
 * Schema.md §2.5 says values are "SCREAMING_SNAKE_CASE matching the PRD verbatim". This script
 * makes "verbatim" mechanical: the catalogue table in the specification IS the source, and the
 * SQL is derived from it.
 *
 * Run once; the OUTPUT is committed as part of the migration. A migration file is immutable
 * (PM-4 — a correction is a new migration), so this is a one-time generator, not a build step.
 * It is kept so the next person can prove the migration matches the specification.
 *
 *     node packages/config/scripts/generate-enum-sql.mjs > /path/to/enums.sql
 */

import { readFileSync } from 'node:fs';

const ROW = /^\|\s`([a-z_]+_enum)`\s\|\s(.+?)\s\|\s(.+?)\s\|$/gm;
const VALUE = /`([A-Z][A-Z0-9_]*)`/g;

function between(text, startHeading, endHeading) {
  const after = text.split(new RegExp(`^### ${startHeading}`, 'm'))[1];
  if (after === undefined) throw new Error(`section ${startHeading} not found`);
  return after.split(new RegExp(`^### ${endHeading}`, 'm'))[0];
}

export function collectEnums(repoRoot = process.cwd()) {
  const schema = readFileSync(`${repoRoot}/docs/database/Schema.md`, 'utf8');
  const catalogue = between(schema, '2\\.5', '2\\.6');

  const enums = [];
  const deferred = [];

  for (const [, name, cell, cite] of catalogue.matchAll(ROW)) {
    const values = [...cell.matchAll(VALUE)].map((m) => m[1]);
    if (values.length === 0) {
      deferred.push({ name, cell, cite });
      continue;
    }
    enums.push({ name, values, cite: cite.replace(/\|/g, '').trim() });
  }

  // `audit_entity_type_enum` lists its 31 values in AuditStrategy.md §1.3 rather than inline.
  // Schema.md §2.5 cites that file as `AuditStrategy.md`; it actually lives under docs/database/.
  const audit = readFileSync(`${repoRoot}/docs/database/AuditStrategy.md`, 'utf8');
  const section = between(audit, '1\\.3', '1\\.4');
  const auditValues = [...section.matchAll(/^\|\s*\d+\s*\|\s*`([A-Z][A-Z0-9_]*)`/gm)].map(
    (m) => m[1],
  );
  if (auditValues.length !== 31) {
    throw new Error(
      `AuditStrategy.md §1.3 yielded ${auditValues.length} values; Schema.md §2.5 and ` +
        `AuditStrategy.md §1.3 both say 31. Refusing to generate a partial enum.`,
    );
  }
  enums.push({
    name: 'audit_entity_type_enum',
    values: auditValues,
    cite: 'BR-DAT-01, AuditStrategy.md §1.3 — the 31 governed entities',
  });

  enums.sort((a, b) => a.name.localeCompare(b.name));
  return { enums, deferred };
}

function truncate(text, max = 100) {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 3)}...` : oneLine;
}

export function renderEnumSql(enums) {
  return enums
    .map(
      ({ name, values, cite }) =>
        `-- ${truncate(cite)}\n` +
        `CREATE TYPE ${name} AS ENUM (\n` +
        values.map((v) => `  '${v}'`).join(',\n') +
        `\n);`,
    )
    .join('\n\n');
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
  const { enums, deferred } = collectEnums(process.cwd());
  process.stdout.write(renderEnumSql(enums));
  process.stderr.write(
    `\ngenerated ${enums.length} enum types, ` +
      `${enums.reduce((n, e) => n + e.values.length, 0)} values\n`,
  );
  for (const d of deferred) {
    process.stderr.write(`DEFERRED ${d.name}: ${truncate(d.cell, 80)}\n`);
  }
}
