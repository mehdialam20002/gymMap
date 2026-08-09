/**
 * `SCR-WEB-001` — the hero, in "Chalk & Iron".
 *
 * Design read: `customer-web` for Priya, deciding, on a phone, being persuaded. Comfortable
 * density (`DesignSystem.md` §1.1), VARIANCE 8 and MOTION 5 — the highest either has gone on this
 * surface, and the owner's call.
 *
 * ┌─ THE BACKGROUND IS DRAWN, NOT PHOTOGRAPHED ─────────────────────────────────────────────────┐
 * │ Two radial washes, a 78px rule grid masked to an ellipse, three rings that read as weight    │
 * │ plates seen edge-on, and 300 bytes of SVG grain. No image at all.                            │
 * │                                                                                              │
 * │ Which removes the entire problem the last four versions of this file were about. A           │
 * │ photograph can present any pixel, so copy on it needs a bounded worst case, a scrim tuned to │
 * │ it, and a proof that survives the next photograph somebody swaps in. A gradient is a known   │
 * │ colour: `content-primary` on `surface-default` is 17.76:1 and stays 17.76:1.                  │
 * │                                                                                              │
 * │ It is also faster. The LCP is text now, painted as soon as the font is ready, rather than a  │
 * │ 180 KB decode sitting on the critical path.                                                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT THIS HERO DELIBERATELY DOES NOT HAVE ────────────────────────────────────────────────┐
 * │ The reference's tag reads "69 verified gyms live". There are eight fixture listings and zero │
 * │ approved ones, so that is a false statement made by a platform to a consumer. The tag keeps  │
 * │ the shape and the live dot and states what is actually true, counted from the catalogue.      │
 * │                                                                                              │
 * │ Same rule that took the counter strip off the last three versions of this page: a number is  │
 * │ bound to something real, or there is no number.                                               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The search console is one real `<form method="get">`. City, radius and query all land in the
 * URL, so the result is shareable, crawlable and works before hydration — and `FR-SRCH-03`'s
 * distance radius is a filter `search()` actually applies, not a control painted on the design.
 */

import Link from 'next/link';

import { t, type MessageKey } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';
import { CATALOGUE } from '../discovery/fixtures/catalogue.ts';
import { RADII } from '../discovery/search.ts';

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

/**
 * The four promises, as the marquee reads them.
 *
 * The same four claims the site makes everywhere — `BR-GYM-01`, `BR-PLN-03`, `BR-REV-01`,
 * `BR-PAY-02` — each one a rule enforced elsewhere in this codebase, and each one true today,
 * which a membership count is not.
 */
const CLAIMS = [
  { title: 'web.home.trust.verified.title', body: 'web.home.trust.verified.body' },
  { title: 'web.home.trust.pricing.title', body: 'web.home.trust.pricing.body' },
  { title: 'web.home.trust.reviews.title', body: 'web.home.trust.reviews.body' },
  { title: 'web.home.trust.payments.title', body: 'web.home.trust.payments.body' },
] as const satisfies readonly { title: MessageKey; body: MessageKey }[];

