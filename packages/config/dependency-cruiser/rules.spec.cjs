/**
 * M-002 · AC-3 — the dependency-cruiser rule set encodes the four forbidden edges of
 * FolderStructure.md §3.2, and each carries a `comment` naming its rule id.
 *
 * A rule with no comment is a rule whose failure message tells the next engineer nothing, and
 * an architecture rule nobody understands is one that gets deleted the first time it is
 * inconvenient. Hence the comment is asserted, not merely encouraged.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const config = require('./index.cjs');

const byName = new Map(config.forbidden.map((r) => [r.name, r]));

test('AC-3 — the four §3.2 forbidden edges are present', () => {
  for (const name of ['no-ui-to-utils', 'no-types-to-utils', 'no-app-to-app', 'no-server-to-ui']) {
    assert.ok(byName.has(name), `forbidden edge '${name}' is missing from the rule set`);
    assert.equal(byName.get(name).severity, 'error', `'${name}' must be an error, not a warning`);
  }
});

test('every forbidden rule carries a comment citing its clause', () => {
  for (const rule of config.forbidden) {
    assert.ok(
      typeof rule.comment === 'string' && rule.comment.length > 40,
      `rule '${rule.name}' has no meaningful comment — its failure message would explain nothing`,
    );
    assert.match(
      rule.comment,
      /§\d|ADR-\d{4}|BR-[A-Z]{3}-\d{2}|NFR-[A-Z]+/,
      `rule '${rule.name}' does not cite a clause, ADR or requirement id`,
    );
  }
});

test('AC-FND-05.3 — the platform client is importable only by the four allowed modules', () => {
  const rule = byName.get('no-platform-prisma-outside-allowlist');
  assert.ok(rule, 'AC-FND-05.3 is unenforced without this rule');
  assert.equal(rule.severity, 'error');

  // Both files must be covered. Guarding only the service would leave runElevated() importable
  // anywhere — and runElevated() is the capability; the service is merely the connection.
  // Matched loosely on purpose — `rule.to.path` is itself a regex SOURCE, so it contains an
  // escaped dot (`platform-prisma\.service`) that a literal-dot pattern here would miss.
  assert.match(rule.to.path, /platform-prisma/);
  assert.match(rule.to.path, /platform-elevation/);

  // `tenancy` is exempt because it owns both files; a module cannot be forbidden from importing
  // itself. The other four are the ones §14 gives a cross-tenant reason to.
  for (const allowed of ['tenancy', 'admin', 'reporting', 'settlements', 'audit']) {
    assert.ok(rule.from.pathNot.includes(`${allowed}/`), `'${allowed}/' must be exempt`);
  }
  // The negative half. A rule that exempts everything is a rule that forbids nothing, and this
  // assertion is the only thing standing between the allow-list and a stray `|.*` in the regex.
  for (const denied of ['memberships', 'payments', 'catalog', 'discovery']) {
    assert.ok(
      !new RegExp(rule.from.pathNot).test(`apps/server/src/${denied}/application/x.ts`),
      `'${denied}/' is not on the allow-list but the pattern lets it through`,
    );
  }
});

test('not-to-dev-dep exempts build config, and nothing that ships', () => {
  const rule = byName.get('not-to-dev-dep');
  assert.ok(rule);
  const exempt = new RegExp(rule.from.pathNot);

  // Build configuration is executed by the build TOOL in the dev environment. `tailwind.config.ts`
  // importing tailwindcss for its `Config` type is the tool reading its own configuration, not a
  // runtime import — and the failure this rule prevents (a pruned production image) cannot occur
  // for a file that never enters one.
  for (const path of [
    'apps/customer-web/tailwind.config.ts',
    'apps/admin-dashboard/vite.config.ts',
    'apps/customer-web/postcss.config.mjs',
    'packages/ui/tailwind-preset.ts',
    'packages/config/dependency-cruiser/rules.spec.cjs',
  ]) {
    assert.ok(exempt.test(path), `${path} should be exempt from not-to-dev-dep`);
  }

  // The negative half, and the one that matters: application code is NOT exempt. A rule whose
  // exemption pattern quietly widened to cover src/ would let a devDependency into the runtime
  // path, and it would work locally and fail at container start — a deploy-time surprise rather
  // than a build error.
  for (const path of [
    'apps/server/src/main.ts',
    'apps/customer-web/app/page.tsx',
    'apps/admin-dashboard/src/routes/router.tsx',
    'packages/ui/src/tokens/primitive/palette.ts',
  ]) {
    assert.ok(!exempt.test(path), `${path} must NOT be exempt from not-to-dev-dep`);
  }
});

test('the raw-Prisma prohibition exists and exempts only tenancy and prisma', () => {
  const rule = byName.get('no-raw-prisma-outside-tenancy');
  assert.ok(rule, 'ADR-0005 is unenforced without this rule');
  assert.equal(rule.severity, 'error');
  assert.match(
    rule.from.pathNot,
    /tenancy/,
    'the tenancy module must be exempt — it owns the extension',
  );
  assert.match(rule.comment, /BR-TEN-01/);
});

test('cycles are an error, not a warning', () => {
  const rule = byName.get('no-circular');
  assert.ok(rule);
  assert.equal(rule.severity, 'error');
  assert.equal(rule.to.circular, true);
});

test('rule names are unique', () => {
  const names = config.forbidden.map((r) => r.name);
  assert.equal(
    new Set(names).size,
    names.length,
    'duplicate rule name — one silently shadows the other',
  );
});

test('tsPreCompilationDeps is on, or type-only edges are invisible', () => {
  assert.equal(
    config.options.tsPreCompilationDeps,
    true,
    'Without this, an `import type` edge across a forbidden boundary is not seen at all — ' +
      'which is exactly how a boundary erodes.',
  );
});
