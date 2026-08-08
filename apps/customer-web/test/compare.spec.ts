/**
 * `SCR-WEB-004` — comparison. `FR-CMP-01` … `FR-CMP-04`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * A COMPARE PAGE IS A URL PARSER WEARING A TABLE
 *
 * Everything that can go wrong here goes wrong in the parse, and none of it throws: a shared
 * link that silently shows three gyms instead of four, a slug that matches the wrong city's
 * gym, a set that grows past the limit because the cap was applied in the component, a
 * duplicate that compares a gym with itself.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { code } from './helpers.ts';
import { en } from '../src/shared/i18n/messages/en.ts';
import { CATALOGUE } from '../src/features/discovery/fixtures/catalogue.ts';
import {
  MAX_COMPARE,
  addableGyms,
  amenityMatrix,
  compareKey,
  parseCompare,
  toCompareParams,
  toggleHref,
} from '../src/features/compare/compare.ts';

const KEYS = CATALOGUE.map(compareKey);

/** Parses back what a link emitted, the way a browser would. */
function parseHref(href: string) {
  const qs = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
  const params = new URLSearchParams(qs);
  // `?gym=a&gym=b` must reach the parser as an ARRAY, which is what Next hands a page.
  return parseCompare({ gym: params.getAll('gym') });
}

// ═══════════════════════════════════════════════════════════════════════════
// The URL.
// ═══════════════════════════════════════════════════════════════════════════

test('a comparison round-trips through its own URL', () => {
  const chosen = KEYS.slice(0, 3);
  const parsed = parseHref(toCompareParams(chosen));
  assert.deepEqual(parsed.gyms.map(compareKey), chosen);
  assert.deepEqual(parsed.unresolved, []);
  assert.equal(parsed.truncated, false);
});

test('an empty comparison is the bare /compare URL', () => {
  assert.equal(toCompareParams([]), '/compare');
  const parsed = parseCompare({});
  assert.deepEqual(parsed.gyms, []);
  assert.deepEqual(parsed.unresolved, []);
});

test('the key is city AND slug, so a slug cannot resolve to the wrong city', () => {
  // The fixture's slugs happen to be globally unique, which is exactly why a URL format that
  // relied on it would pass review and break on the first real duplicate.
  const gym = CATALOGUE[0]!;
  assert.equal(compareKey(gym), `${gym.citySlug}/${gym.slug}`);
  // A bare slug names nothing.
  assert.deepEqual(parseCompare({ gym: gym.slug }).gyms, []);
  // A real slug under the wrong city names nothing either.
  assert.deepEqual(parseCompare({ gym: `mars/${gym.slug}` }).gyms, []);
});

test('the cap lives in the PARSER, not in the component that draws columns', () => {
  // A cap applied while rendering is a cap that the metadata, the picker and the next refactor
  // each have to remember separately.
  const parsed = parseCompare({ gym: KEYS });
  assert.equal(parsed.gyms.length, MAX_COMPARE);
  assert.equal(parsed.truncated, true);
  // And the writer refuses to emit more than it can read back.
  assert.equal(parseHref(toCompareParams(KEYS)).gyms.length, MAX_COMPARE);
});

test('a gym named twice is compared once', () => {
  const key = KEYS[0]!;
  const parsed = parseCompare({ gym: [key, key, key] });
  assert.equal(parsed.gyms.length, 1, 'a gym is being compared with itself');
});

test('a comma-separated list is accepted, because people type them', () => {
  const parsed = parseCompare({ gym: `${KEYS[0]!},${KEYS[1]!}` });
  assert.deepEqual(parsed.gyms.map(compareKey), [KEYS[0], KEYS[1]]);
});

test('a gym that no longer exists is REPORTED, never silently dropped', () => {
  // A shared comparison outlives the listings in it. If the fourth gym is delisted and the page
  // just shows three, the two people looking at the same link see different pages and neither
  // of them knows it.
  const parsed = parseCompare({ gym: [KEYS[0]!, 'delhi/gym-that-was-delisted'] });
  assert.equal(parsed.gyms.length, 1);
  assert.deepEqual(parsed.unresolved, ['delhi/gym-that-was-delisted']);
});

