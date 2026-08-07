/**
 * M-012 · `GET /v1/tenant/ping` — the Sprint-0 exit condition's endpoint. E0.1, E0.2, E0.3.
 *
 * Trivial on purpose. It exists so the whole chain — token → middleware → guard → repository →
 * RLS policy → response — can be exercised end to end before any business logic depends on it.
 * Every later endpoint inherits whatever is wrong here, so it is worth having one route whose
 * only job is to be provably correct.
 *
 * ┌─ 404, NEVER 403, FOR A RESOURCE IN ANOTHER TENANT ──────────────────────────────────────────┐
 * │ AC-4, E0.3, AC-FND-03.1, RSK-08.                                                            │
 * │                                                                                             │
 * │ A 403 says "this exists and you may not have it". A 404 says "there is nothing here". For a │
 * │ cross-tenant request only the second is true from the caller's point of view, and the       │
 * │ difference is an information leak with a name: an ENUMERATION ORACLE.                       │
 * │                                                                                             │
 * │ Given 403, a competitor walks a list of uuids and learns which ones are real gyms. They     │
 * │ never read a single row and still extract the platform's customer count, its growth rate    │
 * │ month over month, and — with a little patience against `/v1/tenant/{id}` shaped routes —    │
 * │ which specific businesses signed up. None of that requires a bug: it is what 403 MEANS.     │
 * │                                                                                             │
 * │ The response body carries no field derived from the other tenant's row either. A 404 whose  │
 * │ body says "Iron Temple not accessible" has leaked exactly what the 404 was hiding.          │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { EmitsErrors } from '../../common/decorators/emits-errors.decorator.js';
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js';
import { RequiredPermission } from '../../common/decorators/required-permission.decorator.js';
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator.js';
import { TENANCY_PERMISSIONS } from '../permissions.js';
import { TenantPrismaRepository } from '../infrastructure/tenant.prisma-repository.js';
import type { PingResponse } from '../dto/ping.response.dto.js';

@ApiTags('tenancy')
@Controller({ path: 'tenant', version: '1' })
export class TenantPingController {
  constructor(private readonly tenants: TenantPrismaRepository) {}

  @Get('ping')
  @TenantScoped()
  @RequiredPermission(TENANCY_PERMISSIONS.PING_READ)
  @RateLimit('RL-READ')
  @EmitsErrors('RESOURCE_NOT_FOUND', 'UNAUTHENTICATED', 'PERMISSION_DENIED')
  @ApiOperation({
    summary: "Returns the caller's own tenant.",
    description:
      'Proves the tenant context resolved and RLS is applying. The tenant is derived from the ' +
      'access token — there is no parameter, because there is nothing for a caller to choose.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        trading_name: { type: 'string', nullable: true },
        timezone: { type: 'string', example: 'Asia/Kolkata' },
        status: { type: 'string', example: 'APPROVED' },
      },
    },
  })
  async ping(): Promise<PingResponse> {
    const tenant = await this.tenants.findOwnTenant();

    // Null here means the policy admitted no row. Under a correctly resolved tenant context that
    // is not possible for an existing tenant, so it means either the tenant was soft-deleted
    // mid-request or the context names a tenant that does not exist — both 404 to the caller,
    // both worth a log line for us.
    if (!tenant) throw new NotFoundException('No tenant is visible to this context.');

    return toResponse(tenant);
  }

  /**
   * The cross-tenant case, made explicit.
   *
   * A caller asking for another tenant's id gets 404 with a body identical to the one for an id
   * that never existed. `tenancy.isolation-spec.ts` asserts BYTE IDENTITY between the two, which
   * is stronger than asserting the status code: a 404 whose body differs by a single character
   * is still an oracle, just a quieter one.
   */
  @Get(':tenantRef/ping')
  @TenantScoped()
  @RequiredPermission(TENANCY_PERMISSIONS.PING_READ)
  @RateLimit('RL-READ')
  @EmitsErrors('RESOURCE_NOT_FOUND', 'UNAUTHENTICATED', 'PERMISSION_DENIED')
  @ApiOperation({
    summary: 'Returns a tenant by id, if it is visible to the caller.',
    description:
      'A tenant in another scope returns 404, never 403 — a 403 would confirm the id exists and ' +
      'turn a uuid list into a customer census (RSK-08).',
  })
  async pingById(@Param('tenantRef') tenantRef: string): Promise<PingResponse> {
    const tenant = await this.tenants.findVisibleById(tenantRef);

    // ONE message, for "not yours" and for "does not exist" alike. Interpolating the id, or
    // saying "not accessible" rather than "not found", reintroduces the oracle the 404 removes.
    if (!tenant) throw new NotFoundException('No such tenant.');

    return toResponse(tenant);
  }
}

/** snake_case on the wire (§C3.1), camelCase in the model. Mapped once, here. */
function toResponse(tenant: {
  id: string;
  tradingName: string | null;
  timezone: string;
  status: string;
}): PingResponse {
  return {
    id: tenant.id,
    trading_name: tenant.tradingName,
    timezone: tenant.timezone,
    status: tenant.status,
  };
}
