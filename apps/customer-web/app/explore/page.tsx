/**
 * `SCR-WEB-00x` — the activity hub. `app/` is routing only (`F1`).
 *
 * A hub exists so every landing has an inbound link from somewhere other than a sitemap. A page
 * a crawler can only reach through a sitemap is a page it reaches last, and re-crawls least.
 */

import type { Metadata } from 'next';

import { t } from '../../src/shared/i18n/index.ts';
import { ExploreIndex } from '../../src/features/landings/landing-views.tsx';

export const metadata: Metadata = {
  title: `${t('web.landing.explore.title')} · GYM MAP`,
  description: t('web.landing.explore.metaDescription'),
  alternates: { canonical: '/explore' },
};

export default function Route() {
  return <ExploreIndex />;
}
