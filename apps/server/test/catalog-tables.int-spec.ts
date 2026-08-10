/**
 * `M-031` · `gyms`, `branches` and `gym_amenities`, asserted against real PostgreSQL 16 + PostGIS.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * EVERY ASSERTION HERE IS ONE A UNIT TEST CANNOT MAKE
 *
 * The four constraints below and the radius behaviour are properties of the DATABASE. A repository
 * test with a mocked client proves the code calls what it meant to call; it cannot prove the
 * database refuses what it must refuse, and `Constraints.md` is emphatic that the refusal is the
 * control — *"a grant is the only control that holds when the application is the attacker"*, and
 * the same is true of a `CHECK`.
 *
 * ┌─ THE `geography` ASSERTION IS THE ONE WORTH READING ─────────────────────────────────────────┐
 * │ `ST_DWithin(geometry, point, 3000)` does not throw. It measures in DEGREES, so a 3 km search  │
 * │ silently becomes a roughly three-hundred-thousand-kilometre one and returns the whole         │
 * │ country. Nothing about that looks like a units bug from the application side — it reads as    │
 * │ a ranking problem, and it would be chased in the ranking code.                                 │
 * │                                                                                              │
 * │ So the test is a PAIR, and the second half is the one that bites: Pune is ~840 km from        │
 * │ Bengaluru, and a 3 km radius around Pune must return ZERO. Under `geometry` it returns one.   │
 * │ Asserting only the positive case would pass either way.                                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Every probe runs inside a transaction that is rolled back, and the fixtures use a fixed uuid
 * prefix so a crashed run leaves nothing behind that a later run would trip over.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const CONTAINER = 'gymmap-postgres';

const TENANT = '00000000-0000-4000-8000-00000031a001';
const GYM = '00000000-0000-4000-8000-00000031b001';

/** Not a real ISO country, so nothing here can collide with seeded `IN` reference data. */
const PROBE_COUNTRY = 'ZZ';

