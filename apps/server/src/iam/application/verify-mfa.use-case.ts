/**
 * `M-024` · Presenting the second factor — `FR-AUTH-07`, `NFR-SEC-11`, `Security.md` §2.8.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * ONE ENTRY POINT FOR TWO THINGS THAT LOOK DIFFERENT AND ARE THE SAME
 *
 * A TOTP code and a recovery code both answer "prove you hold the second factor". Splitting them
 * into two routes splits the RATE LIMIT and the lockout counter too — and then an attacker who
 * exhausts the TOTP budget simply moves to the recovery endpoint, where the counter is fresh and
 * the search space is the one that actually matters.
 *
 * So one use case, one budget, and the submission's SHAPE decides which path it takes.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ THE ORDER OF CHECKS IS THE SECURITY PROPERTY ──────────────────────────────────────────────┐
 * │ Lockout is consulted BEFORE anything is verified, and the counter is incremented on failure   │
 * │ before the answer is returned. Verifying first and counting afterwards leaves a window where  │
 * │ concurrent requests all read the same count — which is how a 5-attempt limit becomes fifty.   │
 * │                                                                                              │
 * │ This paragraph was written before the code did any of it. The first version of this file had  │
 * │ no lockout at all and this comment above it, which is the exact failure the rest of this      │
 * │ codebase keeps catching: a confident comment is the most effective place to hide a gap.       │
 * │ `M-024` acceptance criterion 7 requires the counter, so the counter is here.                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ IT SHARES M-020's COUNTER RATHER THAN KEEPING ITS OWN ─────────────────────────────────────┐
 * │ Criterion 7: attempts "count toward the M-020 lockout policy". One counter per account, not   │
 * │ one per credential type — otherwise five password guesses plus five TOTP guesses plus five     │
 * │ recovery-code guesses is fifteen attempts against a threshold of five, and each budget looks   │
 * │ correct in isolation.                                                                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_WRITE_PORT, type AuditWritePort } from '../../audit/ports/audit-write.port.js';
import { CLOCK, type Clock } from '../../common/clock/clock.port.js';
import { BusinessRuleException } from '../../common/errors/domain-exception.js';
import { LOCKOUT_THRESHOLD, evaluateLockout } from '../domain/lockout.policy.js';
import { LOCKOUT_COUNTER, type LockoutCounter } from './ports/lockout-counter.port.js';
import { MFA_STORE, type MfaState, type MfaStore } from './ports/mfa-store.port.js';
import { PASSWORD_HASHER, type PasswordHasher } from './ports/password-hasher.port.js';
import { SECRET_CIPHER, type SecretCipher } from '../infrastructure/secret-cipher.js';
import { verifyTotp } from '../infrastructure/totp.adapter.js';
import {
  RECOVERY_CODE_LOW_WATER_MARK,
  shouldPromptRecoveryRegeneration,
} from '../domain/mfa.policy.js';
import {
  isWellFormedRecoveryCode,
  normaliseRecoveryCode,
} from '../domain/recovery-code.vo.js';

export interface VerifyMfaCommand {
  readonly userId: string;
  /** Six digits, or a recovery code. The shape decides which. */
  readonly submitted: string;
  readonly correlationId: string;
}

export interface VerifyMfaResult {
  /** Which credential was spent. The session's `amr` claim and the audit row both need it. */
  readonly method: 'TOTP' | 'RECOVERY_CODE';
  readonly recoveryCodesRemaining: number;
  /** §2.8: below three remaining, prompt to regenerate. */
  readonly shouldRegenerateRecoveryCodes: boolean;
}

