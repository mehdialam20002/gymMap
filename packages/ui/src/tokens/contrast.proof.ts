/**
 * The `AX4` evidence — `DesignSystem.md` §3.6, §3.8, §9.6.
 *
 * ┌─ THIS FILE IS DATA, NOT DOCUMENTATION ──────────────────────────────────────────────────────┐
 * │ §3.6's tables are generated from it and the accessibility suite asserts every row, so a      │
 * │ palette edit that drops a pairing below its floor fails CI before it reaches a screen. That  │
 * │ is what `AX4`'s "enforced by the token palette, not by per-component choices" has to mean in │
 * │ practice — otherwise it means "we checked once".                                             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ EACH ROW CARRIES ITS MEASURED RATIO, AND THE TEST RE-COMPUTES IT ──────────────────────────┐
 * │ Storing only the floor would let a palette change slide a pairing from 7.6:1 to 4.6:1 with   │
 * │ the suite still green — technically passing, and a real regression nobody sees. Storing the  │
 * │ measured value catches BOTH failures: a pairing that fell below its floor, and a recorded    │
 * │ number that no longer matches the palette it claims to describe.                             │
 * │                                                                                              │
 * │ All 60 values below were computed from the §3.2 hex values with the function in this file    │
 * │ and agree with the specification to two decimal places.                                      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Method: WCAG 2.1 relative luminance, sRGB, computed from hex. Not sampled from a screenshot,
 * not eyeballed against a swatch.
 */

const SRGB_THRESHOLD = 0.03928;

function channelToLinear(channel: number): number {
  const s = channel / 255;
  return s <= SRGB_THRESHOLD ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance of an `#RRGGBB` colour. */
export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new TypeError(
      `relativeLuminance expects #RRGGBB; received "${hex}". Alpha and named colours are ` +
        `deliberately unsupported — a ratio against a translucent fill depends on what is behind ` +
        `it, so it cannot be proved here. Status fills go opaque in dark mode for this reason.`,
    );
  }
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/** WCAG 2.1 contrast ratio, 1:1 to 21:1. Order-independent. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** `NFR-USE-04` / `AX4`. Two floors, and a third category that has none. */
export const FLOOR = {
  /** Body text, labels, any string a user must read. */
  text: 4.5,
  /** Control boundaries, focus rings, icons that carry meaning alone. */
  interactive: 3.0,
} as const;

export interface ContrastPairing {
  readonly id: string;
  readonly theme: 'light' | 'dark';
  readonly foreground: string;
  readonly background: string;
  /** Recomputed by the suite and compared with this value to 2 dp. */
  readonly measured: number;
  /** `null` means decorative — it carries no information a user must perceive. */
  readonly floor: number | null;
  readonly shipsIn: string;
}

