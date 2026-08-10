/**
 * `M-031` · `POST /v1/tenant/branches` — `Gym.md` §12.2, `FR-GYM-07`, `FR-GYM-09`.
 *
 * ┌─ ONE RULE LIVES HERE, AND IT IS THE FIRST-BRANCH RULE ───────────────────────────────────────┐
 * │ *"The first branch of a gym is `is_primary` regardless of the request, because `gyms.city_id`  │
 * │ is denormalised from it to make `uq_gyms__city_slug` enforceable."*                            │
 * │                                                                                              │
 * │ It has to be decided somewhere that can see the gym's existing branches, and that is here —    │
 * │ the DTO can only say the field may appear, and the repository is handed a decision rather      │
 * │ than making one. `is_primary: false` on a first branch is therefore OVERRIDDEN, not rejected:  │
 * │ §12.2 says *"regardless of the request"*, and refusing would fail a body the document          │
 * │ explicitly permits a client to send.                                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ AND ONE RULE THAT IS SPECIFIED, BUILDABLE, AND NOT BUILT — `KL-114` ────────────────────────┐
 * │ §12.2: *"Creation runs the `BR-GYM-08` distance check immediately and persists                │
 * │ `geo_tolerance_metres`; a mismatch at creation is a **warning in the response**, not a         │
 * │ refusal."* That needs a geocoder. `GEOCODING_PORT` is `M-030`'s and is not bound, so           │
 * │ `geoToleranceMetres` is written as `null`.                                                     │
 * │                                                                                              │
 * │ `null` is the honest value — the column means "not measured" — and it is NOT the same mistake  │
 * │ as returning `0` from the membership count, because nothing downstream reads it as a           │
 * │ clearance: `BR-GYM-08` blocks APPROVAL, and an approval reviewer looking at a null tolerance   │
 * │ sees an unmeasured pin rather than a matching one. A `0` here would have said "the pin is      │
 * │ exactly on the address", which is the coercion.                                                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable } from '@nestjs/common';

import {
  BRANCH_WRITE_PORT,
  type BranchWritePort,
  type NewBranch,
} from './ports/branch-write.port.js';
import { BRANCH_QUERY_PORT, type BranchQueryPort } from './ports/branch-query.port.js';
import { GYM_STATUS_PORT, type GymStatusPort } from './ports/gym-status.port.js';
import type { CreateBranchRequest } from '../dto/branch.dto.js';
import type { BranchRow } from '../infrastructure/branch.mapper.js';

export type CreateBranchOutcome =
  | {
      readonly ok: true;
      readonly branch: BranchRow;
      /**
       * Set when the request asked for a non-primary first branch and §12.2 overrode it.
       *
       * Surfaced so the controller can say so rather than silently returning a body that
       * contradicts the request — an owner who sent `is_primary: false` and got `true` back with
       * no explanation reasonably reads it as a bug.
       */
      readonly primaryForced: boolean;
    }
  | { readonly ok: false; readonly reason: 'UNKNOWN_GYM' };

@Injectable()
export class CreateBranchUseCase {
  constructor(
    @Inject(GYM_STATUS_PORT) private readonly gyms: GymStatusPort,
    @Inject(BRANCH_QUERY_PORT) private readonly branches: BranchQueryPort,
    @Inject(BRANCH_WRITE_PORT) private readonly writes: BranchWritePort,
  ) {}

  async execute(request: CreateBranchRequest): Promise<CreateBranchOutcome> {
    /*
     * The gym is resolved FIRST, and the reason is not validation.
     *
     * `branches.gym_id` has a foreign key, so inserting against a gym in another tenant would fail
     * anyway — as a constraint violation, which surfaces as a 500 and tells the caller that a row
     * they cannot see exists. Asking the port first turns that into a 404 that is byte-identical
     * to a genuinely absent gym (`A1`).
     *
     * The STATUS is deliberately not gated on. `Gym.md` §12 states no rule about which gym states
     * may gain a branch, and an owner adding a location to a `DRAFT` or `SUSPENDED` gym is the
     * ordinary case — a suspension is about visibility, not about freezing the estate. Inventing a
     * gate here would be an unwritten rule enforced in the lowest-authority place there is.
     */
    const gym = await this.gyms.statusOf(request.gym_id);
    if (!gym.ok) return { ok: false, reason: 'UNKNOWN_GYM' };

    /*
     * `activeInGym`, not a count of every branch.
     *
     * A gym whose only branch was deactivated has no active location, and the next branch created
     * is its primary — which is what `uq_branches__one_primary_per_gym` needs, since the closed
     * one dropped out of the index's partial predicate when it took `deleted_at`. Counting all
     * rows instead would leave that gym permanently unable to have a primary again.
     */
    const existing = await this.branches.activeInGym(request.gym_id);
    const isFirst = existing.length === 0;
    const requested = request.is_primary ?? false;
    const isPrimary = isFirst ? true : requested;

    const branch: NewBranch = {
      gymId: request.gym_id,
      name: request.name,
      addressLine1: request.address_line1,
      // `?? null` on every optional: the column is nullable and `undefined` is not a SQL value.
      addressLine2: request.address_line2 ?? null,
      cityId: request.city_id,
      localityId: request.locality_id ?? null,
      state: request.state,
      stateCode: request.state_code,
      postalCode: request.postal_code,
      countryCode: request.country_code,
      location: request.location,
      capacity: request.capacity ?? null,
      geoToleranceMetres: null, // KL-114 — no geocoder is bound. See the header.
      isPrimary,
    };

    /*
     * `is_primary: true` on a SECOND branch is passed through, and the database refuses it.
     *
     * The alternative is to demote the current primary here, which §12.2 does not ask for: it
     * describes promotion on DEACTIVATION and says nothing about a create silently taking the flag
     * from another branch. `uq_branches__one_primary_per_gym` therefore raises, the request fails,
     * and the owner is told — which is the correct outcome for an operation nobody specified.
     */
    return {
      ok: true,
      branch: await this.writes.create(branch),
      primaryForced: isFirst && !requested && request.is_primary !== undefined,
    };
  }
}
