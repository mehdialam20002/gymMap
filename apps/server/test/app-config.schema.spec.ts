/**
 * M-004 AC-3 — removing any required variable makes the process fail to start, with a message
 * naming the variable. Never boot with a default.
 *
 * §8.9, DoR #8.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadAppConfig, appConfigSchema } from '../dist/common/config/app-config.schema.js';

/** A minimal environment that MUST validate. Everything else has a legitimate default. */
function validEnv(): Record<string, string> {
  return {
    APP_ENV: 'development',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/gymmap?schema=public',
    REDIS_URL: 'redis://localhost:6379',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'ap-south-1',
    S3_ACCESS_KEY_ID: 'minioadmin',
    S3_SECRET_ACCESS_KEY: 'minioadmin',
    S3_MEDIA_BUCKET: 'gymmap-media',
    S3_KYC_BUCKET: 'gymmap-kyc',
    CDN_BASE_URL: 'http://localhost:9000/gymmap-media',
    // A-42 / ADR-0048. Required with no default on purpose: a deployment pointed at nothing
    // would quarantine every document silently, which looks exactly like a slow reviewer.
    CLAMAV_HOST: 'localhost',
    JWT_ACCESS_SECRET: 'a'.repeat(48),
    JWT_REFRESH_SECRET: 'b'.repeat(48),
    QR_SIGNING_PRIVATE_KEY: 'c'.repeat(48),
    QR_SIGNING_KEY_ID: 'local-dev-1',
    // M-024. `MFA_SECRET_KEY_ID` has a default, so only the key itself is required.
    // 64 hex characters = exactly 32 bytes. A 48-char value looked right and decoded to
    // 36, which the cipher refuses at boot — the check doing precisely its job.
    MFA_SECRET_KEY: 'd'.repeat(64),
    PAYMENT_PROVIDER: 'stub',
    SMTP_HOST: 'localhost',
    SMTP_PORT: '1025',
    SMTP_FROM: 'GymMap <no-reply@gymmap.local>',
  };
}

/** The variables with NO default — each must individually break the boot. */
const REQUIRED = [
  'APP_ENV',
  'DATABASE_URL',
  'REDIS_URL',
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_MEDIA_BUCKET',
  'S3_KYC_BUCKET',
  'CDN_BASE_URL',
  'CLAMAV_HOST',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'QR_SIGNING_PRIVATE_KEY',
  'QR_SIGNING_KEY_ID',
  'MFA_SECRET_KEY',
  'PAYMENT_PROVIDER',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_FROM',
];

test('the reference environment validates', () => {
  const config = loadAppConfig(validEnv());
  assert.equal(config.APP_ENV, 'development');
  assert.equal(config.PORT, 3000, 'PORT has a legitimate default');
  assert.equal(config.DEFAULT_CURRENCY, 'INR');
  assert.equal(config.GST_RATE_BPS, 1800, '18% — CGST 9 + SGST 9 intra-state');
});

test('AC-3 — each required variable, removed individually, fails and is named', () => {
  for (const key of REQUIRED) {
    const env = validEnv();
    delete env[key];
    assert.throws(
      () => loadAppConfig(env),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(
          error.message,
          new RegExp(key),
          `removing ${key} produced an error that does not name it — an operator would have to ` +
            'guess which variable is missing',
        );
        return true;
      },
      `removing ${key} did NOT fail the boot. It has silently acquired a default.`,
    );
  }
});

test('all problems are reported at once, not one restart at a time', () => {
  const env = validEnv();
  delete env['DATABASE_URL'];
  delete env['REDIS_URL'];
  delete env['SMTP_HOST'];

  const error = captureError(() => loadAppConfig(env));
  assert.ok(error);
  for (const key of ['DATABASE_URL', 'REDIS_URL', 'SMTP_HOST']) {
    assert.match(error.message, new RegExp(key), `${key} missing from the combined report`);
  }
});

test('a placeholder secret is refused — .env.example must not reach any environment', () => {
  const env = validEnv();
  env['JWT_ACCESS_SECRET'] = 'CHANGEME_generate_a_48_byte_random_value';
  const error = captureError(() => loadAppConfig(env));
  assert.ok(error);
  assert.match(error.message, /JWT_ACCESS_SECRET/);
  assert.match(error.message, /placeholder/i);
});

test('a short secret is refused', () => {
  const env = validEnv();
  env['JWT_ACCESS_SECRET'] = 'short';
  assert.throws(() => loadAppConfig(env), /JWT_ACCESS_SECRET/);
});

test('the error message never echoes a secret VALUE', () => {
  const env = validEnv();
  const secret = 'CHANGEME_this_exact_string_must_not_appear';
  env['JWT_REFRESH_SECRET'] = secret;
  const error = captureError(() => loadAppConfig(env));
  assert.ok(error);
  assert.ok(
    !error.message.includes(secret),
    'the invalid secret was echoed into the error message, which goes to stdout and the log ' +
      'aggregator (NFR-SEC-07, BR-DAT-06)',
  );
});

// ---------------------------------------------------------------------------
// Cross-field rules — the combinations that boot fine and fail in production.
// ---------------------------------------------------------------------------

