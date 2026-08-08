/**
 * `SCR-WEB-009` — an activity landing. Server-rendered (`§C1.1`, `FR-SRCH-13`, ADR-0019).
 *
 * `app/` is routing only (`F1`).
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { t } from '../../../src/shared/i18n/index.ts';
import { toJsonLd } from '../../../src/features/gym-detail/json-ld.ts';
import { activityLanding, toItemList } from '../../../src/features/landings/landings.ts';
import { ActivityLandingView } from '../../../src/features/landings/landing-views.tsx';

const ORIGIN = process.env['NEXT_PUBLIC_SITE_ORIGIN'] ?? 'https://gymmap.example';

interface RouteParams {
  readonly params: { readonly activitySlug: string };
}

export function generateMetadata({ params }: RouteParams): Metadata {
  const landing = activityLanding(params.activitySlug);
  if (landing === null) return { title: `${t('web.gym.notFound.title')} · GymMap` };

  return {
    title: `${t('web.landing.activity.title').replace('{activity}', landing.name)} · GymMap`,
    description: t('web.landing.activity.metaDescription').replace('{activity}', landing.name),
    alternates: { canonical: `/explore/${landing.slug}` },
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
