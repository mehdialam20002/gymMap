/**
 * `BR-DAT-01` · The audit row survives a bad correlation id — against real PostgreSQL.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS ALONGSIDE THE UNIT TEST
 *
 * `correlation-audit-suppression.spec.ts` drives the repository with a DOUBLED `executeRaw` and
 * reads the value at position 16 of the INSERT. That proves the repository PASSES a uuid. It cannot
 * prove the row lands, because the double accepts anything — and "the cast fails and the catch
 * swallows it" is precisely a property of PostgreSQL, not of TypeScript.
 *
 * So this runs the real `AuditPrismaRepository` against the real `audit_log`, with the real
 * `correlation_id uuid NOT NULL` column and the real `::uuid` cast, and counts rows.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { AuditPrismaRepository } from '../dist/audit/infrastructure/audit.prisma-repository.js';
import { AuditPrismaService } from '../dist/tenancy/prisma/audit-prisma.service.js';
import { applyTestEnv } from './harness/test-env.ts';

/** What `AuditPrismaService` falls back to locally — `DATABASE_URL`, i.e. the superuser. */
const TEST_SUPERUSER_URL = 'postgresql://postgres:postgres@localhost:5432/gymmap?schema=public';

/**
 * TWO connections, because running this file found that they behave differently.
 *
 * ┌─ WHAT THE FIRST RUN FOUND, AND WHY BOTH URLS ARE HERE ────────────────────────────────────────┐
 * │ Connecting as `gymmap_app` gave `42501 permission denied for table audit_log` — the grant     │
 * │ split of `Schema.md` §10.3 working exactly as designed: `app_rw` holds SELECT and nothing     │
 * │ else, INSERT belongs to `app_append`, and `gymmap_audit` is its only member.                   │
 * │                                                                                              │
 * │ Connecting as `gymmap_audit` then gave `42704 unrecognized configuration parameter            │
 * │ "app.tenant_id"` — on EVERY insert, including the `tenant_id IS NULL` rows the policy's own   │
 * │ WITH CHECK exists to permit. That is **`BLK-18`**, pinned below.                               │
 * │                                                                                              │
 * │ `LOCAL_URL` is the connection the application actually uses today: `AUDIT_DATABASE_URL` is    │
 * │ unset locally and `AuditPrismaService` documents the fallback to `DATABASE_URL`, which is     │
 * │ `postgres` — a superuser, and superusers bypass RLS. That is precisely why `BLK-18` was       │
 * │ invisible until somebody connected as the deployed role.                                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const LOCAL_URL = TEST_SUPERUSER_URL;
// No `?schema=public`: that is a Prisma parameter, and libpq rejects it as an invalid URI query
// parameter when the same string is handed to the `psql` CLI.
const AUDIT_ROLE_URL = 'postgresql://gymmap_audit:gymmap_local_dev@localhost:5432/gymmap';

// ADR-0039 · the READ side, to prove Constraints.md §8.3 survived the write-side fix.
const APP_ROLE_URL = 'postgresql://gymmap_app:gymmap_local_dev@localhost:5432/gymmap';

/** Not a uuid, and eight characters of `[A-Za-z0-9_-]` — so the log-injection sanitiser accepts it. */
const SUPPRESSOR = 'abcdefgh';

/**
 * A fresh entity id per run, because THIS TABLE CANNOT BE CLEANED UP.
 *
 * ┌─ THE FIRST VERSION TRIED TO `DELETE` IN `before()` AND WAS REFUSED BY A TRIGGER ──────────────┐
 * │ "audit_log is append-only (BR-DAT-01, NFR-SEC-13, AC-ADMN-02.3). DELETE is not permitted on   │
 * │ this table by any role. If a record is wrong, append a correcting entry — history is          │
 * │ evidence, and evidence that can be edited is not evidence."                                    │
 * │                                                                                              │
 * │ That is the guarantee working, and a test is not an exception to it. So nothing is deleted:   │
 * │ every assertion is scoped to an id this run invented, and the rows it leaves are history like │
 * │ any other. It also removes the usual integration-test hazard of one run's leftovers changing  │
 * │ the next run's counts.                                                                         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const ENTITY = { control: randomUUID(), suppressed: randomUUID(), canary: randomUUID() };

/**
 * `-v ON_ERROR_STOP=1` is not optional here.
 *
 * Without it `psql` reports the error on stderr and still exits 0, so `execFileSync` returns
 * normally and a test asserting "this statement is rejected" passes whatever happens. The first
 * version of this file omitted it and the premise check below silently proved nothing.
 */
