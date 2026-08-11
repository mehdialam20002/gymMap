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
import { CLOCK, type Clock } from '../clock/clock.port.js';

/** The claims a Sprint-0 access token carries. M-022 adds the rest. */
export interface AccessTokenClaims {
  /** The authenticated user. */
  readonly sub: string;
  /** The tenant this session is acting within. Absent for a platform-staff session. */
  readonly tenant_id?: string;
  readonly roles: readonly string[];
  /** `ACCESS` or `IMPERSONATION`. A refresh token presented here is rejected — see `typ` below. */
  readonly typ: string;
  /**
   * `M-025` · The AGENT — present on an `IMPERSONATION` token and on nothing else.
   *
   * `audit_log.impersonated_by`, and the reason a borrowed session is attributable at all.
   */
  readonly imp?: string;
  /**
   * The AGENT's role claims, alongside the subject's in `roles`.
   *
   * Both travel because `AC-5`'s intersection is not expressible as a role claim — no `§B3.2` role
   * has exactly those permissions — so `effectiveGrants()` computes it at the decision point.
   */
  readonly imp_roles?: readonly string[];
  /** Seconds. `AC-3`'s server-side re-check reads THIS, never `exp`. */
  readonly imp_at?: number;
  /**
   * M-022 · The token FAMILY, for the `AC-10` revocation denylist.
   *
   * Optional because tokens minted before M-022 — and the M-011 test harness — carry none. A
   * token without it simply cannot be revoked early, which is the pre-M-022 behaviour rather
   * than a new hole.
   */
  readonly fam?: string;
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
  /**
   * The clock is INJECTED, and REQUIRED — `AC-FND-13.3`.
   *
   * Expiry was checked against `Date.now()` until M-016, which made every token-lifetime
   * assertion untestable: proving a token expires after fifteen minutes meant either waiting
   * fifteen minutes or monkey-patching a global — and the monkey-patch leaks between suites, so
   * one spec's frozen clock changes another's result depending on the order they ran in.
   * `no-bare-date` caught it the first time the lint gate actually ran, in M-016.
   *
   * Required rather than optional-with-a-fallback. A default `() => new Date()` would put the
   * ambient clock back one level down, where nothing flags it, and every caller that forgot to
   * pass a clock would silently get the untestable behaviour back.
   */
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

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

    const now = Math.floor(this.clock.now().getTime() / 1000);

    if (typeof claims.exp !== 'number' || claims.exp <= now) throw new TokenRejected('expired');
    if (typeof claims.nbf === 'number' && claims.nbf > now) {
      throw new TokenRejected('not yet valid');
    }
    if (claims.iss !== TOKEN_ISSUER) throw new TokenRejected('wrong issuer');
    if (claims.aud !== TOKEN_AUDIENCE) throw new TokenRejected('wrong audience');

    /*
     * ── `typ` ─────────────────────────────────────────────────────────────────────────────
     *
     * A REFRESH token is signed with a different secret, so it would fail above anyway. The check
     * is here regardless, because the two secrets being different is a fact about M-022 that this
     * file should not depend on: if they were ever unified, a refresh token would otherwise become
     * a valid access token with a 30-day lifetime.
     *
     * ┌─ `IMPERSONATION` WAS REFUSED HERE UNTIL 2026-08-11, AND `TD-047` NAMES WHAT THAT COST ───┐
     * │ The route `Authentication.md` §8.15 requires be called **with** the impersonation token — │
     * │ `POST /auth/impersonate/end` — could not be called at all, because the global             │
     * │ `JwtAuthGuard` rejected the token on every route. Meanwhile `POST /auth/impersonate` still│
     * │ succeeded and wrote an `IMPERSONATE_START` audit row, so the log recorded sessions that   │
     * │ never happened and could never be ended.                                                   │
     * │                                                                                          │
     * │ **The order in which this was safe to lift is the whole of `TD-047`.** Accepting the type │
     * │ without `PermissionsGuard` bound would have handed the session the SUBJECT's full         │
     * │ permission set — the union-by-omission `AC-5` forbids — because nothing would have        │
     * │ narrowed it. `PermissionsGuard` was bound at `c9c851e` and calls `effectiveGrants()`,     │
     * │ which intersects the two role sets and returns NOTHING when the agent's are missing.      │
     * │ That is why this change comes second and not first.                                       │
     * └──────────────────────────────────────────────────────────────────────────────────────────┘
     */
    if (claims.typ !== 'ACCESS' && claims.typ !== 'IMPERSONATION') {
      throw new TokenRejected(`token type ${String(claims.typ)} refused`);
    }

