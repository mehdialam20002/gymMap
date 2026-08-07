/**
 * M-012 · The application configuration BOTH entry points apply.
 *
 * ┌─ WHY THIS FILE EXISTS ──────────────────────────────────────────────────────────────────────┐
 * │ `main.ts` boots the server. `openapi/emit.ts` boots the same graph to generate the contract.│
 * │ Anything applied in one and not the other produces a contract that does not describe the    │
 * │ server — and the drift gate cannot see it, because job 10 compares the document to a fresh  │
 * │ generation, and both would be wrong in the same way.                                        │
 * │                                                                                             │
 * │ That is not hypothetical. `enableVersioning()` lived only in `main.ts`, so the generated    │
 * │ document advertised `GET /tenant/ping` while the server served `GET /v1/tenant/ping`. Every │
 * │ client generated from that contract would have called a 404, and `api-gates` AC-5 is what   │
 * │ caught it — by failing the routes for not being under /v1.                                  │
 * │                                                                                             │
 * │ One function, called by both. There is now no way to configure one and not the other.       │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { VersioningType, type INestApplication } from '@nestjs/common';

import { DomainExceptionFilter } from '../errors/domain-exception.filter.js';

export function configureApp(app: INestApplication): void {
  // URI versioning. `/v1/...` on every route except the probes, which are VERSION_NEUTRAL.
  //
  // URI rather than header or media-type versioning because §C3.1 fixes it: "URL-versioned;
  // breaking changes require a new version with >= 6 months' deprecation". A URL is also the
  // only form that survives a curl in a support ticket, a CDN cache key and a log line.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // One filter, so the §C3.1 envelope is produced in exactly one place. A second error shape
  // reaching clients is how a generated client ends up with two error branches, one of which
  // nobody tests.
  app.useGlobalFilters(new DomainExceptionFilter());

  // No GLOBAL validation pipe. Validation is per-route with `ZodValidationPipe`, because a Zod
  // schema is specific to one payload. Nest's own ValidationPipe requires class-validator,
  // which would be a substitution for Zod (A-02) and is therefore forbidden.
  //
  // Rejecting unknown properties is not lost: every schema in `packages/types` is `.strict()`,
  // so an unexpected field is a 400 rather than a silent strip. Silent stripping is how a client
  // believes it disabled a setting that never arrived.
}
