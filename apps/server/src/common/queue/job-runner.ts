/**
 * The job harness all 24 `§C5` jobs consume — `AC-FND-12.1`, `AC-FND-12.2`, `AC-FND-12.3`,
 * `AC-FND-09.5`.
 *
 * ┌─ FOUR THINGS EVERY JOB GETS WITHOUT ASKING ─────────────────────────────────────────────────┐
 * │ a distributed lock   so a schedule firing on three workers executes ONCE (`TR-25`)          │
 * │ a correlation id     so the job's log lines join the request that caused it (`AC-FND-09.5`) │
 * │ a duration alert     so a job that is merely SLOW is visible before it is a failure          │
 * │ a run record         start, end, outcome                                                     │
 * │                                                                                              │
 * │ Given to every job by the harness rather than left to each one, because twenty-four jobs    │
 * │ each remembering four things is twenty-four chances to forget one — and the one that forgets │
 * │ the lock is the one that runs the settlement build twice.                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ BLK-08: THE RUN RECORD IS A LOG LINE, NOT YET A TABLE ─────────────────────────────────────┐
 * │ M-018's file list names a `job_runs` table. `Schema.md` §4's register is a CLOSED list of    │
 * │ 79 tables and does not contain one, and adding an eightieth is a schema amendment rather     │
 * │ than a milestone's prerogative.                                                              │
 * │                                                                                              │
 * │ So `JobRunSink` is a port. The logging adapter satisfies `AC-FND-12.2`'s "records start, end │
 * │ and outcome" today; a database adapter drops in behind the same port once the register is    │
 * │ amended, and no job changes. The distributed lock does NOT depend on the table — it is a     │
 * │ Postgres advisory lock, which is the better mechanism anyway (see `distributed-lock.ts`).    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { CLOCK, type Clock } from '../clock/clock.port.js';
import { runWithCorrelation } from '../logging/correlation.als.js';
import { withDistributedLock, type AdvisoryLockGateway } from './distributed-lock.js';

export type JobOutcome = 'SUCCEEDED' | 'FAILED' | 'SKIPPED_LOCKED';

export interface JobRun {
  readonly jobName: string;
  readonly lockScope: string;
  readonly correlationId: string;
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly outcome: JobOutcome;
  readonly durationMs: number;
  readonly error?: string;
  /** True when the run exceeded `expectedDurationMs`. `AC-FND-12.2` alerts on this. */
  readonly overran: boolean;
}

export const JOB_RUN_SINK = Symbol('JobRunSink');

/** Where run records go. A log line today; a table once `job_runs` is in the register (BLK-08). */
export interface JobRunSink {
  record(run: JobRun): Promise<void>;
}

export interface JobDefinition {
  /** The §C5 job name. One name for the scheduler, the log line, the lock and the runbook. */
  readonly name: string;
  /** `'global'`, or a tenant id for a per-tenant job. */
  readonly lockScope?: string;
  /**
   * How long this job is expected to take.
   *
   * `AC-FND-12.2` requires an alert on EXCEEDING it, not only on failure. A settlement build
   * that usually takes 40 seconds and today took 40 minutes has not failed — it will succeed,
   * late, after the payout window closed. That is invisible to a failure-only alert.
   */
  readonly expectedDurationMs: number;
  /**
   * `AC-FND-12.3` — every §C5 job is idempotent by construction.
   *
   * Declared rather than assumed, because the harness dispatches at-least-once and a job that
   * is not idempotent will eventually run twice. `false` is not a permitted value; the field
   * exists so the claim is made explicitly at each job's definition site.
   */
  readonly idempotent: true;
}

