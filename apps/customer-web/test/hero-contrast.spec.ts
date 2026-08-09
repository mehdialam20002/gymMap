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

  /*
   * ┌─ "LATER WINS" IS ONLY TRUE AT EQUAL SPECIFICITY, AND THIS FILE STOPPED BEING EQUAL ────────┐
   * │ The default theme is now `:root:not([data-theme='light'])`, and `:not()` contributes its    │
   * │ argument's weight - so that block is (0,2,0) and beats the bare `:root` (0,1,0) that both   │
   * │ `tokens.css` and this file's light block use. Taking the LAST applicable definition read    │
   * │ `content-on-media-accent` as the light `#9a6600` while the browser painted `#ffb627`, and   │
   * │ the accent proof measured a colour no reader ever sees. It passed, which is worse.          │
   * │                                                                                            │
   * │ So each applicable arm is scored the way the cascade scores it, and the winner is the       │
   * │ highest specificity, ties broken by source order. The helper's own docblock above warns     │
   * │ about exactly this failure against `tokens.css`; it just did not apply the lesson to        │
   * │ `globals.css` once `globals.css` grew the same shape.                                       │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const applicableWeight = (selector: string): number | null => {
    let best: number | null = null;
    for (const arm of selector.split(',')) {
      // An arm that REQUIRES an attribute cannot match a root that carries none.
      const required = arm.replace(/:not\([^)]*\)/g, '');
      if (/\[data-theme/.test(required)) continue;
      // `:root` is one class-level unit; every `:not([...])` adds its argument's.
      const weight = 1 + (arm.match(/:not\(\s*\[[^\]]*\]\s*\)/g) ?? []).length;
      best = best === null ? weight : Math.max(best, weight);
    }
    return best;
  };

  const readFrom = (css: string): string | null => {
    let found: string | null = null;
    let bestWeight = -1;
    for (const [, selector, body] of dropDarkMedia(css).matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      const weight = applicableWeight(selector!);
      if (weight === null || weight < bestWeight) continue;
      const hit = new RegExp(`--gm-color-${name}\\s*:\\s*(#[0-9a-fA-F]{6})`).exec(body!);
      if (hit) {
        found = hit[1]!;
        bestWeight = weight;
      }
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
function accent(selector: string): { name: string; rgb: number[] } {
  /*
   * Third version, and the reason for it is the reason this helper takes a selector now.
   *
   * It read `.gm-display-accent`, a rule NOTHING rendered - the class was left in the stylesheet
   * when the hero was rebuilt, and the proof went on measuring it. Green, and about a colour no
   * reader ever saw. The two accents that ship are the hero's `<em>` and the closing band's, and
   * both are measured below.
   */
  /*
   * `indexOf` and then a FIXED regex on the slice, not a regex built from the selector.
   *
   * A pattern assembled in a template literal swallows every backslash escape in it - `\s` reads
   * as a bare `s` - so the built regex matches nothing and the assertion below fires on a rule
   * that is perfectly fine. That has happened three times in this repository; `panelAlpha()`
   * below uses this shape for the same reason.
   */
  const open = CSS.indexOf(`${selector} {`);
  assert.notEqual(open, -1, `${selector} is not declared`);
  const rule = /color:\s*var\((--[\w-]+)\)/.exec(CSS.slice(open, open + 400));
  assert.ok(rule, `${selector} no longer sets its colour from a token`);
  const name = rule[1]!;
  return { name, rgb: token(name.replace('--gm-color-', '')) };
}

// ─────────────────────────────────────────────────────────────────────────────
// The chrome, which is the only translucent thing left.
// ─────────────────────────────────────────────────────────────────────────────

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
/*
 * The ground is a PARAMETER now. It was hard-coded to `surface-media`, which was right while the
 * pane it measured tinted with that token; `.gm-chrome-glass` tints with `surface-default`, and a
 * bound computed against the wrong ground is not a bound.
 */
function worstCase(fg: readonly number[], ground: readonly number[], alpha: number): number {
  let lowest = Infinity;
  for (let tone = 0; tone <= 255; tone++) {
    lowest = Math.min(lowest, contrast(fg, over(ground, [tone, tone, tone], alpha)));
  }
  return lowest;
}

/**
 * The chrome pane's tint, read off the rule the header actually carries.
 *
 * ┌─ THIS MEASURED A RULE NOTHING RENDERED ────────────────────────────────────────────────────┐
 * │ It read `.gm-glass`, which was declared in the stylesheet and applied by no component - the │
 * │ header wears `.gm-chrome-glass`. So the one proof standing between the site chrome and an   │
 * │ illegible header on every listing route was measuring dead CSS, and passing.                │
 * │                                                                                            │
 * │ `.gm-glass` is deleted now, and `.gm-chrome-glass` mixes `surface-default` rather than      │
 * │ `surface-media`, so the ground and the ink below changed with it.                           │
 * └────────────────────────────────────────────────────────────────────────────────────────────┘
 */
