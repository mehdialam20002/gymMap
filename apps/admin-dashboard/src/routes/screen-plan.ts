/**
 * What each unbuilt admin screen will hold — `MASTER_PRD.md` §B8, as data.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY A SPECIFICATION AND NOT A PLACEHOLDER
 *
 * These eleven screens had one generic panel between them: the screen id and a milestone. That is
 * accurate and it tells an operator nothing — "SCR-ADM-009, M-104" answers neither *what will this
 * do* nor *why can it not do it yet*, which are the only two questions anybody has when they land
 * on an unfinished page.
 *
 * So each screen carries its own §B8 `Content` row, VERBATIM, plus the columns and filters that row
 * names, plus what it is actually blocked on. The column headers are real and are drawn empty;
 * nothing invents a row. A reader gets the shape of the screen and an honest account of the gap.
 *
 *   The columns are what the screen WILL show. The absence is what it shows today.
 *
 * The alternative — fabricating rows behind a "sample" banner — is what the dashboard does for
 * revenue, and it is defensible there because a made-up figure beside a labelled banner costs
 * nothing. It is not defensible for a settlement run or a dispute deadline: those are instructions
 * to move money, and a screenshot of an invented payout is a document somebody will quote.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ EVERY `blockedOn` IS A REAL IDENTIFIER, AND SOME ARE NOT MILESTONES ────────────────────────┐
 * │ A screen waiting on a table cites the milestone that builds it. A screen waiting on a DECISION │
 * │ cites the open question or known limitation instead — `KL-006` for commission, `BLK-04` for    │
 * │ tax. The distinction matters to whoever reads this next: one of those unblocks by writing      │
 * │ code, and the other cannot be unblocked by writing code at all.                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import type { MessageKey } from '../shared/i18n/index.ts';

export interface ScreenPlan {
  /**
   * `SCR-ADM-*`, or ABSENT.
   *
   * ┌─ ABSENT IS CORRECT FOR SEVEN OF THESE, AND A TEST HOLDS IT THAT WAY ──────────────────────┐
   * │ `§B3` numbers FIFTEEN admin screens. `SCR-ADM-011` is one of them and is held by Categories │
   * │ & amenities. The seven configuration pages are real destinations that `§B3` does not number, │
   * │ and giving them `SCR-ADM-011` too — as this file first did — would have made the id appear   │
   * │ eight times and broken the exactly-once assertion the route table depends on.                │
   * │                                                                                            │
   * │ So a plan's `screen` must match its nav entry's, including when both are absent.             │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  readonly screen?: string;
  readonly titleKey: MessageKey;
  /** §B8's `Content` row, quoted. The single most useful sentence about the screen. */
  readonly contentKey: MessageKey;
  /**
   * The columns §B8 names, in its order.
   *
   * Drawn as real headers over an empty body. An operator seeing `Deadline` on the disputes screen
   * learns that deadlines are tracked, which is most of what they wanted to know.
   */
  readonly columnKeys: readonly MessageKey[];
  /** The filters §B8 names. Rendered inert. Empty where §B8 names none. */
  readonly filterKeys: readonly MessageKey[];
  /**
   * What it waits on. `M-*` for a table, `KL-*`/`BLK-*` for a decision.
   *
   * More than one is normal: a refund screen needs the ledger AND an answer about the refund window.
   */
  readonly blockedOn: readonly string[];
  /** One sentence naming the consequence of the gap, where there is a non-obvious one. */
  readonly noteKey?: MessageKey;
}

/**
 * Keyed by route path, so the router looks a screen up by where the operator already is.
 *
 * `SCR-ADM-011`'s seven configuration screens share one §B8 row and are listed here individually,
 * because they are seven routes in the navigation and a reader on the Tax page is not helped by a
 * description of the Commission page.
 */
