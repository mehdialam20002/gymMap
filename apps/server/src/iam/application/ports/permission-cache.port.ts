/**
 * `M-023` · The permission cache port — `FR-RBAC-04`, `AC-6`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * A ROLE CHANGE REACHES A LIVE SESSION IN 60 SECONDS, AND NOT BY SHORTENING THE TOKEN
 *
 * `AC-6` is specific: *"within 60 seconds without re-authentication, via cache invalidation and
 * not via a shorter token TTL"*. The distinction is the whole design.
 *
 * The tempting fix is to cut `JWT_ACCESS_TTL` from 15 minutes to 60 seconds, and it is wrong twice
 * over. It makes every client refresh fifteen times more often — a token mint, a Redis denylist
 * check and a database round trip each, on the login path, for every user on the platform, to
 * solve a problem that occurs when somebody's role changes. And it does not even work: the token
 * carries the ROLES claim, so a shorter TTL shortens the window and never closes it.
 *
 * Invalidation closes it. The token stays a 15-minute bearer of identity; the permissions it
 * implies are read through this cache, and a role change deletes the entry. The next request —
 * milliseconds later, not sixty seconds — sees the new set.
 *
 * The 60 seconds is therefore a CEILING for the case where invalidation is missed: the TTL below.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ WHY A CACHE AT ALL, WHEN THE MATRIX IS A CONSTANT ─────────────────────────────────────────┐
 * │ `permissionsFor()` reads an in-memory array and needs no cache. What needs one is the         │
 * │ principal's GRANTS — which roles they hold, in which scopes — because those live in           │
 * │ `user_roles` and would otherwise be a database read on every authorised request.              │
 * │                                                                                              │
 * │ Today the grants ride in the token's `roles` claim, so the guard needs no read at all. This   │
 * │ port exists because the moment a role change must propagate WITHOUT re-authentication, the    │
 * │ claim is stale by definition and the grants have to come from somewhere else.                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/**
 * How long a cached grant set may live when nothing invalidates it.
 *
 * 60 seconds, from `AC-6`, and it is a BACKSTOP rather than the mechanism. Explicit invalidation is
 * what makes a role change propagate immediately; this is what bounds the damage if an invalidation
 * is lost — a Redis restart, a partition, a code path that forgot to call it.
 *
 * Shorter would erase the cache's purpose. Longer would let `FR-RBAC-04` be violated by a dropped
 * message rather than by a bug, which is worse because nothing looks broken.
 */
export const PERMISSION_CACHE_TTL_SECONDS = 60;

export const PERMISSION_CACHE = Symbol('PermissionCache');

export interface PermissionCache {
  /** The cached grant claims for a user, or `null` on a miss. */
  read(userId: string): Promise<readonly string[] | null>;

  /** Stores the grant claims under the TTL above. */
  write(userId: string, grants: readonly string[]): Promise<void>;

  /**
   * Drops one user's entry. Called by every path that changes a role — `FR-RBAC-04`.
   *
   * Must not throw on a missing key: invalidating a user who was never cached is the normal case
   * for somebody who has not signed in, and a throw there would fail the role change itself.
   */
  invalidate(userId: string): Promise<void>;
}
