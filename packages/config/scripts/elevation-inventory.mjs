/**
 * M-014 AC-7 · CI job `elevation-inventory` — every cross-tenant read, enumerated and diffed.
 *
 * ┌─ WHAT THIS EXISTS TO STOP ──────────────────────────────────────────────────────────────────┐
 * │ `no-platform-prisma-outside-allowlist` answers "may this module cross the boundary". It      │
 * │ cannot answer the question that actually matters two years from now: "how many places DO,   │
 * │ and did that number grow this quarter?"                                                      │
 * │                                                                                              │
 * │ The failure it prevents is not a breach. It is drift. `admin/` is on the allow-list, so the │
 * │ fortieth `runElevated()` inside `admin/` passes every gate the repository has — and nobody  │
 * │ ever decided that forty cross-tenant reads was acceptable. Each one was reviewed alone and  │
 * │ each one looked fine.                                                                        │
 * │                                                                                              │
 * │ So the inventory is COMMITTED. Adding a call site changes a checked-in file, which puts the │
 * │ growth in the diff where a reviewer sees the total, not just the addition.                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Deliberately a REGEX scan and not a TypeScript AST walk. The `typescript` compiler API would be
 * more precise, and the precision buys nothing here: this is a tripwire, and a tripwire that a
 * clever call site can evade is still doing its job — evading it requires writing something that
 * does not look like `runElevated(`, which is itself the review signal. An AST pass would add a
 * compiler dependency to a gate that must run in under a second.
 *
 * Usage:
 *   node packages/config/scripts/elevation-inventory.mjs           # print the inventory
 *   node packages/config/scripts/elevation-inventory.mjs --check   # diff against the committed file
 *   node packages/config/scripts/elevation-inventory.mjs --write   # accept the current state
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';

const ROOT = resolve(process.cwd());
const SCAN_ROOT = join(ROOT, 'apps', 'server', 'src');
const COMMITTED = join(
  ROOT,
  'apps',
  'server',
  'test',
  'isolation',
  '_elevation-inventory.committed.json',
);

/**
 * The four modules `no-platform-prisma-outside-allowlist` permits, plus `tenancy` which owns the
 * mechanism. Duplicated from the dependency-cruiser rule ON PURPOSE, and asserted equal by
 * `elevation-inventory.spec.mjs` — importing the .cjs rule set into an .mjs gate would couple a
 * one-second tripwire to the whole architecture config for one array.
 */
export const ELEVATION_ALLOWLIST = ['admin', 'audit', 'reporting', 'settlements', 'tenancy'];

/** Must match `ELEVATION_SCOPES` in platform-elevation.ts. Asserted by the spec. */
export const KNOWN_SCOPES = [
  'READ_ALL_TENANTS',
  'READ_ONE_TENANT',
  'READ_FINANCIAL_AGGREGATE',
  'READ_AUDIT',
];

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(name) && !/\.(spec|test|d)\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * Blanks out comments, preserving every newline so reported line numbers still line up.
 *
 * The first version of this gate scanned raw source and reported seventeen violations, all of
 * them PROSE — the doc comments in `platform-elevation.ts` that explain what `runElevated()` is
 * for. A tripwire that fires on its own documentation is worse than no tripwire: it trains
 * whoever maintains it to pass `--write` without reading the diff, which is the exact reflex the
 * committed inventory exists to prevent.
 *
 * String literals are kept only when they contain NO SPACE. That reads as a hack and is not:
 * the two literals this gate must read — `scope: 'READ_ALL_TENANTS'` and
 * `permission: 'admin.application.read'` — are enum members and dotted permission keys, neither
 * of which can contain a space. Everything with a space in it is prose, and prose is what
 * produced the three remaining false positives after comments were handled (error messages that
 * mention `runElevated()` by name, which good error messages should).
 *
 * The alternative — blanking every string — would make every call site report `DYNAMIC`, which
 * this gate treats as a violation. So the discriminator has to be finer than "is a string".
 *
 * The scanner walks quotes rather than regex-replacing them, because a `//` inside a URL string
 * would otherwise blank the rest of the line — including a real call site on it.
 */
