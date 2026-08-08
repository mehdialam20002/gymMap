/**
 * M-022 · Signing an access token — ADR-0011, `TK1`, `TK7`, `NFR-SEC-07`.
 *
 * ┌─ THE MIRROR OF `AccessTokenVerifier`, AND THAT IS DELIBERATE ───────────────────────────────┐
 * │ M-015 built the verifier and it is the only thing that reads a token. This signs one, using │
 * │ the same issuer, audience, algorithm and `typ` discipline — so a token this class produces  │
 * │ is one that class accepts, and `jwt-roundtrip.spec.ts` asserts exactly that.                 │
 * │                                                                                              │
 * │ Two separate classes rather than one, because the verifier runs on EVERY request and the    │
 * │ signer runs on login and refresh only. Merging them would put the signing key in the        │
 * │ request path's object graph, where a mistaken log of `this` would print it.                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ `family_id` IS IN THE ACCESS TOKEN, AND IT IS WHAT MAKES REVOCATION REAL — `AC-10` ────────┐
 * │ An access token is self-contained: the API verifies a signature and does not look anything  │
 * │ up, which is the whole reason it is fast. It is also why revoking a session does nothing to │
 * │ the access tokens already issued — they keep verifying for the rest of their fifteen        │
 * │ minutes, so "revoked" would mean "the next refresh fails" and a detected thief would stay   │
 * │ authenticated for a quarter of an hour after detection.                                      │
 * │                                                                                              │
 * │ Carrying `fam` lets the guard check one short-lived Redis denylist keyed on the family.     │
 * │ One lookup, TTL'd to the access-token lifetime, so the list can never grow.                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../../common/config/app-config.schema.js';
import { CLOCK, type Clock } from '../../common/clock/clock.port.js';
import { TOKEN_AUDIENCE, TOKEN_ISSUER } from '../../common/auth/access-token.verifier.js';
import { ACCESS_TOKEN_TTL_SECONDS } from '../../common/auth/token-lifetimes.js';

const base64url = (value: string | Buffer): string => Buffer.from(value).toString('base64url');

export interface AccessTokenInput {
  readonly userId: string;
  readonly tenantId: string | null;
  readonly roles: readonly string[];
  /** The token family, for the `AC-10` denylist. */
  readonly familyId: string;
}

@Injectable()
export class JwtSignerAdapter {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Mints a 15-minute HS256 access token. */
  signAccessToken(input: AccessTokenInput): { token: string; expiresAt: Date } {
    const issuedAt = Math.floor(this.clock.now().getTime() / 1000);
    const expiresAt = issuedAt + ACCESS_TOKEN_TTL_SECONDS;

    const payload = {
      sub: input.userId,
      ...(input.tenantId === null ? {} : { tenant_id: input.tenantId }),
      roles: [...input.roles],
      // `TK1`. A REFRESH token presented to an API route must be refused, and the only thing
      // that distinguishes them once both are signed strings is this claim plus the key.
      typ: 'ACCESS',
      fam: input.familyId,
      iss: TOKEN_ISSUER,
      aud: TOKEN_AUDIENCE,
      iat: issuedAt,
      exp: expiresAt,
    };

    return {
      token: this.sign(payload, this.config.JWT_ACCESS_SECRET),
      expiresAt: new Date(expiresAt * 1000),
    };
  }

  /**
   * Constant-time HMAC comparison, for anything that must compare two signatures in process.
   *
   * `===` on a MAC leaks its prefix through the comparison's early exit — enough to forge a
   * signature one byte at a time, given enough attempts.
   */
  static signaturesMatch(a: string, b: string): boolean {
    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b, 'utf8');
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }

  private sign(payload: object, secret: string): string {
    // `alg` is pinned to HS256 here and pinned again in the verifier. The classic forgery is a
    // token with `alg: none` and an empty signature; a verifier that reads the algorithm OUT of
    // the header has already let the attacker choose it.
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64url(JSON.stringify(payload));
    const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
  }
}
