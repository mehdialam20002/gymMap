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

import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { UnauthenticatedException } from '../errors/domain-exception.js';
import { IS_PUBLIC } from '../decorators/public.decorator.js';
import {
  AccessTokenVerifier,
  TokenRejected,
  extractBearerToken,
  type AccessTokenClaims,
} from '../auth/access-token.verifier.js';

export interface AuthenticatedRequest extends Request {
  principal?: AccessTokenClaims;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: AccessTokenVerifier,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // The middleware has usually resolved this already. Re-verifying would be wasted work AND a
    // second place where "what counts as a valid token" is decided — so the principal is trusted
    // here precisely because the SAME verifier put it there, on this request, moments ago.
    if (request.principal) return true;

    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new UnauthenticatedException('No bearer token presented.');

    try {
      request.principal = this.verifier.verify(token);
    } catch (error) {
      throw this.reject(error instanceof TokenRejected ? error.reason : 'verification failed');
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
