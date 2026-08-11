/**
 * `M-031` · `AC-3` under CONCURRENCY — *"two concurrent transactions both setting `is_primary`
 * produce exactly one success and one unique violation."*
 *
 * ┌─ THE ONLY ASSERTION IN THIS MILESTONE A SINGLE-CONNECTION SUITE CANNOT MAKE ─────────────────┐
 * │ `branch-deactivation.int-spec.ts` already proves the index REFUSES a second primary, and it   │
 * │ does so with one session: insert two, promote the second, watch it raise. That proves the     │
 * │ constraint exists.                                                                            │
 * │                                                                                              │
 * │ It does not prove what `Schema.md` §5.2's note actually claims — *"a counting trigger would   │
 * │ race"*. A trigger that runs `SELECT count(*) … WHERE is_primary` and refuses at 2 passes the  │
 * │ single-session test perfectly, and fails under two: both transactions read 0, both write, and │
 * │ the gym ends with two primaries. The difference between the two designs is invisible to any   │
 * │ test that opens one connection.                                                               │
 * │                                                                                              │
 * │ So this file opens TWO, holds both open at once, and asserts the arithmetic: one COMMIT, one  │
 * │ unique violation, exactly one primary at the end.                                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY THE SECOND SESSION BLOCKS RATHER THAN FAILING IMMEDIATELY ──────────────────────────────┐
 * │ A UNIQUE index takes a lock on the key it is about to insert. The second transaction's        │
 * │ `UPDATE` therefore WAITS on the first — it cannot know whether the first will commit or roll  │
 * │ back, and until it does the answer is genuinely unknown. That wait is the property being       │
 * │ measured: it is what a counting trigger does not do, and it is why the outcome is decided by  │
 * │ the database rather than by whichever transaction happened to read first.                      │
 * │                                                                                                │
 * │ The fixtures are committed rather than rolled back, because a second connection cannot see an │
 * │ uncommitted row. They are removed in `after()`, and every id is in a probe-only namespace.     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';

const CONTAINER = 'gymmap-postgres';

const TENANT = '0192de00-9300-7000-8000-0000000000c1';
const GYM = '0192de00-9300-7000-8000-0000000000c2';
const BRANCH_A = '0192de00-9300-7000-8000-0000000000c3';
const BRANCH_B = '0192de00-9300-7000-8000-0000000000c4';

function psql(sql: string): { ok: boolean; out: string; err: string } {
  try {
    const out = execFileSync(
      'docker',
      [
        'exec',
        '-i',
        CONTAINER,
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
    return { ok: true, out: out.trim(), err: '' };
  } catch (error) {
    const shell = error as { stdout?: string; stderr?: string };
    return { ok: false, out: (shell.stdout ?? '').trim(), err: (shell.stderr ?? '').trim() };
  }
}

/** A psql process whose stdin stays open, so a transaction can be held between writes. */
function openSession(): {
  send: (sql: string) => void;
  close: () => Promise<{ out: string; err: string }>;
} {
  const child = spawn(
    'docker',
    ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', 'gymmap', '-tA'],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );

  let out = '';
  let err = '';
  child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString('utf8')));
  child.stderr.on('data', (chunk: Buffer) => (err += chunk.toString('utf8')));

  /*
   * `close()` is called twice on the happy path — once for its output and once from the `finally`
   * — so the promise is built ONCE and cached.
   *
   * The first version attached a fresh `'close'` listener per call, and the second call attached
   * it to a process that had already exited: the event never fires again, the promise never
   * settles, and `node:test` reports *"Promise resolution is still pending but the event loop has
   * already resolved"* — which names the symptom and not the cause, and reads like a test-runner
   * problem rather than a listener attached too late.
   */
  let closed: Promise<{ out: string; err: string }> | null = null;

  return {
    send: (sql) => child.stdin.write(`${sql}\n`),
    close: () => {
      closed ??= new Promise((resolve) => {
        child.on('close', () => resolve({ out, err }));
        child.stdin.end();
      });
      return closed;
    },
  };
}

/** Waits for a predicate over a session's accumulated output, or gives up. */
const settle = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

let available = false;