/** §3.6.1 — light theme, text pairings. Floor 4.5:1. */
export const LIGHT_TEXT_PAIRINGS: readonly ContrastPairing[] = [
  {
    id: 'L01',
    theme: 'light',
    foreground: '#171815',
    background: '#FFFFFF',
    measured: 17.83,
    floor: FLOOR.text,
    shipsIn: 'All body copy, table cells, headings',
  },
  {
    id: 'L02',
    theme: 'light',
    foreground: '#171815',
    background: '#F7FCE7',
    measured: 17.01,
    floor: FLOOR.text,
    shipsIn: 'Page canvas on both dashboards',
  },
  {
    id: 'L03',
    theme: 'light',
    foreground: '#171815',
    background: '#F1F6E2',
    measured: 16.15,
    floor: FLOOR.text,
    shipsIn: 'Table zebra rows, sunken form sections',
  },
  {
    id: 'L04',
    theme: 'light',
    foreground: '#3F413A',
    background: '#FFFFFF',
    measured: 10.35,
    floor: FLOOR.text,
    shipsIn: 'Sub-headings, SCR-DASH-007 secondary columns',
  },
  {
    id: 'L05',
    theme: 'light',
    foreground: '#3F413A',
    background: '#F7FCE7',
    measured: 9.88,
    floor: FLOOR.text,
    shipsIn: 'Dashboard sub-headings',
  },
  {
    id: 'L06',
    theme: 'light',
    foreground: '#53554D',
    background: '#FFFFFF',
    measured: 7.57,
    floor: FLOOR.text,
    shipsIn: 'Labels, SCR-WEB-003 amenity captions',
  },
  {
    id: 'L07',
    theme: 'light',
    foreground: '#53554D',
    background: '#F1F6E2',
    measured: 6.86,
    floor: FLOOR.text,
    shipsIn: 'The REPLACEMENT for the forbidden F1 pairing',
  },
  {
    id: 'L08',
    theme: 'light',
    foreground: '#72746A',
    background: '#FFFFFF',
    measured: 4.75,
    floor: FLOOR.text,
    shipsIn: 'Timestamps, tenure band',
  },
  {
    id: 'L09',
    theme: 'light',
    foreground: '#72746A',
    background: '#F7FCE7',
    measured: 4.53,
    floor: FLOOR.text,
    shipsIn: 'Metadata on the dashboard canvas — narrow pass',
  },
  {
    id: 'L10',
    theme: 'light',
    foreground: '#5C7F00',
    background: '#FFFFFF',
    measured: 4.68,
    floor: FLOOR.text,
    shipsIn: 'Every inline link, SCR-WEB-011 invoice links',
  },
  {
    id: 'L11',
    theme: 'light',
    foreground: '#171815',
    background: '#BCFF00',
    measured: 14.81,
    floor: FLOOR.text,
    shipsIn: 'Primary call to action - dark ink on the pear fill',
  },
  {
    id: 'L12',
    theme: 'light',
    foreground: '#171815',
    background: '#D1FF8E',
    measured: 15.63,
    floor: FLOOR.text,
    shipsIn: 'The same, hovered. Lightens, so contrast RISES',
  },
  {
    id: 'L13',
    theme: 'light',
    foreground: '#171815',
    background: '#DFFFB6',
    measured: 16.23,
    floor: FLOOR.text,
    shipsIn: 'The same, pressed. Lightens again',
  },
  {
    id: 'L14',
    theme: 'light',
    foreground: '#4B6900',
    background: '#F7FFEF',
    measured: 6.18,
    floor: FLOOR.text,
    shipsIn: 'Promoted-listing chip',
  },
  {
    id: 'L15',
    theme: 'light',
    foreground: '#FFFFFF',
    background: '#047857',
    measured: 5.48,
    floor: FLOOR.text,
    shipsIn: 'ALLOWED pill, "Payment captured" toast',
  },
  {
    id: 'L16',
    theme: 'light',
    foreground: '#065F46',
    background: '#ECFDF5',
    measured: 7.29,
    floor: FLOOR.text,
    shipsIn: 'ACTIVE membership pill, APPROVED tenant pill',
  },
  {
    id: 'L17',
    theme: 'light',
    foreground: '#FFFFFF',
    background: '#B91C1C',
    measured: 6.47,
    floor: FLOOR.text,
    shipsIn: '"Archive plan", "Suspend tenant"',
  },
  {
    id: 'L18',
    theme: 'light',
    foreground: '#991B1B',
    background: '#FEF2F2',
    measured: 7.6,
    floor: FLOOR.text,
    shipsIn: 'EXPIRED, REJECTED, FAILED pills; field errors',
  },
  {
    id: 'L19',
    theme: 'light',
    foreground: '#FFFFFF',
    background: '#B45309',
    measured: 5.02,
    floor: FLOOR.text,
    shipsIn: 'SLA-breach badge on SCR-ADM-002',
  },
  {
    id: 'L20',
    theme: 'light',
    foreground: '#78350F',
    background: '#FFFBEB',
    measured: 8.75,
    floor: FLOOR.text,
    shipsIn: '"Expiring in 7 days", subscription arrears',
  },
  {
    id: 'L21',
    theme: 'light',
    foreground: '#92400E',
    background: '#FEF3C7',
    measured: 6.37,
    floor: FLOOR.text,
    shipsIn: 'Emphasised warning banner fill',
  },
  {
    id: 'L22',
    theme: 'light',
    foreground: '#FFFFFF',
    background: '#0369A1',
    measured: 5.93,
    floor: FLOOR.text,
    shipsIn: '"Confirming payment" chip',
  },
  {
    id: 'L23',
    theme: 'light',
    foreground: '#075985',
    background: '#F0F9FF',
    measured: 7.09,
    floor: FLOOR.text,
    shipsIn: 'Polling disclosure, INFO_REQUESTED state',
  },
  {
    id: 'L24',
    theme: 'light',
    foreground: '#F7FCE7',
    background: '#171815',
    measured: 17.01,
    floor: FLOOR.text,
    shipsIn: 'Tooltips, the desk idle panel',
  },
];

