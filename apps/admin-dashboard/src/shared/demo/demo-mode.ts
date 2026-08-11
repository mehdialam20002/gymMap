/**
 * DEMO MODE — the console, walkable, with no API behind it.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS, AND THE ONE RULE THAT MAKES IT HONEST
 *
 * The console is a real client of a real API. Deployed anywhere the API is not, it renders a
 * sign-in form that cannot succeed, and everything behind it is unreachable. That is correct
 * behaviour and it demonstrates nothing: somebody being shown the product sees one form.
 *
 * So this module lets the whole console run from fixtures. The rule that makes it defensible is
 * the one `demo-figures.ts` already states about its own numbers:
 *
 *     "That banner is not decoration and must not be removed for a screenshot: it is the entire
 *      reason inventing these numbers is honest rather than misleading."
 *
 * Here it is stronger, because in demo mode NOTHING is real. `DemoNotice` renders from the root
 * layout, above every route, and there is no code path that mounts a demo route without it.
 * Removing it turns a demonstration into a claim.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ IT IS OFF UNLESS A BUILD TURNS IT ON, AND THE MEASURED FACTS ARE THESE ─────────────────────┐
 * │ `VITE_DEMO_MODE` is read ONCE, here, at module scope, so a build without it makes             │
 * │ `isDemoMode` the literal `false` and every branch behind it UNREACHABLE.                      │
 * │                                                                                              │
 * │ This box first claimed the bundler therefore *"eliminates every branch — the fixtures do not  │
 * │ ship"*. Measured rather than assumed, and the claim was half true:                             │
 * │                                                                                              │
 * │     normal build   485,084 bytes   `Ananya Raghavan` ABSENT · `Iron Temple Fitness` PRESENT    │
 * │     demo build     486,478 bytes   both present                                                │
 * │                                                                                              │
 * │ Rollup drops `DEMO_OPERATOR`, whose only consumer is an eliminated branch in another module,   │
 * │ and KEEPS the `DEMO_GYMS` array. 1.4 kB separates the two builds. Nothing is reachable with    │
 * │ the flag off — this is bundle weight, not behaviour, and not a security question.               │
 * │                                                                                              │
 * │ **The real fix, if `A-29`'s bundle budget ever cares:** move the fixtures behind a dynamic     │
 * │ `import()` so they become a chunk a non-demo build never requests. Not done now because 1.4 kB │
 * │ does not justify making `api()` load a module mid-request, and a comment that states the       │
 * │ measurement is worth more than one that states a hope.                                         │
 * │                                                                                              │
 * │ Read in one place for the reason every other flag here is: a second read somewhere else is a   │
 * │ second answer to "are we in demo mode", and the two disagree the first time one is misspelled. │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT THIS IS NOT ───────────────────────────────────────────────────────────────────────────┐
 * │ Not a test fixture. `test/` has its own, and a test that read this would be asserting against │
 * │ a demonstration rather than against the contract.                                              │
 * │                                                                                              │
 * │ Not an offline mode. There is no queue, no retry, no reconciliation. A mutation in demo mode   │
 * │ changes nothing and says so.                                                                   │
 * │                                                                                              │
 * │ Not a way to skip authentication in development. `pnpm dev` runs the real API on :3000 and the │
 * │ real sign-in works. This is for a deployment with no API at all.                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import type { GymRow, GymStatus, PlatformOverview } from '../api/admin.ts';
import type { SessionRow } from '../api/client.ts';

/**
 * The single read of the flag.
 *
 * `=== 'true'` and not a truthiness check: every Vite env value is a STRING, so `'false'` is
 * truthy and a build with `VITE_DEMO_MODE=false` would enable the mode it disables.
 *
 * ┌─ DOT ACCESS, NOT BRACKETS, AND THE DIFFERENCE IS THE WHOLE CLAIM ABOVE ────────────────────┐
 * │ Vite replaces `import.meta.env.VITE_DEMO_MODE` TEXTUALLY at build time. The bracket form is  │
 * │ a runtime lookup it cannot replace — so this constant would not be a constant, and every     │
 * │ branch behind it would survive into the bundle.                                              │
 * │                                                                                            │
 * │ It was written with brackets, and the box above claimed the fixtures do not ship. Measured   │
 * │ with `grep` against a non-demo build: they did. `src/shared/types/env.d.ts` declares the key  │
 * │ so the dot form needs no index signature. Re-measured after the change: absent.               │
 * └────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export const isDemoMode: boolean = import.meta.env.VITE_DEMO_MODE === 'true';

/**
 * The operator the console is signed in as.
 *
 * A realistic Indian name rather than "Admin User", for the reason the AI-tells reference gives:
 * a placeholder name is the clearest signal that nobody looked at the screen. `SUPER_ADMIN` because
 * the walkthrough should reach every route, and a narrower role would hide screens behind a 403
 * that has nothing to teach the viewer.
 */
