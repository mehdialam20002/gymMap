/**
 * The `AX4` proof, asserted — `DesignSystem.md` §3.6, §3.8, §9.6. `NFR-USE-04`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THIS SUITE IS THE REASON `contrast.proof.ts` IS DATA
 *
 * "Text >= 4.5:1, interactive >= 3:1, guaranteed BY THE PALETTE rather than by per-component
 * choices" is a claim that decays the moment somebody edits a ramp step. Sixty pairings, each
 * recomputed from the hex values and compared BOTH to its floor and to its recorded measurement.
 *
 * Comparing only to the floor would let a pairing slide from 7.60:1 to 4.60:1 with the suite
 * still green — technically passing, and a real regression nobody sees. Comparing to the
 * recorded value catches the drift as well as the breach.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_PAIRINGS,
  DARK_PAIRINGS,
  DESK_PAIRINGS,
  FLOOR,
  FORBIDDEN_PAIRINGS,
  LIGHT_NONTEXT_PAIRINGS,
  LIGHT_TEXT_PAIRINGS,
  contrastRatio,
  relativeLuminance,
} from '../src/tokens/contrast.proof.ts';
import { palette, RAMP_CONTRACT, type ColourFamily } from '../src/tokens/primitive/palette.ts';
import { dark, light } from '../src/tokens/semantic/index.ts';

/** The function itself, before anything is proved with it. */
test('CONTROL — the ratio function reproduces the two ends of the WCAG range', () => {
  // If this drifts, every one of the sixty assertions below is measuring the wrong thing while
  // reporting success. It is the cheapest possible check and the one most worth having.
  assert.equal(Number(contrastRatio('#000000', '#FFFFFF').toFixed(2)), 21);
  assert.equal(Number(contrastRatio('#FFFFFF', '#FFFFFF').toFixed(2)), 1);
  assert.equal(Number(relativeLuminance('#FFFFFF').toFixed(4)), 1);
  assert.equal(Number(relativeLuminance('#000000').toFixed(4)), 0);
  // Order-independent — a register that recorded fg/bg the wrong way round must still be right.
  assert.equal(contrastRatio('#0F172A', '#FFFFFF'), contrastRatio('#FFFFFF', '#0F172A'));
});

