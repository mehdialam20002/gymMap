/**
 * M-015 · The RLS-exempt list is EXACTLY the reviewed set — `RS4`, `BR4`, `PC2`, `§C2.3`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE CONVERSE IS THE ASSERTION THAT MATTERS
 *
 * "Every tenant-owned table has RLS" is the obvious check, and it is the weaker half. The
 * dangerous direction is the other one: a table that is EXEMPT and should not be.
 *
 * An exemption is invisible. Nothing errors, no query fails, and the table simply returns every
 * row to every caller. It reads as a table that "does not have tenant data" right up until
 * somebody adds a `tenant_id` column to it — at which point the exemption silently becomes a
 * cross-tenant leak, and the commit that caused it touched a migration, not a policy.
 *
 * So this diffs `pg_class` against a COMMITTED list. A new table is exempt only if somebody
 * added it here, in a reviewed file, with a reason.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

let available = false;

function psql(sql: string): string {
  try {
    return execFileSync(
      'docker',
      [
        'exec',
        '-i',
        'gymmap-postgres',
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
    ).trim();
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    return `${e.stdout ?? ''}\n${e.stderr ?? ''}`.trim();
  }
}

function rows(sql: string): string[] {
  return psql(sql)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Every table permitted to have NO row-level security, with the reason.
 *
 * `§C2.3` names eleven reference tables; none of them exists yet, so the list today holds only
 * the two the toolchain creates. Each entry is a decision somebody made, not a table that was
 * overlooked — and that is the whole difference between this file and a `SELECT`.
 */
interface Exemption {
  readonly table: string;
  readonly reason: string;
  /**
   * Set ONLY where the table legitimately carries a `tenant_id` and still has no policy.
   *
   * Every other exemption rests on "there is no tenant data here", and `PC2` below enforces
   * that by reading the schema. This flag says the exemption rests on something else, and it
   * is capped at exactly one table by `PC2-IDENTITY`. A boolean rather than an absence, so
   * granting it is a visible edit rather than a column somebody forgot to add.
   */
  readonly tenantIdReviewed?: true;
}

