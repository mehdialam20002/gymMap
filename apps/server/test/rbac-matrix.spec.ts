/**
 * M-019 · The §B3.2 permission matrix, checked against the PRD itself — `FR-RBAC-01`, `§B3.1`.
 *
 * ┌─ THE SOURCE OF TRUTH IS THE DOCUMENT, AND THIS SUITE ENFORCES THAT ─────────────────────────┐
 * │ `iam/permissions.ts` holds 45 capabilities × 12 roles = 540 authorisation cells. Asserting  │
 * │ that the array has 42 entries proves the file parses and nothing else. So this suite        │
 * │ RE-PARSES `MASTER_PRD.md` §B3.2 at run time and compares every cell.                         │
 * │                                                                                              │
 * │ The failure it exists to catch is a single glyph: one `—` transcribed as `●` gives a         │
 * │ receptionist the ability to publish plans to the marketplace, and nothing about the diff     │
 * │ looks like a privilege escalation. It is also the failure most likely to be introduced       │
 * │ later, by someone editing the PRD and not the code, or the code and not the PRD.             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  CAPABILITY_MATRIX,
  PERMISSION_KEYS,
  ROLE_DEFINITIONS,
  describePermission,
  parsePermissionKey,
  permissionsFor,
  rolePermissionPairs,
} from '../dist/iam/permissions.js';
import {
  PLATFORM_ROLES,
  PLATFORM_SCOPES,
  ROLE_SCOPES,
  type MatrixGrant,
  type PlatformRole,
} from '../dist/iam/types/iam.types.js';

function repoRoot(): string {
  let dir = process.cwd();
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`could not locate the repository root from ${process.cwd()}`);
}

/**
 * The 23 §C1.3 modules, read from the filesystem rather than from a list.
 *
 * `module-structure.mjs` holds the canonical array and already asserts that `apps/server/src`
 * contains exactly those 23 directories. Reading the directories here means this suite checks a
 * permission key against what actually exists, and cannot pass by agreeing with a second copy
 * of the list that is itself wrong.
 */
const MODULES: readonly string[] = readdirSync(resolve(repoRoot(), 'apps/server/src'), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

/** §B3.2's column order, which is NOT §B3.1's row order. Transcribing between them is the risk. */
const MATRIX_COLUMNS: PlatformRole[] = [
  'VISITOR',
  'USER',
  'MEMBER',
  'RECEPTIONIST',
  'TRAINER',
  'GYM_MANAGER',
  'GYM_OWNER',
  'SUPPORT_AGENT',
  'VERIFICATION_OFFICER',
  'FINANCE',
  'MODERATOR',
  'SUPER_ADMIN',
];

const GLYPH: Record<string, MatrixGrant> = {
  '●': 'FULL', // ● full
  '▪': 'OWN', // ▪ own/assigned records only
  '○': 'READ', // ○ read only
  '—': 'NONE', // — none
};

interface PrdRow {
  readonly capability: string;
  readonly cells: readonly string[];
}

/** Parses §B3.2 out of the PRD. Fails loudly rather than returning an empty list. */
function parsePrdMatrix(): PrdRow[] {
  const lines = readFileSync(resolve(repoRoot(), 'docs/MASTER_PRD.md'), 'utf8').split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith('### B3.2'));
  assert.notEqual(start, -1, '§B3.2 is not in MASTER_PRD.md — the heading moved or was renamed');

  const rows: PrdRow[] = [];
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line.startsWith('### B3.3')) break;
    if (!line.startsWith('| ')) continue;

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    // 1 label + 12 roles. Anything else is the legend line or the alignment row.
    if (cells.length !== 13) continue;
    if (cells[0] === 'Capability' || cells[0]!.startsWith(':')) continue;

    rows.push({ capability: cells[0]!, cells: cells.slice(1) });
  }

  assert.ok(rows.length > 0, '§B3.2 parsed to zero rows — the table format changed');
  return rows;
}

const PRD = parsePrdMatrix();

// ═══════════════════════════════════════════════════════════════════════════
// §B3.1 — the twelve roles.
// ═══════════════════════════════════════════════════════════════════════════

