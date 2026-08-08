/**
 * `SCR-WEB-005` — checkout review. `app/` is routing only (`F1`).
 */

import type { Metadata } from 'next';

import { t } from '../../src/shared/i18n/index.ts';
import type { RawParams } from '../../src/features/discovery/search.ts';
import { parseCheckout } from '../../src/features/checkout/quote.ts';
import { Checkout } from '../../src/features/checkout/checkout.tsx';

export const metadata: Metadata = {
  title: `${t('web.checkout.title')} · GymMap`,
  description: t('web.checkout.metaDescription'),
  /*
   * A checkout is one member's transaction in progress. It has nothing to offer a search result
   * and every reason not to appear in one, so it is excluded outright — `noindex, nofollow`,
   * unlike compare, whose outbound links are worth crawling.
   */
  robots: { index: false, follow: false },
};

export default function CheckoutRoute({ searchParams }: { searchParams: RawParams }) {
  return <Checkout selection={parseCheckout(searchParams)} />;
}