@Injectable()
export class VerifyMfaUseCase {
  constructor(
    @Inject(MFA_STORE) private readonly store: MfaStore,
    @Inject(LOCKOUT_COUNTER) private readonly lockout: LockoutCounter,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AUDIT_WRITE_PORT) private readonly audit: AuditWritePort,
  ) {}

  /**
   * The account's MFA state, for a caller deciding whether this submission CONFIRMS an enrolment or
   * PRESENTS an existing factor.
   *
   * A read-only passthrough, and deliberately not a flag in the request body. A client that could
   * choose would be able to claim "this is a login" during enrolment and skip the confirmation step
   * — the step that exists so a QR which never scanned does not lock the account.
   */
  async stateFor(userId: string): Promise<MfaState | null> {
    return this.store.read(userId);
  }

  async execute(command: VerifyMfaCommand): Promise<VerifyMfaResult> {
    /*
     * Consulted first, and against the SAME counters the password path reads.
     *
     * `hasPassword: true` is passed unconditionally, and that is not a shortcut: the flag exists so
     * an OTP-only account cannot be locked out of its only credential. Reaching MFA verification
     * means a first factor already succeeded and a second one exists, so lockout here can never be
     * somebody's only way in — it always leaves the recovery codes.
     */
    const counters = await this.lockout.read(command.userId);
    const outcome = evaluateLockout({ ...counters, hasPassword: true }, this.clock.now());
    if (outcome.locked) {
      throw new BusinessRuleException(
        'MFA_VERIFICATION_FAILED',
        'The code was not accepted.',
      );
    }

    const state = await this.store.read(command.userId);

    // ┌─ ONE REFUSAL FOR "NOT ENROLLED" AND "WRONG CODE" ────────────────────────────────────────┐
    // │ Distinct messages would turn this endpoint into an enrolment oracle: submit anything for  │
    // │ a user id and the error tells you whether that account has MFA — which is to say, whether │
    // │ it is a staff account worth attacking. Same code, same shape, both ways.                  │
    // └──────────────────────────────────────────────────────────────────────────────────────────┘
    if (state === null || !state.enabled || state.secretEnvelope === null) {
      // The work is burned so an unenrolled account does not answer measurably faster than a
      // wrong code against an enrolled one.
      await this.hasher.burnEquivalentWork(command.submitted);
      throw new BusinessRuleException('MFA_VERIFICATION_FAILED', 'The code was not accepted.');
    }

    try {
      const result = isWellFormedRecoveryCode(command.submitted)
        ? await this.consumeRecoveryCode(state, command)
        : await this.acceptTotp(state, command);

      // Cleared only on success, and only AFTER the credential was actually spent. Clearing before
      // verifying would reset the budget on every attempt and make the threshold unreachable.
      await this.lockout.clearFailures(command.userId);
      return result;
    } catch (error) {
      // Counted before the answer goes back, so concurrent attempts cannot all read the same
      // pre-increment value. `recordFailure` returns the new count; reaching the threshold records
      // the lock itself, exactly as the password path does.
      const failures = await this.lockout.recordFailure(command.userId);
      if (failures >= LOCKOUT_THRESHOLD) await this.lockout.recordLock(command.userId);
      throw error;
    }
  }

  private async acceptTotp(
    state: MfaState,
    command: VerifyMfaCommand,
  ): Promise<VerifyMfaResult> {
    const secret = this.cipher.open(state.secretEnvelope as string);
    const verdict = verifyTotp(
      secret,
      command.submitted,
      this.clock.now().getTime(),
      state.lastStep,
    );

    if (!verdict.valid || verdict.step === null) {
      throw new BusinessRuleException('MFA_VERIFICATION_FAILED', 'The code was not accepted.');
    }

    // Recorded BEFORE the caller is told it succeeded. If this write fails, the request fails —
    // reporting success while the step counter still permits the same code is precisely the replay
    // §2.8 exists to prevent, and it would be invisible.
    await this.store.recordAcceptedStep(command.userId, verdict.step);

    return {
      method: 'TOTP',
      recoveryCodesRemaining: state.recoveryCodeHashes.length,
      shouldRegenerateRecoveryCodes: shouldPromptRecoveryRegeneration(
        state.recoveryCodeHashes.length,
      ),
    };
  }

  private async consumeRecoveryCode(
    state: MfaState,
    command: VerifyMfaCommand,
  ): Promise<VerifyMfaResult> {
    const normalised = normaliseRecoveryCode(command.submitted);

    /*
     * Every remaining hash is checked, and the loop does NOT stop early on a match.
     *
     * Argon2id is deliberately slow, so returning as soon as one verifies makes the response time
     * proportional to the code's POSITION in the array — an oracle that narrows which code was
     * used, and by extension how many remain. Checking all of them costs a fixed ten verifications
     * and leaks nothing.
     */
    let matchedIndex = -1;
    for (const [index, hash] of state.recoveryCodeHashes.entries()) {
      const matches = await this.hasher.verify(hash, normalised);
      if (matches && matchedIndex === -1) matchedIndex = index;
    }

    if (matchedIndex === -1) {
      throw new BusinessRuleException('MFA_VERIFICATION_FAILED', 'The code was not accepted.');
    }

    // Consumption is REMOVAL. Leaving a spent hash with a flag would make "how many remain" a
    // question the array can no longer answer, and §2.8's low-water prompt reads that count.
    const remaining = state.recoveryCodeHashes.filter((_, index) => index !== matchedIndex);
    await this.store.replaceRecoveryCodes(command.userId, remaining);

    // §2.8: "Using one is an `audit_log` event and notifies the user." The audit row is written
    // here; the notification is the caller's, because this use case must not know about email.
    await this.audit.append({
      tenantId: null, // an identity event — `users` has no tenant
      actorId: command.userId,
      actorType: 'USER',
      entityType: 'user_mfa',
      entityId: command.userId,
      action: 'UPDATE',
      // The code itself is NEVER in the audit row. It is a live credential until this moment and
      // the log estate outlives it by seven years.
      before: { recoveryCodesRemaining: state.recoveryCodeHashes.length },
      after: { recoveryCodesRemaining: remaining.length },
      reason: 'A recovery code was used in place of the second factor.',
      correlationId: command.correlationId,
    });

    return {
      method: 'RECOVERY_CODE',
      recoveryCodesRemaining: remaining.length,
      shouldRegenerateRecoveryCodes: remaining.length < RECOVERY_CODE_LOW_WATER_MARK,
    };
  }
}
