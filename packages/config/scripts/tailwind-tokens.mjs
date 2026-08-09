/**
 * CI gate `tailwind-tokens` — every spacing and font-weight utility resolves to a real token.
 *
 * ┌─ THE FAILURE THIS CATCHES IS SILENT IN EVERY OTHER TOOL ────────────────────────────────────┐
 * │ Tailwind does not error on an unknown class. `px-inset-3xs` compiles to nothing at all, and │
 * │ so does `w-60`. TypeScript sees a string. ESLint sees a string. The build is green, the      │
 * │ tests pass, and the screen renders with no padding, no width and a badge clipped against the │
 * │ edge of the sidebar.                                                                          │
 * │                                                                                              │
 * │ It happened: an admin console shipped with thirteen dead utilities across eight files, and   │
 * │ the only signal was a screenshot.                                                             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY THE NUMERIC SCALE IS GONE, WHICH IS THE HALF PEOPLE GET WRONG ─────────────────────────┐
 * │ `DesignSystem.md` §2.4 sets `theme.spacing`, it does not extend it. That REPLACES Tailwind's │
 * │ default scale — so `p-4`, `w-60`, `h-14` and `gap-2` do not exist in this repository, even   │
 * │ though they are the first thing anyone types. `UI2` wants exactly that: one scale, defined   │
 * │ once, and no component quietly reaching outside it.                                          │
 * │                                                                                              │
 * │ A genuine layout dimension that is not a spacing token (a sidebar width, a header height)    │
 * │ uses an arbitrary value — `w-[15rem]`. That is allowed and is not a loophole: it is visible  │
 * │ in review as a deliberate exception, which `w-60` silently is not.                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The scale is READ FROM THE PRESET rather than duplicated here. A hard-coded copy would drift
 * from the tokens it is meant to police, and would then either pass a dead class or fail a live
 * one — both worse than no gate.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Utilities whose values come from `theme.spacing`.
 *
 * ORDER MATTERS, and getting it wrong is a false positive rather than a miss. The list becomes a
 * regex alternation, which is first-match-wins: with `gap` before `gap-x`, the class
 * `gap-x-inline-xl` matched `gap` and left `x-inline-xl` as the "value", so a perfectly valid
 * class was reported dead. Longer prefixes therefore come first.
 */
const SPACING_UTILITIES = [
  'px',
  'py',
  'pt',
  'pb',
  'pl',
  'pr',
  'p',
  'mx',
  'my',
  'mt',
  'mb',
  'ml',
  'mr',
  'm',
  'gap-x',
  'gap-y',
  'gap',
  'space-x',
  'space-y',
  'min-w',
  'min-h',
  'max-w',
  'max-h',
  'w',
  'h',
  'top',
  'bottom',
  'left',
  'right',
  'size',
];

/**
 * Values Tailwind supplies for these utilities independently of `theme.spacing`.
 *
 * `width` and friends carry `auto`, `full`, `screen`, `min`, `max`, `fit` and the fraction scale
 * in their OWN defaults, so those survive the spacing replacement. Margins keep `auto`.
 * `max-w` additionally carries the preset's own named sizes.
 */
const ALWAYS_VALID = new Set([
  'auto',
  'full',
  'screen',
  'min',
  'max',
  'fit',
  'none',
  '0',
  // `max-w` names declared by the preset alongside the token scale.
  'prose',
  'ui',
  'container',
  'form',
]);

/**
 * `max-w` does NOT read `theme.spacing`. It reads `theme.maxWidth`, which the preset sets to a
 * short named list — `prose`, `form`, `ui`, `container`, `full`. Validating it against the
 * spacing scale was a blind spot that let `max-w-0` through: `0` is in `ALWAYS_VALID`, so the
 * gate passed it, and Tailwind's JIT then errored on a value that does not exist and took the
 * dev server down with it. Same class of mistake this gate exists to catch, in the gate.
 */
const MAX_WIDTH_KEYS = new Set(['prose', 'form', 'ui', 'container', 'full', 'none']);

