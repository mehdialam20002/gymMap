/**
 * The demo seed — `pnpm db:seed:demo` to apply, `--remove` to take it all out again.
 *
 * Prints SQL by default and only writes with `--apply`, exactly like the main seed: a script that
 * inserts fifty-two rows into a database should be readable before it is run.
 *
 * ┌─ SEPARATE FROM THE v0.2 TEST FIXTURE, ON PURPOSE ───────────────────────────────────────────┐
 * │ See `gyms.ts`. The short version: the v0.2 seed is referenced by id from the isolation and   │
 * │ contract suites and its counts are asserted. Demo data lives in its own uuid namespace       │
 * │ (`0192de00-…`) and its own email domain (`@demo.gymmap.test`) so the two never interfere and │
 * │ either can be removed without touching the other.                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { execFileSync } from 'node:child_process';

import { DEMO_EMAIL_DOMAIN, DEMO_GYMS, DEMO_NAMESPACE, DEMO_PEOPLE } from './gyms.ts';

const CONTAINER = 'gymmap-postgres';
const DATABASE = 'gymmap';

/** Postgres string literal. Single quotes doubled; nothing else is interpolated into SQL. */
const quote = (value: string | null): string =>
  value === null ? 'NULL' : `'${value.replace(/'/g, "''")}'`;

const daysAgo = (n: number): string => `now() - interval '${String(n)} days'`;

/**
 * The gyms, as tenants.
 *
 * `created_at` is set explicitly and backdated. It is what the approval queue sorts and ages by,
 * so leaving it at `now()` would make every application arrive in the same second and the queue's
 * "waiting 19 days" column would read zero for all of them.
 */
function demoTenantsSql(): string {
  const values = DEMO_GYMS.map(
    (gym) =>
      `  (${quote(gym.id)}, ${daysAgo(gym.createdDaysAgo)}, ${quote(gym.legalName)}, ` +
      `${quote(gym.tradingName)}, '${gym.entityType}', 'IN', 'INR', 'Asia/Kolkata', ` +
      `'${gym.status}', '${gym.subscription}', ` +
      // `ck_tenants__past_due_has_anchor`: a PAST_DUE subscription MUST carry the date it went
      // past due. The constraint is right — "past due" with no anchor cannot be aged, chased or
      // dunned, so the state would be unactionable the moment it was set.
      `${gym.subscription === 'PAST_DUE' ? daysAgo(23) : 'NULL'}, ` +
      `${String(gym.commissionBps)}, ` +
      `${quote(gym.pan)}, ${quote(gym.gstin)}, ${quote(gym.stateCode)}, '${gym.taxStatus}', ` +
      `${quote(gym.addressLine1)}, ${quote(gym.city)}, ${quote(gym.state)}, ` +
      `${quote(gym.postalCode)})`,
  ).join(',\n');

  return [
    '-- Demo gyms, as tenants. RLS bypassed for setup only; the application still runs as app_rw.',
    "SET session_replication_role = 'replica';",
    'INSERT INTO tenants (',
    '  id, created_at, legal_name, trading_name, entity_type, country_code, currency, timezone,',
    '  status, subscription_status, subscription_past_due_since, commission_rate_bps, pan,',
    '  gstin, state_code,',
    '  tax_registration_status, registered_address_line1, registered_city, registered_state,',
    '  registered_postal_code',
    ')',
    'VALUES',
    values,
    'ON CONFLICT (id) DO NOTHING;',
    "SET session_replication_role = 'origin';",
  ].join('\n');
}

/**
 * The people, and their role grants.
 *
 * No `password_hash`. None of these accounts can sign in, deliberately — a demo dataset that
 * ships thirty working credentials is thirty accounts somebody forgets to remove. The one account
 * that CAN sign in is the operator's own, created by `register`, and `--grant-admin` gives it the
 * platform role.
 */
