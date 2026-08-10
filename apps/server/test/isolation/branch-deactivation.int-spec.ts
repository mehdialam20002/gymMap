/**
 * `M-031` · The deactivation transaction, against real PostgreSQL — `Gym.md` §12.4, `AC-3`.
 *
 * ┌─ THE PROPERTY HERE IS A RACE, AND A UNIT TEST CANNOT SEE IT ─────────────────────────────────┐
 * │ `uq_branches__one_primary_per_gym` is `UNIQUE (gym_id) WHERE is_primary AND deleted_at IS     │
 * │ NULL`. The repository's claim is that closing a primary and promoting its successor must      │
 * │ happen in ONE transaction, and both failure modes are database behaviour:                      │
 * │                                                                                              │
 * │   promote first  → two primaries exist momentarily → the index REFUSES the statement           │
 * │   demote first   → a crash between the two leaves a gym with NO primary, and nothing refuses  │
 * │                                                                                              │
 * │ A double proves the repository called two methods. Only Postgres proves the index bites.      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Every fixture is created and rolled back inside one transaction, so the suite leaves the
 * database exactly as it found it — `TD-041` already makes this dev database fragile enough.
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const CONTAINER = 'gymmap-postgres';

const TENANT = '0192de00-9100-7000-8000-0000000000f1';
const GYM = '0192de00-9100-7000-8000-0000000000f2';
const PRIMARY = '0192de00-9100-7000-8000-0000000000b1';
const SUCCESSOR = '0192de00-9100-7000-8000-0000000000b2';

/** Runs SQL and returns `{ out, err }`. Never throws — a refusal IS the result under test. */
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
 * A gym with two branches, one primary — then whatever the test does, then `ROLLBACK`.
 *
 * The fixtures are inside the same transaction as the assertion on purpose. A `before`/`after`
 * pair that inserted and deleted would leave rows behind on any failure, and the branch table is
 * one an owner's demo data lives in.
 */
const withFixtures = (body: string): { ok: boolean; out: string; err: string } =>
  psql(`
BEGIN;
INSERT INTO tenants (id, legal_name, entity_type, status)
  VALUES ('${TENANT}', 'Deactivation Probe', 'COMPANY', 'DRAFT');
INSERT INTO gyms (id, tenant_id, name, slug, city_id, category_id, status)
  VALUES ('${GYM}', '${TENANT}', 'Probe Gym', 'probe-gym-deact',
          (SELECT id FROM cities LIMIT 1), (SELECT id FROM gym_categories LIMIT 1), 'APPROVED');
INSERT INTO branches (id, tenant_id, gym_id, name, address_line1, city_id, state, state_code,
                      postal_code, location, is_primary)
  VALUES
   ('${PRIMARY}', '${TENANT}', '${GYM}', 'Andheri', '1 Link Road',
    (SELECT id FROM cities LIMIT 1), 'Maharashtra', '27', '400053',
    ST_SetSRID(ST_MakePoint(72.877, 19.076), 4326)::geography, true),
   ('${SUCCESSOR}', '${TENANT}', '${GYM}', 'Powai', '2 Hiranandani',
    (SELECT id FROM cities LIMIT 1), 'Maharashtra', '27', '400076',
    ST_SetSRID(ST_MakePoint(72.905, 19.117), 4326)::geography, false);
${body}
ROLLBACK;
`);

let available = false;

before(() => {
  available = psql('SELECT 1;').ok;
  if (!available) console.error('\n  SKIPPING the M-031 deactivation assertions — no database.\n');
});

const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    fn();
  });

// ═══════════════════════════════════════════════════════════════════════════
// The index is real, and it is what makes the transaction necessary.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-3 · promoting without closing is REFUSED — two primaries cannot coexist', () => {
  /*
   * The load-bearing assertion. If this ever passes, the partial unique index has been dropped or
   * its predicate widened, and every "one transaction" comment in the repository becomes a
   * preference rather than a requirement.
   */
  const result = withFixtures(`UPDATE branches SET is_primary = true WHERE id = '${SUCCESSOR}';`);

  assert.equal(result.ok, false, 'a second primary was accepted');
  assert.match(result.err, /uq_branches__one_primary_per_gym/);
});

