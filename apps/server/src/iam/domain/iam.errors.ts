/**
 * M-020 · The `iam/` domain errors — `Authentication.md` §8.2, `Security.md` §1.6.
 *
 * ┌─ THERE IS NO `InvalidCredentialsError`, AND THAT IS THE MOST IMPORTANT LINE HERE ───────────┐
 * │ A failed login throws `UnauthenticatedException` — the shared one — whether the identifier  │
 * │ is unknown or the password is wrong. `Security.md` §1.6 requires the two to be              │
 * │ indistinguishable, and a distinct error class is how that requirement gets undone: someone  │
 * │ adds one for a clearer log line, the filter maps it to a distinct code, and the response    │
 * │ body becomes an enumeration oracle that needs no timing analysis at all.                     │
 * │                                                                                              │
 * │ The class not existing is the enforcement. `domain-exception.filter.spec.ts` additionally   │
 * │ asserts that no such CODE is registered.                                                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { DomainException } from '../../common/errors/domain-exception.js';

/**
 * `409`. Registration found the address already in use.
 *
 * Registration is the ONE place §1.6's enumeration rule bends, and `Authentication.md` §8.3
 * accepts it: the caller supplied the address, so telling them it is taken reveals nothing they
 * did not already provide — and refusing to say would make the form unusable, because the member
 * cannot tell a typo from an existing account.
 *
 * It does NOT bend anywhere else. `/auth/password/forgot` answers identically for a known and an
 * unknown address, because there the caller is guessing rather than asserting.
 */
export class EmailAlreadyRegisteredError extends DomainException {
  constructor() {
    super('EMAIL_ALREADY_REGISTERED', 'Registration attempted with an email already in use.', [
      { field: 'email' },
    ]);
  }
}

export class PhoneAlreadyRegisteredError extends DomainException {
  constructor() {
    super('PHONE_ALREADY_REGISTERED', 'Registration attempted with a phone already in use.', [
      { field: 'phone' },
    ]);
  }
}

/** `422`. The chosen password is in a breach corpus — `FR-AUTH-04`. */
export class PasswordBreachedError extends DomainException {
  constructor() {
    super('PASSWORD_BREACHED', 'The chosen password appears in a breach corpus.', [
      { field: 'password' },
    ]);
  }
}

/**
 * `403`. `FR-AUTH-08`.
 *
 * Carries the per-request `clientMessage`, because `UM1` and `Authentication.md` §6 require the
 * failure count, the window, the masked unlock channel and the local unlock time in the text —
 * four values a static map cannot hold. §6: *"'Account locked' alone fails review."*
 *
 * `details` carries the same facts in machine-readable form, so a client can render its own
 * countdown rather than parsing the sentence.
 */
export class AccountLockedError extends DomainException {
  constructor(input: {
    readonly lockedUntil: Date;
    readonly unlockChannels: readonly string[];
    readonly message: string;
  }) {
    super(
      'ACCOUNT_LOCKED',
      // The OPERATOR message. Never shown to the member — it names the account state, which the
      // member-facing text deliberately does not.
      `Account locked until ${input.lockedUntil.toISOString()} after repeated password failures.`,
      [
        {
          locked_until: input.lockedUntil.toISOString(),
          // Already masked by the caller. BR-DAT-06: a raw address or number must not reach the
          // error envelope, and the envelope is built from the same object the log line is.
          unlock_channels: [...input.unlockChannels],
        },
      ],
      input.message,
    );
  }
}

/**
 * `422`. A reset link that is unknown, spent or expired.
 *
 * One error for all three states, deliberately. A token is a bearer credential: distinguishing
 * "never existed" from "expired" tells an attacker whether a guessed value was ever real.
 */
export class ResetTokenInvalidError extends DomainException {
  constructor() {
    super('RESET_TOKEN_INVALID', 'Password reset presented an unknown, spent or expired token.');
  }
}

/** `422`. The same reasoning as `ResetTokenInvalidError`, for the verification link. */
export class VerificationTokenInvalidError extends DomainException {
  constructor() {
    super(
      'VERIFICATION_TOKEN_INVALID',
      'Email verification presented an unknown, spent or expired token.',
    );
  }
}
