/**
 * `M-031` · May this branch be deactivated — `Gym.md` §12.4, `FR-GYM-07`, `BR-MEM-14`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * A PURE DECISION, TAKING FACTS AND RETURNING A VERDICT
 *
 * No repository, no clock, no transaction. The caller gathers the three facts — is the gym
 * approved, which branches are active, how many members are affected — and this decides. That is
 * what makes every refusal testable without a database, and it is why the use case can gather them
 * inside one transaction as `Gym.md` §12.4 requires without the rule caring how.
 *
 * ┌─ THE THREE OUTCOMES, AND WHY THE ORDER THEY ARE CHECKED IN MATTERS ──────────────────────────┐
 * │ 1. LAST ACTIVE BRANCH of an APPROVED gym → refuse, `CONFIG_VALIDATION_FAILED`.                │
 * │    *"a listed gym with no location is not a listing."*                                         │
 * │ 2. MEMBERS STILL AFFECTED → refuse, `BRANCH_HAS_ACTIVE_MEMBERSHIPS`, carrying the count.       │
 * │ 3. Otherwise → permitted, and the verdict says whether a promotion has to happen with it.      │
 * │                                                                                              │
 * │ Last-branch is checked FIRST even though the membership count is the rule `Gym.md` calls      │
 * │ *"the rule that matters"*. If both are true, an owner told "move 1,247 members first" would   │
 * │ do exactly that — a week of work — and then meet the second refusal, which no amount of       │
 * │ moving members can clear. The unfixable obstacle has to be the one they hear about.            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ AND A FOURTH OUTCOME THAT IS NOT A REFUSAL: THE PROMOTION ──────────────────────────────────┐
 * │ *"Deactivating the **primary** branch of a gym with other active branches promotes the next   │
 * │ branch in the same transaction."* So permission is not a boolean — a caller that treats it as │
 * │ one leaves a gym with no primary branch, which `uq_branches__one_primary_per_gym` permits     │
 * │ (the index forbids two, not zero) and which nothing else would notice until an invoice needed │
 * │ the canonical address.                                                                         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { AffectedMembershipCount } from '../application/ports/affected-memberships.port.js';
import type { BranchIdentity, GymStatus } from '../types/catalog.types.js';

export interface DeactivationFacts {
  readonly gymStatus: GymStatus;
  /** Every ACTIVE branch of the gym, primary first — `BranchQueryPort.activeInGym`'s ordering. */
  readonly activeBranches: readonly BranchIdentity[];
  readonly branchId: string;
  readonly affected: AffectedMembershipCount;
}

export type DeactivationVerdict =
  | {
      readonly permitted: true;
      /**
       * The branch to make primary in the same transaction, or `null` when none is needed.
       *
       * Present on the PERMITTED outcome rather than left to the caller, because the caller that
       * forgets it produces a gym with no primary branch and no error.
       */
      readonly promoteToPrimary: string | null;
    }
  | {
      readonly permitted: false;
      readonly code: 'CONFIG_VALIDATION_FAILED';
      readonly field: 'branch_id';
      readonly reason: string;
    }
  | {
      readonly permitted: false;
      readonly code: 'BRANCH_HAS_ACTIVE_MEMBERSHIPS';
      readonly branchId: string;
      readonly memberCount: number;
    }
  | {
      readonly permitted: false;
      /**
       * The count could not be established, so the domain cannot say the branch is safe to close.
       *
       * Reported as `BRANCH_HAS_ACTIVE_MEMBERSHIPS` with no count rather than as its own code:
       * from the owner's side the situation is the same — the branch cannot be closed right now —
       * and inventing a code for "we could not check" would mean registering one that `Gym.md`
       * does not name. The absent count is what tells an operator which of the two it was.
       */
      readonly code: 'BRANCH_HAS_ACTIVE_MEMBERSHIPS';
      readonly branchId: string;
      readonly memberCount: null;
      readonly unavailableReason: string;
    };

/** Gym statuses for which a gym is publicly listed and therefore needs at least one location. */
const LISTED_STATUSES: readonly GymStatus[] = ['APPROVED', 'PENDING_REVIEW'];

export function mayDeactivate(facts: DeactivationFacts): DeactivationVerdict {
  const target = facts.activeBranches.find((branch) => branch.id === facts.branchId);

  /*
   * A branch that is not in the active list is already inactive, and deactivating it again is a
   * no-op rather than a refusal.
   *
   * PERMITTED with no promotion: `Gym.md` §12.4's promotion clause is about *"the primary branch
   * of a gym with other active branches"*, and a branch that is not active is not that. Returning
   * a refusal here would make a retried DELETE — the ordinary consequence of a flaky connection on
   * an endpoint that requires an Idempotency-Key — look like a business rule firing.
   */
  if (target === undefined) return { permitted: true, promoteToPrimary: null };

  /*
   * 1 · The last location of a listed gym. Checked before the count — see the header.
   *
   * `PENDING_REVIEW` is included alongside `APPROVED`: a gym awaiting review with no location is a
   * submission a reviewer cannot assess, and `BR-GYM-02`'s approval bar reads the branch. Letting
   * it through would turn a clean refusal now into a rejected application later.
   */
  const others = facts.activeBranches.filter((branch) => branch.id !== facts.branchId);
  if (others.length === 0 && LISTED_STATUSES.includes(facts.gymStatus)) {
    return {
      permitted: false,
      code: 'CONFIG_VALIDATION_FAILED',
      field: 'branch_id',
      reason:
        'this is the only active branch of a listed gym, and a listed gym with no location is ' +
        'not a listing. Close the gym itself rather than its last branch.',
    };
  }

  // 2 · Members who can still check in. Unavailable is a refusal, never a zero.
  if (!facts.affected.ok) {
    return {
      permitted: false,
      code: 'BRANCH_HAS_ACTIVE_MEMBERSHIPS',
      branchId: facts.branchId,
      memberCount: null,
      unavailableReason: facts.affected.reason,
    };
  }
  if (facts.affected.count > 0) {
    return {
      permitted: false,
      code: 'BRANCH_HAS_ACTIVE_MEMBERSHIPS',
      branchId: facts.branchId,
      memberCount: facts.affected.count,
    };
  }

  /*
   * 3 · Permitted — and if this was the primary, the caller must promote in the same transaction.
   *
   * `others` carries `activeInGym`'s ordering, so `others[0]` IS "the next branch": primary first
   * (impossible here, the primary is the one being closed) then oldest first. The branch that
   * opened first is a choice a reviewer can predict and a member would recognise.
   */
  return {
    permitted: true,
    promoteToPrimary: target.isPrimary && others.length > 0 ? (others[0]?.id ?? null) : null,
  };
}
