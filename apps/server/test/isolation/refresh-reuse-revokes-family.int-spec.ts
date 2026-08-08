/**
 * M-022 AC-4 · `NEGATIVE:` replaying a used token revokes the ENTIRE family — `E1.2`, `BAC-06`.
 *
 * ┌─ WHY THE WHOLE FAMILY, AND NOT THE REPLAYED TOKEN ──────────────────────────────────────────┐
 * │ A refresh token is usable exactly once. A second use of a spent generation means two parties │
 * │ hold the same token, and the replay itself does not say which of the two is the member and   │
 * │ which is the thief — both hold some generation of one chain.                                 │
 * │                                                                                              │
 * │ Revoking only the replayed token is therefore a coin flip: half the time it locks out the    │
 * │ victim and leaves the attacker with a live session. Revoking the family ends the theft with  │
 * │ certainty and costs the member one re-login. ADR-0011 takes that trade deliberately.         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE GRACE WINDOW IS STEPPED OVER, NOT WAITED OUT ──────────────────────────────────────────┐
 * │ `TR-28`'s grace makes a replay within ten seconds a parallel tab rather than an attack, so a │
 * │ test of the ATTACK path has to be outside it. Sleeping eleven seconds per case would add     │
 * │ most of a minute to the suite and make it a candidate for being skipped in CI.               │
 * │                                                                                              │
 * │ Instead the stored `used_at` is aged backwards with SQL. That is a fixture, not a shortcut:  │
 * │ the production code reads exactly the same column, and the alternative is a slow test that   │
 * │ asserts the same thing. `refresh-parallel-tabs.int-spec.ts` covers the inside of the window  │
 * │ with genuinely concurrent requests and no clock manipulation at all.                         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
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

/**
 * Ages every spent generation on this user's sessions past the TR-28 grace.
 *
 * `session_replication_role = replica` suspends user triggers for this transaction, because
 * `trg_refresh_tokens__completion_is_write_once` refuses to let `used_at` move — for `postgres`
 * as much as for `app_rw`, which is the whole point of it. Suspending it here is the narrowest
 * way to write a fixture the production path is forbidden to write, and its scope is `LOCAL`:
 * one transaction, restored on commit.
 */
function ageSpentTokensPastGrace(userId: string): void {
  const affected = psql(`
    BEGIN;
    SET LOCAL session_replication_role = replica;
    UPDATE refresh_tokens SET used_at = used_at - interval '60 seconds'
     WHERE used_at IS NOT NULL
       AND session_id IN (SELECT id FROM auth_sessions WHERE user_id = '${userId}')
    RETURNING 1;
    COMMIT;`);

  // A silent no-op here would make every assertion below pass against an unspent chain, which is
  // the failure mode that makes a NEGATIVE test worthless. It has already caught one: the first
  // draft of this fixture was refused by the trigger, and `psql` without ON_ERROR_STOP reported
  // that as an empty result rather than an error.
  assert.match(affected, /1/, 'no spent generation was aged — the fixture did nothing');
}

const activeSessionCount = (userId: string): number =>
  Number(
    psql(`SELECT count(*) FROM auth_sessions
           WHERE user_id = '${userId}' AND status = 'ACTIVE' AND revoked_at IS NULL;`),
  );

// ═══════════════════════════════════════════════════════════════════════════
// AC-4 — the replay, and what it costs the attacker.
// ═══════════════════════════════════════════════════════════════════════════

it('NEGATIVE: replaying a spent generation is refused', async () => {
  const session = await registerAndLogin(harness);

  const rotated = await harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie });
  assert.equal(rotated.status, 200, JSON.stringify(rotated.body));

  ageSpentTokensPastGrace(session.userId);

  // The ORIGINAL cookie, presented a second time. This is the token a thief would hold.
  const replay = await harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie });
  assert.equal(replay.status, 401, `the replay was accepted: ${JSON.stringify(replay.body)}`);
});

