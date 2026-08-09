/**
 * `M-026` · `applications` and `kyc_documents` — every acceptance criterion, on real PostgreSQL.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THESE ARE ALL GRANT- AND POLICY-LEVEL PROPERTIES, SO NOTHING BUT THE DATABASE CAN CHECK THEM
 *
 * `AC-2` asks for `permission denied` on an `UPDATE snapshot`. Not "the repository refuses", not
 * "a trigger reverts it" — the statement must be rejected before it runs, for every connection,
 * including a `psql` session at 3am. The only way to know that is to try it as `app_rw`.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const CONTAINER = 'gymmap-postgres';

function psql(statement: string): string {
  return execFileSync(
    'docker',
    ['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', 'gymmap', '-tAc', statement],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

const one = (statement: string): string =>
  psql(statement)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)[0] ?? '';

/** The error text, or `''` on success. Every counter-example below needs the message. */
function failure(statement: string): string {
  try {
    psql(statement);
    return '';
  } catch (error) {
    const shell = error as { stderr?: Buffer | string; message?: string };
    return String(shell.stderr ?? shell.message ?? error);
  }
}

/**
 * Runs a statement AS `app_rw`, with a tenant in scope.
 *
 * `SET LOCAL ROLE` inside a transaction, exactly as the Prisma extension does — so what is tested
 * is the arrangement that actually ships, not a superuser session with the policies switched on.
 */
const asAppRw = (tenantId: string, statement: string): string =>
  failure(
    `BEGIN; SET LOCAL ROLE app_rw; SET LOCAL app.tenant_id = '${tenantId}'; ${statement}; COMMIT;`,
  );

const TENANT_A = '0192de00-5026-7000-8000-0000000000a1';
const TENANT_B = '0192de00-5026-7000-8000-0000000000a2';
const APP_A = '0192de00-5026-7000-8000-0000000000b1';

let available = false;

function cleanup(): void {
  psql(`DELETE FROM kyc_documents WHERE tenant_id IN ('${TENANT_A}','${TENANT_B}')`);
  psql(`DELETE FROM applications WHERE tenant_id IN ('${TENANT_A}','${TENANT_B}')`);
  psql(`DELETE FROM tenants WHERE id IN ('${TENANT_A}','${TENANT_B}')`);
}

before(() => {
  try {
    one('SELECT 1');
    available = true;
  } catch {
    available = false;
    console.error('\n  SKIPPING the M-026 table assertions — no database reachable.\n');
    return;
  }

  cleanup();
  psql(
    `INSERT INTO tenants (id, legal_name, entity_type, status) VALUES
       ('${TENANT_A}', 'Iron House', 'COMPANY', 'DRAFT'),
       ('${TENANT_B}', 'Apex', 'COMPANY', 'DRAFT')`,
  );
  psql(
    `INSERT INTO applications (id, tenant_id, version, snapshot)
       VALUES ('${APP_A}', '${TENANT_A}', 1, '{"checklistVersion":"IN-2026-01"}'::jsonb)`,
  );
});

after(() => {
  if (available) cleanup();
});

const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    fn();
  });

// ═══════════════════════════════════════════════════════════════════════════
// AC-1 — RLS on both, enabled AND forced, with both policy halves
// ═══════════════════════════════════════════════════════════════════════════

it('AC-1 — RLS is ENABLED and FORCED on both tables', () => {
  // FORCE is the half that gets forgotten: ENABLE alone exempts the table owner, and migrations
  // run as an owner — so the policy would be advisory for the connection most able to do damage.
  for (const table of ['applications', 'kyc_documents']) {
    assert.equal(
      one(`SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE relname='${table}'`),
      't',
      `${table} is not both ENABLED and FORCED`,
    );
  }
});

it('AC-1 — both a USING and a WITH CHECK policy exist, in the same migration', () => {
  // A USING-only policy permits a cross-tenant INSERT the inserting tenant then cannot see. Nothing
  // looks wrong from either side and the row sits in another tenant's scope indefinitely.
  for (const table of ['applications', 'kyc_documents']) {
    const row = one(
      `SELECT (polqual IS NOT NULL) AND (polwithcheck IS NOT NULL)
         FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relname = '${table}' AND p.polcmd = '*'`,
    );
    assert.equal(row, 't', `${table}'s isolation policy is missing USING or WITH CHECK`);
  }
});

