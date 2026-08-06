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
  ],
  exports: [APP_CONFIG, ReadinessService],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Applied to every route including unmatched ones, so a 404 still carries a correlation id.
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