test('§B3.1 · exactly twelve roles, and they match the PRD row for row', () => {
  const lines = readFileSync(resolve(repoRoot(), 'docs/MASTER_PRD.md'), 'utf8').split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith('### B3.1'));
  const parsed: { key: string; scope: string; description: string }[] = [];

  for (let i = start; i < lines.length; i += 1) {
    if (lines[i]!.startsWith('### B3.2')) break;
    if (!lines[i]!.startsWith('| `')) continue;
    const cells = lines[i]!.split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length !== 3) continue;
    parsed.push({
      key: cells[0]!.replace(/`/g, ''),
      scope: cells[1]!,
      description: cells[2]!,
    });
  }

  assert.equal(parsed.length, 12, 'the PRD no longer lists twelve roles');
  assert.deepEqual(
    ROLE_DEFINITIONS.map((r) => r.key),
    parsed.map((p) => p.key),
    'ROLE_DEFINITIONS and §B3.1 disagree on which roles exist, or on their order',
  );
  assert.deepEqual(
    ROLE_DEFINITIONS.map((r) => r.description),
    parsed.map((p) => p.description),
    'a role description drifted from §B3.1',
  );
});

test('§B3.1 · the PRD Scope column maps onto the five ck_roles__scope values', () => {
  // The PRD writes "Branch(es)" and "Public"; the column is a closed five-value set. The mapping
  // is asserted rather than assumed, because a role landing in the wrong scope is the whole
  // (role, scope, resource, action) evaluation going wrong at once.
  const expected: Record<string, string> = {
    VISITOR: 'PUBLIC',
    USER: 'SELF',
    MEMBER: 'SELF',
    GYM_OWNER: 'TENANT',
    GYM_MANAGER: 'BRANCH',
    RECEPTIONIST: 'BRANCH',
    TRAINER: 'BRANCH',
    SUPER_ADMIN: 'PLATFORM',
    VERIFICATION_OFFICER: 'PLATFORM',
    SUPPORT_AGENT: 'PLATFORM',
    FINANCE: 'PLATFORM',
    MODERATOR: 'PLATFORM',
  };

  for (const role of ROLE_DEFINITIONS) {
    assert.equal(role.scope, expected[role.key], `${role.key} has the wrong scope`);
    assert.ok(ROLE_SCOPES.includes(role.scope), `${role.scope} is not a ck_roles__scope value`);
  }
});

test('PLATFORM_ROLES and ROLE_DEFINITIONS cannot drift apart', () => {
  assert.deepEqual([...PLATFORM_ROLES].sort(), ROLE_DEFINITIONS.map((r) => r.key).sort());
});

// ═══════════════════════════════════════════════════════════════════════════
// §B3.2 — all 540 cells.
// ═══════════════════════════════════════════════════════════════════════════

test('§B3.2 · the capability list matches the PRD, in order', () => {
  assert.deepEqual(
    CAPABILITY_MATRIX.map((c) => c.capability),
    PRD.map((r) => r.capability),
    'a §B3.2 row was added, removed or reordered in one place and not the other',
  );
});

test('§B3.2 · every one of the 540 cells matches the PRD glyph', () => {
  const mismatches: string[] = [];

  for (const [row, prdRow] of PRD.entries()) {
    const code = CAPABILITY_MATRIX[row];
    assert.ok(code, `no code row for "${prdRow.capability}"`);

    for (const [column, glyph] of prdRow.cells.entries()) {
      const role = MATRIX_COLUMNS[column]!;
      const expected = GLYPH[glyph];
      assert.ok(expected, `unknown legend glyph "${glyph}" at "${prdRow.capability}" / ${role}`);

      if (code.grants[role] !== expected) {
        mismatches.push(
          `  "${prdRow.capability}" / ${role}: PRD says ${glyph} (${expected}), ` +
            `code says ${code.grants[role]}`,
        );
      }
    }
  }

  assert.deepEqual(
    mismatches,
    [],
    `the code and §B3.2 disagree on ${mismatches.length} cell(s):\n${mismatches.join('\n')}\n\n` +
      'One glyph is one privilege change. Fix whichever side is wrong — do not "sync" the code ' +
      'to the document without reading which direction the change was meant to go.',
  );
});

test('§B3.2 · every role appears in every row — NONE is written out, never omitted', () => {
  // An absent key would read as `undefined`, and `undefined !== 'NONE'` in some future
  // comparison is the kind of thing that grants rather than denies.
  for (const capability of CAPABILITY_MATRIX) {
    for (const role of PLATFORM_ROLES) {
      assert.ok(
        capability.grants[role] !== undefined,
        `"${capability.capability}" has no cell for ${role}`,
      );
    }
    assert.equal(Object.keys(capability.grants).length, 12);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// The permission keys.
// ═══════════════════════════════════════════════════════════════════════════

test('every permission key is <module>.<resource>.<action> with a REAL module', () => {
  // PG-3's shape, and the first segment must be one of the 23 §C1.3 module folders — a key
  // under a module that does not exist can never be declared by a route, so it guards nothing.
  for (const key of PERMISSION_KEYS) {
    const parsed = parsePermissionKey(key);
    assert.ok(
      MODULES.includes(parsed.module),
      `"${key}" names module "${parsed.module}", which is not one of the 23 of §C1.3`,
    );
  }
});

test('keys are unique, and a capability never reuses its read key as its write key', () => {
  assert.equal(new Set(PERMISSION_KEYS).size, PERMISSION_KEYS.length);
  for (const capability of CAPABILITY_MATRIX) {
    if (capability.readKey !== null && capability.writeKey !== null) {
      assert.notEqual(
        capability.readKey,
        capability.writeKey,
        `"${capability.capability}" has the same key for read and write, so ○ and ● are the same`,
      );
    }
    assert.ok(
      capability.readKey !== null || capability.writeKey !== null,
      `"${capability.capability}" declares no permission key at all`,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// `extraReadKeys` — §5.6's plural, and the guard that keeps it from being abused.
// ═══════════════════════════════════════════════════════════════════════════

test('an extra read key may only hang off a capability ONE role holds', () => {
  /*
   * ┌─ THIS IS THE ANTI-CAPABILITY-SHOPPING GATE, AND IT IS DELIBERATELY STRICT ──────────────────┐
   * │ `permissionsFor()` emits a capability's read keys for every grant that is not `NONE`. With  │
   * │ 42 rows available, any desired holder set can be legalised by naming whichever row happens  │
   * │ to contain it — which is how a `BLK-19` draft produced four latent privilege escalations,   │
   * │ every one of them on a row with SEVERAL non-`NONE` holders (`SUPPORT ○`, `VERIF ○`,         │
   * │ `GYM_MANAGER ▪`).                                                                            │
   * │                                                                                             │
   * │ On a SINGLETON row the mechanism cannot fire: there is exactly one role to widen to, and it │
   * │ already holds the row. So `extraReadKeys` is confined to singletons, and an attribution to  │
   * │ a multi-holder row has to come here and change this test — which is the point. The widening │
   * │ stops being a silent consequence of an edit elsewhere and becomes something somebody wrote  │
   * │ down. `RB2` is the real answer and `RB2` is unbuilt; this is what stands in until it exists.│
   * └─────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  for (const capability of CAPABILITY_MATRIX) {
    const extras = [...(capability.extraReadKeys ?? []), ...(capability.extraWriteKeys ?? [])];
    if (extras.length === 0) continue;

    const holders = PLATFORM_ROLES.filter((r) => capability.grants[r] !== 'NONE');
    if (holders.length === 1) continue;

    const justification = JUSTIFIED_MULTI_HOLDER[capability.capability];
    assert.ok(
      justification !== undefined,
      `"${capability.capability}" carries extra keys and is held by ${String(holders.length)} ` +
        `roles (${holders.join(', ')}). Every one of them gains ${extras.join(', ')} mechanically. ` +
        `If that is genuinely intended, add a JUSTIFIED_MULTI_HOLDER entry citing the rank-2 source ` +
        `that names those holders — do not widen the row to fit a wanted key.`,
    );
  }
});

/**
 * Multi-holder rows that MAY carry extra keys, each with the rank-2 source that put the holders
 * there. `ADR-0047`.
 *
 * ┌─ WHY AN ALLOWLIST RATHER THAN DELETING THE GATE ─────────────────────────────────────────────┐
 * │ `ADR-0043` confined extra keys to singleton rows, because on a singleton the widening         │
 * │ mechanism cannot fire — there is no second role to widen to. `ADR-0047` needs one multi-holder│
 * │ row: `API_Catalog.md` freezes five strings for the five branch routes, and *Add / remove      │
 * │ branch* is now held by five roles.                                                             │
 * │                                                                                               │
 * │ Deleting the gate would have been the easy move and would have thrown away the only thing     │
 * │ standing between this matrix and capability shopping until `RB2` exists. An allowlist keeps    │
 * │ the default strict and makes each exception a line somebody wrote, reviewed, and cited.        │
 * └───────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const JUSTIFIED_MULTI_HOLDER: Record<string, string> = {
  'Impersonate user':
    'MASTER_PRD.md §B3.2 row 38, unamended — SUPPORT_AGENT and SUPER_ADMIN, both FULL, exactly as ' +
    'they were. The extra key is `iam.impersonation.end`, which API_Catalog.md 724 freezes on the ' +
    'route that ENDS a session the same two roles started. Widening is not possible in a ' +
    'meaningful sense: whoever may begin an impersonation must be able to end it, and MAY_IMPERSONATE ' +
    'in impersonation.policy.ts is the real control on who that is (Security.md IM-1).',
  'Add / remove branch':
    'MASTER_PRD.md §B3.2 row 20, amended 2026-08-10 under Part C §C10 (ADR-0047). RECEPTIONIST, ' +
    'TRAINER and GYM_MANAGER hold READ; GYM_OWNER and SUPER_ADMIN hold FULL. The three READ cells ' +
    'reach catalog.branch.read and .list and CANNOT reach .create, .update or .deactivate, which ' +
    'is asserted per role below — so the widening this gate exists to catch does not occur here.',
};

test('every JUSTIFIED_MULTI_HOLDER entry names a capability that still exists', () => {
  // An allowlist keyed by a string drifts silently when the string changes: the entry stops
  // matching, the gate goes back to strict, and the build fails somewhere else with a confusing
  // message. This makes the stale key itself the failure.
  for (const name of Object.keys(JUSTIFIED_MULTI_HOLDER)) {
    assert.ok(
      CAPABILITY_MATRIX.some((c) => c.capability === name),
      `JUSTIFIED_MULTI_HOLDER names "${name}", which is in no §B3.2 row`,
    );
  }
});

test('ADR-0047 — a READ cell on Add / remove branch is the LIST, never a branch mutation', () => {
  /*
   * The single most consequential cell in this amendment. `BLK-19` was open on whether
   * `RECEPTIONIST` and `TRAINER` may see the branch list; the owner said yes. What they must NOT
   * gain in the same stroke is the power to create, rename or deactivate a branch — and the only
   * thing separating those is the `READ` grant, three characters in one cell.
   *
   * Asserted per role and per key rather than as a spot check, because the failure is silent: a
   * `READ` quietly becoming `OWN` reads as a small edit and hands a receptionist branch deletion.
   */
  const READ_ONLY: PlatformRole[] = ['RECEPTIONIST', 'TRAINER', 'GYM_MANAGER'];
  const MUTATIONS = ['catalog.branch.create', 'catalog.branch.update', 'catalog.branch.deactivate'];

  for (const role of READ_ONLY) {
    const held = permissionsFor(role);
    assert.ok(held.includes('catalog.branch.list'), `${role} cannot list branches`);
    assert.ok(held.includes('catalog.branch.read'), `${role} cannot read a branch`);
    for (const mutation of MUTATIONS) {
      assert.ok(!held.includes(mutation), `${role} can ${mutation} — a READ cell reached a write`);
    }
  }

  // And the owner keeps all five, or the amendment has taken something away rather than added.
  const owner = permissionsFor('GYM_OWNER');
  for (const key of ['catalog.branch.list', 'catalog.branch.read', ...MUTATIONS]) {
    assert.ok(owner.includes(key), `GYM_OWNER lost ${key}`);
  }
});

test('ADR-0047 — SUPER_ADMIN may review an application but never author one', () => {
  /*
   * `BR-GYM-03` requires a human approval. A platform actor who can AUTHOR an application can
   * approve an artefact they wrote themselves, and the approval stops meaning anything.
   *
   * This is the cell most likely to be "corrected" by someone who assumes SUPER_ADMIN holds
   * everything — so it is asserted in both directions: the write is absent, the review is present.
   */
  const superAdmin = permissionsFor('SUPER_ADMIN');
  assert.ok(
    !superAdmin.includes('onboarding.application.submit'),
    'SUPER_ADMIN can submit a gym application, so it could approve one it wrote (BR-GYM-03)',
  );
  assert.ok(
    superAdmin.includes('onboarding.application_decision.create'),
    'SUPER_ADMIN has lost the reviewing half, which is the half it is supposed to have',
  );

  const owner = permissionsFor('GYM_OWNER');
  assert.ok(
    owner.includes('onboarding.application.submit'),
    'GYM_OWNER cannot submit its own form',
  );
  assert.ok(
    !owner.includes('onboarding.application_decision.create'),
    'GYM_OWNER can decide its own application',
  );
});

test('catalog.branch.write is gone — a key on no route is an ungoverned grant', () => {
  // `Security.md` §3.3.1 gives row 20 exactly one write string, `catalog.branch.write`, and it
  // appears on no route in `API_Catalog.md`. §5.6: "a permission with no capability row is an
  // ungoverned grant" — the converse is just as true, and PG-7 cannot see a key no route declares.
  assert.ok(!PERMISSION_KEYS.includes('catalog.branch.write'));
});

test('FR-RBAC-05 — the effective-permission inspector reaches SUPER_ADMIN and nobody else', () => {
  /*
   * `MASTER_PRD.md` 1174 is rank 2 and names the holder: *"A user's effective permissions are
   * inspectable by **Super Admin** for support purposes."* `ADR-0043` (`BLK-11`).
   *
   * All twelve roles are asserted rather than the one that should hold it, because the failure
   * that matters is a role QUIETLY GAINING it — and a test that checks only `SUPER_ADMIN` passes
   * just as happily when `SUPPORT_AGENT` gains it too.
   */
  const KEY = 'admin.user.read_permissions';
  assert.ok(
    PERMISSION_KEYS.includes(KEY),
    `${KEY} is in no capability row, so no route can use it`,
  );

  for (const role of PLATFORM_ROLES) {
    const held = permissionsFor(role).includes(KEY);
    assert.equal(
      held,
      role === 'SUPER_ADMIN',
      held
        ? `${role} can inspect any user's effective permissions; FR-RBAC-05 says Super Admin only`
        : `SUPER_ADMIN has lost ${KEY}, so FR-RBAC-05 has no reachable endpoint`,
    );
  }
});

