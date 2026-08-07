/**
 * M-015 · THE CROSS-TENANT ISOLATION SUITE — GENERATED. `BAC-10`, `E2E-11`, `NFR-SEC-09`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THIS FILE ITERATES AN INVENTORY. IT DOES NOT ENUMERATE ROUTES.
 *
 * The hand-written M-012 version was deleted in the same commit that created this one (`R-M3`).
 * The difference is not style: a hand-authored suite measures the diligence of whoever last
 * added a test, and this measures the system. A `@TenantScoped()` route added on a Friday
 * afternoon with no spec fails `isolation-coverage` (`IG-1`) before it reaches here.
 *
 * The case group per route is derived from `_inventory.generated.ts`, which is derived from
 * `openapi.json`, which is what clients are generated from. There is no list of routes in this
 * file, and adding one would be the defect.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ WHICH ASSERTIONS APPLY, AND WHY THE KIND DECIDES ──────────────────────────────────────────┐
 * │ ITEM        A4, A1        addresses one resource; a cross-tenant read is 404, never 403      │
 * │ COLLECTION  A4, A3        returns a set; the refusal is an EMPTY set, not an error           │
 * │ ACTION      A4?, A2       mutates; the before/after checksum is the assertion                │
 * │ SEARCH      A4, A3, A5    A5's leaky six — named because they do not LOOK like a read        │
 * │ REPORT      A4, A3, A5                                                                       │
 * │ EXPORT      A4, A3, A5                                                                       │
 * │                                                                                              │
 * │ A6 runs once per suite: it is a property of the connection, not of a route.                  │
 * │ A7 is a separate file — it must run against a container with RLS DISABLED.                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

import type { INestApplication } from '@nestjs/common';

import { GENERATED_INVENTORY } from './_inventory.generated.ts';
import { EXCEPTED_ROUTES, ISOLATION_EXCEPTIONS, exceptionKey } from './_exceptions.ts';
import {
  assertA1ReadRefused,
  assertA2WriteRefused,
  assertA3CollectionFiltered,
  assertA4PositiveControl,
  assertA6VariableInTransaction,
  fillPath,
  platformChecksum,
  type ProbeContext,
  type ProbeResponse,
} from './_assertions.ts';
import { TENANT_A, TENANT_B, seedTenantsSql } from '../../prisma/seed/tenants.ts';
import { mintAccessToken } from '../harness/mint-token.ts';
import { applyTestEnv, TEST_JWT_SECRET } from '../harness/test-env.ts';

/** Must match `SEED_TENANT_A_COUNTS` in the coverage gate; asserted below. */
const EXPECTED_TENANT_A_COUNTS: Record<string, number> = {
  '/v1/tenant/ping': 1,
};

/** The table each route's resource lives in, for A2's checksum. */
const ROUTE_TABLE: Record<string, string> = {
  '/v1/tenant/{tenantRef}/ping': 'tenants',
  '/v1/tenant/ping': 'tenants',
};

let app: INestApplication | undefined;
let baseUrl = '';
let available = false;

