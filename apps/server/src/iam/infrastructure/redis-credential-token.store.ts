/**
 * M-020 · The Redis credential-token store — ADR-0034, `NFR-SEC-07`.
 *
 * ┌─ TWO KEYS PER TOKEN, AND THE SECOND ONE IS WHY ─────────────────────────────────────────────┐
 * │ The obvious design is one key: `iam:reset:{sha256} → userId`, TTL as the expiry. It gives   │
 * │ atomic single-use for free (`GETDEL`) and needs no sweep.                                    │
 * │                                                                                              │
 * │ It cannot satisfy `revokeAll`. A member who clicks "forgot password" three times has three  │
 * │ live links; when the first is used the other two must die, and there is no way to find them │
 * │ from the user id — the key is derived from the token, and the token is not stored anywhere  │
 * │ we can enumerate. `SCAN` over a keyspace is not an answer on a hot path.                     │
 * │                                                                                              │
 * │ So each issue also adds the digest to `iam:reset:user:{userId}`, a SET with its own TTL.    │
 * │ `revokeAll` reads that set and deletes every digest in one pipeline.                         │
 * │                                                                                              │
 * │ Leaving `revokeAll` out was the alternative, and it is a real hole: the reset window would   │
 * │ stay open for the full thirty minutes AFTER the password had already been changed, so an     │
 * │ attacker holding a second intercepted link could change it straight back.                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE INDEX SET IS A HINT, NOT A SOURCE OF TRUTH ────────────────────────────────────────────┐
 * │ The digest keys expire on their own. The set may therefore hold digests whose keys are      │
 * │ already gone — deleting those is a no-op, which is exactly the behaviour wanted. The set     │
 * │ never being authoritative is what keeps the two from having to be kept consistent.           │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

import { APP_CONFIG, type AppConfig } from '../../common/config/app-config.schema.js';
import { CLOCK, type Clock } from '../../common/clock/clock.port.js';
import { REDIS_CLIENT } from '../../common/persistence/redis.provider.js';
import type {
  CredentialTokenPurpose,
  CredentialTokenStore,
  IssuedToken,
} from '../application/ports/credential-token-store.port.js';

/** 256 bits. `Security.md` treats this as beyond brute force, which is why SHA-256 suffices. */
const TOKEN_BYTES = 32;

const NAMESPACE: Record<CredentialTokenPurpose, string> = {
  EMAIL_VERIFICATION: 'iam:verify',
  PASSWORD_RESET: 'iam:reset',
};

/** SHA-256, lowercase hex. The stored form; the token itself never reaches Redis. */
export function digestOf(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

@Injectable()
export class RedisCredentialTokenStore implements CredentialTokenStore {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async issue(purpose: CredentialTokenPurpose, userId: string): Promise<IssuedToken> {
    const token = randomBytes(TOKEN_BYTES).toString('hex');
    const digest = digestOf(token);
    const ttlSeconds = this.ttlSecondsFor(purpose);

    // One round trip. A partial write — the digest key set but the index entry missing — would
    // leave a token that works and cannot be revoked, which is the one outcome worth avoiding.
    await this.redis
      .multi()
      .set(this.tokenKey(purpose, digest), userId, 'EX', ttlSeconds)
      .sadd(this.indexKey(purpose, userId), digest)
      // The index TTL is refreshed on every issue, so it always outlives the newest token it
      // tracks. Without the refresh a second token issued at minute 29 would lose its index
      // entry a minute later and become unrevokable.
      .expire(this.indexKey(purpose, userId), ttlSeconds)
      .exec();

    return {
      token,
      expiresAt: new Date(this.clock.now().getTime() + ttlSeconds * 1000),
    };
  }

  async consume(purpose: CredentialTokenPurpose, token: string): Promise<string | null> {
    // `GETDEL` — read and delete as ONE operation. A `GET` followed by a `DEL` lets two
    // simultaneous uses of one reset link both succeed, and the second one is whoever
    // intercepted the email.
    const digest = digestOf(token);
    const userId = await this.redis.getdel(this.tokenKey(purpose, digest));
    if (userId === null) return null;

    // Best-effort tidy of the index. Not awaited for correctness — the digest key is already
    // gone, so a stale index entry deletes nothing on the next revokeAll.
    await this.redis.srem(this.indexKey(purpose, userId), digest);
    return userId;
  }

  async revokeAll(purpose: CredentialTokenPurpose, userId: string): Promise<void> {
    const indexKey = this.indexKey(purpose, userId);
    const digests = await this.redis.smembers(indexKey);
    if (digests.length === 0) return;

    const pipeline = this.redis.multi();
    for (const digest of digests) pipeline.del(this.tokenKey(purpose, digest));
    pipeline.del(indexKey);
    await pipeline.exec();
  }

  /**
   * Constant-time comparison of two tokens.
   *
   * Not used by `consume` — that compares digests inside Redis by key lookup, which reveals
   * nothing — but exported for any future path that must compare two tokens in process.
   * `===` on a secret leaks its prefix through the comparison's early exit.
   */
  static equals(a: string, b: string): boolean {
    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b, 'utf8');
    // `timingSafeEqual` THROWS on a length mismatch, which is itself a length oracle — so the
    // lengths are compared first and the result folded in, rather than returned early.
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }

  private ttlSecondsFor(purpose: CredentialTokenPurpose): number {
    return purpose === 'PASSWORD_RESET'
      ? this.config.PASSWORD_RESET_TTL_SECONDS
      : this.config.EMAIL_VERIFICATION_TTL_HOURS * 3600;
  }

  private tokenKey(purpose: CredentialTokenPurpose, digest: string): string {
    return `${NAMESPACE[purpose]}:${digest}`;
  }

  private indexKey(purpose: CredentialTokenPurpose, userId: string): string {
    return `${NAMESPACE[purpose]}:user:${userId}`;
  }
}
