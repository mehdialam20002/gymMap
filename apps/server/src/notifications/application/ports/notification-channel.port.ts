/**
 * `NotificationChannel` — the one `EP-17 F-17.1` outbound port. `A-19` is `DEFERRED`.
 *
 * ┌─ ONE INTERFACE, FOUR KEYS — NOT FOUR INTERFACES ────────────────────────────────────────────┐
 * │ `PROJECT_CONSTITUTION.md` §1295 uses this exact port as its Open/Closed worked example, and │
 * │ the thing it is arguing against is a `dispatch()` with an if-chain over the channel. Four    │
 * │ separate interfaces reproduce that: the dispatcher has to know which of four to inject, so   │
 * │ adding WhatsApp in Phase 2 edits the dispatcher and retests the OTP path (`FR-AUTH-05`)      │
 * │ that has nothing to do with WhatsApp.                                                        │
 * │                                                                                              │
 * │ One interface with a `key` means the dispatcher holds an ARRAY and filters it. Adding a      │
 * │ channel is a new file plus one line in `notifications.module.ts`, and no use case changes.  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHERE THIS FILE LIVES, AND WHY IT MOVED ───────────────────────────────────────────────────┐
 * │ Three documents name a path for it and they do not agree:                                    │
 * │                                                                                              │
 * │   `PROJECT_CONSTITUTION.md` §1311   notifications/application/ports/notification-channel…   │
 * │   `apis/Notifications.md` §2.9      src/modules/notifications/ports/notification-channel…   │
 * │   `roadmap/Milestones_000-029.md`   notifications/ports/{email,sms,in-app,web-push}.channel… │
 * │                                                                                              │
 * │ Precedence (`CLAUDE.md` §2) resolves it without a judgement call: the constitution outranks  │
 * │ the API spec, which outranks the roadmap — and the roadmap "is a plan of work, never a       │
 * │ source of requirements". So: `application/ports/`, one file, the constitution's name. That   │
 * │ is also what `FolderStructure.md` §8.1 row 7 requires of an OUTBOUND dependency, and         │
 * │ `Notifications.md`'s `src/modules/` prefix does not exist in this repository at all.         │
 * │                                                                                              │
 * │ The SHAPE is `Notifications.md`'s, which is strictly richer and not in conflict: the         │
 * │ constitution sketches `key` and `supports()` while making a SOLID argument, §2.9 specifies   │
 * │ the result record the delivery log needs (§2.8 D3) and the callback and DLT members. Both    │
 * │ members are kept.                                                                             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ PORTS NOW, VENDORS LATER ──────────────────────────────────────────────────────────────────┐
 * │ `A-19` is `DEFERRED` on `OQ-01`, deadline Sprint 12 (`TR-13`). The India SMS path            │
 * │ additionally needs TRAI DLT registration, which is calendar time on a regulator's timetable  │
 * │ and cannot be hurried by writing code.                                                        │
 * │                                                                                              │
 * │ The port is not blocked by any of that, and defining it now is what lets nine sprints of     │
 * │ feature work exercise it before a contract is signed (`T-17.03`). A channel with no adapter  │
 * │ is answered with `CHANNEL_NOT_AVAILABLE` (422) — registered against exactly this situation   │
 * │ in `README.md` §9.5.11 — never with a stub that reports success. A notification silently not │
 * │ arriving is the failure this subsystem exists to prevent, and a stub reproduces it precisely │
 * │ while turning the logs green.                                                                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import type {
  NotificationCategory,
  NotificationChannelKey,
  NotificationDeliveryStatus,
  RoutingClass,
} from '../../types/index.js';

/** Injection token for the array of every channel that has an adapter in this environment. */
export const NOTIFICATION_CHANNELS = Symbol('NotificationChannels');

/**
 * A message that is READY TO SEND. The adapter renders nothing — `Notifications.md` §2.9.
 *
 * Rendering inside an adapter would put the template engine behind the vendor boundary, so the
 * same template would produce a different body per vendor and the preview screen (`FR-NOTF-03`)
 * would show neither. The dispatcher resolves the latest `APPROVED` template version, renders,
 * and hands the result across.
 */
