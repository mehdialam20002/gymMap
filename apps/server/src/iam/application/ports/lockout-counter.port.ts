/**
 * M-020 · The failed-password counter — `FR-AUTH-08`, `Security.md` §2.8.4.
 *
 * ┌─ REDIS, NOT A COLUMN ON `users` ────────────────────────────────────────────────────────────┐
 * │ `Authentication.md` §6 names the storage: `auth:fail:{user_id}` in Redis, sliding 15-minute │
 * │ window. `users` has no `failed_login_attempts` or `locked_until` column and none is         │
 * │ specified — which is the right shape for three reasons beyond following the document:       │
 * │                                                                                              │
 * │   The window expires ITSELF. A column needs a timestamp and a comparison on every read, and │
 * │   a sweep to stop it growing. The Redis TTL is the window.                                   │
 * │                                                                                              │
 * │   A failed login would otherwise WRITE to `users` on every wrong password — turning the      │
 * │   cheapest thing an attacker can do into a row lock on the account they are attacking.       │
 * │                                                                                              │
 * │   Counters are not durable data. Losing them on a Redis restart un-locks some accounts       │
 * │   early, which is a far smaller harm than a lock that outlives its reason.                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

export const LOCKOUT_COUNTER = Symbol('LockoutCounter');

export interface LockoutCounters {
  /** Failed password verifications inside the sliding window. */
  readonly failures: number;
  /** Locks recorded for this account inside the 24-hour escalation window. */
  readonly locksInEscalationWindow: number;
}

export interface LockoutCounter {
  /** Both counters for one user, in one round trip. */
  read(userId: string): Promise<LockoutCounters>;

  /**
   * Records one failed password verification and returns the new count.
   *
   * Returns the post-increment value so the caller does not have to read again — the read and
   * the increment would otherwise race, and two concurrent wrong guesses could both see nine.
   */
  recordFailure(userId: string): Promise<number>;

  /** Records that the account crossed the threshold, for the 24-hour escalation window. */
  recordLock(userId: string): Promise<void>;

  /**
   * Clears the failure counter. Called on a SUCCESSFUL login and on a completed unlock.
   *
   * Does NOT clear the escalation counter: three locks in a day is a fact about the day, and
   * clearing it on the first successful login after each lock would make the escalation
   * unreachable — an attacker who guesses correctly once resets the evidence.
   */
  clearFailures(userId: string): Promise<void>;
}
