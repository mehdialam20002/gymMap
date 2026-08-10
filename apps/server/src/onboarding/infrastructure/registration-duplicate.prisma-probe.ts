/**
 * `M-030` `AC-6` · The cross-tenant registration-number lookup, delegated to `tenancy/`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THIS FILE CONTAINS NO `runElevated` CALL, AND THAT IS THE WHOLE POINT OF IT
 *
 * The first version put the elevation here, three lines lower, and `ci:elevation-inventory` failed
 * the build: *"runElevated() in module 'onboarding', which is not on the allow-list (admin, audit,
 * reporting, settlements, tenancy)"*. The gate was right, and it caught something two rank-3
 * documents say in as many words —
 *
 *   `BusinessRules.md` `BR-TEN-01`, AUTHORITATIVE enforcement row: *"`dependency-cruiser` forbids
 *   injecting `PlatformPrismaService` outside `admin/`, `reporting/`, `settlements/` and `audit/`"*
 *   `Scalability.md` §6, the same four modules, followed by *"— nothing else"*
 *
 * — while `M-030` `AC-6` requires the check to run **only** through `runElevated` with a stated
 * reason. Both hold at once, because `AC-6` constrains HOW the read happens and not WHERE: the
 * elevation lives in `ElevatedTenantReader`, beside the two reads `admin/` already makes through
 * it, and `onboarding/` never sees `PlatformPrismaService`.
 *
 * What is left here is the adapter's real job — turning a domain question into a port answer, and
 * turning a failure into `UNAVAILABLE` rather than into an empty list.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { Injectable } from '@nestjs/common';

import {
  ElevatedTenantReader,
  type ElevationActor,
} from '../../tenancy/application/elevated-tenant-reader.js';

import type {
  RegistrationDuplicateProbe,
  RegistrationProbeOutcome,
} from '../application/prechecks/duplicate-registration-id.check.js';

/**
 * The actor for an automated run.
 *
 * A job is not a person. Recording it as one would put a machine's cross-tenant reads into a
 * reviewer's audit history, leaving them to answer for a query they never made — and `BR-GYM-03`
 * turns on the system being able to tell the two kinds of actor apart everywhere, not only at the
 * approval decision.
 */
const PRECHECK_ACTOR: ElevationActor = { kind: 'SYSTEM', label: 'onboarding.run-prechecks' };

const WHY = 'onboarding duplicate pre-check: is this registration number claimed by another tenant';

@Injectable()
export class RegistrationDuplicatePrismaProbe implements RegistrationDuplicateProbe {
  constructor(private readonly tenants: ElevatedTenantReader) {}

  async findOtherTenantsClaiming(normalised: string): Promise<RegistrationProbeOutcome> {
    try {
      const matches = await this.tenants.findTenantsClaimingRegistration(
        PRECHECK_ACTOR,
        WHY,
        normalised,
      );

      return { ok: true, matches: matches.map((t) => ({ tenantId: t.id, status: t.status })) };
    } catch (error) {
      /*
       * `UNAVAILABLE`, which the check turns into `ERROR` — never an empty match list.
       *
       * An empty list is indistinguishable from "checked, nothing found", and `AC-8` is precisely
       * that those two must never collapse into one another. A REFUSED elevation is the sharpest
       * case: it is a security event, and reporting it as "no duplicates" would file it behind a
       * green tick where nobody looks.
       */
      return {
        ok: false,
        failure: 'UNAVAILABLE',
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
