/**
 * 320 → 2560, and the two zoom levels nobody was testing — `NFR-USE-07`, `AX5`, `BP1`–`BP5`.
 *
 * ┌─ WHY THE ROUTE SWEEP IN `routes.spec.ts` WAS NOT ENOUGH ────────────────────────────────────┐
 * │ That spec checks two viewports at 100% text and asks one question: does the document scroll │
 * │ sideways. It passed on a build where:                                                       │
 * │                                                                                             │
 * │   `/compare` showed ZERO gym data at rest on every phone, because a pinned label column      │
 * │       with no declared width absorbed 384 of the 284 available pixels                        │
 * │   the "Open menu" button — the only navigation on a narrow layout — began 30px PAST the      │
 * │       right edge at 200% browser text, with `overflow-x: hidden` guaranteeing no scrollbar   │
 * │       and no pan, so it was simply gone                                                      │
 * │   the gym gallery hid its fourth photo behind a scroller with no scrollbar, no gradient and  │
 * │       zero focusable descendants                                                             │
 * │   77% of the text on the home page did not change size at 200% zoom at all                   │
 * │                                                                                             │
 * │ Every one of those is invisible to "does the page scroll sideways at 1440 and 360". They    │
 * │ are visible to the checks below, which is the whole argument for this file existing.         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * These run on the `desktop` project only and set their own viewport, because a matrix of widths
 * is the point and the project's viewport would just be overwritten.
 */

import { expect, test } from '@playwright/test';

/**
 * Widths that matter, and why each one is here rather than a round number.
 *
 * 320 is the floor `NFR-USE-07` names. 360 is an entry Android. 390 is a current iPhone. 414 is
 * the large-phone class. 768 and 834 straddle `md` and iPad portrait. 1024 and 1280 are the two
 * breakpoints most layout changes hang off. 1366 is the commonest laptop panel in the world.
 * 2560 is where a layout with no measure stops being readable.
 */
const WIDTHS = [320, 360, 390, 414, 768, 834, 1024, 1280, 1366, 1920, 2560] as const;

const ROUTES = [
  '/',
  '/search?city=bengaluru',
  '/compare?gym=bengaluru%2Firon-house-indiranagar&gym=mumbai%2Fapex-crossfit-powai',
  '/cities',
  '/gyms/bengaluru',
  '/gyms/bengaluru/iron-house-indiranagar',
  '/how-it-works',
  '/for-gyms',
  '/checkout',
  '/account/memberships',
] as const;

/**
 * The furthest-right edge in the document, and what owns it.
 *
 * `documentElement.scrollWidth` alone is not enough: `body { overflow-x: hidden }` at
 * `globals.css` hides the symptom and reports a clean 0 while an element still sits past the
 * edge — which is exactly the state the header's menu button was in at 200% text. So the tree is
 * walked as well, and the two disagreeing IS the finding.
 */
async function overhang(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    /*
     * Three decorative boxes are clipped on purpose and are excluded by name rather than by a
     * blanket rule, so a fourth one appearing is a failure and not a silent exemption.
     */
    const DELIBERATE = ['gm-plate-2', 'gm-plate-3', 'gm-marquee-track'];
    let worst = 0;
    let culprit = '';
    let leftmost = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (DELIBERATE.some((c) => el.classList.contains(c))) continue;
      if (el.closest('[aria-hidden="true"]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      /*
       * ┌─ CONTENT INSIDE ITS OWN SCROLLER IS NOT PAGE OVERFLOW ────────────────────────────────┐
       * │ `BP2` asks wide content to scroll INSIDE its own container, so a compare table 122px   │
       * │ wider than a 320px phone is the rule working, not breaking. Without this walk the       │
       * │ measurement reports the facet chip row at "+1987px past the edge" and every real        │
       * │ finding drowns in it.                                                                   │
       * │                                                                                        │
       * │ The walk stops BEFORE `body`. `body` carries `overflow-x: hidden`, which makes it a     │
       * │ scroll container too - and treating that as a legitimate clip is exactly how a          │
       * │ measurement comes back clean on a page whose only navigation control is off the screen. │
       * │ Body's clip is the thing that HIDES this class of defect, so it is never an excuse.     │
       * └────────────────────────────────────────────────────────────────────────────────────────┘
       */
      let inScroller = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (['auto', 'scroll', 'hidden', 'clip'].includes(cs.overflowX)) {
          inScroller = true;
          break;
        }
      }
      if (inScroller) continue;
      const past = Math.round(r.right - doc.clientWidth);
      if (past > worst) {
        worst = past;
        culprit = `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 44)}`;
      }
      leftmost = Math.min(leftmost, Math.round(r.left));
    }
    return { scroll: doc.scrollWidth - doc.clientWidth, worst, culprit, leftmost };
  });
}

