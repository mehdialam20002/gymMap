/**
 * M-020 · Account lockout — `FR-AUTH-08`, `Authentication.md` §6, `Security.md` §2.8.4.
 *
 * > *"Account lockout after 10 failed attempts in 15 minutes, with self-service unlock via
 * > verified channel."*
 *
 * ┌─ A LOCKOUT IS A 403, NOT A 429 — `API_Catalog.md` §4.5 ─────────────────────────────────────┐
 * │ Rate limiting is about request VOLUME and clears with time. A lockout is about THIS ACCOUNT │
 * │ and clears with an unlock. Conflating them produces a message that tells the victim of a    │
 * │ credential-stuffing run to "try again in a minute", which is both false and useless.        │
 * │                                                                                              │
 * │ `RL-AUTH` is also 10 per 15 minutes per identifier — the same numbers ON PURPOSE (§4.2), so │
 * │ a caller never sees a 429 and a lockout disagreeing about how many attempts they made. Both │
 * │ trip together and the 403 is returned, because the account condition is the more specific   │
 * │ and the more actionable fact.                                                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS *NOT* COUNTED, AND WHY EACH EXCLUSION MATTERS ─────────────────────────────────────┐
 * │ Failed PASSWORD verifications only.                                                          │
 * │                                                                                              │
 * │   OTP failures        have their own throttle (§2.3). Counting them here would let a member │
 * │                       mistyping a texted code lock themselves out of the password path too. │
 * │   TOTP failures       have their own 5-in-15 MFA lock. Same reasoning.                       │
 * │   Unknown identifiers are not counted AT ALL — there is no account to lock, and counting    │
 * │                       them would build an enumeration oracle out of the lockout itself:      │
 * │                       eleven attempts against a real address behaves differently from        │
 * │                       eleven against a fictional one.                                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE RESIDUAL WEAKNESS, STATED RATHER THAN HIDDEN ──────────────────────────────────────────┐
 * │ Anyone who knows a member's email can lock them out with ten wrong guesses. §6 says so       │
 * │ plainly. Four things bound it and none removes it: the unlock is one OTP away; an           │
 * │ already-authenticated session SURVIVES (`SM3` — the lock gates the password path only); the │
 * │ per-IP ceiling makes locking many accounts expensive; and every lock is audited and alerted, │
 * │ so a campaign is visible. `FR-AUTH-08` mandates the lockout and this is its cost.            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/** `FR-AUTH-08`, exactly. Not "about ten". */
export const LOCKOUT_THRESHOLD = 10;

/** The sliding window the failures are counted over. */
export const LOCKOUT_WINDOW_SECONDS = 15 * 60;

/**
 * How long the lock holds without an unlock.
 *
 * `Authentication.md` §6: *"15 minutes, or until self-service unlock, whichever is sooner"*. The
 * requirement names an unlock path, so an indefinite lock would be non-compliant — a control that
 * cannot be cleared is a denial of service the platform performs on its own member.
 */
export const LOCKOUT_DURATION_SECONDS = 15 * 60;

/** `Security.md` §2.8.4 — three locks in 24 hours is a campaign, not a forgetful member. */
export const LOCKOUT_ESCALATION_THRESHOLD = 3;
export const LOCKOUT_ESCALATION_WINDOW_SECONDS = 24 * 60 * 60;
export const LOCKOUT_ESCALATED_DURATION_SECONDS = 24 * 60 * 60;

export interface LockoutState {
  /** Failed password verifications inside the sliding window. */
  readonly failures: number;
  /** Locks recorded for this account inside the 24-hour escalation window. */
  readonly locksInEscalationWindow: number;
  /**
   * Whether the account can be locked at all.
   *
   * `false` for an OTP-only account: there is no password, so there is nothing to guess and the
   * OTP throttle is the equivalent control (`Security.md` §2.8.4). Locking one would deny a
   * member their only route in, on the strength of attempts against a credential they never set.
   */
  readonly hasPassword: boolean;
}

export type LockoutOutcome =
  | { readonly locked: false }
  | {
      readonly locked: true;
      readonly lockedUntil: Date;
      /** `true` when the 24-hour escalation applies — support is required, not self-service. */
      readonly escalated: boolean;
    };

/**
 * Decides whether this account is locked, given its counters and the current instant.
 *
 * Pure. The counters come from Redis and the instant from the injected `Clock`, so the decision
 * itself is testable from both sides of every boundary without either.
 */
export function evaluateLockout(state: LockoutState, now: Date): LockoutOutcome {
  // An OTP-only account cannot be locked. Checked FIRST: the failure counter may be non-zero
  // from before a password was removed, and that stale count must not deny a member their only
  // way in.
  if (!state.hasPassword) return { locked: false };

  if (state.failures < LOCKOUT_THRESHOLD) return { locked: false };

  const escalated = state.locksInEscalationWindow >= LOCKOUT_ESCALATION_THRESHOLD;
  const seconds = escalated ? LOCKOUT_ESCALATED_DURATION_SECONDS : LOCKOUT_DURATION_SECONDS;

  return {
    locked: true,
    lockedUntil: new Date(now.getTime() + seconds * 1000),
    escalated,
  };
}

/** How many attempts remain before the next one locks. Never negative. */
export function attemptsRemaining(failures: number): number {
  return Math.max(0, LOCKOUT_THRESHOLD - failures);
}

/**
 * The `UM1` / `NFR-USE-05` message. What happened, why, and what next — §6 is explicit that
 * *"'Account locked' alone fails review"*.
 *
 * The channel is passed already MASKED. This function must never see a full phone number or
 * address: `BR-DAT-06` keeps personal data out of the error envelope, and out of the log line the
 * envelope is built from.
 */
export function lockoutMessage(input: {
  readonly maskedChannel: string | null;
  readonly lockedUntilLocal: string;
  readonly escalated: boolean;
}): string {
  const cause =
    `Your account is locked because there were ${String(LOCKOUT_THRESHOLD)} unsuccessful ` +
    `sign-in attempts in the last ${String(LOCKOUT_WINDOW_SECONDS / 60)} minutes. ` +
    'This protects you if someone else is trying to guess your password.';

  if (input.escalated) {
    // Deliberately does NOT offer the OTP path. After three locks in a day the self-service
    // route is what is being abused, and pointing at it would be advice that does not work.
    return (
      `${cause} Because this has happened several times today, unlocking now needs our support ` +
      `team — please contact them. The lock lifts on its own at ${input.lockedUntilLocal}.`
    );
  }

  const remedy =
    input.maskedChannel === null
      ? `Please wait until ${input.lockedUntilLocal} and try again.`
      : `Unlock it now with a code sent to ${input.maskedChannel}, or wait until ` +
        `${input.lockedUntilLocal} and try again.`;

  return `${cause} ${remedy}`;
}
