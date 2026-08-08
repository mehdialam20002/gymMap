/**
 * Tier 1 · The non-colour scales — `DesignSystem.md` §5.1, §5.3, §6.1–§6.7.
 *
 * Space, type, radii, sizes, breakpoints, motion and elevation. Same rule as the palette: nothing
 * in `apps/**` names a value here, and the Tailwind preset never emits a primitive class for one.
 */

/**
 * §5.1 · One sans family across all three surfaces.
 *
 * ┌─ DEVANAGARI IS IN THE STACK FROM THE FIRST COMMIT, BEFORE ANY HINDI STRING EXISTS ──────────┐
 * │ `DV1`. The first place Devanagari appears is not a Hindi UI — it is a GYM NAME or a MEMBER   │
 * │ NAME typed in Devanagari into a Latin UI, and that happens on day one in India. Without the  │
 * │ fallback the name renders as tofu (□□□), and the gym owner sees their own business rendered  │
 * │ as boxes.                                                                                     │
 * │                                                                                              │
 * │ Cost of doing it now: one font-stack entry and five layout rules (`DV2`–`DV6`). Cost of      │
 * │ retrofitting: every fixed-height container in fifty-five screens.                             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `TY2` — Inter is SELF-HOSTED and subset. No third-party font CDN: it is a render-blocking
 * dependency on a host outside the India region and a privacy leak (`OQ-16`).
 */
export const fontFamily = {
  sans: [
    'Inter var',
    'Inter',
    'system-ui',
    '-apple-system',
    'Segoe UI',
    'Roboto',
    // DV1. Before any Hindi string exists.
    'Noto Sans Devanagari',
    'Nirmala UI',
    'Noto Sans',
    'Arial',
    'sans-serif',
  ],
  /** `TY4` — member codes, order/invoice references, provider references, audit diffs. Never money. */
  mono: [
    'JetBrains Mono',
    'ui-monospace',
    'SFMono-Regular',
    'Cascadia Mono',
    'Consolas',
    'monospace',
  ],
} as const;

/**
 * §5.2 · Five weights. 100, 200, 300 and 900 are NOT shipped.
 *
 * A 300-weight at 12 px on a bright gym tablet loses effective contrast that the measured ratio
 * does not capture, and shipping unused weights costs bundle bytes against `FP1`.
 */
export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  /** The desk verdict ONLY (§4). */
  heavy: '800',
} as const;

/**
 * §5.3 · The type scale, as TUPLES.
 *
 * `TS1` — size, line-height and tracking ship together, so a component cannot take the size
 * without the leading. Root is 16 px and never overridden: a user who set a larger browser
 * default gets it.
 *
 * `DV3` — minimum line-height 1.45 at or below `base`, 1.5 for `md` body. Recorded as a floor so
 * a future "tighten the tables" ticket cannot violate it.
 */
export const fontSize = {
  /** `TS3` — legal microcopy. NEVER a data value a user must act on. */
  '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
  xs: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.005em' }],
  sm: ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '0' }],
  /** Dashboard and admin body. */
  base: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0' }],
  /** Customer-web body, and EVERY form input on EVERY surface — see `INPUT_FONT_FLOOR_PX`. */
  md: ['1rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
  lg: ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.005em' }],
  xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],
  '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.01em' }],
  '3xl': ['1.875rem', { lineHeight: '2.375rem', letterSpacing: '-0.015em' }],
  '4xl': ['2.25rem', { lineHeight: '2.75rem', letterSpacing: '-0.02em' }],
  '5xl': ['3rem', { lineHeight: '3.5rem', letterSpacing: '-0.02em' }],
  /**
   * `SCR-WEB-001`'s hero headline, and nothing else on any surface.
   *
   * ┌─ NAMED FOR ITS PURPOSE, NOT `6xl`, AND THAT IS THE POINT ─────────────────────────────────┐
   * │ A step called `6xl` is one a dashboard reaches for the moment a metric needs to feel       │
   * │ important. `desk-lg` and `desk-verdict` already set the precedent: a size that exists for  │
   * │ ONE surface carries that surface in its name, so using it anywhere else reads wrong in the │
   * │ diff rather than only in the browser.                                                       │
   * │                                                                                            │
   * │ The leading is BELOW 1 (68/72 = 0.944), which every other step in this scale forbids. A    │
   * │ marketing headline is two or three words on a line and set once; `DV3`'s 1.45 floor is a   │
   * │ rule about READING — running text, in Devanagari, where the shirorekha and matras need the │
   * │ room. It does not apply to a 72px display line and applying it anyway would leave a gap    │
   * │ between the two headline lines wide enough to read as two headings.                        │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  display: ['4.5rem', { lineHeight: '4.25rem', letterSpacing: '-0.035em' }],
  /** Desk member name. */
  'desk-lg': ['2.5rem', { lineHeight: '3rem', letterSpacing: '-0.01em' }],
  /** `ALLOWED` / `DENIED` only. */
  'desk-verdict': ['6rem', { lineHeight: '6.25rem', letterSpacing: '-0.02em' }],
} as const;

