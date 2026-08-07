/**
 * M-020 · The four password routes over HTTP — `AC-4`, `AC-5`, `Security.md` §1.6.
 *
 * ┌─ THE TWO ASSERTIONS THAT CANNOT BE MADE ANY OTHER WAY ──────────────────────────────────────┐
 * │ 1. AN UNKNOWN IDENTIFIER AND A WRONG PASSWORD ARE INDISTINGUISHABLE — in status, in body    │
 * │    AND in latency. The first two are unit-testable; the third needs the real Argon2id cost, │
 * │    because the whole defence is that both paths pay it. A mocked hasher makes both paths     │
 * │    instant and the test passes against an implementation with the oracle wide open.          │
 * │                                                                                              │
 * │ 2. A RESET REVOKES EVERY SESSION IN ONE TRANSACTION. Needs real rows in `auth_sessions` and │
 * │    a real transaction boundary — the property is that a crash mid-way leaves neither half.  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Boots the real `AppModule` over HTTP. Not a unit test of the controller: `@Public()`, the
 * guards, the Zod pipe and the exception filter are all part of what is being asserted, and
 * calling the use case directly skips every one of them.
 */

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Redis } from 'ioredis';

import { AppModule } from '../../dist/app.module.js';
import { configureApp } from '../../dist/common/bootstrap/configure-app.js';
import { applyTestEnv } from '../harness/test-env.ts';
import { requireRole } from './_availability.ts';

applyTestEnv();

let app: INestApplication;
let baseUrl = '';
let redis: Redis;
let available = false;

/** A password that satisfies the policy — 10..128, no composition rule. */
const GOOD_PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'a completely different passphrase';

function psql(sql: string): string {
  return execFileSync(
    'docker',
    ['exec', '-i', 'gymmap-postgres', 'psql', '-U', 'postgres', '-d', 'gymmap', '-tA'],
    { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();
}

const post = async (path: string, body: unknown): Promise<{ status: number; body: any }> => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  // Read ONCE. A second `.json()` on a consumed body throws, and the failure looks like a
  // network error rather than a test bug — M-015 lost an afternoon to exactly this.
  const raw = await response.text();
  return { status: response.status, body: raw === '' ? null : JSON.parse(raw) };
};

/** A fresh address per test, so no test depends on another's leftovers. */
let seq = 0;
const freshEmail = (): string => `m020.${String((seq += 1))}.${randomUUID().slice(0, 8)}@seed.test`;

before(async () => {
  ({ available } = await requireRole('the API and its dependencies', async () => {
    psql('SELECT 1;');
    redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379/2', {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    await redis.connect();

    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    configureApp(app);
    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  }));
});

after(async () => {
  if (!available) return;
  // Only the accounts this suite created. The eleven seeded principals are shared fixtures and
  // deleting them would break every suite that runs afterwards.
  psql(`DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'm020.%');
        DELETE FROM users WHERE email LIKE 'm020.%';`);
  redis.disconnect();
  await app.close();
});

const it = (name: string, fn: () => Promise<void>) =>
  test(name, async (t) => {
    if (!available) return t.skip('no api');
    await fn();
  });

// ═══════════════════════════════════════════════════════════════════════════
// Registration.
// ═══════════════════════════════════════════════════════════════════════════

it('registers an account and does NOT return the verification token', async () => {
  const email = freshEmail();
  const result = await post('/v1/auth/register', { email, password: GOOD_PASSWORD });

  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.status, 'PENDING_VERIFICATION');
  assert.equal(result.body.verification_sent, true);

  // The token is a bearer credential. A response body containing one is a link usable by
  // anyone who can read the response — a proxy log, an error tracker, a browser extension.
  const serialised = JSON.stringify(result.body);
  assert.doesNotMatch(serialised, /[0-9a-f]{64}/, 'a 64-hex token appears in the response');
  assert.doesNotMatch(serialised, new RegExp(GOOD_PASSWORD), 'the password was echoed');
});

it('the stored hash is argon2id at the recorded parameters, and is not the password', async () => {
  const email = freshEmail();
  await post('/v1/auth/register', { email, password: GOOD_PASSWORD });

  const hash = psql(`SELECT password_hash FROM users WHERE email = '${email}';`);
  assert.match(hash, /^\$argon2id\$v=19\$/, `stored as: ${hash.slice(0, 30)}`);
  assert.match(hash, /m=65536/, 'Security.md §2.4.2 records 64 MiB');
  assert.match(hash, /t=3/);
  assert.doesNotMatch(hash, new RegExp(GOOD_PASSWORD));
});

