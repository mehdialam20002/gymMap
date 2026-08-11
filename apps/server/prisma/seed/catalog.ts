/**
 * `M-031` · Seed v0.6 — three gyms, five branches, and the amenity claims on them.
 *
 * ┌─ THE FIXTURE THE SEED ALREADY DESCRIBED AND NEVER BUILT ─────────────────────────────────────┐
 * │ `tenants.ts` has said what these rows should be since `M-009`, in its own notes:              │
 * │                                                                                              │
 * │   TENANT_A  *"Single branch, the ordinary case."*                                             │
 * │   TENANT_B  *"Multi-branch. Same offset as tenant A, different zone."*                        │
 * │   TENANT_C  *"Suspended, so `BR-GYM-01` visibility can be tested."*                            │
 * │                                                                                              │
 * │ Every one of those sentences is a statement about the CATALOGUE, and no seed produced a       │
 * │ single `gyms` or `branches` row — so "multi-branch" was a comment about data that did not     │
 * │ exist, and `BR-GYM-01` visibility could not be tested against a suspended gym because there  │
 * │ was no gym. This file makes the three notes true.                                             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ REFERENCE ROWS ARE JOINED BY BUSINESS KEY, NEVER BY A COPIED UUID ──────────────────────────┐
 * │ `city_id`, `category_id` and `amenities.id` are resolved with `(SELECT id FROM … WHERE slug   │
 * │ = …)` subselects. Pasting the uuids would be shorter and would couple this file to whatever   │
 * │ `referenceUuid()` happened to derive on the day it was run — `TD-041` is exactly that failure │
 * │ already: the dev database holds reference rows under a pre-`ADR-0038` namespace, so derived   │
 * │ ids in code no longer match ids in the database. A subselect on `slug` survives a re-seed.    │
 * │                                                                                              │
 * │ It also FAILS LOUDLY if the reference row is missing: the subselect yields NULL and the       │
 * │ `NOT NULL` on `city_id` refuses the insert. A hardcoded uuid would insert a dangling          │
 * │ reference instead — which is what `NFR-DQ-06` forbids and what a foreign key would only catch │
 * │ if the id were wrong rather than merely stale.                                                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ COORDINATES ARE REAL, AND ONE IS DELIBERATELY FAR FROM THE OTHERS ──────────────────────────┐
 * │ Every branch sits within a kilometre or two of its city centroid. Summit's is in Bengaluru,  │
 * │ **734 km** from Koregaon Park — measured with `ST_Distance` against these exact rows, not     │
 * │ estimated — so `catalog-tables.int-spec.ts`'s geography assertion has something to be false   │
 * │ about: a 3 km radius around Pune must return ZERO for it.                                     │
 * │                                                                                              │
 * │ That is the half of the pair which distinguishes `geography` from `geometry`.                 │
 * │ `ST_DWithin(geometry, …, 3000)` reads 3,000 as DEGREES and matches everything on Earth, so a  │
 * │ positive-only test passes under either type and proves nothing.                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { seedUuid } from './roles.ts';
import { TENANT_A, TENANT_B, TENANT_C } from './tenants.ts';

export interface SeedBranch {
  readonly key: string;
  readonly name: string;
  readonly addressLine1: string;
  readonly citySlug: string;
  readonly state: string;
  /** Two digits. `LAUNCH_MARKET_INDIA.md` §4 — CGST + SGST versus IGST turns on this. */
  readonly stateCode: string;
  readonly postalCode: string;
  readonly lat: number;
  readonly lng: number;
  readonly capacity: number | null;
  readonly isPrimary: boolean;
  readonly status: 'ACTIVE' | 'INACTIVE';
  readonly note: string;
}

export interface SeedGym {
  readonly key: string;
  readonly tenantId: string;
  readonly name: string;
  readonly slug: string;
  readonly citySlug: string;
  readonly categoryKey: string;
  readonly genderPolicy: 'MIXED' | 'WOMEN_ONLY' | 'MEN_ONLY' | 'SCHEDULED';
  readonly status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'SUSPENDED' | 'CLOSED';
  readonly amenityKeys: readonly string[];
  readonly branches: readonly SeedBranch[];
  readonly note: string;
}

