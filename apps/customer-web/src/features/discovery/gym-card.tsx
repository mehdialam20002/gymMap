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

import Image from 'next/image';
import Link from 'next/link';

import { t } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';
import { compareKey, toCompareParams } from '../compare/compare.ts';
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
      <Link href={`/gyms/${gym.citySlug}/${gym.slug}`} className="block">
        {/*
         * 16:9 via `aspect-video` rather than a fixed height: a fixed height crops differently at
         * every breakpoint and is the usual reason a card grid goes ragged on a tablet.
         *
         * `sizes` matters more than it looks — without it Next serves the largest candidate to
         * every viewport, which is `NFR-PERF-02`'s budget spent on a phone that needed a third of
         * the pixels.
         *
         * ┌─ `width`/`height`, NOT `fill` — AND THE CSP IS THE REASON ───────────────────────────┐
         * │ `fill` is the natural choice for a photo inside an aspect-ratio box, and it was the   │
         * │ first version. It renders `style="position:absolute;height:100%;width:100%;…"` on the │
         * │ `<img>` — and `style-src` carries a nonce, which by CSP-3 §6.7.3.2 blocks EVERY       │
         * │ inline style including attributes, because nonces do not apply to attributes at all.  │
         * │                                                                                       │
         * │ So the browser dropped the positioning and kept the markup. The photo still looked    │
         * │ roughly right in a screenshot — it was being clipped by `overflow-hidden` at its       │
         * │ natural size instead of covering the box — which is exactly the kind of near-miss     │
         * │ that ships. `getComputedStyle(img).position` said `static`; that is how it was found.  │
         * │                                                                                       │
         * │ Intrinsic dimensions plus `h-full w-full object-cover` do the same job from the       │
         * │ STYLESHEET, so the policy stays strict — no `'unsafe-inline'`, no `style-src-attr`    │
         * │ concession, and the same behaviour in Safari, which does not implement that directive.│
         * │ The ratio 1200×675 is the ratio actually requested from the CDN, so the box the       │
         * │ browser reserves before the bytes arrive is the right one (`NFR-PERF-*`, CLS).         │
         * └───────────────────────────────────────────────────────────────────────────────────────┘
         */}
        <div className="relative aspect-video overflow-hidden bg-surface-sunken">
          <Image
            src={gym.photo}
            alt={gym.photoAlt}
            width={1200}
            height={675}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            // `text-transparent` replaces the `color:transparent` Next sets inline for the same
            // reason as above: it stops alt text painting over the box while the bytes are in
            // flight, and it has to come from the stylesheet to survive the policy.
            className="h-full w-full object-cover text-transparent transition-transform duration-slow ease-standard group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            // §9.4 — a gym owner comparing their own cover across themes must see the same photo.
            data-photo="true"
          />
        </div>
      </Link>

      <div className="p-inset-lg">
        <div className="flex flex-wrap items-start justify-between gap-inline-md">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-content">
              {/* The whole card is not one anchor — a nested link inside an anchor is invalid
                  HTML and behaves unpredictably for keyboard users. */}
              <Link
                href={`/gyms/${gym.citySlug}/${gym.slug}`}
                className="rounded-control hover:underline"
              >
                {gym.name}
              </Link>
            </h3>
            <p className="mt-stack-2xs flex items-center gap-inline-2xs text-sm text-content-secondary">
              <Place aria-hidden="true" className="h-[1rem] w-[1rem] shrink-0" />
              {gym.locality}, {gym.city} · {gym.distanceKm.toFixed(1)} km
            </p>
          </div>

          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums text-content">
              {formatMinor(gym.fromPriceMinor)}
            </p>
            <p className="text-xs text-content-muted">{t('web.gym.perMonthFrom')}</p>
          </div>
        </div>

        <div className="mt-stack-sm flex flex-wrap items-center gap-inline-sm">
          <Rating rating={gym.rating} reviewCount={gym.reviewCount} />
          {/*
           * `BR-GYM-01` — nothing is listed before a human approves it, so this badge means
           * something specific. Icon AND word, never colour alone (`AX8`).
           */}
          <span className="inline-flex items-center gap-inline-2xs rounded-control bg-surface-success-subtle px-inset-xs py-inset-2xs text-xs font-medium text-content-success">
            <Verified aria-hidden="true" className="h-[0.875rem] w-[0.875rem]" weight="fill" />
            {t('web.gym.verified')}
          </span>
        </div>

        <ul className="mt-stack-sm flex flex-wrap gap-inline-xs">
          {gym.amenities.slice(0, AMENITIES_SHOWN).map((amenity) => (
            <li
              key={amenity}
              className="rounded-control bg-surface-sunken px-inset-xs py-inset-2xs text-xs text-content-secondary"
            >
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
        <Link
          href={toCompareParams([compareKey(gym)])}
          className="gm-hit-target mt-stack-sm inline-block rounded-control text-sm font-medium text-content-link hover:underline"
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
