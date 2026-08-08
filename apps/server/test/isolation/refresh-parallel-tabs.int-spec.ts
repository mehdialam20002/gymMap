/**
 * M-022 AC-5 · `TR-28` — two simultaneous refreshes must not look like a theft.
 *
 * ┌─ THE FALSE POSITIVE THIS EXISTS TO PREVENT ─────────────────────────────────────────────────┐
 * │ A mobile browser restoring two tabs fires two refreshes within milliseconds, both carrying   │
 * │ the SAME generation. A naive reuse detector sees the second as a replay, revokes the family, │
 * │ signs the member out of every device they own — and files a security event that did not      │
 * │ happen.                                                                                       │
 * │                                                                                              │
 * │ `docs/runbooks/iam.md` names "refresh-family false positive" as one of the module's top      │
 * │ three failure modes because the damage is silent and cumulative: members are logged out at   │
 * │ random, support cannot reproduce it, and the alert that would catch a real theft is buried.  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ GENUINELY CONCURRENT, WHICH THE ACCEPTANCE CRITERION INSISTS ON ───────────────────────────┐
 * │ AC-5 requires *"genuinely concurrent refreshes, not sequential ones"*, and the distinction   │
 * │ is not pedantry. Two sequential requests exercise the grace-window comparison. Two in-flight │
 * │ at once exercise the interleaving underneath it — both reading `used_at IS NULL`, both       │
 * │ deciding to rotate, and racing on the same unique generation.                                │
 * │                                                                                              │
 * │ So these fire with `Promise.all` and no await between them, and the assertions are written   │
 * │ to accept EITHER permitted outcome: both succeed, or one waits and then succeeds. What is    │
 * │ never acceptable is a revoked family.                                                         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * No clock manipulation anywhere in this file. The window under test is the live one.
 */

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

import { applyTestEnv } from '../harness/test-env.ts';
import { SessionHarness, cookieFrom, psql, registerAndLogin } from './_session-harness.ts';

applyTestEnv();

const harness = new SessionHarness();

before(async () => {
  await harness.boot();
});
after(async () => {
  await harness.shutdown();
});

const it = (name: string, fn: () => Promise<void>) =>
  test(name, async (t) => {
    if (!harness.available) return t.skip('no api');
    await fn();
  });

const activeSessionCount = (userId: string): number =>
  Number(
    psql(`SELECT count(*) FROM auth_sessions
           WHERE user_id = '${userId}' AND status = 'ACTIVE' AND revoked_at IS NULL;`),
  );

const revocationReasons = (userId: string): string =>
  psql(`SELECT DISTINCT coalesce(revoked_reason, '-') FROM auth_sessions
         WHERE user_id = '${userId}';`);

// ═══════════════════════════════════════════════════════════════════════════
// AC-5 — the race itself.
// ═══════════════════════════════════════════════════════════════════════════

it('TR-28 · two simultaneous refreshes on one cookie do not revoke the family', async () => {
  const session = await registerAndLogin(harness);

  // Both in flight before either resolves. No `await` between them — that is the difference
  // between testing the race and testing two sequential calls.
  const [first, second] = await Promise.all([
    harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie }),
    harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie }),
  ]);

  assert.equal(
    activeSessionCount(session.userId),
    1,
    'a parallel tab was treated as a token theft — the family was revoked',
  );
  assert.equal(
    revocationReasons(session.userId),
    '-',
    'a revocation reason was recorded for a race that is not an attack',
  );

  // Both succeeding, or one succeeding and the other being asked to retry, are both permitted by
  // §5.1. A 401 is not: it would sign the second tab out of a session that is perfectly alive.
  for (const [label, response] of [
    ['first', first],
    ['second', second],
  ] as const) {
    assert.notEqual(
      response.status,
      401,
      `the ${label} concurrent refresh was rejected: ${JSON.stringify(response.body)}`,
    );
  }
});

it('TR-28 · the member still holds a WORKING token after the race', async () => {
  // The strongest form of the assertion. "The family was not revoked" is necessary but not
  // sufficient — a race that leaves the member with two dead cookies has still logged them out,
  // and the database would look perfectly healthy.
  const session = await registerAndLogin(harness);

  const results = await Promise.all([
    harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie }),
    harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie }),
  ]);

  const issued = results.filter((r) => r.status === 200 && r.setCookie !== null);
  assert.ok(issued.length >= 1, 'neither concurrent refresh produced a usable token');

  // Whichever cookie the tabs ended up holding must still rotate.
  const survivor = cookieFrom(issued[issued.length - 1]!.setCookie);
  const next = await harness.request('POST', '/v1/auth/refresh', { cookie: survivor });
  assert.equal(next.status, 200, `the post-race token does not work: ${JSON.stringify(next.body)}`);
});

it('TR-28 · a replay inside the grace returns a token rather than an alarm', async () => {
  // The sequential form of the same window — a tab that was slow rather than simultaneous.
  // Immediately after a rotation, the spent cookie is still worth a token because the successor
  // it points at is the one the first tab already received.
  const session = await registerAndLogin(harness);

  const rotated = await harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie });
  assert.equal(rotated.status, 200);

  const replay = await harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie });
  assert.equal(
    replay.status,
    200,
    `an in-grace replay was refused: ${JSON.stringify(replay.body)}`,
  );
  assert.equal(typeof replay.body.access_token, 'string');
  assert.equal(activeSessionCount(session.userId), 1);
});

it('TR-28 · five simultaneous refreshes still do not revoke the family', async () => {
  // A restored browser window is not limited to two tabs. Widening the fan-out is where a
  // detector that happens to survive N=2 by luck rather than by design gives itself away.
  const session = await registerAndLogin(harness);

  const responses = await Promise.all(
    Array.from({ length: 5 }, () =>
      harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie }),
    ),
  );

  assert.equal(activeSessionCount(session.userId), 1, 'five tabs were read as a theft');
  const rejected = responses.filter((r) => r.status === 401);
  assert.equal(rejected.length, 0, `${rejected.length} of five tabs were signed out`);
});

// ═══════════════════════════════════════════════════════════════════════════
// The property that must survive the tolerance above.
// ═══════════════════════════════════════════════════════════════════════════

it('the grace does not make a spent generation reusable forever', async () => {
  // The cost of the window has to stay bounded, or "tolerate a parallel tab" quietly becomes
  // "a spent token never dies" — which would remove reuse detection altogether while every test
  // in the reuse suite kept passing.
  const session = await registerAndLogin(harness);
  await harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie });

  // Aged past the grace with triggers suspended for the fixture only — the write-once trigger
  // refuses this transition for every role, which is exactly what it is there for.
  psql(`BEGIN;
        SET LOCAL session_replication_role = replica;
        UPDATE refresh_tokens SET used_at = used_at - interval '60 seconds'
         WHERE used_at IS NOT NULL
           AND session_id IN (SELECT id FROM auth_sessions WHERE user_id = '${session.userId}');
        COMMIT;`);

  const late = await harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie });
  assert.equal(late.status, 401, 'a replay outside the grace was still accepted');
});
