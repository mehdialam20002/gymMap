/**
 * M-020 · `POST /v1/auth/login` — `FR-AUTH-08`, `Security.md` §1.6, `Authentication.md` §8.4.
 *
 * ┌─ THE ORDER OF THE FIRST TWO STEPS IS THE SECURITY PROPERTY ─────────────────────────────────┐
 * │ LOCKOUT CHECK, THEN VERIFY. Never the reverse.                                               │
 * │                                                                                              │
 * │ Verifying first and then checking the lock leaks the answer through timing in the one case  │
 * │ that matters: a locked account with the CORRECT password takes a full Argon2id verification │
 * │ before its 403, while a locked account with a wrong password takes the same — but an        │
 * │ unlocked wrong password takes the same again, and the attacker has learned the lock state   │
 * │ is independent of the guess. Worse, it burns 250 ms of our CPU per attempt on an account we │
 * │ have already decided not to authenticate, which is a free amplification factor.              │
 * │                                                                                              │
 * │ Checking the lock first means a locked account costs one Redis read, and the flood stops    │
 * │ at the cheapest possible point.                                                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ AN UNKNOWN IDENTIFIER TAKES THE SAME PATH, AND THE SAME TIME ──────────────────────────────┐
 * │ `Security.md` §1.6. Three things must be identical between "no such account" and "wrong     │
 * │ password", and all three are easy to lose one at a time:                                     │
 * │                                                                                              │
 * │   STATUS   both 401. Enforced by there being no other error class — see `iam.errors.ts`.     │
 * │   BODY     both `UNAUTHENTICATED`. Enforced by no other code being registered.               │
 * │   TIMING   both pay a full Argon2id verification. Enforced HERE, by `burnEquivalentWork`.    │
 * │                                                                                              │
 * │ The third is the one that gets forgotten, because nothing about the code looks wrong         │
 * │ without it — the early `return` for an unknown user reads as an obvious optimisation.        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ A FAILED LOGIN AGAINST AN UNKNOWN IDENTIFIER INCREMENTS NOTHING ───────────────────────────┐
 * │ `Authentication.md` §6: the counter records *"failed PASSWORD verifications only"*, and     │
 * │ there is no account to count against. Counting them would build a second enumeration oracle │
 * │ out of the lockout itself — eleven attempts against a real address behaves differently from │
 * │ eleven against a fictional one, and the difference is observable on the twelfth.             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../../common/config/app-config.schema.js';
import { CLOCK, type Clock } from '../../common/clock/clock.port.js';
import { UnauthenticatedException } from '../../common/errors/domain-exception.js';
import { AccountLockedError } from '../domain/iam.errors.js';
import { evaluateLockout, lockoutMessage } from '../domain/lockout.policy.js';
import { PASSWORD_HASHER, type PasswordHasher } from './ports/password-hasher.port.js';
import { LOCKOUT_COUNTER, type LockoutCounter } from './ports/lockout-counter.port.js';
import {
  UserPrismaRepository,
  normaliseIdentifier,
  type AuthenticationSubject,
} from '../infrastructure/user.prisma-repository.js';

export interface LoginCommand {
  readonly identifier: string;
  readonly password: string;
}

export interface LoginResult {
  readonly userId: string;
  /** Whether the stored hash was upgraded during this login — for the metric, not the response. */
  readonly rehashed: boolean;
}

@Injectable()
export class LoginWithPasswordUseCase {
  private readonly logger = new Logger(LoginWithPasswordUseCase.name);