/** `w-1/2`, `h-2/3`. Part of Tailwind's own width/height scale, not of spacing. */
const FRACTION = /^\d+\/\d+$/;

/** Reads the `spacing` keys straight out of the preset that defines them. */
export function spacingScale(repoRoot = process.cwd()) {
  const preset = resolve(repoRoot, 'packages/ui/tailwind-preset.ts');
  if (!existsSync(preset)) throw new Error(`the Tailwind preset is missing at ${preset}`);

  const source = readFileSync(preset, 'utf8');
  const block = /const spacing = \{([\s\S]*?)\n\} as const;/.exec(source);
  if (block === null) {
    throw new Error(
      'could not find `const spacing = { … } as const;` in the preset. This gate reads the ' +
        'scale from its definition on purpose — a hard-coded copy drifts from the tokens it ' +
        'polices. Update the pattern here in the same change that reshapes the preset.',
    );
  }

  const keys = new Set();
  for (const match of block[1].matchAll(/^\s*'?([a-zA-Z0-9-]+)'?:/gm)) keys.add(match[1]);
  return keys;
}

/**
 * Reads the `fontWeight` keys straight out of the preset.
 *
 * +- WHY WEIGHTS NEEDED THE SAME GATE AS SPACING ----------------------------------------------+
 * | The preset REPLACES `theme.fontWeight` the way it replaces `theme.spacing`, so Tailwind's    |
 * | familiar names are gone: there is no `font-normal`, no `font-extrabold`, no `font-light`.     |
 * | The scale is regular | medium | semibold | bold | heavy.                                     |
 * |                                                                                          |
 * | Six of them were live in three apps before this check existed, and the failure is nastier    |
 * | than a missing margin: a dead weight class emits nothing, so the element INHERITS whatever    |
 * | weight its parent has. `font-normal` on a span inside a `font-semibold` paragraph renders     |
 * | BOLD. On `MetricCard` that meant every loading placeholder rendered at the same weight as     |
 * | the figure it stood in for — which is the exact "placeholder indistinguishable from data"     |
 * | failure that component's own docblock says it exists to prevent.                              |
 * |                                                                                          |
 * | Missing spacing collapses and is eventually noticed. An inherited weight looks deliberate.    |
 * +-------------------------------------------------------------------------------------------+
 */
export function fontWeightScale(repoRoot = process.cwd()) {
  const preset = resolve(repoRoot, 'packages/ui/tailwind-preset.ts');
  const source = readFileSync(preset, 'utf8');
  // `{4}` rather than four literal spaces: `no-regex-spaces` is right that counting them by eye is
  // how a pattern silently stops matching after somebody reindents the file it reads.
  const block = /fontWeight: \{([\s\S]*?)\n {4}\},/.exec(source);
  if (block === null) {
    throw new Error(
      'could not find `fontWeight: { … }` in the preset. This gate reads the scale from its ' +
        'definition on purpose — update the pattern here in the same change that reshapes it.',
    );
  }

  const keys = new Set();
  for (const match of block[1].matchAll(/^\s*([a-zA-Z]+):/gm)) keys.add(match[1]);
  return keys;
}

/**
 * Reads the `borderColor` keys straight out of the preset.
 *
 * +- THE THIRD FAMILY OF SILENTLY-DEAD UTILITY, AND THE WORST ONE ------------------------------+
 * | `border-subtle` did not exist as a class for the whole life of this console. The border roles |
 * | live at `colors.border.*`, so Tailwind generated `border-border-subtle`; nothing used that     |
 * | name, and `.border-subtle` was absent from the compiled stylesheet entirely.                  |
 * |                                                                                          |
 * | A missing spacing utility collapses a gap. A missing font weight inherits its parent's. A      |
 * | missing BORDER COLOUR falls back to `currentColor` - the element's TEXT colour - so every      |
 * | card and panel was outlined in near-black ink in light mode. It looked like a deliberate hard  |
 * | outline, which is exactly why it survived: nothing about it looked broken, it just looked bad, |
 * | and three rounds of adjusting the token had no effect because the token was never being read.  |
 * +-------------------------------------------------------------------------------------------+
 */
