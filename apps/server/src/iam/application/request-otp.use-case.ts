/**
 * M-021 · `POST /v1/auth/otp/request` — `FR-AUTH-05`, `AC-AUTH-01.4`, `AC-AUTH-01.5`.
 *
 * ┌─ THE BUDGET IS CHECKED BEFORE THE SEND. THAT ORDER IS `AC-AUTH-01.4` ───────────────────────┐
 * │ *"The 4th send in 30 minutes returns 429 ... and NO SMS IS SENT."*                           │
 * │                                                                                              │
 * │ A limit enforced after the enqueue costs ₹0.15 on every request it refuses, which makes the │
 * │ control itself the financial exposure it was written to prevent (`CON-02`). The check is    │
 * │ therefore first, and the send is the last thing that happens.                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ AN UNREGISTERED NUMBER GETS THE SAME 202. THE SMS IS SIMPLY NOT SENT ──────────────────────┐
 * │ `AC-5`. `Authentication.md` §8.1's future-compatibility table calls a `404` here FORBIDDEN  │
 * │ rather than merely breaking — it turns the endpoint into an oracle over every mobile number │
 * │ in India, and the answer is worth money to anyone assembling a marketing list.               │
 * │                                                                                              │
 * │ Status, body and TIMING must all match. The first two are one code path. The third is why   │
 * │ the challenge is issued and the counters are written even when nothing will be delivered:   │
 * │ skipping the Redis work would make the unregistered path measurably faster.                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE SMS RAIL BEING DOWN IS A 202 WITH A FALLBACK, NOT A FAILURE ───────────────────────────┐
 * │ `AC-AUTH-01.5`, `DEP-03`. Only when BOTH rails are down is it a `503`. A member who cannot  │
 * │ receive an SMS but can receive email should not be told the service is broken.               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { DependencyUnavailableException } from '../../common/errors/domain-exception.js';
import {
  CaptchaRequiredError,
  OtpResendLimitError,
  OtpResendTooSoonError,
} from '../domain/iam.errors.js';
import { evaluateSend } from '../domain/otp.policy.js';
import { sendsToUnknownNumber, type OtpPurpose } from '../domain/otp-purpose.js';
import { OtpRedisStore } from '../infrastructure/otp.redis-store.js';
import { UserPrismaRepository } from '../infrastructure/user.prisma-repository.js';

/** Where the code went. Returned to the caller — `AC-AUTH-01.5`. */
export type OtpChannel = 'SMS' | 'EMAIL';

export interface RequestOtpCommand {
  readonly phone: string;
  readonly purpose: OtpPurpose;
  /** For the per-IP ceiling. Already extracted from the trusted proxy header by the controller. */
  readonly ip: string;
  readonly captchaSatisfied: boolean;
}

export interface RequestOtpResult {
  readonly channel: OtpChannel;
  /** Set only when the SMS rail was unavailable and email was used instead. */
  readonly fallback: OtpChannel | null;
  readonly expiresAt: Date;
}

/**
 * What actually delivers the code. A port in all but name — `notifications/` owns the decision,
 * and M-018's channel adapters are what will sit behind it.
 *
 * `iam/` must NOT inject `NOTIFICATION_CHANNELS`: `ModuleDependency.md` §4.2 makes `notifications`
 * the only module that may choose a channel or resolve an address.
 */
export interface OtpDelivery {
  /** Resolves to the channel actually used. Throws only when NO channel is available. */
  deliver(input: {
    readonly phone: string;
    readonly code: string;
    readonly purpose: OtpPurpose;
    readonly expiresAt: Date;
  }): Promise<{ channel: OtpChannel; fallback: OtpChannel | null }>;
}

export const OTP_DELIVERY = Symbol('OtpDelivery');

@Injectable()
export class RequestOtpUseCase {
  private readonly logger = new Logger(RequestOtpUseCase.name);

  constructor(
    private readonly store: OtpRedisStore,
    private readonly users: UserPrismaRepository,
    @Inject(OTP_DELIVERY) private readonly delivery: OtpDelivery,
  ) {}

  async execute(command: RequestOtpCommand): Promise<RequestOtpResult> {
    // ── 1. The ceilings, BEFORE anything is sent or even minted ─────────────────────────────
    const operationsFromIp = await this.store.recordIpOperation(command.ip);
    const { sendsInWindow, secondsSinceLastSend } = await this.store.readSendCounters(
      command.phone,
    );

    const verdict = evaluateSend({
      sendsInWindow,
      secondsSinceLastSend,
      operationsFromIp,
      captchaSatisfied: command.captchaSatisfied,
    });

    switch (verdict.kind) {
      case 'IP_LIMIT':
        // The hard per-IP ceiling maps to the resend-limit code rather than a bespoke one: the
        // caller learns they must wait, and learns nothing about whether the LIMIT they hit was
        // about their number or their address — which would tell an abuser which axis to rotate.
        throw new OtpResendLimitError(verdict.retryAfterSeconds);
      case 'CAPTCHA_REQUIRED':
        throw new CaptchaRequiredError();
      case 'COOLDOWN':
        throw new OtpResendTooSoonError(verdict.retryAfterSeconds);
      case 'RESEND_LIMIT':
        throw new OtpResendLimitError(verdict.retryAfterSeconds);
      case 'ALLOWED':
        break;
    }

    // ── 2. Does an account exist? ────────────────────────────────────────────────────────────
    //
    // The answer changes only whether an SMS is DELIVERED. It never changes the status, the body
    // or the amount of work done — see the header.
    const existing = await this.users.findForAuthentication({
      kind: 'PHONE',
      value: command.phone,
    });
    const shouldDeliver = existing !== null || sendsToUnknownNumber(command.purpose);

    // ── 3. Mint and store, unconditionally ───────────────────────────────────────────────────
    //
    // Even when nothing will be delivered. The Redis writes are the bulk of the work on this
    // path, and skipping them for an unregistered number is exactly the timing difference
    // AC-5 forbids.
    const issued = await this.store.issue(command.purpose, command.phone);
    await this.store.recordSend(command.phone);

    if (!shouldDeliver) {
      this.logger.log({
        message: 'otp requested for a number with no account — nothing delivered',
        purpose: command.purpose,
        // NO phone number and NO code. BR-DAT-06 keeps both out of logs, and DLT-5 keeps the
        // code out of the notification payload too.
        generation: issued.generation,
      });
      return { channel: 'SMS', fallback: null, expiresAt: issued.expiresAt };
    }

    // ── 4. Deliver ───────────────────────────────────────────────────────────────────────────
    try {
      const { channel, fallback } = await this.delivery.deliver({
        phone: command.phone,
        code: issued.code,
        purpose: command.purpose,
        expiresAt: issued.expiresAt,
      });
      this.logger.log({
        message: 'otp delivered',
        purpose: command.purpose,
        channel,
        fallback,
        generation: issued.generation,
      });
      return { channel, fallback, expiresAt: issued.expiresAt };
    } catch (error) {
      // BOTH rails down — AC-AUTH-01.5's only 503. The challenge stays in Redis and expires on
      // its own; leaving it costs nothing and a member who retries in a minute may get through.
      this.logger.error({
        message: 'no OTP channel available',
        purpose: command.purpose,
        error: error instanceof Error ? error.message : 'unknown',
      });
      throw new DependencyUnavailableException('every OTP delivery channel');
    }
  }
}
