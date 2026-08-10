/**
 * `M-031` · `CatalogModule` resolves, and exports tokens rather than classes.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE MODULE IS NOT IN `AppModule`, AND THAT IS THE CONVENTION RATHER THAN AN OVERSIGHT
 *
 * `app.module.ts` states the rule where it wires `IamModule`: *"the first module with a consumer,
 * which is this file's standing rule for when a module gets wired in."* `catalog/` has no consumer
 * — `memberships/` will inject `GYM_TIMEZONE_PORT` and does not exist, and the five branch routes
 * are `BLK-19` — so adding it to `AppModule` would break that rule to gain nothing at runtime.
 *
 * But "not wired in" and "does not resolve" are different, and only one of them is acceptable.
 * `M-023`'s precedent, followed by `M-029` and now here: *"wiring proved by booting the real DI
 * graph and by deleting the store binding to watch it exit 1."*
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { applyTestEnv } from '../harness/test-env.ts';

let moduleRef: import('@nestjs/testing').TestingModule | undefined;
let bootError: Error | undefined;

before(async () => {
  applyTestEnv();

  try {
    const { Test } = await import('@nestjs/testing');
    const { CatalogModule } = await import('../../dist/catalog/catalog.module.js');
    const { CommonModule } = await import('../../dist/common/common.module.js');
    const { TenancyModule } = await import('../../dist/tenancy/tenancy.module.js');
    const { AuditModule } = await import('../../dist/audit/audit.module.js');

    /*
     * `AuditModule` is in this list because the first run without it FAILED, and the failure is
     * worth keeping in the file rather than in a commit message:
     *
     *   Nest can't resolve dependencies of the ElevatedTenantReader
     *   (PlatformPrismaService, ?). Symbol(AuditWritePort) at index [1] …
     *
     * `TenancyModule` exports `ElevatedTenantReader`, and that reader writes the audit row BEFORE
     * the elevation runs — `runElevated`'s asymmetry, where a failed audit abandons the read
     * rather than proceeding. So `tenancy` cannot be booted without `audit` by anyone, and
     * `CatalogModule` inherits that even though it never touches either.
     *
     * `onboarding-wiring.int-spec.ts` already imports the same four for the same reason. Two specs
     * discovering it independently is the argument for writing it down here.
     */
    moduleRef = await Test.createTestingModule({
      imports: [CommonModule, TenancyModule, AuditModule, CatalogModule],
    }).compile();
  } catch (error) {
    bootError = error instanceof Error ? error : new Error(String(error));
  }
});

after(async () => {
  await moduleRef?.close();
});

test('the DI graph resolves — every provider the module declares can be constructed', () => {
  assert.equal(
    bootError,
    undefined,
    `CatalogModule does not resolve:\n${bootError?.message ?? ''}`,
  );
});

test('both M-031 ports are bound and resolve to something callable', async () => {
  if (bootError !== undefined) return; // the assertion above already failed; do not pile on

  const { BRANCH_QUERY_PORT } = await import('../../dist/catalog/index.js');
  const { GYM_TIMEZONE_PORT } = await import('../../dist/catalog/index.js');

  const branches = moduleRef?.get(BRANCH_QUERY_PORT) as { findInGym?: unknown };
  const zones = moduleRef?.get(GYM_TIMEZONE_PORT) as { timezoneFor?: unknown };

  // `typeof … === 'function'` rather than a truthiness check: Nest resolves a token bound to
  // `undefined` without complaint, and `assert.ok(port)` on the resulting object would pass.
  assert.equal(
    typeof branches.findInGym,
    'function',
    'BRANCH_QUERY_PORT resolved to nothing usable',
  );
  assert.equal(
    typeof zones.timezoneFor,
    'function',
    'GYM_TIMEZONE_PORT resolved to nothing usable',
  );
});

test('the ADAPTER CLASSES are not reachable through the public surface', async () => {
  /*
   * ┌─ THE EXPORT THAT WOULD MAKE THE MODULE BOUNDARY A CONVENTION ─────────────────────────────┐
   * │ `memberships/` will inject `GYM_TIMEZONE_PORT`. If `index.ts` also exported                │
   * │ `GymTimezonePrismaAdapter`, a consumer could inject the class instead — and would, because │
   * │ the class has a nicer name and autocompletes. `R2` would then hold only for as long as     │
   * │ everybody remembered it.                                                                    │
   * │                                                                                            │
   * │ Asserted against the real module's exports rather than by reading the source, so a         │
   * │ re-export added anywhere in the chain is caught.                                            │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const surface = await import('../../dist/catalog/index.js');
  const exported = Object.keys(surface);

  for (const leaked of ['BranchPrismaRepository', 'GymTimezonePrismaAdapter', 'PrismaService']) {
    assert.ok(
      !exported.includes(leaked),
      `${leaked} is exported from catalog/index.ts — a consumer can now depend on Prisma across ` +
        `a module boundary that exists to prevent exactly that`,
    );
  }

  // And the tokens that SHOULD be there, so this test cannot pass by the module exporting nothing.
  for (const required of ['CatalogModule', 'BRANCH_QUERY_PORT', 'GYM_TIMEZONE_PORT']) {
    assert.ok(exported.includes(required), `${required} is missing from the public surface`);
  }
});

test('ianaTimezone refuses a fixed offset', async () => {
  // `+05:30` is the value a well-meaning caller reaches for, and it is not a timezone: it cannot
  // express a DST transition. Asia/Kolkata having none is a property of India, not of the model.
  const { ianaTimezone } = await import('../../dist/catalog/index.js');

  assert.equal(ianaTimezone('Asia/Kolkata'), 'Asia/Kolkata');
  assert.throws(() => ianaTimezone('+05:30'), /not an IANA zone name/);
  assert.throws(() => ianaTimezone('IST'), /not an IANA zone name/);
});
