/**
 * `SCR-WEB-001`'s hero — the properties that are invisible when correct.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * A hero is the most-edited surface on a marketing site, and every assertion here guards
 * something a reasonable person removes while making it look better:
 *
 *   `text-on-media` swapped for `text-content-inverse`, because it looked identical in light mode.
 *   `'use client'` added to page.tsx, because a hook was needed somewhere on the page.
 *   `fill` used on the photograph, because it is the obvious prop for a background image.
 *   The scrim lightened, because the photograph looked better through it.
 *
 * None of those change how the page looks to the person making the change. The first goes
 * near-black-on-near-black in dark theme; the second silently un-renders the page for the crawler
 * `FR-SRCH-13` exists for; the third renders and is then dropped by the CSP, leaving the
 * photograph clipped at its natural size; the fourth drops the accent under 4.5:1 on a bright
 * frame, which no screenshot of a dark frame will ever show.
 *
 * ┌─ THIS FILE GUARDED A VIDEO UNTIL 2026-08-08 ───────────────────────────────────────────────┐
 * │ Eight assertions covered a 2.5 MB autoplaying loop: `muted`, `preload="metadata"`, the two  │
 * │ opt-outs, the handled `play()` rejection and the WCAG 2.2.2 pause control. The owner chose  │
 * │ a still photograph, and every one of those obligations went with the motion that created    │
 * │ them — a still cannot autoplay, cannot make noise and has nothing to pause.                  │
 * │                                                                                             │
 * │ They are in the history rather than deleted from it. If the loop comes back, so do they,    │
 * │ and `the hero ships no client island at all now` fails until someone restores them.          │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Comments blanked, newlines kept — the same discipline as `shell.spec.ts`. A test that reads
 *  prose fails on its own documentation, and this file documents heavily. */
function code(rel: string): string {
  const text = readFileSync(join(APP_ROOT, rel), 'utf8');
  let out = '';
  let i = 0;
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');
  while (i < text.length) {
    const two = text.slice(i, i + 2);
    if (two === '//') {
      const end = text.indexOf('\n', i);
      const stop = end === -1 ? text.length : end;
      out += blank(text.slice(i, stop));
      i = stop;
    } else if (two === '/*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += blank(text.slice(i, stop));
      i = stop;
    } else if (two === '{/') {
      const end = text.indexOf('*/}', i);
      const stop = end === -1 ? text.length : end + 3;
      out += blank(text.slice(i, stop));
      i = stop;
    } else {
      out += text[i];
      i += 1;
    }
  }
  return out;
}

const HERO = 'src/features/home/hero.tsx';

// ===========================================================================
// The background is DRAWN, and that is the whole point.
// ===========================================================================

