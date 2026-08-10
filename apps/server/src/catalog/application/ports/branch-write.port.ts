/**
 * `M-031` · The write half of `branches` — `Gym.md` §12.2, §12.3, `FR-GYM-07`.
 *
 * ┌─ SEPARATE FROM `BRANCH_QUERY_PORT`, AND NOT BECAUSE OF CQRS ─────────────────────────────────┐
 * │ `BRANCH_QUERY_PORT` is on `index.ts`: `plans/`, `staff/`, `ordering/` and `attendance/` all    │
 * │ import it to ask whether a branch exists in a gym. If create, update and deactivate lived on   │
 * │ the same interface, every one of those four modules would hold a handle that can WRITE a       │
 * │ branch — and `ModuleDependency.md` gives none of them that right.                              │
 * │                                                                                              │
 * │ An interface is a capability. This one is never exported from `index.ts`, so the only code     │
 * │ that can reach it is inside `catalog/`.                                                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `deactivate` is deliberately here rather than beside the read methods for the same reason, even
 * though `DeactivateBranchUseCase` predates this file.
 */

import type { BranchRow } from '../../infrastructure/branch.mapper.js';

/**
 * Everything `INSERT INTO branches` needs, after the use case has decided the parts it decides.
 *
 * `isPrimary` is on it and is NOT optional: `Gym.md` §12.2 says *"the first branch of a gym is
 * `is_primary` regardless of the request"*, which is a decision the use case makes from the gym's
 * current branch list. Leaving it optional here would let the repository default it and put that
 * rule in two places.
 *
 * `geoToleranceMetres` is nullable because `BR-GYM-08`'s distance check needs a geocoder and none
 * is bound — `KL-114`. Null means "not measured", which is exactly what the column means.
 */
export interface NewBranch {
  readonly gymId: string;
  readonly name: string;
  readonly addressLine1: string;
  readonly addressLine2: string | null;
  readonly cityId: string;
  readonly localityId: string | null;
  readonly state: string;
  readonly stateCode: string;
  readonly postalCode: string;
  readonly countryCode: string;
  readonly location: { readonly lat: number; readonly lng: number };
  readonly capacity: number | null;
  readonly geoToleranceMetres: number | null;
  readonly isPrimary: boolean;
}

/**
 * A patch, with `undefined` meaning "not sent" and `null` meaning "clear it".
 *
 * The distinction is load-bearing on `addressLine2`, `localityId` and `capacity`, all of which are
 * nullable columns: a PATCH that omits `capacity` must leave it alone, and one that sends
 * `capacity: null` must erase it. Collapsing the two would make it impossible to clear a field.
 */
export interface BranchPatch {
  readonly name?: string;
  readonly addressLine1?: string;
  readonly addressLine2?: string | null;
  readonly cityId?: string;
  readonly localityId?: string | null;
  readonly state?: string;
  readonly stateCode?: string;
  readonly postalCode?: string;
  readonly location?: { readonly lat: number; readonly lng: number };
  readonly capacity?: number | null;
}

export interface BranchWritePort {
  /** Inserts and returns the row as it was stored, so the caller renders what the database holds. */
  create(branch: NewBranch): Promise<BranchRow>;

  /**
   * Applies the patch and returns the stored row.
   *
   * `null` when the branch does not exist or is soft-deleted — the same outcome for both, because
   * a caller able to tell them apart can enumerate branch ids across the tenant (`A1`).
   */
  update(branchId: string, patch: BranchPatch): Promise<BranchRow | null>;

  /** Closes a branch, promoting `promoteTo` in the SAME transaction when it is not `null`. */
  deactivate(branchId: string, promoteTo: string | null): Promise<void>;
}

export const BRANCH_WRITE_PORT = Symbol('BRANCH_WRITE_PORT');
