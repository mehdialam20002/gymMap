/**
 * M-001 · AC-4 — the §3.6 per-package script contract.
 *
 * Every workspace package exposes the same script names so that `turbo run <task>` never
 * needs a filter list. A MISSING script makes `turbo run` succeed by omission, which is
 * indistinguishable from passing — that is the failure this test exists to prevent, and
 * it is why a no-op must be the literal string rather than an absent key.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../..');
const NO_OP = 'echo "no-op"';

/**
 * Declared in turbo.json. Kept in sync by the last test in this file, so a task added to
 * the pipeline without a corresponding script cannot pass unnoticed.
 */
const REQUIRED_SCRIPTS = [
  'build',
  'typecheck',
  'lint',
  'architecture',
  'test:unit',
  'test:int',
  'test:contract',
  'test:isolation',
  'test:e2e',
  'test:a11y',
  'size',
  'openapi:check',
];

/** FolderStructure.md §3.6 — which packages implement a script for real, at the END state. */
const REAL = {
  build: ['server', 'customer-web', 'gym-dashboard', 'admin-dashboard', 'types', 'utils'],
  typecheck: ['server', 'customer-web', 'gym-dashboard', 'admin-dashboard', 'types', 'utils', 'ui'],
  'test:int': ['server'],
  'test:isolation': ['server'],
  'test:e2e': ['customer-web', 'gym-dashboard', 'admin-dashboard'],
  size: ['customer-web', 'gym-dashboard', 'admin-dashboard'],
};

/**
 * §3.6 describes the END state. A script it marks as implemented may legitimately still be a
 * no-op if the milestone that implements it has not run — but that is a DEBT, not a licence,
 * so every one is named here with the milestone that discharges it.
 *
 * When that milestone lands, delete the entry. The `REAL` assertion above then immediately
 * demands a genuine implementation, which is the point: this map makes "not yet" expire on a
 * schedule instead of decaying into "never".
 */
const DEFERRED = {
  // `build` DISCHARGED for both front-end apps by the shell milestones, which were pulled ahead
  // of their roadmap positions at the owner's direction so something is visible early. The two
  // shells build, serve and render; what is deferred is now only what genuinely has no subject:
  // there is no journey to drive with Playwright and no page whose bundle is worth a budget.
  'customer-web': {
    'test:e2e': 'M-048 — a Playwright journey needs a rendered SEARCH result, not a shell',
    size: 'M-048 — the 200 KB NFR-PERF-10 budget is meaningless against a static home page',
  },
  'gym-dashboard': {
    build: 'M-069 — the check-in desk is the first real dash surface',
    'test:e2e': 'M-069',
    size: 'M-069',
  },
  'admin-dashboard': {
    'test:e2e': 'M-036 — SCR-ADM-002/003 is the first admin screen with a journey to drive',
    size: 'M-036 — admin is behind MFA and has no NFR-PERF-10 budget; the number needs a subject',
  },
  // Both server entries are now DISCHARGED, and both were discharged the same way: the test
  // below failed the moment the script stopped being a no-op. That is what this map is for —
  // it makes "not yet" expire on a schedule rather than decay into "never".
  //
  //   test:int        M-005 · 23 assertions against a real PostgreSQL 16 container
  //   test:isolation  M-009 · RS-1, RS-2, RS-3, RS-7, RS-8, RS-10 plus IS6 coverage
  //
  // `test:isolation` is REAL but not yet COMPLETE: M-009 proves the six cases a single table
  // can carry. M-015 parameterises RS-4…RS-6, RS-9, RS-11 and RS-12 across every table and
  // generates a case group per route from the OpenAPI document. A partially-implemented script
  // does not belong in a map of no-ops, so it is tracked in docs/PHASES.md instead.
  server: {},
};

function workspacePackages() {
  const out = [];
  for (const group of ['apps', 'packages']) {
    for (const dir of readdirSync(join(ROOT, group), { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const manifestPath = join(ROOT, group, dir.name, 'package.json');
      out.push({
        short: dir.name,
        rel: `${group}/${dir.name}`,
        manifest: JSON.parse(readFileSync(manifestPath, 'utf8')),
      });
    }
  }
  return out;
}

const PACKAGES = workspacePackages();

test('the workspace has exactly the eight packages the constitution names', () => {
  assert.deepEqual(
    PACKAGES.map((p) => p.rel).sort(),
    [
      'apps/admin-dashboard',
      'apps/customer-web',
      'apps/gym-dashboard',
      'apps/server',
      'packages/config',
      'packages/types',
      'packages/ui',
      'packages/utils',
    ],
    'A ninth package needs an amendment under constitution §24, not just a directory.',
  );
});

for (const { short, rel, manifest } of PACKAGES) {
  test(`${rel} — exposes every pipeline script`, () => {
    const scripts = manifest.scripts ?? {};
    for (const name of REQUIRED_SCRIPTS) {
      assert.ok(
        name in scripts,
        `${rel}: script '${name}' is MISSING. A missing script makes \`turbo run ${name}\` ` +
          `succeed by omission. Add it as the literal no-op: ${NO_OP}`,
      );
    }
  });

  test(`${rel} — no-ops are the literal string, and real scripts are not no-ops`, () => {
    const scripts = manifest.scripts ?? {};
    const deferred = DEFERRED[short] ?? {};

    for (const name of REQUIRED_SCRIPTS) {
      const value = scripts[name];

      assert.equal(typeof value, 'string', `${rel}: '${name}' must be a string`);
      assert.notEqual(value.length, 0, `${rel}: '${name}' must not be empty`);

      if (!(REAL[name] ?? []).includes(short)) continue;

      if (name in deferred) {
        assert.equal(
          value,
          NO_OP,
          `${rel}: '${name}' is recorded as deferred to ${deferred[name]}, so it must be the ` +
            `literal no-op until then. It is currently "${value}" — if it is now implemented, ` +
            `remove the DEFERRED entry.`,
        );
        continue;
      }

      assert.notEqual(
        value,
        NO_OP,
        `${rel}: §3.6 marks '${name}' as implemented, but it is a no-op and no DEFERRED entry ` +
          `names the milestone that will implement it. Either implement it, or add it to ` +
          `DEFERRED with a milestone id so the debt is tracked rather than forgotten.`,
      );
    }
  });
}

test('root package.json has NO dependencies block — absent, not empty (R1a)', () => {
  const root = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(
    'dependencies' in root,
    false,
    'The root must declare no runtime dependencies at all. An accidental root dependency is ' +
      'invisible to size-limit (A-29) and to per-app Dockerfile pruning.',
  );
});

test('every turbo task has a matching script in at least one package', () => {
  const turbo = JSON.parse(readFileSync(join(ROOT, 'turbo.json'), 'utf8'));
  const tasks = Object.keys(turbo.tasks ?? {}).filter((t) => t !== 'dev');
  const declared = new Set(PACKAGES.flatMap((p) => Object.keys(p.manifest.scripts ?? {})));

  for (const task of tasks) {
    assert.ok(
      declared.has(task),
      `turbo.json declares task '${task}' but no package exposes a script by that name — ` +
        `\`turbo run ${task}\` would silently do nothing.`,
    );
  }
});

test('tsconfig.base.json is a turbo globalDependency, so editing it busts the cache', () => {
  const turbo = JSON.parse(readFileSync(join(ROOT, 'turbo.json'), 'utf8'));
  assert.ok(
    (turbo.globalDependencies ?? []).includes('tsconfig.base.json'),
    'Without this, a compiler-flag change reuses stale type information across the graph.',
  );
});
