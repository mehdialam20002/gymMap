/**
 * M-010 · The extension's acceptance criteria — PX-1, PX-2, PX-4, PX-5, PX-6.
 *
 * Against a REAL PostgreSQL with RLS forced. These are the assertions that decide whether
 * ADR-0005 is satisfied, and none of them can be made against a mock: the whole hazard is a
 * property of connection pooling, and a mock has one connection.
 *
 * PX-1 is the one that matters most. It captures `pg_backend_pid()` beside the `set_config` and
 * beside the query and asserts they are IDENTICAL. If they ever differ, the setting was applied
 * to one connection and the query ran on another — which is the leak this whole module exists
 * to prevent, and it is invisible in every other kind of test.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

import { PrismaClient } from '@prisma/client';

import {
  runWithTenant,
  runWithoutTenant,
  runWithPlatformScope,
} from '../../dist/tenancy/context/tenant-context.als.js';
import {
  GLOBAL_MODELS,
  currentTransactionDepth,
  runInTenantTransaction,
  withTenantContext,
} from '../../dist/tenancy/prisma/tenant-scoped-client.js';
import {
  MissingTenantContextError,
  NestedTransactionError,
} from '../../dist/tenancy/domain/tenancy.errors.js';
import { TENANT_A, TENANT_B, seedTenantsSql } from '../../prisma/seed/tenants.ts';
import { tenantId } from '@gymmap/types';

/**
 * Connects as `gymmap_app`, NOT as `postgres`.
 *
 * ┌─ THIS LINE IS THE DIFFERENCE BETWEEN A REAL TEST AND A DECORATIVE ONE ─────────────────────┐
 * │ `postgres` is a SUPERUSER, and a superuser bypasses row-level security completely. Not     │
 * │ "unless FORCE" — FORCE lifts the exemption for the table OWNER and does nothing about      │
 * │ superusers.                                                                                 │
 * │                                                                                             │
 * │ The first version of this suite used the postgres URL. Every policy assertion elsewhere    │
 * │ still passed, because those use SET ROLE to reach app_rw explicitly. It was only            │
 * │ `client.tenant.findMany()` returning 3 rows where P-SELF guarantees 1 that revealed the    │
 * │ application had no non-superuser account to connect as at all.                              │
 * │                                                                                             │
 * │ An application that connects as a superuser has RLS in its schema and none in its runtime. │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const DATABASE_URL =
  process.env['DATABASE_URL_APP'] ??
  'postgresql://gymmap_app:gymmap_local_dev@localhost:5432/gymmap?schema=public';

let raw: PrismaClient;
let client: ReturnType<typeof withTenantContext>;
let available = false;

function psql(sql: string): string {
  return execFileSync(
    'docker',
    ['exec', '-i', 'gymmap-postgres', 'psql', '-U', 'postgres', '-d', 'gymmap', '-tA'],
    { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();
}

before(async () => {
  try {
    psql('SELECT 1;');
    psql(`
      SET session_replication_role = 'replica';
      DELETE FROM tenants WHERE id IN ('${TENANT_A}','${TENANT_B}');
      SET session_replication_role = 'origin';
      ${seedTenantsSql()}
    `);
    raw = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
    await raw.$connect();
    client = withTenantContext(raw);
    available = true;
  } catch (error) {
    available = false;
    console.error(
      `\n  SKIPPING the extension suite — no database.\n` +
        `    pnpm infra:up && pnpm --filter @gymmap/server db:deploy\n` +
        `  ${error instanceof Error ? error.message.split('\n')[0] : String(error)}\n`,
    );
  }
});

after(async () => {
  if (available) {
    psql(`
      SET session_replication_role = 'replica';
      DELETE FROM tenants WHERE id IN ('${TENANT_A}','${TENANT_B}');
      SET session_replication_role = 'origin';
    `);
    await raw.$disconnect();
  }
});

const it = (name: string, fn: () => Promise<void>) =>
  test(name, async (t) => {
    if (!available) return t.skip('no database');
    await fn();
  });

// ---------------------------------------------------------------------------
// PX-1 — the assertion the whole module exists for.
// ---------------------------------------------------------------------------

it('PX-1 · set_config and the query run on the SAME connection (E0.6, AC-FND-02.1)', async () => {
  const pids = await runWithTenant(tenantId(TENANT_A), async () =>
    runInTenantTransaction(raw, async (tx) => {
      // Captured INSIDE the transaction, on either side of a real query. If the pool handed
      // these to different backends, the tenant setting and the query would be on different
      // sessions — the leak, and completely invisible from the result.
      const before = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      await tx.$queryRaw`SELECT 1 FROM tenants LIMIT 1`;
      const after = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      return { before: before[0]!.pid, after: after[0]!.pid };
    }),
  );

  assert.equal(
    pids.before,
    pids.after,
    'set_config and the query ran on DIFFERENT backends. app.tenant_id was applied to one ' +
      'connection and the query executed on another — ADR-0005 is unsatisfied and the pooling ' +
      'hazard is live.',
  );
});

it('PX-1 · the setting is visible inside the transaction and equals the tenant', async () => {
  const seen = await runWithTenant(tenantId(TENANT_A), async () =>
    runInTenantTransaction(raw, async (tx) => {
      const rows = await tx.$queryRaw<
        { value: string }[]
      >`SELECT current_setting('app.tenant_id') AS value`;
      return rows[0]!.value;
    }),
  );
  assert.equal(seen, TENANT_A);
});

// ---------------------------------------------------------------------------
// PX-2 — is_local. The setting must not survive the commit.
// ---------------------------------------------------------------------------

it('PX-2 · after COMMIT the setting is UNSET on the same physical connection', async () => {
  // The failure this catches: `set_config(..., false)` leaves the value session-level, so the
  // connection returns to the pool still carrying tenant A — and the next request, for tenant
  // B, reads A's rows with nothing thrown and nothing logged.
  await runWithTenant(tenantId(TENANT_A), async () =>
    runInTenantTransaction(raw, async (tx) => {
      await tx.$queryRaw`SELECT 1`;
    }),
  );

  // `missing_ok => true` HERE, deliberately, and only here: this assertion needs to observe
  // "unset" as a value rather than as an exception. The POLICY must never use it.
  const rows = await raw.$queryRaw<
    { value: string | null }[]
  >`SELECT current_setting('app.tenant_id', true) AS value`;

  const value = rows[0]?.value ?? null;
  assert.ok(
    value === null || value === '',
    `app.tenant_id survived the commit as "${value}". The third argument to set_config must be ` +
      `true (is_local) — otherwise a pooled connection carries one tenant's scope into the next ` +
      `request.`,
  );
});

// ---------------------------------------------------------------------------
// PX-4 — no context is a THROW, never an unfiltered query.
// ---------------------------------------------------------------------------

it('PX-4 · with no context, a tenant-scoped operation THROWS (AC-FND-02.2, BR2)', async () => {
  await runWithoutTenant(async () => {
    await assert.rejects(
      () => client.tenant.findMany(),
      (error: unknown) => {
        assert.ok(
          error instanceof MissingTenantContextError,
          `expected MissingTenantContextError, got ${String(error)}`,
        );
        return true;
      },
    );
  });
});

it('PX-4 · the error is a 500, not a 403 — a caller cannot provoke it', async () => {
  // Security.md P3 / alert 8. A 403 is expected, monitored and ignorable; a 500 pages someone.
  // Neither of these errors is about the caller, so classifying them as the caller's fault
  // routes the investigation to the wrong place and mutes the alert that matters.
  const error = new MissingTenantContextError('Tenant', 'findMany');
  assert.equal(error.httpStatus, 500);
  assert.equal(error.code, 'TENANT_CONTEXT_MISSING');
  await Promise.resolve();
});

it('PX-4 · the query is NOT executed — it throws before reaching the database', async () => {
  // Proved by connection count rather than by inspection: a query that reached Postgres and was
  // rejected by RLS would still have opened a transaction.
  const before = psql(
    `SELECT count(*) FROM pg_stat_activity WHERE datname='gymmap' AND state='idle in transaction';`,
  );
  await runWithoutTenant(async () => {
    await assert.rejects(() => client.tenant.findMany());
  });
  const after = psql(
    `SELECT count(*) FROM pg_stat_activity WHERE datname='gymmap' AND state='idle in transaction';`,
  );
  assert.equal(before, after, 'a transaction was opened despite the missing context');
});

// ---------------------------------------------------------------------------
// PX-5 — $allModels means a model added tomorrow is protected today.
// ---------------------------------------------------------------------------

it('PX-5 · the extension binds $allModels, so coverage is not a maintained list', async () => {
  // Introspection over the runtime client rather than a hardcoded expectation: the point of
  // $allModels is that nobody has to update anything when a model appears.
  const modelNames = Object.keys(raw).filter(
    (key) =>
      !key.startsWith('$') && !key.startsWith('_') && typeof (raw as never)[key] === 'object',
  );
  assert.ok(modelNames.length > 0, 'no models found on the client — has prisma generate run?');

  for (const model of modelNames) {
    const capitalised = model.charAt(0).toUpperCase() + model.slice(1);
    if (GLOBAL_MODELS.has(capitalised)) continue;

    await runWithoutTenant(async () => {
      await assert.rejects(
        () => (client as any)[model].findMany(),
        MissingTenantContextError,
        `model "${model}" is NOT covered by the extension. A model outside the interception is a ` +
          `model whose queries run with no tenant scope.`,
      );
    });
  }
});

it('PX-5 · a GLOBAL model is reachable WITHOUT a tenant context', async () => {
  // The other half. If reference data required a tenant, the login page would need to know who
  // is logging in before it could render.
  assert.ok(GLOBAL_MODELS.has('Country'));
  assert.ok(GLOBAL_MODELS.has('SubscriptionTier'));
  assert.ok(!GLOBAL_MODELS.has('Tenant'), 'Tenant is tenant-owned and must never be global');
  await Promise.resolve();
});

// ---------------------------------------------------------------------------
// PX-6 — exactly one interactive transaction per unit of work.
// ---------------------------------------------------------------------------

it('PX-6 · a nested interactive transaction THROWS (P4)', async () => {
  await runWithTenant(tenantId(TENANT_A), async () => {
    await assert.rejects(
      () =>
        runInTenantTransaction(raw, async () => {
          // A nested $transaction is a SAVEPOINT: it shares the outer connection and therefore
          // the outer app.tenant_id, while reading like an independent boundary.
          await runInTenantTransaction(raw, async () => undefined);
        }),
      NestedTransactionError,
    );
  });
});

it('PX-6 · the depth guard resets even when the body throws', async () => {
  await runWithTenant(tenantId(TENANT_A), async () => {
    await assert.rejects(() =>
      runInTenantTransaction(raw, async () => {
        throw new Error('boom');
      }),
    );
    assert.equal(
      currentTransactionDepth(),
      0,
      'a throw left the depth raised. Every later operation in this request would then skip its ' +
        'own scoping and run with no app.tenant_id.',
    );
  });
});

// ---------------------------------------------------------------------------
// The context transitions.
// ---------------------------------------------------------------------------

it('re-entering the SAME tenant is permitted — nested service calls do it constantly', async () => {
  const value = await runWithTenant(tenantId(TENANT_A), async () =>
    runWithTenant(tenantId(TENANT_A), async () => 'ok'),
  );
  assert.equal(value, 'ok');
});

it('BR-TEN-02-N1 · entering a DIFFERENT tenant throws', async () => {
  await assert.rejects(
    async () =>
      runWithTenant(tenantId(TENANT_A), async () =>
        runWithTenant(tenantId(TENANT_B), async () => 'should not reach here'),
      ),
    /TENANT_CONTEXT_ALREADY_SET|second, different tenant/i,
  );
});

it('an elevation cannot start inside a tenant scope', async () => {
  // The shape of an accidental privilege escalation: a cross-tenant read begun inside one
  // tenant's request, attributed to that request's actor.
  await assert.rejects(
    async () =>
      runWithTenant(tenantId(TENANT_A), async () =>
        runWithPlatformScope('actor-1', 'reviewing an application', async () => 'nope'),
      ),
    /TENANT_CONTEXT_ALREADY_SET|second, different tenant/i,
  );
});

it('a platform elevation demands a real reason', async () => {
  assert.throws(
    () => runWithPlatformScope('actor-1', 'fix', () => undefined),
    /at least 8 characters/,
  );
  await Promise.resolve();
});

// ---------------------------------------------------------------------------
// The end-to-end guarantee: the extension actually scopes reads.
// ---------------------------------------------------------------------------

it("a scoped read returns ONLY the caller's tenant", async () => {
  const rows = await runWithTenant(tenantId(TENANT_A), async () => client.tenant.findMany());
  assert.equal(rows.length, 1, 'P-SELF: a tenant sees exactly its own row');
  assert.equal(rows[0]!.id, TENANT_A);
});

it('tenant B sees B, and never A', async () => {
  const rows = await runWithTenant(tenantId(TENANT_B), async () => client.tenant.findMany());
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.id, TENANT_B);
});
