/**
 * The status pill — one rendering of `tenant_status_enum`, used by three screens.
 *
 * ┌─ NEVER COLOUR ALONE — `AX8` ────────────────────────────────────────────────────────────────┐
 * │ The status WORD is always present. Colour is a second channel, not the channel: roughly one │
 * │ man in twelve cannot separate the red from the green, and "approved" versus "rejected" is    │
 * │ not a distinction to leave to hue on a screen that adjudicates a business.                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * One component rather than a colour map inlined per screen. Three copies would drift, and the
 * drift would be silent: a status that renders amber on the queue and grey on the register makes
 * an operator think they are looking at different things.
 */

import type { GymStatus } from '../shared/api/admin.ts';

/**
 * Tone per status. Read as: what does this state need from an operator?
 *
 * `warning` on the three states a human owns, because those are the ones that need somebody.
 * `danger` only for REJECTED and SUSPENDED, which are outcomes rather than work.
 */
const TONE: Record<GymStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  APPROVED: 'success',
  SUBMITTED: 'warning',
  UNDER_REVIEW: 'warning',
  INFO_REQUESTED: 'warning',
  REJECTED: 'danger',
  SUSPENDED: 'danger',
  DRAFT: 'neutral',
  CLOSED: 'neutral',
};

const CLASSES = {
  success: 'bg-surface-success-subtle text-content-success',
  warning: 'bg-surface-warning-subtle text-content-warning',
  danger: 'bg-surface-danger-subtle text-content-danger',
  neutral: 'bg-surface-sunken text-content-secondary',
} as const;

/** `UNDER_REVIEW` reads badly in a table. The enum value stays the source of truth. */
const LABEL: Record<GymStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  INFO_REQUESTED: 'Info requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
  CLOSED: 'Closed',
};

export function StatusPill({ status }: { readonly status: GymStatus }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-control px-inset-xs py-inset-2xs text-xs font-medium ${CLASSES[TONE[status]]}`}
    >
      {LABEL[status]}
    </span>
  );
}

/**
 * The FILL for a bar, as opposed to the subtle wash a pill sits on.
 *
 * Exported alongside the pill so a status is one colour decision, not two. Two maps would drift,
 * and the drift would read as two different things being shown.
 */
export const STATUS_BAR_CLASS: Record<GymStatus, string> = {
  APPROVED: 'bg-success-solid',
  SUBMITTED: 'bg-warning-solid',
  UNDER_REVIEW: 'bg-warning-solid',
  INFO_REQUESTED: 'bg-warning-solid',
  REJECTED: 'bg-danger-solid',
  SUSPENDED: 'bg-danger-solid',
  DRAFT: 'bg-border-strong',
  CLOSED: 'bg-border-strong',
};

/**
 * The tone for a status, for `@gymmap/ui`'s `Badge`.
 *
 * The local `StatusPill` still exists for the dashboard's compact rows; this exposes the same
 * mapping to the shared component so a status cannot render amber on one screen and grey on the
 * next. One map, two renderers.
 */
export function statusTone(status: GymStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  return TONE[status];
}

export { LABEL as GYM_STATUS_LABEL };
