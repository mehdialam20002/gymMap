/**
 * `M-023` · What the generated document says about REFUSAL — `FR-RBAC-01`, `§13.2`.
 *
 * ┌─ THE DOCUMENT IS WHERE A CLIENT LEARNS HOW TO HANDLE A 403 ──────────────────────────────────┐
 * │ Three front ends and the generated OpenAPI client are built from `openapi.json`, not from the │
 * │ controllers. A 403 that the document does not describe is one every client handles by         │
 * │ guessing — and the guess is usually "show the raw message", which is how an internal          │
 * │ configuration gap ends up on a member's screen.                                                │
 * │                                                                                              │
 * │ `permissions-guard-registered.spec.ts` proves the guard is bound and `effective-permissions`  │
 * │ proves what it decides. This proves the answer is DESCRIBED, and described in the one shape   │
 * │ §13.2 fixes for every error in the platform.                                                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Reads the committed `openapi.json`; `openapi-drift.int-spec.ts` separately asserts the committed
 * document is what the emitter currently produces, so "committed" and "current" are one thing.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  PERMISSION_KEYS,
  SCOPED_NON_MATRIX_PERMISSIONS,
  SELF_SERVICE_PERMISSIONS,
} from '../dist/iam/permissions.js';

function repoRoot(): string {
  let dir = process.cwd();
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`could not locate the repository root from ${process.cwd()}`);
}

interface Operation {
  readonly security?: readonly unknown[];
  readonly responses?: Record<string, unknown>;
  readonly [key: string]: unknown;
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

const document = JSON.parse(readFileSync(resolve(repoRoot(), 'openapi.json'), 'utf8')) as {
  paths: Record<string, Record<string, Operation>>;
};

/** Every `(route, operation)` in the document, flattened. */
function operations(): { route: string; op: Operation }[] {
  const out: { route: string; op: Operation }[] = [];
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of METHODS) {
      const op = item[method];
      if (op !== undefined) out.push({ route: `${method.toUpperCase()} ${path}`, op });
    }
  }
  return out;
}

/*
 * The emitter's own vocabulary, read from the document rather than assumed.
 *
 * My first draft of this file guessed `x-required-permission` and `security: []`, and every
 * assertion that depended on the guess failed — which is the correct outcome and worth leaving a
 * note about: a contract test written against an imagined contract tests the imagination.
 */
const permissionOn = (op: Operation): string | undefined => {
  const value = op['x-gymmap-permission'];
  return typeof value === 'string' ? value : undefined;
};

const isPublic = (op: Operation): boolean => op['x-gymmap-public'] === true;

/** The registry codes this operation declares it can emit — `@EmitsErrors()`, §13.2. */
const errorCodesOn = (op: Operation): readonly string[] => {
  const value = op['x-gymmap-error-codes'];
  return Array.isArray(value) ? (value as string[]) : [];
};

test('the document describes at least one operation, or this file checks nothing', () => {
  // A parse that silently produced an empty map would make every loop below vacuous, and a suite
  // of vacuous loops reports success. This is the guard that stops that.
  assert.ok(operations().length >= 10, `only ${String(operations().length)} operations parsed`);
});

test('FR-RBAC-01 — every non-public operation declares a permission in the DOCUMENT', () => {
  /*
   * `PG-1` asserts the same property against the source. This asserts it against the artefact
   * clients are generated from, and the two can disagree: a decorator that the emitter fails to
   * project produces a route which is guarded at runtime and, to every client author reading the
   * contract, indistinguishable from a public one.
   */
  for (const { route, op } of operations()) {
    if (isPublic(op)) continue;
    assert.ok(
      permissionOn(op) !== undefined,
      `${route} is authenticated and the document names no permission for it`,
    );
  }
});

test('a public operation declares NO permission — the two must not both be true', () => {
  /*
   * `security: []` means "no token needed". A permission on the same operation is a contradiction
   * the document would carry silently, and the safe reading of a contradiction about access is the
   * permissive one — which is why it is asserted rather than left to a reader to notice.
   */
  for (const { route, op } of operations()) {
    if (!isPublic(op)) continue;
    assert.equal(
      permissionOn(op),
      undefined,
      `${route} is documented as public AND as requiring ${String(permissionOn(op))}`,
    );
  }
});

test('every declared permission is <module>.<resource>.<action> with a real module', () => {
  // The document is the last place the shape can be checked before a client is generated from it.
  // A malformed key here is a client method whose name and whose guard disagree.
  const MODULES = new Set([
    'common',
    'tenancy',
    'iam',
    'onboarding',
    'catalog',
    'plans',
    'discovery',
    'ordering',
    'payments',
    'billing',
    'memberships',
    'attendance',
    'crm',
    'staff',
    'reviews',
    'ledger',
    'settlements',
    'refunds',
    'notifications',
    'reporting',
    'support',
    'admin',
    'audit',
  ]);

  for (const { route, op } of operations()) {
    const key = permissionOn(op);
    if (key === undefined) continue;
    const match = /^([a-z][a-z0-9]*)\.([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)$/.exec(key);
    assert.ok(match, `${route} declares "${key}", which is not three lowercase segments`);
    assert.ok(MODULES.has(match[1]!), `${route} names module "${match[1]!}", not one of the 23`);
  }
});

test('§13.2 — every guarded operation declares the refusal a client will actually meet', () => {
  /*
   * The envelope itself is universal — the exception filter applies `{ error: { code, message,
   * details[], correlation_id } }` to everything, so there is no per-route body to check. What IS
   * per-route is WHICH registry codes the operation can emit, and that is what a client switches
   * on.
   *
   * A guarded route that names neither `PERMISSION_DENIED` nor `UNAUTHENTICATED` is telling every
   * client author that it cannot refuse them. It can — the guard is bound — so the document is
   * simply wrong, and the client written from it has no branch for the answer it will get.
   */
  const guarded = operations().filter(({ op }) => permissionOn(op) !== undefined);
  assert.ok(guarded.length > 0, 'no guarded operation found, so this test proves nothing');

  for (const { route, op } of guarded) {
    const codes = errorCodesOn(op);
    assert.ok(
      codes.includes('PERMISSION_DENIED') || codes.includes('UNAUTHENTICATED'),
      `${route} is guarded and declares no refusal code. It emits [${codes.join(', ')}]`,
    );
  }
});

test('no operation documents a permission the guard cannot resolve', () => {
  /*
   * The document is generated from the same constants the guard reads, so this should hold by
   * construction — and it is asserted anyway because the emitter runs against a BUILT app while
   * the guard reads source. A stale `dist/` between them produces a document describing keys the
   * running server refuses, and every client generated from it fails on the first call.
   *
   * The admit lists are included: those keys are legitimately outside the matrix.
   */
  const resolvable = new Set([
    ...PERMISSION_KEYS,
    ...SELF_SERVICE_PERMISSIONS,
    ...SCOPED_NON_MATRIX_PERMISSIONS,
  ]);

  for (const { route, op } of operations()) {
    const key = permissionOn(op);
    if (key === undefined) continue;
    assert.ok(
      resolvable.has(key),
      `${route} documents "${key}", which permits() refuses as UNKNOWN_PERMISSION`,
    );
  }
});
