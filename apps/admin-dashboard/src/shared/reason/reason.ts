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
 * Twenty characters, matching the server's floor and `BR-DAT-02`'s for impersonation.
 *
 * "admin", "fix" and "checking" are not reasons. The audit row exists so an administrative
 * action can be JUDGED later, and it cannot be judged from a placeholder. The bar is deliberately
 * high enough to be annoying, because the alternative is an audit log full of the word "test".
 */
export const REASON_MIN_LENGTH = 20;

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
