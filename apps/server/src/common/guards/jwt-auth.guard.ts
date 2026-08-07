/**
 * M-011 · `JwtAuthGuard` — VERIFICATION ONLY. A Sprint-0 scaffold.
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
 * │ Issuance, refresh rotation, MFA and impersonation are M-020 … M-025. This file verifies.     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `AC-7`: every rejection is `401 UNAUTHENTICATED` with NO detail about which check failed.
 * "Expired" versus "bad signature" versus "wrong audience" tells an attacker which of their
 * guesses was closest, and turns token forgery into a game with feedback.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import { CanActivate, ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { APP_CONFIG, type AppConfig } from '../config/app-config.schema.js';
import { UnauthenticatedException } from '../errors/domain-exception.js';
import { IS_PUBLIC } from '../decorators/public.decorator.js';

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

export interface AuthenticatedRequest extends Request {
  principal?: AccessTokenClaims;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) throw new UnauthenticatedException('No bearer token presented.');

    const claims = this.verify(token);
    request.principal = claims;
    return true;
  }

  /**
   * Verifies the token and returns its claims, or throws.
   *
   * HS256 for Sprint 0. The QR signing path uses EdDSA (A-11) and M-022 moves session tokens to
   * asymmetric keys so the verifier never holds material that can also SIGN — which matters the
   * moment more than one service verifies. Recorded rather than left as an assumption.
   */
  private verify(token: string): AccessTokenClaims {
    const parts = token.split('.');
    if (parts.length !== 3) throw this.reject('malformed token');

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
      throw this.reject('unparseable header');
    }
    if (header.alg !== 'HS256') throw this.reject(`algorithm ${String(header.alg)} refused`);

    // ── Signature ─────────────────────────────────────────────────────────────────────────
    const expected = createHmac('sha256', this.config.JWT_ACCESS_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();
    const presented = Buffer.from(encodedSignature, 'base64url');

    // `timingSafeEqual` throws on a length mismatch, so the lengths are compared first — and
    // the comparison is constant-time because a byte-by-byte `===` leaks how many leading
    // bytes were right, which is enough to forge a signature one byte at a time.
    if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
      throw this.reject('signature mismatch');
    }

    let claims: AccessTokenClaims;
    try {
      claims = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as AccessTokenClaims;
    } catch {
      throw this.reject('unparseable payload');
    }

    const now = Math.floor(Date.now() / 1000);

    if (typeof claims.exp !== 'number' || claims.exp <= now) throw this.reject('expired');
    if (typeof claims.nbf === 'number' && claims.nbf > now) throw this.reject('not yet valid');
    if (claims.iss !== TOKEN_ISSUER) throw this.reject('wrong issuer');
    if (claims.aud !== TOKEN_AUDIENCE) throw this.reject('wrong audience');

    // ── `typ` ─────────────────────────────────────────────────────────────────────────────
    //
    // A REFRESH token is signed with a different secret, so it would fail above anyway. The
    // check is here regardless, because the two secrets being different is a fact about M-022
    // that this file should not depend on: if they were ever unified, a refresh token would
    // otherwise become a valid access token with a 30-day lifetime.
    if (claims.typ !== 'ACCESS') throw this.reject(`token type ${String(claims.typ)} refused`);

    if (typeof claims.sub !== 'string' || claims.sub.length === 0) throw this.reject('no subject');

    return claims;
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

/** Bearer, case-insensitive on the scheme, exactly one space. */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer (\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export const TOKEN_ISSUER = 'gymmap';
export const TOKEN_AUDIENCE = 'gymmap-api';
