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
import { compareKey, toCompareParams } from '../compare/compare.ts';
import { GymPhoto } from './gym-photo.tsx';
import { formatMinor } from './search.ts';
import type { SearchResult } from './fixtures/catalogue.ts';

/** How many amenities fit before the row starts wrapping into noise. */
const AMENITIES_SHOWN = 3;

export function GymCard({ gym }: { readonly gym: SearchResult }) {
  const Verified = icon.verified;
  const Place = icon.place;
  const hidden = gym.amenities.length - AMENITIES_SHOWN;

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
            <p className="gm-card-meta mt-stack-2xs flex items-center gap-inline-2xs">
              <Place aria-hidden="true" className="h-[1rem] w-[1rem] shrink-0" />
              {gym.locality}, {gym.city} ·{' '}
              {t('web.gym.distanceFromCentre').replace('{km}', gym.distanceKm.toFixed(1))}
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
          <span className="gm-card-badge gm-card-badge-inline">
            <Verified aria-hidden="true" className="h-[0.875rem] w-[0.875rem]" weight="fill" />
            {t('web.gym.verified')}
          </span>
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
         * ┌─ A LINK THAT STARTS A COMPARISON, NOT A TOGGLE THAT REMEMBERS ONE ───────────────────┐
         * │ The card cannot know what is already being compared — the set lives in the compare    │
         * │ page's URL, and this card is rendered on the home page, the results page and three    │
         * │ gym pages. So it does the one thing it CAN state truthfully: it opens a comparison    │
         * │ containing this gym, and the compare page's picker adds the rest.                      │
         * │                                                                                       │
         * │ The alternative is a checkbox backed by client state, which is the tray every other   │
         * │ marketplace ships and the reason none of their comparisons can be shared.              │
         * └───────────────────────────────────────────────────────────────────────────────────────┘
         */}
        {/*
         * `gm-hit-target` is gone from here on purpose. It reaches 44px by growing an `::after`
         * OUTWARD, and this card is `overflow: hidden` - the pseudo-element is clipped by the
         * card, so the rule reported itself satisfied while the reachable area stayed at the
         * padding's 40px. `.gm-card-add` now has 44px of real height, which nothing can clip.
         */}
        <Link
          href={toCompareParams([compareKey(gym)])}
          className="gm-card-add mt-stack-sm rounded-control text-sm font-semibold"
        >
          {t('web.gym.compare.add')}
          <span className="gm-visually-hidden">: {gym.name}</span>
        </Link>
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
