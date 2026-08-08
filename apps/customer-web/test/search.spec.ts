/**
 * `SCR-WEB-002` — parsing, filtering, faceting. `FR-SRCH-01` … `FR-SRCH-08`, `FR-SRCH-13`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE THREE THINGS A SEARCH PAGE GETS WRONG SILENTLY
 *
 *   1. A URL that does not round-trip. The member filters, shares the link, and the recipient
 *      sees a different page. Nothing errors.
 *   2. A facet count that disagrees with the link beside it. The member trusts the number
 *      enough to click and lands on an empty page.
 *   3. Money read as rupees somewhere in the middle. Every price is off by a factor of a
 *      hundred, in the direction that makes the gym look cheap.
 *
 * All three are asserted here rather than looked at.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CATALOGUE } from '../src/features/discovery/fixtures/catalogue.ts';
import {
  EMPTY_QUERY,
  PRICE_CEILINGS_MINOR,
  RATING_FLOORS,
  facets,
  formatMinor,
  hasActiveFilters,
  parseSearchQuery,
  search,
  toSearchParams,
  type SearchQuery,
} from '../src/features/discovery/search.ts';

/** Parses back what `toSearchParams` emitted, the way a browser would. */
function roundTrip(query: SearchQuery): SearchQuery {
  const href = toSearchParams(query);
  const search_ = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
  return parseSearchQuery(Object.fromEntries(new URLSearchParams(search_)));
}

// ═══════════════════════════════════════════════════════════════════════════
// FR-SRCH-13 · the URL is the state.
// ═══════════════════════════════════════════════════════════════════════════

test('every filter survives a round trip through the URL', () => {
  const query: SearchQuery = {
    q: 'yoga',
    city: 'bengaluru',
    category: 'Yoga',
    amenity: 'Showers',
    maxPriceMinor: 2_50_000n,
    minRating: 4,
    sort: 'price-asc',
  };
  assert.deepEqual(roundTrip(query), query);
});

test('the empty query round-trips to a bare /search, with no default written out', () => {
  // `?sort=relevance` and `/search` are the same page. Emitting both hands a crawler two URLs for
  // one result set — the duplicate-content problem created by the filter panel itself.
  assert.equal(toSearchParams(EMPTY_QUERY), '/search');
  assert.deepEqual(roundTrip(EMPTY_QUERY), EMPTY_QUERY);
  assert.deepEqual(parseSearchQuery({}), EMPTY_QUERY);
});

test('a stale or hostile parameter falls back rather than throwing', () => {
  // A results page is linked from outside and hit by crawlers with parameters that no longer
  // exist. A 500 on `?sort=cheapest` is an error page served for a URL the crawler will retry.
  assert.equal(parseSearchQuery({ sort: 'cheapest' }).sort, 'relevance');
  assert.equal(parseSearchQuery({ rating: '4.37' }).minRating, null);
  assert.equal(parseSearchQuery({ rating: '../etc/passwd' }).minRating, null);
  assert.equal(parseSearchQuery({ maxPrice: '2499.995' }).maxPriceMinor, null);
  assert.equal(parseSearchQuery({ maxPrice: '-100' }).maxPriceMinor, null);
  assert.equal(parseSearchQuery({ maxPrice: '1e6' }).maxPriceMinor, null);
  // Arrays: a duplicated parameter is legal in a URL and must not become "[object Object]".
  assert.equal(parseSearchQuery({ city: ['delhi', 'mumbai'] }).city, 'delhi');
});

