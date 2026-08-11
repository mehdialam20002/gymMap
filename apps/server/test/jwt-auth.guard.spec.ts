/**
 * M-011 · `JwtAuthGuard` — AC-7. Four rejection cases, one accept, one uniform error body.
 *
 * The uniformity assertion is the one worth reading. Telling a caller their token is "expired"
 * rather than "badly signed" confirms they held a real token; distinguishing "wrong audience"
 * from "wrong issuer" turns forgery into a guessing game with feedback. Every rejection here
 * must be indistinguishable from the outside.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AccessTokenVerifier } from '../dist/common/auth/access-token.verifier.js';
import { SystemClock } from '../dist/common/clock/system-clock.adapter.js';
import { JwtAuthGuard, extractBearerToken } from '../dist/common/guards/jwt-auth.guard.js';
import { UnauthenticatedException } from '../dist/common/errors/domain-exception.js';
import { mintAccessToken, REJECTION_FIXTURES, testSecret } from './harness/mint-token.ts';

const SUBJECT = '01912f00-0000-7000-8000-0000000000a1';

/** A Reflector stub. `@Public()` is read through it; nothing else about Nest is needed. */
function reflector(isPublic = false) {
  return { getAllAndOverride: () => isPublic } as never;
}

/** An ExecutionContext stub carrying one Authorization header. */
function contextWith(authorization?: string) {
  const request: Record<string, unknown> = { headers: authorization ? { authorization } : {} };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    __request: request,
  } as never as { switchToHttp: () => unknown; __request: Record<string, unknown> } & never;
}

const config = { JWT_ACCESS_SECRET: testSecret() } as never;

// M-015 moved the verification itself into `AccessTokenVerifier`, so BOTH the guard and
// `TenantContextMiddleware` use one implementation. The guard now takes the verifier rather
// than the config — it rejects, it no longer verifies.
// A SystemClock rather than a FixedClock: these specs mint tokens relative to now and
// assert acceptance, so a frozen clock would have to be kept in step with the minter.
// jwt-auth.guard.spec's expiry cases pass explicit offsets, which is the same property
// from the other side.
const verifier = new AccessTokenVerifier(config, new SystemClock());

/**
 * A denylist that denies nothing, unless a test says otherwise.
 *
 * M-022 gave the guard a second job — `AC-10`'s family denylist — and these specs are about
 * SIGNATURE verification. A double keeps them that way; `session-revocation.int-spec.ts` covers
 * the denylist against real Redis, where its behaviour actually lives.
 */
const denylist = (revoked: readonly string[] = []) =>
  ({ isRevoked: (family: string) => Promise.resolve(revoked.includes(family)) }) as never;

/**
 * `M-025` added a fourth constructor argument: the clock, for `AC-3`'s thirty-minute cap.
 *
 * Frozen rather than real, and required rather than defaulted — `AC-FND-13.3`. Every case in this
 * file uses an ACCESS token, for which the cap is not consulted at all, so the value only has to
 * exist; the cap itself is asserted in `impersonation-wiring.spec.ts` where it applies.
 */
const clock = { now: () => new Date('2026-08-11T10:00:00.000Z') } as never;

const guard = (isPublic = false, revoked: readonly string[] = []) =>
  new JwtAuthGuard(reflector(isPublic), verifier, denylist(revoked), clock);

// ---------------------------------------------------------------------------
// Accept.
// ---------------------------------------------------------------------------

test('a well-formed token is accepted and the principal is attached', async () => {
  const token = mintAccessToken({ sub: SUBJECT, tenantId: '01912f00-0000-7000-8000-00000000000a' });
  const context = contextWith(`Bearer ${token}`);

  assert.equal(await guard().canActivate(context as never), true);

  const principal = (context as unknown as { __request: { principal?: { sub: string } } }).__request
    .principal;
  assert.equal(principal?.sub, SUBJECT);
});

test('a @Public() route needs no token at all', async () => {
  assert.equal(await guard(true).canActivate(contextWith() as never), true);
});

// ---------------------------------------------------------------------------
// AC-7 — the four rejection cases, plus two more worth having.
// ---------------------------------------------------------------------------

const REJECTIONS: ReadonlyArray<[string, string, string]> = [
  [
    'unsigned (alg: none)',
    REJECTION_FIXTURES.unsigned(SUBJECT),
    'the classic forgery: a verifier that reads the header to decide HOW to verify has already ' +
      'let the attacker choose',
  ],
  [
    'signed with the wrong key',
    REJECTION_FIXTURES.wrongKey(SUBJECT),
    'a token from another deployment, or a forgery',
  ],
  ['expired', REJECTION_FIXTURES.expired(SUBJECT), 'past exp'],
  [
    'typ is REFRESH, not ACCESS',
    REJECTION_FIXTURES.wrongType(SUBJECT),
    'a refresh token on the access path would otherwise carry a 30-day lifetime',
  ],
  ['wrong audience', REJECTION_FIXTURES.wrongAudience(SUBJECT), 'issued for another API'],
  ['not yet valid (nbf in the future)', REJECTION_FIXTURES.notYetValid(SUBJECT), 'before nbf'],
];

for (const [name, token, why] of REJECTIONS) {
  test(`AC-7 · rejects a token that is ${name} — ${why}`, async () => {
    await assert.rejects(
      () => guard().canActivate(contextWith(`Bearer ${token}`) as never),
      UnauthenticatedException,
    );
  });
}

