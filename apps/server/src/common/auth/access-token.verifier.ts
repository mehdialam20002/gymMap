/**
 * M-015 · The ONE access-token verifier. Extracted from `JwtAuthGuard`, which now calls it.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS MOVED OUT OF THE GUARD — AND IT IS NOT A TIDY-UP
 *
 * Nest's pipeline is:  middleware → guards → interceptors → pipes → handler
 *
 * `TenantContextMiddleware` must enter the tenant `AsyncLocalStorage` frame around `next()`, so
 * that the frame wraps the ENTIRE downstream pipeline including the handler. A guard cannot do
 * that: `canActivate` returns, and the handler runs afterwards, outside any `run()` callback it
 * opened.
 *
 * But the tenant comes from the token, and the token was verified in a GUARD — which runs AFTER
 * the middleware. So `request.principal` was always `undefined` at middleware time, the context
 * was always NONE, and EVERY `@TenantScoped()` route answered
 *
 *     500 TENANT_CONTEXT_MISSING
 *
 * `GET /v1/tenant/ping` — the Sprint-0 exit-condition endpoint, the one M-012 was meant to prove
 * end to end — had never worked over HTTP. Nothing caught it because M-012's isolation spec
 * asserted at the Prisma level and never made a request. M-015's generated suite made the first
 * one and failed on A4, the positive control, exactly as A4 exists to do.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ THE MIDDLEWARE RESOLVES; THE GUARD REJECTS. ONE VERIFIER, TWO CALLERS, ONE AUTHORITY ──────┐
 * │ `tryVerify` returns `null` on any failure and NEVER throws. The middleware uses it to learn  │
 * │ the tenant, and a bad token simply leaves the context as NONE.                               │
 * │                                                                                              │
 * │ That matters for two reasons. `@Public()` lives on the handler, which middleware cannot      │
 * │ read through the reflector — a middleware that rejected a bad token would 401 a public route │
 * │ that never needed one. And `AC-7` requires ONE rejection shape from ONE place; two           │
 * │ components producing 401s is how they drift into leaking which check failed.                 │
 * │                                                                                              │
 * │ So the guard keeps its authority. It calls `verify`, which throws, and it is still the only  │
 * │ thing in the system that turns a bad token into a response.                                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../config/app-config.schema.js';

/** The claims a Sprint-0 access token carries. M-022 adds the rest. */
export interface AccessTokenClaims {
  /** The authenticated user. */
  readonly sub: string;
  /** The tenant this session is acting within. Absent for a platform-staff session. */
  readonly tenant_id?: string;
  readonly roles: readonly string[];
  /** `ACCESS`. A refresh token presented here is rejected — see the note on `typ` below. */
  readonly typ: string;
  readonly iss: string;
  readonly aud: string;
  readonly exp: number;
  readonly nbf?: number;
  readonly iat?: number;
}

export const TOKEN_ISSUER = 'gymmap';
export const TOKEN_AUDIENCE = 'gymmap-api';

/** Why a token was refused. Goes to the LOG, keyed by correlation id — never to the client. */
export class TokenRejected extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = 'TokenRejected';
    this.reason = reason;
  }
}

@Injectable()
export class AccessTokenVerifier {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /**
   * Verifies and returns the claims, or throws `TokenRejected` naming the reason.
   *
   * The caller decides what the client is told. `JwtAuthGuard` turns every reason into one
   * `UNAUTHENTICATED` response, because "expired" versus "bad signature" versus "wrong audience"
   * tells an attacker which of their guesses was closest, and turns forgery into a game with
   * feedback (`AC-7`).
   */
  verify(token: string): AccessTokenClaims {
    const parts = token.split('.');
    if (parts.length !== 3) throw new TokenRejected('malformed token');

    const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];

    // ── The algorithm check comes FIRST, before anything else is trusted ──────────────────
    //
    // `alg: none` is the classic JWT forgery: a token with an empty signature and a header
    // claiming no algorithm is required. A verifier that reads the header to decide HOW to
    // verify has already let the attacker choose. This accepts exactly one algorithm and
    // rejects any header naming another, before the payload is parsed at all.
    let header: { alg?: string; typ?: string };
    try {
      header = JSON.parse(
        Buffer.from(encodedHeader, 'base64url').toString('utf8'),
      ) as typeof header;
    } catch {
      throw new TokenRejected('unparseable header');
    }
    if (header.alg !== 'HS256') throw new TokenRejected(`algorithm ${String(header.alg)} refused`);

    // ── Signature ─────────────────────────────────────────────────────────────────────────
    const expected = createHmac('sha256', this.config.JWT_ACCESS_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();
    const presented = Buffer.from(encodedSignature, 'base64url');

    // `timingSafeEqual` throws on a length mismatch, so the lengths are compared first — and
    // the comparison is constant-time because a byte-by-byte `===` leaks how many leading
    // bytes were right, which is enough to forge a signature one byte at a time.
    if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
      throw new TokenRejected('signature mismatch');
    }

    let claims: AccessTokenClaims;
    try {
      claims = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as AccessTokenClaims;
    } catch {
      throw new TokenRejected('unparseable payload');
    }

    const now = Math.floor(Date.now() / 1000);

    if (typeof claims.exp !== 'number' || claims.exp <= now) throw new TokenRejected('expired');
    if (typeof claims.nbf === 'number' && claims.nbf > now) {
      throw new TokenRejected('not yet valid');
    }
    if (claims.iss !== TOKEN_ISSUER) throw new TokenRejected('wrong issuer');
    if (claims.aud !== TOKEN_AUDIENCE) throw new TokenRejected('wrong audience');

    // ── `typ` ─────────────────────────────────────────────────────────────────────────────
    //
    // A REFRESH token is signed with a different secret, so it would fail above anyway. The
    // check is here regardless, because the two secrets being different is a fact about M-022
    // that this file should not depend on: if they were ever unified, a refresh token would
    // otherwise become a valid access token with a 30-day lifetime.
    if (claims.typ !== 'ACCESS')
      throw new TokenRejected(`token type ${String(claims.typ)} refused`);

    if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
      throw new TokenRejected('no subject');
    }

    return claims;
  }

  /**
   * Verification for a caller that must not reject — the middleware.
   *
   * Returns `null` on ANY failure. Deliberately not "returns the claims if the signature is
   * valid but skip the expiry check", which is the shortcut that would let an expired token
   * still establish a tenant context: the request would then be rejected by the guard a
   * microsecond later, but anything the middleware did in between — a log line, an audit row —
   * would carry a tenant derived from a token the system does not accept.
   *
   * Same verification, same rules. The only difference is what happens on failure.
   */
  tryVerify(token: string | null | undefined): AccessTokenClaims | null {
    if (!token) return null;
    try {
      return this.verify(token);
    } catch {
      return null;
    }
  }
}

/** Bearer, case-insensitive on the scheme, exactly one space. */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer (\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}
