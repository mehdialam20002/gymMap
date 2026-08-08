/**
 * `PageHeader` and `MetricCard` — the two pieces every console page repeats.
 *
 * ┌─ ONE HEADER, SO FOURTEEN PAGES CANNOT DISAGREE ABOUT WHERE THE TITLE SITS ──────────────────┐
 * │ Each screen written on its own put the title, the subtitle and the actions in a slightly     │
 * │ different arrangement — one had the date beside the title, another under it. Nobody notices   │
 * │ on one page; navigating between four of them reads as four products.                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import type { ReactNode } from 'react';

import type { Tone } from './index.tsx';

export function PageHeader({
  title,
  subtitle,
  actions,
  meta,
}: {
  readonly title: string;
  readonly subtitle?: string;
  /** Right-aligned controls — a date range, an export, the primary action. */
  readonly actions?: ReactNode;
  /** A line under the actions, for a last-updated indicator. */
  readonly meta?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-inline-md">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-content">{title}</h1>
        {subtitle !== undefined && (
          <p className="mt-stack-2xs max-w-prose text-sm text-content-secondary">{subtitle}</p>
        )}
      </div>

      {(actions !== undefined || meta !== undefined) && (
        <div className="flex shrink-0 flex-col items-end gap-stack-2xs">
          {actions !== undefined && (
            <div className="flex items-center gap-inline-2xs">{actions}</div>
          )}
          {meta}
        </div>
      )}
    </header>
  );
}

const TONE_ACCENT: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-content-secondary',
  brand: 'bg-surface-brand-subtle text-content-brand',
  success: 'bg-surface-success-subtle text-content-success',
  warning: 'bg-surface-warning-subtle text-content-warning',
  danger: 'bg-surface-danger-subtle text-content-danger',
  info: 'bg-surface-info-subtle text-content-info',
};

