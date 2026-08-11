/**
 * SAMPLE figures — illustrative, labelled on screen, and replaced by one fetch each.
 *
 * ┌─ WHY THIS FILE IS ALLOWED TO EXIST ─────────────────────────────────────────────────────────┐
 * │ Revenue, orders, settlements and moderation alerts have no tables until M-096…M-115. The    │
 * │ console still has to be shown to people, and a dashboard with four tiles and three empty    │
 * │ rectangles demonstrates nothing about the product.                                           │
 * │                                                                                              │
 * │ So these are sample figures, and the screen SAYS SO — `SampleNotice` renders above every     │
 * │ panel fed from here. That banner is not decoration and must not be removed for a            │
 * │ screenshot: it is the entire reason inventing these numbers is honest rather than           │
 * │ misleading. The same arrangement already governs the customer website's gym catalogue.       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS NOT IN HERE ───────────────────────────────────────────────────────────────────────┐
 * │ Anything that IS real. Gym counts, the approval pipeline, account totals, active sessions   │
 * │ and dependency health all come from `/v1/admin/platform/*` and are never mixed into these   │
 * │ structures — a panel is fed from one source or the other, never both, so "is this real?"    │
 * │ always has a per-panel answer.                                                               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ EVERY AMOUNT IS INTEGER PAISE ─────────────────────────────────────────────────────────────┐
 * │ Invariant 2, and it applies to a fixture exactly as it applies to the ledger. A sample file │
 * │ is precisely where `48749.32` slips in and teaches the component above it to expect rupees; │
 * │ that component is then wrong against the real endpoint, in a way that rounds silently.      │
 * │ `48_74_932_00` is ₹48,74,932.                                                                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Deliberately uneven. Two of the six headline figures are DOWN, the revenue series has a dip in
 * the third week, and the order list mixes four statuses. A sample where every arrow is green
 * proves nothing about the screen that renders it, and reads as invented on sight.
 */

/** Rendered above every panel fed from this file. */
export const SAMPLE_NOTICE_KEY = 'adm.sample.notice' as const;

import { formatIndianRupees, indianAmountParts, percentStringFromBps } from '@gymmap/utils';

export interface HeadlineFigure {
  readonly key: string;
  /** Integer paise, or `null` when the figure is a count rather than money. */
  readonly amountMinor: bigint | null;
  readonly count: number | null;
  /** Basis points of change. 1860 = +18.60%. Integer, same discipline as money. */
  readonly deltaBps: number;
  readonly comparison: 'THIRTY_DAYS' | 'YESTERDAY';
  readonly tone: 'brand' | 'success' | 'warning' | 'danger' | 'info';
}

export const HEADLINES: readonly HeadlineFigure[] = [
  {
    key: 'adm.sample.totalRevenue',
    amountMinor: 48_74_932_00n,
    count: null,
    deltaBps: 1860,
    comparison: 'THIRTY_DAYS',
    tone: 'brand',
  },
  {
    key: 'adm.sample.todayRevenue',
    amountMinor: 3_45_678_00n,
    count: null,
    deltaBps: 1240,
    comparison: 'YESTERDAY',
    tone: 'success',
  },
  {
    key: 'adm.sample.commission',
    amountMinor: 7_32_489_00n,
    count: null,
    deltaBps: 1630,
    comparison: 'THIRTY_DAYS',
    tone: 'info',
  },
  {
    key: 'adm.sample.activeMemberships',
    amountMinor: null,
    count: 12_864,
    deltaBps: 980,
    comparison: 'THIRTY_DAYS',
    tone: 'brand',
  },
  {
    key: 'adm.sample.supportTickets',
    amountMinor: null,
    count: 58,
    // Down, and down is GOOD for tickets. The component reads `tone` for the accent and the sign
    // for the arrow; it deliberately does not colour the arrow green or red, because "fewer
    // support tickets" and "less revenue" are the same sign and opposite news.
    deltaBps: -510,
    comparison: 'THIRTY_DAYS',
    tone: 'warning',
  },
  {
    key: 'adm.sample.refundRequests',
    amountMinor: null,
    count: 16,
    deltaBps: -1170,
    comparison: 'THIRTY_DAYS',
    tone: 'danger',
  },
];

/** A point on the revenue series. `label` is the axis tick; paise on the value. */
export interface SeriesPoint {
  readonly label: string;
  readonly valueMinor: bigint;
}

