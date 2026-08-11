/**
 * `M-031` · The branch WRITE statements, against real PostgreSQL — `Gym.md` §12.2, §12.3, §12.1.
 *
 * ┌─ EVERY STATEMENT HERE SHIPPED WITHOUT EVER HAVING RUN ───────────────────────────────────────┐
 * │ `create()`, `update()` and `list()` are raw SQL with PostGIS calls, `char(2)` casts, a        │
 * │ `CASE WHEN <sent>` per column and a two-column keyset predicate. `branch-mapper.spec.ts` and  │
 * │ the use-case specs assert everything AROUND them with doubles, and a double cannot tell you   │
 * │ that `state_code` needs a `::char(2)` or that `(name, id) > ($1, $2)` compares the way you    │
 * │ assumed.                                                                                       │
 * │                                                                                              │
 * │ Three properties in particular are database behaviour and nothing else:                        │
 * │                                                                                              │
 * │   the coordinate ORDER survives `ST_MakePoint(lng, lat)` → `ST_Y`/`ST_X` and comes back the    │
 * │     way it went in — a transposition is a valid point in the Norwegian Sea and no type check   │
 * │     anywhere catches it                                                                        │
 * │   `CASE WHEN false THEN … ELSE column END` LEAVES the column alone, which is the entire        │
 * │     mechanism separating "not sent" from "sent as null"                                        │
 * │   `cardinality('{}') = 0 OR gym_id = ANY('{}')` returns every row, where a bare `= ANY` on an  │
 * │     empty array returns none — an unfiltered list that silently shows an empty estate          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Every fixture is created and rolled back inside one transaction, so the suite leaves the database
 * exactly as it found it — `TD-041` already makes this one fragile enough.
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const CONTAINER = 'gymmap-postgres';

const TENANT = '0192de00-9200-7000-8000-0000000000f1';
const GYM = '0192de00-9200-7000-8000-0000000000f2';

/** Runs SQL and returns the result. Never throws — a refusal IS a result under test. */
function psql(sql: string): { ok: boolean; out: string; err: string } {
  try {
    const out = execFileSync(
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
    );
    return { ok: true, out: out.trim(), err: '' };
  } catch (error) {
    const shell = error as { stdout?: string; stderr?: string };
    return { ok: false, out: (shell.stdout ?? '').trim(), err: (shell.stderr ?? '').trim() };
  }
}

/**
 * `ON_ERROR_STOP=1` is on the psql invocation and not negotiable.
 *
 * `catalog-tables.int-spec.ts`'s first run omitted it and **seven "this must be refused"
 * assertions passed vacuously** — psql printed the error and exited 0. The same defect had already
 * happened in `audit-correlation.int-spec.ts`. Twice is a pattern; it is noted in every file that
 * shells out to psql.
 */
const withFixtures = (body: string): { ok: boolean; out: string; err: string } =>
  psql(`
BEGIN;
SET LOCAL app.tenant_id = '${TENANT}';
INSERT INTO tenants (id, legal_name, entity_type, status)
  VALUES ('${TENANT}', 'Branch Write Probe', 'COMPANY', 'DRAFT');
INSERT INTO gyms (id, tenant_id, name, slug, city_id, category_id, status)
  VALUES ('${GYM}', '${TENANT}', 'Probe Gym', 'probe-gym-write',
          (SELECT id FROM cities LIMIT 1), (SELECT id FROM gym_categories LIMIT 1), 'APPROVED');
${body}
ROLLBACK;
`);

/** `create()`'s statement, with its parameters as literals. */
const insertBranch = (name: string, lng: number, lat: number, primary: boolean): string => `
INSERT INTO branches (
  tenant_id, gym_id, name, address_line1, address_line2, city_id, locality_id,
  state, state_code, postal_code, country_code, location, geo_tolerance_metres,
  capacity, is_primary
) VALUES (
  current_setting('app.tenant_id')::uuid,
  '${GYM}'::uuid, '${name}', '1 Link Road', NULL,
  (SELECT id FROM cities LIMIT 1)::uuid, NULL::uuid,
  'Maharashtra', '27'::char(2), '400053', 'IN'::char(2),
  ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
  NULL, 250, ${primary}
);`;

let available = false;

before(() => {
  available = psql('SELECT 1;').ok;
  if (!available) console.error('\n  SKIPPING the M-031 branch-write assertions — no database.\n');
});

const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    fn();
  });

// ═══════════════════════════════════════════════════════════════════════════
// create() — Gym.md §12.2
// ═══════════════════════════════════════════════════════════════════════════

