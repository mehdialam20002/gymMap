/**
 * M-021 · The two OTP routes over HTTP — `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-9`.
 *
 * ┌─ THE ASSERTION THAT NEEDS THE FULL STACK: NOTHING IS SENT WHEN THE BUDGET IS SPENT ─────────┐
 * │ `AC-AUTH-01.4` is not "returns 429" — it is *"returns 429 **and no SMS is sent**"*. Proving │
 * │ the second half means counting deliveries, so this suite substitutes a RECORDING delivery   │
 * │ adapter and asserts the count did not move. A test that only checked the status would pass  │
 * │ against an implementation that sends first and refuses afterwards, which is precisely the   │
 * │ ₹0.15-per-refusal failure the limit exists to prevent.                                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Redis } from 'ioredis';

import { AppModule } from '../../dist/app.module.js';
import { configureApp } from '../../dist/common/bootstrap/configure-app.js';
import { OTP_DELIVERY } from '../../dist/iam/application/request-otp.use-case.js';
import { applyTestEnv } from '../harness/test-env.ts';
import { requireRole } from './_availability.ts';

applyTestEnv();

/** Counts deliveries, so "no SMS is sent" is an assertion rather than a hope. */
class RecordingDelivery {
  readonly sent: { phone: string; code: string; purpose: string }[] = [];
  smsAvailable = true;
  emailAvailable = true;

  deliver(input: {
    phone: string;
    code: string;
    purpose: string;
  }): Promise<{ channel: string; fallback: string | null }> {
    if (this.smsAvailable) {
      this.sent.push({ ...input });
      return Promise.resolve({ channel: 'SMS', fallback: null });
    }
    if (this.emailAvailable) {
      this.sent.push({ ...input });
      return Promise.resolve({ channel: 'EMAIL', fallback: 'EMAIL' });
    }
    return Promise.reject(new Error('no channel'));
  }
}

let app: INestApplication;
let baseUrl = '';
let redis: Redis;
let delivery: RecordingDelivery;
let available = false;

let seq = 7_100_000_000;
const freshPhone = (): string => `+91${String((seq += 1))}`;

const post = async (
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: any }> => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  return { status: response.status, body: raw === '' ? null : JSON.parse(raw) };
};

before(async () => {
  ({ available } = await requireRole('the API and its dependencies', async () => {
    redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379/2', {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    await redis.connect();
    delivery = new RecordingDelivery();

    // The real graph, with ONE provider replaced. Everything else — the Zod pipe, @Public(),
    // the guards, the exception filter, the real Redis store — is exercised as it ships.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OTP_DELIVERY)
      .useValue(delivery)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  }));
});

after(async () => {
  if (!available) return;
  // Only this suite's keys. Another suite's fixtures must survive.
  const keys = await redis.keys('otp:*');
  if (keys.length > 0) await redis.del(...keys);
  redis.disconnect();
  await app.close();
});

const it = (name: string, fn: () => Promise<void>) =>
  test(name, async (t) => {
    if (!available) return t.skip('no api');
    delivery.sent.length = 0;
    delivery.smsAvailable = true;
    delivery.emailAvailable = true;
    // ┌─ THE PER-IP CEILING IS CLEARED BETWEEN TESTS, AND FINDING THAT OUT WAS THE POINT ──────┐
    // │ Every request in this suite comes from 127.0.0.1, so the 20-per-hour ceiling counts    │
    // │ them as ONE abuser. Seven tests failed on the first run with CAPTCHA_REQUIRED — the    │
    // │ control doing exactly its job, against the test suite.                                  │
    // │                                                                                         │
    // │ Cleared here because each test is an independent situation, not a continuation. The     │
    // │ ceiling itself is exercised deliberately by the two tests at the end, which do NOT      │
    // │ clear it mid-test.                                                                      │
    // └─────────────────────────────────────────────────────────────────────────────────────────┘
    await clearIpCounters();
    await fn();
  });

