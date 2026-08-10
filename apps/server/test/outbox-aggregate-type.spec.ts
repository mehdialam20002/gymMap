/**
 * `BLK-07` · `ADR-0045` · `TD-031` — `outbox_aggregate_type_enum` against the register that fixes it.
 *
 * ┌─ WHY THIS SUITE GREPS THE DOCUMENT INSTEAD OF RESTATING THE 26 ──────────────────────────────┐
 * │ `MG9`: an enum value is permanent. It can be added, never removed while a row holds it, and  │
 * │ never renamed. That is the whole reason the enum waited three weeks behind `BLK-07` — a set  │
 * │ transcribed slightly wrong is wrong in the catalogue for eight financial years, and no test  │
 * │ that restates the same 26 would ever notice, because it would drift with what it polices.    │
 * │                                                                                              │
 * │ So the source here is `docs/engineering/ERD.md` §6.1, parsed at run time, and the assertion  │
 * │ runs in BOTH directions: a root in the document and not the enum is an unreachable aggregate,│
 * │ and a value in the enum and not the document is a permanent value nobody chose.              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ AND WHY THE FILE IS NAMED IN FULL, EVERY TIME ──────────────────────────────────────────────┐
 * │ `BLK-07` existed for three weeks because a search ran against `docs/database/ERD.md`, whose  │
 * │ §6 is the **foreign-key inventory**, and concluded the register did not exist. It does —     │
 * │ in `docs/engineering/ERD.md`, whose §6 is **"The aggregate map"**. Two files share a name.   │
 * │ Nothing below says "ERD.md".                                                                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { AGGREGATE_TYPES } from '../dist/common/outbox/outbox.port.js';

function repoRoot(): string {
  let dir = process.cwd();
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`could not locate the repository root from ${process.cwd()}`);
}

const ROOT = repoRoot();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const ENGINEERING_ERD = 'docs/engineering/ERD.md';
const CONSTITUTION = 'docs/PROJECT_CONSTITUTION.md';
const MIGRATION =
  'apps/server/prisma/migrations/20260810200000_contract_alter_outbox_aggregate_type_to_enum/migration.sql';
const PRISMA = 'apps/server/prisma/schema.prisma';

/** §6.1's `| n | `Root` | …` rows, in the document's own order. Fails loudly on zero. */
function registerRoots(): string[] {
  const text = read(ENGINEERING_ERD);
  const start = text.indexOf('### 6.1 Aggregate composition');
  assert.notEqual(
    start,
    -1,
    `§6.1 is not in ${ENGINEERING_ERD} — the heading moved or was renamed`,
  );

  // The section ends where the "Six entities belong to no aggregate" paragraph begins.
  const end = text.indexOf('**Six entities belong to no aggregate', start);
  assert.notEqual(end, -1, '§6.1 no longer states which entities belong to no aggregate');

  const roots = [...text.slice(start, end).matchAll(/^\|\s*\d+\s*\|\s*`([A-Za-z]+)`/gm)].map(
    (m) => m[1]!,
  );

  assert.ok(roots.length > 0, '§6.1 parsed to zero roots — the table format changed');
  return roots;
}

/** The enum labels the migration creates, in the order it writes them. */
function migrationLabels(): string[] {
  const sql = read(MIGRATION);
  const block = /CREATE TYPE outbox_aggregate_type_enum AS ENUM \(([\s\S]*?)\);/.exec(sql);
  assert.ok(block, 'the migration no longer creates outbox_aggregate_type_enum');
  return [...block[1]!.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]!);
}

/** The Prisma enum's members, in declaration order. */
function prismaLabels(): string[] {
  const schema = read(PRISMA);
  const block = /enum OutboxAggregateTypeEnum \{([\s\S]*?)\n\}/.exec(schema);
  assert.ok(block, 'OutboxAggregateTypeEnum is not in schema.prisma');
  return block[1]!
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[A-Z][A-Za-z]*$/.test(line));
}

// ═══════════════════════════════════════════════════════════════════════════
// The register, and the two places it is reproduced.
// ═══════════════════════════════════════════════════════════════════════════

test('§6.1 holds exactly 26 aggregate roots — the number both citing documents give', () => {
  /*
   * `Schema.md` §2.5: *"one value per aggregate root of ERD.md §6 — 26 at Phase 1"*.
   * `Relationships.md` 714: *"the 26 aggregate roots of ERD.md §6.1"*.
   *
   * Both were recorded in `0_init` as WRONG citations. They are correct; they resolve to
   * `docs/engineering/ERD.md`. This asserts the count those two documents assert, so if §6.1
   * gains or loses a root, the two citations become stale HERE rather than silently.
   */
  assert.equal(registerRoots().length, 26);
});

test('the migration enum and §6.1 agree — in order, and in both directions', () => {
  // Order matters only as a review aid (a reviewer diffs two columns), but asserting the ARRAY
  // rather than the set costs nothing and catches a reordering that would make that diff useless.
  assert.deepEqual(
    migrationLabels(),
    registerRoots(),
    'the shipped enum and the aggregate map disagree. A value present here and absent there is ' +
      'permanent under MG9 and can never be withdrawn; a root there and not here is an aggregate ' +
      'whose events the outbox cannot carry.',
  );
});

