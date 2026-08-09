/**
 * `M-030` `AC-6` `AC-8` · The same payout account on two tenants — `PE-T2`, `BR-PAY-08`, M-014.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE FRAUD THIS CHECK IS FOR, AND WHY IT CANNOT RUN YET
 *
 * `BR-GYM-09`'s failure-mode note names the real hazard for the whole duplicate family: *"lets a
 * suspended tenant re-list the same premises under a new entity, defeating `BR-TEN-05`"*. A bank
 * account is the hardest of the three identifiers to change — premises can be re-described and a
 * registration number can be re-issued, but the money has to land somewhere, and it usually lands
 * in the same account. So this is the check with the most signal in it.
 *
 * ┌─ AND THERE IS NO TABLE FOR IT ───────────────────────────────────────────────────────────────┐
 * │ `payout_accounts` is `EP-05`, and the wizard step that collects one — step 5 — is in the       │
 * │ roadmap's own *"deliberately does not cover"* table, destination `Milestones_030-059.md`. So   │
 * │ at M-030 an application carries no bank account at all, and there is nothing to compare        │
 * │ against even if it did. `KL-109`.                                                               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ SO IT ANSWERS IN TWO DIFFERENT WAYS, AND THE DIFFERENCE IS THE POINT ───────────────────────┐
 * │ NO ACCOUNT SUPPLIED  → `PASS`, `{ supplied: false }`. Nothing was claimed, so nothing is       │
 * │                        claimed twice. This is the same reasoning that makes an absent          │
 * │                        registration number a `PASS`, and it is true rather than convenient.    │
 * │                                                                                                │
 * │ AN ACCOUNT SUPPLIED  → `ERROR` naming the missing store. The moment step 5 ships, every        │
 * │   AND NO PROBE BOUND   application starts carrying an account this cannot check, and a `PASS`  │
 * │                        would then be a lie told once per application. `AC-8`: *"the reviewer   │
 * │                        sees 'could not be checked', which is a different statement from        │
 * │                        'checked and fine'"*.                                                    │
 * │                                                                                                │
 * │ That second branch is dead code today, on purpose. It is the branch that stops this check from │
 * │ silently passing the day its input arrives — which is exactly the failure that would otherwise │
 * │ ship unnoticed, because nothing about adding a wizard step makes anyone re-read this file.     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { errored, precheck, type PrecheckResult } from '../../domain/precheck-result.vo.js';

export interface BankAccountMatch {
  readonly tenantId: string;
  readonly status: string;
}

export type BankAccountProbeOutcome =
  | { readonly ok: true; readonly matches: readonly BankAccountMatch[] }
  | { readonly ok: false; readonly failure: 'UNAVAILABLE'; readonly detail: string };

/**
 * The elevated lookup, as a port — no tenant id parameter (§11.5 `BR5`).
 *
 * ┌─ THE FINGERPRINT IS A HASH, AND `BR-PAY-08` IS WHY ──────────────────────────────────────────┐
 * │ *"Card/bank credentials are never stored, logged or transmitted."* An account number cannot    │
 * │ cross this port, cannot sit in a query the database logs, and cannot appear in the evidence    │
 * │ the flag persists.                                                                              │
 * │                                                                                                │
 * │ Equality is all the check needs, and a keyed hash gives equality without the value. The        │
 * │ caller computes it; this module never sees the digits. Deriving the fingerprint is `EP-05`'s   │
 * │ job, along with the table — the port only fixes the shape so it cannot arrive as plaintext.    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export interface BankAccountDuplicateProbe {
  findOtherTenantsUsing(fingerprint: string): Promise<BankAccountProbeOutcome>;
}

export const BANK_ACCOUNT_DUPLICATE_PROBE = Symbol('BANK_ACCOUNT_DUPLICATE_PROBE');

export interface DuplicateBankAccountInput {
  /**
   * The keyed hash of the payout account, or `null` when the application carries none.
   *
   * `null` is the only value this can hold at M-030, because nothing collects a payout account yet.
   */
  readonly fingerprint: string | null;
  /** Absent until `EP-05` binds one. Absent WITH a fingerprint present is the `ERROR` branch. */
  readonly probe?: BankAccountDuplicateProbe;
}

export async function runDuplicateBankAccountCheck(
  input: DuplicateBankAccountInput,
  ranAt: Date,
): Promise<PrecheckResult> {
  if (input.fingerprint === null || input.fingerprint.length === 0) {
    return precheck('DUPLICATE_BANK_ACCOUNT', 'PASS', { supplied: false }, ranAt);
  }

  if (input.probe === undefined) {
    return errored(
      'DUPLICATE_BANK_ACCOUNT',
      'a payout account was supplied but payout_accounts does not exist yet (EP-05, KL-109), ' +
        'so no cross-tenant comparison was made',
      ranAt,
    );
  }

  let found;
  try {
    found = await input.probe.findOtherTenantsUsing(input.fingerprint);
  } catch (error) {
    return errored(
      'DUPLICATE_BANK_ACCOUNT',
      `the elevated lookup failed: ${error instanceof Error ? error.message : String(error)}`,
      ranAt,
    );
  }

  if (!found.ok) {
    return errored('DUPLICATE_BANK_ACCOUNT', `${found.failure} — ${found.detail}`, ranAt);
  }

  /*
   * The evidence names the other tenants and nothing else. Not the fingerprint, which is a stable
   * identifier for a bank account and would let anyone with read access on `precheck_results`
   * correlate accounts across tenants — the linkage `BR-PAY-08` exists to prevent, reconstructed
   * from the audit trail of the control that was supposed to protect it.
   */
  return precheck(
    'DUPLICATE_BANK_ACCOUNT',
    found.matches.length === 0 ? 'PASS' : 'FLAG',
    {
      supplied: true,
      otherTenants: found.matches.map((m) => ({ tenantId: m.tenantId, status: m.status })),
    },
    ranAt,
  );
}
