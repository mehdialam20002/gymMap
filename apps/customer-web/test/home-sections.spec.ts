/**
 * `SCR-WEB-001` — the four marketplace sections, and the four the reference has that this does not.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE FAILURE THIS FILE EXISTS TO CATCH IS A NUMBER APPEARING FROM NOWHERE
 *
 * A marketing page is where invented figures get in. Nobody adds a fake price to checkout; the
 * struck-through "was ₹5,999", the "12,000+ happy members" and the five-star quote from a member
 * who has never checked in all arrive on the homepage, because the homepage is the one surface
 * where the code has no opinion about where a number came from.
 *
 * So these tests read the section source and assert the absences: no `line-through`, no rating
 * fallback to zero, no testimonial, no store badge. They are unusual tests — most of them prove
 * something is NOT there. That is deliberate. Every one of these was in the reference design and
 * was dropped on purpose, and a test is the only thing that stops a later edit quietly adding it
 * back because the section "looked empty".
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { code } from './helpers.ts';
import { en } from '../src/shared/i18n/messages/en.ts';
import { CATALOGUE } from '../src/features/discovery/fixtures/catalogue.ts';
import { EMPTY_QUERY, search } from '../src/features/discovery/search.ts';
import { compareKey, parseCompare } from '../src/features/compare/compare.ts';
import { teaserCompareHref, teaserGyms } from '../src/features/home/teaser.ts';

const PAGE = 'app/page.tsx';

/**
 * The modules the homepage renders, read off the page's own import list.
 *
 * ┌─ WHY THIS IS DERIVED AND NOT A PATH ───────────────────────────────────────────────────────┐
 * │ This was `const SECTION = 'src/features/home/marketplace.tsx'`, and the identity rebuild    │
 * │ moved five of the six sections into `chalk.tsx`. Every "no invented number" assertion below │
 * │ kept passing — against a file the page had stopped rendering. The suite was green and       │
 * │ covering nothing, which for a file whose whole job is proving absences is the worst way to  │
 * │ fail, because a passing absence-test and a vacuous one look identical.                       │
 * │                                                                                              │
 * │ So the list follows the page. A section that moves house stays covered, a section added in  │
 * │ a new module is covered the moment the page imports it, and a module the page drops stops   │
 * │ being scanned rather than silently becoming the only thing scanned.                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const MODULES: readonly string[] = (() => {
  /*
   * TRANSITIVE, not one level.
   *
   * The first version read only `app/page.tsx`'s own imports, which meant a module the page
   * reached THROUGH another one was scanned by nothing here - `compare-rail.tsx` renders on the
   * homepage, is imported by `page.tsx` and by `chalk.tsx`, and a component pulled in one step
   * further would have been invisible to every absence assertion in this file. The whole point of
   * deriving the list was to stop it going stale; stopping at depth one just moves where it goes
   * stale to.
   *
   * Bounded to `src/features/`, because that is where sections live. It follows relative imports
   * from whichever file it is currently reading, so a path is resolved against its importer
   * rather than against the page.
   */
  const seen = new Set<string>();
  const queue = [PAGE];

  while (queue.length > 0) {
    const from = queue.shift()!;
    const dir = from.slice(0, from.lastIndexOf('/'));
    for (const [, spec] of code(from).matchAll(/from '([^']+\.tsx?)'/g)) {
      if (!spec!.startsWith('.')) continue;
      const parts = `${dir}/${spec!}`.split('/');
      const resolved: string[] = [];
      for (const part of parts) {
        if (part === '.' || part === '') continue;
        if (part === '..') resolved.pop();
        else resolved.push(part);
      }
      const rel = resolved.join('/');
      if (!rel.startsWith('src/features/') || seen.has(rel)) continue;
      seen.add(rel);
      queue.push(rel);
    }
  }

  // Sections only. `search.ts`, `compare.ts` and the fixtures are data, and scanning them for
  // "no rupee figure written into the component" would fail on the catalogue itself.
  const found = [...seen].filter((rel) => rel.endsWith('.tsx'));
  assert.ok(
    found.length >= 3,
    `only ${String(found.length)} rendered modules reached from ${PAGE}`,
  );
  return found;
})();

/** Every rendered section's code, comments blanked, as one text to scan. */
const SECTIONS = MODULES.map((rel) => code(rel)).join('\n');

