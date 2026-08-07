/**
 * M-019 · `iam/types` — §8.1 row 17. The §B3.1 role vocabulary, as types.
 *
 * These are declared here rather than imported from the generated Prisma client on purpose.
 * `PlatformRoleEnum` is generated from the database, so a type derived from it says "whatever
 * the schema currently contains" — which is circular when the thing being asserted is that the
 * schema contains exactly the twelve roles §B3.1 names. The seed cross-checks the two.
 */

/** §B3.1, verbatim and in the document's own order. Twelve. Not eleven, not thirteen. */
export const PLATFORM_ROLES = [
  'VISITOR',
  'USER',
  'MEMBER',
  'GYM_OWNER',
  'GYM_MANAGER',
  'RECEPTIONIST',
  'TRAINER',
  'SUPER_ADMIN',
  'VERIFICATION_OFFICER',
  'SUPPORT_AGENT',
  'FINANCE',
  'MODERATOR',
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/**
 * The five scopes of `ck_roles__scope`.
 *
 * Evaluation is `(role, scope, resource, action)`, NEVER role alone (§B3.1). `GYM_MANAGER` and
 * `GYM_OWNER` share most capabilities and differ almost entirely here — collapsing the pair to
 * a role check is how a branch manager acquires tenant-wide authority.
 */
export const ROLE_SCOPES = ['PUBLIC', 'SELF', 'TENANT', 'BRANCH', 'PLATFORM'] as const;

export type RoleScope = (typeof ROLE_SCOPES)[number];

/**
 * Which scopes are PLATFORM-side.
 *
 * This is the predicate behind `user_roles.tenant_id`: a grant of a platform-scoped role must
 * have `tenant_id IS NULL`, and a grant of a tenant- or branch-scoped role must have one
 * (`ERD.md` §3.1, M-019 AC-4). `roles-seed.int-spec.ts` asserts the seed obeys it.
 */
export const PLATFORM_SCOPES: readonly RoleScope[] = ['PUBLIC', 'SELF', 'PLATFORM'];

/** A role definition as it is seeded. */
export interface RoleDefinition {
  readonly key: PlatformRole;
  readonly scope: RoleScope;
  readonly description: string;
}

/**
 * The §B3.2 legend, as three distinct grants rather than one boolean.
 *
 * The matrix uses `●` full, `▪` own/assigned only, `○` read only, `—` none. Flattening `▪` and
 * `○` into `●` would give a receptionist tenant-wide member editing and a support agent write
 * access to plans — two of the exact escalations the matrix exists to prevent.
 *
 *   FULL      ●  every action on the capability, within the role's scope
 *   OWN       ▪  every action, further narrowed to records the holder owns or is assigned
 *   READ      ○  the read action only
 *   NONE      —  no permission row at all
 */
export const MATRIX_GRANTS = ['FULL', 'OWN', 'READ', 'NONE'] as const;

export type MatrixGrant = (typeof MATRIX_GRANTS)[number];

/** One row of §B3.2: a capability, its permission keys, and what each role gets. */
export interface CapabilityDefinition {
  /** The §B3.2 row label, verbatim, so the table and the code can be diffed by eye. */
  readonly capability: string;
  /** `<module>.<resource>.<action>` for the READ half. `null` when the capability has none. */
  readonly readKey: string | null;
  /** `<module>.<resource>.<action>` for the WRITE half. `null` for read-only capabilities. */
  readonly writeKey: string | null;
  readonly description: string;
  /** Every role's cell. All twelve are listed; `NONE` is written out, never omitted. */
  readonly grants: Readonly<Record<PlatformRole, MatrixGrant>>;
}
