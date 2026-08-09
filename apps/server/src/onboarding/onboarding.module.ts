/**
 * `M-026` · `onboarding/` — the verification dossier.
 *
 * ┌─ NO CONTROLLERS YET, AND THAT IS `BLK-14` RATHER THAN AN OMISSION ──────────────────────────┐
 * │ The two tables, their RLS policies and the `D-03` column-scoped grant are built and proved    │
 * │ against real PostgreSQL. The tenant-facing wizard routes belong to `M-027` and cannot be      │
 * │ declared yet: `§B3.2` defines no capability for a tenant submitting its own application, and  │
 * │ `PG-1` requires every route to declare one. Inventing a key is what produced `BLK-10`.        │
 * │                                                                                              │
 * │ `controllers/README.md` carries the same reason where somebody looking for the missing        │
 * │ controller will actually find it.                                                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The repositories are providers and are NOT exported. `onboarding/` owns these tables, so a caller
 * outside the module reaching one directly would bypass the `C4.4` state machine `M-028` puts in
 * front of them — which is the boundary this module exists to draw.
 */

import { Module } from '@nestjs/common';

import { ApplicationPrismaRepository } from './infrastructure/application.prisma-repository.js';
import { KycDocumentPrismaRepository } from './infrastructure/kyc-document.prisma-repository.js';

@Module({
  providers: [ApplicationPrismaRepository, KycDocumentPrismaRepository],
})
export class OnboardingModule {}
