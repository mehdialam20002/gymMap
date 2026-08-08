/**
 * The guards `common/` exposes.
 *
 * `JwtAuthGuard` answers "is this a token we issued" and nothing else. `PlatformRoleGuard` is a
 * deliberately coarse interim gate on `/v1/admin/*` — `TD-034` records how coarse.
 *
 * `M-023` adds the real pair. `ResourceTenantGuard` loads the resource's tenant and answers 404 for
 * one that does not exist FOR THIS PRINCIPAL; `PermissionsGuard` then decides
 * `(role, scope, resource, action)` against what was loaded and answers 403. Two guards because
 * "what does this id belong to" and "may this principal act on it" have different failure codes,
 * and merging them is how one of the two answers gets lost.
 */
export {
  JwtAuthGuard,
  extractBearerToken,
  TOKEN_ISSUER,
  TOKEN_AUDIENCE,
  type AccessTokenClaims,
  type AuthenticatedRequest,
} from './jwt-auth.guard.js';

export {
  PlatformRoleGuard,
  PlatformOnly,
  PLATFORM_ONLY,
  holdsPlatformRole,
} from './platform-role.guard.js';

export { PermissionsGuard, ActsOn, ACTS_ON, RESOURCE_CONTEXT } from './permissions.guard.js';

export {
  ResourceTenantGuard,
  RESOURCE_LOCATOR,
  type ResourceLocator,
} from './resource-tenant.guard.js';
