/**
 * `M-026` · `onboarding/`'s endpoint permissions — `FR-RBAC-01`, `PG-1`.
 *
 * ┌─ DERIVED FROM `§B3.2`, NOT INVENTED ────────────────────────────────────────────────────────┐
 * │ `BLK-10` exists because two admin keys were invented by their module rather than taken from  │
 * │ the matrix, and `PermissionsGuard` correctly refuses them as `UNKNOWN_PERMISSION`. The keys   │
 * │ below are read OUT of `CAPABILITY_MATRIX` by capability label, so a typo fails at import      │
 * │ time and a matrix change moves them automatically.                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { CAPABILITY_MATRIX } from '../iam/permissions.js';

/** The write key for a `§B3.2` row, by its verbatim label. Throws if the row is gone. */
function writeKeyFor(capability: string): string {
  const entry = CAPABILITY_MATRIX.find((row) => row.capability === capability);
  if (entry?.writeKey == null) {
    throw new Error(
      `§B3.2 has no capability "${capability}" with a write key. onboarding/ must not invent one — ` +
        'that is BLK-10, and PermissionsGuard would refuse it as UNKNOWN_PERMISSION.',
    );
  }
  return entry.writeKey;
}

function readKeyFor(capability: string): string {
  const entry = CAPABILITY_MATRIX.find((row) => row.capability === capability);
  if (entry?.readKey == null) {
    throw new Error(`§B3.2 has no capability "${capability}" with a read key.`);
  }
  return entry.readKey;
}

export const ONBOARDING_PERMISSIONS = {
  /** Row 31 — the reviewer reading a tenant's uploaded documents. `BR-DAT-07` audits every read. */
  KYC_DOCUMENT_READ: readKeyFor('Review KYC documents'),
  /** Row 31 — recording that a document was accepted or rejected. */
  KYC_REVIEW_CREATE: writeKeyFor('Review KYC documents'),
  /** Row 32 — the verdict itself. `M-036`'s decision surface declares this. */
  APPLICATION_DECISION_CREATE: writeKeyFor('Approve / reject gym'),
} as const;

/*
 * ┌─ WHAT IS MISSING, NAMED RATHER THAN INVENTED — `BLK-14` ────────────────────────────────────┐
 * │ Both keys above are the REVIEWER's. `§B3.2` defines no capability for the other half of this │
 * │ module: a tenant SUBMITTING or resubmitting its own application. Rows 31 and 32 are held by  │
 * │ `VERIFICATION_OFFICER` and `SUPER_ADMIN`; no row grants a `GYM_OWNER` anything in            │
 * │ `onboarding.*`.                                                                              │
 * │                                                                                              │
 * │ Inventing `onboarding.application.create` here is exactly what produced `BLK-10`, and         │
 * │ `permission-matrix.spec.ts` would catch it the moment it was added to the matrix by hand. The │
 * │ near neighbours are wrong in a dangerous direction too: `catalog.gym_profile.update` is       │
 * │ editing a LIVE listing, which an unapproved applicant must not hold.                          │
 * │                                                                                              │
 * │ So `M-027`'s wizard cannot declare a permission yet, and that is recorded in `PHASES.md`      │
 * │ rather than resolved by a key nobody approved.                                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
