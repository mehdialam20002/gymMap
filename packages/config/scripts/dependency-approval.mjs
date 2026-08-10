/**
 * M-007 · Every dependency must have an approved `A-NN` row in STACK_ADDITIONS.md.
 *
 * The standing rule: *"Any technology not in Part 1 (locked) or Part 2 (approved) of
 * STACK_ADDITIONS.md is unapproved and may not appear in code, in a package.json, or in an
 * infrastructure definition. A dependency present without a corresponding approved A-NN row is
 * a review blocker."*
 *
 * This is the mechanical half of that rule. Human review catches a new dependency in a small
 * diff; it does not catch one that arrives as a transitive promotion during an unrelated
 * refactor, six months later, in a 40-file pull request.
 *
 * Reported as a WARNING until M-008, and exits 0 accordingly. Two reasons, both about making
 * the rule stick: the register names technologies in prose ("Prisma", "TailwindCSS") rather
 * than npm package names, so matching is inherently fuzzy right now; and a gate that produces
 * false reds in its first week is a gate people learn to scroll past.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Package-name prefixes covered by an approved row. Prefixes rather than exact names because a
 * single approval legitimately brings a scope: A-06 approves Jest, and `@types/jest`,
 * `ts-jest` and `jest-environment-node` are that same decision.
 */
