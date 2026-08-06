/**
 * M-004 · The readiness probe — AC-FND-14.x, NFR-AVL-03.
 *
 * AC-2 of the milestone is explicit that this must be a REAL round trip, not a cached boolean.
 * A cached flag is worse than no probe: it reports ready while the database is gone, so traffic
 * keeps arriving at a replica that cannot serve it, and the load balancer never routes away.
 *
 * The concrete Postgres and Redis probes arrive with their clients in M-005/M-006. Until then a
 * dependency registers itself here, and the probe list being EMPTY is itself reported — a
 * readiness endpoint that returns "ready" because it checks nothing is the failure this class is
 * designed to make impossible.
 */

import { Injectable, Logger } from '@nestjs/common';

import { currentCorrelationId } from '../logging/correlation.als.js';

export interface DependencyProbe {
  /** Short, non-secret name: `postgres`, `redis`. Appears in the response body. */
  readonly name: string;
  /** A real round trip — `SELECT 1`, `PING`. Must reject or throw on failure. */
  check(): Promise<void>;
}

export interface ReadinessReport {
  status: 'ready' | 'not_ready';
  /** Per-dependency booleans. Names only — never an error string, host or port. */
  dependencies: Record<string, boolean>;
}

/** A dependency that does not answer within this window is treated as down. */
const PROBE_TIMEOUT_MS = 2_000;

@Injectable()
export class ReadinessService {
  private readonly logger = new Logger(ReadinessService.name);
  private readonly probes = new Map<string, DependencyProbe>();

  /** Called by each infrastructure module as it initialises. */
  register(probe: DependencyProbe): void {
    this.probes.set(probe.name, probe);
  }

  async check(): Promise<ReadinessReport> {
    // No probes registered means no infrastructure module has wired itself in yet. Reporting
    // "ready" here would be a lie that only surfaces under production traffic.
    if (this.probes.size === 0) {
      return { status: 'not_ready', dependencies: {} };
    }

    const entries = await Promise.all(
      [...this.probes.values()].map(async (probe) => {
        try {
          await this.withTimeout(probe.check(), probe.name);
          return [probe.name, true] as const;
        } catch (error) {
          // The reason goes to the log, never to the response body: a connection error message
          // contains the host, the port and sometimes the credential.
          this.logger.warn(
            `Readiness probe "${probe.name}" failed. correlation_id=${currentCorrelationId()} ` +
              `reason=${error instanceof Error ? error.name : 'unknown'}`,
          );
          return [probe.name, false] as const;
        }
      }),
    );

    const dependencies = Object.fromEntries(entries);
    const allUp = entries.every(([, up]) => up);
    return { status: allUp ? 'ready' : 'not_ready', dependencies };
  }

  /**
   * Bounds every probe.
   *
   * A TCP connection to a vanished host does not fail fast — it hangs until the OS gives up,
   * which can be minutes. Without this, `/readyz` itself stops responding and the orchestrator
   * cannot tell "not ready" from "hung", which are handled very differently.
   */
  private withTimeout(promise: Promise<void>, name: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Readiness probe "${name}" exceeded ${PROBE_TIMEOUT_MS}ms`)),
        PROBE_TIMEOUT_MS,
      );
      promise.then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      );
    });
  }
}
