/**
 * M-015 · The one place a test declares the environment the server needs.
 *
 * ┌─ WHY THIS IS A FILE AND NOT A COPY-PASTED OBJECT ───────────────────────────────────────────┐
 * │ The isolation suite, the contract suite and every future integration spec all boot the same │
 * │ application, so they all need the same twenty variables. Copied into each, one copy falls    │
 * │ behind the moment `app-config.schema.ts` gains a required key — and the symptom is           │
 * │ "Environment validation failed" with `logger: false` swallowing which key it was.            │
 * │                                                                                              │
 * │ Worse, that failure lands in a `before()` hook, so the suite SKIPS rather than fails. The    │
 * │ most important suite in the repository then reports "fail 0" having asserted nothing.        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Every value here is a LOCAL development credential that also appears in `.env.example`. None is
 * a real secret, and gitleaks is configured accordingly — but the file is named `test-env` and
 * lives under `test/` so that nothing in `src/` can reach it (`no-test-harness-in-src`).
 */

/** The signing key the suite mints tokens with. Must match `JWT_ACCESS_SECRET` below. */
export const TEST_JWT_SECRET = 'i'.repeat(48);

export const TEST_DATABASE_URL =
  process.env['DATABASE_URL_APP'] ??
  'postgresql://gymmap_app:gymmap_local_dev@localhost:5432/gymmap?schema=public';

/**
 * Applies the test environment to `process.env`.
 *
 * Mutates rather than returning a config object, because `AppModule` reads `process.env` at
 * construction — a returned object would have to be threaded into a factory the application does
 * not have, and the seam would exist only for tests.
 */
export function applyTestEnv(overrides: Record<string, string> = {}): void {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    APP_ENV: 'test',
    // A valid port, even though the suite calls `app.listen(0)` to get an ephemeral one. The
    // schema refuses PORT below 1 — correctly, because a configured PORT of 0 in a deployment is
    // a typo that binds a random port and takes the service out of the load balancer. The
    // ephemeral binding is a listen() argument, not a configuration value.
    PORT: '3100',

    DATABASE_URL: TEST_DATABASE_URL,
    REDIS_URL: 'redis://localhost:6379',

    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'ap-south-1',
    S3_ACCESS_KEY_ID: 'minioadmin',
    S3_SECRET_ACCESS_KEY: 'minioadmin',
    S3_MEDIA_BUCKET: 'gymmap-media',
    S3_KYC_BUCKET: 'gymmap-kyc',
    CDN_BASE_URL: 'http://localhost:9000/gymmap-media',

    JWT_ACCESS_SECRET: TEST_JWT_SECRET,
    JWT_REFRESH_SECRET: 'j'.repeat(48),
    QR_SIGNING_PRIVATE_KEY: 'q'.repeat(48),
    QR_SIGNING_KEY_ID: 'test-key-1',

    // ┌─ NOT `'m'.repeat(44)` — THIS IS BASE64 AND `SecretCipher` DECODES IT ──────────────────┐
    // │ The schema asks only for 32 CHARACTERS, so a repeated literal passes validation and    │
    // │ then fails at cipher construction, which refuses a key that is not exactly 32 BYTES    │
    // │ after decoding. `'d'.repeat(48)` decodes to 36 and was rejected in four environments    │
    // │ at once during M-024. This is `Buffer.alloc(32, 0x6d).toString('base64')` — 44 base64   │
    // │ characters, 32 bytes, written out rather than computed so the value is greppable.       │
    // └────────────────────────────────────────────────────────────────────────────────────────┘
    MFA_SECRET_KEY: 'bW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW0=',
    MFA_SECRET_KEY_ID: 'test-key-1',

    // 'stub' rather than 'razorpay'. `.env.example` once shipped `razorpay` with empty keys, and
    // anyone who copied it got a server that would not boot — the schema refuses a named provider
    // with no credentials, correctly.
    PAYMENT_PROVIDER: 'stub',

    SMTP_HOST: 'localhost',
    SMTP_PORT: '1025',
    SMTP_FROM: 'gymmap-test@localhost',

    ...overrides,
  });
}
