/**
 * M-020 · The `/v1/auth/*` request contracts — `A-02`, `Authentication.md` §5.2, ADR-0033.
 *
 * ┌─ SHARED, BECAUSE THE ALTERNATIVE IS TWO POLICIES ───────────────────────────────────────────┐
 * │ These live in `@gymmap/types` and not in `apps/server` so the front ends validate against    │
 * │ the SAME schema the API enforces. A client-side copy drifts — and the direction it drifts   │
 * │ is always the same: the form accepts something the server refuses, and the member is told   │
 * │ "something went wrong" after typing a password twice.                                        │
 * │                                                                                              │
 * │ `R2` permits this: types cross app boundaries through `packages/types`, which is exactly    │
 * │ what this is.                                                                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE POLICY SCHEMA AND THE PRESENTATION SCHEMA ARE DIFFERENT, ON PURPOSE ───────────────────┐
 * │ `chosenPassword` binds where a password is CHOSEN — register, reset. 10–128 (ADR-0033).     │
 * │ `presentedPassword` binds where one is PRESENTED — login. 1–256.                             │
 * │                                                                                              │
 * │ Using the policy schema on login would refuse a member whose stored password predates the   │
 * │ policy, locking them out of their own account with no path forward. `Authentication.md`     │
 * │ §8.4 keeps them separate for that reason and this file makes the two names impossible to    │
 * │ confuse at a call site.                                                                      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { z } from 'zod';

/** ADR-0033 — the value that satisfies both `Security.md` §2.4.1 and `Authentication.md` §5.2. */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * A password being CHOSEN.
 *
 * No `.trim()`. `Security.md` §2.4.1 preserves leading and trailing whitespace — a password is a
 * byte string, and silently trimming makes the stored hash disagree with what the member typed.
 *
 * The message keys are keys, not sentences: `NFR-USE-08` renders them per locale, and a literal
 * English string here would be the one part of the response the i18n layer cannot reach.
 */
export const chosenPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, 'password_min_length')
  .max(PASSWORD_MAX_LENGTH, 'password_max_length');

/** A password being PRESENTED. Never the policy — see the header. */
export const presentedPassword = z.string().min(1, 'password_required').max(256);

/** `Authentication.md` §5.2. Lowercased at the boundary; the repository normalises again. */
export const emailAddress = z
  .string()
  .email('email_invalid')
  .max(254, 'email_too_long')
  .transform((value) => value.trim().toLowerCase());

/** E.164. The primary identifier in the launch market (`FR-AUTH-02`). */
export const indianPhone = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'phone_not_e164')
  .describe('E.164, e.g. +919876543210');

/**
 * `.strict()` on every body — an unknown key is REJECTED, not ignored.
 *
 * `Authentication.md` §3.7. The failure it prevents: a client sends `{ email, password, role }`
 * hoping the server binds whatever it recognises. Stripping unknown keys silently accepts that
 * request; rejecting it makes the attempt visible in the logs.
 */
export const registerBody = z
  .object({
    email: emailAddress.nullish(),
    phone: indianPhone.nullish(),
    full_name: z.string().min(1).max(200).nullish(),
    password: chosenPassword,
  })
  .strict()
  // `ck_users__has_contact` in the database says the same thing. Here as well, so the member
  // gets a field-level message rather than a 500 from a constraint violation.
  .refine((body) => Boolean(body.email) || Boolean(body.phone), {
    message: 'contact_required',
    path: ['email'],
  });

export const loginBody = z
  .object({
    // ONE field, not `email` or `phone`. A member types what they know; asking them to classify
    // it first is a form that fails for the person who typed their number into the email box.
    identifier: z.string().min(1, 'identifier_required').max(254),
    password: presentedPassword,
  })
  .strict();

export const forgotPasswordBody = z
  .object({
    identifier: z.string().min(1, 'identifier_required').max(254),
  })
  .strict();

export const resetPasswordBody = z
  .object({
    // 32 bytes as hex. Shape-checked here so a malformed value never reaches Redis.
    token: z.string().regex(/^[0-9a-f]{64}$/, 'token_malformed'),
    new_password: chosenPassword,
  })
  .strict();

