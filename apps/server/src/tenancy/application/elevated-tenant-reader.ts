/**
 * The audited cross-tenant read of `tenants` — `PE1`, `PE2`, `FR-ADMN-02`, `M-014` `READ_ALL_TENANTS`.
 *
 * ┌─ WHY THIS LIVES IN `tenancy/` AND NOT IN `admin/`, WHICH IS THE CALLER ─────────────────────┐
 * │ `runElevated()` takes an `AuditWritePort`, because it writes the elevation row BEFORE doing  │
 * │ the work it describes. So whoever calls it holds the audit WRITER.                           │
 * │                                                                                              │
 * │ `FolderStructure.md` §8.2 forbids exactly that for the administration modules, and the       │
 * │ reason is worth restating: a module that can write an audit row can write a FALSE one, and   │
 * │ a false entry in an append-only log is permanent, unfalsifiable, and indistinguishable from  │
 * │ a true one. `audit/index.ts` deliberately does not export `AUDIT_WRITE_PORT`.                │
 * │                                                                                              │
 * │ Putting the elevation here resolves both: `tenancy/` already owns `PlatformPrismaService`    │
 * │ and `runElevated`, so it is the module the concern belongs to, and `admin/` gets a narrow    │
 * │ read method that cannot append anything.                                                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE CALLER SUPPLIES THE ACTOR AND THE REASON, AND CANNOT OPT OUT ──────────────────────────┐
 * │ Both are required parameters, not options with defaults. A default reason would appear on    │
 * │ every audit row in the platform and answer nothing; a default actor would make "who read     │
 * │ this" unanswerable, which is the single question the row exists for.                          │
 * │                                                                                              │
 * │ `reason()` enforces a 20-character floor and throws below it. That is deliberately annoying: │
 * │ the alternative is an audit log full of the word "admin".                                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_WRITE_PORT, type AuditWritePort } from '../../audit/ports/audit-write.port.js';
import { PlatformPrismaService } from '../prisma/platform-prisma.service.js';
import {
  reason,
  runElevated,
  type ElevationActor,
  type HumanActor,
} from '../prisma/platform-elevation.js';

/** One row of the platform's tenant list. A projection, not the row. */
export interface TenantSummary {
  readonly id: string;
  readonly legalName: string;
  readonly tradingName: string | null;
  readonly entityType: string;
  readonly status: string;
  readonly subscriptionStatus: string;
  readonly city: string | null;
  readonly state: string | null;
  readonly gstin: string | null;
  readonly commissionRateBps: number | null;
  readonly createdAt: Date;
}

/** Counts by `tenant_status_enum`, which is the `C4.4` approval state machine. */
export type TenantStatusCounts = Readonly<Record<string, number>>;

export interface ElevatedRead {
  /** Who. Recorded on the audit row with the permission they exercised (`PE2`). */
  readonly actor: HumanActor;
  /** Why, in at least 20 characters. Throws below that. */
  readonly why: string;
}

@Injectable()
export class ElevatedTenantReader {
  constructor(
    private readonly platform: PlatformPrismaService,
    @Inject(AUDIT_WRITE_PORT) private readonly audit: AuditWritePort,
  ) {}

  /**
   * Every tenant on the platform, newest first.
   *
   * A projection rather than the row: `tenants` carries PAN, refund policy and settlement
   * configuration, and a screen that lists gyms has no business receiving any of it. Selecting
   * columns explicitly is what stops the next field added to the table from silently appearing
   * in an admin JSON response (`BR-DAT-06`).
   */
  async listTenants(read: ElevatedRead, limit = 1000): Promise<readonly TenantSummary[]> {
    return runElevated(
      this.audit,
      { reason: reason(read.why), actor: read.actor, scope: 'READ_ALL_TENANTS' },
      async () => {
        const rows = await this.platform.client.tenant.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            legalName: true,
            tradingName: true,
            entityType: true,
            status: true,
            subscriptionStatus: true,
            registeredCity: true,
            registeredState: true,
            gstin: true,
            commissionRateBps: true,
            createdAt: true,
          },
        });

