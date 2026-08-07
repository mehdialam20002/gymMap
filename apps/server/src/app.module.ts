/**
 * M-004 · The composition root. M-010/M-011 add `TenancyModule` and the request-scope chain.
 *
 * Imports `CommonModule` and `TenancyModule` only. The remaining twenty-one module directories
 * of §C1.3 are wired in by their own milestones — an empty module imported early is a module
 * whose boundaries nobody has had to think about yet.
 */

import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { AuditModule } from './audit/audit.module.js';
import { CommonModule } from './common/common.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { AuditInterceptor } from './common/interceptors/audit.interceptor.js';
import { TenancyModule } from './tenancy/tenancy.module.js';
import { TenantContextMiddleware } from './tenancy/context/tenant-context.middleware.js';
import { TenantGuard } from './tenancy/guards/tenant.guard.js';

@Module({
  imports: [CommonModule, TenancyModule, AuditModule],
  providers: [
    // ── Global guards, in order ────────────────────────────────────────────────────────────
    //
    // Registered globally rather than per-controller, and the direction matters: a global guard
    // is opt-OUT (`@Public()`), a per-controller one is opt-IN. Opt-in means the route somebody
    // forgets to annotate is the route with no authentication — and it looks exactly like every
    // other route in the diff. `api-gates` PG-1 catches that in CI; this makes it safe by
    // default at runtime too, which is the belt to PG-1's braces.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },

    // Global, so an @Audited() handler cannot be added without the interceptor seeing it.
    // Per-controller registration would make coverage depend on remembering two things.
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // ── The one ordering decision in this file ─────────────────────────────────────────────
    //
    // `TenantContextMiddleware` runs on EVERY route, including the probes, because its first
    // job is refusing a client-supplied tenant id — and a caller sending `X-Tenant-Id` to
    // `/healthz` is doing the same thing as one sending it to `/v1/tenant/members`.
    //
    // Middleware, not a guard. Middleware runs before guards, pipes and interceptors, so the
    // AsyncLocalStorage frame is established before validation — which means a 400 from the Zod
    // pipe, the single most common thing anyone debugs, already carries the tenant and the
    // correlation id (AC-FND-09.5). A guard would put the frame after the error.
    //
    // KNOWN GAP, recorded rather than papered over: the middleware reads `request.principal`,
    // which `JwtAuthGuard` sets — and guards run AFTER middleware, so at Sprint 0 the principal
    // is not yet populated when the middleware runs. The tenant therefore resolves to NONE for
    // every request, and every tenant-scoped operation correctly throws.
    //
    // That is the safe direction to be wrong in, and it is temporary: M-022 replaces the
    // scaffold guard with token verification INSIDE this middleware, where it belongs, so the
    // principal exists before the context is resolved. Until then the only routes that work are
    // the untenanted ones, which is exactly what Sprint 0 has.
    consumer.apply(TenantContextMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
