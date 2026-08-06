/**
 * M-004 · The correlation-id carrier — NFR-MNT-04, NFR-OBS-02, AC-FND-09.1.
 *
 * One id follows a request from the HTTP edge, through the service layer, into a BullMQ job, and
 * onto every log line either produces. Without it, diagnosing "the member says checkout failed at
 * about 4pm" means grepping by timestamp across four processes.
 *
 * ┌─ THE TRAP, named in the M-004 notes ────────────────────────────────────────────────────┐
 * │ `AsyncLocalStorage` must be entered in HTTP MIDDLEWARE, not in a Nest interceptor.      │
 * │                                                                                          │
 * │ Nest's pipeline is:  middleware → guards → interceptors → pipes → handler                │
 * │                                                                                          │
 * │ A ValidationPipe rejection and a guard rejection both happen BEFORE any interceptor      │
 * │ runs. So an interceptor-based store leaves every 400 and every 403 with no correlation   │
 * │ id — which are precisely the errors support is asked about most. Entering the store in   │
 * │ middleware covers the whole pipeline including the failures.                             │
 * └──────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/** Everything that must travel with a unit of work, across process boundaries. */
export interface CorrelationContext {
  /** Unique per inbound request or per job execution. Returned in `X-Correlation-Id`. */
  readonly correlationId: string;
  /**
   * Set once authentication resolves. NOT logged as a value that identifies a person —
   * it is an opaque id, and `redaction.ts` keeps names, emails and phones out separately.
   */
  actorId?: string;
  /** The tenant whose data this unit of work touches. Set by the tenancy module (M-009). */
  tenantId?: string;
  /** `http` at the edge, `job:<name>` inside a worker. Distinguishes the two in one log stream. */
  readonly origin: string;
}

const storage = new AsyncLocalStorage<CorrelationContext>();

/** The header a client may supply to continue an existing trace, and that we always return. */
export const CORRELATION_HEADER = 'x-correlation-id';

/**
 * A client-supplied correlation id is accepted but SANITISED.
 *
 * It lands in every log line, so an unsanitised value is a log-injection vector: a newline plus a
 * forged JSON object makes the aggregator show a fabricated log entry attributed to us. Length is
 * capped for the same reason a request body is.
 */
const SAFE_CORRELATION_ID = /^[A-Za-z0-9_-]{8,64}$/;

export function sanitiseCorrelationId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  return SAFE_CORRELATION_ID.test(raw) ? raw : null;
}

export function newCorrelationId(): string {
  return randomUUID();
}

/** Runs `fn` with a fresh context. Everything awaited inside sees the same store. */
export function runWithCorrelation<T>(context: CorrelationContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** The active context, or `undefined` outside any unit of work (e.g. during boot). */
export function currentCorrelation(): CorrelationContext | undefined {
  return storage.getStore();
}

/**
 * The active correlation id, or a marker.
 *
 * Never throws and never returns an empty string. A logger that throws while building a log line
 * turns an ordinary error into an unhandled rejection, and a blank id is indistinguishable from a
 * missing field when someone is searching the aggregator at 2am.
 */
export function currentCorrelationId(): string {
  return storage.getStore()?.correlationId ?? 'no-correlation-context';
}

/**
 * Attaches the actor to the active context.
 *
 * Mutates in place rather than re-entering the store: authentication resolves inside a guard,
 * which is downstream of the middleware that opened the store, and re-entering there would create
 * a second context that the already-running middleware never sees.
 */
export function setCorrelationActor(actorId: string): void {
  const store = storage.getStore();
  if (store) store.actorId = actorId;
}

export function setCorrelationTenant(tenantId: string): void {
  const store = storage.getStore();
  if (store) store.tenantId = tenantId;
}
