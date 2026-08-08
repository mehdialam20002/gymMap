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

import { compare, indianAmountParts } from '@gymmap/utils';

import { CATALOGUE, type GymDetail, type SearchResult } from './fixtures/catalogue.ts';

export const SORTS = ['relevance', 'price-asc', 'price-desc', 'rating', 'distance'] as const;
export type Sort = (typeof SORTS)[number];

export interface SearchQuery {
  readonly q: string;
  readonly city: string | null;
  readonly category: string | null;
  /** Integer paise, matching the catalogue. A rupee ceiling here would be the classic slip. */
  readonly maxPriceMinor: bigint | null;
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

  // The URL carries WHOLE RUPEES — `?maxPrice=2500` — so the parse is integer-only by
  // construction. `Math.round(rupees * 100)` on a float would let `?maxPrice=2499.995` become a
  // paise value nobody typed; a non-integer price ceiling is not a filter a user can express, so
  // it falls back to "no ceiling" rather than being silently rounded into one.
  const maxRupeesRaw = first(params['maxPrice']) ?? '';
  const maxPriceMinor = /^\d{1,9}$/.test(maxRupeesRaw)
    ? BigInt(maxRupeesRaw) * 100n
    : null;

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
  // Integer division, and exact: the value only ever arrives here as whole rupees × 100.
  if (query.maxPriceMinor) params.set('maxPrice', String(query.maxPriceMinor / 100n));
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
  // `compare` rather than subtraction: `Array.sort` needs a `number` and bigint subtraction gives
  // a bigint. Coercing the difference with `Number()` would also work until two plan prices
  // differed by more than 2^53 paise, which is the kind of bound nobody writes a test for.
  'price-asc': (a, b) => compare(a.fromPriceMinor, b.fromPriceMinor),
  'price-desc': (a, b) => compare(b.fromPriceMinor, a.fromPriceMinor),
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
 * Integer paise → a rupee string, whole rupees.
 *
 * ┌─ TWO FILES BOTH CLAIMED TO BE "THE ONLY PLACE A DIVISION BY 100 IS ALLOWED" ────────────────┐
 * │ This one and the admin console's figures module, in the same repository, each with a comment │
 * │ saying it was the sole conversion site. Neither was wrong about why that matters — they were  │
 * │ wrong about being alone. `FolderStructure.md` §12 rule 14 already forbade both; there was     │
 * │ simply no lint rule reading it, and this app's `lint` script was `echo "no-op"`.              │
 * │                                                                                              │
 * │ Now the grouping comes from `packages/utils/src/money/`, which is also what the PDF renderer  │
 * │ uses. A plan priced `₹2,499` on the gym page and `₹2,499` on the receipt is not luck.         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `bigint`, per invariant 2. Whole rupees, because Indian plan prices are not quoted in paise and
 * `₹2,499.00` reads as though a machine wrote it.
 */
export function formatMinor(paise: bigint): string {
  const { sign, major } = indianAmountParts(paise, 2);
  return `${sign}₹${major}`;
}
