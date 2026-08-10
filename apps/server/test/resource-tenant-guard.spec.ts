/**
 * `M-023` · `FR-RBAC-03` — `ResourceTenantGuard`, which had 126 lines and zero test references.
 *
 * ┌─ WHAT THIS GUARD IS FOR, AND WHY ITS ANSWER IS 404 ──────────────────────────────────────────┐
 * │ `PermissionsGuard` answers **403**: *you may not do this*. This one answers **404**: *there is │
 * │ no such thing*. The difference is not politeness.                                              │
 * │                                                                                              │
 * │ A 403 CONFIRMS THE RESOURCE EXISTS. For a resource in another tenant that confirmation is     │
 * │ itself the leak — an attacker walking ids learns which are real without ever reading a row.   │
 * │ So "no such id" and "another tenant's id" must be indistinguishable, and this file asserts    │
 * │ that they are: same exception, same message, one code path.                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Driven through a fake `ExecutionContext` and a map-backed locator, which is exactly what the
 * `ResourceLocator` port was shaped for — see its header. Nothing here needs a database, because
 * nothing here is a database question: it is about which of two answers the guard gives.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';

import { ResourceTenantGuard } from '../dist/common/guards/resource-tenant.guard.js';
import type { ResourceLocator } from '../dist/common/guards/resource-tenant.guard.js';
import { RESOURCE_CONTEXT } from '../dist/common/guards/permissions.guard.js';
import type { ResourceContext } from '../dist/iam/domain/effective-permissions.js';

const TENANT_A = '0192de00-7000-7000-8000-0000000000a1';
const BRANCH_A = '0192de00-7000-7000-8000-0000000000b1';

interface FakeRequest {
  params?: Record<string, string | undefined>;
  [RESOURCE_CONTEXT]?: ResourceContext;
}

/** Only what the guard actually reads. A fuller double would hide which parts it depends on. */
function contextFor(request: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function listBranches() {},
    getClass: () => class BranchController {},
  } as unknown as ExecutionContext;
}

/**
 * A reflector that returns the `@ActsOn()` metadata directly.
 *
 * The real decorator writes it with `SetMetadata`; constructing a decorated class here would test
 * NestJS's metadata plumbing rather than this guard's behaviour.
 */
function reflectorReturning(metadata: unknown): Reflector {
  return { getAllAndOverride: () => metadata } as unknown as Reflector;
}

const locatorFor = (rows: Record<string, ResourceContext>): ResourceLocator => ({
  find: (resource, id) => Promise.resolve(rows[`${resource}:${id}`] ?? null),
});

const BRANCHES = locatorFor({
  'branch:B1': { tenantId: TENANT_A, branchId: BRANCH_A },
});

// ═══════════════════════════════════════════════════════════════════════════
// The happy path, and the one output that matters.
// ═══════════════════════════════════════════════════════════════════════════

test('a resolvable resource puts its ResourceContext on the request', async () => {
  /*
   * The guard's real output is not `true` — it is the context it writes, because `PermissionsGuard`
   * runs next and decides against it. A guard that returned `true` and wrote nothing would let
   * every scope check fall back to the SESSION's tenant, which is precisely the `FR-RBAC-03`
   * failure: evaluating the caller's tenant instead of the resource's.
   */
  const request: FakeRequest = { params: { branchId: 'B1' } };
  const guard = new ResourceTenantGuard(
    reflectorReturning({ resource: 'branch', param: 'branchId' }),
    BRANCHES,
  );

  assert.equal(await guard.canActivate(contextFor(request)), true);
  assert.deepEqual(request[RESOURCE_CONTEXT], { tenantId: TENANT_A, branchId: BRANCH_A });
});

test('a route with no @ActsOn() passes through and writes nothing', async () => {
  // A collection route — `GET /tenant/branches` — has no single resource to load. The repository
  // scopes it, so the guard must not invent a context that `PermissionsGuard` would then trust.
  const request: FakeRequest = { params: {} };
  const guard = new ResourceTenantGuard(reflectorReturning(undefined), BRANCHES);

  assert.equal(await guard.canActivate(contextFor(request)), true);
  assert.equal(request[RESOURCE_CONTEXT], undefined);
});

// ═══════════════════════════════════════════════════════════════════════════
// The refusals — and that two of them are indistinguishable.
// ═══════════════════════════════════════════════════════════════════════════

test('an id that does not exist and another tenant’s id give the SAME answer', async () => {
  /*
   * The load-bearing assertion in this file. The locator reads through the tenant-scoped client, so
   * RLS makes another tenant's row simply absent — both cases arrive here as `null`, and both must
   * leave as the same exception with the same message.
   *
   * Asserted by comparing the two refusals to each other rather than each to a literal: a future
   * change that made one message more helpful would pass a per-case assertion and fail this one,
   * which is the right way round. "Branch not found in your gym" is an enumeration oracle.
   */
  const guard = new ResourceTenantGuard(
    reflectorReturning({ resource: 'branch', param: 'branchId' }),
    BRANCHES,
  );

  const refusalFor = async (id: string): Promise<{ name: string; message: string }> => {
    try {
      await guard.canActivate(contextFor({ params: { branchId: id } }));
      throw new Error(`expected a refusal for ${id}`);
    } catch (error) {
      const e = error as Error;
      return { name: e.constructor.name, message: e.message };
    }
  };

  const nonexistent = await refusalFor('B-does-not-exist');
  const otherTenant = await refusalFor('B-belongs-to-tenant-B'); // absent under RLS, so also null

  assert.deepEqual(
    nonexistent,
    otherTenant,
    'the two refusals differ, which is an enumeration oracle',
  );
  assert.equal(nonexistent.name, 'NotFoundException');
});

test('a declared param the route does not have is refused, not silently skipped', async () => {
  /*
   * `@ActsOn('branch', 'branchId')` on a path template that says `:id` is a wiring mistake. The
   * guard could reasonably treat a missing param as "no resource" and pass through — and that is
   * the dangerous reading: the route would then run with NO resource context, and every scope
   * check would fall back to the session's tenant. It refuses instead, and logs.
   */
  const guard = new ResourceTenantGuard(
    reflectorReturning({ resource: 'branch', param: 'branchId' }),
    BRANCHES,
  );

  await assert.rejects(() => guard.canActivate(contextFor({ params: { id: 'B1' } })), /Not found/);
});

test('an empty string param is treated as missing, not looked up', async () => {
  // `/branches//edit` gives `''`, which is falsy in the guard's check and truthy as a map miss.
  // Both refuse here — but they refuse for different reasons, and only one of them logs the
  // wiring error a developer needs to see.
  let looked = false;
  const watching: ResourceLocator = {
    find: (resource, id) => {
      looked = true;
      return BRANCHES.find(resource, id);
    },
  };
  const guard = new ResourceTenantGuard(
    reflectorReturning({ resource: 'branch', param: 'branchId' }),
    watching,
  );

  await assert.rejects(() => guard.canActivate(contextFor({ params: { branchId: '' } })));
  assert.equal(looked, false, 'an empty id reached the locator, which would query for nothing');
});

test('a request with no params at all does not throw a TypeError', async () => {
  // `request.params` is optional in the guard's own type. A non-HTTP context or a malformed
  // request must produce the domain refusal, not a 500 that tells the caller the guard crashed.
  const guard = new ResourceTenantGuard(
    reflectorReturning({ resource: 'branch', param: 'branchId' }),
    BRANCHES,
  );

  await assert.rejects(() => guard.canActivate(contextFor({})), /Not found/);
});