async function clearIpCounters(): Promise<void> {
  const keys = await redis.keys('otp:ip:*');
  if (keys.length > 0) await redis.del(...keys);
}

// ═══════════════════════════════════════════════════════════════════════════
// AC-9 — the number format, rejected at the pipe.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-9 · a bare ten-digit number is a 400, not a guess', async () => {
  const result = await post('/v1/auth/otp/request', {
    phone: '9876543210',
    purpose: 'LOGIN',
  });
  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(delivery.sent.length, 0, 'an SMS was sent for a malformed number');
});

it('AC-9 · a non-Indian number is rejected at the pipe', async () => {
  for (const phone of ['+14155550123', '+971501234567']) {
    const result = await post('/v1/auth/otp/request', { phone, purpose: 'LOGIN' });
    assert.equal(result.status, 400, `${phone} was accepted`);
  }
  assert.equal(delivery.sent.length, 0);
});

it('an unknown purpose is a 400', async () => {
  const result = await post('/v1/auth/otp/request', {
    phone: freshPhone(),
    purpose: 'DELETE_EVERYTHING',
  });
  assert.equal(result.status, 400);
});

it('an unknown body key is rejected — §3.7', async () => {
  const result = await post('/v1/auth/otp/request', {
    phone: freshPhone(),
    purpose: 'LOGIN',
    user_id: 'someone-elses',
  });
  assert.equal(result.status, 400, 'an unknown key was accepted');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-5 — the enumeration defence.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-5 · an UNREGISTERED number gets the same 202 and NO sms', async () => {
  const result = await post('/v1/auth/otp/request', {
    phone: freshPhone(),
    purpose: 'LOGIN',
  });

  assert.equal(result.status, 202, JSON.stringify(result.body));
  assert.equal(result.body.channel, 'SMS');
  assert.equal(result.body.expires_in_seconds, 300);
  assert.equal(
    delivery.sent.length,
    0,
    'an SMS was sent to a number with no account — that is both a cost and a signal',
  );
});

it('AC-5 · REGISTER does deliver to an unknown number, because that is the point', async () => {
  const result = await post('/v1/auth/otp/request', {
    phone: freshPhone(),
    purpose: 'REGISTER',
  });
  assert.equal(result.status, 202);
  assert.equal(delivery.sent.length, 1);
});

it('AC-5 · the response body is IDENTICAL for LOGIN whether or not an account exists', async () => {
  // Registered and unregistered must be indistinguishable. The only difference permitted is
  // whether a message is actually dispatched, which the caller cannot observe.
  const unknown = await post('/v1/auth/otp/request', {
    phone: freshPhone(),
    purpose: 'LOGIN',
  });
  // The seeded principal `member.solo` has +919000000005 (prisma/seed/users.ts).
  const known = await post('/v1/auth/otp/request', {
    phone: '+919000000005',
    purpose: 'LOGIN',
  });

  assert.equal(unknown.status, known.status);
  assert.deepEqual(unknown.body, known.body, 'the two bodies differ — that is the oracle');
  assert.equal(delivery.sent.length, 1, 'only the registered number should have been texted');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-2, AC-3 — the per-number limits, and the "no SMS" half.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-3 · a second request inside 30 seconds is 429 OTP_RESEND_TOO_SOON, and sends nothing', async () => {
  const phone = freshPhone();
  const first = await post('/v1/auth/otp/request', { phone, purpose: 'REGISTER' });
  assert.equal(first.status, 202);
  assert.equal(delivery.sent.length, 1);

  const second = await post('/v1/auth/otp/request', { phone, purpose: 'REGISTER' });
  assert.equal(second.status, 429, JSON.stringify(second.body));
  assert.equal(second.body.error.code, 'OTP_RESEND_TOO_SOON');
  assert.ok(second.body.error.details[0].retry_after_seconds > 0);
  assert.equal(delivery.sent.length, 1, 'a second SMS was sent inside the cool-down');
});