test('junk in the parameter produces an empty comparison, not an exception', () => {
  // This URL is linked from outside and hit by crawlers with whatever they last saw.
  for (const junk of ['', '   ', '/', '//', 'a/b/c/d', '../../etc/passwd']) {
    const parsed = parseCompare({ gym: junk });
    assert.equal(parsed.gyms.length, 0, `"${junk}" resolved to a gym`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// The set operations.
// ═══════════════════════════════════════════════════════════════════════════

test('toggling a gym adds it, and toggling it again removes it', () => {
  const first = CATALOGUE[0]!;
  const second = CATALOGUE[1]!;

  const added = parseHref(toggleHref([first], second));
  assert.deepEqual(added.gyms.map(compareKey), [compareKey(first), compareKey(second)]);

  const removed = parseHref(toggleHref([first, second], second));
  assert.deepEqual(removed.gyms.map(compareKey), [compareKey(first)]);
});

test('the picker never offers a gym that is already being compared', () => {
  const selected = CATALOGUE.slice(0, 2);
  const offered = addableGyms(selected).map(compareKey);
  for (const gym of selected) {
    assert.ok(!offered.includes(compareKey(gym)), `${gym.name} is offered twice`);
  }
  assert.equal(offered.length, CATALOGUE.length - selected.length);
});

test('the facilities matrix is the UNION, so "which one has a sauna" has an answer', () => {
  // An intersection answers "all of them do" or shows nothing at all, which is not the question
  // anybody opens this page to ask.
  const gyms = CATALOGUE.slice(0, 3);
  const rows = amenityMatrix(gyms);
  for (const gym of gyms) {
    for (const amenity of gym.amenities) {
      assert.ok(rows.includes(amenity), `${amenity} is missing from the matrix`);
    }
  }
  assert.equal(new Set(rows).size, rows.length, 'an amenity appears twice');
  assert.deepEqual(
    [...rows].sort((a, b) => a.localeCompare(b)),
    rows,
    'the matrix is unsorted',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// The page.
// ═══════════════════════════════════════════════════════════════════════════

test('the comparison is a real table with headers on BOTH axes', () => {
  // This page is a grid of numbers whose meaning comes entirely from row and column. Built from
  // divs, "₹2,499" is announced as "₹2,499" and a screen-reader user is asked to hold the column
  // order in their head across eleven rows.
  const table = code('src/features/compare/compare-table.tsx');
  assert.match(table, /<table/);
  assert.match(table, /scope="col"/);
  assert.match(table, /scope="row"/);
  assert.match(table, /<caption/);
});

test('the compare surface ships no client state', () => {
  // The tray backed by localStorage is the version every other marketplace ships, and it is why
  // none of their comparisons can be shared or crawled.
  for (const file of [
    'src/features/compare/compare-page.tsx',
    'src/features/compare/compare-table.tsx',
  ]) {
    const text = code(file);
    assert.ok(!text.includes("'use client'"), `${file} became a client component`);
    assert.ok(!text.includes('localStorage'), `${file} reaches for localStorage`);
    assert.ok(!text.includes('useState'), `${file} holds state`);
  }
  // The picker is a real GET form, so it works before hydration.
  assert.match(code('src/features/compare/compare-page.tsx'), /method="get"/);
});

test('presence is never signalled by shape or colour alone', () => {
  // `AX8`. A tick against nothing is "present vs absent" told by glyph; the word is what a
  // screen reader actually reads.
  const table = code('src/features/compare/compare-table.tsx');
  assert.match(table, /web\.compare\.has/);
  assert.match(table, /web\.compare\.hasNot/);
  assert.match(table, /aria-hidden="true"/);
});

test('the page marks facts and ranks nothing', () => {
  // The cheapest and the nearest are facts this page already computed. An overall "best" would be
  // the platform ranking one paying listing above another on the screen where the decision is
  // made, and `BR-GYM-*` gives no basis for the claim.
  //
  // Asserted against the COPY rather than the source: the first version scanned the component and
  // failed on `reduce((best, gym) => …)`, which is a variable name and not a claim made to anyone.
  // What a member reads lives in the catalogue, which is also the only place a translator could
  // introduce the claim.
  const claims = /\b(best|recommended|top pick|winner|our choice|score)\b/i;
  for (const [key, value] of Object.entries(en)) {
    if (!key.startsWith('web.compare.')) continue;
    assert.ok(!claims.test(value), `${key} ranks one listing above another: "${value}"`);
  }
});

test('a comparison is not offered to a search engine as a landing page', () => {
  // The URL space is every subset of the catalogue up to four, each one thin near-duplicate
  // content assembled from pages that already rank. `follow` stays on: the links OUT of it are
  // exactly what should be crawled.
  const route = code('app/compare/page.tsx');
  assert.match(route, /robots:\s*\{\s*index:\s*false,\s*follow:\s*true\s*\}/);
});
