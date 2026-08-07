/**
 * M-011 · `TenantGuard` — AC-5, BR2.
 *
 * Refuses a handler marked `@TenantScoped()` when the resolved context is `NONE`, BEFORE the
 * use case runs.
 *
 * ┌─ THIS IS BELT AND BRACES, AND BOTH ARE LOAD-BEARING ────────────────────────────────────────┐
 * │ The Prisma extension already throws `TENANT_CONTEXT_MISSING` when a tenant-scoped query is  │
 * │ attempted with no context, so this guard is not what makes the system safe.                 │
 * │                                                                                             │
 * │ It is what makes the failure HAPPEN EARLY. Without it, a handler with no context runs its   │
 * │ whole use case — validation, an external call, a cache write — and fails at the first       │
 * │ database read. Anything it did before that point has already happened, and some of it is    │
 * │ not undone by the request failing.                                                          │
 * │                                                                                             │
 * │ It also catches the handler that is tenant-scoped and never touches the database, which the │
 * │ extension by definition cannot see.                                                          │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * A 500, not a 403. The context is derived from the token; a caller cannot cause its absence,
 * so its absence is our defect (Security.md P3).
 */

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_TENANT_SCOPED } from '../../common/decorators/tenant-scoped.decorator.js';
import { currentTenantContext } from '../context/tenant-context.als.js';
import { MissingTenantContextError } from '../domain/tenancy.errors.js';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isTenantScoped = this.reflector.getAllAndOverride<boolean>(IS_TENANT_SCOPED, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isTenantScoped) return true;

    const resolved = currentTenantContext();

    // PLATFORM is permitted here. An admin reading across tenants is a legitimate way to reach a
    // `@TenantScoped()` handler — the elevation is audited (M-014) and the database restricts it
    // to SELECT through `app_platform_ro`, so the guard does not need to second-guess it.
    if (resolved.kind === 'NONE') {
      throw new MissingTenantContextError(context.getClass().name, context.getHandler().name);
    }

    return true;
  }
}
