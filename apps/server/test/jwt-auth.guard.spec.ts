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

const guard = (isPublic = false) => new JwtAuthGuard(reflector(isPublic), verifier);

// ---------------------------------------------------------------------------
// Accept.
// ---------------------------------------------------------------------------

test('a well-formed token is accepted and the principal is attached', () => {
  const token = mintAccessToken({ sub: SUBJECT, tenantId: '01912f00-0000-7000-8000-00000000000a' });
  const context = contextWith(`Bearer ${token}`);

  assert.equal(guard().canActivate(context as never), true);

  const principal = (context as unknown as { __request: { principal?: { sub: string } } }).__request
    .principal;
  assert.equal(principal?.sub, SUBJECT);
});

test('a @Public() route needs no token at all', () => {
  assert.equal(guard(true).canActivate(contextWith() as never), true);
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
  test(`AC-7 · rejects a token that is ${name} — ${why}`, () => {
    assert.throws(
      () => guard().canActivate(contextWith(`Bearer ${token}`) as never),
      UnauthenticatedException,
    );
  });
}

test('AC-7 · every rejection is the SAME error body — no oracle', () => {
  // The assertion that matters. If these messages differed, an attacker could binary-search
  // their way to a valid token by watching which guess changed the response.
  const messages = new Set<string>();
  const codes = new Set<string>();

  for (const [, token] of REJECTIONS) {
    try {
      guard().canActivate(contextWith(`Bearer ${token}`) as never);
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

test('every rejection is a 401, never a 403', () => {
  // 403 means "authenticated, not allowed" — a different fact, and the client's next action
  // differs: re-authenticate versus give up.
  for (const [, token] of REJECTIONS) {
    try {
      guard().canActivate(contextWith(`Bearer ${token}`) as never);
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
  test(`rejects ${name}`, () => {
    assert.throws(
      () => guard().canActivate(contextWith(header) as never),
      UnauthenticatedException,
    );
  });
}

// ---------------------------------------------------------------------------
// The bearer parser.
// ---------------------------------------------------------------------------

test('extractBearerToken is case-insensitive on the scheme', () => {
  assert.equal(extractBearerToken('Bearer abc'), 'abc');
  assert.equal(extractBearerToken('bearer abc'), 'abc');
  assert.equal(extractBearerToken('BEARER abc'), 'abc');
});

test('extractBearerToken refuses anything that is not exactly one bearer token', () => {
  for (const header of ['', 'Basic abc', 'Bearer', 'Bearer ', 'Bearer a b', 'abc']) {
    assert.equal(extractBearerToken(header), null, `"${header}" should not parse`);
  }
  assert.equal(extractBearerToken(undefined), null);
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
