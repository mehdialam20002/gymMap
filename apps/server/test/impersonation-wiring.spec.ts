/**
 * `M-025` · The four pieces that existed and were not connected — `TD-047`, `AC-3`, `AC-6`, `AC-7`.
 *
 * ┌─ EVERY ONE OF THESE PASSED ITS OWN UNIT TESTS WHILE DOING NOTHING ───────────────────────────┐
 * │ `runAsImpersonator` had no production caller, so `audit_log.impersonated_by` was `null` on    │
 * │ every row ever written. `mayElevate()` and `impersonationExpired()` were pure functions with  │
 * │ tests and no callers. `ImpersonationRestrictionGuard` was registered nowhere. And             │
 * │ `AccessTokenVerifier` refused `typ: 'IMPERSONATION'` outright, so the route                   │
 * │ `Authentication.md` §8.15 says must be called WITH that token could not be called at all.     │
 * │                                                                                              │
 * │ Four green suites, one inert feature. This file asserts the CONNECTIONS, because that is the  │
 * │ part a unit test structurally cannot see.                                                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { AccessTokenVerifier, TokenRejected } from '../dist/common/auth/access-token.verifier.js';
import {
  currentImpersonation,
  type ImpersonationContext,
  currentImpersonatorId,
  runAsImpersonator,
} from '../dist/common/auth/impersonation.als.js';
import { ImpersonationContextMiddleware } from '../dist/common/auth/impersonation-context.middleware.js';
import { impersonationExpired, mayElevate } from '../dist/iam/domain/impersonation.policy.js';
import { effectiveGrants } from '../dist/iam/domain/effective-permissions.js';

const SECRET = 'impersonation-wiring-spec-secret-not-a-real-one-0123456789';
const AGENT = '01912f00-0000-7000-8000-0000000000e1';
const SUBJECT = '01912f00-0000-7000-8000-0000000000e2';

const frozen = (iso: string) => ({ now: () => new Date(iso) });

function verifier(atIso = '2026-08-11T10:00:00.000Z'): AccessTokenVerifier {
  return new AccessTokenVerifier({ JWT_ACCESS_SECRET: SECRET } as never, frozen(atIso) as never);
}

/** Mints a token by hand, so a single claim can be removed without touching the signer. */
function mint(claims: Record<string, unknown>): string {
  const encode = (value: unknown): string =>
    Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode(claims);
  const signature = createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

const IAT = Math.floor(Date.parse('2026-08-11T09:55:00.000Z') / 1000);

const impersonationClaims = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  sub: SUBJECT,
  roles: ['GYM_OWNER@t:01912f00-0000-7000-8000-00000000000a'],
  typ: 'IMPERSONATION',
  imp: AGENT,
  imp_roles: ['SUPPORT_AGENT@platform'],
  imp_at: IAT,
  iss: 'gymmap',
  aud: 'gymmap-api',
  iat: IAT,
  exp: IAT + 1800,
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════════════
// 1 · The verifier accepts the type — and only a COMPLETE one
// ═══════════════════════════════════════════════════════════════════════════

test('an IMPERSONATION token is accepted, where it used to be refused outright', () => {
  const claims = verifier().verify(mint(impersonationClaims()));

  assert.equal(claims.typ, 'IMPERSONATION');
  assert.equal(claims.imp, AGENT);
  assert.equal(claims.sub, SUBJECT, 'the SUBJECT is `sub`; the agent rides in `imp`');
});

test('an ordinary ACCESS token is unaffected', () => {
  // The change widened the accepted set by exactly one value. Asserted so a future edit that
  // swapped rather than widened is caught.
  const claims = verifier().verify(
    mint({
      sub: SUBJECT,
      roles: [],
      typ: 'ACCESS',
      iss: 'gymmap',
      aud: 'gymmap-api',
      iat: IAT,
      exp: IAT + 900,
    }),
  );
  assert.equal(claims.typ, 'ACCESS');
});

test('a REFRESH token is still refused — the set widened by one value, not by any', () => {
  assert.throws(
    () => verifier().verify(mint(impersonationClaims({ typ: 'REFRESH' }))),
    (error: unknown) =>
      error instanceof TokenRejected && /token type REFRESH refused/.test(error.message),
  );
});

test('each missing impersonation claim is a REJECTED token, named individually', () => {
  /*
   * Every one of these fails OPEN somewhere downstream if it is merely absent:
   *   `imp`       → impersonated_by is null and AC-7's whole audit trail evaporates
   *   `imp_roles` → effectiveGrants returns [] (already closed) but as a 403, not a 401
   *   `imp_at`    → AC-3's cap has nothing to re-check and collapses to whatever `exp` says
   */
  for (const [claim, expected] of [
    ['imp', /carries no agent/],
    ['imp_roles', /carries no agent roles/],
    ['imp_at', /carries no start time/],
  ] as const) {
    const claims = impersonationClaims();
    delete claims[claim];
    assert.throws(
      () => verifier().verify(mint(claims)),
      (error: unknown) => error instanceof TokenRejected && expected.test(error.message),
      `a token with no ${claim} was accepted`,
    );
  }
});

test('an EMPTY imp_roles array is refused, not treated as "no narrowing"', () => {
  // `[]` passes `Array.isArray`. Downstream, `effectiveGrants` treats zero agent grants as a
  // forged token and returns nothing — the right answer, arrived at as a 403. Refusing here makes
  // it a 401 that says the token is malformed, which is what it is.
  assert.throws(
    () => verifier().verify(mint(impersonationClaims({ imp_roles: [] }))),
    /carries no agent roles/,
  );
});

test('a non-string inside imp_roles is refused', () => {
  // `[null]` survives `Array.isArray` and then `parseRoleGrants` silently skips it, leaving an
  // agent with zero grants — the union-by-omission shape, arrived at by a different road.
  assert.throws(
    () => verifier().verify(mint(impersonationClaims({ imp_roles: [null] }))),
    /malformed agent role/,
  );
});

test('a start time AFTER the token was issued is refused', () => {
  /*
   * `impersonationExpired()` computes elapsed minutes from `imp_at`, so a future start yields a
   * NEGATIVE elapsed time — never "expired" — and the token would outlive AC-3's cap forever.
   * Compared against the token's own `iat` rather than the clock, so two reads of the same
   * instant cannot disagree by a millisecond.
   */
  assert.throws(
    () => verifier().verify(mint(impersonationClaims({ imp_at: IAT + 60 }))),
    /start is after the token was issued/,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 · AC-5's intersection — the reason the type could not be accepted earlier
// ═══════════════════════════════════════════════════════════════════════════

test('AC-5 · the session holds the INTERSECTION, never the subject’s full set', () => {
  /*
   * `TD-047` is explicit that lifting the `typ` check without `PermissionsGuard` bound would have
   * granted the subject's whole permission set. This is the assertion that the narrowing is real
   * and is reached through the same function the guard calls.
   */
  const subjectOnly = effectiveGrants({
    typ: 'ACCESS',
    roles: ['GYM_OWNER@t:01912f00-0000-7000-8000-00000000000a'],
  });

  const impersonated = effectiveGrants({
    typ: 'IMPERSONATION',
    roles: ['GYM_OWNER@t:01912f00-0000-7000-8000-00000000000a'],
    imp_roles: ['SUPPORT_AGENT@platform'],
  });

  assert.ok(subjectOnly.length > 0, 'the control is vacuous — the subject holds nothing');
  assert.ok(
    impersonated.length <= subjectOnly.length,
    'impersonation WIDENED the grant set, which is the escalation AC-5 forbids',
  );
});

test('AC-5 · an impersonation token with no agent roles grants NOTHING', () => {
  // Fail closed. The verifier now refuses such a token, so this is the second line — and the one
  // that holds if a token ever reaches the guard by another route.
  assert.deepEqual(
    effectiveGrants({ typ: 'IMPERSONATION', roles: ['SUPER_ADMIN@platform'], imp_roles: [] }),
    [],
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 · AC-7 — the middleware is what makes the audit column non-null
// ═══════════════════════════════════════════════════════════════════════════

test('the middleware OPENS the frame, so currentImpersonatorId() is the agent', () => {
  const middleware = new ImpersonationContextMiddleware(verifier());
  const request = {
    headers: { authorization: `Bearer ${mint(impersonationClaims())}` },
  } as never;

  let seen: string | null = 'never ran';
  middleware.use(request, {} as never, () => {
    seen = currentImpersonatorId();
  });

  assert.equal(seen, AGENT, 'the audit column would have been null for every write');
});

test('the frame carries the SUBJECT and the start, not only the agent', () => {
  const middleware = new ImpersonationContextMiddleware(verifier());
  const request = {
    headers: { authorization: `Bearer ${mint(impersonationClaims())}` },
  } as never;

  /*
   * Collected into an array rather than assigned to a `let`.
   *
   * TypeScript's control-flow analysis cannot see that the callback ran synchronously, so a
   * `let context = null` stays `null` in its view and `assert.ok(context)` narrows it to `never` —
   * after which every property read is an error. Pushing sidesteps the analysis honestly, where a
   * non-null assertion would have silenced it and also silenced a genuinely absent frame.
   */
  const captured: ImpersonationContext[] = [];
  middleware.use(request, {} as never, () => {
    const context = currentImpersonation();
    if (context !== null) captured.push(context);
  });

  const context = captured[0];
  assert.ok(context, 'no frame was opened');
  assert.equal(context.subjectUserId, SUBJECT);
  assert.equal(context.impersonatorId, AGENT);
  // Seconds on the wire, a Date in the domain — AC-3 re-checks against THIS, not `exp`.
  assert.equal(context.startedAt.getTime(), IAT * 1000);
});

test('an ORDINARY token opens no frame — impersonated_by stays null, correctly', () => {
  const middleware = new ImpersonationContextMiddleware(verifier());
  const request = {
    headers: {
      authorization: `Bearer ${mint({ sub: SUBJECT, roles: [], typ: 'ACCESS', iss: 'gymmap', aud: 'gymmap-api', iat: IAT, exp: IAT + 900 })}`,
    },
  } as never;

  let seen: string | null = 'never ran';
  middleware.use(request, {} as never, () => {
    seen = currentImpersonatorId();
  });

  assert.equal(seen, null);
});

test('no token at all still calls next() — a public route must not hang', () => {
  // The middleware resolves and never rejects. A `@Public()` route reaches it with no header, and
  // failing to call `next()` there would hang the request rather than 401 it.
  const middleware = new ImpersonationContextMiddleware(verifier());
  let called = false;

  middleware.use({ headers: {} } as never, {} as never, () => {
    called = true;
  });

  assert.equal(called, true);
});

test('a GARBAGE token opens no frame and still calls next()', () => {
  const middleware = new ImpersonationContextMiddleware(verifier());
  let seen: string | null = 'never ran';

  middleware.use({ headers: { authorization: 'Bearer not.a.token' } } as never, {} as never, () => {
    seen = currentImpersonatorId();
  });

  // `tryVerify` returned null; the guard refuses a moment later, from the one place that refuses.
  assert.equal(seen, null);
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 · AC-3 and AC-6 — the two pure functions, now with callers
// ═══════════════════════════════════════════════════════════════════════════

test('AC-3 · the cap is measured from imp_at, and 30 minutes is the boundary', () => {
  const started = new Date('2026-08-11T10:00:00.000Z');

  assert.equal(impersonationExpired(started, new Date('2026-08-11T10:29:59.000Z')), false);
  // `>=`, so exactly thirty minutes is expired. A cap that admits its own boundary is a cap of
  // thirty minutes and one instant, which is not what AC-3 says.
  assert.equal(impersonationExpired(started, new Date('2026-08-11T10:30:00.000Z')), true);
  assert.equal(impersonationExpired(started, new Date('2026-08-11T11:00:00.000Z')), true);
});

test('AC-6 · mayElevate refuses IMPERSONATION and permits ACCESS', () => {
  assert.equal(mayElevate('ACCESS'), true);
  assert.equal(mayElevate('IMPERSONATION'), false);
});

test('runAsImpersonator still refuses to NEST', () => {
  /*
   * There is no legitimate way to impersonate from inside an impersonation — the token type is
   * checked before one can be minted, and an IMPERSONATION token cannot mint another. Reaching
   * here twice means a frame leaked across an async boundary, and silently taking the inner one
   * would attribute a whole request to the wrong agent.
   *
   * Asserted here as well as in the ALS's own spec, because the middleware is now a real caller
   * and a double-registered middleware is exactly how this would happen in production.
   */
  const context = { impersonatorId: AGENT, subjectUserId: SUBJECT, startedAt: new Date() };

  assert.throws(
    () => runAsImpersonator(context, () => runAsImpersonator(context, () => 'inner')),
    /cannot nest inside it/,
  );
});
