/** M-010 · `tenancy/types` — §8.1 row 17. */

/** How a tenant scope was established, for the audit row and for metrics. */
export type TenantScopeSource = 'ACCESS_TOKEN' | 'ELEVATION' | 'JOB' | 'SEED';

/** Pool telemetry, read by the exhaustion alert (TR-37). */
export interface PoolSnapshot {
  readonly size: number;
  readonly inUse: number;
  readonly waiting: number;
}
