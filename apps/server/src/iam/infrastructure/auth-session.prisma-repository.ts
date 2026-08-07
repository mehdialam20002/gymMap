/**
 * M-020 · Session revocation — `FR-AUTH-10`, `Authentication.md` §8.8, ADR-0035.
 *
 * ┌─ M-020 ONLY REVOKES. IT NEVER CREATES A SESSION ────────────────────────────────────────────┐
 * │ ADR-0035 moved the two tables here from M-022 because a password reset must revoke every    │
 * │ session and the tables did not exist. It moved the TABLES and nothing else: JWT issue,      │
 * │ rotation and reuse detection remain M-022's, and this repository has no `create`.            │
 * │                                                                                              │
 * │ That absence is deliberate rather than incidental. A half-built session writer would be      │
 * │ used by the next milestone that needed one, and M-022 would inherit an implementation        │
 * │ nobody designed against ADR-0011's family and rotation model.                                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ ONE SET-BASED UPDATE, NOT A LOOP ──────────────────────────────────────────────────────────┐
 * │ `revokeAllForUser` is a single statement. A read-then-update-each loop has two failures:    │
 * │ a session created BETWEEN the read and the writes survives the reset — which is exactly the │
 * │ attacker's window — and a partial failure leaves some sessions revoked and some not, with   │
 * │ no way to tell which from the outside.                                                       │
 * │                                                                                              │
 * │ The `status = 'ACTIVE'` predicate matches `idx_auth_sessions__user_active`, which is partial │
 * │ on the same condition — so the statement touches only live rows however many revoked ones    │
 * │ have accumulated, and revoked rows accumulate forever because there is no DELETE grant.      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../tenancy/prisma/prisma.service.js';

/**
 * Why a session ended. Stored on the row, because `revoked_at` alone answers half the question
 * an account-takeover investigation asks.
 */
export type RevocationReason =
  'PASSWORD_RESET' | 'PASSWORD_CHANGE' | 'USER_SIGNED_OUT' | 'ADMIN_REVOKED';

@Injectable()
export class AuthSessionPrismaRepository {
  constructor(private readonly db: PrismaService) {}

  /**
   * Revokes every ACTIVE session for one user. Returns how many were affected.
   *
   * The count is returned rather than discarded because `Authentication.md` §8.8 puts it in the
   * response — a member resetting their password is told how many devices were signed out, and
   * "3 other devices were signed out" is how they notice the one they do not recognise.
   */
  async revokeAllForUser(
    userId: string,
    reason: RevocationReason,
    at: Date,
  ): Promise<{ revoked: number }> {
    const result = await this.db.client.authSession.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: at, revokedReason: reason },
    });
    return { revoked: result.count };
  }

  /** `FR-AUTH-09`'s sessions screen. Not used by M-020; the read half arrives with M-023. */
  async countActiveForUser(userId: string): Promise<number> {
    return this.db.client.authSession.count({ where: { userId, status: 'ACTIVE' } });
  }
}
