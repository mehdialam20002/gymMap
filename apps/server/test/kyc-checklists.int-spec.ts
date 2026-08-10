/**
 * `M-029` · `kyc_checklists` against real PostgreSQL — `FR-ONB-03`, `Schema.md` §12.3.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THESE ASSERTIONS CANNOT BE MADE ANYWHERE ELSE
 *
 * The resolver's unit tests prove that correct data resolves correctly. Every assertion here is
 * about what the DATABASE refuses, and none of it is observable from TypeScript:
 *
 *   · a jsonpath `CHECK` is evaluated by Postgres. A unit test asserting the same rule in code
 *     proves the code agrees with itself, and a row written by the seed, by a restore, or by the
 *     M-116 admin path never passes through that code at all
 *   · `uq_kyc_checklists__one_live_per_entity_type` is a PARTIAL unique index. Prisma cannot
 *     express one, so nothing in the ORM layer knows it exists
 *   · a GRANT is the only control that survives the application being wrong (`Schema.md` §10.3),
 *     and whether `app_rw` holds `UPDATE` is a `CI-02` build failure either way
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const CONTAINER = 'gymmap-postgres';

/** A structurally valid single-item checklist. Every probe below breaks exactly one thing in it. */
const VALID_ITEMS = JSON.stringify([
  { documentType: 'PAN', obligation: 'ALWAYS', displayOrder: 1, label: 'PAN card' },
]);

/** Not a real ISO country. Keeps every probe out of the seeded `IN` rows. */
const PROBE_COUNTRY = 'ZZ';

function psql(sql: string): { out: string; error: string } {
  try {
    return {
      out: execFileSync(
        'docker',
        [
          'exec',
          '-i',
          CONTAINER,
          'psql',
          '-U',
          'postgres',
          '-d',
          'gymmap',
          '-tA',
          '-v',
          'ON_ERROR_STOP=1',
        ],
        { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
      ).trim(),
      error: '',
    };
  } catch (error) {
    const shell = error as { stdout?: string; stderr?: string };
    return { out: (shell.stdout ?? '').trim(), error: (shell.stderr ?? String(error)).trim() };
  }
}

/** The constraint or index name a rejected INSERT blamed, or `''` if it was accepted. */
function refusedBy(items: string, country = PROBE_COUNTRY, version = 99): string {
  const { error } = psql(
    `INSERT INTO kyc_checklists (country_code, entity_type, version, items)
     VALUES ('${country}', 'COMPANY', ${String(version)}, '${items.replace(/'/g, "''")}'::jsonb);`,
  );
  return /(?:uq|ck)_kyc_checklists__[a-z_]+/.exec(error)?.[0] ?? '';
}

let available = false;

function cleanup(): void {
  psql(`DELETE FROM kyc_checklists WHERE country_code = '${PROBE_COUNTRY}';`);
}

before(() => {
  available = /^1$/m.test(psql('SELECT 1;').out);
  if (!available) {
    console.error('\n  SKIPPING the M-029 checklist assertions — no database. pnpm infra:up\n');
    return;
  }
  cleanup();
});

after(() => {
  if (available) cleanup();
});

/**
 * Every probe starts from an empty `ZZ`.
 *
 * Not tidiness. A probe that unexpectedly SUCCEEDS leaves a live row behind, and the next test to
 * insert a `ZZ` row then fails against `uq_kyc_checklists__one_live_per_entity_type` — reporting a
 * uniqueness failure for a test about something else entirely, three tests away from the real
 * problem. That cascade is exactly how this file first read.
 */
const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    cleanup();
    fn();
  });

// ═══════════════════════════════════════════════════════════════════════════
// CONTROL — the probe itself works
// ═══════════════════════════════════════════════════════════════════════════

it('CONTROL — a well-formed checklist is ACCEPTED', () => {
  // Without this every assertion below is vacuous: a probe rejected for an unrelated reason —
  // a bad enum literal, a missing column — would read as a constraint doing its job.
  assert.equal(refusedBy(VALID_ITEMS), '', 'a valid checklist was refused');
  cleanup();
});

