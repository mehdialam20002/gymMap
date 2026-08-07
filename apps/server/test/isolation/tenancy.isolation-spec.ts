/**
 * M-012 · THE ONE HAND-WRITTEN ISOLATION SPEC — R-M3. Assertions A1–A4.
 *
 * Deleted by M-015, which generates a case group per route from the OpenAPI document. It exists
 * now because the generator needs something to be modelled on, and because the Sprint-0 exit
 * condition needs the four assertions to have been made at least once by hand.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * A4 IS THE ONE PEOPLE SKIP, AND IT IS THE ONLY REASON THE OTHER THREE MEAN ANYTHING.
 *
 * Suppose `app.tenant_id` were globally broken — misspelled in the policy, say, so the predicate
 * never matches for anyone. Then:
 *
 *   A1  tenant B cannot read tenant A     ✓ passes (B reads nothing at all)
 *   A2  tenant B cannot write tenant A    ✓ passes (B writes nothing at all)
 *   A3  B's collection excludes A's rows  ✓ passes (B's collection is empty)
 *
 * All green, and the system returns nothing to everybody. `TestingStrategy.md` §5.4 calls this
 * the CATASTROPHIC FALSE PASS, and E0.5 exists because of it.
 *
 * A4 is the positive control: tenant A, asking for its own data, must get a NON-EMPTY result.
 * It is the assertion that distinguishes "isolation works" from "nothing works".
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

import { PrismaClient } from '@prisma/client';

import { runWithTenant } from '../../dist/tenancy/context/tenant-context.als.js';
import { withTenantContext } from '../../dist/tenancy/prisma/tenant-scoped-client.js';
import { TENANT_A, TENANT_B, seedTenantsSql } from '../../prisma/seed/tenants.ts';
import { tenantId } from '@gymmap/types';

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

/**
 * Runs SQL and returns stdout AND stderr together.
 *
 * Needed because psql without `-v ON_ERROR_STOP=1` prints its error to stderr and still exits 0
 * — so `execFileSync` does not throw, and a try/catch around a failing statement catches
 * nothing. A test written that way reports "no refusal" while the database refused correctly.
 */
function psqlCombined(sql: string): string {
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
        // Without this psql exits 0 on a failed statement, execFileSync does not throw, and the
        // stderr carrying the actual reason is never read. The first version of this helper saw
        // only `SET BEGIN SET ROLLBACK` — enough to know something was refused, and not enough
        // to know it was the POLICY rather than a constraint or a typo.
        '-v',
        'ON_ERROR_STOP=1',
      ],
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    return `${e.stdout ?? ''}\n${e.stderr ?? ''}`;
  }
}

before(async () => {
  try {
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
    console.error(
      `\n  SKIPPING the isolation assertions — no database.\n` +
        `    pnpm infra:up && pnpm --filter @gymmap/server db:setup\n` +
        `  ${error instanceof Error ? error.message.split('\n')[0] : String(error)}\n`,
    );
  }
});

after(async () => {
  if (available) await raw.$disconnect();
});

const it = (name: string, fn: () => Promise<void>) =>
  test(name, async (t) => {
    if (!available) return t.skip('no database');
    await fn();
  });

// ═══════════════════════════════════════════════════════════════════════════
// A4 FIRST. Deliberately.
//
// Ordered first so that when the suite is read, and when it fails, the positive control is the
// thing seen before the three negatives. A suite that opens with three "cannot" assertions
// trains the reader to skim them as a block.
// ═══════════════════════════════════════════════════════════════════════════

it('A4 · POSITIVE CONTROL — tenant A reading its OWN data gets a NON-EMPTY result', async () => {
  const rows = await runWithTenant(tenantId(TENANT_A), async () => client.tenant.findMany());

  assert.ok(
    rows.length > 0,
    'Tenant A can see nothing. Every "cannot read another tenant" assertion below would now ' +
      'pass trivially, because nothing is readable by anybody — the catastrophic false pass of ' +
      'TestingStrategy.md §5.4. This is the assertion that distinguishes "isolation works" from ' +
      '"the system is broken".',
  );
  assert.equal(rows[0]!.id, TENANT_A);
  assert.ok(rows[0]!.legalName.length > 0, 'the row came back but carries no data');
});

