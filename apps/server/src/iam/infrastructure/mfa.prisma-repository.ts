/**
 * `M-024` · `MFA_STORE` on Prisma — `FR-AUTH-07`, `Security.md` §2.8.
 *
 * `users` is an IDENTITY table with no `tenant_id` at all, so nothing here is tenant-scoped and
 * there is no ambient filter to remember — unlike `user_roles`, which has a tenant column and no
 * RLS policy and needs an explicit one.
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../tenancy/prisma/prisma.service.js';
import type { MfaState, MfaStore } from '../application/ports/mfa-store.port.js';

/** The columns every read needs. Named once so two reads cannot disagree about the shape. */
const MFA_SELECT = {
  id: true,
  mfaEnabled: true,
  mfaEnrolledAt: true,
  mfaSecretEncrypted: true,
  mfaRecoveryCodesHashed: true,
  mfaLastStep: true,
} as const;

@Injectable()
export class MfaPrismaRepository implements MfaStore {
  constructor(private readonly db: PrismaService) {}

  async read(userId: string): Promise<MfaState | null> {
    const row = await this.db.client.user.findUnique({
      where: { id: userId },
      select: MFA_SELECT,
    });
    if (row === null) return null;

    return {
      userId: row.id,
      enabled: row.mfaEnabled,
      enrolledAt: row.mfaEnrolledAt,
      secretEnvelope: row.mfaSecretEncrypted,
      recoveryCodeHashes: row.mfaRecoveryCodesHashed,
      lastStep: row.mfaLastStep,
    };
  }

  /**
   * Writes the envelope and NOTHING else.
   *
   * `mfa_enabled` is deliberately untouched: the whole point of the pending state is that a stored
   * secret is not yet a factor. The database CHECK would refuse the flag without a timestamp
   * anyway, which is the constraint doing its job rather than a coincidence to rely on.
   */
  async savePendingSecret(userId: string, envelope: string): Promise<void> {
    await this.db.client.user.update({
      where: { id: userId },
      data: { mfaSecretEncrypted: envelope },
    });
  }

  /**
   * One `UPDATE`. The flag, the timestamp, the codes and the first step land together or not at all
   * — `ck_users__mfa_enabled_has_timestamp` refuses any statement that sets the flag without the
   * timestamp, so a partial write cannot be committed even by a future caller who forgets.
   */
  async activate(input: {
    readonly userId: string;
    readonly at: Date;
    readonly recoveryCodeHashes: readonly string[];
    readonly firstAcceptedStep: bigint;
  }): Promise<void> {
    await this.db.client.user.update({
      where: { id: input.userId },
      data: {
        mfaEnabled: true,
        mfaEnrolledAt: input.at,
        mfaRecoveryCodesHashed: [...input.recoveryCodeHashes],
        mfaLastStep: input.firstAcceptedStep,
      },
    });
  }

  /**
   * Advances the high-water mark, and REFUSES to move it backwards.
   *
   * ┌─ WHY THE GUARD IS IN THE `WHERE` AND NOT IN JAVASCRIPT ─────────────────────────────────────┐
   * │ Two requests verifying at once both read the same `lastStep`, and whichever `UPDATE` lands   │
   * │ second wins. If that is the older step, the newer code becomes replayable — the exact window │
   * │ §2.8's counter exists to close, reopened by concurrency rather than by a bug in the logic.   │
   * │                                                                                              │
   * │ A read-then-compare in the application cannot fix that; the comparison has to be part of the │
   * │ write. `updateMany` with the predicate in the `WHERE` makes the database arbitrate, and a    │
   * │ count of zero means somebody else already recorded a newer step — success, not failure.       │
   * └──────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  async recordAcceptedStep(userId: string, step: bigint): Promise<void> {
    await this.db.client.user.updateMany({
      where: {
        id: userId,
        OR: [{ mfaLastStep: null }, { mfaLastStep: { lt: step } }],
      },
      data: { mfaLastStep: step },
    });
  }

  async replaceRecoveryCodes(userId: string, hashes: readonly string[]): Promise<void> {
    await this.db.client.user.update({
      where: { id: userId },
      data: { mfaRecoveryCodesHashed: [...hashes] },
    });
  }

  /**
   * Clears every MFA column, including the flag.
   *
   * The flag and the timestamp MUST be cleared together or the CHECK rejects the statement — which
   * is the constraint earning its place: an implementation that nulled the secret and left
   * `mfa_enabled = true` would otherwise leave an account demanding a factor it no longer holds,
   * locked out with no way back except support.
   *
   * `mfaLastStep` is cleared too. A stale high-water mark would sit above the step of any code a
   * FUTURE enrolment produced, and every one of them would be refused as a replay.
   */
  async clear(userId: string): Promise<void> {
    await this.db.client.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaEnrolledAt: null,
        mfaSecretEncrypted: null,
        mfaRecoveryCodesHashed: [],
        mfaLastStep: null,
      },
    });
  }
}
