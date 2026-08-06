/**
 * M-008 · `@Audited()` — BR-DAT-01, BR-DAT-02, PE2.
 *
 * Declares that this route writes an `audit_log` row. The interceptor that does the writing
 * arrives in M-013; the decorator exists now so the OpenAPI document records which operations
 * are audited, and so `api-gates` can later assert that every mutating admin route carries it.
 *
 * The audit row is written by `app_append`, which holds INSERT and NOT SELECT. The writer
 * cannot read the log — P9, and the reason a compromised request path cannot enumerate what
 * has been recorded about it.
 */

import { SetMetadata } from '@nestjs/common';

export const AUDITED = 'gymmap:audited';

export interface AuditedOptions {
  /** `audit_entity_type_enum` value — one of the 31 governed entities. */
  readonly entityType: string;
  /** `audit_action_enum` value. */
  readonly action: string;
}

export const Audited = (options: AuditedOptions): MethodDecorator => SetMetadata(AUDITED, options);
