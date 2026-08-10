/**
 * `M-031` · How many members can still check in at this branch — `NFR-USE-06`, `BR-MEM-14`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE PORT EXISTS NOW BECAUSE `memberships` ARRIVES IN SPRINT 7
 *
 * `Gym.md` §12.4 is unambiguous about what a deactivation refusal has to say: *"`NFR-USE-06`
 * requires **the real count**: '1,247 members can currently check in at Koregaon Park. Move them
 * to another branch or let their memberships expire before closing it.' A vague 'cannot delete'
 * fails review. The count is computed inside the transaction from live membership entitlements,
 * not from a cached figure."*
 *
 * `memberships` does not exist. The temptation is to omit the port and add it later — and later
 * is five sprints away, by which time the confirmation has shipped saying nothing and `NFR-USE-06`
 * has been quietly broken the whole time. The port is wired now so that Sprint 7 binds an adapter
 * rather than rediscovering a requirement.
 *
 * ┌─ AND THE STAND-IN ANSWERS `UNAVAILABLE`, NOT `0` ────────────────────────────────────────────┐
 * │ `0` is a NUMBER. It states, as a fact, that deactivating this branch strands nobody — and     │
 * │ that statement would be made by something that cannot count. It is the same coercion `AC-8`   │
 * │ names on the pre-check side, and it is worse here, because the whole point of the count is    │
 * │ to stop an owner closing a branch that members are still using.                                │
 * │                                                                                              │
 * │ Today nothing is stranded either way: there are no memberships to strand. The day `memberships`│
 * │ ships, a `0`-returning adapter would keep saying "nobody affected" while the table filled up, │
 * │ and nothing about adding a table makes anyone re-read this file. `UNAVAILABLE` makes that day │
 * │ a visible refusal instead.                                                                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type AffectedMembershipCount =
  | { readonly ok: true; readonly count: number }
  /**
   * The count could not be established. NOT "the count is zero".
   *
   * `reason` is operator-facing and never reaches a client: `BR-DAT-06` keeps internal state off
   * the wire, and an owner told "the membership service is unavailable" learns nothing they can act
   * on beyond what the refusal already says.
   */
  | { readonly ok: false; readonly reason: string };

export interface AffectedMembershipsPort {
  /**
   * Members who can still check in at this branch, right now.
   *
   * No tenant id parameter — §11.5 `BR5`. `Gym.md` requires this to run inside the deactivation
   * transaction, so the caller opens it and the adapter joins that transaction through the same
   * tenant-scoped client rather than opening a second one.
   */
  countForBranch(branchId: string): Promise<AffectedMembershipCount>;
}

export const AFFECTED_MEMBERSHIPS_PORT = Symbol('AFFECTED_MEMBERSHIPS_PORT');
