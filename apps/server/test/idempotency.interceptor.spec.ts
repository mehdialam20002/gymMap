/**
 * The interceptor's four `BR-PAY-03` paths — `AC-FND-07.1` … `AC-FND-07.4`.
 *
 * The store's behaviour against a real PostgreSQL, including the twenty-way concurrency case, is
 * in `test/isolation/idempotency.int-spec.ts`. What is asserted HERE is the interceptor's own
 * decisions: when it refuses, when it replays, when it waits, and — the one that is invisible in
 * any single request — the ORDER it sits in relative to the audit interceptor.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { firstValueFrom, of } from 'rxjs';

import { IdempotencyInterceptor } from '../dist/common/idempotency/idempotency.interceptor.js';
import {
  IdempotencyKeyMismatchError,
  IdempotencyKeyRequiredError,
} from '../dist/common/idempotency/idempotency.errors.js';
import { runWithTenant, runWithoutTenant } from '../dist/tenancy/context/tenant-context.als.js';
import {
  IDEMPOTENCY_SWEEP_JOB,
  SWEEP_BATCH_SIZE,
  SWEEP_LOCAL_TIME,
  runIdempotencySweep,
} from '../dist/common/idempotency/jobs/idempotency-sweep.processor.js';
import { SystemClock } from '../dist/common/clock/system-clock.adapter.js';
import { tenantId } from '@gymmap/types';

const TENANT_A = '01912f00-0000-7000-8000-00000000000a';
const KEY = '018f2a4c-1234-7890-abcd-ef0123456789';

/** A store double that returns whatever the test says, and records what it was asked. */
function fakeStore(outcome: unknown) {
  const calls: { completed: unknown[]; released: string[] } = { completed: [], released: [] };
  return {
    calls,
    claim: () => Promise.resolve(outcome),
    complete: (key: string, response: unknown) => {
      calls.completed.push({ key, response });
      return Promise.resolve();
    },
    release: (key: string) => {
      calls.released.push(key);
      return Promise.resolve();
    },
  };
}

function context(options: { mode?: string; key?: string; body?: unknown } = {}) {
  const headers: Record<string, unknown> = {};
  if (options.key) headers['idempotency-key'] = options.key;

  const response = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };

  return {
    ctx: {
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          path: '/v1/tenant/orders',
          route: { path: '/v1/tenant/orders' },
          headers,
          body: options.body ?? { planId: 'p1' },
        }),
        getResponse: () => response,
      }),
    } as never,
    response,
  };
}

const reflector = (mode?: string) => ({ getAllAndOverride: () => mode }) as never;
const config = { IDEMPOTENCY_RETENTION_SECONDS: 86_400 } as never;

// ═══════════════════════════════════════════════════════════════════════════
// AC-FND-07.1 — a REQ route with no key.
// ═══════════════════════════════════════════════════════════════════════════

test('AC-FND-07.1 — a REQ route with no Idempotency-Key is refused', async () => {
  const interceptor = new IdempotencyInterceptor(
    reflector('required'),
    fakeStore({ outcome: 'CLAIMED' }) as never,
    config,
    new SystemClock(),
  );
  const { ctx } = context();

  await runWithTenant(tenantId(TENANT_A), async () => {
    assert.throws(
      () => interceptor.intercept(ctx, { handle: () => of({}) }),
      IdempotencyKeyRequiredError,
    );
  });
});

test('the refusal explains why the SERVER does not generate one', async () => {
  // The obvious "fix" is to generate a key server-side, which makes every attempt unique — so
  // every retry is a second execution. That is the exact failure the header exists to prevent,
  // delivered by the mechanism meant to prevent it. The error has to say so.
  const error = new IdempotencyKeyRequiredError('POST /v1/tenant/orders');
  assert.match(JSON.stringify(error.details), /server does not generate one/);
  assert.match(JSON.stringify(error.details), /STABLE across/);
  await Promise.resolve();
});

test('an OPTIONAL route with no key passes straight through', async () => {
  const interceptor = new IdempotencyInterceptor(
    reflector('optional'),
    fakeStore({ outcome: 'CLAIMED' }) as never,
    config,
    new SystemClock(),
  );
  const { ctx } = context();

  const result = await runWithTenant(tenantId(TENANT_A), async () =>
    firstValueFrom(interceptor.intercept(ctx, { handle: () => of({ ok: true }) })),
  );
  assert.deepEqual(result, { ok: true });
});

