/** M-008 · The metadata decorators the reflection pass reads. */
export { REQUIRED_PERMISSION, RequiredPermission } from './required-permission.decorator.js';
export { IS_PUBLIC, Public } from './public.decorator.js';
export { IS_TENANT_SCOPED, TenantScoped } from './tenant-scoped.decorator.js';
export { IS_IDEMPOTENT, Idempotent } from './idempotent.decorator.js';
export {
  RATE_LIMIT_CLASS,
  RATE_LIMIT_CLASSES,
  RateLimit,
  type RateLimitClass,
} from './rate-limit.decorator.js';
export { AUDITED, Audited, type AuditedOptions } from './audited.decorator.js';
export { EMITS_ERRORS, EmitsErrors } from './emits-errors.decorator.js';
