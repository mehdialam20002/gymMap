/**
 * `BR-DAT-01` · A request header could switch off its own audit trail — `NFR-MNT-04`, `AC-FND-09.1`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE DEFECT, AS A CHAIN OF FOUR REASONABLE DECISIONS
 *
 *   1. `sanitiseCorrelationId` accepts `^[A-Za-z0-9_-]{8,64}$` from the client, because a caller
 *      continuing their own trace may legitimately send a `traceparent`, a ULID or their own
 *      request id — none of which is a uuid. Correct, as a log-injection guard.
 *   2. `CorrelationMiddleware` put that value straight into `CorrelationContext.correlationId`.
 *   3. `audit_log.correlation_id` is `uuid NOT NULL`, and `AuditPrismaRepository.append()` writes
 *      it as `${entry.correlationId}::uuid`.
 *   4. That INSERT is inside a `try` whose `catch` only logs — the audit write is deliberately
 *      non-fatal, so an audit-table outage cannot take the platform down with it.
 *
 * Composed: `X-Correlation-Id: abcdefgh` → passes (1) → reaches (3) → PostgreSQL rejects the cast
 * → (4) swallows it → **the action proceeds with no audit row**. Attacker-controllable audit
 * suppression, on every audited action, from one header, with nothing failing anywhere.
 *
 * Each of the four decisions is defensible alone, which is why this survived review. The tests
 * below pin the composition rather than any one of them.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CORRELATION_HEADER,
  isStorableCorrelationId,
  newCorrelationId,
  sanitiseCorrelationId,
} from '../dist/common/logging/correlation.als.js';
import { CorrelationMiddleware } from '../dist/common/logging/correlation.middleware.js';
import { currentCorrelation } from '../dist/common/logging/correlation.als.js';
import { AuditPrismaRepository } from '../dist/audit/infrastructure/audit.prisma-repository.js';

/** The value an attacker sends. Eight safe characters, and not a uuid. */
const SUPPRESSOR = 'abcdefgh';

interface Captured {
  readonly correlationId: string;
  readonly clientTraceId?: string;
  readonly responseHeader: string;
}

/** Drive the middleware the way Express does, and capture what the handler would see. */
function throughMiddleware(header?: string): Captured {
  const middleware = new CorrelationMiddleware();
  const req = { headers: header === undefined ? {} : { [CORRELATION_HEADER]: header } };
  let responseHeader = '';
  const res = {
    setHeader(name: string, value: string) {
      if (name === CORRELATION_HEADER) responseHeader = value;
    },
  };

  let captured: { correlationId: string; clientTraceId?: string } | undefined;
  middleware.use(req as never, res as never, () => {
    const context = currentCorrelation();
    assert.ok(context, 'the middleware did not open a correlation context');
    captured = { correlationId: context.correlationId, clientTraceId: context.clientTraceId };
  });

  assert.ok(captured, 'next() was never called');
  return { ...captured, responseHeader };
}

// ═══════════════════════════════════════════════════════════════════════════
// The two halves of the old bug, pinned separately
// ═══════════════════════════════════════════════════════════════════════════

test('the sanitiser still accepts a non-uuid, because a trace id legitimately is not one', () => {
  // This is NOT the bug and must not be "fixed". `traceparent` ids, ULIDs and a caller's own
  // request ids are all valid things to continue a trace with. Narrowing this to uuids would
  // reject every well-behaved distributed-tracing client on the way past.
  assert.equal(sanitiseCorrelationId(SUPPRESSOR), SUPPRESSOR);
  assert.equal(sanitiseCorrelationId('01ARZ3NDEKTSV4RRFFQ69G5FAV'), '01ARZ3NDEKTSV4RRFFQ69G5FAV');

  // …while still refusing what it exists to refuse.
  assert.equal(sanitiseCorrelationId('short'), null, 'too short');
  assert.equal(sanitiseCorrelationId('x'.repeat(65)), null, 'too long');
  assert.equal(sanitiseCorrelationId('ok\nforged: true'), null, 'log injection');
  assert.equal(sanitiseCorrelationId(42), null, 'not a string');
});

