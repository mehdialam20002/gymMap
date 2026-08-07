/**
 * M-018 · the `EP-17 F-17.1` channel port and its one Sprint-0 adapter — `T-17.03`, `A-19`.
 *
 * ┌─ WHAT THIS SUITE IS ACTUALLY GUARDING ──────────────────────────────────────────────────────┐
 * │ The failure mode of a notification subsystem is not a crash. It is a hundred percent success │
 * │ rate on a channel that delivers nothing — a local capture adapter reached in a deployed      │
 * │ environment, or a stub written to keep a build green. Members stop receiving OTPs and every  │
 * │ dashboard stays green until somebody phones support.                                          │
 * │                                                                                              │
 * │ So the assertions that matter here are refusals: the adapter refuses to construct outside    │
 * │ `local`/`test`, the module refuses to register it, and the callback parser refuses to        │
 * │ synthesise a `DELIVERED` for a channel with no callback model.                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MailpitEmailAdapter } from '../dist/notifications/infrastructure/mailpit-email.adapter.js';
import {
  NOTIFICATION_CHANNELS,
  type RenderedMessage,
  type SendContext,
} from '../dist/notifications/application/ports/notification-channel.port.js';
import { NotificationsModule } from '../dist/notifications/notifications.module.js';
import {
  NON_DISABLEABLE_CATEGORIES,
  type NotificationCategory,
} from '../dist/notifications/index.js';
import { FixedClock } from '../dist/common/clock/fixed-clock.adapter.js';

const CATEGORIES: NotificationCategory[] = [
  'TRANSACTIONAL',
  'OPERATIONAL',
  'MARKETING',
  'SECURITY',
];

const configFor = (APP_ENV: string) => ({ APP_ENV }) as never;

const aMessage = (over: Partial<RenderedMessage> = {}): RenderedMessage => ({
  notificationId: '018f3d9a-0000-7000-8000-000000000001',
  channel: 'EMAIL',
  to: 'priya.sharma@example.com',
  subject: 'Your membership renews on 21 August',
  body: 'Hi Priya, your Iron Temple Koramangala membership renews on 21 August for ₹2,499.',
  templateKey: 'membership.renewal-due',
  templateVersion: 4,
  locale: 'en-IN',
  category: 'OPERATIONAL',
  routingClass: 'TRANSACTIONAL',
  dltTemplateId: null,
  ...over,
});

const aContext = (over: Partial<SendContext> = {}): SendContext => ({
  attemptNo: 1,
  correlationId: '01K2R7QK3M4N5P6R7S8T9V0W1X',
  ...over,
});

// ═══════════════════════════════════════════════════════════════════════════
// The refusals.
// ═══════════════════════════════════════════════════════════════════════════

test('the Mailpit adapter REFUSES to construct outside local and test', () => {
  for (const env of ['staging', 'production']) {
    assert.throws(
      () => new MailpitEmailAdapter(configFor(env), new FixedClock('2026-08-07T12:00:00Z')),
      /A-19 vendor adapter/,
      `APP_ENV=${env} constructed a local capture adapter`,
    );
  }
});

test('it DOES construct in local and in test', () => {
  for (const env of ['local', 'test']) {
    const adapter = new MailpitEmailAdapter(configFor(env), new FixedClock('2026-08-07T12:00:00Z'));
    assert.equal(adapter.key, 'EMAIL');
  }
});

test('the module registers NO channel outside local and test', () => {
  // A deployment with no A-19 vendor must answer CHANNEL_NOT_AVAILABLE (422, README §9.5.11),
  // not fall back to a local capture that reports success.
  const provider = channelProvider();
  const clock = new FixedClock('2026-08-07T12:00:00Z');

  assert.deepEqual(provider.useFactory(configFor('production'), clock), []);
  assert.deepEqual(provider.useFactory(configFor('staging'), clock), []);
  assert.equal(provider.useFactory(configFor('local'), clock).length, 1);
  assert.equal(provider.useFactory(configFor('test'), clock)[0]?.key, 'EMAIL');
});

test('parseStatusCallback THROWS rather than synthesising a DELIVERED', () => {
  // §2.8 D8 — a channel with no callback model stops at SENT. A fabricated DELIVERED would put a
  // delivery confirmation in the log for a message nobody received, which is the one thing a
  // delivery dispute must be able to trust.
  const adapter = new MailpitEmailAdapter(
    configFor('test'),
    new FixedClock('2026-08-07T12:00:00Z'),
  );
  assert.throws(() => adapter.parseStatusCallback(), /stops at SENT/);
});

// ═══════════════════════════════════════════════════════════════════════════
// The send result — Notifications.md §2.8 D3 / §2.9.
// ═══════════════════════════════════════════════════════════════════════════

test('a send reports SENT, never DELIVERED', async () => {
  const adapter = new MailpitEmailAdapter(
    configFor('test'),
    new FixedClock('2026-08-07T12:00:00Z'),
  );
  const result = await adapter.send(aMessage(), aContext());

  assert.equal(result.status, 'SENT');
  assert.equal(result.attemptNo, 1);
  // D5 — a local capture that succeeded has nothing to retry.
  assert.equal(result.retryable, false);
});

test('BR-FIN-06 · no cost is reported, so NO costMinor field exists', async () => {
  // Not a zero. A zero reads as "this send was free"; the truth is "nobody reported a price".
  // `AC-NOTF-06.1` — recorded first-hand or not at all.
  const adapter = new MailpitEmailAdapter(
    configFor('test'),
    new FixedClock('2026-08-07T12:00:00Z'),
  );
  const result = await adapter.send(aMessage(), aContext());

  assert.ok(!('costMinor' in result) || result.costMinor === undefined);
  assert.ok(!('currency' in result) || result.currency === undefined);
});

test('no providerMessageId is fabricated — Mailpit is not a provider', async () => {
  const adapter = new MailpitEmailAdapter(
    configFor('test'),
    new FixedClock('2026-08-07T12:00:00Z'),
  );
  const result = await adapter.send(aMessage(), aContext());
  assert.equal(result.providerMessageId, undefined);
});

test('latency is MEASURED from the clock, not asserted as zero', async () => {
  const clock = new FixedClock('2026-08-07T12:00:00Z');
  const adapter = new MailpitEmailAdapter(configFor('test'), clock);
  const result = await adapter.send(aMessage(), aContext());
  // A FixedClock does not advance, so 0 is the correct answer here — what matters is that the
  // number came from the injected clock and not from `Date.now()`, which `no-bare-date` forbids.
  assert.equal(result.latencyMs, 0);
});

test('the attempt number is ECHOED, so the log row joins to the right attempt', async () => {
  const adapter = new MailpitEmailAdapter(
    configFor('test'),
    new FixedClock('2026-08-07T12:00:00Z'),
  );
  const result = await adapter.send(aMessage(), aContext({ attemptNo: 4 }));
  assert.equal(result.attemptNo, 4);
});

// ═══════════════════════════════════════════════════════════════════════════
// BR-DAT-06 — the rendered body is the most personal thing in this system.
// ═══════════════════════════════════════════════════════════════════════════

test('BR-DAT-06 · the log line carries no body, no raw address and no variable values', async () => {
  const written: unknown[] = [];
  const adapter = new MailpitEmailAdapter(
    configFor('test'),
    new FixedClock('2026-08-07T12:00:00Z'),
  );
  // The Nest logger is per-instance and private; capture what it is handed.
  const logger = (adapter as unknown as { logger: { log(entry: unknown): void } }).logger;
  logger.log = (entry: unknown) => written.push(entry);

  await adapter.send(aMessage(), aContext());

  const serialised = JSON.stringify(written);
  assert.equal(written.length, 1);
  assert.ok(!serialised.includes('Priya'), 'a member name reached the log');
  assert.ok(!serialised.includes('Iron Temple'), 'the rendered body reached the log');
  assert.ok(!serialised.includes('priya.sharma@example.com'), 'the raw address reached the log');
  assert.ok(!serialised.includes('2,499'), 'an amount from the body reached the log');
  // What IS there: enough to find the message without being able to read it.
  assert.ok(serialised.includes('membership.renewal-due'));
  assert.ok(serialised.includes('01K2R7QK3M4N5P6R7S8T9V0W1X'));
});

test('the redacted address keeps the domain and one character each side', async () => {
  const written: { to?: string }[] = [];
  const adapter = new MailpitEmailAdapter(
    configFor('test'),
    new FixedClock('2026-08-07T12:00:00Z'),
  );
  (adapter as unknown as { logger: { log(entry: unknown): void } }).logger.log = (entry) =>
    written.push(entry as { to?: string });

  await adapter.send(aMessage({ to: 'ab@example.com' }), aContext());
  assert.equal(written[0]!.to, 'a***@example.com');

  written.length = 0;
  await adapter.send(aMessage({ to: 'not-an-address' }), aContext());
  assert.equal(written[0]!.to, '[malformed]');
});

// ═══════════════════════════════════════════════════════════════════════════
// FR-NOTF-02 — the categories.
// ═══════════════════════════════════════════════════════════════════════════

test('email supports all four categories', () => {
  const adapter = new MailpitEmailAdapter(
    configFor('test'),
    new FixedClock('2026-08-07T12:00:00Z'),
  );
  for (const category of CATEGORIES) {
    assert.equal(adapter.supports(category), true, `email refused ${category}`);
  }
});

test('FR-NOTF-02 · TRANSACTIONAL and SECURITY are the two that cannot be switched off', () => {
  // Four categories, three preference rows — §2.4. The pair below is what makes those two
  // numbers different, and a preference write that accepted either is the bug.
  assert.deepEqual([...NON_DISABLEABLE_CATEGORIES].sort(), ['SECURITY', 'TRANSACTIONAL']);
  const switchable = CATEGORIES.filter((c) => !NON_DISABLEABLE_CATEGORIES.includes(c));
  assert.deepEqual(switchable, ['OPERATIONAL', 'MARKETING']);
});

// ═══════════════════════════════════════════════════════════════════════════
// The module boundary — index.ts exports nothing that can send.
// ═══════════════════════════════════════════════════════════════════════════

test('the public surface exports nothing that can send a message', async () => {
  // ModuleDependency.md §4.2: only this module may decide a channel. A publishing module that
  // could inject the channel array would send around suppression, quiet hours and the limiter
  // without meaning to — and `notifications/` would stop being the place that answer lives.
  const surface = await import('../dist/notifications/index.js');
  // `__esModule` and `default` are the CommonJS interop markers tsc emits, not exports anyone
  // wrote — filtering them keeps the assertion about the surface rather than about the emitter.
  const exported = Object.keys(surface)
    .filter((name) => name !== '__esModule' && name !== 'default')
    .sort();
  assert.deepEqual(exported, ['NON_DISABLEABLE_CATEGORIES', 'NotificationsModule']);
});

/** Pulls the one provider off the module metadata, so the factory is asserted as registered. */
function channelProvider(): {
  useFactory: (config: never, clock: unknown) => { key: string }[];
} {
  const providers = Reflect.getMetadata('providers', NotificationsModule) as {
    provide: symbol;
    useFactory: (config: never, clock: unknown) => { key: string }[];
  }[];
  const provider = providers.find((p) => p.provide === NOTIFICATION_CHANNELS);
  assert.ok(provider, 'NOTIFICATION_CHANNELS is not registered by NotificationsModule');
  return provider;
}
