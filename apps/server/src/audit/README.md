# audit

**Charter (PRD §C1.3):** _append-only audit log writer and reader._

---

## 1. Bounded context

`audit/` owns the answer to **"what is the immutable record that this mutation happened, who caused
it, from what state, to what state, and why"** — and, critically, it owns **who may create one**. No
module writes an audit row directly: the write port is injected only by `common/`'s `@Audited()`
interceptor and by `tenancy/`'s `runElevated()`, and nothing outside this module may reach the
repository at all. The custody decision is a **database grant**, not application code: `app_append`
holds `INSERT` and no `SELECT`; `app_rw` holds `SELECT` and no `INSERT`, `UPDATE` or `DELETE`; **no
role anywhere holds `UPDATE` or `DELETE`.** A trigger raising on `UPDATE OR DELETE` exists as a
second line and is deliberately never the only one — a trigger can be disabled by the table owner and
the partition-maintenance job runs as the owner. `audit/` sits at layer **L1** beside `tenancy/`,
imports only `common/`, and is the graph's **second sink**.

## 2. PRD identifiers

| Class             | Identifiers                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| :---------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRD sections      | **§C1.5** (_"an interceptor writes before/after state for annotated entities; audit writes go to an append-only table on a connection whose role cannot update or delete"_), **§C5 job 24**                                                                                                                                                                                                                                                                           |
| Business rules    | `BR-DAT-01` (every create, update and delete on a member, membership, payment, plan, gym, staff or configuration record — actor, timestamp, IP, entity, before-state, after-state), `BR-DAT-02` (impersonation: stated reason, time-boxed, visible to the impersonated user, fully audited), `BR-DAT-06` (`before`/`after` are redacted through the same deny-list as the logger — an audit row is not a loophole), `BR-DAT-07` (every KYC document access is logged) |
| Non-functional    | `NFR-SEC-13` (_"append-only and stored where application credentials cannot alter them"_ — a **grant** requirement, not a code one), `NFR-SCAL-06` (monthly range partitioning), `NFR-MNT-04` (correlation id on every row)                                                                                                                                                                                                                                           |
| Cross-module      | `FR-ADMN-02` (a reason on every administrative action), `FR-ADMN-09` (the audit explorer — `admin/` consumes `AUDIT_READ_PORT`; the writer is unreachable from it), `SCR-ADM-015`                                                                                                                                                                                                                                                                                     |
| Acceptance        | `AC-FND-11.1` … `AC-FND-11.6`, `AC-ADMN-02.3` (_given an audit record exists, no interface, API or role permits modification_), `RS-9`, `CI-09`, `CI-10`, `PE2`                                                                                                                                                                                                                                                                                                       |
| Risk              | `TR-41` (partition maintenance fails silently — scored 15), `TR-32` (the audit row is written in the same transaction as the business change)                                                                                                                                                                                                                                                                                                                         |
| C4 state machines | **None owned.** `audit_log` is the **journal** of `§C4.4` (`StateMachines.md` §7) and of every other governed transition, but an audit row is a fact, not a state — it has no lifecycle of its own.                                                                                                                                                                                                                                                                   |

## 3. Owned tables

_Planned. No code in this module yet — populated by the milestones listed below._

