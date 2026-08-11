/**
 * `M-023` · `PermissionsGuard` — `FR-RBAC-01`, `FR-RBAC-02`, `FR-RBAC-03`, `PG-1`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE GUARD `@RequiredPermission()` HAS BEEN WAITING FOR SINCE M-008
 *
 * That decorator writes metadata and puts the permission in the OpenAPI document. Until now
 * NOTHING read it at runtime — `api-gates.mjs` checked that every route declared one, which made
 * the declaration honest without making it *enforced*. `PlatformRoleGuard` was the interim answer
 * and `TD-034` records exactly how coarse it is: it admits any of the five platform roles and
 * cannot tell `FINANCE` from `MODERATOR`.
 *
 * This is the real thing, and it replaces role membership with `(role, scope, resource, action)`.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ AN UNDECLARED ROUTE IS DENIED, NOT ALLOWED ────────────────────────────────────────────────┐
 * │ `AC-5`. A handler with no `@RequiredPermission()` and no `@Public()` is refused, and refused  │
 * │ as a CONFIGURATION GAP: logged at `error` with the handler's name, answered to the caller as  │
 * │ a plain 403 with no detail.                                                                   │
 * │                                                                                              │
 * │ The alternative — allowing an undeclared route — is the failure mode that makes every future  │
 * │ endpoint open by default, and it is invisible because the endpoint works. `api-gates.mjs`     │
 * │ already fails the BUILD on one; this makes the runtime agree, so the two cannot disagree      │
 * │ about a route added after the gate last ran.                                                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 403 AND NOT 404, AND THE DISTINCTION FROM THE ISOLATION SUITE ─────────────────────────────┐
 * │ `A1` in the isolation suite requires a cross-tenant resource ID to answer **404**, byte for   │
 * │ byte identical to a nonexistent one — because 403 there would confirm the resource exists.    │
 * │                                                                                              │
 * │ That is `ResourceTenantGuard`'s job and it runs BEFORE this one: by the time this guard sees   │
 * │ a request, the resource is already known to be reachable. What this guard refuses is a         │
 * │ principal who may not perform this ACTION on a resource they can legitimately see — a         │
 * │ receptionist opening the plan editor for their own branch. The route's existence is public    │
 * │ (it is in the OpenAPI document), so 403 leaks nothing and a 404 would make a misconfigured    │
 * │ operator's failure impossible to diagnose.                                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { CanActivate, ExecutionContext, Injectable, Logger, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC } from '../decorators/public.decorator.js';
import { REQUIRED_PERMISSION } from '../decorators/required-permission.decorator.js';
import { PermissionDeniedException } from '../errors/domain-exception.js';
import {
  effectiveGrants,
  parseRoleGrants,
  permits,
  type ResourceContext,
} from '../../iam/domain/effective-permissions.js';

/**
 * Where the resource's tenant and branch come from, when the route acts on one.
 *
 * `ResourceTenantGuard` writes this onto the request before this guard reads it. A route that acts
 * on no particular resource — a list, a create — leaves it absent, and an absent context means the
 * decision falls back to the SESSION's tenant, which is what the tenant middleware already
 * established and what RLS will enforce underneath.
 */
export const RESOURCE_CONTEXT = 'gymmap:resource-context';

interface GuardedRequest {
  readonly principal?: {
    readonly sub: string;
    readonly roles?: readonly string[];
    /** `M-025`. Present only on an impersonation token; `effectiveGrants` reads both. */
    readonly typ?: string;
    readonly imp_roles?: readonly string[];
  };
  readonly [RESOURCE_CONTEXT]?: ResourceContext;
}

/**
 * Declares the resource a route acts on, so `ResourceTenantGuard` knows what to load.
 *
 * `param` is the route parameter holding the id. Absent means the route acts on a collection.
 */