it('the platform policy is SELECT-only, on both tables', () => {
  // It must never gain INSERT, UPDATE or DELETE — a reviewer's verdict is written through `app_rw`
  // inside the tenant, never by the elevation role reaching across.
  for (const table of ['applications', 'kyc_documents']) {
    assert.equal(
      one(
        `SELECT polcmd FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
          WHERE c.relname='${table}' AND polname LIKE '%platform_read'`,
      ),
      'r',
      `${table}'s platform policy is not SELECT-only`,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-2 — the snapshot is immutable AT THE GRANT LEVEL
// ═══════════════════════════════════════════════════════════════════════════

it('AC-2 — UPDATE snapshot as app_rw raises permission denied', () => {
  // ┌─ WHY THIS MUST BE A GRANT AND NOT APPLICATION CODE ────────────────────────────────────────┐
  // │ The snapshot is what the reviewer approved. If it can change afterwards, the approval refers │
  // │ to a document nobody can reconstruct, and BR-GYM-01's "a human approved this" becomes        │
  // │ unfalsifiable. A grant refuses the statement for EVERY connection, including psql at 3am.    │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const error = asAppRw(TENANT_A, `UPDATE applications SET snapshot = '{}'::jsonb`);
  assert.match(error, /permission denied/i, `expected a grant refusal, got: ${error}`);
});

it('AC-2 — version and submitted_at are equally immutable', () => {
  for (const column of ['version = 99', `submitted_at = now()`]) {
    const error = asAppRw(TENANT_A, `UPDATE applications SET ${column}`);
    assert.match(error, /permission denied/i, `${column} was writable: ${error}`);
  }
});

it('the VERDICT columns ARE writable — the grant is narrow, not a lockout', () => {
  // A test that only proved the refusals would pass against a table nobody can update at all,
  // which would make the reviewer's job impossible and look like success.
  const error = asAppRw(
    TENANT_A,
    `UPDATE applications SET status = 'UNDER_REVIEW', assigned_to = '${TENANT_A}'::uuid`,
  );
  assert.equal(error, '', `the verdict columns should be writable: ${error}`);
  assert.equal(one(`SELECT status FROM applications WHERE id = '${APP_A}'`), 'UNDER_REVIEW');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-3 — the version sequence is unforgeable
// ═══════════════════════════════════════════════════════════════════════════

it('AC-3 — a duplicate (tenant_id, version) raises', () => {
  // BR-GYM-05: a rejected application is superseded by a new VERSION, never edited. Without this a
  // tenant could submit a second "version 1" and the earlier rejection would appear to belong to a
  // document nobody sent.
  const error = failure(
    `INSERT INTO applications (tenant_id, version, snapshot)
       VALUES ('${TENANT_A}', 1, '{}'::jsonb)`,
  );
  assert.match(error, /uq_applications__tenant_version/, `unexpected: ${error}`);
});

it('the same version number in ANOTHER tenant is fine', () => {
  // The sequence is per tenant. A global unique would make one tenant's submission history depend
  // on how many other gyms had applied first.
  const error = failure(
    `INSERT INTO applications (tenant_id, version, snapshot)
       VALUES ('${TENANT_B}', 1, '{}'::jsonb)`,
  );
  assert.equal(error, '', error);
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-4 / AC-7 — kyc_documents
// ═══════════════════════════════════════════════════════════════════════════

it('AC-4 — kyc_documents has NO deleted_at, and has storage_purged_at instead', () => {
  // Adding `deleted_at` "for consistency" with every other tenant table would be the bug: R-KYC
  // means the row outlives the tenant, and "did this gym ever supply a PAN?" is a question a
  // hidden row cannot answer.
  //
  // The column was `tombstoned_at` until M-029. `Schema.md` §4.3 names it `storage_purged_at`, the
  // meaning is identical, and the migration that created it cited §4.3 as its own source — see
  // TD-036.
  assert.equal(
    one(
      `SELECT count(*) FROM information_schema.columns
        WHERE table_name='kyc_documents' AND column_name='deleted_at'`,
    ),
    '0',
  );
  assert.equal(
    one(
      `SELECT count(*) FROM information_schema.columns
        WHERE table_name='kyc_documents' AND column_name='storage_purged_at'`,
    ),
    '1',
  );
});

it('§4.3 — every column the schema specification requires is present', () => {
  // ┌─ THE ASSERTION THAT WOULD HAVE CAUGHT TD-036 AT M-026 ─────────────────────────────────────┐
  // │ The original migration named `Schema.md` §4.3 as its requirement source and then omitted    │
  // │ four of its columns, renamed three and inverted one nullability — with nothing anywhere     │
  // │ recording it. Three of the omissions are exactly what the upload pipeline produces, so the  │
  // │ gap was invisible until something tried to write.                                            │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const columns = psql(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name='kyc_documents' ORDER BY column_name`,
  )
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (const required of [
    'tenant_id',
    'application_id',
    'document_type',
    'storage_key',
    'original_filename',
    'content_type',
    'byte_size',
    'checksum_sha256',
    'status',
    'reviewed_by',
    'reviewed_at',
    'review_notes',
    'valid_until',
    'storage_purged_at',
  ]) {
    assert.ok(columns.includes(required), `Schema.md §4.3 requires ${required} and it is absent`);
  }
});

it('§4.3 — application_id is NULLABLE, because evidence accumulates before submission', () => {
  // `Schema.md` §4.3: "Nullable while the tenant is still assembling a draft." M-026 made it NOT
  // NULL, which inverted the onboarding order — a document could not exist until an application
  // did, so the wizard would have to submit before uploading anything.
  assert.equal(
    one(
      `SELECT is_nullable FROM information_schema.columns
        WHERE table_name='kyc_documents' AND column_name='application_id'`,
    ),
    'YES',
  );
});

it('a zero-byte upload and a malformed digest are both refused', () => {
  // A zero-byte object is what an aborted multipart write leaves behind. `char(64)` pads a short
  // digest with spaces, which is how a truncated checksum becomes a valid-looking value — so the
  // hex shape is checked rather than the length alone.
  const zeroBytes = failure(
    `INSERT INTO kyc_documents (tenant_id, document_type, storage_key, original_filename,
       content_type, byte_size, checksum_sha256)
       VALUES ('${TENANT_A}', 'PAN', 'kyc/probe-zero', 'pan.pdf', 'application/pdf', 0, '${'a'.repeat(64)}')`,
  );
  assert.match(zeroBytes, /ck_kyc_documents__byte_size_positive/);

  const shortDigest = failure(
    `INSERT INTO kyc_documents (tenant_id, document_type, storage_key, original_filename,
       content_type, byte_size, checksum_sha256)
       VALUES ('${TENANT_A}', 'PAN', 'kyc/probe-digest', 'pan.pdf', 'application/pdf', 10, 'abc')`,
  );
  assert.match(shortDigest, /ck_kyc_documents__checksum_is_hex/);
});

it('AC-4 — nobody holds DELETE on kyc_documents', () => {
  // Not even the platform role. The row is never removed on the request path; the genuine erasure
  // job runs as `app_migrator` under review.
  assert.equal(
    one(
      `SELECT count(*) FROM information_schema.role_table_grants
        WHERE table_name='kyc_documents' AND privilege_type='DELETE' AND grantee LIKE 'app%'`,
    ),
    '0',
  );
});

/** One document row, with every §4.3 NOT NULL column supplied. */
function insertDocument(
  tenant: string,
  documentType: string,
  storageKey: string,
  digest: string,
): string {
  return `INSERT INTO kyc_documents (tenant_id, application_id, document_type, storage_key,
            original_filename, content_type, byte_size, checksum_sha256)
          VALUES ('${tenant}', '${APP_A}', '${documentType}', '${storageKey}',
                  'evidence.pdf', 'application/pdf', 10240, '${digest.repeat(64).slice(0, 64)}')`;
}

it('AC-7 — storage_key is globally unique, not tenant-scoped', () => {
  // Object storage has ONE namespace. Two rows sharing a key point at one object, so purging
  // either would destroy the other tenant's evidence — which is why the collision must be refused
  // across tenants rather than only within one.
  psql(insertDocument(TENANT_A, 'PAN', 'kyc/opaque-key-1', 'a'));

  const sameTenant = failure(insertDocument(TENANT_A, 'GSTIN', 'kyc/opaque-key-1', 'b'));
  assert.match(sameTenant, /uq_kyc_documents__storage_key/);

  // The one that matters: a DIFFERENT tenant is refused too.
  const otherTenant = failure(insertDocument(TENANT_B, 'PAN', 'kyc/opaque-key-1', 'c'));
  assert.match(
    otherTenant,
    /uq_kyc_documents__storage_key/,
    `cross-tenant collision allowed: ${otherTenant}`,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// The isolation that everything else rests on
// ═══════════════════════════════════════════════════════════════════════════

it("BR-TEN-01 — app_rw in tenant B cannot see tenant A's application", () => {
  const visible = psql(
    `BEGIN; SET LOCAL ROLE app_rw; SET LOCAL app.tenant_id = '${TENANT_B}';
     SELECT count(*) FROM applications WHERE id = '${APP_A}'; COMMIT;`,
  );
  assert.match(visible, /(^|\n)\s*0\s*($|\n)/, `tenant B saw tenant A's row:\n${visible}`);
});

it('BR-TEN-01 — a cross-tenant INSERT is refused by WITH CHECK', () => {
  // The half a USING-only policy would allow, and the reason both halves are mandatory.
  const error = asAppRw(
    TENANT_B,
    `INSERT INTO applications (tenant_id, version, snapshot)
       VALUES ('${TENANT_A}', 42, '{}'::jsonb)`,
  );
  assert.match(error, /row-level security|violates/i, `cross-tenant insert allowed: ${error}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// The half-written verdict
// ═══════════════════════════════════════════════════════════════════════════

it('a decision without a decider is unrepresentable', () => {
  // A row saying REJECTED with no `decided_by` is a rejection nobody made, and it is
  // indistinguishable from one somebody did.
  const error = failure(`UPDATE applications SET decision = 'REJECTED' WHERE id = '${APP_A}'`);
  assert.match(error, /ck_applications__verdict_is_complete/, `unexpected: ${error}`);
});
