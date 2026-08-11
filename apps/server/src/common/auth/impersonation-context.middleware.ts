/**
 * `M-025` · Opens the impersonation `AsyncLocalStorage` frame for the request — `AC-7`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * `runAsImpersonator` HAD NO PRODUCTION CALLER. THIS FILE IS IT.
 *
 * `impersonation.als.ts` shipped at `M-025` with its unit tests, and nothing in the running
 * application ever entered the frame — so `currentImpersonatorId()` returned `null` on every
 * request and `audit_log.impersonated_by` was `null` on every row, including the rows written
 * under a borrowed identity. `AC-7` asks for the agent on EVERY write; it was on none.
 *
 * That is the same shape as `TD-045` (four guards built and registered nowhere) and as
 * `CatalogModule` (a module that resolved and was never imported). The lesson each time is that a
 * unit test proves a thing WORKS and cannot prove anything CALLS it.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ MIDDLEWARE, AND NOT A GUARD OR AN INTERCEPTOR ──────────────────────────────────────────────┐
 * │ Nest runs middleware → guards → interceptors → pipes → handler. `runAsImpersonator(ctx, fn)`  │
 * │ must WRAP everything downstream, and only middleware can: a guard's `canActivate` returns     │
 * │ before the handler runs, so a frame it opened is already closed by the time anything writes   │
 * │ an audit row.                                                                                  │
 * │                                                                                              │
 * │ `TenantContextMiddleware` states the same reasoning for the same reason, and it learned it    │
 * │ the expensive way — every `@TenantScoped()` route answered 500 until `M-015`.                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ IT RESOLVES AND NEVER REJECTS ──────────────────────────────────────────────────────────────┐
 * │ `tryVerify` returns `null` on any failure. An expired or forged impersonation token simply    │
 * │ opens no frame here, and `JwtAuthGuard` refuses it a moment later — from the one place that   │
 * │ refuses, which is what `AC-7`'s single error shape requires.                                   │
 * │                                                                                              │
 * │ Note what that means for the thirty-minute cap: an expired session's request DOES open a      │
 * │ frame (the token still verifies; only `AC-3`'s policy check fails), and is then rejected by   │
 * │ the guard. The frame is opened and nothing is written under it. That is the safe order — the  │
 * │ alternative, skipping the frame for a token the guard will reject anyway, would mean any      │
 * │ future code path that runs before the guard writes an unattributed row.                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { AccessTokenVerifier, extractBearerToken } from './access-token.verifier.js';
import { runAsImpersonator } from './impersonation.als.js';

@Injectable()
export class ImpersonationContextMiddleware implements NestMiddleware {
  constructor(private readonly verifier: AccessTokenVerifier) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    const claims = this.verifier.tryVerify(extractBearerToken(request.headers.authorization));

    /*
     * Every field is re-checked here even though `assertImpersonationClaims` in the verifier has
     * already refused a token missing any of them.
     *
     * Not defensive duplication — a type narrowing. `imp`, `imp_at` and `typ` are optional on
     * `AccessTokenClaims` because an ordinary access token carries none of them, so the compiler
     * cannot know they are present merely because `typ === 'IMPERSONATION'`. Reading them with
     * `!` would compile and would also survive somebody relaxing the verifier.
     */
    if (
      claims?.typ !== 'IMPERSONATION' ||
      typeof claims.imp !== 'string' ||
      typeof claims.imp_at !== 'number'
    ) {
      next();
      return;
    }

    runAsImpersonator(
      {
        impersonatorId: claims.imp,
        subjectUserId: claims.sub,
        // Seconds on the wire, a `Date` in the domain. `AC-3`'s re-check reads THIS, not `exp`.
        startedAt: new Date(claims.imp_at * 1000),
      },
      () => {
        next();
      },
    );
  }
}
