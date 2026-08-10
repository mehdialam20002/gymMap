/**
 * `M-031` · The branch-deactivation policy — `Gym.md` §12.4, `NFR-USE-06`, `BR-MEM-14`.
 *
 * `NEGATIVE:` these are mostly refusals, which is `BAC-06`'s requirement for a rule whose failure
 * mode is stranding paying members.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  mayDeactivate,
  type DeactivationFacts,
} from '../dist/catalog/domain/branch-deactivation.policy.js';

const branch = (id: string, isPrimary = false) => ({
  id,
  gymId: 'g-1',
  name: id,
  status: 'ACTIVE' as const,
  isPrimary,
});

const facts = (over: Partial<DeactivationFacts> = {}): DeactivationFacts => ({
  gymStatus: 'APPROVED',
  activeBranches: [branch('b-1', true), branch('b-2')],
  branchId: 'b-2',
  affected: { ok: true, count: 0 },
  ...over,
});

// ═══════════════════════════════════════════════════════════════════════════
// The last location of a listed gym
// ═══════════════════════════════════════════════════════════════════════════

test('NEGATIVE: the only active branch of an APPROVED gym is refused', () => {
  const v = mayDeactivate(facts({ activeBranches: [branch('b-1', true)], branchId: 'b-1' }));

  assert.equal(v.permitted, false);
  assert.equal(v.permitted === false ? v.code : '', 'CONFIG_VALIDATION_FAILED');
  // Gym.md: "a listed gym with no location is not a listing." The message must send the owner to
  // the closure flow rather than leaving them to retry the same DELETE.
  assert.match(v.permitted === false && 'reason' in v ? v.reason : '', /Close the gym itself/);
});

test('NEGATIVE: PENDING_REVIEW counts as listed too', () => {
  /*
   * A gym awaiting review with no location is a submission a reviewer cannot assess — `BR-GYM-02`'s
   * approval bar reads the branch. Letting it through turns a clean refusal now into a rejected
   * application later, which costs the owner a resubmission.
   */
  const v = mayDeactivate(
    facts({ gymStatus: 'PENDING_REVIEW', activeBranches: [branch('b-1', true)], branchId: 'b-1' }),
  );
  assert.equal(v.permitted, false);
});

test('a DRAFT gym may close its last branch — it is not listed', () => {
  // The control. Without it, a policy that refused every last-branch closure would look identical
  // to one that reads the status.
  const v = mayDeactivate(
    facts({ gymStatus: 'DRAFT', activeBranches: [branch('b-1', true)], branchId: 'b-1' }),
  );
  assert.equal(v.permitted, true);
});

// ═══════════════════════════════════════════════════════════════════════════
// The count — NFR-USE-06's "real count"
// ═══════════════════════════════════════════════════════════════════════════

test('NEGATIVE: affected members refuse the closure AND the count reaches the verdict', () => {
  const v = mayDeactivate(facts({ affected: { ok: true, count: 1247 } }));

  assert.equal(v.permitted, false);
  assert.equal(v.permitted === false ? v.code : '', 'BRANCH_HAS_ACTIVE_MEMBERSHIPS');
  // `NFR-USE-06`: "states its consequence specifically". Gym.md: a vague "cannot delete" fails
  // review. The number has to survive the decision, or the client cannot render the sentence.
  assert.equal(v.permitted === false && 'memberCount' in v ? v.memberCount : -1, 1247);
});

