/**
 * `M-023` · `PermissionsGuard` and the scope resolution beneath it — `FR-RBAC-02`, `FR-RBAC-03`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * EVERY SCOPE HAS A NEGATIVE CASE, AND THE NEGATIVE CASE IS THE TEST
 *
 * `BAC-06` requires one per scope, and the reason is that the positive cases pass under a broken
 * implementation. A guard that ignores scope entirely — checks only "does this role hold this
 * permission" — passes every `allowed` assertion below and fails only the `NEGATIVE:` ones.
 *
 * That is the exact bug `FR-RBAC-02` exists to prevent, and it is invisible in a single-tenant
 * test database: two gym owners both hold `catalog.plan.write`, so the check answers yes for
 * either of them on either gym.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  effectivePermissions,
  parseRoleGrant,
  parseRoleGrants,
  permits,
  type ResourceContext,
  type RoleGrant,
} from '../dist/iam/domain/effective-permissions.js';
import { permissionsFor } from '../dist/iam/permissions.js';

/*
 * Imported from `dist`, not from `src`, and that is the repository's pattern rather than a
 * shortcut. `src` modules import each other with `.js` specifiers because the build is NodeNext
 * ESM; Node's native type stripping cannot map a `.js` specifier back to a `.ts` file, so a spec
 * that reaches into `src` works only while every transitive import is type-only. This one needs
 * `permissionsFor` at runtime. `verification-sla.spec.ts` reads `dist` for the same reason.
 */

const TENANT_A = '0192de00-0000-7000-8000-00000000000a';
const TENANT_B = '0192de00-0000-7000-8000-00000000000b';
const BRANCH_1 = '0192de00-0000-7000-8000-0000000000b1';
const BRANCH_2 = '0192de00-0000-7000-8000-0000000000b2';
const ME = 'user-me';
const SOMEBODY_ELSE = 'user-other';

const inTenant = (tenantId: string, extra: Partial<ResourceContext> = {}): ResourceContext => ({
  tenantId,
  ...extra,
});

// ═══════════════════════════════════════════════════════════════════════════
// Parsing the claim. A malformed entry must contribute nothing, never throw.
// ═══════════════════════════════════════════════════════════════════════════

test('a platform grant is only honoured for a role §B3.1 scopes to the platform', () => {
  assert.deepEqual(parseRoleGrant('SUPER_ADMIN@platform'), {
    role: 'SUPER_ADMIN',
    scope: { kind: 'PLATFORM' },
  });

  // ┌─ THE ESCALATION THIS LINE PREVENTS ────────────────────────────────────────────────────────┐
  // │ `GYM_OWNER@platform` is a forged or stale claim. Honouring it would give one gym's owner a  │
  // │ PLATFORM scope, which reaches every tenant on the estate — the whole of `BR-TEN-01` gone    │
  // │ through a string in a token.                                                                │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  assert.equal(parseRoleGrant('GYM_OWNER@platform'), null);
  assert.equal(parseRoleGrant('RECEPTIONIST@platform'), null);
});

test('a malformed claim yields null rather than throwing', () => {
  // Throwing would turn a malformed claim into a 500, which tells an attacker the string reached
  // the parser. Contributing nothing produces a clean 403 with no signal in it.
  for (const bad of ['', 'SUPER_ADMIN', '@platform', 'NOT_A_ROLE@platform', 'GYM_OWNER@t:', 'GYM_OWNER@']) {
    assert.equal(parseRoleGrant(bad), null, `"${bad}" should not parse`);
  }
});

test('a branch grant carries its tenant, so a branch id is not portable between tenants', () => {
  const grant = parseRoleGrant(`RECEPTIONIST@b:${TENANT_A}:${BRANCH_1}`);
  assert.deepEqual(grant, {
    role: 'RECEPTIONIST',
    scope: { kind: 'BRANCH', tenantId: TENANT_A, branchId: BRANCH_1 },
  });

  // Without the tenant in the claim, two tenants that ever collided on a branch id would make the
  // grant portable between them.
  assert.equal(parseRoleGrant(`RECEPTIONIST@b:${BRANCH_1}`), null);
});

