/**
 * M-003 · The registry's own invariants — constitution §13.2.1, AC-FND-09.2.
 *
 * §13.2.1 says a CI check must fail the build when two rows share a code or a thrown error maps
 * to a code with no row. Deriving the union from the table already makes the second impossible.
 * These assertions cover the rest — format, uniqueness, and the properties a client's retry
 * logic depends on being right.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ERROR_CODES,
  errorRegistryRow,
  httpStatusFor,
  isErrorCode,
  isRetryable,
  type ErrorCode,
} from '../dist/index.js';
import { ERROR_REGISTRY } from '../dist/index.js';

const SCREAMING_SNAKE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;

test('every code is flat SCREAMING_SNAKE_CASE (§13.2.1 format rule)', () => {
  for (const code of ERROR_CODES) {
    assert.match(code, SCREAMING_SNAKE, `'${code}' is not SCREAMING_SNAKE_CASE`);
    assert.ok(
      !code.includes('.'),
      `'${code}' is namespaced. §13.2.1 rejected the namespaced form because C3.3's signed ` +
        'contract shows a flat code.',
    );
  }
});

test('codes are unique and the exported array is sorted', () => {
  assert.equal(new Set(ERROR_CODES).size, ERROR_CODES.length, 'duplicate error code');
  assert.deepEqual([...ERROR_CODES], [...ERROR_CODES].sort(), 'ERROR_CODES must be sorted');
});

test('every row is complete — no code ships without the columns §13.2.1 mandates', () => {
  for (const code of ERROR_CODES) {
    const row = errorRegistryRow(code);
    assert.ok(row.module, `${code}: no owning module`);
    assert.ok(row.class, `${code}: no error class`);
    assert.ok(
      Number.isInteger(row.httpStatus) && row.httpStatus >= 400 && row.httpStatus <= 599,
      `${code}: httpStatus ${row.httpStatus} is not a 4xx/5xx`,
    );
    assert.match(
      row.messageKey,
      /^error\.[a-z_]+\.[a-z0-9_]+$/,
      `${code}: messageKey '${row.messageKey}' must be error.<module>.<code_lowercase> for NFR-USE-08`,
    );
    assert.ok(
      row.enforces.length > 0,
      `${code}: cites no requirement. A code that enforces nothing is a code nobody can justify ` +
        'keeping, and it will be reused for something else within a year.',
    );
    assert.equal(typeof row.retryable, 'boolean', `${code}: retryable must be explicit`);
  }
});

test('the messageKey module segment matches the owning module', () => {
  for (const code of ERROR_CODES) {
    const row = errorRegistryRow(code);
    assert.equal(
      row.messageKey.split('.')[1],
      row.module,
      `${code}: messageKey names a different module than the row does — the i18n bundle would ` +
        'be looked up in the wrong namespace',
    );
  }
});

test("a 5xx is never advertised as the caller's fault, and 4xx is never blindly retryable", () => {
  for (const code of ERROR_CODES) {
    const row = errorRegistryRow(code);
    if (row.httpStatus >= 500) {
      assert.notEqual(
        row.class,
        'Validation',
        `${code}: a 5xx classed as Validation tells the client to fix its request when the ` +
          'fault is ours',
      );
    }
    // 429 is the one 4xx that is legitimately retryable — after the window.
    if (row.httpStatus >= 400 && row.httpStatus < 500 && row.retryable) {
      assert.equal(
        row.httpStatus,
        429,
        `${code}: a retryable 4xx other than 429. Retrying an unchanged request that the server ` +
          'already rejected is how a client hammers an endpoint into a rate limit.',
      );
    }
  }
});

test('BR-PAY-03 — an idempotency conflict is never retryable', () => {
  // Retrying with the same key reproduces the conflict; retrying with a fresh key on a payment
  // path is how a network blip becomes a double charge.
  assert.equal(isRetryable('IDEMPOTENCY_KEY_MISMATCH'), false);
  assert.equal(httpStatusFor('IDEMPOTENCY_KEY_MISMATCH'), 409);
});

test('Security.md P3 — a missing tenant context is a 500, never a 403 and never an empty page', () => {
  const row = errorRegistryRow('TENANT_CONTEXT_MISSING');
  assert.equal(row.httpStatus, 500);
  assert.equal(row.class, 'System');
  assert.ok(row.enforces.includes('BR-TEN-01'));
});

test('BR-TEN-01 — a client-supplied tenant header is rejected, not ignored', () => {
  assert.ok(isErrorCode('TENANT_HEADER_NOT_ACCEPTED'));
  assert.equal(httpStatusFor('TENANT_HEADER_NOT_ACCEPTED'), 400);
});

test('isErrorCode rejects a plausible but unregistered code', () => {
  assert.equal(isErrorCode('TENANT_NOT_FOUND'), false);
  assert.equal(isErrorCode('toString'), false, 'must not be fooled by Object.prototype keys');
  assert.equal(isErrorCode(42), false);
});

test('the union is derived from the table, so the two cannot disagree (AC-4)', () => {
  const fromTable = Object.keys(ERROR_REGISTRY).sort();
  assert.deepEqual([...ERROR_CODES], fromTable);
  // Compile-time half: this only typechecks while ErrorCode === keyof typeof ERROR_REGISTRY.
  const sample: ErrorCode = 'VALIDATION_FAILED';
  assert.ok(sample in ERROR_REGISTRY);
});
