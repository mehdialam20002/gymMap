/**
 * M-007 · `module-structure` — a missing `index.ts`, a missing `README.md`, a forbidden
 * `services/` directory and a 24th module each fail with a DISTINCT message.
 *
 * The distinctness is the requirement, not a nicety. A gate that says "module structure invalid"
 * sends someone reading a 900-line specification to work out which of forty rules they broke.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  MODULES,
  FORBIDDEN_DIRECTORIES,
  README_HEADINGS,
  PROVIDER_ONLY,
  checkModuleStructure,
} from './module-structure.mjs';

/** Builds a throwaway repo whose structure is valid, so each test can break exactly one thing. */
function scaffold() {
  const root = mkdtempSync(join(tmpdir(), 'gymmap-modstruct-'));
  mkdirSync(join(root, 'apps/server/src'), { recursive: true });
  mkdirSync(join(root, 'docs/runbooks'), { recursive: true });

  const readme = (module) =>
    `# ${module}\n\n` + README_HEADINGS.map((h, i) => `## ${i + 1}. ${h}\n\nContent.\n`).join('\n');

  for (const module of MODULES) {
    mkdirSync(join(root, 'apps/server/src', module), { recursive: true });
    writeFileSync(join(root, 'apps/server/src', module, 'README.md'), readme(module));
    writeFileSync(join(root, 'docs/runbooks', `${module}.md`), `# ${module} runbook\n`);
  }
  return root;
}

