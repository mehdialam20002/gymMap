/**
 * `SCR-WEB-008` — a city landing. Server-rendered (`§C1.1`, `FR-SRCH-13`, ADR-0019).
 *
 * `app/` is routing only (`F1`): resolve the slug, 404 when it resolves to nothing, hand the
 * landing to the feature.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { toJsonLd } from '../../../src/features/gym-detail/json-ld.ts';
import { cityLanding, toItemList } from '../../../src/features/landings/landings.ts';
import { cityLandingMetadata } from '../../../src/features/landings/landing-metadata.ts';
import { CityLandingView } from '../../../src/features/landings/landing-views.tsx';

/** The origin structured data resolves against. Configured, never guessed from a request. */
const ORIGIN = process.env['NEXT_PUBLIC_SITE_ORIGIN'] ?? 'https://gymmap.example';

interface RouteParams {
  readonly params: { readonly citySlug: string };
}

/**
 * Next requires the EXPORT to live in the route file. The copy itself does not, so it does not —
 * `F1`, and `landing-metadata.ts` carries the full reason.
 *
 * The adaptation is spread-conditional rather than a plain assignment because
 * `exactOptionalPropertyTypes` is on: `{ description: undefined }` does not satisfy
 * `description?: string`, and writing the key with no value would also emit an empty meta tag.
 */
export function generateMetadata({ params }: RouteParams): Metadata {
  const meta = cityLandingMetadata(params.citySlug);
  return {
    title: meta.title,
    ...(meta.description === undefined ? {} : { description: meta.description }),
    ...(meta.canonical === undefined ? {} : { alternates: { canonical: meta.canonical } }),
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
