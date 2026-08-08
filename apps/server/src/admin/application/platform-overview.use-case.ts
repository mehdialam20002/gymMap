/**
 * `SCR-ADM-001` — the platform overview, and the gym list behind `SCR-ADM-004`.
 *
 * The only logic here is aggregation and shaping. Everything that reads across tenants goes
 * through the port, which is an audited elevation on the other side.
 */

import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../../common/config/app-config.schema.js';
import { CLOCK, type Clock } from '../../common/clock/clock.port.js';

import type {
  ApplicationSla,
  GymRow,
  GymStatusCounts,
  PlatformOverview,
} from '../types/platform-overview.js';
import {
  PLATFORM_READ_PORT,
  type PlatformReadPort,
  type ReadContext,
} from './ports/platform-read.port.js';

/**
 * Every member of `tenant_status_enum`, in the order an operator thinks about them.
 *
 * Listed explicitly so a status that exists in the database but has no rows still appears as a
 * zero. A `byStatus` map assembled only from what `groupBy` returned would silently drop
 * `REJECTED` on a platform that has never rejected anyone, and the screen would render a
 * different set of columns depending on the data.
 */
const ALL_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'INFO_REQUESTED',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'CLOSED',
] as const;

/** `SUBMITTED`, `UNDER_REVIEW` and `INFO_REQUESTED` are the states a human owns. */
const AWAITING = ['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED'] as const;

@Injectable()
export class PlatformOverviewUseCase {
  constructor(
    @Inject(PLATFORM_READ_PORT) private readonly platform: PlatformReadPort,
    // `AC-FND-13.3` — the ambient clock is not readable here. `generatedAt` is what the console
    // renders as its last-updated indicator, and a test that asserts the indicator needs to be
    // able to fix the time it reports.
    @Inject(CLOCK) private readonly clock: Clock,
    // §8.9 — never `process.env` at a call site. The SLA target is configuration because
    // `AdminDashboard.md` UI-ADM-4 forbids the console hard-coding it.
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async overview(context: ReadContext): Promise<PlatformOverview> {
    // Concurrent because they are independent reads and the screen needs all four. Sequential
    // would put four round trips on the critical path of the first thing an operator sees.
    const [byStatusRaw, byRole, peopleCount, activeSessions] = await Promise.all([
      this.platform.countGymsByStatus(context),
      this.platform.countPeopleByRole(),
      this.platform.countPeople(),
      this.platform.countActiveSessions(),
    ]);

    const byStatus = Object.fromEntries(
      ALL_STATUSES.map((status) => [status, byStatusRaw[status] ?? 0]),
    ) as unknown as GymStatusCounts;

    const gymCount = ALL_STATUSES.reduce((sum, status) => sum + (byStatusRaw[status] ?? 0), 0);
    const awaitingReview = AWAITING.reduce((sum, status) => sum + (byStatusRaw[status] ?? 0), 0);

    return {
      gyms: { count: gymCount, byStatus, awaitingReview, listed: byStatus.APPROVED },
      people: { count: peopleCount, byRole, activeSessions },
      generatedAt: this.clock.now().toISOString(),
    };
  }

  async gyms(context: ReadContext, status: string | null): Promise<readonly GymRow[]> {
    const rows = await this.platform.listGyms(context);
    const now = this.clock.now().getTime();

    return rows
      .filter((row) => status === null || row.status === status)
      .map((row) => ({
        id: row.id,
        legal_name: row.legalName,
        trading_name: row.tradingName,
        entity_type: row.entityType,
        status: row.status,
        subscription_status: row.subscriptionStatus,
        city: row.city,
        state: row.state,
        gstin: row.gstin,
        commission_rate_bps: row.commissionRateBps,
        created_at: row.createdAt.toISOString(),
        // Floor, not round. An application that arrived 30 hours ago has been waiting one day,
        // not two — rounding up would let the queue report an SLA breach a day early.
        waiting_days: Math.floor((now - row.createdAt.getTime()) / 86_400_000),
        age_hours: Math.floor((now - row.createdAt.getTime()) / 3_600_000),
        sla: this.slaFor(row.status, row.createdAt, now),
      }));
  }

  /**
   * The SLA state of one application - `Admin.md` 5.1.1's table, verbatim.
   *
   * +- WALL-CLOCK HOURS, NOT BUSINESS HOURS. THIS IS A KNOWN SHORTCUT ----------------------------+
   * | 5.1.1 says the figures are derived "in `Asia/Kolkata` business hours". NO DOCUMENT IN THIS   |
   * | REPOSITORY DEFINES WHAT BUSINESS HOURS ARE - there is no working-day list and no holiday     |
   * | calendar anywhere under docs/. Inventing one here would put a commercial commitment (when a  |
   * | gym owner is told their application is late) into an implementation detail.                   |
   * |                                                                                             |
   * | So this counts wall-clock hours, which is STRICTER: it never reports an application as       |
   * | within the SLA when a business-hours calculation would have called it breached. Erring       |
   * | towards "late" on a queue is the safe direction - the failure mode is an officer looking at  |
   * | something sooner than they had to.                                                          |
   * |                                                                                             |
   * | Recorded as `TD-036`. `Monitoring.md` SLO-04 made the same call for the SUPPORT SLA and gave |
   * | the reason: "a member who tickets at 21:00 IST experiences the wait regardless".             |
   * +---------------------------------------------------------------------------------------------+
   */
  private slaFor(status: string, submittedAt: Date, now: number): ApplicationSla | null {
    // Only an application somebody still owes a decision on has an SLA. See the note on the field.
    if (!AWAITING.includes(status as (typeof AWAITING)[number])) return null;

    const targetHours = this.config.VERIFICATION_SLA_TARGET_HOURS;
    const ageWallClock = Math.floor((now - submittedAt.getTime()) / 3_600_000);

    // `INFO_REQUESTED` stops the platform's clock: the applicant owes the next move, so the wait is
    // not the platform being slow. `AdminDashboard.md` 6.2 requires the chip to read `paused` and
    // the wall-clock age to remain visible.
    if (status === 'INFO_REQUESTED') {
      return {
        state: 'PAUSED',
        target_hours: targetHours,
        hours_remaining: null,
        breaches_at: null,
        age_hours_wall_clock: ageWallClock,
      };
    }

    const breachesAt = submittedAt.getTime() + targetHours * 3_600_000;
    // Truncated toward zero so a breach reads -1 rather than 0 the moment it passes the target.
    const hoursRemaining = Math.trunc((breachesAt - now) / 3_600_000);

    return {
      // 6.2's thresholds, not a choice made here: breached at or below zero, approaching at or
      // below 24 hours remaining, within above that.
      state: hoursRemaining <= 0 ? 'BREACHED' : hoursRemaining <= 24 ? 'APPROACHING' : 'WITHIN',
      target_hours: targetHours,
      hours_remaining: hoursRemaining,
      breaches_at: new Date(breachesAt).toISOString(),
      age_hours_wall_clock: ageWallClock,
    };
  }

}
