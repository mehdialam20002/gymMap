/**
 * Scheduling in the gym's timezone — `AC-FND-12.4`, `TR-24`, `TR-07`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * A UTC CRON FIRES AT THE WRONG LOCAL MOMENT FOR EVERY ONE OF THE 24 §C5 JOBS
 *
 * Midnight in a Bengaluru gym is 18:30 UTC on the PREVIOUS day. A "daily at midnight" expiry
 * sweep on `0 0 * * *` runs at 05:30 local — five and a half hours into the business day, after
 * members have already been turned away at the door by a membership the system still considered
 * active.
 *
 * So no job in this system is scheduled by a UTC cron expression. Every one resolves its next
 * firing through `@gymmap/utils`, which requires an explicit IANA zone and has no default.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { ianaTimeZone, nextLocalTimeUtc, type IanaTimeZone } from '@gymmap/utils';

export interface LocalSchedule {
  /** The §C5 job name. */
  readonly jobName: string;
  /** `HH:MM`, in the gym's local time. */
  readonly localTime: string;
  /** The IANA zone. REQUIRED — there is no default, deliberately (`AC-FND-13.2`). */
  readonly zone: IanaTimeZone;
}

/**
 * The next UTC instant at which the schedule fires.
 *
 * A pure function of `(after, localTime, zone)`, so a spec can assert 18:30 UTC without waiting
 * for a clock to reach it, and so the scheduler can be tested against a DST transition rather
 * than only against India's absence of one.
 */
export function nextFiring(schedule: LocalSchedule, after: Date): Date {
  return nextLocalTimeUtc(after, schedule.localTime, schedule.zone);
}

/**
 * Milliseconds until the next firing, floored at zero.
 *
 * Floored because a negative delay passed to `setTimeout` fires immediately — which on a
 * scheduler that recomputes after each run turns a clock adjustment into a tight loop that runs
 * the job continuously.
 */
export function delayUntilNextFiring(schedule: LocalSchedule, after: Date): number {
  return Math.max(0, nextFiring(schedule, after).getTime() - after.getTime());
}

/**
 * The platform-wide zone for jobs that are not per-gym.
 *
 * `Asia/Kolkata`, and named rather than defaulted. A job that operates on the whole platform
 * still has to fire at SOME defensible local moment, and for a single-market launch that is the
 * launch market's — but the call site says so out loud, so a second market's code cannot inherit
 * it by omitting an argument.
 */
export const PLATFORM_ZONE: IanaTimeZone = ianaTimeZone('Asia/Kolkata');

/**
 * A schedule for every gym, in ITS OWN zone.
 *
 * The reason this returns a list rather than one instant: two gyms in `Asia/Kolkata` and
 * `Asia/Kathmandu` have midnights fifteen minutes apart, and a single platform-wide firing would
 * be correct for at most one of them. `TR-07` is that gap, and the seed carries three distinct
 * zones so a naive implementation fails a test rather than a customer.
 */
export function perZoneFirings(
  jobName: string,
  localTime: string,
  zones: readonly IanaTimeZone[],
  after: Date,
): { zone: IanaTimeZone; firesAt: Date }[] {
  const unique = [...new Set(zones)];
  return unique
    .map((zone) => ({ zone, firesAt: nextFiring({ jobName, localTime, zone }, after) }))
    .sort((a, b) => a.firesAt.getTime() - b.firesAt.getTime());
}
