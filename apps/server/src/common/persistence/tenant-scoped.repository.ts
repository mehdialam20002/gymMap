/**
 * M-012 · `TenantScopedRepository` — §C1.4 step 4, §11.5, AC-1, AC-2.
 *
 * The base class every repository over a tenant-owned table extends.
 *
 * ┌─ IT TAKES NO TENANT ID. THAT IS THE ENTIRE DESIGN. ─────────────────────────────────────────┐
 * │ §11.5 BR5 FORBIDS a tenant id parameter on a repository method, and                         │
 * │ `no-tenant-id-parameter` fails the build on one. The reason is not tidiness:                │
 * │                                                                                             │
 * │   findMany(tenantId: string, where: Filter)                                                 │
 * │                                                                                             │
 * │ lets a caller pass the WRONG tenant id. The query that results is syntactically valid, the  │
 * │ database returns rows, and nothing throws — the breach is invisible at the call site and    │
 * │ invisible in review of the caller. Worse, when the parameter and the RLS session variable   │
 * │ DISAGREE, the query returns nothing, and the bug presents as "data missing" rather than     │
 * │ "isolation broken". Somebody then widens the policy to make the data appear.                │
 * │                                                                                             │
 * │ Scope comes from the request context, and the database enforces it. There is nothing to     │
 * │ pass, so there is nothing to pass wrongly.                                                  │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `assertScoped()` fails BEFORE a statement reaches Postgres (AC-1). The Prisma extension would
 * also refuse, so this is belt and braces — but the belt matters: without it a use case runs its
 * validation, its external calls and its cache writes before failing at the first read, and some
 * of that is not undone by the request failing.
 */

import { currentTenantContext } from '../../tenancy/context/tenant-context.als.js';
import { MissingTenantContextError } from '../../tenancy/domain/tenancy.errors.js';
import type { TenantId } from '@gymmap/types';

export abstract class TenantScopedRepository {
  /** The table this repository owns, for error messages that name something greppable. */
  protected abstract readonly entity: string;

  /**
   * Refuses to proceed unless a tenant or platform scope is active.
   *
   * Call at the TOP of every method, before building anything. The cost is one ALS read; the
   * thing it buys is that "no context" can never reach a query builder.
   */
  protected assertScoped(operation: string): void {
    if (currentTenantContext().kind === 'NONE') {
      throw new MissingTenantContextError(this.entity, operation);
    }
  }

  /**
   * The current tenant, for the rare case a repository must WRITE it — `created_by`, or a
   * denormalised `tenant_id` column on an insert.
   *
   * Never for filtering. Filtering is RLS's job, and a repository that adds
   * `where: { tenantId }` on top of the policy has written the predicate twice: the two can
   * disagree after a refactor, and the version that wins is whichever is narrower, silently.
   */
  protected currentTenantIdForWrite(operation: string): TenantId {
    const context = currentTenantContext();
    if (context.kind === 'TENANT') return context.tenantId;

    if (context.kind === 'PLATFORM') {
      // Deliberately refused. `app_platform_ro` is SELECT-only at the database level, so a write
      // under elevation fails in Postgres anyway — but failing HERE names the actual mistake
      // instead of surfacing as a permission error three layers down.
      throw new MissingTenantContextError(
        this.entity,
        `${operation} (attempted a write under PLATFORM scope, which is read-only)`,
      );
    }

    throw new MissingTenantContextError(this.entity, operation);
  }
}

/**
 * M-012 · `ReferenceDataRepository` — the platform-global counterpart. `BR4`.
 *
 * For the fourteen `G-REF` tables of §C2.3: countries, cities, amenities, tax profiles, feature
 * flags. They have no `tenant_id`, no RLS policy, and reading them needs no tenant — a login
 * page cannot know who is logging in before it renders.
 *
 * ┌─ WHY A SEPARATE CLASS RATHER THAN A FLAG ───────────────────────────────────────────────────┐
 * │ `TenantScopedRepository` with `{ skipTenantCheck: true }` would be shorter and would be the │
 * │ wrong shape. A boolean argument is invisible in a review of the CALLER, and the failure     │
 * │ mode is silent: a tenant-owned table read through the exempt path returns every tenant's    │
 * │ rows and looks entirely normal.                                                              │
 * │                                                                                             │
 * │ A distinct base class is GREPPABLE. `grep -r "extends ReferenceDataRepository"` lists every │
 * │ RLS-exempt read in the system on one screen, which is a thing a security reviewer can       │
 * │ actually audit. That is the whole argument.                                                  │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export abstract class ReferenceDataRepository {
  /**
   * The G-REF table this repository reads.
   *
   * Checked against `GLOBAL_MODELS` by `reference-data.spec.ts`: a repository claiming a
   * tenant-owned table as reference data is how the exemption gets abused, and it must fail
   * loudly rather than be caught in review.
   */
  protected abstract readonly referenceTable: string;
}
