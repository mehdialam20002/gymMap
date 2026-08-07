/**
 * M-004 AC-4, AC-5 · §C3.1, AC-FND-09.1/09.3/09.6, SEC-A03-005.
 *
 * The headline assertion is AC-FND-09.6: an unrecognised throwable must not echo its message. A
 * Prisma error contains the SQL and often a parameter value; an fs error an absolute path; an
 * HTTP client error the upstream URL with its query string.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ZodError, z } from 'zod';

import {
  CLIENT_SAFE_MESSAGE,
  DomainExceptionFilter,
} from '../dist/common/errors/domain-exception.filter.js';
import { ERROR_REGISTRY } from '@gymmap/types';
import {
  BusinessRuleException,
  ConflictException,
  DomainException,
  NotFoundException,
  PermissionDeniedException,
  TenantContextMissingException,
  ValidationException,
} from '../dist/common/errors/domain-exception.js';
import { runWithCorrelation } from '../dist/common/logging/correlation.als.js';

interface Captured {
  status: number;
  body: { error: { code: string; message: string; details: unknown[]; correlation_id: string } };
  headers: Record<string, string>;
}

/** Minimal ArgumentsHost double — enough for the filter, nothing more. */
function capture(exception: unknown, correlationId = 'test-correlation-id'): Captured {
  const captured: Captured = {
    status: 0,
    body: { error: { code: '', message: '', details: [], correlation_id: '' } },
    headers: {},
  };

  const response = {
    setHeader(name: string, value: string) {
      captured.headers[name.toLowerCase()] = value;
    },
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: Captured['body']) {
      captured.body = body;
      return this;
    },
  };

  const request = { method: 'POST', route: { path: '/v1/orders' } };
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  };

  const filter = new DomainExceptionFilter();
  runWithCorrelation({ correlationId, origin: 'http' }, () => {
    filter.catch(exception, host as never);
  });
  return captured;
}

// ---------------------------------------------------------------------------
// AC-FND-09.1 — the envelope shape.
// ---------------------------------------------------------------------------

test('every response is exactly { error: { code, message, details[], correlation_id } }', () => {
  const out = capture(new NotFoundException('gym 123 not found'));
  assert.deepEqual(Object.keys(out.body), ['error']);
  assert.deepEqual(Object.keys(out.body.error).sort(), [
    'code',
    'correlation_id',
    'details',
    'message',
  ]);
  assert.ok(Array.isArray(out.body.error.details));
});

test('the correlation id is in the body AND the response header', () => {
  const out = capture(new NotFoundException('x'), 'abc-123');
  assert.equal(out.body.error.correlation_id, 'abc-123');
  assert.equal(out.headers['x-correlation-id'], 'abc-123');
});

// ---------------------------------------------------------------------------
// AC-FND-09.3 / AC-5 — the five §C3.1 status mappings.
// ---------------------------------------------------------------------------

test('AC-5 — validation 400', () => {
  const out = capture(new ValidationException('bad payload'));
  assert.equal(out.status, 400);
  assert.equal(out.body.error.code, 'VALIDATION_FAILED');
});

test('AC-5 — business rule 422', () => {
  const out = capture(new BusinessRuleException('CURRENCY_MISMATCH', 'INR vs USD'));
  assert.equal(out.status, 422);
  assert.equal(out.body.error.code, 'CURRENCY_MISMATCH');
});

test('AC-5 — idempotency conflict 409', () => {
  const out = capture(new ConflictException('IDEMPOTENCY_KEY_MISMATCH', 'key reused'));
  assert.equal(out.status, 409);
  assert.equal(out.body.error.code, 'IDEMPOTENCY_KEY_MISMATCH');
});

test('AC-5 — authorisation 403', () => {
  const out = capture(new PermissionDeniedException('no staff seat'));
  assert.equal(out.status, 403);
  assert.equal(out.body.error.code, 'PERMISSION_DENIED');
});

test('the status comes from the registry, not from the throw site', () => {
  // Nothing in the throw specifies 503 — the registry row does.
  const out = capture(new DomainException('DEPENDENCY_UNAVAILABLE', 'redis down'));
  assert.equal(out.status, 503);
});

// ---------------------------------------------------------------------------
// AC-FND-09.6 / SEC-A03-005 — the no-echo rule. The one that matters most.
// ---------------------------------------------------------------------------

