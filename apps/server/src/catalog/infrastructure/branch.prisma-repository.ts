/**
 * `M-031` · `branches`, through the tenant-scoped client.
 *
 * ┌─ NO `tenantId` PARAMETER ANYWHERE, AND A LINT RULE ENFORCES IT ──────────────────────────────┐
 * │ §11.5 `BR5` and `gymmap/no-tenant-id-parameter`. The tenant comes from `AsyncLocalStorage`    │
 * │ via the `A-01` Prisma extension, which opens an interactive transaction and sets              │
 * │ `app.tenant_id` before any statement runs. RLS then filters. A `tenantId` argument would be a │
 * │ caller-CHOSEN tenant whose only guard is the policy — a backstop used as a control.            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY THERE IS NO `location` HERE, AND NO `ST_DWithin` ───────────────────────────────────────┐
 * │ `location` is `Unsupported("geography(Point,4326)")`, so Prisma can migrate around it and     │
 * │ cannot read it. Every radius query is therefore `$queryRaw` — and raw SQL through the         │
 * │ tenant-scoped client is a separate question with its own answer, which `M-042` (the radius    │
 * │ search) owns along with the `EXPLAIN` baseline `AC-2` asks for.                                │
 * │                                                                                              │
 * │ This repository answers identity questions, which Prisma can express. Reaching for            │
 * │ `$queryRaw` here to "save a trip later" would put the one statement class that can bypass the │
 * │ extension into the file least likely to be reviewed for it.                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../tenancy/prisma/prisma.service.js';
import type {
  BranchLookupOutcome,
  BranchQueryPort,
} from '../application/ports/branch-query.port.js';
import type { BranchIdentity, BranchStatus } from '../types/catalog.types.js';

/** One row → the identity projection. Explicit, so a new column cannot leak into a consumer. */
function toIdentity(row: {
  id: string;
  gymId: string;
  name: string;
  status: string;
  isPrimary: boolean;
}): BranchIdentity {
  return {
    id: row.id,
    gymId: row.gymId,
    name: row.name,
    status: row.status as BranchStatus,
    isPrimary: row.isPrimary,
  };
}

const IDENTITY_COLUMNS = { id: true, gymId: true, name: true, status: true, isPrimary: true };

@Injectable()
export class BranchPrismaRepository implements BranchQueryPort {
  constructor(private readonly db: PrismaService) {}

  async findInGym(gymId: string, branchId: string): Promise<BranchLookupOutcome> {
    /*
     * `gymId` is in the WHERE, not checked afterwards.
     *
     * Fetching by id and comparing the gym in TypeScript gives the same answer and a different
     * security property: the row is read first, so a bug in the comparison leaks it. Here the
     * database never returns another gym's branch at all.
     *
     * `deletedAt: null` because a deactivated branch is soft-deleted (`Gym.md` §12.4) and a
     * consumer asking "does this branch exist" is asking about a usable one.
     */
    const row = await this.db.client.branch.findFirst({
      where: { id: branchId, gymId, deletedAt: null },
      select: IDENTITY_COLUMNS,
    });

    return row === null
      ? { ok: false, reason: 'UNKNOWN_BRANCH' }
      : { ok: true, branch: toIdentity(row) };
  }

  async activeInGym(gymId: string): Promise<readonly BranchIdentity[]> {
    /*
     * Primary first, then oldest first — and the second key is what makes "the next branch"
     * meaningful.
     *
     * `Gym.md` §12.4 requires deactivating a primary to promote the next branch in the same
     * transaction, and does not say which one. `createdAt` is the only ordering the data already
     * carries that a reviewer can predict and a member would recognise: the branch that opened
     * first. Ordering by `name` would make a rename change which branch is promoted.
     */
    const rows = await this.db.client.branch.findMany({
      where: { gymId, status: 'ACTIVE', deletedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: IDENTITY_COLUMNS,
    });

    return rows.map(toIdentity);
  }
}
