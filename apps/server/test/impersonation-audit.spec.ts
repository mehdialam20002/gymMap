/**
 * `M-025` `AC-7` · `impersonated_by` reaches every row — `FR-AUTH-12`, `BR-DAT-01`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE REQUIREMENT IS THE WORD "EVERY"
 *
 * *"Every write under the token carries `impersonated_by` in its audit row"* — not only the start
 * event. A field each caller must remember is one most callers will not, and the omission is
 * invisible: the row is written, the report runs, and the actions taken under a borrowed identity
 * are the ones missing the borrower. Exactly the rows an investigation is looking for.
 *
 * So these assertions go through the REPOSITORY, calling it the way a use case that never heard of
 * impersonation would — with no `impersonatedBy` in the entry at all.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  currentImpersonation,
  currentImpersonatorId,
  runAsImpersonator,
} from '../dist/common/auth/impersonation.als.js';
import { AuditPrismaRepository } from '../dist/audit/infrastructure/audit.prisma-repository.js';

const AGENT = '0192de00-3000-7000-8000-00000000a001';
const SUBJECT = '0192de00-3000-7000-8000-00000000b001';

const context = {
  impersonatorId: AGENT,
  subjectUserId: SUBJECT,
  startedAt: new Date(1_700_000_000_000),
};

/** Captures the values the repository interpolates, without a database. */
function repository() {
  const captured: { actorType?: unknown; impersonatedBy?: unknown }[] = [];

  const db = {
    // The tagged template: `strings` then the interpolated values, in source order.
    executeRaw: (_strings: TemplateStringsArray, ...values: unknown[]) => {
      // Positions follow the INSERT's value list: tenantId, actorId, actorType, actorLabel,
      // impersonatedBy, ...
      captured.push({ actorType: values[2], impersonatedBy: values[4] });
      return Promise.resolve();
    },
  };

  return { repo: new AuditPrismaRepository(db as any), captured };
}

const entry = (overrides: Record<string, unknown> = {}) => ({
  tenantId: null,
  actorId: SUBJECT,
  actorType: 'USER',
  entityType: 'user_mfa',
  entityId: SUBJECT,
  action: 'UPDATE',
  before: {},
  after: {},
  reason: 'x',
  correlationId: '0192de00-3000-7000-8000-00000000c001',
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════════════
// The context itself
// ═══════════════════════════════════════════════════════════════════════════

test('outside an impersonation there is no impersonator', () => {
  assert.equal(currentImpersonation(), null);
  assert.equal(currentImpersonatorId(), null);
});

test('inside one, the agent is visible without being passed anywhere', () => {
  runAsImpersonator(context, () => {
    assert.equal(currentImpersonatorId(), AGENT);
    assert.equal(currentImpersonation()?.subjectUserId, SUBJECT);
  });

  // …and the frame does not leak past the call.
  assert.equal(currentImpersonatorId(), null);
});

test('the frame survives an await boundary', async () => {
  // The whole mechanism is worthless if it does not: every audit write is asynchronous, and most
  // happen several awaits deep inside a use case.
  await runAsImpersonator(context, async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 1));
    assert.equal(currentImpersonatorId(), AGENT);
  });
});

test('NESTING is refused rather than silently merged', () => {
  // ┌─ WHY THIS THROWS ──────────────────────────────────────────────────────────────────────────┐
  // │ There is no legitimate nested impersonation — an IMPERSONATION token cannot mint another.   │
  // │ Reaching here twice means a frame leaked across an async boundary or a middleware ran twice, │
  // │ and taking the inner one would attribute a whole request to the wrong agent.                │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  runAsImpersonator(context, () => {
    assert.throws(
      () => runAsImpersonator({ ...context, impersonatorId: 'someone-else' }, () => undefined),
      /already in scope/,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-7 — the repository
// ═══════════════════════════════════════════════════════════════════════════

test('AC-7 — a caller that never heard of impersonation still writes the agent', async () => {
  // This is the entire point. The entry has no `impersonatedBy`, exactly as `change-user-role`,
  // `verify-mfa` and every future use case will write it.
  const { repo, captured } = repository();

  await runAsImpersonator(context, () => repo.append(entry() as never));

  assert.equal(captured[0]?.impersonatedBy, AGENT);
});

test('AC-7 — the actor TYPE widens too, so the row cannot contradict itself', async () => {
  // A row saying `USER` while `impersonated_by` is set contradicts itself, and a report filtering
  // on `SUPPORT_IMPERSONATION` would miss it entirely.
  const { repo, captured } = repository();

  await runAsImpersonator(context, () => repo.append(entry() as never));

  assert.equal(captured[0]?.actorType, 'SUPPORT_IMPERSONATION');
});

test('a MORE specific actor type is not overwritten', async () => {
  // `PLATFORM_ADMIN` under an elevation says something `SUPPORT_IMPERSONATION` does not. Only the
  // generic `USER` is widened.
  const { repo, captured } = repository();

  await runAsImpersonator(context, () =>
    repo.append(entry({ actorType: 'PLATFORM_ADMIN' }) as never),
  );

  assert.equal(captured[0]?.actorType, 'PLATFORM_ADMIN');
  assert.equal(captured[0]?.impersonatedBy, AGENT, 'the agent is still recorded');
});

test('an ordinary write outside an impersonation records no agent', async () => {
  const { repo, captured } = repository();

  await repo.append(entry() as never);

  assert.equal(captured[0]?.impersonatedBy, null);
  assert.equal(captured[0]?.actorType, 'USER');
});

test('an EXPLICIT impersonatedBy still wins, for the row written after the frame ends', async () => {
  // The one legitimate override: the row recording that the impersonation ENDED is written once the
  // frame is gone, and still has to name the agent.
  const { repo, captured } = repository();

  await repo.append(entry({ impersonatedBy: 'explicit-agent' }) as never);

  assert.equal(captured[0]?.impersonatedBy, 'explicit-agent');
});

test('the interceptor no longer hard-codes null over the ambient agent', () => {
  // ┌─ THE ONE-WORD REGRESSION THIS GUARDS ──────────────────────────────────────────────────────┐
  // │ `impersonatedBy: null` in the interceptor is an EXPLICIT "no impersonator", and the         │
  // │ repository's `??` honours it — which would switch M-025 off for every `@Audited()` route,   │
  // │ silently, while every test above still passed.                                              │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const source = readFileSync('src/common/interceptors/audit.interceptor.ts', 'utf8');
  assert.ok(
    !/impersonatedBy:\s*null/.test(source),
    'the audit interceptor passes an explicit null, overriding the ambient impersonator',
  );
});
