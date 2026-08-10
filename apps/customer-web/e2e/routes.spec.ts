/**
 * Every route, loaded, at two widths.
 *
 * The cheapest test in the suite and the one that has caught the most. A page that throws, scrolls
 * sideways, loses its `h1` or fails to load a chunk is broken for everyone, and none of it is
 * visible to a test that reads source.
 *
 * Real defects this shape found while it was still a throwaway script:
 *   - the results page scrolled sideways by 1,400px on every phone, because a grid track resolved
 *     to `min-content` and the filter rail's chip rows set that minimum
 *   - a landing rendered two `h1` elements after a heading was promoted
 *   - the whole client bundle 400d for twenty minutes and the pages still looked correct
 */

import { expect, test } from '@playwright/test';

/** Every route a member can reach, plus the parameterised states worth loading. */
const ROUTES = [
  '/',
  '/?gym=bengaluru%2Firon-house-indiranagar&gym=mumbai%2Fapex-crossfit-powai',
  '/search',
  '/search?city=bengaluru',
  '/search?city=bengaluru&radius=5',
  '/search?category=Strength',
  '/search?q=nothing-matches-this',
  '/compare',
  '/compare?gym=bengaluru%2Firon-house-indiranagar&gym=mumbai%2Fapex-crossfit-powai',
  '/cities',
  '/explore',
  '/explore/strength',
  '/gyms/bengaluru',
  '/gyms/bengaluru/iron-house-indiranagar',
  '/how-it-works',
  '/for-gyms',
  '/for-gyms/signup',
  '/checkout',
  '/checkout/confirmation',
  '/account',
  '/account/memberships',
  '/account/attendance',
  '/account/orders',
  '/account/reviews',
] as const;

for (const route of ROUTES) {
  test(`${route} loads, renders and does not scroll sideways`, async ({ page }) => {
    const problems: string[] = [];
    /*
     * Console errors and page exceptions BOTH. A blocked script logs to the console and never
     * throws; a hydration failure throws and may log nothing. Watching one of the two is how the
     * dead client bundle survived a clean sweep for as long as it did.
     */
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 160)}`);
    });
    page.on('pageerror', (e) => problems.push(`threw: ${String(e.message).slice(0, 160)}`));

    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `${route} did not return 200`).toBe(200);

    // Exactly one `h1`. Zero is a page that renders nothing useful; two is an outline with no top.
    await expect(page.locator('h1'), `${route} must have exactly one h1`).toHaveCount(1);

    /*
     * Real text, not just markup. `text.length` catches the failure mode a status check cannot:
     * a 200 carrying an error boundary, which is what a stale chunk produces.
     */
    const text = ((await page.locator('body').innerText()) || '').trim();
    expect(
      text.length,
      `${route} rendered ${String(text.length)} characters of text`,
    ).toBeGreaterThan(200);

    /*
     * Sideways scroll, and the element that caused it. A page that scrolls horizontally on a phone
     * still looks correct in a screenshot; you only meet it by swiping, which is why it needs a
     * machine to find it.
     */
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const past = doc.scrollWidth - doc.clientWidth;
      if (past <= 0) return { past: 0, culprit: '' };
      let worst = 0;
      let culprit = '';
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        const over = r.right - doc.clientWidth;
        if (over > worst && r.width > 0) {
          worst = over;
          culprit = `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)} +${String(Math.round(over))}px`;
        }
      }
      return { past, culprit };
    });
    expect(overflow.past, `${route} scrolls sideways: ${overflow.culprit}`).toBe(0);

    expect(problems, `${route}\n  ${problems.join('\n  ')}`).toEqual([]);
  });
}
