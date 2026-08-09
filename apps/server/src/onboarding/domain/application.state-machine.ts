/**
 * `M-028` · The `§C4.4` lifecycle — `FR-ONB-09`, `BR-GYM-01`, `BR-GYM-03`, `RSK-01`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * `§C4.4` IS THE **TENANT** MACHINE, AND THE APPLICATION IS ITS REVIEW-FACING PROJECTION
 *
 * The PRD draws it as:
 *
 *     DRAFT → SUBMITTED → UNDER_REVIEW ──┬──► APPROVED ──► SUSPENDED ⇄ APPROVED
 *                             │          ├──► REJECTED ──► DRAFT (resubmit)
 *                             │          └──► INFO_REQUESTED ──► SUBMITTED
 *                         (assign)              APPROVED ──► CLOSED
 *
 * Eight states, and `tenant_status_enum` holds exactly those eight. `application_status_enum` holds
 * five — no `DRAFT`, no `SUSPENDED`, no `CLOSED` — because an application is a submitted version and
 * those three are things that happen to a BUSINESS, not to a version of its paperwork.
 *
 * (`M-028`'s roadmap entry says "the seven `C4.4` states". There are eight in the PRD diagram and
 * eight in the enum. The roadmap is rank 4; the count is stated here so the next reader does not
 * spend an afternoon looking for a seventh.)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ THE TABLE IS EXHAUSTIVE, WHICH IS WHY IT IS WRITTEN AS ALLOWED-ONLY ───────────────────────┐
 * │ `AC-1` asks for "the full transition table including every illegal transition". Listing the   │
 * │ illegal ones explicitly would be sixty-four rows that must be maintained in lockstep with the │
 * │ eight legal ones, and the maintenance failure is silent in the permissive direction: a new    │
 * │ state added to the enum and forgotten in the denylist is legal from everywhere.               │
 * │                                                                                              │
 * │ Allowed-only inverts that. Anything absent is refused, a new state is unreachable until       │
 * │ somebody names its edges, and the spec's exhaustiveness is met by a TEST that enumerates all  │
 * │ 8 × 8 pairs and asserts each one against the table — which is where "every illegal            │
 * │ transition" belongs, because that is where it can be checked.                                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/** `tenant_status_enum`, in the PRD's order. */
export const LIFECYCLE_STATES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'INFO_REQUESTED',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'CLOSED',
] as const;

export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

/**
 * Who is asking.
 *
 * ┌─ `AC-5` · A TYPE, NOT A FLAG — `RSK-01` ────────────────────────────────────────────────────┐
 * │ `BR-GYM-01` is that no gym is listed before a HUMAN approves it, and `RSK-01` — fake gyms     │
 * │ reaching the marketplace — is the highest-scoring risk in the register. A boolean             │
 * │ `isAutomated` would make the dangerous value the one you get by forgetting the field.         │
 * │                                                                                              │
 * │ A discriminated union makes the automated caller name itself. A job cannot accidentally       │
 * │ present as a human, because it has no `role` to supply and the type will not compile without  │
 * │ one.                                                                                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export type Actor =
  | { readonly kind: 'HUMAN'; readonly userId: string; readonly role: string }
  | { readonly kind: 'SYSTEM'; readonly job: string };

/** `BR-GYM-03` — only these two roles may approve or reject. */
export const REVIEWER_ROLES: ReadonlySet<string> = new Set([
  'VERIFICATION_OFFICER',
  'SUPER_ADMIN',
]);

/**
 * Every legal edge. Anything not listed is refused.
 *
 * `SUSPENDED ⇄ APPROVED` is bidirectional: a suspension is reversible, which is what makes it
 * different from `CLOSED`. `CLOSED` has no outbound edges at all — reopening a closed business is a
 * new tenant, because its verification is stale and `BR-GYM-01` would otherwise be satisfied by an
 * approval nobody re-examined.
 */
const ALLOWED: Readonly<Record<LifecycleState, readonly LifecycleState[]>> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'INFO_REQUESTED'],
  // The applicant supplies what was asked for and it goes back into the queue.
  INFO_REQUESTED: ['SUBMITTED'],
  APPROVED: ['SUSPENDED', 'CLOSED'],
  // `BR-GYM-05` — a rejection is not edited. The tenant returns to DRAFT and submits a new version.
  REJECTED: ['DRAFT'],
  SUSPENDED: ['APPROVED', 'CLOSED'],
  CLOSED: [],
};

/** Transitions only a human reviewer may make — `BR-GYM-03`, `AC-5`. */
const HUMAN_ONLY: ReadonlySet<LifecycleState> = new Set<LifecycleState>([
  'APPROVED',
  'REJECTED',
  'INFO_REQUESTED',
]);

export type TransitionVerdict =
  | { readonly permitted: true }
  | { readonly permitted: false; readonly reason: 'ILLEGAL_TRANSITION' | 'HUMAN_REVIEWER_REQUIRED' };

/**
 * May this actor move the lifecycle from `from` to `to`?
 *
 * The two refusals are distinct on purpose. `ILLEGAL_TRANSITION` is a bug or a stale client;
 * `HUMAN_REVIEWER_REQUIRED` is a correctly-formed request from something that must never be allowed
 * to make it. They page differently, and collapsing them would hide an automated approval attempt
 * among ordinary client errors — which is exactly the event `RSK-01` needs to be loud.
 */
export function canTransition(
  from: LifecycleState,
  to: LifecycleState,
  actor: Actor,
): TransitionVerdict {
  if (!ALLOWED[from].includes(to)) {
    return { permitted: false, reason: 'ILLEGAL_TRANSITION' };
  }

  if (!HUMAN_ONLY.has(to)) return { permitted: true };

  /*
   * `AC-5` · unreachable from any automated code path.
   *
   * Checked in this order deliberately: a SYSTEM actor attempting an approval is refused for being
   * automated, not for holding the wrong role — a job has no role at all, and "role not permitted"
   * would send somebody looking for a grant to add.
   */
  if (actor.kind !== 'HUMAN') {
    return { permitted: false, reason: 'HUMAN_REVIEWER_REQUIRED' };
  }
  if (!REVIEWER_ROLES.has(actor.role)) {
    return { permitted: false, reason: 'HUMAN_REVIEWER_REQUIRED' };
  }

  return { permitted: true };
}

/** The states a lifecycle can never leave. Useful to a caller deciding whether to offer an action. */
export function isTerminal(state: LifecycleState): boolean {
  return ALLOWED[state].length === 0;
}

/** What this actor may do from here. For rendering, never for authorising — `canTransition` decides. */
export function availableTransitions(
  from: LifecycleState,
  actor: Actor,
): readonly LifecycleState[] {
  return ALLOWED[from].filter((to) => canTransition(from, to, actor).permitted);
}
