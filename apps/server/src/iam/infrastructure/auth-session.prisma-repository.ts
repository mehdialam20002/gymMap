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
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGE'
  | 'USER_SIGNED_OUT'
  | 'ADMIN_REVOKED'
  /**
   * M-022 · `E1.2`. Deliberately distinct from an ordinary sign-out.
   *
   * This is the value `ALRT-32` counts. Folding it into `USER_SIGNED_OUT` would bury the one
   * revocation that means something among thousands of routine logouts, and the alert that
   * matters would never fire.
   */
  | 'TOKEN_REUSE_DETECTED';

/** One row of the `FR-AUTH-09` sessions screen. */
export interface SessionSummary {
  readonly id: string;
  readonly familyId: string;
  readonly deviceLabel: string | null;
  readonly userAgent: string | null;
  readonly ip: string | null;
  readonly createdAt: Date;
  readonly status: string;
}

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

  async countActiveForUser(userId: string): Promise<number> {
    return this.db.client.authSession.count({ where: { userId, status: 'ACTIVE' } });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // M-022 · issue, read and revoke one session.
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Opens a session. The caller supplies `familyId` because the access token carries it and the
   * two must agree — deriving it here would mean reading the row back to sign the token.
   */
  async create(input: {
    readonly userId: string;
    readonly familyId: string;
    readonly deviceLabel: string | null;
    readonly userAgent: string | null;
    readonly ip: string | null;
    readonly absoluteExpiresAt: Date;
  }): Promise<{ id: string }> {
    return this.db.client.authSession.create({
      data: {
        userId: input.userId,
        familyId: input.familyId,
        deviceLabel: input.deviceLabel,
        userAgent: input.userAgent,
        ip: input.ip,
        absoluteExpiresAt: input.absoluteExpiresAt,
      },
      select: { id: true },
    });
  }

  async findById(id: string): Promise<(SessionSummary & { userId: string }) | null> {
    return this.db.client.authSession.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        familyId: true,
        deviceLabel: true,
        userAgent: true,
        ip: true,
        createdAt: true,
        status: true,
      },
    });
  }

  /** `FR-AUTH-09`'s sessions screen — the caller's OWN sessions, newest first. */
  async listActiveForUser(userId: string): Promise<SessionSummary[]> {
    return this.db.client.authSession.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        familyId: true,
        deviceLabel: true,
        userAgent: true,
        ip: true,
        createdAt: true,
        status: true,
      },
    });
  }

  /**
   * Revokes ONE session.
   *
   * Scoped by `userId` as well as by id — deliberately. Without it, a caller could revoke
   * anyone's session by guessing a uuid, and the endpoint is `/me`-audience precisely because
   * it acts on the caller's own sessions. The count distinguishes "not yours" from "already
   * revoked" for the caller without saying which.
   */
  async revokeOne(
    id: string,
    userId: string,
    reason: RevocationReason,
    at: Date,
  ): Promise<{ revoked: number }> {
    const result = await this.db.client.authSession.updateMany({
      where: { id, userId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: at, revokedReason: reason },
    });
    return { revoked: result.count };
  }

  /**
   * Revokes every session in ONE token family — `E1.2`.
   *
   * A family is one session by construction (`uq_auth_sessions__family_id`), so this is one row
   * today. It is written as a set operation anyway: ADR-0011's model is that reuse revokes the
   * FAMILY, and a future device-linking feature that put two sessions in one family must not
   * silently revoke only the first.
   */
  async revokeFamily(
    familyId: string,
    reason: RevocationReason,
    at: Date,
  ): Promise<{ revoked: number; userId: string | null }> {
    const sessions = await this.db.client.authSession.findMany({
      where: { familyId },
      select: { userId: true },
    });

    const result = await this.db.client.authSession.updateMany({
      where: { familyId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: at, revokedReason: reason },
    });

    return { revoked: result.count, userId: sessions[0]?.userId ?? null };
  }
}
