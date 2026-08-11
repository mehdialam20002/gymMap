/**
 * Does a control answer for its own surface?
 *
 * ┌─ THE DEFECT THIS EXISTS FOR ─────────────────────────────────────────────────────────────────┐
 * │ `getBoundingClientRect` says where a button IS. It does not say whether a click there reaches │
 * │ it. On this site's home page, 44% of the amber Search submit and 27% of its query input       │
 * │ hit-tested to the decorative constellation behind them, at 1200, 1280, 1440 and 1600 alike.   │
 * │ The primary call to action of the page navigated to "Boxing" for nearly half its surface, and │
 * │ looked like it had worked.                                                                    │
 * │                                                                                              │
 * │ Nothing caught it. It is invisible to a screenshot, invisible to a unit test, and invisible   │
 * │ to a click test that clicks the CENTRE - which is the one point that still worked.             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * So this hit-tests a GRID over each control and asks what answers. The same method proved the
 * card's stretched link works and that its badges no longer swallow the click.
 */

import { expect, test } from '@playwright/test';

/** What share of an element's own box resolves to something else, and what that something is. */
async function stolen(page: import('@playwright/test').Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { missing: true, pct: 0, thieves: [] as string[] };
    const r = el.getBoundingClientRect();
    let total = 0;
    let taken = 0;
    const thieves = new Map<string, number>();
    for (let i = 0; i < 9; i += 1) {
      for (let j = 0; j < 5; j += 1) {
        const x = r.left + 1 + ((r.width - 2) * i) / 8;
        const y = r.top + 1 + ((r.height - 2) * j) / 4;
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
        total += 1;
        const top = document.elementFromPoint(x, y);
        if (!top || top === el || el.contains(top) || top.contains(el)) continue;
        // A label or icon inside the same field wrapper is not a thief.
        const field = el.closest('.gm-field, form');
        if (field?.contains(top) && !top.closest('.gm-orbit')) continue;
        taken += 1;
        const cls = String(top.className || '')
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .join('.');
        const key = `${top.tagName.toLowerCase()}${cls ? '.' + cls : ''}`;
        thieves.set(key, (thieves.get(key) ?? 0) + 1);
      }
    }
    return {
      missing: false,
      pct: total === 0 ? 0 : Math.round((taken / total) * 100),
      thieves: [...thieves.entries()].map(([k, v]) => `${k} x${String(v)}`),
    };
  }, selector);
}

