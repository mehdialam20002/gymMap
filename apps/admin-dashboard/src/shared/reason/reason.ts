/**
 * `FR-ADMN-02` — every administrative write states a reason. `FolderStructure.md` §6.
 *
 * ┌─ THE TYPE IS THE ENFORCEMENT, NOT THE CONVENTION ───────────────────────────────────────────┐
 * │ §6's admin-only structural rule: "every mutation hook takes a `reason` argument typed as a   │
 * │ non-empty branded `Reason` string. A default `reason = ''` is a review rejection."           │
 * │                                                                                              │
 * │ A branded type is what makes that mechanical. `approve(id, '')` does not compile, because    │
 * │ `''` is a `string` and the parameter wants a `Reason` — and the only way to obtain one is    │
 * │ `reason(text)`, which validates. The rule stops depending on a reviewer noticing.            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The same shape as `runElevated()`'s `NonEmptyReason` on the server (M-014), and deliberately so:
 * the client-side check exists to give the operator an error at the keyboard rather than after a
 * round trip. It is NOT the enforcement — the server re-validates, because anything a client
 * checks a client can skip.
 */

declare const reasonBrand: unique symbol;

/** A reason that is provably not a placeholder. Produced only by `reason()`. */
export type Reason = string & { readonly [reasonBrand]: 'Reason' };

/**
 * TEN characters after trimming - the general floor, and it is the SERVER's.
 *
 * "admin", "fix" and "checking" are not reasons. The audit row exists so an administrative action
 * can be JUDGED later, and it cannot be judged from a placeholder.
 *
 * +- THIS WAS 20, AND 20 WAS A NUMBER NOTHING DOCUMENTED -------------------------------------+
 * | `Admin.md` RS3: "Minimum length **10 characters after trimming**. `"ok"`, `"."` and `"   "` |
 * | are refused." `AdminDashboard.md` RD2 mirrors it: "Client-side minimum is 10 characters     |
 * | after trimming, matching RS3. The console trims before counting, exactly as the server      |
 * | does, so the counter and the server agree."                                                |
 * |                                                                                          |
 * | The old comment said 20 "matching the server's floor", and the server's floor is 10. A      |
 * | stricter client opens no hole, but it refuses a legitimate twelve-character reason the API   |
 * | would have accepted, and RD2's whole point is that the counter and the server agree - a      |
 * | client that disagrees teaches an operator to distrust the counter.                          |
 * |                                                                                          |
 * | The HIGHER floors are real and are per-action, not global. See `REASON_FLOOR` below.        |
 * +-------------------------------------------------------------------------------------------+
 */
export const REASON_MIN_LENGTH = 10;

/**
 * The per-action floors of `RD4`, which are the only places above the general minimum.
 *
 * Named rather than written at the call site, because `RD4` states them as a closed list and a
 * literal `20` in a component is a number the next person cannot trace to a rule.
 */
export const REASON_FLOOR = {
  /** `RD2` / `RS3`. Every admin mutation, unless one of the below applies. */
  general: REASON_MIN_LENGTH,
  /** `RD4` - overriding a BLOCKING pre-check on `SCR-ADM-003` (6.3.7). */
  precheckOverride: 20,
  /** `RD4` and `BR-DAT-02` - acting as another user on `SCR-ADM-005` (6.5.4). */
  impersonation: 20,
  /** `RD4` - resolving a reconciliation variance on `SCR-ADM-010` (6.10.5). */
  reconciliationVariance: 50,
} as const;

export class ReasonTooShortError extends Error {
  // An explicit field, not a `constructor(readonly actualLength: number)` parameter property.
  // Node 22's native type stripping refuses parameter properties — they EMIT code rather than
  // being erasable — and this file is imported directly as `.ts` by `node --test`.
  readonly actualLength: number;

  constructor(actualLength: number) {
    super(
      `An administrative action needs a reason of at least ${REASON_MIN_LENGTH} characters; ` +
        `received ${actualLength}. Somebody will read this in six months and has to be able to ` +
        `tell a legitimate action from an abusive one (FR-ADMN-02).`,
    );
    this.name = 'ReasonTooShortError';
    this.actualLength = actualLength;
  }
}

export function reason(raw: string): Reason {
  const trimmed = raw.trim();
  if (trimmed.length < REASON_MIN_LENGTH) throw new ReasonTooShortError(trimmed.length);
  return trimmed as Reason;
}

/** Non-throwing, for live form validation. Returns why it is invalid, or `null`. */
export function reasonProblem(raw: string): 'EMPTY' | 'TOO_SHORT' | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return 'EMPTY';
  if (trimmed.length < REASON_MIN_LENGTH) return 'TOO_SHORT';
  return null;
}
