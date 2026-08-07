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

import { Logger, type Provider } from '@nestjs/common';
import { Redis } from 'ioredis';

import { APP_CONFIG, type AppConfig } from '../config/app-config.schema.js';

export const REDIS_CLIENT = Symbol('RedisClient');

/** Built here rather than inline in the provider so a test can construct one directly. */
export function createRedisClient(config: AppConfig): Redis {
  const logger = new Logger('Redis');

  const client = new Redis(config.REDIS_URL, {
    // See the header. Fail fast rather than hanging the request.
    maxRetriesPerRequest: 1,
    // Do not queue commands issued while the connection is down. Queued commands look like they
    // succeeded to the caller until they eventually reject, all at once, on reconnect.
    enableOfflineQueue: false,
    // `lazyConnect: false` — connect at construction, so a bad URL fails at boot rather than on
    // the first member's login attempt.
    lazyConnect: false,
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