export function stripComments(source) {
  let out = '';
  let i = 0;
  const keepNewlines = (text) => text.replace(/[^\n]/g, ' ');

  while (i < source.length) {
    const two = source.slice(i, i + 2);

    if (two === '//') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      out += keepNewlines(source.slice(i, stop));
      i = stop;
      continue;
    }

    if (two === '/*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      out += keepNewlines(source.slice(i, stop));
      i = stop;
      continue;
    }

    if (source[i] === '"' || source[i] === "'" || source[i] === '`') {
      const end = endOfString(source, i, source[i]);
      out += redactProse(source.slice(i, end));
      i = end;
      continue;
    }

    out += source[i];
    i += 1;
  }
  return out;
}

/** Index just past the closing quote, honouring backslash escapes. */
function endOfString(source, start, quote) {
  let j = start + 1;
  while (j < source.length) {
    if (source[j] === '\\') {
      j += 2;
      continue;
    }
    if (source[j] === quote) return j + 1;
    j += 1;
  }
  return source.length;
}

/**
 * Blanks a string literal's body if it looks like prose, keeping its exact length.
 *
 * Length is preserved rather than merely newline count, so a scope literal later on the same
 * line is still found at a sensible column and the reported line number never drifts.
 */
function redactProse(literal) {
  if (literal.length < 2 || !literal.includes(' ')) return literal;
  return literal[0] + literal.slice(1, -1).replace(/[^\n]/g, ' ') + literal[literal.length - 1];
}

/**
 * Finds `runElevated(` and reads the `scope:` and `permission:` nearest to it.
 *
 * The window is the 25 lines following the call, which covers an options object written across
 * several lines. A call whose scope is computed rather than written literally records `DYNAMIC`
 * — deliberately visible rather than dropped, because a computed scope is exactly the shape that
 * would let the inventory undercount.
 */
function scanFile(file) {
  return scanSource(relative(ROOT, file).split(sep).join('/'), readFileSync(file, 'utf8'));
}

/**
 * The scanner proper, taking source as a string.
 *
 * Split out from `scanFile` so the spec can feed it a fixture. That matters more here than it
 * usually would: this gate's baseline is ZERO — nothing in `src/` calls `runElevated()` yet —
 * and a scanner that found nothing because it was broken would report the same zero. The spec's
 * positive control is what distinguishes "no call sites" from "no working scanner".
 */
export function scanSource(relPath, rawSource) {
  const source = stripComments(rawSource);
  const lines = source.split('\n');
  const module = relPath.split('/')[3] ?? 'unknown';
  const found = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!/\brunElevated\s*[(<]/.test(lines[i])) continue;
    // The definition and re-exports are not call sites. Without this the inventory lists the
    // implementation itself and every consumer sees a permanent phantom entry.
    if (/^\s*(export\s+)?(async\s+)?function\s+runElevated/.test(lines[i])) continue;
    if (/^\s*(export|import)\s+.*runElevated/.test(lines[i])) continue;

    const window = lines.slice(i, i + 25).join('\n');
    const scopeMatch = /scope\s*:\s*'([A-Z_]+)'/.exec(window);
    const permMatch = /permission\s*:\s*'([a-zA-Z0-9._-]+)'/.exec(window);

    found.push({
      module,
      file: relPath,
      line: i + 1,
      scope: scopeMatch ? scopeMatch[1] : 'DYNAMIC',
      permission: permMatch ? permMatch[1] : 'UNKNOWN',
    });
  }
  return found;
}