test('isStorableCorrelationId answers the DIFFERENT question — can a uuid column hold it', () => {
  assert.equal(isStorableCorrelationId(SUPPRESSOR), false);
  assert.equal(isStorableCorrelationId('01ARZ3NDEKTSV4RRFFQ69G5FAV'), false);
  assert.equal(isStorableCorrelationId(newCorrelationId()), true);
  assert.equal(isStorableCorrelationId('0192DE00-6028-7000-8000-0000000000C1'), true, 'upper case');

  // Stricter than PostgreSQL on purpose: PG also accepts braced and unhyphenated forms, and the
  // guarantee has to run in the direction of "true means it will cast", never the reverse.
  assert.equal(isStorableCorrelationId('{0192de00-6028-7000-8000-0000000000c1}'), false);
  assert.equal(isStorableCorrelationId('0192de0060287000800000000000 00c1'), false);
});

// ═══════════════════════════════════════════════════════════════════════════
// The composition — this is the regression
// ═══════════════════════════════════════════════════════════════════════════

test('a non-uuid header CANNOT reach correlationId, so it cannot suppress an audit row', () => {
  const captured = throughMiddleware(SUPPRESSOR);

  assert.equal(
    isStorableCorrelationId(captured.correlationId),
    true,
    'a client header reached correlationId in a shape audit_log cannot store — the audit row ' +
      'for this request would be silently dropped by the repository catch',
  );
  assert.notEqual(captured.correlationId, SUPPRESSOR);
});

test('the client trace id is KEPT, so nothing is lost by refusing it as the correlation id', () => {
  // Dropping it would be the lazy fix and would cost the caller their trace. Both ids are in the
  // log line, so their id and ours can still be joined by hand.
  const captured = throughMiddleware(SUPPRESSOR);
  assert.equal(captured.clientTraceId, SUPPRESSOR);
});

test('a uuid header IS honoured, so a well-behaved client keeps its own trace', () => {
  // The positive control. A fix that minted a fresh id unconditionally would pass every assertion
  // above and quietly break distributed tracing for every correct caller.
  const supplied = newCorrelationId();
  const captured = throughMiddleware(supplied);

  assert.equal(captured.correlationId, supplied);
  assert.equal(
    captured.clientTraceId,
    undefined,
    'no client trace id is recorded when it was used',
  );
});

test('no header at all mints a uuid', () => {
  const captured = throughMiddleware();
  assert.equal(isStorableCorrelationId(captured.correlationId), true);
  assert.equal(captured.clientTraceId, undefined);
});

test('a log-injection attempt is refused outright and does not become a clientTraceId either', () => {
  // The sanitiser rejects it, so there is nothing to keep. Recording it as `clientTraceId` would
  // reintroduce the injection vector by the back door — it lands in the same log line.
  const captured = throughMiddleware('ok\nforged: true');
  assert.equal(isStorableCorrelationId(captured.correlationId), true);
  assert.equal(captured.clientTraceId, undefined);
});

test('the response header echoes OUR id, not the unstorable one the client sent', () => {
  // The id in the response is the one a support engineer greps for and the one in `audit_log`.
  // Returning the client's value would hand them an id that matches nothing anywhere.
  const captured = throughMiddleware(SUPPRESSOR);
  assert.equal(captured.responseHeader, captured.correlationId);
  assert.notEqual(captured.responseHeader, SUPPRESSOR);
});

// ═══════════════════════════════════════════════════════════════════════════
// The belt, at the writer — the middleware is only the HTTP door
// ═══════════════════════════════════════════════════════════════════════════

/** Captures the value the repository actually interpolates, without a database. */
function repositoryCapturing(): { repo: AuditPrismaRepository; written: unknown[] } {
  const written: unknown[] = [];
  const db = {
    executeRaw: (_strings: TemplateStringsArray, ...values: unknown[]) => {
      // Position 16 in the INSERT's value list: …, userAgent, correlationId, requestId.
      written.push(values[16]);
      return Promise.resolve();
    },
  };
  return { repo: new AuditPrismaRepository(db as never), written };
}

