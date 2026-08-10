/**
 * `M-031` · `GYM_STATUS_PORT` on Prisma — `BR-GYM-01`, `Gym.md` §12.4.
 *
 * ┌─ `deletedAt: null` IS PART OF THE ANSWER, NOT A TIDINESS FILTER ─────────────────────────────┐
 * │ A soft-deleted gym has a `status` — whatever it held on the day it was removed, most often    │
 * │ `APPROVED`. Reading the column without the predicate returns that value, and `mayDeactivate()` │
 * │ would then treat a deleted gym as listed and refuse to close its last branch on the grounds    │
 * │ that customers can still see it. Nobody can see it.                                            │
 * │                                                                                                │
 * │ `isBlockedForOrdering()` gets the same protection from the other direction: a deleted gym is   │
 * │ `UNKNOWN_GYM`, and the ordering path refuses an unknown gym outright rather than consulting a  │
 * │ status at all.                                                                                  │
 * └────────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * No `tenantId` parameter — §11.5 `BR5`. The `A-01` extension sets `app.tenant_id` before the
 * statement and RLS filters, so a gym in a sibling tenant returns no row and becomes `UNKNOWN_GYM`
 * rather than a status the caller was never entitled to read.
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../tenancy/prisma/prisma.service.js';
import type { GymStatusOutcome, GymStatusPort } from '../application/ports/gym-status.port.js';
import { GYM_STATUSES, type GymStatus } from '../types/catalog.types.js';

@Injectable()
export class GymStatusPrismaAdapter implements GymStatusPort {
  constructor(private readonly db: PrismaService) {}

  async statusOf(gymId: string): Promise<GymStatusOutcome> {
    const row = await this.db.client.gym.findFirst({
      where: { id: gymId, deletedAt: null },
      select: { status: true },
    });

    if (row === null) return { ok: false, reason: 'UNKNOWN_GYM' };

    /*
     * The cast is checked rather than asserted, and the throw is deliberate.
     *
     * `gym_status_enum` and `GYM_STATUSES` are two hand-written lists of the same five values —
     * `catalog.types.ts` says so in its own header — and the failure mode of a sixth enum value
     * added in a migration is that it arrives here as a string no consumer handles. Every one of
     * those consumers decides something: `isBlockedForOrdering()` decides whether money changes
     * hands, `mayDeactivate()` decides whether a gym is visible to customers.
     *
     * `as GymStatus` would let the unknown value through and be answered `true` by
     * `status !== 'APPROVED'` — correct by luck, and only for that one predicate. Throwing puts the
     * divergence in front of whoever ran the migration, in a 500 with a message that names both
     * lists, rather than in a report six weeks later.
     */
    if (!(GYM_STATUSES as readonly string[]).includes(row.status)) {
      throw new Error(
        `gyms.status holds "${row.status}", which GYM_STATUSES in catalog.types.ts does not ` +
          `declare. The database enum and the TypeScript union have diverged — add the value to ` +
          `catalog.types.ts and decide, explicitly, what isBlockedForOrdering() and ` +
          `mayDeactivate() should do with it.`,
      );
    }

    return { ok: true, status: row.status as GymStatus };
  }
}
