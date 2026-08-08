/**
 * Tier 2 · The dark-theme mapping — `DesignSystem.md` §9.3.
 *
 * SAME keys as `colour.light.ts`, different references. `semantic/index.ts` type-checks the two
 * against each other, so "we forgot the dark value" is a compile error (§9.2 `DM`).
 *
 * ┌─ THREE INVERSIONS THAT ARE NOT MISTAKES ────────────────────────────────────────────────────┐
 * │ `surface-subtle` is DARKER than `surface-default` here. In light, "subtle" recedes by going  │
 * │ lighter; in dark it recedes by going darker. The direction inverts; the meaning does not.    │
 * │                                                                                              │
 * │ Solid fills LIGHTEN and take DARK foregrounds. `content-on-brand` is `#020617`, not white —  │
 * │ that inversion is what keeps the button legible: 6.29:1 light, 6.76:1 dark.                  │
 * │                                                                                              │
 * │ Elevation stops being shadow and becomes LIGHTNESS. A `rgb(2 6 23 / 0.1)` shadow on a        │
 * │ `#0F172A` canvas is invisible, so `surface-raised` lifts instead (§9.4).                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The canvas is `neutral-900`, not `#000000`. Pure black maximises halation around light text on
 * OLED and makes elevation impossible to express. `content-primary` is `#F8FAFC` rather than pure
 * white for the same family of reason: white on `#0F172A` is 18.4:1 and visibly harsh at body size.
 *
 * What does NOT change: the hue family of every role, the §3.10 status mapping, the contrast
 * floors, and — see `component/desk.ts` — the check-in verdict's polarity.
 */

import { palette as p } from '../primitive/palette.ts';
import type { ColourTokenKey } from './colour.light.ts';

