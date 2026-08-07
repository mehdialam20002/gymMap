/**
 * M-014 · `runElevated()` — PE-T1, PE-T2, PE-T4, PE-T5, PE-T6, PE-T8, PE-T9.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * PE-T1 IS THE POSITIVE CONTROL, AND IT COMES FIRST
 *
 * Every other assertion here is a refusal. If elevation were simply broken — the role missing,
 * the policy absent, the connection wrong — every refusal would pass and the suite would be
 * green while the admin approval queue could not function at all.
 *
 * So the first assertion is that an elevated read RETURNS ROWS FROM MORE THAN ONE TENANT. Same
 * reasoning as A4 in M-012, applied to the opposite capability: prove the thing works before
 * proving it is bounded.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

import { PrismaClient } from '@prisma/client';

import {
  ELEVATION_SCOPES,
  currentElevation,
  reason,
  runElevated,
} from '../../dist/tenancy/prisma/platform-elevation.js';
import { runWithTenant, runWithoutTenant } from '../../dist/tenancy/context/tenant-context.als.js';
import { TENANT_A, TENANT_B, seedTenantsSql } from '../../prisma/seed/tenants.ts';
import { tenantId } from '@gymmap/types';
import { requireRole } from './_availability.ts';

const PLATFORM_URL =
  process.env['PLATFORM_DATABASE_URL_TEST'] ??
  'postgresql://gymmap_platform:gymmap_local_dev@localhost:5432/gymmap?schema=public';

const ACTOR = '01912f00-0000-7000-8000-0000000000a1';
const GOOD_REASON = 'Reviewing gym application 4471 for the approval queue';

let platform: PrismaClient;
let available = false;

/** Records what was appended, so PE-T2 can assert ORDER rather than merely presence. */
class RecordingAudit {
  readonly entries: { entry: unknown; at: number }[] = [];
  shouldFail = false;

  append(entry: unknown): Promise<void> {
    if (this.shouldFail) return Promise.reject(new Error('audit unavailable'));
    this.entries.push({ entry, at: Date.now() });
    return Promise.resolve();
  }
}

