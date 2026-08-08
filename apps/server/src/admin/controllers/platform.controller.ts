/**
 * `/v1/admin/platform` — `SCR-ADM-001`, `SCR-ADM-002`, `SCR-ADM-004`.
 *
 * ┌─ THE `/admin` AUDIENCE PREFIX IS PART OF THE CONTRACT ──────────────────────────────────────┐
 * │ `API_Catalog.md` §1.2 `R7` closes the prefix list at five, and `/admin` is the one that says │
 * │ "platform staff". The prefix is what an auditor reads to answer "who can reach this", which  │
 * │ is why `/dashboard` and `/internal` are forbidden — they name a CLIENT, not an AUDIENCE, and │
 * │ a route named for its caller stops telling you anything the moment a second client calls it. │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ EVERY READ HERE CROSSES A TENANT BOUNDARY AND IS AUDITED ──────────────────────────────────┐
 * │ The reason string below is not decoration. It lands on an audit row via `runElevated()`      │
 * │ BEFORE the query runs, alongside the operator's id and the permission they exercised, and it │
 * │ is what makes a cross-tenant read judgeable six months later. `reason()` refuses anything    │
 * │ under 20 characters, deliberately.                                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { EmitsErrors } from '../../common/decorators/emits-errors.decorator.js';
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js';
import { RequiredPermission } from '../../common/decorators/required-permission.decorator.js';
import { PlatformOnly } from '../../common/guards/platform-role.guard.js';
import { UnauthenticatedException } from '../../common/errors/domain-exception.js';
import { PlatformOverviewUseCase } from '../application/platform-overview.use-case.js';
import type { ReadContext } from '../application/ports/platform-read.port.js';
import { ADMIN_PERMISSIONS } from '../permissions.js';
import type { GymRow, PlatformOverview } from '../types/platform-overview.js';

/** The `tenant_status_enum` values a caller may filter by. Anything else is ignored. */
const FILTERABLE = new Set([
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'INFO_REQUESTED',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'CLOSED',
]);

@ApiTags('admin')
@Controller({ path: 'admin/platform', version: '1' })
export class PlatformController {
  constructor(private readonly platform: PlatformOverviewUseCase) {}

  @Get('overview')
  @PlatformOnly()
  @RequiredPermission(ADMIN_PERMISSIONS.PLATFORM_OVERVIEW_READ)
  @RateLimit('RL-READ')
  @EmitsErrors('UNAUTHENTICATED', 'PERMISSION_DENIED', 'ELEVATION_REFUSED')
  @ApiOperation({
    summary: 'Counts across every gym and every account on the platform.',
    description:
      'Aggregates only, and only over tables that exist. Revenue, orders, settlements, refunds ' +
      'and memberships are ABSENT from this response rather than present and zero, because a ' +
      'zero meaning "not built" and a zero meaning "nothing happened today" are identical on a ' +
      'screen and only one of them needs an operator. `generatedAt` is what the console renders ' +
      'as its last-updated indicator (A-08).',
  })
  async overview(@Req() request: Request): Promise<PlatformOverview> {
    return this.platform.overview(
      contextOf(request, ADMIN_PERMISSIONS.PLATFORM_OVERVIEW_READ, 'platform overview dashboard'),
    );
  }

  @Get('gyms')
  @PlatformOnly()
  @RequiredPermission(ADMIN_PERMISSIONS.GYM_REGISTER_READ)
  @RateLimit('RL-READ')
  @EmitsErrors('UNAUTHENTICATED', 'PERMISSION_DENIED', 'ELEVATION_REFUSED')
  @ApiQuery({ name: 'status', required: false, description: 'A tenant_status_enum value.' })
  @ApiOperation({
    summary: 'The gym register, newest first.',
    description:
      'One list serves both the register (SCR-ADM-004) and the approval queue (SCR-ADM-002) — ' +
      'the queue is this list filtered to the three statuses a human owns. Two endpoints would ' +
      'be two definitions of "waiting", and they would drift the moment a status is added. ' +
      'A projection: PAN, refund policy and settlement configuration are not returned to a ' +
      'screen that lists gyms (BR-DAT-06).',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { gyms: { type: 'array', items: { type: 'object' } } },
    },
  })
  async gyms(
    @Req() request: Request,
    @Query('status') status?: string,
  ): Promise<{ gyms: readonly GymRow[] }> {
    // An unrecognised value falls back to "no filter" rather than throwing. This route is linked
    // to from the console's own navigation, and a 400 on a stale bookmark would be a broken
    // screen where an unfiltered list is a useful one.
    const filter = status !== undefined && FILTERABLE.has(status) ? status : null;

    return {
      gyms: await this.platform.gyms(
        contextOf(request, ADMIN_PERMISSIONS.GYM_REGISTER_READ, 'gym register and approval queue'),
        filter,
      ),
    };
  }
}

/**
 * Builds the audited read context from the authenticated principal.
 *
 * The `why` is padded to clear the 20-character floor with a sentence that names the screen. A
 * reason of "admin" would pass a length check and answer nothing.
 */
function contextOf(request: Request, permission: string, screen: string): ReadContext {
  const principal = (request as unknown as { principal?: { sub: string } }).principal;
  if (principal === undefined) throw new UnauthenticatedException('No principal on request.');

  return {
    userId: principal.sub,
    permission,
    why: `Admin console read: ${screen} (${permission})`,
  };
}
