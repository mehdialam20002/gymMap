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
  /**
   * `FR-RBAC-05` · `SCR-ADM-005` · `API_Catalog.md` 1077 — `GET /admin/users/:id/permissions`.
   *
   * **Unlike the two above, this one is in the matrix.** They are `BLK-10`: keys this module
   * invented, which `PermissionsGuard` therefore refuses as `UNKNOWN_PERMISSION`, and which the two
   * routes work around by keeping `PlatformRoleGuard` (`TD-034`). This key joins the existing
   * *Manage platform users* row as an extra READ key under `ADR-0043`, so it resolves — to
   * `SUPER_ADMIN` and to nobody else, which is what `FR-RBAC-05` says.
   */
  USER_READ_PERMISSIONS: 'admin.user.read_permissions',
} as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];
