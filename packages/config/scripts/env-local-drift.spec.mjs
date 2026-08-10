/**
 * `env-local-drift.mjs` — the gate that stands between a stale `.env.local` and a lost morning.
 *
 * Every case runs against a temporary directory tree rather than the repository, because the
 * repository's own state is the thing the gate reports on: asserting against it would make the
 * suite pass or fail depending on what is in a git-ignored file on whoever's machine ran it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { findEnvLocalDrift, keysIn } from './env-local-drift.mjs';

/** Builds a throwaway tree: `{ 'a/.env.example': 'X=1', ... }`. Returns its root. */
function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'env-drift-'));
  for (const [path, body] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body, 'utf8');
  }
  return root;
}

const run = (files) => {
  const root = tree(files);
  try {
    return findEnvLocalDrift(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// A · the case that actually happened
// ═══════════════════════════════════════════════════════════════════════════

test('a key added to the template and missing from the copy is reported, by name', () => {
  const problems = run({
    '.env.example': 'DATABASE_URL=postgres://x\nCLAMAV_HOST=localhost\n',
    '.env.local': 'DATABASE_URL=postgres://x\n',
  });

  assert.equal(problems.length, 1);
  assert.match(problems[0].file, /\.env\.local$/);
  // The name is the whole value of the message — "something is missing" sends the reader back
  // to a diff, which is the work the gate exists to have already done.
  assert.match(problems[0].message, /CLAMAV_HOST/);
});

test('a current copy is silent', () => {
  assert.deepEqual(
    run({
      '.env.example': 'A=1\nB=2\n',
      '.env.local': 'A=9\nB=8\n',
    }),
    [],
  );
});

test('VALUES are never compared — only the presence of the key', () => {
  /*
   * The load-bearing distinction. `.env.local` holds machine-specific secrets and local ports by
   * definition; a gate that compared values would fire on every correctly-configured machine and
   * be switched off within a week. What rots is the KEY SET, and only the key set.
   */
  assert.deepEqual(
    run({
      '.env.example': 'JWT_ACCESS_SECRET=CHANGEME\nPORT=3000\n',
      '.env.local': 'JWT_ACCESS_SECRET=a-real-local-secret\nPORT=4000\n',
    }),
    [],
  );
});

test('a missing .env.local is not a failure — CI has none, and neither does a fresh clone', () => {
  assert.deepEqual(run({ '.env.example': 'A=1\n' }), []);
});

test('each app is checked against its OWN template, not the root one', () => {
  /*
   * `apps/customer-web` has a separate pair on purpose: Next reads `.env.local` from the app
   * directory, so a variable set at the root reaches it not at all. Comparing either file against
   * the other's template would report a screenful of false drift.
   */
  const problems = run({
    '.env.example': 'DATABASE_URL=x\n',
    '.env.local': 'DATABASE_URL=x\n',
    'apps/customer-web/.env.example': 'NEXT_PUBLIC_SITE_URL=http://localhost:3001\n',
    'apps/customer-web/.env.local': '',
  });

  assert.equal(problems.length, 1);
  assert.match(problems[0].file, /customer-web/);
  assert.match(problems[0].message, /NEXT_PUBLIC_SITE_URL/);
});

// ═══════════════════════════════════════════════════════════════════════════
// B · the orphan
// ═══════════════════════════════════════════════════════════════════════════

test('an .env.local with no template beside it is reported', () => {
  // `apps/server/.env.local` was exactly this: a copy of the root template, in a directory whose
  // dev script reads `../../.env.local`. Editing it changed nothing, silently.
  const problems = run({ 'apps/server/.env.local': 'DATABASE_URL=x\n' });

  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /no \.env\.example sits beside this file/);
});

// ═══════════════════════════════════════════════════════════════════════════
// Parsing — what counts as a declaration
// ═══════════════════════════════════════════════════════════════════════════

test('comments, blanks and commented-out keys are not declarations', () => {
  const root = tree({
    '.env.example': [
      '# A section header',
      '',
      'REAL_KEY=1',
      '# COMMENTED_KEY=2',
      '   # INDENTED_COMMENT=3',
      'ANOTHER=  # empty with an inline comment',
    ].join('\n'),
  });
  try {
    const keys = keysIn(join(root, '.env.example'));
    assert.deepEqual([...keys].sort(), ['ANOTHER', 'REAL_KEY']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('node_modules is not walked', () => {
  /*
   * Not a performance note. Several packages ship a `.env.example` as documentation, and each one
   * would be reported as an orphan — a gate whose output is mostly other people's files is a gate
   * nobody reads to the end of.
   */
  assert.deepEqual(run({ 'node_modules/some-pkg/.env.example': 'A=1\n' }), []);
});
