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
 * │ This header used to say the A-01 extension covers `$queryRaw` *"exactly as it does for a       │
 * │ Prisma query"*. **That was FALSE and it cost a day.** The extension hooks                       │
 * │ `query.$allModels.$allOperations`; `$queryRaw`, `$executeRaw` and `$transaction` are            │
 * │ CLIENT-level operations it never sees, so no transaction is opened and `app.tenant_id` is       │
 * │ never set. Every raw method here failed with SQLSTATE 42704 against the RLS policy.             │
 * │                                                                                              │
 * │ Every one now goes through `PrismaService.inTenantTransaction()`, which opens the transaction  │
 * │ and sets the context. See that method for why the integration specs could not see this.        │
 * │                                                                                              │
 * │ What has NOT changed is the reason for caution. `$queryRaw` is the one statement class that    │
 * │ CAN bypass the extension — through `$queryRawUnsafe`, or through a second client — and every   │
 * │ value below is a tagged-template parameter for that reason. `M-042` still owns `ST_DWithin`    │
 * │ and the `EXPLAIN` baseline; this is the tenant's own list, not a radius search.                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Injectable } from '@nestjs/common';

import type { Cursor, Page } from '@gymmap/types';

import { PrismaService } from '../../tenancy/prisma/prisma.service.js';
import type {
  BranchLookupOutcome,
  BranchQueryPort,
} from '../application/ports/branch-query.port.js';
import type { BranchListPort, ListBranchesQuery } from '../application/ports/branch-list.port.js';
import type {
  BranchPatch,
  BranchWritePort,
  NewBranch,
} from '../application/ports/branch-write.port.js';

import type { BranchIdentity, BranchStatus } from '../types/catalog.types.js';
import { postGisPoint, type BranchRow } from './branch.mapper.js';

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

/**
 * The keyset cursor — base64url over `(sort key, id)`.
 *
 * `packages/types` declares `Cursor` opaque: *"the moment a client parses a cursor, the encoding is
 * frozen and the sort key can never change"*. So it is minted and read only here, and a cursor that
 * does not decode is treated as absent rather than as an error — a stale or hand-edited cursor
 * should return the first page, not a 500.
 */
interface CursorPosition {
  readonly k: string;
  readonly i: string;
}

function encodeCursor(position: CursorPosition): Cursor {
  return Buffer.from(JSON.stringify(position), 'utf8').toString('base64url') as Cursor;
}

function decodeCursor(cursor: Cursor | undefined): CursorPosition | null {
  if (cursor === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { k, i } = parsed as Record<string, unknown>;
    return typeof k === 'string' && typeof i === 'string' ? { k, i } : null;
  } catch {
    return null;
  }
}