test('the price ceiling is read as WHOLE RUPEES and held as paise', () => {
  // The factor-of-a-hundred bug, asserted from both sides. `?maxPrice=2500` means ₹2,500, which
  // is 250000 paise — and the link back out must say 2500 again, not 250000.
  assert.equal(parseSearchQuery({ maxPrice: '2500' }).maxPriceMinor, 2_50_000n);
  assert.match(toSearchParams({ maxPriceMinor: 2_50_000n }), /maxPrice=2500(&|$)/);
  for (const ceiling of PRICE_CEILINGS_MINOR) {
    assert.equal(roundTrip({ ...EMPTY_QUERY, maxPriceMinor: ceiling }).maxPriceMinor, ceiling);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FR-SRCH-04…08 · what each filter actually does.
// ═══════════════════════════════════════════════════════════════════════════

test('a price ceiling INCLUDES the ceiling, because the label says "up to"', () => {
  // The off-by-one that makes a member think a plan they can see priced at ₹2,499 is missing.
  const cheapest = [...CATALOGUE].sort((a, b) =>
    a.fromPriceMinor < b.fromPriceMinor ? -1 : 1,
  )[0]!;
  const exact = search({ ...EMPTY_QUERY, maxPriceMinor: cheapest.fromPriceMinor });
  assert.ok(
    exact.some((gym) => gym.id === cheapest.id),
    'a gym priced exactly at the ceiling was excluded',
  );
});

test('a rating floor EXCLUDES unrated gyms, and the sort does not', () => {
  // These look inconsistent and are not. "Show me gyms proven to be 4★ or better" cannot include
  // a gym with no reviews; "which of these is best" must not rank a new gym below a one-star one.
  const unrated = CATALOGUE.filter((gym) => gym.rating === null);
  assert.ok(unrated.length > 0, 'the fixture no longer exercises the unrated case');

  const filtered = search({ ...EMPTY_QUERY, minRating: 4 });
  for (const gym of filtered) {
    assert.notEqual(gym.rating, null, `${gym.name} has no rating and passed a 4.0 floor`);
    assert.ok(gym.rating! >= 4);
  }

  const sorted = search({ ...EMPTY_QUERY, sort: 'rating' });
  assert.equal(sorted.length, CATALOGUE.length, 'sorting dropped a gym');
  const lastRated = sorted.findIndex((gym) => gym.rating === null);
  assert.ok(
    sorted.slice(lastRated).every((gym) => gym.rating === null),
    'an unrated gym is sorted above a rated one',
  );
});

test('filters compose — each one narrows the previous set, never widens it', () => {
  // Labelled rather than serialised: `JSON.stringify` throws on a bigint, and a price patch is
  // the only interesting step in the list.
  const steps: { label: string; patch: Partial<SearchQuery> }[] = [
    { label: 'city=bengaluru', patch: { city: 'bengaluru' } },
    { label: 'category=Yoga', patch: { category: 'Yoga' } },
    { label: 'maxPrice=₹5,000', patch: { maxPriceMinor: 5_00_000n } },
    { label: 'amenity=Showers', patch: { amenity: 'Showers' } },
  ];

  let previous = search(EMPTY_QUERY).length;
  let query: SearchQuery = { ...EMPTY_QUERY };
  for (const step of steps) {
    query = { ...query, ...step.patch };
    const count = search(query).length;
    assert.ok(count <= previous, `adding ${step.label} widened the results`);
    previous = count;
  }
});

test('search does not mutate the catalogue, so one visitor cannot reorder the next one', () => {
  // `CATALOGUE` is a module-level constant and `Array.sort` mutates in place. On a server-rendered
  // page that is one request's sort order leaking into every later request in the same process.
  const before = CATALOGUE.map((gym) => gym.id);
  search({ ...EMPTY_QUERY, sort: 'price-desc' });
  search({ ...EMPTY_QUERY, sort: 'rating' });
  assert.deepEqual(
    CATALOGUE.map((gym) => gym.id),
    before,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// The facet counts.
// ═══════════════════════════════════════════════════════════════════════════

test('EVERY facet count equals what its own link returns', () => {
  // The assertion the whole facet panel rests on. A count computed one way and a link built
  // another is the defect that survives review, because both halves look right in isolation.
  const query: SearchQuery = { ...EMPTY_QUERY, city: 'bengaluru' };
  const groups = facets(query);

  for (const [name, options] of Object.entries(groups)) {
    for (const option of options) {
      if (option.selected) continue;
      const href = option.href;
      const qs = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
      const actual = search(parseSearchQuery(Object.fromEntries(new URLSearchParams(qs)))).length;
      assert.equal(
        actual,
        option.count,
        `${name}/${option.value}: the panel says ${String(option.count)} and the link returns ${String(actual)}`,
      );
    }
  }
});

test('clicking the SELECTED facet clears it rather than reselecting it', () => {
  // Two clicks to undo one is the commonest complaint about filter panels.
  const query: SearchQuery = { ...EMPTY_QUERY, city: 'bengaluru' };
  const bengaluru = facets(query).city.find((option) => option.value === 'bengaluru');
  assert.ok(bengaluru?.selected, 'the fixture city slug changed');
  assert.equal(bengaluru.href, '/search');
});

test('a facet in one group never resets another group', () => {
  const query: SearchQuery = { ...EMPTY_QUERY, city: 'bengaluru', sort: 'price-asc' };
  for (const option of facets(query).category) {
    if (option.selected) continue;
    assert.match(option.href, /city=bengaluru/, `${option.value} dropped the city`);
    assert.match(option.href, /sort=price-asc/, `${option.value} dropped the sort`);
  }
});

test('every rating floor offered is a floor the parser accepts', () => {
  // A UI that offers `4.5` and a parser that only recognises `4` produces a chip that does
  // nothing — clickable, shareable, and inert.
  for (const floor of RATING_FLOORS) {
    assert.equal(parseSearchQuery({ rating: String(floor) }).minRating, floor);
  }
});

test('hasActiveFilters ignores the sort, which is a view preference and not a filter', () => {
  assert.equal(hasActiveFilters(EMPTY_QUERY), false);
  assert.equal(hasActiveFilters({ ...EMPTY_QUERY, sort: 'price-desc' }), false);
  assert.equal(hasActiveFilters({ ...EMPTY_QUERY, q: 'yoga' }), true);
  assert.equal(hasActiveFilters({ ...EMPTY_QUERY, minRating: 4 }), true);
});

// ═══════════════════════════════════════════════════════════════════════════
// Money.
// ═══════════════════════════════════════════════════════════════════════════

test('prices render in Indian grouping, whole rupees, from integer paise', () => {
  assert.equal(formatMinor(2_50_000n), '₹2,500');
  assert.equal(formatMinor(1_00_00_000n), '₹1,00,000');
  assert.equal(formatMinor(0n), '₹0');
  // The catalogue is paise. If a fixture ever gains a rupee value, this catches it as a price
  // three orders of magnitude too small rather than as a plausible-looking number.
  for (const gym of CATALOGUE) {
    assert.equal(typeof gym.fromPriceMinor, 'bigint', `${gym.name} is not integer paise`);
    assert.ok(gym.fromPriceMinor % 100n === 0n, `${gym.name} has a sub-rupee price`);
  }
});