// ═══════════════════════════════════════════════════════════════════════════
// The jsonpath constraints — Schema.md §11's "a JSONB column used to avoid
// designing a schema is a review rejection"
// ═══════════════════════════════════════════════════════════════════════════

it('items must be a non-empty array', () => {
  // ┌─ THE CONSTRAINT NAME IS NOT PINNED HERE, AND THAT IS DELIBERATE ───────────────────────────┐
  // │ `{}` violates several of these constraints at once — it is not an array, it has no          │
  // │ documentType, and it contains no ALWAYS PAN — and PostgreSQL does not promise WHICH of      │
  // │ several failing CHECKs it reports. Pinning one name makes the test fail when a later        │
  // │ migration adds an unrelated constraint. What must hold is that the row is not storable.     │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  for (const notAChecklist of ['{}', '[]', '"PAN"', '3']) {
    assert.match(
      refusedBy(notAChecklist),
      /^ck_kyc_checklists__/,
      `${notAChecklist} was accepted as a checklist`,
    );
  }
});

it('an item missing documentType, obligation, displayOrder or label is refused', () => {
  const pan = { documentType: 'PAN', obligation: 'ALWAYS', displayOrder: 1, label: 'PAN' };

  for (const omitted of ['documentType', 'obligation', 'displayOrder', 'label'] as const) {
    // A second, otherwise-complete item loses exactly one key. The valid PAN row sits alongside it
    // so that `ck_kyc_checklists__pan_is_always` cannot be what fires — the refusal has to be
    // attributable to the missing key and to nothing else.
    const incomplete: Record<string, unknown> = {
      documentType: 'GSTIN',
      obligation: 'ALWAYS',
      displayOrder: 2,
      label: 'GSTIN',
    };
    delete incomplete[omitted];

    assert.equal(
      refusedBy(JSON.stringify([pan, incomplete])),
      'ck_kyc_checklists__items_have_required_keys',
      `an item with no ${omitted} was not refused for that reason`,
    );
  }
});

it('an unknown obligation is refused — three values, not free text', () => {
  const items = JSON.stringify([
    { documentType: 'PAN', obligation: 'ALWAYS', displayOrder: 1, label: 'PAN' },
    { documentType: 'GSTIN', obligation: 'MANDATORY', displayOrder: 2, label: 'GSTIN' },
  ]);
  assert.equal(refusedBy(items), 'ck_kyc_checklists__items_obligation_known');
});

it('a CONDITIONAL item with no condition is refused', () => {
  // Required of everybody while claiming not to be — the worst of both, and invisible until
  // somebody reads the rendered checklist and wonders why every applicant is asked for it.
  const items = JSON.stringify([
    { documentType: 'PAN', obligation: 'ALWAYS', displayOrder: 1, label: 'PAN' },
    { documentType: 'GSTIN', obligation: 'CONDITIONAL', displayOrder: 2, label: 'GSTIN' },
  ]);
  assert.equal(refusedBy(items), 'ck_kyc_checklists__conditional_has_condition');
});

it('PAN must be ALWAYS, and this constraint is load-bearing for the GSTIN cross-check', () => {
  // ┌─ WHY THE DATABASE ENFORCES A RULE THAT LOOKS LIKE POLICY ──────────────────────────────────┐
  // │ `gstin.vo.ts` skips the embedded-PAN cross-check when no PAN is supplied, and justifies it  │
  // │ with "the checklist, not this function, is what makes PAN mandatory". That reasoning is     │
  // │ only sound while it is true. A checklist version demoting PAN to CONDITIONAL would turn a   │
  // │ documented non-hole into a real one — in DATA, with no code change for anybody to review.   │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const noPan = JSON.stringify([
    { documentType: 'BANK_PROOF', obligation: 'ALWAYS', displayOrder: 1, label: 'Bank proof' },
  ]);
  assert.equal(refusedBy(noPan), 'ck_kyc_checklists__pan_is_always');

  const demoted = JSON.stringify([
    {
      documentType: 'PAN',
      obligation: 'CONDITIONAL',
      displayOrder: 1,
      label: 'PAN',
      condition: { taxRegistrationStatusIn: ['REGISTERED'] },
    },
  ]);
  assert.equal(refusedBy(demoted), 'ck_kyc_checklists__pan_is_always');
});

