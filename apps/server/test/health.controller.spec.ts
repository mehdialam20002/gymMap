/**
 * M-004 AC-1, AC-2 · `/healthz` body shape; `/readyz` degrades on a stubbed dependency failure.
 *
 * AC-1 is the security-relevant half: `/healthz` is typically unauthenticated and reachable from
 * anywhere the pod is, so anything it echoes is free reconnaissance.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HealthController } from '../dist/common/health/health.controller.js';
import { ReadinessService } from '../dist/common/health/readiness.service.js';

/** Captures the status the controller sets via `@Res({ passthrough: true })`. */
function responseDouble() {
  const captured = { status: 0 };
  return {
    res: {
      status(code: number) {
        captured.status = code;
        return this;
      },
    },
    captured,
  };
}

test('AC-1 — /healthz returns 200 with no internal detail', () => {
  const controller = new HealthController(new ReadinessService());
  const body = controller.health();

  assert.deepEqual(body, { status: 'ok' });

  // No dependency version, no tenant count, no database host, no build sha, no uptime.
  const serialised = JSON.stringify(body).toLowerCase();
  for (const forbidden of [
    'version',
    'host',
    'postgres',
    'redis',
    'tenant',
    'uptime',
    'commit',
    'node',
  ]) {
    assert.ok(!serialised.includes(forbidden), `/healthz leaked "${forbidden}"`);
  }
});

test('liveness does NOT touch the database', async () => {
  // If it did, a brief Postgres blip would make the orchestrator kill and reschedule every
  // replica simultaneously — turning a recoverable wobble into a full outage.
  const readiness = new ReadinessService();
  let probed = false;
  readiness.register({
    name: 'postgres',
    check: async () => {
      probed = true;
    },
  });

  const controller = new HealthController(readiness);
  controller.health();
  assert.equal(probed, false, '/healthz ran a dependency probe — it must not');
});

test('AC-2 — /readyz is 503 while no dependency has registered', async () => {
  // Reporting "ready" because nothing is checked is the exact failure this must prevent.
  const controller = new HealthController(new ReadinessService());
  const { res, captured } = responseDouble();

  const report = await controller.ready(res as never);
  assert.equal(captured.status, 503);
  assert.equal(report.status, 'not_ready');
});

test('AC-2 — /readyz is 200 once every dependency answers', async () => {
  const readiness = new ReadinessService();
  readiness.register({ name: 'postgres', check: async () => undefined });
  readiness.register({ name: 'redis', check: async () => undefined });

  const controller = new HealthController(readiness);
  const { res, captured } = responseDouble();
  const report = await controller.ready(res as never);

  assert.equal(captured.status, 200);
  assert.equal(report.status, 'ready');
  assert.deepEqual(report.dependencies, { postgres: true, redis: true });
});

test('AC-2 — /readyz degrades to 503 when one dependency fails', async () => {
  const readiness = new ReadinessService();
  readiness.register({ name: 'postgres', check: async () => undefined });
  readiness.register({
    name: 'redis',
    check: async () => {
      throw new Error('connect ECONNREFUSED 10.0.3.9:6379');
    },
  });

  const controller = new HealthController(readiness);
  const { res, captured } = responseDouble();
  const report = await controller.ready(res as never);

  assert.equal(captured.status, 503);
  assert.equal(report.status, 'not_ready');
  assert.deepEqual(report.dependencies, { postgres: true, redis: false });
});

test('the readiness body carries names and booleans only — no host, port or error text', async () => {
  const readiness = new ReadinessService();
  readiness.register({
    name: 'postgres',
    check: async () => {
      throw new Error('password authentication failed for user "gymmap" at 10.0.3.14:5432');
    },
  });

  const controller = new HealthController(readiness);
  const { res } = responseDouble();
  const report = await controller.ready(res as never);

  const serialised = JSON.stringify(report);
  for (const secret of ['10.0.3.14', '5432', 'password', 'gymmap']) {
    assert.ok(!serialised.includes(secret), `/readyz leaked "${secret}"`);
  }
  assert.equal(report.dependencies['postgres'], false);
});

test('AC-2 — the probe is a real round trip, not a cached boolean', async () => {
  let calls = 0;
  const readiness = new ReadinessService();
  readiness.register({
    name: 'postgres',
    check: async () => {
      calls += 1;
    },
  });

  const controller = new HealthController(readiness);
  const { res } = responseDouble();
  await controller.ready(res as never);
  await controller.ready(res as never);
  await controller.ready(res as never);

  assert.equal(
    calls,
    3,
    'the probe result was cached — a cached flag reports ready while the DB is gone',
  );
});

test('a hanging probe is bounded rather than hanging /readyz itself', async () => {
  const readiness = new ReadinessService();
  readiness.register({ name: 'postgres', check: () => new Promise<void>(() => undefined) });

  const started = process.hrtime.bigint();
  const report = await readiness.check();
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

  assert.equal(report.status, 'not_ready');
  assert.equal(report.dependencies['postgres'], false);
  assert.ok(
    elapsedMs < 4000,
    `the probe was not bounded (${Math.round(elapsedMs)}ms). A TCP connect to a vanished host ` +
      'hangs for minutes, and the orchestrator cannot distinguish "not ready" from "hung".',
  );
});
