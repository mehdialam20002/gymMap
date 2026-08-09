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
import { KycChecklistPrismaRepository } from './infrastructure/kyc-checklist.prisma-repository.js';
import {
  CHECKLIST_STORE,
  ResolveChecklistUseCase,
} from './application/resolve-checklist.use-case.js';
import { UploadKycDocumentUseCase } from './application/upload-kyc-document.use-case.js';
import { OBJECT_STORAGE_PORT } from '../common/storage/object-storage.port.js';
import { MALWARE_SCAN_PORT } from '../common/storage/malware-scan.port.js';
import { UnavailableObjectStorageAdapter } from '../common/storage/unavailable-object-storage.adapter.js';
import { UnavailableMalwareScanAdapter } from '../common/storage/unavailable-malware-scan.adapter.js';

@Module({
  providers: [
    ApplicationPrismaRepository,
    KycDocumentPrismaRepository,
    KycChecklistPrismaRepository,
    ResolveChecklistUseCase,
    UploadKycDocumentUseCase,

    // ┌─ THE REFUSING ADAPTERS ARE BOUND, NOT LEFT UNBOUND ────────────────────────────────────┐
    // │ An unbound token fails at DI resolution with "Nest can't resolve dependencies", which   │
    // │ reads as a wiring mistake. A bound adapter that answers UNAVAILABLE (BLK-16) and         │
    // │ UNSCANNED (KL-104) reads as what it is: the enclave is not built yet, the code that      │
    // │ depends on it is, and the refusal is the current state rather than an accident.          │
    // └─────────────────────────────────────────────────────────────────────────────────────────┘
    UnavailableObjectStorageAdapter,
    UnavailableMalwareScanAdapter,
    { provide: OBJECT_STORAGE_PORT, useExisting: UnavailableObjectStorageAdapter },
    { provide: MALWARE_SCAN_PORT, useExisting: UnavailableMalwareScanAdapter },
    // The use case depends on the PORT, never on the Prisma class. Binding here rather than
    // injecting the repository directly is what lets the unit tests drive it with an in-memory
    // store and no database — and what keeps `application/` free of a Prisma import.
    { provide: CHECKLIST_STORE, useExisting: KycChecklistPrismaRepository },
  ],
})
export class OnboardingModule {}
