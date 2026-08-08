/**
 * `SCR-WEB-007` — what happens after payment. `app/` is routing only (`F1`).
 */

import type { Metadata } from 'next';

import { t } from '../../../src/shared/i18n/index.ts';
import { Confirmation } from '../../../src/features/checkout/confirmation.tsx';

export const metadata: Metadata = {
  title: `${t('web.confirmation.title')} · GymMap`,
  description: t('web.confirmation.metaDescription'),
  robots: { index: false, follow: false },
};

export default function ConfirmationRoute() {
  return <Confirmation />;
}
