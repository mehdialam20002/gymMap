/**
 * M-019 · `iam/permissions.ts` — the §B3.1 roles and the §B3.2 matrix, as data.
 *
 * ┌─ THE 46×12 GRID IS TRANSCRIBED MECHANICALLY, NOT BY HAND ───────────────────────────────────┐
 * │ 552 cells — 42 rows and 504 cells until `ADR-0047` added three under Part C §C10. A human   │
 * │ transcribing them will get some wrong, and a wrong cell is a silent privilege change: one   │
 * │ `—` typed as `●` gives a receptionist the ability to publish plans. That is not hypothetical │
 * │ — applying `ADR-0047` I shifted row 20 by one column, which demoted `GYM_OWNER` to read and │
 * │ handed `SUPPORT_AGENT` full branch write. Counting the cells caught it; nothing else would. │
 * │                                                                                              │
 * │ So `rbac-matrix.spec.ts` re-parses `MASTER_PRD.md` §B3.2 at test time and compares every    │
 * │ cell against this file. The PRD stays the source of truth, and an edit to either side that  │
 * │ is not mirrored in the other fails the build. That is also what keeps `FR-RBAC-05`'s        │
 * │ effective-permissions screen honest: it reads from here.                                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY `●`, `▪` AND `○` ARE THREE GRANTS AND NOT ONE BOOLEAN ─────────────────────────────────┐
 * │ Flattening the legend loses exactly the distinctions the matrix exists to draw:              │
 * │                                                                                              │
 * │   `▪ own/assigned only`  a receptionist edits the members they created, not every member    │
 * │                          in the tenant. Row-level, enforced by the use case.                 │
 * │   `○ read only`          a support agent READS plans. Collapsing `○` into `●` would let      │
 * │                          support change a tenant's pricing, which is `PE-T5`'s refusal.      │
 * │                                                                                              │
 * │ `OWN` and `FULL` therefore resolve to the same permission KEYS; they differ in the row       │
 * │ filter the use case applies. `READ` resolves to the read key alone. That is the whole        │
 * │ mapping, and `permissionsFor()` below is its only implementation.                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ "~180 PERMISSIONS" IS A VOLUME PROJECTION, NOT A REGISTER ─────────────────────────────────┐
 * │ `Schema.md` §4.7 says `permissions` **~180** — in its **Volume** sentence, beside            │
 * │ `user_roles` **520,000** and a 10× column. It is a capacity estimate for a table that grows  │
 * │ as endpoints land, not a list anybody has written down.                                      │
 * │                                                                                              │
 * │ The enumerated, binding source is §B3.2: 46 capabilities. Decomposed into read and write     │
 * │ actions they yield the keys below. Seeding 180 invented keys to match a projection would     │
 * │ put an authorisation matrix nobody specified into the database, and `FR-RBAC-01` fails CI    │
 * │ on an endpoint whose declared permission is undeclared — not on a permission with no         │
 * │ endpoint. The catalogue grows with the endpoints, which is the direction the rule runs.      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import type { CapabilityDefinition, PlatformRole, RoleDefinition } from './types/iam.types.js';

/**
 * §B3.1, verbatim — the Role, Scope and Description columns.
 *
 * `roles.key` is `platform_role_enum`, so a thirteenth role cannot be inserted; this array is
 * what proves the twelve that CAN be inserted are the twelve the PRD names, in its own order.
 */
export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  { key: 'VISITOR', scope: 'PUBLIC', description: 'Unauthenticated' },
  { key: 'USER', scope: 'SELF', description: 'Registered, no active membership' },
  { key: 'MEMBER', scope: 'SELF', description: 'Holds ≥1 active membership' },
  { key: 'GYM_OWNER', scope: 'TENANT', description: 'Full authority over their tenant' },
  {
    key: 'GYM_MANAGER',
    scope: 'BRANCH',
    description: 'Operational authority over assigned branches',
  },
  { key: 'RECEPTIONIST', scope: 'BRANCH', description: 'Front-desk operations' },
  { key: 'TRAINER', scope: 'BRANCH', description: 'Assigned members and sessions' },
  { key: 'SUPER_ADMIN', scope: 'PLATFORM', description: 'Full platform authority' },
  { key: 'VERIFICATION_OFFICER', scope: 'PLATFORM', description: 'Onboarding review only' },
  {
    key: 'SUPPORT_AGENT',
    scope: 'PLATFORM',
    description: 'Read-mostly, impersonation with audit',
  },
  { key: 'FINANCE', scope: 'PLATFORM', description: 'Financial operations' },
  { key: 'MODERATOR', scope: 'PLATFORM', description: 'Content and review moderation' },
];

/**
 * §B3.2, cell for cell, in the document's own row and column order.
 *
 * Generated from `MASTER_PRD.md` and verified against it on every test run — see the header.
 * The `capability` string is the PRD's row label verbatim, which is what makes the comparison
 * possible and what lets a reader diff the two by eye.
 */
