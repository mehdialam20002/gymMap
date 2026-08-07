/**
 * M-010 · `tenancy/` public surface — FolderStructure.md §8.1 row 1.
 *
 * Note what is NOT here: `PrismaClient`. The raw client is private to `PrismaService`, and
 * `no-raw-prisma-client` fails the build on an import of it from anywhere else. Repositories
 * inject `PrismaService` and use `.client`, which is the EXTENDED client — there is no path to
 * an unscoped query that does not first defeat a CI gate.
 */

export { TenancyModule } from './tenancy.module.js';
export { PrismaService, type TenantScopedPrisma } from './prisma/prisma.service.js';
export { runInTenantTransaction, GLOBAL_MODELS } from './prisma/tenant-scoped-client.js';

export {
  currentTenantContext,
  runWithTenant,
  runWithPlatformScope,
  runWithoutTenant,
} from './context/tenant-context.als.js';

export {
  NO_TENANT,
  isPlatformScope,
  isTenantScope,
  platformScoped,
  tenantScoped,
  assertNeverContext,
  type TenantContext,
  type NoTenantContext,
  type PlatformContext,
  type TenantScopedContext,
} from './context/tenant-context.vo.js';

export {
  MissingTenantContextError,
  NestedTransactionError,
  TenantContextAlreadySetError,
} from './domain/tenancy.errors.js';

export { tenantIdFromClaim, type TenantId } from './domain/tenant-id.vo.js';
