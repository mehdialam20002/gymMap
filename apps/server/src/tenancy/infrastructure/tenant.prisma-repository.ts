/**
 * M-012 · The `tenants` repository — §7.3.1 row 20, AC-2.
 *
 * NO METHOD HERE TAKES A TENANT ID. `no-tenant-id-parameter` fails the build on one, and the
 * absence is the design: scope comes from the request context and the database enforces it, so
 * there is nothing to pass and therefore nothing to pass wrongly.
 *
 * Nor does any method add `where: { id: tenantId }`. The RLS policy already restricts the row
 * set; adding the predicate again writes it twice, and two copies can disagree after a refactor
 * — with the narrower one silently winning.
 */

import { Injectable } from '@nestjs/common';

import { TenantScopedRepository } from '../../common/persistence/tenant-scoped.repository.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** The four fields `GET /v1/tenant/ping` returns. Deliberately not the whole row. */
export interface TenantSummary {
  readonly id: string;
  readonly tradingName: string | null;
  readonly timezone: string;
  readonly status: string;
}

@Injectable()
export class TenantPrismaRepository extends TenantScopedRepository {
  protected readonly entity = 'tenants';

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * The caller's own tenant.
   *
   * `findFirst` with no `where`, which looks wrong and is not: the RLS policy on `tenants` is
   * class P-SELF (`id = current_setting('app.tenant_id')`), so the visible row set for a
   * tenant-scoped session is exactly one row — its own. Adding `where: { id: … }` would restate
   * the policy in application code, which is the duplication §11.5 exists to prevent.
   *
   * Returns `null` rather than throwing when nothing is visible. The caller turns that into a
   * 404, never a 403 — see the controller for why that distinction is load-bearing.
   */
  async findOwnTenant(): Promise<TenantSummary | null> {
    this.assertScoped('findOwnTenant');

    const row = await this.prisma.client.tenant.findFirst({
      select: { id: true, tradingName: true, timezone: true, status: true },
      // Soft-deleted tenants are invisible everywhere except the retention job (ADR-0024).
      where: { deletedAt: null },
    });

    return row satisfies TenantSummary | null;
  }

  /**
   * Counts the tenants visible to the current scope.
   *
   * Exists for the isolation suite's assertion A3, which checks a COLLECTION is filtered rather
   * than a single row. Under a tenant scope the answer is always 1 — a tenant that could count
   * the table could count the platform's customers.
   */
  async countVisible(): Promise<number> {
    this.assertScoped('countVisible');
    return this.prisma.client.tenant.count({ where: { deletedAt: null } });
  }

  /**
   * Looks up a tenant BY ID.
   *
   * The id here is NOT a tenant scope — it is the id of the resource being requested, and the
   * distinction matters. The policy still applies, so asking for another tenant's id returns
   * `null`: the caller cannot learn whether that id exists.
   *
   * That is what makes the controller's 404 honest rather than a polite fiction.
   */
  async findVisibleById(id: string): Promise<TenantSummary | null> {
    this.assertScoped('findVisibleById');

    return this.prisma.client.tenant.findFirst({
      select: { id: true, tradingName: true, timezone: true, status: true },
      where: { id, deletedAt: null },
    });
  }
}
