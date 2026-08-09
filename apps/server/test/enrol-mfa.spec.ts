/**
 * `M-024` · `EnrolMfaUseCase` — `FR-AUTH-07`, `Security.md` §2.8, acceptance criteria 2–4.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import { EnrolMfaUseCase } from '../dist/iam/application/enrol-mfa.use-case.js';
import { AesGcmSecretCipher } from '../dist/iam/infrastructure/secret-cipher.js';
import { totp, stepAt } from '../dist/iam/infrastructure/totp.adapter.js';
import { normaliseRecoveryCode } from '../dist/iam/domain/recovery-code.vo.js';

const NOW = new Date(1_700_000_000_000);
const USER = 'user-ana';
const PASSWORD = 'correct horse battery staple';
const HASH = `hashed:${PASSWORD}`;
const cipher = new AesGcmSecretCipher(randomBytes(32).toString('base64'), 'test-key');

function harness(existing: { enabled?: boolean; envelope?: string | null } = {}) {
  const calls: string[] = [];
  const audited: unknown[] = [];
  let pending: string | null = existing.envelope ?? null;
  let activated: Record<string, unknown> | null = null;

  const store = {
    read: async () => ({
      userId: USER,
      enabled: existing.enabled ?? false,
      enrolledAt: null,
      secretEnvelope: pending,
      recoveryCodeHashes: [],
      lastStep: null,
    }),
    savePendingSecret: async (_u: string, envelope: string) => {
      calls.push('savePending');
      pending = envelope;
    },
    activate: async (input: Record<string, unknown>) => {
      calls.push('activate');
      activated = input;
    },
    recordAcceptedStep: async () => undefined,
    replaceRecoveryCodes: async () => undefined,
    clear: async () => undefined,
  };

  const hasher = {
    hash: async (value: string) => `hashed:${value}`,
    verify: async (stored: string, value: string) => {
      calls.push('verifyPassword');
      return stored === `hashed:${value}`;
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

  const useCase = new EnrolMfaUseCase(
    store as any,
    cipher as any,
    hasher as any,
    { now: () => NOW } as any,
    audit as any,
  );

  return {
    useCase,
    calls,
    audited,
    get pending() {
      return pending;
    },
    get activated() {
      return activated;
    },
  };
}

const beginCommand = (overrides: Record<string, unknown> = {}) => ({
  userId: USER,
  accountLabel: 'ana@example.test',
  roles: ['SUPER_ADMIN'] as const,
  password: PASSWORD,
  storedPasswordHash: HASH,
  correlationId: 'corr-1',
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════════════
// begin
// ═══════════════════════════════════════════════════════════════════════════

test('AC-2 — begin returns a provisioning URI and stores the secret as PENDING', async () => {
  const h = harness();
  const result = await h.useCase.begin(beginCommand());

  assert.match(result.provisioningUri, /^otpauth:\/\/totp\/GymMap:ana%40example\.test\?/);
  assert.ok(h.pending, 'no pending secret was stored');
  // Pending means exactly that: the factor is NOT active until a live code confirms it.
  assert.ok(!h.calls.includes('activate'), 'begin activated the factor');
});

test('§2.8 — begin requires password RE-AUTHENTICATION', async () => {
  // ┌─ THE ATTACK THIS CLOSES ───────────────────────────────────────────────────────────────────┐
  // │ An unattended logged-in desk. Enrolling an attacker's authenticator turns borrowed access   │
  // │ into permanent access, and the victim's own sessions keep working, so nothing looks wrong.  │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const h = harness();

  await assert.rejects(() => h.useCase.begin(beginCommand({ password: 'wrong' })));
  assert.equal(h.pending, null, 'a secret was stored despite a failed re-authentication');
});

test('an OTP-only account is refused rather than waved through', async () => {
  // Skipping the control "because they have no password" removes it for exactly the accounts that
  // cannot fall back on one.
  const h = harness();

  await assert.rejects(() => h.useCase.begin(beginCommand({ storedPasswordHash: null })));
  assert.equal(h.pending, null);
  assert.ok(h.calls.includes('burn'), 'no equivalent work burned — timing distinguishes the case');
});

test('a NOT_OFFERED role is refused before any secret exists', async () => {
  const h = harness();

  await assert.rejects(
    () => h.useCase.begin(beginCommand({ roles: ['RECEPTIONIST'] })),
    (error: { code?: string }) => error.code === 'MFA_NOT_AVAILABLE_FOR_ROLE',
  );

  assert.equal(h.pending, null);
  // Refused before the password is even examined — the answer does not depend on it.
  assert.ok(!h.calls.includes('verifyPassword'));
});

test('a GYM_OWNER may enrol, because the factor is OPTIONAL rather than unavailable', async () => {
  const h = harness();
  const result = await h.useCase.begin(beginCommand({ roles: ['GYM_OWNER'] }));
  assert.ok(result.provisioningUri);
});

test('beginning twice REPLACES the pending secret', async () => {
  // If the first survived, a QR screenshotted and abandoned would stay a valid second factor
  // forever — a credential the user does not know exists and cannot revoke.
  const h = harness();

  await h.useCase.begin(beginCommand());
  const first = h.pending;
  await h.useCase.begin(beginCommand());

  assert.notEqual(h.pending, first, 'the second enrolment did not replace the first secret');
});

test('begin writes NO audit row — nothing about the account has changed yet', async () => {
  // A row saying "MFA enrolled" for an attempt nobody finished is worse than no row.
  const h = harness();
  await h.useCase.begin(beginCommand());
  assert.equal(h.audited.length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════
// confirm
// ═══════════════════════════════════════════════════════════════════════════

/** Runs `begin`, then reads the secret back out of the stored envelope to compute a live code. */
async function begun() {
  const h = harness();
  await h.useCase.begin(beginCommand());
  const secret = cipher.open(h.pending as string);
  return { h, code: totp(secret, NOW.getTime()) };
}

