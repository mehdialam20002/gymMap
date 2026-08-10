/**
 * `M-031` · `GYM_TIMEZONE_PORT` on Prisma — `BR-MEM-03`, `TM3`.
 *
 * ┌─ IT READS `tenants.timezone`, AND `cities.timezone` IS THE TRAP ─────────────────────────────┐
 * │ A gym has a city, and `cities.timezone` exists and is populated. `Schema.md` §12.1 marks it   │
 * │ *"Presentation default; **never authoritative** — the tenant's timezone is"*, and `TM3` is    │
 * │ the rule. The join is one hop shorter and would look correct in every review.                 │
 * │                                                                                              │
 * │ The failure it would cause is small and terrible: membership boundaries computed a few hours  │
 * │ out, invisible to every test that uses a single timezone, and visible only as a member        │
 * │ refused entry on the last day they paid for.                                                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../tenancy/prisma/prisma.service.js';
import {
  ianaTimezone,
  type GymTimezoneOutcome,
  type GymTimezonePort,
} from '../application/ports/gym-timezone.port.js';

@Injectable()
export class GymTimezonePrismaAdapter implements GymTimezonePort {
  constructor(private readonly db: PrismaService) {}

  async timezoneFor(gymId: string): Promise<GymTimezoneOutcome> {
    /*
     * Through `gym`, not through `tenant` directly, even though the column is on `tenants`.
     *
     * The caller has a gym id and the question is about that gym. Reading the tenant's row from
     * the context instead would answer "the current tenant's zone", which is the same value today
     * and a different question — and it would keep answering after somebody passes a gym id
     * belonging to a tenant that is not the current one, where the honest answer is UNKNOWN_GYM.
     */
    const row = await this.db.client.gym.findFirst({
      where: { id: gymId, deletedAt: null },
      select: { tenant: { select: { timezone: true } } },
    });

    if (row === null) return { ok: false, reason: 'UNKNOWN_GYM' };

    // `ianaTimezone()` re-validates what the `iana_timezone` domain already constrains. Cheap, and
    // it is the boundary where a column that stopped being a domain would surface as a throw
    // rather than as a silently wrong date six weeks later.
    return { ok: true, timezone: ianaTimezone(row.tenant.timezone) };
  }
}
