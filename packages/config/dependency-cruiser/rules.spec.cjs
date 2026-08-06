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
