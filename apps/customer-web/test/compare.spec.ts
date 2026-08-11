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
import { EMPTY_QUERY, toSearchParams } from '../src/features/discovery/search.ts';
import { HOME_COMPARE_BASE } from '../src/features/home/teaser.ts';
import {
  COMPARE_PAGE,
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

// ═══════════════════════════════════════════════════════════════════════════
// ADR-0050 — one label, one behaviour, on every surface that shows a gym.
//
// Until this ADR the results page, the two landings and the gym page all shipped
// `toCompareParams([compareKey(gym)])` under the label "Add to compare": an href to `/compare`
// naming ONE gym, which REPLACED the whole selection and left the page. Measured from
// `/search?city=bengaluru&sort=rating`, the city and the sort were gone and the rail was absent —
// so on the one surface where a person shortlists, the second click undid the first.
//
// The contract now is the home teaser's: the card is given the current selection and the page it
// is on, and emits the NEXT selection on that page. These tests are the contract.
// ═══════════════════════════════════════════════════════════════════════════

test('a card toggle ACCUMULATES and keeps the reader on their own query — ADR-0050', () => {
  const [first, second] = [CATALOGUE[0]!, CATALOGUE[1]!];
  // The exact URL the ADR measured on: a city and a sort the reader chose.
  const base = { path: toSearchParams({ ...EMPTY_QUERY, city: 'bengaluru', sort: 'rating' }) };

  const firstClick = toggleHref([], first, base);
  const afterFirst = new URL(firstClick, 'http://gymmap.test');
  assert.equal(afterFirst.pathname, '/search', 'the toggle left the page the reader was on');
  assert.equal(afterFirst.searchParams.get('city'), 'bengaluru', 'the city filter was dropped');
  assert.equal(afterFirst.searchParams.get('sort'), 'rating', 'the sort was dropped');
  assert.deepEqual(afterFirst.searchParams.getAll('gym'), [compareKey(first)]);

  // The second click is the whole defect. It must ADD, not replace.
  const selected = parseCompare({ gym: afterFirst.searchParams.getAll('gym') }).gyms;
  const secondClick = new URL(toggleHref(selected, second, base), 'http://gymmap.test');
  assert.deepEqual(
    secondClick.searchParams.getAll('gym'),
    [compareKey(first), compareKey(second)],
    'the second click replaced the selection instead of adding to it',
  );
  assert.equal(secondClick.searchParams.get('city'), 'bengaluru');
  assert.equal(secondClick.searchParams.get('sort'), 'rating');
});

test('a base that already carries a query is joined with & and not a second ?', () => {
  /*
   * `${base}?${encoded}` was the old line, and with a base of `/search?city=bengaluru&sort=rating`
   * it emits `…&sort=rating?gym=…`. A second `?` is not a delimiter: the whole of
   * `rating?gym=bengaluru/iron-house-indiranagar` parses as ONE value of `sort`, so the sort
   * silently resets to relevance and the compare parameter never arrives. Nothing throws.
   */
  const base = { path: toSearchParams({ ...EMPTY_QUERY, city: 'bengaluru', sort: 'rating' }) };
  const href = toCompareParams([compareKey(CATALOGUE[0]!)], base);
  assert.equal(href.split('?').length - 1, 1, `two question marks in ${href}`);
  const url = new URL(href, 'http://gymmap.test');
  assert.equal(url.searchParams.get('sort'), 'rating', `the sort was swallowed: ${href}`);
  assert.deepEqual(url.searchParams.getAll('gym'), [compareKey(CATALOGUE[0]!)]);

  // And a base with no query still gets its `?`, including the fragment-bearing home one.
  assert.match(toCompareParams([compareKey(CATALOGUE[0]!)], COMPARE_PAGE), /^\/compare\?gym=/);
  assert.match(
    toCompareParams([compareKey(CATALOGUE[0]!)], HOME_COMPARE_BASE),
    /^\/\?gym=.*#gyms$/,
  );
});

test('the home base still names a section that exists on the home page', () => {
  // `#gyms` and the `id` it points at have always lived in different files; the base moving out of
  // `compare-rail.tsx` makes them two files further apart, so the pairing is asserted rather than
  // remembered. A fragment naming nothing scrolls nowhere and focuses nothing.
  assert.equal(HOME_COMPARE_BASE.path, '/');
  assert.equal(HOME_COMPARE_BASE.fragment, '#gyms');
  assert.match(code('src/features/home/chalk.tsx'), /id="gyms"/);
});

test('every surface that renders a GymCard hands it the selection and its own base', () => {
  /*
   * The defect this replaces was invisible at the call site: `<GymCard gym={gym} />` reads fine
   * and the wrongness was inside the card. Both props are required now, so the compiler catches a
   * new surface - and this catches the surface that satisfies the compiler with the WRONG value,
   * by requiring the base to be a variable the route computed rather than a literal typed here.
   */
  const surfaces = [
    'src/features/discovery/search-results.tsx',
    'src/features/landings/landing-views.tsx',
    'src/features/gym-detail/gym-detail.tsx',
  ];
  let cards = 0;
  for (const file of surfaces) {
    const matches = [...code(file).matchAll(/<GymCard[\s\S]*?\/>/g)];
    assert.ok(matches.length > 0, `${file} renders no GymCard, so this test checks nothing`);
    for (const [tag] of matches) {
      assert.match(tag, /selected=\{/, `a GymCard in ${file} is not told what is selected`);
      assert.match(tag, /base=\{/, `a GymCard in ${file} is not told which page it is on`);
      cards += 1;
    }
  }
  assert.ok(cards >= 3, `only ${String(cards)} GymCard call sites found`);

  // And the card itself no longer knows how to start a one-gym comparison.
  const card = code('src/features/discovery/gym-card.tsx');
  assert.ok(
    !card.includes('toCompareParams'),
    'gym-card.tsx still builds a whole selection from one gym, which is the ADR-0050 defect',
  );
  assert.match(card, /toggleHref\(selected, gym, base\)/);
});

test('a card at the limit says something true rather than linking nowhere', () => {
  /*
   * `toCompareParams` caps at `MAX_COMPARE`, so with four chosen the "add" href for a fifth gym
   * resolves to the URL the reader is already on - a control that looks live, announces itself as
   * an add, and does nothing. Proved on the URL, then required of the card.
   */
  const four = CATALOGUE.slice(0, MAX_COMPARE);
  const fifth = CATALOGUE[MAX_COMPARE]!;
  const base = { path: '/gyms/bengaluru' };
  assert.equal(
    toggleHref(four, fifth, base),
    toCompareParams(four.map(compareKey), base),
    'the fixture no longer has a fifth gym, so this test proves nothing',
  );

  const card = code('src/features/discovery/gym-card.tsx');
  assert.match(card, /selected\.length >= MAX_COMPARE/);
  assert.match(card, /web\.compare\.rail\.full/);
  // The statement is not a link, so it does not become a dead tab stop on every card.
  assert.match(card, /atLimit \?[\s\S]*?<p /, 'the limit branch does not render a plain paragraph');
});

test('the rail mounts on the surfaces that show gyms, and NOT in the root layout', () => {
  /*
   * One line in `app/layout.tsx` would have done all five. It is not taken: a rail on
   * `/how-it-works` or on the checkout review screen is chrome advertising a feature nobody on
   * those pages asked for, and on checkout it would sit over the one control that matters.
   */
  for (const route of [
    'app/page.tsx',
    'app/search/page.tsx',
    'app/gyms/[citySlug]/page.tsx',
    'app/explore/[activitySlug]/page.tsx',
    'app/gyms/[citySlug]/[gymSlug]/page.tsx',
  ]) {
    const text = code(route);
    assert.match(
      text,
      /<CompareRail[\s\S]*?\/>/,
      `${route} shows gyms with no rail to report them`,
    );
    assert.match(text, /parseCompare\(searchParams\)/, `${route} never reads the selection`);
    assert.match(text, /base=\{/, `${route} mounts a rail that does not know where it is`);
  }

  for (const elsewhere of [
    'app/layout.tsx',
    'app/how-it-works/page.tsx',
    'app/checkout/page.tsx',
  ]) {
    assert.ok(
      !code(elsewhere).includes('CompareRail'),
      `${elsewhere} mounts the compare rail, which is chrome on a page that shows no gym`,
    );
  }
});

test('the canonical of every rail-bearing indexed route ignores ?gym= — FR-SRCH-13', () => {
  /*
   * ┌─ THE ONE WAY THIS FEATURE COULD DAMAGE THE THING IT SITS ON ──────────────────────────────┐
   * │ `/gyms/[citySlug]` and `/explore/[activitySlug]` exist to BE indexed. Every card on them   │
   * │ now links to `?gym=…`, and with eight listings and a cap of four that is hundreds of real, │
   * │ crawlable addresses per landing.                                                            │
   * │                                                                                            │
   * │ `robots.ts` deliberately disallows nothing (`seo.spec.ts`), so the canonical is the whole  │
   * │ mechanism: each route's `generateMetadata` takes `params` only and hardcodes the bare path. │
   * │ Verified on the served build before the hrefs changed - `/gyms/bengaluru` and               │
   * │ `/gyms/bengaluru?gym=a&gym=b` returned the identical canonical. The day one of these reads │
   * │ `searchParams`, the landings acquire hundreds of thin near-duplicates of themselves.        │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  for (const route of [
    'app/gyms/[citySlug]/page.tsx',
    'app/explore/[activitySlug]/page.tsx',
    'app/gyms/[citySlug]/[gymSlug]/page.tsx',
  ]) {
    const text = code(route);
    const meta = /export function generateMetadata\(\{([^}]*)\}/.exec(text);
    assert.ok(meta !== null, `${route} exports no generateMetadata`);
    assert.ok(
      !meta[1]!.includes('searchParams'),
      `${route} lets a search parameter into its metadata, so every ?gym= combination becomes ` +
        'a page a crawler may index separately',
    );
  }

  /*
   * `/search` is the exception and it is a different mechanism, not a weaker one. Its
   * `generateMetadata` MUST read `searchParams` — the title is the count, and on a full page load
   * the title is the only announcement a screen reader gets (`app/search/page.tsx` says so at
   * length). What protects it is that the canonical is a LITERAL: every faceted search URL,
   * `?gym=` included, consolidates on the bare `/search`, and the landings carry the ranking.
   */
  assert.match(code('app/search/page.tsx'), /alternates: \{ canonical: '\/search' \}/);

  // The bare paths themselves, so a rename cannot quietly point a canonical somewhere else.
  assert.match(code('src/features/landings/landing-metadata.ts'), /canonical: `\/gyms\/\$\{/);
  assert.match(code('src/features/landings/landing-metadata.ts'), /canonical: `\/explore\/\$\{/);
  assert.match(
    code('app/gyms/[citySlug]/[gymSlug]/page.tsx'),
    /canonical: `\/gyms\/\$\{gym\.citySlug\}\/\$\{gym\.slug\}`/,
  );
});

test('removing a chip leaves focus on the rail, not at the top of the document', () => {
  /*
   * §3.2. The rail must never STEAL focus - a bar that grabs it when the second gym goes in makes
   * a third impossible without Shift+Tab - but a chip's own remove link unmounts the chip it lives
   * in, and Next resets document focus on a client navigation. Without an anchor the reader who
   * removed the second of four gyms resumes tabbing from the site header.
   *
   * The pair is the one `app/layout.tsx` already uses for its skip link, and `shell.spec.ts`
   * states the same reason: an `id` alone scrolls, `tabIndex={-1}` is what moves focus.
   */
  const rail = code('src/features/compare/compare-rail.tsx');
  assert.match(rail, /id=\{RAIL_ID\}/);
  assert.match(rail, /tabIndex=\{-1\}/);
  // At one gym the removal unmounts the rail, so the anchor would name nothing.
  assert.match(rail, /selected\.length > 1 \?[\s\S]{0,120}RAIL_ID/);
  // And nothing here reaches for focus itself: no client state, no effect, no autofocus.
  for (const forbidden of ["'use client'", 'useEffect', 'autoFocus', '.focus(']) {
    assert.ok(!rail.includes(forbidden), `compare-rail.tsx uses ${forbidden}`);
  }
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
