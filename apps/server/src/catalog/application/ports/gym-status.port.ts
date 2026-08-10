/**
 * `M-031` · `GYM_STATUS_PORT` — what state is this gym in, and is it visible to me at all.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * TWO CALLERS WANT DIFFERENT ANSWERS FROM THE SAME COLUMN, AND ONLY ONE PORT SHOULD ASK
 *
 * `catalog/README.md` §4 names this port for `ordering/`: *"Is this gym suspended — an order
 * against a suspended gym must fail **before** payment (edge 15, `BR-GYM-01`)."* That is a
 * yes/no question, and a port shaped as `isSuspended(): boolean` would answer it perfectly.
 *
 * It would also be useless to this module's own deactivation path, which needs the STATUS:
 * `mayDeactivate()` takes `DeactivationFacts.gymStatus`, and `PENDING_REVIEW` counts as listed
 * where `DRAFT` does not. A boolean cannot express that, so the second caller would add a second
 * port over the same column and the two would eventually disagree about what "suspended" means.
 *
 * So this returns the status and each caller asks its own question of it. `isBlockedForOrdering()`
 * below is `ordering/`'s question, written once here rather than four times at call sites.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { GymStatus } from '../../types/catalog.types.js';

export type GymStatusOutcome =
  | { readonly ok: true; readonly status: GymStatus }
  /**
   * The gym does not exist, or is not visible in the caller's tenant scope.
   *
   * One outcome for both, exactly as `BRANCH_QUERY_PORT` and `GYM_TIMEZONE_PORT` do it (`A1`).
   * Splitting them lets a caller enumerate which gym ids exist in a sibling tenant by watching
   * which refusal comes back — and the enumeration costs nothing, because ids are in URLs.
   */
  | { readonly ok: false; readonly reason: 'UNKNOWN_GYM' };

export interface GymStatusPort {
  /** No tenant id parameter — §11.5 `BR5`. The tenant is the context; RLS is the enforcement. */
  statusOf(gymId: string): Promise<GymStatusOutcome>;
}

export const GYM_STATUS_PORT = Symbol('GYM_STATUS_PORT');

/**
 * `ordering/`'s question — `BR-GYM-01`, edge 15.
 *
 * ┌─ WHY THE PREDICATE LIVES HERE AND NOT AT THE CALL SITE ──────────────────────────────────────┐
 * │ The tempting form in `ordering/` is `status === 'SUSPENDED'`. It is wrong the day a status is │
 * │ added, and wrong quietly: a gym in the new state keeps selling memberships because nobody     │
 * │ remembered the comparison existed. `DRAFT`, `PENDING_REVIEW` and `REJECTED` are all already   │
 * │ states in which a gym must not take an order, and none of them equals `SUSPENDED`.            │
 * │                                                                                              │
 * │ So the rule is written as an ALLOW-LIST of one. Adding a status makes it blocked by default,  │
 * │ and letting a new state sell requires naming it here, in a file whose subject is that         │
 * │ decision. `BR-GYM-01` — *verification before visibility* — points the same way: the safe      │
 * │ default for an unrecognised state is "not yet".                                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function isBlockedForOrdering(status: GymStatus): boolean {
  return status !== 'APPROVED';
}
