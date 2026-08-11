/**
 * `SCR-WEB-008` — a city landing. Server-rendered (`§C1.1`, `FR-SRCH-13`, ADR-0019).
 *
 * `app/` is routing only (`F1`): resolve the slug, 404 when it resolves to nothing, hand the
 * landing to the feature.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CompareRail } from '../../../src/features/compare/compare-rail.tsx';
import { parseCompare } from '../../../src/features/compare/compare.ts';
import type { RawParams } from '../../../src/features/discovery/search.ts';
import { toJsonLd } from '../../../src/features/gym-detail/json-ld.ts';
import { cityLanding, toItemList } from '../../../src/features/landings/landings.ts';
import { cityLandingMetadata } from '../../../src/features/landings/landing-metadata.ts';
import { CityLandingView } from '../../../src/features/landings/landing-views.tsx';
import { SITE_URL } from '../../../src/shared/seo/site.ts';

/** The origin structured data resolves against. Configured, never guessed from a request. */

interface RouteParams {
  readonly params: { readonly citySlug: string };
}

/**
 * The page also reads `?gym=`, because the compare selection lives in the URL (`FR-CMP-01`).
 *
 * ┌─ `?gym=` MINTS NO SECOND INDEXABLE ADDRESS FOR THIS LANDING (`FR-SRCH-13`) ─────────────────┐
 * │ Checked on the served build before the hrefs changed: `/gyms/bengaluru` and                  │
 * │ `/gyms/bengaluru?gym=bengaluru/iron-house-indiranagar&gym=delhi/pulse-fitness-saket` came    │
 * │ back with the identical `<title>` and the identical                                          │
 * │ `<link rel="canonical" href="https://gymmap.in/gyms/bengaluru">`, and no `robots` meta on    │
 * │ either. That is not luck: `generateMetadata` below takes `params` ONLY, and                  │
 * │ `cityLandingMetadata` hardcodes `canonical: /gyms/<slug>`. Every selection consolidates on   │
 * │ the bare landing, exactly as `/?gym=a&gym=b` already consolidates on `/`.                     │
 * │                                                                                              │
 * │ So the rule for anyone extending this: `generateMetadata` must keep taking `params` only.    │
 * │ The moment it reads `searchParams`, the hundreds of subsets of the catalogue this page now   │
 * │ links to become hundreds of thin near-duplicates of the page a crawler already has.          │
 * │                                                                                              │
 * │ `robots.ts` deliberately disallows nothing (`seo.spec.ts`), so the canonical is the whole    │
 * │ mechanism and it has to stay the whole mechanism.                                             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
interface RouteProps extends RouteParams {
  readonly searchParams: RawParams;
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

export default function CityRoute({ params, searchParams }: RouteProps) {
  const landing = cityLanding(params.citySlug);
  // `notFound()` and not an empty landing: a 200 on a city that does not exist is a soft-404, and
  // a crawler keeps the dead URL indexed and keeps returning to it.
  if (landing === null) notFound();

  const { gyms: selected } = parseCompare(searchParams);
  /*
   * `landing.slug` and not `params.citySlug`. The two differ whenever the request carries a
   * casing or an alias the resolver normalises, and a base built from the raw parameter would
   * hand the reader a URL a redirect then rewrites - losing the selection on the way.
   */
  const base = { path: `/gyms/${landing.slug}` };

  return (
    <>
      {/* `toJsonLd`, not `JSON.stringify` — every name below is text a gym owner typed. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(toItemList(landing.gyms, SITE_URL.origin)) }}
      />
      <CityLandingView landing={landing} selected={selected} base={base} />
      {/* Last in the document, and only on the routes that show gyms — ADR-0050, not the layout. */}
      <CompareRail selected={selected} base={base} />
    </>
  );
}