export interface RenderedMessage {
  /** `notification_log.id`. The adapter echoes nothing back that cannot be joined to this. */
  readonly notificationId: string;
  readonly channel: NotificationChannelKey;
  /** The RESOLVED destination — an address, an E.164 number, a user id, a push endpoint. */
  readonly to: string;
  /** Email only. `null` on every other channel rather than an empty string. */
  readonly subject: string | null;
  /** Already rendered. See above. */
  readonly body: string;
  readonly templateKey: string;
  /** The version actually used, not the latest — `M-112` AC 4. Recorded on the log row. */
  readonly templateVersion: number;
  readonly locale: string;
  /** A property of this SEND. Governs preference, quiet hours and the limiter (§3.6). */
  readonly category: NotificationCategory;
  /** A property of the TEMPLATE. Governs which SMS rail and whether DND blocks it (§3.6). */
  readonly routingClass: RoutingClass;
  /**
   * India SMS only: the DLT-approved template id the carrier requires on the wire.
   *
   * TRAI makes this a legal requirement, not an implementation choice — an SMS on an unregistered
   * template is REJECTED BY THE CARRIER. `null` on every other channel.
   */
  readonly dltTemplateId: string | null;
}

/** What the adapter needs that is not part of the message. */
export interface SendContext {
  /** 1-based. `Notifications.md` §2.8 D3 — every attempt writes its own record. */
  readonly attemptNo: number;
  /** Carried onto the provider request where the provider supports it, so a trace survives. */
  readonly correlationId: string;
}

/**
 * The NORMALISED result of one attempt — `Notifications.md` §2.9, feeding the §2.8 D3 record.
 *
 * A boolean would not do. "Did the message arrive" is asked days later by a support agent holding
 * a member's complaint, and it is unanswerable without the id the provider knows the message by.
 */
export interface ChannelSendResult {
  readonly attemptNo: number;
  /** Never `DELIVERED` — that arrives on a status callback, not on the send (§2.8 D8). */
  readonly status: Extract<NotificationDeliveryStatus, 'SENT' | 'FAILED' | 'BOUNCED'>;
  readonly providerMessageId?: string;
  /** The provider's own code, for the log. NEVER rendered to a user — `ER6`. */
  readonly providerCode?: string;
  /**
   * `Notifications.md` §2.8 D5 — the ADAPTER decides, the dispatcher obeys.
   *
   * A 4xx-class rejection is not retryable: a malformed address or an unregistered DLT id fails
   * identically six times and then lands in the poison path nine hours late. Only the adapter
   * knows which of its provider's codes mean that, which is why this is not the dispatcher's call.
   */
  readonly retryable: boolean;
  /**
   * Integer minor units, recorded FIRST-HAND at send — `FR-NOTF-08`, `AC-NOTF-06.1`.
   *
   * `BR-FIN-06`'s discipline applied outside the money path: recorded only as reported. A provider
   * that reports no cost yields `undefined` here and NO `cost_minor` on the log row — never a
   * zero, which would read as "this send was free".
   */
  readonly costMinor?: bigint;
  /** ISO 4217, present exactly when `costMinor` is. */
  readonly currency?: string;
  readonly latencyMs: number;
}

/** A normalised provider status callback — `Notifications.md` §2.8 D8, `T-17.37`. */
export interface ChannelStatusEvent {
  readonly providerMessageId: string;
  readonly status: NotificationDeliveryStatus;
  readonly occurredAt: Date;
  readonly providerCode?: string;
}

export interface NotificationChannel {
  readonly key: NotificationChannelKey;

  /**
   * `FR-NOTF-02`. Whether this channel may carry this category at all.
   *
   * Distinct from the recipient's preference, which the dispatcher evaluates per message at gate 6
   * — this is the channel's own capability, and it is why a marketing push and a security SMS do
   * not need two dispatchers.
   */
  supports(category: NotificationCategory): boolean;

  send(message: RenderedMessage, context: SendContext): Promise<ChannelSendResult>;

  /**
   * Verifies and normalises a provider status callback. Signature-verified like a webhook
   * (`README.md` §14).
   *
   * A channel with no callback model THROWS rather than returning a fabricated `DELIVERED`:
   * §2.8 D8 says such a channel stops at `SENT`, and the delivery log states that rather than
   * implying it.
   */
  parseStatusCallback(
    rawBody: Buffer,
    headers: Readonly<Record<string, string>>,
  ): ChannelStatusEvent;

  /** India, SMS only: the DLT entity and header the operator requires on the wire. */
  dltBinding?(): { entityId: string; headerId: string };
}
