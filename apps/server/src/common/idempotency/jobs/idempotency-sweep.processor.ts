/**
 * The expiry sweep — `TR-36`, `ADR-0032`. DECLARED here, SCHEDULED by M-018.
 *
 * ┌─ IT RUNS AS `app_migrator`, AND THAT IS THE WHOLE REASON IT IS A JOB ───────────────────────┐
 * │ `app_rw` — the request path's role — holds no DELETE grant on `idempotency_keys`. If it     │
 * │ did, a retry could delete the very record that would have made it a replay, and the second  │
 * │ execution would come from code that looks like cleanup.                                      │
 * │                                                                                              │
 * │ So the physical removal runs elsewhere, as a role the request path cannot assume, in a job   │
 * │ a reviewer reads.                                                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE SWEEP IS NOT THE EXPIRY MECHANISM ─────────────────────────────────────────────────────┐
 * │ `IdempotencyStore` checks `expiresAt <= now` on every read. The sweep only reclaims SPACE.   │
 * │                                                                                              │
 * │ That split matters: a sweep that is behind — because the worker was down, or the batch is    │
 * │ large — must not mean that expired responses keep replaying. Correctness lives on the read   │
 * │ path, where it cannot be late.                                                               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `M-018` gives this a BullMQ registration and a schedule. Declared now because M-017 creates the
 * rows, and a table that accumulates rows with no reclamation path is a table that fills a disk
 * on a date nobody predicted.
 */

/** The §C5 job name. One name, used by the scheduler, the log line and the runbook. */
export const IDEMPOTENCY_SWEEP_JOB = 'common.idempotency-sweep' as const;

/**
 * Batched, deliberately.
 *
 * A single unbounded `DELETE FROM idempotency_keys WHERE expires_at < now()` takes a lock
 * proportional to the row count, and on a busy day that is a lock held across the payment path.
 * Ten thousand at a time, repeated, keeps every individual statement short.
 */
export const SWEEP_BATCH_SIZE = 10_000;

/**
 * Runs at 03:00 LOCAL, not 03:00 UTC.
 *
 * `TR-24`. 03:00 UTC is 08:30 in India — inside the morning gym rush, which is when the payment
 * path is busiest. The scheduler resolves this through `nextLocalTimeUtc` (`@gymmap/utils`)
 * rather than a UTC cron expression.
 */
export const SWEEP_LOCAL_TIME = '03:00' as const;

export interface SweepResult {
  readonly deleted: number;
  readonly batches: number;
}

export interface SweepDeps {
  /** Deletes up to `limit` expired rows and returns how many went. Runs as `app_migrator`. */
  readonly deleteExpiredBatch: (limit: number) => Promise<number>;
  readonly now: () => Date;
}

/**
 * The sweep itself, as a pure-ish function over its dependencies.
 *
 * Separated from any BullMQ registration so it is testable without a queue — M-018 wires the
 * processor around this, and a job whose logic can only be exercised through Redis is a job
 * nobody tests.
 */
export async function runIdempotencySweep(deps: SweepDeps): Promise<SweepResult> {
  let deleted = 0;
  let batches = 0;

  for (;;) {
    const removed = await deps.deleteExpiredBatch(SWEEP_BATCH_SIZE);
    deleted += removed;
    batches += 1;
    if (removed < SWEEP_BATCH_SIZE) break;

    // A guard against an unbounded loop if `deleteExpiredBatch` ever stopped making progress —
    // a job that runs forever holds a worker slot and is harder to notice than one that fails.
    if (batches > 1_000) {
      throw new Error(
        `${IDEMPOTENCY_SWEEP_JOB}: ${batches} batches without draining. Either the table has ` +
          'grown past ten million expired rows, or deleteExpiredBatch is not deleting what it ' +
          'counts. Both need a human before this runs again.',
      );
    }
  }

  return { deleted, batches };
}
