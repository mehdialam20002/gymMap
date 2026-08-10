/**
 * `catalog/`'s public surface — `FolderStructure.md` §8.1 row 1.
 *
 * `README.md` §4 names six ports and calls this *"the most heavily consumed module in L3"*.
 * **M-031 delivers three of the six**, one more than the milestone's own stated catalogue scope
 * (*"M-031 (`index.ts`, `GYM_TIMEZONE_PORT`)"*). The extra one is `GYM_STATUS_PORT`, and it is not
 * scope creep: `mayDeactivate()` takes `DeactivationFacts.gymStatus`, so `DELETE
 * /v1/tenant/branches/:id` — an M-031 route — cannot run without it, and no other port answers the
 * question. The README gives it to M-032 because M-032 is where `ordering/` needs it; the branch
 * lifecycle needed it first.
 *
 *   `GYM_COMMAND_PORT`      M-032 — create the gym and branches inside the application transaction
 *   `GYM_QUERY_PORT`        M-032 — the gym and its owner, for the review response path
 *   `OPERATING_HOURS_PORT`  M-034 — is this branch open now, in its own zone
 *   `GYM_SEARCH_VIEW_PORT`  the approved-gym read model carrying the rating projection
 *
 * Repositories are NOT exported, and neither are the adapter classes — only the tokens. A consumer
 * that could name `GymTimezonePrismaAdapter` would depend on Prisma through a module boundary that
 * exists to prevent exactly that.
 */

export { CatalogModule } from './catalog.module.js';

export {
  BRANCH_QUERY_PORT,
  type BranchLookupOutcome,
  type BranchQueryPort,
} from './application/ports/branch-query.port.js';

export {
  GYM_TIMEZONE_PORT,
  ianaTimezone,
  type GymTimezoneOutcome,
  type GymTimezonePort,
  type IanaTimezone,
} from './application/ports/gym-timezone.port.js';

export {
  GYM_STATUS_PORT,
  isBlockedForOrdering,
  type GymStatusOutcome,
  type GymStatusPort,
} from './application/ports/gym-status.port.js';

export {
  AFFECTED_MEMBERSHIPS_PORT,
  type AffectedMembershipCount,
  type AffectedMembershipsPort,
} from './application/ports/affected-memberships.port.js';

/**
 * The deactivation decision is exported as a pure function, not behind a use case.
 *
 * `admin/` will need to answer "could this branch be closed?" for the review console before the
 * tenant-facing route exists, and a rule that can only be reached through an HTTP handler gets
 * reimplemented by the second caller. `Gym.md` §12.4 is one rule; there is one place it lives.
 */
export {
  mayDeactivate,
  type DeactivationFacts,
  type DeactivationVerdict,
} from './domain/branch-deactivation.policy.js';

export {
  BRANCH_STATUSES,
  GENDER_POLICIES,
  GYM_STATUSES,
  type BranchIdentity,
  type BranchStatus,
  type GenderPolicy,
  type GymStatus,
} from './types/catalog.types.js';
