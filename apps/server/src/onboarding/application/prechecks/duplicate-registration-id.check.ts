/**
 * `M-030` `AC-6` · The same registration number on two tenants — `PE-T2`, M-014.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE ONLY PRE-CHECK THAT CAN ACTUALLY QUERY SOMETHING TODAY
 *
 * `tenants.registration_number` exists, so unlike the address probe (whose tables arrive with
 * M-031) and the bank-account probe (whose table does not exist at all), this one runs for real.
 *
 * ┌─ IT IS A CROSS-TENANT READ, AND THAT IS THE WHOLE POINT ─────────────────────────────────────┐
 * │ The question is "does ANOTHER tenant already claim this registration number", which cannot be │
 * │ asked from inside one tenant's scope. `AC-6` is specific about the consequence: it runs       │
 * │ **only** through `runElevated` with a stated reason, and *"a direct cross-tenant query fails  │
 * │ the isolation suite"*.                                                                         │
 * │                                                                                              │
 * │ `platform-elevation.ts` names the hazard: *"a cross-tenant read is a bug that looks like a    │
 * │ feature — it returns MORE rows than expected, so it never fails a test and never throws."*    │
 * │ The elevation is what makes it visible: every execution writes an audit row naming who asked  │
 * │ and why.                                                                                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { errored, precheck, type PrecheckResult } from '../../domain/precheck-result.vo.js';
import { normaliseRegistrationNumber } from '../../domain/registration-number.normaliser.js';

export interface RegistrationMatch {
  readonly tenantId: string;
  readonly status: string;
}

export type RegistrationProbeOutcome =
  | { readonly ok: true; readonly matches: readonly RegistrationMatch[] }
  | { readonly ok: false; readonly failure: 'UNAVAILABLE'; readonly detail: string };

/**
 * The elevated lookup, as a port.
 *
 * The port takes NO tenant id — §11.5 `BR5` and `gymmap/no-tenant-id-parameter`. The tenant being
 * checked comes from the request context; the tenants being searched are all of them, which is
 * what the elevation authorises.
 */
export interface RegistrationDuplicateProbe {
  findOtherTenantsClaiming(normalised: string): Promise<RegistrationProbeOutcome>;
}

export const REGISTRATION_DUPLICATE_PROBE = Symbol('REGISTRATION_DUPLICATE_PROBE');

export async function runDuplicateRegistrationIdCheck(
  probe: RegistrationDuplicateProbe,
  registrationNumber: string | null,
  ranAt: Date,
): Promise<PrecheckResult> {
  /*
   * An absent registration number is a PASS, and this is the one place in these six checks where
   * "nothing to check" legitimately means "nothing wrong".
   *
   * The field is genuinely optional — a sole proprietor may have no registration number at all, and
   * the KYC checklist governs whether one is required. This check answers "is this number claimed
   * twice", and a number nobody supplied is claimed by nobody. Reporting ERROR here would flood
   * every sole-proprietor application with an unresolvable outstanding item.
   */
  if (registrationNumber === null || registrationNumber.trim().length === 0) {
    return precheck('DUPLICATE_REGISTRATION_ID', 'PASS', { supplied: false }, ranAt);
  }

  const normalised = normaliseRegistrationNumber(registrationNumber);

  let found;
  try {
    found = await probe.findOtherTenantsClaiming(normalised);
  } catch (error) {
    return errored(
      'DUPLICATE_REGISTRATION_ID',
      `the elevated lookup failed: ${error instanceof Error ? error.message : String(error)}`,
      ranAt,
    );
  }

  if (!found.ok) {
    return errored('DUPLICATE_REGISTRATION_ID', `${found.failure} — ${found.detail}`, ranAt);
  }

  /*
   * The evidence names the OTHER tenants' ids and their status, and NOT the registration number.
   *
   * `BR-DAT-06` keeps a business identifier out of a persisted, rendered record — `redaction.ts`
   * lists `gstin` for the same reason, noting it is "personal for a sole proprietor". The reviewer
   * has the number on the application in front of them; the flag only has to say who else has it.
   */
  return precheck(
    'DUPLICATE_REGISTRATION_ID',
    found.matches.length === 0 ? 'PASS' : 'FLAG',
    {
      supplied: true,
      otherTenants: found.matches.map((m) => ({ tenantId: m.tenantId, status: m.status })),
    },
    ranAt,
  );
}
