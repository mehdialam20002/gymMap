/**
 * `audit.partition-maintenance` — the harness's FIRST consumer. `TR-41`, `CI-10`.
 *
 * ┌─ THE PARTITION THAT DOES NOT EXIST IS A MONTH OF WRITES THAT VANISH ────────────────────────┐
 * │ `audit_log` is partitioned monthly. A row whose `occurred_at` falls in a month with no       │
 * │ partition raises "no partition of relation audit_log found for row" — and because the audit │
 * │ writer is BEST-EFFORT (it logs and swallows, so an audit outage is not a total outage), the │
 * │ result is that every audit write for that month is silently dropped.                         │
 * │                                                                                              │
 * │ So the job creates partitions AHEAD. Three months of headroom, not one: one month means a    │
 * │ single missed run is an outage, and this job runs monthly.                                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ AND `CI-10`: EVERY PARTITION CARRIES ITS OWN RLS ──────────────────────────────────────────┐
 * │ PostgreSQL applies a partitioned parent's policies when a partition is reached THROUGH the  │
 * │ parent. Addressing a partition BY NAME applies only that partition's own policies. A        │
 * │ partition created without ENABLE, FORCE and the policy pair is a month of every tenant's    │
 * │ audit history readable by any tenant — created by a job at 2am, reviewed by nobody.         │
 * │                                                                                              │
 * │ `audit_log_create_partition(date)` (M-013) does all of it in one function, so this job       │
 * │ cannot create a partition and forget the policies.                                           │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import type { JobDefinition } from '../../common/queue/job-runner.js';

export const AUDIT_PARTITION_MAINTENANCE: JobDefinition = {
  name: 'audit.partition-maintenance',
  // AC-FND-12.3. Creating a partition that exists is a no-op — the function is
  // CREATE TABLE IF NOT EXISTS throughout — so a re-run after a partial failure is safe, which
  // is what makes at-least-once dispatch acceptable.
  idempotent: true,
  expectedDurationMs: 5_000,
};

/** Local 02:00, not 02:00 UTC. `TR-24` — 02:00 UTC is 07:30 in India, inside the morning rush. */
export const AUDIT_PARTITION_MAINTENANCE_TIME = '02:00' as const;

/** Three months of headroom. One would make a single missed run an outage. */
export const PARTITION_MONTHS_AHEAD = 3;

export interface PartitionGateway {
  /** `SELECT audit_log_create_partition($1)`. Idempotent; creates the policies and grants too. */
  createPartitionFor(month: Date): Promise<void>;
}

/**
 * Creates this month's partition and the next `PARTITION_MONTHS_AHEAD`.
 *
 * The month is derived in UTC, unlike almost everything else in this system — deliberately. A
 * partition boundary is a property of the stored `timestamptz` column, not of any gym's local
 * calendar, and deriving it per-timezone would produce overlapping partitions, which Postgres
 * rejects outright.
 */
export async function runAuditPartitionMaintenance(
  gateway: PartitionGateway,
  now: Date,
): Promise<{ created: number }> {
  let created = 0;
  for (let offset = 0; offset <= PARTITION_MONTHS_AHEAD; offset += 1) {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    await gateway.createPartitionFor(month);
    created += 1;
  }
  return { created };
}
