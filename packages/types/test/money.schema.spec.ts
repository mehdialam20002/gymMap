/**
 * M-003 · TR-38 / AC-FND-06.6 — money crosses JSON as a string, and a JSON number is refused.
 *
 * The headline assertion is the second one. It is easy to write a schema that "works" in every
 * test because every test amount is small, and then loses a paise in production on the one
 * amount large enough to matter.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  moneySchema,
  minorUnitsSchema,
  nonNegativeMoneySchema,
  toMoneyWire,
} from '../dist/index.js';
import { problemDetailsSchema } from '../dist/index.js';

test('amountMinor parses from a string into a bigint', () => {
  const parsed = moneySchema.parse({ amountMinor: '250000', currency: 'INR' });
  assert.equal(parsed.amountMinor, 250000n);
  assert.equal(typeof parsed.amountMinor, 'bigint');
  assert.equal(parsed.currency, 'INR');
});

test('TR-38 — a JS number is REJECTED, not coerced', () => {
  const result = moneySchema.safeParse({ amountMinor: 250000, currency: 'INR' });
  assert.equal(result.success, false, 'a JSON number must not be accepted for money');
  assert.match(
    result.error!.issues[0]!.message,
    /TR-38|BR-PAY-01/,
    'the rejection must tell the integrator which rule refuses it',
  );
});

test('the precision loss this schema exists to prevent is real', () => {
  // Proof, not assertion-by-comment: the parser truncates before any validator sees the value.
  const truncated = JSON.parse('{"amountMinor":9007199254740993}') as { amountMinor: number };
  assert.equal(
    truncated.amountMinor,
    9007199254740992,
    'JSON.parse loses the odd paise above 2^53',
  );

  // The same value as a string survives intact.
  const exact = JSON.parse('{"amountMinor":"9007199254740993","currency":"INR"}') as unknown;
  assert.equal(moneySchema.parse(exact).amountMinor, 9007199254740993n);
});

test('a large but realistic amount round-trips exactly', () => {
  // ₹1,00,00,00,000.00 — a large chain's annual GMV, in paise.
  const wire = { amountMinor: '100000000000', currency: 'INR' };
  const parsed = moneySchema.parse(wire);
  assert.deepEqual(toMoneyWire(parsed.amountMinor, parsed.currency), wire);
});

test('major units leaking in are rejected with an actionable message', () => {
  const result = minorUnitsSchema.safeParse('500.00');
  assert.equal(result.success, false);
  assert.match(result.error!.issues[0]!.message, /50000/, 'must show the correct form');
});

test('non-integer, padded and exotic numeric strings are refused', () => {
  for (const bad of ['1e5', '0x10', ' 100', '100 ', '+100', '01', '1_000', '', 'NaN', 'Infinity']) {
    assert.equal(
      minorUnitsSchema.safeParse(bad).success,
      false,
      `'${bad}' must not parse as minor units`,
    );
  }
});

test('a negative amount is valid in general but not where a price is expected', () => {
  // Ledger entries carry direction in the sign (BR-FIN-01), so the base schema allows it.
  assert.equal(minorUnitsSchema.parse('-1'), -1n);
  assert.equal(
    nonNegativeMoneySchema.safeParse({ amountMinor: '-1', currency: 'INR' }).success,
    false,
  );
});

test('an unsupported currency is rejected, and an amount without one is not money', () => {
  assert.equal(moneySchema.safeParse({ amountMinor: '1', currency: 'XYZ' }).success, false);
  assert.equal(moneySchema.safeParse({ amountMinor: '1' }).success, false);
  assert.equal(moneySchema.safeParse({ currency: 'INR' }).success, false);
});

test('the schema is strict — an extra field is a rejected payload, not a silent drop', () => {
  const result = moneySchema.safeParse({ amountMinor: '1', currency: 'INR', amount: 0.01 });
  assert.equal(result.success, false, 'a float `amount` alongside the real one must not pass');
});

// ---------------------------------------------------------------------------
// AC-FND-09.1 — the error envelope is exactly the §C3.1 shape.
// ---------------------------------------------------------------------------

test('the envelope accepts exactly { error: { code, message, details[], correlation_id } }', () => {
  const parsed = problemDetailsSchema.parse({
    error: {
      code: 'VALIDATION_FAILED',
      message: 'The request could not be validated.',
      details: [{ field: 'currency', rule: 'supported_currency' }],
      correlation_id: '01J9Z7ABCDEF0123456789ABCD',
    },
  });
  assert.equal(parsed.error.code, 'VALIDATION_FAILED');
  assert.equal(parsed.error.details.length, 1);
});

test('details defaults to an empty array, so a client never guards against undefined', () => {
  const parsed = problemDetailsSchema.parse({
    error: { code: 'RESOURCE_NOT_FOUND', message: 'Not found.', correlation_id: '01J9Z7' },
  });
  assert.deepEqual(parsed.error.details, []);
});

test('an unregistered code cannot be put on the wire', () => {
  const result = problemDetailsSchema.safeParse({
    error: { code: 'MADE_UP_CODE', message: 'x', correlation_id: '01J9Z7' },
  });
  assert.equal(result.success, false, 'a code with no registry row must not serialise');
});

test('NFR-SEC-04 — an extra field on an error response is refused', () => {
  // This is how a stack trace or an ORM message leaks through a hastily written exception filter.
  const result = problemDetailsSchema.safeParse({
    error: {
      code: 'VALIDATION_FAILED',
      message: 'x',
      correlation_id: '01J9Z7',
      stack: 'Error: at PrismaClient._execute (/app/node_modules/...)',
    },
  });
  assert.equal(result.success, false, 'the envelope must not carry a stack trace');
});