before(() => {
  available = psql('SELECT 1;').ok;
  if (!available) {
    console.error('\n  SKIPPING the AC-3 concurrency assertion — no database.\n');
    return;
  }

  // Committed on purpose: a second connection cannot see an uncommitted row, and the whole point
  // of this file is a second connection.
  const seeded = psql(`
    SET session_replication_role = 'replica';
    INSERT INTO tenants (id, legal_name, entity_type, status, pan)
      VALUES ('${TENANT}', 'Primary Race Probe', 'COMPANY', 'DRAFT', 'AAACR1234R')
      ON CONFLICT (id) DO NOTHING;
    INSERT INTO gyms (id, tenant_id, name, slug, city_id, category_id, status)
      VALUES ('${GYM}', '${TENANT}', 'Race Gym', 'race-gym-primary',
              (SELECT id FROM cities LIMIT 1), (SELECT id FROM gym_categories LIMIT 1), 'APPROVED')
      ON CONFLICT (id) DO NOTHING;
    INSERT INTO branches (id, tenant_id, gym_id, name, address_line1, city_id, state, state_code,
                          postal_code, country_code, location, status, is_primary)
    VALUES
      ('${BRANCH_A}', '${TENANT}', '${GYM}', 'Alpha', '1 Road', (SELECT id FROM cities LIMIT 1),
       'Maharashtra', '27', '400053', 'IN',
       ST_SetSRID(ST_MakePoint(72.877, 19.076), 4326)::geography, 'ACTIVE', false),
      ('${BRANCH_B}', '${TENANT}', '${GYM}', 'Beta', '2 Road', (SELECT id FROM cities LIMIT 1),
       'Maharashtra', '27', '400076', 'IN',
       ST_SetSRID(ST_MakePoint(72.905, 19.117), 4326)::geography, 'ACTIVE', false)
      ON CONFLICT (id) DO NOTHING;`);

  // NEITHER starts primary. The race is two transactions claiming a free slot, which is the
  // situation a promote/demote pair creates and the one a counting trigger loses.
  if (!seeded.ok) {
    available = false;
    console.error(`\n  SKIPPING — fixtures failed:\n${seeded.err}\n`);
  }
});

after(() => {
  if (!available) return;
  psql(`
    SET session_replication_role = 'replica';
    DELETE FROM branches WHERE gym_id = '${GYM}';
    DELETE FROM gyms     WHERE id = '${GYM}';
    DELETE FROM tenants  WHERE id = '${TENANT}';`);
});

test('AC-3 · two concurrent promotions produce ONE success and ONE unique violation', async (t) => {
  if (!available) return t.skip('no database');

  const first = openSession();
  const second = openSession();

  try {
    // Both open a transaction and claim the primary slot. The first wins the index lock.
    first.send('BEGIN;');
    first.send(`UPDATE branches SET is_primary = true WHERE id = '${BRANCH_A}';`);
    await settle(400);

    second.send('BEGIN;');
    second.send(`UPDATE branches SET is_primary = true WHERE id = '${BRANCH_B}';`);
    /*
     * The second is now BLOCKED, and that is the assertion this file exists for. It cannot decide
     * yet: whether its write is legal depends on whether the first commits. A counting trigger
     * would have read `count = 0`, allowed the write, and produced two primaries.
     */
    await settle(600);

    first.send('COMMIT;');
    second.send('COMMIT;');

    const [a, b] = await Promise.all([first.close(), second.close()]);
    const combined = `${a.out}${a.err}${b.out}${b.err}`;

    // Exactly one unique violation, and it names the index rather than some generic conflict.
    assert.match(
      combined,
      /uq_branches__one_primary_per_gym/,
      `neither session hit the partial unique index — both promotions may have succeeded:\n${combined}`,
    );
  } finally {
    // `close()` is idempotent enough for a finally: a session already closed resolves immediately.
    await Promise.allSettled([first.close(), second.close()]);
  }

  // The arithmetic, read after both transactions have ended. ONE, not two and not zero.
  const count = psql(
    `SELECT count(*) FROM branches WHERE gym_id = '${GYM}' AND is_primary AND deleted_at IS NULL;`,
  );
  assert.equal(count.ok, true, count.err);
  assert.equal(count.out, '1', `expected exactly one primary branch, found ${count.out}`);
});

test('the survivor is a real branch, not a torn write', async (t) => {
  if (!available) return t.skip('no database');

  /*
   * A weaker constraint could leave the flag set on a row whose other columns never landed. This
   * reads the winner back in full — the point being that whichever transaction won, it won
   * ATOMICALLY, and the loser changed nothing at all.
   */
  const row = psql(`
    SELECT 'winner=' || name || ' active=' || (status::text = 'ACTIVE')::text
      FROM branches WHERE gym_id = '${GYM}' AND is_primary AND deleted_at IS NULL;`);

  assert.equal(row.ok, true, row.err);
  assert.match(row.out, /winner=(Alpha|Beta) active=true/);

  const losers = psql(`SELECT count(*) FROM branches WHERE gym_id = '${GYM}' AND NOT is_primary;`);
  assert.equal(losers.out, '1', 'the losing branch is missing or was also promoted');
});
