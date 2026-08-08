/**
 * No soft-404 on an indexable route — `FR-SRCH-13`, `FR-DETL-10`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS PINS, AND WHY A SCREENSHOT WOULD NEVER SHOW IT
 *
 * `app/gyms/[citySlug]/[gymSlug]/page.tsx` calls `notFound()` for a slug that resolves to
 * nothing. In a browser that looks perfect: the not-found page appears, and a person testing it
 * ticks the box and moves on.
 *
 * The HTTP status was 200.
 *
 * A streamed response commits its status with the first flushed byte, and a `loading.tsx`
 * ANYWHERE IN THE ANCESTOR CHAIN wraps the segment in a Suspense boundary that starts the
 * stream. `app/loading.tsx` therefore made every route in the application stream, so by the time
 * the page decided the gym did not exist, the 200 was already on the wire and `notFound()` could
 * only choose which HTML followed it.
 *
 * That is a soft-404, and `FR-SRCH-13` is the reason it matters: a crawler that reads 200 keeps
 * the dead URL in the index, keeps re-crawling it, and can index the not-found copy as though it
 * were the listing. The fix was to move the skeleton down to `app/search/`, which never calls
 * `notFound()`.
 *
 * These assertions are STRUCTURAL rather than a live request, so they run in the same fast unit
 * suite as everything else. The property they protect — "no Suspense boundary above a route that
 * can 404" — is the one that was violated, and it is violated by ADDING A FILE, which is exactly
 * the change no reviewer flags.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = join(APP_ROOT, 'app');

/** Every `page.tsx` under `app/`, as a path relative to `app/`. */
function routeFiles(dir = APP_DIR, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) return routeFiles(join(dir, entry.name), relative);
    return entry.name === 'page.tsx' ? [relative] : [];
  });
}

/** The segment directories between `app/` and a route, innermost last — including `app/` itself. */
function ancestorSegments(routeFile: string): string[] {
  const parts = routeFile.split('/').slice(0, -1);
  return parts.reduce<string[]>(
    (acc, part) => [...acc, acc.length === 0 ? part : `${acc[acc.length - 1] ?? ''}/${part}`],
    [''],
  );
}

const withoutComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ---------------------------------------------------------------------------
// The rule.
// ---------------------------------------------------------------------------

test('no route that calls notFound() has a loading.tsx above it', () => {
  const offenders: string[] = [];

  for (const routeFile of routeFiles()) {
    const body = withoutComments(readFileSync(join(APP_DIR, routeFile), 'utf8'));
    if (!body.includes('notFound(')) continue;

    for (const segment of ancestorSegments(routeFile)) {
      const loading = join(APP_DIR, segment, 'loading.tsx');
      if (existsSync(loading)) {
        offenders.push(
          `${routeFile} calls notFound(), but ${join('app', segment, 'loading.tsx').split(sep).join('/')} ` +
            `puts a Suspense boundary above it — the 200 is flushed before the 404 is decided`,
        );
      }
    }
  }

  assert.deepEqual(offenders, [], offenders.join('\n'));
});

test('app/loading.tsx does not exist — a root boundary streams every route', () => {
  // The specific file that caused it. Named explicitly as well as covered by the rule above,
  // because "add a global loading skeleton" is a reasonable-sounding change and this is the
  // sentence that explains why it is not.
  assert.equal(
    existsSync(join(APP_DIR, 'loading.tsx')),
    false,
    'a root loading.tsx makes EVERY route stream, which turns every notFound() into a soft-404',
  );
});

test('the gym route still calls notFound() rather than rendering a panel', () => {
  // The other half. Removing the loading boundary is worthless if the route stops answering 404
  // at all — an "this gym is unavailable" panel served with a 200 is the same soft-404 by hand.
  const route = withoutComments(
    readFileSync(join(APP_DIR, 'gyms/[citySlug]/[gymSlug]/page.tsx'), 'utf8'),
  );
  assert.match(route, /notFound\(\)/, 'the gym route no longer answers 404 for an unknown slug');
});

test('/search does NOT call notFound() — an empty result set is not a missing page', () => {
  // This is what makes `app/search/loading.tsx` safe. A query that matches nothing is a 200 with
  // an empty state; answering 404 there would de-index the search page itself.
  const route = withoutComments(readFileSync(join(APP_DIR, 'search/page.tsx'), 'utf8'));
  assert.ok(
    !route.includes('notFound('),
    '/search calls notFound() — either it should not, or its loading.tsx must go',
  );
});
