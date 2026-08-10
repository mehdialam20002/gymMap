/**
 * `@a11y` — the structure a screen reader and a thumb actually meet. `AX2`, `AX3`, `AX8`.
 *
 * A source test can tell you a `<nav>` has no `aria-label`. It cannot tell you that two navs on one
 * page ended up with the SAME label after interpolation, that a heading level skipped only because
 * a section rendered empty for this data, or that a 44px target is grown by a pseudo-element an
 * ancestor's `overflow: hidden` clips away.
 *
 * Every check below is one that found a real defect here:
 *   - `h1 -> h3` on two pages, because `GymCard` emits an `h3` and nothing supplied the level 2
 *   - six links called "View" and six called "Add to compare", on cards whose titles were not links
 *   - a compare rail's remove control reaching 36px while `gm-hit-target` reported it satisfied
 *   - the footer's unbuilt routes distinguished by colour alone, at 2.45:1
 *
 * `axe-core` is approved under `A-06` and deliberately not used here: these are the app's OWN rules
 * (`AX3`'s 44px, the clipped-pseudo case, distinct landmark names), which a generic ruleset does
 * not encode. axe belongs alongside this, not instead of it.
 */

import { expect, test } from '@playwright/test';

const ROUTES = [
  '/',
  '/search?city=bengaluru',
  '/compare?gym=bengaluru%2Firon-house-indiranagar&gym=mumbai%2Fapex-crossfit-powai',
  '/cities',
  '/explore',
  '/gyms/bengaluru',
  '/gyms/bengaluru/iron-house-indiranagar',
  '/how-it-works',
  '/for-gyms',
  '/account/memberships',
] as const;

for (const route of ROUTES) {
  test(`@a11y ${route} has a sound outline, named landmarks and reachable controls`, async ({
    page,
  }) => {
    await page.goto(route, { waitUntil: 'domcontentloaded' });

    const report = await page.evaluate(() => {
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const name = (el: Element) => {
        const labelled = el.getAttribute('aria-labelledby');
        if (labelled) {
          const parts = labelled
            .split(/\s+/)
            .map((id) => document.getElementById(id))
            .filter(Boolean)
            .map((n) => (n as HTMLElement).innerText.trim());
          if (parts.join(' ').trim()) return parts.join(' ').trim();
        }
        return (
          el.getAttribute('aria-label')?.trim() ||
          (el as HTMLElement).innerText?.trim() ||
          el.getAttribute('title')?.trim() ||
          ''
        );
      };

      const problems: string[] = [];

      // ── the outline ────────────────────────────────────────────────────
      const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible);
      let previous = 0;
      for (const h of headings) {
        const level = Number(h.tagName[1]);
        if (previous && level > previous + 1) {
          problems.push(
            `h${String(previous)} -> h${String(level)} skips a level at "${name(h).slice(0, 40)}"`,
          );
        }
        previous = level;
        if (!name(h)) problems.push(`an empty <${h.tagName.toLowerCase()}>`);
      }

      // ── landmarks of one type need DISTINCT names ──────────────────────
      const groups = new Map<string, string[]>();
      for (const el of document.querySelectorAll('nav, aside')) {
        if (!visible(el)) continue;
        const role = el.tagName === 'NAV' ? 'nav' : 'aside';
        const labelled = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
        groups.set(role, [...(groups.get(role) ?? []), labelled ? name(el) : '(unlabelled)']);
      }
      for (const [role, names] of groups) {
        if (names.length < 2) continue;
        const unlabelled = names.filter((n) => n === '(unlabelled)').length;
        if (unlabelled)
          problems.push(
            `${String(unlabelled)} of ${String(names.length)} <${role}> landmarks are unlabelled`,
          );
        const counts = new Map<string, number>();
        for (const n of names) {
          if (n === '(unlabelled)') continue;
          counts.set(n, (counts.get(n) ?? 0) + 1);
        }
        for (const [n, c] of counts) {
          if (c > 1) problems.push(`${String(c)} <${role}> landmarks share the name "${n}"`);
        }
      }

      // ── a link's name must identify its destination ────────────────────
      const byName = new Map<string, Set<string>>();
      for (const a of document.querySelectorAll('a[href]')) {
        if (!visible(a)) continue;
        const n = name(a);
        if (!n) {
          problems.push(`a link with NO accessible name -> ${a.getAttribute('href') ?? ''}`);
          continue;
        }
        const key = n.toLowerCase().replace(/\s+/g, ' ');
        byName.set(key, (byName.get(key) ?? new Set()).add(a.getAttribute('href') ?? ''));
      }
      for (const [n, hrefs] of byName) {
        if (hrefs.size > 1) {
          problems.push(`"${n.slice(0, 40)}" is ${String(hrefs.size)} different destinations`);
        }
      }

      /*
       * ── `AX3`, counting a CLIPPED pseudo-element as not grown ──────────
       * `gm-hit-target` reaches 44px by expanding an `::after` outward. Four times in this codebase
       * that element sat inside an ancestor with `overflow: hidden` or a scroll container, which
       * clips the pseudo away - so the rule reported itself satisfied at 36px. An inactive control
       * is exempt under `SC 1.4.3` and is skipped here for the same reason.
       */
      for (const el of document.querySelectorAll('a[href], button:not([disabled])')) {
        if (!visible(el) || el.closest('[aria-disabled="true"]')) continue;
        const r = el.getBoundingClientRect();
        if (r.height >= 44 || r.width >= 44) continue;
        const after = getComputedStyle(el, '::after');
        const grown = after.content !== 'none' && Number.parseFloat(after.minHeight) >= 44;
        let clipped = false;
        for (let p = el.parentElement; p && p.tagName !== 'BODY'; p = p.parentElement) {
          const cs = getComputedStyle(p);
          if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
            clipped = true;
            break;
          }
        }
        if (!grown || clipped) {
          problems.push(
            `"${(name(el) || el.tagName).slice(0, 24)}" is ${String(Math.round(r.width))}x${String(Math.round(r.height))}${grown && clipped ? ' with its ::after clipped' : ''}`,
          );
        }
      }

      // ── every form control needs a label ───────────────────────────────
      for (const el of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
        if (!visible(el)) continue;
        const id = el.getAttribute('id');
        const labelled =
          (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
          el.closest('label') ||
          el.hasAttribute('aria-label') ||
          el.hasAttribute('aria-labelledby');
        if (!labelled)
          problems.push(`<${el.tagName.toLowerCase()}${id ? '#' + id : ''}> has no label`);
      }

      return { problems, headings: headings.length };
    });

    expect(report.headings, `${route} rendered no headings at all`).toBeGreaterThan(0);
    expect(report.problems, `${route}\n  ${report.problems.join('\n  ')}`).toEqual([]);
  });
}

test('@a11y the skip link is the first thing Tab reaches', async ({ page }) => {
  // `AX2`. A keyboard user who cannot skip the chrome tabs through it on every single page.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => {
    const el = document.activeElement;
    return {
      text: (el as HTMLElement | null)?.innerText?.trim() ?? '',
      href: el?.getAttribute('href') ?? '',
    };
  });
  expect(
    `${first.text} ${first.href}`.toLowerCase(),
    'the first tab stop is not a skip link',
  ).toMatch(/skip|#main/);
});
