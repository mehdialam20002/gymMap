/**
 * `M-028` · The `§C4.4` lifecycle — `FR-ONB-09`, `BR-GYM-01`, `BR-GYM-03`, `RSK-01`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * `AC-1` ASKS FOR EVERY ILLEGAL TRANSITION, AND THIS IS WHERE THEY BELONG
 *
 * The table in `domain/` lists only the legal edges, so anything absent is refused and a state
 * added to the enum is unreachable until somebody names its edges. The exhaustiveness the criterion
 * asks for is met HERE: all 8 × 8 pairs are enumerated and each is checked against the expected
 * answer, so the sixty-four cases exist somewhere they can actually be verified rather than as a
 * denylist that goes stale in the permissive direction.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LIFECYCLE_STATES,
  REVIEWER_ROLES,
  availableTransitions,
  canTransition,
  isTerminal,
} from '../dist/onboarding/domain/application.state-machine.js';
import type { Actor, LifecycleState } from '../dist/onboarding/domain/application.state-machine.js';

const OFFICER: Actor = { kind: 'HUMAN', userId: 'u1', role: 'VERIFICATION_OFFICER' };
const ADMIN: Actor = { kind: 'HUMAN', userId: 'u2', role: 'SUPER_ADMIN' };
const OWNER: Actor = { kind: 'HUMAN', userId: 'u3', role: 'GYM_OWNER' };
const JOB: Actor = { kind: 'SYSTEM', job: 'precheck.orchestrator' };

/** The `§C4.4` diagram, transcribed edge by edge from the PRD rather than from the code. */
const LEGAL_EDGES: readonly (readonly [LifecycleState, LifecycleState])[] = [
  ['DRAFT', 'SUBMITTED'],
  ['SUBMITTED', 'UNDER_REVIEW'],
  ['UNDER_REVIEW', 'APPROVED'],
  ['UNDER_REVIEW', 'REJECTED'],
  ['UNDER_REVIEW', 'INFO_REQUESTED'],
  ['INFO_REQUESTED', 'SUBMITTED'],
  ['APPROVED', 'SUSPENDED'],
  ['APPROVED', 'CLOSED'],
  ['REJECTED', 'DRAFT'],
  ['SUSPENDED', 'APPROVED'],
  ['SUSPENDED', 'CLOSED'],
];

const isLegal = (from: LifecycleState, to: LifecycleState): boolean =>
  LEGAL_EDGES.some(([a, b]) => a === from && b === to);

// ═══════════════════════════════════════════════════════════════════════════
// AC-1 — all sixty-four pairs
// ═══════════════════════════════════════════════════════════════════════════

test('§C4.4 has EIGHT states, matching tenant_status_enum', () => {
  // The roadmap says seven. There are eight in the PRD diagram and eight in the enum; asserted so
  // the discrepancy is a failing test if anybody ever "fixes" the list down to seven.
  assert.equal(LIFECYCLE_STATES.length, 8);
  assert.deepEqual([...LIFECYCLE_STATES].sort(), [
    'APPROVED',
    'CLOSED',
    'DRAFT',
    'INFO_REQUESTED',
    'REJECTED',
    'SUBMITTED',
    'SUSPENDED',
    'UNDER_REVIEW',
  ]);
});

test('AC-1 — every one of the 64 pairs matches the PRD diagram', () => {
  // A reviewer with every right is used, so this isolates the TRANSITION table from the actor rule.
  let checked = 0;

  for (const from of LIFECYCLE_STATES) {
    for (const to of LIFECYCLE_STATES) {
      const verdict = canTransition(from, to, ADMIN);
      checked += 1;

      assert.equal(
        verdict.permitted,
        isLegal(from, to),
        `${from} → ${to} should be ${isLegal(from, to) ? 'legal' : 'ILLEGAL'}`,
      );
    }
  }

  // The count is an assertion, not a log line: every check above is inside a loop, and a list that
  // came back empty would report success having verified nothing.
  assert.equal(checked, 64);
});

test('AC-1 — an illegal transition names itself, rather than being silently ignored', () => {
  const verdict = canTransition('DRAFT', 'APPROVED', ADMIN);

  assert.equal(verdict.permitted, false);
  if (verdict.permitted) return;
  assert.equal(verdict.reason, 'ILLEGAL_TRANSITION');
});

