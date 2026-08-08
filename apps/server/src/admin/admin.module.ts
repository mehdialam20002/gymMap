/**
 * `admin/` — the platform administration surface. `SCR-ADM-001` … `SCR-ADM-015`.
 *
 * Reads only, for now. Every write the console eventually performs (approve, reject, suspend,
 * refund) arrives with its own milestone and its own audited use case; there is deliberately no
 * generic "update tenant" here for a later screen to reach for.
 */

import { Module } from '@nestjs/common';

import { PlatformOverviewUseCase } from './application/platform-overview.use-case.js';
import { PLATFORM_READ_PORT } from './application/ports/platform-read.port.js';
import { PlatformController } from './controllers/platform.controller.js';
import { PlatformReadAdapter } from './infrastructure/platform-read.adapter.js';

@Module({
  // No imports. TenancyModule is @Global, so `ElevatedTenantReader` resolves without one — and
  // `admin/` deliberately does NOT import AuditModule: the only thing it would gain is
  // AUDIT_WRITE_PORT, which FolderStructure.md §8.2 forbids the administration modules to hold.
  // A module that can append an audit row can append a FALSE one, and a false entry in an
  // append-only log is permanent and unfalsifiable. The elevation writes its own row, from
  // inside `tenancy/`.
  controllers: [PlatformController],
  providers: [
    PlatformOverviewUseCase,
    // The PORT is what the use case injects, never the class. Swapping the adapter for a double
    // in a test is then a provider override rather than a refactor.
    { provide: PLATFORM_READ_PORT, useClass: PlatformReadAdapter },
  ],
})
export class AdminModule {}
