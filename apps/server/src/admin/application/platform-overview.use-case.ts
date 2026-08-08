/**
 * `SCR-ADM-001` — the platform overview, and the gym list behind `SCR-ADM-004`.
 *
 * The only logic here is aggregation and shaping. Everything that reads across tenants goes
 * through the port, which is an audited elevation on the other side.
 */

import { Inject, Injectable } from '@nestjs/common';

import { CLOCK, type Clock } from '../../common/clock/clock.port.js';

import type { GymRow, GymStatusCounts, PlatformOverview } from '../types/platform-overview.js';
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
  ) {}

  async overview(context: ReadContext): Promise<PlatformOverview> {
    // Concurrent because they are independent reads and the screen needs all four. Sequential
    // would put four round trips on the critical path of the first thing an operator sees.
    const [byStatusRaw, byRole, peopleTotal, activeSessions] = await Promise.all([
      this.platform.countGymsByStatus(context),
      this.platform.countPeopleByRole(),
      this.platform.countPeople(),
      this.platform.countActiveSessions(),
    ]);

    const byStatus = Object.fromEntries(
      ALL_STATUSES.map((status) => [status, byStatusRaw[status] ?? 0]),
    ) as unknown as GymStatusCounts;

    const gymTotal = ALL_STATUSES.reduce((sum, status) => sum + (byStatusRaw[status] ?? 0), 0);
    const awaitingReview = AWAITING.reduce((sum, status) => sum + (byStatusRaw[status] ?? 0), 0);

    return {
      gyms: { total: gymTotal, byStatus, awaitingReview, listed: byStatus.APPROVED },
      people: { total: peopleTotal, byRole, activeSessions },
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
      }));
  }
}