export const DEMO_OPERATOR = {
  userId: '0192de00-9400-7000-8000-0000000000d1',
  displayName: 'Ananya Raghavan',
  roleLabel: 'Super admin',
} as const;

/** Deterministic, and stated as a fixed instant so two panels never disagree by a render. */
const GENERATED_AT = '2026-08-11T09:40:00.000Z';

const daysAgo = (days: number): string =>
  new Date(Date.parse(GENERATED_AT) - days * 86_400_000).toISOString();

/**
 * `GET /v1/admin/platform/overview`.
 *
 * ┌─ THE COUNTS ADD UP, AND THAT IS DELIBERATE ──────────────────────────────────────────────────┐
 * │ `byStatus` sums to `count`; `awaitingReview` equals the three statuses a human owns; `listed` │
 * │ equals `APPROVED`. A viewer who adds the tiles and gets a different total has been shown that  │
 * │ the numbers are decorative, which is exactly the impression a demonstration must not leave.    │
 * │                                                                                              │
 * │ And no round numbers. `99.99%`, `50%` and `1,000` are the tell — real registers are lumpy.    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export const DEMO_OVERVIEW: PlatformOverview = {
  gyms: {
    count: 147,
    /*
     * All EIGHT `tenant_status_enum` values, and the first version of this fixture had five.
     *
     * It was written against `gym_status_enum` — DRAFT, PENDING_REVIEW, APPROVED, SUSPENDED,
     * CLOSED — because "gym status" is the obvious reading of `byStatus` on a key called `gyms`.
     * The endpoint returns the TENANT's status, which is the `§C4.4` approval state machine, and
     * `PENDING_REVIEW` is not one of its values at all. `tsc` refused the cast, which is the only
     * reason the fixture is not now teaching a viewer a state that does not exist.
     */
    byStatus: {
      DRAFT: 23,
      SUBMITTED: 6,
      UNDER_REVIEW: 3,
      INFO_REQUESTED: 2,
      APPROVED: 96,
      REJECTED: 4,
      SUSPENDED: 4,
      CLOSED: 9,
    },
    // SUBMITTED + UNDER_REVIEW + INFO_REQUESTED — `AWAITING_STATUSES`, the three a human owns.
    // DRAFT is the owner's to submit and is deliberately not counted here.
    awaitingReview: 6 + 3 + 2,
    listed: 96,
  },
  people: {
    count: 2_418,
    byRole: {
      MEMBER: 1_902,
      USER: 331,
      GYM_OWNER: 121,
      GYM_MANAGER: 38,
      RECEPTIONIST: 17,
      TRAINER: 4,
      SUPPORT_AGENT: 3,
      VERIFICATION_OFFICER: 2,
    },
    activeSessions: 34,
  },
  generatedAt: GENERATED_AT,
};

/**
 * `GET /v1/admin/platform/gyms`.
 *
 * Eleven rows, matching `awaitingReview` above when filtered to the queue statuses, plus a handful
 * of decided ones so the register is not identical to the queue.
 *
 * Every `sla` is present and computed here as fixture data. The console must never derive it —
 * `AdminDashboard.md` `UI-ADM-4`, and `Admin.md` §5.1.1 gives the reason: *"A client computing 51
 * hours from a UTC timestamp in a browser set to IST gets a different answer 23% of the day."* A
 * fixture is the one place these values may be written down, and they are written as the server
 * would emit them rather than as the component would like them.
 */
