/**
 * `M-030` `AC-5` · The normaliser against the variant corpus — `BR-GYM-09`, `E2.9`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * EVERY CASE HERE IS AN EQUIVALENCE OR A DISTINCTION, NEVER JUST A STRING
 *
 * A flat list of addresses can only show the normaliser did not crash. What decides whether
 * `BR-GYM-09` works is whether two TYPINGS of one premises collapse, and whether two genuinely
 * different premises stay apart — so the corpus is pairs with verdicts.
 *
 * Both directions are asserted because they fail differently. Too loose and a real gym is refused
 * at a unique index it should never have hit; too tight and the duplicate is never caught. The
 * milestone says which to fear — *"a false duplicate-address positive blocks a legitimate gym"* —
 * so the `different` half of the corpus is the one carrying the weight.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { isSameAddress, normaliseAddress } from '../dist/onboarding/domain/address.normaliser.js';

const CORPUS = JSON.parse(readFileSync(resolve('test/fixtures/address-corpus.json'), 'utf8')) as {
  same: { class: string; a: string; b: string }[];
  different: { class: string; a: string; b: string }[];
};

test('CONTROL — the corpus is loaded and non-trivial', () => {
  // Without this, an unreadable or empty fixture would make every loop below iterate zero times
  // and the suite would report a perfectly tuned normaliser having compared nothing.
  assert.ok(CORPUS.same.length >= 30, `only ${CORPUS.same.length} equivalence pairs`);
  assert.ok(CORPUS.different.length >= 10, `only ${CORPUS.different.length} distinction pairs`);
});

test('AC-5 — every equivalence pair normalises to one string', () => {
  const failures: string[] = [];
  for (const { class: cls, a, b } of CORPUS.same) {
    if (!isSameAddress(a, b)) {
      failures.push(
        `[${cls}]\n    ${a}\n      → ${normaliseAddress(a)}\n    ${b}\n      → ${normaliseAddress(b)}`,
      );
    }
  }
  assert.deepEqual(
    failures,
    [],
    `${failures.length} pair(s) did not collapse:\n\n${failures.join('\n\n')}`,
  );
});

test('AC-5 — every distinction pair stays apart', () => {
  // ┌─ THE HALF THAT MATTERS MOST ───────────────────────────────────────────────────────────────┐
  // │ A normaliser that returned the empty string for everything would pass the test above. This │
  // │ one is what stops it, and it is also the real hazard: `Shop 4` and `Shop 5` in one building │
  // │ are two paying tenants, and merging them refuses the second at the unique index.            │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const failures: string[] = [];
  for (const { class: cls, a, b } of CORPUS.different) {
    if (isSameAddress(a, b)) {
      failures.push(`[${cls}] both → "${normaliseAddress(a)}"\n    ${a}\n    ${b}`);
    }
  }
  assert.deepEqual(failures, [], `${failures.length} pair(s) merged:\n\n${failures.join('\n\n')}`);
});

test('the corpus covers the variant classes the milestone names', () => {
  // AC-5 says "including flat and floor variants". Asserting the coverage keeps a future edit from
  // deleting the awkward cases and leaving a corpus that passes because it stopped asking.
  // `?? c.class` rather than `?? ''`: under `noUncheckedIndexedAccess` a split's first element is
  // `string | undefined`, and defaulting to the empty string would make a class with no ' · ' vanish
  // from the set — silently shrinking the very coverage this test asserts.
  const classes = new Set(
    [...CORPUS.same, ...CORPUS.different].map((c) => c.class.split(' · ')[0] ?? c.class),
  );
  for (const required of ['unit synonyms', 'floor', 'wing', 'landmark stripped', 'token order']) {
    const firstWord = required.split(' ')[0] ?? required;
    assert.ok(
      [...classes].some((c) => c.startsWith(firstWord)),
      `no corpus case covers "${required}"`,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Properties the index depends on
// ═══════════════════════════════════════════════════════════════════════════

test('normalisation is idempotent', () => {
  // The value goes into a UNIQUE INDEX. If normalising a normalised address changed it, a
  // re-index or a backfill would produce keys that no longer match the rows they came from.
  for (const { a } of CORPUS.same) {
    const once = normaliseAddress(a);
    assert.equal(normaliseAddress(once), once, `not idempotent: ${a}`);
  }
});

test('normalisation is deterministic across calls', () => {
  // Nothing here may depend on time, randomness or iteration order — the index is built once and
  // read forever, and a normaliser that drifted would silently stop matching stored rows.
  for (const { a } of CORPUS.same.slice(0, 10)) {
    assert.equal(normaliseAddress(a), normaliseAddress(a));
  }
});

test('an empty or punctuation-only address normalises to the empty string', () => {
  // Worth pinning because the partial unique index must not treat "" as a colliding address —
  // the index predicate excludes it, and this is the value that predicate has to recognise.
  for (const junk of ['', '   ', ',,,', '.-/']) {
    assert.equal(normaliseAddress(junk), '');
  }
});

test('a landmark does not eat the locality that follows it', () => {
  // The first implementation stripped `near …` after commas had already become spaces, so the
  // pattern ran to the end of the string. "Plot 3, Near Big Bazaar, Kothrud" became "3 plot" and
  // every Kothrud address collided with every Baner one.
  const withLandmark = normaliseAddress('Plot 3, Near Big Bazaar, Kothrud');
  assert.match(withLandmark, /kothrud/);
  assert.equal(withLandmark.includes('bazaar'), false);
});
