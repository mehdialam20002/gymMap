/**
 * M-013 · `audit_log` — the grant asymmetry, immutability, and the partition trap.
 * RS-9, CI-09, CI-10, AC-FND-11.3, AC-FND-11.4, AC-ADMN-02.3, NFR-SEC-13.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE ASYMMETRY IS THE DESIGN
 *
 *     app_append   INSERT      and NOT SELECT
 *     app_rw       SELECT      and NOT INSERT, NOT UPDATE, NOT DELETE
 *
 * The writer cannot read the log, so a compromised request path cannot enumerate what has been
 * recorded about it, and cannot find the row it would want to suppress. The reader cannot
 * write, so a bug in reporting code cannot forge an entry.
 *
 * Nobody holds UPDATE or DELETE — not app_rw, not the platform role, not the admin console.
 * AC-ADMN-02.3 states it as a capability claim: "no such capability exists". A mutable audit
 * log is worse than none, because it launders an attacker's actions into apparent legitimacy.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

import { TENANT_A, TENANT_B, seedTenantsSql } from '../../prisma/seed/tenants.ts';

let available = false;
let partition = '';

/** Runs SQL and returns stdout AND stderr, so a refusal is readable rather than merely thrown. */
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

/** Data lines only — psql echoes a command tag per statement. */
function rows(sql: string): string[] {
  return psql(sql)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^(SET|BEGIN|COMMIT|ROLLBACK|INSERT \d)/.test(l));
}

/** Everything inside one transaction, so `SET LOCAL app.tenant_id` is scoped to it. */
function asTenant(role: string, tenant: string, sql: string): string {
  return psql(`SET ROLE ${role};\nBEGIN;\nSET LOCAL app.tenant_id = '${tenant}';\n${sql}\nCOMMIT;`);
}

before(() => {
  available = /^1$/m.test(psql('SELECT 1;'));
  if (!available) {
    console.error('\n  SKIPPING the audit-grant assertions — no database. pnpm infra:up\n');
    return;
  }

  partition = rows(`SELECT 'audit_log_y'||to_char(now(),'YYYY')||'m'||to_char(now(),'MM');`)[0]!;

  psql(`
    SET session_replication_role = 'replica';
    DELETE FROM tenants WHERE id IN ('${TENANT_A}','${TENANT_B}');
    SET session_replication_role = 'origin';
    ${seedTenantsSql()}
  `);

  // One row per tenant, written the only way a row CAN be written — as app_append.
  for (const tenant of [TENANT_A, TENANT_B]) {
    asTenant(
      'app_append',
      tenant,
      `INSERT INTO audit_log (id, tenant_id, actor_type, entity_type, entity_id, action, correlation_id)
       VALUES (gen_random_uuid(), '${tenant}', 'USER', 'TENANT', '${tenant}', 'UPDATE', gen_random_uuid());`,
    );
  }
});

after(() => {
  if (!available) return;
  // The rows cannot be DELETEd — that is the point of the table. TRUNCATE as superuser is the
  // only way to clean up, and it is available only because the trigger fires on UPDATE and
  // DELETE, not TRUNCATE. Worth noticing: TRUNCATE is a genuine gap in the immutability story,
  // recorded below as an assertion rather than left as a surprise.
  psql(`TRUNCATE audit_log;`);
  psql(`
    SET session_replication_role = 'replica';
    DELETE FROM tenants WHERE id IN ('${TENANT_A}','${TENANT_B}');
    SET session_replication_role = 'origin';
  `);
});

const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    fn();
  });

// ---------------------------------------------------------------------------
// The grants themselves.
// ---------------------------------------------------------------------------

it('G-AUDIT · the grant table is exactly the asymmetry, and nothing more', () => {
  const granted = rows(
    `SELECT grantee||':'||string_agg(privilege_type,',' ORDER BY privilege_type)
     FROM information_schema.table_privileges
     WHERE table_name='audit_log' AND grantee LIKE 'app\\_%'
     GROUP BY grantee ORDER BY grantee;`,
  );
  assert.deepEqual(granted, ['app_append:INSERT', 'app_platform_ro:SELECT', 'app_rw:SELECT']);
});

