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
 * ┌─ `location` NEEDS RAW SQL, AND THE PRECEDENT FOR THAT IS ESTABLISHED ────────────────────────┐
 * │ `location` is `Unsupported("geography(Point,4326)")`, so Prisma can migrate around it and     │
 * │ cannot read or write it. `listInGym` below therefore projects it with                          │
 * │ `ST_Y(location::geometry)` and `ST_X(location::geometry)`.                                     │
 * │                                                                                              │
 * │ This header used to defer that to `M-042`, on the grounds that raw SQL through the             │
 * │ tenant-scoped client was an unanswered question. It is answered: `AuditReadPrismaRepository`   │
 * │ already runs `this.db.client.$queryRaw` through the same `PrismaService`, so the `A-01`        │
 * │ extension opens the interactive transaction and sets `app.tenant_id` before the statement,     │
 * │ exactly as it does for a Prisma query. RLS filters either way.                                 │
 * │                                                                                              │
 * │ What has NOT changed is the reason for caution. `$queryRaw` is the one statement class that    │
 * │ CAN bypass the extension — through `$queryRawUnsafe`, or through a second client — and every   │
 * │ value below is a tagged-template parameter for that reason. `M-042` still owns `ST_DWithin`    │
 * │ and the `EXPLAIN` baseline; this is the tenant's own list, not a radius search.                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../tenancy/prisma/prisma.service.js';
import type {
  BranchLookupOutcome,
  BranchQueryPort,
} from '../application/ports/branch-query.port.js';
import type { BranchIdentity, BranchStatus } from '../types/catalog.types.js';
import type { BranchRow } from './branch.mapper.js';

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

  /**
   * Every branch of a gym in full — `GET /v1/tenant/branches`, `Gym.md` §12.1.
   *
   * ┌─ WHY THIS RETURNS INACTIVE BRANCHES AND `activeInGym` DOES NOT ────────────────────────────┐
   * │ They answer different questions. `activeInGym` feeds a DECISION — which branch to promote,  │
   * │ whether this is the last one — and a deactivated branch is not a candidate for either.      │
   * │ This feeds `SCR-DASH-004`, where an owner needs to see the branch they closed last month,   │
   * │ because otherwise it has silently vanished from a screen that claims to list their estate.  │
   * │                                                                                            │
   * │ `deleted_at IS NULL` still applies to both. Soft-deleted is gone; `INACTIVE` is closed.     │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  async listInGym(gymId: string): Promise<readonly BranchRow[]> {
    /*
     * `::geometry` before `ST_Y`/`ST_X`, and the cast is not decoration.
     *
     * On a `geography` those functions are undefined — PostGIS reserves them for planar geometry —
     * so the cast is what makes the projection legal. It is exact rather than approximate: the
     * cast reinterprets the same stored point, and no reprojection happens at 4326.
     *
     * `ST_Y` is LATITUDE and `ST_X` is LONGITUDE, which is the reverse of `ST_MakePoint`'s
     * argument order. `branch.mapper.ts` is where that asymmetry is explained; here the column
     * aliases say which is which so a reader need not remember.
     */
    return this.db.client.$queryRaw<BranchRow[]>`
      SELECT id,
             gym_id                        AS "gymId",
             name,
             address_line1                 AS "addressLine1",
             address_line2                 AS "addressLine2",
             city_id                       AS "cityId",
             locality_id                   AS "localityId",
             state,
             state_code                    AS "stateCode",
             postal_code                   AS "postalCode",
             country_code                  AS "countryCode",
             ST_Y(location::geometry)      AS lat,
             ST_X(location::geometry)      AS lng,
             geo_tolerance_metres          AS "geoToleranceMetres",
             capacity,
             status::text                  AS status,
             is_primary                    AS "isPrimary"
        FROM branches
       WHERE gym_id = ${gymId}::uuid
         AND deleted_at IS NULL
       ORDER BY is_primary DESC, created_at ASC`;
  }

  /**
   * Closes a branch and, when it was the primary, promotes its successor — in ONE transaction.
   *
   * ┌─ TWO STATEMENTS, ONE TRANSACTION, AND A PARTIAL UNIQUE INDEX IS WHY ───────────────────────┐
   * │ `uq_branches__one_primary_per_gym` is `UNIQUE (gym_id) WHERE is_primary AND deleted_at IS   │
   * │ NULL`. Run these apart and either order is wrong: promote first and there are momentarily   │
   * │ two primaries, which the index refuses outright; demote first and a crash between the two   │
   * │ leaves a gym with none, which nothing refuses and nothing notices until a city page cannot  │
   * │ resolve its address.                                                                        │
   * │                                                                                            │
   * │ `Gym.md` §12.4 requires the promotion *"in the same transaction"* for exactly that reason.  │
   * │ The demotion is implicit: the closing branch gets `deleted_at`, which takes it out of the   │
   * │ index's partial predicate, so the successor can take the flag in the same statement pair.   │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   *
   * `promoteTo` comes from `mayDeactivate()`, never from this file. The repository does not decide
   * WHICH branch succeeds — that ordering is `Gym.md`'s and the policy's, and re-deriving it here
   * would be a second answer to a question already answered.
   */
  async deactivate(branchId: string, promoteTo: string | null): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      /*
       * `status` and `deleted_at` together, never one without the other.
       *
       * `Gym.md` §12.4 defines a deactivation as both. Setting only the status leaves a row the
       * partial unique index still counts as primary; setting only `deleted_at` leaves a branch
       * that reads as `ACTIVE` to anything filtering on status alone. Two columns, one statement.
       */
      await tx.$executeRaw`
        UPDATE branches
           SET status     = 'INACTIVE',
               is_primary = false,
               deleted_at = now(),
               updated_at = now()
         WHERE id = ${branchId}::uuid
           AND deleted_at IS NULL`;

      if (promoteTo === null) return;

      await tx.$executeRaw`
        UPDATE branches
           SET is_primary = true,
               updated_at = now()
         WHERE id = ${promoteTo}::uuid
           AND deleted_at IS NULL`;
    });
  }
}
