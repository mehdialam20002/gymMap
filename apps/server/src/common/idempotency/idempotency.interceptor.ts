/**
 * The idempotency interceptor — `BR-PAY-03`, `AC-FND-07.1` … `AC-FND-07.5`, `§14.2.1`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * IN PLACE BEFORE THE FIRST PAYMENT PATH, NOT RETROFITTED
 *
 * `SprintPlanning.md` is explicit: *"Idempotency (BR-PAY-03) must be in place before the first
 * payment path ships, not retrofitted."* There is no payment endpoint yet, which is precisely
 * why this is the right moment — retrofitting it means auditing every mutating route that
 * already exists and getting one of them wrong.
 *
 * The failure it prevents: a checkout POST retried by a flaky mobile connection charges twice.
 * The member sees one confirmation and two debits, and it surfaces days later as a refund
 * request rather than as a bug report.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ FOUR PATHS, AND THE THIRD IS THE ONE PEOPLE GET WRONG ─────────────────────────────────────┐
 * │ no key on a REQ route      400 IDEMPOTENCY_KEY_REQUIRED                                     │
 * │ key + same fingerprint     the STORED response, byte-identically, with no side effects      │
 * │ key + different body       409 IDEMPOTENCY_KEY_MISMATCH                                      │
 * │ key + in flight            WAIT, then replay — never a 409, and never a second execution    │
 * │                                                                                              │
 * │ The last one is what `AC-FND-07.4` requires and what a naive implementation gets wrong:      │
 * │ refusing a concurrent duplicate with a 409 turns a safety mechanism into a rate limiter,     │
 * │ and the client's retry then sees the completed row and succeeds — so the bug is invisible    │
 * │ except as a mysterious 409 in the logs of a request that eventually worked.                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, defer, from, of, switchMap, tap } from 'rxjs';
import type { Request, Response } from 'express';

import { APP_CONFIG, type AppConfig } from '../config/app-config.schema.js';
import { CLOCK, type Clock } from '../clock/clock.port.js';
import { IS_IDEMPOTENT } from '../decorators/idempotent.decorator.js';
import { currentCorrelationId } from '../logging/correlation.als.js';
import { currentTenantContext } from '../../tenancy/context/tenant-context.als.js';
import { isTenantScope } from '../../tenancy/context/tenant-context.vo.js';
import { IdempotencyKeyMismatchError, IdempotencyKeyRequiredError } from './idempotency.errors.js';
import { IdempotencyStore } from './idempotency.store.js';
import { fingerprint } from './request-fingerprint.js';

/** How long to wait for an in-flight duplicate, and how often to look. */
const IN_FLIGHT_POLL_MS = 50;
const IN_FLIGHT_TIMEOUT_MS = 10_000;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly store: IdempotencyStore,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    // AC-FND-13.3. The in-flight WAIT is a time computation, so it goes through the port like
    // every other one — which also makes the timeout testable without a ten-second test.
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const mode = this.reflector.getAllAndOverride<'required' | 'optional' | undefined>(
      IS_IDEMPOTENT,
      [context.getHandler(), context.getClass()],
    );
    if (!mode) return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const endpoint = `${request.method} ${request.route?.path ?? request.path}`;

    const key = readKey(request);
    if (!key) {
      if (mode === 'required') throw new IdempotencyKeyRequiredError(endpoint);
      return next.handle();
    }

    const tenant = currentTenantContext();
    if (!isTenantScope(tenant)) {
      // Every §14.2.1 REQ route is behind authentication and therefore tenant-scoped. Reaching
      // here means a route was marked idempotent and is not — which would store a row with no
      // owner and make it replayable by anybody.
      throw new IdempotencyKeyRequiredError(
        `${endpoint} is marked @Idempotent but has no tenant context`,
      );
    }

    return from(this.resolve({ key, endpoint, tenantId: tenant.tenantId, request })).pipe(
      switchMap((claim) => {
        if (claim.outcome === 'MISMATCH') throw new IdempotencyKeyMismatchError(endpoint);

        if (claim.outcome === 'REPLAY') {
          // Byte-identical, INCLUDING the original correlation id. A support agent tracing a
          // retry has to land on the request that did the work, not on a trail that stops here.
          response.status(claim.response.status);
          response.setHeader('X-Correlation-Id', claim.response.correlationId);
          response.setHeader('Idempotent-Replay', 'true');
          return of(claim.response.body);
        }

        // CLAIMED. This caller owns the execution.
        //
        // `defer(() => next.handle())` and NOT `next.handle().pipe(...)`. A handler that throws
        // SYNCHRONOUSLY — a guard clause, a validation throw in the method body — throws before
        // `.pipe` is reached, so the error escapes the switchMap projection and the `tap`'s error
        // branch never runs. The claim would then sit IN_FLIGHT until it expired, and every retry
        // for the next 24 hours would wait ten seconds and time out. `defer` turns that throw
        // into an error notification on the observable, where the release can see it.
        return defer(() => next.handle()).pipe(
          tap({
            next: (body: unknown) => {
              void this.store
                .complete(key, {
                  status: response.statusCode,
                  body,
                  correlationId: currentCorrelationId(),
                })
                .catch((error: unknown) => {
                  // The work SUCCEEDED and the record failed. Logged loudly rather than thrown:
                  // failing the response now would tell the client the operation did not happen
                  // when it did, and its retry would then execute a SECOND time — turning a
                  // storage blip into exactly the double charge this file exists to prevent.
                  this.logger.error({
                    message: 'IDEMPOTENCY RECORD FAILED — the work completed and is not replayable',
                    key,
                    endpoint,
                    error: error instanceof Error ? error.message : String(error),
                  });
                });
            },
            error: () => {
              // The work FAILED. Release the claim so a retry can execute — otherwise the claim
              // sits IN_FLIGHT for the full retention window and a transient fault becomes a
              // day-long outage for that key.
              //
              // The failure is LOGGED, not swallowed. A silent `.catch(() => undefined)` here
              // hid a real bug for a whole milestone: `release()` set `expiresAt` to a second in
              // the past, the table's CHECK refused it every time, and nothing said so. The
              // request already failed, so this cannot throw — but it must be visible.
              void this.store.release(key).catch((error: unknown) => {
                this.logger.error({
                  message: 'IDEMPOTENCY RELEASE FAILED — this key is wedged until it expires',
                  key,
                  endpoint,
                  error: error instanceof Error ? error.message : String(error),
                });
              });
            },
          }),
        );
      }),
    );
  }

  /** Claims the key, waiting out an in-flight duplicate rather than refusing it. */
  private async resolve(input: {
    key: string;
    endpoint: string;
    tenantId: string;
    request: Request;
  }) {
    const requestHash = fingerprint({
      method: input.request.method,
      path: input.request.route?.path ?? input.request.path,
      tenantId: input.tenantId,
      body: input.request.body,
    });

    const claimInput = {
      key: input.key,
      tenantId: input.tenantId,
      endpoint: input.endpoint,
      requestHash,
      correlationId: currentCorrelationId(),
      retentionSeconds: this.config.IDEMPOTENCY_RETENTION_SECONDS,
    };

    const deadline = this.clock.now().getTime() + IN_FLIGHT_TIMEOUT_MS;
    for (;;) {
      const claim = await this.store.claim(claimInput);
      if (claim.outcome !== 'IN_FLIGHT') return claim;

      if (this.clock.now().getTime() >= deadline) {
        // The holder died mid-flight, or the work is genuinely slower than the timeout. Both
        // resolve the same way: report it and let the client retry. Executing anyway would be a
        // second charge, which is never the safe direction.
        this.logger.warn({ message: 'idempotency wait timed out', key: input.key });
        return claim;
      }
      await new Promise((resolve) => setTimeout(resolve, IN_FLIGHT_POLL_MS));
    }
  }
}

/**
 * Reads the header, case-insensitively, and validates its shape.
 *
 * Bounded and character-restricted: the value is stored, indexed and echoed in an error, so an
 * unbounded client-controlled string is a storage and a log-injection concern at once.
 */
export function readKey(request: { headers: Record<string, unknown> }): string | null {
  const raw = request.headers['idempotency-key'] ?? request.headers['Idempotency-Key'];
  if (typeof raw !== 'string') return null;

  const key = raw.trim();
  // A UUID is 36 characters; 8-200 admits other client conventions without admitting a payload.
  if (!/^[A-Za-z0-9_:.-]{8,200}$/.test(key)) return null;
  return key;
}
