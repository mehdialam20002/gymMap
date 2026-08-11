/**
 * `M-031` · `UpdateBranchUseCase` — `Gym.md` §12.3, §6.3, `BR-GYM-06`, `FR-GYM-11`.
 *
 * ┌─ THE GATE, AND THE PATCH IT BUILDS ──────────────────────────────────────────────────────────┐
 * │ Two things this file can get wrong and nothing downstream would notice:                       │
 * │                                                                                              │
 * │  1. The acknowledgement gate letting a material change through — a gym moves premises on a    │
 * │     live listing with nobody looking, which is `RSK-01`.                                       │
 * │  2. The patch carrying a field with no column, or dropping one that has one. The first fails  │
 * │     loudly at the database; the second is a PATCH that returns 200 and changes nothing.        │
 * │                                                                                              │
 * │ `branch-field-classes.spec.ts` owns the classification itself. This owns the wiring.           │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { UpdateBranchUseCase } from '../dist/catalog/application/update-branch.use-case.js';

const GYM = '0192de00-7000-7000-8000-0000000000a1';
const BRANCH = '0192de00-7000-7000-8000-0000000000b1';

function build(options: { gymOf?: string | null; found?: boolean } = {}) {
  const { gymOf = GYM, found = true } = options;
  const patches: Record<string, unknown>[] = [];
  const calls: string[] = [];

  const useCase = new UpdateBranchUseCase(
    {
      findInGym: (gymId: string, branchId: string) => {
        calls.push(`findInGym:${gymId}`);
        return Promise.resolve(
          found
            ? ({ ok: true, branch: { id: branchId, isPrimary: false } } as const)
            : ({ ok: false, reason: 'UNKNOWN_BRANCH' } as const),
        );
      },
    } as never,
    {
      gymOf: (branchId: string) => {
        calls.push(`gymOf:${branchId}`);
        return Promise.resolve(gymOf);
      },
    } as never,
    {
      update: (branchId: string, patch: Record<string, unknown>) => {
        calls.push('update');
        patches.push(patch);
        return Promise.resolve({ id: branchId, ...patch });
      },
    } as never,
  );

  return { useCase, patches, calls };
}

// ═══════════════════════════════════════════════════════════════════════════
// §6.3 mechanism 2 — the acknowledgement
// ═══════════════════════════════════════════════════════════════════════════

test('a material field WITHOUT acknowledge_review is refused, and nothing is written', async () => {
  const { useCase, calls } = build();
  const outcome = await useCase.execute(BRANCH, { postal_code: '400076' });

  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.reason, 'ACKNOWLEDGEMENT_REQUIRED');
  assert.ok(!calls.includes('update'), 'the row was written despite the refusal');
});

test('the refusal ENUMERATES the material fields — §6.3 requires the list', async () => {
  /*
   * *"whose `details` enumerate the material fields"*. A bare code sends the client back to a
   * hard-coded copy of the list, which `Gym.md` 816 warns about directly: *"a client that
   * hard-coded the material list would break, which is why the map exists"*.
   */
  const { useCase } = build();
  const outcome = await useCase.execute(BRANCH, {
    name: 'Andheri West',
    postal_code: '400076',
    location: { lat: 19.117, lng: 72.905 },
  });

  assert.equal(outcome.ok, false);
  if (outcome.ok || outcome.reason !== 'ACKNOWLEDGEMENT_REQUIRED') throw new Error('wrong refusal');

  assert.deepEqual([...outcome.materialFields].sort(), ['location', 'postal_code']);
  assert.ok(!outcome.materialFields.includes('name'), 'an immediate field was named as material');
});

test('the same request WITH acknowledge_review: true goes through', async () => {
  const { useCase, patches } = build();
  const outcome = await useCase.execute(BRANCH, {
    postal_code: '400076',
    acknowledge_review: true,
  });

  assert.equal(outcome.ok, true);
  assert.equal(patches[0]?.['postalCode'], '400076');
});

test('acknowledge_review: FALSE is not an acknowledgement', async () => {
  // `!== true` rather than a falsy check, and the difference is a client that sends the field
  // wired to an unticked checkbox. That is the user saying no.
  const { useCase } = build();
  const outcome = await useCase.execute(BRANCH, {
    postal_code: '400076',
    acknowledge_review: false,
  });

  assert.equal(outcome.ok, false);
});

test('an IMMEDIATE-only change needs no acknowledgement', async () => {
  const { useCase, patches } = build();
  const outcome = await useCase.execute(BRANCH, { name: 'Andheri West', capacity: 300 });

  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.returnsToReview, false);
  assert.deepEqual(patches[0], { name: 'Andheri West', capacity: 300 });
});

