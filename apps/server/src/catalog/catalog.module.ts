/**
 * `M-031` · `catalog/` — the tenant's physical footprint.
 *
 * ┌─ THE FIVE BRANCH ROUTES ARE HERE AS OF 2026-08-11. `BLK-19` IS CLOSED. ──────────────────────┐
 * │ This header carried the reason they were absent for weeks, and the reason changed twice      │
 * │ before it was right, which is worth keeping rather than deleting with the block.              │
 * │                                                                                              │
 * │ **First framing, wrong.** Two rank-3 documents give two vocabularies; only                    │
 * │ `catalog.branch.read` appears in both; `§B3.2` holds no key strings to break the tie.         │
 * │ `PHASES.md`'s own `BLK-19` row labels that *"What I got wrong"* — `API_Catalog.md` §5.6's     │
 * │ column header is **"Permission string(s)"**, plural, and its rows already carry three keys    │
 * │ for one capability. Five keys from one row is the DOCUMENTED shape, not a conflict.            │
 * │                                                                                              │
 * │ **Second framing, right, and not an engineering question.** The GRANT WIDTH. `Gym.md` 167     │
 * │ gives `GET /tenant/branches` to `RECEPTIONIST` and `TRAINER`; `§B3.2` rows 19 and 20 gave     │
 * │ both `—`. Rank 2 beats rank 3, so `SCR-DASH-004` as designed was unbuildable — a `§C10`       │
 * │ product decision, not something to resolve in a module file.                                   │
 * │                                                                                              │
 * │ **`ADR-0047`:** the owner ruled that both roles DO see the branch list, **read only**. Rows   │
 * │ 19 and 20 gained `○` cells. `permissionsFor()` emits write keys only for a grant that is not  │
 * │ `READ`, so a receptionist reaches `.list` and `.read` and cannot reach `.create`,             │
 * │ `.update` or `.deactivate` — the asymmetry is what makes the `○` cell mean what it says.       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ FOUR PORTS, THREE ADAPTERS, AND ONE THAT ONLY REFUSES ──────────────────────────────────────┐
 * │ `AFFECTED_MEMBERSHIPS_PORT` is bound to an adapter that always answers `UNAVAILABLE`, because │
 * │ `memberships` ships at `M-046`. Leaving it unbound would fail DI at boot and take all five    │
 * │ routes down; bound and refusing, four routes work and `DELETE` refuses honestly. `KL-113`.     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The repositories are providers and are NOT exported. Other modules reach this one through the
 * ports on `index.ts` — `catalog/README.md` §4 lists six, of which M-031 delivers three.
 */

import { Module } from '@nestjs/common';

import { CreateBranchUseCase } from './application/create-branch.use-case.js';
import { DeactivateBranchUseCase } from './application/deactivate-branch.use-case.js';
import { ListBranchesUseCase } from './application/list-branches.use-case.js';
import { UpdateBranchUseCase } from './application/update-branch.use-case.js';
import { AFFECTED_MEMBERSHIPS_PORT } from './application/ports/affected-memberships.port.js';
import { BRANCH_LIST_PORT } from './application/ports/branch-list.port.js';
import { BRANCH_QUERY_PORT } from './application/ports/branch-query.port.js';
import { BRANCH_WRITE_PORT } from './application/ports/branch-write.port.js';
import { GYM_STATUS_PORT } from './application/ports/gym-status.port.js';
import { GYM_TIMEZONE_PORT } from './application/ports/gym-timezone.port.js';
import { BranchController } from './controllers/branch.controller.js';
import { AffectedMembershipsUnavailableAdapter } from './infrastructure/affected-memberships.unavailable-adapter.js';
import { BranchPrismaRepository } from './infrastructure/branch.prisma-repository.js';
import { GymStatusPrismaAdapter } from './infrastructure/gym-status.prisma-adapter.js';
import { GymTimezonePrismaAdapter } from './infrastructure/gym-timezone.prisma-adapter.js';

@Module({
  controllers: [BranchController],
  providers: [
    BranchPrismaRepository,
    GymStatusPrismaAdapter,
    GymTimezonePrismaAdapter,
    AffectedMembershipsUnavailableAdapter,

    /*
     * One repository, three tokens, and `useExisting` rather than `useClass` on each.
     *
     * `useClass` would construct three separate `BranchPrismaRepository` instances, each holding
     * its own `PrismaService` handle. Harmless today and not tomorrow: the A-01 extension's
     * interactive transaction is per-operation, and three instances is three places for a future
     * per-request cache or a connection assumption to diverge. `useExisting` aliases the single
     * provider above, so the three interfaces are three VIEWS of one object.
     */
    { provide: BRANCH_QUERY_PORT, useExisting: BranchPrismaRepository },
    { provide: BRANCH_LIST_PORT, useExisting: BranchPrismaRepository },
    { provide: BRANCH_WRITE_PORT, useExisting: BranchPrismaRepository },
    { provide: GYM_STATUS_PORT, useExisting: GymStatusPrismaAdapter },
    { provide: GYM_TIMEZONE_PORT, useExisting: GymTimezonePrismaAdapter },
    { provide: AFFECTED_MEMBERSHIPS_PORT, useExisting: AffectedMembershipsUnavailableAdapter },

    CreateBranchUseCase,
    UpdateBranchUseCase,
    ListBranchesUseCase,
    DeactivateBranchUseCase,
  ],
  /*
   * The TOKENS are exported, never the classes — and only the tokens other modules are entitled to.
   *
   * `memberships/` will inject `GYM_TIMEZONE_PORT` and must never be able to name
   * `GymTimezonePrismaAdapter`: exporting the class would let a consumer depend on the Prisma
   * implementation and make `R2`'s module boundary a convention rather than a fact.
   *
   * `BRANCH_LIST_PORT` and `BRANCH_WRITE_PORT` are deliberately NOT exported. An interface is a
   * capability, and the four modules that hold `BRANCH_QUERY_PORT` — `plans/`, `staff/`,
   * `ordering/`, `attendance/` — are entitled to ask whether a branch exists in a gym and to
   * nothing else. `ModuleDependency.md` gives none of them the right to write one.
   */
  exports: [BRANCH_QUERY_PORT, GYM_STATUS_PORT, GYM_TIMEZONE_PORT],
})
export class CatalogModule {}
