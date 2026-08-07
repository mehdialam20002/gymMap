/**
 * M-020 · The breached-password check — `FR-AUTH-04`. **NO ADAPTER EXISTS.** `BLK-09`.
 *
 * ┌─ THIS PORT IS DELIBERATELY UNIMPLEMENTED, AND THAT IS THE DOCUMENTED PROCEDURE ─────────────┐
 * │ `FR-AUTH-04` is an M-priority rule: *"checked against a breached-password list"*. It is not │
 * │ built, and it cannot be, for three reasons that compound:                                    │
 * │                                                                                              │
 * │ 1. NO APPROVED DEPENDENCY. `Security.md` §0.4 registers the corpus as `A-32`, status         │
 * │    `PROPOSED`. `STACK_ADDITIONS.md` contains A-01…A-30 and no A-31+ row of any status, so   │
 * │    A-32 does not exist in the register at all. `ci:deps-approved` would reject whatever      │
 * │    package an adapter needed, and correctly.                                                 │
 * │                                                                                              │
 * │ 2. TWO DOCUMENTS SPECIFY DIFFERENT MECHANISMS, at the same precedence rank.                  │
 * │      `Security.md` §0.4      a SELF-HOSTED Bloom filter, rebuilt quarterly, queried          │
 * │                              in-process — and it explicitly REJECTS the alternative.         │
 * │      `Authentication.md` §8.3 a third-party k-anonymity range query.                         │
 * │    They differ in whether a new sub-processor exists, whether an outbound call sits on the  │
 * │    registration hot path, and whether `OQ-16` residency is engaged. Not a detail.            │
 * │                                                                                              │
 * │ 3. THE NUMBER ITSELF IS TRIPLE-CLAIMED. `CI_CD.md` L1813 uses `A-32` for artefact signing   │
 * │    and `Monitoring.md` §11.2 for the log store. `Deployment.md` DP-O2 already records the   │
 * │    collision as a register defect for the owner to resolve in Sprint 0.                      │
 * │                                                                                              │
 * │ `Security.md` §0.4 states what to do about exactly this: a `PROPOSED` addition *"may not be │
 * │ used until the project owner approves [it] in STACK_ADDITIONS.md. Until then the affected   │
 * │ requirement is unimplementable and appears in KNOWN_LIMITATIONS.md."* It does — `KL-099`.   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY THE PORT EXISTS ANYWAY ────────────────────────────────────────────────────────────────┐
 * │ The same reasoning as `NotificationChannel` under `A-19` in M-018. Defining the boundary    │
 * │ now means `register-with-password` and `reset-password` are written against an interface,  │
 * │ so the vendor decision — whenever it lands — is one adapter and one provider line, not a    │
 * │ change to every call site that chooses a password.                                           │
 * │                                                                                              │
 * │ What is NOT done: a stub returning `false`. A check that always answers "not breached"      │
 * │ reports success while performing no check, which is worse than an absent control because    │
 * │ the absence stops being visible. `NoBreachCheckConfigured` below is honest instead — it     │
 * │ answers `UNAVAILABLE`, the use case records that the check did not run, and the gap is in   │
 * │ the logs rather than in nobody's head.                                                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

export const BREACHED_PASSWORD_CHECKER = Symbol('BreachedPasswordChecker');

/**
 * Three outcomes, not two.
 *
 * `UNAVAILABLE` is the one that matters. `Milestones_000-029.md` M-020 note requires the check
 * to *"fail open on the check and closed on the log"* — a reputation service being slow must not
 * become a sign-up outage (`CON-02`, `NFR-AVL-*`), but the miss must be recorded. Folding
 * "unavailable" into "not breached" would make that impossible: the two are indistinguishable to
 * the caller, and the metric that would show the check has silently stopped running goes flat at
 * zero instead of spiking.
 */
export type BreachVerdict = 'BREACHED' | 'NOT_BREACHED' | 'UNAVAILABLE';

export interface BreachedPasswordChecker {
  /**
   * Whether this password appears in a known breach corpus.
   *
   * The full password MUST NOT leave the process. Both candidate designs respect that — a
   * local Bloom filter trivially, a k-anonymity range query by sending only a hash prefix — and
   * an adapter that posted the password anywhere would fail review on sight.
   *
   * Never called on LOGIN. `Security.md` §2.4.1: rejecting a login for a password that was fine
   * yesterday locks a member out of their own account with no path forward. Registration,
   * change and reset only.
   */
  check(password: string): Promise<BreachVerdict>;
}

/**
 * The registered implementation until `BLK-09` clears.
 *
 * Answers `UNAVAILABLE` — never `NOT_BREACHED`. The distinction is the entire point: the use
 * case logs a `breach_check_skipped` counter, the gap is measurable, and the day an adapter
 * lands the counter drops to zero and someone can see that it did.
 */
export class NoBreachCheckConfigured implements BreachedPasswordChecker {
  check(): Promise<BreachVerdict> {
    return Promise.resolve('UNAVAILABLE');
  }
}
