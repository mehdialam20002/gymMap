/**
 * The one theme any app gets — `DesignSystem.md` §2.4. A-03.
 *
 * ┌─ `theme` IS REPLACED, NOT EXTENDED, AND THAT IS THE WHOLE MECHANISM ────────────────────────┐
 * │ `TK1`. Tailwind's stock `slate-500`, `p-7` and `z-[999]` do not resolve in `apps/**` — not   │
 * │ because a lint rule complains, but because the class does not exist. A missing class is a    │
 * │ build-visible failure; a lint rule is a thing people disable at 6pm.                          │
 * │                                                                                              │
 * │ `TK5` follows from the same fact: primitive names (`gm-indigo-*`, `gm-space-*`) are never    │
 * │ emitted, so an app CANNOT reach Tier 1. That is what makes "text-indigo-600 in a feature      │
 * │ file" — which compiles, renders correctly, and silently opts one element out of dark mode    │
 * │ and out of the §3.6 contrast proof — structurally impossible rather than merely forbidden.   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Every value below is `var(--gm-…)`. No hex and no px literal appears in this file: the values
 * live in `tokens.css`, generated from the TypeScript sources, and this preset only names them.
 *
 * `TK2` — an app declares `presets: [preset]` and `content`, and nothing else. An app that adds a
 * `theme` key fails review, because tokens are defined once (`UI2`).
 */

import type { Config } from 'tailwindcss';

import { fontSize, screens } from './src/tokens/primitive/scale.ts';

const v = (token: string) => `var(--gm-${token})`;

/** §3.3's eight role groups, as Tailwind colour keys. */
/** The chart series palette. See `tokens.css` for the validation record and the relief rule. */
const viz = {
  1: v('color-viz-series-1'),
  2: v('color-viz-series-2'),
  3: v('color-viz-series-3'),
  4: v('color-viz-series-4'),
} as const;

