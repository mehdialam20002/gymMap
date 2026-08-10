/**
 * `M-023` · `TD-045` — `PermissionsGuard` is BOUND, and every declared key resolves.
 *
 * ┌─ THE FAILURE THIS EXISTS TO PREVENT IS THE ONE THAT ALREADY HAPPENED ────────────────────────┐
 * │ `PermissionsGuard` was built, unit tested against a fake `ExecutionContext`, exported from    │
 * │ the barrel, and registered nowhere. Eleven unit tests passed. `FR-RBAC-01` and `FR-RBAC-02`   │
 * │ were unenforced across the whole API for weeks, and `PHASES.md` recorded the opposite —       │
 * │ *"registered per route rather than globally"* — as an open blocker's mitigation.               │
 * │                                                                                              │
 * │ A guard's unit tests cannot notice that nothing calls it. That is what this file is for.      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Two properties, and the second is the one that made binding impossible until today.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  PERMISSION_KEYS,
  SCOPED_NON_MATRIX_PERMISSIONS,
  SELF_SERVICE_PERMISSIONS,
} from '../dist/iam/permissions.js';
import { permits } from '../dist/iam/domain/effective-permissions.js';

const SRC = resolve('src');

/** Every `<module>/permissions.ts`, found rather than listed. */
function permissionFiles(): string[] {
  return readdirSync(SRC, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(SRC, entry.name, 'permissions.ts'))
    .filter((path) => existsSync(path));
}

/** Every `@RequiredPermission(X.Y)` in the tree, resolved to the string it names. */
function declaredRouteKeys(): string[] {
  const keys = new Set<string>();

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;
      const source = readFileSync(path, 'utf8');
      for (const match of source.matchAll(/@RequiredPermission\(\s*([A-Z_]+)\.([A-Z0-9_]+)/g)) {
        keys.add(`${match[1]!}.${match[2]!}`);
      }
    }
  };
  walk(SRC);
  return [...keys];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · The guard is actually in the composition root.
// ═══════════════════════════════════════════════════════════════════════════

test('PermissionsGuard is bound as an APP_GUARD, after JwtAuthGuard', () => {
  /*
   * Read out of `app.module.ts` rather than by booting Nest, because the failure mode is
   * textual — a guard that is imported and never listed. Order matters and is asserted:
   * `Security.md`'s pipeline is *"not a matter of taste — each stage assumes the previous one
   * ran"*, and this one assumes `principal` is on the request, which `JwtAuthGuard` puts there.
   */
  const module = readFileSync(resolve(SRC, 'app.module.ts'), 'utf8');

  const bound = [...module.matchAll(/provide:\s*APP_GUARD,\s*useClass:\s*(\w+)/g)].map(
    (m) => m[1]!,
  );

  assert.ok(
    bound.includes('PermissionsGuard'),
    `PermissionsGuard is not bound. Bound: ${bound.join(', ')}`,
  );
  assert.ok(
    bound.indexOf('JwtAuthGuard') < bound.indexOf('PermissionsGuard'),
    'PermissionsGuard runs before JwtAuthGuard, so `principal` is not on the request yet',
  );
});

