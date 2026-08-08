/**
 * The customer surface's icon vocabulary — `A-40`, `DesignSystem.md` §8.
 *
 * Same two rules as the admin console's map, for the same reasons:
 *
 *   PER-ICON IMPORTS, never the barrel. `from '@phosphor-icons/react'` pulls every glyph Phosphor
 *   ships — over a megabyte before tree-shaking gets a chance, and a barrel that large is exactly
 *   where bundlers give up. On THIS surface it would also spend the whole of `NFR-PERF-10`'s
 *   200 KB budget on decoration.
 *
 *   ONE MAP, so a glyph is a decision rather than a habit. Components name a CONCEPT (`verified`,
 *   `pricing`) and two screens that both mean "verified" cannot drift to two different icons.
 *
 * Every icon here is `aria-hidden` and sits beside a text label. An icon that is the only label
 * is a bug this file cannot prevent, but it should not encourage one either.
 */

/**
 * Phosphor's OWN component type, not a hand-written prop interface. A local
 * `ComponentType<SVGProps<SVGSVGElement>>` looks equivalent and does not compile under
 * `exactOptionalPropertyTypes`: the real `IconProps` declares `color: string` where the
 * hand-written one offered `string | undefined`. A type-only import costs nothing at runtime.
 */
import type { Icon } from '@phosphor-icons/react';

import { Barbell } from '@phosphor-icons/react/dist/ssr/Barbell';
import { BoxingGlove } from '@phosphor-icons/react/dist/ssr/BoxingGlove';
import { CaretDown } from '@phosphor-icons/react/dist/ssr/CaretDown';
import { CurrencyInr } from '@phosphor-icons/react/dist/ssr/CurrencyInr';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/ssr/MagnifyingGlass';
import { MapPin } from '@phosphor-icons/react/dist/ssr/MapPin';
import { PersonSimpleRun } from '@phosphor-icons/react/dist/ssr/PersonSimpleRun';
import { PersonSimpleSwim } from '@phosphor-icons/react/dist/ssr/PersonSimpleSwim';
import { PersonSimpleTaiChi } from '@phosphor-icons/react/dist/ssr/PersonSimpleTaiChi';
import { SealCheck } from '@phosphor-icons/react/dist/ssr/SealCheck';
import { Star } from '@phosphor-icons/react/dist/ssr/Star';

type Glyph = Icon;

/**
 * Concept, not glyph. `verified` is `SealCheck` today; if it becomes something else it changes
 * here once rather than in every screen that means the same thing.
 */
export const icon = {
  // The three product promises — BR-GYM-01, BR-PLN-03, BR-REV-01.
  verified: SealCheck,
  pricing: CurrencyInr,
  reviews: Star,

  // Search controls.
  search: MagnifyingGlass,
  place: MapPin,
  expand: CaretDown,

  // Categories, matching the strings the fixture catalogue actually carries. A category with no
  // icon falls back to `strength` rather than rendering an empty box.
  strength: Barbell,
  cardio: PersonSimpleRun,
  yoga: PersonSimpleTaiChi,
  boxing: BoxingGlove,
  swimming: PersonSimpleSwim,
} as const satisfies Record<string, Glyph>;

export type IconName = keyof typeof icon;