test('parseRoleGrants drops the bad entries and keeps the good ones', () => {
  const grants = parseRoleGrants(['SUPER_ADMIN@platform', 'garbage', `GYM_OWNER@t:${TENANT_A}`]);
  assert.equal(grants.length, 2);
  assert.equal(parseRoleGrants(undefined).length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM scope.
// ═══════════════════════════════════════════════════════════════════════════

test('PLATFORM reaches a resource in any tenant', () => {
  const grants: RoleGrant[] = [{ role: 'SUPER_ADMIN', scope: { kind: 'PLATFORM' } }];
  const permission = permissionsFor('SUPER_ADMIN')[0]!;

  assert.equal(permits(permission, grants, inTenant(TENANT_A), ME).allowed, true);
  assert.equal(permits(permission, grants, inTenant(TENANT_B), ME).allowed, true);
});

test('NEGATIVE: PLATFORM does not conjure a permission the role never held', () => {
  // `VERIFICATION_OFFICER` is platform-scoped and reviews onboarding. §B3.2 does not give it the
  // financial capabilities, and a PLATFORM scope must not be read as "everything".
  const grants: RoleGrant[] = [{ role: 'VERIFICATION_OFFICER', scope: { kind: 'PLATFORM' } }];
  const financeOnly = permissionsFor('FINANCE').filter(
    (key) => !permissionsFor('VERIFICATION_OFFICER').includes(key),
  );

  assert.ok(financeOnly.length > 0, 'the matrix no longer separates FINANCE from VERIFICATION');
  const decision = permits(financeOnly[0]!, grants, inTenant(TENANT_A), ME);
  assert.equal(decision.allowed, false);
  assert.equal(decision.allowed === false && decision.reason, 'NOT_GRANTED');
});

// ═══════════════════════════════════════════════════════════════════════════
// TENANT scope — the case a single-tenant test database cannot catch.
// ═══════════════════════════════════════════════════════════════════════════

test('TENANT reaches its own tenant', () => {
  const grants: RoleGrant[] = [{ role: 'GYM_OWNER', scope: { kind: 'TENANT', tenantId: TENANT_A } }];
  const permission = permissionsFor('GYM_OWNER')[0]!;
  assert.equal(permits(permission, grants, inTenant(TENANT_A), ME).allowed, true);
});

test('NEGATIVE: TENANT does not reach another tenant, even holding the permission', () => {
  // ┌─ THE WHOLE POINT OF `FR-RBAC-02` ─────────────────────────────────────────────────────────┐
  // │ Both gym owners hold `catalog.plan.write`. A guard that checks the permission and not the  │
  // │ scope answers YES here, passes every other test in this file, and is a total tenancy       │
  // │ failure the moment the platform has two customers.                                        │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const grants: RoleGrant[] = [{ role: 'GYM_OWNER', scope: { kind: 'TENANT', tenantId: TENANT_A } }];
  const permission = permissionsFor('GYM_OWNER')[0]!;

  const decision = permits(permission, grants, inTenant(TENANT_B), ME);
  assert.equal(decision.allowed, false);
  assert.equal(
    decision.allowed === false && decision.reason,
    'OUT_OF_SCOPE',
    'the reason must distinguish a tenancy failure from a missing role',
  );
});

test('NEGATIVE: TENANT does not reach a resource belonging to no tenant', () => {
  // A global reference table. A tenant-scoped role writing one would edit it for every gym.
  const grants: RoleGrant[] = [{ role: 'GYM_OWNER', scope: { kind: 'TENANT', tenantId: TENANT_A } }];
  const permission = permissionsFor('GYM_OWNER')[0]!;
  assert.equal(permits(permission, grants, { tenantId: null }, ME).allowed, false);
});

// ═══════════════════════════════════════════════════════════════════════════
// BRANCH scope.
// ═══════════════════════════════════════════════════════════════════════════

test('BRANCH reaches its own branch', () => {
  const grants: RoleGrant[] = [
    { role: 'RECEPTIONIST', scope: { kind: 'BRANCH', tenantId: TENANT_A, branchId: BRANCH_1 } },
  ];
  const permission = permissionsFor('RECEPTIONIST')[0]!;
  assert.equal(
    permits(permission, grants, inTenant(TENANT_A, { branchId: BRANCH_1 }), ME).allowed,
    true,
  );
});

test('NEGATIVE: BRANCH does not reach a sibling branch in the same tenant', () => {
  const grants: RoleGrant[] = [
    { role: 'RECEPTIONIST', scope: { kind: 'BRANCH', tenantId: TENANT_A, branchId: BRANCH_1 } },
  ];
  const permission = permissionsFor('RECEPTIONIST')[0]!;
  const decision = permits(permission, grants, inTenant(TENANT_A, { branchId: BRANCH_2 }), ME);
  assert.equal(decision.allowed, false);
  assert.equal(decision.allowed === false && decision.reason, 'OUT_OF_SCOPE');
});

test('NEGATIVE: BRANCH does not reach a TENANT-level resource', () => {
  // ┌─ THE ESCALATION A `===` COMPARISON WOULD ALLOW ────────────────────────────────────────────┐
  // │ A tenant-level resource has `branchId: null`. Comparing it to the grant's branch id without │
  // │ the null check first is the difference between "a receptionist at one branch" and "a        │
  // │ receptionist editing the tenant's commission rate".                                        │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const grants: RoleGrant[] = [
    { role: 'RECEPTIONIST', scope: { kind: 'BRANCH', tenantId: TENANT_A, branchId: BRANCH_1 } },
  ];
  const permission = permissionsFor('RECEPTIONIST')[0]!;

  assert.equal(permits(permission, grants, inTenant(TENANT_A, { branchId: null }), ME).allowed, false);
  // And with the key absent entirely, which is how a route that never loads a branch presents.
  assert.equal(permits(permission, grants, inTenant(TENANT_A), ME).allowed, false);
});

// ═══════════════════════════════════════════════════════════════════════════
// SELF scope.
// ═══════════════════════════════════════════════════════════════════════════

test('SELF reaches the principal own record', () => {
  const grants: RoleGrant[] = [{ role: 'MEMBER', scope: { kind: 'SELF' } }];
  const permission = permissionsFor('MEMBER')[0]!;
  assert.equal(
    permits(permission, grants, { tenantId: null, subjectUserId: ME }, ME).allowed,
    true,
  );
});

test('NEGATIVE: SELF does not reach another user record', () => {
  const grants: RoleGrant[] = [{ role: 'MEMBER', scope: { kind: 'SELF' } }];
  const permission = permissionsFor('MEMBER')[0]!;
  const decision = permits(permission, grants, { tenantId: null, subjectUserId: SOMEBODY_ELSE }, ME);
  assert.equal(decision.allowed, false);
  assert.equal(decision.allowed === false && decision.reason, 'OUT_OF_SCOPE');
});

test('NEGATIVE: SELF does not reach a resource that is not about a user at all', () => {
  const grants: RoleGrant[] = [{ role: 'MEMBER', scope: { kind: 'SELF' } }];
  const permission = permissionsFor('MEMBER')[0]!;
  assert.equal(permits(permission, grants, inTenant(TENANT_A), ME).allowed, false);
});

// ═══════════════════════════════════════════════════════════════════════════
// Deny by default — AC-5.
// ═══════════════════════════════════════════════════════════════════════════

test('AC-5 — a permission absent from the matrix is refused as a CONFIGURATION gap', () => {
  const grants: RoleGrant[] = [{ role: 'SUPER_ADMIN', scope: { kind: 'PLATFORM' } }];

  // Not `NOT_GRANTED`: no role could ever hold it, so this is a route naming a permission that
  // does not exist. The distinction is what decides whether an operator or an engineer is paged.
  const decision = permits('catalog.plan.edit', grants, inTenant(TENANT_A), ME);
  assert.equal(decision.allowed, false);
  assert.equal(decision.allowed === false && decision.reason, 'UNKNOWN_PERMISSION');
});

test('AC-5 — a principal with no grants at all is refused', () => {
  const permission = permissionsFor('SUPER_ADMIN')[0]!;
  const decision = permits(permission, [], inTenant(TENANT_A), ME);
  assert.equal(decision.allowed, false);
  assert.equal(decision.allowed === false && decision.reason, 'NOT_GRANTED');
});

// ═══════════════════════════════════════════════════════════════════════════
// FR-RBAC-02, asserted structurally: the answer must depend on the scope.
// ═══════════════════════════════════════════════════════════════════════════

test('FR-RBAC-02 — the SAME role and permission decide differently by scope alone', () => {
  // ┌─ THIS IS THE ASSERTION A ROLE-ONLY IMPLEMENTATION FAILS ───────────────────────────────────┐
  // │ Everything else here can be satisfied by checking role membership. This cannot: the role,   │
  // │ the permission and the principal are identical in both calls and only the resource moves.   │
  // │ If both answers agree, scope is being ignored.                                              │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const grants: RoleGrant[] = [{ role: 'GYM_OWNER', scope: { kind: 'TENANT', tenantId: TENANT_A } }];
  const permission = permissionsFor('GYM_OWNER')[0]!;

  const own = permits(permission, grants, inTenant(TENANT_A), ME);
  const other = permits(permission, grants, inTenant(TENANT_B), ME);

  assert.equal(own.allowed, true);
  assert.equal(other.allowed, false);
  assert.notEqual(own.allowed, other.allowed, 'the decision does not depend on scope');
});

test('a decision reports WHICH grant allowed it, so an audit row can name the scope', () => {
  const grants: RoleGrant[] = [
    { role: 'RECEPTIONIST', scope: { kind: 'BRANCH', tenantId: TENANT_A, branchId: BRANCH_1 } },
    { role: 'GYM_OWNER', scope: { kind: 'TENANT', tenantId: TENANT_A } },
  ];
  // A capability only the owner holds, so the answer is unambiguous about which grant carried it.
  const ownerOnly = permissionsFor('GYM_OWNER').filter(
    (key) => !permissionsFor('RECEPTIONIST').includes(key),
  );
  assert.ok(ownerOnly.length > 0);

  const decision = permits(ownerOnly[0]!, grants, inTenant(TENANT_A), ME);
  assert.equal(decision.allowed, true);
  assert.equal(decision.allowed === true && decision.via.role, 'GYM_OWNER');
});

// ═══════════════════════════════════════════════════════════════════════════
// FR-RBAC-05 — the effective-permission inspector.
// ═══════════════════════════════════════════════════════════════════════════

test('FR-RBAC-05 — effective permissions carry the scope each came from', () => {
  const grants: RoleGrant[] = [
    { role: 'GYM_OWNER', scope: { kind: 'TENANT', tenantId: TENANT_A } },
    { role: 'RECEPTIONIST', scope: { kind: 'BRANCH', tenantId: TENANT_A, branchId: BRANCH_1 } },
  ];

  const effective = effectivePermissions(grants);

  // A permission both roles hold must list BOTH scopes — an inspector that showed only one would
  // tell an operator they have branch access when they also have tenant access, or the reverse.
  const shared = permissionsFor('GYM_OWNER').find((key) =>
    permissionsFor('RECEPTIONIST').includes(key),
  );
  assert.ok(shared !== undefined, 'the two roles share no capability — the matrix changed shape');
  assert.equal(effective.get(shared)?.length, 2);

  // And it is not a permission list with the scopes thrown away.
  assert.ok(
    effective.get(shared)?.some((scope) => scope.kind === 'BRANCH'),
    'the branch scope was dropped',
  );
});

test('effective permissions of no grants is empty, not everything', () => {
  assert.equal(effectivePermissions([]).size, 0);
});
