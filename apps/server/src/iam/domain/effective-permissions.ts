/**
 * `M-023` · Resolving what a principal may actually do — `FR-RBAC-02`, `FR-RBAC-03`, `§B3.1`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * A PERMISSION IS NEVER ENOUGH ON ITS OWN. IT IS ALWAYS `(permission, SCOPE)`
 *
 * `FR-RBAC-02` says authorisation is `(role, scope, resource, action)` and **never role alone**.
 * The trap is subtler than it sounds, because a naive implementation gets the ROLE half right and
 * silently drops the SCOPE half:
 *
 *   A `GYM_OWNER` at gym A holds `catalog.plan.write`. So does a `GYM_OWNER` at gym B.
 *   Checking "does this principal hold catalog.plan.write" answers YES for both, on either gym.
 *
 * That check passes every unit test written against a single tenant and is a total tenancy
 * failure the moment there are two. `BR-TEN-01` is the invariant it breaks, and RLS in the
 * database is the backstop rather than the control — the API must refuse first, and must refuse
 * with the right status.
 *
 * So a grant here is a permission PLUS the scope it was granted in, and `permits()` needs the
 * resource's own tenant and branch before it can answer.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ DENY BY DEFAULT, AND SAY WHICH KIND OF NO IT IS ───────────────────────────────────────────┐
 * │ `AC-5` requires a resource/action pair absent from the matrix to be refused, and refused as a │
 * │ CONFIGURATION GAP rather than as a user error. The two are different incidents: one is an     │
 * │ operator who should not be there, the other is an endpoint somebody forgot to declare. They   │
 * │ are logged differently and they page differently, so `permits()` returns a reason rather      │
 * │ than a boolean.                                                                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { PERMISSION_KEYS, permissionsFor } from '../permissions.js';
import type { PlatformRole } from '../types/iam.types.js';
import { ROLE_DEFINITIONS } from '../permissions.js';

/**
 * The scope a role was granted in, parsed from the token's `roles` claim.
 *
 * `KEY@platform` is a platform grant; `KEY@t:<uuid>` is tenant-scoped; `KEY@b:<uuid>` is
 * branch-scoped. `SELF` needs no identifier — it is always the principal's own `sub`.
 */
export type GrantScope =
  | { readonly kind: 'PLATFORM' }
  | { readonly kind: 'TENANT'; readonly tenantId: string }
  | { readonly kind: 'BRANCH'; readonly tenantId: string; readonly branchId: string }
  | { readonly kind: 'SELF' };

export interface RoleGrant {
  readonly role: PlatformRole;
  readonly scope: GrantScope;
}

/** What the resource being acted on belongs to. Loaded BEFORE the decision — `FR-RBAC-03`. */
export interface ResourceContext {
  /** `null` for a resource that belongs to no tenant: a global reference table, a public listing. */
  readonly tenantId: string | null;
  readonly branchId?: string | null;
  /** The user the resource is ABOUT, for `SELF`-scoped grants. */
  readonly subjectUserId?: string | null;
}

export type Decision =
  | { readonly allowed: true; readonly via: RoleGrant }
  /** The principal holds the permission but not in a scope that reaches this resource. */
  | { readonly allowed: false; readonly reason: 'OUT_OF_SCOPE' }
  /** No role the principal holds carries this permission at all. */
  | { readonly allowed: false; readonly reason: 'NOT_GRANTED' }
  /**
   * The permission is not in the matrix. NOT the caller's fault.
   *
   * A route declaring `catalog.plan.edit` when the matrix says `catalog.plan.write` produces this,
   * and it must page an engineer rather than showing an operator "you are not allowed".
   */
  | { readonly allowed: false; readonly reason: 'UNKNOWN_PERMISSION' };

const KNOWN_PERMISSIONS = new Set(PERMISSION_KEYS);
const ROLE_SCOPE = new Map(ROLE_DEFINITIONS.map((role) => [role.key, role.scope]));
const ROLE_KEYS = new Set(ROLE_DEFINITIONS.map((role) => role.key));

/**
 * Parses one `roles` claim entry.
 *
 * Returns `null` for anything unrecognised, and that is deliberate: a token carrying
 * `SUPER_ADMIN@` or `ADMIN@platform` must contribute NOTHING rather than throwing. Throwing here
 * would turn a malformed claim into a 500, which tells an attacker that the string reached the
 * parser; contributing nothing produces a clean 403 with no signal in it.
 */
