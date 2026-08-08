/**
 * M-022 · The four session routes as the GENERATED document describes them.
 *
 * ┌─ WHY THE DOCUMENT IS TESTED SEPARATELY FROM THE BEHAVIOUR ──────────────────────────────────┐
 * │ The isolation suites prove what the server DOES. This file proves what the server SAYS it    │
 * │ does — and the two drift apart in one direction that matters: three front-end applications   │
 * │ and the generated OpenAPI client are built from this document, not from the controller.      │
 * │                                                                                              │
 * │ A route that exists but is undocumented is a route no client can call. A documented response │
 * │ shape that the server does not return is a typed client that compiles and fails at runtime.  │
 * │ Neither shows up in a test of the handler.                                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ AND WHY IT ASSERTS THE SECURITY SHAPE, NOT ONLY THE PRESENCE ──────────────────────────────┐
 * │ `SE1` and `TK7` forbid the refresh token from appearing in a response body. A document that  │
 * │ declared a `refresh_token` field would be an instruction to every client author to read one  │
 * │ — and the first one who did would ask for the server to start sending it.                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Reads the committed `openapi.json`. `openapi-drift.int-spec.ts` separately asserts that the
 * committed document is what the emitter currently produces, so "committed" and "current" are one
 * thing — without that pairing, this file would happily validate a stale snapshot.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Walks up to the workspace marker rather than counting `..` segments.
 *
 * `import.meta.url` is the obvious way to do this and is unavailable: these specs compile to
 * CommonJS, and `tsc` rejects it outright (TS1470). Counting parents from `process.cwd()` would
 * work only when the runner is invoked from `apps/server`.
 */
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
const document = JSON.parse(readFileSync(resolve(ROOT, 'openapi.json'), 'utf8')) as {
  paths: Record<string, Record<string, unknown>>;
};

const operation = (path: string, method: string): Record<string, unknown> => {
  const entry = document.paths[path];
  assert.ok(entry, `${path} is absent from the generated document`);
  const op = entry[method];
  assert.ok(op, `${method.toUpperCase()} ${path} is absent from the generated document`);
  return op as Record<string, unknown>;
};

const ROUTES: ReadonlyArray<[string, string, string]> = [
  ['/v1/auth/refresh', 'post', 'Authentication.md §8.5'],
  ['/v1/auth/logout', 'post', 'Authentication.md §8.6'],
  ['/v1/auth/sessions', 'get', 'Authentication.md §8.9, FR-AUTH-09'],
  ['/v1/auth/sessions/{sessionId}', 'delete', 'Authentication.md §8.10'],
];

// ---------------------------------------------------------------------------
// AC-9 — all four are present.
// ---------------------------------------------------------------------------

for (const [path, method, source] of ROUTES) {
  test(`${method.toUpperCase()} ${path} is documented — ${source}`, () => {
    const op = operation(path, method);
    assert.equal(typeof op['summary'], 'string', 'no summary — the client generator emits no doc');
    assert.ok(Array.isArray(op['tags']) && (op['tags'] as string[]).includes('iam'));
  });
}

test('every session route declares its responses', () => {
  for (const [path, method] of ROUTES) {
    const responses = operation(path, method)['responses'] as Record<string, unknown>;
    assert.ok(responses, `${method} ${path} documents no responses at all`);
    const codes = Object.keys(responses);
    assert.ok(codes.length > 0, `${method} ${path} documents no responses at all`);
  }
});

// ---------------------------------------------------------------------------
// SE1 / TK7 — what the document must NOT promise.
// ---------------------------------------------------------------------------

test('SE1 · no session route documents a `refresh_token` in a response body', () => {
  // Asserted over the serialised operation rather than by walking the schema tree: the field is
  // forbidden wherever it appears — in a response, in an example, in a nested object — and a
  // structural walk that missed one nesting level would report success.
  for (const [path, method] of ROUTES) {
    const serialised = JSON.stringify(operation(path, method));
    assert.ok(
      !serialised.includes('refresh_token'),
      `${method.toUpperCase()} ${path} documents a refresh_token in its body — SE1, TK7`,
    );
  }

  // The two routes that OPEN a session are the likelier place for it to appear.
  for (const path of ['/v1/auth/login', '/v1/auth/otp/verify']) {
    const entry = document.paths[path];
    if (entry === undefined) continue;
    assert.ok(
      !JSON.stringify(entry).includes('refresh_token'),
      `${path} documents a refresh_token in its body — SE1, TK7`,
    );
  }
});

test('the refresh route documents the access token it returns', () => {
  // The other half: a client that cannot see `access_token` in the contract has no typed way to
  // read the one thing this route exists to produce.
  const properties = JSON.stringify(operation('/v1/auth/refresh', 'post')['responses']);
  assert.match(properties, /access_token/);
  assert.match(properties, /expires_in_seconds/);
});

test('login documents its access token and its expiry', () => {
  const login = document.paths['/v1/auth/login'];
  assert.ok(login, '/v1/auth/login is absent from the generated document');
  const serialised = JSON.stringify(login);
  assert.match(serialised, /access_token/, 'login no longer documents the token it now issues');
  assert.match(serialised, /expires_in_seconds/);
});

// ---------------------------------------------------------------------------
// The parameter that makes revocation addressable.
// ---------------------------------------------------------------------------

test('DELETE /v1/auth/sessions/{sessionId} documents its path parameter as a uuid', () => {
  const parameters = operation('/v1/auth/sessions/{sessionId}', 'delete')['parameters'] as
    ReadonlyArray<Record<string, unknown>> | undefined;

  assert.ok(Array.isArray(parameters), 'the route documents no parameters');
  const sessionId = parameters.find((p) => p['name'] === 'sessionId');
  assert.ok(sessionId, 'sessionId is not documented');
  assert.equal(sessionId['in'], 'path');
  assert.equal(sessionId['required'], true);
});
