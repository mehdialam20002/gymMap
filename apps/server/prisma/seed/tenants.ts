/**
 * M-009 · Seed v0.1 — three tenants (R-M2, R-7, TestingStrategy.md §6.1 TR-07).
 *
 * The uuids are FIXED and published. Every isolation, integration and contract suite refers to
 * the same three tenants by the same ids, so a failure message that says "tenant A could read
 * tenant B" names something a reader can go and look at. Randomly generated fixture ids make
 * every failure report unreproducible.
 *
 * Three DISTINCT timezones, none of them UTC. That is the important property: a suite whose
 * fixtures all sit in one zone cannot detect the class of bug this system is most exposed to —
 * India is UTC+05:30 with no DST, so the local day boundary is 18:30 UTC the previous day and
 * the financial year rolls at 18:30 UTC on 31 March. Code that silently assumes UTC passes
 * every test until a membership expires a day early for a real member.
 *
 * `Asia/Colombo` (+05:30, same offset as India, different zone) and `Asia/Kathmandu` (+05:45,
 * a 45-minute offset) are chosen deliberately: the first catches code that compares offsets
 * instead of zones, the second catches anything that assumes offsets are whole hours.
 */

export const SEED_VERSION = '0.1' as const;

export interface SeedTenant {
  readonly id: string;
  readonly legalName: string;
  readonly tradingName: string;
  readonly entityType: 'SOLE_PROPRIETOR' | 'PARTNERSHIP' | 'COMPANY' | 'OTHER';
  readonly timezone: string;
  readonly status: 'DRAFT' | 'APPROVED' | 'SUSPENDED';
  readonly pan: string | null;
  readonly note: string;
}

export const TENANT_A = '01912f00-0000-7000-8000-00000000000a';
export const TENANT_B = '01912f00-0000-7000-8000-00000000000b';
export const TENANT_C = '01912f00-0000-7000-8000-00000000000c';

export const SEED_TENANTS: readonly SeedTenant[] = [
  {
    id: TENANT_A,
    legalName: 'Iron Temple Fitness Private Limited',
    tradingName: 'Iron Temple',
    entityType: 'COMPANY',
    timezone: 'Asia/Kolkata',
    status: 'APPROVED',
    pan: 'AAACI1234A',
    note: 'Single branch, the ordinary case. The launch market zone: UTC+05:30, no DST.',
  },
  {
    id: TENANT_B,
    legalName: 'Peak Performance Partners',
    tradingName: 'Peak Performance',
    entityType: 'PARTNERSHIP',
    timezone: 'Asia/Colombo',
    status: 'APPROVED',
    pan: 'AAAFP5678B',
    // Same +05:30 offset as Kolkata, different zone. Catches code that compares offsets rather
    // than zone identifiers — which looks correct for years and then breaks the moment either
    // zone changes its rules.
    note: 'Multi-branch. Same offset as tenant A, different zone.',
  },
  {
    id: TENANT_C,
    legalName: 'Summit Strength',
    tradingName: 'Summit',
    entityType: 'SOLE_PROPRIETOR',
    timezone: 'Asia/Kathmandu',
    status: 'SUSPENDED',
    pan: 'AAAPS9012C',
    // +05:45. Catches anything that assumes an offset is a whole number of hours — a surprising
    // amount of date code does, and it fails by 15 minutes, which nobody notices immediately.
    note: 'Suspended, so BR-GYM-01 visibility can be tested. 45-minute offset.',
  },
];

/**
 * The SQL that inserts them.
 *
 * Emitted as text rather than executed through Prisma because the seed runs BEFORE the
 * tenant-context extension exists (M-010), and inserting through the raw client is exactly the
 * thing `no-raw-prisma-outside-tenancy` forbids in application code. A seed is not application
 * code, but borrowing the pattern would teach the wrong habit.
 */
export function seedTenantsSql(): string {
  const values = SEED_TENANTS.map(
    (t) =>
      `  ('${t.id}', ${quote(t.legalName)}, ${quote(t.tradingName)}, '${t.entityType}', ` +
      `'${t.timezone}', '${t.status}', ${t.pan === null ? 'NULL' : `'${t.pan}'`})`,
  ).join(',\n');

  return [
    '-- Seed v0.1. Inserted with RLS bypassed for setup only; every assertion afterwards',
    '-- connects as app_rw, which is FORCED.',
    "SET session_replication_role = 'replica';",
    'INSERT INTO tenants (id, legal_name, trading_name, entity_type, timezone, status, pan)',
    'VALUES',
    values,
    'ON CONFLICT (id) DO NOTHING;',
    "SET session_replication_role = 'origin';",
  ].join('\n');
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
