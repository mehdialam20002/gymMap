# Local environment

Four containers that give you the same **behaviour** as production: PostGIS geometry, trigram
search, a real S3 API and a real SMTP sink. Not a production topology — production uses managed
Postgres and Redis (§C1.1).

Delivered by **M-005** (EP-01 · F-01.20 · T-01.34, A-28).

## Requirements

Docker Desktop, and nothing else. No host-installed Postgres, Redis or `psql` (`E0.9`).

> Docker is **not currently installed on this machine**, so the acceptance criterion "all four
> services reach `healthy`" has not been executed. Everything that is a property of the files —
> pinned digests, the Redis split, the kyc policy, the version assertion — is asserted by
> `apps/server/test/compose-contract.spec.ts`, which needs no daemon.

## Commands

```bash
pnpm infra:up        # start everything, detached
pnpm infra:ps        # health of each service
pnpm infra:verify    # prove the stack matches M-005 (see below)
pnpm infra:logs      # follow logs
pnpm infra:down      # stop, keep data
pnpm infra:reset     # DESTROY volumes and start clean
```

`dev:up`, `dev:down` and `dev:reset` are aliases for the same things.

## Ports

| Service                 | Endpoint                       | Credentials                 |
| :---------------------- | :----------------------------- | :-------------------------- |
| PostgreSQL 16 + PostGIS | `localhost:5432` · db `gymmap` | `postgres` / `postgres`     |
| Redis 7                 | `localhost:6379`               | none                        |
| MinIO S3 API            | `localhost:9000`               | `minioadmin` / `minioadmin` |
| MinIO console           | <http://localhost:9001>        | `minioadmin` / `minioadmin` |
| Mailpit SMTP            | `localhost:1025`               | none                        |
| Mailpit UI              | <http://localhost:8025>        | none                        |

Credentials are fixed, weak and local-only. They are allowlisted in `.gitleaks.toml` precisely
so they can never quietly become anything else. Nothing here leaves the loopback interface.

## `pnpm infra:verify`

`docker compose ps` showing `healthy` only means each container's own health check passed. It
does not prove what this milestone actually promises. `infra:verify` checks the promises:

| Check                                         | Why it exists                                                      |
| :-------------------------------------------- | :----------------------------------------------------------------- |
| Redis has exactly 3 databases                 | A shared index lets a cache `FLUSHDB` delete accepted BullMQ jobs  |
| **The `kyc` bucket refuses an anonymous GET** | `BR-DAT-07` — those objects are PAN cards, Aadhaar and bank proofs |
| The `media` bucket _is_ anonymous-readable    | If it is not, every gym listing renders without images             |
| Postgres, MinIO, Mailpit reachable            | Basic liveness                                                     |

## Three things that are deliberate

**Redis has exactly three databases, not sixteen.**

```
db 0  cache      FLUSHDB-able at any time; nothing here is durable
db 1  queue      BullMQ. Losing this loses accepted, unrun jobs
db 2  ratelimit  rate-limiter-flexible counters (A-13)
```

Capped at 3 so that reaching for `db 7` fails immediately rather than creating a fourth
namespace Terraform never provisioned. The separation is the point: flushing the cache while
debugging is routine, and it must not be able to delete a queue.

**`initdb` asserts; it does not create.**

Extensions are created by the `0_init` Prisma migration in M-006 (ruling `R-M1`). If this
directory created them too, local would get its extensions from Docker and production from the
migration — two provenances for the same objects, which is the local/production divergence this
milestone exists to remove. `CREATE EXTENSION IF NOT EXISTS` in the migration would be a silent
no-op locally and the only real code path in production, so it would ship having never run.

**The Postgres version is asserted, and a mismatch refuses to start.**

Several PostGIS images ship an older Postgres than their tag implies. The mismatch is invisible
for months — everything works until a GiST predicate in `Indexes.md` plans differently, or an
`NFR-DQ-*` guarantee quietly stops holding, by which time the schema rests on it. Refusing to
start is the cheap failure.

## Image digests

Every image is pinned by digest, not tag (`AC-6`). A tag is mutable: `redis:7-alpine` is
repointed by its publisher without notice, so CI and a laptop can run different builds of "the
same" image and produce a difference nobody can diff.

`apps/server/test/harness/images.ts` **parses** the digests out of `compose.yaml` rather than
restating them, so the Testcontainers harness and compose cannot drift. There is one place a
digest is written down, and it is the file that starts the containers.

To bump an image, resolve the new digest and replace the whole `tag@sha256:…` reference:

```bash
REPO=library/redis TAG=7-alpine
TOKEN=$(curl -s "https://auth.docker.io/token?service=registry.docker.io&scope=repository:$REPO:pull" | jq -r .token)
curl -sI -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.oci.image.index.v1+json" \
  "https://registry-1.docker.io/v2/$REPO/manifests/$TAG" | grep -i docker-content-digest
```

## Reset

```bash
pnpm infra:reset
```

Destroys the volumes and starts clean, which re-runs `initdb`. Everything here is disposable by
construction — there is no shared state and no environment worth protecting.

> `AC-7` also requires reset to reapply migrations and the seed. Those do not exist until
> **M-006**; the script gains that step in that milestone. Tracked in `docs/PHASES.md`.
