/**
 * `SCR-WEB-009` — an activity landing. Server-rendered (`§C1.1`, `FR-SRCH-13`, ADR-0019).
 *
 * `app/` is routing only (`F1`).
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { toJsonLd } from '../../../src/features/gym-detail/json-ld.ts';
import { activityLanding, toItemList } from '../../../src/features/landings/landings.ts';
import { activityLandingMetadata } from '../../../src/features/landings/landing-metadata.ts';
import { ActivityLandingView } from '../../../src/features/landings/landing-views.tsx';

const ORIGIN = process.env['NEXT_PUBLIC_SITE_ORIGIN'] ?? 'https://gymmap.example';

interface RouteParams {
  readonly params: { readonly activitySlug: string };
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

export default function ActivityRoute({ params }: RouteParams) {
  const landing = activityLanding(params.activitySlug);
  if (landing === null) notFound();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(toItemList(landing.gyms, ORIGIN)) }}
      />
      <ActivityLandingView landing={landing} />
    </>
  );
}
