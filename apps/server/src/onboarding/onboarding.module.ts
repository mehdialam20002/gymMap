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
import { ResolveChecklistUseCase } from './application/resolve-checklist.use-case.js';
import { CHECKLIST_STORE } from './application/ports/checklist-store.port.js';
import { UploadKycDocumentUseCase } from './application/upload-kyc-document.use-case.js';
import { OBJECT_STORAGE_PORT } from '../common/storage/object-storage.port.js';
import { MALWARE_SCAN_PORT } from '../common/storage/malware-scan.port.js';
import { UnavailableObjectStorageAdapter } from '../common/storage/unavailable-object-storage.adapter.js';
import { UnavailableMalwareScanAdapter } from '../common/storage/unavailable-malware-scan.adapter.js';
import { RunPrechecksProcessor, PRECHECK_RESULT_STORE } from './jobs/run-prechecks.processor.js';
import { PrecheckResultPrismaStore } from './infrastructure/precheck-result.prisma-store.js';
import { RegistrationDuplicatePrismaProbe } from './infrastructure/registration-duplicate.prisma-probe.js';
import { UnavailableDuplicateAddressProbe } from './infrastructure/unavailable-duplicate-address.probe.js';
import { REGISTRATION_DUPLICATE_PROBE } from './application/prechecks/duplicate-registration-id.check.js';
import { DUPLICATE_ADDRESS_PROBE } from './application/ports/duplicate-address.probe.js';

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

    // ┌─ M-030 · THE PRE-CHECK SUITE ────────────────────────────────────────────────────────────┐
    // │ The processor is a provider with no controller in front of it, for the same reason the    │
    // │ module has no controllers at all (BLK-14). It is wired now so the DI graph is proved now: │
    // │ an unbound token here would sit undetected until the milestone that adds the reviewer     │
    // │ console, and would present there as "the server will not boot" inside a diff about routes.│
    // └───────────────────────────────────────────────────────────────────────────────────────────┘
    RunPrechecksProcessor,
    PrecheckResultPrismaStore,
    { provide: PRECHECK_RESULT_STORE, useExisting: PrecheckResultPrismaStore },

    // Real: `tenants.registration_number` exists, so this one queries for real — through
    // `runElevated`, which is what makes each cross-tenant read leave an audit row (AC-6).
    RegistrationDuplicatePrismaProbe,
    { provide: REGISTRATION_DUPLICATE_PROBE, useExisting: RegistrationDuplicatePrismaProbe },

    // Refusing: `gyms` and `branches` arrive with M-031. UNAVAILABLE → the check reports ERROR,
    // which is "could not be checked" — never "checked and fine" (AC-8, KL-109).
    UnavailableDuplicateAddressProbe,
    { provide: DUPLICATE_ADDRESS_PROBE, useExisting: UnavailableDuplicateAddressProbe },

    /*
     * `BANK_ACCOUNT_DUPLICATE_PROBE` is deliberately NOT bound, and that is not the same omission.
     *
     * `payout_accounts` is EP-05 and no wizard step collects an account, so the check's input is
     * always null and it never reaches for a probe. Binding a refusing adapter would add a token
     * nothing resolves. The check's own `probe?` being optional is what carries the state, and its
     * ERROR branch — covered by a test that runs today — is what will make the gap visible the
     * moment step 5 starts supplying a fingerprint.
     */
  ],
})
export class OnboardingModule {}