const colors = {
  viz,
  transparent: 'transparent',
  current: 'currentColor',
  inherit: 'inherit',

  surface: {
    DEFAULT: v('color-surface-default'),
    subtle: v('color-surface-subtle'),
    sunken: v('color-surface-sunken'),
    raised: v('color-surface-raised'),
    overlay: v('color-surface-overlay'),
    inverse: v('color-surface-inverse'),
    disabled: v('color-surface-disabled'),
    scrim: v('color-surface-scrim'),
    // Opaque and theme-invariant — the only surface media-overlaid text may sit on (MD1).
    media: v('color-surface-media'),
    stale: v('color-surface-stale'),
    'brand-subtle': v('color-surface-brand-subtle'),
    'success-subtle': v('color-surface-success-subtle'),
    'warning-subtle': v('color-surface-warning-subtle'),
    'danger-subtle': v('color-surface-danger-subtle'),
    'info-subtle': v('color-surface-info-subtle'),
  },

  content: {
    DEFAULT: v('color-content-primary'),
    primary: v('color-content-primary'),
    secondary: v('color-content-secondary'),
    tertiary: v('color-content-tertiary'),
    muted: v('color-content-muted'),
    disabled: v('color-content-disabled'),
    inverse: v('color-content-inverse'),
    link: v('color-content-link'),
    'link-hover': v('color-content-link-hover'),
    'link-visited': v('color-content-link-visited'),
    stale: v('color-content-stale'),
    // NG3 — the guaranteed-legible foreground for each fill, so `text-white` is never a guess.
    'on-brand': v('color-content-on-brand'),
    'on-success': v('color-content-on-success'),
    'on-warning': v('color-content-on-warning'),
    'on-danger': v('color-content-on-danger'),
    'on-info': v('color-content-on-info'),
    'on-media': v('color-content-on-media'),
    'on-media-accent': v('color-content-on-media-accent'),
    brand: v('color-content-brand'),
    success: v('color-content-success'),
    warning: v('color-content-warning'),
    danger: v('color-content-danger'),
    info: v('color-content-info'),
  },

  border: {
    DEFAULT: v('color-border-default'),
    subtle: v('color-border-subtle'),
    strong: v('color-border-strong'),
    input: v('color-border-input'),
    'input-hover': v('color-border-input-hover'),
    focus: v('color-border-focus'),
    brand: v('color-border-brand'),
    success: v('color-border-success'),
    warning: v('color-border-warning'),
    danger: v('color-border-danger'),
    info: v('color-border-info'),
    // The faint variants, for a line around a `*-subtle` fill. See the note in colour.light.ts:
    // the 700 steps measure 4.84-5.57:1 on their own fill, which is an outline rather than a seam.
    'brand-subtle': v('color-border-brand-subtle'),
    'success-subtle': v('color-border-success-subtle'),
    'warning-subtle': v('color-border-warning-subtle'),
    'danger-subtle': v('color-border-danger-subtle'),
    'info-subtle': v('color-border-info-subtle'),
  },

  brand: {
    DEFAULT: v('color-brand-solid'),
    solid: v('color-brand-solid'),
    'solid-hover': v('color-brand-solid-hover'),
    'solid-active': v('color-brand-solid-active'),
    'solid-disabled': v('color-brand-solid-disabled'),
    subtle: v('color-brand-subtle'),
    'subtle-hover': v('color-brand-subtle-hover'),
  },
  success: {
    DEFAULT: v('color-success-solid'),
    solid: v('color-success-solid'),
    'solid-hover': v('color-success-solid-hover'),
    'solid-active': v('color-success-solid-active'),
    subtle: v('color-success-subtle'),
    'subtle-hover': v('color-success-subtle-hover'),
  },
  warning: {
    DEFAULT: v('color-warning-solid'),
    solid: v('color-warning-solid'),
    'solid-hover': v('color-warning-solid-hover'),
    'solid-active': v('color-warning-solid-active'),
    subtle: v('color-warning-subtle'),
    'subtle-hover': v('color-warning-subtle-hover'),
  },
  danger: {
    DEFAULT: v('color-danger-solid'),
    solid: v('color-danger-solid'),
    'solid-hover': v('color-danger-solid-hover'),
    'solid-active': v('color-danger-solid-active'),
    'solid-disabled': v('color-danger-solid-disabled'),
    subtle: v('color-danger-subtle'),
    'subtle-hover': v('color-danger-subtle-hover'),
  },
  info: {
    DEFAULT: v('color-info-solid'),
    solid: v('color-info-solid'),
    subtle: v('color-info-subtle'),
  },

  // The desk owns its own namespace (§NG5's one exception) and its verdict values are identical
  // in both themes — see component/index.ts for why a theme toggle must not invert them.
  desk: {
    'allow-fill': v('desk-verdict-allow-fill'),
    'allow-content': v('desk-verdict-allow-content'),
    'deny-fill': v('desk-verdict-deny-fill'),
    'deny-content': v('desk-verdict-deny-content'),
    'offline-fill': v('desk-offline-fill'),
    'offline-content': v('desk-offline-content'),
  },
} as const;

/**
 * §6.1 `SP1` — only the SEMANTIC families are exposed. `p-4` does not exist; `p-inset-md` does.
 *
 * That is what makes density a remap: `p-inset-md` resolves through `--gm-space-inset-md`, which
 * `[data-density]` overrides. A `p-4` would have pinned 16 px at every density.
 */
const spacing = {
  0: '0px',
  px: v('space-px'),
  'inset-2xs': v('space-inset-2xs'),
  'inset-xs': v('space-inset-xs'),
  'inset-sm': v('space-inset-sm'),
  'inset-md': v('space-inset-md'),
  'inset-lg': v('space-inset-lg'),
  'inset-xl': v('space-inset-xl'),
  'stack-2xs': v('space-stack-2xs'),
  'stack-xs': v('space-stack-xs'),
  'stack-sm': v('space-stack-sm'),
  'stack-md': v('space-stack-md'),
  'stack-lg': v('space-stack-lg'),
  'stack-xl': v('space-stack-xl'),
  'stack-2xl': v('space-stack-2xl'),
  'inline-2xs': v('space-inline-2xs'),
  'inline-xs': v('space-inline-xs'),
  'inline-sm': v('space-inline-sm'),
  'inline-md': v('space-inline-md'),
  'inline-lg': v('space-inline-lg'),
  'inline-xl': v('space-inline-xl'),
  'region-sm': v('space-region-sm'),
  'region-md': v('space-region-md'),
  'region-lg': v('space-region-lg'),
  'region-xl': v('space-region-xl'),
  // Component-tier sizes that are legitimately used as dimensions.
  'control-height': v('control-height'),
  'input-height': v('input-height'),
  'row-height': v('table-row-height'),
  'target-min': v('size-target-min'),
  icon: v('icon-size'),
  avatar: v('avatar-default'),
} as const;