test.describe('the page holds from 320 to 2560', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Layout is engine-independent here');

  for (const width of WIDTHS) {
    test(`nothing overflows sideways at ${String(width)}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 500 ? 780 : 900 });
      const failures: string[] = [];
      for (const route of ROUTES) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        const o = await overhang(page);
        /*
         * The ELEMENT walk, not `documentElement.scrollWidth`. That number counts absolutely
         * positioned pseudo-elements parked outside their own box on purpose - a hit target's
         * `::after`, a button's rising fill - and reported a phantom 2px on every route at every
         * width under 768 that no reader could see, scroll to, or be harmed by. One pixel of
         * slack for sub-pixel rounding on fractional layouts.
         */
        if (o.worst > 1)
          failures.push(`${route}: ${o.culprit} sits ${String(o.worst)}px past the edge`);
        if (o.leftmost < -1) failures.push(`${route}: something starts at x=${String(o.leftmost)}`);
      }
      expect(failures, `at ${String(width)}px\n  ${failures.join('\n  ')}`).toEqual([]);
    });
  }
});

/*
 * ┌─ 200% TEXT, WHICH IS A DIFFERENT TEST FROM 200% ZOOM ───────────────────────────────────────┐
 * │ Page zoom scales everything, so a px-sized layout survives it looking identical. Raising the │
 * │ browser's default FONT size scales only what is expressed in relative units - which is the   │
 * │ point of `WCAG 1.4.4` and the reason 56 of 57 `font-size` declarations being literal px was  │
 * │ a defect rather than a style. Measured before the fix: 320 of 416 text-bearing elements on   │
 * │ `/` did not change size at all.                                                              │
 * │                                                                                              │
 * │ The two halves are checked together on purpose. Fixing the fonts alone would have clipped    │
 * │ `.gm-btn` by 25px inside a fixed 44px box, silently, because `overflow: hidden` clips the    │
 * │ rising fill - so "the text grew" and "the box grew with it" have to be one assertion.        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
test.describe('text scales to 200% without losing content or function', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Needs CDP font settings');

  for (const width of [320, 390, 768, 1280]) {
    test(`at ${String(width)}px with a 32px root font`, async ({ page }) => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 32 } });
      await page.setViewportSize({ width, height: width < 500 ? 780 : 900 });

      const failures: string[] = [];
      for (const route of ['/', '/search?city=bengaluru', '/for-gyms']) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });

        const o = await overhang(page);
        if (o.worst > 1) {
          failures.push(`${route}: ${o.culprit} is ${String(o.worst)}px past the edge`);
        }

        /*
         * A control on the page but outside the viewport, with NOTHING able to bring it back, is
         * gone. That is the exact shape of the header defect: the menu button existed, had a box,
         * and began 30px past an edge the page refuses to scroll past.
         *
         * "Nothing able to bring it back" is the load-bearing half. A facet chip scrolled out of
         * its own row is reached by scrolling, and by Tab, which scrolls it into view - so an
         * unguarded version of this check reported 81 perfectly reachable controls as lost.
         */
        const unreachable = await page.evaluate(() => {
          const out: string[] = [];
          for (const el of document.querySelectorAll('a[href], button:not([disabled])')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (r.left < innerWidth && r.right > 0) continue;
            let rescuable = false;
            for (let a = el.parentElement; a; a = a.parentElement) {
              const cs = getComputedStyle(a);
              const scrollsX =
                ['auto', 'scroll'].includes(cs.overflowX) && a.scrollWidth > a.clientWidth;
              const scrollsY =
                ['auto', 'scroll'].includes(cs.overflowY) && a.scrollHeight > a.clientHeight;
              if (scrollsX || scrollsY) {
                rescuable = true;
                break;
              }
            }
            if (rescuable) continue;
            const name =
              (el as HTMLElement).innerText?.trim() || el.getAttribute('aria-label') || el.tagName;
            out.push(`${name.slice(0, 30)} at x=${String(Math.round(r.left))}`);
          }
          return out;
        });
        for (const u of unreachable) failures.push(`${route}: unreachable control ${u}`);

        /*
         * ┌─ DOES A READER LOSE A GLYPH? MEASURED FROM THE PAINTED TEXT ──────────────────────────┐
         * │ The obvious test is `scrollHeight > clientHeight` on anything that clips, and it is    │
         * │ wrong in two directions at once. It counts the 1px `sr-only` boxes whose entire job is │
         * │ to clip, and it counts a button's rising-fill `::before` - an absolutely positioned    │
         * │ sheet parked outside the box on purpose - as 63px of lost text on every button on the  │
         * │ site. Both were reported, both were the mechanism working.                             │
         * │                                                                                       │
         * │ A `Range` over the element's own text nodes measures what is actually painted, so the  │
         * │ only thing it can report is a glyph a reader cannot see.                                │
         * └───────────────────────────────────────────────────────────────────────────────────────┘
         */
        const cut = await page.evaluate(() => {
          const out: string[] = [];
          for (const el of document.querySelectorAll('body *')) {
            const cs = getComputedStyle(el);
            const clips =
              ['hidden', 'clip', 'auto', 'scroll'].includes(cs.overflowY) ||
              ['hidden', 'clip'].includes(cs.overflowX);
            if (!clips) continue;
            if (el.clientWidth <= 1 || el.clientHeight <= 1) continue;
            if (cs.clipPath !== 'none') continue;
            const box = el.getBoundingClientRect();
            for (const n of el.childNodes) {
              if (n.nodeType !== 3 || !n.textContent?.trim()) continue;
              const range = document.createRange();
              range.selectNodeContents(n);
              let lost = 0;
              for (const t of range.getClientRects()) {
                lost = Math.max(
                  lost,
                  t.bottom - box.bottom,
                  box.top - t.top,
                  t.right - box.right,
                  box.left - t.left,
                );
              }
              if (lost > 1) {
                out.push(
                  `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 28)} loses ${String(Math.round(lost))}px of "${n.textContent.trim().slice(0, 20)}"`,
                );
                break;
              }
            }
          }
          return [...new Set(out)].slice(0, 6);
        });
        for (const c of cut) failures.push(`${route}: ${c}`);
      }
      expect(failures, `32px root at ${String(width)}px\n  ${failures.join('\n  ')}`).toEqual([]);
    });
  }
});

/*
 * `TS2` — 16px is a floor on form controls, on every surface, because below it iOS Safari zooms
 * the viewport on focus and does not zoom back out. That leaves the reader on a horizontally
 * scrolled page they have to pinch out of, which is the very thing `NFR-USE-07` forbids. It is a
 * bug fix expressed as a token, so it is asserted as one.
 */
test('@a11y every form control is at least 16px, at every width', async ({ page }) => {
  const failures: string[] = [];
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/search?city=bengaluru', '/for-gyms/signup', '/checkout']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const small = await page.evaluate(() =>
        [...document.querySelectorAll('input:not([type=hidden]), select, textarea')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          })
          .map((el) => ({ id: el.id || el.tagName, px: parseFloat(getComputedStyle(el).fontSize) }))
          .filter((x) => x.px < 16),
      );
      for (const s of small) {
        failures.push(`${route} @${String(width)}: ${s.id} is ${String(s.px)}px`);
      }
    }
  }
  expect(failures, failures.join('\n  ')).toEqual([]);
});

/*
 * ┌─ `BP4`, READ FROM THE SERVED STYLESHEET ───────────────────────────────────────────────────┐
 * │ "Breakpoints are the only permitted media-query widths in `apps/**`." A grep over the source │
 * │ would be easier and would miss the thing that matters: what a browser actually parsed after  │
 * │ the build. This reads `document.styleSheets`, so a width introduced by a Tailwind arbitrary  │
 * │ variant in TSX is caught by the same assertion as one written in the stylesheet by hand.     │
 * │                                                                                              │
 * │ The set is the token scale. 760, 1080 and 1180 - the three this codebase actually shipped -  │
 * │ are not in it, and they produced a compare-rail chip label that got SHORTER as the screen    │
 * │ got wider: 102px at 480, 52px at 768.                                                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
test('every media-query width in the served CSS is a breakpoint token', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const offenders = await page.evaluate(() => {
    const ALLOWED = new Set([320, 640, 768, 1024, 1280, 1536, 1920]);
    const bad: string[] = [];
    const walk = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (rule instanceof CSSMediaRule) {
          for (const m of rule.conditionText.matchAll(/(min|max)-width:\s*([\d.]+)px/g)) {
            const px = Number(m[2]);
            // `max-width` is banned outright: `BP1` is mobile-first, so a ceiling is the wrong
            // direction whatever number it carries.
            if (m[1] === 'max') bad.push(`max-width: ${String(px)}px (${rule.conditionText})`);
            else if (!ALLOWED.has(px))
              bad.push(`min-width: ${String(px)}px (${rule.conditionText})`);
          }
        }
        if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        walk(sheet.cssRules);
      } catch {
        // A cross-origin sheet cannot be read. There are none here; the guard is for the day
        // somebody adds one, so this test fails loudly rather than silently covering less.
        bad.push('a stylesheet could not be read');
      }
    }
    return [...new Set(bad)];
  });
  expect(offenders, `off-ladder media queries:\n  ${offenders.join('\n  ')}`).toEqual([]);
});

/*
 * `AX2` — the skip link's target must not land behind the sticky header. There was no
 * `scroll-margin-top` or `scroll-padding-top` anywhere in the app or in `packages/ui`, so `#main`
 * arrived 61px behind 92px of chrome: the one control a keyboard user has for getting past the
 * header delivered them behind it.
 */
test('@a11y an in-page anchor clears the sticky header', async ({ page }) => {
  const failures: string[] = [];
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const covered = await page.evaluate(() => {
      const main = document.querySelector('#main');
      if (!main) return { missing: true, covered: 0 };
      main.scrollIntoView();
      const heading = main.querySelector('h1, h2, h3') ?? main;
      const top = heading.getBoundingClientRect().top;
      // What is actually painted over that point, rather than what we assume the header is.
      const chrome = [...document.querySelectorAll('header, .gm-app-chrome')]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.height > 0 && r.top < 4)
        .reduce((acc, r) => Math.max(acc, r.bottom), 0);
      return { missing: false, covered: Math.round(chrome - top) };
    });
    if (covered.missing) failures.push(`${String(width)}: no #main to scroll to`);
    else if (covered.covered > 0) {
      failures.push(`${String(width)}: #main lands ${String(covered.covered)}px behind the header`);
    }
  }
  expect(failures, failures.join('\n  ')).toEqual([]);
});

