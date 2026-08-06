/**
 * M-004 · Correlation middleware — NFR-MNT-04, AC-FND-09.1.
 *
 * MIDDLEWARE, not an interceptor. See the block comment in `correlation.als.ts`: Nest runs
 * middleware before guards and pipes, so this is the only position from which a 400 from the
 * validation pipe and a 403 from a guard both carry a correlation id. An interceptor would leave
 * exactly those responses without one.
 */

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import {
  CORRELATION_HEADER,
  newCorrelationId,
  runWithCorrelation,
  sanitiseCorrelationId,
} from './correlation.als.js';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // A client may continue an existing trace, but the value is sanitised first: it lands in
    // every log line, so an unsanitised one is a log-injection vector (a newline plus forged
    // JSON makes the aggregator display a fabricated entry attributed to us).
    const correlationId =
      sanitiseCorrelationId(req.headers[CORRELATION_HEADER]) ?? newCorrelationId();

    // Set on the response BEFORE next(), so the header survives even if the handler throws.
    res.setHeader(CORRELATION_HEADER, correlationId);

    runWithCorrelation({ correlationId, origin: 'http' }, () => next());
  }
}
