/**
 * `SCR-WEB-020` — how it works, for a member. `app/` is routing only (`F1`).
 */

import type { Metadata } from 'next';

import { t } from '../../src/shared/i18n/index.ts';
import { HowItWorksPage } from '../../src/features/marketing/how-it-works.tsx';

export const metadata: Metadata = {
  title: `${t('web.howItWorks.title')} · GymMap`,
  description: t('web.howItWorks.metaDescription'),
  alternates: { canonical: '/how-it-works' },
};

export default function Route() {
  return <HowItWorksPage />;
}
