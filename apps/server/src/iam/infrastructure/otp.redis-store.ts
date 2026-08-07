/**
 * M-021 · OTP state in Redis — `SM1`, `BR-DAT-06`, `Security.md` §2.3.5, §10.3.
 *
 * ┌─ NO POSTGRESQL ROW IS WRITTEN. AN ABANDONED FLOW LEAVES NOTHING ────────────────────────────┐
 * │ `SM1`. Most OTP requests are abandoned — a member changes their mind, the SMS is slow, they │
 * │ close the tab. A table row per request would accumulate millions of dead rows carrying a    │
 * │ phone number, which is `BR-DAT-06` data with a retention obligation attached to it.          │
 * │                                                                                              │
 * │ Redis with a 300-second TTL means an abandoned flow is gone in five minutes, with no sweep  │
 * │ and nothing to retain.                                                                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE KEY IS AN HMAC OF THE NUMBER, NOT THE NUMBER ──────────────────────────────────────────┐
 * │ Unlike the lockout counter, whose key is an internal uuid, this key is derived from a PHONE │
 * │ NUMBER — personal data under `BR-DAT-06` and the DPDP Act. A Redis `KEYS *` on a dump would │
 * │ otherwise enumerate every number that has ever requested a code.                             │
 * │                                                                                              │
 * │ HMAC and not a bare SHA-256: the space of Indian mobile numbers is about 4 × 10^9, which a  │
 * │ plain hash rainbow-tables in minutes. The key makes the digest unreversible without it.      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE CODE ITSELF IS NEVER STORED — ONLY ITS HMAC, BOUND TO THE PURPOSE ─────────────────────┐
 * │ `AC-7`. Six digits is a million possibilities; a plain hash of one is brute-forced          │
 * │ instantly, so the same secret key is what makes the stored digest worth anything.            │
 * │                                                                                              │
 * │ The PURPOSE is inside the MAC (§2.3.5), so a code texted for `REGISTER` produces a different │
 * │ digest when checked as `UNLOCK` and simply does not match. There is no comparison to forget. │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ A RESEND INCREMENTS `generation`, AND VERIFICATION ONLY EVER CHECKS THE CURRENT ONE ───────┐
 * │ §2.3.5. A member who taps "resend" has two codes in flight — the SMS they are about to      │
 * │ receive, and the one from ninety seconds ago that a shoulder-surfer or an SMS-interception  │
 * │ path may already have. Storing one code per number and overwriting it closes that window;   │
 * │ storing a list would leave it open for the full TTL.                                         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { createHmac, hkdfSync, randomInt, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

import { APP_CONFIG, type AppConfig } from '../../common/config/app-config.schema.js';
import { CLOCK, type Clock } from '../../common/clock/clock.port.js';
import { REDIS_CLIENT } from '../../common/persistence/redis.provider.js';
import type { OtpPurpose } from '../domain/otp-purpose.js';
import {
  OTP_IP_WINDOW_SECONDS,
  OTP_LENGTH,
  OTP_MAX_VERIFY_ATTEMPTS,
  OTP_SEND_WINDOW_SECONDS,
  OTP_TTL_SECONDS,
  formatOtpCode,
} from '../domain/otp.policy.js';

export interface IssuedOtp {
  /** The plaintext, for `notifications/` ONLY. Never persisted, never logged, never returned. */
  readonly code: string;
  readonly generation: number;
  readonly expiresAt: Date;
}

export interface OtpChallengeState {
  readonly generation: number;
  readonly attempts: number;
  readonly issuedAtMs: number;
}

export type VerifyOutcome =
  | { readonly kind: 'VERIFIED' }
  | { readonly kind: 'NO_CHALLENGE' }
  | { readonly kind: 'WRONG'; readonly attemptsRemaining: number }
  | { readonly kind: 'ATTEMPTS_EXCEEDED' };

/**
 * Consume a code atomically: compare, and on a match DELETE; on a miss increment attempts and
 * delete once they are spent.
 *
 * One script rather than GET-then-DEL. Five concurrent submissions of the same correct code
 * must yield ONE verification — otherwise a race lets a replay through, which is the whole
 * meaning of "single-use". And an attempt counter incremented outside the compare can be raced
 * to stay below the ceiling forever.
 */
