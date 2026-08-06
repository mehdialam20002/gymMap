/**
 * M-007 AC-7 · Every third-party GitHub Action is pinned by COMMIT SHA, not by tag.
 * CI_CD.md §2.5.
 *
 * A tag is mutable. `actions/checkout@v4` runs whatever `v4` points at today, and the owner —
 * or anyone who compromises the owner's account — can repoint it. An action runs INSIDE the job,
 * with the job's token and the checked-out source. That is arbitrary code execution with
 * repository credentials, granted by a reference that looks like a version number.
 *
 * A 40-character SHA is immutable. It is uglier and it is the only form that means anything.
 *
 * Local actions (`./.github/actions/...`) are exempt: they live in this repository, so they are
 * already covered by review and by the same commit.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SHA = /^[0-9a-f]{40}$/;

export function findUnpinnedActions(repoRoot = process.cwd()) {
  const problems = [];
  const roots = [resolve(repoRoot, '.github/workflows'), resolve(repoRoot, '.github/actions')];

  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const file of walk(root)) {
      if (!/\.ya?ml$/.test(file)) continue;
      const lines = readFileSync(file, 'utf8').split('\n');

      lines.forEach((line, index) => {
        const match = /^\s*(?:-\s+)?uses:\s*(\S+)/.exec(line);
        if (!match) return;
        const reference = match[1].replace(/['"]/g, '');

        // Local composite actions and Docker references are not the risk this rule addresses.
        if (reference.startsWith('./') || reference.startsWith('docker://')) return;

        const at = reference.lastIndexOf('@');
        const relative = file.slice(repoRoot.length + 1).replace(/\\/g, '/');

        if (at === -1) {
          problems.push({
            file: relative,
            line: index + 1,
            reference,
            message:
              `"${reference}" has no version reference at all — it resolves to the ` +
              `action's default branch, which changes without notice.`,
          });
          return;
        }

        const version = reference.slice(at + 1);
        if (!SHA.test(version)) {
          problems.push({
            file: relative,
            line: index + 1,
            reference,
            message:
              `"${reference}" is pinned to the mutable tag "${version}". An action runs inside ` +
              `the job with its token and the checked-out source, so a repointed tag is ` +
              `arbitrary code execution with repository credentials. Pin the 40-character ` +
              `commit SHA and keep the version as a trailing comment.`,
          });
        }
      });
    }
  }
  return problems;
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
  const problems = findUnpinnedActions(process.cwd());
  if (problems.length === 0) {
    console.log('actions-pinned: OK — every third-party action is pinned by commit SHA.');
    process.exit(0);
  }
  console.error(`actions-pinned: ${problems.length} unpinned action(s)\n`);
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line}`);
    console.error(`      ${p.message}\n`);
  }
  process.exit(1);
}
