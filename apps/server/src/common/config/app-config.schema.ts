/**
 * M-004 · The environment contract — constitution §8.9, DoR #8, AC-FND-14.x.
 *
 * EVERY environment variable the server reads is declared here and NOWHERE ELSE. A
 * `process.env.SOMETHING` anywhere else in the codebase is a review rejection, because a variable
 * read at the point of use is a variable that is missing in production and discovered by a user.
 *
 * The process EXITS NON-ZERO on a missing or malformed variable. It never boots with a default.
 * The distinction matters more than it looks: a server that boots with `JWT_ACCESS_SECRET`
 * defaulted to a literal is a server that signs tokens anyone can forge, and it looks perfectly
 * healthy in every dashboard. Failing to start is loud, immediate and safe.
 *
 * Defaults ARE permitted for values that are genuinely environmental rather than secret — a port,
 * a log level, the GST rate. The rule is: if leaking it or guessing it has a security or money
 * consequence, it has no default.
 */

import { z } from 'zod';

/** Deployment environment. Drives posture decisions that must not be individually configurable. */
export const APP_ENVIRONMENTS = ['development', 'test', 'staging', 'production'] as const;
export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

const durationString = z.string().regex(/^\d+[smhd]$/, 'must be a duration like 15m, 24h or 30d');

/** A secret that must never fall back to a default and must never ship as the placeholder. */
const requiredSecret = (minLength: number) =>
  z
    .string()
    .min(minLength, `must be at least ${minLength} characters of real entropy`)
    .refine((v) => !v.startsWith('CHANGEME'), {
      message:
        'still holds the .env.example placeholder. This value must be generated per environment ' +
        'and supplied by the managed secret store (NFR-SEC-07), never committed.',
    });

