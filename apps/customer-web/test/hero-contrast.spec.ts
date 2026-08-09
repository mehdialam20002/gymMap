/**
 * The hero's colour pairings, recomputed from the stylesheet rather than restated.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE HERO IS A PHOTOGRAPH, SO EVERY RATIO HERE IS A BOUND RATHER THAN A MEASUREMENT
 *
 * A ratio against a scrim depends on the frame behind it, which is why `contrast.proof.ts` refuses
 * translucent colours outright. The objection is answerable: translucency is not unmeasurable, it
 * is BOUNDED. No frame can be brighter than white, so compositing the stack over pure white gives
 * the worst case any photograph will ever present. Clear it there and it is clear against every
 * frame that ever loads, including one nobody has chosen yet.
 *
 * Two things make that harder than it sounds, and both were shipped wrong at least once:
 *
 *   Alpha MULTIPLIES. A 62% scrim under a 66% panel is 87% black, and the navigation spent a week
 *   as an opaque bar because one layer was measured correctly and the other was forgotten.
 *
 *   The accent has a FAILURE BAND. It clears 3:1 on a bright backdrop and again on a dark one, and
 *   fails everywhere between. "Lighten it a little" moves it INTO the band from either side, and
 *   the reviewer's eye reads the result as an improvement.
 *
 * So nothing here restates a number. The gradient stops, the panel alphas and the accent's own
 * token are all PARSED from the declarations, and the ratios are recomputed from whatever is
 * actually there.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { source, tsxFiles } from './helpers.ts';

// ─────────────────────────────────────────────────────────────────────────────
// WCAG 2.x, from the definitions.
// ─────────────────────────────────────────────────────────────────────────────

const channel = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = ([r, g, b]: readonly number[]): number =>
  0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);

function contrast(a: readonly number[], b: readonly number[]): number {
  const [hi, lo] =
    luminance(a) > luminance(b) ? [luminance(a), luminance(b)] : [luminance(b), luminance(a)];
  return (hi + 0.05) / (lo + 0.05);
}

const rgb = (h: string): number[] => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));

const CSS = source('src/styles/globals.css');
const TOKENS = source('../../packages/ui/src/tokens/tokens.css');

/**
 * A custom property's value, as the cascade resolves it for the DEFAULT theme.
 *
 * The app's own overrides come first and win where they exist; the design system's light block is
 * the fallback. Reading rather than restating is the whole discipline of this file: a proof that
 * carries its own copy of a colour proves something about a page that may not exist. That is not
 * hypothetical here - an earlier version hard-coded `#020617` and `#F8FAFC`, and both moved.
 */
