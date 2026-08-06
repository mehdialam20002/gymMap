/**
 * M-003 · Branded entity identifiers — constitution §9.5 (B1–B3), FolderStructure.md §11.
 *
 * A `string` id is a bug waiting for a rename. This product passes twenty entity identifiers
 * between twenty-three modules, and every one of them is a UUID at runtime — structurally
 * identical, semantically incompatible. Without brands, `freeze(gymId)` compiles cleanly when
 * the parameter wanted a `MembershipId`, and the mistake surfaces as a row that will not be
 * found rather than as a type error.
 *
 * The brand is a phantom property keyed by a `unique symbol` that is never exported. Nothing
 * outside this file can name the key, so nothing outside this file can forge a branded value
 * except through a cast — which §9.5 B2 makes a review rejection.
 *
 * At runtime a branded id is exactly its underlying string. The brand costs nothing.
 */

declare const brand: unique symbol;

/** A nominal type over a structural one. `T` is the runtime representation; `B` names the brand. */
export type Brand<T, B extends string> = T & { readonly [brand]: B };

// ---------------------------------------------------------------------------
// The twenty identifiers of FolderStructure.md §11 / constitution §4.3.
// ---------------------------------------------------------------------------

export type TenantId = Brand<string, 'TenantId'>;
export type GymId = Brand<string, 'GymId'>;
export type BranchId = Brand<string, 'BranchId'>;
export type PlanId = Brand<string, 'PlanId'>;
export type MembershipId = Brand<string, 'MembershipId'>;
export type OrderId = Brand<string, 'OrderId'>;
export type PaymentId = Brand<string, 'PaymentId'>;
export type InvoiceId = Brand<string, 'InvoiceId'>;
export type LedgerEntryId = Brand<string, 'LedgerEntryId'>;
export type SettlementBatchId = Brand<string, 'SettlementBatchId'>;
export type RefundId = Brand<string, 'RefundId'>;
export type DisputeId = Brand<string, 'DisputeId'>;
export type ReviewId = Brand<string, 'ReviewId'>;
export type CouponId = Brand<string, 'CouponId'>;
export type StaffId = Brand<string, 'StaffId'>;
export type UserId = Brand<string, 'UserId'>;
export type MemberId = Brand<string, 'MemberId'>;
export type AttendanceId = Brand<string, 'AttendanceId'>;
export type ApplicationId = Brand<string, 'ApplicationId'>;
export type TicketId = Brand<string, 'TicketId'>;

/** Every branded identifier in the platform, for signatures that are genuinely id-agnostic. */
export type AnyEntityId =
  | TenantId
  | GymId
  | BranchId
  | PlanId
  | MembershipId
  | OrderId
  | PaymentId
  | InvoiceId
  | LedgerEntryId
  | SettlementBatchId
  | RefundId
  | DisputeId
  | ReviewId
  | CouponId
  | StaffId
  | UserId
  | MemberId
  | AttendanceId
  | ApplicationId
  | TicketId;

// ---------------------------------------------------------------------------
// Validating constructors — §9.5 B2. A branded value is produced ONLY here.
// ---------------------------------------------------------------------------

/**
 * RFC 9562 shape with a variant of `10xx` and a version nibble in 1–8.
 *
 * Deliberately NOT pinned to version 7 alone. Schema.md line 75 mandates that we *generate*
 * UUIDv7 (time-ordered, application-supplied, so the id exists before the INSERT), and the
 * `IdGenerator` port in M-004 is what enforces that. Validation is a different job: it also
 * runs on ids arriving from a URL, a webhook or an imported CSV, and rejecting a well-formed v4
 * that a payment provider minted would be a self-inflicted outage. Generation is strict;
 * acceptance is RFC-conformant.
 */
const UUID_RFC9562 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Thrown when a raw string is not a well-formed identifier.
 *
 * `code` matches the registry so the server's exception filter (M-004) can map this to the
 * `C3.1` envelope without a second lookup table. It is deliberately NOT part of the §13.1
 * server error hierarchy — `packages/types` is runtime-free by rule R4 and must not grow one.
 */
export class InvalidIdentifierError extends Error {
  readonly code = 'VALIDATION_FAILED' as const;
  readonly brandName: string;

  constructor(brandName: string, raw: unknown) {
    // The raw value is NOT interpolated into the message. An identifier can be a
    // pseudonymisation key or appear in a URL alongside personal data, and this message
    // reaches logs — BR-DAT-06 forbids that. The brand plus the length is enough to debug.
    super(
      `Invalid ${brandName}: expected an RFC 9562 UUID, received a ${typeof raw}` +
        (typeof raw === 'string' ? ` of length ${raw.length}` : ''),
    );
    this.name = 'InvalidIdentifierError';
    this.brandName = brandName;
  }
}

/** True when `raw` is a well-formed RFC 9562 UUID. Carries no brand claim on its own. */
export function isUuid(raw: unknown): raw is string {
  return typeof raw === 'string' && UUID_RFC9562.test(raw);
}

/**
 * Builds the validating constructor for one brand.
 *
 * Twenty near-identical constructors would be twenty places for the validation to drift, so
 * there is one implementation and twenty bindings (Ten Questions #2 — reuse, do not duplicate).
 */
function idConstructor<B extends string>(brandName: B) {
  return (raw: string): Brand<string, B> => {
    if (!isUuid(raw)) throw new InvalidIdentifierError(brandName, raw);
    return raw as Brand<string, B>;
  };
}

export const tenantId = idConstructor('TenantId');
export const gymId = idConstructor('GymId');
export const branchId = idConstructor('BranchId');
export const planId = idConstructor('PlanId');
export const membershipId = idConstructor('MembershipId');
export const orderId = idConstructor('OrderId');
export const paymentId = idConstructor('PaymentId');
export const invoiceId = idConstructor('InvoiceId');
export const ledgerEntryId = idConstructor('LedgerEntryId');
export const settlementBatchId = idConstructor('SettlementBatchId');
export const refundId = idConstructor('RefundId');
export const disputeId = idConstructor('DisputeId');
export const reviewId = idConstructor('ReviewId');
export const couponId = idConstructor('CouponId');
export const staffId = idConstructor('StaffId');
export const userId = idConstructor('UserId');
export const memberId = idConstructor('MemberId');
export const attendanceId = idConstructor('AttendanceId');
export const applicationId = idConstructor('ApplicationId');
export const ticketId = idConstructor('TicketId');

/**
 * The registry of constructors, used by the spec to prove every brand has one and by
 * generic deserialisation boundaries. Keyed by brand name so a missing entry is a type error.
 */
export const ID_CONSTRUCTORS = {
  TenantId: tenantId,
  GymId: gymId,
  BranchId: branchId,
  PlanId: planId,
  MembershipId: membershipId,
  OrderId: orderId,
  PaymentId: paymentId,
  InvoiceId: invoiceId,
  LedgerEntryId: ledgerEntryId,
  SettlementBatchId: settlementBatchId,
  RefundId: refundId,
  DisputeId: disputeId,
  ReviewId: reviewId,
  CouponId: couponId,
  StaffId: staffId,
  UserId: userId,
  MemberId: memberId,
  AttendanceId: attendanceId,
  ApplicationId: applicationId,
  TicketId: ticketId,
} as const;

export type BrandName = keyof typeof ID_CONSTRUCTORS;
