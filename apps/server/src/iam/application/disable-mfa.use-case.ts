/**
 * `M-024` · Turning the second factor off — `FR-AUTH-07`, acceptance criterion 6.
 *
 * ┌─ THE REFUSAL IS 422, NOT 403, AND THE DIFFERENCE IS NOT PEDANTRY ───────────────────────────┐
 * │ Criterion 6: *"`DELETE /v1/auth/mfa` is refused for a platform-staff role — the factor is     │
 * │ mandatory, so disabling it is not an available operation, and the refusal is a `422` with a   │
 * │ registry code rather than a `403`."*                                                          │
 * │                                                                                              │
 * │ A `SUPER_ADMIN` holds every permission there is. Answering 403 would tell them they lack      │
 * │ authorisation, which is false, and send them looking for a permission that cannot exist. What │
 * │ is true is that the domain offers this operation to nobody — the same shape as                │
 * │ `LAST_OWNER_PROTECTED`, and the reason both are business refusals rather than authorisation   │
 * │ ones.                                                                                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Re-authentication is required here for the same reason as at enrolment, and more sharply:
 * removing a factor is the single most valuable thing an attacker at an unattended desk can do.
 */

import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_WRITE_PORT, type AuditWritePort } from '../../audit/ports/audit-write.port.js';
import { BusinessRuleException } from '../../common/errors/domain-exception.js';
import { MFA_STORE, type MfaStore } from './ports/mfa-store.port.js';
import { PASSWORD_HASHER, type PasswordHasher } from './ports/password-hasher.port.js';
import { mayDisableMfa } from '../domain/mfa.policy.js';
import type { PlatformRole } from '../types/iam.types.js';

export interface DisableMfaCommand {
  readonly userId: string;
  readonly roles: readonly PlatformRole[];
  readonly password: string;
  readonly storedPasswordHash: string | null;
  readonly correlationId: string;
}

@Injectable()
export class DisableMfaUseCase {
  constructor(
    @Inject(MFA_STORE) private readonly store: MfaStore,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(AUDIT_WRITE_PORT) private readonly audit: AuditWritePort,
  ) {}

  async execute(command: DisableMfaCommand): Promise<void> {
    /*
     * The policy FIRST, before the password is examined.
     *
     * Checking the password first would make this endpoint a password oracle for staff accounts:
     * "wrong password" and "not allowed" are different answers, and only one of them depends on the
     * password. Answering the policy first means a staff account gives the same reply whatever is
     * submitted, which is also the honest reply — the operation was never available.
     */
    const verdict = mayDisableMfa(command.roles);
    if (!verdict.permitted) {
      throw new BusinessRuleException('MFA_MANDATORY_FOR_ROLE', verdict.reason);
    }

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

    const before = await this.store.read(command.userId);

    // Clearing an account that has nothing to clear is a no-op that still audits. It is not an
    // error: the user asked for a state, and they are already in it.
    await this.store.clear(command.userId);

    await this.audit.append({
      tenantId: null,
      actorId: command.userId,
      actorType: 'USER',
      entityType: 'user_mfa',
      entityId: command.userId,
      action: 'UPDATE',
      // Removing a second factor is one of the highest-signal events in the estate — it is what an
      // account takeover does before it does anything else. `before` records that the factor WAS
      // on, which is the fact an investigation needs and the only one the row can still show.
      before: { mfaEnabled: before?.enabled ?? false },
      after: { mfaEnabled: false },
      reason: 'The account holder removed their second factor.',
      correlationId: command.correlationId,
    });
  }
}
