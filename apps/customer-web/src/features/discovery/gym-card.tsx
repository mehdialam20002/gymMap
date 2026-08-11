/**
 * A result card — `SCR-WEB-002`, `FR-SRCH-06`, `BR-REV-01`, `BR-GYM-01`.
 *
 * ┌─ AN UNRATED GYM SHOWS NO RATING, NOT A ZERO ────────────────────────────────────────────────┐
 * │ `BR-REV-01` makes a review impossible without a recorded check-in, so a newly listed gym has │
 * │ none — legitimately. Rendering `0.0` for it would be a factual claim that members rated it   │
 * │ badly, made by the platform, about a business that has done nothing wrong.                    │
 * │                                                                                              │
 * │ "New listing" is the honest label and it also reads better: it tells a member why there is   │
 * │ no score instead of leaving them to guess.                                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ NO HEART, AND THAT IS DELIBERATE ──────────────────────────────────────────────────────────┐
 * │ Every marketplace card in the reference carries a favourite toggle, and `/account/favourites`│
 * │ is a real PRD route. It is not here YET because favouriting requires an account and the auth │
 * │ flow this surface needs does not exist. A heart that silently does nothing, or that throws a │
 * │ member at a sign-in wall with no explanation, is worse than a card without one — and it is   │
 * │ the kind of thing that ships as "we'll wire it up later" and never gets wired.                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The price is labelled "from" because it is the cheapest plan. An unqualified figure next to a
 * gym name is read as *the* price, and the member finds out otherwise at checkout — which is the
 * exact expectation `BR-PLN-03` exists to protect.
 */

import Link from 'next/link';

import { t } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';
import { MAX_COMPARE, compareKey, toggleHref, type CompareBase } from '../compare/compare.ts';
import { GymPhoto } from './gym-photo.tsx';
import { formatMinor } from './search.ts';
import type { GymDetail, SearchResult } from './fixtures/catalogue.ts';

/** How many amenities fit before the row starts wrapping into noise. */
const AMENITIES_SHOWN = 3;

