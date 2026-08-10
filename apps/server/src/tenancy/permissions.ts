/**
 * M-012 · `tenancy/` permissions — FR-RBAC-01, PG-3.
 *
 * `<module>.<resource>.<action>`, three lowercase dot-separated segments, the first being one of
 * the 23 module folders. `api-gates` PG-3 fails a route whose permission is any other shape.
 *
 * Constants rather than string literals at the call site. A typo in a literal produces a
 * permission that matches nothing in the B3.2 matrix — and a permission that matches nothing
 * guards nothing, while looking exactly like one that does.
 */

import { permissionOf } from '../iam/permissions.js';

export const TENANCY_PERMISSIONS = {
  /**
   * Read the caller's own tenant row. The Sprint-0 exit condition's endpoint.
   *
   * NOT a `§B3.2` row and deliberately so — it is a DIAGNOSTIC, not a capability. It is admitted
   * through `SCOPED_NON_MATRIX_PERMISSIONS`, which lets it past the matrix lookup and still runs
   * the tenant scope check: it returns tenant data, so any principal pinging any tenant would be
   * `BR-TEN-01`.
   */
  PING_READ: 'tenancy.ping.read',
  /**
   * `POST /v1/tenants` — wizard step 1, `§B3.2` row 46 (`ADR-0049`).
   *
   * Held by `USER`, `MEMBER` and `GYM_OWNER`. The caller owns nothing yet, which is why the row's
   * holders are not just `GYM_OWNER`: `Gym.md` §2.1 calls this *"(pre-tenant; the caller is a
   * `USER`)"*, and `BR-TEN-02` — *"one owner account may own multiple tenants"* — is why an
   * existing owner holds it too.
   */
  TENANT_CREATE: permissionOf('Create own tenant', 'tenancy.tenant.create'),
} as const;

export type TenancyPermission = (typeof TENANCY_PERMISSIONS)[keyof typeof TENANCY_PERMISSIONS];