function psql(sql: string): { out: string; error: string } {
  try {
    return {
      out: execFileSync(
        'docker',
        /*
         * `ON_ERROR_STOP=1` is load-bearing, not hygiene.
         *
         * Without it psql reports the error on stderr and still EXITS 0, so `execFileSync` does
         * not throw, `error` comes back empty, and every "this must be refused" assertion below
         * reads its own success as a refusal that never happened. The first version of this file
         * omitted it and seven assertions passed vacuously — the same defect this repository
         * already hit once in `audit-correlation.int-spec.ts`.
         */
        // prettier-ignore
        ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', 'gymmap', '-tA', '-v', 'ON_ERROR_STOP=1'],
        { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
      ).trim(),
      error: '',
    };
  } catch (error) {
    const shell = error as { stdout?: string; stderr?: string };
    return { out: (shell.stdout ?? '').trim(), error: (shell.stderr ?? String(error)).trim() };
  }
}

/**
 * The fixtures every probe needs, as SQL to prepend inside the caller's transaction.
 *
 * Built fresh per probe and rolled back, rather than seeded once in `before`. Slower, and the
 * reason is that a shared fixture makes one probe's failure cascade into the next five — which is
 * how a single real defect gets reported as six and the actual one is guessed at.
 */
const FIXTURES = `
INSERT INTO countries (code, name, default_currency, calling_code, fy_start_month, is_active)
  VALUES ('${PROBE_COUNTRY}', 'Probeland', 'INR', '+99', 4, true);
INSERT INTO cities (country_code, name, slug, centroid, status, timezone)
  VALUES ('${PROBE_COUNTRY}', 'Bengaluru', 'probe-bengaluru',
          ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'LIVE', 'Asia/Kolkata');
INSERT INTO gym_categories (key, name, slug) VALUES ('probe-gym', 'Probe Gym', 'probe-gym');
INSERT INTO amenities (key, name, icon, display_group)
  VALUES ('probe-sauna', 'Sauna', 'thermometer', 'Facilities');
INSERT INTO tenants (id, legal_name, entity_type)
  VALUES ('${TENANT}', 'Probe Fitness Private Limited', 'COMPANY');
INSERT INTO gyms (id, tenant_id, name, slug, city_id, category_id)
  SELECT '${GYM}', '${TENANT}', 'Iron Temple', 'probe-iron-temple', c.id, g.id
  FROM cities c, gym_categories g
  WHERE c.slug = 'probe-bengaluru' AND g.key = 'probe-gym';
`;

/** One branch INSERT, with the caller overriding whichever column the probe is about. */
function branchInsert(over: Partial<Record<string, string>> = {}): string {
  const cols = {
    name: `'Indiranagar'`,
    lon: '77.6408',
    lat: '12.9784',
    is_primary: 'false',
    capacity: 'NULL',
    state_code: `'KA'`,
    /*
     * Written explicitly, because the column DEFAULTS to 'IN' and these fixtures live in 'ZZ'.
     *
     * The first version of this file omitted it and five branch probes failed on
     * `fk_branches__countries` — the foreign key doing exactly its job, on a value nothing in the
     * probe had created. Worth keeping the note: `NFR-DQ-06`'s whole argument is that an
     * unconstrained country code is a value nobody checks, and the test tripped over the check.
     */
    country_code: `'${PROBE_COUNTRY}'`,
    ...over,
  };
  return `INSERT INTO branches
    (tenant_id, gym_id, name, address_line1, city_id, state, state_code, postal_code,
     country_code, location, is_primary, capacity)
  SELECT '${TENANT}', '${GYM}', ${cols.name}, '100 Ft Road', c.id, 'Karnataka',
         ${cols.state_code}, '560038', ${cols.country_code},
         ST_SetSRID(ST_MakePoint(${cols.lon}, ${cols.lat}), 4326)::geography,
         ${cols.is_primary}, ${cols.capacity}
  FROM cities c WHERE c.slug = 'probe-bengaluru';`;
}

/** Runs `body` after the fixtures, inside a transaction that is always rolled back. */
function probe(body: string): { out: string; error: string } {
  return psql(`BEGIN;\n${FIXTURES}\n${body}\nROLLBACK;`);
}

/** The constraint or index a refused statement blamed, or `''` when it was accepted. */
function refusedBy(body: string): string {
  const { error } = probe(body);
  return /(?:uq|ck|fk)_[a-z_]+/.exec(error)?.[0] ?? '';
}

let available = false;

before(() => {
  available = /^1$/m.test(psql('SELECT 1;').out);
  if (!available) {
    console.error('\n  SKIPPING the M-031 catalogue assertions — no database. pnpm infra:up\n');
  }
});

const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    fn();
  });

// ═══════════════════════════════════════════════════════════════════════════
// AC-1 — RLS is enabled AND forced on all three, and on none of the reference tables
// ═══════════════════════════════════════════════════════════════════════════

it('AC-1 — the three tenant-owned tables have RLS enabled and FORCED', () => {
  const { out } = psql(`
    SELECT c.relname || ':' || c.relrowsecurity || c.relforcerowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('gyms', 'branches', 'gym_amenities')
    ORDER BY 1;`);

  /*
   * FORCE, not merely ENABLE, and the difference is the whole guarantee.
   *
   * ENABLE alone exempts the table OWNER from its own policies. Migrations run as the owner, and
   * so does anything that connects with those credentials — which means a policy that reads as
   * airtight is bypassed by the one connection most likely to be used in an incident.
   */
  // `-tA` renders a boolean as `true`/`false`, not psql's interactive `t`/`f`.
  assert.deepEqual(out.split('\n').sort(), [
    'branches:truetrue',
    'gym_amenities:truetrue',
    'gyms:truetrue',
  ]);
});