it('the INSERT runs, and tenant_id comes from the SESSION rather than a parameter', () => {
  /*
   * §11.5 `BR5`. `current_setting('app.tenant_id')::uuid` is in the VALUES list, so there is no
   * caller-chosen tenant to get wrong — and if the setting were missing the statement would raise
   * rather than writing a NULL or somebody else's id.
   */
  const result = withFixtures(`
    ${insertBranch('Andheri', 72.877, 19.076, true)}
    SELECT 'tenant=' || (tenant_id = '${TENANT}')::text FROM branches WHERE gym_id = '${GYM}';`);

  assert.equal(result.ok, true, result.err);
  assert.match(result.out, /tenant=true/);
});

it('the coordinate survives the round trip — ST_MakePoint(lng, lat) out through ST_Y/ST_X', () => {
  /*
   * THE assertion of this file. `ST_MakePoint` takes longitude first; `ST_Y` is latitude. Both
   * conventions are correct in their own world, and a transposition puts Mumbai's 19.076 N
   * 72.877 E at 72.877 N 19.076 E — the Norwegian Sea. A valid point, inside every range, which
   * is why no type, no CHECK and no reviewer catches it.
   *
   * `ST_AsText` compared exactly is the second half: the `::geometry` cast reinterprets the stored
   * point rather than reprojecting it, so nothing is lost at 4326.
   */
  const result = withFixtures(`
    ${insertBranch('Andheri', 72.877, 19.076, true)}
    SELECT 'lat=' || round(ST_Y(location::geometry)::numeric, 3)::text
        || ' lng=' || round(ST_X(location::geometry)::numeric, 3)::text
        || ' exact=' || (ST_AsText(location::geometry) = 'POINT(72.877 19.076)')::text
      FROM branches WHERE gym_id = '${GYM}';`);

  assert.equal(result.ok, true, result.err);
  assert.match(result.out, /lat=19\.076 lng=72\.877 exact=true/);
});

it('state_code and country_code fit char(2) — the casts are load-bearing', () => {
  // Both columns are `character`, not `text`. Without the `::char(2)` the driver binds text and
  // Postgres has to coerce; with a three-character value it refuses, which is the point.
  const result = withFixtures(`
    ${insertBranch('Andheri', 72.877, 19.076, true)}
    SELECT 'codes=' || state_code || '/' || country_code FROM branches WHERE gym_id = '${GYM}';`);

  assert.equal(result.ok, true, result.err);
  assert.match(result.out, /codes=27\/IN/);
});

it('an over-long state_code is REFUSED — and `::char(2)` would have truncated it', () => {
  /*
   * ┌─ THIS TEST CHANGED THE REPOSITORY, WHICH IS WHY IT IS WORTH READING ───────────────────────┐
   * │ `create()` originally bound `${stateCode}::char(2)`, and the first run of this assertion    │
   * │ failed: the insert SUCCEEDED. PostgreSQL treats the two forms differently —                  │
   * │                                                                                            │
   * │     '291'::char(2)                        →  '29', silently                                 │
   * │     INSERT '291' INTO a char(2) column     →  ERROR: value too long for type character(2)   │
   * │                                                                                            │
   * │ — an explicit cast to `bpchar(n)` truncates, an assignment refuses. `state_code` decides    │
   * │ **CGST + SGST versus IGST on every future invoice for a sale at this branch**, and `'291'`  │
   * │ becoming `'29'` is Karnataka: a real state, a legal code, and                                │
   * │ `ck_branches__state_code_shape` (`^[0-9]{2}$`) passes the truncated value without complaint.│
   * │                                                                                            │
   * │ The cast was removed. Both halves are asserted below so the fix cannot be undone quietly.   │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const refused = withFixtures(`
    INSERT INTO branches (tenant_id, gym_id, name, address_line1, city_id, state, state_code,
                          postal_code, country_code, location, is_primary)
    VALUES (current_setting('app.tenant_id')::uuid, '${GYM}'::uuid, 'X', '1 Road',
            (SELECT id FROM cities LIMIT 1), 'Maharashtra', '291', '400053', 'IN',
            ST_SetSRID(ST_MakePoint(72.877, 19.076), 4326)::geography, true);`);

  assert.equal(refused.ok, false, 'an over-long GST state code was accepted');
  assert.match(refused.err, /value too long for type character/);

  // And the control: the form that was there before still truncates, so the comment above stays
  // true rather than becoming folklore about a Postgres version nobody runs any more.
  const truncates = psql(`SELECT '291'::char(2);`);
  assert.equal(
    truncates.out,
    '29',
    'an explicit char(2) cast no longer truncates — re-read the fix',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// update() — the CASE WHEN <sent> mechanism
// ═══════════════════════════════════════════════════════════════════════════

it('CASE WHEN false leaves the column ALONE — this is what "not sent" means', () => {
  /*
   * The whole reason `update()` is one static statement rather than a built SET clause. If the
   * `ELSE column` branch did not preserve the value, every PATCH would blank every field the
   * client did not mention — a 200 response and a wiped row.
   */
  const result = withFixtures(`
    ${insertBranch('Andheri', 72.877, 19.076, true)}
    UPDATE branches SET
      name          = CASE WHEN true::boolean  THEN 'Andheri West' ELSE name          END,
      address_line1 = CASE WHEN false::boolean THEN NULL           ELSE address_line1 END,
      capacity      = CASE WHEN false::boolean THEN NULL           ELSE capacity      END,
      updated_at    = now()
     WHERE gym_id = '${GYM}'::uuid AND deleted_at IS NULL;
    SELECT 'name=' || name || ' addr=' || address_line1 || ' cap=' || capacity::text
      FROM branches WHERE gym_id = '${GYM}';`);

  assert.equal(result.ok, true, result.err);
  assert.match(result.out, /name=Andheri West addr=1 Link Road cap=250/);
});