test('NEGATIVE: an UNAVAILABLE count refuses, and does NOT become zero', () => {
  /*
   * ┌─ THE ASSERTION THIS FILE EXISTS FOR ────────────────────────────────────────────────────────┐
   * │ `memberships` arrives in Sprint 7. A stand-in adapter returning `0` would state, as a fact,  │
   * │ that closing the branch strands nobody — said by something that cannot count. Today nothing │
   * │ is stranded either way; the day the table fills up, a `0` keeps saying "nobody affected" and │
   * │ nothing about adding a table makes anyone re-read the policy.                                 │
   * │                                                                                              │
   * │ `memberCount: null` is what distinguishes "checked, nobody" from "could not check".           │
   * └──────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const v = mayDeactivate(
    facts({ affected: { ok: false, reason: 'memberships arrives at Sprint 7' } }),
  );

  assert.equal(v.permitted, false);
  assert.equal(v.permitted === false ? v.code : '', 'BRANCH_HAS_ACTIVE_MEMBERSHIPS');
  assert.equal(v.permitted === false && 'memberCount' in v ? v.memberCount : -1, null);
  assert.match(
    v.permitted === false && 'unavailableReason' in v ? v.unavailableReason : '',
    /Sprint 7/,
  );
});

test('the last-branch refusal wins over the membership refusal', () => {
  /*
   * Both are true here. An owner told "move 1,247 members first" would spend a week doing it and
   * then meet a refusal no amount of moving members can clear. The unfixable obstacle is the one
   * they have to hear about.
   */
  const v = mayDeactivate(
    facts({
      activeBranches: [branch('b-1', true)],
      branchId: 'b-1',
      affected: { ok: true, count: 1247 },
    }),
  );
  assert.equal(v.permitted === false ? v.code : '', 'CONFIG_VALIDATION_FAILED');
});

// ═══════════════════════════════════════════════════════════════════════════
// The promotion — permission is not a boolean
// ═══════════════════════════════════════════════════════════════════════════

test('closing the PRIMARY names the branch to promote in the same transaction', () => {
  const v = mayDeactivate(facts({ branchId: 'b-1' }));

  assert.equal(v.permitted, true);
  // `uq_branches__one_primary_per_gym` forbids TWO primaries, not zero. A caller that treats
  // permission as a boolean leaves the gym with none, and nothing notices until an invoice needs
  // the canonical address.
  assert.equal(v.permitted === true ? v.promoteToPrimary : '', 'b-2');
});

test('closing a NON-primary promotes nobody', () => {
  const v = mayDeactivate(facts({ branchId: 'b-2' }));
  assert.equal(v.permitted === true ? v.promoteToPrimary : 'x', null);
});

test('the promotion follows activeInGym ordering — the branch that opened first', () => {
  // `others` preserves the caller's ordering, which the repository fixes as primary-first then
  // createdAt ascending. Asserted here so a repository reordering shows up as a policy failure.
  const v = mayDeactivate(
    facts({
      activeBranches: [branch('b-1', true), branch('b-oldest'), branch('b-newer')],
      branchId: 'b-1',
    }),
  );
  assert.equal(v.permitted === true ? v.promoteToPrimary : '', 'b-oldest');
});

test('deactivating an ALREADY-inactive branch is a no-op, not a refusal', () => {
  /*
   * The branch is absent from the active list. `DELETE /v1/tenant/branches/:id` requires an
   * Idempotency-Key, so a retry after a flaky connection is the ORDINARY case — and a refusal here
   * would make it look like a business rule firing on a request that already succeeded.
   */
  const v = mayDeactivate(facts({ branchId: 'b-gone' }));
  assert.equal(v.permitted, true);
  assert.equal(v.permitted === true ? v.promoteToPrimary : 'x', null);
});

test('both refusal codes are registered, or PG-5 fails the build on the route', async () => {
  // The policy names two codes. PG-5 checks emitted codes against the registry, and the runtime
  // filter degrades an unregistered one to a 500 — so an unregistered code does not stay a
  // build problem, it becomes a production one.
  const { ERROR_REGISTRY } = await import('@gymmap/types');

  for (const code of ['BRANCH_HAS_ACTIVE_MEMBERSHIPS', 'CONFIG_VALIDATION_FAILED']) {
    assert.ok(code in ERROR_REGISTRY, `${code} has no registry row`);
    assert.equal(
      (ERROR_REGISTRY as Record<string, { httpStatus: number }>)[code]?.httpStatus,
      422,
      `${code} must be 422 — API_Catalog.md §6.6 and §6.13`,
    );
  }
});
