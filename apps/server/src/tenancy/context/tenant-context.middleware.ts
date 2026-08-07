/**
 * M-011 · `TenantContextMiddleware` — §11.3, BR-TEN-01, AC-1.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE TENANT NEVER COMES FROM THE CLIENT. NOT IN A HEADER, A QUERY PARAMETER OR A BODY FIELD.
 *
 * A client-supplied tenant id is not a convenience with a caveat — it is the whole breach in one
 * field. `X-Tenant-Id: <someone else's uuid>` is a valid HTTP request, produces a syntactically
 * valid query, and returns a correct-looking page of another gym's members.
 *
 * So the three shapes are REJECTED — 400 TENANT_HEADER_NOT_ACCEPTED — rather than ignored.
 * Ignoring is the tempting choice and it is wrong twice over: a client that believes it is
 * scoping requests gets silently different behaviour, and we lose the security signal. Somebody
 * sending `X-Tenant-Id` is either an integrator working from the wrong documentation or someone
 * probing, and both are worth a log line.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * WHY THIS IS MIDDLEWARE AND NOT A GUARD — the first trap M-011 names.
 *
 * Middleware runs BEFORE guards, pipes and interceptors. A guard runs after validation, so a
 * `400` from the Zod pipe would arrive with no tenant and no correlation id — and a validation
 * error is the single most common thing anyone debugs. Putting the context here means the first
 * log line of the first failure already says who it was for (`AC-FND-09.5`).
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { TenantHeaderNotAcceptedError } from '../domain/tenancy.errors.js';
import type { AuthenticatedRequest } from '../../common/guards/jwt-auth.guard.js';
import { runWithTenant, runWithoutTenant } from './tenant-context.als.js';
import { tenantIdFromClaim } from '../domain/tenant-id.vo.js';

/** Every spelling of a client-supplied tenant id we refuse. Matched case-insensitively. */
export const REJECTED_TENANT_KEYS = [
  'x-tenant-id',
  'x-tenantid',
  'tenant-id',
  'tenant_id',
  'tenantid',
] as const;

/**
 * Routes that legitimately have no tenant.
 *
 * An allow-list rather than "anything unauthenticated": the login endpoint has no tenant because
 * nobody has authenticated yet, and the probes have none because they touch no tenant data.
 * Everything else that reaches here without a tenant is a defect, and should look like one.
 */
const UNTENANTED_PATHS = [/^\/healthz$/, /^\/readyz$/, /^\/v1\/auth\//];

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  // `_response` is unused: this middleware never writes to the response. A refusal is thrown as
  // a DomainException and rendered by the exception filter, so the §C3.1 envelope is produced in
  // exactly one place — a middleware that writes its own error body is how a second, subtly
  // different error shape reaches clients.
  use(request: Request, _response: Response, next: NextFunction): void {
    this.refuseClientSuppliedTenant(request);

    const principal = (request as AuthenticatedRequest).principal;

    // ── Resolution order (§11.3) ──────────────────────────────────────────────────────────
    //
    //   1. The authenticated principal's tenant claim — every /tenant and /admin request.
    //   2. The requested RESOURCE, by database lookup — public reads of a gym or branch.
    //      Added in M-012 with the first public route; it is a lookup, never a parse, because
    //      parsing a slug for a tenant means the URL decides the scope.
    //   3. For /webhooks, the STORED payment intent — never the payload. A webhook body is
    //      attacker-controllable until its signature is verified, and even then it says what
    //      the provider believes, not what we recorded (BR-PAY-05). M-058.
    //
    // Only (1) exists at Sprint 0. The others are deliberately absent rather than stubbed —
    // a stub that returns a tenant is worse than no stub at all.
    if (principal?.tenant_id) {
      const tenantId = tenantIdFromClaim(principal.tenant_id);
      runWithTenant(tenantId, () => next(), principal.sub);
      return;
    }

    // No tenant. Enter the frame EXPLICITLY rather than leaving it unset: `runWithoutTenant`
    // makes "this request has no tenant" a decision that was taken, and it means a downstream
    // read of the context returns NONE rather than whatever a neighbouring request left behind.
    runWithoutTenant(() => next());
  }

  /**
   * AC-1 — a client-supplied tenant id in a header, query parameter or body is a 400.
   *
   * Checked on EVERY route including the untenanted ones. A caller sending `X-Tenant-Id` to
   * `/healthz` is doing the same thing as one sending it to `/v1/tenant/members`, and the
   * signal is the same.
   */
  private refuseClientSuppliedTenant(request: Request): void {
    for (const key of REJECTED_TENANT_KEYS) {
      if (request.headers[key] !== undefined) {
        throw this.refuse('header', key);
      }
    }

    for (const key of Object.keys(request.query ?? {})) {
      if ((REJECTED_TENANT_KEYS as readonly string[]).includes(key.toLowerCase())) {
        throw this.refuse('query', key);
      }
    }

    // The body is only present for a parsed content type, and only the top level is checked.
    // A nested `tenant_id` is a legitimate field name on some payloads — a settlement line
    // references a tenant — so a deep scan would reject valid requests. The top level is where
    // a caller would put it believing it scopes the request, which is the case that matters.
    const body: unknown = (request as { body?: unknown }).body;
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      for (const key of Object.keys(body as Record<string, unknown>)) {
        if ((REJECTED_TENANT_KEYS as readonly string[]).includes(key.toLowerCase())) {
          throw this.refuse('body', key);
        }
      }
    }
  }

  private refuse(location: 'header' | 'query' | 'body', key: string): TenantHeaderNotAcceptedError {
    return new TenantHeaderNotAcceptedError(location, key);
  }
}

/** True when a path is one of the legitimately untenanted routes. */
export function isUntenantedPath(path: string): boolean {
  return UNTENANTED_PATHS.some((pattern) => pattern.test(path));
}
