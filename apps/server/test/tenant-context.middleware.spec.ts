/**
 * M-011 · `TenantContextMiddleware` — AC-1, AC-2, AC-4, AC-6.
 *
 * The headline case is the client-supplied tenant id. `X-Tenant-Id: <someone else's uuid>` is a
 * valid HTTP request that produces a syntactically valid query and returns a correct-looking
 * page of another gym's members. It is the whole breach in one field, so it is REJECTED rather
 * than ignored — and these assertions are what prove the rejection covers every spelling and
 * every location a caller would try.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TenantContextMiddleware,
  REJECTED_TENANT_KEYS,
  isUntenantedPath,
} from '../dist/tenancy/context/tenant-context.middleware.js';
import { currentTenantContext } from '../dist/tenancy/context/tenant-context.als.js';
import { TenantHeaderNotAcceptedError } from '../dist/tenancy/domain/tenancy.errors.js';
import { AccessTokenVerifier } from '../dist/common/auth/access-token.verifier.js';
import { mintAccessToken, testSecret } from './harness/mint-token.ts';

const TENANT_A = '01912f00-0000-7000-8000-00000000000a';
const TENANT_B = '01912f00-0000-7000-8000-00000000000b';
const ACTOR = '01912f00-0000-7000-8000-0000000000a1';

interface FakeRequest {
  headers: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: unknown;
  principal?: { sub: string; tenant_id?: string };
}

// M-015: the middleware resolves the principal ITSELF from the Authorization header, because
// Nest runs middleware before guards and `request.principal` was therefore always undefined —
// every @TenantScoped() route answered 500. It takes the shared verifier now.
const verifier = new AccessTokenVerifier({ JWT_ACCESS_SECRET: testSecret() } as never);
const middleware = new TenantContextMiddleware(verifier);

/**
 * A request carrying a REAL signed token, rather than a hand-placed `principal`.
 *
 * The tests below used to set `principal` directly on the fake request. That stopped being a
 * faithful stand-in the moment M-015 made the middleware resolve the principal ITSELF — it was
 * modelling a field that `JwtAuthGuard` sets AFTER this middleware runs, which is exactly the
 * ordering defect that let every @TenantScoped() route return 500 while these tests were green.
 *
 * Minting a token makes the test exercise the real path: header -> verifier -> tenant frame.
 */
function authorised(tenant: string | undefined, sub = ACTOR): Partial<FakeRequest> {
  const token = mintAccessToken({
    sub,
    ...(tenant === undefined ? {} : { tenantId: tenant }),
    secret: testSecret(),
  });
  return { headers: { authorization: `Bearer ${token}` } };
}

/** Runs the middleware and reports the context observed INSIDE the downstream chain. */
function run(request: Partial<FakeRequest>) {
  let observed: ReturnType<typeof currentTenantContext> | undefined;
  const full: FakeRequest = { headers: {}, query: {}, ...request };
  middleware.use(full as never, {} as never, () => {
    observed = currentTenantContext();
  });
  return observed;
}

// ---------------------------------------------------------------------------
// AC-1 — the three client-supplied shapes.
// ---------------------------------------------------------------------------

for (const key of REJECTED_TENANT_KEYS) {
  test(`AC-1 · a "${key}" HEADER is rejected with TENANT_HEADER_NOT_ACCEPTED`, () => {
    assert.throws(
      () => run({ headers: { [key]: TENANT_B } }),
      (error: unknown) => {
        assert.ok(error instanceof TenantHeaderNotAcceptedError);
        assert.equal(error.code, 'TENANT_HEADER_NOT_ACCEPTED');
        assert.equal(error.httpStatus, 400);
        return true;
      },
    );
  });

  test(`AC-1 · a "${key}" QUERY parameter is rejected`, () => {
    assert.throws(() => run({ query: { [key]: TENANT_B } }), TenantHeaderNotAcceptedError);
  });

  test(`AC-1 · a "${key}" BODY field is rejected`, () => {
    assert.throws(
      () => run({ body: { [key]: TENANT_B, name: 'x' } }),
      TenantHeaderNotAcceptedError,
    );
  });
}

test('AC-1 · the rejection is CASE-INSENSITIVE on a query parameter', () => {
  // A caller who reads a 400 for `tenant_id` and retries with `Tenant_Id` must get the same
  // answer. An inconsistency here is not a cosmetic bug: it is a bypass.
  for (const spelling of ['Tenant_Id', 'TENANT_ID', 'TenantId', 'X-Tenant-Id']) {
    assert.throws(
      () => run({ query: { [spelling]: TENANT_B } }),
      TenantHeaderNotAcceptedError,
      `"${spelling}" was not rejected`,
    );
  }
});

