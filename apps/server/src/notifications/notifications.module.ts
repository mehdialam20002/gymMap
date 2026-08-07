/**
 * M-018 · `notifications/` — the channel registry, and nothing else yet.
 *
 * ┌─ REGISTRATION IS THE ONLY PLACE A CHANNEL IS NAMED ─────────────────────────────────────────┐
 * │ `PROJECT_CONSTITUTION.md` §1318. The dispatcher receives `NOTIFICATION_CHANNELS` as an       │
 * │ array and filters it by key and by preference; it never mentions Mailpit, MSG91 or any       │
 * │ other vendor. Adding a channel is a new file and one line here.                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE ARRAY IS EMPTY OUTSIDE `local` AND `test`, DELIBERATELY ───────────────────────────────┐
 * │ `A-19` is `DEFERRED`, so no vendor adapter exists. The only adapter that does is Mailpit,    │
 * │ which delivers nothing outside a developer's machine.                                        │
 * │                                                                                              │
 * │ So in any other environment this module registers NO channels, and the dispatcher's honest   │
 * │ answer for every channel is `CHANNEL_NOT_AVAILABLE` (422) — the code `README.md` §9.5.11     │
 * │ registers against "the requested channel has no configured adapter", citing `A-19` by name.  │
 * │                                                                                              │
 * │ The alternative — registering Mailpit everywhere — is the exact failure the adapter's own    │
 * │ constructor guard describes: every send accepted, nothing delivered, logs at a hundred       │
 * │ percent. A 422 is visible. A silent success is not.                                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * NOT imported by `AppModule`. Per that file's standing rule, a module is wired in by the
 * milestone that gives it a consumer — the dispatcher, the templates and the delivery log are
 * EP-17 — and "an empty module imported early is a module whose boundaries nobody has had to
 * think about yet".
 */

import { Module } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../common/config/app-config.schema.js';
import { CLOCK, type Clock } from '../common/clock/clock.port.js';
import {
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
} from './application/ports/notification-channel.port.js';
import { MailpitEmailAdapter } from './infrastructure/mailpit-email.adapter.js';

/** Where Mailpit is a correct answer, and the only place it is. */
const MAILPIT_ENVIRONMENTS = ['local', 'test'];

@Module({
  providers: [
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (config: AppConfig, clock: Clock): NotificationChannel[] =>
        MAILPIT_ENVIRONMENTS.includes(config.APP_ENV)
          ? [new MailpitEmailAdapter(config, clock)]
          : [],
      inject: [APP_CONFIG, CLOCK],
    },
  ],
  exports: [NOTIFICATION_CHANNELS],
})
export class NotificationsModule {}
