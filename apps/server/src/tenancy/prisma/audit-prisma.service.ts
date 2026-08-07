/**
 * M-013 / M-014 · The `app_append` pool — a SEPARATE connection, authenticated as `gymmap_audit`.
 *
 * ┌─ WHY THIS LIVES IN `tenancy/prisma/` AND NOT IN `audit/infrastructure/` ─────────────────────┐
 * │ It was in `audit/` first, and `no-raw-prisma-outside-tenancy` rejected it — correctly, and   │
 * │ not on a technicality. ADR-0005's rule is not "the audit module is untrustworthy"; it is     │
 * │ that EVERY `new PrismaClient()` in this codebase should sit in one directory, because the    │
 * │ dangerous thing about a raw client is not who holds it but that a second one can appear      │
 * │ anywhere and bypass the tenant-context extension without looking unusual.                    │
 * │                                                                                              │
 * │ Three pools now exist, all constructed here, each with its own login role:                   │
 * │                                                                                              │
 * │   PrismaService          gymmap_app        app_rw            the request path, extended      │
 * │   AuditPrismaService     gymmap_audit      app_append        INSERT on audit_log, no SELECT  │
 * │   PlatformPrismaService  gymmap_platform   app_platform_ro   cross-tenant SELECT only        │
 * │                                                                                              │
 * │ One directory, three roles, and a reviewer who greps for `new PrismaClient` finds all of     │
 * │ them in one place.                                                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY A SECOND POOL AND NOT `SET ROLE` ──────────────────────────────────────────────────────┐
 * │ `SET ROLE app_append` on the request connection would be shorter and is wrong. It is one    │
 * │ forgotten `RESET ROLE` away from leaving the request path holding INSERT on the audit log,  │
 * │ and the forgetting is invisible: everything keeps working, and the extra privilege sits     │
 * │ there until somebody exploits it.                                                            │
 * │                                                                                             │
 * │ Two physically separate connections also make "which connection wrote this row" answerable  │
 * │ from `pg_stat_activity` during an incident, which the SET ROLE version cannot.              │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `gymmap_audit` is a member of `app_append` and nothing else, so this connection CAN insert an
 * audit row and CANNOT read one back — the property that stops a compromised request path
 * enumerating its own trail.
 *
 * NOT extended with the tenant-context extension, deliberately. An audit row's `tenant_id` is
 * frequently NULL (an elevation belongs to no tenant, and neither does a platform-admin login),
 * and the extension refuses any operation with no tenant in scope. Isolation is instead the
 * `app_append` grant: this pool can write one table and read nothing.
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import type { AppConfig } from '../../common/config/app-config.schema.js';

@Injectable()
export class AuditPrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditPrismaService.name);
  private readonly appendOnly: PrismaClient;

  constructor(private readonly config: AppConfig) {
    // The audit URL, or the application URL as a documented fallback. In a deployed environment
    // AUDIT_DATABASE_URL is set by Terraform to the gymmap_audit credential; locally, falling
    // back keeps `pnpm infra:up` a one-step setup. The fallback is visible in the log below so
    // nobody discovers it by reading the source during an incident.
    // '' means unset — see the schema for why empty and absent must behave identically.
    const url = this.config.AUDIT_DATABASE_URL || this.config.DATABASE_URL;
    this.appendOnly = new PrismaClient({ datasources: { db: { url } } });
  }

  async onModuleInit(): Promise<void> {
    await this.appendOnly.$connect();
    if (!this.config.AUDIT_DATABASE_URL) {
      this.logger.warn(
        'AUDIT_DATABASE_URL is unset — audit rows are being written on the APPLICATION ' +
          'connection. That connection is a member of app_rw, which holds SELECT on audit_log, ' +
          'so the "writer cannot read the log" property does not hold in this environment. ' +
          'Acceptable locally; set it in anything deployed.',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.appendOnly.$disconnect();
  }

  /**
   * Runs one parameterised statement on the append-only pool.
   *
   * A TAGGED TEMPLATE, not a string. That is the whole security property: `executeRaw\`… ${id} …\``
   * passes `id` as a bind parameter, while `executeRaw(\`… ${id} …\`)` — one pair of parentheses
   * away — interpolates it into the SQL text. Prisma's own `$executeRaw` draws the same line, and
   * this signature preserves it: the only overload takes a `TemplateStringsArray`, so the unsafe
   * call does not typecheck rather than merely being discouraged.
   *
   * The method exists at all so `audit/` never imports `@prisma/client` — not even for a type.
   * `tsPreCompilationDeps` makes a type-only import a real edge to dependency-cruiser, so a
   * `Prisma.Sql` in this signature would put the audit module back in violation.
   */
  executeRaw(sql: TemplateStringsArray, ...values: unknown[]): Promise<number> {
    return this.appendOnly.$executeRaw(sql, ...values);
  }

  /**
   * FOR TESTS ONLY. Named so it is obvious in a diff and in a stack trace.
   *
   * Anything in `src/` that calls this is a review rejection — it hands out the raw client, which
   * is the thing this service exists to keep in one directory.
   */
  unsafeClientForIsolationTests(): PrismaClient {
    return this.appendOnly;
  }
}
