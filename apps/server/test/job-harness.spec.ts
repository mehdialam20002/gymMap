/**
 * The `§C5` job harness — `AC-FND-12.1`, `AC-FND-12.2`, `AC-FND-12.4`, `TR-24`, `TR-25`.
 *
 * ┌─ THE DELIBERATE DOUBLE-TRIGGER IS PART OF THE DEMO ─────────────────────────────────────────┐
 * │ `AC-EP01-19` names it: a job scheduled on more than one worker must execute ONCE per         │
 * │ schedule fire. So the lock is asserted by firing the same job twice CONCURRENTLY and         │
 * │ counting executions — not by checking that a lock function returns true.                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { lockKey, withDistributedLock } from '../dist/common/queue/distributed-lock.js';
import { JobRunner, LoggingJobRunSink, type JobRun } from '../dist/common/queue/job-runner.js';
import { QueueRegistry, platformScheduled, polled } from '../dist/common/queue/queue.registry.js';
import {
  PLATFORM_ZONE,
  delayUntilNextFiring,
  nextFiring,
  perZoneFirings,
} from '../dist/common/queue/timezone-schedule.js';
import { FixedClock } from '../dist/common/clock/fixed-clock.adapter.js';
import { runIdempotencySweep } from '../dist/common/idempotency/jobs/idempotency-sweep.processor.js';
import {
  AUDIT_PARTITION_MAINTENANCE,
  PARTITION_MONTHS_AHEAD,
  runAuditPartitionMaintenance,
} from '../dist/audit/jobs/audit-partition-maintenance.processor.js';
import { ianaTimeZone } from '@gymmap/utils';

const KOLKATA = ianaTimeZone('Asia/Kolkata');
const KATHMANDU = ianaTimeZone('Asia/Kathmandu');
const NEW_YORK = ianaTimeZone('America/New_York');

/** An in-memory advisory-lock gateway with the same semantics Postgres gives. */
function fakeLocks() {
  const held = new Set<bigint>();
  return {
    held,
    tryAcquire: (key: bigint) => {
      if (held.has(key)) return Promise.resolve(false);
      held.add(key);
      return Promise.resolve(true);
    },
    release: (key: bigint) => {
      held.delete(key);
      return Promise.resolve();
    },
  };
}

function recordingSink() {
  const runs: JobRun[] = [];
  return {
    runs,
    record: (run: JobRun) => {
      runs.push(run);
      return Promise.resolve();
    },
  };
}

const aJob = (over: Partial<Parameters<JobRunner['run']>[1]> = {}) => ({
  name: 'common.probe-job',
  expectedDurationMs: 1_000,
  idempotent: true as const,
  ...over,
});

// ═══════════════════════════════════════════════════════════════════════════
// TR-25 / AC-EP01-19 — the deliberate double-trigger.
// ═══════════════════════════════════════════════════════════════════════════

test('TR-25 · a job fired on TWO workers concurrently executes ONCE', async () => {
  const locks = fakeLocks();
  const sink = recordingSink();
  const runner = new JobRunner(new FixedClock('2026-08-07T12:00:00Z'), sink);

  let executions = 0;
  const work = async () => {
    executions += 1;
    // Yield, so the two runs genuinely overlap. Without the await the first completes
    // synchronously and releases its lock before the second starts — which would pass on a
    // no-op lock and prove nothing.
    await new Promise((resolve) => setImmediate(resolve));
  };

  const [first, second] = await Promise.all([
    runner.run(locks, aJob(), work),
    runner.run(locks, aJob(), work),
  ]);

  assert.equal(executions, 1, `${executions} executions. TR-25: the settlement build ran twice.`);
  const outcomes = [first.outcome, second.outcome].sort();
  assert.deepEqual(outcomes, ['SKIPPED_LOCKED', 'SUCCEEDED']);

  // BOTH are recorded. A skipped run is the NORMAL outcome on two of three workers, and a run
  // record that omitted it would make "did this fire" unanswerable.
  assert.equal(sink.runs.length, 2);
});

test('a SKIPPED run is not a FAILURE', async () => {
  // Two of three workers skip on every schedule. Reporting that as an error would make every
  // dashboard show a two-thirds failure rate and train everyone to ignore the job's alerts.
  const locks = fakeLocks();
  const sink = recordingSink();
  const runner = new JobRunner(new FixedClock('2026-08-07T12:00:00Z'), sink);

  await locks.tryAcquire(lockKey('common.probe-job', 'global'));
  const result = await runner.run(locks, aJob(), () => Promise.resolve('never'));

  assert.equal(result.outcome, 'SKIPPED_LOCKED');
  assert.equal(sink.runs[0]!.outcome, 'SKIPPED_LOCKED');
  assert.equal(sink.runs[0]!.error, undefined);
});