export const ACTS_ON = 'gymmap:acts-on';
export const ActsOn = (resource: string, param = 'id') => SetMetadata(ACTS_ON, { resource, param });

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const controller = context.getClass();

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [handler, controller]) === true) {
      return true;
    }

    const permission = this.reflector.getAllAndOverride<string>(REQUIRED_PERMISSION, [
      handler,
      controller,
    ]);

    if (permission === undefined) {
      // A configuration gap, not a user error. Logged loudly with the handler name so it is
      // actionable, and answered blandly so it carries no information to the caller.
      this.logger.error(
        `${controller.name}.${handler.name} has neither @RequiredPermission() nor @Public(). ` +
          'Refusing by default (FR-RBAC-01, AC-5). This is a configuration gap: declare the ' +
          'permission the route needs, or mark it public deliberately.',
      );
      throw new PermissionDeniedException('This endpoint is not available.');
    }

    const request = context.switchToHttp().getRequest<GuardedRequest>();
    const principal = request.principal;

    if (principal === undefined) {
      // `JwtAuthGuard` runs first and would already have answered 401. Reaching here means the
      // guard ORDER is wrong, which is a wiring bug worth naming rather than silently allowing.
      this.logger.error(
        `${controller.name}.${handler.name} reached PermissionsGuard with no principal. ` +
          'JwtAuthGuard must run first — check the guard order in the module.',
      );
      throw new PermissionDeniedException('This endpoint is not available.');
    }

    /*
     * `effectiveGrants`, not `parseRoleGrants` — `M-025` `AC-5`.
     *
     * Identical for an ordinary token. Under an impersonation it removes anything the AGENT does
     * not themselves hold, which is the only place that narrowing can happen: the intersection is
     * not expressible as a role claim, so the token could not have carried it.
     */
    const grants = effectiveGrants(principal);
    // An absent resource context is the collection case. `tenantId: null` there would make every
    // TENANT-scoped grant fail, so the session's tenant is the resource — see the note on the
    // constant.
    const resource: ResourceContext = request[RESOURCE_CONTEXT] ?? {
      tenantId: currentSessionTenant(principal.roles),
      subjectUserId: principal.sub,
    };

    const decision = permits(permission, grants, resource, principal.sub);
    if (decision.allowed) return true;

    if (decision.reason === 'UNKNOWN_PERMISSION') {
      // The route names a permission the §B3.2 matrix does not contain. The caller did nothing
      // wrong and no role could ever satisfy it, so this pages an engineer.
      this.logger.error(
        `${controller.name}.${handler.name} requires "${permission}", which is not in the ` +
          'B3.2 matrix. No role can ever hold it, so this route is unreachable. Fix the ' +
          'declared permission or add the capability to the matrix.',
      );
      throw new PermissionDeniedException('This endpoint is not available.');
    }

    // `OUT_OF_SCOPE` and `NOT_GRANTED` are both a plain 403 to the caller and two different
    // incidents in the log: one is a tenancy or branch-assignment question, the other a role one.
    this.logger.warn(
      `Refused ${permission} for ${principal.sub}: ${decision.reason} ` +
        `(${controller.name}.${handler.name})`,
    );
    throw new PermissionDeniedException('You do not have permission to perform this action.');
  }
}

/**
 * The tenant a principal is acting within, from their own grants.
 *
 * ┌─ THIS IS A FALLBACK, NOT THE AUTHORITY ─────────────────────────────────────────────────────┐
 * │ `FR-RBAC-03` requires the decision to be made against the tenant ON THE RESOURCE. For a      │
 * │ collection route there is no resource yet, so the only tenant in play is the principal's —    │
 * │ and the repository layer scopes the query to it anyway via `app.tenant_id`, with RLS beneath. │
 * │                                                                                              │
 * │ Returning the FIRST tenant grant is correct because a token carries grants for one tenant at  │
 * │ a time: `tenant_id` is a single claim (`AccessTokenClaims`), and a principal who belongs to   │
 * │ two gyms gets two sessions. If that ever changes, this becomes ambiguous and must be revisited │
 * │ rather than quietly picking one.                                                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
function currentSessionTenant(roles: readonly string[] | undefined): string | null {
  for (const grant of parseRoleGrants(roles)) {
    if (grant.scope.kind === 'TENANT' || grant.scope.kind === 'BRANCH') return grant.scope.tenantId;
  }
  return null;
}