function psql(sql: string): string {
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
}

let available = false;
let repo: AuditPrismaRepository;
let service: AuditPrismaService;

function rowsFor(entityId: string): number {
  return Number(psql(`SELECT count(*) FROM audit_log WHERE entity_id = '${entityId}';`));
}

before(async () => {
  try {
    psql('SELECT 1;');
    available = true;
  } catch {
    console.error('\n  SKIPPING — no database. pnpm infra:up\n');
    return;
  }

  applyTestEnv();

  // The service reads only these two config keys, so a literal is honest here — constructing the
  // whole AppConfig through Nest would prove nothing extra about the repository.
  // The connection the application uses today. The correlation assertions are about the
  // REPOSITORY's behaviour, so they run on the path the repository actually takes; `BLK-18` below
  // is where the deployed role is exercised.
  service = new AuditPrismaService({
    AUDIT_DATABASE_URL: LOCAL_URL,
    DATABASE_URL: LOCAL_URL,
    APP_ENV: 'test',
  } as never);
  repo = new AuditPrismaRepository(service);
});

after(async () => {
  if (!available) return;
  // Nothing is deleted — see ENTITY. Only the pool is closed.
  await service.onModuleDestroy();
});

// `void | Promise<void>`: the BLK-18 canaries are synchronous — they call `asRole()`, which runs
// psql through `execFileSync` — and the skip-if-no-database wrapper is the only reason they go
// through this helper at all. `await` on a non-promise is a no-op, so both shapes work.
const it = (name: string, fn: () => void | Promise<void>) =>
  test(name, async (t) => {
    if (!available) return t.skip('no database');
    await fn();
  });

const ACTOR = '0192de00-3000-7000-8000-00000000b001';

const entry = (entityId: string, correlationId: string) => ({
  tenantId: null,
  actorId: ACTOR,
  actorType: 'USER' as const,
  entityType: 'KYC_DOCUMENT' as const,
  entityId,
  action: 'EXPORT' as const,
  correlationId,
});

it('CONTROL — a well-formed correlation id writes exactly one row', async () => {
  // Without this, the assertion below is vacuous: if `append()` wrote nothing for ANY input, the
  // "the row survives" test would still see the count it expects relative to a broken baseline.
  const good = '0192de00-6028-7000-8000-0000000000c1';
  await repo.append(entry(ENTITY.control, good) as never);

  assert.equal(rowsFor(ENTITY.control), 1);
  assert.equal(
    psql(`SELECT correlation_id::text FROM audit_log WHERE entity_id = '${ENTITY.control}';`),
    good,
    'a valid correlation id was not stored verbatim',
  );
});

it('the cast really does reject the suppressor — the premise, checked', async () => {
  // Stated rather than assumed. If PostgreSQL ever accepted this string, every assertion in this
  // file and in the unit spec would be guarding against nothing.
  let rejected = false;
  try {
    psql(`SELECT '${SUPPRESSOR}'::uuid;`);
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true, `'${SUPPRESSOR}'::uuid was accepted — the defect never existed`);
  await Promise.resolve();
});

it('a non-uuid correlation id STILL writes the row — the record is not lost with it', async () => {
  // ┌─ THE REGRESSION, AT THE LAYER THAT CAN ACTUALLY FAIL ──────────────────────────────────────┐
  // │ Before the fix this INSERT threw inside the repository's `try`, the `catch` logged and      │
  // │ resolved, and the caller proceeded with NO audit row. Nothing anywhere returned an error.   │
  // │                                                                                            │
  // │ Losing the whole record over the one field that says nothing about WHO did WHAT is the      │
  // │ worst trade available, so the id is replaced and the row lands.                             │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  await repo.append(entry(ENTITY.suppressed, SUPPRESSOR) as never);

  assert.equal(rowsFor(ENTITY.suppressed), 1, 'the audit row was silently dropped');

  const stored = psql(
    `SELECT correlation_id::text FROM audit_log WHERE entity_id = '${ENTITY.suppressed}';`,
  );
  assert.match(
    stored,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    'the stored correlation id is not a uuid',
  );
  assert.notEqual(stored, SUPPRESSOR);
});

