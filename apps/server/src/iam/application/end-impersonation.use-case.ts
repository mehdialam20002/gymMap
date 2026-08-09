/**
 * `M-025` · Ending an impersonation — `FR-AUTH-12`, `BR-DAT-01`, `AC-3`, `AC-7`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * "END" HAS TO MEAN THE TOKEN STOPS WORKING
 *
 * The token is a stateless JWT with a 30-minute `exp`. An "end" that writes an audit row and
 * returns 204 is theatre: the agent still holds a signed credential that every verifier accepts
 * for the rest of the window, and the row says the session finished.
 *
 * That is worse than not having the endpoint. A support agent who ends a session believes they have
 * put the identity down; an investigation reading the log believes the same; and the token in the
 * browser tab keeps working. So ending REVOKES the family through the `AC-10` denylist — the same
 * mechanism that makes signing out mean something — and the audit row is written after it.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_WRITE_PORT, type AuditWritePort } from '../../audit/ports/audit-write.port.js';
import { CLOCK, type Clock } from '../../common/clock/clock.port.js';
import { FamilyDenylist } from '../../common/auth/family-denylist.redis.js';

export interface EndImpersonationCommand {
  readonly impersonatorId: string;
  readonly subjectUserId: string;
  /** The token family, so the credential itself is revoked rather than merely recorded as over. */
  readonly familyId: string;
  /** When the session began, for the duration on the row and in the user's activity log. */
  readonly startedAt: Date;
  readonly correlationId: string;
}

@Injectable()
export class EndImpersonationUseCase {
  constructor(
    private readonly denylist: FamilyDenylist,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AUDIT_WRITE_PORT) private readonly audit: AuditWritePort,
  ) {}

  async execute(command: EndImpersonationCommand): Promise<void> {
    /*
     * Revoked FIRST, and the failure is not swallowed.
     *
     * If the denylist write fails and this still returns 204, the agent is told the identity is
     * back in the box while the credential is live. Failing loudly leaves them holding a session
     * they know is open, which is the recoverable state — they can retry, and the 30-minute cap is
     * still running underneath.
     */
    await this.denylist.revoke(command.familyId);

    const endedAt = this.clock.now();
    const minutes = Math.max(
      0,
      Math.round((endedAt.getTime() - command.startedAt.getTime()) / 60_000),
    );

    await this.audit.append({
      tenantId: null,
      actorId: command.subjectUserId,
      actorType: 'SUPPORT_IMPERSONATION',
      /*
       * EXPLICIT, and this is the one row that needs it to be.
       *
       * The ALS frame belongs to the request being made UNDER the token. By the time the session is
       * being closed the caller may be the agent's own ordinary session — or the frame may already
       * have been left — so the ambient value the repository would read is `null`. The one row that
       * records the end of an impersonation must not be the one row missing the impersonator.
       */
      impersonatedBy: command.impersonatorId,
      entityType: 'AUTH_SESSION',
      entityId: command.subjectUserId,
      action: 'DELETE',
      before: { impersonated: true },
      // The duration, which `AC-8` requires the subject to be able to see in their own activity.
      after: { impersonated: false, durationMinutes: minutes },
      reason: 'The impersonation session was ended.',
      correlationId: command.correlationId,
    });
  }
}