test('AC-2 — confirm activates only with a LIVE code', async () => {
  const { h, code } = await begun();
  await h.useCase.confirm({ userId: USER, code, correlationId: 'corr-1' });

  assert.ok(h.activated, 'the factor was not activated');
  assert.equal(h.activated?.['at'], NOW);
});

test('AC-2 — a wrong code leaves the account UNCHANGED', async () => {
  const { h } = await begun();

  await assert.rejects(() => h.useCase.confirm({ userId: USER, code: '000000', correlationId: 'c' }));
  assert.equal(h.activated, null, 'an unconfirmed enrolment activated the factor');
});

test('AC-3 — ten recovery codes are issued at CONFIRMATION, and only hashes are stored', async () => {
  const { h, code } = await begun();
  const result = await h.useCase.confirm({ userId: USER, code, correlationId: 'corr-1' });

  assert.equal(result.recoveryCodes.length, 10);
  assert.equal(new Set(result.recoveryCodes).size, 10);

  const stored = h.activated?.['recoveryCodeHashes'] as readonly string[];
  assert.equal(stored.length, 10);
  for (const plaintext of result.recoveryCodes) {
    assert.ok(!stored.includes(plaintext), 'a recovery code was stored in plaintext');
  }
});

test('the stored hash is of the NORMALISED code, so retyping it works', async () => {
  // Hash the displayed form with its separator and a user typing it back exactly is told it is
  // wrong — the failure looks like "recovery codes do not work" and is impossible to diagnose
  // from the outside.
  const { h, code } = await begun();
  const result = await h.useCase.confirm({ userId: USER, code, correlationId: 'corr-1' });

  const stored = h.activated?.['recoveryCodeHashes'] as readonly string[];
  const first = result.recoveryCodes[0] as string;
  assert.ok(stored.includes(`hashed:${normaliseRecoveryCode(first)}`));
  assert.ok(!stored.includes(`hashed:${first}`), 'the un-normalised form was hashed');
});

test('the confirming code is seeded as the first accepted step, so it cannot be replayed', async () => {
  const { h, code } = await begun();
  await h.useCase.confirm({ userId: USER, code, correlationId: 'corr-1' });

  assert.equal(h.activated?.['firstAcceptedStep'], stepAt(NOW.getTime()));
});

test('confirming TWICE does not reissue recovery codes', async () => {
  // ┌─ THE SILENT DAMAGE THIS PREVENTS ──────────────────────────────────────────────────────────┐
  // │ A fresh set invalidates the ten the user already wrote down. Their saved codes stop working │
  // │ with no event they would notice, and they find out when they have lost their phone.         │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const h = harness({ enabled: true, envelope: cipher.seal(randomBytes(20)) });

  await assert.rejects(() => h.useCase.confirm({ userId: USER, code: '000000', correlationId: 'c' }));
  assert.equal(h.activated, null);
});

test('confirming with no enrolment in progress is refused', async () => {
  const h = harness({ envelope: null });
  await assert.rejects(() => h.useCase.confirm({ userId: USER, code: '000000', correlationId: 'c' }));
});

test('BR-DAT-01 — the audit row records the change and neither credential', async () => {
  const { h, code } = await begun();
  const result = await h.useCase.confirm({ userId: USER, code, correlationId: 'corr-1' });

  assert.equal(h.audited.length, 1);
  const row = h.audited[0] as Record<string, unknown>;
  assert.equal(row['entityType'], 'user_mfa');
  assert.deepEqual(row['before'], { mfaEnabled: false });
  assert.deepEqual(row['after'], { mfaEnabled: true, recoveryCodesIssued: 10 });

  const serialised = JSON.stringify(row);
  for (const plaintext of result.recoveryCodes) {
    assert.ok(!serialised.includes(plaintext), 'a recovery code reached the audit row');
  }
  assert.ok(!serialised.includes(PASSWORD));
});