test('a capability with a `○` cell MUST have a read key', () => {
  // Otherwise `READ` resolves to nothing and the role silently holds no permission — which
  // fails closed, so it is not a security hole, but it IS a capability the matrix grants and
  // the system does not. That gap is invisible until somebody files a bug.
  for (const capability of CAPABILITY_MATRIX) {
    const hasReadOnlyCell = Object.values(capability.grants).includes('READ');
    if (hasReadOnlyCell) {
      assert.notEqual(
        capability.readKey,
        null,
        `"${capability.capability}" has a ○ cell but no read key, so that role gets nothing`,
      );
    }
  }
});

test('`○` yields the read key and NOT the write key', () => {
  // The escalation this prevents: support (○ on "Create / edit plan") being able to change a
  // tenant's pricing. PE-T5 refuses support financial mutation, and this is the same rule one
  // layer down.
  const support = permissionsFor('SUPPORT_AGENT');
  assert.ok(support.includes('plans.plan.read'), 'support cannot read plans');
  assert.ok(
    !support.includes('plans.plan.write'),
    'SUPPORT_AGENT holds plans.plan.write. §B3.2 gives support ○ on "Create / edit plan" — ' +
      'read only. A support agent who can edit a plan can change what a member is charged.',
  );
});

test('`▪` and `●` yield the same keys — the difference is a row filter, not a capability', () => {
  // MEMBER has ▪ on "Submit review"; the ownership narrowing is BR-REV-01's job (a recorded
  // check-in), enforced by the use case. Encoding it as a missing permission would make the
  // endpoint 403 for everyone instead of 422 for the un-checked-in.
  assert.ok(permissionsFor('MEMBER').includes('reviews.review.create'));
  // RECEPTIONIST has ▪ on "Edit member record", GYM_MANAGER has ●. Same keys.
  const receptionist = permissionsFor('RECEPTIONIST');
  const manager = permissionsFor('GYM_MANAGER');
  assert.ok(receptionist.includes('crm.member_record.update'));
  assert.ok(manager.includes('crm.member_record.update'));
});