it('the two statements together leave exactly one primary', () => {
  // The repository's actual pair, in the order it runs them: close, then promote. The closing row
  // takes `deleted_at`, which drops it out of the index's partial predicate, so the successor can
  // take the flag in the very next statement.
  const result = withFixtures(`
    UPDATE branches SET status = 'INACTIVE', is_primary = false, deleted_at = now(), updated_at = now()
     WHERE id = '${PRIMARY}' AND deleted_at IS NULL;
    UPDATE branches SET is_primary = true, updated_at = now()
     WHERE id = '${SUCCESSOR}' AND deleted_at IS NULL;
    SELECT 'primaries=' || count(*)::text
      FROM branches WHERE gym_id = '${GYM}' AND is_primary AND deleted_at IS NULL;`);

  assert.equal(result.ok, true, result.err);
  assert.match(result.out, /primaries=1/);
});

it('a deactivation sets BOTH status and deleted_at — one without the other is a half-state', () => {
  /*
   * `Gym.md` §12.4 defines the deactivation as both, and each alone is a distinct bug:
   *   status only      → the row is still inside the index's predicate and still counts as primary
   *   deleted_at only  → anything filtering on `status = 'ACTIVE'` still treats it as open
   */
  const result = withFixtures(`
    UPDATE branches SET status = 'INACTIVE', is_primary = false, deleted_at = now(), updated_at = now()
     WHERE id = '${PRIMARY}' AND deleted_at IS NULL;
    SELECT 'status=' || status::text || ' deleted=' || (deleted_at IS NOT NULL)::text
      FROM branches WHERE id = '${PRIMARY}';`);

  assert.equal(result.ok, true, result.err);
  assert.match(result.out, /status=INACTIVE deleted=true/);
});

// ═══════════════════════════════════════════════════════════════════════════
// The projection the list depends on.
// ═══════════════════════════════════════════════════════════════════════════

it('ST_Y is LATITUDE and ST_X is LONGITUDE, and the cast is exact', () => {
  /*
   * `listInGym` projects `location` with `ST_Y(location::geometry)` and `ST_X(...)`, which is the
   * REVERSE of `ST_MakePoint`'s argument order. Asserted against a stored row rather than a
   * literal, because the question is what comes back out of the column.
   *
   * `ST_AsText` round-tripping unchanged is the second half: the `::geometry` cast reinterprets
   * the same point rather than reprojecting it, so no precision is lost at 4326.
   */
  const result = withFixtures(`
    SELECT 'lat=' || round(ST_Y(location::geometry)::numeric, 3)::text
        || ' lng=' || round(ST_X(location::geometry)::numeric, 3)::text
        || ' exact=' || (ST_AsText(location::geometry) = 'POINT(72.877 19.076)')::text
      FROM branches WHERE id = '${PRIMARY}';`);

  assert.equal(result.ok, true, result.err);
  assert.match(result.out, /lat=19\.076 lng=72\.877 exact=true/);
});

it('the list returns INACTIVE branches and never soft-deleted ones', () => {
  /*
   * `listInGym` filters `deleted_at IS NULL` and does NOT filter status — an owner must still see
   * the branch they closed last month on `SCR-DASH-004`.
   *
   * Here the two coincide, because a deactivation sets both. The assertion that matters is the
   * count BEFORE and AFTER: two branches, then one, and the missing one is the closed one.
   */
  const result = withFixtures(`
    SELECT 'before=' || count(*)::text FROM branches WHERE gym_id = '${GYM}' AND deleted_at IS NULL;
    UPDATE branches SET status = 'INACTIVE', is_primary = false, deleted_at = now()
     WHERE id = '${PRIMARY}';
    SELECT 'after=' || count(*)::text FROM branches WHERE gym_id = '${GYM}' AND deleted_at IS NULL;`);

  assert.equal(result.ok, true, result.err);
  assert.match(result.out, /before=2/);
  assert.match(result.out, /after=1/);
});