export const CAPABILITY_MATRIX: readonly CapabilityDefinition[] = [
  {
    capability: 'Browse marketplace',
    readKey: 'discovery.listing.read',
    writeKey: null,
    description: 'Read published gym listings. Public — no authentication.',
    grants: {
      VISITOR: 'FULL',
      USER: 'FULL',
      MEMBER: 'FULL',
      RECEPTIONIST: 'FULL',
      TRAINER: 'FULL',
      GYM_MANAGER: 'FULL',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'FULL',
      VERIFICATION_OFFICER: 'FULL',
      FINANCE: 'FULL',
      MODERATOR: 'FULL',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'View plan prices',
    readKey: 'catalog.plan_price.read',
    writeKey: null,
    description:
      'Read the price a plan is offered at. The figure BR-PLN-03 revalidates at checkout.',
    grants: {
      VISITOR: 'FULL',
      USER: 'FULL',
      MEMBER: 'FULL',
      RECEPTIONIST: 'FULL',
      TRAINER: 'FULL',
      GYM_MANAGER: 'FULL',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'FULL',
      VERIFICATION_OFFICER: 'FULL',
      FINANCE: 'FULL',
      MODERATOR: 'FULL',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Save favourites',
    readKey: 'discovery.favourite.read',
    writeKey: 'discovery.favourite.write',
    description: 'Add and remove a gym from the caller’s own favourites.',
    grants: {
      VISITOR: 'NONE',
      USER: 'FULL',
      MEMBER: 'FULL',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'NONE',
    },
  },
  {
    capability: 'Compare gyms',
    readKey: 'discovery.comparison.read',
    writeKey: null,
    description: 'Read the side-by-side comparison view.',
    grants: {
      VISITOR: 'FULL',
      USER: 'FULL',
      MEMBER: 'FULL',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'NONE',
    },
  },
  {
    capability: 'Purchase membership',
    readKey: null,
    writeKey: 'ordering.checkout.create',
    description: 'Create an order and take it through checkout.',
    grants: {
      VISITOR: 'NONE',
      USER: 'FULL',
      MEMBER: 'FULL',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'NONE',
    },
  },
  {
    capability: 'View own memberships',
    readKey: 'memberships.own_membership.read',
    writeKey: null,
    description: 'Read the caller’s own memberships, across every tenant they hold one at.',
    grants: {
      VISITOR: 'NONE',
      USER: 'READ',
      MEMBER: 'FULL',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'NONE',
    },
  },
  {
    capability: 'Generate own check-in QR',
    readKey: null,
    writeKey: 'attendance.own_qr.create',
    description: 'Mint a rotating check-in token for the caller’s own membership.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'FULL',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'NONE',
    },
  },
  {
    capability: 'Submit review',
    readKey: null,
    writeKey: 'reviews.review.create',
    description: 'Write a review. BR-REV-01 additionally requires a recorded check-in.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'OWN',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'NONE',
    },
  },
  {
    capability: 'Download own invoice',
    readKey: 'billing.own_invoice.read',
    writeKey: null,
    description: 'Read and download the caller’s own invoice PDF.',
    grants: {
      VISITOR: 'NONE',
      USER: 'FULL',
      MEMBER: 'FULL',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'NONE',
    },
  },
  {
    capability: 'Request refund',
    readKey: 'refunds.refund_request.read',
    writeKey: 'refunds.refund_request.create',
    description: 'Raise a refund request against an order.',
    grants: {
      VISITOR: 'NONE',
      USER: 'OWN',
      MEMBER: 'OWN',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'FULL',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'FULL',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Scan / record check-in',
    readKey: 'attendance.check_in.read',
    writeKey: 'attendance.check_in.create',
    description: 'Record an attendance event at a branch.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'FULL',
      TRAINER: 'FULL',
      GYM_MANAGER: 'FULL',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'NONE',
    },
  },
  {
    capability: 'Manual check-in override',
    readKey: null,
    writeKey: 'attendance.override.create',
    description: 'Admit a member the ten-step validation refused, with a reason code.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'FULL',
      TRAINER: 'NONE',
      GYM_MANAGER: 'FULL',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'View branch attendance',
    readKey: 'attendance.branch_attendance.read',
    writeKey: null,
    description: 'Read the attendance log for a branch.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'OWN',
      TRAINER: 'OWN',
      GYM_MANAGER: 'FULL',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'READ',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'READ',
    },
  },
  {
    capability: 'Create member (walk-in)',
    readKey: 'crm.member.read',
    writeKey: 'crm.member.create',
    description: 'Create a member record for someone who walked in without an account.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'FULL',
      TRAINER: 'NONE',
      GYM_MANAGER: 'FULL',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'NONE',
    },
  },
  {
    capability: 'Edit member record',
    readKey: 'crm.member_record.read',
    writeKey: 'crm.member_record.update',
    description: 'Change a member’s tenant-side record.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'OWN',
      TRAINER: 'NONE',
      GYM_MANAGER: 'FULL',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'READ',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'READ',
    },
  },
  {
    capability: 'Record offline payment',
    readKey: null,
    writeKey: 'payments.offline_payment.create',
    description: 'Record a cash or bank payment taken outside the gateway.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'FULL',
      TRAINER: 'NONE',
      GYM_MANAGER: 'FULL',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'NONE',
    },
  },
  {
    capability: 'Create / edit plan',
    readKey: 'plans.plan.read',
    writeKey: 'plans.plan.write',
    description: 'Author a membership plan and its terms.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'READ',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'READ',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'READ',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'READ',
    },
  },
  {
    capability: 'Publish plan to marketplace',
    readKey: null,
    writeKey: 'plans.plan_publication.create',
    description: 'Make a plan publicly purchasable.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Edit gym profile',
    readKey: 'catalog.gym_profile.read',
    writeKey: 'catalog.gym_profile.update',
    description: 'Change gym-level profile content.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'OWN',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'READ',
      VERIFICATION_OFFICER: 'READ',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Add / remove branch',
    /*
     * ┌─ FIVE KEYS, AND `catalog.branch.write` IS GONE — `BLK-19`, closed by `ADR-0047` ─────────────┐
     * │ `API_Catalog.md` 940–944 freezes five strings for the five branch routes: `.list`, `.read`, │
     * │ `.create`, `.update`, `.deactivate`. This row used to carry `catalog.branch.write`, which   │
     * │ `Security.md` §3.3.1 gives — and which appears on **no route in the catalogue**. It is      │
     * │ removed rather than kept alongside, because a permission with no endpoint is an ungoverned  │
     * │ grant (§5.6's own words) and `PG-7` cannot see it.                                           │
     * │                                                                                             │
     * │ Five keys from one row is the DOCUMENTED shape, not a workaround: §5.6's column header is   │
     * │ **"Permission string(s)"**, plural, and its own rows carry three for one capability.        │
     * └─────────────────────────────────────────────────────────────────────────────────────────────┘
     */
    readKey: 'catalog.branch.read',
    extraReadKeys: ['catalog.branch.list'],
    writeKey: 'catalog.branch.create',
    extraWriteKeys: ['catalog.branch.update', 'catalog.branch.deactivate'],
    description:
      'Add a branch to the tenant, or retire one. Branch-scoped roles get the list only.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      /*
       * `READ`, not `NONE`, since `ADR-0047`. `BLK-19` was open on exactly this: `Gym.md` 167 gave
       * the branch list to these three and `§B3.2` gave them nothing, and a rank-3 API document
       * cannot widen a rank-2 register. The owner widened the register instead.
       *
       * `READ` is what makes it the list ONLY. `permissionsFor()` emits the write keys for every
       * grant that is not `READ`, so these three get `.read` and `.list` and cannot reach `.create`,
       * `.update` or `.deactivate` — which stay with the owner. Asserted per role in the spec,
       * because the difference between `READ` and `OWN` here is the difference between seeing a
       * branch and deleting one.
       */
      RECEPTIONIST: 'READ',
      TRAINER: 'READ',
      GYM_MANAGER: 'READ',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Invite / manage staff',
    readKey: 'staff.staff_member.read',
    writeKey: 'staff.staff_member.write',
    description: 'Invite staff and change their role and branch scope.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'OWN',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Assign members to trainer',
    readKey: 'staff.trainer_assignment.read',
    writeKey: 'staff.trainer_assignment.write',
    description: 'Bind a member to a trainer.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'READ',
      GYM_MANAGER: 'FULL',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'NONE',
    },
  },
  {
    capability: 'Create workout plan',
    readKey: 'staff.workout_plan.read',
    writeKey: 'staff.workout_plan.write',
    description: 'Author a workout plan for an assigned member.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'OWN',
      GYM_MANAGER: 'FULL',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'NONE',
    },
  },
  {
    capability: 'Create coupon',
    readKey: 'plans.coupon.read',
    writeKey: 'plans.coupon.write',
    description: 'Author a discount coupon and its funding source.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'READ',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Respond to review',
    readKey: 'reviews.review_response.read',
    writeKey: 'reviews.review_response.create',
    description: 'Publish a tenant response beneath a review.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'FULL',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'READ',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Moderate / unpublish review',
    readKey: 'reviews.moderation.read',
    writeKey: 'reviews.moderation.write',
    description: 'Hide or restore a review on moderation grounds.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'FULL',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'View tenant reports',
    readKey: 'reporting.tenant_report.read',
    writeKey: null,
    description: 'Read the tenant’s operational and financial reports.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'OWN',
      TRAINER: 'OWN',
      GYM_MANAGER: 'OWN',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'READ',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'READ',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'READ',
    },
  },
  {
    capability: 'View settlement statements',
    readKey: 'settlements.statement.read',
    writeKey: null,
    description: 'Read settlement batches and their line detail.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'READ',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'FULL',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Change payout bank account',
    readKey: null,
    writeKey: 'settlements.payout_account.update',
    description: 'Change where the tenant’s money is sent.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Export tenant data',
    readKey: null,
    writeKey: 'reporting.tenant_export.create',
    description: 'Produce a bulk export of the tenant’s data.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'FULL',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Review KYC documents',
    readKey: 'onboarding.kyc_document.read',
    writeKey: 'onboarding.kyc_review.create',
    description: 'Open and assess an applicant’s KYC documents.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'FULL',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Approve / reject gym',
    readKey: null,
    writeKey: 'onboarding.application_decision.create',
    description: 'Decide a gym application. BR-GYM-01 gates visibility on it.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'FULL',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Suspend tenant',
    readKey: null,
    writeKey: 'admin.tenant_suspension.create',
    description: 'Suspend a tenant, removing its listings from the marketplace.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Configure commission rate',
    readKey: 'admin.commission_rule.read',
    writeKey: 'admin.commission_rule.write',
    description: 'Set the platform commission a tenant is charged.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'READ',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Approve payout run',
    readKey: 'settlements.payout_run.read',
    writeKey: 'settlements.payout_run.approve',
    description: 'Release a settlement batch for payout.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'FULL',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Approve out-of-policy refund',
    readKey: 'refunds.policy_exception.read',
    writeKey: 'refunds.policy_exception.approve',
    description: 'Approve a refund the tenant’s own policy would refuse.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'READ',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Handle chargeback',
    readKey: 'payments.dispute.read',
    writeKey: 'payments.dispute.write',
    description: 'Work a gateway dispute through to its outcome.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'READ',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'FULL',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Impersonate user',
    /*
     * ┌─ THREE DIFFERENT STRINGS EXISTED FOR THIS ONE CAPABILITY, AND ONLY ONE PAIR IS REAL ────────┐
     * │ `API_Catalog.md` 723-724 — the frozen endpoint contract, and what `PG-1` and `PG-7` check —  │
     * │ names `iam.impersonation.start` and `iam.impersonation.end` on the two routes.                │
     * │ `Security.md` row 38 agrees, giving `iam.impersonation.start`.                                │
     * │ This row carried `support.impersonation.create`, which is on **no route anywhere**.           │
     * │ `iam/permissions.ts` separately declared `iam.impersonation.manage`, which is in **neither** │
     * │ the register nor the catalogue — invented by the module, exactly `BLK-10`'s shape.             │
     * │                                                                                              │
     * │ The catalogue wins on STRINGS: `§5.6` makes the join rank 3's job, and a permission on no    │
     * │ route is what §5.6 itself calls an ungoverned grant. Same disposition as                      │
     * │ `catalog.branch.write` under `ADR-0047`. The ROW and its holders are untouched — rank-2 data. │
     * └──────────────────────────────────────────────────────────────────────────────────────────────┘
     */
    readKey: null,
    writeKey: 'iam.impersonation.start',
    extraWriteKeys: ['iam.impersonation.end'],
    description: 'Act as another user. Always audited, never silent.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'FULL',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Manage platform users',
    readKey: 'iam.platform_user.read',
    writeKey: 'iam.platform_user.write',
    /*
     * `FR-RBAC-05`'s effective-permission inspector — `BLK-11`, resolved by `ADR-0043`.
     *
     * `API_Catalog.md` 1077 freezes `GET /admin/users/:id/permissions` with this key, and 1119
     * marks the route a **derived row**: *"`FR-RBAC-05` requires effective permissions to be
     * inspectable by Super Admin; without an endpoint the requirement is unimplementable."* So the
     * capability does not arrive from a rank-3 document — it arrives from `FR-RBAC-05` itself
     * (`MASTER_PRD.md` 1174, rank 2), which names its own holder: **Super Admin**. Rank 3 supplied
     * only the string, which §5.6 says is exactly rank 3's job.
     *
     * The three tests in the type's header, checked rather than asserted:
     *   1. Resource and scope — the row governs platform-side accounts; the route's `scope` column
     *      is `platform` and its subject is a platform user's own permission set.
     *   2. Read — `read_permissions`, and it rides in `extraReadKeys`, which cannot emit a write.
     *   3. Holder set — this row's only non-`NONE` grant is `SUPER_ADMIN`, and `FR-RBAC-05` says
     *      Super Admin. Because the row is a SINGLETON, no attribution to it can widen anything to
     *      any other role; the escalation mechanism behind all four `BLK-19` findings is not
     *      merely avoided here, it is structurally absent. `rbac-matrix.spec.ts` pins all twelve.
     *
     * The module segment differs from this row's other two (`admin` vs `iam`) and that is correct,
     * not an oversight: §5.1 constrains `<module>` to be one of `§C1.3`'s 23 and nothing more, and
     * §7.3.1 makes it the module that OWNS THE ENDPOINT — which for `/admin/users/:id/permissions`
     * is `admin/`. No rule anywhere requires a capability's keys to share a prefix.
     */
    extraReadKeys: ['admin.user.read_permissions'],
    description: 'Create, suspend and re-role platform-side accounts.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Toggle feature flags',
    readKey: 'admin.feature_flag.read',
    writeKey: 'admin.feature_flag.write',
    description: 'Change a release or operations flag.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'View audit log',
    readKey: 'audit.audit_log.read',
    writeKey: null,
    description: 'Read the append-only audit log.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'OWN',
      SUPPORT_AGENT: 'READ',
      VERIFICATION_OFFICER: 'READ',
      FINANCE: 'READ',
      MODERATOR: 'READ',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Manage taxonomy (amenities etc.)',
    readKey: 'catalog.taxonomy.read',
    writeKey: 'catalog.taxonomy.write',
    description: 'Edit the platform reference taxonomies.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'FULL',
      SUPER_ADMIN: 'FULL',
    },
  },

  // ═════════════════════════════════════════════════════════════════════════════════════════════
  // Rows 43–45, added 2026-08-10 under Part C §C10 by the owner — `ADR-0047`.
  //
  // APPENDED, not inserted, and the PRD says why in the same words: the register is referenced by
  // ROW NUMBER in `PHASES.md`, `DECISION_LOG.md` and several source comments, and inserting in
  // place would silently invalidate every one of them with no test to catch it.
  // ═════════════════════════════════════════════════════════════════════════════════════════════

  {
    capability: 'Submit own gym application',
    /*
     * `BLK-14`, closed. The matrix held two `onboarding.*` capabilities and BOTH were the
     * reviewer's — rows 31 and 32 — so a gym owner filling the signup wizard had no permission to
     * declare, and `PG-1` requires every route to declare one.
     *
     * All five strings are already frozen verbatim in `API_Catalog.md` §3.9, so no vocabulary is
     * invented here. `extraWriteKeys` carries `.delete` because a draft attachment must be
     * removable before submission; after submission the version is frozen (`FR-ONB-08`).
     */
    readKey: 'onboarding.application.read',
    extraReadKeys: ['onboarding.kyc_document.list'],
    writeKey: 'onboarding.application.submit',
    extraWriteKeys: ['onboarding.kyc_document.upload', 'onboarding.kyc_document.delete'],
    description: 'Fill, attach documents to, and submit the tenant’s own onboarding application.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      // A `BRANCH`-scoped role, and an application is a tenant-level legal act — legal entity name,
      // PAN, registration number, bank account. Not a branch's business.
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      /*
       * `NONE`, deliberately, and this is the one cell most likely to be "corrected" by someone who
       * assumes `SUPER_ADMIN` holds everything. It must not: `BR-GYM-03` requires a human approval,
       * and a platform actor who can AUTHOR the application can approve an artefact they wrote.
       * `SUPER_ADMIN` already holds rows 31 and 32 — the reviewing half — which is the whole point.
       */
      SUPER_ADMIN: 'NONE',
    },
  },
  {
    capability: 'View platform overview',
    /*
     * `SCR-ADM-001`. Half of `BLK-10`: `admin/permissions.ts` declared this key and it existed in
     * no row, so `PermissionsGuard` refused it as `UNKNOWN_PERMISSION` — deny-by-default working
     * correctly, and revealing that the key had been invented by the module.
     *
     * `SUPPORT_AGENT` is `READ` by the owner's decision. Read-only by construction: a `READ` cell
     * yields read keys and never write keys, and this capability has no write key at all.
     */
    readKey: 'admin.platform_overview.read',
    writeKey: null,
    description: 'Aggregate counts across every tenant.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'READ',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'View gym register',
    /*
     * `SCR-ADM-004` and `SCR-ADM-002`, which read the same list. The other half of `BLK-10`.
     *
     * Worth stating what `SUPPORT_AGENT: 'READ'` exposes, because the owner was told and chose it:
     * the register carries every tenant's commercial terms, including effective commission rates.
     */
    readKey: 'admin.gym_register.read',
    writeKey: null,
    description: 'The platform-wide gym register and the approval queue.',
    grants: {
      VISITOR: 'NONE',
      USER: 'NONE',
      MEMBER: 'NONE',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'NONE',
      SUPPORT_AGENT: 'READ',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'FULL',
    },
  },
  {
    capability: 'Create own tenant',
    /*
     * `§B3.2` row 46, added 2026-08-10 by the owner under Part C §C10 — wizard step 1.
     *
     * `POST /tenants` declared `tenancy.tenant.create` and no row carried it, so `M-027`'s FIRST
     * step was a second `BLK-14`-shaped hole that nobody had raised: row 43 unblocked the wizard
     * steps AFTER a tenant exists, and not the one that creates it.
     *
     * ┌─ THE HOLDERS, AND WHY THEY ARE NOT JUST `GYM_OWNER` ─────────────────────────────────────┐
     * │ `Gym.md` §2.1 row 1's capability cell reads *"(pre-tenant; the caller is a `USER`)"* — at │
     * │ the moment this route is called the person owns nothing, so `GYM_OWNER` would be a role   │
     * │ they acquire BY calling it. The owner's answer was `USER`, and the marketplace argument is │
     * │ the right one: any registered person may start listing a gym.                              │
     * │                                                                                          │
     * │ `MEMBER` follows by coherence — a member is a registered person who happens to hold a      │
     * │ membership, and buying one must not stop them opening a gym of their own.                  │
     * │                                                                                          │
     * │ `GYM_OWNER` is REQUIRED rather than inferred: `BR-TEN-02` says *"One owner account may own │
     * │ multiple tenants."* Without it, an owner could never onboard a second gym.                 │
     * │                                                                                          │
     * │ `SUPER_ADMIN` is `—` for row 43's reason: a platform actor must not create the tenant it   │
     * │ later approves (`BR-GYM-03`).                                                              │
     * └──────────────────────────────────────────────────────────────────────────────────────────┘
     */
    readKey: null,
    writeKey: 'tenancy.tenant.create',
    description: 'Register a new gym business. Wizard step 1 — the caller owns nothing yet.',
    grants: {
      VISITOR: 'NONE',
      USER: 'FULL',
      MEMBER: 'FULL',
      RECEPTIONIST: 'NONE',
      TRAINER: 'NONE',
      GYM_MANAGER: 'NONE',
      GYM_OWNER: 'FULL',
      SUPPORT_AGENT: 'NONE',
      VERIFICATION_OFFICER: 'NONE',
      FINANCE: 'NONE',
      MODERATOR: 'NONE',
      SUPER_ADMIN: 'NONE',
    },
  },
];