it('the row still records WHO did WHAT, which is what BR-DAT-01 is for', async () => {
  // The replacement must cost only the trace join. If the substitution had corrupted the actor or
  // the action, keeping the row would be worse than dropping it.
  const row = psql(
    `SELECT actor_id::text || '|' || entity_type::text || '|' || action::text
       FROM audit_log WHERE entity_id = '${ENTITY.suppressed}';`,
  );
  assert.equal(row, `${ACTOR}|KYC_DOCUMENT|EXPORT`);
  await Promise.resolve();
});

// ═══════════════════════════════════════════════════════════════════════════
// BLK-18 — pinned as a canary, because it is currently UNFIXED
// ═══════════════════════════════════════════════════════════════════════════

/** Run one statement as a named role and return the error text, or '' on success. */
function asRole(url: string, sql: string): string {
  try {
    execFileSync(
      'docker',
      ['exec', '-i', 'gymmap-postgres', 'psql', url, '-tA', '-v', 'ON_ERROR_STOP=1'],
      {
        input: sql,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    return '';
  } catch (error) {
    const shell = error as { stderr?: string };
    return (shell.stderr ?? String(error)).trim();
  }
}

const APPEND_PROBE = `INSERT INTO audit_log
  (id, occurred_at, tenant_id, actor_id, actor_type, entity_type, entity_id, action, correlation_id)
  VALUES (gen_random_uuid(), now(), NULL, gen_random_uuid(), 'USER', 'KYC_DOCUMENT',
          '${ENTITY.canary}', 'EXPORT', gen_random_uuid());`;

it('ADR-0039 — as the DEPLOYED audit role, the write SUCCEEDS. BLK-18 is closed.', () => {
  /*
   * ┌─ THIS WAS A CANARY THAT SAID "WHEN I GO RED, THE BUG IS FIXED". IT WENT RED. ───────────────┐
   * │ Before ADR-0039 this same insert failed with SQLSTATE 42704, *"unrecognized configuration    │
   * │ parameter app.tenant_id"*, and `AuditPrismaRepository.append()` swallowed it by design — so   │
   * │ `BR-DAT-01` was unsatisfiable in any environment using the documented audit credential and    │
   * │ `audit_log` held zero rows.                                                                   │
   * │                                                                                              │
   * │ The policy was `FOR ALL TO app_rw, app_append` with a `WITH CHECK` opening on the RAISING     │
   * │ form of `current_setting`. The grants already said what the policy should have been:           │
   * │ `app_rw : SELECT`, `app_append : INSERT`. So the read policy narrowed to `FOR SELECT TO       │
   * │ app_rw` — which is what `AuditStrategy.md` §2.3's own block specifies — and `app_append` got  │
   * │ a `FOR INSERT` policy with no predicate, because a writer checked against a value it chose    │
   * │ itself is §8.4's tautology.                                                                    │
   * │                                                                                              │
   * │ `Constraints.md` §8.3 was NOT amended. `missing_ok` is still never written, and a READ with   │
   * │ no tenant context still raises — asserted below.                                               │
   * └──────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const error = asRole(AUDIT_ROLE_URL, APPEND_PROBE);

  assert.equal(
    error,
    '',
    'the deployed audit credential cannot write an audit row. BR-DAT-01 is unsatisfiable again — ' +
      `this is BLK-18 returning: ${error}`,
  );
});

it('ADR-0039 — app_append can ONLY insert: no read, no update, no delete', () => {
  /*
   * The other half of the fix, and the half a reader should be able to check without trusting me.
   * `WITH CHECK (true)` sounds permissive. What bounds this role is its GRANT: one table, insert
   * only, reads nothing. Asserted rather than asserted-in-a-comment.
   */
  for (const statement of [
    'SELECT count(*) FROM audit_log;',
    "UPDATE audit_log SET action = 'LOGIN';",
    'DELETE FROM audit_log;',
  ]) {
    assert.match(
      asRole(AUDIT_ROLE_URL, statement),
      /permission denied for table audit_log/,
      `app_append was permitted: ${statement}`,
    );
  }
});

it('ADR-0039 — a READ with no tenant context still raises, so §8.3 is intact', () => {
  /*
   * `Constraints.md` §8.3's reasoning is about the READ side: a NULL predicate returns zero rows
   * silently, the bug looks like missing data, somebody widens the policy to "fix" it, and THAT is
   * the breach. The read policy keeps the one-argument `current_setting`, so an unset variable is
   * a loud failure rather than an empty result.
   */
  assert.match(
    asRole(APP_ROLE_URL, 'SELECT count(*) FROM audit_log;'),
    /unrecognized configuration parameter/,
    'a tenant read with no context returned rows instead of raising — §8.3 has been weakened',
  );
});