function panelAlpha(): number {
  const open = CSS.indexOf('.gm-chrome-glass {');
  assert.notEqual(open, -1, '.gm-chrome-glass is not declared');
  const found =
    /background-color:\s*color-mix\(in srgb,\s*var\(--gm-color-surface-default\)\s*(\d+)%/.exec(
      CSS.slice(open),
    );
  assert.ok(found, '.gm-chrome-glass no longer declares a color-mix background');
  return Number(found[1]) / 100;
}

test('the resolver reads the same block the browser paints from', () => {
  /*
   * ┌─ EVERY RATIO BELOW IS ONLY AS GOOD AS `token()`, SO `token()` GETS A TEST ─────────────────┐
   * │ It resolved `content-on-media-accent` to the light theme's `#9a6600` while the page painted │
   * │ `#ffb627`, because it took the LAST applicable declaration and the winning one was the      │
   * │ MORE SPECIFIC one earlier in the file. Every proof in this file kept passing, about colours │
   * │ nobody saw.                                                                                │
   * │                                                                                            │
   * │ Rather than restating a hex - which this file's whole discipline is against - the check     │
   * │ ties the resolver to the theme policy through a second, independent declaration. The block  │
   * │ that carries `color-scheme` is by definition the one that decides the default page, so the  │
   * │ neutral the resolver returns has to be the neutral declared alongside it. Flip the default  │
   * │ and both move together, or this fails.                                                     │
   * │                                                                                            │
   * │ Cross-checked once against the running page over the DevTools protocol, which is where the  │
   * │ discrepancy was found: `getPropertyValue('--gm-color-surface-default')` on the un-stamped   │
   * │ root returns exactly what this asserts.                                                     │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const bare = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = [...bare.matchAll(/([^{}]*)\{([^{}]*)\}/g)].filter(([, , body]) =>
    /color-scheme:\s*dark/.test(body!),
  );
  assert.equal(
    blocks.length,
    1,
    `${String(blocks.length)} blocks declare color-scheme: dark; the default theme must be decided in exactly one`,
  );

  const [, selector, body] = blocks[0]!;
  assert.match(
    selector!,
    /:root:not\(\[data-theme=['"]light['"]\]\)/,
    'the default-theme block is no longer the one that beats a bare :root on specificity',
  );

  const declared = /--gm-color-surface-default:\s*(#[0-9a-fA-F]{6})/.exec(body!);
  assert.ok(declared, 'the default-theme block no longer declares the page ground');
  assert.deepEqual(
    token('surface-default'),
    rgb(declared[1]!),
    'the resolver is reading a different block from the one that decides the default theme',
  );

  // And the toggle has to agree, or it offers to switch to the theme already on screen.
  const toggle = source('src/shared/theme/theme-toggle.tsx').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(
    toggle,
    /dataset\['theme'\] === 'light' \? 'light' : 'dark'/,
    'the theme control treats the absent attribute as light, but the stylesheet paints it dark',
  );
});

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

test('both display accents clear 3:1 on the ground they sit on — WCAG 1.4.3 large text', () => {
  // Amber `#FFB627` is a LIGHT accent: it fails on a bright backdrop and rises as the ground
  // darkens. On the ink ground it is 11.08:1, which clears the body bar too.
  //
  // BOTH of them, because they were two different colours until the audit: the hero's amber and
  // the closing band's periwinkle `content-brand`. Measuring one said nothing about the other.
  for (const selector of ['.gm-display-hero em', '.gm-close .gm-display em']) {
    const { name, rgb: colour } = accent(selector);
    const measured = contrast(colour, SURFACE);
    assert.ok(
      measured >= 3,
      `${selector} takes ${name} at ${measured.toFixed(2)}:1 on the page ground`,
    );
  }
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
  /*
   * The pane tints with `surface-default` and inks with `content-primary`, so the composite is
   * those two and not the media roles - the chrome flips with the theme, which is what makes it
   * self-bounding on a route with no scrim.
   */
  const lowest = worstCase(INK, SURFACE, panelAlpha());
  assert.ok(
    lowest >= 4.5,
    `.gm-chrome-glass is ${lowest.toFixed(2)}:1 over the worst frame, which is what every ` +
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
  /*
   * ┌─ A LIST OF FOUR NAMES BECAME A SWEEP, BECAUSE THE LIST MISSED EIGHT ───────────────────────┐
   * │ This named the four rules deleted when the photograph went, which is a test that proves    │
   * │ those four are gone and nothing about the ninth. Eight more had gone dead by the time an   │
   * │ audit looked: `.gm-glass`, `.gm-display-accent`, `.gm-brand-glow`, `.gm-hero-push`,        │
   * │ `.gm-mono`, `.gm-step-rail`, `.gm-tile-scrim`, `.gm-card-badge-new`.                        │
   * │                                                                                            │
   * │ Two of those were not merely untidy. `.gm-glass` and `.gm-display-accent` were the rules    │
   * │ the contrast proofs in this file MEASURED - so the header's legibility bound and the        │
   * │ accent's 3:1 check were both computed against CSS no component applied, and both passed.    │
   * │ A dead rule here is not dead weight, it is a place for a proof to go and quietly stop       │
   * │ meaning anything.                                                                           │
   * │                                                                                            │
   * │ Comments are stripped from BOTH sides. `.gm-glass` survived the first sweep purely because  │
   * │ a component mentioned it in a comment explaining why it does not use it.                    │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const strip = (text: string): string =>
    text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  const declared = new Set([...strip(CSS).matchAll(/\.(gm-[a-z0-9-]+)/g)].map(([, name]) => name!));
  assert.ok(declared.size >= 60, `only ${String(declared.size)} gm- rules found; the scan broke`);

  const applied = tsxFiles('src')
    .concat(tsxFiles('app'))
    .map((rel) => strip(source(rel)))
    .join('\n');

  /*
   * The only exemptions, and each is a class a COMPONENT cannot carry:
   *   `gm-skip-link` and `gm-visually-hidden` are applied by the layout and by generated markup;
   *   `gm-hit-target` is applied all over, so it is not exempt - it is simply found.
   * Anything added here needs a reason of that kind, not "it will be used later".
   */
  const exempt = new Set<string>([]);

  const orphans = [...declared].filter((name) => !exempt.has(name) && !applied.includes(name));
  assert.deepEqual(
    orphans,
    [],
    `declared in globals.css and applied by no component: ${orphans.join(', ')}`,
  );
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
