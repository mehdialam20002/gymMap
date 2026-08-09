/**
 * `M-023` · `ChangeUserRoleUseCase` — `FR-RBAC-04`, `FR-RBAC-07`, `BR-DAT-01`, `AC-6`, `AC-9`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE THREE OBLIGATIONS, AND THE ORDER THEY HAPPEN IN
 *
 * Each of these is the kind of thing a second caller forgets, and each failure is silent:
 *
 *   the last-owner policy   → skipping it locks a tenant out of its own account
 *   cache invalidation      → skipping it reports success over access it did not remove
 *   the audit row           → skipping it makes a permission change unattributable
 *
 * The ORDER matters for one of them and the test pins it: invalidating before the write leaves a
 * window where the cache is empty and the database still holds the OLD role, so the next request
 * repopulates the cache with exactly the value that was meant to be gone.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ChangeUserRoleUseCase } from '../dist/iam/application/change-user-role.use-case.js';
import type { TenantRoleAssignment } from '../dist/iam/domain/last-owner.policy.js';

const ANA = 'user-ana';
const BEN = 'user-ben';
const ACTOR = 'user-actor';
const REASON = 'Ben is taking over front-desk duties from Ana this quarter.';
const CORRELATION = 'corr-1';

/** Records the order every collaborator was touched in, which is what one of these tests asserts. */
function harness(assignments: readonly TenantRoleAssignment[]) {
  const calls: string[] = [];
  const audited: unknown[] = [];
  const invalidated: string[] = [];

  const store = {
    // No tenant parameters — §11.5 `BR5`. The tenant comes from the request context and the Prisma
    // extension supplies it to every operation; a lint rule fails the build on a signature that
    // accepts one.
    assignmentsFor: async () => {
      calls.push('read');
      return assignments;
    },
    replaceRole: async (_userId: string, _role: string) => {
      calls.push('write');
      return 'GYM_OWNER';
    },
  };

  const cache = {
    read: async () => null,
    write: async () => undefined,
    invalidate: async (userId: string) => {
      calls.push('invalidate');
      invalidated.push(userId);
    },
  };

  const audit = {
    append: async (entry: unknown) => {
      calls.push('audit');
      audited.push(entry);
    },
  };

  // `as any` needs no disable comment here: the test config already turns `no-explicit-any` off,
  // because a spec constructs deliberately-wrong values to prove the code refuses them.
  const useCase = new ChangeUserRoleUseCase(store as any, cache as any, audit as any);
  return { useCase, calls, audited, invalidated };
}

const owner = (userId: string): TenantRoleAssignment => ({ userId, role: 'GYM_OWNER' });

test('a permitted change persists, invalidates and audits — in that order', () => {
  // ┌─ THE ORDER IS THE ASSERTION ───────────────────────────────────────────────────────────────┐
  // │ Invalidate-then-write opens a window where the cache is empty and the database still holds  │
  // │ the old role, so a request arriving in between repopulates the cache with the value that    │
  // │ was meant to be removed. The bug is timing-dependent, rare, and permanent once shipped.      │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const { useCase, calls } = harness([owner(ANA), owner(BEN)]);

  return useCase
    .execute({
      targetUserId: ANA,
      nextRole: 'GYM_MANAGER',
      actorId: ACTOR,
      reason: REASON,
      correlationId: CORRELATION,
    })
    .then(() => {
      assert.deepEqual(calls, ['read', 'write', 'invalidate', 'audit']);
      assert.ok(
        calls.indexOf('write') < calls.indexOf('invalidate'),
        'the cache was cleared before the write — see the note above',
      );
    });
});

test('FR-RBAC-04 — the TARGET user is invalidated, not the actor', () => {
  // Invalidating the actor would clear the wrong session: the person whose access changed is the
  // target, and the actor's own permissions are untouched. Easy to get backwards, and the symptom
  // is that the change appears not to take effect for up to the TTL.
  const { useCase, invalidated } = harness([owner(ANA), owner(BEN)]);

  return useCase
    .execute({
      targetUserId: ANA,
      nextRole: 'GYM_MANAGER',
      actorId: ACTOR,
      reason: REASON,
      correlationId: CORRELATION,
    })
    .then(() => {
      assert.deepEqual(invalidated, [ANA]);
    });
});

test('AC-9 — the audit row carries actor, before, after and reason', () => {
  const { useCase, audited } = harness([owner(ANA), owner(BEN)]);

  return useCase
    .execute({
      targetUserId: ANA,
      nextRole: 'GYM_MANAGER',
      actorId: ACTOR,
      reason: REASON,
      correlationId: CORRELATION,
    })
    .then(() => {
      assert.equal(audited.length, 1);
      const row = audited[0] as Record<string, unknown>;

      assert.equal(row['actorId'], ACTOR);
      assert.equal(row['entityType'], 'USER_ROLE');
      assert.equal(row['entityId'], ANA);
      assert.equal(row['action'], 'UPDATE');
      assert.equal(row['reason'], REASON);
      // `null` here, and that is correct rather than a gap: this is a unit test with no request
      // context, and the use case reads the tenant from the context instead of trusting the command.
      // The integration test is what proves a real request carries it.
      assert.equal(row['tenantId'], null);
      assert.equal(row['correlationId'], CORRELATION);

      // `BR-DAT-01` wants CHANGED FIELDS ONLY, never the whole row. The role is the only thing
      // that moved, and a dump of the user record here would put personal data in a seven-year
      // log estate (`BR-DAT-06`).
      assert.deepEqual(row['before'], { role: 'GYM_OWNER' });
      assert.deepEqual(row['after'], { role: 'GYM_MANAGER' });
      assert.deepEqual(Object.keys(row['before'] as object), ['role']);
    });
});

test('FR-RBAC-07 — demoting the last owner is refused BEFORE anything is written', () => {
  const { useCase, calls } = harness([owner(ANA)]);

  return useCase
    .execute({
      targetUserId: ANA,
      nextRole: 'GYM_MANAGER',
      actorId: ACTOR,
      reason: REASON,
      correlationId: CORRELATION,
    })
    .then(
      () => {
        assert.fail('demoting the last owner should have been refused');
      },
      (error: unknown) => {
        assert.match(String(error), /only owner/i);
        // Nothing after the read. Checking the policy afterwards would mean detecting the lockout
        // by having caused it.
        assert.deepEqual(calls, ['read']);
      },
    );
});

test('the refusal names the code the registry knows, so the envelope is stable', () => {
  const { useCase } = harness([owner(ANA)]);

  return useCase
    .execute({
      targetUserId: ANA,
      nextRole: 'RECEPTIONIST',
      actorId: ACTOR,
      reason: REASON,
      correlationId: CORRELATION,
    })
    .then(
      () => {
        assert.fail('should have been refused');
      },
      (error: unknown) => {
        // 422 rather than 403, from the registry: the caller may well be permitted to change roles,
        // and no permission could ever grant this. A 403 sends them hunting a missing permission.
        assert.equal((error as { code?: string }).code, 'LAST_OWNER_PROTECTED');
      },
    );
});

test('promoting somebody TO owner is permitted and still audited', () => {
  const { useCase, calls, audited } = harness([owner(ANA)]);

  return useCase
    .execute({
      targetUserId: BEN,
      nextRole: 'GYM_OWNER',
      actorId: ACTOR,
      reason: 'Ben is joining Ana as a second owner ahead of the Pune launch.',
      correlationId: CORRELATION,
    })
    .then(() => {
      assert.deepEqual(calls, ['read', 'write', 'invalidate', 'audit']);
      assert.equal(audited.length, 1);
    });
});
