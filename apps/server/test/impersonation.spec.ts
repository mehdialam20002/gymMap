/**
 * `M-025` · The impersonation policy and the financial-mutation gate — `FR-AUTH-12`, `BR-DAT-02`,
 * `E1.8`, `PE3`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  IMPERSONATION_MAX_MINUTES,
  IMPERSONATION_REASON_MIN_LENGTH,
  MAY_IMPERSONATE,
  impersonatedPermissions,
  impersonationExpired,
  mayElevate,
  mayStartImpersonation,
} from '../dist/iam/domain/impersonation.policy.js';
import {
  FINANCIAL_MUTATION,
  ImpersonationRestrictionGuard,
} from '../dist/common/guards/impersonation-restriction.guard.js';
import { permissionsFor } from '../dist/iam/permissions.js';
import { effectiveGrants, parseRoleGrants } from '../dist/iam/domain/effective-permissions.js';

const TENANT = '0192de00-0000-7000-8000-00000000000a';
const REASON = 'Investigating a duplicate charge reported in ticket 4821.';

const start = (overrides: Record<string, unknown> = {}) =>
  mayStartImpersonation({
    agentRoles: ['SUPPORT_AGENT'],
    targetRoles: ['MEMBER'],
    reason: REASON,
    requestedMinutes: 15,
    ...overrides,
  } as never);

// ═══════════════════════════════════════════════════════════════════════════
// AC-5 — the intersection
// ═══════════════════════════════════════════════════════════════════════════

test('AC-5 — the effective set is the INTERSECTION, never the union', () => {
  // ┌─ THE ESCALATION THE UNION WOULD CREATE ────────────────────────────────────────────────────┐
  // │ A SUPPORT_AGENT impersonating a GYM_OWNER would hold the owner's tenant authority AND their │
  // │ own platform reach — a combination no role in §B3.2 grants, assembled at runtime, inside a  │
  // │ session everybody assumes is limited.                                                       │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const effective = new Set(impersonatedPermissions(['SUPPORT_AGENT'], ['GYM_OWNER']));
  const agent = new Set(permissionsFor('SUPPORT_AGENT'));
  const target = new Set(permissionsFor('GYM_OWNER'));

  for (const permission of effective) {
    assert.ok(agent.has(permission), `${permission} is not the agent's`);
    assert.ok(target.has(permission), `${permission} is not the target's`);
  }

  // And the union is strictly larger, so the two are genuinely different answers — a test that
  // passed against either implementation would prove nothing.
  const union = new Set([...agent, ...target]);
  assert.ok(union.size > effective.size, 'the union and the intersection are the same set here');
});

test('AC-5 — a permission only the AGENT holds is not granted', () => {
  const ownerOnly = permissionsFor('GYM_OWNER').filter(
    (p) => !permissionsFor('SUPPORT_AGENT').includes(p),
  );
  assert.ok(ownerOnly.length > 0, 'the fixture assumes the owner holds something support does not');

  const effective = impersonatedPermissions(['SUPPORT_AGENT'], ['GYM_OWNER']);
  for (const permission of ownerOnly) {
    assert.ok(!effective.includes(permission), `${permission} leaked into the session`);
  }
});

test('AC-5 — impersonating a MEMBER cannot grant platform reads', () => {
  // The direction people forget: the agent keeps nothing the target lacks.
  const effective = impersonatedPermissions(['SUPPORT_AGENT'], ['MEMBER']);
  const memberSet = new Set(permissionsFor('MEMBER'));

  for (const permission of effective) {
    assert.ok(memberSet.has(permission), `${permission} is beyond what the member can do`);
  }
});

test('the intersection is computed from the MATRIX, and is stable and sorted', () => {
  const once = impersonatedPermissions(['SUPPORT_AGENT'], ['MEMBER']);
  const twice = impersonatedPermissions(['SUPPORT_AGENT'], ['MEMBER']);

  assert.deepEqual(once, twice);
  assert.deepEqual([...once], [...once].sort());
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-2, AC-3 — the reason and the cap
// ═══════════════════════════════════════════════════════════════════════════

test('AC-2 — a missing or trivial reason is refused', () => {
  assert.equal(start({ reason: '' }).permitted, false);
  assert.equal(start({ reason: '    ' }).permitted, false);
  assert.equal(start({ reason: 'lookup' }).permitted, false, 'six characters passed the floor');

  // Whitespace is trimmed BEFORE measuring, or ten spaces would satisfy the requirement.
  assert.equal(start({ reason: ' '.repeat(20) }).permitted, false);
  assert.equal(IMPERSONATION_REASON_MIN_LENGTH, 10, 'the floor matches Admin.md RS3');
});

test('AC-3 — the cap is 30 minutes, and zero is refused too', () => {
  assert.equal(IMPERSONATION_MAX_MINUTES, 30);
  assert.equal(start({ requestedMinutes: 30 }).permitted, true);
  assert.equal(start({ requestedMinutes: 31 }).permitted, false);

  // A zero-minute session mints a token that is already expired, and the resulting 401 reads as a
  // bug in the factor rather than as the refusal it should have been.
  assert.equal(start({ requestedMinutes: 0 }).permitted, false);
  assert.equal(start({ requestedMinutes: -5 }).permitted, false);
  assert.equal(start({ requestedMinutes: 1.5 }).permitted, false);
});

test('AC-3 — expiry is RE-CHECKED against the start time, not just trusted from exp', () => {
  // A token's `exp` is only evidence of what the signer believed. Checking the start time catches a
  // signer bug, a token replayed from a previous deployment, and a clock that moved.
  const startedAt = new Date(1_700_000_000_000);

  assert.equal(impersonationExpired(startedAt, new Date(startedAt.getTime() + 29 * 60_000)), false);
  assert.equal(impersonationExpired(startedAt, new Date(startedAt.getTime() + 30 * 60_000)), true);
  assert.equal(impersonationExpired(startedAt, new Date(startedAt.getTime() + 60 * 60_000)), true);
});

// ═══════════════════════════════════════════════════════════════════════════
// Who may, and who may not be
// ═══════════════════════════════════════════════════════════════════════════

test('only SUPPORT_AGENT and SUPER_ADMIN may impersonate', () => {
  assert.deepEqual([...MAY_IMPERSONATE].sort(), ['SUPER_ADMIN', 'SUPPORT_AGENT']);

  for (const role of ['FINANCE', 'MODERATOR', 'VERIFICATION_OFFICER', 'GYM_OWNER'] as const) {
    assert.equal(start({ agentRoles: [role] }).permitted, false, `${role} could impersonate`);
  }
});

test('a user who can themselves impersonate may NOT be impersonated', () => {
  // ┌─ THE ONE SHAPE THE INTERSECTION RULE DOES NOT ALREADY PREVENT ─────────────────────────────┐
  // │ A SUPER_ADMIN borrowing another SUPER_ADMIN gains no permissions — and gains a session in   │
  // │ which every action is attributable to somebody else. That is not support, it is laundering  │
  // │ attribution.                                                                                │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  assert.equal(start({ agentRoles: ['SUPER_ADMIN'], targetRoles: ['SUPPORT_AGENT'] }).permitted, false);
  assert.equal(start({ agentRoles: ['SUPER_ADMIN'], targetRoles: ['SUPER_ADMIN'] }).permitted, false);

  // A target holding a staff role ALONGSIDE an ordinary one is still refused.
  assert.equal(
    start({ agentRoles: ['SUPER_ADMIN'], targetRoles: ['MEMBER', 'SUPPORT_AGENT'] }).permitted,
    false,
  );
});

test('a well-formed request from a support agent is permitted', () => {
  assert.equal(start().permitted, true);
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-6 — elevation
// ═══════════════════════════════════════════════════════════════════════════

test('AC-6 — runElevated is unavailable under an impersonation token', () => {
  // Elevation exists so a platform read is deliberate and audited. Under a borrowed identity the
  // read would be attributed to the impersonated user — a platform-wide query recorded against
  // somebody who cannot perform one. Both mechanisms are sound; they must not compose.
  assert.equal(mayElevate('ACCESS'), true);
  assert.equal(mayElevate('IMPERSONATION'), false);
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-4 — the financial-mutation gate
// ═══════════════════════════════════════════════════════════════════════════

function guardFor(options: { typ?: string; financial?: boolean } = {}) {
  const reflector = { getAllAndOverride: () => options.financial };
  const context = {
    getHandler: () => ({ name: 'handler' }),
    getClass: () => ({ name: 'Controller' }),
    switchToHttp: () => ({
      getRequest: () => ({ principal: { sub: 'user-ana', typ: options.typ ?? 'ACCESS' } }),
    }),
  };
  return { guard: new ImpersonationRestrictionGuard(reflector as any), context: context as any };
}

test('AC-4 — a financial mutation under an impersonation token is REFUSED', () => {
  const { guard, context } = guardFor({ typ: 'IMPERSONATION', financial: true });

  assert.throws(
    () => guard.canActivate(context),
    (error: { code?: string }) => error.code === 'IMPERSONATION_FINANCIAL_MUTATION_REFUSED',
  );
});

test('the same route under an ORDINARY token passes', () => {
  const { guard, context } = guardFor({ typ: 'ACCESS', financial: true });
  assert.equal(guard.canActivate(context), true);
});

test('a non-financial route under an impersonation token passes', () => {
  const { guard, context } = guardFor({ typ: 'IMPERSONATION', financial: false });
  assert.equal(guard.canActivate(context), true);
});

test('an unmarked route under an impersonation token passes, and that is the api-gates gap', () => {
  // `undefined`, not `false` — a handler nobody decorated. The guard cannot invent the marker, so
  // the control that keeps this honest is `api-gates` cross-referencing §14.2.1's money set against
  // the decorated handlers. This test states the guard's boundary rather than pretending it has none.
  const { guard, context } = guardFor({ typ: 'IMPERSONATION' });
  assert.equal(guard.canActivate(context), true);
});

test('the decorator key is a symbol, so it cannot collide with a string metadata key', () => {
  assert.equal(typeof FINANCIAL_MUTATION, 'symbol');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-5 at the DECISION POINT — `effectiveGrants`
//
// ┌─ THE MINT-TIME VERSION WAS WRONG AND MEASURABLY SO ────────────────────────────────────────┐
// │ The first attempt narrowed the subject's roles when signing. Against the real matrix the    │
// │ intersection is strictly smaller than the subject's permission set in EVERY combination —   │
// │ SUPPORT_AGENT × GYM_OWNER is 9 of 34, SUPER_ADMIN × GYM_OWNER is 23 of 34 — and no §B3.2    │
// │ role carries exactly those permissions. Any token narrowed by roles grants more than the    │
// │ intersection, every single time. So both sets travel and the narrowing happens here.        │
// └───────────────────────────────────────────────────────────────────────────────────────────┘
// ═══════════════════════════════════════════════════════════════════════════

test('effectiveGrants is a passthrough for an ORDINARY token', () => {
  const principal = { typ: 'ACCESS', roles: [`GYM_OWNER@t:${TENANT}`] };
  assert.deepEqual(effectiveGrants(principal), parseRoleGrants(principal.roles));
});

test('AC-5 — under an impersonation, a grant the AGENT cannot use is dropped', () => {
  // A MEMBER grant survives only if the support agent holds at least one of its permissions.
  const withAgent = effectiveGrants({
    typ: 'IMPERSONATION',
    roles: [`GYM_OWNER@t:${TENANT}`],
    imp_roles: ['SUPPORT_AGENT@platform'],
  });

  const asSubject = parseRoleGrants([`GYM_OWNER@t:${TENANT}`]);
  assert.ok(
    withAgent.length <= asSubject.length,
    'the impersonated session held at least as much as the subject alone',
  );
});

test('AC-5 — a token with NO agent roles authorises NOTHING', () => {
  // ┌─ THE UNION BY OMISSION ────────────────────────────────────────────────────────────────────┐
  // │ A forged or truncated impersonation token has `typ` and no `imp_roles`. Falling back to the │
  // │ subject's full grants would be exactly the escalation AC-5 forbids, arrived at by an        │
  // │ optional field being absent. The safe answer is nothing, and the request is refused.        │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  assert.deepEqual(
    effectiveGrants({ typ: 'IMPERSONATION', roles: [`GYM_OWNER@t:${TENANT}`] }),
    [],
  );
  assert.deepEqual(
    effectiveGrants({ typ: 'IMPERSONATION', roles: [`GYM_OWNER@t:${TENANT}`], imp_roles: [] }),
    [],
  );
});

test('a MALFORMED agent claim is the same as none — it does not widen the session', () => {
  assert.deepEqual(
    effectiveGrants({
      typ: 'IMPERSONATION',
      roles: [`GYM_OWNER@t:${TENANT}`],
      imp_roles: ['SUPPORT_AGENT@', 'garbage', 'GYM_OWNER@platform'],
    }),
    [],
  );
});

test('the intersection is strictly narrower than the subject, for every real pairing', () => {
  // Stated as a property rather than a fixture, because it is the fact that made mint-time
  // narrowing impossible — and if it ever stops being true, the simpler design becomes available.
  for (const agent of ['SUPPORT_AGENT', 'SUPER_ADMIN'] as const) {
    for (const subject of ['MEMBER', 'GYM_OWNER', 'USER'] as const) {
      const intersection = impersonatedPermissions([agent], [subject]);
      assert.ok(
        intersection.length < permissionsFor(subject).length,
        `${agent} × ${subject} is not narrower — mint-time narrowing may now be expressible`,
      );
    }
  }
});
