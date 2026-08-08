/**
 * Tier 2 · The light-theme mapping — `DesignSystem.md` §3.3, §3.4, §3.5.
 *
 * Every value here is a reference into the Tier 1 ramp, never a literal hex. `colour.dark.ts`
 * exports the SAME key set against different references, and `semantic/index.ts` makes a missing
 * dark value a compile error rather than a bug report (§9.2).
 *
 * The state derivation is mechanical (§3.5) so no component invents one:
 *
 *   default   the `-solid` step — 600 for brand, 700 for status
 *   hover     one ramp step DARKER
 *   active    two ramp steps darker
 *
 * The direction is chosen so hover and active can NEVER reduce contrast. A palette whose hover
 * lightens has to prove three ratios per role; this one proves the worst case at `default` and
 * every other state is strictly better.
 */

import { palette as p } from '../primitive/palette.ts';

export const light = {
  // --- surface: what a thing sits on ----------------------------------------
  'color-surface-default': p.white,
  'color-surface-subtle': p.neutral[50],
  'color-surface-sunken': p.neutral[100],
  'color-surface-raised': p.white,
  'color-surface-overlay': p.white,
  'color-surface-inverse': p.neutral[900],
  'color-surface-disabled': p.neutral[100],
  'color-surface-scrim': 'rgb(2 6 23 / 0.60)',
  /**
   * The ground a photograph or video is composited against, and the ONLY surface on which
   * media-overlaid text is permitted — `SCR-WEB-001`'s hero, and gym cover art later.
   *
   * OPAQUE, and identical in both themes. Both properties are the point:
   *
   *   Opaque, because `contrast.proof.ts` refuses translucent colours by design — a ratio
   *   against a scrim depends on the frame behind it, so text over `surface-scrim` on video
   *   cannot be proved, only hoped for. A hero that is legible on the establishing shot and
   *   unreadable four seconds later is exactly the defect `AX4` exists to prevent.
   *
   *   Theme-invariant, because `surface-inverse` FLIPS: it is `neutral-900` in light and
   *   `neutral-100` in dark. Video needs a dark ground in both, so the inverse pair cannot
   *   serve here without going light-on-light in dark mode.
   *
   * Pairs with `content-on-media` at 19.28:1 — `MD1` in `contrast.proof.ts`.
   */
  'color-surface-media': p.neutral[950],
  /** `LC5` — a poll that FAILED must not look like one that is merely a few seconds old. */
  'color-surface-stale': p.amber[50],
  'color-surface-brand-subtle': p.indigo[50],
  'color-surface-success-subtle': p.emerald[50],
  'color-surface-warning-subtle': p.amber[50],
  'color-surface-danger-subtle': p.red[50],
  'color-surface-info-subtle': p.sky[50],

  // --- content: text and icons ----------------------------------------------
  'color-content-primary': p.neutral[900],
  'color-content-secondary': p.neutral[700],
  'color-content-tertiary': p.neutral[600],
  'color-content-muted': p.neutral[500],
  'color-content-disabled': p.neutral[400],
  'color-content-inverse': p.neutral[50],
  'color-content-link': p.indigo[700],
  'color-content-link-hover': p.indigo[800],
  'color-content-link-visited': p.indigo[900],
  'color-content-stale': p.amber[900],
  // NG3 — one guaranteed-legible foreground per solid fill, so `text-white` is never a guess.
  'color-content-on-brand': p.white,
  'color-content-on-success': p.white,
  'color-content-on-warning': p.white,
  'color-content-on-danger': p.white,
  'color-content-on-info': p.white,
  /** The foreground `surface-media` guarantees. Theme-invariant for the same reason it is. */
  'color-content-on-media': p.neutral[50],
  /**
   * The brand, as it may appear ON the media band — an accented word in a hero headline.
   *
   * `indigo-300` rather than the `brand-solid` step, and it is not a preference: `indigo-600` on
   * `#020617` measures **3.21:1** and fails the text floor outright. The band is near-black in
   * both themes, so the accent has to be a LIGHT step in both, which no existing brand token is.
   * 10.12:1 — `MD3`.
   */
  'color-content-on-media-accent': p.indigo[300],
  'color-content-brand': p.indigo[800],
  'color-content-success': p.emerald[800],
  'color-content-warning': p.amber[900],
  'color-content-danger': p.red[800],
  'color-content-info': p.sky[800],

  // --- border: separation and control edges ---------------------------------
  'color-border-subtle': p.neutral[300],
  'color-border-default': p.neutral[400],
  'color-border-strong': p.neutral[500],
  /** `N01` — the border IS the control boundary, so it carries the 3:1 obligation. 4.76:1. */
  'color-border-input': p.neutral[500],
  'color-border-input-hover': p.neutral[600],
  'color-border-focus': p.indigo[600],
  'color-border-brand': p.indigo[600],
  'color-border-success': p.emerald[700],
  'color-border-warning': p.amber[700],
  'color-border-danger': p.red[700],
  'color-border-info': p.sky[700],

  // --- brand: the one persuasive colour -------------------------------------
  'color-brand-solid': p.indigo[600],
  'color-brand-solid-hover': p.indigo[700],
  'color-brand-solid-active': p.indigo[800],
  'color-brand-solid-disabled': p.neutral[100],
  'color-brand-subtle': p.indigo[50],
  'color-brand-subtle-hover': p.indigo[100],

  // --- success: it worked ---------------------------------------------------
  // 700, NOT 600. White on emerald-600 measures 3.77:1 — below the text floor. §3.8 F4.
  'color-success-solid': p.emerald[700],
  'color-success-solid-hover': p.emerald[800],
  'color-success-solid-active': p.emerald[900],
  'color-success-subtle': p.emerald[50],
  'color-success-subtle-hover': p.emerald[100],

  // --- warning: it needs attention soon -------------------------------------
  'color-warning-solid': p.amber[700],
  'color-warning-solid-hover': p.amber[800],
  'color-warning-solid-active': p.amber[900],
  'color-warning-subtle': p.amber[50],
  'color-warning-subtle-hover': p.amber[100],

  // --- danger: it failed, or it destroys ------------------------------------
  'color-danger-solid': p.red[700],
  'color-danger-solid-hover': p.red[800],
  'color-danger-solid-active': p.red[900],
  'color-danger-solid-disabled': p.neutral[100],
  'color-danger-subtle': p.red[50],
  'color-danger-subtle-hover': p.red[100],

  // --- info: neutral disclosure, never a CTA --------------------------------
  'color-info-solid': p.sky[700],
  'color-info-subtle': p.sky[50],

  // --- chart series. `UI2`: the ONE place a series colour is defined ---------
  //
  // Not the status colours. Success / warning / danger are RESERVED: a chart that paints "SaaS
  // subscriptions" in the same green that means "healthy" teaches an operator that a slice is
  // good news, and the next chart that must actually say "good" has nothing left to say it with.
  //
  // Validated against this mode's `surface-default` (#FFFFFF): worst adjacent CVD dE 9.1
  // (protan), normal-vision 22.9. Aqua (2.82:1) and yellow (2.17:1) fall below 3:1, which the
  // palette permits ONLY with relief — so every chart using these must carry visible direct
  // labels. The donut prints its category and value beside each slice for exactly that reason.
  //
  // The ORDER is the colourblind-safety mechanism, not a preference. Assign slots in sequence,
  // never cycle: a fifth series folds into "Other" rather than reusing slot 1.
  'color-viz-series-1': '#2A78D6', // blue
  'color-viz-series-2': '#EB6834', // orange
  'color-viz-series-3': '#1BAF7A', // aqua
  'color-viz-series-4': '#EDA100', // yellow
} as const;

/** The key set both themes must satisfy. `colour.dark.ts` is checked against it in `index.ts`. */
export type ColourTokenKey = keyof typeof light;