test('the hero carries no image at all', () => {
  /*
   * ┌─ FIVE TESTS USED TO LIVE HERE, AND THEY ALL EARNED THEIR KEEP ─────────────────────────────┐
   * │ They pinned that exactly one element claimed `priority`, that the photograph was positioned │
   * │ from the stylesheet rather than with `fill` (which is an inline style, which the nonce in   │
   * │ `style-src` silently drops), that its `alt` was a catalogue key rather than "hero image",   │
   * │ and that it came from the one host `img-src` admits. Every one of those caught something.   │
   * │                                                                                            │
   * │ "Chalk & Iron" removes the photograph. The background is two radial washes, a masked rule   │
   * │ grid, three rings and 300 bytes of SVG grain - so there is no LCP image to prioritise, no   │
   * │ `fill` to get dropped, no alt text to write and no third-party host to admit. Five tests    │
   * │ deleted because the failure modes they guarded cannot occur, which is the only good reason  │
   * │ to delete a test.                                                                           │
   * │                                                                                            │
   * │ This one guards the property that replaced them: a drawn background is a KNOWN colour, so   │
   * │ the copy on it is a flat pairing rather than a bound against the worst frame a photograph   │
   * │ could present. Put an image back and all five have to come back with it.                    │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const src = code(HERO);
  assert.ok(!src.includes('<Image'), 'the hero renders an image again, so it needs the LCP rules');
  assert.ok(!src.includes('priority'), 'something in the hero claims LCP priority');
  assert.ok(
    !existsSync(join(APP_ROOT, 'src/features/home/hero-media.tsx')),
    'the media component is back without the tests that made it defensible',
  );
  assert.ok(
    !existsSync(join(APP_ROOT, 'src/features/home/hero-video.tsx')),
    'the video island is back without the tests that made it defensible',
  );
});

test('the hero ships no client island', () => {
  // `FR-SRCH-13` wants this page server-rendered end to end. The line reveal, the marquee and the
  // pulse are all CSS, so there is no state to hold and nothing to hydrate.
  const src = code(HERO);
  assert.ok(!src.includes("'use client'"), 'the hero became a client component');
  assert.ok(!src.includes('useState'), 'the hero holds state');
  assert.ok(!src.includes('addEventListener'), 'the hero attaches a listener; use CSS');
});

test('every looping animation STOPS under reduced motion rather than speeding up', () => {
  /*
   * `RM1` collapses the duration tokens to 1ms in one place, which is exactly right for a
   * transition and exactly wrong for an infinite loop: a marquee at 1ms is a strobe, and the
   * pulse becomes a flicker. Both therefore live INSIDE `prefers-reduced-motion: no-preference`
   * so they are never declared at all for a reader who asked for stillness.
   */
  const css = readFileSync(join(APP_ROOT, 'src/styles/globals.css'), 'utf8');
  for (const name of ['gm-slide', 'gm-pulse']) {
    const at = css.indexOf(`animation: ${name}`);
    assert.notEqual(at, -1, `${name} is no longer used`);
    const before = css.slice(0, at);
    const query = before.lastIndexOf('@media (prefers-reduced-motion: no-preference)');
    const closed = before.lastIndexOf('\n  }\n');
    assert.ok(
      query !== -1 && query > closed,
      `${name} loops outside a no-preference query, so RM1 turns it into a strobe`,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AX4 — every colour on this surface is a pairing the register proves.
// ═══════════════════════════════════════════════════════════════════════════

test('the hero copy sits on a KNOWN ground, so every pairing is flat', () => {
  /*
   * The four tests this replaces all guarded the media band: that the copy used
   * `text-content-on-media`, that the band was `bg-surface-media`, that no opacity modifier
   * dimmed anything on it, and that the accent appeared only on 72px bold type.
   *
   * All four existed because the ground was a photograph. It is a gradient now, which means the
   * ground is `surface-default` and the ink is `content-primary` - a pairing `contrast.proof.ts`
   * already proves as a set, at 17.76:1, with nothing left for this file to bound.
   *
   * What is still worth pinning is that it STAYS flat: an on-media role in here means somebody
   * has put copy back over an image without the proof that requires.
   */
  const src = code(HERO);
  assert.ok(!src.includes('bg-surface-media'), 'the hero copy is back on the media band');
  assert.ok(!src.includes('gm-media-veil'), 'the hero has a scrim again, so it has text on media');
  assert.ok(!src.includes('gm-glass'), 'the hero has glass again, which only exists over media');
});

test('no opacity modifier dims text anywhere in the hero', () => {
  /*
   * Opacity does not scale a contrast ratio, and the chrome learned it expensively: `opacity-40`
   * on the nav labels measured 2.06:1 while the comment defending it cited the base pairing at
   * 15.52:1. The floor for 4.5:1 there turned out to be opacity-97 - there is no usable dimming
   * on a translucent panel at all.
   */
  const src = code(HERO);
  const dimmed = src.match(/\bopacity-\d+\b/g);
  assert.equal(dimmed, null, `the hero dims text with ${String(dimmed)}; use a colour role`);
});

test('the display accent is used once, and on display type', () => {
  // The amber phrase is `#FFB627`, which is 11.08:1 on the ink ground - fine at any size. The
  // assertion is about restraint rather than contrast: one accent phrase per headline, or the
  // emphasis stops meaning anything.
  const src = code(HERO);
  const uses = [...src.matchAll(/<em>/g)];
  assert.equal(uses.length, 1, 'the hero has more than one accent phrase');
  const h1 = /<h1[\s\S]*?<\/h1>/.exec(src);
  assert.ok(h1, 'the hero lost its h1');
  assert.match(h1[0], /<em>/, 'the accent phrase is not in the headline');
  assert.match(h1[0], /gm-display-hero/, 'the headline is no longer display type');
});

// ═══════════════════════════════════════════════════════════════════════════
// FR-SRCH-13 — the page stays server-rendered.
// ═══════════════════════════════════════════════════════════════════════════

test('the home page is still a Server Component', () => {
  // The hero needed state for the pause control, and the tempting fix is `'use client'` at the
  // top of the page. That un-renders the headline, the copy and the search form for the crawler
  // this page exists to serve, and looks identical in a browser.
  assert.ok(!code('app/page.tsx').includes("'use client'"), 'page.tsx opted into the client');
  assert.ok(!code(HERO).includes("'use client'"), 'the hero shell opted into the client');
  // And now nothing on this page does at all. The video's pause control was the last thing that
  // needed state; the photograph that replaced it needed none, and the drawn background that
  // replaced THAT is three gradients and a mask.
  //
  // Swept rather than named: this asserted `sections.tsx`, a file the consolidation deleted, and
  // the assertion then failed on a missing path rather than on a client boundary. Every module in
  // the folder is checked, so it holds however the sections are split up next.
  const home = readdirSync(join(APP_ROOT, 'src/features/home'))
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => `src/features/home/${file}`);
  assert.ok(home.length >= 2, `only ${String(home.length)} home modules`);
  for (const rel of home) {
    assert.ok(!code(rel).includes("'use client'"), `${rel} opted into the client`);
  }
});

test('the search form still works without JavaScript', () => {
  const src = code(HERO);
  // A GET form, not an onSubmit handler. It works before hydration, it works with JS disabled,
  // and the URL it produces is shareable and crawlable.
  assert.match(src, /action="\/search"/);
  assert.match(src, /method="get"/);
  assert.match(src, /name="q"/);
  assert.ok(!src.includes('onSubmit'), 'the search form was converted to a JavaScript handler');
});