/*
 * The compare rail is `position: fixed`, so nothing downstream can measure it — the document is
 * TOLD how much room to leave. `96px` was reserved against a rail measuring 158, which left two
 * footer lines sitting 36px inside it at maximum scroll with nothing left to scroll. The number
 * is now one custom property read in three places; this asserts the property is still true.
 */
test('the compare rail never covers the end of the document', async ({ page }) => {
  const failures: string[] = [];
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 500 ? 568 : 900 });
    await page.goto('/?gym=bengaluru%2Firon-house-indiranagar&gym=mumbai%2Fapex-crossfit-powai', {
      waitUntil: 'domcontentloaded',
    });
    const result = await page.evaluate(async () => {
      const rail = document.querySelector('.gm-rail');
      if (!rail) return { missing: true, overlap: 0, reserved: 0, real: 0 };
      scrollTo(0, document.body.scrollHeight);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const railTop = rail.getBoundingClientRect().top;
      let overlap = 0;
      let worst = '';
      for (const el of document.querySelectorAll('footer *')) {
        const r = el.getBoundingClientRect();
        if (r.height === 0 || !(el as HTMLElement).innerText?.trim()) continue;
        const into = Math.round(r.bottom - railTop);
        if (into > overlap) {
          overlap = into;
          worst = (el as HTMLElement).innerText.trim().slice(0, 30);
        }
      }
      return {
        missing: false,
        overlap,
        worst,
        reserved: Math.round(parseFloat(getComputedStyle(document.body).paddingBottom)),
        real: Math.round(rail.getBoundingClientRect().height),
      };
    });
    if (result.missing) {
      failures.push(`${String(width)}: the rail did not render for a two-gym selection`);
      continue;
    }
    if (result.overlap > 0) {
      failures.push(
        `${String(width)}: "${String(result.worst)}" sits ${String(result.overlap)}px inside the rail at max scroll`,
      );
    }
    // The reservation must cover the rail, not approximate it.
    if (result.reserved < result.real) {
      failures.push(
        `${String(width)}: body reserves ${String(result.reserved)}px for a ${String(result.real)}px rail`,
      );
    }
  }
  expect(failures, failures.join('\n  ')).toEqual([]);
});