it('version must be positive', () => {
  const { error } = psql(
    `INSERT INTO kyc_checklists (country_code, entity_type, version, items)
     VALUES ('${PROBE_COUNTRY}', 'COMPANY', 0, '${VALID_ITEMS}'::jsonb);`,
  );
  assert.match(error, /ck_kyc_checklists__version_positive/);
});

// ═══════════════════════════════════════════════════════════════════════════
// The partial unique index — Prisma cannot express it, so nothing else knows
// ═══════════════════════════════════════════════════════════════════════════

it('a SECOND live version for one country and entity type is refused', () => {
  // The resolver reads "the live checklist". Two live rows would make that query return whichever
  // the planner reached first — a checklist that differs between two page loads, with no error.
  assert.equal(refusedBy(VALID_ITEMS, PROBE_COUNTRY, 1), '', 'the first version was refused');
  assert.equal(
    refusedBy(VALID_ITEMS, PROBE_COUNTRY, 2),
    'uq_kyc_checklists__one_live_per_entity_type',
  );
  cleanup();
});

it('superseding the live version lets the next one in', () => {
  // The positive control. An index that refused version 2 unconditionally would pass the test
  // above and make publishing a new checklist impossible, which is the opposite of FR-ADMN-06.
  assert.equal(refusedBy(VALID_ITEMS, PROBE_COUNTRY, 1), '');

  const { error } = psql(
    `BEGIN;
     UPDATE kyc_checklists SET superseded_at = now()
       WHERE country_code = '${PROBE_COUNTRY}' AND entity_type = 'COMPANY' AND version = 1;
     INSERT INTO kyc_checklists (country_code, entity_type, version, items)
       VALUES ('${PROBE_COUNTRY}', 'COMPANY', 2, '${VALID_ITEMS}'::jsonb);
     COMMIT;`,
  );
  assert.equal(error, '', `superseding then publishing failed: ${error}`);
  cleanup();
});

it('the seeded India rows are one live version each, per entity type', () => {
  const live = psql(
    `SELECT entity_type || ':' || version FROM kyc_checklists
     WHERE country_code = 'IN' AND superseded_at IS NULL ORDER BY entity_type;`,
  ).out;

  assert.deepEqual(
    live
      .split('\n')
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
    ['COMPANY:1', 'OTHER:1', 'PARTNERSHIP:1', 'SOLE_PROPRIETOR:1'],
  );
});

it('every seeded India checklist carries the ten documents of §6', () => {
  const counts = psql(
    `SELECT jsonb_array_length(items) FROM kyc_checklists WHERE country_code = 'IN';`,
  ).out;
  assert.deepEqual(counts.split('\n').filter(Boolean), ['10', '10', '10', '10']);
});

// ═══════════════════════════════════════════════════════════════════════════
// Grants — G-COMPLETE, per ADR-0040. BLK-15 is closed.
// ═══════════════════════════════════════════════════════════════════════════

