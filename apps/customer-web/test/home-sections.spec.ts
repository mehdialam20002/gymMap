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
  const found = [...code(PAGE).matchAll(/from '\.\.\/(src\/features\/home\/[\w.-]+\.tsx)'/g)].map(
    (match) => match[1]!,
  );
  /*
   * One module is enough to be real - the sections were consolidated into `chalk.tsx` and the
   * count legitimately fell to two. The guard against a regex that matches nothing is this
   * assertion; the guard against a regex that matches too little is `checked >= 8` in the
   * presence test below, which counts the exports these files actually carry.
   */
  assert.ok(found.length >= 1, `no home modules found on ${PAGE}`);
  return found;
})();

/** Every rendered section's code, comments blanked, as one text to scan. */
const SECTIONS = MODULES.map((rel) => code(rel)).join('\n');

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
  assert.ok(SECTIONS.includes('toCompareParams('), 'the CTA does not build a real compare URL');
});

test('the teaser is a real table, not a grid of divs pretending to be one', () => {
  const text = SECTIONS;
  for (const tag of ['<table', '<thead', '<tbody', 'scope="col"', 'scope="row"', '<caption']) {
    assert.ok(text.includes(tag), `the comparison is missing ${tag}`);
  }
});

test('an unrated gym in the teaser reads as words, never 0.0 — BR-REV-01', () => {
  const text = SECTIONS;
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
  // "3,245 verified gyms" is the single most common thing a marketing page makes up, and this
  // one would be contradicted by scrolling down to the results.
  const strings = JSON.stringify(en);
  const inflated = strings.match(/\b\d{1,3},\d{3}\+?\s*(members|gyms|users|cities|reviews)/gi);
  assert.equal(inflated, null, `invented totals in the catalogue: ${String(inflated)}`);
  const plus = strings.match(/\b\d+[km]?\+\s*(members|gyms|users|reviews)/gi);
  assert.equal(plus, null, `invented totals in the catalogue: ${String(plus)}`);
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
  for (const rel of MODULES) {
    for (const [, name] of code(rel).matchAll(/^export function (\w+)\(/gm)) {
      assert.ok(page.includes(`<${name!} />`), `${name!} is exported by ${rel} but never rendered`);
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
