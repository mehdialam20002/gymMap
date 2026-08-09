/**
 * `M-030` `AC-1` `AC-9` · Persisting the six results on `applications.precheck_results`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * ONE COLUMN, WRITTEN WHOLE — WHICH IS WHAT MAKES `AC-9` FREE
 *
 * `Schema.md` §4.2 makes `precheck_results` a `jsonb` column on `applications`, defaulting to
 * `'{"schema_version":1}'`. It is not a child table, so "replace the set" is a single `UPDATE`
 * rather than a delete-then-insert — and a re-run cannot leave a half-updated set behind, because
 * there is no window between the two halves. The idempotency `AC-9` asks for falls out of the
 * shape rather than being defended by code.
 *
 * `schema_version` is carried forward, not dropped. A reader that meets a version it does not know
 * must be able to say so; a payload with no version at all leaves it guessing.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../tenancy/prisma/prisma.service.js';
import type { PrecheckResult } from '../domain/precheck-result.vo.js';
import type { PrecheckResultStore } from '../jobs/run-prechecks.processor.js';

/** Bumped when the persisted shape changes in a way a reader must notice. */
export const PRECHECK_RESULTS_SCHEMA_VERSION = 1;

@Injectable()
export class PrecheckResultPrismaStore implements PrecheckResultStore {
  constructor(private readonly db: PrismaService) {}

  async replaceFor(applicationId: string, results: readonly PrecheckResult[]): Promise<void> {
    /*
     * Keyed by check name, not an array.
     *
     * An array lets the same check appear twice — which is precisely the append-instead-of-replace
     * failure `AC-9` names, re-introduced one layer down where the processor's careful `replaceFor`
     * contract cannot see it. An object makes the second `GEO_DISTANCE` overwrite the first, so the
     * invariant holds even if a future caller hands over a set that is not distinct.
     */
    const byCheck: Record<string, unknown> = {};
    for (const result of results) {
      byCheck[result.check] = {
        outcome: result.outcome,
        evidence: result.evidence,
        // Already an ISO string — the value object stores it that way, because a `Date` that
        // round-trips through jsonb comes back as a string anyway and the asymmetry is a trap.
        ranAt: result.ranAt,
      };
    }

    await this.db.client.application.update({
      where: { id: applicationId },
      data: {
        precheckResults: {
          schema_version: PRECHECK_RESULTS_SCHEMA_VERSION,
          checks: byCheck,
        },
      },
    });
  }
}