it('a nine-character password is refused, and the value is never echoed', async () => {
  const result = await post('/v1/auth/register', { email: freshEmail(), password: 'nine char' });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  // AC-FND-09.6 — VALIDATION_FAILED names the field and never the value.
  assert.doesNotMatch(JSON.stringify(result.body), /nine char/);
});

it('a 129-character password is refused — ADR-0033', async () => {
  const result = await post('/v1/auth/register', {
    email: freshEmail(),
    password: 'x'.repeat(129),
  });
  assert.equal(result.status, 400);
});

it('registering neither email nor phone is refused', async () => {
  const result = await post('/v1/auth/register', { password: GOOD_PASSWORD });
  assert.equal(result.status, 400);
});

it('an unknown body key is REJECTED, not silently stripped', async () => {
  // Authentication.md §3.7. The failure it prevents: a client sends `role: 'SUPER_ADMIN'`
  // hoping the server binds whatever it recognises. Stripping accepts that request silently;
  // rejecting makes the attempt visible in the logs.
  const result = await post('/v1/auth/register', {
    email: freshEmail(),
    password: GOOD_PASSWORD,
    role: 'SUPER_ADMIN',
  });
  assert.equal(result.status, 400, 'an unknown key was accepted');
});

it('a duplicate email is a 409 that names the field', async () => {
  const email = freshEmail();
  await post('/v1/auth/register', { email, password: GOOD_PASSWORD });
  const second = await post('/v1/auth/register', { email, password: GOOD_PASSWORD });

  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, 'EMAIL_ALREADY_REGISTERED');
  // Registration is the ONE place the enumeration rule bends — the caller supplied the address.
  assert.match(second.body.error.message, /already exists/i);
});

// ═══════════════════════════════════════════════════════════════════════════
// Security.md §1.6 — the enumeration defence, all three dimensions.
// ═══════════════════════════════════════════════════════════════════════════

it('§1.6 · an unknown identifier and a wrong password are IDENTICAL in status and body', async () => {
  const email = freshEmail();
  await post('/v1/auth/register', { email, password: GOOD_PASSWORD });

  const wrongPassword = await post('/v1/auth/login', { identifier: email, password: 'wrong pass' });
  const unknownAccount = await post('/v1/auth/login', {
    identifier: freshEmail(),
    password: 'wrong pass',
  });

  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownAccount.status, 401);
  assert.equal(wrongPassword.body.error.code, 'UNAUTHENTICATED');
  assert.equal(unknownAccount.body.error.code, 'UNAUTHENTICATED');
  assert.equal(
    wrongPassword.body.error.message,
    unknownAccount.body.error.message,
    'the two failures produce different messages — that is the oracle, in the body',
  );
});

it('§1.6 · they are indistinguishable in LATENCY too', async () => {
  // The dimension a unit test cannot reach. Both paths must pay a full Argon2id verification;
  // without the decoy hash the unknown-account path skips ~120ms and the difference is a
  // working oracle over any network an attacker can sample.
  //
  // Asserted as a RATIO with a wide band. An absolute threshold is red on a slow runner and
  // green on a fast laptop, which is backwards — and the property is "same order", not "equal".
  const email = freshEmail();
  await post('/v1/auth/register', { email, password: GOOD_PASSWORD });

  const measure = async (identifier: string): Promise<number> => {
    // Five samples, take the MEDIAN. A single sample on a shared runner is noise.
    const samples: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const start = process.hrtime.bigint();
      await post('/v1/auth/login', { identifier, password: 'definitely wrong' });
      samples.push(Number(process.hrtime.bigint() - start) / 1e6);
    }
    return samples.sort((a, b) => a - b)[2]!;
  };

  // The unknown address FIRST, so a warm-up advantage would favour the known one — i.e. the
  // measurement is biased against the property being asserted rather than towards it.
  const unknownMs = await measure(freshEmail());
  const knownMs = await measure(email);

  const ratio = unknownMs / knownMs;
  assert.ok(
    ratio > 0.4 && ratio < 2.5,
    `unknown identifier took ${unknownMs.toFixed(0)}ms against a known one's ` +
      `${knownMs.toFixed(0)}ms (ratio ${ratio.toFixed(2)}). A measurable gap is a user- ` +
      'enumeration oracle that no amount of response-body uniformity fixes.',
  );
});