const VERIFY_AND_CONSUME = `
  local raw = redis.call('GET', KEYS[1])
  if not raw then return 'NO_CHALLENGE' end

  local state = cjson.decode(raw)
  if state.digest == ARGV[1] then
    redis.call('DEL', KEYS[1])
    return 'VERIFIED'
  end

  state.attempts = state.attempts + 1
  if state.attempts >= tonumber(ARGV[2]) then
    redis.call('DEL', KEYS[1])
    return 'ATTEMPTS_EXCEEDED'
  end

  redis.call('SET', KEYS[1], cjson.encode(state), 'KEEPTTL')
  return 'WRONG:' .. tostring(tonumber(ARGV[2]) - state.attempts)
`;

@Injectable()
export class OtpRedisStore {
  /**
   * A key DERIVED from the application secret, not the secret itself.
   *
   * ┌─ KEY SEPARATION, AND WHY IT IS WORTH FOUR LINES ─────────────────────────────────────────┐
   * │ Using `JWT_ACCESS_SECRET` directly as an HMAC key would make the same secret both sign    │
   * │ access tokens and MAC OTP codes. Cross-purpose key reuse is the kind of thing that is     │
   * │ harmless until one construction is found to leak something about the key, at which point  │
   * │ it takes the other down with it — and the two have completely different exposure: a       │
   * │ token MAC is computed on attacker-supplied input on every request.                         │
   * │                                                                                            │
   * │ HKDF with a label costs one call at construction and makes the two keys independent. The  │
   * │ label is fixed forever: changing it invalidates every OTP in flight, which is a five-      │
   * │ minute outage rather than a correctness problem, but there is no reason to.                │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  private readonly otpKey: Buffer;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(APP_CONFIG) config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.otpKey = Buffer.from(
      hkdfSync('sha256', config.JWT_ACCESS_SECRET, '', 'gymmap:otp:v1', 32),
    );
  }

  /**
   * Mints a code, stores its HMAC, and returns the plaintext for delivery.
   *
   * The plaintext exists only in this return value and in the notification payload. It is never
   * written to Redis, never logged, and never placed in a response body.
   */
  async issue(purpose: OtpPurpose, phone: string): Promise<IssuedOtp> {
    // `randomInt` from node:crypto — CSPRNG, and uniform. `Math.random()` is not secure, and
    // `x % 1_000_000` over a 32-bit draw biases the low codes because 2^32 is not a multiple
    // of 10^6. See `otp.policy.ts`.
    const code = formatOtpCode(randomInt(0, 10 ** OTP_LENGTH));

    const key = this.challengeKey(purpose, phone);
    const previous = await this.readState(key);
    // A resend supersedes: the older code stops working the moment this one is stored.
    const generation = (previous?.generation ?? 0) + 1;

    const state = {
      digest: this.codeDigest(purpose, phone, code, generation),
      attempts: 0,
      generation,
      issuedAtMs: this.clock.now().getTime(),
    };

    await this.redis.set(key, JSON.stringify(state), 'EX', OTP_TTL_SECONDS);

    return {
      code,
      generation,
      expiresAt: new Date(state.issuedAtMs + OTP_TTL_SECONDS * 1000),
    };
  }

  /** Atomically compares and consumes. See `VERIFY_AND_CONSUME`. */
  async verify(purpose: OtpPurpose, phone: string, code: string): Promise<VerifyOutcome> {
    const key = this.challengeKey(purpose, phone);
    const state = await this.readState(key);
    if (state === null) return { kind: 'NO_CHALLENGE' };

    // The digest is computed against the CURRENT generation only. A code from before a resend
    // hashes to a different value and cannot match — §2.3.5's superseding property.
    const digest = this.codeDigest(purpose, phone, code, state.generation);

    const raw = await this.redis.eval(
      VERIFY_AND_CONSUME,
      1,
      key,
      digest,
      String(OTP_MAX_VERIFY_ATTEMPTS),
    );
    const result = String(raw);

    if (result === 'VERIFIED') return { kind: 'VERIFIED' };
    if (result === 'NO_CHALLENGE') return { kind: 'NO_CHALLENGE' };
    if (result === 'ATTEMPTS_EXCEEDED') return { kind: 'ATTEMPTS_EXCEEDED' };
    return { kind: 'WRONG', attemptsRemaining: Number(result.split(':')[1] ?? 0) };
  }