test('AC-FND-09.6 — a raw Error is 500 INTERNAL_ERROR and its message is NOT echoed', () => {
  const leaky = new Error(
    'Invalid `prisma.user.findMany()` invocation: connect ECONNREFUSED 10.0.3.14:5432, ' +
      'query: SELECT "email" FROM "users" WHERE "phone" = $1',
  );
  const out = capture(leaky);

  assert.equal(out.status, 500);
  assert.equal(out.body.error.code, 'INTERNAL_ERROR');
  const serialised = JSON.stringify(out.body);
  for (const secret of ['prisma', 'ECONNREFUSED', '10.0.3.14', 'SELECT', 'users', 'phone']) {
    assert.ok(
      !serialised.includes(secret),
      `"${secret}" leaked to the client. That is reconnaissance handed to an attacker, and the ` +
        'column names are a BR-DAT-06 breach.',
    );
  }
});

test('a thrown string, number or object is still a well-formed 500', () => {
  for (const thrown of ['boom', 42, { weird: true }, null, undefined]) {
    const out = capture(thrown);
    assert.equal(out.status, 500, `threw ${String(thrown)}`);
    assert.equal(out.body.error.code, 'INTERNAL_ERROR');
    assert.ok(out.body.error.correlation_id);
  }
});

test('a 5xx framework exception does not echo its message either', () => {
  const out = capture(
    new HttpException('Upstream https://api.vendor.internal/v2?key=SECRET failed', 502),
  );
  assert.equal(out.status, 502);
  assert.ok(!JSON.stringify(out.body).includes('SECRET'));
  assert.ok(!JSON.stringify(out.body).includes('api.vendor.internal'));
});

// ---------------------------------------------------------------------------
// Framework and Zod paths.
// ---------------------------------------------------------------------------

test('a Nest 404 becomes RESOURCE_NOT_FOUND in the standard envelope', () => {
  const out = capture(new HttpException('Cannot GET /nope', HttpStatus.NOT_FOUND));
  assert.equal(out.status, 404);
  assert.equal(out.body.error.code, 'RESOURCE_NOT_FOUND');
});

test('a 429 maps to RATE_LIMIT_EXCEEDED', () => {
  const out = capture(new HttpException('slow down', HttpStatus.TOO_MANY_REQUESTS));
  assert.equal(out.body.error.code, 'RATE_LIMIT_EXCEEDED');
});

test('an escaped ZodError becomes a 400 with field-level details', () => {
  const schema = z.object({ email: z.string().email(), age: z.number().int() });
  const parsed = schema.safeParse({ email: 'not-an-email', age: 1.5 });
  assert.equal(parsed.success, false);

  const out = capture(parsed.error as ZodError);
  assert.equal(out.status, 400);
  assert.equal(out.body.error.code, 'VALIDATION_FAILED');
  assert.equal(out.body.error.details.length, 2);
  const fields = out.body.error.details.map((d) => (d as { field?: string }).field);
  assert.deepEqual(fields.sort(), ['age', 'email']);
});

test('Zod details name the field but never echo the submitted VALUE', () => {
  // For a password or an OTP, echoing `received` would return the secret to the client and put
  // it in our own logs.
  const schema = z.object({ password: z.string().min(12) });
  const parsed = schema.safeParse({ password: 'SUBMITTED_SECRET' });
  const out = capture((parsed as { error: ZodError }).error);
  assert.ok(!JSON.stringify(out.body).includes('SUBMITTED_SECRET'));
});

// ---------------------------------------------------------------------------
// Tenancy — Security.md P3.
// ---------------------------------------------------------------------------

test('a missing tenant context is 500, never 403 and never an empty page', () => {
  const out = capture(new TenantContextMissingException('gymRepository.findMany'));
  assert.equal(out.status, 500, 'a 403 would send the investigation toward permissions');
  assert.equal(out.body.error.code, 'TENANT_CONTEXT_MISSING');
  // The operator message names the repository; the client message must not.
  assert.ok(!out.body.error.message.includes('gymRepository'));
});

test('an unregistered code degrades to INTERNAL_ERROR rather than shipping', () => {
  const out = capture(new DomainException('NOT_A_REAL_CODE' as never, 'invented'));
  assert.equal(out.body.error.code, 'INTERNAL_ERROR');
});

test('details from a domain exception reach the client', () => {
  const out = capture(
    new BusinessRuleException('CURRENCY_MISMATCH', 'mismatch', [
      { field: 'currency', expected: 'INR', received: 'USD' },
    ]),
  );
  assert.equal(out.body.error.details.length, 1);
  assert.equal((out.body.error.details[0] as { field: string }).field, 'currency');
});