it('ADR-0040 — app_rw appends and may close a version, nothing more', () => {
  /*
   * ┌─ THIS ASSERTED THE HOLDING POSITION, AND BLK-15 IS NOW CLOSED ──────────────────────────────┐
   * │ M-029 granted `SELECT` only — the intersection of the two readings — rather than pick a      │
   * │ side. `Schema.md` §1.3 reads this table `G-REF` (which grants `UPDATE`), §12.3 reads it      │
   * │ `G-APPEND` (which forbids it), and both are rank 3.                                           │
   * │                                                                                              │
   * │ `ADR-0040` resolves it without amending either, because the two protect different things:    │
   * │ §12.3 protects the PAYLOAD, §1.3 protects the WRITE PATH. And superseding is itself an        │
   * │ `UPDATE` — `superseded_at` is a column here — so under pure `G-APPEND` §12.3's own            │
   * │ versioning model could never be executed.                                                      │
   * └──────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const grants = psql(
    `SELECT grantee || '=' || string_agg(privilege_type, ',' ORDER BY privilege_type)
       FROM information_schema.role_table_grants
      WHERE table_name = 'kyc_checklists' AND grantee IN ('app_rw', 'app_platform_ro', 'app_append')
      GROUP BY grantee ORDER BY grantee;`,
  ).out;

  /*
   * `INSERT,SELECT` at the TABLE level, and no `UPDATE` — which is not a mistake.
   *
   * `information_schema.role_table_grants` does not report a COLUMN-scoped grant. The `UPDATE`
   * exists and works; it lives in `column_privileges` and is asserted by the next test. Worth
   * knowing, because a reviewer checking only this view would conclude the completion write was
   * never granted, and a reviewer checking only the class name would conclude it was granted on
   * everything. Both need looking at, so both are here.
   */
  assert.deepEqual(grants.split('\n').filter(Boolean), [
    'app_platform_ro=SELECT',
    'app_rw=INSERT,SELECT',
  ]);
});

it('ADR-0040 — the UPDATE is column-scoped: items and version are unreachable', () => {
  /*
   * The summary above says `UPDATE`, which on its own would be `G-REF` and would let one
   * application edit a version another already cited. The COLUMN LIST is the whole control, so it
   * is asserted against the catalogue directly rather than inferred from the class name.
   *
   * Same technique as `D-03` on `applications.snapshot`, for the reason §2.7 opens with: a grant
   * is the only control that holds when the application itself is the attacker.
   */
  const columns = psql(
    `SELECT string_agg(column_name, ',' ORDER BY column_name)
       FROM information_schema.column_privileges
      WHERE table_name = 'kyc_checklists' AND grantee = 'app_rw' AND privilege_type = 'UPDATE';`,
  ).out;

  assert.equal(columns, 'superseded_at,updated_at,updated_by');
});

it('the table has no tenant_id, which is what its RLS exemption rests on', () => {
  // `reference-exemption.int-spec.ts` PC2 makes the same assertion across every exempt table.
  // Repeated here because this is the milestone that could introduce one, and the exemption
  // silently becomes a cross-tenant leak the moment it does.
  const columns = psql(
    `SELECT count(*) FROM information_schema.columns
      WHERE table_name = 'kyc_checklists' AND column_name = 'tenant_id';`,
  ).out;
  assert.equal(columns, '0');
});

// ═══════════════════════════════════════════════════════════════════════════
// ERD.md §2176 — the templated_by foreign key
// ═══════════════════════════════════════════════════════════════════════════

it('a checklist version cited by a KYC document cannot be deleted', () => {
  // RESTRICT, the same guarantee §9.6 makes about application snapshots: an application judged
  // against version 1 must be able to show which version that was, years later.
  const rule = psql(
    `SELECT confdeltype FROM pg_constraint WHERE conname = 'fk_kyc_documents__kyc_checklists';`,
  ).out;
  assert.equal(rule, 'r', 'the FK is not ON DELETE RESTRICT');
});

it('CI-07 — the foreign-key column is indexed', () => {
  // Without an index the RESTRICT check on the parent side is a sequential scan of every KYC
  // document in the platform, on a table that only ever grows.
  const indexed = psql(
    `SELECT count(*) FROM pg_indexes
      WHERE tablename = 'kyc_documents' AND indexname = 'idx_kyc_documents__kyc_checklist_id';`,
  ).out;
  assert.equal(indexed, '1');
});