/**
 * `SeriesPoint` is the shape; the series themselves come from `revenueSeries` below.
 *
 * A hand-written `REVENUE_SERIES` constant lived here and was the panel's only line. It went when
 * the panel gained its metric and range controls, because a constant plus a generator is two
 * sources for the same chart and the constant is the one that stops agreeing with the headline.
 */

// ===========================================================================================
// The revenue overview's metric x range series.
//
// +- WHY THIS IS GENERATED AND NOT TWENTY HANDWRITTEN ARRAYS -----------------------------------+
// | Four metrics x four ranges is sixteen series. Handwriting them means sixteen chances for a   |
// | chart to end somewhere its own headline figure does not, and the first person to notice      |
// | would rightly stop trusting the panel rather than the array.                                 |
// |                                                                                             |
// | So every series is DERIVED from the one number the panel already displays: it ends at that   |
// | value and works backwards. Change the headline and the curve follows.                        |
// +---------------------------------------------------------------------------------------------+
//
// +- DETERMINISTIC, WITH NO `Math.random` ANYWHERE ---------------------------------------------+
// | A random walk would redraw on every render, and MO3 forbids exactly that: motion on a data   |
// | path makes a stale figure look live. It would also make a screenshot unreproducible, so two  |
// | people comparing the same demo would be looking at different charts.                          |
// |                                                                                             |
// | The wobble comes from a fixed integer sequence indexed by position, so the same (metric,     |
// | range) always draws the same line. Integer paise throughout -- the arithmetic is bigint and   |
// | the only division is by 10_000n, which is exact.                                              |
// +---------------------------------------------------------------------------------------------+
// ===========================================================================================

export const REVENUE_METRICS = ['REVENUE', 'GMV', 'COMMISSION', 'MEMBERSHIPS'] as const;
export type RevenueMetric = (typeof REVENUE_METRICS)[number];

export const REVENUE_RANGES = ['7D', '30D', '90D', '12M'] as const;
export type RevenueRange = (typeof REVENUE_RANGES)[number];

/** How many points each range draws, and what its ticks are called. */
const RANGE_SHAPE: Readonly<
  Record<RevenueRange, { readonly points: number; readonly tick: (i: number, n: number) => string }>
> = {
  // Days back from "today", which is only a label -- no clock is read here (`no-bare-date`).
  '7D': { points: 7, tick: (i, n) => `D-${String(n - 1 - i)}` },
  '30D': { points: 6, tick: (i, n) => `W-${String(n - 1 - i)}` },
  '90D': { points: 6, tick: (i, n) => `W-${String((n - 1 - i) * 2)}` },
  '12M': { points: 12, tick: (i) => MONTH_TICKS[i] ?? '' },
};

const MONTH_TICKS = [
  'Sep',
  'Oct',
  'Nov',
  'Dec',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
] as const;

/**
 * Where each metric ends, in integer paise -- or in whole units for the count.
 *
 * These are the SAME figures the headline tiles carry, so the chart and the tile above it cannot
 * disagree. GMV is the gross figure revenue is a slice of; it is larger by construction.
 */
const METRIC_END: Readonly<Record<RevenueMetric, bigint>> = {
  REVENUE: 81_90_000_00n,
  GMV: 2_14_60_000_00n,
  COMMISSION: 7_32_489_00n,
  MEMBERSHIPS: 12_864n,
};

/** True when the metric is money and must be rendered by the currency formatter. */
export function isMoneyMetric(metric: RevenueMetric): boolean {
  return metric !== 'MEMBERSHIPS';
}

/**
 * The wobble pattern: a sign per point, fixed and read by index.
 *
 * +- A SIGN PATTERN RATHER THAN FIXED BASIS POINTS, BECAUSE THE FIRST ATTEMPT DID NOT WORK ------+
 * | The first version added a fixed +-1540bps jitter to the trend. It read fine for the 7-day     |
 * | window and produced twelve MONOTONIC series out of sixteen for the longer ones: over twelve   |
 * | months the trend climbs about 7% per step, which simply swallowed a 3% wobble.                 |
 * |                                                                                             |
 * | A monotonically rising sample line is the single clearest sign that a chart is decorative, and |
 * | it also hides whether the renderer copes with a downward segment. So the amplitude is now     |
 * | scaled to the per-step growth of whichever window is being drawn -- 1.5x it -- which makes a   |
 * | `+1 -> -1` transition a 3x-step swing and therefore a fall the eye can see at every range.     |
 * |                                                                                             |
 * | The pattern is a literal, not `Math.random`: MO3 forbids motion on a data path, and a random  |
 * | walk would redraw on every render AND make two people comparing the same demo look at         |
 * | different charts.                                                                            |
 * +---------------------------------------------------------------------------------------------+
 */
