/**
 * `admin/`'s permission keys — `§B3.2`, `PG-1`.
 *
 * The `<module>.<resource>.<action>` shape is the one `parsePermissionKey()` in `iam/permissions.ts`
 * expects. These are the strings recorded on the audit row of every elevation this module
 * performs (`PE2`), so they are read by a person six months later and should say what was done.
 */

/**
 * ┌─ ALL THREE ARE IN THE MATRIX NOW — `BLK-10` CLOSED FOR THIS MODULE ──────────────────────────┐
 * │ Until 2026-08-10 the first two were `BLK-10`: keys this module INVENTED, present in no `§B3.2`│
 * │ row, which `PermissionsGuard` therefore refused as `UNKNOWN_PERMISSION` — deny-by-default     │
 * │ working correctly and telling us the keys had no provenance. The two routes worked around it  │
 * │ by keeping `PlatformRoleGuard` (`TD-034`).                                                    │
 * │                                                                                              │
 * │ `ADR-0047` records the owner's `§C10` amendment: rows 44 *View platform overview* and 45      │
 * │ *View gym register*, each `SUPER_ADMIN ●` and `SUPPORT_AGENT ○`. The keys are no longer       │
 * │ invented — they are what the register now says.                                                │
 * │                                                                                              │
 * │ **`TD-034` is still open**, and for a reason that has nothing to do with these keys:          │
 * │ `PermissionsGuard` is registered NOWHERE (`TD-045`), so `PlatformRoleGuard` is what actually  │
 * │ gates these routes today whatever the matrix says.                                             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export const ADMIN_PERMISSIONS = {
  /** `SCR-ADM-001`. Aggregate counts across every tenant. `§B3.2` row 44. */
  PLATFORM_OVERVIEW_READ: 'admin.platform_overview.read',
  /** `SCR-ADM-004`, `SCR-ADM-002` — the register and the approval queue read one list. Row 45. */
  GYM_REGISTER_READ: 'admin.gym_register.read',
  /**
   * `FR-RBAC-05` · `SCR-ADM-005` · `API_Catalog.md` 1077 — `GET /admin/users/:id/permissions`.
   *
   * An extra READ key on the existing *Manage platform users* row under `ADR-0043`, so it resolves
   * to `SUPER_ADMIN` and to nobody else — which is what `FR-RBAC-05` says in as many words.
   */
  USER_READ_PERMISSIONS: 'admin.user.read_permissions',
} as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];
