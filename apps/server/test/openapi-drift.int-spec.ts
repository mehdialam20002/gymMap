/**
 * M-020 · The emitted contract is regenerable, and the committed one is current.
 *
 * ┌─ AN EIGHT-MILESTONE BLIND SPOT, AND WHY NOTHING SAW IT ─────────────────────────────────────┐
 * │ `openapi:emit` boots the real `AppModule` against placeholder credentials. M-010 added      │
 * │ `TenancyModule`, whose three Prisma services `$connect()` in `onModuleInit`, and from that  │
 * │ moment the emitter died on "Authentication failed against database server".                  │
 * │                                                                                              │
 * │ `openapi.json` was therefore last written at M-012. `ci:api-gates` READS that document —     │
 * │ so PG-1, PG-2, PG-3 and PG-5 were being applied to a frozen snapshot, and reported four      │
 * │ operations passing while the application had moved on. Every gate stayed green.              │
 * │                                                                                              │
 * │ No route was actually let through, because M-012's ping routes happened to be the last ones │
 * │ added before M-020. That is luck, not a control.                                             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THIS SUITE ASSERTS BOTH HALVES, AND THE SECOND IS THE ONE THAT ROTS ───────────────────────┐
 * │ 1. The emitter RUNS. Exit 0, in bounded time — a generator that hangs after writing the     │
 * │    right file is a hung CI job, which reads as a broken build rather than a broken exit.    │
 * │ 2. The committed document MATCHES what the emitter produces. Otherwise the gate is reading  │
 * │    yesterday's contract, which is exactly what happened.                                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function repoRoot(): string {
  let dir = process.cwd();
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`could not locate the repository root from ${process.cwd()}`);
}

const ROOT = repoRoot();
const DOCUMENT = resolve(ROOT, 'openapi.json');

interface OpenApiDocument {
  readonly paths: Record<string, Record<string, unknown>>;
}

const read = (): OpenApiDocument => JSON.parse(readFileSync(DOCUMENT, 'utf8')) as OpenApiDocument;

const operationsOf = (document: OpenApiDocument): string[] =>
  Object.entries(document.paths)
    .flatMap(([path, methods]) => Object.keys(methods).map((m) => `${m.toUpperCase()} ${path}`))
    .sort();

test('the committed document exists and describes operations', () => {
  assert.ok(existsSync(DOCUMENT), 'openapi.json is missing');
  const operations = operationsOf(read());
  assert.ok(
    operations.length > 0,
    'openapi.json describes zero operations. `api-gates` would report "nothing to check yet" ' +
      'and pass, which is indistinguishable from every gate holding.',
  );
});

test('THE EMITTER RUNS, and finishes — this is what broke from M-010 to M-020', () => {
  // A generous but BOUNDED timeout. The failure being pinned is twofold: the process used to
  // die on a database connect, and once that was fixed it wrote the correct file and then hung
  // forever on an open Redis handle. Both are caught by requiring a clean exit in finite time.
  // `node dist/...` directly rather than through `pnpm run`. Two reasons: the pnpm wrapper is a
  // `.cmd` on Windows whose output does not reach the parent's stdout, and the script's `tsc`
  // step is redundant here — the suite runs against `dist/`, so it was just built.
  //
  // `spawnSync` rather than `execFileSync` because BOTH streams matter: the progress lines go to
  // stderr, and a non-zero exit must be reported with its stderr attached rather than as a bare
  // "command failed" that sends the reader to run it by hand.
  const result = spawnSync(process.execPath, ['dist/common/openapi/emit.js'], {
    cwd: resolve(ROOT, 'apps/server'),
    encoding: 'utf8',
    timeout: 240_000,
  });

  assert.equal(
    result.status,
    0,
    `the emitter exited ${String(result.status)} (signal ${String(result.signal)}).\n` +
      `A null status with a SIGTERM signal means it HUNG — it wrote the document and then held ` +
      `the event loop open, which is what an unclosed Redis handle does.\n\n${result.stderr}`,
  );

  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(
    output,
    /openapi\.json written — \d+ operation\(s\)/,
    `the emitter did not report writing the document:\n${output}`,
  );
});

test('the COMMITTED document matches what the emitter produces', () => {
  // The staleness half. Run after the emit above, so the file on disk is freshly generated —
  // `git diff` then answers whether the committed one was already current.
  //
  // Byte-for-byte via git rather than a structural compare: the emitter sorts deep keys and
  // writes `JSON.stringify(doc, null, 2)` plus a newline precisely so two runs are identical,
  // and a structural compare would let formatting drift accumulate under it.
  const diff = execFileSync('git', ['diff', '--stat', '--', 'openapi.json'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();

  assert.equal(
    diff,
    '',
    'the committed openapi.json differs from what the emitter produces:\n' +
      `${diff}\n\n` +
      'Run `pnpm --filter @gymmap/server openapi:emit` and commit the result. A stale document ' +
      'means `ci:api-gates` is applying PG-1..PG-5 to a snapshot of an older API — which is ' +
      'how four operations passed every gate while the application served eight.',
  );
});

test('every allowlisted public route appears in the document', () => {
  // The two lists are maintained in different files for different reasons — the allowlist is
  // reviewed by a human, the document is generated — and a route in one and not the other means
  // one of them is describing an API that does not exist.
  const operations = new Set(operationsOf(read()));
  const allowlist = readFileSync(
    resolve(ROOT, 'apps/server/src/common/openapi/public-allowlist.ts'),
    'utf8',
  );

  const routes = [...allowlist.matchAll(/route:\s*'([A-Z]+ [^']+)'/g)].map((m) => m[1]!);
  assert.ok(routes.length >= 6, `parsed only ${String(routes.length)} allowlist rows`);

  for (const route of routes) {
    assert.ok(
      operations.has(route),
      `"${route}" is on the @Public() allowlist and is not in openapi.json. Either the route ` +
        'was removed and the row is stale, or the document is.',
    );
  }
});
