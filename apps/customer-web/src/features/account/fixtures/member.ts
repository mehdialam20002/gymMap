/**
 * A FIXTURE member — `SCR-WEB-01x`. Not a session, and never to be mistaken for one.
 *
 * ┌─ WHY THIS FILE EXISTS AND WHEN IT DIES ─────────────────────────────────────────────────────┐
 * │ `/v1/auth/*` exists on the server (M-020 … M-022) and this app is not wired to it. Without   │
 * │ some member there is nothing to render, and an account area with nothing in it demonstrates  │
 * │ nothing — least of all the membership, QR and attendance screens, which are the whole of     │
 * │ "membership is a live, useful thing" (`§Belong`).                                             │
 * │                                                                                              │
 * │ So the shapes below are the shapes the API returns. Every account screen renders this and    │
 * │ marks itself as a demo; replacing it with a session and a fetch is a change to ONE module.   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ STATUS IS STORED, NEVER COMPUTED FROM A DATE ──────────────────────────────────────────────┐
 * │ `status` is a field, not `endsOn > today`. Two reasons, and both bite in production:          │
 * │                                                                                              │
 * │ 1. Invariant 5. A membership is ACTIVE because the payment webhook said so (`BR-PAY-02`),    │
 * │    not because a date has not passed. A browser that computes ACTIVE from a validity window  │
 * │    will show a paid-but-unconfirmed membership as usable, and the member finds out at the     │
 * │    desk.                                                                                      │
 * │ 2. The clock belongs to the device. A phone with the wrong date — or a deliberately changed   │
 * │    one — would extend its own membership. The server owns the state; the screen reports it.   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ AND ORDER FIGURES ARE PERSISTED, NOT RE-QUOTED ────────────────────────────────────────────┐
 * │ `MASTER_PRD.md` §A6.3: "No figure that appears on a settlement statement is ever recomputed  │
 * │ at display time." So each order below carries its OWN gross, tax and total. The receipts      │
 * │ screen renders them and never calls `quoteForPlan` — a receipt that recomputes is a receipt   │
 * │ that changes when the tax rate does, for a purchase made under the old one.                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Dates are absolute ISO instants, and they are a SNAPSHOT: the fixture does not move with the
 * calendar, which is correct for a demo and is why `status` is stored rather than derived.
 */

/** The lifecycle `BR-MEM-*` defines. `PENDING` is the state invariant 5 makes possible. */
export type MembershipStatus = 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'CANCELLED';

export interface Membership {
  readonly id: string;
  readonly gymCitySlug: string;
  readonly gymSlug: string;
  readonly gymName: string;
  readonly gymLocality: string;
  readonly planName: string;
  readonly status: MembershipStatus;
  /** `Asia/Kolkata` local midnights, stored as instants. */
  readonly startsOn: string;
  readonly endsOn: string;
  /** Visits recorded against this membership. Counted by the server, not by this screen. */
  readonly visitCount: number;
}

export interface Visit {
  readonly id: string;
  readonly membershipId: string;
  readonly gymName: string;
  /** The instant the gym's scanner confirmed the check-in. */
  readonly checkedInAt: string;
}

/** One line of a receipt. Persisted per order — see the header. */
export interface OrderLine {
  readonly label: string;
  readonly amountMinor: bigint;
}

export interface Order {
  readonly id: string;
  readonly reference: string;
  readonly placedAt: string;
  readonly gymName: string;
  readonly planName: string;
  readonly grossMinor: bigint;
  readonly discountMinor: bigint;
  readonly netMinor: bigint;
  readonly taxLines: readonly OrderLine[];
  readonly taxMinor: bigint;
  readonly totalMinor: bigint;
  /** `PAID` only ever means the webhook arrived. */
  readonly status: 'PAID' | 'PENDING' | 'REFUNDED';
}

export interface DemoMember {
  readonly name: string;
  readonly memberSince: string;
  readonly memberships: readonly Membership[];
  readonly visits: readonly Visit[];
  readonly orders: readonly Order[];
}

/**
 * One member with a deliberately uneven history.
 *
 * An active membership, an expired one and a PENDING one — because pending is the state that
 * exists only because activation is webhook-driven, and a demo where every membership is active
 * makes the one screen that explains invariant 5 unreachable.
 */