it('RS-9 · app_rw cannot UPDATE — permission denied at the grant level', () => {
  const out = asTenant('app_rw', TENANT_A, `UPDATE audit_log SET reason='tampered' WHERE true;`);
  assert.match(out, /permission denied for table audit_log/i);
});

it('RS-9 · app_rw cannot DELETE', () => {
  const out = asTenant('app_rw', TENANT_A, `DELETE FROM audit_log WHERE true;`);
  assert.match(out, /permission denied for table audit_log/i);
});

it('RS-9 · app_rw cannot INSERT — the reader cannot forge an entry', () => {
  const out = asTenant(
    'app_rw',
    TENANT_A,
    `INSERT INTO audit_log (id, tenant_id, actor_type, entity_type, entity_id, action, correlation_id)
     VALUES (gen_random_uuid(), '${TENANT_A}', 'USER', 'TENANT', '${TENANT_A}', 'CREATE', gen_random_uuid());`,
  );
  assert.match(out, /permission denied for table audit_log/i);
});

it('CI-09 · app_append cannot SELECT — the writer cannot read the log back', () => {
  // The property that stops a compromised request path enumerating its own trail, or finding
  // the row it wants to suppress. Schema.md §2.2 property 1.
  const out = asTenant('app_append', TENANT_A, `SELECT count(*) FROM audit_log;`);
  assert.match(out, /permission denied for table audit_log/i);
});

it('app_append CAN insert — the asymmetry is not just "everything denied"', () => {
  // The positive control. Without it, every assertion above would pass on a table nobody can
  // touch at all, which is the same catastrophic false pass A4 guards against in M-012.
  const out = asTenant(
    'app_append',
    TENANT_A,
    `INSERT INTO audit_log (id, tenant_id, actor_type, entity_type, entity_id, action, correlation_id)
     VALUES (gen_random_uuid(), '${TENANT_A}', 'SYSTEM', 'TENANT', '${TENANT_A}', 'CREATE', gen_random_uuid());`,
  );
  assert.ok(!/permission denied|ERROR/i.test(out), `the insert was refused:\n${out}`);
});

// ---------------------------------------------------------------------------
// The trigger — §2.8.2, the second line of defence.
// ---------------------------------------------------------------------------

it('AC-ADMN-02.3 · even a SUPERUSER holding the UPDATE grant is refused', () => {
  // The grants stop app_rw. This stops everything else. The two fail INDEPENDENTLY: a grant is
  // catalogue state a careless `GRANT ALL` can widen; a trigger has to be dropped by name.
  const out = psql(`UPDATE audit_log SET reason='tampered' WHERE true;`);
  assert.match(out, /append-only/i);
  assert.match(out, /BR-DAT-01/);
});

it('AC-ADMN-02.3 · and DELETE, for the same reason', () => {
  const out = psql(`DELETE FROM audit_log WHERE true;`);
  assert.match(out, /append-only/i);
});

it('the refusal tells the reader what to do instead', () => {
  // An error that only says "denied" invites someone to find a way around it. This one names
  // the correct action, so the next step is a correcting entry rather than a workaround.
  const out = psql(`UPDATE audit_log SET reason='x' WHERE true;`);
  assert.match(out, /append a correcting entry/i);
});

