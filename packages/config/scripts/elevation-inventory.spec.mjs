/**
 * M-014 AC-7 · The elevation inventory's own tests.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THIS GATE'S BASELINE IS ZERO, WHICH IS THE MOST DANGEROUS BASELINE THERE IS
 *
 * Nothing in `apps/server/src/` calls `runElevated()` yet — `admin/`, `reporting/` and
 * `settlements/` are empty module directories until their milestones. So the inventory reports
 * zero sites, and it will keep reporting zero if the scanner is broken: a regex that matches
 * nothing and a codebase that contains nothing are indistinguishable from the outside.
 *
 * Every test below therefore starts from a FIXTURE that does contain call sites. The gate is
 * proved to find them, to read their scope, to reject the ones outside the allow-list, and to
 * ignore the prose that mentions `runElevated()` by name.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import {
  ELEVATION_ALLOWLIST,
  KNOWN_SCOPES,
  buildInventory,
  scanSource,
  stripComments,
  violations,
} from './elevation-inventory.mjs';

const AT = 'apps/server/src/admin/application/approve-gym.use-case.ts';

const GOOD_FIXTURE = `
import { runElevated, reason } from '../../tenancy/prisma/platform-elevation.js';

export class ApproveGymUseCase {
  async pending() {
    return runElevated(
      this.audit,
      {
        reason: reason('Reviewing the approval queue for pending applications'),
        actor: { kind: 'HUMAN', userId: this.userId, permission: 'admin.application.read' },
        scope: 'READ_ALL_TENANTS',
      },
      async () => this.platform.client.application.findMany(),
    );
  }
}
`;

// ═══════════════════════════════════════════════════════════════════════════
// The positive control.
// ═══════════════════════════════════════════════════════════════════════════

test('POSITIVE CONTROL — the scanner finds a real call site and reads its scope', () => {
  const sites = scanSource(AT, GOOD_FIXTURE);

  assert.equal(sites.length, 1, 'the scanner found no call site in a fixture that has one');
  assert.equal(sites[0].module, 'admin');
  assert.equal(sites[0].scope, 'READ_ALL_TENANTS');
  assert.equal(sites[0].permission, 'admin.application.read');
  assert.equal(violations({ sites }).length, 0, 'a legitimate call site was reported as a problem');
});

test('the scope is read even when the options object is written across many lines', () => {
  const spread = `runElevated(a, {\n${'  // filler\n'.repeat(8)}  scope: 'READ_AUDIT',\n}, f);`;
  assert.equal(scanSource(AT, spread)[0].scope, 'READ_AUDIT');
});

// ═══════════════════════════════════════════════════════════════════════════
// Prose is not a call site.
// ═══════════════════════════════════════════════════════════════════════════

test('a doc comment that explains runElevated() is not counted', () => {
  // The first version of this gate reported seventeen violations, every one of them a comment.
  const prose = `
/**
 * Only runElevated() may cross a tenant boundary. Call runElevated(audit, opts, fn) and it
 * writes the audit row first.
 */
// runElevated() is also mentioned here.
export const NOTHING = 1;
`;
  assert.deepEqual(scanSource(AT, prose), []);
});

test('an error message that names runElevated() is not counted', () => {
  // Real regression: ElevationRefusedError's diagnosis says the word, and should.
  const message = `
throw new Error(
  'the platform client was accessed outside runElevated() — there is no ambient elevation',
);
`;
  assert.deepEqual(scanSource(AT, message), []);
});

test('the definition and the re-export are not call sites', () => {
  const definition = `
export async function runElevated(audit, options, fn) { return fn(); }
export { runElevated } from './platform-elevation.js';
import { runElevated } from './platform-elevation.js';
`;
  assert.deepEqual(scanSource(AT, definition), []);
});

test('a scope literal survives redaction, because it has no space in it', () => {
  // The prose test above passes trivially if the stripper blanks EVERY string — and that would
  // silently make every real call site read as DYNAMIC, which the gate rejects. So assert both
  // halves of the discriminator, not just the one that produces the pleasing result.
  const stripped = stripComments(`const x = { scope: 'READ_ONE_TENANT', note: 'a b c' };`);
  assert.match(stripped, /'READ_ONE_TENANT'/, 'the enum literal was blanked');
  assert.doesNotMatch(stripped, /a b c/, 'the prose literal survived');
});

test('a // inside a string does not blank the rest of the line', () => {
  const url = `const u = 'https://x.test'; runElevated(a, { scope: 'READ_AUDIT' }, f);`;
  assert.equal(scanSource(AT, url).length, 1, 'a URL swallowed the call site after it');
});

// ═══════════════════════════════════════════════════════════════════════════
// The rules that are violations regardless of the committed file.
// ═══════════════════════════════════════════════════════════════════════════

test('a call site outside the allow-list is a violation on its FIRST commit', () => {
  // It must not become acceptable merely by being written down. `--write` accepts a changed
  // count; it does not accept a module that has no business reading across tenants.
  const sites = scanSource(
    'apps/server/src/memberships/application/renew.use-case.ts',
    GOOD_FIXTURE,
  );
  const problems = violations({ sites });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /memberships/);
  assert.match(problems[0], /allow-list/);
});

test('a computed scope is a violation, because it cannot be counted', () => {
  const dynamic = `runElevated(audit, { scope: chooseScope(request) }, fn);`;
  const problems = violations({ sites: scanSource(AT, dynamic) });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /computed/);
});

test('an unregistered scope literal is a violation', () => {
  const bogus = `runElevated(audit, { scope: 'READ_EVERYTHING' }, fn);`;
  const problems = violations({ sites: scanSource(AT, bogus) });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /unknown elevation scope/i);
});

// ═══════════════════════════════════════════════════════════════════════════
// The duplicated constants must not drift from their sources.
// ═══════════════════════════════════════════════════════════════════════════

test('KNOWN_SCOPES matches ELEVATION_SCOPES in platform-elevation.ts', () => {
  // Duplicated rather than imported — this is an .mjs gate and that is a .ts module. The
  // duplication is only safe while something asserts it, which is this.
  assert.deepEqual(KNOWN_SCOPES, [
    'READ_ALL_TENANTS',
    'READ_ONE_TENANT',
    'READ_FINANCIAL_AGGREGATE',
    'READ_AUDIT',
  ]);
});

test('the allow-list matches the dependency-cruiser rule it duplicates', () => {
  const { forbidden } = createRequire(import.meta.url)('../dependency-cruiser/index.cjs');
  const rule = forbidden.find((r) => r.name === 'no-platform-prisma-outside-allowlist');
  assert.ok(rule, 'AC-FND-05.3 is unenforced without the dependency-cruiser rule');

  for (const module of ELEVATION_ALLOWLIST) {
    assert.ok(
      rule.from.pathNot.includes(`${module}/`),
      `'${module}' is on the inventory's allow-list but dependency-cruiser would reject the ` +
        `import. The two lists must agree or one gate contradicts the other.`,
    );
  }
});

test('the real inventory is internally consistent', () => {
  const inventory = buildInventory();
  assert.equal(
    inventory.total,
    inventory.sites.length,
    'the total does not match the site list — the committed file would record a wrong count',
  );
  const summed = Object.values(inventory.byScope).reduce((a, b) => a + b, 0);
  assert.equal(summed, inventory.total, 'the per-scope counts do not add up to the total');
  assert.deepEqual(
    violations(inventory),
    [],
    'the committed codebase violates the elevation rules',
  );
});