/**
 * `TS1` — each step ships as a TUPLE, so a component cannot take the size without the leading.
 *
 * Built by mapping over the token keys rather than written out, so a step added to the scale is
 * automatically available as a Tailwind class. The explicit tuple type is load-bearing:
 * `Object.fromEntries` widens to `(string | object)[]`, which Tailwind's `fontSize` rejects — and
 * the array form is exactly what carries the line-height, so widening it away would silently drop
 * the leading from every class.
 */
type FontSizeValue = [string, { lineHeight: string; letterSpacing: string }];

const themeFontSize: Record<string, FontSizeValue> = Object.fromEntries(
  Object.keys(fontSize).map((key): [string, FontSizeValue] => [
    key,
    [
      v(`font-size-${key}`),
      { lineHeight: v(`line-height-${key}`), letterSpacing: v(`tracking-${key}`) },
    ],
  ]),
);

export const preset = {
  // TK6 — one switch. `data-theme` on <html>; `dark:` utilities keep working for the two
  // non-colour cases (§9.4 shadow suppression and image treatment) without a class soup.
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    // REPLACED, not extended. See the header.
    colors,
    spacing,
    screens,
    fontSize: themeFontSize,
    fontFamily: {
      sans: [v('font-sans')],
      mono: [v('font-mono')],
    },
    fontWeight: {
      regular: v('font-weight-regular'),
      medium: v('font-weight-medium'),
      semibold: v('font-weight-semibold'),
      bold: v('font-weight-bold'),
      // The desk verdict only.
      heavy: v('font-weight-heavy'),
    },
    borderRadius: {
      none: v('radius-none'),
      xs: v('radius-xs'),
      sm: v('radius-sm'),
      control: v('radius-control'),
      md: v('radius-md'),
      card: v('radius-card'),
      lg: v('radius-lg'),
      desk: v('radius-desk'),
      full: v('radius-full'),
    },
    boxShadow: {
      none: v('shadow-none'),
      xs: v('shadow-xs'),
      sm: v('shadow-sm'),
      md: v('shadow-md'),
      lg: v('shadow-lg'),
      xl: v('shadow-xl'),
    },
    // §6.5 — eleven named layers. No numeric z utilities exist, so `z-[9999]` does not compile.
    zIndex: {
      base: v('z-base'),
      raised: v('z-raised'),
      'sticky-cell': v('z-sticky-cell'),
      'sticky-section': v('z-sticky-section'),
      'app-chrome': v('z-app-chrome'),
      'desk-verdict': v('z-desk-verdict'),
      scrim: v('z-scrim'),
      sheet: v('z-sheet'),
      dialog: v('z-dialog'),
      popover: v('z-popover'),
      toast: v('z-toast'),
      tooltip: v('z-tooltip'),
      'skip-link': v('z-skip-link'),
    },
    transitionDuration: {
      instant: v('motion-duration-instant'),
      fast: v('motion-duration-fast'),
      base: v('motion-duration-base'),
      slow: v('motion-duration-slow'),
      deliberate: v('motion-duration-deliberate'),
    },
    transitionTimingFunction: {
      standard: v('motion-ease-standard'),
      enter: v('motion-ease-enter'),
      exit: v('motion-ease-exit'),
      linear: v('motion-ease-linear'),
    },
    // §5.4 — an input wider than its longest plausible value is a usability defect.
    maxWidth: {
      prose: v('measure-prose'),
      form: v('measure-form'),
      ui: v('measure-ui'),
      container: v('container-max'),
      full: '100%',
    },
    extend: {
      minHeight: { target: v('size-target-min'), 'desk-verdict': v('desk-verdict-min-height') },
      minWidth: { target: v('size-target-min') },
      aspectRatio: { desk: v('desk-camera-aspect') },
    },
  },
} satisfies Partial<Config>;

export default preset;
