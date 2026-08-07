/**
 * The request fingerprint — `BR-PAY-03`, acceptance criterion 5.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * BOTH DIRECTIONS ARE TESTED, BECAUSE BOTH MISTAKES ARE EXPENSIVE
 *
 *   TOO NARROW   every retry hashes differently, so every retry is a 409 and a flaky mobile
 *                connection can no longer complete a purchase at all
 *   TOO BROAD    two genuinely different purchases hash the same, the second is silently
 *                REPLAYED, and the member sees a confirmation for a thing they did not buy
 *
 * A spec that only asserted "the same input gives the same hash" would pass on a function that
 * returned a constant — which is the too-broad failure in its purest form. So every "these are
 * the same" assertion below is paired with a "these are different" one.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  EXCLUDED_HEADERS,
  canonicalise,
  fingerprint,
  headerParticipates,
} from '../dist/common/idempotency/request-fingerprint.js';
import { readKey } from '../dist/common/idempotency/idempotency.interceptor.js';

const TENANT_A = '01912f00-0000-7000-8000-00000000000a';
const TENANT_B = '01912f00-0000-7000-8000-00000000000b';

const base = {
  method: 'POST',
  path: '/v1/tenant/orders',
  tenantId: TENANT_A,
  body: { planId: 'p1', quantity: 1 },
};

// ═══════════════════════════════════════════════════════════════════════════
// The control. Without it, a constant-returning function passes everything below.
// ═══════════════════════════════════════════════════════════════════════════

test('CONTROL — the fingerprint is not a constant', () => {
  const a = fingerprint(base);
  const b = fingerprint({ ...base, body: { planId: 'p2', quantity: 1 } });
  assert.notEqual(a, b, 'two different requests hash the same — every replay would be silent');
  assert.match(a, /^[0-9a-f]{64}$/);
});

// ═══════════════════════════════════════════════════════════════════════════
// TOO NARROW — a legitimate retry must still be a retry.
// ═══════════════════════════════════════════════════════════════════════════

test('key ORDER does not change the hash', () => {
  // Two clients, or the same client after a serialiser upgrade, emit the same object with
  // different key order. Hashing the raw bytes would call those different requests, and the
  // retry would be a 409.
  assert.equal(
    fingerprint({ ...base, body: { planId: 'p1', quantity: 1 } }),
    fingerprint({ ...base, body: { quantity: 1, planId: 'p1' } }),
  );
});

test('WHITESPACE and formatting do not change the hash', () => {
  // The body arrives parsed, so re-serialising from the parsed form normalises it. Asserted
  // rather than assumed, because a future change that hashed the raw request stream would break
  // every retry from a client that pretty-prints.
  const compact = JSON.parse('{"planId":"p1","quantity":1}');
  const spaced = JSON.parse('{\n  "planId" : "p1",\n  "quantity" : 1\n}');
  assert.equal(fingerprint({ ...base, body: compact }), fingerprint({ ...base, body: spaced }));
});

test('an undefined member hashes the same as an absent one', () => {
  // `{a: 1, b: undefined}` and `{a: 1}` serialise identically over the wire, so they must
  // fingerprint identically here — otherwise a client that started omitting an optional field
  // breaks every in-flight retry.
  assert.equal(
    fingerprint({ ...base, body: { planId: 'p1', quantity: 1, coupon: undefined } }),
    fingerprint({ ...base, body: { planId: 'p1', quantity: 1 } }),
  );
});

test('an explicit null is NOT the same as absent', () => {
  // The other side of the same coin: `{coupon: null}` means "remove the coupon" and `{}` means
  // "leave it alone". Collapsing them would make a clearing request replay a non-clearing one.
  assert.notEqual(
    fingerprint({ ...base, body: { planId: 'p1', coupon: null } }),
    fingerprint({ ...base, body: { planId: 'p1' } }),
  );
});

test('nesting is canonicalised at every depth', () => {
  assert.equal(
    fingerprint({ ...base, body: { a: { z: 1, y: { q: 2, p: 3 } } } }),
    fingerprint({ ...base, body: { a: { y: { p: 3, q: 2 }, z: 1 } } }),
  );
});

test('the method is case-insensitive, because HTTP is', () => {
  assert.equal(fingerprint(base), fingerprint({ ...base, method: 'post' }));
});

test('no header participates — the volatile ones would break every retry', () => {
  // `User-Agent` changes when the mobile app updates between the first attempt and the retry.
  // `traceparent` is a new trace per attempt BY DEFINITION. Either in the hash makes every
  // retry a 409, and turns a safety mechanism into an outage.
  for (const header of EXCLUDED_HEADERS) {
    assert.equal(headerParticipates(header), false, `${header} is in the fingerprint`);
  }
  assert.ok(EXCLUDED_HEADERS.includes('user-agent'));
  assert.ok(EXCLUDED_HEADERS.includes('traceparent'));
  assert.ok(EXCLUDED_HEADERS.includes('authorization'), 'a refreshed token would break a retry');
});

// ═══════════════════════════════════════════════════════════════════════════
// TOO BROAD — two different requests must never collide.
// ═══════════════════════════════════════════════════════════════════════════

test('a changed body VALUE changes the hash', () => {
  assert.notEqual(fingerprint(base), fingerprint({ ...base, body: { planId: 'p1', quantity: 2 } }));
});

test('a different TENANT changes the hash', () => {
  // The tenant is in the fingerprint explicitly. Without it, tenant B replaying tenant A's key
  // would match on body alone — and although RLS stops the READ, the fingerprint must not be
  // the thing that depends on that.
  assert.notEqual(fingerprint(base), fingerprint({ ...base, tenantId: TENANT_B }));
});

test('a different PATH or METHOD changes the hash', () => {
  assert.notEqual(fingerprint(base), fingerprint({ ...base, path: '/v1/tenant/refunds' }));
  assert.notEqual(fingerprint(base), fingerprint({ ...base, method: 'PATCH' }));
});

test('ARRAY ORDER is preserved, because line items are ordered', () => {
  // Sorting arrays would make `[a, b]` and `[b, a]` the same request. For an order's line items
  // — or an allocation's weights — they are not.
  assert.notEqual(
    fingerprint({ ...base, body: { items: ['a', 'b'] } }),
    fingerprint({ ...base, body: { items: ['b', 'a'] } }),
  );
});

test('the separator prevents a concatenation collision', () => {
  // `POST /a` + body `b` must not collide with `POST /ab` + body ``. Naive concatenation makes
  // them identical, and a hash confusion in the money path is a replay of the wrong response.
  assert.notEqual(
    fingerprint({ method: 'POST', path: '/a', tenantId: TENANT_A, body: 'b' }),
    fingerprint({ method: 'POST', path: '/ab', tenantId: TENANT_A, body: '' }),
  );
});

test('canonicalise leaves primitives and arrays intact', () => {
  assert.equal(canonicalise(1), 1);
  assert.equal(canonicalise('x'), 'x');
  assert.equal(canonicalise(null), null);
  assert.deepEqual(canonicalise([3, 1, 2]), [3, 1, 2]);
  assert.deepEqual(canonicalise({ b: 1, a: 2 }), { a: 2, b: 1 });
});

test('a body-less mutation fingerprints stably', () => {
  // A body-less POST is a valid REQ shape — `POST /v1/tenant/gyms/{id}/publish`. It must hash
  // consistently rather than producing a fresh value each time.
  const a = fingerprint({ ...base, body: undefined });
  assert.equal(a, fingerprint({ ...base, body: undefined }));
  assert.notEqual(a, fingerprint({ ...base, body: {} }));
});

// ═══════════════════════════════════════════════════════════════════════════
// The header itself.
// ═══════════════════════════════════════════════════════════════════════════

test('the key is read case-insensitively and validated', () => {
  const uuid = '018f2a4c-1234-7890-abcd-ef0123456789';
  assert.equal(readKey({ headers: { 'idempotency-key': uuid } }), uuid);
  assert.equal(readKey({ headers: { 'idempotency-key': `  ${uuid}  ` } }), uuid);
  assert.equal(readKey({ headers: {} }), null);
});

test('an unbounded or hostile key is refused rather than stored', () => {
  // The value is stored, indexed and echoed in an error, so an unbounded client-controlled
  // string is a storage concern and a log-injection vector at once.
  assert.equal(readKey({ headers: { 'idempotency-key': 'x'.repeat(201) } }), null);
  assert.equal(readKey({ headers: { 'idempotency-key': 'short' } }), null);
  assert.equal(readKey({ headers: { 'idempotency-key': 'has space' } }), null);
  assert.equal(readKey({ headers: { 'idempotency-key': 'line\nbreak-injection' } }), null);
  assert.equal(readKey({ headers: { 'idempotency-key': 123 } }), null);
  // The permitted shapes: a UUID, and the dotted/colon conventions other clients use.
  assert.ok(readKey({ headers: { 'idempotency-key': 'order:2026-08-07:0001' } }));
  assert.ok(readKey({ headers: { 'idempotency-key': 'checkout_attempt.42' } }));
});