export const appConfigSchema = z
  .object({
    // --- runtime ---------------------------------------------------------
    APP_ENV: z.enum(APP_ENVIRONMENTS),
    /**
     * RBI payment-data localisation: the whole stack runs in India-only regions.
     * Not a preference — a legal constraint (`LAUNCH_MARKET_INDIA.md` §6).
     */
    APP_REGION: z.string().min(1).default('ap-south-1'),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    // --- data ------------------------------------------------------------
    DATABASE_URL: z.string().url().startsWith('postgresql://'),
    /** Empty until staging. A read replica exists from staging upward. */
    DATABASE_REPLICA_URL: z
      .string()
      .url()
      .startsWith('postgresql://')
      .or(z.literal(''))
      .default(''),
    /**
     * M-013 · The audit writer connects SEPARATELY, as a role that is a member of app_append
     * and nothing else — so it can INSERT an audit row and cannot read one back.
     *
     * Optional, and the fallback is loud rather than silent: unset, the writer uses the
     * application connection and logs a warning at boot saying the "writer cannot read the
     * log" property does not hold. Acceptable locally, never in a deployed environment.
     *
     * Empty string rather than `.optional()`, matching `DATABASE_REPLICA_URL` directly above.
     * An unset variable and an empty one must behave identically, because `.env.example`
     * carries the key with no value — and a schema where `KEY=` fails while omitting the line
     * entirely succeeds is a schema that rejects its own example file. The parity test caught
     * exactly that.
     */
    AUDIT_DATABASE_URL: z.string().url().startsWith('postgresql://').or(z.literal('')).default(''),
    /**
     * M-014 · The elevation connection, as gymmap_platform — a member of app_platform_ro and
     * nothing else, holding SELECT grants only. Cross-tenant reads run here.
     *
     * Same empty-string convention as the two URLs above, and the same loud fallback.
     */
    PLATFORM_DATABASE_URL: z
      .string()
      .url()
      .startsWith('postgresql://')
      .or(z.literal(''))
      .default(''),
    REDIS_URL: z.string().url().startsWith('redis://'),
    /**
     * M-005 AC-2 · Three logical Redis databases, matching the Terraform module's split.
     *
     * They are separate so that a `FLUSHDB` on the cache — a routine thing to do while
     * debugging — cannot delete a queue. An evicted or flushed BullMQ key is an accepted job
     * that will never run, and nothing reports it: the API returned 202, the user was told it
     * worked, and the work simply never happens.
     *
     * The compose file caps Redis at exactly 3 databases, so an index above 2 fails loudly
     * rather than creating a fourth namespace that Terraform never provisioned.
     */
    REDIS_DB_CACHE: z.coerce.number().int().min(0).max(2).default(0),
    REDIS_DB_QUEUE: z.coerce.number().int().min(0).max(2).default(1),
    REDIS_DB_RATELIMIT: z.coerce.number().int().min(0).max(2).default(2),

    // --- object storage ---------------------------------------------------
    S3_ENDPOINT: z.string().url(),
    S3_REGION: z.string().min(1),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
    S3_MEDIA_BUCKET: z.string().min(1),
    /** BR-DAT-07: KYC documents live in a SEPARATE bucket with every access logged. */
    S3_KYC_BUCKET: z.string().min(1),
    CDN_BASE_URL: z.string().url(),

    // --- malware scanning (A-42, ADR-0048) ---------------------------------
    /**
     * `clamd`'s TCP socket. `NFR-SEC-10` requires every upload to be scanned and §12.7 `UP3`
     * requires it to happen before the object becomes retrievable.
     *
     * No default, on purpose. A default would let a deployment come up with a scanner pointed at
     * nothing and discover it only when the first document silently stayed in quarantine — which
     * looks identical to "the reviewer has not got to it yet". Absent config fails at boot.
     */
    CLAMAV_HOST: z.string().min(1),
    CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
    /**
     * How long a single scan may take before it is abandoned as `UNSCANNED`.
     *
     * A timeout is a REFUSAL, never a pass — see `malware-scan.port.ts`. Generous because clamd
     * loading its signature set on a cold start can take minutes, and the correct behaviour then
     * is a retryable quarantine rather than a served file.
     */
    CLAMAV_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

    // --- auth -------------------------------------------------------------
    JWT_ACCESS_SECRET: requiredSecret(32),
    JWT_ACCESS_TTL: durationString.default('15m'),
    JWT_REFRESH_SECRET: requiredSecret(32),
    JWT_REFRESH_TTL: durationString.default('30d'),

    // --- Verification SLA (FR-ADMN-11, Admin.md 5.1.1) --------------------
    //
    // 72 hours at launch. It lives HERE and not in code because `AdminDashboard.md` UI-ADM-4 is
    // explicit that it is "configuration, not a constant" and that "the console reads it from the
    // API and must never hard-code it" - so there has to be something for the API to read.
    //
    // The bound is 8760 hours (a year): a target measured in years is a typo, and a target of 0
    // would put every application in BREACHED the instant it arrived.
    VERIFICATION_SLA_TARGET_HOURS: z.coerce.number().int().min(1).max(8760).default(72),

    // --- QR check-in (A-11, EdDSA Ed25519) --------------------------------
    QR_SIGNING_PRIVATE_KEY: requiredSecret(32),
    QR_SIGNING_KEY_ID: z.string().min(1),
    QR_TOKEN_TTL_SECONDS: z.coerce.number().int().min(15).max(300).default(60),

    // --- MFA secret encryption (M-024, NFR-SEC-07) ------------------------
    //
    // ┌─ VALIDATED HERE SO A BAD KEY FAILS AT BOOT ────────────────────────────────────────────┐
    // │ `AesGcmSecretCipher` refuses anything that is not 32 bytes, and this schema refuses it   │
    // │ earlier still. Node would otherwise accept a 16-byte key and silently give AES-128 — a   │
    // │ deployment that starts, serves traffic, and protects every TOTP secret at half the       │
    // │ intended strength.                                                                        │
    // │                                                                                          │
    // │ `KL-101`: the key arrives through configuration rather than a managed secret store,      │
    // │ exactly as `JWT_ACCESS_SECRET` and `QR_SIGNING_PRIVATE_KEY` already do. The gap is        │
    // │ platform-wide and recorded; it is not introduced here.                                    │
    // └──────────────────────────────────────────────────────────────────────────────────────────┘
    MFA_SECRET_KEY: requiredSecret(32),
    // Stamped into every envelope, so rotation can tell two keys apart and old rows still open.
    MFA_SECRET_KEY_ID: z.string().min(1).default('local-dev-1'),

    // --- password hashing (A-12) ------------------------------------------
    //
    // The defaults are `Security.md` §2.4.2's recorded values, which is what A-12's approval
    // condition — "Parameter tuning must be recorded" — actually requires. They were 19456/2
    // (the OWASP floor) as a placeholder until M-020 read §2.4.2 and adopted the real ones.
    //
    // The `min()` bounds are the OWASP floor, NOT the policy: they exist so a misconfigured
    // deployment cannot go BELOW the floor, while re-calibration upward (A-12 requires it
    // annually and on any instance-class change) needs no code change.
    ARGON2_MEMORY_COST: z.coerce.number().int().min(19456).default(65536),
    ARGON2_TIME_COST: z.coerce.number().int().min(2).default(3),
    ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),

    /**
     * `Security.md` §2.4.2 — 8 concurrent hashes per API instance, behind a semaphore.
     *
     * 8 × 64 MiB is 512 MiB of transient memory, and that is the deliberate cap. Without it a
     * login flood is a memory-exhaustion denial of service **caused by the security control
     * itself** (STRIDE A1/D). The queue behind the semaphore is bounded so an attacker cannot
     * convert it into unbounded latency instead.
     */
    ARGON2_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(8),

    /** How long a request waits for a hash slot before `503 DEPENDENCY_UNAVAILABLE`. */
    ARGON2_QUEUE_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(5_000),

    // --- credential tokens (ADR-0034 — Redis, not a table) -----------------
    /** `Authentication.md` §8.7. Short on purpose: a reset link is a bearer credential. */
    PASSWORD_RESET_TTL_SECONDS: z.coerce.number().int().min(300).max(3_600).default(1_800),
    /** `Authentication.md` §8.3. A verification link may sit in an inbox overnight. */
    EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),

    // --- account lockout (FR-AUTH-08, Authentication.md §6) ----------------
    //
    // RLM6: limits are CONFIGURATION, not constants in code. The defaults are the specified
    // values and `lockout.policy.ts` holds the same numbers as its documented contract — the
    // policy module is the domain rule, these are the operational knobs.
    LOCKOUT_THRESHOLD: z.coerce.number().int().min(3).max(100).default(10),
    LOCKOUT_WINDOW_SECONDS: z.coerce.number().int().min(60).default(900),
    LOCKOUT_DURATION_SECONDS: z.coerce.number().int().min(60).default(900),

    // --- payments (EP-08) --------------------------------------------------
    /**
     * `TR-36`, `AC-FND-07.5` — the idempotency retention window, in seconds.
     *
     * CONFIGURATION, not a constant, and it must be at least the payment provider's own retry
     * window. Razorpay retries a webhook for up to 24 hours; a retention shorter than that means
     * a provider retry arrives after the key has expired, is treated as a first attempt, and
     * executes a second time.
     *
     * The comparison and both numbers are recorded in `docs/DECISION_LOG.md`. Default 24 h.
     */
    IDEMPOTENCY_RETENTION_SECONDS: z.coerce.number().int().min(3600).max(604_800).default(86_400),

    PAYMENT_PROVIDER: z.enum(['razorpay', 'stripe', 'stub']),
    RAZORPAY_KEY_ID: z.string().default(''),
    RAZORPAY_KEY_SECRET: z.string().default(''),
    /** BR-PAY-02: activation is webhook-driven, so this secret is load-bearing, not optional. */
    RAZORPAY_WEBHOOK_SECRET: z.string().default(''),

    // --- notifications (A-19 vendors still open) --------------------------
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535),
    SMTP_USER: z.string().default(''),
    SMTP_PASSWORD: z.string().default(''),
    SMTP_FROM: z.string().min(1),
    SMS_PROVIDER: z.enum(['console', 'msg91', 'twilio']).default('console'),

    // --- observability -----------------------------------------------------
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().or(z.literal('')).default(''),
    OTEL_SERVICE_NAME: z.string().min(1).default('gymmap-server'),
    SENTRY_DSN: z.string().url().or(z.literal('')).default(''),
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

    // --- India defaults (LAUNCH_MARKET_INDIA.md) ---------------------------
    DEFAULT_CURRENCY: z.literal('INR').default('INR'),
    DEFAULT_TIMEZONE: z.literal('Asia/Kolkata').default('Asia/Kolkata'),
    DEFAULT_LOCALE: z.string().min(2).default('en-IN'),
    /** 18%, split CGST 9% + SGST 9% on intra-state supply. */
    GST_RATE_BPS: z.coerce.number().int().min(0).max(10000).default(1800),
    /** April–March. The FY boundary is 18:30 UTC on 31 March — not midnight. */
    FINANCIAL_YEAR_START_MONTH: z.coerce.number().int().min(1).max(12).default(4),
    COMMISSION_STANDARD_BPS: z.coerce.number().int().min(0).max(10000).default(1000),
    COMMISSION_RENEWAL_BPS: z.coerce.number().int().min(0).max(10000).default(500),
  })
  .superRefine((config, ctx) => {
    // Cross-field rules. These are the ones a per-variable schema cannot express, and they are
    // exactly the combinations that boot fine and fail in production.

    // M-005 AC-2 — the three Redis databases must be DISTINCT.
    // Sharing an index silently defeats the whole separation: the cache and the queue would
    // live in one keyspace, and the first FLUSHDB while debugging would delete accepted jobs.
    const redisDbs = [config.REDIS_DB_CACHE, config.REDIS_DB_QUEUE, config.REDIS_DB_RATELIMIT];
    if (new Set(redisDbs).size !== redisDbs.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_DB_QUEUE'],
        message:
          `REDIS_DB_CACHE, REDIS_DB_QUEUE and REDIS_DB_RATELIMIT must all differ (got ` +
          `${redisDbs.join(', ')}). Sharing an index puts the cache and the BullMQ queue in one ` +
          `keyspace, so a routine FLUSHDB deletes accepted jobs that will never run — and ` +
          `nothing reports it, because the API already returned 202.`,
      });
    }

    if (config.PAYMENT_PROVIDER === 'razorpay') {
      for (const key of [
        'RAZORPAY_KEY_ID',
        'RAZORPAY_KEY_SECRET',
        'RAZORPAY_WEBHOOK_SECRET',
      ] as const) {
        if (!config[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message:
              `PAYMENT_PROVIDER is "razorpay" but ${key} is empty. ` +
              (key === 'RAZORPAY_WEBHOOK_SECRET'
                ? 'BR-PAY-02 makes activation webhook-driven: without this secret every webhook ' +
                  'fails signature verification and NO membership ever activates, while checkout ' +
                  'appears to succeed.'
                : 'Payments cannot be initiated.'),
          });
        }
      }
    }

    if (config.APP_ENV === 'production') {
      // Production-only posture. Each of these is survivable locally and unacceptable live.
      if (config.SMS_PROVIDER === 'console') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMS_PROVIDER'],
          message:
            'SMS_PROVIDER is the console sink in production. Every OTP would be written to the ' +
            'log instead of being delivered — a total auth outage AND a BR-DAT-06 breach.',
        });
      }
      if (config.PAYMENT_PROVIDER === 'stub') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PAYMENT_PROVIDER'],
          message:
            'The stub payment provider must never run in production — it approves everything.',
        });
      }
      if (!config.APP_REGION.startsWith('ap-south')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['APP_REGION'],
          message:
            `APP_REGION is "${config.APP_REGION}". RBI payment-data localisation requires India-only ` +
            'regions for production (LAUNCH_MARKET_INDIA.md §6). This is a legal constraint.',
        });
      }
      if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_REFRESH_SECRET'],
          message:
            'The access and refresh secrets are identical, so an access token can be replayed as ' +
            'a refresh token and the 15-minute access TTL becomes meaningless.',
        });
      }
      if (config.LOG_LEVEL === 'trace' || config.LOG_LEVEL === 'debug') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['LOG_LEVEL'],
          message:
            `LOG_LEVEL "${config.LOG_LEVEL}" in production. Debug logging carries request bodies ` +
            'past the redaction list and into the aggregator (BR-DAT-06).',
        });
      }
    }
  });

export type AppConfig = z.infer<typeof appConfigSchema>;

/** Injection token. Never `process.env` at a call site (§8.9). */
export const APP_CONFIG = Symbol('APP_CONFIG');

/**
 * Validates the environment and returns the typed config, or throws with every problem listed.
 *
 * Reports ALL failures at once rather than the first. A first-failure-only loop turns a
 * misconfigured deployment into five sequential restarts, each revealing one more variable.
 */
export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = appConfigSchema.safeParse(env);
  if (result.success) return result.data;

  const problems = result.error.issues
    .map((issue) => {
      const name = issue.path.join('.') || '(root)';
      // The VALUE is never printed — these are secrets by definition (BR-DAT-06, NFR-SEC-07).
      return `  · ${name}: ${issue.message}`;
    })
    .join('\n');

  throw new Error(
    `Environment validation failed — the server will not start (constitution §8.9).\n\n` +
      `${problems}\n\n` +
      `Copy .env.example to .env.local and fill these in. Values are never defaulted, because a ` +
      `server that boots with a guessed secret looks healthy in every dashboard while being unsafe.`,
  );
}
