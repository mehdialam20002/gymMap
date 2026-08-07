/**
 * The token system's own invariants — `DesignSystem.md` §1.3, §2.5, §7.2, §9.2.
 *
 * The rules this asserts are the ones stated as prose in the specification and therefore the ones
 * most likely to be broken by a hurried edit: density must not touch colour, every token must
 * carry the `--gm-` prefix, no token name may contain a value, and the two themes must have
 * identical key sets at RUNTIME as well as at compile time.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { light, dark, COLOUR_TOKEN_KEYS, semanticSpace } from '../src/tokens/semantic/index.ts';
import { componentTokens, deskTokens } from '../src/tokens/component/index.ts';
import { densities, DENSITIES, REMAPPABLE_KEYS } from '../src/tokens/density/index.ts';
import {
  INPUT_FONT_FLOOR_PX,
  TOUCH_TARGET_MIN_PX,
  fontSize,
  zIndex,
} from '../src/tokens/primitive/scale.ts';
import { generateTokensCss } from '../src/tokens/generate-css.ts';
import { nestedRadiusPx } from '../src/tokens/semantic/misc.ts';

// ═══════════════════════════════════════════════════════════════════════════
// §9.2 — the two themes cannot diverge.
// ═══════════════════════════════════════════════════════════════════════════

test('§9.2 — light and dark have identical key sets, asserted at runtime', () => {
  // The compile-time half lives in semantic/index.ts. This is the runtime half, because a type
  // error is invisible in a CI log and disappears the moment somebody writes `as any`.
  assert.deepEqual(Object.keys(light).sort(), Object.keys(dark).sort());
  assert.ok(COLOUR_TOKEN_KEYS.length >= 60, `only ${COLOUR_TOKEN_KEYS.length} colour tokens`);
});

test('every colour token resolves to a value in both themes', () => {
  for (const key of COLOUR_TOKEN_KEYS) {
    for (const [name, theme] of [
      ['light', light],
      ['dark', dark],
    ] as const) {
      const value = theme[key];
      assert.ok(value, `${name}.${key} is empty`);
      assert.ok(
        /^#[0-9A-Fa-f]{6}$/.test(value) || value.startsWith('rgb('),
        `${name}.${key} = "${value}" is neither a hex nor an rgb() — a token that is a var() ` +
          'reference would make the theme indirect, and the generator would emit a cycle',
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// §7.2 — density changes size, never colour, never meaning.
// ═══════════════════════════════════════════════════════════════════════════

test('§7.2 — NO density mode names a colour', () => {
  // The one rule that makes three densities one design system rather than three. Enforced
  // mechanically, because "do not put a colour in the density map" is precisely the rule a
  // hurried change breaks — and the result reads as a deliberate visual decision.
  for (const mode of DENSITIES) {
    for (const [key, value] of Object.entries(densities[mode])) {
      assert.ok(
        !/#[0-9A-Fa-f]{3,8}\b|rgb|hsl|color/i.test(value),
        `${mode}.${key} = "${value}" looks like a colour. §1.3: a density mode that reaches for ` +
          'a different red has stopped being a density mode and is a second design system.',
      );
    }
  }
});

test('§7.2 — every density mode remaps exactly the same closed key set', () => {
  const expected = [...REMAPPABLE_KEYS].sort();
  for (const mode of DENSITIES) {
    assert.deepEqual(
      Object.keys(densities[mode]).sort(),
      expected,
      `${mode} does not remap the same keys as the others — a key present in two modes and ` +
        'absent from the third silently inherits the comfortable value there',
    );
  }
});

test('§7.2 `TS2` — the input font is 16px at EVERY density', () => {
  // Below 16px, iOS Safari zooms the viewport on focus, producing exactly the horizontal scroll
  // NFR-USE-07 forbids. This is a bug fix expressed as a token, and compact is where it would be
  // "tidied away" first.
  const mdRem = Number.parseFloat(fontSize.md[0]);
  assert.equal(mdRem * 16, INPUT_FONT_FLOOR_PX);

  for (const mode of DENSITIES) {
    const inputFont = densities[mode]['input-font'];
    assert.ok(
      inputFont.includes('font-size-md') || inputFont.includes('font-size-xl'),
      `${mode} sets input-font to "${inputFont}" — anything below md (16px) triggers the iOS ` +
        'zoom. Oversized may go UP; nothing may go down.',
    );
  }
});

test('§7.4 — the 44px touch floor is never remapped', () => {
  assert.equal(TOUCH_TARGET_MIN_PX, 44);
  for (const mode of DENSITIES) {
    assert.ok(
      !('size-target-min' in densities[mode]),
      `${mode} remaps the touch target. The PAINT may shrink with density; the TARGET may not — ` +
        'compact paints 36px and expands the hit area instead (HT1).',
    );
  }
  assert.equal(densities.compact['control-height'], '36px');
  assert.equal(densities.comfortable['control-height'], '44px');
});

// ═══════════════════════════════════════════════════════════════════════════
// §2.5 — the naming grammar.
// ═══════════════════════════════════════════════════════════════════════════

test('NG4 — no token name contains a value', () => {
  // `--gm-space-16` and `--gm-color-blue-button` are the two shapes this catches. Semantic tokens
  // name INTENT; a value in the name is how a token survives the change it was meant to absorb.
  const semanticNames = [...Object.keys(light), ...Object.keys(semanticSpace)];
  for (const name of semanticNames) {
    assert.ok(
      !/-\d+$/.test(name),
      `"${name}" ends in a number, which names a value rather than an intent (NG4)`,
    );
    assert.ok(
      !/(blue|green|red|indigo|amber|slate|emerald|sky|neutral)/.test(name),
      `"${name}" names a HUE. A semantic token names what it is for; the hue is a Tier 1 ` +
        'detail that the semantic layer exists to hide (NG4).',
    );
  }
});

test('NG2 — state is a suffix, so sorting groups a role with its states', () => {
  for (const name of Object.keys(light)) {
    for (const state of ['hover', 'active', 'disabled', 'visited']) {
      if (!name.includes(state)) continue;
      assert.ok(
        name.endsWith(state),
        `"${name}" carries "${state}" mid-name. NG2 requires it as a suffix — ` +
          '`color-brand-solid-hover`, never `color-brand-hover-solid`.',
      );
    }
  }
});

test('NG5 — only the desk names a screen, and it is the one argued exception', () => {
  const screenish = /checkout|dashboard|search|login|landing|admin|profile/;
  for (const name of [...Object.keys(light), ...Object.keys(componentTokens)]) {
    assert.ok(!screenish.test(name), `"${name}" names a screen or feature (NG5)`);
  }
  // The desk earns its namespace: a genuine third density with an accessibility obligation of
  // its own (NFR-USE-01, NFR-USE-09).
  for (const name of Object.keys(deskTokens)) {
    assert.ok(name.startsWith('desk-'), `"${name}" is in the desk module but not namespaced`);
  }
});

test('§2.6 — the primitive escape hatch is a closed list of TWO', () => {
  // Enumerated so it is a list, not a principle. A third requires §12.
  const bypasses = Object.keys(deskTokens).filter(
    (k) => k === 'desk-camera-aspect' || k === 'desk-verdict-min-height',
  );
  assert.equal(bypasses.length, 2);
  assert.equal(deskTokens['desk-camera-aspect'], '4 / 3');
  assert.equal(deskTokens['desk-verdict-min-height'], '52svh');
});

// ═══════════════════════════════════════════════════════════════════════════
// §9.5 — the desk verdict keeps its polarity across themes.
// ═══════════════════════════════════════════════════════════════════════════

test('§9.5 `DK7` — the verdict is theme-independent, and allow is the BRIGHT state', () => {
  // A theme toggle that inverted these would re-teach a receptionist the opposite of what they
  // learned over three months. The desk's dark mode changes the CHROME, never the verdict.
  assert.equal(deskTokens['desk-verdict-allow-fill'], '#ECFDF5');
  assert.equal(deskTokens['desk-verdict-deny-fill'], '#7F1D1D');

  // The polarity itself, asserted rather than assumed: allow must be lighter than deny.
  const allowIsLighter =
    Number.parseInt(deskTokens['desk-verdict-allow-fill'].slice(1), 16) >
    Number.parseInt(deskTokens['desk-verdict-deny-fill'].slice(1), 16);
  assert.ok(allowIsLighter, 'the allow fill is not brighter than the deny fill — §4.3 inverted');

  // And it is in NEITHER theme's colour map, which is what makes it theme-independent rather
  // than merely coincidentally equal today.
  for (const theme of [light, dark]) {
    assert.ok(!Object.keys(theme).some((k) => k.startsWith('desk-')));
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// §6.5 / §6.3 — layers and the nesting rule.
// ═══════════════════════════════════════════════════════════════════════════

test('§6.5 — popover sits ABOVE dialog, and toast above both', () => {
  const n = (k: keyof typeof zIndex) => Number(zIndex[k]);
  // A `Select` inside a dialog is the single most common z-index bug in shadcn-derived stacks.
  assert.ok(n('popover') > n('dialog'), 'a Select inside a Dialog would render behind it');
  // A "payout failed" toast must not be hidden behind a modal.
  assert.ok(n('toast') > n('dialog'));
  // The verdict must never be partly behind a nav bar, but the override dialog opens on top.
  assert.ok(n('desk-verdict') > n('app-chrome'));
  assert.ok(n('desk-verdict') < n('dialog'));
  // The skip link must be visible over everything, always.
  assert.equal(n('skip-link'), Math.max(...Object.values(zIndex).map(Number)));
});

test('§6.3 — the nesting rule floors at radius-xs rather than going negative', () => {
  assert.equal(nestedRadiusPx(12, 12), 2);
  assert.equal(nestedRadiusPx(12, 6), 6);
  assert.equal(nestedRadiusPx(16, 4), 12);
  // The degenerate case: padding larger than the radius must not produce a negative radius.
  assert.equal(nestedRadiusPx(8, 40), 2);
});

// ═══════════════════════════════════════════════════════════════════════════
// The generated stylesheet.
// ═══════════════════════════════════════════════════════════════════════════

test('NG1 — every declaration in the generated CSS carries the --gm- prefix', () => {
  const css = generateTokensCss();
  const declared = css.match(/^\s*--[a-z0-9-]+:/gim) ?? [];
  assert.ok(declared.length > 400, `only ${declared.length} declarations generated`);
  for (const decl of declared) {
    assert.ok(
      decl.trim().startsWith('--gm-'),
      `"${decl.trim()}" is unprefixed. The prefix is what makes a global-stylesheet collision ` +
        'impossible and a grep exhaustive.',
    );
  }
});

test('DM1 — an explicit data-theme beats the OS preference in BOTH directions', () => {
  const css = generateTokensCss();
  // The naive version is a bare @media block, and it silently wins over a user who chose light
  // on a dark-mode OS. The :not() is what makes the override actually override.
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
  assert.match(css, /:root:not\(\[data-theme='light'\]\)/);
  assert.match(css, /:root\[data-theme='dark'\]/);

  // And the explicit dark block must come AFTER the media query, or specificity ties resolve the
  // wrong way for a user who chose dark on a light-mode OS.
  assert.ok(
    css.indexOf(":root[data-theme='dark']") > css.indexOf('@media (prefers-color-scheme: dark)'),
    'the explicit dark block precedes the media query, so source order defeats the override',
  );
});

test('§7.1 — density applies to any region root, not only to <html>', () => {
  const css = generateTokensCss();
  for (const mode of DENSITIES) {
    // Both selectors, so the check-in desk can run oversized inside a compact app shell.
    assert.ok(css.includes(`:root[data-density='${mode}']`), `${mode} missing the :root selector`);
    assert.ok(css.includes(`[data-density='${mode}'] {`), `${mode} missing the region selector`);
  }
});

test('RM1 — reduced motion collapses durations to 1ms, not to 0', () => {
  const css = generateTokensCss();
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /--gm-motion-duration-fast: 1ms;/);
  // 0 would hang any code that awaits `transitionend` before removing a node, turning an
  // accessibility preference into a broken UI.
  assert.ok(!/--gm-motion-duration-\w+: 0ms;/.test(css.split('prefers-reduced-motion')[1] ?? ''));
});

test('the generator is deterministic', () => {
  // It is diffed against a committed file by `tokens:check`; nondeterminism would make that gate
  // fail at random and then be disabled.
  assert.equal(generateTokensCss(), generateTokensCss());
});
