/**
 * The Mailpit LOCAL adapter — the only channel adapter that exists at Sprint 0 (`T-17.03`).
 *
 * ┌─ LOCAL ONLY, AND IT REFUSES TO RUN ANYWHERE ELSE ───────────────────────────────────────────┐
 * │ Mailpit captures mail and shows it at <http://localhost:8025>. Nothing leaves the machine,  │
 * │ which is exactly right for development and exactly wrong for anything else — so the         │
 * │ constructor THROWS outside `local` and `test`.                                               │
 * │                                                                                              │
 * │ Without that guard, a deployment whose `A-19` vendor configuration was missing would fall    │
 * │ back to this, report every send as accepted, and deliver nothing. Members would stop         │
 * │ receiving OTPs and the logs would show a hundred percent success rate — which is worse than  │
 * │ an outage, because an outage is noticed.                                                      │
 * │                                                                                              │
 * │ `NotificationsModule` also declines to construct it outside those environments, so the guard │
 * │ is the second of two. It is kept because the first is a factory somebody could rewrite.      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The real vendor adapter arrives with `A-19`, `DEFERRED` on `OQ-01` with a Sprint 12 deadline.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../../common/config/app-config.schema.js';
import { CLOCK, type Clock } from '../../common/clock/clock.port.js';
import type {
  ChannelSendResult,
  ChannelStatusEvent,
  NotificationChannel,
  RenderedMessage,
  SendContext,
} from '../application/ports/notification-channel.port.js';
import type { NotificationCategory, NotificationChannelKey } from '../types/index.js';

@Injectable()
export class MailpitEmailAdapter implements NotificationChannel {
  readonly key: NotificationChannelKey = 'EMAIL';

  private readonly logger = new Logger(MailpitEmailAdapter.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    if (!['local', 'test'].includes(this.config.APP_ENV)) {
      throw new Error(
        `MailpitEmailAdapter constructed in APP_ENV=${this.config.APP_ENV}. It captures mail ` +
          'locally and delivers nothing — reaching it in a deployed environment would report ' +
          'every send as accepted while no member ever received one, and the logs would show a ' +
          'hundred percent success rate. Configure the A-19 vendor adapter instead.',
      );
    }
  }

  /** Email carries all four categories. SMS and push are the channels that narrow this. */
  supports(_category: NotificationCategory): boolean {
    return true;
  }

  send(message: RenderedMessage, context: SendContext): Promise<ChannelSendResult> {
    const startedAt = this.clock.now();

    // The TEMPLATE KEY is logged; the BODY and the recipient are not. A rendered body carries a
    // member's name, their gym, their outstanding balance or their OTP, and `BR-DAT-06` keeps
    // personal data out of logs — including in local development, which is where a log is most
    // likely to be pasted into a ticket.
    this.logger.log({
      message: 'email captured by Mailpit',
      notificationId: message.notificationId,
      to: redactAddress(message.to),
      templateKey: message.templateKey,
      templateVersion: message.templateVersion,
      category: message.category,
      attemptNo: context.attemptNo,
      correlationId: context.correlationId,
      inbox: 'http://localhost:8025',
    });

    // SMTP delivery to `localhost:1025` arrives with the dispatcher (EP-17). Reporting `SENT`
    // here is accurate for what this adapter promises — the message reached the local capture —
    // and `SENT` is where a channel with no callback model stops in any case (§2.8 D8).
    return Promise.resolve({
      attemptNo: context.attemptNo,
      status: 'SENT',
      // No provider id: Mailpit is not a provider. A fabricated one would join to nothing.
      retryable: false,
      // No `costMinor`. `BR-FIN-06` — recorded only as reported, and nothing reported one.
      latencyMs: this.clock.now().getTime() - startedAt.getTime(),
    });
  }

  parseStatusCallback(): ChannelStatusEvent {
    // §2.8 D8. Mailpit has no callback model, so this channel stops at `SENT` and never reaches
    // `DELIVERED`. Throwing says so; returning a synthesised `DELIVERED` would put a delivery
    // confirmation in the log for a message nobody received.
    throw new Error(
      'MailpitEmailAdapter has no status callback. Notifications.md §2.8 D8: a channel with no ' +
        'callback model stops at SENT — the delivery log states that rather than implying it.',
    );
  }
}

/** `p***a@example.com`. Enough to recognise, not enough to be personal data in a log. */
function redactAddress(address: string): string {
  const [local, domain] = address.split('@');
  if (!local || !domain) return '[malformed]';
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}
