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
 *
 * ┌─ THE MAP IS A RUNTIME OBJECT, SO A CLIENT COMPONENT TAKES ALL OF IT ───────────────────────┐
 * │ Raised by an audit as a bundle problem, and it is real: components read `icon.search`, which │
 * │ is a property lookup on an object, so a bundler cannot drop the twenty-one entries a given   │
 * │ component never touches. `search-results.tsx` is `'use client'`, uses `icon.search` and       │
 * │ `icon.close`, and ships the whole vocabulary to the browser.                                 │
 * │                                                                                             │
 * │ Then it was measured, and the measurement is the reason nothing changed: all 22 of these     │
 * │ modules come to 6,684 raw bytes - 6 KB unminified, before gzip - because the `ssr` build is  │
 * │ path data and nothing else. The two that component needs are 600 of those bytes. The waste   │
 * │ is about 6 KB raw against `NFR-PERF-10`'s 200 KB, under one percent of the budget, and the   │
 * │ price of removing it is the rule in the paragraph above: a component that imports its own    │
 * │ glyph directly is a component that can pick a different "verified" tick to the next one.     │
 * │                                                                                             │
 * │ Recorded rather than fixed, so the next person to notice the shape does not re-derive it.    │
 * │ If this map ever grows past roughly a hundred entries the arithmetic changes and a           │
 * │ client-safe subset becomes worth its own module.                                             │
 * └───────────────────────────────────────────────────────────────────────────────────────────┘
 */

/**
 * Phosphor's OWN component type, not a hand-written prop interface. A local
 * `ComponentType<SVGProps<SVGSVGElement>>` looks equivalent and does not compile under
 * `exactOptionalPropertyTypes`: the real `IconProps` declares `color: string` where the
 * hand-written one offered `string | undefined`. A type-only import costs nothing at runtime.
 */
import type { Icon } from '@phosphor-icons/react';

/*
 * ┌─ `…Icon`, NOT THE BARE NAME ────────────────────────────────────────────────────────────────┐
 * │ Phosphor 2.1 deprecated every unsuffixed export — `export declare const CaretRight` carries  │
 * │ `@deprecated Use CaretRightIcon` — and kept it as an alias. Both compile; only one survives   │
 * │ the major that removes them. Written the new way from the start so the migration is a diff    │
 * │ that never has to happen, and so a reader does not learn the old spelling from this file.     │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */
import { BarbellIcon } from '@phosphor-icons/react/dist/ssr/Barbell';
import { BoxingGloveIcon } from '@phosphor-icons/react/dist/ssr/BoxingGlove';
import { CaretDownIcon } from '@phosphor-icons/react/dist/ssr/CaretDown';
import { CheckIcon } from '@phosphor-icons/react/dist/ssr/Check';
import { MinusIcon } from '@phosphor-icons/react/dist/ssr/Minus';
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight';
import { CurrencyInrIcon } from '@phosphor-icons/react/dist/ssr/CurrencyInr';
import { CompassIcon } from '@phosphor-icons/react/dist/ssr/Compass';
import { SunIcon } from '@phosphor-icons/react/dist/ssr/Sun';
import { MoonIcon } from '@phosphor-icons/react/dist/ssr/Moon';
import { ListIcon } from '@phosphor-icons/react/dist/ssr/List';
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/ssr/MagnifyingGlass';
import { MapPinIcon } from '@phosphor-icons/react/dist/ssr/MapPin';
import { PersonSimpleRunIcon } from '@phosphor-icons/react/dist/ssr/PersonSimpleRun';
import { PersonSimpleSwimIcon } from '@phosphor-icons/react/dist/ssr/PersonSimpleSwim';
import { PersonSimpleTaiChiIcon } from '@phosphor-icons/react/dist/ssr/PersonSimpleTaiChi';
import { SealCheckIcon } from '@phosphor-icons/react/dist/ssr/SealCheck';
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/ssr/ShieldCheck';
import { StarIcon } from '@phosphor-icons/react/dist/ssr/Star';
import { UsersThreeIcon } from '@phosphor-icons/react/dist/ssr/UsersThree';
import { HeartbeatIcon } from '@phosphor-icons/react/dist/ssr/Heartbeat';
import { XIcon } from '@phosphor-icons/react/dist/ssr/X';

type Glyph = Icon;

/**
 * Concept, not glyph. `verified` is `SealCheck` today; if it becomes something else it changes
 * here once rather than in every screen that means the same thing.
 */
export const icon = {
  // The three product promises — BR-GYM-01, BR-PLN-03, BR-REV-01.
  verified: SealCheckIcon,
  pricing: CurrencyInrIcon,
  reviews: StarIcon,
  secure: ShieldCheckIcon,

  // Search controls.
  search: MagnifyingGlassIcon,
  place: MapPinIcon,
  // Distance ceiling, `FR-SRCH-03`. A compass rather than a ruler: the filter is "how far from
  // here", which is a bearing-and-distance idea, not a measurement of the gym.
  radius: CompassIcon,
  expand: CaretDownIcon,
  // "This tile is a link, and it goes somewhere" — the affordance a card-shaped anchor otherwise
  // has to earn from hover alone, which a touch device never sees.
  next: CaretRightIcon,

  // Chrome.
  menu: ListIcon,
  close: XIcon,
  // The theme control names its DESTINATION, so the glyph does too: a sun means "go light".
  // Pairing the icon with the current state instead is the version everyone gets wrong.
  themeLight: SunIcon,
  themeDark: MoonIcon,

  // The compare matrix. Both cells carry a glyph AND a word — a tick against nothing at all is
  // "present vs absent" signalled by shape alone, which is exactly what `AX8` forbids.
  has: CheckIcon,
  hasNot: MinusIcon,

  // The hero's orbit. `A-40` approves the package and these are per-icon imports like the rest,
  // so nothing new is being introduced - only two more glyphs from a set already in the tree.
  group: UsersThreeIcon,
  pulse: HeartbeatIcon,

  // Categories, matching the strings the fixture catalogue actually carries. A category with no
  // icon falls back to `strength` rather than rendering an empty box.
  strength: BarbellIcon,
  cardio: PersonSimpleRunIcon,
  yoga: PersonSimpleTaiChiIcon,
  boxing: BoxingGloveIcon,
  swimming: PersonSimpleSwimIcon,
} as const satisfies Record<string, Glyph>;

export type IconName = keyof typeof icon;