/**
 * `TS2` · 16 px on every surface including compact density, and it is a BUG FIX, not a taste.
 *
 * Below 16 px, iOS Safari zooms the viewport on focus — which produces exactly the horizontal
 * scroll `NFR-USE-07` forbids. Exported as a number so the density remap can assert it never
 * drops below this, rather than relying on three tables staying in step.
 */
export const INPUT_FONT_FLOOR_PX = 16;

/** §6.1 · The 4 px base scale. `SP3` — nothing between 0 and 4 except the hairline and the nudge. */
export const space = {
  0: '0px',
  px: '1px',
  '0-5': '0.125rem',
  1: '0.25rem',
  '1-5': '0.375rem',
  2: '0.5rem',
  '2-5': '0.625rem',
  3: '0.75rem',
  /** The default gutter. */
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const;

/** §6.3 · Radii. `radius-control` is the most used token in the system. */
export const radius = {
  none: '0px',
  xs: '0.125rem',
  sm: '0.25rem',
  /**
   * 12px. The reference's `rounded-xl`, and it is on nearly every control on the screen.
   *
   * Was 6px. A 6px radius on a 36px-tall input reads as "a rectangle with the corners taken off";
   * 12px reads as a considered shape. `ADR-0037` makes the radius step the designer's call.
   */
  control: '0.75rem',
  md: '0.5rem',
  /** 16px. The reference's `rounded-2xl`. Was 12px, which is now what a CONTROL uses. */
  card: '1rem',
  lg: '1rem',
  desk: '1.25rem',
  full: '9999px',
} as const;

/**
 * §6.2 · Sizing.
 *
 * `size-target-min` is 44 px at EVERY density — compact paints 36 px and expands the HIT area
 * (§7.4 `HT1`). The paint may shrink with density; the target may not.
 */
export const size = {
  'target-min': '44px',
  'control-sm': '32px',
  'control-md': '36px',
  'control-lg': '44px',
  'control-xl': '56px',
  'control-desk': '64px',
  'icon-xs': '12px',
  'icon-sm': '16px',
  'icon-md': '20px',
  'icon-lg': '24px',
  'icon-xl': '32px',
  'icon-desk-verdict': '128px',
  'avatar-xs': '24px',
  'avatar-sm': '32px',
  'avatar-md': '40px',
  'avatar-lg': '56px',
  'avatar-xl': '96px',
  /** Below this, scanning from a phone screen held at a reader becomes unreliable. */
  'qr-min': '240px',
  'qr-desk': '320px',
} as const;

/** `NFR-USE-03` / `AX3`. A floor at every density, never remapped. */
export const TOUCH_TARGET_MIN_PX = 44;

/** §5.4 · Measure. An input wider than its longest plausible value is a usability defect. */
export const measure = {
  prose: '68ch',
  form: '44ch',
  ui: '52ch',
} as const;

/**
 * §6.4 · Elevation. Shadow colour is `neutral-950` at low alpha, NEVER pure black — a pure-black
 * shadow over cool neutral surfaces reads muddy.
 *
 * Dark mode suppresses these entirely and expresses elevation as surface LIGHTNESS (§9.4): a
 * `rgb(2 6 23 / 0.1)` shadow on a `#0F172A` canvas is invisible, so the cue must change technique
 * rather than intensity.
 *
 * Shadow is NEVER used to convey status. A card with an error gets `border-danger` and an inline
 * message (`NFR-USE-05`), not a red glow.
 */
export const shadow = {
  none: 'none',
  xs: '0 1px 2px 0 rgb(2 6 23 / 0.05)',
  sm: '0 1px 3px 0 rgb(2 6 23 / 0.10), 0 1px 2px -1px rgb(2 6 23 / 0.10)',
  md: '0 4px 6px -1px rgb(2 6 23 / 0.10), 0 2px 4px -2px rgb(2 6 23 / 0.10)',
  lg: '0 10px 15px -3px rgb(2 6 23 / 0.10), 0 4px 6px -4px rgb(2 6 23 / 0.10)',
  xl: '0 20px 25px -5px rgb(2 6 23 / 0.12), 0 8px 10px -6px rgb(2 6 23 / 0.10)',
} as const;

/**
 * §6.5 · Eleven named layers. `TK1` removes Tailwind's numeric `z-*` utilities entirely, so
 * `z-[9999]` is not merely discouraged — it does not compile.
 *
 * Two orderings here are load-bearing and counter-intuitive:
 *   popover ABOVE dialog  — a `Select` inside a dialog is the single most common z-index bug in
 *                           shadcn-derived stacks.
 *   toast ABOVE dialog    — a "payout failed" toast must not be hidden behind a modal.
 */
export const zIndex = {
  base: '0',
  raised: '10',
  'sticky-cell': '20',
  'sticky-section': '100',
  'app-chrome': '200',
  /** Above app chrome so the verdict is never partly behind a nav bar; below dialog so the
   *  override-reason dialog opens on top of it. */
  'desk-verdict': '300',
  scrim: '400',
  sheet: '410',
  dialog: '500',
  popover: '600',
  toast: '700',
  tooltip: '800',
  /** Must be visible over everything, always (`AX2`). */
  'skip-link': '900',
} as const;

/** §6.6 · Motion. `MO2` — exit is always faster than enter; a user dismissing has already decided. */
export const motion = {
  duration: {
    instant: '0ms',
    fast: '120ms',
    base: '180ms',
    slow: '260ms',
    /** The desk verdict panel and the checkout confirmation reveal. */
    deliberate: '400ms',
  },
  ease: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    enter: 'cubic-bezier(0, 0, 0, 1)',
    exit: 'cubic-bezier(0.3, 0, 1, 1)',
    linear: 'linear',
  },
} as const;

/**
 * §6.7 · Breakpoints. `BP4` — these are the ONLY permitted media-query widths in `apps/**`;
 * `@media (min-width: 900px)` is an arbitrary value under `TK3`.
 *
 * `BP5` — `@media (pointer: coarse)` is a CAPABILITY query, not a breakpoint, and is permitted
 * anywhere. It drives the compact-to-comfortable promotion of §7.4 `HT2`: a gym owner on an iPad
 * gets 44 px painted controls even though the viewport says `screen-lg`. Viewport width is not an
 * input device.
 */
export const screens = {
  base: '320px',
  sm: '640px',
  /** The check-in desk's design target. */
  md: '768px',
  lg: '1024px',
  /** The dashboard's design target. */
  xl: '1280px',
  '2xl': '1536px',
  '3xl': '1920px',
} as const;

/**
 * `BP3` · Above this the layout does not stretch; the page gains margin, not measure.
 *
 * A 2560 px settlement table with 12 columns spread edge to edge is unreadable; the same table
 * centred at 1440 px is not.
 */
export const CONTAINER_MAX = '1440px';
