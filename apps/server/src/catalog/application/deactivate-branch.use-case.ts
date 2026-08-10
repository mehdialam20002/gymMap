/**
 * `M-031` · `DELETE /v1/tenant/branches/:id` — `Gym.md` §12.4, `FR-GYM-07`, `AC-4`.
 *
 * ┌─ THIS USE CASE DECIDES NOTHING. IT GATHERS FACTS AND OBEYS A POLICY. ────────────────────────┐
 * │ `mayDeactivate()` holds every rule — last active branch, active memberships, whether the      │
 * │ count could be established at all — and it is a pure function with eleven tests. Re-deriving  │
 * │ any of that here would give the system two answers to the same question, and the one that     │
 * │ ships would be whichever the request happened to reach.                                        │
 * │                                                                                              │
 * │ So the shape is: read four facts, hand them over, translate the verdict into an outcome the   │
 * │ controller can render. The ORDER of the reads is the only judgement in the file, and it is    │
 * │ explained where it happens.                                                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ A DEACTIVATION, NEVER A DELETE ─────────────────────────────────────────────────────────────┐
 * │ `Gym.md` §12.4: *"A soft deactivation (`branches.status → 'INACTIVE'`, `deleted_at` set),     │
 * │ never a hard delete: a branch is named by every historical attendance row and every invoice."* │
 * │ The permission is `catalog.branch.deactivate` for the same reason — a key called `.delete`     │
 * │ would describe a capability this module does not have and should never acquire.                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable } from '@nestjs/common';

import {
  AFFECTED_MEMBERSHIPS_PORT,
  type AffectedMembershipsPort,
} from './ports/affected-memberships.port.js';
import { BRANCH_QUERY_PORT, type BranchQueryPort } from './ports/branch-query.port.js';
import { GYM_STATUS_PORT, type GymStatusPort } from './ports/gym-status.port.js';
import { type DeactivationVerdict, mayDeactivate } from '../domain/branch-deactivation.policy.js';

export interface DeactivateBranchCommand {
  readonly gymId: string;
  readonly branchId: string;
}

/**
 * What the controller renders.
 *
 * `UNKNOWN_BRANCH` and `UNKNOWN_GYM` are separate here and become the SAME 404 at the edge. They
 * are distinct in this type because an operator reading a log needs to know which lookup missed;
 * they collapse at the boundary because a caller who could tell them apart could enumerate.
 */
export type DeactivateBranchOutcome =
  | { readonly ok: true; readonly promotedToPrimary: string | null }
  | { readonly ok: false; readonly reason: 'UNKNOWN_GYM' }
  | { readonly ok: false; readonly reason: 'UNKNOWN_BRANCH' }
  | { readonly ok: false; readonly reason: 'REFUSED'; readonly verdict: DeactivationVerdict };

@Injectable()
export class DeactivateBranchUseCase {
  constructor(
    @Inject(GYM_STATUS_PORT) private readonly gyms: GymStatusPort,
    @Inject(BRANCH_QUERY_PORT) private readonly branches: BranchQueryPort,
    @Inject(AFFECTED_MEMBERSHIPS_PORT) private readonly memberships: AffectedMembershipsPort,
  ) {}

  async execute(command: DeactivateBranchCommand): Promise<DeactivateBranchOutcome> {
    const { gymId, branchId } = command;

    /*
     * ┌─ THE READ ORDER IS THE ONE DECISION HERE, AND IT IS ABOUT WHAT LEAKS ────────────────────┐
     * │ Existence FIRST — gym, then branch-in-gym — and only then the two facts the policy needs. │
     * │                                                                                          │
     * │ Reversed, a caller passing another gym's branch id would trigger a membership count       │
     * │ against a branch they cannot see. The count is cheap to do and impossible to un-do: it    │
     * │ touches rows in a scope the caller has no business reaching, and on a busy branch the     │
     * │ TIMING alone answers "does this id exist" without any response body saying so.             │
     * │                                                                                          │
     * │ `findInGym` answers both halves at once — real, and this gym's — which is the whole       │
     * │ reason that port takes a gym id rather than being a plain lookup.                          │
     * └──────────────────────────────────────────────────────────────────────────────────────────┘
     */
    const gym = await this.gyms.statusOf(gymId);
    if (!gym.ok) return { ok: false, reason: 'UNKNOWN_GYM' };

    const found = await this.branches.findInGym(gymId, branchId);
    if (!found.ok) return { ok: false, reason: 'UNKNOWN_BRANCH' };

    /*
     * Both remaining reads happen even when the first would settle it, because the POLICY decides
     * which rule bites and in what order — `mayDeactivate()` checks last-branch before membership
     * count deliberately, so that closing the only branch of an empty gym gives the last-branch
     * reason rather than a misleading "no members affected".
     *
     * Short-circuiting here would move that ordering decision out of the tested pure function and
     * into an untested `if`, which is exactly the duplication this file's header refuses.
     */
    const activeBranches = await this.branches.activeInGym(gymId);
    const affected = await this.memberships.countForBranch(branchId);

    const verdict = mayDeactivate({
      gymStatus: gym.status,
      activeBranches,
      branchId,
      affected,
    });

    if (!verdict.permitted) return { ok: false, reason: 'REFUSED', verdict };

    /*
     * `promoteToPrimary` travels OUT of the use case rather than being applied here.
     *
     * `Gym.md` §12.4 requires the promotion to happen in the SAME transaction as the
     * deactivation, and this use case opens none — the repository does, because
     * `uq_branches__one_primary_per_gym` is a partial unique index and two statements outside one
     * transaction can leave a gym with two primaries or none. The policy names the branch; the
     * repository does both writes together or neither.
     */
    return { ok: true, promotedToPrimary: verdict.promoteToPrimary };
  }
}