export const DEMO_MEMBER: DemoMember = {
  name: 'Priya Sharma',
  memberSince: '2025-11-04T04:30:00.000Z',

  memberships: [
    {
      id: 'mem-001',
      gymCitySlug: 'bengaluru',
      gymSlug: 'iron-house-indiranagar',
      gymName: 'Iron House Strength Club',
      gymLocality: 'Indiranagar',
      planName: 'Quarterly',
      status: 'ACTIVE',
      startsOn: '2026-06-01T00:00:00.000Z',
      endsOn: '2026-08-30T00:00:00.000Z',
      visitCount: 31,
    },
    {
      id: 'mem-002',
      gymCitySlug: 'bengaluru',
      gymSlug: 'the-yoga-room-jayanagar',
      gymName: 'The Yoga Room',
      gymLocality: 'Jayanagar 4th Block',
      planName: 'Monthly · 12 classes',
      // Paid, and not yet confirmed by the provider. The one state a client-side success signal
      // would have skipped straight past.
      status: 'PENDING',
      startsOn: '2026-08-08T00:00:00.000Z',
      endsOn: '2026-09-07T00:00:00.000Z',
      visitCount: 0,
    },
    {
      id: 'mem-003',
      gymCitySlug: 'bengaluru',
      gymSlug: 'pulse-fitness-koramangala',
      gymName: 'Pulse Fitness Koramangala',
      gymLocality: 'Koramangala 5th Block',
      planName: 'Monthly',
      status: 'EXPIRED',
      startsOn: '2026-03-01T00:00:00.000Z',
      endsOn: '2026-03-31T00:00:00.000Z',
      visitCount: 12,
    },
  ],

  visits: [
    {
      id: 'v-006',
      membershipId: 'mem-001',
      gymName: 'Iron House Strength Club',
      checkedInAt: '2026-08-07T01:12:00.000Z',
    },
    {
      id: 'v-005',
      membershipId: 'mem-001',
      gymName: 'Iron House Strength Club',
      checkedInAt: '2026-08-05T01:31:00.000Z',
    },
    {
      id: 'v-004',
      membershipId: 'mem-001',
      gymName: 'Iron House Strength Club',
      checkedInAt: '2026-08-03T00:58:00.000Z',
    },
    {
      id: 'v-003',
      membershipId: 'mem-001',
      gymName: 'Iron House Strength Club',
      checkedInAt: '2026-07-31T13:40:00.000Z',
    },
    {
      id: 'v-002',
      membershipId: 'mem-001',
      gymName: 'Iron House Strength Club',
      checkedInAt: '2026-07-29T01:22:00.000Z',
    },
    {
      id: 'v-001',
      membershipId: 'mem-003',
      gymName: 'Pulse Fitness Koramangala',
      checkedInAt: '2026-03-28T02:05:00.000Z',
    },
  ],

  orders: [
    {
      id: 'ord-002',
      reference: 'GM-2026-0000482',
      placedAt: '2026-08-08T05:02:00.000Z',
      gymName: 'The Yoga Room',
      planName: 'Monthly · 12 classes',
      grossMinor: 1_49_900n,
      discountMinor: 0n,
      netMinor: 1_49_900n,
      taxLines: [
        { label: 'CGST 9%', amountMinor: 13_491n },
        { label: 'SGST 9%', amountMinor: 13_491n },
      ],
      taxMinor: 26_982n,
      totalMinor: 1_76_882n,
      status: 'PENDING',
    },
    {
      id: 'ord-001',
      reference: 'GM-2026-0000311',
      placedAt: '2026-05-30T11:47:00.000Z',
      gymName: 'Iron House Strength Club',
      planName: 'Quarterly',
      grossMinor: 6_49_900n,
      discountMinor: 0n,
      netMinor: 6_49_900n,
      taxLines: [
        { label: 'CGST 9%', amountMinor: 58_491n },
        { label: 'SGST 9%', amountMinor: 58_491n },
      ],
      taxMinor: 1_16_982n,
      totalMinor: 7_66_882n,
      status: 'PAID',
    },
  ],
};

/** The membership a check-in screen would open by default: the one that can actually be used. */
export function activeMembership(member: DemoMember): Membership | null {
  return member.memberships.find((membership) => membership.status === 'ACTIVE') ?? null;
}

export function findMembership(member: DemoMember, id: string): Membership | null {
  return member.memberships.find((membership) => membership.id === id) ?? null;
}

/**
 * The gyms this member could review — `BR-REV-01`, `BR-REV-03`.
 *
 * Derived from the VISITS, which is the rule itself expressed as code: a review requires a
 * recorded check-in, so the set of reviewable gyms is exactly the set of gyms checked into. A
 * membership is not enough; paying for something is not the same as having been.
 */
export function reviewableGyms(member: DemoMember): readonly string[] {
  return [...new Set(member.visits.map((visit) => visit.gymName))].sort((a, b) =>
    a.localeCompare(b),
  );
}
