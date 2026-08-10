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
  /**
   * Further READ keys this capability is reached by — `API_Catalog.md` §5.6, whose column header
   * is **"Permission string(s)"**, plural, and whose own rows carry three keys for one capability
   * (*Scan / record check-in*) and two for another (*View audit log*).
   *
   * ┌─ WHY THIS IS DANGEROUS, AND WHAT MAKES A GIVEN USE OF IT SAFE ───────────────────────────────┐
   * │ `permissionsFor()` emits a capability's read key for EVERY grant that is not `NONE`. So      │
   * │ attributing a key here hands it, mechanically, to every role holding the row — and with 42   │
   * │ rows to choose from, any desired holder set can be legalised by naming whichever row happens │
   * │ to contain it. That is **capability shopping**, and it is how a `BLK-19` draft produced four │
   * │ latent privilege escalations.                                                                │
   * │                                                                                              │
   * │ A key belongs here only when all three hold, and the third is the one that actually bites:   │
   * │   1. it addresses the same RESOURCE and SCOPE as the row (not merely a plausible neighbour); │
   * │   2. it is a READ — a write key must never ride in on a read attribution;                    │
   * │   3. a **rank-2** source names the holder set, and the row's non-`NONE` grants match it.     │
   * │      The holder set is READ OFF the requirement and CHECKED against the row — never chosen   │
   * │      by finding the row that yields the holders somebody wanted.                             │
   * └──────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  readonly extraReadKeys?: readonly string[];
  /**
   * Further WRITE keys — same rule as `extraReadKeys`, and strictly more dangerous.
   *
   * `ADR-0043` sold `extraReadKeys` partly on the ground that it *"structurally cannot emit a
   * write"*. `ADR-0047` gives that property up, because `API_Catalog.md` freezes three write
   * strings for one branch capability (`.create`, `.update`, `.deactivate`) and two for the
   * onboarding one. The keys exist in the catalogue; refusing to model them would only mean the
   * routes could not declare them.
   *
   * What replaces the lost property is the gate in `rbac-matrix.spec.ts`, which now covers BOTH
   * fields: an attribution to a multi-holder row must be named in `JUSTIFIED_MULTI_HOLDER` with a
   * rank-2 citation, or the build fails. Emitted only when the grant is not `READ`, so a `READ`
   * cell can never reach one — which is what makes `RECEPTIONIST: 'READ'` on *Add / remove branch*
   * the branch LIST and not the power to delete a branch.
   */
  readonly extraWriteKeys?: readonly string[];
  readonly description: string;
  /** Every role's cell. All twelve are listed; `NONE` is written out, never omitted. */
  readonly grants: Readonly<Record<PlatformRole, MatrixGrant>>;
}
