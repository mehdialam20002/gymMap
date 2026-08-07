/**
 * Tier 2 · Space — `DesignSystem.md` §6.1 `SP1`, §5.5.
 *
 * THREE families, because "padding" and "gap" are different decisions:
 *
 *   inset-*    padding INSIDE a container
 *   stack-*    vertical gap between siblings
 *   inline-*   horizontal gap between siblings
 *
 * A component that reaches for `space-4` directly is using a primitive and fails `UI3`. The
 * distinction is what makes density a remap (§7.4 `SP4`) rather than an override: `space-inset-md`
 * is 16 px comfortable, 12 px compact and 24 px oversized, and nothing at the call site changes.
 *
 * `SP2` — gaps use `gap`, never margins. Margin collapsing across a Skeleton -> real-content swap
 * is a layout-shift source, and `NFR-PERF-02`'s LCP budget has no room for CLS.
 */

import { space as s } from '../primitive/scale.ts';

export const semanticSpace = {
  // Padding inside a container.
  'space-inset-2xs': s['0-5'],
  'space-inset-xs': s[2],
  'space-inset-sm': s[3],
  'space-inset-md': s[4],
  'space-inset-lg': s[6],
  'space-inset-xl': s[8],

  // Vertical rhythm between siblings — §5.5 maps each pairing.
  /** Heading -> its first paragraph. */
  'space-stack-2xs': s[1],
  'space-stack-xs': s[2],
  /** Paragraph -> paragraph. */
  'space-stack-sm': s[3],
  /** Section -> section within a card. */
  'space-stack-md': s[4],
  /** Card -> card. */
  'space-stack-lg': s[6],
  /** Page region -> page region. */
  'space-stack-xl': s[8],
  /** Page region -> page region, customer-web. */
  'space-stack-2xl': s[12],

  // Horizontal gaps.
  /** Icon-to-glyph nudge. */
  'space-inline-2xs': s['0-5'],
  'space-inline-xs': s[1],
  'space-inline-sm': s[2],
  'space-inline-md': s[3],
  'space-inline-lg': s[4],
  'space-inline-xl': s[6],

  // Page-level rhythm.
  'space-region-sm': s[10],
  'space-region-md': s[16],
  'space-region-lg': s[20],
  'space-region-xl': s[24],
} as const;

export type SpaceTokenKey = keyof typeof semanticSpace;