it('CASE WHEN true THEN NULL CLEARS a nullable column — "sent as null"', () => {
  /*
   * The other half, and the reason `COALESCE(value, column)` was rejected: it cannot express this
   * at all. Under COALESCE an explicit null is indistinguishable from an absent field, so
   * `capacity` could never be unset once written.
   */
  const result = withFixtures(`
    ${insertBranch('Andheri', 72.877, 19.076, true)}
    UPDATE branches SET
      capacity   = CASE WHEN true::boolean THEN NULL ELSE capacity END,
      updated_at = now()
     WHERE gym_id = '${GYM}'::uuid AND deleted_at IS NULL;
    SELECT 'cleared=' || (capacity IS NULL)::text FROM branches WHERE gym_id = '${GYM}';`);

  assert.equal(result.ok, true, result.err);
  assert.match(result.out, /cleared=true/);
});

it('a location PATCH replaces the point and keeps the SRID', () => {
  const result = withFixtures(`
    ${insertBranch('Andheri', 72.877, 19.076, true)}
    UPDATE branches SET
      location = CASE WHEN true::boolean
                      THEN ST_SetSRID(ST_MakePoint(72.905, 19.117), 4326)::geography
                      ELSE location END
     WHERE gym_id = '${GYM}'::uuid AND deleted_at IS NULL;
    SELECT 'lat=' || round(ST_Y(location::geometry)::numeric, 3)::text
        || ' srid=' || ST_SRID(location::geometry)::text
      FROM branches WHERE gym_id = '${GYM}';`);

  assert.equal(result.ok, true, result.err);
  assert.match(result.out, /lat=19\.117 srid=4326/);
});

it('the UPDATE skips a soft-deleted row, so a concurrent close cannot be overwritten', () => {
  // `AND deleted_at IS NULL` in the WHERE. Without it a PATCH racing a DELETE would resurrect
  // fields on a closed branch and return 200 for a row nobody can see.
  const result = withFixtures(`
    ${insertBranch('Andheri', 72.877, 19.076, true)}
    UPDATE branches SET status = 'INACTIVE', is_primary = false, deleted_at = now()
     WHERE gym_id = '${GYM}'::uuid;
    UPDATE branches SET name = CASE WHEN true::boolean THEN 'Renamed' ELSE name END
     WHERE gym_id = '${GYM}'::uuid AND deleted_at IS NULL;
    SELECT 'name=' || name FROM branches WHERE gym_id = '${GYM}';`);

  assert.equal(result.ok, true, result.err);
  assert.match(result.out, /name=Andheri/, 'a soft-deleted branch was updated');
});

// ═══════════════════════════════════════════════════════════════════════════
// list() — the filter and keyset predicates
// ═══════════════════════════════════════════════════════════════════════════

it('an EMPTY gym filter returns every row, where a bare = ANY would return none', () => {
  /*
   * `cardinality($1) = 0 OR gym_id = ANY($1)`. The second half alone is false for every row when
   * the array is empty, so an unfiltered request would show an owner an empty estate — and look
   * exactly like a tenant with no branches.
   */
  /*
   * Compared against the table's own unfiltered count rather than a literal.
   *
   * The first version asserted `all=2`, which was true only while `branches` held nothing but this
   * probe's two rows. Seed `v0.6` then committed five, `tenancy.isolation-spec.ts` applies it as a
   * fixture, and the assertion started reporting `all=7` — a test that failed because the database
   * gained legitimate data. Self-referential is the fix: the guard's job is that the two counts
   * AGREE, whatever the number is.
   */
  const result = withFixtures(`
    ${insertBranch('Andheri', 72.877, 19.076, true)}
    ${insertBranch('Powai', 72.905, 19.117, false)}
    SELECT 'guarded=' || count(*)::text FROM branches
     WHERE deleted_at IS NULL
       AND (cardinality('{}'::uuid[]) = 0 OR gym_id = ANY('{}'::uuid[]));
    SELECT 'unfiltered=' || count(*)::text FROM branches WHERE deleted_at IS NULL;
    SELECT 'bare=' || count(*)::text FROM branches
     WHERE deleted_at IS NULL AND gym_id = ANY('{}'::uuid[]);
    SELECT 'probe=' || count(*)::text FROM branches WHERE gym_id = '${GYM}';`);

  assert.equal(result.ok, true, result.err);

  const guarded = /guarded=(\d+)/.exec(result.out)?.[1];
  const unfiltered = /unfiltered=(\d+)/.exec(result.out)?.[1];
  assert.equal(guarded, unfiltered, 'the empty-array guard did not return every row');

  // Non-vacuous: the probe's own two rows are in there, so the counts above are not both zero.
  assert.match(result.out, /probe=2/);

  // The control. If this ever reports anything but 0, the OR guard has stopped being necessary
  // and the comment above it has stopped being true.
  assert.match(result.out, /bare=0/);
});

