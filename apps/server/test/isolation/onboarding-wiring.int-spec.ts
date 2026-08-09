/**
 * `M-029` · `OnboardingModule` resolves — the wiring, proved by booting it.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE MODULE IS NOT IN `AppModule`, AND THAT IS THE CONVENTION RATHER THAN AN OVERSIGHT
 *
 * `app.module.ts` states the rule where it wires `IamModule`: *"the first module with a consumer,
 * which is this file's standing rule for when a module gets wired in."* `onboarding/` has no
 * controller yet — `BLK-14` and `BLK-17` — so it has no consumer, and adding it to `AppModule`
 * would break that rule to gain nothing at runtime.
 *
 * But "not wired in" and "does not resolve" are different, and only one of them is acceptable. A
 * provider whose token nobody bound, or a circular import, sits undetected until the milestone that
 * adds the controller — at which point it presents as "the server will not boot" in a diff that is
 * about routes. This boots the module in isolation so the graph is proved now, against the same
 * `Test.createTestingModule` Nest uses in production wiring.
 *
 * `M-023`'s precedent: *"wiring proved by booting the real DI graph and by deleting the store
 * binding to watch it exit 1."*
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { applyTestEnv } from '../harness/test-env.ts';

let moduleRef: { get: (token: unknown) => unknown; close: () => Promise<void> } | undefined;
let bootError: Error | undefined;

before(async () => {
  applyTestEnv();

  try {
    const { Test } = await import('@nestjs/testing');
    const { OnboardingModule } = await import('../../dist/onboarding/onboarding.module.js');
    const { CommonModule } = await import('../../dist/common/common.module.js');
    const { TenancyModule } = await import('../../dist/tenancy/tenancy.module.js');
    const { AuditModule } = await import('../../dist/audit/audit.module.js');

    moduleRef = await Test.createTestingModule({
      imports: [CommonModule, TenancyModule, AuditModule, OnboardingModule],
    }).compile();
  } catch (error) {
    bootError = error instanceof Error ? error : new Error(String(error));
  }
});

after(async () => {
  await moduleRef?.close();
});

test('the DI graph resolves — every provider the module declares can be constructed', () => {
  // The whole point. Nest reports a missing binding at COMPILE time with "Nest can't resolve
  // dependencies of X (?)", and that message names the parameter position rather than the token,
  // so finding it later in a routes diff costs an afternoon.
  assert.equal(
    bootError,
    undefined,
    `OnboardingModule does not resolve:\n${bootError?.message ?? ''}`,
  );
});

test('the refusing adapters are BOUND, not merely defined', async () => {
  // ┌─ AN UNBOUND TOKEN AND A REFUSING ADAPTER LOOK THE SAME IN A FILE LISTING ──────────────────┐
  // │ They are not the same at runtime. Unbound is a boot failure that reads as a wiring mistake;│
  // │ bound-and-refusing is the accurate state of the enclave — BLK-16 and KL-104 — expressed as │
  // │ behaviour a caller can handle.                                                              │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  if (bootError !== undefined) return; // the assertion above already failed; do not pile on

  const { OBJECT_STORAGE_PORT } = await import('../../dist/common/storage/object-storage.port.js');
  const { MALWARE_SCAN_PORT } = await import('../../dist/common/storage/malware-scan.port.js');

  const storage = moduleRef?.get(OBJECT_STORAGE_PORT) as {
    isPrivate: (a: string) => Promise<{ ok: boolean }>;
  };
  const scanner = moduleRef?.get(MALWARE_SCAN_PORT) as {
    scan: (b: Buffer) => Promise<{ outcome: string }>;
  };

  assert.ok(storage, 'OBJECT_STORAGE_PORT is not bound');
  assert.ok(scanner, 'MALWARE_SCAN_PORT is not bound');

  assert.equal((await storage.isPrivate('KYC')).ok, false, 'a bound adapter claimed success');
  assert.equal((await scanner.scan(Buffer.from('x'))).outcome, 'UNSCANNED');
});

test('the checklist store is bound to the PORT, so the use case never sees Prisma', async () => {
  if (bootError !== undefined) return;

  // The token comes from `application/ports/`, which is where §8.1 row 7 puts a dependency —
  // importing it from the use case would be the very coupling this test claims to check against.
  const { CHECKLIST_STORE } =
    await import('../../dist/onboarding/application/ports/checklist-store.port.js');
  const { ResolveChecklistUseCase } =
    await import('../../dist/onboarding/application/resolve-checklist.use-case.js');

  assert.ok(moduleRef?.get(CHECKLIST_STORE), 'CHECKLIST_STORE is not bound');
  assert.ok(moduleRef?.get(ResolveChecklistUseCase), 'ResolveChecklistUseCase is not bound');
});

test('the upload use case resolves with all six of its collaborators', async () => {
  // Six constructor parameters, five of them tokens. This is the provider most likely to break
  // when somebody adds a dependency and forgets the binding.
  if (bootError !== undefined) return;

  const { UploadKycDocumentUseCase } =
    await import('../../dist/onboarding/application/upload-kyc-document.use-case.js');
  assert.ok(moduleRef?.get(UploadKycDocumentUseCase));
});

test('the module still exposes NO controllers, which BLK-14 and BLK-17 require', async () => {
  // A guard against the opposite mistake. If a controller is added here before its capability
  // exists in §B3.2, `PG-1` fails in CI — but only for routes it can see, and this says out loud
  // that the absence is deliberate rather than pending.
  const module = await import('../../dist/onboarding/onboarding.module.js');
  const metadata = Reflect.getMetadata('controllers', module.OnboardingModule) as
    unknown[] | undefined;

  assert.deepEqual(
    metadata ?? [],
    [],
    'onboarding/ declares a controller. §B3.2 defines no capability for a tenant submitting its ' +
      'own application (BLK-14), and the admin access-url route is blocked on BLK-17.',
  );
});