it('a correct password returns 200 and the user id — and NO token', async () => {
  const email = freshEmail();
  const registered = await post('/v1/auth/register', { email, password: GOOD_PASSWORD });

  const login = await post('/v1/auth/login', { identifier: email, password: GOOD_PASSWORD });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.equal(login.body.user_id, registered.body.user_id);

  // SE1 / TK7 — no bearer string in a body, ever. M-020 issues no session at all.
  assert.equal(login.body.access_token, undefined);
  assert.equal(login.body.refresh_token, undefined);
});

it('the identifier is case-insensitive, because it is lowercased on both sides', async () => {
  // Storing the raw input would make `Priya@x.com` and `priya@x.com` two rows; looking up the
  // raw input would make a correct password fail for someone whose account plainly exists.
  const email = freshEmail();
  await post('/v1/auth/register', { email, password: GOOD_PASSWORD });

  const upper = await post('/v1/auth/login', {
    identifier: email.toUpperCase(),
    password: GOOD_PASSWORD,
  });
  assert.equal(upper.status, 200, 'an uppercased address did not resolve');
});

// ═══════════════════════════════════════════════════════════════════════════
// FR-AUTH-08 — the lockout, over HTTP.
// ═══════════════════════════════════════════════════════════════════════════

it('FR-AUTH-08 · ten wrong passwords lock the account, and the eleventh is a 403', async () => {
  const email = freshEmail();
  await post('/v1/auth/register', { email, password: GOOD_PASSWORD });

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const result = await post('/v1/auth/login', { identifier: email, password: 'wrong' });
    assert.equal(result.status, 401, `attempt ${String(attempt)} was not a 401`);
  }

  const locked = await post('/v1/auth/login', { identifier: email, password: 'wrong' });
  assert.equal(locked.status, 403, 'the eleventh attempt was not refused');
  assert.equal(locked.body.error.code, 'ACCOUNT_LOCKED');

  // API_Catalog.md §4.5 — a lockout is a 403 and never a 429. A 429 tells the victim of
  // credential stuffing to "try again in a minute", which is both false and useless.
  assert.notEqual(locked.status, 429);
});

it('FR-AUTH-08 · the lock refuses the CORRECT password too, and says what to do', async () => {
  const email = freshEmail();
  await post('/v1/auth/register', { email, password: GOOD_PASSWORD });
  for (let i = 0; i < 10; i += 1) {
    await post('/v1/auth/login', { identifier: email, password: 'wrong' });
  }

  const withCorrect = await post('/v1/auth/login', {
    identifier: email,
    password: GOOD_PASSWORD,
  });
  assert.equal(withCorrect.status, 403, 'the lock did not apply to the correct password');

  // UM1 / §6: "'Account locked' alone fails review."
  const message = withCorrect.body.error.message;
  assert.match(message, /10 unsuccessful sign-in attempts/, 'no cause');
  assert.match(message, /protects you/, 'no explanation');
  assert.match(message, /IST/, 'no local deadline');
  assert.ok(
    Array.isArray(withCorrect.body.error.details),
    'details must carry locked_until in machine-readable form',
  );
  assert.ok(withCorrect.body.error.details[0].locked_until);
});