it('AC-2 · the FOURTH send in the window is 429 and NO SMS IS SENT', async () => {
  // AC-AUTH-01.4's second half, which a status-only assertion would miss entirely. The
  // cool-down is bypassed by clearing only the cool-down evidence, so the WINDOW limit is what
  // is being tested rather than the 30-second gap.
  const phone = freshPhone();

  for (let send = 1; send <= 3; send += 1) {
    const result = await post('/v1/auth/otp/request', { phone, purpose: 'REGISTER' });
    assert.equal(result.status, 202, `send ${String(send)}: ${JSON.stringify(result.body)}`);
    // Age the last-send marker so the cool-down does not mask the window limit. The COUNT
    // stays — that is the thing under test.
    await ageLastSend();
  }
  assert.equal(delivery.sent.length, 3);

  const fourth = await post('/v1/auth/otp/request', { phone, purpose: 'REGISTER' });
  assert.equal(fourth.status, 429, JSON.stringify(fourth.body));
  assert.equal(fourth.body.error.code, 'OTP_RESEND_LIMIT_REACHED');
  assert.equal(
    delivery.sent.length,
    3,
    'a fourth SMS was sent. AC-AUTH-01.4 requires the budget to be checked BEFORE the ' +
      'enqueue — checked after, the limit costs ₹0.15 on every request it refuses.',
  );
});

/**
 * Ages every resend entry by 60 seconds, so the cool-down does not mask the WINDOW limit.
 *
 * Takes no argument: the key is an HMAC of the number and the test cannot compute it without
 * the derived key, so every `otp:resend:*` key is aged. Safe because each test uses a distinct
 * number and the suite clears the namespace on teardown.
 */
