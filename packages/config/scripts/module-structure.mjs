/**
 * M-007 · CI job 6 `module-structure` — FolderStructure.md §8.1, §7.3.2, §C1.3.
 *
 * Asserts the shape of `apps/server/src/`:
 *
 *   · EXACTLY 23 modules. §C1.3 is emphatic — "not twenty-two, not twenty-four". A 24th
 *     directory is a bounded context nobody agreed to, and it will grow a table.
 *   · Every module has a `README.md` with the nine §8.3 headings, in order.
 *   · Every module has a runbook at `docs/runbooks/<module>.md` (NFR-MNT-09).
 *   · No module contains a §7.3.2 forbidden directory name.
 *   · A module that has real source also has the §8.1 mandated file set.
 *
 * ┌─ WHY THE MANDATED FILE SET IS CONDITIONAL ─────────────────────────────────────────────┐
 * │ §8.1 marks `index.ts`, `<module>.module.ts`, `application/`, `types/` and the rest as   │
 * │ Mandatory. At M-007 no module has any code — they are directories holding a README, and │
 * │ their real files arrive with their own milestones.                                       │
 * │                                                                                          │
 * │ Asserting the full set now would make this job red on the day it is written, and a red   │
 * │ gate that everyone knows is "expected" is a gate that gets ignored and then disabled.    │
 * │ So the set is asserted for any module that has ACQUIRED source — the moment a module     │
 * │ contains a single `.ts` file, it must contain all of them. That makes the rule bite at   │
 * │ exactly the moment it can be satisfied, and it cannot be dodged: you cannot add a        │
 * │ controller without also adding index.ts, types/ and application/ports/.                  │
 * │                                                                                          │
 * │ The forbidden-directory rule is UNCONDITIONAL — it needs nothing to exist to be checked. │
 * └──────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** §C1.3 — the twenty-three bounded contexts. Not twenty-two, not twenty-four. */
export const MODULES = [
  'admin',
  'attendance',
  'audit',
  'billing',
  'catalog',
  'common',
  'crm',
  'discovery',
  'iam',
  'ledger',
  'memberships',
  'notifications',
  'onboarding',
  'ordering',
  'payments',
  'plans',
  'refunds',
  'reporting',
  'reviews',
  'settlements',
  'staff',
  'support',
  'tenancy',
];

/**
 * §7.3.2 — directory names that may never appear inside a module.
 *
 * Each is banned because it is a name that accepts anything. `services/` and `utils/` in
 * particular are where a bounded context goes to die: they have no definition, so every file
 * that does not obviously belong somewhere lands there, and within a year the module's actual
 * boundary is unknowable.
 */
export const FORBIDDEN_DIRECTORIES = [
  '__tests__', // §8.1: tests sit BESIDE their subject
  'routes', // Nest has controllers; a routes/ directory means an Express habit survived
  'services',
  'helpers',
  'utils',
  'models',
  'interfaces',
  'constants',
  'middleware',
  'entities',
  'lib',
  'core',
  'shared',
  'misc',
];

/** §8.3 — the nine README headings, in order. */
export const README_HEADINGS = [
  'Bounded context',
  'PRD identifiers',
  'Owned tables',
  'Public surface',
  'Consumed ports',
  'Emitted events',
  'Consumed events',
  'Jobs',
  'Top three failure modes',
];

/** §8.2 — the four provider-only modules. Exempt from `controllers/`, for four different reasons. */
export const PROVIDER_ONLY = ['common', 'tenancy', 'ledger', 'audit'];

/** §8.1 — required once a module has any source at all. */
const MANDATED_WHEN_SOURCED = [
  { path: 'index.ts', kind: 'file', why: '§8.1 row 1 — the module-public-api-only boundary' },
  { path: 'application', kind: 'dir', why: '§8.1 row 5 — use cases live here, not in controllers' },
  {
    path: 'application/ports',
    kind: 'dir',
    why: '§8.1 row 7 — dependencies are ports, not classes',
  },
  { path: 'types', kind: 'dir', why: '§8.1 row 17' },
];