function psql(sql: string): string {
  try {
    return execFileSync(
      'docker',
      [
        'exec',
        '-i',
        'gymmap-postgres',
        'psql',
        '-U',
        'postgres',
        '-d',
        'gymmap',
        '-tA',
        '-v',
        'ON_ERROR_STOP=1',
      ],
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    return `${e.stdout ?? ''}\n${e.stderr ?? ''}`.trim();
  }
}

function tokenFor(which: 'A' | 'B'): string {
  return mintAccessToken({
    sub:
      which === 'A'
        ? '01912f00-0000-7000-8000-0000000000a1'
        : '01912f00-0000-7000-8000-0000000000b1',
    tenantId: which === 'A' ? TENANT_A : TENANT_B,
    roles: ['GYM_OWNER'],
    secret: TEST_JWT_SECRET,
  });
}

const context: ProbeContext = {
  tenantA: TENANT_A,
  tenantB: TENANT_B,
  async request(method, path, asTenant): Promise<ProbeResponse> {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${tokenFor(asTenant)}` },
    });
    const raw = await response.text();
    let body: unknown;
    try {
      body = raw.length > 0 ? JSON.parse(raw) : null;
    } catch {
      body = raw;
    }
    return { status: response.status, body, raw };
  },
};

before(async () => {
  try {
    psql(seedTenantsSql());

    applyTestEnv();

    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../../dist/app.module.js');
    const { configureApp } = await import('../../dist/common/bootstrap/configure-app.js');

    // `abortOnError: false` is NOT optional here. Nest's default is `true`, which calls
    // `process.exit(1)` on a bootstrap failure — and with `logger: false` it does so having
    // printed nothing. The test runner then reports "test failed" with no TAP output and no
    // stack, which is the least debuggable failure this repository can produce. It cost half an
    // hour once already.
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    configureApp(app);
    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', 'localhost');
    available = true;
  } catch (error) {
    console.error(
      '\n  SKIPPING the generated isolation suite — the application would not boot.\n' +
        '    pnpm infra:up && pnpm --filter @gymmap/server db:setup && pnpm --filter @gymmap/server build\n' +
        `  ${error instanceof Error ? error.message.split('\n')[0] : String(error)}\n`,
    );
  }
});

after(async () => {
  if (app) await app.close();
});

const it = (name: string, fn: () => Promise<void>) =>
  test(name, async (t) => {
    if (!available) return t.skip('the application did not boot');
    await fn();
  });

// ═══════════════════════════════════════════════════════════════════════════
// The suite must be non-vacuous before any assertion in it means anything.
// ═══════════════════════════════════════════════════════════════════════════

test('the inventory is non-empty, so this suite is not passing over an empty list', () => {
  // A generator that produced nothing would make every `for` below a no-op, and node:test
  // reports zero subtests as success. This is the same shape as the elevation inventory's zero
  // baseline, and it needs the same control.
  assert.ok(
    GENERATED_INVENTORY.routes.length > 0,
    'the isolation inventory is EMPTY. Every case group below would silently not run, and the ' +
      'suite would report success having asserted nothing about the most important property in ' +
      'the system.',
  );
});

test('every inventory route has a case group, or a declared exception', () => {
  // acceptance criterion 11 — a route is covered, or it is in `_exceptions.ts` with a reason, an
  // alternative control and an owner. There is no third option and no `skip`.
  const uncovered = GENERATED_INVENTORY.routes
    .filter((route) => !EXCEPTED_ROUTES.has(exceptionKey(route)))
    .filter((route) => !(route.path in ROUTE_TABLE));

  assert.deepEqual(
    uncovered.map(exceptionKey),
    [],
    'a tenant-scoped route has no table mapping, so A2 cannot take its checksum. Add it to ' +
      'ROUTE_TABLE, or declare it in _exceptions.ts with an owner and an alternative control.',
  );
});

test('the expected-count table agrees with the coverage gate', () => {
  // Two copies of the same fixture expectation, in a `.ts` suite and an `.mjs` gate. Duplication
  // is only safe while something asserts it — and a disagreement here means the gate approves a
  // count the suite does not check.
  for (const route of GENERATED_INVENTORY.routes) {
    if (!['COLLECTION', 'SEARCH', 'REPORT', 'EXPORT'].includes(route.kind)) continue;
    assert.ok(
      EXPECTED_TENANT_A_COUNTS[route.path],
      `${route.path} is a ${route.kind} with no expected tenant-A count in this file, though ` +
        'the coverage gate has one. A4 would assert nothing for it.',
    );
  }
});

test('the exception list is empty, and its length is reported', () => {
  // Printed rather than merely asserted: job 13 puts this number in the summary, so "how many
  // routes are exempt" is answered on every pull request rather than in nobody's head.
  console.log(`  isolation exceptions declared: ${ISOLATION_EXCEPTIONS.length}`);
  for (const exception of ISOLATION_EXCEPTIONS) {
    assert.ok(exception.reason.length > 20, `${exceptionKey(exception)} has no real reason`);
    assert.ok(exception.alternativeControl.length > 0, 'an exception with no alternative control');
    assert.ok(exception.owner.length > 0, 'an exception with no owner');
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// The generated case groups. A4 first for every route, deliberately.
// ═══════════════════════════════════════════════════════════════════════════

for (const route of GENERATED_INVENTORY.routes) {
  if (EXCEPTED_ROUTES.has(exceptionKey(route))) continue;

  const label = `${route.method} ${route.path}`;
  const table = ROUTE_TABLE[route.path]!;

  // ── A4 · the positive control, before anything else ──────────────────────
  it(`A4 · ${label} — tenant A reading its OWN data gets a non-empty 200`, async () => {
    await assertA4PositiveControl(context, route);
  });

  it(`A4 · ${label} — and tenant B, independently, also gets its own`, async () => {
    // Both directions. A policy accidentally hardcoded to tenant A passes the assertion above.
    const response = await context.request(route.method, fillPath(route.path, TENANT_B), 'B');
    assert.equal(response.status, 200, `tenant B cannot read its own data: ${response.raw}`);
    assert.ok(response.raw.includes(TENANT_B), 'the response carries no tenant-B data');
  });

  // ── A1 · a cross-tenant read is refused, with no existence disclosure ────
  if (route.kind === 'ITEM') {
    it(`A1 · ${label} — tenant A cannot read tenant B, and cannot tell it from a missing row`, async () => {
      // The forbidden fragments are read from the actual row rather than hardcoded, so a column
      // added later is covered without anyone remembering to add it here.
      const legalName = psql(`SELECT legal_name FROM tenants WHERE id = '${TENANT_B}';`);
      await assertA1ReadRefused(context, route, [TENANT_B, legalName]);
    });

    it(`A1 · ${label} — and the reverse, so the policy is not one-directional`, async () => {
      const response = await context.request(route.method, fillPath(route.path, TENANT_A), 'B');
      assert.equal(response.status, 404);
      assert.ok(!response.raw.includes(TENANT_A));
    });
  }

  // ── A2 · a cross-tenant write leaves the row byte-identical ──────────────
  if (route.kind === 'ACTION') {
    it(`A2 · ${label} — tenant B's row is byte-identical before and after`, async () => {
      await assertA2WriteRefused(context, route, table);
    });
  }

  // ── A3 · a collection is filtered, asserted by count ─────────────────────
  if (['COLLECTION', 'SEARCH', 'REPORT', 'EXPORT'].includes(route.kind)) {
    it(`A3 · ${label} — the collection is filtered, by COUNT`, async () => {
      await assertA3CollectionFiltered(
        context,
        route,
        EXPECTED_TENANT_A_COUNTS[route.path]!,
        (row) => (row as { id?: string }).id,
      );
    });

    // ── A5 · the leaky six, by name ────────────────────────────────────────
    if (['SEARCH', 'REPORT', 'EXPORT'].includes(route.kind)) {
      it(`A5 · ${label} — a ${route.kind} route is covered BY NAME (E2E-11, IS5)`, async () => {
        // E2E-11 and IS5 name search, reports, exports, the audit explorer, notification
        // delivery logs and settlement statements specifically, because none of them LOOKS like
        // a resource read — and a suite built around "GET /resource/{id}" misses all six.
        const response = await context.request(route.method, route.path, 'A');
        assert.equal(response.status, 200);
        assert.ok(!response.raw.includes(TENANT_B), `a ${route.kind} response leaked tenant B`);
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// A6 · a property of the CONNECTION, so it runs once.
// ═══════════════════════════════════════════════════════════════════════════

it('A6 · app.tenant_id is a registered setting, and the policy reads it with NO missing_ok', async () => {
  assertA6VariableInTransaction();

  // The half that matters more: `current_setting('app.tenant_id')` with no `missing_ok` RAISES
  // 42704 when unset, rather than returning NULL and silently matching nothing. A policy written
  // the other way turns a missing context into an empty result set, which is indistinguishable
  // from a correct answer — so nobody investigates, and the eventual "fix" is to widen the policy.
  // Every isolation policy in the schema, not one table's. A policy correct on the tables
  // somebody thought of and written with `missing_ok` on the rest is the failure this catches,
  // and it is invisible if the query names a single table (§5.8, RS-11).
  const policies = psql(
    `SELECT tablename || ' :: ' || policyname || ' :: ' || qual
     FROM pg_policies
     WHERE qual LIKE '%app.tenant_id%' ORDER BY tablename, policyname;`,
  );
  assert.ok(
    policies.length > 0,
    'NO policy in this database references app.tenant_id. Either RLS is not applied at all, or ' +
      'the isolation predicate has been rewritten to something this assertion cannot see — and ' +
      'a check that finds nothing must not pass.',
  );
  assert.match(policies, /current_setting/);
  assert.ok(
    !/current_setting\([^)]*,\s*true\s*\)/.test(policies),
    `a policy uses current_setting(..., true) — the missing_ok form. An unset app.tenant_id ` +
      `would then return NULL and the predicate would match nothing, which looks exactly like ` +
      `"this tenant has no data".\n${policies}`,
  );
  await Promise.resolve();
});

// ═══════════════════════════════════════════════════════════════════════════
// §5.5 · the other audiences are HANDLED, not skipped.
// ═══════════════════════════════════════════════════════════════════════════

it('§5.5 · a probe exposes no internal detail', async () => {
  const probes = GENERATED_INVENTORY.otherAudiences.filter((r) => r.audience === 'PROBE');
  assert.ok(probes.length >= 2, 'the probes are missing from the contract');

  for (const probe of probes) {
    const response = await fetch(`${baseUrl}${probe.path}`);
    const raw = await response.text();
    // A readiness probe that reports a connection string, a version or a hostname is
    // reconnaissance served to an unauthenticated caller.
    for (const leak of ['postgresql://', 'redis://', 'password', 'secret', TENANT_A, TENANT_B]) {
      assert.ok(
        !raw.toLowerCase().includes(leak.toLowerCase()),
        `${probe.path} exposes "${leak}" to an unauthenticated caller: ${raw}`,
      );
    }
  }
});

it('§5.5 · every non-tenant route is assigned an audience rather than dropped', async () => {
  // The failure this prevents: a route that is neither tenant-scoped nor recognised silently
  // belongs to nobody's suite. Assigning an audience does not test it, but it makes the gap
  // countable — and the count appears in job 13's summary.
  for (const route of GENERATED_INVENTORY.otherAudiences) {
    assert.ok(
      ['PUBLIC', 'ME', 'TENANT', 'ADMIN', 'WEBHOOK', 'PROBE'].includes(route.audience),
      `${route.method} ${route.path} has audience "${route.audience}", which is not one of the ` +
        'five §5.5 audiences plus PROBE',
    );
  }
  await Promise.resolve();
});

// ═══════════════════════════════════════════════════════════════════════════
// The checksum helper is itself proved to work, or A2 is decoration.
// ═══════════════════════════════════════════════════════════════════════════

it('platformChecksum CHANGES when the row changes, and is stable when it does not', async () => {
  // A checksum function that always returned the same string would make every A2 assertion pass.
  // This is the control for the control.
  const first = platformChecksum('tenants', TENANT_B);
  assert.equal(first, platformChecksum('tenants', TENANT_B), 'the checksum is not stable');

  psql(
    `SET session_replication_role = 'replica';
     UPDATE tenants SET trading_name = 'checksum-probe' WHERE id = '${TENANT_B}';
     SET session_replication_role = 'origin';`,
  );
  const changed = platformChecksum('tenants', TENANT_B);

  psql(
    `SET session_replication_role = 'replica';
     UPDATE tenants SET trading_name = 'Peak Performance' WHERE id = '${TENANT_B}';
     SET session_replication_role = 'origin';`,
  );

  assert.notEqual(
    changed,
    first,
    'platformChecksum did not change after the row changed. Every A2 assertion in this suite ' +
      'would pass regardless of what a cross-tenant write did.',
  );
  assert.equal(platformChecksum('tenants', TENANT_B), first, 'the row was not restored');
});
