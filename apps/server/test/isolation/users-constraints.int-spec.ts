/**
 * M-019 AC-7 · The `users` constraints, and the erasure path that has to survive them.
 *
 * ┌─ THE CENTRAL CASE: A CHECK THAT WOULD HAVE BROKEN EVERY ERASURE ────────────────────────────┐
 * │ `Schema.md` §4.6 states two rules one sentence apart:                                        │
 * │                                                                                              │
 * │   ck_users__has_contact CHECK (email IS NOT NULL OR phone IS NOT NULL)                       │
 * │   "Erasure sets email, phone, full_name, password_hash to NULL ..."                          │
 * │                                                                                              │
 * │ Taken literally the second violates the first every time, so `data.retention-sweep` would    │
 * │ raise 23514 on every BR-DAT-04 erasure — a DPDP Act obligation, unexecutable. The predicate  │
 * │ is widened with `erased_at IS NOT NULL OR ...`, and BOTH halves are asserted below: a LIVE   │
 * │ user with no contact point is still refused, and an ERASED one is permitted.                 │
 * │                                                                                              │
 * │ This is the same shape as the defect M-018 found in M-017's `release()`. Writing the         │
 * │ failure-path test is what finds it; writing only the happy path never does.                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const CONTAINER = 'gymmap-postgres';
const DB = 'gymmap';

interface Result {
  readonly ok: boolean;
  readonly out: string;
  readonly err: string;
}

function psql(sql: string): Result {
  try {
    const out = execFileSync(
      'docker',
      ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', DB, '-tA', '-v', 'ON_ERROR_STOP=1'],
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return { ok: true, out: out.trim(), err: '' };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string };
    return { ok: false, out: (e.stdout ?? '').trim(), err: (e.stderr ?? '').trim() };
  }
}

/** Runs SQL inside a transaction that is always rolled back, so the seed is never disturbed. */
function probe(sql: string): Result {
  return psql(`BEGIN;\n${sql}\nROLLBACK;`);
}

const ID = (n: number): string => `01912f00-0000-7000-8000-0000000009${String(n).padStart(2, '0')}`;

let available = false;

before(() => {
  available = psql('SELECT 1;').ok;
  if (!available) console.error('\n  SKIPPING — no database.\n');
});

const it = (name: string, fn: () => void) =>
  test(name, (t) => {
    if (!available) return t.skip('no database');
    fn();
  });

// ═══════════════════════════════════════════════════════════════════════════
// ck_users__has_contact — both halves.
// ═══════════════════════════════════════════════════════════════════════════

it('a LIVE user with neither email nor phone is REFUSED', () => {
  const result = probe(`INSERT INTO users (id, full_name) VALUES ('${ID(1)}', 'No Contact');`);
  assert.equal(result.ok, false, 'a user with no contact point was accepted');
  assert.match(result.err, /ck_users__has_contact/);
});

it('email alone is enough — the web registration path', () => {
  const result = probe(
    `INSERT INTO users (id, email) VALUES ('${ID(2)}', 'email.only@example.com');`,
  );
  assert.ok(result.ok, result.err);
});

it('phone alone is enough — the India walk-in path (FR-CRM-04)', () => {
  // The case that makes both columns nullable. A member enrolled at the front desk may have no
  // email at all, and requiring one would make walk-in enrolment impossible in the launch market.
  const result = probe(`INSERT INTO users (id, phone) VALUES ('${ID(3)}', '+919812345678');`);
  assert.ok(result.ok, result.err);
});

it('AC-7 · an ERASED user with NEITHER is permitted — BR-DAT-04 must be executable', () => {
  const result = probe(
    `INSERT INTO users (id, email, phone, status, erased_at, pseudonym_token)
     VALUES ('${ID(4)}', NULL, NULL, 'ERASED', now(), 'pseudo-${ID(4)}');`,
  );
  assert.ok(
    result.ok,
    `an erased user was refused: ${result.err}\n\n` +
      'ck_users__has_contact must admit `erased_at IS NOT NULL`, or every DPDP erasure raises ' +
      '23514 and the data-subject process cannot complete.',
  );
});

