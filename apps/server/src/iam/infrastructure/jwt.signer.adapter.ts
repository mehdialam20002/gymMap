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
   * Mints an impersonation token — `M-025`, `FR-AUTH-12`, `AC-1`, `AC-3`.
   *
   * ┌─ A DISTINCT `typ`, NOT A CLAIM ON AN ACCESS TOKEN ─────────────────────────────────────────┐
   * │ `AC-1` is specific: *"a distinct type, not a normal access token with a claim, so a          │
   * │ mis-scoped verifier cannot confuse the two"*. A boolean claim fails OPEN — any verifier that │
   * │ does not read it treats the token as ordinary access, and not reading it is the default      │
   * │ state of every verifier written before the claim existed. `typ: 'IMPERSONATION'` fails       │
   * │ CLOSED: a verifier expecting `ACCESS` rejects it outright, which is the same mechanism       │
   * │ `TK1` already uses to keep a refresh token off an API route.                                 │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   *
   * `roles` is the SUBJECT's and `imp_roles` is the AGENT's. Both travel because the intersection
   * cannot be written as a role claim — see `imp_roles` below — so it is computed by
   * `effectiveGrants()` at the point of decision, which keeps it derived from the matrix.
   *
   * `exp` is the cap, and it is not the only enforcement: `imp_at` carries the start so the server
   * can re-check independently. A token is evidence of what the signer believed, and `AC-3` asks
   * for a server-side check precisely because a signer bug or a moved clock is not self-reporting.
   */
  signImpersonationToken(input: {
    readonly subjectUserId: string;
    readonly impersonatorId: string;
    readonly tenantId: string | null;
    /** The SUBJECT's role claims. */
    readonly roles: readonly string[];
    /** The AGENT's role claims. The intersection is computed at the decision point. */
    readonly impersonatorRoles: readonly string[];
    readonly minutes: number;
    readonly familyId: string;
  }): { token: string; expiresAt: Date; startedAt: Date } {
    const startedAt = this.clock.now();
    const issuedAt = Math.floor(startedAt.getTime() / 1000);
    const expiresAt = issuedAt + input.minutes * 60;

    const payload = {
      // The SUBJECT, deliberately. Everything the request does is done as them, which is what
      // makes `impersonated_by` the interesting column rather than a duplicate of `sub`.
      sub: input.subjectUserId,
      ...(input.tenantId === null ? {} : { tenant_id: input.tenantId }),
      roles: [...input.roles],
      typ: 'IMPERSONATION',
      /** The agent. `audit_log.impersonated_by`, and the reason this token is attributable at all. */
      imp: input.impersonatorId,
      /**
       * The AGENT's roles, alongside the subject's in `roles`.
       *
       * Both are needed because `AC-5`'s intersection is not expressible as a role claim: measured
       * against the real matrix it is strictly narrower than the subject's permission set in every
       * combination, and no `§B3.2` role has exactly those permissions. Narrowing at mint time
       * would therefore have granted MORE than the intersection on every impersonation.
       */
      imp_roles: [...input.impersonatorRoles],
      /** The start, in seconds. `AC-3`'s server-side re-check reads this, never `exp`. */
      imp_at: issuedAt,
      fam: input.familyId,
      iss: TOKEN_ISSUER,
      aud: TOKEN_AUDIENCE,
      iat: issuedAt,
      exp: expiresAt,
    };

    return {
      // Signed with the ACCESS secret, because it is presented on API routes exactly like one and
      // the verifier that reads it is the same. `typ` is what separates them, per TK1.
      token: this.sign(payload, this.config.JWT_ACCESS_SECRET),
      expiresAt: new Date(expiresAt * 1000),
      startedAt,
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