export const SEED_GYMS: readonly SeedGym[] = [
  {
    key: 'iron-temple',
    tenantId: TENANT_A,
    name: 'Iron Temple Andheri',
    slug: 'iron-temple-andheri',
    citySlug: 'mumbai',
    categoryKey: 'GYM',
    genderPolicy: 'MIXED',
    status: 'APPROVED',
    amenityKeys: ['OPEN_24_HOURS', 'PARKING_TWO_WHEELER', 'PERSONAL_TRAINING', 'AIR_CONDITIONING'],
    note: "tenants.ts: 'Single branch, the ordinary case.' The happy path for every read.",
    branches: [
      {
        key: 'iron-temple:andheri',
        name: 'Andheri West',
        addressLine1: '1 Link Road, Andheri West',
        citySlug: 'mumbai',
        state: 'Maharashtra',
        stateCode: '27',
        postalCode: '400053',
        lat: 19.1364,
        lng: 72.8296,
        capacity: 220,
        isPrimary: true,
        status: 'ACTIVE',
        note: 'The only branch, so it is necessarily primary — and closing it must be refused.',
      },
    ],
  },
  {
    key: 'peak-performance',
    tenantId: TENANT_B,
    name: 'Peak Performance Pune',
    slug: 'peak-performance-pune',
    citySlug: 'pune',
    categoryKey: 'PREMIUM_CLUB',
    genderPolicy: 'MIXED',
    status: 'APPROVED',
    amenityKeys: ['SWIMMING_POOL', 'SAUNA', 'PARKING_CAR', 'GROUP_CLASSES_INCLUDED'],
    note:
      "tenants.ts: 'Multi-branch.' Three branches, one of them already INACTIVE — which is the " +
      'shape §12.1 needs: an owner must still see the branch they closed last month.',
    branches: [
      {
        key: 'peak:koregaon-park',
        name: 'Koregaon Park',
        addressLine1: '12 North Main Road, Koregaon Park',
        citySlug: 'pune',
        state: 'Maharashtra',
        stateCode: '27',
        postalCode: '411001',
        lat: 18.5362,
        lng: 73.8939,
        capacity: 400,
        isPrimary: true,
        status: 'ACTIVE',
        note:
          "Gym.md §12.4's own example branch — '1,247 members can currently check in at Koregaon " +
          "Park'. Named to match, so the refusal message reads like the specification.",
      },
      {
        key: 'peak:baner',
        name: 'Baner',
        addressLine1: '44 Baner Road',
        citySlug: 'pune',
        state: 'Maharashtra',
        stateCode: '27',
        postalCode: '411045',
        lat: 18.559,
        lng: 73.7868,
        capacity: 260,
        isPrimary: false,
        status: 'ACTIVE',
        note:
          'The successor. Deactivating Koregaon Park must promote THIS one — it is the oldest ' +
          'remaining active branch, and `activeInGym` orders primary-first then `created_at` asc.',
      },
      {
        key: 'peak:kharadi',
        name: 'Kharadi',
        addressLine1: '7 EON Free Zone, Kharadi',
        citySlug: 'pune',
        state: 'Maharashtra',
        stateCode: '27',
        postalCode: '411014',
        lat: 18.5515,
        lng: 73.9476,
        capacity: null,
        isPrimary: false,
        status: 'INACTIVE',
        note:
          'Closed, and NOT soft-deleted. The two are set together by a real deactivation; split ' +
          'here on purpose so a suite can tell "the list keeps INACTIVE" from "the list drops ' +
          'soft-deleted" without doing a deactivation first. `capacity` is null — a nullable ' +
          'column with an actual null in it, which is the only way to catch a mapper that ' +
          'assumes otherwise.',
      },
    ],
  },
  {
    key: 'summit-strength',
    tenantId: TENANT_C,
    name: 'Summit Strength Indiranagar',
    slug: 'summit-strength-indiranagar',
    citySlug: 'bengaluru',
    categoryKey: 'BUDGET_GYM',
    genderPolicy: 'MIXED',
    status: 'SUSPENDED',
    amenityKeys: ['DRINKING_WATER_RO', 'POWER_BACKUP'],
    note:
      "tenants.ts: 'Suspended, so BR-GYM-01 visibility can be tested.' A suspended gym must be " +
      'invisible to discovery and must refuse an order BEFORE payment — `isBlockedForOrdering` ' +
      'answers true for every status that is not APPROVED, and this row is what proves it against ' +
      'a real one rather than a literal.',
    branches: [
      {
        key: 'summit:indiranagar',
        name: 'Indiranagar',
        addressLine1: '100 Feet Road, Indiranagar',
        citySlug: 'bengaluru',
        state: 'Karnataka',
        // 29, not 27. The two GST state codes in this seed differ deliberately: a place-of-supply
        // bug that hardcodes Maharashtra passes every fixture where all branches share a state.
        stateCode: '29',
        postalCode: '560038',
        lat: 12.9784,
        lng: 77.6408,
        capacity: 120,
        isPrimary: true,
        status: 'ACTIVE',
        note: 'The 840 km control for the geography-versus-geometry assertion. See the header.',
      },
    ],
  },
];

