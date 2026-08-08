/**
 * `SCR-WEB-008` — a city landing. Server-rendered (`§C1.1`, `FR-SRCH-13`, ADR-0019).
 *
 * `app/` is routing only (`F1`): resolve the slug, 404 when it resolves to nothing, hand the
 * landing to the feature.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { t } from '../../../src/shared/i18n/index.ts';
import { toJsonLd } from '../../../src/features/gym-detail/json-ld.ts';
import { cityLanding, toItemList } from '../../../src/features/landings/landings.ts';
import { CityLandingView } from '../../../src/features/landings/landing-views.tsx';

/** The origin structured data resolves against. Configured, never guessed from a request. */
const ORIGIN = process.env['NEXT_PUBLIC_SITE_ORIGIN'] ?? 'https://gymmap.example';

interface RouteParams {
  readonly params: { readonly citySlug: string };
}

export function generateMetadata({ params }: RouteParams): Metadata {
  const landing = cityLanding(params.citySlug);
  if (landing === null) return { title: `${t('web.gym.notFound.title')} · GymMap` };

  return {
    title: `${t('web.landing.city.title').replace('{city}', landing.name)} · GymMap`,
    description: t('web.landing.city.metaDescription').replace('{city}', landing.name),
    // One canonical per place. Without it `/gyms/bengaluru` and `/search?city=bengaluru` compete
    // for the same results and a search engine picks — usually the one with less copy on it.
    alternates: { canonical: `/gyms/${landing.slug}` },
  };
}

export default function CityRoute({ params }: RouteParams) {
  const landing = cityLanding(params.citySlug);
  // `notFound()` and not an empty landing: a 200 on a city that does not exist is a soft-404, and
  // a crawler keeps the dead URL indexed and keeps returning to it.
  if (landing === null) notFound();

  return (
    <>
      {/* `toJsonLd`, not `JSON.stringify` — every name below is text a gym owner typed. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(toItemList(landing.gyms, ORIGIN)) }}
      />
      <CityLandingView landing={landing} />
    </>
  );
}
