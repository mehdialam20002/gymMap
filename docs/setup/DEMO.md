# Running the demo

> **What this is.** The exact steps to get the admin console and the customer website running
> locally, and an honest statement of what is real behind each screen. Written 2026-08-08, after
> `M-022`.

---

## 1. Start it

Four terminals, in this order. The two front ends need the API; neither will start it for you.

```bash
# 1 · infrastructure — Postgres 16 + PostGIS, Redis 7, MinIO, Mailpit
pnpm infra:up
pnpm infra:ps                      # all four healthy before continuing

# 2 · the API on :3000
cd apps/server
pnpm build
node --env-file=../../.env.local dist/main.js

# 3 · the customer website on :3001
cd apps/customer-web
pnpm dev

# 4 · the admin console on :3003
cd apps/admin-dashboard
pnpm dev
```

| Surface | URL | Needs the API? |
| :--- | :--- | :--- |
| Customer website | <http://localhost:3001> | no — the catalogue is a fixture |
| Admin console | <http://localhost:3003> | **yes** — nothing loads without it |
| API readiness | <http://localhost:3000/readyz> | — |

`/readyz` must answer `{"status":"ready","dependencies":{"redis":true,"postgres":true}}`. Anything
else and the admin console will show a sign-in form that cannot succeed.

### The env file matters

`node --env-file=../../.env.local` is not optional — the server validates its configuration at
boot and refuses to start rather than defaulting a secret (`constitution §8.9`). Two settings bite:

- `PAYMENT_PROVIDER=stub`. Setting `razorpay` requires all three Razorpay secrets, and the server
  will not boot without them. That is deliberate: `BR-PAY-02` makes activation webhook-driven, so
  an empty webhook secret would mean checkouts that take money and activate nothing.
- `DATABASE_URL` and `REDIS_URL` point at the compose stack from step 1.

---

## 2. Sign in to the admin console

There is no seeded password anywhere — the eleven seeded principals deliberately have **no**
`password_hash`. Create an account:

```bash
curl -X POST http://localhost:3000/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"demo@gymmap.in","password":"demo passphrase 2026"}'
```

Then sign in at <http://localhost:3003> with those credentials.

> The password minimum is 10 characters with **no composition rule** — no forced symbol, no forced
> digit. That is `Security.md` §2.4.1, and it is the modern guidance: length beats a symbol nobody
> can remember.

---

## 3. What is actually real

The point of this section is that a demo should not be mistaken for a finished product, and the
person giving it should know which questions have good answers.

### Admin console — real

| Screen | Backed by |
| :--- | :--- |
| Sign in | `POST /v1/auth/login`. Real Argon2id, real lockout after 10 attempts |
| Staying signed in | The `__Host-gm_rt` httpOnly cookie. Reload the page — the session survives, because the token is renewed silently |
| Dashboard · API and Dependencies tiles | `GET /readyz`, polled. Stop Redis with `docker stop gymmap-redis` and watch it go red |
| Your devices | `GET /v1/auth/sessions`. Sign in from a second browser and a second row appears |
| Revoking a device | `DELETE /v1/auth/sessions/:id`. The revoked browser is signed out **immediately**, not when its token expires |
| Sign out | `POST /v1/auth/logout` |

**The demo worth giving:** open the console in two browsers, revoke one from the other, then click
anything in the revoked browser. It is signed out at once. That is `AC-10` — an access token is a
signed assertion and revoking a session does not change its bytes, so without a denylist "revoked"
would mean "fails at the next refresh" and a stolen session would keep working for fifteen minutes
after you revoked it.

### Admin console — not real, and labelled as such

Approvals, Gyms, Finance, Moderation and Audit render a panel naming the milestone that delivers
them. The dashboard shows **no figure** for those — not a zero. A zero meaning "not built" and a
zero meaning "nothing to approve today" look identical, and only one of them needs an operator.

`permissions` is empty until `M-023` encodes the B3.2 matrix, and the MFA step is unreachable until
`M-024`. Both are stated in the code rather than stubbed to "satisfied".

### Customer website — real UI, fixture data

Home, search and the gym page are fully built and server-rendered. Search, the city and activity
facets, all five sorts, the empty state and the 404 all work.

**The eight gyms are invented.** `gyms`, `branches` and `plans` are created by `M-026`…`M-036`, so
there is nothing to read yet. Every page that shows them carries a banner saying so — do not remove
it for a screenshot.

The **Join this gym** button is deliberately disabled. Checkout is `EP-08`.

Things worth pointing at, because they are the product's actual differentiators:

- Two gyms show *"New listing · no reviews yet"* rather than 0.0 stars. `BR-REV-01` — a review
  requires a recorded check-in, so a new gym has none, and scoring it zero would be the platform
  making a claim about a business that has done nothing wrong.
- Every gym carries a **Verified** badge. `BR-GYM-01` — nothing is listed before a human approves
  it. That is why the catalogue is smaller than a directory that lists anyone.
- The plan price says the price shown is the price charged, revalidated server-side. `BR-PLN-03`.

---

## 4. If something is wrong

| Symptom | Cause |
| :--- | :--- |
| Admin sign-in says "Could not reach the server" | The API is not running, or not on :3000. Check `/readyz` |
| Sign-in fails with correct credentials | Ten failed attempts locks the account for 15 minutes (`FR-AUTH-08`). Wait, or register a new address |
| `/readyz` says `not_ready` | Read `dependencies` — it names which of Postgres and Redis is down |
| The server exits at boot with a wall of config errors | `--env-file=../../.env.local` was omitted, or a required value is blank |
| The website shows gyms but the admin console shows none | Correct. The website's catalogue is a fixture and the console reads the database |

---

## 5. What to build next for a fuller demo

In dependency order, from `docs/roadmap/`:

1. **M-023** — the B3.2 permission matrix. Turns `permissions: []` into real role-based screens.
2. **M-024** — TOTP MFA. Completes the sign-in story the console already describes.
3. **M-026 … M-036** — `applications`, `kyc_documents`, the approval workflow. This is the one that
   makes the admin console's Approvals screen real **and** replaces the website's fixture catalogue
   with the database — one change to `src/features/discovery/fixtures/catalogue.ts`.
