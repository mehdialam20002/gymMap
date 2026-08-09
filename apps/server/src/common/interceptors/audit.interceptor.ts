/**
 * M-013 · The `@Audited()` interceptor — BR-DAT-01, AC-FND-11.2, AC-FND-11.6.
 *
 * Reads the `@Audited({ entityType, action })` metadata and appends one row per successful
 * mutation.
 *
 * ┌─ AFTER SUCCESS, NOT BEFORE ─────────────────────────────────────────────────────────────────┐
 * │ A row written before the handler records an intention, not an event — and a failed request  │
 * │ would leave a permanent claim that something happened when it did not. An audit log that    │
 * │ over-reports is as useless as one that under-reports: both make it unusable as evidence.    │
 * │                                                                                             │
 * │ The exception is deliberate and lives elsewhere: `runElevated()` (M-014) writes BEFORE the  │
 * │ work and refuses to proceed if it cannot, because a cross-tenant read that happened without │
 * │ a record is worse than one that was blocked.                                                 │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * AC-FND-11.6 / TR-32: capturing the BEFORE state must add no second read to a hot path. This
 * interceptor therefore does not fetch it — the before image comes from the aggregate the use
 * case already loaded, passed through `request.auditBefore`. An interceptor that re-read the row
 * would double the query count on every mutation in the system to populate a column.
 */

import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tap, type Observable } from 'rxjs';

import { currentCorrelationId } from '../logging/correlation.als.js';
import { AUDITED, type AuditedOptions } from '../decorators/audited.decorator.js';
import { AUDIT_WRITE_PORT, type AuditWritePort } from '../../audit/ports/audit-write.port.js';
import { currentTenantContext } from '../../tenancy/context/tenant-context.als.js';
import { isPlatformScope, isTenantScope } from '../../tenancy/context/tenant-context.vo.js';
import type { AuthenticatedRequest } from '../guards/jwt-auth.guard.js';

/** What a use case may attach so the interceptor need not re-read the row. */
export interface AuditableRequest extends AuthenticatedRequest {
  auditBefore?: unknown;
  auditAfter?: unknown;
  auditEntityId?: string;
  auditReason?: string;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUDIT_WRITE_PORT) private readonly audit: AuditWritePort,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<AuditedOptions>(AUDITED, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No annotation, no row. Coverage is asserted separately by
    // `packages/config/scripts/audited-annotation.mjs`, which fails CI when an entity in one of
    // the seven audited classes has a mutating route without `@Audited()`. Doing it there rather
    // than here matters: an interceptor cannot know what SHOULD have been annotated.
    if (!options) return next.handle();

    const request = context.switchToHttp().getRequest<AuditableRequest>();

    return next.handle().pipe(
      tap({
        next: () => {
          void this.write(request, options);
        },
        // No row on failure. See the header: an audit log that over-reports is as unusable as
        // one that under-reports.
        error: () => undefined,
      }),
    );
  }

  private async write(request: AuditableRequest, options: AuditedOptions): Promise<void> {
    const scope = currentTenantContext();

    await this.audit.append({
      tenantId: isTenantScope(scope) ? scope.tenantId : null,
      actorId: request.principal?.sub ?? null,
      // PLATFORM_ADMIN whenever the request runs under an elevation. SUPPORT_IMPERSONATION is
      // NOT decided here — the repository widens `USER` to it when an impersonation is in scope,
      // so the two can never disagree.
      actorType: isPlatformScope(scope) ? 'PLATFORM_ADMIN' : 'USER',
      // Deliberately ABSENT rather than `null`. `null` is an explicit "no impersonator" and would
      // override the ambient one the repository reads — turning M-025's whole point off for every
      // route this interceptor covers, which is most of them.
      entityType: options.entityType,
      // The route's own id, or whatever the use case attached. Falling back to the tenant is
      // wrong — it would silently attribute the change to the wrong entity — so an unresolvable
      // id produces no row and a loud log line instead.
      entityId: request.auditEntityId ?? extractIdParam(request),
      action: options.action,
      before: request.auditBefore,
      after: request.auditAfter,
      reason: request.auditReason ?? null,
      elevationScope: isPlatformScope(scope) ? scope.reason : null,
      ip: firstForwardedAddress(request),
      userAgent:
        typeof request.headers?.['user-agent'] === 'string' ? request.headers['user-agent'] : null,
      correlationId: currentCorrelationId(),
    });
  }
}

/** The `:id` style parameter, if the route has one. */
function extractIdParam(request: AuditableRequest): string {
  const params = (request as unknown as { params?: Record<string, string> }).params ?? {};
  return params['id'] ?? params['tenantRef'] ?? params['ref'] ?? '';
}

/**
 * The FIRST address in `X-Forwarded-For`.
 *
 * A client can send its own `X-Forwarded-For`, and everything after the first entry is
 * attacker-supplied — a forged chain would put whatever address the caller likes into a
 * seven-year evidence table. Only the first is the edge's rewrite.
 */
function firstForwardedAddress(request: AuditableRequest): string | null {
  const header = request.headers?.['x-forwarded-for'];
  const raw = Array.isArray(header) ? header[0] : header;
  if (typeof raw !== 'string') return request.socket?.remoteAddress ?? null;
  const first = raw.split(',')[0]?.trim();
  return first && first.length > 0 ? first : null;
}
