/**
 * `M-027` · The six onboarding steps — `FR-ONB-01`, `FR-ONB-08`, `E2.2`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHERE THE DRAFT LIVES, AND WHY IT IS NOT WHERE THE ROADMAP SAYS
 *
 * `M-027`'s file list specifies the draft as *"`applications` at `version = 0` with
 * `status = 'DRAFT'`, so there is no second storage mechanism to keep consistent"*. Neither half is
 * representable, and the database says so:
 *
 *   · `application_status_enum` has no `DRAFT`. `Schema.md` §4.2 states the omission and its
 *     reason: *"a draft is a TENANT state, not a submitted application version (`FR-ONB-08`)"*.
 *   · `version = 0` violates `ck_applications__version_positive`, because `BR-GYM-05`'s version
 *     sequence starts at the first SUBMISSION.
 *
 * `Schema.md` is rank-3 derived specification; the roadmap is rank 4 and is *"a plan of work, never
 * a source of requirements"* (`CLAUDE.md` §2). So the draft is the `tenants` row — which already
 * carries every step-1 column (`legal_name`, `trading_name`, `entity_type`, `registration_number`,
 * the registered address) and already has `DRAFT` in `tenant_status_enum`.
 *
 * The roadmap's INTENT is met exactly: there is still no second storage mechanism. It is simply the
 * table the schema designates rather than the one the plan guessed at.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** A closed set. A seventh step is a specification change, not a string somebody passes. */
export const WIZARD_STEPS = [
  'BUSINESS_IDENTITY',
  'KYC',
  'GYM_PROFILE',
  'PLANS',
  'PAYOUT',
  'REVIEW',
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export function isWizardStep(value: string): value is WizardStep {
  return (WIZARD_STEPS as readonly string[]).includes(value);
}

/**
 * `AC-3` — completion is DATA, returned by the server.
 *
 * The client must not compute progress from what it happens to hold locally: an owner who finished
 * three steps on a laptop and opens the wizard on a phone has no local state at all, and a client
 * that infers "step 1" from that has just discarded their work in the only way the user will notice.
 */
export interface WizardProgress {
  readonly completed: readonly WizardStep[];
  /** The first incomplete step, or `null` when every step is done. */
  readonly nextStep: WizardStep | null;
}

/**
 * `AC-2` and `AC-3` — per-step validation, and any step revisitable.
 *
 * ┌─ THE ORDER IS A SUGGESTION, NOT A GATE ─────────────────────────────────────────────────────┐
 * │ `nextStep` is the first INCOMPLETE step, which is where a returning owner wants to land. It   │
 * │ is not permission: `AC-3` says any step is revisitable, and an owner who wants to fix their   │
 * │ trading name after reaching payout must be able to. A wizard that enforces its own order      │
 * │ turns a correction into a restart.                                                            │
 * │                                                                                              │
 * │ So this computes a SUGGESTION and nothing consults it to authorise a save.                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function progressFrom(completed: readonly WizardStep[]): WizardProgress {
  const done = new Set(completed);
  const ordered = WIZARD_STEPS.filter((step) => done.has(step));

  return {
    // Returned in CANONICAL order rather than completion order, so two owners who did the same
    // steps in different orders get the same answer and a client can compare against a constant.
    completed: ordered,
    nextStep: WIZARD_STEPS.find((step) => !done.has(step)) ?? null,
  };
}