| Table       | Class                                                                                                                                                                                                                                                                                  | Notes                                                                                                                                                                                                                                                                                                                                                                                                |
| :---------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audit_log` | **DUAL** tenancy (`tenant_id` present **and** a platform read path behind the audited elevation; `tenant_id` is nullable because a platform action has no tenant) · **G-AUDIT** · **R-AUD, 7 years** · **monthly range-partitioned on `occurred_at`**, primary key `(occurred_at, id)` | `entity_id` carries **no foreign key** — the audit row must outlive its subject (`CON-04`), so an FK is not merely unhelpful, it is _incorrect_. Three partition-local indexes: `(entity_type, entity_id, occurred_at)`, `(actor_id, occurred_at)`, `(tenant_id, occurred_at)`. Y1 ≈ 1.83 M rows / 2.3 GB; at 10× ≈ 18.25 M rows/yr and **84 live partitions** at full retention (`Schema.md` §13.3) |

**Rule `SC-R02` — worth 1.8 TB and not to be quietly dropped.** An append-only table is its own audit
record, so an insert into `ledger_entries`, `membership_events`, `payment_events` or `attendance`
produces **no** `audit_log` row. Exactly two exceptions, both because they record an actor's
_decision_ rather than a system fact: a **staff override of a check-in denial**, and a **check-out
correction** written under the narrow §2.7 grant (`AuditStrategy.md` §1.5).

**Delivering milestones:** **M-013** (table, partitions, `G-AUDIT` grants, the `BEFORE UPDATE OR
DELETE` trigger, the writer, the interceptor, the partition processor declared) · **M-018** (the
processor scheduled — deliberately the job harness's _first_ consumer, so alerting is proven before
anything else depends on it) · **M-117** (the explorer, with no edit or delete affordance anywhere).

## 4. Public surface

_Planned. No `index.ts` exists in this module yet — populated by the milestones listed below._

| Exported symbol                                                                                                                                                 | Consumers                                                                                                                                               | Milestone                            |
| :-------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------- |
| `AUDIT_WRITE_PORT` — **internal by intent**: injected by `common/`'s `@Audited()` interceptor and by `tenancy/`'s `runElevated()`, never called from a use case | The **18** modules holding the `* → audit/` edge — all but `common/`, `tenancy/`, `audit/`, `notifications/` and `ledger/` (`ModuleDependency.md` §3.1) | M-013                                |
| `AUDIT_READ_PORT`                                                                                                                                               | **`admin/` only**, for `FR-ADMN-09` / `SCR-ADM-015`                                                                                                     | M-013 declares it; M-117 consumes it |

`permissions.ts` is **not** present: `FolderStructure.md` §8.1 makes it mandatory _"where controllers
exist"_, and none do.

**Why there are no `controllers/` (`FolderStructure.md` §8.2).** _The **writer** must not be
reachable from the administration UI._ `admin/` reads audit through a query port; nothing outside
`audit/` can write one. This reason is distinct from `common/`'s (a mechanism library with no
context to expose), from `tenancy/`'s (an HTTP surface over tenant resolution is itself the
vulnerability), and from `ledger/`'s (a write endpoint is the API that would let something adjust a
derived balance). Here the concern is **custody**: the value of the record is that the people who
can read it cannot write it, and the path that writes it cannot read, edit or suppress it. Making
the writer addressable would collapse that separation into an authorisation check.

> **Open finding `AUR-03`, recorded because it changes this module's shape and is not yet
> resolved.** `Security.md` §12.2 **AU-2** requires audit writes on a **separate connection under
> `app_append`**; `RiskAnalysis.md` **`TR-32`** requires the audit row in the **same transaction** as
> the business change. A separate connection cannot be in the same transaction, and
> `AuditStrategy.md` §4.7 states plainly that _"the two requirements as written are incompatible,
> and neither document notices."_ It recommends **R1** — a `SECURITY DEFINER` function
> `audit.append_entry(...)` owned by `app_append`, with `EXECUTE` granted to `app_rw` and
> `search_path` pinned — which satisfies both. M-013's file list still describes the separate-
> connection shape (R3). **This must be resolved before the repository is written**
> (`AuditStrategy.md` §4.7 sets the deadline at Sprint 3); the resolution belongs in
> `DECISION_LOG.md`, not in code.

## 5. Consumed ports

**None.** `audit/`'s row in the `ModuleDependency.md` §4 matrix is `●` for `common/` and `—`
everywhere else — including `tenancy/`, which is the one cell worth explaining, since twenty-one
other modules do import it.

`audit/` is one of only two modules that does **not** import `tenancy/` (§3.1). Three reasons, all
load-bearing:

1. The writer runs on the `app_append` connection, not the tenant-scoped client. Routing it through
   `tenancy/`'s extension would put the audit insert inside the business transaction's tenant
   context — which is what `AUR-03` above is still deciding.
2. `audit_log.tenant_id` is **nullable**: a platform action has no tenant. A module that could only
   write under a resolved tenant context could not record the very actions that most need recording.
3. Keeping `audit/` a sink means an audit write can never be the thing that fails because some other
   module's port was slow or wrong.

## 6. Emitted events

**None.** `audit/` publishes nothing in the `ModuleDependency.md` §8.2 catalogue, and the reason is
the module's whole point: an audit row is _already_ the durable, immutable record. Emitting an event
about it would create a second, in-flight, retryable copy of a fact whose entire value is that it
cannot be altered or replayed — and `E5` forbids personal data in event payloads, while
`before`/`after` legitimately carry entity state.

> The §8.2 row for `impersonation.started` / `.ended` lists **`audit/`(via interceptor)** among the
> consumers. That notation means the interceptor writes the row **synchronously**, in the request
> path — it does **not** mean `audit/` runs an outbox handler.

## 7. Consumed events

**None**, for the reason immediately above. Audit capture is synchronous by construction
(`TR-32`); a dead-lettered handler would mean a governed mutation with no audit row, and
`BR-DAT-01` would be breached silently. That is also why the interceptor sits behind **no feature
flag**: an audit write that fails must fail the **request**, not be skipped, so there is
deliberately no kill-switch.

## 8. Jobs

_Planned. No code in this module yet — populated by the milestones listed below._

| Field                           | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| :------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`§C5` job name**              | `audit.partition-maintenance` — **job 24 of 24**                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Schedule**                    | Monthly (`§C5`)                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Queue / class / concurrency** | `audit` · **P4** (`BULK`) · concurrency **1**; class semaphore drops to **0** during gym peak hours, per `PB8`                                                                                                                                                                                                                                                                                                                                                         |
| **Scope**                       | **PL** — runs under `PlatformPrismaService` through an explicit, audited elevation                                                                                                                                                                                                                                                                                                                                                                                     |
| **Lock scope**                  | `audit.partition-maintenance:platform:{yearMonth}` (`Scalability.md` §8.10 grammar)                                                                                                                                                                                                                                                                                                                                                                                    |
| **Expected duration**           | **2 min** at Y1 · **20 min** at 10×. Depth envelope 0 after 7 days; breach severity **P2**                                                                                                                                                                                                                                                                                                                                                                             |
| **Idempotency**                 | Catalogue check before `CREATE`; checksum verification before `DROP`                                                                                                                                                                                                                                                                                                                                                                                                   |
| **What it must do**             | Create partitions **three months ahead** — not just-in-time — and apply `ENABLE` + `FORCE ROW LEVEL SECURITY`, the tenant policy **and** the `G-AUDIT` grant set to **every** new partition, because partitions inherit neither. `CI-10` is the test that proves it did: reading `audit_log_y2026m11` _by name_ as tenant A must return no tenant-B row. Detach beyond 24 months to cold storage, re-attachable as foreign tables for the rare deep `FR-ADMN-09` query |
| **Why the look-ahead**          | If month N+1's partition is missing, rows land in the `DEFAULT` partition — a **P1** in its own right — and without a `DEFAULT` the insert would fail outright. Three months of look-ahead makes two consecutive failures survivable. `TR-41` scores this failure 3 × 5 = **15**                                                                                                                                                                                       |

One further scheduled behaviour is owned here and is **not** a `§C5` job: `audit.daily-seal`
(`Security.md` §12.4, Epic 19), the daily seal that makes tampering _evident_ — layer 4 of the
append-only guarantee, beneath grants, the trigger and custody.

**Delivering milestones:** **M-013** (processor declared) · **M-018** (scheduled; harness's first
consumer, `TR-41`) · **M-117 / T-19.26** (retention, detach and cold-storage behaviour).

## 9. Top three failure modes (`NFR-MNT-09`)

Declared by `PROJECT_CONSTITUTION.md` §18.5.1. Runbook: **[`/docs/runbooks/audit.md`](../../../../docs/runbooks/audit.md)**

|  #  | Failure mode                         | Signal                                                                                                                                                                                                                                               | First action                                                                                                                                                                                                                                                                                                    |
| :-: | :----------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **Write failure on an audited path** | `ALRT-17` — any `increase(db_append_only_grant_violations_total[1h]) > 0` for `audit_log` means code exists that believes it may rewrite history. A write _failure_ surfaces as `5xx` on the mutating route with the audit span erroring; **S1**     | Do **not** reach for a kill-switch — there is none by design, because a skipped audit row is worse than a failed request. Confirm from the log line's `module` + `correlation_id` which path attempted what. If this is capacity rather than a defect, scale the `app_append` pool                              |
|  2  | **Partition maintenance failure**    | `ALRT-21` on `job_outcomes_total{job_name="audit.partition-maintenance", outcome="FAILED"}`, or the dead-man gauge `job_last_success_timestamp_seconds` exceeding a month. The louder downstream signal is rows appearing in the `DEFAULT` partition | Check the next **two** partitions exist before anything else — three months of look-ahead means one failure is survivable and two are not. Then verify the new partition carries `FORCE` RLS, the tenant policy and the `G-AUDIT` grants (`CI-10`); a partition created without them is readable across tenants |
|  3  | **Explorer query timeout at scale**  | `SCR-ADM-015` requests exceeding the report budget; `ALRT-07`. At 10× the largest monthly partition holds ≈1.6 M rows                                                                                                                                | Confirm the query's date range **prunes partitions** — an unbounded range scans all 84. Then check `EXPLAIN` uses one of the three partition-local indexes rather than a sequential scan. Widening the index set is a schema change, not an incident action                                                     |
