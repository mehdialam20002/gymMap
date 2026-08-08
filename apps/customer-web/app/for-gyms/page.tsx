/**
 * `SCR-WEB-030` — the owner-facing marketing page. `app/` is routing only (`F1`).
 */

import type { Metadata } from 'next';

import { t } from '../../src/shared/i18n/index.ts';
import { ForGymsPage } from '../../src/features/marketing/for-gyms.tsx';

export const metadata: Metadata = {
  title: `${t('web.forGyms.title')} · GymMap`,
  description: t('web.forGyms.metaDescription'),
  alternates: { canonical: '/for-gyms' },
};

export default function Route() {
  return <ForGymsPage />;
}