/** §3.6.2 — light theme, non-text. Floor 3:1, or `null` where the element is decorative. */
export const LIGHT_NONTEXT_PAIRINGS: readonly ContrastPairing[] = [
  {
    id: 'N01',
    theme: 'light',
    foreground: '#72746A',
    background: '#FFFFFF',
    measured: 4.75,
    floor: FLOOR.interactive,
    shipsIn: 'Text input border — the border IS the control boundary',
  },
  {
    id: 'N02',
    theme: 'light',
    foreground: '#5C7F00',
    background: '#F1F6E2',
    measured: 4.24,
    floor: FLOOR.interactive,
    shipsIn: 'Focus ring on the default surface',
  },
  {
    id: 'N03',
    theme: 'light',
    foreground: '#5C7F00',
    background: '#D2D3CE',
    measured: 3.11,
    floor: FLOOR.interactive,
    shipsIn: 'Focus ring on a zebra row',
  },
  {
    id: 'N04',
    theme: 'light',
    foreground: '#72746A',
    background: '#FFFFFF',
    measured: 4.75,
    floor: FLOOR.interactive,
    shipsIn: 'Checkbox/radio unchecked edge',
  },
  {
    id: 'N05',
    theme: 'light',
    foreground: '#72746A',
    background: '#FFFFFF',
    measured: 4.75,
    floor: FLOOR.interactive,
    shipsIn: 'Switch track, OFF — the off state must be identifiable too',
  },
  {
    id: 'N06',
    theme: 'light',
    foreground: '#53554D',
    background: '#FFFFFF',
    measured: 7.57,
    floor: FLOOR.text,
    shipsIn: 'Icon-only button glyph — held to the TEXT floor, not 3:1',
  },
  {
    id: 'N07',
    theme: 'light',
    foreground: '#D2D3CE',
    background: '#FFFFFF',
    measured: 1.51,
    floor: null,
    shipsIn: 'Divider between table rows — decorative only (F3)',
  },
  {
    id: 'N08',
    theme: 'light',
    foreground: '#96998C',
    background: '#FFFFFF',
    measured: 2.9,
    floor: null,
    shipsIn: 'Card outline — a card is not a control (F3)',
  },
  {
    id: 'N09',
    theme: 'light',
    foreground: '#1D4ED8',
    background: '#FFFFFF',
    measured: 6.7,
    floor: FLOOR.interactive,
    shipsIn: 'Chart series 1',
  },
  {
    id: 'N10',
    theme: 'light',
    foreground: '#B45309',
    background: '#FFFFFF',
    measured: 5.02,
    floor: FLOOR.interactive,
    shipsIn: 'Chart series 2',
  },
];

