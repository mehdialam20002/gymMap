/**
 * `M-023` · `AC-4` — every one of §B3.2's 504 cells, checked against the PRD ITSELF.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THIS READS THE DOCUMENT, NOT A COPY OF IT
 *
 * `AC-4` asks that "adding a capability or a role regenerates the suite, and a hand-edited
 * generated file fails lint", and the obvious reading is a code generator: walk
 * `CAPABILITY_MATRIX`, emit one `test()` per cell, commit the output, add a byte-for-byte check
 * that nobody edited it.
 *
 * That suite would assert that a constant equals itself. Generated from the matrix, it can only
 * ever agree with the matrix — including agreeing with a typo in it. Five hundred and four green
 * assertions, all of them tautologies, and the ONE thing worth knowing left unchecked.
 *
 * So the table is parsed out of `MASTER_PRD.md` and compared to the code. That is a real
 * cross-check, and it is the precedence rule expressed as a test: the PRD is rank 2, code is
 * rank 5, so where they disagree the code is what is wrong (`CLAUDE.md` §2).
 *
 * It also satisfies `AC-4` more completely than a generator would. There is no generated file, so
 * "a hand-edited generated file fails" is not a gate that has to be built and remembered — adding
 * a row to the PRD adds its twelve assertions on the next run, and deleting the code's row makes
 * them fail. The failure mode the acceptance criterion was written to prevent cannot occur.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CAPABILITY_MATRIX } from '../dist/iam/permissions.js';
import { PLATFORM_ROLES } from '../dist/iam/types/iam.types.js';
import type { MatrixGrant, PlatformRole } from '../dist/iam/types/iam.types.js';

// Relative to the working directory, matching `env-example-parity.spec.ts`. `import.meta.dirname`
// reads as the more careful choice and is not available: this package builds to CommonJS, so
// `tsc` rejects the meta-property outright (TS1470).
const PRD = resolve('../../docs/MASTER_PRD.md');

/**
 * §B3.2's column headers, in the order the table prints them, mapped to the role names the code
 * uses. The table abbreviates to keep twelve columns readable; the code cannot.
 *
 * Written out rather than fuzzy-matched. A prefix match would quietly pair `MANAGER` with
 * `GYM_MANAGER` today and with a future `BRANCH_MANAGER` tomorrow, and the whole point of this
 * file is that a silent mis-pairing is the bug it exists to catch.
 */
const COLUMN_TO_ROLE: readonly (readonly [string, PlatformRole])[] = [
  ['VISITOR', 'VISITOR'],
  ['USER', 'USER'],
  ['MEMBER', 'MEMBER'],
  ['RECEPT', 'RECEPTIONIST'],
  ['TRAINER', 'TRAINER'],
  ['MANAGER', 'GYM_MANAGER'],
  ['OWNER', 'GYM_OWNER'],
  ['SUPPORT', 'SUPPORT_AGENT'],
  ['VERIF', 'VERIFICATION_OFFICER'],
  ['FINANCE', 'FINANCE'],
  ['MODER', 'MODERATOR'],
  ['S.ADMIN', 'SUPER_ADMIN'],
];

/** The legend, verbatim from the line above the table: `● full · ▪ own/assigned only · ○ read only · — none`. */
const GLYPH_TO_GRANT: Readonly<Record<string, MatrixGrant>> = {
  '●': 'FULL',
  '▪': 'OWN',
  '○': 'READ',
  '—': 'NONE',
};

interface ParsedRow {
  readonly capability: string;
  readonly cells: readonly string[];
}

/**
 * Pulls the §B3.2 table out of the PRD.
 *
 * Deliberately strict. A lenient parser that skipped rows it did not understand would turn a
 * renamed heading or a reformatted table into a suite that checks nothing and still passes — the
 * exact failure this file is supposed to make impossible. Every step that could find nothing
 * throws instead.
 */
function parseMatrixFromPrd(): { header: readonly string[]; rows: readonly ParsedRow[] } {
  const markdown = readFileSync(PRD, 'utf8');

  const start = markdown.indexOf('### B3.2 Permission matrix');
  assert.notEqual(start, -1, '§B3.2 is no longer in MASTER_PRD.md under that heading');

  // To the next heading of the same or higher level, so a `####` inside the section cannot end it.
  const rest = markdown.slice(start + 1);
  const nextHeading = rest.search(/\n#{1,3} /);
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);

  const lines = section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'));

  assert.ok(lines.length > 2, 'the §B3.2 table has no rows — has it stopped being a table?');

  const cellsOf = (line: string): string[] =>
    line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());

  const [headerLine, separatorLine, ...bodyLines] = lines as [string, string, ...string[]];

  assert.match(separatorLine, /^\|[\s:|-]+\|$/, 'the row after the header is not an alignment row');

  const header = cellsOf(headerLine).slice(1); // drop the "Capability" corner
  const rows = bodyLines.map((line) => {
    const cells = cellsOf(line);
    return { capability: cells[0] ?? '', cells: cells.slice(1) };
  });

  return { header, rows };
}

