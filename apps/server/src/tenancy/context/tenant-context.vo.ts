/**
 * M-010 · The tenant context — a DISCRIMINATED UNION, §9.4.
 *
 * Three states, and the union is what makes them exhaustive:
 *
 *   NONE      no tenant. An unauthenticated request, or a job that has not entered a scope.
 *             A tenant-scoped query here THROWS.
 *   TENANT    a specific tenant. Every query runs with `app.tenant_id` set to it.
 *   PLATFORM  a named, reasoned, audited elevation (M-014 runElevated). Reads across tenants
 *             under `app_platform_ro`, which is SELECT-only at the database level.
 *
 * ┌─ WHY A UNION AND NOT `tenantId: string | null` ─────────────────────────────────────────────┐
 * │ With a nullable field, "no tenant" and "platform scope" are both `null`, and the ONE        │
 * │ question the extension has to answer — may this query cross tenants? — becomes unanswerable │
 * │ from the value. Someone then adds `isPlatform: boolean` beside it, and now two fields       │
 * │ encode one fact and can contradict each other: `{ tenantId: 'abc', isPlatform: true }` is   │
 * │ representable and means nothing.                                                            │
 * │                                                                                             │
 * │ A union makes the contradiction unrepresentable, and `assertNever` makes forgetting to      │
 * │ handle a new kind a COMPILE error rather than a fall-through to the default branch —        │
 * │ which, in this file, would be the permissive one.                                           │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import type { TenantId } from '@gymmap/types';

export interface NoTenantContext {
  readonly kind: 'NONE';
}

export interface TenantScopedContext {
  readonly kind: 'TENANT';
  readonly tenantId: TenantId;
  /** The authenticated principal, for `created_by`/`updated_by` and the audit row. */
  // `| undefined` explicitly: exactOptionalPropertyTypes distinguishes "absent" from
  // "present and undefined", and `tenantScoped()` passes the parameter through either way.
  readonly actorId?: string | undefined;
}

export interface PlatformContext {
  readonly kind: 'PLATFORM';
  /**
   * Why this elevation happened, in words, recorded on the audit row.
   *
   * Mandatory and non-empty. A cross-tenant read with no stated reason is indistinguishable
   * from an unauthorised one after the fact — the audit trail would show that someone looked,
   * and nothing about whether they should have.
   */
  readonly reason: string;
  readonly actorId: string;
}

export type TenantContext = NoTenantContext | TenantScopedContext | PlatformContext;

export const NO_TENANT: NoTenantContext = Object.freeze({ kind: 'NONE' });

export function tenantScoped(tenantId: TenantId, actorId?: string): TenantScopedContext {
  return Object.freeze({ kind: 'TENANT', tenantId, actorId });
}

export function platformScoped(actorId: string, reason: string): PlatformContext {
  const trimmed = reason.trim();
  if (trimmed.length < 8) {
    throw new TypeError(
      'A platform elevation requires a stated reason of at least 8 characters. "admin", "fix" ' +
        'and "" are not reasons — the audit row exists so that a cross-tenant read can be ' +
        'judged later, and it cannot be judged from a placeholder.',
    );
  }
  return Object.freeze({ kind: 'PLATFORM', actorId, reason: trimmed });
}

/** True when the context may read across tenants. Only `PLATFORM` may. */
export function isPlatformScope(context: TenantContext): context is PlatformContext {
  return context.kind === 'PLATFORM';
}

export function isTenantScope(context: TenantContext): context is TenantScopedContext {
  return context.kind === 'TENANT';
}

/**
 * Compile-time exhaustiveness. §9.6.
 *
 * When a fourth context kind is added, every switch that does not handle it fails to compile.
 * Without this the compiler is silent and the omission surfaces at runtime as the default
 * branch — which in a tenancy switch is the branch that decides whether to scope a query.
 */
export function assertNeverContext(value: never, where: string): never {
  throw new TypeError(`${where}: unhandled tenant context ${JSON.stringify(value)}`);
}
