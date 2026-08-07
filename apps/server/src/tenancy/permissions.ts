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

export const TENANCY_PERMISSIONS = {
  /** Read the caller's own tenant row. The Sprint-0 exit condition's endpoint. */
  PING_READ: 'tenancy.ping.read',
} as const;

export type TenancyPermission = (typeof TENANCY_PERMISSIONS)[keyof typeof TENANCY_PERMISSIONS];
