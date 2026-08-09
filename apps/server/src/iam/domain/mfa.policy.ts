/**
 * `M-024` · Who must hold a second factor, and who may — `FR-AUTH-07`, `NFR-SEC-11`,
 * `Security.md` §2.8, `E1.3`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THREE ANSWERS, NOT TWO — AND THE THIRD IS THE ONE THAT GETS FORGOTTEN
 *
 * `NFR-SEC-11` says MFA is mandatory for platform staff; `FR-AUTH-07` says optional TOTP for gym
 * owners. Read as a boolean that is "required or not required", and the third case disappears:
 *
 *   MANDATORY  the five PLATFORM-scoped roles. No session without the factor.
 *   OPTIONAL   `GYM_OWNER`. May enrol, may not be forced.
 *   NOT_OFFERED `GYM_MANAGER`, `RECEPTIONIST`, `TRAINER`, and every non-staff role.
 *
 * `NOT_OFFERED` is different from `OPTIONAL` in a way that matters at the enrolment endpoint: an
 * optional role that has not enrolled should be invited to; a not-offered role that asks to enrol is
 * refused. Collapsing them means either nagging a receptionist about a factor they cannot use, or
 * silently letting one enrol and then locking a shared front-desk device behind one person's phone.
 *
 * `Security.md` §2.8 is explicit about why the branch roles are excluded in Phase 1: *"a shared
 * front-desk device makes per-staff TOTP an operational problem `NFR-USE-09` does not budget for"* —
 * and requires it recorded in `KNOWN_LIMITATIONS.md`, which is where the reasoning lives rather than
 * being re-argued here.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { ROLE_DEFINITIONS } from '../permissions.js';
import type { PlatformRole } from '../types/iam.types.js';

export type MfaRequirement = 'MANDATORY' | 'OPTIONAL' | 'NOT_OFFERED';

/**
 * The five platform-staff roles, DERIVED from `§B3.1`'s scope column rather than listed.
 *
 * A hand-written list is a second source of truth for "who is platform staff", and the failure is
 * silent in the worst direction: add a platform role to `§B3.1`, forget this list, and the new role
 * signs in with no second factor while every test still passes. Deriving it means a new
 * `PLATFORM`-scoped role is mandatory-MFA from the moment it exists.
 */
export const PLATFORM_STAFF_ROLES: ReadonlySet<PlatformRole> = new Set(
  ROLE_DEFINITIONS.filter((role) => role.scope === 'PLATFORM').map((role) => role.key),
);

/** What MFA means for one role. */
export function mfaRequirementFor(role: PlatformRole): MfaRequirement {
  if (PLATFORM_STAFF_ROLES.has(role)) return 'MANDATORY';
  if (role === 'GYM_OWNER') return 'OPTIONAL';
  return 'NOT_OFFERED';
}

/**
 * What MFA means for a PRINCIPAL, who may hold several roles.
 *
 * ┌─ THE STRONGEST REQUIREMENT WINS, AND THAT DIRECTION IS NOT ARBITRARY ───────────────────────┐
 * │ Somebody can be a `SUPPORT_AGENT` and also the owner of a gym. Taking the first role, or the  │
 * │ weakest, would let a platform-staff account escape the mandate by ALSO holding a gym role —   │
 * │ an escalation available to anybody who can be granted one, and one that looks like a          │
 * │ convenience feature from the inside.                                                          │
 * │                                                                                              │
 * │ A principal with no roles at all is `NOT_OFFERED`: they cannot reach a staff surface, so there │
 * │ is nothing to protect and nothing to offer.                                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function mfaRequirementForPrincipal(roles: readonly PlatformRole[]): MfaRequirement {
  const requirements = roles.map(mfaRequirementFor);
  if (requirements.includes('MANDATORY')) return 'MANDATORY';
  if (requirements.includes('OPTIONAL')) return 'OPTIONAL';
  return 'NOT_OFFERED';
}

/** Whether this principal may enrol at all. Mandatory and optional both may; not-offered may not. */
export function mayEnrolMfa(roles: readonly PlatformRole[]): boolean {
  return mfaRequirementForPrincipal(roles) !== 'NOT_OFFERED';
}

export type DisableVerdict =
  | { readonly permitted: true }
  | { readonly permitted: false; readonly reason: string };

/**
 * Whether this principal may turn the factor off — `M-024` acceptance criterion 6.
 *
 * The refusal is a **422 with a registry code, not a 403**, and the distinction is the requirement
 * rather than a preference: a `SUPER_ADMIN` has every permission there is, so 403 would be a lie
 * about authorisation. What is true is that disabling a mandatory factor is not an operation the
 * domain offers to anybody — the same shape as `LAST_OWNER_PROTECTED`.
 */
export function mayDisableMfa(roles: readonly PlatformRole[]): DisableVerdict {
  if (mfaRequirementForPrincipal(roles) === 'MANDATORY') {
    return {
      permitted: false,
      reason:
        'A second factor is mandatory for platform staff, so it cannot be disabled. ' +
        'If the device was lost, use a recovery code and re-enrol.',
    };
  }
  return { permitted: true };
}

/**
 * `Security.md` §2.8: ten codes, and a prompt to regenerate below three remaining.
 *
 * Three rather than zero because regeneration invalidates the whole set: a user who waits until the
 * last code is gone has no way to authenticate in order to generate more, which is the lockout the
 * codes exist to prevent.
 */
export const RECOVERY_CODE_COUNT = 10;
export const RECOVERY_CODE_LOW_WATER_MARK = 3;

export function shouldPromptRecoveryRegeneration(remaining: number): boolean {
  return remaining < RECOVERY_CODE_LOW_WATER_MARK;
}