function psql(sql: string): string {
  try {
    return execFileSync(
      'docker',
      [
        'exec',
        '-i',
        'gymmap-postgres',
        'psql',
        '-U',
        'postgres',
        '-d',
        'gymmap',
        '-tA',
        '-v',
        'ON_ERROR_STOP=1',
      ],
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    return `${e.stdout ?? ''}\n${e.stderr ?? ''}`;
  }
}

before(async () => {
  // `requireRole` THROWS when PostgreSQL is up and only this role cannot connect — see
  // `_availability.ts`. Before M-019 this block caught that case and called it "no database",
  // and the entire elevation suite reported SKIP while the run printed `fail 0`.
  ({ available } = await requireRole('gymmap_platform', async () => {
    // Seed only — never DELETE. `--test-concurrency=1` serialises the suites, but a suite that
    // removes shared fixtures still leaves the NEXT one asserting against rows that are gone,
    // and a subject that has vanished makes an isolation assertion pass for the wrong reason.
    psql(seedTenantsSql());
    platform = new PrismaClient({ datasources: { db: { url: PLATFORM_URL } } });
    await platform.$connect();
  }));
});

after(async () => {
  if (available) await platform.$disconnect();
});

const it = (name: string, fn: () => Promise<void>) =>
  test(name, async (t) => {
    if (!available) return t.skip('no database');
    await fn();
  });

const humanActor = { kind: 'HUMAN' as const, userId: ACTOR, permission: 'admin.application.read' };

// ═══════════════════════════════════════════════════════════════════════════
// PE-T1 — the positive control.
// ═══════════════════════════════════════════════════════════════════════════

it('PE-T1 · an elevated read returns rows from MORE THAN ONE tenant', async () => {
  const audit = new RecordingAudit();

  const rows = await runWithoutTenant(async () =>
    runElevated(
      audit as never,
      { reason: reason(GOOD_REASON), actor: humanActor, scope: 'READ_ALL_TENANTS' },
      async () => platform.tenant.findMany({ select: { id: true } }),
    ),
  );

  const ids = new Set(rows.map((r) => r.id));
  assert.ok(
    ids.size >= 2,
    `an elevated read saw ${ids.size} tenant(s). Every refusal assertion below would pass ` +
      `trivially if elevation simply did not work — this is the control that distinguishes ` +
      `"bounded" from "broken".`,
  );
  assert.ok(ids.has(TENANT_A) && ids.has(TENANT_B));
});

// ═══════════════════════════════════════════════════════════════════════════
// PE-T2 — the audit row precedes the work.
// ═══════════════════════════════════════════════════════════════════════════

it('PE-T2 · the audit row is written BEFORE the callback runs', async () => {
  const audit = new RecordingAudit();
  let sawEntryDuringCallback = 0;

  await runWithoutTenant(async () =>
    runElevated(
      audit as never,
      { reason: reason(GOOD_REASON), actor: humanActor, scope: 'READ_ALL_TENANTS' },
      async () => {
        // Read the recorder from INSIDE the callback. Asserting afterwards would pass even if
        // the row were written last, which is the ordering the milestone actually cares about.
        sawEntryDuringCallback = audit.entries.length;
        return null;
      },
    ),
  );

  assert.equal(sawEntryDuringCallback, 1, 'the work ran before the audit row existed');
});

it('PE-T2 · the row carries actor, permission, reason, scope and correlation id', async () => {
  const audit = new RecordingAudit();
  await runWithoutTenant(async () =>
    runElevated(
      audit as never,
      {
        reason: reason(GOOD_REASON),
        actor: humanActor,
        scope: 'READ_ONE_TENANT',
        entityId: TENANT_A,
      },
      async () => null,
    ),
  );

  const entry = audit.entries[0]!.entry as Record<string, unknown>;
  assert.equal(entry['actorId'], ACTOR);
  assert.equal(entry['permission'], 'admin.application.read');
  assert.equal(entry['reason'], GOOD_REASON);
  assert.equal(entry['elevationScope'], 'READ_ONE_TENANT');
  assert.equal(entry['action'], 'ELEVATE');
  assert.equal(entry['entityId'], TENANT_A);
  assert.ok(entry['correlationId'], 'no correlation id — the row cannot be tied to a request');
  // NULL by design: the whole point of an elevation is that it belongs to no single tenant.
  assert.equal(entry['tenantId'], null);
});

it('PE-T2 · a FAILED audit write abandons the elevation', async () => {
  // The opposite of the @Audited() interceptor, which is best-effort. A failed audit on an
  // ordinary mutation costs one missing record; a cross-tenant read with no record is the exact
  // event the audit log exists for.
  const audit = new RecordingAudit();
  audit.shouldFail = true;
  let callbackRan = false;

  await assert.rejects(() =>
    runWithoutTenant(async () =>
      runElevated(
        audit as never,
        { reason: reason(GOOD_REASON), actor: humanActor, scope: 'READ_ALL_TENANTS' },
        async () => {
          callbackRan = true;
          return null;
        },
      ),
    ),
  );

  assert.equal(callbackRan, false, 'the elevated work ran despite the audit write failing');
});

// ═══════════════════════════════════════════════════════════════════════════
// PE-T4 — the elevated role cannot write. Enforced by GRANTS, not by us.
// ═══════════════════════════════════════════════════════════════════════════

it('PE-T4 · an UPDATE under elevation raises permission denied at the grant level', async () => {
  const audit = new RecordingAudit();

  await assert.rejects(
    () =>
      runWithoutTenant(async () =>
        runElevated(
          audit as never,
          { reason: reason(GOOD_REASON), actor: humanActor, scope: 'READ_ALL_TENANTS' },
          async () =>
            platform.tenant.updateMany({ where: { id: TENANT_A }, data: { tradingName: 'x' } }),
        ),
      ),
    /permission denied/i,
    'app_platform_ro must hold no write grant — the refusal comes from PostgreSQL, not from ' +
      'application code that could be edited away',
  );
});

it('PE-T4 · a DELETE under elevation is refused too', async () => {
  const audit = new RecordingAudit();
  await assert.rejects(
    () =>
      runWithoutTenant(async () =>
        runElevated(
          audit as never,
          { reason: reason(GOOD_REASON), actor: humanActor, scope: 'READ_ALL_TENANTS' },
          async () => platform.tenant.deleteMany({ where: { id: TENANT_A } }),
        ),
      ),
    /permission denied/i,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// PE-T6 — the elevation ends with the callback.
// ═══════════════════════════════════════════════════════════════════════════

it('PE-T6 · elevation is bounded to the call, not to the request', async () => {
  // The failure this prevents: an "elevated session" outlives the operation that needed it, so
  // every later query in the request silently reads across tenants — and the audit log records
  // one elevation for twenty cross-tenant reads.
  const audit = new RecordingAudit();

  await runWithoutTenant(async () => {
    assert.equal(currentElevation(), undefined, 'elevated before the call');

    await runElevated(
      audit as never,
      { reason: reason(GOOD_REASON), actor: humanActor, scope: 'READ_ALL_TENANTS' },
      async () => {
        assert.ok(currentElevation(), 'not elevated inside the call');
        return null;
      },
    );

    assert.equal(currentElevation(), undefined, 'still elevated AFTER the call returned');
  });
});

it('PE-T6 · the elevation ends even when the callback throws', async () => {
  const audit = new RecordingAudit();
  await runWithoutTenant(async () => {
    await assert.rejects(() =>
      runElevated(
        audit as never,
        { reason: reason(GOOD_REASON), actor: humanActor, scope: 'READ_ALL_TENANTS' },
        async () => {
          throw new Error('boom');
        },
      ),
    );
    assert.equal(currentElevation(), undefined, 'a throw left the elevation open');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PE-T5 — elevation is never reachable from inside a tenant scope.
// ═══════════════════════════════════════════════════════════════════════════

it('PE-T5 · elevation cannot begin inside a tenant scope', async () => {
  // An elevation begun inside one tenant's request attributes a cross-tenant read to that
  // request's actor and that tenant's context — the shape of an accidental privilege
  // escalation, and one that reads as ordinary code at the call site.
  const audit = new RecordingAudit();
  await assert.rejects(
    () =>
      runWithTenant(tenantId(TENANT_A), async () =>
        runElevated(
          audit as never,
          { reason: reason(GOOD_REASON), actor: humanActor, scope: 'READ_ALL_TENANTS' },
          async () => null,
        ),
      ),
    /a tenant context .* is already open/i,
  );
  assert.equal(audit.entries.length, 0, 'an audit row was written for a refused elevation');
});

it('PE-T5 · elevation is refused during impersonation (AC-AUTH-03.2)', async () => {
  // An agent acting AS a member must not reach beyond that member's tenant: the member could
  // not, and the agent is standing in for them.
  const audit = new RecordingAudit();
  await assert.rejects(
    () =>
      runWithoutTenant(async () =>
        runElevated(
          audit as never,
          {
            reason: reason(GOOD_REASON),
            actor: { kind: 'HUMAN', userId: ACTOR, permission: 'impersonation.session.act' },
            scope: 'READ_ALL_TENANTS',
          },
          async () => null,
        ),
      ),
    /impersonation/i,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// PE-T9 — the reason is required, and a placeholder is not a reason.
// ═══════════════════════════════════════════════════════════════════════════

for (const [label, value] of [
  ['empty', ''],
  ['whitespace only', '     '],
  ['too short', 'admin'],
  ['still too short', 'checking a thing'],
] as const) {
  it(`PE-T9 · a ${label} reason is refused`, async () => {
    assert.throws(() => reason(value), /at least 20 characters/);
    await Promise.resolve();
  });
}

it('PE-T9 · the runtime check holds even when the brand is cast away', async () => {
  // `NonEmptyReason` makes an empty reason a compile error, and a cast defeats any brand — so
  // the runtime re-check is what actually holds at the boundary.
  const audit = new RecordingAudit();
  await assert.rejects(
    () =>
      runWithoutTenant(async () =>
        runElevated(
          audit as never,
          { reason: '' as never, actor: humanActor, scope: 'READ_ALL_TENANTS' },
          async () => null,
        ),
      ),
    /at least 20 characters/,
  );
  assert.equal(audit.entries.length, 0);
});

it('PE-T9 · an unknown scope is refused', async () => {
  const audit = new RecordingAudit();
  await assert.rejects(
    () =>
      runWithoutTenant(async () =>
        runElevated(
          audit as never,
          { reason: reason(GOOD_REASON), actor: humanActor, scope: 'READ_EVERYTHING' as never },
          async () => null,
        ),
      ),
    /Unknown elevation scope/,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// PE-T8 / PE1 — the authority is a visible POLICY, not an invisible attribute.
// ═══════════════════════════════════════════════════════════════════════════

it('PE-T8 · no role acquired BYPASSRLS to make elevation work', async () => {
  // The whole reason elevation is a policy rather than BYPASSRLS: an attribute in pg_roles
  // changes nothing in pg_policies, so a reviewer reading the policies sees a correctly
  // isolated schema and is wrong.
  // Every role this system creates, named explicitly rather than pattern-matched. A LIKE
  // pattern silently stops covering a role the day somebody names one differently, and this is
  // the assertion least able to afford a false pass.
  //
  // The control comes first: an empty offender list means nothing if the roles are not there.
  const present = psql(
    `SELECT count(*) FROM pg_roles WHERE rolname IN
       ('app_migrator','app_rw','app_append','app_platform_ro',
        'gymmap_app','gymmap_audit','gymmap_platform');`,
  ).trim();
  assert.equal(present, '7', `expected all seven roles to exist; the database reported ${present}`);

  const offenders = psql(
    `SELECT rolname FROM pg_roles
     WHERE (rolbypassrls OR rolsuper)
       AND rolname IN ('app_migrator','app_rw','app_append','app_platform_ro',
                       'gymmap_app','gymmap_audit','gymmap_platform')
     ORDER BY rolname;`,
  )
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  assert.deepEqual(
    offenders,
    [],
    'a role holds BYPASSRLS or SUPERUSER. Either makes RLS advisory: the row-level policies ' +
      'still read correctly in pg_policies while the database ignores them entirely.',
  );
  await Promise.resolve();
});

it('PE-T8 · the elevated authority IS visible in pg_policies', async () => {
  const policies = psql(
    `SELECT tablename||':'||policyname||':'||cmd FROM pg_policies
     WHERE 'app_platform_ro' = ANY(roles) ORDER BY tablename, policyname;`,
  )
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  assert.ok(policies.length > 0, 'the elevation has no visible policy — where does it come from?');
  for (const policy of policies) {
    assert.ok(
      policy.endsWith(':SELECT'),
      `${policy} is not SELECT-only. A cross-tenant WRITE path defeats the entire model, and ` +
        `runElevated() is auditable precisely because it can only read.`,
    );
  }
  await Promise.resolve();
});

it('gymmap_platform is a member of app_platform_ro and NOT of app_rw', async () => {
  // Dual membership would be silently catastrophic: RLS policies are permissive and OR'd, so a
  // role in both would match platform_read's USING(true) on every ordinary query.
  const memberships = psql(
    `SELECT r.rolname FROM pg_auth_members m
     JOIN pg_roles r ON r.oid = m.roleid
     JOIN pg_roles g ON g.oid = m.member
     WHERE g.rolname = 'gymmap_platform' ORDER BY r.rolname;`,
  )
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  assert.deepEqual(memberships, ['app_platform_ro']);
  await Promise.resolve();
});

it('the scope list is closed, so the inventory stays aggregatable', async () => {
  assert.deepEqual(
    [...ELEVATION_SCOPES],
    ['READ_ALL_TENANTS', 'READ_ONE_TENANT', 'READ_FINANCIAL_AGGREGATE', 'READ_AUDIT'],
  );
  await Promise.resolve();
});
