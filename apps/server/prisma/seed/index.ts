/**
 * The seed entry point. v0.2 at M-019 — the first version with a payload of its own.
 *
 * ┌─ IT PRINTS SQL. IT DOES NOT CONNECT, UNLESS ASKED ──────────────────────────────────────────┐
 * │ `--apply` runs the statements through the local Postgres container; without it the SQL goes │
 * │ to stdout. That default is deliberate:                                                       │
 * │                                                                                              │
 * │   Every isolation spec seeds its OWN fixtures, by importing `seedTenantsSql()` and the       │
 * │   functions below and running them itself (see `rls-policy.int-spec.ts`). A seed binary      │
 * │   that also held a connection would be a second path to the same rows, and the two would     │
 * │   drift.                                                                                     │
 * │                                                                                              │
 * │   The composition — which tables, in which order — is the part worth having in one place.    │
 * │   Order matters here: `user_roles` has foreign keys to all three of `users`, `roles` and     │
 * │   `tenants`, so those must land first.                                                       │
 * │                                                                                              │
 * │   And printing means the seed can be READ before it is run, which is what you want from a    │
 * │   script that writes eleven principals and 12 roles into a database.                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { execFileSync } from 'node:child_process';

import { SEED_VERSION } from './version.ts';
import { seedTenantsSql } from './tenants.ts';
import { SEED_ROLE_COUNTS, seedRolesSql } from './roles.ts';
import { SEED_USER_COUNTS, seedUsersSql } from './users.ts';
import { SEED_CHECKLIST_COUNTS, seedKycChecklistsSql } from './kyc-checklists.ts';

const CONTAINER = 'gymmap-postgres';
const DATABASE = 'gymmap';

/**
 * The whole payload, in dependency order.
 *
 * tenants → roles + permissions → users → user_roles. `user_roles` references all three of the
 * others, and `role_permissions` references two, so nothing here is reorderable.
 */
export function seedSql(): string {
  return [
    `-- GymMap seed v${SEED_VERSION}`,
    '-- Generated. Do not edit by hand — edit prisma/seed/*.ts and regenerate.',
    '',
    seedTenantsSql(),
    '',
    seedRolesSql(),
    '',
    seedUsersSql(),
    '',
    // Last, and orderable anywhere: kyc_checklists is GLOBAL reference with no foreign key to
    // anything above it. Placed at the end so the dependency-ordered block stays readable as one.
    seedKycChecklistsSql(),
    '',
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
  const sql = seedSql();

  if (!process.argv.includes('--apply')) {
    process.stdout.write(sql);
    process.stderr.write(
      `\nseed ${SEED_VERSION}: printed. Re-run with --apply to execute against ${CONTAINER}.\n`,
    );
    return;
  }

  apply(sql);
  process.stderr.write(
    `seed ${SEED_VERSION} applied: ${SEED_ROLE_COUNTS.roles} roles · ` +
      `${SEED_ROLE_COUNTS.permissions} permissions · ${SEED_ROLE_COUNTS.rolePermissions} ` +
      `role_permissions · ${SEED_USER_COUNTS.users} principals ` +
      `(${SEED_USER_COUNTS.platformGrants} platform, ${SEED_USER_COUNTS.tenantGrants} tenant) · ` +
      `${SEED_CHECKLIST_COUNTS.checklists} KYC checklists ` +
      `(${SEED_CHECKLIST_COUNTS.items} items).\n`,
  );
}

main();