const WOBBLE_SIGN: readonly number[] = [0, 1, -1, 1, -1, 1, 1, -1, 1, -1, 1, -1];

export function revenueSeries(metric: RevenueMetric, range: RevenueRange): readonly SeriesPoint[] {
  const shape = RANGE_SHAPE[range];
  const end = METRIC_END[metric];
  const steps = BigInt(shape.points - 1);

  // Total growth across the window, in basis points. A longer window shows more of it -- twelve
  // months of a marketplace's first year is a different story from its last seven days.
  const growthBps = { '7D': 400n, '30D': 1_600n, '90D': 3_400n, '12M': 7_800n }[range];
  const perStepBps = growthBps / steps;

  return Array.from({ length: shape.points }, (_, index) => {
    // How far back this point is, as a fraction of the window, in basis points.
    const backBps = (BigInt(shape.points - 1 - index) * 10_000n) / steps;
    const trend = end - (end * growthBps * backBps) / (10_000n * 10_000n);

    // 1.5x the per-step growth, signed by the pattern. Integer arithmetic throughout; the only
    // division is by 10_000n and by 2n, both exact on paise.
    const wobbleBps = (BigInt(WOBBLE_SIGN[index % WOBBLE_SIGN.length] ?? 0) * perStepBps * 3n) / 2n;
    const value = trend + (trend * wobbleBps) / 10_000n;

    return {
      label: shape.tick(index, shape.points),
      // The last point is pinned to the headline EXACTLY rather than approximately. A chart whose
      // final point sits 0.3% off the number printed beside it is the kind of discrepancy that
      // gets read as a bug in the ledger rather than as rounding in a sample.
      valueMinor: index === shape.points - 1 ? end : value > 0n ? value : end / 4n,
    };
  });
}

export interface BreakdownSlice {
  readonly key: string;
  readonly amountMinor: bigint;
  /** Categorical slot 1-4. Assigned in order and never cycled — see `tokens.css`. */
  readonly slot: 1 | 2 | 3 | 4;
}

/** Four slices. A fifth would fold into "Others" rather than taking a fifth colour. */
export const REVENUE_BREAKDOWN: readonly BreakdownSlice[] = [
  { key: 'adm.sample.marketplaceSales', amountMinor: 33_84_559_00n, slot: 1 },
  { key: 'adm.sample.saasSubscriptions', amountMinor: 9_79_548_00n, slot: 2 },
  { key: 'adm.sample.commissionSlice', amountMinor: 4_24_112_00n, slot: 3 },
  { key: 'adm.sample.others', amountMinor: 86_713_00n, slot: 4 },
];

export interface RegistrationSeries {
  readonly key: string;
  readonly slot: 1 | 2 | 3;
  readonly points: readonly number[];
}

/** Three series over the same five weeks, so one x-axis serves all — never a second scale. */
export const REGISTRATION_LABELS = ['5 Jul', '12 Jul', '19 Jul', '26 Jul', '4 Aug'] as const;

export const REGISTRATIONS: readonly RegistrationSeries[] = [
  { key: 'adm.sample.users', slot: 1, points: [980, 1240, 1180, 1520, 1810] },
  { key: 'adm.sample.gyms', slot: 2, points: [310, 420, 460, 520, 610] },
  { key: 'adm.sample.staff', slot: 3, points: [140, 190, 230, 310, 426] },
];

export interface SampleOrder {
  readonly ref: string;
  readonly member: string;
  readonly gym: string;
  readonly amountMinor: bigint;
  readonly status: 'COMPLETED' | 'PAID' | 'PENDING' | 'REFUNDED';
  readonly minutesAgo: number;
}

