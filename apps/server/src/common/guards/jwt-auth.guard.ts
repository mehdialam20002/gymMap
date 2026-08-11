/**
 * M-011 · `JwtAuthGuard` — the sole REJECTER. A Sprint-0 scaffold.
 *
 * ┌─ WHAT THIS GUARD MUST NEVER GROW INTO ──────────────────────────────────────────────────────┐
 * │ It answers exactly one question: is this token one we issued, unexpired, and of type ACCESS? │
 * │                                                                                              │
 * │ It does NOT answer "may this principal do this". `PermissionsGuard` and the B3.2 matrix are  │
 * │ M-023, and SprintPlanning.md task 0.21 names this a scaffold precisely because the tempting  │
 * │ next step — "just check the role here, it is two lines" — is how an authorisation control    │
 * │ ends up implemented twice. Two implementations of one security rule diverge, and the         │
 * │ divergence is discovered by whoever the looser one lets through.                             │
 * │                                                                                              │
 * │ Issuance, refresh rotation, MFA and impersonation are M-020 … M-025. This file rejects.      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE VERIFICATION ITSELF MOVED TO `AccessTokenVerifier` IN M-015 ───────────────────────────┐
 * │ `TenantContextMiddleware` also needs the claims, because it must enter the tenant ALS frame │
 * │ around `next()` and middleware runs BEFORE guards. Before M-015 it read `request.principal`  │
 * │ — which this guard had not set yet — so it was always undefined and every @TenantScoped()    │
 * │ route returned 500. See the verifier's header for the full account.                          │
 * │                                                                                              │
 * │ The middleware RESOLVES and never rejects. This guard REJECTS and is the only thing that     │
 * │ does, so `AC-7`'s single error shape still comes from one place.                             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `AC-7`: every rejection is `401 UNAUTHENTICATED` with NO detail about which check failed.
 * "Expired" versus "bad signature" versus "wrong audience" tells an attacker which of their
 * guesses was closest, and turns token forgery into a game with feedback.
 */

import { CanActivate, ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { FamilyDenylist } from '../auth/family-denylist.redis.js';
import { UnauthenticatedException } from '../errors/domain-exception.js';
import { IS_PUBLIC } from '../decorators/public.decorator.js';
import {
  AccessTokenVerifier,
  TokenRejected,
  extractBearerToken,
  type AccessTokenClaims,
} from '../auth/access-token.verifier.js';
import { CLOCK, type Clock } from '../clock/clock.port.js';
import { impersonationExpired } from '../../iam/domain/impersonation.policy.js';

export interface AuthenticatedRequest extends Request {
  principal?: AccessTokenClaims;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: AccessTokenVerifier,
    private readonly denylist: FamilyDenylist,
    /*
     * Injected, and required — `AC-FND-13.3`, the same rule `AccessTokenVerifier` states at
     * length. `AC-3`'s cap is thirty minutes, and proving a session expires after thirty minutes
     * against `Date.now()` means either waiting thirty minutes or monkey-patching a global that
     * leaks between suites.
     */
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // The middleware has usually resolved this already. Re-verifying would be wasted work AND a
    // second place where "what counts as a valid token" is decided — so the principal is trusted
    // here precisely because the SAME verifier put it there, on this request, moments ago.
    if (!request.principal) {
      const token = extractBearerToken(request.headers.authorization);
      if (!token) throw new UnauthenticatedException('No bearer token presented.');

      try {
        request.principal = this.verifier.verify(token);
      } catch (error) {
        throw this.reject(error instanceof TokenRejected ? error.reason : 'verification failed');
      }
    }

    // ┌─ M-022 `AC-10` · REVOCATION THAT REACHES AN ALREADY-ISSUED TOKEN ─────────────────────┐
    // │ Everything above is pure signature verification, which is why it is fast enough to    │
    // │ run on every request — and why a revoked session's access token keeps verifying for   │
    // │ the rest of its fifteen minutes.                                                       │
    // │                                                                                        │
    // │ Without this lookup, "revoked" means "the next refresh fails", and a token thief whose │
    // │ family we have just detected and revoked stays authenticated for a quarter of an hour  │
    // │ AFTER detection. `AC-10` says that is not revocation.                                  │
    // │                                                                                        │
    // │ One Redis `EXISTS` against a list that holds only families revoked in the last fifteen │
    // │ minutes — small by construction, because the TTL equals the token lifetime. It fails   │
    // │ OPEN: see `family-denylist.redis.ts` for why signing out the entire platform because a │
    // │ cache restarted is the worse of the two failures.                                      │
    // └────────────────────────────────────────────────────────────────────────────────────────┘
    const family = request.principal.fam;
    if (family !== undefined && (await this.denylist.isRevoked(family))) {
      throw this.reject('the token family has been revoked');
    }

    /*
     * ┌─ `M-025` `AC-3` · THE THIRTY-MINUTE CAP, RE-CHECKED AGAINST `imp_at` AND NOT `exp` ──────┐
     * │ `exp` is already enforced by the verifier, and enforcing only `exp` would mean trusting   │
     * │ the signer. A token is evidence of what the signer BELIEVED: a signer bug, a redeployment │
     * │ with a different `IMPERSONATION_MAX_MINUTES`, or a clock that moved between mint and use  │
     * │ all produce a well-formed token with an `exp` further out than the policy allows, and     │
     * │ none of them is self-reporting.                                                            │
     * │                                                                                          │
     * │ `impersonationExpired()` is the same pure function `start-impersonation.use-case.ts`      │
     * │ bounds the mint with, so the two cannot disagree about what thirty minutes means.          │
     * │                                                                                          │
     * │ In the GUARD rather than the middleware, deliberately. The middleware may not reject —    │
     * │ it cannot read `@Public()` and would 401 a public route — and `AC-7` requires ONE          │
     * │ rejection shape from ONE place. This file is that place.                                   │
     * └──────────────────────────────────────────────────────────────────────────────────────────┘
     */
    const startedAtSeconds = request.principal.imp_at;
    if (
      request.principal.typ === 'IMPERSONATION' &&
      typeof startedAtSeconds === 'number' &&
      impersonationExpired(new Date(startedAtSeconds * 1000), this.clock.now())
    ) {
      throw this.reject('the impersonation session has passed its thirty-minute cap');
    }

    return true;
  }

  /**
   * One error shape for every rejection.
   *
   * The REASON goes to the log, keyed by correlation id; the CLIENT gets `UNAUTHENTICATED` and
   * nothing else. Telling a caller that their token is "expired" rather than "badly signed"
   * confirms they had a real token, and distinguishing "wrong audience" from "wrong issuer"
   * turns forgery into a guessing game with feedback.
   */
  private reject(reason: string): UnauthenticatedException {
    this.logger.warn({ message: 'token rejected', reason });
    return new UnauthenticatedException('The access token is not valid.');
  }
}

// Re-exported so M-011's call sites and specs keep working. The definitions live in
// `common/auth/access-token.verifier.ts`, which both the guard and the middleware import.
export {
  extractBearerToken,
  TOKEN_ISSUER,
  TOKEN_AUDIENCE,
  type AccessTokenClaims,
} from '../auth/access-token.verifier.js';
