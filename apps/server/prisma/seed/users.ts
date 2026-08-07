/**
 * M-019 · Seed v0.2 — the eleven `TestingStrategy.md` §6.6 principals.
 *
 * ┌─ THESE ARE FIXTURES, AND THE ISOLATION SUITE IS BUILT ON THEM ──────────────────────────────┐
 * │ `apps/server/test/harness/auth.ts` mints a token for each; no test performs a login unless  │
 * │ login itself is the subject. Their uuids are therefore FIXED and derived from their         │
 * │ handles, so "owner.t2 could read tenant A" names something a reader can go and look at.      │
 * │                                                                                              │
 * │ `member.dual` is the one that earns its place. It holds `MEMBER` with NO tenant scope and    │
 * │ memberships at two tenants, which is the `/me/memberships` case `Schema.md` §1.3 calls the   │
 * │ most expensive mistake available in this schema: class `users` as RLS and this member sees   │
 * │ an empty list. A suite whose every fixture belongs to one tenant cannot detect that.          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ NOT ONE OF THEM HAS A PASSWORD ────────────────────────────────────────────────────────────┐
 * │ `password_hash` is NULL on all eleven. M-020 owns Argon2id and its recorded parameters       │
 * │ (`A-12`), and a seed that wrote a hash now would either invent parameters M-020 then has to  │
 * │ match, or store something weaker. `NULL` is also the honest state: these accounts cannot be  │
 * │ logged into, and the harness mints tokens directly rather than authenticating.               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { TENANT_A, TENANT_B } from './tenants.ts';
import { roleId, seedUuid } from './roles.ts';
import type { PlatformRole } from '../../src/iam/types/iam.types.ts';

export interface SeedPrincipal {
  /** The §6.6 handle. The harness looks principals up by it. */
  readonly handle: string;
  readonly role: PlatformRole;
  /** `null` for a PLATFORM- or SELF-scoped role — the nullable tenant IS the discriminator. */
  readonly tenantId: string | null;
  readonly email: string;
  readonly phone: string;
  readonly fullName: string;
  readonly usedBy: string;
}

export const userId = (handle: string): string => seedUuid('user', handle);

/**
 * §6.6, in the document's own order.
 *
 * `finance` is `FINANCE`, not `FINANCE_ANALYST`. §6.6's table writes the latter; `§B3.1` and
 * `platform_role_enum` both say `FINANCE`, and the enum makes the alternative literally
 * un-insertable. Precedence puts `MASTER_PRD.md` above `TestingStrategy.md`, so the PRD's
 * spelling wins and the discrepancy is recorded here rather than silently normalised.
 */
