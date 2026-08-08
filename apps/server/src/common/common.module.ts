/**
 * M-004 · `CommonModule` — constitution §3.4.3.
 *
 * `@Global()`, and one of only TWO modules permitted to be. Global modules defeat the dependency
 * graph that makes the other twenty-two extractable to services later (ADR-0003), so the
 * exception is narrow: config, logging and error handling are cross-cutting by nature and
 * injecting them explicitly into twenty-two modules would be ceremony with no isolation benefit.
 */

import { Global, Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';

import { APP_CONFIG, loadAppConfig, type AppConfig } from './config/app-config.schema.js';
import { CorrelationMiddleware } from './logging/correlation.middleware.js';
import { HealthController } from './health/health.controller.js';
import { ReadinessService } from './health/readiness.service.js';
import { AccessTokenVerifier } from './auth/access-token.verifier.js';
import { CLOCK, ID_GENERATOR } from './clock/clock.port.js';
import { FamilyDenylist } from './auth/family-denylist.redis.js';
import {
  REDIS_CLIENT,
  RedisConnectionLifecycle,
  redisProvider,
} from './persistence/redis.provider.js';
import { IdempotencyStore } from './idempotency/idempotency.store.js';
import { OUTBOX_PORT } from './outbox/outbox.port.js';
import { OutboxWriter } from './outbox/outbox.writer.js';
import { OutboxDispatcher } from './outbox/outbox.dispatcher.js';
import { JOB_RUN_SINK, JobRunner, LoggingJobRunSink } from './queue/job-runner.js';
import { QueueRegistry } from './queue/queue.registry.js';
import { SystemClock, SystemIdGenerator } from './clock/system-clock.adapter.js';

@Global()
@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: APP_CONFIG,
      // Validated once, at composition time. A malformed environment therefore fails during
      // module construction — before the port is bound — so an unhealthy process never accepts
      // a single request (§8.9).
      useFactory: (): AppConfig => loadAppConfig(),
    },
    ReadinessService,
    // Global because BOTH `TenantContextMiddleware` (which resolves the principal) and
    // `JwtAuthGuard` (which rejects) need it, and they live in different modules. One verifier
    // is the point: two would be two definitions of "a valid token", and they would drift.
    AccessTokenVerifier,
    // AC-FND-13.3 — the ONE place the ambient clock enters the application. Every consumer
    // injects the port, so a test substitutes a FixedClock without a global monkey-patch.
    // M-022 · the guard consults the denylist on every authenticated request, so both it
    // and the Redis connection it needs are part of the kernel rather than of `iam/`.
    redisProvider,
    RedisConnectionLifecycle,
    FamilyDenylist,

    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: SystemIdGenerator },
    // BR-PAY-03. In place BEFORE the first payment path, not retrofitted — retrofitting
    // means auditing every mutating route that already exists and getting one wrong.
    IdempotencyStore,

    // M-018. The writer is exported as a PORT so a use case depends on "record that this
    // happened" rather than on a class that inserts a row — and so nothing can grow a
    // synchronous publish() to call from a request path.
    OutboxWriter,
    { provide: OUTBOX_PORT, useExisting: OutboxWriter },
    OutboxDispatcher,

    // The harness all 24 §C5 jobs consume. BLK-08: the run sink logs today and becomes a table
    // once `job_runs` is in Schema.md's register — no job changes when it does.
    { provide: JOB_RUN_SINK, useClass: LoggingJobRunSink },
    JobRunner,
    QueueRegistry,
  ],
  exports: [
    APP_CONFIG,
    ReadinessService,
    AccessTokenVerifier,
    CLOCK,
    ID_GENERATOR,
    FamilyDenylist,
    REDIS_CLIENT,
    IdempotencyStore,

    // M-018. The writer is exported as a PORT so a use case depends on "record that this
    // happened" rather than on a class that inserts a row — and so nothing can grow a
    // synchronous publish() to call from a request path.
    OutboxWriter,
    { provide: OUTBOX_PORT, useExisting: OutboxWriter },
    OutboxDispatcher,

    // The harness all 24 §C5 jobs consume. BLK-08: the run sink logs today and becomes a table
    // once `job_runs` is in Schema.md's register — no job changes when it does.
    { provide: JOB_RUN_SINK, useClass: LoggingJobRunSink },
    JobRunner,
    QueueRegistry,
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Applied to every route including unmatched ones, so a 404 still carries a correlation id.
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
