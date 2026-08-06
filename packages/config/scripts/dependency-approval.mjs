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
  'react-router-dom',
  // Node types — the runtime itself.
  '@types/node',
  // Workspace-internal.
  '@gymmap/',
];

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
