/**
 * `M-023` · The permission cache, on Redis — `FR-RBAC-04`, `AC-6`.
 *
 * ┌─ THIS CACHE FAILS CLOSED, WHICH IS THE OPPOSITE OF THE DENYLIST ────────────────────────────┐
 * │ `AC-10`'s family denylist fails OPEN: if Redis is unreachable it lets the request through,     │
 * │ because the alternative is that a Redis outage signs every user on the platform out.           │
 * │                                                                                              │
 * │ This one is the other way round, and the asymmetry is deliberate. A denylist answers "has this │
 * │ been revoked" — a miss is the common case and failing open costs a narrow window on an already │
 * │ rare event. A permission cache answers "what may this person do" — failing open would mean     │
 * │ SERVING A STALE GRANT SET, and the grant set is stale precisely when somebody's access was     │
 * │ just reduced. So a read error here returns `null`, a miss, and the caller falls back to the    │
 * │ authoritative source.                                                                          │
 * │                                                                                              │
 * │ "Fails closed" therefore means "falls back to the truth", not "denies". Denying on a Redis     │
 * │ blip would be an outage; reading the database instead is a slow request.                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ A WRITE FAILURE IS SWALLOWED, AN INVALIDATE FAILURE IS NOT ─────────────────────────────────┐
 * │ Failing to POPULATE the cache costs a database read. Failing to CLEAR it means a revoked       │
 * │ permission stays live for up to the TTL — which is the one thing `FR-RBAC-04` is about. So     │
 * │ `invalidate()` lets the error propagate and the role change fails loudly, rather than          │
 * │ reporting success while leaving the old access in place.                                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '../../common/persistence/redis.provider.js';
import {
  PERMISSION_CACHE_TTL_SECONDS,
  type PermissionCache,
} from '../application/ports/permission-cache.port.js';

/**
 * `auth:grants:{userId}`.
 *
 * Namespaced under `auth:` beside `auth:revoked-family:` so one `SCAN` finds everything the
 * identity subsystem holds, which is what an incident needs and what a `FLUSHDB` must never be
 * reached for.
 */
const key = (userId: string) => `auth:grants:${userId}`;

@Injectable()
export class RedisPermissionCache implements PermissionCache {
  private readonly logger = new Logger(RedisPermissionCache.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async read(userId: string): Promise<readonly string[] | null> {
    try {
      const raw = await this.redis.get(key(userId));
      if (raw === null) return null;

      const parsed: unknown = JSON.parse(raw);
      // A stored value that is not an array of strings is corruption, not a cache hit. Treated as a
      // miss so the request is answered from the authoritative source rather than from whatever
      // shape happened to be in the key.
      if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string')) {
        this.logger.warn(`grants cache for ${userId} held an unexpected shape; treating as a miss`);
        return null;
      }

      return parsed as readonly string[];
    } catch (error) {
      // A miss, not a denial. See the header.
      this.logger.warn(
        `grants cache read failed for ${userId}; falling back to the authoritative source: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async write(userId: string, grants: readonly string[]): Promise<void> {
    try {
      await this.redis.set(key(userId), JSON.stringify(grants), 'EX', PERMISSION_CACHE_TTL_SECONDS);
    } catch (error) {
      // Swallowed: failing to populate costs a database read on the next request and nothing else.
      this.logger.warn(
        `grants cache write failed for ${userId}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async invalidate(userId: string): Promise<void> {
    // NOT swallowed. A lost invalidation leaves a revoked permission live for up to the TTL, which
    // is the single thing `FR-RBAC-04` exists to prevent — so the role change fails loudly instead
    // of reporting success over stale access.
    //
    // `del` on a missing key returns 0 and does not throw, so a user who has never signed in is the
    // normal case rather than an error.
    await this.redis.del(key(userId));
  }
}
