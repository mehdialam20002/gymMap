/**
 * M-021 · The five OTP limits — `FR-AUTH-05`, `Authentication.md` §8.1, `Security.md` §10.3.
 *
 * ┌─ THERE ARE TWO INDEPENDENT CEILINGS, AND IMPLEMENTING ONE IS THE COMMON MISTAKE ────────────┐
 * │ PER NUMBER: 3 sends per 30 minutes, with a 30-second cool-down between them.                │
 * │ PER IP:     20 OTP operations per hour, with a captcha demanded from the 11th.               │
 * │                                                                                              │
 * │ The per-number limit protects the MEMBER — from being SMS-bombed by someone who knows their │
 * │ number. The per-IP limit protects the PLATFORM: at roughly ₹0.15 a message, an unbounded    │
 * │ OTP endpoint is a direct financial exposure (`CON-02`), and an attacker cycling through ten │
 * │ thousand numbers never trips a per-number limit even once.                                   │
 * │                                                                                              │
 * │ Neither substitutes for the other. `Milestones_000-029.md` M-021 names implementing only    │
 * │ one of the two as the trap.                                                                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE CAPTCHA ARRIVES BEFORE THE BLOCK, NOT INSTEAD OF IT ───────────────────────────────────┐
 * │ §8.1's validation table puts the challenge at 10 per-IP operations and the hard ceiling at  │
 * │ 20. The gap is deliberate: a shared NAT — an office, a college, a mobile carrier's CGNAT,   │
 * │ which in India is most consumer traffic — legitimately produces many OTP requests from one  │
 * │ address. Blocking at 10 would deny real members; challenging at 10 lets a human through and │
 * │ stops a script.                                                                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/** `FR-AUTH-05`, exactly. Six digits — not five, not eight. */
export const OTP_LENGTH = 6;

/** 300 seconds. Long enough for an SMS to arrive on a slow rail, short enough to matter. */
export const OTP_TTL_SECONDS = 300;

/** Verify attempts against ONE code, before it is destroyed. */
export const OTP_MAX_VERIFY_ATTEMPTS = 5;

/** Sends per number, per window. */
export const OTP_MAX_SENDS_PER_WINDOW = 3;
export const OTP_SEND_WINDOW_SECONDS = 30 * 60;

/** The minimum gap between two sends to one number. */
export const OTP_RESEND_COOLDOWN_SECONDS = 30;

/** The per-IP ceiling, and the point at which a captcha is demanded. See the header. */
export const OTP_MAX_PER_IP_PER_HOUR = 20;
export const OTP_CAPTCHA_THRESHOLD_PER_IP = 10;
export const OTP_IP_WINDOW_SECONDS = 60 * 60;

/**
 * `LAUNCH_MARKET_INDIA.md` — Phase 1 is India-only.
 *
 * `+91` then a digit in 6–9 then nine more. Indian mobile numbers start 6, 7, 8 or 9; a `+91`
 * followed by 1–5 is a landline or an invalid range, and sending an SMS to it costs money and
 * delivers nothing.
 *
 * A bare ten-digit number is REJECTED rather than guessed. Prefixing `+91` for the caller looks
 * helpful and is how a `+1` number silently becomes an Indian one — the same ten digits are a
 * valid subscriber number in several countries.
 */
export const INDIAN_MOBILE = /^\+91[6-9]\d{9}$/;

export type OtpSendRefusal =
  | { readonly kind: 'ALLOWED' }
  | { readonly kind: 'COOLDOWN'; readonly retryAfterSeconds: number }
  | { readonly kind: 'RESEND_LIMIT'; readonly retryAfterSeconds: number }
  | { readonly kind: 'CAPTCHA_REQUIRED' }
  | { readonly kind: 'IP_LIMIT'; readonly retryAfterSeconds: number };

export interface SendCounters {
  /** Sends to this number inside the 30-minute window. */
  readonly sendsInWindow: number;
  /** Seconds since the last send to this number, or `null` if there was none. */
  readonly secondsSinceLastSend: number | null;
  /** OTP operations from this IP inside the hour. */
  readonly operationsFromIp: number;
  /** Whether the caller supplied a captcha token that verified. */
  readonly captchaSatisfied: boolean;
}

/**
 * Decides whether a send is permitted. Pure — the counters come from Redis.
 *
 * ORDER MATTERS, and it is cheapest-and-most-specific first:
 *
 *   1. The per-IP HARD ceiling. Refuses an abuser before anything else is computed.
 *   2. The captcha threshold. A challenge, not a refusal — the caller can proceed by solving it.
 *   3. The per-number cool-down. The most common legitimate refusal: an impatient member.
 *   4. The per-number window limit.
 *
 * Putting the cool-down first would make an attacker's 500th request from one IP return
 * "wait 30 seconds", which tells them the number is otherwise fine and is a worse answer than
 * the one they deserve.
 */
export function evaluateSend(counters: SendCounters): OtpSendRefusal {
  if (counters.operationsFromIp >= OTP_MAX_PER_IP_PER_HOUR) {
    return { kind: 'IP_LIMIT', retryAfterSeconds: OTP_IP_WINDOW_SECONDS };
  }

  if (counters.operationsFromIp >= OTP_CAPTCHA_THRESHOLD_PER_IP && !counters.captchaSatisfied) {
    return { kind: 'CAPTCHA_REQUIRED' };
  }

  if (
    counters.secondsSinceLastSend !== null &&
    counters.secondsSinceLastSend < OTP_RESEND_COOLDOWN_SECONDS
  ) {
    return {
      kind: 'COOLDOWN',
      retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS - counters.secondsSinceLastSend,
    };
  }

  if (counters.sendsInWindow >= OTP_MAX_SENDS_PER_WINDOW) {
    return { kind: 'RESEND_LIMIT', retryAfterSeconds: OTP_SEND_WINDOW_SECONDS };
  }

  return { kind: 'ALLOWED' };
}

/** Attempts left against the current code. Never negative. */
export function verifyAttemptsRemaining(attempts: number): number {
  return Math.max(0, OTP_MAX_VERIFY_ATTEMPTS - attempts);
}

/**
 * A six-digit code, from a CSPRNG, uniformly distributed.
 *
 * ┌─ NOT `Math.random()`, AND NOT `% 1000000` ──────────────────────────────────────────────────┐
 * │ `Math.random()` is not cryptographically secure and is forbidden by the `no-bare-date`      │
 * │ rule's sibling — a predictable OTP is not a second factor at all.                            │
 * │                                                                                              │
 * │ The modulo is the subtler half. Taking `randomInt % 1000000` over a 32-bit draw biases the  │
 * │ low codes, because 2^32 is not a multiple of 10^6: codes below 967,296 are very slightly    │
 * │ more likely. `randomInt(0, 1_000_000)` from `node:crypto` rejects-and-retries internally    │
 * │ and is uniform.                                                                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function formatOtpCode(value: number): string {
  // Zero-padded. `042315` is a valid code and `42315` is a five-digit string that will not match.
  return String(value).padStart(OTP_LENGTH, '0');
}