function demoPeopleSql(): string {
  const users = DEMO_PEOPLE.map(
    (p) =>
      `  (${quote(p.id)}, ${daysAgo(p.createdDaysAgo)}, ${quote(p.email)}, ` +
      `${quote(p.fullName)}, '${p.status}', ` +
      // A verified address for everyone except the one account that is deliberately unverified.
      `${p.status === 'PENDING_VERIFICATION' ? 'NULL' : daysAgo(p.createdDaysAgo)})`,
  ).join(',\n');

  const grants = DEMO_PEOPLE.filter((p) => p.roleKey !== null)
    .map(
      (p) =>
        `  (gen_random_uuid(), ${quote(p.id)}, (SELECT id FROM roles WHERE key = '${
          p.roleKey ?? ''
        }'), ${quote(p.tenantId)})`,
    )
    .join(',\n');

  return [
    "SET session_replication_role = 'replica';",
    'INSERT INTO users (id, created_at, email, full_name, status, email_verified_at)',
    'VALUES',
    users,
    'ON CONFLICT (id) DO NOTHING;',
    '',
    'INSERT INTO user_roles (id, user_id, role_id, tenant_id)',
    'VALUES',
    grants,
    // `NULLS NOT DISTINCT` on this constraint is what makes a platform grant (tenant_id IS NULL)
    // conflict with itself rather than duplicating on every re-run. See M-019.
    'ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING;',
    "SET session_replication_role = 'origin';",
  ].join('\n');
}

export function demoSeedSql(): string {
  return [
    '-- GymMap DEMO data. Not a test fixture — see prisma/seed/demo/gyms.ts.',
    `-- Namespace ${DEMO_NAMESPACE}-… · accounts @${DEMO_EMAIL_DOMAIN}`,
    '',
    demoTenantsSql(),
    '',
    demoPeopleSql(),
    '',
  ].join('\n');
}

/**
 * Removes every demo row, children first.
 *
 * Every identity foreign key is `ON DELETE RESTRICT`, so the order is not stylistic: get it wrong
 * and the whole statement fails on the constraint, having cleaned nothing.
 */
export function removeDemoSql(): string {
  const owned = `SELECT id FROM users WHERE email LIKE '%@${DEMO_EMAIL_DOMAIN}'`;
  return [
    "SET session_replication_role = 'replica';",
    `DELETE FROM refresh_tokens WHERE session_id IN (
       SELECT id FROM auth_sessions WHERE user_id IN (${owned}));`,
    `DELETE FROM auth_sessions WHERE user_id IN (${owned});`,
    `DELETE FROM user_roles WHERE user_id IN (${owned});`,
    `DELETE FROM users WHERE email LIKE '%@${DEMO_EMAIL_DOMAIN}';`,
    `DELETE FROM tenants WHERE id::text LIKE '${DEMO_NAMESPACE}-%';`,
    "SET session_replication_role = 'origin';",
  ].join('\n');
}

/**
 * Grants an existing account the platform role that opens the admin console.
 *
 * Kept as an explicit, separate flag rather than folded into the seed. Handing SUPER_ADMIN to an
 * account is the single most consequential statement in this file, and it should be something a
 * person typed on purpose.
 */
export function grantAdminSql(email: string): string {
  return [
    "SET session_replication_role = 'replica';",
    `INSERT INTO user_roles (id, user_id, role_id, tenant_id)
     SELECT gen_random_uuid(), u.id, r.id, NULL
       FROM users u CROSS JOIN roles r
      WHERE u.email = ${quote(email.toLowerCase())} AND r.key = 'SUPER_ADMIN'
     ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING;`,
    "SET session_replication_role = 'origin';",
    `SELECT CASE WHEN count(*) = 0
              THEN 'NO SUCH ACCOUNT: ${email} — register it first'
              ELSE 'granted SUPER_ADMIN to ${email}'
            END
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id AND r.key = 'SUPER_ADMIN'
      WHERE u.email = ${quote(email.toLowerCase())};`,
  ].join('\n');
}

function apply(sql: string): void {
  execFileSync(
    'docker',
    ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', DATABASE, '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'] },
  );
}

function main(): void {
  const args = process.argv.slice(2);

  const grantFlag = args.find((a) => a.startsWith('--grant-admin='));
  const sql = grantFlag
    ? grantAdminSql(grantFlag.split('=')[1] ?? '')
    : args.includes('--remove')
      ? removeDemoSql()
      : demoSeedSql();

  if (!args.includes('--apply')) {
    process.stdout.write(sql);
    process.stderr.write(`\ndemo seed: printed. Re-run with --apply to execute.\n`);
    return;
  }

  apply(sql);
  process.stderr.write(
    grantFlag
      ? '\ndemo seed: role granted.\n'
      : args.includes('--remove')
        ? '\ndemo seed: removed.\n'
        : `\ndemo seed: ${String(DEMO_GYMS.length)} gyms, ${String(DEMO_PEOPLE.length)} people.\n`,
  );
}

main();
