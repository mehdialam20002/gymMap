/**
 * M-022 `AC-10` · Revocation that reaches an already-issued access token.
 *
 * ┌─ IN `common/auth/`, NOT IN `iam/`, AND THE DIRECTION IS THE REASON ─────────────────────────┐
 * │ `JwtAuthGuard` consults this on every authenticated request, and the guard is `common/`.    │
 * │ Putting the denylist in `iam/` would make the shared kernel depend on a feature module —    │
 * │ the one edge the whole layering exists to prevent, and `no-circular` would catch it the     │
 * │ moment `iam/` imported anything from `common/`, which it does everywhere.                    │
 * │                                                                                              │
 * │ `iam/` writes to it and `common/` reads it. That is the correct direction for a control the │
 * │ kernel enforces on behalf of a module.                                                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WITHOUT THIS, "REVOKED" MEANS "THE NEXT REFRESH FAILS" ────────────────────────────────────┐
 * │ An access token is self-contained: the guard verifies a signature and looks nothing up,     │
 * │ which is the whole reason it is fast enough to run on every request. It is also why         │
 * │ revoking a session does nothing to the tokens already in the wild — they keep verifying for │
 * │ the rest of their fifteen minutes.                                                           │
 * │                                                                                              │
 * │ So a detected token thief, whose family we have just revoked, stays authenticated for up to │
 * │ a quarter of an hour after detection. `AC-10` says that is not revocation.                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ A DENYLIST AND NOT AN ALLOWLIST, AND THE TTL IS WHY IT STAYS SMALL ────────────────────────┐
 * │ An allowlist of live sessions is a Redis lookup per request against a set the size of the   │
 * │ active user base, and a Redis outage would log everyone out — failing CLOSED on the         │
 * │ authentication path, which is an outage of the whole product.                                │
 * │                                                                                              │
 * │ A denylist holds only families revoked in the last fifteen minutes. It is small by           │
 * │ construction: the TTL equals the access-token lifetime, because after that the token has    │
 * │ expired on its own and the entry has nothing left to deny.                                   │
 * │                                                                                              │
 * │ It fails OPEN on a Redis outage, and that is a deliberate, bounded trade: for at most the   │
 * │ remaining TTL of an already-issued token, a revoked session keeps working. The alternative  │
 * │ is every member of the platform being signed out because a cache restarted.                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '../persistence/redis.provider.js';
import { FAMILY_DENYLIST_TTL_SECONDS } from './token-lifetimes.js';

@Injectable()
export class FamilyDenylist {
  private readonly logger = new Logger(FamilyDenylist.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** Denies every access token carrying this family, for the rest of their lifetime. */
  async revoke(familyId: string): Promise<void> {
    await this.redis.set(this.key(familyId), '1', 'EX', FAMILY_DENYLIST_TTL_SECONDS);
  }

  /**
   * Whether this family is denied. Called on every authenticated request.
   *
   * Returns FALSE on a Redis failure — fails open. See the header: the alternative is that a
   * cache restart signs out the entire platform, and the exposure here is bounded by the
   * access-token TTL rather than unbounded.
   *
   * The failure is logged at WARN so it is visible; a silent catch would make a permanently
   * broken denylist indistinguishable from an empty one.
   */
  async isRevoked(familyId: string): Promise<boolean> {
    try {
      return (await this.redis.exists(this.key(familyId))) === 1;
    } catch (error) {
      this.logger.warn({
        message: 'family denylist unreachable — failing OPEN for the access-token TTL',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return false;
    }
  }

  private key(familyId: string): string {
    return `auth:revoked-family:${familyId}`;
  }
}
