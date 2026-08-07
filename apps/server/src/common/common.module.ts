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
import { IdempotencyStore } from './idempotency/idempotency.store.js';
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
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: SystemIdGenerator },
    // BR-PAY-03. In place BEFORE the first payment path, not retrofitted — retrofitting
    // means auditing every mutating route that already exists and getting one wrong.
    IdempotencyStore,
  ],
  exports: [
    APP_CONFIG,
    ReadinessService,
    AccessTokenVerifier,
    CLOCK,
    ID_GENERATOR,
    IdempotencyStore,
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Applied to every route including unmatched ones, so a 404 still carries a correlation id.
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
