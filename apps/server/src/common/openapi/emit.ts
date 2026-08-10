/**
 * M-008 · `pnpm --filter @gymmap/server openapi:emit` — writes the committed `openapi.json`.
 *
 * Runs the Nest application graph WITHOUT binding a port or connecting to a database. That
 * matters: the contract must be generatable in CI on a runner with no Postgres, and by a
 * developer whose stack is down. A generator that needs the world running is a generator that
 * stops being run.
 */

import 'reflect-metadata';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { CONTRACT_ONLY_ENV } from '../bootstrap/contract-only-mode.js';

import { AppModule } from '../../app.module.js';
import { configureApp } from '../bootstrap/configure-app.js';
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
/**
 * The secrets, and ONLY the secrets. Everything else is read from `.env.example`.
 *
 * ┌─ THIS MAP HELD EVERY VARIABLE UNTIL 2026-08-11, AND WENT STALE THE SAME WAY TWICE ───────────┐
 * │ The comment below records the first time: *"it silently did from M-010 to M-020, leaving      │
 * │ openapi.json eight milestones stale while every gate stayed green."* The second was           │
 * │ `CLAMAV_HOST`, added as a required variable with `A-42` and absent from a hand-written list   │
 * │ nobody thinks about when adding a config key.                                                  │
 * │                                                                                              │
 * │ A hand-maintained mirror of a schema is the failure this repository keeps finding — `TD-048`, │
 * │ `TD-049`, `dependency-approval.mjs`'s allowlist. So the mirror is gone: `.env.example` is     │
 * │ already the file that carries a valid local value for every variable, and                     │
 * │ `env-example-parity.spec.ts` already proves it *"would actually get a running server"* by     │
 * │ parsing it through the real Zod schema. Reading it here reuses that guarantee instead of      │
 * │ restating it.                                                                                  │
 * │                                                                                              │
 * │ The secrets cannot come from there: `requiredSecret` refuses anything starting `CHANGEME`,    │
 * │ which is exactly what `.env.example` holds and must hold. `env-example-parity.spec.ts`        │
 * │ substitutes the same four for the same reason.                                                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const SECRET_PLACEHOLDERS: Readonly<Record<string, string>> = {
  // Tells the three Prisma services and the Redis provider to build their clients and open
  // NOTHING. Without it this script dies on `Authentication failed against database server`
  // — which it silently did from M-010 to M-020, leaving openapi.json eight milestones
  // stale while every gate stayed green. See common/bootstrap/contract-only-mode.ts.
  [CONTRACT_ONLY_ENV]: '1',
  LOG_LEVEL: 'error',
  JWT_ACCESS_SECRET: 'openapi-placeholder-not-a-secret-0123456789abcd',
  JWT_REFRESH_SECRET: 'openapi-placeholder-not-a-secret-abcdef01234567',
  QR_SIGNING_PRIVATE_KEY: 'openapi-placeholder-not-a-key-0123456789abcdef',
  QR_SIGNING_KEY_ID: 'openapi-placeholder',
  // 64 hex characters, because `AesGcmSecretCipher` decodes this and refuses anything that is
  // not 32 bytes — a text placeholder like the ones above fails the boot the emitter needs.
  // Obviously not a key: it spells the fact in hex, and the emitter never encrypts anything.
  MFA_SECRET_KEY: 'deadbeef'.repeat(8),
  MFA_SECRET_KEY_ID: 'openapi-placeholder',
  // `stub`, never `razorpay` — the generator must not imply a provider is configured.
  PAYMENT_PROVIDER: 'stub',
};

/**
 * `.env.example`, found by walking up from this file rather than from `process.cwd()`.
 *
 * turbo runs a workspace script with the CWD set to that workspace, and `reference-data-drift`
 * already shipped the CWD-relative version of this bug: the read returned nothing and the check
 * reported OK on an empty set.
 */
function readEnvExample(): Record<string, string> {
  /*
   * `__dirname`, not `import.meta.url`.
   *
   * `apps/server` compiles to CommonJS — `tsc` refuses `import.meta` here outright — even though
   * the source is written with ESM specifiers. `__dirname` is the CJS equivalent and is what this
   * file actually has at runtime.
   */
  let dir = __dirname;

  for (let hop = 0; hop < 8; hop += 1) {
    const candidate = join(dir, '.env.example');
    if (existsSync(candidate)) {
      const values: Record<string, string> = {};
      for (const line of readFileSync(candidate, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (trimmed === '' || trimmed.startsWith('#')) continue;
        const at = trimmed.indexOf('=');
        if (at === -1) continue;
        // Strip the inline comment BEFORE trimming. Trimming first turns `KEY=   # note` into the
        // string `# note`, because after the trim there is no ` #` left to find — the marker is at
        // index 0, and the variable then looks set to comment text.
        let value = trimmed.slice(at + 1);
        const hash = value.search(/(^|\s)#/);
        if (hash !== -1) value = value.slice(0, hash);
        values[trimmed.slice(0, at).trim()] = value.trim().replace(/^["']|["']$/g, '');
      }
      return values;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    'openapi:emit could not find .env.example by walking up from its own location. It supplies ' +
      'a valid value for every configuration variable, and without it the emitter cannot boot ' +
      'the application it is documenting.',
  );
}

/**
 * Fills every UNSET variable. `.env.example` first, then the secrets on top of it.
 *
 * Order matters: the example's `CHANGEME` placeholders are refused by `requiredSecret`, so
 * `SECRET_PLACEHOLDERS` must overwrite them rather than the other way round. A real `.env.local`
 * still wins over both — the emitter never overwrites a value the caller supplied, so running it
 * with a filled environment behaves identically.
 */
function applyContractOnlyEnvironment(): string[] {
  const applied: string[] = [];
  const unset = (key: string): boolean => process.env[key] === undefined || process.env[key] === '';

  for (const [key, value] of Object.entries(readEnvExample())) {
    if (unset(key)) {
      process.env[key] = value;
      applied.push(key);
    }
  }

  for (const [key, value] of Object.entries(SECRET_PLACEHOLDERS)) {
    // `!applied.includes(key)` is NOT the test. A secret filled from the example is a CHANGEME
    // that must still be replaced, so the override runs whenever the value is unset OR came from
    // the example — anything except a value the caller genuinely supplied.
    if (unset(key) || applied.includes(key)) {
      process.env[key] = value;
      if (!applied.includes(key)) applied.push(key);
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
  // The SAME configuration the server applies. Without this the document advertises
  // unversioned routes while the server serves /v1 — and every generated client 404s.
  configureApp(app);
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