@Injectable()
export class JobRunner {
  private readonly logger = new Logger(JobRunner.name);

  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(JOB_RUN_SINK) private readonly sink: JobRunSink,
  ) {}

  /**
   * Runs a job under its lock, with a correlation id, recording the outcome.
   *
   * @param inheritedCorrelationId The originating request's id, where the job was triggered by
   *   one. `AC-FND-09.5` / DoD #29 — a trace must not stop at the HTTP boundary. A scheduled job
   *   has no originating request, so one is minted rather than left absent: a job with no trace
   *   id is a job whose log lines cannot be joined to anything.
   */
  async run<T>(
    gateway: AdvisoryLockGateway,
    definition: JobDefinition,
    work: () => Promise<T>,
    inheritedCorrelationId?: string,
  ): Promise<{ outcome: JobOutcome; result?: T }> {
    const correlationId = inheritedCorrelationId ?? randomUUID();
    const scope = definition.lockScope ?? 'global';
    const startedAt = this.clock.now();

    return runWithCorrelation(
      { correlationId, origin: `job:${definition.name}` },
      async (): Promise<{ outcome: JobOutcome; result?: T }> => {
        let outcome: JobOutcome = 'SUCCEEDED';
        let error: string | undefined;
        let result: T | undefined;

        try {
          const locked = await withDistributedLock(gateway, definition.name, scope, work);
          if (!locked.ran) {
            // The NORMAL outcome on two of three workers. Recorded as its own outcome rather
            // than as a failure, so a dashboard does not show two thirds of every schedule
            // erroring.
            outcome = 'SKIPPED_LOCKED';
          } else {
            result = locked.result as T;
          }
        } catch (caught) {
          outcome = 'FAILED';
          error = caught instanceof Error ? caught.message : String(caught);
        }

        const endedAt = this.clock.now();
        const durationMs = endedAt.getTime() - startedAt.getTime();
        const overran = outcome === 'SUCCEEDED' && durationMs > definition.expectedDurationMs;

        const run: JobRun = {
          jobName: definition.name,
          lockScope: scope,
          correlationId,
          startedAt,
          endedAt,
          outcome,
          durationMs,
          overran,
          ...(error === undefined ? {} : { error }),
        };

        // Recorded before the throw, so a failed job still leaves a record. A `finally` would
        // also work; this is explicit because the ordering is the point.
        await this.sink.record(run).catch((sinkError: unknown) => {
          this.logger.error({
            message: 'JOB RUN RECORD FAILED — the job ran and is not in the record',
            jobName: definition.name,
            error: sinkError instanceof Error ? sinkError.message : String(sinkError),
          });
        });

        if (overran) {
          // AC-FND-12.2. A job that is merely slow will succeed, late — after the window it was
          // supposed to hit. Failure-only alerting never sees it.
          this.logger.warn({
            message: 'JOB OVERRAN its expected duration',
            jobName: definition.name,
            durationMs,
            expectedDurationMs: definition.expectedDurationMs,
          });
        }

        if (outcome === 'FAILED') {
          this.logger.error({ message: 'JOB FAILED', jobName: definition.name, error });
        }

        return result === undefined ? { outcome } : { outcome, result };
      },
    );
  }
}

/**
 * The logging sink. `AC-FND-12.2` today; BLK-08's table drops in behind the same port.
 *
 * One structured line per run, at a level chosen by the outcome — so "did last night's job run"
 * is answerable from the aggregator until it is answerable from a table.
 */
@Injectable()
export class LoggingJobRunSink implements JobRunSink {
  private readonly logger = new Logger('JobRun');

  record(run: JobRun): Promise<void> {
    const payload = {
      message: 'job run',
      jobName: run.jobName,
      lockScope: run.lockScope,
      outcome: run.outcome,
      durationMs: run.durationMs,
      overran: run.overran,
      startedAt: run.startedAt.toISOString(),
      endedAt: run.endedAt.toISOString(),
      ...(run.error === undefined ? {} : { error: run.error }),
    };

    if (run.outcome === 'FAILED') this.logger.error(payload);
    else this.logger.log(payload);

    return Promise.resolve();
  }
}