  constructor(
    private readonly users: UserPrismaRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(LOCKOUT_COUNTER) private readonly lockout: LockoutCounter,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const identifier = normaliseIdentifier(command.identifier);
    const subject = await this.users.findForAuthentication(identifier);

    if (subject === null) {
      // The decoy path. Costs the same as a real verification — see the header. The result is
      // discarded because it is always false; the COST is the entire point.
      await this.hasher.burnEquivalentWork(command.password);
      throw new UnauthenticatedException('Login attempted with an unknown identifier.');
    }

    await this.assertNotLocked(subject);

    // An OTP-only account reaches here with a null hash. It is not "wrong password" and it is
    // not an error worth distinguishing — the member has no password, so no password is correct.
    // Still burns the work, or the absence of a hash is measurable.
    if (subject.passwordHash === null) {
      await this.hasher.burnEquivalentWork(command.password);
      throw new UnauthenticatedException('Login attempted against an account with no password.');
    }

    const correct = await this.hasher.verify(subject.passwordHash, command.password);

    if (!correct) {
      const failures = await this.lockout.recordFailure(subject.id);
      // Crossing the threshold on THIS attempt is what records a lock, for the 24-hour
      // escalation window. Recorded here rather than on the next attempt's check, or three
      // locks in a day could never be observed — the check only runs when someone tries again.
      //
      // `=== threshold`, not `>=`. The escalation counts LOCKS, and the account locks once when
      // the count crosses ten; attempts eleven and twelve are refused by `assertNotLocked`
      // before reaching here, but a threshold lowered by configuration mid-window could leave a
      // counter already above it, and `>=` would then record a lock on every subsequent failure.
      if (failures === this.config.LOCKOUT_THRESHOLD) await this.lockout.recordLock(subject.id);

      throw new UnauthenticatedException('Login attempted with an incorrect password.');
    }

    // ── Success ────────────────────────────────────────────────────────────────────────────
    await this.lockout.clearFailures(subject.id);

    // The re-hash upgrade path. THE ONLY MOMENT the plaintext is available, so skipping it means
    // an Argon2id parameter raise never reaches an existing account — every member who does not
    // change their password keeps the old cost forever (`Security.md` §2.4.2).
    let rehashed = false;
    if (this.hasher.needsRehash(subject.passwordHash)) {
      await this.users.setPasswordHash(subject.id, await this.hasher.hash(command.password));
      rehashed = true;
      this.logger.log({ message: 'password rehashed at current parameters', userId: subject.id });
    }

    await this.users.recordLogin(subject.id, this.clock.now());

    return { userId: subject.id, rehashed };
  }

  /**
   * Throws `AccountLockedError` when the account is locked.
   *
   * Runs BEFORE any verification — see the header. Costs one Redis read.
   */
  private async assertNotLocked(subject: AuthenticationSubject): Promise<void> {
    const counters = await this.lockout.read(subject.id);
    const outcome = evaluateLockout(
      { ...counters, hasPassword: subject.passwordHash !== null },
      this.clock.now(),
    );
    if (!outcome.locked) return;

    const channel = maskedUnlockChannel(subject);
    throw new AccountLockedError({
      lockedUntil: outcome.lockedUntil,
      unlockChannels: channel === null ? [] : [channel],
      message: lockoutMessage({
        maskedChannel: channel,
        // IST, because the launch market is India and `TM6` makes the presentation timezone a
        // presentation concern. A member told "14:22 UTC" has to do arithmetic to use it.
        lockedUntilLocal: formatIst(outcome.lockedUntil),
        escalated: outcome.escalated,
      }),
    });
  }
}

/**
 * A masked channel the member can unlock through, or `null` if they have no VERIFIED one.
 *
 * Verified only. Offering a code to an unverified address would send it somewhere nobody has
 * proved they control — which turns the unlock path into a way IN rather than a way back.
 */
export function maskedUnlockChannel(subject: AuthenticationSubject): string | null {
  if (subject.phoneVerifiedAt !== null && subject.phone !== null) {
    return `your mobile ending ${subject.phone.slice(-5)}`;
  }
  if (subject.emailVerifiedAt !== null && subject.email !== null) {
    const [local, domain] = subject.email.split('@');
    if (local === undefined || domain === undefined) return null;
    return `your email ${local[0] ?? ''}***@${domain}`;
  }
  return null;
}

/** `HH:MM IST`. The launch market's zone — `LAUNCH_MARKET_INDIA.md`, UTC+05:30, no DST. */
export function formatIst(at: Date): string {
  const formatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at);
  return `${formatted} IST`;
}