export const dark = {
  // --- surface --------------------------------------------------------------
  'color-surface-default': p.neutral[900],
  // Inverted direction. Subtle recedes by going darker on a dark canvas. Between neutral-900 and
  // neutral-950 on the same olive axis; the ramp has no step there and inventing one for a single
  // role would put an unproved value in Tier 1.
  'color-surface-subtle': '#0F100E',
  'color-surface-sunken': p.neutral[950],
  // Elevation is lightness, not shadow.
  'color-surface-raised': p.neutral[800],
  'color-surface-overlay': p.neutral[800],
  'color-surface-inverse': p.neutral[100],
  'color-surface-disabled': p.neutral[800],
  // Darker than light mode's scrim: the gap between scrim and canvas is smaller here.
  'color-surface-scrim': 'rgb(2 6 23 / 0.75)',
  /**
   * IDENTICAL to the light value, and one of only two tokens in this file that does not move.
   *
   * Every other surface flips because the canvas flips. This one does not, because what it sits
   * behind does not: a photograph and a video need a dark ground in both themes. Inverting it
   * would put light text on a light band in dark mode, and `surface-inverse` — the token that
   * looks like the right answer — is exactly the one that does this.
   */
  'color-surface-media': p.neutral[950],
  'color-surface-stale': p.amber[950],
  // Status fills go OPAQUE at the 900/950 step. A translucent status fill over a dark canvas
  // produces a muddy, unpredictable ratio; an opaque one is measurable.
  'color-surface-brand-subtle': p.brandGreen[950],
  'color-surface-success-subtle': p.green[950],
  'color-surface-warning-subtle': p.amber[950],
  'color-surface-danger-subtle': p.red[950],
  'color-surface-info-subtle': p.sky[950],

  // --- content --------------------------------------------------------------
  'color-content-primary': p.neutral[50],
  'color-content-secondary': p.neutral[200],
  'color-content-tertiary': p.neutral[300],
  'color-content-muted': p.neutral[400],
  'color-content-disabled': p.neutral[600],
  'color-content-inverse': p.neutral[900],
  // Links lighten by four ramp steps, not two — indigo darkens fast.
  'color-content-link': p.brandGreen[300],
  'color-content-link-hover': p.brandGreen[200],
  'color-content-link-visited': p.brandGreen[400],
  'color-content-stale': p.amber[300],
  // The inversion: dark foregrounds on lightened solids.
  'color-content-on-brand': p.white,
  'color-content-on-success': p.neutral[950],
  'color-content-on-warning': p.neutral[950],
  'color-content-on-danger': p.neutral[950],
  'color-content-on-info': p.neutral[950],
  /** The second token that does not flip. See `color-surface-media` above. */
  'color-content-on-media': p.neutral[50],
  /** The third, and the same reason: the band is `rich black` in both themes. `MD3`, 15.60:1. */
  'color-content-on-media-accent': p.brandGreen[400],
  // Status TEXT lightens to the 300 step.
  'color-content-brand': p.brandGreen[300],
  'color-content-success': p.green[300],
  'color-content-warning': p.amber[300],
  'color-content-danger': p.red[300],
  'color-content-info': p.sky[300],

  // --- border ---------------------------------------------------------------
  'color-border-subtle': p.neutral[700],
  'color-border-default': p.neutral[600],
  'color-border-strong': p.neutral[500],
  // UNCHANGED from light. It is the one border that must clear 3:1 on BOTH canvases, and
  // #64748B does: 4.76:1 light, 3.75:1 dark.
  'color-border-input': p.neutral[500],
  'color-border-input-hover': p.neutral[400],
  'color-border-focus': p.brandGreen[400],
  'color-border-brand': p.brandGreen[400],
  'color-border-success': p.green[400],
  'color-border-warning': p.amber[400],
  'color-border-danger': p.red[400],
  'color-border-info': p.sky[400],

  // --- brand ----------------------------------------------------------------
  // ┌─ THE SAME 700 AS LIGHT, AND HOVER DEEPENS IN BOTH THEMES ─────────────────────────────────┐
  // │ The foreground sits on the FILL, so the canvas behind it does not enter that pairing — which │
  // │ means the 4.5:1 floor lands on the fill identically in both themes.                          │
  // │                                                                                            │
  // │ The instinct on a dark canvas is to LIGHTEN on hover so the control stands out. Here that   │
  // │ would move the fill to 600, where white is 3.77:1 — reducing contrast on hover AND crossing │
  // │ below the floor, which §3.5 forbids outright. Deepening keeps white legible, and 800 against │
  // │ a `#020617` canvas is still obviously a green rather than sinking into it.                    │
  // └────────────────────────────────────────────────────────────────────────────────────────────┘
  'color-brand-solid': p.brandGreen[700],
  'color-brand-solid-hover': p.brandGreen[800],
  'color-brand-solid-active': p.brandGreen[900],
  'color-brand-solid-disabled': p.neutral[800],
  'color-brand-subtle': p.brandGreen[950],
  'color-brand-subtle-hover': p.brandGreen[900],

  // --- success --------------------------------------------------------------
  'color-success-solid': p.green[400],
  'color-success-solid-hover': p.green[300],
  'color-success-solid-active': p.green[200],
  'color-success-subtle': p.emerald[950],
  'color-success-subtle-hover': p.emerald[900],

  // --- warning --------------------------------------------------------------
  'color-warning-solid': p.amber[400],
  'color-warning-solid-hover': p.amber[300],
  'color-warning-solid-active': p.amber[200],
  'color-warning-subtle': p.amber[950],
  'color-warning-subtle-hover': p.amber[900],

  // --- danger ---------------------------------------------------------------
  'color-danger-solid': p.red[400],
  'color-danger-solid-hover': p.red[300],
  'color-danger-solid-active': p.red[200],
  'color-danger-solid-disabled': p.neutral[800],
  'color-danger-subtle': p.red[950],
  'color-danger-subtle-hover': p.red[900],

  // --- info -----------------------------------------------------------------
  'color-info-solid': p.sky[400],
  'color-info-subtle': p.sky[950],

  // --- chart series ----------------------------------------------------------
  //
  // SELECTED for the dark surface, not the light values with a filter over them: the same four
  // hues, re-stepped. Validated against this mode's `surface-default` (#0F172A): worst adjacent
  // CVD dE 8.4 (protan), normal-vision 19.8, and all four clear 3:1 — so dark carries no relief
  // obligation where light does. See `colour.light.ts` for the ordering rule.
  'color-viz-series-1': '#3987E5',
  'color-viz-series-2': '#D95926',
  'color-viz-series-3': '#199E70',
  'color-viz-series-4': '#C98500',
} as const satisfies Record<ColourTokenKey, string>;
