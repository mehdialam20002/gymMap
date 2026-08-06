/**
 * M-006 · Integration — the `0_init` acceptance criteria, asserted against a REAL Postgres.
 *
 * These are the assertions that cannot be made against a file. `CREATE ROLE … NOBYPASSRLS` in a
 * migration is a claim; `SELECT rolbypassrls FROM pg_roles` is the fact. The gap between those
 * two is exactly where this milestone can go wrong, and running it once by hand proved the
 * point — three defects surfaced that no amount of reading the SQL had found:
 *
 *   1. `mc anonymous get` reports "private", not "none", so the kyc verification rejected a
 *      correctly-private bucket.
 *   2. `unnest(required) AS name` does not create a table named `unnest`, so the extension
 *      assertion raised "missing FROM-clause entry" and never ran at all.
 *   3. `ALTER DATABASE … SET lc_collate` is not a settable parameter; the statement logged an
 *      error and did nothing, while looking like it had handled collation.
 *
 * Requires the stack: `pnpm infra:up && pnpm --filter @gymmap/server db:deploy`.
 * Skips with a LOUD message rather than passing when the database is absent — a green run
 * against nothing is the failure mode this whole file exists to prevent.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const CONTAINER = 'gymmap-postgres';
const DB = 'gymmap';

/** Runs one SQL statement in the container and returns trimmed rows. */
function sql(statement: string): string[] {
  const out = execFileSync(
    'docker',
    ['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', DB, '-tAc', statement],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function one(statement: string): string {
  const rows = sql(statement);
  return rows[0] ?? '';
}

/** True when the statement raises — used for the domain counter-examples. */
function rejects(statement: string): boolean {
  try {
    execFileSync(
      'docker',
      ['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', DB, '-tAc', statement],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return false;
  } catch {
    return true;
  }
}

let available = false;

before(() => {
  try {
    one('SELECT 1');
    available = true;
  } catch {
    available = false;
    console.error(
      '\n  ┌────────────────────────────────────────────────────────────────────────┐\n' +
        '  │ SKIPPING the M-006 integration assertions — no database reachable.     │\n' +
        '  │                                                                        │\n' +
        '  │   pnpm infra:up                                                        │\n' +
        '  │   pnpm --filter @gymmap/server db:deploy                               │\n' +
        '  │                                                                        │\n' +
        '  │ These are the ONLY assertions that prove no role has BYPASSRLS.        │\n' +
        '  └────────────────────────────────────────────────────────────────────────┘\n',
    );
  }
});

const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    fn();
  });

// ---------------------------------------------------------------------------
// AC-2 — the single most important assertion in the milestone.
// ---------------------------------------------------------------------------

it('AC-2 · not one app_* role has BYPASSRLS (CI-03, RS3, PE1, AC-FND-01.2)', () => {
  assert.equal(
    one(`SELECT count(*) FROM pg_roles WHERE rolname LIKE 'app\\_%'`),
    '4',
    'expected exactly the four app_* roles',
  );

  // Asserted as a COUNT of offenders rather than by parsing each flag, because psql renders a
  // boolean as `f` when selected as a column and as `false` when concatenated into text. The
  // first version of this test compared against `f`, read `false`, and reported that every role
  // had BYPASSRLS — a false alarm on the most alarming assertion in the suite. Let the database
  // evaluate the predicate; never let a test depend on how a value is rendered.
  const offenders = sql(
    `SELECT rolname FROM pg_roles
     WHERE rolname LIKE 'app\\_%' AND (rolbypassrls OR rolsuper)
     ORDER BY rolname`,
  );
  assert.deepEqual(
    offenders,
    [],
    `${offenders.join(', ')} can bypass RLS. Every policy in the system becomes advisory: the ` +
      `query still runs, still returns rows, and returns ANOTHER TENANT'S rows — with nothing ` +
      `thrown and nothing logged. BR-TEN-01 breached at the one layer meant to be unbypassable.`,
  );

  const loginRoles = sql(
    `SELECT rolname FROM pg_roles WHERE rolname LIKE 'app\\_%' AND rolcanlogin ORDER BY rolname`,
  );
  assert.deepEqual(
    loginRoles,
    [],
    `${loginRoles.join(', ')} can log in. These are privilege SETS, not accounts — the ` +
      `application connects as a login role GRANTed one of them, so rotating a password never ` +
      `touches the privilege model and a leaked credential cannot change its own permissions.`,
  );
});

it('AC-2 · the four roles are exactly the expected four', () => {
  assert.deepEqual(
    sql(`SELECT rolname FROM pg_roles WHERE rolname LIKE 'app\\_%' ORDER BY rolname`),
    ['app_append', 'app_migrator', 'app_platform_ro', 'app_rw'],
  );
});

// ---------------------------------------------------------------------------
// AC-6 — R-M1: zero tables.
// ---------------------------------------------------------------------------

it('AC-6 · 0_init creates ZERO application tables (R-M1)', () => {
  const tables = sql(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`,
  );
  // `_prisma_migrations` is Prisma's own bookkeeping and `spatial_ref_sys` ships with PostGIS.
  // Neither is an application table; both are expected and neither is created by this migration.
  const application = tables.filter((t) => t !== '_prisma_migrations' && t !== 'spatial_ref_sys');
  assert.deepEqual(
    application,
    [],
    `0_init must create no application tables (R-M1). Found: ${application.join(', ')}`,
  );
});

it('AC-6 · 81 enum types, 460 values, 12 domains', () => {
  assert.equal(
    one(`SELECT count(*) FROM pg_type WHERE typtype='e' AND typnamespace='public'::regnamespace`),
    '81',
  );
  assert.equal(one('SELECT count(*) FROM pg_enum'), '460');
  assert.equal(
    one(`SELECT count(*) FROM pg_type WHERE typtype='d' AND typnamespace='public'::regnamespace`),
    '12',
  );
});

it('every extension 0_init requires is installed', () => {
  const installed = sql('SELECT extname FROM pg_extension ORDER BY extname');
  for (const required of [
    'postgis',
    'pg_trgm',
    'unaccent',
    'btree_gin',
    'btree_gist',
    'pgcrypto',
    'pg_stat_statements',
  ]) {
    assert.ok(installed.includes(required), `extension ${required} is not installed`);
  }
});

// ---------------------------------------------------------------------------
// AC-4 — every domain rejects its counter-example AND accepts a valid value.
//
// Both halves matter. A domain whose CHECK is so tight it rejects real data is as broken as one
// that accepts anything, and only the accept case catches that.
// ---------------------------------------------------------------------------

const DOMAIN_CASES: ReadonlyArray<[string, string, string, string]> = [
  ['pan_in', 'ABCDE1234', 'ABCDE1234F', 'PAN is five letters, four digits, one letter'],
  ['gstin_in', '27AAPFU0939F1Z', '27AAPFU0939F1ZV', 'GSTIN is exactly 15 characters'],
  ['phone_e164', '9876543210', '+919876543210', 'a bare 10-digit Indian number is not E.164'],
  ['iana_timezone', 'IST', 'Asia/Kolkata', '"IST" is ambiguous — India, Ireland and Israel'],
  ['financial_year_label', '2026', '2026-27', 'a bare year is ambiguous on 31 March'],
  ['currency_code', 'inr', 'INR', 'ISO-4217 is uppercase'],
  ['country_code', 'ind', 'IN', 'ISO-3166-1 alpha-2, uppercase'],
  ['slug', '-bad-', 'south-delhi-gym', 'no leading or trailing hyphen'],
  ['money_minor_nonneg', '-1', '50000', 'a negative price is always a bug'],
  ['basis_points', '-5', '1000', 'a negative rate is always a bug'],
  ['email_address', 'not-an-email', 'a@b.co', 'must have an @ and a dot'],
];

for (const [domain, bad, good, why] of DOMAIN_CASES) {
  it(`AC-4 · ${domain} rejects '${bad}' — ${why}`, () => {
    assert.ok(rejects(`SELECT '${bad}'::${domain}`), `${domain} accepted '${bad}'`);
    assert.ok(!rejects(`SELECT '${good}'::${domain}`), `${domain} wrongly rejected '${good}'`);
  });
}

it('AC-4 · money_minor accepts a negative amount — ledger entries carry direction in the sign', () => {
  // BR-FIN-01. The non-negative variant exists precisely because the base domain must not be.
  assert.ok(!rejects(`SELECT (-500)::money_minor`));
});

// ---------------------------------------------------------------------------
// AC-3 — the blanket revoke makes ABSENCE the default.
// ---------------------------------------------------------------------------

it('AC-3 · PUBLIC holds no table privilege anywhere in public', () => {
  assert.equal(
    one(
      `SELECT count(*) FROM information_schema.table_privileges
       WHERE grantee='PUBLIC' AND table_schema='public'`,
    ),
    '0',
  );
});

it('AC-3 · PUBLIC holds no type privilege either — the exception Postgres makes', () => {
  // CREATE TYPE and CREATE DOMAIN grant USAGE to PUBLIC implicitly, and `REVOKE ALL ON SCHEMA`
  // does not touch it. This asserted false on the first real run, while the migration's comment
  // claimed the opposite.
  assert.equal(
    one(
      `SELECT count(*) FROM information_schema.usage_privileges
       WHERE grantee='PUBLIC' AND object_schema='public' AND object_type='DOMAIN'`,
    ),
    '0',
  );
});

it('AC-3 · the application roles CAN use the domains', () => {
  assert.equal(
    one(
      `SELECT count(*) FROM information_schema.usage_privileges
       WHERE grantee='app_rw' AND object_schema='public' AND object_type='DOMAIN'`,
    ),
    '12',
  );
});

// ---------------------------------------------------------------------------
// AC-7 — the catalogue checks, wired now so they are not "added later".
// Both pass vacuously today. That is the point: they exist before the first table does.
// ---------------------------------------------------------------------------

it('AC-7 · CI-04 — every *_minor column is an integer type', () => {
  const offenders = sql(
    `SELECT table_name || '.' || column_name || ' is ' || data_type
     FROM information_schema.columns
     WHERE table_schema='public' AND column_name LIKE '%\\_minor'
       AND data_type NOT IN ('bigint','integer')
       AND domain_name IS DISTINCT FROM 'money_minor'
       AND domain_name IS DISTINCT FROM 'money_minor_nonneg'`,
  );
  assert.deepEqual(
    offenders,
    [],
    `BR-PAY-01: money is an integer count of minor units. Offenders: ${offenders.join(', ')}`,
  );
});

it('AC-7 · CI-05 — no "timestamp without time zone" anywhere', () => {
  const offenders = sql(
    `SELECT table_name || '.' || column_name FROM information_schema.columns
     WHERE table_schema='public' AND data_type='timestamp without time zone'`,
  );
  assert.deepEqual(
    offenders,
    [],
    `India is UTC+05:30 with no DST, so a naive timestamp is ambiguous the moment it crosses a ` +
      `process boundary. Offenders: ${offenders.join(', ')}`,
  );
});

it('the database is UTC and collates as C', () => {
  assert.equal(one('SHOW timezone'), 'UTC');
  assert.equal(one(`SELECT datcollate FROM pg_database WHERE datname=current_database()`), 'C');
});

after(() => {
  if (available) console.log('  M-006 integration assertions ran against a real PostgreSQL 16.');
});
