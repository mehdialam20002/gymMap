/**
 * M-010 · `tenancy/` — the SECOND and LAST permitted `@Global()` module (§3.4.3).
 *
 * Global because every module needs `PrismaService`, and the alternative is importing
 * `TenancyModule` in all twenty-two others — twenty-two lines that are noise in twenty-two
 * diffs, and one of which someone eventually forgets. The forgetting would produce a DI
 * resolution error rather than an unscoped query, so it fails safely; it is still churn with
 * no benefit.
 *
 * §3.4.3 caps the count at two (`common/` and this) precisely because "just make it global" is
 * how a module graph stops being a graph. A third requires an amendment.
 *
 * `tenancy/` has NO controllers, and the reason is specific (§8.2): exposing tenant context
 * over HTTP is the §11.3 failure — the tenant id never comes from the client. What replaces a
 * controller here is the middleware (M-011) and the guard.
 */

import { Global, Module } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../common/config/app-config.schema.js';
import { PrismaService } from './prisma/prisma.service.js';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      // An explicit factory rather than `@Inject(APP_CONFIG)` on the constructor: the service
      // takes a validated `AppConfig`, and wiring it here keeps `PrismaService` free of Nest
      // decorators on its parameters — so it can be constructed directly in an integration
      // test without a DI container.
      useFactory: (config: AppConfig) => new PrismaService(config),
      inject: [APP_CONFIG],
    },
  ],
  exports: [PrismaService],
})
export class TenancyModule {}
