/**
 * `M-031` · `PATCH /v1/tenant/branches/:id` — `Gym.md` §12.3, `BR-GYM-06`, `FR-GYM-10`, `FR-GYM-11`.
 *
 * ┌─ THE ONE RULE THIS ROUTE EXISTS TO APPLY ────────────────────────────────────────────────────┐
 * │ §12.3: *"This is where `BR-GYM-06`'s address and geo-location clauses actually fire"*. Seven  │
 * │ fields are MATERIAL and five are immediate; `branch-field-classes.ts` holds both lists and    │
 * │ defaults an unclassified field to MATERIAL, which is the safe side and the side the           │
 * │ equivalent file in `onboarding/` originally got wrong.                                         │
 * │                                                                                              │
 * │ §6.3 mechanism 2 is the gate: a PATCH touching a material field without                        │
 * │ `acknowledge_review: true` is refused `422 APPLICATION_PRECHECK_OVERRIDE_REQUIRED`, and the   │
 * │ `details` enumerate which fields made it material. A UI warning *"is true only for a client   │
 * │ that chose to read it; the acknowledgement makes it true for every client, including a        │
 * │ script."*                                                                                      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THREE OF §12.3's SIX ERRORS CANNOT BE RAISED FROM THIS MODULE, AND ONLY ONE IS A GAP ───────┐
 * │ `APPLICATION_ALREADY_SUBMITTED` (409, material while queued) reads `applications`, which      │
 * │ `onboarding/` owns. `ModuleDependency.md` §L3 ranks `catalog`(0) below `onboarding`(4) and    │
 * │ requires *"every edge points to a lower rank"*, so `catalog → onboarding` is not a shortcut   │
 * │ this file declined to take — it is an import `ci:module-structure` and dependency-cruiser     │
 * │ both refuse. Inverting it needs an event or a port `onboarding/` provides, which is           │
 * │ architecture work nobody has scheduled. **`KL-115`.**                                          │
 * │                                                                                              │
 * │ `GEO_ADDRESS_MISMATCH` (422 — the one that *does* refuse) needs the geocoder that              │
 * │ `geo_tolerance_metres` needs. **`KL-114`**, shared with creation.                              │
 * │                                                                                              │
 * │ `BRANCH_NOT_ASSIGNED_TO_STAFF` (403) needs a staff-to-branch assignment table. `staff/` is     │
 * │ `M-037` and the table does not exist. **`KL-116`.** Note this one is a SECURITY gap and not    │
 * │ merely a missing error: §12.1's *"a branch-scoped caller receives only assigned branches"* is  │
 * │ unenforceable for the same reason, so today a `GYM_MANAGER` sees every branch in the tenant.   │
 * │                                                                                              │
 * │ `CONFIG_VALIDATION_FAILED` for a closure with `to` before `from` is raised — by the DTO, in    │
 * │ `temporaryClosure` — but the closure itself is not persisted: `branches` has no column for it  │
 * │ and `Schema.md` §4 is a closed register. **`KL-117`.**                                         │
 * │                                                                                              │
 * │ `RESOURCE_VERSION_CONFLICT` (409) is the one that is simply not wired: the code is registered  │
 * │ and no `If-Match`/`version` is read on this route yet.                                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable } from '@nestjs/common';

import { BRANCH_LIST_PORT, type BranchListPort } from './ports/branch-list.port.js';
import { BRANCH_QUERY_PORT, type BranchQueryPort } from './ports/branch-query.port.js';
import {
  BRANCH_WRITE_PORT,
  type BranchPatch,
  type BranchWritePort,
} from './ports/branch-write.port.js';
import { classOf } from '../domain/branch-field-classes.js';
import type { UpdateBranchRequest } from '../dto/branch.dto.js';
import type { BranchRow } from '../infrastructure/branch.mapper.js';

export type UpdateBranchOutcome =
  | { readonly ok: true; readonly branch: BranchRow; readonly returnsToReview: boolean }
  | { readonly ok: false; readonly reason: 'UNKNOWN_BRANCH' }
  | {
      readonly ok: false;
      readonly reason: 'ACKNOWLEDGEMENT_REQUIRED';
      /** The material fields this request touched — §6.3 requires `details` to name each one. */
      readonly materialFields: readonly string[];
    };

