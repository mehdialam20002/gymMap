/**
 * M-020 · `POST /v1/auth/register` — `FR-AUTH-01`, `FR-AUTH-04`, `Authentication.md` §8.3.
 *
 * ┌─ THE BREACH CHECK IS ADVISORY, AND ITS ABSENCE IS RECORDED RATHER THAN HIDDEN ──────────────┐
 * │ `Milestones_000-029.md` M-020's note is explicit: the provider *"times out fast, logs the   │
 * │ miss, and lets the registration proceed; the alternative is an availability incident caused │
 * │ by a control that is advisory."* `CON-02` budgets third-party cost and `NFR-AVL-*` does not │
 * │ permit a sign-up outage because a reputation service is slow.                                │
 * │                                                                                              │
 * │ So `UNAVAILABLE` proceeds — but it INCREMENTS A COUNTER and writes a log line. The           │
 * │ difference between "fails open" and "silently does nothing" is entirely whether anyone can  │
 * │ tell afterwards, and today the check is unavailable ALWAYS (`BLK-09`, `KL-099`). A metric   │
 * │ pinned at 100% is a visible gap; a stub returning `NOT_BREACHED` is an invisible one.        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ REGISTRATION IS THE ONE PLACE THE ENUMERATION RULE BENDS ──────────────────────────────────┐
 * │ A 409 naming the field tells the caller their address is taken. Everywhere else that would  │
 * │ be an oracle; here the caller SUPPLIED the address, so it reveals nothing they did not       │
 * │ already assert — and refusing to say would leave a member unable to distinguish a typo from │
 * │ an account they forgot they had. `Authentication.md` §8.3 accepts the trade explicitly.      │
 * │                                                                                              │
 * │ `/auth/password/forgot` does NOT bend, because there the caller is guessing.                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  CLOCK,
  ID_GENERATOR,
  type Clock,
  type IdGenerator,
} from '../../common/clock/clock.port.js';
import { BusinessRuleException } from '../../common/errors/domain-exception.js';
import { checkPasswordLength, rejectionMessage } from '../domain/password-policy.js';
import {
  EmailAlreadyRegisteredError,
  PasswordBreachedError,
  PhoneAlreadyRegisteredError,
} from '../domain/iam.errors.js';
import { PASSWORD_HASHER, type PasswordHasher } from './ports/password-hasher.port.js';
import {
  BREACHED_PASSWORD_CHECKER,
  type BreachedPasswordChecker,
} from './ports/breached-password.port.js';
import {
  CREDENTIAL_TOKEN_STORE,
  type CredentialTokenStore,
} from './ports/credential-token-store.port.js';
import {
  UserPrismaRepository,
  normaliseIdentifier,
} from '../infrastructure/user.prisma-repository.js';

export interface RegisterCommand {
  readonly email: string | null;
  readonly phone: string | null;
  readonly fullName: string | null;
  readonly password: string;
}

export interface RegisterResult {
  readonly userId: string;
  /** Handed to `notifications/` and never returned in the response. */
  readonly verificationToken: string | null;
  readonly verificationExpiresAt: Date | null;
  /** True when the breach check could not run — the `BLK-09` visibility counter. */
  readonly breachCheckSkipped: boolean;
}

@Injectable()
export class RegisterWithPasswordUseCase {
  private readonly logger = new Logger(RegisterWithPasswordUseCase.name);

  constructor(
    private readonly users: UserPrismaRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(BREACHED_PASSWORD_CHECKER) private readonly breaches: BreachedPasswordChecker,
    @Inject(CREDENTIAL_TOKEN_STORE) private readonly tokens: CredentialTokenStore,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: RegisterCommand): Promise<RegisterResult> {
    // `ck_users__has_contact` enforces this in the database too. Checked here as well so the
    // member gets a field-level message rather than a 500 from a constraint violation.
    if (command.email === null && command.phone === null) {
      throw new BusinessRuleException(
        'VALIDATION_FAILED',
        'Registration supplied neither an email nor a phone.',
        [{ field: 'email' }],
      );
    }

    // ── The password policy, before anything expensive ──────────────────────────────────────
    //
    // Length first: it costs nothing, and rejecting a nine-character password after a 250 ms
    // hash would make registration a free CPU amplifier.
    const length = checkPasswordLength(command.password);
    if (!length.ok && length.rejection !== null) {
      throw new BusinessRuleException(
        'VALIDATION_FAILED',
        // The operator message names the RULE, never the value — AC-FND-09.6.
        `Registration refused: password ${length.rejection}.`,
        [
          {
            field: 'password',
            reason: length.rejection,
            message: rejectionMessage(length.rejection),
          },
        ],
      );
    }

    const verdict = await this.breaches.check(command.password);
    if (verdict === 'BREACHED') throw new PasswordBreachedError();

    const breachCheckSkipped = verdict === 'UNAVAILABLE';
    if (breachCheckSkipped) {
      // See the header. Fails OPEN on the check and CLOSED on the log.
      this.logger.warn({
        message: 'breach check unavailable — registration proceeded without it',
        // No identifier, no password, nothing about the member. FR-AUTH-04 is the subject here,
        // not this person: BR-DAT-06 keeps personal data out of logs on every path.
        requirement: 'FR-AUTH-04',
        blocker: 'BLK-09',
      });
    }

    // ── Uniqueness ───────────────────────────────────────────────────────────────────────────
    //
    // Checked before the hash, for the same amplification reason. The DATABASE is still the
    // authority — two simultaneous registrations of one address both pass this check and one
    // loses on the partial unique index, which the controller maps to the same 409.
    const email = command.email === null ? null : normaliseIdentifier(command.email);
    const phone = command.phone === null ? null : normaliseIdentifier(command.phone);

    if (email !== null && (await this.users.identifierExists(email))) {
      throw new EmailAlreadyRegisteredError();
    }
    if (phone !== null && (await this.users.identifierExists(phone))) {
      throw new PhoneAlreadyRegisteredError();
    }

    // ── The account ──────────────────────────────────────────────────────────────────────────
    const userId = this.ids.uuid();
    await this.users.createWithPassword({
      id: userId,
      // The NORMALISED value is what is stored. Storing the raw input would let
      // `Priya@example.com` and `priya@example.com` be two rows (Schema.md §4.6).
      email: email?.value ?? null,
      phone: phone?.value ?? null,
      fullName: command.fullName,
      passwordHash: await this.hasher.hash(command.password),
    });

    // ── Verification ─────────────────────────────────────────────────────────────────────────
    //
    // Only for an email registration. A phone-only account verifies by OTP, which is M-021's.
    if (email === null) {
      return { userId, verificationToken: null, verificationExpiresAt: null, breachCheckSkipped };
    }

    const issued = await this.tokens.issue('EMAIL_VERIFICATION', userId);
    this.logger.log({
      message: 'account registered',
      userId,
      // The token is NOT logged. It is a bearer credential; a log line containing one is a log
      // aggregator that can take over accounts.
      verificationExpiresAt: issued.expiresAt.toISOString(),
      registeredAt: this.clock.now().toISOString(),
    });

    return {
      userId,
      verificationToken: issued.token,
      verificationExpiresAt: issued.expiresAt,
      breachCheckSkipped,
    };
  }
}
