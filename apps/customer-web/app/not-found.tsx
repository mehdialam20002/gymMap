/**
 * 404 — `B6`'s empty/not-found state at the route level.
 *
 * Not a client component: a 404 is server-rendered so a crawler receives the status code with the
 * body, which is what `FR-SRCH-13` needs. A client-rendered 404 returns 200 with an empty shell,
 * and search engines index it.
 */

import type { Metadata } from 'next';

import { t } from '../src/shared/i18n/index.ts';

/*
 * The dead link used to announce itself as the front door.
 *
 * With no `metadata` export this file inherited the root layout's, so `/definitely-not-a-page`
 * answered 404 with `<title>GYM MAP: find and join a gym near you</title>` — measured on the
 * production build, alongside a correct body and a correct route out. On a full page load the
 * title is the first thing a screen reader speaks, and the only thing a tab, a bookmark or a
 * history entry ever shows. The one page whose entire job is to say "this is not what you asked
 * for" was saying the opposite, several seconds before the body was reached.
 *
 * It IS collected here, which is worth stating because `not-found.tsx` is not a `page.tsx`: Next
 * compiles it as the `page` module of the `/_not-found` route — read out of the built
 * `.next/server/app/_not-found/page.js` loader tree — so an unmatched URL resolves it on the
 * ordinary layout-then-page path, not the error-convention one. A route that calls `notFound()`
 * itself has already resolved its own metadata by then and is untouched, which is why
 * `/gyms/nope/nope` keeps its more specific "Gym not found · GYM MAP" (measured, 404).
 *
 * `description` is not decoration on a page nobody indexes: the root layout's description is what
 * Next hands to `og:description` when a route supplies none, so without this a 404 URL pasted into
 * WhatsApp previewed as the home page's pitch.
 *
 * `index: false` is belt and braces rather than a change: Next already emits
 * `<meta name="robots" content="noindex">` on a 404 render (measured on both probed 404s). Saying
 * it here keeps the intent in the file instead of in a framework default. `follow` is deliberately
 * left at its default — the only link out of this page goes to `/search`, which is in the sitemap
 * and should be crawled.
 */
export const metadata: Metadata = {
  title: `${t('web.state.notFound.title')} · GYM MAP`,
  description: t('web.state.notFound.body'),
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="gm-wrap gm-sec gm-sec-tight">
      <h1 className="gm-h2">{t('web.state.notFound.title')}</h1>
      <p className="mt-stack-sm max-w-ui text-base text-content-secondary">
        {t('web.state.notFound.body')}
      </p>
      {/*
       * A real `min-h` on the control, not `gm-hit-target`. Measured at 390px on the production
       * build the painted box is 157.5 x 48, so the padding already clears 44 in both dimensions
       * and the class was buying nothing — while still carrying its failure mode, an absolutely
       * positioned `::after` that any ancestor with a non-visible overflow silently clips away
       * while the class goes on reporting success. (Checked here: `gm-wrap`, `<main>` and the
       * column wrapper are all `overflow: visible`; `<body>` is `overflow-x: hidden`. So nothing
       * was clipped today.) A floor written on the element itself cannot be clipped off it.
       */}
      <a
        href="/search"
        className="mt-stack-lg inline-flex min-h-[2.75rem] items-center rounded-control bg-brand-solid px-inset-lg py-inset-sm text-md font-semibold text-content-on-brand"
        data-on-solid="true"
      >
        {t('web.state.notFound.action')}
      </a>
    </div>
  );
}
