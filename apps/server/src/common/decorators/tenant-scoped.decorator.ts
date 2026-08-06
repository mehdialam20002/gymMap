/**
 * M-008 · `@TenantScoped()` — BR-TEN-01, §11.3.
 *
 * Marks a route whose data is tenant-owned. The isolation suite (M-015) generates its A1–A7
 * case group from this metadata, so an endpoint that reads tenant data and forgets the
 * decorator is an endpoint with no cross-tenant test.
 *
 * The tenant id itself is NEVER a parameter of the route and never a client header — it comes
 * from the authenticated principal and is applied by the Prisma extension (ADR-0005). This
 * decorator declares the FACT, it does not carry the value.
 */

import { SetMetadata } from '@nestjs/common';

export const IS_TENANT_SCOPED = 'gymmap:tenant-scoped';

export const TenantScoped = (): MethodDecorator => SetMetadata(IS_TENANT_SCOPED, true);