    if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
      throw new TokenRejected('no subject');
    }

    if (claims.typ === 'IMPERSONATION') assertImpersonationClaims(claims);

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

/**
 * `M-025` · The three claims an `IMPERSONATION` token must carry, checked STRUCTURALLY.
 *
 * ┌─ A TRUNCATED CLAIM IS A REJECTED TOKEN, NOT A DEGRADED ONE ──────────────────────────────────┐
 * │ Every one of these has a downstream consumer that fails OPEN if it is missing, and each        │
 * │ failure is silent:                                                                             │
 * │                                                                                              │
 * │   `imp`        → `audit_log.impersonated_by` is `null`, so every action under the borrowed     │
 * │                  identity is indistinguishable from the subject's own. `AC-7` requires the     │
 * │                  agent on EVERY write, and an investigation would find exactly nothing.        │
 * │   `imp_roles`  → `effectiveGrants()` returns `[]` and the request is refused — that one is     │
 * │                  already fail-closed, and it is checked here anyway so the refusal is a 401    │
 * │                  naming a malformed token rather than a 403 that reads like a role problem.    │
 * │   `imp_at`     → `AC-3`'s server-side cap has nothing to re-check against, and the 30-minute   │
 * │                  limit collapses to whatever `exp` the signer happened to write. The whole     │
 * │                  point of `imp_at` is that a signer bug is not self-reporting.                  │
 * │                                                                                              │
 * │ Checking them at the verifier rather than at each consumer means a token that reaches any      │
 * │ handler is complete by construction, and there is one place to read to know that.              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `roles` is deliberately NOT required to be non-empty. A subject with no roles is a legitimate
 * thing to impersonate — a member who has just registered — and the intersection of their nothing
 * with the agent's something is correctly nothing.
 */
function assertImpersonationClaims(claims: AccessTokenClaims): void {
  if (typeof claims.imp !== 'string' || claims.imp.length === 0) {
    throw new TokenRejected('impersonation token carries no agent');
  }

  if (!Array.isArray(claims.imp_roles) || claims.imp_roles.length === 0) {
    throw new TokenRejected('impersonation token carries no agent roles');
  }

  // Element-wise, not just `Array.isArray`. `imp_roles: [null]` passes the array check and then
  // `parseRoleGrants` skips the entry, leaving an agent with zero grants — which `effectiveGrants`
  // treats as a forged token and refuses. Same outcome, and a 401 here says why.
  if (claims.imp_roles.some((role) => typeof role !== 'string' || role.length === 0)) {
    throw new TokenRejected('impersonation token has a malformed agent role');
  }

  if (typeof claims.imp_at !== 'number' || !Number.isFinite(claims.imp_at)) {
    throw new TokenRejected('impersonation token carries no start time');
  }

  /*
   * A start in the FUTURE is refused. `impersonationExpired()` computes elapsed minutes from it,
   * and a future start yields a negative elapsed time — which is never "expired", so a token
   * claiming to begin tomorrow would outlive the `AC-3` cap indefinitely.
   *
   * The comparison is against the token's own `iat` rather than the clock: the clock is already
   * used for `exp` above, and re-reading it here would let a token pass or fail on a difference of
   * milliseconds between two reads of the same instant.
   */
  if (typeof claims.iat === 'number' && claims.imp_at > claims.iat) {
    throw new TokenRejected('impersonation start is after the token was issued');
  }
}

/** Bearer, case-insensitive on the scheme, exactly one space. */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer (\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}