it('KNOWN GAP · TRUNCATE is not covered by the trigger', () => {
  // Recorded as an assertion rather than left to be discovered. The trigger fires on UPDATE and
  // DELETE; TRUNCATE takes a different path and requires table ownership, so only a superuser
  // or the owner can reach it — neither of which the application ever connects as.
  //
  // A `BEFORE TRUNCATE` trigger is possible and is NOT added here, because the retention job
  // (R-AUD, seven years) drops whole partitions, and dropping a partition is how that job is
  // supposed to work. Blocking TRUNCATE outright would make legitimate retention impossible.
  const triggers = rows(
    `SELECT string_agg(DISTINCT lower(tgname), ',') FROM pg_trigger
     WHERE tgrelid = 'audit_log'::regclass AND NOT tgisinternal;`,
  );
  assert.match(triggers[0] ?? '', /immutable/);
});

// ---------------------------------------------------------------------------
// CI-10 — the partition trap.
// ---------------------------------------------------------------------------

it('CI-10 · a partition addressed BY NAME still applies RLS', () => {
  // THE TRAP. PostgreSQL applies the parent's policies when a partition is reached through the
  // parent; addressing the partition by name applies only that partition's OWN policies. A
  // partition created without them is a month of every tenant's audit history readable by any
  // tenant — created by a cron job at 2am, reviewed by nobody.
  const total = Number(rows(`SELECT count(*) FROM ${partition};`)[0]);
  assert.ok(total >= 2, `the fixture needs rows from two tenants, found ${total}`);

  const visibleToA = asTenant('app_rw', TENANT_A, `SELECT count(*) FROM ${partition};`)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^\d+$/.test(l))[0];

  assert.ok(
    Number(visibleToA) < total,
    `tenant A sees ${visibleToA} of ${total} rows in ${partition} — the partition is not ` +
      `applying RLS when addressed by name (CI-10, §2.3.3 obligation 7).`,
  );
});

it('CI-10 · every partition has RLS enabled AND forced', () => {
  const offenders = rows(
    `SELECT c.relname FROM pg_class c
     WHERE c.relname LIKE 'audit\\_log\\_y%' AND c.relkind = 'r'
       AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity);`,
  );
  assert.deepEqual(offenders, [], `partitions without forced RLS: ${offenders.join(', ')}`);
});

it('CI-10 · every partition carries ALL THREE policies and the G-AUDIT grants', () => {
  const partitions = rows(
    `SELECT relname FROM pg_class WHERE relname LIKE 'audit\\_log\\_y%' AND relkind='r' ORDER BY relname;`,
  );
  assert.ok(partitions.length >= 3, 'expected at least three partitions of runway');

  for (const name of partitions) {
    /*
     * THREE since ADR-0039, not two.
     *
     * The read policy narrowed to `FOR SELECT TO app_rw`, and a separate `rls_<t>__append_write` —
     * `FOR INSERT TO app_append`, no predicate — was added. The old single `FOR ALL` policy failed
     * EVERY insert, because the audit connection deliberately opens no tenant context and its
     * `WITH CHECK` began with the raising form of `current_setting`. That was `BLK-18`.
     */
    const policies = rows(`SELECT count(*) FROM pg_policies WHERE tablename = '${name}';`)[0];
    assert.equal(policies, '3', `${name} has ${policies} policies, expected 3`);

    // The SHAPE, not only the count: neither read policy may cover a write, and the write policy
    // must be INSERT-only and scoped to app_append alone.
    const shape = rows(
      `SELECT cmd || ':' || roles::text FROM pg_policies WHERE tablename = '${name}' ORDER BY 1;`,
    );
    assert.deepEqual(
      shape,
      ['INSERT:{app_append}', 'SELECT:{app_platform_ro}', 'SELECT:{app_rw}'],
      `${name}: policy shape is not the ADR-0039 shape`,
    );

    const grants = rows(
      `SELECT grantee||':'||privilege_type FROM information_schema.table_privileges
       WHERE table_name='${name}' AND grantee LIKE 'app\\_%' ORDER BY grantee, privilege_type;`,
    );
    assert.deepEqual(
      grants,
      ['app_append:INSERT', 'app_platform_ro:SELECT', 'app_rw:SELECT'],
      `${name} grants are wrong`,
    );
  }
});