/** Realistic Indian names and gym names, matching the fixture catalogue's register. */
export const RECENT_ORDERS: readonly SampleOrder[] = [
  {
    ref: 'ORD-78562',
    member: 'Ravi Sharma',
    gym: 'Iron House Strength Club',
    amountMinor: 2_999_00n,
    status: 'COMPLETED',
    minutesAgo: 2,
  },
  {
    ref: 'ORD-78561',
    member: 'Neha Singh',
    gym: 'Pulse Fitness Koramangala',
    amountMinor: 4_999_00n,
    status: 'COMPLETED',
    minutesAgo: 5,
  },
  {
    ref: 'ORD-78560',
    member: 'Aman Verma',
    gym: 'Apex CrossFit Powai',
    amountMinor: 1_999_00n,
    status: 'PAID',
    minutesAgo: 10,
  },
  {
    ref: 'ORD-78559',
    member: 'Priya Patel',
    gym: 'Harbour Fitness Bandra',
    amountMinor: 3_499_00n,
    status: 'COMPLETED',
    minutesAgo: 15,
  },
  {
    ref: 'ORD-78558',
    member: 'Suresh Kumar',
    gym: 'Capital Strength Saket',
    amountMinor: 2_499_00n,
    status: 'PENDING',
    minutesAgo: 18,
  },
  {
    ref: 'ORD-78557',
    member: 'Fatima Sheikh',
    gym: 'Coastal Swim & Gym',
    amountMinor: 3_999_00n,
    status: 'REFUNDED',
    minutesAgo: 24,
  },
];

export interface SampleAlert {
  readonly key: string;
  readonly detailKey: string;
  readonly severity: 'critical' | 'serious' | 'info' | 'good';
  readonly minutesAgo: number;
}

export const SYSTEM_ALERTS: readonly SampleAlert[] = [
  {
    key: 'adm.sample.alert.refunds',
    detailKey: 'adm.sample.alert.refundsDetail',
    severity: 'serious',
    minutesAgo: 10,
  },
  {
    key: 'adm.sample.alert.payments',
    detailKey: 'adm.sample.alert.paymentsDetail',
    severity: 'critical',
    minutesAgo: 25,
  },
  {
    key: 'adm.sample.alert.kyc',
    detailKey: 'adm.sample.alert.kycDetail',
    severity: 'info',
    minutesAgo: 60,
  },
  {
    key: 'adm.sample.alert.settlement',
    detailKey: 'adm.sample.alert.settlementDetail',
    severity: 'good',
    minutesAgo: 120,
  },
];

/**
 * Integer paise to a rupee string, Indian grouping.
 *
 * ┌─ THE GROUPING COMES FROM `packages/utils`, AND THAT IS A RULE RATHER THAN A PREFERENCE ─────┐
 * │ `FolderStructure.md` §12 rule 14: Indian digit grouping implemented in a SURFACE is a review │
 * │ rejection, and rule 12 forbids `toLocaleString` with a currency option anywhere outside      │
 * │ `packages/utils/src/money/`. This file used `Intl.NumberFormat({style:'currency'})`, which   │
 * │ is the same violation wearing a different name.                                              │
 * │                                                                                              │
 * │ The reason it matters is not tidiness. `LAUNCH_MARKET_INDIA.md` §2: a gym owner who sees      │
 * │ `₹250,000` on one screen where the invoice says `₹2,50,000` stops trusting BOTH figures. One  │
 * │ formatter, consumed by every surface and by the PDF renderer, is the only arrangement in      │
 * │ which they cannot disagree.                                                                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `bigint`, because `no-float-money` is right: these values are integer paise and typing them
 * `number` invites the one arithmetic that must never happen to them.
 */
export function formatMinor(paise: bigint, withPaise = false): string {
  if (withPaise) return formatIndianRupees(paise);
  // No paise on a headline tile — `₹48,74,932.00` spends four characters saying `.00`. The parts
  // still come from `indianAmountParts`, so the grouping has exactly one implementation.
  const { sign, major } = indianAmountParts(paise, 2);
  return `${sign}₹${major}`;
}

/**
 * Basis points to a signed percentage. 1860 → `+18.6%`.
 *
 * `percentStringFromBps` does the division with integer arithmetic — same reason as the paise.
 * The one thing added here is the explicit `+`, which a delta needs and a commission rate does not.
 */
export function formatDeltaBps(bps: number): string {
  const magnitude = percentStringFromBps(BigInt(Math.abs(bps)));
  // One decimal place on a dashboard delta; `percentStringFromBps` gives two.
  const trimmed = magnitude.replace(/(\.\d)\d$/, '$1');
  return `${bps >= 0 ? '+' : '-'}${trimmed}%`;
}