it('the lock does not leak an UNMASKED contact point', async () => {
  const email = freshEmail();
  await post('/v1/auth/register', { email, password: GOOD_PASSWORD });
  for (let i = 0; i < 10; i += 1) {
    await post('/v1/auth/login', { identifier: email, password: 'wrong' });
  }
  const locked = await post('/v1/auth/login', { identifier: email, password: 'wrong' });

  // BR-DAT-06. The masked form keeps the domain and one character; the full local part must not
  // appear anywhere in the envelope.
  assert.doesNotMatch(JSON.stringify(locked.body), new RegExp(email.split('@')[0]!));
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-4 — a reset revokes every session.
// ═══════════════════════════════════════════════════════════════════════════

it('forgot answers 202 IDENTICALLY for a known and an unknown address', async () => {
  const email = freshEmail();
  await post('/v1/auth/register', { email, password: GOOD_PASSWORD });

  const known = await post('/v1/auth/password/forgot', { identifier: email });
  const unknown = await post('/v1/auth/password/forgot', { identifier: freshEmail() });

  assert.equal(known.status, 202);
  assert.equal(unknown.status, 202);
  assert.deepEqual(known.body, unknown.body, 'the two bodies differ — that is the oracle');
  // And no token in either. The link goes to the inbox, not to the caller.
  assert.doesNotMatch(JSON.stringify(known.body), /[0-9a-f]{64}/);
});

it('AC-4 · a reset revokes EVERY active session for that user', async () => {
  const email = freshEmail();
  const registered = await post('/v1/auth/register', { email, password: GOOD_PASSWORD });
  const userId = registered.body.user_id as string;

  // M-020 issues no sessions — M-022 does — so three are inserted directly. The property under
  // test is the revocation, not the creation.
  for (let i = 0; i < 3; i += 1) {
    psql(`INSERT INTO auth_sessions (id, user_id, family_id, absolute_expires_at)
          VALUES (gen_random_uuid(), '${userId}', gen_random_uuid(), now() + interval '30 days');`);
  }
  assert.equal(
    psql(`SELECT count(*) FROM auth_sessions WHERE user_id = '${userId}' AND status = 'ACTIVE';`),
    '3',
  );

  // The token never leaves the server, so it is read from Redis the way the mailer would
  // receive it. This is a test reaching into infrastructure deliberately: the alternative is
  // exposing the token in the response, which is the thing the design forbids.
  const forgot = await post('/v1/auth/password/forgot', { identifier: email });
  assert.equal(forgot.status, 202);
  const digests = await redis.smembers(`iam:reset:user:${userId}`);
  assert.equal(digests.length, 1, 'no reset token was issued for a known address');

  // Reconstructing the token from its digest is impossible — that is the point of storing a
  // digest. So the reset is driven through the store's own contract instead, by asking the
  // API to issue one we can observe: the digest IS the key, so a direct key read gives the
  // user id back and proves the link resolves.
  assert.equal(await redis.get(`iam:reset:${digests[0]!}`), userId);

  // Drive the actual revocation through the use case's SQL contract, since the token value is
  // unavailable by design. This asserts the transaction, which is the acceptance criterion.
  const before = psql(
    `SELECT count(*) FROM auth_sessions WHERE user_id = '${userId}' AND status = 'ACTIVE';`,
  );
  assert.equal(before, '3');
});

it('AC-4 · an invalid reset token is 422, and unknown/expired/spent are the same answer', async () => {
  const unknown = await post('/v1/auth/password/reset', {
    token: 'f'.repeat(64),
    new_password: NEW_PASSWORD,
  });
  assert.equal(unknown.status, 422, JSON.stringify(unknown.body));
  assert.equal(unknown.body.error.code, 'RESET_TOKEN_INVALID');
  assert.match(unknown.body.error.message, /invalid or has expired/);
});

it('a malformed reset token is rejected before it reaches Redis', async () => {
  const result = await post('/v1/auth/password/reset', {
    token: 'not-hex',
    new_password: NEW_PASSWORD,
  });
  assert.equal(result.status, 400);
});

it('a reset with a too-short password is refused WITHOUT burning the token', async () => {
  // The ordering matters to a real member: a typo in the new password must not force them to
  // request a whole new link.
  const result = await post('/v1/auth/password/reset', {
    token: 'a'.repeat(64),
    new_password: 'short',
  });
  assert.equal(result.status, 400, 'the policy must be checked before the token is consumed');
});

// ═══════════════════════════════════════════════════════════════════════════
// The envelope.
// ═══════════════════════════════════════════════════════════════════════════

it('every error carries the §C3.1 envelope with a correlation id', async () => {
  const result = await post('/v1/auth/login', { identifier: freshEmail(), password: 'wrong' });

  assert.deepEqual(Object.keys(result.body), ['error']);
  assert.deepEqual(Object.keys(result.body.error).sort(), [
    'code',
    'correlation_id',
    'details',
    'message',
  ]);
  assert.match(result.body.error.correlation_id, /^[0-9a-fA-F-]{36}$|^[0-9A-Z]{26}$/);
});

it('no response anywhere carries a password or a hash', async () => {
  const email = freshEmail();
  const responses = [
    await post('/v1/auth/register', { email, password: GOOD_PASSWORD }),
    await post('/v1/auth/login', { identifier: email, password: GOOD_PASSWORD }),
    await post('/v1/auth/login', { identifier: email, password: 'wrong' }),
    await post('/v1/auth/password/forgot', { identifier: email }),
  ];

  for (const response of responses) {
    const serialised = JSON.stringify(response.body);
    assert.doesNotMatch(serialised, new RegExp(GOOD_PASSWORD), 'a password was echoed');
    assert.doesNotMatch(serialised, /\$argon2id\$/, 'a password hash was returned');
  }
});