  /** Records a send, for the per-number window and the cool-down. */
  async recordSend(phone: string): Promise<void> {
    const key = this.sendKey(phone);
    const nowMs = this.clock.now().getTime();
    // A sorted set keyed by timestamp: the window is a range query rather than a counter, so
    // "3 in the last 30 minutes" is genuinely sliding rather than a bucket that resets.
    await this.redis
      .multi()
      .zadd(key, nowMs, `${String(nowMs)}:${String(randomInt(0, 1_000_000))}`)
      .zremrangebyscore(key, 0, nowMs - OTP_SEND_WINDOW_SECONDS * 1000)
      .expire(key, OTP_SEND_WINDOW_SECONDS)
      .exec();
  }

  /** Sends inside the window, and how long since the last one. */
  async readSendCounters(
    phone: string,
  ): Promise<{ sendsInWindow: number; secondsSinceLastSend: number | null }> {
    const key = this.sendKey(phone);
    const nowMs = this.clock.now().getTime();
    const cutoff = nowMs - OTP_SEND_WINDOW_SECONDS * 1000;

    const [count, latest] = await Promise.all([
      this.redis.zcount(key, cutoff, '+inf'),
      this.redis.zrevrange(key, 0, 0, 'WITHSCORES'),
    ]);

    const lastMs = latest.length === 2 ? Number(latest[1]) : null;
    return {
      sendsInWindow: count,
      secondsSinceLastSend: lastMs === null ? null : Math.floor((nowMs - lastMs) / 1000),
    };
  }

  /** Increments and returns the per-IP hourly count. Same TTL-on-create shape as the lockout. */
  async recordIpOperation(ip: string): Promise<number> {
    const key = this.ipKey(ip);
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, OTP_IP_WINDOW_SECONDS);
    return count;
  }

  async readIpOperations(ip: string): Promise<number> {
    const raw = await this.redis.get(this.ipKey(ip));
    const value = Number(raw ?? 0);
    return Number.isInteger(value) && value >= 0 ? value : 0;
  }

  /**
   * Constant-time comparison, exported for any in-process code comparison.
   *
   * Not used by `verify` — that compares digests inside Redis, where the timing of a string
   * equality on a MAC reveals nothing about the code. Here for completeness and for the spec.
   */
  static codesMatch(a: string, b: string): boolean {
    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b, 'utf8');
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }

  /**
   * HMAC of the code, BOUND to the purpose, the number and the generation.
   *
   * All four inputs matter. Drop the purpose and a `REGISTER` code unlocks a locked account;
   * drop the number and a code texted to one member verifies for another; drop the generation
   * and a superseded code keeps working for the rest of the TTL.
   */
  private codeDigest(purpose: OtpPurpose, phone: string, code: string, generation: number): string {
    return createHmac('sha256', this.otpKey)
      .update(`otp:${purpose}:${phone}:${String(generation)}:${code}`)
      .digest('hex');
  }

  /** `otp:code:{purpose}:{phone_hmac}` — the roadmap's shape, with the number never in the key. */
  private challengeKey(purpose: OtpPurpose, phone: string): string {
    return `otp:code:${purpose}:${this.phoneHmac(phone)}`;
  }

  private sendKey(phone: string): string {
    return `otp:resend:${this.phoneHmac(phone)}`;
  }

  private ipKey(ip: string): string {
    // The IP is hashed for the same reason the number is: an address is personal data under the
    // DPDP Act, and a Redis dump should not be a list of who used the service from where.
    return `otp:ip:${createHmac('sha256', this.otpKey).update(ip).digest('hex').slice(0, 32)}`;
  }

  private phoneHmac(phone: string): string {
    return createHmac('sha256', this.otpKey).update(phone).digest('hex');
  }

  private async readState(key: string): Promise<OtpChallengeState | null> {
    const raw = await this.redis.get(key);
    if (raw === null) return null;
    try {
      const parsed = JSON.parse(raw) as OtpChallengeState & { digest: string };
      return parsed;
    } catch {
      // A corrupt value is treated as no challenge rather than throwing. The member retries and
      // gets a fresh code; a 500 here would strand them with no way forward.
      return null;
    }
  }
}
