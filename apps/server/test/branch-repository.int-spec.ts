/**
 * `M-031` · `BranchPrismaRepository` against real PostgreSQL — `FolderStructure.md` §9.9.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * §9.9 MANDATES TWO RLS ASSERTIONS IN EVERY REPOSITORY INT-SPEC, AND NAMES THE SECOND AS THE ONE
 * THAT MATTERS
 *
 *   1. Tenant A cannot read a tenant B row by id
 *   2. An absent tenant context throws LOUDLY rather than reading everything
 *
 * On the second: *"`§C1.4` step 4 requires 'a loud failure rather than a silent full-table read',
 * and the `no-tenant-context` case is exactly the failure mode that connection pooling plus RLS
 * produces (constitution §11.4.1)."*
 *
 * That is the whole reason `A-01` made the Prisma extension a condition of approving Prisma: a
 * pooled connection carries whatever `app.tenant_id` the LAST request set. Without the extension
 * refusing first, a query with no tenant in scope does not fail — it quietly answers with the
 * previous tenant's rows, and every test passes.
 *
 * ┌─ RUNS AS `gymmap_app`, NOT AS `postgres` ────────────────────────────────────────────────────┐
 * │ `test-env.ts` points `DATABASE_URL` at `gymmap_app`, which is a member of `app_rw` and holds  │
 * │ no `BYPASSRLS`. Running these as the superuser would pass with the policies deleted — which   │
 * │ is exactly how a suite ends up proving nothing. `M-029`'s `BLK-18` was found because a        │
 * │ superuser fallback had been hiding a total audit-write failure.                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

import { applyTestEnv, TEST_DATABASE_URL } from './harness/test-env.ts';

const CONTAINER = 'gymmap-postgres';

/** Two tenants, fixed so a crashed run leaves nothing a later run trips over. */
const TENANT_A = '00000000-0000-4000-8000-00000031aaa1';
const TENANT_B = '00000000-0000-4000-8000-00000031bbb1';
const GYM_A = '00000000-0000-4000-8000-00000031aaa2';
const GYM_B = '00000000-0000-4000-8000-00000031bbb2';
const BRANCH_A = '00000000-0000-4000-8000-00000031aaa3';
const BRANCH_B = '00000000-0000-4000-8000-00000031bbb3';
const PROBE_COUNTRY = 'YY';

