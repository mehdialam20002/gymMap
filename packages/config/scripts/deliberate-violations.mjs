/**
 * Runner for `.github/deliberate-violations/*.spec.sh` — the gate-that-guards-the-gates suite.
 *
 * ┌─ WHY THIS IS A NODE SCRIPT AND NOT A ONE-LINE `for` LOOP ───────────────────────────────────┐
 * │ It was a POSIX `for` loop in the root `package.json`. npm runs a script through the         │
 * │ platform's default shell, which on Windows is `cmd.exe` — where that loop is a syntax error │
 * │ ("f was unexpected at this time"). So `pnpm ci:violations` failed on a Windows machine for  │
 * │ a reason that had nothing to do with any violation, and the whole point of this suite is    │
 * │ that a gate whose failure is routine stops being read.                                       │
 * │                                                                                              │
 * │ The specs themselves stay `bash`: they manufacture a violation, run a real gate, and assert │
 * │ it went red. Rewriting four of those in Node would rewrite the thing being trusted. This    │
 * │ only replaces the loop AROUND them, and it spawns the same `bash` the CI runner uses.        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Fails on the first spec that fails, exactly as the loop did — a suite that keeps going after a
 * gate has been shown to be inert produces three more results nobody can act on yet.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SPEC_DIR = '.github/deliberate-violations';

const repoRoot = process.cwd();
const specDir = resolve(repoRoot, SPEC_DIR);

const specs = readdirSync(specDir)
  .filter((name) => name.endsWith('.spec.sh'))
  .sort();

if (specs.length === 0) {
  // An empty directory is not a pass. These four specs are the only evidence that the ten CI
  // gates fail when they should, and a rename or a bad glob that silently matched nothing would
  // otherwise report success.
  console.error(
    `deliberate-violations: no *.spec.sh found in ${SPEC_DIR}. That is a failure, ` +
      `not an empty suite — these specs are the only proof the gates are not inert.`,
  );
  process.exit(1);
}

for (const spec of specs) {
  const result = spawnSync('bash', [join(SPEC_DIR, spec)], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    console.error(`deliberate-violations: could not run ${spec} — ${result.error.message}`);
    console.error('  `bash` must be on PATH. On Windows that is Git Bash, which ships with Git.');
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`\ndeliberate-violations: ${spec} FAILED (exit ${result.status}).`);
    process.exit(result.status ?? 1);
  }
}

console.log(`\ndeliberate-violations: OK — ${specs.length} spec(s), every gate shown to bite.`);
