/**
 * M-021 · `POST /v1/auth/otp/verify` — `FR-AUTH-05`, `AC-AUTH-01.3`, `AC-8`.
 *
 * ┌─ SINGLE USE IS A CONCURRENCY CLAIM, AND THE STORE ENFORCES IT ──────────────────────────────┐
 * │ The compare-and-consume is one Lua script in `otp.redis-store.ts`. A GET-then-DEL here      │
 * │ would let five simultaneous submissions of one correct code all succeed, and the attempt    │
 * │ counter could be raced to stay below five forever.                                           │
 * │                                                                                              │
 * │ This use case therefore does no comparison of its own. It asks, and maps the answer.         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ VERIFYING DOES NOT SIGN YOU IN ────────────────────────────────────────────────────────────┐
 * │ Same rule as email verification in M-020, and for a stronger reason: an SMS is the channel  │
 * │ most exposed to interception in the launch market. This returns the verified number and the │
 * │ user id if one exists; the session is M-022's, behind its own decisions about rotation and  │
 * │ device binding.                                                                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { CLOCK, type Clock } from '../../common/clock/clock.port.js';
import {
  OtpAttemptsExceededError,
  OtpExpiredError,
  OtpInvalidError,
} from '../domain/iam.errors.js';
import { OTP_RESEND_COOLDOWN_SECONDS } from '../domain/otp.policy.js';
import type { OtpPurpose } from '../domain/otp-purpose.js';
import { OtpRedisStore } from '../infrastructure/otp.redis-store.js';
import { UserPrismaRepository } from '../infrastructure/user.prisma-repository.js';

export interface VerifyOtpCommand {
  readonly phone: string;
  readonly purpose: OtpPurpose;
  readonly code: string;
}

export interface VerifyOtpResult {
  readonly phone: string;
  readonly purpose: OtpPurpose;
  /** `null` when no account exists — a `REGISTER` verification, which M-022's flow completes. */
  readonly userId: string | null;
}

@Injectable()
export class VerifyOtpUseCase {
  private readonly logger = new Logger(VerifyOtpUseCase.name);

  constructor(
    private readonly store: OtpRedisStore,
    private readonly users: UserPrismaRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: VerifyOtpCommand): Promise<VerifyOtpResult> {
    const outcome = await this.store.verify(command.purpose, command.phone, command.code);

    switch (outcome.kind) {
      case 'NO_CHALLENGE':
        // Expired, never issued, or already consumed — ONE answer. Distinguishing them would say
        // whether a number had recently requested a code, which is the same oracle in a
        // different place.
        throw new OtpExpiredError();

      case 'ATTEMPTS_EXCEEDED':
        // The code is already destroyed by the script. The member must request a new one, and
        // the cool-down is what they wait.
        this.logger.warn({
          message: 'otp attempts exhausted',
          purpose: command.purpose,
        });
        throw new OtpAttemptsExceededError(OTP_RESEND_COOLDOWN_SECONDS);

      case 'WRONG':
        // AC-AUTH-01.3 — the count is in the body. A bare "wrong code" leaves the member
        // guessing whether the next attempt destroys it, and the ones who guess wrong give up.
        throw new OtpInvalidError(outcome.attemptsRemaining);

      case 'VERIFIED':
        break;
    }

    const existing = await this.users.findForAuthentication({
      kind: 'PHONE',
      value: command.phone,
    });

    // A verified LOGIN or UNLOCK against a real account stamps the number verified — the member
    // has just proved control of it, which is exactly what `phone_verified_at` records and what
    // `BR-GYM-02` and the FR-AUTH-08 unlock path both read.
    if (existing !== null && existing.phoneVerifiedAt === null) {
      await this.users.markPhoneVerified(existing.id, this.clock.now());
    }

    this.logger.log({
      message: 'otp verified',
      purpose: command.purpose,
      userId: existing?.id ?? null,
    });

    return { phone: command.phone, purpose: command.purpose, userId: existing?.id ?? null };
  }
}
