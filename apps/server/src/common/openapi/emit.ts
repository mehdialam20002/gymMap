/**
 * M-008 · `pnpm --filter @gymmap/server openapi:emit` — writes the committed `openapi.json`.
 *
 * Runs the Nest application graph WITHOUT binding a port or connecting to a database. That
 * matters: the contract must be generatable in CI on a runner with no Postgres, and by a
 * developer whose stack is down. A generator that needs the world running is a generator that
 * stops being run.
 */

import 'reflect-metadata';

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../app.module.js';
import { createOpenApiDocument, serialiseOpenApiDocument } from './document.factory.js';

const OUTPUT = resolve(process.cwd(), '../../openapi.json');

/**
 * ┌─ GENERATING THE CONTRACT MUST NOT REQUIRE SECRETS ──────────────────────────────────────────┐
 * │ §8.9 makes the config schema refuse to boot on a missing variable, and that is correct for  │
 * │ a SERVER. It is wrong for a contract generator: job 10 runs on a CI runner with no S3        │
 * │ credentials, no SMTP host and no payment keys, and a developer regenerating after adding a   │
 * │ route should not need a filled-in .env.local either.                                         │
 * │                                                                                              │
 * │ So this fills any UNSET variable with a syntactically valid placeholder. It never overwrites │
 * │ a real value, so running it locally with a real .env.local behaves identically.              │
 * │                                                                                              │
 * │ Safe because nothing here connects: `app.init()` builds the module graph and stops. No port  │
 * │ is bound, no socket is opened, and the placeholders are visibly fake so a value that leaked  │
 * │ into an artefact would be unmistakable rather than plausible.                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const CONTRACT_ONLY_PLACEHOLDERS: Readonly<Record<string, string>> = {
  APP_ENV: 'development',
  APP_REGION: 'ap-south-1',
  LOG_LEVEL: 'error',
  PORT: '3000',
  DATABASE_URL: 'postgresql://openapi:openapi@127.0.0.1:5432/openapi?schema=public',
  REDIS_URL: 'redis://127.0.0.1:6379',
  S3_ENDPOINT: 'http://127.0.0.1:9000',
  S3_REGION: 'ap-south-1',
  S3_ACCESS_KEY_ID: 'OPENAPI-PLACEHOLDER-NOT-A-KEY',
  S3_SECRET_ACCESS_KEY: 'OPENAPI-PLACEHOLDER-NOT-A-SECRET',
  S3_MEDIA_BUCKET: 'gymmap-media',
  S3_KYC_BUCKET: 'gymmap-kyc',
  CDN_BASE_URL: 'http://127.0.0.1:9000',
  JWT_ACCESS_SECRET: 'openapi-placeholder-not-a-secret-0123456789abcd',
  JWT_REFRESH_SECRET: 'openapi-placeholder-not-a-secret-abcdef01234567',
  QR_SIGNING_PRIVATE_KEY: 'openapi-placeholder-not-a-key-0123456789abcdef',
  QR_SIGNING_KEY_ID: 'openapi-placeholder',
  // `stub`, never `razorpay` — the generator must not imply a provider is configured.
  PAYMENT_PROVIDER: 'stub',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1025',
  SMTP_FROM: 'openapi@localhost',
};

function applyContractOnlyEnvironment(): string[] {
  const applied: string[] = [];
  for (const [key, value] of Object.entries(CONTRACT_ONLY_PLACEHOLDERS)) {
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
      applied.push(key);
    }
  }
  return applied;
}

async function emit(): Promise<void> {
  const placeholders = applyContractOnlyEnvironment();
  if (placeholders.length > 0) {
    process.stderr.write(
      `openapi:emit — ${placeholders.length} variable(s) filled with placeholders ` +
        `(contract generation needs no real credentials)\n`,
    );
  }

  // `logger: false` keeps boot noise out of the output, so CI's diff is not polluted by it.
  //
  // `abortOnError: false` is NOT a style choice. With the default `true`, Nest calls
  // `process.exit(1)` itself on a container failure — and because the logger is disabled, it
  // does so having printed NOTHING. That combination produced a silent exit 1 that looked like
  // a broken script rather than a broken module graph. With `false` the failure rejects and
  // reaches the catch below, which prints the stack.
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.init();

  const document = createOpenApiDocument(app);
  writeFileSync(OUTPUT, serialiseOpenApiDocument(document), 'utf8');

  const routeCount = Object.values(document.paths ?? {}).reduce(
    (total, item) =>
      total +
      Object.keys(item ?? {}).filter((k) =>
        ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(k),
      ).length,
    0,
  );

  await app.close();
  process.stderr.write(`openapi.json written — ${routeCount} operation(s)\n`);
}

emit().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
