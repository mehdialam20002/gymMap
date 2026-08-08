/**
 * `M-023` · `ResourceTenantGuard` — the resource's tenant, loaded BEFORE the decision.
 *
 * `FR-RBAC-03`, `E1.6`, and assertion `A1` of the isolation suite.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 404, NOT 403, AND THE DIFFERENCE IS THE WHOLE POINT
 *
 * `PermissionsGuard` answers 403: *you may not do this*. This guard answers **404**: *there is no
 * such thing*. They look interchangeable and they are not.
 *
 *   403 on a cross-tenant id  →  "that gym exists, you just cannot see it"
 *   404 on a cross-tenant id  →  indistinguishable from an id that never existed
 *
 * The first is an enumeration oracle: walk ids, collect 403s, and you have a list of every gym on
 * the platform without ever reading one. `A1` therefore requires the response to be **byte
 * identical** to a genuinely nonexistent id, which is why this guard runs before the permission
 * check and why it must not add a helpful message.
 *
 * `PermissionsGuard`'s 403 is for a resource the principal can legitimately SEE — a receptionist
 * opening the plan editor for their own branch. Different question, different answer.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ THIS GUARD IS A LOADER, NOT AN AUTHORISER ─────────────────────────────────────────────────┐
 * │ It resolves the resource's tenant and branch and puts them on the request. It refuses only in │
 * │ one case — the resource does not exist FOR THIS PRINCIPAL — and that refusal is a 404 that     │
 * │ carries no information.                                                                       │
 * │                                                                                              │
 * │ Everything else is `PermissionsGuard`'s decision, made against what this guard loaded. Two     │
 * │ guards rather than one because "what does this id belong to" and "may this principal act on   │
 * │ it" are different questions with different failure codes, and merging them is how one of the   │
 * │ two answers gets lost.                                                                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { CanActivate, ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { NotFoundException } from '../errors/domain-exception.js';
import { ACTS_ON, RESOURCE_CONTEXT } from './permissions.guard.js';
import type { ResourceContext } from '../../iam/domain/effective-permissions.js';

/** What `@ActsOn()` declares. */
interface ActsOnMetadata {
  readonly resource: string;
  readonly param: string;
}

/**
 * How a module tells this guard where a resource lives.
 *
 * ┌─ A PORT, SO `common/` NEVER IMPORTS A MODULE'S REPOSITORY ───────────────────────────────────┐
 * │ `FolderStructure.md` keeps `common/` free of domain dependencies. A guard that imported the    │
 * │ catalog repository to look up a gym would make the shared kernel depend on a feature module,   │
 * │ and the next resource type would add a second import, and the one after a third.               │
 * │                                                                                              │
 * │ Each module registers its own locator instead. The guard knows only "given a type and an id,   │
 * │ tell me the tenant" — which is also what makes it testable with a map.                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export interface ResourceLocator {
  /**
   * The tenant and branch the resource belongs to, or `null` if there is no such resource.
   *
   * `null` and "belongs to another tenant" must be INDISTINGUISHABLE here, which means the
   * implementation reads through the tenant-scoped client — the same path a normal read takes, with
   * RLS beneath it. A locator that queried with an elevated client and then compared tenants would
   * work, and would also be the one place in the system where a cross-tenant row was fetched into
   * memory before being rejected.
   */
  find(resource: string, id: string): Promise<ResourceContext | null>;
}

export const RESOURCE_LOCATOR = Symbol('ResourceLocator');

@Injectable()
export class ResourceTenantGuard implements CanActivate {
  private readonly logger = new Logger(ResourceTenantGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(RESOURCE_LOCATOR) private readonly locator: ResourceLocator,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const declared = this.reflector.getAllAndOverride<ActsOnMetadata>(ACTS_ON, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No `@ActsOn()` means the route acts on a collection rather than one resource. Nothing to
    // load, and `PermissionsGuard` falls back to the session's tenant — which the repository layer
    // scopes to anyway.
    if (declared === undefined) return true;

    const request = context.switchToHttp().getRequest<{
      params?: Record<string, string | undefined>;
      [RESOURCE_CONTEXT]?: ResourceContext;
    }>();

    const id = request.params?.[declared.param];
    if (id === undefined || id === '') {
      // The route declared a parameter it does not have. A wiring error, and answering 404 would
      // hide it — so it is logged and refused as one.
      this.logger.error(
        `${context.getClass().name}.${context.getHandler().name} declares @ActsOn(` +
          `'${declared.resource}', '${declared.param}') but the request has no such route ` +
          'parameter. Check the path template against the decorator.',
      );
      throw new NotFoundException('Not found.');
    }

    const resource = await this.locator.find(declared.resource, id);

    if (resource === null) {
      // ONE message for both "no such id" and "another tenant's id". See the header: any difference
      // between the two, including a different message or a different latency profile, is an
      // enumeration oracle.
      throw new NotFoundException('Not found.');
    }

    // Written onto the request for `PermissionsGuard`, which runs next and decides against it.
    (request as Record<string, unknown>)[RESOURCE_CONTEXT] = resource;
    return true;
  }
}
