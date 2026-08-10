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

import {
  CAPABILITY_MATRIX,
  PERMISSION_KEYS,
  ROLE_DEFINITIONS,
  SCOPED_NON_MATRIX_PERMISSIONS,
  SELF_SERVICE_PERMISSIONS,
  capabilityDeclares,
  permissionsFor,
} from '../permissions.js';
import type { PlatformRole } from '../types/iam.types.js';

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
    return declared === 'BRANCH' ? { role, scope: { kind: 'BRANCH', tenantId, branchId } } : null;
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
  /*
   * ┌─ SELF-SERVICE IS CHECKED BEFORE `KNOWN_PERMISSIONS`, AND HAS TO BE ────────────────────────┐
   * │ These keys are deliberately absent from `§B3.2` — see `SELF_SERVICE_PERMISSIONS` for why a  │
   * │ row for them would fail `RB2`'s drift check against the PRD, correctly. So they are also    │
   * │ absent from `PERMISSION_KEYS`, and the `UNKNOWN_PERMISSION` guard below would refuse them   │
   * │ before anything else ran. That refusal is what kept `PermissionsGuard` unregisterable:      │
   * │ binding it globally 403'd every route declaring one, which is `TD-045`.                      │
   * │                                                                                             │
   * │ **Any authenticated principal holds them, and the permission is not what scopes them.**      │
   * │ `AZ4` makes a `/me` route act on the caller's own rows and the handler enforces that in its │
   * │ `WHERE` clause. An empty `grants` array still fails — an unauthenticated caller has no       │
   * │ grants at all, so `@Public()` remains the only way to reach a route without a token.         │
   * └─────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  if (SELF_SERVICE_PERMISSIONS.includes(permission)) {
    const [any] = grants;
    return any === undefined
      ? { allowed: false, reason: 'NOT_GRANTED' }
      : { allowed: true, via: any };
  }

  if (!KNOWN_PERMISSIONS.has(permission) && !SCOPED_NON_MATRIX_PERMISSIONS.includes(permission)) {
    return { allowed: false, reason: 'UNKNOWN_PERMISSION' };
  }

  // A scoped non-matrix key is held by every grant; what decides it is `scopeReaches()` below, so
  // a principal can ping their OWN tenant and gets `OUT_OF_SCOPE` for anybody else's.
  const holding = SCOPED_NON_MATRIX_PERMISSIONS.includes(permission)
    ? grants
    : grants.filter((grant) => permissionsFor(grant.role).includes(permission));
  if (holding.length === 0) return { allowed: false, reason: 'NOT_GRANTED' };

  const reaching = holding.find((grant) => scopeReaches(grant, resource, principalId));
  if (reaching === undefined) return { allowed: false, reason: 'OUT_OF_SCOPE' };

  return { allowed: true, via: reaching };
}

/**
 * The grants a request is authorised with — `M-025` `AC-5`, `FR-AUTH-12`.
 *
 * ┌─ THE ONE PLACE THE INTERSECTION IS APPLIED ─────────────────────────────────────────────────┐
 * │ Under an ordinary token this is just the principal's grants. Under an impersonation it is the │
 * │ subject's grants MINUS anything the agent does not themselves hold.                            │
 * │                                                                                              │
 * │ It has to happen here rather than at mint time, because the intersection is not expressible   │
 * │ as a role claim: against the real matrix it is strictly narrower than the subject's set in     │
 * │ every combination, and no `§B3.2` role carries exactly those permissions. A token narrowed by  │
 * │ roles would grant more than the intersection every single time.                                │
 * │                                                                                              │
 * │ A grant survives only if the agent holds AT LEAST ONE permission it confers. That is the       │
 * │ coarsest correct filter at role granularity; `permits()` then does the per-permission check,   │
 * │ so a grant that survives here still cannot exercise a permission the agent lacks.              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function effectiveGrants(principal: {
  readonly typ?: string;
  readonly roles?: readonly string[];
  readonly imp_roles?: readonly string[];
}): readonly RoleGrant[] {
  const subject = parseRoleGrants(principal.roles);
  if (principal.typ !== 'IMPERSONATION') return subject;

  /*
   * No agent roles on an impersonation token is a forged or truncated one. Answering with the
   * subject's full grants would be the union by omission — the exact escalation `AC-5` forbids —
   * so the safe answer is NOTHING, and the request is refused as unauthorised.
   */
  const agent = parseRoleGrants(principal.imp_roles);
  if (agent.length === 0) return [];

  const agentPermissions = new Set(agent.flatMap((grant) => permissionsFor(grant.role)));

  return subject.filter((grant) =>
    permissionsFor(grant.role).some((permission) => agentPermissions.has(permission)),
  );
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