it('E1.2 · the replay revokes the whole family, not just the replayed generation', async () => {
  const session = await registerAndLogin(harness);
  assert.equal(activeSessionCount(session.userId), 1, 'login did not open exactly one session');

  const rotated = await harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie });
  const rotatedCookie = cookieFrom(rotated.setCookie);

  ageSpentTokensPastGrace(session.userId);
  await harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie });

  // The CURRENT, never-replayed token is now dead too. That is the point: the member's own
  // browser is signed out, because we cannot tell their token from the thief's.
  const afterReuse = await harness.request('POST', '/v1/auth/refresh', { cookie: rotatedCookie });
  assert.equal(
    afterReuse.status,
    401,
    'the legitimate current token still works — the family was not revoked',
  );

  assert.equal(activeSessionCount(session.userId), 0, 'a session in the family stayed ACTIVE');
});

it('E1.2 · every device on the family goes, not only the one that replayed', async () => {
  // Two logins on one account are two families, so this asserts the case that actually matters:
  // several sessions sharing ONE family, as a rotation chain produces. The revocation is keyed
  // on `family_id`, and a per-session revocation would leave the others running.
  const session = await registerAndLogin(harness);

  const family = psql(
    `SELECT family_id FROM auth_sessions WHERE user_id = '${session.userId}' LIMIT 1;`,
  );
  assert.notEqual(family, '', 'no family was recorded for the session');

  const rotated = await harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie });
  assert.equal(rotated.status, 200);

  ageSpentTokensPastGrace(session.userId);
  await harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie });

  const stillActive = psql(`
    SELECT count(*) FROM auth_sessions
     WHERE family_id = '${family}' AND status = 'ACTIVE' AND revoked_at IS NULL;`);
  assert.equal(stillActive, '0', 'a session on the revoked family survived');
});

it('the revocation reason is recorded as reuse, distinctly from a sign-out', async () => {
  // ALRT-32 counts this value. If reuse were folded into `USER_SIGNED_OUT`, the one alert that
  // matters would be invisible among every routine logout on the platform.
  const session = await registerAndLogin(harness);
  await harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie });

  ageSpentTokensPastGrace(session.userId);
  await harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie });

  const reasons = psql(`
    SELECT DISTINCT revoked_reason FROM auth_sessions WHERE user_id = '${session.userId}';`);
  assert.equal(reasons, 'TOKEN_REUSE_DETECTED', `recorded reason was "${reasons}"`);
});

// ═══════════════════════════════════════════════════════════════════════════
// The false positives this must NOT produce.
// ═══════════════════════════════════════════════════════════════════════════

it('an ordinary rotation chain does not trip the detector', async () => {
  // Four honest refreshes in a row. If sequential rotation were read as reuse, the detector would
  // fire on every active member in the platform and the alert would be worthless within a day.
  const session = await registerAndLogin(harness);
  let cookie = session.cookie;

  for (let i = 0; i < 4; i += 1) {
    const rotated = await harness.request('POST', '/v1/auth/refresh', { cookie });
    assert.equal(rotated.status, 200, `rotation ${i + 1} was refused`);
    cookie = cookieFrom(rotated.setCookie);
  }

  assert.equal(activeSessionCount(session.userId), 1, 'an honest chain revoked its own family');
});

it('an unknown or malformed cookie is a plain 401, not a family revocation', async () => {
  // A token we never issued cannot identify a family, so there is nothing to revoke — and
  // treating it as reuse would hand any anonymous caller a denial-of-service against a member
  // whose family id they could guess.
  const session = await registerAndLogin(harness);

  const bogus = await harness.request('POST', '/v1/auth/refresh', {
    cookie: '__Host-gm_rt=not-a-token-we-ever-issued',
  });
  assert.equal(bogus.status, 401);

  assert.equal(activeSessionCount(session.userId), 1, 'an unrelated session was revoked');
  const good = await harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie });
  assert.equal(good.status, 200, 'a bystander session stopped working');
});
