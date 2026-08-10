/**
 * One fact, one sentence, on every surface.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS
 *
 * A gym appears on the home rail, the results card, two landings, the gym page, the comparison
 * table, the compare picker and checkout. Its price, distance, rating and verified state are
 * rendered by a DIFFERENT component each time, and nothing made them agree.
 *
 * They did not. Found by audit, in this order:
 *
 *   - the gym page said "1.2 km away" while every other surface said "1.2 km from centre" — and
 *     "away" does not omit the origin, it names the wrong one, on a site with no geolocation
 *   - the home rail and the home comparison band printed a bare "1.2 km", with the unit hard-coded
 *     into the JSX and outside the message catalogue
 *   - the compare picker printed the price with no "from" and no "per month", and it is the grid a
 *     member chooses from
 *   - the plans row truncated the facility list to three with no "+N more", while the card two
 *     sections above showed one — same page, same gym, two different lists
 *   - four of five surfaces rendered the Verified badge without reading `gym.verified`
 *
 * Every one renders correctly on its own screen. The defect only exists in the comparison, which
 * is exactly the defect a per-component test cannot see. So these are COUNTED against each other:
 * a render site that does not go through the shared helper makes the numbers disagree, and the
 * failure names the file.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { code } from './helpers.ts';
import { en } from '../src/shared/i18n/messages/en.ts';
import { CATALOGUE } from '../src/features/discovery/fixtures/catalogue.ts';

/** Every `.tsx` under `src/features`, which is where every render site lives. */
function featureFiles(dir = 'src/features'): readonly string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...featureFiles(path));
    else if (entry.endsWith('.tsx')) out.push(path.replaceAll('\\', '/'));
  }
  return out;
}

const FILES = featureFiles();
const count = (text: string, re: RegExp) => [...text.matchAll(re)].length;

test('CONTROL — the walk finds the components it is meant to check', () => {
  // Without this, every assertion below passes on an empty file list.
  assert.ok(FILES.length >= 8, `only ${String(FILES.length)} feature components found`);
  for (const expected of [
    'src/features/discovery/gym-card.tsx',
    'src/features/gym-detail/gym-detail.tsx',
    'src/features/compare/compare-table.tsx',
    'src/features/home/chalk.tsx',
  ]) {
    assert.ok(FILES.includes(expected), `${expected} is not in the walk`);
  }
});

