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
  // Inverted direction. Subtle recedes by going darker on a dark canvas.
  'color-surface-subtle': '#0B1120',
  'color-surface-sunken': p.neutral[950],
  // Elevation is lightness, not shadow.
  'color-surface-raised': p.neutral[800],
  'color-surface-overlay': p.neutral[800],
  'color-surface-inverse': p.neutral[100],
  'color-surface-disabled': p.neutral[800],
  // Darker than light mode's scrim: the gap between scrim and canvas is smaller here.
  'color-surface-scrim': 'rgb(2 6 23 / 0.75)',
  'color-surface-stale': p.amber[950],
  // Status fills go OPAQUE at the 900/950 step. A translucent status fill over a dark canvas
  // produces a muddy, unpredictable ratio; an opaque one is measurable.
  'color-surface-brand-subtle': p.indigo[950],
  'color-surface-success-subtle': p.emerald[950],
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
  'color-content-link': p.indigo[300],
  'color-content-link-hover': p.indigo[200],
  'color-content-link-visited': p.indigo[400],
  'color-content-stale': p.amber[300],
  // The inversion: dark foregrounds on lightened solids.
  'color-content-on-brand': p.neutral[950],
  'color-content-on-success': p.neutral[950],
  'color-content-on-warning': p.neutral[950],
  'color-content-on-danger': p.neutral[950],
  'color-content-on-info': p.neutral[950],
  // Status TEXT lightens to the 300 step.
  'color-content-brand': p.indigo[300],
  'color-content-success': p.emerald[300],
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
  'color-border-focus': p.indigo[400],
  'color-border-brand': p.indigo[400],
  'color-border-success': p.emerald[400],
  'color-border-warning': p.amber[400],
  'color-border-danger': p.red[400],
  'color-border-info': p.sky[400],

  // --- brand ----------------------------------------------------------------
  'color-brand-solid': p.indigo[400],
  'color-brand-solid-hover': p.indigo[300],
  'color-brand-solid-active': p.indigo[200],
  'color-brand-solid-disabled': p.neutral[800],
  'color-brand-subtle': p.indigo[950],
  'color-brand-subtle-hover': p.indigo[900],

  // --- success --------------------------------------------------------------
  'color-success-solid': p.emerald[400],
  'color-success-solid-hover': p.emerald[300],
  'color-success-solid-active': p.emerald[200],
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
} as const satisfies Record<ColourTokenKey, string>;
