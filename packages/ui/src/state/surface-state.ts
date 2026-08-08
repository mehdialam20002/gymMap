/**
 * The four mandatory states, as a type — `Components.md` §3, `B6`.
 *
 * ┌─ WHY THIS IS A TYPE AND NOT A PARAGRAPH ────────────────────────────────────────────────────┐
 * │ `B6`: *"States are specified for every screen because the empty, loading, error and          │
 * │ permission-denied cases are where implementations diverge from intent."*                      │
 * │                                                                                              │
 * │ A screen-level requirement stated only in prose gets skipped on screen 41. Expressed as a    │
 * │ discriminated union it cannot be: `StateBoundary` only calls `children` for `ready`, so a    │
 * │ component body has no way to dereference data that has not arrived.                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ FIVE MEMBERS, NOT FOUR, AND THE FIFTH IS THE ONE THAT GETS FORGOTTEN ──────────────────────┐
 * │ `permission-denied` is a RENDERED state with copy and a next step. Not a redirect, not a     │
 * │ blank page (`FR-NAV-06`). A silent bounce to the dashboard is indistinguishable from a bug   │
 * │ to the person it happens to.                                                                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/** Why a surface is empty. The two need different copy and different actions. */
export type EmptyReason = 'no-records' | 'filtered-out' | 'not-started';

/** The `§C3.2` error envelope, as the UI needs it. Shape only — no formatting, per `R3`. */
export interface ApiProblem {
  readonly code: string;
  readonly message: string;
  readonly correlationId?: string;
  readonly status?: number;
}

export type SurfaceState<T = unknown> =
  | { readonly kind: 'loading'; readonly skeleton?: 'auto' | 'rows' | 'cards' | 'stat' }
  /**
   * `isFetching` drives a SUBTLE in-place affordance, never a return to the skeleton. A
   * background refetch that blanks a populated table is a defect, not a loading state.
   */
  | {
      readonly kind: 'ready';
      readonly data: T;
      readonly isFetching: boolean;
      readonly isStale?: boolean;
    }
  | { readonly kind: 'empty'; readonly reason: EmptyReason }
  /**
   * `lastGoodData` is retained where the caller has it. `SCR-WEB-002`: *"last successful results
   * retained where possible"* — a transient failure should not erase what the member was reading.
   */
  | {
      readonly kind: 'error';
      readonly error: ApiProblem;
      readonly canRetry: boolean;
      readonly lastGoodData?: T;
    }
  | {
      readonly kind: 'permission-denied';
      /** The server's permission string. For the support disclosure only, never the message. */
      readonly missingPermission: string;
      readonly contactHintKey: string;
    };

/** What an empty state must supply. Both fields required — see below. */
export interface EmptyStateProps {
  readonly title: string;
  /**
   * `bodyText` and `primaryAction` are both REQUIRED, and that is the point.
   *
   * `§3.4`: a bare "No results" is made impossible by the type. An empty state that does not say
   * why it is empty or what to do next is a dead end dressed as an answer.
   */
  readonly bodyText: string;
  readonly primaryAction:
    | { readonly label: string; readonly onAction: () => void }
    | { readonly label: string; readonly href: string };
}

interface QueryLike<T> {
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly data: T | undefined;
  readonly error: unknown;
}

/**
 * The ONE adapter from TanStack Query. `§3.3`.
 *
 * Every screen uses this, so no screen invents its own mapping — which is how one surface starts
 * treating a 403 as an error and another as an empty list.
 *
 * Typed against a structural `QueryLike` rather than importing `UseQueryResult`: `packages/ui`
 * must not depend on TanStack Query (`R3` — a shared component that fetches cannot be reused
 * across three surfaces with different auth models). The shape is all this needs.
 */
export function toSurfaceState<T>(
  query: QueryLike<T>,
  options: {
    readonly isEmpty: (data: T) => boolean;
    readonly emptyReason?: (data: T) => EmptyReason;
    readonly toProblem: (error: unknown) => ApiProblem;
  },
): SurfaceState<T> {
  if (query.isPending) return { kind: 'loading' };

  if (query.isError) {
    const problem = options.toProblem(query.error);

    // Keyed on 403, NEVER on 404. `README.md` §5.4: another tenant's resource is always a 404,
    // and rendering "you lack permission" for a resource that is simply not in this tenant would
    // confirm that it exists somewhere — which is the leak the 404 was chosen to prevent.
    if (problem.status === 403) {
      return {
        kind: 'permission-denied',
        missingPermission: problem.code,
        contactHintKey: 'common.perm.contact_owner',
      };
    }

    return {
      kind: 'error',
      error: problem,
      // 4xx other than 429 will not succeed on a retry, and offering one trains people to click
      // it twice before reading the message.
      canRetry: problem.status === undefined || problem.status >= 500 || problem.status === 429,
      ...(query.data === undefined ? {} : { lastGoodData: query.data }),
    };
  }

  if (query.data === undefined) return { kind: 'loading' };

  if (options.isEmpty(query.data)) {
    return { kind: 'empty', reason: options.emptyReason?.(query.data) ?? 'no-records' };
  }

  return { kind: 'ready', data: query.data, isFetching: query.isFetching };
}