it('the keyset predicate is TOTAL — two branches sharing a name still page correctly', () => {
  /*
   * `(name, id) > ($k, $i)` rather than `name > $k`. Branch names are not unique: a chain with
   * "Gym" in twenty cities is ordinary, and two "Andheri" branches in one gym is plausible.
   *
   * On the sort key alone, `>` skips every row sharing the boundary name and `>=` returns them
   * forever. Asserted by paging one row at a time through two identically-named branches.
   */
  const result = withFixtures(`
    ${insertBranch('Andheri', 72.877, 19.076, true)}
    ${insertBranch('Andheri', 72.905, 19.117, false)}
    SELECT 'page1=' || string_agg(name, ',') FROM (
      SELECT name, id FROM branches WHERE deleted_at IS NULL AND gym_id = '${GYM}'::uuid
       ORDER BY name ASC, id ASC LIMIT 1) a;
    SELECT 'page2=' || count(*)::text FROM branches
     WHERE deleted_at IS NULL AND gym_id = '${GYM}'::uuid
       AND (name, id) > ('Andheri'::text,
                         (SELECT id FROM branches WHERE gym_id = '${GYM}'::uuid
                           ORDER BY name ASC, id ASC LIMIT 1));
    SELECT 'naive=' || count(*)::text FROM branches
     WHERE deleted_at IS NULL AND gym_id = '${GYM}'::uuid AND name > 'Andheri';`);

  assert.equal(result.ok, true, result.err);
  assert.match(result.out, /page1=Andheri/);
  // The tuple comparison finds the second one.
  assert.match(result.out, /page2=1/);
  // And the naive predicate loses it entirely — which is the bug this shape prevents.
  assert.match(result.out, /naive=0/);
});

it('the status filter narrows and its NULL form does not', () => {
  const result = withFixtures(`
    ${insertBranch('Andheri', 72.877, 19.076, true)}
    ${insertBranch('Powai', 72.905, 19.117, false)}
    UPDATE branches SET status = 'INACTIVE' WHERE name = 'Powai' AND gym_id = '${GYM}'::uuid;
    SELECT 'unfiltered=' || count(*)::text FROM branches
     WHERE deleted_at IS NULL AND gym_id = '${GYM}'::uuid
       AND (NULL::text IS NULL OR status::text = NULL::text);
    SELECT 'active=' || count(*)::text FROM branches
     WHERE deleted_at IS NULL AND gym_id = '${GYM}'::uuid
       AND ('ACTIVE'::text IS NULL OR status::text = 'ACTIVE'::text);`);

  assert.equal(result.ok, true, result.err);
  assert.match(result.out, /unfiltered=2/);
  assert.match(result.out, /active=1/);
});

it('the list keeps INACTIVE branches and drops soft-deleted ones', () => {
  // `SCR-DASH-004` must still show the branch an owner closed last month; a soft-deleted row is
  // gone. The two are set together by a deactivation, so this separates them deliberately.
  const result = withFixtures(`
    ${insertBranch('Andheri', 72.877, 19.076, true)}
    ${insertBranch('Powai', 72.905, 19.117, false)}
    UPDATE branches SET status = 'INACTIVE' WHERE name = 'Powai' AND gym_id = '${GYM}'::uuid;
    SELECT 'inactive_kept=' || count(*)::text FROM branches
     WHERE deleted_at IS NULL AND gym_id = '${GYM}'::uuid;
    UPDATE branches SET deleted_at = now() WHERE name = 'Powai' AND gym_id = '${GYM}'::uuid;
    SELECT 'deleted_gone=' || count(*)::text FROM branches
     WHERE deleted_at IS NULL AND gym_id = '${GYM}'::uuid;`);

  assert.equal(result.ok, true, result.err);
  assert.match(result.out, /inactive_kept=2/);
  assert.match(result.out, /deleted_gone=1/);
});
