/**
 * `SCR-WEB-002` — search results. Server-rendered (`§C1.1`, `FR-SRCH-13`, ADR-0019).
 *
 * `app/` is routing only (`F1`): this file reads the URL and hands it to the feature. Every line
 * of behaviour lives in `src/features/discovery/`.
 */

import type { Metadata } from 'next';

import { t } from '../../src/shared/i18n/index.ts';
import { CITIES } from '../../src/features/discovery/fixtures/catalogue.ts';
import {
  hasActiveFilters,
  parseSearchQuery,
  search,
  toSearchParams,
  type RawParams,
  type SearchQuery,
} from '../../src/features/discovery/search.ts';
import { SearchResults } from '../../src/features/discovery/search-results.tsx';
import { RestoreScroll } from '../../src/features/discovery/restore-scroll.tsx';
import { parseCompare } from '../../src/features/compare/compare.ts';
import { CompareRail } from '../../src/features/compare/compare-rail.tsx';

/**
 * ┌─ THE TITLE IS THE ANNOUNCEMENT ON A FULL PAGE LOAD ─────────────────────────────────────────┐
 * │ The count on the page sits in an `aria-live` region, and that region only ever fires for a  │
 * │ CLIENT navigation. Measured: a marker stamped on the `<p aria-live>` survived a facet click  │
 * │ while its text went "8 verified gyms" -> "3 verified gyms". After submitting the search box  │
 * │ the marker was null - the box is a real GET `<form action="/search">`, so it loads a fresh   │
 * │ document, and a live region that is already there when the document is parsed announces      │
 * │ nothing. The one result sat in a brand-new region and was never spoken.                       │
 * │                                                                                              │
 * │ On a fresh document the `<title>` is what a screen reader speaks first, so that is where the │
 * │ result of the search has to be. It was not: `/search`, `/search?city=bengaluru` and          │
 * │ `/search?city=bengaluru&rating=4.5` all shipped the identical "Verified gyms · GYM MAP" over  │
 * │ result sets of 8, 3 and 2.                                                                    │
 * │                                                                                              │
 * │ It is also what a person reads in a tab and in their own history, which is the same problem  │
 * │ wearing different clothes: five open tabs of a comparison all named the same thing.           │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * A description per query, so a filtered view is not a duplicate of every other filtered view.
 *
 * `FR-SRCH-13` wants these pages indexed. Identical titles across thousands of facet combinations
 * are what makes a search engine pick one and drop the rest.
 */
export function generateMetadata({ searchParams }: { searchParams: RawParams }): Metadata {
  const query = parseSearchQuery(searchParams);

  return {
    title: `${resultScope(query)} · GYM MAP`,
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

/**
 * The part of the title before the brand: how many, and what narrowed it.
 *
 * `search()` runs a second time here, once for the metadata and once for the page. It is a pure
 * filter over an in-memory fixture, so the duplicate is a few microseconds; when this becomes a
 * query it wants `React.cache` around the call, not a count smuggled through a module variable.
 *
 * The branch order is the order a reader would name their own search: their own words first, the
 * city second. A view narrowed by rating or price alone falls through to the bare count, which
 * still separates it from the unfiltered page - `?rating=4.5` returns a different number.
 */
function resultScope(query: SearchQuery): string {
  const count = search(query).length;

  if (count === 0) return t('web.search.title.none');

  /*
   * Singular and plural are SEPARATE KEYS, not one key with the noun pluralised by the caller.
   *
   * This was first written as a fallback: at one result the title dropped to the bare count
   * phrase, because "{n} gyms in {city}" renders "1 gyms in Bengaluru" and `/search?q=yoga`
   * returns exactly one gym today. That kept the grammar and lost the filter's NAME from the
   * first thing a screen reader speaks on a full page load, which is the wrong half to give up.
   *
   * Two more keys is the answer, and it is also the answer a translator needs: English has two
   * plural forms and Hindi has two with different rules, so a count interpolated into one string
   * is a sentence that can only ever be correct in one language.
   */
  if (query.q !== '') {
    const key = count === 1 ? 'web.search.title.termOne' : 'web.search.title.term';
    return t(key).replace('{n}', String(count)).replace('{q}', query.q);
  }

  if (query.city !== null) {
    // The city's NAME, not its slug, for the same reason the removable chip uses it: "bengaluru"
    // and "new-delhi" are URL, and a title is read aloud.
    const named = CITIES.find((city) => city.slug === query.city);
    const key = count === 1 ? 'web.search.title.filteredOne' : 'web.search.title.filtered';
    return t(key)
      .replace('{n}', String(count))
      .replace('{city}', named?.name ?? query.city);
  }

  if (count === 1) return `${String(count)} ${t('web.search.count.one')}`;

  if (hasActiveFilters(query)) return `${String(count)} ${t('web.search.count.many')}`;

  // Nothing is narrowing it, so there is nothing to announce and the canonical page keeps the
  // stable name it is indexed under.
  return t('web.search.metaTitle.any');
}

export default function SearchPage({ searchParams }: { searchParams: RawParams }) {
  const query = parseSearchQuery(searchParams);
  /*
   * ┌─ THE SELECTION AND THE PAGE TO COME BACK TO — ADR-0050 ────────────────────────────────────┐
   * │ `parseSearchQuery` and `parseCompare` read the SAME `searchParams` and take disjoint halves │
   * │ of it: the filters, and `gym`. Neither can see the other's parameters, which is why adding  │
   * │ a comparison here changes no result set and why `toSearchParams(query)` cannot re-emit a    │
   * │ `gym` - it writes only the filters it knows.                                                 │
   * │                                                                                             │
   * │ That is exactly what makes it the right base. Measured before this change, the results      │
   * │ page's "Add to compare" went to `/compare?gym=<one gym>` from                                │
   * │ `/search?city=bengaluru&sort=rating` - city gone, sort gone, rail absent, selection          │
   * │ replaced. The base is now the reader's own query, so the toggle returns them to it.          │
   * │                                                                                             │
   * │ No fragment: this page has no anchor worth naming, and the cards carry `scroll={false}`      │
   * │ instead, which is the rule every in-page link in `search-results.tsx` already follows.       │
   * │                                                                                             │
   * │ Computed once and given to both the results and the rail. Two calls would be two chances    │
   * │ to disagree about which page the reader is on.                                               │
   * └─────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const { gyms: selected } = parseCompare(searchParams);
  const base = { path: toSearchParams(query) };

  return (
    <>
      {/*
       * Mounted HERE and not in the root layout, deliberately. Every other route on this site
       * restores its scroll position correctly on Back; only this one has a Suspense boundary
       * shorter than its own content, which is what made the browser restore against a skeleton
       * and land a reader who was at 1,276px back at 379. A component that scrolls the page is a
       * component that can scroll it wrong, so it runs on the one route that needs it.
       */}
      <RestoreScroll />
      <SearchResults query={query} selected={selected} base={base} />
      {/* Last in the document, which is also where it sits on screen. A fixed bar declared early
          would reach a screen reader before the results it is about. */}
      <CompareRail selected={selected} base={base} />
    </>
  );
}
