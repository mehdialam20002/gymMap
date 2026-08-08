/**
 * The gate's own tests.
 *
 * Two halves, and the second is the one that matters. A checker that reports zero problems is
 * indistinguishable from a checker that is looking at nothing — a wrong glob, a regex that never
 * matches, a scan restricted to a directory that was renamed. `module-structure.spec.mjs` makes
 * the same argument; this file follows it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkTailwindTokens, spacingScale } from './tailwind-tokens.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * A throwaway repo containing the real preset and one component.
 *
 * The preset is COPIED rather than stubbed, so the fixture is policed by the same scale the
 * application is. A stub would let this suite keep passing after the scale changed.
 */
function scratchRepo(className) {
  const root = mkdtempSync(join(tmpdir(), 'gymmap-tw-'));
  mkdirSync(join(root, 'packages/ui'), { recursive: true });
  mkdirSync(join(root, 'apps/admin-dashboard/src'), { recursive: true });

  cpSync(
    resolve(REPO, 'packages/ui/tailwind-preset.ts'),
    join(root, 'packages/ui/tailwind-preset.ts'),
  );
  writeFileSync(
    join(root, 'apps/admin-dashboard/src/probe.tsx'),
    `export const Probe = () => <div className="${className}" />;\n`,
  );
  return root;
}

const withScratch = (className, assertion) => {
  const root = scratchRepo(className);
  try {
    assertion(checkTailwindTokens(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

// ---------------------------------------------------------------------------
// The scale is read, not guessed.
// ---------------------------------------------------------------------------

test('the spacing scale is read from the preset and carries the token steps', () => {
  const scale = spacingScale(REPO);
  for (const key of ['inset-md', 'stack-lg', 'inline-sm', 'region-md']) {
    assert.ok(scale.has(key), `${key} is missing from the parsed scale — the regex has drifted`);
  }
  // The step that started all this. If a `3xs` is ever added to the tokens, this line is the
  // reminder that the substitutions made when it did not exist can be revisited.
  assert.equal(scale.has('inset-3xs'), false);
  assert.ok(scale.size > 20, `only ${String(scale.size)} keys parsed — the block match is wrong`);
});

// ---------------------------------------------------------------------------
// CONTROLS — the checker detects what it is for.
// ---------------------------------------------------------------------------

test('CONTROL · a token step that does not exist is caught', () => {
  withScratch('px-inset-3xs text-content', (problems) => {
    assert.equal(problems.length, 1, JSON.stringify(problems));
    assert.equal(problems[0].class, 'px-inset-3xs');
  });
});

test('CONTROL · a Tailwind NUMERIC utility is caught — the scale is replaced, not extended', () => {
  // The half that surprises people. `w-60` is valid Tailwind and dead here.
  withScratch('w-60 h-14 gap-2', (problems) => {
    assert.deepEqual(problems.map((problem) => problem.class).sort(), ['gap-2', 'h-14', 'w-60']);
  });
});

test('CONTROL · the message says the class emits nothing, not merely that it is unknown', () => {
  withScratch('p-4', (problems) => {
    assert.match(problems[0].message, /emits NOTHING/);
    assert.match(problems[0].message, /REPLACES it/);
  });
});

// ---------------------------------------------------------------------------
// What must NOT be flagged. Each of these was a false positive in the first draft.
// ---------------------------------------------------------------------------

test('a real token step passes', () => {
  withScratch('px-inset-md py-inset-sm gap-inline-md mt-stack-lg', (problems) => {
    assert.deepEqual(problems, []);
  });
});

test('an arbitrary value passes — it is a visible, reviewable exception', () => {
  withScratch('w-[15rem] h-[3.5rem] max-w-[16rem]', (problems) => {
    assert.deepEqual(problems, []);
  });
});

test('fractions, auto and the named max-widths pass', () => {
  // These live in Tailwind's own width/height scales, not in `theme.spacing`, so replacing
  // spacing does not remove them.
  withScratch('w-2/3 h-full mx-auto max-w-prose min-h-screen max-w-container', (problems) => {
    assert.deepEqual(problems, []);
  });
});

test('variants are unwrapped rather than treated as part of the value', () => {
  withScratch('sm:px-inset-lg lg:gap-stack-sm hover:mt-stack-xs', (problems) => {
    assert.deepEqual(problems, []);
  });
});

test('a template literal in className is scanned, including its conditional branches', () => {
  const root = mkdtempSync(join(tmpdir(), 'gymmap-tw-'));
  try {
    mkdirSync(join(root, 'packages/ui'), { recursive: true });
    mkdirSync(join(root, 'apps/admin-dashboard/src'), { recursive: true });
    cpSync(
      resolve(REPO, 'packages/ui/tailwind-preset.ts'),
      join(root, 'packages/ui/tailwind-preset.ts'),
    );
    writeFileSync(
      join(root, 'apps/admin-dashboard/src/probe.tsx'),
      'export const P = ({ on }: { on: boolean }) => (\n' +
        '  <div className={`px-inset-md ${on ? "py-inset-3xs" : "py-inset-sm"}`} />\n' +
        ');\n',
    );

    const problems = checkTailwindTokens(root);
    assert.equal(problems.length, 1, JSON.stringify(problems));
    assert.equal(problems[0].class, 'py-inset-3xs');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('strings OUTSIDE className are ignored', () => {
  // The first draft failed on `'p-001'`, a plan identifier in the gym fixture, and on the token
  // name `--gm-size-md` in packages/ui. A gate that fires on real data is one somebody silences.
  const root = mkdtempSync(join(tmpdir(), 'gymmap-tw-'));
  try {
    mkdirSync(join(root, 'packages/ui'), { recursive: true });
    mkdirSync(join(root, 'apps/customer-web/src'), { recursive: true });
    cpSync(
      resolve(REPO, 'packages/ui/tailwind-preset.ts'),
      join(root, 'packages/ui/tailwind-preset.ts'),
    );
    writeFileSync(
      join(root, 'apps/customer-web/src/data.ts'),
      "export const PLANS = [{ id: 'p-001', token: '--gm-size-md', gap: 'gap-99' }];\n",
    );
    assert.deepEqual(checkTailwindTokens(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a class named only in a COMMENT is ignored', () => {
  const root = mkdtempSync(join(tmpdir(), 'gymmap-tw-'));
  try {
    mkdirSync(join(root, 'packages/ui'), { recursive: true });
    mkdirSync(join(root, 'apps/admin-dashboard/src'), { recursive: true });
    cpSync(
      resolve(REPO, 'packages/ui/tailwind-preset.ts'),
      join(root, 'packages/ui/tailwind-preset.ts'),
    );
    writeFileSync(
      join(root, 'apps/admin-dashboard/src/probe.tsx'),
      '// Heights are arbitrary values, not `h-8` / `h-4`.\n' +
        'export const P = () => <div className="h-[2rem]" />;\n',
    );
    assert.deepEqual(checkTailwindTokens(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// The repository itself.
// ---------------------------------------------------------------------------

test('every spacing utility in the repository resolves', () => {
  const problems = checkTailwindTokens(REPO);
  assert.deepEqual(
    problems,
    [],
    problems.map((problem) => `${problem.file}: ${problem.message}`).join('\n'),
  );
});
