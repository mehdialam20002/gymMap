/**
 * M-008 · `@TenantScoped()` — BR-TEN-01, §11.3.
 *
 * Marks a route whose data is tenant-owned. The isolation suite (M-015) generates its A1–A7
 * case group from this metadata, so an endpoint that reads tenant data and forgets the decorator
 * is an endpoint with NO cross-tenant test — and a missing isolation test looks exactly like a
 * passing one on the dashboard.
 *
 * The tenant id itself is never a route parameter and never a client header: it comes from the
 * authenticated principal and is applied by the Prisma extension (ADR-0005). This decorator
 * declares the FACT, it does not carry the value.
 */

import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export const IS_TENANT_SCOPED = 'gymmap:tenant-scoped';

export const TenantScoped = () =>
  applyDecorators(
    SetMetadata(IS_TENANT_SCOPED, true),
    ApiExtension('x-gymmap-tenant-scoped', true),
  );
