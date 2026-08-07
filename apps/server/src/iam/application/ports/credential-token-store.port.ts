/**
 * M-020 · Single-use credential tokens — `Authentication.md` §8.3, §8.7, `NFR-SEC-07`, ADR-0034.
 *
 * ┌─ THE TOKEN IS NEVER STORED. ONLY ITS SHA-256 IS ────────────────────────────────────────────┐
 * │ `NFR-SEC-07`. The value handed to the member goes in an email and nowhere else; what the    │
 * │ platform keeps is a digest, so a dump of the store is not a set of working reset links.     │
 * │                                                                                              │
 * │ SHA-256 and not Argon2id, deliberately — `Security.md` §2.4.2 draws the same line for        │
 * │ refresh tokens. These are 256-bit CSPRNG values with no entropy deficit: there is nothing    │
 * │ to brute-force, so a slow hash would add 250 ms to every verification link for no gain.      │
 * │ Argon2id is for values a HUMAN chose.                                                         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ CONSUMPTION IS ATOMIC, WHICH IS THE WHOLE POINT OF THE PORT ───────────────────────────────┐
 * │ "Single use" is a concurrency claim, not a bookkeeping one. A read-then-delete lets two     │
 * │ simultaneous uses of one reset token both succeed, and the second one is the attacker who   │
 * │ intercepted the email. `consume()` must be one atomic operation — `GETDEL` in the Redis     │
 * │ adapter — and the port exists so no call site can be written any other way.                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

export const CREDENTIAL_TOKEN_STORE = Symbol('CredentialTokenStore');

/**
 * What the token is FOR. Bound into the storage key, so a verification token cannot be
 * presented to the reset endpoint even though both are 256-bit hex strings of the same shape.
 *
 * Mirrors the purpose-binding `Security.md` §2.3.5 requires of OTP codes, for the same reason:
 * a credential that works in more than one place is a credential whose blast radius is unknown.
 */
export type CredentialTokenPurpose = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';

export interface IssuedToken {
  /** The value to send to the member. Held in memory only, never logged, never persisted. */
  readonly token: string;
  /** When it stops working, for the message that tells the member how long they have. */
  readonly expiresAt: Date;
}

export interface CredentialTokenStore {
  /** Mints a 256-bit CSPRNG token, stores its SHA-256 against `userId`, and returns the value. */
  issue(purpose: CredentialTokenPurpose, userId: string): Promise<IssuedToken>;

  /**
   * Atomically redeems a token and returns the user it belonged to, or `null`.
   *
   * `null` covers never-existed, already-used and expired without distinguishing them — the
   * caller could not act differently on each anyway, and telling them apart would say whether a
   * guessed value was ever real.
   */
  consume(purpose: CredentialTokenPurpose, token: string): Promise<string | null>;

  /**
   * Invalidates every outstanding token of one purpose for one user.
   *
   * Called when a reset COMPLETES: a member who clicked "forgot password" three times has three
   * live links, and two of them must stop working the moment the first is used. Without this,
   * the reset window stays open for the full TTL after the password has already changed.
   */
  revokeAll(purpose: CredentialTokenPurpose, userId: string): Promise<void>;
}
