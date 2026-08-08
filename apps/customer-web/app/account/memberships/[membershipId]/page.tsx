/**
 * `SCR-WEB-01x` — a membership's check-in credential. `app/` is routing only (`F1`).
 */

import type { Metadata } from 'next';

import { t } from '../../../../src/shared/i18n/index.ts';
import { CheckInScreen } from '../../../../src/features/account/screens.tsx';

export const metadata: Metadata = {
  title: `${t('web.account.qr.title')} · GymMap`,
  description: t('web.account.metaDescription'),
  robots: { index: false, follow: false },
};

export default function Route({ params }: { params: { membershipId: string } }) {
  return <CheckInScreen membershipId={params.membershipId} />;
}
