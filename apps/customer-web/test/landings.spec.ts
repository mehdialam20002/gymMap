/**
 * `SCR-WEB-008` / `SCR-WEB-009` — city and activity landings. `FR-SRCH-13`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * A LANDING PAGE FAILS BY BEING INDISTINGUISHABLE FROM ANOTHER ONE
 *
 * Every defect below renders perfectly and costs the whole point of the page: two landings
 * sharing a title, a canonical pointing at the query-string view that competes with it, a slug
 * that round-trips to a category name no gym carries, or a 200 on a city that does not exist.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { code } from './helpers.ts';
// What the routes actually serve, so the assertion below reads what ships rather than a
// reconstruction of it. The routes are `.tsx` and the runner cannot load one, which is part of
// why this composition moved out of `app/`.
import {
  activityLandingMetadata,
  cityLandingMetadata,
} from '../src/features/landings/landing-metadata.ts';
import { CATALOGUE, CATEGORIES, CITIES } from '../src/features/discovery/fixtures/catalogue.ts';
import {
  activityIndex,
  activityLanding,
  activitySlug,
  cityIndex,
  cityLanding,
  toItemList,
} from '../src/features/landings/landings.ts';

// ═══════════════════════════════════════════════════════════════════════════
// Slugs, and the reverse lookup.
// ═══════════════════════════════════════════════════════════════════════════

test('every activity slug resolves back to the EXACT catalogue string', () => {
  // `group-classes` → `Group classes` by lookup. Un-slugging the text gives `Group Classes`,
  // which matches no gym at all and produces a landing that is permanently empty.
  for (const name of CATEGORIES) {
    const landing = activityLanding(activitySlug(name));
    assert.ok(landing, `${name} does not resolve from its own slug`);
    assert.equal(landing.name, name, `${name} came back as "${landing.name}"`);
  }
});

test('activity slugs are unique, so two activities cannot share a URL', () => {
  const slugs = CATEGORIES.map(activitySlug);
  assert.equal(new Set(slugs).size, slugs.length, `two activities collide: ${slugs.join(', ')}`);
  for (const slug of slugs) {
    assert.match(slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, `"${slug}" is not a clean slug`);
  }
});

test('an unknown slug resolves to null, so the route can 404 rather than serve an empty page', () => {
  // A 200 on a city that does not exist is a soft-404: the crawler keeps the dead URL indexed
  // and keeps returning to it.
  for (const junk of ['', 'nowhere', 'BENGALURU', 'bengaluru/', '../search']) {
    assert.equal(cityLanding(junk), null, `city "${junk}" resolved`);
    assert.equal(activityLanding(junk), null, `activity "${junk}" resolved`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// The listings agree with search.
// ═══════════════════════════════════════════════════════════════════════════

test('a city landing lists exactly the gyms in that city', () => {
  for (const city of CITIES) {
    const landing = cityLanding(city.slug);
    assert.ok(landing);
    assert.equal(landing.gyms.length, city.count, `${city.name}: count disagrees with the index`);
    for (const gym of landing.gyms) {
      assert.equal(gym.citySlug, city.slug, `${gym.name} is not in ${city.name}`);
    }
  }
});

test('an activity landing lists exactly the gyms offering it', () => {
  for (const activity of activityIndex()) {
    const landing = activityLanding(activity.slug);
    assert.ok(landing);
    assert.equal(landing.gyms.length, activity.count, `${activity.name}: count disagrees`);
    for (const gym of landing.gyms) {
      assert.ok(gym.categories.includes(activity.name), `${gym.name} does not offer it`);
    }
  }
});

test('a hub never links to a landing that would be empty', () => {
  // A hub full of dead ends is how a crawler decides a section is shallow, and how a member
  // decides the marketplace is.
  for (const city of cityIndex()) assert.ok(city.count > 0, `${city.name} is listed with no gyms`);
  for (const activity of activityIndex()) {
    assert.ok(activity.count > 0, `${activity.name} is listed with no gyms`);
  }
});

test('a city landing only cross-links activities that are actually offered there', () => {
  for (const city of CITIES) {
    const landing = cityLanding(city.slug)!;
    for (const activity of landing.activities) {
      const offered = landing.gyms.some((gym) => gym.categories.includes(activity));
      assert.ok(offered, `${city.name} links to ${activity} and has none`);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FR-SRCH-13 · what makes it a page rather than a view.
// ═══════════════════════════════════════════════════════════════════════════

test('every landing declares its own canonical', () => {
  /*
   * Without one, `/gyms/bengaluru` and `/search?city=bengaluru` compete for the same results and
   * a search engine picks - usually the one with less copy on it.
   *
   * The two DYNAMIC landings are checked by calling what they serve, which also proves the
   * canonical is per-slug rather than one constant on every city. The two INDEX routes are still
   * read as source: they hand Next a literal and there is nothing to call.
   */
  const seen = new Set<string>();
  for (const city of CITIES) {
    const canonical = cityLandingMetadata(city.slug).canonical;
    assert.equal(canonical, `/gyms/${city.slug}`, `/gyms/${city.slug} has the wrong canonical`);
    assert.ok(!seen.has(canonical), `${canonical} is claimed by two landings`);
    seen.add(canonical);
  }
  for (const activity of activityIndex()) {
    const canonical = activityLandingMetadata(activity.slug).canonical;
    assert.equal(
      canonical,
      `/explore/${activity.slug}`,
      `${activity.slug} has the wrong canonical`,
    );
    assert.ok(!seen.has(canonical), `${canonical} is claimed by two landings`);
    seen.add(canonical);
  }

  for (const route of ['app/cities/page.tsx', 'app/explore/page.tsx']) {
    assert.match(code(route), /alternates:\s*\{\s*canonical:/, `${route} has no canonical`);
  }
});

