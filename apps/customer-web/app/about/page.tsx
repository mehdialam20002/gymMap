/**
 * `SCR-WEB-021` — about. `app/` is routing only (`F1`).
 */

import type { Metadata } from 'next';

import { t } from '../../src/shared/i18n/index.ts';
import { AboutPage } from '../../src/features/marketing/about.tsx';

export const metadata: Metadata = {
  title: `${t('web.about.metaTitle')} · GYM MAP`,
  description: t('web.about.metaDescription'),
  alternates: { canonical: '/about' },
};

export default function Route() {
  return <AboutPage />;
}