const { header, rows } = parseMatrixFromPrd();

test('the PRD table still has the twelve columns this file knows how to read', () => {
  // If the PRD gains a role, this fails FIRST and by name, rather than as 42 confusing cell
  // mismatches in a column that shifted one place to the left.
  assert.deepEqual(
    header,
    COLUMN_TO_ROLE.map(([column]) => column),
    'the §B3.2 column headers changed. Update COLUMN_TO_ROLE — and check whether a role was added',
  );

  // And every platform role appears exactly once, so no role can be silently unrepresented.
  const mapped = COLUMN_TO_ROLE.map(([, role]) => role);
  assert.equal(new Set(mapped).size, mapped.length, 'a role is mapped from two columns');
  assert.deepEqual(
    [...mapped].sort(),
    [...PLATFORM_ROLES].sort(),
    'the columns and PLATFORM_ROLES describe different sets of roles',
  );
});

test('the code carries exactly the capabilities the PRD lists, in the same order', () => {
  // Order matters here even though nothing reads it: the two are meant to be diffable by eye
  // (`CapabilityDefinition.capability` is documented as "the §B3.2 row label, verbatim"), and a
  // reordering is how a reviewer stops being able to check them side by side.
  assert.deepEqual(
    CAPABILITY_MATRIX.map((entry) => entry.capability),
    rows.map((row) => row.capability),
    'the capability rows in permissions.ts no longer match §B3.2 — the PRD wins (CLAUDE.md §2)',
  );
});

test('AC-4 — all 504 cells agree with §B3.2', () => {
  const mismatches: string[] = [];
  let checked = 0;

  for (const row of rows) {
    const definition = CAPABILITY_MATRIX.find((entry) => entry.capability === row.capability);
    if (!definition) continue; // reported by the test above; not repeated 12 times here

    assert.equal(
      row.cells.length,
      COLUMN_TO_ROLE.length,
      `"${row.capability}" has ${String(row.cells.length)} cells, expected ${String(COLUMN_TO_ROLE.length)}`,
    );

    COLUMN_TO_ROLE.forEach(([column, role], index) => {
      const glyph = row.cells[index] ?? '';
      const expected = GLYPH_TO_GRANT[glyph];

      // An unrecognised glyph is a parse failure, not a cell to skip. Skipping it would make the
      // count drop silently, which the total below is here to catch — but naming it is kinder.
      assert.ok(
        expected,
        `"${row.capability}" / ${column}: ${JSON.stringify(glyph)} is not one of the four legend glyphs`,
      );

      const actual = definition.grants[role];
      checked += 1;
      if (actual !== expected) {
        mismatches.push(
          `${row.capability} / ${column} (${role}): PRD says ${glyph} (${expected}), code says ${actual}`,
        );
      }
    });
  }

  assert.deepEqual(mismatches, [], `§B3.2 and permissions.ts disagree:\n  ${mismatches.join('\n  ')}`);

  // ┌─ THE COUNT IS AN ASSERTION, NOT A LOG LINE ─────────────────────────────────────────────┐
  // │ Every check above is inside a loop over rows parsed from a document. If the parse returns │
  // │ nothing, the loop body never runs and a suite that verifies NOTHING reports success —      │
  // │ which is the most expensive way for a test file like this to fail.                         │
  // │                                                                                          │
  // │ 42 capabilities × 12 roles. The roadmap says 516 cells; §B3.2 has 42 rows, and the PRD is │
  // │ rank 2 to the roadmap's rank 4, so 504 is the number that is true.                         │
  // └──────────────────────────────────────────────────────────────────────────────────────────┘
  assert.equal(checked, 504, `expected 504 cells, checked ${String(checked)}`);
});

test('every capability row names at least one permission key', () => {
  // A row with neither a read nor a write key is in the matrix but reachable by nothing: the
  // guard would find no permission to require and the capability would be undeniable in practice.
  const orphans = CAPABILITY_MATRIX.filter(
    (entry) => entry.readKey === null && entry.writeKey === null,
  ).map((entry) => entry.capability);

  assert.deepEqual(orphans, [], `capabilities with no permission key at all: ${orphans.join(', ')}`);
});

test('a READ-only cell never resolves to a write permission', () => {
  // ○ means read only. If such a role were granted the capability's `writeKey`, the matrix would
  // say "read" and the runtime would permit a mutation — the kind of divergence that survives
  // review because the table looks right.
  const violations: string[] = [];

  for (const entry of CAPABILITY_MATRIX) {
    if (entry.writeKey === null) continue;
    for (const [column, role] of COLUMN_TO_ROLE) {
      if (entry.grants[role] === 'READ' && entry.readKey === null) {
        violations.push(
          `${entry.capability} / ${column}: granted READ but the capability has no readKey, ` +
            `so the only key it could resolve to is the write half (${entry.writeKey})`,
        );
      }
    }
  }

  assert.deepEqual(violations, [], violations.join('\n  '));
});
