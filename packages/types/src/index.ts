/**
 * M-003 · `@gymmap/types` — the vocabulary shared by the server and all three browser surfaces.
 *
 * Import ordering note: this barrel is the ONLY public entry point (§3.2). Deep imports into
 * `@gymmap/types/src/...` are what turn a leaf package into a coupling surface, so the package
 * exports map exposes `.` alone.
 */

export * from './ids/branded.js';
export * from './currency.js';
export * from './money.js';
export * from './time.js';
export * from './pagination.js';
export * from './errors/registry.js';
export * from './errors/error-code.js';
export * from './enums/tenant-status.js';
export * from './schemas/common/money.schema.js';
export * from './schemas/common/problem-details.schema.js';
export * from './schemas/common/pagination.schema.js';
