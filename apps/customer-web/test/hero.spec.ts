/**
 * `SCR-WEB-001`'s hero — the properties that are invisible when correct.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * A hero is the most-edited surface on a marketing site, and every assertion here guards
 * something a reasonable person removes while making it look better:
 *
 *   `muted` deleted, because the footage has ambient sound and it seemed like a shame.
 *   `preload` raised to `auto`, because the video started a beat late on the developer's laptop.
 *   `text-on-media` swapped for `text-content-inverse`, because it looked identical in light mode.
 *   `'use client'` added to page.tsx, because a hook was needed somewhere on the page.
 *
 * None of those change how the page looks to the person making the change. The first two ship an
 * autoplaying sound and a 2.5 MB LCP regression; the third goes near-black-on-near-black in dark
 * theme; the fourth silently un-renders the page for the crawler `FR-SRCH-13` exists for.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import preset from '@gymmap/ui/tailwind-preset';

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

const VIDEO = 'src/features/home/hero-video.tsx';
const HERO = 'src/features/home/hero.tsx';

// ═══════════════════════════════════════════════════════════════════════════
// The video is decoration, and every attribute follows from that.
// ═══════════════════════════════════════════════════════════════════════════

test('the loop is muted — the autoplay grant is only defensible because it is', () => {
  const src = code(VIDEO);
  // `Permissions-Policy: autoplay=(self)` lets it start. `muted` is what makes starting
  // acceptable. Remove this and the page makes noise at a stranger, unprompted, on a phone.
  assert.match(src, /\bmuted\b/, 'the hero video is not muted');
  assert.match(src, /\bloop\b/);
  // iOS takes a non-inline video fullscreen the moment it plays.
  assert.match(src, /\bplaysInline\b/);
});

test('the loop is hidden from assistive technology and from the tab order', () => {
  const src = code(VIDEO);
  // It carries no information, so announcing "video" offers a screen-reader user nothing.
  assert.match(src, /aria-hidden="true"/);
  // Focusable in some browsers otherwise — a Tab stop that does nothing, sitting between the
  // skip link and the search box.
  assert.match(src, /tabIndex=\{-1\}/);
});

test('preload is metadata, not auto — NFR-PERF-02', () => {
  const src = code(VIDEO);
  assert.match(src, /preload="metadata"/);
  // The regression that looks like an improvement: `auto` pulls the whole file in parallel with
  // the LCP text, on the connection least able to afford it.
  assert.ok(!src.includes('preload="auto"'), 'preload was raised to auto');
});

test('the file the markup points at actually exists', () => {
  const src = code(VIDEO);
  const match = /<source src="([^"]+)"/.exec(src);
  assert.ok(match, 'no <source src> found');
  const rel = match[1]!;
  assert.ok(rel.startsWith('/'), `the source is not root-relative: ${rel}`);
  assert.ok(
    existsSync(join(APP_ROOT, 'public', rel)),
    `public${rel} does not exist — a renamed asset is invisible until someone opens the page`,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Motion, data, and the failure paths.
// ═══════════════════════════════════════════════════════════════════════════

test('both opt-outs are consulted before a single byte of video plays', () => {
  const src = code(VIDEO);
  // Reduced motion goes STATIC, not fast: a 1 ms infinite loop is still an infinite loop.
  assert.match(src, /prefers-reduced-motion/);
  assert.match(src, /prefersLessMotion\(\)/);
  // Save-Data is a different request with the same answer. 2.5 MB of decoration is precisely
  // the megabyte a visitor means when they turn it on.
  assert.match(src, /saveData/);
  assert.match(src, /prefersLessData\(\)/);
});

test('a refused play() is handled, not left to become an unhandled rejection', () => {
  const src = code(VIDEO);
  // Autoplay is declined by iOS low-power mode and by browser heuristics. That is a supported
  // outcome, and an unhandled rejection would report it to Sentry (A-15) as an error from every
  // affected device.
  assert.match(src, /\.play\(\)\.catch\(/);
});

test('WCAG 2.2.2 — a control exists that stops the motion', () => {
  const src = code(VIDEO);
  // The loop runs longer than five seconds, so a mechanism to stop it is an obligation.
  assert.match(src, /HeroMotionToggle/);
  assert.match(src, /\.pause\(\)/);
  assert.match(src, /motionPause/);
  assert.match(src, /motionPlay/);
});

test('the toggle takes the media focus ring, not the solid one', () => {
  const src = code(VIDEO);
  // `data-on-solid` resolves to `content-inverse`, which is `neutral-900` in dark theme — a
  // near-black ring on a near-black band, at about 1.2:1. It looks correct in light mode, which
  // is exactly why it would ship.
  assert.match(src, /data-on-media="true"/);
  assert.ok(
    !code(VIDEO).includes('data-on-solid'),
    'the toggle uses data-on-solid, which disappears against surface-media in dark theme',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// AX4 — every colour on this surface is a pairing the register proves.
// ═══════════════════════════════════════════════════════════════════════════

test('hero copy uses the media pair, and never a theme-flipping one', () => {
  const src = code(HERO);
  // The EXACT class, not a loose match. The first version of this test asserted `text-on-media`,
  // which is not a class this preset emits — the utility is `text-content-on-media`, because the
  // token lives at `colors.content['on-media']`. The test passed, the build passed, and the
  // stylesheet contained nothing: an unknown Tailwind class is silently dropped, so the copy fell
  // back to inherited colour and happened to look fine on a dark band. Asserting the exact string
  // is the only version of this test that would have failed.
  assert.match(src, /\btext-content-on-media\b/, 'the hero copy does not use content-on-media');
  assert.match(src, /\bbg-surface-media\b/);
  // The two that look right and are not. Both flip with the theme; `surface-media` does not.
  assert.ok(!src.includes('text-content-inverse'), 'content-inverse flips; surface-media does not');
  assert.ok(!src.includes('bg-surface-inverse'), 'surface-inverse flips; use surface-media');
});

test('the classes the hero names actually exist in the preset', () => {
  // Pins the relationship at BOTH ends. A class name is a string until something proves a token
  // answers to it, and Tailwind's failure mode for a name nothing answers to is silence.
  const colours = preset.theme?.colors as
    Record<string, Record<string, string> | string> | undefined;
  assert.ok(colours, 'the preset declares no colours');

  const surface = colours['surface'] as Record<string, string>;
  const content = colours['content'] as Record<string, string>;
  assert.ok(
    'media' in surface,
    'colors.surface.media is gone — bg-surface-media resolves to nothing',
  );
  assert.ok(
    'on-media' in content,
    'colors.content["on-media"] is gone — text-content-on-media resolves to nothing',
  );
  // Theme-invariance is the whole reason the pair exists, and it is asserted in packages/ui's
  // own suite. Here we only prove the app can reach it.
  assert.match(surface['media']!, /^var\(--gm-color-surface-media\)$/);
  assert.match(content['on-media']!, /^var\(--gm-color-content-on-media\)$/);
});

test('no opacity modifier dims text on the media band', () => {
  const src = code(HERO) + code(VIDEO);
  // A dimmed foreground is a pairing the §3.6 register does not contain, so nothing re-measures
  // it when the palette moves. Hierarchy here is size and weight.
  assert.ok(
    !/text-content-on-media\/\d/.test(src),
    'an alpha modifier was applied to content-on-media; it is also unreliable on a var() colour',
  );
  assert.ok(!/\bopacity-\d+\b/.test(code(HERO)), 'hero copy is dimmed with an opacity utility');
});

test('the veil reaches FULL opacity across the region the copy occupies', () => {
  assert.match(code(HERO), /\bgm-media-veil\b/, 'the hero lost its veil');

  const css = readFileSync(join(APP_ROOT, 'src/styles/globals.css'), 'utf8');
  const rule = /\.gm-media-veil\s*\{[\s\S]*?\}/.exec(css);
  assert.ok(rule, 'gm-media-veil is not defined');

  // Both stops resolve to the TOKEN. A hex here would opt the veil out of the palette and out
  // of the §3.6 register in one edit, and it would look identical.
  assert.match(rule[0], /var\(--gm-color-surface-media\)/);
  assert.ok(!/#[0-9a-fA-F]{3,8}/.test(rule[0]), 'the veil hard-codes a colour');

  // The stop position is the entire reason this is CSS rather than `via-surface-media`, which
  // sits at exactly 50%. On a phone the copy is taller than half the section, so a 50% stop put
  // the headline over the footage at a ratio that depends on the frame.
  const opaqueTo = /var\(--gm-color-surface-media\)\s+(\d+)%/g;
  const stops = [...rule[0].matchAll(opaqueTo)].map((m) => Number(m[1]));
  assert.ok(
    stops.some((s) => s >= 70),
    `the opaque stop is at ${stops.join('/')}% — the copy needs about 72% on a phone`,
  );
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
  // Exactly one file may, and this is it.
  assert.match(code(VIDEO), /^'use client';/);
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