/**
 * What `app/page.tsx` imports ITSELF — the sections, as opposed to everything they reach.
 *
 * Two lists, because there are two questions. "Does this contain an invented number" is about
 * every module the page pulls in, however deep, which is what `MODULES` above is for. "Is this
 * rendered on the page" is only about sections: the transitive sweep reaches shared leaves like
 * `GymPhoto`, and demanding `<GymPhoto />` in `page.tsx` is the test misreading what it found.
 */
const PAGE_SECTIONS: readonly string[] = [
  ...code(PAGE).matchAll(/from '\.\.\/(src\/features\/[\w/.-]+\.tsx)'/g),
].map((match) => match[1]!);

// ═══════════════════════════════════════════════════════════════════════════
// The membership row — `BR-PLN-03`.
// ═══════════════════════════════════════════════════════════════════════════

test('no struck-through price anywhere on the homepage', () => {
  // `BR-PLN-03` is "the price displayed is the price charged". A crossed-out second figure is a
  // price displayed that was never charged and never could be, which is the same defect wearing
  // a discount badge. The reference design has one on every card.
  for (const rel of [...MODULES, PAGE]) {
    const text = code(rel);
    assert.ok(!text.includes('line-through'), `${rel} strikes through a price`);
    assert.ok(!/\bwas\b|\bMRP\b|\bsave\s*\d/i.test(text), `${rel} implies a saving`);
  }
});

test('every plan price on the homepage is a catalogue figure, formatted in one place', () => {
  const text = SECTIONS;
  // One formatter, used on integer paise. A second one is how two surfaces start disagreeing
  // about the same rupee.
  assert.ok(text.includes('formatMinor('), 'money is not run through the shared formatter');
  assert.ok(
    !/₹\s*[\d,]/.test(text),
    'a rupee figure is written into the component instead of formatted from paise',
  );
  // And nothing hand-divides paise back into rupees on the way past.
  assert.ok(!/\/\s*100\b/.test(text), 'paise are being converted by hand');
});

