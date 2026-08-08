/**
 * What `admin/` needs from the rest of the system in order to read the platform.
 *
 * A port rather than the concrete services, per `§8.1` row 7. The point is not ceremony: the
 * implementations sit behind an AUDITED cross-tenant elevation and a separate read-only database
 * role, and the use case must be testable without either. A test that has to stand up
 * `PlatformPrismaService` to assert "awaiting review sums three statuses" is a test nobody writes.
 */

import type { TenantStatusCounts, TenantSummary } from '../../../tenancy/index.js';

/** Who is asking, and why. Both end up on an audit row — `PE2`, `FR-ADMN-02`. */
export interface ReadContext {
  readonly userId: string;
  /** The permission the operator exercised. Recorded, not checked, here. */
  readonly permission: string;
  /** At least 20 characters. `reason()` throws below that. */
  readonly why: string;
}

export const PLATFORM_READ_PORT = Symbol('PlatformReadPort');

export interface PlatformReadPort {
  countGymsByStatus(context: ReadContext): Promise<TenantStatusCounts>;
  /**
   * The whole register, up to `limit`.
   *
   * Paginated in the BROWSER today, which is only defensible while the register is small enough
   * to send whole. `SCR-ADM-004` will need server-side paging with a total count — the moment
   * this cap is reached the tab counts silently start describing the page rather than the
   * platform, which is a wrong number rather than a missing feature. Recorded on the cap itself
   * so whoever raises it next reads this first.
   */
  listGyms(context: ReadContext, limit?: number): Promise<readonly TenantSummary[]>;
  /** Keyed by `roles.key`. Identity tables carry no `tenant_id`, so no elevation is involved. */
  countPeopleByRole(): Promise<Readonly<Record<string, number>>>;
  countPeople(): Promise<number>;
  countActiveSessions(): Promise<number>;
}
