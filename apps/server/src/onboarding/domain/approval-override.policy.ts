/**
 * `M-030` `AC-3` · Approving over a flag costs a reason — `E2.5`, `BR-GYM-08`, `BAC-06`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE PRE-CHECKS CANNOT REFUSE, SO THIS IS WHERE THEY GET THEIR WEIGHT
 *
 * `precheck-result.vo.ts` has no rejecting outcome by design: a heuristic that can block a
 * legitimate gym on its own is an availability incident waiting for its first false positive. That
 * decision only holds up if a flag still COSTS something — otherwise "it flags, a human decides"
 * degrades into "it flags, a human clicks Approve", and the six checks become decoration.
 *
 * The cost is one sentence, written down, attached to the decision. Not a checkbox: a checkbox
 * records that somebody clicked, and a reason records what they knew. When `RSK-01` — a fake gym
 * reaching the listings — is investigated a year later, the question is not "was it flagged" but
 * "who decided it was fine, and why", and only one of those two artefacts answers it.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { outstanding, type PrecheckResult } from './precheck-result.vo.js';

/** The shortest thing that can be a reason. Below this it is a keystroke, not an explanation. */
const MINIMUM_REASON_LENGTH = 10;

export type OverrideVerdict =
  | { readonly permitted: true; readonly overrode: readonly string[] }
  | {
      readonly permitted: false;
      readonly refusal: 'REASON_REQUIRED' | 'REASON_TOO_SHORT';
      readonly outstanding: readonly string[];
    };

/**
 * May this approval proceed?
 *
 * @param results  every pre-check result for the version being approved
 * @param reason   the reviewer's stated reason, or `undefined` when they gave none
 *
 * ┌─ A CLEAN APPLICATION NEEDS NO REASON, AND THAT MATTERS ──────────────────────────────────────┐
 * │ Demanding one on every approval would make the field furniture — typed past, filled with     │
 * │ "ok", and worthless on the row where it counts. It is required exactly when something was    │
 * │ outstanding, which is what makes its presence meaningful.                                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function mayApprove(
  results: readonly PrecheckResult[],
  reason: string | undefined,
): OverrideVerdict {
  /*
   * `outstanding()` is everything not PASS — so an ERROR needs a reason too.
   *
   * That is deliberate and it is the case people argue about. An ERROR means the check did not
   * run; approving over it is approving something nobody verified, which is a decision, and a
   * decision with no record is the thing this policy exists to prevent. `AC-8`: "could not be
   * checked" is a different statement from "checked and fine".
   */
  const unresolved = outstanding(results).map((r) => r.check);
  if (unresolved.length === 0) return { permitted: true, overrode: [] };

  const stated = reason?.trim() ?? '';
  if (stated.length === 0) {
    return { permitted: false, refusal: 'REASON_REQUIRED', outstanding: unresolved };
  }
  if (stated.length < MINIMUM_REASON_LENGTH) {
    /*
     * Refused separately from an absent reason, because they are different mistakes.
     *
     * "REASON_REQUIRED" tells a reviewer they missed a field. "REASON_TOO_SHORT" tells them the
     * field will not accept "ok" — which is the one they will actually try, and collapsing the two
     * would send them looking for a field they already filled.
     */
    return { permitted: false, refusal: 'REASON_TOO_SHORT', outstanding: unresolved };
  }

  return { permitted: true, overrode: unresolved };
}

export { MINIMUM_REASON_LENGTH };
