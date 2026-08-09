/**
 * `M-026` · `applications` on Prisma — `BR-GYM-05`, `BR-TEN-01`.
 *
 * ┌─ NOTHING HERE FILTERS BY TENANT, AND THAT IS CORRECT ───────────────────────────────────────┐
 * │ `applications` is TENANT-OWNED with RLS enabled and forced, so the Prisma tenant extension    │
 * │ wraps every operation in a transaction that sets `app.tenant_id` and the policy does the      │
 * │ filtering (`A-01`). Adding a `where: { tenantId }` would be a second copy of the same rule,   │
 * │ and the copy is the one that goes stale.                                                      │
 * │                                                                                              │
 * │ This is the OPPOSITE of `user-role.prisma-repository.ts`, which filters by hand because       │
 * │ `user_roles` is an IDENTITY model carrying a `tenant_id` and NO policy. The difference is not │
 * │ style — it is which table you are looking at, and `tenant-scoped-client.ts`'s                 │
 * │ `IDENTITY_MODELS` is the list that decides. Getting it backwards either way is silent.        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../tenancy/prisma/prisma.service.js';
import { currentTenantContext } from '../../tenancy/context/tenant-context.als.js';
import { MissingTenantContextError } from '../../tenancy/domain/tenancy.errors.js';
import type { ApplicationStatus } from '../types/onboarding.types.js';

@Injectable()
export class ApplicationPrismaRepository {
  constructor(private readonly db: PrismaService) {}

  /**
   * The tenant's current dossier — the highest version.
   *
   * Ordered by `version`, not `submittedAt`: two rows could share a timestamp under a clock that
   * moved, and the version is the sequence `uq_applications__tenant_version` makes unforgeable.
   */
  async current(): Promise<{ id: string; version: number; status: ApplicationStatus } | null> {
    const row = await this.db.client.application.findFirst({
      orderBy: { version: 'desc' },
      select: { id: true, version: true, status: true },
    });

    return row === null ? null : { id: row.id, version: row.version, status: row.status };
  }

  /**
   * Submits the next version.
   *
   * The version is computed from the current maximum HERE rather than supplied by a caller. A
   * caller-supplied version is a caller-CHOSEN version, and the unique constraint would turn the
   * resulting collision into a 500 on a legitimate resubmission.
   *
   * The remaining race — two submissions computing the same next version — is settled by that same
   * constraint rather than by a lock: one INSERT wins, the other raises, and the loser retries with
   * a number that is now correct. A lock would serialise every tenant's submissions on one row.
   */
  async submitNextVersion(snapshot: unknown): Promise<{ id: string; version: number }> {
    /*
     * ┌─ THE TENANT COMES FROM THE CONTEXT, AND A LINT RULE CORRECTED ME HERE ──────────────────┐
     * │ The first version took `tenantId` as a parameter with a comment arguing it was safe       │
     * │ because the RLS `WITH CHECK` would refuse a wrong value. `gymmap/no-tenant-id-parameter`  │
     * │ failed the build, and the rule is right: the policy refusing a bad write is a BACKSTOP,   │
     * │ not a licence to hand callers a knob that only the backstop stops. §11.5 `BR5` — tenant   │
     * │ scope comes from the request context, never from an argument.                              │
     * │                                                                                          │
     * │ The extension sets `app.tenant_id` for the POLICY but does not inject the column into     │
     * │ `data`, and `applications.tenant_id` is `NOT NULL` — so the value is read here, from the   │
     * │ same context the policy reads, and the two cannot disagree.                                │
     * └──────────────────────────────────────────────────────────────────────────────────────────┘
     */
    const context = currentTenantContext();
    if (context.kind !== 'TENANT') {
      throw new MissingTenantContextError('Application', 'submitNextVersion');
    }

    const latest = await this.db.client.application.findFirst({
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    return this.db.client.application.create({
      data: {
        tenantId: context.tenantId,
        version: (latest?.version ?? 0) + 1,
        snapshot: snapshot as never,
      },
      select: { id: true, version: true },
    });
  }
}