it('A4 · and tenant B, independently, also gets its OWN non-empty result', async () => {
  // Both directions. A policy accidentally hardcoded to tenant A would pass the assertion above.
  const rows = await runWithTenant(tenantId(TENANT_B), async () => client.tenant.findMany());
  assert.ok(rows.length > 0, 'tenant B can see nothing');
  assert.equal(rows[0]!.id, TENANT_B);
});

// ═══════════════════════════════════════════════════════════════════════════
// A1 — a cross-tenant READ returns nothing.
// ═══════════════════════════════════════════════════════════════════════════

it('A1 · tenant B cannot read tenant A by id', async () => {
  const row = await runWithTenant(tenantId(TENANT_B), async () =>
    client.tenant.findFirst({ where: { id: TENANT_A } }),
  );
  assert.equal(row, null);
});

it('A1 · and the reverse, so the policy is not hardcoded to one direction', async () => {
  const row = await runWithTenant(tenantId(TENANT_A), async () =>
    client.tenant.findFirst({ where: { id: TENANT_B } }),
  );
  assert.equal(row, null);
});

// ═══════════════════════════════════════════════════════════════════════════
// A2 — a cross-tenant WRITE is refused, and the refusal is indistinguishable
//      from the refusal for a row that does not exist.
// ═══════════════════════════════════════════════════════════════════════════

it('A2 · tenant B cannot UPDATE tenant A, and cannot tell it from a missing row', async () => {
  const updateOther = await runWithTenant(tenantId(TENANT_B), async () =>
    client.tenant.updateMany({ where: { id: TENANT_A }, data: { tradingName: 'hijacked' } }),
  );

  const updateNonexistent = await runWithTenant(tenantId(TENANT_B), async () =>
    client.tenant.updateMany({
      where: { id: '01912f00-0000-7000-8000-0000000000ff' },
      data: { tradingName: 'hijacked' },
    }),
  );

  // BYTE IDENTITY, not just "both zero". A response that differs at all between "yours but
  // forbidden" and "does not exist" is an oracle, however quiet.
  assert.deepEqual(updateOther, updateNonexistent);
  assert.equal(updateOther.count, 0);

  // And confirm nothing actually changed, read back OUTSIDE any tenant scope.
  const stored = psql(`SELECT trading_name FROM tenants WHERE id = '${TENANT_A}';`);
  assert.notEqual(stored, 'hijacked');
});

it('A2 · a cross-tenant INSERT is refused by WITH CHECK (PC4, AC-FND-01.1)', async () => {
  // ┌─ RAW SQL, NOT PRISMA, AND THE REASON IS RECORDED AS BLK-06 ─────────────────────────────┐
  // │ Prisma CANNOT WRITE to a Postgres DOMAIN column. `tenants.reserve_bps` is domain         │
  // │ `basis_points`, and a Prisma `create` fails with SQLSTATE 22P03 "incorrect binary data   │
  // │ format in bind parameter 12" — BEFORE the statement reaches the RLS policy. Proved by    │
  // │ altering that one column to plain `integer`, at which point the insert succeeds.          │
  // │                                                                                          │
  // │ So a Prisma-based assertion here would "pass" for entirely the wrong reason: the write   │
  // │ would be refused by a binary-format error, not by WITH CHECK, and the test would report  │
  // │ that isolation works when it had never been exercised. That is the catastrophic false    │
  // │ pass in a different costume.                                                             │
  // │                                                                                          │
  // │ Raw SQL exercises the POLICY, which is what A2 is about. The Prisma limitation is a      │
  // │ separate conflict between Schema.md §2.4 (domains) and A-01 (Prisma), recorded in        │
  // │ docs/PHASES.md as BLK-06 and awaiting an owner decision.                                  │
  // └──────────────────────────────────────────────────────────────────────────────────────────┘
  // The outcome is read from psql's OUTPUT, not from whether it threw.
  //
  // Without `-v ON_ERROR_STOP=1`, psql prints the error to stderr and still exits 0 — so a
  // try/catch here catches nothing and `refused` stays false while the database did exactly the
  // right thing. Asserting on the message is also stronger: it proves the refusal came from the
  // POLICY rather than from a constraint, a type error or a typo in the statement.
  const output = psqlCombined(
    `SET ROLE app_rw;
     BEGIN;
     SET LOCAL app.tenant_id = '${TENANT_B}';
     INSERT INTO tenants (id, legal_name, entity_type)
     VALUES ('01912f00-0000-7000-8000-0000000000fe', 'Smuggled', 'COMPANY');
     COMMIT;`,
  );

  assert.match(
    output,
    /new row violates row-level security policy/i,
    `WITH CHECK must refuse an insert outside the caller scope. psql said:\n${output}`,
  );

  // And the row genuinely is not there.
  assert.equal(
    psql(`SELECT count(*) FROM tenants WHERE id = '01912f00-0000-7000-8000-0000000000fe';`),
    '0',
  );
  await Promise.resolve();
});

