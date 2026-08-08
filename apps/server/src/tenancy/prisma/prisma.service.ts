/**
 * M-010 · THE ONLY PLACE `PrismaClient` IS CONSTRUCTED IN THIS REPOSITORY — P1, P2, PX-7.
 *
 * `dependency-cruiser`'s `no-raw-prisma-client` rule fails the build on a `@prisma/client`
 * import anywhere outside `apps/server/src/tenancy/prisma/`. That rule and this file are the
 * two halves of one guarantee: every query in the system passes through the tenant-context
 * extension, because there is no other client to reach.
 *
 * A second construction site would not look dangerous in review — `new PrismaClient()` in a
 * repository reads as ordinary code. It would simply not be extended, so every query through it
 * would run with no `app.tenant_id` and either raise or, if the policy were ever relaxed, return
 * another tenant's rows.
 */

import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { APP_CONFIG, type AppConfig } from '../../common/config/app-config.schema.js';
import { ReadinessService } from '../../common/health/readiness.service.js';
import { skipEagerConnect } from '../../common/bootstrap/contract-only-mode.js';
import { withTenantContext } from './tenant-scoped-client.js';

/**
 * The two event shapes, declared locally rather than imported.
 *
 * `Prisma.QueryEvent` and `Prisma.LogEvent` exist in the generated `index.d.ts` but are not
 * reachable through the `@prisma/client` exports map, which resolves to `default.d.ts`. Chasing
 * that indirection would also couple this file to type names Prisma has renamed between major
 * versions.
 *
 * Only the fields actually read are declared. Notably ABSENT: `params`, which carries every
 * bound value — PAN numbers, phone numbers, email addresses, KYC document keys. Not declaring
 * it means a future edit cannot log it by reflex (BR-DAT-06).
 */
interface QueryEvent {
  readonly query: string;
  readonly duration: number;
  readonly target: string;
}

interface LogEvent {
  readonly message: string;
}

/** The extended client — the client plus the extension, with full model typing preserved. */
export type TenantScopedPrisma = ReturnType<typeof withTenantContext>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /**
   * The raw client. PRIVATE, and it stays that way.
   *
   * Nothing outside this class may hold it: a caller with the raw client can bypass the
   * extension by construction, which is the one thing this module exists to prevent. `client`
   * below is the extended one.
   */
  /**
   * Typed with the log configuration so `$on('query' | 'warn' | 'error')` narrows.
   *
   * Without the generic, `PrismaClient`'s `$on` parameter is `never` — Prisma derives the
   * event names from the `log` option at the TYPE level, and a bare `PrismaClient` declares no
   * events. The generic has to state the same array the constructor is given.
   */
  private readonly raw: PrismaClient<{
    log: [
      { level: 'query'; emit: 'event' },
      { level: 'warn'; emit: 'event' },
      { level: 'error'; emit: 'event' },
    ];
  }>;

  /** The extended client. This is what every repository injects. */
  readonly client: TenantScopedPrisma;

  // `@Inject(APP_CONFIG)` rather than relying on the reflected parameter type. AppConfig is a
  // Zod-inferred TYPE with no runtime value, so emitDecoratorMetadata would emit `undefined`
  // (TD-030) the moment this class was provided by class reference instead of by factory —
  // and the failure appears at boot, pointing nowhere near here. The explicit token removes
  // the dependency on how the provider happens to be registered today.
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly readiness: ReadinessService,
  ) {
    this.raw = new PrismaClient({
      datasources: { db: { url: config.DATABASE_URL } },
      // `query` is emitted as an event rather than logged directly, so the OTel exporter can
      // sample it. Logging every query at info level would put parameter values — including
      // PAN and phone numbers — into the log aggregator, which BR-DAT-06 forbids.
      log: [
        { level: 'query', emit: 'event' },
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });

    this.client = withTenantContext(this.raw);
  }

  async onModuleInit(): Promise<void> {
    // Contract-only mode builds the client and opens nothing — see contract-only-mode.ts.
    // The query listener below is still registered, so the shape of the service is unchanged.
    if (!skipEagerConnect(this.config.APP_ENV, 'PrismaService')) {
      await this.raw.$connect();
    }

    // ┌─ `/readyz` HAS TO BE TOLD THIS CONNECTION EXISTS ────────────────────────────────────┐
    // │ `ReadinessService` reports `not_ready` while no probe is registered, deliberately —   │
    // │ answering "ready" before any infrastructure module has wired itself in is a lie that  │
    // │ only surfaces under production traffic.                                                │
    // │                                                                                        │
    // │ Which means a `register()` that nobody calls is not a missing nicety: the pod never    │
    // │ becomes ready, the orchestrator never routes to it, and the deployment stalls with a  │
    // │ perfectly healthy process inside. Registered HERE rather than in a bootstrap file so   │
    // │ the probe cannot outlive the connection it probes.                                     │
    // └────────────────────────────────────────────────────────────────────────────────────────┘
    this.readiness.register({
      name: 'postgres',
      // `SELECT 1` over the real pool. Not `$connect()`, which resolves from a cached connection
      // and would keep reporting healthy after the database went away.
      check: async () => {
        await this.raw.$queryRaw`SELECT 1`;
      },
    });

    // Sampled, and the PARAMETERS ARE NEVER LOGGED.
    //
    // Prisma's query event carries `e.params` as a JSON array of every bound value — which on
    // this schema means PAN numbers, phone numbers, email addresses and KYC document keys. That
    // is exactly the payload BR-DAT-06 keeps out of logs, and it arrives by default in the
    // shape most likely to be forwarded to an aggregator.
    this.raw.$on('query', (event: QueryEvent) => {
      if (event.duration < SLOW_QUERY_MS) return;
      this.logger.warn({
        message: 'slow query',
        durationMs: event.duration,
        // The statement text only. It contains placeholders, not values.
        query: event.query,
        target: event.target,
      });
    });

    this.raw.$on('warn', (event: LogEvent) => this.logger.warn(event.message));
    this.raw.$on('error', (event: LogEvent) => this.logger.error(event.message));

    this.logger.log(`Prisma connected · env=${this.config.APP_ENV}`);
  }

  async onModuleDestroy(): Promise<void> {
    // Without this, SIGTERM leaves in-flight interactive transactions holding connections until
    // Postgres times them out — and every deploy briefly halves the effective pool.
    await this.raw.$disconnect();
  }

  /**
   * Escape hatch for the isolation suite and for migrations verification ONLY.
   *
   * Named to be obvious in a diff and in a stack trace. Anything in `src/` that calls it is a
   * review rejection: it returns the UNEXTENDED client, so a query through it carries no
   * tenant scope at all.
   */
  unsafeRawClientForIsolationTests(): PrismaClient {
    return this.raw;
  }
}

/**
 * A query slower than this is logged. Not a performance target — a signal that a query is
 * holding a pooled connection long enough to matter, which under interactive transactions is
 * how a pool is exhausted (TR-37).
 */
const SLOW_QUERY_MS = 200;
