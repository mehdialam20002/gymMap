/**
 * `M-030` · Who may see which piece of a pre-check result — `BR-TEN-01`, `BLK-22` constraint 1.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * ONE RESULT, TWO AUDIENCES, AND THE CODE HAD ONLY ONE
 *
 * `duplicate-registration-id.check.ts` and `duplicate-bank-account.check.ts` both return
 *
 *     otherTenants: [{ tenantId, status }]
 *
 * — other tenants' UUIDs and lifecycle status. That object is persisted to
 * `applications.precheck_results`, a column on the SUBMITTING tenant's own RLS row, and
 * `Gym.md` line 1023 puts `precheck_results` in the tenant-facing `202` body.
 *
 * So a gym owner who submits an application would receive a list of other gyms' tenant ids. That is
 * `BR-TEN-01` — invariant 1, *"no tenant can ever read another tenant's data"* — and it is not a
 * conflict between documents. **`Gym.md` already specifies the leak-free shape.** Its own example
 * body carries, for those two checks:
 *
 *     "duplicate_registration":  { "status": "PASS" }
 *     "duplicate_bank_account":  { "status": "PASS" }
 *     "duplicate_address":       { "status": "WARN", "possible_duplicate_gym_count": 1 }
 *
 * Status, and for the address check a COUNT. Never an id. The `otherTenants` array was invented in
 * code, which is the shape `TD-048` and `TD-049` already record twice: rank-5 code inventing a
 * vocabulary a rank-3 document had fixed, and nothing failing because both sides are internally
 * consistent.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ THE EVIDENCE IS NOT DELETED. IT IS ADDRESSED. ──────────────────────────────────────────────┐
 * │ A reviewer needs to know WHICH other tenants hold the same registration number — that is the  │
 * │ entire value of the check, and `Gym.md`'s table marks both as *"reviewer-facing"*. Throwing    │
 * │ the ids away to satisfy the tenant-facing body would make the flag unactionable and turn       │
 * │ `AC-ONB-02.4`'s *"override with a reason"* into a reason nobody can write.                     │
 * │                                                                                              │
 * │ So the result keeps both, and this module is the seam: `forReviewer()` is the whole evidence,  │
 * │ `forTenant()` is what `Gym.md` shows. The projection is a WHITELIST per check, not a           │
 * │ blacklist — a new evidence field is invisible to the tenant until somebody adds it here, which │
 * │ is the direction that fails safe.                                                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import type { PrecheckName, PrecheckResult } from './precheck-result.vo.js';

/**
 * The evidence keys each check may show the SUBMITTING TENANT, transcribed from `Gym.md`.
 *
 * An empty array means status only. That is deliberate for the two cross-tenant checks: their whole
 * evidence is about other tenants, so there is nothing of it a tenant may see.
 *
 * ┌─ A WHITELIST, AND THE DIRECTION MATTERS MORE THAN THE CONTENTS ───────────────────────────────┐
 * │ As a blacklist — *"strip `otherTenants`"* — the next check to carry a cross-tenant field is    │
 * │ shown to the tenant by default, and nothing anywhere fails. As a whitelist, it is withheld by  │
 * │ default and somebody has to decide to reveal it. The two mistakes are not symmetrical: one is  │
 * │ an annoyed reviewer, the other is `BR-TEN-01`.                                                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const TENANT_VISIBLE_EVIDENCE: Readonly<Record<PrecheckName, readonly string[]>> = {
  // `Gym.md` 479: blocking for the owner, and the message must state both numbers.
  GEO_DISTANCE: ['measured_metres', 'tolerance_metres', 'measuredMetres', 'toleranceMetres'],

  /*
   * A COUNT, never the gyms. `Gym.md`'s example body is
   * `{ "status": "WARN", "possible_duplicate_gym_count": 1 }`.
   *
   * The count is a number about other tenants and is still safe: it discloses that somebody else is
   * nearby, which the marketplace's own search page discloses to anybody. An id is not, because it
   * is the handle that makes every other query possible.
   */
  DUPLICATE_ADDRESS: ['possible_duplicate_gym_count', 'possibleDuplicateGymCount'],

  // Status only. Every field of their evidence is about other tenants.
  DUPLICATE_REGISTRATION_ID: [],
  DUPLICATE_BANK_ACCOUNT: [],

  // The owner's own media, and their own copy. Nothing here is about anybody else.
  IMAGE_QUALITY: ['flagged_media_ids', 'flaggedMediaIds', 'checked', 'flagged'],
  /*
   * `PROFANITY` in `PRECHECK_NAMES`; `content_screening` in `Gym.md`'s result keys.
   *
   * A seventh instance of the divergence `TD-048` records, and the smallest: the code's enum and the
   * document's wire key are different words for the same check. Not renamed here — the enum is
   * referenced across the suite and its store, and a rename belongs in the change that reconciles
   * the wire keys as a set rather than in a leak fix. Noted so the next reader is not confused into
   * thinking a seventh check exists.
   */
  PROFANITY: ['flagged_terms', 'flaggedTerms', 'checked', 'flagged'],
};

/**
 * The whole result, for the admin console.
 *
 * Identity, and named rather than left implicit: a reviewer reading `forReviewer` at a call site
 * knows the cross-tenant evidence is intended there, where reading the raw result would leave the
 * next person unsure whether the projection had been forgotten.
 */
export function forReviewer(result: PrecheckResult): PrecheckResult {
  return result;
}

/**
 * The result as the SUBMITTING TENANT may see it — `Gym.md` line 1023's `202` body.
 *
 * `outcome` and `ranAt` always travel: the owner is entitled to know a check ran and what it
 * concluded about their own application. What is withheld is the evidence that is about somebody
 * else.
 */
export function forTenant(result: PrecheckResult): PrecheckResult {
  const allowed = TENANT_VISIBLE_EVIDENCE[result.check];
  const evidence: Record<string, unknown> = {};

  for (const key of allowed) {
    if (key in result.evidence) evidence[key] = result.evidence[key];
  }

  return { ...result, evidence };
}

/** Convenience for a whole suite. The projection is per result; this only maps. */
export function suiteForTenant(results: readonly PrecheckResult[]): readonly PrecheckResult[] {
  return results.map(forTenant);
}

/**
 * Does this result carry anything a tenant must never see?
 *
 * For a test, and for an assertion at the persistence boundary. `precheck_results` is a column on
 * the tenant's own row, so anything written there is reachable by the tenant through any future
 * route that returns the application — and a route added in month twenty will not remember this
 * module exists. The check is cheap and the failure it prevents is invariant 1.
 */
export function carriesCrossTenantEvidence(result: PrecheckResult): boolean {
  const allowed = new Set(TENANT_VISIBLE_EVIDENCE[result.check]);
  return Object.keys(result.evidence).some((key) => !allowed.has(key));
}
