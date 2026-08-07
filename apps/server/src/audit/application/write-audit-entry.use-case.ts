/**
 * M-013 · `WriteAuditEntry` — the ONE primitive every audit row passes through. AC-FND-11.2.
 *
 * The HTTP interceptor uses it. So does a BullMQ processor, a webhook handler and
 * `runElevated()`. AC-FND-11.2 requires exactly this: "coverage is not HTTP-shaped".
 *
 * A background job that expires memberships mutates audited entities without any request, and a
 * design where the interceptor is the only writer would leave that job's work invisible. The
 * gap would be discovered during an incident, by its absence.
 */

import { Inject, Injectable } from '@nestjs/common';

import {
  AUDIT_WRITE_PORT,
  type AuditEntry,
  type AuditWritePort,
} from '../ports/audit-write.port.js';

@Injectable()
export class WriteAuditEntryUseCase {
  constructor(@Inject(AUDIT_WRITE_PORT) private readonly audit: AuditWritePort) {}

  async execute(entry: AuditEntry): Promise<void> {
    await this.audit.append(entry);
  }
}
