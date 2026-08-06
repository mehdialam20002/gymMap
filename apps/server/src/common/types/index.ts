/**
 * `common/types` — FolderStructure.md §8.1 row 17.
 *
 * Types with no runtime and no owner elsewhere. Anything that belongs to a bounded context
 * belongs in that module's `types/`, not here — `common/types` is for the vocabulary of the
 * mechanisms themselves.
 */

/** A request-scoped correlation id. ULID, echoed in every log line and every error envelope. */
export type CorrelationId = string;

/** Result of a readiness probe for one dependency (`/readyz`, NFR-AVL-03). */
export interface DependencyHealth {
  readonly name: string;
  readonly healthy: boolean;
  readonly detail?: string;
}