test('the two dynamic landings call notFound() rather than rendering nothing', () => {
  for (const route of ['app/gyms/[citySlug]/page.tsx', 'app/explore/[activitySlug]/page.tsx']) {
    assert.match(code(route), /notFound\(\)/, `${route} serves a soft-404`);
  }
});

test('no two landings share a title or a description', () => {
  /*
   * ┌─ THIS TEST USED TO ASSERT THAT A SET IT HAD JUST BUILT WAS AS BIG AS THE LIST IT BUILT IT  ┐
   * │ FROM. It added `city:Bengaluru` and `activity:Yoga` - strings it invented on the spot, one │
   * │ per landing, guaranteed distinct because the prefix and the name made them so - and then   │
   * │ checked the count. No title and no description was ever read. Two landings could have       │
   * │ shipped byte-identical metadata and it would have passed, which is the one failure it is    │
   * │ named after.                                                                                │
   * │                                                                                             │
   * │ It calls the real `generateMetadata` now, the same function the route exports, for every    │
   * │ city and every activity.                                                                     │
   * └─────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const titles = new Map<string, string>();
  const descriptions = new Map<string, string>();

  const record = (where: string, meta: { title?: unknown; description?: unknown }) => {
    const title = String(meta.title ?? '');
    const description = String(meta.description ?? '');
    assert.notEqual(title, '', `${where} has no title`);
    assert.notEqual(description, '', `${where} has no description`);
    const clashTitle = titles.get(title);
    assert.equal(
      clashTitle,
      undefined,
      `${where} and ${String(clashTitle)} share a title: ${title}`,
    );
    const clashDescription = descriptions.get(description);
    assert.equal(
      clashDescription,
      undefined,
      `${where} and ${String(clashDescription)} share a description: ${description}`,
    );
    titles.set(title, where);
    descriptions.set(description, where);
  };

  for (const city of CITIES) {
    record(`/gyms/${city.slug}`, cityLandingMetadata(city.slug));
  }
  for (const activity of activityIndex()) {
    record(`/explore/${activity.slug}`, activityLandingMetadata(activity.slug));
  }

  // And the count still has to add up, or a landing that returned nothing would pass silently.
  assert.equal(titles.size, CITIES.length + activityIndex().length);
});

// ═══════════════════════════════════════════════════════════════════════════
// The structured data.
// ═══════════════════════════════════════════════════════════════════════════

test('the ItemList carries positions and URLs, and no rating or price', () => {
  // Those belong on the gym's own page where they are the subject. Duplicated into a list they
  // start contradicting themselves across two URLs, which is read as manipulation rather than as
  // a bug.
  const list = toItemList(CATALOGUE.slice(0, 3), 'https://example.test');
  const serialised = JSON.stringify(list);
  assert.ok(!serialised.includes('aggregateRating'), 'the list publishes a rating');
  assert.ok(!serialised.includes('price'), 'the list publishes a price');

  const items = list['itemListElement'] as { position: number; url: string }[];
  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map((item) => item.position),
    [1, 2, 3],
  );
  for (const item of items) assert.match(item.url, /^https:\/\/example\.test\/gyms\//);
});

test('the ItemList is escaped for a script tag, like every other JSON-LD on the site', () => {
  // Gym names are owner-typed. `JSON.stringify` leaves `<` alone because JSON does not care, and
  // the HTML parser is still hunting for `</script`.
  for (const route of ['app/gyms/[citySlug]/page.tsx', 'app/explore/[activitySlug]/page.tsx']) {
    const text = code(route);
    assert.match(text, /toJsonLd\(/, `${route} does not escape its structured data`);
    assert.ok(!/JSON\.stringify\(/.test(text), `${route} uses JSON.stringify in a script tag`);
  }
});

test('the origin for structured data is configured, never inferred from a request', () => {
  // A URL built from a `Host` header is a URL an attacker can set, and it ends up in the index.
  for (const route of ['app/gyms/[citySlug]/page.tsx', 'app/explore/[activitySlug]/page.tsx']) {
    assert.match(code(route), /process\.env\['NEXT_PUBLIC_SITE_ORIGIN'\]/, route);
    assert.ok(!code(route).includes('headers()'), `${route} reads the request host`);
  }
});
