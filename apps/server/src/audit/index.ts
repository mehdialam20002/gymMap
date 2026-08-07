/**
 * M-013 · `audit/` public surface.
 *
 * Note what is ABSENT: `AUDIT_WRITE_PORT`. §8.2 keeps the writer unreachable from the
 * administration UI, so only the interceptor and `runElevated()` — both inside the composition
 * root — receive it. `admin/` gets the read port and nothing else.
 */

export { AuditModule } from './audit.module.js';
export {
  AUDIT_READ_PORT,
  type AuditReadPort,
  type AuditQuery,
  type AuditRow,
} from './ports/audit-read.port.js';
export type { AuditEntry } from './ports/audit-write.port.js';