/** Whole minutes to "2 min ago" / "2 hours ago". */
export function formatAgo(minutes: number): string {
  if (minutes < 60) return `${String(minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  return `${String(hours)} ${hours === 1 ? 'hour' : 'hours'} ago`;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Sparkline series, and the three feed panels. Sample, like everything else in this file.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Twelve points per headline tile.
 *
 * Enough to read a shape, few enough to draw at 60x24 without turning into noise. Each series
 * ends where its tile's delta says it should: a tile reading `-11.7%` has a falling tail, because
 * a sparkline that contradicts the number beside it is worse than no sparkline.
 */
export const SPARKLINES: Readonly<Record<string, readonly number[]>> = {
  'adm.sample.totalRevenue': [42, 45, 44, 49, 52, 51, 58, 61, 59, 66, 71, 74],
  'adm.sample.todayRevenue': [28, 31, 29, 35, 33, 38, 41, 39, 44, 47, 45, 51],
  'adm.sample.commission': [18, 19, 21, 20, 24, 26, 25, 29, 31, 30, 34, 37],
  'adm.sample.activeMemberships': [61, 63, 66, 65, 69, 72, 74, 73, 78, 81, 84, 88],
  'adm.sample.supportTickets': [74, 71, 76, 69, 72, 66, 63, 67, 61, 58, 60, 55],
  'adm.sample.refundRequests': [31, 29, 33, 28, 30, 26, 24, 27, 22, 20, 19, 17],
};

export interface ActivityEntry {
  readonly id: string;
  readonly kind: 'GYM' | 'MEMBERSHIP' | 'PAYMENT' | 'REFUND' | 'PAYOUT';
  readonly headline: string;
  readonly detail: string;
  readonly minutesAgo: number;
}

/** The feed. Mixed kinds so the filter tabs have something to actually filter. */
export const RECENT_ACTIVITY: readonly ActivityEntry[] = [
  {
    id: 'a1',
    kind: 'GYM',
    headline: 'Iron House Strength Club was approved',
    detail: 'by Rohit Sharma',
    minutesAgo: 10,
  },
  {
    id: 'a2',
    kind: 'PAYMENT',
    headline: 'Payment of Rs 2,499 received from Neha Singh',
    detail: 'Order ORD-78562',
    minutesAgo: 15,
  },
  {
    id: 'a3',
    kind: 'REFUND',
    headline: 'Refund of Rs 1,999 initiated for Aman Verma',
    detail: 'Order ORD-78563',
    minutesAgo: 45,
  },
  {
    id: 'a4',
    kind: 'PAYOUT',
    headline: 'Payout of Rs 24,500 completed to 5 gyms',
    detail: 'Settlement cycle 32',
    minutesAgo: 120,
  },
  {
    id: 'a5',
    kind: 'MEMBERSHIP',
    headline: '28 memberships activated at Pulse Fitness Koramangala',
    detail: 'Monthly plan',
    minutesAgo: 180,
  },
];

export interface TopGym {
  readonly rank: number;
  readonly name: string;
  readonly revenueMinor: bigint;
}

export const TOP_GYMS: readonly TopGym[] = [
  { rank: 1, name: 'Iron House Strength Club', revenueMinor: 4_32_890_00n },
  { rank: 2, name: 'Apex CrossFit Powai', revenueMinor: 3_78_450_00n },
  { rank: 3, name: 'Coastal Swim & Gym', revenueMinor: 2_91_320_00n },
  { rank: 4, name: 'Pulse Fitness Koramangala', revenueMinor: 2_45_670_00n },
  { rank: 5, name: 'Capital Strength Saket', revenueMinor: 2_12_890_00n },
];

export interface MembershipStat {
  readonly label: string;
  readonly value: number;
  readonly deltaBps: number;
}

export const MEMBERSHIP_STATS: readonly MembershipStat[] = [
  { label: 'Active memberships', value: 12_864, deltaBps: 1530 },
  { label: 'New this month', value: 1_245, deltaBps: 1260 },
  { label: 'Expired', value: 342, deltaBps: -840 },
  { label: 'Cancelled', value: 213, deltaBps: -510 },
];

/** Renewal rate, in basis points. 6840 = 68.40%. */
export const RENEWAL_RATE_BPS = 6840;
export const RENEWAL_DELTA_BPS = 720;