test('AC-1 · the rejection names the field and states the remedy', () => {
  try {
    run({ headers: { 'x-tenant-id': TENANT_B } });
    assert.fail('expected a rejection');
  } catch (error) {
    assert.ok(error instanceof TenantHeaderNotAcceptedError);
    const detail = error.details[0]!;
    assert.equal(detail['field'], 'x-tenant-id');
    assert.equal(detail['location'], 'header');
    // Vagueness protects nothing here: the fact that the tenant comes from the token is
    // published in the API contract, and an integrator who understands it stops sending it.
    assert.match(String(detail['remedy']), /derived from the access token/);
  }
});

test('AC-1 · the check runs on untenanted routes too', () => {
  // A caller sending X-Tenant-Id to /healthz is doing the same thing as one sending it to
  // /v1/tenant/members. The signal is the same, so the answer is the same.
  assert.ok(isUntenantedPath('/healthz'));
  assert.throws(() => run({ headers: { 'x-tenant-id': TENANT_B } }), TenantHeaderNotAcceptedError);
});

test('a NESTED tenant_id in the body is permitted — only the top level is refused', () => {
  // A settlement line legitimately references a tenant. A deep scan would reject valid payloads,
  // and the top level is where a caller would put it believing it scopes the request.
  const observed = run({ body: { line: { tenant_id: TENANT_B }, amountMinor: '1' } });
  assert.equal(observed?.kind, 'NONE');
});

test('an ordinary request with no tenant-ish field passes through', () => {
  const observed = run({ headers: { 'content-type': 'application/json' }, body: { name: 'x' } });
  assert.equal(observed?.kind, 'NONE');
});

test('an array body does not crash the check', () => {
  // `Object.keys([...])` yields indices, which would never match — but a bulk-import endpoint
  // posting an array must not throw a TypeError on the way in.
  assert.doesNotThrow(() => run({ body: [{ tenant_id: TENANT_B }] }));
});

// ---------------------------------------------------------------------------
// AC-2 — the tenant comes from the principal, never from the URL.
// ---------------------------------------------------------------------------

test('AC-2 · the tenant is taken from the principal claim', () => {
  const observed = run(authorised(TENANT_A));
  assert.equal(observed?.kind, 'TENANT');
  assert.equal(observed?.kind === 'TENANT' ? observed.tenantId : null, TENANT_A);
});

test('AC-2 · the actor travels with the context, for created_by and the audit row', () => {
  const observed = run(authorised(TENANT_A));
  assert.equal(observed?.kind === 'TENANT' ? observed.actorId : null, ACTOR);
});

test('AC-2 · a principal with no tenant claim yields NONE, not a guess', () => {
  // Platform staff have no tenant. Inventing one — from the URL, from the first tenant in the
  // database, from anywhere — is how an admin session silently acquires a tenant's scope.
  const observed = run(authorised(undefined));
  assert.equal(observed?.kind, 'NONE');
});

test('a malformed tenant claim is a token-issuance defect, not a client error', () => {
  // Nothing a caller sends can change a claim inside a signed token, so this must not be
  // reported as their mistake — the investigation belongs at the issuer (M-022).
  assert.throws(
    () =>
      run({
        headers: {
          authorization: `Bearer ${mintAccessToken({ sub: ACTOR, tenantId: 'not-a-uuid', secret: testSecret() })}`,
        },
      }),
    /token-issuance defect/,
  );
});

// ---------------------------------------------------------------------------
// AC-4 — the frame is entered in the middleware, before anything downstream.
// ---------------------------------------------------------------------------

test('AC-4 · the context is visible to the NEXT handler, not just to the middleware', () => {
  const observed = run(authorised(TENANT_A));
  assert.equal(observed?.kind, 'TENANT');
});

test('AC-4 · the context does NOT leak outside the request', () => {
  run(authorised(TENANT_A));
  // Read after the middleware has returned. A leak here would mean one request's scope bleeding
  // into the next — the same class of bug as a pooled connection carrying a session setting.
  assert.equal(currentTenantContext().kind, 'NONE');
});

test("two sequential requests do not see each other's tenant", () => {
  const first = run(authorised(TENANT_A));
  const second = run(authorised(TENANT_B));
  assert.equal(first?.kind === 'TENANT' ? first.tenantId : null, TENANT_A);
  assert.equal(second?.kind === 'TENANT' ? second.tenantId : null, TENANT_B);
});

// ---------------------------------------------------------------------------
// Untenanted paths.
// ---------------------------------------------------------------------------

test('the untenanted allow-list is a list, not "anything unauthenticated"', () => {
  assert.ok(isUntenantedPath('/healthz'));
  assert.ok(isUntenantedPath('/readyz'));
  assert.ok(isUntenantedPath('/v1/auth/login'));
  // Everything else reaching the middleware without a tenant is a defect and should look like
  // one, rather than being quietly excused.
  assert.ok(!isUntenantedPath('/v1/tenant/members'));
  assert.ok(!isUntenantedPath('/v1/gyms'));
});