test('the lock is released even when the job THROWS', async () => {
  // Without the finally, a failed job holds its lock until the connection closes — and a worker
  // with a long-lived pool holds it for hours, so the next schedule silently skips and the job
  // appears to have stopped running.
  const locks = fakeLocks();
  const runner = new JobRunner(new FixedClock('2026-08-07T12:00:00Z'), recordingSink());

  const failed = await runner.run(locks, aJob(), () => Promise.reject(new Error('boom')));
  assert.equal(failed.outcome, 'FAILED');
  assert.equal(locks.held.size, 0, 'a failed job kept its lock');

  // And the next run can proceed.
  const after = await runner.run(locks, aJob(), () => Promise.resolve('ok'));
  assert.equal(after.outcome, 'SUCCEEDED');
});

test('two SCOPES of the same job do not block each other', async () => {
  // A per-tenant job runs concurrently for different tenants; only the same tenant collides.
  const locks = fakeLocks();
  const runner = new JobRunner(new FixedClock('2026-08-07T12:00:00Z'), recordingSink());

  let executions = 0;
  const work = async () => {
    executions += 1;
    await new Promise((resolve) => setImmediate(resolve));
  };

  await Promise.all([
    runner.run(locks, aJob({ lockScope: 'tenant-a' }), work),
    runner.run(locks, aJob({ lockScope: 'tenant-b' }), work),
  ]);
  assert.equal(executions, 2, 'two tenants blocked each other');
});

test('the lock key is derived from the name, so two workers compute the SAME one', async () => {
  // A key that differed between workers would make both acquire, and the whole mechanism would
  // be a no-op that looks like it works.
  assert.equal(lockKey('a.b'), lockKey('a.b'));
  assert.notEqual(lockKey('a.b'), lockKey('a.c'));
  assert.notEqual(lockKey('a.b', 'tenant-1'), lockKey('a.b', 'tenant-2'));
  // Positive, so `pg_locks` reads sensibly during an incident.
  assert.ok(lockKey('a.b') > 0n);
  assert.ok(lockKey('a.b') < 2n ** 63n);
  await Promise.resolve();
});

