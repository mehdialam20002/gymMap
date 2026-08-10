/**
 * `M-031` · `catalog/`'s endpoint permissions — `FR-RBAC-01`, `PG-1`, `PG-7`.
 *
 * ┌─ THIS FILE COULD NOT EXIST UNTIL 2026-08-10, AND THE REASON IS WORTH KEEPING ────────────────┐
 * │ `BLK-19` held it for weeks. `API_Catalog.md` 940–944 freezes five strings for the five branch │
 * │ routes; the matrix's row 20 carried two, one of which — `catalog.branch.write` — appears on   │
 * │ no route at all. Writing this file with the catalogue's five would have meant inventing four  │
 * │ keys the rank-2 register did not contain, which is precisely `BLK-10`.                        │
 * │                                                                                              │
 * │ `ADR-0047` settled it: §5.6's column header is **"Permission string(s)"**, plural, so five    │
 * │ keys from one row is the documented shape rather than a conflict — and the owner amended      │
 * │ row 20 under `§C10` so the holders match what `SCR-DASH-004` needs.                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ EVERY KEY NAMES ITS ROW, AND `permissionOf()` REFUSES A MISMATCH ───────────────────────────┐
 * │ `onboarding/permissions.ts` reads keys out of the matrix by label, which catches an invented │
 * │ key. `permissionOf()` goes one further: naming the row AND the string means attributing a    │
 * │ real key to the WRONG row also throws — and that is the failure `ADR-0043` calls capability  │
 * │ shopping, because it resolves cleanly and grants that row's holders instead of the ones the  │
 * │ requirement names.                                                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { permissionOf } from '../iam/permissions.js';

/** `§B3.2` row 20 — verbatim, because `permissionOf()` matches the label exactly. */
const BRANCH = 'Add / remove branch';
/** `§B3.2` row 19. `Gym.md` 171 puts a branch EDIT here — see that row's header for why. */
const PROFILE = 'Edit gym profile';

export const CATALOG_PERMISSIONS = {
  /**
   * `GET /v1/tenant/branches`. Held at `○` by `RECEPTIONIST`, `TRAINER` and `GYM_MANAGER` since
   * `ADR-0047`, and at `●` by `GYM_OWNER` and `SUPER_ADMIN`.
   */
  BRANCH_LIST: permissionOf(BRANCH, 'catalog.branch.list'),
  /** `GET /v1/tenant/branches/:id`. Same holders as the list. */
  BRANCH_READ: permissionOf(BRANCH, 'catalog.branch.read'),

  /*
   * The three below are WRITE keys, and the distinction is the whole point of row 20's `○` cells.
   * `permissionsFor()` emits a capability's write keys only for a grant that is not `READ`, so the
   * three branch-scoped roles reach the two keys above and none of the three below. A receptionist
   * can see that Powai exists and cannot close it.
   */
  /** `POST /v1/tenant/branches`. */
  BRANCH_CREATE: permissionOf(BRANCH, 'catalog.branch.create'),
  /** `PATCH /v1/tenant/branches/:id`. */
  BRANCH_UPDATE: permissionOf(PROFILE, 'catalog.branch.update'),
  /**
   * `DELETE /v1/tenant/branches/:id` — a deactivation, never a row deletion.
   *
   * The key says `deactivate` rather than `delete` because that is what the route does:
   * `branch-deactivation.policy.ts` refuses the last active branch and refuses one with active
   * memberships, and what succeeds sets a status. A key named `.delete` would describe a
   * capability this module does not have and should never acquire.
   */
  BRANCH_DEACTIVATE: permissionOf(BRANCH, 'catalog.branch.deactivate'),
} as const;

export type CatalogPermission = (typeof CATALOG_PERMISSIONS)[keyof typeof CATALOG_PERMISSIONS];

/*
 * ┌─ THE FIVE KEYS SIT ON TWO ROWS, WHICH IS WHAT `Gym.md` ACTUALLY SAYS ────────────────────────┐
 * │     GET  /tenant/branches      row 20   `.list`         OWNER ● MGR ○ RCP ○ TRN ○            │
 * │     GET  /tenant/branches/:id  row 20   `.read`         same                                  │
 * │     POST /tenant/branches      row 20   `.create`       OWNER ● S.ADMIN ● only                │
 * │     DELETE …/:id               row 20   `.deactivate`   OWNER ● S.ADMIN ● only                │
 * │     PATCH …/:id                row 19   `.update`       OWNER ● MGR ▪ — `Gym.md` line 171     │
 * │                                                                                              │
 * │ I first put all five on row 20, to keep `SUPPORT ○` and `VERIFICATION_OFFICER ○` on row 19    │
 * │ from acquiring a branch key. The fear was right about the READ half and wrong about this one: │
 * │ `permissionsFor()` emits write keys only for a grant that is not `READ`, so a `○` cell can    │
 * │ never reach `.update`. Putting it on row 19 reproduces `Gym.md` exactly — a manager may edit  │
 * │ a branch, and may not open or close one — and needed no `§C10` change, because rank 2 had     │
 * │ already given `GYM_MANAGER ▪` there.                                                           │
 * │                                                                                              │
 * │ Editing a branch's address or capacity is profile maintenance. Opening and closing one is a   │
 * │ different act with a different holder set, and the two row labels say so.                      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS STILL ABSENT FROM THIS MODULE, NAMED RATHER THAN INVENTED ──────────────────────────┐
 * │ `catalog/` owns six tables at full scope and three exist. The gym-profile routes             │
 * │ (`M-032`) will need `catalog.gym_profile.read` / `.update` — row 19 — and the media routes   │
 * │ (`M-033`) will need keys row 19 does not carry. Both are `BLK-10`-family questions that have  │
 * │ not been asked yet, and neither is answered by pointing at a neighbouring row.                │
 * │                                                                                              │
 * │ `PermissionsGuard` IS bound as of `c9c851e`, so a route declaring one of these is enforced at   │
 * │ request time as well as by `PG-1` at build time. `TD-045`'s remaining half is `MfaGuard`,      │
 * │ `ResourceTenantGuard` and `ImpersonationRestrictionGuard`, none of which gates these keys.     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