test('the Prisma enum and the migration cannot drift apart', () => {
  // Two hand-maintained copies of one permanent list. Prisma does not generate this from the
  // database, so nothing but this assertion stops them diverging.
  assert.deepEqual(prismaLabels(), migrationLabels());
});

test('the DOMAIN union in outbox.port.ts is the same 26, in the same order', () => {
  /*
   * `DomainEvent.aggregateType` is this union rather than Prisma's `$Enums` type, because
   * `PROJECT_CONSTITUTION.md` §3.4.3 keeps ORM types out of ports — a port that imports `$Enums`
   * is a port that knows which database it has. The cost of that independence is one more copy,
   * and this is the assertion that makes the copy free.
   */
  assert.deepEqual([...AGGREGATE_TYPES], registerRoots());
});

test('no contained entity is reachable as an aggregate type — the KycDocument case', () => {
  /*
   * The concrete defect the enum exposed on the day it landed: `upload-kyc-document.use-case.ts`
   * emitted `aggregateType: 'KycDocument'`, which §6.1 row 2 lists among the entities CONTAINED
   * in `Application`. It satisfied the old PascalCase CHECK, and the port widened the field to
   * `string` one line before the call, so neither the database nor the compiler objected.
   *
   * A sample of contained entities rather than all of them: the deepEqual above already pins the
   * set exactly. This exists to name the failure MODE, so a reader who breaks it is told what
   * kind of mistake they made rather than being shown two long arrays that differ somewhere.
   */
  for (const contained of ['KycDocument', 'OrderItem', 'MembershipEvent', 'SettlementLine']) {
    assert.ok(
      !(AGGREGATE_TYPES as readonly string[]).includes(contained),
      `${contained} is contained in another aggregate (§6.1), so it is not a root. An event ` +
        `naming it hands consumers an aggregate they cannot load — rule A4 loads one whole.`,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// The two things the three-week deferral was actually afraid of.
// ═══════════════════════════════════════════════════════════════════════════

test('none of §6.1’s six no-aggregate entities became an enum value', () => {
  /*
   * `0_init`'s deferral note objected that a derived set *"includes rows that are plainly not
   * event-emitting aggregates — `outbox` itself, `audit_log`, `idempotency_keys`."* §6.1 answers
   * it by name: *"Six entities belong to no aggregate … platform infrastructure with no domain
   * invariant of their own."*
   *
   * Asserted as PascalCase singulars, because that is the shape a value would take if somebody
   * derived the set from the table list instead of reading the register — which is exactly the
   * derivation the note performed and rejected.
   */
  const forbidden = [
    'AuditLog',
    'Outbox',
    'IdempotencyKey',
    'NotificationLog',
    'ExportJob',
    'ReportDefinition',
  ];
  const labels = migrationLabels();
  for (const name of forbidden) {
    assert.ok(!labels.includes(name), `${name} is infrastructure, not an aggregate (§6.1)`);
  }
});

test('every aggregate root the CONSTITUTION names is present — rank 1 is a subset, not a rival', () => {
  /*
   * `PROJECT_CONSTITUTION.md` §4.3 (rank 1) names 18 roots; §6.1 (rank 3) names 26 and says so
   * openly: *"This section does what the constitution does not: it assigns all 76 entities to an
   * aggregate."* That is an elaboration and not a conflict — but only while the 18 are a SUBSET
   * of the 26. The moment rank 3 drops one of rank 1's, it stops elaborating and starts
   * overriding, which `CLAUDE.md` §2 forbids. This is the assertion that tells the difference.
   */
  const text = read(CONSTITUTION);
  const start = text.indexOf('## 4.3 Aggregates, aggregate roots and consistency boundaries');
  assert.notEqual(start, -1, '§4.3 moved or was renamed');
  const end = text.indexOf('### 4.3.1 Aggregate rules', start);

  const constitutionRoots = [...text.slice(start, end).matchAll(/^\|\s*\*\*`([A-Za-z]+)`\*\*/gm)]
    .map((m) => m[1]!)
    .filter((name) => name !== 'Aggregate');

  assert.equal(constitutionRoots.length, 18, '§4.3 no longer names eighteen roots');

  const labels = migrationLabels();
  for (const root of constitutionRoots) {
    assert.ok(
      labels.includes(root),
      `the constitution names ${root} an aggregate root and the enum omits it — rank 3 is now ` +
        `overriding rank 1 rather than completing it`,
    );
  }
});

test('the enum carries no duplicate, and every label is PascalCase', () => {
  // A duplicate is a `CREATE TYPE` failure rather than a silent one, so this is belt-and-braces —
  // but the PascalCase half is real: the shape the dropped `ck_outbox__aggregate_type` used to
  // enforce is now enforced by nothing except the label set itself.
  const labels = migrationLabels();
  assert.equal(new Set(labels).size, labels.length);
  for (const label of labels) assert.match(label, /^[A-Z][A-Za-z]{2,49}$/);
});
