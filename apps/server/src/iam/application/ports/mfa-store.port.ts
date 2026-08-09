/**
 * `M-024` · What the MFA use cases need from persistence — `FR-AUTH-07`, `Security.md` §2.8.
 *
 * ┌─ A PORT, BECAUSE THE INTERESTING LOGIC MUST BE TESTABLE WITHOUT A DATABASE ─────────────────┐
 * │ Everything hard about MFA is decision logic: is this code inside the drift window, has this   │
 * │ step already been used, which recovery code did they spend, may this role turn the factor off.│
 * │ None of that needs PostgreSQL, and a suite that boots one to ask "is a replayed code refused" │
 * │ is slow enough that the awkward cases quietly stop being covered.                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * No method takes a tenant id — §11.5 `BR5`. `users` is an IDENTITY table with no tenant column at
 * all, so there is nothing to scope by and nothing to get wrong here.
 */

/** The MFA state of one account, as the use cases need to see it. */
export interface MfaState {
  readonly userId: string;
  /** `users.mfa_enabled` — the flag. Bound to `enrolledAt` by a database CHECK. */
  readonly enabled: boolean;
  readonly enrolledAt: Date | null;
  /** The sealed envelope, or `null`. Present-but-not-enabled is a PENDING enrolment. */
  readonly secretEnvelope: string | null;
  /** Argon2id PHC strings. Consuming one removes it, so the length is the remaining count. */
  readonly recoveryCodeHashes: readonly string[];
  /** Highest accepted TOTP step. `null` before the first successful verification. */
  readonly lastStep: bigint | null;
}

export const MFA_STORE = Symbol('MfaStore');

export interface MfaStore {
  read(userId: string): Promise<MfaState | null>;

  /**
   * Stores a PENDING secret: the envelope is written, the flag is not set.
   *
   * Deliberately separate from activation. §2.8 requires a live code before the factor becomes
   * effective, and one method that wrote both would make the unconfirmed state unreachable —
   * which is how people lock themselves out of an account they never finished enrolling on.
   *
   * Replaces any previous pending secret: starting enrolment again must not leave the first
   * secret usable, or a QR screenshotted and abandoned stays a valid second factor forever.
   */
  savePendingSecret(userId: string, envelope: string): Promise<void>;

  /**
   * Activates the factor and stores the recovery codes, in ONE write.
   *
   * One method rather than three, because the intermediate states are all wrong: enabled with no
   * recovery codes locks a lost device out permanently, and codes stored without the flag hands
   * somebody ten working credentials for a factor that is not on.
   */
  activate(input: {
    readonly userId: string;
    readonly at: Date;
    readonly recoveryCodeHashes: readonly string[];
    readonly firstAcceptedStep: bigint;
  }): Promise<void>;

  /**
   * Records the highest accepted step. Called on every successful verification.
   *
   * The store must refuse to move it BACKWARDS. Two requests verifying concurrently can otherwise
   * interleave so the older step is written last, and the newer code becomes replayable.
   */
  recordAcceptedStep(userId: string, step: bigint): Promise<void>;

  /** Replaces the remaining recovery codes. Consumption is a removal, so this is the write. */
  replaceRecoveryCodes(userId: string, hashes: readonly string[]): Promise<void>;

  /** Clears every MFA column. Only reachable when the policy permits disabling. */
  clear(userId: string): Promise<void>;
}
