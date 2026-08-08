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
  listGyms(context: ReadContext, limit?: number): Promise<readonly TenantSummary[]>;
  /** Keyed by `roles.key`. Identity tables carry no `tenant_id`, so no elevation is involved. */
  countPeopleByRole(): Promise<Readonly<Record<string, number>>>;
  countPeople(): Promise<number>;
  countActiveSessions(): Promise<number>;
}
