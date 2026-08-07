/**
 * The idempotency store — `AC-FND-07.2`, `AC-FND-07.4`, `BR-PAY-03`, `TR-36`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE UNIQUE CONSTRAINT IS THE CONCURRENCY CONTROL. THERE IS NO LOCK.
 *
 * Twenty simultaneous requests carrying the same key all attempt one `INSERT`. PostgreSQL lets
 * exactly ONE succeed and raises SQLSTATE 23505 on the other nineteen — atomically, at the
 * storage engine, with no coordination on our side.
 *
 * Every alternative is worse. A `SELECT` then `INSERT` has a race between the two statements. A
 * Redis lock adds a second system that can be unavailable while Postgres is fine, and a lock
 * whose holder dies leaves the key wedged until a TTL nobody tuned. An advisory lock holds a
 * connection for the duration of the work, which is the pool-exhaustion pattern `ADR-0005`
 * already fights elsewhere.
 *
 * The nineteen losers then WAIT and return the stored response — they do not fail. `AC-FND-07.4`
 * requires that, and it is the difference between a safety mechanism and a rate limiter.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { CLOCK, type Clock } from '../clock/clock.port.js';
import { PrismaService } from '../../tenancy/prisma/prisma.service.js';

/** What a completed record replays. */
export interface StoredResponse {
  readonly status: number;
  readonly body: unknown;
  /** The ORIGINAL request's correlation id, so a retry traces to the work rather than to itself. */
  readonly correlationId: string;
}

export type ClaimResult =
  /** This caller owns the execution. Nobody else will run it. */
  | { readonly outcome: 'CLAIMED' }
  /** Someone else ran it and finished. Replay this. */
  | { readonly outcome: 'REPLAY'; readonly response: StoredResponse }
  /** The key exists with a DIFFERENT fingerprint. 409. */
  | { readonly outcome: 'MISMATCH' }
  /** Someone else is running it right now and has not finished. */
  | { readonly outcome: 'IN_FLIGHT' };

/** SQLSTATE 23505. Not a failure here — it is the mechanism working. */
function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string })?.code === 'P2002';
}

@Injectable()
export class IdempotencyStore {
  private readonly logger = new Logger(IdempotencyStore.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Attempts to claim the key for execution.
   *
   * Inserts FIRST and reads only on collision. The reverse — read, then insert if absent — has a
   * window between the two statements in which a second request also reads "absent", and both
   * execute. That window is small, which is what makes it survive testing and appear in
   * production under load on a payment path.
   */
  async claim(input: {
    key: string;
    tenantId: string;
    endpoint: string;
    requestHash: string;
    correlationId: string;
    retentionSeconds: number;
  }): Promise<ClaimResult> {
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + input.retentionSeconds * 1000);

    try {
      await this.prisma.client.idempotencyKey.create({
        data: {
          key: input.key,
          tenantId: input.tenantId,
          endpoint: input.endpoint,
          requestHash: input.requestHash,
          correlationId: input.correlationId,
          expiresAt,
        },
      });
      return { outcome: 'CLAIMED' };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }

    // Lost the race, or this is a genuine retry. Either way the row exists — read it and decide.
    return this.inspectExisting(input, now);
  }

  private async inspectExisting(
    input: { key: string; endpoint: string; requestHash: string },
    now: Date,
  ): Promise<ClaimResult> {
    const existing = await this.prisma.client.idempotencyKey.findFirst({
      where: { key: input.key },
    });

    if (!existing) {
      // The row was inserted and then swept between our INSERT failing and this SELECT. Vanishly
      // rare and worth naming: treating it as CLAIMED would be a second execution, so it is
      // reported as IN_FLIGHT and the caller retries — the safe direction.
      this.logger.warn({
        message: 'idempotency row vanished between insert and read',
        key: input.key,
      });
      return { outcome: 'IN_FLIGHT' };
    }

    // Expiry is enforced on READ as well as by the sweep. The sweep runs on a schedule and can
    // be behind; a row past its window must not replay a response from outside the retention
    // period the client was promised.
    if (existing.expiresAt <= now) {
      return { outcome: 'IN_FLIGHT' };
    }

    // The endpoint is compared as well as the hash. The same key at a DIFFERENT endpoint is a
    // client bug, and returning the first endpoint's response for it would be worse than
    // refusing — the caller would receive a well-formed response to a question it did not ask.
    if (existing.requestHash !== input.requestHash || existing.endpoint !== input.endpoint) {
      return { outcome: 'MISMATCH' };
    }

    if (existing.responseStatus === null) return { outcome: 'IN_FLIGHT' };

    return {
      outcome: 'REPLAY',
      response: {
        status: existing.responseStatus,
        body: existing.responseBody,
        correlationId: existing.correlationId,
      },
    };
  }

  /** Records the outcome. Called once, after the work, by whoever claimed the key. */
  async complete(key: string, response: StoredResponse): Promise<void> {
    await this.prisma.client.idempotencyKey.updateMany({
      where: { key },
      data: {
        responseStatus: response.status,
        responseBody: response.body as never,
        completedAt: this.clock.now(),
      },
    });
  }

  /**
   * Releases a claim whose work FAILED.
   *
   * ┌─ A FAILED REQUEST MUST NOT BE REPLAYED AS A FAILURE FOREVER ────────────────────────────┐
   * │ If the work throws — a provider timeout, a database blip — the row is deleted rather     │
   * │ than completed with the error. Otherwise the client's retry replays the stored 500 for   │
   * │ the whole retention window, and a transient fault becomes a permanent one that no retry  │
   * │ can clear.                                                                                │
   * │                                                                                          │
   * │ The request path has no DELETE grant (see the migration), so this UPDATES the row to     │
   * │ expire immediately instead. Same effect for the reader — `expiresAt <= now` is checked   │
   * │ on every read — without a grant that would let a retry erase the record that makes it a  │
   * │ replay.                                                                                   │
   * └──────────────────────────────────────────────────────────────────────────────────────────┘
   */
  async release(key: string): Promise<void> {
    await this.prisma.client.idempotencyKey.updateMany({
      where: { key, responseStatus: null },
      data: { expiresAt: new Date(this.clock.now().getTime() - 1000) },
    });
  }

  /** Reads a record without claiming. For the specs and for the sweep's accounting. */
  async find(key: string) {
    return this.prisma.client.idempotencyKey.findFirst({ where: { key } });
  }
}
