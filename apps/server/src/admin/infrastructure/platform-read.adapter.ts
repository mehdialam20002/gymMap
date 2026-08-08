/**
 * The `PLATFORM_READ_PORT` adapter.
 *
 * ┌─ TWO DIFFERENT DATABASE PATHS, AND THE DIFFERENCE IS NOT INCIDENTAL ────────────────────────┐
 * │ TENANTS are RLS-protected. `rls_tenants__platform_read` grants `SELECT` to `app_platform_ro` │
 * │ and to nothing else, so reading across them needs the separate read-only pool AND an audited │
 * │ elevation. That goes through `ElevatedTenantReader`, which owns the audit write so `admin/`  │
 * │ never touches it (`FolderStructure.md` §8.2).                                                 │
 * │                                                                                              │
 * │ USERS, ROLES and SESSIONS are IDENTITY class. No `tenant_id`, no RLS — a session belongs to  │
 * │ a PERSON, who may hold roles in several tenants or none. Counting them needs no elevation,   │
 * │ and wrapping them in one would put meaningless rows in the audit log and train whoever reads │
 * │ it to skip them.                                                                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Injectable } from '@nestjs/common';

import {
  ElevatedTenantReader,
  PrismaService,
  type TenantStatusCounts,
  type TenantSummary,
} from '../../tenancy/index.js';
import type { PlatformReadPort, ReadContext } from '../application/ports/platform-read.port.js';

@Injectable()
export class PlatformReadAdapter implements PlatformReadPort {
  constructor(
    private readonly tenants: ElevatedTenantReader,
    // The ORDINARY client, not the platform one. `PlatformPrismaService.client` throws outside
    // `runElevated()` by design, and these four counts need no elevation: `Role` and
    // `Permission` are GLOBAL class, `User`, `UserRole` and `AuthSession` are IDENTITY class,
    // and the tenant-context extension lets both through without a tenant.
    private readonly db: PrismaService,
  ) {}

  private static actor(context: ReadContext) {
    return {
      actor: { kind: 'HUMAN' as const, userId: context.userId, permission: context.permission },
      why: context.why,
    };
  }

  countGymsByStatus(context: ReadContext): Promise<TenantStatusCounts> {
    return this.tenants.countByStatus(PlatformReadAdapter.actor(context));
  }

  listGyms(context: ReadContext, limit = 200): Promise<readonly TenantSummary[]> {
    return this.tenants.listTenants(PlatformReadAdapter.actor(context), limit);
  }

  /**
   * People per role key.
   *
   * Counts GRANTS, not people, and the distinction is deliberate: one person can hold
   * `GYM_OWNER` at two gyms, and both grants are real. `revokedAt: null` is what keeps a revoked
   * role out of the count — without it the number only ever grows.
   */
  async countPeopleByRole(): Promise<Readonly<Record<string, number>>> {
    const grouped = await this.db.client.userRole.groupBy({
      by: ['roleId'],
      where: { revokedAt: null },
      _count: { _all: true },
    });

    const roles = await this.db.client.role.findMany({ select: { id: true, key: true } });
    const keyOf = new Map(roles.map((role) => [role.id, String(role.key)]));

    return Object.fromEntries(
      grouped
        .map((group) => [keyOf.get(group.roleId) ?? 'UNKNOWN', group._count._all] as const)
        .filter(([key]) => key !== 'UNKNOWN'),
    );
  }

  countPeople(): Promise<number> {
    // Erased accounts are excluded. `BR-DAT-04` erasure blanks the identity and keeps the row, so
    // counting them would report people the platform can no longer identify.
    return this.db.client.user.count({ where: { deletedAt: null, erasedAt: null } });
  }

  countActiveSessions(): Promise<number> {
    return this.db.client.authSession.count({
      where: { status: 'ACTIVE', revokedAt: null },
    });
  }
}
