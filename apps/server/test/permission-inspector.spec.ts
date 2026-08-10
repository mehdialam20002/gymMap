/**
 * `M-023` · The effective-permission inspector — `FR-RBAC-05`, `AC-STAF-08.1`, `AC-STAF-08.3`,
 * `AC-EP13-27`, `Security.md` RB5.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHAT `FR-RBAC-05` ACTUALLY ASKS FOR, AS OPPOSED TO WHAT IT SOUNDS LIKE
 *
 * The PRD line is one sentence about INSPECTABILITY — *"A user's effective permissions are
 * inspectable by Super Admin for support purposes"* (§B3.3, priority S). The obligations live in the
 * derived spec, and three of them are things a permission list does not have by default:
 *
 *   `AC-STAF-08.1`  the ROLE and SCOPE that grants each permission — not just the keys
 *   `AC-STAF-08.3`  a permission NOT held says so explicitly, never an empty list
 *   `Security.md` RB5  resolved through the SAME compiled matrix the guard uses, so the console
 *                      cannot disagree with the runtime
 *
 * The existing `effectivePermissions()` satisfies none of the three, and that is not an oversight:
 * it was written for deciding which menu items to render, where the role is noise. This file covers
 * the support answer, where the role is the entire point.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  annotatedEffectivePermissions,
  inspectPermission,
} from '../dist/iam/domain/effective-permissions.js';
import { CAPABILITY_MATRIX, permissionsFor } from '../dist/iam/permissions.js';
import type { RoleGrant } from '../dist/iam/domain/effective-permissions.js';

const TENANT_A = '0192de00-0000-7000-8000-00000000000a';
const TENANT_B = '0192de00-0000-7000-8000-00000000000b';
const BRANCH = '0192de00-0000-7000-8000-0000000000b1';

const ownerOf = (tenantId: string): RoleGrant => ({
  role: 'GYM_OWNER',
  scope: { kind: 'TENANT', tenantId },
});

/** A capability whose owner cell is `FULL`, discovered from the matrix rather than assumed. */
function aFullOwnerCapability() {
  const entry = CAPABILITY_MATRIX.find(
    (row) => row.grants.GYM_OWNER === 'FULL' && row.writeKey !== null,
  );
  assert.ok(entry, 'no capability has GYM_OWNER=FULL with a write key');
  return entry;
}

// ═══════════════════════════════════════════════════════════════════════════
// AC-STAF-08.1 — the role and the scope
// ═══════════════════════════════════════════════════════════════════════════

test('AC-STAF-08.1 — a held permission names the granting role and its scope', () => {
  const entry = aFullOwnerCapability();
  const key = entry.writeKey!;

  const result = inspectPermission([ownerOf(TENANT_A)], key);

  assert.equal(result.held, true);
  if (!result.held) return;

  assert.equal(result.reasons.length, 1);
  const [reason] = result.reasons;
  assert.equal(reason?.role, 'GYM_OWNER');
  assert.deepEqual(reason?.scope, { kind: 'TENANT', tenantId: TENANT_A });
  assert.equal(reason?.capability, entry.capability);
});

test('AC-STAF-08.1 — EVERY reason is reported, not the first one found', () => {
  // ┌─ WHY PLURAL IS THE REQUIREMENT AND NOT A NICETY ───────────────────────────────────────────┐
  // │ Somebody can hold the same permission twice for different reasons — an owner of one gym who │
  // │ is also a manager at another. A support agent told about one reason revokes that grant,      │
  // │ watches access survive, and concludes the screen is lying. The screen has to be exhaustive   │
  // │ or it is worse than absent.                                                                 │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const shared = CAPABILITY_MATRIX.find(
    (row) =>
      row.grants.GYM_OWNER !== 'NONE' &&
      row.grants.GYM_MANAGER !== 'NONE' &&
      (row.readKey ?? row.writeKey) !== null,
  );
  assert.ok(shared, 'no capability is held by both an owner and a manager');
  const key = shared.readKey ?? shared.writeKey!;

  const result = inspectPermission(
    [
      ownerOf(TENANT_A),
      { role: 'GYM_MANAGER', scope: { kind: 'BRANCH', tenantId: TENANT_B, branchId: BRANCH } },
    ],
    key,
  );

  assert.equal(result.held, true);
  if (!result.held) return;

  const roles = result.reasons.map((reason) => reason.role);
  assert.ok(roles.includes('GYM_OWNER'), `owner missing from ${JSON.stringify(roles)}`);
  assert.ok(roles.includes('GYM_MANAGER'), `manager missing from ${JSON.stringify(roles)}`);
});

