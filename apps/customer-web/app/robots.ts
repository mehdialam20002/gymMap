/**
 * `/robots.txt` — the first request a crawler makes, and it returned 404.
 *
 * `app/` is routing only (`F1`): the address and the rule about what is indexable live in
 * `src/shared/seo/site.ts`, and this file only shapes them into the format the route emits.
 */

import type { MetadataRoute } from 'next';

import { SITE_URL, absolute } from '../src/shared/seo/site.ts';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        /*
         * Disallowed rather than merely `noindex`, because these two are different instructions and
         * the pages need both. `noindex` says "do not list this"; it is obeyed only AFTER the page
         * is fetched, so a crawler still spends its budget on every one of them. `Disallow` says
         * "do not fetch this at all".
         *
         * `/compare` and the faceted search are the reason it matters here. Both take arbitrary
         * query strings - the compare rail alone can address four gyms out of eight - so left open
         * they are an unbounded set of URLs serving near-identical pages, and the crawl budget that
         * should reach the city and activity landings goes there instead.
         */
        disallow: ['/account', '/checkout', '/compare', '/search?'],
      },
    ],
    sitemap: absolute('/sitemap.xml'),
    host: SITE_URL.host,
  };
}
