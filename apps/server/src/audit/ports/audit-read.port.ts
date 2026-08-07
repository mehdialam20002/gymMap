/**
 * M-013 · `AUDIT_READ_PORT` — the ONLY audit surface `admin/` may hold. FR-ADMN-09, EP-19.
 *
 * Read-only by signature, not by convention. There is no `append` here, so a module holding
 * this port cannot write a row even by mistake — which is the whole reason the read and write
 * ports are separate interfaces rather than one with two methods.
 */

export interface AuditQuery {
  readonly entityType?: string;
  readonly entityId?: string;
  readonly actorId?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly limit?: number;
}

export interface AuditRow {
  readonly id: string;
  readonly occurredAt: Date;
  readonly actorId: string | null;
  readonly actorType: string;
  readonly impersonatedBy: string | null;
  readonly entityType: string;
  readonly entityId: string;
  readonly action: string;
  readonly reason: string | null;
  readonly correlationId: string;
}

export interface AuditReadPort {
  /** Both query shapes are index-backed (BAC-13); a third would be a sequential scan. */
  findByEntity(query: AuditQuery): Promise<readonly AuditRow[]>;
  findByActor(query: AuditQuery): Promise<readonly AuditRow[]>;
}

export const AUDIT_READ_PORT = Symbol('AuditReadPort');