test('the reasons are ordered, so two calls with the same grants agree', () => {
  // The output is a diffable answer to a support question. Claim order is not meaningful and must
  // not leak into it — otherwise the same user renders differently on two page loads.
  const entry = aFullOwnerCapability();
  const key = entry.writeKey!;
  const manager: RoleGrant = { role: 'GYM_MANAGER', scope: { kind: 'TENANT', tenantId: TENANT_A } };

  const forwards = inspectPermission([ownerOf(TENANT_A), manager], key);
  const backwards = inspectPermission([manager, ownerOf(TENANT_A)], key);

  assert.deepEqual(forwards, backwards);
});

// ═══════════════════════════════════════════════════════════════════════════
// The §B3.2 qualifier — the gap `permissionsFor()` cannot close
// ═══════════════════════════════════════════════════════════════════════════

test('RB5 — the qualifier distinguishes ● FULL from ▪ OWN, which the keys cannot', () => {
  // ┌─ THE CORRECTNESS GAP, NOT A MISSING LABEL ─────────────────────────────────────────────────┐
  // │ `permissionsFor()` yields IDENTICAL keys for FULL and OWN by design — the difference is the  │
  // │ row filter a use case applies, not the capability declared. So a list of keys cannot tell a  │
  // │ support agent whether somebody may edit EVERY member or only their own records, and an       │
  // │ inspector that showed a `▪` grant as full access would report authority nobody has, on the   │
  // │ one screen built to answer that question.                                                    │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const own = CAPABILITY_MATRIX.find((row) =>
    Object.values(row.grants).some((cell) => cell === 'OWN'),
  );
  assert.ok(own, 'no capability has an OWN cell — the matrix changed shape');

  const [role] = Object.entries(own.grants).find(([, cell]) => cell === 'OWN') as [
    keyof typeof own.grants,
    string,
  ];
  const key = own.readKey ?? own.writeKey!;

  // The key alone says nothing about the qualifier — proved, not asserted in prose.
  assert.ok(permissionsFor(role).includes(key), `${role} should hold ${key} through its OWN grant`);

  const result = inspectPermission([{ role, scope: { kind: 'SELF' } }], key);
  assert.equal(result.held, true);
  if (!result.held) return;

  assert.ok(
    result.reasons.some((reason) => reason.qualifier === 'OWN'),
    `expected an OWN qualifier, got ${JSON.stringify(result.reasons.map((r) => r.qualifier))}`,
  );
});

