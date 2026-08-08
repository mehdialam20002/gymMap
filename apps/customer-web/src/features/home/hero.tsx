/**
 * `SCR-WEB-001` — the hero.
 *
 * Design read: `customer-web` for Priya, deciding, on a phone, being persuaded. Comfortable
 * density (`DesignSystem.md` §1.1), VARIANCE 7 and MOTION 4 — one moving thing, and it is the
 * footage. Nothing else on this surface animates.
 *
 * ┌─ WHY THE COPY SITS ON AN OPAQUE BAND RATHER THAN ON THE FOOTAGE ────────────────────────────┐
 * │ `contrast.proof.ts` refuses translucent colours on purpose, and the reason lands exactly    │
 * │ here: the ratio of light text over a scrim depends on the video FRAME behind it. Provable   │
 * │ against the establishing shot, unprovable four seconds later when the camera finds a        │
 * │ window. That is not a contrast measurement, it is a hope with a number next to it.          │
 * │                                                                                              │
 * │ So `.gm-media-veil` reaches FULLY OPAQUE `surface-media` across the region the copy          │
 * │ occupies, and every pairing here is proved against it: `MD1` at 19.28:1 for the copy and    │
 * │ `MD3` at 10.12:1 for the accent. The brand's own `indigo-600` measures 3.21:1 on this band  │
 * │ and is not usable, which is why the accent has its own token.                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT THIS HERO DELIBERATELY DOES NOT HAVE ────────────────────────────────────────────────┐
 * │ No counter strip, no rating badge, no "#1" claim. Not an aesthetic preference:              │
 * │                                                                                              │
 * │   A number is bound to a live endpoint or there is no number. There are 26 fixture gyms and │
 * │   zero real listings, so "12,000+ gyms" would be a false statement to a consumer.           │
 * │                                                                                              │
 * │   `BR-REV-01` is that a review requires a recorded check-in. A "4.8 from 50,000 reviews"    │
 * │   badge on a platform with no check-ins contradicts the exact promise the page is making    │
 * │   three sections further down, which is worse than merely being untrue.                      │
 * │                                                                                              │
 * │ The persuasion is the three promises instead. They are the differentiators, and they have   │
 * │ the advantage of being true today.                                                           │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The search control is one real `<form method="get">`. City, query and category all land in the
 * URL, so the result is shareable, crawlable and works before hydration — the entire reason
 * `SCR-WEB-002` keeps its state there.
 */

import Link from 'next/link';

import { t, type MessageKey } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';
import { HeroMotionToggle, HeroVideo } from './hero-video.tsx';

/** The cities the catalogue actually carries. A select offering a city with no gyms is a lie. */
const CITIES = ['Bengaluru', 'Mumbai', 'Delhi', 'Chennai'] as const;

/** Label key, the literal category value the catalogue stores, and the concept for its glyph. */
const CATEGORIES = [
  { key: 'web.home.hero.category.strength', value: 'Strength', glyph: 'strength' },
  { key: 'web.home.hero.category.cardio', value: 'Cardio', glyph: 'cardio' },
  { key: 'web.home.hero.category.yoga', value: 'Yoga', glyph: 'yoga' },
  { key: 'web.home.hero.category.boxing', value: 'Boxing', glyph: 'boxing' },
  { key: 'web.home.hero.category.swimming', value: 'Swimming', glyph: 'swimming' },
] as const satisfies readonly { key: MessageKey; value: string; glyph: keyof typeof icon }[];

const PROMISES = [
  {
    glyph: 'verified',
    title: 'web.home.hero.promise.verified.title',
    note: 'web.home.hero.promise.verified.note',
  },
  {
    glyph: 'pricing',
    title: 'web.home.hero.promise.pricing.title',
    note: 'web.home.hero.promise.pricing.note',
  },
  {
    glyph: 'reviews',
    title: 'web.home.hero.promise.reviews.title',
    note: 'web.home.hero.promise.reviews.note',
  },
] as const satisfies readonly { glyph: keyof typeof icon; title: MessageKey; note: MessageKey }[];

