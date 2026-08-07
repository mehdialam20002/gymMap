/** M-011 · The guards `common/` exposes. Verification only — authorisation is M-023. */
export {
  JwtAuthGuard,
  extractBearerToken,
  TOKEN_ISSUER,
  TOKEN_AUDIENCE,
  type AccessTokenClaims,
  type AuthenticatedRequest,
} from './jwt-auth.guard.js';
