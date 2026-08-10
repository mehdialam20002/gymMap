/**
 * `M-031` · `catalog/` — the tenant's physical footprint.
 *
 * ┌─ NO CONTROLLERS, AND IT IS `BLK-19` RATHER THAN AN OMISSION ─────────────────────────────────┐
 * │ `catalog/README.md` §4 says `controllers/`, `dto/` and `permissions.ts` are mandatory here —  │
 * │ this is not one of the four provider-only modules. The five branch routes are specified down  │
 * │ to their request bodies in `apis/Gym.md` §12, and they cannot be built yet.                    │
 * │                                                                                              │
 * │ **The reason is NOT the one this comment used to give, and the correction matters.** It said  │
 * │ two rank-3 documents gave two vocabularies, that only `catalog.branch.read` appeared in both, │
 * │ and that `§B3.2` held no key strings to break the tie. `PHASES.md`'s own `BLK-19` row labels  │
 * │ that framing *"What I got wrong"*. `API_Catalog.md` §5.6's column header is **"Permission     │
 * │ string(s)"**, plural, and its rows already carry three keys for one capability — so five keys │
 * │ from one row is the DOCUMENTED shape, not a conflict. The vocabulary question is answered.    │
 * │                                                                                              │
 * │ What is actually open is the **grant width**. `Gym.md` 167 gives `GET /tenant/branches` to    │
 * │ `RECEPTIONIST` and `TRAINER`; `§B3.2` rows 19 and 20 give both `—`. Precedence settles it for │
 * │ `§B3.2`, which means `SCR-DASH-004` as designed cannot be built — and that is a PRODUCT       │
 * │ decision under `§C10`, not an engineering one. Hence still blocked, for a different reason.   │
 * │                                                                                              │
 * │ `controllers/README.md` carries this where somebody looking for the missing controller will   │
 * │ find it. `PG-7` fails the build on an invented key, which was the half fixable without the    │
 * │ owner. Note the DTOs and the AC-9 audit write are NOT blocked by any of this.                  │
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
