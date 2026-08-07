/**
 * Density — `DesignSystem.md` §7. Three modes, one palette.
 *
 * > **Density changes size. It never changes colour, and it never changes meaning.**
 *
 * A DANGER badge on the customer site, in the member table and on the check-in desk is the same
 * hue, the same semantic token and the same icon. It is 24 px, 20 px and 40 px tall respectively.
 * That is the entire permitted difference. A density mode that reaches for a different red has
 * stopped being a density mode and is a second design system.
 *
 * Each mode below overrides Tier 3 ONLY. Nothing here names a colour, and `density.spec.ts`
 * asserts that — the enforcement has to be mechanical, because "don't put a colour in the density
 * map" is exactly the rule a hurried change breaks.
 */

/**
 * The keys density is allowed to touch.
 *
 * A closed list rather than "whatever the mode object happens to contain", so adding a remap is a
 * deliberate edit to this array that a reviewer sees, not a line appearing in three objects.
 */
export const REMAPPABLE_KEYS = [
  'control-height',
  'control-inset-x',
  'control-font',
  'input-height',
  'input-font',
  'table-row-height',
  'table-cell-inset-x',
  'table-header-height',
  'card-inset',
  'card-gap',
  'icon-size',
  'body-font',
  'focus-ring-width',
  'badge-height',
  'avatar-default',
  'section-gap',
] as const;

export type RemappableKey = (typeof REMAPPABLE_KEYS)[number];
type DensityMap = Record<RemappableKey, string>;

/** All of `customer-web`; both dashboards below `screen-md`; anywhere `pointer: coarse` (`HT2`). */
export const comfortable: DensityMap = {
  'control-height': '44px',
  'control-inset-x': 'var(--gm-space-inset-md)',
  'control-font': 'var(--gm-font-size-md)',
  'input-height': '44px',
  'input-font': 'var(--gm-font-size-md)',
  'table-row-height': '56px',
  'table-cell-inset-x': 'var(--gm-space-inset-md)',
  'table-header-height': '48px',
  'card-inset': 'var(--gm-space-inset-lg)',
  'card-gap': 'var(--gm-space-stack-lg)',
  'icon-size': '20px',
  'body-font': 'var(--gm-font-size-md)',
  'focus-ring-width': '2px',
  'badge-height': '24px',
  'avatar-default': '40px',
  'section-gap': 'var(--gm-space-inset-xl)',
};

/**
 * Both dashboards at `screen-md` and above, EXCEPT the check-in desk.
 *
 * The row-height arithmetic is the argument: at 40 px, a 50-row page is 2000 px plus a 36 px
 * header — roughly two viewport heights at 1080 px, which is what makes virtualised scrolling
 * worth its complexity. At the comfortable 56 px it would be 2800 px, and the owner scrolls 40%
 * further to find the same expiring member.
 */
export const compact: DensityMap = {
  // Paints 36 px. The POINTER target stays 44 px via the expanded hit area (§7.4 `HT1`).
  'control-height': '36px',
  'control-inset-x': 'var(--gm-space-inset-sm)',
  'control-font': 'var(--gm-font-size-base)',
  'input-height': '40px',
  // NOT remapped down. TS2 holds at every density — see the note in component/index.ts.
  'input-font': 'var(--gm-font-size-md)',
  'table-row-height': '40px',
  'table-cell-inset-x': 'var(--gm-space-inset-sm)',
  'table-header-height': '36px',
  'card-inset': 'var(--gm-space-inset-md)',
  'card-gap': 'var(--gm-space-stack-md)',
  'icon-size': '16px',
  'body-font': 'var(--gm-font-size-base)',
  'focus-ring-width': '2px',
  'badge-height': '20px',
  'avatar-default': '32px',
  'section-gap': 'var(--gm-space-inset-lg)',
};

/** `SCR-DASH-009` only. One hand, a tablet in portrait, at arm's length, in a bright room. */
export const oversized: DensityMap = {
  'control-height': '64px',
  'control-inset-x': 'var(--gm-space-inset-lg)',
  'control-font': 'var(--gm-font-size-xl)',
  'input-height': '64px',
  'input-font': 'var(--gm-font-size-xl)',
  'table-row-height': '72px',
  'table-cell-inset-x': 'var(--gm-space-inset-md)',
  'table-header-height': '64px',
  'card-inset': 'var(--gm-space-inset-xl)',
  'card-gap': 'var(--gm-space-stack-lg)',
  'icon-size': '32px',
  'body-font': 'var(--gm-font-size-xl)',
  // FR3 — 2 px at 40 cm, 3 px at 70 cm.
  'focus-ring-width': '3px',
  'badge-height': '40px',
  'avatar-default': '96px',
  'section-gap': 'var(--gm-space-inset-xl)',
};

export const DENSITIES = ['comfortable', 'compact', 'oversized'] as const;
export type Density = (typeof DENSITIES)[number];

export const densities: Record<Density, DensityMap> = { comfortable, compact, oversized };
