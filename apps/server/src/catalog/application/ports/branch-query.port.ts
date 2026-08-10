/**
 * `M-031` · `BRANCH_QUERY_PORT` — does this branch exist, and does it belong to this gym.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * BOTH HALVES OF THE QUESTION, IN ONE ANSWER — `catalog/README.md` §4, edge 23
 *
 * Four modules take a branch id from a request body: `plans/` (which branches a plan is sold at),
 * `staff/` (which branches a member of staff is assigned to), `ordering/` and `attendance/`. Every
 * one of them needs to know the branch is real AND that it is the right gym's.
 *
 * A port that answered only "exists" would be used correctly four times and incorrectly the fifth,
 * and the failure is quiet: a plan sold at another gym's branch inside the same tenant passes every
 * RLS policy, because RLS is about tenants and this is about gyms. So the two questions are one
 * call and the gym id is not optional.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { BranchIdentity } from '../../types/catalog.types.js';

export type BranchLookupOutcome =
  | { readonly ok: true; readonly branch: BranchIdentity }
  /**
   * Not found, not visible, or not this gym's — one outcome for all three.
   *
   * `A1`: a cross-tenant id must be indistinguishable from a nonexistent one. Splitting this into
   * `NOT_FOUND` and `WRONG_GYM` would let a caller enumerate which branch ids exist in a sibling
   * gym by watching which answer comes back.
   */
  | { readonly ok: false; readonly reason: 'UNKNOWN_BRANCH' };

export interface BranchQueryPort {
  /** No tenant id parameter — §11.5 `BR5`. The tenant is the context; RLS is the enforcement. */
  findInGym(gymId: string, branchId: string): Promise<BranchLookupOutcome>;

  /**
   * Every ACTIVE branch of a gym, primary first.
   *
   * Ordering is part of the contract rather than a convenience: `Gym.md` §12.4 requires
   * deactivating a primary branch to *"promote the next branch in the same transaction"*, and a
   * caller cannot implement "the next branch" against an unordered list.
   */
  activeInGym(gymId: string): Promise<readonly BranchIdentity[]>;
}

export const BRANCH_QUERY_PORT = Symbol('BRANCH_QUERY_PORT');
