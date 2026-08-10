/**
 * `/v1/tenant/branches` — `Gym.md` §12.1–§12.4, `FR-GYM-07`, `FR-GYM-09`, `SCR-DASH-004`.
 *
 * ┌─ THIS FILE WAS BLOCKED FOR WEEKS BY `BLK-19`, AND THE BLOCK WAS REAL ────────────────────────┐
 * │ Not the vocabulary question it was first recorded as — `API_Catalog.md` §5.6's column header  │
 * │ is *"Permission string(s)"*, plural, so five keys from one `§B3.2` row was always the         │
 * │ documented shape. What was genuinely open was the GRANT WIDTH: `Gym.md` 167 gives             │
 * │ `GET /tenant/branches` to `RECEPTIONIST` and `TRAINER`, and `§B3.2` rows 19 and 20 gave both  │
 * │ `—`. A rank-3 API document cannot widen a rank-2 grant, so `SCR-DASH-004` as designed was     │
 * │ unbuildable and the fix was a `§C10` product decision rather than an engineering one.          │
 * │                                                                                              │
 * │ `ADR-0047`: the owner ruled both roles DO see the branch list, **read only**. Rows 19 and 20  │
 * │ gained `○` cells; creating, editing and closing a branch stayed with the owner.                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE `/tenant` PREFIX ───────────────────────────────────────────────────────────────────────┐
 * │ `API_Catalog.md` §1.2 `R7` closes the prefix list at five, and `/tenant` names the AUDIENCE:  │
 * │ somebody acting inside one gym business. It is not `/dashboard`, which would name a client    │
 * │ and stop meaning anything the moment a second one called it.                                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT IS NOT HERE, NAMED RATHER THAN QUIETLY ABSENT ─────────────────────────────────────────┐
 * │ `active_membership_count` (`KL-113`) · `hours_summary` (`KL-119`) · branch-scoped filtering   │
 * │ (`KL-116`, a SECURITY gap: no staff-to-branch table exists until `M-037`, so every holder of  │
 * │ `catalog.branch.list` sees the whole tenant) · `geo_tolerance_metres` measurement and         │
 * │ `GEO_ADDRESS_MISMATCH` (`KL-114`) · `temporary_closure` persistence (`KL-117`) ·              │
 * │ `APPLICATION_ALREADY_SUBMITTED` (`KL-115`, a module-rank edge `catalog → onboarding` that     │
 * │ dependency-cruiser refuses) · `RESOURCE_VERSION_CONFLICT`, registered and not yet wired.      │
 * │ `DELETE` refuses every active branch until `M-046` — `KL-113`, and it is the honest state.    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import type { Page } from '@gymmap/types';

import { Audited } from '../../common/decorators/audited.decorator.js';
import { EmitsErrors } from '../../common/decorators/emits-errors.decorator.js';
import { Idempotent } from '../../common/decorators/idempotent.decorator.js';
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js';
import { RequiredPermission } from '../../common/decorators/required-permission.decorator.js';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator.js';
import { BusinessRuleException, NotFoundException } from '../../common/errors/domain-exception.js';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe.js';
import { CreateBranchUseCase } from '../application/create-branch.use-case.js';
import { DeactivateBranchUseCase } from '../application/deactivate-branch.use-case.js';
import { ListBranchesUseCase, toListQuery } from '../application/list-branches.use-case.js';
import { UpdateBranchUseCase } from '../application/update-branch.use-case.js';
import { fieldChangeClasses } from '../domain/branch-field-classes.js';
import {
  createBranchRequestSchema,
  updateBranchRequestSchema,
  type BranchResponse,
  type CreateBranchRequest,
  type UpdateBranchRequest,
} from '../dto/branch.dto.js';
import { toBranchResponse } from '../infrastructure/branch.mapper.js';
import { CATALOG_PERMISSIONS } from '../permissions.js';

/** `GET /:id` returns the branch plus the map `FR-GYM-11` needs before a change is saved. */
interface BranchDetailResponse extends BranchResponse {
  readonly field_change_classes: Readonly<Record<string, string>>;
}

@ApiTags('tenant')
@Controller({ path: 'tenant/branches', version: '1' })
export class BranchController {
  constructor(
    private readonly list: ListBranchesUseCase,
    private readonly create: CreateBranchUseCase,
    private readonly update: UpdateBranchUseCase,
    private readonly deactivate: DeactivateBranchUseCase,
  ) {}

