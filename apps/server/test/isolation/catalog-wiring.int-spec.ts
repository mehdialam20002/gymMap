/**
 * `M-031` · `CatalogModule` resolves, and exports tokens rather than classes.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THIS HEADER USED TO ARGUE THE MODULE SHOULD NOT BE IN `AppModule`. IT WAS RIGHT, THEN WRONG.
 *
 * What it said: *"`app.module.ts` states the rule where it wires `IamModule` — the first module
 * with a consumer. `catalog/` has no consumer, and the five branch routes are `BLK-19`, so adding
 * it to `AppModule` would break that rule to gain nothing at runtime."*
 *
 * True on the day it was written. `ADR-0047` closed `BLK-19`, the five branch routes shipped on
 * 2026-08-11, and a controller is a consumer — so the same rule now says the opposite.
 *
 * ┌─ AND THE GAP IN BETWEEN IS THE PART WORTH KEEPING ────────────────────────────────────────────┐
 * │ This spec passed throughout. It boots `CatalogModule` in ISOLATION, so it proved the module's  │
 * │ DI graph sound while the application never constructed it — the routes existed in source, in   │
 * │ the OpenAPI document and in no route table. `TD-045` is the identical failure one layer up     │
 * │ (four guards built, unit-tested, registered nowhere), and the lesson did not transfer, because │
 * │ the guard version was caught by a test asserting REGISTRATION and this one asserted only       │
 * │ resolution.                                                                                     │
 * │                                                                                              │
 * │ So the last test in this file boots the REAL `AppModule` and reads the route table. Isolation  │
 * │ answers "can this be built"; only the composition root answers "is it running".                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
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

test('all three M-031 ports are bound and resolve to something callable', async () => {
  if (bootError !== undefined) return; // the assertion above already failed; do not pile on

  const { BRANCH_QUERY_PORT, GYM_TIMEZONE_PORT, GYM_STATUS_PORT, AFFECTED_MEMBERSHIPS_PORT } =
    await import('../../dist/catalog/index.js');

  const branches = moduleRef?.get(BRANCH_QUERY_PORT) as { findInGym?: unknown };
  const zones = moduleRef?.get(GYM_TIMEZONE_PORT) as { timezoneFor?: unknown };
  const status = moduleRef?.get(GYM_STATUS_PORT) as { statusOf?: unknown };
  const members = moduleRef?.get(AFFECTED_MEMBERSHIPS_PORT) as { countForBranch?: unknown };

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
  assert.equal(typeof status.statusOf, 'function', 'GYM_STATUS_PORT resolved to nothing usable');
  assert.equal(
    typeof members.countForBranch,
    'function',
    'AFFECTED_MEMBERSHIPS_PORT resolved to nothing usable',
  );
});

test('the membership stand-in REFUSES — it never answers a count, least of all zero', async () => {
  /*
   * ┌─ THE ONE-WORD CHANGE THIS TEST EXISTS TO FAIL ────────────────────────────────────────────┐
   * │ `return { ok: true, count: 0 }` compiles, satisfies the port, and makes every deactivation │
   * │ succeed. It is one edit away and it looks like finishing the feature.                       │
   * │                                                                                            │
   * │ `0` is a NUMBER: it asserts that closing the branch strands nobody, said by something that │
   * │ cannot count. Today that is accidentally true. On the day `memberships` ships at `M-046`,  │
   * │ a zero-returning adapter keeps asserting it while the table fills — and nothing about       │
   * │ adding a table makes anyone re-read an adapter written five sprints earlier. `KL-113`.      │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  if (bootError !== undefined) return;

  const { AFFECTED_MEMBERSHIPS_PORT } = await import('../../dist/catalog/index.js');
  const port = moduleRef?.get(AFFECTED_MEMBERSHIPS_PORT) as {
    countForBranch(id: string): Promise<{ ok: boolean; reason?: string }>;
  };

  const answer = await port.countForBranch('0192de00-7000-7000-8000-0000000000b1');

  assert.equal(answer.ok, false, 'the stand-in answered a count it cannot possibly know');
  // The reason names the milestone, so an engineer reading a refused DELETE in a log knows this is
  // a scheduled gap rather than an outage to page somebody about.
  assert.match(String(answer.reason), /M-046|Sprint 7/);
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

test('the REAL AppModule maps all five branch routes — isolation cannot see this', async () => {
  /*
   * The assertion the three tests above structurally cannot make. They boot `CatalogModule`
   * directly, so they pass whether or not `app.module.ts` imports it — and for three commits it
   * did not. See this file's header.
   *
   * ┌─ ASKED WITH A REAL REQUEST, NOT BY READING THE ROUTE TABLE ────────────────────────────────┐
   * │ The first version reached for `app.getHttpAdapter().getInstance().router`, which Express 4  │
   * │ answers by THROWING *"'app.router' is deprecated"* — and the private `_router` it wants     │
   * │ instead is an internal that a minor release may rename.                                      │
   * │                                                                                            │
   * │ A request is better than the introspection it replaced. `401` proves the route exists and   │
   * │ the global guard chain reached it; `404` proves nothing serves the path. That distinction   │
   * │ is exactly the bug, and it is measured through the pipeline a caller actually meets rather  │
   * │ than through a data structure that merely predicts it.                                       │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  applyTestEnv();

  const { Test } = await import('@nestjs/testing');
  const { AppModule } = await import('../../dist/app.module.js');
  const { configureApp } = await import('../../dist/common/bootstrap/configure-app.js');
  const request = (await import('supertest')).default;

  const app = (
    await Test.createTestingModule({ imports: [AppModule] }).compile()
  ).createNestApplication();

  /*
   * `configureApp()` — the SAME function `main.ts` calls, not a hand-rolled subset.
   *
   * Calling `enableVersioning` alone was the first attempt, and every route answered `500`
   * including `/v1/tenant/ping`, which has worked for milestones. The cause is instructive:
   * `JwtAuthGuard` throws `UnauthenticatedException`, and without `DomainExceptionFilter` — which
   * `configureApp` installs — Nest sees an unrecognised Error and renders the §C3.1 envelope as a
   * bare 500. A test harness that assembles its own bootstrap tests an application nobody runs.
   */
  configureApp(app);
  await app.init();

  const ID = '0192de00-7000-7000-8000-0000000000b1';

  try {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const probes = [
      ['get', '/v1/tenant/branches'],
      ['post', '/v1/tenant/branches'],
      ['get', `/v1/tenant/branches/${ID}`],
      ['patch', `/v1/tenant/branches/${ID}`],
      ['delete', `/v1/tenant/branches/${ID}`],
    ] as const;

    for (const [method, path] of probes) {
      const response = await request(server)[method](path);
      assert.notEqual(
        response.status,
        404,
        `${method.toUpperCase()} ${path} is not served. The controller exists and nothing routes ` +
          `to it — check that app.module.ts still imports CatalogModule.`,
      );
      // 401 specifically: unauthenticated is the only thing an anonymous probe should meet. A 500
      // here would mean the route resolves and its dependency graph does not, which passes a
      // not-404 check while being just as broken.
      assert.equal(
        response.status,
        401,
        `${method.toUpperCase()} ${path} answered ${String(response.status)} to an anonymous ` +
          `request; expected 401 from the global JwtAuthGuard.`,
      );
    }
  } finally {
    await app.close();
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