test('VISITOR holds only public reads, and can write nothing', () => {
  // Three rows give VISITOR `●`: "Browse marketplace", "View plan prices" and "Compare gyms".
  // All three are reads, which is the property under test — an unauthenticated caller can look
  // at the marketplace and at nothing else.
  const visitor = permissionsFor('VISITOR');
  assert.deepEqual(visitor, [
    'catalog.plan_price.read',
    'discovery.comparison.read',
    'discovery.listing.read',
  ]);
  for (const key of visitor) {
    assert.match(key, /\.read$/, `VISITOR holds "${key}", which is not a read`);
  }
});

test('SUPER_ADMIN holds every key the matrix grants anyone except the tenant-side ones', () => {
  // Not "every key": §B3.2 gives S.ADMIN `—` on eleven operational rows — scanning check-ins,
  // creating walk-in members, taking offline payments, assigning trainers. That is deliberate:
  // a platform administrator is not a receptionist, and granting the whole matrix to one role
  // would make the matrix decorative.
  const superAdmin = new Set(permissionsFor('SUPER_ADMIN'));
  assert.ok(superAdmin.has('admin.tenant_suspension.create'));
  assert.ok(superAdmin.has('audit.audit_log.read'));
  assert.ok(
    !superAdmin.has('attendance.check_in.create'),
    'SUPER_ADMIN acquired the ability to record a check-in. §B3.2 gives it — on that row.',
  );
  assert.ok(!superAdmin.has('payments.offline_payment.create'));
});

