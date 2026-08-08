/**
 * The guards `common/` exposes.
 *
 * `JwtAuthGuard` answers "is this a token we issued" and nothing else. `PlatformRoleGuard` is a
 * deliberately coarse interim gate on `/v1/admin/*` — the full `§B3.2` evaluation is M-023, and
 * the guard's own header explains why a quarter of it was not built here under another name.
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