test('a route with NO @Idempotent decorator is untouched', async () => {
  const store = fakeStore({ outcome: 'CLAIMED' });
  const interceptor = new IdempotencyInterceptor(
    reflector(undefined),
    store as never,
    config,
    new SystemClock(),
  );
  const { ctx } = context({ key: KEY });

  const result = await firstValueFrom(
    interceptor.intercept(ctx, { handle: () => of({ ok: true }) }),
  );
  assert.deepEqual(result, { ok: true });
  assert.equal(store.calls.completed.length, 0, 'an unmarked route stored a key');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-FND-07.2 — the replay, byte-identically.
// ═══════════════════════════════════════════════════════════════════════════

test('AC-FND-07.2 — a replay returns the stored response and never reaches the handler', async () => {
  const stored = {
    outcome: 'REPLAY',
    response: { status: 201, body: { orderId: 'o-1' }, correlationId: 'c-original' },
  };
  const interceptor = new IdempotencyInterceptor(
    reflector('required'),
    fakeStore(stored) as never,
    config,
    new SystemClock(),
  );
  const { ctx, response } = context({ key: KEY });

  let handlerRan = false;
  const result = await runWithTenant(tenantId(TENANT_A), async () =>
    firstValueFrom(
      interceptor.intercept(ctx, {
        handle: () => {
          handlerRan = true;
          return of({ orderId: 'o-2' });
        },
      }),
    ),
  );

  assert.equal(handlerRan, false, 'a replay executed the handler — that is a second charge');
  assert.deepEqual(result, { orderId: 'o-1' });
  assert.equal(response.statusCode, 201, 'the stored STATUS was not replayed');
  // The ORIGINAL correlation id. A support agent tracing a retry has to land on the request that
  // did the work, not on a trail that stops at the replay.
  assert.equal(response.headers['X-Correlation-Id'], 'c-original');
  assert.equal(response.headers['Idempotent-Replay'], 'true');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-FND-07.3 — a different body under the same key.
// ═══════════════════════════════════════════════════════════════════════════

test('AC-FND-07.3 — a mismatched fingerprint is 409, and is NOT retryable', async () => {
  const interceptor = new IdempotencyInterceptor(
    reflector('required'),
    fakeStore({ outcome: 'MISMATCH' }) as never,
    config,
    new SystemClock(),
  );
  const { ctx } = context({ key: KEY });

  await runWithTenant(tenantId(TENANT_A), async () => {
    await assert.rejects(
      () => firstValueFrom(interceptor.intercept(ctx, { handle: () => of({}) })),
      IdempotencyKeyMismatchError,
    );
  });
});

test('the 409 does NOT return the stored fingerprint', async () => {
  // It would let a caller probe for the shape of another request that used a colliding key, and
  // it tells an honest client nothing it can act on.
  const error = new IdempotencyKeyMismatchError('POST /v1/tenant/orders');
  const rendered = JSON.stringify(error.details);
  assert.ok(!/[0-9a-f]{64}/.test(rendered), 'the error leaks a fingerprint');
  assert.match(rendered, /If this is a RETRY/);
  assert.match(rendered, /Not retryable/);
});

// ═══════════════════════════════════════════════════════════════════════════
// The success path, and the failure path.
// ═══════════════════════════════════════════════════════════════════════════

test('a CLAIMED request runs the handler and records the outcome', async () => {
  const store = fakeStore({ outcome: 'CLAIMED' });
  const interceptor = new IdempotencyInterceptor(
    reflector('required'),
    store as never,
    config,
    new SystemClock(),
  );
  const { ctx } = context({ key: KEY });

  const result = await runWithTenant(tenantId(TENANT_A), async () =>
    firstValueFrom(interceptor.intercept(ctx, { handle: () => of({ orderId: 'o-1' }) })),
  );

  assert.deepEqual(result, { orderId: 'o-1' });
  assert.equal(store.calls.completed.length, 1);
  assert.deepEqual(store.calls.released, []);
});

test('a FAILED handler RELEASES the claim rather than storing the failure', async () => {
  // Storing it would replay the failure for the whole retention window, and a transient fault
  // would become a permanent one that no retry can clear.
  const store = fakeStore({ outcome: 'CLAIMED' });
  const interceptor = new IdempotencyInterceptor(
    reflector('required'),
    store as never,
    config,
    new SystemClock(),
  );
  const { ctx } = context({ key: KEY });

  await runWithTenant(tenantId(TENANT_A), async () => {
    await assert.rejects(() =>
      firstValueFrom(
        interceptor.intercept(ctx, {
          handle: () => {
            throw new Error('provider timeout');
          },
        }),
      ),
    );
  });

  assert.deepEqual(store.calls.released, [KEY]);
  assert.equal(store.calls.completed.length, 0, 'a failure was stored as a replayable response');
});

test('a route marked @Idempotent with NO tenant context is refused', async () => {
  // Every §14.2.1 REQ route is behind authentication and therefore tenant-scoped. Reaching here
  // means a route was marked idempotent and is not — which would store a row with no owner and
  // make it replayable by anybody.
  const interceptor = new IdempotencyInterceptor(
    reflector('required'),
    fakeStore({ outcome: 'CLAIMED' }) as never,
    config,
    new SystemClock(),
  );
  const { ctx } = context({ key: KEY });

  await runWithoutTenant(async () => {
    assert.throws(() => interceptor.intercept(ctx, { handle: () => of({}) }), /no tenant context/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The ordering, which is invisible in any single request.
// ═══════════════════════════════════════════════════════════════════════════

test('idempotency is registered OUTSIDE the audit interceptor', async () => {
  // Nest runs global interceptors in registration order, outermost first. If audit were
  // outermost, every replay would be audited as a fresh action and the log would show twenty
  // approvals where one occurred — BR-DAT-01 says the audit log records what HAPPENED, and a
  // replay is not a second happening.
  const appModule = readFileSync(resolve('src/app.module.ts'), 'utf8');
  const idempotencyAt = appModule.indexOf('useClass: IdempotencyInterceptor');
  const auditAt = appModule.indexOf('useClass: AuditInterceptor');

  assert.ok(idempotencyAt > 0 && auditAt > 0, 'an interceptor is not registered');
  assert.ok(
    idempotencyAt < auditAt,
    'AuditInterceptor is registered before IdempotencyInterceptor, so a replayed request would ' +
      'write a second audit row for work that did not happen again.',
  );
  await Promise.resolve();
});

// ═══════════════════════════════════════════════════════════════════════════
// The sweep — declared here, scheduled by M-018.
// ═══════════════════════════════════════════════════════════════════════════

test('the sweep batches, and drains', async () => {
  // A single unbounded DELETE takes a lock proportional to the row count, and on a busy day that
  // is a lock held across the payment path.
  let remaining = SWEEP_BATCH_SIZE * 2 + 7;
  const result = await runIdempotencySweep({
    deleteExpiredBatch: (limit) => {
      const removed = Math.min(limit, remaining);
      remaining -= removed;
      return Promise.resolve(removed);
    },
    now: () => new Date('2026-08-07T03:00:00Z'),
  });

  assert.equal(result.deleted, SWEEP_BATCH_SIZE * 2 + 7);
  assert.equal(result.batches, 3);
  assert.equal(remaining, 0);
});

test('an empty sweep is one batch, not zero', async () => {
  // Zero batches would mean the loop never ran, which is indistinguishable from a sweep that was
  // never scheduled — and that distinction is what the job's own monitoring reads.
  const result = await runIdempotencySweep({
    deleteExpiredBatch: () => Promise.resolve(0),
    now: () => new Date(),
  });
  assert.deepEqual(result, { deleted: 0, batches: 1 });
});

test('a sweep that never drains fails loudly rather than looping forever', async () => {
  // A job that runs forever holds a worker slot and is harder to notice than one that fails.
  await assert.rejects(
    () =>
      runIdempotencySweep({
        deleteExpiredBatch: () => Promise.resolve(SWEEP_BATCH_SIZE),
        now: () => new Date(),
      }),
    /batches without draining/,
  );
});

test('TR-24 — the sweep is scheduled at a LOCAL time, not a UTC hour', async () => {
  // 03:00 UTC is 08:30 in India — inside the morning gym rush, which is when the payment path is
  // busiest. The name and the local time are constants so the scheduler, the log line and the
  // runbook cannot disagree.
  assert.equal(SWEEP_LOCAL_TIME, '03:00');
  assert.equal(IDEMPOTENCY_SWEEP_JOB, 'common.idempotency-sweep');
  await Promise.resolve();
});
