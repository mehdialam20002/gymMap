/**
 * `M-024` · `VerifyMfaUseCase` — `FR-AUTH-07`, `NFR-SEC-11`, `Security.md` §2.8.
 *
 * The properties here are the ones whose absence leaves a system that verifies codes correctly and
 * is still broken: a replay that works, an oracle that reveals who holds a factor, a recovery code
 * that survives being spent, and a lockout budget that resets on every attempt.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import { VerifyMfaUseCase } from '../dist/iam/application/verify-mfa.use-case.js';
import { AesGcmSecretCipher } from '../dist/iam/infrastructure/secret-cipher.js';
import { totp, stepAt } from '../dist/iam/infrastructure/totp.adapter.js';

const NOW = new Date(1_700_000_000_000);
const USER = 'user-ana';
const SECRET = randomBytes(20);
const cipher = new AesGcmSecretCipher(randomBytes(32).toString('base64'), 'test-key');

/** A double set. Every collaborator records what it was asked to do. */
function harness(
  overrides: {
    enabled?: boolean;
    lastStep?: bigint | null;
    codes?: readonly string[];
    failures?: number;
    missing?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const audited: unknown[] = [];
  let recordedStep: bigint | null = null;
  let remainingCodes: readonly string[] | null = null;
  let cleared = 0;
  let failuresRecorded = 0;

  const codes = overrides.codes ?? [];

  const store = {
    read: async () =>
      overrides.missing
        ? null
        : {
            userId: USER,
            enabled: overrides.enabled ?? true,
            enrolledAt: NOW,
            secretEnvelope: cipher.seal(SECRET),
            recoveryCodeHashes: codes,
            lastStep: overrides.lastStep ?? null,
          },
    savePendingSecret: async () => undefined,
    activate: async () => undefined,
    recordAcceptedStep: async (_u: string, step: bigint) => {
      calls.push('recordStep');
      recordedStep = step;
    },
    replaceRecoveryCodes: async (_u: string, hashes: readonly string[]) => {
      calls.push('replaceCodes');
      remainingCodes = hashes;
    },
    clear: async () => undefined,
  };

  const lockout = {
    read: async () => {
      calls.push('lockoutRead');
      return { failures: overrides.failures ?? 0, locksInEscalationWindow: 0 };
    },
    recordFailure: async () => {
      calls.push('recordFailure');
      failuresRecorded += 1;
      return (overrides.failures ?? 0) + failuresRecorded;
    },
    recordLock: async () => {
      calls.push('recordLock');
    },
    clearFailures: async () => {
      calls.push('clearFailures');
      cleared += 1;
    },
  };

  /** `verify` matches when the stored "hash" is `hashed:<code>`; every call is counted. */
  let verifyCalls = 0;
  const hasher = {
    hash: async (value: string) => `hashed:${value}`,
    verify: async (stored: string, value: string) => {
      verifyCalls += 1;
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

  const clock = { now: () => NOW };

  const useCase = new VerifyMfaUseCase(
    store as any,
    lockout as any,
    cipher as any,
    hasher as any,
    clock as any,
    audit as any,
  );

  return {
    useCase,
    calls,
    audited,
    get recordedStep() {
      return recordedStep;
    },
    get remainingCodes() {
      return remainingCodes;
    },
    get cleared() {
      return cleared;
    },
    get verifyCalls() {
      return verifyCalls;
    },
  };
}

const command = (submitted: string) => ({ userId: USER, submitted, correlationId: 'corr-1' });

// ═══════════════════════════════════════════════════════════════════════════
// TOTP
// ═══════════════════════════════════════════════════════════════════════════

test('a valid code is accepted and its step is recorded', async () => {
  const h = harness();
  const result = await h.useCase.execute(command(totp(SECRET, NOW.getTime())));

  assert.equal(result.method, 'TOTP');
  assert.equal(h.recordedStep, stepAt(NOW.getTime()));
});

test('§2.8 — the step is recorded BEFORE success is reported', async () => {
  // If the write failed and the caller was told yes anyway, the same code stays usable for the
  // whole drift window — the replay this counter exists to stop, and invisible from outside.
  const h = harness();
  await h.useCase.execute(command(totp(SECRET, NOW.getTime())));

  assert.ok(
    h.calls.indexOf('recordStep') < h.calls.indexOf('clearFailures'),
    `expected the step recorded before the request completed: ${h.calls.join(' → ')}`,
  );
});

test('§2.8 — a code from an already-accepted step is REFUSED', async () => {
  const h = harness({ lastStep: stepAt(NOW.getTime()) });

  await assert.rejects(
    () => h.useCase.execute(command(totp(SECRET, NOW.getTime()))),
    /not accepted/,
  );
});

test('a wrong code is refused and nothing is written', async () => {
  const h = harness();
  await assert.rejects(() => h.useCase.execute(command('000000')));

  assert.equal(h.recordedStep, null);
  assert.ok(!h.calls.includes('recordStep'));
});

// ═══════════════════════════════════════════════════════════════════════════
// The oracle
// ═══════════════════════════════════════════════════════════════════════════

test('an UNENROLLED account fails identically to a wrong code', async () => {
  // ┌─ WHY THE MESSAGES MUST MATCH ──────────────────────────────────────────────────────────────┐
  // │ A distinct "not enrolled" turns this endpoint into an enrolment oracle: submit anything for │
  // │ a user id and the error says whether that account holds a second factor — which is to say,  │
  // │ whether it is a staff account worth attacking.                                              │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const wrong = await harness()
    .useCase.execute(command('000000'))
    .catch((error: Error & { code?: string }) => error);
  const unenrolled = await harness({ enabled: false })
    .useCase.execute(command('000000'))
    .catch((error: Error & { code?: string }) => error);
  const missing = await harness({ missing: true })
    .useCase.execute(command('000000'))
    .catch((error: Error & { code?: string }) => error);

  assert.equal((wrong as { code?: string }).code, 'MFA_VERIFICATION_FAILED');
  assert.equal((unenrolled as { code?: string }).code, (wrong as { code?: string }).code);
  assert.equal((missing as { code?: string }).code, (wrong as { code?: string }).code);
  assert.equal((unenrolled as Error).message, (wrong as Error).message);
});

test('an unenrolled account still burns hashing work, so it is not measurably faster', async () => {
  const h = harness({ enabled: false });
  await assert.rejects(() => h.useCase.execute(command('000000')));
  assert.ok(h.calls.includes('burn'), 'no equivalent work was burned — timing distinguishes them');
});

// ═══════════════════════════════════════════════════════════════════════════
// Recovery codes
// ═══════════════════════════════════════════════════════════════════════════

const CODE = 'ABCDE-FGHJK';
const codeHashes = (used: string) => ['hashed:XXXXXYYYYY', `hashed:${used}`, 'hashed:ZZZZZWWWWW'];

test('a recovery code is accepted and REMOVED from the set', async () => {
  const h = harness({ codes: codeHashes('ABCDEFGHJK') });
  const result = await h.useCase.execute(command(CODE));

  assert.equal(result.method, 'RECOVERY_CODE');
  assert.equal(result.recoveryCodesRemaining, 2);
  assert.deepEqual(h.remainingCodes, ['hashed:XXXXXYYYYY', 'hashed:ZZZZZWWWWW']);
});

test('EVERY hash is checked — the loop does not stop at the match', async () => {
  // ┌─ THE TIMING ORACLE THIS CLOSES ────────────────────────────────────────────────────────────┐
  // │ Argon2id is deliberately slow, so returning at the first match makes the response time      │
  // │ proportional to the code's POSITION in the array — which narrows which code was used and,   │
  // │ across attempts, how many remain. A fixed count leaks nothing.                              │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const h = harness({ codes: codeHashes('ABCDEFGHJK') });
  await h.useCase.execute(command(CODE));

  assert.equal(h.verifyCalls, 3, 'the loop returned early on the matching hash');
});

test('the code is normalised, so lower case and spaces still match', async () => {
  const h = harness({ codes: codeHashes('ABCDEFGHJK') });
  const result = await h.useCase.execute(command('abcde fghjk'));
  assert.equal(result.method, 'RECOVERY_CODE');
});

test('BR-DAT-01 — the audit row carries the COUNTS and never the code', async () => {
  const h = harness({ codes: codeHashes('ABCDEFGHJK') });
  await h.useCase.execute(command(CODE));

  assert.equal(h.audited.length, 1);
  const row = h.audited[0] as Record<string, unknown>;

  assert.equal(row['entityType'], 'user_mfa');
  assert.deepEqual(row['before'], { recoveryCodesRemaining: 3 });
  assert.deepEqual(row['after'], { recoveryCodesRemaining: 2 });

  // The code is a live credential until the moment it is spent, and the log estate outlives it by
  // seven years. It must appear nowhere in the row, in any field.
  const serialised = JSON.stringify(row);
  assert.ok(!serialised.includes(CODE), 'the recovery code is in the audit row');
  assert.ok(!serialised.includes('ABCDEFGHJK'), 'the normalised code is in the audit row');
});

test('§2.8 — below three remaining, regeneration is prompted', async () => {
  const h = harness({ codes: ['hashed:AAAAABBBBB', 'hashed:ABCDEFGHJK', 'hashed:CCCCCDDDDD'] });
  const result = await h.useCase.execute(command(CODE));

  assert.equal(result.recoveryCodesRemaining, 2);
  assert.equal(result.shouldRegenerateRecoveryCodes, true);
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-7 — the shared lockout budget
// ═══════════════════════════════════════════════════════════════════════════

test('AC-7 — lockout is read BEFORE anything is verified', async () => {
  const h = harness();
  await h.useCase.execute(command(totp(SECRET, NOW.getTime())));

  assert.equal(h.calls[0], 'lockoutRead', `lockout was not consulted first: ${h.calls.join(' → ')}`);
});

test('AC-7 — a locked account is refused without the code being examined', async () => {
  const h = harness({ failures: 10 });

  await assert.rejects(() => h.useCase.execute(command(totp(SECRET, NOW.getTime()))));
  assert.ok(!h.calls.includes('recordStep'), 'a locked account still had its code verified');
});

test('AC-7 — a failure increments the SHARED M-020 counter', async () => {
  // One counter per account, not one per credential type — otherwise five password guesses plus
  // five TOTP guesses is ten attempts against a threshold of ten, and each budget looks correct.
  const h = harness();
  await assert.rejects(() => h.useCase.execute(command('000000')));

  assert.ok(h.calls.includes('recordFailure'));
});

test('success clears the counter, and only after the credential was actually spent', async () => {
  const h = harness();
  await h.useCase.execute(command(totp(SECRET, NOW.getTime())));

  assert.equal(h.cleared, 1);
  assert.ok(
    h.calls.indexOf('recordStep') < h.calls.indexOf('clearFailures'),
    'the budget was reset before the code was verified',
  );
});