test('only SUPPORT_AGENT and SUPER_ADMIN may impersonate', () => {
  const holders = ROLE_DEFINITIONS.filter((r) =>
    // `iam.impersonation.start` since ADR-0047's companion fix. `support.impersonation.create`
    // was this row's writeKey and appeared on no route in API_Catalog.md — the same disposition
    // as `catalog.branch.write`.
    permissionsFor(r.key).includes('iam.impersonation.start'),
  ).map((r) => r.key);
  assert.deepEqual(holders, ['SUPER_ADMIN', 'SUPPORT_AGENT']);
});

// ═══════════════════════════════════════════════════════════════════════════
// What the seed writes.
// ═══════════════════════════════════════════════════════════════════════════

test('rolePermissionPairs covers every role and never duplicates a pair', () => {
  const pairs = rolePermissionPairs();
  const seen = new Set(pairs.map((p) => `${p.role}|${p.permission}`));
  assert.equal(seen.size, pairs.length, 'a (role, permission) pair is emitted twice');

  // Every role except VISITOR-with-nothing has at least one. VISITOR has two public reads.
  for (const role of ROLE_DEFINITIONS) {
    assert.ok(
      pairs.some((p) => p.role === role.key),
      `${role.key} would be seeded with no permissions at all`,
    );
  }
});

