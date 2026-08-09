/**
 * `M-024` · RFC 6238 TOTP — `FR-AUTH-07`, `NFR-SEC-11`, `Security.md` §2.8.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS IS HAND-ROLLED, WHICH IS NORMALLY THE WRONG ANSWER FOR A CRYPTOGRAPHIC PRIMITIVE
 *
 * `Security.md` §2.8 proposes `otplib` as **`A-33`**, and `A-33` cannot be used. It sits inside the
 * contested `A-31`…`A-39` block — claimed simultaneously by `CI_CD.md` (SBOM), `Monitoring.md`
 * (paging) and `Security.md` §2.8 (TOTP) — which is `BLK-09`, open, and the project owner's to
 * resolve. `STACK_ADDITIONS.md`'s standing rule is that a dependency without an APPROVED `A-NN` row
 * is a review blocker, and `PROPOSED` is not approved.
 *
 * So the two available options were: add an unapproved dependency (forbidden), or take the
 * alternative `A-33`'s own row names — *"Hand-rolled RFC 6238 over `node:crypto` (fewer
 * dependencies, but a cryptographic primitive written in-house is a review liability)"*.
 *
 * That liability is real and it is ANSWERABLE, which is the only reason this file exists: RFC 6238
 * publishes official test vectors in Appendix B, so this implementation is not asserted correct — it
 * is checked against the standard's own numbers in `totp.spec.ts`. A hand-rolled primitive nobody
 * can verify is a liability; one that reproduces the RFC's published output is an implementation.
 *
 * If the owner resolves `BLK-09` and approves a library, this file is deleted and the spec is
 * pointed at the library instead. The test vectors stay either way.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ NOTHING NOVEL IS INVENTED HERE ────────────────────────────────────────────────────────────┐
 * │ The dangerous kind of home-made cryptography invents a construction. This invents nothing: the │
 * │ HMAC is `node:crypto`'s, which is OpenSSL's, and the surrounding code is the dynamic-truncation │
 * │ arithmetic RFC 4226 §5.4 specifies literally. The only judgement calls are the parameters, and  │
 * │ §2.8 fixes all of them: 6 digits, 30-second step, SHA-1, ±1 step.                               │
 * │                                                                                                │
 * │ SHA-1 is correct here and is not a weakness: HMAC-SHA-1 is unaffected by the collision attacks  │
 * │ that retired bare SHA-1, and it is the interoperable profile every authenticator app implements.│
 * │ An account nobody can enrol on their phone protects nothing.                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** `Security.md` §2.8: 30-second step, 6 digits, ±1 step of drift. Not configurable per call. */
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const TOTP_DRIFT_STEPS = 1;

/** 160 bits, per §2.8. The SHA-1 block/output size, which is what RFC 4226 §4 recommends. */
export const TOTP_SECRET_BYTES = 20;

/**
 * One RFC 4226 HOTP value for a counter.
 *
 * `digits` is a parameter ONLY so the RFC 6238 Appendix B vectors — which are 8 digits — can be
 * reproduced exactly. Production always takes the 6 the constant above fixes; a caller choosing a
 * digit count per request is how two devices end up disagreeing about the same secret.
 */
export function hotp(secret: Buffer, counter: bigint, digits: number = TOTP_DIGITS): string {
  // 8-byte big-endian counter — RFC 4226 §5.1. `BigInt` rather than `number` because a JavaScript
  // number loses integer precision above 2^53, and while a step counter will not reach that for
  // eight million years, the RFC's own vectors include T=20000000000 specifically to catch a
  // 32-bit truncation, and this must reproduce them.
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);

  const digest = createHmac('sha1', secret).update(message).digest();

  // Dynamic truncation — RFC 4226 §5.4, transcribed rather than paraphrased.
  const offset = (digest[digest.length - 1] as number) & 0x0f;
  const binary =
    (((digest[offset] as number) & 0x7f) << 24) |
    (((digest[offset + 1] as number) & 0xff) << 16) |
    (((digest[offset + 2] as number) & 0xff) << 8) |
    ((digest[offset + 3] as number) & 0xff);

  return String(binary % 10 ** digits).padStart(digits, '0');
}

/** The step counter for a moment in time. Exported because replay protection stores it. */
export function stepAt(atMs: number): bigint {
  return BigInt(Math.floor(atMs / 1000 / TOTP_STEP_SECONDS));
}

