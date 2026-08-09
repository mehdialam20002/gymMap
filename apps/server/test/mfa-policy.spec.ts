/**
 * `M-024` · The MFA policy and recovery codes — `FR-AUTH-07`, `NFR-SEC-11`, `Security.md` §2.8.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PLATFORM_STAFF_ROLES,
  RECOVERY_CODE_COUNT,
  mayDisableMfa,
  mayEnrolMfa,
  mfaRequirementFor,
  mfaRequirementForPrincipal,
  shouldPromptRecoveryRegeneration,
} from '../dist/iam/domain/mfa.policy.js';
import {
  generateRecoveryCode,
  generateRecoveryCodes,
  isWellFormedRecoveryCode,
  normaliseRecoveryCode,
} from '../dist/iam/domain/recovery-code.vo.js';
import { ROLE_DEFINITIONS } from '../dist/iam/permissions.js';

// ═══════════════════════════════════════════════════════════════════════════
// Who must, who may, who may not
// ═══════════════════════════════════════════════════════════════════════════

test('NFR-SEC-11 — every PLATFORM-scoped role is mandatory, and the set is derived', () => {
  // ┌─ DERIVED, NOT LISTED, AND THIS TEST IS WHY ────────────────────────────────────────────────┐
  // │ A hand-written list of platform staff is a second source of truth, and it fails silently in │
  // │ the worst direction: add a PLATFORM role to §B3.1, forget the list, and the new role signs   │
  // │ in with no second factor while every other test still passes.                               │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const fromMatrix = ROLE_DEFINITIONS.filter((role) => role.scope === 'PLATFORM').map((r) => r.key);

  assert.deepEqual([...PLATFORM_STAFF_ROLES].sort(), [...fromMatrix].sort());
  assert.equal(PLATFORM_STAFF_ROLES.size, 5, '§B3.1 defines five platform-staff roles');

  for (const role of fromMatrix) {
    assert.equal(mfaRequirementFor(role), 'MANDATORY', `${role} must be mandatory`);
  }
});

test('FR-AUTH-07 — GYM_OWNER is OPTIONAL, and the branch roles are NOT_OFFERED', () => {
  assert.equal(mfaRequirementFor('GYM_OWNER'), 'OPTIONAL');

  // §2.8: excluded in Phase 1 because "a shared front-desk device makes per-staff TOTP an
  // operational problem NFR-USE-09 does not budget for".
  for (const role of ['GYM_MANAGER', 'RECEPTIONIST', 'TRAINER'] as const) {
    assert.equal(mfaRequirementFor(role), 'NOT_OFFERED', `${role} should not be offered TOTP`);
  }

  for (const role of ['MEMBER', 'USER', 'VISITOR'] as const) {
    assert.equal(mfaRequirementFor(role), 'NOT_OFFERED');
  }
});

test('NOT_OFFERED is a THIRD answer, not a synonym for OPTIONAL', () => {
  // Collapsing them means either nagging a receptionist about a factor they cannot use, or letting
  // one enrol and locking a shared front-desk device behind one person's phone.
  assert.equal(mayEnrolMfa(['GYM_OWNER']), true);
  assert.equal(mayEnrolMfa(['RECEPTIONIST']), false);
  assert.equal(mayEnrolMfa(['SUPER_ADMIN']), true);
});

// ═══════════════════════════════════════════════════════════════════════════
// The multi-role case
// ═══════════════════════════════════════════════════════════════════════════

test('E1.3 — the STRONGEST requirement wins when a principal holds several roles', () => {
  // ┌─ THE ESCALATION THIS DIRECTION PREVENTS ───────────────────────────────────────────────────┐
  // │ Somebody can be a SUPPORT_AGENT and also own a gym. Taking the first role, or the weakest,  │
  // │ would let a platform-staff account escape the mandate by ALSO holding a gym role — available │
  // │ to anybody who can be granted one, and it looks like a convenience from the inside.          │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  assert.equal(mfaRequirementForPrincipal(['SUPPORT_AGENT', 'GYM_OWNER']), 'MANDATORY');
  assert.equal(mfaRequirementForPrincipal(['GYM_OWNER', 'SUPPORT_AGENT']), 'MANDATORY');
  assert.equal(mfaRequirementForPrincipal(['RECEPTIONIST', 'SUPER_ADMIN']), 'MANDATORY');

  assert.equal(mfaRequirementForPrincipal(['GYM_OWNER', 'RECEPTIONIST']), 'OPTIONAL');
  assert.equal(mfaRequirementForPrincipal(['MEMBER', 'RECEPTIONIST']), 'NOT_OFFERED');
});

test('a principal with NO roles is NOT_OFFERED rather than an error', () => {
  // They cannot reach a staff surface, so there is nothing to protect and nothing to offer.
  assert.equal(mfaRequirementForPrincipal([]), 'NOT_OFFERED');
  assert.equal(mayEnrolMfa([]), false);
});

// ═══════════════════════════════════════════════════════════════════════════
// Disabling — acceptance criterion 6
// ═══════════════════════════════════════════════════════════════════════════

test('AC-6 — platform staff CANNOT disable the factor, and the refusal is not about permission', () => {
  const verdict = mayDisableMfa(['SUPER_ADMIN']);
  assert.equal(verdict.permitted, false);
  if (verdict.permitted) return;

  // A SUPER_ADMIN holds every permission there is, so a 403 would be a lie about authorisation.
  // What is true is that the domain offers this operation to nobody — the LAST_OWNER_PROTECTED
  // shape, and the reason the criterion specifies 422 with a registry code.
  assert.match(verdict.reason, /mandatory/i);
  assert.match(verdict.reason, /recovery code/i, 'the refusal should say what to do instead');
});

test('a gym owner MAY disable the factor they opted into', () => {
  assert.equal(mayDisableMfa(['GYM_OWNER']).permitted, true);
  assert.equal(mayDisableMfa(['MEMBER']).permitted, true);
  // …but not if they are also staff.
  assert.equal(mayDisableMfa(['GYM_OWNER', 'FINANCE']).permitted, false);
});

// ═══════════════════════════════════════════════════════════════════════════
// Recovery codes
// ═══════════════════════════════════════════════════════════════════════════

test('§2.8 — ten codes, and regeneration is prompted below three remaining', () => {
  assert.equal(RECOVERY_CODE_COUNT, 10);
  assert.equal(generateRecoveryCodes(RECOVERY_CODE_COUNT).length, 10);

  // Three rather than zero, because regeneration invalidates the whole set: a user who waits until
  // the last code is gone has no way to authenticate in order to make more — the exact lockout the
  // codes exist to prevent.
  assert.equal(shouldPromptRecoveryRegeneration(3), false);
  assert.equal(shouldPromptRecoveryRegeneration(2), true);
  assert.equal(shouldPromptRecoveryRegeneration(0), true);
});

test('codes are unique across a generated set', () => {
  const codes = generateRecoveryCodes(50);
  assert.equal(new Set(codes).size, 50, 'the generator repeated a code');
});

test('the alphabet excludes the characters people mistype off paper', () => {
  // Crockford base32: no I, L, O or U. 1/I/l and 0/O are the pairs a support agent reading a
  // printout aloud gets wrong, and both members of the pair being valid is what makes it costly.
  const sample = generateRecoveryCodes(200).join('');
  for (const forbidden of ['I', 'L', 'O', 'U']) {
    assert.ok(!sample.includes(forbidden), `${forbidden} appeared in a recovery code`);
  }
  assert.match(generateRecoveryCode(), /^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
});

test('normalisation folds case and separators, on BOTH sides', () => {
  // Applied at generation before hashing AND at verification, or a code typed exactly as displayed
  // fails to match its own hash.
  const code = generateRecoveryCode();
  const typed = code.toLowerCase().replace('-', ' ');

  assert.equal(normaliseRecoveryCode(typed), normaliseRecoveryCode(code));
  assert.equal(normaliseRecoveryCode(code).length, 10);
  assert.ok(!normaliseRecoveryCode(code).includes('-'));
});

test('a malformed submission is rejected before any hashing work', () => {
  // Argon2id is deliberately slow. Verifying a submission that cannot be a code at all against ten
  // stored hashes is ten Argon2 verifications per request — a free denial-of-service.
  for (const bad of ['', 'ABC', 'ABCDE-FGHIJ-KLMNO', 'ABCDE-FGHIL', '!!!!!-!!!!!', 'ABCDEFGHIJK']) {
    assert.equal(isWellFormedRecoveryCode(bad), false, `"${bad}" was accepted as well-formed`);
  }

  const good = generateRecoveryCode();
  assert.equal(isWellFormedRecoveryCode(good), true);
  assert.equal(isWellFormedRecoveryCode(good.toLowerCase()), true);
});
