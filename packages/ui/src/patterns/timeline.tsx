/**
 * `Timeline`, `BulkBar` and `DecisionBar` — the three shapes an admin decision surface needs.
 *
 * ┌─ WHY A TIMELINE IS NOT JUST A LIST WITH DOTS ───────────────────────────────────────────────┐
 * │ An application's history is the evidence an operator decides on: who asked for what, when, and │
 * │ what the applicant said back. A flat list makes every entry look equally recent, which is      │
 * │ exactly the judgement the operator is trying to make. The rail and the relative time are the   │
 * │ information; the dots are what makes the rail readable.                                        │
 * │                                                                                              │
 * │ `at` is a pre-formatted STRING. Formatting a timestamp needs a timezone, and every gym in this │
 * │ system operates in `Asia/Kolkata` while the caller may be rendering for an audit export in     │
 * │ UTC. `packages/utils/src/time/` owns that decision and `R3` forbids importing it here, so the  │
 * │ caller formats and this renders.                                                               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import type { ReactNode } from 'react';

import { Button, type Tone } from './index.tsx';

const DOT: Record<Tone, string> = {
  neutral: 'border-strong bg-surface',
  brand: 'border-brand bg-surface-brand-subtle',
  success: 'border-success bg-surface-success-subtle',
  warning: 'border-warning bg-surface-warning-subtle',
  danger: 'border-danger bg-surface-danger-subtle',
  info: 'border-info bg-surface-info-subtle',
};

export interface TimelineEntry {
  readonly id: string;
  readonly headline: string;
  /** Who did it. Omit for a system event — and say "System" rather than leaving it blank. */
  readonly actor?: string;
  /** Pre-formatted. See the note on the module. */
  readonly at: string;
  readonly tone?: Tone;
  /**
   * The body. A reason, a note, a diff.
   *
   * Rendered as given, so a caller can put a quoted rejection reason in a blockquote — the reason
   * an application was refused is the single most re-read thing on this screen.
   */
  readonly detail?: ReactNode;
}