/** Setup and teardown run as the superuser; every ASSERTION runs as `gymmap_app`. */
function asSuperuser(sql: string): { out: string; error: string } {
  try {
    return {
      out: execFileSync(
        'docker',
        // prettier-ignore
        ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', 'gymmap', '-tA', '-v', 'ON_ERROR_STOP=1'],
        { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
      ).trim(),
      error: '',
    };
  } catch (error) {
    const shell = error as { stdout?: string; stderr?: string };
    return { out: (shell.stdout ?? '').trim(), error: (shell.stderr ?? String(error)).trim() };
  }
}

const FIXTURES = `
INSERT INTO countries (code, name, default_currency, calling_code, fy_start_month, is_active)
  VALUES ('${PROBE_COUNTRY}', 'Repoland', 'INR', '+98', 4, true);
INSERT INTO cities (country_code, name, slug, centroid, status, timezone)
  VALUES ('${PROBE_COUNTRY}', 'Repo City', 'repo-city',
          ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'LIVE', 'Asia/Kolkata');
INSERT INTO gym_categories (key, name, slug) VALUES ('repo-gym', 'Repo Gym', 'repo-gym');

INSERT INTO tenants (id, legal_name, entity_type) VALUES
  ('${TENANT_A}', 'Tenant A Private Limited', 'COMPANY'),
  ('${TENANT_B}', 'Tenant B Private Limited', 'COMPANY');

INSERT INTO gyms (id, tenant_id, name, slug, city_id, category_id)
  SELECT '${GYM_A}', '${TENANT_A}', 'Gym A', 'repo-gym-a', c.id, g.id
  FROM cities c, gym_categories g WHERE c.slug = 'repo-city' AND g.key = 'repo-gym';
INSERT INTO gyms (id, tenant_id, name, slug, city_id, category_id)
  SELECT '${GYM_B}', '${TENANT_B}', 'Gym B', 'repo-gym-b', c.id, g.id
  FROM cities c, gym_categories g WHERE c.slug = 'repo-city' AND g.key = 'repo-gym';

INSERT INTO branches
  (id, tenant_id, gym_id, name, address_line1, city_id, state, state_code, postal_code,
   country_code, location, is_primary)
  SELECT '${BRANCH_A}', '${TENANT_A}', '${GYM_A}', 'A Main', '1 A Road', c.id, 'Karnataka', 'KA',
         '560001', '${PROBE_COUNTRY}',
         ST_SetSRID(ST_MakePoint(77.60, 12.97), 4326)::geography, true
  FROM cities c WHERE c.slug = 'repo-city';
INSERT INTO branches
  (id, tenant_id, gym_id, name, address_line1, city_id, state, state_code, postal_code,
   country_code, location, is_primary)
  SELECT '${BRANCH_B}', '${TENANT_B}', '${GYM_B}', 'B Main', '1 B Road', c.id, 'Karnataka', 'KA',
         '560002', '${PROBE_COUNTRY}',
         ST_SetSRID(ST_MakePoint(77.61, 12.98), 4326)::geography, true
  FROM cities c WHERE c.slug = 'repo-city';
`;

const CLEANUP = `
DELETE FROM branches WHERE tenant_id IN ('${TENANT_A}', '${TENANT_B}');
DELETE FROM gyms     WHERE tenant_id IN ('${TENANT_A}', '${TENANT_B}');
DELETE FROM tenants  WHERE id        IN ('${TENANT_A}', '${TENANT_B}');
DELETE FROM gym_categories WHERE key = 'repo-gym';
DELETE FROM cities   WHERE slug = 'repo-city';
DELETE FROM countries WHERE code = '${PROBE_COUNTRY}';
`;

/*
 * Typed through the real modules with inline TYPE imports, which are erased at compile time.
 *
 * The first version declared hand-written shapes — `<T>(t: string, fn: () => T) => T` for
 * `runWithTenant` — and they did not typecheck: `tenantId` is a BRANDED `TenantId`, not a bare
 * string, and widening it here would have been the test quietly asserting against a looser
 * contract than the one that ships.
 */
let available = false;
let repo:
  | import('../dist/catalog/infrastructure/branch.prisma-repository.js').BranchPrismaRepository
  | undefined;
let runWithTenant: typeof import('../dist/tenancy/context/tenant-context.als.js').runWithTenant;
let tenantIdFromClaim: typeof import('../dist/tenancy/domain/tenant-id.vo.js').tenantIdFromClaim;
let prisma: import('../dist/tenancy/prisma/prisma.service.js').PrismaService | undefined;

before(async () => {
  available = /^1$/m.test(asSuperuser('SELECT 1;').out);
  if (!available) {
    console.error('\n  SKIPPING the M-031 repository assertions — no database. pnpm infra:up\n');
    return;
  }

  asSuperuser(CLEANUP);
  const seeded = asSuperuser(FIXTURES);
  assert.equal(seeded.error, '', `fixtures failed:\n${seeded.error}`);

  applyTestEnv();

  const { PrismaService } = await import('../dist/tenancy/prisma/prisma.service.js');
  const { BranchPrismaRepository } =
    await import('../dist/catalog/infrastructure/branch.prisma-repository.js');
  ({ runWithTenant } = await import('../dist/tenancy/context/tenant-context.als.js'));
  // Through the real brand constructor, not a cast. `TenantId` is branded, and a cast here would
  // let this spec assert against a looser contract than the one the application ships.
  ({ tenantIdFromClaim } = await import('../dist/tenancy/domain/tenant-id.vo.js'));

  /*
   * Constructed by hand rather than through Nest, and the two arguments are the reason.
   *
   * `PrismaService` takes `@Inject(APP_CONFIG)` — a Zod-inferred TYPE with no runtime value, which
   * is `TD-030` — and a `ReadinessService`. Booting the whole DI graph here would drag in Redis and
   * every other module to exercise one repository. The stub readiness probe records nothing; this
   * spec is about RLS, not about `/readyz`.
   */
  const config = { DATABASE_URL: TEST_DATABASE_URL, NODE_ENV: 'test' };
  const readiness = { register: () => undefined, markReady: () => undefined };

  prisma = new PrismaService(config as never, readiness as never);
  await prisma.onModuleInit();
  repo = new BranchPrismaRepository(prisma);
});

after(async () => {
  if (!available) return;
  await prisma?.onModuleDestroy();
  asSuperuser(CLEANUP);
});

const it = (name: string, fn: () => Promise<void>) =>
  test(name, async (t) => {
    if (!available) return t.skip('no database');
    await fn();
  });

// ═══════════════════════════════════════════════════════════════════════════
// The persistence round-trip — the control. Without it the two below prove nothing.
// ═══════════════════════════════════════════════════════════════════════════

it('tenant A reads its OWN branch', async () => {
  const found = await runWithTenant(tenantIdFromClaim(TENANT_A), () =>
    repo!.findInGym(GYM_A, BRANCH_A),
  );
  assert.deepEqual(found, {
    ok: true,
    branch: { id: BRANCH_A, gymId: GYM_A, name: 'A Main', status: 'ACTIVE', isPrimary: true },
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §9.9 assertion 1 — BR-TEN-01, row-level isolation
// ═══════════════════════════════════════════════════════════════════════════

it('NEGATIVE: tenant A cannot read tenant B’s branch by id', async () => {
  /*
   * The id is correct, the gym id is correct, and the row exists. RLS is the only thing standing
   * between the caller and it — and the answer must be indistinguishable from "no such branch"
   * (`A1`), or the endpoint becomes an existence oracle for other tenants' data.
   */
  const found = await runWithTenant(tenantIdFromClaim(TENANT_A), () =>
    repo!.findInGym(GYM_B, BRANCH_B),
  );
  assert.deepEqual(found, { ok: false, reason: 'UNKNOWN_BRANCH' });
});

it('NEGATIVE: tenant A cannot reach tenant B’s branch by naming its OWN gym either', async () => {
  // The other way round: right tenant scope, wrong pairing. `gymId` is in the WHERE, so the
  // database never returns the row — which is the property the repository comment claims.
  const found = await runWithTenant(tenantIdFromClaim(TENANT_A), () =>
    repo!.findInGym(GYM_A, BRANCH_B),
  );
  assert.deepEqual(found, { ok: false, reason: 'UNKNOWN_BRANCH' });
});

// ═══════════════════════════════════════════════════════════════════════════
// §9.9 assertion 2 — "the one that matters most"
// ═══════════════════════════════════════════════════════════════════════════

it('NEGATIVE: with NO tenant context the repository throws, rather than reading everything', async () => {
  /*
   * ┌─ THE ASSERTION THE WHOLE PRISMA APPROVAL RESTS ON ─────────────────────────────────────────┐
   * │ `A-01` approved Prisma on one condition: every tenant-scoped access goes through an          │
   * │ extension that opens an interactive transaction and sets `app.tenant_id` FIRST.              │
   * │                                                                                              │
   * │ Constitution §11.4.1 says why. A pooled connection carries whatever `app.tenant_id` the LAST │
   * │ request left on it. So a query with no tenant in scope does not fail — it answers with the   │
   * │ PREVIOUS tenant's rows. Every test passes, every page renders, and the breach is invisible.  │
   * │                                                                                              │
   * │ The extension refusing first is what turns that into a throw. This test is the proof that it │
   * │ still does.                                                                                   │
   * └──────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  await assert.rejects(
    () => repo!.findInGym(GYM_A, BRANCH_A),
    (error: Error) => {
      assert.match(
        `${error.name} ${error.message}`,
        /MissingTenantContext|no tenant|tenant context/i,
        `expected a LOUD refusal naming the missing tenant context, got: ${error.message}`,
      );
      return true;
    },
    'a query with no tenant context did not throw — under connection pooling this reads the ' +
      'previous request’s tenant rows, and nothing anywhere would notice',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// activeInGym — the ordering the deactivation rule depends on
// ═══════════════════════════════════════════════════════════════════════════

it('activeInGym returns only this tenant’s branches', async () => {
  const a = (await runWithTenant(tenantIdFromClaim(TENANT_A), () =>
    (repo as unknown as { activeInGym: (g: string) => Promise<{ id: string }[]> }).activeInGym(
      GYM_A,
    ),
  )) as { id: string }[];

  assert.deepEqual(
    a.map((b) => b.id),
    [BRANCH_A],
  );
});

it('activeInGym under tenant A returns NOTHING for tenant B’s gym', async () => {
  const b = (await runWithTenant(tenantIdFromClaim(TENANT_A), () =>
    (repo as unknown as { activeInGym: (g: string) => Promise<{ id: string }[]> }).activeInGym(
      GYM_B,
    ),
  )) as { id: string }[];

  // An empty list rather than an error, because "this gym has no branches" and "this gym is not
  // yours" must look the same to a caller — the same `A1` reasoning as the lookup above.
  assert.deepEqual(b, []);
});
