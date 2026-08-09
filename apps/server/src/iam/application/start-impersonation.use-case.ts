/**
 * `M-025` · Starting an impersonation — `FR-AUTH-12`, `BR-DAT-01`, `AC-1`…`AC-3`, `AC-5`, `AC-8`.
 *
 * ┌─ ONE ROW, READ BY TWO AUDIENCES — AND THIS PARAGRAPH USED TO CLAIM TWO ─────────────────────┐
 * │ It said "two audit rows, and they are not redundant": the platform's record and a separate     │
 * │ entry in the subject's own activity. The code wrote one. Another confident comment ahead of    │
 * │ the code, corrected here rather than left to be believed.                                      │
 * │                                                                                              │
 * │ One row is also the right answer, and not only because `Schema.md` §4's register is closed at  │
 * │ seventy-nine so `account_activity` would need a §24 amendment. Two tables recording the same   │
 * │ event drift, and the first bug is the pair disagreeing about an event the user is disputing.   │
 * │                                                                                              │
 * │ `AccountActivityUseCase` projects this row for the subject — with an EXPLICIT entity-type      │
 * │ allowlist, because filtering an operational log into a user-facing view is how "we only show   │
 * │ the ones we think you need to know about" happens by accident.                                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE AUDIT ROW IS WRITTEN BEFORE THE TOKEN IS RETURNED ─────────────────────────────────────┐
 * │ The audit repository swallows write failures deliberately — a lost row must not fail an       │
 * │ ordinary request. This is not an ordinary request. `M-014` already draws that line for        │
 * │ elevation: *"the deliberate high-consequence paths"* write first and refuse to proceed.       │
 * │ Handing back a token whose start event was never recorded is precisely the un-attributable    │
 * │ session this milestone exists to prevent, so the row is written and CHECKED first.            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_WRITE_PORT, type AuditWritePort } from '../../audit/ports/audit-write.port.js';
import { BusinessRuleException } from '../../common/errors/domain-exception.js';
import { JwtSignerAdapter } from '../infrastructure/jwt.signer.adapter.js';
import { UserPrismaRepository } from '../infrastructure/user.prisma-repository.js';
import { parseRoleGrants } from '../domain/effective-permissions.js';
import {
  impersonatedPermissions,
  mayStartImpersonation,
} from '../domain/impersonation.policy.js';
import type { PlatformRole } from '../types/iam.types.js';

export interface StartImpersonationCommand {
  readonly impersonatorId: string;
  readonly impersonatorRoles: readonly PlatformRole[];
  readonly subjectUserId: string;
  readonly reason: string;
  readonly minutes: number;
  readonly correlationId: string;
}

export interface StartImpersonationResult {
  readonly token: string;
  readonly expiresAt: Date;
  /** What the session may actually do — the intersection, for the client to render honestly. */
  readonly effectivePermissions: readonly string[];
}

@Injectable()
export class StartImpersonationUseCase {
  constructor(
    private readonly users: UserPrismaRepository,
    private readonly signer: JwtSignerAdapter,
    @Inject(AUDIT_WRITE_PORT) private readonly audit: AuditWritePort,
  ) {}

  async execute(command: StartImpersonationCommand): Promise<StartImpersonationResult> {
    /*
     * The SUBJECT's roles come from the database, never from the request.
     *
     * A caller who could name the target's roles would choose them, and the intersection would
     * become whatever they claimed it was — `AC-5` defeated by the parameter that implements it.
     */
    const subjectRoles = parseRoleGrants(await this.users.roleScopesFor(command.subjectUserId)).map(
      (grant) => grant.role,
    );

    const verdict = mayStartImpersonation({
      agentRoles: command.impersonatorRoles,
      targetRoles: subjectRoles,
      reason: command.reason,
      requestedMinutes: command.minutes,
    });
    if (!verdict.permitted) {
      throw new BusinessRuleException('IMPERSONATION_REFUSED', verdict.reason);
    }

    const effective = impersonatedPermissions(command.impersonatorRoles, subjectRoles);

    /*
     * ┌─ THE TOKEN CARRIES BOTH ROLE SETS, BECAUSE ROLES CANNOT EXPRESS AN INTERSECTION ────────┐
     * │ The first version narrowed the subject's roles at mint time and handed those over. It is  │
     * │ not expressible: measured against the real matrix, the intersection is STRICTLY smaller   │
     * │ than the subject's permission set in every combination that exists —                       │
     * │                                                                                          │
     * │     SUPPORT_AGENT × MEMBER      4 of 12        SUPER_ADMIN × MEMBER      4 of 12          │
     * │     SUPPORT_AGENT × GYM_OWNER   9 of 34        SUPER_ADMIN × GYM_OWNER  23 of 34          │
     * │                                                                                          │
     * │ — and no role in `§B3.2` has exactly those permissions, so no set of role claims produces │
     * │ them. Shipping the subject's roles would have granted MORE than the intersection on every │
     * │ single impersonation, with `AC-5` "implemented" and failing at runtime.                    │
     * │                                                                                          │
     * │ So both sets travel, and `effectiveGrants()` intersects at the point of decision. That     │
     * │ keeps the answer DERIVED from the matrix rather than frozen into a permission list a       │
     * │ future matrix change would not reach.                                                      │
     * └──────────────────────────────────────────────────────────────────────────────────────────┘
     */
    // Written FIRST, and not swallowed — see the header. A token handed out before its start event
    // is recorded is the un-attributable session this milestone exists to prevent.
    await this.audit.append({
      tenantId: null,
      actorId: command.subjectUserId,
      actorType: 'SUPPORT_IMPERSONATION',
      // Explicit, because the ALS frame does not exist yet — this row is what BEGINS it.
      impersonatedBy: command.impersonatorId,
      entityType: 'AUTH_SESSION',
      entityId: command.subjectUserId,
      action: 'CREATE',
      before: { impersonated: false },
      after: { impersonated: true, minutes: command.minutes },
      // `AC-2`'s reason, on the row, verbatim. This is the only place it is durably recorded.
      reason: command.reason.trim(),
      correlationId: command.correlationId,
    });

    const signed = this.signer.signImpersonationToken({
      subjectUserId: command.subjectUserId,
      impersonatorId: command.impersonatorId,
      tenantId: null,
      roles: subjectRoles.map((role) => `${role}@self`),
      impersonatorRoles: command.impersonatorRoles.map((role) => `${role}@platform`),
      minutes: command.minutes,
      familyId: command.correlationId,
    });

    return {
      token: signed.token,
      expiresAt: signed.expiresAt,
      effectivePermissions: effective,
    };
  }
}
