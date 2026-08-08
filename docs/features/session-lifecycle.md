# Session lifecycle

> **Scope.** How a session begins, renews, is listed, and ends. Written against what is built as of
> `M-022`. Governing requirements: `FR-AUTH-06`, `FR-AUTH-09`, `FR-AUTH-10`, `E1.1`, `E1.2`, `TR-28`,
> `SE1`, `TK7`, `NFR-SEC-07`, and `ADR-0011`, which is the decision this document implements.

---

## 1. Two tokens, because they answer different questions

| | Access token | Refresh token |
| :--- | :--- | :--- |
| Lifetime | **15 minutes** | **30 days** |
| Carried in | `Authorization: Bearer` header | the `__Host-gm_rt` cookie, and nowhere else |
| Readable by script | yes, necessarily | **no** — `httpOnly` |
| Stored server-side | not at all | as a **SHA-256 digest**, never the token (`NFR-SEC-07`) |
| Answers | "who is this request" | "may this person get another access token" |

The access token is short because it cannot be withdrawn cheaply — it is a signed assertion, and
every verifier can check it without asking anyone. The refresh token is long because it can be
withdrawn: it is a row.

**The access token IS returned in a response body, and the refresh token is not.** This looks
inconsistent and is not. `SE1` and `TK7` forbid a body token for the long-lived credential
specifically: an XSS that can read `localStorage` still cannot read an `httpOnly` cookie, so a
script injection does not hand an attacker thirty days of access. The access token has to be in the
body because the SPA must place it in a header, and it is worth fifteen minutes.

### Why every cookie attribute is there

```text
Set-Cookie: __Host-gm_rt=<token>; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Strict
```

| Attribute | What it buys |
| :--- | :--- |
| `HttpOnly` | the requirement. Script cannot read it, so an XSS does not yield a 30-day credential |
| `Secure` | demanded by `__Host-`; also stops the token crossing plain HTTP |
| `SameSite=Strict` | the cookie does not ride a cross-site request, which is what makes a CSRF against `/auth/refresh` inert |
| `Path=/` | demanded by `__Host-`. A narrower path looks tighter and is not permitted with the prefix |
| **no** `Domain` | demanded by `__Host-`. Pinned to the exact host that set it; cannot be widened to a sibling subdomain by whoever compromises one |

The set and the clear must carry **identical** attributes. A browser matches a clear against a set
by name, path and domain — so a logout whose attributes differ leaves the original cookie in place,
and the member believes they signed out. One module, `refresh-cookie.ts`, owns both.

---

## 2. The chain

A session is a **family**. Each refresh mints generation N+1 and spends generation N, so any given
refresh token is usable exactly once.

```text
login ──▶ gen 1 ──rotate──▶ gen 2 ──rotate──▶ gen 3 ──▶ …
             │                 │
        used_at set       used_at set
     superseded_by → 2   superseded_by → 3
```

Spending is recorded by setting `used_at` and `superseded_by_id` **together**. A `used_at` with a
null successor is the state the policy reads as reuse, so writing them apart would manufacture an
alarm in the window between the two statements.

### What may be written, and by whom

`refresh_tokens` is grant class **G-COMPLETE** (`Schema.md` §4.8, deviation `D-04`):

```sql
GRANT SELECT, INSERT                     ON refresh_tokens TO app_rw;
GRANT UPDATE (used_at, superseded_by_id) ON refresh_tokens TO app_rw;
```

No `DELETE`, no `TRUNCATE`, and no other column. The chain is the audit trail, and a row that can be
deleted is a replay that can be denied.

**A column-scoped grant is not sufficient on its own, and M-022 found this.** It restricts *which*
column may be written and says nothing about how many times or in which direction — so `app_rw`
could have written `used_at = NULL` and silenced reuse detection for the theft it was committing.
`trg_refresh_tokens__completion_is_write_once` closes it: each of the two columns goes from `NULL`
to a value exactly once, for every role including `postgres`. Write-once is a statement about the
*transition*, which is why it is a trigger and not a `CHECK` — a `CHECK` cannot see `OLD`.

---

## 3. Reuse detection — `E1.2`

A second use of a spent generation means two parties hold the same token. The response is to revoke
the **entire family**, not the replayed token.

That is deliberate and it is a trade. The replay does not say which party is the member and which is
the thief — both hold some generation of one chain. Revoking only the replayed token is a coin flip
that half the time locks out the victim and leaves the attacker running. Revoking the family ends
the theft with certainty and costs the member one re-login.

`revoked_reason` is set to `TOKEN_REUSE_DETECTED`, kept distinct from `USER_SIGNED_OUT` because
`ALRT-32` counts the first. Folding them together would hide the one alert that matters among every
routine logout on the platform.

### The four outcomes, and the order they are decided in

| Presented generation | Decision |
| :--- | :--- |
| session no longer active | `EXPIRED` |
| past `expires_at` | `EXPIRED` |
| `used_at IS NULL` | `ROTATE` |
| spent, within 10 s, has a successor | `REPLAY_WITHIN_GRACE` — return the successor |
| spent, otherwise | `REUSE_DETECTED` — revoke the family |