/**
 * A KPI card: a large figure, a label, an optional trend, an optional sparkline slot.
 *
 * ┌─ `value` IS A STRING, AND `undefined` IS THE LOADING STATE ─────────────────────────────────┐
 * │ A string because formatting is the caller's job — `@gymmap/utils` owns the Indian grouping   │
 * │ and `R3` forbids importing it here; a second implementation would diverge from the PDF       │
 * │ renderer, which `LAUNCH_MARKET_INDIA` §2 calls a trust defect.                                │
 * │                                                                                              │
 * │ `undefined` renders the loading word rather than a `0`. On a console where a real zero means │
 * │ "nothing to approve today", a placeholder zero is indistinguishable from data.                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE TREND ARROW SHOWS DIRECTION, NOT JUDGEMENT ────────────────────────────────────────────┐
 * │ Fewer refund requests and less revenue carry the same sign and opposite news. Colouring the  │
 * │ arrow green for "up" would have the card make a claim the data does not support, so the      │
 * │ arrow is neutral ink and the caption says what the movement means.                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function MetricCard({
  label,
  value,
  icon,
  tone = 'neutral',
  trend,
  caption,
  chart,
  emphasis = false,
  loadingLabel,
  captionTone = 'muted',
}: {
  readonly label: string;
  readonly value: string | undefined;
  readonly icon?: ReactNode;
  readonly tone?: Tone;
  /** Pre-formatted, e.g. `+18.6%`. `rising` drives the glyph only. */
  readonly trend?: { readonly text: string; readonly rising: boolean };
  readonly caption?: string;
  /**
   * The caption's ink. Defaults to muted, which is right for "vs last 30 days".
   *
   * `success` is for a freshness word like "live" — the one caption that says the figure can be
   * trusted, and the one that should not be set in the faintest ink on the card.
   */
  readonly captionTone?: 'muted' | 'success';
  /** A sparkline, or anything else that belongs under the figure. */
  readonly chart?: ReactNode;
  /**
   * The one card on a grid that may carry a brand-tinted surface.
   *
   * At most one, and the brief is explicit about why: red must not dominate. A grid where every
   * card is tinted has no hierarchy, which is the same as no emphasis.
   */
  readonly emphasis?: boolean;
  readonly loadingLabel: string;
}) {
  return (
    <div
      // `shadow-sm` and a full `p-inset-lg`. The reference's cards are `p-5` with `shadow-sm`, and
      // on a near-white canvas the shadow is doing most of the separating — a card defined only by
      // a hairline border on an almost-identical background reads as a table cell.
      //
      // Still `dark:shadow-none`: in dark mode elevation is LIGHTNESS, and a shadow on a dark
      // surface is a smudge rather than a lift.
      // ┌─ `dark:bg-surface-raised`, OR THE CARD DISAPPEARS IN THE DEFAULT THEME ──────────────┐
      // │ The console DEFAULTS to dark, so this is the every-operator case. `dark:shadow-none` is │
      // │ right — a shadow on a dark surface is a smudge, and §9.4 suppresses it — but it removes │
      // │ the only elevation cue and nothing was replacing it. A `bg-surface` card on a           │
      // │ `bg-surface-sunken` canvas is a 1.14:1 fill step behind a hairline the design system    │
      // │ itself measures at 1.72:1 and labels decorative, so every panel read as flat ink and a  │
      // │ two-column grid merged into one field of text.                                          │
      // │                                                                                      │
      // │ §9.3: "in dark, elevation is LIGHTNESS, not shadow." So the card takes the lighter      │
      // │ surface in dark and the shadow in light, which is the same instruction read twice.       │
      // └──────────────────────────────────────────────────────────────────────────────────────┘
      className={`rounded-card border p-inset-lg shadow-sm dark:shadow-none ${
        emphasis
          ? 'border-brand bg-surface-brand-subtle'
          : 'border-subtle bg-surface dark:bg-surface-raised'
      }`}
    >
      <div className="flex items-start justify-between gap-inline-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-content-muted">{label}</p>
        {icon !== undefined && (
          <span
            className={`grid h-[2.25rem] w-[2.25rem] shrink-0 place-items-center rounded-control ${TONE_ACCENT[tone]}`}
          >
            {icon}
          </span>
        )}
      </div>

      {/* ┌─ THE FIGURE IS THE CARD ────────────────────────────────────────────────────────────┐
          │ `text-3xl font-bold`, up from `text-2xl font-semibold`. A KPI card exists so a       │
          │ number can be read from across a desk without focusing on it, and at `text-2xl`      │
          │ semibold the label and the figure carried almost the same weight — which made a grid │
          │ of four cards read as four paragraphs.                                               │
          └────────────────────────────────────────────────────────────────────────────────────┘ */}
      <p className="mt-stack-sm text-3xl font-bold tabular-nums tracking-tight text-content">
        {/* ┌─ `font-regular`, NOT `font-normal` ────────────────────────────────────────────────┐
            │ The preset REPLACES `theme.fontWeight` with regular|medium|semibold|bold|heavy, so │
            │ `font-normal` emitted NOTHING and this span inherited `font-semibold` from the      │
            │ paragraph around it. Every metric tile's loading word rendered at the same weight  │
            │ as the figure it stands in for — which is precisely the "placeholder               │
            │ indistinguishable from data" failure the note above says this exists to prevent.   │
            │                                                                                  │
            │ `font-extrabold` on the figure had the same problem and is now `font-bold`. The    │
            │ Tailwind token gate was extended to fail on either.                                │
            └──────────────────────────────────────────────────────────────────────────────────┘ */}
        {value ?? <span className="text-sm font-regular text-content-muted">{loadingLabel}</span>}
      </p>

      {chart !== undefined && <div className="mt-stack-2xs">{chart}</div>}

      {(trend !== undefined || caption !== undefined) && (
        <p
          className={`mt-stack-2xs flex items-center gap-inline-2xs text-xs ${
            captionTone === 'success' ? 'font-medium text-content-success' : 'text-content-muted'
          }`}
        >
          {trend !== undefined && (
            <>
              <span aria-hidden="true">{trend.rising ? '▲' : '▼'}</span>
              <span className="tabular-nums">{trend.text}</span>
            </>
          )}
          {caption !== undefined && <span>{caption}</span>}
        </p>
      )}
    </div>
  );
}
