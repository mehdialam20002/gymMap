/**
 * M-020 · `POST /v1/auth/password/{forgot,reset}` — `FR-AUTH-10`, `Authentication.md` §8.7, §8.8.
 *
 * ┌─ `forgot` ANSWERS IDENTICALLY WHETHER THE ADDRESS EXISTS OR NOT ────────────────────────────┐
 * │ Unlike registration, the caller here is GUESSING. A response that differs — in status, in   │
 * │ body, or in how long it took — is an account-existence oracle that works against any        │
 * │ address anyone cares to try.                                                                 │
 * │                                                                                              │
 * │ Status and body are trivially identical: one `202`, one fixed message, no branch. TIMING is │
 * │ the hard one, because the real path issues a token and writes to Redis while the unknown    │
 * │ path does nothing. So the unknown path performs the SAME WORK against a discard — the same  │
 * │ shape of defence as `burnEquivalentWork` on login, for the same reason.                      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ A RESET REVOKES EVERY SESSION, AND THAT IS THE WHOLE POINT OF A RESET ─────────────────────┐
 * │ `FR-AUTH-10`. `Authentication.md` §8.8: *"Not revoking sessions would violate FR-AUTH-10    │
 * │ and is not a compatibility question."*                                                       │
 * │                                                                                              │
 * │ The reason is the scenario a reset EXISTS for: someone else is in the account. Changing the │
 * │ password without ending their session changes nothing for them — they keep the access they  │
 * │ already have, and the member believes they have just locked the intruder out.                │
 * │                                                                                              │
 * │ The revoke and the hash write are ONE transaction. Split, a crash between them leaves       │
 * │ either a new password with the old sessions alive, or revoked sessions and the old password │
 * │ still working — and the member cannot tell which happened.                                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { CLOCK, type Clock } from '../../common/clock/clock.port.js';
import { BusinessRuleException } from '../../common/errors/domain-exception.js';
import { PrismaService } from '../../tenancy/prisma/prisma.service.js';
import { checkPasswordLength, rejectionMessage } from '../domain/password-policy.js';
import { PasswordBreachedError, ResetTokenInvalidError } from '../domain/iam.errors.js';
import { PASSWORD_HASHER, type PasswordHasher } from './ports/password-hasher.port.js';
import {
  BREACHED_PASSWORD_CHECKER,
  type BreachedPasswordChecker,
} from './ports/breached-password.port.js';
import {
  CREDENTIAL_TOKEN_STORE,
  type CredentialTokenStore,
} from './ports/credential-token-store.port.js';
import { LOCKOUT_COUNTER, type LockoutCounter } from './ports/lockout-counter.port.js';
import {
  UserPrismaRepository,
  normaliseIdentifier,
} from '../infrastructure/user.prisma-repository.js';

export interface RequestResetResult {
  /** Present only when the address matched. `null` is indistinguishable to the caller. */
  readonly token: string | null;
  readonly expiresAt: Date | null;
}

export interface ResetResult {
  readonly userId: string;
  /** `Authentication.md` §8.8 returns this — "3 other devices were signed out". */
  readonly sessionsRevoked: number;
}

@Injectable()
export class ResetPasswordUseCase {
  private readonly logger = new Logger(ResetPasswordUseCase.name);

  constructor(
    private readonly db: PrismaService,
    private readonly users: UserPrismaRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(BREACHED_PASSWORD_CHECKER) private readonly breaches: BreachedPasswordChecker,
    @Inject(CREDENTIAL_TOKEN_STORE) private readonly tokens: CredentialTokenStore,
    @Inject(LOCKOUT_COUNTER) private readonly lockout: LockoutCounter,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * `POST /auth/password/forgot`. Always succeeds, from the caller's point of view.
   *
   * The audit row and the notification happen only on a match — but neither is observable to
   * the caller, which is what makes the branch safe.
   */
  async requestReset(rawIdentifier: string): Promise<RequestResetResult> {
    const identifier = normaliseIdentifier(rawIdentifier);
    const subject = await this.users.findForAuthentication(identifier);

    if (subject === null) {
      // The equivalent-work path. Issues a token against a discard id and immediately drops it,
      // so an unknown address costs the same Redis round trips as a known one. Without this the
      // difference is one `SET`, one `SADD` and one `EXPIRE` — small, and entirely measurable
      // over enough samples.
      await this.tokens.issue('PASSWORD_RESET', DISCARD_SUBJECT);
      await this.tokens.revokeAll('PASSWORD_RESET', DISCARD_SUBJECT);
      this.logger.log({ message: 'reset requested for an unknown identifier' });
      return { token: null, expiresAt: null };
    }

    const issued = await this.tokens.issue('PASSWORD_RESET', subject.id);
    this.logger.log({
      message: 'password reset requested',
      userId: subject.id,
      expiresAt: issued.expiresAt.toISOString(),
    });
    return { token: issued.token, expiresAt: issued.expiresAt };
  }

  /** `POST /auth/password/reset`. */
  async reset(token: string, newPassword: string): Promise<ResetResult> {
    // Policy BEFORE consuming the token. A password that fails the length rule must not burn
    // the member's one-use link — they would have to request a new one to fix a typo.
    const length = checkPasswordLength(newPassword);
    if (!length.ok && length.rejection !== null) {
      throw new BusinessRuleException(
        'VALIDATION_FAILED',
        `Password reset refused: password ${length.rejection}.`,
        [
          {
            field: 'new_password',
            reason: length.rejection,
            message: rejectionMessage(length.rejection),
          },
        ],
      );
    }
    if ((await this.breaches.check(newPassword)) === 'BREACHED') throw new PasswordBreachedError();

    // Atomic redeem. Two simultaneous uses of one link cannot both pass here.
    const userId = await this.tokens.consume('PASSWORD_RESET', token);
    if (userId === null) throw new ResetTokenInvalidError();

    const passwordHash = await this.hasher.hash(newPassword);
    const at = this.clock.now();

    // ONE transaction — see the header. A crash between the two writes leaves a state the
    // member cannot distinguish from success.
    const sessionsRevoked = await this.db.client.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      const revoked = await tx.authSession.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: at, revokedReason: 'PASSWORD_RESET' },
      });
      return revoked.count;
    });

    // After the transaction, and deliberately so: neither is part of the atomic guarantee, and
    // a Redis failure must not roll back a password the member has already been told changed.
    //
    // Every OTHER outstanding reset link dies now. A member who clicked "forgot" three times has
    // three live links; without this the window stays open for the full TTL after the password
    // changed, and a second intercepted link changes it straight back.
    await this.tokens.revokeAll('PASSWORD_RESET', userId);
    // A reset is a legitimate way out of a lockout — the member has proved control of a verified
    // channel, which is exactly what FR-AUTH-08's self-service unlock asks for.
    await this.lockout.clearFailures(userId);

    this.logger.log({ message: 'password reset completed', userId, sessionsRevoked });
    return { userId, sessionsRevoked };
  }
}

/**
 * A fixed, non-existent subject for the unknown-address equivalent-work path.
 *
 * A constant rather than a random uuid: a random one would create a new Redis index key on every
 * probe, so an attacker spraying addresses would grow the keyspace without bound — turning an
 * enumeration defence into a memory-exhaustion vector.
 */
const DISCARD_SUBJECT = '00000000-0000-7000-8000-000000000000';
