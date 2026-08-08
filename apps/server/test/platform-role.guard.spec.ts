/**
 * `PlatformRoleGuard` — the interim `/v1/admin/*` gate. `TD-034`, pending `M-023`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE CASE THIS EXISTS FOR IS THE TENANT-SCOPED OWNER
 *
 * `roleScopesFor()` emits two shapes: `SUPER_ADMIN@platform` for a platform grant and
 * `GYM_OWNER@t:<uuid>` for a tenant-scoped one. A guard that checked only the role KEY would
 * admit a gym owner to routes that read across every gym on the platform — including his
 * competitors' commission rates.
 *
 * That is the whole reason the scope suffix is parsed rather than the string being searched for a
 * role name, and it is the assertion most likely to be broken by a well-meaning simplification.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PlatformRoleGuard, holdsPlatformRole } from '../dist/common/guards/platform-role.guard.js';
import { PermissionDeniedException } from '../dist/common/errors/domain-exception.js';

/** A Reflector stub. `@PlatformOnly()` is read through it; nothing else about Nest is needed. */
const reflector = (required: boolean) => ({ getAllAndOverride: () => required }) as never;

const contextFor = (principal: unknown) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ principal }) }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  }) as never;

const guard = (required = true) => new PlatformRoleGuard(reflector(required));

// ---------------------------------------------------------------------------
// Admitted.
// ---------------------------------------------------------------------------

for (const role of [
  'SUPER_ADMIN',
  'VERIFICATION_OFFICER',
  'SUPPORT_AGENT',
  'FINANCE',
  'MODERATOR',
]) {
  test(`admits ${role}@platform`, () => {
    assert.equal(guard().canActivate(contextFor({ sub: 'u1', roles: [`${role}@platform`] })), true);
  });
}

test('admits a principal holding a platform role alongside tenant roles', () => {
  // A real shape: somebody who works at the platform AND owns a gym. The platform grant is what
  // decides, and the presence of others must not change that.
  const roles = ['GYM_OWNER@t:01912f00-0000-7000-8000-00000000000a', 'FINANCE@platform'];
  assert.equal(guard().canActivate(contextFor({ sub: 'u1', roles })), true);
});

test('an unmarked route is not gated at all', () => {
  // The guard is global. Without this branch it would refuse every request in the application.
  assert.equal(guard(false).canActivate(contextFor(undefined)), true);
});

// ---------------------------------------------------------------------------
// Refused. These are the assertions that matter.
// ---------------------------------------------------------------------------

const REFUSED: ReadonlyArray<[string, unknown, string]> = [
  [
    'a tenant-scoped GYM_OWNER',
    { sub: 'u1', roles: ['GYM_OWNER@t:01912f00-0000-7000-8000-00000000000a'] },
    'an owner would otherwise read every competitor’s commission rate',
  ],
  [
    'a tenant-scoped role whose KEY is a platform role',
    { sub: 'u1', roles: ['FINANCE@t:01912f00-0000-7000-8000-00000000000a'] },
    'a gym’s own finance staff are not platform finance staff',
  ],
  [
    'an unknown key with a @platform suffix',
    { sub: 'u1', roles: ['ROOT@platform'] },
    'a row inserted into `roles` with scope PLATFORM must not grant admin access by itself',
  ],
  [
    'a principal with no roles at all',
    { sub: 'u1', roles: [] },
    'the ordinary registered member — the exact caller this gate exists to stop',
  ],
  ['a principal with no roles claim', { sub: 'u1' }, 'an older token, or a malformed one'],
  ['no principal at all', undefined, 'the guard must not admit on a missing principal'],
];

for (const [name, principal, why] of REFUSED) {
  test(`NEGATIVE: refuses ${name} — ${why}`, () => {
    assert.throws(() => guard().canActivate(contextFor(principal)), PermissionDeniedException, why);
  });
}

test('the refusal is 403, never 404', () => {
  // The route's EXISTENCE is published in the OpenAPI document, so hiding it would protect
  // nothing while making a misconfigured operator's failure impossible to diagnose.
  try {
    guard().canActivate(contextFor({ sub: 'u1', roles: [] }));
    assert.fail('expected a refusal');
  } catch (error) {
    assert.ok(error instanceof PermissionDeniedException);
    assert.equal(error.httpStatus, 403);
  }
});

// ---------------------------------------------------------------------------
// The predicate, directly.
// ---------------------------------------------------------------------------

test('holdsPlatformRole parses the scope suffix rather than searching the string', () => {
  // The simplification this guards against: `roles.some(r => r.includes('SUPER_ADMIN'))` passes
  // every test above and admits `SUPER_ADMIN@t:<uuid>`, which is a tenant-scoped grant.
  assert.equal(holdsPlatformRole(['SUPER_ADMIN@platform']), true);
  assert.equal(holdsPlatformRole(['SUPER_ADMIN@t:01912f00-0000-7000-8000-00000000000a']), false);
  assert.equal(holdsPlatformRole([]), false);
  assert.equal(holdsPlatformRole(undefined), false);
  // No suffix at all. A bare key is not a scoped grant and must not be read as one.
  assert.equal(holdsPlatformRole(['SUPER_ADMIN']), false);
});