export function parseRoleGrant(claim: string): RoleGrant | null {
  const [key, scope] = claim.split('@');
  if (key === undefined || scope === undefined) return null;
  if (!ROLE_KEYS.has(key as PlatformRole)) return null;

  const role = key as PlatformRole;
  const declared = ROLE_SCOPE.get(role);

  if (scope === 'platform') {
    // A PLATFORM grant on a role §B3.1 does not scope to the platform is a forged or stale token.
    // `GYM_OWNER@platform` would otherwise read every tenant on the estate.
    return declared === 'PLATFORM' ? { role, scope: { kind: 'PLATFORM' } } : null;
  }

  if (scope === 'self') {
    return declared === 'SELF' || declared === 'PUBLIC' ? { role, scope: { kind: 'SELF' } } : null;
  }

  if (scope.startsWith('t:')) {
    const tenantId = scope.slice(2);
    if (tenantId === '') return null;
    // TENANT and BRANCH roles may both appear tenant-scoped: a manager with no branch assignment
    // yet is tenant-wide-but-unassigned, which §B3.1 treats as the tenant scope.
    return declared === 'TENANT' || declared === 'BRANCH'
      ? { role, scope: { kind: 'TENANT', tenantId } }
      : null;
  }

  if (scope.startsWith('b:')) {
    // `b:<tenant>:<branch>` — the tenant is carried too, because a branch id alone would make a
    // branch grant portable between tenants if two ever collided.
    const [, tenantId, branchId] = scope.split(':');
    if (tenantId === undefined || branchId === undefined || branchId === '') return null;
    return declared === 'BRANCH'
      ? { role, scope: { kind: 'BRANCH', tenantId, branchId } }
      : null;
  }

  return null;
}

/** Every well-formed grant in the claim. Malformed entries are dropped, not fatal. */
export function parseRoleGrants(claims: readonly string[] | undefined): readonly RoleGrant[] {
  if (claims === undefined) return [];
  return claims.map(parseRoleGrant).filter((grant): grant is RoleGrant => grant !== null);
}

/** Does this grant's scope reach this resource? */
function scopeReaches(grant: RoleGrant, resource: ResourceContext, principalId: string): boolean {
  switch (grant.scope.kind) {
    case 'PLATFORM':
      // Reaches everything, which is exactly why `runElevated()` exists to make the READ auditable
      // rather than to make it possible. Authorisation and audit are separate obligations.
      return true;

    case 'TENANT':
      return resource.tenantId !== null && resource.tenantId === grant.scope.tenantId;

    case 'BRANCH': {
      if (resource.tenantId === null || resource.tenantId !== grant.scope.tenantId) return false;
      // A resource with no branch is tenant-level. A BRANCH-scoped role does NOT reach it: a
      // receptionist at one branch editing the tenant's commission rate is the escalation this
      // line prevents, and `null` is the case a `===` comparison would accidentally allow.
      if (resource.branchId === null || resource.branchId === undefined) return false;
      return resource.branchId === grant.scope.branchId;
    }

    case 'SELF':
      // Only the principal's own record. `subjectUserId` absent means the resource is not about a
      // user at all, so a SELF grant cannot reach it.
      return (
        resource.subjectUserId !== null &&
        resource.subjectUserId !== undefined &&
        resource.subjectUserId === principalId
      );
  }
}

/**
 * The decision. Both halves, in order: the matrix, then the scope.
 *
 * ┌─ WHY THE ORDER MATTERS FOR THE REASON, NOT FOR THE ANSWER ──────────────────────────────────┐
 * │ Checking scope first would report `OUT_OF_SCOPE` for a principal who never held the           │
 * │ permission at all, and those two produce different investigations: one is a tenancy bug, the  │
 * │ other is a role assignment. The ANSWER is the same; the incident is not.                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function permits(
  permission: string,
  grants: readonly RoleGrant[],
  resource: ResourceContext,
  principalId: string,
): Decision {
  if (!KNOWN_PERMISSIONS.has(permission)) {
    return { allowed: false, reason: 'UNKNOWN_PERMISSION' };
  }

  const holding = grants.filter((grant) => permissionsFor(grant.role).includes(permission));
  if (holding.length === 0) return { allowed: false, reason: 'NOT_GRANTED' };

  const reaching = holding.find((grant) => scopeReaches(grant, resource, principalId));
  if (reaching === undefined) return { allowed: false, reason: 'OUT_OF_SCOPE' };

  return { allowed: true, via: reaching };
}

/**
 * Every permission a principal effectively holds, with the scope each came from — `FR-RBAC-05`.
 *
 * For the effective-permission inspector, and for the console to decide which controls to SHOW.
 * Showing is all it decides: `§B3.2` is explicit that a hidden menu item is not an authorisation
 * control, and every one of these keys is checked again server-side on the request itself.
 */
export function effectivePermissions(
  grants: readonly RoleGrant[],
): ReadonlyMap<string, readonly GrantScope[]> {
  const out = new Map<string, GrantScope[]>();

  for (const grant of grants) {
    for (const permission of permissionsFor(grant.role)) {
      const scopes = out.get(permission) ?? [];
      scopes.push(grant.scope);
      out.set(permission, scopes);
    }
  }

  return out;
}
