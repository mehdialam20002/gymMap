/**
 * `M-024` · `DisableMfaUseCase` — `FR-AUTH-07`, acceptance criterion 6.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DisableMfaUseCase } from '../dist/iam/application/disable-mfa.use-case.js';

const USER = 'user-ana';
const PASSWORD = 'correct horse battery staple';
const HASH = `hashed:${PASSWORD}`;

function harness(enabled = true) {
  const calls: string[] = [];
  const audited: unknown[] = [];

  const store = {
    read: async () => ({
      userId: USER,
      enabled,
      enrolledAt: new Date(0),
      secretEnvelope: 'v1.k.a.b.c',
      recoveryCodeHashes: [],
      lastStep: null,
    }),
    savePendingSecret: async () => undefined,
    activate: async () => undefined,
    recordAcceptedStep: async () => undefined,
    replaceRecoveryCodes: async () => undefined,
    clear: async () => {
      calls.push('clear');
    },
  };

  const hasher = {
    hash: async (v: string) => `hashed:${v}`,
    verify: async (stored: string, v: string) => {
      calls.push('verifyPassword');
      return stored === `hashed:${v}`;
    },
    needsRehash: () => false,
    burnEquivalentWork: async () => {
      calls.push('burn');
    },
  };

  const audit = {
    append: async (entry: unknown) => {
      calls.push('audit');
      audited.push(entry);
    },
  };

  return {
    useCase: new DisableMfaUseCase(store as any, hasher as any, audit as any),
    calls,
    audited,
  };
}

const command = (overrides: Record<string, unknown> = {}) => ({
  userId: USER,
  roles: ['GYM_OWNER'] as const,
  password: PASSWORD,
  storedPasswordHash: HASH,
  correlationId: 'corr-1',
  ...overrides,
});

test('AC-6 — platform staff cannot disable, and the code is not an authorisation error', async () => {
  const h = harness();

  await assert.rejects(
    () => h.useCase.execute(command({ roles: ['SUPER_ADMIN'] })),
    (error: { code?: string }) => error.code === 'MFA_MANDATORY_FOR_ROLE',
  );

  assert.ok(!h.calls.includes('clear'), 'the factor was removed for a mandatory role');
});

test('AC-6 — the policy is checked BEFORE the password, so staff get no password oracle', async () => {
  // ┌─ WHY THE ORDER MATTERS HERE ───────────────────────────────────────────────────────────────┐
  // │ Checking the password first makes this a password oracle for staff accounts: "wrong         │
  // │ password" and "not allowed" are different answers, and only one depends on the password.    │
  // │ Policy first means a staff account replies the same way whatever is submitted — which is    │
  // │ also the honest reply, because the operation was never available.                           │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const right = harness();
  await assert.rejects(() => right.useCase.execute(command({ roles: ['FINANCE'] })));
  assert.ok(!right.calls.includes('verifyPassword'), 'the password was examined for a staff account');

  const wrong = harness();
  await assert
    .rejects(() => wrong.useCase.execute(command({ roles: ['FINANCE'], password: 'nope' })))
    .then(() => {
      assert.ok(!wrong.calls.includes('verifyPassword'));
    });
});

test('a gym owner CAN disable the factor they opted into', async () => {
  const h = harness();
  await h.useCase.execute(command());

  assert.ok(h.calls.includes('clear'));
  assert.equal(h.audited.length, 1);
});

test('holding a staff role ALONGSIDE an owner role still refuses', async () => {
  const h = harness();
  await assert.rejects(
    () => h.useCase.execute(command({ roles: ['GYM_OWNER', 'MODERATOR'] })),
    (error: { code?: string }) => error.code === 'MFA_MANDATORY_FOR_ROLE',
  );
});

test('§2.8 — removing a factor requires re-authentication', async () => {
  // The single most valuable thing an attacker at an unattended desk can do.
  const h = harness();

  await assert.rejects(() => h.useCase.execute(command({ password: 'wrong' })));
  assert.ok(!h.calls.includes('clear'), 'the factor was removed without the password');
});

test('an OTP-only account is refused, and burns equivalent work', async () => {
  const h = harness();
  await assert.rejects(() => h.useCase.execute(command({ storedPasswordHash: null })));
  assert.ok(h.calls.includes('burn'));
  assert.ok(!h.calls.includes('clear'));
});

test('BR-DAT-01 — the audit row records that the factor WAS on', async () => {
  // Removing a second factor is what an account takeover does before it does anything else, so
  // `before` carries the fact an investigation needs and the only one the row can still show.
  const h = harness(true);
  await h.useCase.execute(command());

  const row = h.audited[0] as Record<string, unknown>;
  assert.equal(row['entityType'], 'user_mfa');
  assert.deepEqual(row['before'], { mfaEnabled: true });
  assert.deepEqual(row['after'], { mfaEnabled: false });
  assert.ok(!JSON.stringify(row).includes(PASSWORD));
});

test('disabling an account that has nothing enabled is a no-op that still audits', async () => {
  // Not an error: the caller asked for a state and they are already in it. Silence would be worse —
  // the request still happened and still deserves a row.
  const h = harness(false);
  await h.useCase.execute(command());

  assert.ok(h.calls.includes('clear'));
  assert.deepEqual((h.audited[0] as Record<string, unknown>)['before'], { mfaEnabled: false });
});
