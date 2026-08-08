/**
 * Search, filtering and sorting — `FR-SRCH-01` … `FR-SRCH-08`.
 *
 * ┌─ EVERY PARAMETER COMES FROM THE URL, AND GOES BACK TO IT ───────────────────────────────────┐
 * │ `SCR-WEB-002` keeps its whole state in the query string, which is not a preference. A search │
 * │ that lives in component state cannot be shared, cannot be bookmarked, breaks the back        │
 * │ button, and — the reason `FR-SRCH-13` cares — cannot be crawled. A results page that a       │
 * │ crawler cannot reach is a results page that produces no organic traffic.                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Pure functions over a list. When the discovery endpoints land, the FILTERING moves server-side
 * and this file keeps only the URL parsing — which is why parsing and filtering are separate here
 * rather than one convenient pass.
 */

import { CATALOGUE, type GymDetail, type SearchResult } from './fixtures/catalogue.ts';

export const SORTS = ['relevance', 'price-asc', 'price-desc', 'rating', 'distance'] as const;
export type Sort = (typeof SORTS)[number];

export interface SearchQuery {
  readonly q: string;
  readonly city: string | null;
  readonly category: string | null;
  /** Integer paise, matching the catalogue. A rupee ceiling here would be the classic slip. */
  readonly maxPriceMinor: number | null;
  readonly sort: Sort;
}

/** Anything `URLSearchParams` or Next's `searchParams` can hand over. */
export type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | null => {
  if (value === undefined) return null;
  const single = Array.isArray(value) ? value[0] : value;
  return single === undefined || single.trim() === '' ? null : single.trim();
};

/**
 * Reads a query out of URL parameters, tolerating anything.
 *
 * A search page is linked to from outside, typed into by hand, and hit by crawlers with stale
 * parameters. Every unrecognised value falls back rather than throwing: a 500 on `?sort=cheapest`
 * would be an error page served to a search engine for a URL it will keep trying.
 */
export function parseSearchQuery(params: RawParams): SearchQuery {
  const sortRaw = first(params['sort']);
  const sort = SORTS.find((candidate) => candidate === sortRaw) ?? 'relevance';

  const maxRupees = Number(first(params['maxPrice']) ?? '');
  const maxPriceMinor =
    Number.isFinite(maxRupees) && maxRupees > 0 ? Math.round(maxRupees * 100) : null;

  return {
    q: first(params['q']) ?? '',
    city: first(params['city']),
    category: first(params['category']),
    maxPriceMinor,
    sort,
  };
}

/** Back to a query string, so a filter control can render an href rather than run a handler. */
export function toSearchParams(query: Partial<SearchQuery>): string {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.city) params.set('city', query.city);
  if (query.category) params.set('category', query.category);
  if (query.maxPriceMinor) params.set('maxPrice', String(Math.round(query.maxPriceMinor / 100)));
  if (query.sort && query.sort !== 'relevance') params.set('sort', query.sort);
  const encoded = params.toString();
  return encoded === '' ? '/search' : `/search?${encoded}`;
}

// ---------------------------------------------------------------------------
// Matching.
// ---------------------------------------------------------------------------

/**
 * A term matches a gym's name, locality, city, categories or amenities.
 *
 * Substring rather than a token index, deliberately: this is a fixture, and building a scoring
 * function here would be inventing behaviour that Postgres full-text and trigram will provide
 * differently. What it must NOT do is silently return everything — an over-eager match makes the
 * empty state unreachable, and the empty state is the part most likely to be wrong in production.
 */
function matches(gym: SearchResult, term: string): boolean {
  if (term === '') return true;
  const haystack = [gym.name, gym.locality, gym.city, ...gym.categories, ...gym.amenities]
    .join(' ')
    .toLowerCase();
  // Every word must appear. "yoga bengaluru" should not return every gym in Bengaluru.
  return term
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== '')
    .every((word) => haystack.includes(word));
}

const BY_SORT: Record<Sort, (a: GymDetail, b: GymDetail) => number> = {
  'price-asc': (a, b) => a.fromPriceMinor - b.fromPriceMinor,
  'price-desc': (a, b) => b.fromPriceMinor - a.fromPriceMinor,
  // Unrated gyms go LAST rather than being treated as zero. A new listing is not a bad one, and
  // sorting it below a 1-star gym would make "sort by rating" a penalty for being new.
  rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1),
  distance: (a, b) => a.distanceKm - b.distanceKm,
  relevance: (a, b) => a.distanceKm - b.distanceKm,
};

export function search(query: SearchQuery): readonly GymDetail[] {
  const filtered = CATALOGUE.filter((gym) => {
    if (!matches(gym, query.q)) return false;
    if (query.city !== null && gym.citySlug !== query.city) return false;
    if (query.category !== null && !gym.categories.includes(query.category)) return false;
    if (query.maxPriceMinor !== null && gym.fromPriceMinor > query.maxPriceMinor) return false;
    return true;
  });

  // Copied before sorting. `CATALOGUE` is a module-level constant and `sort` mutates in place —
  // sorting it directly would reorder the catalogue for every later request in the same process,
  // which on a server-rendered page means one visitor's sort leaking into the next one's.
  return [...filtered].sort(BY_SORT[query.sort]);
}

export function findGym(citySlug: string, gymSlug: string): GymDetail | null {
  return CATALOGUE.find((gym) => gym.citySlug === citySlug && gym.slug === gymSlug) ?? null;
}

// ---------------------------------------------------------------------------
// Money.
// ---------------------------------------------------------------------------

/**
 * Integer paise → a rupee string.
 *
 * The ONLY place a division by 100 is allowed. Invariant 2 makes paise the representation
 * everywhere else, and a second conversion site is how one of them ends up rounding differently
 * from the other — which is a money bug that reconciles to a few paise a month and is never found.
 */
export function formatMinor(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    // Whole rupees. Indian plan prices are not quoted in paise, and `₹2,499.00` reads as a
    // machine wrote it.
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}