export function checkModuleStructure(repoRoot = process.cwd()) {
  const problems = [];
  const srcRoot = resolve(repoRoot, 'apps/server/src');
  const runbookRoot = resolve(repoRoot, 'docs/runbooks');

  const fail = (module, rule, message) => problems.push({ module, rule, message });

  if (!existsSync(srcRoot)) {
    return [{ module: '(all)', rule: 'src-missing', message: `${srcRoot} does not exist` }];
  }

  const present = readdirSync(srcRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  // --- exactly 23, no more and no fewer ---------------------------------
  for (const extra of present.filter((name) => !MODULES.includes(name))) {
    fail(
      extra,
      'unknown-module',
      `"${extra}" is not one of the 23 modules of §C1.3. A twenty-fourth bounded context is a ` +
        `decision the architecture has not taken — and it will grow a table. Either it belongs ` +
        `inside an existing module, or §C1.3 needs an amendment under constitution §24 first.`,
    );
  }
  for (const missing of MODULES.filter((name) => !present.includes(name))) {
    fail(missing, 'missing-module', `module directory "${missing}" is missing`);
  }

  // --- per module --------------------------------------------------------
  for (const module of MODULES.filter((name) => present.includes(name))) {
    const moduleDir = join(srcRoot, module);

    // README with the nine headings, in order.
    const readmePath = join(moduleDir, 'README.md');
    if (!existsSync(readmePath)) {
      fail(module, 'missing-readme', `${module}/README.md is missing (§8.1 row 3, NFR-MNT-09)`);
    } else {
      const readme = readFileSync(readmePath, 'utf8');
      let searchFrom = 0;
      for (const heading of README_HEADINGS) {
        const at = readme.indexOf(heading, searchFrom);
        if (at === -1) {
          fail(
            module,
            'readme-heading',
            `${module}/README.md: §8.3 heading "${heading}" is missing or out of order. The nine ` +
              `headings are ordered because a reader scanning twenty-three modules must find the ` +
              `same thing in the same place each time.`,
          );
          break;
        }
        searchFrom = at + heading.length;
      }
    }

    // Runbook (NFR-MNT-09).
    const runbook = join(runbookRoot, `${module}.md`);
    if (!existsSync(runbook)) {
      fail(
        module,
        'missing-runbook',
        `docs/runbooks/${module}.md is missing. NFR-MNT-09 requires a runbook per module — ` +
          `README §9 links to it, and a dangling link at 3am is worse than no link.`,
      );
    }

    // Forbidden directory names — unconditional.
    for (const entry of readdirSync(moduleDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (FORBIDDEN_DIRECTORIES.includes(entry.name)) {
        fail(
          module,
          'forbidden-directory',
          `${module}/${entry.name}/ is forbidden by §7.3.2. Names like this accept anything, so ` +
            `every file that does not obviously belong somewhere lands there — and the module's ` +
            `real boundary becomes unknowable.`,
        );
      }
    }

    // Mandated file set — only once the module has source. See the header comment.
    if (hasSource(moduleDir)) {
      for (const required of MANDATED_WHEN_SOURCED) {
        const target = join(moduleDir, required.path);
        const ok =
          existsSync(target) &&
          (required.kind === 'dir' ? statSync(target).isDirectory() : statSync(target).isFile());
        if (!ok) {
          fail(
            module,
            'missing-mandated',
            `${module} has source but no ${required.path} (${required.why})`,
          );
        }
      }
      const moduleFile = join(moduleDir, `${module}.module.ts`);
      if (!existsSync(moduleFile)) {
        fail(module, 'missing-mandated', `${module}/${module}.module.ts is missing (§8.1 row 2)`);
      }
      if (!PROVIDER_ONLY.includes(module) && !existsSync(join(moduleDir, 'controllers'))) {
        fail(
          module,
          'missing-mandated',
          `${module} has source but no controllers/ (§8.1 row 4). Only common, tenancy, ledger ` +
            `and audit are provider-only, and each for a different documented reason (§8.2).`,
        );
      }
    }
  }

  return problems;
}

/** True when the module contains any `.ts` file at any depth — i.e. it is more than a README. */
function hasSource(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.ts')) return true;
    if (entry.isDirectory() && hasSource(join(dir, entry.name))) return true;
  }
  return false;
}

// --- CLI -------------------------------------------------------------------

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
  const problems = checkModuleStructure(process.cwd());
  if (problems.length === 0) {
    console.log(`module-structure: OK — ${MODULES.length} modules, all conforming.`);
    process.exit(0);
  }
  console.error(`module-structure: ${problems.length} problem(s)\n`);
  for (const p of problems) {
    console.error(`  [${p.rule}] ${p.module}`);
    console.error(`      ${p.message}\n`);
  }
  process.exit(1);
}