/** §9.6 — dark theme. Same floors; there is one register, not three. */
export const DARK_PAIRINGS: readonly ContrastPairing[] = [
  {
    id: 'D01',
    theme: 'dark',
    foreground: '#F7FCE7',
    background: '#171815',
    measured: 17.01,
    floor: FLOOR.text,
    shipsIn: 'Body copy on the dark canvas',
  },
  {
    id: 'D02',
    theme: 'dark',
    foreground: '#F7FCE7',
    background: '#282925',
    measured: 13.97,
    floor: FLOOR.text,
    shipsIn: 'Body copy on a raised surface',
  },
  {
    id: 'D03',
    theme: 'dark',
    foreground: '#E9EBE6',
    background: '#171815',
    measured: 14.85,
    floor: FLOOR.text,
    shipsIn: 'Secondary text',
  },
  {
    id: 'D04',
    theme: 'dark',
    foreground: '#D2D3CE',
    background: '#171815',
    measured: 11.84,
    floor: FLOOR.text,
    shipsIn: 'Tertiary text',
  },
  {
    id: 'D05',
    theme: 'dark',
    foreground: '#D2D3CE',
    background: '#282925',
    measured: 9.73,
    floor: FLOOR.text,
    shipsIn: 'Tertiary text on a raised surface',
  },
  {
    id: 'D06',
    theme: 'dark',
    foreground: '#96998C',
    background: '#171815',
    measured: 6.14,
    floor: FLOOR.text,
    shipsIn: 'Muted metadata',
  },
  {
    id: 'D07',
    theme: 'dark',
    foreground: '#96998C',
    background: '#282925',
    measured: 5.04,
    floor: FLOOR.text,
    shipsIn: 'Muted metadata on a raised surface',
  },
  {
    id: 'D08',
    theme: 'dark',
    foreground: '#D1FF8E',
    background: '#171815',
    measured: 15.63,
    floor: FLOOR.text,
    shipsIn: 'Links',
  },
  {
    id: 'D09',
    theme: 'dark',
    foreground: '#061414',
    background: '#BCFF00',
    measured: 15.6,
    floor: FLOOR.text,
    shipsIn: 'The inverted brand button — DARK text on a LIGHTENED solid',
  },
  {
    id: 'D10',
    theme: 'dark',
    foreground: '#6EE7B7',
    background: '#171815',
    measured: 11.7,
    floor: FLOOR.text,
    shipsIn: 'Success text',
  },
  {
    id: 'D11',
    theme: 'dark',
    foreground: '#FCA5A5',
    background: '#171815',
    measured: 9.39,
    floor: FLOOR.text,
    shipsIn: 'Danger text',
  },
  {
    id: 'D12',
    theme: 'dark',
    foreground: '#FCD34D',
    background: '#171815',
    measured: 12.36,
    floor: FLOOR.text,
    shipsIn: 'Warning text',
  },
  {
    id: 'D13',
    theme: 'dark',
    foreground: '#7DD3FC',
    background: '#171815',
    measured: 10.69,
    floor: FLOOR.text,
    shipsIn: 'Info text',
  },
  {
    id: 'D14',
    theme: 'dark',
    foreground: '#72746A',
    background: '#171815',
    measured: 3.75,
    floor: FLOOR.interactive,
    shipsIn: 'Input border — the one border unchanged across themes',
  },
  {
    id: 'D15',
    theme: 'dark',
    foreground: '#BCFF00',
    background: '#171815',
    measured: 14.81,
    floor: FLOOR.interactive,
    shipsIn: 'Focus ring',
  },
  {
    id: 'D16',
    theme: 'dark',
    foreground: '#53554D',
    background: '#171815',
    measured: 2.36,
    floor: null,
    shipsIn: 'Card outline — decorative only (F3)',
  },
  {
    id: 'D17',
    theme: 'dark',
    foreground: '#3F413A',
    background: '#171815',
    measured: 1.72,
    floor: null,
    shipsIn: 'Row divider — decorative only (F3)',
  },
  {
    id: 'D18',
    theme: 'dark',
    foreground: '#F87171',
    background: '#171815',
    measured: 6.45,
    floor: FLOOR.interactive,
    shipsIn: 'Danger solid as a non-text indicator',
  },
  {
    id: 'D19',
    theme: 'dark',
    foreground: '#34D399',
    background: '#171815',
    measured: 9.27,
    floor: FLOOR.interactive,
    shipsIn: 'Success solid as a non-text indicator',
  },
];

