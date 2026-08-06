/**
 * M-004 · Liveness and readiness — AC-FND-14.x, `API_Catalog.md` §1.2, NFR-AVL-03.
 *
 * Two endpoints with genuinely different jobs, and conflating them is a real outage mode:
 *
 *   /healthz  LIVENESS.  "Is this process alive?" Answers 200 as long as the event loop turns.
 *             It must NOT check the database — if it did, a brief Postgres blip would make the
 *             orchestrator kill and reschedule every replica at once, converting a recoverable
 *             dependency wobble into a full outage.
 *
 *   /readyz   READINESS. "Should this process receive traffic?" Checks Postgres and Redis with a
 *             REAL round trip. On failure the pod is removed from the load balancer but left
 *             running, so it rejoins by itself when the dependency returns.
 *
 * Neither body carries internal detail — no dependency versions, no tenant counts, no database
 * host. `/healthz` is typically unauthenticated and reachable from anywhere the pod is, which
 * makes it a free reconnaissance endpoint if it echoes the stack.
 */

import { Controller, Get, HttpCode, HttpStatus, Res, VERSION_NEUTRAL } from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../decorators/public.decorator.js';
import { RateLimit } from '../decorators/rate-limit.decorator.js';
import { ReadinessService, type ReadinessReport } from './readiness.service.js';

/**
 * M-008 AC-5 · The probes are UNVERSIONED, and that is load-bearing.
 *
 * `main.ts` enables URI versioning with `defaultVersion: '1'`, which would otherwise move these
 * to `/v1/healthz`. A load balancer cannot be asked to negotiate an API version — and a probe
 * that starts returning 404 after a version bump takes the entire deployment out of rotation
 * while every instance behind it is perfectly healthy.
 */
@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly readiness: ReadinessService) {}

  /**
   * Liveness. Deliberately trivial and dependency-free.
   *
   * The body is a constant. A timestamp would be harmless but invites a client to depend on
   * clock skew, and a version string tells an attacker which CVEs to try.
   */
  @Public()
  @RateLimit('RL-READ')
  @Get('healthz')
  @HttpCode(HttpStatus.OK)
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /**
   * Readiness. 503 until every dependency answers, 200 thereafter.
   *
   * The per-dependency booleans are the one detail worth exposing: an operator staring at a
   * 503 needs to know whether it is Postgres or Redis, and neither name is a secret. No error
   * text, no host, no port — those are in the log against the correlation id.
   */
  @Public()
  @RateLimit('RL-READ')
  @Get('readyz')
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadinessReport> {
    const report = await this.readiness.check();
    res.status(report.status === 'ready' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return report;
  }
}