export function borderColorScale(repoRoot = process.cwd()) {
  const preset = resolve(repoRoot, 'packages/ui/tailwind-preset.ts');
  const source = readFileSync(preset, 'utf8');
  const block = /borderColor: \{([\s\S]*?)\n {4}\},/.exec(source);
  if (block === null) {
    throw new Error(
      'could not find `borderColor: { … }` in the preset. Without it `border-subtle` silently ' +
        'falls back to currentColor — see the note above. Update the pattern here in the same ' +
        'change that reshapes the preset.',
    );
  }

  const keys = new Set(['transparent', 'current', 'inherit']);
  for (const match of block[1].matchAll(/^\s*'?([a-zA-Z0-9-]+)'?:/gm)) keys.add(match[1]);
  // The spread of `colors` brings every role group in as a PREFIX — `border-surface-sunken`,
  // `border-content-muted`. Those are legitimate and cannot be enumerated from this block, so the
  // check below skips anything whose first segment names a role group.
  return keys;
}

/** Strips block and line comments so the gate never fires on prose that discusses a class. */
function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * The contents of every `className`, and nothing else.
 *
 * Scanning whole files is the obvious implementation and it is wrong: `'p-001'` is a plan
 * identifier in the gym fixture, and `--gm-size-md` is a token name in `packages/ui`. Both look
 * exactly like a dead utility to a naive regex, and a gate that cries wolf on real data is a gate
 * somebody adds an ignore-file for within a week.
 *
 * Handles both `className="…"` and `className={…}`, the latter by walking braces so a template
 * literal containing a nested `${…}` is captured whole rather than truncated at the first `}`.
 */
