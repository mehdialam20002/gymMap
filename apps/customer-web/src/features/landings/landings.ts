/**
 * City and activity landing pages — `FR-SRCH-13`, `SCR-WEB-008`, `SCR-WEB-009`.
 *
 * ┌─ WHY THESE EXIST WHEN `/search` ALREADY FILTERS ────────────────────────────────────────────┐
 * │ `/search?city=bengaluru` and `/gyms/bengaluru` return the same gyms, and only one of them is │
 * │ a page a search engine will rank. A query-string view is a VIEW: parameterised, one of        │
 * │ thousands of combinations, and correctly treated as thin. A path is a PLACE — it has a         │
 * │ canonical URL, its own title and description, its own copy, and links in from other places   │
 * │ on the site.                                                                                  │
 * │                                                                                              │
 * │ "Gyms in Indiranagar" is what a member types into a search engine, and it is the whole of     │
 * │ how a local marketplace is found. The results page is where they go after they arrive.        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE SLUG IS DERIVED, AND THE REVERSE LOOKUP IS EXACT ──────────────────────────────────────┐
 * │ Activities are display strings the catalogue owns — `Group classes`, not `group-classes`.    │
 * │ The slug is generated from the name, and resolving one goes back through the SAME list       │
 * │ rather than un-slugging the text: `group-classes` → `Group classes` by lookup, never by       │
 * │ replacing hyphens with spaces and capitalising, which produces `Group Classes` and matches    │
 * │ no gym at all.                                                                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { CATALOGUE, CATEGORIES, CITIES, type GymDetail } from '../discovery/fixtures/catalogue.ts';
import { EMPTY_QUERY, search } from '../discovery/search.ts';

export interface CityLanding {
  readonly slug: string;
  readonly name: string;
  readonly gyms: readonly GymDetail[];
  /** The activities actually on offer in this city, so the cross-links go somewhere real. */
  readonly activities: readonly string[];
}

export interface ActivityLanding {
  readonly slug: string;
  /** The catalogue's own string — what `/search?category=` must receive. */
  readonly name: string;
  readonly gyms: readonly GymDetail[];
  /** The cities where this activity is offered. */
  readonly cities: readonly { slug: string; name: string; count: number }[];
}

/** `Group classes` → `group-classes`. Lower-case, single hyphens, no trailing punctuation. */
export function activitySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Every activity as a landing stub, ordered by how many gyms offer it. */
export function activityIndex(): readonly { slug: string; name: string; count: number }[] {
  return CATEGORIES.map((name) => ({
    slug: activitySlug(name),
    name,
    count: CATALOGUE.filter((gym) => gym.categories.includes(name)).length,
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function cityIndex(): readonly { slug: string; name: string; count: number }[] {
  return [...CITIES].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Resolves a city landing, or `null` for a slug that names nothing.
 *
 * `null` and not an empty landing: the route calls `notFound()`, because a 200 on a city that
 * does not exist is a soft-404 and a crawler keeps the dead URL indexed and keeps returning to
 * it (`soft-404.spec.ts` pins the whole property).
 */
export function cityLanding(slug: string): CityLanding | null {
  const city = CITIES.find((candidate) => candidate.slug === slug);
  if (city === undefined) return null;

  const gyms = search({ ...EMPTY_QUERY, city: slug, sort: 'distance' });

  return {
    slug: city.slug,
    name: city.name,
    gyms,
    activities: [...new Set(gyms.flatMap((gym) => gym.categories))].sort((a, b) =>
      a.localeCompare(b),
    ),
  };
}

export function activityLanding(slug: string): ActivityLanding | null {
  // Back through the list, never by un-slugging the text — see the header.
  const name = CATEGORIES.find((candidate) => activitySlug(candidate) === slug);
  if (name === undefined) return null;

  const gyms = search({ ...EMPTY_QUERY, category: name, sort: 'distance' });

  return {
    slug,
    name,
    gyms,
    cities: CITIES.map((city) => ({
      slug: city.slug,
      name: city.name,
      count: gyms.filter((gym) => gym.citySlug === city.slug).length,
    }))
      .filter((city) => city.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}

/**
 * The `ItemList` a listing page can legitimately publish — `FR-SRCH-13`.
 *
 * Positions and URLs only. No `aggregateRating` and no price: those belong on the gym's own page,
 * where they are the page's subject, and duplicating them into a list is how structured data
 * starts contradicting itself across two URLs — which search engines treat as a manipulation
 * signal rather than as a bug.
 */
export function toItemList(gyms: readonly GymDetail[], origin: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: gyms.length,
    itemListElement: gyms.map((gym, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${origin}/gyms/${gym.citySlug}/${gym.slug}`,
      name: gym.name,
    })),
  };
}