test('AC-7 · every rejection is the SAME error body — no oracle', async () => {
  // The assertion that matters. If these messages differed, an attacker could binary-search
  // their way to a valid token by watching which guess changed the response.
  const messages = new Set<string>();
  const codes = new Set<string>();

  for (const [, token] of REJECTIONS) {
    try {
      await guard().canActivate(contextWith(`Bearer ${token}`) as never);
      assert.fail('expected a rejection');
    } catch (error) {
      assert.ok(error instanceof UnauthenticatedException);
      messages.add(error.message);
      codes.add(error.code);
    }
  }

  assert.equal(
    messages.size,
    1,
    `${messages.size} distinct messages across ${REJECTIONS.length} rejection reasons: ` +
      `${[...messages].join(' | ')}. Each distinct message tells an attacker which guess was ` +
      `closest.`,
  );
  assert.deepEqual([...codes], ['UNAUTHENTICATED']);
});

test('every rejection is a 401, never a 403', async () => {
  // 403 means "authenticated, not allowed" — a different fact, and the client's next action
  // differs: re-authenticate versus give up.
  for (const [, token] of REJECTIONS) {
    try {
      await guard().canActivate(contextWith(`Bearer ${token}`) as never);
    } catch (error) {
      assert.equal((error as UnauthenticatedException).httpStatus, 401);
    }
  }
});

// ---------------------------------------------------------------------------
// Malformed input.
// ---------------------------------------------------------------------------

for (const [name, header] of [
  ['no Authorization header', undefined],
  ['an empty header', ''],
  ['the wrong scheme', 'Basic dXNlcjpwYXNz'],
  ['Bearer with nothing after it', 'Bearer '],
  ['a token with two segments', 'Bearer aaa.bbb'],
  ['a token with four segments', 'Bearer aaa.bbb.ccc.ddd'],
  ['unparseable base64 in the header segment', 'Bearer !!!.bbb.ccc'],
] as const) {
  test(`rejects ${name}`, async () => {
    await assert.rejects(
      () => guard().canActivate(contextWith(header) as never),
      UnauthenticatedException,
    );
  });
}

// ---------------------------------------------------------------------------
// The bearer parser.
// ---------------------------------------------------------------------------

test('extractBearerToken is case-insensitive on the scheme', async () => {
  assert.equal(extractBearerToken('Bearer abc'), 'abc');
  assert.equal(extractBearerToken('bearer abc'), 'abc');
  assert.equal(extractBearerToken('BEARER abc'), 'abc');
});

test('extractBearerToken refuses anything that is not exactly one bearer token', async () => {
  for (const header of ['', 'Basic abc', 'Bearer', 'Bearer ', 'Bearer a b', 'abc']) {
    assert.equal(extractBearerToken(header), null, `"${header}" should not parse`);
  }
  assert.equal(extractBearerToken(undefined), null);
});

// ---------------------------------------------------------------------------
// One verification per request — M-015's whole point.
// ---------------------------------------------------------------------------

test('the guard does NOT re-verify a principal the middleware already resolved', async () => {
  // Not a performance assertion. Two verifications means two places deciding what a valid token
  // is, and they drift — with the looser one deciding who gets in. The guard trusting
  // `request.principal` is safe precisely because the SAME verifier set it, on this request,
  // microseconds earlier in `TenantContextMiddleware`.
  //
  // This lived in `middleware-registration.int-spec.ts` as a regex over the guard's source until
  // M-022 restructured the early return — the property survived, the text did not, and the test
  // failed for a shape change rather than a behaviour change. Counting the calls cannot.
  let verifications = 0;
  const counting = {
    verify: (token: string) => {
      verifications += 1;
      return verifier.verify(token);
    },
  } as never;

  const context = contextWith('Bearer irrelevant.to.this.test');
  (context as unknown as { __request: Record<string, unknown> }).__request['principal'] = {
    sub: SUBJECT,
    // No `fam`, so the denylist is not consulted either — see the AC-10 cases below.
  };

  const sut = new JwtAuthGuard(reflector(), counting, denylist(), clock);
  assert.equal(await sut.canActivate(context as never), true);
  assert.equal(verifications, 0, 'the guard verified a token the middleware had already verified');
});

test('AC-10 · a revoked family is rejected even when the middleware resolved the principal', async () => {
  // The other side of the test above: trusting `request.principal` must NOT mean skipping the
  // denylist. Revocation has to reach an access token that is still perfectly well-signed, which
  // is the only reason AC-10 exists — otherwise "revoked" means "fails at the next refresh", and
  // a detected thief stays authenticated for the remaining fifteen minutes.
  const context = contextWith();
  (context as unknown as { __request: Record<string, unknown> }).__request['principal'] = {
    sub: SUBJECT,
    fam: 'family-under-revocation',
  };

  const sut = new JwtAuthGuard(reflector(), verifier, denylist(['family-under-revocation']), clock);
  await assert.rejects(() => sut.canActivate(context as never));
});

// ---------------------------------------------------------------------------
// The scaffold boundary — the second trap M-011 names.
// ---------------------------------------------------------------------------

test('the guard contains NO role or permission logic (SprintPlanning 0.21)', async () => {
  // A "temporary" role check here is how an authorisation control ends up implemented twice,
  // and two implementations of one security rule diverge — with the looser one deciding.
  // PermissionsGuard and the B3.2 matrix are M-023.
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const source = readFileSync(
    resolve(process.cwd(), 'src/common/guards/jwt-auth.guard.ts'),
    'utf8',
  );
  const executable = source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
    .join('\n');

  for (const forbidden of [
    'hasRole',
    'requiredPermission',
    'PermissionsGuard',
    'ForbiddenException',
  ]) {
    assert.ok(
      !executable.includes(forbidden),
      `JwtAuthGuard references "${forbidden}". It verifies tokens; it does not authorise.`,
    );
  }
});
