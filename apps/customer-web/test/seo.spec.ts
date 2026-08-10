/**
 * What a crawler is told, asserted against what the app actually contains.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THIS AREA HAD NO TESTS, AND NO TESTS IS WHY IT HAD NO ROBOTS FILE
 *
 * Read out of the served HTML rather than the source, three things were missing at once:
 * `/robots.txt` 404, `/sitemap.xml` 404, and no canonical on either `/` or `/search`. The stack is
 * locked on Next.js *specifically* to be server-rendered for search engines, and `FR-SRCH-13` built
 * the city and activity landings for no other purpose - so this was the one area where the
 * architecture's whole justification had nothing checking it.
 *
 * The three properties below are the ones that rot silently. A new city in the catalogue that never
 * reaches the sitemap, a new account screen that is not disallowed, a route that quietly loses its
 * canonical - none of them breaks a page, none shows up in a screenshot, and each one costs exactly
 * the thing the framework was chosen for.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { code } from './helpers.ts';
import { SITE_URL, absolute, indexablePaths } from '../src/shared/seo/site.ts';
import { CATALOGUE, CITIES } from '../src/features/discovery/fixtures/catalogue.ts';
import { activityIndex, cityIndex } from '../src/features/landings/landings.ts';

test('the sitemap carries every landing the catalogue can produce', () => {
  /*
   * The point of the assertion is the DERIVATION. A hand-written list would pass this by being
   * copied, so it is built from the same fixtures the pages render from: add a city and the sitemap
   * grows, or this fails and says which one is missing.
   */
  const paths = new Set(indexablePaths());

  for (const city of cityIndex()) {
    assert.ok(
      paths.has(`/gyms/${city.slug}`),
      `/gyms/${city.slug} is a landing but not in the sitemap`,
    );
  }
  for (const activity of activityIndex()) {
    assert.ok(
      paths.has(`/explore/${activity.slug}`),
      `/explore/${activity.slug} is a landing but not in the sitemap`,
    );
  }
  for (const gym of CATALOGUE) {
    assert.ok(
      paths.has(`/gyms/${gym.citySlug}/${gym.slug}`),
      `${gym.name} has a page that no crawler is told about`,
    );
  }

  // And the count adds up, so a duplicate cannot hide a missing entry.
  assert.equal(
    paths.size,
    indexablePaths().length,
    'the sitemap lists the same URL twice, which is how a missing one goes unnoticed',
  );
  assert.ok(
    CITIES.length > 0 && CATALOGUE.length > 0,
    'the fixtures are empty, so this proved nothing',
  );
});

test('nothing private is in the sitemap, and everything private is disallowed', () => {
  const robots = code('app/robots.ts');

  for (const path of indexablePaths()) {
    assert.ok(
      !path.startsWith('/account') && !path.startsWith('/checkout'),
      `${path} is one member's records and it is in the sitemap`,
    );
    // `/compare` takes arbitrary parameters and is `noindex`; listing it would contradict the page.
    assert.ok(
      !path.startsWith('/compare'),
      `${path} is noindex and in the sitemap, which disagree`,
    );
  }

  for (const prefix of ['/account', '/checkout', '/compare', '/search?']) {
    assert.ok(
      robots.includes(`'${prefix}'`),
      `robots.txt does not disallow ${prefix} — a crawler spends its budget there instead of on ` +
        'the landings FR-SRCH-13 exists to create',
    );
  }
});

test('the site speaks one absolute address, and it is not localhost', () => {
  // A relative canonical is tolerated rather than promised, and an absolute one resolved against
  // the wrong base is worse than none: it points a search engine at a host we do not own.
  assert.ok(SITE_URL.protocol === 'https:', `SITE_URL is ${SITE_URL.protocol}, not https`);
  assert.ok(
    !/localhost|127\.0\.0\.1|\.local$/.test(SITE_URL.hostname),
    `SITE_URL is ${SITE_URL.hostname} — a preview host must not be advertised as canonical`,
  );
  assert.equal(absolute('/sitemap.xml'), `${SITE_URL.origin}/sitemap.xml`);
  assert.equal(absolute('/gyms/bengaluru'), `${SITE_URL.origin}/gyms/bengaluru`);
});

test('the two routes that had no canonical now declare one', () => {
  /*
   * By VALUE, not by presence — checking that the key exists is the failure mode this suite has
   * already been caught by once, in `landings.spec.ts`.
   *
   * `/` matters most: the compare rail keeps its selection in the URL, so `/?gym=a&gym=b` is a real
   * linkable address for the home page and there are hundreds of them.
   */
  for (const [route, expected] of [
    ['app/page.tsx', '/'],
    ['app/search/page.tsx', '/search'],
  ] as const) {
    const found = /alternates:\s*\{\s*canonical:\s*'([^']+)'/.exec(code(route));
    assert.ok(found, `${route} declares no canonical`);
    assert.equal(found[1], expected, `${route} points its canonical at ${String(found[1])}`);
  }
});

test('the root layout sets metadataBase, or every absolute URL resolves to localhost', () => {
  const layout = code('app/layout.tsx');
  assert.match(layout, /metadataBase:\s*SITE_URL/, 'no metadataBase in the root layout');
  // Open Graph inherits from here; a page-level override is fine, an absent default is not.
  assert.match(layout, /openGraph:\s*\{/, 'the site ships no Open Graph at all');
});
