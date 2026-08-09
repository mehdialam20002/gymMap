/**
 * `M-026` · `kyc_documents` on Prisma — `BR-DAT-07`, retention class `R-KYC`.
 *
 * Tenant-owned with RLS enabled and forced, so nothing here filters by tenant — see the sibling
 * repository for why that is a property of the TABLE rather than a style choice.
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../tenancy/prisma/prisma.service.js';
import type { KycDocumentStatus, KycDocumentType } from '../types/onboarding.types.js';

export interface KycDocumentRow {
  readonly id: string;
  readonly documentType: KycDocumentType;
  readonly status: KycDocumentStatus;
  readonly tombstonedAt: Date | null;
}

@Injectable()
export class KycDocumentPrismaRepository {
  constructor(private readonly db: PrismaService) {}

  /**
   * Every document on one application, TOMBSTONED ONES INCLUDED.
   *
   * ┌─ THE MISSING `tombstonedAt: null` FILTER IS THE POINT ─────────────────────────────────────┐
   * │ The habit from every other table here is to filter the deleted rows out. Doing it would     │
   * │ defeat the reason this table has no `deleted_at` at all: a tombstoned document is evidence  │
   * │ that a legally required check was performed and that its bytes were later destroyed. A      │
   * │ reader who cannot see it cannot answer "did this gym ever supply a PAN?", which is the      │
   * │ question `R-KYC` retention exists for.                                                       │
   * │                                                                                              │
   * │ Callers wanting only live documents filter at the call site, where the decision is visible   │
   * │ and somebody can disagree with it.                                                            │
   * └───────────────────────────────────────────────────────────────────────────────────────────┘
   */
  async forApplication(applicationId: string): Promise<readonly KycDocumentRow[]> {
    return this.db.client.kycDocument.findMany({
      where: { applicationId },
      select: { id: true, documentType: true, status: true, tombstonedAt: true },
      orderBy: { documentType: 'asc' },
    });
  }

  /**
   * Records that the stored object was destroyed. The ROW stays.
   *
   * An UPDATE, never a DELETE — and nobody holds DELETE on this table, so a future version that
   * tried would meet `permission denied` rather than quietly succeeding and taking the evidence
   * with it.
   */
  async tombstone(id: string, at: Date): Promise<void> {
    await this.db.client.kycDocument.update({
      where: { id },
      data: { tombstonedAt: at },
    });
  }
}
