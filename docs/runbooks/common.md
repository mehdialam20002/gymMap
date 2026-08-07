# common runbook

**Module:** `common/` · **Layer:** L0, shared kernel · **Owner:** Technical Lead
**Module README:** [`apps/server/src/common/README.md`](../../apps/server/src/common/README.md)
**Satisfies:** `NFR-MNT-09` · **Failure modes declared by:** `PROJECT_CONSTITUTION.md` §18.5.1

> **Status: stub.** The failure modes, signals and first actions below are derived from the
> specification and are binding. The dashboards, queries and incident history are populated by the
> milestones named in each section — none of that code exists yet.

---

## Scope

`common/` is the shared kernel: the one implementation of every `§C1.5` cross-cutting mechanism —
typed configuration validated at boot, Pino logging with an `AsyncLocalStorage` correlation id and
the `BR-DAT-06` redaction deny-list, OpenTelemetry span conventions, the error taxonomy and
`ProblemDetails` envelope, the guards and decorators every controller wears, the `Money` value type
(integer minor units, arithmetic only through its own methods), the opaque pagination cursor, the
idempotency store and interceptor, the transactional outbox writer and dispatcher, the Redis
rate-limit class registry, the `Clock` and `IdGenerator` ports, the S3 and PDF ports, and the BullMQ
harness on which all twenty-four `§C5` jobs run. It owns no business decision and no bounded
context, which is why it has no `domain/` and no business controllers. It imports nothing; all
twenty-two other modules import it. **A failure here is never confined to one feature** — that is
the defining property of this runbook and the reason its owner is the Technical Lead.

**Dependencies.** Downward: none. External: Redis (`ADR-0008` — idempotency records, rate limits,
BullMQ), PostgreSQL (`outbox`, `idempotency_keys`, `job_runs`), the OpenTelemetry collector, S3 /
MinIO (`A-18`).
**Owned tables:** `outbox`, `idempotency_keys`, `job_runs`.
**Kill switches:** `ops.common.idempotency-replay` — *pulled*, keys are still **stored** but not
replayed, so a defective fingerprint cannot turn a legitimate second purchase into a replayed first
one. The flag never disables storage, because a gap in the store is unrecoverable.
`ops.notifications.dispatch` — *pulled*, the outbox and delivery queue stop draining and **nothing
is lost**; events keep landing in the outbox in the same transaction as their state change.

## Top failure modes

| # | Signal | Likely cause | First action | Escalation |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Correlation-id propagation lost into jobs.** Worker log lines with no `correlation_id`; a trace ending at the HTTP span with no `job.execute` child; `ALRT-26` fires nearby because tenant context and correlation share the ALS carrier | The enqueue path did not copy the ALS value into the job data. The loss is always at the HTTP → queue boundary, never inside the processor. A second cause: an `await` outside the ALS `run()` scope | Inspect the job payload in Bull Board for the propagated id. Fix at the enqueue site. **Never regenerate an id in the processor** — that produces a plausible-looking trace that cannot be joined to the request that caused it, which is worse than no id | S3 → ticket to Technical Lead. S2 if it coincides with an active incident, because every other runbook's diagnostic step depends on `correlation_id` |
| **2** | **Idempotency store unavailable.** `ALRT-35` — any `increase(redis_evicted_keys_total[5m]) > 0` on the instance holding idempotency records, or `redis_memory_used_bytes / max > 0.85` for 10 m | Redis memory pressure, an eviction policy applied to the wrong keyspace, or queue backlog crowding out idempotency keys on a shared instance | **Treat as a money-correctness incident wearing an infrastructure costume.** An evicted idempotency record turns a client retry into a **second charge** (`BR-PAY-03`, `ADR-0016`). Identify the growing keyspace — idempotency (24 h TTL), rate limits, sessions, or queue backlog (then it is `ALRT-20`). Relieve memory before touching the application. Pulling `ops.common.idempotency-replay` does **not** help and makes replay worse | **S1 on eviction.** Pages immediately. Notify Backend Lead (payments) — duplicate charges may already exist and `payment.duplicate-detect` (job 8) is the compensating control |
| **3** | **Config validation failure at boot.** The process logs `fatal` and terminates; `/readyz` never becomes ready and the instance stays out of rotation | An environment variable missing, malformed, or read from somewhere other than `app-config.schema.ts`. During a deploy: a new required variable that was not added to the target environment | Diff the deployed environment against `app-config.schema.ts` — the schema is the **only** place a variable is declared, and a variable read anywhere else is itself the defect. Roll back the release if the variable is new. **Do not relax the schema to get a boot**: failing closed is the designed behaviour, and a server that boots with unvalidated configuration is the precondition for several worse incidents | S1 if it affects the whole rolling deploy (no healthy instances), S2 if a single instance. Page on-call; Technical Lead if the schema itself is implicated |

