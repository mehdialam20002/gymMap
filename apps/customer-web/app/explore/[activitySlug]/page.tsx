/**
 * `SCR-WEB-009` — an activity landing. Server-rendered (`§C1.1`, `FR-SRCH-13`, ADR-0019).
 *
 * `app/` is routing only (`F1`).
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CompareRail } from '../../../src/features/compare/compare-rail.tsx';
import { parseCompare } from '../../../src/features/compare/compare.ts';
import type { RawParams } from '../../../src/features/discovery/search.ts';
import { toJsonLd } from '../../../src/features/gym-detail/json-ld.ts';
import { activityLanding, toItemList } from '../../../src/features/landings/landings.ts';
import { activityLandingMetadata } from '../../../src/features/landings/landing-metadata.ts';
import { ActivityLandingView } from '../../../src/features/landings/landing-views.tsx';
import { SITE_URL } from '../../../src/shared/seo/site.ts';

interface RouteParams {
  readonly params: { readonly activitySlug: string };
}

/**
 * `?gym=` reaches this page too, and adds no indexable address to it — see the long note in the
 * city route, which was checked the same way.
 *
 * Measured on the served build: `/explore/yoga` and `/explore/yoga?gym=…` returned the identical
 * `<title>` and the identical `<link rel="canonical" href="https://gymmap.in/explore/yoga">`.
 * `generateMetadata` below takes `params` only and must keep doing so.
 */
interface RouteProps extends RouteParams {
  readonly searchParams: RawParams;
}

export function generateMetadata({ params }: RouteParams): Metadata {
  // See the note in the city route: composed in `landing-metadata.ts`, adapted here.
  const meta = activityLandingMetadata(params.activitySlug);
  return {
    title: meta.title,
    ...(meta.description === undefined ? {} : { description: meta.description }),
    ...(meta.canonical === undefined ? {} : { alternates: { canonical: meta.canonical } }),
  };
}

export default function ActivityRoute({ params, searchParams }: RouteProps) {
  const landing = activityLanding(params.activitySlug);
  if (landing === null) notFound();

  const { gyms: selected } = parseCompare(searchParams);
  // The resolved slug, not the raw parameter — same reason as the city route.
  const base = { path: `/explore/${landing.slug}` };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(toItemList(landing.gyms, SITE_URL.origin)) }}
      />
      <ActivityLandingView landing={landing} selected={selected} base={base} />
      <CompareRail selected={selected} base={base} />
    </>
  );
}
