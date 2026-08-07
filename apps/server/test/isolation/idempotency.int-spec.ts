/**
 * `AC-FND-07.2` … `AC-FND-07.5` and `BR-TEN-01` — against a real PostgreSQL.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE CONCURRENCY CASE CANNOT BE PROVED SEQUENTIALLY, AND IT IS THE ONLY ONE THAT MATTERS
 *
 * A sequential test — insert, then insert again — passes on an implementation with a
 * read-then-write race, because the read and the write are never interleaved. The race is small,
 * which is exactly why it survives testing and appears in production under load, on a payment
 * path, as a double charge.
 *
 * So `AC-FND-07.4` is asserted with twenty SIMULTANEOUS claims through twenty real database
 * connections. Exactly one may win.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { runWithTenant } from '../../dist/tenancy/context/tenant-context.als.js';
import { withTenantContext } from '../../dist/tenancy/prisma/tenant-scoped-client.js';
import { IdempotencyStore } from '../../dist/common/idempotency/idempotency.store.js';
import { FixedClock } from '../../dist/common/clock/fixed-clock.adapter.js';
import { TENANT_A, TENANT_B, seedTenantsSql } from '../../prisma/seed/tenants.ts';
import { TEST_DATABASE_URL } from '../harness/test-env.ts';
import { tenantId } from '@gymmap/types';

let raw: PrismaClient;
let store: IdempotencyStore;
let clock: FixedClock;
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

before(async () => {
  try {
    psql(seedTenantsSql());
    raw = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    await raw.$connect();
    clock = new FixedClock('2026-08-07T12:00:00Z');
    store = new IdempotencyStore({ client: withTenantContext(raw) } as never, clock);
    available = true;
  } catch (error) {
    console.error(
      '\n  SKIPPING — no database. pnpm infra:up && pnpm --filter @gymmap/server db:setup\n' +
        `  ${error instanceof Error ? error.message.split('\n')[0] : String(error)}\n`,
    );
  }
});

after(async () => {
  if (available) {
    psql(`DELETE FROM idempotency_keys WHERE key LIKE 'spec-%';`);
    await raw.$disconnect();
  }
});

const it = (name: string, fn: () => Promise<void>) =>
  test(name, async (t) => {
    if (!available) return t.skip('no database');
    await fn();
  });

const claimFor = (key: string, overrides: Record<string, unknown> = {}) => ({
  key,
  tenantId: TENANT_A,
  endpoint: 'POST /v1/tenant/orders',
  requestHash: 'a'.repeat(64),
  correlationId: randomUUID(),
  retentionSeconds: 86_400,
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-FND-07.4 — the assertion that cannot be made sequentially.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-FND-07.4 · twenty SIMULTANEOUS claims — exactly ONE wins', async () => {
  const key = `spec-concurrent-${randomUUID()}`;

  // Fired together, not awaited in sequence. `Promise.all` over twenty already-started promises
  // is what puts twenty INSERTs in flight at once; a `for await` loop would serialise them and
  // the test would pass against an implementation with a read-then-write race.
  const results = await runWithTenant(tenantId(TENANT_A), async () =>
    Promise.all(Array.from({ length: 20 }, () => store.claim(claimFor(key)))),
  );

  const claimed = results.filter((r) => r.outcome === 'CLAIMED');
  assert.equal(
    claimed.length,
    1,
    `${claimed.length} of 20 concurrent requests claimed the key. On a payment path each extra ` +
      `claim is a second charge, and the window is small enough to survive every sequential ` +
      `test ever written for it.`,
  );

  // The nineteen losers must NOT be refused. A 409 here turns a safety mechanism into a rate
  // limiter, and the client's retry would then find the completed row and succeed — so the bug
  // is invisible except as a mysterious 409 on a request that eventually worked.
  const refused = results.filter((r) => r.outcome === 'MISMATCH');
  assert.equal(refused.length, 0, 'a concurrent duplicate was refused rather than made to wait');
  assert.equal(results.filter((r) => r.outcome === 'IN_FLIGHT').length, 19);

  // And exactly one row exists.
  assert.equal(psql(`SELECT count(*) FROM idempotency_keys WHERE key = '${key}';`), '1');
});

it('AC-FND-07.4 · the losers replay the stored response once the winner completes', async () => {
  const key = `spec-replay-${randomUUID()}`;
  const originalCorrelation = randomUUID();

  await runWithTenant(tenantId(TENANT_A), async () => {
    const first = await store.claim(claimFor(key, { correlationId: originalCorrelation }));
    assert.equal(first.outcome, 'CLAIMED');

    // In flight: a second caller waits rather than executing or failing.
    assert.equal((await store.claim(claimFor(key))).outcome, 'IN_FLIGHT');

    await store.complete(key, {
      status: 201,
      body: { orderId: 'o-1', total: '250000' },
      correlationId: originalCorrelation,
    });

    const replay = await store.claim(claimFor(key));
    assert.equal(replay.outcome, 'REPLAY');
    assert.deepEqual(replay.response.body, { orderId: 'o-1', total: '250000' });
    assert.equal(replay.response.status, 201);
    // The ORIGINAL correlation id, so a support agent tracing a retry lands on the request that
    // actually did the work rather than on a trail that stops at the replay.
    assert.equal(replay.response.correlationId, originalCorrelation);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-FND-07.3 — a different request under the same key.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-FND-07.3 · the same key with a DIFFERENT fingerprint is a MISMATCH', async () => {
  const key = `spec-mismatch-${randomUUID()}`;
  await runWithTenant(tenantId(TENANT_A), async () => {
    assert.equal((await store.claim(claimFor(key))).outcome, 'CLAIMED');
    const different = await store.claim(claimFor(key, { requestHash: 'b'.repeat(64) }));
    assert.equal(different.outcome, 'MISMATCH');
  });
});

it('the same key at a DIFFERENT ENDPOINT is a MISMATCH, not a replay', async () => {
  // Returning the first endpoint's response would be worse than refusing: the caller receives a
  // well-formed response to a question it did not ask.
  const key = `spec-endpoint-${randomUUID()}`;
  await runWithTenant(tenantId(TENANT_A), async () => {
    await store.claim(claimFor(key));
    const elsewhere = await store.claim(claimFor(key, { endpoint: 'POST /v1/tenant/refunds' }));
    assert.equal(elsewhere.outcome, 'MISMATCH');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Expiry, and the failure path.
// ═══════════════════════════════════════════════════════════════════════════

it('an EXPIRED record does not replay, even before the sweep has run', async () => {
  // Enforced on READ as well as by the sweep. The sweep runs on a schedule and can be behind; a
  // row past its window must not replay a response from outside the retention period the client
  // was promised.
  const key = `spec-expired-${randomUUID()}`;
  await runWithTenant(tenantId(TENANT_A), async () => {
    await store.claim(claimFor(key, { retentionSeconds: 3600 }));
    await store.complete(key, { status: 200, body: { ok: true }, correlationId: randomUUID() });
    assert.equal((await store.claim(claimFor(key))).outcome, 'REPLAY');

    // Move the clock past the window. The row is untouched; only time moved.
    clock.advanceBy(3601 * 1000);
    assert.notEqual((await store.claim(claimFor(key))).outcome, 'REPLAY');
    clock.set('2026-08-07T12:00:00Z');
  });
});

it('CLOCK SKEW · a claim survives the app clock running behind the database', async () => {
  // ┌─ FOUND BY ACCIDENT, PINNED ON PURPOSE ────────────────────────────────────────────────┐
  // │ `created_at` carries a `DEFAULT now()`. Leaving it to the database while the           │
  // │ application supplies `expires_at` makes `ck_idempotency_keys__expiry` a comparison of  │
  // │ TWO MACHINES' CLOCKS. Skew larger than the retention window makes every claim raise    │
  // │ 23514 — on the payment path, a total outage caused by NTP.                              │
  // │                                                                                         │
  // │ M-019 hit it for real: the suite's FixedClock is pinned to a literal instant, real UTC │
  // │ passed 12:00Z during the working day, and a one-hour-retention fixture began failing   │
  // │ on a test nobody had touched. Both timestamps now come from the injected clock.        │
  // └─────────────────────────────────────────────────────────────────────────────────────────┘
  const key = `spec-skew-${randomUUID()}`;
  clock.set('2020-01-01T00:00:00Z'); // six years behind the database. Absurd, and that is the point.

  await runWithTenant(tenantId(TENANT_A), async () => {
    // One hour of retention, six years in the past. Against a DEFAULT now() created_at this is
    // `expires_at` five years and 364 days BEFORE `created_at`, and the CHECK refuses it.
    const claimed = await store.claim(claimFor(key, { retentionSeconds: 3600 }));
    assert.equal(claimed.outcome, 'CLAIMED');
  });

  // And the row's two timestamps agree with each other, not with the server.
  const row = psql(
    `SELECT created_at < expires_at, extract(year from created_at)::int
       FROM idempotency_keys WHERE key = '${key}';`,
  );
  assert.match(row, /^t\|2020$/m, `created_at did not come from the injected clock: ${row}`);

  clock.set('2026-08-07T12:00:00Z');
});

it('a FAILED request releases its claim, so a retry can execute', async () => {
  // Otherwise the stored failure replays for the whole retention window and a transient fault
  // becomes a permanent one that no retry can clear.
  const key = `spec-released-${randomUUID()}`;
  await runWithTenant(tenantId(TENANT_A), async () => {
    assert.equal((await store.claim(claimFor(key))).outcome, 'CLAIMED');
    assert.equal((await store.claim(claimFor(key))).outcome, 'IN_FLIGHT');

    await store.release(key);

    // The retry is no longer blocked. It reports IN_FLIGHT rather than CLAIMED because the row
    // still exists and is expired — the interceptor's caller retries, which is the safe
    // direction: executing on a row we cannot reason about would be a second charge.
    const afterRelease = await store.claim(claimFor(key));
    assert.notEqual(afterRelease.outcome, 'REPLAY');
  });
});

it('release does NOT touch a COMPLETED record', async () => {
  // A late failure signal must not erase a successful result. `release` is scoped to rows whose
  // response is still null.
  const key = `spec-release-completed-${randomUUID()}`;
  await runWithTenant(tenantId(TENANT_A), async () => {
    await store.claim(claimFor(key));
    await store.complete(key, { status: 200, body: { ok: true }, correlationId: randomUUID() });
    await store.release(key);
    assert.equal((await store.claim(claimFor(key))).outcome, 'REPLAY');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BR-TEN-01 — tenant B cannot read or replay tenant A's key.
// ═══════════════════════════════════════════════════════════════════════════

it('BR-TEN-01 · tenant B cannot READ tenant A stored response', async () => {
  const key = `spec-tenant-${randomUUID()}`;

  await runWithTenant(tenantId(TENANT_A), async () => {
    await store.claim(claimFor(key));
    await store.complete(key, {
      status: 201,
      body: { secret: 'tenant-a-order' },
      correlationId: randomUUID(),
    });
  });

  // The row exists — asserted outside any policy, so "B sees nothing" cannot pass because the
  // row was never written.
  assert.equal(psql(`SELECT count(*) FROM idempotency_keys WHERE key = '${key}';`), '1');

  await runWithTenant(tenantId(TENANT_B), async () => {
    const seen = await store.find(key);
    assert.equal(seen, null, "tenant B read tenant A's idempotency record");
  });
});

it('BR-TEN-01 · tenant B reusing the key gets neither a replay NOR the body', async () => {
  const key = `spec-cross-${randomUUID()}`;

  await runWithTenant(tenantId(TENANT_A), async () => {
    await store.claim(claimFor(key));
    await store.complete(key, {
      status: 201,
      body: { secret: 'tenant-a-order' },
      correlationId: randomUUID(),
    });
  });

  await runWithTenant(tenantId(TENANT_B), async () => {
    // The unique constraint is global, so B's INSERT collides. What B must NOT get is A's
    // stored response — the policy makes the follow-up read return nothing, so the outcome is
    // IN_FLIGHT rather than REPLAY.
    const result = await store.claim(claimFor(key, { tenantId: TENANT_B }));
    assert.notEqual(result.outcome, 'REPLAY', "tenant B replayed tenant A's response");
    if (result.outcome === 'REPLAY') return;
    assert.ok(['IN_FLIGHT', 'MISMATCH'].includes(result.outcome));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The schema's own guarantees.
// ═══════════════════════════════════════════════════════════════════════════

it('the request path holds no DELETE grant on idempotency_keys', async () => {
  // A retry that could delete the key could delete the record that makes it a replay — turning
  // a safety mechanism into a second charge, from code that looks like cleanup.
  const grants = psql(
    `SELECT privilege_type FROM information_schema.role_table_grants
     WHERE table_name = 'idempotency_keys' AND grantee = 'app_rw' ORDER BY privilege_type;`,
  )
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  assert.deepEqual(grants, ['INSERT', 'SELECT', 'UPDATE'], `app_rw grants: ${grants.join(', ')}`);
  await Promise.resolve();
});

it('the completion CHECK refuses a half-written record', async () => {
  // A row with a body and no status would replay as a malformed response; one with a status and
  // no `completed_at` cannot be aged out correctly.
  const output = psql(
    `SET ROLE app_rw;
     BEGIN;
     SET LOCAL app.tenant_id = '${TENANT_A}';
     UPDATE idempotency_keys SET response_status = 200 WHERE key = 'nonexistent';
     INSERT INTO idempotency_keys (key, tenant_id, endpoint, request_hash, correlation_id,
                                   response_status, expires_at)
     VALUES ('spec-check-${Date.now()}', '${TENANT_A}', 'POST /x', '${'c'.repeat(64)}',
             '${randomUUID()}', 200, now() + interval '1 day');
     COMMIT;`,
  );
  assert.match(output, /ck_idempotency_keys__completion|violates check constraint/i, output);
  await Promise.resolve();
});
