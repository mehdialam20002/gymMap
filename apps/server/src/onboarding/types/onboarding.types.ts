/**
 * `M-026` · The onboarding vocabulary — `Schema.md` §4.2, §4.3.
 *
 * Mirrors the database enums rather than re-deciding them. The migration is the source of truth and
 * `audit-enum-parity.int-spec.ts`'s sibling problem applies here too: a label invented in TypeScript
 * that PostgreSQL does not hold produces a write that throws at runtime and nowhere else.
 */

export const APPLICATION_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'INFO_REQUESTED',
  'APPROVED',
  'REJECTED',
] as const;

/** `Schema.md` §4.2: no `DRAFT`. A draft is a TENANT state, not a submitted application version. */
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_DECISIONS = ['APPROVED', 'REJECTED', 'INFO_REQUESTED'] as const;
export type ApplicationDecision = (typeof APPLICATION_DECISIONS)[number];

/** `LAUNCH_MARKET_INDIA.md` §6 — the ten-document India checklist, plus `OTHER` for a second market. */
export const KYC_DOCUMENT_TYPES = [
  'PAN',
  'GSTIN',
  'BUSINESS_REGISTRATION',
  'SHOP_ESTABLISHMENT',
  'BANK_PROOF',
  'OWNER_IDENTITY',
  'PREMISES_ADDRESS_PROOF',
  'TRADE_LICENCE',
  'FIRE_SAFETY_NOC',
  'MUSIC_LICENCE',
  'OTHER',
] as const;
export type KycDocumentType = (typeof KYC_DOCUMENT_TYPES)[number];

export const KYC_DOCUMENT_STATUSES = [
  'PENDING',
  'UNDER_REVIEW',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'SUPERSEDED',
] as const;
export type KycDocumentStatus = (typeof KYC_DOCUMENT_STATUSES)[number];
