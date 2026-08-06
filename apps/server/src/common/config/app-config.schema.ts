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
    REDIS_URL: z.string().url().startsWith('redis://'),

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

    // --- auth -------------------------------------------------------------
    JWT_ACCESS_SECRET: requiredSecret(32),
    JWT_ACCESS_TTL: durationString.default('15m'),
    JWT_REFRESH_SECRET: requiredSecret(32),
    JWT_REFRESH_TTL: durationString.default('30d'),

    // --- QR check-in (A-11, EdDSA Ed25519) --------------------------------
    QR_SIGNING_PRIVATE_KEY: requiredSecret(32),
    QR_SIGNING_KEY_ID: z.string().min(1),
    QR_TOKEN_TTL_SECONDS: z.coerce.number().int().min(15).max(300).default(60),

    // --- password hashing (A-12) ------------------------------------------
    ARGON2_MEMORY_COST: z.coerce.number().int().min(19456).default(19456),
    ARGON2_TIME_COST: z.coerce.number().int().min(2).default(2),
    ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),

    // --- payments (EP-08) --------------------------------------------------
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
