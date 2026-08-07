/**
 * CLI for the token CSS — `pnpm --filter @gymmap/ui tokens:build | tokens:check`.
 *
 * Runs under Node 22's native type stripping, so it imports the `.ts` sources directly rather
 * than a build output — `packages/ui` is consumed AS SOURCE by Next.js and Vite (see its
 * package.json) and has no `dist/` for this to read.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateTokensCss } from '../src/tokens/generate-css.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(HERE, '../src/tokens/tokens.css');

const mode = process.argv[2] ?? '--build';
const generated = generateTokensCss();

if (mode === '--check') {
  if (!existsSync(TARGET)) {
    console.error(
      'tokens: src/tokens/tokens.css does not exist. Run `pnpm --filter @gymmap/ui tokens:build`.',
    );
    process.exit(1);
  }
  const committed = readFileSync(TARGET, 'utf8');
  if (committed !== generated) {
    console.error(
      'tokens: the committed tokens.css does not match the TypeScript sources.\n\n' +
        '  Every token exists twice — once as TypeScript so the Tailwind preset, the density\n' +
        '  remap and the contrast proof can read it, and once as CSS so the browser can. A\n' +
        '  divergence means one component keeps the old value, which reads as a caching problem\n' +
        '  for about an hour.\n\n' +
        '  Fix: pnpm --filter @gymmap/ui tokens:build, and commit the result.\n',
    );
    process.exit(1);
  }
  const declarations = (generated.match(/--gm-/g) ?? []).length;
  console.log(`tokens: OK — tokens.css matches its sources (${declarations} declarations).`);
  process.exit(0);
}

writeFileSync(TARGET, generated, 'utf8');
console.log(
  `tokens: wrote src/tokens/tokens.css (${(generated.match(/--gm-/g) ?? []).length} declarations).`,
);
