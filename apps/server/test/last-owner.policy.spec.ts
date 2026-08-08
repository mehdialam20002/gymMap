/**
 * `M-023` · The last-owner policy — `FR-RBAC-07`, `FR-STAF-09`.
 *
 * The failure this prevents is not a permissions error, it is a LOCKOUT: a tenant with zero owners
 * has nobody able to grant roles, so nobody able to appoint a new owner. The gym cannot fix it
 * itself and a platform operator has to unpick it by hand.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  mayChangeRole,
  mayRevokeOwner,
  type TenantRoleAssignment,
} from '../dist/iam/domain/last-owner.policy.js';

const ANA = 'user-ana';
const BEN = 'user-ben';
const CAI = 'user-cai';

const owner = (userId: string): TenantRoleAssignment => ({ userId, role: 'GYM_OWNER' });
const manager = (userId: string): TenantRoleAssignment => ({ userId, role: 'GYM_MANAGER' });

test('the only owner cannot be removed', () => {
  const verdict = mayRevokeOwner([owner(ANA), manager(BEN)], ANA);
  assert.equal(verdict.permitted, false);
  // The message must name the consequence, not the rule. "Not permitted" sends an owner to support;
  // "add a second owner first" tells them what to do.
  assert.match(verdict.permitted === false ? verdict.reason : '', /only owner/i);
  assert.match(verdict.permitted === false ? verdict.reason : '', /add a second owner/i);
});

test('the only owner cannot be DEMOTED either — the same event, another name', () => {
  // ┌─ THE ONE PEOPLE ACTUALLY REACH FOR ────────────────────────────────────────────────────────┐
  // │ An implementation that guards `DELETE /staff/:id` and not the role dropdown misses this,    │
  // │ and it is the commoner path: changing the last owner to GYM_MANAGER in a form. Both end     │
  // │ with the tenant holding zero owners.                                                        │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  assert.equal(mayChangeRole([owner(ANA)], ANA, 'GYM_MANAGER').permitted, false);
  assert.equal(mayChangeRole([owner(ANA)], ANA, 'RECEPTIONIST').permitted, false);
  assert.equal(mayChangeRole([owner(ANA)], ANA, 'TRAINER').permitted, false);
});

test('a second owner makes both removal and demotion permitted', () => {
  const assignments = [owner(ANA), owner(BEN)];
  assert.equal(mayRevokeOwner(assignments, ANA).permitted, true);
  assert.equal(mayChangeRole(assignments, ANA, 'GYM_MANAGER').permitted, true);
});

test('a NON-owner is always permitted — there is nothing to lose', () => {
  const assignments = [owner(ANA), manager(BEN)];
  assert.equal(mayRevokeOwner(assignments, BEN).permitted, true);
  assert.equal(mayChangeRole(assignments, BEN, 'RECEPTIONIST').permitted, true);
});

test('promoting TO owner is always permitted, including re-assigning the last owner', () => {
  // An idempotent PUT that replays the current state must not fail on the last owner.
  assert.equal(mayChangeRole([owner(ANA)], ANA, 'GYM_OWNER').permitted, true);
  assert.equal(mayChangeRole([owner(ANA), manager(BEN)], BEN, 'GYM_OWNER').permitted, true);
});

test('DISTINCT users, not rows — one person holding owner twice is still one owner', () => {
  // ┌─ THE COUNTING BUG THIS PINS ───────────────────────────────────────────────────────────────┐
  // │ One person can hold `GYM_OWNER` twice: once tenant-wide and once against a branch. Counting │
  // │ ROWS reports two owners where there is one person, so the removal is permitted and the      │
  // │ tenant is emptied — which is the exact lockout this policy exists to prevent, reached       │
  // │ through the check that was supposed to prevent it.                                          │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const twoRowsOnePerson = [owner(ANA), owner(ANA)];
  assert.equal(mayRevokeOwner(twoRowsOnePerson, ANA).permitted, false);

  // And with a genuine second person it opens up again.
  assert.equal(mayRevokeOwner([owner(ANA), owner(ANA), owner(BEN)], ANA).permitted, true);
});

test('a tenant with no owners at all does not refuse — it is already broken, not made worse', () => {
  // Removing a manager from an ownerless tenant is not the event that caused the problem, and
  // refusing it would block the cleanup rather than the cause.
  assert.equal(mayRevokeOwner([manager(BEN), manager(CAI)], BEN).permitted, true);
});

test('an empty tenant is permitted rather than throwing', () => {
  assert.equal(mayRevokeOwner([], ANA).permitted, true);
});