it('AC-1 — every one of the three carries BOTH policy halves', () => {
  const { out } = psql(`
    SELECT tablename || ':' || policyname || ':' ||
           (qual IS NOT NULL)::text || (with_check IS NOT NULL)::text
    FROM pg_policies
    WHERE tablename IN ('gyms', 'branches', 'gym_amenities')
      AND policyname LIKE '%tenant_isolation'
    ORDER BY 1;`);

  // A USING-only policy permits a cross-tenant INSERT the inserting tenant then cannot see, so
  // nothing looks wrong from either side and the row sits in another tenant's scope indefinitely.
  assert.deepEqual(out.split('\n').sort(), [
    'branches:rls_branches__tenant_isolation:truetrue',
    'gym_amenities:rls_gym_amenities__tenant_isolation:truetrue',
    'gyms:rls_gyms__tenant_isolation:truetrue',
  ]);
});

it('no policy anywhere in this milestone was written with missing_ok', () => {
  // `Constraints.md` §8.3: "missing_ok is false. It is never written." With it, an unset
  // app.tenant_id yields NULL, the comparison yields NULL, and the policy silently matches
  // nothing — a failure that looks exactly like "this tenant has no gyms yet".
  const { out } = psql(`
    SELECT count(*) FROM pg_policies
    WHERE tablename IN ('gyms', 'branches', 'gym_amenities')
      AND (qual LIKE '%true%' AND qual LIKE '%current_setting%');`);
  assert.equal(out, '0');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-7 — ck_gyms__no_hierarchy, and the three other CHECKs
// ═══════════════════════════════════════════════════════════════════════════

it('AC-7 — setting parent_gym_id fails LOUDLY', () => {
  // The point of the constraint. A developer reaching for a franchise "group" concept must get a
  // failure, not half a system quietly behaving as though hierarchy were supported.
  assert.equal(
    refusedBy(`UPDATE gyms SET parent_gym_id = id WHERE id = '${GYM}';`),
    'ck_gyms__no_hierarchy',
  );
});

it('a rating above 5.0 is refused', () => {
  assert.equal(
    refusedBy(`UPDATE gyms SET rating_avg = 5.5 WHERE id = '${GYM}';`),
    'ck_gyms__rating_range',
  );
});

it('a zero capacity is refused, and NULL capacity is accepted', () => {
  assert.equal(refusedBy(branchInsert({ capacity: '0' })), 'ck_branches__capacity_positive');
  assert.equal(refusedBy(branchInsert({ capacity: 'NULL' })), '', 'unknown capacity is legitimate');
});

it('a two-character name is accepted and a one-character name is not', () => {
  assert.equal(refusedBy(`UPDATE gyms SET name = 'Om' WHERE id = '${GYM}';`), '');
  assert.equal(
    refusedBy(`UPDATE gyms SET name = 'X' WHERE id = '${GYM}';`),
    'ck_gyms__name_length',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-3 — one primary per gym, by partial unique index rather than by trigger
// ═══════════════════════════════════════════════════════════════════════════

it('AC-3 — a second primary branch on the same gym is refused by the INDEX', () => {
  assert.equal(
    refusedBy(
      `${branchInsert({ is_primary: 'true' })}\n${branchInsert({ name: `'Koramangala'`, is_primary: 'true', lon: '77.6245', lat: '12.9352' })}`,
    ),
    'uq_branches__one_primary_per_gym',
  );
});

it('AC-3 — two NON-primary branches on the same gym are fine', () => {
  // The index must not have become a "one branch per gym" rule by accident.
  assert.equal(
    refusedBy(
      `${branchInsert()}\n${branchInsert({ name: `'Koramangala'`, lon: '77.6245', lat: '12.9352' })}`,
    ),
    '',
  );
});

it('AC-3 — a SOFT-DELETED primary does not occupy the slot forever', () => {
  /*
   * `WHERE is_primary AND deleted_at IS NULL`. Without the second clause a gym that closed and
   * reopened its flagship branch could never name a primary again, and the failure would surface
   * months later as an unexplained unique violation on an ordinary edit.
   */
  const body = `${branchInsert({ is_primary: 'true' })}
    UPDATE branches SET deleted_at = now() WHERE gym_id = '${GYM}';
    ${branchInsert({ name: `'Koramangala'`, is_primary: 'true', lon: '77.6245', lat: '12.9352' })}`;
  assert.equal(refusedBy(body), '');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-2 — geography, in metres. The negative half is the assertion that bites.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-2 — location is geography(Point,4326), not geometry', () => {
  const { out } = psql(`
    SELECT format_type(a.atttypid, a.atttypmod)
    FROM pg_attribute a
    WHERE a.attrelid = 'branches'::regclass AND a.attname = 'location';`);
  assert.equal(out, 'geography(Point,4326)');
});

it('AC-2 — ST_DWithin measures METRES: 3 km finds Bengaluru and excludes Pune', () => {
  const { out } = probe(`${branchInsert()}
    SELECT 'near=' || count(*) FILTER (
             WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(77.6408, 12.9784), 4326)::geography, 3000))
        || ' far=' || count(*) FILTER (
             WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(73.8567, 18.5204), 4326)::geography, 3000))
    FROM branches WHERE gym_id = '${GYM}';`);

  /*
   * Pune is about 840 km from Bengaluru. Under `geometry` the radius would be read as 3,000
   * DEGREES and `far` would be 1 — so this single assertion is what separates a correct radius
   * search from one that returns the entire country and reads as a ranking bug.
   */
  assert.match(out, /near=1 far=0/);
});

it('the GiST index on location exists and is GiST', () => {
  const { out } = psql(`
    SELECT amname FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_am am ON am.oid = ic.relam
    WHERE ic.relname = 'gix_branches__location';`);
  assert.equal(out, 'gist', 'a btree here would make every radius search a sequential scan');
});

// ═══════════════════════════════════════════════════════════════════════════
// The grants — the control that holds when the application is the attacker
// ═══════════════════════════════════════════════════════════════════════════

it('app_rw holds DELETE on gym_amenities and on NEITHER of the soft-deleted tables', () => {
  const { out } = psql(`
    SELECT table_name || ':' || string_agg(privilege_type, ',' ORDER BY privilege_type)
    FROM information_schema.role_table_grants
    WHERE grantee = 'app_rw' AND table_name IN ('gyms', 'branches', 'gym_amenities')
    GROUP BY table_name ORDER BY 1;`);

  // ADR-0024: DELETE is granted on no table carrying `deleted_at`. `gym_amenities` has none,
  // because a de-selected amenity destroys no history — Schema.md §2.7 names it as one of the
  // five G-CRUD-D tables.
  assert.deepEqual(out.split('\n').sort(), [
    'branches:INSERT,SELECT,UPDATE',
    'gym_amenities:DELETE,INSERT,SELECT,UPDATE',
    'gyms:INSERT,SELECT,UPDATE',
  ]);
});

it('app_platform_ro holds SELECT and nothing else on all three', () => {
  const { out } = psql(`
    SELECT DISTINCT privilege_type FROM information_schema.role_table_grants
    WHERE grantee = 'app_platform_ro'
      AND table_name IN ('gyms', 'branches', 'gym_amenities');`);
  // A reviewer's verdict is written through app_rw INSIDE the tenant. The platform role reads the
  // queue and never writes to it — an approval written from outside a tenant scope would carry no
  // tenant on its audit row.
  assert.equal(out, 'SELECT');
});

it('the five reference tables carry no RLS, and that is on the reviewed exemption list', () => {
  const { out } = psql(`
    SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relrowsecurity
      AND c.relname IN ('countries', 'cities', 'localities', 'gym_categories', 'amenities');`);
  // Schema.md §1.3 lists all five by name. RLS is the wrong control here rather than a missing
  // one: a policy keys off tenant_id, and Bengaluru is not owned by a gym.
  assert.equal(out, '0');
});

// ═══════════════════════════════════════════════════════════════════════════
// The foreign keys — the reason the reference tables had to be built first
// ═══════════════════════════════════════════════════════════════════════════

it('a gym cannot name a city that does not exist', () => {
  // NFR-DQ-06. Without this FK, `city_id uuid` is the free-text alternative with the type
  // system's blessing, and every city filter rests on a value nothing checks.
  assert.equal(
    refusedBy(
      `UPDATE gyms SET city_id = '00000000-0000-4000-8000-0000000000ff' WHERE id = '${GYM}';`,
    ),
    'fk_gyms__cities',
  );
});

it('a gym cannot name a category that does not exist', () => {
  assert.equal(
    refusedBy(
      `UPDATE gyms SET category_id = '00000000-0000-4000-8000-0000000000ff' WHERE id = '${GYM}';`,
    ),
    'fk_gyms__gym_categories',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// BLK-20 · state_code accepts both alphabets, and that is a CANARY, not a control
// ═══════════════════════════════════════════════════════════════════════════

it('BLK-20 — state_code accepts BOTH "27" and "MH". This is a canary.', () => {
  /*
   * ┌─ WHEN THIS TEST GOES RED, BLK-20 HAS BEEN DECIDED AND THIS FILE SHOULD BE UPDATED ─────────┐
   * │ Two rank-3 documents specify two different alphabets for the same column:                   │
   * │                                                                                              │
   * │   NUMERIC  SeedStrategy.md §3.6 seeds all 38 GST codes ("27" Maharashtra, "29" Karnataka)   │
   * │            and calls them "the 2-digit prefix of every GSTIN". Schema.md derives            │
   * │            tenants.state_code "from gstin when present". Gym.md:696 shows "27".              │
   * │   ALPHA    Marketplace.md:662, 1694, 1699 show "MH", "KA", "TG".                             │
   * │                                                                                              │
   * │ `ck_branches__state_code_shape` is `^[A-Z0-9]{2}$` and admits both. That is the conflict     │
   * │ procedure's step 1 violated — "do not implement both" — and it is recorded as BLK-20 rather  │
   * │ than tightened, because tightening it would be picking a side in code.                       │
   * │                                                                                              │
   * │ So this assertion does NOT say the constraint is right. It says the constraint is not a      │
   * │ control yet, and pins that fact where somebody will meet it. `state_code` is the place of    │
   * │ supply: it selects CGST+SGST versus IGST on every invoice the branch issues, and a wrong     │
   * │ value is corrected only by a credit note per document.                                        │
   * │                                                                                              │
   * │ WHEN BLK-20 RESOLVES: tighten the CHECK to the decided alphabet, turn the two `assert.equal` │
   * │ lines below into one acceptance and one refusal, and close BLK-20 in docs/PHASES.md.          │
   * └──────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  assert.equal(refusedBy(branchInsert({ state_code: `'27'` })), '', 'the GST numeric form');
  assert.equal(refusedBy(branchInsert({ state_code: `'MH'` })), '', 'the ISO alpha form');

  // What it DOES refuse, so the check is not simply inert.
  assert.equal(
    refusedBy(branchInsert({ state_code: `'m'` })),
    'ck_branches__state_code_shape',
    'a one-character code must still be refused',
  );
  assert.equal(
    refusedBy(branchInsert({ state_code: `'mh'` })),
    'ck_branches__state_code_shape',
    'lower case must still be refused — the shape check is doing something',
  );
});

it('BLK-20 — tenants.state_code has NO constraint at all, which Constraints.md specifies', () => {
  // `ck_tenants__state_code_matches_gstin` is specified and was never created. Asserted so the
  // gap is a failing expectation the day somebody adds it, rather than a thing nobody re-checks.
  const { out } = psql(`
    SELECT count(*) FROM pg_constraint WHERE conname = 'ck_tenants__state_code_matches_gstin';`);
  assert.equal(
    out,
    '0',
    'the constraint now exists — good. Update BLK-20, and give branches.state_code the same one.',
  );
});

it('the same gym cannot declare the same amenity twice', () => {
  const declare = `INSERT INTO gym_amenities (tenant_id, gym_id, amenity_id)
    SELECT '${TENANT}', '${GYM}', a.id FROM amenities a WHERE a.key = 'probe-sauna';`;
  assert.equal(refusedBy(`${declare}\n${declare}`), 'uq_gym_amenities__gym_amenity');
});
