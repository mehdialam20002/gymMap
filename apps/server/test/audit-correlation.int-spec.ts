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

const it = (name: string, fn: () => Promise<void>) =>
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

it('BLK-18 — as the DEPLOYED audit role, every write still fails. This is a CANARY.', () => {
  // ┌─ WHEN THIS TEST GOES RED, BLK-18 HAS BEEN FIXED AND THIS FILE SHOULD BE UPDATED ───────────┐
  // │ `AuditPrismaService` connects as `gymmap_audit` and is deliberately NOT tenant-extended —  │
  // │ its own header says why: "an audit row's tenant_id is frequently NULL … and the extension  │
  // │ refuses any operation with no tenant in scope."                                             │
  // │                                                                                            │
  // │ So `app.tenant_id` is never set on that connection, and the policy's WITH CHECK opens with │
  // │ the RAISING form of `current_setting`. PostgreSQL does not short-circuit the `OR`, so the  │
  // │ left operand raises before `tenant_id IS NULL` — which is TRUE — is ever reached. Every    │
  // │ insert fails with 42704, and `AuditPrismaRepository.append()` swallows it by design.        │
  // │                                                                                            │
  // │ BR-DAT-01 is therefore unsatisfiable in any environment using the documented audit          │
  // │ credential. It is invisible locally only because the fallback is a superuser, and           │
  // │ superusers bypass RLS.                                                                      │
  // │                                                                                            │
  // │ The obvious fix — `current_setting('app.tenant_id', true)` — is FORBIDDEN by                │
  // │ Constraints.md §8.3: "missing_ok is false. It is never written." `migration-lint` enforces  │
  // │ it and refused that change. So the fix is a schema-owner decision, raised as BLK-18.        │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const error = asRole(AUDIT_ROLE_URL, APPEND_PROBE);

  assert.match(
    error,
    /unrecognized configuration parameter/,
    'BLK-18 appears to be FIXED — the deployed audit role can now write. Update this file: turn ' +
      'this canary into a positive assertion, and close BLK-18 in docs/PHASES.md.',
  );
});

it('BLK-18 — the same write SUCCEEDS once a tenant context exists, which isolates the cause', () => {
  // Rules out the alternatives: it is not the grant (that would be 42501), not the enum values,
  // not a NOT NULL column. The only missing thing is the session variable.
  const error = asRole(
    AUDIT_ROLE_URL,
    `BEGIN;
     SELECT set_config('app.tenant_id', '0192de00-6028-7000-8000-0000000000c1', true);
     ${APPEND_PROBE}
     ROLLBACK;`,
  );
  assert.equal(error, '', `the cause is not the missing setting after all: ${error}`);
});