export function Hero() {
  const Place = icon.place;
  const Search = icon.search;

  return (
    <section className="relative isolate overflow-hidden bg-surface-media">
      <HeroVideo />

      {/*
       * `gm-media-veil` (globals.css) — flat `surface-media` across the region the copy occupies,
       * with the stop position set per breakpoint. Tailwind's `via` is fixed at 50%, and on a
       * phone the copy is taller than that, which put the headline over the footage.
       */}
      <div aria-hidden="true" className="gm-media-veil pointer-events-none absolute inset-0" />

      <div className="relative mx-auto max-w-container px-inset-md py-region-lg md:py-region-xl">
        <div className="max-w-prose">
          {/* An eyebrow that states a property of the product, not a ranking. */}
          <p className="inline-flex items-center gap-inline-xs rounded-full border border-strong px-inset-sm py-inset-2xs text-xs font-medium text-content-on-media">
            <icon.verified aria-hidden="true" className="h-[1rem] w-[1rem]" weight="fill" />
            {t('web.home.hero.badge')}
          </p>

          <h1 className="mt-stack-md text-4xl font-bold tracking-tight text-content-on-media md:text-5xl">
            {t('web.home.hero.titleLead')}{' '}
            <span className="text-content-on-media-accent">{t('web.home.hero.titleAccent')}</span>
          </h1>

          <p className="mt-stack-md text-lg text-content-on-media">{t('web.home.hero.subtitle')}</p>

          {/*
           * The three promises, inline. Icon AND word AND position — never colour alone (AX8),
           * which also means this row survives being read in greyscale.
           */}
          <ul className="mt-stack-lg flex flex-wrap gap-x-inline-xl gap-y-stack-sm">
            {PROMISES.map((promise) => {
              const Glyph = icon[promise.glyph];
              return (
                <li key={promise.title} className="flex items-start gap-inline-xs">
                  <Glyph
                    aria-hidden="true"
                    className="mt-px h-[1.25rem] w-[1.25rem] shrink-0 text-content-on-media-accent"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-content-on-media">
                      {t(promise.title)}
                    </span>
                    <span className="text-xs text-content-on-media">{t(promise.note)}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          {/*
           * One control, three inputs, one GET. The city is a real <select name="city"> and the
           * query a real <input name="q">, so `/search?city=Mumbai&q=yoga` is what the browser
           * produces on its own — no handler, no hydration, and a URL the visitor can send to a
           * friend.
           */}
          <form action="/search" method="get" className="mt-stack-xl max-w-form">
            <div className="flex flex-col overflow-hidden rounded-control border border-input bg-surface sm:flex-row sm:items-stretch">
              <div className="flex items-center gap-inline-xs border-b border-subtle px-inset-md py-inset-sm sm:border-b-0 sm:border-r">
                <Place
                  aria-hidden="true"
                  className="h-[1.25rem] w-[1.25rem] shrink-0 text-content-muted"
                />
                <select
                  name="city"
                  aria-label={t('web.home.hero.cityLabel')}
                  className="min-w-0 bg-surface text-md text-content"
                >
                  <option value="">{t('web.home.hero.cityAny')}</option>
                  {CITIES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              <input
                id="q"
                name="q"
                type="search"
                aria-label={t('web.home.hero.searchLabel')}
                placeholder={t('web.home.hero.searchPlaceholder')}
                className="min-w-0 flex-1 bg-surface px-inset-md py-inset-sm text-md text-content placeholder:text-content-muted"
              />

              <button
                type="submit"
                data-on-solid="true"
                className="gm-hit-target flex items-center justify-center gap-inline-xs bg-brand-solid px-inset-lg py-inset-sm text-md font-semibold text-content-on-brand transition-colors duration-fast ease-standard hover:bg-brand-solid-hover active:bg-brand-solid-active"
              >
                <Search aria-hidden="true" className="h-[1.25rem] w-[1.25rem]" />
                {t('web.home.hero.searchAction')}
              </button>
            </div>
          </form>

          {/*
           * Real links, not decoration. Each is a `/search?category=…` the results page already
           * understands, which also makes them crawlable entry points (`FR-SRCH-13`).
           */}
          <nav aria-label={t('web.home.hero.browseLabel')} className="mt-stack-lg">
            <ul className="flex flex-wrap gap-inline-sm">
              {CATEGORIES.map((category) => {
                const Glyph = icon[category.glyph];
                return (
                  <li key={category.value}>
                    <Link
                      href={`/search?category=${encodeURIComponent(category.value)}`}
                      data-on-media="true"
                      className="gm-hit-target inline-flex items-center gap-inline-xs rounded-full border border-strong px-inset-md py-inset-2xs text-sm font-medium text-content-on-media transition-colors duration-fast ease-standard hover:border-brand"
                    >
                      <Glyph aria-hidden="true" className="h-[1rem] w-[1rem]" />
                      {t(category.key)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-stack-lg">
            <HeroMotionToggle />
          </div>
        </div>
      </div>
    </section>
  );
}
