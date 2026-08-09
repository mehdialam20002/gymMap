/**
 * `M-030` `AC-1` `AC-9` `AC-10` · Running the six checks and persisting the set.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * IDEMPOTENT MEANS REPLACE, NOT APPEND — AND THAT IS AC-9 IN ONE LINE
 *
 * `AC-9`: *"re-running it on the same version **replaces** the result set rather than appending,
 * and re-running is safe after a partial failure."*
 *
 * Appending would be the natural implementation and it is wrong in a way that compounds: a version
 * re-checked three times would show three `GEO_DISTANCE` rows, a reviewer would see the first and
 * `outstanding()` would count each of them. Worse, a flag CLEARED by a re-run would still be in the
 * list beside its own resolution, so the console would show an outstanding item that no longer
 * exists and approval would keep demanding a reason for it.
 *
 * The set is keyed by check name and written whole.
 *
 * ┌─ A CHECK THAT THROWS DOES NOT TAKE THE OTHERS WITH IT ───────────────────────────────────────┐
 * │ Six independent checks, and the geocoder is the one most likely to be down. If one rejection  │
 * │ aborted the run, an outage in a single vendor would leave the application with NO pre-check   │
 * │ results at all — and a reviewer with an empty panel reads it as "nothing to worry about"       │
 * │ rather than "nothing ran".                                                                     │
 * │                                                                                              │
 * │ So every check is settled independently and a rejection becomes that check's `ERROR`. The set │
 * │ is always complete: six results, every time, whatever happened.                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { Inject, Injectable } from '@nestjs/common';

import { CLOCK, type Clock } from '../../common/clock/clock.port.js';
import type { AdvisoryLockGateway } from '../../common/queue/distributed-lock.js';
import { JobRunner, type JobDefinition } from '../../common/queue/job-runner.js';
import {
  PRECHECK_NAMES,
  errored,
  type PrecheckName,
  type PrecheckResult,
} from '../domain/precheck-result.vo.js';

/**
 * `§C5`'s job identity — one name for the scheduler, the lock, the log line and the runbook.
 */
export const RUN_PRECHECKS_JOB: JobDefinition = {
  name: 'onboarding.run-prechecks',
  /*
   * Scoped per APPLICATION rather than globally.
   *
   * A global lock would serialise every gym's pre-checks behind one another — at Sprint-2 volumes
   * that is merely slow, and at `NFR-SCAL-01`'s Year-1 figures it is a queue that never drains.
   * The race the lock exists to prevent is two workers checking the SAME submission, which a
   * per-application scope prevents exactly.
   */
  lockScope: 'application',
  /*
   * Six checks, of which the geocoder is the only network call. 30 seconds is generous for that
   * and tight enough that a hung vendor connection produces an overrun alert rather than a job
   * nobody notices is stuck — `AC-FND-12.2` alerts on exceeding this, not only on failure.
   */
  expectedDurationMs: 30_000,
  idempotent: true,
};

/** One check, reduced to the only shape the runner needs to know about. */
export type CheckRunner = () => Promise<PrecheckResult>;

export interface PrecheckSuite {
  /** Keyed by name so a missing check is a compile error rather than a short array. */
  readonly checks: Readonly<Record<PrecheckName, CheckRunner>>;
}

export interface PrecheckResultStore {
  /**
   * Writes the WHOLE set for one application version, replacing whatever was there.
   *
   * Replacing rather than merging is `AC-9`. It also makes a partial failure safe: a run that dies
   * halfway leaves the previous complete set in place rather than a half-updated one.
   */
  replaceFor(applicationId: string, results: readonly PrecheckResult[]): Promise<void>;
}

export const PRECHECK_RESULT_STORE = Symbol('PRECHECK_RESULT_STORE');

@Injectable()
export class RunPrechecksProcessor {
  constructor(
    private readonly runner: JobRunner,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(PRECHECK_RESULT_STORE) private readonly store: PrecheckResultStore,
  ) {}

  /**
   * @param applicationId the version being checked. The lock scope, so two workers handed the same
   *                      submission do not both run the suite.
   */
  async run(
    gateway: AdvisoryLockGateway,
    applicationId: string,
    suite: PrecheckSuite,
  ): Promise<readonly PrecheckResult[]> {
    let results: readonly PrecheckResult[] = [];

    /*
     * The lock scope is the APPLICATION id, overriding the definition's placeholder.
     *
     * `lockKey()` hashes name plus scope, so two workers handed the same submission compute the
     * same key and one skips — while two DIFFERENT submissions never contend.
     */
    await this.runner.run(gateway, { ...RUN_PRECHECKS_JOB, lockScope: applicationId }, async () => {
      results = await this.settleAll(suite);
      await this.store.replaceFor(applicationId, results);
    });

    return results;
  }

  /**
   * Every check runs; every failure becomes that check's own `ERROR`.
   *
   * `allSettled` rather than `all`: `all` rejects on the first failure and abandons the rest, which
   * is how one vendor outage produces an empty panel.
   */
  private async settleAll(suite: PrecheckSuite): Promise<readonly PrecheckResult[]> {
    const ranAt = this.clock.now();

    const settled = await Promise.allSettled(PRECHECK_NAMES.map((name) => suite.checks[name]()));

    return settled.map((outcome, index) => {
      const name = PRECHECK_NAMES[index] as PrecheckName;
      if (outcome.status === 'fulfilled') return outcome.value;

      /*
       * A check that threw rather than returning `ERROR` is a bug in that check — every one of
       * them is written to catch its own failures. Caught here anyway, because the alternative is
       * an unhandled rejection taking the worker down and leaving the set unwritten.
       */
      const reason =
        outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      return errored(name, `the check threw instead of reporting: ${reason}`, ranAt);
    });
  }
}