export function Hero() {
  const Place = icon.place;
  const Search = icon.search;
  const Radius = icon.radius;

  // Counted, not claimed.
  const cities = new Set(CATALOGUE.map((gym) => gym.city)).size;

  return (
    <section className="gm-hero">
      {/*
       * `aria-hidden`, because none of it carries meaning. A screen reader announcing "grid,
       * circle, circle, circle" ahead of the headline is strictly worse than silence.
       */}
      <div aria-hidden="true" className="gm-hero-bg">
        <div className="gm-hero-grid" />
        <span className="gm-plate gm-plate-2" />
        <span className="gm-plate gm-plate-1" />
        <span className="gm-plate gm-plate-3" />
        <div className="gm-noise" />
      </div>

      <div className="gm-hero-in gm-wrap">
        <p className="gm-hero-tag">
          <span aria-hidden="true" className="gm-dot" />
          {t('web.home.hero.tagCities').replace('{n}', String(cities))}
        </p>

        {/*
         * Three lines, each in its own clipping box so it rises out of nothing. The breaks are
         * DELIBERATE rather than a consequence of the measure — at 142px a headline that reflows
         * is a different picture at every width, and this one is a composition.
         */}
        <h1 className="gm-display gm-display-hero">
          <span className="gm-line">
            <span>{t('web.home.hero.titleOne')}</span>
          </span>
          <span className="gm-line">
            <span>{t('web.home.hero.titleTwo')}</span>
          </span>
          <span className="gm-line">
            <span>
              <em>{t('web.home.hero.titleAccent')}</em>
            </span>
          </span>
        </h1>

        <div className="mt-[30px] flex flex-wrap items-end gap-[26px]">
          <p className="m-0 max-w-[40ch] text-content-muted">{t('web.home.hero.subtitle')}</p>
        </div>

        <form action="/search" method="get" className="gm-console" role="search">
          <div className="gm-field">
            <label htmlFor="city">{t('web.home.hero.cityLabel')}</label>
            <Place aria-hidden="true" className="mt-[14px] h-[15px] w-[15px] shrink-0" />
            <select id="city" name="city" aria-label={t('web.home.hero.cityLabel')}>
              <option value="">{t('web.home.hero.cityAny')}</option>
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          {/*
           * `FR-SRCH-03`'s distance radius. The design ships two fields; this is the third,
           * because the filter is in the specification and `search()` applies it — a control the
           * page draws but the query ignores is the thing this codebase keeps refusing to build.
           */}
          <div className="gm-field">
            <label htmlFor="radius">{t('web.home.hero.radiusLabel')}</label>
            <Radius aria-hidden="true" className="mt-[14px] h-[15px] w-[15px] shrink-0" />
            <select id="radius" name="radius" aria-label={t('web.home.hero.radiusLabel')}>
              <option value="">{t('web.home.hero.radiusAny')}</option>
              {RADII.map((km) => (
                <option key={km} value={km}>
                  {t('web.home.hero.radiusWithin').replace('{km}', String(km))}
                </option>
              ))}
            </select>
          </div>

          <div className="gm-field">
            <label htmlFor="q">{t('web.home.hero.searchLabel')}</label>
            <Search aria-hidden="true" className="mt-[14px] h-[15px] w-[15px] shrink-0" />
            <input
              id="q"
              name="q"
              type="search"
              placeholder={t('web.home.hero.searchPlaceholder')}
              aria-label={t('web.home.hero.searchLabel')}
            />
          </div>

          <button type="submit" className="gm-btn gm-btn-amber">
            {t('web.home.hero.searchAction')} <i aria-hidden="true">→</i>
          </button>
        </form>

        {/*
         * Real links, not decoration. Each is a `/search?category=…` the results page already
         * understands, which also makes them crawlable entry points (`FR-SRCH-13`).
         */}
        <nav aria-label={t('web.home.hero.browseLabel')} className="mt-[26px]">
          <ul className="flex flex-wrap gap-inline-sm">
            {CATEGORIES.map((category) => {
              const Glyph = icon[category.glyph];
              return (
                <li key={category.value}>
                  <Link
                    href={`/search?category=${encodeURIComponent(category.value)}`}
                    className="gm-hit-target inline-flex items-center gap-inline-xs rounded-full border border-subtle px-inset-md py-inset-xs text-sm font-semibold text-content-secondary transition-colors duration-fast ease-standard hover:border-brand hover:text-content"
                  >
                    <Glyph aria-hidden="true" className="h-[1rem] w-[1rem]" />
                    {t(category.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/*
         * The marquee is `aria-hidden` and every claim in it appears in full further down the
         * page. A screen reader gets each sentence once, under a heading, rather than a loop of
         * fragments it cannot pause.
         */}
        <div aria-hidden="true" className="gm-marquee">
          {/*
           * The track is the claims TWICE. `translateX(-50%)` walks it exactly one copy, so the
           * second set is under the cursor at the moment the first leaves - a seam nobody sees,
           * and the only way to loop a marquee without measuring anything in JavaScript.
           *
           * Two passes rather than an index key: `pass` makes each key unique without keying on
           * position, which is the thing the lint rule is actually about.
           */}
          <div className="gm-marquee-track">
            {(['a', 'b'] as const).map((pass) =>
              CLAIMS.map((claim) => (
                <span key={`${pass}-${claim.title}`}>
                  <b>{t(claim.title)}</b> · {t(claim.body)}
                </span>
              )),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