export function buildInventory() {
  const sites = walk(SCAN_ROOT).flatMap(scanFile);
  // Sorted so the committed file is stable — an unsorted inventory produces a diff every time
  // the filesystem returns entries in a different order, and a gate that cries wolf gets muted.
  sites.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  const byScope = {};
  for (const scope of KNOWN_SCOPES) byScope[scope] = 0;
  for (const site of sites) byScope[site.scope] = (byScope[site.scope] ?? 0) + 1;

  return { total: sites.length, byScope, sites };
}

/**
 * The violations that are errors regardless of what the committed file says.
 *
 * A call site outside the allow-list, or one whose scope is not in the closed set, is wrong even
 * on the first commit — so it must not be acceptable merely by being written down.
 */
export function violations(inventory) {
  const problems = [];
  for (const site of inventory.sites) {
    if (!ELEVATION_ALLOWLIST.includes(site.module)) {
      problems.push(
        `${site.file}:${site.line} — runElevated() in module '${site.module}', which is not on ` +
          `the allow-list (${ELEVATION_ALLOWLIST.join(', ')}). AC-FND-05.3.`,
      );
    }
    if (site.scope === 'DYNAMIC') {
      problems.push(
        `${site.file}:${site.line} — the elevation scope is computed rather than written as a ` +
          `literal. A computed scope cannot be inventoried, so the count below undercounts, ` +
          `which is the one failure mode this gate cannot tolerate.`,
      );
    } else if (!KNOWN_SCOPES.includes(site.scope)) {
      problems.push(`${site.file}:${site.line} — unknown elevation scope '${site.scope}'.`);
    }
  }
  return problems;
}

function render(inventory) {
  const lines = [
    `Cross-tenant read sites: ${inventory.total}`,
    '',
    ...KNOWN_SCOPES.map((s) => `  ${s.padEnd(26)} ${inventory.byScope[s] ?? 0}`),
    '',
  ];
  for (const site of inventory.sites) {
    lines.push(`  ${site.file}:${site.line}  ${site.scope}  ${site.permission}`);
  }
  return lines.join('\n');
}

function main() {
  const mode = process.argv[2] ?? '--print';
  const inventory = buildInventory();

  const problems = violations(inventory);
  if (problems.length > 0) {
    console.error('elevation-inventory FAILED\n');
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }

  if (mode === '--write') {
    writeFileSync(COMMITTED, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${relative(ROOT, COMMITTED)} — ${inventory.total} site(s).`);
    return;
  }

  if (mode === '--check') {
    if (!existsSync(COMMITTED)) {
      console.error(
        `elevation-inventory FAILED\n\n  ✗ ${relative(ROOT, COMMITTED)} does not exist. Run ` +
          `\`node packages/config/scripts/elevation-inventory.mjs --write\` and commit it.`,
      );
      process.exit(1);
    }
    const expected = readFileSync(COMMITTED, 'utf8').trim();
    const actual = JSON.stringify(inventory, null, 2).trim();
    if (expected !== actual) {
      const before = JSON.parse(expected);
      console.error(
        'elevation-inventory FAILED\n\n' +
          `  The set of cross-tenant read sites changed: ${before.total} → ${inventory.total}.\n\n` +
          '  This is not automatically wrong — it is a number that must be decided rather than\n' +
          '  accumulated. Each site individually looks reasonable; the total is what nobody\n' +
          '  reviews unless it is in the diff.\n\n' +
          '  If the change is intended: run with --write, commit the inventory alongside the\n' +
          '  code, and say in the PR body why one more place needs to read across tenants.\n',
      );
      console.error(render(inventory));
      process.exit(1);
    }
    console.log(`elevation-inventory OK — ${inventory.total} site(s), unchanged.`);
    return;
  }

  console.log(render(inventory));
}

// `import.meta` does not compile in apps/server, but this file is a standalone .mjs gate that is
// never type-checked as part of that project, so the ESM main-module guard is available here.
if (process.argv[1] && process.argv[1].endsWith('elevation-inventory.mjs')) main();
