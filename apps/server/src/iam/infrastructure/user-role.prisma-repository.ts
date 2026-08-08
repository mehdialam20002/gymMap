/**
 * `M-023` · `USER_ROLE_STORE` on Prisma — `FR-RBAC-07`, `BR-TEN-01`, `AC-STAF-01.4`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * `user_roles` HAS A `tenant_id` AND NO RLS POLICY, AND THAT COMBINATION IS THE TRAP
 *
 * Everywhere else in this codebase, "do not pass a tenant id" is safe because the Prisma tenant
 * extension wraps the query in a transaction that sets `app.tenant_id` and a row-level policy does
 * the filtering (`A-01`, `BR-TEN-01`). `UserRole` is in `IDENTITY_MODELS`
 * (`tenancy/prisma/tenant-scoped-client.ts`): it is NOT wrapped, and the table carries no policy.
 *
 * So an `assignmentsFor()` that simply omitted the tenant would not be "scoped by RLS" — it would
 * return EVERY tenant's grants. And the caller counts owners:
 *
 *   `mayChangeRole` would see owners belonging to other gyms, conclude this gym still has one, and
 *   permit demoting its last owner. The tenant locks itself out of its own account, the query is
 *   syntactically perfect, and nothing throws.
 *
 * The filter is therefore EXPLICIT and comes from the request context — never from an argument,
 * which `gymmap/no-tenant-id-parameter` forbids for the reason that a caller can pass the wrong one.
 * Same rule, different mechanism: the ambient tenant, applied by hand because nothing else will.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ NO TENANT IN CONTEXT IS A REFUSAL, NOT AN UNFILTERED READ ──────────────────────────────────┐
 * │ `currentTenantContext()` answers `NO_TENANT` rather than throwing, which is right for the many │
 * │ call sites that legitimately run outside a tenant — and lethal here, because the natural       │
 * │ `where: { tenantId: context.tenantId }` would become `where: { tenantId: undefined }`, and     │
 * │ Prisma DROPS an undefined filter. The most dangerous possible query, written by omission.      │
 * │                                                                                              │
 * │ Both methods therefore refuse when no tenant is established. A role change outside a tenant    │
 * │ has no meaning; failing loudly is the only correct answer.                                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../tenancy/prisma/prisma.service.js';
import { currentTenantContext } from '../../tenancy/context/tenant-context.als.js';
import { MissingTenantContextError } from '../../tenancy/domain/tenancy.errors.js';
import { CLOCK, type Clock } from '../../common/clock/clock.port.js';
import type { UserRoleStore } from '../application/change-user-role.use-case.js';
import type { TenantRoleAssignment } from '../domain/last-owner.policy.js';
import type { PlatformRole } from '../types/iam.types.js';

@Injectable()
export class UserRolePrismaRepository implements UserRoleStore {
  constructor(
    private readonly db: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * The tenant this call is scoped to, or a refusal.
   *
   * Read once per operation and returned as a plain string, so no query can be written against a
   * possibly-`undefined` field — the type makes the dangerous version unrepresentable rather than
   * merely discouraged.
   */
  private tenantId(operation: string): string {
    const context = currentTenantContext();
    if (context.kind !== 'TENANT') {
      // `MissingTenantContextError` rather than a new code. Its registry entry already says exactly
      // what applies here: *"A 500, never a 403 and never an empty result set (`Security.md` P3). An
      // empty result set is indistinguishable from a correct answer, so the isolation failure would
      // go unnoticed."* An unscoped read of this table is that failure.
      throw new MissingTenantContextError('UserRole', operation);
    }
    return context.tenantId;
  }

  /**
   * Every LIVE role assignment in the current tenant.
   *
   * `revokedAt: null` is load-bearing twice over. Revocation is a timestamp, never a delete
   * (`AC-STAF-01.4`), so a revoked owner is still a row — and counting it would let the last real
   * owner be demoted on the strength of somebody who was offboarded last year.
   *
   * `tenantId` matches EXACTLY, which excludes the `NULL` rows. That is deliberate: a `NULL`
   * `tenant_id` is a platform grant (`ERD.md` §3.1), so a `SUPER_ADMIN` is not one of this gym's
   * owners and must not be counted as the reason it is safe to remove one.
   */
  async assignmentsFor(): Promise<readonly TenantRoleAssignment[]> {
    const rows = await this.db.client.userRole.findMany({
      where: { tenantId: this.tenantId('assignmentsFor'), revokedAt: null },
      select: { userId: true, role: { select: { key: true } } },
    });

    return rows.map((row) => ({ userId: row.userId, role: row.role.key }));
  }

  /**
   * Replaces one user's role within the current tenant, returning the role they held before.
   *
   * ┌─ REVOKE-THEN-GRANT IN ONE TRANSACTION, AND NEVER AN UPDATE ────────────────────────────────┐
   * │ The obvious implementation is `update({ where: { userId, tenantId }, data: { roleId } })`.   │
   * │ It is wrong for the reason the schema comment on `revoked_at` gives: rewriting the row       │
   * │ destroys the record that the previous grant ever existed, and `granted_at` then describes a  │
   * │ grant that never happened. Attribution is the point of the column.                          │
   * │                                                                                            │
   * │ So the old rows are stamped revoked and a new row is inserted. Both in one interactive       │
   * │ transaction, because the state in between — a user with no role at all — is one a concurrent │
   * │ authorisation check could observe, and it would deny a request the user was entitled to make.│
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   *
   * Returns `null` when the user held nothing here, which is the correct answer for a first grant
   * rather than an error: the audit row's `before` is then honestly empty.
   */
  async replaceRole(userId: string, role: PlatformRole): Promise<PlatformRole | null> {
    const tenantId = this.tenantId('replaceRole');
    const now = this.clock.now();

    return this.db.client.$transaction(async (tx) => {
      const existing = await tx.userRole.findMany({
        where: { tenantId, userId, revokedAt: null },
        select: { id: true, role: { select: { key: true } } },
      });

      // Plural on purpose. The unique index is `UNIQUE NULLS NOT DISTINCT` on the grant triple, so
      // one user CAN legitimately hold two different roles in the same tenant. Revoking only the
      // first would leave the other live and the caller would believe the role had been replaced.
      if (existing.length > 0) {
        await tx.userRole.updateMany({
          where: { id: { in: existing.map((row) => row.id) } },
          data: { revokedAt: now, updatedBy: null },
        });
      }

      const nextRole = await tx.role.findUniqueOrThrow({
        where: { key: role },
        select: { id: true },
      });

      await tx.userRole.create({
        data: { userId, tenantId, roleId: nextRole.id, grantedAt: now },
      });

      // The role they held before. When there were several, the one the domain cares about is an
      // owner if any of them was — the last-owner policy is about owners, not about ordering.
      const before = existing.find((row) => row.role.key === 'GYM_OWNER') ?? existing[0];
      return before?.role.key ?? null;
    });
  }
}
