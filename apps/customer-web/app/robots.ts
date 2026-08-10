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
    /*
     * ┌─ NO `Disallow`, AND THE FIRST VERSION OF THIS FILE HAD FOUR OF THEM ───────────────────────┐
     * │ It disallowed `/account`, `/checkout`, `/compare` and `/search?`, reasoning about crawl     │
     * │ budget. The reasoning was right about what `Disallow` does and wrong about what it costs:   │
     * │ it stops the FETCH, and every one of those pages carries a directive that can only be read  │
     * │ by fetching it.                                                                             │
     * │                                                                                             │
     * │     /compare      `robots: { index: false, follow: true }` - and `follow` is the point,     │
     * │                   because the links out of it are the gym pages. Never fetched, never       │
     * │                   followed, and a URL linked from three places that a crawler cannot read   │
     * │                   stays eligible for URL-only indexing: the exact outcome `noindex` exists  │
     * │                   to prevent, now unreachable.                                              │
     * │     /search?      `canonical: '/search'`, added so the faceted URLs consolidate. Blocked,   │
     * │                   the canonical is never read and the six category links from the home page │
     * │                   are stranded instead of consolidated.                                      │
     * │     /account      `noindex, nofollow`, for the same reason: blocked, it is never read.       │
     * │     /checkout                                                                                │
     * │                                                                                             │
     * │ So the two mechanisms were fighting, and `Disallow` won every time. On a site of forty      │
     * │ pages the budget argument was never worth much; the directives are worth all of it. Every   │
     * │ page that should stay out of the index says so on the page, where a crawler will read it.   │
     * │                                                                                             │
     * │ This file is now what it is actually for: the address of the sitemap.                        │
     * └─────────────────────────────────────────────────────────────────────────────────────────────┘
     */
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: absolute('/sitemap.xml'),
    host: SITE_URL.host,
  };
}
