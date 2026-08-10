/**
 * `M-031` · The catalogue's shared shapes.
 *
 * Mirrors of the two enums `0_init` created, and the read shapes the module's ports return.
 * Declared here rather than imported from `@prisma/client` so that `application/` and `domain/`
 * never depend on the ORM — the boundary `FolderStructure.md` §8.1 draws, and the reason a
 * repository can be swapped without touching a use case.
 */

/** `gym_status_enum`. No automated path may set `APPROVED` — `BR-GYM-01`, `BR-GYM-03`. */
export const GYM_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SUSPENDED', 'CLOSED'] as const;
export type GymStatus = (typeof GYM_STATUSES)[number];

/**
 * `branch_status_enum` — two values, and `Gym.md` §12.4 is why there is no third.
 *
 * Deactivation is `status → 'INACTIVE'` **with `deleted_at` set**, never a hard delete: *"a branch
 * is named by every historical attendance row and every invoice"*. A `DELETED` member would be a
 * second way to express the same state, and two ways to say deleted is how a report counts a
 * branch twice.
 */
export const BRANCH_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type BranchStatus = (typeof BRANCH_STATUSES)[number];

/** `gender_policy_enum`. */
export const GENDER_POLICIES = ['MIXED', 'WOMEN_ONLY', 'MEN_ONLY', 'SCHEDULED'] as const;
export type GenderPolicy = (typeof GENDER_POLICIES)[number];

/**
 * A branch as other modules see it — `BRANCH_QUERY_PORT`'s shape.
 *
 * ┌─ `gymId` IS ON IT, AND THAT IS THE POINT OF THE PORT ────────────────────────────────────────┐
 * │ `catalog/README.md` §4 states the question this port answers: *"Does this branch exist, and   │
 * │ does it belong to this gym (edge 23)?"* Both halves, in one answer, because a caller that     │
 * │ receives only "exists" will pair a branch with the wrong gym eventually — `plans/`,           │
 * │ `staff/`, `ordering/` and `attendance/` all take a branch id from a request body.             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * No `location`, no address lines: this is the identity projection, not the row. A consumer that
 * needs an address is asking a different question and should say so.
 */
export interface BranchIdentity {
  readonly id: string;
  readonly gymId: string;
  readonly name: string;
  readonly status: BranchStatus;
  readonly isPrimary: boolean;
}
