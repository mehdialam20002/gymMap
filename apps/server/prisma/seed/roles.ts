/**
 * M-019 · Seed v0.2 — the twelve §B3.1 roles and the §B3.2 permission catalogue.
 *
 * ┌─ THE IDS ARE DERIVED, NOT RANDOM ───────────────────────────────────────────────────────────┐
 * │ A role's uuid is a deterministic function of its key, so `SUPER_ADMIN` has the same id in    │
 * │ every developer's database, in CI, and in the volume overlay. Two consequences follow, and  │
 * │ both matter more than they look:                                                             │
 * │                                                                                              │
 * │   A failing isolation test can print an id a reader can grep for, instead of a uuid that     │
 * │   existed only in that run.                                                                  │
 * │                                                                                              │
 * │   Re-seeding is idempotent by primary key. `ON CONFLICT (id) DO NOTHING` means running the   │
 * │   seed twice is a no-op rather than a duplicate-key failure or a second set of roles.        │
 * │                                                                                              │
 * │ The derivation is a UUIDv5-shaped hash of a fixed namespace and the key. Not v7: v7 is       │
 * │ time-ordered and therefore different on every run, which is the opposite of what a fixture   │
 * │ needs (`ERD.md` §11.5 mandates v7 for APPLICATION inserts — a seed is not one).               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { createHash } from 'node:crypto';

import {
  CAPABILITY_MATRIX,
  PERMISSION_KEYS,
  ROLE_DEFINITIONS,
  describePermission,
  parsePermissionKey,
  rolePermissionPairs,
} from '../../src/iam/permissions.ts';

/**
 * `NS_SEED` — the `§C8.2` seed namespace, for `K3` test data.
 *
 * ┌─ THIS VALUE WAS WRONG FROM THE DAY IT WAS WRITTEN ───────────────────────────────────────────┐
 * │ It read `6b1d5c2e-9f34-4a7d-8c15-2e0a7b3f6d81`, which appears in no document. Two binding     │
 * │ rank-3 specifications fix it, agree with each other, and both say it is never changed:        │
 * │                                                                                              │
 * │   `SeedStrategy.md` §5.1 — `const NS_SEED = '6f2b7c1e-0000-5000-a000-000000000000';`          │
 * │                            *"the §C8.2 seed namespace — NEVER changed"*                       │
 * │   `TestingStrategy.md` §6.1 — the same literal, *"the GymMap seed namespace, never changed"*  │
 * │                                                                                              │
 * │ `DT2` and §7.2 both say changing a namespace *"is a coordinated migration of every committed  │
 * │ expectation in the repository and requires the same review as a schema change"*. That rule is │
 * │ the reason to correct it NOW rather than an argument against correcting it: the code never    │
 * │ held the specified value, so every day it stands the migration gets larger. Today it costs a  │
 * │ `pnpm db:seed` — every consumer computes ids through `roleId()` / `seedUuid()` and not one    │
 * │ committed expectation hard-codes a derived literal, which was checked before changing it.     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `seed-namespaces.spec.ts` pins both literals against their citations so this cannot drift again.
 */
export const SEED_NAMESPACE = '6f2b7c1e-0000-5000-a000-000000000000';

/**
 * `NS_REFERENCE` — for `K1` platform reference data. A DIFFERENT namespace, by rule.
 *
 * `DT2a`: *"`NS_SEED` ≠ `NS_REFERENCE` … so a fixture id and a reference id can never collide, and
 * a `SELECT` can tell them apart by regeneration."* `RD2` fixes the literal and the key format:
 * `uuid_v5(NS_REFERENCE, '<table>:<business-key>')`, so `amenities.key = 'SWIMMING_POOL'` has the
 * same uuid in every environment — which is what lets `SEP9`'s drift check be a set comparison
 * rather than a semantic diff.
 */
export const REFERENCE_NAMESPACE = '3f8a2d10-0000-5000-b000-000000000000';