/**
 * Every permission key the matrix declares, deduplicated and sorted.
 *
 * Sorted so the seed's insertion order is stable, which is what lets `SEED_VERSION` mean
 * anything: a set whose iteration order drifted would produce a different checksum from an
 * identical catalogue.
 */
export const PERMISSION_KEYS: readonly string[] = [
  ...new Set(
    CAPABILITY_MATRIX.flatMap((c) => [
      c.readKey,
      c.writeKey,
      ...(c.extraReadKeys ?? []),
      ...(c.extraWriteKeys ?? []),
    ]).filter((k): k is string => k !== null),
  ),
].sort();

/** Does this `§B3.2` row declare this permission string, through ANY of its four key fields? */
export function capabilityDeclares(entry: CapabilityDefinition, permission: string): boolean {
  return (
    entry.readKey === permission ||
    entry.writeKey === permission ||
    (entry.extraReadKeys?.includes(permission) ?? false) ||
    (entry.extraWriteKeys?.includes(permission) ?? false)
  );
}

/**
 * The permission string a module's `permissions.ts` may declare — naming BOTH the `§B3.2` row and
 * the key, and refusing unless the row actually declares it.
 *
 * ┌─ WHY BOTH, WHEN `readKeyFor(label)` ALONE WOULD BE SHORTER ──────────────────────────────────┐
 * │ `onboarding/permissions.ts` pioneered reading keys out of the matrix by label, which catches │
 * │ the `BLK-10` failure — a key invented by its module, which `PermissionsGuard` then refuses as │
 * │ `UNKNOWN_PERMISSION` at request time rather than at build time.                                │
 * │                                                                                              │
 * │ It does not catch the next failure along: asking for the read key of the WRONG row. That     │
 * │ returns a real, resolvable key attributed to a capability nobody checked, and it is exactly  │
 * │ the shape of `ADR-0043`'s capability shopping. Naming both makes the attribution reviewable  │
 * │ in the same line it is used, and a mismatch throws at import.                                 │
 * │                                                                                              │
 * │ It also reaches `extraReadKeys` and `extraWriteKeys`, which the two older helpers cannot —    │
 * │ and since `ADR-0047` those carry five of the eight newest keys.                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function permissionOf(capability: string, permission: string): string {
  const entry = CAPABILITY_MATRIX.find((row) => row.capability === capability);
  if (entry === undefined) {
    throw new Error(
      `§B3.2 has no capability labelled "${capability}". A module must not invent one — that is ` +
        'BLK-10, and PermissionsGuard would refuse the key as UNKNOWN_PERMISSION at request time.',
    );
  }
  if (!capabilityDeclares(entry, permission)) {
    throw new Error(
      `"${capability}" does not declare "${permission}". Attributing a key to the wrong row is ` +
        "capability shopping (ADR-0043): it resolves, and it grants the row's holders rather " +
        'than the ones the requirement names.',
    );
  }
  return permission;
}

/** `<module>.<resource>.<action>` — the shape `api-gates` PG-3 enforces on every route. */
const KEY_SHAPE = /^([a-z][a-z0-9]*)\.([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)$/;

export interface ParsedPermissionKey {
  readonly module: string;
  readonly resource: string;
  readonly action: string;
}

/** Splits a key into its three parts, or throws. `permissions.resource`/`action` come from here. */
export function parsePermissionKey(key: string): ParsedPermissionKey {
  const match = KEY_SHAPE.exec(key);
  if (match === null) {
    throw new Error(
      `"${key}" is not a permission key. The shape is <module>.<resource>.<action>, the same ` +
        'shape api-gates PG-3 enforces on every route — a key of any other shape matches no ' +
        'route, and a permission that matches no route guards nothing while looking exactly ' +
        'like one that does.',
    );
  }
  return { module: match[1]!, resource: match[2]!, action: match[3]! };
}

/**
 * The permission keys one role holds, from the matrix.
 *
 * `FULL` and `OWN` yield the same keys — the difference between them is the ROW FILTER the use
 * case applies, not the capability it declares (see the header). `READ` yields the read key
 * only, and a capability with no read key yields nothing for a `READ` cell, which is the
 * correct answer: there is nothing to read.
 */
export function permissionsFor(role: PlatformRole): readonly string[] {
  const keys = new Set<string>();

  for (const capability of CAPABILITY_MATRIX) {
    const grant = capability.grants[role];
    if (grant === 'NONE') continue;

    if (capability.readKey !== null) keys.add(capability.readKey);
    // Reads, so a `READ` cell holds them exactly as it holds `readKey`. See the type's header for
    // the three tests a key must pass before it may be attributed here.
    for (const extra of capability.extraReadKeys ?? []) keys.add(extra);
    if (grant !== 'READ' && capability.writeKey !== null) keys.add(capability.writeKey);
    // Gated on the SAME `grant !== 'READ'` as `writeKey`. A `READ` cell reaching a write key would
    // make `○` and `●` the same thing, which is the one distinction this whole matrix encodes.
    if (grant !== 'READ') for (const extra of capability.extraWriteKeys ?? []) keys.add(extra);
  }

  return [...keys].sort();
}

/** Every `(role, permission)` pair the matrix implies — one `role_permissions` row each. */
export function rolePermissionPairs(): readonly { role: PlatformRole; permission: string }[] {
  return ROLE_DEFINITIONS.flatMap((role) =>
    permissionsFor(role.key).map((permission) => ({ role: role.key, permission })),
  );
}

/**
 * A short description per key, for the `permissions.description` column and `FR-RBAC-05`.
 *
 * Derived from the capability's description rather than written twice. Two prose descriptions
 * of one capability drift, and the one on the screen is the one nobody maintains.
 */
export function describePermission(key: string): string {
  const capability = CAPABILITY_MATRIX.find((c) => c.readKey === key || c.writeKey === key);
  if (capability === undefined) {
    throw new Error(`"${key}" is not in the §B3.2 matrix.`);
  }
  const half = capability.readKey === key ? 'Read' : 'Write';
  return `§B3.2 “${capability.capability}” (${half}). ${capability.description}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// M-022 · session-management keys, which are NOT in the §B3.2 matrix.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `iam/`'s own endpoint permissions — `FR-RBAC-01`, `PG-3`.
 *
 * ┌─ WHY THESE ARE NOT IN `CAPABILITY_MATRIX` ──────────────────────────────────────────────────┐
 * │ §B3.2's forty-two capabilities describe what a ROLE may do to the platform. Reading and     │
 * │ revoking your own sessions is not one of those: every authenticated principal has it,       │
 * │ including a `USER` with no memberships, because it is the mechanism by which a member       │
 * │ secures their own account. Adding rows to the matrix for them would put twelve `●` cells    │
 * │ into a grid that is verified against the PRD, and the verification would fail — correctly.  │
 * │                                                                                              │
 * │ They exist as KEYS anyway because `FR-RBAC-01` requires every endpoint to declare one and   │
 * │ `PG-1` fails a route that does not. What actually scopes them is the `/me` audience: `AZ4`  │
 * │ says a `/me` route acts on the caller's own rows, and the repository enforces that in its   │
 * │ `WHERE` clause rather than trusting the permission to have done it.                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export const IAM_PERMISSIONS = {
  /** `FR-AUTH-09` · `GET /auth/sessions`. Read your own device sessions. */
  OWN_SESSION_READ: 'iam.session.list',
  /** `FR-AUTH-10` · `DELETE /auth/sessions/:id`. Sign one of your own devices out. */
  OWN_SESSION_REVOKE: 'iam.session.revoke',

  /*
   * ┌─ THREE MFA KEYS, NOT ONE — AND THE COLLAPSE WAS A RANK-5 OVERRIDE ──────────────────────────┐
   * │ This was a single `iam.own_mfa.manage`, with a comment arguing the merge on merit: "what     │
   * │ separates them is not authority — it is the same person acting on the same row — but the     │
   * │ POLICY and re-authentication, both of which a permission cannot express."                     │
   * │                                                                                             │
   * │ The argument is sound and it is not this file's to make. `API_Catalog.md` 720-722 freezes    │
   * │ **three** strings on three routes; a rank-5 constant cannot merge two rank-3 rows. If the    │
   * │ merge is right it is a `§C10` amendment to the catalogue, and until then the catalogue wins. │
   * └─────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  /** `FR-AUTH-07` · `POST /auth/mfa/enrol`. */
  OWN_MFA_ENROL: 'iam.mfa.enrol',
  /** `FR-AUTH-07` · `POST /auth/mfa/verify`. */
  OWN_MFA_VERIFY: 'iam.mfa.verify',
  /** `FR-AUTH-07` · `DELETE /auth/mfa`. */
  OWN_MFA_DISABLE: 'iam.mfa.disable',

  /**
   * `POST /auth/impersonate` — `API_Catalog.md` 723. Was `iam.impersonation.manage`, a string in
   * neither the register nor the catalogue; `ADR-0047`'s companion fix put the row on the two the
   * catalogue actually freezes. See the `Impersonate user` row for the three-way history.
   */
  IMPERSONATION_START: permissionOf('Impersonate user', 'iam.impersonation.start'),
  /** `POST /auth/impersonate/end` — `API_Catalog.md` 724, auth mode `support`. */
  IMPERSONATION_END: permissionOf('Impersonate user', 'iam.impersonation.end'),
} as const;

/**
 * The keys every AUTHENTICATED principal holds, which `§B3.2` deliberately does not contain.
 *
 * ┌─ AN EXPLICIT LIST, NEVER A PATTERN ──────────────────────────────────────────────────────────┐
 * │ The tempting shape is `key.startsWith('iam.session.') || key.startsWith('iam.mfa.')`. That is │
 * │ a rule an attacker satisfies by NAMING A ROUTE WELL: any future handler under those prefixes  │
 * │ is admitted for every authenticated caller, with no review and no diff anyone would question. │
 * │                                                                                              │
 * │ So it is five strings, enumerated, each answerable in review. Adding a sixth is a visible     │
 * │ line in a file whose whole subject is who may do what.                                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY THESE ARE NOT `§B3.2` ROWS, AND WHY THAT IS NOT A LOOPHOLE ─────────────────────────────┐
 * │ §B3.2's rows are capabilities a ROLE exercises against tenant resources. "Read your own       │
 * │ sessions" is held by every authenticated principal including a `USER` with no membership — a  │
 * │ row for it would be twelve `●` cells, and `RB2`'s drift job would fail the build against the  │
 * │ PRD, correctly.                                                                                │
 * │                                                                                              │
 * │ **The permission is not what scopes these.** `AZ4` makes a `/me` route act on the caller's    │
 * │ own rows, and the handler enforces it: `revokeOne(sessionId, principal.sub)` returns 404 for  │
 * │ somebody else's session id — indistinguishable from one that does not exist. Admitting the    │
 * │ key grants the ROUTE, never the row. A future route that declared one of these against        │
 * │ another user's record would be a bug in that route, and the audit for it is this list.        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
/**
 * Keys held by any principal whose grant REACHES the resource, but which are not `§B3.2` rows.
 *
 * ┌─ ONE ENTRY, AND IT IS A DIAGNOSTIC RATHER THAN A CAPABILITY ─────────────────────────────────┐
 * │ `tenancy.ping.read` gates `GET /v1/tenant/ping`, which `M-012` built so the whole chain —    │
 * │ token to middleware to guard to repository to RLS policy to response — could be exercised     │
 * │ end to end before any business logic depended on it. It is in `_inventory.generated.ts`,     │
 * │ which `PG-4` requires.                                                                        │
 * │                                                                                              │
 * │ **Separate from `SELF_SERVICE_PERMISSIONS`, and the difference matters.** A self-service key │
 * │ acts on the caller's OWN row, so the handler scopes it and the guard need not. This returns   │
 * │ TENANT data — trading name and the like — so the tenant scope check must still run. Admitting │
 * │ it the self-service way would let any authenticated principal ping any tenant, which is       │
 * │ `BR-TEN-01`. It is admitted past the matrix lookup only; `scopeReaches()` still decides.      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export const SCOPED_NON_MATRIX_PERMISSIONS: readonly string[] = ['tenancy.ping.read'];

export const SELF_SERVICE_PERMISSIONS: readonly string[] = [
  IAM_PERMISSIONS.OWN_SESSION_READ,
  IAM_PERMISSIONS.OWN_SESSION_REVOKE,
  IAM_PERMISSIONS.OWN_MFA_ENROL,
  IAM_PERMISSIONS.OWN_MFA_VERIFY,
  IAM_PERMISSIONS.OWN_MFA_DISABLE,
];

export type IamPermission = (typeof IAM_PERMISSIONS)[keyof typeof IAM_PERMISSIONS];