const APPROVED_PREFIXES = [
  // Part 1 — the locked stack.
  '@nestjs/',
  'reflect-metadata',
  'rxjs',
  'typescript',
  'express',
  '@types/express',
  // A-01, A-07 Prisma
  'prisma',
  '@prisma/',
  // A-02 Zod
  'zod',
  // A-03, A-04 Tailwind + shadcn
  'tailwindcss',
  '@tailwindcss/',
  'autoprefixer',
  'postcss',
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
  '@radix-ui/',
  'lucide-react',
  // A-05 pnpm + Turborepo
  'turbo',
  // A-06 test stack
  'jest',
  'ts-jest',
  '@types/jest',
  'supertest',
  '@types/supertest',
  'testcontainers',
  '@testcontainers/',
  '@playwright/',
  'playwright',
  'k6',
  'axe-core',
  '@axe-core/',
  // A-09 React Hook Form
  'react-hook-form',
  '@hookform/',
  // A-10 QR
  'qrcode',
  '@types/qrcode',
  '@zxing/',
  // A-12 argon2
  'argon2',
  // A-13 rate limiting
  'rate-limiter-flexible',
  // A-14 Pino
  'pino',
  'pino-http',
  'pino-pretty',
  'nestjs-pino',
  // A-15 Sentry
  '@sentry/',
  // A-16 Swagger
  '@nestjs/swagger',
  'swagger-ui-express',
  // A-17 Sharp
  'sharp',
  // A-18 AWS SDK v3
  '@aws-sdk/',
  '@smithy/',
  // A-20 CSV
  'papaparse',
  '@types/papaparse',
  // A-21..A-24 tooling
  'eslint',
  '@eslint/',
  'typescript-eslint',
  '@typescript-eslint/',
  'eslint-config-prettier',
  'eslint-plugin-',
  'prettier',
  'dependency-cruiser',
  'husky',
  'lint-staged',
  '@commitlint/',
  // A-29 size-limit
  'size-limit',
  '@size-limit/',
  // A-40 icon set. Per-icon imports only — the barrel pulls in every glyph, and a 1.2 MB
  // import in a bundle-budgeted app is how `NFR-PERF-10` is missed by one line nobody reads.
  '@phosphor-icons/react',
  // ┌─ A-41 animation library. THIS LINE WAS MISSING, AND THE GAP IS THE INTERESTING PART ──────┐
  // │ `A-41` has been `APPROVED` in STACK_ADDITIONS.md since the customer-web build, and this   │
  // │ gate reported `motion` as unapproved anyway — because this array is a SECOND list beside  │
  // │ the register, and the row was added to one and not the other.                              │
  // │                                                                                            │
  // │ A false positive is not a harmless gate. It is the mechanism by which a real one gets      │
  // │ waved through: a check that cries wolf is a check people learn to scroll past. The         │
  // │ `stackAdditionsDrift()` export below now fails the build when the two lists disagree, so   │
  // │ this class of gap is caught in the commit that creates it.                                  │
  // │                                                                                            │
  // │ Scoped to `customer-web` by the row itself; the two dashboards stay CSS-only. This array   │
  // │ cannot express "one workspace only" — that bound lives in the row and in review.            │
  // └────────────────────────────────────────────────────────────────────────────────────────────┘
  'motion',
  // A-30 Bull Board
  '@bull-board/',
  'bullmq',
  'ioredis',
  // Framework runtimes named in Part 1
  'next',
  'react',
  'react-dom',
  '@types/react',
  '@types/react-dom',
  'vite',
  '@vitejs/',
  '@tanstack/',
  /*
   * ┌─ NOT NAMED IN PART 1, AND IT SAT UNDER THE COMMENT THAT SAYS IT IS — TD-049 ───────────────┐
   * │ Part 1's row is `Dashboards (both) | React 18 + Vite + TypeScript (SPA)`. It names no       │
   * │ router. Neither does any A-NN row: the register runs A-01…A-30, A-40, A-41, A-42, and the   │
   * │ only "router" in the document is Next.js's App Router, which is the other application.      │
   * │                                                                                            │
   * │ So this line made `pnpm ci:deps-approved` print *"every dependency maps to an approved      │
   * │ A-NN row"* about a dependency that maps to none — a green gate is worse than no gate here,  │
   * │ because it converts an unreviewed choice into an apparently-reviewed one and the next       │
   * │ reader stops looking.                                                                       │
   * │                                                                                            │
   * │ Kept rather than deleted, deliberately. Deleting it turns CI red on a question only the     │
   * │ owner can answer, and `react-router-dom` v6 is very likely the answer — the two Vite        │
   * │ dashboards need a router and the slot is genuinely open. What was wrong was the SILENCE,    │
   * │ not the package. Remove this block and move the entry up when the A-NN row exists.          │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  'react-router-dom',
  // Node types — the runtime itself.
  '@types/node',
  // Workspace-internal.
  '@gymmap/',
];

/**
 * Every package named by an `APPROVED` row in `STACK_ADDITIONS.md` that this array does not cover.
 *
 * ┌─ WHY A DRIFT CHECK RATHER THAN DERIVING THE ARRAY FROM THE DOCUMENT ─────────────────────────┐
 * │ Deriving would be the reflex, and `error-code.ts` is the precedent for it: *"a hand-written  │
 * │ union beside a hand-written table is two lists that agree only until someone is in a hurry"*.│
 * │ It does not transfer here, because the array is NOT a copy of the register — it deliberately │
 * │ holds more than the rows name. `A-06` approves Jest, and `@types/jest`, `ts-jest` and        │
 * │ `jest-environment-node` are that same decision; no parser can infer that scope from prose.   │
 * │                                                                                              │
 * │ So the array stays hand-maintained for the scope it encodes, and this closes the direction   │
 * │ that actually bites: the register approves something and the gate has not heard. The other   │
 * │ direction — a prefix here with no row — is NOT checked, because the scope entries have no    │
 * │ row by construction.                                                                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function stackAdditionsDrift(repoRoot = process.cwd()) {
  const register = join(repoRoot, 'docs', 'engineering', 'STACK_ADDITIONS.md');
  if (!existsSync(register)) return [];

  const missing = [];
  for (const line of readFileSync(register, 'utf8').split('\n')) {
    // An APPROVED table row. `DEFERRED`, `PROPOSED` and `REJECTED` rows must NOT be covered.
    if (!/^\|\s*\*\*A-\d+\*\*/.test(line) || !/`APPROVED`/.test(line)) continue;

    const id = /\*\*(A-\d+)\*\*/.exec(line)?.[1] ?? 'A-??';
    const columns = line.split('|');
    const selection = columns[3] ?? '';

    /*
     * The selection is what the row puts in BOLD, and only that.
     *
     * ┌─ WHY BOLD RATHER THAN EVERY BACKTICKED TOKEN IN THE COLUMN ────────────────────────────┐
     * │ The selection column carries prose alongside the choice, and the prose is backticked    │
     * │ too. `A-41` reads: **`motion`** (the maintained successor to `framer-motion`),           │
     * │ `customer-web` ONLY. Scanning every token demands a prefix for `framer-motion` — the     │
     * │ package this one REPLACES — and for `customer-web`, which is a workspace. Both were      │
     * │ reported on the first run of this check.                                                  │
     * │                                                                                          │
     * │ The convention across every row is that the chosen thing is bold: **`sharp`**,           │
     * │ **AWS SDK v3 `@aws-sdk/client-s3`**, **`papaparse`**. Reading only inside `**…**` is     │
     * │ exact for that convention and silent for prose.                                           │
     * └──────────────────────────────────────────────────────────────────────────────────────────┘
     */
    for (const bold of selection.matchAll(/\*\*(.+?)\*\*/g)) {
      for (const token of bold[1].matchAll(/`([^`]+)`/g)) {
        const name = token[1].trim();
        // Must look like an npm name: lower-case, no spaces, optional scope. Keeps prose such as
        // `Postgres full-text` out without needing a stop-list.
        if (!/^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(name)) continue;
        if (APPROVED_PREFIXES.some((prefix) => name === prefix || name.startsWith(prefix)))
          continue;
        missing.push({ id, name });
      }
    }
  }
  return missing;
}

export function findUnapprovedDependencies(repoRoot = process.cwd()) {
  const unapproved = [];
  const manifests = [join(repoRoot, 'package.json'), ...workspaceManifests(repoRoot)];

  for (const manifest of manifests) {
    if (!existsSync(manifest)) continue;
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
    const where = manifest.slice(repoRoot.length + 1).replace(/\\/g, '/');

    for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
      for (const name of Object.keys(pkg[field] ?? {})) {
        if (APPROVED_PREFIXES.some((prefix) => name === prefix || name.startsWith(prefix)))
          continue;
        unapproved.push({ name, field, manifest: where });
      }
    }
  }
  return unapproved;
}

function workspaceManifests(repoRoot) {
  const out = [];
  for (const group of ['apps', 'packages']) {
    const dir = resolve(repoRoot, group);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) out.push(join(dir, entry.name, 'package.json'));
    }
  }
  return out;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
  /*
   * The drift check runs FIRST, and unlike the scan below it is not advisory.
   *
   * The scan is advisory because it can be wrong about a dependency (that is why it exits 0). This
   * cannot: it compares two lists inside this repository and reports only exact disagreements. A
   * missing prefix here is what makes the scan cry wolf, and a gate that cries wolf is the
   * mechanism by which a real finding gets scrolled past — `motion` sat mis-reported for the whole
   * customer-web build.
   */
  const drift = stackAdditionsDrift(process.cwd());
  if (drift.length > 0) {
    console.error(
      `dependency-approval: ${drift.length} APPROVED row(s) this gate does not know about\n`,
    );
    for (const d of drift)
      console.error(`  ${d.id} approves ${d.name}, absent from APPROVED_PREFIXES`);
    console.error(
      '\nSTACK_ADDITIONS.md and APPROVED_PREFIXES have drifted. The row is the decision; this ' +
        'array is how the gate learns of it. Add the prefix, with the A-NN id in a comment.\n',
    );
    process.exit(1);
  }

  const unapproved = findUnapprovedDependencies(process.cwd());
  if (unapproved.length === 0) {
    console.log('dependency-approval: OK — every dependency maps to an approved A-NN row.');
    process.exit(0);
  }
  console.warn(`dependency-approval: ${unapproved.length} dependency(ies) with no approved row\n`);
  for (const d of unapproved) {
    console.warn(`  ${d.name}  (${d.field} in ${d.manifest})`);
  }
  console.warn(
    '\nSTACK_ADDITIONS.md standing rule: substitution is forbidden, addition requires an ' +
      "approved A-NN row FIRST. Add the row and get the owner's approval, or remove the " +
      'dependency.\n' +
      'Exiting 0: advisory until M-008. See the header comment for why.',
  );
  process.exit(0);
}
