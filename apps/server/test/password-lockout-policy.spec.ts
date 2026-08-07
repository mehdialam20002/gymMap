/**
 * M-020 · The password policy and the lockout policy — `FR-AUTH-04`, `FR-AUTH-08`, ADR-0033.
 *
 * Both are pure: the counters come from Redis and the instant from the injected `Clock`, so
 * every boundary below is asserted FROM BOTH SIDES without either. `BAC-06` requires a negative
 * case for each M-priority rule, and a boundary tested from one side passes against an
 * implementation with an off-by-one.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LOGIN_PASSWORD_MAX_LENGTH,
  LOGIN_PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  checkPasswordLength,
  passwordLength,
  rejectionMessage,
} from '../dist/iam/domain/password-policy.js';
import {
  LOCKOUT_ESCALATED_DURATION_SECONDS,
  LOCKOUT_ESCALATION_THRESHOLD,
  LOCKOUT_THRESHOLD,
  LOCKOUT_WINDOW_SECONDS,
  attemptsRemaining,
  evaluateLockout,
  lockoutMessage,
} from '../dist/iam/domain/lockout.policy.js';

const NOW = new Date('2026-08-07T12:00:00Z');
const state = (over: Record<string, unknown> = {}) =>
  ({ failures: 0, locksInEscalationWindow: 0, hasPassword: true, ...over }) as never;

// ═══════════════════════════════════════════════════════════════════════════
// FR-AUTH-04 — the length floor, from both sides.
// ═══════════════════════════════════════════════════════════════════════════

test('FR-AUTH-04 · the minimum is 10, exactly as the requirement states', () => {
  assert.equal(PASSWORD_MIN_LENGTH, 10);
});

test('FR-AUTH-04 · NEGATIVE: nine characters is refused, ten is accepted', () => {
  assert.deepEqual(checkPasswordLength('x'.repeat(9)), { ok: false, rejection: 'TOO_SHORT' });
  assert.deepEqual(checkPasswordLength('x'.repeat(10)), { ok: true, rejection: null });
});

test('ADR-0033 · the maximum is 128 — the value that satisfies BOTH documents', () => {
  // Security.md §2.4.1 says 128; Authentication.md §5.2 says 256. Both are rank-3, so
  // precedence gives no answer. 128 is within both ceilings; 200 is within one only.
  assert.equal(PASSWORD_MAX_LENGTH, 128);
  assert.ok(PASSWORD_MAX_LENGTH <= 256, 'the chosen maximum must also satisfy Authentication.md');
});

test('ADR-0033 · NEGATIVE: 129 characters is refused, 128 is accepted', () => {
  assert.deepEqual(checkPasswordLength('x'.repeat(128)), { ok: true, rejection: null });
  assert.deepEqual(checkPasswordLength('x'.repeat(129)), { ok: false, rejection: 'TOO_LONG' });
});

test('the LOGIN bounds are wider, and deliberately so', () => {
  // Authentication.md §8.4. A stored password may predate any policy; refusing a LOGIN because
  // the password on file is too short locks a member out of their own account with no path
  // forward. The policy binds where a password is CHOSEN.
  assert.equal(LOGIN_PASSWORD_MIN_LENGTH, 1);
  assert.equal(LOGIN_PASSWORD_MAX_LENGTH, 256);
  assert.ok(LOGIN_PASSWORD_MIN_LENGTH < PASSWORD_MIN_LENGTH);
});

test('length is counted in CODE POINTS, not UTF-16 units', () => {
  // `'👍'.length` is 2. A ten-character passphrase containing one would be refused as nine, and
  // the member would be told to lengthen something already long enough.
  const withAstral = '👍👍👍👍👍'; // five code points, ten UTF-16 units
  assert.equal(withAstral.length, 10, 'the fixture is not exercising the case');
  assert.equal(passwordLength(withAstral), 5);
  assert.deepEqual(checkPasswordLength(withAstral), { ok: false, rejection: 'TOO_SHORT' });

  assert.equal(passwordLength('👍'.repeat(10)), 10);
  assert.deepEqual(checkPasswordLength('👍'.repeat(10)), { ok: true, rejection: null });
});

test('whitespace counts and is never trimmed', () => {
  // Security.md §2.4.1: "leading/trailing whitespace preserved". Trimming makes the password
  // stored disagree with the password typed, and the mismatch surfaces later as a login failure.
  assert.deepEqual(checkPasswordLength('  short   '), { ok: true, rejection: null });
  assert.equal(passwordLength(' pad '), 5);
});

test('a rejection message says what happened, why and what next — never the value', () => {
  for (const rejection of ['TOO_SHORT', 'TOO_LONG', 'BREACHED'] as const) {
    const message = rejectionMessage(rejection);
    assert.ok(message.length > 60, `${rejection} has a stub message`);
    // AC-FND-09.6 — VALIDATION_FAILED names the field and never echoes the value. These
    // messages take no input at all, which is the structural way to guarantee it.
    assert.doesNotMatch(message, /password is|you entered|"/i);
  }
  assert.match(rejectionMessage('TOO_SHORT'), /at least 10 characters/);
  assert.match(rejectionMessage('TOO_LONG'), /at most 128 characters/);
  assert.match(rejectionMessage('BREACHED'), /known data breach/);
});

// ═══════════════════════════════════════════════════════════════════════════
// FR-AUTH-08 — the 10-in-15 boundary, from both sides.
// ═══════════════════════════════════════════════════════════════════════════

test('FR-AUTH-08 · the threshold is 10 and the window is 15 minutes, exactly', () => {
  assert.equal(LOCKOUT_THRESHOLD, 10);
  assert.equal(LOCKOUT_WINDOW_SECONDS, 900);
});

test('FR-AUTH-08 · nine failures does not lock; ten does', () => {
  assert.deepEqual(evaluateLockout(state({ failures: 9 }), NOW), { locked: false });

  const locked = evaluateLockout(state({ failures: 10 }), NOW);
  assert.equal(locked.locked, true);
  assert.ok(locked.locked && locked.lockedUntil.toISOString() === '2026-08-07T12:15:00.000Z');
  assert.ok(locked.locked && locked.escalated === false);
});

test('attemptsRemaining counts down and floors at zero', () => {
  assert.equal(attemptsRemaining(0), 10);
  assert.equal(attemptsRemaining(9), 1);
  assert.equal(attemptsRemaining(10), 0);
  assert.equal(attemptsRemaining(47), 0, 'a negative remaining count would render as "-37 left"');
});

test('an OTP-only account CANNOT be locked, however many failures are recorded', () => {
  // Security.md §2.8.4. There is no password to guess, so the lock would deny a member their
  // ONLY route in — on the strength of attempts against a credential they never set. Checked
  // before the threshold, because a stale counter must not survive a password being removed.
  assert.deepEqual(evaluateLockout(state({ failures: 500, hasPassword: false }), NOW), {
    locked: false,
  });
});

test('three locks in 24 hours escalates to a 24-hour lock', () => {
  const escalated = evaluateLockout(
    state({ failures: 10, locksInEscalationWindow: LOCKOUT_ESCALATION_THRESHOLD }),
    NOW,
  );
  assert.equal(escalated.locked, true);
  assert.ok(escalated.locked && escalated.escalated === true);
  assert.ok(
    escalated.locked &&
      escalated.lockedUntil.getTime() - NOW.getTime() === LOCKOUT_ESCALATED_DURATION_SECONDS * 1000,
  );
});

test('two locks in 24 hours does NOT escalate — the boundary from below', () => {
  const ordinary = evaluateLockout(state({ failures: 10, locksInEscalationWindow: 2 }), NOW);
  assert.ok(ordinary.locked && ordinary.escalated === false);
  assert.ok(ordinary.locked && ordinary.lockedUntil.getTime() - NOW.getTime() === 900_000);
});

test('the lock expiry is computed from the PASSED instant, not the wall clock', () => {
  // The whole reason `evaluateLockout` takes `now`. A `new Date()` inside would make the policy
  // untestable and would trip `no-bare-date`.
  const past = new Date('2020-01-01T00:00:00Z');
  const locked = evaluateLockout(state({ failures: 10 }), past);
  assert.ok(locked.locked && locked.lockedUntil.toISOString() === '2020-01-01T00:15:00.000Z');
});

// ═══════════════════════════════════════════════════════════════════════════
// The message. §6: "'Account locked' alone fails review."
// ═══════════════════════════════════════════════════════════════════════════

test('the lockout message states cause, protection and remedy', () => {
  const message = lockoutMessage({
    maskedChannel: 'your mobile ending 43210',
    lockedUntilLocal: '14:22 IST',
    escalated: false,
  });

  assert.match(message, /10 unsuccessful sign-in attempts/, 'no cause');
  assert.match(message, /last 15 minutes/, 'no window');
  assert.match(message, /protects you/, 'no explanation of why');
  assert.match(message, /Unlock it now/, 'no remedy');
  assert.match(message, /14:22 IST/, 'no deadline');
});

test('with no verified channel it does not offer a code that cannot be sent', () => {
  const message = lockoutMessage({
    maskedChannel: null,
    lockedUntilLocal: '14:22 IST',
    escalated: false,
  });
  assert.doesNotMatch(message, /code sent to/, 'offered an unlock channel that does not exist');
  assert.match(message, /wait until 14:22 IST/);
});

test('an ESCALATED lock does not offer the self-service path being abused', () => {
  // Pointing at the OTP route after three locks in a day is advice that does not work — the
  // escalation exists precisely because that route is being hammered.
  const message = lockoutMessage({
    maskedChannel: 'your mobile ending 43210',
    lockedUntilLocal: 'tomorrow at 14:22 IST',
    escalated: true,
  });
  assert.doesNotMatch(message, /Unlock it now/);
  assert.match(message, /support team/);
  assert.match(message, /several times today/);
});

test('the message never carries an unmasked channel', () => {
  // BR-DAT-06. The function takes a pre-masked string, so a full number cannot reach the error
  // envelope — or the log line the envelope is built from — even by mistake at a call site.
  const message = lockoutMessage({
    maskedChannel: 'your mobile ending 43210',
    lockedUntilLocal: '14:22 IST',
    escalated: false,
  });
  assert.doesNotMatch(message, /\+91\d{10}/);
  assert.doesNotMatch(message, /@/);
});