  @Get()
  @TenantScoped()
  @RequiredPermission(CATALOG_PERMISSIONS.BRANCH_LIST)
  @RateLimit('RL-READ')
  @EmitsErrors('UNAUTHENTICATED', 'PERMISSION_DENIED')
  @ApiQuery({ name: 'gym_id', required: false, description: 'Repeatable.' })
  @ApiQuery({ name: 'status', required: false, description: 'ACTIVE | INACTIVE.' })
  @ApiQuery({ name: 'city_id', required: false })
  @ApiQuery({
    name: 'sort',
    required: false,
    description: 'name:asc | name:desc | created_at:desc',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Default 50, ceiling 100.' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Opaque. Echo it back verbatim.' })
  @ApiOperation({
    summary: "Every branch of the tenant's estate, cursor-paginated.",
    description:
      'INACTIVE branches are included — an owner must still see the branch they closed last ' +
      'month, or it has silently vanished from a screen that claims to list their estate. ' +
      'Soft-deleted rows are not. active_membership_count and hours_summary are ABSENT rather ' +
      'than zero: memberships arrive at M-046 and branch hours at M-034, and a zero on a ' +
      'dashboard is indistinguishable from a real one (KL-113, KL-119).',
  })
  async listBranches(
    @Query() query: Record<string, string | string[] | undefined>,
  ): Promise<Page<BranchResponse>> {
    const page = await this.list.execute(toListQuery(query));
    return { ...page, data: page.data.map(toBranchResponse) };
  }

  @Post()
  @TenantScoped()
  @RequiredPermission(CATALOG_PERMISSIONS.BRANCH_CREATE)
  @RateLimit('RL-WRITE')
  @Idempotent('required')
  @Audited({ entityType: 'BRANCH', action: 'CREATE' })
  @EmitsErrors(
    'UNAUTHENTICATED',
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'RESOURCE_NOT_FOUND',
    'IDEMPOTENCY_KEY_REQUIRED',
  )
  @ApiOperation({
    summary: 'Opens a branch.',
    description:
      'The first branch of a gym is is_primary regardless of the request, because gyms.city_id ' +
      'is denormalised from it to make uq_gyms__city_slug enforceable. geo_tolerance_metres is ' +
      'null rather than measured: BR-GYM-08 needs a geocoder and none is bound (KL-114). Null ' +
      'means "not measured", which is what an approval reviewer needs to see.',
  })
  async createBranch(
    @Body(new ZodValidationPipe(createBranchRequestSchema)) body: CreateBranchRequest,
  ): Promise<BranchResponse> {
    const outcome = await this.create.execute(body);

    /*
     * 404 and not 403 for a gym in another tenant.
     *
     * `A1`: a cross-tenant id must be byte-identical to a nonexistent one. A 403 would confirm the
     * gym exists somewhere, and gym ids travel in URLs.
     */
    if (!outcome.ok) throw new NotFoundException(`No gym ${body.gym_id} in this tenant.`);

    return toBranchResponse(outcome.branch);
  }

