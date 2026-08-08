/**
 * `admin/`'s permission keys — `§B3.2`, `PG-1`.
 *
 * The `<module>.<resource>.<action>` shape is the one `parsePermissionKey()` in `iam/permissions.ts`
 * expects. These are the strings recorded on the audit row of every elevation this module
 * performs (`PE2`), so they are read by a person six months later and should say what was done.
 */

export const ADMIN_PERMISSIONS = {
  /** `SCR-ADM-001`. Aggregate counts across every tenant. */
  PLATFORM_OVERVIEW_READ: 'admin.platform_overview.read',
  /** `SCR-ADM-004`, `SCR-ADM-002`. The gym register and the approval queue read the same list. */
  GYM_REGISTER_READ: 'admin.gym_register.read',
} as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];