// ═══════════════════════════════════════════════════════════════════════════
// M-020 · Every registered code needs a message, and one needs a dynamic one.
// ═══════════════════════════════════════════════════════════════════════════

test('EVERY code in the registry has a client-safe message', () => {
  // ┌─ THE GAP THIS CLOSES ────────────────────────────────────────────────────────────────┐
  // │ Adding a row to ERROR_REGISTRY and forgetting `CLIENT_SAFE_MESSAGE` produces a 403 or │
  // │ 422 whose body says "An internal error occurred." Every test passes: the status is    │
  // │ right, the code is right, the envelope is right. Only the sentence a member reads is  │
  // │ wrong, and it is wrong in the way that makes support unable to help them.              │
  // │                                                                                        │
  // │ M-020 found `ELEVATION_REFUSED` in exactly that state, shipped in M-014.               │
  // └────────────────────────────────────────────────────────────────────────────────────────┘
  const missing = Object.keys(ERROR_REGISTRY).filter(
    (code) => CLIENT_SAFE_MESSAGE[code as keyof typeof CLIENT_SAFE_MESSAGE] === undefined,
  );

  assert.deepEqual(
    missing,
    [],
    `these registered codes render as "An internal error occurred":\n  ${missing.join('\n  ')}\n\n` +
      'EV7: the member-facing message is part of the contract, not a nicety. Add an entry to ' +
      'CLIENT_SAFE_MESSAGE in domain-exception.filter.ts.',
  );
});

test('no client-safe message leaks internal vocabulary', () => {
  // A message is read by a member. "tenant", "RLS", "policy", "null" and a bare SQLSTATE are
  // words that mean something to us and nothing to them — except that something broke.
  const internal = /\bSQLSTATE\b|\bRLS\b|\bnull\b|\bundefined\b|\bstack\b|\bprisma\b/i;
  for (const [code, message] of Object.entries(CLIENT_SAFE_MESSAGE)) {
    assert.doesNotMatch(message as string, internal, `${code} leaks internal vocabulary`);
    assert.ok((message as string).length >= 20, `${code} has a stub message`);
  }
});

test('a per-request clientMessage OVERRIDES the static map', () => {
  // ACCOUNT_LOCKED is the only user today: UM1 requires the failure count, the window, the
  // masked channel and the local unlock time, and a static map cannot carry four per-request
  // values.
  const dynamic = new DomainException(
    'ACCOUNT_LOCKED',
    'operator detail that must never be shown',
    [{ locked_until: '2026-08-07T14:22:00+05:30' }],
    'Your account is locked because there were 10 unsuccessful sign-in attempts.',
  );

  const out = capture(dynamic);
  assert.equal(out.status, 403, 'a lockout is a 403, not a 429 — API_Catalog.md §4.5');
  assert.match(out.body.error.message, /10 unsuccessful sign-in attempts/);
  assert.doesNotMatch(out.body.error.message, /operator detail/, 'the operator message leaked');
});

test('without an override, ACCOUNT_LOCKED still gets an ACTIONABLE floor', () => {
  // Authentication.md §6: "'Account locked' alone fails review." The fallback has to be more
  // than a label, because the fallback is what ships if a call site forgets the override.
  const out = capture(new DomainException('ACCOUNT_LOCKED', 'locked'));
  assert.match(out.body.error.message, /unlock/i);
  assert.doesNotMatch(out.body.error.message, /^Account locked\.?$/);
});

test('a failed login is UNAUTHENTICATED — there is no code that distinguishes the two cases', () => {
  // Security.md §1.6. A distinct INVALID_CREDENTIALS or USER_NOT_FOUND is the easiest possible
  // enumeration oracle: read straight out of the body, no timing analysis needed. It would undo
  // the decoy-hash work in argon2.hasher.adapter.ts with one line.
  const forbidden = ['INVALID_CREDENTIALS', 'USER_NOT_FOUND', 'WRONG_PASSWORD', 'ACCOUNT_UNKNOWN'];
  for (const code of forbidden) {
    assert.equal(
      code in ERROR_REGISTRY,
      false,
      `${code} is registered. A code that distinguishes "no such account" from "wrong password" ` +
        'is a user-enumeration oracle in the response body.',
    );
  }
});
