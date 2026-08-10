/**
 * Your `.env.local` is behind the `.env.example` it was copied from.
 *
 * ┌─ WHY THIS EXISTS — IT COST A MORNING ON 2026-08-11 ───────────────────────────────────────────┐
 * │ `CLAMAV_HOST` was added to `app-config.schema.ts` as a required key (A-42, ADR-0048) and to    │
 * │ `.env.example` in the same change. Correct, complete, and `env-example-parity.spec.ts` passed  │
 * │ on it — and the next `pnpm dev` still would not start.                                         │
 * │                                                                                                │
 * │ `.env.local` is git-ignored by design (`NFR-SEC-07`), which means it is a COPY taken once and  │
 * │ never updated again. No spec can see it, because no CI checkout has one. What the developer    │
 * │ actually saw first was `[vite] http proxy error: ECONNREFUSED 127.0.0.1:3000` — a message from │
 * │ the wrong process, in the wrong workspace, that mentions no environment variable at all. The   │
 * │ real error was eleven lines further down, under four interleaved `turbo run dev` streams.      │
 * └────────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT THIS DELIBERATELY DOES NOT CHECK ──────────────────────────────────────────────────────┐
 * │ Schema ↔ `.env.example` is already covered, and covered BETTER, by                            │
 * │ `apps/server/test/env-example-parity.spec.ts` — which does not compare key lists but parses   │
 * │ the example through the real Zod schema and asserts a developer copying it verbatim gets a    │
 * │ running server. A key-list version of that here would be a second list that agrees with the   │
 * │ first only until somebody is in a hurry, which is the exact failure `dependency-approval.mjs` │
 * │ warns about in its own header.                                                                 │
 * │                                                                                               │
 * │ So this file owns exactly the half no test can reach: the untracked copy on a real machine.   │
 * └────────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   A  every key in an `.env.example` appears in the `.env.local` beside it
 *   B  no `.env.local` exists without a sibling `.env.example`
 *
 * Both self-skip where there is nothing to compare, so this is safe in CI and on a fresh clone —
 * it reports OK rather than inventing a failure about files that are absent by design.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * Derived from this file's own location, never from `process.cwd()`.
 *
 * `reference-data-drift.spec.mjs` had exactly this bug: turbo runs a workspace script with the CWD
 * set to that workspace, so every root-relative read returned nothing and the check reported OK on
 * an empty set. A gate that passes because it looked at no files is the worst kind there is.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '.turbo', 'dist', 'coverage', 'build']);

/** `KEY=` lines only. A comment is not a declaration, and neither is `# KEY=`. */
export function keysIn(file) {
  const keys = new Set();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^(\w+)=/.exec(line.trim());
    if (match) keys.add(match[1]);
  }
  return keys;
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(join(dir, entry.name));
    } else yield join(dir, entry.name);
  }
}

/** A · each template against the copy somebody actually took from it. */
function findStaleCopies(examples, rel) {
  const problems = [];
  for (const example of examples) {
    const local = join(dirname(example), '.env.local');
    if (!existsSync(local)) continue; // CI, and a fresh clone before setup. Not a failure.

    const present = keysIn(local);
    const behind = [...keysIn(example)].filter((key) => !present.has(key));
    if (behind.length === 0) continue;

    problems.push({
      file: rel(local),
      message:
        `${behind.length} key(s) have been added to ${rel(example)} since this copy was taken:\n` +
        `        ${behind.join(', ')}\n` +
        `      Copy those lines across, values and comments together. This file is git-ignored, ` +
        `so no test and no CI job will ever tell you — and one required key among them is a ` +
        `server that will not boot.`,
    });
  }
  return problems;
}

/** B · a copy with nothing to be a copy OF. */
function findOrphans(locals, rel) {
  return locals
    .filter((local) => !existsSync(join(dirname(local), '.env.example')))
    .map((local) => ({
      file: rel(local),
      message:
        'no .env.example sits beside this file, so no process is documented as reading it. ' +
        'Either it is dead and should be deleted, or something does load it and owes this ' +
        'directory a template. An edit to an unread env file changes nothing and looks exactly ' +
        'like a bug in the code that ignored it.',
    }));
}

export function findEnvLocalDrift(repoRoot = ROOT) {
  const rel = (p) => p.slice(repoRoot.length + 1).replaceAll('\\', '/');

  const examples = [];
  const locals = [];
  for (const file of walk(repoRoot)) {
    if (file.endsWith('.env.example')) examples.push(file);
    else if (file.endsWith('.env.local')) locals.push(file);
  }

  return [...findStaleCopies(examples, rel), ...findOrphans(locals, rel)];
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'));
if (isMain) {
  const problems = findEnvLocalDrift();
  if (problems.length === 0) {
    console.log('env-local-drift: OK — every .env.local is current with its template.');
    process.exit(0);
  }
  console.error(`env-local-drift: ${problems.length} problem(s)\n`);
  for (const p of problems) {
    console.error(`  ${p.file}`);
    console.error(`      ${p.message}\n`);
  }
  process.exit(1);
}
