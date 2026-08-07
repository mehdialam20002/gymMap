/**
 * M-021 · OTP delivery — `AC-AUTH-01.5`, `DEP-03`, `DLT-5`, `ModuleDependency.md` §4.2.
 *
 * ┌─ `iam/` DOES NOT CHOOSE A CHANNEL. IT ASKS FOR ONE ─────────────────────────────────────────┐
 * │ §4.2 makes `notifications/` the only module that may decide a channel, resolve an address   │
 * │ or evaluate a preference. So this adapter does not inject `NOTIFICATION_CHANNELS` — it      │
 * │ describes the fallback POLICY, which is `iam/`'s to own because `AC-AUTH-01.5` states it in │
 * │ authentication terms, and hands the actual send to the channel registry.                     │
 * │                                                                                              │
 * │ Today that registry is empty outside `local`/`test`, because `A-19` is `DEFERRED` — so this │
 * │ adapter's honest behaviour in a deployed environment is to find no channel and raise, which │
 * │ becomes the `503` of `AC-AUTH-01.5`'s both-rails-down case. That is correct rather than     │
 * │ convenient: no vendor is configured, so no OTP can be delivered, and the endpoint says so.   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE CODE NEVER ENTERS A LOG OR A NOTIFICATION PAYLOAD ─────────────────────────────────────┐
 * │ `AC-7` and `DLT-5`. The template gets the code as a VARIABLE VALUE, and `notification_log`  │
 * │ records the variable NAMES only. The Mailpit adapter M-018 built already logs                │
 * │ `variableKeys` and never `variables` for exactly this reason.                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../../common/config/app-config.schema.js';
import {
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
} from '../../notifications/application/ports/notification-channel.port.js';
import type { OtpPurpose } from '../domain/otp-purpose.js';
import type { OtpChannel, OtpDelivery } from '../application/request-otp.use-case.js';

/**
 * The DLT-registered template per purpose.
 *
 * India's TRAI regime makes these a legal requirement rather than a naming convention: an SMS on
 * an unregistered template is REJECTED BY THE CARRIER (`LAUNCH_MARKET_INDIA.md` §8). The ids
 * themselves arrive with the `EXT-17.2` registration; the KEYS are frozen in Sprint 0 so the
 * sixteen-template inventory is stable while approval runs.
 */
const TEMPLATE_KEY: Record<OtpPurpose, string> = {
  REGISTER: 'auth.otp.register',
  LOGIN: 'auth.otp.login',
  PHONE_CHANGE: 'auth.otp.phone-change',
  UNLOCK: 'auth.otp.unlock',
  SENSITIVE_STEP_UP: 'auth.otp.step-up',
};

@Injectable()
export class OtpDeliveryAdapter implements OtpDelivery {
  private readonly logger = new Logger(OtpDeliveryAdapter.name);

  constructor(
    @Inject(NOTIFICATION_CHANNELS) private readonly channels: NotificationChannel[],
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async deliver(input: {
    readonly phone: string;
    readonly code: string;
    readonly purpose: OtpPurpose;
    readonly expiresAt: Date;
  }): Promise<{ channel: OtpChannel; fallback: OtpChannel | null }> {
    const sms = this.channels.find((channel) => channel.key === 'SMS');
    const email = this.channels.find((channel) => channel.key === 'EMAIL');

    if (sms !== undefined) {
      try {
        await this.send(sms, input, 'SMS');
        return { channel: 'SMS', fallback: null };
      } catch (error) {
        // AC-AUTH-01.5 / DEP-03: the SMS rail failing is NOT the end of the request. Logged at
        // warn rather than error — a rail outage is an alertable condition on its own metric,
        // and raising it here as well would double-count every message.
        this.logger.warn({
          message: 'SMS rail unavailable — falling back to email',
          purpose: input.purpose,
          error: error instanceof Error ? error.message : 'unknown',
        });
      }
    }

    if (email !== undefined) {
      await this.send(email, input, 'EMAIL');
      return { channel: 'EMAIL', fallback: 'EMAIL' };
    }

    // BOTH rails down. The caller turns this into the one 503 AC-AUTH-01.5 permits.
    throw new Error(
      `No OTP channel is configured in APP_ENV=${this.config.APP_ENV}. A-19 is DEFERRED, so no ` +
        'vendor adapter exists and NotificationsModule registers no channel outside local/test.',
    );
  }

  private async send(
    channel: NotificationChannel,
    input: { phone: string; code: string; purpose: OtpPurpose; expiresAt: Date },
    kind: OtpChannel,
  ): Promise<void> {
    await channel.send(
      {
        notificationId: `otp:${input.purpose}`,
        channel: kind,
        to: input.phone,
        subject: kind === 'EMAIL' ? 'Your verification code' : null,
        // The rendered body. The CODE is in it because that is what is being delivered — and it
        // exists only here and on the wire. Nothing writes it to a log or a database row.
        body: `${input.code} is your GymMap verification code. It expires in 5 minutes.`,
        templateKey: TEMPLATE_KEY[input.purpose],
        templateVersion: 1,
        locale: 'en-IN',
        // SECURITY, not TRANSACTIONAL. `Notifications.md` §2.4 makes SECURITY one of the two
        // categories a member cannot switch off — an OTP a preference could suppress is an
        // account nobody can get into.
        category: 'SECURITY',
        // The DND rail. An OTP is a service message tied to an existing interaction, so it
        // reaches a DND-registered number (`LAUNCH_MARKET_INDIA.md` §8).
        routingClass: 'TRANSACTIONAL',
        // Filled by the EXT-17.2 registration. Null until then, which is why SMS cannot yet
        // send in a deployed environment even once a vendor exists.
        dltTemplateId: null,
      },
      { attemptNo: 1, correlationId: `otp-${input.purpose}` },
    );
  }
}
