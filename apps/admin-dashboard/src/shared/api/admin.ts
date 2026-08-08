/**
 * The admin read calls. `SCR-ADM-001`, `SCR-ADM-002`, `SCR-ADM-004`.
 *
 * Thin wrappers over `api()` so a component never assembles a path or remembers a response shape.
 * Every one of these crosses a tenant boundary on the server and lands an audit row before the
 * query runs — which is invisible from here, and is the point.
 */

import { api } from './client.ts';

/** `tenant_status_enum` — the `C4.4` approval state machine, verbatim. */
export const GYM_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'INFO_REQUESTED',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'CLOSED',
] as const;

export type GymStatus = (typeof GYM_STATUSES)[number];

/** The three states a human owns. The queue is the register filtered to these. */
export const AWAITING_STATUSES: readonly GymStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'INFO_REQUESTED',
];

export interface PlatformOverview {
  readonly gyms: {
    readonly total: number;
    readonly byStatus: Readonly<Record<GymStatus, number>>;
    readonly awaitingReview: number;
    readonly listed: number;
  };
  readonly people: {
    readonly total: number;
    readonly byRole: Readonly<Record<string, number>>;
    readonly activeSessions: number;
  };
  readonly generatedAt: string;
}

export interface GymRow {
  readonly id: string;
  readonly legal_name: string;
  readonly trading_name: string | null;
  readonly entity_type: string;
  readonly status: GymStatus;
  readonly subscription_status: string;
  readonly city: string | null;
  readonly state: string | null;
  readonly gstin: string | null;
  readonly commission_rate_bps: number | null;
  readonly created_at: string;
  readonly waiting_days: number;
}

export const platformOverview = (): Promise<PlatformOverview> =>
  api<PlatformOverview>('/v1/admin/platform/overview');

export const platformGyms = (status?: GymStatus | null): Promise<{ gyms: GymRow[] }> =>
  api<{ gyms: GymRow[] }>(
    status ? `/v1/admin/platform/gyms?status=${status}` : '/v1/admin/platform/gyms',
  );

/**
 * Basis points to a percentage string.
 *
 * The server sends `1200`, never `12` and never `0.12`. Integer basis points are the same
 * discipline as integer paise: a commission held as a float is a rounding difference between the
 * rate the gym agreed and the rate the ledger applies, and it reconciles to a few rupees a month
 * forever. This is the only place the division happens.
 */
export const formatBps = (bps: number | null): string =>
  bps === null ? '-' : `${(bps / 100).toFixed(2).replace(/\.00$/, '')}%`;