**The session check comes first, and that ordering is load-bearing.** Revoking a family spends every
token in it — so a member refreshing after a password reset presents a spent generation and is, by
the token alone, indistinguishable from a thief. If the reuse branch ran first, every password reset
on the platform would report a token theft and the real ones would drown.

---

## 4. `TR-28` — the parallel tab

A mobile browser restoring two tabs fires two refreshes within milliseconds carrying the same
generation. A naive detector calls the second one theft, revokes the family, and signs the member
out of every device they own over an event that did not happen.

`Authentication.md` §5.1 permits a **grace window** or a **rotation lock**. The grace was chosen:

| | Rotation lock | Grace window (chosen) |
| :--- | :--- | :--- |
| Mechanism | serialise every refresh on a family through one mutex | compare `used_at` against a timestamp already on the row |
| Cost | a distributed lock on the hottest authenticated path in the system | a spent token stays worth something for 10 seconds |
| Worst failure | a lock left holding after a crash signs the member out for its whole TTL | an attacker must replay **inside** 10 s of a legitimate rotation |

The second failure is the smaller one. An attacker who can replay within ten seconds of the real
rotation was already watching in real time — and a real-time attacker holds the live token anyway.

Ten seconds is long enough for a tab restore on a slow device and short enough that the window is
worth almost nothing. A replay inside it returns **the successor the original rotation already
minted**, so the two tabs converge on one token rather than racing to mint two.

`refresh-parallel-tabs.int-spec.ts` proves this with `Promise.all` and no clock manipulation, at two
tabs and at five, because `AC-5` requires *"genuinely concurrent refreshes, not sequential ones"*.

---

## 5. Listing and revoking — `FR-AUTH-09`

`GET /v1/auth/sessions` returns device label, IP, start time, and a `current` flag per row.

The `current` flag is not a nicety. Without it, the most common outcome of this screen is a member
signing themselves out by accident and concluding the feature is broken. The IP is the member's own,
shown on their own screen, unmasked — masking it would remove the exact signal the page exists to
give: *"signed in from a city I have never visited"*.

`DELETE /v1/auth/sessions/:sessionId` revokes one. A session belonging to anyone else is a **404 and
not a 403**: a 403 confirms the uuid exists, which turns the route into an oracle for enumerating
live sessions. "Not yours" and "no such session" are one answer.

### `AC-10` — revocation that reaches a token already issued

An access token is a signed assertion. Revoking a session changes none of its bytes, and it keeps
verifying for the rest of its fifteen minutes.

So without a denylist, *"revoked"* means *"the next refresh fails"* — and a thief whose family was
just detected stays authenticated for a quarter of an hour after detection, after the member pressed
the button the product gave them. `AC-6` puts a number on the requirement: 60 seconds.

The mechanism is a Redis key, `auth:revoked-family:{fam}`, checked by the guard on every
authenticated request, with a **TTL equal to the access-token lifetime** — so the list holds only
families revoked inside the current token window and is small by construction.

It **fails open**. If Redis is unreachable it denies nothing, because signing the entire platform out
because a cache restarted is the worse of the two failures. This is the one place in the session
design where availability wins over strictness, and it is bounded: the affected window is at most
fifteen minutes, and the next refresh still fails.

---

## 6. Ending a session

`POST /v1/auth/logout` returns **204 unconditionally** — for a missing cookie, an unknown cookie, an
already-spent one, and a second call. A logout that can fail is a logout a member cannot rely on,
and the failure would arrive at the exact moment they are trying to leave a shared device. The
cookie is cleared **first**, so a failure downstream still leaves the browser without the credential.

**One revocation path.** `AC-7` requires that session revocation and password reset share a single
code path *"so a fix to either cannot diverge"*. Everything — explicit revocation, logout, password
reset, and reuse detection — goes through `revokeFamilyEverywhere`, which revokes the sessions and
writes the denylist entry as one operation. A second path is a second place to forget the denylist.

---

## 7. Where this is proved

| File | Layer | What it establishes |
| :--- | :--- | :--- |
| `refresh-rotation.policy.spec.ts` | Unit | every branch of the decision, and its order |
| `refresh-reuse-revokes-family.int-spec.ts` | Integration | `E1.2` — a replay revokes every session in the family |
| `refresh-parallel-tabs.int-spec.ts` | Integration | `TR-28` under genuine concurrency, no clock manipulation |
| `refresh-token-grants.int-spec.ts` | Integration | `G-COMPLETE`, and write-once, asserted as `gymmap_app` |
| `session-revocation.int-spec.ts` | Integration | `AC-6` / `AC-10` through the guard over real HTTP |
| `auth-sessions.contract-spec.ts` | Contract | the four routes as the generated document describes them |

The grant tests connect as `gymmap_app`, never as `postgres`. A grant test run as a superuser
asserts nothing at all — every statement succeeds, including the ones that must not.

---

## 8. Rollback

Flag `rel.iam.session-rotation`. **Off:** refresh tokens are issued and accepted but not rotated on
use — a strictly weaker posture that keeps members signed in while a rotation defect is diagnosed.

The flag **never** disables reuse detection or family revocation. `FEATURE_FLAGS.md` §2.2 forbids
flagging a security control off, and it is moot in any case: with rotation paused there is no spent
generation for a replay to present.
