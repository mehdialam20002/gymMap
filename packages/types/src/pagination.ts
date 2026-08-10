/**
 * M-003 · Cursor pagination — §C3.1, constitution §14.
 *
 * Cursor-based, not offset-based, and the PRD says so directly: *"Cursor-based: `?limit=&cursor=`;
 * response includes `next_cursor`"*.
 *
 * The reason offset is excluded rather than merely discouraged: `OFFSET 40000` makes Postgres
 * walk and discard forty thousand rows on every request, so the slowest page is the one a
 * crawler hits most; and a row inserted between page 2 and page 3 shifts every subsequent row
 * down by one, so a user paging through search results silently never sees one gym. A cursor
 * anchored on `(sort_key, id)` has neither property.
 */

import type { Brand } from './ids/branded.js';

/**
 * An opaque forward pointer. Base64url over `(sort_key, id)`, minted by the server.
 *
 * Opaque is a contract, not an implementation note: the moment a client parses a cursor, the
 * encoding is frozen and the sort key can never change. Clients echo it back verbatim.
 */
export type Cursor = Brand<string, 'Cursor'>;

/**
 * The fallback default and the ceiling. The ceiling is a denial-of-service control, not a taste.
 *
 * ┌─ THIS COMMENT USED TO READ "§C3.1 default and ceiling", AND §C3.1 STATES NEITHER ────────────┐
 * │ `MASTER_PRD.md` 3432 is the whole rule: *"Cursor-based: `?limit=&cursor=`; response includes  │
 * │ `next_cursor`"*. No number. Both figures below were chosen here and then attributed upward,   │
 * │ which is the shape recorded at `TD-048` and `TD-049` — rank-5 code citing a rank-2 source     │
 * │ that does not say it, and nothing failing because the citation is never checked.               │
 * │                                                                                              │
 * │ The values are unchanged and they are reasonable; only the provenance was wrong. What the     │
 * │ correction buys is the next reader: an API document that names its own default now visibly    │
 * │ OUTRANKS this constant instead of appearing to contradict the PRD. `Gym.md` §12.1 does        │
 * │ exactly that — *"Cursor-paginated, default `limit` 50"* — so `GET /v1/tenant/branches`        │
 * │ defaults to 50 and is not in conflict with anything.                                           │
 * │                                                                                              │
 * │ `clampPageLimit()` therefore takes the route's default as an argument rather than assuming    │
 * │ this one.                                                                                      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

/** The request half: `?limit=&cursor=`. */
export interface PageRequest {
  readonly limit: number;
  readonly cursor?: Cursor;
}

/**
 * The response envelope.
 *
 * `next_cursor` is snake_case because §C3.1 specifies the wire format literally and the signed
 * API contract is not something an internal naming convention gets to overrule.
 *
 * There is deliberately no `total`. A count over a filtered, tenant-scoped, full-text query is
 * a second full scan on every page request; `NFR-PERF-02` (p95 search under 400 ms) does not
 * survive it. Surfaces needing a count get an explicit, separately-cached endpoint.
 */
export interface Page<T> {
  readonly data: readonly T[];
  readonly next_cursor: Cursor | null;
  readonly has_more: boolean;
}

/** `?sort=field:asc|desc` (§C3.1). */
export type SortDirection = 'asc' | 'desc';

export interface SortSpec<TField extends string = string> {
  readonly field: TField;
  readonly direction: SortDirection;
}

/**
 * `fallback` lets a route whose own document names a default use it — see `DEFAULT_PAGE_LIMIT`.
 *
 * It is clamped to `MAX_PAGE_LIMIT` too. A route document may raise its default above 20; it may
 * not raise it past the ceiling, because the ceiling is the control and not the preference.
 */
export function clampPageLimit(
  requested: number | undefined,
  fallback: number = DEFAULT_PAGE_LIMIT,
): number {
  const floor = Math.min(fallback, MAX_PAGE_LIMIT);
  if (requested === undefined || !Number.isFinite(requested)) return floor;
  const rounded = Math.floor(requested);
  if (rounded < 1) return floor;
  return Math.min(rounded, MAX_PAGE_LIMIT);
}
