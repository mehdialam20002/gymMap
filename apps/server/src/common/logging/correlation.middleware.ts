/**
 * M-004 · Correlation middleware — NFR-MNT-04, AC-FND-09.1.
 *
 * MIDDLEWARE, not an interceptor. See the block comment in `correlation.als.ts`: Nest runs
 * middleware before guards and pipes, so this is the only position from which a 400 from the
 * validation pipe and a 403 from a guard both carry a correlation id. An interceptor would leave
 * exactly those responses without one.
 */

import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import {
  CORRELATION_HEADER,
  isStorableCorrelationId,
  newCorrelationId,
  runWithCorrelation,
  sanitiseCorrelationId,
} from './correlation.als.js';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    // A client may continue an existing trace, but the value is sanitised first: it lands in
    // every log line, so an unsanitised one is a log-injection vector (a newline plus forged
    // JSON makes the aggregator display a fabricated entry attributed to us).
    const supplied = sanitiseCorrelationId(req.headers[CORRELATION_HEADER]);

    /*
     * ┌─ THE CLIENT DOES NOT GET TO CHOOSE WHAT GOES IN A `uuid` COLUMN ─────────────────────────┐
     * │ `correlationId` is written to `audit_log.correlation_id` and `outbox.correlation_id`,     │
     * │ both `uuid NOT NULL`. The audit write casts it and swallows the failure by design, so a   │
     * │ non-uuid header used to mean "this action leaves no audit row" — attacker-controllable    │
     * │ audit suppression on every audited route, with a header any client can send.              │
     * │                                                                                          │
     * │ A non-uuid trace id is still LEGITIMATE — `traceparent`, a ULID, a caller's own request   │
     * │ id — so it is not rejected. It is kept as `clientTraceId`, logged beside a uuid we mint,  │
     * │ and the two are joinable. The client loses nothing; the audit table stops being optional. │
     * └──────────────────────────────────────────────────────────────────────────────────────────┘
     */
    const usable = supplied !== null && isStorableCorrelationId(supplied);
    const correlationId = usable ? supplied : newCorrelationId();

    /*
     * The response header echoes OUR id, not theirs.
     *
     * It is the one a support engineer greps for and the one that appears in `audit_log`, so
     * returning the client's unstorable value would hand them an id that matches nothing.
     */
    res.setHeader(CORRELATION_HEADER, correlationId);

    /*
     * The join, emitted once per request that supplied an unstorable trace id.
     *
     * Without this line the caller's id would be genuinely lost — every other log site in the
     * server reads `currentCorrelationId()` and nothing else, so there is no central place that
     * stamps both. `debug`, not `warn`: a client sending a `traceparent` or a ULID is behaving
     * correctly, and warning on correct behaviour trains people to ignore warnings.
     */
    if (supplied !== null && !usable) {
      this.logger.debug({
        message: 'Client trace id is not a uuid; correlating under a minted id instead.',
        correlationId,
        clientTraceId: supplied,
      });
    }

    runWithCorrelation(
      {
        correlationId,
        origin: 'http',
        ...(supplied !== null && !usable ? { clientTraceId: supplied } : {}),
      },
      () => next(),
    );
  }
}
