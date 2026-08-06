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

## Known incidents

_None yet._
