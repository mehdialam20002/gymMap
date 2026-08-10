/**
 * `SCR-WEB-002` — search results. Server-rendered (`§C1.1`, `FR-SRCH-13`, ADR-0019).
 *
 * `app/` is routing only (`F1`): this file reads the URL and hands it to the feature. Every line
 * of behaviour lives in `src/features/discovery/`.
 */

import type { Metadata } from 'next';

import { t } from '../../src/shared/i18n/index.ts';
import { parseSearchQuery, type RawParams } from '../../src/features/discovery/search.ts';
import { SearchResults } from '../../src/features/discovery/search-results.tsx';

/**
 * A description per query, so a filtered view is not a duplicate of every other filtered view.
 *
 * `FR-SRCH-13` wants these pages indexed. Identical titles across thousands of facet combinations
 * are what makes a search engine pick one and drop the rest.
 */
export function generateMetadata({ searchParams }: { searchParams: RawParams }): Metadata {
  const query = parseSearchQuery(searchParams);
  const scope = query.q === '' ? t('web.search.metaTitle.any') : `“${query.q}”`;

  return {
    title: `${scope} · GymMap`,
    description: t('web.search.metaDescription'),
    /*
     * ┌─ ONE CANONICAL FOR EVERY FACET, AND THE NOTE ABOVE WAS HALF TRUE ───────────────────────┐
     * │ The comment above says a filtered view must not be a duplicate of every other filtered   │
     * │ view. It is right, and this function did not achieve it: the title varies by `q` ALONE,  │
     * │ and the description is one constant. Read out of the served HTML, `/search` and          │
     * │ `/search?city=bengaluru` shipped the same `<title>` AND the same description.            │
     * │                                                                                         │
     * │ The fix is not to multiply the facets into thousands of thin near-identical pages. It is │
     * │ the architecture that already exists: `FR-SRCH-13` built `/gyms/[citySlug]` and          │
     * │ `/explore/[activitySlug]` to BE the indexable per-city and per-activity pages, each with │
     * │ its own copy, its own cross-links and its own canonical. So every faceted search URL     │
     * │ consolidates here, and the landings carry the ranking.                                  │
     * │                                                                                         │
     * │ The title still varies, because it is what a person reads in a tab and in their history. │
     * └─────────────────────────────────────────────────────────────────────────────────────────┘
     */
    alternates: { canonical: '/search' },
  };
}

export default function SearchPage({ searchParams }: { searchParams: RawParams }) {
  return <SearchResults query={parseSearchQuery(searchParams)} />;
}
