/**
 * The admin read calls. `SCR-ADM-001`, `SCR-ADM-002`, `SCR-ADM-004`.
 *
 * Thin wrappers over `api()` so a component never assembles a path or remembers a response shape.
 * Every one of these crosses a tenant boundary on the server and lands an audit row before the
 * query runs — which is invisible from here, and is the point.
 */

import { percentStringFromBps } from '@gymmap/utils';

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
    readonly count: number;
    readonly byStatus: Readonly<Record<GymStatus, number>>;
    readonly awaitingReview: number;
    readonly listed: number;
  };
  readonly people: {
    readonly count: number;
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
  /** Whole hours since submission. The unit the SLA is stated in (`AdminDashboard.md` 6.2). */
  readonly age_hours?: number;
  /**
   * The verification SLA, computed SERVER-side, or `null` for a decided gym.
   *
   * +- THE CONSOLE MUST NOT DERIVE ANY OF THIS -------------------------------------------------+
   * | `AdminDashboard.md` UI-ADM-4: the SLA target "is configuration, not a constant. The        |
   * | console reads it from the API and must never hard-code it." `Admin.md` 5.1.1 gives the     |
   * | reason for the state too: "A client computing 51 hours from a UTC timestamp in a browser   |
   * | set to IST gets a different answer 23% of the day, and an officer told an application      |
   * | breaches tomorrow when it breaches tonight will let it breach."                            |
   * |                                                                                          |
   * | So every field here is rendered and none is computed. That includes the thresholds: 24     |
   * | hours is not written anywhere in this app.                                                 |
   * +-------------------------------------------------------------------------------------------+
   */
  readonly sla?: {
    readonly state: 'WITHIN' | 'APPROACHING' | 'BREACHED' | 'PAUSED';
    readonly target_hours: number;
    readonly hours_remaining: number | null;
    readonly breaches_at: string | null;
    readonly age_hours_wall_clock: number;
  } | null;
  // The `?` above is not decoration. It was a crash: a console built against a server that had not
  // yet been redeployed received no `sla` key at all, `sla === null` was false, and reading
  // `sla.state` took the whole screen down with "Cannot read properties of undefined". A version
  // skew between a deployed console and a deployed API is a NORMAL condition, not an error, and one
  // absent field must degrade rather than blank the page. Every reader normalises with `?? null`.
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
  bps === null ? '-' : `${percentStringFromBps(BigInt(bps)).replace(/\.00$/, '')}%`;