export function GymCard({
  gym,
  selected,
  base,
}: {
  readonly gym: SearchResult;
  /**
   * What is already being compared, read off this page's own `searchParams` — ADR-0050.
   *
   * A PROP and not a store. The selection is already in the URL, every route that renders this
   * card is a Server Component that already reads `searchParams`, and a second copy in React
   * state is the tray that cannot be shared, cannot be crawled, and disagrees with the address
   * bar the moment anybody presses Back.
   */
  readonly selected: readonly GymDetail[];
  /** The page this card is on, filters intact, so the toggle comes back here. */
  readonly base: CompareBase;
}) {
  const Verified = icon.verified;
  const Place = icon.place;
  const hidden = gym.amenities.length - AMENITIES_SHOWN;
  const chosen = selected.some((entry) => compareKey(entry) === compareKey(gym));
  // At the cap with this gym not in the set, there is no next selection to name. `MAX_COMPARE`
  // is enforced in `toCompareParams`, so the "add" href would resolve to the URL the reader is
  // already on: a control that looks live, announces itself as an add, and does nothing.
  const atLimit = !chosen && selected.length >= MAX_COMPARE;

  return (
    <li className="gm-card gm-card-interactive group overflow-hidden rounded-card">
      {/*
       * The cover is no longer its own anchor. It pointed at the same href as the gym's name, so
       * every card shipped two links to one destination and the first of them had no accessible
       * name at all - a screen reader read "link" and then "link, Apex CrossFit Powai". The name's
       * anchor is stretched over the whole card instead (`.gm-card-link`), which is what makes the
       * cover clickable now, along with the price, the rating and the white space between them.
       */}
      {/*
       * The cover, with its "Sample photo" marker attached - see `gym-photo.tsx`. The marker is
       * part of the image rather than part of the page, so a screenshot of one card still says
       * what the photograph is.
       */}
      <GymPhoto
        gym={gym}
        /*
         * `GymCard` renders into four different layouts - the results list beside a filter
         * rail, the gym page's "similar gyms" row, and two grids - so a single `sizes` cannot
         * be right everywhere. These are the widest it occupies in any of them, which is the
         * safe direction: too large wastes bytes, too small ships a blurry cover.
         */
        sizes="(min-width: 1024px) 42vw, (min-width: 640px) 50vw, 100vw"
        className="aspect-video"
      />

      <div className="p-inset-lg">
        <div className="flex flex-wrap items-start justify-between gap-inline-md">
          <div className="min-w-0">
            <h3 className="gm-h3">
              {/*
               * The card's ONLY anchor for the gym, stretched over the card by `.gm-card-link`.
               *
               * Still not a wrapping `<a>`: nesting the compare link inside it would be invalid
               * HTML and unpredictable for keyboard users, which is what the note here used to
               * say and is still the reason this is a pseudo-element and not a parent element.
               * One tab stop, one accessible name, and the whole card is the target.
               */}
              <Link
                href={`/gyms/${gym.citySlug}/${gym.slug}`}
                className="gm-card-link rounded-control hover:underline"
              >
                {gym.name}
              </Link>
            </h3>
            {/*
             * ┌─ THE PIN AND THE ADDRESS ARE ONE FLEX ITEM, NOT TWO ─────────────────────────┐
             * │ `.gm-card-meta` is `display: flex; flex-wrap: wrap`, and the `<svg>` and the  │
             * │ anonymous text beside it were two items on that wrapping line. A flex line    │
             * │ breaks on an item's HYPOTHETICAL main size, which for auto-width text is its  │
             * │ max-content width - the address on one unbroken line - so the address almost  │
             * │ never "fit" next to a 16px pin and took a line of its own. What that leaves   │
             * │ on screen is a location marker hanging over nothing, with the place it marks  │
             * │ on the line below it.                                                         │
             * │                                                                               │
             * │ Cards whose pin was stranded, measured in Chromium on the served build:       │
             * │   320  8 of 8    360  6 of 8    390  6 of 8    414  2 of 8    768  0 of 8     │
             * │   1280 / 1440 / 2560  2 of 8, once `xl:grid-cols-2` halves the column back    │
             * │   to roughly 420px and the two longest localities stop fitting again.          │
             * │                                                                               │
             * │ `min-w-0` on the text is NOT the whole fix on its own: the automatic minimum  │
             * │ size clamps a hypothetical size from below, and this one is already at        │
             * │ max-content, so the line still breaks. What fixes it is being one item. The   │
             * │ inner row is `flex` and so does not wrap, which is what makes the pair         │
             * │ inseparable at any width; `min-w-0` is what then lets that row shrink past    │
             * │ its longest word instead of overflowing the card.                              │
             * │                                                                               │
             * │ `items-start`, not `items-center`: when the address does take two lines the   │
             * │ pin belongs beside the first of them, not floating in the gap between them.   │
             * └───────────────────────────────────────────────────────────────────────────────┘
             */}
            <p className="gm-card-meta mt-stack-2xs">
              <span className="flex items-start gap-inline-2xs">
                <Place aria-hidden="true" className="h-[1rem] w-[1rem] shrink-0" />
                <span className="min-w-0">
                  {gym.locality}, {gym.city} ·{' '}
                  {t('web.gym.distanceFromCentre').replace('{km}', gym.distanceKm.toFixed(1))}
                </span>
              </span>
            </p>
          </div>

          {/*
           * NOT `text-right`, and the reason only shows up at some card widths.
           *
           * This row is `flex-wrap`. When the card is wide the price block sits at the right end
           * of it and right-aligned text looks deliberate. When the card is narrow - the two-column
           * city grid, the "similar gyms" row - the block WRAPS onto its own line, and a wrapped
           * flex item is only as wide as its widest child. That child is "PER MONTH, FROM" at
           * 133px; "₹3,499" is 88px; right-aligned inside it, the amount started 45px in from the
           * card's own left edge, while the gym's name, its locality and the label underneath all
           * started at 0. An indent with nothing on its left, which is what it looked like.
           *
           * Aligned to the start, the two lines agree with each other in both states and with
           * every other line on the card.
           */}
          <div>
            {/* The same money treatment the home rail uses - one price, one voice. */}
            <p className="gm-card-amount">{formatMinor(gym.fromPriceMinor)}</p>
            <p className="gm-card-per">{t('web.gym.perMonthFrom')}</p>
          </div>
        </div>

        <div className="mt-stack-sm flex flex-wrap items-center gap-inline-sm">
          <Rating rating={gym.rating} reviewCount={gym.reviewCount} />
          {/*
           * `BR-GYM-01` — nothing is listed before a human approves it, so this badge means
           * something specific. Icon AND word, never colour alone (`AX8`).
           */}
          {gym.verified && (
            <span className="gm-card-badge gm-card-badge-inline">
              <Verified aria-hidden="true" className="h-[0.875rem] w-[0.875rem]" weight="fill" />
              {t('web.gym.verified')}
            </span>
          )}
        </div>

        <ul className="mt-stack-sm flex flex-wrap gap-inline-xs">
          {gym.amenities.slice(0, AMENITIES_SHOWN).map((amenity) => (
            <li key={amenity} className="gm-tag">
              {amenity}
            </li>
          ))}
          {hidden > 0 && (
            <li className="px-inset-2xs py-inset-2xs text-xs text-content-muted">
              {t('web.gym.amenitiesMore').replace('{count}', String(hidden))}
            </li>
          )}
        </ul>

        {/*
         * ┌─ A TOGGLE THAT ACCUMULATES, AND IT USED TO BE A CONTROL THAT UNDID ITSELF ───────────┐
         * │ ADR-0050. This was `toCompareParams([compareKey(gym)])`: an href to `/compare` naming │
         * │ ONE gym, under the label "Add to compare". Measured from                              │
         * │ `/search?city=bengaluru&sort=rating`, pressing it went to                             │
         * │ `/compare?gym=bengaluru%2Firon-house-indiranagar` - the city gone, the sort gone, the │
         * │ rail absent, and the selection replaced rather than added to. On the one surface      │
         * │ where a person actually shortlists, the second click undid the first.                  │
         * │                                                                                       │
         * │ The card could not do better while it did not know the selection, and the note here   │
         * │ used to say exactly that. It is a PROP now: the set is already in the URL and every   │
         * │ route rendering this card reads `searchParams` already, so nothing was added to learn │
         * │ it - no store, no context, no `'use client'`. The href names the NEXT selection on    │
         * │ THIS page, which is what the home teaser has always done via `railToggleHref`.        │
         * │                                                                                       │
         * │ INDEXING (`FR-SRCH-13`): `?gym=` on `/gyms/[citySlug]` and `/explore/[activitySlug]`  │
         * │ mints no second indexable address. Read out of the served build, both routes'         │
         * │ `generateMetadata` takes `params` only and hardcodes its canonical - `/gyms/bengaluru` │
         * │ and `/explore/yoga` came back byte-identical with and without two `gym` parameters -  │
         * │ so every selection consolidates on the bare landing, the way `/?gym=a&gym=b` already  │
         * │ consolidates on `/`.                                                                   │
         * └───────────────────────────────────────────────────────────────────────────────────────┘
         */}
        {atLimit ? (
          /*
           * At the cap the control becomes a statement.
           *
           * A sentence and not a greyed pill: the copy is "That is the maximum. Remove one to
           * swap in another.", which is a sentence rather than a button label, and a bordered
           * 44px pill wrapped round it would be an affordance for a click that does nothing.
           * `chalk.tsx` reaches the same conclusion on the home rail and dims a `.gm-card-add`;
           * the dimming is what is not copied - `opacity` on `content-secondary` ink lands the
           * one line a reader needs under `SC 1.4.3`'s 4.5:1, and there is nothing to press.
           *
           * A `<p>` also leaves the tab order, which is the honest half: at the limit this card
           * offers nothing, and eight dead tab stops is worse than eight sentences.
           */
          <p className="mt-stack-sm text-sm text-content-secondary">
            {t('web.compare.rail.full').replace('{max}', String(MAX_COMPARE))}
          </p>
        ) : (
          /*
           * `gm-hit-target` is gone from here on purpose. It reaches 44px by growing an `::after`
           * OUTWARD, and this card is `overflow: hidden` - the pseudo-element is clipped by the
           * card, so the rule reported itself satisfied while the reachable area stayed at the
           * padding's 40px. `.gm-card-add` has 44px of real height and 18px of inline padding,
           * which nothing can clip.
           */
          <Link
            href={toggleHref(selected, gym, base)}
            /*
             * The toggle stays on this page, so the page must not jump. Same rule the facets, the
             * sort and the active-filter chips follow in `search-results.tsx`, and the reason is
             * measured there: at 390px, a tap at scrollY 1400 landed at 86. Focus survives the
             * navigation on the link itself, which is what §3.2 asks for - the reader adds a
             * second gym without leaving the card they were reading.
             */
            scroll={false}
            className="gm-card-add mt-stack-sm rounded-control text-sm font-semibold"
          >
            {/*
             * The label states what the click does, and `aria-pressed` would be wrong for the
             * same reason it is wrong on the home rail: this is a link that navigates, not a
             * control that holds state. So the WORD changes instead.
             */}
            {t(chosen ? 'web.gym.compare.remove' : 'web.gym.compare.add')}
            <span className="gm-visually-hidden">: {gym.name}</span>
          </Link>
        )}
      </div>
    </li>
  );
}

function Rating({ rating, reviewCount }: { rating: number | null; reviewCount: number }) {
  const Star = icon.reviews;

  if (rating === null) {
    return (
      <span className="text-xs font-medium text-content-muted">{t('web.gym.newListing')}</span>
    );
  }

  return (
    <span className="inline-flex items-center gap-inline-2xs text-xs text-content-secondary">
      <Star
        aria-hidden="true"
        className="h-[0.875rem] w-[0.875rem] text-content-warning"
        weight="fill"
      />
      <span className="font-semibold tabular-nums text-content">{rating.toFixed(1)}</span>
      <span className="text-content-muted">
        {`(${reviewCount.toLocaleString('en-IN')} ${
          reviewCount === 1 ? t('web.gym.reviews.one') : t('web.gym.reviews.many')
        })`}
      </span>
    </span>
  );
}
