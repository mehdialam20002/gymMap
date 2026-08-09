/**
 * `M-024` · Enrolling a second factor — `FR-AUTH-07`, `Security.md` §2.8, acceptance criteria 2–4.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * TWO STEPS, AND THE SECOND ONE IS WHAT STOPS PEOPLE LOCKING THEMSELVES OUT
 *
 * §2.8: enrolment *"requires password re-authentication, then a live code to confirm before the
 * secret becomes effective. Enrolling without confirmation is how people lock themselves out."*
 *
 *   begin()    re-authenticate, mint a secret, store it PENDING, hand back the provisioning URI
 *   confirm()  verify a live code from the authenticator, THEN activate and issue recovery codes
 *
 * One-step enrolment is the version that reads simpler and is wrong: the secret becomes mandatory
 * the moment it is stored, so a QR that failed to scan, or an authenticator on a phone whose clock
 * is an hour out, locks a staff account out of a system that now demands the factor. The pending
 * state exists precisely so that failure is recoverable by walking away.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ THE RECOVERY CODES ARE ISSUED AT CONFIRMATION, NOT AT BEGIN ───────────────────────────────┐
 * │ Issuing them alongside the QR is tempting — one screen, one trip. It hands ten working        │
 * │ credentials to somebody who has not yet proved they can produce a code, and if they abandon   │
 * │ enrolment those codes exist for an account with no factor. Confirmation is the first moment    │
 * │ the factor is real, so it is the first moment the fallback should be.                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_WRITE_PORT, type AuditWritePort } from '../../audit/ports/audit-write.port.js';
import { CLOCK, type Clock } from '../../common/clock/clock.port.js';
import { BusinessRuleException } from '../../common/errors/domain-exception.js';
import { MFA_STORE, type MfaStore } from './ports/mfa-store.port.js';
import { PASSWORD_HASHER, type PasswordHasher } from './ports/password-hasher.port.js';
import { SECRET_CIPHER, type SecretCipher } from '../infrastructure/secret-cipher.js';
import {
  generateTotpSecret,
  provisioningUri,
  verifyTotp,
} from '../infrastructure/totp.adapter.js';
import { RECOVERY_CODE_COUNT, mayEnrolMfa } from '../domain/mfa.policy.js';
import { generateRecoveryCodes, normaliseRecoveryCode } from '../domain/recovery-code.vo.js';
import type { PlatformRole } from '../types/iam.types.js';

export interface BeginEnrolmentCommand {
  readonly userId: string;
  /** The account's own label in the authenticator app. An email or phone, never the user id. */
  readonly accountLabel: string;
  readonly roles: readonly PlatformRole[];
  /** §2.8 — re-authentication. Enrolment changes how the account is secured. */
  readonly password: string;
  readonly storedPasswordHash: string | null;
  readonly correlationId: string;
}

export interface BeginEnrolmentResult {
  /** Rendered as a QR by the client and never persisted — the secret is inside it. */
  readonly provisioningUri: string;
}

export interface ConfirmEnrolmentCommand {
  readonly userId: string;
  readonly code: string;
  readonly correlationId: string;
}

export interface ConfirmEnrolmentResult {
  /**
   * The ten codes in PLAINTEXT. Returned exactly once, by this call, and never again — only the
   * Argon2id hashes are stored. A caller that fails to show them has cost the user their fallback.
   */
  readonly recoveryCodes: readonly string[];
}

