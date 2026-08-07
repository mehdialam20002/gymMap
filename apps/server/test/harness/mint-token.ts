/**
 * M-011 · The test-only token minter — AC-8.
 *
 * ┌─ THIS FILE MUST NEVER BE REACHABLE FROM `src/` ─────────────────────────────────────────────┐
 * │ It SIGNS access tokens. Anything in application code that can call it can mint a token for  │
 * │ any tenant and any role — which is every authorisation control in the system, bypassed by   │
 * │ one import.                                                                                  │
 * │                                                                                             │
 * │ `dependency-cruiser`'s `no-test-harness-in-src` rule fails the build on an import of        │
 * │ `test/harness/` from `apps/server/src/`. The rule is the enforcement; living under `test/`  │
 * │ is only a convention, and conventions do not survive a refactor at 6pm.                     │
 * │                                                                                             │
 * │ Real issuance — rotation, MFA, the refresh family, revocation — is M-022. This mints the    │
 * │ minimum the isolation suite needs to authenticate as somebody.                              │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { createHmac } from 'node:crypto';

/** Must match `JwtAuthGuard`. Imported rather than restated would be better; see the note below. */
const TOKEN_ISSUER = 'gymmap';
const TOKEN_AUDIENCE = 'gymmap-api';

export interface MintOptions {
  readonly sub: string;
  readonly tenantId?: string;
  readonly roles?: readonly string[];
  /** Seconds from now. Negative mints an already-expired token, for the rejection cases. */
  readonly expiresInSeconds?: number;
  readonly notBeforeSeconds?: number;
  readonly typ?: string;
  readonly issuer?: string;
  readonly audience?: string;
  /** Signing key. A different one produces a token this API must reject. */
  readonly secret?: string;
  /** `none` mints the classic forgery, so the guard can be proved to refuse it. */
  readonly algorithm?: 'HS256' | 'none';
}

const base64url = (value: string | Buffer): string => Buffer.from(value).toString('base64url');

/**
 * Mints a Sprint-0 access token.
 *
 * Deliberately capable of producing INVALID tokens — expired, wrong key, wrong audience,
 * `alg: none`. A minter that can only produce valid tokens cannot test a verifier: every
 * rejection case would have to be hand-assembled at the call site, and the hand-assembly is
 * where a test stops resembling a real request.
 */
export function mintAccessToken(options: MintOptions): string {
  const now = Math.floor(Date.now() / 1000);
  const algorithm = options.algorithm ?? 'HS256';

  const header = { alg: algorithm, typ: 'JWT' };
  const payload = {
    sub: options.sub,
    ...(options.tenantId ? { tenant_id: options.tenantId } : {}),
    roles: options.roles ?? [],
    typ: options.typ ?? 'ACCESS',
    iss: options.issuer ?? TOKEN_ISSUER,
    aud: options.audience ?? TOKEN_AUDIENCE,
    iat: now,
    exp: now + (options.expiresInSeconds ?? 900),
    ...(options.notBeforeSeconds === undefined ? {} : { nbf: now + options.notBeforeSeconds }),
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));

  // `alg: none` carries an EMPTY signature. That is the whole forgery: a verifier that reads
  // the header to decide how to verify accepts it, because "none" means "nothing to check".
  if (algorithm === 'none') return `${encodedHeader}.${encodedPayload}.`;

  const secret = options.secret ?? testSecret();
  const signature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * The signing key the suite uses.
 *
 * Reads `JWT_ACCESS_SECRET` when set so an integration test can authenticate against a server
 * booted from the real environment; otherwise a fixed local value, so a unit test needs no
 * environment at all. 48 characters because the config schema's `requiredSecret` refuses
 * anything shorter — a test key that would not pass validation cannot exercise the real path.
 */
export function testSecret(): string {
  return process.env['JWT_ACCESS_SECRET'] ?? 'test-only-signing-key-not-a-real-secret-00000000';
}

/**
 * The four rejection cases of AC-7, as named fixtures.
 *
 * Named rather than assembled inline at each call site: a test that says
 * `mintAccessToken({ ..., expiresInSeconds: -60 })` requires the reader to work out what is
 * being tested, and one that says `EXPIRED` does not.
 */
export const REJECTION_FIXTURES = {
  /** `alg: none` with an empty signature. */
  unsigned: (sub: string) => mintAccessToken({ sub, algorithm: 'none' }),
  /** Correctly formed, signed with a key we do not hold. */
  wrongKey: (sub: string) =>
    mintAccessToken({ sub, secret: 'a-completely-different-key-000000000000000000000' }),
  /** Valid in every respect except that it expired a minute ago. */
  expired: (sub: string) => mintAccessToken({ sub, expiresInSeconds: -60 }),
  /** A refresh token presented on the access path. */
  wrongType: (sub: string) => mintAccessToken({ sub, typ: 'REFRESH' }),
  /** Issued for a different audience — another deployment of this API. */
  wrongAudience: (sub: string) => mintAccessToken({ sub, audience: 'someone-elses-api' }),
  /** Not valid until a minute from now. */
  notYetValid: (sub: string) => mintAccessToken({ sub, notBeforeSeconds: 60 }),
} as const;
