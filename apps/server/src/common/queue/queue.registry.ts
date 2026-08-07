/**
 * The `§C5` job registry — `AC-FND-12.3`, `TR-24`.
 *
 * ┌─ ONE PLACE THAT KNOWS WHAT JOBS EXIST ──────────────────────────────────────────────────────┐
 * │ §C5 names twenty-four jobs. The question "what is scheduled, when, and has it run" is asked │
 * │ during every incident, and the answer must not be "grep for addCron across the codebase".   │
 * │                                                                                              │
 * │ Registering here is also what makes the invariants checkable: the spec below asserts that    │
 * │ every registered job declares `idempotent: true`, has a positive expected duration, and      │
 * │ carries a §C5-shaped name — none of which a scattered set of registrations could be held to. │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Injectable } from '@nestjs/common';

import type { IanaTimeZone } from '@gymmap/utils';
import type { JobDefinition } from './job-runner.js';
import { PLATFORM_ZONE } from './timezone-schedule.js';

export interface RegisteredJob {
  readonly definition: JobDefinition;
  /** `HH:MM` local, or `null` for a job driven by a poll rather than a clock. */
  readonly localTime: string | null;
  /**
   * The zone the local time is interpreted in. REQUIRED where `localTime` is set — `TR-24`, and
   * there is no default anywhere in this system's time handling (`AC-FND-13.2`).
   */
  readonly zone: IanaTimeZone | null;
  /** Poll interval, for the jobs that are continuous rather than scheduled. */
  readonly pollIntervalMs: number | null;
}

/** `<module>.<kebab-name>`, matching the §C5 naming and the runbook. */
const JOB_NAME = /^[a-z][a-z0-9]*\.[a-z][a-z0-9-]*$/;

@Injectable()
export class QueueRegistry {
  private readonly jobs = new Map<string, RegisteredJob>();

  register(job: RegisteredJob): void {
    const { name } = job.definition;

    if (!JOB_NAME.test(name)) {
      throw new Error(
        `"${name}" is not a §C5 job name. The shape is <module>.<kebab-name> — the same string ` +
          'the scheduler, the lock, the log line and the runbook all use, so the four cannot ' +
          'disagree about what ran.',
      );
    }
    if (this.jobs.has(name)) {
      throw new Error(
        `"${name}" is registered twice. A silent replacement means one of the two never runs, ` +
          'and which one depends on module import order.',
      );
    }
    if (job.definition.expectedDurationMs <= 0) {
      throw new Error(
        `"${name}" declares no expected duration. AC-FND-12.2 alerts on OVERRUN as well as on ` +
          'failure — a job that will succeed forty minutes late, after its window closed, is ' +
          'invisible to failure-only alerting.',
      );
    }
    // `TR-24`. A scheduled job with no zone would be scheduled in the server's, which is UTC in
    // a container and the developer's on a laptop — so the same job fires at two different local
    // moments depending on where it runs.
    if (job.localTime !== null && job.zone === null) {
      throw new Error(
        `"${name}" has a local time and no zone. Midnight in a Bengaluru gym is 18:30 UTC the ` +
          "previous day (TR-24); a schedule with no zone is a schedule in the server's zone.",
      );
    }
    if (job.localTime === null && job.pollIntervalMs === null) {
      throw new Error(`"${name}" is neither scheduled nor polled, so it would never run.`);
    }

    this.jobs.set(name, job);
  }

  all(): RegisteredJob[] {
    return [...this.jobs.values()].sort((a, b) =>
      a.definition.name.localeCompare(b.definition.name),
    );
  }

  get(name: string): RegisteredJob | undefined {
    return this.jobs.get(name);
  }

  /** What the runbook and the `/readyz` detail print. */
  summary(): { name: string; schedule: string; expectedDurationMs: number }[] {
    return this.all().map((job) => ({
      name: job.definition.name,
      schedule:
        job.localTime === null
          ? `every ${job.pollIntervalMs}ms`
          : `${job.localTime} ${String(job.zone)}`,
      expectedDurationMs: job.definition.expectedDurationMs,
    }));
  }
}

/** A scheduled job in the platform zone. Says "platform" out loud rather than defaulting. */
export function platformScheduled(definition: JobDefinition, localTime: string): RegisteredJob {
  return { definition, localTime, zone: PLATFORM_ZONE, pollIntervalMs: null };
}

/** A continuously-polled job — the outbox dispatcher is the only one at Sprint 0. */
export function polled(definition: JobDefinition, pollIntervalMs: number): RegisteredJob {
  return { definition, localTime: null, zone: null, pollIntervalMs };
}
