/**
 * M-015 · A7 — THE FALSIFIABILITY PROOF. `E0.4`, `AC-EP01-04`, acceptance criterion 8.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WITHOUT THIS FILE, THE OTHER SIX ASSERTIONS ARE UNFALSIFIABLE
 *
 * A1, A2 and A3 all assert that something does NOT happen. Every one of them passes on a system
 * where nothing happens at all — and, more insidiously, on a suite that is not actually reaching
 * the database policy: a query that errors, a fixture that is missing, a client that was never
 * connected. Each produces "no cross-tenant rows returned", which is what the suite checks for.
 *
 * So A7 turns the question around. It DISABLES row-level security and demands the suite go RED.
 * If the assertions still pass with the policies switched off, they were never exercising the
 * policies, and the correct conclusion is not "isolation works" but
 *
 *     Isolation suite passes with RLS disabled — it is not exercising the database policy
 *
 * which is what this file reports. A green result HERE fails the build.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ THIS RUNS AGAINST A SCRATCH SCHEMA, NEVER THE SHARED ONE ──────────────────────────────────┐
 * │ Disabling RLS on the real `tenants` table and failing to restore it would leave the         │
 * │ database with isolation switched off — and every subsequent suite would pass while proving  │
 * │ nothing, which is precisely the state this file exists to detect. A `try/finally` is not     │
 * │ enough: a killed process skips it.                                                           │
 * │                                                                                              │
 * │ So the whole test runs inside a TRANSACTION THAT IS ROLLED BACK, in one psql invocation.     │
 * │ A crashed process leaves an aborted transaction, which Postgres discards. There is no state  │
 * │ to restore because nothing was ever committed.                                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

import { TENANT_A, TENANT_B, seedTenantsSql } from '../../prisma/seed/tenants.ts';

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

test('the database is reachable, or A7 proves nothing', () => {
  psql(seedTenantsSql());
  available = /^1$/m.test(psql('SELECT 1;'));
  if (!available) {
    console.error('\n  SKIPPING A7 — no database. pnpm infra:up\n');
  }
});

const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    fn();
  });

/** The A1/A3 subset, as raw SQL, so it can be run twice — with RLS on and with it off. */
function crossTenantRowCount(disableRls: boolean): string {
  return psql(
    `BEGIN;
     ${disableRls ? 'ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;' : ''}
     SET LOCAL ROLE app_rw;
     SET LOCAL app.tenant_id = '${TENANT_A}';
     SELECT 'crossTenantVisible=' || count(*) FROM tenants WHERE id = '${TENANT_B}';
     SELECT 'totalVisible=' || count(*) FROM tenants;
     RESET ROLE;
     ROLLBACK;`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// The two halves. Neither means anything without the other.
// ═══════════════════════════════════════════════════════════════════════════

it('A7 · WITH RLS — tenant A sees zero rows of tenant B', () => {
  const observed = crossTenantRowCount(false);
  assert.match(
    observed,
    /crossTenantVisible=0/,
    `Isolation is NOT holding with RLS enabled. This is the primary failure, not a control:\n${observed}`,
  );
  assert.match(observed, /totalVisible=1/, `tenant A should see exactly itself:\n${observed}`);
});

it('A7 · WITHOUT RLS — the SAME query returns tenant B, or the suite proves nothing', () => {
  const observed = crossTenantRowCount(true);

  assert.ok(
    !/crossTenantVisible=0/.test(observed),
    'Isolation suite passes with RLS disabled — it is not exercising the database policy.\n\n' +
      '  The identical query returned zero cross-tenant rows with row-level security switched\n' +
      '  OFF. Whatever is producing that zero, it is not the policy: a query that errors, a\n' +
      '  fixture that is missing, or a role that was never assumed all produce the same result.\n' +
      '  Every A1, A2 and A3 assertion in this suite is therefore unfalsifiable.\n\n' +
      `  psql said:\n${observed}`,
  );

  assert.match(
    observed,
    /crossTenantVisible=1/,
    `with RLS disabled tenant A must see tenant B's row:\n${observed}`,
  );
  // Parsed as a NUMBER, not matched as a digit.
  //
  // This was `/totalVisible=[3-9]/`, which quietly encoded two assumptions: that the fixture holds
  // three tenants, and that the table never grows past nine. The second broke the moment a demo
  // dataset was seeded — 23 tenants, and the regex failed while the property it protects (with
  // RLS off, tenant A sees more than only itself) held perfectly.
  //
  // The property is a comparison, so it is written as one.
  const totalVisible = Number(/totalVisible=(\d+)/.exec(observed)?.[1] ?? '0');
  assert.ok(
    totalVisible >= 3,
    `with RLS disabled the whole table should be visible, saw ${String(totalVisible)}:\n${observed}`,
  );
});

it('A7 · the ROLLBACK restored RLS — the shared database is not left unprotected', () => {
  // The consequence of getting this wrong is the exact state A7 detects: every later suite
  // passing while proving nothing. Asserted rather than trusted, because "the transaction was
  // rolled back" is an assumption and this is a fact.
  const status = psql(
    `SELECT 'rls=' || relrowsecurity || ' forced=' || relforcerowsecurity
     FROM pg_class WHERE relname = 'tenants';`,
  );
  assert.match(status, /rls=t/, `RLS is DISABLED on tenants after A7 ran:\n${status}`);
  assert.match(
    status,
    /forced=t/,
    `FORCE ROW LEVEL SECURITY is off. Without it the table OWNER is exempt, and the owner is ` +
      `who migrations run as:\n${status}`,
  );
});

it('A7 · and the two halves genuinely differ, so the probe is sensitive', () => {
  // The control for the control. If `crossTenantRowCount` ignored its argument — a plausible
  // refactoring accident — both halves above would still pass whenever isolation happened to
  // work, and A7 would have quietly stopped falsifying anything.
  assert.notEqual(
    crossTenantRowCount(false),
    crossTenantRowCount(true),
    'the RLS-enabled and RLS-disabled probes returned IDENTICAL output. The disable argument is ' +
      'not reaching the query, so A7 is running the same test twice and calling one of them a ' +
      'negative control.',
  );
});