test('returnsToReview reports the rule and does NOT move gyms.status (KL-118)', async () => {
  /*
   * `BR-GYM-06` sends the gym back to `PENDING_REVIEW` *"for those fields while the listing stays
   * live"*. That partial state has no representation in `gyms.status`, which is a single enum —
   * writing it would either pull a live listing down or record a review nobody is doing.
   *
   * So the flag travels out, the owner is told, and `M-032` models the queue.
   */
  const { useCase } = build();
  const outcome = await useCase.execute(BRANCH, { state_code: '29', acknowledge_review: true });

  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.returnsToReview, true);
});

test('acknowledge_review alone is not a field to update', async () => {
  // `Gym.md` 767 spells the rule: `Object.keys(o).some(k => k !== 'acknowledge_review')`. The DTO
  // refuses the body; this asserts the use case would also treat it as touching nothing.
  const { useCase, patches } = build();
  await useCase.execute(BRANCH, { acknowledge_review: true } as never);

  assert.deepEqual(patches[0], {}, 'the acknowledgement flag reached the patch');
});

// ═══════════════════════════════════════════════════════════════════════════
// The patch — what is written, and what is not
// ═══════════════════════════════════════════════════════════════════════════

test('the patch is built from the SENT keys, never by spreading the request', async () => {
  /*
   * Spreading would carry `landmark`, `parking_notes`, `temporary_closure` and
   * `acknowledge_review` into the patch — three fields with no column and one that is not data.
   * The repository would either drop them silently or fail on an unknown column.
   */
  const { useCase, patches } = build();
  await useCase.execute(BRANCH, {
    name: 'Powai',
    landmark: 'near the lake',
    parking_notes: 'basement',
    temporary_closure: { from: '2026-10-20', to: '2026-10-23', reason: 'Diwali' },
    acknowledge_review: true,
  });

  assert.deepEqual(patches[0], { name: 'Powai' }, 'a field with no column reached the repository');
});

test('an explicit null is CARRIED, so a nullable field can be cleared', async () => {
  /*
   * The distinction `BranchPatch` documents: `undefined` means "not sent", `null` means "clear
   * it". Collapse them and `capacity` can never be unset once it has a value — and the repository
   * uses a `CASE WHEN <sent>` per column precisely so this can work.
   */
  const { useCase, patches } = build();
  await useCase.execute(BRANCH, { capacity: null } as never);

  assert.ok('capacity' in patches[0]!, 'the key was dropped, so the column keeps its old value');
  assert.equal(patches[0]?.['capacity'], null);
});

test('wire names become column names — a rename cannot silently stop writing', async () => {
  const { useCase, patches } = build();
  await useCase.execute(BRANCH, {
    address_line1: '2 Hiranandani',
    city_id: '0192de00-7000-7000-8000-0000000000c2',
    state_code: '27',
    acknowledge_review: true,
  });

  assert.deepEqual(Object.keys(patches[0]!).sort(), ['addressLine1', 'cityId', 'stateCode']);
});

// ═══════════════════════════════════════════════════════════════════════════
// Resolution, and the 404 that hides everything
// ═══════════════════════════════════════════════════════════════════════════

test('an unresolvable branch stops before findInGym and before the write', async () => {
  const { useCase, calls } = build({ gymOf: null });
  const outcome = await useCase.execute(BRANCH, { name: 'x' });

  assert.deepEqual(outcome, { ok: false, reason: 'UNKNOWN_BRANCH' });
  assert.deepEqual(calls, [`gymOf:${BRANCH}`]);
});

test('a branch that resolves but is not visible in its gym is also UNKNOWN_BRANCH', async () => {
  // Soft-deleted, most often. One outcome for both, because a caller able to tell "deleted" from
  // "never existed" apart can enumerate ids across the tenant (`A1`).
  const { useCase, calls } = build({ found: false });
  const outcome = await useCase.execute(BRANCH, { name: 'x' });

  assert.deepEqual(outcome, { ok: false, reason: 'UNKNOWN_BRANCH' });
  assert.ok(!calls.includes('update'));
});

test('a row that vanishes between the read and the write is UNKNOWN_BRANCH, not a crash', async () => {
  /*
   * The concurrent-deactivation race. `update()` returns `null` when its `WHERE … AND deleted_at
   * IS NULL` matches nothing, and the use case has to survive it — a `null` dereference here
   * would be a 500 on an ordinary interleaving of two owners' requests.
   */
  const useCase = new UpdateBranchUseCase(
    {
      findInGym: () => Promise.resolve({ ok: true, branch: { id: BRANCH, isPrimary: false } }),
    } as never,
    { gymOf: () => Promise.resolve(GYM) } as never,
    { update: () => Promise.resolve(null) } as never,
  );

  const outcome = await useCase.execute(BRANCH, { name: 'x' });
  assert.deepEqual(outcome, { ok: false, reason: 'UNKNOWN_BRANCH' });
});
