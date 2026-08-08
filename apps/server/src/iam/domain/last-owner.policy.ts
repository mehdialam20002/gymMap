/**
 * `M-023` · The last `GYM_OWNER` cannot be removed or demoted — `FR-RBAC-07`, `FR-STAF-09`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A POLICY AND NOT A CHECK INSIDE THE CONTROLLER
 *
 * The roadmap is explicit that the check lives at the SERVICE layer, and the reason is the shape of
 * the eventual system rather than today's one endpoint. Three callers will remove a role:
 *
 *   the staff-management endpoint      · `FR-STAF-09`
 *   a bulk staff import                · a spreadsheet with a typo in the role column
 *   an offboarding job                 · deactivating a user who left
 *
 * A check in the controller protects the first and neither of the others, and the failure is
 * silent: a tenant ends up with no owner, which means nobody can grant a role, so nobody can
 * appoint a new owner. The tenant is locked out of its own account and only a platform operator
 * can unpick it.
 *
 * A pure function here is callable from all three and testable without any of them.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ REMOVAL AND DEMOTION ARE THE SAME EVENT WEARING TWO NAMES ─────────────────────────────────┐
 * │ `FR-RBAC-07` names both, and an implementation that guards only `DELETE /staff/:id` misses    │
 * │ the one people actually reach for: changing the last owner's role to `GYM_MANAGER` in a form.  │
 * │ Both end with the tenant holding zero owners, so both are refused by the same predicate.       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import type { PlatformRole } from '../types/iam.types.js';

/** The role assignments a tenant currently has. One entry per `user_roles` row. */
export interface TenantRoleAssignment {
  readonly userId: string;
  readonly role: PlatformRole;
}

export type LastOwnerVerdict =
  | { readonly permitted: true }
  | {
      readonly permitted: false;
      /**
       * Why, in the operator's words.
       *
       * Carried rather than left to the caller so all three call sites say the same thing — a bulk
       * import that reported "validation failed" while the API said "the last owner cannot be
       * removed" would send two people to two different explanations of one rule.
       */
      readonly reason: string;
    };

const OWNER: PlatformRole = 'GYM_OWNER';

/**
 * How many owners the tenant would have left afterwards.
 *
 * Counted by DISTINCT user, not by row. One person can hold `GYM_OWNER` twice — once tenant-wide
 * and once against a branch — and counting rows would report two owners where there is one person,
 * which is precisely the case where letting the removal through empties the tenant.
 */
function ownersOtherThan(
  assignments: readonly TenantRoleAssignment[],
  userId: string,
): ReadonlySet<string> {
  const owners = new Set<string>();
  for (const assignment of assignments) {
    if (assignment.role === OWNER && assignment.userId !== userId) owners.add(assignment.userId);
  }
  return owners;
}

/**
 * May this user's `GYM_OWNER` role be taken away?
 *
 * Covers removal and demotion alike: pass the assignments as they stand and the user losing the
 * role. A user who is not an owner is always permitted — there is nothing to lose.
 */
export function mayRevokeOwner(
  assignments: readonly TenantRoleAssignment[],
  userId: string,
): LastOwnerVerdict {
  const isOwner = assignments.some(
    (assignment) => assignment.role === OWNER && assignment.userId === userId,
  );
  if (!isOwner) return { permitted: true };

  if (ownersOtherThan(assignments, userId).size === 0) {
    return {
      permitted: false,
      reason:
        'This is the only owner of this gym. Removing or demoting them would leave nobody able ' +
        'to grant roles, including the role needed to appoint a replacement. Add a second owner ' +
        'first, then change this one.',
    };
  }

  return { permitted: true };
}

/**
 * May this user's role be CHANGED to `nextRole`?
 *
 * A change away from `GYM_OWNER` is a demotion and goes through the same predicate. A change TO
 * `GYM_OWNER`, or between two non-owner roles, is always permitted by this policy — it cannot
 * reduce the owner count.
 */
export function mayChangeRole(
  assignments: readonly TenantRoleAssignment[],
  userId: string,
  nextRole: PlatformRole,
): LastOwnerVerdict {
  // Re-assigning the same role is a no-op and must not be refused: an idempotent PUT that replays
  // the current state would otherwise fail on the last owner.
  if (nextRole === OWNER) return { permitted: true };
  return mayRevokeOwner(assignments, userId);
}
