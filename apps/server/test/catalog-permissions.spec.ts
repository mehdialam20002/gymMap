/**
 * `M-031` · `ADR-0047` — `catalog/`'s five branch keys, and the accessor that refuses a wrong one.
 *
 * ┌─ THE INTERESTING ASSERTIONS HERE ARE THE REFUSALS ───────────────────────────────────────────┐
 * │ That five constants hold five strings is barely worth a test. What is worth pinning is what   │
 * │ `permissionOf()` will NOT let a module do, because both failures it catches produce a key     │
 * │ that resolves at runtime and is wrong:                                                         │
 * │                                                                                              │
 * │   • an INVENTED key — `BLK-10`, which cost weeks and was found only when `PermissionsGuard`   │
 * │     refused it as `UNKNOWN_PERMISSION` at request time;                                        │
 * │   • a REAL key attributed to the WRONG ROW — `ADR-0043`'s capability shopping, which is worse │
 * │     because nothing refuses it at all. It grants that row's holders instead of the ones the   │
 * │     requirement names, and looks correct in review.                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CATALOG_PERMISSIONS } from '../dist/catalog/permissions.js';
import { ONBOARDING_PERMISSIONS } from '../dist/onboarding/permissions.js';
import { PERMISSION_KEYS, permissionOf, permissionsFor } from '../dist/iam/permissions.js';
import { PLATFORM_ROLES } from '../dist/iam/types/iam.types.js';

// ═══════════════════════════════════════════════════════════════════════════
// permissionOf — the two things it refuses.
// ═══════════════════════════════════════════════════════════════════════════

test('permissionOf refuses a capability label that is in no §B3.2 row', () => {
  assert.throws(
    () => permissionOf('Manage branches', 'catalog.branch.list'),
    /has no capability labelled "Manage branches"/,
  );
});

test('permissionOf refuses a REAL key attributed to the WRONG row — capability shopping', () => {
  /*
   * `catalog.branch.list` is a real, resolvable key. Attributing it to *Edit gym profile* would
   * hand it to that row's holders — which include `SUPPORT_AGENT ○` and `VERIFICATION_OFFICER ○`,
   * two PLATFORM roles that hold nothing on row 20.
   *
   * Nothing else in the stack catches this. `PG-7` sees a key present in a `permissions.ts` and is
   * satisfied; `PermissionsGuard` resolves it and allows the request. It is the exact shape of the
   * four escalations an adversarial pass found in the refused `BLK-19` draft.
   */
  assert.throws(
    () => permissionOf('Edit gym profile', 'catalog.branch.list'),
    /does not declare "catalog\.branch\.list"/,
  );
});

test('permissionOf reaches extraReadKeys and extraWriteKeys, not just the two named fields', () => {
  // Four of `catalog/`'s five keys and four of `onboarding/`'s five live in the extra arrays. An
  // accessor that only looked at `readKey`/`writeKey` would reject them as invented — the same
  // blind spot that made the FR-RBAC-05 inspector disagree with the guard until ADR-0047.
  assert.equal(permissionOf('Add / remove branch', 'catalog.branch.list'), 'catalog.branch.list');
  assert.equal(
    permissionOf('Add / remove branch', 'catalog.branch.deactivate'),
    'catalog.branch.deactivate',
  );
  assert.equal(
    permissionOf('Submit own gym application', 'onboarding.kyc_document.delete'),
    'onboarding.kyc_document.delete',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// The keys themselves, and who ends up holding them.
// ═══════════════════════════════════════════════════════════════════════════

test('every catalog and onboarding key is in PERMISSION_KEYS, so PG-7 can see it', () => {
  const declared = [
    ...Object.values(CATALOG_PERMISSIONS),
    ...Object.values(ONBOARDING_PERMISSIONS),
  ];
  // 5 branch + 8 onboarding (3 reviewer-side, predating ADR-0047, and 5 tenant-side added by it).
  assert.equal(declared.length, 13, 'the key count changed — 5 catalog, 8 onboarding');
  for (const key of declared) {
    assert.ok(PERMISSION_KEYS.includes(key), `${key} is in no capability row`);
  }
});

test('the three branch-scoped roles hold the two reads and none of the three writes', () => {
  /*
   * `ADR-0047` in one assertion. The owner's answer was that a receptionist and a trainer SEE the
   * branch list; the scope I wrote down was that seeing is all they do. `○` is what enforces it,
   * and `○` is three characters that a later edit could turn into `▪` without looking like much.
   */
  const READS = [CATALOG_PERMISSIONS.BRANCH_LIST, CATALOG_PERMISSIONS.BRANCH_READ];
  const WRITES = [
    CATALOG_PERMISSIONS.BRANCH_CREATE,
    CATALOG_PERMISSIONS.BRANCH_UPDATE,
    CATALOG_PERMISSIONS.BRANCH_DEACTIVATE,
  ];

  for (const role of ['RECEPTIONIST', 'TRAINER', 'GYM_MANAGER'] as const) {
    const held = permissionsFor(role);
    for (const key of READS) assert.ok(held.includes(key), `${role} cannot ${key}`);
    for (const key of WRITES) assert.ok(!held.includes(key), `${role} can ${key}`);
  }
});

test('nobody outside the tenant holds a branch key except SUPER_ADMIN', () => {
  // A platform role acquiring a tenant-side branch write is the `PE-T5` refusal, and `SUPPORT` sits
  // one cell away on row 19. Asserted across all twelve rather than for the roles I thought of.
  const TENANT_SIDE = ['RECEPTIONIST', 'TRAINER', 'GYM_MANAGER', 'GYM_OWNER', 'SUPER_ADMIN'];
  const branchKeys = Object.values(CATALOG_PERMISSIONS);

  for (const role of PLATFORM_ROLES) {
    if (TENANT_SIDE.includes(role)) continue;
    for (const key of branchKeys) {
      assert.ok(!permissionsFor(role).includes(key), `${role} holds ${key} and should hold none`);
    }
  }
});

test('only GYM_OWNER may submit an application, and it may not decide one', () => {
  // The `BR-GYM-03` separation, from the other side of `rbac-matrix.spec.ts`'s version: there it is
  // asserted against the matrix, here against the keys the module actually declares.
  for (const role of PLATFORM_ROLES) {
    const held = permissionsFor(role).includes(ONBOARDING_PERMISSIONS.OWN_APPLICATION_SUBMIT);
    assert.equal(held, role === 'GYM_OWNER', `${role} submit=${String(held)}`);
  }
  assert.ok(
    !permissionsFor('GYM_OWNER').includes(ONBOARDING_PERMISSIONS.APPLICATION_DECISION_CREATE),
    'GYM_OWNER can decide its own application',
  );
});