@Injectable()
export class BranchPrismaRepository implements BranchQueryPort, BranchWritePort, BranchListPort {
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
    return this.db.inTenantTransaction(
      (tx) => tx.$queryRaw<BranchRow[]>`
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
       ORDER BY is_primary DESC, created_at ASC`,
    );
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
    /*
     * `inTenantTransaction`, not `client.$transaction` — the sixth method broken the same way.
     * `$transaction` is a CLIENT-level operation, so the `A-01` extension (which hooks
     * `$allModels.$allOperations`) never sees it and `set_config('app.tenant_id', …)` never runs.
     * Both statements below then fail against the RLS policy with SQLSTATE 42704.
     *
     * The one-transaction property this method exists for is unchanged: `inTenantTransaction`
     * opens exactly one interactive transaction and refuses to nest (`PX-6`).
     */
    await this.db.inTenantTransaction(async (tx) => {
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

  // ═══════════════════════════════════════════════════════════════════════════
  // BranchWritePort
  // ═══════════════════════════════════════════════════════════════════════════

  async gymOf(branchId: string): Promise<string | null> {
    const row = await this.db.client.branch.findFirst({
      where: { id: branchId, deletedAt: null },
      select: { gymId: true },
    });
    return row?.gymId ?? null;
  }

  /**
   * `INSERT … RETURNING` the same projection `listInGym` reads back.
   *
   * Returning the stored row rather than echoing the request is the point: `location` makes a round
   * trip through `geography(Point,4326)` and back out through `ST_Y`/`ST_X`, so what the caller
   * renders is what PostGIS actually holds. A swapped coordinate shows up in the 201 body.
   */
  async create(branch: NewBranch): Promise<BranchRow> {
    /*
     * `postGisPoint()` returns `[lng, lat]` as a TUPLE and is spread into the parameter list.
     *
     * The convenient form — building `ST_MakePoint(${lng}, ${lat})` as a string — is an injection
     * site the moment either number comes from a request, which both always do. Here they are two
     * ordinary bound parameters and PostGIS's argument order lives in the mapper's return type
     * rather than in a call site anybody could transpose.
     */
    const [longitude, latitude] = postGisPoint(branch.location);

    /*
     * `tenant_id` comes from the SESSION and never from a parameter — §11.5 `BR5`.
     *
     * The A-01 extension has already set `app.tenant_id` on this connection, and the column's own
     * DEFAULT is this same expression. Writing it explicitly makes the INSERT legible without
     * introducing a caller-chosen tenant, which is the thing `BR5` exists to forbid.
     *
     * ┌─ NO `::char(2)` ON `state_code` OR `country_code`, AND THE CAST WAS THERE UNTIL THE ─────┐
     * │ INT-SPEC RAN                                                                              │
     * │ `branch-write.int-spec.ts` measured both forms against PostgreSQL:                        │
     * │                                                                                          │
     * │     '291'::char(2)                         →  '29', silently                              │
     * │     INSERT '291' INTO a char(2) column     →  ERROR: value too long for type character(2) │
     * │                                                                                          │
     * │ An EXPLICIT cast to `bpchar(n)` truncates; an ASSIGNMENT to the column refuses. On a GST  │
     * │ state code that difference is the whole game — `state_code` decides **CGST + SGST versus  │
     * │ IGST on every future invoice for a sale at this branch**, and `'291'` quietly becoming    │
     * │ `'29'` is Karnataka: a real state, a legal code, and `ck_branches__state_code_shape`      │
     * │ (`^[0-9]{2}$`) passes the truncated value without complaint.                               │
     * │                                                                                          │
     * │ So the only thing between an over-long code and a wrong tax treatment was the DTO's       │
     * │ `^\d{2}$` — one layer, in the lowest-authority place there is. Dropping the cast makes    │
     * │ the database a second layer instead of an accomplice.                                      │
     * └──────────────────────────────────────────────────────────────────────────────────────────┘
     *
     * Both explanations live out here rather than inside the SQL: a backtick in a comment inside a
     * tagged template ENDS the template, and the parse error it produces points at the line after
     * the comment. That cost a build once already, four hours ago.
     */
    const rows = await this.db.inTenantTransaction(
      (tx) => tx.$queryRaw<BranchRow[]>`
      INSERT INTO branches (
        tenant_id, gym_id, name, address_line1, address_line2, city_id, locality_id,
        state, state_code, postal_code, country_code, location, geo_tolerance_metres,
        capacity, is_primary
      ) VALUES (
        current_setting('app.tenant_id')::uuid,
        ${branch.gymId}::uuid,
        ${branch.name},
        ${branch.addressLine1},
        ${branch.addressLine2},
        ${branch.cityId}::uuid,
        ${branch.localityId}::uuid,
        ${branch.state},
        ${branch.stateCode},
        ${branch.postalCode},
        ${branch.countryCode},
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
        ${branch.geoToleranceMetres},
        ${branch.capacity},
        ${branch.isPrimary}
      )
      RETURNING id,
                gym_id                   AS "gymId",
                name,
                address_line1            AS "addressLine1",
                address_line2            AS "addressLine2",
                city_id                  AS "cityId",
                locality_id              AS "localityId",
                state,
                state_code               AS "stateCode",
                postal_code              AS "postalCode",
                country_code             AS "countryCode",
                ST_Y(location::geometry) AS lat,
                ST_X(location::geometry) AS lng,
                geo_tolerance_metres     AS "geoToleranceMetres",
                capacity,
                status::text             AS status,
                is_primary               AS "isPrimary"`,
    );

    const created = rows[0];
    if (created === undefined) {
      // Unreachable through RLS — an INSERT the policy refuses raises rather than returning zero
      // rows. Asserted anyway, because `rows[0]` is `BranchRow | undefined` and the alternative is
      // a non-null assertion that would hide a genuine surprise behind an exclamation mark.
      throw new Error('INSERT INTO branches returned no row');
    }
    return created;
  }

  /**
   * A patch, as ONE static statement — `CASE WHEN <sent> THEN <value> ELSE <column> END` per field.
   *
   * ┌─ WHY NOT A DYNAMICALLY BUILT SET CLAUSE, WHICH IS THE OBVIOUS ANSWER ──────────────────────┐
   * │ Building `SET name = $1, capacity = $2` from the keys present is what every ORM-less        │
   * │ repository does, and here it is not available: composing SQL fragments safely needs         │
   * │ `Prisma.sql`, and `no-raw-prisma-outside-tenancy` (dependency-cruiser, `ADR-0005`) permits  │
   * │ `@prisma/client` imports ONLY under `tenancy/prisma/`. The remaining route is string        │
   * │ concatenation into `$queryRawUnsafe`, which is the one statement class that bypasses the    │
   * │ tenant extension entirely.                                                                   │
   * │                                                                                             │
   * │ So the statement is static and every value is bound. It is longer to read and it cannot be  │
   * │ got wrong by a filter over `Object.keys`.                                                    │
   * │                                                                                             │
   * │ `COALESCE(<value>, <column>)` would have been shorter and is WRONG: it makes an explicit     │
   * │ `null` indistinguishable from an absent field, so `address_line2` and `capacity` could       │
   * │ never be cleared once set. The boolean flag separates "not sent" from "sent as null", which  │
   * │ is the distinction `BranchPatch` documents.                                                  │
   * └─────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  async update(branchId: string, patch: BranchPatch): Promise<BranchRow | null> {
    const has = (key: keyof BranchPatch): boolean => key in patch;
    const point = patch.location === undefined ? null : postGisPoint(patch.location);

    const rows = await this.db.inTenantTransaction(
      (tx) => tx.$queryRaw<BranchRow[]>`
      UPDATE branches SET
        name          = CASE WHEN ${has('name')}::boolean          THEN ${patch.name ?? null}          ELSE name          END,
        address_line1 = CASE WHEN ${has('addressLine1')}::boolean  THEN ${patch.addressLine1 ?? null}  ELSE address_line1 END,
        address_line2 = CASE WHEN ${has('addressLine2')}::boolean  THEN ${patch.addressLine2 ?? null}  ELSE address_line2 END,
        city_id       = CASE WHEN ${has('cityId')}::boolean        THEN ${patch.cityId ?? null}::uuid  ELSE city_id       END,
        locality_id   = CASE WHEN ${has('localityId')}::boolean    THEN ${patch.localityId ?? null}::uuid ELSE locality_id END,
        state         = CASE WHEN ${has('state')}::boolean         THEN ${patch.state ?? null}         ELSE state         END,
        state_code    = CASE WHEN ${has('stateCode')}::boolean     THEN ${patch.stateCode ?? null}      ELSE state_code    END,
        postal_code   = CASE WHEN ${has('postalCode')}::boolean    THEN ${patch.postalCode ?? null}    ELSE postal_code   END,
        capacity      = CASE WHEN ${has('capacity')}::boolean      THEN ${patch.capacity ?? null}      ELSE capacity      END,
        location      = CASE WHEN ${point !== null}::boolean
                             THEN ST_SetSRID(ST_MakePoint(${point?.[0] ?? 0}, ${point?.[1] ?? 0}), 4326)::geography
                             ELSE location END,
        updated_at    = now()
       WHERE id = ${branchId}::uuid
         AND deleted_at IS NULL
      RETURNING id,
                gym_id                   AS "gymId",
                name,
                address_line1            AS "addressLine1",
                address_line2            AS "addressLine2",
                city_id                  AS "cityId",
                locality_id              AS "localityId",
                state,
                state_code               AS "stateCode",
                postal_code              AS "postalCode",
                country_code             AS "countryCode",
                ST_Y(location::geometry) AS lat,
                ST_X(location::geometry) AS lng,
                geo_tolerance_metres     AS "geoToleranceMetres",
                capacity,
                status::text             AS status,
                is_primary               AS "isPrimary"`,
    );

    return rows[0] ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BranchListPort — Gym.md §12.1
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * The paginated, filtered, sorted list.
   *
   * ┌─ THREE STATEMENTS FOR THREE SORTS, AND THE REPETITION IS THE SAFE OPTION ──────────────────┐
   * │ `ORDER BY` cannot take a bound parameter, and `Prisma.sql` composition is unavailable here  │
   * │ for the reason `update()` explains. The alternatives were a `CASE` inside `ORDER BY`, which │
   * │ the planner cannot serve from an index and which makes the keyset predicate unreadable, or  │
   * │ interpolating a validated string, which puts a concatenation on the one route whose filter  │
   * │ is client-supplied and repeatable.                                                           │
   * │                                                                                             │
   * │ Three static statements it is. `BRANCH_SORTS` is the allowlist and the switch below is      │
   * │ exhaustive over it, so a fourth sort added to the type fails to compile here.                │
   * └─────────────────────────────────────────────────────────────────────────────────────────────┘
   *
   * `limit + 1` rows are fetched and the extra one is dropped: that is how `has_more` is answered
   * without a second `COUNT`, which `packages/types` rules out on every page for `NFR-PERF-02`.
   */
  async byId(branchId: string): Promise<BranchRow | null> {
    const rows = await this.db.inTenantTransaction(
      (tx) => tx.$queryRaw<BranchRow[]>`
      SELECT id, gym_id AS "gymId", name, address_line1 AS "addressLine1",
             address_line2 AS "addressLine2", city_id AS "cityId", locality_id AS "localityId",
             state, state_code AS "stateCode", postal_code AS "postalCode",
             country_code AS "countryCode", ST_Y(location::geometry) AS lat,
             ST_X(location::geometry) AS lng, geo_tolerance_metres AS "geoToleranceMetres",
             capacity, status::text AS status, is_primary AS "isPrimary"
        FROM branches
       WHERE id = ${branchId}::uuid
         AND deleted_at IS NULL`,
    );
    return rows[0] ?? null;
  }

  async list(query: ListBranchesQuery): Promise<Page<BranchRow>> {
    const at = decodeCursor(query.cursor);
    const gymIds = [...query.gymIds];
    const status = query.status ?? null;
    const cityId = query.cityId ?? null;
    const take = query.limit + 1;

    /*
     * Every filter is written as `(<absent> OR <predicate>)` so one statement serves all of them.
     *
     * `cardinality($1) = 0` rather than `$1 IS NULL`: an empty repeated query parameter arrives as
     * an empty array, and `gym_id = ANY('{}')` is false for every row — an unfiltered list would
     * silently return nothing.
     */
    const key = at?.k ?? null;
    const id = at?.i ?? null;

    const rows = await this.selectPage(query.sort, gymIds, status, cityId, key, id, take);

    const hasMore = rows.length > query.limit;
    const data = hasMore ? rows.slice(0, query.limit) : rows;
    const last = data.at(-1);

    return {
      data,
      has_more: hasMore,
      next_cursor:
        hasMore && last !== undefined
          ? encodeCursor({ k: query.sort === 'created_at:desc' ? last.id : last.name, i: last.id })
          : null,
    };
  }

  /**
   * The three statements. Split out so `list()` reads as pagination rather than as SQL.
   *
   * `created_at:desc` anchors its cursor on `id` rather than on the timestamp: `created_at` is not
   * unique — a seed or a bulk import writes many rows in the same transaction and therefore at the
   * same `now()` — and `(created_at, id)` as a text cursor would need the timestamp serialised
   * identically on both sides of the round trip. UUIDv7 ids are time-ordered, so ordering by `id`
   * descending IS creation order descending, exactly, with uniqueness for free.
   */
  private async selectPage(
    sort: ListBranchesQuery['sort'],
    gymIds: string[],
    status: BranchStatus | null,
    cityId: string | null,
    key: string | null,
    id: string | null,
    take: number,
  ): Promise<BranchRow[]> {
    switch (sort) {
      case 'name:asc':
        return this.db.inTenantTransaction(
          (tx) => tx.$queryRaw<BranchRow[]>`
          SELECT id, gym_id AS "gymId", name, address_line1 AS "addressLine1",
                 address_line2 AS "addressLine2", city_id AS "cityId", locality_id AS "localityId",
                 state, state_code AS "stateCode", postal_code AS "postalCode",
                 country_code AS "countryCode", ST_Y(location::geometry) AS lat,
                 ST_X(location::geometry) AS lng, geo_tolerance_metres AS "geoToleranceMetres",
                 capacity, status::text AS status, is_primary AS "isPrimary"
            FROM branches
           WHERE deleted_at IS NULL
             AND (cardinality(${gymIds}::uuid[]) = 0 OR gym_id = ANY(${gymIds}::uuid[]))
             AND (${status}::text IS NULL OR status::text = ${status}::text)
             AND (${cityId}::uuid IS NULL OR city_id = ${cityId}::uuid)
             AND (${key}::text IS NULL OR (name, id) > (${key}::text, ${id}::uuid))
           ORDER BY name ASC, id ASC
           LIMIT ${take}`,
        );

      case 'name:desc':
        return this.db.inTenantTransaction(
          (tx) => tx.$queryRaw<BranchRow[]>`
          SELECT id, gym_id AS "gymId", name, address_line1 AS "addressLine1",
                 address_line2 AS "addressLine2", city_id AS "cityId", locality_id AS "localityId",
                 state, state_code AS "stateCode", postal_code AS "postalCode",
                 country_code AS "countryCode", ST_Y(location::geometry) AS lat,
                 ST_X(location::geometry) AS lng, geo_tolerance_metres AS "geoToleranceMetres",
                 capacity, status::text AS status, is_primary AS "isPrimary"
            FROM branches
           WHERE deleted_at IS NULL
             AND (cardinality(${gymIds}::uuid[]) = 0 OR gym_id = ANY(${gymIds}::uuid[]))
             AND (${status}::text IS NULL OR status::text = ${status}::text)
             AND (${cityId}::uuid IS NULL OR city_id = ${cityId}::uuid)
             AND (${key}::text IS NULL OR (name, id) < (${key}::text, ${id}::uuid))
           ORDER BY name DESC, id DESC
           LIMIT ${take}`,
        );

      case 'created_at:desc':
        return this.db.inTenantTransaction(
          (tx) => tx.$queryRaw<BranchRow[]>`
          SELECT id, gym_id AS "gymId", name, address_line1 AS "addressLine1",
                 address_line2 AS "addressLine2", city_id AS "cityId", locality_id AS "localityId",
                 state, state_code AS "stateCode", postal_code AS "postalCode",
                 country_code AS "countryCode", ST_Y(location::geometry) AS lat,
                 ST_X(location::geometry) AS lng, geo_tolerance_metres AS "geoToleranceMetres",
                 capacity, status::text AS status, is_primary AS "isPrimary"
            FROM branches
           WHERE deleted_at IS NULL
             AND (cardinality(${gymIds}::uuid[]) = 0 OR gym_id = ANY(${gymIds}::uuid[]))
             AND (${status}::text IS NULL OR status::text = ${status}::text)
             AND (${cityId}::uuid IS NULL OR city_id = ${cityId}::uuid)
             AND (${id}::uuid IS NULL OR id < ${id}::uuid)
           ORDER BY id DESC
           LIMIT ${take}`,
        );
    }
  }
}
