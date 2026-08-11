/**
 * Side-by-side comparison — `SCR-WEB-004`, `FR-CMP-01` … `FR-CMP-04`.
 *
 * ┌─ THE COMPARISON SET LIVES IN THE URL, NOT IN A CLIENT STORE ────────────────────────────────┐
 * │ Every product that ships a compare feature ships it as a floating tray backed by             │
 * │ `localStorage`, and every one of them has the same three bugs: the tray is empty in a second │
 * │ tab, the comparison cannot be sent to the person who is actually paying, and a crawler sees  │
 * │ one page for every possible comparison.                                                       │
 * │                                                                                              │
 * │ `?gym=bengaluru/iron-house-indiranagar&gym=delhi/…` fixes all three for free. The page is a  │
 * │ pure function of its URL, so it is shareable, bookmarkable, back-button-correct and server-   │
 * │ rendered — which is the same reason `SCR-WEB-002` keeps its filters there (`FR-SRCH-13`).    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ `citySlug/gymSlug`, NEVER THE GYM SLUG ALONE ──────────────────────────────────────────────┐
 * │ `findGym` is keyed on the PAIR, because two cities may each have a "Gold's Gym Central" and  │
 * │ a slug is only promised unique within its city. The fixture's slugs happen to be globally    │
 * │ unique today, which is exactly why a URL format that relies on it would survive review and   │
 * │ break on the first real duplicate.                                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { CATALOGUE, type GymDetail } from '../discovery/fixtures/catalogue.ts';
import { findGym } from '../discovery/search.ts';
import type { RawParams } from '../discovery/search.ts';

/**
 * Four.
 *
 * Not a rendering limit — five columns fit on a desktop. It is the point past which a comparison
 * stops being a decision and becomes a spreadsheet, and on a phone each column is already a
 * third of the screen. `FR-CMP-01` sets it; this constant is the only place it is written down.
 */
export const MAX_COMPARE = 4;

/** A gym's stable identity in a compare URL. */
export function compareKey(gym: { citySlug: string; slug: string }): string {
  return `${gym.citySlug}/${gym.slug}`;
}

export interface CompareSelection {
  /** The gyms that resolved, in the order the URL listed them, capped at `MAX_COMPARE`. */
  readonly gyms: readonly GymDetail[];
  /** Keys that named nothing. Reported rather than silently dropped — see below. */
  readonly unresolved: readonly string[];
  /** True when the URL asked for more than `MAX_COMPARE` and the extras were dropped. */
  readonly truncated: boolean;
}

/**
 * Reads a comparison out of the URL.
 *
 * ┌─ AN UNKNOWN GYM IS REPORTED, NOT SWALLOWED ─────────────────────────────────────────────────┐
 * │ A shared comparison outlives the listings in it: a gym is delisted (`BR-GYM-01` works in     │
 * │ both directions) and the link a member sent their friend now names four gyms and shows       │
 * │ three. Dropping the fourth silently means the two of them are looking at different pages and │
 * │ neither knows it. The page says which one is gone.                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function parseCompare(params: RawParams): CompareSelection {
  const raw = params['gym'];
  const requested = (raw === undefined ? [] : Array.isArray(raw) ? raw : [raw])
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value !== '');

  // Deduplicated, first occurrence wins. `?gym=a&gym=a` is a link somebody built by hand or a
  // double-submitted form; comparing a gym with itself is not a comparison.
  const unique = [...new Set(requested)];

  const gyms: GymDetail[] = [];
  const unresolved: string[] = [];
  for (const key of unique) {
    const slash = key.indexOf('/');
    const gym = slash === -1 ? null : findGym(key.slice(0, slash), key.slice(slash + 1));
    if (gym === null) unresolved.push(key);
    else gyms.push(gym);
  }

  return {
    gyms: gyms.slice(0, MAX_COMPARE),
    unresolved,
    truncated: gyms.length > MAX_COMPARE,
  };
}

/**
 * Where a compare link points back to — ADR-0050.
 *
 * ┌─ ONE OBJECT, BECAUSE THE TWO HALVES ARE ONE FACT ───────────────────────────────────────────┐
 * │ This was two positional parameters, `base` and `fragment`, each defaulted. Defaults are what │
 * │ let the results page ship `toCompareParams([compareKey(gym)])`: a call that reads as "start   │
 * │ a comparison", compiles, and silently means "throw away the reader's selection and leave     │
 * │ the page". A single required object is what makes the caller state where the reader is.      │
 * │                                                                                              │
 * │ `path` carries the QUERY as well as the pathname. Measured from                              │
 * │ `/search?city=bengaluru&sort=rating`, the old control resolved to `/compare?gym=<one gym>` — │
 * │ the city and the sort were gone. The base for that page is the whole of                      │
 * │ `toSearchParams(query)`, so a toggle keeps every filter the reader set.                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export interface CompareBase {
  /**
   * The pathname, plus any query string the page must keep. It never carries `gym` — that is the
   * parameter this module writes, and a base holding one would double it on every click.
   */
  readonly path: string;
  /**
   * An in-page anchor, where the surface has one worth returning to. The home page has `#gyms`
   * over its own gym rail. `/search` has none and does not need one: every link that stays on
   * that page carries `scroll={false}` instead, which is the same promise without a target.
   */
  readonly fragment?: string;
}

