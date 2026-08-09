/**
 * `M-025` `AC-8` · The subject's own view of an impersonation — `FR-USER-05`.
 *
 * The entity types here are the REAL `audit_entity_type_enum` labels. The first version used
 * `user_session`, which PostgreSQL rejects — and because the audit repository swallows write
 * failures, that produced no row and no error. `audit-enum-parity.int-spec.ts` now fails the build
 * on any value the enum does not hold.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCOUNT_ACTIVITY_ENTITY_TYPES,
  AccountActivityUseCase,
} from '../dist/iam/application/account-activity.use-case.js';

const ME = '0192de00-4000-7000-8000-00000000d001';
const AGENT = '0192de00-4000-7000-8000-00000000d002';

function harness(rows: readonly Record<string, unknown>[]) {
  const queries: unknown[] = [];
  const port = {
    findByEntity: async (query: unknown) => {
      queries.push(query);
      return rows;
    },
    findByActor: async () => [],
  };
  return { useCase: new AccountActivityUseCase(port as any), queries };
}

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'r1',
  occurredAt: new Date(1_700_000_000_000),
  actorId: ME,
  actorType: 'SUPPORT_IMPERSONATION',
  impersonatedBy: AGENT,
  entityType: 'AUTH_SESSION',
  entityId: ME,
  action: 'CREATE',
  reason: 'Investigating a duplicate charge reported in ticket 4821.',
  after: {},
  correlationId: 'c1',
  ...overrides,
});

test('AC-8 — the subject sees the impersonation, with the REASON verbatim', async () => {
  const h = harness([row()]);
  const [entry] = await h.useCase.forUser(ME);

  assert.equal(entry?.kind, 'IMPERSONATION_STARTED');
  assert.equal(entry?.reason, 'Investigating a duplicate charge reported in ticket 4821.');
  assert.equal(entry?.wasImpersonated, true);
});

test('AC-8 — the DURATION is read out of `after`, not left null', async () => {
  // The first version of this use case returned `durationMinutes: null` unconditionally while its
  // type promised a number — "implemented" and empty. The duration lives in the jsonb, so the read
  // port had to project `after` before this could be true.
  const h = harness([row({ action: 'DELETE', after: { durationMinutes: 12 } })]);
  const [entry] = await h.useCase.forUser(ME);

  assert.equal(entry?.kind, 'IMPERSONATION_ENDED');
  assert.equal(entry?.durationMinutes, 12);
});

test('a non-numeric duration is narrowed away rather than cast', async () => {
  // `after` is jsonb and genuinely unknown. A cast would put a number-shaped lie on a screen the
  // user is reading to decide whether to complain.
  for (const after of [{ durationMinutes: 'twelve' }, { durationMinutes: null }, 'nonsense', null]) {
    const h = harness([row({ after })]);
    const [entry] = await h.useCase.forUser(ME);
    assert.equal(entry?.durationMinutes, null, `${JSON.stringify(after)} produced a duration`);
  }
});

test('the AGENT is not named to the customer, only the fact', async () => {
  // Whether to show a support agent's identity to a customer is a staff-safety question nobody has
  // decided. The fact is shown; the identity stays in audit_log for the investigation.
  const h = harness([row()]);
  const [entry] = await h.useCase.forUser(ME);

  assert.equal(entry?.wasImpersonated, true);
  assert.ok(!JSON.stringify(entry).includes(AGENT), "the agent's id reached the user's view");
});

test('an ordinary session is not reported as an impersonation', async () => {
  const h = harness([row({ impersonatedBy: null, actorType: 'USER' })]);
  const [entry] = await h.useCase.forUser(ME);

  assert.equal(entry?.kind, 'SESSION');
  assert.equal(entry?.wasImpersonated, false);
});

test('the entity-type allowlist is explicit, and names a type that has no rows yet', async () => {
  // `EXPORT_JOB` is listed before the export milestone writes anything. Naming it early is what
  // stops the user's log silently missing a category the day that milestone lands.
  assert.ok(ACCOUNT_ACTIVITY_ENTITY_TYPES.includes('EXPORT_JOB'));
  assert.ok(ACCOUNT_ACTIVITY_ENTITY_TYPES.includes('AUTH_SESSION'));

  const h = harness([row({ entityType: 'GYM' })]);
  assert.deepEqual(await h.useCase.forUser(ME), [], 'an unrelated entity reached the user');
});

test('the query is scoped to the caller, and never to an id from a request', async () => {
  // A /me route that accepted an id would be an audit-log read for any account, dressed as a
  // self-service page.
  const h = harness([]);
  await h.useCase.forUser(ME);

  assert.equal((h.queries[0] as { entityId?: string }).entityId, ME);
});
