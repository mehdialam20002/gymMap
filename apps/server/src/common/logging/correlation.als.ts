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
  /**
   * Unique per inbound request or per job execution. Returned in `X-Correlation-Id`.
   *
   * **Always a uuid.** `audit_log.correlation_id` and `outbox.correlation_id` are both
   * `uuid NOT NULL`, so anything else is a value those tables cannot store — see
   * `clientTraceId` for what happens to a client id that is not one.
   */
  readonly correlationId: string;
  /**
   * The client's own trace id, when they supplied one that is NOT a uuid.
   *
   * Logged beside `correlationId` so their trace and ours can still be joined by hand, and
   * deliberately kept OUT of `correlationId` itself — see the block comment on
   * `sanitiseCorrelationId`.
   */
  readonly clientTraceId?: string;
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
 *
 * ┌─ SANITISED IS NOT THE SAME AS STORABLE, AND CONFLATING THEM SUPPRESSED AUDIT ROWS ───────────┐
 * │ This regex is a LOG-INJECTION guard and it is the right one: `traceparent`-style ids, ULIDs   │
 * │ and a caller's own request ids are all legitimate trace values and none of them is a uuid.    │
 * │                                                                                              │
 * │ But `audit_log.correlation_id` and `outbox.correlation_id` are `uuid NOT NULL`, and           │
 * │ `AuditPrismaRepository.append()` casts with `${entry.correlationId}::uuid` inside a `try`     │
 * │ whose `catch` only logs — the audit write is deliberately non-fatal so a failing audit table  │
 * │ cannot take the platform down.                                                                │
 * │                                                                                              │
 * │ Composed, those two reasonable decisions were a hole: a client sending                        │
 * │ `X-Correlation-Id: abcdefgh` passed this regex, reached the cast, failed it, and had the      │
 * │ failure swallowed — so the action proceeded with NO AUDIT ROW. Any caller could switch off    │
 * │ their own audit trail with one header, on every audited action in the platform, and the only  │
 * │ trace was a log line nobody alerts on.                                                        │
 * │                                                                                              │
 * │ So the two jobs are separated: this function still answers "is this safe to log", and         │
 * │ `isStorableCorrelationId` answers "can a `uuid` column hold it". The middleware demands the   │
 * │ second for `correlationId` and keeps the first as `clientTraceId`.                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const SAFE_CORRELATION_ID = /^[A-Za-z0-9_-]{8,64}$/;

export function sanitiseCorrelationId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  return SAFE_CORRELATION_ID.test(raw) ? raw : null;
}

/**
 * Canonical RFC 4122 text form — the only thing a `uuid` column accepts.
 *
 * Deliberately stricter than PostgreSQL, which also takes braced and unhyphenated forms. A value
 * this returns `false` for might still cast; a value it returns `true` for always casts, and that
 * is the direction the guarantee has to run.
 */
const UUID_TEXT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isStorableCorrelationId(value: string): boolean {
  return UUID_TEXT.test(value);
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
