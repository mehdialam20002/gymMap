/**
 * `SCR-WEB-031` — the listing application. `app/` is routing only (`F1`).
 */

import type { Metadata } from 'next';

import { t } from '../../../src/shared/i18n/index.ts';
import { ForGymsSignup } from '../../../src/features/marketing/for-gyms.tsx';

export const metadata: Metadata = {
  title: `${t('web.forGyms.signup.title')} · GYM MAP`,
  description: t('web.forGyms.signup.metaDescription'),
  alternates: { canonical: '/for-gyms/signup' },
};

export default function Route() {
  return <ForGymsSignup />;
}
