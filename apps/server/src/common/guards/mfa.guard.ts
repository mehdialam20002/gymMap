/**
 * `M-024` · The staff second-factor gate — `NFR-SEC-11`, `FR-AUTH-07`, `Security.md` §2.8, `E1.3`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * §2.8: *"An account holding a platform role with no enrolment can reach ONLY `/auth/mfa/enrol`;
 * every other route returns `403 MFA_ENROLMENT_REQUIRED` with a code the client uses to start
 * enrolment."*
 *
 * That is what this guard does, and the shape of the answer is the requirement. A bare 403 leaves
 * the console with a dead end; the CODE is what lets it open the enrolment flow instead of showing
 * "forbidden" to somebody who has done nothing wrong and can fix it in thirty seconds.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ WHAT THIS GUARD DOES NOT YET DO, STATED RATHER THAN IMPLIED ───────────────────────────────┐
 * │ §2.8 also requires `amr ⊇ {totp}` — not merely "this account HAS a factor" but "this SESSION  │
 * │ presented it". Those are different: a staff member who enrolled last year and signed in with  │
 * │ a password alone satisfies the first and not the second.                                      │
 * │                                                                                              │
 * │ The `amr` claim does not exist in the token yet. Adding it belongs to session issuance        │
 * │ (`M-022`'s `JwtSignerAdapter`) rather than to a guard, and inventing a claim here that nothing │
 * │ mints would produce a guard that refuses everybody or reads `undefined` and waves them        │
 * │ through — the second being the failure that looks like it works.                              │
 * │                                                                                              │
 * │ So this guard enforces the ENROLMENT half, which is complete and testable today, and          │
 * │ `KNOWN_LIMITATIONS.md` carries the other half rather than a comment implying it is handled.   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC } from '../decorators/public.decorator.js';
import { BusinessRuleException } from '../errors/domain-exception.js';
import { MFA_STORE, type MfaStore } from '../../iam/application/ports/mfa-store.port.js';
import { parseRoleGrants } from '../../iam/domain/effective-permissions.js';
import { mfaRequirementForPrincipal } from '../../iam/domain/mfa.policy.js';

/**
 * Marks the routes an unenrolled staff account may still reach.
 *
 * Deliberately a decorator rather than a path allowlist. A list of URLs in the guard drifts the
 * moment a route is renamed, and it drifts SILENTLY in the dangerous direction — the enrolment
 * endpoint stops being exempt and staff can no longer enrol, which is a lockout of everybody at
 * once. The exemption travelling on the handler cannot be separated from it.
 */
export const MFA_EXEMPT = Symbol('MfaExempt');

/** `@MfaExempt()` — for `/auth/mfa/*` and nothing else. */
export const MfaExempt = (): MethodDecorator & ClassDecorator => SetMetadata(MFA_EXEMPT, true);

interface GuardedRequest {
  readonly principal?: { readonly sub: string; readonly roles?: readonly string[] };
}

@Injectable()
export class MfaGuard implements CanActivate {
  private readonly logger = new Logger(MfaGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(MFA_STORE) private readonly store: MfaStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const controller = context.getClass();

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [handler, controller]) === true) {
      return true;
    }
    if (this.reflector.getAllAndOverride<boolean>(MFA_EXEMPT, [handler, controller]) === true) {
      return true;
    }

    const principal = context.switchToHttp().getRequest<GuardedRequest>().principal;

    /*
     * No principal means `JwtAuthGuard` has not run, or has not run FIRST.
     *
     * Allowed through rather than refused, and that is not a hole: this guard's only job is the
     * second factor, and an unauthenticated request is `JwtAuthGuard`'s 401 to give. Refusing here
     * would answer 403 to a request that should get 401 — leaking that the route exists and needs
     * MFA, to somebody who has not authenticated at all.
     *
     * Logged, because in a correctly wired module it cannot happen.
     */
    if (principal === undefined) {
      this.logger.warn(
        `${controller.name}.${handler.name} reached MfaGuard with no principal — ` +
          'JwtAuthGuard must run first. Deferring to it.',
      );
      return true;
    }

    /*
     * The requirement comes from the ROLES, through the same policy the enrolment endpoint uses.
     *
     * `parseRoleGrants` drops anything malformed, so a forged `SUPER_ADMIN@` claim contributes no
     * role and the account is treated as `NOT_OFFERED` — which denies it nothing here, because the
     * permission guard will refuse it separately. Two controls, neither relying on the other.
     */
    const roles = parseRoleGrants(principal.roles).map((grant) => grant.role);
    if (mfaRequirementForPrincipal(roles) !== 'MANDATORY') return true;

    const state = await this.store.read(principal.sub);
    if (state?.enabled === true) return true;

    // The code is the payload. `Security.md` §2.8 has the client start enrolment from it, so the
    // message names the action rather than the refusal.
    throw new BusinessRuleException(
      'MFA_ENROLMENT_REQUIRED',
      'This account must enrol a second factor before using this endpoint.',
    );
  }
}
