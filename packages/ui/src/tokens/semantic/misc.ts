/**
 * Tier 2 · Radius, elevation, motion, typography and layers — `DesignSystem.md` §6.3–§6.6, §5.
 *
 * One file rather than five, because unlike colour and space these groups are thin pass-throughs
 * of Tier 1 with a naming change, and five files of six lines each would be structure for its own
 * sake. Colour and space earn their own files: colour has two themes to keep in step, and space
 * has three families that density remaps.
 */

import {
  CONTAINER_MAX,
  fontFamily,
  fontSize,
  fontWeight,
  measure,
  motion,
  radius,
  screens,
  shadow,
  size,
  zIndex,
} from '../primitive/scale.ts';

export const semanticRadius = {
  'radius-none': radius.none,
  'radius-xs': radius.xs,
  'radius-sm': radius.sm,
  /** Buttons, inputs, selects — the most used token in the system. */
  'radius-control': radius.control,
  'radius-md': radius.md,
  'radius-card': radius.card,
  'radius-lg': radius.lg,
  'radius-desk': radius.desk,
  'radius-full': radius.full,
} as const;

/**
 * The §6.3 nesting rule, as a function rather than as prose.
 *
 * An inner radius is the outer radius minus the padding between them, floored at `radius-xs`.
 * Concentric radii read as machined; equal radii read as a mistake — a `radius-card` (12) panel
 * with 12 px padding contains `radius-control` (6) controls, not 12.
 */
export function nestedRadiusPx(outerPx: number, paddingPx: number): number {
  const RADIUS_XS_PX = 2;
  return Math.max(RADIUS_XS_PX, outerPx - paddingPx);
}

export const semanticElevation = {
  'shadow-none': shadow.none,
  'shadow-xs': shadow.xs,
  'shadow-sm': shadow.sm,
  'shadow-md': shadow.md,
  'shadow-lg': shadow.lg,
  'shadow-xl': shadow.xl,
} as const;

export const semanticMotion = {
  'motion-duration-instant': motion.duration.instant,
  'motion-duration-fast': motion.duration.fast,
  'motion-duration-base': motion.duration.base,
  'motion-duration-slow': motion.duration.slow,
  'motion-duration-deliberate': motion.duration.deliberate,
  'motion-ease-standard': motion.ease.standard,
  'motion-ease-enter': motion.ease.enter,
  'motion-ease-exit': motion.ease.exit,
  'motion-ease-linear': motion.ease.linear,
} as const;

/**
 * `RM1` · Reduced motion collapses the DURATION tokens in one place, rather than a
 * `motion-reduce:` variant per component — one place, no omissions.
 *
 * `1ms` and not `0` so that `transitionend` handlers still fire. Code that waits for a transition
 * to finish before removing a node would hang forever at `0`, which turns an accessibility
 * preference into a broken UI — the opposite of the point.
 *
 * `RM2` — this removes MOVEMENT, not FEEDBACK. Hover still changes colour, a dialog still
 * appears, a toast still shows. Only the travel and the shimmer go.
 */
export const reducedMotionOverrides = {
  'motion-duration-fast': '1ms',
  'motion-duration-base': '1ms',
  'motion-duration-slow': '1ms',
  'motion-duration-deliberate': '1ms',
} as const;

export const semanticZIndex = zIndex;

export const semanticTypography = {
  fontFamily,
  fontSize,
  fontWeight,
  measure,
} as const;

export const semanticSize = {
  ...Object.fromEntries(Object.entries(size).map(([k, v]) => [`size-${k}`, v])),
  'container-max': CONTAINER_MAX,
  'measure-prose': measure.prose,
  'measure-form': measure.form,
  'measure-ui': measure.ui,
} as Record<string, string>;

export const semanticScreens = screens;