test('MfaGuard is NOT bound yet, and the reason is recorded beside it', () => {
  /*
   * Asserted as an ABSENCE on purpose, so that binding it is a deliberate act with this test in
   * the diff rather than a tidy-up. Every one of the eleven seeded principals has
   * `password_hash` NULL, and MFA enrolment re-authenticates against that hash — so binding the
   * mandate today locks every platform account out of every route, with no path back in.
   *
   * When the seed is fixed, delete this test in the same commit that binds the guard.
   */
  const module = readFileSync(resolve(SRC, 'app.module.ts'), 'utf8');
  assert.ok(
    !/provide:\s*APP_GUARD,\s*useClass:\s*MfaGuard/.test(module),
    'MfaGuard is bound — was the seed fixed first? Every seeded user has password_hash NULL.',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 · Every declared key resolves. This is what made binding possible.
// ═══════════════════════════════════════════════════════════════════════════

test('every @RequiredPermission on a route resolves to something permits() can decide', () => {
  /*
   * The guard refuses anything outside `PERMISSION_KEYS` as `UNKNOWN_PERMISSION`. Seven declared
   * keys sat outside it, so binding the guard would have 403'd every authenticated route — which
   * is why `TD-045` said "resolve the keys, then register", in that order.
   *
   * Scanned from the source rather than listed here: a list would go stale the first time a route
   * was added, and the route that goes unchecked is exactly the one nobody remembered.
   */
  const admitted = new Set([
    ...PERMISSION_KEYS,
    ...SELF_SERVICE_PERMISSIONS,
    ...SCOPED_NON_MATRIX_PERMISSIONS,
  ]);

  /*
   * ┌─ THIS LIST WAS FOUR HARD-CODED PATHS, AND IT WENT STALE EXACTLY AS PREDICTED ──────────────┐
   * │ The paragraph above says *"Scanned from the source rather than listed here: a list would go │
   * │ stale the first time a route was added"* — and then listed `iam`, `admin`, `tenancy` and    │
   * │ `onboarding` by hand. `M-031` added `catalog/permissions.ts` with five keys and five routes │
   * │ on 2026-08-11, and the assertion fired with *"declared on a route and defined in no          │
   * │ permissions.ts"* about keys that were sitting in one.                                        │
   * │                                                                                             │
   * │ A false failure is the better outcome of the two available: the same staleness in the other │
   * │ direction — a module whose keys nobody checks — is silent. Discovered now, so neither.       │
   * └─────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const constants = permissionFiles()
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');

  assert.ok(
    permissionFiles().length >= 5,
    `expected to find every module's permissions.ts, found ${String(permissionFiles().length)}`,
  );

  const declared = declaredRouteKeys();
  assert.ok(
    declared.length >= 7,
    `expected the route scan to find keys, found ${String(declared.length)}`,
  );

  for (const symbol of declared) {
    const member = symbol.split('.')[1]!;
    // `MEMBER: 'a.b.c'` or `MEMBER: permissionOf('Row', 'a.b.c')` — take the last quoted key.
    const pattern = new RegExp(`${member}:[^\\n]*?'([a-z]+\\.[a-z0-9_]+\\.[a-z0-9_]+)'`);
    const found = pattern.exec(constants);
    assert.ok(found, `${symbol} is declared on a route and defined in no permissions.ts`);
    assert.ok(
      admitted.has(found[1]!),
      `${symbol} = "${found[1]!}" is in neither the matrix nor an admit list, so the bound guard ` +
        `refuses that route with UNKNOWN_PERMISSION for every caller`,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 · The admit lists admit, and do not over-admit.
// ═══════════════════════════════════════════════════════════════════════════

const memberGrant = { role: 'MEMBER' as const, scope: { kind: 'SELF' as const } };
const ownTenant = {
  role: 'GYM_OWNER' as const,
  scope: { kind: 'TENANT' as const, tenantId: 'T1' },
};

test('a self-service key is held by any authenticated principal, and by nobody unauthenticated', () => {
  const key = SELF_SERVICE_PERMISSIONS[0]!;
  assert.equal(permits(key, [memberGrant], { tenantId: null }, 'U1').allowed, true);

  // No grants at all — an unauthenticated caller. `@Public()` stays the only way past a token.
  const anonymous = permits(key, [], { tenantId: null }, 'U1');
  assert.equal(anonymous.allowed, false);
  assert.equal(anonymous.allowed === false ? anonymous.reason : '', 'NOT_GRANTED');
});

test('a scoped non-matrix key still obeys the tenant boundary — BR-TEN-01', () => {
  /*
   * The distinction between the two admit lists, asserted. `tenancy.ping.read` returns TENANT
   * data, so admitting it the self-service way would let any authenticated principal ping any
   * tenant. It is admitted past the matrix lookup only; the scope check still decides.
   */
  const key = SCOPED_NON_MATRIX_PERMISSIONS[0]!;
  assert.equal(permits(key, [ownTenant], { tenantId: 'T1' }, 'U1').allowed, true);

  const otherTenant = permits(key, [ownTenant], { tenantId: 'T2' }, 'U1');
  assert.equal(otherTenant.allowed, false, 'a principal pinged another tenant');
  assert.equal(otherTenant.allowed === false ? otherTenant.reason : '', 'OUT_OF_SCOPE');
});

test('an invented key is still UNKNOWN_PERMISSION — the admit lists are not a hole', () => {
  // The lists are enumerated strings, never prefixes. `iam.session.anything` must not be admitted
  // just because `iam.session.list` is: a prefix rule is satisfied by naming a route well.
  const decision = permits(
    'iam.session.destroy_everything',
    [memberGrant],
    { tenantId: null },
    'U1',
  );
  assert.equal(decision.allowed, false);
  assert.equal(decision.allowed === false ? decision.reason : '', 'UNKNOWN_PERMISSION');
});
