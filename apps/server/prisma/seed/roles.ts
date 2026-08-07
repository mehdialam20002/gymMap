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
 * The seed's uuid namespace. Fixed forever — changing it renumbers every seeded row and every
 * fixture that references one.
 */
export const SEED_NAMESPACE = '6b1d5c2e-9f34-4a7d-8c15-2e0a7b3f6d81';

/**
 * A deterministic uuid for `<kind>:<key>`.
 *
 * UUIDv5 (SHA-1, RFC 4122 §4.3) rather than a bare hash, so the value is a well-formed uuid with
 * the right version and variant bits — a `uuid` column accepts a malformed one from a text
 * literal and then sorts and indexes it strangely.
 */
export function seedUuid(kind: string, key: string): string {
  const namespaceBytes = Buffer.from(SEED_NAMESPACE.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(namespaceBytes).update(`${kind}:${key}`, 'utf8').digest();

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
