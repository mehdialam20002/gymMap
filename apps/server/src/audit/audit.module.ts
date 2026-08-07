/**
 * M-013 · `audit/` — PROVIDER-ONLY, and the reason is specific (§8.2).
 *
 * No controllers. The audit WRITER must not be reachable from the administration UI: a module
 * that can write an audit row can write a FALSE one, and a false entry in an append-only log is
 * permanent, unfalsifiable and indistinguishable from a true one.
 *
 * `admin/` reads audit through `AUDIT_READ_PORT` (FR-ADMN-09), which has no `append` method —
 * so a module holding it cannot write a row even by mistake. That is why the read and write
 * ports are two interfaces rather than one with two methods.
 */

import { Global, Module } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../common/config/app-config.schema.js';
import { AuditPrismaRepository } from './infrastructure/audit.prisma-repository.js';
import { AUDIT_WRITE_PORT } from './ports/audit-write.port.js';

@Global()
@Module({
  providers: [
    {
      provide: AuditPrismaRepository,
      useFactory: (config: AppConfig) => new AuditPrismaRepository(config),
      inject: [APP_CONFIG],
    },
    // The port, not the class, is what consumers inject. The interceptor depends on the
    // INTERFACE, so an integration test can substitute a recording double without a database.
    { provide: AUDIT_WRITE_PORT, useExisting: AuditPrismaRepository },
  ],
  exports: [AUDIT_WRITE_PORT],
})
export class AuditModule {}