const EXEMPT: readonly Exemption[] = [
  {
    table: '_prisma_migrations',
    reason:
      'Prisma Migrate owns it and connects as app_migrator. It holds no business data and no ' +
      'tenant_id, and RLS on it would make a migration unable to record that it ran.',
  },
  {
    table: 'spatial_ref_sys',
    reason:
      'PostGIS reference data — the EPSG projection catalogue. Created by CREATE EXTENSION, ' +
      'identical in every installation on earth, and read by ST_Transform on every geography ' +
      'query. It is public knowledge, not tenant data.',
  },

  // ── M-019 · Schema.md §1.3 IDENTITY class ────────────────────────────────────────────────
  //
  // Not "reference data" like the two above — a different reason entirely, and the distinction
  // is worth keeping visible. These hold the most sensitive data in the platform. They are
  // exempt because RLS is the WRONG CONTROL for them, not because the data is public.
  {
    table: 'users',
    reason:
      'IDENTITY class (Schema.md §1.3, §4.6). A user belongs to no single tenant — they may ' +
      'hold memberships at three gyms — so there is no tenant_id to scope by and the column ' +
      'does not exist. The control is authorisation on user_id. §1.3 names the failure mode ' +
      'directly: classing this RLS makes /me/memberships return an empty list, and the bug ' +
      'looks like data loss rather than like a policy.',
  },
  {
    table: 'user_roles',
    tenantIdReviewed: true,
    reason:
      'IDENTITY class (Schema.md §4.7), and THE ONE TABLE IN THIS SCHEMA WITH A tenant_id AND ' +
      'NO POLICY — M-019 AC-2, reviewed. A policy `tenant_id = current_setting(...)` evaluates ' +
      'NULL = <uuid> for every platform-role grant, which is NULL, which is not TRUE: every ' +
      "platform grant becomes invisible to every session including the platform's own, and " +
      'super-admins silently lose their own permissions. This row is also what resolves an ' +
      'identity INTO a tenant membership, so it cannot be filtered by which tenant you are. ' +
      'Held to PC2-IDENTITY in rls-coverage.sql, which fails if a SECOND such table appears.',
  },

  // ── M-020 · Schema.md §4.8 IDENTITY class, moved here from M-022 by ADR-0035 ─────────────
  {
    table: 'auth_sessions',
    reason:
      'IDENTITY class (Schema.md §1.3, §4.8). A session belongs to a USER, and a user belongs ' +
      'to no single tenant — one member may hold memberships at three gyms and reach all of ' +
      'them from one session. There is no tenant_id to scope by. The control is authorisation ' +
      'on user_id, the same as `users` itself.',
  },
  {
    table: 'refresh_tokens',
    reason:
      'IDENTITY class (Schema.md §4.8). One rotation generation within a session, reachable ' +
      "only through that session, so it inherits auth_sessions' class and its reasoning. Its " +
      'own protection is stronger than a policy: grant class G-COMPLETE means app_rw can write ' +
      'only (used_at, superseded_by_id), so the rotation chain reuse detection walks cannot be ' +
      'rewritten even by the application role.',
  },

  // ── M-019 · GLOBAL platform reference, grant class G-REF ─────────────────────────────────
  //
  // These three ARE reference data, in the §C2.3 sense — the first of the eleven that file
  // names to actually exist. app_rw holds SELECT and nothing else; the write path is admin/,
  // gated by permission and a written reason (FR-ADMN-02), arriving with M-116.
  {
    table: 'roles',
    reason:
      'GLOBAL platform reference (Schema.md §4.7, §C2.3), G-REF. The twelve §B3.1 roles are ' +
      'the same twelve for every tenant; there is nothing for a policy to scope to.',
  },
  {
    table: 'permissions',
    reason:
      'GLOBAL platform reference, G-REF. A permission key is a property of an ENDPOINT ' +
      '(FR-RBAC-01), not of a tenant.',
  },
  {
    table: 'role_permissions',
    reason:
      'GLOBAL platform reference, G-REF. The §B3.2 matrix is platform-wide. Tenant-specific ' +
      'authority comes from user_roles.tenant_id, not from a per-tenant copy of the matrix.',
  },
];

const EXEMPT_TABLES = new Set(EXEMPT.map((e) => e.table));

test('the database is reachable', () => {
  available = /^1$/m.test(psql('SELECT 1;'));
  if (!available) console.error('\n  SKIPPING — no database. pnpm infra:up\n');
});

const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    fn();
  });

/** Base tables and partitioned tables in `public`. Views and indexes have no RLS of their own. */
function allTables(): string[] {
  return rows(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') ORDER BY c.relname;`,
  );
}

it('CONTROL — there are tables to check', () => {
  // A query returning nothing would make every assertion below vacuously true, and the suite
  // would report a perfectly exempt-free schema because it looked at no schema at all.
  const tables = allTables();
  assert.ok(tables.length >= 3, `only ${tables.length} tables found — the query is wrong`);
  assert.ok(tables.includes('tenants'), 'the tenants table is missing from the catalogue query');
});