test('BR-PAY-02 — razorpay without a webhook secret is refused', () => {
  const env = validEnv();
  env['PAYMENT_PROVIDER'] = 'razorpay';
  env['RAZORPAY_KEY_ID'] = 'rzp_test_x';
  env['RAZORPAY_KEY_SECRET'] = 'secret';
  // RAZORPAY_WEBHOOK_SECRET deliberately absent.
  const error = captureError(() => loadAppConfig(env));
  assert.ok(error, 'a missing webhook secret must not boot');
  assert.match(error.message, /RAZORPAY_WEBHOOK_SECRET/);
  assert.match(
    error.message,
    /BR-PAY-02|activation/i,
    'the message must explain that no membership would ever activate',
  );
});

test('production refuses the console SMS sink', () => {
  const env = productionEnv();
  env['SMS_PROVIDER'] = 'console';
  const error = captureError(() => loadAppConfig(env));
  assert.ok(error);
  assert.match(error.message, /SMS_PROVIDER/);
});

test('production refuses the stub payment provider', () => {
  const env = productionEnv();
  env['PAYMENT_PROVIDER'] = 'stub';
  assert.throws(() => loadAppConfig(env), /PAYMENT_PROVIDER/);
});

test('production refuses a non-India region — RBI data localisation', () => {
  const env = productionEnv();
  env['APP_REGION'] = 'eu-west-1';
  const error = captureError(() => loadAppConfig(env));
  assert.ok(error);
  assert.match(error.message, /APP_REGION/);
  assert.match(error.message, /RBI|localisation/i);
});

test('production refuses identical access and refresh secrets', () => {
  const env = productionEnv();
  env['JWT_ACCESS_SECRET'] = 'z'.repeat(48);
  env['JWT_REFRESH_SECRET'] = 'z'.repeat(48);
  const error = captureError(() => loadAppConfig(env));
  assert.ok(error);
  assert.match(error.message, /JWT_REFRESH_SECRET/);
});

test('production refuses debug logging — BR-DAT-06', () => {
  const env = productionEnv();
  env['LOG_LEVEL'] = 'debug';
  const error = captureError(() => loadAppConfig(env));
  assert.ok(error);
  assert.match(error.message, /LOG_LEVEL/);
});

test('a valid production environment passes every cross-field rule', () => {
  const config = loadAppConfig(productionEnv());
  assert.equal(config.APP_ENV, 'production');
  assert.equal(config.SMS_PROVIDER, 'msg91');
});

test('the schema rejects an unknown enum value rather than coercing it', () => {
  const env = validEnv();
  env['APP_ENV'] = 'staging-2';
  assert.equal(appConfigSchema.safeParse(env).success, false);
});

function productionEnv(): Record<string, string> {
  return {
    ...validEnv(),
    APP_ENV: 'production',
    APP_REGION: 'ap-south-1',
    LOG_LEVEL: 'info',
    SMS_PROVIDER: 'msg91',
    PAYMENT_PROVIDER: 'razorpay',
    RAZORPAY_KEY_ID: 'rzp_live_x',
    RAZORPAY_KEY_SECRET: 'live-secret',
    RAZORPAY_WEBHOOK_SECRET: 'webhook-secret',
  };
}

function captureError(fn: () => unknown): Error | undefined {
  try {
    fn();
    return undefined;
  } catch (thrown) {
    return thrown instanceof Error ? thrown : new Error(String(thrown));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// The test harness must satisfy the schema it boots the application against
// ═══════════════════════════════════════════════════════════════════════════

test('applyTestEnv() produces an environment this schema accepts', async () => {
  // ┌─ THIS ASSERTION EXISTS BECAUSE THE FAILURE IT CATCHES ALREADY HAPPENED ────────────────────┐
  // │ `test-env.ts` opens by naming its own failure mode: "one copy falls behind the moment      │
  // │ `app-config.schema.ts` gains a required key". M-024 added `MFA_SECRET_KEY` and did not add │
  // │ it there. Every isolation spec that boots the application then failed in a `before()` hook │
  // │ with "Environment validation failed", and the reason took a probe to recover because the   │
  // │ hook's own message pointed at `db:setup` instead.                                           │
  // │                                                                                             │
  // │ A unit test is the right place: it runs in every `test:unit` invocation, needs no database, │
  // │ and fails in the same commit that adds the key rather than in whichever suite boots next.   │
  // └────────────────────────────────────────────────────────────────────────────────────────────┘
  const { applyTestEnv } = await import('./harness/test-env.ts');

  const before = { ...process.env };
  try {
    applyTestEnv();
    const error = captureError(() => loadAppConfig(process.env));
    assert.equal(
      error,
      undefined,
      `test-env.ts has fallen behind app-config.schema.ts:\n\n${error?.message ?? ''}`,
    );
  } finally {
    // `applyTestEnv` mutates `process.env` by design, and a unit run must not leak that into the
    // specs that follow it in the same process.
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
});

test('the harness MFA key decodes to exactly 32 bytes, which the schema does not check', () => {
  // The schema asks for 32 CHARACTERS; `SecretCipher` requires 32 BYTES after base64 decoding.
  // A value satisfying the first and failing the second boots the config and then throws at
  // cipher construction — which is how `'d'.repeat(48)` (36 bytes) got as far as four environments.
  const key = 'bW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW0=';
  assert.equal(Buffer.from(key, 'base64').length, 32);
});
