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
import { ReadinessService } from '../common/health/readiness.service.js';
import { ElevatedTenantReader } from './application/elevated-tenant-reader.js';
import { PrismaService } from './prisma/prisma.service.js';
import { TenantPingController } from './controllers/tenant-ping.controller.js';
import { TenantPrismaRepository } from './infrastructure/tenant.prisma-repository.js';
import { PlatformPrismaService } from './prisma/platform-prisma.service.js';
import { AuditPrismaService } from './prisma/audit-prisma.service.js';

@Global()
@Module({
  // §8.2 says tenancy/ is provider-only because exposing tenant CONTEXT over HTTP is the
  // §11.3 failure. TenantPingController does not do that: it exposes the caller own tenant,
  // resolved from the token, with no parameter a caller can choose. The Sprint-0 exit condition
  // (E0.1-E0.3) requires exactly one such route to prove the chain end to end.
  controllers: [TenantPingController],
  providers: [
    TenantPrismaRepository,
    {
      provide: PlatformPrismaService,
      useFactory: (config: AppConfig) => new PlatformPrismaService(config),
      inject: [APP_CONFIG],
    },
    // The append-only pool. Owned here rather than in `audit/` so that every `new PrismaClient()`
    // in this codebase sits in one directory — see the note at the top of the service.
    {
      provide: AuditPrismaService,
      useFactory: (config: AppConfig) => new AuditPrismaService(config),
      inject: [APP_CONFIG],
    },
    ElevatedTenantReader,
    {
      provide: PrismaService,
      // An explicit factory rather than `@Inject(APP_CONFIG)` on the constructor: the service
      // takes a validated `AppConfig`, and wiring it here keeps `PrismaService` free of Nest
      // decorators on its parameters — so it can be constructed directly in an integration
      // test without a DI container.
      useFactory: (config: AppConfig, readiness: ReadinessService) =>
        new PrismaService(config, readiness),
      inject: [APP_CONFIG, ReadinessService],
    },
  ],
  exports: [
    PrismaService,
    TenantPrismaRepository,
    PlatformPrismaService,
    AuditPrismaService,
    // The audited cross-tenant read. Exported so `admin/` can consume it WITHOUT holding
    // AUDIT_WRITE_PORT, which FolderStructure.md §8.2 forbids the administration modules.
    ElevatedTenantReader,
  ],
})
export class TenancyModule {}