export const SCREEN_PLANS: Readonly<Record<string, ScreenPlan>> = {
  '/categories': {
    screen: 'SCR-ADM-011',
    titleKey: 'adm.chrome.nav.categories',
    contentKey: 'adm.plan.taxonomy.content',
    columnKeys: ['adm.plan.col.name', 'adm.plan.col.kind', 'adm.plan.col.usage', 'adm.plan.col.status'],
    filterKeys: ['adm.plan.filter.kind', 'adm.plan.filter.search'],
    blockedOn: ['M-025'],
    noteKey: 'adm.plan.taxonomy.note',
  },

  '/finance/orders': {
    screen: 'SCR-ADM-006',
    titleKey: 'adm.chrome.nav.orders',
    contentKey: 'adm.plan.orders.content',
    columnKeys: [
      'adm.plan.col.order',
      'adm.plan.col.member',
      'adm.plan.col.gym',
      'adm.plan.col.amount',
      'adm.plan.col.gatewayState',
      'adm.plan.col.providerRef',
      'adm.plan.col.failureReason',
      'adm.plan.col.placedAt',
    ],
    filterKeys: [
      'adm.plan.filter.state',
      'adm.plan.filter.tenant',
      'adm.plan.filter.date',
      'adm.plan.filter.amount',
    ],
    blockedOn: ['M-096'],
    noteKey: 'adm.plan.orders.note',
  },

  '/finance/settlements': {
    screen: 'SCR-ADM-007',
    titleKey: 'adm.chrome.nav.settlements',
    contentKey: 'adm.plan.settlements.content',
    columnKeys: [
      'adm.plan.col.cycle',
      'adm.plan.col.gym',
      'adm.plan.col.batchTotal',
      'adm.plan.col.status',
      'adm.plan.col.payoutState',
    ],
    filterKeys: ['adm.plan.filter.cycle', 'adm.plan.filter.status', 'adm.plan.filter.tenant'],
    blockedOn: ['M-100', 'OQ-04'],
    noteKey: 'adm.plan.settlements.note',
  },

  '/finance/refunds': {
    screen: 'SCR-ADM-008',
    titleKey: 'adm.chrome.nav.refunds',
    contentKey: 'adm.plan.refunds.content',
    columnKeys: [
      'adm.plan.col.age',
      'adm.plan.col.amount',
      'adm.plan.col.usage',
      'adm.plan.col.policyPosition',
      'adm.plan.col.gym',
      'adm.plan.col.requester',
    ],
    filterKeys: ['adm.plan.filter.status', 'adm.plan.filter.tenant', 'adm.plan.filter.date'],
    blockedOn: ['M-103'],
    noteKey: 'adm.plan.refunds.note',
  },

  '/finance/disputes': {
    screen: 'SCR-ADM-009',
    titleKey: 'adm.chrome.nav.disputes',
    contentKey: 'adm.plan.disputes.content',
    columnKeys: [
      'adm.plan.col.deadline',
      'adm.plan.col.case',
      'adm.plan.col.gym',
      'adm.plan.col.amount',
      'adm.plan.col.holdStatus',
      'adm.plan.col.outcome',
    ],
    filterKeys: ['adm.plan.filter.status', 'adm.plan.filter.deadline'],
    blockedOn: ['M-105'],
    noteKey: 'adm.plan.disputes.note',
  },

  '/finance/reconciliation': {
    screen: 'SCR-ADM-010',
    titleKey: 'adm.chrome.nav.reconciliation',
    contentKey: 'adm.plan.reconciliation.content',
    columnKeys: [
      'adm.plan.col.day',
      'adm.plan.col.gatewayTotal',
      'adm.plan.col.ledgerTotal',
      'adm.plan.col.variance',
      'adm.plan.col.resolution',
    ],
    filterKeys: ['adm.plan.filter.date', 'adm.plan.filter.varianceOnly'],
    blockedOn: ['M-107'],
    noteKey: 'adm.plan.reconciliation.note',
  },

  '/moderation': {
    screen: 'SCR-ADM-012',
    titleKey: 'adm.chrome.nav.moderation',
    contentKey: 'adm.plan.moderation.content',
    columnKeys: [
      'adm.plan.col.signal',
      'adm.plan.col.review',
      'adm.plan.col.gym',
      'adm.plan.col.reviewerHistory',
      'adm.plan.col.age',
    ],
    filterKeys: ['adm.plan.filter.queue', 'adm.plan.filter.signal'],
    blockedOn: ['M-084'],
    noteKey: 'adm.plan.moderation.note',
  },

  '/support': {
    screen: 'SCR-ADM-013',
    titleKey: 'adm.chrome.nav.support',
    contentKey: 'adm.plan.support.content',
    columnKeys: [
      'adm.plan.col.priority',
      'adm.plan.col.sla',
      'adm.plan.col.subject',
      'adm.plan.col.member',
      'adm.plan.col.assignee',
      'adm.plan.col.age',
    ],
    filterKeys: ['adm.plan.filter.priority', 'adm.plan.filter.assignee', 'adm.plan.filter.status'],
    blockedOn: ['M-110', 'OQ-19'],
    noteKey: 'adm.plan.support.note',
  },

  '/analytics': {
    screen: 'SCR-ADM-014',
    titleKey: 'adm.chrome.nav.analytics',
    contentKey: 'adm.plan.analytics.content',
    columnKeys: [],
    filterKeys: ['adm.plan.filter.city', 'adm.plan.filter.tier', 'adm.plan.filter.cohort'],
    blockedOn: ['M-112'],
    noteKey: 'adm.plan.analytics.note',
  },

  '/audit': {
    screen: 'SCR-ADM-015',
    titleKey: 'adm.chrome.nav.audit',
    contentKey: 'adm.plan.audit.content',
    columnKeys: [
      'adm.plan.col.at',
      'adm.plan.col.actor',
      'adm.plan.col.action',
      'adm.plan.col.entity',
      'adm.plan.col.impersonated',
      'adm.plan.col.diff',
    ],
    filterKeys: [
      'adm.plan.filter.actor',
      'adm.plan.filter.entityType',
      'adm.plan.filter.action',
      'adm.plan.filter.date',
      'adm.plan.filter.impersonation',
    ],
    // The TABLE exists — `M-013` built `audit_log` and the append-only writer. What is missing is
    // the search endpoint and the before/after diff, which is a smaller gap than the others here
    // and worth saying so rather than filing it with the screens that have no data at all.
    blockedOn: ['M-117'],
    noteKey: 'adm.plan.audit.note',
  },

  '/config/commission': {
    titleKey: 'adm.chrome.nav.commission',
    contentKey: 'adm.plan.commission.content',
    columnKeys: [
      'adm.plan.col.scope',
      'adm.plan.col.rate',
      'adm.plan.col.source',
      'adm.plan.col.validity',
      'adm.plan.col.setBy',
    ],
    filterKeys: ['adm.plan.filter.scope'],
    blockedOn: ['M-098', 'KL-006'],
    noteKey: 'adm.plan.commission.note',
  },

  '/config/subscriptions': {
    titleKey: 'adm.chrome.nav.subscriptions',
    contentKey: 'adm.plan.subscriptions.content',
    columnKeys: [
      'adm.plan.col.tier',
      'adm.plan.col.price',
      'adm.plan.col.limits',
      'adm.plan.col.tenants',
    ],
    filterKeys: [],
    blockedOn: ['M-099', 'OQ-03'],
    noteKey: 'adm.plan.subscriptions.note',
  },

  '/config/tax': {
    titleKey: 'adm.chrome.nav.tax',
    contentKey: 'adm.plan.tax.content',
    columnKeys: ['adm.plan.col.profile', 'adm.plan.col.rate', 'adm.plan.col.appliesTo'],
    filterKeys: [],
    // Blocked on ADVICE, not code. This is the one screen where shipping a guess has a legal cost.
    blockedOn: ['BLK-04'],
    noteKey: 'adm.plan.tax.note',
  },

  '/config/kyc': {
    titleKey: 'adm.chrome.nav.kyc',
    contentKey: 'adm.plan.kyc.content',
    columnKeys: [
      'adm.plan.col.version',
      'adm.plan.col.entityType',
      'adm.plan.col.requirements',
      'adm.plan.col.status',
    ],
    filterKeys: ['adm.plan.filter.entityType'],
    blockedOn: ['M-029'],
    noteKey: 'adm.plan.kyc.note',
  },

  '/config/flags': {
    titleKey: 'adm.chrome.nav.flags',
    contentKey: 'adm.plan.flags.content',
    columnKeys: [
      'adm.plan.col.flag',
      'adm.plan.col.rollout',
      'adm.plan.col.scope',
      'adm.plan.col.changedBy',
    ],
    filterKeys: ['adm.plan.filter.scope'],
    blockedOn: ['M-111'],
    noteKey: 'adm.plan.flags.note',
  },

  '/config/notifications': {
    titleKey: 'adm.chrome.nav.notifications',
    contentKey: 'adm.plan.notifications.content',
    columnKeys: [
      'adm.plan.col.template',
      'adm.plan.col.channel',
      'adm.plan.col.locale',
      'adm.plan.col.status',
    ],
    filterKeys: ['adm.plan.filter.channel'],
    // A-19 leaves the vendors open, so there is no channel to render a template for.
    blockedOn: ['M-088', 'A-19'],
    noteKey: 'adm.plan.notifications.note',
  },

  '/settings': {
    titleKey: 'adm.chrome.nav.settings',
    contentKey: 'adm.plan.settings.content',
    columnKeys: [],
    filterKeys: [],
    blockedOn: ['M-111'],
  },
};