/** UUIDv5 over an explicit namespace. Shared by both `seedUuid` and `referenceUuid`. */
function uuidV5(namespace: string, name: string): string {
  const namespaceBytes = Buffer.from(namespace.replaceAll('-', ''), 'hex');
  const hash = createHash('sha1').update(namespaceBytes).update(name, 'utf8').digest();

  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant

  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * A deterministic uuid for a `K3` seed row, as `<kind>:<key>`.
 *
 * UUIDv5 (SHA-1, RFC 4122 §4.3) rather than a bare hash, so the value is a well-formed uuid with
 * the right version and variant bits — a `uuid` column accepts a malformed one from a text literal
 * and then sorts and indexes it strangely. `DT4a`: v5 and never v7, because v7's value depends on
 * WHEN it was generated, which is the opposite of what a seed needs.
 */
export function seedUuid(kind: string, key: string): string {
  return uuidV5(SEED_NAMESPACE, `${kind}:${key}`);
}

/**
 * A deterministic uuid for a `K1` reference row, as `<table>:<business-key>` — `RD2`.
 *
 * Note the key format differs from `seedUuid`'s: `RD2` fixes it as the TABLE name, not a "kind",
 * because the drift check compares reference rows table by table.
 */
export function referenceUuid(table: string, businessKey: string): string {
  return uuidV5(REFERENCE_NAMESPACE, `${table}:${businessKey}`);
}

export const roleId = (key: string): string => seedUuid('role', key);
export const permissionId = (key: string): string => seedUuid('permission', key);

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * The SQL that inserts the roles, the permissions and their composition.
 *
 * Emitted as text and run by the migration role, not through Prisma. `roles`, `permissions` and
 * `role_permissions` are **G-REF**: `app_rw` holds `SELECT` and nothing else, and a seed that
 * could write them through the application role would prove the grant wrong. The same statements
 * would fail as `gymmap_app`, which is the point — `identity-grants.int-spec.ts` asserts it.
 */
export function seedRolesSql(): string {
  const roleValues = ROLE_DEFINITIONS.map(
    (role) =>
      `  ('${roleId(role.key)}', '${role.key}', '${role.scope}', ${quote(role.description)})`,
  ).join(',\n');

  const permissionValues = PERMISSION_KEYS.map((key) => {
    const { resource, action } = parsePermissionKey(key);
    return (
      `  ('${permissionId(key)}', ${quote(key)}, ${quote(resource)}, ${quote(action)}, ` +
      `${quote(describePermission(key))})`
    );
  }).join(',\n');

  const pairValues = rolePermissionPairs()
    .map(
      (pair) =>
        `  ('${seedUuid('role_permission', `${pair.role}|${pair.permission}`)}', ` +
        `'${roleId(pair.role)}', '${permissionId(pair.permission)}')`,
    )
    .join(',\n');

  return [
    '-- Seed v0.2 · M-019. The §B3.1 roles and the §B3.2 matrix.',
    '--',
    '-- No `session_replication_role` juggling here, unlike the tenant seed: none of these three',
    '-- tables has an RLS policy to bypass. They are GLOBAL platform reference data.',
    '',
    'INSERT INTO roles (id, key, scope, description)',
    'VALUES',
    roleValues,
    'ON CONFLICT (id) DO NOTHING;',
    '',
    'INSERT INTO permissions (id, key, resource, action, description)',
    'VALUES',
    permissionValues,
    'ON CONFLICT (id) DO NOTHING;',
    '',
    'INSERT INTO role_permissions (id, role_id, permission_id)',
    'VALUES',
    pairValues,
    'ON CONFLICT (id) DO NOTHING;',
  ].join('\n');
}

/** What the seed reports, and what `roles-seed.int-spec.ts` asserts against. */
export const SEED_ROLE_COUNTS = {
  roles: ROLE_DEFINITIONS.length,
  permissions: PERMISSION_KEYS.length,
  rolePermissions: rolePermissionPairs().length,
  capabilities: CAPABILITY_MATRIX.length,
} as const;
