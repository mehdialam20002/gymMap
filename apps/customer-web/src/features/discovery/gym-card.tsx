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
 * The price is labelled "from" because it is the cheapest plan. An unqualified figure next to a
 * gym name is read as *the* price, and the member finds out otherwise at checkout — which is the
 * exact expectation `BR-PLN-03` exists to protect.
 */

import Link from 'next/link';

import { t } from '../../shared/i18n/index.ts';
import { formatMinor } from './search.ts';
import type { SearchResult } from './fixtures/catalogue.ts';

export function GymCard({ gym }: { readonly gym: SearchResult }) {
  return (
    <li className="rounded-card border border-subtle bg-surface p-inset-lg shadow-xs transition-colors duration-fast dark:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-inline-md">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-content">
            {/* The whole card is not a link — a nested link (the city facet below) inside an
                anchor is invalid HTML and behaves unpredictably for keyboard users. */}
            <Link
              href={`/gyms/${gym.citySlug}/${gym.slug}`}
              className="rounded-control hover:underline"
            >
              {gym.name}
            </Link>
          </h2>
          <p className="mt-stack-2xs text-base text-content-secondary">
            {gym.locality}, {gym.city} · {gym.distanceKm.toFixed(1)} km
          </p>
        </div>

        <div className="text-right">
          <p className="text-lg font-semibold text-content">{formatMinor(gym.fromPriceMinor)}</p>
          <p className="text-sm text-content-muted">{t('web.gym.perMonthFrom')}</p>
        </div>
      </div>

      <div className="mt-stack-sm flex flex-wrap items-center gap-inline-sm">
        <Rating rating={gym.rating} reviewCount={gym.reviewCount} />
        {/* BR-GYM-01 — nothing is listed before a human approves it, so the badge means
            something specific and is worth showing. */}
        <span className="rounded-control bg-surface-success-subtle px-inset-xs py-inset-2xs text-sm font-medium text-content-success">
          {t('web.gym.verified')}
        </span>
      </div>

      <ul className="mt-stack-sm flex flex-wrap gap-inline-xs">
        {gym.categories.map((category) => (
          <li
            key={category}
            className="rounded-control bg-surface-sunken px-inset-xs py-inset-2xs text-sm text-content-secondary"
          >
            {category}
          </li>
        ))}
      </ul>
    </li>
  );
}

function Rating({ rating, reviewCount }: { rating: number | null; reviewCount: number }) {
  if (rating === null) {
    return (
      <span className="text-sm font-medium text-content-muted">{t('web.gym.newListing')}</span>
    );
  }

  return (
    <span className="text-sm text-content-secondary">
      <span className="font-semibold text-content">{rating.toFixed(1)}</span>
      {' ★ '}
      <span className="text-content-muted">
        {`(${reviewCount.toLocaleString('en-IN')} ${
          reviewCount === 1 ? t('web.gym.reviews.one') : t('web.gym.reviews.many')
        })`}
      </span>
    </span>
  );
}