export const SEED_PRINCIPALS: readonly SeedPrincipal[] = [
  {
    handle: 'owner.t1',
    role: 'GYM_OWNER',
    tenantId: TENANT_A,
    email: 'owner.t1@seed.gymmap.test',
    phone: '+919000000001',
    fullName: 'Rohan Iyer',
    usedBy: 'UAT-01, E2E-01, dashboard contract tests',
  },
  {
    handle: 'owner.t2',
    role: 'GYM_OWNER',
    tenantId: TENANT_B,
    email: 'owner.t2@seed.gymmap.test',
    phone: '+919000000002',
    fullName: 'Anjali Rao',
    usedBy: "The isolation suite's tenant-B principal",
  },
  {
    handle: 'manager.t2.branch1',
    role: 'GYM_MANAGER',
    tenantId: TENANT_B,
    email: 'manager.t2.branch1@seed.gymmap.test',
    phone: '+919000000003',
    fullName: 'Vikram Nair',
    // The branch binding itself is `staff_branches`, which arrives with M-032. The USER and the
    // tenant-scoped role exist now so the isolation inventory can already name this principal.
    usedBy: 'FR-RBAC-03 branch scoping; the branch-restriction isolation cases',
  },
  {
    handle: 'reception.t1',
    role: 'RECEPTIONIST',
    tenantId: TENANT_A,
    email: 'reception.t1@seed.gymmap.test',
    phone: '+919000000004',
    fullName: 'Meera Pillai',
    usedBy: 'UAT-02, E2E-04, E2E-10',
  },
  {
    handle: 'member.solo',
    role: 'MEMBER',
    tenantId: null,
    email: 'member.solo@seed.gymmap.test',
    phone: '+919000000005',
    fullName: 'Arjun Desai',
    usedBy: 'E2E-02, E2E-03',
  },
  {
    handle: 'member.dual',
    role: 'MEMBER',
    tenantId: null,
    email: 'member.dual@seed.gymmap.test',
    phone: '+919000000006',
    fullName: 'Priya Sharma',
    // The memberships at both tenants arrive with M-055. The PRINCIPAL is here now, with a
    // tenant-less MEMBER grant, because that is the property under test: a member is a platform
    // identity who happens to hold memberships, not a tenant's row.
    usedBy: 'The /me cross-tenant case (§5.5)',
  },
  {
    handle: 'member.nocheckin',
    role: 'MEMBER',
    tenantId: null,
    email: 'member.nocheckin@seed.gymmap.test',
    phone: '+919000000007',
    fullName: 'Sanjay Kulkarni',
    usedBy: 'BR-REV-01-N1 / BAC-09 — the review negative case, zero attendance',
  },
  {
    handle: 'verifier',
    role: 'VERIFICATION_OFFICER',
    tenantId: null,
    email: 'verifier@seed.gymmap.test',
    phone: '+919000000008',
    fullName: 'Kavya Menon',
    usedBy: 'UAT-04, E2E-01',
  },
  {
    handle: 'finance',
    role: 'FINANCE',
    tenantId: null,
    email: 'finance@seed.gymmap.test',
    phone: '+919000000009',
    fullName: 'Deepak Joshi',
    usedBy: 'UAT-05, E2E-12',
  },
  {
    handle: 'superadmin',
    role: 'SUPER_ADMIN',
    tenantId: null,
    email: 'superadmin@seed.gymmap.test',
    phone: '+919000000010',
    fullName: 'Nisha Verma',
    usedBy: 'UAT-06, the §5.10 inverted suite',
  },
  {
    handle: 'support',
    role: 'SUPPORT_AGENT',
    tenantId: null,
    email: 'support@seed.gymmap.test',
    phone: '+919000000011',
    fullName: 'Imran Sheikh',
    usedBy: 'PE-T5 — must be refused financial mutation',
  },
];

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * The SQL that inserts the principals and their role grants.
 *
 * `users` and `user_roles` carry no RLS policy, so — unlike the tenant seed — there is nothing
 * to bypass. That absence is the milestone's central claim, and a seed that had to disable
 * replication to write these tables would be evidence against it.
 *
 * Every principal is `ACTIVE` with both contact points verified. A fixture stuck at
 * `PENDING_VERIFICATION` would make every downstream test assert around a verification step
 * that is not its subject.
 */
export function seedUsersSql(now = 'now()'): string {
  const userValues = SEED_PRINCIPALS.map(
    (p) =>
      `  ('${userId(p.handle)}', ${quote(p.email)}, ${quote(p.phone)}, ${quote(p.fullName)}, ` +
      `'ACTIVE', ${now}, ${now})`,
  ).join(',\n');

  const grantValues = SEED_PRINCIPALS.map(
    (p) =>
      `  ('${seedUuid('user_role', p.handle)}', '${userId(p.handle)}', '${roleId(p.role)}', ` +
      `${p.tenantId === null ? 'NULL' : `'${p.tenantId}'`})`,
  ).join(',\n');

  return [
    '-- Seed v0.2 · M-019. The eleven TestingStrategy.md §6.6 principals.',
    '--',
    '-- password_hash stays NULL: M-020 owns Argon2id and its recorded parameters (A-12), and a',
    '-- seeded hash would either pre-empt that decision or store something weaker.',
    '',
    'INSERT INTO users (id, email, phone, full_name, status, email_verified_at, phone_verified_at)',
    'VALUES',
    userValues,
    'ON CONFLICT (id) DO NOTHING;',
    '',
    '-- The tenant_id is NULL for every platform- and self-scoped role. That nullable column is',
    '-- the discriminator (ERD.md §3.1), and it is why user_roles carries no RLS policy.',
    'INSERT INTO user_roles (id, user_id, role_id, tenant_id)',
    'VALUES',
    grantValues,
    'ON CONFLICT (id) DO NOTHING;',
  ].join('\n');
}

export const SEED_USER_COUNTS = {
  users: SEED_PRINCIPALS.length,
  userRoles: SEED_PRINCIPALS.length,
  platformGrants: SEED_PRINCIPALS.filter((p) => p.tenantId === null).length,
  tenantGrants: SEED_PRINCIPALS.filter((p) => p.tenantId !== null).length,
} as const;