  @Get(':id')
  @TenantScoped()
  @RequiredPermission(CATALOG_PERMISSIONS.BRANCH_READ)
  @RateLimit('RL-READ')
  @EmitsErrors('UNAUTHENTICATED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  @ApiOperation({
    summary: 'One branch, with the material-field map.',
    description:
      'field_change_classes tells the dashboard which fields send the gym back to review BEFORE ' +
      'the owner saves — FR-GYM-11 requires the UI to state it, and a UI holding its own copy of ' +
      'the list stops matching the server the first time either changes. hours[], ' +
      'hour_exceptions[] and the active closure are absent until M-034 (KL-119).',
  })
  async readBranch(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<BranchDetailResponse> {
    const row = await this.list.byId(id);
    if (row === null) throw new NotFoundException(`No branch ${id} in this tenant.`);
    return { ...toBranchResponse(row), field_change_classes: fieldChangeClasses() };
  }

  @Patch(':id')
  @TenantScoped()
  @RequiredPermission(CATALOG_PERMISSIONS.BRANCH_UPDATE)
  @RateLimit('RL-WRITE')
  @Idempotent('required')
  @Audited({ entityType: 'BRANCH', action: 'UPDATE' })
  @EmitsErrors(
    'UNAUTHENTICATED',
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'RESOURCE_NOT_FOUND',
    'APPLICATION_PRECHECK_OVERRIDE_REQUIRED',
  )
  @ApiOperation({
    summary: 'Edits a branch. Material fields need an acknowledgement.',
    description:
      'BR-GYM-06 fires here: address_line1/2, city_id, state, state_code, postal_code and ' +
      'location are MATERIAL, and touching one without acknowledge_review: true is refused 422 ' +
      'with every material field named. A warning in the UI is true only for a client that chose ' +
      'to read it; the acknowledgement makes it true for every client, including a script.',
  })
  async updateBranch(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body(new ZodValidationPipe(updateBranchRequestSchema)) body: UpdateBranchRequest,
  ): Promise<BranchResponse & { returns_to_review: boolean }> {
    const outcome = await this.update.execute(id, body);

    if (!outcome.ok) {
      if (outcome.reason === 'UNKNOWN_BRANCH') {
        throw new NotFoundException(`No branch ${id} in this tenant.`);
      }
      throw new BusinessRuleException(
        'APPLICATION_PRECHECK_OVERRIDE_REQUIRED',
        `A material field was changed without acknowledge_review: ${outcome.materialFields.join(', ')}.`,
        // The registry's own `detailsShape` for this code: `{ material_fields: string[] }`. §6.3
        // requires the enumeration, and it is what lets the dashboard say "changing your address
        // sends your listing back for review" without holding its own copy of the list.
        [{ material_fields: outcome.materialFields }],
      );
    }

    return { ...toBranchResponse(outcome.branch), returns_to_review: outcome.returnsToReview };
  }

  @Delete(':id')
  @HttpCode(204)
  @TenantScoped()
  @RequiredPermission(CATALOG_PERMISSIONS.BRANCH_DEACTIVATE)
  @RateLimit('RL-WRITE')
  @Idempotent('required')
  @Audited({ entityType: 'BRANCH', action: 'DELETE' })
  @EmitsErrors(
    'UNAUTHENTICATED',
    'PERMISSION_DENIED',
    'RESOURCE_NOT_FOUND',
    'BRANCH_HAS_ACTIVE_MEMBERSHIPS',
    'CONFIG_VALIDATION_FAILED',
  )
  @ApiOperation({
    summary: 'Closes a branch. A soft deactivation, never a delete.',
    description:
      'A branch is named by every historical attendance row and every invoice, so the row stays ' +
      'and takes status INACTIVE with deleted_at. Closing the primary promotes the next branch ' +
      'in the SAME transaction — uq_branches__one_primary_per_gym forbids two primaries and not ' +
      'zero, so a caller treating permission as a boolean leaves a gym with no primary and no ' +
      'error. Until M-046 this refuses every ACTIVE branch: NFR-USE-06 needs the real member ' +
      'count and nothing can supply it (KL-113).',
  })
  async deactivateBranch(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<void> {
    const gymId = await this.list.gymOf(id);
    if (gymId === null) throw new NotFoundException(`No branch ${id} in this tenant.`);

    const outcome = await this.deactivate.execute({ gymId, branchId: id });
    if (outcome.ok) return;

    // UNKNOWN_GYM and UNKNOWN_BRANCH collapse to the same 404 at the edge. They are distinct in
    // the outcome type so an operator reading a log knows which lookup missed; a caller able to
    // tell them apart could enumerate.
    if (outcome.reason !== 'REFUSED') {
      throw new NotFoundException(`No branch ${id} in this tenant.`);
    }

    const { verdict } = outcome;
    if (verdict.permitted) return;

    if (verdict.code === 'CONFIG_VALIDATION_FAILED') {
      throw new BusinessRuleException(
        'CONFIG_VALIDATION_FAILED',
        'The last active branch of a listed gym cannot be closed.',
        // `{ field, reason }` — the registry's shape. `NFR-USE-05` requires an error to name the
        // inconsistency; a code with no field named is the generic failure that rule forbids.
        [{ field: verdict.field, reason: verdict.reason }],
      );
    }

    /*
     * `member_count` is the whole point of this refusal — `NFR-USE-06`, and `Gym.md` §12.4 says a
     * vague "cannot delete" fails review.
     *
     * `null` when the count could not be established, which today is always. It reaches `details`
     * as an absent number rather than as a `0`, because the client renders the number into a
     * sentence and "0 members can currently check in" would be a claim nothing verified.
     */
    throw new BusinessRuleException(
      'BRANCH_HAS_ACTIVE_MEMBERSHIPS',
      verdict.memberCount === null
        ? `The affected-membership count is unavailable: ${verdict.unavailableReason}`
        : `${verdict.memberCount} members can still check in at this branch.`,
      /*
       * `member_count` is omitted entirely when the count is unknown, rather than sent as `null`.
       *
       * The registry's shape is `{ branch_id: string; member_count: number }`, and the client
       * renders the number into a sentence. An absent key gives it nothing to render — correct.
       * A `null` would be a number-shaped hole that a template turns into "null members can
       * currently check in", and a `0` would be the claim `KL-113` exists to refuse.
       */
      [
        verdict.memberCount === null
          ? { branch_id: verdict.branchId }
          : { branch_id: verdict.branchId, member_count: verdict.memberCount },
      ],
    );
  }
}
