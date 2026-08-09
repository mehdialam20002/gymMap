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
  isStorableCorrelationId,
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
//
// ┌─ FROM `clock/`, WHICH IS WHERE `CommonModule` REGISTERS THEM ──────────────────────────────┐
// │ These two lines used to point at `./application/ports/clock.port.js` and                   │
// │ `./application/ports/id-generator.port.js` — a SECOND pair of `Symbol('Clock')` and        │
// │ `Symbol('IdGenerator')` values, with a differently-shaped `Clock` interface                │
// │ (`{ now, nowMs }` rather than `{ now }`).                                                   │
// │                                                                                             │
// │ `common.module.ts` has always registered the `clock/` pair. So any module importing         │
// │ `CLOCK` from this barrel would have injected a token no provider answers, and Nest would    │
// │ fail at RUNTIME — "Nest can't resolve dependencies" — not at compile time, because the      │
// │ symbol types are identical and the interfaces are structurally compatible for `now()`.      │
// │                                                                                             │
// │ It never fired because nothing had imported from the barrel yet. Every existing consumer    │
// │ reaches into `common/clock/clock.port.js` directly. M-020 is the first milestone that       │
// │ would plausibly have used the public surface, and it would have been the one to find it.    │
// │                                                                                             │
// │ `common-barrel.spec.ts` now asserts these are the SAME symbols the module registers, by     │
// │ identity — the only assertion that can catch a duplicate `Symbol()` with the same           │
// │ description, because every other comparison passes.                                         │
// └─────────────────────────────────────────────────────────────────────────────────────────────┘
export { CLOCK, ID_GENERATOR, type Clock, type IdGenerator } from './clock/clock.port.js';

// --- types ----------------------------------------------------------------
export type { CorrelationId, DependencyHealth } from './types/index.js';
