/**
 * M-004 · The queue role — `NFR-SCAL-05`, `L2`, AC-8.
 *
 * BINDS NO HTTP LISTENER. This is asserted by `worker-no-listener.spec.ts`, not left to
 * discipline: `createApplicationContext` rather than `create` is a one-word difference that a
 * future edit could reverse without anyone noticing, and the consequence — a worker holding a
 * port, being added to the load balancer, and receiving API traffic it cannot serve — looks like
 * an intermittent 502 rather than like a misconfiguration.
 *
 * ┌─ M-018 · WHAT THE WORKER REGISTERS, AND WHAT IT DELIBERATELY DOES NOT ──────────────────────┐
 * │ The two §C5 jobs that exist are registered in the QueueRegistry below, so `pnpm start:worker`│
 * │ prints what is scheduled and the runbook has something to check against.                     │
 * │                                                                                              │
 * │ The BullMQ CONNECTION is not opened here. A worker that connects to Redis at boot cannot     │
 * │ start when Redis is down — and the whole point of `NFR-AVL-03`'s degradation contract is     │
 * │ that a queue outage degrades notifications rather than preventing the process from running.  │
 * │ The queue is attached by the first milestone that actually enqueues something.                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { APP_CONFIG, type AppConfig } from './common/config/app-config.schema.js';
import { QueueRegistry, platformScheduled, polled } from './common/queue/queue.registry.js';
import {
  AUDIT_PARTITION_MAINTENANCE,
  AUDIT_PARTITION_MAINTENANCE_TIME,
} from './audit/jobs/audit-partition-maintenance.processor.js';
import {
  IDEMPOTENCY_SWEEP_JOB,
  SWEEP_LOCAL_TIME,
} from './common/idempotency/jobs/idempotency-sweep.processor.js';

/** The outbox relay. Polled rather than scheduled — Schema.md §13.1 says every five seconds. */
export const OUTBOX_DISPATCH_INTERVAL_MS = 5_000;

/**
 * Registers the §C5 jobs that exist.
 *
 * Exported so `worker-no-listener.spec.ts` and the harness spec can assert the registry's
 * contents without booting a container — and so "what is scheduled" is answerable from one
 * function rather than from a grep.
 */
export function registerJobs(registry: QueueRegistry): QueueRegistry {
  registry.register(
    platformScheduled(AUDIT_PARTITION_MAINTENANCE, AUDIT_PARTITION_MAINTENANCE_TIME),
  );
  registry.register(
    platformScheduled(
      {
        name: IDEMPOTENCY_SWEEP_JOB,
        // AC-FND-12.3. Deleting a row that is already gone is a no-op, so a re-run after a
        // partial failure removes what is left rather than erroring.
        idempotent: true,
        expectedDurationMs: 30_000,
      },
      SWEEP_LOCAL_TIME,
    ),
  );
  registry.register(
    polled(
      {
        name: 'common.outbox-dispatch',
        // AC-FND-12.3, and the reason at-least-once dispatch is acceptable: a row already
        // PUBLISHED is not claimed again, and a handler that runs twice is idempotent itself.
        idempotent: true,
        expectedDurationMs: 5_000,
      },
      OUTBOX_DISPATCH_INTERVAL_MS,
    ),
  );
  return registry;
}

export async function bootstrapWorker() {
  // `createApplicationContext` gives the full DI container with NO HTTP adapter.
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();
  return app;
}

if (process.env['NODE_ENV'] !== 'test') {
  bootstrapWorker()
    .then((app) => {
      const config = app.get<AppConfig>(APP_CONFIG);
      const registry = registerJobs(app.get(QueueRegistry));
      const logger = new Logger('worker');
      logger.log(`Queue role started · env=${config.APP_ENV} (no HTTP listener)`);
      // Printed at boot so "what is scheduled, and when" is answerable from the process's own
      // first log lines rather than from reading three source files during an incident.
      for (const job of registry.summary()) {
        logger.log(`  ${job.name} · ${job.schedule} · budget ${job.expectedDurationMs}ms`);
      }
    })
    .catch((error: unknown) => {
      // eslint-disable-next-line no-console -- TD-030 sibling: a worker that fails to build its DI container has no logger yet. One line, in a bootstrap catch, before exit.
      console.error('Worker failed to start:\n', error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
