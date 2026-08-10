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
  BRANCH_UPDATE: permissionOf(BRANCH, 'catalog.branch.update'),
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
 * ┌─ ONE DIVERGENCE FROM `Gym.md`, TAKEN DELIBERATELY AND RECORDED HERE ─────────────────────────┐
 * │ `Gym.md` 167-172 attributes these five strings PER ROUTE, and not all to row 20:              │
 * │                                                                                              │
 * │     GET  /tenant/branches      -> "Edit gym profile (read half)"   OWNER ● MGR ▪ RCP ▪ TRN ▪  │
 * │     POST /tenant/branches      -> "Add / remove branch"            OWNER ● and nobody else    │
 * │     PATCH /tenant/branches/:id -> "Edit gym profile"               OWNER ● MGR ▪              │
 * │     DELETE …/:id               -> "Add / remove branch"            OWNER ● and nobody else    │
 * │                                                                                              │
 * │ Followed literally, `.list`, `.read` and `.update` belong to **row 19**, *Edit gym profile*.  │
 * │ Row 19 holds `SUPPORT ○` and `VERIFICATION_OFFICER ○` — two PLATFORM roles — and              │
 * │ `permissionsFor()` emits a row's read keys to every non-`NONE` grant. Attributing the branch  │
 * │ list there hands it to both, on a route `API_Catalog.md` tags `BR-TEN-03`. That is escalation │
 * │ (4) of the four an adversarial pass found in the refused `BLK-19` draft, arrived at from the  │
 * │ other direction.                                                                               │
 * │                                                                                              │
 * │ So all five sit on row 20, whose holders are tenant-side only. **The cost is real and is not  │
 * │ hidden:** `GYM_MANAGER` is `○` there, so it can list and read a branch and CANNOT update one, │
 * │ where `Gym.md` line 171 gives it `▪`. The owner's `ADR-0047` answer settled who sees the      │
 * │ LIST; it did not reach manager updates, and widening a write is not inferable from it.         │
 * │                                                                                              │
 * │ Resolving it properly needs either a `§C10` cell on row 20 for `GYM_MANAGER`, or the          │
 * │ scope/module clause `BLK-19` says any future attribution needs. Recorded, not guessed.         │
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
