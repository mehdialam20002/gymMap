/**
 * `M-031` · `GET /v1/tenant/branches` — `Gym.md` §12.1, `FR-GYM-07`, `BR-TEN-03`.
 *
 * ┌─ THE CURSOR IS ANCHORED ON `(sort_key, id)`, AND `id` IS NOT DECORATION ─────────────────────┐
 * │ `packages/types/src/pagination.ts` states the rule: *"A cursor anchored on `(sort_key, id)`"*.│
 * │ The default sort here is `name:asc`, and branch names are not unique — a gym with two         │
 * │ "Andheri" branches is ordinary, and a chain with "Gym" in twenty cities is more so.            │
 * │                                                                                              │
 * │ On a non-unique sort key alone, `WHERE name > $last` skips every row sharing the boundary     │
 * │ name and `>=` returns them forever. The tie-break on `id` makes the ordering total, so the    │
 * │ keyset predicate is exact: `(name, id) > ($lastName, $lastId)`.                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ TWO FIELDS §12.1 REQUIRES ON EVERY ROW ARE ABSENT, AND THEY ARE NOT THE SAME KIND OF ABSENT ┐
 * │ *"Each row carries … `active_membership_count` and `hours_summary`."*                          │
 * │                                                                                              │
 * │ `active_membership_count` — `memberships` ships at `M-046`. It is omitted rather than sent as │
 * │ `0`, for the reason `AffectedMembershipsUnavailableAdapter` spells out: a zero is a claim.     │
 * │ An absent key is a client that renders nothing; a `0` is a dashboard confidently showing every │
 * │ branch as empty. **`KL-113`.**                                                                 │
 * │                                                                                              │
 * │ `hours_summary` — `branch_hours` does not exist and `PUT …/:id/hours` is §12.5, a different   │
 * │ route on a different permission (`catalog.branch_hours.update`) belonging to `M-034`.          │
 * │ **`KL-119`.**                                                                                  │
 * │                                                                                              │
 * │ And the one that is a security gap rather than a missing field: *"a branch-scoped caller       │
 * │ receives only assigned branches, with `scope.branch_ids` echoed"*. There is no staff-to-branch │
 * │ assignment table until `M-037`, so today every caller who holds `catalog.branch.list` sees     │
 * │ every branch in the tenant. `ADR-0047` gave `RECEPTIONIST` and `TRAINER` that key. **`KL-116`.**│
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Injectable, Inject } from '@nestjs/common';

import { clampPageLimit, type Cursor, type Page } from '@gymmap/types';

import {
  BRANCH_LIST_PORT,
  BRANCH_SORTS,
  type BranchListPort,
  type BranchSort,
  type ListBranchesQuery,
} from './ports/branch-list.port.js';
import type { BranchRow } from '../infrastructure/branch.mapper.js';
import { BRANCH_STATUSES, type BranchStatus } from '../types/catalog.types.js';

/** §12.1's default. `Gym.md` is rank 3 and names it; `DEFAULT_PAGE_LIMIT` (20) does not apply. */
export const BRANCH_LIST_DEFAULT_LIMIT = 50;

export type { BranchSort, ListBranchesQuery };

export function isBranchSort(value: string): value is BranchSort {
  return (BRANCH_SORTS as readonly string[]).includes(value);
}

export function isBranchStatus(value: string): value is BranchStatus {
  return (BRANCH_STATUSES as readonly string[]).includes(value);
}

/**
 * Normalises whatever arrived on the query string into the shape the port takes.
 *
 * In the use case rather than the controller because the DEFAULTS are `Gym.md`'s — the limit of 50
 * and the sort of `name:asc` are contract, and a controller that spelled them itself would be a
 * second copy of the document.
 */
export function toListQuery(raw: {
  gym_id?: string | readonly string[];
  status?: string;
  city_id?: string;
  sort?: string;
  limit?: string;
  cursor?: string;
}): ListBranchesQuery {
  const gymIds = raw.gym_id === undefined ? [] : [raw.gym_id].flat();

  /*
   * The optional three are spread in CONDITIONALLY, not assigned `undefined`.
   *
   * `exactOptionalPropertyTypes` is on, so `{ status: undefined }` and `{}` are different types —
   * and the distinction earns its keep here: `status?: BranchStatus` promises that the key, when
   * present, is a real filter. Widening it to `BranchStatus | undefined` would let a caller pass
   * an explicit `undefined` and make the repository's `?? null` the only thing standing between a
   * typo and an unfiltered query.
   */
  return {
    gymIds,
    // An unrecognised status is dropped rather than 400'd: a filter is a narrowing, and the two
    // legal values are already enforced at the edge by the route's Zod schema. This is the
    // defence-in-depth copy, and its safe behaviour is "filter by nothing".
    ...(raw.status !== undefined && isBranchStatus(raw.status) ? { status: raw.status } : {}),
    ...(raw.city_id !== undefined ? { cityId: raw.city_id } : {}),
    ...(raw.cursor !== undefined ? { cursor: raw.cursor as Cursor } : {}),
    sort: raw.sort !== undefined && isBranchSort(raw.sort) ? raw.sort : 'name:asc',
    limit: clampPageLimit(
      raw.limit === undefined ? undefined : Number(raw.limit),
      BRANCH_LIST_DEFAULT_LIMIT,
    ),
  };
}

@Injectable()
export class ListBranchesUseCase {
  constructor(@Inject(BRANCH_LIST_PORT) private readonly branches: BranchListPort) {}

  /**
   * No gym-existence check, and that is not an oversight.
   *
   * A `gym_id` filter naming a gym in another tenant returns an empty page, because RLS never lets
   * the row into the result — which is the right answer and the same answer as "that gym has no
   * branches". Resolving the gym first to return a 404 would tell the caller which gym ids exist
   * elsewhere, one request at a time, on a route whose filter is repeatable.
   */
  execute(query: ListBranchesQuery): Promise<Page<BranchRow>> {
    return this.branches.list(query);
  }

  /**
   * `GET /v1/tenant/branches/:id` — §12.2, *"list without detail cannot serve `SCR-DASH-004`"*.
   *
   * On the list use case rather than in one of its own, because there is no decision to make: the
   * row is read and rendered. A use case whose `execute` is a single delegation is a file that
   * exists to satisfy a naming convention.
   */
  byId(branchId: string): Promise<BranchRow | null> {
    return this.branches.byId(branchId);
  }

  /** Resolves the owning gym for the three routes addressed by branch id alone. */
  gymOf(branchId: string): Promise<string | null> {
    return this.branches.gymOf(branchId);
  }
}