export const SEED_CATALOG_COUNTS = {
  gyms: SEED_GYMS.length,
  branches: SEED_GYMS.reduce((total, gym) => total + gym.branches.length, 0),
  gymAmenities: SEED_GYMS.reduce((total, gym) => total + gym.amenityKeys.length, 0),
} as const;

export const gymId = (key: string): string => seedUuid('gym', key);
export const branchId = (key: string): string => seedUuid('branch', key);

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** `(SELECT id FROM <table> WHERE <column> = '<key>')`. See the header for why not a uuid. */
const lookup = (table: string, column: string, key: string): string =>
  `(SELECT id FROM ${table} WHERE ${column} = ${quote(key)})`;

export function seedCatalogSql(): string {
  const gymValues = SEED_GYMS.map(
    (gym) =>
      `  ('${gymId(gym.key)}', '${gym.tenantId}', ${quote(gym.name)}, ${quote(gym.slug)}, ` +
      `${lookup('cities', 'slug', gym.citySlug)}, ` +
      `${lookup('gym_categories', 'key', gym.categoryKey)}, ` +
      `'${gym.genderPolicy}', '${gym.status}')`,
  ).join(',\n');

  const branchValues = SEED_GYMS.flatMap((gym) =>
    gym.branches.map(
      (branch) =>
        `  ('${branchId(branch.key)}', '${gym.tenantId}', '${gymId(gym.key)}', ` +
        `${quote(branch.name)}, ${quote(branch.addressLine1)}, ` +
        `${lookup('cities', 'slug', branch.citySlug)}, ` +
        `${quote(branch.state)}, ${quote(branch.stateCode)}, ${quote(branch.postalCode)}, 'IN', ` +
        // `ST_MakePoint` is LONGITUDE first. `branch.mapper.ts` is where that asymmetry is
        // explained; here the argument names are spelled out so a reader need not remember.
        `ST_SetSRID(ST_MakePoint(${String(branch.lng)}, ${String(branch.lat)}), 4326)::geography, ` +
        `${branch.capacity === null ? 'NULL' : String(branch.capacity)}, ` +
        `'${branch.status}', ${String(branch.isPrimary)})`,
    ),
  ).join(',\n');

  const amenityValues = SEED_GYMS.flatMap((gym) =>
    gym.amenityKeys.map(
      (key) =>
        `  ('${seedUuid('gym_amenity', `${gym.key}:${key}`)}', '${gym.tenantId}', ` +
        `'${gymId(gym.key)}', ${lookup('amenities', 'key', key)})`,
    ),
  ).join(',\n');

  return [
    '-- Seed v0.6 · M-031 — the catalogue. Three gyms, five branches, ten amenity claims.',
    '--',
    '-- RLS is bypassed for the INSERT and restored immediately, exactly as tenants.ts does it:',
    '-- these rows span three tenants and the seed has no tenant context to run inside. Every',
    '-- assertion afterwards connects as app_rw, which is FORCED.',
    "SET session_replication_role = 'replica';",
    '',
    'INSERT INTO gyms (id, tenant_id, name, slug, city_id, category_id, gender_policy, status)',
    'VALUES',
    gymValues,
    'ON CONFLICT (id) DO NOTHING;',
    '',
    'INSERT INTO branches (id, tenant_id, gym_id, name, address_line1, city_id, state,',
    '                      state_code, postal_code, country_code, location, capacity,',
    '                      status, is_primary)',
    'VALUES',
    branchValues,
    'ON CONFLICT (id) DO NOTHING;',
    '',
    '-- The one DELETE grant this milestone issues (G-CRUD-D, Schema.md §2.7). The CLAIM is',
    '-- tenant-owned and retractable; the `amenities` term it draws from is GLOBAL and is only',
    '-- ever retired, never deleted.',
    'INSERT INTO gym_amenities (id, tenant_id, gym_id, amenity_id)',
    'VALUES',
    amenityValues,
    'ON CONFLICT (id) DO NOTHING;',
    '',
    "SET session_replication_role = 'origin';",
  ].join('\n');
}
