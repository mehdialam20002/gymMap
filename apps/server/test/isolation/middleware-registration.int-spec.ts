/**
 * M-015 · A middleware that is REGISTERED but matches nothing — `AC-1`, `§11.3`, `BR-TEN-01`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THIS FILE EXISTS BECAUSE OF A DEFECT THAT NO UNIT TEST COULD SEE
 *
 * `AppModule` registered `TenantContextMiddleware` with
 *
 *     .forRoutes({ path: '*path', method: RequestMethod.ALL })
 *
 * `'*path'` is Express 5 / path-to-regexp v8 syntax. Nest 10 runs Express 4, where that pattern
 * matches NOTHING. The middleware was correctly written, correctly registered, and never ran.
 *
 * Two controls were silently absent rather than merely degraded:
 *
 *   the tenant frame was never opened, so every @TenantScoped() route answered 500 — which
 *   looked exactly like a KNOWN GAP recorded in the same file, and hid behind it
 *
 *   `X-Tenant-Id` was never REFUSED. The control stopping a client from choosing its own tenant
 *   had never executed in a real request
 *
 * The middleware's 29 unit tests all passed, because they instantiate the class and call `use()`
 * directly. A unit test cannot see a registration that matches nothing — only a request can.
 *
 * Every assertion below is therefore made over HTTP, against a booted application.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import type { INestApplication } from '@nestjs/common';

import { TENANT_A, TENANT_B } from '../../prisma/seed/tenants.ts';
import { mintAccessToken } from '../harness/mint-token.ts';
import { applyTestEnv, TEST_JWT_SECRET } from '../harness/test-env.ts';
import { REJECTED_TENANT_KEYS } from '../../dist/tenancy/context/tenant-context.middleware.js';

let app: INestApplication | undefined;
let baseUrl = '';
let available = false;

before(async () => {
  try {
    applyTestEnv();
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../../dist/app.module.js');
    const { configureApp } = await import('../../dist/common/bootstrap/configure-app.js');

    // `abortOnError: false` — the default calls process.exit(1) on a bootstrap failure, and with
    // `logger: false` it does so silently. The runner then reports "test failed" with no stack.
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    configureApp(app);
    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', 'localhost');
    available = true;
  } catch (error) {
    console.error(
      '\n  SKIPPING — the application would not boot.\n' +
        `  ${error instanceof Error ? error.message.split('\n')[0] : String(error)}\n`,
    );
  }
});

after(async () => {
  if (app) await app.close();
});

const it = (name: string, fn: () => Promise<void>) =>
  test(name, async (t) => {
    if (!available) return t.skip('the application did not boot');
    await fn();
  });

const tokenFor = (tenant: string) =>
  mintAccessToken({
    sub: '01912f00-0000-7000-8000-0000000000a1',
    tenantId: tenant,
    roles: ['GYM_OWNER'],
    secret: TEST_JWT_SECRET,
  });

// ═══════════════════════════════════════════════════════════════════════════
// The middleware runs. Asserted by its OBSERVABLE EFFECT, not by inspecting a config object.
// ═══════════════════════════════════════════════════════════════════════════

it('the tenant middleware executes on an UNTENANTED route', async () => {
  // `/healthz` is the strongest probe available: it needs no token, no database and no tenant,
  // so a 400 here can only have come from the middleware. If the registration pattern matched
  // nothing, this returns 200 — which is exactly what it did before M-015.
  const response = await fetch(`${baseUrl}/healthz`, { headers: { 'x-tenant-id': TENANT_B } });

  assert.equal(
    response.status,
    400,
    'X-Tenant-Id was ACCEPTED on /healthz. Either the middleware is not registered, or its ' +
      'route pattern matches nothing — `*path` is Express 5 syntax and Nest 10 runs Express 4, ' +
      'where it matches no route at all. AC-1 has not run.',
  );
});

it('every rejected spelling is refused over HTTP, not merely in a unit test', async () => {
  // The unit tests cover all five spellings by calling `use()` directly. This proves the same
  // five reach the middleware through a real Express pipeline — the layer where the defect was.
  for (const key of REJECTED_TENANT_KEYS) {
    const response = await fetch(`${baseUrl}/healthz`, { headers: { [key]: TENANT_B } });
    assert.equal(response.status, 400, `header "${key}" was accepted`);

    const body = (await response.json()) as { error?: { code?: string } };
    assert.equal(
      body.error?.code,
      'TENANT_HEADER_NOT_ACCEPTED',
      `header "${key}" was refused with the wrong code — a caller cannot branch on it`,
    );
  }
});

it('a query-parameter tenant id is refused too', async () => {
  const response = await fetch(`${baseUrl}/healthz?tenant_id=${TENANT_B}`);
  assert.equal(response.status, 400, 'a tenant id in the QUERY STRING was accepted');
});

it('a clean request to the same route still succeeds', async () => {
  // The negative half. Without it, "the middleware refuses everything" would also pass — and a
  // middleware that 400s every request would take the whole API down while this suite stayed
  // green.
  const response = await fetch(`${baseUrl}/healthz`);
  assert.equal(response.status, 200, 'the middleware refuses a request that carries no tenant id');
});

// ═══════════════════════════════════════════════════════════════════════════
// The context is established from the TOKEN, and reaches the handler.
// ═══════════════════════════════════════════════════════════════════════════

it('the tenant frame reaches the HANDLER, not just the guard', async () => {
  // The frame must wrap the whole downstream pipeline. A guard that entered it would satisfy
  // TenantGuard and then lose it before the handler queried — so this asserts on the RESPONSE
  // BODY, which only exists if the repository ran inside the frame.
  const response = await fetch(`${baseUrl}/v1/tenant/ping`, {
    headers: { authorization: `Bearer ${tokenFor(TENANT_A)}` },
  });

  // Read the body ONCE. A `fetch` Response body is a stream: putting `await response.text()`
  // inside the assertion message consumes it, and the next `.json()` throws
  // "Body has already been read" — which then masks the assertion that was being made.
  const raw = await response.text();
  assert.equal(response.status, 200, `the tenant-scoped handler failed: ${raw}`);

  const body = JSON.parse(raw) as { id?: string };
  assert.equal(
    body.id,
    TENANT_A,
    'the handler returned a different tenant than the token names — the frame is wrong, not absent',
  );
});

it('a request with NO token gets 401, not 500', async () => {
  // The ordering proof. The middleware resolves nothing, leaves the context NONE, and
  // `JwtAuthGuard` rejects — from the ONE place that rejects. A 500 here would mean TenantGuard
  // ran first and turned a missing credential into an internal error, which is a 500 the caller
  // caused and would page somebody.
  const response = await fetch(`${baseUrl}/v1/tenant/ping`);
  assert.equal(response.status, 401, `expected 401, got ${response.status}`);

  const body = (await response.json()) as { error?: { code?: string } };
  assert.equal(body.error?.code, 'UNAUTHENTICATED');
});

it('an INVALID token gets 401 with no hint about which check failed', async () => {
  // AC-7. The middleware's `tryVerify` swallows the reason and the guard reports one shape, so
  // "expired" and "bad signature" are indistinguishable to the caller.
  const expired = mintAccessToken({
    sub: '01912f00-0000-7000-8000-0000000000a1',
    tenantId: TENANT_A,
    expiresInSeconds: -60,
    secret: TEST_JWT_SECRET,
  });
  const wrongKey = mintAccessToken({
    sub: '01912f00-0000-7000-8000-0000000000a1',
    tenantId: TENANT_A,
    secret: 'a-completely-different-key-000000000000000000000',
  });

  const bodies: string[] = [];
  for (const token of [expired, wrongKey]) {
    const response = await fetch(`${baseUrl}/v1/tenant/ping`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 401);
    const raw = await response.text();
    for (const leak of ['expired', 'signature', 'audience', 'issuer']) {
      assert.ok(!raw.toLowerCase().includes(leak), `the 401 body names "${leak}"`);
    }
    bodies.push(raw.replace(/"correlation_id":"[^"]*"/, ''));
  }

  assert.equal(
    bodies[0],
    bodies[1],
    'an expired token and a badly-signed one produce DIFFERENT bodies. That tells an attacker ' +
      'which of their guesses was closest, and turns forgery into a game with feedback (AC-7).',
  );
});

it('there is exactly ONE implementation of token verification', async () => {
  // Two verifications means two places deciding what a valid token is, and they drift — with the
  // looser one deciding who gets in. The guard verifies only when the middleware has NOT already
  // resolved a principal, and it never implements the signature check itself.
  //
  // The "does not re-verify" half of this claim used to be a regex over the early-return line
  // here. M-022 restructured that line — the guard now falls through to the AC-10 denylist
  // instead of returning early — and the regex failed for a shape change while the property was
  // intact. It now lives in `jwt-auth.guard.spec.ts` as a call count against a counting
  // verifier, which a restructuring cannot break and a genuine regression cannot survive.
  const { readFileSync } = await import('node:fs');
  const guard = readFileSync('src/common/guards/jwt-auth.guard.ts', 'utf8');

  assert.match(guard, /this\.verifier\.verify\(token\)/);
  assert.match(
    guard,
    /if \(!request\.principal\) \{/,
    'the verification is no longer conditional on the middleware having missed it',
  );
  assert.ok(!guard.includes('createHmac'), 'the guard verifies a signature itself again');
});
