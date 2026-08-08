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
import { toJsonLd } from '../../../../src/features/gym-detail/json-ld.ts';

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
        // ┌─ `toJsonLd`, NOT `JSON.stringify` ────────────────────────────────────────────────┐
        // │ Every field below is text a GYM OWNER types. `JSON.stringify` escapes `"` because  │
        // │ JSON requires it and leaves `<` alone because JSON does not care — but the HTML     │
        // │ parser is still scanning this element for `</script`, so a description containing   │
        // │ one closes our tag and opens the attacker's. `toJsonLd` escapes it as `\u003c`,  │
        // │ which every JSON parser decodes back, so the structured data is unchanged and the   │
        // │ HTML parser never sees the character.                                                │
        // │                                                                                     │
        // │ (`react/no-danger` is not installed and has no `A-NN` row, so this is prose rather  │
        // │ than a disable comment for a rule that does not exist.)                              │
        // └─────────────────────────────────────────────────────────────────────────────────────┘
        dangerouslySetInnerHTML={{
          __html: toJsonLd({
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
