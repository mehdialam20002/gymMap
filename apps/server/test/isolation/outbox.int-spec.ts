/**
 * The outbox against a real PostgreSQL — `AC-FND-08.1` … `AC-FND-08.5`, `TR-08`, `BR-TEN-01`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE ROLLBACK CASE IS THE ONE THAT CANNOT BE FAKED
 *
 * `AC-FND-08.2` says an event is never dispatched for a transaction that rolled back. That is
 * only meaningful against a real transaction — an in-memory double would "roll back" by not
 * having written anything, which proves nothing about what Postgres does.
 *
 * So the writer's guarantee is asserted by opening a real interactive transaction, writing an
 * aggregate AND an event inside it, throwing, and then checking the table from outside.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { PrismaClient, type Prisma } from '@prisma/client';

import { runWithTenant } from '../../dist/tenancy/context/tenant-context.als.js';
import {
  runInTenantTransaction,
  withTenantContext,
} from '../../dist/tenancy/prisma/tenant-scoped-client.js';
import type { DomainEvent } from '../../dist/common/outbox/outbox.port.js';
import { OutboxWriter } from '../../dist/common/outbox/outbox.writer.js';
import { OutboxDispatcher, backoffMs } from '../../dist/common/outbox/outbox.dispatcher.js';
import { FixedClock } from '../../dist/common/clock/fixed-clock.adapter.js';
import { SystemIdGenerator } from '../../dist/common/clock/system-clock.adapter.js';
import { TENANT_A, TENANT_B, seedTenantsSql } from '../../prisma/seed/tenants.ts';
import { TEST_DATABASE_URL } from '../harness/test-env.ts';

/** The migration role, locally. The sweep needs DELETE, which `app_rw` deliberately lacks. */
const SUPERUSER_URL =
  process.env['DATABASE_URL_SUPERUSER'] ??
  'postgresql://postgres:postgres@localhost:5432/gymmap?schema=public';
import { tenantId } from '@gymmap/types';

let raw: PrismaClient;
let client: ReturnType<typeof withTenantContext>;
let writer: OutboxWriter;
let clock: FixedClock;
let anchor: Date;
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

/**
 * The dispatcher's gateway, in raw SQL.
 *
 * `FOR UPDATE SKIP LOCKED` is not expressible through Prisma's query builder, and that is the
 * one line the whole concurrency guarantee rests on — so it is written out, in a transaction, as
 * `$queryRaw`. Parameterised throughout: an interpolated limit is an injection point in the most
 * frequently executed query in the system.
 */
/**
 * The dispatcher's gateway, in raw SQL, TENANT-SCOPED.
 *
 * `FOR UPDATE SKIP LOCKED` is not expressible through Prisma's query builder, and it is the one
 * line the whole concurrency guarantee rests on — so it is written out, in a transaction, as
 * `$queryRaw`. Parameterised throughout: an interpolated limit is an injection point in the most
 * frequently executed query in the system.
 *
 * Every statement sets `app.tenant_id` on ITS OWN transaction first. The first draft did not,
 * and the RLS policy refused it with SQLSTATE 42704 — the design working exactly as intended,
 * and the finding that produced `dispatchCycle`'s per-tenant shape. `SELECT … FOR UPDATE` needs
 * UPDATE privilege, so the SELECT-only elevated role cannot claim rows at all, and a role
 * holding both cross-tenant read AND write on the outbox would be the only one in this system.
 */
