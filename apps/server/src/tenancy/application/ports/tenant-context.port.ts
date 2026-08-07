/**
 * M-010 · `TENANT_CONTEXT_PORT` — what other modules may ask about the current tenant.
 *
 * A port rather than the ALS functions directly, so a consumer can be tested with a stub
 * instead of an AsyncLocalStorage frame. §9.5 D4: dependencies are ports.
 *
 * There is deliberately no `setTenantContext` on this port. Establishing scope is the
 * middleware's job (M-011) and the elevation's (M-014); a module that could set its own scope
 * could set someone else's.
 */

import type { TenantId } from '@gymmap/types';

export interface TenantContextPort {
  /** The current tenant, or `null` under platform or no scope. */
  currentTenantId(): TenantId | null;
  /** True only inside an audited elevation. */
  isElevated(): boolean;
}

export const TENANT_CONTEXT_PORT = Symbol('TenantContextPort');