function withRepo(fn) {
  const root = scaffold();
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const rules = (problems) => problems.map((p) => p.rule);

test('the baseline scaffold is clean — 23 READMEs and 23 runbooks, no source', () => {
  withRepo((root) => {
    assert.deepEqual(checkModuleStructure(root), []);
  });
});

test('§C1.3 — a 24th module fails, and says why', () => {
  withRepo((root) => {
    mkdirSync(join(root, 'apps/server/src/marketing'));
    const problems = checkModuleStructure(root);
    const found = problems.find((p) => p.rule === 'unknown-module');
    assert.ok(found, 'a 24th directory must fail');
    assert.equal(found.module, 'marketing');
    assert.match(found.message, /twenty-fourth|§C1\.3/);
    assert.match(found.message, /amendment/, 'must name the route to legitimising it');
  });
});

test('a missing module fails distinctly from an unknown one', () => {
  withRepo((root) => {
    rmSync(join(root, 'apps/server/src/reviews'), { recursive: true, force: true });
    const problems = checkModuleStructure(root);
    assert.ok(rules(problems).includes('missing-module'));
    assert.ok(!rules(problems).includes('unknown-module'));
  });
});

test('a missing README fails distinctly', () => {
  withRepo((root) => {
    rmSync(join(root, 'apps/server/src/plans/README.md'));
    const problems = checkModuleStructure(root);
    assert.deepEqual(rules(problems), ['missing-readme']);
    assert.equal(problems[0].module, 'plans');
  });
});

test('a README missing one of the nine headings names THAT heading', () => {
  withRepo((root) => {
    writeFileSync(
      join(root, 'apps/server/src/plans/README.md'),
      '# plans\n\n' +
        README_HEADINGS.filter((h) => h !== 'Consumed events')
          .map((h, i) => `## ${i + 1}. ${h}\n\nContent.\n`)
          .join('\n'),
    );
    const problems = checkModuleStructure(root);
    assert.deepEqual(rules(problems), ['readme-heading']);
    assert.match(problems[0].message, /Consumed events/);
  });
});

test('headings OUT OF ORDER fail — the order is the point', () => {
  withRepo((root) => {
    const reversed = [...README_HEADINGS].reverse();
    writeFileSync(
      join(root, 'apps/server/src/plans/README.md'),
      `# plans\n\n${reversed.map((h, i) => `## ${i + 1}. ${h}\n\nContent.\n`).join('\n')}`,
    );
    const problems = checkModuleStructure(root);
    assert.deepEqual(rules(problems), ['readme-heading']);
    assert.match(problems[0].message, /out of order/);
  });
});

test('NFR-MNT-09 — a missing runbook fails distinctly', () => {
  withRepo((root) => {
    rmSync(join(root, 'docs/runbooks/payments.md'));
    const problems = checkModuleStructure(root);
    assert.deepEqual(rules(problems), ['missing-runbook']);
    assert.match(problems[0].message, /NFR-MNT-09/);
    assert.match(problems[0].message, /3am/, 'must explain why a dangling link matters');
  });
});

test('§7.3.2 — a forbidden services/ directory fails distinctly', () => {
  withRepo((root) => {
    mkdirSync(join(root, 'apps/server/src/ordering/services'));
    const problems = checkModuleStructure(root);
    assert.deepEqual(rules(problems), ['forbidden-directory']);
    assert.match(problems[0].message, /§7\.3\.2/);
    assert.match(problems[0].message, /accept anything|unknowable/);
  });
});

test('every §7.3.2 name is actually rejected', () => {
  for (const forbidden of FORBIDDEN_DIRECTORIES) {
    withRepo((root) => {
      mkdirSync(join(root, 'apps/server/src/ordering', forbidden));
      const problems = checkModuleStructure(root);
      assert.ok(
        problems.some((p) => p.rule === 'forbidden-directory' && p.message.includes(forbidden)),
        `"${forbidden}" is in the forbidden list but was not rejected`,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// The conditional mandated set.
// ---------------------------------------------------------------------------

test('a module with NO source is not asked for index.ts — M-007 must be green', () => {
  withRepo((root) => {
    // Every module is README-only at this milestone. Demanding the full §8.1 set here would
    // make the gate red on the day it is written, and a permanently-red gate gets disabled.
    assert.deepEqual(checkModuleStructure(root), []);
  });
});

test('the moment a module ACQUIRES source, the full §8.1 set is required', () => {
  withRepo((root) => {
    writeFileSync(join(root, 'apps/server/src/plans/plan.controller.ts'), 'export class X {}\n');
    const problems = checkModuleStructure(root).filter((p) => p.module === 'plans');
    const messages = problems.map((p) => p.message).join('\n');

    assert.ok(problems.every((p) => p.rule === 'missing-mandated'));
    // `plans.module.ts`, not `plan.module.ts` — §8.1 row 2 is `<module>.module.ts` and the
    // module is `plans`. Getting this wrong in the spec first is exactly the confusion the
    // filename convention exists to prevent.
    for (const expected of [
      'index.ts',
      'application',
      'application/ports',
      'types',
      'plans.module.ts',
      'controllers/',
    ]) {
      assert.match(
        messages,
        new RegExp(expected.replace(/[/.]/g, '\\$&')),
        `${expected} not required`,
      );
    }
  });
});

test('§8.2 — the four provider-only modules are not asked for controllers/', () => {
  for (const module of PROVIDER_ONLY) {
    withRepo((root) => {
      const dir = join(root, 'apps/server/src', module);
      writeFileSync(join(dir, 'index.ts'), '');
      writeFileSync(join(dir, `${module}.module.ts`), '');
      mkdirSync(join(dir, 'application/ports'), { recursive: true });
      mkdirSync(join(dir, 'types'), { recursive: true });

      const problems = checkModuleStructure(root).filter((p) => p.module === module);
      assert.deepEqual(
        problems,
        [],
        `${module} is provider-only (§8.2) and must not be required to have controllers/`,
      );
    });
  }
});

test('a NON-provider-only module with source DOES need controllers/', () => {
  withRepo((root) => {
    const dir = join(root, 'apps/server/src/ordering');
    writeFileSync(join(dir, 'index.ts'), '');
    writeFileSync(join(dir, 'ordering.module.ts'), '');
    mkdirSync(join(dir, 'application/ports'), { recursive: true });
    mkdirSync(join(dir, 'types'), { recursive: true });

    const problems = checkModuleStructure(root).filter((p) => p.module === 'ordering');
    assert.equal(problems.length, 1);
    assert.match(problems[0].message, /controllers\//);
    assert.match(problems[0].message, /provider-only/, 'must name the exemption it does not have');
  });
});

test('the module list is exactly 23, sorted and unique', () => {
  // §C1.3: "not twenty-two, not twenty-four".
  assert.equal(MODULES.length, 23);
  assert.equal(new Set(MODULES).size, 23, 'duplicate module name');
  assert.deepEqual([...MODULES], [...MODULES].sort(), 'MODULES must be sorted');
});

test('every problem carries a module, a rule and a non-trivial message', () => {
  withRepo((root) => {
    mkdirSync(join(root, 'apps/server/src/ordering/utils'));
    rmSync(join(root, 'docs/runbooks/plans.md'));
    for (const problem of checkModuleStructure(root)) {
      assert.ok(problem.module, 'problem without a module');
      assert.match(problem.rule, /^[a-z-]+$/, 'rule must be a kebab-case slug');
      assert.ok(
        problem.message.length > 40,
        `rule "${problem.rule}" has a message too short to act on: ${problem.message}`,
      );
    }
  });
});
