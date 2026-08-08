/**
 * `@PlatformOnly()` — the narrow authorisation gate for `/v1/admin/*`, pending `M-023`.
 *
 * ┌─ WHAT THIS IS, AND HONESTLY WHAT IT IS NOT ─────────────────────────────────────────────────┐
 * │ It is NOT `PermissionsGuard`. That is `M-023`: the 516-cell `§B3.2` matrix as data, a        │
 * │ generated test per cell, branch-scope resolution, the resource-tenant guard and a cache with │
 * │ explicit invalidation. None of that exists yet, and building a quarter of it here under a    │
 * │ different name would be the worst outcome — a second authorisation implementation that       │
 * │ diverges from the first, with the looser one deciding who gets in.                            │
 * │                                                                                              │
 * │ What it IS: a single coarse check that the caller holds a PLATFORM-scoped role. That is a    │
 * │ real control, not a placeholder. Without it, `/v1/admin/*` would be gated on authentication  │
 * │ alone, and any member who registered on the customer website could read the tenant register  │
 * │ of every gym on the platform. `@RequiredPermission()` does not close that: it is metadata     │
 * │ read by the `PG-1` gate, and it enforces nothing at runtime until `M-023` lands.              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ COARSE ON PURPOSE, AND THE DIRECTION OF THE ERROR MATTERS ─────────────────────────────────┐
 * │ It does not distinguish `FINANCE` from `MODERATOR`. `§B3.2` does, and `M-023` will enforce   │
 * │ it. Until then this guard is deliberately STRICTER than the eventual matrix in one direction │
 * │ (nobody outside the platform roles gets in at all) and LOOSER within it (a `SUPPORT_AGENT`   │
 * │ can read the gym register, which the matrix may not permit).                                 │
 * │                                                                                              │
 * │ That trade is stated rather than hidden, and it is recorded in `TECH_DEBT.md` as `TD-034`    │
 * │ with `M-023` as the payoff trigger. The alternative — no gate at all until M-023 — leaves    │
 * │ cross-tenant reads open to every registered account, which is not a defensible interim.      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionDeniedException } from '../errors/domain-exception.js';

export const PLATFORM_ONLY = 'gymmap:platform-only';

/** Marks a route as reachable only by a principal holding a PLATFORM-scoped role. */
export const PlatformOnly = () => applyDecorators(SetMetadata(PLATFORM_ONLY, true));

/**
 * The five `§B3.1` platform roles.
 *
 * A closed list rather than "anything ending in `@platform`". A role scope is assembled from data
 * in the `roles` table, and a row inserted with `scope = 'PLATFORM'` would otherwise grant admin
 * access by database write alone — the exact move an attacker with a foothold in one table makes.
 */
const PLATFORM_ROLES = new Set([
  'SUPER_ADMIN',
  'VERIFICATION_OFFICER',
  'SUPPORT_AGENT',
  'FINANCE',
  'MODERATOR',
]);

/**
 * `roleScopesFor()` emits `KEY@platform` for a platform grant and `KEY@t:<uuid>` for a
 * tenant-scoped one. Only the first form counts here, so a `GYM_OWNER` at one gym cannot reach
 * a route that reads across all of them.
 */
export function holdsPlatformRole(roles: readonly string[] | undefined): boolean {
  if (roles === undefined) return false;

  return roles.some((scoped) => {
    const [key, scope] = scoped.split('@');
    return scope === 'platform' && key !== undefined && PLATFORM_ROLES.has(key);
  });
}

interface Principal {
  readonly sub: string;
  readonly roles?: readonly string[];
}

@Injectable()
export class PlatformRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(PLATFORM_ONLY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required !== true) return true;

    const request = context.switchToHttp().getRequest<{ principal?: Principal }>();
    const principal = request.principal;

    // 403 and not 404. The route's EXISTENCE is not a secret — it is in the published OpenAPI
    // document — so hiding it would protect nothing while making a misconfigured operator's
    // failure impossible to diagnose. What must not leak is data, and none does.
    if (principal === undefined || !holdsPlatformRole(principal.roles)) {
      throw new PermissionDeniedException('This endpoint is restricted to platform staff.');
    }

    return true;
  }
}
