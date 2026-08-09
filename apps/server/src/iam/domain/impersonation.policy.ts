/**
 * `M-025` · Acting as another user — `FR-AUTH-12`, `BR-DAT-02`, `E1.8`, `PE3`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE EFFECTIVE SET IS THE INTERSECTION, NOT THE UNION
 *
 * `AC-5`: impersonation *"never elevates the agent's own permissions — the effective set is the
 * intersection of the agent's and the impersonated user's, not the union"*.
 *
 * The union is what a naive implementation produces, and it reads as obviously correct: the agent
 * is helping, so give them what the user can do PLUS what they already had. That is a privilege
 * escalation with a support ticket attached. A `SUPPORT_AGENT` impersonating a `GYM_OWNER` would
 * hold the owner's tenant authority AND their own platform reach — a combination no role in `§B3.2`
 * grants, assembled at runtime, and attributable to a session everyone assumes is limited.
 *
 * The intersection is also the honest model of what impersonation is FOR: seeing what the user
 * sees. Anything the user cannot do is not part of that, and anything the agent cannot do is not
 * made permissible by borrowing somebody's identity.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ A DISTINCT TOKEN TYPE, NOT A CLAIM ON A NORMAL ONE ────────────────────────────────────────┐
 * │ `AC-1`: `typ: 'IMPERSONATION'`, *"not a normal access token with a claim, so a mis-scoped    │
 * │ verifier cannot confuse the two"*. A boolean claim fails open: any verifier that forgets to  │
 * │ read it treats the token as ordinary access, and forgetting is the default state of code     │
 * │ written before the claim existed. A distinct `typ` fails CLOSED — a verifier expecting       │
 * │ `ACCESS` rejects it outright.                                                                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { permissionsFor } from '../permissions.js';
import type { PlatformRole } from '../types/iam.types.js';

/** `AC-3`. Thirty minutes, and it is a CAP rather than a default. */
export const IMPERSONATION_MAX_MINUTES = 30;

/**
 * `Admin.md` RS3's floor, reused deliberately.
 *
 * The same number the reason on every other administrative action must clear. A separate constant
 * here would drift, and "why is impersonation eight and refunds ten" is a question with no answer.
 */
export const IMPERSONATION_REASON_MIN_LENGTH = 10;

export type StartVerdict =
  | { readonly permitted: true }
  | { readonly permitted: false; readonly reason: string };

/**
 * Which roles may impersonate at all.
 *
 * `SUPPORT_AGENT` and `SUPER_ADMIN` only. Derived from nothing — this is a deliberate list, because
 * "who may borrow an identity" is not a capability `§B3.2` expresses and must not be inferred from
 * one. A `FINANCE` role with broad read access is exactly the kind of role that would acquire this
 * by accident if it were derived from permissions.
 */
export const MAY_IMPERSONATE: ReadonlySet<PlatformRole> = new Set<PlatformRole>([
  'SUPPORT_AGENT',
  'SUPER_ADMIN',
]);

/** `AC-2` and `AC-3`, plus who is allowed to ask. */
export function mayStartImpersonation(input: {
  readonly agentRoles: readonly PlatformRole[];
  readonly targetRoles: readonly PlatformRole[];
  readonly reason: string;
  readonly requestedMinutes: number;
}): StartVerdict {
  if (!input.agentRoles.some((role) => MAY_IMPERSONATE.has(role))) {
    return { permitted: false, reason: 'This role may not impersonate another user.' };
  }

  /*
   * Impersonating platform staff is refused.
   *
   * Not in the acceptance criteria, and it follows from them: `AC-5` makes the effective set an
   * intersection, so a support agent borrowing a `SUPER_ADMIN` identity gains nothing — but a
   * SUPER_ADMIN borrowing another SUPER_ADMIN gains a session where every action is attributable to
   * somebody else. That is not support, it is laundering attribution, and it is the one shape the
   * intersection rule does not already prevent.
   */
  if (input.targetRoles.some((role) => MAY_IMPERSONATE.has(role))) {
    return { permitted: false, reason: 'A user who can themselves impersonate may not be impersonated.' };
  }

  const reason = input.reason.trim();
  if (reason.length < IMPERSONATION_REASON_MIN_LENGTH) {
    return {
      permitted: false,
      reason: `A reason of at least ${String(IMPERSONATION_REASON_MIN_LENGTH)} characters is required.`,
    };
  }

  // Zero and negative are refused alongside "too long". A zero-minute session would mint a token
  // that is already expired, and the caller would read the resulting 401 as a bug in the factor.
  if (!Number.isInteger(input.requestedMinutes) || input.requestedMinutes < 1) {
    return { permitted: false, reason: 'The duration must be a whole number of minutes, at least one.' };
  }
  if (input.requestedMinutes > IMPERSONATION_MAX_MINUTES) {
    return {
      permitted: false,
      reason: `Impersonation is capped at ${String(IMPERSONATION_MAX_MINUTES)} minutes.`,
    };
  }

  return { permitted: true };
}

/**
 * `AC-5`. What the session may actually do.
 *
 * ┌─ COMPUTED FROM THE MATRIX, NEVER FROM THE TOKEN ────────────────────────────────────────────┐
 * │ Both sides are expanded through `permissionsFor()` — the same compiled `§B3.2` the guard      │
 * │ reads. Taking the agent's set from their token instead would let a stale token widen the      │
 * │ intersection, so a role revoked this morning still contributes this afternoon.                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function impersonatedPermissions(
  agentRoles: readonly PlatformRole[],
  targetRoles: readonly PlatformRole[],
): readonly string[] {
  const agent = new Set(agentRoles.flatMap((role) => permissionsFor(role)));
  const target = new Set(targetRoles.flatMap((role) => permissionsFor(role)));

  return [...target].filter((permission) => agent.has(permission)).sort();
}

/**
 * `AC-3`. Re-checked server-side, because `exp` alone trusts the token.
 *
 * A token whose `exp` was minted 30 minutes out is still only evidence of what the signer believed.
 * Checking the START time against the cap catches a signer bug, a replayed token from a previous
 * deployment, and a clock that moved — none of which the token can report on itself.
 */
export function impersonationExpired(startedAt: Date, now: Date): boolean {
  const elapsedMinutes = (now.getTime() - startedAt.getTime()) / 60_000;
  return elapsedMinutes >= IMPERSONATION_MAX_MINUTES;
}

/**
 * `AC-6`. `runElevated()` is unavailable during impersonation.
 *
 * Elevation exists so a platform read is deliberate and audited. Under impersonation the acting
 * identity is already borrowed, so an elevated read would be attributable to the impersonated user
 * — a platform-wide query recorded against somebody who cannot perform one. The two mechanisms are
 * individually sound and must not compose.
 */
export function mayElevate(tokenType: 'ACCESS' | 'IMPERSONATION'): boolean {
  return tokenType !== 'IMPERSONATION';
}
