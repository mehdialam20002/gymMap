/**
 * CI gate `tailwind-tokens` — every spacing utility resolves to a token that exists.
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

export function checkTailwindTokens(repoRoot = process.cwd()) {
  const scale = spacingScale(repoRoot);
  const problems = [];

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

  const isValid = (value) =>
    value.startsWith('[') || scale.has(value) || ALWAYS_VALID.has(value) || FRACTION.test(value);

  for (const root of roots) {
    for (const file of sourceFiles(resolve(repoRoot, root))) {
      const code = withoutComments(readFileSync(file, 'utf8'));

      for (const region of classNameRegions(code)) {
        for (const [, utility, value] of region.matchAll(pattern)) {
          if (isValid(value)) continue;
          problems.push({
            file: relative(repoRoot, file).split('\\').join('/'),
            class: `${utility}-${value}`,
            message: explain(utility, value),
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
    process.stdout.write('tailwind-tokens: OK — every spacing utility resolves.\n');
  } else {
    process.stdout.write(`tailwind-tokens: ${problems.length} dead utility class(es)\n`);
    for (const problem of problems) {
      process.stdout.write(`  [${problem.class}] ${problem.file}\n      ${problem.message}\n`);
    }
    process.exitCode = 1;
  }
}