test('every pair references a key that exists in the catalogue', () => {
  const catalogue = new Set(PERMISSION_KEYS);
  for (const pair of rolePermissionPairs()) {
    assert.ok(catalogue.has(pair.permission), `${pair.role} grants unknown key ${pair.permission}`);
  }
});

test('describePermission names the capability and which half', () => {
  const description = describePermission('plans.plan.read');
  assert.match(description, /§B3.2/);
  assert.match(description, /Create \/ edit plan/);
  assert.match(description, /Read/);
  assert.throws(() => describePermission('nope.not.real'), /not in the §B3.2 matrix/);
});

test('parsePermissionKey refuses anything that is not three lowercase segments', () => {
  for (const bad of ['plans.plan', 'Plans.plan.read', 'plans..read', 'plans.plan.read.extra', '']) {
    assert.throws(() => parsePermissionKey(bad), /is not a permission key/, `accepted "${bad}"`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-4 — the platform/tenant discriminator.
// ═══════════════════════════════════════════════════════════════════════════

test('AC-4 · PLATFORM_SCOPES is exactly the set that must have tenant_id IS NULL', () => {
  assert.deepEqual([...PLATFORM_SCOPES].sort(), ['PLATFORM', 'PUBLIC', 'SELF']);

  // The converse, stated as the rule the seed obeys: TENANT and BRANCH roles are the tenant
  // ones, and every other scope is granted with a NULL tenant_id.
  const tenantScoped = ROLE_DEFINITIONS.filter((r) => !PLATFORM_SCOPES.includes(r.scope));
  assert.deepEqual(
    tenantScoped.map((r) => r.key),
    ['GYM_OWNER', 'GYM_MANAGER', 'RECEPTIONIST', 'TRAINER'],
  );
});
