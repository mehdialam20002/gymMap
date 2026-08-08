/**
 * `SCR-WEB-003` — the gym page. SSR with JSON-LD `LocalBusiness` (`FR-DETL-10`, `FR-SRCH-13`).
 *
 * `app/` is routing only (`F1`): resolve the slugs, 404 when they resolve to nothing, hand the
 * gym to the feature.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { t } from '../../../../src/shared/i18n/index.ts';
import { findGym } from '../../../../src/features/discovery/search.ts';
import { GymDetail } from '../../../../src/features/gym-detail/gym-detail.tsx';

interface RouteParams {
  readonly params: { readonly citySlug: string; readonly gymSlug: string };
}

export function generateMetadata({ params }: RouteParams): Metadata {
  const gym = findGym(params.citySlug, params.gymSlug);
  if (gym === null) return { title: `${t('web.gym.notFound.title')} · GymMap` };

  return {
    title: `${gym.name}, ${gym.locality} · GymMap`,
    description: gym.about.slice(0, 155),
    alternates: { canonical: `/gyms/${gym.citySlug}/${gym.slug}` },
  };
}

export default function GymPage({ params }: RouteParams) {
  const gym = findGym(params.citySlug, params.gymSlug);
  // `notFound()` rather than an "unavailable" panel. A slug that resolves to nothing must answer
  // 404, or a crawler indexes a soft-404 and keeps returning to it.
  if (gym === null) notFound();

  return (
    <>
      {/*
       * `FR-DETL-10` — structured data, so the listing can appear as a rich result. Emitted from
       * the SAME object the page renders: a second hand-maintained copy of the name, address and
       * rating is how structured data ends up contradicting the visible page, which search
       * engines treat as a manipulation signal rather than a bug.
       *
       * `aggregateRating` is omitted entirely when there are no reviews. Emitting `ratingValue: 0`
       * would publish a claim that members rated this gym badly, in machine-readable form, about
       * a business whose only fault is being new (`BR-REV-01`).
       */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- JSON.stringify output, not user HTML
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ExerciseGym',
            name: gym.name,
            description: gym.about,
            address: {
              '@type': 'PostalAddress',
              streetAddress: gym.address,
              addressLocality: gym.city,
              addressCountry: 'IN',
            },
            openingHours: gym.openingHours,
            ...(gym.rating === null
              ? {}
              : {
                  aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: gym.rating,
                    reviewCount: gym.reviewCount,
                  },
                }),
          }),
        }}
      />
      <GymDetail gym={gym} />
    </>
  );
}
