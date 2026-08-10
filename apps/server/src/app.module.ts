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
import { CatalogModule } from './catalog/catalog.module.js';
import { CommonModule } from './common/common.module.js';
import { IamModule } from './iam/iam.module.js';
import { AdminModule } from './admin/index.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { PlatformRoleGuard } from './common/guards/platform-role.guard.js';
import { PermissionsGuard } from './common/guards/permissions.guard.js';
import { AuditInterceptor } from './common/interceptors/audit.interceptor.js';
import { TenancyModule } from './tenancy/tenancy.module.js';
import { TenantContextMiddleware } from './tenancy/context/tenant-context.middleware.js';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor.js';
import { TenantGuard } from './tenancy/guards/tenant.guard.js';

@Module({
  /*
   * M-020 adds `IamModule` — the first module with a consumer, which is this file's standing rule
   * for when a module gets wired in. The remaining §C1.3 directories arrive with their milestones.
   *
   * ┌─ `CatalogModule` WAS BUILT, TESTED AND NOT IMPORTED HERE FOR THREE COMMITS ────────────────┐
   * │ `catalog-wiring.spec.ts` boots the module in isolation and passed throughout, which is what │
   * │ made it invisible: the module's DI graph was provably sound and the application never       │
   * │ constructed it. `TD-045` is the same failure one layer up — four guards built, unit-tested  │
   * │ and registered nowhere — and the lesson transferred badly, because the guard version was    │
   * │ caught by a test asserting REGISTRATION while this one was only ever asserted in isolation. │
   * │                                                                                            │
   * │ Added 2026-08-11 with the five branch routes, whose absence from the route table is what    │
   * │ surfaced it. `catalog-routes-mapped.spec.ts` now asserts against THIS module.                │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  imports: [CommonModule, TenancyModule, AuditModule, IamModule, AdminModule, CatalogModule],
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
    // AFTER JwtAuthGuard, which is what puts `principal` on the request. Nest runs global
    // guards in registration order, so reversing these two would make every admin route
    // 403 for an authenticated operator whose principal had not been resolved yet.
    { provide: APP_GUARD, useClass: PlatformRoleGuard },

    /*
     * ┌─ `PermissionsGuard` IS BOUND, AND UNTIL TODAY IT COULD NOT BE — `TD-045` ──────────────────┐
     * │ `FR-RBAC-01` and `FR-RBAC-02` require every endpoint's permission to be enforced           │
     * │ server-side. `M-023` built this guard, unit tested it, exported it from the barrel — and   │
     * │ registered it NOWHERE, so the 540-cell matrix governed nothing at runtime. `PHASES.md`     │
     * │ claimed it was "registered per route"; it was not registered at all.                        │
     * │                                                                                            │
     * │ It could not simply be added. `permits()` refuses anything outside `PERMISSION_KEYS` as    │
     * │ `UNKNOWN_PERMISSION`, and SEVEN declared route keys sat outside it — so binding this would │
     * │ have 403'd every authenticated route in the application. Resolving those seven, in order,  │
     * │ is what this commit's predecessors did:                                                     │
     * │                                                                                            │
     * │   `admin.platform_overview.read` · `admin.gym_register.read`  → `§B3.2` rows 44, 45 (owner)│
     * │   `iam.impersonation.manage`                                  → the two strings the         │
     * │                                                                 catalogue actually freezes  │
     * │   `iam.session.list` · `.revoke` · `iam.mfa.*`                → `SELF_SERVICE_PERMISSIONS`  │
     * │   `tenancy.ping.read`                                         → `SCOPED_NON_MATRIX_…`      │
     * │                                                                                            │
     * │ AFTER `PlatformRoleGuard` and after `JwtAuthGuard`, per `Security.md`'s fixed pipeline —    │
     * │ *"not a matter of taste; each stage assumes the previous one ran"*. This one assumes        │
     * │ `principal` is on the request, which `JwtAuthGuard` puts there.                             │
     * │                                                                                            │
     * │ **`MfaGuard` is deliberately NOT bound here.** Every one of the eleven seeded principals    │
     * │ has `password_hash` NULL, and enrolment re-authenticates against that hash — so binding the │
     * │ mandate today locks every platform account out of every route with no path back in. That   │
     * │ is `TD-045`'s remaining half and it needs the seed fixed first.                             │
     * └────────────────────────────────────────────────────────────────────────────────────────────┘
     */
    { provide: APP_GUARD, useClass: PermissionsGuard },

    // ── Interceptor ORDER matters, and this is the order ──────────────────────────────────
    //
    // Nest runs global interceptors in registration order, outermost first. Idempotency must
    // wrap the audit interceptor, not the other way round:
    //
    //   idempotency OUTSIDE   a replayed request never reaches the handler, so it writes no
    //                         second audit row for work that did not happen again
    //   audit OUTSIDE         every replay would be audited as a fresh action, and the log
    //                         would show twenty approvals where one occurred
    //
    // BR-PAY-03 and BR-DAT-01 agree here: the audit log records what HAPPENED, and a replay is
    // not a second happening.
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },

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
    // M-011's KNOWN GAP is DISCHARGED, brought forward from M-022 by M-015.
    //
    // The gap was: the middleware read `request.principal`, which `JwtAuthGuard` sets, and
    // guards run AFTER middleware — so the principal was never populated and every
    // tenant-scoped route resolved to NONE. It was recorded as safe-but-temporary, and it was.
    // M-015's generated suite needs a WORKING tenant-scoped endpoint to assert isolation
    // against, so the fix could not wait: `AccessTokenVerifier` was extracted and the
    // middleware now resolves the principal itself. The guard remains the sole rejecter.
    //
    // ┌─ `'*'`, NOT `'*path'` — AND THIS ONE WAS A REAL DEFECT ────────────────────────────┐
    // │ `'*path'` is Express 5 / path-to-regexp v8 syntax. Nest 10 runs Express 4, where    │
    // │ that pattern matches NOTHING — so this middleware never executed on any request.    │
    // │                                                                                      │
    // │ Two controls were silently absent, not merely degraded:                              │
    // │                                                                                      │
    // │   the tenant frame was never opened, so @TenantScoped() routes 500'd — which looked  │
    // │   exactly like the known gap above and hid it                                        │
    // │                                                                                      │
    // │   `X-Tenant-Id` was never REFUSED. AC-1's control against a client choosing its own  │
    // │   tenant had never run in a real request. Its 29 unit tests instantiate the          │
    // │   middleware class directly, so they passed throughout.                              │
    // │                                                                                      │
    // │ `CommonModule` two files away uses `.forRoutes('*')` and worked. The mismatch is why │
    // │ `middleware-registration.int-spec.ts` now asserts over HTTP that this middleware     │
    // │ actually runs — a registration that matches nothing is invisible to every unit test. │
    // └──────────────────────────────────────────────────────────────────────────────────────┘
    consumer.apply(TenantContextMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
