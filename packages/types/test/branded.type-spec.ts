/**
 * M-003 · AC-2 — a branded id is not assignable from a plain `string`, and not assignable
 * across brands.
 *
 * These assertions are made with `@ts-expect-error`, which is the whole mechanism: the compiler
 * FAILS THE BUILD if the line below it does NOT error. So this file passing `tsc` proves the
 * unsafe assignments are genuinely rejected — it is a negative type test with no dependency on
 * `tsd` or `expect-type`, and it runs inside the existing `typecheck` task rather than beside it.
 *
 * There are also runtime assertions here for the validating constructors (§9.5 B2), so the file
 * is executed as well as compiled.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ID_CONSTRUCTORS,
  InvalidIdentifierError,
  gymId,
  isUuid,
  membershipId,
  orderId,
  planId,
  tenantId,
  userId,
  branchId,
  memberId,
  paymentId,
  type BranchId,
  type GymId,
  type MemberId,
  type MembershipId,
  type OrderId,
  type PaymentId,
  type PlanId,
  type TenantId,
  type UserId,
} from '../dist/index.js';

const UUID_A = '018f3a2b-7c41-7d3e-8b91-2f5a6c7d8e90';
const UUID_B = '019a1b2c-3d4e-7f60-9a8b-1c2d3e4f5061';

// ---------------------------------------------------------------------------
// AC-2, half one: a plain `string` is not assignable to a brand.
// ---------------------------------------------------------------------------

// @ts-expect-error a raw string must not satisfy TenantId — that is the entire point of the brand
const notATenant: TenantId = UUID_A;

// @ts-expect-error not even a string literal typed as string
const alsoNot: GymId = String(UUID_A);

// ---------------------------------------------------------------------------
// AC-2, half two: the five most-confused pairs, both directions.
//
// Each pair is one that a reviewer genuinely cannot catch by eye, because both sides are UUIDs
// and the variable names are frequently just `id`.
// ---------------------------------------------------------------------------

const aTenant: TenantId = tenantId(UUID_A);
const aGym: GymId = gymId(UUID_A);
const aMember: MemberId = memberId(UUID_A);
const aUser: UserId = userId(UUID_A);
const anOrder: OrderId = orderId(UUID_A);
const aPayment: PaymentId = paymentId(UUID_A);
const aPlan: PlanId = planId(UUID_A);
const aMembership: MembershipId = membershipId(UUID_A);
const aBranch: BranchId = branchId(UUID_A);

// TenantId / GymId — the pair that would breach BR-TEN-01 if confused.
// @ts-expect-error a GymId must not be assignable to TenantId — the brands are distinct
const p1a: TenantId = aGym;
// @ts-expect-error a TenantId must not be assignable to GymId — the brands are distinct
const p1b: GymId = aTenant;

// MemberId / UserId — a member is a tenant-scoped record; a user is a platform identity.
// @ts-expect-error a UserId must not be assignable to MemberId — the brands are distinct
const p2a: MemberId = aUser;
// @ts-expect-error a MemberId must not be assignable to UserId — the brands are distinct
const p2b: UserId = aMember;

// OrderId / PaymentId — one order can have several payment attempts (BR-PAY-02).
// @ts-expect-error a PaymentId must not be assignable to OrderId — the brands are distinct
const p3a: OrderId = aPayment;
// @ts-expect-error a OrderId must not be assignable to PaymentId — the brands are distinct
const p3b: PaymentId = anOrder;

// PlanId / MembershipId — the plan is the template, the membership is the instance.
// @ts-expect-error a MembershipId must not be assignable to PlanId — the brands are distinct
const p4a: PlanId = aMembership;
// @ts-expect-error a PlanId must not be assignable to MembershipId — the brands are distinct
const p4b: MembershipId = aPlan;

// BranchId / GymId — a gym has many branches; the single-branch case is where this gets confused.
// @ts-expect-error a GymId must not be assignable to BranchId — the brands are distinct
const p5a: BranchId = aGym;
// @ts-expect-error a BranchId must not be assignable to GymId — the brands are distinct
const p5b: GymId = aBranch;

// A branded id IS still a string where a string is genuinely wanted (logging, URL building).
const asString: string = aTenant;

// Keep every binding used so `noUnusedLocals` stays on for the rest of the package.
void [notATenant, alsoNot, p1a, p1b, p2a, p2b, p3a, p3b, p4a, p4b, p5a, p5b, asString];

// ---------------------------------------------------------------------------
// Runtime behaviour of the validating constructors (§9.5 B2).
// ---------------------------------------------------------------------------

test('a validating constructor accepts a well-formed UUID and returns it unchanged', () => {
  assert.equal(tenantId(UUID_A), UUID_A);
  assert.equal(typeof tenantId(UUID_A), 'string');
});

test('a validating constructor rejects anything that is not an RFC 9562 UUID', () => {
  for (const bad of [
    '',
    'not-a-uuid',
    UUID_A.slice(0, -1),
    `${UUID_A} `,
    '00000000-0000-0000-0000-000000000000', // nil UUID: version nibble 0
    '018f3a2b-7c41-9d3e-8b91-2f5a6c7d8e90', // version 9 does not exist
    '018f3a2b-7c41-7d3e-cb91-2f5a6c7d8e90', // variant nibble 'c' is not 10xx
  ]) {
    assert.throws(
      () => tenantId(bad),
      InvalidIdentifierError,
      `should have rejected ${bad || '""'}`,
    );
  }
});

test('BR-DAT-06 — the rejection message never contains the offending value', () => {
  // An identifier can appear in a URL beside personal data, and this message reaches logs.
  // NB: the value must actually be invalid. `...-DEADBEEFCAFE` reads as a placeholder but is
  // twelve valid hex digits, so it parses fine and the test silently proves nothing — which is
  // exactly what happened on the first run of this spec.
  const secretish = '018f3a2b-7c41-7d3e-8b91-9876543210ZZ';
  assert.equal(isUuid(secretish), false, 'the fixture must genuinely be invalid');

  // Capture, then assert OUTSIDE the catch. An `assert.fail` inside a catch block is swallowed
  // by that same block, and `assert.throws` returns undefined rather than the error — both of
  // which turn this into a test that passes without checking anything.
  let error: unknown;
  try {
    tenantId(secretish);
  } catch (thrown) {
    error = thrown;
  }

  assert.ok(error instanceof InvalidIdentifierError, 'expected an InvalidIdentifierError');
  assert.ok(
    !error.message.includes(secretish),
    'the raw value leaked into the error message — BR-DAT-06 forbids personal data in logs',
  );
  assert.match(error.message, /TenantId/, 'the brand must still be identifiable');
});

test('§9.5 B1 — every one of the twenty identifiers has a validating constructor', () => {
  const expected = [
    'TenantId',
    'GymId',
    'BranchId',
    'PlanId',
    'MembershipId',
    'OrderId',
    'PaymentId',
    'InvoiceId',
    'LedgerEntryId',
    'SettlementBatchId',
    'RefundId',
    'DisputeId',
    'ReviewId',
    'CouponId',
    'StaffId',
    'UserId',
    'MemberId',
    'AttendanceId',
    'ApplicationId',
    'TicketId',
  ];
  assert.deepEqual(Object.keys(ID_CONSTRUCTORS).sort(), [...expected].sort());
  assert.equal(expected.length, 20);
});

test('each constructor reports its own brand, so a wrong-id error names the right type', () => {
  for (const [brandName, construct] of Object.entries(ID_CONSTRUCTORS)) {
    assert.throws(
      () => construct('nope'),
      (error: unknown) => {
        assert.ok(error instanceof InvalidIdentifierError);
        assert.equal(error.brandName, brandName);
        return true;
      },
    );
  }
});

test('isUuid is a pure shape check and makes no brand claim', () => {
  assert.equal(isUuid(UUID_B), true);
  assert.equal(isUuid(12345), false);
  assert.equal(isUuid(null), false);
  assert.equal(isUuid(undefined), false);
});
