/**
 * `SCR-WEB-01x` — the member account. `app/` is routing only (`F1`).
 *
 * `robots: index false, follow false` on every account screen. These are one member's records:
 * nothing here belongs in a search result, and nothing it links to needs crawling either.
 */

import type { Metadata } from 'next';

import { t } from '../../../src/shared/i18n/index.ts';
import { Memberships } from '../../../src/features/account/screens.tsx';

export const metadata: Metadata = {
  title: `${t('web.account.memberships.title')} · GymMap`,
  description: t('web.account.metaDescription'),
  robots: { index: false, follow: false },
};

export default function Route() {
  return <Memberships />;
}
