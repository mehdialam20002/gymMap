/**
 * `catalog/`'s public surface — `FolderStructure.md` §8.1 row 1.
 *
 * `README.md` §4 names six ports and calls this *"the most heavily consumed module in L3"*.
 * **M-031 delivers two of the six**, which is the milestone's own stated catalogue scope
 * (*"M-031 (`index.ts`, `GYM_TIMEZONE_PORT`)"*). The other four arrive with the milestones the
 * README names against them:
 *
 *   `GYM_COMMAND_PORT`      M-032 — create the gym and branches inside the application transaction
 *   `GYM_STATUS_PORT`       M-032 — is this gym suspended
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
  BRANCH_STATUSES,
  GENDER_POLICIES,
  GYM_STATUSES,
  type BranchIdentity,
  type BranchStatus,
  type GenderPolicy,
  type GymStatus,
} from './types/catalog.types.js';
