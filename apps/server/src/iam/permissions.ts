/**
 * M-019 · `iam/permissions.ts` — the §B3.1 roles and the §B3.2 matrix, as data.
 *
 * ┌─ THE 42×12 GRID IS TRANSCRIBED MECHANICALLY, NOT BY HAND ───────────────────────────────────┐
 * │ 504 cells. A human transcribing them will get some wrong, and a wrong cell is a silent      │
 * │ privilege change: one `—` typed as `●` gives a receptionist the ability to publish plans.   │
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
 * │ The enumerated, binding source is §B3.2: 42 capabilities. Decomposed into read and write     │
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
    readKey: 'catalog.branch.read',
    writeKey: 'catalog.branch.write',
    description: 'Add a branch to the tenant, or retire one.',
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
    readKey: null,
    writeKey: 'support.impersonation.create',
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
    CAPABILITY_MATRIX.flatMap((c) => [c.readKey, c.writeKey]).filter(
      (k): k is string => k !== null,
    ),
  ),
].sort();

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
    if (grant !== 'READ' && capability.writeKey !== null) keys.add(capability.writeKey);
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
  /** `FR-AUTH-09`. Read your own device sessions. */
  OWN_SESSION_READ: 'iam.own_session.read',
  /** `FR-AUTH-10`. Sign one of your own devices out. */
  OWN_SESSION_REVOKE: 'iam.own_session.revoke',
  /**
   * `FR-AUTH-07`. Manage your OWN second factor — enrol, confirm, present, remove.
   *
   * Same category as the two above and outside `§B3.2` for the same reason: every authenticated
   * principal manages their own account security, including a `USER` with no memberships. Adding a
   * matrix row would put twelve cells into a grid verified against the PRD, and that verification
   * would fail, correctly.
   *
   * One key for all four operations rather than read/write. What separates them is not authority —
   * it is the same person acting on the same row — but the POLICY (`mfaRequirementForPrincipal`)
   * and re-authentication, both of which a permission cannot express.
   */
  OWN_MFA_MANAGE: 'iam.own_mfa.manage',

  /**
   * `FR-AUTH-12`. Start and end an impersonation.
   *
   * Outside `§B3.2` like the two above, and for a sharper reason than "every principal has it":
   * NOT every principal has it. Who may impersonate is `MAY_IMPERSONATE` in the policy — a
   * deliberate two-role list — because "may borrow an identity" is not a capability the matrix
   * expresses, and inferring it from permissions is how a broad-read role like `FINANCE` would
   * acquire it by accident.
   *
   * The key exists so the route can declare one (`FR-RBAC-01`, `PG-1`); the POLICY is the control.
   */
  IMPERSONATION_MANAGE: 'iam.impersonation.manage',
} as const;

export type IamPermission = (typeof IAM_PERMISSIONS)[keyof typeof IAM_PERMISSIONS];