**Adjacent alerts that route here rather than to a module runbook:** `ALRT-21` /
`ALRT-21B` (outbox `outbox_oldest_unpublished_age_seconds` — warn at 60 s, page at 300 s),
`ALRT-23` (dead-letter growth), `ALRT-20` (queue depth and `queue_oldest_job_age_seconds`).
The cross-cutting `queue-backlog.md`, `outbox.md` and `redis.md` runbooks carry those in detail;
this file owns the *mechanism* view of them.

## Dashboards and queries

_To be populated by **M-017** (idempotency), **M-018** (outbox, job harness, `job_runs`) and
**M-118** (every `NFR` target measured)._ The intended content, named now so it is not
improvised during an incident:

- **Dashboard 4 — the async spine** (`Monitoring.md` §7): `queue_depth` and
  `queue_oldest_job_age_seconds` per queue; `outbox_unpublished_rows` and
  `outbox_oldest_unpublished_age_seconds`; `queue_dead_letter_total` by `queue` and `job_name`; the
  `job_last_success_timestamp_seconds` dead-man heat strip across all 24 `§C5` jobs.
- **Redis keyspace panel:** `redis_memory_used_bytes`, `redis_evicted_keys_total` and
  `cache_operations_total{cache="idempotency"}` on one row, so an eviction is read next to the
  keyspace that caused it.
- **Poisoned-handler query** (`Monitoring.md` §9, step 6):
  `SELECT event_type, count(*), min(created_at) FROM outbox WHERE published_at IS NULL GROUP BY 1 ORDER BY 3 LIMIT 20;`
  — one dominant `event_type` means a specific handler is failing; a flat spread means the
  dispatcher itself.
- **Correlation-continuity probe:** a synthetic request that enqueues a job and asserts the same
  `correlation_id` appears on the job's log lines and span (`job-correlation.int-spec.ts`, M-018,
  promoted to a production canary at M-118).
- **Boot-config check:** the `fatal`-level log stream filtered to config validation, joined to the
  release id, so a bad deploy is visible before the rollout completes.

---

## M-018 · The outbox and the job harness

### The dispatch cycle, in one paragraph

Domain events land in `outbox` in the **same transaction** as the state change they describe.
A relay polls every five seconds: an **elevated, audited, SELECT-only** read of which tenants have
pending work, then a **tenant-scoped** claim and dispatch for each. Claiming is a WRITE — a single
`UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING *` that pushes `available_at`
forward by a 30-second lease — so the row is invisible to other pollers the instant it is taken.

Delivery is **at-least-once**, not exactly-once. That is the honest guarantee: a worker can
dispatch and die before marking the row `PUBLISHED`. Every `§C5` job is idempotent by construction
(`AC-FND-12.3`), and that is what makes it safe.

### 1 · The outbox backlog is growing

**Signal.** `outbox` PENDING count rising; publication latency approaching `BAC-02`'s 60 s.

```sql
SELECT status, count(*), min(available_at) AS oldest
FROM outbox GROUP BY status ORDER BY status;
```

