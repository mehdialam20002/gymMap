/**
 * M-020 · The failed-password counter in Redis — `FR-AUTH-08`, `Authentication.md` §6.
 *
 * ┌─ THE SLIDING WINDOW IS A TTL SET ON FIRST FAILURE, NOT ON EVERY ONE ────────────────────────┐
 * │ `INCR` then `EXPIRE` unconditionally would reset the window on each failure — so an         │
 * │ attacker pacing one guess every fourteen minutes would never accumulate a count, and the    │
 * │ lockout would never fire however long they kept going.                                       │
 * │                                                                                              │
 * │ The `EXPIRE` is therefore conditional on the counter being NEW: the window starts at the    │
 * │ first failure and runs for fifteen minutes regardless of what happens inside it. Ten        │
 * │ failures in that window locks; nine and the whole thing vanishes.                            │
 * │                                                                                              │
 * │ Done in one Lua script rather than INCR-then-check-then-EXPIRE, because between the INCR    │
 * │ and the EXPIRE a concurrent failure sees a counter with no TTL — and if the process dies    │
 * │ there, the key never expires and the account is locked permanently.                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE KEY IS THE USER ID, WHICH IS ALREADY OPAQUE ───────────────────────────────────────────┐
 * │ `auth:fail:{user_id}` verbatim from §6. A uuid is not personal data — it identifies a row,  │
 * │ not a person — so unlike a rate-limit key over an email address this needs no HMAC. A       │
 * │ Redis dump reveals which internal ids have had failures, and nothing about who they are.    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

import { APP_CONFIG, type AppConfig } from '../../common/config/app-config.schema.js';
import { REDIS_CLIENT } from '../../common/persistence/redis.provider.js';
import { LOCKOUT_ESCALATION_WINDOW_SECONDS } from '../domain/lockout.policy.js';
import type { LockoutCounter, LockoutCounters } from '../application/ports/lockout-counter.port.js';

/**
 * `INCR`, and set the TTL only when the counter was just created.
 *
 * `redis.call('INCR', k)` returns 1 exactly when the key did not exist, which is the condition
 * for starting the window. Atomic, so a concurrent failure cannot observe a counter with no TTL.
 */
const INCREMENT_WITHIN_WINDOW = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return count
`;

@Injectable()
export class RedisLockoutCounter implements LockoutCounter {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async read(userId: string): Promise<LockoutCounters> {
    // One round trip for both. Two `GET`s would be two network hops on every login attempt.
    const [failures, locks] = await this.redis.mget(
      this.failureKey(userId),
      this.escalationKey(userId),
    );

    return {
      failures: toCount(failures),
      locksInEscalationWindow: toCount(locks),
    };
  }

  async recordFailure(userId: string): Promise<number> {
    const count = await this.redis.eval(
      INCREMENT_WITHIN_WINDOW,
      1,
      this.failureKey(userId),
      String(this.config.LOCKOUT_WINDOW_SECONDS),
    );
    return Number(count);
  }

  async recordLock(userId: string): Promise<void> {
    await this.redis.eval(
      INCREMENT_WITHIN_WINDOW,
      1,
      this.escalationKey(userId),
      String(LOCKOUT_ESCALATION_WINDOW_SECONDS),
    );
  }

  async clearFailures(userId: string): Promise<void> {
    // The escalation key is deliberately untouched — see the port. Three locks in a day is a
    // fact about the day, and clearing it on the first successful login after each lock would
    // make the escalation unreachable: guess correctly once and the evidence resets.
    await this.redis.del(this.failureKey(userId));
  }

  /** `Authentication.md` §6, verbatim. */
  private failureKey(userId: string): string {
    return `auth:fail:${userId}`;
  }

  private escalationKey(userId: string): string {
    return `auth:locks:${userId}`;
  }
}

/**
 * A missing key is zero failures.
 *
 * `Number(null)` is 0 and `Number('')` is 0, but `Number('abc')` is `NaN` — and `NaN >= 10` is
 * false, so a corrupt value would silently mean "never lock this account". Anything unparseable
 * is treated as zero explicitly rather than by accident.
 */
function toCount(raw: string | null | undefined): number {
  // `undefined` as well as `null`: `mget` is typed to return `(string | null)[]`, but indexing
  // that array under `noUncheckedIndexedAccess` widens each element with `undefined`. Both mean
  // "no counter", and both must mean zero rather than NaN.
  if (raw === null || raw === undefined) return 0;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}