function gatewayFor(prisma: PrismaClient, tenant: string) {
  const scoped = <T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant}::text, true)`;
      return work(tx);
    });

  return {
    // Claim AND lease, in ONE statement. See the port's comment: a bare
    // `SELECT … FOR UPDATE SKIP LOCKED` releases its lock at commit and leaves the row PENDING,
    // so the next poller claims it again — this test caught exactly that, 100 rows of 500.
    claimBatch: (limit: number, now: Date, leaseMs: number) =>
      scoped(async (tx) => {
        // Hoisted. An inline `${new Date(...)}` inside the tagged template makes Prisma report
        // "Could not convert from JSON date object to PrismaValue" — it does not evaluate an
        // expression in a parameter slot the way a plain variable is bound.
        // ISO STRINGS with an explicit ::timestamptz cast, not Date objects. Prisma's tagged
        // template refuses a Date in a parameter slot of an UPDATE … RETURNING with "Could not
        // convert from JSON date object to PrismaValue" — it binds Dates for its own generated
        // queries but not reliably for a raw write. A string plus a cast is unambiguous to both.
        const leaseUntil = new Date(now.getTime() + leaseMs).toISOString();
        const cutoff = now.toISOString();
        const rows = await tx.$queryRaw<
          {
            id: string;
            tenant_id: string;
            aggregate_type: string;
            aggregate_id: string;
            event_type: string;
            payload: unknown;
            attempts: number;
            correlation_id: string;
          }[]
        >`
          UPDATE outbox SET available_at = ${leaseUntil}::timestamptz
          WHERE id IN (
            SELECT id FROM outbox
            WHERE status = 'PENDING' AND available_at <= ${cutoff}::timestamptz
            ORDER BY available_at, id
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
          )
          RETURNING id, tenant_id, aggregate_type, aggregate_id, event_type, payload,
                    attempts, correlation_id`;

        return rows.map((r) => ({
          id: r.id,
          tenantId: r.tenant_id,
          aggregateType: r.aggregate_type,
          aggregateId: r.aggregate_id,
          eventType: r.event_type,
          payload: r.payload,
          attempts: r.attempts,
          correlationId: r.correlation_id,
        }));
      }),

    markPublished: (id: string, now: Date) =>
      scoped(async (tx) => {
        await tx.$executeRaw`
          UPDATE outbox SET status = 'PUBLISHED', published_at = ${now.toISOString()}::timestamptz
          WHERE id = ${id}::uuid`;
      }),

    markFailed: (id: string, attempts: number, error: string, availableAt: Date) =>
      scoped(async (tx) => {
        await tx.$executeRaw`
          UPDATE outbox SET attempts = ${attempts}, last_error = ${error},
                            available_at = ${availableAt.toISOString()}::timestamptz
          WHERE id = ${id}::uuid`;
      }),

    markDead: (id: string, error: string) =>
      scoped(async (tx) => {
        await tx.$executeRaw`
          UPDATE outbox SET status = 'DEAD', attempts = attempts + 1, last_error = ${error}
          WHERE id = ${id}::uuid`;
      }),

    // The sweep runs as `app_migrator`, not on the request path — the request role holds no
    // DELETE grant on the outbox. Here it goes through the superuser connection, which is what
    // the migration role is in the local stack.
    deletePublishedBefore: async (cutoff: Date, limit: number) => {
      const deleted = await prisma.$executeRaw`
        DELETE FROM outbox WHERE id IN (
          SELECT id FROM outbox WHERE status = 'PUBLISHED'
            AND published_at < ${cutoff.toISOString()}::timestamptz
          LIMIT ${limit}
        )`;
      return Number(deleted);
    },
  };
}

before(async () => {
  try {
    psql(seedTenantsSql());
    // The dispatcher and the sweep run as `postgres` here, because the request role has no
    // DELETE grant and the real dispatcher reads across tenants through `runElevated()`.
    raw = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    await raw.$connect();
    client = withTenantContext(raw);
    // Anchored to REAL now, not to a fixed literal.
    //
    // The fixtures below are inserted with SQL `now()`, and a literal clock at 12:00 UTC works
    // in isolation and fails the moment the suite runs long enough for real time to pass it —
    // every row then has an `available_at` in the dispatcher's future and "0 of 500 rows
    // dispatched" is the result. Anchoring keeps the two clocks in the same era; the tests that
    // need time to MOVE still advance it deliberately.
    anchor = new Date();
    clock = new FixedClock(anchor);
    writer = new OutboxWriter(clock, new SystemIdGenerator());
    available = true;
  } catch (error) {
    console.error(
      `\n  SKIPPING — no database.\n  ${error instanceof Error ? error.message.split('\n')[0] : String(error)}\n`,
    );
  }
});

after(async () => {
  if (available) {
    psql(`DELETE FROM outbox WHERE event_type LIKE 'spec.%';`);
    await raw.$disconnect();
  }
});

const it = (name: string, fn: () => Promise<void>) =>
  test(name, async (t) => {
    if (!available) return t.skip('no database');
    await fn();
  });

// Annotated rather than inferred: `DomainEvent.aggregateType` is the 26-root union since ADR-0045,
// and an inferred object literal widens it straight back to `string` — which is exactly how
// `KycDocument` reached production code unnoticed. The probe uses `Tenant`, §6.1 row 1.
const anEvent = (eventType: string): DomainEvent => ({
  aggregateType: 'Tenant',
  aggregateId: TENANT_A,
  eventType,
  payload: { probe: true },
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-FND-08.1 / AC-FND-08.2 — the transaction is the guarantee.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-FND-08.1 · a COMMITTED transaction leaves the event durably recorded', async () => {
  const eventType = `spec.committed-${Date.now()}`;

  // `runInTenantTransaction`, NOT `client.$transaction`.
  //
  // The first draft used the latter and AC-FND-08.2 below FAILED — the event survived a
  // rolled-back transaction. `client` is the tenant-context-extended client, and its extension
  // wraps every operation in its OWN interactive transaction, so `writer.record(tx, …)` wrote
  // through a second connection that committed independently. That is precisely the trap the
  // M-018 notes name, reproduced by accident, and it is the reason `runInTenantTransaction`
  // exists: it opens ONE transaction, sets `app.tenant_id` on it, and hands the raw `tx` down.
  await runWithTenant(tenantId(TENANT_A), async () =>
    runInTenantTransaction(raw, async (tx) => {
      await tx.tenant.updateMany({ where: { id: TENANT_A }, data: { tradingName: 'Iron Temple' } });
      await writer.record(tx as never, anEvent(eventType));
    }),
  );

  assert.equal(psql(`SELECT count(*) FROM outbox WHERE event_type = '${eventType}';`), '1');
});

it('AC-FND-08.2 · a ROLLED-BACK transaction leaves NO event', async () => {
  // The assertion the whole milestone exists for, and the one an in-memory double cannot make:
  // a fake would "roll back" by never having written, which proves nothing about Postgres.
  const eventType = `spec.rolled-back-${Date.now()}`;

  await assert.rejects(() =>
    runWithTenant(tenantId(TENANT_A), async () =>
      runInTenantTransaction(raw, async (tx) => {
        await writer.record(tx as never, anEvent(eventType));
        // The state change fails AFTER the event was written — the exact interleaving that a
        // "save then publish" design gets wrong.
        throw new Error('the state change failed');
      }),
    ),
  );

  assert.equal(
    psql(`SELECT count(*) FROM outbox WHERE event_type = '${eventType}';`),
    '0',
    'an event survived a rolled-back transaction. §C1.5: a notification must never be sent for ' +
      'a transaction that rolled back.',
  );
});

it('the event carries the request correlation id, not a fresh one', async () => {
  // NFR-MNT-04 / AC-FND-09.5. By the time a worker picks the row up the originating request is
  // long gone, so the id has to be captured at write time or the trace stops at the HTTP edge.
  const eventType = `spec.correlated-${Date.now()}`;
  const { runWithCorrelation } = await import('../../dist/common/logging/correlation.als.js');
  const correlationId = randomUUID();

  await runWithCorrelation({ correlationId, origin: 'http' }, async () =>
    runWithTenant(tenantId(TENANT_A), async () =>
      runInTenantTransaction(raw, async (tx) => writer.record(tx as never, anEvent(eventType))),
    ),
  );

  assert.equal(
    psql(`SELECT correlation_id FROM outbox WHERE event_type = '${eventType}';`),
    correlationId,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// TR-08 / AC-FND-08.3 — four concurrent dispatchers, 500 rows, each claimed once.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-FND-08.3 · FOUR concurrent dispatchers over 500 rows claim each row EXACTLY once', async () => {
  const eventType = `spec.concurrent-${Date.now()}`;

  // 500 rows, inserted outside the policy so the fixture setup is not itself under test.
  psql(`
    INSERT INTO outbox (tenant_id, aggregate_type, aggregate_id, event_type, payload,
                        available_at, correlation_id)
    SELECT '${TENANT_A}', 'Tenant', '${TENANT_A}', '${eventType}', '{}'::jsonb,
           now() - interval '1 minute', gen_random_uuid()
    FROM generate_series(1, 500);`);

  const seen: string[] = [];
  const dispatcher = new OutboxDispatcher(clock);
  dispatcher.on(eventType, (event) => {
    seen.push(event.id);
    return Promise.resolve();
  });

  // FOUR separate clients, so these are four real connections contending — not four calls on
  // one connection, which would serialise and prove nothing about SKIP LOCKED.
  const workers = Array.from(
    { length: 4 },
    () => new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } }),
  );

  try {
    await Promise.all(workers.map((w) => w.$connect()));
    // Each worker polls until the table drains. Run together, not in sequence.
    await Promise.all(
      workers.map(async (worker) => {
        const gateway = gatewayFor(worker, TENANT_A);
        for (let poll = 0; poll < 40; poll += 1) {
          const result = await dispatcher.dispatchOnce(gateway, {
            batchSize: 50,
            maxAttempts: 6,
            retentionDays: 30,
            leaseMs: 30_000,
          });
          if (result.claimed === 0) break;
        }
      }),
    );
  } finally {
    await Promise.all(workers.map((w) => w.$disconnect()));
  }

  assert.equal(
    new Set(seen).size,
    seen.length,
    `${seen.length - new Set(seen).size} row(s) were dispatched TWICE. SKIP LOCKED is not ` +
      'holding, and every consumer would need its own dedup to be safe.',
  );
  assert.equal(seen.length, 500, `${seen.length} of 500 rows dispatched`);
  assert.equal(
    psql(`SELECT count(*) FROM outbox WHERE event_type = '${eventType}' AND status = 'PENDING';`),
    '0',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-FND-08.4 — a poisoned event dead-letters and does not stall the queue.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-FND-08.4 · a poisoned event dead-letters and the queue KEEPS DRAINING past it', async () => {
  const poison = `spec.poison-${Date.now()}`;
  const healthy = `spec.healthy-${Date.now()}`;

  // The poisoned row is FIRST, so a dispatcher that stalls on it never reaches the healthy ones
  // — which is the failure AC-FND-08.4 names.
  psql(`
    INSERT INTO outbox (tenant_id, aggregate_type, aggregate_id, event_type, payload,
                        available_at, correlation_id)
    VALUES ('${TENANT_A}', 'Tenant', '${TENANT_A}', '${poison}', '{}'::jsonb,
            now() - interval '10 minutes', gen_random_uuid());
    INSERT INTO outbox (tenant_id, aggregate_type, aggregate_id, event_type, payload,
                        available_at, correlation_id)
    SELECT '${TENANT_A}', 'Tenant', '${TENANT_A}', '${healthy}', '{}'::jsonb,
           now() - interval '5 minutes', gen_random_uuid()
    FROM generate_series(1, 5);`);

  const dispatcher = new OutboxDispatcher(clock);
  let healthyDispatched = 0;
  dispatcher.on(poison, () => Promise.reject(new Error('this handler always fails')));
  dispatcher.on(healthy, () => {
    healthyDispatched += 1;
    return Promise.resolve();
  });

  const gateway = gatewayFor(raw, TENANT_A);
  const options = { batchSize: 50, maxAttempts: 3, retentionDays: 30, leaseMs: 30_000 };

  // First poll: the poison fails and is rescheduled; the five healthy rows publish anyway.
  const first = await dispatcher.dispatchOnce(gateway, options);
  assert.equal(first.published, 5, 'the healthy rows did not publish past the poisoned one');
  assert.equal(first.failed, 1);
  assert.equal(healthyDispatched, 5);

  // Retry to the ceiling. The clock advances past each backoff so the row is eligible again.
  for (let attempt = 2; attempt <= 3; attempt += 1) {
    clock.advanceBy(backoffMs(attempt) + 1000);
    await dispatcher.dispatchOnce(gateway, options);
  }

  assert.equal(
    psql(`SELECT status FROM outbox WHERE event_type = '${poison}';`),
    'DEAD',
    'the poisoned event never reached the dead-letter state, so it retries forever',
  );
  assert.match(
    psql(`SELECT last_error FROM outbox WHERE event_type = '${poison}';`),
    /always fails/,
    'the dead-letter row does not record WHY, so an operator cannot triage it',
  );
  clock.set(anchor);
});

it('backoff grows and then stops growing', async () => {
  // Unbounded doubling puts attempt twelve four hours out, so an event that would have succeeded
  // sits long enough to look like a stall — and somebody replays it by hand.
  assert.equal(backoffMs(1), 2000);
  assert.equal(backoffMs(2), 4000);
  assert.equal(backoffMs(6), 64_000);
  assert.equal(backoffMs(20), 300_000, 'the backoff ceiling is not holding');
  await Promise.resolve();
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-FND-08.5 / TR-20 — the retention sweep.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-FND-08.5 · the sweep removes published rows past the window, and only those', async () => {
  const old = `spec.old-${Date.now()}`;
  const recent = `spec.recent-${Date.now()}`;
  const pending = `spec.pending-${Date.now()}`;

  psql(`
    INSERT INTO outbox (tenant_id, aggregate_type, aggregate_id, event_type, payload, status,
                        published_at, correlation_id)
    VALUES ('${TENANT_A}', 'Tenant', '${TENANT_A}', '${old}', '{}'::jsonb, 'PUBLISHED',
            now() - interval '40 days', gen_random_uuid()),
           ('${TENANT_A}', 'Tenant', '${TENANT_A}', '${recent}', '{}'::jsonb, 'PUBLISHED',
            now() - interval '3 days', gen_random_uuid());
    INSERT INTO outbox (tenant_id, aggregate_type, aggregate_id, event_type, payload,
                        correlation_id)
    VALUES ('${TENANT_A}', 'Tenant', '${TENANT_A}', '${pending}', '{}'::jsonb, gen_random_uuid());`);

  const dispatcher = new OutboxDispatcher(new FixedClock(new Date()));
  // The sweep runs as `app_migrator`, NOT on the request path — `app_rw` holds no DELETE grant
  // on the outbox, deliberately, so a dispatcher bug cannot erase an undelivered event. Locally
  // the migration role is the superuser connection.
  const sweeper = new PrismaClient({ datasources: { db: { url: SUPERUSER_URL } } });
  await sweeper.$connect();
  let result: { deleted: number };
  try {
    result = await dispatcher.sweep(gatewayFor(sweeper, TENANT_A), {
      batchSize: 100,
      maxAttempts: 6,
      retentionDays: 30,
      leaseMs: 30_000,
    });
  } finally {
    await sweeper.$disconnect();
  }

  assert.ok(result.deleted >= 1);
  assert.equal(psql(`SELECT count(*) FROM outbox WHERE event_type = '${old}';`), '0');
  // A recently-published row is still needed for replay and debugging.
  assert.equal(psql(`SELECT count(*) FROM outbox WHERE event_type = '${recent}';`), '1');
  // And a PENDING row must never be swept, however old — that would silently drop the event.
  assert.equal(psql(`SELECT count(*) FROM outbox WHERE event_type = '${pending}';`), '1');
});

// ═══════════════════════════════════════════════════════════════════════════
// BR-TEN-01 — the outbox is tenant-owned.
// ═══════════════════════════════════════════════════════════════════════════

it('BR-TEN-01 · tenant B cannot read tenant A outbox rows', async () => {
  const eventType = `spec.isolated-${Date.now()}`;

  await runWithTenant(tenantId(TENANT_A), async () =>
    runInTenantTransaction(raw, async (tx) => writer.record(tx as never, anEvent(eventType))),
  );

  // The row exists — asserted outside any policy, so "B sees nothing" cannot pass because the
  // row was never written.
  assert.equal(psql(`SELECT count(*) FROM outbox WHERE event_type = '${eventType}';`), '1');

  const visibleToB = await runWithTenant(tenantId(TENANT_B), async () =>
    client.outboxEvent.findMany({ where: { eventType } }),
  );
  assert.equal(visibleToB.length, 0, "tenant B read tenant A's outbox rows");
});

it('the writer refuses with NO tenant context rather than writing an unowned row', async () => {
  const { runWithoutTenant } = await import('../../dist/tenancy/context/tenant-context.als.js');
  await runWithoutTenant(async () => {
    await assert.rejects(
      () =>
        writer.record({ outboxEvent: { create: () => Promise.resolve({}) } }, anEvent('spec.x')),
      /no tenant context/,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The schema's own guarantees.
// ═══════════════════════════════════════════════════════════════════════════

it('`payload` is NOT in the UPDATE grant — an event cannot say something different later', async () => {
  const columns = psql(
    `SELECT column_name FROM information_schema.column_privileges
     WHERE table_name = 'outbox' AND grantee = 'app_rw' AND privilege_type = 'UPDATE'
     ORDER BY column_name;`,
  )
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  assert.deepEqual(columns, ['attempts', 'available_at', 'last_error', 'published_at', 'status']);
  assert.ok(!columns.includes('payload'), 'app_rw can rewrite what an event SAID');
  assert.ok(!columns.includes('tenant_id'), 'app_rw can move an event to another tenant');
  await Promise.resolve();
});

it('a PUBLISHED row without a timestamp is refused by the CHECK', async () => {
  const output = psql(
    `INSERT INTO outbox (tenant_id, aggregate_type, aggregate_id, event_type, payload, status,
                         correlation_id)
     VALUES ('${TENANT_A}', 'Tenant', '${TENANT_A}', 'spec.badstate', '{}'::jsonb, 'PUBLISHED',
             gen_random_uuid());`,
  );
  assert.match(output, /ck_outbox__published|violates check constraint/i, output);
  await Promise.resolve();
});

it('BLK-07 · aggregate_type is the ENUM now, and it refuses a VALUE the CHECK accepted', async () => {
  /*
   * ┌─ THIS TEST USED TO ASSERT THE STAND-IN, AND THE STAND-IN WAS THE WEAKER GUARANTEE ───────────┐
   * │ It read *"the aggregate_type CHECK stands in for the deferred enum"* and probed              │
   * │ `lowercase_thing` — a SHAPE violation. `ADR-0045` closed `BLK-07` (the register is           │
   * │ `docs/engineering/ERD.md` §6.1 and always was), so the column is                              │
   * │ `outbox_aggregate_type_enum` and the CHECK is gone.                                           │
   * │                                                                                              │
   * │ The probe changed with it, and deliberately to a HARDER case. `Outbox` is well-formed        │
   * │ PascalCase, so the old CHECK would have waved it through — and §6.1 names `outbox` among the │
   * │ six entities that belong to no aggregate at all. That gap is not hypothetical: it is how     │
   * │ `KycDocument` reached committed code. A shape constraint cannot police a value set.          │
   * └──────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const insert = (aggregateType: string): string =>
    psql(
      `INSERT INTO outbox (tenant_id, aggregate_type, aggregate_id, event_type, payload,
                           correlation_id)
       VALUES ('${TENANT_A}', '${aggregateType}', '${TENANT_A}', 'spec.badaggregate', '{}'::jsonb,
               gen_random_uuid());`,
    );

  const shape = insert('lowercase_thing');
  assert.match(shape, /invalid input value for enum/i, shape);

  const wellFormedNonRoot = insert('Outbox');
  assert.match(wellFormedNonRoot, /invalid input value for enum/i, wellFormedNonRoot);

  // And the constraint it replaced is actually gone, rather than both being present — otherwise
  // this suite would keep passing on the old mechanism and never notice the enum was reverted.
  const dropped = psql(
    `SELECT count(*) FROM pg_constraint WHERE conname = 'ck_outbox__aggregate_type';`,
  );
  assert.match(dropped, /\b0\b/, dropped);

  await Promise.resolve();
});