const entry = (correlationId: string) => ({
  tenantId: null,
  actorId: '0192de00-3000-7000-8000-00000000b001',
  actorType: 'USER' as const,
  entityType: 'KYC_DOCUMENT' as const,
  entityId: '0192de00-3000-7000-8000-00000000c001',
  action: 'EXPORT' as const,
  correlationId,
});

test('the writer replaces an unstorable correlation id rather than losing the whole row', async () => {
  // ┌─ WHY A SECOND GUARD, WHEN THE MIDDLEWARE ALREADY CLOSED THE DOOR ──────────────────────────┐
  // │ The middleware closes the HTTP door only. A job, a test harness or a future caller          │
  // │ constructing a context by hand reaches this repository directly, and here the cast lives    │
  // │ inside a `catch` that only logs — so an unstorable id does not FAIL the write, it DELETES   │
  // │ it. Losing the entire record over the one field that says nothing about who did what is     │
  // │ the worst trade available.                                                                   │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const { repo, written } = repositoryCapturing();
  await repo.append(entry(SUPPRESSOR) as never);

  assert.equal(written.length, 1, 'no INSERT was attempted');
  assert.equal(
    isStorableCorrelationId(written[0] as string),
    true,
    'the repository passed a non-uuid to a uuid column — the row would be silently dropped',
  );
  assert.notEqual(written[0], SUPPRESSOR);
});

// ═══════════════════════════════════════════════════════════════════════════
// The same defect on the other client-influenced field, found by reviewing the
// fix above rather than by reviewing the original code
// ═══════════════════════════════════════════════════════════════════════════

/** Captures the `ip` at position 14 of the INSERT's value list. */
function repositoryCapturingIp(): { repo: AuditPrismaRepository; written: unknown[] } {
  const written: unknown[] = [];
  const db = {
    executeRaw: (_strings: TemplateStringsArray, ...values: unknown[]) => {
      written.push(values[14]);
      return Promise.resolve();
    },
  };
  return { repo: new AuditPrismaRepository(db as never), written };
}

const withIp = (ip: string | null) => ({ ...entry(newCorrelationId()), ip });

test('an unparseable ip is recorded as NULL rather than taking the whole row with it', async () => {
  // `SELECT 'not-an-ip'::inet` raises, and that cast is inside the same swallowing `try`. So the
  // failure mode is identical to the correlation one: the row does not fail, it disappears.
  const { repo, written } = repositoryCapturingIp();
  await repo.append(withIp('not-an-ip') as never);

  assert.equal(written.length, 1, 'no INSERT was attempted');
  assert.equal(written[0], null, 'an unparseable address reached a `inet` column');
});

test('NULL rather than a placeholder address, because a fabricated fact is worse than none', async () => {
  // `0.0.0.0` would be a recorded claim that is false, in a table whose entire worth is that its
  // contents happened. NULL says "not known", which is true.
  const { repo, written } = repositoryCapturingIp();
  await repo.append(withIp('10.0.0.999') as never);
  assert.equal(written[0], null);
});

test('real addresses pass through untouched — v4, v6 and CIDR', async () => {
  // The positive control. A guard that nulled everything would satisfy the two tests above while
  // erasing the field from every audit row in the platform.
  for (const address of ['203.0.113.7', '::1', '2001:db8::8a2e:370:7334', '203.0.113.0/24']) {
    const { repo, written } = repositoryCapturingIp();
    await repo.append(withIp(address) as never);
    assert.equal(written[0], address, `${address} was rejected`);
  }
});

test('an absent ip stays absent', async () => {
  const { repo, written } = repositoryCapturingIp();
  await repo.append(withIp(null) as never);
  assert.equal(written[0], null);
});

test('a storable correlation id passes through the writer untouched', async () => {
  // The positive control again. A writer that minted a fresh id unconditionally would satisfy the
  // test above while making every audit row unjoinable to the request that caused it.
  const good = newCorrelationId();
  const { repo, written } = repositoryCapturing();
  await repo.append(entry(good) as never);

  assert.equal(written[0], good);
});