function token(name: string): number[] {
  /*
   * ┌─ THE SELECTOR MATTERS, AND THE FIRST VERSION IGNORED IT ──────────────────────────────────┐
   * │ `globals.css` carries two override blocks: the brand reds on `:root, :root[light]`, and a │
   * │ whole neutral palette on `:root[data-theme='dark']`. Taking "the last definition in the    │
   * │ file" read the DARK value for every neutral and reported `content-muted` at 7.43:1 on      │
   * │ `surface-subtle` - which is true of the dark theme and says nothing about the default one. │
   * │                                                                                            │
   * │ So blocks are matched by selector, and only those that apply with no `data-theme` set      │
   * │ count. Later ones still win among those, which is what the cascade does.                    │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  /*
   * The `@media (prefers-color-scheme: dark)` wrapper has to go FIRST, by brace matching.
   *
   * Scanning blocks with one flat regex and filtering on the selector looked sufficient and was
   * not: inside that wrapper the inner selector is `:root:not([data-theme='light'])`, which does
   * not contain the word "dark" anywhere. Every dark value sailed through the filter and the
   * proof measured the dark theme while claiming to measure the default one.
   */
  const dropDarkMedia = (css: string): string => {
    const open = '@media (prefers-color-scheme: dark)';
    let out = css;
    for (;;) {
      const at = out.indexOf(open);
      if (at === -1) return out;
      let depth = 0;
      let i = out.indexOf('{', at);
      for (; i < out.length; i++) {
        if (out[i] === '{') depth++;
        else if (out[i] === '}' && --depth === 0) break;
      }
      out = out.slice(0, at) + out.slice(i + 1);
    }
  };

  const appliesToDefault = (selector: string): boolean =>
    selector.split(',').some((one) => !/data-theme=['"]?dark/.test(one));

  const readFrom = (css: string): string | null => {
    let found: string | null = null;
    for (const [, selector, body] of dropDarkMedia(css).matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      if (!appliesToDefault(selector!)) continue;
      const hit = new RegExp(`--gm-color-${name}\\s*:\\s*(#[0-9a-fA-F]{6})`).exec(body!);
      if (hit) found = hit[1]!;
    }
    return found;
  };

  const own = readFrom(CSS.replace(/\/\*[\s\S]*?\*\//g, ''));
  if (own !== null) return rgb(own);
  const shipped = readFrom(TOKENS.replace(/\/\*[\s\S]*?\*\//g, ''));
  assert.ok(shipped !== null, `--gm-color-${name} is defined nowhere for the default theme`);
  return rgb(shipped);
}

/**
 * The colour the red half of the headline actually renders as.
 *
 * ┌─ THIS IS THE ASSERTION THAT CAUGHT THE BUG, TWICE ────────────────────────────────────────┐
 * │ First version: the proof hard-coded `#FF4757` and passed, while the headline painted       │
 * │ `#E21B2D` - `brand-solid`, a FILL role reused as ink - and measured 2.28:1 on the scrim it │
 * │ then sat on.                                                                               │
 * │                                                                                            │
 * │ Second version: the class was repointed at `content-on-media-accent`, which was correct on │
 * │ a scrimmed photograph and became wrong the moment the ground turned white. So the proof     │
 * │ follows the declaration instead of naming a colour, and it measures whatever is there.      │
 * └────────────────────────────────────────────────────────────────────────────────────────────┘
 */
function accent(): { name: string; rgb: number[] } {
  const use = /\.gm-display-accent\s*\{[\s\S]*?color:\s*var\((--[\w-]+)\)/.exec(CSS);
  assert.ok(use, '.gm-display-accent no longer sets its colour from a token');
  const name = use[1]!;
  return { name, rgb: token(name.replace('--gm-color-', '')) };
}

// ─────────────────────────────────────────────────────────────────────────────
// The chrome, which is the only translucent thing left.
// ─────────────────────────────────────────────────────────────────────────────

const MEDIA = token('surface-media');
const ON_MEDIA = token('content-on-media');
const SURFACE = token('surface-default');
const INK = token('content-primary');

/** The brightest pixel any photograph can contain. Bound the worst case, never sample the image. */
const over = (top: readonly number[], under: readonly number[], a: number): number[] =>
  top.map((c, i) => a * c + (1 - a) * under[i]!);

/**
 * The worst contrast `fg` can reach through the panel, over ANY frame.
 *
 * Sweeping the grey axis rather than compositing over white: for ink, white is the worst backdrop
 * and one composite would do, but for a mid-luminance colour the worst backdrop is whichever
 * drives the composite to its own luminance. The sweep covers every case without needing to know
 * which kind of colour it was handed.
 */
function worstCase(fg: readonly number[], alpha: number): number {
  let lowest = Infinity;
  for (let tone = 0; tone <= 255; tone++) {
    lowest = Math.min(lowest, contrast(fg, over(MEDIA, [tone, tone, tone], alpha)));
  }
  return lowest;
}

function panelAlpha(): number {
  const open = CSS.indexOf('.gm-glass {');
  assert.notEqual(open, -1, '.gm-glass is not declared');
  const found =
    /background-color:\s*color-mix\(in srgb,\s*var\(--gm-color-surface-media\)\s*(\d+)%/.exec(
      CSS.slice(open),
    );
  assert.ok(found, '.gm-glass no longer declares a color-mix background');
  return Number(found[1]) / 100;
}

test('the hero ground is flat, so its copy needs no bound at all', () => {
  /*
   * "Chalk & Iron" draws the hero background instead of photographing it, which retires the whole
   * apparatus this file used to carry: the scrim's four gradient stops, the accent's failure band,
   * the two-layer alpha multiplication under the navigation.
   *
   * A gradient is a known colour. `content-primary` on `surface-default` is the same number every
   * time, and `contrast.proof.ts` already proves it as part of the set.
   */
  assert.ok(
    !CSS.includes('.gm-media-veil'),
    'the scrim is back; the copy is on a photograph again and needs its bound back',
  );
  const measured = contrast(INK, SURFACE);
  assert.ok(measured >= 4.5, `hero ink is ${measured.toFixed(2)}:1 on the hero ground`);
});

test('the display accent clears 3:1 on the hero ground — WCAG 1.4.3 large text', () => {
  // Amber `#FFB627` is a LIGHT accent: it fails on a bright backdrop and rises as the ground
  // darkens. On the ink ground it is 11.08:1, which clears the body bar too.
  const { name, rgb: colour } = accent();
  const measured = contrast(colour, SURFACE);
  assert.ok(measured >= 3, `the accent (${name}) is ${measured.toFixed(2)}:1 on the hero ground`);
});

/*
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE HEADER STILL FLOATS OVER PHOTOGRAPHY, ON EVERY ROUTE
 *
 * `SiteHeader` is mounted in the ROOT LAYOUT and is `sticky top-0`, and gym cards render
 * full-bleed `object-cover` photography that passes directly under it. The hero losing its
 * photograph changes nothing here - the chrome never had a scrim to rely on anyway, which is why
 * it self-bounds.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

test('the header panel is legible with nothing but a photograph under it', () => {
  const measured = worstCase(ON_MEDIA, panelAlpha());
  assert.ok(
    measured >= 4.5,
    `.gm-glass alone is ${measured.toFixed(2)}:1 over the worst frame, which is what every ` +
      `listing route actually gives it`,
  );
});

test('the header uses the chrome pane, never a hero pane', () => {
  const header = source('src/shared/chrome/site-header.tsx');
  const classes = (header.match(/className="[^"]*"/g) ?? []).join(' ');
  assert.match(classes, /gm-chrome-glass/, 'the header no longer uses the chrome pane');
  assert.ok(
    !classes.split(/\s+/).includes('gm-glass'),
    'the header uses the media pane, which expects a scrim it will not have',
  );
});

test('no rule is left in the stylesheet with nothing using it', () => {
  // The scrim, the on-scrim pane and the headline shadow all existed to put text on a
  // photograph. Deleted rather than left behind as dead rules with elaborate proofs attached to
  // nothing - a comment describing CSS that no longer exists sends the next reader looking.
  const rules = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const gone of [
    '.gm-media-veil',
    '.gm-glass-on-scrim',
    '.gm-under-chrome',
    '.gm-display-ink',
  ]) {
    assert.ok(!rules.includes(gone), `${gone} is still declared but nothing applies it`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// One element, one `::after`.
// ─────────────────────────────────────────────────────────────────────────────

test('no decorative ::after on a class that shares an element with gm-hit-target', () => {
  /*
   * ┌─ THE BUG THIS CATCHES LOOKS LIKE A DESIGN DECISION ────────────────────────────────────────┐
   * │ `gm-hit-target` expands the pointer target using `::after` with `min-height: 44px` and     │
   * │ `min-width: 44px`. An element has exactly ONE `::after`, so a second rule naming it does   │
   * │ not stack - the two merge property by property, and `min-height` beats `height`.           │
   * │                                                                                            │
   * │ `.gm-nav-link::after` was a 2px underline. What rendered was its background and radius     │
   * │ painted across the full 44px target: a red lozenge the size of the label, invisible at     │
   * │ rest because of `scaleX(0)` and revealed on hover. Nothing about it looked like a bug in   │
   * │ review - it looked like a hover style somebody had chosen.                                 │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const painted = new Set(
    [...CSS.matchAll(/\.(gm-[\w-]+)::after\s*\{([^}]*)\}/g)]
      .filter(([, , body]) => /background|border-radius|box-shadow|content:\s*'[^']/.test(body!))
      .map(([, name]) => name!),
  );

  for (const rel of [...tsxFiles('src'), ...tsxFiles('app')]) {
    for (const attr of source(rel).match(/className="[^"]*"/g) ?? []) {
      if (!attr.includes('gm-hit-target')) continue;
      for (const name of painted) {
        assert.ok(
          !attr.includes(name),
          `${rel}: .${name} paints ::after and sits on the same element as gm-hit-target, ` +
            `which already owns ::after. Use ::before.`,
        );
      }
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Horizontal scrollers have to contain what they scroll.
// ─────────────────────────────────────────────────────────────────────────────

test('every horizontal scroller is a containing block', () => {
  /*
   * ┌─ THE 1px BOX THAT DRAGGED THE WHOLE PAGE SIDEWAYS ─────────────────────────────────────────┐
   * │ `overflow-x: auto` clips a descendant only when that descendant's containing block is the  │
   * │ scroller or something inside it. `.gm-visually-hidden` is `position: absolute` with no      │
   * │ offsets, so without a positioned ancestor it resolves against the initial containing block  │
   * │ and is laid out at its static position - out in the scrolled content, past the viewport.    │
   * │                                                                                            │
   * │ Measured: `/compare` at 390px scrolled 214px sideways because of one of them at x=651.      │
   * │ Nothing was visibly wrong; you only met it by swiping.                                      │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const rules = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const relative = new Set(
    [...rules.matchAll(/([^{}]+)\{[^}]*position:\s*relative[^}]*\}/g)]
      .flatMap(([, sel]) => sel!.split(','))
      .map((s) => s.trim())
      .filter((s) => s.startsWith('.gm-')),
  );

  const scrollers: { rel: string; names: string[] }[] = [];
  for (const rel of [...tsxFiles('src'), ...tsxFiles('app')]) {
    for (const attr of source(rel).match(/className="[^"]*"/g) ?? []) {
      if (!attr.includes('overflow-x-auto') && !attr.includes('overflow-x-scroll')) continue;
      scrollers.push({ rel, names: (attr.match(/gm-[\w-]+/g) ?? []).map((n) => `.${n}`) });
    }
  }

  assert.ok(scrollers.length > 0, 'no horizontal scrollers found, so this test proves nothing');
  for (const s of scrollers) {
    assert.ok(
      s.names.some((n) => relative.has(n)),
      `${s.rel}: this element scrolls horizontally but none of its classes ` +
        `(${s.names.join(' ') || 'none'}) is position: relative, so an absolutely positioned ` +
        `descendant - every .gm-visually-hidden is one - escapes its clip and widens the page`,
    );
  }
});

test('globals.css does not cite a proof script that is not in the repository', () => {
  const dangling = [...CSS.matchAll(/scratchpad\/[\w.-]+/g)].map((m) => m[0]);
  assert.deepEqual(dangling, [], `globals.css cites uncommitted scripts: ${dangling.join(', ')}`);
});