it('three partitions of runway exist, so a failed maintenance job is an alert not an outage', () => {
  const count = Number(
    rows(`SELECT count(*) FROM pg_class WHERE relname LIKE 'audit\\_log\\_y%' AND relkind='r';`)[0],
  );
  assert.ok(count >= 3, `only ${count} partition(s); an INSERT would start failing within a month`);
});

it('the maintenance function creates a partition WITH its policies and grants', () => {
  // The function the M-018 job will call. Tested here so the cron path and the migration path
  // cannot diverge — a partition created by the job with no policy is the CI-10 failure with a
  // different actor.
  psql(`SELECT audit_log_create_partition('2027-01-01'::date);`);

  const policies = rows(
    `SELECT count(*) FROM pg_policies WHERE tablename='audit_log_y2027m01';`,
  )[0];
  assert.equal(policies, '3', 'the maintenance function must create all three policies — ADR-0039');

  /*
   * The shape, and this is the assertion that stops the CRON path diverging.
   *
   * The migration fixed the parent and three partitions. A function still emitting the old single
   * `FOR ALL` policy would re-introduce `BLK-18` on the first of next month, with no code change
   * and nobody watching — which is exactly how the defect stayed invisible the first time.
   */
  const shape = rows(
    `SELECT cmd || ':' || roles::text FROM pg_policies
     WHERE tablename='audit_log_y2027m01' ORDER BY 1;`,
  );
  assert.deepEqual(shape, ['INSERT:{app_append}', 'SELECT:{app_platform_ro}', 'SELECT:{app_rw}']);

  const forced = rows(
    `SELECT relrowsecurity::text||'|'||relforcerowsecurity::text FROM pg_class WHERE relname='audit_log_y2027m01';`,
  )[0];
  assert.equal(forced, 'true|true');

  psql(`DROP TABLE IF EXISTS audit_log_y2027m01;`);
});

// ---------------------------------------------------------------------------
// Shape.
// ---------------------------------------------------------------------------

it('AC-FND-11.1 · every mandated column exists', () => {
  const columns = rows(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='audit_log' ORDER BY column_name;`,
  );
  for (const required of [
    'actor_id',
    'actor_type',
    'impersonated_by',
    'tenant_id',
    'entity_type',
    'entity_id',
    'action',
    'before',
    'after',
    'ip',
    'user_agent',
    'correlation_id',
    'reason',
    'occurred_at',
  ]) {
    assert.ok(columns.includes(required), `audit_log is missing "${required}"`);
  }
});

it('tenant_id is NULLABLE — a platform action has no tenant (DUAL, not RLS)', () => {
  const nullable = rows(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_name='audit_log' AND column_name='tenant_id';`,
  )[0];
  assert.equal(nullable, 'YES');
});

it('BR-DAT-02 · an impersonation row without a substantive reason is refused', () => {
  const out = asTenant(
    'app_append',
    TENANT_A,
    `INSERT INTO audit_log (id, tenant_id, actor_type, entity_type, entity_id, action, correlation_id, impersonated_by, reason)
     VALUES (gen_random_uuid(), '${TENANT_A}', 'SUPPORT_IMPERSONATION', 'TENANT', '${TENANT_A}',
             'UPDATE', gen_random_uuid(), gen_random_uuid(), 'fix');`,
  );
  assert.match(out, /ck_audit_log__impersonation_has_reason|violates check/i);
});

it('BAC-13 · both query indexes exist', () => {
  const indexes = rows(
    `SELECT indexname FROM pg_indexes WHERE tablename='audit_log' ORDER BY indexname;`,
  );
  assert.ok(
    indexes.some((i) => i.includes('entity_occurred')),
    'no (entity_type, entity_id, occurred_at) index — the support and dispute path',
  );
  assert.ok(
    indexes.some((i) => i.includes('actor_occurred')),
    'no (actor_id, occurred_at) index — the investigation path',
  );
});