/**
 * The comparison page itself.
 *
 * The default for the surfaces whose control genuinely means "open the comparison" — the home
 * teaser's two buttons and the rail's own call to action. It is NOT the default for a card's
 * toggle, which is why `GymCard` takes its base as a required prop.
 */
export const COMPARE_PAGE: CompareBase = { path: '/compare' };

/**
 * The URL for a given set, on a given page.
 *
 * ┌─ THE SELECTION IS THE URL, WHICH IS WHY IT WORKS EVERYWHERE ────────────────────────────────┐
 * │ `base` exists so a page other than `/compare` can carry a selection: a page adds and removes │
 * │ gyms by navigating to ITSELF with a different query, which needs no client state, no store   │
 * │ and no hydration. The same links work in a crawler, in a shared message, and with JavaScript │
 * │ switched off, and the back button undoes a selection because the selection IS a history      │
 * │ entry.                                                                                        │
 * │                                                                                              │
 * │ `fragment` keeps the reader where they were. Without it, adding the fourth gym on a page     │
 * │ nine screens long returns them to the top, which is how a control that works feels broken.   │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function toCompareParams(keys: readonly string[], base: CompareBase = COMPARE_PAGE): string {
  const params = new URLSearchParams();
  for (const key of keys.slice(0, MAX_COMPARE)) params.append('gym', key);
  const encoded = params.toString();
  /*
   * `&` when the base already has a query, `?` when it does not.
   *
   * This is the line ADR-0050 turns on. `/search?city=bengaluru&sort=rating` is a legitimate base
   * now, and the old `${base}?${encoded}` would have emitted
   * `/search?city=bengaluru&sort=rating?gym=…` — a second `?` is not a delimiter, so the whole of
   * `sort=rating?gym=bengaluru/iron-house-indiranagar` parses as ONE value of `sort`, the sort
   * silently resets to relevance and the compare parameter never arrives at all.
   *
   * A string join and not `new URL()`: these are relative hrefs, and `URL` requires an origin
   * this module has no business inventing.
   */
  const separator = base.path.includes('?') ? '&' : '?';
  const query = encoded === '' ? '' : `${separator}${encoded}`;
  return `${base.path}${query}${base.fragment ?? ''}`;
}

/** The URL that adds a gym to the current set — or removes it, if it is already there. */
export function toggleHref(
  current: readonly GymDetail[],
  gym: { citySlug: string; slug: string },
  base: CompareBase = COMPARE_PAGE,
): string {
  const key = compareKey(gym);
  const keys = current.map(compareKey);
  return toCompareParams(keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key], base);
}

/**
 * Every gym not already in the comparison, so the page can offer them.
 *
 * Nearest first, matching every other surface. When the catalogue is an API this becomes a
 * request with an exclusion list, and the caller does not change.
 */
export function addableGyms(selected: readonly GymDetail[]): readonly GymDetail[] {
  const chosen = new Set(selected.map(compareKey));
  return [...CATALOGUE]
    .filter((gym) => !chosen.has(compareKey(gym)))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * The union of every amenity across the compared gyms, sorted.
 *
 * The union and not the intersection: the whole question a member is asking is "which of these
 * has a sauna", and an intersection answers "all of them do" or shows nothing. A row per amenity
 * with a mark per gym is the only shape that answers it.
 */
export function amenityMatrix(gyms: readonly GymDetail[]): readonly string[] {
  return [...new Set(gyms.flatMap((gym) => gym.amenities))].sort((a, b) => a.localeCompare(b));
}