const gym = (
  id: number,
  legalName: string,
  tradingName: string,
  city: string,
  state: string,
  status: GymStatus,
  waitingDays: number,
  sla: NonNullable<GymRow['sla']> | null,
  entityType = 'COMPANY',
): GymRow => ({
  id: `0192de00-9400-7000-8000-${String(id).padStart(12, '0')}`,
  legal_name: legalName,
  trading_name: tradingName,
  entity_type: entityType,
  status,
  subscription_status: status === 'APPROVED' ? 'ACTIVE' : 'TRIAL',
  city,
  state,
  gstin: null,
  commission_rate_bps: status === 'APPROVED' ? 1_000 : null,
  created_at: daysAgo(waitingDays),
  waiting_days: waitingDays,
  age_hours: waitingDays * 24,
  sla,
});

const within = (remaining: number, age: number): NonNullable<GymRow['sla']> => ({
  state: 'WITHIN',
  target_hours: 72,
  hours_remaining: remaining,
  breaches_at: null,
  age_hours_wall_clock: age,
});

export const DEMO_GYMS: readonly GymRow[] = [
  gym(
    1,
    'Iron Temple Fitness Private Limited',
    'Iron Temple',
    'Mumbai',
    'Maharashtra',
    'UNDER_REVIEW',
    3,
    {
      state: 'BREACHED',
      target_hours: 72,
      hours_remaining: null,
      breaches_at: daysAgo(0),
      age_hours_wall_clock: 79,
    },
  ),
  gym(
    2,
    'Peak Performance Partners',
    'Peak Performance',
    'Pune',
    'Maharashtra',
    'UNDER_REVIEW',
    2,
    {
      state: 'APPROACHING',
      target_hours: 72,
      hours_remaining: 9,
      breaches_at: GENERATED_AT,
      age_hours_wall_clock: 63,
    },
    'PARTNERSHIP',
  ),
  gym(
    3,
    'Summit Strength',
    'Summit',
    'Bengaluru',
    'Karnataka',
    'UNDER_REVIEW',
    1,
    within(46, 26),
    'SOLE_PROPRIETOR',
  ),
  gym(
    4,
    'Kaya Wellness LLP',
    'Kaya',
    'Hyderabad',
    'Telangana',
    'UNDER_REVIEW',
    1,
    within(51, 21),
    'PARTNERSHIP',
  ),
  gym(
    5,
    'Chakra Yoga Studio Private Limited',
    'Chakra',
    'Chennai',
    'Tamil Nadu',
    'UNDER_REVIEW',
    2,
    within(28, 44),
  ),
  gym(
    6,
    'Meridian Aquatics Private Limited',
    'Meridian',
    'Kolkata',
    'West Bengal',
    'UNDER_REVIEW',
    3,
    {
      state: 'PAUSED',
      target_hours: 72,
      hours_remaining: 12,
      breaches_at: null,
      age_hours_wall_clock: 71,
    },
  ),
  gym(
    7,
    'Anaadi Movement Collective',
    'Anaadi',
    'Jaipur',
    'Rajasthan',
    'UNDER_REVIEW',
    1,
    within(58, 14),
    'OTHER',
  ),
  gym(
    8,
    'Bandra Boxing Club Private Limited',
    'BBC',
    'Mumbai',
    'Maharashtra',
    'UNDER_REVIEW',
    2,
    within(31, 41),
  ),
  gym(
    9,
    'Sattva Pilates',
    'Sattva',
    'Ahmedabad',
    'Gujarat',
    'UNDER_REVIEW',
    1,
    within(62, 10),
    'SOLE_PROPRIETOR',
  ),
  gym(
    10,
    'Trident Sports Complex Private Limited',
    'Trident',
    'Lucknow',
    'Uttar Pradesh',
    'UNDER_REVIEW',
    2,
    within(24, 48),
  ),
  gym(
    11,
    'Nilgiri Trail Athletics',
    'Nilgiri',
    'Chandigarh',
    'Chandigarh',
    'UNDER_REVIEW',
    4,
    {
      state: 'BREACHED',
      target_hours: 72,
      hours_remaining: null,
      breaches_at: daysAgo(1),
      age_hours_wall_clock: 96,
    },
    'OTHER',
  ),

  // Decided, so the register is not a copy of the queue.
  gym(20, 'Vajra Strength Private Limited', 'Vajra', 'Pune', 'Maharashtra', 'APPROVED', 34, null),
  gym(21, 'Surya Fitness Private Limited', 'Surya', 'Surat', 'Gujarat', 'APPROVED', 61, null),
  gym(22, 'Prana Studio', 'Prana', 'Delhi', 'Delhi', 'SUSPENDED', 88, null, 'SOLE_PROPRIETOR'),
];