/*
 * A scroller that hides content must be reachable and must say so. The gallery had ZERO focusable
 * descendants, no tab stop of its own, no role and no name, so its fourth photo could not be
 * reached by a keyboard at all — and with `scrollbar-width: none` and no gradient, nothing on
 * screen admitted the row continued.
 */
test('@a11y every horizontal scroller is reachable and named', async ({ page }) => {
  const failures: string[] = [];
  for (const [route, width] of [
    ['/gyms/bengaluru/iron-house-indiranagar', 390],
    ['/compare?gym=bengaluru%2Firon-house-indiranagar&gym=mumbai%2Fapex-crossfit-powai', 390],
  ] as const) {
    await page.setViewportSize({ width, height: 780 });
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    const bad = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') continue;
        if (el.scrollWidth - el.clientWidth < 8) continue;
        const focusable = el.querySelector('a[href], button, input, select, textarea, [tabindex]');
        const named = el.getAttribute('aria-label') ?? el.getAttribute('aria-labelledby');
        const reachable = el.hasAttribute('tabindex') || focusable !== null;
        if (!reachable) {
          out.push(
            `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)} hides ${String(
              el.scrollWidth - el.clientWidth,
            )}px and has no tab stop`,
          );
        }
        if (el.hasAttribute('tabindex') && !named) {
          out.push(
            `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)} is focusable and unnamed`,
          );
        }
      }
      return out;
    });
    for (const b of bad) failures.push(`${route}: ${b}`);
  }
  expect(failures, failures.join('\n  ')).toEqual([]);
});
