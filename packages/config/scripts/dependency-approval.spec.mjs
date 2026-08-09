/**
 * The gate that guards the gate.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS: THE CHECK WAS WRONG FOR THE WHOLE CUSTOMER-WEB BUILD
 *
 * `A-41` approves `motion` and has said `APPROVED` in `STACK_ADDITIONS.md` since that work started.
 * `dependency-approval` reported it as unapproved anyway, because the script keeps its own
 * `APPROVED_PREFIXES` array beside the register and the row was added to one and not the other.
 *
 * A false positive is not a harmless gate. It is the mechanism by which a REAL finding gets waved
 * through — a check that cries wolf is a check people learn to scroll past, and this one is the
 * only thing standing between an unapproved dependency and a `package.json`.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { findUnapprovedDependencies, stackAdditionsDrift } from './dependency-approval.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');

// ═══════════════════════════════════════════════════════════════════════════
// The real repository
// ═══════════════════════════════════════════════════════════════════════════

test('the committed register and the prefix array agree', () => {
  // The regression. Every `APPROVED` row's named package must be something this gate recognises,
  // or the gate reports a package the owner already approved.
  const drift = stackAdditionsDrift(REPO_ROOT);
  assert.deepEqual(
    drift.map((d) => `${d.id}:${d.name}`),
    [],
    'STACK_ADDITIONS.md approves packages the gate has never heard of — it will report them as ' +
      'unapproved, and the next real finding will be scrolled past with them.',
  );
});

test('every committed dependency maps to an approved row', () => {
  assert.deepEqual(
    findUnapprovedDependencies(REPO_ROOT).map((d) => `${d.name} (${d.manifest})`),
    [],
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// The parser, against the shapes the register actually uses
// ═══════════════════════════════════════════════════════════════════════════

/** A throwaway repo holding only a STACK_ADDITIONS.md. */
function repoWith(rows) {
  const root = mkdtempSync(join(tmpdir(), 'gymmap-dep-'));
  mkdirSync(join(root, 'docs', 'engineering'), { recursive: true });
  writeFileSync(
    join(root, 'docs', 'engineering', 'STACK_ADDITIONS.md'),
    ['| ID | Need | Selection | Rationale | Status |', '| :- | :- | :- | :- | :- |', ...rows].join(
      '\n',
    ),
  );
  return root;
}

test('an APPROVED row naming an unknown package is reported', () => {
  const root = repoWith(['| **A-99** | Widgets | **`some-widget-lib`** | because | `APPROVED` |']);
  assert.deepEqual(
    stackAdditionsDrift(root).map((d) => `${d.id}:${d.name}`),
    ['A-99:some-widget-lib'],
  );
});

test('PROPOSED, DEFERRED and REJECTED rows are NOT reported', () => {
  // ┌─ THE MOST IMPORTANT NEGATIVE HERE ─────────────────────────────────────────────────────────┐
  // │ `A-31` (ClamAV) and the rasteriser are exactly this case. Demanding a prefix for a package │
  // │ the owner has NOT approved would invert the gate: it would push somebody to allow-list a   │
  // │ dependency in order to silence a check about approving it.                                  │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const root = repoWith([
    '| **A-31** | Scanning | **`clamscan`** | contested | `PROPOSED` |',
    '| **A-19** | Vendors | **`some-sms-sdk`** | blocked on OQ-01 | `DEFERRED` |',
    '| **A-98** | State | **`redux`** | rejected by the PRD | `REJECTED` |',
  ]);
  assert.deepEqual(stackAdditionsDrift(root), []);
});

test('prose in the selection column is not mistaken for a package', () => {
  // A-41's exact shape, with names the prefix array does not already cover — otherwise the drift
  // check filters everything out and the test proves nothing about the PARSER.
  // `oldlib` stands for `framer-motion`, the package the selection REPLACES, and `some-app` for
  // `customer-web`, a workspace. The first version of this check demanded a prefix for both.
  const root = repoWith([
    '| **A-41** | Animation | **`newlib`** (successor to `oldlib`), `some-app` ONLY | x | `APPROVED` |',
  ]);
  assert.deepEqual(
    stackAdditionsDrift(root).map((d) => d.name),
    ['newlib'],
  );
});

test('a bold selection with words around the package still resolves', () => {
  // A-18's shape — **AWS SDK v3 `@aws-sdk/client-s3`** — with a name the array does not cover.
  const root = repoWith([
    '| **A-18** | Storage | **Vendor SDK v3 `@vendor/client-x`** | works anywhere | `APPROVED` |',
  ]);
  assert.deepEqual(
    stackAdditionsDrift(root).map((d) => d.name),
    ['@vendor/client-x'],
  );
});

test('a selection that names no npm package at all is silent', () => {
  // Several rows select a technique rather than a dependency — "Postgres full-text", "Ports
  // defined now". A gate that demanded prefixes for those would be unusable.
  const root = repoWith([
    '| **A-97** | Search | **Postgres full-text + trigram** | no cluster at launch | `APPROVED` |',
  ]);
  assert.deepEqual(stackAdditionsDrift(root), []);
});

test('a missing register is not a failure', () => {
  // The gate must not fall over in a checkout that has no docs/ — it reports dependencies, and
  // that job is still meaningful.
  assert.deepEqual(stackAdditionsDrift(mkdtempSync(join(tmpdir(), 'gymmap-empty-'))), []);
});
