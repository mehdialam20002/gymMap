/**
 * What a crawler receives, read from the SERVED response.
 *
 * `test/seo.spec.ts` checks the source: that a route declares a canonical, that the sitemap is
 * derived from the catalogue. It cannot check what Next finally emitted after merging a route's
 * metadata with the layout's — and that merge is where this app's SEO defects lived.
 *
 * Found by this shape, on a codebase whose source-level SEO tests were all green:
 *   - `/robots.txt` and `/sitemap.xml` both 404, on a stack chosen for search engines
 *   - `/` with no canonical, while the compare rail makes `/?gym=a&gym=b` a real linkable address
 *   - every one of 28 URLs shipping the home page's `og:title`, because the layout hard-coded it
 *     and the comment above it claimed each page overrode it
 */

import { expect, test } from '@playwright/test';

/** One member's records and a half-finished transaction. Never indexable. */
const isPrivate = (route: string) => route.startsWith('/account') || route.startsWith('/checkout');

const ROUTES = [
  '/',
  '/search',
  '/search?city=bengaluru',
  '/compare',
  '/cities',
  '/explore',
  '/explore/strength',
  '/gyms/bengaluru',
  '/gyms/bengaluru/iron-house-indiranagar',
  '/how-it-works',
  '/for-gyms',
  '/about',
  '/checkout',
  '/account',
  '/account/memberships',
] as const;

test.describe('what a crawler is told', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'One browser is enough for markup');

  test('robots.txt and sitemap.xml are served, and the sitemap has entries', async ({
    request,
  }) => {
    // A crawler asks for robots before anything else. Both of these returned 404 for months.
    const robots = await request.get('/robots.txt');
    expect(robots.status(), 'robots.txt is not served').toBe(200);
    const robotsBody = await robots.text();
    expect(robotsBody).toMatch(/sitemap:/i);

    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status(), 'sitemap.xml is not served').toBe(200);
    const locs = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
    expect(locs.length, 'the sitemap lists nothing').toBeGreaterThan(10);

    /*
     * Absolute, and not on this test's own host. Without `metadataBase` Next resolves every
     * absolute-URL field against localhost, silently, in a production build.
     */
    for (const loc of locs) {
      expect(loc, `${loc} is not an absolute https URL`).toMatch(/^https:\/\//);
      expect(loc, `${loc} points at a local host`).not.toMatch(/localhost|127\.0\.0\.1/);
    }

    // Nothing private, which would contradict those pages' own `noindex`.
    for (const loc of locs) {
      expect(isPrivate(new URL(loc).pathname), `${loc} is private and in the sitemap`).toBe(false);
    }
  });

  test('every indexable page carries a title, a description and a canonical', async ({ page }) => {
    const seen = new Map<string, string[]>();

    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      const meta = await page.evaluate(() => {
        const attr = (sel: string, key: string) =>
          document.querySelector(sel)?.getAttribute(key)?.trim() ?? null;
        return {
          title: document.title.trim(),
          description: attr('meta[name="description"]', 'content'),
          canonical: attr('link[rel="canonical"]', 'href'),
          robots: attr('meta[name="robots"]', 'content'),
          ogTitle: attr('meta[property="og:title"]', 'content'),
          lang: document.documentElement.lang,
        };
      });

      expect(meta.title, `${route} has no title`).toBeTruthy();
      expect(meta.description, `${route} has no description`).toBeTruthy();
      expect(meta.lang, `${route} has no lang on <html>`).toBeTruthy();

      const noindex = (meta.robots ?? '').includes('noindex');
      if (isPrivate(route)) {
        expect(noindex, `${route} is a private record and is indexable`).toBe(true);
        continue;
      }

      /*
       * ┌─ A CANONICAL IS ASKED ONLY OF A PAGE THAT CAN RANK ────────────────────────────────────┐
       * │ This spec's first run failed on `/compare`, and the spec was wrong rather than the page. │
       * │ `/compare` is `noindex, follow` on purpose - it is thin without parameters and unbounded │
       * │ with them - and on a `noindex` page a canonical is at best inert and at worst a          │
       * │ contradiction: "do not index this, and by the way here is the URL I prefer".             │
       * │                                                                                         │
       * │ The throwaway probe this spec was built from had exactly this bug and it was fixed       │
       * │ there. Rewriting it as a permanent test reintroduced it, which is its own small lesson:  │
       * │ the reasoning has to move with the code, so it is written down here this time.           │
       * └─────────────────────────────────────────────────────────────────────────────────────────┘
       */
      if (noindex) continue;

      expect(meta.canonical, `${route} has no canonical`).toBeTruthy();

      /*
       * Open Graph must be the PAGE's, not the layout's. This is the exact defect that shipped:
       * every route inherited the home page's `og:title`, so a gym link shared to a chat previewed
       * the front door. Comparing it to the page's own title is what catches a constant.
       */
      expect(meta.ogTitle, `${route} has no og:title`).toBeTruthy();
      expect(meta.ogTitle, `${route} shows another page's og:title`).toBe(meta.title);
      const key = `${meta.title}||${meta.canonical ?? ''}`;
      seen.set(key, [...(seen.get(key) ?? []), route]);
    }

    /*
     * Two indexable pages may share a title ONLY if they share a canonical, which is the signal
     * that they are one page wearing two addresses. Different canonicals means they compete, and a
     * search engine picks one.
     */
    for (const [key, routes] of seen) {
      if (routes.length < 2) continue;
      const [title] = key.split('||');
      expect(
        routes.length,
        `${String(routes.length)} pages share "${String(title)}" with different canonicals: ${routes.join(', ')}`,
      ).toBe(routes.length);
    }
    const byTitle = new Map<string, Set<string>>();
    for (const [key, routes] of seen) {
      const [title, canonical] = key.split('||');
      const set = byTitle.get(String(title)) ?? new Set<string>();
      set.add(String(canonical));
      byTitle.set(String(title), set);
      void routes;
    }
    for (const [title, canonicals] of byTitle) {
      expect(
        canonicals.size,
        `"${title}" is used by ${String(canonicals.size)} different canonicals`,
      ).toBe(1);
    }
  });
});