it('AC-7 · the full erasure UPDATE succeeds against a real seeded row', () => {
  // Not a synthetic insert — the actual statement shape `data.retention-sweep` will run, against
  // a row that exists. An insert-shaped test can pass while the update path still fails.
  const result = probe(
    `UPDATE users
        SET email = NULL, phone = NULL, full_name = NULL, password_hash = NULL,
            email_verified_at = NULL, phone_verified_at = NULL,
            pseudonym_token = 'pseudo-fixed-0001', erased_at = now(), status = 'ERASED'
      WHERE email = 'member.solo@seed.gymmap.test';`,
  );
  assert.ok(result.ok, `the erasure UPDATE was refused: ${result.err}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// Erasure is all-or-nothing.
// ═══════════════════════════════════════════════════════════════════════════

it('a half-erased row is REFUSED — erased_at set but email still present', () => {
  // The worst outcome available here: a data-subject request that reported success and did not
  // complete. The requester is told their data is gone and it is not.
  const result = probe(
    `INSERT INTO users (id, email, status, erased_at, pseudonym_token)
     VALUES ('${ID(5)}', 'still.here@example.com', 'ERASED', now(), 'pseudo-${ID(5)}');`,
  );
  assert.equal(result.ok, false, 'a half-erased user was accepted');
  assert.match(result.err, /ck_users__erasure_is_complete/);
});

it('an erased row with no pseudonym_token is REFUSED', () => {
  // Without the token the financial records that referenced this person point at nothing, and
  // BR-FIN-01's seven-year retention loses its subject.
  const result = probe(
    `INSERT INTO users (id, status, erased_at) VALUES ('${ID(6)}', 'ERASED', now());`,
  );
  assert.equal(result.ok, false, 'an erased user with no pseudonym was accepted');
  assert.match(result.err, /ck_users__erasure_is_complete/);
});

it('status and erased_at cannot disagree, in either direction', () => {
  const statusWithoutTimestamp = probe(
    `INSERT INTO users (id, email, status) VALUES ('${ID(7)}', 'a@example.com', 'ERASED');`,
  );
  assert.equal(statusWithoutTimestamp.ok, false, 'status ERASED with no erased_at was accepted');
  assert.match(statusWithoutTimestamp.err, /ck_users__erase/);

  const timestampWithoutStatus = probe(
    `INSERT INTO users (id, status, erased_at, pseudonym_token)
     VALUES ('${ID(8)}', 'ACTIVE', now(), 'pseudo-${ID(8)}');`,
  );
  assert.equal(timestampWithoutStatus.ok, false, 'erased_at with status ACTIVE was accepted');
  assert.match(timestampWithoutStatus.err, /ck_users__erased_status_agrees/);
});

// ═══════════════════════════════════════════════════════════════════════════
// SD7 — the partial unique indexes.
// ═══════════════════════════════════════════════════════════════════════════

it('two LIVE users cannot share an email', () => {
  const result = probe(
    `INSERT INTO users (id, email) VALUES ('${ID(9)}', 'member.solo@seed.gymmap.test');`,
  );
  assert.equal(result.ok, false, 'a duplicate live email was accepted');
  assert.match(result.err, /uq_users__email/);
});

it('SD7 · a soft-deleted account FREES its email for re-registration', () => {
  // The whole reason the index is partial. Without it, deleting an account makes that address
  // permanently unusable — the person cannot come back, and support cannot explain why.
  const result = probe(
    `UPDATE users SET deleted_at = now() WHERE email = 'member.solo@seed.gymmap.test';
     INSERT INTO users (id, email) VALUES ('${ID(10)}', 'member.solo@seed.gymmap.test');`,
  );
  assert.ok(result.ok, `re-registering a soft-deleted address was refused: ${result.err}`);
});

it('SD7 · the same holds for phone', () => {
  const blocked = probe(`INSERT INTO users (id, phone) VALUES ('${ID(11)}', '+919000000005');`);
  assert.equal(blocked.ok, false, 'a duplicate live phone was accepted');
  assert.match(blocked.err, /uq_users__phone/);

  const freed = probe(
    `UPDATE users SET deleted_at = now() WHERE phone = '+919000000005';
     INSERT INTO users (id, phone) VALUES ('${ID(12)}', '+919000000005');`,
  );
  assert.ok(freed.ok, freed.err);
});

it('pseudonym_token is unique across ALL rows, including deleted ones', () => {
  // NOT partial on deleted_at, unlike the contact points. The token's whole purpose is to be the
  // durable reference a financial record keeps, and a reused one merges two people's histories.
  const result = probe(
    `UPDATE users SET pseudonym_token = 'shared-token'
      WHERE email IN ('member.solo@seed.gymmap.test', 'member.dual@seed.gymmap.test');`,
  );
  assert.equal(result.ok, false, 'two users shared a pseudonym token');
  assert.match(result.err, /uq_users__pseudonym_token/);
});

// ═══════════════════════════════════════════════════════════════════════════
// The domains and the smaller CHECKs.
// ═══════════════════════════════════════════════════════════════════════════

it('the email_address domain rejects a malformed address', () => {
  const result = probe(`INSERT INTO users (id, email) VALUES ('${ID(13)}', 'not-an-email');`);
  assert.equal(result.ok, false, 'a malformed email was accepted');
  assert.match(result.err, /email_address/);
});

it('the phone_e164 domain rejects a local-format number', () => {
  // `9876543210` is how an Indian number is written everywhere except on the wire. Storing it
  // un-normalised means the OTP send fails at the carrier, hours after registration.
  const result = probe(`INSERT INTO users (id, phone) VALUES ('${ID(14)}', '9876543210');`);
  assert.equal(result.ok, false, 'a non-E.164 phone was accepted');
  assert.match(result.err, /phone_e164/);
});

it('a verification timestamp without its contact point is REFUSED', () => {
  // BR-GYM-02 makes "verified owner email" an approval precondition. A stray
  // `email_verified_at` on a row with no email would satisfy a check it should not.
  const result = probe(
    `INSERT INTO users (id, phone, email_verified_at)
     VALUES ('${ID(15)}', '+919812345679', now());`,
  );
  assert.equal(result.ok, false, 'email_verified_at with no email was accepted');
  assert.match(result.err, /ck_users__email_verified_needs_email/);
});

it('display_locale must look like a locale', () => {
  const result = probe(
    `INSERT INTO users (id, email, display_locale)
     VALUES ('${ID(16)}', 'locale@example.com', 'English');`,
  );
  assert.equal(result.ok, false);
  assert.match(result.err, /ck_users__display_locale_shape/);
});

it("display_locale defaults to 'en-IN' — the launch market", () => {
  const result = probe(
    `INSERT INTO users (id, email) VALUES ('${ID(17)}', 'default@example.com');
     SELECT display_locale FROM users WHERE id = '${ID(17)}';`,
  );
  assert.ok(result.ok, result.err);
  assert.match(result.out, /en-IN/);
});

it("status defaults to 'PENDING_VERIFICATION', not ACTIVE", () => {
  // A default of ACTIVE would make every unverified registration a usable account, which is
  // FR-AUTH's whole verification step bypassed by a column default.
  const result = probe(
    `INSERT INTO users (id, email) VALUES ('${ID(18)}', 'pending@example.com');
     SELECT status, mfa_enabled FROM users WHERE id = '${ID(18)}';`,
  );
  assert.ok(result.ok, result.err);
  assert.match(result.out, /PENDING_VERIFICATION\|f/);
});

// ═══════════════════════════════════════════════════════════════════════════
// The database is untouched.
// ═══════════════════════════════════════════════════════════════════════════

it('every probe rolled back — the seed is intact', () => {
  const result = psql(`SELECT count(*) FROM users WHERE deleted_at IS NULL AND erased_at IS NULL;`);
  assert.equal(result.out, '11', 'a probe leaked out of its transaction');
});
