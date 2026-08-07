/**
 * M-021 · The five OTP limits, each at its boundary from BOTH sides — `FR-AUTH-05`, `BAC-06`.
 *
 * A boundary tested from one side passes against an off-by-one. Every limit below is therefore
 * asserted at n-1 and at n.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  INDIAN_MOBILE,
  OTP_CAPTCHA_THRESHOLD_PER_IP,
  OTP_LENGTH,
  OTP_MAX_PER_IP_PER_HOUR,
  OTP_MAX_SENDS_PER_WINDOW,
  OTP_MAX_VERIFY_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_SEND_WINDOW_SECONDS,
  OTP_TTL_SECONDS,
  evaluateSend,
  formatOtpCode,
  verifyAttemptsRemaining,
} from '../dist/iam/domain/otp.policy.js';
import {
  OTP_PURPOSES,
  isPublicPurpose,
  sendsToUnknownNumber,
} from '../dist/iam/domain/otp-purpose.js';

const counters = (over: Record<string, unknown> = {}) =>
  ({
    sendsInWindow: 0,
    secondsSinceLastSend: null,
    operationsFromIp: 0,
    captchaSatisfied: false,
    ...over,
  }) as never;

// ═══════════════════════════════════════════════════════════════════════════
// FR-AUTH-05 · the five numbers, exactly as the requirement states them.
// ═══════════════════════════════════════════════════════════════════════════

test('FR-AUTH-05 · six digits, 300 seconds, 5 attempts, 3 sends, 30-second cool-down', () => {
  assert.equal(OTP_LENGTH, 6);
  assert.equal(OTP_TTL_SECONDS, 300);
  assert.equal(OTP_MAX_VERIFY_ATTEMPTS, 5);
  assert.equal(OTP_MAX_SENDS_PER_WINDOW, 3);
  assert.equal(OTP_SEND_WINDOW_SECONDS, 1_800);
  assert.equal(OTP_RESEND_COOLDOWN_SECONDS, 30);
  assert.equal(OTP_MAX_PER_IP_PER_HOUR, 20);
  assert.equal(OTP_CAPTCHA_THRESHOLD_PER_IP, 10);
});

// ═══════════════════════════════════════════════════════════════════════════
// The per-number window — 3 sends per 30 minutes.
// ═══════════════════════════════════════════════════════════════════════════

test('AC-2 · the THIRD send is allowed and the FOURTH is refused', () => {
  // The refusal is what AC-AUTH-01.4 hangs on: the 4th returns 429 AND NO SMS IS SENT.
  assert.equal(evaluateSend(counters({ sendsInWindow: 2 })).kind, 'ALLOWED');

  const fourth = evaluateSend(counters({ sendsInWindow: 3 }));
  assert.equal(fourth.kind, 'RESEND_LIMIT');
  assert.ok(fourth.kind === 'RESEND_LIMIT' && fourth.retryAfterSeconds === 1_800);
});

// ═══════════════════════════════════════════════════════════════════════════
// The cool-down — 30 seconds between sends.
// ═══════════════════════════════════════════════════════════════════════════

test('AC-3 · 29 seconds is too soon and 30 is allowed', () => {
  const tooSoon = evaluateSend(counters({ secondsSinceLastSend: 29 }));
  assert.equal(tooSoon.kind, 'COOLDOWN');
  assert.ok(tooSoon.kind === 'COOLDOWN' && tooSoon.retryAfterSeconds === 1);

  assert.equal(evaluateSend(counters({ secondsSinceLastSend: 30 })).kind, 'ALLOWED');
});

test('the FIRST send has no cool-down to violate', () => {
  // `secondsSinceLastSend: null` must not be treated as zero — `null < 30` is true in JavaScript
  // via coercion, and a naive comparison would refuse every first request in the system.
  assert.equal(evaluateSend(counters({ secondsSinceLastSend: null })).kind, 'ALLOWED');
});

test('the cool-down retry hint counts DOWN, so it is usable', () => {
  const early = evaluateSend(counters({ secondsSinceLastSend: 5 }));
  assert.ok(early.kind === 'COOLDOWN' && early.retryAfterSeconds === 25);
});

// ═══════════════════════════════════════════════════════════════════════════
// The per-IP ceiling — INDEPENDENT of the per-number one. AC-4.
// ═══════════════════════════════════════════════════════════════════════════

test('AC-4 · the captcha is demanded at 10 and the hard block lands at 20', () => {
  // The gap is deliberate. A shared NAT — an office, a college, an Indian carrier's CGNAT, which
  // is most consumer traffic — legitimately produces many requests from one address. Blocking at
  // 10 denies real members; challenging at 10 lets a human through and stops a script.
  assert.equal(evaluateSend(counters({ operationsFromIp: 9 })).kind, 'ALLOWED');
  assert.equal(evaluateSend(counters({ operationsFromIp: 10 })).kind, 'CAPTCHA_REQUIRED');
  assert.equal(evaluateSend(counters({ operationsFromIp: 19 })).kind, 'CAPTCHA_REQUIRED');
  assert.equal(evaluateSend(counters({ operationsFromIp: 20 })).kind, 'IP_LIMIT');
});

test('AC-4 · a SOLVED captcha lets the caller through, up to the hard ceiling', () => {
  assert.equal(
    evaluateSend(counters({ operationsFromIp: 15, captchaSatisfied: true })).kind,
    'ALLOWED',
  );
  // But it does NOT lift the hard ceiling. A captcha proves a human, not an entitlement.
  assert.equal(
    evaluateSend(counters({ operationsFromIp: 20, captchaSatisfied: true })).kind,
    'IP_LIMIT',
  );
});

test('the two ceilings are INDEPENDENT — this is the documented trap', () => {
  // An attacker cycling ten thousand DIFFERENT numbers never trips a per-number limit even
  // once. Only the per-IP ceiling stops them, and at ~₹0.15 a message that is the whole
  // financial exposure (CON-02).
  const freshNumberFromBusyIp = counters({ sendsInWindow: 0, operationsFromIp: 20 });
  assert.equal(evaluateSend(freshNumberFromBusyIp).kind, 'IP_LIMIT');

  // And conversely: one number hammered from many addresses still hits the per-number limit,
  // which is what stops a member being SMS-bombed by a distributed script.
  const busyNumberFromFreshIp = counters({ sendsInWindow: 3, operationsFromIp: 0 });
  assert.equal(evaluateSend(busyNumberFromFreshIp).kind, 'RESEND_LIMIT');
});

test('the per-IP ceiling is evaluated BEFORE the cool-down', () => {
  // Order matters. Telling an abuser at request 500 to "wait 30 seconds" says the number is
  // otherwise fine, which is a better answer than they have earned.
  const both = counters({ operationsFromIp: 20, secondsSinceLastSend: 1 });
  assert.equal(evaluateSend(both).kind, 'IP_LIMIT');
});

// ═══════════════════════════════════════════════════════════════════════════
// Verify attempts.
// ═══════════════════════════════════════════════════════════════════════════

test('attemptsRemaining counts down from 5 and floors at zero', () => {
  assert.equal(verifyAttemptsRemaining(0), 5);
  assert.equal(verifyAttemptsRemaining(4), 1);
  assert.equal(verifyAttemptsRemaining(5), 0);
  assert.equal(verifyAttemptsRemaining(99), 0, 'a negative count would render as "-94 left"');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-9 · the number format. India-only, and never guessed.
// ═══════════════════════════════════════════════════════════════════════════

test('AC-9 · a valid Indian mobile is accepted', () => {
  for (const number of ['+919876543210', '+916000000000', '+917999999999', '+918123456789']) {
    assert.ok(INDIAN_MOBILE.test(number), `${number} was rejected`);
  }
});

test('AC-9 · a BARE ten-digit number is REJECTED, not guessed', () => {
  // Prefixing +91 for the caller looks helpful and is exactly how a foreign number silently
  // becomes an Indian one — the same ten digits are a valid subscriber number elsewhere.
  assert.equal(INDIAN_MOBILE.test('9876543210'), false);
  assert.equal(INDIAN_MOBILE.test('09876543210'), false);
});

test('AC-9 · a non-Indian country code is rejected at the pattern', () => {
  for (const number of ['+14155550123', '+971501234567', '+447700900000']) {
    assert.equal(INDIAN_MOBILE.test(number), false, `${number} was accepted`);
  }
});

test('AC-9 · a +91 landline or unallocated range is rejected', () => {
  // Indian mobiles start 6, 7, 8 or 9. Sending an SMS to +91 1–5 costs money and delivers
  // nothing, which is the same waste the per-IP ceiling exists to bound.
  for (const number of ['+911234567890', '+915123456789', '+912212345678']) {
    assert.equal(INDIAN_MOBILE.test(number), false, `${number} was accepted`);
  }
});

test('the wrong LENGTH is rejected either way', () => {
  assert.equal(INDIAN_MOBILE.test('+91987654321'), false, 'nine digits accepted');
  assert.equal(INDIAN_MOBILE.test('+9198765432101'), false, 'eleven digits accepted');
});

// ═══════════════════════════════════════════════════════════════════════════
// The code itself.
// ═══════════════════════════════════════════════════════════════════════════

test('a code is always six characters, zero-padded', () => {
  // `42315` is a five-character string that will never match a six-digit input, so a member
  // holding a code beginning with zero would be locked out of their own account.
  assert.equal(formatOtpCode(0), '000000');
  assert.equal(formatOtpCode(42_315), '042315');
  assert.equal(formatOtpCode(999_999), '999999');
  for (const value of [0, 1, 42, 42_315, 999_999]) {
    assert.equal(formatOtpCode(value).length, OTP_LENGTH);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Purposes — Security.md §2.3.5.
// ═══════════════════════════════════════════════════════════════════════════

test('there are exactly five purposes', () => {
  assert.deepEqual(
    [...OTP_PURPOSES],
    ['REGISTER', 'LOGIN', 'PHONE_CHANGE', 'UNLOCK', 'SENSITIVE_STEP_UP'],
  );
});

test('PHONE_CHANGE and SENSITIVE_STEP_UP are NOT reachable unauthenticated', () => {
  // Both presuppose a session — they are re-proofs, not ways in. Allowing PHONE_CHANGE
  // unauthenticated turns it into an account-takeover primitive: send a code to a number you
  // control, present it, own the account.
  assert.equal(isPublicPurpose('PHONE_CHANGE'), false);
  assert.equal(isPublicPurpose('SENSITIVE_STEP_UP'), false);

  assert.equal(isPublicPurpose('REGISTER'), true);
  assert.equal(isPublicPurpose('LOGIN'), true);
  assert.equal(isPublicPurpose('UNLOCK'), true);
});

test('only REGISTER delivers to a number with no account', () => {
  assert.equal(sendsToUnknownNumber('REGISTER'), true);
  for (const purpose of ['LOGIN', 'PHONE_CHANGE', 'UNLOCK', 'SENSITIVE_STEP_UP'] as const) {
    assert.equal(sendsToUnknownNumber(purpose), false, `${purpose} would text a stranger`);
  }
});