test('a reason NEVER carries the NONE qualifier', () => {
  // A `NONE` reason would state that the principal holds the permission BECAUSE they are denied it.
  // It can only arise if the matrix and `permissionsFor()` disagree about a cell, which is a bug
  // worth failing on rather than rendering.
  for (const role of ['GYM_OWNER', 'RECEPTIONIST', 'MEMBER', 'SUPER_ADMIN'] as const) {
    const grants: RoleGrant[] = [
      { role, scope: { kind: 'PLATFORM' } },
      { role, scope: { kind: 'SELF' } },
    ];
    for (const [, reasons] of annotatedEffectivePermissions(grants)) {
      for (const reason of reasons) {
        assert.notEqual(reason.qualifier, 'NONE', `${role} produced a NONE reason`);
      }
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-STAF-08.3 — the explicit "not held"
// ═══════════════════════════════════════════════════════════════════════════

test('AC-STAF-08.3 — a permission not held says so, rather than being absent', () => {
  // The requirement is about the SHAPE of the answer: "the inspector says so explicitly rather than
  // returning an empty list". An empty array is indistinguishable from a failed lookup.
  const entry = aFullOwnerCapability();
  const result = inspectPermission([{ role: 'MEMBER', scope: { kind: 'SELF' } }], entry.writeKey!);

  assert.equal(result.held, false);
  if (result.held) return;
  assert.equal(result.reason, 'NOT_GRANTED');
  assert.equal(result.permission, entry.writeKey);
});

test('"nobody granted it" and "no such permission" are DIFFERENT answers', () => {
  // ┌─ WHY THIS DISTINCTION EARNS ITS OWN BRANCH ────────────────────────────────────────────────┐
  // │ `UNKNOWN_PERMISSION` is not about the user at all — it is a missing `§B3.2` row or a typo in │
  // │ a route declaration. Collapsing it into "they do not hold it" sends a support agent to fix a │
  // │ grant when the thing to fix is the matrix, and they will not find anything wrong with the    │
  // │ grant, because nothing is.                                                                   │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const owner = [ownerOf(TENANT_A)];

  const typo = inspectPermission(owner, 'catalog.plan.edit'); // the matrix says `.write`
  assert.equal(typo.held, false);
  if (typo.held) return;
  assert.equal(typo.reason, 'UNKNOWN_PERMISSION');

  /*
   * The counterpart key is DERIVED from the matrix, not written from memory. The first version of
   * this test used `admin.tenant.suspend`, which sounds like a capability and is not one — so the
   * test failed with `UNKNOWN_PERMISSION` on both halves and proved nothing about the distinction
   * it exists to check. Finding a real key that an owner genuinely lacks is a query, not a guess.
   */
  const withheld = CAPABILITY_MATRIX.find(
    (row) => row.grants.GYM_OWNER === 'NONE' && (row.readKey ?? row.writeKey) !== null,
  );
  assert.ok(withheld, 'every capability is granted to a gym owner — the matrix changed shape');

  const real = inspectPermission(owner, withheld.readKey ?? withheld.writeKey!);
  assert.equal(real.held, false);
  if (real.held) return;
  assert.equal(
    real.reason,
    'NOT_GRANTED',
    `"${withheld.capability}" is a real matrix key and must not report as unknown`,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// The whole set
// ═══════════════════════════════════════════════════════════════════════════

test('the annotated set holds exactly the permissions the role holds', () => {
  // Cross-checked against `permissionsFor()` — the compiled matrix, which RB5 requires both the
  // guard and this screen to read. Disagreement here IS the "console disagrees with the guard"
  // failure that requirement names.
  const grants = [ownerOf(TENANT_A)];
  const annotated = [...annotatedEffectivePermissions(grants).keys()].sort();

  assert.deepEqual(annotated, [...permissionsFor('GYM_OWNER')].sort());
  assert.ok(annotated.length > 0, 'a gym owner resolved to no permissions at all');
});

test('a principal with NO grants resolves to an empty set, and every lookup is NOT_GRANTED', () => {
  // The zero case answers cleanly rather than throwing: a user whose only role was just revoked is
  // a real state the inspector will be pointed at, and often the exact reason it was opened.
  assert.equal(annotatedEffectivePermissions([]).size, 0);

  const result = inspectPermission([], aFullOwnerCapability().writeKey!);
  assert.equal(result.held, false);
  if (result.held) return;
  assert.equal(result.reason, 'NOT_GRANTED');
});

test('the inspector reads only — the same grants twice give the same answer', () => {
  // `AC-STAF-08.2`: read-only, "it grants nothing, changes nothing". The domain function holds no
  // state and touches no cache, so the strongest available proof at this layer is idempotence over
  // a frozen input; the audit obligation belongs to the use case that will call this.
  const grants = Object.freeze([ownerOf(TENANT_A)]);

  const first = annotatedEffectivePermissions(grants);
  const second = annotatedEffectivePermissions(grants);

  assert.deepEqual([...first.entries()], [...second.entries()]);
});