test('a self-transition is refused for every state', () => {
  // "Approve an already-approved gym" is a double-submit, not a no-op. Treating it as success would
  // write a second approval audit row for a decision nobody took twice.
  for (const state of LIFECYCLE_STATES) {
    assert.equal(canTransition(state, state, ADMIN).permitted, false, `${state} → ${state}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-5 — the one that RSK-01 depends on
// ═══════════════════════════════════════════════════════════════════════════

test('AC-5 — a SYSTEM actor cannot reach APPROVED, and the refusal says why', () => {
  // ┌─ THE HIGHEST-SCORING RISK IN THE REGISTER ─────────────────────────────────────────────────┐
  // │ `BR-GYM-01`: no gym is listed before a HUMAN approves it. `RSK-01` is fake gyms reaching the │
  // │ marketplace. An automated approval path is that risk realised, and it would arrive as a      │
  // │ helpful precheck orchestrator "auto-approving the obvious ones".                             │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const verdict = canTransition('UNDER_REVIEW', 'APPROVED', JOB);

  assert.equal(verdict.permitted, false);
  if (verdict.permitted) return;
  assert.equal(
    verdict.reason,
    'HUMAN_REVIEWER_REQUIRED',
    'a job was refused for the wrong reason — it must not read as a missing grant',
  );
});

test('AC-5 — a system actor cannot REJECT or request information either', () => {
  // Not only approval. An automated rejection is a gym refused entry with no human accountable for
  // the decision, which `BR-GYM-04`'s reason codes exist to make attributable.
  for (const to of ['REJECTED', 'INFO_REQUESTED'] as const) {
    const verdict = canTransition('UNDER_REVIEW', to, JOB);
    assert.equal(verdict.permitted, false, `a job reached ${to}`);
  }
});

test('BR-GYM-03 — only VERIFICATION_OFFICER and SUPER_ADMIN may decide', () => {
  assert.deepEqual([...REVIEWER_ROLES].sort(), ['SUPER_ADMIN', 'VERIFICATION_OFFICER']);

  assert.equal(canTransition('UNDER_REVIEW', 'APPROVED', OFFICER).permitted, true);
  assert.equal(canTransition('UNDER_REVIEW', 'APPROVED', ADMIN).permitted, true);

  // A gym owner is a human, and that is not enough.
  assert.equal(canTransition('UNDER_REVIEW', 'APPROVED', OWNER).permitted, false);
});

test('a SYSTEM actor CAN make the mechanical transitions', () => {
  // The human rule is scoped to the three review verdicts. A job moving a submission into the queue
  // is not a decision about the gym, and forbidding it would mean no queue could ever be filled.
  assert.equal(canTransition('SUBMITTED', 'UNDER_REVIEW', JOB).permitted, true);
  assert.equal(canTransition('DRAFT', 'SUBMITTED', JOB).permitted, true);
});

// ═══════════════════════════════════════════════════════════════════════════
// The shape of the graph
// ═══════════════════════════════════════════════════════════════════════════

test('CLOSED is the only terminal state', () => {
  // Reopening a closed business is a NEW tenant: its verification is stale, and reviving the old row
  // would satisfy `BR-GYM-01` with an approval nobody re-examined.
  for (const state of LIFECYCLE_STATES) {
    assert.equal(isTerminal(state), state === 'CLOSED', `${state} terminality`);
  }
});

test('SUSPENDED is reversible, which is what makes it different from CLOSED', () => {
  assert.equal(canTransition('APPROVED', 'SUSPENDED', ADMIN).permitted, true);
  assert.equal(canTransition('SUSPENDED', 'APPROVED', ADMIN).permitted, true);
});

test('BR-GYM-05 — a rejection returns to DRAFT rather than being edited in place', () => {
  assert.equal(canTransition('REJECTED', 'DRAFT', ADMIN).permitted, true);
  // …and not straight back into the queue, which would skip the resubmission that creates a new
  // version and leave the reviewer looking at the paperwork they already refused.
  assert.equal(canTransition('REJECTED', 'SUBMITTED', ADMIN).permitted, false);
  assert.equal(canTransition('REJECTED', 'UNDER_REVIEW', ADMIN).permitted, false);
});

test('availableTransitions is actor-aware, and never wider than canTransition', () => {
  // It exists for rendering. If it offered an action the guard then refused, the reviewer would
  // meet an error on a button the product drew for them.
  for (const actor of [ADMIN, OFFICER, OWNER, JOB]) {
    for (const from of LIFECYCLE_STATES) {
      for (const to of availableTransitions(from, actor)) {
        assert.equal(
          canTransition(from, to, actor).permitted,
          true,
          `${from} → ${to} was offered to ${actor.kind} but refused`,
        );
      }
    }
  }

  // A job is offered no verdicts at all from the review state.
  assert.deepEqual(availableTransitions('UNDER_REVIEW', JOB), []);
  assert.deepEqual([...availableTransitions('UNDER_REVIEW', ADMIN)].sort(), [
    'APPROVED',
    'INFO_REQUESTED',
    'REJECTED',
  ]);
});