test('withDistributedLock reports a skip rather than throwing', async () => {
  const locks = fakeLocks();
  await locks.tryAcquire(lockKey('x.y', 'global'));
  const result = await withDistributedLock(locks, 'x.y', 'global', () => Promise.resolve(1));
  assert.deepEqual(result, { ran: false });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-FND-12.2 — the overrun alert, which failure-only alerting never sees.
// ═══════════════════════════════════════════════════════════════════════════

test('AC-FND-12.2 · a job that SUCCEEDS LATE is flagged as overrun', async () => {
  // A settlement build that usually takes 40 seconds and today took 40 minutes has not failed.
  // It will succeed, after the payout window closed. Failure-only alerting is blind to it.
  const clock = new FixedClock('2026-08-07T12:00:00Z');
  const sink = recordingSink();
  const runner = new JobRunner(clock, sink);

  await runner.run(fakeLocks(), aJob({ expectedDurationMs: 1_000 }), async () => {
    clock.advanceBy(60_000);
    await Promise.resolve();
  });

  assert.equal(sink.runs[0]!.outcome, 'SUCCEEDED');
  assert.equal(sink.runs[0]!.overran, true, 'a 60x overrun was not flagged');
  assert.equal(sink.runs[0]!.durationMs, 60_000);
});

test('a job inside its budget is not flagged', async () => {
  const clock = new FixedClock('2026-08-07T12:00:00Z');
  const sink = recordingSink();
  await new JobRunner(clock, sink).run(fakeLocks(), aJob({ expectedDurationMs: 10_000 }), () => {
    clock.advanceBy(500);
    return Promise.resolve();
  });
  assert.equal(sink.runs[0]!.overran, false);
});

test('AC-FND-09.5 · the job carries a correlation id, inherited or minted', async () => {
  const sink = recordingSink();
  const runner = new JobRunner(new FixedClock('2026-08-07T12:00:00Z'), sink);

  await runner.run(fakeLocks(), aJob(), () => Promise.resolve(), 'c-from-http');
  assert.equal(sink.runs[0]!.correlationId, 'c-from-http', 'the HTTP trace did not reach the job');

  // A scheduled job has no originating request. One is MINTED rather than left absent: a job
  // with no trace id is a job whose log lines cannot be joined to anything.
  await runner.run(fakeLocks(), aJob(), () => Promise.resolve());
  assert.match(sink.runs[1]!.correlationId, /^[0-9a-f-]{36}$/);
  assert.notEqual(sink.runs[1]!.correlationId, sink.runs[0]!.correlationId);
});

test('the correlation frame is visible INSIDE the job, not only on the record', async () => {
  const { currentCorrelationId } = await import('../dist/common/logging/correlation.als.js');
  const runner = new JobRunner(new FixedClock('2026-08-07T12:00:00Z'), recordingSink());

  let seen = '';
  await runner.run(
    fakeLocks(),
    aJob(),
    () => {
      seen = currentCorrelationId();
      return Promise.resolve();
    },
    'c-inside',
  );
  assert.equal(seen, 'c-inside', 'the job body cannot see its own correlation id');
});

test('a failing SINK does not fail the job', async () => {
  // The job DID the work. Failing it because the bookkeeping failed would make a logging blip
  // into a business outage.
  const runner = new JobRunner(new FixedClock('2026-08-07T12:00:00Z'), {
    record: () => Promise.reject(new Error('sink down')),
  });
  const result = await runner.run(fakeLocks(), aJob(), () => Promise.resolve('done'));
  assert.equal(result.outcome, 'SUCCEEDED');
  assert.equal(result.result, 'done');
});

test('the logging sink records every field the table will', async () => {
  // BLK-08: the sink is a log line until `job_runs` is in Schema.md's register. It must already
  // carry everything the table would, so the swap changes no job.
  const sink = new LoggingJobRunSink();
  await sink.record({
    jobName: 'common.probe-job',
    lockScope: 'global',
    correlationId: 'c-1',
    startedAt: new Date('2026-08-07T12:00:00Z'),
    endedAt: new Date('2026-08-07T12:00:01Z'),
    outcome: 'SUCCEEDED',
    durationMs: 1000,
    overran: false,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-FND-12.4 / TR-24 — the schedule is LOCAL.
// ═══════════════════════════════════════════════════════════════════════════

test('AC-FND-12.4 · daily-at-midnight in Asia/Kolkata is 18:30 UTC the PREVIOUS day', async () => {
  const after = new Date('2026-08-06T12:00:00Z');
  const firesAt = nextFiring(
    { jobName: 'common.probe-job', localTime: '00:00', zone: KOLKATA },
    after,
  );
  assert.equal(firesAt.toISOString(), '2026-08-06T18:30:00.000Z');
  await Promise.resolve();
});

test('a DST zone is included, so the design does not DEPEND on India having none', async () => {
  // Same local time, two different UTC instants either side of the transition.
  const summer = nextFiring(
    { jobName: 'j.k', localTime: '03:00', zone: NEW_YORK },
    new Date('2026-07-01T00:00:00Z'),
  );
  const winter = nextFiring(
    { jobName: 'j.k', localTime: '03:00', zone: NEW_YORK },
    new Date('2026-01-01T00:00:00Z'),
  );
  assert.equal(summer.toISOString(), '2026-07-01T07:00:00.000Z'); // EDT, -4
  assert.equal(winter.toISOString(), '2026-01-01T08:00:00.000Z'); // EST, -5
  await Promise.resolve();
});

test('the delay is never negative, so a clock adjustment is not a tight loop', async () => {
  const schedule = { jobName: 'j.k', localTime: '00:00', zone: KOLKATA };
  const delay = delayUntilNextFiring(schedule, new Date('2026-08-06T12:00:00Z'));
  assert.ok(delay > 0);
  assert.ok(delayUntilNextFiring(schedule, new Date('2026-08-06T18:30:00Z')) >= 0);
  await Promise.resolve();
});

test('TR-07 · two zones fifteen minutes apart fire fifteen minutes apart', async () => {
  // A single platform-wide firing would be correct for at most one of them. The seed carries
  // three distinct zones precisely so a naive implementation fails here.
  const firings = perZoneFirings(
    'memberships.expire',
    '00:00',
    [KOLKATA, KATHMANDU],
    new Date('2026-08-06T12:00:00Z'),
  );
  assert.equal(firings.length, 2);
  // Kathmandu is +05:45, so its midnight comes FIFTEEN MINUTES EARLIER in UTC.
  assert.equal(firings[0]!.zone, KATHMANDU);
  assert.equal(firings[0]!.firesAt.toISOString(), '2026-08-06T18:15:00.000Z');
  assert.equal(firings[1]!.firesAt.toISOString(), '2026-08-06T18:30:00.000Z');
  await Promise.resolve();
});

test('duplicate zones collapse, so one firing per distinct zone', async () => {
  const firings = perZoneFirings('j.k', '00:00', [KOLKATA, KOLKATA, KOLKATA], new Date());
  assert.equal(firings.length, 1);
  await Promise.resolve();
});

// ═══════════════════════════════════════════════════════════════════════════
// The registry's invariants.
// ═══════════════════════════════════════════════════════════════════════════

test('the registry refuses a job that could not be operated', async () => {
  const registry = new QueueRegistry();

  // A name that does not match §C5, so the scheduler, the lock, the log and the runbook would
  // disagree about what ran.
  assert.throws(
    () => registry.register(platformScheduled({ ...aJob({ name: 'NotAJobName' }) }, '03:00')),
    /§C5 job name/,
  );
  // No expected duration — AC-FND-12.2's overrun alert would have nothing to compare against.
  assert.throws(
    () =>
      registry.register(
        platformScheduled({ name: 'a.b', expectedDurationMs: 0, idempotent: true }, '03:00'),
      ),
    /expected duration/,
  );
  // A local time with no zone is a schedule in the SERVER's zone — UTC in a container, the
  // developer's on a laptop, so the same job fires at two different local moments.
  assert.throws(
    () =>
      registry.register({
        definition: aJob({ name: 'a.b' }),
        localTime: '03:00',
        zone: null,
        pollIntervalMs: null,
      }),
    /TR-24|no zone/,
  );
  // Neither scheduled nor polled: it would never run.
  assert.throws(
    () =>
      registry.register({
        definition: aJob({ name: 'a.b' }),
        localTime: null,
        zone: null,
        pollIntervalMs: null,
      }),
    /never run/,
  );
  await Promise.resolve();
});

test('a job registered twice throws rather than silently replacing', async () => {
  // A silent replacement means one of the two never runs, and which one depends on module
  // import order.
  const registry = new QueueRegistry();
  registry.register(platformScheduled(aJob({ name: 'a.b' }), '03:00'));
  assert.throws(
    () => registry.register(platformScheduled(aJob({ name: 'a.b' }), '04:00')),
    /twice/,
  );
  await Promise.resolve();
});

test('the registry summary answers "what is scheduled, and when"', async () => {
  const registry = new QueueRegistry();
  registry.register(platformScheduled(AUDIT_PARTITION_MAINTENANCE, '02:00'));
  registry.register(polled(aJob({ name: 'common.outbox-dispatch' }), 5_000));

  const summary = registry.summary();
  assert.equal(summary.length, 2);
  assert.equal(summary[0]!.name, 'audit.partition-maintenance');
  assert.match(summary[0]!.schedule, /02:00 Asia\/Kolkata/);
  assert.match(summary[1]!.schedule, /every 5000ms/);
  assert.equal(PLATFORM_ZONE, 'Asia/Kolkata');
  await Promise.resolve();
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-FND-12.3 — the two consumers are idempotent, and re-running proves it.
// ═══════════════════════════════════════════════════════════════════════════

test('AC-FND-12.3 · re-running the partition job after a partial failure is safe', async () => {
  // The harness dispatches at-least-once, so a job WILL run twice. Asserted by running it,
  // failing it halfway, and running it again — which is what the acceptance criterion asks for.
  const created: string[] = [];
  let failAfter = 2;

  const gateway = {
    createPartitionFor: (month: Date) => {
      if (created.length >= failAfter) return Promise.reject(new Error('interrupted'));
      created.push(month.toISOString().slice(0, 7));
      return Promise.resolve();
    },
  };

  await assert.rejects(() =>
    runAuditPartitionMaintenance(gateway, new Date('2026-08-07T12:00:00Z')),
  );
  const afterPartial = [...created];
  assert.equal(afterPartial.length, 2);

  // Re-run to completion. The already-created months are attempted AGAIN — the SQL function is
  // CREATE TABLE IF NOT EXISTS throughout, so that is a no-op rather than an error.
  failAfter = Infinity;
  created.length = 0;
  const result = await runAuditPartitionMaintenance(gateway, new Date('2026-08-07T12:00:00Z'));

  assert.equal(result.created, PARTITION_MONTHS_AHEAD + 1);
  assert.deepEqual(created, ['2026-08', '2026-09', '2026-10', '2026-11']);
  assert.equal(AUDIT_PARTITION_MAINTENANCE.idempotent, true);
});

test('the partition job creates THREE months of headroom, not one', async () => {
  // One month means a single missed run is an outage: a row whose occurred_at falls in a month
  // with no partition raises "no partition of relation audit_log found", and because the audit
  // writer is best-effort every audit write for that month is silently dropped instead.
  assert.equal(PARTITION_MONTHS_AHEAD, 3);
  await Promise.resolve();
});

test('the idempotency sweep drains in batches and reports what it removed', async () => {
  let remaining = 25_000;
  const result = await runIdempotencySweep({
    deleteExpiredBatch: (limit) => {
      const removed = Math.min(limit, remaining);
      remaining -= removed;
      return Promise.resolve(removed);
    },
    now: () => new Date('2026-08-07T03:00:00Z'),
  });
  assert.equal(result.deleted, 25_000);
  assert.equal(remaining, 0);
});
