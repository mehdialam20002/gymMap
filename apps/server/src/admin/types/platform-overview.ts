/**
 * The admin console's read shapes — `SCR-ADM-001`, `SCR-ADM-004`.
 *
 * ┌─ EVERY FIELD HERE IS BACKED BY A TABLE THAT EXISTS ─────────────────────────────────────────┐
 * │ Deliberately, and it is the reason this type is short. Revenue, orders, settlements,        │
 * │ refunds, memberships and check-ins have no tables until later milestones, so they are ABSENT │
 * │ from this contract rather than present and zero.                                             │
 * │                                                                                              │
 * │ A `0` that means "not built" and a `0` that means "nothing happened today" are identical on  │
 * │ screen and only one of them needs an operator. Leaving the field out forces the UI to render │
 * │ the honest thing, because there is nothing else to render.                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/** Counts across the `C4.4` approval state machine, keyed by `tenant_status_enum`. */
export interface GymStatusCounts {
  readonly DRAFT: number;
  readonly SUBMITTED: number;
  readonly UNDER_REVIEW: number;
  readonly INFO_REQUESTED: number;
  readonly APPROVED: number;
  readonly REJECTED: number;
  readonly SUSPENDED: number;
  readonly CLOSED: number;
}

export interface PlatformOverview {
  readonly gyms: {
    // `count`, not `total`. `no-float-money` reads a field called `total` as money and demands
    // bigint — correctly, because on a platform that handles payments `total` is ambiguous and
    // the ambiguity is exactly what the rule exists to stop. This is a row count.
    readonly count: number;
    readonly byStatus: GymStatusCounts;
    /**
     * `SUBMITTED + UNDER_REVIEW + INFO_REQUESTED`.
     *
     * Precomputed on the server rather than summed in the browser: this figure decides whether an
     * operator opens the queue, and two implementations of "what counts as waiting" would drift
     * the moment a status is added to the enum.
     */
    readonly awaitingReview: number;
    /** `BR-GYM-01` — approved is the only state that is publicly listed. */
    readonly listed: number;
  };
  readonly people: {
    readonly count: number;
    /** Keyed by `roles.key`. A person with no role does not appear in any bucket. */
    readonly byRole: Readonly<Record<string, number>>;
    readonly activeSessions: number;
  };
  /** ISO-8601. The UI renders this as its `LastUpdatedIndicator` — `A-08`, `LC5`. */
  readonly generatedAt: string;
}

export interface GymRow {
  readonly id: string;
  readonly legal_name: string;
  readonly trading_name: string | null;
  readonly entity_type: string;
  readonly status: string;
  readonly subscription_status: string;
  readonly city: string | null;
  readonly state: string | null;
  readonly gstin: string | null;
  /** Basis points. 1200 = 12.00%. Never a float, and never pre-divided for display. */
  readonly commission_rate_bps: number | null;
  readonly created_at: string;
  /** Whole days since the application arrived. What the queue ages by. */
  readonly waiting_days: number;
}
