/**
 * M-018 · `notifications/types` — §8.1 row 17.
 *
 * The three notification enumerations, kept here rather than in `packages/types` for now.
 * `PROJECT_CONSTITUTION.md` §724 lists `NotificationChannel` and `NotificationCategory` among the
 * shared types, and they will move there when a client needs them — which is EP-17, not Sprint 0.
 * Declaring them in the shared package before any client imports them would put two definitions
 * in play with nothing asserting they agree.
 */

/**
 * The four channels. `Notifications.md` §2.9 and `PROJECT_CONSTITUTION.md` §1313 agree on the set.
 *
 * `PUSH`, not `WEB_PUSH`: both documents name it `PUSH`, and the channel is the *concept*, not the
 * transport. A native push transport in Phase 2 is a second adapter behind the same key, not a
 * fifth channel that every preference row and every template would have to learn about.
 */
export type NotificationChannelKey = 'EMAIL' | 'SMS' | 'IN_APP' | 'PUSH';

/**
 * The four categories of `Notifications.md` §2.4 — "the four categories, and which two the API can
 * never disable".
 *
 * `FR-NOTF-02` and `Epic_17.md` §1 both say *three*, and both are talking about the PREFERENCE
 * MATRIX, which has a row per switchable category. `TRANSACTIONAL` and `SECURITY` have no row
 * because they cannot be switched off — §2.4's point exactly. Four values, three rows.
 */
export type NotificationCategory = 'TRANSACTIONAL' | 'OPERATIONAL' | 'MARKETING' | 'SECURITY';

/** Which two of the four a preference write may never disable — `FR-NOTF-02`, `AC-USER-01.2`. */
export const NON_DISABLEABLE_CATEGORIES: readonly NotificationCategory[] = [
  'TRANSACTIONAL',
  'SECURITY',
];

/**
 * The template's regulatory classification, distinct from the send's category — `Notifications.md`
 * §3.6, `ERD.md` §12.5.
 *
 * Conflating the two IS the compliance failure §3.6 is written to prevent. A `BR-MEM-11` renewal
 * reminder is `OPERATIONAL` by category (a member may switch it off) and `TRANSACTIONAL` by
 * routing class (it reaches a DND-registered number). One value cannot carry both answers.
 */
export type RoutingClass = 'TRANSACTIONAL' | 'PROMOTIONAL';

/**
 * The NORMALISED platform delivery status — `Notifications.md` §2.8 D7, `Schema.md` §2.
 *
 * Never a provider's vocabulary. Mapping is the adapter's job, exactly as the payment adapter maps
 * a gateway's statuses (`README.md` §14.4). A log holding seven providers' seven spellings of
 * "bounced" cannot answer a delivery dispute.
 */
export type NotificationDeliveryStatus =
  'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED' | 'SUPPRESSED';
