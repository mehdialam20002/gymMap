/**
 * `M-030` `AC-2` · A pre-check flags. It cannot reject — `FR-ONB-12`, `AC-ONB-02.3`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE PROHIBITION IS THE TYPE, NOT A REVIEW NOTE
 *
 * `AC-2`: *"A pre-check never auto-rejects. It flags; the `PrecheckOutcome` type has no rejecting
 * member, so the prohibition is structural rather than procedural."*
 *
 * There is no `REJECT` below and there must never be one. The reason is in the milestone's own
 * notes: a false duplicate-address positive blocks a legitimate gym, and a fraud control that can
 * refuse on its own turns into an availability incident the first time its heuristic is wrong. Six
 * automated checks screen; a human decides.
 *
 * ┌─ `ERROR` IS NOT A KIND OF `PASS`, AND THAT IS THE OTHER HALF ────────────────────────────────┐
 * │ `AC-8`: a geocoder outage yields `ERROR` with the reason recorded, *"never a `PASS` and never  │
 * │ a blocked submission; the reviewer sees 'could not be checked', which is a different statement │
 * │ from 'checked and fine'."*                                                                     │
 * │                                                                                              │
 * │ An `ERROR` coerced to `PASS` is worse than having no check at all: it tells a reviewer that   │
 * │ something was verified when nothing was, and they approve faster because of it. So `ERROR` is │
 * │ its own member, `isClear()` is false for it, and nothing in this file lets the two collapse.  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** The six checks of `FR-ONB-12`. A seventh is a deliberate edit here and in the runner. */
export const PRECHECK_NAMES = [
  'GEO_DISTANCE',
  'DUPLICATE_ADDRESS',
  'DUPLICATE_REGISTRATION_ID',
  'DUPLICATE_BANK_ACCOUNT',
  'IMAGE_QUALITY',
  'PROFANITY',
] as const;

export type PrecheckName = (typeof PRECHECK_NAMES)[number];

/**
 * Three outcomes. There is no fourth, and in particular there is no rejecting one.
 *
 *   `PASS`   checked, and nothing to raise
 *   `FLAG`   checked, and a human should look. Approval over it needs a recorded reason
 *   `ERROR`  NOT checked. Says nothing about the application, only about the checker
 */
export type PrecheckOutcome = 'PASS' | 'FLAG' | 'ERROR';

export interface PrecheckResult {
  readonly check: PrecheckName;
  readonly outcome: PrecheckOutcome;
  /**
   * What the check saw, in a form a reviewer can act on.
   *
   * Free-form per check — a distance in metres, the id of a colliding gym, the term that matched.
   * `BR-DAT-06` still applies: this is persisted on `applications.precheck_results` and read by
   * the console, so it names fields and never carries a personal identifier's VALUE.
   */
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly ranAt: string;
}

/**
 * Whether this result leaves nothing for a human to resolve.
 *
 * ┌─ A FUNCTION RATHER THAN `outcome === 'PASS'` AT EACH CALL SITE ──────────────────────────────┐
 * │ Written out at four call sites, one of them eventually reads `!== 'FLAG'` — and that one     │
 * │ treats every `ERROR` as clear, which is exactly the coercion `AC-8` forbids. One function,   │
 * │ one place to be wrong, and a test pinning it.                                                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function isClear(result: PrecheckResult): boolean {
  return result.outcome === 'PASS';
}

/** The checks a reviewer must account for before approving: everything not `PASS`. */
export function outstanding(results: readonly PrecheckResult[]): readonly PrecheckResult[] {
  return results.filter((r) => !isClear(r));
}

/**
 * A completed check.
 *
 * `ranAt` is supplied rather than read from the clock here — `gymmap/no-bare-date` forbids
 * `new Date()` in the domain, and a result whose timestamp came from an injected clock is a result
 * a test can pin.
 */
export function precheck(
  check: PrecheckName,
  outcome: PrecheckOutcome,
  evidence: Readonly<Record<string, unknown>>,
  ranAt: Date,
): PrecheckResult {
  return { check, outcome, evidence, ranAt: ranAt.toISOString() };
}

/**
 * The result to record when a check could not run.
 *
 * A named constructor rather than leaving each check to build its own: the one thing that must
 * never happen is a checker swallowing its own failure and reporting `PASS`, and a caller reaching
 * for `errored(...)` in a `catch` is easier than a caller remembering not to.
 */
export function errored(check: PrecheckName, reason: string, ranAt: Date): PrecheckResult {
  return precheck(check, 'ERROR', { reason }, ranAt);
}
