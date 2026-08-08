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
  };
}

export default function SearchPage({ searchParams }: { searchParams: RawParams }) {
  return <SearchResults query={parseSearchQuery(searchParams)} />;
}
