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

/** §C3.1 default and ceiling. The ceiling is a denial-of-service control, not a preference. */
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

export function clampPageLimit(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested)) return DEFAULT_PAGE_LIMIT;
  const floored = Math.floor(requested);
  if (floored < 1) return DEFAULT_PAGE_LIMIT;
  return Math.min(floored, MAX_PAGE_LIMIT);
}
