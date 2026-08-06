/**
 * M-004 AC-6 · BR-DAT-06-P1 (unit half) — a synthetic PII corpus through the serialiser yields
 * zero personal data.
 *
 * The corpus is the test. Asserting that the deny-list *contains* fifteen strings proves the
 * array literal is intact and nothing else; running realistic payloads through the actual
 * redactor is what proves a member's phone number cannot reach the log aggregator.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  REDACTED_FIELD_NAMES,
  REDACTION_PLACEHOLDER,
  buildRedactionPaths,
  isRedactedFieldName,
  redactDeep,
} from '../dist/common/logging/redaction.js';

/** AC-FND-10.1's mandated minimum. */
const MANDATED = [
  'token',
  'authorization',
  'cookie',
  'password',
  'otp',
  'email',
  'phone',
  'name',
  'dob',
  'address',
  'card',
  'cvv',
  'aadhaar',
  'pan',
  'health_notes',
];

test('AC-FND-10.1 — every mandated field is on the deny-list', () => {
  for (const field of MANDATED) {
    assert.ok(
      (REDACTED_FIELD_NAMES as readonly string[]).includes(field),
      `"${field}" is mandated by AC-FND-10.1 and is missing`,
    );
  }
});

/**
 * The corpus. Values are distinctive strings so a leak is unambiguous — if any of these appears
 * in the serialised output, a real member's data would have appeared in its place.
 */
const PII_CORPUS = {
  req: {
    headers: {
      authorization: 'Bearer eyJhbGciOiJFZERTQSJ9.LEAKED_ACCESS_TOKEN',
      cookie: 'refresh=LEAKED_REFRESH_COOKIE; Path=/',
      'user-agent': 'Mozilla/5.0',
    },
    body: {
      name: 'LEAKED_MEMBER_NAME',
      email: 'LEAKED_EMAIL@example.com',
      phone: '+91LEAKED_PHONE',
      password: 'LEAKED_PASSWORD',
      otp: 'LEAKED_OTP',
      dob: '1990-01-01',
      pan: 'LEAKEDPAN9A',
      aadhaar: '1234LEAKED5678',
      address: 'LEAKED_ADDRESS, Bengaluru',
      health_notes: 'LEAKED_HEALTH_CONDITION',
      planId: '018f3a2b-7c41-7d3e-8b91-2f5a6c7d8e90',
    },
    query: {
      // OI-S1: the PRD list has no location field. These must still be redacted.
      lat: '12.934512',
      lng: '77.610134',
      q: 'gyms near me',
    },
  },
  payment: {
    card: '4111111111111111',
    cvv: 'LEAKED_CVV',
    upi: 'LEAKED@upi',
    accountNumber: 'LEAKED_ACCOUNT',
    ifsc: 'HDFC0001234',
    amountMinor: '250000',
  },
  nested: { deeply: { buried: { email: 'LEAKED_NESTED_EMAIL@example.com' } } },
};

/** Every distinctive value that must NOT survive redaction. */
const LEAK_MARKERS = [
  'LEAKED_ACCESS_TOKEN',
  'LEAKED_REFRESH_COOKIE',
  'LEAKED_MEMBER_NAME',
  'LEAKED_EMAIL',
  'LEAKED_PHONE',
  'LEAKED_PASSWORD',
  'LEAKED_OTP',
  'LEAKEDPAN9A',
  'LEAKED5678',
  'LEAKED_ADDRESS',
  'LEAKED_HEALTH_CONDITION',
  'LEAKED_CVV',
  'LEAKED@upi',
  'LEAKED_ACCOUNT',
  'LEAKED_NESTED_EMAIL',
  '4111111111111111',
  '1990-01-01',
  '12.934512',
  '77.610134',
];

test('BR-DAT-06 — the corpus survives redaction with zero personal data', () => {
  const serialised = JSON.stringify(redactDeep(PII_CORPUS));
  for (const marker of LEAK_MARKERS) {
    assert.ok(
      !serialised.includes(marker),
      `"${marker}" survived redaction. A real member's data would be in the log aggregator.`,
    );
  }
});

test('OI-S1 — location is redacted ahead of the PRD amendment', () => {
  // ~0.1 m resolution identifies not just a building but a floor, defeating the §C6
  // precision-reduction rule: the reduced value is published while the exact one sits in logs.
  const out = JSON.stringify(
    redactDeep({ lat: 12.934512, lng: 77.610134, latitude: 12.9, longitude: 77.6 }),
  );
  assert.ok(!out.includes('12.934512'), 'lat leaked');
  assert.ok(!out.includes('77.610134'), 'lng leaked');
  assert.ok(!out.includes('12.9'), 'latitude leaked');
});

test('non-personal fields survive — redaction must not destroy the log', () => {
  const out = redactDeep(PII_CORPUS) as typeof PII_CORPUS;
  assert.equal(out.req.headers['user-agent'], 'Mozilla/5.0');
  assert.equal(out.req.body.planId, '018f3a2b-7c41-7d3e-8b91-2f5a6c7d8e90');
  assert.equal(out.payment.amountMinor, '250000');
  assert.equal(out.req.query.q, 'gyms near me');
});

test('redaction is case-insensitive — Authorization and AUTHORIZATION too', () => {
  const out = JSON.stringify(
    redactDeep({ Authorization: 'Bearer X', EMAIL: 'a@b.c', Phone: '+91' }),
  );
  assert.ok(!out.includes('Bearer X'));
  assert.ok(!out.includes('a@b.c'));
  assert.ok(!out.includes('+91'));
  assert.ok(isRedactedFieldName('AUTHORIZATION'));
  assert.ok(isRedactedFieldName('Email'));
});

test('arrays of records are redacted element-wise', () => {
  const out = JSON.stringify(
    redactDeep({ members: [{ email: 'a@LEAK.com' }, { phone: 'LEAK2' }] }),
  );
  assert.ok(!out.includes('a@LEAK.com'));
  assert.ok(!out.includes('LEAK2'));
});

test('the placeholder replaces the value, so the FIELD stays visible', () => {
  // The key must survive: knowing an email was present is useful; knowing which is not.
  const out = redactDeep({ email: 'x@y.z' }) as Record<string, unknown>;
  assert.equal(out['email'], REDACTION_PLACEHOLDER);
  assert.ok('email' in out);
});

test('a cyclic-depth payload terminates rather than blowing the stack', () => {
  // A logger that throws while building a log line turns an ordinary error into an unhandled
  // rejection — strictly worse than the error it was reporting.
  let deep: Record<string, unknown> = { email: 'deep@leak.com' };
  for (let i = 0; i < 40; i++) deep = { nested: deep };
  const out = JSON.stringify(redactDeep(deep));
  assert.ok(out.includes('[TRUNCATED]'), 'depth guard did not engage');
  assert.ok(!out.includes('deep@leak.com'));
});

test('primitives and null pass through untouched', () => {
  assert.equal(redactDeep(null), null);
  assert.equal(redactDeep(undefined), undefined);
  assert.equal(redactDeep(42), 42);
  assert.equal(redactDeep('plain'), 'plain');
});

test('the Pino path list covers headers and request-body roots', () => {
  const paths = buildRedactionPaths();
  for (const expected of [
    'req.headers.authorization',
    'req.body.email',
    'req.body.password',
    'req.query.lat',
    'req.headers["authorization"]',
    'res.headers["set-cookie"]',
  ]) {
    assert.ok(paths.includes(expected), `Pino redaction path "${expected}" is missing`);
  }
});