export type RegisterBody = z.infer<typeof registerBody>;
export type LoginBody = z.infer<typeof loginBody>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBody>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBody>;

// ═══════════════════════════════════════════════════════════════════════════
// M-021 · phone OTP — FR-AUTH-05, Authentication.md §8.1.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `+91` then 6–9 then nine digits. `LAUNCH_MARKET_INDIA.md` — Phase 1 is India-only.
 *
 * Stricter than `indianPhone` above, which accepts any E.164. An OTP costs money to send: a
 * `+1` or `+971` number is rejected at the pipe rather than dispatched and silently undelivered,
 * and a `+91` followed by 1–5 is a landline or an unallocated range.
 *
 * A BARE TEN-DIGIT NUMBER IS REJECTED, NOT GUESSED. Prefixing `+91` for the caller looks helpful
 * and is exactly how a foreign number becomes an Indian one — the same ten digits are a valid
 * subscriber number in several countries.
 */
export const indianMobile = z
  .string()
  .regex(/^\+91[6-9]\d{9}$/, 'phone_not_indian_mobile')
  .describe('Indian mobile in E.164, e.g. +919876543210');

/** The five purposes. An OTP is cryptographically bound to one — Security.md §2.3.5. */
export const otpPurpose = z.enum([
  'REGISTER',
  'LOGIN',
  'PHONE_CHANGE',
  'UNLOCK',
  'SENSITIVE_STEP_UP',
]);

export const otpRequestBody = z
  .object({
    phone: indianMobile,
    purpose: otpPurpose,
    /** Required from the 11th per-IP operation in an hour — §8.1's validation table. */
    captcha_token: z.string().min(1).max(4096).nullish(),
  })
  .strict();

export const otpVerifyBody = z
  .object({
    phone: indianMobile,
    purpose: otpPurpose,
    // Exactly six digits. `.length(6)` and not `.min(6)`: a longer string whose first six digits
    // match must not verify, and a client sending `"123456\n"` should get a 400 rather than a
    // confusing OTP_INVALID.
    code: z.string().regex(/^\d{6}$/, 'otp_code_malformed'),
  })
  .strict();

// ─────────────────────────────────────────────────────────────────────────────
// M-024 · the second factor — `FR-AUTH-07`, `Security.md` §2.8
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Beginning enrolment. Re-authentication only — the secret is minted server-side.
 *
 * The client never proposes a secret. Accepting one would let a caller enrol a key an attacker
 * already holds, which is the whole attack the two-step flow exists to make visible.
 */
export const mfaEnrolBody = z
  .object({
    password: z.string().min(1).max(512),
  })
  .strict();

/**
 * Confirming enrolment, and presenting the factor at sign-in. One shape for both.
 *
 * `code` is deliberately loose — six digits OR a recovery code. The server decides which by shape,
 * and a schema that split them would push that decision to the client and split the rate limit
 * with it: an attacker who exhausts the TOTP budget would simply switch fields.
 *
 * `.max(64)` rather than an exact pattern: a submission that cannot be either form must reach the
 * use case and be answered with the same refusal as a wrong code. A 400 here would distinguish
 * "malformed" from "wrong", which is the oracle §2.8's single failure code exists to prevent.
 */
export const mfaVerifyBody = z
  .object({
    code: z.string().min(1).max(64),
  })
  .strict();

/** Removing the factor. Re-authentication, for the same reason as enrolment and more sharply. */
export const mfaDisableBody = z
  .object({
    password: z.string().min(1).max(512),
  })
  .strict();

export type MfaEnrolBody = z.infer<typeof mfaEnrolBody>;
export type MfaVerifyBody = z.infer<typeof mfaVerifyBody>;
export type MfaDisableBody = z.infer<typeof mfaDisableBody>;

export type OtpPurposeValue = z.infer<typeof otpPurpose>;
export type OtpRequestBody = z.infer<typeof otpRequestBody>;
export type OtpVerifyBody = z.infer<typeof otpVerifyBody>;