it('RS4 — every table without RLS is on the committed exemption list', () => {
  const unprotected = rows(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
     ORDER BY c.relname;`,
  );

  const undeclared = unprotected.filter((t) => !EXEMPT_TABLES.has(t));
  assert.deepEqual(
    undeclared,
    [],
    `table(s) have NO row-level security and are not on the exemption list:\n  ` +
      `${undeclared.join('\n  ')}\n\n` +
      `A missing policy is invisible: nothing errors, and the table returns every row to every ` +
      `caller. If the table genuinely holds no tenant data, add it to EXEMPT with a reason. If ` +
      `it does, it needs a policy — and it needed one before the migration merged.`,
  );
});

it('PC2 — the converse: nothing on the exemption list has quietly gained a tenant_id', () => {
  // The failure this catches, and the reason the list is not just documentation. A table is
  // exempted because "it has no tenant data". Someone adds a `tenant_id` column six months
  // later. The exemption is still there, the review was of a migration rather than of a policy,
  // and the table now leaks across tenants while looking entirely ordinary.
  for (const { table, tenantIdReviewed } of EXEMPT) {
    if (tenantIdReviewed) continue; // held to PC2-IDENTITY below instead, which is stricter.
    const hasTenantColumn = psql(
      `SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = 'tenant_id';`,
    );
    assert.equal(
      hasTenantColumn,
      '0',
      `${table} is RLS-EXEMPT and has acquired a tenant_id column. The exemption was granted ` +
        `on the grounds that it holds no tenant data; that is no longer true, and the table is ` +
        `now readable across every tenant.`,
    );
  }
});

it('PC2-IDENTITY — exactly ONE exemption rests on anything other than "no tenant data"', () => {
  // M-019 AC-2. One reviewed exception is a decision; two is a pattern, and the second arrives
  // in a pull request citing the first as precedent. Adding a name here is a deliberate edit
  // to an assertion, which is a diff a reviewer cannot skim past.
  const reviewed = EXEMPT.filter((e) => e.tenantIdReviewed).map((e) => e.table);
  assert.deepEqual(
    reviewed,
    ['user_roles'],
    `${reviewed.length} exemptions claim a reviewed tenant_id. Schema.md §4.7 permits exactly ` +
      'one — user_roles — and anything else on this list is readable across every tenant.',
  );
});

it('PC2-IDENTITY — the reviewed exception really does carry a tenant_id', () => {
  // The positive control. If `user_roles` ever loses the column, the exemption is moot and the
  // paragraph of justification in four files becomes misleading rather than merely redundant.
  const hasTenantColumn = psql(
    `SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'tenant_id';`,
  );
  assert.equal(hasTenantColumn, '1', 'user_roles has no tenant_id — the exemption is stale');
});

it('every exemption states a real reason, not a placeholder', () => {
  // An exemption with no reason is an exemption nobody can review. The length floor is the same
  // shape as runElevated()'s: "no tenant data" is not a reason, it is a restatement.
  for (const { table, reason } of EXEMPT) {
    assert.ok(reason.length >= 60, `the exemption for ${table} has no substantive reason`);
  }
});

it('the exemption list has not grown silently', () => {
  // Reported as a NUMBER, like the elevation inventory and the isolation exceptions. Each of
  // those individually looks reasonable; the total is what nobody reviews unless it is printed.
  console.log(`  RLS exemptions declared: ${EXEMPT.length}`);
  assert.ok(
    EXEMPT.length <= 15,
    `${EXEMPT.length} tables are RLS-exempt. The ceiling is §C2.3's eleven reference tables, ` +
      'plus the two toolchain tables, plus the two IDENTITY-class tables of Schema.md §1.3 ' +
      '(users, user_roles). Beyond fifteen, an exemption is being used as a workaround.',
  );
});

it('RS-11 — FORCE is on wherever RLS is on, or the OWNER is exempt', () => {
  // `ENABLE` alone exempts the table OWNER, and the owner is who migrations run as. A schema
  // with ENABLE and not FORCE looks correct in `pg_policies` and is bypassed by exactly the
  // role most likely to be reused for a maintenance script.
  const enabledNotForced = rows(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
       AND c.relrowsecurity AND NOT c.relforcerowsecurity
     ORDER BY c.relname;`,
  );
  assert.deepEqual(
    enabledNotForced,
    [],
    `table(s) have RLS ENABLED but not FORCED:\n  ${enabledNotForced.join('\n  ')}\n\n` +
      'The table owner is exempt from a merely-enabled policy, and the owner is who migrations ' +
      'run as. FORCE is what makes the policy apply to everyone below a superuser.',
  );
});

it('RS-11 — every protected table actually HAS a policy, not just the flag', () => {
  // ENABLE with no policy is deny-all rather than a leak, so it fails safely — but it fails
  // TOTALLY, and the symptom is "this feature returns nothing" rather than "RLS is misconfigured".
  // Worth catching here rather than in a support ticket.
  const enabledWithoutPolicy = rows(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity
       AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.tablename = c.relname)
     ORDER BY c.relname;`,
  );
  assert.deepEqual(
    enabledWithoutPolicy,
    [],
    `table(s) have RLS enabled and NO policy, so they are deny-all:\n  ` +
      `${enabledWithoutPolicy.join('\n  ')}`,
  );
});