// ═══════════════════════════════════════════════════════════════════════════
// A3 — a COLLECTION is filtered, asserted by COUNT.
//
// By count rather than by inspecting the ids: a filter that returned the right ids but a wrong
// count would mean the same row twice, and a filter that returned a correct-looking page while
// the total was wrong is exactly what a broken `LIMIT` interaction produces.
// ═══════════════════════════════════════════════════════════════════════════

it('A3 · a collection read is filtered — one row, not three', async () => {
  const total = Number(psql(`SELECT count(*) FROM tenants WHERE deleted_at IS NULL;`));
  assert.ok(total >= 2, `the fixture needs at least two tenants, found ${total}`);

  const visibleToA = await runWithTenant(tenantId(TENANT_A), async () => client.tenant.count());

  assert.equal(
    visibleToA,
    1,
    `tenant A can count ${visibleToA} of ${total} tenants. Under P-SELF the answer is always 1 ` +
      `— a tenant that can count this table can count the platform's customers.`,
  );
});

it('A3 · findMany returns the same one row, so count and list agree', async () => {
  // A count that is right while the list is wrong is a real failure mode: they take different
  // query paths, and only one of them is usually tested.
  const rows = await runWithTenant(tenantId(TENANT_A), async () => client.tenant.findMany());
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.id, TENANT_A);
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-7 — SQL injection supplied AS A VALUE is inert.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-7 · `OR 1=1` passed as a VALUE never widens the result (SEC-A03-002)', async () => {
  // TWO safe outcomes, and the test accepts either.
  //
  //   rejected   the value never reaches the database — Prisma refuses to coerce it to a uuid
  //   zero rows  it reaches the database as a literal and matches nothing
  //
  // Rejection is the STRONGER outcome, and it is what actually happens here. An earlier version
  // of this test demanded zero rows and failed against the safer behaviour — a test that insists
  // on the weaker of two correct answers is a test that will eventually be "fixed" by weakening
  // the code.
  //
  // What must NEVER happen is a row from another tenant, which is the only thing asserted.
  let rows: unknown[] = [];
  try {
    rows = await runWithTenant(tenantId(TENANT_A), async () =>
      client.tenant.findMany({ where: { id: "' OR 1=1 --" } }),
    );
  } catch {
    rows = [];
  }
  assert.equal(rows.length, 0);
});

it('AC-7 · a value that unions in another tenant returns nothing', async () => {
  const rows = await runWithTenant(tenantId(TENANT_A), async () =>
    client.tenant.findMany({
      where: { tradingName: `x' UNION SELECT * FROM tenants WHERE id='${TENANT_B}` },
    }),
  );
  assert.equal(rows.length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════
// The repository refuses before reaching Postgres — AC-1.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-1 · a context-free read throws before a statement is sent', async () => {
  const { TenantPrismaRepository } =
    await import('../../dist/tenancy/infrastructure/tenant.prisma-repository.js');
  const { MissingTenantContextError } = await import('../../dist/tenancy/domain/tenancy.errors.js');

  const repository = new TenantPrismaRepository({ client } as never);

  const before = psql(
    `SELECT count(*) FROM pg_stat_activity WHERE datname='gymmap' AND state='idle in transaction';`,
  );
  await assert.rejects(() => repository.findOwnTenant(), MissingTenantContextError);
  const after = psql(
    `SELECT count(*) FROM pg_stat_activity WHERE datname='gymmap' AND state='idle in transaction';`,
  );

  assert.equal(before, after, 'a transaction was opened despite the missing context');
});