@Injectable()
export class EnrolMfaUseCase {
  constructor(
    @Inject(MFA_STORE) private readonly store: MfaStore,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AUDIT_WRITE_PORT) private readonly audit: AuditWritePort,
  ) {}

  async begin(command: BeginEnrolmentCommand): Promise<BeginEnrolmentResult> {
    // The policy question first, before any work and before any secret exists. A `RECEPTIONIST`
    // asking to enrol is refused because the factor is NOT_OFFERED to that role in Phase 1 — not
    // because they lack a permission, which is why this is 422 rather than 403.
    if (!mayEnrolMfa(command.roles)) {
      throw new BusinessRuleException(
        'MFA_NOT_AVAILABLE_FOR_ROLE',
        'This role cannot enrol a second factor in this phase.',
      );
    }

    /*
     * §2.8's re-authentication. Enrolment changes how the account is secured, so a session someone
     * walked away from must not be enough — the classic attack is an unattended logged-in desk,
     * where enrolling an attacker's authenticator converts borrowed access into permanent access.
     *
     * `storedPasswordHash === null` is an OTP-only account. It is refused rather than waved
     * through: there is no password to re-authenticate with, so the control cannot be satisfied,
     * and skipping it "because they have no password" removes the protection for exactly the
     * accounts that cannot fall back on one.
     */
    if (command.storedPasswordHash === null) {
      await this.hasher.burnEquivalentWork(command.password);
      throw new BusinessRuleException(
        'MFA_VERIFICATION_FAILED',
        'This account has no password to re-authenticate with.',
      );
    }

    const reauthenticated = await this.hasher.verify(command.storedPasswordHash, command.password);
    if (!reauthenticated) {
      throw new BusinessRuleException('MFA_VERIFICATION_FAILED', 'The password was not accepted.');
    }

    const secret = generateTotpSecret();

    /*
     * Overwrites any previous pending secret, which the port documents and this relies on.
     *
     * Starting enrolment twice must leave exactly one secret usable. If the first survived, a QR
     * screenshotted and abandoned would stay a valid second factor forever — an credential the
     * user does not know exists and cannot revoke.
     */
    await this.store.savePendingSecret(command.userId, this.cipher.seal(secret));

    // No audit row here. Nothing has changed about the account's security yet: a pending secret
    // that is never confirmed is indistinguishable from a page nobody submitted, and a row saying
    // "MFA enrolled" for an abandoned attempt is worse than no row.
    return { provisioningUri: provisioningUri(secret, command.accountLabel) };
  }

  async confirm(command: ConfirmEnrolmentCommand): Promise<ConfirmEnrolmentResult> {
    const state = await this.store.read(command.userId);

    if (state === null || state.secretEnvelope === null) {
      throw new BusinessRuleException(
        'MFA_VERIFICATION_FAILED',
        'There is no enrolment in progress for this account.',
      );
    }

    // ┌─ CONFIRMING TWICE MUST NOT REISSUE RECOVERY CODES ────────────────────────────────────────┐
    // │ Without this, a replayed confirmation generates a fresh set and silently invalidates the   │
    // │ ten the user already wrote down — so the codes in their password manager stop working with │
    // │ no event they would ever notice, and they find out when they have lost their phone.        │
    // └────────────────────────────────────────────────────────────────────────────────────────────┘
    if (state.enabled) {
      throw new BusinessRuleException(
        'MFA_VERIFICATION_FAILED',
        'This account already has an active second factor.',
      );
    }

    const secret = this.cipher.open(state.secretEnvelope);
    const verdict = verifyTotp(secret, command.code, this.clock.now().getTime(), state.lastStep);

    if (!verdict.valid || verdict.step === null) {
      throw new BusinessRuleException('MFA_VERIFICATION_FAILED', 'The code was not accepted.');
    }

    const codes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
    const hashes = await Promise.all(
      // Normalised BEFORE hashing, matching what verification will normalise a submission to. Hash
      // the displayed form with its separator and a user typing it back exactly is told it is wrong.
      codes.map((code) => this.hasher.hash(normaliseRecoveryCode(code))),
    );

    const at = this.clock.now();

    /*
     * One write. The flag, the timestamp, the codes and the first accepted step land together,
     * because every intermediate state is wrong: enabled with no recovery codes locks a lost device
     * out permanently, and codes without the flag hands out ten credentials for a factor that is
     * not on. `activate()` also seeds `mfa_last_step` from the confirming code, so that code cannot
     * immediately be replayed as a login.
     */
    await this.store.activate({
      userId: command.userId,
      at,
      recoveryCodeHashes: hashes,
      firstAcceptedStep: verdict.step,
    });

    await this.audit.append({
      tenantId: null, // an identity event — `users` has no tenant
      actorId: command.userId,
      actorType: 'USER',
      entityType: 'USER',
      entityId: command.userId,
      action: 'UPDATE',
      // Neither the secret nor the codes appear. Both are live credentials, and the audit estate
      // outlives them by seven years.
      before: { mfaEnabled: false },
      after: { mfaEnabled: true, recoveryCodesIssued: codes.length },
      reason: 'A second factor was enrolled and confirmed with a live code.',
      correlationId: command.correlationId,
    });

    return { recoveryCodes: codes };
  }
}