        return rows.map((row) => ({
          id: row.id,
          legalName: row.legalName,
          tradingName: row.tradingName,
          entityType: String(row.entityType),
          status: String(row.status),
          subscriptionStatus: String(row.subscriptionStatus),
          city: row.registeredCity,
          state: row.registeredState,
          gstin: row.gstin,
          commissionRateBps: row.commissionRateBps,
          createdAt: row.createdAt,
        }));
      },
    );
  }

  /**
   * How many tenants sit in each status.
   *
   * A `groupBy` rather than counting the list above in JavaScript. The list is capped at `limit`
   * for the screen's sake, and a count derived from a capped list is wrong in exactly the case
   * that matters: when the platform has grown past the cap.
   */
  async countByStatus(read: ElevatedRead): Promise<TenantStatusCounts> {
    return runElevated(
      this.audit,
      { reason: reason(read.why), actor: read.actor, scope: 'READ_ALL_TENANTS' },
      async () => {
        const grouped = await this.platform.client.tenant.groupBy({
          by: ['status'],
          where: { deletedAt: null },
          _count: { _all: true },
        });

        return Object.fromEntries(
          grouped.map((group) => [String(group.status), group._count._all]),
        );
      },
    );
  }

  /**
   * `M-030` `AC-6` · Which OTHER tenants already claim this registration number.
   *
   * ═══════════════════════════════════════════════════════════════════════════════════════════
   * WHY THIS LIVES IN `tenancy/` AND NOT IN THE MODULE THAT ASKS THE QUESTION
   *
   * `onboarding/`'s duplicate pre-check needs a cross-tenant read, and M-030 `AC-6` requires it to
   * go through `runElevated` with a stated reason. The first attempt put the `runElevated` call in
   * `onboarding/infrastructure/`, and `ci:elevation-inventory` refused it — correctly.
   *
   * The allow-list is `admin`, `audit`, `reporting`, `settlements`, `tenancy`, and two rank-3
   * documents close it explicitly. `BusinessRules.md` `BR-TEN-01`, in the AUTHORITATIVE
   * enforcement row: *"`dependency-cruiser` forbids injecting `PlatformPrismaService` outside
   * `admin/`, `reporting/`, `settlements/` and `audit/`"*. `Scalability.md` §6 repeats the four and
   * adds the words *"— nothing else"*.
   *
   * `AC-6` says the check must run ONLY through `runElevated`. It says nothing about which module
   * holds the call, so both documents are satisfiable at once: the elevation moves here, beside
   * `listTenants` and `countByStatus`, which is where `admin/` already reaches for the same
   * authority. `onboarding/` gets a port and never sees `PlatformPrismaService`.
   *
   * ┌─ THE ACTOR IS A `SystemActor`, WHICH THE OTHER TWO METHODS DO NOT ACCEPT ──────────────────┐
   * │ `ElevatedRead.actor` is a `HumanActor`, because a console screen is always somebody. This   │
   * │ read is performed by `onboarding.run-prechecks`, and recording a job as a person would put  │
   * │ a machine's cross-tenant reads into a reviewer's audit history — leaving them to answer for │
   * │ a query they never made. `BR-GYM-03` turns on the same distinction from the other side.     │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   * ═══════════════════════════════════════════════════════════════════════════════════════════
   */
  async findTenantsClaimingRegistration(
    actor: ElevationActor,
    why: string,
    normalisedRegistrationNumber: string,
  ): Promise<readonly { id: string; status: string }[]> {
    return runElevated(
      this.audit,
      { reason: reason(why), actor, scope: 'READ_ALL_TENANTS' },
      async () => {
        const rows = await this.platform.client.tenant.findMany({
          where: { registrationNumber: normalisedRegistrationNumber, deletedAt: null },
          // Two columns, and neither is the registration number. `BR-DAT-06` keeps a business
          // identifier out of a record that is persisted and rendered; the reviewer already has
          // the number on the application in front of them.
          select: { id: true, status: true },
          /*
           * Bounded, and the bound is a tripwire rather than pagination.
           *
           * A normaliser regression that collapsed every registration number to the same string
           * would otherwise pull the entire tenant table into a jsonb column on one application.
           * Twenty-five is far above any legitimate answer — a second tenant claiming the number
           * is already the finding.
           */
          take: 25,
        });

        return rows.map((row) => ({ id: row.id, status: String(row.status) }));
      },
    );
  }
}