**First question: is anything CONSUMING it?** An event type with no registered handler is left
`PENDING` with its attempt count untouched — deliberately, so it dispatches the moment its handler
ships rather than dead-lettering while somebody writes the consumer. A backlog of one event type is
usually a module that has not shipped, not a fault.

```sql
SELECT event_type, count(*) FROM outbox
WHERE status = 'PENDING' GROUP BY event_type ORDER BY 2 DESC;
```

**Second: is the relay running at all?** The worker prints its registry at boot. No
`common.outbox-dispatch` line means the worker did not start.

**Third: is the kill-switch pulled?** `ops.notifications.dispatch` stops the outbox draining and
**loses nothing** — events keep landing in the same transaction as their state change and drain on
restore.

### 2 · Draining the dead-letter queue

A row reaches `DEAD` after six failed attempts across roughly ten minutes of backoff. It is work
that was supposed to happen and did not — a notification never sent, a settlement line never
created — so it needs a human, not a retry loop.

```sql
SELECT id, event_type, aggregate_type, aggregate_id, attempts, last_error, created_at
FROM outbox WHERE status = 'DEAD' ORDER BY created_at DESC LIMIT 50;
```

**To replay one after fixing the cause**, reset it to `PENDING` with a cleared attempt count. The
request role holds a column-scoped `UPDATE` grant that permits exactly this and nothing else —
`payload` is deliberately NOT updatable, so a replay cannot quietly change what the event said.

```sql
UPDATE outbox SET status = 'PENDING', attempts = 0, available_at = now(), last_error = NULL
WHERE id = '<id>';
```

**Never** replay a `DEAD` row without reading `last_error` first. Six attempts already failed; a
seventh will too unless something changed.

### 3 · Lock contention — a job is not running

**Signal.** A scheduled job has no recent run line, and no failure either.

The lock is a **Postgres advisory lock**, not a row, so it is released automatically when the
holding session ends — a worker that is OOM-killed mid-job releases it the instant its connection
drops. A wedged lock therefore means a session that is still alive and still holding.

```sql
SELECT l.pid, a.state, a.query_start, a.query
FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
WHERE l.locktype = 'advisory';
```

`SKIPPED_LOCKED` on two of three workers is the **normal** outcome of every schedule fire, not a
failure. It is recorded as its own outcome precisely so a dashboard does not show a two-thirds
error rate and train everyone to ignore the job's alerts.

### 4 · A job that succeeds, late

`AC-FND-12.2` alerts on **overrun** as well as on failure, and the overrun alert is the one that
matters more often. A settlement build that usually takes 40 seconds and today took 40 minutes has
not failed — it will succeed, after the payout window closed. Failure-only alerting is blind to it.

Grep the job log for `JOB OVERRAN`; the line carries the actual and the budgeted duration.

### 5 · The retention sweep

`TR-20`. Published rows are purged 30 days after publication, in batches of 5,000 — a single
unbounded `DELETE` would take a lock proportional to the row count, and the outbox is written on
the request path, so that lock would be held across checkout.

The sweep runs as **`app_migrator`**, never on the request path: `app_rw` holds no `DELETE` grant
on `outbox`, deliberately, so a dispatcher bug cannot erase an undelivered event.

### Two things that are NOT yet what M-018 specified

| Deferred | Why | Discharged by |
| :--- | :--- | :--- |
| `job_runs` is a **log line**, not a table (`BLK-08`) | `Schema.md` §4's register is a closed list of 79 tables and does not contain one. Adding an eightieth is a schema amendment, not a milestone's prerogative. `JobRunSink` is a port; the database adapter drops in behind it and no job changes. | An owner amendment to `Schema.md` |
| `outbox.aggregate_type` is `text`, not an enum (`BLK-07`) | `Schema.md` §2.5 cites 26 aggregate roots at `ERD.md` §6, which lists none; deriving the set yields 36. `MG9` makes an enum value permanent, so a guess would be wrong in the catalogue for eight financial years. | The owner supplying the list |

## Known incidents

_None yet._
