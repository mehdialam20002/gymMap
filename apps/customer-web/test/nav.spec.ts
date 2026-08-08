/**
 * The navigation cannot promise a page that does not exist — `NFR-USE-08`, `AX2`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * `nav-model.ts` HAS CLAIMED THIS TEST EXISTS SINCE IT WAS WRITTEN
 *
 * Its header says "`nav.spec.ts` asserts every `built: true` href resolves to a real file under
 * `app/`, so the flag cannot drift from the router." The file did not exist. A comment that
 * describes a guarantee nobody enforces is worse than no comment: the next person reads it and
 * stops checking.
 *
 * The flag is asserted in BOTH directions. `built: true` on a missing route is a 404 on the
 * most-used component on the site. `built: false` on a route that now exists is a page nobody
 * can reach, which is the failure this project keeps producing — five surfaces were shipped
 * before their nav entries were flipped.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { APP_ROOT } from './helpers.ts';
import { en } from '../src/shared/i18n/messages/en.ts';
import { FOOTER_NAV, PRIMARY_NAV, type NavItem } from '../src/shared/chrome/nav-model.ts';

const EVERY_ITEM: readonly NavItem[] = [
  ...PRIMARY_NAV,
  ...FOOTER_NAV.flatMap((column) => column.items),
];

/** `/for-gyms/signup` → `app/for-gyms/signup/page.tsx`. Static segments only — see below. */
function routeExists(href: string): boolean {
  const segments = href.split('/').filter((segment) => segment !== '');
  return existsSync(join(APP_ROOT, 'app', ...segments, 'page.tsx'));
}

test('every href in the nav is a static path this check can actually resolve', () => {
  // A dynamic segment would make `routeExists` silently useless — `app/gyms/[citySlug]` does not
  // live at `app/gyms/bengaluru`. Nothing in the nav is dynamic today; this asserts it stays so,
  // because the failure would be a check that passes by never checking anything.
  for (const item of EVERY_ITEM) {
    assert.ok(item.href.startsWith('/'), `"${item.href}" is not an absolute path`);
    assert.ok(!item.href.includes('['), `"${item.href}" is a dynamic route`);
    assert.ok(!item.href.includes('?'), `"${item.href}" carries a query string`);
    assert.ok(!item.href.includes('#'), `"${item.href}" carries a fragment`);
  }
});

test('every built: true nav item resolves to a real route', () => {
  const broken = EVERY_ITEM.filter((item) => item.built && !routeExists(item.href));
  assert.deepEqual(
    broken.map((item) => item.href),
    [],
    'the nav links to a route that does not exist — a 404 on the most-used component on the site',
  );
});

test('every built: false nav item really is unbuilt', () => {
  // The direction that keeps happening: a surface ships and its nav entry stays dimmed, so the
  // page exists and nobody can reach it.
  const stale = EVERY_ITEM.filter((item) => !item.built && routeExists(item.href));
  assert.deepEqual(
    stale.map((item) => item.href),
    [],
    'this route exists and the nav still says "soon" — flip `built` to true',
  );
});

test('every nav label is a real message key', () => {
  // A missing key renders the key itself, which looks like a bug in the nav rather than in the
  // catalogue and is the sort of thing screenshots miss because the string is plausible.
  for (const item of EVERY_ITEM) {
    assert.ok(item.label in en, `${item.href} names a label that is not in the catalogue`);
  }
  for (const column of FOOTER_NAV) {
    assert.ok(column.heading in en, `a footer column heading is not in the catalogue`);
  }
});

test('no two nav entries point at the same route with different labels', () => {
  // The same destination under two names in one bar reads as two features. Across the header and
  // the footer it is fine and deliberate — `/for-gyms` is "List your gym" in both.
  const seen = new Map<string, string>();
  for (const item of PRIMARY_NAV) {
    const previous = seen.get(item.href);
    assert.equal(previous, undefined, `${item.href} appears twice in the primary bar`);
    seen.set(item.href, item.label);
  }
});
