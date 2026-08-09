/**
 * `M-028` `AC-6` · The event and the row commit together — `AC-FND-08.1`, `AC-FND-08.2`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * *"A ROLLED-BACK SUBMISSION DISPATCHES NOTHING"* IS A DATABASE PROPERTY
 *
 * The two orderings the outbox exists to make impossible are not symmetrical, and neither is
 * observable from a unit test with a doubled port:
 *
 *   · publish first, insert second → a reviewer is notified about an application that does not
 *     exist, opens it, and sees a 404 on a queue item the platform told them about
 *   · insert first, publish second → the row exists and nothing tells anybody, so the gym sits
 *     unreviewed until the owner complains — the failure nobody detects
 *
 * A doubled outbox records the call whether or not the transaction commits, so it proves the code
 * CALLED the port and nothing about whether the event survives a rollback. Only PostgreSQL can
 * answer that, and it is the whole acceptance criterion.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const CONTAINER = 'gymmap-postgres';

function psql(statement: string): string {
  return execFileSync(
    'docker',
    ['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', 'gymmap', '-tAc', statement],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

const one = (statement: string): string =>
  psql(statement)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)[0] ?? '';

function failure(statement: string): string {
  try {
    psql(statement);
    return '';
  } catch (error) {
    const shell = error as { stderr?: Buffer | string; message?: string };
    return String(shell.stderr ?? shell.message ?? error);
  }
}

const TENANT = '0192de00-6028-7000-8000-0000000000c1';
let available = false;

function cleanup(): void {
  psql(`DELETE FROM outbox WHERE aggregate_type = 'Application' AND payload->>'probe' = 'm028'`);
  psql(`DELETE FROM applications WHERE tenant_id = '${TENANT}'`);
  psql(`DELETE FROM tenants WHERE id = '${TENANT}'`);
}

before(() => {
  try {
    one('SELECT 1');
    available = true;
  } catch {
    available = false;
    console.error('\n  SKIPPING the M-028 submission assertions — no database reachable.\n');
    return;
  }

  cleanup();
  psql(
    `INSERT INTO tenants (id, legal_name, entity_type, status)
       VALUES ('${TENANT}', 'Iron House', 'COMPANY', 'DRAFT')`,
  );
});

after(() => {
  if (available) cleanup();
});

const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    fn();
  });

const applicationCount = (): string =>
  one(`SELECT count(*) FROM applications WHERE tenant_id = '${TENANT}'`);

const outboxCount = (): string =>
  one(`SELECT count(*) FROM outbox WHERE payload->>'probe' = 'm028'`);

/**
 * The use case's sequence, as SQL: insert the row, then record the event, in ONE transaction.
 *
 * `tenant_id` and `correlation_id` are supplied because `outbox` requires both. In the real path
 * `OutboxWriter` fills them from the AMBIENT context rather than from the event — §11.5 `BR5`, the
 * same rule that shaped every repository here — so a caller cannot name a tenant for an event.
 */
function submit(version: number, extra = ''): string {
  return failure(
    `BEGIN;
     INSERT INTO applications (id, tenant_id, version, snapshot, submitted_at)
       VALUES (gen_random_uuid(), '${TENANT}', ${String(version)}, '{}'::jsonb, now());
     INSERT INTO outbox (id, tenant_id, aggregate_type, aggregate_id, event_type, payload, correlation_id)
       VALUES (gen_random_uuid(), '${TENANT}'::uuid, 'Application',
               (SELECT id FROM applications WHERE tenant_id='${TENANT}' AND version=${String(version)}),
               'application.submitted',
               jsonb_build_object('probe','m028','version',${String(version)}),
               gen_random_uuid());
     ${extra}
     COMMIT;`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AC-6 — the happy path, and then the one that matters
// ═══════════════════════════════════════════════════════════════════════════

it('AC-6 — a committed submission leaves BOTH the row and the event', () => {
  const error = submit(1);
  assert.equal(error, '', error);

  assert.equal(applicationCount(), '1');
  assert.equal(outboxCount(), '1');
});

it('AC-6 — a ROLLED-BACK submission leaves NEITHER', () => {
  // ┌─ THE ASSERTION THE WHOLE CRITERION IS ABOUT ───────────────────────────────────────────────┐
  // │ The failure is forced AFTER both inserts, so the transaction has genuinely written the row  │
  // │ and the event before it dies. If the outbox write were outside the transaction — a separate │
  // │ connection, a queue client, a `setImmediate` — the event would survive and a reviewer would │
  // │ be notified about an application that does not exist.                                       │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const before = { applications: applicationCount(), outbox: outboxCount() };

  const error = submit(2, `SELECT 1 / 0;`);
  assert.match(error, /division by zero/i, `the failure was not the one intended: ${error}`);

  assert.equal(applicationCount(), before.applications, 'a rolled-back row survived');
  assert.equal(outboxCount(), before.outbox, 'a rolled-back submission left an event to dispatch');
});

it('AC-6 — a submission refused by the UNIQUE constraint dispatches nothing', () => {
  // The realistic rollback, not a contrived one: two concurrent submissions both compute the same
  // next version. One wins; the other must not announce a version that does not exist.
  const before = outboxCount();

  const error = submit(1); // version 1 already exists
  assert.match(error, /uq_applications__tenant_version/, `unexpected: ${error}`);

  assert.equal(outboxCount(), before, 'the losing submission left an event behind');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-2 — the previous version is untouched
// ═══════════════════════════════════════════════════════════════════════════

it('AC-2 — submitting a new version leaves the previous row exactly as it was', () => {
  // `BR-GYM-05`: a rejected application is superseded, never edited. The reviewer who reads version
  // 1 next year must see what was actually claimed then.
  const firstBefore = one(
    `SELECT md5(row(id, version, snapshot, submitted_at)::text)
       FROM applications WHERE tenant_id = '${TENANT}' AND version = 1`,
  );

  assert.equal(submit(3), '');

  const firstAfter = one(
    `SELECT md5(row(id, version, snapshot, submitted_at)::text)
       FROM applications WHERE tenant_id = '${TENANT}' AND version = 1`,
  );

  assert.equal(firstAfter, firstBefore, 'submitting a new version altered the previous one');
  assert.equal(applicationCount(), '2', 'versions 1 and 3 should both exist');
});

it('the event carries the version, so a consumer knows WHICH submission it is about', () => {
  // Without it a consumer reading "application.submitted" for a tenant on its third attempt cannot
  // tell whether it is looking at a new claim or a replay of an old one.
  assert.equal(
    one(`SELECT payload->>'version' FROM outbox WHERE payload->>'probe'='m028' ORDER BY payload->>'version' DESC LIMIT 1`),
    '3',
  );
});
