/**
 * M-004/M-006 · `common/` public surface — FolderStructure.md §8.1 row 1.
 *
 * §8.2: `common/` is provider-only. It is a MECHANISM LIBRARY, not a bounded context — it owns
 * no tables, takes no domain decision, and is consumed entirely by dependency injection. That
 * is why it has no `controllers/` requirement, and why its exports are types, filters, pipes
 * and ports rather than use cases.
 *
 * Everything another module may import from `common/` is listed here. A deep import into
 * `common/errors/domain-exception.js` bypasses this file and is what the
 * `module-public-api-only` rule exists to stop: it makes every internal file a de-facto public
 * API that cannot be moved without breaking twenty-two other modules.
 */

// --- errors (§13.1) -------------------------------------------------------
export {
  DomainException,
  ValidationException,
  NotFoundException,
  UnauthenticatedException,
  PermissionDeniedException,
  BusinessRuleException,
  ConflictException,
  DependencyUnavailableException,
  TenantContextMissingException,
  type ProblemDetail,
} from './errors/domain-exception.js';
export { DomainExceptionFilter } from './errors/domain-exception.filter.js';

// --- validation (A-02) ----------------------------------------------------
export { ZodValidationPipe } from './validation/zod-validation.pipe.js';

// --- correlation and redaction (NFR-OBS-02, BR-DAT-06) --------------------
export {
  CORRELATION_HEADER,
  currentCorrelation,
  currentCorrelationId,
  newCorrelationId,
  runWithCorrelation,
  sanitiseCorrelationId,
  setCorrelationActor,
  setCorrelationTenant,
  type CorrelationContext,
} from './logging/correlation.als.js';
export { CorrelationMiddleware } from './logging/correlation.middleware.js';
export {
  REDACTED_FIELD_NAMES,
  REDACTION_PLACEHOLDER,
  buildRedactionPaths,
  isRedactedFieldName,
  redactDeep,
} from './logging/redaction.js';

// --- configuration (§8.9) -------------------------------------------------
export { appConfigSchema, type AppConfig } from './config/app-config.schema.js';

// --- module --------------------------------------------------------------
export { CommonModule } from './common.module.js';

// --- ports (§9.5 D4) ------------------------------------------------------
export { CLOCK, type Clock } from './application/ports/clock.port.js';
export { ID_GENERATOR, type IdGenerator } from './application/ports/id-generator.port.js';

// --- types ----------------------------------------------------------------
export type { CorrelationId, DependencyHealth } from './types/index.js';
