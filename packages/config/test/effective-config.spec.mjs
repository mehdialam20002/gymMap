/**
 * M-001 · AC-2 — the effective-tsconfig assertion.
 *
 * Reads the RESOLVED configuration via `tsc --showConfig`, not the file on disk. A package
 * can extend a strict preset and then quietly re-declare a flag; only the resolved view
 * catches that, which is precisely why the acceptance criterion is worded that way.
 *
 * Runs on Node's built-in test runner rather than Jest. Jest arrives in M-002, and a
 * milestone whose own acceptance criteria cannot be executed until the next milestone is
 * not verified — it is hoped. Ported to Jest in M-002 alongside the shared preset.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../..');

/** The §9.1 flag set every package inherits and none may loosen. */
const MANDATED = {
  strict: true,
  strictBindCallApply: true,
  useUnknownInCatchVariables: true,
  alwaysStrict: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  noImplicitReturns: true,
  noFallthroughCasesInSwitch: true,
  noImplicitOverride: true,
  noPropertyAccessFromIndexSignature: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
  forceConsistentCasingInFileNames: true,
  isolatedModules: true,
  esModuleInterop: true,
};

/**
 * Documented, deliberate deviations. Each MUST cite a TECH_DEBT.md id — an undocumented
 * entry here is the same failure as an undocumented override in a tsconfig.
 */
const SANCTIONED_OVERRIDES = {
  'apps/server': {
    verbatimModuleSyntax: {
      expected: false,
      reason: 'TD-030 — NestJS is CommonJS-first; TS1287 on the first exported symbol.',
    },
    strictPropertyInitialization: {
      expected: false,
      reason: 'TD-029 — Nest injects into constructor params and deserialises into DTO fields.',
    },
  },
};

const PACKAGES = [
  'apps/server',
  'apps/customer-web',
  'apps/gym-dashboard',
  'apps/admin-dashboard',
  'packages/types',
  'packages/utils',
  'packages/ui',
];

/** `packages/config` ships no compiled code; its typecheck is a documented no-op. */
const NO_TSCONFIG = ['packages/config'];

function showConfig(pkgDir) {
  const out = execFileSync(
    process.execPath,
    [
      join(ROOT, 'node_modules', 'typescript', 'lib', 'tsc.js'),
      '-p',
      'tsconfig.json',
      '--showConfig',
    ],
    { cwd: join(ROOT, pkgDir), encoding: 'utf8' },
  );
  return JSON.parse(out).compilerOptions ?? {};
}

test('every package resolves a tsconfig, or is explicitly exempt', () => {
  for (const pkg of [...PACKAGES, ...NO_TSCONFIG]) {
    const hasConfig = existsSync(join(ROOT, pkg, 'tsconfig.json'));
    const exempt = NO_TSCONFIG.includes(pkg);
    assert.equal(
      hasConfig,
      !exempt,
      exempt
        ? `${pkg} is listed exempt but has a tsconfig.json — remove one or the other`
        : `${pkg} has no tsconfig.json`,
    );
  }
});

for (const pkg of PACKAGES) {
  test(`${pkg} — effective config keeps every §9.1 flag`, () => {
    const actual = showConfig(pkg);
    const overrides = SANCTIONED_OVERRIDES[pkg] ?? {};

    for (const [flag, required] of Object.entries(MANDATED)) {
      if (flag in overrides) {
        assert.equal(
          actual[flag],
          overrides[flag].expected,
          `${pkg}: '${flag}' is a sanctioned override but resolved to ${actual[flag]}, not ` +
            `${overrides[flag].expected}. ${overrides[flag].reason}`,
        );
        continue;
      }
      assert.equal(
        actual[flag],
        required,
        `${pkg}: '${flag}' resolved to ${JSON.stringify(actual[flag])}, expected ${required}. ` +
          `Do not relax a §9.1 flag to make a package compile. If it is genuinely forced, add it ` +
          `to SANCTIONED_OVERRIDES with a TECH_DEBT.md id.`,
      );
    }
  });
}

for (const [pkg, overrides] of Object.entries(SANCTIONED_OVERRIDES)) {
  test(`${pkg} — every sanctioned override cites a TECH_DEBT id`, () => {
    for (const [flag, { reason }] of Object.entries(overrides)) {
      assert.match(
        reason,
        /TD-\d{3}/,
        `${pkg}: override of '${flag}' has no TECH_DEBT.md id in its reason`,
      );
    }
  });
}

test('target is ES2022 everywhere — one runtime baseline, no per-package drift', () => {
  for (const pkg of PACKAGES) {
    assert.equal(
      String(showConfig(pkg).target).toLowerCase(),
      'es2022',
      `${pkg}: target must be ES2022`,
    );
  }
});