/** Wire name → the port's name. Explicit, so a renamed column cannot silently stop being written. */
const COLUMN_OF: Readonly<Record<string, keyof BranchPatch>> = {
  name: 'name',
  address_line1: 'addressLine1',
  address_line2: 'addressLine2',
  city_id: 'cityId',
  locality_id: 'localityId',
  state: 'state',
  state_code: 'stateCode',
  postal_code: 'postalCode',
  location: 'location',
  capacity: 'capacity',
};

@Injectable()
export class UpdateBranchUseCase {
  constructor(
    @Inject(BRANCH_QUERY_PORT) private readonly branches: BranchQueryPort,
    @Inject(BRANCH_LIST_PORT) private readonly reads: BranchListPort,
    @Inject(BRANCH_WRITE_PORT) private readonly writes: BranchWritePort,
  ) {}

  async execute(branchId: string, request: UpdateBranchRequest): Promise<UpdateBranchOutcome> {
    /*
     * `gymOf` then `findInGym`, rather than one lookup by id.
     *
     * The second call looks redundant and is not: it is the check that the branch is still ACTIVE
     * and not soft-deleted, and it is the same call every other path in this module makes, so a
     * change to what "visible branch" means lands in one place. `gymOf` answers only ownership.
     */
    const gymId = await this.reads.gymOf(branchId);
    if (gymId === null) return { ok: false, reason: 'UNKNOWN_BRANCH' };

    const found = await this.branches.findInGym(gymId, branchId);
    if (!found.ok) return { ok: false, reason: 'UNKNOWN_BRANCH' };

    /*
     * The KEYS the client sent, not the fields of the parsed type.
     *
     * A Zod object with optional members is structurally identical whether the client omitted a
     * field or sent `undefined` for it, and only the first should be treated as "not changing".
     * `.strict()` means the parse result carries exactly what arrived, so `Object.keys` is the
     * client's intent — which is why `acknowledge_review` has to be filtered out by name here
     * rather than being absent from the type.
     */
    const sent = Object.keys(request).filter((key) => key !== 'acknowledge_review');
    const materialFields = sent.filter((key) => classOf(key) === 'MATERIAL');

    if (materialFields.length > 0 && request.acknowledge_review !== true) {
      return { ok: false, reason: 'ACKNOWLEDGEMENT_REQUIRED', materialFields };
    }

    /*
     * Built by walking the SENT keys, never by copying the request object.
     *
     * Spreading the request would carry `landmark`, `parking_notes`, `temporary_closure` and
     * `acknowledge_review` into the patch — three fields with no column and one that is not data —
     * and the repository would either drop them silently or fail on an unknown column. Walking a
     * map means a field with no entry is visibly not written.
     */
    const patch: Record<string, unknown> = {};
    for (const key of sent) {
      const column = COLUMN_OF[key];
      if (column !== undefined) patch[column] = (request as Record<string, unknown>)[key];
    }

    const updated = await this.writes.update(branchId, patch as BranchPatch);
    if (updated === null) return { ok: false, reason: 'UNKNOWN_BRANCH' };

    /*
     * `returnsToReview` is reported and NOT acted on, and the distinction is the honest one.
     *
     * `BR-GYM-06` sends the gym back to `PENDING_REVIEW` *"for those fields while the listing stays
     * live"*. Writing `gyms.status` from here would be this module deciding a review outcome, and
     * the partial re-review it describes — some fields queued, the listing serving — has no
     * representation in `gyms.status`, which is a single enum. That modelling is `M-032`'s.
     *
     * So the flag travels to the response, the owner is told their change goes to review, and
     * `KL-118` records that nothing yet queues it.
     */
    return { ok: true, branch: updated, returnsToReview: materialFields.length > 0 };
  }
}
