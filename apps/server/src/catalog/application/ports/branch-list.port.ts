/**
 * `M-031` · The paginated branch list — `Gym.md` §12.1.
 *
 * Separate from `BRANCH_QUERY_PORT` for the same reason `BRANCH_WRITE_PORT` is: the query port is
 * on `index.ts` and four other modules hold it. None of them wants a cursor-paginated, filterable,
 * sortable list of the tenant's estate — they ask "does this branch belong to this gym". Widening
 * the exported interface to carry a dashboard's query shape would make every consumer recompile
 * when `SCR-DASH-004` gains a filter.
 */

import type { Cursor, Page } from '@gymmap/types';

import type { BranchRow } from '../../infrastructure/branch.mapper.js';
import type { BranchStatus } from '../../types/catalog.types.js';

/**
 * §12.1's sort allowlist, exactly: *"`name:asc|desc` (default), `created_at:desc`"*.
 *
 * An ALLOWLIST and not a validator, because the value chooses an `ORDER BY`. A rejected string is
 * a 400; an accepted one selects a statement, so the accepted set has to be finite and written
 * down. `created_at:asc` is deliberately absent — the document does not list it, and "obviously it
 * should work too" is how an allowlist becomes a suggestion.
 */
export const BRANCH_SORTS = ['name:asc', 'name:desc', 'created_at:desc'] as const;
export type BranchSort = (typeof BRANCH_SORTS)[number];

/**
 * The query, declared HERE and not beside the use case that builds it.
 *
 * It lived in `list-branches.use-case.ts` for one commit and dependency-cruiser's `no-circular`
 * refused the result: the use case imported the token from this file and this file imported the
 * query type back. A port that cannot be read without its caller is not a port — the dependency
 * has to run one way, and it runs inward.
 */
export interface ListBranchesQuery {
  /** `gym_id` is REPEATABLE — §12.1. Empty means every gym in the tenant. */
  readonly gymIds: readonly string[];
  readonly status?: BranchStatus;
  readonly cityId?: string;
  readonly sort: BranchSort;
  readonly limit: number;
  readonly cursor?: Cursor;
}

export interface BranchListPort {
  /** No tenant id parameter — §11.5 `BR5`. RLS scopes it; the filters narrow inside that scope. */
  list(query: ListBranchesQuery): Promise<Page<BranchRow>>;

  /**
   * One branch in full — `GET /v1/tenant/branches/:id`.
   *
   * §12.2 states why it exists rather than being served from the list: *"list without detail
   * cannot serve `SCR-DASH-004`"*. `null` for absent and for soft-deleted, the same as everywhere
   * else in this module (`A1`).
   */
  byId(branchId: string): Promise<BranchRow | null>;

  /**
   * Which gym owns this branch — for the three routes addressed by branch id alone.
   *
   * `PATCH`, `GET /:id` and `DELETE /:id` are `/v1/tenant/branches/:id` with no gym in the path, so
   * something must resolve one before `findInGym` and the deactivation policy can run.
   *
   * ┌─ THIS IS A READ-THEN-USE, WHICH `findInGym` EXISTS TO AVOID. THE DIFFERENCE IS WHO ASKS. ──┐
   * │ In `findInGym(gymId, branchId)` a CALLER supplies the gym id, so the gym must be in the     │
   * │ `WHERE` — fetching the row and comparing in TypeScript would mean the database handed over  │
   * │ another gym's branch and a faulty comparison leaks it.                                       │
   * │                                                                                            │
   * │ Here nobody supplies anything. The branch's own `gym_id` is being read, inside the tenant   │
   * │ scope RLS has already established, and there is no second party to be wrong about. On the   │
   * │ read side rather than the write side for the same reason: it is a question, not a change.   │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  gymOf(branchId: string): Promise<string | null>;
}

export const BRANCH_LIST_PORT = Symbol('BRANCH_LIST_PORT');