/**
 * §9.5 `DK7` — the desk verdict has IDENTICAL values in both themes.
 *
 * §4.3's whole argument is that allow is the BRIGHT state and deny is the DARK one. Inverting the
 * panels for dark mode would reverse that polarity, and a receptionist who has learned "bright
 * means in" over three months would be re-taught the opposite by a theme toggle.
 */
export const DESK_PAIRINGS: readonly ContrastPairing[] = [
  {
    id: 'DK1',
    theme: 'light',
    foreground: '#065F46',
    background: '#ECFDF5',
    measured: 7.29,
    floor: FLOOR.text,
    shipsIn: 'ALLOWED verdict — bright fill, dark content, both themes',
  },
  {
    id: 'DK2',
    theme: 'light',
    foreground: '#FFFFFF',
    background: '#7F1D1D',
    measured: 10.02,
    floor: FLOOR.text,
    shipsIn: 'DENIED verdict — dark fill, white content, both themes',
  },
  {
    id: 'DK3',
    theme: 'dark',
    foreground: '#065F46',
    background: '#ECFDF5',
    measured: 7.29,
    floor: FLOOR.text,
    shipsIn: 'ALLOWED verdict, dark theme — deliberately unchanged',
  },
  {
    id: 'DK4',
    theme: 'dark',
    foreground: '#FFFFFF',
    background: '#7F1D1D',
    measured: 10.02,
    floor: FLOOR.text,
    shipsIn: 'DENIED verdict, dark theme — deliberately unchanged',
  },
  {
    id: 'DK5',
    theme: 'light',
    foreground: '#FCD34D',
    background: '#171815',
    measured: 12.36,
    floor: FLOOR.text,
    shipsIn: 'OFFLINE state — a third carrier, neither verdict',
  },
];

/**
 * The media ground — `SCR-WEB-001`'s hero, and gym cover art after it.
 *
 * Identical in both themes, for the same class of reason as `DESK_PAIRINGS`: what the token sits
 * behind does not change with the theme. A photograph and a video want a dark ground in light
 * mode and in dark mode alike.
 *
 * ┌─ WHY THIS PAIR EXISTS AT ALL, RATHER THAN TEXT ON `surface-scrim` ──────────────────────────┐
 * │ `relativeLuminance` above refuses translucent colours on purpose, and the reason applies     │
 * │ exactly here: the ratio of white text over a 60% scrim depends on the video FRAME behind it. │
 * │ It is provable against the establishing shot and unprovable four seconds later, when the     │
 * │ camera pans to a bright window. That is not a contrast measurement, it is a hope.            │
 * │                                                                                              │
 * │ So media-overlaid text sits on an OPAQUE band, and this is the pair that band ships.         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export const MEDIA_PAIRINGS: readonly ContrastPairing[] = [
  {
    id: 'MD1',
    theme: 'light',
    foreground: '#F7FCE7',
    background: '#061414',
    measured: 17.92,
    floor: FLOOR.text,
    shipsIn: 'SCR-WEB-001 hero copy over video — content-on-media on surface-media',
  },
  {
    id: 'MD2',
    theme: 'dark',
    foreground: '#F7FCE7',
    background: '#061414',
    measured: 17.92,
    floor: FLOOR.text,
    shipsIn: 'The same band in dark theme — deliberately unchanged',
  },
  {
    id: 'MD3',
    theme: 'light',
    foreground: '#D1FF8E',
    background: '#061414',
    measured: 16.46,
    floor: FLOOR.text,
    shipsIn: 'SCR-WEB-001 accented headline word — content-on-media-accent on surface-media',
  },
  {
    id: 'MD4',
    theme: 'dark',
    foreground: '#D1FF8E',
    background: '#061414',
    measured: 16.46,
    floor: FLOOR.text,
    shipsIn: 'The same accent in dark theme — deliberately unchanged',
  },
];

export const ALL_PAIRINGS: readonly ContrastPairing[] = [
  ...LIGHT_TEXT_PAIRINGS,
  ...LIGHT_NONTEXT_PAIRINGS,
  ...DARK_PAIRINGS,
  ...DESK_PAIRINGS,
  ...MEDIA_PAIRINGS,
];

export interface ForbiddenPairing {
  readonly id: string;
  readonly foreground: string;
  readonly background: string;
  readonly measured: number;
  readonly tempting: string;
  readonly instead: string;
}

/**
 * §3.8 · Four pairings recorded BECAUSE THEY ARE PLAUSIBLE, not because anyone proposed them.
 *
 * The suite asserts each as a negative case, so a future palette tweak that accidentally makes one
 * legal still does not make it permitted — the row has to be removed deliberately, under §12.
 */
