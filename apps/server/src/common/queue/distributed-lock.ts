/**
 * The distributed lock — `AC-FND-12.1`, `TR-25`, `AC-EP01-19`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * A POSTGRES ADVISORY LOCK, AND NOT A ROW IN A `job_runs` TABLE
 *
 * The M-018 file list names a `job_runs` table and uses it for both the run record and the lock.
 * The run record is deferred (BLK-08 — `job_runs` is not among Schema.md's closed 79-table
 * register). The LOCK does not need it, and is better without it:
 *
 *   an advisory lock   is released automatically when the session ends. A worker that is
 *                      OOM-killed mid-job releases its lock the instant its connection drops.
 *   a lock row         survives the worker that wrote it. A crashed worker leaves the job
 *                      wedged until somebody notices and deletes a row by hand — and the
 *                      standard mitigation, a TTL, means guessing a duration and then having a
 *                      long-running job lose its lock to its own slowness.
 *
 * `TR-25` is the failure this prevents: a schedule that fires on three workers runs the
 * settlement build three times. `pg_try_advisory_lock` returns FALSE rather than waiting, so the
 * two losers skip immediately instead of queueing up to run the same job again afterwards.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { createHash } from 'node:crypto';

/** The raw SQL surface. Structural, so `common/` imports no Prisma type. */
export interface AdvisoryLockGateway {
  /** `pg_try_advisory_lock(key)`. TRUE if acquired, FALSE if somebody else holds it. */
  tryAcquire(key: bigint): Promise<boolean>;
  release(key: bigint): Promise<void>;
}

/**
 * Hashes a job name and scope to the 64-bit integer `pg_advisory_lock` takes.
 *
 * SHA-256, truncated to 63 bits and kept POSITIVE. Postgres advisory keys are signed `bigint`,
 * and a negative key works — but it prints as a negative number in `pg_locks`, which makes the
 * "who holds this lock" query during an incident harder to read than it needs to be.
 *
 * A hash rather than a counter, because the key must be derivable from the job name alone: two
 * workers that computed it differently would both acquire, and the whole mechanism would be a
 * no-op that looks like it works.
 */
export function lockKey(jobName: string, scope = 'global'): bigint {
  const digest = createHash('sha256').update(`${jobName}::${scope}`, 'utf8').digest();
  return digest.readBigUInt64BE(0) & 0x7fff_ffff_ffff_ffffn;
}

export interface LockedResult<T> {
  readonly ran: boolean;
  readonly result?: T;
}

/**
 * Runs `work` while holding the lock, or reports that somebody else has it.
 *
 * Returns `{ ran: false }` rather than throwing when the lock is held. A skipped run is the
 * NORMAL outcome on two of three workers, and an exception would make the ordinary case look
 * like a failure in every dashboard.
 *
 * The `finally` releases even when `work` throws. Without it a failed job holds its lock until
 * the connection closes, and a worker with a long-lived pool holds it for hours — so the next
 * schedule silently skips and the job appears to have stopped running.
 */
export async function withDistributedLock<T>(
  gateway: AdvisoryLockGateway,
  jobName: string,
  scope: string,
  work: () => Promise<T>,
): Promise<LockedResult<T>> {
  const key = lockKey(jobName, scope);

  const acquired = await gateway.tryAcquire(key);
  if (!acquired) return { ran: false };

  try {
    return { ran: true, result: await work() };
  } finally {
    await gateway.release(key);
  }
}