async function ageLastSend(): Promise<void> {
  const keys = await redis.keys('otp:resend:*');
  for (const key of keys) {
    const members = await redis.zrange(key, '0', '-1', 'WITHSCORES');
    for (let i = 0; i < members.length; i += 2) {
      await redis.zadd(key, Number(members[i + 1]) - 60_000, members[i]!);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Verify.
// ═══════════════════════════════════════════════════════════════════════════

it('a correct code verifies, and the replay is refused', async () => {
  const phone = freshPhone();
  await post('/v1/auth/otp/request', { phone, purpose: 'REGISTER' });
  const code = delivery.sent[0]!.code;

  const verified = await post('/v1/auth/otp/verify', { phone, purpose: 'REGISTER', code });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  assert.equal(verified.body.verified, true);
  // No account exists for a REGISTER flow yet — M-022 completes it.
  assert.equal(verified.body.user_id, null);

  const replay = await post('/v1/auth/otp/verify', { phone, purpose: 'REGISTER', code });
  assert.equal(replay.status, 400);
  assert.equal(replay.body.error.code, 'OTP_EXPIRED');
});

it('a wrong code is 400 OTP_INVALID and CARRIES attempts_remaining — AC-AUTH-01.3', async () => {
  const phone = freshPhone();
  await post('/v1/auth/otp/request', { phone, purpose: 'REGISTER' });
  const code = delivery.sent[0]!.code;
  const wrong = code === '000000' ? '111111' : '000000';

  const result = await post('/v1/auth/otp/verify', { phone, purpose: 'REGISTER', code: wrong });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'OTP_INVALID');
  assert.equal(result.body.error.details[0].attempts_remaining, 4);
  // The message quotes the count — a bare "wrong code" leaves the member guessing whether the
  // next attempt destroys it, and the ones who guess wrong stop trying.
  assert.match(result.body.error.message, /4 attempts left/);

  // And the real code still works: a typo must not cost the member their code.
  const good = await post('/v1/auth/otp/verify', { phone, purpose: 'REGISTER', code });
  assert.equal(good.status, 200);
});

it('a five-digit code is rejected at the pipe, not as OTP_INVALID', async () => {
  const result = await post('/v1/auth/otp/verify', {
    phone: freshPhone(),
    purpose: 'LOGIN',
    code: '12345',
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, 'VALIDATION_FAILED');
});

it('purpose binding holds over HTTP — a REGISTER code does not UNLOCK', async () => {
  const phone = freshPhone();
  await post('/v1/auth/otp/request', { phone, purpose: 'REGISTER' });
  const code = delivery.sent[0]!.code;

  const wrongPurpose = await post('/v1/auth/otp/verify', { phone, purpose: 'UNLOCK', code });
  assert.equal(wrongPurpose.status, 400);
  assert.equal(wrongPurpose.body.error.code, 'OTP_EXPIRED');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-6 — the fallback, and the one 503.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-6 · the SMS rail down is still a 202, with channel EMAIL', async () => {
  delivery.smsAvailable = false;
  const result = await post('/v1/auth/otp/request', {
    phone: freshPhone(),
    purpose: 'REGISTER',
  });

  assert.equal(result.status, 202, JSON.stringify(result.body));
  assert.equal(result.body.channel, 'EMAIL');
  assert.equal(result.body.fallback, 'EMAIL');
  assert.equal(delivery.sent.length, 1, 'the fallback did not actually deliver');
});

it('AC-6 · only when BOTH rails are down is it a 503', async () => {
  delivery.smsAvailable = false;
  delivery.emailAvailable = false;

  const result = await post('/v1/auth/otp/request', {
    phone: freshPhone(),
    purpose: 'REGISTER',
  });
  assert.equal(result.status, 503, JSON.stringify(result.body));
  assert.equal(result.body.error.code, 'DEPENDENCY_UNAVAILABLE');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-7 — no plaintext anywhere the caller or an operator can reach.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-7 · the code is never in a response body', async () => {
  const phone = freshPhone();
  const requested = await post('/v1/auth/otp/request', { phone, purpose: 'REGISTER' });
  const code = delivery.sent[0]!.code;

  assert.ok(!JSON.stringify(requested.body).includes(code), 'the code is in the 202 body');

  const wrong = code === '000000' ? '111111' : '000000';
  const failed = await post('/v1/auth/otp/verify', { phone, purpose: 'REGISTER', code: wrong });
  assert.ok(!JSON.stringify(failed.body).includes(code), 'the code is in the failure body');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-4 — the per-IP ceiling, exercised deliberately.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-4 · the eleventh request from one IP demands a captcha', async () => {
  // Ten DIFFERENT numbers, so no per-number limit is in play — this isolates the per-IP axis,
  // which is the whole point of the two ceilings being independent. An attacker cycling numbers
  // trips only this one.
  for (let request = 1; request <= 10; request += 1) {
    const result = await post('/v1/auth/otp/request', {
      phone: freshPhone(),
      purpose: 'REGISTER',
    });
    assert.equal(result.status, 202, `request ${String(request)}: ${JSON.stringify(result.body)}`);
  }
  assert.equal(delivery.sent.length, 10);

  const eleventh = await post('/v1/auth/otp/request', {
    phone: freshPhone(),
    purpose: 'REGISTER',
  });
  assert.equal(eleventh.status, 403, JSON.stringify(eleventh.body));
  assert.equal(eleventh.body.error.code, 'CAPTCHA_REQUIRED');
  assert.equal(delivery.sent.length, 10, 'an SMS was sent past the captcha threshold');

  // A 403 and not a 429, deliberately: the caller is not being told to wait — waiting does not
  // help — they are being asked to prove they are human.
  assert.notEqual(eleventh.status, 429);
});

it('AC-4 · a captcha token lets the caller through the threshold', async () => {
  for (let request = 1; request <= 10; request += 1) {
    await post('/v1/auth/otp/request', { phone: freshPhone(), purpose: 'REGISTER' });
  }

  const withCaptcha = await post('/v1/auth/otp/request', {
    phone: freshPhone(),
    purpose: 'REGISTER',
    captcha_token: 'solved-challenge-token',
  });
  assert.equal(withCaptcha.status, 202, JSON.stringify(withCaptcha.body));
  assert.equal(delivery.sent.length, 11);
});