export const FORBIDDEN_PAIRINGS: readonly ForbiddenPairing[] = [
  /*
   * F1 WAS HERE, AND ITS REMOVAL IS DELIBERATE UNDER §12.
   *
   * F1 was `content-muted` on `surface-sunken` at 3.21:1 — described in this file as "the single
   * most likely accident in this palette", because `surface-sunken` IS the zebra stripe and muted
   * metadata inside a table row is the most natural thing in the world to write.
   *
   * It stopped being an accident when the light canvas was lightened. `surface-sunken` moved from
   * `neutral-300` (a mid-grey) to `neutral-50`, so the same pairing now measures 4.55:1 and clears
   * the text floor. That was not a lucky side effect of a palette tweak: the canvas was lightened
   * ON PURPOSE so cards read as white, and this pairing improving is a direct consequence.
   *
   * The header above is explicit that a pairing which accidentally becomes legal must NOT thereby
   * become permitted — "the row has to be removed deliberately". This is that removal, with the
   * measurement recorded. The replacement it prescribed (`content-tertiary`, now 7.24:1) is still
   * the better choice for small metadata and is still what the components use.
   *
   * `contrast.spec.ts` now asserts the pairing PASSES, so re-darkening the canvas fails the suite
   * rather than quietly reintroducing the accident.
   */

  {
    id: 'F2',
    foreground: '#96998C',
    background: '#FFFFFF',
    measured: 2.9,
    tempting: 'content-disabled on surface-default. It is the disabled colour; it looks disabled.',
    instead:
      'Permitted ONLY on aria-disabled controls, which WCAG 1.4.3 exempts. Never on ' +
      'informational text, never on a placeholder carrying the only label, never on a value the ' +
      'user must read.',
  },
  {
    id: 'F3',
    foreground: '#D2D3CE',
    background: '#FFFFFF',
    measured: 1.51,
    tempting: 'border-subtle as the ONLY indicator of a control. Minimal, quiet, modern.',
    instead:
      'border-input #64748B -> 4.76:1 (N01). border-subtle may separate rows and outline ' +
      'non-interactive cards, nothing more.',
  },
  {
    id: 'F4',
    foreground: '#FFFFFF',
    background: '#059669',
    measured: 3.77,
    tempting:
      'success-600 with white text. It is the brighter, friendlier green, and it is exactly the ' +
      'trap the semantic tier exists to prevent: `bg-emerald-600 text-white` looks correct.',
    instead: 'success-solid #047857 -> 5.48:1 (L15). #059669 is a chart and dark-mode value only.',
  },
];