/**
 * `GET /v1/auth/sessions`.
 *
 * Two devices, one of them this one. `current` on exactly one row: the screen's whole purpose is
 * *"revoking one device leaves the other signed in"*, and two currents makes that unreadable.
 */
export const DEMO_SESSIONS: readonly SessionRow[] = [
  {
    id: '0192de00-9400-7000-8000-0000000000f1',
    device_label: 'Chrome on Windows',
    // Documentation-range addresses only (`TEST-NET-3`, `RFC 5737`). A plausible real IP in a
    // fixture is an IP somebody eventually looks up.
    ip: '203.0.113.42',
    started_at: daysAgo(0),
    current: true,
  },
  {
    id: '0192de00-9400-7000-8000-0000000000f2',
    device_label: 'Safari on iPhone',
    ip: '198.51.100.17',
    started_at: daysAgo(6),
    current: false,
  },
];

/**
 * `GET /readyz`, which the dashboard fetches DIRECTLY rather than through `api()`.
 *
 * ┌─ IT BYPASSES `api()` ON PURPOSE, SO THE INTERCEPTOR CANNOT SEE IT ───────────────────────────┐
 * │ `/readyz` answers **503** when a dependency is down, and the dashboard reads the BODY rather   │
 * │ than throwing — *"a dashboard that renders 'could not load' when the database is down has      │
 * │ hidden the one fact the operator needed."* `api()` throws on a non-2xx, so the panel calls     │
 * │ `fetch` itself.                                                                                │
 * │                                                                                              │
 * │ Which means demo mode has to be handled at that call site, and that is the one place a second  │
 * │ `isDemoMode` branch lives. Acceptable: the rule is that the ENV is read once, not that one     │
 * │ module may import the boolean.                                                                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * All four dependencies healthy. A red one would be more interesting to look at and would be a lie
 * of a different kind: a viewer seeing Redis down asks what broke, and the answer is "nothing, we
 * wrote it down that way".
 */
export const DEMO_READINESS = {
  status: 'ready' as const,
  dependencies: { postgres: true, redis: true, s3: true, smtp: true },
};

/**
 * The demo answer for a path, or `undefined` when nothing is fixtured for it.
 *
 * `undefined` rather than an empty object: a route asking for something this module does not know
 * about should reach the `api()` failure path and render its own error state, which is a truthful
 * "this is not in the demo" rather than a screen full of zeros.
 */
export function demoResponseFor(path: string): unknown {
  // Query strings are stripped: `?status=PENDING_REVIEW` is a filter the fixture applies below,
  // not a different endpoint.
  const [route] = path.split('?');
  const status = new URLSearchParams(path.slice(path.indexOf('?') + 1)).get('status');

  switch (route) {
    case '/v1/admin/platform/overview':
      return DEMO_OVERVIEW;

    case '/v1/admin/platform/gyms':
      return {
        gyms:
          status === null || status === ''
            ? DEMO_GYMS
            : DEMO_GYMS.filter((row) => row.status === status),
      };

    case '/v1/auth/sessions':
      return { sessions: DEMO_SESSIONS };

    default:
      return undefined;
  }
}
