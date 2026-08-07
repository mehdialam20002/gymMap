/**
 * 404 — `B6`'s empty/not-found state at the route level.
 *
 * Not a client component: a 404 is server-rendered so a crawler receives the status code with the
 * body, which is what `FR-SRCH-13` needs. A client-rendered 404 returns 200 with an empty shell,
 * and search engines index it.
 */

import { t } from '../src/shared/i18n/index.ts';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-container px-inset-md py-region-md">
      <h1 className="text-2xl font-semibold text-content">{t('web.state.notFound.title')}</h1>
      <p className="mt-stack-sm max-w-ui text-base text-content-secondary">
        {t('web.state.notFound.body')}
      </p>
      <a
        href="/search"
        className="gm-hit-target mt-stack-lg inline-block rounded-control bg-brand-solid px-inset-lg py-inset-sm text-md font-semibold text-content-on-brand"
        data-on-solid="true"
      >
        {t('web.state.notFound.action')}
      </a>
    </div>
  );
}
