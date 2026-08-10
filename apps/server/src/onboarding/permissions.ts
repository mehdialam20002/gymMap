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

import { CAPABILITY_MATRIX, permissionOf } from '../iam/permissions.js';

/** `§B3.2` row 43, added 2026-08-10 by the owner under Part C §C10 — `ADR-0047`. Verbatim label. */
const OWN_APPLICATION = 'Submit own gym application';

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

  // ─── the TENANT's own half, row 43, added by `ADR-0047` — see the note below ──────────────────
  /** `GET /v1/tenant/applications/:id`. The owner reading its own application back. */
  OWN_APPLICATION_READ: permissionOf(OWN_APPLICATION, 'onboarding.application.read'),
  /** `POST /v1/tenant/applications`. Submission, which freezes the version (`FR-ONB-08`). */
  OWN_APPLICATION_SUBMIT: permissionOf(OWN_APPLICATION, 'onboarding.application.submit'),
  /** `GET /v1/tenant/kyc-documents`. The owner's own attachments — metadata, never content. */
  OWN_KYC_DOCUMENT_LIST: permissionOf(OWN_APPLICATION, 'onboarding.kyc_document.list'),
  /** `POST /v1/tenant/kyc-documents`. */
  OWN_KYC_DOCUMENT_UPLOAD: permissionOf(OWN_APPLICATION, 'onboarding.kyc_document.upload'),
  /** `DELETE /v1/tenant/kyc-documents/:id`. Removable while a draft; frozen after submission. */
  OWN_KYC_DOCUMENT_DELETE: permissionOf(OWN_APPLICATION, 'onboarding.kyc_document.delete'),
} as const;

/*
 * ┌─ `BLK-14` IS CLOSED, AND THIS NOTE IS KEPT BECAUSE THE REASONING STILL APPLIES ──────────────┐
 * │ Until 2026-08-10 the only keys here were the REVIEWER's. `§B3.2` defined no capability for   │
 * │ the other half of this module — a tenant submitting its own application — so `M-027`'s wizard│
 * │ could declare nothing, and this file said so instead of inventing `onboarding.application    │
 * │ .create`. Inventing it is exactly what produced `BLK-10`.                                     │
 * │                                                                                              │
 * │ `ADR-0047` records the owner's `§C10` amendment: row 43, *Submit own gym application*,        │
 * │ `GYM_OWNER ●` and eleven `—`. The five strings were already frozen in `API_Catalog.md` §3.9,  │
 * │ so nothing was invented then either — the register caught up with the catalogue.               │
 * │                                                                                              │
 * │ **`SUPER_ADMIN` is `—` on row 43 and that is not an oversight.** A platform actor who can     │
 * │ author an application can approve an artefact it wrote, and `BR-GYM-03`'s human approval      │
 * │ stops being falsifiable. It holds rows 31 and 32 — the reviewing half — which is the point.   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS STILL MISSING, NAMED RATHER THAN INVENTED ──────────────────────────────────────────┐
 * │ Six reviewer-side strings in `API_Catalog.md` 1061–1066 — `onboarding.application.list_all`,  │
 * │ `.review`, `.approve`, `.reject`, `.request_info`, `.assign` — have no counterpart in any     │
 * │ matrix row; row 32's write key is `onboarding.application_decision.create`. That is           │
 * │ `BLK-10`'s family, it is untouched by `ADR-0047`, and it blocks `M-036`'s reviewer console.    │
 * │                                                                                              │
 * │ And wizard step 1 has its own hole: `POST /tenants` declares `tenancy.tenant.create`, which   │
 * │ is in no row either. `Gym.md` §2.1 row 1's capability cell reads *"(pre-tenant; the caller is │
 * │ a `USER`)"*. So row 43 unblocks the steps AFTER the tenant exists, not the one that makes it. │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
