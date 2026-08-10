/**
 * `M-031` · `catalog/` — the tenant's physical footprint.
 *
 * ┌─ NO CONTROLLERS, AND IT IS `BLK-19` RATHER THAN AN OMISSION ─────────────────────────────────┐
 * │ `catalog/README.md` §4 says `controllers/`, `dto/` and `permissions.ts` are mandatory here —  │
 * │ this is not one of the four provider-only modules. The five branch routes are specified down  │
 * │ to their request bodies in `apis/Gym.md` §12, and four of them cannot declare a permission.   │
 * │                                                                                              │
 * │ `API_Catalog.md` names `catalog.branch.list`, `.create`, `.read`, `.update`, `.deactivate`;   │
 * │ `Security.md` and the shipped `CAPABILITY_MATRIX` decompose `§B3.2` row 20 into               │
 * │ `catalog.branch.read` and `catalog.branch.write` and nothing else. Only `.read` is in both,   │
 * │ and `§B3.2` holds no key strings at all to break the tie. Both documents are rank 3.          │
 * │                                                                                              │
 * │ `controllers/README.md` carries the same reason where somebody looking for the missing        │
 * │ controller will actually find it. `PG-7` now fails the build on an invented key, which is the │
 * │ half of this that was fixable without an owner decision.                                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The repositories are providers and are NOT exported. Other modules reach this one through the
 * ports on `index.ts` — `catalog/README.md` §4 lists six, of which M-031 delivers two.
 */

import { Module } from '@nestjs/common';

import { BRANCH_QUERY_PORT } from './application/ports/branch-query.port.js';
import { GYM_TIMEZONE_PORT } from './application/ports/gym-timezone.port.js';
import { BranchPrismaRepository } from './infrastructure/branch.prisma-repository.js';
import { GymTimezonePrismaAdapter } from './infrastructure/gym-timezone.prisma-adapter.js';

@Module({
  providers: [
    BranchPrismaRepository,
    GymTimezonePrismaAdapter,
    { provide: BRANCH_QUERY_PORT, useExisting: BranchPrismaRepository },
    { provide: GYM_TIMEZONE_PORT, useExisting: GymTimezonePrismaAdapter },
  ],
  /*
   * The TOKENS are exported, never the classes.
   *
   * `memberships/` will inject `GYM_TIMEZONE_PORT` and must never be able to name
   * `GymTimezonePrismaAdapter` — exporting the class would let a consumer depend on the Prisma
   * implementation and make `R2`'s module boundary a convention rather than a fact.
   */
  exports: [BRANCH_QUERY_PORT, GYM_TIMEZONE_PORT],
})
export class CatalogModule {}