/** The code a correctly-configured authenticator shows at `atMs`. */
export function totp(secret: Buffer, atMs: number, digits: number = TOTP_DIGITS): string {
  return hotp(secret, stepAt(atMs), digits);
}

export interface TotpVerification {
  readonly valid: boolean;
  /**
   * The step the code belonged to. The caller MUST persist it and refuse anything at or below it —
   * `Security.md` §2.8: *"a code from an already-accepted step is refused. Without this, a code
   * observed over the shoulder is valid for up to 90 seconds."*
   *
   * `null` when the code did not verify, so there is nothing to record.
   */
  readonly step: bigint | null;
}

/**
 * Verifies a submitted code within the ±1 step window.
 *
 * ┌─ `lastAcceptedStep` IS NOT OPTIONAL POLISH ─────────────────────────────────────────────────┐
 * │ Without it the same six digits stay valid for the whole ±1 window — 90 seconds — so a code    │
 * │ read over somebody's shoulder, or captured by a phishing page and replayed, works. The window  │
 * │ exists for clock drift, not to give a code a longer life, and the replay guard is what keeps   │
 * │ those two things separate.                                                                     │
 * │                                                                                                │
 * │ Steps are checked oldest-first so that the step RETURNED is the one the code actually belongs   │
 * │ to. Returning the newest matching step would advance the stored counter further than the        │
 * │ evidence supports and silently invalidate a legitimate code the user is about to submit.        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function verifyTotp(
  secret: Buffer,
  submitted: string,
  atMs: number,
  lastAcceptedStep: bigint | null = null,
): TotpVerification {
  // Reject before doing any HMAC work — a submission of the wrong shape cannot be a valid code, and
  // there is nothing to learn from timing here that the length does not already reveal.
  if (!/^\d+$/.test(submitted) || submitted.length !== TOTP_DIGITS) {
    return { valid: false, step: null };
  }

  const current = stepAt(atMs);

  for (let delta = -TOTP_DRIFT_STEPS; delta <= TOTP_DRIFT_STEPS; delta += 1) {
    const step = current + BigInt(delta);

    // Already used, or older than one already used. Skipped rather than compared, so a replay
    // cannot be distinguished from a wrong code by how long the answer takes.
    if (lastAcceptedStep !== null && step <= lastAcceptedStep) continue;

    if (constantTimeEquals(hotp(secret, step), submitted)) {
      return { valid: true, step };
    }
  }

  return { valid: false, step: null };
}

/**
 * Compares two codes without leaking their agreement through timing.
 *
 * A `===` on the digits returns as soon as they differ, so the response time reveals how many
 * leading digits were right. Six digits is only a million possibilities; handing an attacker a
 * digit-by-digit oracle reduces that to sixty guesses.
 */
function constantTimeEquals(expected: string, submitted: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(submitted, 'utf8');
  // `timingSafeEqual` THROWS on a length mismatch, which would itself be a timing signal and a 500.
  // Length is checked by the caller's format guard; this is the backstop.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** A fresh 160-bit secret. `randomBytes` is a CSPRNG; `Math.random` here would be catastrophic. */
export function generateTotpSecret(): Buffer {
  return randomBytes(TOTP_SECRET_BYTES);
}

/**
 * RFC 4648 base32, unpadded — the encoding every authenticator app expects in an `otpauth://` URI.
 *
 * Written out rather than pulled in: it is twenty lines, and it is the same dependency question as
 * the TOTP itself. Base64 would be shorter and is simply not what the format specifies.
 */
export function base32Encode(bytes: Buffer): string {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let out = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  // The trailing partial group is left-aligned, not right — getting this backwards produces a
  // secret that decodes to something else entirely and fails only for some secret lengths.
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];

  return out;
}

/**
 * The `otpauth://` URI the enrolment QR encodes.
 *
 * `issuer` appears twice on purpose — as the label prefix and as a parameter. The Key URI format
 * says the prefix is what older apps read and the parameter is what current ones read, and an app
 * that finds neither files the account under a blank name.
 *
 * The secret is IN this string, so it is returned exactly once at enrolment and never logged:
 * `Security.md` classifies it C5, and Pino's redaction list does not know about this shape.
 */
export function provisioningUri(secret: Buffer, account: string, issuer = 'GymMap'): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret: base32Encode(secret),
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