export function Timeline({
  entries,
  emptyText,
  label,
}: {
  readonly entries: readonly TimelineEntry[];
  /** Shown when there is no history. Never an empty box. */
  readonly emptyText: string;
  readonly label: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-content-muted">{emptyText}</p>;
  }

  return (
    <ol aria-label={label} className="flex flex-col">
      {entries.map((entry, index) => {
        const last = index === entries.length - 1;

        return (
          <li key={entry.id} className="flex gap-inline-sm">
            {/* The rail. A column of its own so the dots line up regardless of how tall each
                entry's body is — centring a dot against variable-height content by eye is what
                makes hand-rolled timelines look bent. */}
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={`mt-[0.3rem] h-[0.75rem] w-[0.75rem] shrink-0 rounded-full border-2 ${DOT[entry.tone ?? 'neutral']}`}
              />
              {/* No rail below the last entry: a line trailing into nothing reads as "more below". */}
              {!last && <span aria-hidden="true" className="w-[2px] flex-1 bg-surface-sunken" />}
            </div>

            <div className={`min-w-0 flex-1 ${last ? '' : 'pb-inset-md'}`}>
              <div className="flex flex-wrap items-baseline gap-inline-xs">
                <p className="text-sm font-medium text-content">{entry.headline}</p>
                <p className="text-xs text-content-muted">
                  {entry.actor === undefined ? entry.at : `${entry.actor} · ${entry.at}`}
                </p>
              </div>
              {entry.detail !== undefined && (
                <div className="mt-stack-2xs text-sm text-content-secondary">{entry.detail}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// BulkBar
// ---------------------------------------------------------------------------

/**
 * The bar that appears when rows are selected.
 *
 * ┌─ IT SAYS THE COUNT BEFORE IT OFFERS THE ACTION ─────────────────────────────────────────────┐
 * │ "Suspend" beside a checkbox column is an invitation to act on a selection the operator has    │
 * │ lost track of — they ticked eight rows, turned a page, ticked two more. So the count comes     │
 * │ first, in the same sentence as the verb, and `Clear` is always present.                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Sticky at the BOTTOM rather than replacing the header: replacing the header hides the filter the
 * selection was made under, and the filter is half of what the operator needs to remember.
 */
export function BulkBar({
  count,
  onClear,
  children,
  labels,
}: {
  readonly count: number;
  readonly onClear: () => void;
  /** The actions. Each should be a `Button`; disabled ones stay visible with a reason. */
  readonly children: ReactNode;
  readonly labels: {
    /** `{n}` is replaced with the count. */
    readonly selected: string;
    readonly clear: string;
    readonly region: string;
  };
}) {
  if (count === 0) return null;

  return (
    <div
      role="region"
      aria-label={labels.region}
      className="sticky bottom-0 z-sticky-section mt-stack-sm flex flex-wrap items-center justify-between gap-inline-sm rounded-card border border-brand bg-surface-raised px-inset-md py-inset-sm shadow-lg"
    >
      <p className="text-sm font-medium text-content">
        {labels.selected.replace('{n}', count.toLocaleString('en-IN'))}
      </p>
      <div className="flex flex-wrap items-center gap-inline-2xs">
        {children}
        <Button variant="ghost" size="sm" onClick={onClear}>
          {labels.clear}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DecisionBar
// ---------------------------------------------------------------------------

/**
 * The sticky approve / request-info / reject bar on an application.
 *
 * ┌─ THE DESTRUCTIVE ACTION IS FURTHEST FROM THE CONSTRUCTIVE ONE ──────────────────────────────┐
 * │ Reject sits on the LEFT and Approve on the right, with request-info between them. Putting     │
 * │ them adjacent is how an operator clearing thirty applications rejects one they meant to        │
 * │ approve — the muscle memory is the position, not the label, and by the time they read the      │
 * │ confirmation dialog they have already stopped reading confirmation dialogs.                     │
 * │                                                                                              │
 * │ Every one of them still goes through `ConfirmDialog`, and reject and request-info both carry  │
 * │ a mandatory reason. `BR-GYM-01` requires a human decision per gym; the reason is what makes    │
 * │ that decision reviewable afterwards.                                                           │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `note` is where a screen explains why the buttons are inert. An action an operator cannot take
 * yet is shown disabled with the reason beside it, never hidden — a missing control reads as a
 * broken screen and makes the remaining work invisible.
 */
export function DecisionBar({
  onReject,
  onRequestInfo,
  onApprove,
  disabled = false,
  note,
  labels,
}: {
  readonly onReject: () => void;
  readonly onRequestInfo: () => void;
  readonly onApprove: () => void;
  readonly disabled?: boolean;
  readonly note?: string;
  readonly labels: {
    readonly reject: string;
    readonly requestInfo: string;
    readonly approve: string;
    readonly region: string;
  };
}) {
  return (
    <div
      role="region"
      aria-label={labels.region}
      className="sticky bottom-0 z-sticky-section mt-stack-md flex flex-wrap items-center justify-between gap-inline-sm rounded-card border border-subtle bg-surface-raised px-inset-md py-inset-sm shadow-lg"
    >
      <div className="min-w-0">
        {note !== undefined && <p className="text-xs text-content-muted">{note}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-inline-sm">
        <Button variant="danger" onClick={onReject} disabled={disabled}>
          {labels.reject}
        </Button>
        {/* Between them, and it is the least destructive of the three: it pauses the clock and asks
            the applicant a question rather than deciding anything. */}
        <Button variant="secondary" onClick={onRequestInfo} disabled={disabled}>
          {labels.requestInfo}
        </Button>
        <Button variant="primary" onClick={onApprove} disabled={disabled}>
          {labels.approve}
        </Button>
      </div>
    </div>
  );
}
