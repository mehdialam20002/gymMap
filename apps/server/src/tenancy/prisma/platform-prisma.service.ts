/**
 * M-014 · The `app_platform_ro` client — a SEPARATE pool, SELECT grants only. PE1, AC-FND-05.3.
 *
 * ┌─ THIS CLIENT IS NOT EXTENDED WITH THE TENANT-CONTEXT EXTENSION, AND THAT IS CORRECT ────────┐
 * │ Every other client in the system goes through `withTenantContext`, which refuses a query    │
 * │ with no tenant. This one must NOT: reading across tenants is its entire purpose, and the    │
 * │ extension would throw on every call.                                                        │
 * │                                                                                             │
 * │ What replaces the extension is not trust. It is:                                            │
 * │                                                                                             │
 * │   the ROLE      `gymmap_platform` is a member of `app_platform_ro` and nothing else, and    │
 * │                 that role holds SELECT grants only. A write here fails in PostgreSQL.       │
 * │   the POLICY    `rls_<table>__platform_read` is `FOR SELECT` and names that role. The       │
 * │                 exception is visible in `pg_policies`, not hidden in `pg_roles`.            │
 * │   the GUARD     every method below refuses unless a `runElevated()` callback is on the      │
 * │                 stack, so the client cannot be used as an ambient back door.                │
 * │   the RULE      `no-platform-prisma-outside-allowlist` limits the import to four modules.   │
 * │                                                                                             │
 * │ Four independent layers, and the first two are enforced by the database rather than by us.  │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { APP_CONFIG, type AppConfig } from '../../common/config/app-config.schema.js';
import { skipEagerConnect } from '../../common/bootstrap/contract-only-mode.js';
import { ElevationRefusedError } from '../domain/tenancy.errors.js';
import { currentElevation } from './platform-elevation.js';

@Injectable()
export class PlatformPrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlatformPrismaService.name);
  private readonly readOnly: PrismaClient;

  // `@Inject(APP_CONFIG)` rather than relying on the reflected parameter type. AppConfig is a
  // Zod-inferred TYPE with no runtime value, so emitDecoratorMetadata would emit `undefined`
  // (TD-030) the moment this class was provided by class reference instead of by factory —
  // and the failure appears at boot, pointing nowhere near here. The explicit token removes
  // the dependency on how the provider happens to be registered today.
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    // '' means unset, matching AUDIT_DATABASE_URL. Falling back to the application connection
    // keeps local setup one step; the warning below makes the weaker posture visible rather
    // than something discovered by reading the source during an incident.
    const url = this.config.PLATFORM_DATABASE_URL || this.config.DATABASE_URL;
    this.readOnly = new PrismaClient({ datasources: { db: { url } } });
  }

  async onModuleInit(): Promise<void> {
    if (skipEagerConnect(this.config.APP_ENV, 'PlatformPrismaService')) return;
    await this.readOnly.$connect();
    if (!this.config.PLATFORM_DATABASE_URL) {
      this.logger.warn(
        'PLATFORM_DATABASE_URL is unset — elevated reads are running on the APPLICATION ' +
          'connection, which is a member of app_rw. That role holds INSERT and UPDATE, so the ' +
          '"elevation cannot write" property is enforced only by the SELECT-only policy and not ' +
          'also by the grants. Acceptable locally; set it in anything deployed.',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.readOnly.$disconnect();
  }

  /**
   * The client, available ONLY inside a `runElevated()` callback.
   *
   * The guard is what stops this becoming an ambient capability. Without it, a module on the
   * allow-list could inject `PlatformPrismaService` and read across tenants with no reason, no
   * actor and no audit row — which is precisely the design `runElevated()` exists to replace.
   *
   * Deliberately NOT a silent fallback to the tenant-scoped client. A method that quietly
   * narrows its scope returns fewer rows than the caller expected, and the caller reads that as
   * "no data" rather than "wrong client".
   */
  get client(): PrismaClient {
    const elevation = currentElevation();
    if (!elevation) {
      throw new ElevationRefusedError(
        'the platform client was accessed outside runElevated(). There is no ambient elevation: ' +
          'crossing a tenant boundary is a call that names a reason, an actor and a scope',
        'NONE',
      );
    }
    return this.readOnly;
  }

  /**
   * Escape hatch for the isolation suite ONLY.
   *
   * Named so it is obvious in a diff and in a stack trace. Anything in `src/` that calls it is
   * a review rejection: it returns the client with no elevation guard, which is the ambient
   * capability this whole module refuses to provide.
   */
  unsafeClientForIsolationTests(): PrismaClient {
    return this.readOnly;
  }
}