test('the ratio function refuses a colour it cannot prove', () => {
  // A ratio against a translucent fill depends on what is behind it, so it is not computable
  // here. Silently accepting `rgb(2 6 23 / 0.6)` would produce a number that means nothing.
  assert.throws(() => relativeLuminance('rgb(2 6 23 / 0.60)'), /#RRGGBB/);
  assert.throws(() => relativeLuminance('white'), /#RRGGBB/);
});

for (const group of [
  { name: '§3.6.1 light text', rows: LIGHT_TEXT_PAIRINGS },
  { name: '§3.6.2 light non-text', rows: LIGHT_NONTEXT_PAIRINGS },
  { name: '§9.6 dark', rows: DARK_PAIRINGS },
  { name: '§9.5 desk', rows: DESK_PAIRINGS },
]) {
  for (const pairing of group.rows) {
    test(`${pairing.id} · ${group.name} — ${pairing.shipsIn}`, () => {
      const actual = contrastRatio(pairing.foreground, pairing.background);

      assert.ok(
        Math.abs(actual - pairing.measured) <= 0.015,
        `${pairing.id}: recorded ${pairing.measured.toFixed(2)}:1, actually ` +
          `${actual.toFixed(2)}:1. Either a ramp step moved and this register was not updated, ` +
          `or the register was wrong when written. Both are the same defect: the §3.6 table is ` +
          `generated from this data, so the published evidence no longer describes the palette.`,
      );

      if (pairing.floor !== null) {
        assert.ok(
          actual >= pairing.floor,
          `${pairing.id}: ${actual.toFixed(2)}:1 is below the ${pairing.floor}:1 floor. ` +
            `This pairing ships in: ${pairing.shipsIn}.`,
        );
      }
    });
  }
}

test('§3.8 — the four forbidden pairings are still forbidden', () => {
  // Asserted as NEGATIVE cases. A palette tweak that accidentally makes one legal must not make
  // it permitted: the row has to be removed deliberately, under §12.
  for (const forbidden of FORBIDDEN_PAIRINGS) {
    const actual = contrastRatio(forbidden.foreground, forbidden.background);
    assert.ok(
      Math.abs(actual - forbidden.measured) <= 0.015,
      `${forbidden.id}: recorded ${forbidden.measured}, actually ${actual.toFixed(2)}`,
    );
    assert.ok(
      actual < FLOOR.text,
      `${forbidden.id} now measures ${actual.toFixed(2)}:1 and would pass the text floor. That ` +
        `does NOT make it permitted — §12 governs. Remove the row deliberately or leave it.`,
    );
  }
});

test('the pairing F1 used to forbid now PASSES, and re-darkening the canvas must fail here', () => {
  // ┌─ THIS TEST REPLACED A FORBIDDEN-PAIRING ASSERTION, AND THAT IS THE POINT ──────────────────┐
  // │ F1 was `content-muted` on `surface-sunken` at 3.21:1 — this file's own "single most likely  │
  // │ accident in this palette", because `surface-sunken` is the zebra stripe and muted metadata   │
  // │ in a table row is the most natural thing to write.                                          │
  // │                                                                                            │
  // │ Lightening the canvas from a mid-grey `neutral-300` to `neutral-50` resolved it. So the row  │
  // │ was removed deliberately (§12) and the assertion INVERTED: the pairing must now clear the   │
  // │ floor. A future change that re-darkens the canvas fails here, which is the only way the      │
  // │ accident could come back — and it would come back invisibly, because nothing about a         │
  // │ slightly darker canvas looks like a contrast regression.                                     │
  // └────────────────────────────────────────────────────────────────────────────────────────────┘
  const muted = contrastRatio(light['color-content-muted'], light['color-surface-sunken']);
  assert.ok(
    muted >= FLOOR.text,
    `content-muted on surface-sunken is ${muted.toFixed(2)}:1. It was 3.21:1 and forbidden as F1; ` +
      'if the canvas has been darkened again, either restore it or re-record F1 as forbidden.',
  );

  // The replacement F1 prescribed is still the better choice for small metadata, and still passes
  // by a wide margin. Components use it; this keeps that recommendation honest.
  const tertiary = contrastRatio(light['color-content-tertiary'], light['color-surface-sunken']);
  assert.ok(tertiary >= FLOOR.text, 'the prescribed replacement (L07) does not itself pass');
  assert.ok(tertiary > muted, 'tertiary is meant to be the SAFER of the two');
});

test('F4 — success-600 is absent from the interactive set, in both themes', () => {
  // White on #059669 is 3.77:1. `bg-emerald-600 text-white` looks correct and is not; this is the
  // exact trap the semantic tier exists to prevent.
  assert.notEqual(light['color-success-solid'], palette.emerald[600]);
  assert.notEqual(light['color-success-solid-hover'], palette.emerald[600]);
  assert.notEqual(light['color-success-solid-active'], palette.emerald[600]);
  assert.ok(
    contrastRatio(light['color-content-on-success'], light['color-success-solid']) >= FLOOR.text,
  );
});

test('§3.5 — hover and active can never REDUCE contrast', () => {
  // The derivation direction is the property: the worst case is proved at `default`, and every
  // other state is strictly better. A palette whose hover lightens would need three ratios per
  // role instead of one, and would fail here.
  const roles = [
    ['brand', 'on-brand'],
    ['success', 'on-success'],
    ['warning', 'on-warning'],
    ['danger', 'on-danger'],
  ] as const;

  for (const [role, foreground] of roles) {
    const fg = light[`color-content-${foreground}`];
    const base = contrastRatio(fg, light[`color-${role}-solid`]);
    const hover = contrastRatio(fg, light[`color-${role}-solid-hover`]);
    const active = contrastRatio(fg, light[`color-${role}-solid-active`]);

    assert.ok(base >= FLOOR.text, `${role} default is ${base.toFixed(2)}:1`);
    assert.ok(hover >= base, `${role} hover ${hover.toFixed(2)} < default ${base.toFixed(2)}`);
    assert.ok(active >= hover, `${role} active ${active.toFixed(2)} < hover ${hover.toFixed(2)}`);
  }
});

test('§3.2 — every ramp satisfies the step contract, so a family added later is built the same', () => {
  const families: ColourFamily[] = ['neutral', 'pear', 'emerald', 'amber', 'red', 'sky'];
  const byUse = Object.fromEntries(RAMP_CONTRACT.map((r) => [r.steps.join('-'), r.property]));

  for (const family of families) {
    const ramp = palette[family];
    // 600-700: white on a 700-step is >= 4.5:1. Asserted at 700 and NOT at 600 — emerald-600
    // fails at 3.77:1, which is exactly why `success-solid` maps to 700.
    assert.ok(
      contrastRatio(palette.white, ramp[700]) >= FLOOR.text,
      `${family}-700 cannot carry white text: ${byUse['600-700']}`,
    );
    // 200-300: a 300-step on the dark canvas is >= 4.5:1 — the dark-mode text guarantee.
    assert.ok(
      contrastRatio(ramp[300], palette.neutral[900]) >= FLOOR.text,
      `${family}-300 fails on the dark canvas: ${byUse['200-300']}`,
    );
    // 400-500: a 400-step on the dark canvas is >= 3:1 — chart series and non-text indicators.
    assert.ok(
      contrastRatio(ramp[400], palette.neutral[900]) >= FLOOR.interactive,
      `${family}-400 fails on the dark canvas: ${byUse['400-500']}`,
    );
    // 50-100: an 800-step foreground on a 50-step fill of the SAME family is >= 4.5:1 — every
    // status pill in the product is this pairing.
    assert.ok(
      contrastRatio(ramp[800], ramp[50]) >= FLOOR.text,
      `${family}-800 on ${family}-50 fails: ${byUse['50-100']}`,
    );
    // 800-950: a 950-step on white is >= 12:1.
    assert.ok(
      contrastRatio(ramp[950], palette.white) >= 12,
      `${family}-950 on white fails: ${byUse['800-950']}`,
    );
  }
});

test('every semantic status pairing passes, not only the ones someone remembered to register', () => {
  // The register is hand-maintained, so it can be incomplete. This derives the pairings from the
  // TOKENS instead: every `content-<role>` against its `surface-<role>-subtle`, and every
  // `content-on-<role>` against its `<role>-solid`, in BOTH themes. A role added later is
  // covered without anyone remembering to add a row.
  for (const [themeName, theme] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    for (const role of ['brand', 'success', 'warning', 'danger', 'info'] as const) {
      const onSolid = contrastRatio(
        theme[`color-content-on-${role}`],
        theme[`color-${role}-solid`],
      );
      assert.ok(
        onSolid >= FLOOR.text,
        `${themeName}: content-on-${role} on ${role}-solid is ${onSolid.toFixed(2)}:1`,
      );

      const onSubtle = contrastRatio(
        theme[`color-content-${role}`],
        theme[`color-surface-${role}-subtle`],
      );
      assert.ok(
        onSubtle >= FLOOR.text,
        `${themeName}: content-${role} on surface-${role}-subtle is ${onSubtle.toFixed(2)}:1`,
      );
    }

    // The four content steps against the three neutral surfaces they may legitimately sit on.
    // `muted` on `sunken` is F1 and is excluded — it is forbidden, not failing.
    for (const surface of ['default', 'subtle', 'sunken'] as const) {
      for (const content of ['primary', 'secondary', 'tertiary'] as const) {
        const ratio = contrastRatio(
          theme[`color-content-${content}`],
          theme[`color-surface-${surface}`],
        );
        assert.ok(
          ratio >= FLOOR.text,
          `${themeName}: content-${content} on surface-${surface} is ${ratio.toFixed(2)}:1`,
        );
      }
    }

    // The focus ring must clear 3:1 on every surface it can land on (§3.7).
    for (const surface of ['default', 'subtle', 'sunken', 'raised'] as const) {
      const ring = contrastRatio(theme['color-border-focus'], theme[`color-surface-${surface}`]);
      assert.ok(
        ring >= FLOOR.interactive,
        `${themeName}: the focus ring on surface-${surface} is ${ring.toFixed(2)}:1 — a ring ` +
          'that cannot be seen on a surface it lands on is an invisible focus state (FR1)',
      );
    }

    // N01 — the border IS the control boundary, so it carries the 3:1 obligation on both canvases.
    const inputBorder = contrastRatio(theme['color-border-input'], theme['color-surface-default']);
    assert.ok(
      inputBorder >= FLOOR.interactive,
      `${themeName}: border-input is ${inputBorder.toFixed(2)}:1`,
    );
  }
});

test('the register covers every id exactly once', () => {
  const ids = ALL_PAIRINGS.map((p) => p.id);
  assert.equal(
    new Set(ids).size,
    ids.length,
    'a duplicate id means one row silently shadows another',
  );
  assert.ok(ALL_PAIRINGS.length >= 58, `only ${ALL_PAIRINGS.length} pairings registered`);
});
