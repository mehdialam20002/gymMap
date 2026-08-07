/**
 * M-018 · `notifications/` public surface — §8.1 row 1.
 *
 * Note what is ABSENT: `NOTIFICATION_CHANNELS` and `MailpitEmailAdapter`. `ModuleDependency.md`
 * §4.2 makes this module the only one that may decide a channel, resolve an address, evaluate a
 * preference or choose a template — publishing modules emit a fact (`payment.failed`,
 * `membership.renewal-due`) and stop there. A module holding the channel array could send around
 * suppression, quiet hours and the per-recipient limiter without meaning to.
 *
 * So the outward surface is the CHANNEL-AGNOSTIC request port, and it arrives with EP-17. Until
 * then this file exports the module and the types a delivery-log reader needs, and nothing that
 * can send.
 */

export { NotificationsModule } from './notifications.module.js';
export type {
  NotificationCategory,
  NotificationChannelKey,
  NotificationDeliveryStatus,
  RoutingClass,
} from './types/index.js';
export { NON_DISABLEABLE_CATEGORIES } from './types/index.js';
