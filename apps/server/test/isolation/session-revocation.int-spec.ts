/**
 * M-022 AC-6, AC-10 · Revocation reaches an access token that is still validly signed.
 *
 * ┌─ WHAT AC-10 IS ACTUALLY ASKING FOR ─────────────────────────────────────────────────────────┐
 * │ An access token is a signed assertion with a fifteen-minute life. Nothing about revoking a   │
 * │ session changes the bytes of a token already in an attacker's hands — it still verifies,     │
 * │ because it was genuinely issued and has not expired.                                        │
 * │                                                                                              │
 * │ So without a denylist, "revoked" means "the next REFRESH fails", and a thief whose family    │
 * │ we have just detected and revoked stays authenticated for the remaining quarter of an hour   │
 * │ — after detection, after the member clicked "sign out this device", after everything the     │
 * │ product told them worked. AC-10 says that is not revocation. AC-6 puts a number on it: 60s.  │
 * │                                                                                              │
 * │ The mechanism is a short-lived Redis denylist keyed on `family_id`, checked by the guard on  │
 * │ every authenticated request, with a TTL equal to the access-token lifetime — so the list     │
 * │ holds only families revoked inside the current token window and is small by construction.    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ ASSERTED THROUGH THE GUARD, NOT AGAINST REDIS ─────────────────────────────────────────────┐
 * │ Reading the denylist key back would prove that a write happened. It would not prove that the │
 * │ guard consults it, which is the only part a member's security depends on — and a denylist    │
 * │ nobody reads is precisely the defect worth catching. Every assertion here is an HTTP call    │
 * │ carrying a real token.                                                                        │
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

const listSessions = (bearer: string) => harness.request('GET', '/v1/auth/sessions', { bearer });

// ═══════════════════════════════════════════════════════════════════════════
// FR-AUTH-09 — the screen a member uses to spot the device they do not know.
// ═══════════════════════════════════════════════════════════════════════════

it('FR-AUTH-09 · the listing carries device, address, start time and a `current` flag', async () => {
  const session = await registerAndLogin(harness);

  const listed = await listSessions(session.accessToken);
  assert.equal(listed.status, 200, JSON.stringify(listed.body));
  assert.equal(listed.body.sessions.length, 1);

  const [row] = listed.body.sessions;
  assert.equal(typeof row.id, 'string');
  assert.equal(typeof row.started_at, 'string');
  assert.ok('device_label' in row);
  assert.ok('ip' in row);

  // Without `current`, the most common outcome of this screen is a member signing themselves out
  // by accident and concluding the feature is broken.
  assert.equal(row.current, true, 'the calling session is not flagged as the current one');
});

it('a second login appears as a second row, and only one is `current`', async () => {
  const first = await registerAndLogin(harness);

  const second = await harness.request('POST', '/v1/auth/login', {
    body: { identifier: first.email, password: 'correct horse battery staple' },
  });
  assert.equal(second.status, 200, JSON.stringify(second.body));

  const listed = await listSessions(second.body.access_token);
  assert.equal(listed.body.sessions.length, 2, 'the second device did not open its own session');
  const current = listed.body.sessions.filter((s: { current: boolean }) => s.current);
  assert.equal(current.length, 1, 'two rows claim to be the current session');
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-6, AC-10 — revocation that reaches the token already issued.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-10 · revoking a session kills its access token immediately, not at expiry', async () => {
  const session = await registerAndLogin(harness);

  const before = await listSessions(session.accessToken);
  assert.equal(before.status, 200, 'the token did not work before revocation');
  const sessionId = before.body.sessions[0].id;

  const revoked = await harness.request('DELETE', `/v1/auth/sessions/${sessionId}`, {
    bearer: session.accessToken,
  });
  assert.equal(revoked.status, 204, JSON.stringify(revoked.body));

  // The SAME token, still validly signed and minutes from expiry. AC-6 allows 60 seconds; the
  // denylist is written inside the revocation, so the correct answer is "already".
  const afterRevoke = await listSessions(session.accessToken);
  assert.equal(
    afterRevoke.status,
    401,
    'a revoked session s access token still authenticates — AC-10 is not enforced',
  );
});

it('AC-10 · the revoked token cannot refresh either', async () => {
  const session = await registerAndLogin(harness);
  const listed = await listSessions(session.accessToken);

  await harness.request('DELETE', `/v1/auth/sessions/${listed.body.sessions[0].id}`, {
    bearer: session.accessToken,
  });

  const refreshed = await harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie });
  assert.equal(refreshed.status, 401, 'a revoked session could still mint a new access token');
});

it('revoking one device leaves the other signed in', async () => {
  // The feature is "sign out THAT device". A revocation that reaches further than the family it
  // names would make the screen unusable — and members would stop trusting it precisely when
  // they need it, which is while an unknown device is on the list.
  const first = await registerAndLogin(harness);
  const second = await harness.request('POST', '/v1/auth/login', {
    body: { identifier: first.email, password: 'correct horse battery staple' },
  });
  const secondToken = second.body.access_token;

  const listed = await listSessions(secondToken);
  const other = listed.body.sessions.find((s: { current: boolean }) => !s.current);
  assert.ok(other, 'the other device was not listed');

  const revoked = await harness.request('DELETE', `/v1/auth/sessions/${other.id}`, {
    bearer: secondToken,
  });
  assert.equal(revoked.status, 204);

  const stillHere = await listSessions(secondToken);
  assert.equal(stillHere.status, 200, 'revoking one device signed out the other');
  assert.equal(stillHere.body.sessions.length, 1);

  const dead = await listSessions(first.accessToken);
  assert.equal(dead.status, 401, 'the revoked device kept working');
});

// ═══════════════════════════════════════════════════════════════════════════
// The 404 that is deliberately not a 403.
// ═══════════════════════════════════════════════════════════════════════════

it("NEGATIVE: another member's session id is a 404, never a 403", async () => {
  // A 403 confirms the uuid exists, which turns this route into an oracle for enumerating live
  // session ids. "Not yours" and "no such session" must be one indistinguishable answer.
  const mine = await registerAndLogin(harness);
  const theirs = await registerAndLogin(harness);

  const theirList = await listSessions(theirs.accessToken);
  const theirSessionId = theirList.body.sessions[0].id;

  const attempt = await harness.request('DELETE', `/v1/auth/sessions/${theirSessionId}`, {
    bearer: mine.accessToken,
  });
  assert.equal(attempt.status, 404, `cross-account revocation returned ${attempt.status}`);

  // And it did not work anyway.
  const theirsAfter = await listSessions(theirs.accessToken);
  assert.equal(theirsAfter.status, 200, "another member's session was revoked across accounts");
});

it('NEGATIVE: an unknown session id is the SAME 404', async () => {
  const session = await registerAndLogin(harness);
  const attempt = await harness.request(
    'DELETE',
    '/v1/auth/sessions/00000000-0000-4000-8000-000000000000',
    { bearer: session.accessToken },
  );
  assert.equal(attempt.status, 404);
});

it('NEGATIVE: the listing needs a principal — no token, no sessions', async () => {
  const anonymous = await harness.request('GET', '/v1/auth/sessions');
  assert.equal(anonymous.status, 401);
});

// ═══════════════════════════════════════════════════════════════════════════
// Logout — §8.6.
// ═══════════════════════════════════════════════════════════════════════════

it('logout revokes the session and clears the cookie', async () => {
  const session = await registerAndLogin(harness);

  const out = await harness.request('POST', '/v1/auth/logout', { cookie: session.cookie });
  assert.equal(out.status, 204);
  assert.match(out.setCookie ?? '', /__Host-gm_rt=;|__Host-gm_rt=""/, 'the cookie was not cleared');

  const reuse = await harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie });
  assert.equal(reuse.status, 401, 'the refresh cookie still worked after logout');
});

it('logout is 204 even with no cookie, an unknown cookie, or twice', async () => {
  // A logout that can fail is a logout a member cannot rely on, and the failure would arrive at
  // the exact moment they are trying to leave a shared device.
  const session = await registerAndLogin(harness);

  const none = await harness.request('POST', '/v1/auth/logout');
  assert.equal(none.status, 204);

  const unknown = await harness.request('POST', '/v1/auth/logout', {
    cookie: '__Host-gm_rt=never-issued-by-us',
  });
  assert.equal(unknown.status, 204);

  assert.equal(
    (await harness.request('POST', '/v1/auth/logout', { cookie: session.cookie })).status,
    204,
  );
  assert.equal(
    (await harness.request('POST', '/v1/auth/logout', { cookie: session.cookie })).status,
    204,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-7 — one revocation path, shared with the password reset.
// ═══════════════════════════════════════════════════════════════════════════

it('AC-7 · a rotated session is still revocable, and the rotation is recorded', async () => {
  // Revocation must key on the FAMILY rather than on the token presented, or a session that has
  // rotated a few times becomes unrevocable — the id the member sees on screen would no longer
  // correspond to anything the revocation path could find.
  const session = await registerAndLogin(harness);

  const rotated = await harness.request('POST', '/v1/auth/refresh', { cookie: session.cookie });
  assert.equal(rotated.status, 200);
  const rotatedCookie = cookieFrom(rotated.setCookie);

  const generations = psql(`
    SELECT count(*) FROM refresh_tokens
     WHERE session_id IN (SELECT id FROM auth_sessions WHERE user_id = '${session.userId}');`);
  assert.equal(generations, '2', 'rotation did not leave a chain of two generations');

  const listed = await listSessions(rotated.body.access_token);
  const revoked = await harness.request(
    'DELETE',
    `/v1/auth/sessions/${listed.body.sessions[0].id}`,
    {
      bearer: rotated.body.access_token,
    },
  );
  assert.equal(revoked.status, 204, 'a rotated session could not be revoked');

  const afterRevoke = await harness.request('POST', '/v1/auth/refresh', { cookie: rotatedCookie });
  assert.equal(afterRevoke.status, 401);
});
