/**
 * `M-030` `AC-6` · The cross-tenant registration-number lookup, through `runElevated`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE ONE PRE-CHECK ADAPTER THAT CAN REALLY QUERY, AND THE ONLY LEGITIMATE WAY TO DO IT
 *
 * `AC-6`: the two cross-tenant checks run **only** through `runElevated` with a stated reason, each
 * execution writes its audit row, and *"a direct cross-tenant query fails the isolation suite"*.
 *
 * `platform-elevation.ts` states the hazard this defends: *"a cross-tenant read is a bug that looks
 * like a feature — it returns MORE rows than expected, so it never fails a test and never throws."*
 * A duplicate probe is the shape of query most likely to be written as a plain `findMany`, because
 * the plain version returns exactly what the author wanted. The elevation is what makes it visible.
 *
 * ┌─ IT USES THE PLATFORM CLIENT, NOT THE TENANT-EXTENDED ONE ───────────────────────────────────┐
 * │ `A-01`: every tenant-scoped access goes through the extension that sets `app.tenant_id` first. │
 * │ This query is deliberately NOT tenant-scoped — the question spans tenants — so the extension   │
 * │ would filter away the only rows worth finding. `runElevated` hands the callback a              │
 * │ `PlatformContext` for exactly this, and `PE-T5` refuses to open one from inside a tenant scope. │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_WRITE_PORT, type AuditWritePort } from '../../audit/ports/audit-write.port.js';
import {
  reason,
  runElevated,
  type ElevationActor,
} from '../../tenancy/prisma/platform-elevation.js';
import { PlatformPrismaService } from '../../tenancy/prisma/platform-prisma.service.js';
import type {
  RegistrationDuplicateProbe,
  RegistrationProbeOutcome,
} from '../application/prechecks/duplicate-registration-id.check.js';

/**
 * The actor for an automated run.
 *
 * A job is not a person, and recording it as one would put a machine's reads into a human's audit
 * history — which is how a reviewer ends up answering for a query they never made. `BR-GYM-03`
 * turns on the same distinction from the other side: approval must be a human act, so the system
 * has to be able to tell the two kinds of actor apart everywhere, not only at the decision.
 */
const PRECHECK_ACTOR: ElevationActor = { kind: 'SYSTEM', label: 'onboarding.run-prechecks' };

@Injectable()
export class RegistrationDuplicatePrismaProbe implements RegistrationDuplicateProbe {
  constructor(
    private readonly platform: PlatformPrismaService,
    @Inject(AUDIT_WRITE_PORT) private readonly audit: AuditWritePort,
  ) {}

  async findOtherTenantsClaiming(normalised: string): Promise<RegistrationProbeOutcome> {
    try {
      const matches = await runElevated(
        this.audit,
        {
          actor: PRECHECK_ACTOR,
          scope: 'READ_ALL_TENANTS',
          // `reason()` and not a bare string: `NonEmptyReason` is a brand with a validating
          // constructor, so an empty or whitespace reason cannot reach the audit row at all.
          reason: reason(
            'onboarding duplicate pre-check: is this registration number claimed elsewhere',
          ),
        },
        async () =>
          this.platform.client.tenant.findMany({
            where: { registrationNumber: normalised },
            select: { id: true, status: true },
            // Bounded. A normaliser regression that collapses every number to the same string
            // would otherwise pull the whole tenant table into a jsonb column on one application.
            take: 25,
          }),
      );

      return {
        ok: true,
        matches: matches.map((t) => ({ tenantId: t.id, status: String(t.status) })),
      };
    } catch (error) {
      /*
       * `UNAVAILABLE`, which the check turns into `ERROR` — never an empty match list.
       *
       * An empty list is indistinguishable from "checked, nothing found", and `AC-8` is that those
       * two must never collapse into one another. A refused elevation in particular is a security
       * event, and reporting it as "no duplicates" would hide it behind a green tick.
       */
      return {
        ok: false,
        failure: 'UNAVAILABLE',
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
