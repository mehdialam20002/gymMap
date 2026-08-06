/**
 * M-005 · `.env.example` must stay in step with `app-config.schema.ts`.
 *
 * The milestone requires `.env.example` to carry every variable the schema declares, with a safe
 * local default. That pairing rots the moment someone adds a variable to the schema and not to
 * the example: the next person clones the repository, copies the example, and the server refuses
 * to boot with a message about a variable they have never heard of. It is a five-minute problem
 * that everyone hits once.
 *
 * Runs without Docker, so it holds even where the containers cannot be started.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { appConfigSchema } from '../dist/common/config/app-config.schema.js';

/** Every key the schema knows about. */
const schemaKeys = Object.keys(appConfigSchema._def.schema.shape).sort();

const envExample = readFileSync(resolve('../../.env.example'), 'utf8');

/** Keys present in `.env.example`, ignoring comments and blank lines. */
const exampleKeys = envExample
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.split('=')[0]?.trim())
  .filter((key): key is string => Boolean(key))
  .sort();

test('every schema variable appears in .env.example', () => {
  const missing = schemaKeys.filter((key) => !exampleKeys.includes(key));
  assert.deepEqual(
    missing,
    [],
    `These variables are declared in app-config.schema.ts but absent from .env.example:\n` +
      `  ${missing.join(', ')}\n` +
      `A fresh clone would copy the example and then fail to boot on a variable nobody documented.`,
  );
});

test('.env.example declares nothing the schema does not read', () => {
  const orphans = exampleKeys.filter((key) => !schemaKeys.includes(key));
  assert.deepEqual(
    orphans,
    [],
    `These variables are in .env.example but no longer read by the schema:\n` +
      `  ${orphans.join(', ')}\n` +
      `A stale variable is worse than a missing one — someone will set it, observe no effect, ` +
      `and lose an afternoon. §8.9 requires every variable to be declared in one place.`,
  );
});

test('the example parses cleanly through the real schema', () => {
  // The strongest form of the check: not "are the keys the same" but "would a developer who
  // copied this file verbatim actually get a running server".
  const parsed: Record<string, string> = {};
  for (const line of envExample.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    // Strip the inline comment BEFORE trimming. Trimming first turns
    //     KEY=            # a comment
    // into the string "# a comment", because after the trim there is no " #" left to find —
    // the comment marker is at index 0. The variable then looks set to comment text rather
    // than empty, and the schema rejects it for a reason that has nothing to do with the file.
    let value = trimmed.slice(index + 1);
    const hashAt = value.search(/(^|\s)#/);
    if (hashAt !== -1) value = value.slice(0, hashAt);
    parsed[key] = value.trim().replace(/^["']|["']$/g, '');
  }

  // The placeholder secrets are REJECTED by design (`requiredSecret` refuses CHANGEME), which is
  // the point of that rule — so substitute real-shaped values, exactly as a developer must.
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'QR_SIGNING_PRIVATE_KEY']) {
    parsed[key] = 'x'.repeat(48);
  }

  const result = appConfigSchema.safeParse(parsed);
  assert.equal(
    result.success,
    true,
    `.env.example does not satisfy its own schema:\n` +
      (result.success
        ? ''
        : result.error.issues.map((i) => `  · ${i.path.join('.')}: ${i.message}`).join('\n')),
  );
});

test('M-005 AC-2 — the example gives the three Redis databases distinct indices', () => {
  const dbs = ['REDIS_DB_CACHE', 'REDIS_DB_QUEUE', 'REDIS_DB_RATELIMIT'].map((key) => {
    const match = envExample.match(new RegExp(`^${key}=(\\d+)`, 'm'));
    assert.ok(match, `${key} is missing from .env.example`);
    return Number(match![1]);
  });
  assert.equal(new Set(dbs).size, 3, 'the three Redis databases must have distinct indices');
  assert.ok(
    dbs.every((db) => db >= 0 && db <= 2),
    'compose caps Redis at 3 databases, so every index must be 0-2',
  );
});

test('no real credential has been committed to .env.example', () => {
  // Gitleaks scans this in CI, but the local check is instant and catches the paste before it
  // becomes a commit that has to be scrubbed from history.
  for (const [key, pattern] of [
    ['a live Razorpay key', /rzp_live_/],
    ['an AWS access key', /AKIA[0-9A-Z]{16}/],
    ['a private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ] as const) {
    assert.ok(!pattern.test(envExample), `.env.example appears to contain ${key}`);
  }
  // The secret placeholders must still BE placeholders.
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'QR_SIGNING_PRIVATE_KEY']) {
    const match = envExample.match(new RegExp(`^${key}=(.*)$`, 'm'));
    assert.ok(match, `${key} missing`);
    assert.match(
      match![1]!.trim(),
      /^CHANGEME/,
      `${key} in .env.example is not a CHANGEME placeholder — a real secret may have been pasted`,
    );
  }
});