test('every rendered distance names where it is measured from', () => {
  /*
   * The app has no geolocation: it asks for no permission and reads no coordinate. A figure
   * printed as a bare "1.2 km" beside a locality is read as "from you" and cannot be, so the
   * catalogue's `distanceKm` is only ever rendered through one string.
   *
   * Counted, not searched for: `.toFixed(1)` on the field is a render, and each one must have its
   * own `distanceFromCentre`. A new surface that prints the number bare makes these disagree.
   */
  for (const file of FILES) {
    const text = code(file);
    const renders = count(text, /distanceKm\.toFixed\(/g);
    const named = count(text, /web\.gym\.distanceFromCentre/g);
    assert.equal(
      named,
      renders,
      `${file} renders the distance ${String(renders)} time(s) but names its origin ${String(named)} — ` +
        'a bare "1.2 km" beside a locality claims a distance from the reader that this app cannot know',
    );
  }

  /*
   * And the string itself still says it, so the check above cannot be satisfied by an empty phrase.
   *
   * The second assertion here scanned EVERY catalogue value for the word "away" on its first run,
   * and it fired on "Nothing is rounded away" in the settlement copy — a different word doing a
   * different job. A gate that reports a correct sentence as a defect is one its reader learns to
   * skip, so it is scoped to the two strings that actually describe a distance.
   */
  assert.match(en['web.gym.distanceFromCentre'], /from centre/);
  for (const key of ['web.gym.distanceFromCentre', 'web.gym.facts.distance'] as const) {
    assert.ok(
      !/\baway\b/.test(en[key]),
      `${key} says "away", which names the reader as the origin of a distance nothing measures`,
    );
  }
});

test('every rendered price is qualified, and none is formatted by hand', () => {
  /*
   * `fromPriceMinor` is the CHEAPEST of a gym's plans and a monthly rate. Printed bare it reads as
   * the price of membership, which is the expectation `BR-PLN-03` exists to protect - and the
   * compare picker, the one grid a member selects from, was the only surface printing it bare.
   */
  for (const file of FILES) {
    const text = code(file);
    const renders = count(text, /formatMinor\(gym\.fromPriceMinor\)/g);
    if (renders === 0) continue;
    /*
     * ┌─ THE QUALIFIER IS NOT ALWAYS A PHRASE BESIDE THE NUMBER ───────────────────────────────┐
     * │ This started as `perMonthFrom` alone and had to be widened twice, which is the finding:  │
     * │ the rule is "the figure is qualified SOMEWHERE the reader will see", and a surface is    │
     * │ free to do that with a structure rather than a sentence.                                 │
     * │                                                                                          │
     * │   compare-table.tsx   a table row's label — "From, per month", once, for four columns     │
     * │   gym-detail.tsx      a definition list's term and hint — "From" and "per month"          │
     * │   gym-card.tsx        a phrase under the amount                                           │
     * │                                                                                          │
     * │ All three are correct. Only a bare `formatMinor(...)` with none of them is the defect,    │
     * │ which is what the compare picker was.                                                     │
     * └──────────────────────────────────────────────────────────────────────────────────────────┘
     */
    const QUALIFIERS =
      /perMonthFrom|plans\.perMonth\b|compare\.row\.price|facts\.from|facts\.perMonth/g;
    const qualified = count(text, QUALIFIERS);
    assert.ok(
      qualified >= renders,
      `${file} prints the "from" price ${String(renders)} time(s) with ${String(qualified)} qualifier(s) — ` +
        'an unqualified figure is read as what joining costs',
    );
  }

  // Money never reaches a surface through anything but the one formatter.
  for (const file of FILES) {
    const text = code(file);
    assert.ok(
      !/(?:PriceMinor|priceMinor|totalMinor|amountMinor)[^\n]{0,30}\.toLocaleString\(/.test(text),
      `${file} formats a money value by hand instead of through the single formatter`,
    );
  }
});

test('a list that truncates says how much it left out', () => {
  // A truncation with no marker is not a summary; it is a shorter fact. The card and the plans row
  // showed the same gym's facilities as two different lists, and only one admitted it was a list.
  for (const file of FILES) {
    const text = code(file);
    const truncations = count(text, /amenities\.slice\(0,\s*\w+\)/g);
    if (truncations === 0) continue;
    assert.ok(
      count(text, /amenitiesMore/g) >= truncations,
      `${file} truncates the facility list ${String(truncations)} time(s) with no "+N more"`,
    );
  }
});

test('the Verified badge reads the field that records the approval — BR-GYM-01', () => {
  /*
   * The badge is a statement that a human approved the listing. Four of the five surfaces printed
   * it unconditionally, and the reason was the TYPE: `verified` was the literal `true`, so a false
   * value was impossible and reading the field looked like ceremony. The day it becomes real data
   * the type widens, and four surfaces would have gone on printing "Verified" over gyms nobody had
   * approved, with nothing failing.
   */
  const BADGE = /web\.gym\.(?:verified|verifiedByPlatform|facts\.verified)\b/;
  for (const file of FILES) {
    const text = code(file);
    if (!BADGE.test(text)) continue;
    assert.match(
      text,
      /(?:gym|listing)\.verified/,
      `${file} renders the Verified badge without consulting \`verified\` — BR-GYM-01 makes that ` +
        'badge a claim about a human decision, so it may not be drawn unconditionally',
    );
  }

  // And the type must stay wide enough for a false to exist, or the check above is theatre.
  const fixture = code('src/features/discovery/fixtures/catalogue.ts');
  assert.match(
    fixture,
    /readonly verified: boolean;/,
    'the `verified` field is a literal again, which makes every badge unconditional by construction',
  );
  assert.ok(
    CATALOGUE.every((gym) => gym.verified),
    'a fixture is unverified and still listed',
  );
});
