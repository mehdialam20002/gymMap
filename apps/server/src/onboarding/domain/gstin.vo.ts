/**
 * `M-029` `AC-5` · GSTIN, and the PAN buried inside it — `AC-ONB-04.4`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * A GSTIN CONTAINS THE PAN, SO THE TWO DOCUMENTS CAN BE CHECKED AGAINST EACH OTHER
 *
 *     2 7   A A A C P 1 2 3 4 C   1   Z   5
 *     └─┬─┘ └───────┬───────┘   ┌┘   │   └── checksum
 *       │           │           │    └────── literal 'Z'
 *       │           │           └─────────── registration number within the state
 *       │           └─────────────────────── the PAN, characters 3–12
 *       └─────────────────────────────────── state code
 *
 * That embedding is the whole value of this check. Format validation on a GSTIN catches a typo; the
 * cross-check catches a tenant supplying a PAN belonging to one business and a GSTIN belonging to
 * another — two individually valid documents that do not describe the same entity, which is exactly
 * what somebody assembling a fraudulent application has to hand.
 *
 * The state code matters for a second reason `Schema.md` already encodes: `tenants` carries
 * `ck_tenants__state_matches_gstin`, because the state decides CGST+SGST versus IGST. A wrong state
 * is a tax calculation that is wrong on every invoice, silently.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { isWellFormedPan } from './pan.vo.js';

/**
 * Fifteen characters: state, PAN, entity number, `Z`, checksum.
 *
 * The thirteenth character is `[1-9A-Z]` rather than `\d` — a business with more than nine
 * registrations in one state continues into letters, and a digits-only rule would reject a large
 * chain's tenth branch registration with "malformed".
 */
const GSTIN_FORMAT = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** `01`–`38`, plus `97` (other territory) and `99` (centre). Anything else is not a state. */
function isKnownStateCode(code: string): boolean {
  const numeric = Number(code);
  return (numeric >= 1 && numeric <= 38) || numeric === 97 || numeric === 99;
}

export type GstinVerdict =
  | { readonly valid: true; readonly stateCode: string; readonly embeddedPan: string }
  | {
      readonly valid: false;
      readonly reason: 'MALFORMED' | 'UNKNOWN_STATE_CODE' | 'PAN_MISMATCH';
    };

export function isWellFormedGstin(gstin: string): boolean {
  return GSTIN_FORMAT.test(gstin);
}

/** Characters 3–12. `null` when the GSTIN is malformed, because the slice would be meaningless. */
export function embeddedPan(gstin: string): string | null {
  return isWellFormedGstin(gstin) ? gstin.slice(2, 12) : null;
}

export function gstinStateCode(gstin: string): string | null {
  return isWellFormedGstin(gstin) ? gstin.slice(0, 2) : null;
}

/**
 * `AC-5` — format, state code, and the embedded PAN against the supplied one.
 *
 * `pan` is optional because the two documents do not always arrive together: GSTIN is conditional on
 * the registration threshold, and a tenant below it supplies a PAN and no GSTIN at all. When both
 * are present the cross-check is mandatory — that is the case worth having.
 *
 * ┌─ AN ABSENT PAN SKIPS THE CROSS-CHECK, AND THAT IS NOT A HOLE ───────────────────────────────┐
 * │ It would be one if PAN were optional. It is not: `LAUNCH_MARKET_INDIA.md` §6 lists PAN as     │
 * │ ALWAYS required, so by the time a GSTIN is being validated in a real application the PAN is   │
 * │ present and the cross-check runs. Skipping it here means "not yet comparable", never "waved   │
 * │ through" — and the checklist, not this function, is what makes PAN mandatory.                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function validateGstin(gstin: string, pan?: string): GstinVerdict {
  if (!isWellFormedGstin(gstin)) return { valid: false, reason: 'MALFORMED' };

  const stateCode = gstin.slice(0, 2);
  if (!isKnownStateCode(stateCode)) return { valid: false, reason: 'UNKNOWN_STATE_CODE' };

  const embedded = gstin.slice(2, 12);

  if (pan !== undefined) {
    /*
     * The supplied PAN is checked for shape FIRST.
     *
     * Comparing against a malformed PAN would report `PAN_MISMATCH` — telling the tenant their two
     * documents disagree when the truth is that one of them is mistyped, which sends them looking
     * at the wrong form.
     */
    if (!isWellFormedPan(pan)) return { valid: false, reason: 'MALFORMED' };
    if (embedded !== pan) return { valid: false, reason: 'PAN_MISMATCH' };
  }

  return { valid: true, stateCode, embeddedPan: embedded };
}
