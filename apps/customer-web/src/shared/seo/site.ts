/**
 * The site's own address, and the list of URLs it is willing to be found at.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS AT ALL
 *
 * The stack is locked on Next.js "server-rendered for SEO" and `FR-SRCH-13` asks for crawlable
 * entry points, which is the entire reason `/gyms/[citySlug]` and `/explore/[activitySlug]` were
 * built. Read out of the SERVED HTML rather than the source, three things were missing:
 *
 *   - `/robots.txt` returned 404. That is the first request a crawler makes.
 *   - `/sitemap.xml` returned 404, so the landings `FR-SRCH-13` exists to create were reachable
 *     only by following internal links.
 *   - `/` and `/search` shipped no `<link rel="canonical">`. On the home page that is not cosmetic:
 *     the compare rail puts the selection in the URL (`FR-CMP-01`), so `/?gym=a&gym=b` is a real,
 *     linkable, shareable address for the same page, and there are `4^8` of them.
 *
 * None of that is visible in a component. It is visible in a response, which is where it was found.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { CATALOGUE } from '../../features/discovery/fixtures/catalogue.ts';
import { activityIndex, cityIndex } from '../../features/landings/landings.ts';

/**
 * `gymmap.in` — the domain the specification already uses throughout (`Admin.md`, the operator
 * addresses in `Authentication.md`), not one invented here. Overridable so a preview deployment
 * does not advertise the production host as its canonical, which is how a staging build ends up
 * ranking instead of the real one.
 *
 * A bare `metadataBase` matters beyond canonicals: without it Next resolves every absolute-URL
 * field - Open Graph images especially - against `localhost`, silently, in a production build.
 */
export const SITE_URL = new URL(process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://gymmap.in');

/**
 * Everything a crawler is invited to index, as paths.
 *
 * Built from the same fixtures the pages render from, so a city added to the catalogue appears in
 * the sitemap without anybody remembering to add it. A hand-maintained list is a list that is wrong
 * the first time somebody is busy.
 *
 * Deliberately ABSENT, and each for its own reason:
 *   - `/account/*`, `/checkout*` — one member's records and a half-finished transaction. They are
 *     `noindex` already; listing them in a sitemap would be a contradiction a crawler reports.
 *   - `/compare` — thin without parameters and infinite with them.
 *   - `/search?…` — the faceted views. Their canonical points at bare `/search`; the landings are
 *     the indexable per-city and per-activity pages, which is what they were built for.
 */
export function indexablePaths(): readonly string[] {
  return [
    '/',
    '/search',
    '/cities',
    '/explore',
    '/how-it-works',
    '/for-gyms',
    '/about',
    ...cityIndex().map((city) => `/gyms/${city.slug}`),
    ...activityIndex().map((activity) => `/explore/${activity.slug}`),
    ...CATALOGUE.map((gym) => `/gyms/${gym.citySlug}/${gym.slug}`),
  ];
}

/** An absolute URL for a path, so nothing has to remember to join these by hand. */
export function absolute(path: string): string {
  return new URL(path, SITE_URL).toString();
}
