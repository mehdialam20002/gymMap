/**
 * `M-031` · `DeactivateBranchUseCase` — the orchestration, not the rules.
 *
 * ┌─ WHAT IS WORTH TESTING WHEN THE DECISION LIVES SOMEWHERE ELSE ───────────────────────────────┐
 * │ `branch-deactivation.policy.spec.ts` already proves every rule against `mayDeactivate()`, and │
 * │ repeating those cases here would only prove the use case can call a function.                  │
 * │                                                                                              │
 * │ What this file proves is the three things the use case alone can get wrong: the ORDER of its  │
 * │ reads, that it does not re-decide anything the policy decided, and that `promoteToPrimary`    │
 * │ reaches the caller instead of being dropped.                                                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DeactivateBranchUseCase } from '../dist/catalog/application/deactivate-branch.use-case.js';

const GYM = '0192de00-7000-7000-8000-0000000000a1';
const BRANCH_A = '0192de00-7000-7000-8000-0000000000b1';
const BRANCH_B = '0192de00-7000-7000-8000-0000000000b2';

/** Records the order the ports were called in — the property this file exists for. */
function build(options: {
  gymStatus?: 'APPROVED' | 'DRAFT' | null;
  branchFound?: boolean;
  active?: { id: string; isPrimary: boolean }[];
  affectedCount?: number | 'UNAVAILABLE';
}) {
  const calls: string[] = [];
  const {
    gymStatus = 'APPROVED',
    branchFound = true,
    active = [
      { id: BRANCH_A, isPrimary: true },
      { id: BRANCH_B, isPrimary: false },
    ],
    affectedCount = 0,
  } = options;

  const useCase = new DeactivateBranchUseCase(
    {
      statusOf: (id: string) => {
        calls.push(`statusOf:${id}`);
        return Promise.resolve(
          gymStatus === null
            ? ({ ok: false, reason: 'UNKNOWN_GYM' } as const)
            : ({ ok: true, status: gymStatus } as const),
        );
      },
    } as never,
    {
      findInGym: (gymId: string, branchId: string) => {
        calls.push(`findInGym:${branchId}`);
        return Promise.resolve(
          branchFound
            ? ({ ok: true, branch: { id: branchId, isPrimary: true } } as const)
            : ({ ok: false, reason: 'UNKNOWN_BRANCH' } as const),
        );
      },
      activeInGym: (gymId: string) => {
        calls.push(`activeInGym:${gymId}`);
        return Promise.resolve(active);
      },
    } as never,
    {
      countForBranch: (branchId: string) => {
        calls.push(`countForBranch:${branchId}`);
        return Promise.resolve(
          affectedCount === 'UNAVAILABLE'
            ? ({ ok: false, reason: 'the membership service did not answer' } as const)
            : ({ ok: true, count: affectedCount } as const),
        );
      },
    } as never,
  );

  return { useCase, calls };
}

// ═══════════════════════════════════════════════════════════════════════════
// The read order, which is the only judgement in the file.
// ═══════════════════════════════════════════════════════════════════════════

test('existence is checked BEFORE any membership count is taken', async () => {
  /*
   * The leak this prevents is a timing one. If the count ran first, a caller passing another
   * gym's branch id would trigger a query over rows they cannot see — and on a busy branch the
   * RESPONSE TIME answers "does this id exist" whatever the body says.
   */
  const { useCase, calls } = build({});
  await useCase.execute({ gymId: GYM, branchId: BRANCH_A });

  assert.deepEqual(calls, [
    `statusOf:${GYM}`,
    `findInGym:${BRANCH_A}`,
    `activeInGym:${GYM}`,
    `countForBranch:${BRANCH_A}`,
  ]);
});

test('an unknown gym stops everything — no branch lookup, no count', async () => {
  const { useCase, calls } = build({ gymStatus: null });
  const outcome = await useCase.execute({ gymId: GYM, branchId: BRANCH_A });

  assert.deepEqual(outcome, { ok: false, reason: 'UNKNOWN_GYM' });
  assert.deepEqual(calls, [`statusOf:${GYM}`], 'work happened after the gym was refused');
});

test('an unknown branch stops before the count, and never reveals which lookup missed', async () => {
  const { useCase, calls } = build({ branchFound: false });
  const outcome = await useCase.execute({ gymId: GYM, branchId: BRANCH_A });

  assert.deepEqual(outcome, { ok: false, reason: 'UNKNOWN_BRANCH' });
  assert.ok(!calls.some((c) => c.startsWith('countForBranch')), 'counted an invisible branch');
});

// ═══════════════════════════════════════════════════════════════════════════
// The policy decides; the use case carries.
// ═══════════════════════════════════════════════════════════════════════════

test('both facts are gathered even when the first would settle it', async () => {
  /*
   * A gym with one branch is refused on last-branch grounds, so short-circuiting the count looks
   * like a free optimisation. It is not: `mayDeactivate()` checks last-branch BEFORE membership
   * count deliberately, and moving that ordering into an `if` here would put a tested decision
   * into untested code and give the system two answers to one question.
   */
  const { useCase, calls } = build({ active: [{ id: BRANCH_A, isPrimary: true }] });
  const outcome = await useCase.execute({ gymId: GYM, branchId: BRANCH_A });

  assert.equal(outcome.ok, false);
  assert.ok(calls.includes(`countForBranch:${BRANCH_A}`), 'the use case decided instead of asking');
});

test('the last active branch of a listed gym is refused, with the policy’s own verdict', async () => {
  const { useCase } = build({ active: [{ id: BRANCH_A, isPrimary: true }] });
  const outcome = await useCase.execute({ gymId: GYM, branchId: BRANCH_A });

  assert.equal(outcome.ok, false);
  if (outcome.ok || outcome.reason !== 'REFUSED') throw new Error('expected a policy refusal');
  assert.equal(outcome.verdict.permitted, false);
});

test('an unavailable count is a refusal, never a pass', async () => {
  /*
   * The same policy as `MalwareScanPort`: "we could not check" is not "it is fine". A branch whose
   * member count is unknown cannot be shown to be safe to close, and closing it would strand
   * whoever was still checking in there.
   */
  const { useCase } = build({ affectedCount: 'UNAVAILABLE' });
  const outcome = await useCase.execute({ gymId: GYM, branchId: BRANCH_A });

  assert.equal(outcome.ok, false);
});

test('promoteToPrimary reaches the caller — dropping it leaves a gym with no primary', async () => {
  /*
   * The verdict names the branch to promote, and the repository does both writes in ONE
   * transaction because `uq_branches__one_primary_per_gym` is a partial unique index. A use case
   * that swallowed this field would produce a gym with no primary branch and no error anywhere —
   * which is why the value is asserted rather than the boolean.
   */
  const { useCase } = build({
    active: [
      { id: BRANCH_A, isPrimary: true },
      { id: BRANCH_B, isPrimary: false },
    ],
  });
  const outcome = await useCase.execute({ gymId: GYM, branchId: BRANCH_A });

  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.promotedToPrimary, BRANCH_B, 'the successor was not passed on');
});

test('deactivating a non-primary branch promotes nobody', async () => {
  // `null` rather than an omitted field: the repository branches on it, and `undefined` meaning
  // "no promotion" and "the use case forgot" would be the same value.
  const { useCase } = build({});
  const outcome = await useCase.execute({ gymId: GYM, branchId: BRANCH_B });

  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.promotedToPrimary, null);
});
