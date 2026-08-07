/**
 * M-010 · `TenantId` inside the server — constitution §9.5 B2.
 *
 * `packages/types` already brands `TenantId`. This file exists because the SERVER needs a
 * validating constructor at the one boundary where a tenant id enters the process: the JWT
 * claim. A plain string is how isolation bugs are written — `setTenantContext(user.id)` compiles
 * perfectly, and the mistake is invisible until someone reads another tenant's data.
 *
 * The brand comes from `packages/types` rather than being redeclared, so a `TenantId` minted
 * here is the same type the repositories and DTOs already speak.
 */

import { tenantId as brandTenantId, isUuid, type TenantId } from '@gymmap/types';

export type { TenantId };

/**
 * Constructs a `TenantId` from a token claim.
 *
 * Deliberately separate from `packages/types`' constructor even though it delegates to it: the
 * failure MESSAGE has to be different. A malformed id from a URL is a client's mistake and gets
 * `VALIDATION_FAILED`; a malformed id from our own signed token is a defect in token issuance,
 * and treating it as user error sends the investigation to the wrong place entirely.
 */
export function tenantIdFromClaim(raw: unknown): TenantId {
  if (typeof raw !== 'string' || !isUuid(raw)) {
    throw new TypeError(
      'The access token carried a tenant_context claim that is not a UUID. This is a token-' +
        'issuance defect, not a client error — nothing a caller sends can change the claim in a ' +
        'signed token. Investigate the issuer (M-022), not the request.',
    );
  }
  return brandTenantId(raw);
}

export { brandTenantId as tenantId };
