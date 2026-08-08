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

/**
 * The verification-SLA state of one application - `Admin.md` 5.1.1, `FR-ADMN-11`.
 *
 * +- SERVER-COMPUTED, AND THE REASON IS IN THE CONTRACT ----------------------------------------+
 * | `apis/README.md` 12.3: any value a user will compare against their own calendar is computed  |
 * | server-side. `Admin.md` 5.1.1 spells out the failure: "A client computing 51 hours from a    |
 * | UTC timestamp in a browser set to IST gets a different answer 23% of the day, and an officer |
 * | told an application breaches tomorrow when it breaches tonight will let it breach."          |
 * |                                                                                             |
 * | So the console renders `state` and never derives it. `AdminDashboard.md` UI-ADM-4 also        |
 * | forbids the console hard-coding the target, which is why `target_hours` is on the wire        |
 * | rather than assumed.                                                                         |
 * +---------------------------------------------------------------------------------------------+
 */
export interface ApplicationSla {
  /**
   * `AdminDashboard.md` 6.2's column semantics, exactly.
   *
   * `PAUSED` is the one an implementation forgets. 6.2: "Where the SLA is paused
   * (`INFO_REQUESTED`), the chip reads `paused` and the tooltip carries `age_hours_wall_clock` so a
   * paused queue cannot hide a stalled application." An application waiting on the APPLICANT is not
   * late by the platform's own clock - but it can still be four months old, and the wall-clock
   * figure is what stops the pause becoming a place things go to be forgotten.
   */
  readonly state: 'WITHIN' | 'APPROACHING' | 'BREACHED' | 'PAUSED';
  /** From `VERIFICATION_SLA_TARGET_HOURS`. On the wire so the console never assumes 72. */
  readonly target_hours: number;
  /**
   * Goes NEGATIVE past the target and stays visible. `null` while `PAUSED`.
   *
   * 6.2: "a breach that disappears from the queue is a breach nobody fixes". Clamping at zero would
   * make a 4-hour breach and a 4-week breach look identical, which is the one distinction an
   * officer triaging a breached queue needs.
   *
   * +- WHY `null` RATHER THAN A FROZEN NUMBER WHILE PAUSED --------------------------------------+
   * | Computing what remains at the moment of pausing needs the INSTANT the information was       |
   * | requested, and `tenants` has no `info_requested_at` column - the applications table that     |
   * | would carry it arrives with `M-036`. A frozen number computed from `created_at` instead      |
   * | would be a plausible figure that is simply wrong, which on an SLA is worse than an absent    |
   * | one. `null` says "not known", the chip says `paused`, and `age_hours_wall_clock` still       |
   * | answers "how long has this really been open".                                                |
   * +-------------------------------------------------------------------------------------------+
   */
  readonly hours_remaining: number | null;
  /** `null` while `PAUSED`, for the same reason as `hours_remaining`. */
  readonly breaches_at: string | null;
  /**
   * Hours since submission, ignoring any pause. ALWAYS present.
   *
   * This is 6.2's anti-hiding measure and it is the field most worth keeping non-optional: it is
   * the only number on the row that a pause cannot flatter.
   */
  readonly age_hours_wall_clock: number;
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
  /** Whole hours. The unit `Admin.md` 5.1.1 states the SLA in; `waiting_days` is for display. */
  readonly age_hours: number;
  /**
   * `null` for a gym that is not in the queue.
   *
   * An SLA on an APPROVED or SUSPENDED gym would be meaningless - there is no decision pending, so
   * there is nothing to be late for. `null` says that; a `WITHIN` state on a decided application
   * would read as "still fine" on something nobody is waiting for.
   */
  readonly sla: ApplicationSla | null;
}