// ─────────────────────────────────────────────────────────────────────────────
// The inspector — `FR-RBAC-05`, `AC-STAF-08.1`, `AC-STAF-08.3`, `Security.md` RB5
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One reason a principal holds one permission.
 *
 * ┌─ WHY `effectivePermissions()` ABOVE IS NOT ENOUGH ──────────────────────────────────────────┐
 * │ That function answers "which permissions, and from which scopes". `AC-STAF-08.1` asks for    │
 * │ *"the resolved permission set with the role and scope that grants each one"*, and it drops    │
 * │ the ROLE on the floor — three roles granting the same key are indistinguishable in its output.│
 * │ For deciding which menu item to render that is fine. For a support agent asking WHY somebody  │
 * │ can do something, the role is the whole answer.                                               │
 * │                                                                                              │
 * │ It also drops the `§B3.2` qualifier, and that one is a correctness gap rather than a missing  │
 * │ label: `permissionsFor()` cannot recover it, because ● FULL and ▪ OWN yield IDENTICAL keys by │
 * │ design — the difference between them is the row filter the use case applies, not the          │
 * │ capability declared. An inspector that showed a `▪` grant as full access would be reporting   │
 * │ authority the holder does not have, on the one screen built to answer that question.          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export interface PermissionGrantReason {
  /** The role that carries it. The answer to "why can they do this?". */
  readonly role: PlatformRole;
  /** The scope that role was granted in. */
  readonly scope: GrantScope;
  /**
   * The `§B3.2` cell, verbatim from the matrix — `FULL` (●), `OWN` (▪) or `READ` (○).
   *
   * `NONE` cannot appear: a role with `NONE` contributes no key, so it is never a reason.
   */
  readonly qualifier: 'FULL' | 'OWN' | 'READ';
  /** The row label from `§B3.2`, so the screen can name the capability a human recognises. */
  readonly capability: string;
}

/**
 * The answer for ONE permission — held, or explicitly not.
 *
 * `AC-STAF-08.3`: a permission the user does not hold *"says so explicitly rather than returning an
 * empty list"*. So the not-held case is a VALUE, and it distinguishes the two ways it happens:
 *
 *   `NOT_GRANTED`       — a real capability nobody has granted them. The expected answer.
 *   `UNKNOWN_PERMISSION` — no such key in the matrix. A configuration gap, and NOT about this user
 *                          at all: answering "they do not hold it" would send a support agent to
 *                          fix a grant when the thing to fix is a missing `§B3.2` row.
 */
export type PermissionInspection =
  | {
      readonly held: true;
      readonly permission: string;
      readonly reasons: readonly PermissionGrantReason[];
    }
  | {
      readonly held: false;
      readonly permission: string;
      readonly reason: 'NOT_GRANTED' | 'UNKNOWN_PERMISSION';
    };

/**
 * Why a principal holds a permission — every reason, not the first one found.
 *
 * Plural because the honest answer often is. A gym owner who is also a receptionist at one branch
 * holds `attendance.checkin.write` twice for different reasons, and revoking one leaves the other:
 * an inspector that reported a single reason would make a support agent remove the wrong grant and
 * conclude the screen was lying when access survived.
 *
 * Reasons are sorted by role so two calls with the same grants in a different order agree — the
 * output is a diffable answer to a support question, not a stream.
 */