test('the featured plans are three real plans from three different gyms', () => {
  const cheapest = search({ ...EMPTY_QUERY, sort: 'price-asc' }).slice(0, 3);
  assert.equal(cheapest.length, 3, 'the fixture no longer has three gyms to feature');
  assert.equal(new Set(cheapest.map((gym) => gym.id)).size, 3, 'the same gym appears twice');
  for (const gym of cheapest) {
    assert.ok(gym.plans.length > 0, `${gym.name} has no plan to show`);
    // `bigint`, not `number` — `BR-FIN-01`. A price that arrived as a float would still render
    // fine here and still be wrong by a paisa somewhere downstream.
    assert.equal(typeof gym.plans[0]!.priceMinor, 'bigint', `${gym.name}'s price is not paise`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// The compare teaser.
// ═══════════════════════════════════════════════════════════════════════════

test('the compare teaser link opens the same three gyms the table just showed', () => {
  // The teaser is only honest if pressing it lands on what was read. A bare `/compare` would
  // make the table an advertisement for an empty page.
  const shown = search({ ...EMPTY_QUERY, sort: 'distance' }).slice(0, 3);
  const parsed = parseCompare({ gym: shown.map(compareKey) });
  assert.deepEqual(
    parsed.gyms.map(compareKey),
    shown.map(compareKey),
    'the teaser CTA would not resolve to the gyms in the table',
  );
  assert.deepEqual(parsed.unresolved, []);

  /*
   * ┌─ THE TEST USED TO CHECK THE FUNCTION'S NAME, NOT ITS ARGUMENT ─────────────────────────────┐
   * │ The line here was `SECTIONS.includes('toCompareParams(')`. Everything above it computed     │
   * │ what the teaser OUGHT to open and then compared it to nothing the page builds - so the      │
   * │ teaser could have shipped `toCompareParams([])`, a table of three gyms above a button that  │
   * │ opens an empty comparison, and this test would have stayed green.                           │
   * │                                                                                             │
   * │ The href now comes from `teaser.ts`, which is what the two CTAs in `chalk.tsx` call, so     │
   * │ this reads the URL that ships and parses it the way the compare page will.                  │
   * └─────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const href = teaserCompareHref();
  const keys = [...new URL(href, 'http://gymmap.test').searchParams.getAll('gym')];
  assert.deepEqual(
    keys,
    shown.map(compareKey),
    `the teaser button opens ${href}, which is not the three gyms the table showed`,
  );
  assert.equal(teaserGyms().length, shown.length, 'the teaser shows a different number of gyms');
});

test('the teaser is a real table, not a grid of divs pretending to be one', () => {
  const text = SECTIONS;
  for (const tag of ['<table', '<thead', '<tbody', 'scope="col"', 'scope="row"', '<caption']) {
    assert.ok(text.includes(tag), `the comparison is missing ${tag}`);
  }
});

test('an unrated gym in the teaser reads as words, never 0.0 — BR-REV-01', () => {
  const text = SECTIONS;
  /*
   * ┌─ ONE LITERAL USED TO EXCUSE TWO RENDERERS ─────────────────────────────────────────────────┐
   * │ This was `text.includes("t('web.gym.facts.unrated')")` against every homepage module joined │
   * │ into one string. `chalk.tsx` renders a rating in TWO places - the gym card and the compare  │
   * │ teaser's cell - and a single occurrence anywhere satisfied a substring test. Rewriting the  │
   * │ teaser cell as `Number(gym.rating).toFixed(1)` renders "0.0" for Coastal Swim & Gym, which  │
   * │ is third by distance and therefore always in the three-column teaser, and the suite stayed  │
   * │ green: the card kept the literal, and the companion regex below only catches `??` and `||`. │
   * │                                                                                             │
   * │ A per-ELEMENT rule needs a per-element count. Every `toFixed` on a rating must have an       │
   * │ unrated branch, so the two are counted against each other rather than merely both present.  │
   * └─────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const unratedBranches = [...text.matchAll(/web\.gym\.facts\.unrated/g)].length;
  const ratingRenders = [...text.matchAll(/\brating[^\n]{0,40}?\.toFixed\(/g)].length;
  assert.ok(
    ratingRenders >= 2,
    `expected the homepage to render a rating in at least two places, found ${String(ratingRenders)} — ` +
      'if a renderer was removed, lower this; if the shape changed, the pattern below is now blind',
  );
  assert.ok(
    unratedBranches >= ratingRenders,
    `${String(ratingRenders)} places render a rating but only ${String(unratedBranches)} name the ` +
      'unrated string — at least one would print a number for a gym nobody has reviewed (BR-REV-01)',
  );
  assert.ok(
    text.includes("t('web.gym.facts.unrated')"),
    'the rating row has no unrated branch, so a new listing would render a number',
  );
  assert.ok(
    !/rating\s*(\?\?|\|\|)\s*0/.test(text),
    'an absent rating falls back to zero, which reads as "members rated it badly"',
  );
  // And the catalogue really does carry the case, so the branch is exercised rather than dead.
  assert.ok(
    CATALOGUE.some((gym) => gym.rating === null),
    'the fixture no longer has an unrated gym',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// What is deliberately absent.
// ═══════════════════════════════════════════════════════════════════════════

test('there are no testimonials — a review needs a check-in, BR-REV-01', () => {
  const strings = JSON.stringify(en).toLowerCase();
  for (const word of ['testimonial', 'what our members say', 'loved it', '5 stars']) {
    assert.ok(!strings.includes(word), `the catalogue carries testimonial copy: ${word}`);
  }
  // The header comment DISCUSSES why there are none, which is why this reads `code()` and not
  // `source()` — the explanation must not be what trips the test.
  assert.ok(!/testimonial/i.test(SECTIONS), 'a testimonial is rendered');
});

test('no app-store banner — there is no app to download', () => {
  const strings = JSON.stringify(en).toLowerCase();
  for (const word of ['app store', 'google play', 'download the app', 'play store']) {
    assert.ok(!strings.includes(word), `the catalogue advertises a store listing: ${word}`);
  }
});

test('no invented aggregate counts on the homepage', () => {
  /*
   * "3,245 verified gyms" is the single most common thing a marketing page makes up, and this one
   * would be contradicted by scrolling down to the results.
   *
   * Scanned in the COMPONENTS as well as the catalogue. This read `JSON.stringify(en)` and
   * nothing else, so a figure typed straight into JSX - which is where a number like that
   * actually gets added, because adding it to a message catalogue takes a key and a second
   * thought - was invisible to the one file whose header says its purpose is "A NUMBER APPEARING
   * FROM NOWHERE".
   */
  const inflated = /\b\d{1,3},\d{3}\+?\s*(members|gyms|users|cities|reviews)/gi;
  const plus = /\b\d+[km]?\+\s*(members|gyms|users|reviews)/gi;
  // A bare figure next to the noun, which is the form a hard-coded count takes in markup.
  const bare = /(?<!\{)\b\d{2,}\s*(?:\+\s*)?(members|gyms|users|reviews|listings)\b/gi;

  for (const [where, text] of [
    ['the catalogue', JSON.stringify(en)],
    ...MODULES.map((rel) => [rel, code(rel)] as const),
  ] as const) {
    for (const pattern of [inflated, plus, bare]) {
      const hits = text.match(pattern);
      assert.equal(hits, null, `invented totals in ${where}: ${String(hits)}`);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Wiring and rhythm.
// ═══════════════════════════════════════════════════════════════════════════

test('every section a rendered module exports is actually on the page', () => {
  /*
   * Was a hard-coded list of four tags, which is a list that goes stale in exactly one direction:
   * rename a section and the test names a component nobody has, delete one and it fails for the
   * right reason by accident. Deriving it from the exports catches the case the list could not -
   * a section written, exported, and never wired up, which renders as nothing at all and looks
   * like a section that simply was not built yet.
   */
  /*
   * Whitespace collapsed and matched as a plain string, deliberately not a RegExp built from a
   * template literal. A template literal swallows a backslash-s as a bare `s`, so the pattern
   * reads "Heros" followed by a star, matches nothing, and the assertion reports every section
   * missing while the page renders all of them. The counter below is the backstop: this test has
   * no value if it silently checks nothing.
   */
  const page = code(PAGE).replace(/\s+/g, ' ');
  let checked = 0;
  for (const rel of PAGE_SECTIONS) {
    // PascalCase only. A module can legitimately export a helper the page never renders as a tag
    // - `railToggleHref` builds an href - and demanding `<railToggleHref />` is the test insisting
    // on a component that was never claimed to be one.
    for (const [, name] of code(rel).matchAll(/^export function ([A-Z]\w*)\(/gm)) {
      // `<Name ` or `<Name/` - a section that takes props is still rendered. Requiring the exact
      // `<Name />` failed the day `GymRail` grew a `selected` prop, which is the test being
      // strict about JSX punctuation rather than about the section being on the page. The space
      // or slash is what stops `<GymRailFooter` matching `GymRail`.
      const rendered = page.includes(`<${name!} `) || page.includes(`<${name!}/`);
      assert.ok(rendered, `${name!} is exported by ${rel} but never rendered`);
      checked += 1;
    }
  }
  assert.ok(checked >= 8, `only ${String(checked)} sections checked`);
});

test('every homepage section carries an eyebrow, and every eyebrow key exists', () => {
  const eyebrows = Object.keys(en).filter((key) => key.startsWith('web.home.eyebrow.'));
  assert.ok(eyebrows.length >= 8, `only ${String(eyebrows.length)} eyebrow keys`);

  const rendered = [code(PAGE), SECTIONS].join('\n');
  for (const key of eyebrows) {
    assert.ok(rendered.includes(key), `${key} is defined but never used`);
  }
});

test('the FAQ opens without JavaScript', () => {
  // `<details>` is readable before hydration and by a crawler, which is most of the reason to
  // put an FAQ on a marketing page at all. An accordion built from state is not.
  const text = SECTIONS;
  assert.ok(text.includes('<details'), 'the FAQ is not a details element');
  assert.ok(text.includes('<summary'), 'the FAQ has no summary');
  assert.ok(!text.includes("'use client'"), 'the sections became a client island');
  assert.ok(!text.includes('useState'), 'the FAQ holds open state in React');
});

/**
 * Scoped to the keys this section set introduced, not to `web.home.*` at large.
 *
 * `web.home.meta.title` predates the rule and carries one. The taste skill is explicit that
 * pre-existing dashes are fixed when the string is touched for another reason, and that a change
 * which only removes punctuation is not worth opening - so the exception is named here rather
 * than quietly widened away by loosening the pattern.
 */
const NEW_COPY = ['eyebrow', 'plans', 'compareTeaser', 'member', 'faq'] as const;

test('no string written for the new sections carries an em-dash', () => {
  for (const [key, value] of Object.entries(en)) {
    if (!NEW_COPY.some((group) => key.startsWith(`web.home.${group}.`))) continue;
    assert.ok(!/[—–]/.test(value), `${key} contains an em-dash: ${value}`);
  }
});
