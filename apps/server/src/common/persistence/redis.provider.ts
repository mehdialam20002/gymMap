/**
 * M-020 · The Redis connection — `A-25`, `NFR-SEC-06`, `TD-025`.
 *
 * ┌─ ONE CLIENT, AND `TD-025` IS THE REASON TO NOTICE THAT ─────────────────────────────────────┐
 * │ `TD-025` records the accepted debt: one Redis instance serves cache, queue, rate limiting   │
 * │ AND sessions, with the trigger *"first eviction on a queue key, or Redis memory above 70%"*.│
 * │                                                                                              │
 * │ The LOGICAL separation is already in place — `infra/compose` gives three databases and       │
 * │ `infra:verify` asserts it — so splitting the instance later is a URL change per concern     │
 * │ rather than a rewrite. This provider is the single place those URLs would diverge.           │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ `maxRetriesPerRequest: 1`, AND WHY NOT THE DEFAULT ────────────────────────────────────────┐
 * │ `ioredis` defaults to 20 retries per request, with backoff. On the login path that turns a  │
 * │ Redis outage into a request that hangs for tens of seconds and then fails — so the caller   │
 * │ times out first, retries, and the API accumulates in-flight requests until it falls over.   │
 * │                                                                                              │
 * │ One retry, then fail fast. `RLM3` requires tier-1 rate-limit classes to FAIL CLOSED when    │
 * │ Redis is unavailable, and failing closed quickly is the only version of that which does not │
 * │ also take the process down.                                                                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
  type Provider,
} from '@nestjs/common';
import { Redis } from 'ioredis';

import { APP_CONFIG, type AppConfig } from '../config/app-config.schema.js';
import { skipEagerConnect } from '../bootstrap/contract-only-mode.js';
import { ReadinessService } from '../health/readiness.service.js';

export const REDIS_CLIENT = Symbol('RedisClient');

/** Built here rather than inline in the provider so a test can construct one directly. */
export function createRedisClient(config: AppConfig): Redis {
  const logger = new Logger('Redis');

  // Contract-only mode: build the client, connect to nothing, and — the part that actually
  // matters here — do not hold the event loop open. `openapi:emit` wrote its document and then
  // hung forever on exit, because an ioredis connection is an active handle and the process
  // cannot end while one is alive. A generator that produces the right file and never returns
  // is a hung CI job, which reads as a broken build rather than a broken shutdown.
  const contractOnly = skipEagerConnect(config.APP_ENV, 'Redis');

  const client = new Redis(config.REDIS_URL, {
    // See the header. Fail fast rather than hanging the request.
    maxRetriesPerRequest: 1,
    // Do not queue commands issued while the connection is down. Queued commands look like they
    // succeeded to the caller until they eventually reject, all at once, on reconnect.
    enableOfflineQueue: false,
    // Connect at construction, so a bad URL fails at boot rather than on the first member's
    // login attempt — except in contract-only mode, where connecting is both pointless and the
    // thing that stops the process exiting.
    lazyConnect: contractOnly,
    connectTimeout: 5_000,
    // Bounded backoff. Unbounded means an instance that lost Redis at 3am is still doubling its
    // retry delay at 9am and takes minutes to notice recovery.
    retryStrategy: (attempt) => Math.min(attempt * 200, 3_000),
  });

  client.on('error', (error: Error) => {
    // WARN, not ERROR: a transient reconnect is routine and paging on it trains people to
    // ignore the channel. The controls that depend on Redis fail closed on their own, and
    // those failures are what alert.
    logger.warn({ message: 'redis error', error: error.message });
  });

  return client;
}

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: createRedisClient,
  inject: [APP_CONFIG],
};

/**
 * Closes the connection on shutdown.
 *
 * ┌─ WITHOUT THIS THE PROCESS NEVER EXITS ──────────────────────────────────────────────────────┐
 * │ An `ioredis` connection is an ACTIVE HANDLE. Node keeps the event loop alive while one is   │
 * │ open, so `app.close()` returns, every test finishes, and the process sits there forever.    │
 * │                                                                                              │
 * │ Caught by `middleware-registration.int-spec.ts` and `tenancy.isolation-spec.ts` — the two   │
 * │ suites that boot a real `AppModule` over HTTP. Both went from ~3s to a 150s timeout the      │
 * │ moment `IamModule` joined the graph, and neither of them has anything to do with Redis.      │
 * │                                                                                              │
 * │ In production the symptom is worse and quieter: `SIGTERM` during a rolling deploy would      │
 * │ never complete, so the orchestrator waits out its grace period and `SIGKILL`s instead —      │
 * │ dropping in-flight requests on every single deployment.                                      │
 * │                                                                                              │
 * │ A separate provider rather than a hook on the factory: a `useFactory` returns a plain        │
 * │ `Redis`, and Nest only calls lifecycle hooks on providers that declare them. This one        │
 * │ injects the client and owns nothing but its shutdown.                                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
@Injectable()
export class RedisConnectionLifecycle implements OnApplicationShutdown, OnModuleInit {
  constructor(
    @Inject(REDIS_CLIENT) private readonly client: Redis,
    private readonly readiness: ReadinessService,
  ) {}

  /**
   * Registers the `/readyz` probe.
   *
   * `ReadinessService` reports `not_ready` while no probe is registered — correctly, because
   * answering "ready" before any infrastructure has wired itself in is a lie that only surfaces
   * under production traffic. So a `register()` nobody calls means the pod never becomes ready
   * and the deployment stalls around a process that is working perfectly.
   *
   * Redis is on this list because `RLM3` makes the tier-1 rate limits FAIL CLOSED: with Redis
   * gone, those endpoints refuse every request. An instance in that state must not be routed to.
   */
  onModuleInit(): void {
    this.readiness.register({
      name: 'redis',
      check: async () => {
        await this.client.ping();
      },
    });
  }

  async onApplicationShutdown(): Promise<void> {
    // `quit()` drains in-flight commands and sends QUIT; `disconnect()` severs immediately and
    // would abandon a rate-limit write mid-flight. If the server is already unreachable `quit()`
    // rejects, and there is nothing useful left to do about it at shutdown.
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