/*
 * `capabilityDeclares` now lives in `../permissions.js` beside the matrix it reads, because
 * `permissionOf()` needs the same predicate and a second copy is how the two drift.
 *
 * ┌─ IT EXISTS BECAUSE THE INSPECTOR SILENTLY DISAGREED WITH THE GUARD ──────────────────────────┐
 * │ The check here read `entry.readKey !== permission && entry.writeKey !== permission`, and had │
 * │ done since before `extraReadKeys` existed. A key carried in `extraReadKeys` or                │
 * │ `extraWriteKeys` therefore matched NO row, `reasons` stayed empty, and `inspectPermission()`  │
 * │ returned `NOT_GRANTED` for a permission `permissionsFor()` says the principal holds.           │
 * │                                                                                              │
 * │ That is precisely the failure `RB5` names — *"the console disagrees with the guard"* — and    │
 * │ `FR-RBAC-05` exists so a Super Admin can trust that console during a support call. It shipped │
 * │ with `ADR-0043` and went unnoticed for one reason: the only extra key at the time was         │
 * │ `admin.user.read_permissions`, held by `SUPER_ADMIN` alone, and the cross-check test resolves │
 * │ a `GYM_OWNER`. `ADR-0047` gave five more keys to five roles and the test went red at once.    │
 * │                                                                                              │
 * │ Every place that asks "which row declares this key" goes through it, so the next field added  │
 * │ to `CapabilityDefinition` is one edit rather than a hunt.                                      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

export function inspectPermission(
  grants: readonly RoleGrant[],
  permission: string,
): PermissionInspection {
  if (!KNOWN_PERMISSIONS.has(permission)) {
    return { held: false, permission, reason: 'UNKNOWN_PERMISSION' };
  }

  const reasons: PermissionGrantReason[] = [];

  for (const grant of grants) {
    if (!permissionsFor(grant.role).includes(permission)) continue;

    // RB5: the SAME compiled matrix the guard reads, so the inspector cannot disagree with it.
    for (const entry of CAPABILITY_MATRIX) {
      if (!capabilityDeclares(entry, permission)) continue;

      const qualifier = entry.grants[grant.role];
      // `NONE` here would mean the matrix and `permissionsFor()` disagree about the same cell.
      // Skipped rather than reported, because emitting a `NONE` reason would state that the
      // principal holds the permission *because* they are denied it.
      if (qualifier === 'NONE') continue;

      reasons.push({
        role: grant.role,
        scope: grant.scope,
        qualifier,
        capability: entry.capability,
      });
    }
  }

  if (reasons.length === 0) return { held: false, permission, reason: 'NOT_GRANTED' };

  return {
    held: true,
    permission,
    reasons: [...reasons].sort(
      (a, b) => a.role.localeCompare(b.role) || a.capability.localeCompare(b.capability),
    ),
  };
}

/**
 * The whole annotated set — every permission held, each with every reason it is held.
 *
 * Built on `inspectPermission` rather than beside it, so the two cannot drift into disagreeing
 * about the same grant. The inspector screen needs both: this to list, that to answer a search.
 *
 * Deliberately NOT cached. `FR-RBAC-04`'s cache is a 60-second-stale, session-claim-shaped guard
 * optimisation, and `AC-STAF-08.2` requires this path to be read-only — a cache read is harmless
 * but a cache WRITE from an inspection would let looking at somebody's permissions change what the
 * guard subsequently believes about them. Support tooling must not have that power.
 */
export function annotatedEffectivePermissions(
  grants: readonly RoleGrant[],
): ReadonlyMap<string, readonly PermissionGrantReason[]> {
  const out = new Map<string, readonly PermissionGrantReason[]>();

  for (const permission of PERMISSION_KEYS) {
    const inspection = inspectPermission(grants, permission);
    if (inspection.held) out.set(permission, inspection.reasons);
  }

  return out;
}