test.describe('a control owns its own surface', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Hit-testing is engine-independent');

  /*
   * Widths matter and one is not enough. The constellation is a `clamp()` and the console is a
   * `max-width`, so the overlap moved with the viewport - it was absent at 1240 and 340px wide at
   * 1920, and a single-width test would have picked the wrong one.
   */
  for (const width of [1181, 1280, 1440, 1920]) {
    test(`the hero's search controls are not overlapped at ${String(width)}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      for (const sel of ['#q', '#city', '#radius', '.gm-console button[type=submit]']) {
        const result = await stolen(page, sel);
        expect(result.missing, `${sel} is not on the page`).toBe(false);
        expect(
          result.pct,
          `${String(width)}px: ${result.pct}% of ${sel} hit-tests to ${result.thieves.join(', ')}`,
        ).toBe(0);
      }
    });
  }

  test('the whole gym card opens the gym, and its own control still does not', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/gyms/mumbai', { waitUntil: 'domcontentloaded' });

    const reach = await page.evaluate(() => {
      const card = document.querySelector('li.gm-card-interactive');
      if (!card) return { missing: true, gym: 0, compare: 0, dead: 0, href: '' };
      const r = card.getBoundingClientRect();
      const href = card.querySelector('.gm-card-link')?.getAttribute('href') ?? '';
      let gym = 0;
      let compare = 0;
      let dead = 0;
      for (let i = 0; i < 11; i += 1) {
        for (let j = 0; j < 11; j += 1) {
          const x = r.left + 2 + ((r.width - 4) * i) / 10;
          const y = r.top + 2 + ((r.height - 4) * j) / 10;
          if (y < 0 || y > innerHeight) continue;
          const a = document.elementFromPoint(x, y)?.closest('a');
          if (!a) dead += 1;
          else if (a.getAttribute('href') === href) gym += 1;
          else compare += 1;
        }
      }
      return { missing: false, gym, compare, dead, href };
    });

    expect(reach.missing, 'no gym card on the page').toBe(false);
    expect(reach.href, 'the card has no link to the gym').toMatch(/^\/gyms\//);
    /*
     * Most of the card opens the gym, and SOME of it opens the comparison - both matter. A card
     * that is entirely one link has swallowed its own compare control, which is the failure the
     * stretched-link pattern creates if the control does not claim the layer above it.
     */
    expect(reach.gym, 'the card body does not open the gym').toBeGreaterThan(reach.compare * 3);
    expect(
      reach.compare,
      'the compare control has been swallowed by the card link',
    ).toBeGreaterThan(0);
    // Whatever reaches nothing must be the gap between cards, not the card itself.
    expect(reach.dead, 'part of the card reaches no link at all').toBeLessThan(20);
  });

  /*
   * ┌─ A LABEL AND ITS VALUE ON THE SAME LEFT EDGE ───────────────────────────────────────────────┐
   * │ Reported as "the text does not look right when you type", and it was two numbers that had   │
   * │ no reason to agree: the label was absolutely positioned at the FIELD's padding edge while   │
   * │ the control began after the glyph and the gap, 25px further in. Empty, the field looked      │
   * │ fine; typed, a real word appeared indented from its own heading.                             │
   * │                                                                                              │
   * │ Both edges are now one grid column, so this cannot drift - which is exactly why it is worth  │
   * │ a test: the next person to reach for `position: absolute` on that label finds out here.      │
   * └──────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  test('every console field puts its label directly above the value it names', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Typed and chosen, because the empty state is the one where the defect was invisible.
    await page.fill('#q', 'iron house');
    await page.selectOption('#city', 'bengaluru');

    const fields = await page.evaluate(() =>
      [...document.querySelectorAll('.gm-field')].map((field) => {
        const label = field.querySelector('label');
        const control = field.querySelector('input, select');
        if (!label || !control) return { id: '(incomplete field)', drift: 999, gap: 0 };
        const l = label.getBoundingClientRect();
        const c = control.getBoundingClientRect();
        return {
          id: control.id,
          drift: Math.round(Math.abs(l.left - c.left)),
          // Positive, or the value is painted over its own label.
          gap: Math.round(c.top - l.bottom),
        };
      }),
    );

    expect(fields.length, 'the hero has no search fields').toBeGreaterThan(2);
    for (const f of fields) {
      expect(f.drift, `${f.id}: label and value are ${String(f.drift)}px apart`).toBe(0);
      expect(f.gap, `${f.id}: the value overlaps its label`).toBeGreaterThan(0);
    }
  });

  /*
   * ┌─ A DECORATIVE FILL STAYS INSIDE THE SHAPE OF THE CONTROL IT DECORATES ──────────────────────┐
   * │ Reported from a deployed build, and it was a change made HERE that caused it. `.gm-btn`     │
   * │ paints its hover state with an absolutely positioned `::before` at `inset: 0`. That sheet   │
   * │ used to be parked below the button and hidden by `overflow: hidden` - and when the clip was │
   * │ removed (it was cutting the label by 3px at 200% text) only ONE of its two jobs was          │
   * │ replaced. The other job was giving the rectangle the button's `border-radius: 9999px`.       │
   * │                                                                                             │
   * │ So on hover a square-cornered sheet painted behind a pill, and a dark rectangle poked out of │
   * │ all four corners of every call to action on the site, in both themes. Nothing here caught    │
   * │ it: the geometry is identical, the contrast is identical, no console error, and a screenshot │
   * │ test would only have caught it if somebody had taken one while hovering.                     │
   * │                                                                                             │
   * │ The invariant is checkable without pixels. A pseudo-element that REACHES its host's edges    │
   * │ and PAINTS something must either carry the host's corner radius or be clipped by the host.   │
   * │ Anything else can only be a rectangle behind a rounded thing.                                │
   * └─────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  test('no painted fill can escape the corners of the control it sits in', async ({ page }) => {
    const ROUTES = [
      '/',
      '/search?city=bengaluru',
      '/gyms/bengaluru',
      '/gyms/bengaluru/iron-house-indiranagar',
      '/for-gyms',
      '/compare?gym=bengaluru%2Firon-house-indiranagar&gym=mumbai%2Fapex-crossfit-powai',
      '/cities',
      '/checkout',
    ];
    const failures: string[] = [];
    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const found = await page.evaluate(() => {
        const out: string[] = [];
        const px = (v: string) => Number.parseFloat(v) || 0;
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el);
          const hostRadius = px(cs.borderTopLeftRadius);
          // A square host has no corner for anything to escape from.
          if (hostRadius < 2) continue;
          // A host that clips already forces the pseudo into its own shape.
          if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') continue;
          for (const which of ['::before', '::after']) {
            const ps = getComputedStyle(el, which);
            if (ps.content === 'none' || ps.content === '') continue;
            if (ps.position !== 'absolute' && ps.position !== 'fixed') continue;
            // Only a pseudo that reaches the edges can paint over a corner.
            const reaches =
              px(ps.top) <= 0 && px(ps.left) <= 0 && px(ps.right) <= 0 && px(ps.bottom) <= 0;
            if (!reaches) continue;
            const paints =
              ps.backgroundColor !== 'rgba(0, 0, 0, 0)' || ps.backgroundImage !== 'none';
            if (!paints) continue;
            if (px(ps.borderTopLeftRadius) >= hostRadius - 0.5) continue;
            out.push(
              `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)}${which} host r=${String(Math.round(hostRadius))} pseudo r=${String(Math.round(px(ps.borderTopLeftRadius)))}`,
            );
          }
        }
        return [...new Set(out)];
      });
      for (const f of found) failures.push(`${route}: ${f}`);
    }
    expect(failures, `a fill can paint outside its control:\n  ${failures.join('\n  ')}`).toEqual(
      [],
    );
  });

  /*
   * The open list must not cover the field it belongs to.
   *
   * `::picker(select)` anchors to the `<select>`, and the select here is the value row alone - so
   * the default placement cleared the control by a correct 8px and sat on top of the label above
   * it. Anchoring to the pill fixed it; this pins the pill as the anchor.
   *
   * Skipped where the engine has no customizable select: there the list is drawn by the OS, has no
   * geometry in the page, and there is nothing to assert. That is a real difference between
   * browsers, not a failure, and the fallback is checked by `a11y.spec.ts` like any other control.
   */
  test('an open city list clears the field it belongs to', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const inPage = await page.evaluate(() => CSS.supports('appearance', 'base-select'));
    test.skip(!inPage, 'this engine draws the list outside the page');

    for (const id of ['city', 'radius']) {
      await page.click(`#${id}`);
      const geometry = await page.evaluate((sel) => {
        const select = document.querySelector(sel);
        const field = select?.closest('.gm-field');
        if (!select || !field) return null;
        const rows = [...select.querySelectorAll('option')].map((o) => o.getBoundingClientRect());
        if (!rows.length || rows[0]!.height === 0) return null;
        const f = field.getBoundingClientRect();
        const top = Math.min(...rows.map((r) => r.top));
        const bottom = Math.max(...rows.map((r) => r.bottom));
        return {
          overlaps: !(bottom <= f.top || top >= f.bottom),
          // The list belongs to THIS field: its left edge is the field's, not another one's.
          anchoredHere: Math.abs(rows[0]!.left - f.left) < 24,
          shortestRow: Math.round(Math.min(...rows.map((r) => r.height))),
        };
      }, `#${id}`);

      expect(geometry, `#${id} opened no in-page list`).not.toBeNull();
      expect(geometry?.overlaps, `#${id}'s open list covers its own field`).toBe(false);
      expect(geometry?.anchoredHere, `#${id}'s list is anchored to a different field`).toBe(true);
      // `AX3`. A row in a list is a touch target like any other.
      expect(geometry?.shortestRow, `#${id}'s rows are under 44px`).toBeGreaterThanOrEqual(44);
      await page.keyboard.press('Escape');
    }
  });
});
