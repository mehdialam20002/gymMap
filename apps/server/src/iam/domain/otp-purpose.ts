/**
 * M-021 · What an OTP is FOR — `Security.md` §2.3.5, `Milestones_000-029.md` M-021.
 *
 * ┌─ THE PURPOSE IS HMAC'd WITH THE CODE, NOT STORED BESIDE IT ─────────────────────────────────┐
 * │ §2.3.5 calls this purpose binding, and the word "cryptographically" is load-bearing: a code │
 * │ is *"HMAC'd together with its purpose, so it is cryptographically unusable outside it"*.     │
 * │                                                                                              │
 * │ A `purpose` column that the verifier compares would work until somebody forgot the          │
 * │ comparison — and the failure is silent and severe. Every code is six digits, so a code      │
 * │ legitimately texted for `REGISTER` would satisfy an `UNLOCK` challenge on an account under  │
 * │ attack. Binding it into the MAC means the wrong purpose produces a different digest and     │
 * │ simply does not match; there is no comparison anyone can forget.                             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/** The five purposes of `Milestones_000-029.md` M-021. */
export const OTP_PURPOSES = [
  /** Creating an account against a phone number. */
  'REGISTER',
  /** Signing in — the `FR-AUTH-01` consumer default in the launch market. */
  'LOGIN',
  /** Proving control of a NEW number before it replaces the old one. */
  'PHONE_CHANGE',
  /** `FR-AUTH-08`'s self-service unlock, to a VERIFIED channel. */
  'UNLOCK',
  /** Re-proving presence before a sensitive action inside an existing session. */
  'SENSITIVE_STEP_UP',
] as const;

export type OtpPurpose = (typeof OTP_PURPOSES)[number];

/**
 * Whether this purpose may be requested by an UNAUTHENTICATED caller.
 *
 * `PHONE_CHANGE` and `SENSITIVE_STEP_UP` both presuppose a session — they are re-proofs, not
 * ways in. Allowing them unauthenticated would turn `PHONE_CHANGE` into an account-takeover
 * primitive: send a code to a number you control, present it, own the account.
 */
export function isPublicPurpose(purpose: OtpPurpose): boolean {
  return purpose === 'REGISTER' || purpose === 'LOGIN' || purpose === 'UNLOCK';
}

/**
 * Whether an OTP for this purpose should be sent to a number with NO account.
 *
 * `REGISTER` — yes: there is no account yet, that is the point.
 * Everything else — no. But the RESPONSE is identical either way (`AC-5`): the same 202, the
 * same body, the same timing. The SMS is simply not sent. A 404 here is an enumeration oracle
 * over every phone number in India, and `§8.1`'s future-compatibility table forbids it outright.
 */
export function sendsToUnknownNumber(purpose: OtpPurpose): boolean {
  return purpose === 'REGISTER';
}