function classNameRegions(code) {
  const regions = [];
  const marker = /className\s*=\s*/g;

  for (let match = marker.exec(code); match !== null; match = marker.exec(code)) {
    let index = match.index + match[0].length;
    const opener = code[index];

    if (opener === '"' || opener === "'") {
      const end = code.indexOf(opener, index + 1);
      if (end === -1) continue;
      regions.push(code.slice(index + 1, end));
      marker.lastIndex = end;
      continue;
    }

    if (opener !== '{') continue;

    let depth = 0;
    const start = index;
    for (; index < code.length; index += 1) {
      if (code[index] === '{') depth += 1;
      else if (code[index] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    regions.push(code.slice(start + 1, index));
    marker.lastIndex = index;
  }

  return regions;
}

function sourceFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.next')
        continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && statSync(full).isFile()) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Reads the `zIndex` keys straight out of the preset.
 *
 * +- THE FOURTH FAMILY, AND THE ONE THAT REORDERS THE PAGE SILENTLY ---------------------------+
 * | The preset REPLACES `theme.zIndex` the way it replaces `theme.spacing`, so Tailwind's        |
 * | numeric ladder - `z-0`, `z-10`, `z-50` - does not exist, and neither does `z-auto` unless    |
 * | the block below names it.                                                                    |
 * |                                                                                             |
 * | `z-10` was written on the announcement bar to hold it above the hero background, and the     |
 * | computed value measured `auto` in the browser: the hero's gradient painted over the strip    |
 * | AND its text. Nothing errored and nothing looked broken - the bar simply had a different     |
 * | ground from the one its contrast is proved against.                                          |
 * |                                                                                             |
 * | A missing spacing collapses a gap. A missing weight inherits. A missing border colour goes   |
 * | to currentColor. A missing z-index hands the layer order back to DOM position, which is the  |
 * | only one of the four that can hide content behind other content.                             |
 * +-------------------------------------------------------------------------------------------+
 */
export function zIndexScale(repoRoot = process.cwd()) {
  const preset = resolve(repoRoot, 'packages/ui/tailwind-preset.ts');
  const source = readFileSync(preset, 'utf8');
  const block = /zIndex: \{([\s\S]*?)\n {4}\},/.exec(source);
  if (block === null) {
    throw new Error(
      'could not find `zIndex: { … }` in the preset. Without it a missing `z-` utility silently ' +
        'leaves the element at `auto` and the layer order falls back to DOM position — see the ' +
        'note above. Update the pattern here in the same change that reshapes the preset.',
    );
  }

  const keys = new Set();
  for (const match of block[1].matchAll(/^\s*'?([a-zA-Z0-9-]+)'?:/gm)) keys.add(match[1]);
  return keys;
}

export function checkTailwindTokens(repoRoot = process.cwd()) {
  const scale = spacingScale(repoRoot);
  const weights = fontWeightScale(repoRoot);
  const borders = borderColorScale(repoRoot);
  const layers = zIndexScale(repoRoot);
  /** Role groups the preset spreads in from `colors`; `border-surface-sunken` is legitimate. */
  const ROLE_PREFIXES = new Set([
    'surface',
    'content',
    'border',
    'viz',
    'brand',
    'success',
    'warning',
    'danger',
    'info',
  ]);
  const problems = [];

  /**
   * `font-semibold`, with any responsive or state prefix. Built FRESH per region.
   *
   * +- NOT SUPERSTITION - THE HOISTED VERSION SILENTLY MATCHED NOTHING -------------------------+
   * | The first version hoisted one /g literal out of the loop, the way the spacing pattern is   |
   * | hoisted, and the gate reported OK on a file that visibly contained `font-extrabold`.        |
   * | Instrumenting it showed the region arriving correctly and matchAll yielding zero results,  |
   * | which is shared lastIndex state on a reused global regex.                                   |
   * |                                                                                          |
   * | A gate that silently finds nothing is worse than no gate, because it is trusted. This one  |
   * | pays one regex construction per region to have no shared state, and the check below was     |
   * | then proved to bite by temporarily introducing `font-extrabold` and watching it fail.       |
   * +-------------------------------------------------------------------------------------------+
   */
  const borderPatternFor = () =>
    /\b(?:(?:sm|md|lg|xl|2xl|hover|focus|active|disabled|dark|group-hover):)*border-([a-z0-9-]+)\b/g;

  const weightPatternFor = () =>
    /\b(?:(?:sm|md|lg|xl|2xl|hover|focus|active|disabled|dark|group-hover):)*font-([a-z]+)\b/g;

  const layerPatternFor = () =>
    /\b(?:(?:sm|md|lg|xl|2xl|hover|focus|active|disabled|dark|group-hover):)*z-([a-zA-Z0-9[\]-]+)/g;

  const pattern = new RegExp(
    String.raw`\b(?:(?:sm|md|lg|xl|2xl|hover|focus|active|disabled|dark|group-hover):)*(` +
      SPACING_UTILITIES.join('|') +
      String.raw`)-(-?[a-zA-Z0-9._/\[\]%-]+)`,
    'g',
  );

  const roots = [
    'apps/admin-dashboard/src',
    'apps/gym-dashboard/src',
    'apps/customer-web/src',
    'apps/customer-web/app',
    'packages/ui/src',
  ];

  const explain = (utility, value) => {
    const dimension = utility.startsWith('w') || utility.startsWith('h') ? 'size' : 'spacing';
    const advice = /^\d/.test(value)
      ? 'The numeric scale does not exist here: `theme.spacing` REPLACES it ' +
        `(DesignSystem.md §2.4). Use a token, or an arbitrary value such as \`${utility}-[Xrem]\` ` +
        'for a real layout dimension.'
      : `Nearest tokens: ${
          [...scale].filter((key) => key.split('-')[0] === value.split('-')[0]).join(', ') ||
          'none with that prefix'
        }.`;

    return (
      `\`${utility}-${value}\` is not in the spacing scale, so Tailwind emits NOTHING for it ` +
      `and the element renders with no ${dimension}. ${advice}`
    );
  };

  const isValid = (utility, value) => {
    if (value.startsWith('[')) return true;
    // `max-w` is scored against its OWN scale. See MAX_WIDTH_KEYS.
    if (utility === 'max-w') return MAX_WIDTH_KEYS.has(value) || FRACTION.test(value);
    return scale.has(value) || ALWAYS_VALID.has(value) || FRACTION.test(value);
  };

  for (const root of roots) {
    for (const file of sourceFiles(resolve(repoRoot, root))) {
      const code = withoutComments(readFileSync(file, 'utf8'));

      for (const region of classNameRegions(code)) {
        for (const [, utility, value] of region.matchAll(pattern)) {
          if (isValid(utility, value)) continue;
          problems.push({
            file: relative(repoRoot, file).split('\\').join('/'),
            class: `${utility}-${value}`,
            message: explain(utility, value),
          });
        }

        for (const [, border] of region.matchAll(borderPatternFor())) {
          if (borders.has(border)) continue;
          // `border-2`, `border-t`, `border-x` and friends are WIDTH and SIDE utilities that share
          // the prefix. And a compound like `border-surface-sunken` is a role-group colour.
          // WIDTH and SIDE utilities share the `border-` prefix: `border-2`, `border-t`,
          // `border-b-2`, `border-x-0`, plus the border-STYLE keywords. `border-b-2` was the false
          // positive that proved this list needed the combined side-and-width form.
          if (
            /^(?:\d+|[trblxy](?:-\d+)?|solid|dashed|dotted|none|hidden|double|collapse|separate)$/.test(
              border,
            )
          )
            continue;
          if (ROLE_PREFIXES.has(border.split('-')[0] ?? '')) continue;
          problems.push({
            file: relative(repoRoot, file).split('\\').join('/'),
            class: `border-${border}`,
            message:
              `\`border-${border}\` is not in the borderColor scale, so Tailwind emits NOTHING and ` +
              "the border falls back to `currentColor` — the element's TEXT colour, which on a card " +
              'is near-black ink and looks like a deliberate outline. Available: ' +
              `${[...borders].filter((k) => !ROLE_PREFIXES.has(k)).join(', ')}.`,
          });
        }

        for (const [, layer] of region.matchAll(layerPatternFor())) {
          // `z-[60]` is a deliberate arbitrary value, the same escape hatch spacing has.
          if (layer.startsWith('[')) continue;
          if (layers.has(layer)) continue;
          problems.push({
            file: relative(repoRoot, file).split('\\').join('/'),
            class: `z-${layer}`,
            message:
              `\`z-${layer}\` is not in the zIndex scale, so Tailwind emits NOTHING and the ` +
              'element stays at `auto` — its layer order falls back to DOM position, which is how ' +
              'a background ends up painted over the content it sits behind. Available: ' +
              `${[...layers].join(', ')}.`,
          });
        }

        for (const [, weight] of region.matchAll(weightPatternFor())) {
          // `font-mono`, `font-sans` and `font-serif` are FAMILIES and share the prefix.
          if (weight === 'mono' || weight === 'sans' || weight === 'serif') continue;
          if (weights.has(weight)) continue;
          problems.push({
            file: relative(repoRoot, file).split('\\').join('/'),
            class: `font-${weight}`,
            message:
              `\`font-${weight}\` is not in the font-weight scale, so Tailwind emits NOTHING and ` +
              "the element INHERITS its parent's weight — which usually looks deliberate rather " +
              `than broken. Available: ${[...weights].join(', ')}.`,
          });
        }
      }
    }
  }

  return problems;
}

// `pathToFileURL` rather than string-building a `file://` prefix. On Windows the argv path is
// `C:\…`, which produces two slashes where the URL form has three — so the comparison never
// matches and the gate exits silently. A gate that runs in CI and quietly does nothing on a
// developer's machine is worse than no gate, because it is trusted.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkTailwindTokens();

  if (problems.length === 0) {
    process.stdout.write(
      'tailwind-tokens: OK — every spacing, font-weight, border-colour and z-index utility resolves.\n',
    );
  } else {
    process.stdout.write(`tailwind-tokens: ${problems.length} dead utility class(es)\n`);
    for (const problem of problems) {
      process.stdout.write(`  [${problem.class}] ${problem.file}\n      ${problem.message}\n`);
    }
    process.exitCode = 1;
  }
}
